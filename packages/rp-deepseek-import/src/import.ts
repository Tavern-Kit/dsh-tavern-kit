import { createHash, randomUUID } from 'node:crypto';
import { openExportArchive } from '@deepseek-ai/dsh-deepseek-chat-import/src/archive.ts';
import { convertConversation, selectBranch } from '@deepseek-ai/dsh-deepseek-chat-import/src/conversation.ts';
import { exportManifest, exportSessionIndex, exportSessionFile, parseKnownFragment, SUPPORTED_EXPORT_FORMAT_VERSION } from '@deepseek-ai/dsh-deepseek-chat-import/src/format.ts';
import type { ImportResult, ImportedSourceResult, ImportSourceDetails } from './types.js';
import type { ImportedConversation, ImportedTurn } from '@tavern-kit/rp-chat/protocol';
import { previewSillyTavern } from './sillytavern.js';
export type { ImportedTurn, ImportedReply } from '@tavern-kit/rp-chat/protocol';

/** Uses the official 0.2.2-rc.3 MIT ZIP/format/branch/text conversion. See SOURCES.md. */
export interface SourceMatch { id: string; sourceId: string; fingerprint: string }
export interface ConversationPreview extends ImportedConversation, ImportSourceDetails {
  sourceId: string; fingerprint: string; title: string; createdAt: number; updatedAt: number;
  messageCount: number; omittedTurns: number; failedReplies: number; turns: ImportedTurn[];
  state: 'new' | 'same' | 'changed'; existingId?: string; error?: string;
}
export interface ExportPreview { conversations: ConversationPreview[]; failures: { sourceId: string; message: string }[] }
export interface ImportSink {
  existing(sourceId: string): SourceMatch[];
  save(row: ConversationPreview, original: { name: string; bytes: Uint8Array }): Promise<string>;
}
const MAX_UPLOAD = 512 * 1024 * 1024;
const MAX_ENTRY = 256 * 1024 * 1024;
const fingerprint = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const parse = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes)) as unknown;

