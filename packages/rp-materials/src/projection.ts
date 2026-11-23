// Adapted format identification and normalization, modified 2026-11-17.
// SPDX-License-Identifier: AGPL-3.0-only
// Prompt/depth and regex field semantics checked against SillyTavern (AGPL-3.0).
import { MaterialError, object, text, number, optionalNumber, strings } from './json.js';
import { readPersona } from './persona.js';
import type {
  JsonValue, JsonObject, MaterialKind, MaterialProjection, MaterialCapability,
  CharacterProjection, LoreEntry, WorldbookProjection, PresetProjection,
  PromptEntry, SamplingProjection, RegexRule, QuickReply,
} from './types.js';

const characterFields = ['name', 'description', 'personality', 'scenario', 'first_mes', 'alternate_greetings', 'mes_example', 'system_prompt', 'post_history_instructions', 'character_book', 'creator_notes', 'extensions', 'tags', 'assets', 'creator', 'character_version', 'nickname'];
export function characterData(raw: JsonValue): JsonObject {
  const root = object(raw);
  const result: JsonObject = { ...object(root.data) };
  for (const field of characterFields) if (result[field] === undefined && root[field] !== undefined) result[field] = root[field]!;
  for (const [legacy, current] of Object.entries({ char_name: 'name', char_persona: 'description', world_scenario: 'scenario', char_greeting: 'first_mes', example_dialogue: 'mes_example' })) {
    if (result[current] === undefined && root[legacy] !== undefined) result[current] = root[legacy]!;
  }
  return result;
}
const has = (root: JsonObject, fields: string[]) => fields.some(field => root[field] !== undefined);
const isRegex = (value: JsonValue) => has(object(value), ['findRegex']) || has(object(value), ['substituteRegex']) && has(object(value), ['replaceString']);

export function classifyMaterial(raw: JsonValue, hint?: MaterialKind): MaterialKind {
  const root = object(raw);
  const data = characterData(raw);
  if (root.format === 'tavern-kit.persona') { readPersona(raw); return 'persona'; }
  if (/^chara_card_v[23]$/u.test(text(root.spec))) return 'character';
  if (/^chara_card_/u.test(text(root.spec))) throw new MaterialError('CARD_VERSION', '此角色卡版本尚未支持');
  if (Array.isArray(raw) && raw.every(isRegex)) return 'regex';
  if (Array.isArray(root.__content__) && root.__content__.every(isRegex)) return 'regex';
  if (isRegex(raw)) return 'regex';
  if (Array.isArray(root.prompts)) return 'preset';
  if (Array.isArray(root.qrList) || Array.isArray(root.quickReplySlots)) return 'quick_reply';
  if (typeof root.message === 'string' && has(root, ['executeOnAi', 'executeOnUser', 'preventAutoExecute'])) return 'quick_reply';
  if (typeof data.name === 'string' && has(data, ['first_mes', 'personality', 'scenario', 'mes_example', 'alternate_greetings', 'character_book'])) return 'character';
  if (root.entries && typeof root.entries === 'object' || object(root.data).entries && typeof object(root.data).entries === 'object') return 'worldbook';
  if (typeof root.content === 'string' && (root.type === 'script' || has(root, ['button', 'buttons']))) return 'script';
  if (['main_text_color', 'chat_tint_color', 'blur_tint_color', 'custom_css'].filter(key => key in root).length >= 2) return 'theme';
  if (Array.isArray(root.rules) && has(root, ['chainRules', 'renderLimit'])) return 'theme';
  if (['temperature', 'top_p', 'top_k', 'min_p', 'repetition_penalty'].filter(key => key in root).length >= 3) return 'preset';
  if (has(root, ['noass', 'macros', 'promptPresets', 'promptSections', 'tables', 'cgGroups', 'extension_settings'])) return 'extension';
  if (typeof data.name === 'string' && typeof data.description === 'string') return 'character';
  if (hint) return hint;
  throw new MaterialError('FORMAT_UNSUPPORTED', '没有识别到素材结构，请选择角色卡、世界书或酒馆配置文件');
}

const role = (value: JsonValue | undefined): 'system' | 'user' | 'assistant' => value === 'user' || value === 1 ? 'user' : value === 'assistant' || value === 2 ? 'assistant' : 'system';
const used = (path: string, label: string): MaterialCapability => ({ path, label, status: 'used' });
const archived = (path: string, label: string, reason?: string): MaterialCapability => ({ path, label, status: 'archived', ...(reason ? { reason } : {}) });
const nonempty = (value: JsonValue | undefined) => value !== undefined && value !== null && value !== false && value !== '' && value !== 0 && (!Array.isArray(value) || value.length > 0);

