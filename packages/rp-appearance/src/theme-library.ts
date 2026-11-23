import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { parseThemeArchive, resourceDataUrl, themeResource } from './theme.js';
import type { ThemeDocument, ThemeImportResult, ThemeSummary } from './types.js';

interface StoredTheme { document: ThemeDocument; archive: Uint8Array; builtin: boolean }
function directoryFiles(root: string, prefix = ''): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) Object.assign(files, directoryFiles(root, path));
    else if (entry.isFile()) files[path] = new Uint8Array(readFileSync(join(root, path)));
  }
  return files;
}
function summarize(theme: StoredTheme): ThemeSummary {
  const { manifest } = theme.document;
  return { id: manifest.id, name: manifest.name, description: manifest.description, version: manifest.version, author: manifest.author, license: manifest.license.name, previewDataUrl: resourceDataUrl(themeResource(theme.document, manifest.preview)), builtin: theme.builtin, scene: manifest.scene.kind, seasons: manifest.seasons?.map(item => item.id) ?? [] };
}

/** Builtins and imported original archives are validated by the same offline parser. */
export class ThemeLibrary {
  private readonly entries = new Map<string, StoredTheme>();
  constructor(builtinDirectory: string, private readonly storageDirectory: string) {
    for (const entry of readdirSync(builtinDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const archive = zipSync(directoryFiles(join(builtinDirectory, entry.name)));
      const document = parseThemeArchive(archive);
      if (this.entries.has(document.manifest.id)) throw new Error(`内置主题标识重复：${document.manifest.id}`);
      this.entries.set(document.manifest.id, { document, archive, builtin: true });
    }
    if (existsSync(storageDirectory)) for (const file of readdirSync(storageDirectory)) {
      if (!file.endsWith('.zip')) continue;
      const archive = new Uint8Array(readFileSync(join(storageDirectory, file)));
      const document = parseThemeArchive(archive);
      this.entries.set(document.manifest.id, { document, archive, builtin: false });
    }
  }
  list(): ThemeSummary[] { return [...this.entries.values()].map(summarize); }
  get(id: string): ThemeDocument {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`找不到主题：${id}`);
    return structuredClone(entry.document);
  }
  importArchive(bytes: Uint8Array, overwrite = false): ThemeImportResult {
    const document = parseThemeArchive(bytes);
    const entry: StoredTheme = { document, archive: Uint8Array.from(bytes), builtin: false };
    if (this.entries.has(document.manifest.id) && !overwrite) return { status: 'needs-confirmation', theme: summarize(entry) };
    mkdirSync(this.storageDirectory, { recursive: true });
    writeFileSync(join(this.storageDirectory, `${document.manifest.id}.zip`), bytes);
    this.entries.set(document.manifest.id, entry);
    return { status: 'imported', theme: summarize(entry) };
  }
  exportTheme(id: string): Uint8Array {
    const entry = this.entries.get(id);
    if (!entry) throw new Error(`找不到主题：${id}`);
    return Uint8Array.from(entry.archive);
  }
}
