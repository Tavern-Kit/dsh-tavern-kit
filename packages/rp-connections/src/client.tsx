import type { Context } from '@deepseek-ai/cordis';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import contribution from '../lib/typert.remote-client.js';
import { ConnectionsPanel, type ConnectionsPanelApi } from './ConnectionsPanel.js';

export const PANEL_ID = 'tavern-kit-connections' as MainPanelId;
const NS = 'tavern-kit.connections';
export const inject = ['remote', 'slots', 'locale', 'layout'];

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'tavern-kit.connections': 'panel'; }
}

async function value<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** The pure panel and the RP chat view use the same Host operations. */
export function connectionPanelApi(ctx: Context): ConnectionsPanelApi {
  const remote = ctx.remote.rpConnections;
  return {
    listConnections: () => value(remote.listConnections()),
    listAdapters: () => value(remote.listAdapters()),
    saveConnection: input => value(remote.saveConnection(input)),
    discoverModels: input => value(remote.discoverModels(input)),
    setPreference: input => value(remote.setPreference(input)),
    setModelOverride: input => value(remote.setModelOverride(input)),
    capabilities: input => value(remote.capabilities(input)),
    resolveRoute: route => value(remote.resolveRoute(route)),
    updateCatalog: () => value(remote.updateCatalog()),
    listSponsors: () => value(remote.listSponsors()),
    listAccounts: () => value(remote.listAccounts()),
    saveAccount: input => value(remote.saveAccount(input)),
    status: input => value(remote.status(input)),
    login: input => value(remote.login(input)),
    verify: input => value(remote.verify(input)),
    loginPat: input => value(remote.loginPat(input)),
    self: input => value(remote.self(input)),
    groups: input => value(remote.groups(input)),
    models: input => value(remote.models(input)),
    listKeys: input => value(remote.listKeys(input)),
    bindKey: input => value(remote.bindKey(input)),
    accountBalance: input => value(remote.accountBalance(input)),
    keyBalance: input => value(remote.keyBalance(input)),
    logout: input => value(remote.logout(input)),
    clearCredential: input => value(remote.clearCredential(input)),
  };
}

function ConnectionIcon({ size }: PropsRuntime<'sidebar.panellist'>) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 7V3m8 4V3M6 7h12v4a6 6 0 0 1-5 5.92V21h-2v-4.08A6 6 0 0 1 6 11V7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

export async function apply(ctx: Context): Promise<void> {
  await ctx.remote.$mount(contribution);
  ctx.effect(() => ctx.locale.register(NS, { zh: { panel: '连接模型' }, en: { panel: 'Model connections' } }), 'tavern-kit-connections: locale');
  ctx.inject(['remote.rpConnections'], scope => {
    const t = scope.locale.bind(NS);
    const api = connectionPanelApi(scope);
    scope.effect(() => scope.slots.inject('main', () => scope.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ api, className: 'tk-connections-main' }) }, ConnectionsPanel)), 'tavern-kit-connections: panel');
    scope.effect(() => scope.slots.inject('sidebar.panellist', () => scope.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 21, locale: NS, label: () => t('panel') }, ConnectionIcon)), 'tavern-kit-connections: navigation');
  });
}
