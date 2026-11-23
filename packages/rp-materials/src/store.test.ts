import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaterialsLibrary, type MaterialVersionRef } from './index.js';

const bytes = (raw: unknown) => new TextEncoder().encode(JSON.stringify(raw));
const roots: string[] = [];
const opened: MaterialsLibrary[] = [];
function library(name = '素材.sqlite') {
  const directory = mkdtempSync(join(tmpdir(), 'tavern-materials-'));
  roots.push(directory);
  const path = join(directory, name);
  const store = new MaterialsLibrary(path);
  opened.push(store);
  return { store, path };
}
const card = { spec: 'chara_card_v3', spec_version: '3.0', vendorEnvelope: '保留', data: { name: '阿岚', description: '旧城药师', first_mes: '你回来了。', extensions: { unknownAuthor: { color: '#fff' } }, unknownField: [1, '保留'] } };
const ref = (id: string, version: number): MaterialVersionRef => ({ id, version });
afterEach(() => {
  for (const store of opened.splice(0)) store.close();
  for (const directory of roots.splice(0)) rmSync(directory, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('local versioned material library', () => {
  it('persists original bytes and separate immutable versions in real SQLite', () => {
    const { store, path } = library();
    const original = bytes(card);
    const imported = store.import({ name: '卡.json', bytes: original }, { category: '常玩', tags: ['古风'] });
    const edited = store.revise(imported.id, { patch: { data: { description: '雨季的药师' } } });
    expect(edited.version).toBe(2);
    expect(store.readVersion(ref(imported.id, 1)).projection.character?.description).toBe('旧城药师');
    expect(edited.raw).toMatchObject({ vendorEnvelope: '保留', data: { description: '雨季的药师', unknownField: [1, '保留'], extensions: { unknownAuthor: { color: '#fff' } } } });
    expect(store.exportOriginal(ref(imported.id, 2)).bytes).toEqual(original);
    store.close();
    const reopened = new MaterialsLibrary(path);
    opened.push(reopened);
    expect(reopened.get(imported.id).current.projection.character?.description).toBe('雨季的药师');
    expect(reopened.versions(imported.id)).toEqual([ref(imported.id, 2), ref(imported.id, 1)]);
    expect(reopened.exportOriginal(ref(imported.id, 1)).bytes).toEqual(original);
  });

  it('exports edited JSON as CCv3 and reimports edits without stripping unknown fields', () => {
    const { store } = library();
    const source = store.import({ name: '旧卡.json', bytes: bytes({ name: '旧名', description: '原描述', first_mes: '见面', customExtension: { keep: true } }) });
    store.revise(source.id, { patch: { name: '新名', description: '新描述' } });
    const exported = store.exportCurrent(source.id);
    expect(exported.mediaType).toBe('application/json');
    const raw: unknown = JSON.parse(new TextDecoder().decode(exported.bytes));
    expect(raw).toMatchObject({ spec: 'chara_card_v3', spec_version: '3.0', customExtension: { keep: true }, data: { name: '新名', description: '新描述' } });
    const restored = store.import({ name: exported.name, bytes: exported.bytes });
    expect(restored.current.projection.character).toMatchObject({ name: '新名', description: '新描述' });
    expect(restored.current.raw).toMatchObject({ customExtension: { keep: true } });
  });

  it('round-trips edited regex collections after every rule is removed', () => {
    const { store } = library();
    const rule = { scriptName: '称呼', findRegex: '先生', replaceString: '阿岚', placement: [2], unknownAuthorField: '保留' };
    const original = bytes([rule]);
    const source = store.import({ name: '正则.json', bytes: original });
    const edited = store.revise(source.id, { raw: [] });
    expect(edited.projection.regex).toEqual([]);
    const exported = store.exportCurrent(source.id);
    expect(JSON.parse(new TextDecoder().decode(exported.bytes))).toEqual([]);
    const restored = store.import({ name: exported.name, bytes: exported.bytes });
    expect(restored.kind).toBe('regex');
    expect(restored.current.raw).toEqual([]);
    expect(restored.current.projection.regex).toEqual([]);
    expect(store.exportOriginal(source.id).bytes).toEqual(original);

    const wrapped = store.import({ name: '包裹正则.json', bytes: bytes({ __type: 'regex', __content__: [rule], unknownAuthorField: '保留' }) });
    store.revise(wrapped.id, { patch: { __content__: [] } });
    const wrappedExport = store.exportCurrent(wrapped.id);
    const wrappedRestored = store.import({ name: wrappedExport.name, bytes: wrappedExport.bytes });
    expect(wrappedRestored.kind).toBe('regex');
    expect(wrappedRestored.current.raw).toEqual({ __type: 'regex', __content__: [], unknownAuthorField: '保留' });
    expect(wrappedRestored.current.projection.regex).toEqual([]);
    expect(() => store.import({ name: '未识别.json', bytes: bytes({ unknownAuthorField: '保留' }) })).toThrow(/没有识别到素材结构/);
  });

  it('manages search, category, tags, enabled state and copy without changing existing versions', () => {
    const { store } = library();
    const imported = store.import({ name: '卡.json', bytes: bytes(card) }, { category: '常玩', tags: ['古风'] });
    store.updateMetadata(imported.id, { name: '雨夜存档', enabled: false, category: '收藏', tags: ['长聊'] });
    expect(store.list({ search: '雨夜', category: '收藏', enabled: false, tag: '长聊' }).map(item => item.id)).toEqual([imported.id]);
    expect(store.list({ category: '常玩' })).toEqual([]);
    const copy = store.copy(imported.id, { name: '新开一段' });
    expect(copy.id).not.toBe(imported.id);
    expect(copy.currentVersion).toBe(1);
    expect(copy.current.raw).toEqual(card);
    store.revise(copy.id, { patch: { data: { name: '小川' } } });
    expect(store.get(imported.id).current.projection.name).toBe('阿岚');
  });

  it('pins character bindings to worldbook and preset versions', () => {
    const { store } = library();
    const character = store.import({ name: '卡.json', bytes: bytes(card) });
    const book = store.import({ name: '世界书.json', bytes: bytes({ name: '旧城', entries: [{ keys: ['旧城'], content: '旧城下雨' }] }) });
    const preset = store.import({ name: '预设.json', bytes: bytes({ name: '预设', prompts: [{ identifier: 'main', content: '保持称呼', role: 'system' }] }) });
    const bound = store.setBindings(character.id, { worldbooks: [ref(book.id, 1)], preset: ref(preset.id, 1) });
    store.revise(book.id, { patch: { name: '世界书新版' } });
    expect(bound.bindings).toEqual({ worldbooks: [ref(book.id, 1)], preset: ref(preset.id, 1) });
    expect(store.readVersion(ref(character.id, 1)).bindings).toEqual({ worldbooks: [], preset: null });
    expect(() => store.setBindings(character.id, { worldbooks: [ref(preset.id, 1)], preset: null })).toThrow(/世界书/u);
  });

  it('moves only requested versions and all transitive bindings, original containers and resources offline', () => {
    const { store: source } = library();
    const fetch = vi.fn(() => { throw new Error('network must not be used'); });
    vi.stubGlobal('fetch', fetch);
    const archive = zipSync({ 'card.json': bytes(card), 'assets/约定.txt': Buffer.from('一起看雪'), 'assets/portrait.png': new Uint8Array([1, 2, 3]) });
    const character = source.import({ name: '阿岚.charx', bytes: archive });
    const book = source.import({ name: '世界书.json', bytes: bytes({ entries: [{ keys: ['雪'], content: '约定一起看雪' }] }) });
    const bound = source.setBindings(character.id, { worldbooks: [ref(book.id, 1)], preset: null });
    source.revise(character.id, { patch: { data: { description: '未绑定的未来版本' } } });
    const portable = source.exportBundle([ref(character.id, 1), ref(character.id, bound.version)]);
    expect(portable.materials.find(item => item.metadata.id === character.id)?.versions.map(item => item.version)).toEqual([1, 2]);
    expect(portable.materials).toHaveLength(2);
    expect(portable.originals.find(item => item.format === 'charx')?.base64).toBe(Buffer.from(archive).toString('base64'));
    const { store: target } = library();
    const restored = target.importBundle(JSON.parse(JSON.stringify(portable)) as unknown);
    const remap = restored.references.find(item => item.from.id === character.id && item.from.version === bound.version)!.to;
    const newBookRef = restored.references.find(item => item.from.id === book.id && item.from.version === 1)!.to;
    expect(remap.id).not.toBe(character.id);
    expect(target.readVersion(remap).bindings).toEqual({ worldbooks: [newBookRef], preset: null });
    expect(target.exportOriginal(remap).bytes).toEqual(archive);
    expect(target.resources(remap).find(item => item.path === 'assets/约定.txt')?.bytes).toEqual(Uint8Array.from(Buffer.from('一起看雪')));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('hides removed materials from the library while old dialogue references keep their versions and original bytes', () => {
    const { store } = library();
    const original = bytes(card);
    const character = store.import({ name: '卡.json', bytes: original });
    store.revise(character.id, { patch: { data: { description: '新版描述' } } });
    store.delete(character.id);
    expect(store.list()).toEqual([]);
    expect(store.readVersion(ref(character.id, 1)).projection.character?.description).toBe('旧城药师');
    expect(store.exportOriginal(ref(character.id, 1)).bytes).toEqual(original);
    const bundle = store.exportBundle([ref(character.id, 1)]);
    expect(bundle.materials[0]?.versions).toHaveLength(1);
    const { store: target } = library();
    const restored = target.importBundle(bundle);
    expect(target.readVersion(restored.references[0]!.to).projection.character?.description).toBe('旧城药师');
  });

  it('checks backup references before importing and leaves no partial restored materials', () => {
    const { store: source } = library();
    const character = source.import({ name: '卡.json', bytes: bytes(card) });
    const bundle = source.exportBundle([ref(character.id, 1)]);
    bundle.materials[0]!.versions[0]!.bindings.worldbooks.push(ref('missing-book', 1));
    const { store: target } = library();
    expect(() => target.importBundle(bundle)).toThrow(/引用|缺少/u);
    expect(target.list()).toEqual([]);
    expect(() => target.importBundle({ format: 'tavern-kit.materials', version: 99 })).toThrow(/版本/u);
  });
});
