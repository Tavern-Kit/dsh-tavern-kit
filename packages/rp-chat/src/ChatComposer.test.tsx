// @vitest-environment jsdom
import React, { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { ChatComposer, type ChatComposerProps } from './ChatComposer.js';

afterEach(cleanup);

function props(overrides: Partial<ChatComposerProps> = {}): ChatComposerProps {
  return { value: '', onChange() {}, onSend() {}, onStop() {}, busy: false, generating: false, canSend: true, placeholder: '想对阿宁说些什么？', ...overrides };
}

function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox', { name: '想说的话' }) as HTMLTextAreaElement;
}

describe('同一聊天书写面的草稿、发送与停止', () => {
  it('StrictMode 中每字即时更新受控草稿，子操作不提交，也不在发送时自行清稿', async () => {
    const changed: string[] = [], actions: string[] = [], user = userEvent.setup();
    function Example() {
      const [value, setValue] = useState('');
      return <ChatComposer {...props({ value, onChange(next) { changed.push(next); setValue(next); }, onSend() { actions.push(`send:${value}`); }, onStop() { actions.push('stop'); } })}>
        <button type="button" onClick={() => actions.push('models')}>连接与模型</button><span>同时 2 条</span>
      </ChatComposer>;
    }
    render(<StrictMode><Example /></StrictMode>);
    const input = field(), form = input.closest('form')!;
    expect(input.rows).toBe(1); expect(input.placeholder).toBe('想对阿宁说些什么？');
    expect(form.getAttribute('data-phase')).toBe('idle');
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(input, '你好');
    expect(changed).toEqual(['你', '你好']); expect(input.value).toBe('你好');
    expect(form.getAttribute('data-phase')).toBe('draft');
    await user.click(screen.getByRole('button', { name: '连接与模型' }));
    expect(actions).toEqual(['models']); expect(input.value).toBe('你好');
    await user.click(screen.getByRole('button', { name: '发送' }));
    expect(actions).toEqual(['models', 'send:你好']); expect(changed).toEqual(['你', '你好']);
    expect(input.value).toBe('你好');
  });

  it.each(['', ' \n '])('生成中空白草稿 %j 只有明确点击停止，不把表单提交或快捷键当成停止', value => {
    const actions: string[] = [];
    render(<ChatComposer {...props({ value, generating: true, canSend: false, onSend: () => actions.push('send'), onStop: () => actions.push('stop') })} />);
    const input = field(), stop = screen.getByRole('button', { name: '停止生成' }) as HTMLButtonElement;
    expect(input.closest('form')?.getAttribute('data-phase')).toBe('streaming');
    expect(stop.getAttribute('data-mode')).toBe('stop'); expect(stop.type).toBe('button'); expect(stop.disabled).toBe(false);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    fireEvent.submit(input.closest('form')!);
    expect(actions).toEqual([]);
    fireEvent.click(stop); fireEvent.click(stop);
    expect(actions).toEqual(['stop', 'stop']); expect(input.value).toBe(value);
  });

  it('生成中有有效草稿仍发送下一句，canSend=false 时不会误停原候选', () => {
    const actions: string[] = [], value = '下一句原文 \n';
    const view = render(<ChatComposer {...props({ value, generating: true, onSend: () => actions.push('send'), onStop: () => actions.push('stop') })} />);
    const input = field(), send = screen.getByRole('button', { name: '发送' }) as HTMLButtonElement;
    expect(input.closest('form')?.getAttribute('data-phase')).toBe('draft');
    expect(send.getAttribute('data-mode')).toBe('send'); expect(send.disabled).toBe(false);
    fireEvent.click(send); expect(actions).toEqual(['send']); expect(input.value).toBe(value);
    view.rerender(<ChatComposer {...props({ value, generating: true, canSend: false, onSend: () => actions.push('send'), onStop: () => actions.push('stop') })} />);
    expect(send.disabled).toBe(true);
    fireEvent.submit(input.closest('form')!); fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true }); fireEvent.click(send);
    expect(actions).toEqual(['send']); expect(screen.queryByRole('button', { name: '停止生成' })).toBeNull();
  });

  it.each(['正在写的草稿', ''])('实际准备期 busy 禁止发送与停止，仍能即时编辑：%j', initialValue => {
    const actions: string[] = [], changes: string[] = [];
    function Example() {
      const [value, setValue] = useState(initialValue);
      return <ChatComposer {...props({ value, busy: true, generating: true, onChange(next) { changes.push(next); setValue(next); }, onSend: () => actions.push('send'), onStop: () => actions.push('stop') })} />;
    }
    render(<Example />);
    const input = field(), button = screen.getByRole('button', { name: '发送' }) as HTMLButtonElement;
    expect(input.closest('form')?.getAttribute('data-phase')).toBe('sending');
    expect(button.getAttribute('data-mode')).toBe('busy'); expect(button.disabled).toBe(true);
    fireEvent.click(button); fireEvent.submit(input.closest('form')!); fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(actions).toEqual([]); expect(input.disabled).toBe(false);
    fireEvent.change(input, { target: { value: '准备时也保留这句' } });
    expect(changes).toEqual(['准备时也保留这句']); expect(input.value).toBe('准备时也保留这句');
  });

  it('Ctrl／⌘+Enter 各只发送一次且不冒泡，普通 Enter 保持换行', () => {
    const actions: string[] = [], bubbled: string[] = [];
    render(<div onKeyDown={event => bubbled.push(event.key)} onSubmit={() => actions.push('outer-submit')}><ChatComposer {...props({ value: '这句发送', onSend: () => actions.push('send'), onStop: () => actions.push('stop') })} /></div>);
    const input = field();
    fireEvent.keyDown(input, { key: 'Enter' }); expect(actions).toEqual([]); expect(bubbled).toEqual(['Enter']);
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true });
    expect(actions).toEqual(['send', 'send']); expect(bubbled).toEqual(['Enter']);
    fireEvent.submit(input.closest('form')!);
    expect(actions).toEqual(['send', 'send', 'send']);
  });

  it('输入法组合期间不发送也不向外层冒泡快捷键，结束后才接受发送', () => {
    const actions: string[] = [], bubbled: string[] = [];
    render(<div onKeyDown={event => bubbled.push(event.key)}><ChatComposer {...props({ value: '输入法候选文字', onSend: () => actions.push('send'), onStop: () => actions.push('stop') })} /></div>);
    const input = field();
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true }); fireEvent.submit(input.closest('form')!);
    expect(actions).toEqual([]);
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter', metaKey: true, isComposing: true });
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, keyCode: 229 });
    expect(actions).toEqual([]); expect(bubbled).toEqual([]);
    fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true }); expect(actions).toEqual(['send']);
  });

  it('状态和外部属性切换保持同一输入框、行动位置与两个图形，焦点和草稿不被重置', () => {
    const actions: string[] = [], original = props({ value: '不会丢失的草稿', onSend: () => actions.push('send'), onStop: () => actions.push('stop') });
    const view = render(<StrictMode><ChatComposer {...original} /></StrictMode>);
    const input = field(), form = input.closest('form')!, button = screen.getByRole('button', { name: '发送' });
    const sendIcon = button.querySelector('.tk-send-icon'), stopIcon = button.querySelector('.tk-stop-icon');
    expect(sendIcon).not.toBeNull(); expect(stopIcon).not.toBeNull();
    input.focus(); input.setSelectionRange(2, 2);
    for (const overrides of [{ busy: true }, { generating: true }, { canSend: false }]) {
      view.rerender(<StrictMode><ChatComposer {...original} {...overrides} /></StrictMode>);
      expect(field()).toBe(input); expect(input.closest('form')).toBe(form); expect(form.querySelector('.tk-send-button')).toBe(button);
      expect(document.activeElement).toBe(input); expect(input.selectionStart).toBe(2); expect(input.value).toBe('不会丢失的草稿');
      expect(button.querySelector('.tk-send-icon')).toBe(sendIcon); expect(button.querySelector('.tk-stop-icon')).toBe(stopIcon);
    }
    view.rerender(<StrictMode><ChatComposer {...original} value="" generating /></StrictMode>);
    expect(screen.getByRole('button', { name: '停止生成' })).toBe(button); expect(field()).toBe(input); expect(document.activeElement).toBe(input);
    fireEvent.submit(form); expect(actions).toEqual([]);
    view.rerender(<StrictMode><ChatComposer {...original} value="" /></StrictMode>);
    expect(form.getAttribute('data-phase')).toBe('idle'); expect(screen.getByRole('button', { name: '发送' })).toBe(button);
    expect(button.querySelector('.tk-send-icon')).toBe(sendIcon); expect(button.querySelector('.tk-stop-icon')).toBe(stopIcon);
  });

  it('StrictMode 下重复点击不累积监听或额外提交，下一次使用最新 callback 与草稿', () => {
    const actions: string[] = [];
    const view = render(<StrictMode><ChatComposer {...props({ value: '旧稿', onSend: () => actions.push('old'), onStop: () => actions.push('stop') })} /></StrictMode>);
    const send = screen.getByRole('button', { name: '发送' });
    fireEvent.click(send); fireEvent.click(send); expect(actions).toEqual(['old', 'old']);
    view.rerender(<StrictMode><ChatComposer {...props({ value: '新稿', onSend: () => actions.push('new'), onStop: () => actions.push('stop') })} /></StrictMode>);
    fireEvent.click(send); expect(actions).toEqual(['old', 'old', 'new']); expect(field().value).toBe('新稿');
    view.unmount(); fireEvent.click(send); expect(actions).toEqual(['old', 'old', 'new']);
  });
});
