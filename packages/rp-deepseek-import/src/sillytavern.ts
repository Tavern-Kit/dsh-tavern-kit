import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import type { ImportedReply, ImportedTurn } from '@tavern-kit/rp-chat/protocol';
import type { MvuState } from '@tavern-kit/rp-chat/types';
import type { ConversationPreview, ExportPreview, ImportSink } from './import.js';

type JsonData = MvuState['stat_data'];
type JsonValue = JsonData[string];
type JsonObject = Record<string, unknown>;
interface SourceLine { value: JsonObject; line: number }
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const record = (value: unknown): JsonObject => object(value) ? value : {};
const hash = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex');
const person = (value: unknown): string | undefined => typeof value === 'string' && value.trim() && value !== 'unused' ? value : undefined;
function failure(name: string, line: number, detail: string): never { throw new Error(`${name} 第 ${line} 行：${detail}`); }

/** Copy only finite JSON data. Imported snapshots are never evaluated or replayed. */
function snapshotJson(value: unknown, name: string, line: number): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((child: unknown) => snapshotJson(child, name, line));
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshotJson(child, name, line)]));
  failure(name, line, '变量快照需要是有效的有限 JSON 数据');
}

function mvuSnapshot(value: unknown, name: string, line: number, carrier: string): MvuState | undefined {
  // Helper can store unrelated message/chat variables; they remain in the original JSONL.
  if (!object(value) || !Object.hasOwn(value, 'stat_data')) return undefined;
  const data = snapshotJson(value, name, line);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) failure(name, line, `${carrier} 需要是对象`);
  const field = (key: string): JsonData => {
    const child = data[key];
    if (child === undefined) return {};
    if (key === 'initialized_lorebooks' && Array.isArray(child) && child.every(book => typeof book === 'string')) {
      return Object.fromEntries(child.map(book => [book, []]));
    }
    if (child === null || typeof child !== 'object' || Array.isArray(child)) failure(name, line, `${carrier}.${key} 需要是对象`);
    return child;
  };
  return { ...data, stat_data: field('stat_data'), schema: field('schema'), initialized_lorebooks: field('initialized_lorebooks'), display_data: field('display_data'), delta_data: field('delta_data') };
}

/** Physical framing is separate from role/swipe interpretation. Source bytes are never rewritten. */
function document(name: string, bytes: Uint8Array, signal: AbortSignal): SourceLine[] {
  if (bytes.byteLength > 256 * 1024 * 1024) throw new Error('这个 JSONL 超过 256 MiB，请拆分后再导入');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { throw new Error('JSONL 不是有效的 UTF-8 文件'); }
  if (text.startsWith('\ufeff')) text = text.slice(1);
  const result: SourceLine[] = [];
  const lines = text.split(/\r\n|\r|\n/u);
  for (let index = 0; index < lines.length; index++) {
    signal.throwIfAborted();
    const source = lines[index]!;
    if (/^[\t ]*$/u.test(source)) continue;
    let value: unknown;
    try { value = JSON.parse(source) as unknown; }
    catch { failure(name, index + 1, '无法读取这一行 JSON'); }
    if (!object(value)) failure(name, index + 1, '每行需要一个 JSON 对象');
    result.push({ value, line: index + 1 });
  }
  if (!result.length) failure(name, 1, '没有可识别的聊天头');
  const header = result[0]!;
  if (header.value.is_user !== undefined || !['user_name', 'character_name', 'chat_metadata', 'create_date'].some(key => Object.hasOwn(header.value, key))) failure(name, header.line, '缺少标准 SillyTavern 聊天头');
  if (header.value.chat_metadata != null && !object(header.value.chat_metadata)) failure(name, header.line, 'chat_metadata 需要是对象');
  return result;
}

