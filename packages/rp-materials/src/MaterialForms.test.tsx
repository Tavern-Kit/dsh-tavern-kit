// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { WorldbookForm } from './MaterialForms.js';
import type { JsonValue } from './types.js';

afterEach(cleanup);

function mountWorldbook() {
  let draft: JsonValue = {
    name: '条目草稿',
    authorFuture: { keep: true },
    entries: [
      { keys: ['first-key'], secondary_keys: ['first-secondary'], content: 'first-body', extension: '第一条原文' },
      { keys: ['second-key'], secondary_keys: ['second-secondary'], content: 'second-body', extension: '第二条原文' },
      { keys: ['third-key'], secondary_keys: ['third-secondary'], content: 'third-body', extension: '第三条原文' },
    ],
  };
  function Editor() {
    const [raw, setRaw] = useState(draft);
    return <WorldbookForm raw={raw} disabled={false} onChange={value => { draft = value; setRaw(value); }} />;
  }
  render(<Editor />);
  return { user: userEvent.setup(), draft: () => draft };
}

describe('worldbook entry keyword drafts', () => {
  it.each([
    { removed: '0', remaining: 'second', extension: '第二条原文' },
    { removed: '1', remaining: 'third', extension: '第三条原文' },
  ])('shows the next entry keywords with its body after deleting array entry $removed', async ({ removed, remaining, extension }) => {
    const { user, draft } = mountWorldbook();
    await user.selectOptions(screen.getByRole('combobox', { name: '世界书条目' }), removed);
    await user.click(screen.getByRole('button', { name: '删除条目' }));

    expect(screen.getByRole('textbox', { name: '条目内容' })).toHaveProperty('value', `${remaining}-body`);
    const keywords = screen.getByRole('textbox', { name: '主关键词' });
    expect(keywords).toHaveProperty('value', `${remaining}-key`);
    expect(screen.getByRole('textbox', { name: '副关键词' })).toHaveProperty('value', `${remaining}-secondary`);

    await user.type(keywords, '，新词');
    expect(draft()).toMatchObject({
      authorFuture: { keep: true },
      entries: expect.arrayContaining([{
        keys: [`${remaining}-key`, '新词'], secondary_keys: [`${remaining}-secondary`], content: `${remaining}-body`, extension,
      }]),
    });
  });

  it('keeps typed separators, spacing, focus and caret while its own normalized keywords update', async () => {
    const { user, draft } = mountWorldbook();
    const primary = screen.getByRole('textbox', { name: '主关键词' });
    await user.clear(primary);
    await user.type(primary, '雨，  重逢, ');
    expect(screen.getByRole('textbox', { name: '主关键词' })).toBe(primary);
    expect(primary).toHaveProperty('value', '雨，  重逢, ');
    expect(primary).toHaveProperty('selectionStart', '雨，  重逢, '.length);
    expect(document.activeElement).toBe(primary);

    const secondary = screen.getByRole('textbox', { name: '副关键词' });
    await user.clear(secondary);
    await user.type(secondary, '桥,,  灯，');
    expect(secondary).toHaveProperty('value', '桥,,  灯，');
    expect(document.activeElement).toBe(secondary);
    fireEvent.change(screen.getByRole('textbox', { name: '条目内容' }), { target: { value: '改好的正文' } });
    expect(primary).toHaveProperty('value', '雨，  重逢, ');
    expect(secondary).toHaveProperty('value', '桥,,  灯，');
    expect(draft()).toMatchObject({ entries: expect.arrayContaining([{
      keys: ['雨', '重逢'], secondary_keys: ['桥', '灯'], content: '改好的正文', extension: '第一条原文',
    }]) });
  });
});
