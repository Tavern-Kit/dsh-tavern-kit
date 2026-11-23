import { useEffect, useRef, useState } from 'react';
import { object, text, number, strings } from './json.js';
import { projectMaterial } from './projection.js';
import { readPersona } from './persona.js';
import type { JsonObject, JsonValue, MaterialKind, PersonaDraft } from './types.js';

type EditorProps = { raw: JsonValue; disabled: boolean; onChange(raw: JsonValue): void };
const words = (value: string) => value.split(/[,，\n]/u).map(part => part.trim()).filter(Boolean);
function at(raw: JsonValue, path: readonly string[]): JsonValue {
  let value = raw;
  for (const key of path) value = Array.isArray(value) ? value[Number(key)] ?? null : object(value)[key] ?? null;
  return value;
}
function setAt(raw: JsonValue, path: readonly string[], value: JsonValue): JsonValue {
  const [key, ...rest] = path;
  if (key === undefined) return value;
  if (Array.isArray(raw)) return raw.map((item, index) => index === Number(key) ? setAt(item, rest, value) : item);
  return { ...object(raw), [key]: setAt(object(raw)[key] ?? null, rest, value) };
}
function entriesAt(raw: JsonValue, path: readonly string[]): [string, JsonObject][] {
  return Object.entries(at(raw, path) ?? {}).map(([key, value]) => [key, object(value)]);
}
function NumberField({ label, value, onChange, optional = false, min = 0, disabled = false }: { label: string; value: JsonValue | undefined; optional?: boolean; min?: number; disabled?: boolean; onChange(value: number | null): void }) {
  return <label>{label}<input type="number" min={min} step="1" aria-label={label} disabled={disabled} value={value === undefined || value === null ? '' : Number(value)} onChange={event => onChange(event.target.value === '' && optional ? null : Number(event.target.value))} /></label>;
}
function KeywordField({ label, value, disabled, onChange }: { label: string; value: string[]; disabled: boolean; onChange(value: string[]): void }) {
  const [draft, setDraft] = useState(value.join('，'));
  const keywords = JSON.stringify(value), formatted = value.join('，');
  useEffect(() => {
    // Local edits already represent these keywords; keep their separators and caret.
    setDraft(current => JSON.stringify(words(current)) === keywords ? current : formatted);
  }, [keywords, formatted]);
  return <label>{label}<input aria-label={label} value={draft} disabled={disabled} onChange={event => { setDraft(event.target.value); onChange(words(event.target.value)); }} /></label>;
}
function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; disabled: boolean; onChange(value: boolean): void }) {
  return <label className="mat-check"><input type="checkbox" aria-label={label} checked={value} disabled={disabled} onChange={event => onChange(event.target.checked)} />{label}</label>;
}
function ItemPicker({ label, items, selected, onSelect, onAdd, disabled }: { label: string; items: { id: string; name: string; enabled?: boolean }[]; selected: string; onSelect(id: string): void; onAdd(): void; disabled: boolean }) {
  return <div className="mat-entry-picker"><label>{label}<select aria-label={label} value={selected} disabled={disabled || !items.length} onChange={event => onSelect(event.target.value)}>{items.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.name}{item.enabled === false ? ' · 停用' : ''}</option>)}</select></label><button type="button" disabled={disabled} onClick={onAdd}>添加条目</button></div>;
}

