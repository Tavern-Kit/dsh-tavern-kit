import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { compileThemeDocument, exportThemeArchive, parseThemeArchive } from './theme.js';

const image = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><path fill="#765" d="M0 0h4v4H0z"/></svg>';
const palette = { '--tk-bg': '#fffef8', '--tk-surface': '#fff', '--tk-text': '#544735', '--tk-muted': '#756953', '--tk-accent': '#50663c' };
function archive(options: { css?: string; id?: string; image?: string; extraManifest?: Record<string, string>; extraFile?: [string, Uint8Array] } = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'theme.json': strToU8(JSON.stringify({ format: 'tavern-kit.theme', formatVersion: 1, id: options.id ?? 'test-garden', name: '信笺花园', description: '本地主题', version: '1.0.0', author: '测试作者', source: 'https://example.org/source', license: { name: 'MIT', files: ['LICENSE.txt'] }, palettes: { light: palette, dark: { ...palette, '--tk-bg': '#232a24', '--tk-text': '#fff6df' } }, stylesheet: 'layout.css', preview: 'assets/preview.svg', scene: { kind: 'image', asset: 'assets/preview.svg' }, seasons: [{ id: 'spring', name: '春信', palettes: { light: palette, dark: palette }, scene: { kind: 'image', asset: 'assets/preview.svg' } }], ...options.extraManifest })),
    'layout.css': strToU8(options.css ?? '.tk-rp .tk-chat-layout{grid-template-columns:15rem 1fr}.tk-rp .tk-reading{background-image:url("assets/preview.svg")}'),
    'assets/preview.svg': strToU8(options.image ?? image),
    'assets/field.woff2': new Uint8Array([119, 79, 70, 50, 2, 4, 8]),
    'LICENSE.txt': strToU8('MIT — 测试作者，完整许可示例。'),
  };
  if (options.extraFile) files[options.extraFile[0]] = options.extraFile[1];
  return zipSync(files);
}

describe('local distributable theme files', () => {
  it('keeps the exact descriptor and every local resource through export and reimport', () => {
    const bytes = archive({ extraManifest: { authorExtension: '保留这个扩展' }, extraFile: ['assets/notes.txt', strToU8('作者说明')] });
    const theme = parseThemeArchive(bytes);
    expect(theme.manifest).toMatchObject({ id: 'test-garden', name: '信笺花园', palettes: { dark: { '--tk-bg': '#232a24' } }, seasons: [{ id: 'spring', name: '春信' }] });
    expect(theme.themeJson).toContain('authorExtension');
    const restored = parseThemeArchive(exportThemeArchive(theme));
    expect(restored).toEqual(theme);
    const output = unzipSync(exportThemeArchive(theme));
    expect(output['assets/field.woff2']).toEqual(new Uint8Array([119, 79, 70, 50, 2, 4, 8]));
    expect(output['LICENSE.txt']).toEqual(strToU8('MIT — 测试作者，完整许可示例。'));
  });

  it('scopes real layout CSS to the RP region and resolves local image and font URLs without fetching', () => {
    const theme = parseThemeArchive(archive({ css: '@font-face{font-family:"Garden";src:url(assets/field.woff2) format("woff2")}@media(min-width:50rem){.tk-rp .tk-chat-layout{grid-template-columns:16rem 1fr}}.tk-rp .tk-reading{background:url("assets/preview.svg");font-family:"Garden"}' }));
    const compiled = compileThemeDocument(theme, 'light', 'spring');
    expect(compiled.css).toContain('data-tk-skin');
    expect(compiled.css).toContain('.tk-rp .tk-chat-layout');
    expect(compiled.css).toContain('data:font/woff2;base64,');
    expect(compiled.css).toContain('data:image/svg+xml;base64,');
    expect(compiled.css).not.toContain('url(assets/');
    expect(compiled.tokens['--tk-bg']).toBe('#fffef8');
    expect(compiled.scene).toMatchObject({ kind: 'image', dataUrl: expect.stringContaining('data:image/svg+xml;base64,') });
  });

  it('uses the requested season palette independently from the resolved light or dark scheme', () => {
    const theme = parseThemeArchive(archive());
    expect(compileThemeDocument(theme, 'dark', 'winter').tokens['--tk-bg']).toBe('#232a24');
    expect(compileThemeDocument(theme, 'dark', 'spring').tokens['--tk-bg']).toBe('#fffef8');
  });

  it.each([
    '@import "https://example.org/remote.css";.tk-rp{color:red}',
    '.tk-rp{background:url(https://example.org/picture.png)}',
    '.tk-rp{background:url(//example.org/picture.png)}',
    'body{background:red}',
    '.tk-rp + .host-shell{display:none}',
    '.tk-rp{background:url(assets/missing.png)}',
  ])('rejects unavailable or outside-RP styles before applying them: %s', css => {
    expect(() => parseThemeArchive(archive({ css }))).toThrow();
  });

  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.org/remote.png"/></svg>',
  ])('rejects script or remote resources inside SVG artwork', svg => {
    expect(() => parseThemeArchive(archive({ image: svg }))).toThrow();
  });
});
