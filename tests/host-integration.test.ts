import { afterEach, describe, expect, it } from 'vitest';
import { isTypertRemoteMethod, type TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import { createServer } from 'node:http';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { recordKeyFor } from '@deepseek-ai/dsh-llm-pi-ai';
import { hostFixture, typertFixture, enableNativeTools, unzipArchive, RAW_MODEL, FIXTURE_KEY, type HostFixture } from './fixtures/host-runtime.js';
import { deepseekArchive, materialBytes, sourceStateArchive } from './fixtures/host-archive.js';
import type { PreviewTicket } from '../packages/rp-deepseek-import/src/types.js';
import { displayWithRules } from '../packages/rp-chat/src/prompt.js';

const fixtures: { close(): Promise<void> }[] = [];
afterEach(async () => { for (const fixture of fixtures.splice(0).reverse()) await fixture.close(); });
async function start(): Promise<HostFixture> { const fixture = await hostFixture(); fixtures.push(fixture); return fixture; }
async function generatedContribution(name: string): Promise<TypertRemoteContribution> {
  const artifact = join(process.cwd(), 'packages', name, 'lib', 'typert.remote-client.js');
  expect(existsSync(artifact), `build-generated Remote artifact missing: ${name}`).toBe(true);
  const module: unknown = await import(pathToFileURL(artifact).href);
  if (!module || typeof module !== 'object' || !('TYPERT_REMOTE' in module)) throw new Error(`generated Remote contribution missing: ${name}`);
  const contribution: unknown = module.TYPERT_REMOTE;
  if (!contribution || typeof contribution !== 'object' || !('package' in contribution) || typeof contribution.package !== 'string' || !('descriptors' in contribution) || !Array.isArray(contribution.descriptors)) throw new TypeError(`invalid generated contribution: ${name}`);
  // Descriptor validation remains with the real registry.
  return contribution as TypertRemoteContribution;
}
function stringField(value: unknown, key: string): string {
  if (!value || typeof value !== 'object' || !(key in value) || typeof (value as Record<string, unknown>)[key] !== 'string') throw new TypeError(`response has no ${key}`);
  return (value as Record<string, string>)[key]!;
}
let toolSequence = 0;
async function chatTool(app: HostFixture, arguments_: Record<string, unknown>): Promise<unknown> {
  const batch = await app.ctx.tools.execute({
    calls: [{ type: 'tool-call', id: ToolCallId(`chat-parity-${++toolSequence}`), name: 'tavern_chat', arguments: JSON.stringify(arguments_) }],
    signal: new AbortController().signal,
  });
  const result = batch.results[0]?.result;
  if (!result) throw new Error('chat tool returned no result');
  if (result.isError) throw new Error(result.error.message);
  if (typeof result.value !== 'string') throw new TypeError('chat tool returned no JSON text');
  try { return JSON.parse(result.value) as unknown; }
  catch { return result.value; }
}
const binaryPost = (path: string, bytes: Uint8Array): Request => new Request('http://localhost' + path, { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: new Uint8Array(bytes).buffer });

// Cold-loading the installed DSH stack and two isolated SQLite profiles can exceed unit-test defaults.
describe('real Cordis Host assembly on DSH 0.2.2-rc.3', { timeout: 20_000 }, () => {
  it('starts all five owners from reverse-order declarations and persists public settings in an isolated profile', async () => {
    const app = await start();
    // Cordis publishes FiberState as a const enum, with no runtime export.
    expect(app.pendingBeforeDependencies).toEqual([0, 0, 0, 0, 0]);
    expect(app.chat.list()).toEqual([]);
    expect(app.materials.list({})).toEqual([]);
    expect(await app.connections.listAccounts()).toEqual([]);
    expect(await app.appearance.get()).toMatchObject({ skin: 'classic' });
    await app.appearance.update({ skin: 'island', fontSize: 19 });
    expect(await app.appearance.get()).toMatchObject({ skin: 'island', fontSize: 19 });
    await app.connections.setModelOverride({ provider: 'host-local', model: RAW_MODEL, override: { contextWindow: 32768, outputLimit: 2048 } });
    expect(await app.connections.resolveRoute({ provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 })).toMatchObject({ provider: 'host-local', model: RAW_MODEL, contextWindow: 32768 });
    const persisted = readFileSync(join(app.profileDir, 'cordis.patch.yml'), 'utf8');
    expect(persisted).toContain('island');
    expect(persisted).not.toContain(FIXTURE_KEY);
    expect(existsSync(join(app.dataDir, 'conversations.sqlite'))).toBe(true);
    expect(existsSync(join(app.dataDir, 'materials.sqlite'))).toBe(true);
    await app.unloadAppearance();
    expect(app.chat.list()).toEqual([]);
    expect(app.ctx.tools.definitions().map(tool => tool.name)).toEqual(expect.arrayContaining(['tavern_chat', 'tavern_materials']));
  });

  it('reuses the real pi-ai provider credential record through the connections Host and local model endpoint', async () => {
    const requests: Array<{ path?: string; authorization?: string; header?: string }> = [];
    const server = createServer((request, response) => {
      requests.push({ path: request.url, authorization: request.headers.authorization, header: request.headers['x-host-fixture']?.toString() });
      response.setHeader('content-type', 'application/json');
      if (request.url !== '/v1/models' || request.headers.authorization !== `Bearer ${FIXTURE_KEY}` || request.headers['x-host-fixture'] !== 'present') {
        response.statusCode = 401; response.end(JSON.stringify({ error: 'local fixture authentication failed' })); return;
      }
      response.end(JSON.stringify({ data: [{ id: '[served]fresh/model', name: 'Refreshed through Host' }] }));
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    fixtures.push({ close: () => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }) });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('local fixture did not bind a port');
    const app = await hostFixture({ piAiBaseURL: `http://127.0.0.1:${address.port}/v1` });
    fixtures.push(app);
    await app.ctx.credentials.modifyRecord(recordKeyFor('openai'), async () => ({ kind: 'api-key', key: FIXTURE_KEY }));
    // Compare a boolean so even an unexpected ambient value is never printed by a failed assertion.
    expect((await app.ctx.credentials.resolve(credentialRef('OPENAI_API_KEY')))?.value === undefined).toBe(true);
    const view = (await app.connections.listConnections()).find(row => row.provider === 'openai');
    expect(view?.credentialConfigured).toBe(true);
    const models = await app.connections.discoverModels({ provider: 'openai' });
    expect(models.map(row => row.id)).toContain('[served]fresh/model');
    expect(requests).toEqual([{ path: '/v1/models', authorization: `Bearer ${FIXTURE_KEY}`, header: 'present' }]);
    await app.connections.saveConnection({ provider: 'openai', name: '沿用记录的连接' });
    const listed = await app.connections.listConnections();
    expect(listed.find(row => row.provider === 'openai')?.credentialConfigured).toBe(true);
    expect(JSON.stringify(listed)).not.toContain(FIXTURE_KEY);
    const form = app.ctx.settings.describe().find(row => row.ns === 'host-pi-ai');
    expect(JSON.stringify(form?.value)).not.toContain('apiKeyEnv');
    expect(JSON.stringify(form?.value)).not.toContain(FIXTURE_KEY);
    expect(readFileSync(join(app.profileDir, 'cordis.patch.yml'), 'utf8')).not.toContain(FIXTURE_KEY);
  });

  it.each([
    { title: '401 before any text', text: '', code: 'AUTHENTICATION_FAILED', status: 401, message: '原始认证失败：key 被拒绝\nrequest=fixture-401' },
    { title: 'failure after partial text', text: '海风刚刚吹过，', code: 'UPSTREAM_DISCONNECTED', status: 502, message: '原始流中断：连接提前关闭\nrequest=fixture-partial' },
  ])('exposes a lightweight raw failure for $title without changing saved text or usage', async row => {
    const app = await start();
    app.adapter.failures.push({ failure: { code: row.code, status: row.status, message: row.message }, text: row.text });
    const conversation = await app.chat.create({ title: row.title, settings: {
      mainRoute: { provider: 'host-local', model: RAW_MODEL, label: '海边主连接', group: 'group-one', inputBudget: 24000 },
      fallbacks: [{ provider: 'host-local', model: '备用不应调用', inputBudget: 24000 }], fallbackOnError: row.text !== '',
    } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '保留这个玩家原文' });
    const candidate = app.chat.candidates({ turnId: group.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('failed');
    const before = app.chat.candidate(candidate.id), view = app.chat.previewCandidate(candidate.id);
    expect(view).toMatchObject({ text: row.text, failures: [{ attemptId: before.attempts[0]!.id, provider: 'host-local', model: RAW_MODEL, label: '海边主连接', group: 'group-one', status: 'failed', code: row.code, httpStatus: row.status, message: row.message }] });
    expect(view).not.toHaveProperty('input'); expect(view).not.toHaveProperty('materials'); expect(view).not.toHaveProperty('attempts');
    expect(view.text).not.toContain(row.message);
    expect(before.input.messages.at(-1)?.content).toBe('保留这个玩家原文');
    expect(JSON.stringify(before.input)).not.toContain(row.message);
    expect(before.attempts).toHaveLength(1);
    expect(app.adapter.calls).toHaveLength(1);
    const usage = app.chat.usage(group.turnId);
    expect(usage).toMatchObject({ requestCount: 1, knownRequestCount: 0, unknownRequests: 1 });
    app.chat.previewCandidate(candidate.id); app.chat.previewCandidate(candidate.id);
    expect(app.chat.candidate(candidate.id)).toEqual(before);
    expect(app.chat.usage(group.turnId)).toEqual(usage);
    const edited = app.chat.editCandidate(candidate.id, '手改的角色正文');
    expect(app.chat.previewCandidate(edited.id)).not.toHaveProperty('failures');
  });

  it('retains failed and skipped attempt failures after a fallback succeeds', async () => {
    const app = await start();
    const message = '原始错误：主模型拒绝本次请求';
    app.adapter.failures.push({ failure: { code: 'AUTHENTICATION_FAILED', status: 401, message } });
    const conversation = await app.chat.create({ title: '备用成功仍可查失败', settings: {
      mainRoute: { provider: 'host-local', model: '[primary]raw/model', label: '原主连接', group: 'main-group', inputBudget: 24000 },
      fallbacks: [
        { provider: 'host-local', model: '[small]raw/model', label: '容量较小的连接', group: 'small-group', inputBudget: 1 },
        { provider: 'host-local', model: RAW_MODEL, label: '成功备用', group: 'backup-group', inputBudget: 24000 },
      ], fallbackOnError: true,
    } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '一起保留这段真实剧情' });
    await expect.poll(() => app.adapter.calls.length).toBe(2);
    app.adapter.calls[1]!.release();
    const candidate = app.chat.candidates({ turnId: group.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('complete');
    const before = app.chat.candidate(candidate.id), view = app.chat.previewCandidate(candidate.id);
    expect(view).toMatchObject({ text: '海风仍在，我记得我们的约定。', route: { provider: 'host-local', model: RAW_MODEL, group: 'backup-group' }, failures: [
      { attemptId: before.attempts[0]!.id, provider: 'host-local', model: '[primary]raw/model', label: '原主连接', group: 'main-group', status: 'failed', code: 'AUTHENTICATION_FAILED', httpStatus: 401, message },
      { attemptId: before.attempts[1]!.id, provider: 'host-local', model: '[small]raw/model', label: '容量较小的连接', group: 'small-group', status: 'skipped', code: 'INPUT_BUDGET', message: '容量放不下本组固定内容，已跳过' },
    ] });
    expect(before.attempts.map(attempt => attempt.status)).toEqual(['failed', 'skipped', 'complete']);
    expect(app.chat.usage(group.turnId)).toMatchObject({ requestCount: 2, knownRequestCount: 1, unknownRequests: 1 });
    expect(app.chat.candidate(candidate.id)).toEqual(before);
  });

  it('preserves lightweight failure fields in the generated strict preview result', async () => {
    const app = await start();
    app.adapter.failures.push({ failure: { code: 'AUTHENTICATION_FAILED', status: 401, message: '必须原样跨过协议的错误' } });
    const conversation = await app.chat.create({ title: '失败信息的协议边界', settings: { mainRoute: { provider: 'host-local', model: RAW_MODEL, label: '协议中的连接', group: 'wire-group', inputBudget: 24000 }, fallbackOnError: false } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '正文仍然只有输入' });
    const candidate = app.chat.candidates({ turnId: group.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('failed');
    const value = app.chat.previewCandidate(candidate.id);
    expect(value).toHaveProperty('failures.0.message', '必须原样跨过协议的错误');
    app.ctx.typert.remotes.register(await generatedContribution('rp-chat'));
    const descriptor = app.ctx.typert.remotes.get('rpChat/previewCandidate');
    if (!descriptor || !isTypertRemoteMethod(descriptor)) throw new Error('generated preview result missing');
    expect(descriptor.result.create().parse(value)).toEqual(value);
  });

  it('keeps generation alive after the UI watch is cancelled, then unload stops streams and closes SQLite', async () => {
    const app = await start();
    await app.connections.setModelOverride({ provider: 'host-local', model: RAW_MODEL, override: { contextWindow: 32768, outputLimit: 2048 } });
    const conversation = await app.chat.create({ title: '海边', settings: { mainRoute: { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 } } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '你还记得约定吗？' });
    await expect.poll(() => app.adapter.calls.length).toBe(1);
    const candidate = app.chat.candidates({ turnId: group.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(candidate.id).text).toBe('海风仍在，');
    const watchAbort = new AbortController();
    const watch = app.chat.watch(conversation.id, watchAbort.signal)[Symbol.asyncIterator]();
    expect((await watch.next()).value).toMatchObject({ conversationId: conversation.id });
    const pendingWatchRead = watch.next();
    watchAbort.abort();
    await expect(pendingWatchRead).resolves.toMatchObject({ done: true });
    expect(app.adapter.calls[0]?.aborted).toBe(false);
    app.adapter.calls[0]?.release();
    await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('complete');
    const first = app.chat.candidate(candidate.id);
    expect(first.text).toBe('海风仍在，我记得我们的约定。');
    expect(first.attempts[0]).toMatchObject({ config: { provider: 'host-local', model: RAW_MODEL } });
    expect(app.adapter.calls[0]?.credentialResolved).toBe(true);
    expect(app.adapter.calls[0]?.options.tools).toBeUndefined();
    expect(app.adapter.calls[0]?.options.toolHistory).toBeUndefined();
    await app.chat.roll(group.turnId);
    await expect.poll(() => app.adapter.calls.length).toBe(2);
    await expect.poll(() => app.chat.candidates({ turnId: group.turnId }).items[1]?.status).toBe('streaming');
    const unfinished = app.chat.candidates({ turnId: group.turnId }).items[1]!;
    await expect.poll(() => app.chat.previewCandidate(unfinished.id).text).toBe('海风仍在，');
    const backupURL = new URL('http://localhost/api/tavern-kit/chat/backup?id=' + conversation.id);
    expect(app.fetchHandler.requestBodyMode({ method: 'POST', url: backupURL })).toBe('streaming');
    await app.unloadChat();
    await app.adapter.calls[1]?.settled;
    expect(app.adapter.calls[1]?.aborted).toBe(true);
    expect(() => app.chat.list()).toThrow(/closed|not open|关闭/i);
    // Read without reopening ConversationStore: its restart recovery would normalize stale statuses.
    const persisted = new DatabaseSync(join(app.dataDir, 'conversations.sqlite'), { readOnly: true });
    try {
      const saved: unknown = JSON.parse(String(persisted.prepare('SELECT data FROM candidates WHERE id=?').get(unfinished.id)?.data));
      const attempt: unknown = JSON.parse(String(persisted.prepare('SELECT data FROM attempts WHERE candidate_id=?').get(unfinished.id)?.data));
      expect(saved).toMatchObject({ text: '海风仍在，', status: 'stopped' });
      expect(attempt).toMatchObject({ output: '海风仍在，', status: 'stopped' });
    } finally { persisted.close(); }
    expect(app.ctx.tools.definitions().map(tool => tool.name)).not.toContain('tavern_chat');
    const response = await app.fetch(new Request(backupURL));
    expect(response.status).toBe(404);
    expect(app.fetchHandler.requestBodyMode({ method: 'POST', url: backupURL })).toBe('buffered');
    expect(app.materials.list({})).toEqual([]);
    await app.unloadMaterials();
    expect(() => app.materials.list({})).toThrow(/closed|not open|关闭/i);
    expect((await app.fetch(binaryPost('/api/tavern-kit/materials/upload?name=card.json', materialBytes()))).status).toBe(404);
  });

  it('finishes a pending idle watch read when its Host is unloaded', async () => {
    const app = await start();
    const conversation = await app.chat.create({ title: '等待中的订阅' });
    const controller = new AbortController();
    const watch = app.chat.watch(conversation.id, controller.signal)[Symbol.asyncIterator]();
    await watch.next();
    let finished = false;
    const pending = watch.next().then(result => { finished = result.done === true; return result; });
    await app.unloadChat();
    try {
      await expect.poll(() => finished, { timeout: 1000 }).toBe(true);
      await expect(pending).resolves.toMatchObject({ done: true });
    } finally { controller.abort(); await pending; }
  });

  it('freezes a selected alternate greeting and player display context before later edits', async () => {
    const app = await start();
    const card = app.materials.importFile('首句角色.json', new TextEncoder().encode(JSON.stringify({ spec: 'chara_card_v3', spec_version: '3.0', data: { name: '阿岚', first_mes: '不选这条首句', alternate_greetings: ['原输出', '另一条备选'], description: '海边的药师' } })));
    const regex = app.materials.importFile('首句正则.json', new TextEncoder().encode(JSON.stringify([{ scriptName: '首句显示', findRegex: '原输出', replaceString: '{{char}}对{{user}}说', placement: [2], markdownOnly: true, runOnEdit: true }])));
    const conversation = await app.chat.create({ title: '首句的称呼', greetingIndex: 1, bindings: [{ id: card.id, version: card.currentVersion }, { id: regex.id, version: regex.currentVersion }], settings: { playerName: '小岛长', playerDescription: '喜欢海风' } });
    const original = app.chat.previewCandidate(conversation.currentCandidateId!);
    expect(original.text).toBe('原输出');
    expect(original.display?.context).toMatchObject({ char: '阿岚', user: '小岛长', persona: '喜欢海风' });
    expect(displayWithRules(original.text, original.display!.rules, 'output', original.display!.context)).toBe('阿岚对小岛长说');
    const changedCard = app.materials.revise(card.id, { patch: { data: { name: '新角色' } } });
    expect(changedCard.projection.character?.name).toBe('新角色');
    await app.chat.update(conversation.id, { bindings: [{ id: changedCard.id, version: changedCard.version }, { id: regex.id, version: regex.currentVersion }], settings: { playerName: '新的称呼', playerDescription: '之后的玩家设定' } });
    expect(app.chat.previewCandidate(original.candidate.id).display).toEqual(original.display);
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('projects old, edited and continued replies with frozen display rules and player context', async () => {
    const app = await start();
    const character = app.materials.importFile('character.json', materialBytes());
    const rules = app.materials.importFile('display.json', new TextEncoder().encode(JSON.stringify([
      { scriptName: '显示称呼', findRegex: '海风|原输入', replaceString: '{{char}}与{{user}}', placement: [1, 2], markdownOnly: true, runOnEdit: true },
    ])));
    const bindings = [character, rules].map(row => ({ id: row.id, version: row.currentVersion }));
    const conversation = await app.chat.create({ title: '冻结的称呼', bindings, settings: {
      playerName: '小岛长', playerDescription: '喜欢海风', mainRoute: { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 },
    } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '原输入' });
    await expect.poll(() => app.adapter.calls.length).toBe(1);
    expect(app.adapter.calls[0]?.options.messages.at(-1)?.content).toEqual([{ type: 'text', text: '原输入' }]);
    app.adapter.calls[0]?.release();
    const candidate = app.chat.candidates({ turnId: group.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('complete');
    const original = app.chat.previewCandidate(candidate.id);
    expect(original).toMatchObject({ text: '海风仍在，我记得我们的约定。', display: { context: { char: '阿岚', user: '小岛长', persona: '喜欢海风' } } });
    expect(displayWithRules(original.text, original.display!.rules, 'output', original.display!.context)).toBe('阿岚与小岛长仍在，我记得我们的约定。');
    expect(displayWithRules('原输入', original.display!.rules, 'input', original.display!.context)).toBe('阿岚与小岛长');
    const changedCharacter = app.materials.revise(character.id, { patch: { data: { name: '新角色', description: '之后才改的设定。' } } });
    expect(changedCharacter.projection.character?.name).toBe('新角色');
    const changedRules = app.materials.revise(rules.id, { raw: [{ scriptName: '新的显示', findRegex: '海风', replaceString: '新规则{{user}}', placement: [2], markdownOnly: true, runOnEdit: true }] });
    await app.chat.update(conversation.id, { bindings: [changedCharacter, changedRules].map(row => ({ id: row.id, version: row.version })), settings: { playerName: '后来称呼', playerDescription: '新人物设定' } });
    const edited = app.chat.editCandidate(candidate.id, '海风轻轻吹。');
    app.chat.select(edited.id);
    const editedView = app.chat.previewCandidate(edited.id);
    expect(editedView.display).toEqual(original.display);
    expect(displayWithRules(editedView.text, editedView.display!.rules, 'output', editedView.display!.context)).toBe('阿岚与小岛长轻轻吹。');
    const continuedGroup = await app.chat.continueCandidate(edited.id);
    await expect.poll(() => app.adapter.calls.length).toBe(2);
    app.adapter.calls[1]?.release();
    const continued = app.chat.candidates({ turnId: continuedGroup.turnId, groupId: continuedGroup.id }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(continued.id).candidate.status).toBe('complete');
    const continuedView = app.chat.previewCandidate(continued.id);
    expect(continuedView.display).toEqual(original.display);
    expect(continuedView.text).toBe('海风轻轻吹。海风仍在，我记得我们的约定。');
    expect(displayWithRules(continuedView.text, continuedView.display!.rules, 'output', continuedView.display!.context)).toBe('阿岚与小岛长轻轻吹。阿岚与小岛长仍在，我记得我们的约定。');
    const route = app.chat.route({ conversationId: conversation.id }).items.at(-1)!;
    expect(route.display).toEqual(original.display);
    expect(app.chat.candidate(continued.id).input.messages.at(-1)?.content).toBe('海风轻轻吹。');
    expect(app.chat.candidate(candidate.id).text).toBe('海风仍在，我记得我们的约定。');
  });

  it('uses actual message depths across old pages, empty inputs and branch previews with frozen rules', async () => {
    const app = await start();
    const card = app.materials.importFile('深度角色.json', new TextEncoder().encode(JSON.stringify({ spec: 'chara_card_v3', spec_version: '3.0', data: { name: '阿岚', first_mes: '海风首句' } })));
    const rules = app.materials.importFile('深度显示.json', new TextEncoder().encode(JSON.stringify([
      { scriptName: '只改深度一至三', findRegex: '海风|原输入', replaceString: '{{char}}与{{user}}', placement: [1, 2], markdownOnly: true, runOnEdit: true, minDepth: 1, maxDepth: 3 },
    ])));
    const conversation = await app.chat.create({ title: '按消息数阅读', bindings: [card, rules].map(row => ({ id: row.id, version: row.currentVersion })), settings: { playerName: '小岛长', playerDescription: '喜欢海风', mainRoute: { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 } } });
    const greetingId = conversation.currentCandidateId!;
    let nextCall = 0;
    const finish = async (group: { turnId: string; id: string }) => {
      const callIndex = nextCall++;
      await expect.poll(() => app.adapter.calls.length).toBe(callIndex + 1);
      app.adapter.calls[callIndex]!.release();
      const candidate = app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]!;
      await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('complete');
      return candidate;
    };
    const first = await finish(await app.chat.send({ conversationId: conversation.id, input: '原输入一' }));
    const edited = app.chat.editCandidate(first.id, '海风手改。');
    app.chat.select(edited.id);
    const continued = await finish(await app.chat.continueCandidate(edited.id));
    app.chat.select(continued.id);
    // A missing player message contributes no depth; this also covers the greeting's empty input.
    const emptyInput = await finish(await app.chat.send({ conversationId: conversation.id, input: '' }));
    const latest = await finish(await app.chat.send({ conversationId: conversation.id, input: '原输入末' }));
    const changedCard = app.materials.revise(card.id, { patch: { data: { name: '后来角色' } } });
    const changedRules = app.materials.revise(rules.id, { raw: [{ scriptName: '后来的规则', findRegex: '海风|原输入', replaceString: '不能混入{{user}}', placement: [1, 2], markdownOnly: true, minDepth: 0, maxDepth: 99 }] });
    await app.chat.update(conversation.id, { bindings: [changedCard, changedRules].map(row => ({ id: row.id, version: row.version })), settings: { playerName: '后来称呼', playerDescription: '后来设定' } });

    const older = app.chat.route({ conversationId: conversation.id, offset: 2, limit: 1 }).items[0]!;
    expect(older.candidate.id).toBe(continued.id);
    expect(displayWithRules(older.text, older.display!.rules, 'output', older.display!.context, older.display!.depth)).toBe('阿岚与小岛长手改。阿岚与小岛长仍在，我记得我们的约定。');
    const page = app.chat.route({ conversationId: conversation.id, limit: 10 });
    expect(page.items.map(row => [row.candidate.id, row.display?.depth, row.display?.inputDepth])).toEqual([
      [greetingId, 5, undefined], [continued.id, 3, 4], [emptyInput.id, 2, undefined], [latest.id, 0, 1],
    ]);
    // Validate the wire result with the shipped codec so added display metadata cannot be lost at RPC.
    app.ctx.typert.remotes.register(await generatedContribution('rp-chat'));
    for (const [endpoint, value] of [['rpChat/route', page], ['rpChat/previewCandidate', app.chat.previewCandidate(continued.id)]] as const) {
      const descriptor = app.ctx.typert.remotes.get(endpoint);
      if (!descriptor || !isTypertRemoteMethod(descriptor)) throw new Error('generated direct result missing: ' + endpoint);
      expect(descriptor.result.create().parse(value)).toEqual(value);
    }
    const last = page.items.at(-1)!;
    expect(displayWithRules(last.text, last.display!.rules, 'output', last.display!.context, last.display!.depth)).toBe('海风仍在，我记得我们的约定。');
    // Older callers omit the optional depth and retain the original zero-depth behavior.
    expect(displayWithRules(last.text, last.display!.rules, 'output', last.display!.context)).toBe('海风仍在，我记得我们的约定。');
    expect(displayWithRules(last.turn.input, last.display!.rules, 'input', last.display!.context, last.display!.inputDepth)).toBe('阿岚与小岛长末');
    expect(displayWithRules(older.turn.input, older.display!.rules, 'input', older.display!.context, older.display!.inputDepth)).toBe('原输入一');
    for (const id of [first.id, edited.id, continued.id]) {
      const preview = app.chat.previewCandidate(id);
      expect(preview.display).toMatchObject({ depth: 3, inputDepth: 4, context: { char: '阿岚', user: '小岛长', persona: '喜欢海风' } });
    }
    expect(app.chat.route({ conversationId: conversation.id, offset: 3, limit: 1 }).items[0]!.display).toMatchObject({ depth: 5 });
    expect(app.chat.candidate(first.id).text).toBe('海风仍在，我记得我们的约定。');
    expect(app.chat.candidate(first.id).input.messages.at(-1)?.content).toBe('原输入一');
    expect(app.chat.candidate(latest.id).input.messages.at(-1)?.content).toBe('原输入末');
    expect(app.chat.candidate(continued.id).text).toBe('海风手改。海风仍在，我记得我们的约定。');

    const branch = await finish(await app.chat.send({ conversationId: conversation.id, input: '另一条分支', parentCandidateId: greetingId }));
    app.chat.select(latest.id);
    expect(app.chat.previewCandidate(branch.id).display).toMatchObject({ depth: 0, inputDepth: 1 });
    expect(app.chat.previewCandidate(continued.id).display?.depth).toBe(3);
    app.chat.select(branch.id);
    expect(app.chat.route({ conversationId: conversation.id }).items.map(row => [row.candidate.id, row.display?.depth])).toEqual([[greetingId, 2], [branch.id, 0]]);
    expect(app.chat.previewCandidate(latest.id).display?.depth).toBe(0);
  });

  it('rejects invalid conversation fallback patterns before persisting either create or update', async () => {
    const app = await start();
    const conversation = await app.chat.create({ title: '有效规则', settings: { errorPatterns: ['忙碌', '/rate.?limit/i'] } });
    const before = app.chat.state(conversation.id).conversation;
    await expect(app.chat.update(conversation.id, { settings: { errorPatterns: ['/[unterminated/'] } })).rejects.toThrow(/正则/);
    expect(app.chat.state(conversation.id).conversation).toEqual(before);
    await expect(app.chat.create({ title: '无效规则', settings: { errorPatterns: ['/[unterminated/'] } })).rejects.toThrow(/正则/);
    expect(app.chat.list().map(row => row.id)).toEqual([conversation.id]);
  });

  it('uploads and selects old history, continues it, then restores a binary backup in a clean Host', async () => {
    const app = await start();
    const upload = await app.fetch(binaryPost('/api/tavern-kit/materials/upload?name=character.json', materialBytes()));
    expect(upload.status).toBe(200);
    const uploaded: unknown = await upload.json();
    const card = app.materials.get(stringField(uploaded, 'id'));
    const ref = { id: card.id, version: card.currentVersion };
    expect(app.fetchHandler.requestBodyMode({ method: 'POST', url: new URL('http://localhost/api/tavern-kit/deepseek/preview') })).toBe('streaming');
    const previewResponse = await app.fetch(binaryPost('/api/tavern-kit/deepseek/preview?name=DeepSeek.zip', deepseekArchive()));
    expect(previewResponse.status).toBe(200);
    const preview: unknown = await previewResponse.json();
    expect(preview).toMatchObject({ failures: [], conversations: [
      { sourceId: 'selected', title: '海边的约定', messageCount: 2, state: 'new' },
      { sourceId: 'not-selected', title: '不要迁入这段', state: 'new' },
    ] });
    const imported = await app.importer.import({ previewId: stringField(preview, 'id'), sourceIds: ['selected'] });
    expect(imported).toMatchObject({ skipped: [], failures: [] });
    expect(imported.imported).toHaveLength(1);
    const id = imported.imported[0]!;
    expect(app.chat.list().map(row => row.title)).toEqual(['海边的约定']);
    expect(app.chat.route({ conversationId: id }).items[0]).toMatchObject({ turn: { input: '你还记得我们的约定吗' }, text: '当然，小岛长，我们约好日落时再见。' });
    const duplicate = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    expect(duplicate.conversations.find(row => row.sourceId === 'selected')).toMatchObject({ state: 'same', existingId: id });
    expect(await app.importer.import({ previewId: duplicate.id, sourceIds: ['selected'] })).toEqual({ imported: [], skipped: [id], failures: [], conversations: [{ sourceId: 'selected', title: '海边的约定', kind: 'deepseek-chat-export', conversationId: id, status: 'skipped', messageCount: 2, omittedTurns: 0, failedReplies: 0 }] });
    await app.connections.setModelOverride({ provider: 'host-local', model: RAW_MODEL, override: { contextWindow: 32768, outputLimit: 2048 } });
    await app.chat.update(id, { bindings: [ref], settings: { mainRoute: { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 } } });
    const group = await app.chat.send({ conversationId: id, input: '那我们现在去海边吧。' });
    await expect.poll(() => app.adapter.calls.length).toBe(1);
    expect(app.adapter.calls[0]?.options.system).toContain('海边的药师');
    expect(JSON.stringify(app.adapter.calls[0]?.options.messages)).toContain('当然，小岛长，我们约好日落时再见。');
    app.adapter.calls[0]?.release();
    const generated = app.chat.candidates({ turnId: group.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(generated.id).candidate.status).toBe('complete');
    const edited = app.chat.editCandidate(generated.id, '小岛长，我一直记得日落时的约定。');
    app.chat.favorite(edited.id, true); app.chat.select(edited.id);
    const memo1 = app.chat.editMemo(id, '阿岚与小岛长约好日落时看海。', ['称呼：小岛长']);
    const memo2 = app.chat.editMemo(id, '两人已经一起出发去海边。', ['称呼：小岛长', '约好日落时看海']);
    const continuationGroup = await app.chat.continueCandidate(edited.id);
    await expect.poll(() => app.adapter.calls.length).toBe(2);
    app.adapter.calls[1]?.release();
    const continuation = app.chat.candidates({ turnId: group.turnId, groupId: continuationGroup.id }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(continuation.id).candidate.status).toBe('complete');
    const originalContinuation = app.chat.candidate(continuation.id);
    const newMaterial = app.materials.revise(card.id, { patch: { data: { description: '这是之后修改的设定。' } } });
    await app.chat.update(id, { bindings: [{ id: newMaterial.id, version: newMaterial.version }] });
    const branch = await app.chat.send({ conversationId: id, input: '另一条路先去小海湾。', parentCandidateId: edited.id });
    await expect.poll(() => app.adapter.calls.length).toBe(3);
    app.adapter.calls[2]?.release();
    const branchCandidate = app.chat.candidates({ turnId: branch.turnId }).items[0]!;
    await expect.poll(() => app.chat.previewCandidate(branchCandidate.id).candidate.status).toBe('complete');
    app.chat.select(continuation.id);
    const download = await app.fetch(new Request('http://localhost/api/tavern-kit/chat/backup?id=' + id));
    expect(download.status).toBe(200); expect(download.headers.get('content-type')).toBe('application/zip');
    const backup = new Uint8Array(await download.arrayBuffer());
    const files = await unzipArchive(backup);
    const jsonText = Object.entries(files).filter(([name]) => name.endsWith('.json')).map(([, bytes]) => new TextDecoder().decode(bytes)).join('\n');
    expect(jsonText).not.toContain(FIXTURE_KEY);
    expect(jsonText).not.toContain('TAVERN_KIT_HOST_INTEGRATION_KEY');
    expect(Object.values(files).some(bytes => Buffer.from(bytes).equals(Buffer.from(deepseekArchive())))).toBe(true);
    const clean = await start();
    const restoredResponse = await clean.fetch(binaryPost('/api/tavern-kit/chat/backup', backup));
    expect(restoredResponse.status).toBe(200);
    const restoredJson: unknown = await restoredResponse.json();
    const restoredId = stringField(restoredJson, 'id');
    expect(restoredId).not.toBe(id);
    const restored = clean.chat.state(restoredId);
    expect(restored.conversation.settings.mainRoute).toBeUndefined();
    const current = restored.route.items.at(-1)!;
    expect(current).toMatchObject({ text: '小岛长，我一直记得日落时的约定。海风仍在，我记得我们的约定。', candidate: { kind: 'continuation' } });
    const restoredCandidates = clean.chat.candidates({ turnId: current.turn.id }).items;
    expect(restoredCandidates).toHaveLength(3);
    const restoredGenerated = restoredCandidates.find(row => row.kind === 'generated')!;
    const restoredEdited = restoredCandidates.find(row => row.kind === 'edited')!;
    expect(restoredEdited).toMatchObject({ sourceCandidateId: restoredGenerated.id, favorite: true });
    expect(current.candidate.sourceCandidateId).toBe(restoredEdited.id);
    expect([restoredGenerated.id, restoredEdited.id, current.candidate.id]).not.toEqual([generated.id, edited.id, continuation.id]);
    const restoredContinuation = clean.chat.candidate(current.candidate.id);
    expect(restoredContinuation.snapshot.options.continuationOf).toBe(restoredEdited.id);
    expect(restoredContinuation.snapshot.boundaryCandidateId).toBe(restored.route.items[0]!.candidate.id);
    expect(restoredContinuation.input).toEqual(originalContinuation.input);
    expect(restoredContinuation.attempts[0]).toMatchObject({ candidateId: current.candidate.id, snapshotId: restoredContinuation.snapshot.id, turnId: current.turn.id, kind: 'continuation', config: { provider: 'host-local', model: RAW_MODEL } });
    expect(restoredContinuation.materials[0]).toMatchObject({ version: ref.version, projection: { character: { description: '海边的药师。你叫我小岛长，我们约好日落时见。' } } });
    const restoredMemos = clean.chat.memos(restoredId);
    expect(restoredMemos).toHaveLength(2);
    expect(restoredMemos[0]).toMatchObject({ sourceCandidateId: restoredEdited.id, content: memo1.content });
    expect(restoredMemos[1]).toMatchObject({ sourceCandidateId: restoredEdited.id, previousId: restoredMemos[0]!.id, content: memo2.content });
    expect(restoredMemos[0]!.id).not.toBe(memo1.id);
    const branchNode = clean.chat.graph(restoredId).find(row => row.input === '另一条路先去小海湾。')!;
    expect(branchNode.parentTurnId).toBe(current.turn.id);
    const restoredBranch = clean.chat.candidate(branchNode.previewCandidateId!);
    expect(restoredBranch.snapshot).toMatchObject({ boundaryCandidateId: restoredEdited.id, memoId: restoredMemos[1]!.id });
    expect(restoredBranch.materials[0]).toMatchObject({ version: newMaterial.version, projection: { character: { description: '这是之后修改的设定。' } } });
    expect(clean.materials.readVersion(restored.conversation.bindings[0]!)).toMatchObject({ version: newMaterial.version });
    expect(Buffer.from(clean.materials.exportOriginal(restored.conversation.bindings[0]!.id).base64, 'base64')).toEqual(Buffer.from(materialBytes()));
    await clean.chat.update(restoredId, { settings: { mainRoute: { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 } } });
    const next = await clean.chat.send({ conversationId: restoredId, input: '我们继续走吧。' });
    await expect.poll(() => clean.adapter.calls.length).toBe(1);
    expect(JSON.stringify(clean.adapter.calls[0]?.options.messages)).toContain('小岛长，我一直记得日落时的约定。');
    clean.adapter.calls[0]?.release();
    await expect.poll(() => clean.chat.candidates({ turnId: next.turnId }).items[0]?.status).toBe('complete');
  });

  it('uses the real tool pipeline for full create and update DTOs, input edits and group stopping', async () => {
    const app = await start();
    await enableNativeTools(app);
    const card = app.materials.importFile('角色.json', materialBytes());
    const input = { title: '工具创建的海边剧情', bindings: [{ id: card.id, version: card.currentVersion }], settings: { playerName: '小岛长', playerDescription: '喜欢海风', mainRoute: { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 }, parallel: false, parallelCount: 2 } };
    const created = await chatTool(app, { action: 'create', json: JSON.stringify(input) });
    const id = stringField(created, 'id');
    expect(created).toEqual(app.chat.state(id).conversation);
    expect(created).toMatchObject(input);
    const direct = await app.chat.create(input);
    expect(app.chat.state(id).conversation.settings).toEqual(direct.settings);
    const patch = { title: '工具改后的标题', settings: { playerName: '船长', parallel: true, parallelCount: 2, errorPatterns: ['忙碌'] } };
    const updated = await chatTool(app, { action: 'update', id, json: JSON.stringify(patch) });
    expect(updated).toEqual(app.chat.state(id).conversation);
    expect(updated).toMatchObject(patch);
    const groupValue = await chatTool(app, { action: 'send', id, text: '一起去海边吧。' });
    const turnId = stringField(groupValue, 'turnId'), groupId = stringField(groupValue, 'id');
    await expect.poll(() => app.adapter.calls.length).toBe(2);
    await expect.poll(() => app.chat.candidates({ turnId }).items.every(row => row.text === '海风仍在，')).toBe(true);
    await chatTool(app, { action: 'stopGroup', id: groupId });
    await expect.poll(() => app.chat.candidates({ turnId }).items.every(row => row.status === 'stopped')).toBe(true);
    await chatTool(app, { action: 'update', id, json: JSON.stringify({ settings: { parallel: false } }) });
    const revised = await chatTool(app, { action: 'editInput', id: turnId, text: '我想先去小海湾。' });
    const revisedTurnId = stringField(revised, 'turnId');
    expect(revisedTurnId).not.toBe(turnId);
    expect(app.chat.graph(id).find(row => row.id === revisedTurnId)?.input).toBe('我想先去小海湾。');
    await expect.poll(() => app.adapter.calls.length).toBe(3);
    const candidate = app.chat.candidates({ turnId: revisedTurnId }).items[0]!;
    await chatTool(app, { action: 'stop', id: candidate.id });
    await expect.poll(() => app.chat.previewCandidate(candidate.id).candidate.status).toBe('stopped');
    await chatTool(app, { action: 'favorite', id: candidate.id, favorite: false });
    expect(app.chat.previewCandidate(candidate.id).candidate.favorite).toBe(false);
    await chatTool(app, { action: 'select', id: candidate.id });
    const memo = await chatTool(app, { action: 'memo', id, text: '约好日落时在海边见。', locked: ['称呼：船长'] });
    expect(memo).toMatchObject({ content: '约好日落时在海边见。', locked: ['称呼：船长'] });
  });

  it('rejects malformed tool DTOs before creating or changing a conversation', async () => {
    const app = await start();
    await enableNativeTools(app);
    await expect(chatTool(app, { action: 'create', json: '{invalid' })).rejects.toThrow();
    await expect(chatTool(app, { action: 'create', json: JSON.stringify({ title: '无效', settings: { parallelCount: 0 } }) })).rejects.toThrow();
    expect(app.chat.list()).toEqual([]);
    const conversation = await app.chat.create({ title: '原来的标题' });
    await expect(chatTool(app, { action: 'update', id: conversation.id, json: JSON.stringify({ settings: { errorPatterns: ['/[unterminated/'] } }) })).rejects.toThrow();
    await expect(chatTool(app, { action: 'update', id: conversation.id, json: JSON.stringify({ bindings: [{ id: 'bad', version: '1' }] }) })).rejects.toThrow();
    await expect(chatTool(app, { action: 'update', id: conversation.id, json: JSON.stringify({ settings: { apiKey: 'unaccepted-secret' } }) })).rejects.toThrow();
    expect(app.chat.state(conversation.id).conversation).toEqual(conversation);
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('preserves imported source states and counts through real ZIP, SQLite and backup without invented model requests', async () => {
    const app = await hostFixture(), clean = await hostFixture();
    fixtures.push(app, clean);
    const bytes = await sourceStateArchive();
    const previewResponse = await app.fetch(binaryPost('/api/tavern-kit/deepseek/preview?name=source-states.zip', bytes));
    expect(previewResponse.status).toBe(200);
    const ticket = await previewResponse.json() as PreviewTicket;
    expect(ticket.failures).toEqual([]);
    expect(ticket.conversations[0]).toMatchObject({ sourceId: 'source-states', messageCount: 10, omittedTurns: 1, failedReplies: 2 });
    const result = await app.importer.import({ previewId: ticket.id, sourceIds: ['source-states'] });
    const id = result.imported[0]!;
    const sourceFacts = { kind: 'deepseek-chat-export', id: 'source-states', messageCount: 10, omittedTurns: 1, failedReplies: 2 };
    expect(app.chat.state(id).conversation.source).toMatchObject(sourceFacts);
    const readImported = (host: typeof app.chat, conversationId: string) => host.graph(conversationId).map(node => {
      const detail = host.candidate(node.previewCandidateId!);
      expect(detail.attempts).toEqual([]);
      expect(host.usage(node.id)).toMatchObject({ requestCount: 0, knownRequestCount: 0, unknownRequests: 0, summaryRequests: 0, continuationRequests: 0 });
      return { input: node.input, candidate: detail.candidate, frozenInput: detail.input };
    });
    const original = readImported(app.chat, id);
    expect(original).toHaveLength(4);
    expect(original.find(row => row.input === '正常的问题')?.candidate).toMatchObject({ text: '最初保留的回复。', imported: { status: 'complete', reasoning: '正常思考' } });
    expect(original.find(row => row.input === '空回复的问题')?.candidate).toMatchObject({ text: '', imported: { status: 'empty', reasoning: '', error: expect.any(String) } });
    expect(original.find(row => row.input === '失败的问题')?.candidate).toMatchObject({ status: 'failed', imported: { status: 'failed', reasoning: '失败思考', error: expect.stringContaining('FAILED') } });
    expect(original.some(row => row.input === '被过滤的问题')).toBe(false);
    expect(JSON.stringify(original.at(-1)?.frozenInput)).not.toContain('失败的部分文字');
    expect(app.adapter.calls).toHaveLength(0);
    const backup = new Uint8Array(await (await app.fetch(new Request(`http://fixture/api/tavern-kit/chat/backup?id=${id}`))).arrayBuffer());
    const restoreResponse = await clean.fetch(new Request('http://fixture/api/tavern-kit/chat/backup', { method: 'POST', body: backup }));
    expect(restoreResponse.status).toBe(200);
    const restored = await restoreResponse.json() as { id: string };
    expect(clean.chat.state(restored.id).conversation.source).toMatchObject(sourceFacts);
    const restoredRows = readImported(clean.chat, restored.id);
    expect(restoredRows.map(row => ({ input: row.input, text: row.candidate.text, status: row.candidate.status, imported: row.candidate.imported }))).toEqual(original.map(row => ({ input: row.input, text: row.candidate.text, status: row.candidate.status, imported: row.candidate.imported })));
    expect(clean.adapter.calls).toHaveLength(0);
  });

  it('searches raw local history through the shared Host and native tool without selecting or generating', async () => {
    const app = await start();
    await enableNativeTools(app);
    const id = app.chat.importHistory({ sourceId: 'search-source', fingerprint: 'search-fingerprint', title: '旧约定', createdAt: 1, updatedAt: 2, turns: [{ input: '玩家原文100%_约定', reply: '最初的约定', reasoning: '不能当正文搜索的思考', status: 'complete' }] }, { name: 'local.json', bytes: new TextEncoder().encode('local-only') });
    const root = app.chat.route({ conversationId: id }).items[0]!;
    const edited = app.chat.editCandidate(root.candidate.id, '旧分支手改约定');
    app.chat.favorite(edited.id, true);
    const other = app.chat.importHistory({ sourceId: 'search-other', fingerprint: 'other', title: '另一段剧情', createdAt: 1, updatedAt: 2, turns: [{ input: '另一个输入', reply: '别处的手改约定', reasoning: '', status: 'complete' }] }, { name: 'other.json', bytes: new Uint8Array([1]) });
    const before = app.chat.state(id), usage = app.chat.usage(root.turn.id);
    const input = { query: '手改约定', conversationId: id, offset: 0, limit: 5 };
    const page = app.chat.search(input);
    expect(page).toMatchObject({ total: 1, items: [{ conversationId: id, conversationTitle: '旧约定', candidateId: edited.id, ordinal: 2, role: 'assistant', excerpt: '旧分支手改约定' }] });
    expect(app.chat.search({ query: '手改约定' }).total).toBe(2);
    expect(app.chat.search({ query: '不能当正文搜索的思考' }).total).toBe(0);
    expect(await chatTool(app, { action: 'search', json: JSON.stringify(input) })).toEqual(page);
    const hit = page.items[0]!;
    const preview = app.chat.searchPreview({ ...hit, conversationTitle: '浏览器伪造', ordinal: 1000 });
    expect(preview).toEqual({ conversationId: id, conversationTitle: '旧约定', turnId: root.turn.id, input: '玩家原文100%_约定', candidateId: edited.id, reply: '旧分支手改约定', ordinal: 2, status: 'complete' });
    expect(await chatTool(app, { action: 'searchPreview', json: JSON.stringify(hit) })).toEqual(preview);
    expect(() => app.chat.searchPreview({ ...hit, conversationId: other })).toThrow(/不属于/);
    await expect(chatTool(app, { action: 'search', json: '{bad' })).rejects.toThrow();
    await expect(chatTool(app, { action: 'search', json: JSON.stringify({ query: '约定', offset: -1 }) })).rejects.toThrow();
    expect(app.chat.search({ query: '%_', conversationId: id }).items[0]?.role).toBe('user');
    expect(app.chat.state(id)).toEqual(before);
    expect(app.chat.usage(root.turn.id)).toEqual(usage);
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('preserves search hits and raw single previews through the generated strict Remote codec', async () => {
    const app = await start();
    const conversation = await app.chat.create({ title: '搜索协议' });
    const imported = app.chat.importHistory({ sourceId: 'wire-search', fingerprint: 'wire-search', title: '协议里的旧剧情', createdAt: 1, updatedAt: 2, turns: [{ input: '还记得吗？', reply: '我记得那段约定。', reasoning: '', status: 'complete' }] }, { name: 'wire.json', bytes: new Uint8Array([2]) });
    const page = app.chat.search({ query: '约定', conversationId: imported });
    const hit = page.items[0]!, preview = app.chat.searchPreview(hit);
    app.ctx.typert.remotes.register(await generatedContribution('rp-chat'));
    for (const row of [
      { name: 'search', input: { input: { query: '约定', conversationId: imported } }, result: page },
      { name: 'searchPreview', input: { hit }, result: preview },
    ]) {
      const method = app.ctx.typert.remotes.get(`rpChat/${row.name}`);
      if (!method || !isTypertRemoteMethod(method)) throw new Error('generated search Remote schema missing: ' + row.name);
      expect(method.input({ strict: true }).create().parse(row.input)).toEqual(row.input);
      expect(method.result.create().parse(row.result)).toEqual(row.result);
    }
    expect(app.chat.state(conversation.id).conversation.currentCandidateId).toBeUndefined();
    expect(app.adapter.calls).toHaveLength(0);
  });

  it('registers the actual generated strict Remote contribution for every Host owner', async () => {
    const app = await typertFixture();
    fixtures.push(app);
    for (const name of ['rp-chat', 'rp-materials', 'rp-connections', 'rp-deepseek-import', 'rp-appearance']) {
      app.ctx.typert.remotes.register(await generatedContribution(name));
    }
    const descriptors = app.ctx.typert.remotes.list();
    const endpoints = descriptors.map(row => row.namespace + '/' + row.method);
    expect(endpoints).toEqual(expect.arrayContaining(['rpChat/create', 'rpChat/watch', 'rpMaterials/list', 'rpConnections/listConnections', 'rpDeepseekImport/import', 'rpAppearance/update']));
    for (const descriptor of descriptors) expect(descriptor.result.mode).toBe('strict');
    const schemaCases = [
      { endpoint: 'rpChat/create', input: { input: { title: '海边' } }, extra: { input: { title: '海边', undeclared: true } } },
      { endpoint: 'rpMaterials/list', input: { query: { search: '阿岚' } }, extra: { query: { search: '阿岚', undeclared: true } } },
      { endpoint: 'rpConnections/setPreference', input: { input: { provider: 'host-local', preference: { fallbackOnError: false } } }, extra: { input: { provider: 'host-local', preference: { fallbackOnError: false }, undeclared: true } } },
      { endpoint: 'rpDeepseekImport/import', input: { input: { previewId: 'ticket', sourceIds: ['selected'] } }, extra: { input: { previewId: 'ticket', sourceIds: ['selected'], undeclared: true } } },
      { endpoint: 'rpAppearance/update', input: { patch: { skin: 'island' } }, extra: { patch: { skin: 'island', undeclared: true } } },
    ];
    for (const row of schemaCases) {
      const descriptor = app.ctx.typert.remotes.get(row.endpoint);
      if (!descriptor || !isTypertRemoteMethod(descriptor)) throw new Error('generated direct schema missing: ' + row.endpoint);
      expect(descriptor.input({ strict: true }).create().parse(row.input)).toEqual(row.input);
      expect(() => descriptor.input({ strict: true }).create().parse(row.extra)).toThrow();
    }
  });
});
