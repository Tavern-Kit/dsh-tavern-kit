// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MessageBody } from './MessageBody.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, '__messageBodyExecuted');
});

describe('正文 Markdown 阅读投影', () => {
  it('将动作、重点、段落、引用和列表呈现为可阅读的正文结构', () => {
    const text = [
      '*他把杯子放下。* **我还记得。**',
      '',
      '下一段写着 `约定`。',
      '',
      '> 等你回来。',
      '',
      '- 一起看海',
      '- 收好信件',
      '',
      '1. 先回家',
      '2. 再出发',
    ].join('\n');
    const { container } = render(<MessageBody text={text} className="tk-message-body" />);

    expect(screen.getByText('他把杯子放下。').tagName).toBe('EM');
    expect(screen.getByText('我还记得。').tagName).toBe('STRONG');
    expect(screen.getByText('约定').tagName).toBe('CODE');
    expect(screen.getByText('下一段写着', { exact: false }).tagName).toBe('P');
    expect(screen.getByText('等你回来。').closest('blockquote')).not.toBeNull();
    expect(screen.getAllByRole('list')).toHaveLength(2);
    expect(screen.getAllByRole('listitem').map(item => item.textContent)).toEqual([
      '一起看海', '收好信件', '先回家', '再出发',
    ]);
    expect(container.firstElementChild?.classList.contains('tk-markdown')).toBe(true);
    expect(container.firstElementChild?.classList.contains('tk-message-body')).toBe(true);
  });

  it('代码块与 GFM 表格有各自可聚焦的阅读区域，保留代码原有空格', () => {
    const text = [
      '```ts',
      'const letter = "给你的信";',
      '  keepIndent();',
      '```',
      '',
      '| 时间 | 约定 |',
      '| --- | --- |',
      '| 明天 | 一起看海 |',
    ].join('\n');
    render(<MessageBody text={text} />);

    const codeRegion = screen.getByRole('region', { name: '代码块' });
    const tableRegion = screen.getByRole('region', { name: '表格' });
    expect(codeRegion.tabIndex).toBe(0);
    expect(tableRegion.tabIndex).toBe(0);
    expect(codeRegion.querySelector('pre > code')?.textContent).toBe('const letter = "给你的信";\n  keepIndent();\n');
    expect(codeRegion.querySelector('code')?.className).toBe('language-ts');
    const table = within(tableRegion).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(cell => cell.textContent)).toEqual(['时间', '约定']);
    expect(within(table).getByRole('cell', { name: '一起看海' })).toBeTruthy();
  });

  it('链接保持键盘可达，只在玩家激活时交给新窗口打开', async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<MessageBody text={'[读这封信](https://example.com/letter?from=story "留给你的信")'} />);
    const link = screen.getByRole('link', { name: '读这封信' }) as HTMLAnchorElement;
    const activated: string[] = [];
    link.addEventListener('click', event => {
      activated.push(link.href);
      event.preventDefault();
    });

    expect(link.href).toBe('https://example.com/letter?from=story');
    expect(link.target).toBe('_blank');
    expect(link.relList.contains('noopener')).toBe(true);
    expect(link.relList.contains('noreferrer')).toBe(true);
    expect(link.title).toBe('留给你的信');
    expect(activated).toEqual([]);
    expect(open).not.toHaveBeenCalled();
    await user.tab();
    expect(document.activeElement).toBe(link);
    await user.keyboard('{Enter}');
    expect(activated).toEqual(['https://example.com/letter?from=story']);
  });

  it('图片只提供带说明的链接，原始 HTML 不创建可执行或自动加载的节点', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(''));
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    Reflect.set(window, '__messageBodyExecuted', false);
    const { container } = render(<MessageBody text={[
      '![海边合照](https://images.example.com/photo.png "我们的合照")',
      '',
      '![纸片](data:image/png;base64,aGVsbG8=)',
      '',
      '<script>window.__messageBodyExecuted = true</script>',
      '<img src="https://images.example.com/raw.png" onerror="window.__messageBodyExecuted = true">',
      '<iframe src="https://images.example.com/frame"></iframe>',
      '',
      '正文仍然可读。',
    ].join('\n')} />);

    const photo = screen.getByRole('link', { name: '海边合照' }) as HTMLAnchorElement;
    expect(photo.href).toBe('https://images.example.com/photo.png');
    expect(photo.target).toBe('_blank');
    expect(photo.relList.contains('noopener')).toBe(true);
    expect(photo.relList.contains('noreferrer')).toBe(true);
    expect(screen.getByText('纸片')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '纸片' })).toBeNull();
    expect(container.querySelector('img,script,iframe,object,embed,video,audio')).toBeNull();
    expect(Reflect.get(window, '__messageBodyExecuted')).toBe(false);
    expect(screen.getByText('正文仍然可读。')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('沿用渲染库的 URI 过滤，不把脚本与 data 页面变成可点击链接', () => {
    render(<MessageBody text={'[运行指令](javascript:alert%281%29) 和 [嵌入页面](data:text/html;base64,PHNjcmlwdD4=)'} />);
    expect(screen.getByText('运行指令')).toBeTruthy();
    expect(screen.getByText('嵌入页面')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('未闭合的流式语法补全后正常排版，切换内容不会保留旧片段或展开宏', () => {
    const first = '*他把杯子';
    const { container, rerender } = render(<MessageBody text={first} />);
    expect(container.textContent).toBe('*他把杯子');
    expect(container.querySelector('em')).toBeNull();

    rerender(<MessageBody text={'*他把杯子放下。* **我还记得**\n\n```txt\n给你的信'} />);
    expect(screen.getByText('他把杯子放下。').tagName).toBe('EM');
    expect(screen.getByText('我还记得').tagName).toBe('STRONG');
    expect(screen.getByRole('region', { name: '代码块' }).querySelector('code')?.textContent).toBe('给你的信\n');

    rerender(<MessageBody text={'*他把杯子放下。* **我还记得**\n\n```txt\n给你的信\n```\n\n[回信](https://example.com/reply)'} />);
    expect(screen.getByRole('link', { name: '回信' }).getAttribute('href')).toBe('https://example.com/reply');
    rerender(<MessageBody text={'{{char}} *另一条回复*'} />);
    expect(screen.getByText('另一条回复').tagName).toBe('EM');
    expect(container.textContent).toBe('{{char}} 另一条回复');
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(first).toBe('*他把杯子');
  });
});
