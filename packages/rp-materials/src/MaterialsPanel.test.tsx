// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialsLibrary } from './store.js';
import type { FileResult } from './host.js';
import type { JsonValue, MaterialRecord } from './types.js';
import { MaterialsPanel, type MaterialsPanelApi } from './MaterialsPanel.js';

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const card = {
  spec: 'chara_card_v3', spec_version: '3.0', vendorEnvelope: { keep: true },
  data: { name: '阿岚', description: '旧城药师', first_mes: '你回来了。', avatar: 'https://invalid.example/avatar.png', extensions: { authorTool: { keep: '原文' } } },
};
const opened: MaterialsLibrary[] = [];
const fileResult = (file: { name: string; mediaType: string; bytes: Uint8Array }): FileResult => ({
  name: file.name, mediaType: file.mediaType, base64: Buffer.from(file.bytes).toString('base64'),
});
function setup() {
  const library = new MaterialsLibrary(':memory:');
  opened.push(library);
  const downloads: FileResult[] = [];
  const api: MaterialsPanelApi = {
    location: () => '/本地主机/酒馆素材',
    createPersona: draft => library.createPersona(draft), revisePersona: (id, draft) => library.revisePersona(id, draft),
    list: query => library.list(query), get: id => library.get(id),
    versions: id => library.versions(id), readVersion: ref => library.readVersion(ref),
    revise: (id, revision) => library.revise(id, revision),
    metadata: (id, patch) => library.updateMetadata(id, patch), copy: id => library.copy(id),
    delete: id => library.delete(id),
    exportOriginal: id => fileResult(library.exportOriginal(id)),
    exportCurrent: id => fileResult(library.exportCurrent(id)),
    resources: ref => library.resources(ref).map(resource => ({ path: resource.path, mediaType: resource.mediaType, base64: Buffer.from(resource.bytes).toString('base64') })),
  };
  const upload = async (files: File[]) => {
    for (const file of files) {
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error('未读到文件'));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      });
      library.import({ name: file.name, bytes });
    }
  };
  const mount = (overrides: Partial<MaterialsPanelApi> = {}, onUpload = upload) => render(
    <MaterialsPanel api={{ ...api, ...overrides }} onUpload={onUpload} onDownload={file => { downloads.push(file); }} />,
  );
  const addCard = (): MaterialRecord => library.import({ name: '阿岚.json', bytes: encode(card) });
  return { library, api, downloads, mount, addCard };
}
async function open(name = '阿岚') {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `查看 ${name}` }));
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByRole('textbox', { name: '素材名称' });
  return { user, dialog };
}
async function setField(dialog: HTMLElement, user: ReturnType<typeof userEvent.setup>, field: string, value: string) {
  await user.selectOptions(within(dialog).getByRole('combobox', { name: '编辑字段' }), field);
  fireEvent.change(within(dialog).getByRole('textbox', { name: '字段内容' }), { target: { value } });
}
// SQLite returns Node typed arrays; keep the Host byte realm while the UI uses jsdom.
beforeEach(() => { vi.stubGlobal('Uint8Array', Object.getPrototypeOf(Buffer.prototype).constructor); });
afterEach(() => {
  cleanup();
  for (const library of opened.splice(0)) library.close();
  vi.unstubAllGlobals();
});

