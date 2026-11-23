import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { previewExport, importSelected, type ImportSink, type ConversationPreview } from './import.js';

// Handwritten standard ST rows, independent of the parser and of any private chat.
const source = readFileSync(new URL('./fixtures/sillytavern.jsonl', import.meta.url));
const mvuSource = readFileSync(new URL('./fixtures/sillytavern-mvu.jsonl', import.meta.url));
const signal = () => new AbortController().signal;
const encode = (text: string) => new TextEncoder().encode(text);
const inspect = (bytes: Uint8Array = source, existing: ImportSink['existing'] = () => [], name = '海边的约定.jsonl') => previewExport(bytes, existing, signal(), name);

// A wrong active-swipe index, dropped consecutive message, or overwritten raw swipe must fail here.
describe('standard SillyTavern JSONL migration', () => {
  it('preserves every swipe and selects authoritative mes without fabricating either side of a turn', async () => {
    const preview = await inspect();
    expect(preview.failures).toEqual([]);
    const row = preview.conversations[0]!;
    expect(row).toMatchObject({ kind: 'sillytavern-jsonl', title: '海边的约定', userName: '阿宁', characterName: '林舟', messageCount: 6, candidateCount: 7, archivedMessageCount: 1, failedReplies: 2, omittedTurns: 0, createdAt: 1795075200000, updatedAt: 1795075560000, state: 'new' });
    expect(row.fingerprint).toBe(createHash('sha256').update(source).digest('hex'));
    expect(row.turns).toHaveLength(5);
    expect(row.turns.map(turn => [turn.input, turn.reply])).toEqual([
      ['', '你好，阿宁'], ['先去海边。', ''], ['记得带上那枚贝壳。', '我记着我们的约定。'], ['', '还没说完的半句'], ['我们走吧。', ''],
    ]);
    expect(row.turns[0]).toMatchObject({ selectedReplyIndex: 2, replies: [
      { reply: '你好，{{user}}', reasoning: '原始首句思路', status: 'complete' },
      { reply: '我们又见面了', reasoning: '另一条首句思路', status: 'complete' },
      { reply: '你好，阿宁', reasoning: '当前首句思路', status: 'complete' },
    ] });
    expect(row.turns[1]).toMatchObject({ status: 'empty', reply: '', reasoning: '' });
    expect(row.turns[1]?.replies).toBeUndefined();
    expect(row.turns[2]).toMatchObject({ selectedReplyIndex: 1, reasoning: '当前选中的思路', replies: [
      { reply: '旧回复', reasoning: '旧回复思路', status: 'complete' },
      { reply: '我记着我们的约定。', reasoning: '当前选中的思路', status: 'complete' },
      { reply: '', reasoning: '只有思路', status: 'empty' },
    ] });
    expect(row.turns[3]).toMatchObject({ status: 'failed', error: '原记录中的生成错误', reasoning: '失败思路', reply: '还没说完的半句' });
    expect(JSON.stringify(row.turns)).not.toContain('不应进入剧情的系统事件');
    expect(JSON.stringify(row.turns)).not.toContain('display_text');
    expect(row.archiveNotes).toEqual(expect.arrayContaining(['1 条系统或事件消息', '聊天头与扩展字段']));
    expect(source.toString('utf8')).toContain('vendor_unknown');
  });

  it('keeps duplicate swipe occurrences and their own reasoning while no generation dates imply no failure', async () => {
    const bytes = encode('{"user_name":"unused","character_name":"unused","chat_metadata":{}}\n{"is_user":false,"name":"角色","mes":"一样","swipe_id":1,"swipes":["一样","一样"],"swipe_info":[{"extra":{"reasoning":"第一个"}},{"extra":{"reasoning":"旧缓存"}}],"extra":{"reasoning":"当前"},"gen_started":null,"gen_finished":null}');
    const row = (await inspect(bytes)).conversations[0]!;
    expect(row).toMatchObject({ messageCount: 1, candidateCount: 2, failedReplies: 0 });
    expect(row.turns[0]).toMatchObject({ input: '', selectedReplyIndex: 1, replies: [{ reply: '一样', reasoning: '第一个', status: 'complete' }, { reply: '一样', reasoning: '当前', status: 'complete' }] });
  });

  it('uses stable integrity identity across renamed exports and byte fingerprints for skip versus changed content', async () => {
    const saved: { row: ConversationPreview; original: Uint8Array; id: string }[] = [];
    const sink: ImportSink = {
      existing: id => saved.filter(value => value.row.sourceId === id).map(value => ({ id: value.id, sourceId: id, fingerprint: value.row.fingerprint })),
      save: async (row, original) => { const id = `import-${saved.length + 1}`; saved.push({ row, original: original.bytes, id }); return id; },
    };
    const preview = await inspect(source, sink.existing), id = preview.conversations[0]!.sourceId;
    expect(id).toMatch(/^sillytavern-jsonl:/);
    const result = await importSelected(preview, [id, id], { name: '原件.jsonl', bytes: source }, sink);
    expect(result).toMatchObject({ imported: ['import-1'], conversations: [{ kind: 'sillytavern-jsonl', candidateCount: 7, archivedMessageCount: 1, messageCount: 6, failedReplies: 2 }] });
    expect(Buffer.from(saved[0]!.original).equals(source)).toBe(true);
    const same = await inspect(source, sink.existing, '改名仍是同一个源.jsonl');
    expect(same.conversations[0]).toMatchObject({ sourceId: id, state: 'same', existingId: 'import-1' });
    expect((await importSelected(same, [id], { name: '改名.jsonl', bytes: source }, sink)).skipped).toEqual(['import-1']);
    const changedBytes = encode(source.toString('utf8').replace('我们走吧。', '我们现在出发吧。'));
    const changed = await inspect(changedBytes, sink.existing);
    expect(changed.conversations[0]).toMatchObject({ sourceId: id, state: 'changed' });
    expect((await importSelected(changed, [id], { name: '更新.jsonl', bytes: changedBytes }, sink)).imported).toEqual(['import-2']);
    expect(saved[0]!.row.turns.at(-1)?.input).toBe('我们走吧。');
  });

  it('uses filename, people and source start time when an older header has no integrity', async () => {
    const first = encode('{"user_name":"阿宁","character_name":"林舟","create_date":"2024-7-12@01h31m37s"}\n{"name":"林舟","is_user":false,"mes":"首句","send_date":"2024-7-12@01h31m37s"}\n');
    const extended = encode(new TextDecoder().decode(first) + '{"name":"阿宁","is_user":true,"mes":"接着聊","send_date":1720748000000}\n');
    const old = (await inspect(first)).conversations[0]!;
    expect(old.createdAt).toBe(Date.UTC(2024, 6, 12, 1, 31, 37));
    const matches: ImportSink['existing'] = id => id === old.sourceId ? [{ sourceId: id, id: 'old-chat', fingerprint: old.fingerprint }] : [];
    expect((await inspect(extended, matches)).conversations[0]).toMatchObject({ sourceId: old.sourceId, state: 'changed' });
    expect((await inspect(first, matches, '另一份无编号.jsonl')).conversations[0]?.state).toBe('new');
  });

  it('accepts a file-leading BOM and physical blank lines without normalizing saved source bytes', async () => {
    const bytes = encode('\ufeff\r\n \t\r\n{"chat_metadata":{}}\r\n\r\n{"is_user":false,"name":"角色","mes":"只有首句\\n保留换行"}\r\n');
    const row = (await inspect(bytes)).conversations[0]!;
    expect(row.messageCount).toBe(1); expect(row.turns[0]?.reply).toBe('只有首句\n保留换行');
    expect(row.createdAt).toBe(0); expect(row.updatedAt).toBe(0);
  });

  it.each([
    ['broken JSON', '{"chat_metadata":{}}\n\n{"is_user":true,"mes":', /第 3 行/],
    ['non-object row', '{"chat_metadata":{}}\n[]', /第 2 行/],
    ['missing header', '{"is_user":false,"mes":"缺少头"}', /聊天头/],
    ['non-text message', '{"chat_metadata":{}}\n{"is_user":true,"mes":12}', /第 2 行.*mes/],
    ['non-text swipe', '{"chat_metadata":{}}\n{"is_user":false,"mes":"当前","swipes":["原文",{}]}', /第 2 行.*swipes/],
    ['mid-file BOM', '{"chat_metadata":{}}\n\ufeff{"is_user":true,"mes":"x"}', /第 2 行/],
    ['group message names', '{"chat_metadata":{}}\n{"is_user":false,"name":"甲","mes":"A"}\n{"is_user":false,"name":"乙","mes":"B"}', /一对一/],
  ])('rejects %s before it can create any conversation', async (_name, text, failure) => {
    await expect(inspect(encode(text))).rejects.toThrow(failure);
  });

  it('rejects invalid UTF-8 and honors an already cancelled preview', async () => {
    await expect(inspect(Uint8Array.from([0xff, 0x0a]))).rejects.toThrow(/UTF-8/);
    const cancelled = new AbortController(); cancelled.abort();
    await expect(previewExport(source, () => [], cancelled.signal, 'cancelled.jsonl')).rejects.toThrow();
  });
});

