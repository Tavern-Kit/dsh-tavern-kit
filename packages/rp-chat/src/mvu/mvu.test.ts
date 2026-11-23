import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { expandMvu, initializeMvu, readMvuState, updateMvu } from './index.js';
import type { MvuBook } from './types.js';

const book = (name: string, content: string): MvuBook => ({ id: `id-${name}`, name, entries: [{ id: 'initial', comment: '[initvar]', content }] });

describe('MVU JSON carrier and book initialization', () => {
  it('fills missing fields, normalizes legacy book markers, and preserves independent JSON extensions', () => {
    const previous = { stat_data: { count: 1 }, initialized_lorebooks: ['old'], extension: { keep: [true, null] } };
    const state = readMvuState(previous);
    expect(state).toEqual({ stat_data: { count: 1 }, initialized_lorebooks: { old: [] }, schema: {}, display_data: {}, delta_data: {}, extension: { keep: [true, null] } });
    state.stat_data.count = 9;
    expect(previous.stat_data.count).toBe(1);
    expect(readMvuState(undefined).stat_data).toEqual({});
  });

  it.each([null, [], { stat_data: [] }, { schema: null }, { initialized_lorebooks: 17 }, { display_data: false }, { delta_data: 'bad' }, { extra: undefined }, { stat_data: { n: Infinity } }])('rejects invalid imported carrier %# without lossy JSON conversion', value => {
    expect(() => readMvuState(value)).toThrow();
  });

  it('rejects circular imported data rather than dropping its extension fields', () => {
    const value: Record<string, unknown> = {}; value.self = value;
    expect(() => readMvuState(value)).toThrow();
  });

  it.each([
    ['counter: 1\nlabel: YAML', { counter: 1, label: 'YAML' }],
    ["{label: 'JSON5', counter: 0x10,}", { label: 'JSON5', counter: 16 }],
    ['{"counter": 2 "label": "repaired"}', { counter: 2, label: 'repaired' }],
  ] as const)('loads mature YAML/JSON5/repaired JSON data: %s', (source, expected) => {
    const result = initializeMvu([book('source', source)]);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual(expected);
    expect(result.state.initialized_lorebooks).toEqual({ source: [] });
  });

  it('merges new book defaults once while keeping current values and unknown carriers untouched', () => {
    const previous = readMvuState({ stat_data: { counter: 21 }, initialized_lorebooks: { old: [] }, extra: { keep: true } });
    const result = initializeMvu([book('old', 'counter: 999'), book('new-a', 'counter: 99\nprofile: {tags: [a, tail], left: 1}'), book('new-b', 'profile: {tags: [b], right: 2}')], undefined, previous);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ counter: 21, profile: { tags: ['b'], left: 1, right: 2 } });
    expect(result.state.initialized_lorebooks).toEqual({ old: [], 'new-a': [], 'new-b': [] });
    expect(result.state.extra).toEqual({ keep: true });
    expect(previous.stat_data).toEqual({ counter: 21 });
  });

  it('greeting initvar overrides the complete book state then applies only its complete update blocks', () => {
    const result = initializeMvu([book('base', 'counter: 1\nbook_only: true')], `first\n<INITVAR>\n\`\`\`yaml\ncounter: 10\n\`\`\`\n</INITVAR>\n<initvar>branch: {left: 1}</initvar>\n<UpdateVariable>_.add('counter', 1);</UpdateVariable>\n_.add('counter', 100);`);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ counter: 11, branch: { left: 1 } });
    expect(result.state.schema.type).toBe('object');
    expect(result.state.initialized_lorebooks).toEqual({ base: [] });
  });

  it('expands stripped book and greeting data before parsing, then expands greeting updates', () => {
    const declaration = '<initvar>counter: {{initial}}\nwho: "{{user}}"</initvar>';
    const greeting = `<initvar>counter: {{greeting}}\nwho: "{{user}}"</initvar><UpdateVariable>_.add('counter', {{increment}});</UpdateVariable>`;
    const expandedInputs: string[] = [];
    const expand = (text: string) => {
      expandedInputs.push(text);
      return text.replaceAll('{{initial}}', '2').replaceAll('{{greeting}}', '10').replaceAll('{{increment}}', '3').replaceAll('{{user}}', '阿宁');
    };
    const previous = readMvuState({ stat_data: { counter: 5 } });
    const result = initializeMvu([book('macro', declaration)], greeting, previous, expand);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ counter: 13, who: '阿宁' });
    expect(expandedInputs).toEqual(['counter: {{initial}}\nwho: "{{user}}"', 'counter: {{greeting}}\nwho: "{{user}}"', greeting]);
    expect(previous.stat_data).toEqual({ counter: 5 });
    expect(declaration).toContain('{{initial}}');
    expect(greeting).toContain('{{increment}}');
  });

  it('partly invalid book defaults remain retryable and errors identify the actual entry', () => {
    const result = initializeMvu([{ id: 'retry', name: 'retry', entries: [{ id: 'good', comment: '[INITVAR] good', content: 'kept: true' }, { id: 'bad', comment: '[initvar]', content: 'bad: .nan' }, { comment: 'ordinary', content: 'ignored: .nan' }] }]);
    expect(result.state.stat_data).toEqual({ kept: true });
    expect(result.state.initialized_lorebooks).toEqual({});
    expect(result.issues).toMatchObject([{ code: 'invalid_initvar', source: 'book["retry"].entries["bad"]' }]);
    const retried = initializeMvu([book('retry', 'kept: false\nrecovered: true')], undefined, result.state);
    expect(retried.state.stat_data).toEqual({ kept: true, recovered: true });
    expect(retried.state.initialized_lorebooks).toEqual({ retry: [] });
  });
});

