import { parseExpressionAt, tokenizer, type Expression, type SpreadElement } from 'acorn';
import type { JsonObject, JsonValue } from '@tavern-kit/rp-materials/types';
import type { MvuIssue } from './types.js';
import { isObject, json, parseData, put } from './data.js';
import { scanMarkup } from './markup.js';

export interface Command { type: 'set' | 'add' | 'insert' | 'delete'; args: JsonValue[]; offset: number; source: string; reason: string; pointer?: string[] }
const names = new Set(['set', 'add', 'insert', 'assign', 'remove', 'unset', 'delete']);
const mathFunctions: Record<string, (...args: number[]) => number> = {
  abs: Math.abs, acos: Math.acos, asin: Math.asin, atan: Math.atan, atan2: Math.atan2,
  ceil: Math.ceil, cos: Math.cos, exp: Math.exp, floor: Math.floor, log: Math.log,
  max: Math.max, min: Math.min, pow: Math.pow, round: Math.round, sign: Math.sign,
  sin: Math.sin, sqrt: Math.sqrt, tan: Math.tan, trunc: Math.trunc,
};
function number(value: JsonValue): number {
  if (typeof value !== 'number') throw new TypeError('Arithmetic accepts numeric data only.');
  return value;
}
function evaluate(node: Expression | SpreadElement): JsonValue {
  switch (node.type) {
    case 'Literal': return json(node.value);
    case 'TemplateLiteral':
      if (node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? '';
      break;
    case 'ArrayExpression': return node.elements.map(child => child === null ? null : evaluate(child));
    case 'ObjectExpression': {
      const object: JsonObject = {};
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.kind !== 'init' || property.method || property.computed || property.shorthand) throw new TypeError('Only literal object properties are supported.');
        const key = property.key.type === 'Identifier' ? property.key.name : property.key.type === 'Literal' ? property.key.value : undefined;
        if (typeof key !== 'string' && typeof key !== 'number') throw new TypeError('A data property needs a literal key.');
        put(object, String(key), evaluate(property.value));
      }
      return object;
    }
    case 'UnaryExpression': {
      const value = number(evaluate(node.argument));
      if (node.operator === '+') return json(value);
      if (node.operator === '-') return json(-value);
      break;
    }
    case 'BinaryExpression': {
      if (node.left.type === 'PrivateIdentifier') throw new TypeError('Private names are not data.');
      const left = number(evaluate(node.left)), right = number(evaluate(node.right));
      switch (node.operator) {
        case '+': return json(left + right);
        case '-': return json(left - right);
        case '*': return json(left * right);
        case '/': return json(left / right);
        case '%': return json(left % right);
        case '**': return json(left ** right);
      }
      break;
    }
    case 'MemberExpression':
      if (!node.computed && node.object.type === 'Identifier' && /^(Math|math)$/u.test(node.object.name) && node.property.type === 'Identifier') {
        if (node.property.name === 'PI') return Math.PI;
        if (node.property.name === 'E') return Math.E;
      }
      break;
    case 'CallExpression': {
      const callee = node.callee;
      if (callee.type !== 'MemberExpression' || callee.computed || callee.object.type !== 'Identifier' || !/^(Math|math)$/u.test(callee.object.name) || callee.property.type !== 'Identifier') break;
      const name = callee.property.name, fn = Object.hasOwn(mathFunctions, name) ? mathFunctions[name] : undefined;
      if (!fn) break;
      const args = node.arguments.map(argument => number(evaluate(argument)));
      if ((name === 'pow' || name === 'atan2') ? args.length !== 2 : (name === 'min' || name === 'max') ? args.length < 1 : args.length !== 1) throw new TypeError('Invalid arithmetic arity.');
      return json(fn(...args));
    }
  }
  throw new TypeError(`Unsupported MVU data expression: ${node.type}.`);
}
function value(node: Expression | SpreadElement): JsonValue {
  const result = evaluate(node);
  return typeof result === 'number' && node.type !== 'Literal' ? Number(result.toPrecision(12)) : result;
}
function patchCommands(source: string, offset: number, issues: MvuIssue[]): Command[] {
  let patch: JsonValue;
  try { patch = parseData(source.trim().replace(/^```(?:json5?|ya?ml)?\s*/iu, '').replace(/\s*```$/u, '')); }
  catch (error) { issues.push({ code: 'invalid_patch', message: String(error), source, offset }); return []; }
  if (!Array.isArray(patch) || patch.some(operation => !isObject(operation) || typeof operation.op !== 'string' || typeof operation.path !== 'string')) {
    issues.push({ code: 'invalid_patch', message: 'A patch must be an array of objects with string op and path fields.', source, offset }); return [];
  }
  const commands: Command[] = [];
  for (const operation of patch) {
    if (!isObject(operation) || typeof operation.op !== 'string' || typeof operation.path !== 'string') continue;
    const { op, path } = operation, literal = JSON.stringify(operation);
    if (!['replace', 'delta', 'add', 'insert', 'remove'].includes(op)) { issues.push({ code: 'unsupported_patch_operation', message: `Unsupported MVU patch operation: ${op}.`, source: literal, offset }); continue; }
    if (path !== '' && !path.startsWith('/')) { issues.push({ code: 'invalid_patch', message: 'A patch path must be a JSON pointer.', source: literal, offset }); continue; }
    const pointer = path === '' ? [] : path.slice(1).split('/').map(segment => segment.replace(/~1/gu, '/').replace(/~0/gu, '~'));
    if (op !== 'remove' && !Object.hasOwn(operation, 'value')) { issues.push({ code: 'invalid_command', message: 'A patch update requires a value.', source: literal, offset }); continue; }
    const common = { offset, source: literal, reason: 'json_patch', pointer };
    if (op === 'replace' || op === 'delta') commands.push({ ...common, type: op === 'replace' ? 'set' : 'add', args: [path, operation.value!] });
    else if (op === 'remove') commands.push({ ...common, type: 'delete', args: [path] });
    else if (pointer.length) {
      const key = pointer.at(-1)!;
      commands.push({ ...common, pointer: pointer.slice(0, -1), type: 'insert', args: [path, /^\d+$/u.test(key) ? Number(key) : key, operation.value!] });
    } else issues.push({ code: 'invalid_command', message: 'A patch insertion requires a property or array position.', source: literal, offset });
  }
  return commands;
}

