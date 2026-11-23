import { z } from 'zod';
import type { AppearancePreferences, AppearanceSettingsStore, AppearanceExport } from './types.js';

export const APPEARANCE_SETTINGS_NAMESPACE = 'tavern-kit-rp-appearance';
export const DEFAULT_APPEARANCE: Readonly<AppearancePreferences> = Object.freeze({
  skin: 'classic', scheme: 'system', season: 'spring', fontSize: 17, readingWidth: 680, bubbles: true,
  background: 'illustrated', backgroundColor: '#24202d', backgroundImage: null,
});

/** Preference values are data, never CSS text or remote resource addresses. */
export const AppearancePreferencesSchema = z.object({
  skin: z.string().regex(/^[a-z][a-z0-9._-]{0,79}$/, '主题标识格式不正确'),
  scheme: z.enum(['system', 'light', 'dark']),
  season: z.enum(['spring', 'summer', 'autumn', 'winter']),
  fontSize: z.number().int().min(12).max(30),
  readingWidth: z.number().int().min(480).max(1440),
  bubbles: z.boolean(),
  background: z.enum(['plain', 'illustrated', 'custom']),
  backgroundColor: z.string().regex(/^#[\da-f]{6}$/i, '请使用六位颜色值'),
  backgroundImage: z.string().max(8 * 1024 * 1024)
    .regex(/^data:image\/(png|jpeg|webp|gif);base64,[\da-z+/]*={0,2}$/i, '请选择本地图片')
    .nullable(),
});
const AppearancePatchSchema = AppearancePreferencesSchema.partial().strict();

/** Validates values crossing the durable settings boundary; unknown plugin fields stay outside our view. */
export function readAppearancePreferences(input: unknown): AppearancePreferences {
  const candidate = typeof input === 'object' && input !== null && !Array.isArray(input) ? input : {};
  return AppearancePreferencesSchema.parse({ ...DEFAULT_APPEARANCE, ...candidate });
}

/** Shared by the Host Remote and optional ordinary-assistant tools. */
export class AppearancePreferencesController {
  constructor(private readonly store: AppearanceSettingsStore) {}

  get(): AppearancePreferences { return readAppearancePreferences(this.store.read()); }

  async update(input: unknown): Promise<AppearancePreferences> {
    const patch = AppearancePatchSchema.parse(input);
    const next = AppearancePreferencesSchema.parse({ ...this.get(), ...patch });
    await this.store.write(next);
    return this.get();
  }

  async reset(): Promise<AppearancePreferences> {
    await this.store.write({ ...DEFAULT_APPEARANCE });
    return this.get();
  }

  export(): AppearanceExport {
    return {
      filename: 'tavern-kit-appearance.json', mimeType: 'application/json',
      text: JSON.stringify({ format: 'tavern-kit.appearance', version: 1, preferences: this.get() }, null, 2),
    };
  }
}
