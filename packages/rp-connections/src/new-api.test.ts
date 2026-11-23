import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { NewApiClient, type AccountGrant, type NewApiPorts } from './new-api.js';

const closers: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });
async function fixture(handler: (req: IncomingMessage, body: Record<string, unknown>, res: ServerResponse) => unknown) {
  const requests: Array<{ path: string; authorization?: string; cookie?: string; userId?: string }> = [];
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += String(chunk);
    requests.push({ path: req.url!, authorization: req.headers.authorization, cookie: req.headers.cookie, userId: req.headers['new-api-user'] as string | undefined });
    res.setHeader('content-type', 'application/json');
    const result = handler(req, raw ? JSON.parse(raw) as Record<string, unknown> : {}, res);
    res.end(JSON.stringify(result));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  closers.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('fixture port unavailable');
  const url = `http://127.0.0.1:${address.port}`;
  const grants = new Map<string, AccountGrant>();
  let bound: { provider: string; key: string; group?: string } | undefined;
  const ports: NewApiPorts = {
    account: () => ({ id: 'test', siteURL: url, apiURL: url + '/v1' }),
    readGrant: async id => grants.get(id),
    writeGrant: async (id, state) => { if (state) grants.set(id, state); else grants.delete(id); },
    bindChatKey: async input => { bound = { provider: input.provider, key: input.apiKey, group: input.group }; },
    resolveChatKey: async () => bound?.key,
  };
  return { client: new NewApiClient(ports), ports, grants, requests, url, bound: () => bound };
}
const user = { id: 42, username: 'player', group: 'normal', quota: 500000, used_quota: 100000 };
function common(req: IncomingMessage) {
  if (req.url === '/api/status') return { success: true, data: { version: 'v1.0.0-rc.51', quota_per_unit: 500000, quota_display_type: 'CUSTOM', custom_currency_symbol: '贝壳' } };
  if (req.url === '/api/user/self') return { success: true, data: user };
  if (req.url?.startsWith('/api/user/self/groups')) return { success: true, data: { normal: { desc: '普通', ratio: 1 }, special: { desc: '另一组', ratio: 2 } } };
  if (req.url?.startsWith('/api/user/models?')) return { success: true, data: ['[薄甲]raw/model', 'manual/id'] };
  if (req.url?.startsWith('/api/token/?')) return { success: true, data: { items: [{ id: 7, key: 'masked', name: 'My key', group: 'special', unlimited_quota: false, remain_quota: 50000 }], total: 1, page: 1, page_size: 20 } };
  if (req.url === '/api/token/7/key') return { success: true, data: { key: 'chat-secret' } };
  if (req.url === '/api/usage/token/') return { code: true, message: 'success', data: { total_available: 50000, total_used: 10000, total_granted: 60000, unlimited_quota: false } };
  return { success: false, message: 'unknown path' };
}

