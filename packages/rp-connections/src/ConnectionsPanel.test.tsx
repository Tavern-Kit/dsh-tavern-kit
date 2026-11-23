// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { userEvent } from '@testing-library/user-event';
import { ConnectionsPanel, type ConnectionsPanelApi } from './ConnectionsPanel.js';
import { ConnectionsService, type ConnectionPorts, type SettingsForm } from './connections.js';
import { NewApiClient, type AccountGrant } from './new-api.js';
import type { AccountDefinition, Route } from './types.js';

afterEach(cleanup);
const rawId = '[薄甲]claude-sonnet-4-5';

/** Only network/provider and persistent ports are replaced; UI actions use the real domain services. */
function fixture(family: 'legacy' | 'modern' = 'modern') {
  const forms: SettingsForm[] = [
    { ns: 'adapter', revision: 0, value: { providers: {
      relay: { displayName: '月光连接', baseURL: 'https://api.story.test/v1', api: 'openai-completions', apiKeyEnv: 'SHARED_KEY', models: [{ id: rawId, name: '原始模型' }], future: { keep: true } },
      backup: { displayName: '备用连接', baseURL: 'https://backup.test/v1', api: 'openai-completions', models: [{ id: 'backup/model', name: '备用模型' }] },
    } } },
    { ns: 'tavern-kit-rp-connections', revision: 0, value: { preferences: {}, accounts: {} } },
  ];
  const keys = new Map([['SHARED_KEY', 'saved-chat-secret']]);
  const profiles = () => forms[0]!.value.providers as Record<string, Record<string, unknown>>;
  const ports: ConnectionPorts = {
    settings: {
      describe: () => structuredClone(forms),
      mutate: async (ns, operations) => {
        const form = forms.find(row => row.ns === ns)!;
        for (const operation of operations) {
          let parent = form.value;
          for (const step of operation.path.slice(0, -1)) { parent[step] ??= {}; parent = parent[step] as Record<string, unknown>; }
          const key = operation.path.at(-1)!;
          if (operation.op === 'set') parent[key] = structuredClone(operation.value); else delete parent[key];
        }
        form.revision++;
      },
    },
    credentials: { describe: async ref => ({ configured: keys.has(ref) }), resolve: async ref => ({ value: keys.get(ref) }), set: async (ref, value) => { keys.set(ref, value); } },
    llm: {
      listProviders: () => Object.keys(profiles()).map(id => ({ id, name: id })),
      listConfigurableProviders: () => Object.entries(profiles()).map(([provider, row]) => ({ provider, displayName: String(row.displayName ?? provider), settingsNs: 'adapter', settingsPath: ['providers', provider] })),
      listModels: provider => (profiles()[provider]?.models ?? []) as Array<{ id: string; name: string }>,
      discoverModels: async () => [{ id: '[按次]vendor/new-model', name: '新模型' }],
    },
  };
  const domain = new ConnectionsService(ports);
  const definitions = new Map<string, AccountDefinition>([['story', { id: 'story', name: '我的站点', siteURL: 'https://accounts.story.test', apiURL: 'https://api.story.test/v1' }]]);
  const grants = new Map<string, AccountGrant>();
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const accountUser = { id: 42, username: 'player', group: 'normal', quota: 1000000, used_quota: 50000 };
  const siteStatus = { quota_per_unit: 500000, quota_display_type: 'CUSTOM', custom_currency_symbol: '贝壳', custom_currency_exchange_rate: 1, usd_exchange_rate: 7 };
  const json = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { headers: { 'Content-Type': 'application/json' } });
  const account = new NewApiClient({
    account: id => definitions.get(id)!,
    readGrant: async id => grants.get(id),
    writeGrant: async (id, grant) => { if (grant) grants.set(id, grant); else grants.delete(id); },
    resolveChatKey: async provider => { const row = (await domain.listConnections()).find(row => row.provider === provider); return row?.credentialRef ? keys.get(row.credentialRef) : undefined; },
    bindChatKey: async input => {
      await domain.saveConnection({ provider: input.provider, settingsNs: input.settingsNs, baseURL: input.baseURL, api: input.api, apiKey: input.apiKey });
      await domain.setPreference(input.provider, { accountId: input.accountId, group: input.group });
    },
    fetcher: async (url, init) => {
      const path = new URL(String(url)).pathname;
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      requests.push({ path, body });
      if (path === '/api/status') return json(siteStatus);
      if (path === '/api/user/login') return family === 'modern' ? json({ require_verification: true, flow_token: 'server-only-flow', methods: [{ method: 'two_fa', available: true }] }) : json({ require_2fa: true });
      if (path === '/api/user/login/verify') return json({ access_token: 'private-access-token', access_expires_at: 9999999999, user: accountUser });
      if (path === '/api/user/login/2fa') return json(accountUser);
      if (path === '/api/user/self') return json(accountUser);
      if (path === '/api/user/self/groups') return json({ normal: { desc: '普通分组' }, special: { desc: '特别分组' } });
      if (path === '/api/user/models') return json(['[特别]vendor/model']);
      if (path === '/api/token/') return json({ items: [{ id: 7, name: '我的特别 key', group: 'special', unlimited_quota: false, remain_quota: 250000 }, { id: 8, name: '普通 key', group: 'normal', unlimited_quota: true }], total: 2, page: 1, page_size: 20 });
      if (path === '/api/token/7/key') return json({ key: 'chosen-chat-secret' });
      if (path === '/api/usage/token' || path === '/api/usage/token/') return json({ total_available: 250000, total_used: 50000, unlimited_quota: false });
      if (path.endsWith('logout')) return json({});
      throw new Error('Unexpected fixture request: ' + path);
    },
  });
  const api: ConnectionsPanelApi = {
    listConnections: () => domain.listConnections(),
    listAdapters: async () => [{ provider: 'relay', name: 'OpenAI compatible', settingsNs: 'adapter' }],
    saveConnection: input => domain.saveConnection(input),
    discoverModels: input => domain.discoverModels(input),
    setPreference: input => domain.setPreference(input.provider, input.preference),
    setModelOverride: input => domain.setModelOverride(input.provider, input.model, input.override),
    capabilities: async input => domain.capabilities(input.provider, input.model),
    resolveRoute: input => domain.resolveRoute(input),
    updateCatalog: async () => ({ updated: false, error: '目录暂时无法连接，已保留本地资料' }),
    listSponsors: async () => [{ id: 'sponsor', name: '伙伴站点', description: '让故事继续。', logo: 'assets/sponsor.svg', siteURL: 'https://sponsor.test', apiURL: 'https://sponsor.test/v1', label: '社区共创伙伴' }],
    listAccounts: async () => [...definitions.values()].map(row => ({ ...row, authenticated: grants.has(row.id), user: grants.get(row.id)?.user, family: grants.get(row.id)?.family })),
    saveAccount: async input => { definitions.set(input.id, input); return { ...input, authenticated: grants.has(input.id) }; },
    status: input => account.status(input.accountId),
    login: input => account.login(input), verify: input => account.verify(input), loginPat: input => account.loginPat(input),
    self: input => account.self(input.accountId), groups: input => account.groups(input.accountId), models: input => account.models(input.accountId, input.group),
    listKeys: input => account.listKeys(input.accountId, input.page, input.pageSize),
    bindKey: input => account.bindKey(input),
    accountBalance: input => account.accountBalance(input.accountId),
    keyBalance: input => account.keyBalance(input.provider, input.accountId ?? 'story'),
    logout: input => account.logout(input.accountId),
    clearCredential: async input => { const row = (await domain.listConnections()).find(row => row.provider === input.provider); if (row?.credentialRef) keys.delete(row.credentialRef); },
  };
  return { api, domain, forms, keys, requests, grants, definitions, profiles, accountUser, siteStatus };
}

