import { describe, expect, it } from 'vitest';
import { assemblePrompt, displayText, displayWithRules } from './prompt.js';
import { decodeMaterial } from '../../rp-materials/src/codec.js';
import type { JsonObject, JsonValue, LoreEntry, MaterialVersion, PromptEntry } from '../../rp-materials/src/types.js';

const asset = (projection: Partial<MaterialVersion['projection']>): MaterialVersion => ({ id:'asset',version:1,originalId:'original',createdAt:'2026-11-18',raw:{},bindings:{worldbooks:[],preset:null},capabilities:[],projection:{kind:'character',name:'小满',character:null,worldbook:null,preset:null,regex:[],quickReplies:[],...projection} });
const decodedAsset = (name: string, raw: JsonValue): MaterialVersion => {
  const decoded = decodeMaterial({ name, bytes: new TextEncoder().encode(JSON.stringify(raw)) });
  return { id: name, version: 1, originalId: decoded.contentHash, createdAt: '2026-11-19', raw: decoded.raw, projection: decoded.projection, capabilities: decoded.capabilities, bindings: { worldbooks: [], preset: null } };
};
const cardRaw = {
  spec: 'chara_card_v3', spec_version: '3.0',
  data: { name: '小满', description: 'CARD_DESCRIPTION', first_mes: '你好，{{user}}', system_prompt: 'CARD_SYSTEM', post_history_instructions: 'CARD_POST', future: { retained: true } },
};

const presetEntry = (identifier: string, content: string, options: Partial<PromptEntry> = {}): PromptEntry => ({
  identifier, name: identifier, enabled: true, role: 'system', content, marker: false,
  position: 'relative', depth: 0, order: 0, sourcePath: `prompts.${identifier}`, ...options,
});
const loreEntry = (id: string, content: string, options: Partial<LoreEntry> = {}): LoreEntry => ({
  id, name: id, content, keys: [], secondaryKeys: [], selective: false, selectiveLogic: 0,
  constant: true, enabled: true, caseSensitive: false, wholeWords: false, scanDepth: null,
  order: 2, position: 'depth', depth: 4, role: 'system', sourcePath: `entries.${id}`, ...options,
});
const exampleCharacter: NonNullable<MaterialVersion['projection']['character']> = {
  name: '小满', description: '', personality: '', scenario: '', firstMessage: '', alternateGreetings: [],
  messageExamples: '我: 示例提问\n小满: 示例回答', systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [],
};

