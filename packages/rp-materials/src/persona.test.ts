import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeMaterial, MaterialsLibrary } from './index.js';
import type { PersonaDraft } from './types.js';

const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const alternateImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const avatar = { name: '头像.png', mediaType: 'image/png' as const, base64: image };
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const opened: MaterialsLibrary[] = [];
const library = () => { const store = new MaterialsLibrary(':memory:'); opened.push(store); return store; };
afterEach(() => { for (const store of opened.splice(0)) store.close(); vi.unstubAllGlobals(); });

describe('reusable local player personas', () => {
  it('recognizes the persona format before a similarly shaped character and keeps its local image and unknown fields', () => {
    const request = vi.fn(() => { throw new Error('人设不能联网'); });
    vi.stubGlobal('fetch', request);
    const raw = { format: 'tavern-kit.persona', version: 1, name: '小雨', description: '海边来的旅人', avatar, future: { keep: true } };
    const result = decodeMaterial({ name: '我的人设.json', bytes: encode(raw) });
    expect(result.projection.kind).toBe('persona');
    expect(result.projection.persona).toMatchObject({ name: '小雨', description: '海边来的旅人', avatarPath: 'persona/avatar.png' });
    expect(result.projection.character).toBeNull();
    expect(result.raw).toEqual(raw);
    expect(result.originalBytes).toEqual(encode(raw));
    expect(result.resources).toEqual([{ path: 'persona/avatar.png', mediaType: 'image/png', bytes: Uint8Array.from(Buffer.from(image, 'base64')) }]);
    expect(request).not.toHaveBeenCalled();
  });

  it('creates multiple profiles and versions images without changing originals or previously bound versions', () => {
    const store = library();
    const first = store.createPersona({ name: '小雨', description: '海边来的旅人', avatar });
    store.createPersona({ name: '阿夏', description: '书店店主' });
    expect(store.list({ kind: 'persona' }).map(item => item.name).sort()).toEqual(['小雨', '阿夏']);
    const original = store.exportOriginal(first.id).bytes;
    const firstRef = { id: first.id, version: 1 };
    const second = store.revisePersona(first.id, { name: '小雨', description: '熟悉旧城的旅人', avatar: { ...avatar, base64: alternateImage } });
    const retained = store.revisePersona(first.id, { name: '雨', description: '保留头像' });
    expect(retained.projection.persona?.name).toBe('雨');
    expect(store.resources(retained)[0]?.bytes).toEqual(Uint8Array.from(Buffer.from(alternateImage, 'base64')));
    const removed = store.revisePersona(first.id, { name: '雨', description: '不使用头像', avatar: null });
    expect(store.resources(removed)).toEqual([]);
    expect(store.readVersion(firstRef).projection.persona).toMatchObject({ name: '小雨', description: '海边来的旅人' });
    expect(store.resources(firstRef)[0]?.bytes).toEqual(Uint8Array.from(Buffer.from(image, 'base64')));
    expect(store.resources(second)[0]?.bytes).toEqual(Uint8Array.from(Buffer.from(alternateImage, 'base64')));
    expect(store.exportOriginal(first.id).bytes).toEqual(original);
  });

  it('exports edited personas as standalone JSON and restores all used avatars through the existing material backup', () => {
    const source = library();
    const raw = { format: 'tavern-kit.persona', version: 1, name: '小雨', description: '海边来的旅人', avatar, authorExtension: { keep: ['约定'] } };
    const first = source.import({ name: '人设.json', bytes: encode(raw) });
    const next = source.revisePersona(first.id, { name: '雨', description: '已认识阿岚', avatar: { ...avatar, base64: alternateImage } });
    expect(next.raw).toMatchObject({ authorExtension: { keep: ['约定'] } });
    const file = source.exportCurrent(first.id);
    const roundtrip = source.import({ name: file.name, bytes: file.bytes });
    expect(roundtrip.current.projection.persona).toEqual(next.projection.persona);
    expect(source.resources(roundtrip.current)[0]?.bytes).toEqual(Uint8Array.from(Buffer.from(alternateImage, 'base64')));
    const bundle = source.exportBundle([{ id: first.id, version: 1 }, next]);
    const target = library();
    const remap = target.importBundle(bundle);
    for (const entry of remap.references) {
      expect(target.resources(entry.to)[0]?.bytes).toEqual(Uint8Array.from(Buffer.from(entry.from.version === 1 ? image : alternateImage, 'base64')));
    }
    source.delete(first.id);
    expect(source.list({ kind: 'persona' }).map(item => item.id)).not.toContain(first.id);
    expect(source.exportBundle([{ id: first.id, version: 1 }]).materials[0]?.versions).toHaveLength(1);
  });

  it('rejects unsupported persona versions and remote or malformed avatars without creating a library entry', () => {
    const store = library();
    expect(() => store.import({ name: '未来人设.json', bytes: encode({ format: 'tavern-kit.persona', version: 99, name: '雨', description: '' }) })).toThrow(/版本/);
    expect(() => store.createPersona({ name: '雨', description: '', avatar: { name: '图片.png', mediaType: 'image/png', base64: 'https://example.invalid/image.png' } })).toThrow(/头像/);
    expect(() => store.createPersona({ name: '雨', description: '', avatar: { name: '图片.svg', mediaType: 'image/svg+xml', base64: image } } as unknown as PersonaDraft)).toThrow();
    expect(store.list()).toEqual([]);
  });
});
