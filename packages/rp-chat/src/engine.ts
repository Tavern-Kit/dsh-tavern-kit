import type { MaterialVersion } from '@tavern-kit/rp-materials/types';
import type { CallControls, ResolvedCall, Route } from '@tavern-kit/rp-connections/types';
import { isFallbackFailure } from '@tavern-kit/rp-connections/routing';
import { assemblePrompt, estimateInput, estimateTokens, macros, projectText } from './prompt.js';
import { ConversationStore } from './store.js';
import { initializeMvu, updateMvu } from './mvu/index.js';
import { isMvuEnabled, mvuBooks } from './mvu-materials.js';
import type { Attempt, CandidateGroup, Conversation, MaterialRef, Memo, MvuState, PromptInput, PromptMessage, Snapshot, Turn, Usage } from './types.js';

export type ReplyChunk = { type: 'text'; text: string } | { type: 'reasoning'; text: string } | { type: 'usage'; usage: Usage } | { type: 'finish'; reason: string; error?: Attempt['error'] };
export interface LlmGateway {
  prepare(config: ResolvedCall, signal: AbortSignal): Promise<{ config: ResolvedCall; stream(input: PromptInput): AsyncIterable<ReplyChunk> }>;
}
export interface ChatEvent { conversationId: string; type: 'candidate' | 'group' | 'memo' | 'route'; candidateId?: string; groupId?: string; delta?: string }
interface Running { controller: AbortController; promise: Promise<void>; groupId: string; conversationId: string }
function errorInfo(error: unknown): NonNullable<Attempt['error']> {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  return { message: error instanceof Error ? error.message : String(error), status: typeof value.status === 'number' ? value.status : typeof value.statusCode === 'number' ? value.statusCode : undefined, code: typeof value.code === 'string' ? value.code : undefined };
}
export function inputBudget(route: Route, controls: CallControls): number {
  const output = Math.min(controls.maxTokens ?? 4096, route.outputLimit ?? Infinity);
  return Math.max(0, Math.min(route.inputBudget, route.contextWindow === undefined ? Infinity : route.contextWindow - output));
}
function resolveControls(route: Route, controls: CallControls): ResolvedCall {
  return {
    provider: route.provider, model: route.model,
    maxTokens: Math.min(controls.maxTokens ?? 4096, route.outputLimit ?? Infinity),
    ...(route.parameters?.temperature && controls.temperature !== undefined ? { temperature: controls.temperature } : {}),
    ...(route.parameters?.stop && controls.stop ? { stop: controls.stop } : {}),
    ...(route.parameters?.reasoning && controls.reasoningEffort ? { reasoningEffort: controls.reasoningEffort } : {}),
  };
}

function variableExpander(materials: MaterialVersion[], playerName: string, playerDescription: string, mvu?: MvuState): (text: string) => string {
  const character = materials.map(material => material.projection.character).find(value => value !== null);
  const context = { char: character?.name || '角色', user: playerName || '我', description: character?.description, personality: character?.personality, scenario: character?.scenario, persona: playerDescription, mvu };
  return text => macros(text, context);
}