/** Edits only the selected entry in its original container, preserving extension fields. */
export function WorldbookForm({ raw, disabled, onChange }: EditorProps) {
  const path = object(object(raw).data).entries !== undefined ? ['data'] : [];
  const book = object(at(raw, path));
  const entries = entriesAt(raw, [...path, 'entries']);
  const [selection, setSelection] = useState(entries[0]?.[0] ?? '');
  const selectionExists = entries.some(([key]) => key === selection);
  const key = selectionExists ? selection : entries[0]?.[0] ?? '';
  const selected = entries.find(([entryKey]) => entryKey === key);
  const entry = selected?.[1] ?? {};
  const ext = object(entry.extensions);
  const role = entry.role ?? ext.role;
  const patchBook = (patch: JsonObject) => onChange(setAt(raw, path, { ...book, ...patch }));
  const patch = (value: JsonObject) => onChange(setAt(raw, [...path, 'entries', key], { ...entry, ...value }));
  const position = ext.position ?? entry.position ?? 0;
  const place = position === 4 || position === 'depth' || position === 'at_depth' ? 'depth' : position === 1 || position === 'after' || position === 'after_char' ? 'after' : 'before';
  const add = () => {
    const ids = new Set(entries.map(([id]) => id)); let id = String(entries.length);
    while (ids.has(id)) id = String(Number(id) + 1);
    const value: JsonObject = { uid: Number(id), name: '新条目', keys: [], content: '', enabled: true, position: 0 };
    const source = book.entries;
    patchBook({ entries: Array.isArray(source) ? [...source, value] : { ...object(source), [id]: value } }); setSelection(id);
  };
  return <div className="mat-typed-editor">
    <div className="mat-form-grid"><NumberField label="世界书预算" optional value={book.token_budget ?? book.budget} disabled={disabled} onChange={value => patchBook({ token_budget: value })} /><NumberField label="扫描最近消息数" optional value={book.scan_depth ?? book.scanDepth} disabled={disabled} onChange={value => patchBook({ scan_depth: value })} /></div>
    <ItemPicker label="世界书条目" disabled={disabled} items={entries.map(([id, item]) => ({ id, name: text(item.comment ?? item.name, `条目 ${id}`), enabled: item.enabled !== false && item.disable !== true && item.disabled !== true }))} selected={key} onSelect={setSelection} onAdd={add} />
    {selected && <>
      <div className="mat-form-grid"><label>条目名称<input aria-label="条目名称" value={text(entry.comment ?? entry.name)} disabled={disabled} onChange={event => patch({ comment: event.target.value })} /></label><div className="mat-check-row"><Toggle label="启用条目" disabled={disabled} value={entry.enabled !== false && entry.disable !== true && entry.disabled !== true} onChange={value => patch({ enabled: value, disable: !value, disabled: !value })} /><Toggle label="常驻条目" disabled={disabled} value={entry.constant === true} onChange={value => patch({ constant: value })} /></div></div>
      <div className="mat-form-grid"><KeywordField key={`${key}:primary`} label="主关键词" value={strings(entry.keys ?? entry.key)} disabled={disabled} onChange={value => patch({ [entry.keys !== undefined ? 'keys' : 'key']: value })} /><KeywordField key={`${key}:secondary`} label="副关键词" value={strings(entry.secondary_keys ?? entry.keysecondary)} disabled={disabled} onChange={value => patch({ [entry.secondary_keys !== undefined ? 'secondary_keys' : 'keysecondary']: value })} /></div>
      <div className="mat-form-grid"><Toggle label="启用副关键词组合" disabled={disabled} value={typeof entry.selective === 'boolean' ? entry.selective : strings(entry.secondary_keys ?? entry.keysecondary).length > 0} onChange={value => patch({ selective: value })} /><label>副关键词组合<select aria-label="副关键词组合" value={number(entry.selectiveLogic ?? ext.selectiveLogic, 0)} disabled={disabled} onChange={event => patch({ selectiveLogic: Number(event.target.value) })}><option value={0}>命中任意一个</option><option value={1}>不全命中</option><option value={2}>全部不命中</option><option value={3}>全部命中</option></select></label></div>
      <label>条目内容<textarea aria-label="条目内容" value={text(entry.content)} disabled={disabled} onChange={event => patch({ content: event.target.value })} /></label>
      <div className="mat-form-grid"><label>插入位置<select aria-label="插入位置" disabled={disabled} value={place} onChange={event => { const value = event.target.value === 'after' ? 1 : event.target.value === 'depth' ? 4 : 0; patch({ position: value, ...(ext.position === undefined ? {} : { extensions: { ...ext, position: value } }) }); }}><option value="before">角色设定之前</option><option value="after">角色设定之后</option><option value="depth">聊天深度</option></select></label><label>条目消息角色<select aria-label="条目消息角色" disabled={disabled} value={role === 'assistant' || role === 2 ? 'assistant' : role === 'user' || role === 1 ? 'user' : 'system'} onChange={event => patch({ role: event.target.value })}><option value="system">系统</option><option value="user">玩家</option><option value="assistant">角色</option></select></label><NumberField label="插入深度" value={entry.depth ?? ext.depth ?? 4} disabled={disabled} onChange={value => patch({ depth: value })} /><NumberField label="条目顺序" value={entry.insertion_order ?? entry.order ?? 100} disabled={disabled} onChange={value => patch({ insertion_order: value, order: value })} /><NumberField label="条目扫描深度" optional value={entry.scanDepth ?? entry.scan_depth ?? ext.scan_depth ?? ext.scanDepth} disabled={disabled} onChange={value => patch({ scanDepth: value })} /></div>
      <div className="mat-check-row"><Toggle label="区分大小写" disabled={disabled} value={(entry.case_sensitive ?? entry.caseSensitive ?? ext.case_sensitive ?? ext.caseSensitive) === true} onChange={value => patch({ case_sensitive: value })} /><Toggle label="整词匹配" disabled={disabled} value={(entry.matchWholeWords ?? ext.matchWholeWords) === true} onChange={value => patch({ matchWholeWords: value })} /><button type="button" className="mat-danger" disabled={disabled} onClick={() => { const source = book.entries; if (Array.isArray(source)) patchBook({ entries: source.filter((_, index) => index !== Number(key)) }); else { const next = { ...object(source) }; delete next[key]; patchBook({ entries: next }); } }}>删除条目</button></div>
    </>}
  </div>;
}

