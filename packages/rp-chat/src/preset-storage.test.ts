import { describe, expect, it } from 'vitest';
import { MaterialsLibrary } from '@tavern-kit/rp-materials/library';
import { ConversationStore } from './store.js';
import { assemblePrompt } from './prompt.js';
import { exportConversation, restoreConversation } from './backup.js';

describe('真实素材仓与会话备份中的预设覆盖约束', () => {
  it.each([
    { locked: true, expected: ['PRESET_LOCKED', 'POST_LOCKED', 'NEXT_INPUT'] },
    { locked: false, expected: ['CARD_OVERRIDES', 'CARD_POST', 'NEXT_INPUT'] },
  ])('导入后与完整备份恢复后均尊重 forbid_overrides=$locked', ({ locked, expected }) => {
    const materials = new MaterialsLibrary(':memory:');
    const restoredMaterials = new MaterialsLibrary(':memory:');
    const store = new ConversationStore(':memory:');
    const restoredStore = new ConversationStore(':memory:');
    const presetRaw = {
      prompts: [
        { identifier: 'main', role: 'system', content: 'PRESET_LOCKED', forbid_overrides: locked, future: { kept: true } },
        { identifier: 'jailbreak', role: 'system', content: 'POST_LOCKED', forbid_overrides: locked },
        { identifier: 'chatHistory', marker: true },
      ],
      prompt_order: [{ character_id: 100001, order: [
        { identifier: 'main', enabled: true }, { identifier: 'jailbreak', enabled: true }, { identifier: 'chatHistory', enabled: true },
      ] }],
    };
    try {
      const preset = materials.import({ name: 'locked-preset.json', bytes: new TextEncoder().encode(JSON.stringify(presetRaw)) });
      const character = materials.import({ name: 'character.json', bytes: new TextEncoder().encode(JSON.stringify({
        spec: 'chara_card_v3', spec_version: '3.0', data: { name: '阿宁', system_prompt: 'CARD_OVERRIDES', post_history_instructions: 'CARD_POST' },
      })) });
      const bindings = [character, preset].map(record => ({ id: record.id, version: record.current.version }));
      const conversation = store.createConversation({ title: '预设覆盖规则', bindings });
      const readRequest = (library: MaterialsLibrary, refs: typeof bindings) => assemblePrompt({
        materials: refs.map(ref => library.readVersion(ref)), playerName: '我', playerDescription: '', history: [], input: 'NEXT_INPUT', inputBudget: 16000,
      });
      expect(readRequest(materials, bindings).messages.map(message => message.content)).toEqual(expected);
      expect(materials.readVersion(bindings[1]!).raw).toEqual(presetRaw);
      const archive = exportConversation(store, materials, conversation.id);
      const restored = restoreConversation(restoredStore, restoredMaterials, archive.bytes);
      expect(readRequest(restoredMaterials, restored.bindings).messages.map(message => message.content)).toEqual(expected);
      const restoredPreset = restored.bindings.map(ref => restoredMaterials.readVersion(ref)).find(version => version.projection.preset);
      expect(restoredPreset?.raw).toEqual(presetRaw);
    } finally {
      store.close(); restoredStore.close(); materials.close(); restoredMaterials.close();
    }
  });
});
