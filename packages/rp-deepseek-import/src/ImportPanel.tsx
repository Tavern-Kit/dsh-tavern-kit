import React, { useEffect, useRef, useState } from 'react';
import type { ImportRequest, ImportResult, ImportSourceDetails, PreviewRow, PreviewTicket } from './types.js';
import { IMPORT_STYLES } from './import-panel.styles.js';

export interface ImportPanelProps {
  upload: (file: File) => Promise<PreviewTicket>;
  api: { import: (input: ImportRequest) => Promise<ImportResult>; discard: (id: string) => Promise<void> | void };
  onOpen: (id: string) => void;
}

function SourceStats({ row, result = false }: { row: ImportSourceDetails & Pick<PreviewRow, 'messageCount' | 'omittedTurns' | 'failedReplies'>; result?: boolean }): React.ReactElement {
  return <>
    <div className="imp-source-stats">
      <span>{result ? '识别 ' : ''}{row.messageCount} 条消息</span>
      {row.candidateCount !== undefined && <span>{row.candidateCount} 条角色候选</span>}
      {row.archivedMessageCount !== undefined && row.archivedMessageCount > 0 && <span>归档 {row.archivedMessageCount} 条系统或事件消息</span>}
      {(result || row.omittedTurns > 0) && <span>省略 {row.omittedTurns} 轮</span>}
      {(result || row.failedReplies > 0) && <span>未完成 {row.failedReplies} 条</span>}
    </div>
    {row.archiveNotes?.length ? <p className="imp-archive-note">原文件已保存：{row.archiveNotes.join('、')}</p> : null}
  </>;
}

function LetterIllustration(): React.ReactElement {
  return <svg className="imp-letter" viewBox="0 0 116 84" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M12 34 54 6l42 28v40H12Z" fill="var(--imp-soft)" />
      <path d="M26 12h54v47H26Z" fill="var(--imp-panel)" />
      <path d="M36 24h28M36 32h34M36 40h20" opacity=".55" />
      <path d="m12 34 42 28 42-28M12 74l29-23m55 23L68 51" />
      <path d="M92 58V28m0 14c-10 0-12-6-12-10 8 0 12 4 12 10Zm0-7c0-8 6-12 12-12 0 8-5 12-12 12Z" fill="var(--imp-soft)" />
      <path d="M8 78h94M104 70h4" opacity=".45" />
    </g>
  </svg>;
}

