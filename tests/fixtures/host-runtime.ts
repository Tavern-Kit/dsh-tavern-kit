import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { Context, type Plugin } from '@deepseek-ai/cordis';
import Loader from '@deepseek-ai/cordis-plugin-loader';
import LlmRuntime, { LlmAdapter, type GenerateOptions, type StreamChunk, type LlmFailure } from '@deepseek-ai/dsh-llm';
import SettingsForms from '@deepseek-ai/dsh-settings';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection';
import * as ConnectionPlugin from '@deepseek-ai/dsh-client-connection';
import ToolsService from '@deepseek-ai/dsh-tools';
import RpChat from '../../packages/rp-chat/src/host.js';
import RpMaterials from '../../packages/rp-materials/src/host.js';
import RpConnections from '../../packages/rp-connections/src/host.js';
import RpImport from '../../packages/rp-deepseek-import/src/host.js';
import RpAppearance from '../../packages/rp-appearance/src/host.js';
// Select the installed runtime without tying the tests to a particular checkout or user account.
function findInstallAnchor(): string {
    const override = process.env.DSH_TEST_INSTALL_ANCHOR;
    if (override) return resolve(override);
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const anchor = join(globalRoot, '@deepseek-ai', 'dsh', 'package.json');
    if (!existsSync(anchor)) throw new Error('Install DeepSeek Harness or set DSH_TEST_INSTALL_ANCHOR to its package.json.');
    return anchor;
}
const installAnchor = findInstallAnchor();
const installed = createRequire(installAnchor);
export const RAW_MODEL = '[薄甲]vendor/test-model';
export const FIXTURE_KEY = 'local-fixture-not-an-api-key';
const KEY_REF = credentialRef('TAVERN_KIT_HOST_INTEGRATION_KEY');
export function deferred(): {
    promise: Promise<void>;
    resolve: () => void;
} {
    let complete: (() => void) | undefined;
    const promise = new Promise<void>(done => { complete = done; });
    return { promise, resolve: () => { complete?.(); } };
}
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object'; }
export async function installedModule(name: string): Promise<Record<string, unknown>> {
    const value: unknown = await import(pathToFileURL(installed.resolve(name)).href);
    if (!record(value))
        throw new TypeError(`${name} did not export a module`);
    return value;
}
async function installedPlugin(name: string): Promise<Plugin> {
    const module = await installedModule(name);
    if (typeof module.default !== 'function')
        throw new TypeError(`${name} has no plugin export`);
    return module.default as Plugin;
}
export interface FixtureCall {
    options: GenerateOptions;
    credentialResolved: boolean;
    aborted: boolean;
    release: () => void;
    settled: Promise<void>;
}
/** Only the external model is controlled; the actual DSH prepared-call runtime is used. */
export class ControlledAdapter extends LlmAdapter {
    readonly calls: FixtureCall[] = [];
    readonly failures: { failure: LlmFailure; text?: string }[] = [];
    constructor(private readonly ctx: Context) { super(); }
    override async listModels(provider: string) { return [{ provider, id: RAW_MODEL, name: '本地验证模型' }]; }
    override async resolveModel(provider: string, model: string) { return { provider, id: model, name: model, context: { contextWindow: 32768 }, defaultMaxTokens: 2048 }; }
    override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
        const gate = deferred(), done = deferred();
        const call: FixtureCall = { options, credentialResolved: (await this.ctx.credentials.resolve(KEY_REF))?.value === FIXTURE_KEY, aborted: false, release: gate.resolve, settled: done.promise };
        this.calls.push(call);
        const abort = (): void => { call.aborted = true; gate.resolve(); };
        options.signal?.addEventListener('abort', abort, { once: true });
        try {
            if (options.signal?.aborted) {
                abort();
                return;
            }
            const planned = this.failures.shift();
            if (planned) {
                if (planned.text) {
                    yield { type: 'block-start', index: 0, blockType: 'text' };
                    yield { type: 'text-delta', index: 0, text: planned.text };
                    yield { type: 'block-end', index: 0, block: { type: 'text', text: planned.text } };
                }
                yield { type: 'finish', reason: { kind: 'error', failure: planned.failure } };
                return;
            }
            yield { type: 'block-start', index: 0, blockType: 'text' };
            yield { type: 'text-delta', index: 0, text: '海风仍在，' };
            await gate.promise;
            if (options.signal?.aborted)
                return;
            yield { type: 'text-delta', index: 0, text: '我记得我们的约定。' };
            yield { type: 'block-end', index: 0, block: { type: 'text', text: '海风仍在，我记得我们的约定。' } };
            yield { type: 'usage', usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 } };
            yield { type: 'finish', reason: { kind: 'stop' } };
        }
        finally {
            options.signal?.removeEventListener('abort', abort);
            done.resolve();
        }
    }
}
export async function hostFixture(options: { piAiBaseURL?: string } = {}) {
    const dir = mkdtempSync(join(tmpdir(), 'tavern-host-'));
    const profileDir = join(dir, 'profile');
    const dataDir = join(dir, 'data');
    mkdirSync(profileDir);
    mkdirSync(dataDir);
    const ctx = new Context();
    try {
        ctx.provide('profileContext', { name: 'host-integration', dir: profileDir, patchPath: join(profileDir, 'cordis.patch.yml'), installAnchor, cwd: dir, home: dir, startedBundles: [], overlays: [], telemetryDisabledEnv: '1' });
        writeFileSync(join(profileDir, 'package.json'), JSON.stringify({ private: true, dsh: { profile: { bundles: [] } } }));
        const rows = [
            { id: 'tavern-kit-rp-deepseek-import', name: 'cordis:rp-import' },
            { id: 'tavern-kit-rp-chat', name: 'cordis:rp-chat', config: { dataDir } },
            { id: 'tavern-kit-rp-appearance', name: 'cordis:rp-appearance', config: { dataDir } },
            { id: 'tavern-kit-rp-connections', name: 'cordis:rp-connections' },
            { id: 'tavern-kit-rp-materials', name: 'cordis:rp-materials', config: { dataDir } },
            ...(options.piAiBaseURL ? [{ id: 'host-pi-ai', name: 'cordis:host-pi-ai', config: { providers: { openai: { baseURL: options.piAiBaseURL, headers: { 'X-Host-Fixture': 'present' } } } } }] : []),
        ];
        writeFileSync(join(profileDir, 'cordis.patch.yml'), JSON.stringify([{ insert: rows }]));
        const configPath = join(profileDir, 'cordis.json');
        writeFileSync(configPath, '[]');
        await ctx.plugin(Loader, { baseUrl: pathToFileURL(profileDir + '/').href });
        Object.assign(ctx.loader.builtins, { 'rp-import': RpImport, 'rp-chat': RpChat, 'rp-materials': RpMaterials, 'rp-connections': RpConnections, 'rp-appearance': RpAppearance });
        if (options.piAiBaseURL) {
            const module = await installedModule('@deepseek-ai/dsh-llm-pi-ai');
            if (typeof module.apply !== 'function') throw new TypeError('runtime has no pi-ai adapter plugin');
            ctx.loader.builtins['host-pi-ai'] = { ...module, apply: module.apply as (ctx: Context, config: unknown) => void };
        }
        const boot = await installedModule('@deepseek-ai/dsh-app-boot');
        if (typeof boot.mountRootInclude !== 'function')
            throw new TypeError('installed app boot has no mountRootInclude');
        const mountRootInclude = boot.mountRootInclude as (ctx: Context, path: string, patches: readonly object[]) => Promise<unknown>;
        await mountRootInclude(ctx, configPath, [{ insert: rows }]);
        await ctx.loader.await();
        if (![...ctx.loader.entries()].some(entry => entry.options.id === rows[0]?.id)) {
            throw new Error('Host declarations did not mount: ' + JSON.stringify([...ctx.loader.entries()].map(entry => ({ id: entry.id, state: entry.fiber?.state, config: entry.options.config }))));
        }
        const pendingBeforeDependencies = rows.map(row => ctx.loader.resolve('include:' + row.id).fiber?.state);
        const [registry, credentials, configEditor, systemPrompt] = await Promise.all([
            installedPlugin('@deepseek-ai/dsh-typert-registry'), installedPlugin('@deepseek-ai/dsh-credentials-local'),
            installedPlugin('@deepseek-ai/dsh-config-editor'), installedPlugin('@deepseek-ai/dsh-system-prompt'),
        ]);
        await ctx.plugin(registry);
        await ctx.plugin(credentials, { path: join(dir, 'credentials.yaml'), watch: false });
        await ctx.plugin(configEditor);
        await ctx.plugin(SettingsForms);
        await ctx.plugin(systemPrompt);
        await ctx.plugin(ToolsService);
        await ctx.plugin(LlmRuntime);
        await ctx.plugin(ConnectionPlugin);
        await ctx.credentials.set(KEY_REF, FIXTURE_KEY);
        const adapter = new ControlledAdapter(ctx);
        const adapterFiber = ctx.plugin({ inject: ['llm'], apply(owner: Context) { owner.llm.registerAdapter(['host-local'], adapter); } });
        await adapterFiber;
        await ctx.loader.await();
        for (const row of rows)
            await ctx.loader.resolve('include:' + row.id).fiber?.await();
        const connection: HostConnectionHandle = ctx.connection;
        const peer = connection.createPeer({ principal: { kind: 'owner' } });
        const fetchHandler = connection.createSharedFetchHandler('/api');
        const fetch = (request: Request): Promise<Response> => fetchHandler.fetch(request, peer);
        const chat = ctx.rpChat, materials = ctx.rpMaterials;
        return {
            ctx, dir, dataDir, profileDir, adapter, fetch, fetchHandler, pendingBeforeDependencies,
            chat, materials, connections: ctx.rpConnections, appearance: ctx.rpAppearance, importer: ctx.rpDeepseekImport,
            async close() {
                await ctx.fiber.dispose();
                // Only the temporary directory this fixture created is removable.
                if (dirname(dir) !== resolve(tmpdir()) || !basename(dir).startsWith('tavern-host-'))
                    throw new Error('unexpected fixture cleanup target');
                rmSync(dir, { recursive: true, force: true });
            },
            async unloadChat() { await ctx.loader.resolve('include:tavern-kit-rp-chat').fiber?.dispose(); },
            async unloadMaterials() { await ctx.loader.resolve('include:tavern-kit-rp-materials').fiber?.dispose(); },
            async unloadAppearance() { await ctx.loader.resolve('include:tavern-kit-rp-appearance').fiber?.dispose(); },
        };
    }
    catch (error) {
        await ctx.fiber.dispose();
        if (dirname(dir) !== resolve(tmpdir()) || !basename(dir).startsWith('tavern-host-'))
            throw new Error('unexpected fixture cleanup target');
        rmSync(dir, { recursive: true, force: true });
        throw error;
    }
}
export async function typertFixture() {
    const ctx = new Context();
    const fiber = ctx.plugin(await installedPlugin('@deepseek-ai/dsh-typert-registry'));
    await fiber.await();
    return { ctx, async close() { await ctx.fiber.dispose(); } };
}
export async function unzipArchive(bytes: Uint8Array): Promise<Record<string, Uint8Array>> {
    const module = await installedModule('fflate');
    if (typeof module.unzipSync !== 'function')
        throw new TypeError('runtime has no ZIP decoder');
    return (module.unzipSync as (data: Uint8Array) => Record<string, Uint8Array>)(bytes);
}
export async function zipArchive(files: Record<string, Uint8Array>): Promise<Uint8Array> {
    const module = await installedModule('fflate');
    if (typeof module.zipSync !== 'function')
        throw new TypeError('runtime has no ZIP encoder');
    return (module.zipSync as (data: Record<string, Uint8Array>, options: { mtime: Date }) => Uint8Array)(files, { mtime: new Date('2026-11-18T00:00:00Z') });
}
export async function enableNativeTools(fixture: HostFixture): Promise<void> {
    const module = await installedModule('@deepseek-ai/dsh-tool-executor-native');
    if (typeof module.apply !== 'function')
        throw new TypeError('runtime has no native tool executor');
    const fiber = fixture.ctx.plugin({ ...module, apply: module.apply as (ctx: Context) => void });
    await fiber.await();
}
export type HostFixture = Awaited<ReturnType<typeof hostFixture>>;
