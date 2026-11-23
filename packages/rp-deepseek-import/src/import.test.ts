import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { previewExport, importSelected } from './import.js';
const time = '2026-11-18T00:00:00Z';
const msg = (id: number, parent_id: number | null, role: 'USER' | 'ASSISTANT', content: string, status = 'FINISHED') => ({ id, parent_id, role, status, inserted_at: time, fragments: [{ type: role === 'USER' ? 'REQUEST' : 'RESPONSE', content }] });
function archive(extra = ''): Uint8Array {
  return zipSync({ 'manifest.json': strToU8(JSON.stringify({ export_format_version: 3 })), 'chat_session_index.json': strToU8(JSON.stringify([{ id: 'old', inserted_at: time, updated_at: time }, { id: 'other', inserted_at: time, updated_at: time }])),
    'chat_sessions/old.json': strToU8(JSON.stringify({ id: 'old', title: '海边的约定', inserted_at: time, current_message_id: 6, messages: [msg(1,null,'USER','我们约好了'), msg(2,1,'ASSISTANT','叫你小岛长'+extra), msg(3,2,'USER','这条不选'), msg(4,3,'ASSISTANT','别的路线'), msg(5,2,'USER','现在到哪了'), msg(6,5,'ASSISTANT','准备看日落')] })),
    'chat_sessions/other.json': strToU8(JSON.stringify({ id:'other',title:'未完对话',inserted_at:time,messages:[msg(1,null,'USER','a'),{...msg(2,1,'ASSISTANT','不该进入模型','FAILED'),fragments:[{type:'THINK',content:'原导出的失败推理，只保留为来源'}, {type:'RESPONSE',content:'不该进入模型'}]},msg(3,2,'USER','b'),msg(4,3,'ASSISTANT','被撤回','CONTENT_FILTER'),msg(5,4,'USER','c'),msg(6,5,'ASSISTANT','')] })),
  });
}
describe('official ZIP adaptation', () => {
  it('previews selected ancestor chain and accurately counts skipped and failed replies', async () => {
    const preview = await previewExport(archive());
    const old = preview.conversations.find(row => row.sourceId==='old')!;
    expect(old.title).toBe('海边的约定'); expect(old.turns.map(t=>t.input)).toEqual(['我们约好了','现在到哪了']);
    expect(old.turns[0]?.reply).toContain('小岛长'); expect(JSON.stringify(old.turns)).not.toContain('别的路线');
    const other = preview.conversations.find(row=>row.sourceId==='other')!;
    expect(other.omittedTurns).toBe(1); expect(other.failedReplies).toBe(2); expect(other.turns.every(t=>!t.reply)).toBe(true);
    expect(other.turns[0]).toMatchObject({status:'failed',reasoning:'原导出的失败推理，只保留为来源'});
    expect(other.turns[0]?.error).toContain('FAILED');
    expect(other.turns[1]).toMatchObject({status:'empty',reply:'',reasoning:''});
  });
  it('imports only selection, skips identical sources and reports changed content without merging', async () => {
    const saved: {sourceId:string;fingerprint:string;id:string}[] = []; let calls=0;
    const sink = { existing: (sourceId:string)=>saved.filter(s=>s.sourceId===sourceId), save: async (row: {sourceId:string;fingerprint:string}, original: {bytes:Uint8Array})=>{ expect(original.bytes).toEqual(archive()); const id=`c${++calls}`; saved.push({...row,id}); return id; } };
    const preview = await previewExport(archive(), sink.existing);
    const imported = await importSelected(preview,['old'], {name:'export.zip',bytes:archive()},sink);
    expect(imported.imported).toEqual(['c1']);
    expect(imported).toMatchObject({conversations:[{sourceId:'old',title:'海边的约定',conversationId:'c1',status:'imported',messageCount:4,omittedTurns:0,failedReplies:0}]});
    const again = await previewExport(archive(),sink.existing);
    expect(again.conversations[0]?.existingId).toBe('c1');
    expect((await importSelected(again,['old'],{name:'export.zip',bytes:archive()},sink)).skipped).toEqual(['c1']); expect(calls).toBe(1);
    const changed = await previewExport(archive('，别忘了'),sink.existing);
    expect(changed.conversations.find(c=>c.sourceId==='old')?.state).toBe('changed'); expect(calls).toBe(1);
  });
  it('rejects unsupported ZIP format before creating data', async () => {
    await expect(previewExport(zipSync({'manifest.json':strToU8('{"export_format_version":99}')}))).rejects.toThrow('版本');
  });
});
