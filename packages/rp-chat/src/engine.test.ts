import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { ConversationStore } from './store.js';
import { ChatEngine, type LlmGateway, type ReplyChunk } from './engine.js';
import type { CallControls, ResolvedCall, Route } from '@tavern-kit/rp-connections/types';
import type { MaterialVersion } from '@tavern-kit/rp-materials/types';
import type { MaterialRef, PromptInput, Snapshot } from './types.js';

const primary:Route={provider:'relay',model:'[薄甲]model/one',inputBudget:16000,parameters:{temperature:true}};
const stores:ConversationStore[]=[];
const engines:ChatEngine[]=[];
afterEach(async()=>{await Promise.all(engines.splice(0).map(engine=>engine.dispose()));for(const store of stores.splice(0))store.close();});
function setup(handler:(config:ResolvedCall,input:PromptInput,signal:AbortSignal)=>AsyncIterable<ReplyChunk>, loadMaterials:(refs:MaterialRef[])=>MaterialVersion[]=()=>[]) {
  const store=new ConversationStore(':memory:'); stores.push(store);
  const calls:{config:ResolvedCall;input:PromptInput}[]=[];
  const gateway:LlmGateway={async prepare(config,signal){let used=false;return {config:{...config},stream(input){if(used)throw new Error('准备句柄只能使用一次');used=true;calls.push({config,input});return handler(config,input,signal);}};}};
  const engine=new ChatEngine(store,gateway,loadMaterials); engines.push(engine);
  const conversation=store.createConversation({title:'接着聊',settings:{mainRoute:primary}});
  return {store,engine,conversation,calls};
}
const text=(value:string):ReplyChunk=>({type:'text',text:value});
const finish=(reason='stop'):ReplyChunk=>({type:'finish',reason});
function deferred() {
  let resolve:()=>void=()=>{};
  const promise=new Promise<void>(done=>{resolve=done;});
  return {promise,resolve};
}

it('快照完整保存可序列化选项，调用参数有公开结构类型',()=>{
  expectTypeOf<Snapshot['options']['controls']>().toEqualTypeOf<CallControls|undefined>();
  const store=new ConversationStore(':memory:');stores.push(store);
  const conversation=store.createConversation({title:'冻结选项'});
  const snapshot=store.createSnapshot(conversation.id,{system:'角色设定',messages:[{role:'user',content:'你好'}],bindings:[],options:{
    playerName:'阿宁',playerDescription:'与角色的关系',controls:{temperature:0.8,maxTokens:2048,reasoningEffort:'high',stop:['停']},
    fallbackOn400:false,fallbackOnError:true,errorPatterns:['返回错误'],estimatedTokens:30,inputBudget:8000,continuationOf:'source-candidate',kind:'summary',
  }});
  expect(store.getSnapshot(snapshot.id).options).toEqual({
    playerName:'阿宁',playerDescription:'与角色的关系',controls:{temperature:0.8,maxTokens:2048,reasoningEffort:'high',stop:['停']},
    fallbackOn400:false,fallbackOnError:true,errorPatterns:['返回错误'],estimatedTokens:30,inputBudget:8000,continuationOf:'source-candidate',kind:'summary',
  });
});

it('只有角色首句或失败空回复的回合不虚构空玩家与角色消息，原始回合仍完整保留',async()=>{
  const {engine,store,conversation,calls}=setup(async function*(){yield text('接下来的回答');yield finish();});
  let parent:string|undefined;
  const originals=[{input:'',reply:'角色的首句'},{input:'上次没有答完的问题',reply:''}];
  for(const original of originals){
    const turn=store.createTurn(conversation.id,{input:original.input,parentCandidateId:parent});
    const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{}});
    const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[primary],settingsRevision:1});
    parent=store.createCandidate(group.id,{kind:'generated',text:original.reply,status:original.reply?'complete':'failed',imported:{status:original.reply?'complete':'failed'}}).id;
  }
  store.selectCandidate(parent!);
  const next=await engine.send(conversation.id,'现在继续');await engine.waitForGroup(next.id);
  expect(calls[0]!.input.messages).toEqual([
    {role:'assistant',content:'角色的首句'},
    {role:'user',content:'上次没有答完的问题'},
    {role:'user',content:'现在继续'},
  ]);
  expect(store.route(conversation.id,parent).map(row=>({input:row.turn.input,reply:row.candidate.text}))).toEqual(originals);
});

it('整理含单边消息的历史按真实消息深度执行正则，不以每轮固定两条推算',async()=>{
  const material:MaterialVersion={id:'depth-rules',version:1,originalId:'original',createdAt:'2026-11-19',raw:{},capabilities:[],bindings:{worldbooks:[],preset:null},projection:{kind:'regex',name:'历史深度规则',character:null,worldbook:null,preset:null,quickReplies:[],regex:[
    {id:'depth',name:'远处角色回复',findRegex:'/深度验证/g',replaceString:'深度正确',trimStrings:[],placements:['output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:8,maxDepth:8,substituteRegex:0,sourcePath:'regex.0'},
  ]}};
  const {engine,store,conversation,calls}=setup(async function*(_config,input){yield text(input.system.startsWith('用自然中文整理')?'保留了已确认约定':'继续回答');yield finish();},()=>[material]);
  store.updateConversation(conversation.id,{bindings:[{id:material.id,version:1}],settings:{mainRoute:{...primary,inputBudget:1200},controls:{maxTokens:128}}});
  let parent:string|undefined,originalId='';
  for(let index=0;index<5;index++){
    const turn=store.createTurn(conversation.id,{input:index===1?'':`玩家${index}${'叙'.repeat(160)}`,parentCandidateId:parent});
    const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{}});
    const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[primary],settingsRevision:1});
    parent=store.createCandidate(group.id,{kind:'generated',text:`角色${index}深度验证${'事'.repeat(160)}`,status:'complete'}).id;
    if(index===0)originalId=parent;
  }
  store.selectCandidate(parent!);
  const next=await engine.send(conversation.id,'新的问题');await engine.waitForGroup(next.id);
  const summaries=calls.filter(call=>call.input.system.startsWith('用自然中文整理'));
  expect(summaries.length).toBeGreaterThan(0);
  expect(summaries[0]!.input.messages[0]!.content).toContain('角色0深度正确');
  expect(store.getCandidate(originalId).text).toContain('角色0深度验证');
  const attempts=store.attemptsForTurn(next.turnId).filter(attempt=>attempt.kind==='summary');
  expect(attempts.map(attempt=>store.inputForSnapshot(attempt.snapshotId))).toEqual(summaries.map(call=>call.input));
});

