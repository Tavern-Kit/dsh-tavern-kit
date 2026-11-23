import { createHash } from 'node:crypto';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { z } from 'zod';
import type { MaterialsLibrary } from '@tavern-kit/rp-materials/library';
import type { MaterialVersionRef } from '@tavern-kit/rp-materials/types';
import type { Conversation, ConversationData } from './types.js';
import { validateErrorPatterns } from '@tavern-kit/rp-connections/routing';
import { ConversationStore } from './store.js';

const id=z.string().min(1), optionalId=id.optional(), num=z.number().finite(), role=z.enum(['system','user','assistant']);
const ref=z.object({id,version:z.number().int().positive()});
const controls=z.object({temperature:num.optional(),maxTokens:num.positive().optional(),reasoningEffort:z.string().optional(),stop:z.array(z.string()).optional()});
const route=z.object({provider:id,model:id,connectionId:optionalId,label:z.string().optional(),group:z.string().optional(),inputBudget:num.nonnegative(),contextWindow:num.positive().optional(),outputLimit:num.positive().optional(),parameters:z.object({temperature:z.boolean().optional(),stop:z.boolean().optional(),reasoning:z.boolean().optional()}).optional()});
const config=controls.extend({provider:id,model:id});
const status=z.enum(['pending','streaming','complete','stopped','failed']);
const base={id,conversationId:id,createdAt:num};
const jsonValue=z.json(), jsonObject=z.record(z.string(),jsonValue);
const mvuState=z.object({stat_data:jsonObject,schema:jsonObject,initialized_lorebooks:jsonObject,display_data:jsonObject,delta_data:jsonObject}).catchall(jsonValue);
const mvuIssue=z.object({code:z.string(),message:z.string(),source:z.string().optional(),offset:num.optional()});
const candidateMvu=z.object({state:mvuState,issues:z.array(mvuIssue),kind:z.enum(['computed','imported','manual']),revisions:z.array(z.object({state:mvuState,at:num})).optional()});
const snapshotMvu=z.object({before:mvuState,read:mvuState,templateInputId:id,issues:z.array(mvuIssue),prompt:z.object({input:z.string(),memo:z.object({content:z.string(),locked:z.array(z.string())}).optional(),inputBudget:num.nonnegative(),triggeredLore:z.array(z.string())}).optional()});
const schema=z.object({
  conversation:z.object({id,title:z.string(),createdAt:num,updatedAt:num,bindings:z.array(ref),settingsRevision:num,
    currentCandidateId:optionalId,source:z.object({kind:id,id:optionalId,fingerprint:z.string().optional(),archiveId:optionalId,messageCount:num.int().nonnegative().optional(),omittedTurns:num.int().nonnegative().optional(),failedReplies:num.int().nonnegative().optional()}).optional(),
    settings:z.object({playerName:z.string(),playerDescription:z.string(),mainRoute:route.optional(),fallbacks:z.array(route),fallbackOn400:z.boolean(),fallbackOnError:z.boolean().optional(),errorPatterns:z.array(z.string()).optional(),controls,parallel:z.boolean(),parallelCount:z.number().int().positive(),mapEnabled:z.boolean(),mvuEnabled:z.boolean().optional()})}),
  turns:z.array(z.object({...base,parentCandidateId:optionalId,input:z.string()})),
  groups:z.array(z.object({...base,turnId:id,snapshotId:id,routes:z.array(route),settingsRevision:num,sourceCandidateId:optionalId,continuationPrefix:z.string().optional()})),
  candidates:z.array(z.object({...base,turnId:id,groupId:id,ordinal:num,kind:z.enum(['generated','edited','continuation']),sourceCandidateId:optionalId,text:z.string(),status,favorite:z.boolean(),imported:z.object({reasoning:z.string().optional(),error:z.string().optional(),status:z.enum(['complete','failed','empty'])}).optional(),mvu:candidateMvu.optional()})),
  snapshots:z.array(z.object({...base,inputId:id,boundaryCandidateId:optionalId,bindings:z.array(ref),memoId:optionalId,
    options:z.object({playerName:z.string().optional(),playerDescription:z.string().optional(),controls:controls.optional(),fallbackOn400:z.boolean().optional(),fallbackOnError:z.boolean().optional(),errorPatterns:z.array(z.string()).optional(),estimatedTokens:num.optional(),inputBudget:num.optional(),continuationOf:optionalId,kind:z.string().optional()}),sources:z.array(z.object({label:z.string(),text:z.string()})),mvu:snapshotMvu.optional()})),
  attempts:z.array(z.object({...base,turnId:id,candidateId:optionalId,snapshotId:id,kind:z.enum(['reply','continuation','summary']),config,route:route.optional(),status:z.enum(['pending','streaming','complete','stopped','failed','skipped']),output:z.string(),reasoning:z.string(),finishReason:z.string().optional(),error:z.object({code:z.string().optional(),status:num.optional(),message:z.string()}).optional(),usage:z.object({inputTokens:num.optional(),outputTokens:num.optional(),cachedInputTokens:num.optional(),cacheWriteTokens:num.optional(),totalTokens:num.optional(),reasoningTokens:num.optional(),cost:num.optional(),currency:z.string().optional()}).optional(),endedAt:num.optional()})),
  memos:z.array(z.object({...base,basedOnCandidateId:optionalId,sourceCandidateId:optionalId,previousId:optionalId,kind:z.enum(['manual','automatic']).optional(),anchorTurnId:optionalId,content:z.string(),locked:z.array(z.string())})),
  inputs:z.array(z.object({id,system:z.string(),head:id.nullable()})),
  messagePrefixes:z.array(z.object({id,parent:id.nullable(),role,content:z.string()})),
});
const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function checked(value:unknown): ConversationData {
  const data=schema.parse(value);
  validateErrorPatterns(data.conversation.settings.errorPatterns ?? []);
  for(const snapshot of data.snapshots) validateErrorPatterns(snapshot.options.errorPatterns ?? []);
  const sets={turns:new Set(data.turns.map(r=>r.id)),groups:new Set(data.groups.map(r=>r.id)),candidates:new Set(data.candidates.map(r=>r.id)),snapshots:new Set(data.snapshots.map(r=>r.id)),memos:new Set(data.memos.map(r=>r.id)),inputs:new Set(data.inputs.map(r=>r.id)),prefixes:new Set(data.messagePrefixes.map(r=>r.id))};
  const need=(key:string|undefined|null,set:Set<string>)=>{if(key!=null&&!set.has(key))throw new Error('备份引用不完整，请重新导出这段对话');};
  for(const rows of [data.turns,data.groups,data.candidates,data.snapshots,data.memos,data.inputs,data.messagePrefixes]) {
    if(new Set(rows.map(row=>row.id)).size!==rows.length)throw new Error('备份中出现重复引用');
  }
  for(const rows of [data.turns,data.groups,data.candidates,data.snapshots,data.attempts,data.memos]) for(const row of rows)if(row.conversationId!==data.conversation.id)throw new Error('备份引用了其他对话');
  need(data.conversation.currentCandidateId,sets.candidates);
  for(const row of data.turns)need(row.parentCandidateId,sets.candidates);
  for(const row of data.groups){need(row.turnId,sets.turns);need(row.snapshotId,sets.snapshots);need(row.sourceCandidateId,sets.candidates);}
  for(const row of data.candidates){need(row.turnId,sets.turns);need(row.groupId,sets.groups);need(row.sourceCandidateId,sets.candidates);if(data.groups.find(g=>g.id===row.groupId)?.turnId!==row.turnId)throw new Error('候选回合引用不一致');}
  for(const row of data.snapshots){need(row.inputId,sets.inputs);need(row.mvu?.templateInputId,sets.inputs);need(row.boundaryCandidateId,sets.candidates);need(row.memoId,sets.memos);need(row.options.continuationOf,sets.candidates);}
  for(const row of data.attempts){need(row.turnId,sets.turns);need(row.candidateId,sets.candidates);need(row.snapshotId,sets.snapshots);}
  for(const row of data.memos){need(row.basedOnCandidateId,sets.candidates);need(row.sourceCandidateId,sets.candidates);need(row.anchorTurnId,sets.turns);need(row.previousId,sets.memos);}
  for(const row of data.messagePrefixes){need(row.parent,sets.prefixes);if(row.id!==digest([row.parent,row.role,row.content]))throw new Error('输入前缀指纹不一致');}
  for(const row of data.inputs){need(row.head,sets.prefixes);if(row.id!==digest([row.system,row.head]))throw new Error('输入快照指纹不一致');}
  const turns=new Map(data.turns.map(t=>[t.id,t])), candidates=new Map(data.candidates.map(c=>[c.id,c]));
  for(const start of data.candidates){const seen=new Set<string>();let current:typeof start|undefined=start;while(current){if(seen.has(current.id))throw new Error('剧情引用形成循环');seen.add(current.id);const parent:string|undefined=turns.get(current.turnId)?.parentCandidateId;current=parent?candidates.get(parent):undefined;}}
  return data;
}
export function exportConversation(store:ConversationStore,materials:MaterialsLibrary,conversationId:string):{name:string;bytes:Uint8Array}{
  // Schema is also the export allowlist; unknown connection secrets never enter a file.
  const data=checked(store.exportData(conversationId));
  const refs=[...data.conversation.bindings,...data.snapshots.flatMap(s=>s.bindings)];
  const files:Record<string,Uint8Array>={
    'manifest.json':strToU8(JSON.stringify({format:'tavern-kit.conversation',version:1})),
    'conversation.json':strToU8(JSON.stringify(data)),
    'materials.json':strToU8(JSON.stringify(materials.exportBundle(refs))),
  };
  const archiveId=data.conversation.source?.archiveId;
  if(archiveId){const archive=store.readArchive(archiveId);files['source.zip']=archive.bytes;files['source.json']=strToU8(JSON.stringify({name:archive.name}));}
  return {name:`${data.conversation.title.replace(/[\\/:*?"<>|]/g,'_')}.tavern.zip`,bytes:zipSync(files)};
}
export function restoreConversation(store:ConversationStore,materials:MaterialsLibrary,bytes:Uint8Array):Conversation{
  const files=unzipSync(bytes), json=(name:string):unknown=>{const value=files[name];if(!value)throw new Error('备份内容不完整');return JSON.parse(strFromU8(value)) as unknown;};
  const manifest=z.object({format:z.literal('tavern-kit.conversation'),version:z.literal(1)}).safeParse(json('manifest.json'));
  if(!manifest.success)throw new Error('这份对话备份版本暂不支持');
  const data=checked(json('conversation.json'));
  if(data.conversation.source?.archiveId&&!files['source.zip'])throw new Error('备份缺少原始导出引用');
  const restored=materials.importBundle(json('materials.json'));
  const bindings=(refs:MaterialVersionRef[])=>refs.map(ref=>{const found=restored.references.find(row=>row.from.id===ref.id&&row.from.version===ref.version);if(!found)throw new Error('备份素材引用不完整');return found.to;});
  bindings([...data.conversation.bindings,...data.snapshots.flatMap(s=>s.bindings)]);
  data.conversation.settings.mainRoute=undefined;data.conversation.settings.fallbacks=[];
  if(data.conversation.source?.archiveId){const source=z.object({name:z.string()}).parse(json('source.json'));data.conversation.source.archiveId=store.saveArchive(source.name,files['source.zip']!);}
  return store.importData(data,bindings,new Map(restored.references.map(row=>[row.from.id,row.to.id])));
}
