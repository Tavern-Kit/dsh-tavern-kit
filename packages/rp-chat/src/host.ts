import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { z } from 'zod';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-client-connection';
import type {} from '@tavern-kit/rp-materials';
import type {} from '@tavern-kit/rp-connections';
import { validateErrorPatterns } from '@tavern-kit/rp-connections/routing';
import type { MaterialVersionRef, MaterialVersion } from '@tavern-kit/rp-materials/types';
import { ChatEngine } from './engine.js';
import { initializeMvu, readMvuState } from './mvu/index.js';
import type { MvuState } from './mvu/types.js';
import { isMvuEnabled, mvuBooks } from './mvu-materials.js';
import { macros } from './prompt.js';
import { ConversationStore } from './store.js';
import { dshGateway } from './gateway.js';
import { exportConversation, restoreConversation } from './backup.js';
import type { Candidate, CandidateGroup, ChatSettings, Conversation, Memo, MaterialRef } from './types.js';
import type { CandidatePage, CandidateDetail, ChatState, RoutePage, ChatChange, ImportedConversation, SourceMatch, TurnSummary, TurnUsage, CreateInput, UpdateInput, SendInput, PageInput, RouteInput, CandidateView, CandidateFailure, DisplayProjection, SearchInput, SearchHit, SearchPage, SearchPreview } from './protocol.js';
export type * from './types.js';
export type * from './protocol.js';

// Both Remote callers and JSON-bearing tools enter through these Host boundaries.
const routeInput=z.strictObject({
  provider:z.string().min(1),model:z.string().min(1),connectionId:z.string().optional(),label:z.string().optional(),group:z.string().optional(),
  inputBudget:z.number().int().positive(),contextWindow:z.number().int().positive().optional(),outputLimit:z.number().int().positive().optional(),
  parameters:z.strictObject({temperature:z.boolean().optional(),stop:z.boolean().optional(),reasoning:z.boolean().optional()}).optional(),
});
const settingsInput=z.strictObject({
  playerName:z.string().optional(),playerDescription:z.string().optional(),mainRoute:routeInput.optional(),fallbacks:z.array(routeInput).optional(),
  fallbackOn400:z.boolean().optional(),fallbackOnError:z.boolean().optional(),errorPatterns:z.array(z.string()).optional(),
  controls:z.strictObject({temperature:z.number().optional(),maxTokens:z.number().int().positive().optional(),reasoningEffort:z.string().optional(),stop:z.array(z.string()).optional()}).optional(),
  parallel:z.boolean().optional(),parallelCount:z.number().int().positive().optional(),mapEnabled:z.boolean().optional(),mvuEnabled:z.boolean().optional(),
});
const materialRefsInput=z.array(z.strictObject({id:z.string().min(1),version:z.number().int().positive()}));
const createInput=z.strictObject({title:z.string(),bindings:materialRefsInput.optional(),settings:settingsInput.optional(),greetingIndex:z.number().int().nonnegative().optional()});
const updateInput=z.strictObject({title:z.string().optional(),bindings:materialRefsInput.optional(),settings:settingsInput.optional()});
const searchInput=z.strictObject({query:z.string(),conversationId:z.string().min(1).optional(),offset:z.number().int().nonnegative().optional(),limit:z.number().int().min(0).max(100).optional()});
const searchHit=z.strictObject({conversationId:z.string().min(1),conversationTitle:z.string(),turnId:z.string().min(1),candidateId:z.string().min(1).optional(),role:z.enum(['user','assistant']),ordinal:z.number().int().positive().optional(),excerpt:z.string(),createdAt:z.number()});

export interface Config { dataDir:string }
declare module '@deepseek-ai/cordis' { interface Context { rpChat:RpChatService } }

