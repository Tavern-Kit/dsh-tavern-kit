// Markup extraction adapted from the MagVarUpdate native profile; see LICENSE-MagVarUpdate.
// This scanner recognizes data boundaries only. JavaScript syntax is parsed by Acorn.
export interface Block { kind: 'update' | 'patch' | 'init'; start: number; end: number; contentStart: number; contentEnd: number; closed: boolean; discarded: boolean }
interface Tag { kind: Block['kind']; closing: boolean; start: number; end: number }
export function scanMarkup(input: string): { visible: string; blocks: Block[]; tagged: boolean } {
  const visible = input.split(''), tags: Tag[] = [], ignored: string[] = [];
  let mode: 'json' | 'yaml' | undefined, pending = true, quote = '', escaped = false, blockComment = false;
  let scalarIndent: number | undefined, lineStart = 0, markupDepth = 0, flowDepth = 0;
  const explicit = /<(?:updatevariable|variableupdate|update|json_?patch)\b[^>]*>/iu.test(input);
  const tagPattern = /^<(\/?)\s*(updatevariable|variableupdate|update|json_?patch|initvar|think|thinking|reasoning|analysis|analyze)\b[^>]*>/iu;
  const thinking = /^(?:think|thinking|reasoning|analysis|analyze)$/u;
  const hide = (start: number, end: number) => { for (let n = start; n < end; n++) if (input[n] !== '\n' && input[n] !== '\r') visible[n] = ' '; };
  for (let index = 0; index < input.length; index++) {
    const char = input[index]!;
    if (index === lineStart && pending && !ignored.length) {
      const first = input.slice(index).trimStart();
      if (/^(?:[\[{]|\/\/|\/\*|_\.)/u.test(first)) mode = 'json';
      else if (/^(?:-(?:\s|$)|#|[\p{L}\p{N}_]+\s*:)/u.test(first)) mode = 'yaml';
    }
    if (index === lineStart && mode === 'yaml' && !quote && !ignored.length) {
      let end = input.indexOf('\n', index); if (end < 0) end = input.length;
      const line = input.slice(index, end).replace(/\r$/u, ''), indent = /^\s*/u.exec(line)![0].length;
      if (scalarIndent !== undefined) {
        if (!line.trim() || indent > scalarIndent) { index = end; lineStart = end + 1; continue; }
        scalarIndent = undefined;
      }
      if (/^\s*(?:-\s+)?[^#\r\n]*:\s*[|>](?:[+-]?[1-9]?|[1-9][+-]?)\s*(?:#.*)?$/u.test(line)) {
        scalarIndent = indent + (line.trimStart().startsWith('- ') ? 2 : 0); pending = false;
        index = end; lineStart = end + 1; continue;
      }
    }
    if (index === lineStart && !quote && !ignored.length && /^[ \t]*```/u.test(input.slice(index))) {
      const end = input.indexOf('\n', index);
      index = end < 0 ? input.length : end; lineStart = index + 1; continue;
    }
    if (char === '\n') lineStart = index + 1;
    if (ignored.length) {
      const tag = tagPattern.exec(input.slice(index));
      if (tag && thinking.test(tag[2]!.toLowerCase())) {
        const name = tag[2]!.toLowerCase();
        if (tag[1] && name === ignored.at(-1)) ignored.pop();
        else if (!tag[1]) ignored.push(name);
        hide(index, index + tag[0].length); index += tag[0].length - 1;
        if (!ignored.length) pending = true;
      } else hide(index, index + 1);
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\' && (mode !== 'yaml' || quote === '"')) escaped = true;
      else if (char === quote) {
        if (mode === 'yaml' && quote === "'" && input[index + 1] === "'") index++;
        else quote = '';
      }
      continue;
    }
    if (blockComment) { if (input.startsWith('*/', index)) { index++; blockComment = false; } continue; }
    if (char === '<') {
      const tag = tagPattern.exec(input.slice(index));
      if (tag) {
        const name = tag[2]!.toLowerCase(), closing = Boolean(tag[1]);
        if (thinking.test(name)) { if (!closing) ignored.push(name); hide(index, index + tag[0].length); }
        else {
          markupDepth = Math.max(0, markupDepth + (closing ? -1 : 1));
          tags.push({ kind: name.startsWith('json') ? 'patch' : name === 'initvar' ? 'init' : 'update', closing, start: index, end: index + tag[0].length });
          mode = undefined; scalarIndent = undefined; flowDepth = 0; pending = !closing;
        }
        index += tag[0].length - 1; continue;
      }
    }
    if (pending && char.trim()) {
      if (input.startsWith('```', index)) {
        const end = input.indexOf('\n', index);
        if (end >= 0) { index = end; lineStart = end + 1; continue; }
      }
      if (char === '[' || char === '{' || input.startsWith('_.', index)) mode = 'json';
      else if (/^(?:-(?:\s|$)|[\p{L}\p{N}_]+\s*:)/u.test(input.slice(index))) mode = 'yaml';
      pending = false;
    }
    if (mode === 'yaml' && (char === '{' || char === '[')) flowDepth++;
    if (mode === 'yaml' && (char === '}' || char === ']')) flowDepth = Math.max(0, flowDepth - 1);
    const proseApostrophe = explicit && markupDepth === 0 && char === "'" && /[\p{L}\p{N}]/u.test(input[index - 1] ?? '');
    if (mode && (char === '"' || char === "'" || char === '`') && !proseApostrophe) quote = char;
    else if (mode === 'json' && input.startsWith('/*', index)) { blockComment = true; index++; }
    else if (mode === 'json' && input.startsWith('//', index) || mode === 'yaml' && char === '#' && (index === lineStart || !input[index - 1]?.trim())) {
      const end = input.indexOf('\n', index); index = (end < 0 ? input.length : end) - 1;
    } else if (mode === 'yaml' && flowDepth === 0 && char === ':' && /\s/u.test(input[index + 1] ?? '')) {
      const rest = /^[ \t]+([^\s"'[{|>#\r\n][^\r\n]*)/u.exec(input.slice(index + 1));
      if (rest) index += rest[0].length;
    }
  }
  const blocks: Block[] = [];
  for (const kind of ['update', 'patch', 'init'] as const) {
    const openings: Tag[] = [];
    for (const tag of tags.filter(tag => tag.kind === kind)) {
      if (!tag.closing) openings.push(tag);
      else if (openings.length) {
        const opening = openings.pop()!;
        blocks.push({ kind, start: opening.start, end: tag.end, contentStart: opening.end, contentEnd: tag.start, closed: true, discarded: kind === 'patch' && input.startsWith('<!-- mvu:discard-incomplete-json-patch -->', tag.end) });
      }
    }
    for (const opening of openings) blocks.push({ kind, start: opening.start, end: input.length, contentStart: opening.end, contentEnd: input.length, closed: false, discarded: false });
  }
  blocks.sort((a, b) => a.start - b.start);
  return { visible: visible.join(''), blocks, tagged: blocks.some(block => block.kind !== 'init') };
}
