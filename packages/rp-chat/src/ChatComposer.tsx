import React, { type ReactNode, useRef } from 'react';
import { ArrowUp, Square } from './ThemeIcons.js';

export interface ChatComposerProps {
  value: string;
  onChange(value: string): void;
  onSend(): void;
  onStop(): void;
  busy: boolean;
  generating: boolean;
  canSend: boolean;
  placeholder: string;
  children?: ReactNode;
}

export function ChatComposer({ value, onChange, onSend, onStop, busy, generating, canSend, placeholder, children }: ChatComposerProps) {
  const composing = useRef(false), hasDraft = value.trim().length > 0;
  const mode = busy ? 'busy' : !hasDraft && generating ? 'stop' : 'send';
  const phase = busy ? 'sending' : hasDraft ? 'draft' : generating ? 'streaming' : 'idle';
  const send = () => { if (!busy && canSend && hasDraft && !composing.current) onSend(); };

  return <form className="tk-composer" data-phase={phase} onSubmit={event => { event.preventDefault(); event.stopPropagation(); send(); }}>
    <textarea aria-label="想说的话" rows={1} value={value} placeholder={placeholder}
      onChange={event => onChange(event.target.value)}
      onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }}
      onKeyDown={event => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.stopPropagation();
        if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        event.preventDefault(); send();
      }} />
    <div className="tk-composer-actions">{children}<button className="tk-send-button tk-micro-control" data-mode={mode}
      type={mode === 'stop' ? 'button' : 'submit'} aria-label={mode === 'stop' ? '停止生成' : '发送'} aria-busy={busy}
      title={mode === 'stop' ? '停止生成' : busy ? '正在准备发送' : '发送（Ctrl / ⌘ + Enter）'}
      disabled={busy || (mode !== 'stop' && (!canSend || !hasDraft))} onClick={mode === 'stop' ? onStop : undefined}>
      <span className="tk-send-icon" aria-hidden="true"><ArrowUp size={20} /></span>
      <span className="tk-stop-icon" aria-hidden="true"><Square size={15} fill="currentColor" /></span>
      <span className="tk-send-busy" aria-hidden="true" />
    </button></div>
  </form>;
}
