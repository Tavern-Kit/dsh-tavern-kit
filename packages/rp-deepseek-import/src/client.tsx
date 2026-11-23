import type { Context } from '@deepseek-ai/cordis';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@tavern-kit/rp-chat/client';
import contribution from '../lib/typert.remote-client.js';
import { ImportPanel } from './ImportPanel.js';
import type { PreviewTicket } from './types.js';

export const inject = ['remote', 'slots', 'locale', 'layout', 'rpChatUi'];
export const PANEL_ID = 'tavern-kit-import' as MainPanelId;
const NS = 'tavern-kit.import';
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { 'tavern-kit.import': 'panel'; } }
interface PageCarrier { __DSH_TRANSPORT__?: { fetch?: (input: string, init: RequestInit) => Promise<Response> }; }
async function value<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call; if (!result.ok) throw new Error(result.error.message); return result.value;
}
async function upload(file: File): Promise<PreviewTicket> {
  const carrier = (globalThis as PageCarrier).__DSH_TRANSPORT__?.fetch;
  const url = new URL(`/api/tavern-kit/deepseek/preview?${new URLSearchParams({ name: file.name })}`, document.baseURI);
  const response = await (carrier ?? fetch)(url.href, { method: 'POST', body: file, headers: { 'content-type': 'application/octet-stream' } });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as PreviewTicket;
}
function Icon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function registerUi(ctx: Context): void {
  ctx.locale.register(NS, { zh: { panel: '接回旧对话' }, en: { panel: 'Bring a conversation' } });
  const t = ctx.locale.bind(NS), remote = ctx.remote.rpDeepseekImport;
  const api = { import: (input: Parameters<typeof remote.import>[0]) => value(remote.import(input)), discard: (id: string) => value(remote.discard(id)) };
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ upload, api, onOpen: (id: string) => ctx.rpChatUi.open(id) }) }, ImportPanel));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 23, locale: NS, label: () => t('panel') }, Icon));
}
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(contribution);
  const ui = ctx.inject(['remote.rpDeepseekImport', 'slots', 'locale', 'layout', 'rpChatUi'], registerUi);
  ctx.effect(() => async () => { await ui.dispose(); await unmount(); }, 'tavern-kit-import: client');
}
