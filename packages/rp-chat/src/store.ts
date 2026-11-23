import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import type { Attempt, Candidate, CandidateGroup, CandidateStatus, Conversation, ConversationData, ChatSettings, MaterialRef, Memo, PromptInput, PromptMessage, Snapshot, Turn, Usage } from './types.js';
import { defaultSettings } from './types.js';
import type { SearchHit, SearchInput, SearchPage, SearchPreview } from './protocol.js';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const stamp = () => Date.now();
const id = () => randomUUID();
function decode<T>(row: Record<string, unknown> | undefined): T {
  if (!row || typeof row.data !== 'string') throw new Error('找不到这条记录');
  return JSON.parse(row.data) as T;
}

const routeAncestors = `
  WITH RECURSIVE route_nodes(candidate_id,turn_id,parent_candidate_id,depth,input_count) AS (
    SELECT c.id,c.turn_id,json_extract(t.data,'$.parentCandidateId'),0,
      CASE WHEN json_extract(t.data,'$.input')<>'' THEN 1 ELSE 0 END
    FROM candidates c JOIN turns t ON t.id=c.turn_id
    WHERE c.id=? AND c.conversation_id=? AND t.conversation_id=c.conversation_id
    UNION ALL
    SELECT c.id,c.turn_id,json_extract(t.data,'$.parentCandidateId'),n.depth+1,
      CASE WHEN json_extract(t.data,'$.input')<>'' THEN 1 ELSE 0 END
    FROM route_nodes n JOIN candidates c ON c.id=n.parent_candidate_id JOIN turns t ON t.id=c.turn_id
    WHERE c.conversation_id=? AND t.conversation_id=c.conversation_id
  ),
  reply_sources(origin_id,conversation_id,kind,source_id,has_text) AS (
    SELECT n.candidate_id,c.conversation_id,json_extract(c.data,'$.kind'),json_extract(c.data,'$.sourceCandidateId'),
      CASE WHEN json_extract(c.data,'$.text')<>'' THEN 1 ELSE 0 END
    FROM route_nodes n JOIN candidates c ON c.id=n.candidate_id
    UNION ALL
    SELECT s.origin_id,c.conversation_id,json_extract(c.data,'$.kind'),json_extract(c.data,'$.sourceCandidateId'),
      CASE WHEN json_extract(c.data,'$.text')<>'' THEN 1 ELSE 0 END
    FROM reply_sources s JOIN candidates c ON c.id=s.source_id AND c.conversation_id=s.conversation_id
    WHERE s.kind='continuation' AND s.has_text=0
  ),
  message_counts AS (
    SELECT n.candidate_id,n.turn_id,n.parent_candidate_id,n.depth,n.input_count+max(s.has_text) AS message_count
    FROM route_nodes n JOIN reply_sources s ON s.origin_id=n.candidate_id GROUP BY n.candidate_id
  ),
  ancestors AS (
    SELECT candidate_id,turn_id,parent_candidate_id,depth,
      coalesce(sum(message_count) OVER (ORDER BY depth ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS message_depth,
      message_count
    FROM message_counts
  )`;