function orderSet(raw: JsonValue): { root: JsonObject; sets: JsonValue[]; index: number; selected: JsonObject; order: JsonObject[] } {
  const root = object(raw), sets = Array.isArray(root.prompt_order) ? root.prompt_order : [];
  let index = sets.findIndex(item => object(item).character_id === 100001);
  if (index < 0) index = sets.findIndex(item => object(item).character_id === 100000);
  if (index < 0) index = 0;
  const selected = object(sets[index]);
  return { root, sets, index, selected, order: (Array.isArray(selected.order) ? selected.order : []).map(object) };
}
function saveOrder(raw: JsonValue, ids: string[], enabled: ReadonlyMap<string, boolean>): JsonValue {
  const { root, sets, index, selected, order } = orderSet(raw);
  const next = [...sets];
  next[index] = { ...selected, character_id: selected.character_id ?? 100001, order: ids.map(identifier => ({ ...order.find(item => item.identifier === identifier), identifier, enabled: enabled.get(identifier) !== false })) };
  return { ...root, prompt_order: next };
}
export function PresetForm({ raw, disabled, onChange }: EditorProps) {
  const prompts = projectMaterial(raw, '预设.json', 'preset').projection.preset!.prompts;
  const [selection, setSelection] = useState(prompts[0]?.identifier ?? '');
  const selected = prompts.find(item => item.identifier === selection) ?? prompts[0];
  const root = object(raw), source = Array.isArray(root.prompts) ? root.prompts : [];
  const sourceIndex = selected ? Number(selected.sourcePath.split('.').at(-1)) : -1;
  const entry = object(source[sourceIndex]);
  const patch = (value: JsonObject) => onChange({ ...root, prompts: source.map((item, index) => index === sourceIndex ? { ...object(item), ...value } : item) });
  const enable = (value: boolean) => { const updated: JsonValue = { ...root, prompts: source.map((item, index) => index === sourceIndex ? { ...object(item), enabled: value, disabled: !value } : item) }; const enabled = new Map(prompts.map(item => [item.identifier, item.identifier === selected?.identifier ? value : item.enabled])); onChange(saveOrder(updated, prompts.map(item => item.identifier), enabled)); };
  const move = (delta: number) => { const index = prompts.findIndex(item => item.identifier === selected?.identifier), target = index + delta; if (target < 0 || target >= prompts.length) return; const ids = prompts.map(item => item.identifier); [ids[index], ids[target]] = [ids[target]!, ids[index]!]; onChange(saveOrder(raw, ids, new Map(prompts.map(item => [item.identifier, item.enabled])))); };
  const add = () => { let count = source.length + 1; while (prompts.some(item => item.identifier === `prompt-${count}`)) count++; const identifier = `prompt-${count}`; const updated = { ...root, prompts: [...source, { identifier, name: '新提示词', role: 'system', content: '', enabled: true }] }; onChange(saveOrder(updated, [...prompts.map(item => item.identifier), identifier], new Map([...prompts.map(item => [item.identifier, item.enabled] as const), [identifier, true]]))); setSelection(identifier); };
  return <div className="mat-typed-editor"><ItemPicker label="提示词条目" disabled={disabled} items={prompts.map(item => ({ id: item.identifier, name: item.name, enabled: item.enabled }))} selected={selected?.identifier ?? ''} onSelect={setSelection} onAdd={add} />
    {selected && <><div className="mat-form-grid"><label>条目名称<input aria-label="条目名称" disabled={disabled} value={selected.name} onChange={event => patch({ name: event.target.value })} /></label><Toggle label="启用条目" disabled={disabled} value={selected.enabled} onChange={enable} /><label>消息角色<select aria-label="消息角色" disabled={disabled} value={selected.role} onChange={event => patch({ role: event.target.value })}><option value="system">系统</option><option value="user">玩家</option><option value="assistant">角色</option></select></label><label>提示词位置<select aria-label="提示词位置" disabled={disabled} value={selected.position} onChange={event => patch({ injection_position: event.target.value === 'depth' ? 1 : 0 })}><option value="relative">按预设顺序</option><option value="depth">聊天深度</option></select></label><NumberField label="插入深度" disabled={disabled} value={selected.depth} onChange={value => patch({ injection_depth: value })} /></div>
      {selected.marker && <p className="mat-muted">这是占位块，实际内容来自角色、历史或世界书。</p>}
      <label>提示词内容<textarea aria-label="提示词内容" disabled={disabled} value={selected.content} onChange={event => patch({ [entry.content !== undefined ? 'content' : entry.prompt !== undefined ? 'prompt' : entry.value !== undefined ? 'value' : 'content']: event.target.value })} /></label>
      <div className="mat-actions"><button type="button" aria-label="向上移动条目" disabled={disabled || prompts[0]?.identifier === selected.identifier} onClick={() => move(-1)}>上移</button><button type="button" aria-label="向下移动条目" disabled={disabled || prompts.at(-1)?.identifier === selected.identifier} onClick={() => move(1)}>下移</button><button type="button" className="mat-danger" disabled={disabled} onClick={() => { const updated = { ...root, prompts: source.filter((_, index) => index !== sourceIndex) }; onChange(saveOrder(updated, prompts.filter(item => item.identifier !== selected.identifier).map(item => item.identifier), new Map(prompts.map(item => [item.identifier, item.enabled])))); }}>删除条目</button><span className="mat-muted">标识：{selected.identifier}</span></div>
    </>}
  </div>;
}

