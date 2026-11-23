import React from 'react';
import type { CandidateView } from './protocol.js';
import { ArrowRight, Layers2, RotateCcw } from './ThemeIcons.js';

/** A request failure stays beside its candidate and never becomes message content. */
export function CandidateFeedback({ value, onRetry, onConnect, onDetails, disabled = false }: {
  value: CandidateView;
  onRetry(): void;
  onConnect(): void;
  onDetails(): void;
  disabled?: boolean;
}): React.ReactElement | null {
  const failures = value.failures ?? [];
  const last = failures.at(-1);
  const importedError = value.candidate.imported?.error;
  const failed = value.candidate.status === 'failed';
  if (!failed && !failures.length && !importedError) return null;
  const message = last?.message ?? importedError ?? '服务没有返回报错内容，可以查看本次请求。';
  const recovered = value.candidate.status === 'complete' && failures.length > 0;
  return <section className={`tk-candidate-feedback ${recovered ? 'tk-feedback-recovered' : ''}`} role={recovered ? 'status' : 'alert'}>
    <header><span className="tk-feedback-symbol" aria-hidden="true">{recovered ? '↗' : '!'}</span><strong>{recovered ? '已换用备用模型' : value.text ? '这条回复没有写完' : '这次没有生成成功'}</strong>{last?.httpStatus !== undefined && <span className="tk-feedback-code">{last.httpStatus}</span>}{last?.code && <code>{last.code}</code>}</header>
    <div className="tk-feedback-route">{last && <><span>{last.label ?? last.provider}</span><code>{last.model}</code>{last.group && <span>{last.group}</span>}</>}</div>
    {!recovered && <p className="tk-feedback-excerpt">{message}</p>}
    <details className="tk-feedback-original"><summary>{recovered ? `${failures.length} 次报错记录` : '展开完整报错'}</summary>{failures.length ? failures.map(item => <div key={item.attemptId}><div className="tk-feedback-route"><strong>{item.label ?? item.provider}</strong><code>{item.model}</code>{item.httpStatus !== undefined && <span>{item.httpStatus}</span>}{item.code && <code>{item.code}</code>}</div><pre>{item.message}</pre></div>) : <pre>{message}</pre>}</details>
    <div className="tk-feedback-actions">{!recovered && <button type="button" className="tk-text-action" disabled={disabled} onClick={onRetry}><RotateCcw size={14} aria-hidden="true" />换个回复</button>}<button type="button" className="tk-text-action" onClick={onConnect}><Layers2 size={14} aria-hidden="true" />检查连接</button><button type="button" className="tk-text-action" aria-label="查看报错详情" onClick={onDetails}>请求详情<ArrowRight size={14} aria-hidden="true" /></button></div>
  </section>;
}
