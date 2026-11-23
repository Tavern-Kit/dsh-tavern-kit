import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConversationStore } from './store.js';
import type { Candidate, PromptInput } from './types.js';
import type { MvuIssue, MvuState } from './mvu/types.js';

const state = (hp: number): MvuState => ({
  stat_data: { hp, bag: ['贝壳', null, { borrowed: false }] },
  schema: { type: 'object', properties: { hp: { type: 'number' } } },
  initialized_lorebooks: { 'book@1': true },
  display_data: { hp: `${hp}/10` },
  delta_data: { hp: -1 },
  vendor_extension: { values: [null, false, 0, 'Ω', { source: 'literal-source-id' }] },
});
const issues: MvuIssue[] = [{ code: 'invalid_path', message: '路径不存在', source: '回复中的更新块', offset: 12 }];
const template: PromptInput = { system: '', messages: [
  { role: 'user', content: '还记得约定吗？' }, { role: 'assistant', content: '一起看海。' },
] };
const prompt = { input: 'HP=<%= getvar("hp") %>', memo: { content: '约好一起看海', locked: ['称呼阿宁'] }, inputBudget: 8000, triggeredLore: ['book@1:entry2'] };
const resolved: PromptInput = { system: '称呼：阿宁', messages: [
  { role: 'user', content: '还记得约定吗？' }, { role: 'assistant', content: '一起看海。' }, { role: 'user', content: 'HP=4' },
] };

function seed(store: ConversationStore) {
  const conversation = store.createConversation({ title: '有变量的剧情', settings: { mvuEnabled: true } });
  const turn = store.createTurn(conversation.id, { input: '原始输入不改写' });
  const snapshot = store.createSnapshot(conversation.id, { ...resolved, bindings: [], options: {}, mvu: { before: state(5), read: state(4), issues, template, prompt } });
  const group = store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [], settingsRevision: 1 });
  return { conversation, turn, snapshot, group };
}

