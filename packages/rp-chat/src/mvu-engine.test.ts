import { afterEach, describe, expect, it } from 'vitest';
import { decodeMaterial } from '../../rp-materials/src/codec.js';
import type { JsonValue, MaterialVersion } from '@tavern-kit/rp-materials/types';
import type { Route } from '@tavern-kit/rp-connections/types';
import { ChatEngine, type LlmGateway, type ReplyChunk } from './engine.js';
import { ConversationStore } from './store.js';
import type { CandidateGroup, MaterialRef, MvuState, PromptInput } from './types.js';

const primary: Route = { provider: 'relay', model: 'mvu-model', inputBudget: 16000 };
const stores: ConversationStore[] = [], engines: ChatEngine[] = [];
afterEach(async () => { await Promise.all(engines.splice(0).map(engine => engine.dispose())); for (const store of stores.splice(0)) store.close(); });
const text = (value: string): ReplyChunk => ({ type: 'text', text: value });
const finish = (reason = 'stop'): ReplyChunk => ({ type: 'finish', reason });
const add = (amount: number) => `<UpdateVariable>_.add('counter', ${amount});</UpdateVariable>`;
function material(id: string, raw: JsonValue): MaterialVersion {
  const value = decodeMaterial({ name: `${id}.json`, bytes: new TextEncoder().encode(JSON.stringify(raw)) });
  return { id, version: 1, originalId: value.contentHash, createdAt: '2026-11-20', raw: value.raw, projection: value.projection, capabilities: value.capabilities, bindings: { worldbooks: [], preset: null } };
}
const book = () => material('book', { name: '计数设定', entries: {
  '0': { uid: 0, comment: '[initvar] 默认值', disable: true, content: 'counter: 10\nitems: [1, 2]' },
  '1': { uid: 1, key: ['开始'], position: 0, content: '原命中={{get_message_variable::stat_data.counter}}' },
  '2': { uid: 2, key: ['只在续写中出现'], position: 0, content: '不应新命中的世界书' },
} });
const card = () => material('card', { spec: 'chara_card_v3', spec_version: '3.0', data: { name: '小满', description: '当前记录：{{get_message_variable::stat_data.counter}}', system_prompt: '原身份{{user}}' } });
function setup(handler: (input: PromptInput, signal: AbortSignal, index: number) => AsyncIterable<ReplyChunk>, versions = [book(), card()]) {
  const store = new ConversationStore(':memory:'); stores.push(store);
  const calls: PromptInput[] = [];
  const gateway: LlmGateway = { async prepare(config, signal) { return { config, stream(input) { calls.push(structuredClone(input)); return handler(input, signal, calls.length - 1); } }; } };
  const load = (refs: MaterialRef[]) => refs.map(ref => { const found = versions.find(version => version.id === ref.id && version.version === ref.version); if (!found) throw new Error('素材版本缺失'); return found; });
  const engine = new ChatEngine(store, gateway, load); engines.push(engine);
  const conversation = store.createConversation({ title: '原生变量', bindings: versions.map(({ id, version }) => ({ id, version })), settings: { mainRoute: primary, playerName: '阿宁' } });
  const candidates = (group: CandidateGroup) => store.listCandidates(group.turnId, { groupId: group.id }).items;
  return { engine, store, conversation, calls, versions, candidates };
}

