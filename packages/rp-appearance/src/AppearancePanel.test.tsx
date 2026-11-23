// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppearancePanel } from './AppearancePanel.js';
import { AppearanceClientStore } from './client-store.js';
import { AppearancePreferencesController, DEFAULT_APPEARANCE } from './preferences.js';
import { zh } from './locales.js';
import type { AppearancePreferences, AppearanceRemote } from './types.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ThemeLibrary } from './theme-library.js';
import { base64ToBytes, bytesToBase64 } from './theme.js';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const directories: string[] = [];
afterEach(() => { cleanup(); for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
function realPreferences() {
  const directory = mkdtempSync(join(tmpdir(), 'tk-panel-themes-')); directories.push(directory);
  const themes = new ThemeLibrary(join(process.cwd(), 'packages/rp-appearance/themes'), directory);
  let saved: AppearancePreferences = { ...DEFAULT_APPEARANCE };
  const controller = new AppearancePreferencesController({ read: () => saved, write: async next => { themes.get(next.skin); saved = structuredClone(next); } });
  const remote: AppearanceRemote = {
    get: async () => controller.get(), update: patch => controller.update(patch), reset: () => controller.reset(), export: async () => controller.export(),
    listThemes: async () => themes.list(), getTheme: async id => themes.get(id),
    importTheme: async input => themes.importArchive(base64ToBytes(input.base64), input.overwrite),
    exportTheme: async id => ({ filename: `${id}.theme.zip`, mimeType: 'application/zip', base64: bytesToBase64(themes.exportTheme(id)) }),
  };
  let applied: AppearancePreferences | null = null;
  const store = new AppearanceClientStore(remote, next => { applied = next; });
  return { store, remote, saved: () => saved, applied: () => applied };
}

describe('appearance reading controls', () => {
  it('changes skin and message display through the same persisted preference controller', async () => {
    const context = realPreferences();
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    fireEvent.click(view.getByRole('button', { name: '好事岛' }));
    await waitFor(() => expect(view.getByRole('button', { name: '好事岛' }).getAttribute('aria-pressed')).toBe('true'));
    fireEvent.click(view.getByRole('switch'));
    await waitFor(() => expect(view.getByRole('switch').getAttribute('aria-checked')).toBe('false'));
    expect(context.saved()).toMatchObject({ skin: 'island', bubbles: false });
    expect(context.applied()).toMatchObject({ skin: 'island', bubbles: false });
    const restored = new AppearanceClientStore(context.remote, () => {});
    await restored.load();
    expect(restored.getSnapshot().preferences).toMatchObject({ skin: 'island', bubbles: false });
    context.store.dispose(); restored.dispose();
  });

  it('selects the pixel skin, keeps the reading size and restores the saved third theme on reconnect', async () => {
    const context = realPreferences();
    await context.remote.update({ skin: 'island', fontSize: 24, readingWidth: 1120, bubbles: false });
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    fireEvent.click(view.getByRole('button', { name: '像素旅店' }));
    await waitFor(() => expect(view.getByRole('button', { name: '像素旅店' }).getAttribute('aria-pressed')).toBe('true'));
    expect(context.saved()).toMatchObject({ skin: 'pixel', fontSize: 24, readingWidth: 1120, bubbles: false });
    expect(view.getByRole('article', { name: '试着读一小段' }).style.fontSize).toBe('24px');
    await act(() => context.store.load());
    expect(view.getByRole('button', { name: '像素旅店' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(view.getByRole('button', { name: '恢复默认' }));
    await waitFor(() => expect(view.getByRole('button', { name: '经典酒馆' }).getAttribute('aria-pressed')).toBe('true'));
    expect(context.saved()).toEqual(DEFAULT_APPEARANCE);
    context.store.dispose();
  });

  it('keeps courtyard season and system or fixed scheme independently after reconnecting', async () => {
    const context = realPreferences();
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    fireEvent.click(view.getByRole('button', { name: '溪间四时' }));
    await waitFor(() => expect(view.getByRole('button', { name: /^冬$/ })).toBeTruthy());
    fireEvent.click(view.getByRole('button', { name: /^冬$/ }));
    await waitFor(() => expect(context.saved().season).toBe('winter'));
    fireEvent.click(view.getByRole('button', { name: /^深色$/ }));
    await waitFor(() => expect(context.saved()).toMatchObject({ scheme: 'dark', season: 'winter', skin: 'xi4u' }));
    fireEvent.click(view.getByRole('button', { name: '跟随系统' }));
    await waitFor(() => expect(context.saved()).toMatchObject({ scheme: 'system', season: 'winter', skin: 'xi4u' }));
    await act(() => context.store.load());
    expect(view.getByRole('button', { name: /^冬$/ }).getAttribute('aria-pressed')).toBe('true');
    expect(view.getByRole('button', { name: '跟随系统' }).getAttribute('aria-pressed')).toBe('true');
    context.store.dispose();
  });

  it('imports a complete theme, previews a matching id, and only replaces it after the player confirms', async () => {
    const context = realPreferences();
    const original = await context.remote.exportTheme('island');
    const files = unzipSync(base64ToBytes(original.base64));
    const descriptor = files['theme.json']; if (!descriptor) throw new Error('theme descriptor missing');
    const source: unknown = JSON.parse(strFromU8(descriptor)); if (!source || typeof source !== 'object') throw new Error('invalid theme');
    files['theme.json'] = strToU8(JSON.stringify({ ...source, name: '晚安花园' }));
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    const bytes = Uint8Array.from(zipSync(files));
    fireEvent.change(view.getByLabelText('选择主题 ZIP'), { target: { files: [new File([bytes], 'island.zip', { type: 'application/zip' })] } });
    await waitFor(() => expect(view.getByRole('alertdialog')).toBeTruthy());
    expect(view.getByRole('button', { name: '好事岛' })).toBeTruthy();
    fireEvent.click(view.getByRole('button', { name: '确认替换' }));
    await waitFor(() => expect(view.getByRole('button', { name: '晚安花园' })).toBeTruthy());
    expect(view.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(view.getByRole('button', { name: '晚安花园' }));
    await waitFor(() => expect(context.saved().skin).toBe('island'));
    context.store.dispose();
  });

  it('previews a dragged text size and persists it when the player finishes adjusting', async () => {
    const context = realPreferences();
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    const range = view.getByLabelText(/聊天字号/);
    fireEvent.change(range, { target: { value: '23' } });
    expect(view.getByText('23 px')).toBeTruthy();
    expect(context.saved().fontSize).toBe(17);
    fireEvent.pointerUp(range);
    await waitFor(() => expect(context.saved().fontSize).toBe(23));
    expect(context.applied()?.fontSize).toBe(23);
    context.store.dispose();
  });

  it('shows the current reading size in the live passage before saving, without changing the chosen skin', async () => {
    const context = realPreferences();
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    const passage = view.getByRole('article', { name: '试着读一小段' });
    fireEvent.change(view.getByLabelText(/聊天字号/), { target: { value: '21' } });
    expect(passage.style.fontSize).toBe('21px');
    expect(context.saved().fontSize).toBe(17);
    expect(view.getByRole('button', { name: '经典酒馆' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyUp(view.getByLabelText(/聊天字号/), { key: 'ArrowRight' });
    await waitFor(() => expect(context.saved().fontSize).toBe(21));
    context.store.dispose();
  });

  it('keeps width, custom background and reset controls connected to the persisted preferences', async () => {
    const context = realPreferences();
    const view = render(<AppearancePanel store={context.store} t={key => zh[key]} />);
    await act(() => context.store.load());
    const width = view.getByLabelText(/聊天宽度/);
    fireEvent.change(width, { target: { value: '1120' } });
    fireEvent.pointerUp(width);
    await waitFor(() => expect(context.saved().readingWidth).toBe(1120));
    fireEvent.click(view.getByRole('button', { name: '自己的背景' }));
    await waitFor(() => expect(view.getByLabelText('底色')).toBeTruthy());
    fireEvent.change(view.getByLabelText('底色'), { target: { value: '#e8e5dc' } });
    await waitFor(() => expect(context.saved()).toMatchObject({ background: 'custom', backgroundColor: '#e8e5dc' }));
    const image = new File([new Uint8Array([137, 80, 78, 71])], 'letter.png', { type: 'image/png' });
    fireEvent.change(view.getByLabelText('选择背景图片'), { target: { files: [image] } });
    await waitFor(() => expect(context.saved().backgroundImage).toBe('data:image/png;base64,iVBORw=='));
    fireEvent.click(view.getByRole('button', { name: '移除' }));
    await waitFor(() => expect(context.saved().backgroundImage).toBeNull());
    expect(context.saved()).toMatchObject({ background: 'custom', backgroundColor: '#e8e5dc', readingWidth: 1120 });
    fireEvent.click(view.getByRole('button', { name: '恢复默认' }));
    await waitFor(() => expect(context.saved()).toEqual(DEFAULT_APPEARANCE));
    context.store.dispose();
  });

  it('reloads persisted preferences after reconnect and stops notifying a disposed Client', async () => {
    const context = realPreferences();
    await context.store.load();
    await context.remote.update({ skin: 'island', readingWidth: 1040 });
    await context.store.load();
    expect(context.store.getSnapshot().preferences).toMatchObject({ skin: 'island', readingWidth: 1040 });
    const last = context.applied();
    context.store.dispose();
    await context.remote.update({ fontSize: 25 });
    await context.store.load();
    expect(context.applied()).toBe(last);
  });
});