it.each([false,true])('只有角色首句的导入回合换回复时不制造当前玩家消息，空输入规则启用=%s',async withRule=>{
  const material:MaterialVersion={id:'empty-input-rule',version:1,originalId:'original',createdAt:'2026-11-19',raw:{},capabilities:[],bindings:{worldbooks:[],preset:null},projection:{kind:'regex',name:'空输入规则',character:null,worldbook:null,preset:null,quickReplies:[],regex:[
    {id:'empty',name:'不能凭空行动',findRegex:'/^$/g',replaceString:'凭空出现的玩家行动',trimStrings:[],placements:['input'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'},
  ]}};
  const {engine,store,conversation,calls}=setup(async function*(){yield text('新首句');yield finish();},()=>withRule?[material]:[]);
  const turn=store.createTurn(conversation.id,{input:''});
  const snapshot=store.createSnapshot(conversation.id,{system:'原导入快照',messages:[{role:'assistant',content:'只有角色首句'}],bindings:[],options:{}});
  const imported=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:0});
  const original=store.createCandidate(imported.id,{kind:'generated',text:'只有角色首句',status:'complete',imported:{status:'complete'}});
  store.selectCandidate(original.id);
  const group=await engine.roll(turn.id);await engine.waitForGroup(group.id);
  expect(calls).toHaveLength(1);
  expect(calls[0]!.input.messages).toEqual([]);
  expect(store.inputForSnapshot(group.snapshotId)).toEqual(calls[0]!.input);
  expect(store.inputForSnapshot(snapshot.id)).toEqual({system:'原导入快照',messages:[{role:'assistant',content:'只有角色首句'}]});
  expect(store.getTurn(turn.id).input).toBe('');expect(store.getCandidate(original.id).text).toBe('只有角色首句');
});

it.each([{input:'',depth:8},{input:' ',depth:9}])('空侧当前输入「$input」换回复触发整理时，首条历史角色正文真实深度为$depth',async({input,depth})=>{
  const material:MaterialVersion={id:'roll-depth',version:1,originalId:'original',createdAt:'2026-11-19',raw:{},capabilities:[],bindings:{worldbooks:[],preset:null},projection:{kind:'regex',name:'整理深度',character:null,worldbook:null,preset:null,quickReplies:[],regex:[
    {id:'empty',name:'空输入不是行动',findRegex:'/^$/g',replaceString:'凭空出现的玩家行动',trimStrings:[],placements:['input'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'},
    {id:'depth',name:'角色真实深度',findRegex:'/深度验证/g',replaceString:'深度正确',trimStrings:[],placements:['output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:depth,maxDepth:depth,substituteRegex:0,sourcePath:'regex.1'},
  ]}};
  const {engine,store,conversation,calls}=setup(async function*(_config,request){yield text(request.system.startsWith('用自然中文整理')?'剧情备忘':'新的首句');yield finish();},()=>[material]);
  store.updateConversation(conversation.id,{bindings:[{id:material.id,version:1}],settings:{mainRoute:{...primary,inputBudget:1200},controls:{maxTokens:128}}});
  let parent:string|undefined,firstCandidate='';
  for(let i=0;i<5;i++){
    const turn=store.createTurn(conversation.id,{input:`玩家${i}${'叙'.repeat(160)}`,parentCandidateId:parent});
    const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{}});
    const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:0});
    parent=store.createCandidate(group.id,{kind:'generated',text:`角色${i}深度验证${'事'.repeat(160)}`,status:'complete'}).id;
    if(i===0)firstCandidate=parent;
  }
  const current=store.createTurn(conversation.id,{input,parentCandidateId:parent});
  const frozen=store.createSnapshot(conversation.id,{system:'未改动的旧输入',messages:[],bindings:[],options:{}});
  const imported=store.createGroup(current.id,{snapshotId:frozen.id,routes:[],settingsRevision:0});
  const source=store.createCandidate(imported.id,{kind:'generated',text:'旧首句',status:'complete'});store.selectCandidate(source.id);
  const group=await engine.roll(current.id);await engine.waitForGroup(group.id);
  const summaries=calls.filter(call=>call.input.system.startsWith('用自然中文整理'));
  expect(summaries.length).toBeGreaterThan(0);
  expect(summaries[0]!.input.messages[0]!.content).toContain('角色0深度正确');
  const reply=calls.at(-1)!.input;
  expect(reply.messages.some(message=>message.content==='凭空出现的玩家行动')).toBe(false);
  expect(reply.messages.at(-1)).toEqual(input===''?{role:'assistant',content:`角色4深度验证${'事'.repeat(160)}`}:{role:'user',content:' '});
  expect(store.inputForSnapshot(group.snapshotId)).toEqual(reply);
  expect(store.getCandidate(firstCandidate).text).toContain('深度验证');
  expect(store.inputForSnapshot(frozen.id)).toEqual({system:'未改动的旧输入',messages:[]});
});

