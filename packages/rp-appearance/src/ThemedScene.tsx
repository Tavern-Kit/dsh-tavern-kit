import React, { lazy, Suspense, useMemo, useSyncExternalStore } from 'react';
import type { AppearanceClientStore } from './client-store.js';
import { resolvedScheme } from './runtime.js';
import { resourceDataUrl, themeResource } from './theme.js';

const Xi4uScene = lazy(async () => ({ default: (await import('./xi4u/index.js')).Xi4uScene }));
function useSystemDark(): boolean {
  const query = useMemo(() => typeof window === 'undefined' ? null : window.matchMedia?.('(prefers-color-scheme: dark)') ?? null, []);
  return useSyncExternalStore(listener => {
    query?.addEventListener('change', listener);
    return () => query?.removeEventListener('change', listener);
  }, () => query?.matches ?? false, () => false);
}
/** Presentation-only: the owner supplies one home or chat scene region with a definite height. */
export function ThemedScene({ store, area }: { store: AppearanceClientStore; area: 'home' | 'chat' }): React.ReactElement | null {
  const { preferences, theme } = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const systemDark = useSystemDark();
  if (!preferences || !theme) return null;
  const scene = theme.manifest.seasons?.find(variant => variant.id === preferences.season)?.scene ?? theme.manifest.scene;
  if (area === 'chat' && (scene.kind !== 'xi4u' || preferences.background !== 'illustrated')) return null;
  const preview = <img src={resourceDataUrl(themeResource(theme, scene.asset ?? theme.manifest.preview))} alt="" draggable={false} />;
  return <div className="tk-themed-scene" data-tk-scene-area={area} data-tk-scene-kind={scene.kind}>
    {scene.kind === 'xi4u' ? <Suspense fallback={preview}><Xi4uScene season={preferences.season} scheme={resolvedScheme(preferences.scheme, systemDark)} className="tk-theme-courtyard" /></Suspense> : preview}
  </div>;
}