export function ImportPanel({ upload, api, onOpen }: ImportPanelProps): React.ReactElement {
  const [ticket, setTicket] = useState<PreviewTicket>(), [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ticketRef = useRef<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (ticketRef.current) void api.discard(ticketRef.current); }, [api]);

  async function choose(file: File): Promise<void> {
    setBusy(true); setError('');
    try {
      if (ticketRef.current) await api.discard(ticketRef.current);
      const next = await upload(file);
      ticketRef.current = next.id; setTicket(next); setSelected(next.conversations.filter(row => row.state === 'new').map(row => row.sourceId)); setResult(undefined);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  async function commit(): Promise<void> {
    if (!ticket) return;
    setBusy(true); setError('');
    try { setResult(await api.import({ previewId: ticket.id, sourceIds: selected })); ticketRef.current = undefined; }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }
  const step = result ? 3 : ticket ? 2 : 1;

  return <section className="tk-rp tk-import" aria-label="旧对话迁入">
    <style>{IMPORT_STYLES}</style>
    <div className="imp-wrap">
      <header className="imp-heading" data-tk-page-heading>
        <div className="imp-heading-copy">
          <svg className="imp-heading-mark" viewBox="0 0 54 54" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M6 22 27 8l21 14v24H6Z" fill="var(--imp-soft)" /><path d="M14 6h26v25H14Z" fill="var(--imp-panel)" /><path d="M20 14h14m-14 6h10M6 22l21 15 21-15M6 46l15-13m27 13L33 33" /></g></svg>
          <div><h1>接回旧对话</h1></div>
        </div>
        <button type="button" className="imp-primary" disabled={busy} onClick={() => fileInput.current?.click()}>{busy ? '正在读取…' : '选择 ZIP 或 JSONL'}</button>
        <input ref={fileInput} type="file" tabIndex={-1} className="imp-file-input" accept=".zip,.jsonl,application/zip,application/x-ndjson" aria-label="选择 ZIP 或 JSONL" disabled={busy} onChange={event => { const file = event.currentTarget.files?.[0]; if (file) void choose(file); event.currentTarget.value = ''; }} />
      </header>

      <ol className="imp-steps" aria-label="迁入进度">
        {['选择文件', '挑选对话', '接着聊'].map((label, index) => <li className="imp-step" key={label} aria-current={step === index + 1 ? 'step' : undefined}><span className="imp-step-number" aria-hidden="true">{index + 1}</span><span>{label}</span></li>)}
      </ol>

      {!ticket && <section className="imp-intro" aria-label="选择对话来源">
        <div className="imp-intro-copy"><LetterIllustration /><h2>把熟悉的那段对话带过来</h2><p>选择导出文件，先看看有哪些对话，再挑出想接着聊的那几段。</p><div className="imp-footnote"><span>保留原始导出</span><span>预览后再迁入</span></div></div>
        <div className="imp-source-list">
          <div className="imp-source"><span className="imp-format" aria-hidden="true">ZIP</span><div><strong>DeepSeek 官网</strong><p>在官网导出的完整 ZIP 文件</p></div></div>
          <div className="imp-source"><span className="imp-format" aria-hidden="true">JSONL</span><div><strong>SillyTavern</strong><p>一段聊天的 JSONL，带上保存过的候选</p></div></div>
        </div>
      </section>}
      {error && <p className="imp-error" role="alert">{error}</p>}

      {ticket && <>
        <div className="imp-file-summary">
          <svg className="imp-file-icon" viewBox="0 0 32 38" fill="none" aria-hidden="true"><path d="M5 2h15l7 7v27H5Z" fill="var(--imp-soft)" stroke="currentColor" strokeWidth="1.4" /><path d="M20 2v8h7M11 17h10m-10 6h10m-10 6h6" stroke="currentColor" strokeWidth="1.4" /></svg>
          <div className="imp-file-name"><strong>{ticket.name}</strong><span>{ticket.conversations.length} 段对话</span></div>
        </div>
        {result && <section className="imp-results" aria-label="迁入结果">
          <div className="imp-result-heading"><span className="imp-result-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></span><div><strong>已接回 {result.imported.length} 段对话</strong><p>跳过相同内容 {result.skipped.length} 段</p></div></div>
          <div className="imp-grid">{result.conversations.map(row => <article className="imp-conversation imp-result-item" key={row.sourceId}>
            <div className="imp-result-top"><div><span className="imp-card-kind">{row.status === 'imported' ? '已接回' : '已跳过相同内容'}</span><h3>{row.title}</h3></div><button type="button" className="imp-primary" onClick={() => onOpen(row.conversationId)}>{row.status === 'skipped' ? '打开已有对话' : result.imported.length === 1 ? '接着聊' : '打开对话'}</button></div>
            <SourceStats row={row} result />
          </article>)}</div>
          {result.failures.map(row => <p className="imp-error" key={row.sourceId}>{row.sourceId} · {row.message}</p>)}
        </section>}
        <section aria-label="文件中的对话">
          <div className="imp-selection-bar"><div className="imp-selection-copy"><strong>{result ? '原始文件预览' : '挑出想接着聊的对话'}</strong>{!result && <span>已选 {selected.length} 段</span>}</div>
            {!result && <div className="imp-actions"><button type="button" onClick={() => setSelected(ticket.conversations.filter(row => row.state !== 'same').map(row => row.sourceId))}>全选新内容</button><button type="button" onClick={() => setSelected([])}>清空选择</button><button type="button" className="imp-primary" disabled={busy || !selected.length} onClick={() => void commit()}>迁入选中的 {selected.length} 段对话</button></div>}
          </div>
          <div className="imp-grid">{ticket.conversations.map(row => <article className="imp-conversation" data-selected={selected.includes(row.sourceId)} key={row.sourceId}>
            <div className="imp-conversation-head"><label className="imp-select"><input type="checkbox" aria-label={`选择 ${row.title}`} disabled={row.state === 'same' || !!result || busy} checked={selected.includes(row.sourceId)} onChange={event => setSelected(event.target.checked ? [...selected, row.sourceId] : selected.filter(id => id !== row.sourceId))} /></label><div className="imp-title-group"><span className="imp-card-kind">{row.kind === 'sillytavern-jsonl' ? 'SillyTavern JSONL' : 'DeepSeek ZIP'}</span><h3>{row.title}</h3></div><span className="imp-card-state">{row.state === 'same' ? '已接回' : row.state === 'changed' ? '有新内容' : '未迁入'}</span></div>
            {(row.userName || row.characterName) && <p className="imp-people">{[row.userName, row.characterName].filter(Boolean).join(' · ')}</p>}
            <div className="imp-card-meta">{row.updatedAt > 0 ? <time dateTime={new Date(row.updatedAt).toISOString()}>{new Date(row.updatedAt).toLocaleDateString('zh-CN')}</time> : <span>时间未记录</span>}</div>
            <SourceStats row={row} />
            {row.state === 'changed' && <p className="imp-change-note">本次会另存为新对话。</p>}
            {row.existingId && <button type="button" className="imp-existing" onClick={() => onOpen(row.existingId!)}>打开已有对话</button>}
          </article>)}</div>
          {ticket.failures.map(row => <p className="imp-error" key={row.sourceId}>{row.sourceId} · {row.message}</p>)}
        </section>
      </>}
    </div>
  </section>;
}
