import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationStore } from './store.js';
import { displayWithRules } from './prompt.js';

const stores: ConversationStore[] = [];
const open = () => { const store = new ConversationStore(':memory:'); stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

function seed(store: ConversationStore) {
  const conversation = store.createConversation({ title: '旧日约定' });
  const turn = store.createTurn(conversation.id, { input: '还记得我的称呼吗？' });
  const snapshot = store.createSnapshot(conversation.id, {
    system: '你是小满，称玩家为阿宁。',
    messages: [{ role: 'user', content: '还记得我的称呼吗？' }],
    bindings: [], options: {},
  });
  const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [{ provider: 'relay', model: '[薄甲]原样/model', inputBudget: 8000 }], settingsRevision: 1 });
  const candidate = store.createCandidate(group.id, { kind: 'generated', text: '当然记得，阿宁。', status: 'complete' });
  store.selectCandidate(candidate.id);
  return { conversation, turn, snapshot, group, candidate };
}

describe('剧情仓', () => {
  it('手改后分出新路线，原回复与其后续仍完整保留', () => {
    const store = open();
    const { conversation, turn, candidate } = seed(store);
    const next = store.createTurn(conversation.id, { parentCandidateId: candidate.id, input: '我们说好了什么？' });
    const edited = store.editCandidate(candidate.id, '当然记得，我的阿宁。');
    store.selectCandidate(edited.id);
    expect(store.getCandidate(candidate.id).text).toBe('当然记得，阿宁。');
    expect(store.getCandidate(edited.id).sourceCandidateId).toBe(candidate.id);
    expect(store.getTurn(next.id).parentCandidateId).toBe(candidate.id);
    expect(store.route(conversation.id).map(row => row.candidate.text)).toEqual(['当然记得，我的阿宁。']);
    expect(store.listCandidates(turn.id).total).toBe(2);
    expect(store.usageForTurn(turn.id).requestCount).toBe(0);
  });

  it('地图摘要沿当前分支预览实际祖先和叶候选，旁支与未选路线固定取第一条', () => {
    const store = open(), { conversation, turn, snapshot, group, candidate } = seed(store);
    const second = store.createCandidate(group.id, { kind: 'generated', text: '同轮第二条回复', status: 'complete' });
    const branch = (parentCandidateId: string, name: string) => {
      const turn = store.createTurn(conversation.id, { parentCandidateId, input: name });
      const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
      const first = store.createCandidate(group.id, { kind: 'generated', text: `${name}第一条`, status: 'complete' });
      const second = store.createCandidate(group.id, { kind: 'generated', text: `${name}第二条`, status: 'complete' });
      return { turn, first, second };
    };
    const left = branch(candidate.id, '左侧后续'), right = branch(second.id, '右侧后续');
    const empty = store.createTurn(conversation.id, { parentCandidateId: second.id, input: '还没生成的分岔' });
    const other = seed(store);
    store.selectCandidate(right.second.id);
    const before = store.exportData(conversation.id);
    expect(store.turnSummaries(conversation.id)).toEqual([
      { id: turn.id, parentTurnId: undefined, input: '还记得我的称呼吗？', candidates: 2, previewCandidateId: second.id },
      { id: left.turn.id, parentTurnId: turn.id, input: '左侧后续', candidates: 2, previewCandidateId: left.first.id },
      { id: right.turn.id, parentTurnId: turn.id, input: '右侧后续', candidates: 2, previewCandidateId: right.second.id },
      { id: empty.id, parentTurnId: turn.id, input: '还没生成的分岔', candidates: 0, previewCandidateId: undefined },
    ]);
    expect(store.exportData(conversation.id)).toEqual(before);
    store.selectCandidate(left.second.id);
    expect(store.turnSummaries(conversation.id).map(row => row.previewCandidateId)).toEqual([
      candidate.id, left.second.id, right.first.id, undefined,
    ]);
    store.selectCandidate(second.id);
    expect(store.turnSummaries(conversation.id).map(row => row.previewCandidateId)).toEqual([
      second.id, left.first.id, right.first.id, undefined,
    ]);
    expect(store.turnSummaries(conversation.id).map(row => row.previewCandidateId)).toEqual([
      second.id, left.first.id, right.first.id, undefined,
    ]);
    expect(store.turnSummaries(other.conversation.id).map(row => row.previewCandidateId)).toEqual([other.candidate.id]);
    expect(store.usageForTurn(turn.id).requestCount).toBe(0);
    const untouched = store.createConversation({ title: '未选择的路线' });
    const unselectedTurn = store.createTurn(untouched.id, { input: '还未选择回复' });
    const unselectedSnapshot = store.createSnapshot(untouched.id, { system: '', messages: [], bindings: [], options: {} });
    const unselectedGroup = store.createGroup(unselectedTurn.id, { snapshotId: unselectedSnapshot.id, routes: [], settingsRevision: 1 });
    const first = store.createCandidate(unselectedGroup.id, { kind: 'generated', text: '第一条', status: 'complete' });
    store.createCandidate(unselectedGroup.id, { kind: 'generated', text: '第二条', status: 'complete' });
    expect(store.turnSummaries(untouched.id)[0]?.previewCandidateId).toBe(first.id);
  });

  it('同组一千条候选共享准确输入，分页与喜欢筛选不读取整段历史', () => {
    const store = open();
    const { turn, group, snapshot } = seed(store);
    for (let i = 1; i < 1000; i++) store.createCandidate(group.id, { kind: 'generated', text: `候选 ${i}`, status: 'complete' });
    const page = store.listCandidates(turn.id, { offset: 990, limit: 10 });
    store.setFavorite(page.items[3]!.id, true);
    expect(page.total).toBe(1000);
    expect(page.items.map(c => c.text)).toEqual(Array.from({ length: 10 }, (_, i) => `候选 ${i + 990}`));
    expect(store.listCandidates(turn.id, { favoritesOnly: true }).items.map(c => c.text)).toEqual(['候选 993']);
    expect(store.storageCounts()).toMatchObject({ snapshots: 1, inputs: 1, messagePrefixes: 1 });
    expect(store.inputForSnapshot(snapshot.id)).toEqual({ system: '你是小满，称玩家为阿宁。', messages: [{ role: 'user', content: '还记得我的称呼吗？' }] });
  });

  it('备忘只用于包含来源节点的剧情，另一候选不能带入关系', () => {
    const store = open();
    const { conversation, group, candidate } = seed(store);
    store.saveMemo(conversation.id, { basedOnCandidateId: candidate.id, content: '两人已经约定明天去海边。', locked: ['称呼：阿宁'] });
    const alternative = store.createCandidate(group.id, { kind: 'generated', text: '我们还是第一次见面。', status: 'complete' });
    store.selectCandidate(alternative.id);
    expect(store.applicableMemo(conversation.id)).toBeUndefined();
    store.selectCandidate(candidate.id);
    expect(store.applicableMemo(conversation.id)?.content).toContain('明天去海边');
  });

  it('超过一千条旧候选仍只读取当前会话所有活跃请求，不受最近回合限制', () => {
    const store = open();
    const { conversation, group, candidate } = seed(store);
    store.transaction(() => {
      for (let i = 0; i < 1100; i++) store.createCandidate(group.id, { kind: 'generated', text: `已完成 ${i}`, status: 'complete' });
    });
    const pending = store.createCandidate(group.id, { kind: 'generated' });
    const streaming = store.createCandidate(group.id, { kind: 'generated' });
    store.appendCandidateDelta(streaming.id, '正在写');
    store.createCandidate(group.id, { kind: 'generated', status: 'failed' });
    store.createCandidate(group.id, { kind: 'generated', status: 'stopped' });
    for (let i = 0; i < 4; i++) {
      const turn = store.createTurn(conversation.id, { input: `新的轮次 ${i}`, parentCandidateId: candidate.id });
      store.createGroup(turn.id, { snapshotId: group.snapshotId, routes: group.routes, settingsRevision: 1 });
    }
    const other = seed(store);
    store.createCandidate(other.group.id, { kind: 'generated' });
    const parse = vi.spyOn(JSON, 'parse');
    try {
      const active = store.pendingCandidates(conversation.id);
      expect(active.map(row => ({ id: row.id, status: row.status, text: row.text }))).toEqual([
        { id: pending.id, status: 'pending', text: '' },
        { id: streaming.id, status: 'streaming', text: '正在写' },
      ]);
      expect(parse.mock.calls.length).toBeLessThan(8);
    } finally { parse.mockRestore(); }
    store.setCandidateStatus(pending.id, 'stopped');
    expect(store.pendingCandidates(conversation.id).map(row => row.id)).toEqual([streaming.id]);
  });

  it('两千轮选中祖先链在SQL分页，只反序列化本页并保持页内从旧到新', () => {
    const store = open();
    const conversation = store.createConversation({ title: '很长的约定' });
    const snapshot = store.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
    const path: string[] = [];
    store.transaction(() => {
      for (let i = 0; i < 2200; i++) {
        const turn = store.createTurn(conversation.id, { input: `玩家 ${i}`, parentCandidateId: path.at(-1) });
        const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
        path.push(store.createCandidate(group.id, { kind: 'generated', text: `正文 ${i}`, status: 'complete' }).id);
      }
    });
    const branchTurn = store.createTurn(conversation.id, { input: '未选的岔路', parentCandidateId: path[100]! });
    const branchGroup = store.createGroup(branchTurn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
    const branch = store.createCandidate(branchGroup.id, { kind: 'generated', text: '岔路正文', status: 'complete' });
    store.selectCandidate(path.at(-1)!);
    const parse = vi.spyOn(JSON, 'parse');
    try {
      const summaries = store.turnSummaries(conversation.id);
      expect(summaries).toHaveLength(2201);
      expect(summaries[0]?.previewCandidateId).toBe(path[0]);
      expect(summaries[2199]?.previewCandidateId).toBe(path[2199]);
      expect(summaries.at(-1)?.previewCandidateId).toBe(branch.id);
      expect(parse.mock.calls.length).toBeLessThan(8);
      parse.mockClear();
      const page = store.routePage(conversation.id, 30, 7);
      expect(page.total).toBe(2200);
      expect(page.items.map(row => row.turn.input)).toEqual(['玩家 2163', '玩家 2164', '玩家 2165', '玩家 2166', '玩家 2167', '玩家 2168', '玩家 2169']);
      expect(page.items.map(row => row.candidate.text)).toEqual(['正文 2163', '正文 2164', '正文 2165', '正文 2166', '正文 2167', '正文 2168', '正文 2169']);
      expect(page.items.map(row => row.depth)).toEqual([72, 70, 68, 66, 64, 62, 60]);
      expect(parse.mock.calls.length).toBeLessThan(30);
      parse.mockClear();
      expect(store.candidateDisplayDepth(path[100]!)).toBe(4198);
      expect(store.candidateDisplayDepth(branch.id)).toBe(0);
      expect(parse.mock.calls.length).toBeLessThan(8);
    } finally { parse.mockRestore(); }
    const latest = store.routePage(conversation.id);
    expect(latest.items).toHaveLength(30);
    expect(latest.items[0]!.turn.input).toBe('玩家 2170');
    expect(latest.items.at(-1)!.turn.input).toBe('玩家 2199');
    expect(latest.items[0]!.depth).toBe(58);
    expect(latest.items.at(-1)!.depth).toBe(0);
    expect(store.routePage(conversation.id, 3000, 7)).toEqual({ total: 2200, items: [] });
    store.selectCandidate(branch.id);
    const selected = store.routePage(conversation.id, 0, 3);
    expect(selected.total).toBe(102);
    expect(selected.items.map(row => row.turn.input)).toEqual(['玩家 99', '玩家 100', '未选的岔路']);
    expect(selected.items.map(row => row.depth)).toEqual([4, 2, 0]);
    expect(store.candidateDisplayDepth(path[100]!)).toBe(2);
    expect(store.candidateDisplayDepth(path.at(-1)!)).toBe(0);
  });

  it('显示深度按真实消息数计算，空输入开场和中间空输入不制造玩家消息，旧页保留全路线距离', () => {
    const store = open();
    const conversation = store.createConversation({ title: '从第一句开始' });
    const snapshot = store.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
    const add = (input: string, text: string, parentCandidateId?: string) => {
      const turn = store.createTurn(conversation.id, { input, parentCandidateId });
      const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
      const candidate = store.createCandidate(group.id, { kind: 'generated', text, status: 'complete' });
      return { turn, group, candidate };
    };
    const greeting = add('', '欢迎回来。');
    const normal = add('还记得我吗？', '记得。', greeting.candidate.id);
    const edited = store.editCandidate(normal.candidate.id, '当然记得。');
    const continuation = store.createCandidate(normal.group.id, { kind: 'continuation', sourceCandidateId: edited.id, text: '一直在等你。', status: 'complete' });
    const emptyInput = add('', '你没有说话，我也懂。', continuation.id);
    const latest = add('那我们走吧。', '好。', emptyInput.candidate.id);
    const branch = add('未选择的另一段', '另一段海边。', greeting.candidate.id);
    store.selectCandidate(latest.candidate.id);

    const page = store.routePage(conversation.id);
    expect(page.items.map(row => ({ input: row.turn.input, text: row.candidate.text, depth: row.depth }))).toEqual([
      { input: '', text: '欢迎回来。', depth: 5 },
      { input: '还记得我吗？', text: '当然记得。一直在等你。', depth: 3 },
      { input: '', text: '你没有说话，我也懂。', depth: 2 },
      { input: '那我们走吧。', text: '好。', depth: 0 },
    ]);
    expect(store.routePage(conversation.id, 2, 1).items.map(row => ({ id: row.candidate.id, depth: row.depth }))).toEqual([{ id: continuation.id, depth: 3 }]);
    expect(store.routePage(conversation.id, 3, 1).items.map(row => ({ id: row.candidate.id, depth: row.depth }))).toEqual([{ id: greeting.candidate.id, depth: 5 }]);
    for (const candidate of [normal.candidate, edited, continuation]) expect(store.candidateDisplayDepth(candidate.id)).toBe(3);
    expect(store.candidateDisplayDepth(greeting.candidate.id)).toBe(5);
    expect(store.candidateDisplayDepth(emptyInput.candidate.id)).toBe(2);
    expect(store.candidateDisplayDepth(latest.candidate.id)).toBe(0);
    expect(store.candidateDisplayDepth(branch.candidate.id)).toBe(0);
    expect(store.getConversation(conversation.id).currentCandidateId).toBe(latest.candidate.id);

    store.selectCandidate(branch.candidate.id);
    expect(store.routePage(conversation.id).items.map(row => row.depth)).toEqual([2, 0]);
    expect(store.candidateDisplayDepth(greeting.candidate.id)).toBe(2);
    for (const candidate of [normal.candidate, edited, continuation, emptyInput.candidate, latest.candidate]) expect(store.candidateDisplayDepth(candidate.id)).toBe(0);
    expect(store.candidateDisplayDepth(branch.candidate.id)).toBe(0);
    expect(store.usageForTurn(normal.turn.id).requestCount).toBe(0);
  });

  it('失败空回复不占显示深度，首句的三层显示规则实际命中且原文不变', () => {
    const store = open(), conversation = store.createConversation({ title: '空回复之后' });
    const snapshot = store.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
    let parentCandidateId: string | undefined;
    for (const row of [{ input: '', reply: '旧角色原词' }, { input: '未得到回答的问题', reply: '' }, { input: '最新问题', reply: '最新回答' }]) {
      const turn = store.createTurn(conversation.id, { input: row.input, parentCandidateId });
      const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 0 });
      parentCandidateId = store.createCandidate(group.id, { kind: 'generated', text: row.reply, status: row.reply === '' ? 'failed' : 'complete' }).id;
    }
    store.selectCandidate(parentCandidateId!);
    const page = store.routePage(conversation.id), first = page.items[0]!;
    const rendered = displayWithRules(first.candidate.text, [{ id: 'depth-three', name: '实际消息距离', findRegex: '/旧角色原词/g', replaceString: '三层之前的角色正文', trimStrings: [], placements: ['output'], displayOnly: true, promptOnly: false, disabled: false, runOnEdit: true, minDepth: 3, maxDepth: 3, substituteRegex: 0, sourcePath: 'regex.0' }], 'output', { char: '角色', user: '我' }, first.depth);
    expect(rendered).toBe('三层之前的角色正文');
    expect(page.items.map(row => row.depth)).toEqual([3, 2, 0]);
    expect(store.routePage(conversation.id, 2, 1).items.map(row => row.depth)).toEqual([3]);
    expect(store.candidateDisplayDepth(first.candidate.id)).toBe(3);
    expect(store.getCandidate(first.candidate.id).text).toBe('旧角色原词');
    expect(store.getTurn(page.items[1]!.turn.id).input).toBe('未得到回答的问题');
    expect(store.getCandidate(page.items[1]!.candidate.id)).toMatchObject({ text: '', status: 'failed' });
  });

  it('连续空侧与空增量续写按真实正文计数，空白输入和空白回复各保留一条', () => {
    const store = open(), conversation = store.createConversation({ title: '连续空侧' });
    const snapshot = store.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
    const add = (input: string, reply: string, parentCandidateId?: string) => {
      const turn = store.createTurn(conversation.id, { input, parentCandidateId });
      const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 0 });
      const candidate = store.createCandidate(group.id, { kind: 'generated', text: reply, status: reply === '' ? 'failed' : 'complete' });
      return { turn, group, candidate };
    };
    const greeting = add('', '首句'), inputOnly = add('未得到回答的问题', '', greeting.candidate.id);
    const empty = add('', '', inputOnly.candidate.id), inherited = add('', '保留的角色正文', empty.candidate.id);
    const firstContinuation = store.createCandidate(inherited.group.id, { kind: 'continuation', sourceCandidateId: inherited.candidate.id, text: '', status: 'stopped' });
    const continuation = store.createCandidate(inherited.group.id, { kind: 'continuation', sourceCandidateId: firstContinuation.id, text: '', status: 'failed' });
    const whitespace = add(' ', ' ', continuation.id), latest = add('最新问题', '最新回答', whitespace.candidate.id);
    store.selectCandidate(latest.candidate.id);
    const page = store.routePage(conversation.id);
    expect(page.items.map(row => row.depth)).toEqual([6, 5, 5, 4, 2, 0]);
    expect(page.items.map(row => row.candidate.text)).toEqual(['首句', '', '', '保留的角色正文', ' ', '最新回答']);
    expect(store.routePage(conversation.id, 2, 2).items.map(row => ({ id: row.candidate.id, depth: row.depth }))).toEqual([
      { id: empty.candidate.id, depth: 5 }, { id: continuation.id, depth: 4 },
    ]);
    for (const candidate of [inherited.candidate, firstContinuation, continuation]) expect(store.candidateDisplayDepth(candidate.id)).toBe(4);
    expect(store.getCandidate(continuation.id).text).toBe('');
    expect(store.getTurn(empty.turn.id).input).toBe('');
    expect(store.usageForTurn(inherited.turn.id).requestCount).toBe(0);
  });

  it('空增量只沿续写来源找有效正文，手改为空后不能借用更早原稿占一条消息', () => {
    const store = open(), { conversation, group, candidate } = seed(store);
    const turn = store.createTurn(conversation.id, { input: '', parentCandidateId: candidate.id });
    const later = store.createGroup(turn.id, { snapshotId: group.snapshotId, routes: [], settingsRevision: 0 });
    const original = store.createCandidate(later.id, { kind: 'generated', text: '有效的原稿', status: 'complete' });
    const continuation = store.createCandidate(later.id, { kind: 'continuation', sourceCandidateId: original.id, text: '', status: 'stopped' });
    const blankEdit = store.editCandidate(continuation.id, '');
    const emptyContinuation = store.createCandidate(later.id, { kind: 'continuation', sourceCandidateId: blankEdit.id, text: '', status: 'failed' });
    store.selectCandidate(continuation.id);
    expect(store.routePage(conversation.id).items.map(row => row.depth)).toEqual([1, 0]);
    expect(store.candidateDisplayDepth(candidate.id)).toBe(1);
    store.selectCandidate(emptyContinuation.id);
    expect(store.routePage(conversation.id).items.map(row => ({ text: row.candidate.text, depth: row.depth }))).toEqual([
      { text: '当然记得，阿宁。', depth: 0 }, { text: '', depth: 0 },
    ]);
    expect(store.candidateDisplayDepth(candidate.id)).toBe(0);
    expect(store.getCandidate(original.id).text).toBe('有效的原稿');
  });

  it('尚未选中路线时预览深度为零，只排除精确空输入而不丢弃空白玩家消息', () => {
    const store = open();
    const conversation = store.createConversation({ title: '安静的一刻' });
    const snapshot = store.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
    const path: string[] = [];
    for (const input of ['', ' ', '']) {
      const turn = store.createTurn(conversation.id, { input, parentCandidateId: path.at(-1) });
      const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
      path.push(store.createCandidate(group.id, { kind: 'generated', text: '真实角色回复', status: 'complete' }).id);
    }
    expect(store.candidateDisplayDepth(path[0]!)).toBe(0);
    store.selectCandidate(path.at(-1)!);
    expect(store.routePage(conversation.id).items.map(row => row.depth)).toEqual([3, 1, 0]);
    expect(path.map(candidateId => store.candidateDisplayDepth(candidateId))).toEqual([3, 1, 0]);
    expect(() => store.candidateDisplayDepth('missing-candidate')).toThrow('找不到这条记录');
  });

  it('分页展开本页续写原文，手改只取完整手改稿，空路线仍可查询', () => {
    const store = open();
    const { conversation, group, candidate } = seed(store);
    const continuation = store.createCandidate(group.id, { kind: 'continuation', sourceCandidateId: candidate.id, text: '我们继续。', status: 'complete' });
    store.selectCandidate(continuation.id);
    expect(store.routePage(conversation.id).items[0]!.candidate.text).toBe('当然记得，阿宁。我们继续。');
    const edited = store.editCandidate(continuation.id, '手改后的整段');
    store.selectCandidate(edited.id);
    expect(store.routePage(conversation.id).items[0]!.candidate.text).toBe('手改后的整段');
    const empty = store.createConversation({ title: '还没开始' });
    expect(store.routePage(empty.id)).toEqual({ total: 0, items: [] });
    expect(store.pendingCandidates(empty.id)).toEqual([]);
    expect(store.routePage(conversation.id, 0, 0)).toEqual({ total: 1, items: [] });
    for (const [offset, limit] of [[-1, 30], [0, -1], [0.5, 30], [0, Infinity]]) {
      expect(() => store.routePage(conversation.id, offset, limit)).toThrow();
    }
  });

  it('真实请求用量只记一次，手改与派生引用不重复计费，未返回保持未知', () => {
    const store = open();
    const { turn, group, candidate, snapshot } = seed(store);
    const first = store.createAttempt({ turnId: turn.id, candidateId: candidate.id, snapshotId: snapshot.id, kind: 'reply', config: { provider: 'relay', model: '[薄甲]原样/model' } });
    store.finishAttempt(first.id, { status: 'complete', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 8, cachedInputTokens: 10 } });
    store.editCandidate(candidate.id, '手改的版本');
    const second = store.createCandidate(group.id, { kind: 'generated' });
    const unknown = store.createAttempt({ turnId: turn.id, candidateId: second.id, snapshotId: snapshot.id, kind: 'reply', config: { provider: 'relay', model: '[薄甲]原样/model' } });
    store.finishAttempt(unknown.id, { status: 'failed', finishReason: 'error' });
    expect(store.usageForTurn(turn.id)).toEqual({ requestCount: 2, knownRequestCount: 1, inputTokens: 20, outputTokens: 8, cachedInputTokens: 10, unknownRequests: 1 });
  });
});
