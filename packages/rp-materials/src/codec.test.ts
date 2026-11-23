import { crc32, deflateSync } from 'node:zlib';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeMaterial } from './index.js';

const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const pixel = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
  chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
  chunk('IEND', Buffer.alloc(0)),
]);
function chunk(name: string, data: Uint8Array): Buffer {
  const type = Buffer.from(name, 'ascii');
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  type.copy(result, 4);
  result.set(data, 8);
  result.writeUInt32BE(crc32(Buffer.concat([type, data])), data.length + 8);
  return result;
}
function png(metadata: [string, string, ('tEXt' | 'zTXt' | 'iTXt')?][]): Uint8Array {
  const inserted = metadata.map(([name, value, type = 'tEXt']) => {
    if (type === 'zTXt') return chunk(type, Buffer.concat([Buffer.from(`${name}\0\0`, 'latin1'), deflateSync(Buffer.from(value))]));
    if (type === 'iTXt') return chunk(type, Buffer.concat([Buffer.from(`${name}\0\0\0\0\0`, 'latin1'), Buffer.from(value)]));
    return chunk(type, Buffer.from(`${name}\0${value}`, 'latin1'));
  });
  return Buffer.concat([pixel.subarray(0, pixel.length - 12), ...inserted, pixel.subarray(pixel.length - 12)]);
}
const v3 = {
  spec: 'chara_card_v3', spec_version: '3.0', futureEnvelope: { retained: true },
  data: { name: '阿岚', description: '旧城的药师', personality: '温柔', first_mes: '你回来了。', unknownPlugin: { value: [1, '不丢'] } },
};

afterEach(() => vi.unstubAllGlobals());

