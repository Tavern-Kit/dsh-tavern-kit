import { manageGarden, type GardenLifecycle } from './lifecycle.js';
import { validateAppearance, type GardenWorldOptions, type Xi4uAppearance } from './types.js';
import { createWorld } from './vendor/world.js';

export interface GardenController {
  update(appearance: Xi4uAppearance): void;
  dispose(): void;
}

/** Local renderer only. The embedding React component owns this controller's lifetime. */
export function createGarden(host: HTMLElement, appearance: Xi4uAppearance, onError: (error: unknown) => void, graphics: Pick<GardenWorldOptions, 'createRenderer' | 'createPixelRenderer'> = {}): GardenController {
  validateAppearance(appearance);
  let lifecycle: GardenLifecycle | undefined, closed = false, startupError: unknown;
  const world = createWorld(host, { ...graphics, ...appearance, onInvalidate: () => lifecycle?.invalidate() });
  const canvas = world.element;
  const fail = (error: unknown) => {
    if (closed) return;
    startupError = error;
    dispose();
    onError(error);
  };
  function lost(event: Event) {
    event.preventDefault();
    fail(new Error('WebGL 上下文已丢失，庭院已暂停'));
  }
  function dispose() {
    if (closed) return;
    closed = true;
    canvas.removeEventListener('webglcontextlost', lost);
    if (lifecycle) lifecycle.dispose(); else world.dispose();
  }
  canvas.style.display = 'block';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.addEventListener('webglcontextlost', lost);
  try {
    lifecycle = manageGarden(host, world, fail);
    if (closed) { lifecycle.dispose(); throw startupError; }
  } catch (error) { dispose(); throw error; }
  return {
    update(next) {
      if (closed) return;
      validateAppearance(next);
      try { world.update(next); lifecycle?.invalidate(); }
      catch (error) { fail(error); }
    },
    dispose,
  };
}
