// @vitest-environment jsdom
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ActionMenu, ChatDialog } from './ChatChrome.js';

afterEach(cleanup);

describe('菜单与原生对话框的即时操作回退', () => {
  it('菜单键盘打开后 Escape 即时关闭，焦点回到触发器且不会执行选项', async () => {
    const actions: string[] = [], user = userEvent.setup();
    render(<ActionMenu><button type="button" onClick={() => actions.push('backup')}>完整备份</button></ActionMenu>);
    const trigger = screen.getByRole('button', { name: '更多操作' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: '完整备份' });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    await user.tab();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: '完整备份' })).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(actions).toEqual([]);
  });

  it('菜单快速关开和原生 toggle 的旧事件不能把新一次打开关闭', async () => {
    const user = userEvent.setup();
    render(<ActionMenu><button type="button">剧情备忘</button></ActionMenu>);
    const trigger = screen.getByRole('button', { name: '更多操作' });
    await user.click(trigger);
    await screen.findByRole('button', { name: '剧情备忘' });
    fireEvent.keyDown(trigger, { key: 'Escape' });
    fireEvent.click(trigger, { detail: 1 });
    await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: '剧情备忘' })).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('button', { name: '剧情备忘' })).toBeNull();
  });

  it('点击菜单选项仅执行一次，外部指针关闭不抢走外部任务焦点', async () => {
    const actions: string[] = [], user = userEvent.setup();
    render(<><ActionMenu><button type="button" onClick={() => actions.push('memo')}>剧情备忘</button></ActionMenu><button type="button">聊天输入</button></>);
    const trigger = screen.getByRole('button', { name: '更多操作' });
    await user.click(trigger);
    await user.click(await screen.findByRole('button', { name: '剧情备忘' }));
    expect(actions).toEqual(['memo']);
    await waitFor(() => expect(screen.queryByRole('button', { name: '剧情备忘' })).toBeNull());
    await user.click(trigger);
    await screen.findByRole('button', { name: '剧情备忘' });
    const outside = screen.getByRole('button', { name: '聊天输入' });
    await user.click(outside);
    await waitFor(() => expect(screen.queryByRole('button', { name: '剧情备忘' })).toBeNull());
    expect(document.activeElement).toBe(outside);
    expect(actions).toEqual(['memo']);
  });

  it('没有动画能力时立即释放 dialog 的 open 状态，重复关闭只通知一次并恢复触发焦点', () => {
    const closed: string[] = [], trigger = document.createElement('button');
    trigger.textContent = '打开设定'; document.body.append(trigger); trigger.focus();
    try {
      render(<ChatDialog label="对话设定" onClose={() => closed.push('closed')}><input aria-label="称呼" defaultValue="小雨" /></ChatDialog>);
      const element = screen.getByRole('dialog', { name: '对话设定' }) as HTMLDialogElement;
      expect(element.open).toBe(true);
      const close = within(element).getByRole('button', { name: '关闭对话设定' });
      fireEvent.click(close, { detail: 1 });
      fireEvent(element, new Event('cancel', { cancelable: true }));
      fireEvent.click(close);
      expect(closed).toEqual(['closed']);
      expect(element.open).toBe(false);
      expect(document.activeElement).toBe(trigger);
    } finally { trigger.remove(); }
  });

  it('原生 cancel 立即关闭，重开后错误与草稿更新不重新挂载表单', async () => {
    const user = userEvent.setup(), closed: string[] = [];
    function Example() {
      const [open, setOpen] = useState(false), [error, setError] = useState('');
      return <><button type="button" onClick={() => setOpen(true)}>设定入口</button>{open && <ChatDialog label="对话设定" onClose={() => { closed.push('closed'); setOpen(false); }} error={error} onDismissError={() => setError('')}><label>称呼<input aria-label="称呼" defaultValue="小雨" /></label><button type="button" onClick={() => setError('保存失败，文字还在')}>保存设定</button></ChatDialog>}</>;
    }
    render(<Example />);
    const trigger = screen.getByRole('button', { name: '设定入口' });
    await user.click(trigger);
    const first = screen.getByRole('dialog', { name: '对话设定' });
    fireEvent(first, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(closed).toEqual(['closed']); expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    const reopened = screen.getByRole('dialog', { name: '对话设定' }), field = screen.getByRole('textbox', { name: '称呼' }) as HTMLInputElement;
    await user.type(field, '，保留这段');
    await user.click(screen.getByRole('button', { name: '保存设定' }));
    expect(screen.getByRole('dialog')).toBe(reopened);
    expect(within(reopened).getByRole('alert').textContent).toContain('保存失败');
    expect(screen.getByRole('textbox', { name: '称呼' })).toBe(field); expect(field.value).toBe('小雨，保留这段');
    await user.click(screen.getByRole('button', { name: '收起错误' }));
    expect(within(reopened).queryByRole('alert')).toBeNull(); expect(field.value).toBe('小雨，保留这段');
  });

  it('原生 close 的迟到事件不关闭仍处于 open 的新一次弹层', () => {
    const closed: string[] = [];
    render(<ChatDialog label="重新打开的设定" onClose={() => closed.push('closed')}>新草稿</ChatDialog>);
    const element = screen.getByRole('dialog') as HTMLDialogElement;
    // Native close events are queued, including during effect cleanup/re-setup.
    fireEvent(element, new Event('close'));
    expect(element.open).toBe(true);
    expect(closed).toEqual([]);
    fireEvent.keyDown(element, { key: 'Escape' });
    expect(element.open).toBe(false);
    expect(closed).toEqual(['closed']);
  });

  it('卸载关闭原生弹层而不回调业务，原节点的迟到事件不会影响新弹层', () => {
    const closed: string[] = [];
    const first = render(<ChatDialog label="旧设定" onClose={() => closed.push('old')}>旧草稿</ChatDialog>);
    const old = screen.getByRole('dialog') as HTMLDialogElement;
    first.unmount();
    expect(old.open).toBe(false);
    render(<ChatDialog label="新设定" onClose={() => closed.push('new')}>新草稿</ChatDialog>);
    fireEvent(old, new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { name: '新设定' })).toBeTruthy(); expect(closed).toEqual([]);
  });
});