describe('offline material containers', () => {
  it('keeps all original JSON fields detached from its runtime projection', () => {
    const imported = decodeMaterial({ name: '阿岚.json', bytes: bytes(v3) });
    expect(imported.raw).toEqual(v3);
    expect(imported.projection.character).toMatchObject({ name: '阿岚', description: '旧城的药师', firstMessage: '你回来了。' });
    expect(imported.originalBytes).toEqual(bytes(v3));
  });

  it('takes ccv3 before chara while preserving the complete PNG and local assets', () => {
    const image = png([
      ['chara', Buffer.from(JSON.stringify({ name: '旧名', description: '旧人设' })).toString('base64')],
      ['ccv3', Buffer.from(JSON.stringify(v3)).toString('base64')],
      ['chara-ext-asset_:assets/letter.txt', Buffer.from('约定').toString('base64')],
    ]);
    const imported = decodeMaterial({ name: '角色.png', bytes: image });
    expect(imported.projection.name).toBe('阿岚');
    expect(imported.originalBytes).toEqual(Uint8Array.from(image));
    expect(imported.resources.find(item => item.path === 'assets/letter.txt')?.bytes).toEqual(Buffer.from('约定'));
    expect(imported.resources.find(item => item.path === 'ccdefault:')?.bytes).toEqual(Uint8Array.from(image));
  });

  it.each(['zTXt', 'iTXt'] as const)('reads %s card metadata through the same card-only codec', type => {
    const image = png([['ccv3', Buffer.from(JSON.stringify(v3)).toString('base64'), type]]);
    expect(decodeMaterial({ name: 'card.png', bytes: image }).projection.name).toBe('阿岚');
  });

  it('does not silently downgrade a corrupt ccv3 to a different chara card', () => {
    const image = png([['ccv3', 'broken'], ['chara', Buffer.from(JSON.stringify(v3)).toString('base64')]]);
    expect(() => decodeMaterial({ name: 'card.png', bytes: image })).toThrow();
  });

  it('keeps all CharX files and never fetches remote references', () => {
    const fetch = vi.fn(() => { throw new Error('network must not be used'); });
    vi.stubGlobal('fetch', fetch);
    const raw = { ...v3, data: { ...v3.data, assets: [{ uri: 'https://example.invalid/portrait.png' }, { uri: 'embeded://assets/letter.txt' }] } };
    const archive = zipSync({ 'card.json': bytes(raw), 'assets/letter.txt': Buffer.from('约定'), 'other/state.bin': new Uint8Array([5, 6, 7]) });
    const imported = decodeMaterial({ name: '阿岚.charx', bytes: archive });
    expect(imported.raw).toEqual(raw);
    expect(imported.format).toBe('charx');
    expect(imported.resources.map(resource => resource.path)).toEqual(['assets/letter.txt', 'other/state.bin']);
    expect(imported.originalBytes).toEqual(archive);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('unwraps one material ZIP but retains the ZIP original and all sibling resources', () => {
    const archive = zipSync({ '包内/角色.json': bytes(v3), '包内/photo.webp': new Uint8Array([1, 2, 3]) });
    const imported = decodeMaterial({ name: '单素材.zip', bytes: archive });
    expect(imported.projection.kind).toBe('character');
    expect(imported.format).toBe('zip');
    expect(imported.originalBytes).toEqual(archive);
    expect(imported.resources[0]?.path).toBe('包内/photo.webp');
  });

  it('rejects multiple-material ZIP instead of discarding an arbitrary card', () => {
    const archive = zipSync({ 'a.json': bytes(v3), 'b.json': bytes(v3) });
    expect(() => decodeMaterial({ name: '多素材.zip', bytes: archive })).toThrow(/多|逐|一/u);
  });

  it('projects legacy and Pygmalion fields without replacing their raw documents', () => {
    const old = { char_name: '小川', char_persona: '老友', world_scenario: '海边', char_greeting: '回来啦', example_dialogue: '例子', future: '保留' };
    const imported = decodeMaterial({ name: '老卡.json', bytes: bytes(old) });
    expect(imported.raw).toEqual(old);
    expect(imported.projection.character).toMatchObject({ name: '小川', description: '老友', scenario: '海边', firstMessage: '回来啦', messageExamples: '例子' });
  });
});

describe('material classification and execution projections', () => {
  it('preserves worldbook logic, budgets, positions and disabled entries', () => {
    const raw = { name: '旧城', scanDepth: 4, budget: 512, entries: {
      '9': { uid: 9, key: ['旧城'], keysecondary: ['雨'], selective: true, selectiveLogic: 2, content: '雨季的旧城', order: 20, position: 4, depth: 2, role: 1, constant: false, disable: false, caseSensitive: true, sticky: 3, future: '保留' },
      '10': { uid: 10, content: '不启用', disable: true },
    } };
    const imported = decodeMaterial({ name: '世界书.json', bytes: bytes(raw) });
    expect(imported.projection.worldbook).toMatchObject({ scanDepth: 4, budget: 512, entries: [
      { id: '9', keys: ['旧城'], secondaryKeys: ['雨'], selectiveLogic: 2, position: 'depth', depth: 2, role: 'user', enabled: true, caseSensitive: true },
      { id: '10', enabled: false },
    ] });
    expect(imported.raw).toEqual(raw);
    expect(imported.capabilities.some(item => item.path.endsWith('sticky') && item.status === 'archived')).toBe(true);
  });

  it('uses ST embedded-book extension positions before the basic card position', () => {
    const raw = { ...v3, data: { ...v3.data, character_book: { entries: [
      { id: 0, keys: ['雨'], content: '约好雨夜见面', enabled: true, position: 'before_char', extensions: { position: 4, depth: 2, role: 1 } },
      { id: 1, keys: ['风'], content: '风起时回家', enabled: true, position: 'after_char', extensions: { position: 0 } },
    ] } } };
    const imported = decodeMaterial({ name: '内嵌世界书.json', bytes: bytes(raw) });
    expect(imported.projection.worldbook?.entries).toMatchObject([
      { position: 'depth', depth: 2, role: 'user', enabled: true },
      { position: 'before', enabled: true },
    ]);
    expect(imported.raw).toEqual(raw);
  });

  it('keeps preset order and depth while separating supported controls from archived controls', () => {
    const raw = { name: '聊天预设', temperature: 0.8, openai_max_tokens: 4096, top_p: 0.9, prompts: [
      { identifier: 'a', name: '深度', role: 'user', content: '记得{{user}}', injection_position: 1, injection_depth: 2 },
      { identifier: 'main', role: 'system', content: '{{char}}的设定' },
      { identifier: 'chatHistory', marker: true },
    ], prompt_order: [{ character_id: 100001, order: [{ identifier: 'main', enabled: true }, { identifier: 'chatHistory', enabled: true }, { identifier: 'a', enabled: false }] }] };
    const imported = decodeMaterial({ name: 'preset.json', bytes: bytes(raw) });
    expect(imported.projection.preset?.prompts.map(item => [item.identifier, item.enabled])).toEqual([['main', true], ['chatHistory', true], ['a', false]]);
    expect(imported.projection.preset?.prompts[2]).toMatchObject({ position: 'depth', depth: 2, role: 'user' });
    expect(imported.projection.preset?.sampling).toEqual({ temperature: 0.8, maxTokens: 4096 });
    expect(imported.capabilities.some(item => item.path === 'top_p' && item.status === 'archived')).toBe(true);
  });

  it('distinguishes display-only regex and pure-text quick replies from archived scripts', () => {
    const regex = decodeMaterial({ name: 'regex.json', bytes: bytes([{ scriptName: '称呼', findRegex: '先生', replaceString: '阿岚', placement: [2], markdownOnly: true, minDepth: 0, maxDepth: 4, runOnEdit: true }]) });
    expect(regex.projection.regex[0]).toMatchObject({ placements: ['output'], displayOnly: true, minDepth: 0, maxDepth: 4, runOnEdit: true });
    const replies = decodeMaterial({ name: 'quick.json', bytes: bytes({ name: '日常', qrList: [{ label: '打招呼', message: '我回来啦' }, { label: '脚本', message: '/run something' }] }) });
    expect(replies.projection.quickReplies).toEqual([{ id: '0', label: '打招呼', message: '我回来啦', enabled: true, sourcePath: 'qrList.0' }]);
    expect(replies.capabilities.some(item => item.path === 'qrList.1' && item.status === 'archived')).toBe(true);
    const script = decodeMaterial({ name: 'helper.json', bytes: bytes({ type: 'script', content: 'fetch("https://example.invalid")' }) });
    expect(script.projection.kind).toBe('script');
    expect(script.capabilities.every(item => item.status === 'archived')).toBe(true);
  });

  it.each([
    ['theme', { name: '主题', main_text_color: '#fff', custom_css: 'a{}' }],
    ['extension', { name: '扩展', macros: [], noass: true }],
  ] as const)('recognizes %s configs without making them executable', (kind, raw) => {
    const imported = decodeMaterial({ name: 'config.json', bytes: bytes(raw) });
    expect(imported.projection.kind).toBe(kind);
    expect(imported.capabilities.every(item => item.status === 'archived')).toBe(true);
  });
});
