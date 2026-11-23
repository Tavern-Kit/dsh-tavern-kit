import { describe, expect, it } from 'vitest';
import { ConnectionsService } from './connections.js';
import type { ConnectionPorts, SettingsForm, SettingsMutation } from './connections.js';
import { connectionsTool } from './tools.js';
import type { ConnectionsToolPort } from './tools.js';
import type { ToolExecutionToken, ToolRunContext } from '@deepseek-ai/dsh-tools';
import type { ToolCallId } from '@deepseek-ai/dsh-llm';

function fixture() {
  const forms: SettingsForm[] = [
    { ns: 'adapter', revision: 0, value: { providers: { relay: { api: 'openai-completions', apiKeyEnv: 'EXISTING_SHARED_KEY', baseURL: 'https://relay.test/v1', headers: { 'X-Test': 'keep' }, models: [{ id: 'raw/[m]', name: 'Old', contextWindow: 12000 }], future: { preserve: true } } } } },
    { ns: 'tavern-kit-rp-connections', revision: 0, value: { preferences: {}, accounts: {} } },
  ];
  const keys = new Map([['EXISTING_SHARED_KEY', 'shared-secret']]);
  const ports: ConnectionPorts = {
    settings: {
      describe: () => structuredClone(forms),
      mutate: async (ns, ops: readonly SettingsMutation[]) => {
        const form = forms.find(item => item.ns === ns)!;
        for (const op of ops) {
          let parent = form.value;
          for (const step of op.path.slice(0, -1)) { parent[step] ??= {}; parent = parent[step] as Record<string, unknown>; }
          const key = op.path.at(-1)!;
          if (op.op === 'set') parent[key] = op.value; else delete parent[key];
        }
        form.revision++;
      },
    },
    credentials: { resolve: async ref => ({ value: keys.get(ref) }), describe: async ref => ({ available: keys.has(ref) }), set: async (ref, value) => { keys.set(ref, value); } },
    llm: {
      listProviders: () => [{ id: 'relay', name: 'Relay' }],
      listConfigurableProviders: () => [{ provider: 'relay', displayName: 'Relay', settingsNs: 'adapter', settingsPath: ['providers', 'relay'] }],
      listModels: () => [{ provider: 'relay', id: 'raw/[m]', name: 'Old' }],
      discoverModels: async (_ns, request) => {
        expect(request.provider).toBe('relay');
        expect(request.apiKey).toBe('shared-secret');
        return [{ id: '[薄甲]new/model', name: 'New' }];
      },
    },
  };
  return { service: new ConnectionsService(ports), forms, keys };
}

