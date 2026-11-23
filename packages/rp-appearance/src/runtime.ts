import { APPEARANCE_CSS } from './styles.js';
import { compileThemeDocument } from './theme.js';
import type { AppearancePreferences, ResolvedScheme, ThemeDocument } from './types.js';

export interface AppearanceTheme { overrideTokens(source: string, tokens: Record<string, { light: string; dark: string }>): () => void }
export interface AppearanceInstallation { update(preferences: AppearancePreferences, theme: ThemeDocument): void; dispose(): void }
export function resolvedScheme(preference: AppearancePreferences['scheme'], systemDark: boolean): ResolvedScheme { return preference === 'system' ? systemDark ? 'dark' : 'light' : preference; }

/** All DOM resources belong to this installation; UI navigation never owns generation. */
export function installAppearance(document: Document, themeService: AppearanceTheme): AppearanceInstallation {
  const root = document.documentElement;
  const attributes = ['data-tk-skin', 'data-tk-bubbles', 'data-tk-scheme', 'data-tk-season', 'data-tk-scene-kind'];
  const previous = attributes.map(name => [name, root.getAttribute(name)] as const);
  const style = document.createElement('style');
  style.dataset.tkAppearance = '';
  document.head.append(style);
  const query = document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
  let releaseTokens: (() => void) | undefined;
  let disposed = false;
  let current: { preferences: AppearancePreferences; document: ThemeDocument } | undefined;
  function apply(): void {
    if (disposed || !current) return;
    const { preferences, document: themeDocument } = current;
    const scheme = resolvedScheme(preferences.scheme, query?.matches ?? false);
    const compiled = compileThemeDocument(themeDocument, scheme, preferences.season);
    const values: Record<string, string> = {
      ...compiled.tokens,
      '--tk-font-size': `${preferences.fontSize}px`, '--tk-reading-width': `${preferences.readingWidth}px`,
      '--tk-message-gap': preferences.bubbles ? '18px' : '24px',
      '--tk-bubble-radius': preferences.bubbles ? compiled.tokens['--tk-bubble-radius'] ?? '16px' : '0px',
      '--tk-background-image': preferences.background === 'illustrated' ? compiled.tokens['--tk-background-image'] ?? 'none' : preferences.background === 'custom' && preferences.backgroundImage ? `url("${preferences.backgroundImage}")` : 'none',
      '--tk-background-size': preferences.background === 'custom' ? 'cover' : '100% auto',
      '--tk-custom-bg': preferences.background === 'custom' ? preferences.backgroundColor : compiled.tokens['--tk-bg'] ?? '#fffef8',
    };
    const nextRelease = themeService.overrideTokens('@tavern-kit/rp-appearance', Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { light: value, dark: value }])));
    releaseTokens?.(); releaseTokens = nextRelease;
    root.dataset.tkSkin = preferences.skin;
    root.dataset.tkScheme = scheme;
    root.dataset.tkSeason = preferences.season;
    root.dataset.tkSceneKind = preferences.background !== 'illustrated' ? 'none' : (themeDocument.manifest.seasons?.find(value => value.id === preferences.season)?.scene ?? themeDocument.manifest.scene).kind;
    root.dataset.tkBubbles = preferences.bubbles ? 'on' : 'off';
    style.textContent = `${APPEARANCE_CSS}\n${compiled.css}`;
  }
  query?.addEventListener('change', apply);
  return {
    update(preferences, theme) { if (!disposed) { current = { preferences, document: theme }; apply(); } },
    dispose() {
      if (disposed) return;
      disposed = true;
      query?.removeEventListener('change', apply);
      releaseTokens?.(); style.remove(); current = undefined;
      for (const [name, value] of previous) { if (value === null) root.removeAttribute(name); else root.setAttribute(name, value); }
    },
  };
}
