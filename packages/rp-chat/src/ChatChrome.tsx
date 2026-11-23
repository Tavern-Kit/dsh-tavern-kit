import React, { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal, X } from './ThemeIcons.js';
import { TavernEmblem } from './TavernArt.js';
import { createSurfaceMotion } from './surface-motion.js';
import { OverflowLine } from './OverflowLine.js';

/** Keep the native disclosure mounted while a pointer exit can still reverse. */
export function ActionMenu({ children, label = '更多操作', className = '' }: { children: ReactNode; label?: string; className?: string }): React.ReactElement {
  const disclosure = useRef<HTMLDetailsElement>(null), sheet = useRef<HTMLDivElement>(null);
  const motion = useRef<ReturnType<typeof createSurfaceMotion> | null>(null);
  const intent = useRef(false), mounted = useRef(false);
  const [open, setOpen] = useState(false);
  const change = (next: boolean, immediate = false, restoreFocus = false) => {
    const element = disclosure.current, surface = sheet.current;
    if (!mounted.current || !element || !surface) return;
    intent.current = next;
    setOpen(next);
    surface.toggleAttribute('inert', !next);
    surface.setAttribute('aria-hidden', String(!next));
    if (next) { element.open = true; surface.hidden = false; }
    if (restoreFocus) element.querySelector('summary')?.focus({ preventScroll: true });
    motion.current?.to(next, immediate, () => {
      if (!next && mounted.current && !intent.current) { surface.hidden = true; element.open = false; }
    });
  };
  useLayoutEffect(() => {
    if (!sheet.current) return;
    mounted.current = true;
    motion.current = createSurfaceMotion(sheet.current, 'menu');
    const closeOutside = (event: PointerEvent) => {
      const element = disclosure.current;
      if (intent.current && element && event.target instanceof Node && !element.contains(event.target)) change(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      mounted.current = false;
      motion.current?.dispose(); motion.current = null;
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, []);
  return <details className={`tk-action-menu ${className}`} ref={disclosure} onToggle={event => {
    const actual = event.currentTarget.open;
    // Native toggle events are queued; an old event must not reverse a newer intent.
    if (!actual && intent.current) change(false, true);
    else if (actual && !intent.current && sheet.current?.hidden) change(true, true);
  }} onKeyDown={event => {
    if (event.key === 'Escape' && (intent.current || disclosure.current?.open)) {
      event.preventDefault(); event.stopPropagation(); change(false, true, true);
    } else if (event.target === disclosure.current?.querySelector('summary') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault(); if (!event.repeat) change(!intent.current, true);
    }
  }}>
    <summary className="tk-micro-control" role="button" aria-label={label} title={label} aria-expanded={open} onClick={event => { event.preventDefault(); change(!intent.current, event.detail === 0); }}><MoreHorizontal size={20} aria-hidden="true" /></summary>
    <div className="tk-menu-sheet" aria-label={label === '更多操作' ? '对话操作' : label + '菜单'} ref={sheet} hidden aria-hidden={!open} onClick={event => {
      if (event.target instanceof Element && event.target.closest('button')) change(false, true, true);
    }}>{children}</div>
  </details>;
}

/** Dialogs keep native top-layer/focus semantics; closing never waits for motion. */
export function ChatDialog({ label, onClose, children, className = '', error, onDismissError }: { label: string; onClose(): void; children: ReactNode; className?: string; error?: string; onDismissError?(): void }): React.ReactElement {
  const dialog = useRef<HTMLDialogElement>(null), motion = useRef<ReturnType<typeof createSurfaceMotion> | null>(null);
  const opener = useRef(typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const dismiss = useRef(onClose); dismiss.current = onClose;
  const closed = useRef(false), mounted = useRef(false);
  const closeNative = (element: HTMLDialogElement) => {
    if (element.open && typeof element.close === 'function') element.close();
    element.removeAttribute('open');
    const active = element.ownerDocument.activeElement;
    if (opener.current?.isConnected && (active === element.ownerDocument.body || active === opener.current || (active && element.contains(active)))) opener.current.focus({ preventScroll: true });
  };
  const close = () => {
    const element = dialog.current;
    if (closed.current || !mounted.current || !element) return;
    closed.current = true;
    motion.current?.to(false, true);
    closeNative(element);
    dismiss.current();
  };
  useLayoutEffect(() => {
    const element = dialog.current;
    if (!element) return;
    mounted.current = true; closed.current = false;
    motion.current = createSurfaceMotion(element, 'dialog');
    const keyboardOpened = element.closest<HTMLElement>('.tk-rp')?.dataset.tkInput === 'keyboard';
    if (typeof element.showModal === 'function') element.showModal();
    else {
      element.setAttribute('open', '');
      element.querySelector<HTMLElement>('[autofocus],button,input,textarea,select,[tabindex]')?.focus();
    }
    motion.current.to(true, keyboardOpened);
    return () => {
      mounted.current = false; closed.current = true;
      motion.current?.dispose(); motion.current = null;
      closeNative(element);
    };
  }, []);
  return <dialog ref={dialog} className={`tk-rp-dialog ${className}`} aria-label={label} onClose={event => { if (!event.currentTarget.open) close(); }} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <header className="tk-dialog-header"><h2>{label}</h2><button type="button" className="tk-icon-control" aria-label={`关闭${label}`} onClick={close}><X size={19} aria-hidden="true" /></button></header>
    {error && <div className="tk-dialog-error tk-error tk-inline" role="alert"><span>{error}</span>{onDismissError && <button type="button" className="tk-icon-control" aria-label="收起错误" onClick={onDismissError}><X size={16} aria-hidden="true" /></button>}</div>}
    <div className="tk-dialog-content">{children}</div>
  </dialog>;
}

/** A quiet identity line; the original card portrait stays local and the text remains selectable. */
export function MessageHeading({ name, image, meta, children }: { name: string; image?: string; meta?: ReactNode; children?: ReactNode }): React.ReactElement {
  return <header className="tk-message-heading">
    <span className="tk-message-avatar" aria-hidden="true">{image ? <img src={image} alt="" draggable={false} /> : <span>{name.slice(0, 1)}</span>}</span>
    <div className="tk-message-byline"><strong><OverflowLine>{name}</OverflowLine></strong>{meta && <span className="tk-message-meta">{meta}</span>}</div>
    {children}
  </header>;
}

export function StoryMark(): React.ReactElement {
  return <span className="tk-story-mark" aria-hidden="true"><TavernEmblem /></span>;
}

/** Original illustrated covers identify stories without inventing a character portrait. */
export function StoryCover({ seed, image, className = '' }: { seed: string; image?: string; className?: string }): React.ReactElement {
  const hash = Array.from(seed).reduce((value, letter) => Math.imul(value ^ (letter.codePointAt(0) ?? 0), 16777619) >>> 0, 2166136261);
  const tone = (hash >>> 16) % 4;
  return <span className={`tk-story-cover tk-cover-${tone} ${className}`} aria-hidden="true">{image ? <img src={image} alt="" /> : <><svg className="tk-cover-vector" viewBox="0 0 120 148" fill="none">
    <rect x="8.5" y="8.5" width="103" height="131" rx="4" className="tk-cover-frame" />
    <path d="M16 17h10m-10 0v10m88-10H94m10 0v10M16 131h10m-10 0v-10m88 10H94m10 0v-10" className="tk-cover-foil" />
    {tone === 0 ? <><path d="M30 100V58a30 30 0 0 1 60 0v42Z" className="tk-cover-window" /><circle cx="73" cy="53" r="12" className="tk-cover-moon" /><path d="m30 80 17-12 24 20 19-15M30 91q17-9 30 0t30-1m-60 10h60" className="tk-cover-foil" /><path d="M44 118h32m-24 5h16" className="tk-cover-foil" /></> : tone === 1 ? <><path d="M29 46h62v60H29Z" className="tk-cover-window" /><path d="M60 46v60M29 76h62m-7-36v-6M36 40v-6" className="tk-cover-foil" /><path d="M38 116q5-27 30-43m-19 29q-16-13-17-1 7 12 17 1m10-16q-4-16-12-10-2 13 12 10m3-4q18 1 16 10-11 5-16-10" className="tk-cover-leaf" /><circle cx="78" cy="61" r="7" className="tk-cover-moon" /></> : tone === 2 ? <><path d="m29 55 58-6 6 49-58 6Z" className="tk-cover-window" /><path d="m34 65 30 15 23-22m-48 39 16-21m31 15L71 78" className="tk-cover-foil" /><circle cx="64" cy="87" r="9" className="tk-cover-moon" /><path d="M46 119h28m-18-4h10M31 36h58" className="tk-cover-foil" /><path d="M60 30v12m-6-6h12" className="tk-cover-foil" /></> : <><path d="M29 99V62a31 31 0 0 1 62 0v37Z" className="tk-cover-window" /><path d="M60 31v68M29 63h62" className="tk-cover-foil" /><path d="M35 108q15-16 33-8t18 0M35 115q17-12 33-5t18-1" className="tk-cover-foil" /><circle cx="46" cy="52" r="7" className="tk-cover-moon" /><path d="m73 73 7-10 7 10m-7-10v23" className="tk-cover-foil" /></>}
  </svg><svg className="tk-cover-pixel" viewBox="0 0 32 40" fill="currentColor" shapeRendering="crispEdges"><path d="M3 3h26v34H3Zm2 2v30h22V5Z" fillRule="evenodd"/><path d="M6 6h2v28H6zM11 10h11v2h-11zM11 28h11v2h-11zM13 32h7v1h-7z" opacity=".6"/>{tone % 2 === 0 ? <><path d="M17 14h5v2h2v6h-2v2h-5v-2h-2v-6h2z"/><path d="M20 14h2v2h2v4h-4z" className="tk-pixel-cutout"/><path d="M10 20h2v2h-2zM12 16h2v2h-2z"/></> : <><path d="M11 15h13v10H11Zm2 2v6h9v-6Z" fillRule="evenodd"/><path d="m13 17 4 4 5-4m-5 4v2" stroke="currentColor" fill="none" strokeWidth="1"/></>}</svg></>}</span>;
}
