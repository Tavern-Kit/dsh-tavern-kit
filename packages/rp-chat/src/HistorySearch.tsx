import React, { useEffect, useRef, useState } from 'react';
import type { SearchHit, SearchInput, SearchPage, SearchPreview } from './protocol.js';
import { MessageBody } from './MessageBody.js';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, PenLine, Search } from './ThemeIcons.js';

export interface HistorySearchProps {
  api: {
    search(input: SearchInput): Promise<SearchPage>;
    searchPreview(hit: SearchHit): Promise<SearchPreview>;
  };
  conversationId?: string;
  onContinue(candidateId: string): Promise<void>;
}

type Scope = 'current' | 'all';
interface Query { text: string; scope: Scope; conversationId?: string; offset: number }
const PAGE_SIZE = 20;
const statusLabels = { pending: '等待生成', streaming: '生成中', complete: '已完成', stopped: '已停止', failed: '未生成完成' };
const errorMessage = (reason: unknown): string => reason instanceof Error ? reason.message : String(reason);

const SEARCH_STYLES = `
.tk-history-search{display:grid;gap:16px;min-width:0;min-height:0;color:var(--tk-text,CanvasText);font-family:var(--tk-font-family,inherit)}
.tk-history-search [hidden]{display:none!important}
.tk-history-search :is(button,input){font:inherit}
.tk-history-search button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:7px 12px;border:1px solid var(--tk-border,ButtonBorder);border-radius:var(--tk-control-radius,var(--tk-radius,9px));background:var(--tk-surface,Canvas);color:inherit;cursor:pointer;touch-action:manipulation}
.tk-history-search button:disabled{opacity:.45;cursor:default}
.tk-history-search :is(button,input):focus-visible{outline:2px solid var(--tk-focus,var(--tk-accent,Highlight));outline-offset:3px}
.tk-history-query-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:end;gap:8px}
.tk-history-search .tk-history-query{display:grid;min-width:0;gap:6px;font-size:13px;font-weight:600}
.tk-history-search .tk-history-field{display:flex;align-items:center;gap:8px;min-width:0;padding:0 10px;border:1px solid var(--tk-border,ButtonBorder);border-radius:var(--tk-control-radius,var(--tk-radius,9px));background:var(--tk-surface,Canvas);color:var(--tk-muted,GrayText)}
.tk-history-search .tk-history-field:focus-within{outline:2px solid var(--tk-focus,var(--tk-accent,Highlight));outline-offset:2px}
.tk-history-search .tk-history-field input{width:100%;min-width:0;min-height:40px;padding:7px 0;border:0;border-radius:0;outline:0;background:transparent;color:var(--tk-text,CanvasText);font-size:16px;line-height:1.5}
.tk-history-controls,.tk-history-scope,.tk-history-card header,.tk-history-card footer,.tk-history-preview-head,.tk-history-preview-meta,.tk-history-preview-footer,.tk-history-pagination{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;min-width:0}
.tk-history-controls{justify-content:space-between;margin-top:10px;color:var(--tk-muted,GrayText);font-size:12px}
.tk-history-scope{gap:2px;padding:3px;border:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder));border-radius:var(--tk-control-radius,var(--tk-radius,10px));background:var(--tk-surface-soft,ButtonFace)}
.tk-history-search .tk-history-scope button{min-height:40px;padding:5px 10px;border-color:transparent;background:transparent;font-size:12px}
.tk-history-search .tk-history-scope button[aria-pressed=true]{background:var(--tk-surface,Canvas);color:var(--tk-accent,Highlight);border-color:var(--tk-line-soft,var(--tk-border,ButtonBorder));font-weight:700}
.tk-history-search .tk-history-search-button,.tk-history-search .tk-history-continue{background:var(--tk-accent,Highlight);color:var(--tk-accent-ink,HighlightText);border-color:transparent;font-weight:600}
.tk-history-results{display:grid;gap:12px;min-width:0}
.tk-history-result-cards{display:grid;gap:10px;max-height:min(54dvh,520px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:2px}
.tk-history-card{display:grid;grid-template-columns:32px minmax(0,1fr);gap:12px;padding:14px;border:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder));border-radius:var(--tk-radius,12px);background:var(--tk-surface,Canvas);min-width:0}
.tk-history-stamp{display:grid;place-items:center;width:32px;height:38px;border:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder));border-radius:var(--tk-control-radius,var(--tk-radius,7px));background:var(--tk-accent-soft,var(--tk-surface-soft,ButtonFace));color:var(--tk-accent,Highlight)}
.tk-history-card-copy{min-width:0}
.tk-history-card h3,.tk-history-preview-head h3{margin:0;font-size:15px;line-height:1.5;font-weight:700;overflow-wrap:anywhere}
.tk-history-card header{justify-content:space-between;gap:4px 8px}
.tk-history-role,.tk-history-ordinal,.tk-history-preview-meta{font-size:12px;line-height:1.5;color:var(--tk-muted,GrayText);font-variant-numeric:tabular-nums}
.tk-history-role{white-space:nowrap}
.tk-history-card p{margin:8px 0 6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px;line-height:1.75}
.tk-history-card footer{justify-content:space-between;gap:4px 8px}
.tk-history-search .tk-history-open{padding:5px 0 5px 8px;border:0;background:transparent;color:var(--tk-accent,Highlight);font-size:12px;white-space:nowrap}
.tk-history-pagination{justify-content:space-between;padding:8px 0 0;border-top:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder));color:var(--tk-muted,GrayText);font-size:12px;font-variant-numeric:tabular-nums}
.tk-history-pagination>span{display:flex;gap:6px}
.tk-history-search .tk-history-pagination button{padding:5px 10px;font-size:12px}
.tk-history-note,.tk-history-feedback{display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;min-width:0;padding:12px 14px;border:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder));border-radius:var(--tk-control-radius,var(--tk-radius,10px));background:var(--tk-surface-soft,ButtonFace);font-size:13px;color:var(--tk-muted,GrayText)}
.tk-history-note p,.tk-history-feedback p{margin:0;flex:1;min-width:0;overflow-wrap:anywhere}
.tk-history-feedback{color:var(--tk-danger,MarkText);background:var(--tk-surface,Canvas)}
.tk-history-feedback button{margin-left:auto;font-size:12px;flex:none}
.tk-history-preview{display:grid;gap:12px;min-width:0}
.tk-history-preview-head{align-items:flex-start;justify-content:space-between}
.tk-history-preview-identity{display:grid;gap:4px;min-width:0;flex:1}
.tk-history-search .tk-history-back{padding:5px 0;border:0;background:transparent;color:var(--tk-muted,GrayText);font-size:12px}
.tk-history-originals{display:grid;gap:16px;min-width:0;max-height:min(52dvh,540px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:4px 2px}
.tk-history-source{min-width:0}
.tk-history-source+.tk-history-source{padding-top:14px;border-top:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder))}
.tk-history-source h4{display:flex;align-items:center;gap:6px;margin:0 0 8px;font-size:12px;font-weight:600;color:var(--tk-muted,GrayText)}
.tk-history-original-body{font-size:var(--tk-font-size,17px);line-height:1.85;overflow-wrap:anywhere}
.tk-history-original-body>*:first-child{margin-top:0}
.tk-history-original-body>*:last-child{margin-bottom:0}
.tk-history-preview-footer{justify-content:space-between;padding-top:10px;border-top:1px solid var(--tk-line-soft,var(--tk-border,ButtonBorder));font-size:12px;color:var(--tk-muted,GrayText)}
@media(hover:hover) and (pointer:fine){.tk-history-search button:not(:disabled):hover{border-color:var(--tk-accent,Highlight)}.tk-history-search .tk-history-open:not(:disabled):hover,.tk-history-search .tk-history-back:not(:disabled):hover{text-decoration:underline}}
@media(max-width:420px){.tk-history-card{grid-template-columns:28px minmax(0,1fr);gap:8px;padding:12px}.tk-history-stamp{width:28px;height:34px}.tk-history-controls{gap:8px}.tk-history-preview-head{gap:8px}.tk-history-preview-head>.tk-history-back{flex:none;justify-content:flex-start}.tk-history-result-cards{max-height:48dvh}.tk-history-originals{max-height:48dvh}.tk-history-pagination{gap:8px}}
`;