describe('MVU closed blocks, legacy commands and per-command results', () => {
  it('executes nested complete blocks in source order, not patch-first order, preserving quoted markup', () => {
    const baseline = readMvuState({ stat_data: { n: 1, label: 'old', 'a.b': { 'x/y': { '~z': 1 } }, '': 0 } });
    const text = `prose _.add('n', 999);\n<thinking><analysis>_.add('n', 1000);</analysis></thinking>\n<UpdateVariable>\n_.add('n', 1);\n<JSONPatch>[{"op":"delta","path":"/n","value":3},{"op":"replace","path":"/label","value":"</UpdateVariable> _.add('n', 900);"},{"op":"delta","path":"/a.b/x~1y/~0z","value":2},{"op":"replace","path":"/","value":7}]</JSONPatch>\n_.add('n', 4);\n</UpdateVariable>`;
    const result = updateMvu(text, baseline);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ n: 9, label: "</UpdateVariable> _.add('n', 900);", 'a.b': { 'x/y': { '~z': 3 } }, '': 7 });
    expect(baseline.stat_data.n).toBe(1);
  });

  it('ignores unclosed blocks and reasoning while keeping earlier complete blocks', () => {
    const result = updateMvu(`<update>_.add('n', 2);</update><think>_.add('n', 100);</think><update>_.add('n', 900);`, readMvuState({ stat_data: { n: 1 } }));
    expect(result.state.stat_data.n).toBe(3);
    expect(result.issues).toMatchObject([{ code: 'unclosed_update' }]);
  });

  it('recognizes literal tags in YAML patch block scalars without closing a patch early', () => {
    const result = updateMvu(`<JSONPatch>\n- op: replace\n  path: /label\n  value: |\n    literal </JSONPatch> and <think> tags\n</JSONPatch>`, readMvuState({ stat_data: { label: 'old' } }));
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data.label).toBe('literal </JSONPatch> and <think> tags\n');
  });

  it('supports all seven literal legacy calls, optional old set value, and numeric AST arithmetic', () => {
    const result = updateMvu(`_.set('n', 999, Math.pow(2,3)+1); _.add('n', 0.25); _.insert('rows', 3); _.assign('bag', 'a.b', {value:2}); _.remove('rows', 0); _.unset('bag.old'); _.delete('bag', 'remove');`, readMvuState({ stat_data: { n: 1, rows: [1, 2], bag: { old: 1, remove: 2 } } }));
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ n: 9.25, rows: [2, 3], bag: { 'a.b': { value: 2 } } });
    expect(result.state.delta_data.n).toBe('9->9.25 ');
  });

  it('reports missing paths and invalid values without cancelling unrelated later commands', () => {
    const result = updateMvu(`_.add('missing',1); _.set('n',Infinity); _.add('n',2); _.add('flag',1); _.set('label','comma, and ); stay text');`, readMvuState({ stat_data: { n: 1, flag: false, label: 'old' } }));
    expect(result.state.stat_data).toEqual({ n: 3, flag: false, label: 'comma, and ); stay text' });
    expect(result.issues.map(issue => issue.code)).toEqual(['command_path_missing', 'invalid_command', 'command_type']);
    expect(result.issues[0]?.offset).toBe(0);
  });

  it.each([
    `_.set('name', “阿宁”);`,
    `_.set('name', '阿宁\n');`,
  ])('continues with an independent closed update after a lexical error: %s', badCommand => {
    const baseline = readMvuState({ stat_data: { score: 10, name: '原名' } });
    const text = `<UpdateVariable>_.add('score',2); ${badCommand}</UpdateVariable><UpdateVariable>_.add('score',1);</UpdateVariable>`;
    const result = updateMvu(text, baseline);
    expect(result.state.stat_data).toEqual({ score: 13, name: '原名' });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every(issue => issue.code === 'invalid_command')).toBe(true);
    expect(result.issues.every(issue => (issue.offset ?? 0) < text.lastIndexOf('<UpdateVariable>'))).toBe(true);
    expect(baseline.stat_data).toEqual({ score: 10, name: '原名' });
  });

  it.each([
    `_.set('name', “阿宁”);`,
    `_.set('name', '阿宁\n');`,
    `_.set('name', “阿宁”, "text; _.add('score',900);");`,
    `_.set('score', 1e);`,
  ])('recovers at the next independent command in the same closed update: %s', badCommand => {
    const baseline = readMvuState({ stat_data: { score: 10, name: '原名', label: 'old' } });
    const text = `<UpdateVariable>${badCommand} _.set('label', "text; _.add('score',900);"); _.add('score',1);</UpdateVariable>`;
    const result = updateMvu(text, baseline);
    expect(result.state.stat_data).toEqual({ score: 11, name: '原名', label: "text; _.add('score',900);" });
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every(issue => issue.code === 'invalid_command')).toBe(true);
    expect(result.issues[0]?.offset).toBe(text.indexOf('_.set'));
    expect(baseline.stat_data).toEqual({ score: 10, name: '原名', label: 'old' });
  });

  it('expands current update text before closed-block parsing without rewriting the supplied raw text', () => {
    const baseline = readMvuState({ stat_data: { score: 10, owner: '旧称呼' } });
    const raw = `<UpdateVariable>_.set('owner','{{user}}'); _.set('score',{{get_message_variable::stat_data.score}}+1);</UpdateVariable>`;
    const expandedInputs: string[] = [];
    const result = updateMvu(raw, baseline, text => {
      expandedInputs.push(text);
      return expandMvu(text.replaceAll('{{user}}', '阿宁'), baseline);
    });
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ score: 11, owner: '阿宁' });
    expect(expandedInputs).toEqual([raw]);
    expect(raw).toContain('{{user}}');
    expect(baseline.stat_data).toEqual({ score: 10, owner: '旧称呼' });
  });

  it('never executes arbitrary calls, getters, spread, assignments or function expressions', () => {
    const result = updateMvu(`_.set('n', (()=>{throw new Error('executed')})()); _.set('n', globalThis.process.exit()); _.set('bag', {get a(){throw new Error('getter')}}); _.set('bag', {...source}); _.set('n', n=7); _.add('n',2);`, readMvuState({ stat_data: { n: 1, bag: {} } }));
    expect(result.state.stat_data).toEqual({ n: 3, bag: {} });
    expect(result.issues).toHaveLength(5);
    expect(result.issues.every(issue => issue.code === 'invalid_command')).toBe(true);
  });

  it('requires complete semicolon-terminated legacy calls and skips command strings and comments', () => {
    const result = updateMvu(`<update>\n// _.add('n',100);\n_.set('label', "_.add('n',900);");\n_.add('n',100)\n_.add('n',1);\n</update>`, readMvuState({ stat_data: { n: 0, label: '' } }));
    expect(result.state.stat_data).toEqual({ n: 1, label: "_.add('n',900);" });
    expect(result.issues).toMatchObject([{ code: 'invalid_command' }]);
  });

  it('rejects malformed patch arrays as a block and supports only the Go patch operations', () => {
    const result = updateMvu(`<update><JSONPatch>[{"op":"replace","path":"/n","value":99},{"op":42,"path":"/label"}]</JSONPatch><JSONPatch>[{"op":"copy","path":"/label","from":"/n"}]</JSONPatch>_.add('n',1);</update>`, readMvuState({ stat_data: { n: 1, label: 'old' } }));
    expect(result.state.stat_data).toEqual({ n: 2, label: 'old' });
    expect(result.issues.map(issue => issue.code)).toEqual(['invalid_patch', 'unsupported_patch_operation']);
  });

  it('applies pointer insertion/removal and object root replacement without prototype effects', () => {
    const result = updateMvu(`<JSONPatch>[{"op":"add","path":"/rows/-","value":3},{"op":"insert","path":"/rows/1","value":4},{"op":"remove","path":"/rows/0"},{"op":"replace","path":"/bag/__proto__","value":{"safe":1}}]</JSONPatch>`, readMvuState({ stat_data: { rows: [1, 2], bag: JSON.parse('{"__proto__":{}}') } }));
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data.rows).toEqual([4, 2, 3]);
    expect(Object.prototype).not.toHaveProperty('safe');
    expect(Object.hasOwn(result.state.stat_data.bag as object, '__proto__')).toBe(true);
    const objectRoot = updateMvu(`<JSONPatch>[{"op":"replace","path":"","value":{"fresh":true}}]</JSONPatch>`, result.state);
    expect(objectRoot.state.stat_data).toEqual({ fresh: true });
    const refused = updateMvu(`_.set('',null);`, objectRoot.state);
    expect(refused.state.stat_data).toEqual({ fresh: true });
    expect(refused.issues).toMatchObject([{ code: 'command_type' }]);
  });
  it('does not treat an inherited schema property as an owned literal data path', () => {
    const keys = ['type', 'properties', 'extensible', 'recursiveExtensible'];
    const previous = keys.map(key => [key, Object.getOwnPropertyDescriptor(Object.prototype, key)] as const);
    try {
      const baseline = readMvuState({ stat_data: JSON.parse('{"__proto__":{}}'), schema: { type: 'object', properties: {}, extensible: true } });
      const result = updateMvu(`_.insert('__proto__','literal',true);`, baseline);
      expect(result.issues).toEqual([]);
      expect(Object.getOwnPropertyDescriptor(Object.prototype, 'type')).toBeUndefined();
      expect(JSON.stringify(result.state.stat_data)).toBe('{"__proto__":{"literal":true}}');
    } finally {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(Object.prototype, key, descriptor);
        else Reflect.deleteProperty(Object.prototype, key);
      }
    }
  });
});

