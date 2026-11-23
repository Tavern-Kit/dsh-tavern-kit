import { describe, it, expect } from 'vitest';
import { MaterialsLibrary } from '../../rp-materials/src/store.js';
import { ConversationStore } from './store.js';
import { exportConversation, restoreConversation } from './backup.js';
import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';

it('takes every branch, source, old material, memo and usage offline without credentials', () => {
  const materials = new MaterialsLibrary(':memory:'), store = new ConversationStore(':memory:');
  const card = materials.import({name:'card.json',bytes:strToU8(JSON.stringify({name:'阿岛',description:'带有未知字段',x_secret_lore:'不丢'}))});
  const ref={id:card.id,version:card.currentVersion};
  const archiveId=store.saveArchive('deepseek.zip',strToU8('original'));
  const c=store.createConversation({title:'海边',bindings:[ref],source:{kind:'deepseek',id:'old',fingerprint:'source-hash',archiveId},settings:{mainRoute:{provider:'private',model:'[薄甲]DeepSeek',inputBudget:16000},fallbacks:[],fallbackOnError:false,errorPatterns:['quota']}});
  const turn=store.createTurn(c.id,{input:'约好了'});
  const options={controls:{maxTokens:4096},fallbackOnError:false,errorPatterns:['quota'],apiKey:'should-never-export'};
  const snap=store.createSnapshot(c.id,{system:'角色阿岛',messages:[{role:'user',content:'约好了'}],bindings:[ref],options,sources:[]});
  const group=store.createGroup(turn.id,{snapshotId:snap.id,routes:[{provider:'private',model:'[薄甲]DeepSeek',inputBudget:16000}],settingsRevision:1});
  const first=store.createCandidate(group.id,{kind:'generated',text:'原话',status:'complete'});
  const edited=store.editCandidate(first.id,'改称呼'); store.setFavorite(edited.id,true); store.selectCandidate(edited.id);
  const automatic={kind:'automatic' as const,sourceCandidateId:edited.id,basedOnCandidateId:edited.id,content:'约好看海',locked:['称呼小岛长']};
  const memo=store.saveMemo(c.id,automatic);
  const manual={kind:'manual' as const,anchorTurnId:turn.id,sourceCandidateId:edited.id,basedOnCandidateId:edited.id,previousId:memo.id,content:'现在在海边',locked:['称呼小岛长']};
  const manualMemo=store.saveMemo(c.id,manual);
  store.saveMemo(c.id,{kind:'automatic',anchorTurnId:turn.id,sourceCandidateId:edited.id,basedOnCandidateId:edited.id,previousId:manualMemo.id,content:'带着已确认称呼的整理稿',locked:['称呼小岛长']});
  const attempt=store.createAttempt({turnId:turn.id,candidateId:first.id,snapshotId:snap.id,kind:'reply',config:{provider:'private',model:'[薄甲]DeepSeek',maxTokens:4096}});
  store.finishAttempt(attempt.id,{status:'complete',usage:{inputTokens:5,outputTokens:2,cacheWriteTokens:3,totalTokens:10}});
  materials.revise(card.id,{patch:{description:'改了以后'}}); materials.delete(card.id);
  const backup=exportConversation(store,materials,c.id);
  const files=unzipSync(backup.bytes); expect(strFromU8(files['conversation.json']!)).not.toContain('should-never-export');
  const nextMaterials=new MaterialsLibrary(':memory:'), next=new ConversationStore(':memory:');
  const restored=restoreConversation(next,nextMaterials,backup.bytes);
  expect(restored.settings.fallbackOnError).toBe(false); expect(restored.settings.errorPatterns).toEqual(['quota']);
  const restoredSnapshot=next.getSnapshot(next.getGroup(next.getCandidate(restored.currentCandidateId!).groupId).snapshotId);
  expect(restoredSnapshot.options.fallbackOnError).toBe(false); expect(restoredSnapshot.options.errorPatterns).toEqual(['quota']);
  const restoredAttempt=next.attemptsForTurn(next.listTurns(restored.id)[0]!.id)[0]!;
  expect(restoredAttempt.usage).toMatchObject({cacheWriteTokens:3,totalTokens:10});
  expect(restored.id).not.toBe(c.id); expect(restored.settings.mainRoute).toBeUndefined();
  expect(next.route(restored.id)[0]?.candidate.text).toBe('改称呼');
  expect(next.listCandidates(next.listTurns(restored.id)[0]!.id,{limit:20}).total).toBe(2);
  expect(next.getCandidate(restored.currentCandidateId!).favorite).toBe(true);
  expect(next.memos(restored.id)).toHaveLength(3); expect(next.readArchive(restored.source!.archiveId!).bytes).toEqual(strToU8('original'));
  const restoredTurn=next.listTurns(restored.id)[0]!;
  expect(next.memos(restored.id)[0]).toMatchObject({kind:'automatic',sourceCandidateId:restored.currentCandidateId,basedOnCandidateId:restored.currentCandidateId});
  expect(next.memos(restored.id)[1]).toMatchObject({kind:'manual',anchorTurnId:restoredTurn.id,sourceCandidateId:restored.currentCandidateId,basedOnCandidateId:restored.currentCandidateId});
  expect(next.memos(restored.id)[2]).toMatchObject({kind:'automatic',anchorTurnId:restoredTurn.id,sourceCandidateId:restored.currentCandidateId,basedOnCandidateId:restored.currentCandidateId,previousId:next.memos(restored.id)[1]!.id});
  expect(restoredTurn.id).not.toBe(turn.id);
  expect(nextMaterials.readVersion(restored.bindings[0]!).projection.character?.description).toBe('带有未知字段');
  expect(nextMaterials.exportOriginal(restored.bindings[0]!.id).bytes).toEqual(materials.exportOriginal(card.id).bytes);
  for(const item of [store,next,materials,nextMaterials]) item.close();
});

