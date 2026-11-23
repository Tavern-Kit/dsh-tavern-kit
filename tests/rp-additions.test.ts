import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import type { CandidateGroup, ConversationData, MaterialRef } from '../packages/rp-chat/src/types.js';
import type { PreviewTicket } from '../packages/rp-deepseek-import/src/types.js';
import { hostFixture, unzipArchive, RAW_MODEL, type HostFixture } from './fixtures/host-runtime.js';
import { deepseekArchive } from './fixtures/host-archive.js';
import { displayWithRules } from '../packages/rp-chat/src/prompt.js';

const image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=';
const nextImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const avatar = { name: '人设头像.png', mediaType: 'image/png' as const, base64: image };
const source = readFileSync(new URL('../packages/rp-deepseek-import/src/fixtures/sillytavern.jsonl', import.meta.url));
const route = { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 };
const fixtures: HostFixture[] = [];
afterEach(async () => { for (const app of fixtures.splice(0).reverse()) await app.close(); });
async function start(): Promise<HostFixture> { const app = await hostFixture(); fixtures.push(app); return app; }
const ref = (value: { id: string; version: number }): MaterialRef => ({ id: value.id, version: value.version });
function character(app: HostFixture): MaterialRef {
  const card = app.materials.importFile('阿岚.json', new TextEncoder().encode(JSON.stringify({ spec: 'chara_card_v3', spec_version: '3.0', data: { name: '阿岚', description: '海边的药师', first_mes: '我记得你，{{user}}。' } })));
  return { id: card.id, version: card.currentVersion };
}
function inputDisplayRule(app: HostFixture, depth: number): MaterialRef {
  const rules = app.materials.importFile('输入显示范围.json', new TextEncoder().encode(JSON.stringify([{ scriptName: '当前输入', findRegex: '/原输入/g', replaceString: '就近输入', placement: [1], markdownOnly: true, promptOnly: false, minDepth: depth, maxDepth: depth, runOnEdit: true }])));
  return { id: rules.id, version: rules.currentVersion };
}
async function finish(app: HostFixture, group: CandidateGroup, callIndex: number): Promise<string> {
  await expect.poll(() => app.adapter.calls.length).toBe(callIndex + 1);
  app.adapter.calls[callIndex]!.release();
  await expect.poll(() => app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]?.status).toBe('complete');
  return app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]!.id;
}
async function migrate(app: HostFixture, bytes: Uint8Array = source, name = '海边的约定.jsonl'): Promise<string> {
  const response = await app.fetch(new Request('http://fixture/api/tavern-kit/deepseek/preview?name=' + encodeURIComponent(name), { method: 'POST', body: new Uint8Array(bytes).buffer }));
  expect(response.status).toBe(200);
  const ticket = await response.json() as PreviewTicket;
  expect(ticket.failures).toEqual([]);
  const result = await app.importer.import({ previewId: ticket.id, sourceIds: [ticket.conversations[0]!.sourceId] });
  expect(result.failures).toEqual([]);
  return result.imported[0]!;
}

