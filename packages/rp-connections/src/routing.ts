import type { CallControls, FailureLike, ResolvedCall, Route } from './types.js';

/** Keep the frozen prompt intact: too-small backup routes are skipped by the caller. */
export function canFitRoute(route: Route, inputTokens: number, outputReserve?: number): boolean {
  const output = outputReserve ?? route.outputLimit ?? 4096;
  return inputTokens <= route.inputBudget
    && (route.contextWindow === undefined || inputTokens + output <= route.contextWindow)
    && (route.outputLimit === undefined || output <= route.outputLimit);
}

/** Map only the controls this exact adapter/route actually accepts. */
export function resolveCall(route: Route, controls: CallControls = {}): ResolvedCall {
  const result: ResolvedCall = { provider: route.provider, model: route.model };
  if (controls.maxTokens !== undefined) {
    if (!Number.isSafeInteger(controls.maxTokens) || controls.maxTokens <= 0) throw new TypeError('输出上限需要是正整数');
    result.maxTokens = Math.min(controls.maxTokens, route.outputLimit ?? controls.maxTokens);
  } else if (route.outputLimit !== undefined) result.maxTokens = route.outputLimit;
  if (route.parameters?.temperature === true && controls.temperature !== undefined) {
    if (!Number.isFinite(controls.temperature)) throw new TypeError('温度需要是有效数字');
    result.temperature = controls.temperature;
  }
  if (route.parameters?.reasoning === true && controls.reasoningEffort !== undefined) result.reasoningEffort = controls.reasoningEffort;
  if (route.parameters?.stop === true && controls.stop !== undefined) result.stop = [...controls.stop];
  return result;
}

function compileErrorPattern(pattern: string): string | RegExp {
  if (!pattern.startsWith('/')) return pattern;
  const end = pattern.lastIndexOf('/');
  if (end === 0) throw new TypeError('报错正则请写成 /表达式/i 的形式');
  try { return new RegExp(pattern.slice(1, end), pattern.slice(end + 1)); }
  catch { throw new TypeError('报错正则无效，请检查表达式和标志'); }
}

/** Validate before saving settings, so a malformed rule cannot replace usable rules. */
export function validateErrorPatterns(patterns: readonly string[]): void {
  for (const pattern of patterns) compileErrorPattern(pattern);
}

/** The generation layer calls this only for failed attempts before any reply text. */
export function isFallbackFailure(failure: FailureLike | undefined, fallbackOnError: boolean = true, errorPatterns: readonly string[] = []): boolean {
  if (!failure || !fallbackOnError || failure.code === 'ABORTED' || failure.name === 'AbortError') return false;
  if (errorPatterns.length === 0) return true;
  const values = [failure.code, failure.message, failure.status?.toString(), failure.statusCode?.toString()].filter((value): value is string => value !== undefined);
  return errorPatterns.some(pattern => {
    const compiled = compileErrorPattern(pattern);
    return values.some(value => typeof compiled === 'string' ? value.includes(compiled) : compiled.test(value));
  });
}