export default class RpChatService extends TypertRemoteService {
  static inject=['typert','llm','rpMaterials','rpConnections','connection','tools'];
  static Config:Schema<Config>=Schema.object({dataDir:Schema.string().default(join(homedir(),'.dsh','tavern-kit'))});
  private readonly store:ConversationStore;
  private readonly engine:ChatEngine;
  private readonly lifetime=new AbortController();
  constructor(ctx:Context,config:Config){
    super(ctx,'rpChat',{namespace:'rpChat'});
    mkdirSync(config.dataDir,{recursive:true});
    this.store=new ConversationStore(join(config.dataDir,'conversations.sqlite'));
    this.engine=new ChatEngine(this.store,dshGateway(ctx),refs=>this.materials(refs),(route,controls)=>ctx.rpConnections.resolveCall(route,controls));
    ctx.effect(()=>async()=>{this.lifetime.abort();try{await this.engine.dispose();}finally{this.store.close();}});
    ctx.effect(()=>ctx.connection.fetch.register({path:'/api/tavern-kit/chat/backup',methods:['GET','POST'],requestBody:'streaming',fetch:async request=>{
      try{
        if(request.method==='POST'){const result=this.restore(new Uint8Array(await request.arrayBuffer()));return Response.json(result);}
        const id=new URL(request.url).searchParams.get('id');if(!id)throw new Error('请选择对话');
        const result=exportConversation(this.store,ctx.rpMaterials.library,id);
        return new Response(result.bytes as Uint8Array<ArrayBuffer>,{headers:{'content-type':'application/zip','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`}});
      }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400});}
    }}));
    ctx.effect(()=>ctx.tools.register(defineTool({name:'tavern_chat',description:'创建或阅读RP对话，搜索本地原文，发送、停止、换回复、手改、选择剧情、修订备忘。调用与界面共用的本地服务。',parameters:{action:{type:'string',enum:['list','read','search','searchPreview','create','update','send','roll','editInput','stop','stopGroup','edit','continue','select','memo','favorite','variables','initializeVariables','setVariables'],required:true},id:{type:'string',description:'variables、initializeVariables、setVariables 使用要查看或修订的候选回复 ID'},text:{type:'string'},json:{type:'string',description:'create为CreateInput、update为UpdateInput、search为SearchInput、searchPreview为SearchHit的JSON；使用公开字段'},parentCandidateId:{type:'string'},favorite:{type:'boolean'},locked:{type:'array',items:{type:'string'}}},output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},execute:async args=>{
      if(args.action==='list')return JSON.stringify(this.list());
      if(args.action==='search')return JSON.stringify(this.search(searchInput.parse(args.json===undefined?{query:args.text??'',conversationId:args.id}:JSON.parse(args.json) as unknown)));
      if(args.action==='searchPreview'){if(args.json===undefined)throw new Error('请选择搜索结果');return JSON.stringify(this.searchPreview(searchHit.parse(JSON.parse(args.json) as unknown)));}
      if(args.action==='create')return JSON.stringify(await this.create(createInput.parse(args.json===undefined?{title:args.text??'新的对话'}:JSON.parse(args.json) as unknown)));
      if(!args.id)throw new Error('请选择对话或回复');
      switch(args.action){
        case'read':return JSON.stringify(this.state(args.id));
        case'update':if(args.json===undefined)throw new Error('请提供要修改的对话设置JSON');return JSON.stringify(await this.update(args.id,updateInput.parse(JSON.parse(args.json) as unknown)));
        case'send':return JSON.stringify(await this.send({conversationId:args.id,input:args.text??'',parentCandidateId:args.parentCandidateId}));
        case'editInput':return JSON.stringify(await this.editInput(args.id,args.text??''));
        case'stopGroup':this.stopGroup(args.id);return '已停止这组回复';
        case'roll':return JSON.stringify(await this.roll(args.id));
        case'stop':this.stopCandidate(args.id);return '已停止这条回复';
        case'edit':return JSON.stringify(this.editCandidate(args.id,args.text??''));
        case'continue':return JSON.stringify(await this.continueCandidate(args.id));
        case'select':return JSON.stringify(this.select(args.id));
        case'memo':return JSON.stringify(this.editMemo(args.id,args.text??'',args.locked??[]));
        case'favorite':return JSON.stringify(this.favorite(args.id,args.favorite??true));
        case'variables':return JSON.stringify(this.previewCandidate(args.id).candidate.mvu??null);
        case'initializeVariables':return JSON.stringify(this.initializeVariables(args.id));
        case'setVariables':if(args.json===undefined)throw new Error('请填写变量 JSON');return JSON.stringify(this.setVariables(args.id,readMvuState(JSON.parse(args.json) as unknown)));
        default:throw new Error('请选择操作');
      }
    }})));
  }
  private materials(refs:MaterialRef[]):MaterialVersion[]{
    const seen=new Set<string>(),result:MaterialVersion[]=[];
    const add=(ref:MaterialRef):void=>{const key=`${ref.id}@${ref.version}`;if(seen.has(key))return;seen.add(key);const value=this.ctx.rpMaterials.readVersion(ref);result.push(value);for(const book of value.bindings.worldbooks)add(book);if(value.bindings.preset)add(value.bindings.preset);};
    refs.forEach(add);
    const presets=result.filter(value=>value.projection.preset!==null);
    const directPresets=presets.filter(value=>refs.some(ref=>ref.id===value.id&&ref.version===value.version));
    if(directPresets.length>1)throw new Error('这段对话请选择一份预设');
    // Resolve once for both prompt assembly and sampling, without changing stored bindings.
    const effectivePreset=directPresets[0]??presets[0];
    return result.filter(value=>value.projection.preset===null||value===effectivePreset);
  }
  private initialVariables(materials:MaterialVersion[],settings:ChatSettings,greeting?:string){
    const character=materials.find(material=>material.projection.character)?.projection.character;
    const context={char:character?.name||'角色',user:settings.playerName||'我',description:character?.description,personality:character?.personality,scenario:character?.scenario,persona:settings.playerDescription};
    return initializeMvu(mvuBooks(materials),greeting,undefined,text=>macros(text,context));
  }
  private persona(materials:MaterialVersion[]):MaterialVersion|undefined{
    const personas=materials.filter(material=>material.projection.kind==='persona');
    if(personas.length>1)throw new Error('这段对话请选择一套玩家人设');
    return personas[0];
  }
  private personaSettings(settings:Partial<ChatSettings>|undefined,persona:MaterialVersion|undefined):Partial<ChatSettings>{
    const projection=persona?.projection.persona;
    return projection?{...settings,playerName:settings?.playerName??projection.name,playerDescription:settings?.playerDescription??projection.description}:{...settings};
  }
  private displayProjection(candidate:Candidate,depth:number,input:string,effectiveText:string):DisplayProjection{
    let source=candidate;const seen=new Set<string>();
    while(source.sourceCandidateId){
      if(seen.has(source.id))throw new Error('回复来源存在循环');
      seen.add(source.id);source=this.store.getCandidate(source.sourceCandidateId);
    }
    const snapshot=this.store.getSnapshot(this.store.getGroup(source.groupId).snapshotId);
    const materials=this.materials(snapshot.bindings),character=materials.find(material=>material.projection.character)?.projection.character;
    const persona=materials.find(material=>material.projection.kind==='persona');
    return {depth,...(candidate.mvu?{variables:candidate.mvu.state}:{}),...(this.store.getSnapshot(this.store.getGroup(candidate.groupId).snapshotId).mvu?{inputVariables:this.store.getSnapshot(this.store.getGroup(candidate.groupId).snapshotId).mvu!.read}:{}),...(input!==''?{inputDepth:depth+(effectiveText!==''?1:0)}:{}),...(persona?{playerRef:{id:persona.id,version:persona.version}}:{}),rules:materials.flatMap(material=>material.projection.regex),context:{
      char:character?.name||'角色',user:snapshot.options.playerName||'我',
      description:character?.description,personality:character?.personality,scenario:character?.scenario,persona:snapshot.options.playerDescription,
    }};
  }
  @Remote list():Conversation[]{return this.store.listConversations();}
  @Remote search(input:SearchInput):SearchPage{return this.store.search(searchInput.parse(input));}
  @Remote searchPreview(hit:SearchHit):SearchPreview{return this.store.searchPreview(searchHit.parse(hit));}
  @Remote async create(input:CreateInput):Promise<Conversation>{
    input=createInput.parse(input);
    if(input.settings?.errorPatterns)validateErrorPatterns(input.settings.errorPatterns);
    const materials=this.materials(input.bindings??[]),settings=this.personaSettings(input.settings,this.persona(materials));
    const conversation=this.store.createConversation({title:input.title,bindings:input.bindings,settings});
    const character=materials.find(m=>m.projection.character)?.projection.character;
    if(character){const greetings=[character.firstMessage,...character.alternateGreetings],text=greetings[input.greetingIndex??0];if(text){
      const turn=this.store.createTurn(conversation.id,{input:''}),snapshot=this.store.createSnapshot(conversation.id,{system:'',messages:[],bindings:conversation.bindings,options:{kind:'greeting',playerName:conversation.settings.playerName,playerDescription:conversation.settings.playerDescription}});
      const group=this.store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:conversation.settingsRevision});
      const initialized=isMvuEnabled(materials,conversation.settings.mvuEnabled,text)?this.initialVariables(materials,conversation.settings,text):undefined;
       const candidate=this.store.createCandidate(group.id,{kind:'generated',text,status:'complete',...(initialized?{mvu:{state:initialized.state,issues:initialized.issues,kind:'computed'}}:{})});this.store.selectCandidate(candidate.id);
    }}
    if(input.settings?.mainRoute)await this.update(conversation.id,{settings:input.settings});
    return this.store.getConversation(conversation.id);
  }
  @Remote async update(id:string,input:UpdateInput):Promise<Conversation>{
    input=updateInput.parse(input);
    const current=this.store.getConversation(id);
    const selected=input.bindings?this.persona(this.materials(input.bindings)):undefined;
    const previous=input.bindings?this.persona(this.materials(current.bindings)):undefined;
    const changed=selected&&(selected.id!==previous?.id||selected.version!==previous?.version);
    const settings=changed?this.personaSettings(input.settings,selected):{...input.settings};
    if(settings.errorPatterns)validateErrorPatterns(settings.errorPatterns);
    if(settings.parallelCount!==undefined&&(!Number.isSafeInteger(settings.parallelCount)||settings.parallelCount<1))throw new Error('同时生成的数量需为正整数');
    if(settings.mainRoute)settings.mainRoute=await this.ctx.rpConnections.resolveRoute(settings.mainRoute);
    if(settings.fallbacks)settings.fallbacks=await Promise.all(settings.fallbacks.map(route=>this.ctx.rpConnections.resolveRoute(route)));
    return this.store.updateConversation(id,{...input,settings});
  }
  @Remote state(id:string):ChatState{
    const conversation=this.store.getConversation(id),pending=this.store.pendingCandidates(id);
    return {conversation,route:this.route({conversationId:id}),pending,memo:this.store.applicableMemo(id)};
  }
  @Remote route(input:RouteInput):RoutePage{
    const page=this.store.routePage(input.conversationId,input.offset,input.limit);
    return {total:page.total,items:page.items.map(({turn,candidate,depth})=>({turn,candidate,text:candidate.text,display:this.displayProjection(candidate,depth,turn.input,candidate.text)}))};
  }
  @Remote candidates(input:PageInput):CandidatePage{return this.store.listCandidates(input.turnId,input);}
  @Remote previewCandidate(id:string):CandidateView{
    const candidate=this.store.getCandidate(id),turn=this.store.getTurn(candidate.turnId),text=this.store.candidateText(id),failures:CandidateFailure[]=[];
    for(const attempt of this.store.attemptsForCandidate(id)){
      if((attempt.status!=='failed'&&attempt.status!=='skipped')||!attempt.error)continue;
      failures.push({attemptId:attempt.id,provider:attempt.config.provider,model:attempt.config.model,status:attempt.status,message:attempt.error.message,
        ...(attempt.route?.label!==undefined?{label:attempt.route.label}:{}),...(attempt.route?.group!==undefined?{group:attempt.route.group}:{}),
        ...(attempt.error.code!==undefined?{code:attempt.error.code}:{}),...(attempt.error.status!==undefined?{httpStatus:attempt.error.status}:{}),
      });
    }
    return {candidate,text,route:this.store.actualRoute(id),display:this.displayProjection(candidate,this.store.candidateDisplayDepth(id),turn.input,text),...(failures.length?{failures}:{})};
  }
  @Remote candidate(id:string):CandidateDetail{
    const candidate=this.store.getCandidate(id),group=this.store.getGroup(candidate.groupId),snapshot=this.store.getSnapshot(group.snapshotId);
    return {candidate,text:this.store.candidateText(id),attempts:this.store.attemptsForCandidate(id),snapshot,input:this.store.inputForSnapshot(snapshot.id),materials:this.materials(snapshot.bindings)};
  }
  @Remote usage(turnId:string):TurnUsage{const attempts=this.store.attemptsForTurn(turnId);return {...this.store.usageForTurn(turnId),summaryRequests:attempts.filter(a=>a.kind==='summary'&&a.status!=='skipped').length,continuationRequests:attempts.filter(a=>a.kind==='continuation'&&a.status!=='skipped').length};}
  @Remote async send(input:SendInput):Promise<CandidateGroup>{return this.engine.send(input.conversationId,input.input,input.parentCandidateId);}
  @Remote async roll(turnId:string):Promise<CandidateGroup>{return this.engine.roll(turnId);}
  @Remote async editInput(turnId:string,input:string):Promise<CandidateGroup>{return this.engine.editInput(turnId,input);}
  @Remote editCandidate(id:string,text:string):Candidate{return this.engine.editCandidate(id,text);}
  @Remote async continueCandidate(id:string):Promise<CandidateGroup>{return this.engine.continueCandidate(id);}
  @Remote select(id:string):Conversation{this.engine.select(id);return this.store.getConversation(this.store.getCandidate(id).conversationId);}
  /** Initialize only the explicit candidate; reading another reply never selects it. */
  @Remote initializeVariables(id:string):Conversation{
    const candidate=this.store.getCandidate(id),conversation=this.store.getConversation(candidate.conversationId);
    if(candidate.status==='pending'||candidate.status==='streaming')throw new Error('先等这条写完，再初始化变量');
    if(!candidate.mvu){const result=this.initialVariables(this.materials(conversation.bindings),conversation.settings);this.store.setCandidateMvu(candidate.id,{state:result.state,issues:result.issues,kind:'manual'});}
    return this.store.updateConversation(conversation.id,{settings:{mvuEnabled:true}});
  }
  @Remote setVariables(id:string,value:MvuState):Candidate{
    const candidate=this.store.getCandidate(id);
    if(candidate.status==='pending'||candidate.status==='streaming')throw new Error('先等这条写完，再修改变量');
    const json=z.json().parse(value);
    if(json===null||typeof json!=='object'||Array.isArray(json)||json.stat_data===null||typeof json.stat_data!=='object'||Array.isArray(json.stat_data))throw new Error('stat_data 需要是变量对象');
    const state=readMvuState(json),old=candidate.mvu;
    const changed=this.store.setCandidateMvu(id,{state,issues:[],kind:'manual',revisions:[...(old?.revisions??[]),...(old?[{state:old.state,at:Date.now()}]:[])]});
    this.store.updateConversation(candidate.conversationId,{});return changed;
  }
  @Remote favorite(id:string,favorite:boolean):Candidate{return this.store.setFavorite(id,favorite);}
  @Remote stopCandidate(id:string):void{this.engine.stopCandidate(id);}
  @Remote stopGroup(id:string):void{this.engine.stopGroup(id);}
  @Remote memos(id:string):Memo[]{return this.store.memos(id);}
  @Remote editMemo(id:string,content:string,locked:string[]):Memo{return this.engine.editMemo(id,content,locked);}
  @Remote graph(id:string):TurnSummary[]{
    return this.store.turnSummaries(id);
  }
  @Remote({mode:'stream'}) async *watch(id:string,signal:AbortSignal):AsyncIterable<ChatChange>{
    const watchSignal=AbortSignal.any([signal,this.lifetime.signal]);
    if(watchSignal.aborted)return;
    const queue:ChatChange[]=[{conversationId:id,type:'route'}];let wake:(()=>void)|undefined;
    const stop=this.engine.subscribe(id,event=>{queue.push(event);wake?.();});
    const abort=():void=>{wake?.();};watchSignal.addEventListener('abort',abort,{once:true});
    try{while(!watchSignal.aborted){if(queue.length){yield queue.shift()!;continue;}await new Promise<void>(resolve=>{wake=resolve;});wake=undefined;}}
    finally{stop();watchSignal.removeEventListener('abort',abort);}
  }
  sourceMatches(sourceId:string):SourceMatch[]{return this.store.findSource(sourceId).map(row=>({id:row.id,sourceId,fingerprint:row.source!.fingerprint??''}));}
  importHistory(row:ImportedConversation,original:{name:string;bytes:Uint8Array}):string{
    return this.store.transaction(()=>{
      const archiveId=this.store.saveArchive(original.name,original.bytes);
      const kind=row.kind??'deepseek-chat-export';
      const conversation=this.store.createConversation({title:row.title,source:{kind,id:row.sourceId,fingerprint:row.fingerprint,archiveId,messageCount:row.messageCount,omittedTurns:row.omittedTurns,failedReplies:row.failedReplies}});
      let parentCandidateId:string|undefined;const history:{role:'user'|'assistant';content:string}[]=[];
      for(const imported of row.turns){
        const replies=imported.replies??[imported],selectedIndex=imported.selectedReplyIndex??0,selected=replies[selectedIndex];
        if(!selected)throw new Error('迁入记录的选中回复不存在');
        const turn=this.store.createTurn(conversation.id,{input:imported.input,parentCandidateId});
        const messages=[...history];if(imported.input!=='')messages.push({role:'user',content:imported.input});
        const snapshot=this.store.createSnapshot(conversation.id,{system:'',messages,bindings:[],options:{kind:'import'},boundaryCandidateId:parentCandidateId});
        const group=this.store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:conversation.settingsRevision});
        const candidates=replies.map(reply=>{
          const status=reply.status==='failed'?'failed':reply.status==='empty'||reply.reply===''?'empty':'complete';
          return this.store.createCandidate(group.id,{kind:'generated',text:reply.reply,status:status==='failed'?'failed':'complete',imported:{reasoning:reply.reasoning,error:reply.error,status},...(reply.mvu?{mvu:{state:readMvuState(reply.mvu),issues:[],kind:'imported'}}:{})});
        });
        const candidate=candidates[selectedIndex]!;
        // ST has an explicit selected swipe, including partial replies and input-only route anchors.
        // DeepSeek's excluded failure/empty states remain saved outside its active history.
        if(kind==='sillytavern-jsonl'||candidate.imported?.status==='complete'){
          this.store.selectCandidate(candidate.id);parentCandidateId=candidate.id;
          if(imported.input!=='')history.push({role:'user',content:imported.input});
          if(selected.reply!=='')history.push({role:'assistant',content:selected.reply});
        }
      }
      return conversation.id;
    });
  }
  restore(bytes:Uint8Array):Conversation{return restoreConversation(this.store,this.ctx.rpMaterials.library,bytes);}
}
