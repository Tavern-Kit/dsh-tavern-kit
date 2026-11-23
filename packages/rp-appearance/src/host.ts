import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type {} from '@deepseek-ai/dsh-settings';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPEARANCE_SETTINGS_NAMESPACE, AppearancePreferencesController, DEFAULT_APPEARANCE } from './preferences.js';
import { ThemeLibrary } from './theme-library.js';
import { base64ToBytes, bytesToBase64 } from './theme.js';
import type { AppearancePreferences, AppearancePatch, AppearanceExport, ThemeDocument, ThemeFile, ThemeImportInput, ThemeImportResult, ThemeSummary } from './types.js';

export interface Config { preferences: Volatile<AppearancePreferences>; dataDir: string }
export const Config = z.object({
  dataDir: z.string().default(join(homedir(), '.dsh', 'tavern-kit')),
  preferences: z.object({
    skin: z.string().default(DEFAULT_APPEARANCE.skin),
    scheme: z.union(['system', 'light', 'dark']).default(DEFAULT_APPEARANCE.scheme),
    season: z.union(['spring', 'summer', 'autumn', 'winter']).default(DEFAULT_APPEARANCE.season),
    fontSize: z.number().min(12).max(30).default(DEFAULT_APPEARANCE.fontSize),
    readingWidth: z.number().min(480).max(1440).default(DEFAULT_APPEARANCE.readingWidth),
    bubbles: z.boolean().default(DEFAULT_APPEARANCE.bubbles),
    background: z.union(['plain', 'illustrated', 'custom']).default(DEFAULT_APPEARANCE.background),
    backgroundColor: z.string().default(DEFAULT_APPEARANCE.backgroundColor),
    backgroundImage: z.union([z.string(), z.const(null)]).default(null),
  }).default({ ...DEFAULT_APPEARANCE }).volatile(),
});

declare module '@deepseek-ai/cordis' { interface Context { rpAppearance: RpAppearanceService } }

/** Owns local theme files and display preferences, never roleplay state. */
export class RpAppearanceService extends TypertRemoteService {
  static inject = ['settings'];
  static Config = Config;
  private readonly preferences: AppearancePreferencesController;
  private readonly themes: ThemeLibrary;
  constructor(ctx: Context, config: Config) {
    super(ctx, 'rpAppearance');
    this.themes = new ThemeLibrary(fileURLToPath(new URL('../themes/', import.meta.url)), join(config.dataDir, 'themes'));
    this.preferences = new AppearancePreferencesController({
      read: () => config.preferences.get(),
      write: async next => {
        this.themes.get(next.skin);
        const ops = Object.entries(next).map(([key, value]) => ({ op: 'set' as const, path: ['preferences', key], value }));
        await ctx.settings.mutate(APPEARANCE_SETTINGS_NAMESPACE, ops);
      },
    });
    ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber));
    ctx.inject(['tools'], scope => {
      scope.effect(() => scope.tools.register(defineTool({
        name: 'tavern_appearance',
        description: '查看主题、调整配色与四季、字号、阅读宽度、气泡和本地背景，也可导出主题或显示偏好。',
        parameters: {
          action: { type: 'string', required: true, enum: ['get', 'update', 'reset', 'export', 'listThemes', 'getTheme', 'exportTheme', 'importTheme'] },
          id: { type: 'string', description: 'getTheme 或 exportTheme 的主题标识。' },
          themeFile: { type: 'object', additionalProperties: false, properties: { filename: { type: 'string', required: true }, base64: { type: 'string', required: true } }, description: '导入本地主题 ZIP；已有标识会返回待玩家确认。' },
          patch: {
            type: 'object', additionalProperties: false, description: 'update 时填写要修改的显示偏好；其余保持原值。',
            properties: {
              skin: { type: 'string', description: '已安装的主题标识；可先 listThemes。' },
              scheme: { type: 'string', enum: ['system', 'light', 'dark'] },
              season: { type: 'string', enum: ['spring', 'summer', 'autumn', 'winter'] },
              fontSize: { type: 'integer', description: '字号，12–30。' },
              readingWidth: { type: 'integer', description: '阅读宽度，480–1440。' },
              bubbles: { type: 'boolean' },
              background: { type: 'string', enum: ['plain', 'illustrated', 'custom'] },
              backgroundColor: { type: 'string', description: '六位十六进制颜色，如 #f7f0df。' },
              backgroundImage: { oneOf: [{ type: 'string' }, { type: 'null' }], description: '本地 PNG、JPEG、WebP 或 GIF 的 data URL；null 清除图片。' },
            },
          },
        },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
        execute: async (args, exec) => {
          exec.signal.throwIfAborted();
          if (args.action === 'update' && !args.patch) throw new Error('请填写要调整的显示偏好');
          if (['getTheme', 'exportTheme'].includes(args.action) && !args.id) throw new Error('请选择主题');
          if (args.action === 'importTheme' && !args.themeFile) throw new Error('请提供本地主题文件');
          const result = args.action === 'get' ? await this.get()
            : args.action === 'update' ? await this.update(args.patch!)
            : args.action === 'reset' ? await this.reset()
            : args.action === 'listThemes' ? await this.listThemes()
            : args.action === 'getTheme' ? await this.getTheme(args.id!)
            : args.action === 'exportTheme' ? await this.exportTheme(args.id!)
            : args.action === 'importTheme' ? await this.importTheme(args.themeFile!) : await this.export();
          exec.signal.throwIfAborted();
          return JSON.stringify(result);
        },
      })), 'tavern-kit-appearance: ordinary assistant actions');
    });
  }
  @Remote
  async get(): Promise<AppearancePreferences> { return this.preferences.get(); }
  @Remote
  async update(patch: AppearancePatch): Promise<AppearancePreferences> { return this.preferences.update(patch); }
  @Remote
  async reset(): Promise<AppearancePreferences> { return this.preferences.reset(); }
  @Remote
  async export(): Promise<AppearanceExport> { return this.preferences.export(); }
  @Remote
  async listThemes(): Promise<ThemeSummary[]> { return this.themes.list(); }
  @Remote
  async getTheme(id: string): Promise<ThemeDocument> { return this.themes.get(id); }
  @Remote
  async importTheme(input: ThemeImportInput): Promise<ThemeImportResult> {
    if (!input.filename.toLowerCase().endsWith('.zip')) throw new Error('请选择主题 ZIP 文件');
    return this.themes.importArchive(base64ToBytes(input.base64), input.overwrite === true);
  }
  @Remote
  async exportTheme(id: string): Promise<ThemeFile> { return { filename: `${id}.theme.zip`, mimeType: 'application/zip', base64: bytesToBase64(this.themes.exportTheme(id)) }; }
}
export default RpAppearanceService;
