export type AppearanceSkin = string;
export type AppearanceScheme = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';
export type AppearanceSeason = 'spring' | 'summer' | 'autumn' | 'winter';
export type AppearanceBackground = 'plain' | 'illustrated' | 'custom';
export type ThemeSceneKind = 'image' | 'xi4u';
export type ThemeTokens = Record<string, string>;

/** Reading and presentation choices only; no conversation or generation data belongs here. */
export interface AppearancePreferences {
  /** Stable theme id; legacy classic/island/pixel values remain valid. */
  skin: string;
  scheme: AppearanceScheme;
  season: AppearanceSeason;
  fontSize: number;
  readingWidth: number;
  bubbles: boolean;
  background: AppearanceBackground;
  backgroundColor: string;
  backgroundImage: string | null;
}
export interface AppearancePatch {
  skin?: string;
  scheme?: AppearanceScheme;
  season?: AppearanceSeason;
  fontSize?: number;
  readingWidth?: number;
  bubbles?: boolean;
  background?: AppearanceBackground;
  backgroundColor?: string;
  backgroundImage?: string | null;
}
export interface ThemeManifest {
  format: 'tavern-kit.theme';
  formatVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  source: string;
  license: { name: string; files: string[] };
  palettes: { light: ThemeTokens; dark: ThemeTokens };
  stylesheet: string;
  preview: string;
  scene: { kind: ThemeSceneKind; asset?: string };
  seasons?: ThemeSeasonVariant[];
}
export interface ThemeSeasonVariant {
  id: AppearanceSeason;
  name: string;
  palettes?: { light: ThemeTokens; dark: ThemeTokens };
  scene?: { kind: ThemeSceneKind; asset?: string };
}
export interface ThemeResource { path: string; mimeType: string; base64: string }
export interface ThemeDocument {
  manifest: ThemeManifest;
  /** Exact descriptor text is retained together with every original resource. */
  themeJson: string;
  css: string;
  resources: ThemeResource[];
}
export interface ThemeSummary {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  previewDataUrl: string;
  builtin: boolean;
  scene: ThemeSceneKind;
  seasons: AppearanceSeason[];
}
export interface ThemeFile { filename: string; mimeType: 'application/zip'; base64: string }
export interface ThemeImportInput { filename: string; base64: string; overwrite?: boolean }
export interface ThemeImportResult { status: 'imported' | 'needs-confirmation'; theme: ThemeSummary }
export interface AppearanceExport { filename: string; mimeType: 'application/json'; text: string }
export interface AppearanceRemote {
  get(): Promise<AppearancePreferences>;
  update(patch: AppearancePatch): Promise<AppearancePreferences>;
  reset(): Promise<AppearancePreferences>;
  export(): Promise<AppearanceExport>;
  listThemes(): Promise<ThemeSummary[]>;
  getTheme(id: string): Promise<ThemeDocument>;
  importTheme(input: ThemeImportInput): Promise<ThemeImportResult>;
  exportTheme(id: string): Promise<ThemeFile>;
}
export interface AppearanceSettingsStore { read(): unknown; write(preferences: AppearancePreferences): Promise<void> }
