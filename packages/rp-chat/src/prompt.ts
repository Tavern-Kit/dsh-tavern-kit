// ST-compatible subset, informed by SillyTavern's regex engine/world-info/PromptManager
// (AGPL-3.0). Only the explicitly supported, deterministic operations execute here.
import type { LoreEntry, MaterialVersion, RegexRule } from '@tavern-kit/rp-materials/types';
import type { CallControls } from '@tavern-kit/rp-connections/types';
import type { Memo, PromptInput, PromptMessage, Snapshot } from './types.js';
import { expandMvu } from './mvu/index.js';
import type { MvuState } from './mvu/types.js';

export interface MacroContext { char: string; user: string; description?: string; personality?: string; scenario?: string; persona?: string; mvu?: MvuState }
export interface AssembleOptions {
  materials: MaterialVersion[]; playerName: string; playerDescription: string;
  history: PromptMessage[]; input: string; memo?: Pick<Memo, 'content' | 'locked'>;
  inputBudget: number; editedMessages?: Set<number>;
  mvu?: MvuState; frozenLore?: string[];
}
export interface AssembledPrompt extends PromptInput {
  controls: CallControls; sources: Snapshot['sources']; estimatedTokens: number;
  triggeredLore: string[];
}
export function macros(text: string, context: MacroContext): string {
  const named = text.replace(/{{\s*(char|user|description|personality|scenario|persona)\s*}}/gi,
    (_, key: string) => { const value = context[key.toLowerCase() as keyof MacroContext]; return typeof value === 'string' ? value : ''; });
  return context.mvu ? expandMvu(named, context.mvu) : named;
}
/** Conservative application estimate, not a provider/tokenizer measurement. */
export function estimateTokens(text: string): number {
  const wide = (text.match(/[\u3000-\u9fff\uf900-\ufaff]/g) ?? []).length;
  return Math.ceil(wide + (text.length - wide) / 3);
}
export function estimateInput(input: PromptInput): number {
  return estimateTokens(input.system) + input.messages.reduce((sum, m) => sum + estimateTokens(m.content) + 5, 0);
}
function escapeRegex(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function regexOf(rule: RegexRule, context: MacroContext): RegExp {
  let source = rule.findRegex;
  if (rule.substituteRegex) {
    const replacements = rule.substituteRegex === 2
      ? Object.fromEntries(Object.entries(context).map(([k, v]) => [k, typeof v === 'string' ? escapeRegex(v) : v])) as unknown as MacroContext
      : context;
    source = macros(source, replacements);
  }
  const match = source.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/);
  return match ? new RegExp(match[1]!, match[2]) : new RegExp(source, 'g');
}
function runRegex(text: string, rule: RegexRule, context: MacroContext): string {
  let pattern: RegExp;
  try { pattern = regexOf(rule, context); } catch { return text; }
  return text.replace(pattern, (...args: unknown[]) => {
    const named = args.at(-1);
    return macros(rule.replaceString.replace(/{{match}}/gi, '$0').replace(/\$(\d+)|\$<([^>]+)>/g, (_whole, number: string | undefined, name: string | undefined) => {
      let value = number ? args[Number(number)] : name && named && typeof named === 'object' ? (named as Record<string, unknown>)[name] : '';
      if (typeof value !== 'string') value = '';
      for (const trim of rule.trimStrings) value = (value as string).split(macros(trim, context)).join('');
      return value as string;
    }), context);
  });
}
function projectWithRules(text: string, rules: RegexRule[], placement: RegexRule['placements'][number], context: MacroContext, options: { display?: boolean; depth?: number; edited?: boolean } = {}): string {
  let value = text;
  for (const rule of rules) {
    if (rule.disabled || !rule.placements.includes(placement)) continue;
    if (options.display ? rule.promptOnly : rule.displayOnly) continue;
    if (options.edited && !rule.runOnEdit) continue;
    const depth = options.depth ?? 0;
    if (rule.minDepth !== null && rule.minDepth >= -1 && depth < rule.minDepth) continue;
    if (rule.maxDepth !== null && rule.maxDepth >= 0 && depth > rule.maxDepth) continue;
    value = runRegex(value, rule, context);
  }
  return value;
}
export function projectText(text: string, materials: MaterialVersion[], placement: RegexRule['placements'][number], context: MacroContext, options: { display?: boolean; depth?: number; edited?: boolean } = {}): string {
  return projectWithRules(text, materials.flatMap(material => material.projection.regex), placement, context, options);
}
export function displayWithRules(text: string, rules: RegexRule[], placement: RegexRule['placements'][number], context: MacroContext, depth = 0): string {
  // Expand supported macros, then derive display replacements from the unchanged original text.
  return projectWithRules(macros(text, context), rules, placement, context, { display: true, depth });
}
export function displayText(text: string, materials: MaterialVersion[], placement: RegexRule['placements'][number], context: MacroContext, depth = 0): string {
  return displayWithRules(text, materials.flatMap(material => material.projection.regex), placement, context, depth);
}
function keyMatch(text: string, key: string, entry: LoreEntry, context: MacroContext): boolean {
  const needle = macros(key.trim(), context);
  if (!needle) return false;
  if (needle.startsWith('/') && /^\/[\s\S]*\/[dgimsuvy]*$/.test(needle)) {
    const parsed = needle.match(/^\/([\s\S]*)\/([dgimsuvy]*)$/)!;
    try { return new RegExp(parsed[1]!, parsed[2]).test(text); } catch { return false; }
  }
  if (entry.wholeWords) {
    // Unicode letter boundaries also work for non-Latin player names.
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegex(needle)}(?![\\p{L}\\p{N}_])`, entry.caseSensitive ? 'u' : 'iu').test(text);
  }
  return entry.caseSensitive ? text.includes(needle) : text.toLocaleLowerCase().includes(needle.toLocaleLowerCase());
}
function activated(entry: LoreEntry, text: string, context: MacroContext): boolean {
  if (!entry.enabled) return false;
  if (entry.constant) return true;
  if (!entry.keys.some(key => keyMatch(text, key, entry, context))) return false;
  if (!entry.selective || !entry.secondaryKeys.length) return true;
  const secondary = entry.secondaryKeys.map(key => keyMatch(text, key, entry, context));
  switch (entry.selectiveLogic) {
    case 0: return secondary.some(Boolean);
    case 1: return !secondary.every(Boolean);
    case 2: return !secondary.some(Boolean);
    case 3: return secondary.every(Boolean);
  }
}
function exampleMessages(text: string, context: MacroContext): PromptMessage[] {
  const messages: PromptMessage[] = [];
  const resolved = macros(text, context).replace(/<START>/gi, '').trim();
  const labels = new RegExp(`^(?:(${escapeRegex(context.user)}|User|Human)|(${escapeRegex(context.char)}|Assistant))\\s*:\\s*`, 'i');
  for (const line of resolved.split('\n')) {
    const label = line.match(labels);
    if (label) messages.push({ role: label[1] ? 'user' : 'assistant', content: line.slice(label[0].length) });
    else if (messages.length) messages[messages.length - 1]!.content += `\n${line}`;
  }
  return messages;
}
export function assemblePrompt(options: AssembleOptions): AssembledPrompt {
  const { materials } = options;
  const character = materials.map(m => m.projection.character).find(c => c !== null);
  const context: MacroContext = { char: character?.name || '角色', user: options.playerName || '我', description: character?.description, personality: character?.personality, scenario: character?.scenario, persona: options.playerDescription, mvu: options.mvu };
  const sources: Snapshot['sources'] = [];
  const piece = (label: string, text: string) => { const result = macros(text, context); if (result) sources.push({ label, text: result }); return result; };
  const hasInput = options.input !== '';
  const sourceHistory = options.history.map((message, sourceIndex) => ({ message, sourceIndex })).filter(({ message }) => message.content !== '');
  const history = sourceHistory.map(({ message, sourceIndex }, index) => ({
    role: message.role,
    content: projectText(macros(message.content, context), materials, message.role === 'assistant' ? 'output' : 'input', context, { depth: sourceHistory.length - index - 1 + Number(hasInput), edited: options.editedMessages?.has(sourceIndex) }),
  }));
  const chat: PromptMessage[] = [...history];
  if (hasInput) chat.push({ role: 'user', content: projectText(macros(options.input, context), materials, 'input', context) });
  const loreBefore: string[] = [], loreAfter: string[] = [], triggeredLore: string[] = [];
  const frozenLore = options.frozenLore === undefined ? undefined : new Set(options.frozenLore);
  const depth: { message: PromptMessage; depth: number; order: number }[] = [];
  for (const material of materials) {
    const book = material.projection.worldbook;
    if (!book) continue;
    let spent = 0;
    const budget = book.budget ?? Math.max(1, Math.floor(options.inputBudget * 0.25));
    for (const entry of [...book.entries].sort((a, b) => b.order - a.order)) {
      const scanDepth = entry.scanDepth ?? book.scanDepth ?? 2;
      const scan = (scanDepth === 0 ? [] : chat.slice(-scanDepth)).map(m => m.content).join('\n');
      const loreId = `${material.id}:${entry.id}`;
      if (frozenLore ? !frozenLore.has(loreId) : !activated(entry, scan, context)) continue;
      const text = projectText(macros(entry.content,context), materials, 'worldbook', context, { depth: entry.depth });
      const tokens = estimateTokens(text);
      if (!frozenLore && spent + tokens > budget) continue;
      if(text)sources.push({label:`${book.name} · ${entry.name || entry.id}`,text});
      spent += tokens; triggeredLore.push(loreId);
      if (entry.position === 'depth') depth.push({ message: { role: entry.role, content: text }, depth: entry.depth, order: entry.order });
      else (entry.position === 'before' ? loreBefore : loreAfter).push(text);
    }
  }
  const blocks: Record<string, string> = {
    worldInfoBefore: loreBefore.join('\n'), worldInfoAfter: loreAfter.join('\n'),
    personaDescription: piece('玩家设定', options.playerDescription ? `${context.user}：${options.playerDescription}` : ''),
    charDescription: piece('角色描述', character?.description ?? ''),
    charPersonality: piece('角色性格', character?.personality ?? ''),
    scenario: piece('场景', character?.scenario ?? ''),
  };
  const memo = options.memo ? piece('剧情备忘', [options.memo.content, ...options.memo.locked].filter(Boolean).join('\n')) : '';
  const preset = materials.map(m => m.projection.preset).find(p => p !== null);
  const examplesEnabled=preset?.prompts.find(entry=>entry.identifier==='dialogueExamples')?.enabled!==false;
  const examples = examplesEnabled?exampleMessages(character?.messageExamples ?? '', context):[];
  if (examples.length) sources.push({ label: '示例对话', text: examples.map(m => `${m.role}: ${m.content}`).join('\n') });
  let system = '', messages: PromptMessage[] = [], emptyChatStart = 0;
  const main = character?.systemPrompt ?? '', post = character?.postHistoryInstructions ?? '';
  if (preset?.prompts.length) {
    const entries = [...preset.prompts].filter(p => p.enabled).sort((a, b) => a.order - b.order);
    let hasHistory = false, hasExamples = false;
    for (const entry of entries) {
      const content = entry.identifier === 'main' ? piece('主提示词', entry.forbidOverrides ? entry.content : main || entry.content)
        : entry.identifier === 'jailbreak' ? piece('后置指令', entry.forbidOverrides ? entry.content : post || entry.content)
        : entry.marker ? blocks[entry.identifier] ?? '' : piece(`预设 · ${entry.name}`, entry.content);
      if (entry.position === 'depth') {
        if (content) depth.push({ message: { role: entry.role, content }, depth: entry.depth, order: entry.order });
        continue;
      }
      if (entry.identifier === 'chatHistory') { emptyChatStart = messages.length; messages.push(...chat); hasHistory = true; continue; }
      if (entry.identifier === 'dialogueExamples') { messages.push(...examples); hasExamples = true; continue; }
      if (content) messages.push({ role: entry.role, content });
    }
    if (!hasExamples && examples.length) { messages.unshift(...examples); emptyChatStart += examples.length; }
    if (!hasHistory) { emptyChatStart = messages.length; messages.push(...chat); }
    if (memo) {
      const firstChat = chat.length ? messages.findIndex(m => m === chat[0]) : emptyChatStart;
      messages.splice(firstChat < 0 ? 0 : firstChat, 0, { role: 'system', content: memo });
      if (!chat.length) emptyChatStart = Math.max(0, firstChat) + 1;
    }
  } else {
    system = [piece('主提示词', main), blocks.worldInfoBefore, blocks.charDescription, blocks.charPersonality, blocks.scenario, blocks.personaDescription, memo, blocks.worldInfoAfter].filter(Boolean).join('\n\n');
    messages = [...examples, ...chat];
    emptyChatStart = examples.length;
    if (post) depth.push({ message: { role: 'system', content: piece('后置指令', post) }, depth: 0, order: 0 });
  }
  // Anchor depths inside the original chat block; earlier insertions never change its boundaries or same-depth order.
  const chatStart = chat.length ? messages.indexOf(chat[0]!) : emptyChatStart;
  let inserted = 0;
  for (const item of depth.sort((a, b) => b.depth - a.depth || a.order - b.order)) {
    const index = chatStart + Math.max(0, chat.length - Math.max(0, item.depth)) + inserted;
    messages.splice(index, 0, item.message);
    inserted++;
  }
  const result = { system, messages, sources, controls: { ...preset?.sampling }, triggeredLore };
  return { ...result, estimatedTokens: estimateInput(result) };
}