function parsePattern(value: string): RegExp {
  if (!value) throw new Error('请先填写查找正则');
  if (value.startsWith('/')) { const end = value.lastIndexOf('/'); if (end > 0) return new RegExp(value.slice(1, end), value.slice(end + 1)); }
  return new RegExp(value, 'g');
}
export function RegexForm({ raw, disabled, onChange }: EditorProps) {
  const root = object(raw), wrapped = Array.isArray(root.__content__);
  const list = Array.isArray(raw) ? raw : wrapped ? root.__content__ as JsonValue[] : [raw];
  const [selection, setSelection] = useState('0'), [sample, setSample] = useState(''), [result, setResult] = useState<{ matches: string[]; text: string } | null>(null), [error, setError] = useState('');
  const index = Math.min(Number(selection), Math.max(0, list.length - 1));
  const entry = object(list[index]);
  const saveList = (next: JsonValue[]) => onChange(Array.isArray(raw) ? next : wrapped ? { ...root, __content__: next } : next.length === 1 ? next[0]! : next);
  const patch = (value: JsonObject) => { saveList(list.map((item, i) => i === index ? { ...object(item), ...value } : item)); setResult(null); setError(''); };
  const scope = entry.markdownOnly === true && entry.promptOnly !== true ? 'display' : entry.promptOnly === true && entry.markdownOnly !== true ? 'model' : 'both';
  const placements = Array.isArray(entry.placement) ? entry.placement : [entry.placement ?? 2];
  const trial = () => {
    try {
      const pattern = parsePattern(text(entry.findRegex));
      const capturePattern = new RegExp(pattern.source, pattern.flags);
      const captures = pattern.global ? [...sample.matchAll(capturePattern)] : (() => { const match = capturePattern.exec(sample); return match ? [match] : []; })();
      const output = sample.replace(new RegExp(pattern.source, pattern.flags), (...args: unknown[]) => {
        const named = args.at(-1);
        return text(entry.replaceString).replace(/\{\{match\}\}/giu, '$0').replace(/\$(\d+)|\$<([^>]+)>/gu, (_whole, index: string | undefined, name: string | undefined) => {
          let value = index ? args[Number(index)] : name && named && typeof named === 'object' ? object(named as JsonValue)[name] : '';
          if (typeof value !== 'string') value = '';
          for (const trim of strings(entry.trimStrings)) if (trim) value = (value as string).split(trim).join('');
          return value as string;
        });
      });
      setResult({ matches: captures.map(match => match[0]), text: output }); setError('');
    } catch (cause) { setResult(null); setError(`正则规则需要调整：${cause instanceof Error ? cause.message : String(cause)}`); }
  };
  return <div className="mat-typed-editor"><ItemPicker label="正则条目" disabled={disabled} items={list.map((item, i) => ({ id: String(i), name: text(object(item).scriptName ?? object(item).name, `正则 ${i + 1}`), enabled: object(item).disabled !== true }))} selected={String(index)} onSelect={value => { setSelection(value); setResult(null); setError(''); }} onAdd={() => { saveList([...list, { scriptName: '新正则', findRegex: '', replaceString: '', placement: [2], disabled: false }]); setSelection(String(list.length)); }} />
    {!!list.length && <><div className="mat-form-grid"><label>条目名称<input aria-label="条目名称" disabled={disabled} value={text(entry.scriptName ?? entry.name)} onChange={event => patch({ scriptName: event.target.value })} /></label><Toggle label="启用条目" disabled={disabled} value={entry.disabled !== true} onChange={value => patch({ disabled: !value })} /><label>作用范围<select aria-label="作用范围" disabled={disabled} value={scope} onChange={event => patch({ markdownOnly: event.target.value === 'display', promptOnly: event.target.value === 'model' })}><option value="both">模型与显示</option><option value="model">仅模型</option><option value="display">仅显示</option></select></label><Toggle label="编辑时执行" disabled={disabled} value={entry.runOnEdit === true} onChange={value => patch({ runOnEdit: value })} /></div>
      <div className="mat-check-row" role="group" aria-label="正则作用位置">{([[1, '玩家输入'], [2, '角色输出'], [5, '世界书'], [6, '思考内容']] as const).map(([value, label]) => <Toggle key={value} label={label} disabled={disabled} value={placements.includes(value)} onChange={enabled => patch({ placement: enabled ? [...placements, value] : placements.filter(item => item !== value) })} />)}</div>
      <label>查找正则<input aria-label="查找正则" spellCheck={false} disabled={disabled} value={text(entry.findRegex)} onChange={event => patch({ findRegex: event.target.value })} /></label><label>替换内容<textarea aria-label="替换内容" disabled={disabled} value={text(entry.replaceString)} onChange={event => patch({ replaceString: event.target.value })} /></label>
      <div className="mat-form-grid"><NumberField label="最小深度" optional disabled={disabled} value={entry.minDepth} onChange={value => patch({ minDepth: value })} /><NumberField label="最大深度" optional disabled={disabled} value={entry.maxDepth} onChange={value => patch({ maxDepth: value })} /></div>
      <section className="mat-regex-trial"><div className="mat-section-head"><h4>试一小段</h4><button type="button" disabled={disabled} onClick={trial}>本地试运行</button></div><label>试运行文本<textarea aria-label="试运行文本" value={sample} onChange={event => { setSample(event.target.value); setResult(null); }} /></label>{error && <p className="mat-error" role="alert">{error}</p>}{result && <div className="mat-trial-results"><section aria-label="匹配内容"><h4>匹配内容 · {result.matches.length} 处</h4><div>{result.matches.map((match, i) => <code key={i}>{match || '空匹配'}</code>)}</div></section><section aria-label="试运行结果"><h4>替换结果</h4><pre>{result.text}</pre></section></div>}</section>
      <button type="button" className="mat-danger" disabled={disabled} onClick={() => { saveList(list.filter((_, i) => i !== index)); setResult(null); }}>删除条目</button>
    </>}
  </div>;
}