it('400按原始模型ID退回，容量不足的备用跳过，实际尝试输入冻结且先保存后派发',async()=>{
  let persisted=false;
  const {engine,store,conversation,calls}=setup(async function*(config){
    const turn=store.listTurns(conversation.id).at(-1)!;
    persisted=store.attemptsForTurn(turn.id).some(a=>a.config.model===config.model);
    if(config.model===primary.model)throw Object.assign(new Error('upstream 400'),{status:400});
    yield text('阿宁，我记得我们的约定。');yield {type:'usage',usage:{inputTokens:28,outputTokens:10}};yield finish();
  });
  store.updateConversation(conversation.id,{settings:{fallbacks:[{provider:'tiny',model:'tiny',inputBudget:1},{provider:'other',model:'[enterprise]raw/name',inputBudget:16000}]}});
  const group=await engine.send(conversation.id,'我们说好的事情呢？');await engine.waitForGroup(group.id);
  expect(calls.map(c=>c.config.model)).toEqual([primary.model,'[enterprise]raw/name']);
  expect(calls[0]!.input).toEqual(calls[1]!.input);
  expect(persisted).toBe(true);
  const candidate=store.listCandidates(group.turnId).items[0]!;
  expect(store.candidateText(candidate.id)).toContain('阿宁');
  expect(store.attemptsForCandidate(candidate.id).map(a=>a.status)).toEqual(['failed','skipped','complete']);
  expect(store.getConversation(conversation.id).currentCandidateId).toBe(candidate.id);
});

it('同轮换回复复用快照，设定更新后开新组而不覆盖旧输入',async()=>{
  const {engine,store,conversation,calls}=setup(async function*(){yield text('原来的小满。');yield finish();});
  const first=await engine.send(conversation.id,'你好');await engine.waitForGroup(first.id);
  const same=await engine.roll(first.turnId);await engine.waitForGroup(same.id);
  expect(same.id).toBe(first.id);
  store.updateConversation(conversation.id,{settings:{playerName:'阿宁'}});
  const next=await engine.roll(first.turnId);await engine.waitForGroup(next.id);
  expect(next.id).not.toBe(first.id);
  expect(next.snapshotId).not.toBe(first.snapshotId);
  expect(store.inputForSnapshot(first.snapshotId)).toEqual(calls[0]!.input);
});

it('部分出字后不切备用，续写和手改续写保留源快照、来源模型与独立增量',async()=>{
  let count=0;
  const {engine,store,conversation,calls}=setup(async function*(){count++;yield text(count===1?'阿宁，':'我记得。');if(count===1)throw Object.assign(new Error('connection lost'),{status:503});yield finish();});
  store.updateConversation(conversation.id,{settings:{fallbacks:[{provider:'backup',model:'backup',inputBudget:16000}]}});
  const group=await engine.send(conversation.id,'你还记得吗？');await engine.waitForGroup(group.id);
  const source=store.listCandidates(group.turnId).items[0]!;
  expect(calls).toHaveLength(1);
  expect(source.status).toBe('failed');
  store.updateConversation(conversation.id,{settings:{mainRoute:{...primary,model:'another'},playerName:'新名字'}});
  const edited=store.editCandidate(source.id,'我的阿宁，');
  const continued=await engine.continueCandidate(edited.id);await engine.waitForGroup(continued.id);
  const candidate=store.listCandidates(group.turnId).items.at(-1)!;
  expect(candidate.sourceCandidateId).toBe(edited.id);
  expect(candidate.text).toBe('我记得。');
  expect(store.candidateText(candidate.id)).toBe('我的阿宁，我记得。');
  expect(calls[1]!.config.model).toBe(primary.model);
  expect(calls[1]!.input.messages.at(-1)).toEqual({role:'assistant',content:'我的阿宁，'});
  expect(store.getCandidate(source.id).text).toBe('阿宁，');
  expect(store.getGroup(candidate.groupId).sourceCandidateId).toBe(edited.id);
});

it('并发互不取消，取消阅读订阅不停止流，明确停止能保留部分正文',async()=>{
  let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});
  let aborted=0;
  const {engine,store,conversation}=setup(async function*(_config,_input,signal){yield text('已经生成的内容');await Promise.race([gate,new Promise<void>(resolve=>signal.addEventListener('abort',()=>{aborted++;resolve();},{once:true}))]);if(signal.aborted){yield finish('aborted');return;}yield text('接着写');yield finish();});
  store.updateConversation(conversation.id,{settings:{parallel:true,parallelCount:2}});
  const unsubscribe=engine.subscribe(conversation.id,()=>{});
  const group=await engine.send(conversation.id,'你好');
  await new Promise<void>(resolve=>setImmediate(resolve));
  unsubscribe();
  expect(aborted).toBe(0);
  const candidates=store.listCandidates(group.turnId).items;
  engine.stopCandidate(candidates[0]!.id);release();await engine.waitForGroup(group.id);
  expect(store.getCandidate(candidates[0]!.id).status).toBe('stopped');
  expect(store.getCandidate(candidates[0]!.id).text).toBe('已经生成的内容');
  expect(store.getCandidate(candidates[1]!.id).status).toBe('complete');
  expect(store.getConversation(conversation.id).currentCandidateId).toBeUndefined();
});

