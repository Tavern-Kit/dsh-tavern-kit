// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';
import {MaterialsLibrary} from '@tavern-kit/rp-materials/library';
import {ConversationStore} from './store.js';
import {ChatEngine,type LlmGateway} from './engine.js';
import {ChatPanel,type ChatPanelApi} from './ChatPanel.js';
import type {ChatSettings} from './types.js';
import type {ChatChange,DisplayProjection} from './protocol.js';
import type {MaterialVersion,PersonaDraft,RegexRule} from '@tavern-kit/rp-materials/types';
import type {Route} from '@tavern-kit/rp-connections/types';
import {validateErrorPatterns} from '@tavern-kit/rp-connections/routing';

const displayRule=(replaceString:string,findRegex='/小夏/g'):RegexRule=>({id:'display-name',name:'阅读称呼',findRegex,replaceString,trimStrings:[],placements:['input','output'],displayOnly:true,promptOnly:false,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'});
const currentMaterial:MaterialVersion={id:'current-regex',version:2,originalId:'current-original',createdAt:'2026-11-18',raw:{},capabilities:[],bindings:{worldbooks:[],preset:null},projection:{kind:'regex',name:'新版显示规则',character:null,worldbook:null,preset:null,regex:[displayRule('新版名字')],quickReplies:[]}};
const disposers:Array<()=>Promise<void>>=[];
afterEach(async()=>{cleanup();vi.restoreAllMocks();for(const dispose of disposers.splice(0))await dispose();});
// Seed the documented JSON with jsdom-owned bytes; actual Host persona creation is tested in rp-additions.
function savePersona(library:MaterialsLibrary,draft:PersonaDraft){
 return library.import({name:`${draft.name}.persona.json`,bytes:Uint8Array.from(new TextEncoder().encode(JSON.stringify({format:'tavern-kit.persona',version:1,...draft})))});
}
function fixture(count=1,gate?:Promise<void>,material?:MaterialVersion,startGate?:Promise<void>){
 const store=new ConversationStore(':memory:');let requests=0;const requestedRoutes:Array<Pick<Route,'provider'|'model'>>=[];
 const displays=new Map<string,DisplayProjection>();
 const llm:LlmGateway={async prepare(config){requests++;requestedRoutes.push({provider:config.provider,model:config.model});return {config,async *stream(){if(startGate)await startGate;yield {type:'text',text:'新的'} as const;if(gate)await gate;yield {type:'text',text:'答复'} as const;yield {type:'finish',reason:'stop'} as const;}};}};
 const engine=new ChatEngine(store,llm,()=>material?[material]:[]);
 const settings:Partial<ChatSettings>={mainRoute:{provider:'local',model:'原始/[模型]',inputBudget:12000}};
 const conversation=store.createConversation({title:'海边的约定',settings,bindings:material?[{id:material.id,version:material.version}]:[]});
 const turn=store.createTurn(conversation.id,{input:'小夏，还记得我们的约定吗？'});
 const snapshot=store.createSnapshot(conversation.id,{system:'记得称呼和约定',messages:[{role:'user',content:turn.input}],bindings:[],options:{}});
 const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[settings.mainRoute!],settingsRevision:1});
 const first=store.createCandidate(group.id,{kind:'generated',text:'我记得，小夏。',status:'complete'});store.selectCandidate(first.id);
 for(let i=1;i<count;i++)store.createCandidate(group.id,{kind:'generated',text:`候选正文 ${i+1}`,status:'complete'});
 const api:ChatPanelApi={
   async initializeVariables(id){return store.updateConversation(store.getCandidate(id).conversationId,{settings:{mvuEnabled:true}});},async setVariables(id,state){return store.setCandidateMvu(id,{state,issues:[],kind:'manual'});},
  async list(){return store.listConversations();},async create(input){return store.createConversation(input);},async update(id,input){return store.updateConversation(id,input);},
  async state(id){const value=store.getConversation(id);const rows=store.route(id).map(row=>({...row,text:store.candidateText(row.candidate.id),display:displays.get(row.candidate.id)}));return {conversation:value,route:{items:rows.slice(-30),total:rows.length},pending:store.listTurns(id).flatMap(t=>store.listCandidates(t.id).items.filter(c=>['pending','streaming'].includes(c.status))),memo:store.applicableMemo(id)};},
  async route(input){const rows=store.route(input.conversationId).map(row=>({...row,text:store.candidateText(row.candidate.id),display:displays.get(row.candidate.id)})).reverse();return {total:rows.length,items:rows.slice(input.offset??0,(input.offset??0)+(input.limit??30)).reverse()};},
  async candidates(input){return store.listCandidates(input.turnId,input);},async previewCandidate(id){return {candidate:store.getCandidate(id),text:store.candidateText(id),route:store.actualRoute(id),display:displays.get(id),failures:store.attemptsForCandidate(id).flatMap(attempt=>attempt.error&&(attempt.status==='failed'||attempt.status==='skipped')?[{attemptId:attempt.id,provider:attempt.config.provider,model:attempt.config.model,label:attempt.route?.label,group:attempt.route?.group,status:attempt.status,code:attempt.error.code,httpStatus:attempt.error.status,message:attempt.error.message}]:[])};},
  async candidate(id){const candidate=store.getCandidate(id),group=store.getGroup(candidate.groupId);return {candidate,text:store.candidateText(id),snapshot:store.getSnapshot(group.snapshotId),input:store.inputForSnapshot(group.snapshotId),materials:[],attempts:store.attemptsForCandidate(id)};},
  async usage(id){return {...store.usageForTurn(id),summaryRequests:0,continuationRequests:0};},
  async send(input){return engine.send(input.conversationId,input.input,input.parentCandidateId);},async roll(id){return engine.roll(id);},async editInput(id,input){return engine.editInput(id,input);},
  async editCandidate(id,text){return engine.editCandidate(id,text);},async continueCandidate(id){return engine.continueCandidate(id);},async select(id){engine.select(id);return store.getConversation(store.getCandidate(id).conversationId);},async favorite(id,value){return store.setFavorite(id,value);},
  async stopCandidate(id){engine.stopCandidate(id);},async stopGroup(id){engine.stopGroup(id);},async memos(id){return store.memos(id);},async editMemo(id,content,locked){return engine.editMemo(id,content,locked);},async graph(id){return store.turnSummaries(id);},async search(input){return store.search(input);},async searchPreview(hit){return store.searchPreview(hit);},
  watch(id,onChange){return engine.subscribe(id,onChange);},async listMaterials(){return material?[{id:material.id,name:material.projection.name,kind:material.projection.kind,category:'',tags:[],enabled:true,currentVersion:material.version,createdAt:material.createdAt,updatedAt:material.createdAt}]:[];},async materialVersion(){if(material)return material;throw new Error('无绑定素材');},async listConnections(){return [{id:'local',provider:'local',name:'本地模型',credentialConfigured:true,active:true,models:[{id:'原始/[模型]',name:'原始/[模型]'}],preference:{selectedModel:'原始/[模型]'}}];},async resolveRoute(route){return route;},async defaultFallback(){return [];},async fallbackOn400(){return true;},
 };
 disposers.push(async()=>{await engine.dispose();store.close();});
 return {store,engine,api,conversation,turn,first,displays,requestedRoutes,requests:()=>requests};
}
function longRouteFixture(gate?:Promise<void>,startGate?:Promise<void>,count=30){
 const f=fixture(1,gate,undefined,startGate);let turn=f.turn,first=f.first;
 for(let index=1;index<count;index++){
  turn=f.store.createTurn(f.conversation.id,{input:`旧剧情第${index+1}句`,parentCandidateId:first.id});
  const snapshot=f.store.createSnapshot(f.conversation.id,{system:'记得称呼和约定',messages:[{role:'user',content:turn.input}],bindings:[],options:{}});
  const group=f.store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[f.conversation.settings.mainRoute!],settingsRevision:1});
  first=f.store.createCandidate(group.id,{kind:'generated',text:`第${index+1}轮的长回复`,status:'complete'});
 }
 f.store.selectCandidate(first.id);
 return {...f,turn,first};
}
/** jsdom has no layout: supply viewport geometry while exercising the real transcript and scroll element. */
function transcriptGeometry(){
 let height=5000;const positions=new WeakMap<Element,number>();
 vi.spyOn(Element.prototype,'scrollHeight','get').mockImplementation(function(this:Element){return this.classList.contains('tk-reading')?height:0;});
 vi.spyOn(Element.prototype,'clientHeight','get').mockImplementation(function(this:Element){return this.classList.contains('tk-reading')?400:0;});
 vi.spyOn(Element.prototype,'scrollTop','get').mockImplementation(function(this:Element){return positions.get(this)??0;});
 vi.spyOn(Element.prototype,'scrollTop','set').mockImplementation(function(this:Element,value:number){positions.set(this,Math.max(0,Math.min(value,this.scrollHeight-this.clientHeight)));});
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  if(this.classList.contains('tk-reading'))return new DOMRect(0,100,340,400);
  if(this.classList.contains('tk-current-reply'))return new DOMRect(0,3700-(this.parentElement?.scrollTop??0),340,1200);
  return new DOMRect();
 });
 return {grow(){height+=400;}};
}
function deferred(){
 let release=()=>{};const promise=new Promise<void>(resolve=>{release=resolve;});
 return {promise,release};
}
function historyText(){return Array.from(document.querySelectorAll('.tk-history-turn'),row=>row.textContent);}
function liveUpdates(api:ChatPanelApi):(event:ChatChange)=>void{
 let listener:((event:ChatChange)=>void)|undefined;const watch=api.watch;
 api.watch=(id,onChange,onError)=>{listener=onChange;return watch(id,onChange,onError);};
 return event=>{if(!listener)throw new Error('聊天订阅尚未建立');listener(event);};
}

