import { readFile } from 'node:fs/promises';
import { type Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { credentialKey, credentialRef, isCredentialKeySegment } from '@deepseek-ai/dsh-credentials';
import type {} from '@deepseek-ai/dsh-settings';
import type {} from '@deepseek-ai/dsh-llm';
import type {} from '@deepseek-ai/dsh-tools';
import { connectionsTool } from './tools.js';
import { ConnectionsService } from './connections.js';
import { discoverEndpointModels, recordKeyFor } from './endpoint-discovery.js';
import { NewApiClient, parseGrant, type AccountGrant } from './new-api.js';
import { accountSchema, bindKeySchema, discoverModelsSchema, loginSchema, overrideSchema, patSchema, preferenceSchema, routeSchema, saveConnectionSchema, verifySchema } from './schemas.js';
import { object, text } from './catalog.js';
import { sponsors } from './sponsors.js';
import type { AccountDefinition, AccountGroup, AccountKeyPage, AccountModelsRequest, AccountRequest, AccountUser, AccountView, AdapterView, BalanceView, BindKeyInput, CallControls, CatalogMatch, ClearCredentialRequest, ConnectionPreference, ConnectionsConfig, ConnectionView, DiscoverModelsInput, KeyBalanceRequest, KeysRequest, LoginInput, LoginResult, ModelEntry, ModelRequest, OverrideRequest, PatInput, PreferenceRequest, ResolvedCall, Route, SaveConnectionInput, SiteStatus, Sponsor, VerifyInput } from './types.js';
export type { AdapterView, ProviderRequest, ModelRequest, PreferenceRequest, OverrideRequest, RouteCallRequest, AccountRequest, AccountModelsRequest, KeysRequest, KeyBalanceRequest, ClearCredentialRequest } from './types.js';

const SETTINGS_NS = 'tavern-kit-rp-connections';

/** Shared public Host operations; callers in the UI and tools use these same methods. */
export default class RpConnections extends TypertRemoteService {
  static inject = ['llm', 'settings', 'credentials', 'typert'];
  static Config: Schema<ConnectionsConfig, unknown> = Schema.object({
    preferences: Schema.dict(Schema.any()).default({}).volatile(),
    accounts: Schema.dict(Schema.any()).default({}).volatile(),
    catalog: Schema.any().volatile(),
  });
  readonly domain: ConnectionsService;
  readonly newApi: NewApiClient;
  private readonly lifetime = new AbortController();

  constructor(ctx: Context, private readonly config: ConnectionsConfig) {
    super(ctx, 'rpConnections', { namespace: 'rpConnections' });
    this.domain = new ConnectionsService({
      llm: {
        listProviders: () => ctx.llm.listProviders(),
        listModels: provider => ctx.llm.listModels(provider),
        resolveModelInfo: (provider, model) => ctx.llm.resolveModelInfo(provider, model, this.lifetime.signal),
        listConfigurableProviders: () => ctx.llm.listConfigurableProviders(),
        discoverModels: (ns, request, signal) => ctx.llm.discoverModels(ns, request, signal),
        discoverEndpointModels: (request, headers, signal) => discoverEndpointModels({ ...request, signal }, headers),
      },
      settings: { describe: () => ctx.settings.describe().map(row => ({ ...row, value: object(row.value) })), mutate: (ns, operations, revision) => ctx.settings.mutate(ns, operations, revision) },
      credentials: {
        describe: ref => ctx.credentials.describe(credentialRef(ref)),
        resolve: ref => ctx.credentials.resolve(credentialRef(ref)),
        resolveProviderKey: async provider => {
          if (!isCredentialKeySegment(provider)) return undefined;
          const record = await ctx.credentials.readRecord(recordKeyFor(provider));
          if (record?.kind !== 'api-key') return undefined;
          if (record.key !== undefined) return record.key;
          for (const ref of ctx.llm.listConfigurableProviders().find(row => row.provider === provider)?.nativeAuth?.env ?? []) {
            const key = record.env?.[ref];
            if (key !== undefined) return key;
          }
          return undefined;
        },
        describeProvider: async provider => isCredentialKeySegment(provider) ? ctx.credentials.describeRecord(recordKeyFor(provider)) : { configured: false },
        set: (ref, value) => ctx.credentials.set(credentialRef(ref), value),
      },
    }, SETTINGS_NS);
    this.newApi = new NewApiClient({
      account: id => {
        if (id.startsWith('connection:')) {
          const provider = id.slice('connection:'.length);
          const endpoint = this.domain.endpoint(provider);
          if (!endpoint.baseURL) throw new Error('这个连接还没有 API 地址');
          return { id, siteURL: new URL(endpoint.baseURL).origin, apiURL: endpoint.baseURL };
        }
        const definition = this.ownConfig().accounts[id];
        if (!definition) throw new Error('先添加这个站点账号');
        return definition;
      },
      readGrant: id => this.readGrant(id),
      writeGrant: (id, grant) => this.writeGrant(id, grant),
      resolveChatKey: provider => this.resolveChatKey(provider),
      bindChatKey: async input => {
        const models = await this.domain.discoverModels({ settingsNs: input.settingsNs, baseURL: input.baseURL, api: input.api ?? 'openai-completions', apiKey: input.apiKey }, this.lifetime.signal);
        await this.domain.saveConnection({ provider: input.provider, settingsNs: input.settingsNs, baseURL: input.baseURL, api: input.api ?? 'openai-completions', apiKey: input.apiKey, name: input.name, models });
        await this.domain.setPreference(input.provider, { group: input.group, accountId: input.accountId });
      },
      signal: this.lifetime.signal,
    });
    ctx.effect(() => () => { this.lifetime.abort(); this.newApi.dispose(); });
    ctx.inject(['tools'], scope => {
      scope.effect(() => scope.tools.register(connectionsTool(this)), 'tavern-kit-connections: ordinary assistant actions');
    });
  }
  private ownConfig(): ConnectionsConfig {
    const form = this.ctx.settings.describe().find(row => row.ns === SETTINGS_NS);
    const value = object(form?.value ?? this.config);
    const preferences: Record<string, ConnectionPreference> = {};
    const accounts: Record<string, AccountDefinition> = {};
    for (const [id, preference] of Object.entries(object(value.preferences))) preferences[id] = preferenceSchema.parse(preference);
    for (const [id, account] of Object.entries(object(value.accounts))) accounts[id] = accountSchema.parse(account);
    return { preferences, accounts, catalog: value.catalog };
  }
  private async ownSet(path: string[], value: unknown): Promise<void> {
    const form = this.ctx.settings.describe().find(row => row.ns === SETTINGS_NS);
    if (!form) throw new Error('模型连接设置暂时不可写');
    await this.ctx.settings.mutate(SETTINGS_NS, [{ op: 'set', path, value }], form.revision);
  }
  private async readGrant(id: string): Promise<AccountGrant | undefined> {
    const record = await this.ctx.credentials.readRecord(credentialKey('tavern-kit-accounts', id));
    return record?.kind === 'grant' ? parseGrant(record.payload) : undefined;
  }
  private async writeGrant(id: string, grant: AccountGrant | undefined): Promise<void> {
    const key = credentialKey('tavern-kit-accounts', id);
    if (grant) await this.ctx.credentials.modifyRecord(key, async () => ({ kind: 'grant', payload: grant }));
    else await this.ctx.credentials.deleteRecord(key);
  }
  private async resolveChatKey(provider: string): Promise<string | undefined> {
    return this.domain.resolveCredential(provider);
  }

  @Remote async listConnections(): Promise<ConnectionView[]> { return this.domain.listConnections(); }
  @Remote async listAdapters(): Promise<AdapterView[]> {
    return this.ctx.llm.listConfigurableProviders().map(row => ({ provider: row.provider, name: row.displayName, settingsNs: row.settingsNs, baseURL: row.defaultBaseURL }));
  }
  @Remote async saveConnection(input: SaveConnectionInput): Promise<ConnectionView> { return this.domain.saveConnection(saveConnectionSchema.parse(input)); }
  @Remote async discoverModels(input: DiscoverModelsInput): Promise<ModelEntry[]> { return this.domain.discoverModels(discoverModelsSchema.parse(input), this.lifetime.signal); }
  @Remote async setPreference(input: PreferenceRequest): Promise<ConnectionPreference> { return this.domain.setPreference(input.provider, preferenceSchema.parse(input.preference)); }
  @Remote async setModelOverride(input: OverrideRequest): Promise<CatalogMatch> { return this.domain.setModelOverride(input.provider, input.model, overrideSchema.parse(input.override)); }
  @Remote async capabilities(input: ModelRequest): Promise<CatalogMatch> { return this.domain.capabilities(input.provider, input.model); }
  @Remote async resolveRoute(input: Route): Promise<Route> { return this.domain.resolveRoute(routeSchema.parse(input)); }
  @Remote async resolveCall(route: Route, controls: CallControls): Promise<ResolvedCall> { return this.domain.resolveCall(routeSchema.parse(route), controls); }
  @Remote async getFallback(route: Route): Promise<Route[]> { return this.domain.getFallback(route); }
  @Remote async fallbackOnError(route: Route): Promise<boolean> { return this.domain.fallbackOnError(route); }
  @Remote async errorPatterns(route: Route): Promise<string[]> { return this.domain.errorPatterns(route); }
  @Remote async fallbackOn400(route: Route): Promise<boolean> { return this.domain.fallbackOn400(route); }
  @Remote async updateCatalog(): Promise<{ updated: boolean; error?: string }> {
    try { await this.domain.updateCatalog(undefined, this.lifetime.signal); return { updated: true }; }
    catch (error) { return { updated: false, error: error instanceof Error ? error.message : '这次没能更新模型目录，继续使用本地资料' }; }
  }
  @Remote async listSponsors(): Promise<Sponsor[]> {
    return Promise.all(sponsors.map(async row => {
      const mime = row.logo.endsWith('.png') ? 'image/png' : 'image/svg+xml';
      return { ...row, logo: `data:${mime};base64,` + (await readFile(new URL('../' + row.logo, import.meta.url))).toString('base64') };
    }));
  }

  @Remote async listAccounts(): Promise<AccountView[]> {
    return Promise.all(Object.values(this.ownConfig().accounts).map(async definition => {
      const grant = await this.readGrant(definition.id);
      return { ...definition, authenticated: Boolean(grant?.user), family: grant?.family, user: grant?.user };
    }));
  }
  @Remote async saveAccount(input: AccountDefinition): Promise<AccountView> {
    const definition = accountSchema.parse(input);
    const old = this.ownConfig().accounts[definition.id];
    if (old && (old.siteURL !== definition.siteURL || old.apiURL !== definition.apiURL)) await this.writeGrant(definition.id, undefined);
    await this.ownSet(['accounts', definition.id], definition);
    const grant = await this.readGrant(definition.id);
    return { ...definition, authenticated: Boolean(grant?.user), family: grant?.family, user: grant?.user };
  }
  @Remote async status(input: AccountRequest): Promise<SiteStatus> { return this.newApi.status(input.accountId); }
  @Remote async login(input: LoginInput): Promise<LoginResult> { return this.newApi.login(loginSchema.parse(input)); }
  @Remote async verify(input: VerifyInput): Promise<LoginResult> { return this.newApi.verify(verifySchema.parse(input)); }
  @Remote async loginPat(input: PatInput): Promise<LoginResult> { return this.newApi.loginPat(patSchema.parse(input)); }
  @Remote async self(input: AccountRequest): Promise<AccountUser> { return this.newApi.self(input.accountId); }
  @Remote async groups(input: AccountRequest): Promise<AccountGroup[]> { return this.newApi.groups(input.accountId); }
  @Remote async models(input: AccountModelsRequest): Promise<string[]> { return this.newApi.models(input.accountId, input.group); }
  @Remote async listKeys(input: KeysRequest): Promise<AccountKeyPage> { return this.newApi.listKeys(input.accountId, input.page, input.pageSize); }
  @Remote async bindKey(input: BindKeyInput): Promise<{ provider: string; group: string }> { return this.newApi.bindKey(bindKeySchema.parse(input)); }
  @Remote async accountBalance(input: AccountRequest): Promise<BalanceView> { return this.newApi.accountBalance(input.accountId); }
  @Remote async keyBalance(input: KeyBalanceRequest): Promise<BalanceView> {
    const preference = this.ownConfig().preferences[input.provider];
    return this.newApi.keyBalance(input.provider, input.accountId ?? preference?.accountId ?? 'connection:' + input.provider);
  }
  @Remote async logout(input: AccountRequest): Promise<void> { return this.newApi.logout(input.accountId); }
  @Remote async clearCredential(input: ClearCredentialRequest): Promise<void> {
    const connection = (await this.domain.listConnections()).find(row => row.provider === input.provider);
    if (!connection?.credentialRef) throw new Error('这个连接没有独立绑定的聊天 key');
    await this.ctx.credentials.unset(credentialRef(connection.credentialRef));
  }
}
declare module '@deepseek-ai/cordis' { interface Context { rpConnections: RpConnections } }