export function PersonaFields({ draft, disabled, onChange }: { draft: PersonaDraft; disabled: boolean; onChange(draft: PersonaDraft): void }) {
  const input = useRef<HTMLInputElement>(null), [error, setError] = useState('');
  const avatar = draft.avatar;
  return <div className="mat-typed-editor"><div className="mat-persona-identity">{avatar ? <img className="mat-avatar" src={`data:${avatar.mediaType};base64,${avatar.base64}`} alt="玩家头像预览" /> : <span className="mat-avatar" aria-hidden="true">{draft.name.slice(0, 1) || '我'}</span>}<div><label>玩家昵称<input aria-label="玩家昵称" required disabled={disabled} value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></label><div className="mat-actions"><button type="button" disabled={disabled} onClick={() => input.current?.click()}>选择本地头像</button>{avatar && <button type="button" disabled={disabled} onClick={() => { onChange({ ...draft, avatar: null }); setError(''); }}>移除头像</button>}</div></div><input ref={input} className="mat-file" type="file" aria-label="玩家头像" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('请选择本地 PNG、JPEG 或 WebP 头像'); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result !== 'string') { setError('头像没有读完，请重新选择'); return; } const mediaType = file.type; if (mediaType !== 'image/png' && mediaType !== 'image/jpeg' && mediaType !== 'image/webp') return; onChange({ ...draft, avatar: { name: file.name, mediaType, base64: reader.result.slice(reader.result.indexOf(',') + 1) } }); setError(''); };
    reader.onerror = () => setError('头像没有读完，请重新选择'); reader.readAsDataURL(file);
  }} /></div><label>玩家设定<textarea aria-label="玩家设定" disabled={disabled} value={draft.description} onChange={event => onChange({ ...draft, description: event.target.value })} /></label>{error && <p className="mat-error" role="alert">{error}</p>}</div>;
}
function PersonaForm({ raw, disabled, onChange }: EditorProps) {
  const root = object(raw);
  const current = readPersona({ ...root, name: text(root.name) || '我' });
  return <PersonaFields disabled={disabled} draft={{ name: text(root.name), description: text(root.description), ...(current.avatar ? { avatar: current.avatar } : { avatar: null }) }} onChange={draft => onChange({ ...root, name: draft.name, description: draft.description, ...(draft.avatar === undefined ? {} : { avatar: draft.avatar === null ? null : { ...draft.avatar } }) })} />;
}
export const hasTypedForm = (kind: MaterialKind) => ['persona', 'worldbook', 'preset', 'regex'].includes(kind);
export function MaterialForm({ kind, ...props }: EditorProps & { kind: MaterialKind }) {
  if (kind === 'persona') return <PersonaForm {...props} />;
  if (kind === 'worldbook') return <WorldbookForm {...props} />;
  if (kind === 'preset') return <PresetForm {...props} />;
  if (kind === 'regex') return <RegexForm {...props} />;
  return null;
}