it('连续续写只在最初冻结输入后附加一次累计正文，手改不重复旧前缀',async()=>{
  let index=0;
  const {engine,store,conversation,calls}=setup(async function*(){yield text(['A','B','C','D'][index++]!);yield finish();});
  const first=await engine.send(conversation.id,'开始');await engine.waitForGroup(first.id);
  const source=store.listCandidates(first.turnId).items[0]!;
  const second=await engine.continueCandidate(source.id);await engine.waitForGroup(second.id);
  const firstContinuation=store.listCandidates(first.turnId,{groupId:second.id}).items[0]!;
  const third=await engine.continueCandidate(firstContinuation.id);await engine.waitForGroup(third.id);
  expect(calls[2]!.input.messages).toEqual([{role:'user',content:'开始'},{role:'assistant',content:'AB'}]);
  const latest=store.listCandidates(first.turnId,{groupId:third.id}).items[0]!;
  const edited=engine.editCandidate(latest.id,'手改后的整段');
  const fourth=await engine.continueCandidate(edited.id);await engine.waitForGroup(fourth.id);
  expect(calls[3]!.input.messages).toEqual([{role:'user',content:'开始'},{role:'assistant',content:'手改后的整段'}]);
  expect(store.candidateText(latest.id)).toBe('ABC');
  expect(store.candidateText(store.listCandidates(first.turnId,{groupId:fourth.id}).items[0]!.id)).toBe('手改后的整段D');
});

