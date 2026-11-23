// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MaterialsLibrary } from '@tavern-kit/rp-materials/library';
import type { MaterialRecord, MaterialVersion, MaterialVersionRef, PortableResource } from '@tavern-kit/rp-materials/types';
import type { Route } from '@tavern-kit/rp-connections/types';
import type { CreateInput } from './protocol.js';
import { StartConversationForm, type StartConversationFormProps } from './StartConversationForm.js';

const libraries: MaterialsLibrary[] = [];
afterEach(() => { cleanup(); for (const library of libraries.splice(0)) library.close(); });
const route: Route = {
  provider: 'local-relay', model: '[故事]chat/long', connectionId: 'my-connection', label: '我的连接 · 长聊',
  group: '常用分组', inputBudget: 24000, contextWindow: 32000, outputLimit: 4096,
  parameters: { temperature: true, reasoning: false },
};
function card(library: MaterialsLibrary, name: string): MaterialRecord {
  return library.import({ name: `${name}.json`, bytes: Uint8Array.from(new TextEncoder().encode(JSON.stringify({
    spec: 'chara_card_v3', spec_version: '3.0', data: {
      name, description: '在旧城经营书店', personality: '温和', scenario: '雨夜的书店',
      first_mes: '{{char}}把信递给{{user}}。', alternate_greetings: ['{{char}}等{{user}}一起看海。', '{{char}}为{{user}}留了一盏灯。'],
    },
  }))) });
}
const avatarImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const alternateAvatar = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function persona(library: MaterialsLibrary, name: string, description: string, avatar?: string): MaterialRecord {
  return library.import({ name: `${name}人设.json`, bytes: Uint8Array.from(new TextEncoder().encode(JSON.stringify({
    format: 'tavern-kit.persona', version: 1, name, description,
    ...(avatar ? { avatar: { name: '头像.png', mediaType: 'image/png', base64: avatar } } : {}),
  }))) });
}
function localResources(library: MaterialsLibrary, ref: MaterialVersionRef): PortableResource[] {
  return library.resources(ref).map(value => ({ path: value.path, mediaType: value.mediaType, base64: Buffer.from(value.bytes).toString('base64') }));
}
function fixture(overrides: Partial<StartConversationFormProps> = {}) {
  const library = new MaterialsLibrary(':memory:'); libraries.push(library);
  const first = card(library, '阿岚'), second = card(library, '阿照');
  const submitted: CreateInput[] = [];
  const props: StartConversationFormProps = {
    materials: library.list(), routes: [route], readVersion: async ref => library.readVersion(ref),
    onCreate: async input => { submitted.push(input); }, onNavigate: () => {}, ...overrides,
  };
  return { library, first, second, submitted, props };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe('新建对话与真实本地角色版本', () => {
  it('将选择的备选首句、称呼与玩家设定交给现有创建契约，完整保留路由', async () => {
    const f = fixture(), user = userEvent.setup();
    f.library.revise(f.first.id, { patch: { data: { alternate_greetings: ['{{char}}邀请{{user}}去海边书店。', '{{char}}为{{user}}留了一盏灯。'] } } });
    render(<StartConversationForm {...f.props} materials={f.library.list()} initialCharacterId={f.first.id} />);
    await screen.findByText('阿岚把信递给我。');
    await user.type(screen.getByRole('textbox', { name: '对话名字' }), '海边的约定');
    await user.clear(screen.getByRole('textbox', { name: '你的称呼' }));
    await user.type(screen.getByRole('textbox', { name: '你的称呼' }), '小夏');
    await user.type(screen.getByRole('textbox', { name: '玩家设定' }), '旧城书店的常客，喜欢海风。');
    await user.click(screen.getByRole('button', { name: '下一个首句' }));
    expect(screen.getByText('阿岚邀请小夏去海边书店。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '下一个首句' }));
    expect(screen.getByText('阿岚为小夏留了一盏灯。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '上一个首句' }));
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted).toEqual([{
      title: '海边的约定', bindings: [{ id: f.first.id, version: 2 }], greetingIndex: 1,
      settings: { playerName: '小夏', playerDescription: '旧城书店的常客，喜欢海风。', mainRoute: {
        provider: 'local-relay', model: '[故事]chat/long', connectionId: 'my-connection', label: '我的连接 · 长聊',
        group: '常用分组', inputBudget: 24000, contextWindow: 32000, outputLimit: 4096,
        parameters: { temperature: true, reasoning: false },
      } },
    }]);
    expect(f.library.readVersion({ id: f.first.id, version: 1 }).projection.character?.alternateGreetings[0]).toBe('{{char}}等{{user}}一起看海。');
  });

  it('切换角色重置为新角色的默认首句，保留已填写的玩家身份', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<StartConversationForm {...f.props} initialCharacterId={f.first.id} />);
    await screen.findByText('阿岚把信递给我。');
    await user.click(screen.getByRole('button', { name: '下一个首句' }));
    await user.clear(screen.getByRole('textbox', { name: '你的称呼' }));
    await user.type(screen.getByRole('textbox', { name: '你的称呼' }), '阿宁');
    await user.selectOptions(screen.getByRole('combobox', { name: '带上角色' }), f.second.id);
    await screen.findByText('阿照把信递给阿宁。');
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ title: '阿照', bindings: [{ id: f.second.id, version: 1 }], greetingIndex: 0, settings: { playerName: '阿宁' } });
  });

  it('默认不带角色和模型时也可先建立对话，称呼使用现有默认值', async () => {
    const f = fixture({ routes: [] }), user = userEvent.setup();
    render(<StartConversationForm {...f.props} />);
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted).toEqual([{ title: '新的对话', bindings: [], settings: { playerName: '我', playerDescription: '' } }]);
  });

  it.each(['resolve', 'reject'] as const)('旧角色读取迟到（%s）不会覆盖已选的新角色及首句', async ending => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    const readVersion = async (ref: MaterialVersionRef) => ref.id === f.first.id ? slow.promise : f.library.readVersion(ref);
    render(<StartConversationForm {...f.props} readVersion={readVersion} initialCharacterId={f.first.id} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '带上角色' }), f.second.id);
    await screen.findByText('阿照把信递给我。');
    await user.click(screen.getByRole('button', { name: '下一个首句' }));
    await act(async () => {
      if (ending === 'resolve') slow.resolve(f.library.readVersion({ id: f.first.id, version: 1 }));
      else slow.reject(new Error('旧角色读取失败'));
      await Promise.resolve();
    });
    expect(screen.getByText('阿照等我一起看海。')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: f.second.id, version: 1 }], greetingIndex: 1 });
  });

  it('读取角色失败时提示重试并阻止漏掉首句的创建，重试后保留草稿', async () => {
    const f = fixture(), user = userEvent.setup(); let firstRead = true;
    const readVersion = async (ref: MaterialVersionRef) => {
      if (firstRead) { firstRead = false; throw new Error('这份角色暂时未能读取'); }
      return f.library.readVersion(ref);
    };
    render(<StartConversationForm {...f.props} readVersion={readVersion} initialCharacterId={f.first.id} />);
    expect((await screen.findByRole('alert')).textContent).toContain('这份角色暂时未能读取');
    await user.type(screen.getByRole('textbox', { name: '玩家设定' }), '第一次拜访书店');
    expect((screen.getByRole('button', { name: '开始聊天' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted).toEqual([]);
    await user.click(screen.getByRole('button', { name: '重新读取角色' }));
    await screen.findByText('阿岚把信递给我。');
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ greetingIndex: 0, settings: { playerDescription: '第一次拜访书店' } });
  });

  it('创建失败保留首句和表单草稿，修正后仍按原选择提交', async () => {
    const f = fixture(), user = userEvent.setup(); let rejected = false;
    const onCreate = async (input: CreateInput) => { if (!rejected) { rejected = true; throw new Error('连接暂时不可用'); } f.submitted.push(input); };
    render(<StartConversationForm {...f.props} onCreate={onCreate} initialCharacterId={f.first.id} />);
    await screen.findByText('阿岚把信递给我。');
    await user.type(screen.getByRole('textbox', { name: '对话名字' }), '雨夜见面');
    await user.click(screen.getByRole('button', { name: '下一个首句' }));
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect((await screen.findByRole('alert')).textContent).toContain('连接暂时不可用');
    expect((screen.getByRole('textbox', { name: '对话名字' }) as HTMLInputElement).value).toBe('雨夜见面');
    expect(screen.getByText('阿岚等我一起看海。')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    await waitFor(() => expect(f.submitted).toHaveLength(1));
    expect(f.submitted[0]).toMatchObject({ title: '雨夜见面', greetingIndex: 1 });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('新建对话选用我的人设', () => {
  it('选中明确人设版本后填入身份，局部手调与首句选择一起创建而不改人设库', async () => {
    const f = fixture(), user = userEvent.setup();
    const saved = persona(f.library, '小雨', '海边来的旅人', avatarImage);
    const before = f.library.readVersion({ id: saved.id, version: 1 });
    render(<StartConversationForm {...f.props} materials={f.library.list()} initialCharacterId={f.first.id} readResources={async ref => localResources(f.library, ref)} />);
    await screen.findByText('阿岚把信递给我。');
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('小雨'));
    expect((screen.getByRole('textbox', { name: '玩家设定' }) as HTMLTextAreaElement).value).toBe('海边来的旅人');
    expect((await screen.findByRole('img', { name: '我的人设头像' })).getAttribute('src')).toBe(`data:image/png;base64,${avatarImage}`);
    await user.click(screen.getByRole('button', { name: '下一个首句' }));
    expect(screen.getByText('阿岚等小雨一起看海。')).toBeTruthy();
    await user.clear(screen.getByRole('textbox', { name: '你的称呼' }));
    await user.type(screen.getByRole('textbox', { name: '你的称呼' }), '雨');
    await user.clear(screen.getByRole('textbox', { name: '玩家设定' }));
    await user.type(screen.getByRole('textbox', { name: '玩家设定' }), '今天来书店还信。');
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted).toEqual([{
      title: '阿岚', bindings: [{ id: f.first.id, version: 1 }, { id: saved.id, version: 1 }], greetingIndex: 1,
      settings: { playerName: '雨', playerDescription: '今天来书店还信。', mainRoute: route },
    }]);
    expect(f.library.readVersion({ id: saved.id, version: 1 })).toEqual(before);
    expect(f.library.get(saved.id).currentVersion).toBe(1);
  });

  it('无头像显示首字章，改回手填时不再绑定人设且管理入口沿用素材库', async () => {
    const f = fixture(), user = userEvent.setup(), destinations: string[] = [];
    const saved = persona(f.library, '阿夏', '旧城书店店主');
    render(<StartConversationForm {...f.props} materials={f.library.list()} onNavigate={destination => { destinations.push(destination); }} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('阿夏'));
    expect(within(screen.getByRole('region', { name: '玩家身份' })).getByText('阿', { exact: true })).toBeTruthy();
    expect(screen.queryByRole('img', { name: '我的人设头像' })).toBeNull();
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '手动填写' }));
    await user.clear(screen.getByRole('textbox', { name: '你的称呼' }));
    await user.type(screen.getByRole('textbox', { name: '你的称呼' }), '阿宁');
    await user.click(screen.getByRole('button', { name: '管理我的人设' }));
    expect(destinations).toEqual(['materials']);
    expect(f.submitted).toEqual([]);
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted).toEqual([{ title: '新的对话', bindings: [], settings: { playerName: '阿宁', playerDescription: '旧城书店店主', mainRoute: route } }]);
    expect(f.library.readVersion({ id: saved.id, version: 1 }).projection.persona?.name).toBe('阿夏');
  });

  it.each(['resolve', 'reject'] as const)('先前人设慢读取的%s不覆盖新选择和手调草稿', async ending => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    const first = persona(f.library, '小雨', '海边来的旅人'), second = persona(f.library, '阿夏', '旧城书店店主');
    const readVersion = async (ref: MaterialVersionRef) => ref.id === first.id ? slow.promise : f.library.readVersion(ref);
    render(<StartConversationForm {...f.props} materials={f.library.list()} readVersion={readVersion} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('阿夏'));
    await user.type(screen.getByRole('textbox', { name: '玩家设定' }), '，今天在等一封信');
    await act(async () => {
      if (ending === 'resolve') slow.resolve(f.library.readVersion({ id: first.id, version: 1 }));
      else slow.reject(new Error('先前人设读取失败'));
      await Promise.resolve();
    });
    expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('阿夏');
    expect((screen.getByRole('textbox', { name: '玩家设定' }) as HTMLTextAreaElement).value).toBe('旧城书店店主，今天在等一封信');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: second.id, version: 1 }], settings: { playerName: '阿夏', playerDescription: '旧城书店店主，今天在等一封信' } });
  });

  it('切换人设未读完时按钮与直接提交都不能带着旧身份创建', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<MaterialVersion>();
    const first = persona(f.library, '小雨', '海边来的旅人'), second = persona(f.library, '阿夏', '旧城书店店主');
    const readVersion = async (ref: MaterialVersionRef) => ref.id === second.id ? slow.promise : f.library.readVersion(ref);
    render(<StartConversationForm {...f.props} materials={f.library.list()} readVersion={readVersion} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('小雨'));
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    const create = screen.getByRole('button', { name: '开始聊天' });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    await user.click(create);
    fireEvent.submit(create.closest('form')!);
    expect(f.submitted).toEqual([]);
    await act(async () => { slow.resolve(f.library.readVersion({ id: second.id, version: 1 })); await Promise.resolve(); });
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('阿夏'));
    await user.click(create);
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: second.id, version: 1 }], settings: { playerName: '阿夏', playerDescription: '旧城书店店主' } });
    expect(first.currentVersion).toBe(1);
  });

  it('人设库出现新版不改当前身份，明确选择新版才换绑定与填充值', async () => {
    const f = fixture(), user = userEvent.setup();
    const saved = persona(f.library, '小雨', '海边来的旅人');
    const view = render(<StartConversationForm {...f.props} materials={f.library.list()} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('小雨'));
    await user.type(screen.getByRole('textbox', { name: '玩家设定' }), '，只在这段对话中使用');
    f.library.revise(saved.id, { patch: { name: '雨', description: '熟悉旧城的旅人' } });
    view.rerender(<StartConversationForm {...f.props} materials={f.library.list()} />);
    expect((screen.getByRole('textbox', { name: '玩家设定' }) as HTMLTextAreaElement).value).toBe('海边来的旅人，只在这段对话中使用');
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: saved.id, version: 1 }], settings: { playerName: '小雨', playerDescription: '海边来的旅人，只在这段对话中使用' } });
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 2' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('雨'));
    expect((screen.getByRole('textbox', { name: '玩家设定' }) as HTMLTextAreaElement).value).toBe('熟悉旧城的旅人');
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[1]).toMatchObject({ bindings: [{ id: saved.id, version: 2 }], settings: { playerName: '雨', playerDescription: '熟悉旧城的旅人' } });
  });

  it('人设读取失败保留手填草稿并阻止创建，重试后可按所选人设继续', async () => {
    const f = fixture(), user = userEvent.setup();
    const saved = persona(f.library, '小雨', '海边来的旅人'); let failed = false;
    const readVersion = async (ref: MaterialVersionRef) => {
      if (ref.id === saved.id && !failed) { failed = true; throw new Error('这份人设暂时读不到'); }
      return f.library.readVersion(ref);
    };
    render(<StartConversationForm {...f.props} materials={f.library.list()} readVersion={readVersion} />);
    await user.type(screen.getByRole('textbox', { name: '玩家设定' }), '尚未选用的手填身份');
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    expect((await screen.findByRole('alert')).textContent).toContain('这份人设暂时读不到');
    expect((screen.getByRole('textbox', { name: '玩家设定' }) as HTMLTextAreaElement).value).toBe('尚未选用的手填身份');
    expect((screen.getByRole('button', { name: '开始聊天' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '重新读取人设' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('小雨'));
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: saved.id, version: 1 }], settings: { playerName: '小雨', playerDescription: '海边来的旅人' } });
  });

  it.each(['throw', 'reject'] as const)('本地头像资源读取%s时仍显示身份首字并允许创建', async ending => {
    const f = fixture(), user = userEvent.setup();
    const saved = persona(f.library, '小雨', '海边来的旅人', avatarImage);
    const readResources: NonNullable<StartConversationFormProps['readResources']> = () => {
      if (ending === 'throw') throw new Error('本地头像暂时读不到');
      return Promise.reject(new Error('本地头像暂时读不到'));
    };
    render(<StartConversationForm {...f.props} materials={f.library.list()} readResources={readResources} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('小雨'));
    expect(within(screen.getByRole('region', { name: '玩家身份' })).getByText('小', { exact: true })).toBeTruthy();
    expect(screen.queryByRole('img', { name: '我的人设头像' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: saved.id, version: 1 }], settings: { playerName: '小雨', playerDescription: '海边来的旅人' } });
  });

  it('上一人设头像迟到也不覆盖新身份的本地头像', async () => {
    const f = fixture(), user = userEvent.setup(), slow = deferred<PortableResource[]>();
    const first = persona(f.library, '小雨', '海边来的旅人', avatarImage), second = persona(f.library, '阿夏', '旧城书店店主', alternateAvatar);
    const readResources = async (ref: MaterialVersionRef) => ref.id === first.id ? slow.promise : localResources(f.library, ref);
    render(<StartConversationForm {...f.props} materials={f.library.list()} readResources={readResources} />);
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '小雨 · 版本 1' }));
    await waitFor(() => expect((screen.getByRole('textbox', { name: '你的称呼' }) as HTMLInputElement).value).toBe('小雨'));
    await user.selectOptions(screen.getByRole('combobox', { name: '我的人设' }), screen.getByRole('option', { name: '阿夏 · 版本 1' }));
    expect((await screen.findByRole('img', { name: '我的人设头像' })).getAttribute('src')).toBe(`data:image/png;base64,${alternateAvatar}`);
    await act(async () => { slow.resolve(localResources(f.library, { id: first.id, version: 1 })); await Promise.resolve(); });
    expect(screen.getByRole('img', { name: '我的人设头像' }).getAttribute('src')).toBe(`data:image/png;base64,${alternateAvatar}`);
    await user.click(screen.getByRole('button', { name: '开始聊天' }));
    expect(f.submitted[0]).toMatchObject({ bindings: [{ id: second.id, version: 1 }], settings: { playerName: '阿夏' } });
  });
});
