import React, { useLayoutEffect, useRef } from 'react';
import { PenLine, X } from './ThemeIcons.js';
import { createSurfaceMotion } from './surface-motion.js';

/** One local draft in the message's reading position; saving remains a Host operation. */
export function InlineMessageEditor({ label, fieldLabel, value, saving, error, onChange, onSave, onCancel }: {
  label: string; fieldLabel: string; value: string; saving: boolean; error?: string;
  onChange(value: string): void; onSave(): void; onCancel(): void;
}): React.ReactElement {
  const root = useRef<HTMLFormElement>(null), field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const motion = createSurfaceMotion(element, 'inline');
    field.current?.focus({ preventScroll: true });
    motion.to(true, element.closest<HTMLElement>('.tk-rp')?.dataset.tkInput === 'keyboard');
    return () => {
      motion.dispose();
      const active = element.ownerDocument.activeElement;
      if (opener.current?.isConnected && (active === element.ownerDocument.body || (active && element.contains(active)))) opener.current.focus({ preventScroll: true });
    };
  }, []);
  return <form ref={root} className="tk-inline-editor" role="region" aria-label={label} data-phase={saving ? 'saving' : error ? 'error' : 'editing'} aria-busy={saving} onSubmit={event => { event.preventDefault(); if (!saving) onSave(); }} onKeyDown={event => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
    else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopPropagation(); if (!saving) onSave(); }
  }}>
    <header className="tk-inline-editor-heading"><span><PenLine size={14} aria-hidden="true" />{label}</span><button type="button" className="tk-icon-control tk-micro-control" aria-label={`关闭${label}`} onClick={onCancel}><X size={16} aria-hidden="true" /></button></header>
    <textarea ref={field} aria-label={fieldLabel} value={value} onChange={event => onChange(event.target.value)} rows={6} readOnly={saving} />
    {error && <p className="tk-inline-editor-error" role="alert">{error}</p>}
    <footer><button type="button" className="tk-text-action tk-micro-control" onClick={onCancel}>返回阅读</button><button type="submit" className="tk-primary tk-micro-control" disabled={saving}><span>{saving ? '正在保存…' : fieldLabel === '角色回复' ? '另存为候选' : '从这句重新生成'}</span></button></footer>
  </form>;
}
