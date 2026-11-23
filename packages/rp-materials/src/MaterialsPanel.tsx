import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FileResult } from './host.js';
import { object, validateJson } from './json.js';
import { projectMaterial } from './projection.js';
import { MATERIAL_KINDS } from './types.js';
import { MaterialForm, PersonaFields, hasTypedForm, FORM_STYLES } from './MaterialForms.js';
import { MATERIALS_STYLES } from './materials-panel.styles.js';
import type {
  JsonValue, MaterialBindings, MaterialCapability, MaterialKind, MaterialMetadata,
  MaterialQuery, MaterialRecord, MaterialRevision, MaterialSummary,
  MaterialVersion, MaterialVersionRef, PortableResource, PersonaDraft,
} from './types.js';

type Result<T> = T | Promise<T>;
/** The material owner's public operations, also accepted by an asynchronous Host proxy. */
export interface MaterialsPanelApi {
  location(): Result<string>;
  createPersona(draft: PersonaDraft): Result<MaterialRecord>;
  revisePersona(id: string, draft: PersonaDraft): Result<MaterialVersion>;
  list(query: MaterialQuery): Result<MaterialSummary[]>;
  get(id: string): Result<MaterialRecord>;
  readVersion(ref: MaterialVersionRef): Result<MaterialVersion>;
  versions(id: string): Result<MaterialVersionRef[]>;
  revise(id: string, revision: MaterialRevision): Result<MaterialVersion>;
  metadata(id: string, patch: MaterialMetadata): Result<MaterialRecord>;
  copy(id: string): Result<MaterialRecord>;
  delete(id: string): Result<void>;
  exportOriginal(id: string): Result<FileResult>;
  exportCurrent(id: string): Result<FileResult>;
  resources(ref: MaterialVersionRef): Result<PortableResource[]>;
}
export interface MaterialsPanelProps {
  api: MaterialsPanelApi;
  onUpload(files: File[]): Result<unknown>;
  onDownload(file: FileResult): Result<void>;
}

const LABELS: Record<MaterialKind, string> = {
  character: '角色卡', persona: '我的人设', worldbook: '世界书', preset: '预设', regex: '正则',
  quick_reply: '快捷回复', theme: '主题', extension: '扩展配置', script: '脚本',
};
const FIELD_LABELS: Record<string, string> = {
  name: '名称', char_name: '角色名称', description: '描述', char_persona: '描述',
  personality: '性格', scenario: '场景', world_scenario: '场景', first_mes: '开场白',
  char_greeting: '开场白', alternate_greetings: '备选开场', mes_example: '示例对话',
  example_dialogue: '示例对话', system_prompt: '角色提示词', post_history_instructions: '后置指令',
  creator_notes: '作者备注', tags: '标签', entries: '世界书条目', character_book: '内嵌世界书',
  prompts: '提示词条目', prompt_order: '提示词顺序', extensions: '扩展字段',
  temperature: '温度', openai_max_tokens: '输出上限', max_tokens: '输出上限',
  reasoning_effort: '思考强度', stop: '停止串', qrList: '快捷回复内容', content: '内容',
  findRegex: '查找正则', replaceString: '替换内容', placement: '正则作用位置',
};
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const pretty = (value: JsonValue) => JSON.stringify(value, null, 2);
function parseJson(text: string): JsonValue {
  try { return validateJson(JSON.parse(text) as unknown); }
  catch (error) { throw new Error(`JSON 格式需要调整：${errorText(error)}`); }
}
type Field = { id: string; path: string[]; label: string; value: JsonValue };
function fieldsFor(raw: JsonValue): Field[] {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return [{ id: '$', path: [], label: '素材内容', value: raw }];
  const fields: Field[] = [];
  const add = (path: string[], value: JsonValue) => {
    const key = path[path.length - 1]!;
    fields.push({ id: path.map(part => part.replace(/~/gu, '~0').replace(/\./gu, '~1')).join('.'), path, label: FIELD_LABELS[key] ?? key, value });
  };
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'data' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nested, child] of Object.entries(value)) add(['data', nested], child);
    } else add([key], value);
  }
  return fields.length ? fields : [{ id: '$', path: [], label: '素材内容', value: raw }];
}
const fieldText = (field: Field) => typeof field.value === 'string' ? field.value : pretty(field.value);
function replaceField(raw: JsonValue, path: readonly string[], value: JsonValue): JsonValue {
  const [key, ...rest] = path;
  if (key === undefined) return value;
  const source = object(raw);
  return { ...source, [key]: replaceField(source[key] ?? null, rest, value) };
}
function imageUrl(resource: PortableResource): string | null {
  if (!/^image\/(?:png|jpeg|webp|gif|avif)$/u.test(resource.mediaType) || !/^[A-Za-z0-9+/]*={0,2}$/u.test(resource.base64)) return null;
  return `data:${resource.mediaType};base64,${resource.base64}`;
}
function avatarResource(resources: PortableResource[], raw: JsonValue): PortableResource | undefined {
  const images = resources.filter(resource => imageUrl(resource));
  const data = object(object(raw).data);
  const assets = Array.isArray(data.assets) ? data.assets : [];
  for (const asset of assets) {
    const entry = object(asset);
    if (entry.type !== 'icon' || typeof entry.uri !== 'string') continue;
    const localPath = entry.uri.replace(/^(?:(?:embedded|embeded):\/\/|__asset:)/u, '');
    const found = images.find(resource => resource.path === localPath);
    if (found) return found;
  }
  return images.find(resource => resource.path === 'ccdefault:')
    ?? images.find(resource => /(?:portrait|avatar|icon)/iu.test(resource.path)) ?? images[0];
}

