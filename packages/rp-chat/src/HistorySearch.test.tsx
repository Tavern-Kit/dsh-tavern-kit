// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { SearchHit, SearchInput, SearchPage, SearchPreview } from './protocol.js';
import { HistorySearch, type HistorySearchProps } from './HistorySearch.js';

afterEach(cleanup);

const first: SearchHit = {
  conversationId: 'chat-one', conversationTitle: '海边的约定', turnId: 'turn-one', candidateId: 'reply-one',
  role: 'assistant', ordinal: 1003, excerpt: '…约好明天一起看日出，还要记得带上那封信。', createdAt: 1700000000000,
};
const second: SearchHit = {
  conversationId: 'chat-two', conversationTitle: '雨夜来信', turnId: 'turn-two', candidateId: 'reply-two',
  role: 'user', ordinal: 2, excerpt: '我说，等雨停后一起看日出。', createdAt: 1700000000001,
};
const original: SearchPreview = {
  conversationId: 'chat-one', conversationTitle: '海边的约定', turnId: 'turn-one', candidateId: 'reply-one', ordinal: 1003,
  input: '*拉住衣角* 你还记得那份约定吗？',
  reply: '**记得。** {{char}} 把信收好，说好明早一起看日出。\n\n![旧照片](https://pictures.invalid/old.png)', status: 'complete',
};
const other: SearchPreview = {
  conversationId: 'chat-two', conversationTitle: '雨夜来信', turnId: 'turn-two', candidateId: 'reply-two', ordinal: 2,
  input: '我说，等雨停后一起看日出。', reply: '他点头，把伞往你身边移了一些。', status: 'complete',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fixture(options: {
  search?: (input: SearchInput) => Promise<SearchPage>;
  preview?: (hit: SearchHit) => Promise<SearchPreview>;
  continuation?: (candidateId: string) => Promise<void>;
  conversationId?: string;
} = {}) {
  const searches: SearchInput[] = [], previews: SearchHit[] = [], continued: string[] = [];
  const props: HistorySearchProps = {
    conversationId: options.conversationId ?? 'chat-one',
    api: {
      search: async input => {
        searches.push({ ...input });
        return options.search ? options.search(input) : { items: [first, second], total: 2 };
      },
      searchPreview: async hit => {
        previews.push(hit);
        return options.preview ? options.preview(hit) : hit.conversationId === 'chat-one' ? original : other;
      },
    },
    onContinue: async candidateId => {
      continued.push(candidateId);
      await options.continuation?.(candidateId);
    },
  };
  return { props, searches, previews, continued };
}
async function search(user: ReturnType<typeof userEvent.setup>, query = '日出') {
  await user.type(screen.getByRole('searchbox', { name: '搜索历史正文' }), query);
  await user.click(screen.getByRole('button', { name: '搜索' }));
}
function previewButton(title: string) {
  return screen.getByRole('button', { name: new RegExp(`查看原文.*${title}`) });
}

describe('历史正文搜索', () => {
  it('仅提交非空关键词时请求当前范围的一页，结果将身份、片段和完整候选序号组成卡片', async () => {
    const f = fixture(), user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    expect(f.searches).toEqual([]);
    expect((screen.getByRole('button', { name: '搜索' }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(screen.getByRole('searchbox', { name: '搜索历史正文' }), '  日出  ');
    expect(f.searches).toEqual([]);
    await user.click(screen.getByRole('button', { name: '搜索' }));
    const cards = await screen.findAllByRole('article');
    expect(f.searches).toEqual([{ query: '日出', conversationId: 'chat-one', offset: 0, limit: 20 }]);
    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('海边的约定')).toBeTruthy();
    expect(within(cards[0]!).getByText('角色回复')).toBeTruthy();
    expect(cards[0]!.textContent).toContain('1003');
    expect(cards[0]!.textContent).toContain('约好明天一起看日出');
    expect(within(cards[1]!).getByText('玩家输入')).toBeTruthy();
    expect(f.previews).toEqual([]);
    expect(f.continued).toEqual([]);
    expect(screen.queryByRole('region', { name: '原文预览' })).toBeNull();
  });

  it('点结果才读取双方原文并本地排版，只有明确继续才提交候选且保存中不重复提交', async () => {
    const pending = deferred<void>(), f = fixture({ continuation: () => pending.promise }), user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    await search(user);
    await user.click(await screen.findByRole('button', { name: /查看原文.*海边的约定/ }));
    const preview = await screen.findByRole('region', { name: '原文预览' });
    expect(f.previews).toEqual([first]);
    expect(within(preview).getByText('拉住衣角').tagName).toBe('EM');
    expect(within(preview).getByText('记得。').tagName).toBe('STRONG');
    expect(preview.textContent).toContain('{{char}} 把信收好');
    expect(within(preview).getByRole('link', { name: '旧照片' }).getAttribute('href')).toBe('https://pictures.invalid/old.png');
    expect(within(preview).queryByRole('img')).toBeNull();
    expect(f.continued).toEqual([]);
    const proceed = within(preview).getByRole('button', { name: '从这里继续' });
    await user.click(proceed);
    expect(f.continued).toEqual(['reply-one']);
    expect((proceed as HTMLButtonElement).disabled).toBe(true);
    await user.click(proceed);
    expect(f.continued).toEqual(['reply-one']);
    await act(async () => { pending.resolve(); await pending.promise; });
    await waitFor(() => expect((screen.getByRole('button', { name: '从这里继续' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('只读取请求的分页，翻页和返回保留关键词与范围且不预取全文', async () => {
    const rows = Array.from({ length: 20 }, (_, index): SearchHit => ({ ...first, candidateId: `reply-${index}`, ordinal: index + 1, excerpt: `日出前的第 ${index + 1} 句话` }));
    const f = fixture({ search: async input => ({ items: input.offset === 20 ? [{ ...second, excerpt: '最后一页的日出' }] : rows, total: 21 }) });
    const user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    await search(user);
    await screen.findByText('日出前的第 1 句话');
    await user.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('最后一页的日出');
    expect(screen.queryByText('日出前的第 1 句话')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(f.searches[1]).toEqual({ query: '日出', conversationId: 'chat-one', offset: 20, limit: 20 });
    expect((screen.getByRole('button', { name: '下一页' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: '上一页' }));
    await screen.findByText('日出前的第 1 句话');
    expect(f.searches[2]).toEqual({ query: '日出', conversationId: 'chat-one', offset: 0, limit: 20 });
    expect(f.previews).toEqual([]);
    expect(f.continued).toEqual([]);
    expect((screen.getByRole('searchbox', { name: '搜索历史正文' }) as HTMLInputElement).value).toBe('日出');
  });

  it('切到全部对话后，较慢的当前对话结果不会覆盖新范围', async () => {
    const delayed = deferred<SearchPage>();
    const f = fixture({ search: input => input.conversationId ? delayed.promise : Promise.resolve({ items: [second], total: 1 }) });
    const user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    await search(user);
    await user.click(screen.getByRole('button', { name: '全部对话' }));
    await screen.findByText('雨夜来信');
    expect(f.searches).toEqual([
      { query: '日出', conversationId: 'chat-one', offset: 0, limit: 20 },
      { query: '日出', offset: 0, limit: 20 },
    ]);
    await act(async () => { delayed.resolve({ items: [first], total: 1 }); await delayed.promise; });
    expect(screen.queryByText('海边的约定')).toBeNull();
    expect(screen.getByText('雨夜来信')).toBeTruthy();
    expect(screen.getByRole('button', { name: '全部对话' }).getAttribute('aria-pressed')).toBe('true');
    expect(f.continued).toEqual([]);
  });

  it('当前对话改变后按新ID搜索，旧结果迟到不会回到先前对话', async () => {
    const delayed = deferred<SearchPage>();
    const f = fixture({ search: input => input.conversationId === 'chat-one' ? delayed.promise : Promise.resolve({ items: [second], total: 1 }) });
    const user = userEvent.setup(), view = render(<HistorySearch {...f.props} />);
    await search(user);
    view.rerender(<HistorySearch {...f.props} conversationId="chat-two" />);
    await screen.findByText('雨夜来信');
    expect(f.searches[1]).toEqual({ query: '日出', conversationId: 'chat-two', offset: 0, limit: 20 });
    await act(async () => { delayed.resolve({ items: [first], total: 1 }); await delayed.promise; });
    expect(screen.queryByText('海边的约定')).toBeNull();
    expect(screen.getByText('雨夜来信')).toBeTruthy();
  });

  it('返回结果再打开另一条时，先前迟到的原文不会替换新预览', async () => {
    const delayed = deferred<SearchPreview>();
    const f = fixture({ preview: hit => hit.candidateId === 'reply-one' ? delayed.promise : Promise.resolve(other) });
    const user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    await search(user);
    await user.click(await screen.findByRole('button', { name: /查看原文.*海边的约定/ }));
    await user.click(screen.getByRole('button', { name: '返回搜索结果' }));
    await user.click(previewButton('雨夜来信'));
    const preview = await screen.findByRole('region', { name: '原文预览' });
    await within(preview).findByText('他点头，把伞往你身边移了一些。');
    await act(async () => { delayed.resolve(original); await delayed.promise; });
    expect(preview.textContent).not.toContain('把信收好');
    expect(preview.textContent).toContain('他点头');
    expect(f.continued).toEqual([]);
    await user.click(within(preview).getByRole('button', { name: '从这里继续' }));
    expect(f.continued).toEqual(['reply-two']);
  });

  it('搜索失败保留输入和范围，可重试原查询并展示空结果', async () => {
    let attempt = 0;
    const f = fixture({ search: async () => { if (attempt++ === 0) throw new Error('本地历史暂时没有读到'); return { items: [], total: 0 }; } });
    const user = userEvent.setup();
    render(<HistorySearch {...f.props} conversationId={undefined} />);
    await search(user, '那封旧信');
    expect((await screen.findByRole('alert')).textContent).toContain('本地历史暂时没有读到');
    expect((screen.getByRole('searchbox', { name: '搜索历史正文' }) as HTMLInputElement).value).toBe('那封旧信');
    expect(screen.getByRole('button', { name: '全部对话' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByRole('button', { name: '重试搜索' }));
    await screen.findByText(/没有找到/);
    expect(f.searches).toEqual([{ query: '那封旧信', offset: 0, limit: 20 }, { query: '那封旧信', offset: 0, limit: 20 }]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(f.continued).toEqual([]);
  });

  it('原文读取与继续失败各在预览反馈并保留查询和全文，重试不会把预览当成继续', async () => {
    let reads = 0, saves = 0;
    const f = fixture({
      preview: async () => { if (reads++ === 0) throw new Error('这条原文暂时没有读到'); return original; },
      continuation: async () => { if (saves++ === 0) throw new Error('路线暂时没有保存成功'); },
    });
    const user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    await search(user);
    await user.click(await screen.findByRole('button', { name: /查看原文.*海边的约定/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('这条原文暂时没有读到');
    await user.click(screen.getByRole('button', { name: '重试预览' }));
    const preview = await screen.findByRole('region', { name: '原文预览' });
    await within(preview).findByText('记得。');
    expect(f.continued).toEqual([]);
    await user.click(within(preview).getByRole('button', { name: '从这里继续' }));
    expect((await within(preview).findByRole('alert')).textContent).toContain('路线暂时没有保存成功');
    expect(preview.textContent).toContain('{{char}} 把信收好');
    expect((screen.getByRole('searchbox', { name: '搜索历史正文' }) as HTMLInputElement).value).toBe('日出');
    await user.click(within(preview).getByRole('button', { name: '从这里继续' }));
    expect(f.continued).toEqual(['reply-one', 'reply-one']);
    await waitFor(() => expect(within(preview).queryByRole('alert')).toBeNull());
  });

  it.each([
    { label: '等待中的候选', preview: { ...original, status: 'pending' as const } },
    { label: '仍在出字的候选', preview: { ...original, status: 'streaming' as const } },
    { label: '没有关联候选的玩家输入', preview: { conversationId: 'chat-one', conversationTitle: '海边的约定', turnId: 'turn-one', input: '还没有角色回答' } satisfies SearchPreview },
  ])('$label 可以读原文，但不能作为继续目标', async ({ preview }) => {
    const f = fixture({ preview: async () => preview }), user = userEvent.setup();
    render(<HistorySearch {...f.props} />);
    await search(user);
    await user.click(await screen.findByRole('button', { name: /查看原文.*海边的约定/ }));
    const region = await screen.findByRole('region', { name: '原文预览' });
    await within(region).findByText('玩家原文');
    const proceed = within(region).getByRole('button', { name: '从这里继续' });
    expect((proceed as HTMLButtonElement).disabled).toBe(true);
    await user.click(proceed);
    expect(f.continued).toEqual([]);
  });

  it('搜索框回车只提交搜索，不冒泡发送聊天，也不选择第一个命中', async () => {
    const sent: string[] = [], f = fixture(), user = userEvent.setup();
    render(<form onSubmit={event => { event.preventDefault(); sent.push('chat'); }}><HistorySearch {...f.props} /><button type="submit">发送聊天</button></form>);
    await user.type(screen.getByRole('searchbox', { name: '搜索历史正文' }), '日出{Enter}');
    await screen.findByText('海边的约定');
    expect(sent).toEqual([]);
    expect(f.previews).toEqual([]);
    expect(f.continued).toEqual([]);
    expect(fireEvent.keyDown(screen.getByRole('searchbox', { name: '搜索历史正文' }), { key: 'Enter', isComposing: true })).toBe(true);
    expect(f.searches).toHaveLength(1);
  });
});