// Dropped state, a shared final snapshot, or using the appended index instead of the original swipe must fail here.
describe('SillyTavern MVU snapshot migration', () => {
  it('keeps each swipe state and gives authoritative appended mes its original selected-slot state without running updates', async () => {
    const row = (await inspect(mvuSource)).conversations[0]!;
    expect(row).toMatchObject({ messageCount: 3, candidateCount: 6 });
    expect(row.turns[0]).toMatchObject({ selectedReplyIndex: 2, mvu: {
      stat_data: { counter: 10, label: '原首句' }, schema: { type: 'object', properties: { counter: { type: 'number' } } },
      initialized_lorebooks: { 'embedded:card': [1] }, display_data: { counter: '10' }, delta_data: { counter: '0->10' },
      vendor_unknown: { nested: [1, null, '保留'] },
    } });
    expect(row.turns[0]?.replies?.[0]).toHaveProperty('mvu', {
      stat_data: { counter: 10, label: '原首句' }, schema: { type: 'object', properties: { counter: { type: 'number' } } },
      initialized_lorebooks: { 'embedded:card': [1] }, display_data: { counter: '10' }, delta_data: { counter: '0->10' },
      vendor_unknown: { nested: [1, null, '保留'] },
    });
    expect(row.turns[0]?.replies?.[1]).toHaveProperty('mvu', { stat_data: { counter: 20 }, schema: {}, initialized_lorebooks: {}, display_data: {}, delta_data: {} });
    expect(row.turns[0]?.replies?.[2]).toMatchObject({ reply: "你好，阿宁<UpdateVariable>_.add('counter', 100);</UpdateVariable>", mvu: { stat_data: { counter: 10 } } });
    expect(row.turns[1]).toMatchObject({ selectedReplyIndex: 1, mvu: { stat_data: { counter: 22 } } });
    expect(row.turns[1]?.replies?.[0]).toHaveProperty('mvu', { stat_data: { counter: 11 }, schema: {}, initialized_lorebooks: {}, display_data: {}, delta_data: {}, vendor_unknown: '第一条' });
    expect(row.turns[1]?.replies?.[1]).toHaveProperty('mvu', { stat_data: { counter: 22 }, schema: {}, initialized_lorebooks: { book: [2] }, display_data: {}, delta_data: {} });
    expect(row.turns[1]?.replies?.[2]).not.toHaveProperty('mvu');
  });

  it.each([
    ['missing own snapshot', '', 99],
    ['present own snapshot', ',"variables":[null,{"stat_data":{"counter":22}}]', 22],
  ])('uses the header only for the last selected reply with %s', async (_name, own, expected) => {
    const bytes = encode('{"chat_metadata":{"variables":{"stat_data":{"counter":99},"vendor_unknown":"最终聊天状态"}}}\n'
      + '{"is_user":false,"mes":"早期首句","variables":[{"stat_data":{"counter":10}}]}\n'
      + '{"is_user":true,"mes":"继续"}\n'
      + '{"is_user":false,"mes":"当前","swipe_id":1,"swipes":["旧候选","当前"]' + own + '}\n');
    const row = (await inspect(bytes)).conversations[0]!;
    expect(row.turns[0]).toMatchObject({ mvu: { stat_data: { counter: 10 } } });
    expect(row.turns[0]?.replies?.[0]).toMatchObject({ mvu: { stat_data: { counter: 10 } } });
    expect(row.turns[1]?.replies?.[0]).not.toHaveProperty('mvu');
    expect(row.turns[1]).toMatchObject({ selectedReplyIndex: 1, mvu: { stat_data: { counter: expected } } });
    expect(row.turns[1]?.replies?.[1]).toMatchObject({ mvu: { stat_data: { counter: expected } } });
    if (expected === 99) expect(row.turns[1]?.replies?.[1]).toHaveProperty('mvu.vendor_unknown', '最终聊天状态');
    else expect(row.turns[1]?.replies?.[1]).not.toHaveProperty('mvu.vendor_unknown');
  });

  it.each(['swipe', 'header'])('normalizes legacy initialized book names in a %s snapshot while preserving source bytes and other fields', async carrier => {
    const snapshot = { stat_data: { counter: 7 }, schema: { required: ['counter'] }, initialized_lorebooks: ['旧世界书', '旅途纪事'], display_data: { counter: '7' }, delta_data: { counter: '+1' }, vendor_unknown: { nested: [1, null, '保留'] } };
    const bytes = encode(JSON.stringify({ chat_metadata: carrier === 'header' ? { variables: snapshot } : {} }) + '\n'
      + JSON.stringify({ is_user: false, mes: '已有正文', ...(carrier === 'swipe' ? { variables: [snapshot] } : {}) }) + '\n');
    const originalBytes = Buffer.from(bytes), preview = await inspect(bytes), row = preview.conversations[0]!;
    expect(row.turns[0]?.mvu).toEqual({ stat_data: { counter: 7 }, schema: { required: ['counter'] }, initialized_lorebooks: { '旧世界书': [], '旅途纪事': [] }, display_data: { counter: '7' }, delta_data: { counter: '+1' }, vendor_unknown: { nested: [1, null, '保留'] } });
    expect(row.turns[0]?.replies?.[0]?.mvu).toEqual(row.turns[0]?.mvu);
    let savedBytes: Uint8Array | undefined;
    await importSelected(preview, [row.sourceId], { name: '旧版变量.jsonl', bytes }, {
      existing: () => [], save: async (_row, original) => { savedBytes = original.bytes; return 'legacy-mvu'; },
    });
    expect(Buffer.from(savedBytes!)).toEqual(originalBytes);
    expect(row.fingerprint).toBe(createHash('sha256').update(originalBytes).digest('hex'));
  });

  it('normalizes an empty legacy initialized book list to empty markers', async () => {
    const row = (await inspect(encode('{"chat_metadata":{}}\n{"is_user":false,"mes":"已有正文","variables":[{"stat_data":{},"initialized_lorebooks":[]}]}'))).conversations[0]!;
    expect(row.turns[0]?.mvu).toEqual({ stat_data: {}, schema: {}, initialized_lorebooks: {}, display_data: {}, delta_data: {} });
  });

  it('leaves unrelated or absent variable carriers archived without inventing MVU state', async () => {
    const bytes = encode('{"chat_metadata":{"variables":{"ordinary":"最终聊天变量"}}}\n'
      + '{"is_user":false,"mes":"当前","swipes":["当前","另一条"],"variables":[{"ordinary":{"keep":true}},null]}');
    const row = (await inspect(bytes)).conversations[0]!;
    expect(row.turns[0]).not.toHaveProperty('mvu');
    expect(row.turns[0]?.replies?.[0]).not.toHaveProperty('mvu');
    expect(row.turns[0]?.replies?.[1]).not.toHaveProperty('mvu');
  });

  it.each([
    ['non-array carrier', '{"stat_data":{}}', /第 2 行.*variables/],
    ['non-object stat_data', '[{"stat_data":[]}]', /第 2 行.*stat_data/],
    ['non-object root metadata', '[{"stat_data":{},"schema":[]}]', /第 2 行.*schema/],
    ['mixed legacy book markers', '[{"stat_data":{},"initialized_lorebooks":["旧世界书",1]}]', /第 2 行.*initialized_lorebooks/],
    ['non-string legacy book markers', '[{"stat_data":{},"initialized_lorebooks":[null,{}]}]', /第 2 行.*initialized_lorebooks/],
    ['non-finite unknown value', '[{"stat_data":{},"vendor_unknown":1e999}]', /第 2 行.*JSON/],
  ])('rejects %s at the original JSONL line before import', async (_name, variables, error) => {
    await expect(inspect(encode('{"chat_metadata":{}}\n{"is_user":false,"mes":"当前","variables":' + variables + '}'))).rejects.toThrow(error);
  });

  it('passes imported snapshots and byte-identical original JSONL through the existing selected-import service', async () => {
    let saved: ConversationPreview | undefined, original: Uint8Array | undefined;
    const preview = await inspect(mvuSource);
    const sink: ImportSink = {
      existing: () => [],
      save: async (row, file) => { saved = row; original = file.bytes; return 'mvu-import'; },
    };
    const result = await importSelected(preview, [preview.conversations[0]!.sourceId], { name: '变量原件.jsonl', bytes: mvuSource }, sink);
    expect(result.imported).toEqual(['mvu-import']);
    expect(saved?.turns[0]).toMatchObject({ mvu: { stat_data: { counter: 10 } } });
    expect(saved?.turns[1]?.replies?.[1]).toMatchObject({ mvu: { stat_data: { counter: 22 } } });
    expect(original).toBeDefined();
    expect(Buffer.from(original!).equals(mvuSource)).toBe(true);
    expect(saved?.fingerprint).toBe(createHash('sha256').update(mvuSource).digest('hex'));
  });
});
