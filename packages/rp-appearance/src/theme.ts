import { generate, parse, walk, type CssNode, type WalkContext } from 'css-tree';
import { DOMParser } from '@xmldom/xmldom';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { z } from 'zod';
import type { AppearanceSeason, ResolvedScheme, ThemeDocument, ThemeManifest, ThemeResource, ThemeTokens } from './types.js';

export const THEME_FORMAT_VERSION = 1;
export const THEME_ID = /^[a-z][a-z0-9._-]{0,79}$/;
const pathSchema = z.string().min(1).max(240).refine(isLocalPath, '主题资源必须使用包内相对路径');
const tokensSchema = z.record(z.string().regex(/^--tk-[a-z0-9-]+$/), z.string().min(1).max(8192));
const palettesSchema = z.object({ light: tokensSchema, dark: tokensSchema });
const sceneSchema = z.object({ kind: z.enum(['image', 'xi4u']), asset: pathSchema.optional() });
export const ThemeManifestSchema = z.object({
  format: z.literal('tavern-kit.theme'), formatVersion: z.literal(1), id: z.string().regex(THEME_ID),
  name: z.string().min(1).max(100), description: z.string().max(2000), version: z.string().min(1).max(80),
  author: z.string().min(1).max(200), source: z.string().max(2048),
  license: z.object({ name: z.string().min(1).max(200), files: z.array(pathSchema).min(1) }),
  palettes: palettesSchema, stylesheet: z.literal('layout.css'), preview: pathSchema, scene: sceneSchema,
  seasons: z.array(z.object({ id: z.enum(['spring', 'summer', 'autumn', 'winter']), name: z.string().min(1).max(100), palettes: palettesSchema.optional(), scene: sceneSchema.optional() })).optional(),
});
export interface CompiledTheme { css: string; tokens: ThemeTokens; scene: { kind: 'image' | 'xi4u'; dataUrl?: string } }