/** Mirrors the ST legacy UTC humanized timestamp spelling, alongside current ISO and Unix milliseconds. */
function timestamp(value: unknown): number | undefined {
  if (typeof value === 'number' || typeof value === 'string' && /^\d+$/u.test(value)) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 8.64e15 ? number : undefined;
  }
  if (typeof value !== 'string') return undefined;
  const legacy = /^(\d{4})-(\d{1,2})-(\d{1,2})\s?@(\d{1,2})h\s?(\d{1,2})m\s?(\d{1,2})s(?:\s?(\d{1,3})ms)?$/u.exec(value);
  if (legacy) {
    const [, year, month, day, hour, minute, second, milliseconds] = legacy;
    const result = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), Number((milliseconds ?? '').padStart(3, '0')));
    return Number.isFinite(result) ? result : undefined;
  }
  // Current ST stores ISO dates. Do not interpret an arbitrary short numeric date as a year.
  if (!/^\d{4}-\d{2}-\d{2}T/u.test(value)) return undefined;
  const result = Date.parse(value);
  return Number.isFinite(result) && result >= 0 ? result : undefined;
}

function sourceReply(text: string, extra: JsonObject, row: JsonObject): ImportedReply {
  const sourceError = extra.error ?? row.error;
  const error = typeof sourceError === 'string' ? sourceError : typeof record(sourceError).message === 'string' ? record(sourceError).message as string : undefined;
  const sourceStatus = extra.status ?? row.status;
  const failed = typeof sourceStatus === 'string' && sourceStatus.toLowerCase() === 'failed' || !!error;
  return { reply: text, reasoning: typeof extra.reasoning === 'string' ? extra.reasoning : '', status: failed ? 'failed' : text === '' ? 'empty' : 'complete', ...(error ? { error } : {}) };
}

function assistant(name: string, line: SourceLine): { replies: ImportedReply[]; selected: number } {
  const row = line.value, mes = row.mes as string;
  if (row.swipes !== undefined && (!Array.isArray(row.swipes) || row.swipes.some(value => typeof value !== 'string'))) failure(name, line.line, 'swipes 需要是文本数组');
  if (row.swipe_info !== undefined && !Array.isArray(row.swipe_info)) failure(name, line.line, 'swipe_info 需要是数组');
  if (row.variables != null && !Array.isArray(row.variables)) failure(name, line.line, 'variables 需要是数组');
  const swipes: string[] = Array.isArray(row.swipes) ? row.swipes : [];
  const infos: unknown[] = Array.isArray(row.swipe_info) ? row.swipe_info : [];
  const variables: unknown[] = Array.isArray(row.variables) ? row.variables : [];
  const reply = (text: string, extra: JsonObject, source: JsonObject, index: number): ImportedReply => {
    const mvu = mvuSnapshot(variables[index], name, line.line, `variables[${index}]`);
    return { ...sourceReply(text, extra, source), ...(mvu ? { mvu } : {}) };
  };
  const replies = swipes.map((text, index) => reply(text, record(record(infos[index]).extra), record(infos[index]), index));
  const index = typeof row.swipe_id === 'number' && Number.isInteger(row.swipe_id) && row.swipe_id >= 0 && row.swipe_id < replies.length ? row.swipe_id : 0;
  // mes is authoritative text for the original selected slot, even when appended as a new candidate.
  const active = reply(mes, record(row.extra), row, index);
  if (replies[index]?.reply === mes) {
    // ST mes/extra are authoritative for this selected occurrence, not stale swipe_info.
    replies[index] = active;
    return { replies, selected: index };
  }
  // A pristine greeting or unsynchronized edit can differ from its raw swipe. Keep both.
  replies.push(active);
  return { replies, selected: replies.length - 1 };
}

