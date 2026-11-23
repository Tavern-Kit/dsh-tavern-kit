// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Candidate } from './types.js';
import type { MvuState } from './mvu/types.js';
import { VariablesPanel, type VariablesPanelProps } from './VariablesPanel.js';

afterEach(cleanup);

const initial: MvuState = {
  stat_data: { 角色: { 好感度: 11, 已相识: true, 心情: '放心', 约定: null }, 行李: ['信', '伞'] },
  schema: { 角色: { 好感度: { type: 'number', description: '一起经历过的事' } } },
  initialized_lorebooks: { 'book-one': true }, display_data: { 心情: '放心' }, delta_data: { 好感度: 1 },
  extension: { tags: ['keep'], future: { enabled: false } },
};
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'reply-one', conversationId: 'chat-one', turnId: 'turn-one', groupId: 'group-one', ordinal: 1003,
    kind: 'generated', text: '角色自己的原文。', status: 'complete', favorite: false, createdAt: 1700000000000,
    mvu: { state: clone(initial), issues: [], kind: 'computed' }, ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture(options: { candidate?: Candidate; save?: (state: MvuState) => Promise<void>; enable?: () => Promise<void> } = {}) {
  const saved: MvuState[] = [], enabled: string[] = [];
  const props: VariablesPanelProps = {
    candidate: options.candidate ?? candidate(),
    onSave: async state => { saved.push(clone(state)); await options.save?.(state); },
    onEnable: async () => { enabled.push('enable'); await options.enable?.(); },
  };
  return { props, saved, enabled };
}
async function openCharacter(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('角色', { selector: 'summary *' }));
}
function valueField(path: string) { return screen.getByLabelText(`${path} 的值`); }
function typeField(path: string) { return screen.getByRole('combobox', { name: `${path} 的类型` }); }
async function replace(user: ReturnType<typeof userEvent.setup>, element: HTMLElement, text: string) {
  await user.clear(element); if (text) await user.type(element, text);
}
async function fullJson(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('完整 JSON', { selector: 'summary *' }));
  return screen.getByRole('textbox', { name: '完整变量 JSON' });
}

