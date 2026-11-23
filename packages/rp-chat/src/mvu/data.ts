// Native finite MVU behavior adapted from MagVarUpdate d03b7dc8 via dsh-Go.
// Copyright (c) 2025 MagicalAstrogy & StageDog. MIT; see LICENSE-MagVarUpdate.
import JSON5 from 'json5';
import { jsonrepair } from 'jsonrepair';
import { parseDocument } from 'yaml';
import type { JsonObject, JsonValue } from '@tavern-kit/rp-materials/types';

export function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function put(target: JsonObject, key: string, value: JsonValue): void {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}
/** Validate first, rather than serializing undefined/nonfinite values into misleading JSON. */
export function json(value: unknown, parents = new Set<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || value === null) throw new TypeError('MVU values must be finite JSON data.');
  if (parents.has(value)) throw new TypeError('MVU values cannot contain cycles.');
  parents.add(value);
  try {
    if (Array.isArray(value)) return Array.from(value, item => json(item, parents));
    const result: JsonObject = {};
    if (value instanceof Map) {
      for (const [key, child] of value) {
        if (typeof key !== 'string') throw new TypeError('MVU object keys must be strings.');
        put(result, key, json(child, parents));
      }
      return result;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('MVU values must be plain JSON data.');
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if (!descriptor.enumerable) continue;
      if (!('value' in descriptor)) throw new TypeError('MVU properties must be data, not accessors.');
      put(result, key, json(descriptor.value, parents));
    }
    return result;
  } finally { parents.delete(value); }
}
export function clone<T extends JsonValue>(value: T): T { return structuredClone(value); }
/** Go's _mvuEqual: object key order is irrelevant; array order and scalar types are not. */
export function equalJson(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => equalJson(item, right[index]!));
  if (isObject(left) && isObject(right)) return Object.keys(left).length === Object.keys(right).length && Object.entries(left).every(([key, value]) => Object.hasOwn(right, key) && equalJson(value, right[key]!));
  return false;
}

export function parseData(source: string): JsonValue {
  let parsed: unknown;
  // A successful parse still has to cross the finite JSON boundary; never repair invalid values.
  if (/^\s*[\[{]/u.test(source)) {
    try { parsed = JSON5.parse(source); } catch { parsed = undefined; }
    if (parsed !== undefined) return json(parsed);
  }
  const document = parseDocument(source, { merge: true, uniqueKeys: true });
  if (document.errors.length === 0) return json(document.toJS({ mapAsMap: true, maxAliasCount: 100 }));
  return json(JSON.parse(jsonrepair(source)));
}
export function merge(target: JsonValue | undefined, source: JsonValue, replaceArrays = false): JsonValue {
  if (isObject(source)) {
    const result = isObject(target) ? target : {};
    for (const [key, value] of Object.entries(source)) put(result, key, merge(Object.hasOwn(result, key) ? result[key] : undefined, value, replaceArrays));
    return result;
  }
  if (Array.isArray(source)) {
    if (replaceArrays) return clone(source);
    const result = Array.isArray(target) ? target : [];
    for (let index = 0; index < source.length; index++) result[index] = merge(result[index], source[index]!, replaceArrays);
    return result;
  }
  return source;
}
export function pathTokens(path: string): string[] {
  if (path === '') return [];
  // Lodash-style paths are data, not executable member expressions.
  const tokens: string[] = path.startsWith('.') ? [''] : [];
  const pattern = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/gu;
  let end = 0;
  for (const match of path.matchAll(pattern)) {
    const gap = path.slice(end, match.index);
    if (gap && gap !== '.') throw new TypeError('Invalid MVU path.');
    tokens.push(match[2] ? match[3]!.replace(/\\(\\)?/gu, (_all, slash: string | undefined) => slash ?? '') : match[1] ?? match[0]);
    end = match.index + match[0].length;
  }
  if (!tokens.length || end !== path.length) throw new TypeError('Invalid MVU path.');
  return tokens;
}
export function dataPath(root: JsonValue, path: string, tokens: string[]): string[] {
  return isObject(root) && Object.hasOwn(root, path) ? [path] : tokens;
}
export function at(root: JsonValue | undefined, tokens: readonly string[]): { exists: boolean; value?: JsonValue } {
  let current = root;
  for (const key of tokens) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/u.test(key) || !Object.hasOwn(current, key)) return { exists: false };
      current = current[Number(key)];
    } else if (isObject(current) && Object.hasOwn(current, key)) current = current[key];
    else return { exists: false };
  }
  return current === undefined ? { exists: false } : { exists: true, value: current };
}
export function setAt(root: JsonValue, tokens: readonly string[], value: JsonValue): boolean {
  let parent = root;
  for (let index = 0; index < tokens.length; index++) {
    const key = tokens[index]!;
    if (!isObject(parent) && !Array.isArray(parent)) return false;
    if (Array.isArray(parent) && !/^(0|[1-9]\d*)$/u.test(key)) return false;
    if (index === tokens.length - 1) {
      if (Array.isArray(parent)) { while (parent.length < Number(key)) parent.push(null); parent[Number(key)] = value; }
      else put(parent, key, value);
      return true;
    }
    let next = at(parent, [key]).value;
    if (!isObject(next) && !Array.isArray(next)) {
      next = /^(0|[1-9]\d*)$/u.test(tokens[index + 1]!) ? [] : {};
      if (Array.isArray(parent)) { while (parent.length < Number(key)) parent.push(null); parent[Number(key)] = next; }
      else put(parent, key, next);
    }
    parent = next;
  }
  return false;
}
export function stripWrapper(source: string): string {
  let text = source.trim().replace(/^<initvar>([\s\S]*?)<\/initvar>$/iu, '$1').trim();
  text = text.replace(/^```[^\r\n]*(?:\r\n|\r|\n)([\s\S]*?)(?:\r\n|\r|\n)[ \t]*```$/u, '$1');
  return text;
}