function worldbook(book: JsonObject, base: string, fallback: string, capabilities: MaterialCapability[]): WorldbookProjection {
  const entriesValue = book.entries;
  if (!(entriesValue && typeof entriesValue === 'object')) throw new MaterialError('WORLD_ENTRIES', '世界书缺少条目列表');
  const entries: LoreEntry[] = [];
  for (const [key, value] of Object.entries(entriesValue)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new MaterialError('WORLD_ENTRY', `世界书第 ${key} 条不是有效条目`);
    const entry = object(value);
    const extension = object(entry.extensions);
    const sourcePath = `${base}.entries.${key}`;
    // ST embeds richer placement data in extensions; zero is a valid override.
    const positionValue = extension.position ?? entry.position ?? 0;
    const position = positionValue === 4 || positionValue === 'at_depth' || positionValue === 'depth' ? 'depth'
      : positionValue === 1 || positionValue === 'after_char' || positionValue === 'after' ? 'after' : 'before';
    const supportedPosition = [0, 1, 4, 'before', 'after', 'before_char', 'after_char', 'at_depth', 'depth'].includes(positionValue as string | number);
    const logic = number(entry.selectiveLogic ?? extension.selectiveLogic, 0);
    if (![0, 1, 2, 3].includes(logic)) throw new MaterialError('WORLD_LOGIC', `世界书第 ${key} 条的副关键词组合无效`);
    const primary = strings(entry.keys ?? entry.key);
    const secondary = strings(entry.secondary_keys ?? entry.keysecondary);
    entries.push({
      id: String(entry.id ?? entry.uid ?? key), name: text(entry.comment ?? entry.name ?? entry.title, `条目 ${key}`),
      content: text(entry.content), keys: primary, secondaryKeys: secondary,
      selective: typeof entry.selective === 'boolean' ? entry.selective : secondary.length > 0,
      selectiveLogic: logic as 0 | 1 | 2 | 3,
      constant: entry.constant === true,
      enabled: entry.enabled !== false && entry.disable !== true && entry.disabled !== true && supportedPosition,
      caseSensitive: (entry.case_sensitive ?? entry.caseSensitive ?? extension.case_sensitive ?? extension.caseSensitive ?? book.case_sensitive) === true,
      wholeWords: (entry.matchWholeWords ?? entry.match_whole_words ?? extension.matchWholeWords ?? extension.match_whole_words) === true,
      scanDepth: optionalNumber(entry.scanDepth ?? entry.scan_depth ?? extension.scan_depth ?? extension.scanDepth),
      order: number(entry.insertion_order ?? entry.order, 100), position,
      depth: number(entry.depth ?? extension.depth, 4), role: role(entry.role ?? extension.role), sourcePath,
    });
    capabilities.push(used(sourcePath, '基础世界书条目'));
    if (!supportedPosition) capabilities.push(archived(`${sourcePath}.position`, '特殊插入位置'));
    for (const field of ['sticky', 'cooldown', 'delay', 'group', 'group_override', 'group_weight', 'prevent_recursion', 'exclude_recursion', 'delay_until_recursion', 'probability', 'use_regex']) {
      const value = entry[field] ?? extension[field];
      if (nonempty(value) && !(field === 'probability' && value === 100)) capabilities.push(archived(`${sourcePath}.${field}`, '世界书高级规则'));
    }
  }
  if (book.recursive_scanning === true || book.recursiveScanning === true) capabilities.push(archived(`${base}.recursive_scanning`, '递归世界书'));
  return { name: text(book.name, fallback), entries, scanDepth: optionalNumber(book.scan_depth ?? book.scanDepth), budget: optionalNumber(book.token_budget ?? book.budget), recursive: false };
}