describe('restore validates before inserting', () => {
  it('rejects a missing manual memo turn anchor before restoring',()=>{
    const materials=new MaterialsLibrary(':memory:'),source=new ConversationStore(':memory:'),target=new ConversationStore(':memory:');
    try {
      const conversation=source.createConversation({title:'备忘锚点'});
      source.saveMemo(conversation.id,{content:'手工确认的称呼',locked:[]});
      const files=unzipSync(exportConversation(source,materials,conversation.id).bytes);
      const data=JSON.parse(strFromU8(files['conversation.json']!)) as {memos:{kind?:string;anchorTurnId?:string}[]};
      data.memos[0]!.kind='manual';data.memos[0]!.anchorTurnId='missing-turn';
      files['conversation.json']=strToU8(JSON.stringify(data));
      expect(()=>restoreConversation(target,materials,zipSync(files))).toThrow('引用');
      expect(target.listConversations()).toEqual([]);
    } finally {source.close();target.close();materials.close();}
  });
  it.each(['settings', 'snapshot'] as const)('rejects an invalid %s error matcher before restoring', location => {
    const materials = new MaterialsLibrary(':memory:'), source = new ConversationStore(':memory:'), target = new ConversationStore(':memory:');
    try {
      const conversation = source.createConversation({title:'带回海边',settings:{errorPatterns:['quota']}});
      source.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{errorPatterns:['quota']},sources:[]});
      const files = unzipSync(exportConversation(source,materials,conversation.id).bytes);
      const data = JSON.parse(strFromU8(files['conversation.json']!)) as {conversation:{settings:{errorPatterns:string[]}};snapshots:{options:{errorPatterns:string[]}}[]};
      if(location === 'settings') data.conversation.settings.errorPatterns=['/[/'];
      else data.snapshots[0]!.options.errorPatterns=['/[/'];
      files['conversation.json']=strToU8(JSON.stringify(data));
      expect(()=>restoreConversation(target,materials,zipSync(files))).toThrow('报错正则');
      expect(target.listConversations()).toHaveLength(0);
    } finally { source.close();target.close();materials.close(); }
  });
  it('rejects broken candidate references without leaving a half conversation', () => {
    const m=new MaterialsLibrary(':memory:'), s=new ConversationStore(':memory:'); const c=s.createConversation({title:'a'});
    const backup=exportConversation(s,m,c.id), files=unzipSync(backup.bytes);
    const parsed=JSON.parse(strFromU8(files['conversation.json']!)) as {conversation:{currentCandidateId?:string}}; parsed.conversation.currentCandidateId='missing';
    files['conversation.json']=strToU8(JSON.stringify(parsed));
    const target=new ConversationStore(':memory:');
    expect(()=>restoreConversation(target,m,zipSync(files))).toThrow('引用'); expect(target.listConversations()).toHaveLength(0);
    s.close();m.close();target.close();
  });
});