export function extractCommands(input: string, issues: MvuIssue[], blocksOnly = false): Command[] {
  const scanned = scanMarkup(input), commands: Command[] = [], mask = scanned.visible.split('');
  const updates = scanned.blocks.filter(block => block.kind === 'update');
  for (const block of scanned.blocks) {
    if (block.kind === 'init') continue;
    if (!block.closed) issues.push({ code: 'unclosed_update', message: 'An update block is incomplete and is not completed implicitly.', source: input.slice(block.start), offset: block.start });
    if (block.kind === 'patch' && block.closed && !block.discarded && !updates.some(parent => !parent.closed && block.start >= parent.contentStart)) {
      commands.push(...patchCommands(scanned.visible.slice(block.contentStart, block.contentEnd), block.start, issues));
    }
  }
  for (let index = 0; index < mask.length; index++) {
    if (scanned.blocks.some(block => (block.kind === 'patch' || block.kind === 'init') && index >= block.start && index < block.end)) mask[index] = ' ';
    else if ((blocksOnly || scanned.tagged) && !updates.some(block => block.closed && index >= block.contentStart && index < block.contentEnd)) mask[index] = ' ';
    else if (scanned.blocks.some(block => block.kind === 'update' && (index >= block.start && index < block.contentStart || index >= block.contentEnd && index < block.end))) mask[index] = ' ';
  }
  const text = mask.join('');
  // Legacy documents without wrappers must actually begin with a command, not prose.
  if (!scanned.tagged && !blocksOnly && !/^\s*(?:(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*_\s*\./u.test(text)) return commands.sort((a, b) => a.offset - b.offset);
  // Give each closed markup region its own lexer so one malformed literal cannot swallow a later block.
  const boundaries = [...new Set(updates.filter(block => block.closed).flatMap(block => [block.contentStart, block.contentEnd]))].sort((left, right) => left - right);
  const regions = !scanned.tagged && !blocksOnly ? [{ start: 0, end: text.length }] : boundaries.flatMap((start, index) => {
    const end = boundaries[index + 1];
    return end !== undefined && updates.some(block => block.closed && start >= block.contentStart && end <= block.contentEnd) ? [{ start, end }] : [];
  });
  for (const region of regions) commands.push(...legacyCommands(text.slice(region.start, region.end), input.slice(region.start, region.end), region.start, issues));
  return commands.sort((a, b) => a.offset - b.offset);
}

/** Locate a recovery semicolon with Acorn; this temporary lexical view is never parsed as a command. */
function recoveryEnd(text: string, start: number): number {
  let lexical = text, cursor = start;
  while (cursor < text.length) {
    const base = cursor;
    try {
      for (const token of tokenizer(lexical.slice(base), { ecmaVersion: 'latest' })) {
        if (token.type.label === ';') return base + token.end;
        cursor = base + token.end;
      }
      return text.length;
    } catch (error) {
      if (!error || typeof error !== 'object' || !('pos' in error) || typeof error.pos !== 'number' || !('raisedAt' in error) || typeof error.raisedAt !== 'number') return text.length;
      const bad = base + error.pos, raised = base + error.raisedAt;
      if (bad >= text.length) return text.length;
      // Keep a malformed string opaque to recovery, including semicolons and command-like text within it.
      const newline = (lexical[bad] === "'" || lexical[bad] === '"') && /[\r\n\u2028\u2029]/u.test(lexical[raised] ?? '');
      const left = newline ? raised : bad, right = newline ? raised + 1 : Math.max(bad + 1, raised);
      lexical = lexical.slice(0, left) + ' '.repeat(right - left) + lexical.slice(right);
      cursor = bad;
    }
  }
  return text.length;
}

function legacyCommands(text: string, input: string, offset: number, issues: MvuIssue[]): Command[] {
  const commands: Command[] = [];
  let position = 0;
  while (position < text.length) {
    const base = position;
    let found = false;
    try {
      for (const token of tokenizer(text.slice(base), { ecmaVersion: 'latest' })) {
        const start = base + token.start;
        if (token.type.label !== 'name' || text.slice(start, base + token.end) !== '_') continue;
        found = true;
        let end = base + token.end, parsed = false;
        try {
          // Always validate the original source, never the lexical recovery view.
          const expression = parseExpressionAt(text, start, { ecmaVersion: 'latest' });
          parsed = true; end = expression.end;
          if (expression.type !== 'CallExpression' || expression.callee.type !== 'MemberExpression' || expression.callee.computed || expression.callee.object.type !== 'Identifier' || expression.callee.object.name !== '_' || expression.callee.property.type !== 'Identifier' || !names.has(expression.callee.property.name)) throw new TypeError('Only the seven MVU commands are supported.');
          const semicolon = /^\s*;/u.exec(text.slice(end));
          if (!semicolon) throw new TypeError('The command must end with a semicolon.');
          end += semicolon[0].length;
          const type = expression.callee.property.name, args = expression.arguments.map(value);
          if (typeof args[0] !== 'string' || (type === 'add' ? args.length !== 2 : ['set', 'insert', 'assign'].includes(type) ? args.length < 2 : args.length < 1)) throw new TypeError('The command needs a string path and valid arguments.');
          const comment = /^[ \t]*\/\/([^\r\n]*)/u.exec(text.slice(end));
          commands.push({ type: ['remove', 'unset', 'delete'].includes(type) ? 'delete' : type === 'assign' ? 'insert' : type as Command['type'], args, offset: offset + start, source: input.slice(start, end), reason: comment?.[1]?.trim() ?? '' });
        } catch (error) {
          if (!parsed) end = recoveryEnd(text, start);
          issues.push({ code: 'invalid_command', message: error instanceof Error ? error.message : String(error), source: input.slice(start, end), offset: offset + start });
        }
        position = end;
        break;
      }
    } catch (error) {
      const end = recoveryEnd(text, base);
      issues.push({ code: 'invalid_command', message: error instanceof Error ? error.message : String(error), source: input.slice(base, end), offset: offset + base });
      position = end; found = true;
    }
    if (!found) break;
  }
  return commands;
}
