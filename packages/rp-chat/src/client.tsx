import React, { useSyncExternalStore } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { RemoteResult, RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-connection/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@tavern-kit/rp-materials/client';
import type {} from '@tavern-kit/rp-connections/client';
import type {} from '@tavern-kit/rp-appearance/client';
import type { Route } from '@tavern-kit/rp-connections/types';
import contribution from '../lib/typert.remote-client.js';
import type { ChatPanelApi, Destination } from './ChatPanel.js';
import type { ChatChange } from './protocol.js';
import { CHAT_STYLES } from './styles.js';

export const inject = ['remote', 'slots', 'locale', 'layout'];
export const PANEL_ID = 'tavern-kit-chat' as MainPanelId;
const NS = 'tavern-kit.chat';
// Markdown's browser decoder uses the DOM, so initialize the reading surface only when its slot renders.
const ChatPanel = React.lazy(async () => ({ default: (await import('./ChatPanel.js')).ChatPanel }));

export interface RpChatUi { open(id?: string): void }
export interface ChatClientApi extends ChatPanelApi {
  fallbackOnError(route: Route): Promise<boolean>;
  errorPatterns(route: Route): Promise<string[]>;
}
declare module '@deepseek-ai/cordis' { interface Context { rpChatUi: RpChatUi } }
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'tavern-kit.chat': 'panel' | 'loading' | 'invalidRestore' | 'backupFailed' }
}

interface NavigationSnapshot { conversationId: string | undefined; reconnectVersion: number; appearanceAvailable: boolean; renderScene?: (area: 'home' | 'chat') => React.ReactNode }
/** Only page selection lives here; all conversation and generation state stays on the Host. */
class ChatNavigation {
  private snapshot: NavigationSnapshot = { conversationId: undefined, reconnectVersion: 0, appearanceAvailable: false };
  private readonly listeners = new Set<() => void>();
  readonly getSnapshot = (): NavigationSnapshot => this.snapshot;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  readonly select = (conversationId: string | undefined): void => {
    if (this.snapshot.conversationId === conversationId) return;
    this.snapshot = { ...this.snapshot, conversationId };
    for (const listener of this.listeners) listener();
  };
  readonly reconnect = (): void => {
    this.snapshot = { ...this.snapshot, reconnectVersion: this.snapshot.reconnectVersion + 1 };
    for (const listener of this.listeners) listener();
  };
  readonly setAppearanceAvailable = (appearanceAvailable: boolean, renderScene?: NavigationSnapshot['renderScene']): void => {
    if (this.snapshot.appearanceAvailable === appearanceAvailable && this.snapshot.renderScene === renderScene) return;
    this.snapshot = { ...this.snapshot, appearanceAvailable, renderScene };
    for (const listener of this.listeners) listener();
  };
  dispose(): void { this.listeners.clear(); }
}

