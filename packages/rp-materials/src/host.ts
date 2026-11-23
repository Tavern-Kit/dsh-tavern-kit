import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { z } from 'zod';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type {} from '@deepseek-ai/dsh-client-connection';
import type {} from '@deepseek-ai/dsh-tools';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { MaterialsLibrary } from './store.js';
import { validateJson } from './json.js';
import { personaDraftSchema } from './persona.js';
import type { MaterialRecord, MaterialSummary, MaterialQuery, MaterialMetadata, MaterialRevision, MaterialVersion, MaterialVersionRef, MaterialBundle, MaterialBundleRestore, MaterialExport, PortableResource, FileResult, PersonaDraft } from './types.js';
export type * from './types.js';
export { MaterialsLibrary } from './store.js';
export interface Config { dataDir: string }
declare module '@deepseek-ai/cordis' { interface Context { rpMaterials: MaterialsService } }

const versionRefSchema = z.object({ id: z.string().min(1), version: z.number().int().positive() }).strict();
const revisionSchema: z.ZodType<MaterialRevision> = z.object({
  raw: z.json().optional(),
  patch: z.record(z.string(), z.json()).optional(),
  bindings: z.object({ worldbooks: z.array(versionRefSchema), preset: versionRefSchema.nullable() }).strict().optional(),
}).strict();
const metadataSchema: z.ZodType<MaterialMetadata> = z.object({
  name: z.string().optional(), category: z.string().optional(),
  tags: z.array(z.string()).optional(), enabled: z.boolean().optional(),
}).strict();

/** Offline material owner. No fetch client, model service or remote catalog dependency. */
export default class MaterialsService extends TypertRemoteService {
  static inject = ['typert','connection','tools'];
  static Config: Schema<Config> = Schema.object({ dataDir: Schema.string().default(join(homedir(),'.dsh','tavern-kit')) });
  readonly library: MaterialsLibrary;
  private readonly dataDir: string;
  constructor(ctx:Context, config:Config) {
    super(ctx,'rpMaterials',{namespace:'rpMaterials'});
    this.dataDir=config.dataDir;
    this.library=new MaterialsLibrary(join(config.dataDir,'materials.sqlite'));
    ctx.effect(()=>()=>this.library.close());
    ctx.effect(()=>ctx.connection.fetch.register({path:'/api/tavern-kit/materials/upload',methods:['POST'],requestBody:'streaming',fetch:async request=>{
      try { const name=new URL(request.url).searchParams.get('name')??'角色卡.json';
        const result=this.importFile(name,new Uint8Array(await request.arrayBuffer()));return Response.json(result);
      } catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:400});}
    }}));
    ctx.effect(()=>ctx.tools.register(defineTool({name:'tavern_materials',description:'读取、整理和修订本地酒馆素材；原件与旧版本始终保留。',parameters:{action:{type:'string',required:true,enum:['list','get','revise','metadata','copy','delete','createPersona','revisePersona']},id:{type:'string'},json:{type:'string',description:'revise 使用与界面相同的修订对象 {raw?,patch?,bindings?}；metadata 使用 {name?,category?,tags?,enabled?}。'}},output:{schema:{type:'string'},render:(_args,value)=>[{type:'text',text:value}]},execute:async args=>{
      if(args.action==='list')return JSON.stringify(this.list({search:args.json}));
      if(args.action==='createPersona')return JSON.stringify(this.createPersona(personaDraftSchema.parse(validateJson(JSON.parse(args.json??'{}') as unknown))));
      if(!args.id)throw new Error('请选择素材');
      if(args.action==='revisePersona')return JSON.stringify(this.revisePersona(args.id,personaDraftSchema.parse(validateJson(JSON.parse(args.json??'{}') as unknown))));
      if(args.action==='get')return JSON.stringify(this.get(args.id));
      if(args.action==='copy')return JSON.stringify(this.copy(args.id));
      if(args.action==='delete'){this.delete(args.id);return '已移出素材库';}
      const value=validateJson(JSON.parse(args.json??'{}') as unknown);
      if(args.action==='revise')return JSON.stringify(this.revise(args.id,revisionSchema.parse(value)));
      return JSON.stringify(this.metadata(args.id,metadataSchema.parse(value)));
    }})));
  }
  @Remote createPersona(draft: PersonaDraft): MaterialRecord { return this.library.createPersona(draft); }
  @Remote revisePersona(id: string, draft: PersonaDraft): MaterialVersion { return this.library.revisePersona(id, draft); }
  @Remote location(): string { return this.dataDir; }
  @Remote list(query:MaterialQuery): MaterialSummary[] { return this.library.list(query); }
  @Remote get(id:string): MaterialRecord { return this.library.get(id); }
  @Remote readVersion(ref:MaterialVersionRef): MaterialVersion { return this.library.readVersion(ref); }
  @Remote versions(id:string): MaterialVersionRef[] { return this.library.versions(id); }
  @Remote resources(ref:MaterialVersionRef): PortableResource[] { return this.library.resources(ref).map(resource=>({path:resource.path,mediaType:resource.mediaType,base64:Buffer.from(resource.bytes).toString('base64')})); }
  @Remote revise(id:string,revision:MaterialRevision): MaterialVersion { return this.library.revise(id,revision); }
  @Remote metadata(id:string,patch:MaterialMetadata): MaterialRecord { return this.library.updateMetadata(id,patch); }
  @Remote copy(id:string): MaterialRecord { return this.library.copy(id); }
  @Remote delete(id:string): void { this.library.delete(id); }
  @Remote exportOriginal(id:string): FileResult { return this.file(this.library.exportOriginal(id)); }
  @Remote exportCurrent(id:string): FileResult { return this.file(this.library.exportCurrent(id)); }
  importFile(name:string,bytes:Uint8Array): MaterialRecord { return this.library.import({name,bytes}); }
  exportBundle(refs:MaterialVersionRef[]): MaterialBundle { return this.library.exportBundle(refs); }
  importBundle(bundle:unknown): MaterialBundleRestore { return this.library.importBundle(bundle); }
  private file(value:MaterialExport): FileResult { return {name:value.name,mediaType:value.mediaType,base64:Buffer.from(value.bytes).toString('base64')}; }
}
