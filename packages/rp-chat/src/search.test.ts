import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationStore } from './store.js';

const stores: ConversationStore[] = [];
const open = () => { const store = new ConversationStore(':memory:'); stores.push(store); return store; };
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
function seed(store: ConversationStore, title = '海边旧事') {
  const conversation = store.createConversation({ title });
  const snapshot = store.createSnapshot(conversation.id, { system: '不应搜索的隐藏设定', messages: [], bindings: [], options: {} });
  const add = (input: string, text: string, parentCandidateId?: string) => {
    const turn = store.createTurn(conversation.id, { input, parentCandidateId });
    const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
    const candidate = store.createCandidate(group.id, { kind: 'generated', text, status: 'complete' });
    return { turn, group, candidate };
  };
  return { conversation, snapshot, add };
}

describe('原文历史搜索', () => {
  it('在全部与当前对话中查玩家输入、旧分支、喜欢、手改和累计续写，查阅不改路线或请求事实', () => {
    const store = open(), first = seed(store), other = seed(store, '另一段约定');
    const root = first.add('玩家问约定', '旧分支约定');
    const edited = store.editCandidate(root.candidate.id, '手改守约');
    store.setFavorite(root.candidate.id, true);
    const continued = store.createCandidate(root.group.id, { kind: 'continuation', sourceCandidateId: edited.id, text: '天光', status: 'complete' });
    const continuedAgain = store.createCandidate(root.group.id, { kind: 'continuation', sourceCandidateId: continued.id, text: '海风', status: 'complete' });
    const oldBranch = first.add('旧分支玩家的约定', '旧分支后来', root.candidate.id);
    other.add('别处的约定', '另一个角色的约定');
    store.selectCandidate(continuedAgain.id);
    const before = store.exportData(first.conversation.id);

    expect(store.search({ query: '约定', conversationId: first.conversation.id }).items.map(hit => hit.role)).toEqual(['user', 'assistant', 'user']);
    expect(store.search({ query: '旧分支', conversationId: first.conversation.id }).items.map(hit => hit.turnId)).toEqual([oldBranch.turn.id, oldBranch.turn.id, root.turn.id]);
    expect(store.search({ query: '手改守约', conversationId: first.conversation.id }).items.map(hit => hit.candidateId)).toEqual([continuedAgain.id, continued.id, edited.id]);
    const boundary = store.search({ query: '守约天光海风', conversationId: first.conversation.id });
    expect(boundary).toMatchObject({ total: 1, items: [{ candidateId: continuedAgain.id, ordinal: 4, excerpt: '手改守约天光海风', role: 'assistant' }] });
    expect(store.search({ query: '约定' }).total).toBe(5);
    expect(store.search({ query: '隐藏设定' }).total).toBe(0);
    expect(store.searchPreview(boundary.items[0]!)).toMatchObject({ input: '玩家问约定', reply: '手改守约天光海风', status: 'complete', ordinal: 4 });
    expect(store.exportData(first.conversation.id)).toEqual(before);
    expect(store.getCandidate(continuedAgain.id).text).toBe('海风');
    expect(store.usageForTurn(root.turn.id)).toMatchObject({ requestCount: 0, unknownRequests: 0 });
  });

  it('按普通包含匹配中文、百分号、下划线、引号和SQL文本，不把报错或思考当正文', () => {
    const store = open(), data = seed(store);
    const target = data.add("字面100%_ ' OR 1=1 --", '跨过\u0000后半句');
    data.add('100普通', '不应命中');
    const attempt = store.createAttempt({ turnId: target.turn.id, candidateId: target.candidate.id, snapshotId: data.snapshot.id, config: { provider: 'local', model: 'test' }, kind: 'reply' });
    store.finishAttempt(attempt.id, { status: 'failed', error: { message: '只在报错里的搜词', status: 401 } });
    const imported = store.createCandidate(target.group.id, { kind: 'generated', imported: { reasoning: '只有思考的搜词', error: '只有来源错误的搜词', status: 'failed' }, status: 'failed' });
    expect(imported.text).toBe('');
    for (const query of ['%', '_', "' OR 1=1 --"]) expect(store.search({ query }).items.map(hit => hit.turnId)).toEqual([target.turn.id]);
    expect(store.search({ query: '后半句' }).items[0]?.candidateId).toBe(target.candidate.id);
    data.add('', 'Ä'.repeat(400) + 'ä真正命中');
    expect(store.search({ query: 'ä' }).items[0]?.excerpt).toContain('ä真正命中');
    for (const query of ['只在报错', '只有思考', '只有来源错误', '不存在" OR (']) expect(store.search({ query }).total).toBe(0);
  });

  it('先在SQL里分页，只返回命中周围片段，展开一条时才返回完整原文', () => {
    const store = open(), data = seed(store);
    const long = '前'.repeat(4000) + '中文针眼' + '后'.repeat(4000);
    const ids: string[] = [];
    store.transaction(() => { for (let i = 0; i < 120; i++) ids.push(data.add('', `${long}${i}`).candidate.id); });
    const parse = vi.spyOn(JSON, 'parse');
    try {
      const page = store.search({ query: '中文针眼', offset: 10, limit: 3 });
      expect(page.total).toBe(120);
      expect(page.items.map(hit => hit.candidateId)).toEqual([ids[109], ids[108], ids[107]]);
      expect(page.items.every(hit => hit.excerpt.includes('中文针眼') && hit.excerpt.length <= 200)).toBe(true);
      expect(page.items.every(hit => !('reply' in hit) && !('input' in hit) && !('text' in hit))).toBe(true);
      expect(parse.mock.calls.length).toBeLessThan(12);
      expect(store.searchPreview(page.items[0]!).reply).toBe(`${long}109`);
    } finally { parse.mockRestore(); }
    expect(store.search({ query: '中文针眼', offset: 500, limit: 3 })).toEqual({ total: 120, items: [] });
    expect(store.search({ query: '中文针眼', limit: 0 })).toEqual({ total: 120, items: [] });
  });

  it('玩家命中关联本轮首个候选，没候选时仍可读输入且不捏造继续目标', () => {
    const store = open(), data = seed(store);
    const root = data.add('玩家独有搜词', '第一条');
    store.createCandidate(root.group.id, { kind: 'generated', text: '第二条', status: 'streaming' });
    store.createTurn(data.conversation.id, { input: '玩家独有搜词没有回复' });
    const hits = store.search({ query: '玩家独有搜词' }).items;
    expect(hits).toHaveLength(2);
    expect(hits[0]).not.toHaveProperty('candidateId');
    expect(store.searchPreview(hits[0]!)).toMatchObject({ input: '玩家独有搜词没有回复' });
    expect(store.searchPreview(hits[0]!)).not.toHaveProperty('reply');
    expect(hits[1]).toMatchObject({ candidateId: root.candidate.id, ordinal: 1 });
    expect(store.searchPreview({ ...hits[1]!, conversationTitle: '伪造标题', ordinal: 900 })).toMatchObject({ conversationTitle: '海边旧事', reply: '第一条', ordinal: 1 });
    const elsewhere = seed(store, '别处').add('别处', '别处回复');
    expect(() => store.searchPreview({ ...hits[1]!, candidateId: elsewhere.candidate.id })).toThrow(/不属于/);
    expect(() => store.searchPreview({ ...hits[1]!, conversationId: elsewhere.turn.conversationId })).toThrow(/不属于/);
    expect(() => store.searchPreview({ ...hits[1]!, turnId: '不存在' })).toThrow();
  });

  it('空白不扫描全库，坏分页明确拒绝，未知对话不冒充没有命中', () => {
    const store = open(), data = seed(store);
    data.add('正常', '正常');
    for (const query of ['', '  \n\t']) expect(store.search({ query })).toEqual({ items: [], total: 0 });
    for (const input of [{ query: '正常', offset: -1 }, { query: '正常', offset: 0.5 }, { query: '正常', limit: -1 }, { query: '正常', limit: 1.5 }, { query: '正常', limit: 101 }]) expect(() => store.search(input)).toThrow(/分页/);
    expect(() => store.search({ query: '正常', conversationId: '不存在' })).toThrow();
  });
});
