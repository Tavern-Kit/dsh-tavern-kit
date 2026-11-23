import type { MaterialVersionRef } from '@tavern-kit/rp-materials/types';
import type { CallControls, ResolvedCall, Route } from '@tavern-kit/rp-connections/types';
import type { MvuIssue, MvuState } from './mvu/types.js';
export type { MvuIssue, MvuState } from './mvu/types.js';

export type Id = string;
export type MaterialRef = MaterialVersionRef;
export interface PromptMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface PromptInput { system: string; messages: PromptMessage[] }
export interface Usage { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; cacheWriteTokens?: number; totalTokens?: number; reasoningTokens?: number; cost?: number; currency?: string }
export type CandidateStatus = 'pending' | 'streaming' | 'complete' | 'stopped' | 'failed';
export interface ChatSettings {
  playerName: string;
  playerDescription: string;
  mainRoute?: Route;
  fallbacks: Route[];
  fallbackOn400: boolean;
  fallbackOnError?: boolean;
  errorPatterns?: string[];
  controls: CallControls;
  parallel: boolean;
  parallelCount: number;
  mapEnabled: boolean;
  /** Missing follows recognized MVU material; explicit false disables it. */
  mvuEnabled?: boolean;
}
export const defaultSettings = (): ChatSettings => ({ playerName: '我', playerDescription: '', fallbacks: [], fallbackOn400: true, controls: { maxTokens: 4096 }, parallel: false, parallelCount: 2, mapEnabled: false });
export interface Conversation {
  id: Id; title: string; createdAt: number; updatedAt: number;
  bindings: MaterialRef[]; settings: ChatSettings; settingsRevision: number;
  currentCandidateId?: Id;
  source?: { kind: string; id?: string; fingerprint?: string; archiveId?: string; messageCount?: number; omittedTurns?: number; failedReplies?: number };
}
export interface Turn { id: Id; conversationId: Id; parentCandidateId?: Id; input: string; createdAt: number }
export interface SnapshotOptions {
  playerName?: string;
  playerDescription?: string;
  controls?: CallControls;
  fallbackOn400?: boolean;
  fallbackOnError?: boolean;
  errorPatterns?: string[];
  estimatedTokens?: number;
  inputBudget?: number;
  continuationOf?: Id;
  kind?: string;
}
export interface Snapshot {
  id: Id; conversationId: Id; inputId: Id; boundaryCandidateId?: Id;
  bindings: MaterialRef[]; memoId?: Id; options: SnapshotOptions;
  sources: { label: string; text: string }[]; createdAt: number;
  mvu?: {
    before: MvuState; read: MvuState; templateInputId: Id; issues: MvuIssue[];
    prompt?: { input: string; memo?: { content: string; locked: string[] }; inputBudget: number; triggeredLore: string[] };
  };
}
export interface CandidateGroup {
  id: Id; turnId: Id; conversationId: Id; snapshotId: Id; routes: Route[];
  settingsRevision: number; sourceCandidateId?: Id; continuationPrefix?: string; createdAt: number;
}
export interface Candidate {
  id: Id; conversationId: Id; turnId: Id; groupId: Id; ordinal: number;
  kind: 'generated' | 'edited' | 'continuation'; sourceCandidateId?: Id;
  text: string; status: CandidateStatus; favorite: boolean; createdAt: number;
  imported?: { reasoning?: string; error?: string; status: 'complete' | 'failed' | 'empty' };
  mvu?: { state: MvuState; issues: MvuIssue[]; kind: 'computed' | 'imported' | 'manual'; revisions?: { state: MvuState; at: number }[] };
}
export interface Attempt {
  id: Id; conversationId: Id; turnId: Id; candidateId?: Id; snapshotId: Id;
  kind: 'reply' | 'continuation' | 'summary'; config: ResolvedCall;
  route?: Route; status: CandidateStatus | 'skipped'; output: string; reasoning: string;
  finishReason?: string; error?: { code?: string; status?: number; message: string };
  usage?: Usage; createdAt: number; endedAt?: number;
}
export interface Memo {
  id: Id; conversationId: Id; basedOnCandidateId?: Id; sourceCandidateId?: Id; previousId?: Id;
  kind?: 'manual' | 'automatic'; anchorTurnId?: Id;
  content: string; locked: string[]; createdAt: number;
}
export interface ConversationData {
  conversation: Conversation; turns: Turn[]; groups: CandidateGroup[]; candidates: Candidate[];
  snapshots: Snapshot[]; attempts: Attempt[]; memos: Memo[];
  inputs: { id: Id; system: string; head: Id | null }[];
  messagePrefixes: { id: Id; parent: Id | null; role: PromptMessage['role']; content: string }[];
}
