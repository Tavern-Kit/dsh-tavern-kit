import type { JsonObject, JsonValue } from './types.js';

export class MaterialError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'MaterialError';
  }
}

/** Validate untrusted JSON at the boundary, retaining every own field. */
export function validateJson(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item: unknown) => validateJson(item));
  if (value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const result: JsonObject = Object.create(null) as JsonObject;
    for (const [key, child] of Object.entries(value)) result[key] = validateJson(child);
    return result;
  }
  throw new MaterialError('INVALID_JSON', '素材中含有不是 JSON 的内容');
}
export function object(value: JsonValue | undefined): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
export function text(value: JsonValue | undefined, fallback = ''): string { return typeof value === 'string' ? value : fallback; }
export function number(value: JsonValue | undefined, fallback: number): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback; }
export function optionalNumber(value: JsonValue | undefined): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
export function strings(value: JsonValue | undefined): string[] {
  return (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((item): item is string => typeof item === 'string');
}
export function cloneJson<T extends JsonValue>(value: T): T { return structuredClone(value); }
export function mergeJson(base: JsonValue, patch: JsonObject): JsonObject {
  const result: JsonObject = { ...object(base) };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = value !== null && typeof value === 'object' && !Array.isArray(value)
      ? mergeJson(result[key] ?? null, value) : cloneJson(value);
  }
  return result;
}
