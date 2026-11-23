import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { AppearanceClientStore } from './client-store.js';
import { AppearancePreferencesController, DEFAULT_APPEARANCE } from './preferences.js';
import { ThemeLibrary } from './theme-library.js';
import { base64ToBytes, bytesToBase64 } from './theme.js';
import type { AppearancePreferences, AppearanceRemote, ThemeDocument } from './types.js';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'tk-theme-client-')); directories.push(directory);
  const library = new ThemeLibrary(fileURLToPath(new URL('../themes/', import.meta.url)), directory);
  let saved = { ...DEFAULT_APPEARANCE };
  const preferences = new AppearancePreferencesController({ read: () => saved, write: async next => { library.get(next.skin); saved = next; } });
  const remote: AppearanceRemote = {
    get: async () => preferences.get(), update: patch => preferences.update(patch), reset: () => preferences.reset(), export: async () => preferences.export(),
    listThemes: async () => library.list(), getTheme: async id => library.get(id),
    importTheme: async input => library.importArchive(base64ToBytes(input.base64), input.overwrite),
    exportTheme: async id => ({ filename: `${id}.theme.zip`, mimeType: 'application/zip', base64: bytesToBase64(library.exportTheme(id)) }),
  };
  let applied: { preferences: AppearancePreferences; theme: ThemeDocument } | undefined;
  const store = new AppearanceClientStore(remote, (preferences, theme) => { applied = { preferences, theme }; });
  return { store, remote, applied: () => applied, library };
}

describe('appearance Client theme management', () => {
  it('loads the chosen full theme and keeps all reading and season preferences when selecting another one', async () => {
    const context = fixture();
    await context.store.load();
    expect(context.store.getSnapshot().themes.map(item => item.id).sort()).toEqual(['classic', 'island', 'pixel', 'xi4u']);
    expect(context.applied()?.theme.manifest.id).toBe('classic');
    await context.store.update({ skin: 'xi4u', scheme: 'dark', season: 'autumn', fontSize: 21, bubbles: false });
    expect(context.applied()).toMatchObject({ preferences: { skin: 'xi4u', scheme: 'dark', season: 'autumn', fontSize: 21, bubbles: false }, theme: { manifest: { id: 'xi4u' } } });
    await context.store.update({ skin: 'island' });
    expect(context.applied()?.preferences).toMatchObject({ skin: 'island', scheme: 'dark', season: 'autumn', fontSize: 21, bubbles: false });
    context.store.dispose();
  });

  it('waits for confirmation before replacing a matching theme id and refreshes the active document afterwards', async () => {
    const context = fixture(); await context.store.load();
    const original = await context.remote.exportTheme('classic');
    const files = unzipSync(base64ToBytes(original.base64));
    const descriptor = files['theme.json']; if (!descriptor) throw new Error('missing descriptor');
    const data: unknown = JSON.parse(strFromU8(descriptor));
    if (!data || typeof data !== 'object') throw new Error('invalid descriptor');
    files['theme.json'] = strToU8(JSON.stringify({ ...data, name: '窗边酒馆' }));
    await context.store.importArchive({ filename: 'classic.zip', base64: bytesToBase64(zipSync(files)) });
    expect(context.store.getSnapshot().pendingImport).toMatchObject({ id: 'classic', name: '窗边酒馆' });
    expect(context.applied()?.theme.manifest.name).toBe('经典酒馆');
    await context.store.confirmImport();
    expect(context.store.getSnapshot().pendingImport).toBeNull();
    expect(context.applied()?.theme.manifest.name).toBe('窗边酒馆');
    context.store.dispose();
  });
});
