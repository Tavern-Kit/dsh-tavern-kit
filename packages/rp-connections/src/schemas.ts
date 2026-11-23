import { z } from 'zod';
import { validateErrorPatterns } from './routing.js';

export const errorPatternsSchema = z.array(z.string().trim().min(1)).superRefine((patterns, context) => {
  try { validateErrorPatterns(patterns); }
  catch (error) { context.addIssue({ code: 'custom', message: error instanceof Error ? error.message : '报错正则无效' }); }
});

export const capabilitiesSchema = z.object({
  purpose: z.enum(['chat', 'embedding', 'image', 'audio', 'unknown']).optional(),
  contextWindow: z.number().int().positive().optional(), outputLimit: z.number().int().positive().optional(),
  imageInput: z.boolean().optional(), reasoning: z.boolean().optional(), temperature: z.boolean().optional(), stop: z.boolean().optional(),
});
export const modelSchema = z.object({ id: z.string().min(1), name: z.string().min(1), capabilities: capabilitiesSchema.optional() });
export const overrideSchema = capabilitiesSchema.extend({ canonicalId: z.string().min(1).optional(), alias: z.string().optional() });
export const routeSchema = z.object({
  provider: z.string().min(1), model: z.string().min(1), connectionId: z.string().optional(), label: z.string().optional(), group: z.string().optional(),
  inputBudget: z.number().int().positive(), contextWindow: z.number().int().positive().optional(), outputLimit: z.number().int().positive().optional(),
  parameters: z.object({ temperature: z.boolean().optional(), stop: z.boolean().optional(), reasoning: z.boolean().optional() }).optional(),
});
export const preferenceSchema = z.object({
  models: z.array(modelSchema).optional(), selectedModel: z.string().min(1).optional(),
  overrides: z.record(z.string(), overrideSchema).optional(), inputBudget: z.number().int().positive().optional(), group: z.string().optional(),
  fallback: z.array(routeSchema).optional(), fallbackOnError: z.boolean().optional(), errorPatterns: errorPatternsSchema.optional(), fallbackOn400: z.boolean().optional(), accountId: z.string().optional(),
});
export const accountSchema = z.object({ id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), siteURL: z.url(), apiURL: z.url(), name: z.string().optional() });
export const saveConnectionSchema = z.object({ provider: z.string().min(1), name: z.string().optional(), baseURL: z.url().optional(), api: z.string().optional(), settingsNs: z.string().optional(), apiKey: z.string().min(1).optional(), credentialRef: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).optional(), models: z.array(modelSchema).optional() });
export const discoverModelsSchema = z.object({ provider: z.string().min(1).optional(), settingsNs: z.string().optional(), baseURL: z.url().optional(), api: z.string().optional(), apiKey: z.string().optional() });
export const loginSchema = z.object({ accountId: z.string().min(1), username: z.string().min(1), password: z.string().min(1) });
export const verifySchema = z.object({ accountId: z.string().min(1), code: z.string().min(1), method: z.string().optional() });
export const patSchema = z.object({ accountId: z.string().min(1), token: z.string().min(1), userId: z.number().int().positive().optional() });
export const bindKeySchema = z.object({ accountId: z.string().min(1), keyId: z.number().int().positive(), provider: z.string().min(1), settingsNs: z.string().optional(), api: z.string().optional(), name: z.string().optional() });
