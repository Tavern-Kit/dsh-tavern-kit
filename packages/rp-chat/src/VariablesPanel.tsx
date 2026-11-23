import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { JsonObject, JsonValue } from '@tavern-kit/rp-materials/types';
import type { Candidate } from './types.js';
import type { MvuState } from './mvu/types.js';
import { Layers2, PenLine } from './ThemeIcons.js';

export interface VariablesPanelProps {
  candidate: Candidate;
  onSave(state: MvuState): Promise<void>;
  onEnable(): Promise<void>;
}

type ValueKind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';
type FieldDraft = { path: string[]; kind: ValueKind; text: string };
type ParsedValue = { value: JsonValue; error?: never } | { error: string; value?: never };
const kindNames: Record<ValueKind, string> = { string: '文字', number: '数字', boolean: '布尔', null: '空值', object: '对象', array: '数组' };
const carrierKeys = ['stat_data', 'schema', 'initialized_lorebooks', 'display_data', 'delta_data'] as const;
const pretty = (value: JsonValue) => JSON.stringify(value, null, 2);
function object(value: unknown): value is JsonObject { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function json(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  return Array.isArray(value) ? value.every(json) : object(value) && Object.values(value).every(json);
}
function kind(value: JsonValue): ValueKind { return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : typeof value as 'string' | 'number' | 'boolean'; }
function readState(text: string): { state?: MvuState; error?: string } {
  let value: unknown;
  try { value = JSON.parse(text) as unknown; } catch { return { error: '完整变量 JSON 还没写完整，请检查括号、引号和逗号。' }; }
  if (!json(value) || !object(value)) return { error: '完整变量需要是 JSON 对象，数字也需要是有限值。' };
  const missing = carrierKeys.find(key => !object(value[key]));
  return missing ? { error: `${missing} 需要是对象，请保留完整的变量载体。` } : { state: value as MvuState };
}
function readField(text: string, valueKind: ValueKind): ParsedValue {
  if (valueKind === 'string') return { value: text };
  if (valueKind === 'number') {
    const value = Number(text);
    return text.trim() && Number.isFinite(value) ? { value } : { error: '请填写有效的数字。' };
  }
  try {
    const value: unknown = JSON.parse(text) as unknown;
    return json(value) && kind(value) === valueKind ? { value } : { error: `请填写${kindNames[valueKind]}类型的 JSON。` };
  } catch { return { error: 'JSON 还没写完整，请检查括号、引号和逗号。' }; }
}
function replaceValue(source: JsonObject, path: string[], value: JsonValue): JsonObject {
  const [key, ...rest] = path;
  if (key === undefined) return source;
  return { ...source, [key]: rest.length ? replaceValue(object(source[key]) ? source[key] : {}, rest, value) : value };
}
function initialValue(valueKind: ValueKind): JsonValue {
  switch (valueKind) { case 'string': return ''; case 'number': return 0; case 'boolean': return false; case 'null': return null; case 'array': return []; case 'object': return {}; }
}
function errorText(error: unknown): string { return error instanceof Error ? error.message : '这次没有保存成功，再试一次。'; }

const styles = `
.tk-rp .tk-variables{display:grid;gap:12px;min-width:0;color:var(--tk-text);font-family:var(--tk-font-family,inherit)}
.tk-rp .tk-variables .tk-variable-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;border-bottom:1px solid var(--tk-line-soft,var(--tk-border));padding-bottom:12px}
.tk-rp .tk-variables .tk-variable-identity{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 160px}
.tk-rp .tk-variables .tk-variable-identity>svg{width:24px;height:24px;flex:none;color:var(--tk-accent)}
.tk-rp .tk-variables h3{font:inherit;font-size:16px;font-weight:700;margin:0}.tk-rp .tk-variables .tk-variable-meta{font-size:12px;color:var(--tk-muted);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.tk-rp .tk-variables .tk-variable-save,.tk-rp .tk-variables .tk-variable-enable{min-height:40px;display:inline-flex;gap:6px;align-items:center;justify-content:center;padding:8px 12px;border:1px solid var(--tk-border);border-radius:var(--tk-control-radius,var(--tk-radius,12px));font:inherit;font-weight:600;background:var(--tk-accent);color:var(--tk-accent-ink);flex:0 0 auto}
.tk-rp .tk-variables .tk-variable-save svg{width:16px;height:16px}.tk-rp .tk-variables button:disabled{opacity:.5;cursor:default}
.tk-rp .tk-variables .tk-variable-feedback{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;min-width:0}.tk-rp .tk-variables [role=alert]{color:var(--tk-danger);overflow-wrap:anywhere}
.tk-rp .tk-variables .tk-variable-issues{display:grid;gap:6px;padding:8px 12px;border-left:3px solid var(--tk-danger);background:var(--tk-surface-soft);border-radius:var(--tk-control-radius,var(--tk-radius,12px))}
.tk-rp .tk-variables .tk-variable-issues p{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;margin:0;font-size:13px}.tk-rp .tk-variables .tk-variable-issues small{color:var(--tk-muted)}
.tk-rp .tk-variables .tk-variable-fields{display:grid;gap:8px;min-width:0}.tk-rp .tk-variables details{min-width:0}
.tk-rp .tk-variables summary{cursor:pointer;min-height:40px;display:flex;align-items:center;gap:8px;padding:8px 12px;overflow-wrap:anywhere;list-style:none}
.tk-rp .tk-variables summary::before{content:'›';font-family:system-ui,sans-serif;color:var(--tk-accent);font-size:18px;flex:none}.tk-rp .tk-variables details[open]>summary::before{content:'⌄'}
.tk-rp .tk-variables summary>span{font-weight:600}.tk-rp .tk-variables summary>small{margin-left:auto;font-size:12px;flex:none;color:var(--tk-muted)}
.tk-rp .tk-variables .tk-variable-object,.tk-rp .tk-variables .tk-variable-advanced,.tk-rp .tk-variables .tk-variable-revisions{border:1px solid var(--tk-border);border-radius:var(--tk-control-radius,var(--tk-radius,12px));background:var(--tk-surface)}
.tk-rp .tk-variables .tk-variable-object-body{display:grid;gap:8px;padding:0 12px 12px;min-width:0}
.tk-rp .tk-variables .tk-variable-row{display:grid;grid-template-columns:minmax(80px,1fr) 84px minmax(100px,1.4fr);align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--tk-line-soft,var(--tk-border));border-radius:var(--tk-control-radius,var(--tk-radius,12px));background:var(--tk-surface-soft);min-width:0}
.tk-rp .tk-variables .tk-variable-key{font-size:14px;font-weight:600;overflow-wrap:anywhere;min-width:0}
.tk-rp .tk-variables :is(input:not([type=checkbox]),textarea,select){min-width:0;max-width:100%;box-sizing:border-box;border:1px solid var(--tk-border);border-radius:var(--tk-control-radius,var(--tk-radius,12px));background:var(--tk-surface);color:var(--tk-text);font:inherit;font-size:14px;line-height:1.5;padding:8px;min-height:40px}
.tk-rp .tk-variables textarea{width:100%;resize:vertical}.tk-rp .tk-variables :is(input,textarea,select,button,summary):focus-visible{outline:2px solid var(--tk-accent);outline-offset:2px}
.tk-rp .tk-variables :is(input,textarea)[aria-invalid=true]{border-color:var(--tk-danger)}.tk-rp .tk-variables .tk-variable-row>[role=alert]{grid-column:1/-1;font-size:13px}
.tk-rp .tk-variables .tk-variable-bool{display:flex;align-items:center;gap:8px;min-height:40px;font-size:14px}.tk-rp .tk-variables input[type=checkbox]{width:18px;height:18px;accent-color:var(--tk-accent);margin:0}
.tk-rp .tk-variables .tk-variable-null{font-size:13px;color:var(--tk-muted)}.tk-rp .tk-variables .tk-variable-object-json{border-top:1px solid var(--tk-line-soft,var(--tk-border));min-width:0}
.tk-rp .tk-variables .tk-variable-json-controls{display:grid;grid-template-columns:minmax(0,1fr) 84px;align-items:center;gap:8px;padding:0 4px 8px;font-size:13px;color:var(--tk-muted)}
.tk-rp .tk-variables .tk-variable-json-controls textarea{grid-column:1/-1;min-height:112px}.tk-rp .tk-variables .tk-variable-raw{display:grid;gap:8px;padding:0 12px 12px;min-width:0}
.tk-rp .tk-variables .tk-variable-raw textarea{min-height:176px;max-height:52dvh;font-family:ui-monospace,SFMono-Regular,monospace;tab-size:2}.tk-rp .tk-variables .tk-variable-raw [role=alert]{font-size:13px}
.tk-rp .tk-variables .tk-variable-old{padding:8px 12px;border-top:1px solid var(--tk-line-soft,var(--tk-border));min-width:0}.tk-rp .tk-variables .tk-variable-old header{display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap;font-size:12px;color:var(--tk-muted)}
.tk-rp .tk-variables pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow:auto;max-height:36dvh;font-size:13px;margin:8px 0 0}.tk-rp .tk-variables .tk-variable-empty{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:12px;border:1px solid var(--tk-border);background:var(--tk-surface-soft);border-radius:var(--tk-control-radius,var(--tk-radius,12px))}
.tk-rp .tk-variables .tk-variable-empty p{margin:0;color:var(--tk-muted);font-size:14px;flex:1 1 120px}
@media(max-width:600px){.tk-rp .tk-variables .tk-variable-row{grid-template-columns:minmax(0,1fr) 84px;padding:8px}.tk-rp .tk-variables .tk-variable-row>:nth-child(3){grid-column:1/-1}.tk-rp .tk-variables :is(input:not([type=checkbox]),textarea,select){font-size:16px}.tk-rp .tk-variables .tk-variable-object-body{padding:0 8px 8px}}
`;

interface FieldsProps {
  data: JsonObject;
  path?: string[];
  id: string;
  locked: boolean;
  drafts: Record<string, FieldDraft>;
  onEdit(path: string[], valueKind: ValueKind, text: string): void;
  onType(path: string[], valueKind: ValueKind): void;
  onValue(path: string[], value: JsonValue): void;
}
function VariableFields(props: FieldsProps): React.ReactElement {
  return <div className="tk-variable-fields">{Object.entries(props.data).map(([key, value]) => {
    const path = [...(props.path ?? []), key], pathKey = JSON.stringify(path), label = path.join('.'), inputId = `${props.id}-${encodeURIComponent(pathKey)}`;
    const valueKind = kind(value), draft = props.drafts[pathKey];
    const error = draft ? readField(draft.text, draft.kind).error : undefined;
    const text = draft?.text ?? (valueKind === 'string' ? String(value) : valueKind === 'number' ? String(value) : pretty(value));
    const typeSelect = <select aria-label={`${label} 的类型`} disabled={props.locked} value={valueKind} onChange={event => props.onType(path, event.target.value as ValueKind)}>
      {Object.entries(kindNames).map(([item, name]) => <option key={item} value={item}>{name}</option>)}
    </select>;
    const field = valueKind === 'null' ? <span className="tk-variable-null">null</span>
      : valueKind === 'boolean' ? <label className="tk-variable-bool"><input id={inputId} aria-label={`${label} 的值`} type="checkbox" checked={value === true} disabled={props.locked} onChange={event => props.onValue(path, event.target.checked)} />{value ? 'true' : 'false'}</label>
      : valueKind === 'number' ? <input id={inputId} aria-label={`${label} 的值`} type="text" inputMode="decimal" value={text} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} disabled={props.locked} onChange={event => props.onEdit(path, valueKind, event.target.value)} />
      : <textarea id={inputId} aria-label={`${label} 的值`} rows={valueKind === 'string' ? 1 : 3} value={text} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} disabled={props.locked} spellCheck={valueKind === 'string'} onChange={event => props.onEdit(path, valueKind, event.target.value)} />;
    const issue = error && <div role="alert" id={`${inputId}-error`}>{label}：{error}</div>;
    if (object(value)) return <details key={pathKey} className="tk-variable-object"><summary><span>{key}</span><small>对象 · {Object.keys(value).length} 项</small></summary>
      <div className="tk-variable-object-body">
        <VariableFields {...props} data={value} path={path} />
        <details className="tk-variable-object-json"><summary><span>对象 JSON</span><small>高级</small></summary><div className="tk-variable-json-controls"><span>{key} · 类型与内容</span>{typeSelect}{field}{issue}</div></details>
      </div>
    </details>;
    return <div key={pathKey} className="tk-variable-row"><label className="tk-variable-key" htmlFor={valueKind === 'null' ? undefined : inputId}>{key}</label>{typeSelect}{field}{issue}</div>;
  })}</div>;
}

