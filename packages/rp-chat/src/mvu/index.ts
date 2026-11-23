import { stringify as stringifyYaml } from 'yaml';
import type { JsonObject, JsonValue } from '@tavern-kit/rp-materials/types';
import type { MvuBook, MvuExpand, MvuIssue, MvuResult, MvuState } from './types.js';
import { at, isObject, json, merge, parseData, put, stripWrapper } from './data.js';
import { scanMarkup } from './markup.js';
import { extractCommands } from './commands.js';
import { applyCommands } from './execute.js';
import { reconcile } from './schema.js';
export type { MvuBook, MvuExpand, MvuIssue, MvuResult, MvuState } from './types.js';

/** Import boundary: default missing metadata, never silently coerce invalid persisted data. */
export function readMvuState(value: unknown): MvuState {
  const data = value === undefined ? {} : json(value);
  if (!isObject(data)) throw new TypeError('An MVU state must be a JSON object.');
  const field = (name: string): JsonObject => {
    if (!Object.hasOwn(data, name)) return {};
    const current = data[name];
    if (!isObject(current)) throw new TypeError(`MVU ${name} must be a JSON object.`);
    return current;
  };
  let markers: JsonObject;
  const legacy = data.initialized_lorebooks;
  if (Array.isArray(legacy) && legacy.every(item => typeof item === 'string')) {
    markers = {};
    for (const name of legacy) if (typeof name === 'string') put(markers, name, []);
  } else markers = field('initialized_lorebooks');
  return { ...data, stat_data: field('stat_data'), schema: field('schema'), initialized_lorebooks: markers, display_data: field('display_data'), delta_data: field('delta_data') };
}
export function initializeMvu(books: readonly MvuBook[], greeting?: string, previous?: MvuState, expand?: MvuExpand): MvuResult {
  const state = readMvuState(previous), issues: MvuIssue[] = [], defaults: JsonObject = {}, seen = new Set<string>();
  for (const book of books) {
    if (seen.has(book.name) || Object.hasOwn(state.initialized_lorebooks, book.name)) continue;
    seen.add(book.name);
    let succeeded = true;
    for (let index = 0; index < book.entries.length; index++) {
      const entry = book.entries[index]!;
      if (!entry.comment.toLowerCase().includes('[initvar]')) continue;
      try {
        const stripped = stripWrapper(entry.content), source = expand ? expand(stripped) : stripped;
        const value = source.trim() ? parseData(source) : {};
        if (!isObject(value)) throw new TypeError('An initvar declaration must be a JSON object.');
        merge(defaults, value, true);
      } catch (error) {
        succeeded = false;
        issues.push({ code: 'invalid_initvar', message: error instanceof Error ? error.message : String(error), source: `book[${JSON.stringify(book.name)}].entries[${JSON.stringify(entry.id ?? index)}]` });
      }
    }
    if (succeeded) put(state.initialized_lorebooks, book.name, []);
  }
  merge(defaults, state.stat_data, true);
  state.stat_data = defaults;
  if (greeting !== undefined) {
    const override: JsonObject = {};
    let hasOverride = false;
    for (const block of scanMarkup(greeting).blocks.filter(block => block.kind === 'init')) {
      try {
        if (!block.closed) throw new TypeError('The greeting initvar declaration is incomplete.');
        const stripped = stripWrapper(greeting.slice(block.contentStart, block.contentEnd)), source = expand ? expand(stripped) : stripped;
        const value = source.trim() ? parseData(source) : {};
        if (!isObject(value)) throw new TypeError('An initvar declaration must be a JSON object.');
        merge(override, value, true); hasOverride = true;
      } catch (error) { issues.push({ code: 'invalid_initvar', message: error instanceof Error ? error.message : String(error), source: 'greeting', offset: block.start }); }
    }
    if (hasOverride) state.stat_data = override;
  }
  reconcile(state);
  if (greeting !== undefined) applyCommands(state, extractCommands(expand ? expand(greeting) : greeting, issues, true), issues);
  return { state, issues };
}
export function updateMvu(text: string, baseline: MvuState, expand?: MvuExpand): MvuResult {
  const state = readMvuState(baseline), issues: MvuIssue[] = [];
  applyCommands(state, extractCommands(expand ? expand(text) : text, issues), issues);
  issues.sort((left, right) => (left.offset ?? 0) - (right.offset ?? 0));
  return { state, issues };
}
function macroPath(source: string): string[] | undefined {
  const path = source.trim();
  if (!path || path.startsWith('/') || path.includes('::') || !/^[^.\[\]]+(?:(?:\.[^.\[\]]+)|(?:\[\d+\]))*$/u.test(path)) return undefined;
  return path.replace(/\[(\d+)\]/gu, '.$1').split('.');
}
function formatted(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(formatted);
  if (!isObject(value)) return value;
  const result: JsonObject = {};
  for (const [key, child] of Object.entries(value)) if (!key.startsWith('$')) put(result, key, formatted(child));
  return result;
}
/** One pass only: replacement text is never executed or re-expanded as another macro. */
export function expandMvu(text: string, state: MvuState): string {
  return text.replace(/\{\{(get_message_variable|format_message_variable)::([^{}]*)\}\}/gu, (literal: string, name: string, path: string) => {
    const tokens = macroPath(path);
    if (!tokens) return literal;
    const found = at(state, tokens);
    if (!found.exists) return literal;
    const value = found.value!;
    return name === 'format_message_variable' ? stringifyYaml(formatted(value), { lineWidth: 0, indent: 2 }).trimEnd() : typeof value === 'string' ? value : JSON.stringify(value);
  });
}
