import type { AppearancePreferences, AppearanceRemote, AppearancePatch, AppearanceExport, ThemeDocument, ThemeFile, ThemeImportInput, ThemeSummary } from './types.js';

export interface AppearanceClientSnapshot {
  preferences: AppearancePreferences | null;
  theme: ThemeDocument | null;
  themes: ThemeSummary[];
  pendingImport: ThemeSummary | null;
  pending: boolean;
  error: string | null;
}

/** Page-independent presentation state. Theme files and preferences never contain chat data. */
export class AppearanceClientStore {
  private snapshot: AppearanceClientSnapshot = { preferences: null, theme: null, themes: [], pendingImport: null, pending: false, error: null };
  private readonly listeners = new Set<() => void>();
  private readonly documents = new Map<string, ThemeDocument>();
  private revision = 0;
  private disposed = false;
  private pendingWrites = 0;
  private importInput: ThemeImportInput | null = null;
  constructor(private readonly remote: AppearanceRemote, private readonly apply: (preferences: AppearancePreferences, theme: ThemeDocument) => void) {}
  getSnapshot = (): AppearanceClientSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private publish(next: AppearanceClientSnapshot): void {
    if (this.disposed) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
  private async document(id: string): Promise<ThemeDocument> {
    const cached = this.documents.get(id);
    if (cached) return cached;
    const document = await this.remote.getTheme(id);
    this.documents.set(id, document);
    return document;
  }
  private async accept(preferences: AppearancePreferences, revision: number): Promise<void> {
    const theme = await this.document(preferences.skin);
    if (this.disposed || revision !== this.revision) return;
    this.apply(preferences, theme);
    this.publish({ ...this.snapshot, preferences, theme, pending: this.pendingWrites > 0, error: null });
  }
  async load(): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.documents.clear();
    try {
      const [preferences, themes] = await Promise.all([this.remote.get(), this.remote.listThemes()]);
      if (revision !== this.revision || this.disposed) return;
      this.publish({ ...this.snapshot, themes, error: null });
      await this.accept(preferences, revision);
    } catch (error) { if (revision === this.revision) this.error(error instanceof Error ? error.message : String(error)); }
  }
  async update(patch: AppearancePatch): Promise<void> { await this.write(() => this.remote.update(patch)); }
  async reset(): Promise<void> { await this.write(() => this.remote.reset()); }
  private async write(action: () => Promise<AppearancePreferences>): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.pendingWrites++;
    this.publish({ ...this.snapshot, pending: true, error: null });
    try { await this.accept(await action(), revision); }
    catch (error) { this.error(error instanceof Error ? error.message : String(error)); }
    finally { this.pendingWrites--; this.publish({ ...this.snapshot, pending: this.pendingWrites > 0 }); }
  }
  async importArchive(input: ThemeImportInput): Promise<void> {
    if (this.disposed) return;
    this.publish({ ...this.snapshot, pending: true, error: null });
    try {
      const result = await this.remote.importTheme(input);
      if (this.disposed) return;
      if (result.status === 'needs-confirmation') {
        this.importInput = { filename: input.filename, base64: input.base64 };
        this.publish({ ...this.snapshot, pendingImport: result.theme, pending: false });
      } else {
        this.importInput = null;
        this.publish({ ...this.snapshot, pendingImport: null, pending: false });
        await this.load();
      }
    } catch (error) { this.publish({ ...this.snapshot, pending: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  async confirmImport(): Promise<void> { if (this.importInput) await this.importArchive({ ...this.importInput, overwrite: true }); }
  cancelImport(): void { this.importInput = null; this.publish({ ...this.snapshot, pendingImport: null }); }
  async exportTheme(id: string): Promise<ThemeFile | null> {
    try { return await this.remote.exportTheme(id); }
    catch (error) { this.error(error instanceof Error ? error.message : String(error)); return null; }
  }
  async export(): Promise<AppearanceExport | null> {
    try { return await this.remote.export(); }
    catch (error) { this.error(error instanceof Error ? error.message : String(error)); return null; }
  }
  error(message: string): void { this.publish({ ...this.snapshot, error: message }); }
  dispose(): void { this.disposed = true; this.revision++; this.importInput = null; this.documents.clear(); this.listeners.clear(); }
}
