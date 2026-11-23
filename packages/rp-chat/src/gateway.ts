import { createHash } from 'node:crypto';
import { MessageId, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import type { Context } from '@deepseek-ai/cordis';
import type { RequestMessage, LlmCallConfig, PreparedLlmCall } from '@deepseek-ai/dsh-llm';
import type { LlmGateway, ReplyChunk } from './engine.js';

/** Uses the public prepared call once; the engine persists input/config before stream(). */
export function dshGateway(ctx:{llm:{prepareCall(config:LlmCallConfig,signal?:AbortSignal):Promise<Pick<PreparedLlmCall,'config'|'stream'>>}}):LlmGateway {
  return { async prepare(proposed,signal) {
    const {reasoningEffort,...base}=proposed;
    const call=await ctx.llm.prepareCall({...base,...(reasoningEffort?{reasoningEffort:ReasoningEffortId(reasoningEffort)}:{})},signal);
    const config={...call.config};
    return {config,async *stream(input):AsyncIterable<ReplyChunk>{
      const messages:RequestMessage[]=input.messages.map((message,index)=>{
        const content=[{type:'text' as const,text:message.content}];
        const id=MessageId(createHash('sha256').update(JSON.stringify([index,message.role,message.content])).digest('hex'));
        if(message.role==='user')return {role:'user',content};
        if(message.role==='system')return {id,role:'system',source:{kind:'system-prompt'},content};
        // Imported/manual text has no recoverable provider replay state. Never invent one.
        return {id,role:'assistant',source:{kind:'model',provider:'tavern-kit-history',model:'unknown'},content};
      });
      for await(const chunk of call.stream({...call.config,system:input.system,messages,signal})) {
        if(chunk.type==='text-delta')yield {type:'text',text:chunk.text};
        else if(chunk.type==='reasoning-delta')yield {type:'reasoning',text:chunk.text};
        else if(chunk.type==='usage')yield {type:'usage',usage:{inputTokens:chunk.usage.inputTokens,outputTokens:chunk.usage.outputTokens,...(chunk.usage.cacheReadTokens!==undefined?{cachedInputTokens:chunk.usage.cacheReadTokens}:{}),...(chunk.usage.cacheWriteTokens!==undefined?{cacheWriteTokens:chunk.usage.cacheWriteTokens}:{}),...(chunk.usage.totalTokens!==undefined?{totalTokens:chunk.usage.totalTokens}:{}),...(chunk.usage.reasoningTokens!==undefined?{reasoningTokens:chunk.usage.reasoningTokens}:{})}};
        else if(chunk.type==='finish')yield {type:'finish',reason:chunk.reason.kind,...('failure' in chunk.reason?{error:{message:chunk.reason.failure.message,code:chunk.reason.failure.code,status:chunk.reason.failure.status}}:{})};
      }
    }};
  }};
}