// Each case uses the actual Cordis owners, material versions and SQLite; only the remote model is controlled.
describe('player personas and selected SillyTavern history through the real Host', { timeout: 20000 }, () => {
  it('applies an explicitly selected persona version per field while respecting hand edits and keeping other chats unchanged', async () => {
    const app = await start();
    const first = app.materials.createPersona({ name: '小雨', description: '海边来的旅人', avatar });
    const second = app.materials.createPersona({ name: '阿夏', description: '书店店主' });
    const firstRef = { id: first.id, version: first.currentVersion }, secondRef = { id: second.id, version: second.currentVersion };
    const oldOriginal = app.materials.exportOriginal(first.id);
    const a = await app.chat.create({ title: '雨的剧情', bindings: [firstRef] });
    const b = await app.chat.create({ title: '夏的剧情', bindings: [secondRef], settings: { playerName: '手填称呼' } });
    const blank = await app.chat.create({ title: '留空设定', bindings: [firstRef], settings: { playerDescription: '' } });
    expect(a.settings).toMatchObject({ playerName: '小雨', playerDescription: '海边来的旅人' });
    expect(b.settings).toMatchObject({ playerName: '手填称呼', playerDescription: '书店店主' });
    expect(blank.settings.playerDescription).toBe('');
    await app.chat.update(a.id, { settings: { playerName: '只在这段叫我雨', playerDescription: '这段剧情的手调设定' } });
    await app.chat.update(a.id, { title: '只改标题', bindings: [firstRef], settings: { mapEnabled: true } });
    expect(app.chat.state(a.id).conversation.settings).toMatchObject({ playerName: '只在这段叫我雨', playerDescription: '这段剧情的手调设定' });
    const newer = app.materials.revisePersona(first.id, { name: '雨', description: '熟悉旧城的旅人' });
    expect(app.chat.state(a.id).conversation.bindings).toEqual([firstRef]);
    expect(app.chat.state(a.id).conversation.settings.playerName).toBe('只在这段叫我雨');
    await app.chat.update(a.id, { bindings: [ref(newer)], settings: { playerName: '明确手填优先' } });
    expect(app.chat.state(a.id).conversation.settings).toMatchObject({ playerName: '明确手填优先', playerDescription: '熟悉旧城的旅人' });
    await app.chat.update(a.id, { bindings: [secondRef] });
    expect(app.chat.state(a.id).conversation.settings).toMatchObject({ playerName: '阿夏', playerDescription: '书店店主' });
    expect(app.chat.state(b.id).conversation.settings).toMatchObject({ playerName: '手填称呼', playerDescription: '书店店主' });
    const before = app.chat.state(a.id), count = app.chat.list().length;
    await expect(app.chat.create({ title: '重复人设', bindings: [firstRef, secondRef] })).rejects.toThrow(/人设/);
    await expect(app.chat.update(a.id, { bindings: [firstRef, secondRef] })).rejects.toThrow(/人设/);
    expect(app.chat.list()).toHaveLength(count);
    expect(app.chat.state(a.id)).toEqual(before);
    expect(app.materials.readVersion(firstRef).projection.persona).toMatchObject({ name: '小雨', description: '海边来的旅人' });
    expect(app.materials.exportOriginal(first.id)).toEqual(oldOriginal);
    expect(app.adapter.calls).toEqual([]);
  });

  it('keeps greeting, running, edited and continued projections on their frozen persona and local avatar version', async () => {
    const app = await start();
    const person = app.materials.createPersona({ name: '小雨', description: '海边来的旅人', avatar });
    const oldRef = { id: person.id, version: person.currentVersion }, card = character(app);
    const conversation = await app.chat.create({ title: '冻结人设', bindings: [card, oldRef], settings: { mainRoute: route } });
    const greeting = app.chat.route({ conversationId: conversation.id }).items[0]!;
    expect(greeting.display).toMatchObject({ playerRef: oldRef, context: { user: '小雨', persona: '海边来的旅人' } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '你还认得我吗？' });
    await expect.poll(() => app.adapter.calls.length).toBe(1);
    const next = app.materials.revisePersona(person.id, { name: '雨', description: '熟悉旧城的旅人', avatar: { ...avatar, base64: nextImage } });
    await app.chat.update(conversation.id, { bindings: [card, ref(next)] });
    const first = await finish(app, group, 0);
    for (const candidateId of [greeting.candidate.id, first]) expect(app.chat.previewCandidate(candidateId).display).toMatchObject({ playerRef: oldRef, context: { user: '小雨', persona: '海边来的旅人' } });
    const edited = app.chat.editCandidate(first, '改好的一句。');
    expect(app.chat.previewCandidate(edited.id).display?.playerRef).toEqual(oldRef);
    const continued = await app.chat.continueCandidate(edited.id), continuedId = await finish(app, continued, 1);
    expect(app.chat.previewCandidate(continuedId).display).toMatchObject({ playerRef: oldRef, context: { user: '小雨', persona: '海边来的旅人' } });
    const freshGroup = await app.chat.roll(group.turnId), fresh = await finish(app, freshGroup, 2);
    expect(app.chat.previewCandidate(fresh).display).toMatchObject({ playerRef: ref(next), context: { user: '雨', persona: '熟悉旧城的旅人' } });
    expect(app.chat.candidate(first).snapshot.bindings).toContainEqual(oldRef);
    expect(app.chat.candidate(first).input.system).toContain('海边来的旅人');
    expect(app.materials.resources(oldRef)[0]?.base64).toBe(image);
    expect(app.materials.resources(ref(next))[0]?.base64).toBe(nextImage);
    for (const call of app.adapter.calls) for (const message of call.options.messages) expect(message.content.every(block => block.type === 'text')).toBe(true);
  });

  it('materializes every source swipe and selected parent, preserving consecutive sides and nonempty snapshot messages without model facts', async () => {
    const app = await start(), id = await migrate(app);
    const state = app.chat.state(id), rows = app.chat.route({ conversationId: id }).items;
    expect(state.conversation.source).toMatchObject({ kind: 'sillytavern-jsonl', messageCount: 6, omittedTurns: 0, failedReplies: 2 });
    expect(rows.map(row => [row.turn.input, row.text])).toEqual([
      ['', '你好，阿宁'], ['先去海边。', ''], ['记得带上那枚贝壳。', '我记着我们的约定。'], ['', '还没说完的半句'], ['我们走吧。', ''],
    ]);
    expect(rows.map(row => app.chat.candidates({ turnId: row.turn.id }).items.map(candidate => candidate.text))).toEqual([
      ['你好，{{user}}', '我们又见面了', '你好，阿宁'], [''], ['旧回复', '我记着我们的约定。', ''], ['还没说完的半句'], [''],
    ]);
    expect(rows.map(row => row.candidate.ordinal)).toEqual([3, 1, 2, 1, 1]);
    const firstReplies = app.chat.candidates({ turnId: rows[0]!.turn.id }).items;
    expect(firstReplies.map(candidate => candidate.imported?.reasoning)).toEqual(['原始首句思路', '另一条首句思路', '当前首句思路']);
    const middleReplies = app.chat.candidates({ turnId: rows[2]!.turn.id }).items;
    expect(middleReplies[2]).toMatchObject({ text: '', imported: { status: 'empty', reasoning: '只有思路' } });
    expect(rows[3]!.candidate).toMatchObject({ status: 'failed', imported: { status: 'failed', error: '原记录中的生成错误', reasoning: '失败思路' } });
    expect(rows.slice(1).map(row => row.turn.parentCandidateId)).toEqual(rows.slice(0, -1).map(row => row.candidate.id));
    expect(app.chat.candidate(rows[0]!.candidate.id).input.messages).toEqual([]);
    expect(app.chat.candidate(rows[2]!.candidate.id).input.messages).toEqual([
      { role: 'assistant', content: '你好，阿宁' }, { role: 'user', content: '先去海边。' }, { role: 'user', content: '记得带上那枚贝壳。' },
    ]);
    expect(app.chat.candidate(rows[4]!.candidate.id).input.messages).toEqual([
      { role: 'assistant', content: '你好，阿宁' }, { role: 'user', content: '先去海边。' }, { role: 'user', content: '记得带上那枚贝壳。' },
      { role: 'assistant', content: '我记着我们的约定。' }, { role: 'assistant', content: '还没说完的半句' }, { role: 'user', content: '我们走吧。' },
    ]);
    for (const row of rows) {
      const detail = app.chat.candidate(row.candidate.id);
      expect(detail.attempts).toEqual([]);
      expect(detail.input.messages.every(message => message.content !== '')).toBe(true);
      expect(app.chat.usage(row.turn.id)).toMatchObject({ requestCount: 0, unknownRequests: 0 });
    }
    const duplicate = await app.importer.inspect('改名.jsonl', source);
    expect(duplicate.conversations[0]).toMatchObject({ state: 'same', existingId: id });
    expect((await app.importer.import({ previewId: duplicate.id, sourceIds: [duplicate.conversations[0]!.sourceId] })).skipped).toEqual([id]);
    const changed = await app.importer.inspect('新版.jsonl', new TextEncoder().encode(source.toString('utf8').replace('我们走吧。', '我们现在走吧。')));
    expect(changed.conversations[0]?.state).toBe('changed');
    const another = await app.importer.import({ previewId: changed.id, sourceIds: [changed.conversations[0]!.sourceId] });
    expect(another.imported).toHaveLength(1);
    expect(another.imported[0]).not.toBe(id);
    expect(app.chat.route({ conversationId: id }).items.at(-1)?.turn.input).toBe('我们走吧。');
    expect(app.adapter.calls).toEqual([]);
  });

  it('keeps input-only SillyTavern depths on real nonempty messages in both paged history and previews', async () => {
    const app = await start(), id = await migrate(app);
    const rows = app.chat.route({ conversationId: id }).items;
    // Six source messages: assistant, user, user+assistant, assistant, user.
    expect(rows.map(row => row.display?.depth)).toEqual([5, 4, 2, 1, 0]);
    expect(rows.map(row => row.display?.inputDepth)).toEqual([undefined, 4, 3, undefined, 0]);
    const older = app.chat.route({ conversationId: id, offset: 3, limit: 1 });
    expect(older.total).toBe(5);
    expect(older.items).toHaveLength(1);
    expect(older.items[0]).toMatchObject({ turn: { input: '先去海边。' }, text: '', display: { depth: 4, inputDepth: 4 } });
    for (const index of [1, 4]) {
      const row = rows[index]!;
      const before = app.chat.candidate(row.candidate.id);
      expect(app.chat.previewCandidate(row.candidate.id).display).toMatchObject({ depth: index === 1 ? 4 : 0, inputDepth: index === 1 ? 4 : 0 });
      expect(app.chat.candidate(row.candidate.id)).toEqual(before);
      expect(app.chat.usage(row.turn.id).requestCount).toBe(0);
    }
    expect(app.chat.state(id).conversation.currentCandidateId).toBe(rows.at(-1)!.candidate.id);
    expect(app.adapter.calls).toEqual([]);
  });

  it('applies zero-depth input display rules when a failed reply has no body without changing saved input or errors', async () => {
    const app = await start(), rules = inputDisplayRule(app, 0);
    const conversation = await app.chat.create({ title: '无正文的失败', bindings: [rules], settings: { mainRoute: route } });
    app.adapter.failures.push({ failure: { code: 'UPSTREAM_BUSY', status: 429, message: '没有正文的失败' } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '原输入' });
    await expect.poll(() => app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]?.status).toBe('failed');
    const candidate = app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]!;
    app.chat.select(candidate.id);
    const before = app.chat.candidate(candidate.id), view = app.chat.previewCandidate(candidate.id);
    expect(view.text).toBe('');
    expect(view.display).toMatchObject({ depth: 0, inputDepth: 0 });
    expect(displayWithRules('原输入', view.display!.rules, 'input', view.display!.context, view.display!.inputDepth)).toBe('就近输入');
    const page = app.chat.route({ conversationId: conversation.id, limit: 1 });
    expect(page.items[0]?.display).toMatchObject({ depth: 0, inputDepth: 0 });
    expect(page.items[0]?.text).toBe('');
    expect(app.chat.candidate(candidate.id)).toEqual(before);
    expect(before.input.messages).toEqual([{ role: 'user', content: '原输入' }]);
    expect(before.attempts[0]?.error?.message).toBe('没有正文的失败');
    const whitespace = app.chat.editCandidate(candidate.id, ' ');
    expect(app.chat.previewCandidate(whitespace.id).display?.inputDepth).toBe(1);
    expect(app.chat.usage(group.turnId)).toMatchObject({ requestCount: 1, unknownRequests: 1 });
    expect(app.adapter.calls).toHaveLength(1);
  });

  it('counts a continuation prefix as one reply even when the continuation own delta is empty', async () => {
    const app = await start(), rules = inputDisplayRule(app, 1);
    const conversation = await app.chat.create({ title: '空增量仍有前缀', bindings: [rules], settings: { mainRoute: route } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '原输入' });
    const first = await finish(app, group, 0);
    app.adapter.failures.push({ failure: { code: 'UPSTREAM_BUSY', status: 429, message: '续写没有新增正文' } });
    const continued = await app.chat.continueCandidate(first);
    await expect.poll(() => app.chat.candidates({ turnId: group.turnId, groupId: continued.id }).items[0]?.status).toBe('failed');
    const candidate = app.chat.candidates({ turnId: group.turnId, groupId: continued.id }).items[0]!;
    app.chat.select(candidate.id);
    const before = app.chat.candidate(candidate.id), view = app.chat.previewCandidate(candidate.id);
    expect(view.candidate).toMatchObject({ kind: 'continuation', sourceCandidateId: first, text: '' });
    expect(view.text).toBe('海风仍在，我记得我们的约定。');
    expect(view.display).toMatchObject({ depth: 0, inputDepth: 1 });
    expect(displayWithRules('原输入', view.display!.rules, 'input', view.display!.context, view.display!.inputDepth)).toBe('就近输入');
    const page = app.chat.route({ conversationId: conversation.id, limit: 1 });
    expect(page.items[0]?.text).toBe('海风仍在，我记得我们的约定。');
    expect(page.items[0]?.display).toMatchObject({ depth: 0, inputDepth: 1 });
    expect(app.chat.candidate(candidate.id)).toEqual(before);
    expect(app.chat.candidate(first).candidate.text).toBe('海风仍在，我记得我们的约定。');
    expect(app.chat.usage(group.turnId).requestCount).toBe(2);
    expect(app.adapter.calls).toHaveLength(2);
  });

  it('retains the DeepSeek default source kind and excludes failed replies from its selected import history', async () => {
    const app = await start();
    const ticket = await app.importer.inspect('DeepSeek.zip', deepseekArchive());
    const result = await app.importer.import({ previewId: ticket.id, sourceIds: ['selected'] });
    const id = result.imported[0]!;
    expect(app.chat.state(id).conversation.source?.kind).toBe('deepseek-chat-export');
    expect(app.chat.route({ conversationId: id }).items.map(row => [row.turn.input, row.text])).toEqual([['你还记得我们的约定吗', '当然，小岛长，我们约好日落时再见。']]);
    const withStates = app.chat.importHistory({ sourceId: 'deepseek-state-regression', fingerprint: 'states', title: '原路径状态', createdAt: 1, updatedAt: 2, turns: [
      { input: '', reply: '只有首句', reasoning: '', status: 'complete' },
      { input: '失败那轮', reply: '不能进入选中历史的半句', reasoning: '失败思考', error: '来源错误', status: 'failed' },
      { input: '空白那轮', reply: '', reasoning: '', status: 'empty' },
      { input: '最后输入', reply: '最后回复', reasoning: '', status: 'complete' },
    ] }, { name: '状态.json', bytes: new Uint8Array([1, 2, 3]) });
    const selected = app.chat.route({ conversationId: withStates }).items;
    expect(selected.map(row => [row.turn.input, row.text])).toEqual([['', '只有首句'], ['最后输入', '最后回复']]);
    expect(app.chat.candidate(selected[1]!.candidate.id).input.messages).toEqual([{ role: 'assistant', content: '只有首句' }, { role: 'user', content: '最后输入' }]);
    const failedTurn = app.chat.graph(withStates).find(turn => turn.input === '失败那轮')!;
    const failed = app.chat.candidates({ turnId: failedTurn.id }).items[0]!;
    expect(failed).toMatchObject({ status: 'failed', text: '不能进入选中历史的半句', imported: { status: 'failed', reasoning: '失败思考', error: '来源错误' } });
    expect(app.chat.candidate(failed.id).attempts).toEqual([]);
    expect(app.chat.usage(failedTurn.id).requestCount).toBe(0);
    expect(app.adapter.calls).toEqual([]);
  });

  it('restores original JSONL, all swipes, frozen persona avatars and references offline before a rebound connection continues', async () => {
    const app = await start(), id = await migrate(app);
    const person = app.materials.createPersona({ name: '小雨', description: '海边来的旅人', avatar });
    const oldRef = { id: person.id, version: person.currentVersion };
    await app.chat.update(id, { bindings: [oldRef], settings: { mainRoute: route } });
    const firstGroup = await app.chat.send({ conversationId: id, input: '还认得我吗？' }), first = await finish(app, firstGroup, 0);
    const next = app.materials.revisePersona(person.id, { name: '雨', description: '熟悉旧城的旅人', avatar: { ...avatar, base64: nextImage } });
    await app.chat.update(id, { bindings: [ref(next)] });
    const secondGroup = await app.chat.send({ conversationId: id, input: '以后这样叫我。' }), second = await finish(app, secondGroup, 1);
    const exported = await app.fetch(new Request('http://fixture/api/tavern-kit/chat/backup?id=' + id));
    expect(exported.status).toBe(200);
    const bytes = new Uint8Array(await exported.arrayBuffer()), archive = await unzipArchive(bytes);
    expect(archive['source.zip']).toEqual(new Uint8Array(source));
    expect(JSON.parse(new TextDecoder().decode(archive['source.json']))).toEqual({ name: '海边的约定.jsonl' });
    const original = JSON.parse(new TextDecoder().decode(archive['conversation.json'])) as ConversationData;
    expect(original.attempts).toHaveLength(2);
    const clean = await start();
    const restoredResponse = await clean.fetch(new Request('http://fixture/api/tavern-kit/chat/backup', { method: 'POST', body: bytes.buffer }));
    expect(restoredResponse.status).toBe(200);
    const restored = await restoredResponse.json() as { id: string };
    expect(clean.adapter.calls).toEqual([]);
    expect(clean.chat.state(restored.id).conversation.settings.mainRoute).toBeUndefined();
    expect(clean.chat.state(restored.id).conversation.source).toMatchObject({ kind: 'sillytavern-jsonl', messageCount: 6, failedReplies: 2 });
    const restoredRows = clean.chat.route({ conversationId: restored.id }).items;
    expect(restoredRows.slice(0, 5).map(row => [row.turn.input, row.text])).toEqual([
      ['', '你好，阿宁'], ['先去海边。', ''], ['记得带上那枚贝壳。', '我记着我们的约定。'], ['', '还没说完的半句'], ['我们走吧。', ''],
    ]);
    expect(restoredRows.slice(0, 5).map(row => clean.chat.candidates({ turnId: row.turn.id }).items.map(candidate => ({ text: candidate.text, imported: candidate.imported })))).toEqual([
      [
        { text: '你好，{{user}}', imported: { reasoning: '原始首句思路', status: 'complete' } },
        { text: '我们又见面了', imported: { reasoning: '另一条首句思路', status: 'complete' } },
        { text: '你好，阿宁', imported: { reasoning: '当前首句思路', status: 'complete' } },
      ],
      [{ text: '', imported: { reasoning: '', status: 'empty' } }],
      [
        { text: '旧回复', imported: { reasoning: '旧回复思路', status: 'complete' } },
        { text: '我记着我们的约定。', imported: { reasoning: '当前选中的思路', status: 'complete' } },
        { text: '', imported: { reasoning: '只有思路', status: 'empty' } },
      ],
      [{ text: '还没说完的半句', imported: { reasoning: '失败思路', status: 'failed', error: '原记录中的生成错误' } }],
      [{ text: '', imported: { reasoning: '', status: 'empty' } }],
    ]);
    for (const row of restoredRows) for (const candidate of clean.chat.candidates({ turnId: row.turn.id }).items) {
      const detail = clean.chat.candidate(candidate.id);
      expect(detail.candidate.conversationId).toBe(restored.id);
      expect(detail.snapshot.boundaryCandidateId).toBe(row.turn.parentCandidateId);
    }
    const oldReply = restoredRows.find(row => row.turn.input === '还认得我吗？')!, newReply = restoredRows.find(row => row.turn.input === '以后这样叫我。')!;
    expect(oldReply.candidate.id).not.toBe(first); expect(newReply.candidate.id).not.toBe(second);
    for (const [row, name, description, picture] of [[oldReply, '小雨', '海边来的旅人', image], [newReply, '雨', '熟悉旧城的旅人', nextImage]] as const) {
      const view = clean.chat.previewCandidate(row.candidate.id), playerRef = view.display?.playerRef;
      expect(view.display?.context).toMatchObject({ user: name, persona: description });
      expect(playerRef).toBeDefined();
      expect(clean.materials.readVersion(playerRef!).projection.persona).toMatchObject({ name, description });
      expect(clean.materials.resources(playerRef!)[0]?.base64).toBe(picture);
      const detail = clean.chat.candidate(row.candidate.id);
      expect(detail.snapshot.bindings).toContainEqual(playerRef);
      expect(detail.attempts[0]).toMatchObject({ candidateId: row.candidate.id, snapshotId: detail.snapshot.id });
    }
    expect(restoredRows.slice(1).map(row => row.turn.parentCandidateId)).toEqual(restoredRows.slice(0, -1).map(row => row.candidate.id));
    const reexport = await clean.fetch(new Request('http://fixture/api/tavern-kit/chat/backup?id=' + restored.id));
    const roundtrip = await unzipArchive(new Uint8Array(await reexport.arrayBuffer()));
    expect(roundtrip['source.zip']).toEqual(new Uint8Array(source));
    await clean.chat.update(restored.id, { settings: { mainRoute: route } });
    const group = await clean.chat.send({ conversationId: restored.id, input: '我们接着走。' });
    const candidate = await finish(clean, group, 0);
    expect(clean.chat.candidate(candidate).input.messages.some(message => message.content === '我记着我们的约定。')).toBe(true);
    expect(clean.chat.candidate(candidate).input.messages.some(message => message.content === '旧回复')).toBe(false);
  });
});