describe('DSH connection configuration', () => {
  it('uses an existing credential reference without sending its value to UI', async () => {
    const { service } = fixture();
    const connections = await service.listConnections();
    expect(connections[0]?.credentialRef).toBe('EXISTING_SHARED_KEY');
    expect(connections[0]?.credentialConfigured).toBe(true);
    expect(JSON.stringify(connections)).not.toContain('shared-secret');
  });

  it('keeps an incomplete configurable connection available for editing before its adapter can register it', async () => {
    const { service } = fixture();
    const descriptors = service.ports.llm.listConfigurableProviders();
    service.ports.llm.listConfigurableProviders = () => [...descriptors, { provider: 'unfinished', displayName: 'Unfinished', settingsNs: 'adapter', settingsPath: ['providers', 'unfinished'], error: '还没有填写模型' }];
    const models = service.ports.llm.listModels;
    service.ports.llm.listModels = provider => { if (provider === 'unfinished') throw new Error('NO_ADAPTER'); return models(provider); };
    const unfinished = (await service.listConnections()).find(row => row.provider === 'unfinished');
    expect(unfinished).toMatchObject({ active: false, models: [], error: '还没有填写模型' });
  });

  it('writes fieldwise to the real adapter namespace and preserves unrelated settings', async () => {
    const { service, forms, keys } = fixture();
    await service.saveConnection({ provider: 'relay', name: 'My relay', baseURL: 'https://new.test/v1', apiKey: 'updated-secret' });
    const profile = ((forms[0]!.value.providers as Record<string, unknown>).relay) as Record<string, unknown>;
    expect(profile.future).toEqual({ preserve: true });
    expect(profile.headers).toEqual({ 'X-Test': 'keep' });
    expect(profile.apiKeyEnv).toBe('EXISTING_SHARED_KEY');
    expect(keys.get('EXISTING_SHARED_KEY')).toBe('updated-secret');
    expect(JSON.stringify(forms)).not.toContain('updated-secret');
    expect(profile).not.toHaveProperty('selectedModel');
  });

  it('registers a hand-typed model with the existing DSH custom adapter without changing the default selection', async () => {
    const { service, forms } = fixture();
    await service.setPreference('relay', { selectedModel: '[手填]private/id' });
    const profile = ((forms[0]!.value.providers as Record<string, unknown>).relay) as Record<string, unknown>;
    expect(profile.models).toEqual(expect.arrayContaining([expect.objectContaining({ id: '[手填]private/id', name: '[手填]private/id' })]));
    expect(profile).not.toHaveProperty('defaultModel');
  });

  it('preserves existing named-catalog overrides when adding a hand-typed model to its DSH route', async () => {
    const { service, forms } = fixture();
    const profile = (forms[0]!.value.providers as Record<string, Record<string, unknown>>).relay!;
    delete profile.models;
    profile.modelOverrides = { 'raw/[m]': { name: 'Original alias', contextWindow: 12000, futureOption: { keep: true } } };
    await service.setPreference('relay', { selectedModel: 'new/raw-model' });
    expect(profile.models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'raw/[m]', name: 'Original alias', contextWindow: 12000, futureOption: { keep: true } }),
      expect.objectContaining({ id: 'new/raw-model', name: 'new/raw-model' }),
    ]));
    expect(profile).not.toHaveProperty('modelOverrides');
  });

  it('keeps manual capacity and parameter changes in the same DSH model settings', async () => {
    const { service, forms } = fixture();
    await service.setModelOverride('relay', 'raw/[m]', { alias: 'Named', contextWindow: 24000, outputLimit: 6000, temperature: false });
    const profile = ((forms[0]!.value.providers as Record<string, unknown>).relay) as Record<string, unknown>;
    expect(profile.models).toEqual([expect.objectContaining({ id: 'raw/[m]', name: 'Named', contextWindow: 24000, maxTokens: 6000, compat: { supportsTemperature: false } })]);
    expect((await service.resolveRoute({ provider: 'relay', model: 'raw/[m]', inputBudget: 22000 })).inputBudget).toBe(18000);
  });

  it.each(['models', 'modelOverrides'] as const)('inherits explicitly configured DSH %s capacity before applying the conservative budget', async field => {
    const { service, forms } = fixture();
    const profile = (forms[0]!.value.providers as Record<string, Record<string, unknown>>).relay!;
    if (field === 'models') profile.models = [{ id: 'local-model', contextWindow: 8192, maxTokens: 1024 }];
    else { delete profile.models; profile.modelOverrides = { 'local-model': { contextWindow: 8192, maxTokens: 1024 } }; }
    const route = await service.resolveRoute({ provider: 'relay', model: 'local-model', inputBudget: 24000 });
    expect(route).toMatchObject({ contextWindow: 8192, outputLimit: 1024, inputBudget: 7168 });
    await service.setPreference('relay', { overrides: { 'local-model': { contextWindow: 16000, outputLimit: 2000 } } });
    expect(await service.resolveRoute({ provider: 'relay', model: 'local-model', inputBudget: 24000 })).toMatchObject({ contextWindow: 16000, outputLimit: 2000, inputBudget: 14000 });
  });

  it('keeps existing adapter parameter restrictions above base-model capability suggestions', async () => {
    const { service, forms } = fixture();
    const profile = (forms[0]!.value.providers as Record<string, Record<string, unknown>>).relay!;
    profile.compat = { supportsTemperature: false };
    profile.models = [{ id: 'gpt-5', name: 'Model', reasoningEfforts: false }];
    const route = await service.resolveRoute({ provider: 'relay', model: 'gpt-5', inputBudget: 24000 });
    expect(route.parameters?.temperature).toBe(false);
    expect(route.parameters?.reasoning).toBe(false);
    expect(service.resolveCall(route, { temperature: 0.7, reasoningEffort: 'high' })).not.toHaveProperty('temperature');
    profile.models = [{ id: 'gpt-5', name: 'Model' }];
    service.ports.llm.resolveModelInfo = async () => ({ reasoning: { efforts: [{ id: 'high' }] } });
    expect((await service.resolveRoute({ provider: 'relay', model: 'gpt-5', inputBudget: 24000 })).parameters?.reasoning).toBe(true);
  });

  it('updates only full public metadata and retains the prior local snapshot after an update fails', async () => {
    const { service } = fixture();
    await service.setPreference('relay', { selectedModel: 'private/favourite', overrides: { 'private/favourite': { alias: 'Private alias' } } });
    const publicData = { public: { models: { 'public/model': { name: 'Public model', modalities: { input: ['text'], output: ['text'] }, limit: { context: 32000, output: 4000 } } } } };
    await service.updateCatalog(async (url, init) => {
      expect(url).toBe('https://models.dev/api.json');
      expect(JSON.stringify(init)).not.toContain('private');
      expect(init?.headers).toEqual({ Accept: 'application/json' });
      return Response.json(publicData);
    });
    expect(service.capabilities('relay', 'public/model').capabilities.contextWindow).toBe(32000);
    await expect(service.updateCatalog(async () => new Response('offline', { status: 503 }))).rejects.toThrow('503');
    expect(service.capabilities('relay', 'public/model').capabilities.contextWindow).toBe(32000);
    expect((await service.listConnections()).find(connection => connection.provider === 'relay')?.preference.selectedModel).toBe('private/favourite');
  });

  it('uses broad error fallback by default even with an older disabled 400 switch, and preserves an explicit new opt-out', async () => {
    const { service } = fixture();
    const route = { provider: 'relay', model: 'raw/[m]', inputBudget: 24000 };
    await service.setPreference('relay', { fallbackOn400: false });
    expect(service.fallbackOnError(route)).toBe(true);
    await service.setPreference('relay', { fallbackOnError: false });
    expect(service.fallbackOnError(route)).toBe(false);
    expect((await service.listConnections())[0]?.preference.fallbackOnError).toBe(false);
  });

  it('persists optional upstream error rules and rejects malformed regex before replacing usable preferences', async () => {
    const { service } = fixture();
    const route = { provider: 'relay', model: 'raw/[m]', inputBudget: 24000 };
    await service.setPreference('relay', { errorPatterns: ['upstream_rejected', '/overloaded/i'] });
    expect(service.errorPatterns(route)).toEqual(['upstream_rejected', '/overloaded/i']);
    await expect(service.setPreference('relay', { errorPatterns: ['/[unclosed/'] })).rejects.toThrow('正则');
    expect(service.errorPatterns(route)).toEqual(['upstream_rejected', '/overloaded/i']);
  });

  it('pulls endpoint models and preserves selection, aliases, manual models and overrides', async () => {
    const { service } = fixture();
    await service.setPreference('relay', { selectedModel: 'manual/id', models: [{ id: 'manual/id', name: 'Hand typed' }], overrides: { 'raw/[m]': { alias: 'Favourite', contextWindow: 20000 } } });
    const models = await service.discoverModels({ provider: 'relay' });
    expect(models.map(item => item.id)).toEqual(expect.arrayContaining(['[薄甲]new/model', 'manual/id', 'raw/[m]']));
    const connection = (await service.listConnections())[0]!;
    expect(connection.preference.selectedModel).toBe('manual/id');
    expect(connection.models.find(item => item.id === 'raw/[m]')?.name).toBe('Favourite');
    expect((await service.resolveRoute({ provider: 'relay', model: 'raw/[m]', inputBudget: 15000 })).contextWindow).toBe(20000);
  });
});

