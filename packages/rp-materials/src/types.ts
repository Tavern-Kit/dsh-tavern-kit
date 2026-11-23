export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject { [key: string]: JsonValue }

export const MATERIAL_KINDS = ['character', 'persona', 'worldbook', 'preset', 'regex', 'quick_reply', 'theme', 'extension', 'script'] as const;
export type MaterialKind = typeof MATERIAL_KINDS[number];
export type MaterialFormat = 'json' | 'png' | 'charx' | 'zip' | 'script';

export interface MaterialVersionRef { id: string; version: number }
export interface MaterialBindings {
  worldbooks: MaterialVersionRef[];
  preset: MaterialVersionRef | null;
}

export interface MaterialResource {
  /** The literal local archive path, or ccdefault: for a PNG cover. Never a remote URL. */
  path: string;
  mediaType: string;
  bytes: Uint8Array;
}
export interface MaterialCapability {
  path: string;
  label: string;
  status: 'used' | 'archived';
  reason?: string;
}
export interface PersonaProjection {
  name: string;
  description: string;
  /** A version-owned local resource; never an image submitted to the model. */
  avatarPath?: string;
}
export interface PersonaAvatar {
  name: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp';
  base64: string;
}
export interface PersonaDraft {
  name: string;
  description: string;
  /** Omit to retain the image, null to remove it. */
  avatar?: PersonaAvatar | null;
}
export interface CharacterProjection {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];
  messageExamples: string;
  systemPrompt: string;
  postHistoryInstructions: string;
  creatorNotes: string;
  tags: string[];
}
export type LorePosition = 'before' | 'after' | 'depth';
export interface LoreEntry {
  id: string;
  name: string;
  content: string;
  keys: string[];
  secondaryKeys: string[];
  selective: boolean;
  selectiveLogic: 0 | 1 | 2 | 3;
  constant: boolean;
  enabled: boolean;
  caseSensitive: boolean;
  wholeWords: boolean;
  scanDepth: number | null;
  order: number;
  position: LorePosition;
  depth: number;
  role: 'system' | 'user' | 'assistant';
  sourcePath: string;
}
export interface WorldbookProjection {
  name: string;
  entries: LoreEntry[];
  scanDepth: number | null;
  budget: number | null;
  recursive: false;
}
export interface PromptEntry {
  identifier: string;
  name: string;
  enabled: boolean;
  role: 'system' | 'user' | 'assistant';
  content: string;
  marker: boolean;
  /** Missing on older projections: character-card main/post overrides remain allowed. */
  forbidOverrides?: boolean;
  position: 'relative' | 'depth';
  depth: number;
  order: number;
  sourcePath: string;
}
export interface SamplingProjection {
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  stop?: string[];
}
export interface PresetProjection {
  prompts: PromptEntry[];
  sampling: SamplingProjection;
}
export interface RegexRule {
  id: string;
  name: string;
  findRegex: string;
  replaceString: string;
  trimStrings: string[];
  placements: ('input' | 'output' | 'worldbook' | 'reasoning')[];
  /** displayOnly never changes model-visible text. */
  displayOnly: boolean;
  promptOnly: boolean;
  disabled: boolean;
  runOnEdit: boolean;
  minDepth: number | null;
  maxDepth: number | null;
  substituteRegex: number;
  sourcePath: string;
}
export interface QuickReply {
  id: string;
  label: string;
  message: string;
  enabled: boolean;
  sourcePath: string;
}
export interface MaterialProjection {
  kind: MaterialKind;
  name: string;
  /** Optional on older stored projections and backups. */
  persona?: PersonaProjection;
  character: CharacterProjection | null;
  worldbook: WorldbookProjection | null;
  preset: PresetProjection | null;
  regex: RegexRule[];
  quickReplies: QuickReply[];
}
export interface MaterialInput {
  name: string;
  bytes: Uint8Array;
  /** For archived configuration JSON whose shape is not self-identifying. */
  kind?: MaterialKind;
}
export interface DecodedMaterial {
  fileName: string;
  format: MaterialFormat;
  contentHash: string;
  originalBytes: Uint8Array;
  rawText: string;
  raw: JsonValue;
  projection: MaterialProjection;
  capabilities: MaterialCapability[];
  resources: MaterialResource[];
}
export interface MaterialSummary {
  id: string;
  name: string;
  kind: MaterialKind;
  category: string;
  tags: string[];
  enabled: boolean;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface MaterialVersion extends MaterialVersionRef {
  originalId: string;
  createdAt: string;
  raw: JsonValue;
  projection: MaterialProjection;
  capabilities: MaterialCapability[];
  bindings: MaterialBindings;
}
export interface MaterialRecord extends MaterialSummary {
  current: MaterialVersion;
}
export interface MaterialQuery {
  search?: string;
  kind?: MaterialKind;
  category?: string;
  enabled?: boolean;
  tag?: string;
  offset?: number;
  limit?: number;
}
export interface MaterialMetadata {
  name?: string;
  category?: string;
  tags?: string[];
  enabled?: boolean;
}
export interface MaterialRevision {
  /** Full raw-document editor. When omitted, retain the previous document. */
  raw?: JsonValue;
  /** A field editor can patch nested objects while retaining unknown fields. Arrays replace deliberately. */
  patch?: JsonObject;
  bindings?: MaterialBindings;
}
export interface FileResult { name: string; mediaType: string; base64: string }
export interface MaterialExport {
  name: string;
  mediaType: string;
  bytes: Uint8Array;
}
export interface PortableResource { path: string; mediaType: string; base64: string }
export interface PortableOriginal {
  id: string;
  fileName: string;
  format: MaterialFormat;
  contentHash: string;
  base64: string;
  resources: PortableResource[];
}
export interface PortableMaterial {
  metadata: MaterialSummary;
  versions: MaterialVersion[];
}
export interface MaterialBundle {
  format: 'tavern-kit.materials';
  version: 1;
  materials: PortableMaterial[];
  originals: PortableOriginal[];
}
export interface MaterialBundleRestore {
  references: { from: MaterialVersionRef; to: MaterialVersionRef }[];
}
