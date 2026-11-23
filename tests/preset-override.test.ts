import { afterEach, describe, expect, it } from 'vitest';
import type { CandidateGroup, MaterialRef } from '../packages/rp-chat/src/types.js';
import { hostFixture, RAW_MODEL, type FixtureCall, type HostFixture } from './fixtures/host-runtime.js';

const apps: HostFixture[] = [];
afterEach(async () => { for (const app of apps.splice(0).reverse()) await app.close(); });
const route = { provider: 'host-local', model: RAW_MODEL, inputBudget: 24000 };

async function start() {
  const app = await hostFixture(); apps.push(app);
  const preset = (name: string, content: string, temperature: number, maxTokens: number) => {
    const value = app.materials.importFile(name, new TextEncoder().encode(JSON.stringify({
      temperature, openai_max_tokens: maxTokens,
      prompts: [
        { identifier: 'main', role: 'system', content, forbid_overrides: true },
        { identifier: 'chatHistory', marker: true },
      ],
      prompt_order: [{ character_id: 100001, order: [
        { identifier: 'main', enabled: true }, { identifier: 'chatHistory', enabled: true },
      ] }],
    })));
    return { id: value.id, version: value.currentVersion };
  };
  const a = preset('角色默认预设A.json', '使用角色默认预设A', 0.9, 1200);
  const b = preset('当前对话预设B.json', '使用当前对话预设B', 0.2, 640);
  const imported = app.materials.importFile('江澈.json', new TextEncoder().encode(JSON.stringify({
    spec: 'chara_card_v3', spec_version: '3.0', data: { name: '江澈', description: '旧城书店的店主' },
  })));
  const version = app.materials.revise(imported.id, { bindings: { worldbooks: [], preset: a } });
  const card: MaterialRef = { id: version.id, version: version.version };
  return { app, a, b, card };
}

async function finish(app: HostFixture, group: CandidateGroup, index: number) {
  await expect.poll(() => app.adapter.calls.length).toBe(index + 1);
  app.adapter.calls[index]!.release();
  await expect.poll(() => app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]?.status).toBe('complete');
  return app.chat.candidate(app.chat.candidates({ turnId: group.turnId, groupId: group.id }).items[0]!.id);
}
function dispatchedText(call: FixtureCall): string {
  return [call.options.system ?? '', ...call.options.messages.flatMap(message => message.content.flatMap(block => block.type === 'text' ? [block.text] : []))].join('\n');
}

// Actual material ownership, SQLite, prompt assembly and DSH prepareCall/stream stay in the test.
// Only the external model is controlled by the existing Host fixture.
describe('当前对话预设优先于角色推荐预设', { timeout: 20000 }, () => {
  it('只绑定角色时使用其默认预设的提示词和采样参数', async () => {
    const { app, a, card } = await start();
    const conversation = await app.chat.create({ title: '沿用角色默认', bindings: [card], settings: { mainRoute: route, controls: {} } });
    const group = await app.chat.send({ conversationId: conversation.id, input: '你好。' });
    const detail = await finish(app, group, 0);

    expect(dispatchedText(app.adapter.calls[0]!)).toContain('使用角色默认预设A');
    expect(dispatchedText(app.adapter.calls[0]!)).not.toContain('使用当前对话预设B');
    expect(app.adapter.calls[0]!.options).toMatchObject({ temperature: 0.9, maxTokens: 1200 });
    expect(detail.snapshot.options.controls).toMatchObject({ temperature: 0.9, maxTokens: 1200 });
    expect(detail.attempts[0]?.config).toMatchObject({ temperature: 0.9, maxTokens: 1200 });
    expect(app.materials.readVersion(card).bindings).toEqual({ worldbooks: [], preset: a });
  });

  it('明确选B后同一轮换回复使用B的完整预设，移除B可恢复A且旧快照和角色绑定不变', async () => {
    const { app, a, b, card } = await start();
    const cardBefore = app.materials.readVersion(card), originalBytes = app.materials.exportOriginal(card.id);
    const conversation = await app.chat.create({ title: '这段对话换预设', bindings: [card], settings: { mainRoute: route, controls: {} } });
    const originalGroup = await app.chat.send({ conversationId: conversation.id, input: '照我们的设定接着聊。' });
    const oldCandidate = await finish(app, originalGroup, 0);
    const frozen = structuredClone({ snapshot: oldCandidate.snapshot, input: oldCandidate.input, attempts: oldCandidate.attempts });

    // This is the same direct binding order saved when SettingsForm appends its B checkbox.
    await app.chat.update(conversation.id, { bindings: [card, b] });
    expect(app.chat.state(conversation.id).conversation.bindings).toEqual([card, b]);
    expect(app.adapter.calls).toHaveLength(1);
    const nextGroup = await app.chat.roll(originalGroup.turnId);
    const next = await finish(app, nextGroup, 1);

    expect(nextGroup.id).not.toBe(originalGroup.id);
    expect.soft(dispatchedText(app.adapter.calls[1]!)).toContain('使用当前对话预设B');
    expect.soft(dispatchedText(app.adapter.calls[1]!)).not.toContain('使用角色默认预设A');
    expect.soft(app.adapter.calls[1]!.options).toMatchObject({ temperature: 0.2, maxTokens: 640 });
    expect.soft(next.input.messages.map(message => message.content)).toContain('使用当前对话预设B');
    expect.soft(next.snapshot.options.controls).toMatchObject({ temperature: 0.2, maxTokens: 640 });
    expect.soft(next.attempts[0]?.config).toMatchObject({ temperature: 0.2, maxTokens: 640 });

    await app.chat.update(conversation.id, { bindings: [card] });
    const defaultGroup = await app.chat.roll(originalGroup.turnId);
    await finish(app, defaultGroup, 2);
    expect(dispatchedText(app.adapter.calls[2]!)).toContain('使用角色默认预设A');
    expect(app.adapter.calls[2]!.options).toMatchObject({ temperature: 0.9, maxTokens: 1200 });
    const old = app.chat.candidate(oldCandidate.candidate.id);
    expect({ snapshot: old.snapshot, input: old.input, attempts: old.attempts }).toEqual(frozen);
    expect(app.materials.readVersion(card)).toEqual(cardBefore);
    expect(app.materials.readVersion(card).bindings).toEqual({ worldbooks: [], preset: a });
    expect(app.materials.exportOriginal(card.id)).toEqual(originalBytes);
  });

  it.each(['create', 'update'] as const)('%s 拒绝两份不同的直接预设，拒绝时已有对话不变', async action => {
    const { app, a, b, card } = await start();
    const conversation = await app.chat.create({ title: '保留已有设定', bindings: [card] });
    const beforeState = structuredClone(app.chat.state(conversation.id));
    const beforeList = structuredClone(app.chat.list());
    const input = { title: '不应保存', bindings: [card, a, b] };

    const saving = action === 'create' ? app.chat.create(input) : app.chat.update(conversation.id, input);
    await expect(saving).rejects.toThrow(/预设/);
    expect(app.chat.list()).toEqual(beforeList);
    expect(app.chat.state(conversation.id)).toEqual(beforeState);

    // Repeating the same pinned version is still one preset, not a second choice.
    const repeated = await app.chat.create({ title: '一份明确预设', bindings: [card, b, b] });
    expect(repeated.id).not.toBe(conversation.id);
    expect(app.adapter.calls).toEqual([]);
  });
});