/** Search and previews are read-only; the parent performs the explicitly chosen continuation. */
export function HistorySearch({ api, conversationId, onContinue }: HistorySearchProps): React.ReactElement {
  const [draft, setDraft] = useState('');
  const [scope, setScope] = useState<Scope>(conversationId ? 'current' : 'all');
  const [query, setQuery] = useState<Query>();
  const [page, setPage] = useState<SearchPage>();
  const [searching, setSearching] = useState(false), [searchError, setSearchError] = useState('');
  const [selected, setSelected] = useState<SearchHit>();
  const [preview, setPreview] = useState<SearchPreview>();
  const [opening, setOpening] = useState(false), [previewError, setPreviewError] = useState('');
  const [continuing, setContinuing] = useState(false), [continueError, setContinueError] = useState('');
  const apiRef = useRef(api); apiRef.current = api;
  const mounted = useRef(false), currentPreview = useRef(preview); currentPreview.current = preview;
  const activeScope = conversationId ? scope : 'all';
  const queryConversationId = query?.scope === 'current' ? conversationId : undefined;
  const offset = query?.conversationId === queryConversationId ? (query?.offset ?? 0) : 0;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    setSelected(undefined); setPreview(undefined); setContinueError('');
    setPage(undefined); setSearchError(''); setSearching(!!query);
    if (query) void (async () => {
      try {
        const result = await apiRef.current.search({ query: query.text, ...(queryConversationId ? { conversationId: queryConversationId } : {}), offset, limit: PAGE_SIZE });
        if (active) setPage(result);
      } catch (reason) { if (active) setSearchError(errorMessage(reason)); }
      finally { if (active) setSearching(false); }
    })();
    return () => { active = false; };
  }, [query, queryConversationId, offset]);

  useEffect(() => {
    let active = true;
    setPreview(undefined); setPreviewError(''); setContinueError(''); setOpening(!!selected);
    if (selected) void (async () => {
      try { const result = await apiRef.current.searchPreview(selected); if (active) setPreview(result); }
      catch (reason) { if (active) setPreviewError(errorMessage(reason)); }
      finally { if (active) setOpening(false); }
    })();
    return () => { active = false; };
  }, [selected]);

  function submit(nextScope = activeScope, nextOffset = 0, text = draft): void {
    if (continuing) return;
    setScope(nextScope);
    setSelected(undefined); setPreview(undefined);
    const trimmed = text.trim();
    setQuery(trimmed ? { text: trimmed, scope: nextScope, ...(nextScope === 'current' && conversationId ? { conversationId } : {}), offset: nextOffset } : undefined);
  }
  const canContinue = !!preview?.candidateId && !!preview.status && preview.status !== 'pending' && preview.status !== 'streaming';
  async function proceed(): Promise<void> {
    if (!canContinue || !preview?.candidateId || continuing) return;
    const target = preview;
    setContinuing(true); setContinueError('');
    try { await onContinue(target.candidateId!); }
    catch (reason) { if (mounted.current && currentPreview.current === target) setContinueError(errorMessage(reason)); }
    finally { if (mounted.current) setContinuing(false); }
  }

  return <section className="tk-history-search" aria-label="搜索历史正文">
    <style>{SEARCH_STYLES}</style>
    <div role="search" aria-label="查找对话正文">
      <div className="tk-history-query-row">
        <label className="tk-history-query"><span>记得哪句话？</span><span className="tk-history-field"><Search size={17} aria-hidden="true" /><input type="search" aria-label="搜索历史正文" placeholder="输入一句话，或几个关键词" value={draft} disabled={continuing} onChange={event => {
          setDraft(event.target.value); if (!event.target.value.trim()) setQuery(undefined);
        }} onKeyDown={event => {
          if (event.key === 'Enter') { event.stopPropagation(); if (event.nativeEvent.isComposing) return; event.preventDefault(); submit(); }
        }} /></span></label>
        <button type="button" className="tk-history-search-button" disabled={!draft.trim() || continuing} onClick={() => submit()}>搜索</button>
      </div>
      <div className="tk-history-controls"><div className="tk-history-scope" role="group" aria-label="搜索范围">
        <button type="button" aria-pressed={activeScope === 'current'} disabled={!conversationId || continuing} onClick={() => submit('current')}>当前对话</button>
        <button type="button" aria-pressed={activeScope === 'all'} disabled={continuing} onClick={() => submit('all')}>全部对话</button>
      </div><span>{page ? `${page.total} 处命中` : '玩家输入 · 角色回复'}</span></div>
    </div>

    <div className="tk-history-results" aria-label="搜索结果" hidden={!!selected}>
      {searching && <div className="tk-history-note" role="status"><Search size={18} aria-hidden="true" /><p>正在搜索…</p></div>}
      {searchError && <div className="tk-history-feedback" role="alert"><p>{searchError}</p><button type="button" onClick={() => { if (query) setQuery({ ...query }); }}>重试搜索</button></div>}
      {!query && <div className="tk-history-note"><BookOpen size={21} aria-hidden="true" /><p>找一句记得的话，回到那段剧情。</p></div>}
      {page && !page.items.length && <div className="tk-history-note"><Search size={21} aria-hidden="true" /><p>没有找到这句话，换个词试试。</p></div>}
      {page && page.items.length > 0 && <>
        <div className="tk-history-result-cards" aria-label="命中片段">
          {page.items.map(hit => <article className="tk-history-card" key={`${hit.conversationId}:${hit.turnId}:${hit.role}:${hit.candidateId ?? ''}`}>
            <span className="tk-history-stamp" aria-hidden="true">{hit.role === 'user' ? <PenLine size={17} /> : <BookOpen size={17} />}</span>
            <div className="tk-history-card-copy"><header><h3>{hit.conversationTitle}</h3><span className="tk-history-role">{hit.role === 'user' ? '玩家输入' : '角色回复'}</span></header>
              <p>{hit.excerpt}</p><footer><span className="tk-history-ordinal">{hit.ordinal !== undefined ? `${hit.role === 'user' ? '关联候选' : '候选'} ${hit.ordinal}` : '这一轮的输入'}</span><button type="button" className="tk-history-open" aria-label={`查看原文：${hit.conversationTitle} · ${hit.role === 'user' ? '玩家输入' : `候选 ${hit.ordinal ?? ''}`}`} onClick={() => setSelected(hit)}>查看原文<ChevronRight size={15} aria-hidden="true" /></button></footer>
            </div>
          </article>)}
        </div>
        <nav className="tk-history-pagination" aria-label="搜索结果翻页"><span>第 {Math.floor(offset / PAGE_SIZE) + 1} 页 · 共 {page.total} 处</span><span>
          <button type="button" disabled={offset === 0 || searching || continuing} onClick={() => { if (query) submit(query.scope, Math.max(0, offset - PAGE_SIZE), query.text); }}><ChevronLeft size={15} aria-hidden="true" />上一页</button>
          <button type="button" disabled={offset + PAGE_SIZE >= page.total || searching || continuing} onClick={() => { if (query) submit(query.scope, offset + PAGE_SIZE, query.text); }}>下一页<ChevronRight size={15} aria-hidden="true" /></button>
        </span></nav>
      </>}
    </div>

    {selected && <section className="tk-history-preview" aria-label="原文预览" aria-busy={opening || continuing}>
      <header className="tk-history-preview-head"><div className="tk-history-preview-identity"><h3>{preview?.conversationTitle ?? selected.conversationTitle}</h3><span className="tk-history-preview-meta">{preview?.ordinal !== undefined ? `候选 ${preview.ordinal}` : selected.role === 'user' ? '玩家输入' : '角色回复'}{preview?.status && <span>· {statusLabels[preview.status]}</span>}</span></div><button type="button" className="tk-history-back" disabled={continuing} onClick={() => setSelected(undefined)}><ArrowLeft size={16} aria-hidden="true" />返回搜索结果</button></header>
      {opening && <div className="tk-history-note" role="status"><BookOpen size={18} aria-hidden="true" /><p>正在打开原文…</p></div>}
      {previewError && <div className="tk-history-feedback" role="alert"><p>{previewError}</p><button type="button" onClick={() => setSelected({ ...selected })}>重试预览</button></div>}
      {preview && <>
        <div className="tk-history-originals">
          <section className="tk-history-source" aria-label="玩家原文"><h4><PenLine size={14} aria-hidden="true" />玩家原文</h4>{preview.input ? <MessageBody className="tk-history-original-body" text={preview.input} /> : <span className="tk-history-role">（没有玩家输入）</span>}</section>
          {preview.reply !== undefined && <section className="tk-history-source" aria-label="角色原文"><h4><BookOpen size={14} aria-hidden="true" />角色原文</h4>{preview.reply ? <MessageBody className="tk-history-original-body" text={preview.reply} /> : <span className="tk-history-role">（空白回复）</span>}</section>}
        </div>
        {continueError && <div className="tk-history-feedback" role="alert"><p>{continueError}</p></div>}
        <footer className="tk-history-preview-footer"><span>{!preview.candidateId ? '这轮还没有角色回复' : preview.status ? statusLabels[preview.status] : '候选状态未读到'}</span><button type="button" className="tk-history-continue" aria-label="从这里继续" disabled={!canContinue || continuing} onClick={() => void proceed()}>{continuing ? '切换中…' : '从这里继续'}<ChevronRight size={15} aria-hidden="true" /></button></footer>
      </>}
    </section>}
  </section>;
}