async function value<T>(call: Promise<RemoteResult<T>>): Promise<T> {
  const result = await call;
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** The panel calls the same public Host operations used by the ordinary assistant tools. */
export function chatPanelApi(ctx: Context, subscriptions: Set<() => void> = new Set()): ChatClientApi {
  const remote = ctx.remote.rpChat;
  return {
    list: () => value(remote.list()),
    create: input => value(remote.create(input)),
    update: (id, input) => value(remote.update(id, input)),
    state: id => value(remote.state(id)),
    route: input => value(remote.route(input)),
    candidates: input => value(remote.candidates(input)),
    previewCandidate: id => value(remote.previewCandidate(id)),
    candidate: id => value(remote.candidate(id)),
    usage: id => value(remote.usage(id)),
    send: input => value(remote.send(input)),
    roll: id => value(remote.roll(id)),
    editInput: (id, input) => value(remote.editInput(id, input)),
    editCandidate: (id, text) => value(remote.editCandidate(id, text)),
    continueCandidate: id => value(remote.continueCandidate(id)),
    select: id => value(remote.select(id)),
    favorite: (id, favorite) => value(remote.favorite(id, favorite)),
    stopCandidate: id => value(remote.stopCandidate(id)),
    stopGroup: id => value(remote.stopGroup(id)),
    memos: id => value(remote.memos(id)),
    editMemo: (id, content, locked) => value(remote.editMemo(id, content, locked)),
    graph: id => value(remote.graph(id)),
    search: input => value(remote.search(input)),
    searchPreview: hit => value(remote.searchPreview(hit)),
    initializeVariables: id => value(remote.initializeVariables(id)),
    setVariables: (id,state) => value(remote.setVariables(id,state)),
    watch(id, listener, onError) {
      const controller = new AbortController();
      let stream: RemoteStreamHandle<ChatChange, never> | undefined;
      let disposed = false;
      const dispose = (): void => {
        if (disposed) return;
        disposed = true;
        controller.abort();
        // This cancels only the Host watch iterator, never a candidate's generation.
        stream?.dispose();
        subscriptions.delete(dispose);
      };
      subscriptions.add(dispose);
      void (async () => {
        try {
          const handle = remote.watch(id, controller.signal);
          stream = handle;
          for await (const change of handle) { if (!disposed) listener(change); }
        } catch (error) { if (!disposed) onError?.(error); }
        finally { dispose(); }
      })();
      return dispose;
    },
    listMaterials: () => value(ctx.remote.rpMaterials.list({})),
    materialVersion: ref => value(ctx.remote.rpMaterials.readVersion(ref)),
    resources: ref => value(ctx.remote.rpMaterials.resources(ref)),
    listConnections: () => value(ctx.remote.rpConnections.listConnections()),
    resolveRoute: route => value(ctx.remote.rpConnections.resolveRoute(route)),
    defaultFallback: route => value(ctx.remote.rpConnections.getFallback(route)),
    fallbackOn400: route => value(ctx.remote.rpConnections.fallbackOn400(route)),
    fallbackOnError: route => value(ctx.remote.rpConnections.fallbackOnError(route)),
    errorPatterns: route => value(ctx.remote.rpConnections.errorPatterns(route)),
  };
}

interface PageCarrier { __DSH_TRANSPORT__?: { fetch?: (input: string, init: RequestInit) => Promise<Response> } }
async function hostFetch(url: URL, init: RequestInit): Promise<Response> {
  const carrier = (globalThis as PageCarrier).__DSH_TRANSPORT__;
  const response = carrier?.fetch ? await carrier.fetch(url.href, init) : await fetch(url, init);
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const result: unknown = JSON.parse(text);
      if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') message = result.error;
    } catch { /* Plain-text Host errors remain readable. */ }
    throw new Error(message || `HTTP ${response.status}`);
  }
  return response;
}

interface ChatViewProps {
  api: ChatPanelApi;
  navigation: ChatNavigation;
  loadingLabel: string;
  onNavigate(destination: Destination): void;
  onExport(id: string): Promise<void>;
  onRestore(file: File): Promise<string>;
}
function ChatView({ api, navigation, loadingLabel, onNavigate, onExport, onRestore }: ChatViewProps): React.ReactElement {
  const snapshot = useSyncExternalStore(navigation.subscribe, navigation.getSnapshot, navigation.getSnapshot);
  return <React.Suspense fallback={<div className="tk-rp tk-chat-loading" role="status">{loadingLabel}</div>}>
    <ChatPanel api={api} initialConversationId={snapshot.conversationId} reconnectVersion={snapshot.reconnectVersion}
      appearanceAvailable={snapshot.appearanceAvailable} renderScene={snapshot.renderScene} onOpened={navigation.select} onNavigate={onNavigate} onExport={onExport} onRestore={onRestore} />
  </React.Suspense>;
}
function ChatIcon({ size }: PropsRuntime<'sidebar.panellist'>): React.ReactElement {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}