describe('independent offline material library panel', () => {
  it('imports each locally selected file and refreshes the visible library without an external request', async () => {
    const { library, mount } = setup();
    const fetch = vi.fn(() => { throw new Error('不应请求外网'); });
    vi.stubGlobal('fetch', fetch);
    mount();
    const user = userEvent.setup();
    const book = { name: '旧城', entries: [{ keys: ['雨'], content: '雨夜有约。' }] };
    await user.upload(screen.getByLabelText('导入本地素材'), [
      new File([JSON.stringify(card)], '阿岚.json', { type: 'application/json' }),
      new File([JSON.stringify(book)], '旧城.json', { type: 'application/json' }),
    ]);
    await screen.findByRole('button', { name: '查看 阿岚' });
    await screen.findByRole('button', { name: '查看 旧城' });
    expect(library.list()).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '存放位置' }));
    await screen.findByText('/本地主机/酒馆素材');
  });

  it('retains a partial-upload failure after refreshing successfully imported files', async () => {
    const { library, mount } = setup();
    mount();
    await userEvent.setup().upload(screen.getByLabelText('导入本地素材'), [
      new File([JSON.stringify(card)], '阿岚.json', { type: 'application/json' }),
      new File(['null'], '未识别.json', { type: 'application/json' }),
    ]);
    await screen.findByRole('button', { name: '查看 阿岚' });
    expect(library.list()).toHaveLength(1);
    expect((await screen.findByRole('alert')).textContent).toContain('没有识别到素材结构');
  });

  it('combines search, material kind, category and enabled filters and reflects a persisted toggle', async () => {
    const { library, mount, addCard } = setup();
    const character = addCard();
    library.updateMetadata(character.id, { category: '常玩', tags: ['雨夜'] });
    const second = library.import({ name: '小川.json', bytes: encode({ name: '小川', description: '灯塔守望者' }) });
    library.updateMetadata(second.id, { category: '收藏', enabled: false });
    library.import({ name: '世界书.json', bytes: encode({ name: '旧城', entries: [] }) });
    mount();
    const user = userEvent.setup();
    await screen.findByRole('button', { name: '查看 阿岚' });
    await user.click(screen.getByRole('button', { name: '角色卡' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '分类筛选' }), '常玩');
    await user.type(screen.getByRole('searchbox', { name: '搜索素材' }), '雨夜');
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '查看 小川' })).toBeNull();
      expect(screen.queryByRole('button', { name: '查看 旧城' })).toBeNull();
    });
    await user.click(screen.getByRole('switch', { name: '阿岚的启用状态' }));
    await waitFor(() => expect(library.get(character.id).enabled).toBe(false));
    await user.selectOptions(screen.getByRole('combobox', { name: '启用状态筛选' }), 'enabled');
    await waitFor(() => expect(screen.queryByRole('button', { name: '查看 阿岚' })).toBeNull());
    await user.selectOptions(screen.getByRole('combobox', { name: '启用状态筛选' }), 'disabled');
    expect((await screen.findByRole('switch', { name: '阿岚的启用状态' })).getAttribute('aria-checked')).toBe('false');
  });

  it('edits a selected historical version into a new version while retaining its unknown fields and original', async () => {
    const { library, mount, addCard } = setup();
    const character = addCard();
    library.revise(character.id, { patch: { data: { description: '新版药师', newerOnly: '不属于旧版' } } });
    mount();
    const { user, dialog } = await open();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '素材版本' }), '1');
    await setField(dialog, user, 'data.description', '雨夜回来等你的药师');
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(character.id).currentVersion).toBe(3));
    const edited = library.get(character.id).current;
    expect(edited.projection.character?.description).toBe('雨夜回来等你的药师');
    expect(edited.raw).toMatchObject({ vendorEnvelope: { keep: true }, data: { extensions: { authorTool: { keep: '原文' } } } });
    expect((edited.raw as { data: Record<string, JsonValue> }).data.newerOnly).toBeUndefined();
    expect(library.readVersion({ id: character.id, version: 2 }).projection.character?.description).toBe('新版药师');
    expect(library.exportOriginal(character.id).bytes).toEqual(encode(card));
  });

  it('keeps invalid JSON as an editable draft and saves full raw edits only after correction', async () => {
    const { library, mount, addCard } = setup();
    const character = addCard();
    mount();
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: '原始 JSON' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: '原始 JSON 内容' }), { target: { value: '{broken' } });
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await within(dialog).findByRole('alert');
    expect(library.get(character.id).currentVersion).toBe(1);
    expect(within(dialog).getByRole('textbox', { name: '原始 JSON 内容' })).toHaveProperty('value', '{broken');
    const raw = { ...card, futureVendor: { untouched: [1, true] }, data: { ...card.data, scenario: '桥边重逢' } };
    fireEvent.change(within(dialog).getByRole('textbox', { name: '原始 JSON 内容' }), { target: { value: JSON.stringify(raw) } });
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(character.id).currentVersion).toBe(2));
    expect(library.get(character.id).current.raw).toEqual(raw);
  });

  it('saves names and categories and binds a character to explicitly selected worldbook and preset versions', async () => {
    const { library, mount, addCard } = setup();
    const character = addCard();
    const book = library.import({ name: '世界书.json', bytes: encode({ name: '旧城', entries: [{ keys: ['雨'], content: '约定' }] }) });
    library.revise(book.id, { patch: { name: '旧城新版' } });
    const preset = library.import({ name: '预设.json', bytes: encode({ name: '温柔叙事', prompts: [{ identifier: 'main', content: '记住称呼' }] }) });
    mount();
    const { user, dialog } = await open();
    fireEvent.change(within(dialog).getByRole('textbox', { name: '素材名称' }), { target: { value: '雨夜的阿岚' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '素材分类' }), { target: { value: '常玩' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '素材标签' }), { target: { value: '古风，长聊' } });
    await user.click(within(dialog).getByRole('button', { name: '保存资料' }));
    await waitFor(() => expect(library.get(character.id)).toMatchObject({ name: '雨夜的阿岚', category: '常玩', tags: ['古风', '长聊'] }));
    await user.click(within(dialog).getByRole('checkbox', { name: '绑定世界书 旧城' }));
    const versionSelect = within(dialog).getByRole('combobox', { name: '旧城的版本' });
    await waitFor(() => expect(within(versionSelect).getByRole('option', { name: 'v1' })).toBeTruthy());
    await user.selectOptions(versionSelect, '1');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '绑定预设' }), preset.id);
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(character.id).current.bindings).toEqual({ worldbooks: [{ id: book.id, version: 1 }], preset: { id: preset.id, version: 1 } }));
    expect(library.readVersion({ id: character.id, version: 1 }).bindings).toEqual({ worldbooks: [], preset: null });
  });

  it('downloads byte-identical originals and current JSON, and separates used content from archived capabilities', async () => {
    const { library, mount, downloads, addCard } = setup();
    const character = addCard();
    library.revise(character.id, { patch: { data: { description: '新的描述' } } });
    mount();
    const { user, dialog } = await open();
    const used = within(dialog).getByRole('region', { name: '本次使用' });
    const archived = within(dialog).getByRole('region', { name: '原文件已保存' });
    expect(used.textContent).toContain('角色资料');
    expect(archived.textContent).toContain('扩展原文');
    await user.click(within(dialog).getByRole('button', { name: '导出原件' }));
    await user.click(within(dialog).getByRole('button', { name: '导出当前版本' }));
    await waitFor(() => expect(downloads).toHaveLength(2));
    expect(downloads[0]?.base64).toBe(Buffer.from(encode(card)).toString('base64'));
    expect(JSON.parse(Buffer.from(downloads[1]!.base64, 'base64').toString('utf8'))).toMatchObject({ spec: 'chara_card_v3', data: { description: '新的描述', extensions: { authorTool: { keep: '原文' } } } });
  });

  it('copies material independently and removes only the library entry after an explicit confirmation', async () => {
    const { library, mount, addCard } = setup();
    const character = addCard();
    mount();
    const { user, dialog } = await open();
    await user.click(within(dialog).getByRole('button', { name: '复制素材' }));
    await waitFor(() => expect(library.list()).toHaveLength(2));
    await screen.findByRole('button', { name: '查看 阿岚 副本' });
    const currentDialog = screen.getByRole('dialog');
    await user.click(within(currentDialog).getByRole('button', { name: '移出素材库' }));
    expect(library.list()).toHaveLength(2);
    await user.click(within(currentDialog).getByRole('button', { name: '确认移出' }));
    await waitFor(() => expect(library.list()).toHaveLength(1));
    expect(library.get(character.id).current.raw).toEqual(card);
    expect(library.readVersion({ id: character.id, version: 1 }).projection.character?.name).toBe('阿岚');
  });

  it.each(['embedded', 'embeded'])('previews only the chosen local bitmap for %s assets even when the card contains remote avatar addresses', async scheme => {
    const { library, mount } = setup();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
    const background = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const raw = { ...card, data: { ...card.data, assets: [{ type: 'icon', uri: `${scheme}://assets/main.png`, name: 'main', ext: 'png' }] } };
    library.import({ name: '阿岚.charx', bytes: Uint8Array.from(zipSync({ 'card.json': encode(raw), 'assets/a-scene.png': background, 'assets/main.png': png, 'assets/note.txt': encode('留下约定') })) });
    const fetch = vi.fn(() => { throw new Error('不应请求外网'); });
    vi.stubGlobal('fetch', fetch);
    mount();
    const { dialog } = await open();
    const avatar = await within(dialog).findByRole('img', { name: '阿岚的本地头像' });
    expect(avatar.getAttribute('src')).toBe(`data:image/png;base64,${png.toString('base64')}`);
    for (const image of within(dialog).getAllByRole('img')) expect(image.getAttribute('src')).toMatch(/^data:image\/(?:png|jpeg|webp|gif|avif);base64,/u);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports a failed metadata save without claiming success or discarding the editable values', async () => {
    const { library, mount, addCard } = setup();
    const character = addCard();
    mount({ metadata: () => { throw new Error('素材目录暂时不可写'); } });
    const { user, dialog } = await open();
    fireEvent.change(within(dialog).getByRole('textbox', { name: '素材名称' }), { target: { value: '我改好的名字' } });
    await user.click(within(dialog).getByRole('button', { name: '保存资料' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('素材目录暂时不可写');
    expect(within(dialog).getByRole('textbox', { name: '素材名称' })).toHaveProperty('value', '我改好的名字');
    expect(library.get(character.id).name).toBe('阿岚');
  });

  it('creates and edits a reusable persona with a local avatar while retaining the old version', async () => {
    const { library, mount } = setup(); mount();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '新建我的人设' }));
    const create = screen.getByRole('dialog', { name: '新建我的人设' });
    await user.type(within(create).getByRole('textbox', { name: '玩家昵称' }), '小雨');
    await user.type(within(create).getByRole('textbox', { name: '玩家设定' }), '海边来的旅人');
    await user.upload(within(create).getByLabelText('玩家头像'), new File([Uint8Array.from([137, 80, 78, 71])], '头像.png', { type: 'image/png' }));
    await user.click(within(create).getByRole('button', { name: '保存人设' }));
    await waitFor(() => expect(library.list({ kind: 'persona' })).toHaveLength(1));
    const item = library.list({ kind: 'persona' })[0]!;
    const dialog = await screen.findByRole('dialog', { name: '小雨 · 素材详情' });
    await within(dialog).findByRole('img', { name: '小雨的本地头像' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '玩家设定' }), { target: { value: '熟悉旧城的旅人' } });
    await user.click(within(dialog).getByRole('button', { name: '移除头像' }));
    expect(library.get(item.id).currentVersion).toBe(1);
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(item.id).currentVersion).toBe(2));
    expect(library.get(item.id).current.projection.persona).toEqual({ name: '小雨', description: '熟悉旧城的旅人' });
    expect(library.resources({ id: item.id, version: 2 })).toEqual([]);
    expect(library.resources({ id: item.id, version: 1 })).toHaveLength(1);
  });

  it('edits worldbook entries and supported trigger fields as a draft without dropping unknown data', async () => {
    const { library, mount } = setup();
    const raw = { name: '雨夜约定', token_budget: 120, vendor: '保留', entries: { '7': { uid: 7, key: ['雨'], keysecondary: ['桥'], content: '旧约定', disable: false, extensions: { position: 4, depth: 2, sticky: 3 }, authorFuture: true } } };
    const item = library.import({ name: '世界书.json', bytes: encode(raw) }); mount();
    const { user, dialog } = await open('雨夜约定');
    await within(dialog).findByRole('textbox', { name: '条目内容' });
    await user.clear(within(dialog).getByRole('textbox', { name: '主关键词' }));
    await user.type(within(dialog).getByRole('textbox', { name: '主关键词' }), '雨，重逢');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '条目内容' }), { target: { value: '在桥边等你' } });
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: '世界书预算' }), { target: { value: '200' } });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '插入位置' }), 'after');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '条目消息角色' }), 'assistant');
    expect(library.get(item.id).currentVersion).toBe(1);
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(item.id).currentVersion).toBe(2));
    expect(library.get(item.id).current.projection.worldbook).toMatchObject({ budget: 200, entries: [{ keys: ['雨', '重逢'], content: '在桥边等你', position: 'after', role: 'assistant' }] });
    expect(library.get(item.id).current.raw).toMatchObject({ vendor: '保留', entries: { '7': { authorFuture: true, extensions: { sticky: 3 } } } });
    expect(library.readVersion({ id: item.id, version: 1 }).raw).toEqual(raw);
  });

  it('edits preset role, depth and order through the typed form and keeps custom prompt fields', async () => {
    const { library, mount } = setup();
    const item = library.import({ name: '预设.json', bytes: encode({ name: '双段预设', future: '保留', prompts: [{ identifier: 'first', name: '第一段', role: 'system', content: '旧段落', vendor: true }, { identifier: 'second', name: '第二段', role: 'system', content: '第二段' }], prompt_order: [{ character_id: 100001, futureOrder: true, order: [{ identifier: 'first', enabled: true }, { identifier: 'second', enabled: true }] }] }) });
    mount(); const { user, dialog } = await open('双段预设');
    await within(dialog).findByRole('textbox', { name: '提示词内容' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '消息角色' }), 'assistant');
    fireEvent.change(within(dialog).getByRole('textbox', { name: '提示词内容' }), { target: { value: '新的叙事段落' } });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '提示词位置' }), 'depth');
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: '插入深度' }), { target: { value: '3' } });
    await user.click(within(dialog).getByRole('button', { name: '向下移动条目' }));
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(item.id).currentVersion).toBe(2));
    expect(library.get(item.id).current.projection.preset?.prompts.map(prompt => prompt.identifier)).toEqual(['second', 'first']);
    expect(library.get(item.id).current.projection.preset?.prompts[1]).toMatchObject({ role: 'assistant', content: '新的叙事段落', depth: 3, position: 'depth' });
    expect(library.get(item.id).current.raw).toMatchObject({ future: '保留', prompts: expect.arrayContaining([expect.objectContaining({ vendor: true })]), prompt_order: [{ futureOrder: true }] });
  });

  it('uses global bare patterns, numbered and named captures and trim rules in the local regex trial', async () => {
    const { library, mount } = setup();
    const item = library.import({ name: '捕获.json', bytes: encode([{ scriptName: '捕获', findRegex: '(?<who>\\[旅人\\])', replaceString: '{{match}}|$1|$<who>', trimStrings: ['[', ']'], placement: [2] }]) });
    mount(); const { user, dialog } = await open('捕获');
    fireEvent.change(await within(dialog).findByRole('textbox', { name: '试运行文本' }), { target: { value: '[旅人]，[旅人]' } });
    await user.click(within(dialog).getByRole('button', { name: '本地试运行' }));
    expect(within(dialog).getByRole('region', { name: '试运行结果' }).textContent).toContain('旅人|旅人|旅人，旅人|旅人|旅人');
    expect(within(dialog).getByRole('region', { name: '匹配内容' }).textContent).toContain('2');
    expect(library.get(item.id).currentVersion).toBe(1);
  });

  it('tries a regex locally, shows matches and errors, and saves scope only on an explicit revision', async () => {
    const { library, mount } = setup();
    const item = library.import({ name: '称呼.json', bytes: encode([{ id: 'call', scriptName: '称呼', findRegex: '/(旅人)/g', replaceString: '小雨', placement: [1, 2], markdownOnly: true, promptOnly: true, future: { keep: true } }]) });
    mount(); const { user, dialog } = await open('称呼');
    fireEvent.change(await within(dialog).findByRole('textbox', { name: '试运行文本' }), { target: { value: '旅人，旅人，回来了。' } });
    await user.click(within(dialog).getByRole('button', { name: '本地试运行' }));
    expect(within(dialog).getByRole('region', { name: '试运行结果' }).textContent).toContain('小雨，小雨，回来了。');
    expect(within(dialog).getByRole('region', { name: '匹配内容' }).textContent).toContain('2');
    expect(library.get(item.id).currentVersion).toBe(1);
    fireEvent.change(within(dialog).getByRole('textbox', { name: '查找正则' }), { target: { value: '/[/g' } });
    await user.click(within(dialog).getByRole('button', { name: '本地试运行' }));
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/正则/);
    fireEvent.change(within(dialog).getByRole('textbox', { name: '查找正则' }), { target: { value: '/(旅人)/g' } });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '作用范围' }), 'display');
    await user.click(within(dialog).getByRole('button', { name: '保存为新版本' }));
    await waitFor(() => expect(library.get(item.id).currentVersion).toBe(2));
    expect(library.get(item.id).current.projection.regex[0]).toMatchObject({ displayOnly: true, promptOnly: false });
    expect(library.get(item.id).current.raw).toMatchObject([{ future: { keep: true } }]);
    expect(library.readVersion({ id: item.id, version: 1 }).projection.regex[0]).toMatchObject({ displayOnly: false, promptOnly: false });
  });
});