/** Host-owned streams; UI observers do not own or cancel paid work. */
export class ChatEngine {
  private readonly running = new Map<string, Running>();
  private readonly listeners = new Map<string, Set<(event: ChatEvent) => void>>();
  private readonly preparing = new Map<string, Promise<CandidateGroup>>();
  private readonly selectionRevisions = new Map<string, number>();
  private readonly lifetime = new AbortController();
  private disposed = false;
  constructor(readonly store: ConversationStore, private readonly llm: LlmGateway, private readonly loadMaterials: (refs: MaterialRef[]) => MaterialVersion[], private readonly resolve: (route: Route, controls: CallControls) => ResolvedCall | Promise<ResolvedCall> = resolveControls) {}
  subscribe(conversationId: string, listener: (event: ChatEvent) => void): () => void {
    const set = this.listeners.get(conversationId) ?? new Set(); set.add(listener); this.listeners.set(conversationId, set);
    return () => { set.delete(listener); if (!set.size) this.listeners.delete(conversationId); };
  }
  private emit(event: ChatEvent): void { for (const listener of this.listeners.get(event.conversationId) ?? []) listener(event); }
  private assertActive(): void { if (this.disposed) throw new Error('聊天插件已停止'); }
  private assertReady(conversation: Conversation): Route {
    this.assertActive();
    if (!conversation.settings.mainRoute) throw new Error('先连接模型，再接着聊');
    return conversation.settings.mainRoute;
  }
  async send(conversationId: string, input: string, parentCandidateId?: string): Promise<CandidateGroup> {
    const conversation = this.store.getConversation(conversationId); this.assertReady(conversation);
    const parent = parentCandidateId ?? conversation.currentCandidateId;
    if (parent) this.select(parent);
    const turn = this.store.createTurn(conversationId, { input, parentCandidateId: parent });
    return this.roll(turn.id);
  }
  async editInput(turnId: string, input: string): Promise<CandidateGroup> {
    const turn = this.store.getTurn(turnId);
    const next = this.store.createTurn(turn.conversationId, { input, parentCandidateId: turn.parentCandidateId });
    return this.roll(next.id);
  }
  async roll(turnId: string, single = false): Promise<CandidateGroup> {
    const turn = this.store.getTurn(turnId), conversation = this.store.getConversation(turn.conversationId);
    this.assertReady(conversation);
    const selectionRevision = this.selectionRevisions.get(conversation.id) ?? 0;
    let preparation = this.preparing.get(turnId);
    if (!preparation) {
      preparation = this.prepareGroup(turn, conversation); this.preparing.set(turnId, preparation);
      void preparation.finally(() => this.preparing.delete(turnId)).catch(() => {});
    }
    const group = await preparation;
    this.assertActive();
    const count = single || !conversation.settings.parallel ? 1 : Math.max(1, Math.floor(conversation.settings.parallelCount));
    this.launch(group, count, 'generated', undefined, count === 1 && (this.selectionRevisions.get(conversation.id) ?? 0) === selectionRevision);
    return group;
  }
  private async prepareGroup(turn: Turn, conversation: Conversation): Promise<CandidateGroup> {
    let memo = this.store.applicableMemo(conversation.id, turn.parentCandidateId ?? null, turn.id);
    const old = this.store.groupsForTurn(turn.id).filter(g => !g.sourceCandidateId).at(-1);
    const previous = old?.settingsRevision === conversation.settingsRevision ? this.store.getSnapshot(old.snapshotId) : undefined;
    const parentState = turn.parentCandidateId ? this.store.getCandidate(turn.parentCandidateId).mvu?.state : undefined;
    if (old && previous && previous.memoId === memo?.id && !previous.mvu && !parentState) return old;
    const route = this.assertReady(conversation), settings = conversation.settings;
    const materials = this.loadMaterials(conversation.bindings);
    const controls = { ...materials.map(m => m.projection.preset?.sampling).find(Boolean), ...settings.controls };
    const budget = inputBudget(route, controls);
    const expandInitialization = variableExpander(materials, settings.playerName, settings.playerDescription, parentState);
    let mvu = settings.mvuEnabled !== false && (parentState !== undefined || previous?.mvu !== undefined || isMvuEnabled(materials, settings.mvuEnabled, turn.input))
      ? initializeMvu(mvuBooks(materials), undefined, parentState, expandInitialization) : undefined;
    if (old && previous && previous.memoId === memo?.id && JSON.stringify(previous.mvu?.before) === JSON.stringify(mvu?.state)) return old;
    const routeRows = this.store.route(conversation.id, turn.parentCandidateId ?? null);
    if (!mvu && settings.mvuEnabled !== false && isMvuEnabled(materials, settings.mvuEnabled, routeRows.flatMap(row => [row.turn.input, row.candidate.text]).join('\n'))) mvu = initializeMvu(mvuBooks(materials), undefined, parentState, expandInitialization);
    const sourceMessages = routeRows.map(row => {
      const messages: PromptMessage[] = [{ role: 'user', content: row.turn.input }, { role: 'assistant', content: row.candidate.text }];
      return messages.filter(message => message.content !== '');
    });
    const historyFor = (memory: Memo | undefined): PromptMessage[] => {
      const boundary = memory?.basedOnCandidateId ? routeRows.findIndex(r => r.candidate.id === memory.basedOnCandidateId) + 1 : 0;
      return sourceMessages.slice(boundary).flat();
    };
    const assemble = () => assemblePrompt({ materials, playerName: settings.playerName, playerDescription: settings.playerDescription, history: historyFor(memo), input: turn.input, memo, inputBudget: budget, mvu: mvu?.state });
    let assembled = assemble();
    if (assembled.estimatedTokens > budget * 0.9 && routeRows.length > 2) {
      const cutoff = Math.max(0, routeRows.length - 3);
      const start = memo?.basedOnCandidateId ? routeRows.findIndex(r => r.candidate.id === memo!.basedOnCandidateId) + 1 : 0;
      if (cutoff > start) {
        const character = materials.map(material => material.projection.character).find(value => value !== null);
        const context = { char: character?.name || '角色', user: settings.playerName || '我', description: character?.description, personality: character?.personality, scenario: character?.scenario, persona: settings.playerDescription, mvu: mvu?.state };
        const sourceDepths = sourceMessages.map(() => ({ input: 0, output: 0 }));
        let messageDepth = turn.input === '' ? 0 : 1;
        for (let rowIndex = sourceMessages.length - 1; rowIndex >= 0; rowIndex--) {
          for (const message of sourceMessages[rowIndex]!.slice().reverse()) {
            sourceDepths[rowIndex]![message.role === 'user' ? 'input' : 'output'] = messageDepth++;
          }
        }
        let index = start;
        while (index < cutoff) {
          const batch: { candidateId: string; input: string; reply: string }[] = [];
          let size = estimateTokens(macros(memo?.content ?? '', context)) + 256;
          while (index < cutoff) {
            const row = routeRows[index]!, depths = sourceDepths[index]!;
            const projected = {
              candidateId: row.candidate.id,
              input: row.turn.input === '' ? '' : projectText(macros(row.turn.input, context), materials, 'input', context, { depth: depths.input }),
              reply: row.candidate.text === '' ? '' : projectText(macros(row.candidate.text, context), materials, 'output', context, { depth: depths.output }),
            };
            const next = estimateTokens(projected.input) + estimateTokens(projected.reply) + 16;
            if (size + next > budget * 0.65 && batch.length) break;
            if (size + next > budget * 0.85) throw new Error('这段内容超过当前整理预算，到连接设置增加上下文预算后再继续');
            batch.push(projected); size += next; index++;
          }
          const summaryInput: PromptInput = {
            system: '用自然中文整理角色对话的剧情备忘。保留人物身份和称呼、关系进展、共同经历、重要约定、待办事件、叙事风格与玩家固定要求。确认的事实和推测分开写。只记录给定路线的内容，不编造经历。保留玩家锁定条目。直接输出备忘正文。',
            messages: [{ role: 'user', content: [memo ? macros(`已有备忘：\n${memo.content}\n锁定：\n${memo.locked.join('\n')}`, context) : '', ...batch.map(row => [row.input ? `玩家：${row.input}` : '', row.reply ? `角色：${row.reply}` : ''].filter(Boolean).join('\n'))].filter(Boolean).join('\n\n') }],
          };
          const snapshot = this.store.createSnapshot(conversation.id, { ...summaryInput, bindings: conversation.bindings, options: { kind: 'summary' }, boundaryCandidateId: batch.at(-1)!.candidateId, memoId: memo?.id });
          const output = await this.summary(turn, snapshot, route, { ...controls, maxTokens: Math.min(2048, controls.maxTokens ?? 2048) });
          this.assertActive();
          memo = this.store.saveMemo(conversation.id, { kind: 'automatic', anchorTurnId: memo?.anchorTurnId, sourceCandidateId: batch.at(-1)!.candidateId, basedOnCandidateId: batch.at(-1)!.candidateId, previousId: memo?.id, content: output, locked: memo?.locked ?? [] });
          this.emit({ conversationId: conversation.id, type: 'memo' });
        }
        assembled = assemble();
      }
    }
    if (assembled.estimatedTokens > budget) throw new Error('角色设定和最近内容超过当前输入预算，到连接设置增加预算，或调整本轮设定');
    const snapshot = this.store.createSnapshot(conversation.id, {
      system: assembled.system, messages: assembled.messages, bindings: conversation.bindings, memoId: memo?.id, boundaryCandidateId: turn.parentCandidateId, sources: assembled.sources,
      options: { controls, fallbackOn400: settings.fallbackOn400, fallbackOnError: settings.fallbackOnError ?? true, errorPatterns: [...settings.errorPatterns ?? []], estimatedTokens: assembled.estimatedTokens, inputBudget: budget, playerName: settings.playerName, playerDescription: settings.playerDescription },
      ...(mvu ? { mvu: { before: mvu.state, read: mvu.state, issues: mvu.issues, template: { system: '', messages: historyFor(memo) }, prompt: { input: turn.input, memo: memo ? { content: memo.content, locked: memo.locked } : undefined, inputBudget: budget, triggeredLore: assembled.triggeredLore } } } : {}),
    });
    return this.store.createGroup(turn.id, { snapshotId: snapshot.id, routes: [route, ...settings.fallbacks], settingsRevision: conversation.settingsRevision });
  }
  private launch(group: CandidateGroup, count: number, kind: 'generated' | 'continuation', sourceCandidateId?: string, autoSelect = false): void {
    this.assertActive();
    const snapshot = this.store.getSnapshot(group.snapshotId);
    for (let i = 0; i < count; i++) {
      const candidate = this.store.createCandidate(group.id, { kind, sourceCandidateId, ...(snapshot.mvu ? { mvu: { state: snapshot.mvu.before, issues: snapshot.mvu.issues, kind: 'computed' } } : {}) });
      const controller = new AbortController();
      const promise = this.runCandidate(group, candidate.id, controller.signal, autoSelect).finally(() => { this.running.delete(candidate.id); });
      this.running.set(candidate.id, { controller, promise, groupId: group.id, conversationId: group.conversationId });
    }
    this.emit({ conversationId: group.conversationId, type: 'group', groupId: group.id });
  }
  async waitForGroup(groupId: string): Promise<void> {
    await Promise.all([...this.running.values()].filter(row => row.groupId === groupId).map(row => row.promise));
  }
  stopCandidate(candidateId: string): void { this.running.get(candidateId)?.controller.abort(); }
  stopGroup(groupId: string): void { for (const row of this.running.values()) if (row.groupId === groupId) row.controller.abort(); }
  select(candidateId: string): void {
    const candidate = this.store.getCandidate(candidateId);
    if (candidate.status === 'pending' || candidate.status === 'streaming') throw new Error('这条还在生成，可以先停止或等它写完');
    this.stopGroup(candidate.groupId);
    this.selectionRevisions.set(candidate.conversationId, (this.selectionRevisions.get(candidate.conversationId) ?? 0) + 1);
    this.store.selectCandidate(candidateId); this.emit({ conversationId: candidate.conversationId, type: 'route', candidateId });
  }
  editCandidate(candidateId: string, text: string): ReturnType<ConversationStore['editCandidate']> { return this.store.editCandidate(candidateId, text); }
  editMemo(conversationId: string, content: string, locked: string[]): Memo {
    this.assertActive();
    const conversation = this.store.getConversation(conversationId), old = this.store.applicableMemo(conversationId);
    const anchorTurnId = conversation.currentCandidateId ? this.store.getCandidate(conversation.currentCandidateId).turnId : undefined;
    const memo = this.store.saveMemo(conversationId, { kind: 'manual', anchorTurnId, sourceCandidateId: conversation.currentCandidateId, basedOnCandidateId: old?.basedOnCandidateId, previousId: old?.id, content, locked });
    this.store.updateConversation(conversationId, {}); this.emit({ conversationId, type: 'memo' }); return memo;
  }
  async continueCandidate(candidateId: string): Promise<CandidateGroup> {
    this.assertActive();
    const candidate = this.store.getCandidate(candidateId);
    if (candidate.status === 'pending' || candidate.status === 'streaming') throw new Error('先停止这条，再继续写');
    let sourceGroup = this.store.getGroup(candidate.groupId);
    const route = this.store.actualRoute(candidateId);
    if (!route) throw new Error('这条没有可续写的实际模型，选好模型后换个回复');
    // Each continuation snapshot already contains a prefix. Reuse the original
    // request, then derive the current whole prefix once from preserved raw text.
    while (sourceGroup.sourceCandidateId) sourceGroup = this.store.getGroup(this.store.getCandidate(sourceGroup.sourceCandidateId).groupId);
    const sourceSnapshot = this.store.getSnapshot(sourceGroup.snapshotId);
    const prefix = this.store.candidateText(candidateId);
    const materials = this.loadMaterials(sourceSnapshot.bindings);
    const character = materials.map(material => material.projection.character).find(value => value !== null);
    const read = sourceSnapshot.mvu ? candidate.mvu?.state ?? sourceSnapshot.mvu.read : undefined;
    const context = {
      char: character?.name || '角色',
      user: typeof sourceSnapshot.options.playerName === 'string' ? sourceSnapshot.options.playerName : '我',
      description: character?.description, personality: character?.personality, scenario: character?.scenario,
      persona: typeof sourceSnapshot.options.playerDescription === 'string' ? sourceSnapshot.options.playerDescription : '',
      mvu: read,
    };
    const template = sourceSnapshot.mvu ? this.store.readInput(sourceSnapshot.mvu.templateInputId) : undefined;
    const seed = sourceSnapshot.mvu?.prompt;
    const rebuilt = seed && template ? assemblePrompt({
      materials, playerName: context.user, playerDescription: context.persona,
      history: template.messages, input: seed.input, memo: seed.memo, inputBudget: seed.inputBudget,
      mvu: read, frozenLore: seed.triggeredLore,
    }) : undefined;
    const original = rebuilt ?? this.store.inputForSnapshot(sourceSnapshot.id);
    const projected = projectText(macros(prefix, context), materials, 'output', context, { depth: -1 });
    const input: PromptInput = { system: original.system, messages: [...original.messages, { role: 'assistant', content: projected }] };
    const controls = sourceSnapshot.options.controls ?? {};
    if (estimateInput(input) > inputBudget(route, controls)) throw new Error('原模型的容量放不下这条续写，当前正文已保留，可调整连接后换个回复');
    const snapshot = this.store.createSnapshot(candidate.conversationId, {
      ...input, bindings: sourceSnapshot.bindings, memoId: sourceSnapshot.memoId, boundaryCandidateId: sourceSnapshot.boundaryCandidateId,
      sources: rebuilt?.sources ?? sourceSnapshot.sources, options: { ...sourceSnapshot.options, estimatedTokens: estimateInput(input), continuationOf: candidateId },
      ...(sourceSnapshot.mvu && template && read ? { mvu: { before: sourceSnapshot.mvu.before, read, issues: sourceSnapshot.mvu.issues, template, prompt: seed } } : {}),
    });
    const group = this.store.createGroup(candidate.turnId, { snapshotId: snapshot.id, routes: [route], settingsRevision: sourceGroup.settingsRevision, sourceCandidateId: candidateId, continuationPrefix: prefix });
    this.launch(group, 1, 'continuation', candidateId, false); return group;
  }
  private async summary(turn: Turn, snapshot: Snapshot, route: Route, controls: CallControls): Promise<string> {
    const signal = this.lifetime.signal;
    signal.throwIfAborted();
    const config = await this.resolve(route, controls);
    signal.throwIfAborted();
    const prepared = await this.llm.prepare(config, signal);
    signal.throwIfAborted();
    const attempt = this.store.createAttempt({ turnId: turn.id, snapshotId: snapshot.id, kind: 'summary', config: prepared.config, route });
    let output = '', usage: Usage | undefined;
    try {
      let reason = 'error';
      for await (const chunk of prepared.stream(this.store.inputForSnapshot(snapshot.id))) {
        signal.throwIfAborted();
        if (chunk.type === 'text') { output += chunk.text; this.store.appendAttemptDelta(attempt.id, chunk.text); }
        if (chunk.type === 'reasoning') this.store.appendAttemptDelta(attempt.id, '', chunk.text);
        if (chunk.type === 'usage') usage = chunk.usage;
        if (chunk.type === 'finish') { reason = chunk.reason; if (chunk.error) throw Object.assign(new Error(chunk.error.message), chunk.error); }
      }
      signal.throwIfAborted();
      if (!output || reason === 'error' || reason === 'aborted') throw new Error('剧情整理没有完成，已有对话保留，稍后可重新整理');
      this.store.finishAttempt(attempt.id, { status: 'complete', finishReason: reason, usage }); return output;
    } catch (error) { this.store.finishAttempt(attempt.id, { status: signal.aborted ? 'stopped' : 'failed', finishReason: signal.aborted ? 'aborted' : 'error', error: errorInfo(error), usage }); throw error; }
  }
  private async runCandidate(group: CandidateGroup, candidateId: string, signal: AbortSignal, autoSelect: boolean): Promise<void> {
    const snapshot = this.store.getSnapshot(group.snapshotId), input = this.store.inputForSnapshot(snapshot.id);
    const selectionRevision = this.selectionRevisions.get(group.conversationId) ?? 0;
    const controls = snapshot.options.controls ?? {};
    const kind = group.sourceCandidateId ? 'continuation' : 'reply';
    const visited = new Set<string>();
    for (const route of group.routes) {
      if (signal.aborted) break;
      const identity = JSON.stringify([route.provider, route.model]);
      if (visited.has(identity)) continue;
      visited.add(identity);
      if (estimateInput(input) > inputBudget(route, controls)) {
        const skipped = this.store.createAttempt({ turnId: group.turnId, candidateId, snapshotId: snapshot.id, kind, config: { provider: route.provider, model: route.model }, route });
        this.store.finishAttempt(skipped.id, { status: 'skipped', error: { code: 'INPUT_BUDGET', message: '容量放不下本组固定内容，已跳过' } }); continue;
      }
      let attempt: Attempt | undefined, usage: Usage | undefined, reason = 'error', failure: Attempt['error'];
      try {
        const config = await this.resolve(route, controls);
        signal.throwIfAborted();
        const prepared = await this.llm.prepare(config, signal);
        signal.throwIfAborted();
        attempt = this.store.createAttempt({ turnId: group.turnId, candidateId, snapshotId: snapshot.id, kind, config: prepared.config, route });
        for await (const chunk of prepared.stream(input)) {
          if (signal.aborted) break;
          if (chunk.type === 'text') {
            this.store.appendAttemptDelta(attempt.id, chunk.text);
            this.emit({ conversationId: group.conversationId, type: 'candidate', candidateId, delta: chunk.text });
          } else if (chunk.type === 'reasoning') this.store.appendAttemptDelta(attempt.id, '', chunk.text);
          else if (chunk.type === 'usage') usage = chunk.usage;
          else { reason = chunk.reason; failure = chunk.error; }
        }
        if (reason === 'error') failure ??= { code: 'STREAM_ERROR', message: '服务没有完成这条回复' };
      } catch (error) {
        failure = errorInfo(error);
        if (error instanceof Error && error.name === 'AbortError') reason = 'aborted';
      }
      const stopped = signal.aborted || reason === 'aborted' || failure?.code === 'ABORTED';
      if (!attempt) {
        // Configuration resolution did not dispatch a request. Keep a visible skipped fact.
        attempt = this.store.createAttempt({ turnId: group.turnId, candidateId, snapshotId: snapshot.id, kind, config: { provider: route.provider, model: route.model }, route });
        this.store.finishAttempt(attempt.id, { status: 'skipped', error: failure });
      } else this.store.finishAttempt(attempt.id, { status: stopped ? 'stopped' : failure ? 'failed' : 'complete', finishReason: reason, error: failure, usage });
      const partial = this.store.getCandidate(candidateId).text.length > 0;
      if (!stopped && !failure) {
        if (snapshot.mvu && reason === 'stop') {
          const expand = variableExpander(this.loadMaterials(snapshot.bindings), snapshot.options.playerName ?? '我', snapshot.options.playerDescription ?? '', snapshot.mvu.read);
          const updated = updateMvu(this.store.candidateText(candidateId), snapshot.mvu.before, expand);
          this.store.setCandidateMvu(candidateId, { state: updated.state, issues: [...snapshot.mvu.issues, ...updated.issues], kind: 'computed' });
        }
        this.store.setCandidateStatus(candidateId, 'complete');
        if (autoSelect && (this.selectionRevisions.get(group.conversationId) ?? 0) === selectionRevision) this.store.selectCandidate(candidateId);
        this.emit({ conversationId: group.conversationId, type: 'candidate', candidateId }); return;
      }
      if (stopped || partial || !isFallbackFailure(failure, snapshot.options.fallbackOnError ?? true, snapshot.options.errorPatterns ?? [])) {
        this.store.setCandidateStatus(candidateId, stopped ? 'stopped' : 'failed');
        this.emit({ conversationId: group.conversationId, type: 'candidate', candidateId }); return;
      }
    }
    this.store.setCandidateStatus(candidateId, signal.aborted ? 'stopped' : 'failed');
    this.emit({ conversationId: group.conversationId, type: 'candidate', candidateId });
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    this.lifetime.abort();
    for (const row of this.running.values()) row.controller.abort();
    await Promise.allSettled([...this.preparing.values(), ...[...this.running.values()].map(row => row.promise)]);
    this.listeners.clear();
    this.selectionRevisions.clear();
  }
}
