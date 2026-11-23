// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { StoryMap } from './StoryMap.js';
import type { TurnSummary } from './protocol.js';

// React Flow measures its real nodes; jsdom has no layout or ResizeObserver.
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    private readonly targets = new Set<Element>();
    private queued = false;
    constructor(private readonly notify: ResizeObserverCallback) {}
    observe(target: Element) {
      this.targets.add(target);
      if (this.queued) return;
      this.queued = true;
      // Browser delivery batches mounted nodes; synchronous delivery fits only the first measured node.
      queueMicrotask(() => {
        this.queued = false;
        const entries = [...this.targets].map(target => ({ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry));
        if (entries.length) this.notify(entries, this as unknown as ResizeObserver);
      });
    }
    unobserve(target: Element) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  });
  vi.stubGlobal('DOMMatrixReadOnly', class { m22 = 1; });
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { configurable: true, get() { return this.classList.contains('react-flow__node') ? 232 : 900; } },
    offsetHeight: { configurable: true, get() { return this.classList.contains('react-flow__node') ? 108 : 500; } },
  });
});
afterEach(cleanup);

// Deliberately not ordered by ancestry: neither layout nor highlighting may infer parents from row order.
const rows: TurnSummary[] = [
  { id: 'root', input: '那天我们在海边相遇', candidates: 1003 },
  { id: 'other-root', input: '另一段开场', candidates: 1 },
  { id: 'side', parentTurnId: 'root', input: '如果那时没有赴约', candidates: 2 },
  { id: 'current', parentTurnId: 'promise', input: '还记得那份约定吗', candidates: 4 },
  { id: 'promise', parentTurnId: 'root', input: '约好明天一起看日出', candidates: 3 },
];

function previewButton(input: string) {
  return screen.getByRole('button', { name: new RegExp(`预览.*${input}`) });
}

describe('已有剧情地图', () => {
  it('将节点对应的明确候选交给预览，不把已选第二条替换成第一条', async () => {
    const onPreview=vi.fn(),user=userEvent.setup();
    render(<StoryMap rows={[{id:'turn',input:'那份约定',candidates:2,previewCandidateId:'selected-second'}]} currentTurnId="turn" onPreview={onPreview}/>);
    await screen.findByRole('button',{name:/预览.*那份约定/});
    expect(onPreview).not.toHaveBeenCalled();
    await user.click(previewButton('那份约定'));
    expect(onPreview).toHaveBeenCalledExactlyOnceWith('turn','selected-second');
  });
  it('每轮只显示一个折叠候选节点，点击仅请求预览，当前剧情不改变', async () => {
    const onPreview = vi.fn();
    const user = userEvent.setup();
    render(<StoryMap rows={rows} currentTurnId="current" onPreview={onPreview} />);

    await screen.findByRole('button', { name: /预览.*那天我们在海边相遇/ });
    expect(screen.getAllByRole('button', { name: /预览/ })).toHaveLength(5);
    expect(within(previewButton('那天我们在海边相遇')).getByText(/1003/)).toBeTruthy();
    expect(onPreview).not.toHaveBeenCalled();

    await user.click(previewButton('如果那时没有赴约'));
    expect(onPreview).toHaveBeenCalledExactlyOnceWith('side');
    expect(previewButton('还记得那份约定吗').getAttribute('aria-current')).toBe('step');
    expect(previewButton('如果那时没有赴约').getAttribute('aria-current')).toBeNull();
    expect(screen.queryByRole('button', { name: '从这里继续' })).toBeNull();
  });

  it('沿真正父关系高亮当前祖先，切换当前回合时不把旁支或另一开场带入', async () => {
    const onPreview = vi.fn();
    const view = render(<StoryMap rows={rows} currentTurnId="current" onPreview={onPreview} />);

    await screen.findByRole('button', { name: /预览.*约好明天一起看日出/ });
    expect(within(previewButton('那天我们在海边相遇')).getByText('当前路线')).toBeTruthy();
    expect(within(previewButton('约好明天一起看日出')).getByText('当前路线')).toBeTruthy();
    expect(within(previewButton('如果那时没有赴约')).queryByText('当前路线')).toBeNull();
    expect(within(previewButton('另一段开场')).queryByText('当前路线')).toBeNull();

    view.rerender(<StoryMap rows={rows} currentTurnId="side" onPreview={onPreview} />);
    await waitFor(() => expect(previewButton('如果那时没有赴约').getAttribute('aria-current')).toBe('step'));
    expect(within(previewButton('约好明天一起看日出')).queryByText('当前路线')).toBeNull();
    expect(previewButton('还记得那份约定吗').getAttribute('aria-current')).toBeNull();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('全图涵盖初始画布外的已有剧情，缩放只改变视图', async () => {
    const longRoute: TurnSummary[] = Array.from({ length: 24 }, (_, index) => ({
      id: `turn-${index}`,
      ...(index ? { parentTurnId: `turn-${index - 1}` } : {}),
      input: `旅途第${index + 1}天`,
      candidates: index === 23 ? 1000 : 1,
    }));
    const onPreview = vi.fn();
    const user = userEvent.setup();
    const view = render(<StoryMap rows={longRoute} currentTurnId="turn-23" onPreview={onPreview} />);

    await screen.findByRole('button', { name: /预览.*旅途第24天/ });
    const viewport = view.container.querySelector('.react-flow__viewport') as HTMLElement;
    const beforeZoom = viewport.style.transform;
    await user.click(screen.getByRole('button', { name: '放大地图' }));
    await waitFor(() => expect(viewport.style.transform).not.toBe(beforeZoom));
    await user.click(screen.getByRole('button', { name: '显示全部剧情' }));
    await screen.findByRole('button', { name: /预览.*旅途第24天/ });
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('保留不同父节点的连线并提供地图缩放与适应画布操作', async () => {
    render(<StoryMap rows={rows} currentTurnId="current" onPreview={() => {}} />);

    await screen.findByRole('button', { name: /预览.*还记得那份约定吗/ });
    await waitFor(() => expect(screen.getByLabelText('当前路线：约好明天一起看日出 → 还记得那份约定吗')).toBeTruthy());
    expect(screen.getByLabelText('剧情分支：那天我们在海边相遇 → 如果那时没有赴约')).toBeTruthy();
    expect(screen.queryByLabelText('剧情分支：如果那时没有赴约 → 还记得那份约定吗')).toBeNull();
    expect(screen.getByRole('button', { name: '放大地图' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '缩小地图' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '显示全部剧情' })).toBeTruthy();
  });
});