function VariablesEditor({ candidate, onSave, onEnable }: VariablesPanelProps): React.ReactElement {
  const source = candidate.mvu, initial = source?.state;
  const [text, setText] = useState(() => initial ? pretty(initial) : '');
  const [saved, setSaved] = useState(() => initial ? JSON.stringify(initial) : '');
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const live = useRef(true), inFlight = useRef(false), id = useId();
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const parsed = useMemo<{ state?: MvuState; error?: string }>(() => initial ? readState(text) : {}, [initial, text]);
  const invalidField = Object.values(drafts).some(draft => Boolean(readField(draft.text, draft.kind).error));
  const generating = candidate.status === 'pending' || candidate.status === 'streaming', locked = generating || busy;
  const dirty = Boolean(parsed.state && JSON.stringify(parsed.state) !== saved);
  function change(next: MvuState) { setText(pretty(next)); setError(''); setSuccess(''); }
  function update(path: string[], value: JsonValue) {
    if (!parsed.state || locked) return;
    change({ ...parsed.state, stat_data: replaceValue(parsed.state.stat_data, path, value) });
  }
  function edit(path: string[], valueKind: ValueKind, next: string) {
    if (locked) return;
    const field = { path, kind: valueKind, text: next }, value = readField(next, valueKind);
    setDrafts(previous => {
      const remaining = Object.fromEntries(Object.entries(previous).filter(([, draft]) => value.error || !path.every((part, index) => draft.path[index] === part)));
      return value.error || valueKind === 'number' ? { ...remaining, [JSON.stringify(path)]: field } : remaining;
    });
    setSuccess('');
    if (!value.error && value.value !== undefined) update(path, value.value);
  }
  function switchType(path: string[], valueKind: ValueKind) {
    if (locked) return;
    setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([, draft]) => !path.every((part, index) => draft.path[index] === part))));
    update(path, initialValue(valueKind));
  }
  async function run(operation: () => Promise<void>, completed: string) {
    if (locked || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(''); setSuccess('');
    try { await operation(); if (live.current) setSuccess(completed); }
    catch (failure) { if (live.current) setError(errorText(failure)); }
    finally { inFlight.current = false; if (live.current) setBusy(false); }
  }
  async function save() {
    if (!parsed.state || invalidField || !dirty) return;
    const state = parsed.state;
    await run(async () => { await onSave(state); if (live.current) setSaved(JSON.stringify(state)); }, '已保存');
  }
  const origin = source ? ({ computed: '自动更新', imported: '迁入快照', manual: '手动修订' } as const)[source.kind] : '还没有变量';
  return <section className="tk-variables" aria-label={`候选 ${candidate.ordinal} 的变量`}>
    <style>{styles}</style>
    <header className="tk-variable-head"><div className="tk-variable-identity"><Layers2 aria-hidden="true" /><div><h3>剧情变量</h3><div className="tk-variable-meta">候选 {candidate.ordinal} · {origin}{generating ? ' · 生成中' : ''}</div></div></div>
      {initial && <button type="button" className="tk-variable-save" disabled={locked || !dirty || !parsed.state || invalidField} onClick={() => { void save(); }}><PenLine aria-hidden="true" />{busy ? '保存中…' : '保存变量'}</button>}
    </header>
    {(error || success) && <div className="tk-variable-feedback">{error ? <span role="alert">{error}</span> : <span role="status">{success}</span>}</div>}
    {source && source.issues.length > 0 && <div role="alert" className="tk-variable-issues">{source.issues.map((issue, index) => <p key={index}><strong>{issue.source ?? issue.code}</strong><span>{issue.message}</span>{issue.offset !== undefined && <small>位置 {issue.offset}</small>}</p>)}</div>}
    {!initial ? <div className="tk-variable-empty"><p>从当前设定开启这段对话的变量。</p><button type="button" className="tk-variable-enable" disabled={locked} onClick={() => { void run(onEnable, '已开启'); }}>{busy ? '开启中…' : '开启变量'}</button></div> : <>
      {parsed.state && <VariableFields data={parsed.state.stat_data} id={id} locked={locked} drafts={drafts} onEdit={edit} onType={switchType} onValue={update} />}
      <details className="tk-variable-advanced"><summary><span>完整 JSON</span><small>高级</small></summary><div className="tk-variable-raw"><textarea aria-label="完整变量 JSON" aria-invalid={Boolean(parsed.error)} aria-describedby={parsed.error ? `${id}-json-error` : undefined} spellCheck={false} disabled={locked} value={text} onChange={event => { setText(event.target.value); setDrafts({}); setError(''); setSuccess(''); }} />{parsed.error && <div role="alert" id={`${id}-json-error`}>{parsed.error}</div>}</div></details>
      {source?.revisions && source.revisions.length > 0 && <details className="tk-variable-revisions"><summary><span>修订前的变量</span><small>{source.revisions.length} 份</small></summary>{source.revisions.map((revision, index) => <section className="tk-variable-old" role="region" aria-label={`修订前的变量 ${index + 1}`} key={`${revision.at}-${index}`}><header><span>修订 {index + 1}</span><time dateTime={new Date(revision.at).toISOString()}>{new Date(revision.at).toLocaleString('zh-CN')}</time></header><pre>{pretty(revision.state)}</pre></section>)}</details>}
    </>}
  </section>;
}

export function VariablesPanel(props: VariablesPanelProps): React.ReactElement {
  return <VariablesEditor key={`${props.candidate.id}:${props.candidate.mvu ? 'state' : 'empty'}`} {...props} />;
}
