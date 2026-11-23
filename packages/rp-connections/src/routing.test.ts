import { describe, expect, it } from 'vitest';
import { ModelCatalog } from './catalog.js';
import { canFitRoute, isFallbackFailure, resolveCall } from './routing.js';

// Catch canonical-ID rewriting, unconfirmed family matching, and catalog price leakage.
describe('capability matching', () => {
  it('offers a prefixed model as a candidate without changing its request id', () => {
    const catalog = new ModelCatalog();
    const result = catalog.match('[薄甲]gpt-4.1');
    expect(result.id).toBe('[薄甲]gpt-4.1');
    expect(result.match).toBe('candidate');
    expect(result.capabilities.contextWindow).toBeUndefined();
    expect(result.candidates.some(item => item.id === 'gpt-4.1')).toBe(true);
    expect(catalog.match('[薄甲]gpt-4.1', 'gpt-4.1').capabilities.contextWindow).toBeGreaterThan(0);
  });

  it('keeps site and human capabilities above base metadata and prices out of relay metadata', () => {
    const result = new ModelCatalog().match('gpt-4.1', undefined, { contextWindow: 65536 }, { contextWindow: 32768, purpose: 'chat' });
    expect(result.capabilities.contextWindow).toBe(32768);
    expect(result.sources.contextWindow).toBe('manual');
    expect(result.capabilities).not.toHaveProperty('cost');
  });

  it('loads full models.dev metadata locally without receiving a private model id', () => {
    const catalog = new ModelCatalog();
    catalog.replace({ relay: { models: { 'family/new-model': { id: 'family/new-model', name: 'New', limit: { context: 10000, output: 2000 }, modalities: { input: ['text', 'image'], output: ['text'] }, reasoning: true } } } });
    const found = catalog.match('family/new-model');
    expect(found.match).toBe('exact');
    expect(found.capabilities).toMatchObject({ contextWindow: 10000, outputLimit: 2000, imageInput: true, reasoning: true });
    expect(catalog.match('unknown/private-id').match).toBe('unknown');
  });
});

describe('per-attempt routing', () => {
  const route = { provider: 'relay', model: '[按次]model/id', inputBudget: 6000, contextWindow: 8000, outputLimit: 2000, parameters: { temperature: true, reasoning: false, stop: false } };
  it('keeps raw ids and maps only controls explicitly supported by the actual adapter', () => {
    expect(resolveCall(route, { temperature: 0.7, maxTokens: 3000, stop: ['STOP'], reasoningEffort: 'high' })).toEqual({ provider: 'relay', model: '[按次]model/id', temperature: 0.7, maxTokens: 2000 });
  });
  it('skips a too-small backup without modifying the frozen input', () => {
    expect(canFitRoute(route, 6000, 2000)).toBe(true);
    expect(canFitRoute(route, 6001, 2000)).toBe(false);
  });
  it('allows every upstream generation error to try a configured backup without hard-coded status or cause exclusions', () => {
    for (const failure of [
      { code: 'HTTP_400' }, { code: 'HTTP_413' }, { code: 'AUTH', status: 400 },
      { code: 'QUOTA' }, { code: 'CONTEXT_WINDOW_EXCEEDED' }, { code: 'RATE_LIMIT' },
      { code: 'TRANSPORT' }, { code: 'STREAM_CLOSED' }, { code: 'INVALID_REQUEST', status: 400 },
      { code: 'UNSUPPORTED_REASONING_EFFORT', status: 400 }, { code: 'HTTP_503' },
      { message: 'upstream returned an unexpected error' }, {},
    ]) expect(isFallbackFailure(failure)).toBe(true);
  });
  it('uses optional text or explicit regex rules against returned code, status and message without treating unmatched errors as eligible', () => {
    const failure = { code: 'upstream_rejected', status: 413, message: 'Request could not be processed: overloaded' };
    expect(isFallbackFailure(failure, true, ['overloaded'])).toBe(true);
    expect(isFallbackFailure(failure, true, ['upstream_rejected'])).toBe(true);
    expect(isFallbackFailure(failure, true, ['413'])).toBe(true);
    expect(isFallbackFailure(failure, true, ['/COULD NOT be processed/i'])).toBe(true);
    expect(isFallbackFailure(failure, true, ['different cause', '/^HTTP_5/'])).toBe(false);
    expect(isFallbackFailure(failure, true, ['Overloaded'])).toBe(false);
    expect(isFallbackFailure({ code: 'ABORTED', message: 'overloaded' }, true, ['overloaded'])).toBe(false);
    expect(failure).toEqual({ code: 'upstream_rejected', status: 413, message: 'Request could not be processed: overloaded' });
  });
  it('respects an explicit disabled fallback and never treats an intentional cancellation as an upstream failure', () => {
    expect(isFallbackFailure(undefined)).toBe(false);
    expect(isFallbackFailure({ code: 'HTTP_503' }, false)).toBe(false);
    expect(isFallbackFailure({ code: 'HTTP_400' }, false)).toBe(false);
    expect(isFallbackFailure({ code: 'ABORTED' })).toBe(false);
    expect(isFallbackFailure({ name: 'AbortError', message: 'The operation was aborted' })).toBe(false);
  });
});
