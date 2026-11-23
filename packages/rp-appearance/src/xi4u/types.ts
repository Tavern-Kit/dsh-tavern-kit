import type { Camera, Scene, WebGLRenderer } from 'three';
export type Xi4uSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type Xi4uScheme = 'light' | 'dark';
export interface Xi4uAppearance { season: Xi4uSeason; scheme: Xi4uScheme }
export interface GardenPostprocessor {
  setStyle(style: 'clear' | 'pixel'): void;
  updateNight(mix: number): void;
  resize(width: number, height: number): void;
  render(): void;
  dispose(): void;
  getScenePixelSize(): number;
}
export interface GardenWorld {
  readonly scene: Scene;
  readonly camera: Camera;
  readonly element: HTMLCanvasElement;
  getTime(): { season: Xi4uSeason; hour: number; night: boolean; running: boolean };
  update(appearance: Xi4uAppearance): void;
  resize(width: number, height: number): void;
  render(deltaSeconds: number): void;
  setInteractive(enabled: boolean): void;
  dispose(): void;
}
/** GPU backend factories isolate browser-only surfaces; the production scene graph is always the original garden. */
export interface GardenWorldOptions extends Xi4uAppearance {
  onInvalidate?: () => void;
  createRenderer?: () => WebGLRenderer;
  createPixelRenderer?: (renderer: WebGLRenderer, scene: Scene, camera: Camera) => GardenPostprocessor;
}
export function validateAppearance(appearance: Xi4uAppearance): void {
  if (!['spring', 'summer', 'autumn', 'winter'].includes(appearance.season)) throw new Error('庭院季节不可用');
  if (appearance.scheme !== 'light' && appearance.scheme !== 'dark') throw new Error('庭院配色不可用');
}
