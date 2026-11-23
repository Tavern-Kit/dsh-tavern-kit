import type { Context } from '@deepseek-ai/cordis';
import { ToolCallId } from '@deepseek-ai/dsh-llm';
import type { ToolExecutor } from '@deepseek-ai/dsh-tools';
import { afterEach, describe, expect, it } from 'vitest';
import { hostFixture, installedModule, unzipArchive, type HostFixture } from './fixtures/host-runtime.js';
import type { PreviewTicket } from '../packages/rp-deepseek-import/src/types.js';

const apps: HostFixture[] = [];
afterEach(async () => { for (const app of apps.splice(0).reverse()) await app.close(); });
async function start() { const app = await hostFixture(); apps.push(app); return app; }
function bind(app:HostFixture, firstMessage:string) {
  const card=app.materials.importFile('带变量的角色.json',new TextEncoder().encode(JSON.stringify({spec:'chara_card_v3',spec_version:'3.0',data:{name:'阿岚',first_mes:firstMessage,character_book:{name:'变量世界书',entries:[{id:1,comment:'[initvar]',content:'counter: 2\nplace: 海边',enabled:false,keys:[]}]}}})));
  return {id:card.id,version:card.currentVersion};
}
const state=(counter:number)=>({stat_data:{counter},schema:{},initialized_lorebooks:{},display_data:{},delta_data:{}});
async function initializeThroughTool(app:HostFixture,candidateId:string):Promise<unknown>{
  const module:unknown=await installedModule('@deepseek-ai/dsh-tool-executor-native');
  if(!module||typeof module!=='object'||!('NativeToolExecutor'in module)||typeof module.NativeToolExecutor!=='function')throw new TypeError('installed native tool executor is unavailable');
  const Executor=module.NativeToolExecutor as new(ctx:Context)=>ToolExecutor;
  app.ctx.tools.setExecutor(new Executor(app.ctx));
  const batch=await app.ctx.tools.execute({calls:[{type:'tool-call',id:ToolCallId('mvu-initialize'),name:'tavern_chat',arguments:JSON.stringify({action:'initializeVariables',id:candidateId})}],signal:new AbortController().signal});
  const result=batch.results[0]?.result;
  expect(result?.isError,JSON.stringify(result)).toBe(false);
  if(!result||result.isError||typeof result.value!=='string')throw new Error('MVU initialization tool did not return its JSON result');
  return JSON.parse(result.value) as unknown;
}

