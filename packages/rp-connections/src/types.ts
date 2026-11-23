export interface Route {
  provider: string;
  model: string;
  connectionId?: string;
  label?: string;
  group?: string;
  /** Application/user budget, never a claim of measured relay capacity. */
  inputBudget: number;
  contextWindow?: number;
  outputLimit?: number;
  parameters?: { temperature?: boolean; stop?: boolean; reasoning?: boolean };
}
export interface CallControls {
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  stop?: string[];
}
export interface ResolvedCall extends CallControls { provider: string; model: string }

export interface AdapterView { provider: string; name: string; settingsNs: string; api?: string; baseURL?: string }
export interface ProviderRequest { provider: string }
export interface ModelRequest extends ProviderRequest { model: string }
export interface PreferenceRequest extends ProviderRequest { preference: ConnectionPreference }
export interface OverrideRequest extends ModelRequest { override: ModelOverride }
export interface RouteCallRequest { route: Route; controls: CallControls }
export interface AccountRequest { accountId: string }
export interface AccountModelsRequest extends AccountRequest { group: string }
export interface KeysRequest extends AccountRequest { page?: number; pageSize?: number }
export interface KeyBalanceRequest extends ProviderRequest { accountId?: string }
export interface ClearCredentialRequest extends ProviderRequest {}
export interface LoginInput { accountId: string; username: string; password: string }
export interface VerifyInput { accountId: string; code: string; method?: string }
export interface PatInput { accountId: string; token: string; userId?: number }
export interface BindKeyInput { accountId: string; keyId: number; provider: string; settingsNs?: string; api?: string; name?: string }

export type ModelPurpose = 'chat' | 'embedding' | 'image' | 'audio' | 'unknown';
export interface ModelCapabilities {
  purpose?: ModelPurpose;
  contextWindow?: number;
  outputLimit?: number;
  imageInput?: boolean;
  reasoning?: boolean;
  temperature?: boolean;
  stop?: boolean;
}
export interface ModelEntry {
  id: string;
  name: string;
  capabilities?: ModelCapabilities;
}
export interface CatalogMatch {
  id: string;
  match: 'exact' | 'confirmed' | 'candidate' | 'unknown';
  matchedId?: string;
  capabilities: ModelCapabilities;
  sources: Partial<Record<keyof ModelCapabilities, 'models.dev' | 'site' | 'manual'>>;
  candidates: ModelEntry[];
}
export interface ModelOverride extends ModelCapabilities { canonicalId?: string; alias?: string }
export interface ConnectionPreference {
  models?: ModelEntry[];
  selectedModel?: string;
  overrides?: Record<string, ModelOverride>;
  inputBudget?: number;
  group?: string;
  fallback?: Route[];
  /** Retry failed upstream generation before reply text; absent means enabled. */
  fallbackOnError?: boolean;
  /** Empty matches all failures; otherwise any text or /expression/flags must match. */
  errorPatterns?: string[];
  /** Historical field retained for older saved settings; new decisions use fallbackOnError. */
  fallbackOn400?: boolean;
  accountId?: string;
}
export interface AccountDefinition { id: string; siteURL: string; apiURL: string; name?: string }
export interface ConnectionsConfig {
  preferences: Record<string, ConnectionPreference>;
  accounts: Record<string, AccountDefinition>;
  catalog?: unknown;
}
export interface ConnectionView {
  id: string;
  provider: string;
  name: string;
  settingsNs?: string;
  baseURL?: string;
  api?: string;
  credentialRef?: string;
  credentialConfigured: boolean;
  active: boolean;
  error?: string;
  models: ModelEntry[];
  preference: ConnectionPreference;
}
export interface SaveConnectionInput {
  provider: string;
  name?: string;
  baseURL?: string;
  api?: string;
  /** New custom routes use an existing DSH adapter settings namespace. */
  settingsNs?: string;
  apiKey?: string;
  credentialRef?: string;
  models?: ModelEntry[];
}
export interface DiscoverModelsInput {
  provider?: string;
  settingsNs?: string;
  baseURL?: string;
  api?: string;
  apiKey?: string;
}
export interface FailureLike { code?: string; status?: number; statusCode?: number; message?: string; name?: string }
export interface Sponsor {
  id: string;
  name: string;
  description: string;
  logo: string;
  siteURL: string;
  apiURL?: string;
  promotionURL?: string;
  label: '社区共创伙伴';
}
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface SiteStatus {
  version?: string;
  passwordLogin?: boolean;
  ssoOnly?: boolean;
  quotaPerUnit?: number;
  displayType?: string;
  customSymbol?: string;
  usdExchangeRate?: number;
  customCurrencyExchangeRate?: number;
  raw: JsonValue;
}
export interface AccountUser {
  id: number;
  username: string;
  displayName?: string;
  group?: string;
  quota?: number;
  usedQuota?: number;
}
export interface LoginResult {
  state: 'authenticated' | 'verification';
  family: 'legacy' | 'modern';
  user?: AccountUser;
  methods?: Array<{ method: string; name?: string; available: boolean }>;
  expiresAt?: number;
}
export interface AccountView extends AccountDefinition {
  authenticated: boolean;
  family?: 'legacy' | 'modern' | 'pat';
  user?: AccountUser;
}
export interface AccountGroup { id: string; description: string; ratio?: number | string; models?: string[] }
export interface AccountKey {
  id: number;
  name: string;
  group: string;
  status?: number;
  remaining?: number;
  used?: number;
  unlimited: boolean;
  expiresAt?: number;
}
export interface AccountKeyPage { items: AccountKey[]; total: number; page: number; pageSize: number }
export interface BalanceView {
  kind: 'account' | 'key';
  remaining?: number;
  used?: number;
  total?: number;
  unlimited: boolean;
  /** Values remain in upstream quota units with the site's display conversion. */
  unit: { quotaPerUnit?: number; displayType?: string; symbol?: string; usdExchangeRate?: number; customCurrencyExchangeRate?: number };
}
