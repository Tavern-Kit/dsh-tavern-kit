import type { LlmDiscoveredModel, LlmModelDiscoveryOperation } from '@deepseek-ai/dsh-llm';
import { discoverModels as discoverPiAiModels } from '@deepseek-ai/dsh-llm-pi-ai/src/discovery.ts';
import { catalogModels } from '@deepseek-ai/dsh-llm-pi-ai/src/catalog.ts';
export { recordKeyFor } from '@deepseek-ai/dsh-llm-pi-ai/src/auth.ts';

/**
 * Reuse DSH 0.2.2-rc.3's exported MIT model-list reader, keeping Host-owned
 * headers and the resolved shared credential. The catalogue supplies only a
 * missing wire protocol here: an explicit refresh always asks the endpoint.
 */
export async function discoverEndpointModels(
  request: LlmModelDiscoveryOperation,
  headers: Readonly<Record<string, string>> = {},
): Promise<readonly LlmDiscoveredModel[]> {
  const known = request.provider === undefined ? undefined : catalogModels(request.provider).values().next().value;
  const api = request.api ?? known?.api;
  return discoverPiAiModels({ ...request, provider: undefined, api }, () => ({ headers, resolveApiKey: async () => request.apiKey }));
}