function regexRules(raw: JsonValue | undefined, base: string, capabilities: MaterialCapability[]): RegexRule[] {
  if (raw === undefined) return [];
  const root = object(raw);
  const wrapped = Array.isArray(root.__content__) ? root.__content__ : undefined;
  const list = Array.isArray(raw) ? raw : wrapped ?? [raw];
  return list.map((value, index) => {
    const entry = object(value);
    const sourcePath = `${base}${base ? '.' : ''}${wrapped ? '__content__.' : ''}${index}`;
    const placements: RegexRule['placements'] = [];
    for (const value of Array.isArray(entry.placement) ? entry.placement : [entry.placement ?? 2]) {
      const place = value === 1 || value === 'input' ? 'input' : value === 2 || value === 'output' ? 'output'
        : value === 5 || value === 'worldbook' ? 'worldbook' : value === 6 || value === 'reasoning' ? 'reasoning' : null;
      if (place) placements.push(place);
      else capabilities.push(archived(`${sourcePath}.placement`, '特殊正则位置'));
    }
    const rule: RegexRule = {
      id: String(entry.id ?? index), name: text(entry.scriptName ?? entry.name, `正则 ${index + 1}`),
      findRegex: text(entry.findRegex), replaceString: text(entry.replaceString), trimStrings: strings(entry.trimStrings), placements,
      displayOnly: entry.markdownOnly === true && entry.promptOnly !== true, promptOnly: entry.promptOnly === true && entry.markdownOnly !== true,
      disabled: entry.disabled === true || !placements.length,
      runOnEdit: entry.runOnEdit === true, minDepth: optionalNumber(entry.minDepth), maxDepth: optionalNumber(entry.maxDepth),
      substituteRegex: number(entry.substituteRegex, 0), sourcePath,
    };
    capabilities.push(used(sourcePath, rule.displayOnly ? '阅读显示正则' : '文本正则'));
    return rule;
  });
}

function preset(root: JsonObject, capabilities: MaterialCapability[]): PresetProjection {
  const source = Array.isArray(root.prompts) ? root.prompts : [];
  const orderSets = Array.isArray(root.prompt_order) ? root.prompt_order : [];
  const selectedOrderSet = orderSets.find(item => object(item).character_id === 100001) ?? orderSets.find(item => object(item).character_id === 100000) ?? orderSets[0];
  const orderSet = object(selectedOrderSet);
  const configuredOrder = Array.isArray(orderSet.order) ? orderSet.order : [];
  const hasConfiguredOrder = selectedOrderSet !== undefined;
  const orderMap = new Map(configuredOrder.map((value, index) => [text(object(value).identifier), { index, enabled: object(value).enabled !== false }]));
  const prompts: PromptEntry[] = source.map<PromptEntry>((value, index) => {
    const entry = object(value);
    const identifier = text(entry.identifier ?? entry.id, `prompt:${index}`);
    const configured = orderMap.get(identifier);
    const marker = entry.marker === true || ['charDescription', 'charPersonality', 'scenario', 'personaDescription', 'dialogueExamples', 'chatHistory', 'worldInfoBefore', 'worldInfoAfter'].includes(identifier);
    capabilities.push(used(`prompts.${index}`, '提示词条目'));
    return {
      identifier, name: text(entry.name, identifier), role: role(entry.role),
      enabled: entry.enabled !== false && entry.disabled !== true && (!hasConfiguredOrder || configured?.enabled === true),
      content: text(entry.content ?? entry.prompt ?? entry.value), marker, forbidOverrides: entry.forbid_overrides === true,
      position: entry.injection_position === 1 || entry.injection_position === 'depth' ? 'depth' : 'relative',
      depth: number(entry.injection_depth, 4), order: configured?.index ?? configuredOrder.length + index,
      sourcePath: `prompts.${index}`,
    };
  }).sort((a, b) => a.order - b.order);
  const sampling: SamplingProjection = {};
  const temperature = optionalNumber(root.temperature ?? root.temp);
  const maxTokens = optionalNumber(root.openai_max_tokens ?? root.max_tokens ?? root.genamt);
  if (temperature !== null) { sampling.temperature = temperature; capabilities.push(used('temperature', '温度')); }
  if (maxTokens !== null) { sampling.maxTokens = maxTokens; capabilities.push(used('max_tokens', '输出上限')); }
  const reasoning = text(root.reasoning_effort ?? root.reasoningEffort);
  if (reasoning) { sampling.reasoningEffort = reasoning; capabilities.push(used('reasoning_effort', '思考强度')); }
  const stop = root.stop ?? root.stop_sequences ?? root.custom_stopping_strings;
  if (Array.isArray(stop)) sampling.stop = strings(stop);
  else if (typeof stop === 'string' && stop) {
    try { const parsed: unknown = JSON.parse(stop); if (Array.isArray(parsed)) sampling.stop = parsed.filter((item): item is string => typeof item === 'string'); else sampling.stop = [stop]; }
    catch { sampling.stop = [stop]; }
  }
  if (sampling.stop) capabilities.push(used('stop', '停止串'));
  for (const field of Object.keys(root)) {
    if (!['name', 'prompts', 'prompt_order', 'temperature', 'temp', 'openai_max_tokens', 'max_tokens', 'genamt', 'reasoning_effort', 'reasoningEffort', 'stop', 'stop_sequences', 'custom_stopping_strings', 'extensions'].includes(field)) capabilities.push(archived(field, '原预设字段'));
  }
  return { prompts, sampling };
}