describe('VWD, metadata/schema gates and derived display', () => {
  it('updates described numeric values, ISO date deltas and frozen derived strings without mutating the baseline', () => {
    const baseline = readMvuState({ stat_data: { score: [5, 'description'], day: '2024-01-01', badDay: '2024-99-99' }, extra: { keep: 1 } });
    const result = updateMvu(`_.set('score',-100,'6'); _.add('score',0.25); _.add('day',86400000); _.add('badDay',1);`, baseline);
    expect(result.state.stat_data).toEqual({ score: [6.25, 'description'], day: '2024-01-02T00:00:00.000Z', badDay: '2024-99-99' });
    expect(result.state.display_data.score).toBe('6->6.25 ');
    expect(result.state.delta_data.score).toBe('6->6.25 ');
    expect(result.state.extra).toEqual({ keep: 1 });
    expect(result.issues).toMatchObject([{ code: 'command_type' }]);
    expect(baseline.stat_data.score).toEqual([5, 'description']);
  });

  it('cleans metadata, preserves required gates and applies collection templates', () => {
    const initial = initializeMvu([book('schema', `$meta:\n  extensible: true\n  required: [locked]\n  strictTemplate: true\n  strictSet: true\n  concatTemplateArray: false\nlocked: keep\noptional: old\nbag:\n  $meta:\n    extensible: true\n    template: {count: 0, tags: [default, tail], nested: {left: 1}}\n  existing: {count: 1}\nrows:\n  - $arrayMeta: true\n    $meta: {extensible: true, template: [0, 1]}\n  - $__META_EXTENSIBLE__$\n  - null\n  - {n: 1}`)]);
    expect(initial.issues).toEqual([]);
    expect(initial.state.stat_data).not.toHaveProperty('$meta');
    expect(initial.state.stat_data.rows).toEqual([null, { n: 1 }]);
    const result = updateMvu(`_.insert('bag','added',{tags:['own'],nested:{right:2}}); _.insert('rows',7); _.remove('locked'); _.unset('optional');`, initial.state);
    expect(result.state.stat_data.bag).toEqual({ existing: { count: 1 }, added: { count: 0, tags: ['own', 'tail'], nested: { left: 1, right: 2 } } });
    expect(result.state.stat_data.rows).toEqual([null, { n: 1 }, 7]);
    expect(result.state.stat_data.locked).toBe('keep');
    expect(result.state.stat_data).not.toHaveProperty('optional');
    expect(result.issues).toMatchObject([{ code: 'command_schema' }]);
  });

  it('lets the array marker and a recursive parent override an explicit false array flag', () => {
    const initial = initializeMvu([book('recursive', `$meta: {recursiveExtensible: true}\nrows:\n  - {$arrayMeta: true, $meta: {extensible: false}}\n  - $__META_EXTENSIBLE__$\n  - 1\ndeep:\n  list:\n    - {$arrayMeta: true, $meta: {extensible: false}}\n    - 1`)]);
    expect(initial.issues).toEqual([]);
    const result = updateMvu(`_.insert('rows',2); _.insert('deep.list',3);`, initial.state);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data).toEqual({ rows: [1, 2], deep: { list: [1, 3] } });
    expect(initial.state.stat_data).toEqual({ rows: [1], deep: { list: [1] } });
  });

  it('removes an equal inventory object regardless of nested object key order, preserving array order and value types', () => {
    const initial = initializeMvu([book('bag', `bag:\n  - $__META_EXTENSIBLE__$\n  - {name: potion, count: 1, detail: {owner: 阿宁, tags: [red, blue]}}\n  - {name: potion, count: "1", detail: {owner: 阿宁, tags: [red, blue]}}\n  - {name: potion, count: 1, detail: {owner: 阿宁, tags: [blue, red]}}`)]).state;
    const result = updateMvu(`_.remove('bag',{detail:{tags:['red','blue'],owner:'阿宁'},count:1,name:'potion'});`, initial);
    expect(result.issues).toEqual([]);
    expect(result.state.stat_data.bag).toEqual([
      { name: 'potion', count: '1', detail: { owner: '阿宁', tags: ['red', 'blue'] } },
      { name: 'potion', count: 1, detail: { owner: '阿宁', tags: ['blue', 'red'] } },
    ]);
    expect(initial.stat_data.bag).toEqual([
      { name: 'potion', count: 1, detail: { owner: '阿宁', tags: ['red', 'blue'] } },
      { name: 'potion', count: '1', detail: { owner: '阿宁', tags: ['red', 'blue'] } },
      { name: 'potion', count: 1, detail: { owner: '阿宁', tags: ['blue', 'red'] } },
    ]);
  });

  it('enforces nonextensible collections while retaining the Go direct array-index removal shortcut', () => {
    const state = initializeMvu([book('locked', 'items: [1, 2, 3]\nbox: {existing: 1}')]).state;
    const result = updateMvu(`_.insert('items',4); _.remove('items[1]'); _.remove('items',0); _.insert('box','new',2);`, state);
    expect(result.state.stat_data.items).toEqual([1, 3]);
    expect(result.state.stat_data.box).toEqual({ existing: 1 });
    expect(result.state.display_data.items).toEqual([1, 2, 3]);
    expect(result.state.delta_data).not.toHaveProperty('items');
    expect(result.issues.map(issue => issue.code)).toEqual(['command_schema', 'command_schema', 'command_schema']);
  });
});

