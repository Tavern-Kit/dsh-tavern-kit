import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import { credentialStoreFrom } from '@deepseek-ai/dsh-llm-pi-ai/src/auth.ts';
import { discoverModels as officialDiscover } from '@deepseek-ai/dsh-llm-pi-ai/src/discovery.ts';
import { ConnectionsService, type ConnectionPorts, type SettingsForm } from './connections.js';
import { discoverEndpointModels } from './endpoint-discovery.js';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });

async function fixture(provider: string, declared: boolean, useRecord: boolean = false) {
  const seen: Array<{ path?: string; authorization?: string; header?: string }> = [];
  const server = createServer((req, res) => {
    seen.push({ path: req.url, authorization: req.headers.authorization, header: String(req.headers['x-fixture-auth'] ?? '') });
    res.setHeader('content-type', 'application/json');
    if (req.url !== '/v1/models' || req.headers['x-fixture-auth'] !== 'present' || !declared && req.headers.authorization !== 'Bearer shared-record-secret') {
      res.statusCode = 401; res.end(JSON.stringify({ error: 'fixture authentication required' })); return;
    }
    res.end(JSON.stringify({ data: [{ id: '[served]fresh/model', name: 'Fresh from endpoint' }] }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); }));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('fixture port unavailable');
  const baseURL = `http://127.0.0.1:${address.port}/v1`;
  const profile: Record<string, unknown> = {
    baseURL,
    headers: { 'X-Fixture-Auth': 'present', 'X-Unrelated': 'preserved' },
    models: [{ id: 'local-model', name: 'Existing alias', contextWindow: 8192, maxTokens: 1024, futureOption: true }],
    ...(declared ? { api: 'openai-completions' } : useRecord ? {} : { apiKeyEnv: 'SHARED_RECORD_KEY' }),
  };
  const forms: SettingsForm[] = [
    { ns: 'adapter', revision: 0, value: { providers: { [provider]: profile } } },
    { ns: 'tavern-kit-rp-connections', revision: 0, value: { preferences: {}, accounts: {} } },
  ];
  const officialStore = credentialStoreFrom({ get: (name: string) => name === 'credentials' ? { readRecord: async (key: string) => useRecord && key === 'llm-pi-ai/' + provider ? { kind: 'api-key', key: 'shared-record-secret' } : undefined } : undefined } as unknown as Context);
  const ports: ConnectionPorts = {
    settings: {
      describe: () => structuredClone(forms),
      mutate: async (ns, operations) => {
        const form = forms.find(row => row.ns === ns)!;
        for (const operation of operations) {
          let target = form.value;
          for (const part of operation.path.slice(0, -1)) { target[part] ??= {}; target = target[part] as Record<string, unknown>; }
          const key = operation.path.at(-1)!;
          if (operation.op === 'set') target[key] = operation.value; else delete target[key];
        }
        form.revision++;
      },
    },
    credentials: {
      resolve: async ref => ({ value: ref === 'SHARED_RECORD_KEY' ? 'shared-record-secret' : undefined }),
      describe: async ref => ({ configured: ref === 'SHARED_RECORD_KEY' }),
      resolveProviderKey: async id => { const value = await officialStore.read(id); return value?.type === 'api_key' ? value.key : undefined; },
      describeProvider: async id => ({ configured: await officialStore.read(id) !== undefined }),
      set: async () => { throw new Error('refresh must not copy or replace credentials'); },
    },
    llm: {
      listProviders: () => [{ id: provider, name: provider }],
      listConfigurableProviders: () => [{ provider, displayName: provider, settingsNs: 'adapter', settingsPath: ['providers', provider], declared, defaultBaseURL: baseURL, nativeAuth: { env: ['OPENAI_API_KEY'] } }],
      listModels: () => [{ id: 'local-model', name: 'Existing alias' }],
      // Match the installed adapter's storedDiscoveryProfile(request.provider) lookup.
      discoverModels: async (_ns, request, signal) => officialDiscover({ ...request, signal }, () => request.provider === provider ? { headers: profile.headers as Record<string, string>, resolveApiKey: async () => declared ? undefined : 'shared-record-secret' } : undefined),
      discoverEndpointModels: (request, headers, signal) => discoverEndpointModels({ ...request, signal }, headers),
    },
  };
  return { service: new ConnectionsService(ports), seen, forms, profile, officialStore };
}

describe('existing DSH endpoint discovery', () => {
  it('refreshes a header-only custom route through real official discovery without losing its stored headers', async () => {
    const f = await fixture('relay', true);
    const models = await f.service.discoverModels({ provider: 'relay' });
    expect(f.seen).toEqual([{ path: '/v1/models', authorization: undefined, header: 'present' }]);
    expect(models).toEqual(expect.arrayContaining([{ id: '[served]fresh/model', name: 'Fresh from endpoint', capabilities: {} }]));
    expect(f.profile.headers).toEqual({ 'X-Fixture-Auth': 'present', 'X-Unrelated': 'preserved' });
    expect(f.profile.models).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'local-model', name: 'Existing alias', futureOption: true, contextWindow: 8192, maxTokens: 1024 })]));
  });

  it('reuses a real DSH provider credential record when its native environment reference is absent', async () => {
    const f = await fixture('openai', false, true);
    expect((await f.officialStore.read('openai'))?.type).toBe('api_key');
    const models = await f.service.discoverModels({ provider: 'openai' });
    expect(f.seen).toEqual([{ path: '/v1/models', authorization: 'Bearer shared-record-secret', header: 'present' }]);
    expect(models.map(row => row.id)).toContain('[served]fresh/model');
    expect((await f.service.listConnections())[0]?.credentialConfigured).toBe(true);
    expect(f.profile).not.toHaveProperty('apiKeyEnv');
    expect(JSON.stringify(f.forms)).not.toContain('shared-record-secret');
    expect(JSON.stringify(await f.service.listConnections())).not.toContain('shared-record-secret');
  });

  it('preserves record authentication when editing connection details without replacing the key', async () => {
    const f = await fixture('openai', false, true);
    await f.service.saveConnection({ provider: 'openai', name: 'Renamed' });
    expect(f.profile).not.toHaveProperty('apiKeyEnv');
    expect(f.profile.displayName).toBe('Renamed');
    expect((await f.officialStore.read('openai'))?.type).toBe('api_key');
  });

  it('refreshes a named catalog route from its configured endpoint and same shared credential instead of returning static models', async () => {
    const f = await fixture('openai', false);
    const models = await f.service.discoverModels({ provider: 'openai' });
    expect(f.seen).toEqual([{ path: '/v1/models', authorization: 'Bearer shared-record-secret', header: 'present' }]);
    expect(models.map(row => row.id)).toEqual(['local-model', '[served]fresh/model']);
    expect(f.profile.apiKeyEnv).toBe('SHARED_RECORD_KEY');
    expect(JSON.stringify(f.forms)).not.toContain('shared-record-secret');
    expect(JSON.stringify(models)).not.toContain('shared-record-secret');
  });
});