describe('日常聊天界面接入真实剧情仓',()=>{
  it('编辑期间保留原任务并阻止发送或切换目标，取消后立即恢复原操作',async()=>{
   const f=fixture(2),user=userEvent.setup();render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByLabelText('当前候选');await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
   const region=screen.getByRole('region',{name:'编辑角色回复'});fireEvent.change(within(region).getByRole('textbox',{name:'角色回复'}),{target:{value:'尚未保存的手改'}});
   const composer=screen.getByRole('textbox',{name:'想说的话'});fireEvent.change(composer,{target:{value:'下一句仍是聊天草稿'}});
   expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(true);
   fireEvent.keyDown(composer,{key:'Enter',ctrlKey:true});await user.click(screen.getByRole('button',{name:'回到首页'}));
   expect(screen.getByRole('region',{name:'编辑角色回复'})).toBe(region);expect((within(region).getByRole('textbox',{name:'角色回复'}) as HTMLTextAreaElement).value).toBe('尚未保存的手改');
   expect(f.store.listTurns(f.conversation.id)).toHaveLength(1);expect(f.requests()).toBe(0);
   await user.click(within(region).getByRole('button',{name:'返回阅读'}));expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(false);
   expect((screen.getByRole('button',{name:'下一个候选'}) as HTMLButtonElement).disabled).toBe(false);expect((composer as HTMLTextAreaElement).value).toBe('下一句仍是聊天草稿');
  });
  it('未完成的角色编辑不会被玩家原文入口替换，取消后才能编辑下一目标',async()=>{
   const f=fixture(),user=userEvent.setup();render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByLabelText('当前候选');await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
   const region=screen.getByRole('region',{name:'编辑角色回复'}),field=within(region).getByRole('textbox',{name:'角色回复'});fireEvent.change(field,{target:{value:'尚未保存的角色修改'}});
   const other=screen.getByRole('button',{name:'修改这句'});expect((other as HTMLButtonElement).disabled).toBe(true);await user.click(other);
   expect(screen.getByRole('region',{name:'编辑角色回复'})).toBe(region);expect((field as HTMLTextAreaElement).value).toBe('尚未保存的角色修改');expect(screen.queryByRole('region',{name:'修改玩家原文'})).toBeNull();
   await user.click(within(region).getByRole('button',{name:'返回阅读'}));await user.click(other);expect(screen.getByRole('region',{name:'修改玩家原文'})).toBeTruthy();
   expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.requests()).toBe(0);
  });
  it('上一句准备完成只清提交时那一版草稿，期间写下的下一句保留',async()=>{
   const f=fixture(),user=userEvent.setup(),pending=deferred(),send=f.api.send;let submitted='';
   f.api.send=async input=>{submitted=input.input;await pending.promise;return send(input);};
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);await screen.findByLabelText('当前候选');
   const field=screen.getByRole('textbox',{name:'想说的话'});fireEvent.change(field,{target:{value:'先发这一句'}});await user.click(screen.getByRole('button',{name:'发送'}));
   expect(submitted).toBe('先发这一句');fireEvent.change(field,{target:{value:'准备期间继续写的下一句'}});
   await act(async()=>{pending.release();});await waitFor(()=>expect(f.store.listTurns(f.conversation.id)).toHaveLength(2));
   await waitFor(()=>expect((screen.getByRole('button',{name:'发送'}) as HTMLButtonElement).disabled).toBe(false));
   expect((field as HTMLTextAreaElement).value).toBe('准备期间继续写的下一句');expect(f.requests()).toBe(1);
  });
  it('旧会话的提交回包不会清掉另一会话正在写的草稿',async()=>{
   const f=fixture(),user=userEvent.setup(),pending=deferred(),send=f.api.send;
   const other=f.store.createConversation({title:'另一段对话',settings:{mainRoute:f.conversation.settings.mainRoute}});f.api.send=async input=>{await pending.promise;return send(input);};
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);await screen.findByLabelText('当前候选');
   fireEvent.change(screen.getByRole('textbox',{name:'想说的话'}),{target:{value:'旧对话提交'}});await user.click(screen.getByRole('button',{name:'发送'}));
   await user.click(screen.getByRole('button',{name:/另一段对话/}));await screen.findByRole('heading',{name:'另一段对话'});
   fireEvent.change(screen.getByRole('textbox',{name:'想说的话'}),{target:{value:'另一个会话的新稿'}});await act(async()=>{pending.release();});await waitFor(()=>expect(f.store.listTurns(f.conversation.id)).toHaveLength(2));
   expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('另一个会话的新稿');expect(f.store.getConversation(other.id).currentCandidateId).toBeUndefined();
  });

  it('角色回复就地编辑，Escape即时返回并保留聊天草稿、阅读位置和原候选',async()=>{
   const f=fixture(),user=userEvent.setup();render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   const reply=await screen.findByLabelText('当前候选'),reading=reply.parentElement!;reading.scrollTop=321;fireEvent.scroll(reading);
   fireEvent.change(screen.getByRole('textbox',{name:'想说的话'}),{target:{value:'还没说完'}});
   await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
   const region=within(reply).getByRole('region',{name:'编辑角色回复'}),edit=within(region).getByRole('textbox',{name:'角色回复'});
   expect(screen.queryByRole('dialog',{name:'编辑角色回复'})).toBeNull();expect(document.activeElement).toBe(edit);
   fireEvent.change(edit,{target:{value:'暂存的改字'}});await user.keyboard('{Escape}');
   expect(screen.queryByRole('region',{name:'编辑角色回复'})).toBeNull();expect(within(reply).getByText('我记得，小夏。')).toBeTruthy();
   expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('还没说完');expect(reading.scrollTop).toBe(321);
   expect(f.store.listCandidates(f.turn.id).total).toBe(1);expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.requests()).toBe(0);
  });
  it('就地编辑保存失败保留稿件，快捷键只保存本条且保留原候选和选中路线',async()=>{
   const f=fixture(2),user=userEvent.setup();let reject=true;const editCandidate=f.api.editCandidate;
   f.api.editCandidate=async(id,text)=>{if(reject)throw new Error('本地保存失败');return editCandidate(id,text);};
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   const reply=await screen.findByLabelText('当前候选');fireEvent.change(screen.getByRole('textbox',{name:'想说的话'}),{target:{value:'不要发送这句'}});
   await user.click(screen.getByRole('button',{name:'下一个候选'}));await screen.findByText('候选正文 2');
   await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
   const region=within(reply).getByRole('region',{name:'编辑角色回复'}),input=within(region).getByRole('textbox',{name:'角色回复'});fireEvent.change(input,{target:{value:'手改新的称呼'}});
   await user.click(within(region).getByRole('button',{name:'另存为候选'}));expect((await within(region).findByRole('alert')).textContent).toContain('本地保存失败');
   expect((input as HTMLTextAreaElement).value).toBe('手改新的称呼');reject=false;fireEvent.keyDown(input,{key:'Enter',ctrlKey:true});
   await waitFor(()=>expect(f.store.listCandidates(f.turn.id).total).toBe(3));expect(await screen.findByText('手改新的称呼')).toBeTruthy();
   expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);expect(f.store.listCandidates(f.turn.id).items[1]!.text).toBe('候选正文 2');
   expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('不要发送这句');expect(f.requests()).toBe(0);
  });
  it('输入行动由空稿生成态变为停止，写下草稿后可继续发送且停止不等待动效',async()=>{
   const pending=deferred(),f=fixture(1,pending.promise),user=userEvent.setup(),stop=vi.spyOn(f.api,'stopCandidate');
   try{
    render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
    await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'换个回复'}));await screen.findByText('新的');
    const action=screen.getByRole('button',{name:'停止生成'}),textarea=screen.getByRole('textbox',{name:'想说的话'});
    fireEvent.change(textarea,{target:{value:'还想说的话'}});expect(screen.getByRole('button',{name:'发送'})).toBe(action);
    fireEvent.change(textarea,{target:{value:''}});await user.click(screen.getByRole('button',{name:'停止生成'}));
    expect(stop).toHaveBeenCalledWith(f.store.listCandidates(f.turn.id).items.at(-1)!.id);
    await act(async()=>{pending.release();});
    await waitFor(()=>expect(f.store.listCandidates(f.turn.id).items.at(-1)!.status).toBe('stopped'));
    expect(f.store.listTurns(f.conversation.id)).toHaveLength(1);expect(f.requests()).toBe(1);expect(screen.getByRole('textbox',{name:'想说的话'})).toBe(textarea);
   }finally{pending.release();}
  });

  it('对话明确单选预设覆盖角色默认，移除选择后仍保留角色绑定',async()=>{
   const f=fixture(),user=userEvent.setup(),library=new MaterialsLibrary(':memory:');
   disposers.push(async()=>library.close());
   const make=(name:string,raw:object)=>library.import({name,bytes:Uint8Array.from(new TextEncoder().encode(JSON.stringify(raw)))});
   const a=make('默认.json',{prompts:[{identifier:'main',name:'角色预设',role:'system',content:'卡内预设A'}]}),b=make('自选.json',{prompts:[{identifier:'main',name:'会话预设',role:'system',content:'会话预设B'}]});
   const card=make('角色.json',{spec:'chara_card_v3',spec_version:'3.0',data:{name:'江澈'}}),updated=library.setBindings(card.id,{preset:{id:a.id,version:a.currentVersion},worldbooks:[]}),cardRef={id:card.id,version:updated.version};
   f.store.updateConversation(f.conversation.id,{bindings:[cardRef]});f.api.listMaterials=async()=>library.list();f.api.materialVersion=async ref=>library.readVersion(ref);
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'对话设定'}));
   const panel=screen.getByRole('dialog',{name:'对话设定'});await user.click(within(panel).getByText('绑定素材与高级设置'));
   const preset=within(panel).getByRole('combobox',{name:'提示词预设'});
   await user.selectOptions(preset,JSON.stringify([b.id,b.currentVersion]));await user.click(within(panel).getByRole('button',{name:'保存对话设定'}));
   await waitFor(()=>expect(f.store.getConversation(f.conversation.id).bindings).toEqual([cardRef,{id:b.id,version:b.currentVersion}]));
   await user.click(screen.getByRole('button',{name:'对话设定'}));const next=screen.getByRole('dialog',{name:'对话设定'});await user.click(within(next).getByText('绑定素材与高级设置'));
   await user.selectOptions(within(next).getByRole('combobox',{name:'提示词预设'}),'');await user.click(within(next).getByRole('button',{name:'保存对话设定'}));
   await waitFor(()=>expect(f.store.getConversation(f.conversation.id).bindings).toEqual([cardRef]));
   expect(library.readVersion(cardRef).bindings.preset).toEqual({id:a.id,version:a.currentVersion});expect(f.requests()).toBe(0);
  });
  it('阅读尾部的回复操作始终针对正在查看的候选，关闭后保留草稿且不发请求',async()=>{
   const f=fixture(2),user=userEvent.setup();
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByLabelText('当前候选');
   await user.type(screen.getByRole('textbox',{name:'想说的话'}),'还没有说完的话');
   await user.click(screen.getByRole('button',{name:'下一个候选'}));await screen.findByText('候选正文 2');
   await user.click(screen.getByRole('button',{name:'回复操作'}));
   await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
   expect((await screen.findByRole('textbox',{name:'角色回复'}) as HTMLTextAreaElement).value).toBe('候选正文 2');
   await user.click(screen.getByRole('button',{name:'关闭编辑角色回复'}));
   expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('还没有说完的话');
   expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);
   expect(f.requests()).toBe(0);
  });
  it('地图入口遵循默认关闭和对话明确开启，不占默认聊天菜单',async()=>{
   const f=fixture(),user=userEvent.setup();
   const props={api:f.api,initialConversationId:f.conversation.id,onNavigate:()=>{},onExport:async()=>{},onRestore:async()=>''};
   const first=render(<ChatPanel {...props}/>);await screen.findByLabelText('当前候选');
   await user.click(screen.getByRole('button',{name:'更多操作'}));
   expect(screen.queryByRole('button',{name:'剧情分支'})).toBeNull();
   first.unmount();f.store.updateConversation(f.conversation.id,{settings:{mapEnabled:true}});
   render(<ChatPanel {...props}/>);await screen.findByLabelText('当前候选');
   await user.click(screen.getByRole('button',{name:'更多操作'}));
   expect(screen.getByRole('button',{name:'剧情分支'})).toBeTruthy();
   expect(f.requests()).toBe(0);
  });
  it('查看旧节点后翻到包含其后续的一页，不把那些后续接到旧节点前面',async()=>{
   const f=longRouteFixture(undefined,undefined,65),user=userEvent.setup();
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('第65轮的长回复');
   await user.click(screen.getByRole('button',{name:'更早的 30 轮'}));
   await screen.findByText('第6轮的长回复');
   const turn=document.querySelector('.tk-history-turn')!;
   await user.click(within(turn as HTMLElement).getByRole('button',{name:/查看这轮候选/}));
   await waitFor(()=>expect(within(screen.getByLabelText('当前候选')).getByText('第6轮的长回复')).toBeTruthy());
   await user.click(screen.getByRole('button',{name:'后面 30 轮'}));
   await waitFor(()=>expect(document.querySelectorAll('.tk-history-turn')).toHaveLength(0));
   expect(within(screen.getByLabelText('当前候选')).getByText('第6轮的长回复')).toBeTruthy();
   expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);
   expect(f.requests()).toBe(0);
  });
  it('换回复与翻页跟随最后一条正文，固定输入区不重复放分支操作',async()=>{
   const f=fixture(2),user=userEvent.setup();
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   const reply=await screen.findByLabelText('当前候选');
   expect(within(reply).getByRole('button',{name:'换个回复'})).toBeTruthy();
   expect(within(reply).getByRole('button',{name:'下一个候选'})).toBeTruthy();
   const dock=document.querySelector('.tk-writing-dock')!;
   expect(within(dock as HTMLElement).queryByRole('button',{name:'换个回复'})).toBeNull();
   await user.click(within(reply).getByRole('button',{name:'下一个候选'}));
   expect(await screen.findByText('候选正文 2')).toBeTruthy();expect(f.requests()).toBe(0);
  });
  it('从旧节点看另一候选时只展示其祖先，返回原路线与另开分支均保留旧后续',async()=>{
   const f=longRouteFixture(undefined,undefined,3),user=userEvent.setup();
   const root=f.store.listTurns(f.conversation.id)[0]!,originalLeaf=f.first;
   const rootGroup=f.store.groupsForTurn(root.id)[0]!;
   const alternate=f.store.createCandidate(rootGroup.id,{kind:'generated',text:'另一条约定',status:'complete'});
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('第3轮的长回复');
   await user.click(screen.getAllByRole('button',{name:'查看这轮候选'})[0]!);
   await screen.findByText('我记得，小夏。');
   expect(screen.queryByText('第2轮的长回复')).toBeNull();expect(screen.queryByText('第3轮的长回复')).toBeNull();
   await user.click(screen.getByRole('button',{name:'下一个候选'}));await screen.findByText('另一条约定');
   expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(originalLeaf.id);
   await user.click(screen.getByRole('button',{name:'返回当前路线'}));await screen.findByText('第3轮的长回复');expect(f.requests()).toBe(0);
   await user.click(screen.getAllByRole('button',{name:'查看这轮候选'})[0]!);await screen.findByText('我记得，小夏。');
   await user.click(screen.getByRole('button',{name:'下一个候选'}));await screen.findByText('另一条约定');
   await user.type(screen.getByRole('textbox',{name:'想说的话'}),'沿这个约定继续');await user.click(screen.getByRole('button',{name:'发送'}));
   await waitFor(()=>expect(f.store.listTurns(f.conversation.id)).toHaveLength(4));
   expect(f.store.listTurns(f.conversation.id).at(-1)?.parentCandidateId).toBe(alternate.id);
   expect(f.store.getCandidate(originalLeaf.id).text).toBe('第3轮的长回复');
  });
  it('庭院默认作为不可抢焦点的背景，查看和Escape返回保留正文草稿与同一场景',async()=>{
   const f=fixture(),user=userEvent.setup();let mounts=0;
   function Scene(){React.useEffect(()=>{mounts++;},[]);return <button>庭院可操作视角</button>;}
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} renderScene={()=> <Scene/>} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   const reply=await screen.findByLabelText('当前候选'),draft=screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement;
   fireEvent.change(draft,{target:{value:'在这里等你'}});
   const scene=await screen.findByText('庭院可操作视角'),view=scene.closest('.tk-presentation-view') as HTMLElement;
   expect(view.inert).toBe(true);expect(view.getAttribute('aria-hidden')).toBe('true');
   expect(screen.queryByRole('button',{name:'庭院可操作视角'})).toBeNull();
   const reading=document.querySelector('.tk-reading')!;reading.scrollTop=321;
   await user.click(screen.getByRole('button',{name:'放大场景'}));
   expect(view.inert).toBe(false);expect(screen.getByRole('button',{name:'庭院可操作视角'})).toBe(scene);
   expect((document.querySelector('.tk-transcript') as HTMLElement).inert).toBe(true);
   await user.keyboard('{Escape}');
   expect(view.inert).toBe(true);expect((document.querySelector('.tk-transcript') as HTMLElement).inert).toBe(false);
   expect(screen.getByRole('textbox',{name:'想说的话'})).toBe(draft);expect(draft.value).toBe('在这里等你');
   expect(screen.getByLabelText('当前候选')).toBe(reply);expect(reading.scrollTop).toBe(321);expect(mounts).toBe(1);
   expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);expect(f.requests()).toBe(0);
  });
  it('切换离开庭院主题时解除清晰查看，不留下不可用的聊天区',async()=>{
   const f=fixture(),user=userEvent.setup(),root=document.documentElement;
   root.dataset.tkSceneKind='xi4u';
   try{
    render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} renderScene={()=> <div>庭院背景</div>} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
    await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'放大场景'}));
    const transcript=document.querySelector('.tk-transcript') as HTMLElement;expect(transcript.inert).toBe(true);
    await act(async()=>{root.dataset.tkSceneKind='image';});
    await waitFor(()=>expect(transcript.inert).toBe(false));expect(f.requests()).toBe(0);
   }finally{root.removeAttribute('data-tk-scene-kind');}
  });
  it('主题场景收起即卸载展示，切换展示不改变草稿与候选',async()=>{
   const f=fixture(),user=userEvent.setup();let mounted=0;
   function Scene(){React.useEffect(()=>{mounted++;return()=>{mounted--;};},[]);return <div>本地庭院画面</div>;}
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} renderScene={()=> <Scene/>} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');await user.type(screen.getByRole('textbox',{name:'想说的话'}),'先把这句话留在这里');expect(await screen.findByText('本地庭院画面')).toBeTruthy();expect(mounted).toBe(1);
   await user.click(screen.getByRole('button',{name:'收起场景'}));expect(screen.queryByText('本地庭院画面')).toBeNull();expect(mounted).toBe(0);expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);
   expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('先把这句话留在这里');await user.click(screen.getByRole('button',{name:'展开场景'}));expect(await screen.findByText('本地庭院画面')).toBeTruthy();expect(mounted).toBe(1);expect(f.requests()).toBe(0);
  });
  it('场景放大还原保留原DOM与挂载，收起才卸载且不改变聊天',async()=>{
   const f=fixture(),user=userEvent.setup();let mounts=0,unmounts=0;
   function Scene(){const[view,setView]=React.useState(0);React.useEffect(()=>{mounts++;return()=>{unmounts++;};},[]);return <button onClick={()=>setView(value=>value+1)}>庭院视角 {view}</button>;}
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} renderScene={()=> <Scene/>} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');const reply=screen.getByLabelText('当前候选'),draft=screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement;
   fireEvent.change(draft,{target:{value:'这句话先留在草稿里'}});
   const scene=await screen.findByText('庭院视角 0'),region=screen.getByRole('region',{name:'主题场景'}),controls=within(region);
   const enlarge=controls.getByRole('button',{name:'放大场景'}),fold=controls.getByRole('button',{name:'收起场景'});
   expect(enlarge.getAttribute('aria-pressed')).toBe('false');expect(enlarge.closest('header')).toBe(fold.closest('header'));
   await user.click(enlarge);await user.click(scene);
   expect(region.classList.contains('tk-presentation-large')).toBe(true);expect(controls.getByRole('button',{name:'还原场景'}).getAttribute('aria-pressed')).toBe('true');
   expect(screen.getByRole('button',{name:'庭院视角 1'})).toBe(scene);expect(mounts).toBe(1);expect(unmounts).toBe(0);expect(draft.value).toBe('这句话先留在草稿里');expect(document.querySelector('[aria-label="当前候选"]')).toBe(reply);expect(f.requests()).toBe(0);
   await user.click(controls.getByRole('button',{name:'还原场景'}));
   expect(region.classList.contains('tk-presentation-large')).toBe(false);expect(controls.getByRole('button',{name:'放大场景'}).getAttribute('aria-pressed')).toBe('false');
   expect(screen.getByText('庭院视角 1')).toBe(scene);expect(mounts).toBe(1);expect(unmounts).toBe(0);expect(screen.queryByRole('dialog')).toBeNull();
   await user.click(controls.getByRole('button',{name:'收起场景'}));expect(screen.queryByText('庭院视角 1')).toBeNull();expect(mounts).toBe(1);expect(unmounts).toBe(1);
   await user.click(controls.getByRole('button',{name:'展开场景'}));expect(await screen.findByText('庭院视角 0')).not.toBe(scene);expect(mounts).toBe(2);expect(unmounts).toBe(1);
   expect(screen.getByRole('textbox',{name:'想说的话'})).toBe(draft);expect(draft.value).toBe('这句话先留在草稿里');expect(screen.getByLabelText('当前候选')).toBe(reply);expect(f.requests()).toBe(0);
  });
  it('首页主题场景独立于继续按钮，场景操作不会误开旧对话',async()=>{
   const f=fixture(),user=userEvent.setup();let sceneActions=0;
   render(<ChatPanel api={f.api} renderScene={()=> <button onClick={()=>{sceneActions++;}}>调整庭院视角</button>} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   const control=await screen.findByRole('button',{name:'调整庭院视角'});expect(control.parentElement?.closest('button')).toBeNull();await user.click(control);expect(sceneActions).toBe(1);expect(screen.queryByLabelText('当前候选')).toBeNull();await user.click(screen.getByRole('button',{name:'继续聊天：海边的约定'}));expect(await screen.findByText('我记得，小夏。')).toBeTruthy();expect(f.requests()).toBe(0);
  });
  it('首页可用键盘打开恢复文件选择', async () => {
    const f = fixture(), user = userEvent.setup(), restored: File[] = [];
    render(<ChatPanel api={f.api} onNavigate={() => {}} onExport={async () => {}} onRestore={async file => { restored.push(file); return f.conversation.id; }}/>);
    const trigger = await screen.findByRole('button', { name: '恢复对话' });
    const input = screen.getByLabelText('选择对话备份文件') as HTMLInputElement;
    for (let step = 0; step < 20 && document.activeElement !== trigger; step++) await user.tab();
    expect(document.activeElement).toBe(trigger);
    const requested = vi.spyOn(input, 'click');
    await user.keyboard('{Enter}');
    expect(requested).toHaveBeenCalledOnce();
    const file = new File(['备份'], 'backup.zip', { type: 'application/zip' });
    await user.upload(input, file);
    expect(restored).toEqual([file]);
    expect(input.value).toBe('');
   });
  it('聊天内换服务和模型保留草稿、候选与正在生成的冻结路由，下次换回复才用新模型',async()=>{
   let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const f=fixture(1,gate),user=userEvent.setup();
   const list=f.api.listConnections;f.api.listConnections=async()=>[...await list(),{id:'other',provider:'另一服务',name:'另一家连接',credentialConfigured:true,active:true,models:[{id:'[薄甲]/原样模型-B',name:'备用原样模型'}],preference:{}}];
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   try{
    await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'换个回复'}));await screen.findByText('新的');
    const runningGroup=f.store.groupsForTurn(f.turn.id).at(-1)!;const snapshot=f.store.getSnapshot(runningGroup.snapshotId);
    await user.type(screen.getByRole('textbox',{name:'想说的话'}),'等你说完我再回');const before=f.requests();
    const trigger=screen.getByRole('button',{name:'切换模型'});expect(trigger.textContent).toContain('本地模型');expect(trigger.textContent).toContain('原始/[模型]');await user.click(trigger);
    const picker=within(await screen.findByRole('dialog',{name:'切换模型'}));await user.selectOptions(picker.getByLabelText('服务商'),'另一服务');
    await user.click(picker.getByRole('button',{name:'使用 备用原样模型'}));await waitFor(()=>expect(screen.queryByRole('dialog',{name:'切换模型'})).toBeNull());
    expect(f.store.getConversation(f.conversation.id).settings.mainRoute).toMatchObject({provider:'另一服务',model:'[薄甲]/原样模型-B'});
    expect(f.store.getGroup(runningGroup.id).routes[0]).toMatchObject({provider:'local',model:'原始/[模型]'});expect(f.store.getSnapshot(snapshot.id)).toEqual(snapshot);
    expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('等你说完我再回');expect(f.requests()).toBe(before);expect(screen.getByLabelText('当前候选').textContent).toContain('新的');
    release();await act(async()=>{await f.engine.waitForGroup(runningGroup.id);});await user.click(screen.getByRole('button',{name:'换个回复'}));
    await waitFor(()=>expect(f.requestedRoutes.at(-1)).toEqual({provider:'另一服务',model:'[薄甲]/原样模型-B'}));
   }finally{release();}
  });
  it('候选失败就在正文附近显示原始报错和状态，查看详情与连接不额外生成',async()=>{
   const f=fixture(),user=userEvent.setup(),destinations:string[]=[];const group=f.store.getGroup(f.first.groupId);
   const attempt=f.store.createAttempt({turnId:f.turn.id,candidateId:f.first.id,snapshotId:group.snapshotId,kind:'reply',route:{provider:'local',model:'原始/[模型]',label:'本地模型',inputBudget:12000},config:{provider:'local',model:'原始/[模型]'}});
   f.store.finishAttempt(attempt.id,{status:'failed',error:{code:'AUTHENTICATION',status:401,message:'upstream request failed: key_expired / 请更新聊天 key'}});f.store.setCandidateStatus(f.first.id,'failed');
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={value=>destinations.push(value)} onExport={async()=>{}} onRestore={async()=>''}/>);
   const reply=within(await screen.findByLabelText('当前候选')),feedback=await reply.findByRole('alert');expect(feedback.textContent).toContain('key_expired');expect(feedback.textContent).toContain('401');expect(feedback.textContent).toContain('原始/[模型]');
   expect(f.store.candidateText(f.first.id)).toBe('我记得，小夏。');expect(f.store.inputForSnapshot(group.snapshotId).messages).toEqual([{role:'user',content:'小夏，还记得我们的约定吗？'}]);
   await user.click(within(feedback).getByRole('button',{name:'查看报错详情'}));expect(await screen.findByRole('dialog',{name:'模型与提示词'})).toBeTruthy();await user.click(screen.getByRole('button',{name:'关闭模型与提示词'}));
   await user.click(within(feedback).getByRole('button',{name:'检查连接'}));expect(destinations).toEqual(['connections']);expect(f.requests()).toBe(0);expect(f.store.attemptsForCandidate(f.first.id)).toHaveLength(1);
  });
  it('正文Markdown只改变阅读排版，编辑草稿与下一轮模型历史保留原文',async()=>{
   const f=fixture(),user=userEvent.setup();const edited=f.engine.editCandidate(f.first.id,'*把伞移过来*，**别淋雨**。\n\n> 我们一起回家。');f.store.selectCandidate(edited.id);
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   const reply=await screen.findByLabelText('当前候选');await waitFor(()=>expect(reply.querySelector('em')?.textContent).toBe('把伞移过来'));expect(reply.querySelector('blockquote')?.textContent).toContain('我们一起回家。');
   expect([...reply.querySelectorAll('strong')].some(node=>node.textContent==='别淋雨')).toBe(true);
   await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));expect((screen.getByRole('textbox',{name:'角色回复'}) as HTMLTextAreaElement).value).toBe('*把伞移过来*，**别淋雨**。\n\n> 我们一起回家。');await user.click(screen.getByRole('button',{name:'关闭编辑角色回复'}));
   await user.type(screen.getByRole('textbox',{name:'想说的话'}),'好，我们回家');await user.click(screen.getByRole('button',{name:'发送'}));await waitFor(()=>expect(f.store.listTurns(f.conversation.id)).toHaveLength(2));const next=f.store.groupsForTurn(f.store.listTurns(f.conversation.id).at(-1)!.id)[0]!;await f.engine.waitForGroup(next.id);
   expect(f.store.inputForSnapshot(next.snapshotId).messages.some(message=>message.content==='*把伞移过来*，**别淋雨**。\n\n> 我们一起回家。')).toBe(true);
  });
  it('阅读历史与当前输入时透传各自消息深度，显示替换不修改原文',async()=>{
   const f=fixture();const nextTurn=f.store.createTurn(f.conversation.id,{input:'小夏，风大吗？',parentCandidateId:f.first.id});
   const snapshot=f.store.createSnapshot(f.conversation.id,{system:'角色',messages:[{role:'user',content:nextTurn.input}],bindings:[],options:{}});
   const group=f.store.createGroup(nextTurn.id,{snapshotId:snapshot.id,routes:[f.conversation.settings.mainRoute!],settingsRevision:1});
   const next=f.store.createCandidate(group.id,{kind:'generated',text:'小夏，往我这边站。',status:'complete'});f.store.selectCandidate(next.id);
   f.displays.set(f.first.id,{rules:[{...displayRule('旧称呼'),minDepth:2,maxDepth:3}],context:{char:'江澈',user:'小夏'},depth:2,inputDepth:3});
   f.displays.set(next.id,{rules:[{...displayRule('现在称呼'),minDepth:1,maxDepth:1}],context:{char:'江澈',user:'小夏'},depth:0,inputDepth:1});
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，旧称呼。');await screen.findByText('现在称呼，风大吗？');expect(await screen.findByText('小夏，往我这边站。')).toBeTruthy();
   expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.store.getTurn(nextTurn.id).input).toBe('小夏，风大吗？');expect(f.requests()).toBe(0);
  });
  it('从创建入口选择备选首句和玩家身份，连同连接备用偏好交给同一个Host创建方法',async()=>{
   const card:MaterialVersion={...currentMaterial,id:'greeting-card',projection:{...currentMaterial.projection,kind:'character',name:'江澈',regex:[],character:{name:'江澈',description:'旧友',personality:'温和',scenario:'海边',firstMessage:'你好，{{user}}。',alternateGreetings:['{{char}}留了一张车票给{{user}}。'],messageExamples:'',systemPrompt:'',postHistoryInstructions:'',creatorNotes:'',tags:[]}}};
   const f=fixture(1,undefined,card),user=userEvent.setup(),created:Array<Parameters<ChatPanelApi['create']>[0]>=[];
   const create=f.api.create;f.api.create=async input=>{created.push(input);return create(input);};
   f.api.defaultFallback=async()=>[{provider:'backup',model:'备用',inputBudget:18000}];f.api.fallbackOnError=async()=>true;f.api.errorPatterns=async()=>['暂忙'];
   render(<ChatPanel api={f.api} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await user.click(screen.getByRole('button',{name:'＋ 新对话'}));const panel=within(await screen.findByRole('dialog',{name:'开一段新对话'}));
   await user.selectOptions(panel.getByLabelText('带上角色'),'greeting-card');await panel.findByText('你好，我。');
   await user.clear(panel.getByLabelText('你的称呼'));await user.type(panel.getByLabelText('你的称呼'),'小夏');await user.type(panel.getByLabelText('玩家设定'),'旧书店的常客');
   await user.click(panel.getByRole('button',{name:'下一个首句'}));expect(panel.getByText('江澈留了一张车票给小夏。')).toBeTruthy();
   await user.click(panel.getByRole('button',{name:'开始聊天'}));await waitFor(()=>expect(created).toHaveLength(1));
   expect(created[0]).toMatchObject({bindings:[{id:'greeting-card',version:2}],greetingIndex:1,settings:{playerName:'小夏',playerDescription:'旧书店的常客',mainRoute:{provider:'local',model:'原始/[模型]'},fallbacks:[{provider:'backup',model:'备用'}],fallbackOnError:true,errorPatterns:['暂忙']}});
   expect(f.requests()).toBe(0);
  });
  it('在会话导航内按名字找回旧对话，筛选与清除不触发生成',async()=>{
   const f=fixture(),user=userEvent.setup();f.store.createConversation({title:'冬夜来信'});
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');const navigation=within(screen.getByLabelText('会话导航'));
   const search=navigation.getByRole('searchbox',{name:'搜索对话'});await user.type(search,'冬夜');
   expect(navigation.queryByRole('button',{name:/^海边的约定/})).toBeNull();expect(navigation.getByRole('button',{name:/^冬夜来信/})).toBeTruthy();
   await user.clear(search);expect(navigation.getByRole('button',{name:/^海边的约定/})).toBeTruthy();
   expect(screen.getByText('我记得，小夏。')).toBeTruthy();expect(f.requests()).toBe(0);
  });
  it('资料区展示当前备忘并打开同一份编辑草稿，不改变候选和聊天草稿',async()=>{
   const f=fixture(),user=userEvent.setup();f.engine.editMemo(f.conversation.id,'称呼：小夏。\n约定：一起去看海。',['一起去看海。']);
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');await user.type(screen.getByRole('textbox',{name:'想说的话'}),'下次一起');
   expect(screen.queryByRole('complementary',{name:'当前对话资料'})).toBeNull();
    await user.click(screen.getByRole('button',{name:'更多操作'}));await user.click(screen.getByRole('button',{name:'人物与设定'}));
    const context=within(screen.getByRole('complementary',{name:'当前对话资料'}));expect(context.getByText(/约定：一起去看海/)).toBeTruthy();
   await user.click(context.getByRole('button',{name:'编辑剧情备忘'}));const panel=await screen.findByRole('dialog',{name:'剧情备忘'});
   expect((within(panel).getAllByRole('textbox')[0] as HTMLTextAreaElement).value).toContain('约定：一起去看海。');
   await user.click(within(panel).getByRole('button',{name:'关闭剧情备忘'}));expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('下次一起');expect(f.requests()).toBe(0);
  });
  it('次级操作收在对话菜单，导出和换装扮不影响正文与输入草稿',async()=>{
   const f=fixture(),user=userEvent.setup(),exported:string[]=[],destinations:string[]=[];
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={value=>destinations.push(value)} onExport={async id=>{exported.push(id);}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');await user.type(screen.getByRole('textbox',{name:'想说的话'}),'还有好多话想对你说');
   await user.click(screen.getByRole('button',{name:'更多操作'}));
   await user.click(within(screen.getByLabelText('对话操作')).getByRole('button',{name:'把这段对话带走'}));
   await waitFor(()=>expect(exported).toEqual([f.conversation.id]));
   await user.click(screen.getByRole('button',{name:'更多操作'}));
   await user.click(within(screen.getByLabelText('对话操作')).getByRole('button',{name:'换个装扮'}));
   expect(destinations).toEqual(['appearance']);expect(screen.getByText('我记得，小夏。')).toBeTruthy();
   expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('还有好多话想对你说');expect(f.requests()).toBe(0);
  });
  it('设定作为独立面板打开，关闭未保存的更改后继续原来的阅读',async()=>{
   const f=fixture(),user=userEvent.setup();
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'对话设定'}));
   const panel=screen.getByRole('dialog',{name:'对话设定'});
   await user.clear(within(panel).getByRole('textbox',{name:'对话名字'}));await user.type(within(panel).getByRole('textbox',{name:'对话名字'}),'这次还不保存');
   await user.click(within(panel).getByRole('button',{name:'关闭对话设定'}));
   expect(screen.queryByRole('dialog',{name:'对话设定'})).toBeNull();expect(f.store.getConversation(f.conversation.id).title).toBe('海边的约定');
   expect(screen.getByText('我记得，小夏。')).toBeTruthy();expect(f.requests()).toBe(0);
  });
 it('设定保存失败在弹窗内反馈，保留草稿并能修正后再保存',async()=>{
  const f=fixture(),user=userEvent.setup(),update=f.api.update;
  f.api.update=async(id,input)=>{validateErrorPatterns(input.settings?.errorPatterns??[]);return update(id,input);};
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'对话设定'}));
  const panel=screen.getByRole('dialog',{name:'对话设定'});
  await user.click(within(panel).getByText('绑定素材与高级设置'));
  const rules=within(panel).getByRole('textbox',{name:'仅这些报错触发'});
  fireEvent.change(rules,{target:{value:'/[/'} });await user.click(within(panel).getByRole('button',{name:'保存对话设定'}));
  expect((await within(panel).findByRole('alert')).textContent).toContain('报错正则无效');
  expect((rules as HTMLTextAreaElement).value).toBe('/[/');expect(f.store.getConversation(f.conversation.id).settings.errorPatterns??[]).toEqual([]);
  await user.clear(rules);await user.type(rules,'/繁忙/');await user.click(within(panel).getByRole('button',{name:'保存对话设定'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'对话设定'})).toBeNull());
  expect(f.store.getConversation(f.conversation.id).settings.errorPatterns).toEqual(['/繁忙/']);expect(screen.queryByRole('alert')).toBeNull();
 });
 it.each(['角色回复','剧情备忘'] as const)('%s保存失败仍在原任务位置阅读错误和草稿',async(kind)=>{
  const f=fixture(),user=userEvent.setup();
  if(kind==='角色回复')f.api.editCandidate=async()=>{throw new Error('这次没有保存成功，请再试一次');};
  else f.api.editMemo=async()=>{throw new Error('这次没有保存成功，请再试一次');};
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');if(kind==='角色回复')await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:kind==='角色回复'?'编辑这条回复':'剧情备忘'}));
  const panel=screen.getByRole(kind==='角色回复'?'region':'dialog',{name:kind==='角色回复'?'编辑角色回复':'剧情备忘'});
  const draft=within(panel).getAllByRole('textbox')[0]!;fireEvent.change(draft,{target:{value:'想保留的修改'}});
  await user.click(within(panel).getByRole('button',{name:kind==='角色回复'?'另存为候选':'保存这一版'}));
  expect((await within(panel).findByRole('alert')).textContent).toContain('这次没有保存成功');expect((draft as HTMLTextAreaElement).value).toBe('想保留的修改');
  expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.requests()).toBe(0);
 });
 it.each([false,true])('模型详情保留实际业务分组，手改只继承来源不虚构请求（手改：%s）',async(edited)=>{
  const f=fixture(),user=userEvent.setup(),group=f.store.getGroup(f.first.groupId);
  const route={provider:'original-provider',model:'[薄甲]角色/原始模型',group:'恋爱日常',label:'来自自己的连接',inputBudget:12000};
  const attempt=f.store.createAttempt({turnId:f.turn.id,candidateId:f.first.id,snapshotId:group.snapshotId,kind:'reply',route,config:{provider:route.provider,model:route.model}});
  f.store.appendAttemptDelta(attempt.id,'尾句');f.store.finishAttempt(attempt.id,{status:'complete',usage:{outputTokens:1}});f.store.setCandidateStatus(f.first.id,'complete');
  const selected=edited?f.engine.editCandidate(f.first.id,'手改后的称呼'):f.store.getCandidate(f.first.id);f.store.selectCandidate(selected.id);
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText(edited?'手改后的称呼':'我记得，小夏。尾句');await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'模型与提示词'}));
  const panel=await screen.findByRole('dialog',{name:'模型与提示词'}),source=within(panel).getByLabelText('这条回复的模型');
  expect(source.textContent).toContain(route.provider);expect(source.textContent).toContain(route.model);expect(source.textContent).toContain(route.group);
  expect(f.store.attemptsForCandidate(selected.id)).toHaveLength(edited?0:1);expect(f.store.usageForTurn(f.turn.id).requestCount).toBe(1);expect(f.requests()).toBe(0);
 });
 it('换个回复直接翻到同组刚生成的候选，只阅读不提前提交选中路线',async()=>{
  let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  const f=fixture(3,gate),user=userEvent.setup(),metadata=vi.spyOn(f.api,'candidates'),select=vi.spyOn(f.api,'select');
  try{
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('我记得，小夏。');metadata.mockClear();
   await user.click(screen.getByRole('button',{name:'换个回复'}));
   await screen.findByRole('button',{name:'停止这条'});
   expect(screen.getByText('新的')).toBeTruthy();
   expect((screen.getByRole('spinbutton',{name:'候选序号'}) as HTMLInputElement).value).toBe('4');
   const latest=f.store.listCandidates(f.turn.id).items.at(-1)!;
   expect(latest.groupId).toBe(f.first.groupId);expect(latest.id).not.toBe(f.first.id);
   expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);expect(select).not.toHaveBeenCalled();
   const groupReads=metadata.mock.calls.filter(([input])=>input.groupId===latest.groupId).map(([input])=>input);
   expect(groupReads).toHaveLength(2);expect(groupReads.every(input=>input.limit===1)).toBe(true);
   expect(groupReads.at(-1)?.offset).toBe(3);expect(f.requests()).toBe(1);
  }finally{release();}
 });
 it('首次翻开长路线时直接看到当前回复开头，而不是停在旧历史顶部',async()=>{
  transcriptGeometry();const f=longRouteFixture();
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('第30轮的长回复');
  const reply=screen.getByLabelText('当前候选'),reading=reply.parentElement as HTMLDivElement;
  expect(document.querySelectorAll('.tk-history-turn')).toHaveLength(29);
  expect(reply.getBoundingClientRect().top).toBeGreaterThanOrEqual(reading.getBoundingClientRect().top);
  expect(reply.getBoundingClientRect().top).toBeLessThan(reading.getBoundingClientRect().top+48);
  expect(reading.scrollTop).toBeGreaterThan(3000);expect(f.requests()).toBe(0);
 });
 it('长路线的新生成跟随底部，玩家回看旧文后继续出字不拉走阅读位置',async()=>{
  const geometry=transcriptGeometry();let release=()=>{},start=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;}),startGate=new Promise<void>(resolve=>{start=resolve;});
  const f=longRouteFixture(gate,startGate),user=userEvent.setup(),publish=liveUpdates(f.api);
  try{
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('第30轮的长回复');await user.click(screen.getByRole('button',{name:'换个回复'}));
   await screen.findByRole('button',{name:'停止这条'});await act(async()=>{start();});
   await screen.findByText('新的');const reading=screen.getByLabelText('当前候选').parentElement as HTMLDivElement;
   expect(reading.scrollTop).toBe(4600);
   const next=f.store.listCandidates(f.turn.id).items.at(-1)!;
   geometry.grow();await act(async()=>{f.store.appendCandidateDelta(next.id,'，还在写');publish({conversationId:f.conversation.id,type:'candidate',candidateId:next.id,delta:'，还在写'});});
   expect(reading.scrollTop).toBe(5000);
   reading.scrollTop=2000;fireEvent.scroll(reading);
   geometry.grow();await act(async()=>{f.store.appendCandidateDelta(next.id,'，接着说');publish({conversationId:f.conversation.id,type:'candidate',candidateId:next.id,delta:'，接着说'});});
   expect(screen.getByText('新的，还在写，接着说')).toBeTruthy();expect(reading.scrollTop).toBe(2000);
  }finally{start();release();}
 });
 it('历史分页在新一轮完成后保留同批旧节点与阅读位置，并随路线增长修正页码',async()=>{
   transcriptGeometry();const gate=deferred(),f=longRouteFixture(gate.promise,undefined,65),user=userEvent.setup();
   const pages=vi.spyOn(f.api,'route');
   try{
    render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
    await screen.findByText('第65轮的长回复',{}, {timeout:5000});fireEvent.change(screen.getByRole('textbox',{name:'想说的话'}),{target:{value:'第66句'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));
    await screen.findByText('新的');fireEvent.click(screen.getByRole('button',{name:'更早的 30 轮'}));await screen.findByText('第6轮的长回复');
    const before=historyText(),reading=screen.getByLabelText('当前候选').parentElement as HTMLDivElement;
    expect(before).toHaveLength(30);expect(before.at(-1)).toContain('第35轮的长回复');expect(document.querySelector('.tk-history-pages')?.textContent).toContain('31—60 / 65');
    reading.scrollTop=800;fireEvent.scroll(reading);
    const turn=f.store.listTurns(f.conversation.id).at(-1)!,group=f.store.groupsForTurn(turn.id).at(-1)!;
    await act(async()=>{gate.release();await f.engine.waitForGroup(group.id);});
    await waitFor(()=>expect(document.querySelector('.tk-history-pages')?.textContent).toContain('32—61 / 66'));
    expect(historyText()).toEqual(before);expect(reading.scrollTop).toBe(800);expect(f.requests()).toBe(1);
    expect(pages.mock.calls.every(([input])=>(input.limit??30)<=30)).toBe(true);
   }finally{gate.release();}
  });
  it('历史分页随空输入叶增长重读真实深度投影，节点、原文与阅读位置不变',async()=>{
   transcriptGeometry();const f=longRouteFixture(undefined,undefined,65),state=f.api.state;
   const rules=[
    {...displayRule('原来深度的阅读正文','/第35轮的长回复/g'),minDepth:60,maxDepth:60},
    {...displayRule('新增一条消息后的阅读正文','/第35轮的长回复/g'),minDepth:61,maxDepth:61},
   ];
   f.api.route=async input=>{
    const page=f.store.routePage(input.conversationId,input.offset,input.limit);
    return {total:page.total,items:page.items.map(row=>({turn:row.turn,candidate:row.candidate,text:row.candidate.text,display:{rules,depth:row.depth,inputDepth:row.turn.input!==''?row.depth+1:undefined,context:{char:'角色',user:'我'}}}))};
   };
   f.api.state=async id=>({...await state(id),route:await f.api.route({conversationId:id,limit:30})});
   const pages=vi.spyOn(f.api,'route');
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('第65轮的长回复',{}, {timeout:5000});fireEvent.click(screen.getByRole('button',{name:'更早的 30 轮'}));await screen.findByText('原来深度的阅读正文');
   const nodes=Array.from(document.querySelectorAll('.tk-history-turn')),before=f.store.routePage(f.conversation.id,30),ids=before.items.map(row=>row.candidate.id),target=before.items.at(-1)!.candidate;
   const reading=screen.getByLabelText('当前候选').parentElement as HTMLDivElement;reading.scrollTop=800;fireEvent.scroll(reading);
   const emptyTurn=f.store.createTurn(f.conversation.id,{input:'',parentCandidateId:f.first.id});
   await act(async()=>{const group=await f.engine.roll(emptyTurn.id);await f.engine.waitForGroup(group.id);});
   await screen.findByText('新增一条消息后的阅读正文');
   expect(screen.queryByText('原来深度的阅读正文')).toBeNull();Array.from(document.querySelectorAll('.tk-history-turn')).forEach((node,index)=>expect(node).toBe(nodes[index]));expect(reading.scrollTop).toBe(800);
   const after=f.store.routePage(f.conversation.id,31);expect(after.items.map(row=>row.candidate.id)).toEqual(ids);expect(after.items.at(-1)!.depth).toBe(61);expect(f.store.candidateText(target.id)).toBe('第35轮的长回复');
   expect(document.querySelector('.tk-history-pages')?.textContent).toContain('32—61 / 66');expect(pages.mock.calls.some(([input])=>input.offset===31&&input.limit===30)).toBe(true);expect(f.requests()).toBe(1);
  });
  it('历史分页不会被翻页前已开始的状态刷新覆盖',async()=>{
   const f=longRouteFixture(undefined,undefined,65),user=userEvent.setup(),publish=liveUpdates(f.api),waiting=deferred(),entered=deferred();
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('第65轮的长回复',{}, {timeout:5000});const state=f.api.state;let delay=true;
   f.api.state=async id=>{const value=await state(id);if(delay){delay=false;entered.release();await waiting.promise;}return value;};
   try{
    await act(async()=>{publish({conversationId:f.conversation.id,type:'route'});});await entered.promise;
    await user.click(screen.getByRole('button',{name:'更早的 30 轮'}));await screen.findByText('第6轮的长回复');const before=historyText();
    await act(async()=>{waiting.release();});
    expect(historyText()).toEqual(before);expect(document.querySelector('.tk-history-pages')?.textContent).toContain('31—60 / 65');expect(f.requests()).toBe(0);
   }finally{waiting.release();}
  });
  it('历史分页以最新翻页为准，较早一页的晚到响应不能覆盖它',async()=>{
   const f=longRouteFixture(undefined,undefined,65),waiting=deferred(),entered=deferred(),route=f.api.route;let delay=true;
   f.api.route=async input=>{const value=await route(input);if(input.offset===30&&delay){delay=false;entered.release();await waiting.promise;}return value;};
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   try{
    await screen.findByText('第65轮的长回复',{}, {timeout:5000});fireEvent.click(screen.getByRole('button',{name:'更早的 30 轮'}));await entered.promise;
    fireEvent.click(screen.getByRole('button',{name:'更早的 30 轮'}));
    await waitFor(()=>expect(document.querySelector('.tk-history-pages')?.textContent).toContain('61—65 / 65'));
    const before=historyText();expect(before).toHaveLength(5);expect(before[0]).toContain('我记得，小夏。');expect(before.at(-1)).toContain('第5轮的长回复');
    await act(async()=>{waiting.release();});expect(historyText()).toEqual(before);expect(f.requests()).toBe(0);
   }finally{waiting.release();}
  });
  it('历史分页的晚到请求不能把已切换的会话换回旧历史',async()=>{
   const f=longRouteFixture(undefined,undefined,65),user=userEvent.setup(),waiting=deferred(),entered=deferred(),route=f.api.route;
   const other=f.store.createConversation({title:'另一段短对话',settings:f.conversation.settings});
   const turn=f.store.createTurn(other.id,{input:'另一段开场'}),snapshot=f.store.createSnapshot(other.id,{system:'独立的对话',messages:[{role:'user',content:turn.input}],bindings:[],options:{}});
   const group=f.store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[f.conversation.settings.mainRoute!],settingsRevision:1});
   const reply=f.store.createCandidate(group.id,{kind:'generated',text:'只属于另一段对话',status:'complete'});f.store.selectCandidate(reply.id);
   f.api.route=async input=>{const value=await route(input);if(input.conversationId===f.conversation.id&&input.offset===30){entered.release();await waiting.promise;}return value;};
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   try{
    await screen.findByText('第65轮的长回复',{}, {timeout:5000});await user.click(screen.getByRole('button',{name:'更早的 30 轮'}));await entered.promise;
    await user.click(within(screen.getByLabelText('会话导航')).getByRole('button',{name:/^另一段短对话/}));await screen.findByText('只属于另一段对话');
    await act(async()=>{waiting.release();});
    expect(screen.getByRole('heading',{name:'另一段短对话'})).toBeTruthy();expect(historyText()).toEqual([]);expect(document.querySelector('.tk-history-pages')).toBeNull();expect(f.requests()).toBe(0);
   }finally{waiting.release();}
  });
  it.each(['发送下一句','选定旧回复'] as const)('历史分页不会阻止玩家主动%s后进入对应的当前路线',async(action)=>{
   const f=longRouteFixture(undefined,undefined,65),user=userEvent.setup();
   render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
   await screen.findByText('第65轮的长回复',{}, {timeout:5000});await user.click(screen.getByRole('button',{name:'更早的 30 轮'}));await screen.findByText('第6轮的长回复');
   if(action==='发送下一句'){
    fireEvent.change(screen.getByRole('textbox',{name:'想说的话'}),{target:{value:'在这里接着聊'}});fireEvent.click(screen.getByRole('button',{name:'发送'}));await screen.findByText('新的答复');
    await waitFor(()=>expect(document.querySelector('.tk-history-pages')?.textContent).toContain('1—30 / 66'));
    expect(screen.getByText('第37轮的长回复')).toBeTruthy();expect(f.requests()).toBe(1);
   }else{
    await user.click(screen.getAllByRole('button',{name:'查看这轮候选'}).at(-1)!);await waitFor(()=>expect(screen.getByLabelText('当前候选').textContent).toContain('第35轮的长回复'));
    await user.click(screen.getByRole('button',{name:'接着这条聊'}));
    await waitFor(()=>expect(document.querySelector('.tk-history-pages')?.textContent).toContain('1—30 / 35'));
    expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.store.listCandidates(f.store.listTurns(f.conversation.id)[34]!.id).items[0]!.id);expect(f.requests()).toBe(0);
   }
  });
  it.each([true,false])('新对话保存连接的广义报错偏好，首次请求沿用该快照（新接口：%s）',async(withPreferences)=>{
  const f=fixture(),user=userEvent.setup();f.api.fallbackOn400=async()=>false;
  f.api.fallbackOnError=withPreferences?async()=>false:undefined;
  f.api.errorPatterns=withPreferences?async()=>['rate_limit','/繁忙/']:undefined;
  render(<ChatPanel api={f.api} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await user.click(await screen.findByRole('button',{name:'＋ 新对话'}));
  await user.type(screen.getByRole('textbox',{name:'对话名字'}),'从连接带来的设定');
  await user.click(screen.getByRole('button',{name:'开始聊天'}));
  const input=await screen.findByRole('textbox',{name:'想说的话'});
  const conversation=f.store.listConversations().find(value=>value.title==='从连接带来的设定')!;
  expect(conversation.settings.fallbackOn400).toBe(false);
  expect(conversation.settings.fallbackOnError).toBe(withPreferences?false:true);
  expect(conversation.settings.errorPatterns).toEqual(withPreferences?['rate_limit','/繁忙/']:[]);
  await user.type(input,'我们从这里接着走');await user.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(f.store.listTurns(conversation.id)).toHaveLength(1));
  const group=f.store.groupsForTurn(f.store.listTurns(conversation.id)[0]!.id)[0]!;await f.engine.waitForGroup(group.id);
  expect(f.store.getSnapshot(group.snapshotId).options).toMatchObject({fallbackOnError:withPreferences?false:true,errorPatterns:withPreferences?['rate_limit','/繁忙/']:[]});
 });
 it('换主模型先带入连接偏好，玩家保存的会话规则不在发送时被连接覆盖',async()=>{
  const f=fixture(),user=userEvent.setup(),list=f.api.listConnections;let preferenceReads=0;
  f.api.listConnections=async()=>(await list()).map(value=>({...value,models:[...value.models,{id:'另一个模型',name:'另一个模型'}]}));
  f.api.fallbackOnError=async()=>{preferenceReads++;return false;};f.api.errorPatterns=async()=>['connection_error','/上游繁忙/'];
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'对话设定'}));
  await user.selectOptions(screen.getByRole('combobox',{name:'当前模型'}),JSON.stringify(['local','另一个模型']));
  await user.click(screen.getByText('绑定素材与高级设置'));
  const enabled=await screen.findByRole('checkbox',{name:'报错就换备用'}),patterns=screen.getByRole('textbox',{name:'仅这些报错触发'});
  await waitFor(()=>expect((patterns as HTMLTextAreaElement).value).toBe('connection_error\n/上游繁忙/'));
  expect((enabled as HTMLInputElement).checked).toBe(false);
  await user.click(enabled);await user.clear(patterns);await user.type(patterns,'quota\n/忙碌/');
  await user.click(screen.getByRole('button',{name:'保存对话设定'}));
  await waitFor(()=>expect(f.store.getConversation(f.conversation.id).settings).toMatchObject({mainRoute:{model:'另一个模型'},fallbackOnError:true,errorPatterns:['quota','/忙碌/']}));
  const beforeSend=preferenceReads;
  await user.type(screen.getByRole('textbox',{name:'想说的话'}),'再一起去海边');await user.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(f.store.listTurns(f.conversation.id)).toHaveLength(2));
  const group=f.store.groupsForTurn(f.store.listTurns(f.conversation.id).at(-1)!.id)[0]!;await f.engine.waitForGroup(group.id);
  expect(f.store.getSnapshot(group.snapshotId).options).toMatchObject({fallbackOnError:true,errorPatterns:['quota','/忙碌/']});expect(preferenceReads).toBe(beforeSend);
 });
 it('外观贡献不可用时隐藏入口，恢复入口不改变聊天与草稿',async()=>{
  const f=fixture(),user=userEvent.setup(),destinations:string[]=[];
  const props={api:f.api,initialConversationId:f.conversation.id,onNavigate:(value:string)=>{destinations.push(value);},onExport:async()=>{},onRestore:async()=>''};
  const view=render(<ChatPanel {...props} appearanceAvailable={false}/>);
  await screen.findByText('我记得，小夏。');expect(screen.queryByRole('button',{name:'换个装扮'})).toBeNull();
  expect(screen.getByRole('button',{name:'连接模型'})).toBeTruthy();
  await user.type(screen.getByRole('textbox',{name:'想说的话'}),'等会再聊');
  view.rerender(<ChatPanel {...props}/>);
  await user.click(screen.getByRole('button',{name:'换个装扮'}));expect(destinations).toEqual(['appearance']);
  expect(screen.getByText('我记得，小夏。')).toBeTruthy();expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('等会再聊');
  expect(f.requests()).toBe(0);
 });
 it('历史与当前候选各用冻结显示规则和称呼，原文与手改草稿不被改写',async()=>{
  const f=fixture(1,undefined,currentMaterial),user=userEvent.setup();
  f.displays.set(f.first.id,{rules:[displayRule('{{char}}身边的{{user}}')],context:{char:'旧角色',user:'旧玩家'}});
  const nextTurn=f.store.createTurn(f.conversation.id,{input:'小夏，我们一起走吧。',parentCandidateId:f.first.id});
  const snapshot=f.store.createSnapshot(f.conversation.id,{system:'新的这一轮',messages:[{role:'user',content:nextTurn.input}],bindings:[],options:{}});
  const group=f.store.createGroup(nextTurn.id,{snapshotId:snapshot.id,routes:[f.conversation.settings.mainRoute!],settingsRevision:1});
  const next=f.store.createCandidate(group.id,{kind:'generated',text:'小夏，约定没变。',status:'complete'});f.store.selectCandidate(next.id);
  f.displays.set(next.id,{rules:[displayRule('{{char}}记得的{{user}}')],context:{char:'当时角色',user:'当时玩家'}});
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  const oldReply=await screen.findByText('我记得，旧角色身边的旧玩家。');
  expect(oldReply.closest('.tk-message-body')).not.toBeNull();
  expect(screen.getByText('旧角色身边的旧玩家，还记得我们的约定吗？').closest('.tk-message-user')).not.toBeNull();
  const currentInput=await screen.findByText('当时角色记得的当时玩家，我们一起走吧。');
  expect(currentInput.closest('.tk-message-body')).not.toBeNull();expect(currentInput.closest('.tk-message-user')).not.toBeNull();
  const reply=await screen.findByText('当时角色记得的当时玩家，约定没变。');expect(reply.closest('.tk-message-body')).not.toBeNull();
  expect(screen.queryByText(/新版名字/)).toBeNull();
  await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
  expect((screen.getByRole('textbox',{name:'角色回复'}) as HTMLTextAreaElement).value).toBe('小夏，约定没变。');
  expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.store.getCandidate(next.id).text).toBe('小夏，约定没变。');
 });
 it('没有冻结显示投影的旧候选直接显示原文，不借用当前素材规则',async()=>{
  const f=fixture(1,undefined,currentMaterial);
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');expect(screen.queryByText('我记得，新版名字。')).toBeNull();
  expect(screen.getByText('小夏，还记得我们的约定吗？')).toBeTruthy();
 });
 it('流式只追加原文再按冻结规则派生，跨增量匹配不重读候选或反复替换',async()=>{
  const f=fixture(1,undefined,currentMaterial),publish=liveUpdates(f.api);
  f.displays.set(f.first.id,{rules:[displayRule('小夏。海〔{{char}}与{{user}}〕','/小夏。海/g')],context:{char:'旧角色',user:'旧玩家'}});
  let reads=0;const preview=f.api.previewCandidate;f.api.previewCandidate=async id=>{reads++;return preview(id);};
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');const before=reads;
  await act(async()=>{f.store.appendCandidateDelta(f.first.id,'海');publish({conversationId:f.conversation.id,type:'candidate',candidateId:f.first.id,delta:'海'});});
  expect(screen.getByText('我记得，小夏。海〔旧角色与旧玩家〕')).toBeTruthy();
  await act(async()=>{f.store.appendCandidateDelta(f.first.id,'边');publish({conversationId:f.conversation.id,type:'candidate',candidateId:f.first.id,delta:'边'});});
  expect(screen.getByText('我记得，小夏。海〔旧角色与旧玩家〕边')).toBeTruthy();
  expect(f.store.candidateText(f.first.id)).toBe('我记得，小夏。海边');expect(reads).toBe(before);
 });
 it('打开会话后父级回传同一ID，不清空候选、草稿或订阅',async()=>{
  const f=fixture(),user=userEvent.setup(),publish=liveUpdates(f.api);let acknowledge:(()=>void)|undefined;
  function Parent(){const [id,setId]=React.useState<string>();return <ChatPanel api={f.api} initialConversationId={id} onOpened={value=>{acknowledge=()=>setId(value);}} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>;}
  render(<Parent/>);await user.click(await screen.findByRole('button',{name:/^海边的约定/}));
  await screen.findByText('我记得，小夏。');await user.type(screen.getByRole('textbox',{name:'想说的话'}),'还想和你说');
  await act(async()=>{acknowledge?.();});
  expect(screen.queryByText('正在翻开这段对话…')).toBeNull();expect(screen.getByLabelText('当前候选')).toBeTruthy();
  expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('还想和你说');
  await act(async()=>{f.store.appendCandidateDelta(f.first.id,'还记得。');publish({conversationId:f.conversation.id,type:'candidate',candidateId:f.first.id,delta:'还记得。'});});
  expect(screen.getByText('我记得，小夏。还记得。')).toBeTruthy();
 });
 it('候选切回保留各自阅读位置，流式新增不拉走正在读旧内容的玩家',async()=>{
  const f=fixture(2),user=userEvent.setup(),publish=liveUpdates(f.api);
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');const reading=screen.getByLabelText('当前候选').parentElement as HTMLDivElement;
  Object.defineProperties(reading,{scrollHeight:{configurable:true,value:2400},clientHeight:{configurable:true,value:400}});
  reading.scrollTop=420;fireEvent.scroll(reading);
  await user.click(screen.getByRole('button',{name:'下一个候选'}));await screen.findByText('候选正文 2');
  reading.scrollTop=900;fireEvent.scroll(reading);
  await user.click(screen.getByRole('button',{name:'上一个候选'}));await screen.findByText('我记得，小夏。');expect(reading.scrollTop).toBe(420);
  await user.click(screen.getByRole('button',{name:'下一个候选'}));await screen.findByText('候选正文 2');expect(reading.scrollTop).toBe(900);
  const second=f.store.listCandidates(f.turn.id).items[1]!;
  await act(async()=>{f.store.appendCandidateDelta(second.id,'，还在写');publish({conversationId:f.conversation.id,type:'candidate',candidateId:second.id,delta:'，还在写'});});
  expect(screen.getByText('候选正文 2，还在写')).toBeTruthy();expect(reading.scrollTop).toBe(900);
 });
 it('对话设定选人设先改草稿，保存只绑定明确版本与本对话手调',async()=>{
  const f=fixture(),library=new MaterialsLibrary(':memory:'),user=userEvent.setup();disposers.push(async()=>{library.close();});
  const persona=savePersona(library,{name:'小雨',description:'从海边来的旅人'}),ref={id:persona.id,version:1};
  f.api.listMaterials=async()=>library.list();f.api.materialVersion=async value=>library.readVersion(value);
  f.api.resources=async value=>library.resources(value).map(resource=>({path:resource.path,mediaType:resource.mediaType,base64:Buffer.from(resource.bytes).toString('base64')}));
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'对话设定'}));
  const dialog=screen.getByRole('dialog',{name:'对话设定'}),selector=within(dialog).getByRole('combobox',{name:'我的人设'});
  await user.selectOptions(selector,within(dialog).getByRole('option',{name:/小雨/}));
  const name=within(dialog).getByRole('textbox',{name:'玩家称呼'}),description=within(dialog).getByRole('textbox',{name:'玩家设定'});
  await waitFor(()=>expect((name as HTMLInputElement).value).toBe('小雨'));
  expect(f.store.getConversation(f.conversation.id).bindings).toEqual([]);
  await user.clear(name);await user.type(name,'阿雨');await user.clear(description);await user.type(description,'今天只做一个看雨的人');
  await user.click(within(dialog).getByRole('button',{name:'保存对话设定'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'对话设定'})).toBeNull());
  expect(f.store.getConversation(f.conversation.id).bindings).toEqual([ref]);
  expect(f.store.getConversation(f.conversation.id).settings).toMatchObject({playerName:'阿雨',playerDescription:'今天只做一个看雨的人'});
  expect(library.readVersion(ref).projection.persona).toMatchObject({name:'小雨',description:'从海边来的旅人'});
  expect(f.store.getSnapshot(f.store.getGroup(f.first.groupId).snapshotId).bindings).toEqual([]);expect(f.requests()).toBe(0);
 });
 it('历史和当前玩家头像各用冻结人设版本，不借用最新库头像',async()=>{
  const f=fixture(),library=new MaterialsLibrary(':memory:');disposers.push(async()=>{library.close();});
  const firstImage='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=',secondImage='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const persona=savePersona(library,{name:'小雨',description:'海边旅人',avatar:{name:'头像.png',mediaType:'image/png',base64:firstImage}});
  const oldRef={id:persona.id,version:1},newRef={id:persona.id,version:2};
  library.revisePersona(persona.id,{name:'阿雨',description:'旧城旅人',avatar:{name:'头像.png',mediaType:'image/png',base64:secondImage}});
  f.store.updateConversation(f.conversation.id,{bindings:[newRef],settings:{playerName:'阿雨',playerDescription:'旧城旅人'}});
  f.displays.set(f.first.id,{playerRef:oldRef,rules:[],context:{char:'角色',user:'小雨'}});
  const turn=f.store.createTurn(f.conversation.id,{input:'那我们回家吧',parentCandidateId:f.first.id});
  const snapshot=f.store.createSnapshot(f.conversation.id,{system:'记得约定',messages:[{role:'user',content:turn.input}],bindings:[newRef],options:{playerName:'阿雨'}});
  const group=f.store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[f.conversation.settings.mainRoute!],settingsRevision:2});
  const reply=f.store.createCandidate(group.id,{kind:'generated',text:'我会一直陪你走。',status:'complete'});f.store.selectCandidate(reply.id);
  f.displays.set(reply.id,{playerRef:newRef,rules:[],context:{char:'角色',user:'阿雨'}});
  f.api.listMaterials=async()=>library.list();f.api.materialVersion=async value=>library.readVersion(value);
  f.api.resources=async value=>library.resources(value).map(resource=>({path:resource.path,mediaType:resource.mediaType,base64:Buffer.from(resource.bytes).toString('base64')}));
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我会一直陪你走。');
  await waitFor(()=>expect(document.querySelectorAll('.tk-message-user .tk-message-avatar img')).toHaveLength(2));
  const portraits=Array.from(document.querySelectorAll<HTMLImageElement>('.tk-message-user .tk-message-avatar img'),image=>image.src);
  expect(portraits).toEqual([`data:image/png;base64,${firstImage}`,`data:image/png;base64,${secondImage}`]);
  expect(f.requests()).toBe(0);expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');
 });
 it('再次点开当前对话保持正文、草稿和订阅，不停在加载状态',async()=>{
  const f=fixture(),user=userEvent.setup(),publish=liveUpdates(f.api);
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.type(screen.getByRole('textbox',{name:'想说的话'}),'等雨停');
  await user.click(screen.getByRole('button',{name:'海边的约定'}));
  expect(await screen.findByLabelText('当前候选')).toBeTruthy();
  expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('等雨停');
  await act(async()=>{f.store.appendCandidateDelta(f.first.id,'我们再走。');publish({conversationId:f.conversation.id,type:'candidate',candidateId:f.first.id,delta:'我们再走。'});});
  expect(await screen.findByText('我记得，小夏。我们再走。')).toBeTruthy();expect(f.requests()).toBe(0);
 });
 it('正文搜索预览保留草稿与原路线，只有明确继续才选中旧候选',async()=>{
  const f=fixture(),user=userEvent.setup();
  const edited=await f.engine.editCandidate(f.first.id,'我把那枚蓝色书签留给你。');
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');
  await user.type(screen.getByRole('textbox',{name:'想说的话'}),'先把伞带上');
  await user.click(screen.getByRole('button',{name:'搜索历史正文'}));
  const dialog=screen.getByRole('dialog',{name:'搜索历史正文'});
  await user.type(within(dialog).getByRole('searchbox',{name:'搜索历史正文'}),'蓝色书签');
  await user.click(within(dialog).getByRole('button',{name:'搜索'}));
  await user.click(await within(dialog).findByRole('button',{name:'查看原文：海边的约定 · 候选 2'}));
  expect(within(await within(dialog).findByRole('region',{name:'角色原文'})).getByText('我把那枚蓝色书签留给你。')).toBeTruthy();
  expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);
  expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('先把伞带上');
  expect(f.requests()).toBe(0);
  await user.click(within(dialog).getByRole('button',{name:'从这里继续'}));
  await waitFor(()=>expect(screen.queryByRole('dialog',{name:'搜索历史正文'})).toBeNull());
  await waitFor(()=>expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(edited.id));
  expect((await screen.findByLabelText('当前候选')).textContent).toContain('我把那枚蓝色书签留给你。');
  expect((screen.getByRole('textbox',{name:'想说的话'}) as HTMLTextAreaElement).value).toBe('先把伞带上');
  expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.requests()).toBe(0);
 });
 it('跨对话搜索明确继续后打开命中对话，搜索与切换均不生成正文',async()=>{
  const f=fixture(),user=userEvent.setup();
  const other=f.store.createConversation({title:'桥边的重逢',settings:f.conversation.settings});
  const turn=f.store.createTurn(other.id,{input:'我们在哪儿见？'});
  const snapshot=f.store.createSnapshot(other.id,{system:'在桥边等她',messages:[{role:'user',content:turn.input}],bindings:[],options:{}});
  const group=f.store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[f.conversation.settings.mainRoute!],settingsRevision:other.settingsRevision});
  const reply=f.store.createCandidate(group.id,{kind:'generated',text:'我在旧桥边等你。',status:'complete'});f.store.selectCandidate(reply.id);
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'搜索历史正文'}));
  const dialog=screen.getByRole('dialog',{name:'搜索历史正文'});
  await user.click(within(dialog).getByRole('button',{name:'全部对话'}));
  await user.type(within(dialog).getByRole('searchbox',{name:'搜索历史正文'}),'旧桥边');
  await user.click(within(dialog).getByRole('button',{name:'搜索'}));
  await user.click(await within(dialog).findByRole('button',{name:'查看原文：桥边的重逢 · 候选 1'}));
  expect(within(await within(dialog).findByRole('region',{name:'角色原文'})).getByText('我在旧桥边等你。')).toBeTruthy();
  expect(screen.getByRole('heading',{level:1}).textContent).toBe('海边的约定');expect(f.requests()).toBe(0);
  await user.click(within(dialog).getByRole('button',{name:'从这里继续'}));
  await screen.findByRole('heading',{level:1,name:'桥边的重逢'});
  await waitFor(()=>expect(screen.getByLabelText('当前候选').textContent).toContain('我在旧桥边等你。'));
  expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(f.first.id);expect(f.requests()).toBe(0);
 });
 it('手改成新候选，原回复不变，下一句沿选中的手改版本走',async()=>{
  const f=fixture();const user=userEvent.setup();render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'回复操作'}));await user.click(screen.getByRole('button',{name:'编辑这条回复'}));
  const edit=screen.getByRole('textbox',{name:'角色回复'});await user.clear(edit);await user.type(edit,'我记得，小满。');await user.click(screen.getByRole('button',{name:'另存为候选'}));
  await screen.findByText('我记得，小满。');expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.requests()).toBe(0);
  await user.type(screen.getByRole('textbox',{name:'想说的话'}),'那我们接着走吧');await user.click(screen.getByRole('button',{name:'发送'}));
  await waitFor(()=>expect(f.store.listTurns(f.conversation.id)).toHaveLength(2));const last=f.store.listTurns(f.conversation.id).at(-1)!;
  expect(f.store.getCandidate(last.parentCandidateId!).kind).toBe('edited');expect(f.requests()).toBe(1);
 });
 it('上千条候选可按序号找回、标记喜欢与筛选，无需展开地图',async()=>{
  const f=fixture(1005);const user=userEvent.setup();render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');const number=screen.getByRole('spinbutton',{name:'候选序号'});fireEvent.change(number,{target:{value:'1005'}});await user.click(screen.getByRole('button',{name:'前往候选'}));
  await screen.findByText('候选正文 1005');await user.click(screen.getByRole('button',{name:'喜欢这条'}));await user.click(screen.getByRole('checkbox',{name:'只看喜欢'}));
  await screen.findByText('候选正文 1005');expect(screen.getByLabelText('候选总数').textContent).toContain('1');expect(f.requests()).toBe(0);
 });
 it('离开面板只解除订阅，Host的生成继续完成',async()=>{
  let release=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});const f=fixture(1,gate);const user=userEvent.setup();
  const view=render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('我记得，小夏。');await user.click(screen.getByRole('button',{name:'换个回复'}));
  await waitFor(()=>expect(f.store.listCandidates(f.turn.id).total).toBe(2));view.unmount();release();await act(async()=>{await f.engine.waitForGroup(f.store.groupsForTurn(f.turn.id).at(-1)!.id);});
  const candidate=f.store.listCandidates(f.turn.id).items.at(-1)!;expect(candidate.status).toBe('complete');expect(candidate.text).toBe('新的答复');
 });
});


