// Adapted from MagVarUpdate schema.ts / dsh-Go native profile; see LICENSE-MagVarUpdate.
import type { JsonObject, JsonValue } from '@tavern-kit/rp-materials/types';
import type { MvuState } from './types.js';
import { clone, isObject, merge, put } from './data.js';

const marker = '$__META_EXTENSIBLE__$';
export function infer(value: JsonValue, previous?: JsonValue, parentRecursive = false): JsonObject {
  const old = isObject(previous) ? previous : {};
  if (Array.isArray(value)) {
    const prior = old.type === 'array' ? old : {};
    const metaRow = value.find(item => isObject(item) && item.$arrayMeta === true && Object.hasOwn(item, '$meta'));
    const meta = isObject(metaRow) && isObject(metaRow.$meta) ? metaRow.$meta : {};
    const rows = value.filter(item => item !== marker && !(isObject(item) && item.$arrayMeta === true && Object.hasOwn(item, '$meta')));
    const recursive = prior.recursiveExtensible === true || parentRecursive;
    let extensible: JsonValue = Object.hasOwn(meta, 'extensible') ? meta.extensible! : prior.extensible === true;
    if (value.includes(marker)) extensible = true;
    const result: JsonObject = {
      type: 'array', extensible: extensible ? extensible : parentRecursive,
      recursiveExtensible: recursive, elementType: rows.length ? infer(rows[0]!, prior.elementType, recursive) : { type: 'any' },
    };
    if (Object.hasOwn(meta, 'template')) result.template = clone(meta.template!);
    else if (Object.hasOwn(prior, 'template')) result.template = clone(prior.template!);
    return result;
  }
  if (isObject(value)) {
    const prior = old.type === 'object' ? old : {}, properties: JsonObject = {};
    const meta = isObject(value.$meta) ? value.$meta : {};
    const extensible = prior.extensible === true || meta.extensible === true || meta.recursiveExtensible === true || parentRecursive;
    const recursive = prior.recursiveExtensible === true || meta.recursiveExtensible === true || parentRecursive;
    const result: JsonObject = { type: 'object', properties, extensible, recursiveExtensible: recursive };
    if (Object.hasOwn(meta, 'template')) result.template = clone(meta.template!);
    else if (prior.template) result.template = clone(prior.template);
    for (const [key, child] of Object.entries(value)) {
      if (key === '$meta') continue;
      const oldChild = isObject(prior.properties) ? prior.properties[key] : undefined;
      const required = isObject(oldChild) && typeof oldChild.required === 'boolean' ? oldChild.required : !extensible || (Array.isArray(meta.required) && meta.required.includes(key));
      put(properties, key, { ...infer(child, oldChild, extensible && recursive), required });
    }
    return result;
  }
  return { type: value === null ? 'any' : typeof value };
}
export function cleanMetadata(value: JsonValue): void {
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index--) {
      const child = value[index]!;
      if (child === marker || isObject(child) && child.$arrayMeta === true && Object.hasOwn(child, '$meta')) value.splice(index, 1);
      else cleanMetadata(child);
    }
  } else if (isObject(value)) {
    delete value.$meta;
    for (const child of Object.values(value)) cleanMetadata(child);
  }
}
export function reconcile(state: MvuState): void {
  const schema = infer(state.stat_data, state.schema);
  const meta = isObject(state.stat_data.$meta) ? state.stat_data.$meta : {};
  for (const key of ['strictSet', 'strictTemplate', 'concatTemplateArray']) {
    if (Object.hasOwn(state.schema, key)) schema[key] = clone(state.schema[key]!);
    if (Object.hasOwn(meta, key)) schema[key] = clone(meta[key]!);
  }
  state.schema = schema;
  cleanMetadata(state.stat_data);
}
export function schemaAt(schema: JsonObject, tokens: readonly string[]): JsonObject | undefined {
  let current: JsonValue | undefined = schema;
  for (const token of tokens) {
    if (!isObject(current)) return undefined;
    current = current.type === 'array' && /^\d+$/u.test(token) ? current.elementType : isObject(current.properties) && Object.hasOwn(current.properties, token) ? current.properties[token] : undefined;
  }
  return isObject(current) ? current : undefined;
}
export function applyTemplate(value: JsonValue, schema: JsonObject | undefined, rootSchema: JsonObject): JsonValue {
  const template = schema?.template;
  if (!template) return clone(value);
  const concat = rootSchema.concatTemplateArray === undefined || Boolean(rootSchema.concatTemplateArray);
  if (isObject(value) && !Array.isArray(template)) return merge(isObject(template) ? clone(template) : {}, value);
  if (Array.isArray(template)) {
    if (Array.isArray(value)) return concat ? [...clone(value), ...clone(template)] : merge(clone(template), value);
    if (!isObject(value) && !rootSchema.strictTemplate) return concat ? [clone(value), ...clone(template)] : merge(clone(template), [value]);
  }
  return clone(value);
}