describe('native MVU through the actual Host', {timeout:20000}, () => {
  it('initializes disabled initvar lore and the greeting override without creating model requests', async () => {
    const app=await start(),ref=bind(app,'<initvar>{"counter":10}</initvar>\n当前记录：{{get_message_variable::stat_data.counter}}');
    const conversation=await app.chat.create({title:'带变量开聊',bindings:[ref]});
    const row=app.chat.route({conversationId:conversation.id}).items[0]!;
    expect(row.candidate.mvu?.state.stat_data).toEqual({counter:10});
    expect(row.text).toContain('{{get_message_variable::stat_data.counter}}');
    expect(app.chat.previewCandidate(row.candidate.id).display?.variables?.stat_data).toEqual({counter:10});
    expect(app.chat.candidate(row.candidate.id).attempts).toEqual([]);
    expect(app.adapter.calls).toEqual([]);
  });

  it('retains edited text state, records explicit variable revisions and initializes old chats without replay', async () => {
    const app=await start(),ref=bind(app,'<initvar>{"counter":10}</initvar>\n<UpdateVariable>_.add("counter",1);</UpdateVariable>');
    const conversation=await app.chat.create({title:'变量修订',bindings:[ref]});
    const candidate=app.chat.route({conversationId:conversation.id}).items[0]!.candidate;
    expect(candidate.mvu?.state.stat_data.counter).toBe(11);
    const changed=app.chat.setVariables(candidate.id,{...candidate.mvu!.state,stat_data:{counter:20}});
    expect(changed.mvu?.state.stat_data.counter).toBe(20);
    expect(changed.mvu?.revisions?.at(-1)?.state.stat_data.counter).toBe(11);
    const edited=app.chat.editCandidate(candidate.id,'手改正文 <UpdateVariable>_.add("counter",100);</UpdateVariable>');
    expect(edited.mvu?.state.stat_data.counter).toBe(20);
    expect(app.chat.previewCandidate(candidate.id).text).toContain('_.add("counter",1)');
    const disabled=await app.chat.create({title:'旧聊天',bindings:[ref],settings:{mvuEnabled:false}});
    const old=app.chat.route({conversationId:disabled.id}).items[0]!.candidate;
    expect(old.mvu).toBeUndefined();
    await app.chat.update(disabled.id,{bindings:[]});
    app.chat.initializeVariables(old.id);
    expect(app.chat.previewCandidate(old.id).candidate.mvu?.state.stat_data).toEqual({});
    expect(app.chat.previewCandidate(old.id).text).toContain('_.add("counter",1)');
    expect(app.adapter.calls).toEqual([]);
  });

  it('expands the frozen character and player macros before greeting and explicit old-chat initialization', async () => {
    const app=await start();
    const raw={spec:'chara_card_v3',spec_version:'3.0',data:{name:'阿岚',first_mes:'<initvar>{"owner":"{{user}}","guide":"{{char}}"}</initvar>原始首句',character_book:{name:'身份变量',entries:[{id:1,comment:'[initvar]',content:'owner: "{{user}}"\nguide: "{{char}}"',enabled:false,keys:[]}]}}};
    const card=app.materials.importFile('身份变量.json',new TextEncoder().encode(JSON.stringify(raw))),ref={id:card.id,version:card.currentVersion};
    const fresh=await app.chat.create({title:'变量首句身份',bindings:[ref],settings:{playerName:'阿宁'}});
    const greeting=app.chat.route({conversationId:fresh.id}).items[0]!.candidate;
    expect(greeting.mvu?.state.stat_data).toEqual({owner:'阿宁',guide:'阿岚'});
    expect(greeting.text).toContain('{{user}}');
    const old=await app.chat.create({title:'主动开启旧聊天',bindings:[ref],settings:{playerName:'小雨',mvuEnabled:false}});
    const oldCandidate=app.chat.route({conversationId:old.id}).items[0]!.candidate;
    app.chat.initializeVariables(oldCandidate.id);
    const initialized=app.chat.route({conversationId:old.id}).items[0]!.candidate;
    expect(initialized.mvu?.state.stat_data).toEqual({owner:'小雨',guide:'阿岚'});
    expect(initialized.text).toContain('{{user}}');
    expect(app.adapter.calls).toEqual([]);
  });

  it.each(['Host','ordinary tool'] as const)('initializes only the previewed swipe through %s without selecting it or replaying its text',async caller=>{
    const app=await start(),ref=bind(app,'');
    const first='第一条原文 <UpdateVariable>_.add("counter",100);</UpdateVariable>',second='当前选中的第二条';
    const bytes=new TextEncoder().encode([
      {user_name:'小雨',character_name:'阿岚',chat_metadata:{integrity:'mvu-preview-source'}},
      {is_user:true,name:'小雨',mes:'原来的问题'},
      {is_user:false,name:'阿岚',mes:second,swipes:[first,second],swipe_id:1},
    ].map(value=>JSON.stringify(value)).join('\n'));
    const response=await app.fetch(new Request('http://fixture/api/tavern-kit/deepseek/preview?name=old-swipes.jsonl',{method:'POST',body:bytes}));
    expect(response.status).toBe(200);
    const ticket=await response.json() as PreviewTicket;
    const imported=await app.importer.import({previewId:ticket.id,sourceIds:[ticket.conversations[0]!.sourceId]});
    const id=imported.imported[0]!;
    await app.chat.update(id,{bindings:[ref],settings:{mvuEnabled:false}});
    const row=app.chat.route({conversationId:id}).items[0]!,[viewed,selected]=app.chat.candidates({turnId:row.turn.id}).items;
    expect(viewed?.mvu).toBeUndefined();expect(selected?.mvu).toBeUndefined();
    expect(app.chat.state(id).conversation.currentCandidateId).toBe(selected!.id);
    const before=app.chat.candidate(viewed!.id);
    expect(app.chat.previewCandidate(viewed!.id).text).toBe(first);

    const result=caller==='Host'?app.chat.initializeVariables(viewed!.id):await initializeThroughTool(app,viewed!.id);

    const after=app.chat.candidate(viewed!.id),conversation=app.chat.state(id).conversation;
    expect(result).toEqual(conversation);
    expect(conversation.settings.mvuEnabled).toBe(true);
    expect(conversation.currentCandidateId).toBe(selected!.id);
    expect(after.candidate.mvu).toMatchObject({state:{stat_data:{counter:2,place:'海边'}},kind:'manual'});
    expect(app.chat.previewCandidate(selected!.id).candidate).toEqual(selected);
    expect(after.text).toBe(first);expect(after.input).toEqual(before.input);expect(after.snapshot).toEqual(before.snapshot);expect(after.attempts).toEqual([]);
    expect(app.adapter.calls).toEqual([]);
  });

  it('preserves per-swipe values and only falls back to final chat metadata on the final selected message', async () => {
    const app=await start();
    const bytes=new TextEncoder().encode([
      {user_name:'小雨',character_name:'阿岚',chat_metadata:{integrity:'mvu-host-source',variables:state(999)}},
      {is_user:false,name:'阿岚',mes:'另一种初见',swipes:['初见','另一种初见'],swipe_id:1,variables:[state(14),state(26)]},
      {is_user:true,name:'小雨',mes:'后来呢？'},
      {is_user:false,name:'阿岚',mes:'故事继续。'},
    ].map(value=>JSON.stringify(value)).join('\n'));
    const response=await app.fetch(new Request('http://fixture/api/tavern-kit/deepseek/preview?name=mvu.jsonl',{method:'POST',body:bytes}));
    expect(response.status).toBe(200);
    const ticket=await response.json() as PreviewTicket;
    const result=await app.importer.import({previewId:ticket.id,sourceIds:[ticket.conversations[0]!.sourceId]});
    const id=result.imported[0]!,rows=app.chat.route({conversationId:id}).items;
    expect(app.chat.candidates({turnId:rows[0]!.turn.id}).items.map(candidate=>candidate.mvu?.state.stat_data.counter)).toEqual([14,26]);
    expect(rows.at(-1)?.candidate.mvu?.state.stat_data.counter).toBe(999);
    expect(app.adapter.calls).toEqual([]);
    const backup=await app.fetch(new Request(`http://fixture/api/tavern-kit/chat/backup?id=${id}`));
    const archived=new Uint8Array(await backup.arrayBuffer());
    expect((await unzipArchive(archived))['source.zip']).toEqual(bytes);
    const restored=app.chat.restore(archived),restoredRows=app.chat.route({conversationId:restored.id}).items;
    expect(restoredRows.map(row=>row.candidate.mvu?.state.stat_data.counter)).toEqual([26,999]);
    expect(app.adapter.calls).toEqual([]);
  });
});