describe('候选变量查看与修订', () => {
  it('初始只读取本候选状态，层级、来源与候选序号成组，不自动保存或开启', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />);
    expect(screen.getByText(/1003/)).toBeTruthy();
    await openCharacter(user);
    expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('11');
    expect((valueField('角色.已相识') as HTMLInputElement).checked).toBe(true);
    expect((valueField('角色.心情') as HTMLTextAreaElement).value).toBe('放心');
    expect(typeField('角色.约定')).toBeTruthy();
    expect((screen.getByRole('button', { name: '保存变量' }) as HTMLButtonElement).disabled).toBe(true);
    expect(f.saved).toEqual([]); expect(f.enabled).toEqual([]);
    expect(f.props.candidate.mvu?.state).toEqual(initial);
  });

  it('嵌套数字、布尔和文字在明确保存时合为完整state，schema与扩展不丢失也不改原对象', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />); await openCharacter(user);
    await replace(user, valueField('角色.好感度'), '-2.5');
    await user.click(valueField('角色.已相识'));
    await replace(user, valueField('角色.心情'), '想一起出门');
    expect(f.saved).toEqual([]);
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect(f.saved).toEqual([{
      stat_data: { 角色: { 好感度: -2.5, 已相识: false, 心情: '想一起出门', 约定: null }, 行李: ['信', '伞'] },
      schema: { 角色: { 好感度: { type: 'number', description: '一起经历过的事' } } },
      initialized_lorebooks: { 'book-one': true }, display_data: { 心情: '放心' }, delta_data: { 好感度: 1 },
      extension: { tags: ['keep'], future: { enabled: false } },
    }]);
    expect(f.props.candidate.mvu?.state).toEqual(initial);
    expect(screen.getByRole('status').textContent).toContain('已保存');
  });

  it('可将空值改成文字再改回null，数组用JSON编辑而不写成字符串', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />); await openCharacter(user);
    await user.selectOptions(typeField('角色.约定'), 'string');
    await replace(user, valueField('角色.约定'), '明天一起看日出');
    await user.selectOptions(typeField('角色.心情'), 'null');
    fireEvent.change(valueField('行李'), { target: { value: '["信", {"名字":"旧伞","数量":2}]' } });
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect(f.saved[0]?.stat_data).toEqual({ 角色: { 好感度: 11, 已相识: true, 心情: null, 约定: '明天一起看日出' }, 行李: ['信', { 名字: '旧伞', 数量: 2 }] });
  });

  it('无效数字和字段JSON保留输入并阻止保存，修正后才提交实际值', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />); await openCharacter(user);
    await replace(user, valueField('角色.好感度'), '-');
    expect(screen.getByRole('alert').textContent).toContain('角色.好感度');
    expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('-');
    expect((screen.getByRole('button', { name: '保存变量' }) as HTMLButtonElement).disabled).toBe(true);
    await replace(user, valueField('角色.好感度'), '13');
    fireEvent.change(valueField('行李'), { target: { value: '[broken' } });
    expect(screen.getByRole('alert').textContent).toContain('行李');
    await user.click(screen.getByRole('button', { name: '保存变量' })); expect(f.saved).toEqual([]);
    fireEvent.change(valueField('行李'), { target: { value: '["信"]' } });
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect(f.saved[0]?.stat_data).toEqual({ 角色: { 好感度: 13, 已相识: true, 心情: '放心', 约定: null }, 行李: ['信'] });
  });

  it('对象JSON和嵌套字段共用草稿，改对象后不再显示旧数字草稿', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />); await openCharacter(user);
    await replace(user, valueField('角色.好感度'), '12');
    await user.click(screen.getByText('对象 JSON', { selector: 'summary *' }));
    fireEvent.change(valueField('角色'), { target: { value: '{"好感度":17,"已相识":true,"心情":"放心","约定":null}' } });
    expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('17');
    await replace(user, valueField('角色.好感度'), '18');
    expect(JSON.parse((valueField('角色') as HTMLTextAreaElement).value)).toEqual({ 好感度: 18, 已相识: true, 心情: '放心', 约定: null });
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect(f.saved[0]?.stat_data).toEqual({ 角色: { 好感度: 18, 已相识: true, 心情: '放心', 约定: null }, 行李: ['信', '伞'] });
    expect(f.saved[0]?.extension).toEqual({ tags: ['keep'], future: { enabled: false } });
  });

  it('完整JSON可修改对象与schema并保留未知顶层字段，回到字段看到同一草稿', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />);
    const raw = await fullJson(user);
    const updated = {
      stat_data: { 地点: { 名字: '回廊', 天气: '晴' }, 数量: 0 }, schema: { future: { rule: ['keep', 2] } },
      initialized_lorebooks: { 'book-one': true }, display_data: {}, delta_data: {},
      extension: { tags: ['keep'], future: { enabled: false } }, future_top: { nested: [null, true] },
    };
    fireEvent.change(raw, { target: { value: JSON.stringify(updated) } });
    expect(f.saved).toEqual([]);
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect(f.saved).toEqual([updated]);
    await user.click(screen.getByText('地点', { selector: 'summary *' }));
    expect((valueField('地点.名字') as HTMLTextAreaElement).value).toBe('回廊');
  });

  it('完整JSON只接受对象及五个载体对象，错误草稿和说明就近可读且不提交', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />);
    const raw = await fullJson(user);
    for (const invalid of ['({ stat_data: {} })', '[]', '{"stat_data":{}}', JSON.stringify({ ...initial, schema: [] })]) {
      fireEvent.change(raw, { target: { value: invalid } });
      expect(screen.getByRole('alert').textContent).toBeTruthy();
      expect((raw as HTMLTextAreaElement).value).toBe(invalid);
      expect((screen.getByRole('button', { name: '保存变量' }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(f.saved).toEqual([]);
    fireEvent.change(raw, { target: { value: JSON.stringify({ ...initial, extension: { literal: '<script>throw new Error("never")</script>', $ref: 'https://schema.invalid/data' } }) } });
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect(f.saved[0]?.extension).toEqual({ literal: '<script>throw new Error("never")</script>', $ref: 'https://schema.invalid/data' });
    expect(document.querySelector('script')).toBeNull();
  });

  it('切换候选丢弃未保存草稿，不把旧候选的修订写给新候选', async () => {
    const f = fixture(), user = userEvent.setup(), view = render(<VariablesPanel {...f.props} />);
    await openCharacter(user); await replace(user, valueField('角色.好感度'), '99');
    const another = candidate({ id: 'reply-two', ordinal: 2, mvu: { state: { ...clone(initial), stat_data: { 角色: { 好感度: 3 } } }, issues: [], kind: 'imported' } });
    view.rerender(<VariablesPanel {...f.props} candidate={another} />);
    await openCharacter(user);
    expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('3');
    expect(f.saved).toEqual([]); expect(f.enabled).toEqual([]);
    expect((screen.getByRole('button', { name: '保存变量' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('保存失败保留修改，重试期间禁重复保存，成功后再允许新的修改', async () => {
    let attempts = 0;
    const waiting = deferred<void>(), f = fixture({ save: async () => { if (attempts++ === 0) throw new Error('变量暂时没保存成功'); await waiting.promise; } });
    const user = userEvent.setup(); render(<VariablesPanel {...f.props} />);
    await openCharacter(user); await replace(user, valueField('角色.好感度'), '12');
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    expect((await screen.findByRole('alert')).textContent).toContain('变量暂时没保存成功');
    expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('12');
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    const save = screen.getByRole('button', { name: /保存中/ });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    await user.click(save); expect(f.saved).toHaveLength(2);
    await act(async () => { waiting.resolve(); await waiting.promise; });
    await screen.findByRole('status');
    await replace(user, valueField('角色.好感度'), '14');
    expect((screen.getByRole('button', { name: '保存变量' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('旧候选的迟到保存错误不会出现在新候选中', async () => {
    const waiting = deferred<void>(), f = fixture({ save: () => waiting.promise }), user = userEvent.setup();
    const view = render(<VariablesPanel {...f.props} />); await openCharacter(user);
    await replace(user, valueField('角色.好感度'), '12'); await user.click(screen.getByRole('button', { name: '保存变量' }));
    view.rerender(<VariablesPanel {...f.props} candidate={candidate({ id: 'reply-two', ordinal: 2 })} />);
    await act(async () => { waiting.reject(new Error('旧候选的错误')); await waiting.promise.catch(() => undefined); });
    expect(screen.queryByRole('alert')).toBeNull();
    await openCharacter(user); expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('11');
    expect(f.saved).toHaveLength(1);
  });

  it.each(['pending', 'streaming'] as const)('%s候选可查看变量，但不提交修订或开启', async status => {
    const f = fixture({ candidate: candidate({ status }) }), user = userEvent.setup();
    const view = render(<VariablesPanel {...f.props} />); await openCharacter(user);
    expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('11');
    expect((screen.getByRole('button', { name: '保存变量' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '保存变量' }));
    view.rerender(<VariablesPanel {...f.props} candidate={candidate({ id: 'empty', status, mvu: undefined })} />);
    expect((screen.getByRole('button', { name: '开启变量' }) as HTMLButtonElement).disabled).toBe(true);
    expect(f.saved).toEqual([]); expect(f.enabled).toEqual([]);
  });

  it('没有state时只有明确开启才调用上层，失败可重试，收到state后才出现编辑器', async () => {
    let attempts = 0;
    const f = fixture({ candidate: candidate({ mvu: undefined }), enable: async () => { if (attempts++ === 0) throw new Error('初始化没有完成'); } });
    const user = userEvent.setup(), view = render(<VariablesPanel {...f.props} />);
    expect(f.enabled).toEqual([]); expect(screen.queryByRole('button', { name: '保存变量' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '开启变量' }));
    expect((await screen.findByRole('alert')).textContent).toContain('初始化没有完成');
    await user.click(screen.getByRole('button', { name: '开启变量' }));
    expect(f.enabled).toHaveLength(2); expect(f.saved).toEqual([]);
    view.rerender(<VariablesPanel {...f.props} candidate={candidate()} />);
    await openCharacter(user); expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('11');
  });

  it('解析问题与已保存的旧修订只读呈现，展开不会恢复旧值或触发保存', async () => {
    const f = fixture({ candidate: candidate({ mvu: {
      state: clone(initial), kind: 'manual', issues: [{ code: 'MVU_BAD_PATH', message: '这条更新没有找到对应的变量', source: 'JSONPatch', offset: 17 }],
      revisions: [{ state: { ...clone(initial), stat_data: { 旧值: 10 } }, at: 1700000000000 }],
    } }) }), user = userEvent.setup();
    render(<VariablesPanel {...f.props} />);
    expect(screen.getByRole('alert').textContent).toContain('这条更新没有找到对应的变量');
    expect(screen.getByRole('alert').textContent).toContain('JSONPatch');
    await user.click(screen.getByText(/修订前的变量/, { selector: 'summary *' }));
    const old = screen.getByRole('region', { name: '修订前的变量 1' });
    expect(old.textContent).toContain('"旧值": 10');
    await openCharacter(user); expect((valueField('角色.好感度') as HTMLInputElement).value).toBe('11');
    expect(f.saved).toEqual([]); expect(f.enabled).toEqual([]);
    expect(f.props.candidate.mvu?.state.stat_data).toEqual(initial.stat_data);
  });
});