function registerUi(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, {
    zh: { panel: '继续聊天', loading: '正在翻开对话…', invalidRestore: '这份备份没有返回可打开的对话', backupFailed: '这次没能导出对话' },
    en: { panel: 'Continue chatting', loading: 'Opening your conversations…', invalidRestore: 'The backup did not return a conversation to open', backupFailed: 'The conversation could not be exported' },
  }));
  const t = ctx.locale.bind(NS), navigation = new ChatNavigation(), subscriptions = new Set<() => void>();
  const api = chatPanelApi(ctx, subscriptions);
  const lifetime = new AbortController(), objectUrls = new Set<string>(), timers = new Set<ReturnType<typeof setTimeout>>();
  ctx.effect(() => {
    const style = document.createElement('style');
    style.dataset.tavernKitChat = '';
    style.textContent = CHAT_STYLES;
    document.head.append(style);
    return () => { style.remove(); };
  });
  ctx.effect(() => () => {
    lifetime.abort();
    for (const dispose of [...subscriptions]) dispose();
    for (const timer of timers) clearTimeout(timer);
    for (const url of objectUrls) URL.revokeObjectURL(url);
    timers.clear(); objectUrls.clear(); navigation.dispose();
  });
  let openAppearance: (() => void) | undefined;
  ctx.inject(['rpAppearanceUi'], scope => {
    const open = (): void => { scope.rpAppearanceUi.open(); };
    openAppearance = open;
    navigation.setAppearanceAvailable(true, area => scope.rpAppearanceUi.renderScene(area));
    scope.effect(() => () => { if (openAppearance === open) { openAppearance = undefined; navigation.setAppearanceAvailable(false); } });
  });
  const onNavigate = (destination: Destination): void => {
    if (destination === 'appearance') { openAppearance?.(); return; }
    const panels = { materials: 'tavern-kit-materials', import: 'tavern-kit-import', connections: 'tavern-kit-connections' };
    ctx.layout.selectPanel(panels[destination] as MainPanelId);
  };
  const onExport = async (id: string): Promise<void> => {
    const url = new URL(`/api/tavern-kit/chat/backup?${new URLSearchParams({ id })}`, document.baseURI);
    const response = await hostFetch(url, { method: 'GET', signal: lifetime.signal });
    const blob = await response.blob();
    if (lifetime.signal.aborted) return;
    let name = '对话备份.zip';
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(response.headers.get('content-disposition') ?? '')?.[1];
    if (encoded) { try { name = decodeURIComponent(encoded); } catch { throw new Error(t('backupFailed')); } }
    const objectUrl = URL.createObjectURL(blob); objectUrls.add(objectUrl);
    const link = document.createElement('a'); link.href = objectUrl; link.download = name; link.click();
    const timer = setTimeout(() => { URL.revokeObjectURL(objectUrl); objectUrls.delete(objectUrl); timers.delete(timer); }, 0);
    timers.add(timer);
  };
  const onRestore = async (file: File): Promise<string> => {
    const url = new URL('/api/tavern-kit/chat/backup', document.baseURI);
    const response = await hostFetch(url, { method: 'POST', body: file, headers: { 'content-type': 'application/zip' }, signal: lifetime.signal });
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id) throw new Error(t('invalidRestore'));
    return result.id;
  };
  ctx.effect(() => ctx.on('connection/reset', navigation.reconnect));
  ctx.provide('rpChatUi', { open(id?: string) { navigation.select(id); ctx.layout.selectPanel(PANEL_ID); } });
  ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS,
    inject: () => ({ api, navigation, onNavigate, onExport, onRestore, loadingLabel: t('loading') }) }, ChatView)));
  ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID,
    order: 20, locale: NS, label: () => t('panel') }, ChatIcon)));
}

/** Mount only this package's strict descriptors; other owners mount their own namespaces. */
export async function apply(ctx: Context): Promise<void> {
  const unmount = await ctx.remote.$mount(contribution);
  const ui = ctx.inject(['remote.rpChat', 'remote.rpMaterials', 'remote.rpConnections', 'slots', 'locale', 'layout'], registerUi);
  ctx.effect(() => async () => { await ui.dispose(); await unmount(); }, 'tavern-kit-chat: client');
}
