import type { Context } from '@deepseek-ai/cordis';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import contribution from '../lib/typert.remote-client.js';
import { MaterialsPanel, type MaterialsPanelApi } from './MaterialsPanel.js';
import type { FileResult } from './host.js';

export const inject = ['remote', 'slots', 'locale', 'layout'];
export const PANEL_ID = 'tavern-kit-materials' as MainPanelId;
const NS = 'tavern-kit.materials';
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'tavern-kit.materials': 'panel'; }
}
interface PageCarrier { __DSH_TRANSPORT__?: { fetch?: (input: string, init: RequestInit) => Promise<Response> }; }
async function value<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
export function materialPanelApi(ctx: Context): MaterialsPanelApi {
  const remote = ctx.remote.rpMaterials;
  return {
    location: () => value(remote.location()), createPersona: draft => value(remote.createPersona(draft)), revisePersona: (id, draft) => value(remote.revisePersona(id, draft)), list: query => value(remote.list(query)), get: id => value(remote.get(id)),
    readVersion: ref => value(remote.readVersion(ref)), versions: id => value(remote.versions(id)),
    revise: (id, revision) => value(remote.revise(id, revision)), metadata: (id, patch) => value(remote.metadata(id, patch)),
    copy: id => value(remote.copy(id)), delete: id => value(remote.delete(id)),
    exportOriginal: id => value(remote.exportOriginal(id)), exportCurrent: id => value(remote.exportCurrent(id)),
    resources: ref => value(remote.resources(ref)),
  };
}
async function upload(files: File[]): Promise<void> {
  for (const file of files) {
    const url = new URL(`/api/tavern-kit/materials/upload?${new URLSearchParams({ name: file.name })}`, document.baseURI);
    const carrier = (globalThis as PageCarrier).__DSH_TRANSPORT__?.fetch;
    const response = await (carrier ?? fetch)(url.href, { method: 'POST', body: file, headers: { 'content-type': 'application/octet-stream' } });
    if (!response.ok) throw new Error(await response.text());
  }
}
function download(file: FileResult): void {
  const bytes = Uint8Array.from(atob(file.base64), character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mediaType }));
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function Icon({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 4h12a2 2 0 0 1 2 2v15l-7-3-7 3V4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 8h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function registerUi(ctx: Context): void {
  ctx.locale.register(NS, { zh: { panel: '素材库' }, en: { panel: 'Materials' } });
  const t = ctx.locale.bind(NS), api = materialPanelApi(ctx);
  ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ api, onUpload: upload, onDownload: download }) }, MaterialsPanel));
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 22, locale: NS, label: () => t('panel') }, Icon));
}
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(contribution);
  const ui = ctx.inject(['remote.rpMaterials', 'slots', 'locale', 'layout'], registerUi);
  ctx.effect(() => async () => { await ui.dispose(); await unmount(); }, 'tavern-kit-materials: client');
}
