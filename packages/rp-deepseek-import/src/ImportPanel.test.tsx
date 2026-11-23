// @vitest-environment jsdom
import React from 'react';
import {cleanup,render,screen,fireEvent,waitFor,within} from '@testing-library/react';
import {afterEach,expect,it} from 'vitest';
import {ImportPanel} from './ImportPanel.js';
afterEach(cleanup);
it('previews selected conversations and keeps duplicate navigation separate from importing',async()=>{
 const requested:string[][]=[];let opened='';
 render(<ImportPanel upload={async()=>({id:'p',name:'export.zip',conversations:[{sourceId:'a',title:'海边的约定',createdAt:0,updatedAt:0,messageCount:18,omittedTurns:1,failedReplies:0,state:'new'},{sourceId:'b',title:'回家的路',createdAt:0,updatedAt:0,messageCount:30,omittedTurns:0,failedReplies:0,state:'same',existingId:'old'}],failures:[]})} api={{import:async input=>{requested.push(input.sourceIds);return{imported:['new'],skipped:[],failures:[],conversations:[{sourceId:'a',title:'海边的约定',conversationId:'new',status:'imported',messageCount:18,omittedTurns:1,failedReplies:2}]};},discard:async()=>{}}} onOpen={id=>{opened=id;}}/>);
 const file=new File(['zip'],'export.zip',{type:'application/zip'});fireEvent.change(screen.getByLabelText('选择 ZIP 或 JSONL'),{target:{files:[file]}});
 await screen.findByText('海边的约定');fireEvent.click(screen.getByText('打开已有对话'));expect(opened).toBe('old');
 fireEvent.click(screen.getByRole('button',{name:'迁入选中的 1 段对话'}));await waitFor(()=>expect(requested).toEqual([['a']]));
 const outcome=await screen.findByRole('region',{name:'迁入结果'});
  expect(within(outcome).getByText('海边的约定')).toBeTruthy();
  expect(within(outcome).getByText('识别 18 条消息')).toBeTruthy();
  expect(within(outcome).getByText('省略 1 轮')).toBeTruthy();
  expect(within(outcome).getByText('未完成 2 条')).toBeTruthy();
  fireEvent.click(within(outcome).getByText('接着聊'));expect(opened).toBe('new');
});

it('accepts a JSONL export and exposes people, retained swipes and archived events before explicit import',async()=>{
 const ids:string[][]=[]; let opened='';
 const file=new File(['{"chat_metadata":{}}\n{"is_user":false,"mes":"首句"}'],'海边的约定.jsonl',{type:'application/x-ndjson'});
 render(<ImportPanel upload={async uploaded=>{expect(uploaded).toBe(file);return{id:'st',name:file.name,conversations:[{kind:'sillytavern-jsonl',sourceId:'st-source',title:'海边的约定',userName:'阿宁',characterName:'林舟',createdAt:0,updatedAt:0,messageCount:6,candidateCount:7,archivedMessageCount:1,archiveNotes:['1 条系统或事件消息','聊天头与扩展字段'],omittedTurns:0,failedReplies:2,state:'new'}],failures:[]};}} api={{discard:()=>{},import:async input=>{ids.push(input.sourceIds);return{imported:['st-chat'],skipped:[],failures:[],conversations:[{kind:'sillytavern-jsonl',sourceId:'st-source',title:'海边的约定',conversationId:'st-chat',status:'imported',messageCount:6,candidateCount:7,archivedMessageCount:1,omittedTurns:0,failedReplies:2}]};}}} onOpen={id=>{opened=id;}}/>);
 const picker=screen.getByLabelText('选择 ZIP 或 JSONL');
 expect(picker.getAttribute('accept')).toContain('.jsonl');
 fireEvent.change(picker,{target:{files:[file]}});
 await screen.findByText('海边的约定');
 expect(screen.getByText('SillyTavern JSONL')).toBeTruthy();
 expect(screen.getByText('阿宁 · 林舟')).toBeTruthy();
 expect(screen.getByText('7 条角色候选')).toBeTruthy();
 expect(screen.getByText('归档 1 条系统或事件消息')).toBeTruthy();
 expect(screen.queryByText(/1970/)).toBeNull();
 expect(ids).toEqual([]);
 fireEvent.click(screen.getByRole('button',{name:'迁入选中的 1 段对话'}));
 const result=await screen.findByRole('region',{name:'迁入结果'});
 expect(ids).toEqual([['st-source']]);
 expect(within(result).getByText('7 条角色候选')).toBeTruthy();
 fireEvent.click(within(result).getByRole('button',{name:'接着聊'}));expect(opened).toBe('st-chat');
});