describe('new-api account protocol', () => {
  it('completes legacy cookie 2FA, keeps account/key permissions separate and binds only the chosen key', async () => {
    const f = await fixture((req, body, res) => {
      if (req.url === '/api/user/login') { expect(body.password).toBe('login-only-password'); res.setHeader('set-cookie', 'session=pending; HttpOnly; Path=/'); return { success: true, data: { require_2fa: true } }; }
      if (req.url === '/api/user/login/2fa') { expect(body).toEqual({ code: '123456' }); expect(req.headers.cookie).toContain('session=pending'); res.setHeader('set-cookie', 'session=authenticated; HttpOnly; Path=/'); return { success: true, data: user }; }
      if (req.url === '/api/user/logout') return { success: true };
      if (req.url !== '/api/status' && req.url !== '/api/usage/token/') { expect(req.headers.cookie).toContain('session=authenticated'); expect(req.headers['new-api-user']).toBe('42'); expect(req.headers.authorization).toBeUndefined(); }
      if (req.url === '/api/usage/token/') { expect(req.headers.authorization).toBe('Bearer chat-secret'); expect(req.headers.cookie).toBeUndefined(); }
      return common(req);
    });
    expect(await f.client.login({ accountId: 'test', username: 'player', password: 'login-only-password' })).toMatchObject({ state: 'verification', family: 'legacy' });
    await f.client.verify({ accountId: 'test', code: '123456' });
    expect(await f.client.groups('test')).toHaveLength(2);
    expect(await f.client.models('test', 'special')).toEqual(['[薄甲]raw/model', 'manual/id']);
    expect((await f.client.listKeys('test')).items[0]?.group).toBe('special');
    expect(f.bound()).toBeUndefined();
    await f.client.bindKey({ accountId: 'test', keyId: 7, provider: 'relay' });
    expect(f.bound()).toEqual({ provider: 'relay', key: 'chat-secret', group: 'special' });
    expect(await f.client.accountBalance('test')).toMatchObject({ kind: 'account', remaining: 500000, used: 100000, unit: { quotaPerUnit: 500000, symbol: '贝壳' } });
    expect(await f.client.keyBalance('relay', 'test')).toMatchObject({ kind: 'key', remaining: 50000 });
    expect(JSON.stringify([...f.grants.values()])).not.toContain('login-only-password');
    await f.client.logout('test');
    expect(f.grants.has('test')).toBe(false);
    expect(f.bound()?.key).toBe('chat-secret');
    expect(f.requests.some(row => row.path === '/api/models/')).toBe(false);
  });

  it('completes modern verification and refreshes expired JWT with its path-scoped cookie', async () => {
    let refreshed = false;
    const f = await fixture((req, body, res) => {
      if (req.url === '/api/user/login') return { success: true, data: { require_verification: true, flow_token: 'private-flow', methods: [{ method: 'two_fa', available: true }] } };
      if (req.url === '/api/user/login/verify') { expect(body).toEqual({ flow_token: 'private-flow', method: 'two_fa', code: '654321' }); res.setHeader('set-cookie', 'new_api_refresh=refresh-secret; HttpOnly; Path=/api/user/auth'); return { success: true, data: { access_token: 'expired-token', access_expires_at: 1, user } }; }
      if (req.url === '/api/user/auth/refresh') { expect(req.headers.cookie).toContain('new_api_refresh=refresh-secret'); expect(req.headers.origin).toBe(f.url); refreshed = true; return { success: true, data: { access_token: 'fresh-token', access_expires_at: 9999999999, user } }; }
      if (req.url === '/api/user/self') { expect(req.headers.authorization).toBe('Bearer fresh-token'); expect(req.headers.cookie).toBeUndefined(); }
      return common(req);
    });
    const login = await f.client.login({ accountId: 'test', username: 'player', password: 'once' });
    expect(JSON.stringify(login)).not.toContain('private-flow');
    await f.client.verify({ accountId: 'test', code: '654321' });
    expect(await f.client.self('test')).toMatchObject({ username: 'player' });
    expect(refreshed).toBe(true);
  });

  it('requests the exact trailing-slash key quota route without following redirects', async () => {
    const f = await fixture((req, _body, res) => {
      if (req.url === '/api/status') return common(req);
      if (req.url === '/api/usage/token') { res.statusCode = 301; res.setHeader('location', '/api/usage/token/'); return {}; }
      if (req.url === '/api/usage/token/') { expect(req.headers.authorization).toBe('Bearer fixture-chat-key'); return { code: true, data: { total_available: 250000, total_used: 50000, unlimited_quota: false } }; }
      return { success: false, message: 'wrong endpoint' };
    });
    f.ports.resolveChatKey = async () => 'fixture-chat-key';
    expect(await f.client.keyBalance('relay', 'test')).toMatchObject({ kind: 'key', remaining: 250000, used: 50000 });
    expect(f.requests.map(row => row.path)).toContain('/api/usage/token/');
    expect(f.requests.map(row => row.path)).not.toContain('/api/usage/token');
  });

  it.each([100, 0.9, 1.5])('preserves the site custom-currency conversion %s separately from the USD rate', async rate => {
    const f = await fixture(req => req.url === '/api/status'
      ? { success: true, data: { quota_per_unit: 500000, quota_display_type: 'CUSTOM', custom_currency_symbol: '岛币', custom_currency_exchange_rate: rate, usd_exchange_rate: 7 } }
      : common(req));
    await f.client.loginPat({ accountId: 'test', token: 'nap_fixture' });
    expect(await f.client.accountBalance('test')).toMatchObject({ remaining: 500000, unit: { quotaPerUnit: 500000, displayType: 'CUSTOM', symbol: '岛币', customCurrencyExchangeRate: rate, usdExchangeRate: 7 } });
  });

  it('honors JSON business errors and PAT scope failures without falling back to an inference key', async () => {
    const f = await fixture(req => req.url === '/api/user/self' ? { success: true, data: user } : req.url === '/api/status' ? common(req) : { success: false, message: '缺少 api_key:read 权限' });
    await f.client.loginPat({ accountId: 'test', token: 'nap_scoped', userId: 42 });
    await expect(f.client.listKeys('test')).rejects.toThrow('缺少 api_key:read 权限');
    expect(f.requests.at(-1)?.authorization).toBe('Bearer nap_scoped');
    expect(f.bound()).toBeUndefined();
  });
});