it('续写从源版本与玩家称呼投影原文，后续设置不混入或反复替换',async()=>{
  const original:MaterialVersion={id:'card',version:1,originalId:'original',createdAt:'2026-11-18',raw:{},capabilities:[],bindings:{worldbooks:[],preset:null},projection:{kind:'character',name:'小满',character:{name:'小满',description:'原来的设定',personality:'',scenario:'',firstMessage:'',alternateGreetings:[],messageExamples:'',systemPrompt:'',postHistoryInstructions:'',creatorNotes:'',tags:[]},worldbook:null,preset:null,quickReplies:[],regex:[
    {id:'private',name:'隐藏内部块',findRegex:'/<private>[\\s\\S]*?<\\/private>/g',replaceString:'',trimStrings:[],placements:['output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'},
    {id:'macro',name:'称呼',findRegex:'/x/g',replaceString:'xx{{user}}',trimStrings:[],placements:['output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.1'},
  ]}};
  const changed:MaterialVersion={...original,version:2,projection:{...original.projection,regex:[]}};
  const versions=[original,changed];
  const {engine,store,conversation,calls}=setup(async function*(){yield text('x<private>只留在原文</private>');yield finish();},refs=>refs.map(ref=>versions.find(version=>version.id===ref.id&&version.version===ref.version)!));
  store.updateConversation(conversation.id,{bindings:[{id:'card',version:1}],settings:{playerName:'阿宁'}});
  const first=await engine.send(conversation.id,'开始');await engine.waitForGroup(first.id);
  const source=store.listCandidates(first.turnId).items[0]!;
  store.updateConversation(conversation.id,{bindings:[{id:'card',version:2}],settings:{playerName:'新名字'}});
  const second=await engine.continueCandidate(source.id);await engine.waitForGroup(second.id);
  expect(calls[1]!.input.messages).toEqual([{role:'user',content:'开始'},{role:'assistant',content:'xx阿宁'}]);
  const continuation=store.listCandidates(first.turnId,{groupId:second.id}).items[0]!;
  const third=await engine.continueCandidate(continuation.id);await engine.waitForGroup(third.id);
  expect(calls[2]!.input.messages).toEqual([{role:'user',content:'开始'},{role:'assistant',content:'xx阿宁xx阿宁'}]);
  expect(store.candidateText(source.id)).toBe('x<private>只留在原文</private>');
  expect(store.getSnapshot(third.snapshotId).bindings).toEqual([{id:'card',version:1}]);
});

it('修订已有备忘保留真正覆盖边界，最近对话仍进入下一轮',async()=>{
  let index=0;
  const {engine,store,conversation,calls}=setup(async function*(){yield text(`角色${index++}`);yield finish();});
  let covered='';
  for(let i=0;i<4;i++){
    const group=await engine.send(conversation.id,`玩家${i}`);await engine.waitForGroup(group.id);
    if(i===0){covered=store.getConversation(conversation.id).currentCandidateId!;store.saveMemo(conversation.id,{basedOnCandidateId:covered,content:'只整理了第零轮',locked:[]});}
  }
  engine.editMemo(conversation.id,'只整理了第零轮，称呼改为阿宁',['重要称呼']);
  const next=await engine.send(conversation.id,'新的问题');await engine.waitForGroup(next.id);
  expect(calls.at(-1)!.input.system).toContain('称呼改为阿宁');
  expect(calls.at(-1)!.input.messages).toEqual([
    {role:'user',content:'玩家1'},{role:'assistant',content:'角色1'},
    {role:'user',content:'玩家2'},{role:'assistant',content:'角色2'},
    {role:'user',content:'玩家3'},{role:'assistant',content:'角色3'},
    {role:'user',content:'新的问题'},
  ]);
  expect(store.memos(conversation.id).at(-1)!.basedOnCandidateId).toBe(covered);
});

it.each(['选回当前回复','选回另一旧回复'])('慢新组完成不覆盖启动后玩家%s的明确路线',async selection=>{
  const started=deferred(),release=deferred();
  const {engine,store,conversation}=setup(async function*(config){
    if(config.model==='slow'){started.resolve();await release.promise;yield text('慢新组回复');}
    else yield text('旧组回复');
    yield finish();
  });
  const first=await engine.send(conversation.id,'第一句');await engine.waitForGroup(first.id);
  const original=store.getConversation(conversation.id).currentCandidateId!;
  const again=await engine.roll(first.turnId);await engine.waitForGroup(again.id);
  const current=store.getConversation(conversation.id).currentCandidateId!;
  store.updateConversation(conversation.id,{settings:{mainRoute:{...primary,model:'slow'}}});
  const pending=await engine.roll(first.turnId);await started.promise;
  const chosen=selection==='选回当前回复'?current:original;
  engine.select(chosen);release.resolve();await engine.waitForGroup(pending.id);
  expect(store.getConversation(conversation.id).currentCandidateId).toBe(chosen);
  expect(store.listCandidates(first.turnId,{groupId:pending.id}).items[0]).toMatchObject({text:'慢新组回复',status:'complete'});
});

it('准备组的await间隙明确选回同一回复，也不会在完成后抢走路线',async()=>{
  const {engine,store,conversation}=setup(async function*(config){yield text(config.model);yield finish();});
  const first=await engine.send(conversation.id,'第一句');await engine.waitForGroup(first.id);
  const chosen=store.getConversation(conversation.id).currentCandidateId!;
  store.updateConversation(conversation.id,{settings:{mainRoute:{...primary,model:'new-group'}}});
  const pending=engine.roll(first.turnId);
  engine.select(chosen);
  const group=await pending;await engine.waitForGroup(group.id);
  expect(store.getConversation(conversation.id).currentCandidateId).toBe(chosen);
  expect(store.listCandidates(first.turnId,{groupId:group.id}).items[0]!.status).toBe('complete');
});

it('手写备忘用于本轮所有新回复及其后续，不删历史且不进入兄弟回合',async()=>{
  const {engine,store,conversation,calls}=setup(async function*(){yield text('本条角色回复');yield finish();});
  const previous=await engine.send(conversation.id,'共同经历');await engine.waitForGroup(previous.id);
  const first=await engine.send(conversation.id,'这轮问题');await engine.waitForGroup(first.id);
  const frozen=store.inputForSnapshot(first.snapshotId);
  const manual=engine.editMemo(conversation.id,'本轮确认称呼阿宁',[]);
  const reroll=await engine.roll(first.turnId);await engine.waitForGroup(reroll.id);
  expect(calls[2]!.input.system).toContain('本轮确认称呼阿宁');
  expect(calls[2]!.input.messages).toEqual([{role:'user',content:'共同经历'},{role:'assistant',content:'本条角色回复'},{role:'user',content:'这轮问题'}]);
  const nextReply=await engine.roll(first.turnId);await engine.waitForGroup(nextReply.id);
  expect(nextReply.snapshotId).toBe(reroll.snapshotId);
  expect(calls[3]!.input.system).toContain('本轮确认称呼阿宁');
  expect(store.memos(conversation.id).at(-1)).toMatchObject({id:manual.id,kind:'manual',anchorTurnId:first.turnId});
  expect(store.memos(conversation.id).at(-1)!.basedOnCandidateId).toBeUndefined();
  const following=await engine.send(conversation.id,'接着问');await engine.waitForGroup(following.id);
  expect(calls.at(-1)!.input.system).toContain('本轮确认称呼阿宁');
  const sibling=await engine.editInput(first.turnId,'兄弟回合的问题');await engine.waitForGroup(sibling.id);
  expect(calls.at(-1)!.input.system).not.toContain('本轮确认称呼阿宁');
  expect(store.inputForSnapshot(first.snapshotId)).toEqual(frozen);
});

it('自动整理的A候选事件不因同轮换回复带进B',async()=>{
  const {engine,store,conversation,calls}=setup(async function*(){yield text('角色回复');yield finish();});
  const previous=await engine.send(conversation.id,'共同经历');await engine.waitForGroup(previous.id);
  const first=await engine.send(conversation.id,'这轮问题');await engine.waitForGroup(first.id);
  const candidate=store.getConversation(conversation.id).currentCandidateId!;
  const automatic={kind:'automatic' as const,sourceCandidateId:candidate,basedOnCandidateId:candidate,content:'只在A候选发生的约定',locked:[]};
  store.saveMemo(conversation.id,automatic);
  const reroll=await engine.roll(first.turnId);await engine.waitForGroup(reroll.id);
  expect(calls.at(-1)!.input.system).not.toContain('只在A候选发生的约定');
  expect(reroll.snapshotId).toBe(first.snapshotId);
});

it('自动整理继承手改备忘的回合边界，早期和兄弟路线回落旧备忘且原后续仍复用',async()=>{
  const {engine,store,conversation,calls}=setup(async function*(_config,input){yield text(input.system.startsWith('用自然中文整理')?'锚点内确认称呼阿宁':'角色回复');yield finish();});
  store.updateConversation(conversation.id,{settings:{mainRoute:{...primary,inputBudget:1400},controls:{maxTokens:128}}});
  const turns:string[]=[],candidates:string[]=[];let parent:string|undefined;
  for(let i=0;i<5;i++){
    const turn=store.createTurn(conversation.id,{input:`玩家${i}${'叙'.repeat(160)}`,parentCandidateId:parent});turns.push(turn.id);
    const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{}});
    const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[primary],settingsRevision:1});
    parent=store.createCandidate(group.id,{kind:'generated',text:`角色${i}${'事'.repeat(160)}`,status:'complete'}).id;candidates.push(parent);
  }
  const old=store.saveMemo(conversation.id,{kind:'automatic',sourceCandidateId:candidates[0],basedOnCandidateId:candidates[0],content:'此前共用约定',locked:[]});
  store.selectCandidate(parent!);
  engine.editMemo(conversation.id,'锚点内确认称呼阿宁',[]);
  const next=await engine.send(conversation.id,'接着问');await engine.waitForGroup(next.id);
  const frozen=store.inputForSnapshot(next.snapshotId);
  const automatic=store.memos(conversation.id).filter(memo=>memo.kind==='automatic').at(-1)!;
  expect(automatic.id).not.toBe(old.id);expect(automatic.basedOnCandidateId).toBe(candidates[1]);
  const beforeAnchor=await engine.roll(turns[2]!);await engine.waitForGroup(beforeAnchor.id);
  expect(calls.at(-1)!.input.system).not.toContain('锚点内确认称呼阿宁');
  expect(calls.at(-1)!.input.system).toContain('此前共用约定');
  const sibling=await engine.editInput(turns[4]!,'同一父回复的新问题');await engine.waitForGroup(sibling.id);
  expect(calls.at(-1)!.input.system).not.toContain('锚点内确认称呼阿宁');
  expect(calls.at(-1)!.input.system).toContain('此前共用约定');
  const resumed=await engine.roll(next.turnId);await engine.waitForGroup(resumed.id);
  expect(resumed.snapshotId).toBe(next.snapshotId);expect(calls.at(-1)!.input.system).toContain('锚点内确认称呼阿宁');
  expect(store.inputForSnapshot(next.snapshotId)).toEqual(frozen);
  expect(automatic.anchorTurnId).toBe(turns[4]);
});

