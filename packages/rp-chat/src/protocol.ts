import type { MaterialVersion, RegexRule } from '@tavern-kit/rp-materials/types';
import type { Candidate, CandidateGroup, CandidateStatus, Conversation, Memo, PromptInput, Snapshot, Attempt, Turn, Usage, ChatSettings, MaterialRef } from './types.js';
import type { MvuState } from './mvu/types.js';
import type { Route } from '@tavern-kit/rp-connections/types';
export interface CreateInput { title:string; bindings?:MaterialRef[]; settings?:Partial<ChatSettings>; greetingIndex?:number }
export interface UpdateInput { title?:string; bindings?:MaterialRef[]; settings?:Partial<ChatSettings> }
export interface SendInput { conversationId:string; input:string; parentCandidateId?:string }
export interface PageInput { turnId:string; offset?:number; limit?:number; favoritesOnly?:boolean; groupId?:string }
export interface RouteInput { conversationId:string; offset?:number; limit?:number }
export interface DisplayProjection {
  variables?:MvuState;
  inputVariables?:MvuState;
  playerRef?: MaterialRef;
  /** Later rendered messages on this reading route; its last output is depth zero. */
  depth?: number;
  /** The corresponding player input, when nonempty, sits one message before the output. */
  inputDepth?: number;
  rules: RegexRule[];
  context: { char:string; user:string; description?:string; personality?:string; scenario?:string; persona?:string };
}
export interface CandidateFailure {
  attemptId:string; provider:string; model:string; label?:string; group?:string;
  status:'failed'|'skipped'; code?:string; httpStatus?:number; message:string;
}
export interface CandidateView { candidate:Candidate; text:string; route?:Route; display?:DisplayProjection; failures?:CandidateFailure[] }
export interface CandidatePage { items:Candidate[]; total:number }
export interface RouteRow { turn:Turn; candidate:Candidate; text:string; display?:DisplayProjection }
export interface RoutePage { items:RouteRow[]; total:number }
export interface CandidateDetail { candidate:Candidate; text:string; attempts:Attempt[]; snapshot:Snapshot; input:PromptInput; materials:MaterialVersion[] }
export interface ChatState { conversation:Conversation; route:RoutePage; pending:Candidate[]; memo?:Memo }
export interface TurnSummary { id:string; parentTurnId?:string; input:string; candidates:number; previewCandidateId?:string }
export interface TurnUsage { requestCount:number; knownRequestCount:number; inputTokens:number; outputTokens:number; cachedInputTokens:number; unknownRequests:number; summaryRequests:number; continuationRequests:number }
export interface ChatChange { conversationId:string; type:'candidate'|'group'|'memo'|'route'; candidateId?:string; groupId?:string; delta?:string }
export interface SearchInput { query:string; conversationId?:string; offset?:number; limit?:number }
export interface SearchHit {
  conversationId:string; conversationTitle:string; turnId:string; candidateId?:string;
  role:'user'|'assistant'; ordinal?:number; excerpt:string; createdAt:number;
}
export interface SearchPage { items:SearchHit[]; total:number }
export interface SearchPreview {
  conversationId:string; conversationTitle:string; turnId:string; input:string;
  candidateId?:string; reply?:string; ordinal?:number; status?:CandidateStatus;
}
export interface ImportedReply { reply:string; reasoning:string; status:'complete'|'failed'|'empty'; error?:string; mvu?:MvuState }
export interface ImportedTurn extends ImportedReply { input:string; replies?:ImportedReply[]; selectedReplyIndex?:number }
export interface ImportedConversation { sourceId:string; fingerprint:string; title:string; createdAt:number; updatedAt:number; turns:ImportedTurn[]; messageCount?:number; omittedTurns?:number; failedReplies?:number; kind?:'deepseek-chat-export'|'sillytavern-jsonl' }
export interface SourceMatch { id:string; sourceId:string; fingerprint:string }