/** A standalone view: uploads/downloads use the Client adapter, all mutations use the owner. */
export function MaterialsPanel({ api, onUpload, onDownload }: MaterialsPanelProps) {
  const [items, setItems] = useState<MaterialSummary[]>([]);
  const [catalog, setCatalog] = useState<MaterialSummary[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<MaterialKind | ''>('');
  const [category, setCategory] = useState('');
  const [enabled, setEnabled] = useState('all');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creatingPersona, setCreatingPersona] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [location, setLocation] = useState('');
  const uploadInput = useRef<HTMLInputElement>(null);
  const mutation = useRef(false);
  const changed = () => setRefresh(value => value + 1);
  const query = useMemo<MaterialQuery>(() => ({
    ...(search ? { search } : {}), ...(kind ? { kind } : {}), ...(category ? { category } : {}),
    ...(enabled === 'all' ? {} : { enabled: enabled === 'enabled' }),
  }), [search, kind, category, enabled]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    void (async () => {
      try {
        const [visible, all] = await Promise.all([api.list(query), api.list({})]);
        if (active) { setItems(visible); setCatalog(all); }
      } catch (cause) { if (active) setError(errorText(cause)); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [api, query, refresh]);

  async function run(operation: () => Promise<void>) {
    if (mutation.current) return;
    mutation.current = true; setPending(true); setError(''); setNotice('');
    try { await operation(); }
    catch (cause) { setError(errorText(cause)); }
    finally { mutation.current = false; setPending(false); }
  }
  async function upload(files: File[]) {
    if (!files.length) return;
    await run(async () => {
      try { await onUpload(files); setNotice('素材已导入'); }
      finally { changed(); }
    });
  }
  const categories = [...new Set(catalog.map(item => item.category).filter(Boolean))].sort();
  if (category && !categories.includes(category)) categories.push(category);
  return <section className="tk-rp tk-materials" aria-label="素材库">
    <style>{FORM_STYLES}{MATERIALS_STYLES}</style>
    <header className="mat-heading" data-tk-page-heading>
      <div className="mat-heading-copy">
        <svg className="mat-mark" viewBox="0 0 58 54" aria-hidden="true"><g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17q11-4 18 2 8-6 18-2v28q-11-4-18 1-8-5-18-1Z"/><path d="M29 20v25M17 25l6 1m-6 6 6 1m12-7 6-1m-6 8 6-1M30 16q-2-9 5-13m-5 9q-8-1-8-7 8 0 8 7m3-3q8 0 9-6-8-1-9 6"/></g></svg>
        <div><h1>素材库</h1><p>酒馆卡在本地导入和保存，全程不联网。</p></div>
      </div>
      <div className="mat-actions">
        <button type="button" disabled={pending} onClick={() => setCreatingPersona(true)}>新建我的人设</button>
        <button type="button" onClick={() => { setShowLocation(value => !value); if (!location) void run(async () => { setLocation(await api.location()); }); }}>存放位置</button>
        <button type="button" className="mat-primary" disabled={pending} onClick={() => uploadInput.current?.click()}>带上角色卡</button>
        <input ref={uploadInput} className="mat-file" type="file" aria-label="导入本地素材" multiple disabled={pending} accept=".png,.json,.charx,.zip,.js,.mjs,.cjs" onChange={event => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          void upload(files);
        }} />
      </div>
    </header>
    {showLocation && <div className="mat-location"><span>本地存放位置</span><code>{location || '正在读取…'}</code></div>}
    <div className="mat-collection">
    <div className="mat-collection-tools">
    <div className="mat-toolbar">
      <div className="mat-search"><input type="search" aria-label="搜索素材" placeholder="搜索名称、标签或内容" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <label className="mat-filter">分类<select aria-label="分类筛选" value={category} onChange={event => setCategory(event.target.value)}><option value="">全部分类</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="mat-filter">状态<select aria-label="启用状态筛选" value={enabled} onChange={event => setEnabled(event.target.value)}><option value="all">全部状态</option><option value="enabled">已启用</option><option value="disabled">已停用</option></select></label>
    </div>
    <nav className="mat-kinds" aria-label="素材类型">
      {(['', ...MATERIAL_KINDS] as const).map(value => <button type="button" key={value} aria-label={value ? LABELS[value] : '全部'} aria-pressed={kind === value} onClick={() => setKind(value)}>
        {value ? LABELS[value] : '全部'}<span aria-hidden="true">{value ? catalog.filter(item => item.kind === value).length : catalog.length}</span>
      </button>)}
    </nav>
    </div>
    <div className="mat-feedback" aria-live="polite">{notice && <span role="status">{notice}</span>}{pending && <span>正在处理…</span>}</div>
    {error && <div className="mat-error" role="alert"><span>{error}</span><button type="button" disabled={pending} onClick={changed}>重新读取</button></div>}
    <div className="mat-shelf-head"><h2>{kind ? LABELS[kind] : '本地收藏'}</h2><span>{loading ? '正在读取…' : `${items.length} 份素材`}</span></div>
    <div className="mat-grid" aria-label="本地素材" aria-busy={loading}>
      {items.map(item => <article className="mat-card" key={item.id} aria-label={item.name} data-kind={item.kind} data-enabled={item.enabled}>
        <button type="button" className="mat-card-open" aria-label={`查看 ${item.name}`} onClick={() => setSelected(item.id)}>
          <span className="mat-book" aria-hidden="true">{item.name.slice(0, 1)}</span>
          <span className="mat-card-title"><span>{LABELS[item.kind]}<span className="mat-dot">·</span>v{item.currentVersion}</span><strong>{item.name}</strong></span>
        </button>
        <div className="mat-card-foot"><div className="mat-card-tags"><span>{item.category || '未分类'}</span>{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          <button type="button" role="switch" aria-label={`${item.name}的启用状态`} aria-checked={item.enabled} className="mat-toggle" disabled={pending} onClick={() => { void run(async () => { await api.metadata(item.id, { enabled: !item.enabled }); changed(); }); }}><span aria-hidden="true" />{item.enabled ? '启用' : '停用'}</button>
        </div>
      </article>)}
      {!items.length && <div className="mat-empty">{loading ? <p>正在整理素材…</p> : catalog.length ? <><strong>没有找到这份素材</strong><p>换个关键词，或调整上方筛选。</p><button type="button" onClick={() => { setSearch(''); setKind(''); setCategory(''); setEnabled('all'); }}>查看全部</button></> : <><strong>把喜欢的角色带过来</strong><p>角色卡、世界书和预设，都在这里整理。</p><button type="button" disabled={pending} onClick={() => uploadInput.current?.click()}>选择本地文件</button></>}</div>}
    </div>
    <footer className="mat-count">{loading ? '正在读取…' : `显示 ${items.length} 份，共 ${catalog.length} 份素材`}</footer>
    </div>
    {creatingPersona && <CreatePersonaDialog api={api} onClose={() => setCreatingPersona(false)} onCreated={record => { changed(); setCreatingPersona(false); setSelected(record.id); }} />}
    {selected && <MaterialDrawer key={selected} id={selected} api={api} catalog={catalog} onDownload={onDownload} onChanged={changed} onClose={() => setSelected(null)} onCopied={record => { changed(); setSelected(record.id); }} />}
  </section>;
}

function CreatePersonaDialog({ api, onClose, onCreated }: { api: MaterialsPanelApi; onClose(): void; onCreated(record: MaterialRecord): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<PersonaDraft>({ name: '', description: '' });
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const busy = useRef(false);
  useEffect(() => { const element = dialog.current; if (!element) return; if (typeof element.showModal === 'function') element.showModal(); else element.setAttribute('open', ''); return () => { if (element.open && typeof element.close === 'function') element.close(); }; }, []);
  return <dialog ref={dialog} className="mat-drawer mat-persona-create" aria-label="新建我的人设" onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }}><header className="mat-drawer-head"><div><h2>新建我的人设</h2><p className="mat-muted">给不同的故事，留一张自己的名片。</p></div><button type="button" className="mat-close" disabled={pending} onClick={onClose}>收起</button></header><form className="mat-drawer-body" onSubmit={event => { event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true); setError(''); void (async () => { try { onCreated(await api.createPersona(draft)); } catch (cause) { setError(errorText(cause)); } finally { busy.current = false; setPending(false); } })(); }}><section className="mat-paper"><PersonaFields draft={draft} onChange={setDraft} disabled={pending} /></section>{error && <p className="mat-error" role="alert">{error}</p>}<div className="mat-save-row"><span className="mat-muted">保存到本地素材库，开聊时直接选用。</span><button type="submit" className="mat-primary" disabled={pending}>保存人设</button></div></form></dialog>;
}

function MaterialDrawer({ id, api, catalog, onDownload, onChanged, onClose, onCopied }: {
  id: string; api: MaterialsPanelApi; catalog: MaterialSummary[];
  onDownload: MaterialsPanelProps['onDownload']; onChanged(): void; onClose(): void; onCopied(record: MaterialRecord): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [record, setRecord] = useState<MaterialRecord | null>(null);
  const [version, setVersion] = useState<MaterialVersion | null>(null);
  const [versions, setVersions] = useState<MaterialVersionRef[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [metadata, setMetadata] = useState({ name: '', category: '', tags: '' });
  const [raw, setRaw] = useState<JsonValue>(null);
  const [rawText, setRawText] = useState('');
  const [mode, setMode] = useState<'form' | 'fields' | 'raw'>('fields');
  const [fieldId, setFieldId] = useState('');
  const [valueText, setValueText] = useState('');
  const [dirty, setDirty] = useState(false);
  const [bindings, setBindings] = useState<MaterialBindings>({ worldbooks: [], preset: null });
  const [resources, setResources] = useState<PortableResource[]>([]);
  const [resourceError, setResourceError] = useState('');
  const [resourceAttempt, setResourceAttempt] = useState(0);
  const busy = useRef(false);
  const fieldIdPrefix = useId();
  const fields = fieldsFor(raw);
  const field = fields.find(item => item.id === fieldId) ?? fields[0]!;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    return () => { if (element.open && typeof element.close === 'function') element.close(); };
  }, []);
  function resetEditor(next: MaterialVersion) {
    setVersion(next); setRaw(next.raw); setRawText(pretty(next.raw)); setBindings(next.bindings); setDirty(false); setMode(hasTypedForm(next.projection.kind) ? 'form' : 'fields');
    const options = fieldsFor(next.raw);
    const initial = options.find(item => item.path.at(-1) === 'description') ?? options[0]!;
    setFieldId(initial.id); setValueText(fieldText(initial));
  }
  useEffect(() => {
    let active = true;
    setError('');
    void (async () => {
      try {
        const [next, refs] = await Promise.all([api.get(id), api.versions(id)]);
        if (!active) return;
        setRecord(next); setMetadata({ name: next.name, category: next.category, tags: next.tags.join('，') });
        setVersions(refs); resetEditor(next.current);
      } catch (cause) { if (active) setError(errorText(cause)); }
    })();
    return () => { active = false; };
  }, [api, id, attempt]);
  useEffect(() => {
    let active = true;
    setResources([]); setResourceError('');
    if (version) void (async () => {
      try { const value = await api.resources({ id, version: version.version }); if (active) setResources(value); }
      catch (cause) { if (active) setResourceError(errorText(cause)); }
    })();
    return () => { active = false; };
  }, [api, id, version?.version, resourceAttempt]);
  async function perform(operation: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true; setPending(true); setError(''); setNotice('');
    try { await operation(); }
    catch (cause) { setError(errorText(cause)); }
    finally { busy.current = false; setPending(false); }
  }
  function fieldDocument(): JsonValue {
    const value = typeof field.value === 'string' ? valueText : parseJson(valueText);
    return replaceField(raw, field.path, value);
  }
  function switchMode(next: 'form' | 'fields' | 'raw') {
    if (next === mode) return;
    try {
      const document = mode === 'raw' ? parseJson(rawText) : mode === 'form' ? raw : fieldDocument();
      if (next === 'form' && record) projectMaterial(document, record.name, record.kind);
      setRaw(document); setRawText(pretty(document));
      const options = fieldsFor(document);
      const current = options.find(item => item.id === fieldId) ?? options[0]!;
      setFieldId(current.id); setValueText(fieldText(current)); setMode(next); setError('');
    } catch (cause) { setError(errorText(cause)); }
  }
  function selectField(nextId: string) {
    try {
      const document = fieldDocument();
      const next = fieldsFor(document).find(item => item.id === nextId);
      if (!next) return;
      setRaw(document); setFieldId(next.id); setValueText(fieldText(next)); setError('');
    } catch (cause) { setError(errorText(cause)); }
  }
  const avatar = version ? avatarResource(resources, version.raw) : undefined;
  const avatarUrl = avatar ? imageUrl(avatar) : null;
  return <dialog ref={dialog} className="mat-drawer" aria-label={record ? `${record.name} · 素材详情` : '素材详情'} onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }} onClick={event => { if (event.target === event.currentTarget && !busy.current) onClose(); }}>
    <div className="mat-drawer-head">
      {avatarUrl ? <img className="mat-avatar mat-detail-avatar" src={avatarUrl} alt={`${record?.name ?? '角色'}的本地头像`} /> : <span className="mat-avatar mat-detail-avatar" aria-hidden="true">{record?.name.slice(0, 1) ?? '卡'}</span>}
      <div><h2>{record?.name ?? '素材详情'}</h2><span className="mat-muted">{record ? `${LABELS[record.kind]} · 当前 v${record.currentVersion}` : '正在读取…'}</span></div>
      <button type="button" className="mat-close" disabled={pending} aria-label="关闭素材详情" onClick={onClose}>收起</button>
    </div>
    <div className="mat-drawer-body">
      {error && <div className="mat-error" role="alert"><span>{error}</span>{!record && <button type="button" onClick={() => setAttempt(value => value + 1)}>重新读取</button>}</div>}
      {notice && <div className="mat-notice" role="status">{notice}</div>}
      {record && version && <>
        <form className="mat-paper mat-meta" onSubmit={event => { event.preventDefault(); void perform(async () => {
          const saved = await api.metadata(id, { name: metadata.name, category: metadata.category, tags: metadata.tags.split(/[,，\n]/u).map(tag => tag.trim()).filter(Boolean) });
          setRecord(saved); setMetadata({ name: saved.name, category: saved.category, tags: saved.tags.join('，') }); setNotice('资料已保存'); onChanged();
        }); }}>
          <div className="mat-section-head"><h3>整理资料</h3><button type="submit" disabled={pending}>保存资料</button></div>
          <div className="mat-meta-grid">
            <label>素材名称<input aria-label="素材名称" required value={metadata.name} disabled={pending} onChange={event => setMetadata({ ...metadata, name: event.target.value })} /></label>
            <label>分类<input aria-label="素材分类" list={`${fieldIdPrefix}-categories`} value={metadata.category} disabled={pending} placeholder="如：常玩、收藏" onChange={event => setMetadata({ ...metadata, category: event.target.value })} /><datalist id={`${fieldIdPrefix}-categories`}>{[...new Set(catalog.map(item => item.category).filter(Boolean))].map(value => <option key={value} value={value} />)}</datalist></label>
            <label className="mat-wide">标签<input aria-label="素材标签" value={metadata.tags} disabled={pending} placeholder="用逗号分开" onChange={event => setMetadata({ ...metadata, tags: event.target.value })} /></label>
          </div>
        </form>
        <section className="mat-paper mat-editor" aria-label="版本内容">
          <div className="mat-section-head"><h3>内容与版本</h3><label className="mat-inline">版本<select aria-label="素材版本" value={version.version} disabled={pending} onChange={event => { const nextVersion = Number(event.target.value); void perform(async () => { resetEditor(await api.readVersion({ id, version: nextVersion })); }); }}>{versions.map(ref => <option key={ref.version} value={ref.version}>v{ref.version}{ref.version === record.currentVersion ? ' · 当前' : ''}</option>)}</select></label></div>
          <div className="mat-edit-tabs" role="group" aria-label="编辑方式">{hasTypedForm(record.kind) && <button type="button" aria-pressed={mode === 'form'} disabled={pending} onClick={() => switchMode('form')}>表单编辑</button>}<button type="button" aria-pressed={mode === 'fields'} disabled={pending} onClick={() => switchMode('fields')}>字段编辑</button><button type="button" aria-pressed={mode === 'raw'} disabled={pending} onClick={() => switchMode('raw')}>原始 JSON</button><span className="mat-muted">{dirty ? '尚未保存' : `正在查看 v${version.version}`}</span></div>
          {mode === 'form' ? <MaterialForm key={`${version.id}:${version.version}`} kind={record.kind} raw={raw} disabled={pending} onChange={value => { setRaw(value); setDirty(true); }} /> : mode === 'raw' ? <label className="mat-json-label">完整 JSON<textarea aria-label="原始 JSON 内容" className="mat-code" spellCheck={false} value={rawText} disabled={pending} onChange={event => { setRawText(event.target.value); setDirty(true); }} /></label> : <>
            <label className="mat-field-picker">编辑字段<select aria-label="编辑字段" value={field.id} disabled={pending} onChange={event => selectField(event.target.value)}>{fields.map(item => <option key={item.id} value={item.id}>{item.label} · {item.path.join('.') || '全部内容'}</option>)}</select></label>
            <label className="mat-json-label"><span>{field.label}<small>{typeof field.value === 'string' ? '文字' : 'JSON'}</small></span><textarea aria-label="字段内容" spellCheck={false} className={typeof field.value === 'string' ? '' : 'mat-code'} value={valueText} disabled={pending} onChange={event => { setValueText(event.target.value); setDirty(true); }} /></label>
          </>}
          {record.kind === 'character' && <BindingsEditor api={api} catalog={catalog} value={bindings} disabled={pending} onChange={value => { setBindings(value); setDirty(true); }} />}
          <div className="mat-save-row"><span className="mat-muted">保存后生成新版本，原件和旧版保留。</span><button type="button" className="mat-primary" disabled={pending} onClick={() => { void perform(async () => {
            const next = await api.revise(id, { raw: mode === 'raw' ? parseJson(rawText) : mode === 'form' ? raw : fieldDocument(), bindings });
            const refs = await api.versions(id);
            setRecord({ ...record, currentVersion: next.version, current: next }); setVersions(refs); resetEditor(next); setNotice(`已保存为 v${next.version}`); onChanged();
          }); }}>保存为新版本</button></div>
        </section>
        <div className="mat-capabilities"><CapabilitySection title="本次使用" items={version.capabilities.filter(item => item.status === 'used')} /><CapabilitySection title="原文件已保存" items={version.capabilities.filter(item => item.status === 'archived')} /></div>
        {(resources.length > 0 || resourceError) && <details className="mat-paper mat-resources"><summary>本地资源 <span>{resources.length} 份</span></summary>{resourceError ? <div className="mat-error"><span>{resourceError}</span><button type="button" onClick={() => setResourceAttempt(value => value + 1)}>重新读取资源</button></div> : <div className="mat-resource-grid">{resources.map(resource => {
          const url = imageUrl(resource);
          return <figure key={resource.path}>{url && <img src={url} alt={resource.path} loading="lazy" />}<figcaption title={resource.path}>{resource.path}<small>{resource.mediaType}</small></figcaption></figure>;
        })}</div>}</details>}
        <section className="mat-paper mat-file-actions" aria-label="文件管理"><div><h3>带走这份素材</h3><span className="mat-muted">原件保留完整图片与包内资源，当前版本导出为 JSON。</span></div><div className="mat-actions"><button type="button" disabled={pending} onClick={() => { void perform(async () => { await onDownload(await api.exportOriginal(id)); setNotice('原件已准备好'); }); }}>导出原件</button><button type="button" disabled={pending} onClick={() => { void perform(async () => { await onDownload(await api.exportCurrent(id)); setNotice('当前版本已准备好'); }); }}>导出当前版本</button></div></section>
        <div className="mat-maintenance"><button type="button" disabled={pending} onClick={() => { void perform(async () => onCopied(await api.copy(id))); }}>复制素材</button><button type="button" className="mat-danger" disabled={pending} onClick={() => setRemoving(true)}>移出素材库</button></div>
        {removing && <section className="mat-paper mat-remove" role="alertdialog" aria-label="确认移出素材"><div><strong>移出「{record.name}」？</strong><p>已有对话仍保留所需版本。</p></div><div className="mat-actions"><button type="button" autoFocus disabled={pending} onClick={() => setRemoving(false)}>取消</button><button type="button" className="mat-danger" disabled={pending} onClick={() => { void perform(async () => { await api.delete(id); onChanged(); onClose(); }); }}>确认移出</button></div></section>}
      </>}
    </div>
  </dialog>;
}