function toolFixture() {
  const f = fixture();
  const host: ConnectionsToolPort = {
    listConnections: () => f.service.listConnections(),
    listAdapters: async () => [{ provider: 'relay', name: 'Relay', settingsNs: 'adapter' }],
    discoverModels: input => f.service.discoverModels(input),
    capabilities: async input => f.service.capabilities(input.provider, input.model),
    resolveRoute: route => f.service.resolveRoute(route),
    setPreference: input => f.service.setPreference(input.provider, input.preference),
    setModelOverride: input => f.service.setModelOverride(input.provider, input.model, input.override),
    updateCatalog: async () => ({ updated: false, error: 'offline' }),
  };
  const tool = connectionsTool(host);
  const execute = (args: unknown) => tool.execute(args, {
    name: 'tavern_connections', arguments: args,
    signal: new AbortController().signal,
    callId: 'test-call' as ToolCallId, rootCallId: 'test-call' as ToolCallId,
    token: Symbol('test-call') as ToolExecutionToken,
    deferContext: () => {}, concludeTurn: () => {},
  } satisfies ToolRunContext);
  return { ...f, execute };
}

describe('ordinary assistant connection actions', () => {
  it('changes real shared preferences through the same operation as the panel and returns safe connections', async () => {
    const f = toolFixture();
    await f.execute({ action: 'setPreference', provider: 'relay', input: { selectedModel: 'raw/[m]', fallbackOnError: false, errorPatterns: ['capacity', '/POLICY/i'] } });
    const listed = await f.execute({ action: 'list' });
    expect(typeof listed).toBe('string');
    expect(String(listed)).toContain('raw/[m]');
    expect(String(listed)).not.toContain('shared-secret');
    expect((await f.service.listConnections())[0]?.preference).toMatchObject({ fallbackOnError: false, errorPatterns: ['capacity', '/POLICY/i'] });
  });
  it('rejects credential-granting and malformed actions without changing the shared key', async () => {
    const f = toolFixture();
    await expect(f.execute({ action: 'login', input: { password: 'secret' } })).rejects.toThrow();
    await expect(f.execute({ action: 'setPreference', provider: 'relay', input: { inputBudget: -1 } })).rejects.toThrow();
    expect(f.keys.get('EXISTING_SHARED_KEY')).toBe('shared-secret');
    expect((await f.service.listConnections())[0]?.preference).toEqual({});
  });
});