export async function previewExport(bytes: Uint8Array, existing: ImportSink['existing'] = () => [], signal: AbortSignal = new AbortController().signal, name = 'DeepSeek.zip'): Promise<ExportPreview> {
  signal.throwIfAborted();
  if (/\.jsonl$/i.test(name)) return previewSillyTavern(name, bytes, existing, signal);
  if (bytes.byteLength > MAX_UPLOAD) throw new Error('这个 ZIP 超过 512 MiB，请拆分导出后再导入');
  const archive = await openExportArchive(bytes, MAX_ENTRY, signal);
  const manifestBytes = await archive.read('manifest.json', signal);
  if (!manifestBytes) throw new Error('ZIP 里没有 DeepSeek 导出清单');
  if (exportManifest.parse(parse(manifestBytes)).export_format_version !== SUPPORTED_EXPORT_FORMAT_VERSION) throw new Error('这份导出格式版本暂不支持，请使用 DeepSeek 官方 ZIP');
  const indexBytes = await archive.read('chat_session_index.json', signal);
  if (!indexBytes) throw new Error('ZIP 里没有会话目录');
  const index = exportSessionIndex.parse(parse(indexBytes)).sort((a,b) => b.updated_at-a.updated_at);
  const rows = new Map(index.map(row=>[row.id,row]));
  const result: ExportPreview = { conversations: [], failures: [] };
  await archive.stream({
    select(entry) { return entry.name.startsWith('chat_sessions/') && entry.name.endsWith('.json') && rows.has(entry.name.slice(14,-5)); },
    async entry(entry, content) {
      const sourceId = entry.name.slice(14,-5);
      try {
        const file = exportSessionFile.parse(parse(content));
        if (file.id !== sourceId) throw new Error('会话编号与目录不一致');
        const chain = selectBranch(file), hash = fingerprint(content);
        let omittedTurns = 0;
        for (let i=0;i<chain.length;i++) if (chain[i]?.role==='USER' && chain[i+1]?.role==='ASSISTANT' && chain[i+1]?.status==='CONTENT_FILTER') omittedTurns++;
        const sourceReplies = chain.flatMap((message,index) => {
          if (message.role !== 'USER') return [];
          const next = chain[index+1], reply = next?.role === 'ASSISTANT' ? next : undefined;
          return reply?.status === 'CONTENT_FILTER' ? [] : [reply];
        });
        const converted = convertConversation(file, {createId: randomUUID, maxTitleBytes: 512});
        const turns: ImportedTurn[] = []; let turn: ImportedTurn | undefined, failedReplies = 0;
        for (const event of converted.events) {
          if (event.type === 'turn/start') { turn={input:'',reply:'',reasoning:'',status:'complete'}; turns.push(turn); }
          if (!turn) continue;
          if (event.type === 'user/message') turn.input += event.data.content.map(block => block.type==='text' ? block.text : block.type==='file' || block.type==='image' ? '[原导出包含附件，见本地原始 ZIP]' : '').filter(Boolean).join('\n');
          if (event.type === 'assistant/message') {
            turn.reply += event.data.message.content.filter(block=>block.type==='text').map(block=>block.text).join('\n');
            turn.reasoning += event.data.message.content.filter(block=>block.type==='reasoning').map(block=>block.text).join('\n');
          }
          if (event.type === 'tool/result') {
            const text = event.data.message.content.filter(block=>block.type==='text').map(block=>block.text).join('\n');
            if (text) turn.reply += `\n\n[原对话参考资料]\n${text}`;
          }
          if (event.type === 'turn/end' && event.data.reason.kind==='error') {
            const failure = event.data.reason.error;
            failedReplies++;
            turn.status = failure.code === 'DEEPSEEK_EXPORT_EMPTY_REPLY' || failure.code === 'DEEPSEEK_EXPORT_NO_REPLY' ? 'empty' : 'failed';
            turn.error = failure.message;
            // Failed replies stay out of model history; their reasoning remains identifiable source data.
            const reply = sourceReplies[turns.length-1];
            if (reply) turn.reasoning = reply.fragments.map(parseKnownFragment).flatMap(fragment => fragment?.type === 'THINK' ? [fragment.content] : []).join('\n');
          }
        }
        const matches = existing(sourceId), same = matches.find(row=>row.fingerprint===hash);
        result.conversations.push({ kind:'deepseek-chat-export', sourceId, fingerprint:hash, title:converted.title ?? '接回的对话', createdAt:converted.createdAt, updatedAt:rows.get(sourceId)!.updated_at, messageCount:chain.length, omittedTurns, failedReplies, turns, state:same?'same':matches.length?'changed':'new', existingId:same?.id });
      } catch (error) { result.failures.push({sourceId,message:error instanceof Error?error.message:String(error)}); }
    },
    reject(entry,error) { result.failures.push({sourceId:entry.name.slice(14,-5),message:error.message}); },
  }, signal);
  for (const row of index) if (!result.conversations.some(c=>c.sourceId===row.id) && !result.failures.some(c=>c.sourceId===row.id)) result.failures.push({sourceId:row.id,message:'ZIP 里没有这段会话文件'});
  result.conversations.sort((a,b)=>b.updatedAt-a.updatedAt);
  return result;
}

export async function importSelected(preview: ExportPreview, selected: string[], original: {name:string;bytes:Uint8Array}, sink: ImportSink): Promise<ImportResult> {
  const result: ImportResult = { imported:[], skipped:[], conversations:[], failures:[] };
  for (const sourceId of new Set(selected)) {
    const row=preview.conversations.find(row=>row.sourceId===sourceId);
    if (!row) { result.failures.push({sourceId,message:'这段对话不在本次预览中'}); continue; }
    const same = sink.existing(sourceId).find(old=>old.fingerprint===row.fingerprint);
    try {
      const conversationId = same?.id ?? await sink.save(row,original);
      if (same) result.skipped.push(conversationId); else result.imported.push(conversationId);
      const detail: ImportedSourceResult = {sourceId:row.sourceId,title:row.title,conversationId,status:same?'skipped':'imported',messageCount:row.messageCount,omittedTurns:row.omittedTurns,failedReplies:row.failedReplies,
        ...(row.kind ? {kind:row.kind} : {}), ...(row.userName ? {userName:row.userName} : {}), ...(row.characterName ? {characterName:row.characterName} : {}),
        ...(row.candidateCount !== undefined ? {candidateCount:row.candidateCount} : {}), ...(row.archivedMessageCount !== undefined ? {archivedMessageCount:row.archivedMessageCount} : {}), ...(row.archiveNotes ? {archiveNotes:row.archiveNotes} : {}),
      };
      result.conversations.push(detail);
    } catch(error) { result.failures.push({sourceId,message:error instanceof Error?error.message:String(error)}); }
  }
  return result;
}