describe('MVU candidate reading and explicit editing',()=>{
 it('initializes the previewed old swipe without changing the selected swipe, text or draft',async()=>{
  const f=fixture(2),user=userEvent.setup(),selected=f.store.listCandidates(f.turn.id).items[1]!;
  f.store.selectCandidate(selected.id);const initialized:string[]=[];
  f.api.initializeVariables=async id=>{initialized.push(id);const target=f.store.getCandidate(id),state={stat_data:{counter:10},schema:{},initialized_lorebooks:{},display_data:{},delta_data:{}};f.store.setCandidateMvu(id,{state,issues:[],kind:'manual'});f.displays.set(id,{context:{char:'角色',user:'小夏'},rules:[],variables:state});return f.store.updateConversation(target.conversationId,{settings:{mvuEnabled:true}});};
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('候选正文 2');await user.click(screen.getByRole('button',{name:'上一个候选'}));await screen.findByText('我记得，小夏。');
  await user.type(screen.getByLabelText('想说的话'),'保留这句');
  await user.click(screen.getByRole('button',{name:'更多操作'}));await user.click(screen.getByRole('button',{name:'剧情变量'}));
  const dialog=await screen.findByRole('dialog',{name:'剧情变量'});await user.click(within(dialog).getByRole('button',{name:'开启变量'}));
  await waitFor(()=>expect(initialized).toEqual([f.first.id]));await within(dialog).findByLabelText('counter 的值');
  expect(f.store.getCandidate(f.first.id).mvu?.state.stat_data.counter).toBe(10);expect(f.store.getCandidate(selected.id).mvu).toBeUndefined();
  expect(f.store.getConversation(f.conversation.id).currentCandidateId).toBe(selected.id);
  expect(f.store.getCandidate(f.first.id).text).toBe('我记得，小夏。');expect(f.requests()).toBe(0);
  await user.click(within(dialog).getByRole('button',{name:'关闭剧情变量'}));expect((screen.getByLabelText('想说的话') as HTMLTextAreaElement).value).toBe('保留这句');
 });

 it('reads the displayed candidate snapshot and saves an explicit variable revision without rewriting text, draft or model input',async()=>{
  const f=fixture(),user=userEvent.setup();
  const source='当前记录：{{get_message_variable::stat_data.counter}}';
  const edited=f.store.editCandidate(f.first.id,source);f.store.selectCandidate(edited.id);
  const state={stat_data:{counter:10},schema:{},initialized_lorebooks:{},display_data:{},delta_data:{}};
  f.store.setCandidateMvu(edited.id,{state,issues:[],kind:'computed'});
  const context={char:'阿岚',user:'小夏'};f.displays.set(edited.id,{context,rules:[],variables:state});
  f.api.setVariables=async(id,value)=>{const previous=f.store.getCandidate(id).mvu!;const candidate=f.store.setCandidateMvu(id,{state:value,issues:[],kind:'manual',revisions:[{state:previous.state,at:1}]});f.displays.set(id,{context,rules:[],variables:value});return candidate;};
  f.api.initializeVariables=async(id)=>f.store.updateConversation(f.store.getCandidate(id).conversationId,{settings:{mvuEnabled:true}});
  render(<ChatPanel api={f.api} initialConversationId={f.conversation.id} onNavigate={()=>{}} onExport={async()=>{}} onRestore={async()=>''}/>);
  await screen.findByText('当前记录：10');
  await user.type(screen.getByLabelText('想说的话'),'保留这句草稿');
  await user.click(screen.getByRole('button',{name:'更多操作'}));await user.click(screen.getByRole('button',{name:'剧情变量'}));
  const dialog=await screen.findByRole('dialog',{name:'剧情变量'});
  await user.click(within(dialog).getByText('完整 JSON'));
  fireEvent.change(within(dialog).getByLabelText('完整变量 JSON'),{target:{value:JSON.stringify({...state,stat_data:{counter:11}})}});
  await user.click(within(dialog).getByRole('button',{name:'保存变量'}));
  await waitFor(()=>expect(f.store.getCandidate(edited.id).mvu?.state.stat_data.counter).toBe(11));
  expect(f.store.getCandidate(edited.id).mvu?.revisions?.[0]?.state.stat_data.counter).toBe(10);
  expect(f.store.getCandidate(edited.id).text).toBe(source);expect(f.requests()).toBe(0);
  await user.click(within(dialog).getByRole('button',{name:'关闭剧情变量'}));
  expect((screen.getByLabelText('想说的话') as HTMLTextAreaElement).value).toBe('保留这句草稿');
  await screen.findByText('当前记录：11');
 });
});
