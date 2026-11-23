import { CookieJar, type SerializedCookieJar } from 'tough-cookie';
import { object, positive, strings, text } from './catalog.js';
import type { AccountDefinition, AccountGroup, AccountKey, AccountKeyPage, AccountUser, BalanceView, BindKeyInput, JsonValue, LoginInput, LoginResult, PatInput, SiteStatus, VerifyInput } from './types.js';
export type { BindKeyInput, LoginInput, PatInput, VerifyInput } from './types.js';

export interface AccountGrant {
  family: 'legacy' | 'modern' | 'pat';
  user?: AccountUser;
  cookies?: SerializedCookieJar;
  accessToken?: string;
  accessExpiresAt?: number;
}
export interface NewApiPorts {
  account(id: string): AccountDefinition;
  readGrant(id: string): Promise<AccountGrant | undefined>;
  writeGrant(id: string, state: AccountGrant | undefined): Promise<void>;
  bindChatKey(input: { provider: string; apiKey: string; baseURL: string; settingsNs?: string; api?: string; name?: string; group?: string; accountId: string }): Promise<void>;
  resolveChatKey(provider: string): Promise<string | undefined>;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}
interface Challenge { family: 'legacy' | 'modern'; jar: CookieJar; flowToken?: string; methods: NonNullable<LoginResult['methods']> }
interface RequestOptions { method?: 'GET' | 'POST'; body?: unknown; grant?: AccountGrant; jar?: CookieJar; bearer?: string; auth?: boolean; api?: boolean }
export class NewApiError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'NewApiError'; }
}
export function parseGrant(value: unknown): AccountGrant | undefined {
  const row = object(value);
  if (!['legacy', 'modern', 'pat'].includes(String(row.family))) return undefined;
  const user = object(row.user);
  if (!positive(user.id) || !text(user.username)) return undefined;
  let cookies: SerializedCookieJar | undefined;
  if (row.cookies !== undefined) cookies = CookieJar.deserializeSync(JSON.stringify(row.cookies)).serializeSync();
  return { family: row.family as AccountGrant['family'], user: { id: Number(user.id), username: String(user.username), displayName: text(user.displayName), group: text(user.group), quota: number(user.quota), usedQuota: number(user.usedQuota) }, cookies, accessToken: text(row.accessToken), accessExpiresAt: number(row.accessExpiresAt) };
}
function json(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value;
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(object(value)).map(([key, entry]) => [key, json(entry)]));
  throw new NewApiError('站点返回了无法识别的数据');
}
function number(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function exchangeRate(value: unknown): number | undefined { const rate = number(value); return rate !== undefined && rate > 0 ? rate : undefined; }
function userOf(value: unknown): AccountUser {
  const data = object(value), id = positive(data.id), username = text(data.username);
  if (!id || !username) throw new NewApiError('站点没有返回完整的本人账户信息');
  return { id, username, displayName: text(data.display_name), group: text(data.group), quota: number(data.quota), usedQuota: number(data.used_quota) };
}
function keyOf(value: unknown): AccountKey {
  const row = object(value), id = positive(row.id);
  if (!id) throw new NewApiError('站点返回的 key 信息不完整');
  return { id, name: text(row.name) ?? String(id), group: text(row.group) ?? '', status: number(row.status), remaining: number(row.remain_quota), used: number(row.used_quota), unlimited: row.unlimited_quota === true, expiresAt: number(row.expired_time) };
}
function safeSite(value: string): URL {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new NewApiError('请填写有效的站点地址');
  return url;
}

/** One small adapter for the two named new-api authentication families. */
export class NewApiClient {
  private readonly challenges = new Map<string, Challenge>();
  private readonly knownKeys = new Map<string, Map<number, AccountKey>>();
  private readonly refreshing = new Map<string, Promise<AccountGrant>>();
  constructor(private readonly ports: NewApiPorts) {}

  private async request(accountId: string, path: string, options: RequestOptions = {}): Promise<Record<string, unknown>> {
    const definition = this.ports.account(accountId);
    const site = safeSite(options.api ? definition.apiURL : definition.siteURL);
    const url = new URL(path, site);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.method === 'POST') { headers['Content-Type'] = 'application/json'; headers.Origin = site.origin; }
    let grant = options.grant;
    if (options.auth && !grant) grant = await this.authenticated(accountId);
    const bearer = options.bearer ?? grant?.accessToken;
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    if (options.auth && grant?.user) headers['New-Api-User'] = String(grant.user.id);
    const jar = options.jar ?? (grant?.cookies ? CookieJar.deserializeSync(grant.cookies) : undefined);
    const cookie = jar?.getCookieStringSync(url.href);
    if (cookie) headers.Cookie = cookie;
    let response: Response;
    try {
      response = await (this.ports.fetcher ?? fetch)(url, { method: options.method ?? 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: 'error', signal: this.ports.signal ? AbortSignal.any([this.ports.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
    } catch (error) {
      if (this.ports.signal?.aborted) throw error;
      throw new NewApiError('没有连上这个站点，请检查地址后重试');
    }
    if (jar) for (const setCookie of response.headers.getSetCookie()) jar.setCookieSync(setCookie, url.href);
    let body: unknown;
    try { body = await response.json(); } catch { throw new NewApiError(`站点没有返回有效数据（${response.status}）`, response.status); }
    const envelope = object(body);
    if (!response.ok || envelope.success === false || envelope.code === false) throw new NewApiError(text(envelope.message) ?? `站点请求失败（${response.status}）`, response.status);
    if (!Object.keys(envelope).length) throw new NewApiError('站点没有返回有效数据', response.status);
    // Persist rotated legacy session cookies through the same shared credential record.
    if (grant && jar && options.auth) { grant = { ...grant, cookies: jar.serializeSync() }; await this.ports.writeGrant(accountId, grant); }
    return envelope;
  }
  private async authenticated(accountId: string): Promise<AccountGrant> {
    const grant = await this.ports.readGrant(accountId);
    if (!grant?.user) throw new NewApiError('先登录这个站点账号');
    if (grant.family === 'modern' && grant.accessExpiresAt !== undefined && grant.accessExpiresAt <= Date.now() / 1000 + 30) return this.refresh(accountId, grant);
    return grant;
  }
  private async refresh(accountId: string, grant: AccountGrant): Promise<AccountGrant> {
    const running = this.refreshing.get(accountId); if (running) return running;
    const pending = (async () => {
      const jar = grant.cookies ? CookieJar.deserializeSync(grant.cookies) : new CookieJar();
      const response = await this.request(accountId, '/api/user/auth/refresh', { method: 'POST', jar });
      return this.accept(accountId, response.data, jar, 'modern');
    })().finally(() => this.refreshing.delete(accountId));
    this.refreshing.set(accountId, pending);
    return pending;
  }
  private async accept(accountId: string, value: unknown, jar: CookieJar, family: 'legacy' | 'modern'): Promise<AccountGrant> {
    const data = object(value);
    const grant: AccountGrant = { family, cookies: jar.serializeSync(), user: userOf(family === 'modern' ? data.user : data) };
    if (family === 'modern') {
      if (!text(data.access_token)) throw new NewApiError('站点没有返回登录令牌');
      grant.accessToken = text(data.access_token);
      grant.accessExpiresAt = number(data.access_expires_at);
    }
    await this.ports.writeGrant(accountId, grant);
    this.challenges.delete(accountId);
    return grant;
  }
  async status(accountId: string): Promise<SiteStatus> {
    const response = await this.request(accountId, '/api/status');
    const raw = object(response.data);
    return { version: text(raw.version), passwordLogin: typeof raw.password_login_enabled === 'boolean' ? raw.password_login_enabled : undefined, ssoOnly: raw.sso_only === true || raw.auth_mode === 'sso_only', quotaPerUnit: positive(raw.quota_per_unit), displayType: text(raw.quota_display_type), customSymbol: text(raw.custom_currency_symbol), usdExchangeRate: number(raw.usd_exchange_rate), customCurrencyExchangeRate: exchangeRate(raw.custom_currency_exchange_rate), raw: json(raw) };
  }
  async login(input: LoginInput): Promise<LoginResult> {
    if (!input.username || !input.password) throw new NewApiError('填好账号和密码再登录');
    const jar = new CookieJar();
    const response = await this.request(input.accountId, '/api/user/login', { method: 'POST', body: { username: input.username, password: input.password }, jar });
    const data = object(response.data);
    if (data.require_verification === true || data.require_2fa === true) {
      const modern = data.require_verification === true;
      const methods = modern && Array.isArray(data.methods) ? data.methods.map(value => object(value)).filter(row => typeof row.method === 'string').map(row => ({ method: String(row.method), name: text(row.display_name), available: row.available !== false })) : [{ method: 'two_fa', name: '二步验证', available: true }];
      const challenge: Challenge = { family: modern ? 'modern' : 'legacy', jar, flowToken: text(data.flow_token), methods };
      if (modern && !challenge.flowToken) throw new NewApiError('站点没有返回验证凭据，请重新登录');
      this.challenges.set(input.accountId, challenge);
      return { state: 'verification', family: challenge.family, methods, expiresAt: number(data.expires_at) };
    }
    const family = typeof data.access_token === 'string' ? 'modern' : 'legacy';
    const grant = await this.accept(input.accountId, data, jar, family);
    return { state: 'authenticated', family, user: grant.user };
  }
  async verify(input: VerifyInput): Promise<LoginResult> {
    const challenge = this.challenges.get(input.accountId);
    if (!challenge) throw new NewApiError('这次验证已结束，请重新登录');
    if (!input.code) throw new NewApiError('填好验证码再继续');
    const method = input.method ?? challenge.methods.find(row => row.available)?.method ?? 'two_fa';
    const response = await this.request(input.accountId, challenge.family === 'modern' ? '/api/user/login/verify' : '/api/user/login/2fa', { method: 'POST', jar: challenge.jar, body: challenge.family === 'modern' ? { flow_token: challenge.flowToken, method, code: input.code } : { code: input.code } });
    const grant = await this.accept(input.accountId, response.data, challenge.jar, challenge.family);
    return { state: 'authenticated', family: challenge.family, user: grant.user };
  }
  async loginPat(input: PatInput): Promise<LoginResult> {
    if (!input.token.trim()) throw new NewApiError('填好个人访问令牌再连接');
    const draft: AccountGrant = { family: 'pat', accessToken: input.token, user: input.userId ? { id: input.userId, username: '' } : undefined };
    const response = await this.request(input.accountId, '/api/user/self', { grant: draft, auth: true });
    draft.user = userOf(response.data);
    await this.ports.writeGrant(input.accountId, draft);
    return { state: 'authenticated', family: 'modern', user: draft.user };
  }
  async self(accountId: string): Promise<AccountUser> {
    const response = await this.request(accountId, '/api/user/self', { auth: true });
    const user = userOf(response.data);
    const grant = await this.ports.readGrant(accountId);
    if (grant) await this.ports.writeGrant(accountId, { ...grant, user });
    return user;
  }
  async groups(accountId: string): Promise<AccountGroup[]> {
    const response = await this.request(accountId, '/api/user/self/groups?include_models=true', { auth: true });
    return Object.entries(object(response.data)).map(([id, value]) => { const row = object(value); return { id, description: text(row.desc) ?? id, ratio: number(row.ratio) ?? text(row.ratio), models: Array.isArray(row.models) ? strings(row.models) : undefined }; });
  }
  async models(accountId: string, group: string): Promise<string[]> {
    const response = await this.request(accountId, '/api/user/models?group=' + encodeURIComponent(group), { auth: true });
    if (!Array.isArray(response.data)) throw new NewApiError('站点没有返回模型列表');
    return strings(response.data);
  }
  async listKeys(accountId: string, page: number = 1, pageSize: number = 20): Promise<AccountKeyPage> {
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new NewApiError('key 列表页码无效');
    const response = await this.request(accountId, `/api/token/?p=${page}&page_size=${pageSize}`, { auth: true });
    const data = object(response.data);
    if (!Array.isArray(data.items)) throw new NewApiError('站点没有返回 key 列表');
    const items = data.items.map(keyOf);
    const cached = this.knownKeys.get(accountId) ?? new Map<number, AccountKey>();
    for (const key of items) cached.set(key.id, key);
    this.knownKeys.set(accountId, cached);
    return { items, total: number(data.total) ?? items.length, page: number(data.page) ?? page, pageSize: number(data.page_size) ?? pageSize };
  }
  async bindKey(input: BindKeyInput): Promise<{ provider: string; group: string }> {
    if (!positive(input.keyId)) throw new NewApiError('先选一个聊天 key');
    let key = this.knownKeys.get(input.accountId)?.get(input.keyId);
    if (!key) key = keyOf((await this.request(input.accountId, '/api/token/' + input.keyId, { auth: true })).data);
    const response = await this.request(input.accountId, `/api/token/${input.keyId}/key`, { method: 'POST', auth: true });
    const value = text(object(response.data).key);
    if (!value) throw new NewApiError('站点没有返回这个 key');
    const account = this.ports.account(input.accountId);
    await this.ports.bindChatKey({ provider: input.provider, apiKey: value, baseURL: account.apiURL, settingsNs: input.settingsNs, api: input.api, name: input.name ?? key.name, group: key.group, accountId: input.accountId });
    return { provider: input.provider, group: key.group };
  }
  private unit(status: SiteStatus): BalanceView['unit'] {
    return { quotaPerUnit: status.quotaPerUnit, displayType: status.displayType, symbol: status.customSymbol, usdExchangeRate: status.usdExchangeRate, customCurrencyExchangeRate: status.customCurrencyExchangeRate };
  }
  async accountBalance(accountId: string): Promise<BalanceView> {
    const [user, status] = await Promise.all([this.self(accountId), this.status(accountId)]);
    return { kind: 'account', remaining: user.quota, used: user.usedQuota, unlimited: false, unit: this.unit(status) };
  }
  async keyBalance(provider: string, accountId: string): Promise<BalanceView> {
    const key = await this.ports.resolveChatKey(provider);
    if (!key) throw new NewApiError('这个连接还没有聊天 key');
    const [response, status] = await Promise.all([this.request(accountId, '/api/usage/token/', { bearer: key, api: true }), this.status(accountId)]);
    const data = object(response.data);
    return { kind: 'key', remaining: number(data.total_available), used: number(data.total_used), total: number(data.total_granted), unlimited: data.unlimited_quota === true, unit: this.unit(status) };
  }
  async logout(accountId: string): Promise<void> {
    const grant = await this.ports.readGrant(accountId);
    this.challenges.delete(accountId);
    this.knownKeys.delete(accountId);
    try {
      if (grant && grant.family !== 'pat') await this.request(accountId, grant.family === 'modern' ? '/api/user/auth/logout' : '/api/user/logout', { method: grant.family === 'modern' ? 'POST' : 'GET', grant, auth: true });
    } finally { await this.ports.writeGrant(accountId, undefined); }
  }
  dispose(): void { this.challenges.clear(); this.knownKeys.clear(); }
}
