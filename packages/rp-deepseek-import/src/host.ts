import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-client-connection';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type {} from '@tavern-kit/rp-chat';
import { previewExport, importSelected } from './import.js';
import type { ExportPreview } from './import.js';
import type { PreviewTicket, ImportRequest, ImportResult } from './types.js';
export type * from './types.js';
declare module '@deepseek-ai/cordis' { interface Context { rpDeepseekImport:DeepseekImportService } }
export default class DeepseekImportService extends TypertRemoteService {
  static inject=['typert','connection','rpChat','tools'];
  private readonly previews=new Map<string,{preview:ExportPreview;name:string;bytes:Uint8Array}>();
  private readonly lifetime=new AbortController();
  constructor(ctx:Context){
    super(ctx,'rpDeepseekImport',{namespace:'rpDeepseekImport'});
    ctx.effect(()=>()=>{this.lifetime.abort();this.previews.clear();});
    ctx.effect(()=>ctx.connection.fetch.register({path:'/api/tavern-kit/deepseek/preview',methods:['POST'],requestBody:'streaming',fetch:async request=>{
      try { const name=new URL(request.url).searchParams.get('name')??'DeepSeek.zip';
        return Response.json(await this.inspect(name,new Uint8Array(await request.arrayBuffer())));
      }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400});}
    }}));
    ctx.effect(()=>ctx.tools.register(defineTool({
      name:'tavern_deepseek_import',
      description:'预览本地 DeepSeek 官方 ZIP 或 SillyTavern JSONL、读取预览、按源会话 ID 选择迁入或丢弃预览。',
      parameters:{
        action:{type:'string',required:true,enum:['preview','read','import','discard']},
        path:{type:'string',description:'preview 时使用的本地 ZIP 或 JSONL 文件路径'},
        previewId:{type:'string',description:'已有预览的 ID'},
        sourceIds:{type:'array',items:{type:'string'},description:'import 时明确选中的源会话 ID'},
      },
      output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},
      execute:async(args,exec)=>{
        if(args.action==='preview'){
          if(!args.path?.trim())throw new Error('请选择本地 ZIP 或 JSONL 的路径');
          return JSON.stringify(await this.inspectFile(args.path,exec.signal));
        }
        if(!args.previewId)throw new Error('请选择已生成的预览');
        if(args.action==='read')return JSON.stringify(this.readPreview(args.previewId));
        if(args.action==='discard'){this.discard(args.previewId);return 'null';}
        if(!args.sourceIds)throw new Error('请选择要迁入的对话');
        return JSON.stringify(await this.import({previewId:args.previewId,sourceIds:args.sourceIds}));
      },
    })));
  }
  async inspectFile(path:string,signal:AbortSignal):Promise<PreviewTicket>{
    const active=AbortSignal.any([this.lifetime.signal,signal]);
    const bytes=await readFile(path,{signal:active});
    return this.inspect(basename(path),new Uint8Array(bytes),active);
  }
  async inspect(name:string,bytes:Uint8Array,signal:AbortSignal=this.lifetime.signal):Promise<PreviewTicket>{
    const preview=await previewExport(bytes,id=>this.ctx.rpChat.sourceMatches(id),signal,name),id=randomUUID();
    this.previews.set(id,{preview,name,bytes});
    return this.readPreview(id);
  }
  @Remote readPreview(id:string):PreviewTicket{
    const ticket=this.previews.get(id);if(!ticket)throw new Error('请重新选择这份导出文件');
    return {id,name:ticket.name,conversations:ticket.preview.conversations.map(({turns:_turns,fingerprint:_fingerprint,error:_error,...row})=>row),failures:ticket.preview.failures};
  }
  @Remote async import(input:ImportRequest):Promise<ImportResult>{
    if(!input.sourceIds.length)throw new Error('请选择要迁入的对话');
    const ticket=this.previews.get(input.previewId);if(!ticket)throw new Error('请重新选择这份导出文件');
    const result=await importSelected(ticket.preview,input.sourceIds,{name:ticket.name,bytes:ticket.bytes},{existing:id=>this.ctx.rpChat.sourceMatches(id),save:async row=>this.ctx.rpChat.importHistory(row,{name:ticket.name,bytes:ticket.bytes})});
    this.previews.delete(input.previewId);return result;
  }
  @Remote discard(id:string):void{this.previews.delete(id);}
}
