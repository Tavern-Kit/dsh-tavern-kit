import React, { useId, useState } from 'react';
import type { ConnectionView, ModelEntry, Route } from '@tavern-kit/rp-connections/types';
import { ChatDialog } from './ChatChrome.js';
import { OverflowLine } from './OverflowLine.js';
import { ChevronRight, Layers2, Search, Settings2 } from './ThemeIcons.js';

export interface ModelPickerProps {
  connections: ConnectionView[];
  value?: Route;
  disabled?: boolean;
  onSelect(route: Route): Promise<void>;
  onManage(): void;
}

function currentModelName(value: Route, connection?: ConnectionView): string {
  const listed = connection?.models.find(model => model.id === value.model);
  if (listed) return listed.name || listed.id;
  const label = value.label;
  const separator = label?.indexOf(' · ') ?? -1;
  return label ? (separator >= 0 ? label.slice(separator + 3) : label) : value.model;
}

/** Browsing is local; only choosing a model submits the existing conversation route. */
export function ModelPicker({ connections, value, disabled = false, onSelect, onManage }: ModelPickerProps): React.ReactElement {
  const [open, setOpen] = useState(false), [provider, setProvider] = useState(''), [query, setQuery] = useState('');
  const [error, setError] = useState(''), [pending, setPending] = useState<string>(), [attempted, setAttempted] = useState<string>();
  const id = useId(), currentConnection = connections.find(connection => connection.provider === value?.provider);
  const providerName = currentConnection?.name ?? value?.provider;
  const modelName = value ? currentModelName(value, currentConnection) : undefined;
  const connection = connections.find(row => row.provider === provider);
  const models: ModelEntry[] = [...(connection?.models ?? [])];
  if (value?.provider === provider && !models.some(model => model.id === value.model)) models.push({ id: value.model, name: modelName ?? value.model });
  const search = query.trim().toLocaleLowerCase();
  const filtered = models.filter(model => `${model.name}\n${model.id}`.toLocaleLowerCase().includes(search));
  const selected = attempted ?? (value?.provider === provider ? value.model : undefined);
  const locked = disabled || pending !== undefined;

  function show(): void {
    if (!connections.length) { onManage(); return; }
    setProvider(value?.provider ?? connections[0]!.provider);
    setQuery(''); setError(''); setAttempted(undefined); setOpen(true);
  }
  function manage(): void { setOpen(false); onManage(); }
  async function choose(model: ModelEntry): Promise<void> {
    if (locked) return;
    const route: Route | undefined = value?.provider === provider && value.model === model.id ? value : connection ? {
      provider: connection.provider, model: model.id, connectionId: connection.id,
      label: `${connection.name} · ${model.name}`, group: connection.preference.group,
      inputBudget: connection.preference.inputBudget ?? 16384,
    } : undefined;
    if (!route) return;
    setPending(model.id); setAttempted(model.id); setError('');
    try { await onSelect(route); setOpen(false); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setPending(undefined); }
  }

  return <div className="tk-model-picker">
    <button type="button" className="tk-model-picker-trigger" aria-label="切换模型" aria-haspopup="dialog" aria-expanded={open}
      disabled={locked} title={value ? `${value.provider} · ${value.model}` : '选择用于这段对话的模型'} onClick={show}>
      <Layers2 size={16} aria-hidden="true" /><OverflowLine className="tk-model-picker-trigger-copy"><span className="tk-model-picker-provider">{providerName ?? '选择服务商'}</span><span className="tk-model-separator" aria-hidden="true"> / </span><strong className="tk-model-picker-model">{modelName ?? '选择模型'}</strong></OverflowLine><ChevronRight size={13} aria-hidden="true" />
    </button>
    {open && <ChatDialog label="切换模型" className="tk-model-picker-dialog" onClose={() => setOpen(false)} error={error} onDismissError={() => setError('')}>
      <section className="tk-model-picker-panel" aria-busy={pending !== undefined}>
        <div className="tk-model-picker-identity"><span className="tk-model-picker-option-mark" aria-hidden="true"><Layers2 size={18} /></span><div><strong>{connection?.name ?? provider}</strong><span className="tk-muted">选择用于新回复的模型</span></div><span className="tk-model-picker-count">{models.length} 个模型</span></div>
        <div className="tk-model-picker-fields">
          <label className="tk-model-picker-connection"><span>服务商</span><select aria-label="服务商" disabled={locked} value={provider} onChange={event => { setProvider(event.target.value); setQuery(''); setError(''); setAttempted(undefined); }}>
            {value && !currentConnection && <option value={value.provider}>{value.provider} · 当前配置</option>}
            {connections.map(row => <option value={row.provider} key={row.provider}>{row.name}</option>)}
          </select></label>
          <label className="tk-model-picker-search"><span>搜索模型</span><span><Search size={15} aria-hidden="true" /><input type="search" aria-label="搜索模型" placeholder="名称或模型 ID" value={query} disabled={locked} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.preventDefault(); }} /></span></label>
        </div>
        <div className="tk-model-picker-results" aria-label="可选模型">
          {filtered.map((model, index) => {
            const current = value?.provider === provider && value.model === model.id;
            return <button type="button" className="tk-model-picker-option" key={model.id} aria-label={`使用 ${model.name}`} aria-describedby={`${id}-model-${index}`} aria-pressed={selected === model.id} disabled={locked} onClick={() => void choose(model)}>
              <span className="tk-model-picker-option-mark" aria-hidden="true">{Array.from(model.name || model.id)[0]}</span><span className="tk-model-picker-option-copy"><strong className="tk-model-picker-option-name">{model.name}</strong><code className="tk-model-picker-option-id" id={`${id}-model-${index}`}>{model.id}</code></span>
              <span className="tk-model-picker-option-state">{pending === model.id ? '切换中…' : current ? '当前使用' : error && attempted === model.id ? '点击重试' : <ChevronRight size={14} aria-hidden="true" />}</span>
            </button>;
          })}
          {!filtered.length && <div className="tk-model-picker-empty"><Layers2 size={22} aria-hidden="true" /><p>{models.length ? '没有找到匹配的模型' : '这条连接还没有模型'}</p></div>}
        </div>
        <div className="tk-model-picker-footer"><span className="tk-muted">{connection?.preference.group ? `业务分组 · ${connection.preference.group}` : provider}</span><button type="button" className="tk-text-action" aria-label="管理模型连接" disabled={locked} onClick={manage}><Settings2 size={15} aria-hidden="true" />管理模型连接</button></div>
      </section>
    </ChatDialog>}
  </div>;
}