it('剧情整理使用本次同路线的模型投影、宏与深度，保存实发输入且不改原文',async()=>{
  const material:MaterialVersion={id:'rules',version:1,originalId:'original',createdAt:'2026-11-18',raw:{},capabilities:[],bindings:{worldbooks:[],preset:null},projection:{kind:'character',name:'小满',character:{name:'小满',description:'',personality:'',scenario:'',firstMessage:'',alternateGreetings:[],messageExamples:'',systemPrompt:'',postHistoryInstructions:'',creatorNotes:'',tags:[]},worldbook:null,preset:null,quickReplies:[],regex:[
    {id:'private',name:'不发送内部块',findRegex:'/<private>[\\s\\S]*?<\\/private>/g',replaceString:'',trimStrings:[],placements:['input','output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.0'},
    {id:'depth',name:'远处称呼',findRegex:'/远记/g',replaceString:'远记{{user}}',trimStrings:[],placements:['input','output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:8,maxDepth:10,substituteRegex:0,sourcePath:'regex.1'},
    {id:'once',name:'只替换一次',findRegex:'/x/g',replaceString:'xx{{user}}',trimStrings:[],placements:['output'],displayOnly:false,promptOnly:true,disabled:false,runOnEdit:true,minDepth:null,maxDepth:null,substituteRegex:0,sourcePath:'regex.2'},
  ]}};
  const {engine,store,conversation,calls}=setup(async function*(_config,input){yield text(input.system.startsWith('用自然中文整理')?'这条路线的剧情备忘':'接着聊');yield finish();},()=>[material]);
  store.updateConversation(conversation.id,{bindings:[{id:'rules',version:1}],settings:{mainRoute:{...primary,inputBudget:1200},controls:{maxTokens:128},playerName:'阿宁'}});
  store.saveMemo(conversation.id,{content:'此前称呼{{user}}',locked:['角色{{char}}']});
  let parent:string|undefined,firstCandidate='';
  for(let i=0;i<5;i++){
    const turn=store.createTurn(conversation.id,{input:`{{user}}玩家${i}远记<private>输入内部${i}</private>${'叙'.repeat(160)}`,parentCandidateId:parent});
    const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{}});
    const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[primary],settingsRevision:1});
    const candidate=store.createCandidate(group.id,{kind:'generated',text:`{{char}}角色${i}x远记<private>推演内部${i}</private>${'事'.repeat(160)}`,status:'complete'});
    parent=candidate.id;if(i===0)firstCandidate=candidate.id;
  }
  store.selectCandidate(parent!);
  const group=await engine.send(conversation.id,'新的问题');await engine.waitForGroup(group.id);
  const summaries=calls.filter(call=>call.input.system.startsWith('用自然中文整理'));
  expect(summaries).toHaveLength(2);
  for(const call of calls){
    const actual=call.input.messages.map(message=>message.content).join('\n');
    expect(actual).not.toContain('输入内部');expect(actual).not.toContain('推演内部');
    expect(actual).not.toContain('{{');expect(actual).not.toContain('xxxx');
  }
  expect(summaries[0]!.input.messages[0]!.content).toContain('此前称呼阿宁');
  expect(summaries[0]!.input.messages[0]!.content).toContain('角色小满');
  expect(summaries[0]!.input.messages[0]!.content).toContain('阿宁玩家0远记阿宁');
  expect(summaries[0]!.input.messages[0]!.content).toContain('小满角色0xx阿宁远记阿宁');
  expect(summaries[1]!.input.messages[0]!.content).toContain('阿宁玩家1远记阿宁');
  expect(summaries[1]!.input.messages[0]!.content).toContain(`小满角色1xx阿宁远记${'事'.repeat(10)}`);
  const attempts=store.attemptsForTurn(group.turnId).filter(attempt=>attempt.kind==='summary');
  expect(attempts.map(attempt=>store.inputForSnapshot(attempt.snapshotId))).toEqual(summaries.map(call=>call.input));
  expect(store.getCandidate(firstCandidate).text).toContain('<private>推演内部0</private>');
  expect(store.route(conversation.id,parent).at(0)!.turn.input).toContain('<private>输入内部0</private>');
});

