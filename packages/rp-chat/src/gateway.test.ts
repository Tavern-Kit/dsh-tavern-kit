import {describe,expect,it} from 'vitest';
import type {GenerateOptions,LlmCallConfig,PreparedLlmCall,StreamChunk} from '@deepseek-ai/dsh-llm';
import {dshGateway} from './gateway.js';

describe('公开DSH prepared-call桥接',()=>{
 it('保留缓存写入与总用量，冻结实际调用配置且不提供工具',async()=>{
  let submitted:GenerateOptions|undefined;
  const services={llm:{async prepareCall(config:LlmCallConfig):Promise<Pick<PreparedLlmCall,'config'|'stream'>>{
   return {config:{...config,model:'实际/[模型]'},async *stream(options:GenerateOptions):AsyncIterable<StreamChunk>{
    submitted=options;
    yield {type:'usage',usage:{inputTokens:11,outputTokens:7,totalTokens:25,cacheReadTokens:5,cacheWriteTokens:2,reasoningTokens:3}};
    yield {type:'finish',reason:{kind:'stop'}};
   }};
  }}};
  const gateway=dshGateway(services),controller=new AbortController();
  const prepared=await gateway.prepare({provider:'local',model:'原始模型',reasoningEffort:'high'},controller.signal);
  expect(prepared.config.model).toBe('实际/[模型]');
  const chunks=[];for await(const chunk of prepared.stream({system:'约定与角色设定',messages:[{role:'user',content:'你好'},{role:'assistant',content:'小满，我在。'}]}))chunks.push(chunk);
  expect(chunks[0]).toEqual({type:'usage',usage:{inputTokens:11,outputTokens:7,cachedInputTokens:5,cacheWriteTokens:2,totalTokens:25,reasoningTokens:3}});
  expect(submitted?.model).toBe('实际/[模型]');expect(submitted?.reasoningEffort).toBe('high');
  expect(submitted?.tools).toBeUndefined();expect(submitted?.toolHistory).toBeUndefined();
  expect(submitted?.messages[1]).toMatchObject({role:'assistant',content:[{type:'text',text:'小满，我在。'}]});
  expect(submitted?.messages[1]).toHaveProperty('id');
 });
});
