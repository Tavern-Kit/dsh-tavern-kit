// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverflowLine } from './OverflowLine.js';

class ControlledResizeObserver implements ResizeObserver {
  static instances: ControlledResizeObserver[] = [];
  targets: Element[] = [];
  disconnected = false;
  constructor(private callback: ResizeObserverCallback) { ControlledResizeObserver.instances.push(this); }
  observe(target: Element) { this.targets.push(target); }
  unobserve(target: Element) { this.targets = this.targets.filter(item => item !== target); }
  disconnect() { this.disconnected = true; this.targets = []; }
  notify() { this.callback([], this); }
}

const previousFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
beforeEach(() => {
  ControlledResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', ControlledResizeObserver);
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (previousFonts) Object.defineProperty(document, 'fonts', previousFonts);
  else Reflect.deleteProperty(document, 'fonts');
});
function geometry(viewport: number, content: number) {
  const size = { viewport, content, reads: 0 };
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('tk-overflow-scroll') ? size.viewport : 0; });
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (this: HTMLElement) { size.reads++; return this.classList.contains('tk-overflow-scroll') ? size.content : 0; });
  return size;
}
function nodes(container: HTMLElement) {
  const line = container.querySelector<HTMLElement>('.tk-overflow-line');
  const scroll = container.querySelector<HTMLElement>('.tk-overflow-scroll');
  if (!line || !scroll) throw new Error('没有渲染单行横向滚动区域');
  return { line, scroll };
}
function edges(line: HTMLElement) {
  return [line.getAttribute('data-overflow-start'), line.getAttribute('data-overflow-end')];
}
function installFonts(ready: Promise<unknown>) {
  const fonts = Object.assign(new EventTarget(), { ready });
  Object.defineProperty(document, 'fonts', { configurable: true, value: fonts });
  return fonts;
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

describe('窄栏单行滚动', () => {
  it('按实际宽度进入键盘顺序，滚到中间或末尾时只标记仍被遮住的一侧', () => {
    geometry(120, 360);
    const view = render(<OverflowLine label="完整模型名称">[薄甲]长长的模型与业务分组名称</OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(edges(line)).toEqual([null, 'true']);
    expect(scroll.tabIndex).toBe(0);
    expect(scroll.getAttribute('aria-label')).toBe('完整模型名称');
    scroll.scrollLeft = 80;
    fireEvent.scroll(scroll);
    expect(edges(line)).toEqual(['true', 'true']);
    scroll.scrollLeft = 240;
    fireEvent.scroll(scroll);
    expect(edges(line)).toEqual(['true', null]);
    scroll.scrollLeft = 0;
    fireEvent.scroll(scroll);
    expect(edges(line)).toEqual([null, 'true']);
  });

  it('没有溢出时不制造额外Tab停点，默认span并保留传入的内容和类名', () => {
    geometry(120, 80);
    const view = render(<OverflowLine className="model-name">短名称 <strong>原样内容</strong></OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(line.tagName).toBe('SPAN');
    expect(line.classList.contains('model-name')).toBe(true);
    expect(edges(line)).toEqual([null, null]);
    expect(scroll.getAttribute('tabindex')).toBeNull();
    expect(scroll.tabIndex).toBe(-1);
    expect(scroll.textContent).toBe('短名称 原样内容');
    expect(scroll.querySelector('strong')?.textContent).toBe('原样内容');
  });

  it('观察可见滚动区的尺寸，窄栏变宽后移除溢出标记和Tab停点', () => {
    const size = geometry(100, 300);
    const view = render(<OverflowLine>当前角色和当前连接</OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(edges(line)).toEqual([null, 'true']);
    const observer = ControlledResizeObserver.instances.find(item => item.targets.includes(scroll));
    expect(observer).toBeTruthy();
    size.viewport = 320;
    act(() => observer?.notify());
    expect(edges(line)).toEqual([null, null]);
    expect(scroll.getAttribute('tabindex')).toBeNull();
    size.viewport = 140;
    act(() => observer?.notify());
    expect(edges(line)).toEqual([null, 'true']);
    expect(scroll.tabIndex).toBe(0);
    expect(scroll.scrollLeft).toBe(0);
  });

  it('替换子内容就重测，不依赖窗口resize或旧内容的溢出状态', () => {
    const size = geometry(100, 280);
    const view = render(<OverflowLine label="角色名称">旧的长角色名称</OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(edges(line)).toEqual([null, 'true']);
    size.content = 60;
    view.rerender(<OverflowLine label="角色名称">短名字</OverflowLine>);
    expect(edges(line)).toEqual([null, null]);
    expect(scroll.getAttribute('tabindex')).toBeNull();
    expect(scroll.textContent).toBe('短名字');
    size.content = 240;
    view.rerender(<OverflowLine label="角色名称"><strong>另一个完整的长名称</strong></OverflowLine>);
    expect(edges(line)).toEqual([null, 'true']);
    expect(scroll.tabIndex).toBe(0);
  });

  it('字体加载完成后按新字宽重测，不自动移动阅读位置', async () => {
    const size = geometry(120, 80), fonts = deferred();
    installFonts(fonts.promise);
    const view = render(<OverflowLine>字体加载后的长名称</OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(edges(line)).toEqual([null, null]);
    size.content = 300;
    await act(async () => { fonts.resolve(); await fonts.promise; });
    expect(edges(line)).toEqual([null, 'true']);
    expect(scroll.tabIndex).toBe(0);
    expect(scroll.scrollLeft).toBe(0);
  });

  it('首次ready之后的新字体加载仍重测字宽，卸载移除同一loadingdone监听', async () => {
    const size = geometry(120, 80), ready = Promise.resolve();
    const fonts = installFonts(ready);
    const added = vi.spyOn(fonts, 'addEventListener'), removed = vi.spyOn(fonts, 'removeEventListener');
    const view = render(<OverflowLine>换成像素字体后的完整名称</OverflowLine>);
    const { line, scroll } = nodes(view.container);
    await act(async () => { await ready; });
    expect(edges(line)).toEqual([null, null]);
    expect(scroll.getAttribute('tabindex')).toBeNull();
    size.content = 300;
    act(() => { fonts.dispatchEvent(new Event('loadingdone')); });
    expect(edges(line)).toEqual([null, 'true']);
    expect(scroll.tabIndex).toBe(0);
    scroll.scrollLeft = 90;
    fireEvent.scroll(scroll);
    expect(edges(line)).toEqual(['true', 'true']);
    size.content = 80;
    scroll.scrollLeft = 0;
    act(() => { fonts.dispatchEvent(new Event('loadingdone')); });
    expect(edges(line)).toEqual([null, null]);
    expect(scroll.getAttribute('tabindex')).toBeNull();
    const listener = added.mock.calls.find(([type]) => type === 'loadingdone')?.[1];
    expect(listener).toBeTypeOf('function');
    view.unmount();
    expect(removed).toHaveBeenCalledWith('loadingdone', listener);
    const reads = size.reads;
    act(() => { fonts.dispatchEvent(new Event('loadingdone')); });
    expect(size.reads).toBe(reads);
  });

  it('卸载断开observer和滚动监听，并忽略迟到的字体与尺寸回调', async () => {
    const size = geometry(100, 300), fonts = deferred();
    installFonts(fonts.promise);
    const view = render(<OverflowLine>之后会卸载的内容</OverflowLine>);
    const { scroll } = nodes(view.container);
    const observer = ControlledResizeObserver.instances.find(item => item.targets.includes(scroll));
    expect(observer).toBeTruthy();
    view.unmount();
    expect(observer?.disconnected).toBe(true);
    const reads = size.reads;
    scroll.scrollLeft = 80;
    fireEvent.scroll(scroll);
    act(() => observer?.notify());
    await act(async () => { fonts.resolve(); await fonts.promise; });
    expect(size.reads).toBe(reads);
  });

  it('没有ResizeObserver时使用窗口resize，卸载后也移除该后备监听', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const size = geometry(100, 240);
    const view = render(<OverflowLine>后备尺寸测量</OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(edges(line)).toEqual([null, 'true']);
    size.viewport = 300;
    fireEvent(window, new Event('resize'));
    expect(edges(line)).toEqual([null, null]);
    expect(scroll.getAttribute('tabindex')).toBeNull();
    view.unmount();
    const reads = size.reads;
    fireEvent(window, new Event('resize'));
    expect(size.reads).toBe(reads);
  });

  it('可用div容器，不拦截原生子操作、wheel或触摸事件', () => {
    geometry(100, 260);
    let clicks = 0;
    const view = render(<OverflowLine as="div"><button type="button" onClick={() => { clicks++; }}>完整连接名称</button></OverflowLine>);
    const { line, scroll } = nodes(view.container);
    expect(line.tagName).toBe('DIV');
    fireEvent.click(screen.getByRole('button', { name: '完整连接名称' }));
    expect(clicks).toBe(1);
    const wheel = new WheelEvent('wheel', { deltaY: 40, bubbles: true, cancelable: true });
    const touch = new Event('touchmove', { bubbles: true, cancelable: true });
    fireEvent(scroll, wheel); fireEvent(scroll, touch);
    expect(wheel.defaultPrevented).toBe(false);
    expect(touch.defaultPrevented).toBe(false);
  });
});
