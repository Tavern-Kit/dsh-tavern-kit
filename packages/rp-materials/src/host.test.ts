import type { Plugin } from '@deepseek-ai/cordis';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { afterEach, describe, expect, it } from 'vitest';
import { hostFixture, installedModule, type HostFixture } from '../../../tests/fixtures/host-runtime.js';
import type { MaterialMetadata, MaterialRevision } from './types.js';

const opened: HostFixture[] = [];
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const card = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: '阿岚', description: '旧城药师', first_mes: '回来了。', unknownAuthorField: '保留' } };
let callSequence = 0;
afterEach(async () => { for (const app of opened.splice(0).reverse()) await app.close(); });
async function start(): Promise<HostFixture> {
  const app = await hostFixture();
  opened.push(app);
  const native: unknown = await installedModule('@deepseek-ai/dsh-tool-executor-native');
  if (!native || typeof native !== 'object' || !('apply' in native) || typeof native.apply !== 'function') throw new Error('installed native executor is unavailable');
  await app.ctx.plugin(native as Plugin);
  return app;
}
async function tool(app: HostFixture, action: 'metadata' | 'revise' | 'createPersona' | 'revisePersona', id: string | undefined, payload: unknown): Promise<unknown> {
  const batch = await app.ctx.tools.execute({
    calls: [{ type: 'tool-call', id: ToolCallId(`materials-parity-${++callSequence}`), name: 'tavern_materials', arguments: JSON.stringify({ action, id, json: JSON.stringify(payload) }) }],
    signal: new AbortController().signal,
  });
  const result = batch.results[0]?.result;
  if (!result) throw new Error('material tool did not return a result');
  if (result.isError) throw new Error(result.error.message);
  if (typeof result.value !== 'string') throw new Error('material tool did not return JSON text');
  return JSON.parse(result.value) as unknown;
}

// Uses the real installed tool executor and isolated Host SQLite; no registry stubs.
describe('material tool and UI Host operation parity', { timeout: 20_000 }, () => {
  it('persists tags and all metadata fields through the same operation as the UI', async () => {
    const app = await start();
    const item = app.materials.importFile('角色.json', bytes(card));
    const patch: MaterialMetadata = { name: '雨夜', category: '收藏', tags: ['长聊', '旧城'], enabled: false };
    const result = await tool(app, 'metadata', item.id, patch);
    expect(result).toEqual(app.materials.get(item.id));
    expect(app.materials.get(item.id)).toMatchObject(patch);
    const afterTool = app.materials.get(item.id);
    const afterUi = app.materials.metadata(item.id, patch);
    // Separate real calls update their own timestamp; all saved content is identical.
    expect({ ...afterUi, updatedAt: afterTool.updatedAt }).toEqual(afterTool);
  });

  it('keeps full raw edits, field patches and versioned bindings identical to UI revisions', async () => {
    const app = await start();
    const item = app.materials.importFile('角色.json', bytes(card));
    const book = app.materials.importFile('世界书.json', bytes({ entries: [{ keys: ['雨'], content: '雨夜的约定' }] }));
    const preset = app.materials.importFile('预设.json', bytes({ prompts: [{ identifier: 'main', role: 'system', content: '保持称呼' }] }));
    const bindings = { worldbooks: [{ id: book.id, version: 1 }], preset: { id: preset.id, version: 1 } };
    const revision: MaterialRevision = { raw: { ...card, data: { ...card.data, description: '先改完整原文' } }, bindings };
    const fromTool = await tool(app, 'revise', item.id, revision);
    expect(fromTool).toEqual(app.materials.readVersion({ id: item.id, version: 2 }));
    expect(fromTool).toMatchObject({ raw: revision.raw, bindings, projection: { character: { description: '先改完整原文' } } });
    const fromUi = app.materials.revise(item.id, revision);
    expect(fromUi.raw).toEqual(app.materials.readVersion({ id: item.id, version: 2 }).raw);
    expect(fromUi.bindings).toEqual(bindings);
    expect(fromUi.projection).toEqual(app.materials.readVersion({ id: item.id, version: 2 }).projection);

    await tool(app, 'revise', item.id, { patch: { data: { description: '再改一个字段' } }, bindings: { worldbooks: [], preset: null } });
    expect(app.materials.get(item.id).current).toMatchObject({ version: 4, raw: { data: { description: '再改一个字段', unknownAuthorField: '保留' } }, bindings: { worldbooks: [], preset: null } });
    await tool(app, 'revise', item.id, { bindings });
    expect(app.materials.get(item.id).current).toMatchObject({ version: 5, raw: { data: { description: '再改一个字段' } }, bindings });
    expect(app.materials.readVersion({ id: item.id, version: 1 }).raw).toEqual(card);
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('creates and revises versioned personas through the same public Host operations without a model call', async () => {
    const app = await start();
    const created = await tool(app, 'createPersona', undefined, { name: '小雨', description: '海边的旅人' });
    expect(created).toMatchObject({ kind: 'persona', currentVersion: 1, current: { projection: { persona: { name: '小雨', description: '海边的旅人' } } } });
    const item = app.materials.list({ kind: 'persona' })[0]!;
    const revised = await tool(app, 'revisePersona', item.id, { name: '雨', description: '已经认识阿岚' });
    expect(revised).toEqual(app.materials.readVersion({ id: item.id, version: 2 }));
    expect(app.materials.readVersion({ id: item.id, version: 1 }).projection.persona?.description).toBe('海边的旅人');
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('rejects malformed tool DTOs before changing metadata or creating a version', async () => {
    const app = await start();
    const item = app.materials.importFile('角色.json', bytes(card));
    const before = app.materials.get(item.id);
    await expect(tool(app, 'metadata', item.id, { tags: '长聊' })).rejects.toThrow();
    await expect(tool(app, 'revise', item.id, { patch: [] })).rejects.toThrow();
    await expect(tool(app, 'revise', item.id, { bindings: { worldbooks: [{ id: 'missing', version: '1' }], preset: null } })).rejects.toThrow();
    expect(app.materials.get(item.id)).toEqual(before);
    expect(app.materials.versions(item.id)).toEqual([{ id: item.id, version: 1 }]);
  });
});