describe('MVU 候选状态与冻结模型输入', () => {
  it('initvar 在解析前展开冻结的人物称呼，原始默认值与实际模型输入各自保留', async () => {
    const initial = material('initial', { name: '带称呼的默认值', entries: {
      '0': { uid: 0, comment: '[initvar]', disable: true, content: "owner: '{{user}}'\nscore: 10" },
    } });
    const character = material('identity', { spec: 'chara_card_v3', spec_version: '3.0', data: { name: '小满', description: '归属：{{get_message_variable::stat_data.owner}}' } });
    const original = structuredClone(initial.raw);
    const { engine, store, conversation, calls, candidates } = setup(async function* () { yield text('没有变量修改的回复'); yield finish(); }, [initial, character]);
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    const snapshot = store.getSnapshot(group.snapshotId);
    expect(snapshot.mvu?.before.stat_data).toEqual({ owner: '阿宁', score: 10 });
    expect(calls[0]!.system).toContain('归属：阿宁');
    expect(candidates(group)[0]?.mvu?.state.stat_data.owner).toBe('阿宁');
    expect(store.inputForSnapshot(group.snapshotId)).toEqual(calls[0]); expect(initial.raw).toEqual(original);
  });

  it('变量命令解析前按本次冻结身份与读取状态展开，续写仍读源 after 而从原 before 结算', async () => {
    const initial = material('initial', { name: '命令默认值', entries: {
      '0': { uid: 0, comment: '[initvar]', disable: true, content: 'owner: 初始主人\nscore: 10' },
    } });
    const character = material('identity', { spec: 'chara_card_v3', spec_version: '3.0', data: { name: '小满', description: '当前分数：{{get_message_variable::stat_data.score}}' } });
    const rules = material('command-view', [{ scriptName: '模型历史隐藏更新块', findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/g', replaceString: '', placement: [2], promptOnly: true }]);
    const firstBody = "<UpdateVariable>_.set('owner', '{{user}}'); _.set('score', {{get_message_variable::stat_data.score}}+1);</UpdateVariable>";
    const continuation = "<UpdateVariable>_.set('score', {{get_message_variable::stat_data.score}}+2);</UpdateVariable>";
    const { engine, store, conversation, calls, candidates } = setup(async function* (_input, _signal, index) {
      if (index === 0) store.updateConversation(conversation.id, { settings: { playerName: '不应混入的新名字' } });
      yield text(index === 0 ? firstBody : continuation); yield finish();
    }, [initial, character, rules]);
    const first = await engine.send(conversation.id, '开始'); await engine.waitForGroup(first.id);
    const source = candidates(first)[0]!, originalInput = store.inputForSnapshot(first.snapshotId);
    expect(source.mvu?.state.stat_data).toEqual({ owner: '阿宁', score: 11 });
    expect(source.mvu?.issues).toEqual([]); expect(source.text).toBe(firstBody);
    const continued = await engine.continueCandidate(source.id); await engine.waitForGroup(continued.id);
    const candidate = candidates(continued)[0]!, snapshot = store.getSnapshot(continued.snapshotId);
    expect(snapshot.mvu?.read.stat_data.score).toBe(11); expect(snapshot.mvu?.before.stat_data.score).toBe(10);
    expect(candidate.mvu?.state.stat_data).toEqual({ owner: '阿宁', score: 13 });
    expect(candidate.mvu?.issues).toEqual([]); expect(candidate.text).toBe(continuation);
    expect(calls[1]!.system).toContain('当前分数：11');
    expect(store.candidateText(candidate.id)).toBe(firstBody + continuation);
    expect(store.getCandidate(source.id).text).toBe(firstBody); expect(store.getTurn(first.turnId).input).toBe('开始');
    expect(store.inputForSnapshot(first.snapshotId)).toEqual(originalInput);
    expect(store.inputForSnapshot(continued.snapshotId)).toEqual(calls[1]);
  });

  it('禁用的 initvar 条目也自动初始化，完整回复从组基线结算且请求先保存', async () => {
    const { engine, store, conversation, calls, candidates } = setup(async function* (input) {
      const turn = store.listTurns(conversation.id).at(-1)!;
      const attempt = store.attemptsForTurn(turn.id).at(-1)!;
      expect(store.inputForSnapshot(attempt.snapshotId)).toEqual(input);
      yield text(add(1)); yield finish();
    });
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    const snapshot = store.getSnapshot(group.snapshotId), candidate = candidates(group)[0]!;
    expect(snapshot.mvu?.before.stat_data.counter).toBe(10); expect(snapshot.mvu?.read.stat_data.counter).toBe(10);
    expect(candidate.mvu?.state.stat_data.counter).toBe(11); expect(candidate.status).toBe('complete');
    expect(calls[0]!.system).toContain('当前记录：10'); expect(calls[0]!.system).toContain('原命中=10');
    expect(snapshot.mvu?.prompt?.triggeredLore).toEqual(['book:1']);
    expect(store.readInput(snapshot.mvu!.templateInputId)).toEqual({ system: '', messages: [] });
  });

  it('并发和同轮 roll 各自从同一 before 计算，选择不重放，后续读取真正父候选', async () => {
    const { engine, store, conversation, calls, candidates } = setup(async function* (_input, _signal, index) { yield text(add(index + 1)); yield finish(); });
    store.updateConversation(conversation.id, { settings: { parallel: true, parallelCount: 2 } });
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    const [a, b] = candidates(group);
    expect([a?.mvu?.state.stat_data.counter, b?.mvu?.state.stat_data.counter]).toEqual([11, 12]);
    expect(store.getConversation(conversation.id).currentCandidateId).toBeUndefined();
    const reroll = await engine.roll(group.turnId, true); await engine.waitForGroup(reroll.id);
    expect(reroll.snapshotId).toBe(group.snapshotId); expect(candidates(group)[2]?.mvu?.state.stat_data.counter).toBe(13);
    engine.select(a!.id); engine.select(b!.id); expect(calls).toHaveLength(3);
    store.updateConversation(conversation.id, { settings: { parallel: false } });
    const next = await engine.send(conversation.id, '后续'); await engine.waitForGroup(next.id);
    expect(store.getSnapshot(next.snapshotId).mvu?.before.stat_data.counter).toBe(12);
    expect(calls.at(-1)!.system).toContain('当前记录：12'); expect(store.getCandidate(a!.id).mvu?.state.stat_data.counter).toBe(11);
  });

  it('10→11→13 续写读取源 after，固定素材、身份、备忘和命中集合，但累计正文从原 before 结算', async () => {
    const { engine, store, conversation, calls, candidates, versions } = setup(async function* (_input, _signal, index) { yield text(index === 0 ? `只在续写中出现\n${add(1)}` : add(2)); yield finish(); });
    store.saveMemo(conversation.id, { content: '冻结备忘={{get_message_variable::stat_data.counter}}', locked: ['原约定'] });
    const first = await engine.send(conversation.id, '开始'); await engine.waitForGroup(first.id);
    const source = candidates(first)[0]!, originalInput = store.inputForSnapshot(first.snapshotId);
    versions.push({ ...versions[1]!, version: 2, projection: { ...versions[1]!.projection, character: { ...versions[1]!.projection.character!, description: '不应混入的新设定' } } });
    store.updateConversation(conversation.id, { bindings: [{ id: 'card', version: 2 }, { id: 'book', version: 1 }], settings: { playerName: '新名字' } });
    engine.editMemo(conversation.id, '不应混入的新备忘', []);
    const continued = await engine.continueCandidate(source.id); await engine.waitForGroup(continued.id);
    const candidate = candidates(continued)[0]!, snapshot = store.getSnapshot(continued.snapshotId);
    expect(source.mvu?.state.stat_data.counter).toBe(11); expect(candidate.mvu?.state.stat_data.counter).toBe(13);
    expect(snapshot.mvu?.before.stat_data.counter).toBe(10); expect(snapshot.mvu?.read.stat_data.counter).toBe(11);
    expect(calls[1]!.system).toContain('当前记录：11'); expect(calls[1]!.system).toContain('原命中=11');
    expect(calls[1]!.system).toContain('冻结备忘=11'); expect(calls[1]!.system).toContain('原身份阿宁');
    expect(JSON.stringify(calls[1])).not.toMatch(/不应混入|不应新命中的世界书|新名字/);
    expect(calls[1]!.messages.at(-1)).toEqual({ role: 'assistant', content: `只在续写中出现\n${add(1)}` });
    expect(store.inputForSnapshot(first.snapshotId)).toEqual(originalInput); expect(store.inputForSnapshot(continued.snapshotId)).toEqual(calls[1]);
    expect(store.readInput(snapshot.mvu!.templateInputId)).toEqual({ system: '', messages: [] });
    expect(candidate.text).toBe(add(2)); expect(store.candidateText(candidate.id)).toBe(`只在续写中出现\n${add(1)}${add(2)}`);
  });

  it.each(['error', 'aborted', 'max-tokens'])('结束原因为 %s 的部分正文不执行已经闭合的变量更新', async reason => {
    const { engine, store, conversation, candidates } = setup(async function* () { yield text(add(5)); yield finish(reason); });
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    expect(candidates(group)[0]?.mvu?.state.stat_data.counter).toBe(10);
    expect(candidates(group)[0]?.text).toBe(add(5)); expect(store.getSnapshot(group.snapshotId).mvu?.before.stat_data.counter).toBe(10);
  });

  it('主动停止在途流保留闭合更新正文与 before，成功续写才对完整正文结算', async () => {
    let started: () => void = () => {};
    const start = new Promise<void>(resolve => { started = resolve; });
    const { engine, store, conversation, candidates } = setup(async function* (_input, signal, index) {
      if (index === 0) {
        yield text(add(1)); started();
        await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true }));
        yield finish('aborted');
      } else { yield text(add(2)); yield finish(); }
    });
    const group = await engine.send(conversation.id, '开始'); await start;
    const source = candidates(group)[0]!; engine.stopCandidate(source.id); await engine.waitForGroup(group.id);
    expect(store.getCandidate(source.id)).toMatchObject({ status: 'stopped', text: add(1), mvu: { state: { stat_data: { counter: 10 } } } });
    const continued = await engine.continueCandidate(source.id); await engine.waitForGroup(continued.id);
    expect(candidates(continued)[0]?.mvu?.state.stat_data.counter).toBe(13);
    expect(store.getCandidate(source.id).mvu?.state.stat_data.counter).toBe(10);
  });

  it('错误命令留问题及正文而不把正常模型调用改为失败，手改复制状态且不解析改后的更新', async () => {
    const { engine, store, conversation, candidates, calls } = setup(async function* () { yield text(`${add(1)}<UpdateVariable>_.add('missing', 1); _.insert('items', 3);</UpdateVariable>`); yield finish(); });
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    const source = candidates(group)[0]!;
    expect(source.status).toBe('complete'); expect(source.mvu?.state.stat_data.counter).toBe(11);
    expect(source.mvu?.issues.map(issue => issue.code)).toEqual(['command_path_missing', 'command_schema']);
    expect(source.mvu?.state.stat_data.items).toEqual([1, 2]);
    const edited = engine.editCandidate(source.id, add(999));
    expect(edited.mvu?.state.stat_data.counter).toBe(11); expect(edited.mvu?.issues).toEqual(source.mvu?.issues); expect(calls).toHaveLength(1);
    expect(store.getCandidate(source.id).text).toContain(add(1));
  });

  it('摘要只展开读取，不结算摘要正文中的变量命令，实际输入与父快照保留', async () => {
    const { engine, store, conversation, calls, candidates } = setup(async function* (input) {
      yield text(input.system.startsWith('用自然中文整理') ? `整理结果${add(100)}` : add(1)); yield finish();
    });
    store.updateConversation(conversation.id, { settings: { mainRoute: { ...primary, inputBudget: 1200 }, controls: { maxTokens: 128 } } });
    let parent: string | undefined;
    for (let index = 0; index < 5; index++) {
      const turn = store.createTurn(conversation.id, { input: `记录={{get_message_variable::stat_data.counter}}${'问'.repeat(160)}`, parentCandidateId: parent });
      const snapshot = store.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
      const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 0 });
      const state: MvuState = { stat_data: { counter: 10 + index }, schema: {}, initialized_lorebooks: {}, display_data: {}, delta_data: {} };
      parent = store.createCandidate(group.id, { kind: 'generated', status: 'complete', text: `角色${'事'.repeat(160)}`, mvu: { state, issues: [], kind: 'imported' } }).id;
    }
    store.selectCandidate(parent!);
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    const summaries = calls.filter(input => input.system.startsWith('用自然中文整理'));
    expect(summaries.length).toBeGreaterThan(0); expect(summaries[0]!.messages[0]!.content).toContain('记录=14');
    expect(store.getCandidate(parent!).mvu?.state.stat_data.counter).toBe(14);
    expect(store.getSnapshot(group.snapshotId).mvu?.before.stat_data.counter).toBe(14);
    expect(candidates(group)[0]?.mvu?.state.stat_data.counter).toBe(15);
    expect(store.attemptsForTurn(group.turnId).filter(attempt => attempt.kind === 'summary').map(attempt => store.inputForSnapshot(attempt.snapshotId))).toEqual(summaries);
    expect(store.getTurn(store.getCandidate(parent!).turnId).input).toContain('{{get_message_variable::stat_data.counter}}');
  });

  it('父候选变量的明确修订使后续轮换回复建立新快照，原组仍保留旧 before', async () => {
    const { engine, store, conversation, candidates } = setup(async function* () { yield text(add(1)); yield finish(); });
    const first = await engine.send(conversation.id, '开始'); await engine.waitForGroup(first.id);
    const parent = candidates(first)[0]!;
    const second = await engine.send(conversation.id, '下一轮'); await engine.waitForGroup(second.id);
    const state = structuredClone(parent.mvu!.state); state.stat_data.counter = 50;
    store.setCandidateMvu(parent.id, { state, kind: 'manual', issues: [], revisions: [{ state: parent.mvu!.state, at: 1 }] });
    const reroll = await engine.roll(second.turnId); await engine.waitForGroup(reroll.id);
    expect(reroll.id).not.toBe(second.id); expect(store.getSnapshot(second.snapshotId).mvu?.before.stat_data.counter).toBe(11);
    expect(store.getSnapshot(reroll.snapshotId).mvu?.before.stat_data.counter).toBe(50); expect(candidates(reroll)[0]?.mvu?.state.stat_data.counter).toBe(51);
  });

  it('明确关闭时保留原始变量宏，不初始化或结算；没有声明的普通对话仍走原有输入', async () => {
    const { engine, store, conversation, candidates, calls } = setup(async function* () { yield text(add(1)); yield finish(); });
    store.updateConversation(conversation.id, { settings: { mvuEnabled: false } });
    const group = await engine.send(conversation.id, '开始'); await engine.waitForGroup(group.id);
    expect(store.getSnapshot(group.snapshotId).mvu).toBeUndefined(); expect(candidates(group)[0]?.mvu).toBeUndefined();
    expect(calls[0]!.system).toContain('{{get_message_variable::stat_data.counter}}');
  });
});
