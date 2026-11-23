// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { MaterialsLibrary } from '@tavern-kit/rp-materials/library';
import type { MaterialVersion, MaterialVersionRef, PersonaAvatar, PortableResource } from '@tavern-kit/rp-materials/types';
import type { ChatPanelApi } from './ChatPanel.js';
import { usePersonaPortraits } from './usePersonaPortraits.js';

type PortraitApi = Pick<ChatPanelApi, 'materialVersion' | 'resources'>;
interface HookProps { refs: readonly MaterialVersionRef[]; api: PortraitApi }
const firstImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const secondImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const libraries: MaterialsLibrary[] = [], externalReads: unknown[] = [];
beforeEach(() => {
  externalReads.length = 0;
  vi.stubGlobal('fetch', (input: unknown) => { externalReads.push(input); throw new Error('头像不应访问网络'); });
});
afterEach(() => {
  cleanup(); for (const library of libraries.splice(0)) library.close(); vi.unstubAllGlobals();
  expect(externalReads).toEqual([]);
});

function fixture() {
  const library = new MaterialsLibrary(':memory:'); libraries.push(library);
  const saved = library.import({ name: '小雨.persona.json', bytes: Uint8Array.from(new TextEncoder().encode(JSON.stringify({
    format: 'tavern-kit.persona', version: 1, name: '小雨', description: '海边来的旅人',
    avatar: { name: '头像.png', mediaType: 'image/png', base64: firstImage },
  }))) });
  const first = { id: saved.id, version: 1 }, second = { id: saved.id, version: 2 };
  library.revisePersona(saved.id, { name: '雨', description: '熟悉旧城的旅人', avatar: { name: '头像.png', mediaType: 'image/png', base64: secondImage } });
  return { library, first, second };
}
function resources(library: MaterialsLibrary, ref: MaterialVersionRef): PortableResource[] {
  return library.resources(ref).map(resource => ({ path: resource.path, mediaType: resource.mediaType, base64: Buffer.from(resource.bytes).toString('base64') }));
}
function apiFor(library: MaterialsLibrary) {
  const versionReads: MaterialVersionRef[] = [], resourceReads: MaterialVersionRef[] = [];
  const api: PortraitApi = {
    materialVersion: async ref => { versionReads.push({ ...ref }); return library.readVersion(ref); },
    resources: async ref => { resourceReads.push({ ...ref }); return resources(library, ref); },
  };
  return { api, versionReads, resourceReads };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const mount = (props: HookProps) => renderHook((input: HookProps) => usePersonaPortraits(input.refs, input.api), { initialProps: props });

describe('按冻结人设版本读取本地头像', () => {
  it('同一素材的两个版本各用自己的 exact avatarPath 与本地字节', async () => {
    const f = fixture(), source = apiFor(f.library);
    const api: PortraitApi = { ...source.api, resources: async ref => [
      { path: 'other/avatar.png', mediaType: 'image/png', base64: secondImage },
      ...await source.api.resources!(ref),
    ] };
    const view = mount({ refs: [f.first, f.second], api }), initial = view.result.current;
    await waitFor(() => expect(view.result.current.size).toBe(2));
    expect(view.result.current.get(`${f.first.id}@1`)).toBe(`data:image/png;base64,${firstImage}`);
    expect(view.result.current.get(`${f.first.id}@2`)).toBe(`data:image/png;base64,${secondImage}`);
    expect(initial.size).toBe(0);
    expect(source.versionReads).toEqual([f.first, f.second]);
    expect(source.resourceReads).toEqual([f.first, f.second]);
  });

  it('重复引用、未完成读取与流式重渲染都只为同一版本请求一次', async () => {
    const f = fixture(), source = apiFor(f.library), pending = deferred<PortableResource[]>();
    const api: PortraitApi = { ...source.api, resources: async ref => { source.resourceReads.push({ ...ref }); return pending.promise; } };
    const view = mount({ refs: [f.first, { ...f.first }], api }), empty = view.result.current;
    await waitFor(() => expect(source.resourceReads).toHaveLength(1));
    for (let chunk = 0; chunk < 30; chunk++) view.rerender({ refs: [{ ...f.first }, { ...f.first }], api });
    expect(view.result.current).toBe(empty);
    expect(source.versionReads).toEqual([f.first]);
    expect(source.resourceReads).toEqual([f.first]);
    await act(async () => { pending.resolve(resources(f.library, f.first)); });
    const ready = view.result.current;
    expect(ready.get(`${f.first.id}@1`)).toBe(`data:image/png;base64,${firstImage}`);
    view.rerender({ refs: [], api });
    for (let chunk = 0; chunk < 30; chunk++) view.rerender({ refs: [{ ...f.first }], api });
    expect(view.result.current).toBe(ready);
    expect(source.versionReads).toEqual([f.first]);
    expect(source.resourceReads).toEqual([f.first]);
  });

  it('旧版本迟到只补自己的键，不覆盖已就绪新版或修改先前返回的 map', async () => {
    const f = fixture(), older = deferred<PortableResource[]>(), newer = deferred<PortableResource[]>();
    const api: PortraitApi = { materialVersion: async ref => f.library.readVersion(ref), resources: async ref => ref.version === 1 ? older.promise : newer.promise };
    const view = mount({ refs: [f.first], api });
    await act(async () => { await Promise.resolve(); });
    view.rerender({ refs: [f.second], api });
    await act(async () => { newer.resolve(resources(f.library, f.second)); });
    const ready = view.result.current;
    expect(ready.get(`${f.first.id}@2`)).toBe(`data:image/png;base64,${secondImage}`);
    expect(ready.has(`${f.first.id}@1`)).toBe(false);
    await act(async () => { older.resolve(resources(f.library, f.first)); });
    expect(view.result.current.get(`${f.first.id}@1`)).toBe(`data:image/png;base64,${firstImage}`);
    expect(view.result.current.get(`${f.first.id}@2`)).toBe(`data:image/png;base64,${secondImage}`);
    expect(ready.has(`${f.first.id}@1`)).toBe(false);
  });

  it.each(['resolve', 'reject'] as const)('换 API 后先前读取的 %s 不污染新面板缓存', async ending => {
    const f = fixture(), old = deferred<PortableResource[]>(), source = apiFor(f.library);
    const previous: PortraitApi = { ...source.api, resources: async () => old.promise };
    const view = mount({ refs: [f.first], api: previous });
    await act(async () => { await Promise.resolve(); });
    view.rerender({ refs: [f.first], api: source.api });
    await waitFor(() => expect(view.result.current.get(`${f.first.id}@1`)).toBe(`data:image/png;base64,${firstImage}`));
    const ready = view.result.current;
    await act(async () => {
      if (ending === 'resolve') old.resolve(resources(f.library, f.first));
      else old.reject(new Error('先前主机已断开'));
    });
    expect(view.result.current).toBe(ready);
  });

  it('API 更换立即放下旧缓存，新的头像未读完时保留首字章所需的空图状态', async () => {
    const f = fixture(), source = apiFor(f.library), pending = deferred<PortableResource[]>();
    const view = mount({ refs: [f.first], api: source.api });
    await waitFor(() => expect(view.result.current.size).toBe(1));
    const next: PortraitApi = { ...source.api, resources: async () => pending.promise };
    view.rerender({ refs: [f.first], api: next });
    expect(view.result.current.size).toBe(0);
    await act(async () => { pending.resolve(resources(f.library, f.first)); });
    expect(view.result.current.get(`${f.first.id}@1`)).toBe(`data:image/png;base64,${firstImage}`);
  });

  it('卸载后才返回素材版本时不继续请求资源，也不修改已返回的 map', async () => {
    const f = fixture(), pending = deferred<MaterialVersion>(), source = apiFor(f.library);
    const view = mount({ refs: [f.first], api: { ...source.api, materialVersion: async () => pending.promise } });
    const empty = view.result.current;
    view.unmount();
    await act(async () => { pending.resolve(f.library.readVersion(f.first)); });
    expect(source.resourceReads).toEqual([]);
    expect(empty.size).toBe(0);
  });

  it('没有人设、没有头像及任一读取失败均不提供图，失败也不随片段反复请求', async () => {
    const f = fixture(), blank = f.library.import({ name: '阿夏.persona.json', bytes: Uint8Array.from(new TextEncoder().encode(JSON.stringify({
      format: 'tavern-kit.persona', version: 1, name: '阿夏', description: '书店店主',
    }))) });
    const blankRef = { id: blank.id, version: 1 }, missing = { id: 'missing', version: 1 };
    const withoutPersona = { id: 'not-a-persona', version: 1 }, broken = { id: f.first.id, version: 999 };
    const versionReads: MaterialVersionRef[] = [], resourceReads: MaterialVersionRef[] = [];
    const refs = [blankRef, missing, withoutPersona, broken, f.second];
    const api: PortraitApi = {
      materialVersion: async ref => {
        versionReads.push({ ...ref });
        if (ref.id === missing.id) throw new Error('素材不存在');
        const version = f.library.readVersion(ref.version === 999 || ref.id === withoutPersona.id ? f.first : ref);
        if (ref.id === withoutPersona.id) return { ...version, ...ref, projection: { ...version.projection, persona: undefined } };
        return { ...version, ...ref };
      },
      resources: async ref => {
        resourceReads.push({ ...ref });
        if (ref.version === 999) throw new Error('本地资源读取失败');
        return resources(f.library, ref);
      },
    };
    const view = mount({ refs, api });
    await waitFor(() => expect(view.result.current.size).toBe(1));
    expect(view.result.current.get(`${f.first.id}@2`)).toBe(`data:image/png;base64,${secondImage}`);
    view.rerender({ refs: refs.map(ref => ({ ...ref })), api });
    await act(async () => { await Promise.resolve(); });
    expect(versionReads).toEqual(refs);
    expect(resourceReads).toEqual([broken, f.second]);
    expect(view.result.current.size).toBe(1);
  });

  it.each(['image/png', 'image/jpeg', 'image/webp'] as const)('本地 %s 资源可用，不从另一条资源猜头像', async mediaType => {
    const f = fixture();
    const avatar: PersonaAvatar = { name: '本地头像', mediaType, base64: firstImage };
    const saved = f.library.revisePersona(f.first.id, { name: '雨', description: '', avatar });
    const ref = { id: saved.id, version: saved.version }, source = apiFor(f.library);
    const view = mount({ refs: [ref], api: source.api });
    await waitFor(() => expect(view.result.current.get(`${ref.id}@${ref.version}`)).toBe(`data:${mediaType};base64,${firstImage}`));
  });

  it.each(['remote', 'wrong-path', 'svg', 'missing-resources', 'wrong-version'] as const)('不为 %s 提供头像或使用远程地址', async failure => {
    const f = fixture();
    const api: PortraitApi = {
      materialVersion: async ref => {
        const version = f.library.readVersion(ref);
        if (failure === 'wrong-version') return f.library.readVersion(f.second);
        if (failure !== 'remote') return version;
        return { ...version, projection: { ...version.projection, persona: { name: '雨', description: '', avatarPath: 'https://example.invalid/avatar.png' } } };
      },
      ...(failure === 'missing-resources' ? {} : { resources: async () => [{
        path: failure === 'remote' ? 'https://example.invalid/avatar.png' : failure === 'wrong-path' ? 'other/avatar.png' : 'persona/avatar.png',
        mediaType: failure === 'svg' ? 'image/svg+xml' : 'image/png', base64: firstImage,
      }] }),
    };
    const view = mount({ refs: [f.first], api });
    await act(async () => { await Promise.resolve(); });
    expect(view.result.current.size).toBe(0);
  });
});