describe('出正文前的宽松备用链',()=>{
  it.each([
    {code:'INVALID_REQUEST',message:'请求格式不可用'},
    {code:'HTTP_400',message:'400 upstream body'},
    {code:'HTTP_413',status:413,message:'input too large'},
    {code:'AUTH',message:'当前凭据未通过验证'},
    {code:'QUOTA',message:'当前额度不足'},
    {code:'NO_ADAPTER',message:'模型路由未加载'},
    {message:'服务返回的原始自定义报错'},
  ])('$code无正文报错按原顺序尝试备用并保留错误',async(error)=>{
    const {engine,store,conversation,calls}=setup(async function*(config){
      if(config.model===primary.model){yield {type:'finish',reason:'error',error};return;}
      yield text('备用回复');yield finish();
    });
    store.updateConversation(conversation.id,{settings:{fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    const candidate=store.listCandidates(group.turnId).items[0]!;
    expect(calls.map(call=>call.config.model)).toEqual([primary.model,'backup']);
    expect(candidate.status).toBe('complete');
    expect(store.attemptsForCandidate(candidate.id).map(attempt=>attempt.status)).toEqual(['failed','complete']);
    expect(store.attemptsForCandidate(candidate.id)[0]!.error).toEqual(error);
  });
  it('旧的400专用开关不阻止新的宽松备用默认',async()=>{
    const {engine,store,conversation,calls}=setup(async function*(config){
      if(config.model===primary.model){yield {type:'finish',reason:'error',error:{code:'HTTP_400',message:'400 upstream body'}};return;}
      yield text('已经接上');yield finish();
    });
    store.updateConversation(conversation.id,{settings:{fallbackOn400:false,fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual([primary.model,'backup']);
    expect(store.listCandidates(group.turnId).items[0]!.status).toBe('complete');
  });
  it('无正文且没有显式错误对象的失败结束也尝试备用',async()=>{
    const {engine,store,conversation,calls}=setup(async function*(config){
      if(config.model===primary.model){yield finish('error');return;}
      yield text('已经接上');yield finish();
    });
    store.updateConversation(conversation.id,{settings:{fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual([primary.model,'backup']);
    expect(store.listCandidates(group.turnId).items[0]!.status).toBe('complete');
  });
  it('思考片段尚未成为正文，失败后可以尝试备用且分别保存原始片段',async()=>{
    const {engine,store,conversation,calls}=setup(async function*(config){
      if(config.model===primary.model){yield {type:'reasoning',text:'仅来自失败请求的思考'};throw new Error('站点自定义错误');}
      yield text('备用正文');yield finish();
    });
    store.updateConversation(conversation.id,{settings:{fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    const candidate=store.listCandidates(group.turnId).items[0]!;
    expect(calls.map(call=>call.config.model)).toEqual([primary.model,'backup']);
    expect(candidate.text).toBe('备用正文');
    expect(store.attemptsForCandidate(candidate.id)[0]!.reasoning).toBe('仅来自失败请求的思考');
  });
  it('重复连接和模型只请求一次，整条备用链有限且不循环',async()=>{
    const {engine,store,conversation,calls}=setup(async function*(){throw new Error('自定义失败');});
    store.updateConversation(conversation.id,{settings:{fallbacks:[{...primary,label:'重复主路由'},{...primary,model:'backup'},{...primary,model:'backup',label:'重复备用'},{...primary,model:'last'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual([primary.model,'backup','last']);
    const candidate=store.listCandidates(group.turnId).items[0]!;
    expect(candidate.status).toBe('failed');
    expect(store.attemptsForCandidate(candidate.id)).toHaveLength(3);
  });
  it('显式关闭宽松备用时只保留当前错误，并冻结该组选项',async()=>{
    const {engine,store,conversation,calls}=setup(async function*(){yield {type:'finish',reason:'error',error:{code:'HTTP_503',message:'upstream failed'}};});
    store.updateConversation(conversation.id,{settings:{fallbackOnError:false,fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual([primary.model]);
    expect(store.getSnapshot(group.snapshotId).options.fallbackOnError).toBe(false);
    expect(store.attemptsForTurn(group.turnId)[0]!.error).toEqual({code:'HTTP_503',message:'upstream failed'});
  });
  it('准备模型调用失败也能继续既定备用，未派发请求只保存跳过事实',async()=>{
    const store=new ConversationStore(':memory:');stores.push(store);
    const dispatched:string[]=[];
    const gateway:LlmGateway={async prepare(config){
      if(config.model===primary.model)throw new Error('服务当前无法准备该模型');
      return {config,async* stream(){dispatched.push(config.model);yield text('备用回复');yield finish();}};
    }};
    const engine=new ChatEngine(store,gateway,()=>[]);engines.push(engine);
    const conversation=store.createConversation({title:'准备报错',settings:{mainRoute:primary,fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    const candidate=store.listCandidates(group.turnId).items[0]!;
    expect(dispatched).toEqual(['backup']);
    expect(candidate.status).toBe('complete');
    expect(store.attemptsForCandidate(candidate.id).map(attempt=>attempt.status)).toEqual(['skipped','complete']);
  });
  it.each([
    {name:'AbortError',error:new DOMException('已经取消','AbortError')},
    {name:'ABORTED',error:Object.assign(new Error('已经取消'),{code:'ABORTED'})},
  ])('$name取消准备不换备用，并保留已停止状态',async({error})=>{
    const store=new ConversationStore(':memory:');stores.push(store);
    const prepared:string[]=[];
    const gateway:LlmGateway={async prepare(config){prepared.push(config.model);throw error;}};
    const engine=new ChatEngine(store,gateway,()=>[]);engines.push(engine);
    const conversation=store.createConversation({title:'取消准备',settings:{mainRoute:primary,fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(prepared).toEqual([primary.model]);
    expect(store.listCandidates(group.turnId).items[0]!.status).toBe('stopped');
  });
  it.each([
    {patterns:['匹配词'],error:{message:'返回了匹配词'},models:[primary.model,'backup']},
    {patterns:['/custom_\\d+/i'],error:{code:'CUSTOM_7',message:'站点报错'},models:[primary.model,'backup']},
    {patterns:['413'],error:{status:413,message:'请求过长'},models:[primary.model,'backup']},
    {patterns:['不要匹配'],error:{status:503,message:'service unavailable'},models:[primary.model]},
    {patterns:['error'],error:{status:503,message:'ERROR'},models:[primary.model]},
  ])('自定义匹配 $patterns 只决定是否沿既定链尝试，不改错误事实',async({patterns,error,models})=>{
    const {engine,store,conversation,calls}=setup(async function*(config){
      if(config.model===primary.model){yield {type:'finish',reason:'error',error};return;}
      yield text('备用回复');yield finish();
    });
    store.updateConversation(conversation.id,{settings:{errorPatterns:patterns,fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual(models);
    expect(store.attemptsForTurn(group.turnId)[0]!.error).toEqual(error);
    expect(store.getSnapshot(group.snapshotId).options.errorPatterns).toEqual(patterns);
  });
  it('运行组沿用已冻结的错误规则，连接设定修改只供新组使用',async()=>{
    const started=deferred(),release=deferred();
    const {engine,store,conversation,calls}=setup(async function*(config){
      if(config.model===primary.model){started.resolve();await release.promise;yield {type:'finish',reason:'error',error:{message:'暂时不可用'}};return;}
      yield text('备用回复');yield finish();
    });
    store.updateConversation(conversation.id,{settings:{errorPatterns:['暂时不可用'],fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await started.promise;
    store.updateConversation(conversation.id,{settings:{fallbackOnError:false,errorPatterns:['其他规则'],fallbacks:[]}});
    release.resolve();await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual([primary.model,'backup']);
    expect(store.getSnapshot(group.snapshotId).options.errorPatterns).toEqual(['暂时不可用']);
  });
  it('无正文的取消结束不换备用',async()=>{
    const {engine,store,conversation,calls}=setup(async function*(){yield {type:'finish',reason:'aborted',error:{code:'ABORTED',message:'玩家已停止'}};});
    store.updateConversation(conversation.id,{settings:{fallbacks:[{...primary,model:'backup'}]}});
    const group=await engine.send(conversation.id,'你好');await engine.waitForGroup(group.id);
    expect(calls.map(call=>call.config.model)).toEqual([primary.model]);
    expect(store.listCandidates(group.turnId).items[0]!.status).toBe('stopped');
  });
});

it('卸载中断并等待剧情整理，结束后不再创建备忘或发起回复',async()=>{
  const started=deferred(),resume=deferred(),cleanup=deferred();
  let summarySignal:AbortSignal|undefined;
  const {engine,store,conversation,calls}=setup(async function*(_config,_input,signal){
    summarySignal=signal;started.resolve();
    await Promise.race([resume.promise,new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}))]);
    if(signal.aborted){await cleanup.promise;yield finish('aborted');return;}
    yield text('整理的剧情');yield finish();
  });
  store.updateConversation(conversation.id,{settings:{mainRoute:{...primary,inputBudget:1200},controls:{maxTokens:128}}});
  let parent:string|undefined;
  for(let i=0;i<5;i++){
    const turn=store.createTurn(conversation.id,{input:`玩家${i}${'叙'.repeat(160)}`,parentCandidateId:parent});
    const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{}});
    const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[primary],settingsRevision:1});
    const candidate=store.createCandidate(group.id,{kind:'generated',text:`角色${i}${'事'.repeat(160)}`,status:'complete'});
    parent=candidate.id;
  }
  store.selectCandidate(parent!);
  const pending=engine.send(conversation.id,'新的问题').then(()=>undefined,error=>error as Error);
  await started.promise;
  let disposed=false;
  const disposal=engine.dispose().then(()=>{disposed=true;});
  try{
    expect(summarySignal!.aborted).toBe(true);
    await new Promise<void>(resolve=>setImmediate(resolve));
    expect(disposed).toBe(false);
    cleanup.resolve();await disposal;
    expect(await pending).toBeInstanceOf(Error);
    expect(calls).toHaveLength(1);
    expect(store.memos(conversation.id)).toHaveLength(0);
    const turn=store.listTurns(conversation.id).at(-1)!;
    expect(store.listCandidates(turn.id).total).toBe(0);
    expect(store.attemptsForTurn(turn.id).map(attempt=>attempt.status)).toEqual(['stopped']);
  }finally{resume.resolve();cleanup.resolve();await pending;await disposal;}
});

it('卸载发生在已准备组的await间隙时不会再launch候选',async()=>{
  const {engine,store,conversation,calls}=setup(async function*(){yield text('不应派发');yield finish();});
  const pending=engine.send(conversation.id,'你好').then(()=>undefined,error=>error as Error);
  await engine.dispose();
  expect(await pending).toBeInstanceOf(Error);
  expect(calls).toHaveLength(0);
  expect(store.listCandidates(store.listTurns(conversation.id)[0]!.id).total).toBe(0);
});

it('卸载等待调用准备结束，已中止的准备句柄不会派发',async()=>{
  const ready=deferred(),release=deferred();
  const store=new ConversationStore(':memory:');stores.push(store);
  let dispatched=false;
  const gateway:LlmGateway={async prepare(config){ready.resolve();await release.promise;return {config,async* stream(){dispatched=true;yield text('不应生成');yield finish();}};}};
  const engine=new ChatEngine(store,gateway,()=>[]);engines.push(engine);
  const conversation=store.createConversation({title:'准备中卸载',settings:{mainRoute:primary}});
  const group=await engine.send(conversation.id,'你好');await ready.promise;
  const disposal=engine.dispose();
  release.resolve();await disposal;await engine.waitForGroup(group.id);
  expect(dispatched).toBe(false);
  expect(store.listCandidates(group.turnId).items[0]!.status).toBe('stopped');
});