describe('read-only message variable macros', () => {
  it('reads typed own values without losing null, literal string whitespace or frozen extensions', () => {
    const state = readMvuState({ stat_data: { title: '  quiet  ', count: 2, rows: [{ value: 'first' }, { value: null }], 中文: { 名字: '日常' }, $internal: { keep: 1 } }, schema: { type: 'object' } });
    const result = expandMvu('{{get_message_variable::stat_data.title}}|{{get_message_variable::stat_data.count}}|{{get_message_variable::stat_data.rows.0.value}}|{{get_message_variable::stat_data.rows[1].value}}|{{get_message_variable::stat_data.中文.名字}}|{{get_message_variable::schema.type}}', state);
    expect(result).toBe('  quiet  |2|first|null|日常|object');
    expect(JSON.parse(expandMvu('{{get_message_variable::stat_data}}', state))).toEqual(state.stat_data);
  });

  it('formats block YAML omitting only dollar metadata recursively while preserving list positions', () => {
    const state = readMvuState({ stat_data: { title: 'plain', values: [2, null, true, { $hidden: 'omit' }], nested: { word: 'false', empty: [], $meta: {} }, $internal: { hidden: 1 } }, line: 'first\nsecond', nothing: null });
    const yaml = expandMvu('{{format_message_variable::stat_data}}', state);
    expect(parseYaml(yaml)).toEqual({ title: 'plain', values: [2, null, true, {}], nested: { word: 'false', empty: [] } });
    expect(yaml.endsWith('\n')).toBe(false);
    expect(parseYaml(expandMvu('{{format_message_variable::line}}', state))).toBe('first\nsecond');
    expect(expandMvu('{{format_message_variable::nothing}}', state)).toBe('null');
    expect(state.stat_data).toHaveProperty('$internal');
  });

  it('leaves missing and unsupported macro paths literal and does not interpret a replacement as another macro', () => {
    const state = readMvuState({ stat_data: { rows: [{ value: null }], count: 2, raw: '{{get_message_variable::stat_data.count}}' } });
    const invalid = ['missing', 'stat_data.rows[2]', 'stat_data.rows[-1]', 'stat_data["count"]', 'stat_data..count', 'stat_data.rows[0].value.child', '/stat_data/count', 'missing::0', ''];
    for (const path of invalid) {
      const macro = `{{get_message_variable::${path}}}`;
      expect(expandMvu(macro, state)).toBe(macro);
    }
    expect(expandMvu('{{get_message_variable::stat_data.raw}}', state)).toBe('{{get_message_variable::stat_data.count}}');
  });
});
