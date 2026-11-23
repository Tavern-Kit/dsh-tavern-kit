export interface GardenFrameTarget {
  render(deltaSeconds: number): void;
  resize(width: number, height: number): void;
  setInteractive(enabled: boolean): void;
  dispose(): void;
}
export interface GardenLifecycle { invalidate(): void; dispose(): void }
export function manageGarden(host: HTMLElement, garden: GardenFrameTarget, onError: (error: unknown) => void): GardenLifecycle {
  const doc = host.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new Error('庭院所在页面不可用');
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  let disposed = false, drawing = false, frameId: number | null = null, last: number | null = null;
  let width = 0, height = 0, intersecting = true;
  const initialRect = host.getBoundingClientRect();
  intersecting = initialRect.bottom > 0 && initialRect.right > 0 && initialRect.top < view.innerHeight && initialRect.left < view.innerWidth;
  const canDraw = () => !disposed && !doc.hidden && intersecting && width > 0 && height > 0;
  function cancelFrame() {
    if (frameId !== null) view!.cancelAnimationFrame(frameId);
    frameId = null; last = null;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; cancelFrame();
    resizeObserver?.disconnect(); intersectionObserver?.disconnect();
    view!.removeEventListener('resize', resize);
    doc.removeEventListener('visibilitychange', refresh);
    motion?.removeEventListener('change', refresh);
    try { garden.dispose(); } catch (error) { onError(error); }
  }
  function render(delta: number): boolean {
    drawing = true;
    try { garden.render(delta); return true; }
    catch (error) { dispose(); onError(error); return false; }
    finally { drawing = false; }
  }
  function tick(now: number) {
    frameId = null;
    if (!canDraw() || motion?.matches) { cancelFrame(); return; }
    const delta = last === null ? 0 : Math.max(0, Math.min(.045, (now - last) / 1000));
    last = now;
    if (render(delta) && canDraw()) frameId = view!.requestAnimationFrame(tick);
  }
  function refresh() {
    if (disposed || drawing) return;
    const visible = canDraw();
    garden.setInteractive(visible);
    if (!visible || motion?.matches) cancelFrame();
    if (!visible || !render(0)) return;
    if (!motion?.matches && frameId === null) frameId = view!.requestAnimationFrame(tick);
  }
  function resize() {
    if (disposed) return;
    const rect = host.getBoundingClientRect();
    width = Math.max(0, rect.width); height = Math.max(0, rect.height);
    if (width > 0 && height > 0) {
      try { garden.resize(width, height); } catch (error) { dispose(); onError(error); return; }
    }
    refresh();
  }
  const resizeObserver = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(resize) : null;
  const intersectionObserver = typeof view.IntersectionObserver === 'function' ? new view.IntersectionObserver(entries => {
    if (disposed) return;
    intersecting = entries.some(entry => entry.isIntersecting); refresh();
  }) : null;
  try {
    resizeObserver?.observe(host); intersectionObserver?.observe(host);
    view.addEventListener('resize', resize);
    doc.addEventListener('visibilitychange', refresh);
    motion?.addEventListener('change', refresh);
    resize();
  } catch (error) { dispose(); throw error; }
  return { invalidate: refresh, dispose };
}
