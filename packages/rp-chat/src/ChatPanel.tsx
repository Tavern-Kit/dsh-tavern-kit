import React, { lazy, Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { MaterialSummary, MaterialVersion, MaterialVersionRef, PortableResource } from '@tavern-kit/rp-materials/types';
import type { ConnectionView, Route } from '@tavern-kit/rp-connections/types';
import type { Candidate, CandidateGroup, ChatSettings, Conversation, Memo } from './types.js';
import type { CandidateDetail, CandidatePage, CandidateView, ChatChange, ChatState, CreateInput, DisplayProjection, PageInput, RouteInput, RoutePage, SearchHit, SearchInput, SearchPage, SearchPreview, SendInput, TurnSummary, TurnUsage, UpdateInput } from './protocol.js';
import { displayWithRules, macros } from './prompt.js';

import { ArrowLeft, ArrowRight, ArrowUp, BookOpen, ChevronLeft, ChevronRight, Download, FolderHeart, GitBranch, Heart, Layers2, NotebookPen, Palette, PenLine, Plus, RotateCcw, Search, Settings2, Square, X } from './ThemeIcons.js';
import { ActionMenu, ChatDialog, MessageHeading, StoryCover, StoryMark } from './ChatChrome.js';
import { ConversationContext, ConversationList, WorkspaceHome, PresentationRegion } from './ChatWorkspace.js';
import { TavernScene, ReadingSeal } from './TavernArt.js';
import { StartConversationForm } from './StartConversationForm.js';
import { ModelPicker } from './ModelPicker.js';
import { OverflowLine } from './OverflowLine.js';
import { MessageBody } from './MessageBody.js';
import { CandidateFeedback } from './CandidateFeedback.js';
import { HistorySearch } from './HistorySearch.js';
import { PersonaPicker } from './PersonaPicker.js';
import { ChatComposer } from './ChatComposer.js';
import { InlineMessageEditor } from './InlineMessageEditor.js';
import { VariablesPanel } from './VariablesPanel.js';
import type { MvuState } from './mvu/types.js';
import { usePersonaPortraits } from './usePersonaPortraits.js';
const StoryMap = lazy(async () => ({ default: (await import('./StoryMap.js')).StoryMap }));
export type Destination = 'materials' | 'import' | 'connections' | 'appearance';
export interface ChatPanelApi {
  list(): Promise<Conversation[]>;
  create(input: CreateInput): Promise<Conversation>;
  update(id: string, input: UpdateInput): Promise<Conversation>;
  state(id: string): Promise<ChatState>;
  route(input: RouteInput): Promise<RoutePage>;
  candidates(input: PageInput): Promise<CandidatePage>;
  previewCandidate(id: string): Promise<CandidateView>;
  candidate(id: string): Promise<CandidateDetail>;
  usage(turnId: string): Promise<TurnUsage>;
  send(input: SendInput): Promise<CandidateGroup>;
  roll(turnId: string): Promise<CandidateGroup>;
  editInput(turnId: string, input: string): Promise<CandidateGroup>;
  editCandidate(id: string, text: string): Promise<Candidate>;
  continueCandidate(id: string): Promise<CandidateGroup>;
  select(id: string): Promise<Conversation>;
  favorite(id: string, value: boolean): Promise<Candidate>;
  stopCandidate(id: string): Promise<void>;
  stopGroup(id: string): Promise<void>;
  memos(id: string): Promise<Memo[]>;
  editMemo(id: string, content: string, locked: string[]): Promise<Memo>;
  graph(id: string): Promise<TurnSummary[]>;
  initializeVariables(id:string):Promise<Conversation>;
  setVariables(id:string,value:MvuState):Promise<Candidate>;
  search(input: SearchInput): Promise<SearchPage>;
  searchPreview(hit: SearchHit): Promise<SearchPreview>;
  watch(id: string, listener: (change: ChatChange) => void, onError?: (error: unknown) => void): () => void;
  listMaterials(): Promise<MaterialSummary[]>;
  materialVersion(ref: MaterialVersionRef): Promise<MaterialVersion>;
  resources?(ref: MaterialVersionRef): Promise<PortableResource[]>;
  listConnections(): Promise<ConnectionView[]>;
  resolveRoute(route: Route): Promise<Route>;
  defaultFallback(route: Route): Promise<Route[]>;
  fallbackOn400(route: Route): Promise<boolean>;
  fallbackOnError?(route: Route): Promise<boolean>;
  errorPatterns?(route: Route): Promise<string[]>;
}
export interface ChatPanelProps {
  api: ChatPanelApi;
  initialConversationId?: string;
  appearanceAvailable?: boolean;
  renderScene?(area: 'home' | 'chat'): React.ReactNode;
  onNavigate(destination: Destination): void;
  onExport(id: string): Promise<void>;
  onRestore(file: File): Promise<string>;
  onOpened?(id: string | undefined): void;
  reconnectVersion?: number;
}
const routeKey = (route: Pick<Route, 'provider' | 'model'>) => JSON.stringify([route.provider, route.model]);
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const statusText = { pending: '准备中', streaming: '正在写', complete: '已完成', stopped: '已停止', failed: '未完成' };
const active = (candidate: Candidate) => candidate.status === 'pending' || candidate.status === 'streaming';
function displayMessage(text: string, placement: 'input' | 'output', display?: DisplayProjection): string {
  const depth = placement === 'input' ? display?.inputDepth ?? (display?.depth === undefined ? 0 : display.depth + 1) : display?.depth ?? 0;
  return display ? displayWithRules(text, display.rules, placement, { ...display.context, mvu:placement==='input' ? display.inputVariables ?? display.variables : display.variables }, depth) : text;
}
function routeOptions(connections: ConnectionView[]): Route[] {
  return connections.flatMap(connection => connection.models.map(model => ({
    provider: connection.provider, model: model.id, label: `${connection.name} · ${model.name}`, group: connection.preference.group,
    inputBudget: connection.preference.inputBudget ?? 16384,
  })));
}

async function settingsForRoute(api: ChatPanelApi, route: Route) {
  const [mainRoute, fallbacks, fallbackOn400, fallbackOnError, errorPatterns] = await Promise.all([
    api.resolveRoute(route), api.defaultFallback(route), api.fallbackOn400(route),
    api.fallbackOnError?.(route) ?? true, api.errorPatterns?.(route) ?? [],
  ]);
  return { mainRoute, fallbacks, fallbackOn400, fallbackOnError, errorPatterns };
}

/** UI owns reading positions and drafts. Generation remains in the Host service. */
export function ChatPanel({ api, initialConversationId, appearanceAvailable = true, renderScene, onNavigate, onExport, onRestore, onOpened, reconnectVersion = 0 }: ChatPanelProps): React.ReactElement {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [state, setState] = useState<ChatState>();
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [bound, setBound] = useState<MaterialVersion[]>([]);
  const [avatar, setAvatar] = useState<string>();
  const [begin, setBegin] = useState(false), [newCharacter, setNewCharacter] = useState('');
  const [turnId, setTurnId] = useState<string>(), [candidate, setCandidate] = useState<CandidateView>();
  const [position, setPosition] = useState(0), [total, setTotal] = useState(0), [jump, setJump] = useState('1');
  const [favoritesOnly, setFavoritesOnly] = useState(false), [draft, writeDraft] = useState('');
  const draftRevision = useRef(0);
  function setDraft(value:string):void { ++draftRevision.current; writeDraft(value); }
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [historyOffset, setHistoryOffset] = useState(0);
  const [editor, setEditor] = useState<{ kind: 'reply' | 'input'; text: string; candidateId:string; turnId:string; revision:number }>();
  const editRevision = useRef(0);
  const [editError,setEditError] = useState('');
  const [variablesOpen,setVariablesOpen]=useState(false), [contextOpen,setContextOpen]=useState(false);
  const [courtyardInspecting, setCourtyardInspecting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false), [memoOpen, setMemoOpen] = useState(false), [navigationOpen, setNavigationOpen] = useState(false), [searchOpen, setSearchOpen] = useState(false);
  const [memoText, setMemoText] = useState(''), [lockedText, setLockedText] = useState(''), [memoVersions, setMemoVersions] = useState<Memo[]>([]);
  const [detail, setDetail] = useState<CandidateDetail & { route?: Route }>(), [usage, setUsage] = useState<TurnUsage>();
  const [mapRows, setMapRows] = useState<TurnSummary[]>(), [mapPreview, setMapPreview] = useState<CandidateView>();
  const reading = useRef<HTMLDivElement>(null), positions = useRef(new Map<string, number>()), follow = useRef(true);
  const currentReply = useRef<HTMLElement>(null), readingCandidate = useRef<string>();
  const viewedTurnPosition = useRef<{ id:string; index:number }>();
  const current = useRef({ conversationId, turnId, candidateId: candidate?.candidate.id, position, favoritesOnly });
  current.current = { conversationId, turnId, candidateId: candidate?.candidate.id, position, favoritesOnly };
  const pageGeneration = useRef(0), stateGeneration = useRef(0);
  const historyView = useRef<{ conversationId?:string; revision:number; offset:number; requestedOffset:number; page?:RoutePage }>({ conversationId:initialConversationId, revision:0, offset:0, requestedOffset:0 });
  const resetHistory = useCallback((id:string | undefined) => {
    historyView.current = { conversationId:id, revision:historyView.current.revision+1, offset:0, requestedOffset:0 };
    stateGeneration.current++; pageGeneration.current++; setHistoryOffset(0);
  }, []);
  const availableRoutes = routeOptions(connections);
  const character = bound.find(value => value.projection.character)?.projection.character;
  const playerName = state?.conversation.settings.playerName ?? '我';
  const context = { char: character?.name ?? '角色', user: playerName, description: character?.description, personality: character?.personality, scenario: character?.scenario, persona: state?.conversation.settings.playerDescription };
  const portraitRefs = [
    ...(state?.route.items.flatMap(row => row.display?.playerRef ? [row.display.playerRef] : []) ?? []),
    ...(candidate?.display?.playerRef ? [candidate.display.playerRef] : []),
  ];
  const personaPortraits = usePersonaPortraits(portraitRefs, api);
  const playerPortrait = (display?: DisplayProjection) => display?.playerRef ? personaPortraits.get(`${display.playerRef.id}@${display.playerRef.version}`) : undefined;
  const showError = (value: unknown) => setError(errorText(value));
  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setBusy(true); setError('');
    try { return await action(); } catch (failure) { showError(failure); return undefined; } finally { setBusy(false); }
  }
  const refresh = useCallback(async (id: string) => {
    const generation = ++stateGeneration.current, revision = historyView.current.revision;
    const next = await api.state(id), view = historyView.current;
    if (current.current.conversationId !== id || view.conversationId !== id || generation !== stateGeneration.current) return;
    let route = next.route, offset = 0, requestedOffset = 0;
    if (view.page && (view.offset > 0 || view.requestedOffset !== view.offset || view.revision !== revision)) {
      // Keep the loaded nodes; a new selected turn changes their distance from the leaf, not the reading page.
      const page = view.page, pageRevision = view.revision;
      const growth = Math.max(0, next.route.total - page.total);
      offset = view.offset + growth; requestedOffset = view.requestedOffset + growth;
      route = { items:page.items, total:Math.max(page.total, next.route.total) };
      if (view.offset > 0 && growth > 0) {
        const projected = await api.route({ conversationId:id, offset, limit:30 });
        if (current.current.conversationId !== id || historyView.current !== view || generation !== stateGeneration.current || view.revision !== pageRevision || view.page !== page) return;
        const projections = new Map(projected.items.map(row => [row.candidate.id, row.display]));
        route = { ...route, items:page.items.map(row => projections.has(row.candidate.id) ? { ...row, display:projections.get(row.candidate.id) } : row) };
      }
    }
    view.offset = offset; view.requestedOffset = requestedOffset; view.page = route;
    setHistoryOffset(offset); setState({ ...next, route });
    if (!current.current.turnId) {
      const last = next.pending.at(-1) ?? next.route.items.at(-1)?.candidate;
      if (last) { setTurnId(last.turnId); setPosition(Math.max(0, last.ordinal - 1)); }
    }
    setConversations(await api.list());
  }, [api]);
  async function pageHistory(delta:number): Promise<void> {
    if (editor) return;
    const view = historyView.current, id = view.conversationId;
    if (!id) return;
    const revision = ++view.revision, offset = Math.max(0, view.requestedOffset + delta);
    view.requestedOffset = offset;
    const page = await api.route({ conversationId:id, offset, limit:30 });
    if (historyView.current !== view || view.revision !== revision || current.current.conversationId !== id) return;
    const total = Math.max(page.total, view.page?.total ?? 0), adjustedOffset = offset + total - page.total;
    const route = { ...page, total };
    view.offset = adjustedOffset; view.requestedOffset = adjustedOffset; view.page = route;
    setHistoryOffset(adjustedOffset);
    setState(value => value?.conversation.id === id ? { ...value, route } : value);
  }
  const loadCandidate = useCallback(async (id: string, offset: number, favorites: boolean) => {
    const generation = ++pageGeneration.current;
    const page = await api.candidates({ turnId: id, offset, limit: 1, favoritesOnly: favorites });
    if (generation !== pageGeneration.current || current.current.turnId !== id) return;
    setTotal(page.total);
    if (!page.items.length) { setCandidate(undefined); return; }
    const selected = await api.previewCandidate(page.items[0]!.id);
    if (generation !== pageGeneration.current) return;
    setCandidate(selected); setJump(String(offset + 1)); setDetail(undefined); setUsage(undefined);
  }, [api]);
  useEffect(() => { void Promise.all([api.list(), api.listMaterials(), api.listConnections()]).then(([rows, assets, providers]) => { setConversations(rows); setMaterials(assets); setConnections(providers); }).catch(showError); }, [api, reconnectVersion]);
  useEffect(() => {
    if (initialConversationId === current.current.conversationId) return;
    ++editRevision.current; setEditor(undefined); setEditError(''); resetHistory(initialConversationId); current.current.conversationId = initialConversationId;
    setConversationId(initialConversationId); setState(undefined); setTurnId(undefined); setCandidate(undefined); setPosition(0); setFavoritesOnly(false);
  }, [initialConversationId, resetHistory]);
  useEffect(() => {
    if (!conversationId) return;
    let disposed = false;
    const release = api.watch(conversationId, event => {
      if (disposed) return;
      if (event.type === 'candidate' && event.delta) {
        if (current.current.candidateId === event.candidateId) setCandidate(value => value && ({ ...value, text: value.text + event.delta!, candidate: { ...value.candidate, status: 'streaming' } }));
        return;
      }
      void refresh(conversationId).then(() => {
        if (disposed || current.current.conversationId !== conversationId) return;
        const value = current.current;
        if (value.turnId) return loadCandidate(value.turnId, value.position, value.favoritesOnly);
      }).catch(showError);
    }, showError);
    void refresh(conversationId).catch(showError);
    return () => { disposed = true; release(); };
  }, [api, conversationId, reconnectVersion, refresh, loadCandidate]);
  useEffect(() => { if (turnId) void loadCandidate(turnId, position, favoritesOnly).catch(showError); }, [turnId, position, favoritesOnly, loadCandidate]);
  const bindingKey = JSON.stringify(state?.conversation.bindings ?? []);
  useEffect(() => {
    let disposed = false; const refs: MaterialVersionRef[] = state?.conversation.bindings ?? [];
    void (async () => {
      const result: MaterialVersion[] = [], seen = new Set<string>();
      const add = async (ref: MaterialVersionRef): Promise<void> => { const key = `${ref.id}@${ref.version}`; if (seen.has(key)) return; seen.add(key); const value = await api.materialVersion(ref); result.push(value); for (const book of value.bindings.worldbooks) await add(book); if (value.bindings.preset) await add(value.bindings.preset); };
      for (const ref of refs) await add(ref);
      if (disposed) return;
      setBound(result);
      const card = result.find(value => value.projection.character);
      const resource = card && api.resources ? (await api.resources(card)).find(value => value.mediaType.startsWith('image/')) : undefined;
      if (!disposed) setAvatar(resource ? `data:${resource.mediaType};base64,${resource.base64}` : undefined);
    })().catch(showError);
    return () => { disposed = true; };
  }, [api, bindingKey]);
  useLayoutEffect(() => {
    const element = reading.current;
    if (!element || !candidate) { readingCandidate.current = undefined; return; }
    const id = candidate.candidate.id;
    if (readingCandidate.current === id) {
      if (follow.current) element.scrollTop = element.scrollHeight;
      return;
    }
    readingCandidate.current = id;
    const saved = positions.current.get(id);
    if (saved !== undefined) element.scrollTop = saved;
    else if (active(candidate.candidate)) element.scrollTop = element.scrollHeight;
    else if (currentReply.current) element.scrollTop = Math.max(0, element.scrollTop + currentReply.current.getBoundingClientRect().top - element.getBoundingClientRect().top - 16);
    follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  }, [candidate?.candidate.id, candidate?.text]);
  function open(id: string | undefined): void {
    if (editor) return;
    if (id !== undefined && current.current.conversationId === id) { setNavigationOpen(false); return; }
    if (candidate && reading.current) positions.current.set(candidate.candidate.id, reading.current.scrollTop);
    ++editRevision.current; setEditError(''); setNavigationOpen(false); setSettingsOpen(false); setSearchOpen(false); resetHistory(id); current.current.conversationId = id;
    setConversationId(id); setTurnId(undefined); setCandidate(undefined); setState(undefined); setPosition(0); setDraft(''); setEditor(undefined); setMemoOpen(false); setDetail(undefined); setMapRows(undefined); setFavoritesOnly(false); onOpened?.(id);
  }
  async function openGroup(group: CandidateGroup): Promise<void> {
    if (current.current.conversationId !== group.conversationId) return;
    resetHistory(group.conversationId); setTurnId(group.turnId); setFavoritesOnly(false);
    let page = await api.candidates({ turnId: group.turnId, groupId: group.id, limit: 1 });
    if (page.total > 1) page = await api.candidates({ turnId: group.turnId, groupId: group.id, offset: page.total - 1, limit: 1 });
    if (current.current.conversationId !== group.conversationId) return;
    const next = page.items[0]; setPosition(next ? next.ordinal - 1 : 0);
    if (next) { const preview = await api.previewCandidate(next.id); if (current.current.conversationId !== group.conversationId) return; setCandidate(preview); }
    await refresh(group.conversationId);
  }
  async function selectReply(id:string): Promise<void> {
    if (editor) return;
    const conversation = current.current.conversationId;
    await api.select(id);
    if (!conversation || current.current.conversationId !== conversation) return;
    resetHistory(conversation); await refresh(conversation);
  }
  async function send(): Promise<void> {
    if (!conversationId || !draft.trim() || editor || busy) return;
    const text = draft, revision = draftRevision.current;
    const group = await run(() => api.send({ conversationId, input: text, parentCandidateId: candidate?.candidate.id ?? state?.conversation.currentCandidateId }));
    if (group && current.current.conversationId === conversationId) { if (draftRevision.current === revision) setDraft(''); await openGroup(group); }
  }
  async function changeModel(route: Route): Promise<void> {
    if (!conversationId) return;
    const id = conversationId;
    const settings = await settingsForRoute(api, route);
    const conversation = await api.update(id, { settings });
    if (current.current.conversationId !== id) return;
    setState(value => value && ({ ...value, conversation }));
    setConversations(await api.list());
  }
  async function continueSearch(id: string): Promise<void> {
    if (editor) return;
    const previousId = current.current.conversationId;
    setBusy(true); setError('');
    try {
      const conversation = await api.select(id);
      if (current.current.conversationId !== previousId) return;
      if (conversation.id !== previousId) { open(conversation.id); return; }
      const next = await api.previewCandidate(id);
      if (current.current.conversationId !== previousId) return;
      if (candidate && reading.current) positions.current.set(candidate.candidate.id, reading.current.scrollTop);
      resetHistory(conversation.id);
      current.current = { conversationId:conversation.id, turnId:next.candidate.turnId, candidateId:id, position:next.candidate.ordinal-1, favoritesOnly:false };
      setSearchOpen(false); setNavigationOpen(false); setFavoritesOnly(false);
      setTurnId(next.candidate.turnId); setPosition(next.candidate.ordinal-1); setCandidate(next);
      await refresh(conversation.id);
    } finally { setBusy(false); }
  }
  async function returnToCurrent(): Promise<void> {
    if (editor) return;
    const id = state?.conversation.currentCandidateId;
    if (!id || !conversationId) return;
    const next = await api.previewCandidate(id);
    if (current.current.conversationId !== next.candidate.conversationId) return;
    resetHistory(conversationId); setFavoritesOnly(false);
    setTurnId(next.candidate.turnId); setPosition(next.candidate.ordinal - 1); setCandidate(next);
    await refresh(conversationId);
  }
  async function create(input: CreateInput): Promise<void> {
    setBusy(true); setError('');
    try {
      const defaults = input.settings?.mainRoute ? await settingsForRoute(api, input.settings.mainRoute) : {};
      const value = await api.create({ ...input, settings: { ...input.settings, ...defaults } });
      setBegin(false); setNewCharacter(''); open(value.id);
      if (!value.settings.mainRoute) setSettingsOpen(true);
    } finally { setBusy(false); }
  }
  function startEdit(kind:'reply'|'input',text:string):void {
    if (!candidate || !turnId || editor) return;
    setEditError(''); setError('');
    setEditor({kind,text,candidateId:candidate.candidate.id,turnId,revision:++editRevision.current});
  }
  function cancelEdit():void { ++editRevision.current; setEditor(undefined); setEditError(''); }
  async function saveEdit(): Promise<void> {
    if (!editor || busy) return;
    const draft=editor, id=current.current.conversationId;
    setBusy(true); setEditError('');
    try {
      if (draft.kind === 'input') {
        const group=await api.editInput(draft.turnId,draft.text);
        if (current.current.conversationId !== id || editRevision.current !== draft.revision) return;
        setEditor(undefined); await openGroup(group);
      } else {
        const edited=await api.editCandidate(draft.candidateId,draft.text);
        if (current.current.conversationId !== id || editRevision.current !== draft.revision) return;
        const next=await api.previewCandidate(edited.id);
        if (current.current.conversationId !== id || editRevision.current !== draft.revision) return;
        setEditor(undefined); setFavoritesOnly(false); setPosition(edited.ordinal-1); setCandidate(next);
      }
    } catch (failure) { if (current.current.conversationId === id && editRevision.current === draft.revision) setEditError(errorText(failure)); }
    finally { setBusy(false); }
  }
  async function showMemo(): Promise<void> {
    if (!conversationId) return;
    const versions = await run(() => api.memos(conversationId)); if (!versions) return;
    setMemoVersions(versions); setMemoText(state?.memo?.content ?? ''); setLockedText(state?.memo?.locked.join('\n') ?? ''); setMemoOpen(true);
  }
  const selectedTurn = state?.route.items.find(row => row.turn.id === turnId)?.turn;
  const viewedIndex = state?.route.items.findIndex(row => row.turn.id === turnId) ?? -1;
  const pageStart = state ? state.route.total - historyOffset - state.route.items.length : 0;
  if (turnId && viewedIndex >= 0) viewedTurnPosition.current = { id:turnId, index:pageStart+viewedIndex };
  const knownPosition = viewedTurnPosition.current?.id === turnId ? viewedTurnPosition.current?.index : undefined;
  const history = viewedIndex >= 0 ? state!.route.items.slice(0, viewedIndex)
    : knownPosition !== undefined ? (state?.route.items ?? []).slice(0, Math.max(0, knownPosition-pageStart))
    : candidate && (candidate.candidate.id === state?.conversation.currentCandidateId || active(candidate.candidate)) ? state?.route.items ?? [] : [];
  const quickReplies = bound.flatMap(value => value.projection.quickReplies).filter(value => value.enabled);
  const newer = state?.conversation.bindings.some(ref => (materials.find(value => value.id === ref.id)?.currentVersion ?? ref.version) > ref.version);
  const showDetails = () => { if (candidate) void run(async () => { setDetail({ ...await api.candidate(candidate.candidate.id), route: candidate.route }); setUsage(await api.usage(candidate.candidate.turnId)); }); };
  const showMap = () => { if (conversationId && !editor) void run(() => api.graph(conversationId)).then(rows => { if (rows) setMapRows(rows); }); };
  const modalOpen = Boolean(navigationOpen || searchOpen || variablesOpen || contextOpen || begin || (settingsOpen && state) || memoOpen || detail || mapRows);
  const dialogFeedback = { error, onDismissError: () => setError('') };
  const closeDialog = (close: () => void) => { setError(''); close(); };
  const speaker = candidate?.display?.context.char ?? character?.name ?? '角色';
  return <section className={`tk-rp tk-chat-layout ${conversationId ? 'tk-view-chat' : 'tk-view-home'}`} onPointerDownCapture={event => { event.currentTarget.dataset.tkInput = 'pointer'; }} onKeyDownCapture={event => { event.currentTarget.dataset.tkInput = 'keyboard'; }}>
    <aside className="tk-conversations" aria-label="会话导航">
      <header className="tk-sidebar-brand"><button className="tk-brand-home" aria-label="回到首页" disabled={Boolean(editor)} onClick={() => open(undefined)}><StoryMark /><span><strong>Tavern Kit</strong></span></button></header>
      <div className="tk-sidebar-actions"><button className="tk-new-conversation" aria-label="＋ 新对话" disabled={Boolean(editor)} onClick={() => setBegin(true)}><Plus size={17} aria-hidden="true" />新对话</button><button className="tk-icon-control tk-micro-control tk-search-shortcut" data-tk-icon-trigger="" aria-label="搜索正文" disabled={Boolean(editor)} title="搜索正文" onClick={() => setSearchOpen(true)}><Search size={17} aria-hidden="true" /></button></div>
      <ConversationList conversations={conversations} currentId={conversationId} onOpen={open} disabled={Boolean(editor)} searchable />
      {!conversationId && <div className="tk-sidebar-scene"><TavernScene /></div>}<nav className="tk-nav-bottom"><button aria-label="素材库" disabled={Boolean(editor)} onClick={() => onNavigate('materials')}><FolderHeart size={16} aria-hidden="true" />素材库</button><button aria-label="连接模型" disabled={Boolean(editor)} onClick={() => onNavigate('connections')}><Layers2 size={16} aria-hidden="true" />模型</button>{appearanceAvailable && <button aria-label="换个装扮" disabled={Boolean(editor)} onClick={() => onNavigate('appearance')}><Palette size={16} aria-hidden="true" />装扮</button>}</nav>
    </aside>
    <main className="tk-chat-main">
      {!conversationId ? <WorkspaceHome renderScene={renderScene} conversations={conversations} materials={materials} connections={connections} onOpen={open} onBegin={id => { setNewCharacter(id ?? ''); setBegin(true); }} onNavigate={onNavigate} onShowAll={() => setNavigationOpen(true)} onRestore={file => { void run(() => onRestore(file)).then(id => { if (id) open(id); }); }} /> : !state ? <div className="tk-chat-loading" role="status"><BookOpen size={24} aria-hidden="true" /><span>正在翻开这段对话…</span></div> : <>
        <header className="tk-chat-header" data-tk-page-heading>
          <button className="tk-mobile-back tk-icon-control" disabled={Boolean(editor)} onClick={() => open(undefined)} aria-label="返回会话列表"><ArrowLeft size={20} aria-hidden="true" /></button>
          <StoryCover seed={character?.name ?? state.conversation.title} image={avatar} className="tk-avatar" />
          <div className="tk-chat-title"><h1 title={state.conversation.title}><OverflowLine>{state.conversation.title}</OverflowLine></h1><span><span className="tk-chat-partner">{character?.name || '我的对话'}</span><i aria-hidden="true">·</i><span className="tk-chat-rounds">{state.route.total.toLocaleString('zh-CN')} 轮</span></span></div>
          <div className="tk-header-actions"><button className="tk-icon-control tk-micro-control" data-tk-icon-trigger="" aria-label="搜索历史正文" disabled={Boolean(editor)} title="搜索历史正文" onClick={() => setSearchOpen(true)}><Search size={17} aria-hidden="true" /><span>搜索</span></button><button className="tk-icon-control tk-micro-control" data-tk-icon-trigger="" aria-label="剧情备忘" title="剧情备忘" onClick={() => void showMemo()}><NotebookPen size={17} aria-hidden="true" /><span>备忘</span></button><button className="tk-icon-control tk-micro-control" data-tk-icon-trigger="" aria-label="对话设定" title="对话设定" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings2 size={17} aria-hidden="true" /><span>设定</span></button><ActionMenu>
            <span className="tk-menu-heading">这段对话</span>{newer && <button className="tk-version-update" aria-label="应用到这段对话" title="素材有新版：应用到这段对话" onClick={() => void run(async () => { await api.update(conversationId, { bindings: state.conversation.bindings.map(ref => ({ id: ref.id, version: materials.find(value => value.id === ref.id)?.currentVersion ?? ref.version })) }); await refresh(conversationId); })}>新版</button>}<button onClick={() => setContextOpen(true)}><BookOpen size={17} aria-hidden="true" />人物与设定</button>{state.conversation.settings.mapEnabled && <button disabled={Boolean(editor)} onClick={showMap}><GitBranch size={17} aria-hidden="true" />剧情分支</button>}{candidate && <button onClick={() => setVariablesOpen(true)}><Layers2 size={17} aria-hidden="true" />剧情变量</button>}<button onClick={() => void run(() => onExport(conversationId))}><Download size={17} aria-hidden="true" />把这段对话带走</button><hr /><button disabled={Boolean(editor)} onClick={() => onNavigate('materials')}><FolderHeart size={17} aria-hidden="true" />素材库</button><button disabled={Boolean(editor)} onClick={() => onNavigate('connections')}><Layers2 size={17} aria-hidden="true" />连接模型</button>{appearanceAvailable && <button disabled={Boolean(editor)} onClick={() => onNavigate('appearance')}><Palette size={17} aria-hidden="true" />换个装扮</button>}
          </ActionMenu></div>
        </header>

        <div className={`tk-workspace${courtyardInspecting ? ' tk-courtyard-inspecting' : ''}`}><div className="tk-transcript" ref={element => { if (element) element.inert = courtyardInspecting; }}>
        <div className="tk-reading" ref={reading} onScroll={event => { const element = event.currentTarget; follow.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; if (candidate) positions.current.set(candidate.candidate.id, element.scrollTop); }}>
          <ReadingSeal />
          {state.route.total > 30 && <div className="tk-history-pages"><button className="tk-text-action" disabled={Boolean(editor) || historyOffset + 30 >= state.route.total} onClick={() => void run(() => pageHistory(30))}><ChevronLeft size={13} aria-hidden="true" />更早的 30 轮</button><span>{Math.min(historyOffset + 1, state.route.total)}—{Math.min(historyOffset + state.route.items.length, state.route.total)} / {state.route.total.toLocaleString('zh-CN')} 轮 · 倒序页</span><button className="tk-text-action" disabled={Boolean(editor) || historyOffset === 0} onClick={() => void run(() => pageHistory(-30))}>后面 30 轮<ChevronRight size={13} aria-hidden="true" /></button></div>}
          {history.map(row => <div className="tk-history-turn" key={row.turn.id}>{row.turn.input && <article className="tk-message tk-player tk-message-user"><MessageHeading name={row.display?.context.user ?? playerName} image={playerPortrait(row.display)} /><MessageBody className="tk-message-body" text={displayMessage(row.turn.input, 'input', row.display)} /></article>}<article className="tk-message tk-character"><MessageHeading name={row.display?.context.char ?? character?.name ?? '角色'}><button className="tk-text-action" disabled={Boolean(editor)} onClick={() => { setTurnId(row.turn.id); setPosition(row.candidate.ordinal - 1); setFavoritesOnly(false); }}>查看这轮候选<ChevronRight size={12} aria-hidden="true" /></button></MessageHeading><MessageBody className="tk-message-body" text={displayMessage(row.text, 'output', row.display)} /></article></div>)}
          {selectedTurn?.input && <article className="tk-message tk-player tk-message-user"><MessageHeading name={candidate?.display?.context.user ?? playerName} image={playerPortrait(candidate?.display)}><button className="tk-icon-control tk-micro-control" aria-label="修改这句" title="修改这句" disabled={Boolean(editor)} onClick={() => startEdit('input', selectedTurn.input)}><PenLine size={13} aria-hidden="true" /></button></MessageHeading>{editor?.kind === 'input' && editor.turnId === selectedTurn.id ? <InlineMessageEditor key={editor.revision} label="修改玩家原文" fieldLabel="玩家原文" value={editor.text} saving={busy} error={editError} onChange={text => setEditor(value => value && ({...value,text}))} onSave={() => void saveEdit()} onCancel={cancelEdit} /> : <MessageBody className="tk-message-body" text={displayMessage(selectedTurn.input, 'input', candidate?.display)} />}</article>}
          {candidate && <article className="tk-message tk-character tk-current-reply" aria-label="当前候选" ref={currentReply}><div className="tk-reply-header"><MessageHeading name={speaker} image={speaker === character?.name ? avatar : undefined} meta={(candidate.candidate.status !== 'complete' || candidate.candidate.kind !== 'generated') ? <>{candidate.candidate.status !== 'complete' && <span className="tk-generation-state" role="status" data-state={candidate.candidate.status}><i aria-hidden="true" />{statusText[candidate.candidate.status]}</span>}{candidate.candidate.kind !== 'generated' && <span className="tk-origin-label">{candidate.candidate.kind === 'edited' ? '手改' : '续写'}</span>}</> : undefined}></MessageHeading>{turnId && <div className="tk-candidate-bar" role="group" aria-label="这轮回复与分支"><div className="tk-candidate-switch"><button className="tk-icon-control tk-micro-control" aria-label="上一个候选" disabled={Boolean(editor) || position <= 0} onClick={() => setPosition(position - 1)}><ChevronLeft size={18} aria-hidden="true" /></button><label className="tk-candidate-number"><input aria-label="候选序号" disabled={Boolean(editor)} type="number" min={1} max={Math.max(1, total)} value={jump} style={{ width: `${Math.max(2, Math.min(7, jump.length + 1))}ch` }} onChange={event => setJump(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') setPosition(Math.max(0, Math.min(total - 1, Number(jump) - 1))); }} /><span aria-label="候选总数">/ {total.toLocaleString('zh-CN')}</span></label><button aria-label="前往候选" className="tk-icon-control tk-micro-control tk-jump-action" title="前往候选" disabled={Boolean(editor) || !total} onClick={() => setPosition(Math.max(0, Math.min(total - 1, Number(jump) - 1)))}><ArrowRight size={12} aria-hidden="true" /></button><button className="tk-icon-control tk-micro-control" aria-label="下一个候选" disabled={Boolean(editor) || position + 1 >= total} onClick={() => setPosition(position + 1)}><ChevronRight size={18} aria-hidden="true" /></button></div><label className={`tk-favorite-filter tk-micro-control ${favoritesOnly ? 'tk-filter-active' : ''}`} title="只看喜欢"><input type="checkbox" aria-label="只看喜欢" disabled={Boolean(editor)} checked={favoritesOnly} onChange={event => { setFavoritesOnly(event.target.checked); setPosition(0); }} /><Heart size={15} fill={favoritesOnly ? 'currentColor' : 'none'} aria-hidden="true" /><span>只看喜欢</span></label><div className="tk-roll-actions">{state.pending.length > 0 && <button className="tk-icon-control tk-micro-control" aria-label="停止整组" title="停止整组" onClick={() => void run(async () => { const groups = new Set(state.pending.map(value => value.groupId)); for (const id of groups) await api.stopGroup(id); await refresh(conversationId); })}><Square size={14} aria-hidden="true" /></button>}<button className="tk-roll-button tk-micro-control" aria-label="换个回复" title="换个回复" disabled={Boolean(editor) || busy} onClick={() => void run(() => api.roll(turnId)).then(group => { if (group) void openGroup(group); })}><RotateCcw size={15} aria-hidden="true" /><span>换个回复</span></button></div></div>}</div>{editor?.kind === 'reply' && editor.candidateId === candidate.candidate.id ? <InlineMessageEditor key={editor.revision} label="编辑角色回复" fieldLabel="角色回复" value={editor.text} saving={busy} error={editError} onChange={text => setEditor(value => value && ({...value,text}))} onSave={() => void saveEdit()} onCancel={cancelEdit} /> : <MessageBody className="tk-reply-body tk-message-body" text={displayMessage(candidate.text, 'output', candidate.display) || (active(candidate.candidate) ? '正在等角色开口…' : '这条还没有正文')} />}<CandidateFeedback value={candidate} disabled={Boolean(editor) || busy} onRetry={() => void run(() => api.roll(candidate.candidate.turnId)).then(group => { if (group) void openGroup(group); })} onConnect={() => onNavigate('connections')} onDetails={showDetails} />
            <footer className="tk-reply-actions">{state.conversation.currentCandidateId && state.conversation.currentCandidateId !== candidate.candidate.id && <button className="tk-text-action tk-micro-control tk-return-route" disabled={Boolean(editor)} onClick={() => void run(returnToCurrent)}><GitBranch size={14} aria-hidden="true" />返回当前路线</button>}<div className="tk-reply-tools"><button className={`tk-icon-control tk-micro-control ${candidate.candidate.favorite ? 'tk-loved' : ''}`} aria-label={candidate.candidate.favorite ? '取消喜欢' : '喜欢这条'} title={candidate.candidate.favorite ? '取消喜欢' : '喜欢这条'} aria-pressed={candidate.candidate.favorite} onClick={() => void run(async () => { const next = await api.favorite(candidate.candidate.id, !candidate.candidate.favorite); setCandidate(value => value && ({ ...value, candidate: next })); })}><Heart size={16} fill={candidate.candidate.favorite ? 'currentColor' : 'none'} aria-hidden="true" /></button><ActionMenu label="回复操作" className="tk-reply-menu"><button className="tk-icon-control tk-micro-control" aria-label="编辑这条回复" title="编辑这条回复" disabled={Boolean(editor) || active(candidate.candidate)} onClick={() => startEdit('reply', candidate.text)}><PenLine size={16} aria-hidden="true" /><span>编辑这条回复</span></button><button className="tk-text-action tk-model-detail" aria-label="模型与提示词" onClick={showDetails} title={candidate.route ? `${candidate.route.provider} · ${candidate.route.model}` : undefined}><Layers2 size={14} aria-hidden="true" /><span>模型与提示词</span></button></ActionMenu></div><div className="tk-reply-decisions">{active(candidate.candidate) ? <button className="tk-text-action tk-micro-control" onClick={() => void run(async () => { await api.stopCandidate(candidate.candidate.id); await loadCandidate(turnId!, position, favoritesOnly); })}><Square size={12} aria-hidden="true" />停止这条</button> : <button className="tk-text-action tk-micro-control" disabled={Boolean(editor) || !candidate.text} onClick={() => void run(() => api.continueCandidate(candidate.candidate.id)).then(group => { if (group) void openGroup(group); })}>继续写</button>}<button className="tk-text-action tk-micro-control tk-select-reply" aria-pressed={state.conversation.currentCandidateId === candidate.candidate.id} disabled={Boolean(editor) || active(candidate.candidate)} onClick={() => void run(() => selectReply(candidate.candidate.id))}>接着这条聊<ArrowRight size={14} aria-hidden="true" /></button></div></footer>
          </article>}
          {favoritesOnly && !total && <div className="tk-empty"><Heart size={22} aria-hidden="true" /><p>这一轮还没有标记喜欢的回复。</p><button className="tk-text-action" onClick={() => { setFavoritesOnly(false); setPosition(0); }}>看全部候选<ArrowRight size={14} aria-hidden="true" /></button></div>}
        </div>
        <div className="tk-writing-dock">
          <ChatComposer value={draft} onChange={setDraft} busy={busy} generating={Boolean(candidate && active(candidate.candidate))} canSend={!editor && Boolean(state.conversation.settings.mainRoute)} placeholder={character?.name ? `想对 ${character.name} 说些什么？` : '想对 TA 说些什么？'} onSend={() => { void send(); }} onStop={() => { if (candidate) void run(async () => { await api.stopCandidate(candidate.candidate.id); await loadCandidate(candidate.candidate.turnId,position,favoritesOnly); }); }}>{quickReplies.length > 0 && <details className="tk-quick-menu"><summary aria-label="快捷回复" title="快捷回复"><Plus size={17} aria-hidden="true" /></summary><div>{quickReplies.map((value,index) => <button type="button" key={`${value.id}-${index}`} onClick={event => { setDraft(macros(value.message,context)); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{value.label}</button>)}</div></details>}<ModelPicker connections={connections} value={state.conversation.settings.mainRoute} disabled={busy || Boolean(editor)} onSelect={changeModel} onManage={() => onNavigate('connections')} />{state.conversation.settings.parallel && <span className="tk-parallel-caption">同时 {state.conversation.settings.parallelCount} 条</span>}</ChatComposer>
        </div>
        </div><div className="tk-companion">{renderScene && <PresentationRegion renderScene={renderScene} onInspectChange={setCourtyardInspecting} />}</div></div>
      </>}
      {error && !modalOpen && !editor && <div className="tk-error tk-inline" role="alert"><span>{error}</span><button className="tk-icon-control tk-micro-control" aria-label="收起错误" onClick={() => setError('')}><X size={16} aria-hidden="true" /></button></div>}
    </main>
    {contextOpen && state && <ChatDialog {...dialogFeedback} label="人物与设定" onClose={() => closeDialog(() => setContextOpen(false))}><ConversationContext conversation={state.conversation} bound={bound} memo={state.memo} image={avatar} connections={connections} onSettings={() => { setContextOpen(false); setSettingsOpen(true); }} onMemo={() => { setContextOpen(false); void showMemo(); }} /></ChatDialog>}
    {navigationOpen && <ChatDialog {...dialogFeedback} label="我的对话" onClose={() => closeDialog(() => setNavigationOpen(false))}><div className="tk-dialog-conversations"><ConversationList conversations={conversations} currentId={conversationId} onOpen={open} disabled={Boolean(editor)} searchable /></div></ChatDialog>}
    {begin && <ChatDialog {...dialogFeedback} label="开一段新对话" onClose={() => closeDialog(() => setBegin(false))}><StartConversationForm materials={materials} routes={availableRoutes} initialCharacterId={newCharacter || undefined} readVersion={ref => api.materialVersion(ref)} readResources={api.resources} onCreate={create} onNavigate={onNavigate} busy={busy} /></ChatDialog>}
    {searchOpen && <ChatDialog {...dialogFeedback} label="搜索历史正文" className="tk-dialog-wide" onClose={() => { if (!busy) closeDialog(() => setSearchOpen(false)); }}><HistorySearch key={conversationId ?? "all"} api={api} conversationId={conversationId} onContinue={continueSearch} /></ChatDialog>}
    {settingsOpen && state && conversationId && <ChatDialog {...dialogFeedback} label="对话设定" className="tk-dialog-wide" onClose={() => closeDialog(() => setSettingsOpen(false))}><SettingsForm conversation={state.conversation} materials={materials} bound={bound} routes={availableRoutes} api={api} onSaved={async () => { setError(''); setSettingsOpen(false); await refresh(conversationId); }} onConnect={() => onNavigate('connections')} onManagePersona={() => onNavigate('materials')} onError={showError} /></ChatDialog>}
    {variablesOpen && candidate && conversationId && <ChatDialog {...dialogFeedback} label="剧情变量" className="tk-dialog-wide" onClose={() => closeDialog(() => setVariablesOpen(false))}><VariablesPanel key={candidate.candidate.id} candidate={candidate.candidate} onEnable={async()=>{await api.initializeVariables(candidate.candidate.id);setCandidate(await api.previewCandidate(candidate.candidate.id));await refresh(conversationId);}} onSave={async value=>{const id=candidate.candidate.id;await api.setVariables(id,value);const next=await api.previewCandidate(id);if(current.current.candidateId===id)setCandidate(next);}} /></ChatDialog>}

    {memoOpen && conversationId && <ChatDialog {...dialogFeedback} label="剧情备忘" onClose={() => closeDialog(() => setMemoOpen(false))}><label>称呼、关系与最近进展<textarea value={memoText} onChange={event => setMemoText(event.target.value)} rows={10} /></label><label>锁定的重要内容<span className="tk-muted">每行一项</span><textarea value={lockedText} onChange={event => setLockedText(event.target.value)} rows={4} /></label><div className="tk-dialog-actions"><button className="tk-primary" disabled={busy} onClick={() => void run(async () => { await api.editMemo(conversationId, memoText, lockedText.split('\n').map(value => value.trim()).filter(Boolean)); await refresh(conversationId); setMemoVersions(await api.memos(conversationId)); })}>保存这一版</button><span className="tk-muted">已保存 {memoVersions.length} 版</span></div><details><summary>查看旧版本</summary>{memoVersions.slice().reverse().map((value, index) => <article className="tk-card" key={value.id}><header className="tk-inline"><strong>第 {memoVersions.length - index} 版</strong><time>{new Date(value.createdAt).toLocaleString('zh-CN')}</time><button onClick={() => { setMemoText(value.content); setLockedText(value.locked.join('\n')); }}>以这版为草稿</button></header><p className="tk-preserve">{value.content}</p></article>)}</details></ChatDialog>}
    {detail && <ChatDialog {...dialogFeedback} label="模型与提示词" className="tk-dialog-wide" onClose={() => closeDialog(() => setDetail(undefined))}>{detail.route && <section className="tk-candidate-route" aria-label="这条回复的模型"><span className="tk-muted">{detail.candidate.kind === 'edited' ? '来源实际模型' : '这条的实际模型'}</span><strong>{detail.route.label ?? detail.route.provider}</strong><div className="tk-inline tk-muted"><span>{detail.route.provider}</span>{detail.route.group && <span>业务分组 · {detail.route.group}</span>}</div><code>{detail.route.model}</code></section>}{usage && <div className="tk-inline tk-usage-summary"><strong>这轮 {usage.requestCount} 次请求</strong><span>摘要 {usage.summaryRequests} 次</span><span>续写 {usage.continuationRequests} 次</span>{usage.unknownRequests > 0 && <span>{usage.unknownRequests} 次用量未返回</span>}</div>}{detail.attempts.map(value => <article className="tk-card" key={value.id}><div className="tk-inline"><strong>{value.route?.label ?? value.config.provider}</strong><span>{value.config.model}</span>{value.route?.group && <span className="tk-chip">{value.route.group}</span>}<span className="tk-chip">{value.kind === 'summary' ? '剧情整理' : value.kind === 'continuation' ? '续写' : '回复'}</span><span>{value.status === 'skipped' ? '已跳过' : statusText[value.status]}</span></div><div className="tk-inline tk-muted"><span>输入 {value.usage?.inputTokens ?? '未返回'}</span><span>输出 {value.usage?.outputTokens ?? '未返回'}</span><span>缓存读取 {value.usage?.cachedInputTokens ?? '未返回'}</span></div>{value.error && <p className="tk-error">{value.error.status ? `${value.error.status} · ` : ''}{value.error.message}</p>}<details><summary>本次实际配置</summary><pre>{JSON.stringify(value.config, null, 2)}</pre></details></article>)}<details><summary>完整模型输入</summary><pre>{detail.input.system}</pre>{detail.input.messages.map((value, index) => <div key={index}><strong>{value.role}</strong><pre>{value.content}</pre></div>)}</details><details><summary>提示词来源</summary>{detail.snapshot.sources.map((value, index) => <div key={index}><strong>{value.label}</strong><pre>{value.text}</pre></div>)}</details></ChatDialog>}
    {mapRows && <ChatDialog {...dialogFeedback} label="剧情地图" className="tk-dialog-map" onClose={() => closeDialog(() => { setMapRows(undefined); setMapPreview(undefined); })}><Suspense fallback={<p role="status">正在展开路线…</p>}><StoryMap rows={mapRows} currentTurnId={turnId} onPreview={(id, candidateId) => { void run(async () => { const key = candidateId ?? mapRows.find(row => row.id === id)?.previewCandidateId; if (key) setMapPreview(await api.previewCandidate(key)); }); }} /></Suspense>{mapPreview && <div className="tk-card tk-map-preview"><MessageBody text={displayMessage(mapPreview.text, 'output', mapPreview.display)} /><div className="tk-inline"><span>第 {mapPreview.candidate.ordinal} 个候选</span><button className="tk-primary" onClick={() => void run(async () => { await selectReply(mapPreview.candidate.id); setMapRows(undefined); setMapPreview(undefined); setTurnId(mapPreview.candidate.turnId); setFavoritesOnly(false); setPosition(mapPreview.candidate.ordinal - 1); })}>从这里继续</button></div></div>}</ChatDialog>}
  </section>;
}

function SettingsForm({ conversation, materials, bound, routes, api, onSaved, onConnect, onManagePersona, onError }: { conversation: Conversation; materials: MaterialSummary[]; bound: MaterialVersion[]; routes: Route[]; api: ChatPanelApi; onSaved(): Promise<void>; onConnect(): void; onManagePersona(): void; onError(error: unknown): void }): React.ReactElement {
  const [settings, setSettings] = useState<ChatSettings>(conversation.settings), [title, setTitle] = useState(conversation.title), [bindings, setBindings] = useState(conversation.bindings), [saving, setSaving] = useState(false);
  const [personaPending, setPersonaPending] = useState(false);
  const modelSelectId = useId();
  const personaIds = new Set([...materials.filter(value => value.kind === 'persona').map(value => value.id), ...bound.filter(value => value.projection.persona).map(value => value.id)]);
  const personaRef = bindings.find(value => personaIds.has(value.id));
  const presetIds = new Set([...materials.filter(value => value.kind === 'preset').map(value => value.id), ...bound.filter(value => value.projection.preset).map(value => value.id)]);
  const presetRef = bindings.find(value => presetIds.has(value.id));
  const presetChoices = materials.filter(value => value.kind === 'preset' && (value.enabled || value.id === presetRef?.id)).map(value => ({ id:value.id, name:value.name, version:bindings.find(ref => ref.id === value.id)?.version ?? value.currentVersion }));
  for (const value of bound.filter(value => value.projection.preset)) if (!presetChoices.some(choice => choice.id === value.id)) presetChoices.push({id:value.id,name:value.projection.name,version:value.version});
  useEffect(() => { setSettings(conversation.settings); setBindings(conversation.bindings); setTitle(conversation.title); }, [conversation.id, conversation.settingsRevision]);
  const choices = [...routes]; if (settings.mainRoute && !choices.some(value => routeKey(value) === routeKey(settings.mainRoute!))) choices.push(settings.mainRoute);
  for (const value of settings.fallbacks) if (!choices.some(row => routeKey(row) === routeKey(value))) choices.push(value);
  function bind(id: string, enabled: boolean): void { const value = materials.find(row => row.id === id); if (!value) return; setBindings(rows => enabled ? [...rows.filter(row => row.id !== id), { id, version: value.currentVersion }] : rows.filter(row => row.id !== id)); }
  return <section className="tk-card tk-chat-settings" aria-label="对话设定"><PersonaPicker materials={materials} value={personaRef} readVersion={ref => api.materialVersion(ref)} readResources={api.resources} onPending={setPersonaPending} onManage={onManagePersona} onSelect={(ref, persona) => { setBindings(rows => [...rows.filter(value => !personaIds.has(value.id)), ...(ref ? [ref] : [])]); if (persona) setSettings(value => ({ ...value, playerName:persona.name, playerDescription:persona.description })); }} /><div className="tk-form-grid tk-identity-grid"><label>对话名字<input value={title} onChange={event => setTitle(event.target.value)} /></label><label>玩家称呼<input value={settings.playerName} onChange={event => setSettings({ ...settings, playerName: event.target.value })} /></label><div className="tk-model-setting-field"><label htmlFor={modelSelectId}>当前模型</label><div className="tk-model-setting-control"><select id={modelSelectId} aria-label="当前模型" value={settings.mainRoute ? routeKey(settings.mainRoute) : ''} onChange={event => { const route = choices.find(value => routeKey(value) === event.target.value); if (route) void settingsForRoute(api, route).then(next => setSettings(value => ({ ...value, ...next }))).catch(onError); }}><option value="">请选择模型</option>{choices.map(value => <option key={routeKey(value)} value={routeKey(value)}>{value.label ?? `${value.provider} · ${value.model}`}</option>)}</select><button type="button" className="tk-icon-control tk-micro-control" data-tk-icon-trigger="" aria-label="管理模型连接" title="管理模型连接" onClick={onConnect}><Settings2 size={16} aria-hidden="true" /></button></div></div><label className="tk-span-all">玩家设定<textarea rows={2} value={settings.playerDescription} onChange={event => setSettings({ ...settings, playerDescription: event.target.value })} /></label></div><div className="tk-inline"><label className="tk-check"><input type="checkbox" checked={settings.parallel} onChange={event => setSettings({ ...settings, parallel: event.target.checked })} />同时生成几个回复</label>{settings.parallel && <label className="tk-inline">数量<input className="tk-small-number" aria-label="同时生成数量" type="number" min={1} value={settings.parallelCount} onChange={event => setSettings({ ...settings, parallelCount: Number(event.target.value) })} /></label>}<label className="tk-check"><input type="checkbox" checked={settings.mapEnabled} onChange={event => setSettings({ ...settings, mapEnabled: event.target.checked })} />显示剧情地图</label></div>
    <details><summary>绑定素材与高级设置</summary><div className="tk-form-grid"><label>提示词预设<select aria-label="提示词预设" value={presetRef ? JSON.stringify([presetRef.id,presetRef.version]) : ''} onChange={event => { const choice=presetChoices.find(value => JSON.stringify([value.id,value.version])===event.target.value);setBindings(rows => [...rows.filter(value => !presetIds.has(value.id)), ...(choice ? [{id:choice.id,version:choice.version}] : [])]); }}><option value="">沿用角色卡预设</option>{presetChoices.map(value => <option key={value.id} value={JSON.stringify([value.id,value.version])}>{value.name} · v{value.version}</option>)}</select></label><label>MVU 变量<select aria-label="MVU 变量" value={settings.mvuEnabled===undefined?"auto":settings.mvuEnabled?"on":"off"} onChange={event=>setSettings(value=>({...value,mvuEnabled:event.target.value==="auto"?undefined:event.target.value==="on"}))}><option value="auto">跟随角色内容</option><option value="on">开启</option><option value="off">关闭</option></select></label></div><div className="tk-binding-options">{materials.filter(value => value.kind !== 'persona' && value.kind !== 'preset' && (value.enabled || bindings.some(ref => ref.id === value.id))).map(value => <label className="tk-check tk-chip" key={value.id}><input type="checkbox" checked={bindings.some(ref => ref.id === value.id)} onChange={event => bind(value.id, event.target.checked)} />{value.name}<small>v{bindings.find(ref => ref.id === value.id)?.version ?? value.currentVersion}</small></label>)}</div><div className="tk-form-grid"><label>输出上限<input type="number" min={1} value={settings.controls.maxTokens ?? ''} onChange={event => setSettings({ ...settings, controls: { ...settings.controls, maxTokens: Number(event.target.value) } })} /></label><label>温度<input type="number" step="0.1" value={settings.controls.temperature ?? ''} onChange={event => setSettings({ ...settings, controls: { ...settings.controls, temperature: event.target.value === '' ? undefined : Number(event.target.value) } })} /></label><label>思考强度<input value={settings.controls.reasoningEffort ?? ''} onChange={event => setSettings({ ...settings, controls: { ...settings.controls, reasoningEffort: event.target.value || undefined } })} placeholder="使用连接默认设置" /></label><label>保守输入预算<input type="number" min={256} value={settings.mainRoute?.inputBudget ?? 16384} onChange={event => { if (settings.mainRoute) setSettings({ ...settings, mainRoute: { ...settings.mainRoute, inputBudget: Number(event.target.value) } }); }} /></label><label className="tk-span-all">停止串，每行一项<textarea rows={2} value={settings.controls.stop?.join('\n') ?? ''} onChange={event => setSettings({ ...settings, controls: { ...settings.controls, stop: event.target.value.split('\n').filter(Boolean) } })} /></label></div><h3>这段对话的备用顺序</h3>{settings.fallbacks.map((value, index) => <div className="tk-inline" key={`${index}-${routeKey(value)}`}><span>{index + 1}</span><select aria-label={`备用 ${index + 1}`} value={routeKey(value)} onChange={event => { const next = choices.find(row => routeKey(row) === event.target.value); if (next) setSettings({ ...settings, fallbacks: settings.fallbacks.map((row, i) => i === index ? next : row) }); }}>{choices.map(row => <option value={routeKey(row)} key={routeKey(row)}>{row.label ?? `${row.provider} · ${row.model}`}</option>)}</select><button aria-label={`上移备用 ${index + 1}`} disabled={!index} onClick={() => { const next = settings.fallbacks.slice(); [next[index - 1], next[index]] = [next[index]!, next[index - 1]!]; setSettings({ ...settings, fallbacks: next }); }}>↑</button><button aria-label={`移除备用 ${index + 1}`} onClick={() => setSettings({ ...settings, fallbacks: settings.fallbacks.filter((_, i) => i !== index) })}>移除</button></div>)}<div className="tk-inline"><button disabled={!choices.length} onClick={() => { const next = choices.find(row => routeKey(row) !== (settings.mainRoute && routeKey(settings.mainRoute)) && !settings.fallbacks.some(value => routeKey(value) === routeKey(row))); if (next) setSettings({ ...settings, fallbacks: [...settings.fallbacks, next] }); }}>添加备用模型</button><label className="tk-check"><input type="checkbox" checked={settings.fallbackOnError ?? true} onChange={event => setSettings({ ...settings, fallbackOnError: event.target.checked })} />报错就换备用</label></div>
      <label>仅这些报错触发<span className="tk-muted">每行一项，留空匹配所有报错；也可填写正则。</span><textarea aria-label="仅这些报错触发" rows={3} value={(settings.errorPatterns ?? []).join('\n')} onChange={event => setSettings({ ...settings, errorPatterns: event.target.value.split('\n') })} /></label>
    </details>
    <div className="tk-inline"><button className="tk-primary" disabled={saving || personaPending} onClick={() => { setSaving(true); void api.update(conversation.id, { title, settings: { ...settings, fallbackOnError: settings.fallbackOnError ?? true, errorPatterns: (settings.errorPatterns ?? []).map(value => value.trim()).filter(Boolean) }, bindings }).then(onSaved).catch(onError).finally(() => setSaving(false)); }}>{saving ? '正在保存…' : '保存对话设定'}</button><span className="tk-muted">新设定在下一组回复中使用</span></div>
  </section>;
}
