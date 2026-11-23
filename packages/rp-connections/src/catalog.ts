import snapshot from './catalog-snapshot.json' with { type: 'json' };
import type { CatalogMatch, ModelCapabilities, ModelEntry, ModelOverride } from './types.js';

export function object(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
export function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
export function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []; }
function bool(value: unknown): boolean | undefined { return typeof value === 'boolean' ? value : undefined; }
function compact<T extends object>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T; }

function capabilityFacts(value: unknown): ModelCapabilities {
  const row = object(value), limits = object(row.limit), modalities = object(row.modalities), capabilities = object(row.capabilities);
  const input = strings(modalities.input);
  const output = strings(modalities.output);
  const reasoning = object(capabilities.reasoning);
  let purpose: ModelCapabilities['purpose'];
  if (output.includes('text')) purpose = 'chat';
  else if (output.some(item => item.startsWith('image'))) purpose = 'image';
  else if (output.some(item => item.startsWith('audio'))) purpose = 'audio';
  return compact({
    purpose,
    contextWindow: positive(limits.context),
    outputLimit: positive(limits.output),
    imageInput: input.length ? input.some(item => item === 'image' || item.startsWith('image/')) : undefined,
    reasoning: bool(reasoning.supported) ?? bool(row.reasoning),
    temperature: bool(capabilities.temperature) ?? bool(row.temperature),
  });
}

/** Public catalog data only; no request ids or account data leave the Host. */
export class ModelCatalog {
  private entries = new Map<string, ModelEntry>();
  constructor(data: unknown = snapshot) { this.replace(data); }

  replace(data: unknown): void {
    const root = object(data);
    const entries = new Map<string, ModelEntry>();
    const providers = Object.values(object(root.providers ?? root));
    for (const provider of providers) {
      const models = object(object(provider).models);
      for (const [id, value] of Object.entries(models)) {
        if (!id || typeof value !== 'object' || value === null || Array.isArray(value)) continue;
        const row = object(value);
        // The map key is the served id even if an entry also names a canonical id.
        entries.set(id, { id, name: text(row.name) ?? id, capabilities: capabilityFacts(row) });
        const canonical = text(row.canonical_model_id);
        if (canonical && !entries.has(canonical)) entries.set(canonical, { id: canonical, name: text(row.name) ?? canonical, capabilities: capabilityFacts(row) });
      }
    }
    if (!entries.size) throw new TypeError('模型目录里没有可用资料');
    this.entries = entries;
  }

  match(id: string, confirmedId?: string, site: ModelCapabilities = {}, manual: ModelOverride = {}): CatalogMatch {
    const canonical = manual.canonicalId ?? confirmedId;
    const entry = this.entries.get(canonical ?? id);
    const normalized = id.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/^[^/]+\//, '');
    const candidates = entry ? [] : [...this.entries.values()].filter(item => {
      const known = item.id.toLowerCase();
      const bare = known.slice(known.lastIndexOf('/') + 1);
      return normalized === known || normalized === bare || normalized.endsWith('/' + known) || normalized.endsWith('/' + bare);
    });
    const result: CatalogMatch = { id, match: entry ? canonical ? 'confirmed' : 'exact' : candidates.length ? 'candidate' : 'unknown', matchedId: entry?.id, capabilities: {}, sources: {}, candidates };
    const sources = [['models.dev', entry?.capabilities ?? {}], ['site', site], ['manual', manual]] as const;
    const keys: Array<keyof ModelCapabilities> = ['purpose', 'contextWindow', 'outputLimit', 'imageInput', 'reasoning', 'temperature', 'stop'];
    for (const [source, facts] of sources) for (const key of keys) {
      const value = facts[key];
      if (value === undefined) continue;
      Object.assign(result.capabilities, { [key]: value });
      result.sources[key] = source;
    }
    return result;
  }

  async update(fetcher: typeof fetch = fetch, signal?: AbortSignal): Promise<void> {
    const response = await fetcher('https://models.dev/api.json', { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`模型目录更新失败（${response.status}）`);
    this.replace(await response.json() as unknown);
  }
}

export const CATALOG_SOURCE = { name: 'models.dev', url: 'https://models.dev', license: 'MIT', snapshotSource: 'https://github.com/anomalyco/models.dev/tree/dev/providers' } as const;
