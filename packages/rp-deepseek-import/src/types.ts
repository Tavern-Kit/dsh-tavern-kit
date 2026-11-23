export type ImportSourceKind = 'deepseek-chat-export' | 'sillytavern-jsonl';
export interface ImportSourceDetails {
  kind?: ImportSourceKind;
  userName?: string;
  characterName?: string;
  candidateCount?: number;
  archivedMessageCount?: number;
  archiveNotes?: string[];
}
export interface PreviewRow extends ImportSourceDetails {
  sourceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  omittedTurns: number;
  failedReplies: number;
  state: 'new' | 'same' | 'changed';
  existingId?: string;
}
export interface PreviewTicket {
  id: string;
  name: string;
  conversations: PreviewRow[];
  failures: { sourceId: string; message: string }[];
}
export interface ImportRequest { previewId: string; sourceIds: string[] }
export interface ImportedSourceResult extends ImportSourceDetails {
  sourceId: string;
  title: string;
  conversationId: string;
  status: 'imported' | 'skipped';
  messageCount: number;
  omittedTurns: number;
  failedReplies: number;
}
export interface ImportResult {
  imported: string[];
  skipped: string[];
  conversations: ImportedSourceResult[];
  failures: { sourceId: string; message: string }[];
}
