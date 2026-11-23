import { afterEach, describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { MaterialsLibrary } from '../../rp-materials/src/store.js';
import { ConversationStore } from './store.js';
import { exportConversation, restoreConversation } from './backup.js';
import { ChatEngine, type LlmGateway } from './engine.js';
import type { ConversationData, MvuState, PromptInput } from './types.js';

const resources: { close(): void }[] = [], engines: ChatEngine[] = [];
afterEach(async () => {
  await Promise.all(engines.splice(0).map(engine => engine.dispose()));
  for (const item of resources.splice(0).reverse()) item.close();
});
function store(): ConversationStore { const value = new ConversationStore(':memory:'); resources.push(value); return value; }
function materials(): MaterialsLibrary { const value = new MaterialsLibrary(':memory:'); resources.push(value); return value; }
const state = (hp: number): MvuState => ({
  stat_data: { hp, facts: ['约定', null, false, 0] }, schema: { hp: { type: 'number', min: 0 } },
  initialized_lorebooks: { '世界书@1': true }, display_data: { hp: `${hp}/20` }, delta_data: { hp: -2 },
  extension: { candidateId: 'literal-source-id', nested: [null, { text: '原始扩展字段' }] },
});
const issues = [{ code: 'unchanged_path', message: '这条指令未改变变量', source: '<UpdateVariable>', offset: 3 }];
const template: PromptInput = { system: '', messages: [{ role: 'user', content: '模板独有<%= getvar("hp") %>' }, { role: 'assistant', content: '原始历史：我记得约定。' }] };
const prompt = { input: '现在HP=<%= getvar("hp") %>', memo: { content: '称呼和约定保持不变', locked: ['阿宁'] }, inputBudget: 10000, triggeredLore: ['世界书@1:约定'] };

function seed(source: ConversationStore) {
  const conversation = source.createConversation({ title: '原生变量剧情', settings: { mvuEnabled: true, mainRoute: { provider: 'local', model: 'model', inputBudget: 10000 } } });
  const turn = source.createTurn(conversation.id, { input: '原始输入不参与恢复计算' });
  const snapshot = source.createSnapshot(conversation.id, { system: '已经冻结的系统', messages: [{ role: 'user', content: '现在HP=8' }], bindings: [], options: {}, mvu: { before: state(10), read: state(8), issues, template, prompt } });
  const group = source.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
  const first = source.createCandidate(group.id, { kind: 'generated', text: '原话<UpdateVariable>_.add("hp", -2)</UpdateVariable>', status: 'complete', mvu: { state: state(6), issues, kind: 'computed' } });
  source.createCandidate(group.id, { kind: 'generated', text: '未选分支', status: 'complete', mvu: { state: state(12), issues: [], kind: 'imported' } });
  const edited = source.editCandidate(first.id, '手工改过正文，不重放变量更新');
  source.setCandidateMvu(edited.id, { state: state(15), issues, kind: 'manual', revisions: [{ state: state(6), at: 111 }, { state: state(13), at: 222 }] });
  source.createCandidate(group.id, { kind: 'continuation', sourceCandidateId: first.id, text: '继续的一句。', status: 'stopped', mvu: { state: state(5), issues: [], kind: 'computed' } });
  source.selectCandidate(edited.id);
  return { conversation, turn, snapshot, first, edited };
}
function wire(bytes: Uint8Array): { files: Record<string, Uint8Array>; data: ConversationData } {
  const files = unzipSync(bytes);
  return { files, data: JSON.parse(strFromU8(files['conversation.json']!)) as ConversationData };
}

describe('MVU state in offline conversation ZIP backups', () => {
  it.each(['direct', 'indirect'] as const)('continues after a real ZIP restore with remapped %s lore hits, updated macros and no new keyword trigger', async binding => {
    const source = store(), sourceMaterials = materials(), target = store(), targetMaterials = materials();
    const route = { provider: 'local', model: 'controlled', inputBudget: 16000 };
    const imported = sourceMaterials.import({ name: 'book.json', bytes: strToU8(JSON.stringify({ name: '恢复用世界书', entries: {
      '0': { uid: 0, comment: '[initvar]', disable: true, content: 'counter: 10' },
      '1': { uid: 1, key: ['计数=10'], position: 0, content: '原命中={{get_message_variable::stat_data.counter}}' },
      '2': { uid: 2, key: ['计数=11'], position: 0, content: '不得重新触发的世界书' },
    } })) });
    const card = sourceMaterials.import({ name: 'card.json', bytes: strToU8(JSON.stringify({ spec: 'chara_card_v3', spec_version: '3.0', data: {
      name: '阿岚', description: '角色记录={{get_message_variable::stat_data.counter}}',
    } })) });
    const bound = sourceMaterials.setBindings(card.id, { worldbooks: [{ id: imported.id, version: imported.currentVersion }], preset: null });
    const refs = binding === 'indirect' ? [{ id: card.id, version: bound.version }] : [{ id: card.id, version: card.currentVersion }, { id: imported.id, version: imported.currentVersion }];
    const conversation = source.createConversation({ title: '恢复后继续', bindings: refs, settings: { mainRoute: route } });
    const createEngine = (database: ConversationStore, library: MaterialsLibrary, calls: PromptInput[], amount: number) => {
      const gateway: LlmGateway = { async prepare(config) { return { config, async *stream(input) {
        calls.push(structuredClone(input));
        yield { type: 'text', text: `<UpdateVariable>_.add('counter', ${amount});</UpdateVariable>` };
        yield { type: 'finish', reason: 'stop' };
      } }; } };
      const engine = new ChatEngine(database, gateway, refs => refs.flatMap(ref => {
        const version = library.readVersion(ref);
        return [version, ...version.bindings.worldbooks.map(book => library.readVersion(book))];
      }));
      engines.push(engine); return engine;
    };
    const originalCalls: PromptInput[] = [], resumedCalls: PromptInput[] = [];
    const originalEngine = createEngine(source, sourceMaterials, originalCalls, 1);
    const resumedEngine = createEngine(target, targetMaterials, resumedCalls, 2);
    const first = await originalEngine.send(conversation.id, '计数={{get_message_variable::stat_data.counter}}');
    await originalEngine.waitForGroup(first.id);
    const candidate = source.listCandidates(first.turnId, { groupId: first.id }).items[0]!;
    const originalSnapshot = source.getSnapshot(first.snapshotId), originalInput = source.inputForSnapshot(first.snapshotId);
    const opaque = { materialId: imported.id, loreId: `${imported.id}:1` };
    source.setCandidateMvu(candidate.id, { ...candidate.mvu!, state: { ...candidate.mvu!.state, userReference: opaque } });
    expect(originalInput.system).toContain('原命中=10');
    expect(originalSnapshot.mvu?.prompt?.triggeredLore).toEqual([`${imported.id}:1`]);
    expect(originalInput.system).not.toContain('不得重新触发');
    expect(originalCalls).toHaveLength(1);

    const restored = restoreConversation(target, targetMaterials, exportConversation(source, sourceMaterials, conversation.id).bytes);
    const restoredCard = targetMaterials.readVersion(restored.bindings[0]!);
    const restoredBook = binding === 'indirect' ? restoredCard.bindings.worldbooks[0]! : restored.bindings[1]!;
    expect(restoredCard.id).not.toBe(card.id); expect(restoredBook.id).not.toBe(imported.id);
    const restoredCandidate = target.getCandidate(restored.currentCandidateId!);
    const restoredSnapshot = target.getSnapshot(target.getGroup(restoredCandidate.groupId).snapshotId);
    expect(restoredCandidate.mvu?.state.userReference).toEqual(opaque);
    expect(target.inputForSnapshot(restoredSnapshot.id)).toEqual(originalInput);
    expect(resumedCalls).toEqual([]);
    target.updateConversation(restored.id, { settings: { mainRoute: route } });
    const continued = await resumedEngine.continueCandidate(restoredCandidate.id);
    await resumedEngine.waitForGroup(continued.id);
    const resumedInput = target.inputForSnapshot(continued.snapshotId), resumedSnapshot = target.getSnapshot(continued.snapshotId);
    expect(resumedInput.system).toContain('原命中=11');
    expect(resumedInput.system).toContain('角色记录=11');
    expect(resumedInput.system).not.toContain('不得重新触发');
    expect(restoredSnapshot.mvu?.prompt?.triggeredLore).toEqual([`${restoredBook.id}:1`]);
    expect(resumedSnapshot.mvu?.prompt?.triggeredLore).toEqual([`${restoredBook.id}:1`]);
    expect(resumedSnapshot.mvu?.before.stat_data.counter).toBe(10);
    expect(resumedSnapshot.mvu?.read.stat_data.counter).toBe(11);
    expect(target.listCandidates(continued.turnId, { groupId: continued.id }).items[0]?.mvu?.state.stat_data.counter).toBe(13);
    expect(resumedCalls).toEqual([resumedInput]);
    expect(source.getSnapshot(first.snapshotId)).toEqual(originalSnapshot);
    expect(source.inputForSnapshot(first.snapshotId)).toEqual(originalInput);
    expect(target.getCandidate(restoredCandidate.id).mvu?.state.userReference).toEqual(opaque);
  });

  it('remaps only an exact material prefix in frozen lore metadata and leaves MVU user JSON unchanged', () => {
    const source = store(), target = store(), { conversation } = seed(source);
    const data = source.exportData(conversation.id), frame = data.snapshots[0]!.mvu!;
    data.snapshots[0]!.bindings = [{ id: 'asset', version: 1 }, { id: 'asset-extra', version: 1 }];
    const hits = ['asset:entry:asset', 'asset-extra:entry', 'asset-extra-suffix:entry', 'prefix-asset:entry', 'unknown:entry', 'asset'];
    frame.prompt = { ...prompt, input: '用户写的 asset:entry', triggeredLore: hits };
    frame.before.stat_data.reference = 'asset:entry';
    frame.read.extension = { materialId: 'asset', nested: ['asset:entry', { value: 'asset-extra:entry' }] };
    data.candidates[0]!.mvu!.state.extension = { materialId: 'asset', text: 'asset:entry' };
    const before = structuredClone(frame.before), read = structuredClone(frame.read);
    const candidateStates = data.candidates.map(candidate => structuredClone(candidate.mvu));
    const materialIds = new Map([['asset', 'restored'], ['asset-extra', 'restored-extra']]);
    const restored = target.importData(data, refs => refs.map(ref => ({ ...ref, id: materialIds.get(ref.id) ?? ref.id })), materialIds);
    const snapshot = target.exportData(restored.id).snapshots[0]!;
    expect(snapshot.mvu?.prompt).toEqual({ ...prompt, input: '用户写的 asset:entry', triggeredLore: [
      'restored:entry:asset', 'restored-extra:entry', 'asset-extra-suffix:entry', 'prefix-asset:entry', 'unknown:entry', 'asset',
    ] });
    expect(snapshot.mvu?.before).toEqual(before); expect(snapshot.mvu?.read).toEqual(read);
    expect(target.exportData(restored.id).candidates.map(candidate => candidate.mvu)).toEqual(candidateStates);
    expect(target.readInput(snapshot.mvu!.templateInputId)).toEqual(template);
    expect(frame.prompt.triggeredLore).toEqual(hits);
  });

  it('restores before/read state, all candidate states and manual history without replaying updates or remapping user JSON', () => {
    const source = store(), sourceMaterials = materials(), { conversation, turn, snapshot } = seed(source);
    const file = exportConversation(source, sourceMaterials, conversation.id), { data } = wire(file.bytes);
    expect(data.conversation.settings.mvuEnabled).toBe(true);
    expect(data.snapshots[0]?.mvu).toEqual({ before: state(10), read: state(8), templateInputId: snapshot.mvu!.templateInputId, issues, prompt });
    expect(data.candidates.map(candidate => candidate.mvu?.state.stat_data.hp)).toEqual([6, 12, 15, 5]);
    const target = store(), nextMaterials = materials(), restored = restoreConversation(target, nextMaterials, file.bytes);
    expect(restored.id).not.toBe(conversation.id);
    expect(restored.settings.mainRoute).toBeUndefined();
    expect(restored.settings.mvuEnabled).toBe(true);
    const restoredTurn = target.listTurns(restored.id)[0]!, candidates = target.listCandidates(restoredTurn.id).items;
    expect(restoredTurn.id).not.toBe(turn.id);
    expect(candidates.map(candidate => candidate.mvu?.state.stat_data.hp)).toEqual([6, 12, 15, 5]);
    expect(candidates[0]?.mvu?.state.extension).toEqual({ candidateId: 'literal-source-id', nested: [null, { text: '原始扩展字段' }] });
    expect(candidates[1]?.mvu?.kind).toBe('imported');
    expect(candidates[2]?.mvu).toEqual({ state: state(15), issues, kind: 'manual', revisions: [{ state: state(6), at: 111 }, { state: state(13), at: 222 }] });
    expect(candidates[2]?.sourceCandidateId).toBe(candidates[0]?.id);
    expect(candidates[3]?.sourceCandidateId).toBe(candidates[0]?.id);
    expect(restored.currentCandidateId).toBe(candidates[2]?.id);
    expect(candidates[0]?.text).toContain('_.add("hp", -2)');
    const restoredSnapshot = target.getSnapshot(target.getGroup(candidates[0]!.groupId).snapshotId);
    expect(restoredSnapshot.mvu).toEqual(snapshot.mvu);
    expect(target.readInput(restoredSnapshot.mvu!.templateInputId)).toEqual(template);
    expect(target.inputForSnapshot(restoredSnapshot.id)).toEqual({ system: '已经冻结的系统', messages: [{ role: 'user', content: '现在HP=8' }] });
    expect(target.usageForTurn(restoredTurn.id)).toMatchObject({ requestCount: 0, unknownRequests: 0 });
    expect(target.exportData(restored.id).attempts).toEqual([]);
    const reexported = wire(exportConversation(target, nextMaterials, restored.id).bytes).data;
    expect(reexported.snapshots[0]?.mvu).toEqual(data.snapshots[0]?.mvu);
    expect(reexported.candidates.map(candidate => candidate.mvu)).toEqual(data.candidates.map(candidate => candidate.mvu));
  });

  it('includes a template-only input and its prefix chain even when no actual request uses it', () => {
    const source = store(), sourceMaterials = materials(), { conversation, snapshot } = seed(source);
    const { data } = wire(exportConversation(source, sourceMaterials, conversation.id).bytes);
    expect(data.snapshots[0]?.mvu?.templateInputId).toBe(snapshot.mvu!.templateInputId);
    expect(data.inputs.some(input => input.id === snapshot.mvu!.templateInputId)).toBe(true);
    expect(data.messagePrefixes.map(prefix => prefix.content)).toContain('模板独有<%= getvar("hp") %>');
    expect(data.inputs).toHaveLength(2);
    const target = store(), restored = restoreConversation(target, materials(), zipSync({
      'manifest.json': strToU8('{"format":"tavern-kit.conversation","version":1}'),
      'conversation.json': strToU8(JSON.stringify(data)), 'materials.json': strToU8(JSON.stringify(sourceMaterials.exportBundle([]))),
    }));
    expect(target.readInput(target.exportData(restored.id).snapshots[0]!.mvu!.templateInputId)).toEqual(template);
  });

  it.each(['missing-reference', 'template-input-hash', 'template-prefix-hash'] as const)('rejects %s before restoring any conversation', variant => {
    const source = store(), sourceMaterials = materials(), { conversation, snapshot } = seed(source);
    const { files, data } = wire(exportConversation(source, sourceMaterials, conversation.id).bytes);
    // Keep a real template-only reference even against an implementation that strips the MVU block.
    data.snapshots[0]!.mvu = { before: state(10), read: state(8), issues, templateInputId: snapshot.mvu!.templateInputId, prompt };
    if (variant === 'missing-reference') data.snapshots[0]!.mvu!.templateInputId = 'missing-template-input';
    else if (variant === 'template-input-hash') data.inputs.find(input => input.id === snapshot.mvu!.templateInputId)!.system = '被改动的模板系统';
    else data.messagePrefixes.find(prefix => prefix.content === '模板独有<%= getvar("hp") %>')!.content = '被改动的模板历史';
    files['conversation.json'] = strToU8(JSON.stringify(data));
    const target = store();
    expect(() => restoreConversation(target, materials(), zipSync(files))).toThrow(/引用|指纹/);
    expect(target.listConversations()).toEqual([]);
  });

  const badMvu: { name: string; value: unknown }[] = [
    { name: 'non-object state', value: { state: [], issues: [], kind: 'computed' } },
    { name: 'missing required MVU object', value: { state: { stat_data: {}, schema: {}, initialized_lorebooks: {}, display_data: {} }, issues: [], kind: 'computed' } },
    { name: 'array schema field', value: { state: { ...state(1), schema: [] }, issues: [], kind: 'computed' } },
    { name: 'non-text issue', value: { state: state(1), issues: [{ code: 'bad', message: 2 }], kind: 'computed' } },
    { name: 'unknown provenance', value: { state: state(1), issues: [], kind: 'executed-again' } },
    { name: 'bad manual timestamp', value: { state: state(1), issues: [], kind: 'manual', revisions: [{ state: state(0), at: 'yesterday' }] } },
  ];
  it.each(badMvu)('rejects $name instead of silently dropping or normalizing it', ({ value }) => {
    const source = store(), sourceMaterials = materials(), { conversation } = seed(source);
    const { files } = wire(exportConversation(source, sourceMaterials, conversation.id).bytes);
    const data = JSON.parse(strFromU8(files['conversation.json']!)) as { candidates: { mvu?: unknown }[] };
    data.candidates[0]!.mvu = value;
    files['conversation.json'] = strToU8(JSON.stringify(data));
    const target = store();
    expect(() => restoreConversation(target, materials(), zipSync(files))).toThrow();
    expect(target.listConversations()).toEqual([]);
  });

  it.each(['before', 'read', 'prompt', 'enablement'] as const)('validates snapshot %s data before restoring', variant => {
    const source = store(), sourceMaterials = materials(), { conversation, snapshot } = seed(source);
    const { files } = wire(exportConversation(source, sourceMaterials, conversation.id).bytes);
    const data = JSON.parse(strFromU8(files['conversation.json']!)) as { conversation: { settings: { mvuEnabled?: unknown } }; snapshots: { mvu?: unknown }[] };
    const frame: Record<string, unknown> = { before: state(10), read: state(8), issues, templateInputId: snapshot.mvu!.templateInputId, prompt };
    if (variant === 'before') frame.before = { ...state(10), stat_data: null };
    else if (variant === 'read') frame.read = [];
    else if (variant === 'prompt') frame.prompt = { ...prompt, triggeredLore: 4 };
    else data.conversation.settings.mvuEnabled = 'false';
    data.snapshots[0]!.mvu = frame;
    files['conversation.json'] = strToU8(JSON.stringify(data));
    const target = store();
    expect(() => restoreConversation(target, materials(), zipSync(files))).toThrow();
    expect(target.listConversations()).toEqual([]);
  });

  it('keeps MVU enablement optional in old archives and preserves explicit false or true without manufacturing state', () => {
    const source = store(), sourceMaterials = materials(), target = store(), nextMaterials = materials();
    for (const enabled of [undefined, false, true]) {
      const conversation = source.createConversation({ title: '旧格式兼容', settings: enabled === undefined ? {} : { mvuEnabled: enabled } });
      source.createSnapshot(conversation.id, { system: '', messages: [], bindings: [], options: {} });
      const restored = restoreConversation(target, nextMaterials, exportConversation(source, sourceMaterials, conversation.id).bytes);
      expect(restored.settings.mvuEnabled).toBe(enabled);
      const data = target.exportData(restored.id);
      expect(data.snapshots[0]?.mvu).toBeUndefined();
      expect(data.inputs).toHaveLength(1);
      expect(data.candidates).toEqual([]);
    }
  });
});
