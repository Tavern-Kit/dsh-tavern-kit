import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { AppearancePreferencesController, DEFAULT_APPEARANCE } from './preferences.js';
import type { AppearanceSettingsStore, AppearancePreferences } from './types.js';

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));
function diskStore(): AppearanceSettingsStore {
  const directory = mkdtempSync(join(tmpdir(), 'tk-appearance-'));
  directories.push(directory);
  const path = join(directory, 'settings.json');
  writeFileSync(path, JSON.stringify({ ...DEFAULT_APPEARANCE, unrelatedPluginField: 'keep' }));
  return {
    read: () => JSON.parse(readFileSync(path, 'utf8')) as unknown,
    write: async preferences => {
      const previous: unknown = JSON.parse(readFileSync(path, 'utf8'));
      writeFileSync(path, JSON.stringify({ ...(typeof previous === 'object' && previous !== null ? previous : {}), ...preferences }));
    },
  };
}

describe('appearance preferences', () => {
  it('restores the chosen skin and reading settings after the controller is recreated', async () => {
    const store = diskStore();
    const first = new AppearancePreferencesController(store);
    await first.update({ skin: 'island', fontSize: 21, readingWidth: 980, bubbles: false });
    const restored = new AppearancePreferencesController(store);
    expect(restored.get()).toMatchObject({ skin: 'island', fontSize: 21, readingWidth: 980, bubbles: false });
    expect(store.read()).toHaveProperty('unrelatedPluginField', 'keep');
  });

  it('keeps existing reading and local background preferences when the pixel skin is saved, restored and exported', async () => {
    const store = diskStore();
    const controller = new AppearancePreferencesController(store);
    await controller.update({ skin: 'island', fontSize: 23, readingWidth: 1120, bubbles: false, background: 'custom', backgroundColor: '#26314d', backgroundImage: 'data:image/png;base64,aGVsbG8=' });
    await controller.update({ skin: 'pixel' });
    const restored = new AppearancePreferencesController(store);
    expect(restored.get()).toMatchObject({ skin: 'pixel', fontSize: 23, readingWidth: 1120, bubbles: false, background: 'custom', backgroundColor: '#26314d', backgroundImage: 'data:image/png;base64,aGVsbG8=' });
    expect(JSON.parse(restored.export().text) as unknown).toMatchObject({ format: 'tavern-kit.appearance', version: 1, preferences: { skin: 'pixel', fontSize: 23, readingWidth: 1120 } });
    expect(store.read()).toHaveProperty('unrelatedPluginField', 'keep');
    await restored.reset();
    expect(restored.get()).toEqual(DEFAULT_APPEARANCE);
    expect(restored.get().skin).toBe('classic');
  });

  it('keeps a custom theme id and season independently from the system or fixed colour scheme', async () => {
    const store = diskStore();
    const controller = new AppearancePreferencesController(store);
    expect(controller.get()).toMatchObject({ scheme: 'system', season: 'spring' });
    await controller.update({ skin: 'my-quiet-garden', scheme: 'dark', season: 'winter', fontSize: 22, bubbles: false });
    await controller.update({ scheme: 'system' });
    const restored = new AppearancePreferencesController(store);
    expect(restored.get()).toMatchObject({ skin: 'my-quiet-garden', scheme: 'system', season: 'winter', fontSize: 22, bubbles: false });
    await restored.update({ season: 'summer' });
    expect(restored.get()).toMatchObject({ skin: 'my-quiet-garden', scheme: 'system', season: 'summer', fontSize: 22 });
  });

  it('changes one preference without resetting the others or leaking mutable references', async () => {
    const controller = new AppearancePreferencesController(diskStore());
    await controller.update({ fontSize: 20, bubbles: false });
    const read = controller.get();
    read.fontSize = 12;
    await controller.update({ readingWidth: 720 });
    expect(controller.get()).toMatchObject({ fontSize: 20, readingWidth: 720, bubbles: false });
  });

  it.each([
    { fontSize: 4 }, { readingWidth: -1 }, { skin: '../unknown' }, { bubbles: 'false' },
    { backgroundImage: 'https://example.org/photo.png' }, { backgroundColor: 'red;url(https://example.org)' },
    { backgroundImage: 'data:image/svg+xml;base64,PHN2Zz4=' },
  ])('rejects invalid external preference data without persisting it: %o', async invalid => {
    const controller = new AppearancePreferencesController(diskStore());
    const before = controller.get();
    await expect(controller.update(invalid)).rejects.toThrow();
    expect(controller.get()).toEqual(before);
  });

  it('keeps the last saved preferences if the settings layer refuses a write', async () => {
    const controller = new AppearancePreferencesController({
      read: () => ({ ...DEFAULT_APPEARANCE, skin: 'island' }),
      write: async () => { throw new Error('settings write refused'); },
    });
    await expect(controller.update({ fontSize: 24 })).rejects.toThrow('settings write refused');
    expect(controller.get()).toMatchObject({ skin: 'island', fontSize: 17 });
  });

  it('exports a versioned local preset including the image and resets without touching chat data', async () => {
    const store = diskStore();
    const controller = new AppearancePreferencesController(store);
    const image = 'data:image/png;base64,aGVsbG8=';
    await controller.update({ skin: 'island', background: 'custom', backgroundImage: image });
    const exported = controller.export();
    const document = JSON.parse(exported.text) as { format: string; version: number; preferences: AppearancePreferences };
    expect(exported.mimeType).toBe('application/json');
    expect(document).toMatchObject({ format: 'tavern-kit.appearance', version: 1, preferences: { skin: 'island', backgroundImage: image } });
    await controller.reset();
    expect(controller.get()).toEqual(DEFAULT_APPEARANCE);
    expect(store.read()).toHaveProperty('unrelatedPluginField', 'keep');
  });
});
