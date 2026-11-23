/** Component-owned presentation motion; no operation waits for it to finish. */
export function createSurfaceMotion(element: HTMLElement, kind: 'menu' | 'dialog' | 'inline') {
  const document = element.ownerDocument, window = document.defaultView;
  const reduced = window?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const closedTransform = kind === 'inline' ? (document.documentElement.dataset.tkSkin === 'pixel' ? 'none' : 'translateY(2px)') : 'scale(0.97)';
  let animation: Animation | undefined, generation = 0, disposed = false, target = false;
  let completion: (() => void) | undefined;
  const paint = (open: boolean) => {
    element.style.opacity = open ? '1' : '0';
    element.style.transform = open ? 'none' : closedTransform;
    element.dataset.state = open ? 'open' : 'closed';
  };
  const cancel = () => {
    ++generation;
    completion = undefined;
    const previous = animation;
    animation = undefined;
    previous?.cancel();
  };
  const to = (open: boolean, immediate = false, onFinish?: () => void) => {
    if (disposed) return;
    // Sample before cancel: replacing an in-flight effect must start at its visible frame.
    const current = window?.getComputedStyle(element);
    const from = { opacity: current?.opacity || element.style.opacity, transform: current?.transform || 'none' };
    const easing = current?.getPropertyValue('--tk-ease-out').trim() || 'cubic-bezier(0.23, 1, 0.32, 1)';
    cancel();
    target = open;
    completion = onFinish;
    const ticket = generation;
    const finish = () => {
      if (disposed || ticket !== generation) return;
      const notify = completion, finished = animation;
      completion = undefined;
      animation = undefined;
      paint(open);
      finished?.cancel();
      notify?.();
    };
    // Underlying styles already represent the destination if WAAPI is absent or fails.
    paint(open);
    if (immediate || reduced?.matches || typeof element.animate !== 'function') { finish(); return; }
    element.dataset.state = open ? 'opening' : 'closing';
    try {
      const active = element.animate([from, { opacity: element.style.opacity, transform: element.style.transform }], {
        duration: open ? (kind === 'menu' ? 160 : 180) : 120, easing, fill: 'both',
      });
      animation = active;
      const settled = () => { if (animation === active) finish(); };
      void active.finished.then(settled, settled);
    } catch { finish(); }
  };
  const settle = () => { if (animation) to(target, true, completion); };
  const reduce = () => { if (reduced?.matches) settle(); };
  element.style.transformOrigin = kind === 'menu' ? 'top right' : 'center';
  paint(false);
  // Key input and accessibility changes never have to wait for a pointer transition.
  document.addEventListener('keydown', settle, true);
  reduced?.addEventListener('change', reduce);
  return {
    to,
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      document.removeEventListener('keydown', settle, true);
      reduced?.removeEventListener('change', reduce);
    },
  };
}