export const FORM_STYLES = `
.tk-materials .mat-typed-editor{display:grid;gap:12px;min-width:0}.tk-materials .mat-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:end}.tk-materials .mat-entry-picker{display:flex;align-items:end;gap:8px;padding:10px;background:var(--mat-soft);border:1px solid var(--mat-line);border-radius:var(--tk-control-radius,12px)}.tk-materials .mat-entry-picker label{flex:1}.tk-materials .mat-typed-editor :is(input:not([type=checkbox]),select,textarea){width:100%}.tk-materials .mat-typed-editor textarea{min-height:128px;resize:vertical;font-weight:400;line-height:1.7}.tk-materials .mat-check{display:flex;align-items:center;gap:7px;min-height:38px;font-weight:500}.tk-materials .mat-check input{width:16px;height:16px;accent-color:var(--mat-accent)}.tk-materials .mat-check-row{display:flex;align-items:center;gap:10px 18px;flex-wrap:wrap}.tk-materials .mat-regex-trial{padding:12px;border:1px solid var(--mat-line);border-radius:var(--tk-radius,16px);background:var(--mat-soft)}.tk-materials .mat-regex-trial .mat-section-head{margin-bottom:8px}.tk-materials .mat-regex-trial textarea{background:var(--mat-paper);min-height:96px}.tk-materials .mat-trial-results{display:grid;gap:10px;margin-top:12px}.tk-materials .mat-trial-results h4{font-size:12px;margin-bottom:5px;color:var(--mat-muted)}.tk-materials .mat-trial-results section>div{display:flex;gap:6px;flex-wrap:wrap}.tk-materials .mat-trial-results code{padding:2px 6px;background:var(--mat-paper);border:1px solid var(--mat-line);border-radius:4px;font-size:12px}.tk-materials .mat-trial-results pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;margin:0;padding:10px;background:var(--mat-paper);border-radius:var(--tk-control-radius,10px)}.tk-materials .mat-persona-identity{display:flex;align-items:start;gap:12px}.tk-materials .mat-persona-identity>.mat-avatar{width:72px;height:80px;font-size:26px}.tk-materials .mat-persona-identity>div{display:grid;gap:8px;min-width:0;flex:1}.tk-materials .mat-persona-identity .mat-actions{gap:6px}.tk-materials .mat-persona-identity button{font-size:12px;padding:5px 9px}.tk-materials .mat-persona-create{max-width:640px}.tk-materials .mat-typed-editor .mat-danger{justify-self:start}
@media(max-width:620px){.tk-materials .mat-form-grid{gap:8px}.tk-materials .mat-entry-picker{padding:8px}.tk-materials .mat-check-row{gap:4px 12px}.tk-materials .mat-persona-identity>.mat-avatar{width:56px;height:64px}.tk-materials .mat-persona-identity .mat-actions{gap:4px}.tk-materials .mat-persona-create{max-width:none}.tk-materials .mat-typed-editor textarea{min-height:120px}}
`;
