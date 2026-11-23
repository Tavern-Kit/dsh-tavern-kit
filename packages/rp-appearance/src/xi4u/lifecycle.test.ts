// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { manageGarden } from './lifecycle.js';

/** The real browser owns frame delivery and observers. This harness controls those external signals. */
class ResizeSignal {
  static current: ResizeSignal | undefined;
  disconnected = false;
  constructor(readonly callback: ResizeObserverCallback) { ResizeSignal.current = this; }
  observe() {}
  unobserve() {}
  disconnect() { this.disconnected = true; }
  emit() { this.callback([], this as unknown as ResizeObserver); }
}
class IntersectionSignal {
  static current: IntersectionSignal | undefined;
  disconnected = false;
  constructor(readonly callback: IntersectionObserverCallback) { IntersectionSignal.current = this; }
  observe() {}
  unobserve() {}
  disconnect() { this.disconnected = true; }
  emit(visible: boolean) { this.callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let motion: EventTarget & { matches: boolean };
let width: number;
let hidden: boolean;
function frame(now: number) {
  const batch = [...frames.values()]; frames.clear();
  for (const callback of batch) callback(now);
}
function fixture(failAfter = Infinity) {
  const host = document.createElement('div'); document.body.append(host);
  host.getBoundingClientRect = () => ({ width, height: 240, left: 0, top: 0, right: width, bottom: 240, x: 0, y: 0, toJSON() {} });
  const marker = document.createElement('output'); host.append(marker);
  let elapsed = 0, renders = 0, disposed = 0;
  const lifecycle = manageGarden(host, {
    render(delta) { if (++renders > failAfter) throw new Error('GPU frame failed'); elapsed += delta; marker.textContent = String(elapsed); },
    resize(w, h) { marker.dataset.size = `${w}x${h}`; },
    setInteractive(value) { marker.dataset.interactive = String(value); },
    dispose() { disposed++; marker.remove(); },
  }, error => { host.dataset.error = error instanceof Error ? error.message : String(error); });
  return { host, marker, lifecycle, elapsed: () => elapsed, renders: () => renders, disposed: () => disposed };
}
beforeEach(() => {
  frames = new Map(); nextFrame = 0; width = 480; hidden = false;
  motion = Object.assign(new EventTarget(), { matches: false });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { const id = ++nextFrame; frames.set(id, callback); return id; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
  vi.stubGlobal('ResizeObserver', ResizeSignal); vi.stubGlobal('IntersectionObserver', IntersectionSignal);
  vi.stubGlobal('matchMedia', () => motion);
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('garden frame ownership', () => {
  it('does not advance or retain frame callbacks offscreen, in background, or at zero width', () => {
    const garden = fixture();
    expect(garden.marker.dataset.size).toBe('480x240');
    expect(frames.size).toBe(1);
    frame(100); frame(116); expect(garden.elapsed()).toBeGreaterThan(0);
    const visibleTime = garden.elapsed();
    IntersectionSignal.current?.emit(false); expect(frames.size).toBe(0);
    frame(5000); expect(garden.elapsed()).toBe(visibleTime);
    IntersectionSignal.current?.emit(true); expect(frames.size).toBe(1);
    frame(10000); expect(garden.elapsed()).toBe(visibleTime);
    hidden = true; document.dispatchEvent(new Event('visibilitychange')); expect(frames.size).toBe(0);
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); expect(frames.size).toBe(1);
    width = 0; ResizeSignal.current?.emit(); expect(frames.size).toBe(0);
    width = 320; ResizeSignal.current?.emit(); expect(garden.marker.dataset.size).toBe('320x240'); expect(frames.size).toBe(1);
    garden.lifecycle.dispose();
    expect(frames.size).toBe(0); expect(garden.disposed()).toBe(1);
    expect(ResizeSignal.current?.disconnected).toBe(true); expect(IntersectionSignal.current?.disconnected).toBe(true);
    motion.dispatchEvent(new Event('change')); document.dispatchEvent(new Event('visibilitychange'));
    frame(20000); expect(garden.disposed()).toBe(1); expect(frames.size).toBe(0);
  });

  it('renders a still garden for reduced motion and redraws changed seasons without restarting animation', () => {
    motion.matches = true;
    const garden = fixture();
    expect(garden.renders()).toBe(1); expect(frames.size).toBe(0); expect(garden.elapsed()).toBe(0);
    garden.lifecycle.invalidate(); expect(garden.renders()).toBe(2); expect(frames.size).toBe(0);
    motion.matches = false; motion.dispatchEvent(new Event('change')); expect(frames.size).toBe(1);
    frame(100); frame(120); expect(garden.elapsed()).toBeGreaterThan(0);
    motion.matches = true; motion.dispatchEvent(new Event('change')); expect(frames.size).toBe(0);
    garden.lifecycle.dispose(); garden.lifecycle.dispose(); expect(garden.disposed()).toBe(1);
  });

  it('coalesces orbit changes raised during drawing instead of recursively rendering the scene', () => {
    const host = document.createElement('div'); document.body.append(host);
    host.getBoundingClientRect = () => ({ width: 480, height: 240, left: 0, top: 0, right: 480, bottom: 240, x: 0, y: 0, toJSON() {} });
    let draws = 0;
    let active: ReturnType<typeof manageGarden> | undefined;
    active = manageGarden(host, {
      render() { draws++; active?.invalidate(); }, resize() {}, setInteractive() {}, dispose() {},
    }, () => {});
    frame(100);
    expect(draws).toBe(2);
    expect(frames.size).toBe(1);
    active.dispose(); expect(frames.size).toBe(0);
  });

  it('stops and releases an errored renderer before exposing the actual failure', () => {
    const garden = fixture(1);
    frame(100);
    expect(garden.host.dataset.error).toBe('GPU frame failed');
    expect(garden.disposed()).toBe(1); expect(frames.size).toBe(0);
    garden.lifecycle.dispose(); expect(garden.disposed()).toBe(1);
  });
});