/** Standard one-to-one ST JSONL → the RP owner's shared history DTO. No macros, tools or model calls. */
export function previewSillyTavern(name: string, bytes: Uint8Array, existing: ImportSink['existing'], signal: AbortSignal): ExportPreview {
  signal.throwIfAborted();
  const rows = document(name, bytes, signal), header = rows[0]!.value, metadata = record(header.chat_metadata);
  if (header.is_group === true || metadata.group_id !== undefined) throw new Error('请选择一对一 SillyTavern JSONL 对话');
  const turns: ImportedTurn[] = [], characterNames = new Set<string>();
  let pending: ImportedTurn | undefined, messageCount = 0, candidateCount = 0, archivedMessageCount = 0, failedReplies = 0;
  let userName = person(header.user_name), characterName = person(header.character_name);
  let firstTime: unknown = header.create_date;
  const dates: number[] = [];
  const headerDate = timestamp(header.create_date);
  if (headerDate !== undefined) dates.push(headerDate);
  for (const line of rows.slice(1)) {
    signal.throwIfAborted();
    const row = line.value, extra = record(row.extra);
    if (row.is_system === true || extra.isSmallSys === true || extra.type === 'narrator') { archivedMessageCount++; continue; }
    if (typeof row.is_user !== 'boolean') failure(name, line.line, 'is_user 需要是布尔值');
    if (typeof row.mes !== 'string') failure(name, line.line, 'mes 需要是文本');
    if (row.is_system != null && typeof row.is_system !== 'boolean') failure(name, line.line, 'is_system 需要是布尔值');
    if (firstTime === undefined && row.send_date !== undefined) firstTime = row.send_date;
    const date = timestamp(row.send_date);
    if (date !== undefined) dates.push(date);
    messageCount++;
    if (row.is_user) {
      userName ??= person(row.name);
      pending = { input: row.mes, reply: '', reasoning: '', status: 'empty' };
      turns.push(pending);
      continue;
    }
    const speaker = person(row.name);
    if (speaker) characterNames.add(speaker);
    if (characterNames.size > 1) failure(name, line.line, '这份记录包含多位角色，请选择一对一对话');
    characterName ??= speaker;
    const { replies, selected } = assistant(name, line), active = replies[selected]!;
    candidateCount += replies.length;
    failedReplies += replies.filter(reply => reply.status !== 'complete').length;
    const turn = pending ?? { input: '', ...active };
    if (!pending) turns.push(turn);
    Object.assign(turn, active, { replies, selectedReplyIndex: selected });
    pending = undefined;
  }
  const terminal = turns.at(-1);
  if (terminal && !terminal.mvu) {
    const mvu = mvuSnapshot(metadata.variables, name, rows[0]!.line, 'chat_metadata.variables');
    if (mvu) {
      terminal.mvu = mvu;
      const selected = terminal.replies?.[terminal.selectedReplyIndex ?? 0];
      if (selected) selected.mvu = mvu;
    }
  }
  const file = basename(name), identity = typeof metadata.integrity === 'string' && metadata.integrity.trim()
    ? ['integrity', metadata.integrity]
    : ['legacy', file, userName ?? '', characterName ?? '', firstTime ?? null];
  const sourceId = `sillytavern-jsonl:${hash(JSON.stringify(identity))}`, fingerprint = hash(bytes);
  const matches = existing(sourceId), same = matches.find(row => row.fingerprint === fingerprint);
  const archiveNotes = [...(archivedMessageCount ? [`${archivedMessageCount} 条系统或事件消息`] : []), '聊天头与扩展字段'];
  const row: ConversationPreview = {
    kind: 'sillytavern-jsonl', sourceId, fingerprint, title: file.replace(/\.jsonl$/iu, '') || '接回的酒馆对话',
    createdAt: dates.length ? Math.min(...dates) : 0, updatedAt: dates.length ? Math.max(...dates) : 0,
    messageCount, candidateCount, archivedMessageCount, archiveNotes, omittedTurns: 0, failedReplies, turns,
    state: same ? 'same' : matches.length ? 'changed' : 'new', ...(same ? { existingId: same.id } : {}),
    ...(userName ? { userName } : {}), ...(characterName ? { characterName } : {}),
  };
  return { conversations: [row], failures: [] };
}