describe('MVU snapshots in the real SQLite story store', () => {
  it('freezes before/read state and interns template plus resolved input without copying common message prefixes', () => {
    const store = new ConversationStore(':memory:');
    try {
      const { conversation, snapshot } = seed(store);
      const saved = store.getSnapshot(snapshot.id);
      expect(saved.mvu).toMatchObject({ before: { stat_data: { hp: 5 } }, read: { stat_data: { hp: 4 } }, issues, prompt });
      expect(saved.mvu?.templateInputId).not.toBe(saved.inputId);
      expect(store.inputForSnapshot(snapshot.id)).toEqual(resolved);
      expect(store.readInput(saved.mvu!.templateInputId)).toEqual(template);
      const again = store.createSnapshot(conversation.id, { ...resolved, bindings: [], options: {}, mvu: { before: state(5), read: state(4), issues, template, prompt } });
      expect(again.mvu?.templateInputId).toBe(saved.mvu!.templateInputId);
      expect(store.storageCounts()).toEqual({ snapshots: 2, inputs: 2, messagePrefixes: 3 });
      const other = store.createConversation({ title: '不属于导出的输入' });
      store.createSnapshot(other.id, { system: 'unrelated', messages: [], bindings: [], options: {} });
      const exported = store.exportData(conversation.id);
      expect(new Set(exported.inputs.map(input => input.id))).toEqual(new Set([saved.inputId, saved.mvu!.templateInputId]));
      expect(exported.messagePrefixes).toHaveLength(3);
      expect(exported.inputs.some(input => input.system === 'unrelated')).toBe(false);
    } finally { store.close(); }
  });

  it('keeps each sibling, edited and continuation state isolated and persists manual revisions across reopen without requests', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tavern-mvu-storage-')), path = join(dir, 'story.sqlite');
    let store = new ConversationStore(path);
    try {
      const { conversation, turn, group, snapshot } = seed(store), firstState = state(3);
      const first = store.createCandidate(group.id, { kind: 'generated', text: '第一条原文', status: 'complete', mvu: { state: firstState, issues, kind: 'computed' } });
      const sibling = store.createCandidate(group.id, { kind: 'generated', text: '另一条原文', status: 'complete', mvu: { state: state(8), issues: [], kind: 'computed' } });
      const edited = store.editCandidate(first.id, '手改原文');
      expect(store.getCandidate(edited.id).mvu).toEqual({ state: state(3), issues, kind: 'computed' });
      const continuation = store.createCandidate(group.id, { kind: 'continuation', sourceCandidateId: first.id, text: '接着写。', status: 'complete', mvu: { state: state(2), issues: [], kind: 'computed' } });
      expect(store.getCandidate(first.id).mvu).toMatchObject({ state: { stat_data: { hp: 3 } }, kind: 'computed' });
      firstState.stat_data.hp = 100;
      expect(store.getCandidate(first.id).mvu?.state.stat_data.hp).toBe(3);
      const manual: NonNullable<Candidate['mvu']> = { state: state(6), issues, kind: 'manual', revisions: [{ state: state(3), at: 1234 }] };
      store.setCandidateMvu(first.id, manual);
      manual.state.stat_data.hp = 200;
      store.setCandidateMvu(edited.id, { state: state(9), issues: [], kind: 'computed' });
      store.selectCandidate(sibling.id);
      const read = store.getCandidate(first.id);
      read.mvu!.revisions![0]!.state.stat_data.hp = 300;
      store.close(); store = new ConversationStore(path);
      expect(store.getCandidate(first.id)).toMatchObject({ text: '第一条原文', status: 'complete', mvu: { state: { stat_data: { hp: 6 } }, issues, kind: 'manual', revisions: [{ state: { stat_data: { hp: 3 } }, at: 1234 }] } });
      expect(store.getCandidate(sibling.id).mvu?.state.stat_data.hp).toBe(8);
      expect(store.getCandidate(edited.id)).toMatchObject({ text: '手改原文', sourceCandidateId: first.id, mvu: { state: { stat_data: { hp: 9 } } } });
      expect(store.getCandidate(continuation.id).mvu?.state.stat_data.hp).toBe(2);
      expect(store.getSnapshot(snapshot.id).mvu?.before.stat_data.hp).toBe(5);
      expect(store.getConversation(conversation.id).currentCandidateId).toBe(sibling.id);
      expect(store.usageForTurn(turn.id)).toMatchObject({ requestCount: 0, unknownRequests: 0 });
      expect(store.exportData(conversation.id).attempts).toEqual([]);
    } finally {
      store.close();
      if (dirname(dir) !== resolve(tmpdir()) || !basename(dir).startsWith('tavern-mvu-storage-')) throw new Error('unexpected temporary cleanup target');
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('carries imported MVU JSON and tri-state enablement while leaving older snapshots optional', () => {
    const store = new ConversationStore(':memory:');
    try {
      const legacy = store.createConversation({ title: '旧对话' });
      expect(legacy.settings.mvuEnabled).toBeUndefined();
      const disabled = store.createConversation({ title: '不运行变量', settings: { mvuEnabled: false } });
      expect(disabled.settings.mvuEnabled).toBe(false);
      const { conversation, group } = seed(store);
      const imported = store.createCandidate(group.id, { kind: 'generated', text: '<UpdateVariable>原文</UpdateVariable>', status: 'complete', mvu: { state: state(7), issues, kind: 'imported' } });
      expect(store.getCandidate(imported.id).mvu).toEqual({ state: state(7), issues, kind: 'imported' });
      expect(store.getConversation(conversation.id).settings.mvuEnabled).toBe(true);
      const old = store.createSnapshot(legacy.id, { system: '', messages: [], bindings: [], options: {} });
      expect(store.getSnapshot(old.id).mvu).toBeUndefined();
      expect(store.exportData(legacy.id).inputs).toHaveLength(1);
      expect(store.getCandidate(imported.id).text).toBe('<UpdateVariable>原文</UpdateVariable>');
    } finally { store.close(); }
  });
});
