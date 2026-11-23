// Finite command behavior adapted from MagVarUpdate update_variables.ts via dsh-Go.
// Copyright (c) 2025 MagicalAstrogy & StageDog. MIT; see LICENSE-MagVarUpdate.
import type { JsonObject, JsonValue } from '@tavern-kit/rp-materials/types';
import type { MvuIssue, MvuState } from './types.js';
import type { Command } from './commands.js';
import { at, clone, dataPath, equalJson, isObject, merge, pathTokens, put, setAt } from './data.js';
import { applyTemplate, cleanMetadata, infer, reconcile, schemaAt } from './schema.js';

function jsString(value: JsonValue): string {
  if (Array.isArray(value)) return value.map(child => child === null ? '' : jsString(child)).join(',');
  return isObject(value) ? '[object Object]' : String(value);
}
function finiteNumber(value: JsonValue): number {
  const result = Number(Array.isArray(value) ? jsString(value) : value);
  if (!Number.isFinite(result)) throw new CommandError('command_value', 'The numeric value must remain finite.');
  return result;
}
class CommandError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
function fail(code: string, message: string): never { throw new CommandError(code, message); }
const vwd = (value: JsonValue | undefined): value is [JsonValue, string] => Array.isArray(value) && value.length === 2 && typeof value[1] === 'string';
function isoDate(value: JsonValue): number | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[Tt]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:[Zz]|[+-]\d{2}:?\d{2}))?$/u.test(value)) return undefined;
  const components = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value)!;
  if (Number(components[2]) < 1 || Number(components[2]) > 12 || Number(components[3]) < 1 || Number(components[3]) > 31) return undefined;
  const result = Date.parse(value); return Number.isFinite(result) ? result : undefined;
}
function deleteProperty(root: JsonValue, tokens: readonly string[]): boolean {
  const parent = tokens.length === 1 ? root : at(root, tokens.slice(0, -1)).value, key = tokens.at(-1);
  if (key === undefined || !isObject(parent) && !Array.isArray(parent)) return false;
  if (Array.isArray(parent)) {
    if (!/^\d+$/u.test(key) || Number(key) >= parent.length) return false;
    parent[Number(key)] = null;
  } else delete parent[key];
  return true;
}
function execute(state: MvuState, command: Command): { description?: string; tokens: string[] } {
  const path = String(command.args[0]), parsed = command.pointer ?? pathTokens(path), root = command.pointer ? parsed.length === 0 : path === '';
  const tokens = command.pointer ?? dataPath(state.stat_data, path, parsed);
  const found = at(state.stat_data, tokens), reason = command.reason ? `(${command.reason})` : '';
  const strictSet = Boolean(state.schema.strictSet);
  if (command.type === 'set') {
    if (!root && !found.exists) fail('command_path_missing', `The set path does not exist: ${path}.`);
    const next = clone(command.args.at(-1)!);
    let old: JsonValue = clone(root ? state.stat_data : found.value ?? null), actual: JsonValue;
    const pair = !strictSet && vwd(found.value) && !Array.isArray(found.value[0]) ? found.value : undefined;
    if (pair) {
      old = clone(pair[0]); actual = typeof pair[0] === 'number' && next !== null ? finiteNumber(next) : next;
      pair[0] = actual;
    } else {
      actual = typeof old === 'number' && typeof next === 'string' ? finiteNumber(next) : next;
      if (root) {
        if (!isObject(actual)) fail('command_type', 'The public MVU stat_data carrier must remain an object.');
        state.stat_data = actual;
      } else if (!setAt(state.stat_data, tokens, actual)) fail('command_target', 'The set path has no writable data container.');
    }
    const text = (value: JsonValue) => typeof value === 'string' ? value : JSON.stringify(value);
    return { tokens, description: `${text(old)}->${text(actual)} ${reason}` };
  }
  if (command.type === 'add') {
    if (!found.exists) fail('command_path_missing', `The add path does not exist: ${path}.`);
    const old = found.value!, pair = vwd(old) && old[0] !== null && !isObject(old[0]) && !Array.isArray(old[0]) ? old : undefined;
    const value = pair ? pair[0] : old, delta = command.args[1]!;
    if (typeof delta !== 'number') fail('command_type', 'A numeric or date delta must be a number.');
    const date = isoDate(value);
    let next: JsonValue;
    if (date !== undefined) {
      const number = date + delta;
      if (!Number.isFinite(number) || Math.abs(number) > 8640000000000000) fail('command_value', 'The date delta is outside the ISO date range.');
      next = new Date(number).toISOString();
    } else if (typeof value === 'number') {
      const number = value + delta;
      if (!Number.isFinite(number)) fail('command_value', 'The numeric update must remain finite.');
      next = Number(number.toPrecision(12));
    } else fail('command_type', 'Add requires a numeric value or an ISO date.');
    const before = clone(value);
    if (pair) pair[0] = next;
    else if (!setAt(state.stat_data, tokens, next)) fail('command_target', 'The add path has no writable container.');
    return { tokens, description: `${JSON.stringify(before)}->${JSON.stringify(next)} ${reason}` };
  }
  if (command.type === 'insert') {
    const target = root ? state.stat_data : found.value;
    if (!found.exists || target !== null && !isObject(target) && !Array.isArray(target)) fail('command_target', 'Insertion requires an existing collection or null target.');
    const targetSchema = schemaAt(state.schema, parsed), keyed = command.args.length >= 3, key = keyed ? command.args[1]! : null;
    if (targetSchema?.type === 'object' && targetSchema.extensible === false && (!keyed || !isObject(targetSchema.properties) || !Object.hasOwn(targetSchema.properties, jsString(key)))) fail('command_schema', 'The object schema does not permit this insertion.');
    if (targetSchema?.type === 'array' && !targetSchema.extensible) fail('command_schema', 'The array schema does not permit insertion.');
    const source = command.args[keyed ? 2 : 1]!, inserted = applyTemplate(source, targetSchema, state.schema);
    let collection: JsonObject | JsonValue[];
    if (target === null) {
      collection = !keyed && Array.isArray(source) ? [] : {};
      if (!setAt(state.stat_data, tokens, collection)) fail('command_target', 'The insertion target has no writable parent.');
    } else collection = target as JsonObject | JsonValue[];
    let description: string;
    if (!keyed) {
      if (Array.isArray(collection)) { collection.push(inserted); description = `ASSIGNED ${JSON.stringify(inserted)} into array '${path}' ${reason}`; }
      else if (isObject(source)) { merge(collection, source); description = `MERGED object ${JSON.stringify(source)} into object '${path}' ${reason}`; }
      else fail('command_type', 'Only an object can be merged into an object.');
    } else if (Array.isArray(collection) && (typeof key === 'number' || key === '-')) {
      const rawIndex = key === '-' ? collection.length : Math.trunc(key);
      const index = rawIndex < 0 ? Math.max(0, collection.length + rawIndex) : Math.min(rawIndex, collection.length);
      collection.splice(index, 0, inserted);
      description = `ASSIGNED ${JSON.stringify(inserted)} into '${path}' at index ${key === '-' || key === -1 ? 'tail' : jsString(key)} ${reason}`;
    } else {
      const name = jsString(key);
      if (Array.isArray(collection)) {
        if (!/^\d+$/u.test(name)) fail('command_target', 'A JSON array requires a numeric index.');
        setAt(collection, [name], inserted);
      } else put(collection, name, inserted);
      description = `ASSIGNED key '${name}' with value ${JSON.stringify(inserted)} into object '${path}' ${reason}`;
    }
    if (targetSchema) merge(targetSchema, infer(collection, targetSchema));
    cleanMetadata(collection);
    return { tokens, description };
  }
  // Go retains a direct array splice shortcut before required/extensible checks.
  if (command.args.length === 1 && /^\d+$/u.test(tokens.at(-1) ?? '')) {
    const parent = at(state.stat_data, tokens.slice(0, -1)).value, index = Number(tokens.at(-1));
    if (Array.isArray(parent) && index < parent.length) { parent.splice(index, 1); return { tokens }; }
  }
  if (!found.exists) fail('command_path_missing', `The remove path does not exist: ${path}.`);
  const keyed = command.args.length > 1;
  const containerTokens = keyed ? tokens : tokens.slice(0, -1), key = keyed ? command.args[1]! : tokens.at(-1);
  if (key === undefined) fail('command_target', 'The removal target cannot be determined.');
  const containerSchema = schemaAt(state.schema, keyed ? parsed : parsed.slice(0, -1));
  if (containerSchema?.type === 'array' && containerSchema.extensible !== true) fail('command_schema', 'The array schema does not permit removal.');
  if (containerSchema?.type === 'object' && isObject(containerSchema.properties)) {
    const child = containerSchema.properties[jsString(key)];
    if (isObject(child) && child.required === true) fail('command_schema', 'The property is required by its schema.');
  }
  if (!keyed) {
    if (!deleteProperty(state.stat_data, tokens)) fail('command_target', 'The remove path has no writable container.');
    return { tokens, description: `REMOVED path '${path}' ${reason}` };
  }
  const collection = found.value;
  if (Array.isArray(collection)) {
    const index = typeof key === 'number' ? Math.trunc(key) : collection.findIndex(item => equalJson(item, key));
    if (index < 0 || index >= collection.length) fail('command_target', 'The array removal target was not found.');
    collection.splice(index, 1);
    return { tokens, description: `REMOVED item from '${path}' ${reason}` };
  }
  if (isObject(collection)) {
    const name = typeof key === 'number' ? Object.keys(collection)[key] : jsString(key);
    if (name === undefined || !Object.hasOwn(collection, name)) fail('command_target', 'The object removal target was not found.');
    delete collection[name];
    return { tokens, description: `REMOVED key '${name}' from object '${path}' ${reason}` };
  }
  fail('command_type', 'Removal requires a collection.');
}
export function applyCommands(state: MvuState, commands: readonly Command[], issues: MvuIssue[]): void {
  const before = JSON.stringify(state.stat_data);
  state.display_data = clone(state.stat_data); state.delta_data = {};
  for (const command of commands) {
    try {
      const result = execute(state, command);
      if (result.description) {
        const tokens = result.tokens.length ? result.tokens : [''];
        setAt(state.display_data, tokens, result.description); setAt(state.delta_data, tokens, result.description);
      }
    } catch (error) {
      issues.push({ code: error instanceof CommandError ? error.code : 'invalid_command', message: error instanceof Error ? error.message : String(error), source: command.source, offset: command.offset });
    }
  }
  delete state.stat_data.$internal;
  if (JSON.stringify(state.stat_data) !== before) reconcile(state);
}
