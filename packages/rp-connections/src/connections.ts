import { ModelCatalog, object, positive, text } from './catalog.js';
import { preferenceSchema } from './schemas.js';
import { isFallbackFailure, resolveCall } from './routing.js';
import type { CallControls, CatalogMatch, ConnectionPreference, ConnectionView, DiscoverModelsInput, FailureLike, ModelCapabilities, ModelEntry, ModelOverride, ResolvedCall, Route, SaveConnectionInput } from './types.js';

export interface SettingsForm { ns: string; revision: number; value: Record<string, unknown> }
export type SettingsMutation = { op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] };
export interface ConnectionPorts {
  settings: {
    describe(): SettingsForm[];
    mutate(ns: string, operations: readonly SettingsMutation[], expectedRevision?: number): Promise<void>;
  };
  credentials: {
    resolve(ref: string): Promise<{ value?: string } | undefined>;
    describe(ref: string): Promise<{ configured?: boolean; available?: boolean }>;
    resolveProviderKey?(provider: string): Promise<string | undefined>;
    describeProvider?(provider: string): Promise<{ configured: boolean }>;
    set(ref: string, value: string): Promise<void>;
  };
  llm: {
    listProviders(): Array<{ id: string; name: string }>;
    listConfigurableProviders(): Array<{ provider: string; displayName: string; settingsNs: string; settingsPath: readonly string[]; declared?: boolean; defaultBaseURL?: string; nativeAuth?: { env?: readonly string[] }; error?: string }>;
    discoverEndpointModels?(request: { provider?: string; baseURL?: string; api?: string; apiKey?: string }, headers: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<readonly { id: string; name?: string; contextWindow?: number; maxTokens?: number; inputModalities?: readonly string[] }[]>;
    listModels(provider: string): Array<{ id: string; name: string; inputModalities?: readonly string[] }> | Promise<Array<{ id: string; name: string; inputModalities?: readonly string[] }>>;
    resolveModelInfo?(provider: string, model: string): Promise<{ reasoning?: { efforts: readonly { id: string }[] } }>;
    discoverModels(ns: string, request: { provider?: string; baseURL?: string; api?: string; apiKey?: string }, signal?: AbortSignal): Promise<readonly { id: string; name?: string; contextWindow?: number; maxTokens?: number; inputModalities?: readonly string[] }[]>;
  };
}
function at(root: unknown, path: readonly string[]): Record<string, unknown> { for (const key of path) root = object(root)[key]; return object(root); }
function requireId(value: string): void { if (!value || value.trim() !== value || value.length > 512) throw new TypeError('连接或模型名称不能为空'); }
function endpoint(value: string): string {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new TypeError('请填写有效的 API 地址');
  return value.replace(/\/+$/, '');
}
function modelProfiles(value: unknown): Array<Record<string, unknown> & { id: string }> {
  return Array.isArray(value) ? value.map(object).filter((row): row is Record<string, unknown> & { id: string } => typeof row.id === 'string' && row.id.length > 0) : [];
}
function mergedModels(...lists: readonly ModelEntry[][]): ModelEntry[] {
  const entries = new Map<string, ModelEntry>();
  for (const list of lists) for (const entry of list) { requireId(entry.id); entries.set(entry.id, { ...entries.get(entry.id), ...entry }); }
  return [...entries.values()];
}

/** Same public settings/provider/credential services used by the DSH provider screen. */
export class ConnectionsService {
  constructor(readonly ports: ConnectionPorts, readonly settingsNs: string = 'tavern-kit-rp-connections') {}
  private form(ns: string): SettingsForm {
    const result = this.ports.settings.describe().find(form => form.ns === ns);
    if (!result) throw new Error('这个连接的设置入口尚未就绪');
    return result;
  }
  private configurable(provider: string) {
    return this.ports.llm.listConfigurableProviders().find(item => item.provider === provider);
  }
  private profile(provider: string): Record<string, unknown> {
    const route = this.configurable(provider);
    return route ? at(this.form(route.settingsNs).value, route.settingsPath) : {};
  }
  private preference(provider: string): ConnectionPreference {
    return preferenceSchema.parse(object(object(this.form(this.settingsNs).value.preferences)[provider]));
  }
  endpoint(provider: string): { baseURL?: string; api?: string } {
    const profile = this.profile(provider);
    return { baseURL: text(profile.baseURL) ?? this.configurable(provider)?.defaultBaseURL, api: text(profile.api) };
  }
  /** Host-only resolution through the same DSH credential reference or provider record. */
  async resolveCredential(provider: string): Promise<string | undefined> {
    const descriptor = this.configurable(provider);
    const explicitRef = text(this.profile(provider).apiKeyEnv);
    if (explicitRef) return (await this.ports.credentials.resolve(explicitRef))?.value;
    if (descriptor?.declared !== undefined) {
      const key = await this.ports.credentials.resolveProviderKey?.(provider);
      if (key !== undefined) return key;
    }
    for (const ref of descriptor?.nativeAuth?.env ?? []) {
      const key = (await this.ports.credentials.resolve(ref))?.value;
      if (key !== undefined) return key;
    }
    return undefined;
  }
  private catalog(): ModelCatalog {
    const saved = this.form(this.settingsNs).value.catalog;
    return saved === undefined ? new ModelCatalog() : new ModelCatalog(saved);
  }
  async listConnections(): Promise<ConnectionView[]> {
    const directory = new Map(this.ports.llm.listConfigurableProviders().map(row => [row.provider, row]));
    for (const active of this.ports.llm.listProviders()) if (!directory.has(active.id)) directory.set(active.id, { provider: active.id, displayName: active.name, settingsNs: '', settingsPath: [] });
    const active = new Set(this.ports.llm.listProviders().map(row => row.id));
    return Promise.all([...directory.values()].map(async descriptor => {
      const profile = descriptor.settingsNs ? this.profile(descriptor.provider) : {};
      const explicitRef = text(profile.apiKeyEnv);
      const record = !explicitRef && descriptor.declared !== undefined ? await this.ports.credentials.describeProvider?.(descriptor.provider) : undefined;
      const ref = explicitRef ?? (record?.configured ? undefined : descriptor.nativeAuth?.env?.[0]);
      const info = record?.configured ? record : ref ? await this.ports.credentials.describe(ref) : undefined;
      const preference = this.preference(descriptor.provider);
      const configuredModels = modelProfiles(profile.models).map(row => ({ id: row.id, name: text(row.name) ?? row.id }));
      const advertised = active.has(descriptor.provider) ? await this.ports.llm.listModels(descriptor.provider) : [];
      const models = mergedModels(advertised, configuredModels, preference.models ?? []).map(row => ({ ...row, name: preference.overrides?.[row.id]?.alias ?? row.name }));
      return { id: descriptor.provider, provider: descriptor.provider, name: text(profile.displayName) ?? descriptor.displayName, settingsNs: descriptor.settingsNs || undefined, baseURL: text(profile.baseURL) ?? descriptor.defaultBaseURL, api: text(profile.api), credentialRef: ref, credentialConfigured: info?.configured ?? info?.available ?? false, active: active.has(descriptor.provider), error: descriptor.error, models, preference };
    }));
  }
  async saveConnection(input: SaveConnectionInput): Promise<ConnectionView> {
    requireId(input.provider);
    const known = this.configurable(input.provider);
    if (!known && this.ports.llm.listProviders().some(row => row.id === input.provider)) throw new Error('这个 provider 已由另一个适配器注册，请沿用原连接');
    const adapter = known ?? (input.settingsNs ? { provider: input.provider, settingsNs: input.settingsNs, settingsPath: ['providers', input.provider] } : undefined);
    if (!adapter) throw new Error('请先选择已注册的协议适配器');
    const form = this.form(adapter.settingsNs);
    const old = at(form.value, adapter.settingsPath);
    const operations: SettingsMutation[] = [];
    const set = (key: string, value: unknown) => operations.push({ op: 'set', path: [...adapter.settingsPath, key], value });
    if (input.name !== undefined) set('displayName', input.name);
    if (input.baseURL !== undefined) set('baseURL', endpoint(input.baseURL));
    if (input.api !== undefined) set('api', input.api);
    if (input.models !== undefined) {
      // Keep unknown per-model adapter options and all manually entered raw ids.
      const configured = modelProfiles(old.models);
      const advertised = !configured.length && known && this.ports.llm.listProviders().some(provider => provider.id === input.provider) ? await this.ports.llm.listModels(input.provider) : [];
      const models = new Map<string, Record<string, unknown>>((configured.length ? configured : advertised).map(model => [model.id, { ...model, ...object(object(old.modelOverrides)[model.id]) }]));
      for (const model of input.models) { requireId(model.id); const previous = models.get(model.id); models.set(model.id, { ...previous, id: model.id, name: previous?.name ?? model.name, ...(model.capabilities?.contextWindow ? { contextWindow: model.capabilities.contextWindow } : {}), ...(model.capabilities?.outputLimit ? { maxTokens: model.capabilities.outputLimit } : {}) }); }
      if (models.size) {
        if (old.modelOverrides !== undefined) operations.push({ op: 'unset', path: [...adapter.settingsPath, 'modelOverrides'] });
        set('models', [...models.values()]);
      }
    }
    let ref = input.credentialRef ?? text(old.apiKeyEnv);
    if (input.apiKey !== undefined) {
      if (!input.apiKey.trim()) throw new TypeError('key 不能为空');
      ref ??= known?.nativeAuth?.env?.[0] ?? 'TAVERN_KIT_' + Buffer.from(input.provider).toString('hex').toUpperCase() + '_API_KEY';
      await this.ports.credentials.set(ref, input.apiKey);
    }
    if (ref !== undefined) { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ref)) throw new TypeError('凭据引用名称无效'); set('apiKeyEnv', ref); }
    if (operations.length) await this.ports.settings.mutate(adapter.settingsNs, operations, form.revision);
    const listed = (await this.listConnections()).find(item => item.provider === input.provider);
    return listed ?? { id: input.provider, provider: input.provider, name: input.name ?? input.provider, settingsNs: adapter.settingsNs, baseURL: input.baseURL, api: input.api, credentialRef: ref, credentialConfigured: ref ? (await this.ports.credentials.describe(ref)).configured ?? false : false, active: false, models: input.models ?? [], preference: this.preference(input.provider) };
  }
  async setPreference(provider: string, update: ConnectionPreference): Promise<ConnectionPreference> {
    requireId(provider);
    const form = this.form(this.settingsNs);
    const value = preferenceSchema.parse({ ...this.preference(provider), ...update });
    if (update.selectedModel) {
      const models = modelProfiles(this.profile(provider).models);
      const listed = models.length ? models : this.ports.llm.listProviders().some(item => item.id === provider) ? await this.ports.llm.listModels(provider) : [];
      if (!listed.some(model => model.id === update.selectedModel)) await this.saveConnection({ provider, models: [{ id: update.selectedModel, name: update.selectedModel }] });
    }
    await this.ports.settings.mutate(this.settingsNs, [{ op: 'set', path: ['preferences', provider], value }], form.revision);
    return value;
  }
  async setModelOverride(provider: string, model: string, override: ModelOverride): Promise<CatalogMatch> {
    requireId(model);
    const preference = this.preference(provider);
    await this.setPreference(provider, { overrides: { ...preference.overrides, [model]: { ...preference.overrides?.[model], ...override } } });
    const adapter = this.configurable(provider);
    if (adapter) {
      const form = this.form(adapter.settingsNs);
      const profile = at(form.value, adapter.settingsPath);
      const fields: Record<string, unknown> = {};
      if (override.alias !== undefined) fields.name = override.alias;
      if (override.contextWindow !== undefined) fields.contextWindow = override.contextWindow;
      if (override.outputLimit !== undefined) fields.maxTokens = override.outputLimit;
      if (override.imageInput !== undefined) fields.input = override.imageInput ? ['text', 'image'] : ['text'];
      if (override.reasoning === false) fields.reasoningEfforts = false;
      if (override.temperature !== undefined) fields.compat = { supportsTemperature: override.temperature };
      if (Object.keys(fields).length) {
        const profiles = modelProfiles(profile.models);
        if (profiles.length) {
          const index = profiles.findIndex(row => row.id === model);
          const prior = index < 0 ? { id: model } : profiles[index]!;
          const next = { ...prior, ...fields, ...(fields.compat ? { compat: { ...object(prior.compat), ...object(fields.compat) } } : {}) };
          if (index < 0) profiles.push(next); else profiles[index] = next;
          await this.ports.settings.mutate(adapter.settingsNs, [{ op: 'set', path: [...adapter.settingsPath, 'models'], value: profiles }], form.revision);
        } else {
          const prior = object(object(profile.modelOverrides)[model]);
          const next = { ...prior, ...fields, ...(fields.compat ? { compat: { ...object(prior.compat), ...object(fields.compat) } } : {}) };
          await this.ports.settings.mutate(adapter.settingsNs, [{ op: 'set', path: [...adapter.settingsPath, 'modelOverrides', model], value: next }], form.revision);
        }
      }
    }
    return this.capabilities(provider, model);
  }
  capabilities(provider: string, model: string): CatalogMatch {
    const preference = this.preference(provider);
    const listed = preference.models?.find(item => item.id === model);
    return this.catalog().match(model, undefined, listed?.capabilities, preference.overrides?.[model]);
  }
  async discoverModels(input: DiscoverModelsInput, signal?: AbortSignal): Promise<ModelEntry[]> {
    const descriptor = input.provider ? this.configurable(input.provider) : undefined;
    const ns = descriptor?.settingsNs ?? input.settingsNs;
    if (!ns) throw new Error('请先选择连接的协议适配器');
    const profile = input.provider ? this.profile(input.provider) : {};
    const apiKey = input.apiKey ?? (input.provider ? await this.resolveCredential(input.provider) : undefined);
    const baseURL = input.baseURL ?? text(profile.baseURL) ?? descriptor?.defaultBaseURL;
    const api = input.api ?? text(profile.api);
    const request = { provider: input.provider, baseURL, api, apiKey };
    const headers = Object.fromEntries(Object.entries(object(profile.headers)).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    const result = descriptor?.declared !== undefined && this.ports.llm.discoverEndpointModels
      ? await this.ports.llm.discoverEndpointModels(request, headers, signal)
      : await this.ports.llm.discoverModels(ns, request, signal);
    const incoming: ModelEntry[] = result.map(row => ({ id: row.id, name: row.name ?? row.id, capabilities: { ...(row.contextWindow ? { contextWindow: row.contextWindow } : {}), ...(row.maxTokens ? { outputLimit: row.maxTokens } : {}), ...(row.inputModalities ? { imageInput: row.inputModalities.includes('image') } : {}) } }));
    if (!input.provider) return incoming;
    const old = (await this.listConnections()).find(row => row.provider === input.provider);
    const models = mergedModels(old?.models ?? [], incoming);
    await this.setPreference(input.provider, { models });
    // Custom adapters require each model in their settings; named catalog routes keep modelOverrides.
    if (descriptor && modelProfiles(profile.models).length) await this.saveConnection({ provider: input.provider, models });
    return models;
  }
  async resolveRoute(route: Route): Promise<Route> {
    requireId(route.provider); requireId(route.model);
    const preference = this.preference(route.provider);
    const capabilities = this.capabilities(route.provider, route.model);
    // Catalog facts are suggestions until the player confirms capacity; adapter fallback windows are never site measurements.
    const confirmed = preference.overrides?.[route.model];
    const site = preference.models?.find(item => item.id === route.model)?.capabilities;
    const profile = this.profile(route.provider);
    const ownModel: Record<string, unknown> = modelProfiles(profile.models).find(model => model.id === route.model) ?? object(object(profile.modelOverrides)[route.model]);
    const contextWindow = route.contextWindow ?? confirmed?.contextWindow ?? positive(ownModel.contextWindow) ?? site?.contextWindow;
    const outputLimit = route.outputLimit ?? confirmed?.outputLimit ?? positive(ownModel.maxTokens) ?? site?.outputLimit ?? 4096;
    const inputBudget = positive(route.inputBudget) ?? positive(preference.inputBudget) ?? 24000;
    if (capabilities.capabilities.purpose && capabilities.capabilities.purpose !== 'chat' && capabilities.capabilities.purpose !== 'unknown') throw new Error('这个模型的用途不是聊天，请另选一个模型');
    const compat = { ...object(profile.compat), ...object(ownModel.compat) };
    const resolved = await this.ports.llm.resolveModelInfo?.(route.provider, route.model);
    const supportsReasoning = ownModel.reasoningEfforts !== false && (resolved?.reasoning?.efforts.length !== undefined ? resolved.reasoning.efforts.length > 0 : Object.keys(object(ownModel.reasoningEfforts)).length > 0);
    const isPiAi = text(profile.api) !== undefined;
    return { ...route, connectionId: route.connectionId ?? route.provider, group: route.group ?? preference.group, contextWindow, outputLimit, inputBudget: contextWindow ? Math.min(inputBudget, Math.max(1, contextWindow - outputLimit)) : inputBudget, parameters: { temperature: compat.supportsTemperature !== false && capabilities.capabilities.temperature !== false && route.parameters?.temperature !== false, reasoning: supportsReasoning && confirmed?.reasoning !== false && route.parameters?.reasoning !== false, stop: !isPiAi && capabilities.capabilities.stop === true && route.parameters?.stop !== false } };
  }
  resolveCall(route: Route, controls: CallControls): ResolvedCall { return resolveCall(route, controls); }
  getFallback(route: Route): Route[] { return this.preference(route.provider).fallback ?? []; }
  fallbackOnError(route: Route): boolean { return this.preference(route.provider).fallbackOnError ?? true; }
  errorPatterns(route: Route): string[] { return this.preference(route.provider).errorPatterns ?? []; }
  fallbackOn400(route: Route): boolean { return this.preference(route.provider).fallbackOn400 ?? true; }
  isFallbackFailure(failure: FailureLike | undefined, fallbackOnError: boolean = true, errorPatterns: readonly string[] = []): boolean { return isFallbackFailure(failure, fallbackOnError, errorPatterns); }
  async updateCatalog(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<void> {
    const response = await fetcher('https://models.dev/api.json', { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`模型目录更新失败（${response.status}）`);
    const catalog: unknown = await response.json();
    new ModelCatalog(catalog); // Validate before replacing the usable snapshot.
    const form = this.form(this.settingsNs);
    await this.ports.settings.mutate(this.settingsNs, [{ op: 'set', path: ['catalog'], value: catalog }], form.revision);
  }
}
