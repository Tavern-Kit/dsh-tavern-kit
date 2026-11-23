// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MaterialsLibrary } from '@tavern-kit/rp-materials/library';
import type { MaterialVersion, MaterialVersionRef, PortableResource } from '@tavern-kit/rp-materials/types';
import { PersonaPicker, type PersonaPickerProps } from './PersonaPicker.js';

type Persona = NonNullable<MaterialVersion['projection']['persona']>;
type Selection = { ref?: MaterialVersionRef; persona?: Persona };
const libraries: MaterialsLibrary[] = [];
afterEach(() => { cleanup(); for (const library of libraries.splice(0)) library.close(); });
const firstAvatar = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const secondAvatar = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function addPersona(library: MaterialsLibrary, name: string, description: string, avatar?: string) {
  return library.import({ name: `${name}.json`, bytes: Uint8Array.from(new TextEncoder().encode(JSON.stringify({
    format: 'tavern-kit.persona', version: 1, name, description,
    ...(avatar ? { avatar: { name: '头像.png', mediaType: 'image/png', base64: avatar } } : {}),
  }))) });
}
function resources(library: MaterialsLibrary, ref: MaterialVersionRef): PortableResource[] {
  return library.resources(ref).map(value => ({ path: value.path, mediaType: value.mediaType, base64: Buffer.from(value.bytes).toString('base64') }));
}
function fixture() {
  const library = new MaterialsLibrary(':memory:'); libraries.push(library);
  const first = addPersona(library, '小雨', '海边来的旅人', firstAvatar);
  const second = addPersona(library, '阿夏', '旧城书店店主', secondAvatar);
  const choices: Selection[] = [], managed: string[] = [], saved: Selection[] = [];
  const props: PersonaPickerProps = {
    materials: library.list(), readVersion: async ref => library.readVersion(ref), readResources: async ref => resources(library, ref),
    onSelect: (ref, persona) => { choices.push({ ref, persona }); }, onManage: () => { managed.push('materials'); },
  };
  return { library, first, second, props, choices, managed, saved };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Parent({ props, onSave = () => {} }: { props: PersonaPickerProps; onSave?: (selection: Selection) => void }) {
  const [value, setValue] = useState(props.value), [pending, setPending] = useState(false), [shown, setShown] = useState(true);
  const [name, setName] = useState('会话里的称呼'), [description, setDescription] = useState('只属于这段对话的手调设定');
  return <form onSubmit={event => { event.preventDefault(); onSave({ ref: value, persona: { name, description } }); }}>
    {shown && <PersonaPicker {...props} value={value} onSelect={(ref, persona) => {
      setValue(ref); if (persona) { setName(persona.name); setDescription(persona.description); } props.onSelect(ref, persona);
    }} onPending={setPending} />}
    <label>当前昵称<input value={name} onChange={event => setName(event.target.value)} /></label>
    <label>当前设定<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
    <button type="submit" disabled={pending}>保存对话</button>
    <button type="button" onClick={() => setShown(false)}>离开选择区</button>
  </form>;
}
const picker = () => screen.getByRole('combobox', { name: '我的人设' }) as HTMLSelectElement;
const selectedName = () => picker().selectedOptions[0]?.textContent;
const currentName = () => (screen.getByRole('textbox', { name: '当前昵称' }) as HTMLInputElement).value;

describe('已有对话的明确版本人设选择', () => {
  it('初始旧版只识别显示，库中新版不会覆盖会话手调，明确选择新版才交给父层', async () => {
    const f = fixture(), user = userEvent.setup();
    f.library.revise(f.first.id, { patch: { name: '雨', description: '熟悉旧城的旅人' } });
    const before = f.library.readVersion({ id: f.first.id, version: 1 });
    render(<Parent props={{ ...f.props, materials: f.library.list(), value: { id: f.first.id, version: 1 } }} />);
    await waitFor(() => expect(selectedName()).toBe('小雨 · 版本 1'));
    expect((await screen.findByRole('img', { name: '我的人设头像' })).getAttribute('src')).toBe(`data:image/png;base64,${firstAvatar}`);
    expect(currentName()).toBe('会话里的称呼');
    expect(f.choices).toEqual([]);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 2' }));
    await waitFor(() => expect(currentName()).toBe('雨'));
    expect(f.choices).toEqual([{ ref: { id: f.first.id, version: 2 }, persona: { name: '雨', description: '熟悉旧城的旅人', avatarPath: 'persona/avatar.png' } }]);
    expect(f.library.readVersion({ id: f.first.id, version: 1 })).toEqual(before);
    expect(f.library.get(f.first.id).currentVersion).toBe(2);
  });

  it('已从列表移除的人设仍识别旧版本，改为手填只移除绑定而不清会话字段', async () => {
    const f = fixture(), user = userEvent.setup(); f.library.delete(f.first.id);
    render(<Parent props={{ ...f.props, materials: f.library.list(), value: { id: f.first.id, version: 1 } }} onSave={value => { f.saved.push(value); }} />);
    await waitFor(() => expect(selectedName()).toBe('小雨 · 版本 1'));
    expect((await screen.findByRole('img', { name: '我的人设头像' })).getAttribute('src')).toBe(`data:image/png;base64,${firstAvatar}`);
    expect(f.choices).toEqual([]);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '手动填写' }));
    expect(f.choices).toEqual([{ ref: undefined, persona: undefined }]);
    expect(currentName()).toBe('会话里的称呼');
    expect(screen.queryByRole('img', { name: '我的人设头像' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '管理我的人设' }));
    expect(f.managed).toEqual(['materials']); expect(f.saved).toEqual([]);
    await user.click(screen.getByRole('button', { name: '保存对话' }));
    expect(f.saved).toEqual([{ ref: undefined, persona: { name: '会话里的称呼', description: '只属于这段对话的手调设定' } }]);
  });

  it('新身份读完前父层不能保存，头像未读完不阻塞已经确认的身份', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>(), image = deferred<PortableResource[]>();
    render(<Parent props={{ ...f.props, readVersion: () => slow.promise, readResources: () => image.promise }} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(true);
    expect(currentName()).toBe('会话里的称呼'); expect(f.choices).toEqual([]);
    await act(async () => { slow.resolve(f.library.readVersion({ id: f.first.id, version: 1 })); await Promise.resolve(); });
    await waitFor(() => expect(currentName()).toBe('小雨'));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    expect(f.choices).toEqual([{ ref: { id: f.first.id, version: 1 }, persona: { name: '小雨', description: '海边来的旅人', avatarPath: 'persona/avatar.png' } }]);
    await act(async () => { image.resolve(resources(f.library, { id: f.first.id, version: 1 })); await Promise.resolve(); });
    expect(f.choices).toHaveLength(1);
  });

  it.each(['throw', 'reject'] as const)('新选择读取%s保留原值与原头像，局部重试成功后才改父层', async ending => {
    const f = fixture(), user = userEvent.setup(); let fail = true;
    const readVersion: PersonaPickerProps['readVersion'] = ref => {
      if (ref.id === f.second.id && fail) { fail = false; if (ending === 'throw') throw new Error('这份人设暂时读不到'); return Promise.reject(new Error('这份人设暂时读不到')); }
      return Promise.resolve(f.library.readVersion(ref));
    };
    render(<Parent props={{ ...f.props, readVersion, value: { id: f.first.id, version: 1 } }} />);
    await screen.findByRole('img', { name: '我的人设头像' });
    await user.selectOptions(picker(), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    expect((await screen.findByRole('alert')).textContent).toContain('这份人设暂时读不到');
    expect(selectedName()).toBe('小雨 · 版本 1'); expect(currentName()).toBe('会话里的称呼');
    expect(screen.getByRole('img', { name: '我的人设头像' }).getAttribute('src')).toBe(`data:image/png;base64,${firstAvatar}`);
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    expect(f.choices).toEqual([]);
    await user.click(screen.getByRole('button', { name: '重新读取人设' }));
    await waitFor(() => expect(currentName()).toBe('阿夏'));
    expect(f.choices).toEqual([{ ref: { id: f.second.id, version: 1 }, persona: { name: '阿夏', description: '旧城书店店主', avatarPath: 'persona/avatar.png' } }]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['resolve', 'reject'] as const)('先选人设的迟到%s不会覆盖新选择或让父保存重新锁住', async ending => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    const readVersion = async (ref: MaterialVersionRef) => ref.id === f.first.id ? slow.promise : f.library.readVersion(ref);
    render(<Parent props={{ ...f.props, readVersion }} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await user.selectOptions(picker(), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    await waitFor(() => expect(currentName()).toBe('阿夏'));
    await user.type(screen.getByRole('textbox', { name: '当前设定' }), '，今日等信');
    await act(async () => {
      if (ending === 'resolve') slow.resolve(f.library.readVersion({ id: f.first.id, version: 1 })); else slow.reject(new Error('上一份人设读取失败'));
      await Promise.resolve();
    });
    expect(currentName()).toBe('阿夏');
    expect((screen.getByRole('textbox', { name: '当前设定' }) as HTMLTextAreaElement).value).toBe('旧城书店店主，今日等信');
    expect(f.choices).toHaveLength(1); expect(f.choices[0]?.ref).toEqual({ id: f.second.id, version: 1 });
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('等待身份期间选回手填立即解锁保存，迟到身份不再通知父层', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    render(<Parent props={{ ...f.props, readVersion: () => slow.promise }} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await user.selectOptions(picker(), screen.getByRole('option', { name: '手动填写' }));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { slow.resolve(f.library.readVersion({ id: f.first.id, version: 1 })); await Promise.resolve(); });
    expect(selectedName()).toBe('手动填写'); expect(currentName()).toBe('会话里的称呼');
    expect(f.choices).toEqual([{ ref: undefined, persona: undefined }]);
  });

  it('等待新选择时选回当前旧版会取消回填，保持原会话手调与头像', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    const readVersion = async (ref: MaterialVersionRef) => ref.id === f.second.id ? slow.promise : f.library.readVersion(ref);
    render(<Parent props={{ ...f.props, readVersion, value: { id: f.first.id, version: 1 } }} />);
    await screen.findByRole('img', { name: '我的人设头像' });
    await user.selectOptions(picker(), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(true);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { slow.resolve(f.library.readVersion({ id: f.second.id, version: 1 })); await Promise.resolve(); });
    expect(selectedName()).toBe('小雨 · 版本 1'); expect(currentName()).toBe('会话里的称呼');
    expect(screen.getByRole('img', { name: '我的人设头像' }).getAttribute('src')).toBe(`data:image/png;base64,${firstAvatar}`);
    expect(f.choices).toEqual([]);
  });

  it('父层切换到另一段对话的明确版本后，旧选择结果不能再回填', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    const props = { ...f.props, readVersion: async (ref: MaterialVersionRef) => ref.id === f.first.id ? slow.promise : f.library.readVersion(ref) };
    const view = render(<PersonaPicker {...props} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    view.rerender(<PersonaPicker {...props} value={{ id: f.second.id, version: 1 }} />);
    await waitFor(() => expect(selectedName()).toBe('阿夏 · 版本 1'));
    await act(async () => { slow.resolve(f.library.readVersion({ id: f.first.id, version: 1 })); await Promise.resolve(); });
    expect(selectedName()).toBe('阿夏 · 版本 1'); expect(f.choices).toEqual([]);
    expect((await screen.findByRole('img', { name: '我的人设头像' })).getAttribute('src')).toBe(`data:image/png;base64,${secondAvatar}`);
  });

  it('头像只取精确本地路径，前一次迟到头像不覆盖新身份', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<PortableResource[]>();
    const readResources = async (ref: MaterialVersionRef) => ref.id === f.first.id ? slow.promise : [
      { path: 'https://example.invalid/avatar.png', mediaType: 'image/png', base64: firstAvatar }, ...resources(f.library, ref),
    ];
    render(<Parent props={{ ...f.props, readResources }} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect(currentName()).toBe('小雨'));
    await user.selectOptions(picker(), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    expect((await screen.findByRole('img', { name: '我的人设头像' })).getAttribute('src')).toBe(`data:image/png;base64,${secondAvatar}`);
    await act(async () => { slow.resolve(resources(f.library, { id: f.first.id, version: 1 })); await Promise.resolve(); });
    expect(screen.getByRole('img', { name: '我的人设头像' }).getAttribute('src')).toBe(`data:image/png;base64,${secondAvatar}`);
    expect(f.choices.map(choice => choice.ref)).toEqual([{ id: f.first.id, version: 1 }, { id: f.second.id, version: 1 }]);
  });

  it.each(['throw', 'reject'] as const)('本地头像读取%s仍保留文字身份与首字，不阻塞父保存', async ending => {
    const f = fixture(), user = userEvent.setup();
    const readResources: NonNullable<PersonaPickerProps['readResources']> = () => {
      if (ending === 'throw') throw new Error('头像未能读取'); return Promise.reject(new Error('头像未能读取'));
    };
    render(<Parent props={{ ...f.props, readResources }} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect(currentName()).toBe('小雨'));
    expect(screen.queryByRole('img', { name: '我的人设头像' })).toBeNull();
    expect(within(picker().closest('.tk-start-persona')!).getByText('小', { exact: true })).toBeTruthy();
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull(); expect(f.choices).toHaveLength(1);
  });

  it('选择区卸载解除父保存的等待状态，未结束的读取不再提交', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    render(<Parent props={{ ...f.props, readVersion: () => slow.promise }} />);
    await user.selectOptions(picker(), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '离开选择区' }));
    expect((screen.getByRole('button', { name: '保存对话' }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { slow.resolve(f.library.readVersion({ id: f.first.id, version: 1 })); await Promise.resolve(); });
    expect(f.choices).toEqual([]); expect(currentName()).toBe('会话里的称呼');
  });
});