describe('imported source preservation', () => {
  it('persists complete, failed and empty import sources without inventing model requests', () => {
    const store=new ConversationStore(':memory:');
    try {
      const source={kind:'deepseek-chat-export',id:'legacy',messageCount:8,omittedTurns:1,failedReplies:2};
      const conversation=store.createConversation({title:'接回海边',source});
      const rows=[
        {input:'还记得约定吗',text:'一起看海。',status:'complete' as const,imported:{status:'complete' as const,reasoning:'想起海边的约定'}},
        {input:'没生成完',text:'',status:'failed' as const,imported:{status:'failed' as const,reasoning:'中断前的思考',error:'原导出没有完整回复'}},
        {input:'只有思考',text:'',status:'complete' as const,imported:{status:'empty' as const,reasoning:'只保留了思考',error:''}},
      ];
      const ids:string[]=[];
      for(const row of rows){
        const turn=store.createTurn(conversation.id,{input:row.input});
        const snapshot=store.createSnapshot(conversation.id,{system:'',messages:[{role:'user',content:row.input}],bindings:[],options:{kind:'import'}});
        const group=store.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:1});
        const options={kind:'generated' as const,text:row.text,status:row.status,imported:row.imported};
        ids.push(store.createCandidate(group.id,options).id);
        expect(store.usageForTurn(turn.id)).toEqual({requestCount:0,knownRequestCount:0,inputTokens:0,outputTokens:0,cachedInputTokens:0,unknownRequests:0});
      }
      expect(ids.map(id=>store.getCandidate(id))).toMatchObject([
        {text:'一起看海。',status:'complete',imported:{status:'complete',reasoning:'想起海边的约定'}},
        {text:'',status:'failed',imported:{status:'failed',reasoning:'中断前的思考',error:'原导出没有完整回复'}},
        {text:'',status:'complete',imported:{status:'empty',reasoning:'只保留了思考',error:''}},
      ]);
      expect(store.getConversation(conversation.id).source).toEqual({kind:'deepseek-chat-export',id:'legacy',messageCount:8,omittedTurns:1,failedReplies:2});
      expect(store.pendingCandidates(conversation.id)).toEqual([]);
      expect(store.exportData(conversation.id).attempts).toEqual([]);
      expect(ids.map(id=>store.actualRoute(id))).toEqual([undefined,undefined,undefined]);
    } finally {store.close();}
  });

  it('carries imported reasoning, errors, empty status and real counts through an offline backup and restore', () => {
    const materials=new MaterialsLibrary(':memory:'),source=new ConversationStore(':memory:'),target=new ConversationStore(':memory:'),nextMaterials=new MaterialsLibrary(':memory:');
    try {
      const original=zipSync({'manifest.json':strToU8('{"export_format_version":3}')});
      const archiveId=source.saveArchive('deepseek-original.zip',original);
      const provenance={kind:'deepseek-chat-export',id:'legacy',fingerprint:'unchanged-source',archiveId,messageCount:8,omittedTurns:1,failedReplies:2};
      const conversation=source.createConversation({title:'原来的约定',source:provenance});
      const turn=source.createTurn(conversation.id,{input:'原输入'});
      const snapshot=source.createSnapshot(conversation.id,{system:'',messages:[{role:'user',content:'原输入'}],bindings:[],options:{kind:'import'}});
      const group=source.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:1});
      for(const row of [{text:'原回复',status:'complete' as const},{text:'',status:'failed' as const},{text:'',status:'complete' as const}]) source.createCandidate(group.id,{kind:'generated',...row});
      const data=source.exportData(conversation.id);
      // Seed an already imported repository independently of createCandidate's input path.
      const metadata=[{status:'complete' as const,reasoning:'原思考'},{status:'failed' as const,reasoning:'未完成思考',error:'原失败原因'},{status:'empty' as const,reasoning:'',error:''}];
      const imported=source.importData({...data,candidates:data.candidates.map((candidate,index)=>({...candidate,imported:metadata[index]}))});
      const backup=exportConversation(source,materials,imported.id);
      const restored=restoreConversation(target,nextMaterials,backup.bytes);
      expect(restored.source).toMatchObject({kind:'deepseek-chat-export',id:'legacy',fingerprint:'unchanged-source',messageCount:8,omittedTurns:1,failedReplies:2});
      expect(target.readArchive(restored.source!.archiveId!)).toEqual({name:'deepseek-original.zip',bytes:original});
      const restoredTurn=target.listTurns(restored.id)[0]!;
      expect(target.listCandidates(restoredTurn.id).items).toMatchObject([
        {text:'原回复',status:'complete',imported:{status:'complete',reasoning:'原思考'}},
        {text:'',status:'failed',imported:{status:'failed',reasoning:'未完成思考',error:'原失败原因'}},
        {text:'',status:'complete',imported:{status:'empty',reasoning:'',error:''}},
      ]);
      expect(target.exportData(restored.id).attempts).toEqual([]);
      expect(target.usageForTurn(restoredTurn.id).requestCount).toBe(0);
      const exportedAgain=unzipSync(exportConversation(target,nextMaterials,restored.id).bytes);
      const restoredData=JSON.parse(strFromU8(exportedAgain['conversation.json']!)) as {conversation:{source:unknown};candidates:unknown[]};
      expect(restoredData.conversation.source).toMatchObject({messageCount:8,omittedTurns:1,failedReplies:2});
      expect(restoredData.candidates[1]).toMatchObject({imported:{status:'failed',reasoning:'未完成思考',error:'原失败原因'}});
    } finally {source.close();target.close();materials.close();nextMaterials.close();}
  });

  it.each([
    {name:'in-progress import status',candidate:{status:'streaming'}},
    {name:'non-text imported reasoning',candidate:{status:'complete',reasoning:42}},
    {name:'non-text imported error',candidate:{status:'failed',error:{message:'not text'}}},
    {name:'negative message count',source:{messageCount:-1}},
    {name:'fractional omitted count',source:{omittedTurns:0.5}},
    {name:'negative failed count',source:{failedReplies:-2}},
  ])('rejects $name before restoring a conversation', row => {
    const materials=new MaterialsLibrary(':memory:'),source=new ConversationStore(':memory:'),target=new ConversationStore(':memory:');
    try {
      const conversation=source.createConversation({title:'来源校验'});
      const turn=source.createTurn(conversation.id,{input:'原输入'});
      const snapshot=source.createSnapshot(conversation.id,{system:'',messages:[],bindings:[],options:{kind:'import'}});
      const group=source.createGroup(turn.id,{snapshotId:snapshot.id,routes:[],settingsRevision:1});
      source.createCandidate(group.id,{kind:'generated',text:'原回复',status:'complete'});
      const files=unzipSync(exportConversation(source,materials,conversation.id).bytes);
      const data=JSON.parse(strFromU8(files['conversation.json']!)) as {conversation:{source?:{kind:string;messageCount?:number;omittedTurns?:number;failedReplies?:number}};candidates:{imported?:unknown}[]};
      if(row.candidate)data.candidates[0]!.imported=row.candidate;
      if(row.source)data.conversation.source={kind:'deepseek-chat-export',...row.source};
      files['conversation.json']=strToU8(JSON.stringify(data));
      expect(()=>restoreConversation(target,materials,zipSync(files))).toThrow();
      expect(target.listConversations()).toEqual([]);
    } finally {source.close();target.close();materials.close();}
  });
});
