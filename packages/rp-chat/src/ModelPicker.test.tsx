// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ConnectionView, Route } from '@tavern-kit/rp-connections/types';
import { ModelPicker, type ModelPickerProps } from './ModelPicker.js';

afterEach(cleanup);
const connections: ConnectionView[] = [
  {
    id: 'connection-one', provider: 'relay-one', name: '海边书店', credentialConfigured: true, active: true,
    models: [{ id: '[常用]vendor/model-A', name: '长聊 A' }, { id: '[轻快]vendor/model-B/raw', name: '轻快 B' }],
    preference: { inputBudget: 18000, group: '日常分组' },
  },
  {
    id: 'connection-two', provider: 'relay-two/raw', name: '雨夜来信', credentialConfigured: true, active: true,
    models: [{ id: '[薄甲]model/one', name: '故事长聊' }, { id: 'vendor/small', name: '轻量模型' }],
    preference: { inputBudget: 24000, group: '独立业务组' },
  },
];
const current: Route = {
  provider: 'relay-one', model: '[常用]vendor/model-A', connectionId: 'connection-one',
  label: '海边书店 · 长聊 A', inputBudget: 18000, group: '日常分组', contextWindow: 32000,
  outputLimit: 4096, parameters: { temperature: true, stop: false, reasoning: true },
};
function fixture(overrides: Partial<ModelPickerProps> = {}) {
  const selections: Route[] = [], management: string[] = [];
  const props: ModelPickerProps = {
    connections, value: current, onSelect: async route => { selections.push(route); },
    onManage: () => { management.push('connections'); }, ...overrides,
  };
  return { props, selections, management };
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('聊天模型切换器', () => {
  it('默认同时显示连接和模型，打开与切换连接只供浏览而不提交模型', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<ModelPicker {...f.props} />);
    const trigger = screen.getByRole('button', { name: '切换模型' });
    expect(trigger.textContent).toContain('海边书店');
    expect(trigger.textContent).toContain('长聊 A');
    expect(trigger.title).toContain('[常用]vendor/model-A');
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '切换模型' });
    expect(within(dialog).getByRole('button', { name: /使用 长聊 A/ }).getAttribute('aria-pressed')).toBe('true');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '服务商' }), 'relay-two/raw');
    expect(within(dialog).getByRole('button', { name: /使用 故事长聊/ })).toBeTruthy();
    expect(f.selections).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: '关闭切换模型' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger.textContent).toContain('长聊 A');
    expect(f.selections).toEqual([]);
  });

  it('只在选择具体模型时原样提交路由，等待保存成功后关闭', async () => {
    const pending = deferred(), f = fixture(), user = userEvent.setup();
    const onSelect = async (route: Route) => { f.selections.push(route); await pending.promise; };
    render(<ModelPicker {...f.props} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    const dialog = screen.getByRole('dialog', { name: '切换模型' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '服务商' }), 'relay-two/raw');
    await user.type(within(dialog).getByRole('searchbox', { name: '搜索模型' }), '薄甲');
    expect(within(dialog).queryByRole('button', { name: /使用 轻量模型/ })).toBeNull();
    await user.click(within(dialog).getByRole('button', { name: /使用 故事长聊/ }));
    expect(f.selections).toEqual([{
      provider: 'relay-two/raw', model: '[薄甲]model/one', connectionId: 'connection-two',
      label: '雨夜来信 · 故事长聊', group: '独立业务组', inputBudget: 24000,
    }]);
    expect(screen.getByRole('dialog', { name: '切换模型' })).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: /使用 故事长聊/ }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { pending.resolve(); await pending.promise; });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('切换失败在自己的弹层反馈，保留连接和过滤条件并可原样重试', async () => {
    const f = fixture(), user = userEvent.setup(); let rejected = false;
    const onSelect = async (route: Route) => {
      f.selections.push(route);
      if (!rejected) { rejected = true; throw new Error('这条连接暂时没有通过验证'); }
    };
    render(<ModelPicker {...f.props} onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    const dialog = screen.getByRole('dialog', { name: '切换模型' });
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '服务商' }), 'relay-two/raw');
    await user.type(within(dialog).getByRole('searchbox', { name: '搜索模型' }), '故事');
    await user.click(within(dialog).getByRole('button', { name: /使用 故事长聊/ }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain('这条连接暂时没有通过验证');
    expect((within(dialog).getByRole('combobox', { name: '服务商' }) as HTMLSelectElement).value).toBe('relay-two/raw');
    expect((within(dialog).getByRole('searchbox', { name: '搜索模型' }) as HTMLInputElement).value).toBe('故事');
    expect(screen.getByRole('button', { name: '切换模型' }).textContent).toContain('长聊 A');
    await user.click(within(dialog).getByRole('button', { name: /使用 故事长聊/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(f.selections.map(route => [route.provider, route.model])).toEqual([
      ['relay-two/raw', '[薄甲]model/one'], ['relay-two/raw', '[薄甲]model/one'],
    ]);
  });

  it('刷新列表移除当前ID后仍能查看并重选，原配置中的容量与参数不丢失', async () => {
    const f = fixture(), user = userEvent.setup();
    const view = render(<ModelPicker {...f.props} />);
    view.rerender(<ModelPicker {...f.props} connections={[{ ...connections[0]!, models: [{ id: 'new-model', name: '新模型' }] }, connections[1]!]} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    const dialog = screen.getByRole('dialog', { name: '切换模型' });
    expect(within(dialog).getByText('[常用]vendor/model-A')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: /使用 长聊 A/ }));
    expect(f.selections).toEqual([{
      provider: 'relay-one', model: '[常用]vendor/model-A', connectionId: 'connection-one',
      label: '海边书店 · 长聊 A', inputBudget: 18000, group: '日常分组', contextWindow: 32000,
      outputLimit: 4096, parameters: { temperature: true, stop: false, reasoning: true },
    }]);
  });

  it('当前连接不在新列表中仍保留当前配置，不擅自切到第一条连接', async () => {
    const f = fixture({ connections: [connections[1]!] }), user = userEvent.setup();
    render(<ModelPicker {...f.props} />);
    const trigger = screen.getByRole('button', { name: '切换模型' });
    expect(trigger.textContent).toContain('relay-one');
    expect(trigger.textContent).toContain('长聊 A');
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '切换模型' });
    expect((within(dialog).getByRole('combobox', { name: '服务商' }) as HTMLSelectElement).value).toBe('relay-one');
    expect(within(dialog).getByRole('button', { name: /使用 长聊 A/ })).toBeTruthy();
    expect(f.selections).toEqual([]);
  });

  it('没有模型或搜索无结果时只提供连接管理，不自动选择其他模型', async () => {
    const f = fixture({ connections: [{ ...connections[0]!, models: [] }], value: undefined }), user = userEvent.setup();
    const view = render(<ModelPicker {...f.props} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    expect(screen.getByText('这条连接还没有模型')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '管理模型连接' }));
    expect(f.management).toEqual(['connections']);
    expect(f.selections).toEqual([]);
    view.rerender(<ModelPicker {...f.props} connections={connections} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索模型' }), '没有这个模型');
    expect(screen.getByText('没有找到匹配的模型')).toBeTruthy();
    expect(f.selections).toEqual([]);
  });

  it('没有连接时直接打开连接管理，禁用时不打开也不提交', async () => {
    const f = fixture({ connections: [], value: undefined }), user = userEvent.setup();
    const view = render(<ModelPicker {...f.props} disabled />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(f.management).toEqual([]);
    view.rerender(<ModelPicker {...f.props} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    expect(f.management).toEqual(['connections']);
    expect(f.selections).toEqual([]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('在聊天输入表单内搜索并回车不会提交聊天，也不会选中首个结果', async () => {
    const f = fixture(), user = userEvent.setup(), sent: string[] = [];
    render(<form onSubmit={event => { event.preventDefault(); sent.push('send'); }}><ModelPicker {...f.props} /><button type="submit">发送聊天</button></form>);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索模型' }), 'B/raw{Enter}');
    expect(sent).toEqual([]);
    expect(f.selections).toEqual([]);
    expect(screen.getByRole('dialog', { name: '切换模型' })).toBeTruthy();
  });

  it('原生取消关闭弹层，浏览中的模型与过滤不被当成选择提交', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<ModelPicker {...f.props} />);
    await user.click(screen.getByRole('button', { name: '切换模型' }));
    const dialog = screen.getByRole('dialog', { name: '切换模型' });
    await user.type(within(dialog).getByRole('searchbox', { name: '搜索模型' }), 'B/raw');
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(f.selections).toEqual([]);
  });
});
