import type { Context } from '@deepseek-ai/cordis';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import type { ToolExecutionResult, ToolExecutor } from '@deepseek-ai/dsh-tools';
import { afterEach, describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { base64ToBytes, bytesToBase64 } from './theme.js';
import { hostFixture, installedModule, type HostFixture } from '../../../tests/fixtures/host-runtime.js';

const fixtures: HostFixture[] = [];
afterEach(async () => { for (const fixture of fixtures.splice(0).reverse()) await fixture.close(); });

async function start(): Promise<HostFixture> {
  const app = await hostFixture();
  fixtures.push(app);
  const module: unknown = await installedModule('@deepseek-ai/dsh-tool-executor-native');
  if (!module || typeof module !== 'object' || !('NativeToolExecutor' in module) || typeof module.NativeToolExecutor !== 'function') throw new TypeError('installed native tool executor is unavailable');
  const Executor = module.NativeToolExecutor as new (ctx: Context) => ToolExecutor;
  app.ctx.tools.setExecutor(new Executor(app.ctx));
  return app;
}

async function call(app: HostFixture, args: unknown, signal = new AbortController().signal): Promise<ToolExecutionResult> {
  const batch = await app.ctx.tools.execute({
    calls: [{ type: 'tool-call', id: ToolCallId('appearance-test'), name: 'tavern_appearance', arguments: JSON.stringify(args) }],
    signal,
  });
  const result = batch.results[0]?.result;
  if (!result) throw new Error('appearance tool returned no outcome');
  return result;
}

function value(result: ToolExecutionResult): unknown {
  expect(result.isError, JSON.stringify(result)).toBe(false);
  if (result.isError || typeof result.value !== 'string') throw new Error('appearance tool did not return its JSON result');
  return JSON.parse(result.value) as unknown;
}

function exportText(result: unknown): string {
  if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string') throw new Error('appearance export has no text');
  return result.text;
}

describe('ordinary assistant appearance operations on the real Host', { timeout: 20_000 }, () => {
  it('changes, reads, exports and resets the same saved preferences as the UI, then unloads its tool', async () => {
    const app = await start();
    expect(value(await call(app, { action: 'get' }))).toMatchObject({ skin: 'classic', fontSize: 17, readingWidth: 680, bubbles: true });

    expect(value(await call(app, { action: 'update', patch: { skin: 'island', fontSize: 21, readingWidth: 980, bubbles: false } }))).toMatchObject({ skin: 'island', fontSize: 21, readingWidth: 980, bubbles: false });
    expect(await app.appearance.get()).toMatchObject({ skin: 'island', fontSize: 21, readingWidth: 980, bubbles: false });
    // A UI-side change is immediately visible through the ordinary tool as well.
    await app.appearance.update({ background: 'plain' });
    expect(value(await call(app, { action: 'get' }))).toMatchObject({ skin: 'island', background: 'plain' });
    const exported = value(await call(app, { action: 'export' }));
    expect(exported).toMatchObject({ filename: 'tavern-kit-appearance.json', mimeType: 'application/json' });
    expect(JSON.parse(exportText(exported)) as unknown).toMatchObject({ format: 'tavern-kit.appearance', version: 1, preferences: { skin: 'island', fontSize: 21, readingWidth: 980, bubbles: false, background: 'plain' } });

    expect(value(await call(app, { action: 'reset' }))).toMatchObject({ skin: 'classic', fontSize: 17, readingWidth: 680, bubbles: true, background: 'illustrated', backgroundImage: null });
    expect(await app.appearance.get()).toMatchObject({ skin: 'classic', fontSize: 17, readingWidth: 680, bubbles: true });
    expect(app.adapter.calls).toHaveLength(0);
    await app.unloadAppearance();
    expect(await call(app, { action: 'get' })).toMatchObject({ isError: true, error: { info: { code: 'UNKNOWN_TOOL' } } });
    expect(app.chat.list()).toEqual([]);
  });

  it('saves and exports the pixel skin through the same real Host tool and user-facing service without changing reading preferences', async () => {
    const app = await start();
    await app.appearance.update({ fontSize: 25, readingWidth: 1040, bubbles: false });
    expect(value(await call(app, { action: 'update', patch: { skin: 'pixel' } }))).toMatchObject({ skin: 'pixel', fontSize: 25, readingWidth: 1040, bubbles: false });
    expect(await app.appearance.get()).toMatchObject({ skin: 'pixel', fontSize: 25, readingWidth: 1040, bubbles: false });
    expect(JSON.parse(exportText(value(await call(app, { action: 'export' })))) as unknown).toMatchObject({ preferences: { skin: 'pixel', fontSize: 25, readingWidth: 1040, bubbles: false } });
    expect(value(await call(app, { action: 'reset' }))).toMatchObject({ skin: 'classic', fontSize: 17 });
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('uses four local themes and preserves independent season, tone and reading settings through the real tool and theme export', async () => {
    const app = await start();
    expect((await app.appearance.listThemes()).map(item => item.id).sort()).toEqual(['classic', 'island', 'pixel', 'xi4u']);
    expect(value(await call(app, { action: 'update', patch: { skin: 'xi4u', scheme: 'dark', season: 'winter', fontSize: 23 } }))).toMatchObject({ skin: 'xi4u', scheme: 'dark', season: 'winter', fontSize: 23 });
    await app.appearance.update({ scheme: 'system' });
    expect(await app.appearance.get()).toMatchObject({ skin: 'xi4u', scheme: 'system', season: 'winter', fontSize: 23 });
    const exported = await app.appearance.exportTheme('island');
    const files = unzipSync(base64ToBytes(exported.base64));
    const descriptor = files['theme.json'];
    if (!descriptor) throw new Error('export has no descriptor');
    const manifest: unknown = JSON.parse(strFromU8(descriptor));
    if (!manifest || typeof manifest !== 'object' || !('id' in manifest)) throw new Error('descriptor is not a theme');
    files['theme.json'] = strToU8(JSON.stringify({ ...manifest, id: 'garden-copy', name: '花园副本' }));
    const imported = await app.appearance.importTheme({ filename: 'garden.zip', base64: bytesToBase64(zipSync(files)) });
    expect(imported).toMatchObject({ status: 'imported', theme: { id: 'garden-copy', name: '花园副本' } });
    await app.appearance.update({ skin: 'garden-copy' });
    expect(value(await call(app, { action: 'get' }))).toMatchObject({ skin: 'garden-copy', scheme: 'system', season: 'winter', fontSize: 23 });
    expect(await app.appearance.importTheme({ filename: 'garden.zip', base64: bytesToBase64(zipSync(files)) })).toMatchObject({ status: 'needs-confirmation' });
    await expect(app.appearance.update({ skin: 'not-installed' })).rejects.toThrow();
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('rejects invalid or non-preference updates without changing saved preferences', async () => {
    const app = await start();
    await app.appearance.update({ skin: 'island', fontSize: 20 });
    expect(value(await call(app, { action: 'get' }))).toMatchObject({ skin: 'island', fontSize: 20 });
    for (const patch of [
      { fontSize: 4 },
      { fontSize: 20.5 },
      { backgroundImage: 'https://example.org/image.png' },
      { backgroundImage: 'data:image/svg+xml;base64,PHN2Zz4=' },
      { skin: 'classic', credentials: { apiKey: 'must-not-be-accepted' } },
    ]) {
      expect(await call(app, { action: 'update', patch })).toMatchObject({ isError: true });
      expect(await app.appearance.get()).toMatchObject({ skin: 'island', fontSize: 20 });
    }
    expect(await call(app, { action: 'update' })).toMatchObject({ isError: true });
    const stopped = new AbortController();
    stopped.abort();
    expect(await call(app, { action: 'reset' }, stopped.signal)).toMatchObject({ isError: true });
    expect(await app.appearance.get()).toMatchObject({ skin: 'island', fontSize: 20 });
    expect(app.adapter.calls).toHaveLength(0);
  });
});