export function isLocalPath(path: string): boolean {
  return !path.startsWith('/') && !path.includes('\\') && !path.includes('\0') && !path.includes(':') && !/[?#]/.test(path)
    && path.split('/').every(part => part.length > 0 && part !== '.' && part !== '..');
}
export function bytesToBase64(bytes: Uint8Array): string {
  let text = '';
  for (let offset = 0; offset < bytes.length; offset += 32768) text += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
  return btoa(text);
}
export function base64ToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new TypeError('主题文件的编码不正确');
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}
export function resourceDataUrl(resource: ThemeResource): string { return `data:${resource.mimeType};base64,${resource.base64}`; }
export function themeResource(theme: ThemeDocument, path: string): ThemeResource {
  const resource = theme.resources.find(item => item.path === path);
  if (!resource) throw new Error(`主题缺少资源：${path}`);
  return resource;
}
export function mimeType(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase();
  const types: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain', md: 'text/markdown', json: 'application/json' };
  return types[extension ?? ''] ?? 'application/octet-stream';
}
function syntax(css: string, context: 'stylesheet' | 'value' = 'stylesheet'): CssNode {
  return parse(css, { context, parseCustomProperty: true, onParseError: error => { throw error; } });
}
function resolveUrl(path: string, resources: readonly ThemeResource[]): string {
  if (path.startsWith('#')) return path;
  if (!isLocalPath(path)) throw new Error(`主题样式只能引用包内资源：${path}`);
  const resource = resources.find(item => item.path === path);
  if (!resource) throw new Error(`主题缺少资源：${path}`);
  return resourceDataUrl(resource);
}
function validateArtwork(resource: ThemeResource): void {
  if (resource.mimeType !== 'image/svg+xml') return;
  const text = strFromU8(base64ToBytes(resource.base64));
  const invalidSvg = (): never => { throw new Error('主题插画不是有效的 SVG'); };
  const doc = new DOMParser({ errorHandler: { warning: () => {}, error: invalidSvg, fatalError: invalidSvg } }).parseFromString(text, 'image/svg+xml');
  if (doc.doctype) throw new Error('主题插画不能包含外部文档声明');
  const elements = doc.getElementsByTagName('*');
  for (let index = 0; index < elements.length; index++) {
    const element = elements.item(index);
    if (!element) continue;
    if (['script', 'foreignobject', 'iframe', 'object', 'embed'].includes(element.localName.toLowerCase())) throw new Error('主题插画不能包含脚本或页面');
    for (let attrIndex = 0; attrIndex < element.attributes.length; attrIndex++) {
      const attribute = element.attributes.item(attrIndex);
      if (!attribute) continue;
      const name = attribute.localName.toLowerCase();
      if (name.startsWith('on')) throw new Error('主题插画不能包含事件脚本');
      if ((name === 'href' || name === 'src') && attribute.value && !attribute.value.startsWith('#')) throw new Error('主题 SVG 请直接包含插画，不引用外部图片');
      if (attribute.value.includes('url(')) {
        walk(syntax(attribute.value, 'value'), node => { if (node.type === 'Url' && !node.value.startsWith('#')) throw new Error('主题 SVG 只能引用自己的矢量定义'); });
      }
    }
    if (element.localName.toLowerCase() === 'style' && element.textContent) {
      walk(syntax(element.textContent), node => {
        if (node.type === 'Atrule' && node.name.toLowerCase() === 'import') throw new Error('主题 SVG 不能加载外部样式');
        if (node.type === 'Url' && !node.value.startsWith('#')) throw new Error('主题 SVG 只能引用自己的矢量定义');
      });
    }
  }
}
function compiledCss(css: string, id: string, resources: readonly ThemeResource[]): string {
  const ast = syntax(css);
  walk(ast, {
    enter(this: WalkContext, node: CssNode) {
      if (node.type === 'Raw') throw new Error('主题样式包含无法解析的内容');
      if (node.type === 'Atrule' && !['media', 'supports', 'container', 'font-face', 'keyframes', '-webkit-keyframes', 'layer'].includes(node.name.toLowerCase())) throw new Error(`主题不支持 @${node.name}，请使用包内样式与资源`);
      if (node.type === 'Url') node.value = resolveUrl(node.value, resources);
      if (node.type === 'Function' && ['expression', 'image-set', '-webkit-image-set'].includes(node.name.toLowerCase())) throw new Error('主题图片请使用 url() 引用包内资源');
      if (node.type !== 'Rule' || this.atrule?.name.toLowerCase().includes('keyframes')) return;
      if (node.prelude.type !== 'SelectorList') throw new Error('主题样式必须使用明确的 RP 选择器');
      const selectors = node.prelude.children.toArray();
      for (const selector of selectors) {
        if (selector.type !== 'Selector') throw new Error('主题选择器格式不正确');
        const parts = selector.children.toArray();
        const first = parts[0];
        if (first?.type !== 'ClassSelector' || first.name !== 'tk-rp') throw new Error('主题样式必须从 .tk-rp 区域开始');
        let inside = false;
        for (const part of parts) {
          if (part.type === 'Combinator') {
            if (!inside && (part.name === '+' || part.name === '~')) throw new Error('主题样式不能跨出 RP 区域');
            inside = true;
          }
          if (part.type === 'TypeSelector' && ['html', 'body'].includes(part.name.toLowerCase())) throw new Error('主题样式不能修改宿主页面');
        }
      }
      const scopedSelectors = parse(selectors.map(selector => `:root[data-tk-skin="${id}"] ${generate(selector)}`).join(','), { context: 'selectorList' });
      if (scopedSelectors.type !== 'SelectorList') throw new Error('主题选择器解析失败');
      node.prelude = scopedSelectors;
    },
  });
  return generate(ast);
}
export function parseThemeArchive(bytes: Uint8Array): ThemeDocument {
  if (bytes.byteLength > 64 * 1024 * 1024) throw new Error('主题文件超过 64 MiB');
  let total = 0;
  const files = unzipSync(bytes, { filter: file => {
    if (file.name.endsWith('/')) return false;
    if (!isLocalPath(file.name)) throw new Error(`主题文件路径不正确：${file.name}`);
    total += file.originalSize;
    if (total > 128 * 1024 * 1024) throw new Error('主题解包内容超过 128 MiB');
    return true;
  } });
  const descriptor = files['theme.json'];
  const stylesheet = files['layout.css'];
  if (!descriptor || !stylesheet) throw new Error('主题根目录需要 theme.json 和 layout.css');
  const themeJson = strFromU8(descriptor);
  const manifest: ThemeManifest = ThemeManifestSchema.parse(JSON.parse(themeJson) as unknown);
  const resources = Object.entries(files).filter(([path]) => path !== 'theme.json' && path !== 'layout.css').map(([path, data]) => ({ path, mimeType: mimeType(path), base64: bytesToBase64(data) }));
  for (const resource of resources) {
    if (/\.(?:js|mjs|cjs|html?|xhtml)$/i.test(resource.path)) throw new Error('主题文件只包含样式、本地素材和许可，不包含脚本或页面');
    validateArtwork(resource);
  }
  const document: ThemeDocument = { manifest, themeJson, css: strFromU8(stylesheet), resources };
  for (const path of [manifest.preview, ...manifest.license.files]) themeResource(document, path);
  for (const scene of [manifest.scene, ...(manifest.seasons ?? []).map(item => item.scene).filter(item => item !== undefined)]) if (scene.kind === 'image') {
    if (!scene.asset) throw new Error('图片场景需要声明包内素材');
    themeResource(document, scene.asset);
  }
  compiledCss(document.css, manifest.id, resources);
  for (const palettes of [manifest.palettes, ...(manifest.seasons ?? []).map(item => item.palettes).filter(item => item !== undefined)]) for (const tokens of [palettes.light, palettes.dark]) for (const value of Object.values(tokens)) {
    walk(syntax(value, 'value'), node => { if (node.type === 'Url') resolveUrl(node.value, resources); if (node.type === 'Raw') throw new Error('主题 token 格式不正确'); });
  }
  return document;
}
export function exportThemeArchive(theme: ThemeDocument): Uint8Array {
  const files: Record<string, Uint8Array> = { 'theme.json': strToU8(theme.themeJson), 'layout.css': strToU8(theme.css) };
  for (const resource of theme.resources) files[resource.path] = base64ToBytes(resource.base64);
  return zipSync(files);
}
export function compileThemeDocument(theme: ThemeDocument, scheme: ResolvedScheme, season: AppearanceSeason): CompiledTheme {
  const variant = theme.manifest.seasons?.find(item => item.id === season);
  const source = variant?.palettes?.[scheme] ?? theme.manifest.palettes[scheme];
  const tokens: ThemeTokens = {};
  for (const [key, value] of Object.entries(source)) {
    const ast = syntax(value, 'value');
    walk(ast, node => { if (node.type === 'Url') node.value = resolveUrl(node.value, theme.resources); });
    tokens[key] = generate(ast);
  }
  const scene = variant?.scene ?? theme.manifest.scene;
  return { css: compiledCss(theme.css, theme.manifest.id, theme.resources), tokens, scene: scene.kind === 'xi4u' ? { kind: 'xi4u' } : { kind: 'image', dataUrl: resourceDataUrl(themeResource(theme, scene.asset ?? theme.manifest.preview)) } };
}
