import { describe, expect, it } from 'vitest';
import type { JsonValue, MaterialVersion } from '@tavern-kit/rp-materials/types';
import { decodeMaterial } from '../../rp-materials/src/codec.js';
import { assemblePrompt } from './prompt.js';
import type { MvuState } from './mvu/types.js';

const state = (): MvuState => ({ stat_data: { counter: 10, place: '河岸' }, schema: {}, initialized_lorebooks: {}, display_data: {}, delta_data: {} });
function material(id: string, raw: JsonValue): MaterialVersion {
  const decoded = decodeMaterial({ name: `${id}.json`, bytes: new TextEncoder().encode(JSON.stringify(raw)) });
  return { id, version: 1, originalId: decoded.contentHash, createdAt: '2026-11-20', raw: decoded.raw, projection: decoded.projection, capabilities: decoded.capabilities, bindings: { worldbooks: [], preset: null } };
}
const base = { playerName: '阿宁', playerDescription: '', history: [], input: '', inputBudget: 16000 };

describe('MVU 读取参与确定性编排', () => {
  it('变量先于输入输出正则和世界书关键词展开，身份、预设、备忘与示例也读取同一状态', () => {
    const card = material('card', { spec: 'chara_card_v3', spec_version: '3.0', data: { name: '小满', description: '描述={{get_message_variable::stat_data.counter}}', mes_example: '阿宁: 示例{{get_message_variable::stat_data.counter}}\n小满: 回应{{get_message_variable::stat_data.counter}}' } });
    const preset = material('preset', { prompts: [
      { identifier: 'main', content: '主提示={{get_message_variable::stat_data.counter}}', role: 'system', forbid_overrides: true },
      { identifier: 'charDescription', marker: true }, { identifier: 'personaDescription', marker: true },
      { identifier: 'worldInfoBefore', marker: true }, { identifier: 'dialogueExamples', marker: true }, { identifier: 'chatHistory', marker: true },
    ] });
    const book = material('book', { name: '当前地点', entries: { '0': { uid: 0, key: ['TEN'], content: '地点={{get_message_variable::stat_data.place}}', position: 0, disable: false } } });
    const rules = material('rules', [
      { scriptName: '变量再替换输入', findRegex: '/10/g', replaceString: 'TEN', placement: [1], promptOnly: true },
      { scriptName: '变量再替换输出', findRegex: '/10/g', replaceString: 'H10', placement: [2], promptOnly: true },
    ]);
    const mvu = state(), original = structuredClone(mvu), raw = structuredClone(card.raw);
    const result = assemblePrompt({ ...base, materials: [card, preset, book, rules], playerDescription: '关系={{get_message_variable::stat_data.counter}}', history: [{ role: 'assistant', content: '历史={{get_message_variable::stat_data.counter}}' }], input: '{{get_message_variable::stat_data.counter}}', memo: { content: '备忘={{get_message_variable::stat_data.counter}}', locked: ['约定={{get_message_variable::stat_data.place}}'] }, mvu });
    const text = result.messages.map(message => message.content).join('\n');
    expect(text).toContain('主提示=10'); expect(text).toContain('描述=10'); expect(text).toContain('关系=10');
    expect(text).toContain('地点=河岸'); expect(text).toContain('示例10'); expect(text).toContain('回应10');
    expect(text).toContain('备忘=10'); expect(text).toContain('约定=河岸');
    expect(result.messages.at(-2)).toEqual({ role: 'assistant', content: '历史=H10' });
    expect(result.messages.at(-1)).toEqual({ role: 'user', content: 'TEN' });
    expect(result.triggeredLore).toEqual(['book:0']); expect(mvu).toEqual(original); expect(card.raw).toEqual(raw);
  });

  it('续写固定世界书命中集合，不重触发新关键词或按变化后的内容重新裁条目预算', () => {
    const book = material('book', { name: '路线', token_budget: 1, entries: {
      '0': { uid: 0, key: ['旧关键词'], content: '原命中={{get_message_variable::stat_data.counter}}' },
      '1': { uid: 1, key: ['新关键词'], content: '不应加入的新条目' },
    } });
    const result = assemblePrompt({ ...base, materials: [book], input: '新关键词', mvu: state(), frozenLore: ['book:0'] });
    expect(result.triggeredLore).toEqual(['book:0']);
    expect(result.system).toContain('原命中=10'); expect(result.system).not.toContain('不应加入的新条目');
  });

  it('冻结的空命中集合与未冻结不同，即使读取状态变化也不新加常驻条目', () => {
    const book = material('book', { name: '常驻', entries: { '0': { uid: 0, constant: true, content: '不应重新激活' } } });
    const result = assemblePrompt({ ...base, materials: [book], mvu: state(), frozenLore: [] });
    expect(result.triggeredLore).toEqual([]); expect(result.system).toBe('');
  });
});