function quickReplies(raw: JsonValue, capabilities: MaterialCapability[]): QuickReply[] {
  const root = object(raw);
  const name = Array.isArray(root.qrList) ? 'qrList' : Array.isArray(root.quickReplySlots) ? 'quickReplySlots' : '';
  const list = name ? root[name] as JsonValue[] : [raw];
  const replies: QuickReply[] = [];
  list.forEach((value, index) => {
    const entry = object(value);
    const message = text(entry.message ?? entry.value ?? entry.content);
    const sourcePath = name ? `${name}.${index}` : String(index);
    if (!message || /^\s*\//u.test(message)) { capabilities.push(archived(sourcePath, '快捷回复脚本')); return; }
    capabilities.push(used(sourcePath, '输入草稿'));
    replies.push({ id: String(entry.id ?? index), label: text(entry.label ?? entry.name ?? entry.title, `快捷回复 ${index + 1}`), message, enabled: entry.disabled !== true && entry.enabled !== false, sourcePath });
  });
  return replies;
}

export function projectMaterial(raw: JsonValue, fileName: string, hint?: MaterialKind): { projection: MaterialProjection; capabilities: MaterialCapability[] } {
  const kind = classifyMaterial(raw, hint);
  const root = object(raw);
  const data = characterData(raw);
  const fallback = fileName.replace(/\.[^.]+$/u, '');
  const name = text(kind === 'character' ? data.name : root.name ?? root.presetName ?? root.scriptName).trim() || fallback;
  const capabilities: MaterialCapability[] = [];
  const projection: MaterialProjection = { kind, name, character: null, worldbook: null, preset: null, regex: [], quickReplies: [] };
  if (kind === 'persona') {
    projection.persona = readPersona(raw).projection;
    capabilities.push(used('name', '玩家昵称'), used('description', '玩家设定'));
    if (projection.persona.avatarPath) capabilities.push(used('avatar', '本地头像'));
    for (const field of Object.keys(root)) if (!['format', 'version', 'name', 'description', 'avatar'].includes(field)) capabilities.push(archived(field, '人设扩展原文'));
  } else if (kind === 'character') {
    const character: CharacterProjection = {
      name, description: text(data.description), personality: text(data.personality), scenario: text(data.scenario),
      firstMessage: text(data.first_mes), alternateGreetings: strings(data.alternate_greetings), messageExamples: text(data.mes_example),
      systemPrompt: text(data.system_prompt), postHistoryInstructions: text(data.post_history_instructions), creatorNotes: text(data.creator_notes), tags: strings(data.tags),
    };
    projection.character = character;
    for (const field of characterFields.filter(key => !['character_book', 'extensions', 'assets'].includes(key))) {
      if (nonempty(data[field])) capabilities.push(used(`data.${field}`, '角色资料'));
    }
    const book = object(data.character_book);
    if (book.entries !== undefined) projection.worldbook = worldbook(book, 'data.character_book', name, capabilities);
    const extensions = object(data.extensions);
    projection.regex = regexRules(extensions.regex_scripts, 'data.extensions.regex_scripts', capabilities);
    for (const field of Object.keys(extensions)) if (!['regex_scripts', 'fav', 'talkativeness', 'world'].includes(field)) capabilities.push(archived(`data.extensions.${field}`, '扩展原文'));
    for (const field of Object.keys(data)) if (!characterFields.includes(field)) capabilities.push(archived(`data.${field}`, '其他角色字段'));
  } else if (kind === 'worldbook') {
    const nested = object(root.data);
    projection.worldbook = worldbook(nested.entries ? nested : root, nested.entries ? 'data' : 'worldbook', name, capabilities);
  } else if (kind === 'preset') {
    projection.preset = preset(root, capabilities);
    projection.regex = regexRules(object(root.extensions).regex_scripts, 'extensions.regex_scripts', capabilities);
  } else if (kind === 'regex') projection.regex = regexRules(raw, '', capabilities);
  else if (kind === 'quick_reply') projection.quickReplies = quickReplies(raw, capabilities);
  else capabilities.push(archived('', kind === 'script' ? '脚本原件' : kind === 'theme' ? '主题原件' : '扩展配置原件'));
  return { projection, capabilities };
}

/** Export copy only: legacy and V2 JSON become CCv3 without mutating stored raw data. */
export function currentJson(raw: JsonValue, kind: MaterialKind): JsonValue {
  if (kind !== 'character') return structuredClone(raw);
  const root = object(raw);
  return { ...structuredClone(root), spec: 'chara_card_v3', spec_version: '3.0', data: structuredClone(characterData(raw)) };
}