/** Append-oriented story storage. One prompt-prefix chain serves every roll. */
export class ConversationStore {
  private readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    // Run only for returned hits; full bodies stay in SQLite until a single preview is opened.
    this.db.function('tavern_excerpt', (body, matchAt) => {
      if (typeof body !== 'string' || typeof matchAt !== 'number') throw new TypeError('搜索正文需要文本与命中位置');
      // SQLite returns a character position; keep its exact match and do not re-fold Unicode in JS.
      const chars = Array.from(body), start = Math.max(0, matchAt - 61);
      return (start ? '…' : '') + chars.slice(start, start + 160).join('') + (start + 160 < chars.length ? '…' : '');
    });
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS turns(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS turns_conversation ON turns(conversation_id);
      CREATE TABLE IF NOT EXISTS snapshots(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS groups_(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,turn_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS groups_turn ON groups_(turn_id);
      CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,turn_id TEXT NOT NULL,group_id TEXT NOT NULL,ordinal INTEGER NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS candidates_turn ON candidates(turn_id,ordinal);
      CREATE INDEX IF NOT EXISTS candidates_active ON candidates(conversation_id) WHERE json_extract(data,'$.status') IN ('pending','streaming');
      CREATE INDEX IF NOT EXISTS candidates_continuation_source ON candidates(json_extract(data,'$.sourceCandidateId')) WHERE json_extract(data,'$.kind')='continuation';
      CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,turn_id TEXT NOT NULL,candidate_id TEXT,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS attempts_turn ON attempts(turn_id);
      CREATE INDEX IF NOT EXISTS attempts_candidate ON attempts(candidate_id);
      CREATE TABLE IF NOT EXISTS memos(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inputs(id TEXT PRIMARY KEY,system TEXT NOT NULL,head TEXT);
      CREATE TABLE IF NOT EXISTS message_prefixes(id TEXT PRIMARY KEY,parent TEXT,role TEXT NOT NULL,content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS archives(id TEXT PRIMARY KEY,name TEXT NOT NULL,bytes BLOB NOT NULL);
    `);
    // A stopped Host never silently reissues a paid request after restart.
    for (const table of ['candidates', 'attempts']) {
      this.db.prepare(`UPDATE ${table} SET data=json_set(data,'$.status','stopped') WHERE json_extract(data,'$.status') IN ('pending','streaming')`).run();
    }
  }
  close(): void { this.db.close(); }
  private one<T>(table: string, key: string): T { return decode<T>(this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(key)); }
  private rows<T>(table: string, column: string, key: string): T[] { return this.db.prepare(`SELECT data FROM ${table} WHERE ${column}=? ORDER BY rowid`).all(key).map(row => decode<T>(row)); }
  private save<T extends { id: string }>(table: string, value: T): T {
    this.db.prepare(`UPDATE ${table} SET data=? WHERE id=?`).run(JSON.stringify(value), value.id); return value;
  }
  transaction<T>(action: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = action(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  createConversation(options: { title: string; settings?: Partial<ChatSettings>; bindings?: MaterialRef[]; source?: Conversation['source'] }): Conversation {
    const value: Conversation = { id: id(), title: options.title, bindings: options.bindings ?? [], settings: { ...defaultSettings(), ...options.settings }, settingsRevision: 1, source: options.source, createdAt: stamp(), updatedAt: stamp() };
    this.db.prepare('INSERT INTO conversations VALUES(?,?)').run(value.id, JSON.stringify(value)); return value;
  }
  getConversation(key: string): Conversation { return this.one('conversations', key); }
  listConversations(): Conversation[] { return this.db.prepare('SELECT data FROM conversations ORDER BY json_extract(data,\'$.updatedAt\') DESC').all().map(row => decode<Conversation>(row)); }
  search(input: SearchInput): SearchPage {
    const offset = input.offset ?? 0, limit = input.limit ?? 30;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0 || limit > 100) throw new RangeError('搜索分页需要非负整数，每页最多100条');
    if (input.conversationId !== undefined) this.getConversation(input.conversationId);
    if (!input.query.trim()) return { items: [], total: 0 };
    // Resolve continuation references transiently, never copy cumulative replies into a second store.
    // instr treats %, _, quotes and FTS operators as ordinary text. Only the requested page leaves SQL.
    const rows = this.db.prepare(`WITH RECURSIVE
      scope(query,conversation_id) AS (VALUES (?,?)),
      bodies(id,conversation_id,turn_id,ordinal,created_at,body) AS (
        SELECT c.id,c.conversation_id,c.turn_id,c.ordinal,json_extract(c.data,'$.createdAt'),json_extract(c.data,'$.text')
        FROM candidates c,scope s
        WHERE (s.conversation_id IS NULL OR c.conversation_id=s.conversation_id)
          AND (json_extract(c.data,'$.kind')<>'continuation' OR json_extract(c.data,'$.sourceCandidateId') IS NULL)
        UNION ALL
        SELECT c.id,c.conversation_id,c.turn_id,c.ordinal,json_extract(c.data,'$.createdAt'),b.body||json_extract(c.data,'$.text')
        FROM bodies b JOIN candidates c ON json_extract(c.data,'$.sourceCandidateId')=b.id AND c.conversation_id=b.conversation_id
        WHERE json_extract(c.data,'$.kind')='continuation'
      ),
      messages(conversation_id,turn_id,candidate_id,role,ordinal,created_at,body) AS (
        SELECT t.conversation_id,t.id,c.id,'user',c.ordinal,json_extract(t.data,'$.createdAt'),json_extract(t.data,'$.input')
        FROM turns t CROSS JOIN scope s LEFT JOIN candidates c ON c.id=(SELECT first.id FROM candidates first WHERE first.turn_id=t.id ORDER BY first.ordinal LIMIT 1)
        WHERE s.conversation_id IS NULL OR t.conversation_id=s.conversation_id
        UNION ALL
        SELECT conversation_id,turn_id,id,'assistant',ordinal,created_at,body FROM bodies
      ),
      matches AS (
        SELECT m.*,instr(lower(m.body),lower(s.query)) AS match_at,json_extract(v.data,'$.title') AS title,v.rowid AS conversation_seq,t.rowid AS turn_seq
        FROM messages m JOIN conversations v ON v.id=m.conversation_id JOIN turns t ON t.id=m.turn_id CROSS JOIN scope s
        WHERE instr(lower(m.body),lower(s.query))>0
      ),
      page AS (
        SELECT * FROM matches ORDER BY created_at DESC,conversation_seq DESC,turn_seq DESC,role,ordinal DESC LIMIT ? OFFSET ?
      )
      SELECT totals.total,p.conversation_id,p.turn_id,p.candidate_id,p.role,p.ordinal,p.created_at,p.title,
        CASE WHEN p.turn_id IS NOT NULL THEN tavern_excerpt(p.body,p.match_at) END AS excerpt
      FROM (SELECT count(*) AS total FROM matches) totals LEFT JOIN page p ON 1
      ORDER BY p.created_at DESC,p.conversation_seq DESC,p.turn_seq DESC,p.role,p.ordinal DESC
    `).all(input.query, input.conversationId ?? null, limit, offset);
    const items: SearchHit[] = rows.flatMap(row => {
      if (typeof row.turn_id !== 'string') return [];
      return [{ conversationId: String(row.conversation_id), conversationTitle: String(row.title), turnId: row.turn_id,
        ...(typeof row.candidate_id === 'string' ? { candidateId: row.candidate_id, ordinal: Number(row.ordinal) } : {}),
        role: row.role === 'user' ? 'user' : 'assistant', excerpt: String(row.excerpt), createdAt: Number(row.created_at) }];
    });
    return { items, total: Number(rows[0]?.total ?? 0) };
  }
  searchPreview(hit: SearchHit): SearchPreview {
    const conversation = this.getConversation(hit.conversationId), turn = this.getTurn(hit.turnId);
    if (turn.conversationId !== conversation.id) throw new Error('这轮输入不属于当前对话');
    const result: SearchPreview = { conversationId: conversation.id, conversationTitle: conversation.title, turnId: turn.id, input: turn.input };
    if (hit.candidateId !== undefined) {
      const candidate = this.getCandidate(hit.candidateId);
      if (candidate.conversationId !== conversation.id || candidate.turnId !== turn.id) throw new Error('这条回复不属于当前回合');
      return { ...result, candidateId: candidate.id, reply: this.candidateText(candidate.id), ordinal: candidate.ordinal, status: candidate.status };
    }
    return result;
  }
  findSource(sourceId: string, fingerprint?: string): Conversation[] { return this.listConversations().filter(c => c.source?.id === sourceId && (fingerprint === undefined || c.source.fingerprint === fingerprint)); }
  updateConversation(key: string, changes: { title?: string; bindings?: MaterialRef[]; settings?: Partial<ChatSettings> }): Conversation {
    const value = this.getConversation(key);
    return this.save('conversations', { ...value, ...changes, settings: { ...value.settings, ...changes.settings }, settingsRevision: value.settingsRevision + 1, updatedAt: stamp() });
  }
  createTurn(conversationId: string, options: { parentCandidateId?: string; input: string }): Turn {
    this.getConversation(conversationId);
    if (options.parentCandidateId && this.getCandidate(options.parentCandidateId).conversationId !== conversationId) throw new Error('这条回复不属于当前对话');
    const value: Turn = { id: id(), conversationId, ...options, createdAt: stamp() };
    this.db.prepare('INSERT INTO turns VALUES(?,?,?)').run(value.id, conversationId, JSON.stringify(value)); return value;
  }
  getTurn(key: string): Turn { return this.one('turns', key); }
  listTurns(conversationId: string): Turn[] { return this.rows('turns', 'conversation_id', conversationId); }
  turnSummaries(conversationId:string): {id:string;parentTurnId?:string;input:string;candidates:number;previewCandidateId?:string}[] {
    const rows=this.db.prepare(`WITH RECURSIVE selected(candidate_id,turn_id,parent_candidate_id,conversation_id) AS (
      SELECT c.id,c.turn_id,json_extract(t.data,'$.parentCandidateId'),v.id
      FROM conversations v JOIN candidates c ON c.id=json_extract(v.data,'$.currentCandidateId') AND c.conversation_id=v.id
      JOIN turns t ON t.id=c.turn_id AND t.conversation_id=v.id WHERE v.id=?
      UNION ALL
      SELECT c.id,c.turn_id,json_extract(t.data,'$.parentCandidateId'),s.conversation_id
      FROM selected s JOIN candidates c ON c.id=s.parent_candidate_id AND c.conversation_id=s.conversation_id
      JOIN turns t ON t.id=c.turn_id AND t.conversation_id=s.conversation_id
    )
    SELECT t.id,substr(json_extract(t.data,'$.input'),1,100) AS input,p.turn_id AS parent_turn_id,count(c.id) AS n,
      coalesce(s.candidate_id,(SELECT first.id FROM candidates first WHERE first.turn_id=t.id AND first.conversation_id=t.conversation_id ORDER BY first.ordinal LIMIT 1)) AS preview_id
    FROM turns t LEFT JOIN candidates p ON p.id=json_extract(t.data,'$.parentCandidateId')
    LEFT JOIN candidates c ON c.turn_id=t.id LEFT JOIN selected s ON s.turn_id=t.id
    WHERE t.conversation_id=? GROUP BY t.id ORDER BY t.rowid`).all(conversationId,conversationId);
    return rows.map(row=>({id:String(row.id),parentTurnId:typeof row.parent_turn_id==='string'?row.parent_turn_id:undefined,input:String(row.input).slice(0,100),candidates:Number(row.n),previewCandidateId:typeof row.preview_id==='string'?row.preview_id:undefined}));
  }
  private saveInput(input: PromptInput): string {
    let parent: string | null = null;
    for (const message of input.messages) {
      const messageId = hash([parent, message.role, message.content]);
      this.db.prepare('INSERT OR IGNORE INTO message_prefixes VALUES(?,?,?,?)').run(messageId, parent, message.role, message.content);
      parent = messageId;
    }
    const inputId = hash([input.system, parent]);
    this.db.prepare('INSERT OR IGNORE INTO inputs VALUES(?,?,?)').run(inputId, input.system, parent); return inputId;
  }
  readInput(key: string): PromptInput {
    const input = this.db.prepare('SELECT system,head FROM inputs WHERE id=?').get(key);
    if (!input || typeof input.system !== 'string') throw new Error('找不到保存的模型输入');
    const messages: PromptMessage[] = [];
    let parent = input.head as string | null;
    while (parent) {
      const message = this.db.prepare('SELECT parent,role,content FROM message_prefixes WHERE id=?').get(parent);
      if (!message) throw new Error('模型输入引用不完整');
      messages.push({ role: message.role as PromptMessage['role'], content: String(message.content) }); parent = message.parent as string | null;
    }
    return { system: input.system, messages: messages.reverse() };
  }
  createSnapshot(conversationId: string, options: PromptInput & { bindings: MaterialRef[]; options: Snapshot['options']; boundaryCandidateId?: string; memoId?: string; sources?: Snapshot['sources']; mvu?: Omit<NonNullable<Snapshot['mvu']>, 'templateInputId'> & { template: PromptInput } }): Snapshot {
    const mvu = options.mvu ? { before: options.mvu.before, read: options.mvu.read, issues: options.mvu.issues, prompt: options.mvu.prompt, templateInputId: this.saveInput(options.mvu.template) } : undefined;
    const value: Snapshot = { id: id(), conversationId, inputId: this.saveInput(options), boundaryCandidateId: options.boundaryCandidateId, bindings: options.bindings, memoId: options.memoId, options: options.options, sources: options.sources ?? [], createdAt: stamp(), mvu };
    this.db.prepare('INSERT INTO snapshots VALUES(?,?,?)').run(value.id, conversationId, JSON.stringify(value)); return value;
  }
  getSnapshot(key: string): Snapshot { return this.one('snapshots', key); }
  inputForSnapshot(key: string): PromptInput { return this.readInput(this.getSnapshot(key).inputId); }
  createGroup(turnId: string, options: Omit<CandidateGroup, 'id' | 'turnId' | 'conversationId' | 'createdAt'>): CandidateGroup {
    const turn = this.getTurn(turnId);
    const snapshot = this.getSnapshot(options.snapshotId);
    if (snapshot.conversationId !== turn.conversationId) throw new Error('上下文不属于这段对话');
    const value: CandidateGroup = { ...options, id: id(), turnId, conversationId: turn.conversationId, createdAt: stamp() };
    this.db.prepare('INSERT INTO groups_ VALUES(?,?,?,?)').run(value.id, value.conversationId, turnId, JSON.stringify(value)); return value;
  }
  getGroup(key: string): CandidateGroup { return this.one('groups_', key); }
  groupsForTurn(turnId: string): CandidateGroup[] { return this.rows('groups_', 'turn_id', turnId); }
  createCandidate(groupId: string, options: { kind: Candidate['kind']; sourceCandidateId?: string; text?: string; status?: CandidateStatus; imported?: Candidate['imported']; mvu?: Candidate['mvu'] }): Candidate {
    const group = this.getGroup(groupId);
    const count = this.db.prepare('SELECT count(*) AS n FROM candidates WHERE turn_id=?').get(group.turnId);
    const value: Candidate = { id: id(), conversationId: group.conversationId, turnId: group.turnId, groupId, ordinal: Number(count?.n) + 1, kind: options.kind, sourceCandidateId: options.sourceCandidateId, text: options.text ?? '', status: options.status ?? 'pending', favorite: false, createdAt: stamp(), imported: options.imported, mvu: options.mvu };
    this.db.prepare('INSERT INTO candidates VALUES(?,?,?,?,?,?)').run(value.id, value.conversationId, value.turnId, groupId, value.ordinal, JSON.stringify(value)); return value;
  }
  getCandidate(key: string): Candidate { return this.one('candidates', key); }
  candidateText(key: string): string {
    const value = this.getCandidate(key);
    if (value.kind === 'continuation' && value.sourceCandidateId) return this.candidateText(value.sourceCandidateId) + value.text;
    return value.text;
  }
  editCandidate(key: string, text: string): Candidate {
    const source = this.getCandidate(key);
    return this.createCandidate(source.groupId, { kind: 'edited', sourceCandidateId: source.id, text, status: 'complete', mvu: source.mvu });
  }
  setCandidateMvu(key: string, value: NonNullable<Candidate['mvu']>): Candidate { return this.save('candidates', { ...this.getCandidate(key), mvu: value }); }
  setFavorite(key: string, favorite: boolean): Candidate { return this.save('candidates', { ...this.getCandidate(key), favorite }); }
  setCandidateStatus(key: string, status: CandidateStatus): Candidate { return this.save('candidates', { ...this.getCandidate(key), status }); }
  appendCandidateDelta(key: string, delta: string): Candidate { const value = this.getCandidate(key); return this.save('candidates', { ...value, status: 'streaming', text: value.text + delta }); }
  listCandidates(turnId: string, options: { offset?: number; limit?: number; favoritesOnly?: boolean; groupId?: string } = {}): { items: Candidate[]; total: number } {
    const values: SQLInputValue[] = [turnId];
    let where = 'turn_id=?';
    if (options.favoritesOnly) where += " AND json_extract(data,'$.favorite')=1";
    if (options.groupId) { where += ' AND group_id=?'; values.push(options.groupId); }
    const total = Number(this.db.prepare(`SELECT count(*) AS n FROM candidates WHERE ${where}`).get(...values)?.n);
    const items = this.db.prepare(`SELECT data FROM candidates WHERE ${where} ORDER BY ordinal LIMIT ? OFFSET ?`).all(...values, options.limit ?? 30, options.offset ?? 0).map(row => decode<Candidate>(row));
    return { items, total };
  }
  pendingCandidates(conversationId: string): Candidate[] {
    this.getConversation(conversationId);
    return this.db.prepare(`SELECT data FROM candidates WHERE conversation_id=? AND json_extract(data,'$.status') IN ('pending','streaming') ORDER BY rowid`).all(conversationId).map(row => decode<Candidate>(row));
  }
  selectCandidate(key: string): Conversation {
    const value = this.getCandidate(key), conversation = this.getConversation(value.conversationId);
    return this.save('conversations', { ...conversation, currentCandidateId: key, updatedAt: stamp() });
  }
  route(conversationId: string, leafId: string | null | undefined = this.getConversation(conversationId).currentCandidateId): { turn: Turn; candidate: Candidate }[] {
    const rows: { turn: Turn; candidate: Candidate }[] = [];
    let current = leafId;
    while (current) {
      const candidate = this.getCandidate(current), turn = this.getTurn(candidate.turnId);
      if (turn.conversationId !== conversationId) throw new Error('剧情引用不属于当前对话');
      rows.push({ turn, candidate: { ...candidate, text: this.candidateText(candidate.id) } }); current = turn.parentCandidateId;
    }
    return rows.reverse();
  }
  routePage(conversationId: string, offset = 0, limit = 30): { total: number; items: { turn: Turn; candidate: Candidate; depth: number }[] } {
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 0) throw new RangeError('剧情分页需要非负整数');
    const leaf = this.getConversation(conversationId).currentCandidateId;
    if (!leaf) return { total: 0, items: [] };
    const rows = this.db.prepare(`${routeAncestors}, page AS (
        SELECT candidate_id,depth,message_depth FROM ancestors ORDER BY depth LIMIT ? OFFSET ?
      )
      SELECT totals.total,c.data AS candidate,t.data AS turn,page.message_depth
      FROM (SELECT count(*) AS total FROM ancestors) totals
      LEFT JOIN page ON 1
      LEFT JOIN candidates c ON c.id=page.candidate_id
      LEFT JOIN turns t ON t.id=c.turn_id
      ORDER BY page.depth DESC
    `).all(leaf, conversationId, conversationId, limit, offset);
    const items = rows.flatMap(row => {
      if (typeof row.candidate !== 'string' || typeof row.turn !== 'string') return [];
      const candidate = decode<Candidate>({ data: row.candidate });
      const text = candidate.kind === 'continuation' && candidate.sourceCandidateId ? this.candidateText(candidate.sourceCandidateId) + candidate.text : candidate.text;
      return [{ turn: decode<Turn>({ data: row.turn }), candidate: { ...candidate, text }, depth: Number(row.message_depth) }];
    });
    return { total: Number(rows[0]?.total ?? 0), items };
  }
  candidateDisplayDepth(candidateId: string): number {
    const target = this.db.prepare(`
      SELECT c.conversation_id,c.turn_id,json_extract(v.data,'$.currentCandidateId') AS leaf
      FROM candidates c JOIN conversations v ON v.id=c.conversation_id WHERE c.id=?
    `).get(candidateId);
    if (!target || typeof target.conversation_id !== 'string' || typeof target.turn_id !== 'string') throw new Error('找不到这条记录');
    if (typeof target.leaf !== 'string') return 0;
    const row = this.db.prepare(`${routeAncestors}
      SELECT message_depth FROM ancestors WHERE turn_id=? LIMIT 1
    `).get(target.leaf,target.conversation_id,target.conversation_id,target.turn_id);
    return Number(row?.message_depth ?? 0);
  }
  saveMemo(conversationId: string, options: Omit<Memo, 'id' | 'conversationId' | 'createdAt'>): Memo {
    this.getConversation(conversationId);
    if (options.basedOnCandidateId && this.getCandidate(options.basedOnCandidateId).conversationId !== conversationId) throw new Error('备忘的剧情来源不在当前对话');
    if (options.sourceCandidateId && this.getCandidate(options.sourceCandidateId).conversationId !== conversationId) throw new Error('备忘的适用来源不在当前对话');
    if (options.anchorTurnId && this.getTurn(options.anchorTurnId).conversationId !== conversationId) throw new Error('备忘的生效回合不在当前对话');
    const value: Memo = { id: id(), conversationId, ...options, createdAt: stamp() };
    this.db.prepare('INSERT INTO memos VALUES(?,?,?)').run(value.id, conversationId, JSON.stringify(value)); return value;
  }
  memos(conversationId: string): Memo[] { return this.rows('memos', 'conversation_id', conversationId); }
  applicableMemo(conversationId: string, leafId?: string | null, targetTurnId?: string): Memo | undefined {
    const route = this.route(conversationId, leafId);
    const ancestors = new Set(route.map(row => row.candidate.id)), turns = new Set(route.map(row => row.turn.id));
    return this.memos(conversationId).reverse().find(memo => {
      if (memo.anchorTurnId) {
        if (memo.anchorTurnId !== targetTurnId && !turns.has(memo.anchorTurnId)) return false;
        if (memo.kind === 'manual') return true;
      }
      const source = memo.sourceCandidateId ?? memo.basedOnCandidateId;
      return !source || ancestors.has(source);
    });
  }
  createAttempt(options: Omit<Attempt, 'id' | 'conversationId' | 'status' | 'output' | 'reasoning' | 'createdAt'>): Attempt {
    const turn = this.getTurn(options.turnId);
    const value: Attempt = { ...options, id: id(), conversationId: turn.conversationId, status: 'pending', output: '', reasoning: '', createdAt: stamp() };
    this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?)').run(value.id, value.conversationId, value.turnId, value.candidateId ?? null, JSON.stringify(value)); return value;
  }
  getAttempt(key: string): Attempt { return this.one('attempts', key); }
  appendAttemptDelta(key: string, text: string, reasoning = ''): void {
    const value = this.getAttempt(key);
    this.save('attempts', { ...value, status: 'streaming', output: value.output + text, reasoning: value.reasoning + reasoning });
    if (text && value.candidateId) this.appendCandidateDelta(value.candidateId, text);
  }
  finishAttempt(key: string, result: Pick<Attempt, 'status'> & Partial<Pick<Attempt, 'finishReason' | 'error' | 'usage'>>): Attempt {
    return this.save('attempts', { ...this.getAttempt(key), ...result, endedAt: stamp() });
  }
  attemptsForCandidate(key: string): Attempt[] { return this.rows('attempts', 'candidate_id', key); }
  attemptsForTurn(key: string): Attempt[] { return this.rows('attempts', 'turn_id', key); }
  actualRoute(candidateId: string): Attempt['route'] {
    const attempts = this.attemptsForCandidate(candidateId).filter(row => row.output.length > 0);
    const last = attempts.at(-1);
    if (last) return last.route ?? { ...last.config, inputBudget: 16384 };
    const candidate = this.getCandidate(candidateId);
    return candidate.sourceCandidateId ? this.actualRoute(candidate.sourceCandidateId) : undefined;
  }
  usageForTurn(key: string): { requestCount: number; knownRequestCount: number; inputTokens: number; outputTokens: number; cachedInputTokens: number; unknownRequests: number } {
    const attempts = this.attemptsForTurn(key).filter(a => a.status !== 'skipped');
    const known = attempts.filter(a => a.usage !== undefined);
    return { requestCount: attempts.length, knownRequestCount: known.length, inputTokens: known.reduce((n,a) => n + (a.usage?.inputTokens ?? 0), 0), outputTokens: known.reduce((n,a) => n + (a.usage?.outputTokens ?? 0), 0), cachedInputTokens: known.reduce((n,a) => n + (a.usage?.cachedInputTokens ?? 0), 0), unknownRequests: attempts.length - known.length };
  }
  storageCounts(): { snapshots: number; inputs: number; messagePrefixes: number } {
    const count = (table: string) => Number(this.db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n);
    return { snapshots: count('snapshots'), inputs: count('inputs'), messagePrefixes: count('message_prefixes') };
  }
  saveArchive(name: string, bytes: Uint8Array): string { const key = hash(bytes); this.db.prepare('INSERT OR IGNORE INTO archives VALUES(?,?,?)').run(key, name, bytes); return key; }
  readArchive(key: string): { name: string; bytes: Uint8Array } {
    const row = this.db.prepare('SELECT name,bytes FROM archives WHERE id=?').get(key);
    if (!row || !(row.bytes instanceof Uint8Array)) throw new Error('原始导出文件不在本地'); return { name: String(row.name), bytes: row.bytes };
  }
  exportData(conversationId: string): ConversationData {
    const snapshots = this.rows<Snapshot>('snapshots','conversation_id',conversationId);
    const inputIds = [...new Set(snapshots.flatMap(snapshot => snapshot.mvu ? [snapshot.inputId, snapshot.mvu.templateInputId] : [snapshot.inputId]))];
    const inputs: ConversationData['inputs'] = [];
    const prefixes = new Map<string, ConversationData['messagePrefixes'][number]>();
    for (const key of inputIds) {
      const row = this.db.prepare('SELECT * FROM inputs WHERE id=?').get(key)!;
      inputs.push({ id: key, system: String(row.system), head: row.head as string | null });
      let parent = row.head as string | null;
      while (parent && !prefixes.has(parent)) { const p = this.db.prepare('SELECT * FROM message_prefixes WHERE id=?').get(parent)!; prefixes.set(parent, { id: parent, parent: p.parent as string|null, role: p.role as PromptMessage['role'], content: String(p.content) }); parent = p.parent as string|null; }
    }
    return { conversation: this.getConversation(conversationId), turns: this.listTurns(conversationId), groups: this.rows('groups_','conversation_id',conversationId), candidates: this.rows('candidates','conversation_id',conversationId), snapshots, attempts: this.rows('attempts','conversation_id',conversationId), memos: this.memos(conversationId), inputs, messagePrefixes: [...prefixes.values()] };
  }
  importData(data: ConversationData, bindings: (refs: MaterialRef[]) => MaterialRef[] = refs => refs, materialIds: ReadonlyMap<string, string> = new Map()): Conversation {
    const oldConversation = data.conversation;
    const newId = id();
    const ids = new Map<string,string>();
    for (const rows of [data.turns,data.groups,data.candidates,data.snapshots,data.attempts,data.memos]) for (const row of rows) ids.set(row.id,id());
    const remap = (old?: string) => old ? ids.get(old) : undefined;
    const conversation: Conversation = { ...oldConversation, id:newId, title:oldConversation.title, bindings:bindings(oldConversation.bindings), currentCandidateId:remap(oldConversation.currentCandidateId), createdAt:stamp(), updatedAt:stamp() };
    this.transaction(()=> {
      this.db.prepare('INSERT INTO conversations VALUES(?,?)').run(newId,JSON.stringify(conversation));
      for (const input of data.inputs) this.db.prepare('INSERT OR IGNORE INTO inputs VALUES(?,?,?)').run(input.id,input.system,input.head);
      for (const prefix of data.messagePrefixes) this.db.prepare('INSERT OR IGNORE INTO message_prefixes VALUES(?,?,?,?)').run(prefix.id,prefix.parent,prefix.role,prefix.content);
      for (const row of data.turns) { const v:Turn={...row,id:remap(row.id)!,conversationId:newId,parentCandidateId:remap(row.parentCandidateId)}; this.db.prepare('INSERT INTO turns VALUES(?,?,?)').run(v.id,newId,JSON.stringify(v)); }
      for (const row of data.snapshots) {
        // Only frozen lore metadata contains system-owned material IDs; MVU state stays opaque.
        const mvu = row.mvu?.prompt ? { ...row.mvu, prompt: { ...row.mvu.prompt, triggeredLore: row.mvu.prompt.triggeredLore.map(hit => {
          const separator = hit.indexOf(':');
          const materialId = separator < 0 ? undefined : materialIds.get(hit.slice(0, separator));
          return materialId === undefined ? hit : materialId + hit.slice(separator);
        }) } } : row.mvu;
        const v:Snapshot={...row,id:remap(row.id)!,conversationId:newId,boundaryCandidateId:remap(row.boundaryCandidateId),memoId:remap(row.memoId),bindings:bindings(row.bindings),mvu,options:{...row.options,...(typeof row.options.continuationOf==='string'?{continuationOf:remap(row.options.continuationOf)}:{})}};
        this.db.prepare('INSERT INTO snapshots VALUES(?,?,?)').run(v.id,newId,JSON.stringify(v));
      }
      for (const row of data.groups) { const v:CandidateGroup={...row,id:remap(row.id)!,conversationId:newId,turnId:remap(row.turnId)!,snapshotId:remap(row.snapshotId)!,sourceCandidateId:remap(row.sourceCandidateId)}; this.db.prepare('INSERT INTO groups_ VALUES(?,?,?,?)').run(v.id,newId,v.turnId,JSON.stringify(v)); }
      for (const row of data.candidates) { const v:Candidate={...row,id:remap(row.id)!,conversationId:newId,turnId:remap(row.turnId)!,groupId:remap(row.groupId)!,sourceCandidateId:remap(row.sourceCandidateId),status:['pending','streaming'].includes(row.status)?'stopped':row.status}; this.db.prepare('INSERT INTO candidates VALUES(?,?,?,?,?,?)').run(v.id,newId,v.turnId,v.groupId,v.ordinal,JSON.stringify(v)); }
      for (const row of data.attempts) { const v:Attempt={...row,id:remap(row.id)!,conversationId:newId,turnId:remap(row.turnId)!,candidateId:remap(row.candidateId),snapshotId:remap(row.snapshotId)!,status:['pending','streaming'].includes(row.status)?'stopped':row.status}; this.db.prepare('INSERT INTO attempts VALUES(?,?,?,?,?)').run(v.id,newId,v.turnId,v.candidateId??null,JSON.stringify(v)); }
      for (const row of data.memos) { const v:Memo={...row,id:remap(row.id)!,conversationId:newId,basedOnCandidateId:remap(row.basedOnCandidateId),sourceCandidateId:remap(row.sourceCandidateId),anchorTurnId:remap(row.anchorTurnId),previousId:remap(row.previousId)}; this.db.prepare('INSERT INTO memos VALUES(?,?,?)').run(v.id,newId,JSON.stringify(v)); }
    });
    return conversation;
  }
}