function CapabilitySection({ title, items }: { title: string; items: MaterialCapability[] }) {
  return <section className="mat-paper mat-capability" aria-label={title}><h3>{title}<span>{items.length}</span></h3><div className="mat-capability-items">{items.length ? items.map((item, index) => <div key={`${item.path}-${index}`}><strong>{item.label}</strong>{item.reason && <span>{item.reason}</span>}<code>{item.path || '整份素材'}</code></div>) : <p className="mat-muted">{title === '本次使用' ? '这份素材作为原件整理保存。' : '没有额外归档字段。'}</p>}</div></section>;
}

function BindingsEditor({ api, catalog, value, disabled, onChange }: {
  api: MaterialsPanelApi; catalog: MaterialSummary[]; value: MaterialBindings; disabled: boolean; onChange(value: MaterialBindings): void;
}) {
  const [versions, setVersions] = useState<Record<string, MaterialVersionRef[]>>({});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const ids = [...value.worldbooks.map(ref => ref.id), ...(value.preset ? [value.preset.id] : [])];
  const idsKey = JSON.stringify(ids);
  useEffect(() => {
    let active = true;
    setError('');
    void (async () => {
      try {
        const entries = await Promise.all(ids.map(async id => [id, await api.versions(id)] as const));
        if (active) setVersions(Object.fromEntries(entries));
      } catch (cause) { if (active) setError(errorText(cause)); }
    })();
    return () => { active = false; };
  }, [api, idsKey, attempt]);
  const books = catalog.filter(item => item.kind === 'worldbook');
  const missingBooks = value.worldbooks.filter(ref => !books.some(book => book.id === ref.id));
  const bookOptions = [...books.map(book => ({ id: book.id, name: book.name, version: book.currentVersion })), ...missingBooks.map(ref => ({ ...ref, name: '已移出的世界书' }))];
  const presets = catalog.filter(item => item.kind === 'preset');
  const versionNumbers = (id: string, fallback: number) => [...new Set([fallback, ...(versions[id] ?? []).map(ref => ref.version)])].sort((a, b) => b - a);
  return <div className="mat-bindings"><h4>一起使用的设定</h4>
    <div className="mat-bound-books">{bookOptions.length ? bookOptions.map(book => {
      const ref = value.worldbooks.find(ref => ref.id === book.id);
      return <div className="mat-binding-row" key={book.id}><label><input type="checkbox" aria-label={`绑定世界书 ${book.name}`} checked={!!ref} disabled={disabled} onChange={event => onChange({ ...value, worldbooks: event.target.checked ? [...value.worldbooks, { id: book.id, version: book.version }] : value.worldbooks.filter(ref => ref.id !== book.id) })} />{book.name}</label><select aria-label={`${book.name}的版本`} disabled={disabled || !ref} value={ref?.version ?? book.version} onChange={event => onChange({ ...value, worldbooks: value.worldbooks.map(current => current.id === book.id ? { ...current, version: Number(event.target.value) } : current) })}>{versionNumbers(book.id, ref?.version ?? book.version).map(version => <option key={version} value={version}>v{version}</option>)}</select></div>;
    }) : <p className="mat-muted">导入世界书后，可以在这里搭配。</p>}</div>
    <div className="mat-binding-row"><label className="mat-preset-label">预设<select aria-label="绑定预设" disabled={disabled} value={value.preset?.id ?? ''} onChange={event => { const preset = presets.find(item => item.id === event.target.value); onChange({ ...value, preset: preset ? { id: preset.id, version: preset.currentVersion } : null }); }}><option value="">不绑定预设</option>{presets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}{value.preset && !presets.some(item => item.id === value.preset?.id) && <option value={value.preset.id}>已移出的预设</option>}</select></label>{value.preset && <select aria-label="预设版本" disabled={disabled} value={value.preset.version} onChange={event => onChange({ ...value, preset: { id: value.preset!.id, version: Number(event.target.value) } })}>{versionNumbers(value.preset.id, value.preset.version).map(version => <option key={version} value={version}>v{version}</option>)}</select>}</div>
    {error && <div className="mat-error"><span>{error}</span><button type="button" disabled={disabled} onClick={() => setAttempt(value => value + 1)}>重新读取版本</button></div>}
  </div>;
}