describe('确定性的酒馆编排', () => {
  it.each([
    { input: '', depth: 0, messages: [{ role: 'assistant', content: '真实末句' }], tokens: 9 },
    { input: ' ', depth: 1, messages: [{ role: 'assistant', content: '真实末句' }, { role: 'user', content: ' ' }], tokens: 15 },
  ])('当前输入为「$input」时按实际消息存在性编排，不让空输入规则制造玩家行动', ({ input, depth, messages, tokens }) => {
    const material = decodedAsset('empty-side-regex.json', [
      { scriptName: '空输入不代表玩家行动', findRegex: '/^$/g', replaceString: '凭空出现的玩家行动', placement: [1], promptOnly: true },
      { scriptName: '最后实际角色消息', findRegex: '/角色原词/g', replaceString: '真实末句', placement: [2], promptOnly: true, minDepth: depth, maxDepth: depth },
    ]);
    const history = [{ role: 'assistant' as const, content: '角色原词' }];
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history, input, inputBudget: 8000 });
    expect(result.messages).toEqual(messages);
    expect(result.estimatedTokens).toBe(tokens);
    expect(history).toEqual([{ role: 'assistant', content: '角色原词' }]);
  });

  it('连续空侧不占模型消息深度，也不参与空串替换，真实空白消息保留', () => {
    const material = decodedAsset('empty-history-regex.json', [
      { scriptName: '空侧不能变正文', findRegex: '/^$/g', replaceString: '凭空正文', placement: [1, 2], promptOnly: true },
      { scriptName: '按真实距离替换', findRegex: '/旧角色原词/g', replaceString: '两条消息前的正文', placement: [2], promptOnly: true, minDepth: 2, maxDepth: 2 },
    ]);
    const history = [
      { role: 'assistant' as const, content: '旧角色原词' }, { role: 'user' as const, content: '' },
      { role: 'assistant' as const, content: '' }, { role: 'user' as const, content: ' ' },
      { role: 'assistant' as const, content: '最近回答' },
    ];
    const original = structuredClone(history);
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history, input: '', inputBudget: 8000 });
    expect(result.messages).toEqual([
      { role: 'assistant', content: '两条消息前的正文' }, { role: 'user', content: ' ' }, { role: 'assistant', content: '最近回答' },
    ]);
    expect(history).toEqual(original);
  });

  it('没有当前输入和历史时，深度条目仍留在主提示词与后置块之间', () => {
    const material = asset({ preset: { sampling: {}, prompts: [
      presetEntry('main', '主提示词'), presetEntry('chatHistory', '', { marker: true, order: 1 }),
      presetEntry('post', '后置块', { order: 2 }), presetEntry('deep', '深度条目', { position: 'depth', depth: 1, order: 3 }),
    ] } });
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history: [], input: '', memo: { content: '既有备忘', locked: [] }, inputBudget: 8000 });
    expect(result.messages).toEqual([
      { role: 'system', content: '主提示词' }, { role: 'system', content: '既有备忘' },
      { role: 'system', content: '深度条目' }, { role: 'system', content: '后置块' },
    ]);
  });

  it.each([
    { forbid: true, position: 0, expected: ['PRESET_SYSTEM', 'PRESET_POST', 'NEXT_INPUT'] },
    { forbid: false, position: 0, expected: ['CARD_SYSTEM', 'CARD_POST', 'NEXT_INPUT'] },
    { forbid: true, position: 1, expected: ['PRESET_SYSTEM', 'PRESET_POST', 'NEXT_INPUT'] },
    { forbid: false, position: 1, expected: ['CARD_SYSTEM', 'CARD_POST', 'NEXT_INPUT'] },
  ])('导入预设的覆盖开关 $forbid 在位置 $position 控制角色卡主提示词与后置指令', ({ forbid, position, expected }) => {
    const raw: JsonObject = { prompts: [
      { identifier: 'main', role: 'system', content: 'PRESET_SYSTEM', forbid_overrides: forbid, injection_position: position, injection_depth: 1, future: { retained: 'main' } },
      { identifier: 'jailbreak', role: 'system', content: 'PRESET_POST', forbid_overrides: forbid, injection_position: position, injection_depth: 1 },
      { identifier: 'chatHistory', marker: true },
    ], prompt_order: [{ character_id: 100001, order: [
      { identifier: 'main', enabled: true }, { identifier: 'jailbreak', enabled: true }, { identifier: 'chatHistory', enabled: true },
    ] }] };
    const character = decodedAsset('card.json', cardRaw), preset = decodedAsset('preset.json', raw);
    const result = assemblePrompt({ materials: [character, preset], playerName: '阿宁', playerDescription: '', history: [], input: 'NEXT_INPUT', inputBudget: 16000 });
    expect(result.messages.map(message => message.content)).toEqual(expected);
    expect(preset.raw).toEqual(raw);expect(character.raw).toEqual(cardRaw);
  });

  it.each([
    { configured: true, expected: ['NEXT_INPUT'] },
    { configured: false, expected: ['CUSTOM_PROMPT', 'NEXT_INPUT'] },
  ])('已有空顺序组（$configured）与没有配置顺序组的导入预设分别处理', ({ configured, expected }) => {
    const raw: JsonObject = { prompts: [{ identifier: 'custom', role: 'system', content: 'CUSTOM_PROMPT', future: '保留' }],
      ...(configured ? { prompt_order: [
        { character_id: 100000, order: [{ identifier: 'custom', enabled: true }] },
        { character_id: 100001, order: [] },
      ] } : {}),
    };
    const material = decodedAsset('preset.json', raw);
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history: [], input: 'NEXT_INPUT', inputBudget: 16000 });
    expect(result.messages.map(message => message.content)).toEqual(expected);
    expect(material.raw).toEqual(raw);
  });

  it('深度占位块先取得角色描述，再按预设角色插入当前聊天', () => {
    const raw: JsonObject = { prompts: [
      { identifier: 'main', role: 'system', content: 'PRESET_SYSTEM', forbid_overrides: true },
      { identifier: 'charDescription', marker: true, role: 'assistant', content: '', injection_position: 1, injection_depth: 1 },
      { identifier: 'chatHistory', marker: true },
      { identifier: 'tail', role: 'system', content: 'PRESET_TAIL' },
    ], prompt_order: [{ character_id: 100001, order: [
      { identifier: 'main', enabled: true }, { identifier: 'charDescription', enabled: true }, { identifier: 'chatHistory', enabled: true }, { identifier: 'tail', enabled: true },
    ] }] };
    const material = decodedAsset('preset.json', raw);
    const result = assemblePrompt({ materials: [decodedAsset('card.json', cardRaw), material], playerName: '阿宁', playerDescription: '', history: [{ role: 'assistant', content: 'PREVIOUS_ASSISTANT' }], input: 'NEXT_INPUT', inputBudget: 16000 });
    expect(result.messages).toEqual([
      { role: 'system', content: 'PRESET_SYSTEM' },
      { role: 'assistant', content: 'PREVIOUS_ASSISTANT' },
      { role: 'assistant', content: 'CARD_DESCRIPTION' },
      { role: 'user', content: 'NEXT_INPUT' },
      { role: 'system', content: 'PRESET_TAIL' },
    ]);
    expect(result.sources).toContainEqual({ label: '角色描述', text: 'CARD_DESCRIPTION' });
    expect(material.raw).toEqual(raw);
  });

  it('导入首句先展开已支持称呼宏再派生显示，原文与模型历史不被显示替换覆盖', () => {
    const raw = { ...cardRaw, data: { ...cardRaw.data, first_mes: '{{user}}，我是{{char}}。', extensions: {
      regex_scripts: [{ scriptName: '显示称呼', findRegex: '/阿宁/g', replaceString: '{{user}}同学', placement: [2], markdownOnly: true }],
    } } };
    const material = decodedAsset('card.json', raw), original = material.projection.character!.firstMessage;
    const context = { char: material.projection.character!.name, user: '阿宁' };
    expect(displayWithRules(original, material.projection.regex, 'output', context)).toBe('阿宁同学，我是小满。');
    expect(displayText(original, [material], 'output', context)).toBe('阿宁同学，我是小满。');
    const history = [{ role: 'assistant' as const, content: original }];
    const result = assemblePrompt({ materials: [material], playerName: '阿宁', playerDescription: '', history, input: '你好', inputBudget: 16000 });
    expect(result.messages[0]).toEqual({ role: 'assistant', content: '阿宁，我是小满。' });
    expect(original).toBe('{{user}}，我是{{char}}。');
    expect(history[0]!.content).toBe(original);
    expect(material.projection.character!.firstMessage).toBe(original);
    expect(material.raw).toEqual(raw);
  });

  it.each([
    { markdownOnly: false, promptOnly: false, prompt: ['替换词，先前。', '替换词，现在。'], display: ['替换词，先前。', '替换词，现在。'] },
    { markdownOnly: true, promptOnly: false, prompt: ['原词，先前。', '原词，现在。'], display: ['替换词，先前。', '替换词，现在。'] },
    { markdownOnly: false, promptOnly: true, prompt: ['替换词，先前。', '替换词，现在。'], display: ['原词，先前。', '原词，现在。'] },
    { markdownOnly: true, promptOnly: true, prompt: ['替换词，先前。', '替换词，现在。'], display: ['替换词，先前。', '替换词，现在。'] },
  ])('导入正则 markdownOnly=$markdownOnly、promptOnly=$promptOnly 时分别派生模型与显示文本', ({ markdownOnly, promptOnly, prompt, display }) => {
    const raw: JsonValue = [{ scriptName: '输入和输出替换', findRegex: '/原词/g', replaceString: '替换词', placement: [1, 2], markdownOnly, promptOnly, future: { retained: '未知扩展' } }];
    const material = decodedAsset('regex.json', raw);
    const history = [{ role: 'assistant' as const, content: '原词，先前。' }], input = '原词，现在。';
    const result = assemblePrompt({ materials: [material], playerName: '玩家', playerDescription: '', history, input, inputBudget: 16000 });
    expect(result.messages).toEqual([{ role: 'assistant', content: prompt[0] }, { role: 'user', content: prompt[1] }]);
    expect(displayText(history[0]!.content, [material], 'output', { char: '角色', user: '玩家' })).toBe(display[0]);
    expect(displayText(input, [material], 'input', { char: '角色', user: '玩家' })).toBe(display[1]);
    expect(history[0]!.content).toBe('原词，先前。');
    expect(input).toBe('原词，现在。');
    expect(material.raw).toEqual(raw);
  });

  it.each([
    { depth: 0, expected: '原词' }, { depth: 1, expected: '显示词' },
    { depth: 2, expected: '显示词' }, { depth: 3, expected: '原词' },
  ])('仅显示正则按历史深度 $depth 派生正文且不改模型历史', ({ depth, expected }) => {
    const material = decodedAsset('regex.json', [{ scriptName: '历史显示', findRegex: '/原词/g', replaceString: '显示词', placement: [2], markdownOnly: true, minDepth: 1, maxDepth: 2 }]);
    const context = { char: '角色', user: '玩家' };
    expect(displayWithRules('原词', material.projection.regex, 'output', context, depth)).toBe(expected);
    expect(displayText('原词', [material], 'output', context, depth)).toBe(expected);
    expect(displayWithRules('原词', material.projection.regex, 'output', context)).toBe('原词');
    const result = assemblePrompt({ materials: [material], playerName: '玩家', playerDescription: '', history: [{ role: 'assistant', content: '原词' }], input: '下一句', inputBudget: 16000 });
    expect(result.messages).toEqual([{ role: 'assistant', content: '原词' }, { role: 'user', content: '下一句' }]);
  });
  it('开场的深度插入留在聊天块内，不跨过主提示词', () => {
    const material = asset({ preset: { sampling: {}, prompts: [
      presetEntry('main', '主提示词'),
      presetEntry('chatHistory', '', { marker: true, order: 1 }),
      presetEntry('deep', '深度四', { position: 'depth', depth: 4, order: 2 }),
    ] } });
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history: [], input: '第一句', inputBudget: 16000 });
    expect(result.messages).toEqual([
      { role: 'system', content: '主提示词' },
      { role: 'system', content: '深度四' },
      { role: 'user', content: '第一句' },
    ]);
  });

  it.each([
    { depth: 0, expected: ['主提示词', '示例提问', '示例回答', '上一句', '第一句', '深度 A', '深度 B', '后置块'] },
    { depth: 1, expected: ['主提示词', '示例提问', '示例回答', '上一句', '深度 A', '深度 B', '第一句', '后置块'] },
    { depth: 4, expected: ['主提示词', '示例提问', '示例回答', '深度 A', '深度 B', '上一句', '第一句', '后置块'] },
  ])('深度 $depth 的同层条目按预设顺序插入，不穿越示例或后置块', ({ depth, expected }) => {
    const material = asset({ character: exampleCharacter, preset: { sampling: {}, prompts: [
      presetEntry('main', '主提示词'),
      presetEntry('dialogueExamples', '', { marker: true, order: 1 }),
      presetEntry('chatHistory', '', { marker: true, order: 2 }),
      presetEntry('post', '后置块', { order: 3 }),
      presetEntry('deep-b', '深度 B', { position: 'depth', depth, order: 5 }),
      presetEntry('deep-a', '深度 A', { position: 'depth', depth, order: 4 }),
    ] } });
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history: [{ role: 'assistant', content: '上一句' }], input: '第一句', inputBudget: 16000 });
    expect(result.messages.map(message => message.content)).toEqual(expected);
  });

  it.each([
    { withPreset: true, expected: ['主提示词', '示例提问', '示例回答', '世界书 A', '世界书 B', '预设深处', '第一句', '世界书末尾', '后置块'] },
    { withPreset: false, expected: ['示例提问', '示例回答', '世界书 A', '世界书 B', '第一句', '世界书末尾'] },
  ])('世界书深度插入在预设启用=$withPreset 时仍留在聊天块并保持同层来源顺序', ({ withPreset, expected }) => {
    const material = asset({ character: exampleCharacter,
      worldbook: { name: '关系', scanDepth: 2, budget: 500, recursive: false, entries: [
        loreEntry('book-a', '世界书 A', { role: 'user' }),
        loreEntry('book-b', '世界书 B', { role: 'assistant' }),
        loreEntry('book-last', '世界书末尾', { depth: 0, order: 5 }),
      ] },
      preset: withPreset ? { sampling: {}, prompts: [
        presetEntry('main', '主提示词'),
        presetEntry('dialogueExamples', '', { marker: true, order: 1 }),
        presetEntry('chatHistory', '', { marker: true, order: 2 }),
        presetEntry('deep', '预设深处', { position: 'depth', depth: 4, order: 2 }),
        presetEntry('post', '后置块', { order: 3 }),
      ] } : null,
    });
    const result = assemblePrompt({ materials: [material], playerName: '我', playerDescription: '', history: [], input: '第一句', inputBudget: 16000 });
    expect(result.messages.map(message => message.content)).toEqual(expected);
    expect(result.messages.find(message => message.content === '世界书 A')?.role).toBe('user');
    expect(result.messages.find(message => message.content === '世界书 B')?.role).toBe('assistant');
    expect(result.triggeredLore).toEqual(['asset:book-last', 'asset:book-a', 'asset:book-b']);
    expect(result.sources.filter(source => source.label.startsWith('关系 · '))).toEqual([
      { label: '关系 · book-last', text: '世界书末尾' },
      { label: '关系 · book-a', text: '世界书 A' },
      { label: '关系 · book-b', text: '世界书 B' },
    ]);
  });

  it('角色称呼、关系备忘、触发世界书和输入替换只作用当前路线', () => {
    const materials = [asset({ character:{name:'小满',description:'{{char}}一直记得{{user}}。',personality:'温柔',scenario:'雨天',firstMessage:'',alternateGreetings:[],messageExamples:'',systemPrompt:'请以{{char}}的身份说话。',postHistoryInstructions:'',creatorNotes:'',tags:[]},worldbook:{name:'约定',scanDepth:3,budget:500,recursive:false,entries:[{id:'promise',name:'海边约定',content:'{{char}}答应明天陪{{user}}去海边。',keys:['海边'],secondaryKeys:[],selective:false,selectiveLogic:0,constant:false,enabled:true,caseSensitive:false,wholeWords:false,scanDepth:null,order:1,position:'before',depth:0,role:'system',sourcePath:'entries.promise'}]},regex:[{id:'r',name:'称呼',findRegex:'/你好/g',replaceString:'{{char}}',trimStrings:[],placements:['input'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'}] })];
    const input = {materials,playerName:'阿宁',playerDescription:'喜欢海',history:[{role:'user' as const,content:'上次的海边约定呢？'},{role:'assistant' as const,content:'我记得。'}],input:'你好，明天见。',memo:{content:'两人已互相告白。',locked:['称呼：阿宁']},inputBudget:8000};
    const a = assemblePrompt(input), b = assemblePrompt(input);
    expect(a).toEqual(b);
    expect(a.system).toContain('小满一直记得阿宁。');
    expect(a.system).toContain('小满答应明天陪阿宁去海边。');
    expect(a.system).toContain('两人已互相告白。');
    expect(a.messages.at(-1)).toEqual({role:'user',content:'小满，明天见。'});
    expect(input.input).toBe('你好，明天见。');
    expect(input.history[1]!.content).toBe('我记得。');
  });

  it('预设顺序和深度插入保持角色，显示替换不污染模型输入', () => {
    const materials = [asset({ preset:{sampling:{temperature:0.8},prompts:[
      {identifier:'main',name:'身份',enabled:true,role:'system',content:'先写身份',marker:false,position:'relative',depth:0,order:0,sourcePath:'prompts.0'},
      {identifier:'chatHistory',name:'历史',enabled:true,role:'system',content:'',marker:true,position:'relative',depth:0,order:1,sourcePath:'prompts.1'},
      {identifier:'depth',name:'近况',enabled:true,role:'system',content:'靠近最后一句',marker:false,position:'depth',depth:1,order:2,sourcePath:'prompts.2'},
      {identifier:'off',name:'禁用',enabled:false,role:'system',content:'不可出现',marker:false,position:'relative',depth:0,order:3,sourcePath:'prompts.3'}]},regex:[{id:'d',name:'显示',findRegex:'/原词/g',replaceString:'显示词',trimStrings:[],placements:['output'],displayOnly:true,promptOnly:false,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'}] })];
    const result=assemblePrompt({materials,playerName:'玩家',playerDescription:'',history:[{role:'assistant',content:'原词'}],input:'下一句',inputBudget:8000});
    expect(result.messages).toEqual([{role:'system',content:'先写身份'},{role:'assistant',content:'原词'},{role:'system',content:'靠近最后一句'},{role:'user',content:'下一句'}]);
    expect(displayText('原词',materials,'output',{char:'角色',user:'玩家'})).toBe('显示词');
    expect(result.controls.temperature).toBe(0.8);
  });
  it('预设显式关闭示例时不会自动补回',()=>{
    const material=asset({character:{name:'小满',description:'',personality:'',scenario:'',firstMessage:'',alternateGreetings:[],messageExamples:'{{char}}: 不要发送这个示例',systemPrompt:'',postHistoryInstructions:'',creatorNotes:'',tags:[]},preset:{sampling:{},prompts:[{identifier:'dialogueExamples',name:'示例',enabled:false,role:'system',content:'',marker:true,position:'relative',depth:0,order:0,sourcePath:'prompts.0'},{identifier:'chatHistory',name:'历史',enabled:true,role:'system',content:'',marker:true,position:'relative',depth:0,order:1,sourcePath:'prompts.1'}]}});
    const result=assemblePrompt({materials:[material],playerName:'我',playerDescription:'',history:[],input:'你好',inputBudget:8000});
    expect(JSON.stringify(result.messages)).not.toContain('不要发送这个示例');
    expect(result.sources.some(source=>source.label==='示例对话')).toBe(false);
  });
});
