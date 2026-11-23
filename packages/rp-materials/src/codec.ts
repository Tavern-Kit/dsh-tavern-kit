// Containers follow SillyTavern's ccv3/chara priority and dsh-Go's original-byte/
// local-resource separation. See SOURCES.md for revisions and AGPL attributions.
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import extract from 'png-chunks-extract';
import PNGText from 'png-chunk-text';
import { unzipSync } from 'fflate';
import { jsonrepair } from 'jsonrepair';
import { MaterialError, validateJson } from './json.js';
import { projectMaterial } from './projection.js';
import { personaResources } from './persona.js';
import type { DecodedMaterial, JsonValue, MaterialInput, MaterialResource } from './types.js';

const MAX_BYTES = 128 * 1024 * 1024;
const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const isPng = (bytes: Uint8Array) => signature.every((value, index) => bytes[index] === value);
const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;
const utf8 = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes);

function readJson(bytes: Uint8Array): { raw: JsonValue; rawText: string } {
  let source: string;
  try { source = utf8(bytes).replace(/^\uFEFF/u, ''); }
  catch { throw new MaterialError('INVALID_JSON', '素材文字不是有效 UTF-8'); }
  let value: unknown;
  try { value = JSON.parse(source) as unknown; }
  catch {
    try { value = JSON.parse(jsonrepair(source)) as unknown; }
    catch { throw new MaterialError('INVALID_JSON', '素材 JSON 没有读完整，请检查文件'); }
  }
  return { raw: validateJson(value), rawText: source };
}
function safePath(path: string): string {
  if (!path || path.startsWith('/') || /[\u0000-\u001f\\:]/u.test(path) || path.split('/').some(segment => segment === '..' || segment === '.')) {
    throw new MaterialError('RESOURCE_PATH', '素材包中的本地资源路径无效');
  }
  return path;
}
export function resourceMediaType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  return ({ png: 'image/png', apng: 'image/apng', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif', txt: 'text/plain', json: 'application/json', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream';
}
function pngText(name: string, data: Uint8Array): { keyword: string; text: string } | null {
  if (name === 'tEXt') return PNGText.decode(data);
  if (name !== 'zTXt' && name !== 'iTXt') return null;
  const split = data.indexOf(0);
  if (split < 1) return null;
  const keyword = Buffer.from(data.subarray(0, split)).toString('latin1');
  if (name === 'zTXt') {
    if (data[split + 1] !== 0) throw new MaterialError('PNG_TEXT', 'PNG 文本压缩格式无效');
    return { keyword, text: inflateSync(data.subarray(split + 2), { maxOutputLength: MAX_BYTES }).toString('latin1') };
  }
  const compressed = data[split + 1];
  if ((compressed !== 0 && compressed !== 1) || data[split + 2] !== 0) throw new MaterialError('PNG_TEXT', 'PNG 文本格式无效');
  const languageEnd = data.indexOf(0, split + 3);
  const translatedEnd = languageEnd >= 0 ? data.indexOf(0, languageEnd + 1) : -1;
  if (translatedEnd < 0) throw new MaterialError('PNG_TEXT', 'PNG 文本没有读完整');
  const body = data.subarray(translatedEnd + 1);
  return { keyword, text: utf8(compressed ? inflateSync(body, { maxOutputLength: MAX_BYTES }) : body) };
}
function readPng(bytes: Uint8Array): { raw: JsonValue; rawText: string; resources: MaterialResource[] } {
  try {
    const metadata = extract(bytes).flatMap(chunk => {
      const value = pngText(chunk.name, chunk.data);
      return value ? [value] : [];
    });
    const selected = metadata.find(item => item.keyword.toLowerCase() === 'ccv3') ?? metadata.find(item => item.keyword.toLowerCase() === 'chara');
    if (!selected) throw new MaterialError('PNG_NO_CARD', 'PNG 中没有 ccv3 或 chara 角色卡');
    const source = readJson(Buffer.from(selected.text, 'base64'));
    const resources: MaterialResource[] = [{ path: 'ccdefault:', mediaType: 'image/png', bytes: Uint8Array.from(bytes) }];
    for (const item of metadata) {
      if (!item.keyword.startsWith('chara-ext-asset_:')) continue;
      const path = safePath(item.keyword.slice('chara-ext-asset_:'.length));
      if (resources.some(resource => resource.path === path)) throw new MaterialError('RESOURCE_DUPLICATE', 'PNG 中有重复的资源路径');
      resources.push({ path, mediaType: resourceMediaType(path), bytes: Buffer.from(item.text, 'base64') });
    }
    return { ...source, resources };
  } catch (error) {
    if (error instanceof MaterialError) throw error;
    throw new MaterialError('PNG_INVALID', 'PNG 角色卡没有读完整');
  }
}

/** Pure offline decoder. It neither opens paths nor evaluates or downloads referenced content. */
export function decodeMaterial(input: MaterialInput): DecodedMaterial {
  if (!(input.bytes instanceof Uint8Array) || !input.bytes.byteLength || input.bytes.byteLength > MAX_BYTES) throw new MaterialError('FILE_SIZE', '请选择有效素材文件（最大 128 MiB）');
  const fileName = input.name.split(/[\\/]/u).pop()?.replace(/[\u0000-\u001f\u007f]/gu, '').slice(0, 255) || '素材.json';
  const originalBytes = Uint8Array.from(input.bytes);
  let body: Uint8Array = originalBytes;
  let format: DecodedMaterial['format'] = 'json';
  const resources: MaterialResource[] = [];
  if (isZip(body)) {
    let files: Record<string, Uint8Array>;
    try {
      let total = 0;
      files = unzipSync(body, { filter(entry) {
        total += entry.originalSize;
        if (total > MAX_BYTES) throw new MaterialError('ARCHIVE_SIZE', '解压后的素材超过 128 MiB');
        return !entry.name.endsWith('/');
      } });
    } catch (error) {
      if (error instanceof MaterialError) throw error;
      throw new MaterialError('ARCHIVE_INVALID', '素材压缩包没有读完整');
    }
    for (const path of Object.keys(files)) safePath(path);
    const charx = /\.charx$/iu.test(fileName);
    const candidates = charx ? (files['card.json'] ? ['card.json'] : []) : Object.keys(files).filter(path => /\.(?:png|json)$/iu.test(path));
    if (!candidates.length) throw new MaterialError('ARCHIVE_EMPTY', charx ? 'CharX 根目录中没有 card.json' : '压缩包中没有可识别的角色卡或 JSON 素材');
    if (candidates.length !== 1) throw new MaterialError('ARCHIVE_MULTIPLE', '压缩包包含多份素材，请解压后逐个导入');
    const selected = candidates[0]!;
    body = files[selected]!;
    format = charx ? 'charx' : 'zip';
    if (isZip(body)) throw new MaterialError('ARCHIVE_NESTED', '请先解压嵌套的素材压缩包');
    for (const [path, bytes] of Object.entries(files)) if (path !== selected) resources.push({ path, mediaType: resourceMediaType(path), bytes: Uint8Array.from(bytes) });
  }
  let source: { raw: JsonValue; rawText: string };
  const image = isPng(body);
  if (image) {
    const parsed = readPng(body);
    source = parsed;
    resources.push(...parsed.resources);
    if (format === 'json') format = 'png';
  } else if (/\.(?:js|mjs|cjs)$/iu.test(fileName) && format === 'json') {
    const rawText = utf8(body);
    source = { rawText, raw: { type: 'script', name: fileName.replace(/\.[^.]+$/u, ''), content: rawText } };
    format = 'script';
  } else source = readJson(body);
  const normalized = projectMaterial(source.raw, fileName, input.kind);
  if (normalized.projection.kind === 'persona') resources.push(...personaResources(source.raw));
  if (image && normalized.projection.kind !== 'character') throw new MaterialError('PNG_NO_CARD', 'PNG 元数据不是角色卡');
  if (format === 'charx' && normalized.projection.kind !== 'character') throw new MaterialError('CHARX_NO_CARD', 'card.json 不是角色卡');
  return { fileName, format, contentHash: createHash('sha256').update(originalBytes).digest('hex'), originalBytes, rawText: source.rawText, raw: source.raw, ...normalized, resources };
}
