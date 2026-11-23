import { useEffect, useMemo, useReducer } from 'react';
import type { MaterialVersionRef } from '@tavern-kit/rp-materials/types';
import type { ChatPanelApi } from './ChatPanel.js';

interface PortraitCache {
  requested: Set<string>;
  images: ReadonlyMap<string, string>;
  active: boolean;
}

/** Version-owned, local reading portraits; no image URL comes from raw material fields. */
export function usePersonaPortraits(
  refs: readonly MaterialVersionRef[],
  api: Pick<ChatPanelApi, 'materialVersion' | 'resources'>,
): ReadonlyMap<string, string> {
  const cache = useMemo<PortraitCache>(() => ({ requested: new Set(), images: new Map(), active: false }), [api]);
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    cache.active = true;
    return () => { cache.active = false; };
  }, [cache]);

  useEffect(() => {
    if (!api.resources) return;
    async function read(ref: MaterialVersionRef, key: string): Promise<void> {
      const version = await api.materialVersion(ref);
      if (!cache.active || version.id !== ref.id || version.version !== ref.version) return;
      const path = version.projection.persona?.avatarPath;
      if (!path || /^(?:[a-z][a-z\d+.-]*:|[\\/])/iu.test(path)) return;
      const resource = (await api.resources?.(ref))?.find(value => value.path === path);
      if (!cache.active || !resource || !/^image\/(?:png|jpeg|webp)$/u.test(resource.mediaType) || !resource.base64) return;
      cache.images = new Map(cache.images).set(key, `data:${resource.mediaType};base64,${resource.base64}`);
      refresh();
    }
    for (const value of refs) {
      const ref = { id: value.id, version: value.version }, key = `${ref.id}@${ref.version}`;
      if (cache.requested.has(key)) continue;
      cache.requested.add(key);
      // Missing or failed local images keep the caller's initial badge, without retrying per chunk.
      void read(ref, key).catch(() => {});
    }
  }, [refs, api, cache]);

  return cache.images;
}
