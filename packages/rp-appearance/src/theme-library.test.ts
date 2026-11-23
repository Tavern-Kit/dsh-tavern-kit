import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { strToU8, zipSync } from 'fflate';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeLibrary } from './theme-library.js';

const directories: string[] = [];
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
function files(id = 'classic', name = '经典酒馆'): Record<string, Uint8Array> {
  const palette = { '--tk-bg': '#fff8ee', '--tk-text': '#432', '--tk-surface': '#fff', '--tk-accent': '#765' };
  return { 'theme.json': strToU8(JSON.stringify({ format: 'tavern-kit.theme', formatVersion: 1, id, name, description: '完整本地主题', version: '1.0.0', author: '测试作者', source: '', license: { name: 'MIT', files: ['LICENSE.txt'] }, palettes: { light: palette, dark: { ...palette, '--tk-bg': '#211c23', '--tk-text': '#fff9e6' } }, stylesheet: 'layout.css', preview: 'preview.svg', scene: { kind: 'image', asset: 'preview.svg' } })), 'layout.css': strToU8('.tk-rp .tk-chat-layout{grid-template-columns:14rem 1fr}'), 'preview.svg': strToU8('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path d="M0 0h2v2H0z"/></svg>'), 'LICENSE.txt': strToU8('MIT original copyright') };
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'tk-themes-'));
  directories.push(root);
  const builtin = join(root, 'builtin'); const storage = join(root, 'saved');
  const folder = join(builtin, 'classic'); mkdirSync(folder, { recursive: true });
  for (const [name, bytes] of Object.entries(files())) writeFileSync(join(folder, name), bytes);
  return { builtin, storage, library: new ThemeLibrary(builtin, storage) };
}

describe('local theme library', () => {
  it('exports a builtin through the same parser and imports its full content into a clean library', () => {
    const first = fixture(); const second = fixture();
    const exported = first.library.exportTheme('classic');
    expect(first.library.list()).toMatchObject([{ id: 'classic', builtin: true, previewDataUrl: expect.stringContaining('data:image/svg+xml;base64,') }]);
    const result = second.library.importArchive(exported, true);
    expect(result).toMatchObject({ status: 'imported', theme: { id: 'classic', builtin: false } });
    expect(second.library.get('classic')).toEqual(first.library.get('classic'));
    expect(new ThemeLibrary(second.builtin, second.storage).get('classic')).toEqual(first.library.get('classic'));
  });

  it('does not replace an existing id until the caller confirms, then persists the whole archive', () => {
    const { library, builtin, storage } = fixture();
    const changed = zipSync(files('classic', '原木酒馆'));
    expect(library.importArchive(changed)).toMatchObject({ status: 'needs-confirmation', theme: { id: 'classic', name: '原木酒馆' } });
    expect(library.get('classic').manifest.name).toBe('经典酒馆');
    expect(library.importArchive(changed, true)).toMatchObject({ status: 'imported', theme: { id: 'classic', name: '原木酒馆' } });
    expect(new ThemeLibrary(builtin, storage).get('classic').manifest.name).toBe('原木酒馆');
    expect(readFileSync(join(storage, 'classic.zip'))).toEqual(Buffer.from(changed));
    expect(library.exportTheme('classic')).toEqual(changed);
  });

  it('rejects a malformed incoming theme before changing any current theme', () => {
    const { library } = fixture();
    const broken = files('letters', '晚安信'); delete broken['LICENSE.txt'];
    expect(() => library.importArchive(zipSync(broken))).toThrow('LICENSE.txt');
    expect(library.list().map(theme => theme.id)).toEqual(['classic']);
    expect(() => library.get('letters')).toThrow();
  });
});
