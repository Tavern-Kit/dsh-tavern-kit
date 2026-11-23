// @vitest-environment jsdom
import * as THREE from 'three';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createWorld } from './vendor/world.js';
import { createGarden } from './garden.js';

/** Only browser GPU/2D surfaces are substituted; every garden mesh, material, clock and season module is real. */
function gpuSurface() {
  const canvas = document.createElement('canvas');
  let disposed = 0, lost = 0;
  const renderer = {
    domElement: canvas, shadowMap: { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap },
    setClearColor() {}, setPixelRatio() {}, getPixelRatio: () => 1,
    setSize(width: number, height: number) { canvas.width = width; canvas.height = height; },
    dispose() { disposed++; }, forceContextLoss() { lost++; },
    renderLists: { dispose() {} },
  } as unknown as THREE.WebGLRenderer;
  return { renderer, disposed: () => disposed, lost: () => lost };
}
function sceneFixture(season: 'spring'|'summer'|'autumn'|'winter' = 'spring', scheme: 'light'|'dark' = 'light') {
  const host = document.createElement('div'); document.body.append(host);
  const gpu = gpuSurface();
  const world = createWorld(host, { season, scheme, createRenderer: () => gpu.renderer, createPixelRenderer: () => ({
    setStyle() {}, updateNight() {}, resize() {}, render() {}, dispose() {}, getScenePixelSize: () => 1,
  }) });
  world.resize(480, 320); world.render(0);
  return { world, host, gpu };
}
beforeEach(() => {
  const context = { fillStyle: '', imageSmoothingEnabled: false, fillRect() {}, createRadialGradient: () => ({ addColorStop() {} }) };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => context) as unknown as typeof HTMLCanvasElement.prototype.getContext);
});
afterEach(() => { document.body.replaceChildren(); document.documentElement.removeAttribute('style'); document.body.removeAttribute('style'); vi.restoreAllMocks(); });

describe('the vendored three-dimensional garden', () => {
  it('keeps the real house, creek, ancient tree, seasonal props and animals while external state owns time', () => {
    const { world, gpu } = sceneFixture('spring', 'dark');
    expect(world.getTime()).toMatchObject({ season: 'spring', hour: 22, night: true, running: false });
    expect(world.scene.getObjectByName('organic-garden-ground')).toBeTruthy();
    expect(world.scene.getObjectByName('ancient-tree-middle-branches')).toBeTruthy();
    expect(world.scene.getObjectByName('wooden-footbridge')).toBeTruthy();
    expect(world.scene.getObjectByName('sleeping-orange-white-cat')).toBeTruthy();
    expect(world.scene.getObjectByName('summer-tatami-fan')).toBeTruthy();
    expect(world.scene.getObjectByName('autumn-small-veranda-book')).toBeTruthy();
    expect(world.scene.getObjectByName('winter-long-tailed-tit')).toBeTruthy();
    expect(world.scene.getObjectByName('cherry-blossoms')?.visible).toBe(true);
    expect(world.scene.getObjectByName('snow-on-branches')?.visible).toBe(false);
    for (let i = 0; i < 40; i++) world.render(30);
    expect(world.getTime()).toMatchObject({ season: 'spring', hour: 22, night: true, running: false });
    world.update({ season: 'winter', scheme: 'light' }); world.render(0);
    expect(world.getTime()).toMatchObject({ season: 'winter', hour: 12, night: false, running: false });
    expect(world.scene.getObjectByName('cherry-blossoms')?.visible).toBe(false);
    expect(world.scene.getObjectByName('snow-on-branches')?.visible).toBe(true);
    expect(world.scene.getObjectByName('winter-day-soup-bowl')?.visible).toBe(true);
    world.update({ season: 'summer', scheme: 'light' }); world.render(0);
    expect(world.scene.getObjectByName('summer-refreshments')?.visible).toBe(true);
    world.update({ season: 'autumn', scheme: 'light' }); world.render(0);
    expect(world.scene.getObjectByName('event-autumn-squirrel')?.visible).toBe(true);
    world.dispose(); expect(gpu.disposed()).toBe(1); expect(gpu.lost()).toBe(1);
  }, 20000);

  it('paints only its own host and releases shared geometries, textures and materials exactly once', () => {
    document.documentElement.style.setProperty('--scene-background', 'host-root'); document.body.style.backgroundColor = 'rgb(1, 2, 3)';
    const title = document.title;
    const listen = vi.spyOn(document, 'addEventListener'), unlisten = vi.spyOn(document, 'removeEventListener');
    const { world, host } = sceneFixture();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }));
    const controlKeyUp = listen.mock.calls.find(([name]) => name === 'keyup')?.[1];
    expect(controlKeyUp).toBeDefined();
    world.update({ season: 'autumn', scheme: 'dark' }); world.render(0);
    expect(document.documentElement.style.getPropertyValue('--scene-background')).toBe('host-root');
    expect(document.body.style.backgroundColor).toBe('rgb(1, 2, 3)'); expect(document.title).toBe(title);
    expect(host.style.getPropertyValue('--xi4u-background')).not.toBe('');
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    world.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          resources.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
        }
      }
    });
    const counts = new Map<object, number>();
    for (const resource of resources) resource.addEventListener('dispose', () => { counts.set(resource, (counts.get(resource) ?? 0) + 1); });
    expect(resources.size).toBeGreaterThan(500);
    world.dispose(); world.dispose();
    expect([...resources].every(resource => counts.get(resource) === 1)).toBe(true);
    expect(host.childElementCount).toBe(0); expect(world.scene.children).toHaveLength(0);
    expect.soft(unlisten.mock.calls.some(([name, listener]) => name === 'keyup' && listener === controlKeyUp)).toBe(true);
    expect.soft(host.style.getPropertyValue('--xi4u-background')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--scene-background')).toBe('host-root');
  }, 20000);

  it('unmounts the actual mounted garden after context loss and exposes that error only once', () => {
    const host = document.createElement('div'); document.body.append(host);
    host.getBoundingClientRect = () => ({ width: 480, height: 320, left: 0, top: 0, right: 480, bottom: 320, x: 0, y: 0, toJSON() {} });
    const gpu = gpuSurface(), errors: unknown[] = [];
    const controller = createGarden(host, { season: 'summer', scheme: 'light' }, error => errors.push(error), {
      createRenderer: () => gpu.renderer,
      createPixelRenderer: () => ({ setStyle() {}, updateNight() {}, resize() {}, render() {}, dispose() {}, getScenePixelSize: () => 1 }),
    });
    controller.update({ season: 'winter', scheme: 'dark' });
    const lost = new Event('webglcontextlost', { cancelable: true });
    gpu.renderer.domElement.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(errors).toHaveLength(1); expect(String(errors[0])).toContain('WebGL');
    expect(host.childElementCount).toBe(0); expect(gpu.disposed()).toBe(1); expect(gpu.lost()).toBe(1);
    gpu.renderer.domElement.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    controller.dispose(); expect(errors).toHaveLength(1); expect(gpu.disposed()).toBe(1);
  }, 20000);

  it('releases the acquired WebGL context when postprocessing initialization fails', () => {
    const host = document.createElement('div'); document.body.append(host);
    const gpu = gpuSurface();
    expect(() => createWorld(host, { season: 'summer', scheme: 'light', createRenderer: () => gpu.renderer, createPixelRenderer() { throw new Error('shader unsupported'); } })).toThrow('shader unsupported');
    expect(gpu.disposed()).toBe(1); expect(gpu.lost()).toBe(1); expect(host.childElementCount).toBe(0);
  });
});