async function openExisting() {
  await screen.findByRole('button', { name: '管理月光连接' });
  await userEvent.click(screen.getByRole('button', { name: '管理月光连接' }));
}

describe('ConnectionsPanel player actions', () => {
  it('loads connections and capabilities after a StrictMode remount', async () => {
    const f = fixture();
    render(<StrictMode><ConnectionsPanel api={f.api} /></StrictMode>);
    await openExisting();
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    await screen.findByRole('button', { name: /确认使用.*Claude Sonnet 4/i });
  });

  it('opens the account login when account definitions arrive after the player switches tabs', async () => {
    const f = fixture();
    const accounts = await f.api.listAccounts();
    let release!: (rows: typeof accounts) => void;
    const pending = new Promise<typeof accounts>(resolve => { release = resolve; });
    f.api.listAccounts = () => pending;
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(screen.getByRole('tab', { name: '站点账号' }));
    await act(async () => { release(accounts); });
    await screen.findByLabelText('用户名');
  });

  it('reuses the DSH credential and separates saving a raw model from choosing it for chat', async () => {
    const f = fixture();
    const chosen: Route[] = [];
    render(<ConnectionsPanel api={f.api} onChooseRoute={route => { chosen.push(route); }} />);
    await openExisting();
    expect(screen.queryByDisplayValue('saved-chat-secret')).toBeNull();
    await userEvent.clear(screen.getByLabelText('原始模型 ID'));
    await userEvent.type(screen.getByLabelText('原始模型 ID'), '[[手填]vendor/model');
    await userEvent.click(screen.getByRole('button', { name: '保存模型' }));
    await waitFor(async () => expect((await f.domain.listConnections())[0]?.preference.selectedModel).toBe('[手填]vendor/model'));
    expect(chosen).toEqual([]);
    expect(f.keys.get('SHARED_KEY')).toBe('saved-chat-secret');
    await userEvent.click(screen.getByRole('button', { name: '用于这段对话' }));
    await waitFor(() => expect(chosen[0]).toMatchObject({ provider: 'relay', model: '[手填]vendor/model' }));
  });

  it('creates a custom connection through an existing adapter and clears the typed secret after save', async () => {
    const f = fixture();
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '添加连接' }));
    await userEvent.type(screen.getByLabelText('连接标识'), 'moon');
    await userEvent.type(screen.getByLabelText('连接名称'), '月亮');
    await userEvent.type(screen.getByLabelText('API 地址'), 'https://moon.test/v1');
    await userEvent.type(screen.getByLabelText('聊天 key'), 'new-chat-secret');
    await userEvent.type(screen.getByLabelText('初始模型 ID'), '[[手填]moon/model');
    await userEvent.click(screen.getByRole('button', { name: '保存连接' }));
    await waitFor(() => expect(f.profiles().moon?.baseURL).toBe('https://moon.test/v1'));
    expect(JSON.stringify(f.forms)).not.toContain('new-chat-secret');
    expect(screen.queryByDisplayValue('new-chat-secret')).toBeNull();
    expect(f.profiles().relay?.future).toEqual({ keep: true });
  });

  it('keeps a hand-entered selection, alias and manual capacity while refreshing the model list', async () => {
    const f = fixture();
    await f.domain.setPreference('relay', { selectedModel: rawId, overrides: { [rawId]: { alias: '最喜欢的模型', contextWindow: 16000 } } });
    render(<ConnectionsPanel api={f.api} />);
    await openExisting();
    await userEvent.click(screen.getByRole('button', { name: '拉取模型' }));
    await screen.findByRole('option', { name: /新模型/ });
    expect((screen.getByLabelText('原始模型 ID') as HTMLInputElement).value).toBe(rawId);
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    const alias = screen.getByLabelText('展示名');
    expect((alias as HTMLInputElement).value).toBe('最喜欢的模型');
    await userEvent.clear(screen.getByLabelText('上下文容量'));
    await userEvent.type(screen.getByLabelText('上下文容量'), '32000');
    await userEvent.type(screen.getByLabelText('输出预留'), '4000');
    await userEvent.click(screen.getByRole('button', { name: '保存能力设置' }));
    await waitFor(() => expect(f.domain.capabilities('relay', rawId)).toMatchObject({ capabilities: { contextWindow: 32000, outputLimit: 4000 }, sources: { contextWindow: 'manual' } }));
    expect((await f.domain.listConnections())[0]?.preference.selectedModel).toBe(rawId);
  });

  it('requires confirmation before using a prefixed model catalog candidate and keeps the request ID', async () => {
    const f = fixture();
    render(<ConnectionsPanel api={f.api} />);
    await openExisting();
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    await screen.findByRole('button', { name: /确认使用.*Claude Sonnet 4/i });
    expect(f.domain.capabilities('relay', rawId).match).toBe('candidate');
    await userEvent.click(screen.getByRole('button', { name: /确认使用.*Claude Sonnet 4/i }));
    await waitFor(() => expect(f.domain.capabilities('relay', rawId).match).toBe('confirmed'));
    expect((await f.domain.listConnections())[0]?.models[0]?.id).toBe(rawId);
  });

  it('saves a cross-connection fallback in player order with broad error fallback enabled initially', async () => {
    const f = fixture();
    render(<ConnectionsPanel api={f.api} />);
    await openExisting();
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    expect((screen.getByRole('checkbox', { name: '启用备用模型' }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole('checkbox', { name: '报错时自动换备用' }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole('checkbox', { name: '启用备用模型' }));
    await userEvent.selectOptions(screen.getByLabelText('备用连接'), 'backup');
    await userEvent.click(screen.getByRole('button', { name: '加入备用链' }));
    await userEvent.selectOptions(screen.getByLabelText('备用连接'), 'relay');
    await userEvent.clear(screen.getByLabelText('备用模型 ID'));
    await userEvent.type(screen.getByLabelText('备用模型 ID'), 'manual/second');
    await userEvent.click(screen.getByRole('button', { name: '加入备用链' }));
    await userEvent.click(screen.getByRole('button', { name: '上移备用 2' }));
    await userEvent.click(screen.getByRole('button', { name: '保存备用链' }));
    await waitFor(async () => expect((await f.domain.listConnections())[0]?.preference).toMatchObject({ fallbackOnError: true, fallback: [{ provider: 'relay', model: 'manual/second' }, { provider: 'backup', model: 'backup/model' }] }));
    await userEvent.click(screen.getByRole('checkbox', { name: '启用备用模型' }));
    await userEvent.click(screen.getByRole('button', { name: '保存备用链' }));
    await waitFor(async () => expect((await f.domain.listConnections())[0]?.preference.fallback).toEqual([]));
  });

  it('keeps optional fallback error rules across saves and surfaces malformed regex without discarding the saved rules', async () => {
    const f = fixture();
    render(<ConnectionsPanel api={f.api} />);
    await openExisting();
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    await userEvent.click(screen.getByRole('checkbox', { name: '启用备用模型' }));
    const patterns = screen.getByLabelText('只匹配这些报错');
    await userEvent.type(patterns, 'overloaded\n/SAFETY/i');
    await userEvent.click(screen.getByRole('button', { name: '保存备用链' }));
    await waitFor(() => expect(f.domain.errorPatterns({ provider: 'relay', model: rawId, inputBudget: 24000 })).toEqual(['overloaded', '/SAFETY/i']));
    await userEvent.clear(patterns);
    await userEvent.type(patterns, '/(', { skipClick: true });
    await userEvent.click(screen.getByRole('button', { name: '保存备用链' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/^报错正则/);
    expect(f.domain.errorPatterns({ provider: 'relay', model: rawId, inputBudget: 24000 })).toEqual(['overloaded', '/SAFETY/i']);
  });

  it.each(['legacy', 'modern'] as const)('completes %s verification, binds only the chosen group key and logs out without removing it', async family => {
    const f = fixture(family);
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '站点账号' }));
    await userEvent.type(screen.getByLabelText('用户名'), 'player');
    await userEvent.type(screen.getByLabelText('密码'), 'login-once');
    await userEvent.click(screen.getByRole('button', { name: '登录账号' }));
    await screen.findByLabelText('验证码');
    expect(screen.queryByDisplayValue('login-once')).toBeNull();
    expect(f.requests.some(row => row.path.endsWith('/key'))).toBe(false);
    await userEvent.type(screen.getByLabelText('验证码'), '123456');
    await userEvent.click(screen.getByRole('button', { name: '完成验证' }));
    await screen.findByRole('button', { name: '退出账号' });
    await userEvent.selectOptions(screen.getByLabelText('查看分组'), 'special');
    await screen.findByText('[特别]vendor/model');
    const keyCard = await screen.findByRole('region', { name: '我的特别 key' });
    expect(f.requests.some(row => row.path.endsWith('/key'))).toBe(false);
    expect(screen.queryByText('private-access-token')).toBeNull();
    expect(screen.getByRole('region', { name: '账户额度' }).textContent).toContain('2 贝壳');
    await userEvent.click(within(keyCard).getByRole('button', { name: '用于聊天' }));
    await waitFor(() => expect(f.keys.get('SHARED_KEY')).toBe('chosen-chat-secret'));
    expect((await f.domain.listConnections())[0]?.preference.group).toBe('special');
    await userEvent.click(screen.getByRole('button', { name: '退出账号' }));
    await waitFor(() => expect(f.grants.has('story')).toBe(false));
    expect(f.keys.get('SHARED_KEY')).toBe('chosen-chat-secret');
    expect(screen.queryByDisplayValue('chosen-chat-secret')).toBeNull();
    expect(f.definitions.get('story')).toMatchObject({ siteURL: 'https://accounts.story.test', apiURL: 'https://api.story.test/v1' });
  });

  it.each([100, 0.9, 1.5])('shows custom site currency with multiplier %s rather than the USD exchange rate', async rate => {
    const f = fixture();
    f.siteStatus.custom_currency_exchange_rate = rate;
    f.accountUser.quota = 500000;
    await f.api.loginPat({ accountId: 'story', token: 'nap_fixture' });
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '站点账号' }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: '账户额度' })).getByText(`${rate} 贝壳`, { exact: true })).toBeTruthy());
  });

  it('logs in with a personal access token, shows permission errors and clears it from the form', async () => {
    const f = fixture();
    const original = f.api.groups;
    f.api.groups = async () => { throw new Error('缺少 profile:read 权限'); };
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '站点账号' }));
    await userEvent.click(screen.getByRole('radio', { name: '个人访问令牌' }));
    await userEvent.type(screen.getByLabelText('账号访问令牌'), 'nap_private_test');
    await userEvent.click(screen.getByRole('button', { name: '连接账号' }));
    await screen.findByText('缺少 profile:read 权限');
    expect(screen.queryByDisplayValue('nap_private_test')).toBeNull();
    expect(f.requests.some(row => row.path === '/api/user/login')).toBe(false);
    expect(f.keys.get('SHARED_KEY')).toBe('saved-chat-secret');
    f.api.groups = original;
  });

  it('keeps late account data out of a newly selected account and never presents missing balance as zero', async () => {
    const f = fixture();
    await f.api.loginPat({ accountId: 'story', token: 'nap_fixture' });
    f.definitions.set('other', { id: 'other', name: '另一个站点', siteURL: 'https://other.test', apiURL: 'https://other.test/v1' });
    await f.api.loginPat({ accountId: 'other', token: 'nap_other_fixture' });
    let release!: (balance: Awaited<ReturnType<ConnectionsPanelApi['accountBalance']>>) => void;
    const pending = new Promise<Awaited<ReturnType<ConnectionsPanelApi['accountBalance']>>>(resolve => { release = resolve; });
    f.api.accountBalance = input => input.accountId === 'story' ? pending : Promise.resolve({ kind: 'account', unlimited: false, unit: {} });
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '站点账号' }));
    await screen.findByRole('button', { name: '退出账号' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '站点账号' }), 'other');
    await act(async () => { release({ kind: 'account', remaining: 999, unlimited: false, unit: {} }); });
    expect(screen.getByRole('region', { name: '账户额度' }).textContent).toContain('未返回');
    expect(screen.getByRole('region', { name: '账户额度' }).textContent).not.toContain('999');
  });

  it('keeps the chosen account fixed while a login request is in flight', async () => {
    const f = fixture();
    f.definitions.set('other', { id: 'other', name: '另一个站点', siteURL: 'https://other.test', apiURL: 'https://other.test/v1' });
    let release!: (status: Awaited<ReturnType<ConnectionsPanelApi['status']>>) => void;
    const pending = new Promise<Awaited<ReturnType<ConnectionsPanelApi['status']>>>(resolve => { release = resolve; });
    f.api.status = () => pending;
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '站点账号' }));
    await userEvent.type(screen.getByLabelText('用户名'), 'player');
    await userEvent.type(screen.getByLabelText('密码'), 'login-once');
    await userEvent.click(screen.getByRole('button', { name: '登录账号' }));
    expect((screen.getByRole('combobox', { name: '站点账号' }) as HTMLSelectElement).disabled).toBe(true);
    await act(async () => { release({ passwordLogin: true, raw: {} }); });
    await screen.findByLabelText('验证码');
  });

  it('refreshes displayed capabilities after a catalog update without losing a draft alias', async () => {
    const f = fixture();
    let fresh = false;
    f.api.capabilities = async input => ({ ...f.domain.capabilities(input.provider, input.model), capabilities: { contextWindow: fresh ? 96000 : 32000 }, sources: { contextWindow: 'site' } });
    f.api.updateCatalog = async () => { fresh = true; return { updated: true }; };
    render(<ConnectionsPanel api={f.api} />);
    await openExisting();
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    await screen.findByText('32,000');
    await userEvent.type(screen.getByLabelText('展示名'), '还没保存的名字');
    await userEvent.click(screen.getByRole('button', { name: '更新能力目录' }));
    await screen.findByText('96,000');
    expect((screen.getByLabelText('展示名') as HTMLInputElement).value).toBe('还没保存的名字');
  });

  it('opens and dismisses sponsor information without changing connections or credentials', async () => {
    const f = fixture();
    render(<ConnectionsPanel api={f.api} />);
    await openExisting();
    await userEvent.click(screen.getByRole('tab', { name: '社区共创伙伴' }));
    const trigger = screen.getByRole('button', { name: '参与社区共创' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '参与社区共创' });
    expect(within(dialog).getByRole('link', { name: '提 Issue' }).getAttribute('href')).toBe('https://github.com/Tavern-Kit/dsh-tavern-kit/issues');
    expect(within(dialog).getByRole('link', { name: '点个 Star' }).getAttribute('href')).toBe('https://github.com/Tavern-Kit/dsh-tavern-kit');
    expect(dialog.querySelector('a[href^="mailto:"]')).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(Object.keys(f.profiles())).toEqual(['relay', 'backup']);
    expect([...f.keys]).toEqual([['SHARED_KEY', 'saved-chat-secret']]);
  });

  it('applies a sponsor template only after a click and keeps local catalog data on update failure', async () => {
    const f = fixture();
    render(<ConnectionsPanel api={f.api} />);
    await userEvent.click(await screen.findByRole('tab', { name: '社区共创伙伴' }));
    expect(Object.keys(f.profiles())).toEqual(['relay', 'backup']);
    await userEvent.click(await screen.findByRole('button', { name: '使用伙伴站点地址' }));
    expect((screen.getByLabelText('API 地址') as HTMLInputElement).value).toBe('https://sponsor.test/v1');
    expect(Object.keys(f.profiles())).toEqual(['relay', 'backup']);
    await userEvent.click(screen.getByRole('tab', { name: '高级' }));
    await userEvent.click(screen.getByRole('button', { name: '更新能力目录' }));
    await screen.findByText('目录暂时无法连接，已保留本地资料');
    expect(f.domain.capabilities('relay', rawId).match).toBe('candidate');
  });
});
