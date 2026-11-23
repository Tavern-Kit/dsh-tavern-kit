import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { PreviewTicket } from './types.js';
import { join } from 'node:path';
import type { Plugin } from '@deepseek-ai/cordis';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { afterEach, describe, expect, it } from 'vitest';
import { hostFixture, installedModule, type HostFixture } from '../../../tests/fixtures/host-runtime.js';
import { deepseekArchive } from '../../../tests/fixtures/host-archive.js';

const fixtures: HostFixture[] = [];
afterEach(async () => { for (const fixture of fixtures.splice(0).reverse()) await fixture.close(); });
async function start(): Promise<HostFixture> {
  const app = await hostFixture();
  fixtures.push(app);
  const native: unknown = await installedModule('@deepseek-ai/dsh-tool-executor-native');
  if (!native || typeof native !== 'object' || !('apply' in native) || typeof native.apply !== 'function') throw new TypeError('Native tool executor is unavailable');
  await app.ctx.plugin(native as Plugin);
  return app;
}
async function call(app: HostFixture, input: Record<string, unknown>): Promise<unknown> {
  const batch = await app.ctx.tools.execute({ calls: [{ type: 'tool-call', id: ToolCallId(randomUUID()), name: 'tavern_deepseek_import', arguments: JSON.stringify(input) }], signal: new AbortController().signal });
  const result = batch.results[0]?.result;
  if (!result) throw new Error('The tool returned no result');
  const text = result.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
  if (result.isError) throw new Error(text);
  return JSON.parse(text) as unknown;
}
function idOf(value: unknown): string {
  if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string') throw new TypeError('Preview id is missing');
  return value.id;
}

describe('DeepSeek import through the real Host tool registry', { timeout: 20_000 }, () => {
  it('previews the same JSONL through the public binary route and an explicit local tool path without creating a chat', async () => {
    const app = await start();
    const bytes = readFileSync(new URL('./fixtures/sillytavern.jsonl', import.meta.url));
    const response = await app.fetch(new Request('http://fixture/api/tavern-kit/deepseek/preview?name=' + encodeURIComponent('海边的约定.jsonl'), { method: 'POST', body: new Uint8Array(bytes).buffer }));
    expect(response.status).toBe(200);
    const preview = await response.json() as PreviewTicket;
    expect(preview).toMatchObject({ name: '海边的约定.jsonl', conversations: [{ kind: 'sillytavern-jsonl', userName: '阿宁', characterName: '林舟', messageCount: 6, candidateCount: 7, archivedMessageCount: 1, failedReplies: 2, archiveNotes: ['1 条系统或事件消息', '聊天头与扩展字段'] }] });
    expect(await call(app, { action: 'read', previewId: preview.id })).toEqual(preview);
    const path = join(app.dir, '海边的约定.jsonl'); writeFileSync(path, bytes);
    const local = await call(app, { action: 'preview', path });
    expect(local).toMatchObject({ name: preview.name, conversations: preview.conversations });
    expect(app.chat.list()).toEqual([]); expect(app.adapter.calls).toEqual([]);
    await call(app, { action: 'discard', previewId: idOf(local) });
    await app.importer.discard(preview.id);
    await expect(call(app, { action: 'read', previewId: preview.id })).rejects.toThrow('请重新选择这份导出文件');
  });

  it('previews an explicit local ZIP, reads it, and imports only selected sources with the same service results', async () => {
    const app = await start();
    expect(app.ctx.tools.get('tavern_deepseek_import')).toBeDefined();
    const path = join(app.dir, 'DeepSeek.zip');
    writeFileSync(path, deepseekArchive());
    const preview = await call(app, { action: 'preview', path });
    const previewId = idOf(preview);
    expect(preview).toMatchObject({ name: 'DeepSeek.zip', conversations: [{ sourceId: 'selected', messageCount: 2, omittedTurns: 0, failedReplies: 0 }, { sourceId: 'not-selected' }] });
    expect(await call(app, { action: 'read', previewId })).toEqual(preview);
    const result = await call(app, { action: 'import', previewId, sourceIds: ['selected'] });
    const saved = app.chat.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.title).toBe('海边的约定');
    expect(result).toMatchObject({ imported: [saved[0]?.id], skipped: [], failures: [], conversations: [{ sourceId: 'selected', title: '海边的约定', conversationId: saved[0]?.id, status: 'imported', messageCount: 2, omittedTurns: 0, failedReplies: 0 }] });
    const firstDuplicate = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    const secondDuplicate = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    const throughService = await app.importer.import({ previewId: firstDuplicate.id, sourceIds: ['selected'] });
    expect(await call(app, { action: 'import', previewId: secondDuplicate.id, sourceIds: ['selected'] })).toEqual(throughService);
    expect(throughService).toMatchObject({ skipped: [saved[0]?.id], conversations: [{ sourceId: 'selected', status: 'skipped', messageCount: 2 }] });
    expect(app.chat.list()).toHaveLength(1);
    expect(app.adapter.calls).toEqual([]);
  });

  it('requires an explicit selection, returns real failures, and shares discard with the UI service', async () => {
    const app = await start();
    await expect(call(app, { action: 'preview' })).rejects.toThrow(/路径/);
    await expect(call(app, { action: 'preview', path: join(app.dir, 'missing.zip') })).rejects.toThrow(/ENOENT/);
    const preview = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    await expect(call(app, { action: 'import', previewId: preview.id })).rejects.toThrow(/选择/);
    expect(app.chat.list()).toEqual([]);
    expect(await call(app, { action: 'import', previewId: preview.id, sourceIds: ['missing'] })).toMatchObject({ imported: [], conversations: [], failures: [{ sourceId: 'missing', message: '这段对话不在本次预览中' }] });
    const discarded = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    expect(await call(app, { action: 'discard', previewId: discarded.id })).toBeNull();
    await expect(call(app, { action: 'read', previewId: discarded.id })).rejects.toThrow('请重新选择这份导出文件');
    await expect(app.importer.import({ previewId: discarded.id, sourceIds: ['selected'] })).rejects.toThrow('请重新选择这份导出文件');
    await expect(call(app, { action: 'login' })).rejects.toThrow();
    expect(app.adapter.calls).toEqual([]);
  });

  it('releases its tool registration and held previews when the owner unloads', async () => {
    const app = await start();
    expect(app.ctx.tools.get('tavern_deepseek_import')).toBeDefined();
    const preview = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    await app.ctx.loader.resolve('include:tavern-kit-rp-deepseek-import').fiber?.dispose();
    expect(app.ctx.tools.get('tavern_deepseek_import')).toBeUndefined();
    await expect(app.importer.import({ previewId: preview.id, sourceIds: ['selected'] })).rejects.toThrow('请重新选择这份导出文件');
  });
});
