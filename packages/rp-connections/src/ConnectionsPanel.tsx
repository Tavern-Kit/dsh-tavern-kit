import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react';
import { validateErrorPatterns } from './routing.js';
import type RpConnections from './host.js';
import type { AccountGroup, AccountKeyPage, AccountView, BalanceView, CatalogMatch, ConnectionView, LoginResult, ModelCapabilities, ModelEntry, ModelOverride, Route, SiteStatus, Sponsor } from './types.js';

export type ConnectionsPanelApi = Pick<RpConnections,
  | 'listConnections' | 'listAdapters' | 'saveConnection' | 'discoverModels'
  | 'setPreference' | 'setModelOverride' | 'capabilities' | 'resolveRoute'
  | 'updateCatalog' | 'listSponsors' | 'listAccounts' | 'saveAccount' | 'status'
  | 'login' | 'verify' | 'loginPat' | 'self' | 'groups' | 'models' | 'listKeys'
  | 'bindKey' | 'accountBalance' | 'keyBalance' | 'logout' | 'clearCredential'
>;
export interface ConnectionsPanelProps {
  api: ConnectionsPanelApi;
  onChooseRoute?: (route: Route) => void | Promise<void>;
  className?: string;
}
type Adapter = Awaited<ReturnType<ConnectionsPanelApi['listAdapters']>>[number];
type Tab = 'existing' | 'add' | 'accounts' | 'advanced' | 'sponsors';
const tabs: Array<[Tab, string]> = [['existing', '现有连接'], ['add', '添加连接'], ['accounts', '站点账号'], ['advanced', '高级'], ['sponsors', '社区共创伙伴']];
const purposeLabels = { chat: '聊天', embedding: '向量', image: '生图', audio: '音频', unknown: '用途待确认' };
function errorText(error: unknown): string { return error instanceof Error ? error.message : '这次操作没有完成，请重试'; }
function positiveInput(value: string, label: string): number | undefined {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label}要填写大于零的整数`);
  return number;
}
function Button({ children, primary, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button type="button" {...props} className={`tk-c-button${primary ? ' tk-c-primary' : ''}${props.className ? ' ' + props.className : ''}`}>{children}</button>;
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="tk-c-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
function Feedback({ error, notice }: { error?: string; notice?: string }) {
  return <>{error && <div role="alert" className="tk-c-feedback tk-c-error">{error}</div>}{notice && <div role="status" className="tk-c-feedback">{notice}</div>}</>;
}
function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const active = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function run(action: () => Promise<void>, success = '') {
    if (active.current) return;
    active.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); if (alive.current) setNotice(success); }
    catch (error) { if (alive.current) setError(errorText(error)); }
    finally { active.current = false; if (alive.current) setBusy(false); }
  }
  return { busy, error, notice, run };
}

/** Pure view: credentials and external requests remain behind the Host API. */
export function ConnectionsPanel({ api, onChooseRoute, className = '' }: ConnectionsPanelProps) {
  const [tab, setTab] = useState<Tab>('existing');
  const [connections, setConnections] = useState<ConnectionView[]>([]), [adapters, setAdapters] = useState<Adapter[]>([]);
  const [accounts, setAccounts] = useState<AccountView[]>([]), [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [provider, setProvider] = useState(''), [model, setModel] = useState('');
  const [template, setTemplate] = useState<Sponsor>(), [catalogVersion, setCatalogVersion] = useState(0);
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('');
  const { run, busy, error, notice } = useAction();
  const id = useId();
  const connection = connections.find(row => row.provider === provider);
  const reloadConnections = async () => { const rows = await api.listConnections(); setConnections(rows); return rows; };
  const reloadAccounts = async () => { const rows = await api.listAccounts(); setAccounts(rows); return rows; };
  function select(row: ConnectionView) { setProvider(row.provider); setModel(row.preference.selectedModel ?? row.models[0]?.id ?? ''); }
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError('');
    void (async () => {
      try {
        const results = await Promise.allSettled([api.listConnections(), api.listAdapters(), api.listAccounts(), api.listSponsors()] as const);
        if (!alive) return;
        const [listed, protocols, users, recommendations] = results;
        if (listed.status === 'fulfilled') { setConnections(listed.value); if (listed.value[0]) select(listed.value[0]); }
        if (protocols.status === 'fulfilled') setAdapters(protocols.value);
        if (users.status === 'fulfilled') setAccounts(users.value);
        if (recommendations.status === 'fulfilled') setSponsors(recommendations.value);
        const failure = results.find(result => result.status === 'rejected');
        if (failure?.status === 'rejected') setLoadError(errorText(failure.reason));
      } catch (error) { if (alive) setLoadError(errorText(error)); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [api]);
  async function saveModel() {
    if (!connection || !model) throw new Error('先选连接，再填写模型 ID');
    const models = connection.models.some(row => row.id === model) ? connection.models : [...connection.models, { id: model, name: model }];
    await api.saveConnection({ provider, models });
    await api.setPreference({ provider, preference: { models, selectedModel: model } });
    await reloadConnections();
  }
  async function chooseRoute() {
    if (!connection || !model) throw new Error('先填写要使用的模型 ID');
    const route = await api.resolveRoute({ provider, model, connectionId: connection.id, label: connection.models.find(row => row.id === model)?.name ?? model, inputBudget: connection.preference.inputBudget ?? 24000, group: connection.preference.group });
    await onChooseRoute?.(route);
  }
  const modelPicker = connection && <section className="tk-c-card tk-c-model-picker" aria-label="当前连接模型">
    <div className="tk-c-model-heading"><div className="tk-c-grow"><span className="tk-c-eyebrow">当前连接</span><h2>{connection.name}</h2></div><span className="tk-c-tag" data-ready={connection.credentialConfigured}>{connection.credentialConfigured ? '已沿用 DSH 凭据' : '待配置凭据'}</span>{connection.preference.group && <span className="tk-c-muted">分组：{connection.preference.group}</span>}</div>
    <div className="tk-c-fields">
      <Field label="模型列表"><select value={connection.models.some(row => row.id === model) ? model : ''} onChange={event => { if (event.target.value) setModel(event.target.value); }}><option value="">手填模型 ID</option>{connection.models.map(row => <option key={row.id} value={row.id}>{row.name === row.id ? row.id : `${row.name} · ${row.id}`}</option>)}</select></Field>
      <Field label="原始模型 ID"><input value={model} onChange={event => setModel(event.target.value)} spellCheck={false} placeholder="例如 [分组]vendor/model" /></Field>
    </div>
    <div className="tk-c-row tk-c-model-actions"><Button disabled={busy} onClick={() => void run(async () => { await api.discoverModels({ provider }); await reloadConnections(); }, '模型列表已更新')}>拉取模型</Button><Button disabled={busy || !model} onClick={() => void run(saveModel, '模型已保存')}>保存模型</Button>{onChooseRoute && <Button primary disabled={busy || !model} onClick={() => void run(chooseRoute, '已选为当前聊天模型')}>用于这段对话</Button>}<small className="tk-c-muted">保存后，再选择用于哪段对话。</small></div>
  </section>;
  return <section className={`tk-rp tk-connections ${className}`} aria-label="模型连接" aria-busy={loading} data-page-tab={tab}>
    <style>{PANEL_CSS}</style>
    <div className="tk-c-page">
    <header className="tk-c-header" data-tk-page-heading><div className="tk-c-identity"><span className="tk-c-page-mark" aria-hidden="true"><span /><span /><span /></span><div><h1>模型连接</h1></div></div><Button disabled={busy} onClick={() => void run(async () => { const rows = await reloadConnections(); await reloadAccounts(); if (!provider && rows[0]) select(rows[0]); }, '连接已刷新')}>刷新</Button></header>
    <nav role="tablist" aria-label="连接设置" className="tk-c-tabs">{tabs.map(([key, label], index) => <button key={key} id={`${id}-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`${id}-panel`} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      const target = tabs[next]![0]; setTab(target); document.getElementById(`${id}-tab-${target}`)?.focus();
    }}>{label}</button>)}</nav>
    <Feedback error={error || loadError} notice={notice} />
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} className="tk-c-stack tk-c-panel">
      {loading && <div className="tk-c-card tk-c-loading" role="status"><span className="tk-c-loading-mark" aria-hidden="true" /><div><strong>正在读取 DSH 连接</strong><span className="tk-c-muted">已有的模型和凭据会一起沿用</span></div></div>}
      {tab === 'existing' && <div className="tk-c-workspace">
        <aside className="tk-c-connection-shelf" aria-label="常用连接"><div className="tk-c-shelf-heading"><div><span className="tk-c-eyebrow">沿用 DSH</span><h2>现有连接</h2></div><span className="tk-c-shelf-count">{connections.length}</span></div>
          <div className="tk-c-connection-grid">{connections.map(row => <article className="tk-c-connection" key={row.provider} data-selected={provider === row.provider}>
            <button type="button" className="tk-c-connection-select" aria-label={`管理${row.name}`} aria-pressed={provider === row.provider} onClick={() => select(row)}><span className="tk-c-connection-heading"><span className="tk-c-connection-monogram" aria-hidden="true">{row.name.slice(0, 1)}</span><span className="tk-c-connection-name"><strong>{row.name}</strong><span className="tk-c-connection-state"><span data-active={row.active} />{row.active ? '可用' : '待启用'}</span></span><span className="tk-c-connection-arrow" aria-hidden="true">›</span></span><span className="tk-c-address">{row.baseURL ?? row.provider}</span><span className="tk-c-connection-meta"><span>{row.credentialConfigured ? '凭据已配置' : '未配置凭据'}</span><span>{row.models.length} 个模型</span></span></button>{row.error && <p className="tk-c-error">{row.error}</p>}
          </article>)}</div>
          <div className="tk-c-shelf-actions"><Button onClick={() => { setTemplate(undefined); setTab('add'); }}>添加连接</Button><Button onClick={() => setTab('accounts')}>登录站点账号</Button></div>
        </aside>
        <div className="tk-c-connection-desk">
          {!loading && connections.length === 0 && <div className="tk-c-card tk-c-empty"><span className="tk-c-empty-mark" aria-hidden="true"><span /><span /></span><div><h2>先接上一个模型</h2><p>添加 API 地址与聊天 key，或登录站点账号。</p></div><Button primary onClick={() => setTab('add')}>添加第一个连接</Button></div>}
          {modelPicker}
          {connection && <ConnectionSettings key={provider} api={api} connection={connection} reload={reloadConnections} />}
        </div>
      </div>}
      {tab === 'add' && <AddConnection key={template?.id ?? 'custom'} api={api} adapters={adapters} template={template} onSaved={async row => { await reloadConnections(); select(row); setTemplate(undefined); setTab('existing'); }} />}
      {tab === 'accounts' && !loading && <AccountPanel api={api} accounts={accounts} connections={connections} adapters={adapters} currentProvider={provider} reloadAccounts={reloadAccounts} reloadConnections={reloadConnections} />}
      {tab === 'advanced' && <>
        <div className="tk-c-card tk-c-row tk-c-advanced-heading"><Field label="设置哪个连接"><select value={provider} onChange={event => { const row = connections.find(row => row.provider === event.target.value); if (row) select(row); }}><option value="">选择连接</option>{connections.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}</select></Field><div className="tk-c-grow"><h2>模型能力与备用</h2><small className="tk-c-muted">按站点资料和自己的设置调整</small></div><Button disabled={busy} onClick={() => void run(async () => { const result = await api.updateCatalog(); if (!result.updated) throw new Error(result.error ?? '目录更新未完成，已保留本地资料'); setCatalogVersion(value => value + 1); }, '能力目录已更新')}>更新能力目录</Button></div>
        {modelPicker}
        <div className="tk-c-advanced-workspace">{connection && model && <CapabilitiesEditor key={`${provider}\n${model}`} api={api} connection={connection} model={model} catalogVersion={catalogVersion} reload={reloadConnections} />}
        {connection && <FallbackEditor key={provider} api={api} connection={connection} connections={connections} model={model} reload={reloadConnections} />}</div>
      </>}
      {tab === 'sponsors' && <SponsorsPanel sponsors={sponsors} onUse={row => { setTemplate(row); setTab('add'); }} onAdd={() => setTab('add')} />}
    </div>
    </div>
  </section>;
}

const projectRepository = 'https://github.com/Tavern-Kit/dsh-tavern-kit';

function SponsorsPanel({ sponsors, onUse, onAdd }: { sponsors: readonly Sponsor[]; onUse: (sponsor: Sponsor) => void; onAdd: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  function open() {
    const element = dialog.current;
    if (!element || element.open) return;
    trigger.current?.focus({ preventScroll: true });
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
    element.querySelector('button')?.focus({ preventScroll: true });
  }

  function close() {
    const element = dialog.current;
    if (!element?.open) return;
    if (typeof element.close === 'function') element.close();
    else element.removeAttribute('open');
    trigger.current?.focus({ preventScroll: true });
  }

  return <div className="tk-c-stack">
    <div className="tk-c-card tk-c-sponsor-intro">
      <div>
        <h2>公益、非盈利的开源项目</h2>
        <p>欢迎一起完善主题、体验和使用文档。</p>
      </div>
      <button ref={trigger} type="button" className="tk-c-button" aria-haspopup="dialog" onClick={open}>参与社区共创</button>
    </div>
    <div className="tk-c-sponsor-grid">
      {sponsors.map(row => <article className="tk-c-card tk-c-sponsor" key={row.id}>
        <div className="tk-c-row">
          <img className="tk-c-logo" src={row.logo} alt="" loading="lazy" />
          <div className="tk-c-grow"><h3>{row.name}</h3><span className="tk-c-tag">{row.label}</span></div>
        </div>
        <p>{row.description}</p>
        <div className="tk-c-row">
          <a className="tk-c-button" href={row.siteURL} target="_blank" rel="noreferrer">去站点看看</a>
          {row.promotionURL && <a className="tk-c-button" href={row.promotionURL} target="_blank" rel="noreferrer">查看活动</a>}
          {row.apiURL && <Button onClick={() => onUse(row)}>{`使用${row.name}地址`}</Button>}
        </div>
      </article>)}
      {sponsors.length === 0 && <div className="tk-c-card tk-c-row"><span>暂时没有社区共创伙伴</span><Button onClick={onAdd}>手填连接</Button></div>}
    </div>
    <dialog ref={dialog} className="tk-c-sponsor-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); close(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <header className="tk-c-sponsor-dialog-head">
        <h2 id={titleId}>参与社区共创</h2>
        <Button onClick={close}>关闭</Button>
      </header>
      <div className="tk-c-sponsor-letter">
        <p>欢迎参与 Tavern Kit 的主题、体验和文档共创，也欢迎平台提交自己的介绍。</p>
        <p><strong>Tavern Kit 是公益、非盈利的开源项目，插件免费使用。</strong> 请准备平台图标、站点链接、简介和想参与的内容，审核通过后会收录到社区共创伙伴页面。</p>
        <p>遇到问题，欢迎到 GitHub <a href={`${projectRepository}/issues`} target="_blank" rel="noreferrer">提 Issue</a>。</p>
        <p>觉得好用的话，可以<a href={projectRepository} target="_blank" rel="noreferrer">点个 Star</a>，或在小红书推荐给其他人。比心w</p>
      </div>
    </dialog>
  </div>;
}

function AddConnection({ api, adapters, template, onSaved }: { api: ConnectionsPanelApi; adapters: Adapter[]; template?: Sponsor; onSaved: (row: ConnectionView) => Promise<void> }) {
  const [provider, setProvider] = useState(''), [name, setName] = useState(template?.name ?? ''), [url, setURL] = useState(template?.apiURL ?? '');
  const [adapterId, setAdapterId] = useState(adapters[0]?.provider ?? ''), [protocol, setProtocol] = useState('openai-completions');
  const [key, setKey] = useState(''), [model, setModel] = useState(''), [models, setModels] = useState<ModelEntry[]>([]);
  const { run, busy, error, notice } = useAction();
  const listId = useId(), protocolId = useId();
  useEffect(() => { if (!adapterId && adapters[0]) setAdapterId(adapters[0].provider); }, [adapters, adapterId]);
  const descriptor = adapters.find(row => row.provider === adapterId);
  const input = () => ({ provider, settingsNs: descriptor?.settingsNs, name, baseURL: url, api: protocol || undefined, ...(key ? { apiKey: key } : {}) });
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      if (!descriptor) throw new Error('先选择 DSH 的协议适配器');
      const entries = model && !models.some(row => row.id === model) ? [...models, { id: model, name: model }] : models;
      const row = await api.saveConnection({ ...input(), models: entries.length ? entries : undefined });
      setKey('');
      if (model) await api.setPreference({ provider, preference: { selectedModel: model, models: entries } });
      await onSaved(row);
    });
  }
  return <form className="tk-c-card tk-c-stack" onSubmit={submit}>
    <div className="tk-c-row"><h2>粘贴聊天 key</h2>{template && <span className="tk-c-tag">{template.name} · 社区伙伴地址</span>}<small className="tk-c-muted">保存在 DSH，选模型时可以继续手填。</small></div>
    <div className="tk-c-fields"><Field label="连接标识"><input required value={provider} onChange={event => setProvider(event.target.value)} placeholder="例如 my-relay" spellCheck={false} /></Field><Field label="连接名称"><input required value={name} onChange={event => setName(event.target.value)} placeholder="给它起个好认的名字" /></Field><Field label="API 地址"><input type="url" required value={url} onChange={event => setURL(event.target.value)} placeholder="https://example.com/v1" spellCheck={false} /></Field><Field label="聊天 key"><input type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="new-password" placeholder="粘贴用于模型调用的 key" /></Field><Field label="协议适配器"><select required value={adapterId} onChange={event => setAdapterId(event.target.value)}><option value="">选择 DSH 适配器</option>{adapters.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}</select></Field><Field label="协议"><input list={protocolId} value={protocol} onChange={event => setProtocol(event.target.value)} /><datalist id={protocolId}>{['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'].map(value => <option key={value} value={value} />)}</datalist></Field><Field label="初始模型 ID"><input list={listId} value={model} onChange={event => setModel(event.target.value)} spellCheck={false} placeholder="可拉列表，也能直接手填" /></Field><datalist id={listId}>{models.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</datalist></div>
    <Feedback error={error} notice={notice} />
    <div className="tk-c-row"><Button type="submit" primary disabled={busy}>保存连接</Button><Button disabled={busy || !url || !descriptor} onClick={() => void run(async () => { const rows = await api.discoverModels({ settingsNs: descriptor?.settingsNs, baseURL: url, api: protocol || undefined, ...(key ? { apiKey: key } : {}) }); setModels(rows); if (!model && rows[0]) setModel(rows[0].id); }, '可选模型已读取')}>拉取可选模型</Button>{models.length > 0 && <small className="tk-c-muted">{models.length} 个模型可选</small>}</div>
  </form>;
}

function ConnectionSettings({ api, connection, reload }: { api: ConnectionsPanelApi; connection: ConnectionView; reload: () => Promise<ConnectionView[]> }) {
  const [name, setName] = useState(connection.name), [url, setURL] = useState(connection.baseURL ?? ''), [protocol, setProtocol] = useState(connection.api ?? '');
  const [key, setKey] = useState(''), [confirmClear, setConfirmClear] = useState(false), [balance, setBalance] = useState<BalanceView>();
  const { run, busy, error, notice } = useAction();
  return <details className="tk-c-card"><summary>连接设置与 key 额度</summary><div className="tk-c-stack tk-c-detail-body"><form onSubmit={event => { event.preventDefault(); void run(async () => { await api.saveConnection({ provider: connection.provider, name, baseURL: url || undefined, api: protocol || undefined, ...(key ? { apiKey: key } : {}) }); setKey(''); await reload(); }, '连接设置已保存'); }}>
    <div className="tk-c-fields"><Field label="连接名称"><input required value={name} onChange={event => setName(event.target.value)} /></Field><Field label="API 地址"><input type="url" value={url} onChange={event => setURL(event.target.value)} /></Field><Field label="协议"><input value={protocol} onChange={event => setProtocol(event.target.value)} /></Field><Field label="替换聊天 key"><input type="password" value={key} onChange={event => setKey(event.target.value)} autoComplete="new-password" placeholder="留空沿用已保存的凭据" /></Field></div>
    <div className="tk-c-row"><Button type="submit" disabled={busy}>保存连接设置</Button><Button disabled={busy || !connection.credentialConfigured} onClick={() => void run(async () => { setBalance(await api.keyBalance({ provider: connection.provider })); })}>查看当前 key 额度</Button><Button disabled={busy || !connection.credentialConfigured} onClick={() => setConfirmClear(true)}>解除聊天 key</Button></div>
  </form>{confirmClear && <div className="tk-c-row tk-c-feedback"><span>解除这个连接的聊天 key？</span><Button disabled={busy} onClick={() => void run(async () => { await api.clearCredential({ provider: connection.provider }); setConfirmClear(false); setBalance(undefined); await reload(); }, '聊天 key 已解除')}>确认解除</Button><Button onClick={() => setConfirmClear(false)}>保留</Button></div>}{balance && <BalanceCard balance={balance} title="当前 key 额度" />}<Feedback error={error} notice={notice} /></div></details>;
}

const capabilityNames: Array<[keyof ModelCapabilities, string]> = [['purpose', '用途'], ['contextWindow', '上下文容量'], ['outputLimit', '输出上限'], ['imageInput', '图片输入'], ['reasoning', '推理'], ['temperature', '温度参数'], ['stop', '停止串']];
function CapabilitiesEditor({ api, connection, model, catalogVersion, reload }: { api: ConnectionsPanelApi; connection: ConnectionView; model: string; catalogVersion: number; reload: () => Promise<ConnectionView[]> }) {
  const original = connection.preference.overrides?.[model] ?? {};
  const [match, setMatch] = useState<CatalogMatch>(), [readError, setReadError] = useState(''), [alias, setAlias] = useState(original.alias ?? '');
  const [context, setContext] = useState(original.contextWindow?.toString() ?? ''), [output, setOutput] = useState(original.outputLimit?.toString() ?? '');
  const [budget, setBudget] = useState(connection.preference.inputBudget?.toString() ?? '24000');
  const [purpose, setPurpose] = useState<ModelOverride['purpose']>(original.purpose);
  const [flags, setFlags] = useState<Partial<Record<'imageInput' | 'reasoning' | 'temperature' | 'stop', boolean>>>(Object.fromEntries(['imageInput', 'reasoning', 'temperature', 'stop'].filter(key => original[key as keyof ModelOverride] !== undefined).map(key => [key, original[key as keyof ModelOverride]])));
  const { run, busy, error, notice } = useAction();
  useEffect(() => {
    let alive = true;
    setReadError('');
    void api.capabilities({ provider: connection.provider, model }).then(result => { if (alive) setMatch(result); }, error => { if (alive) setReadError(errorText(error)); });
    return () => { alive = false; };
  }, [api, connection.provider, model, catalogVersion]);
  function valueLabel(key: keyof ModelCapabilities, value: ModelCapabilities[keyof ModelCapabilities]) { return value === undefined ? '未返回' : key === 'purpose' ? purposeLabels[value as keyof typeof purposeLabels] : typeof value === 'boolean' ? value ? '支持' : '不支持' : Number(value).toLocaleString('zh-CN'); }
  return <section className="tk-c-card tk-c-stack" aria-label="模型能力">
    <div className="tk-c-row"><h2>模型能力</h2><span className="tk-c-tag">{match ? { exact: '精确匹配', confirmed: '已确认目录', candidate: '有待确认的候选', unknown: '可手动设置' }[match.match] : '正在读取'}</span>{match?.matchedId && <small className="tk-c-muted">目录：{match.matchedId}</small>}</div>
    {match?.candidates.map(candidate => <div className="tk-c-row tk-c-candidate" key={candidate.id}><div className="tk-c-grow"><strong>{candidate.name}</strong><small className="tk-c-muted">{candidate.id}</small></div><Button disabled={busy} onClick={() => void run(async () => { setMatch(await api.setModelOverride({ provider: connection.provider, model, override: { canonicalId: candidate.id } })); await reload(); }, '目录候选已确认')}>{`确认使用 ${candidate.name}`}</Button></div>)}
    <dl className="tk-c-facts">{capabilityNames.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{valueLabel(key, match?.capabilities[key])}<small>{match?.sources[key] ? { 'models.dev': 'models.dev', site: '站点资料', manual: '人工设置' }[match.sources[key]!] : '暂无资料'}</small></dd></div>)}</dl>
    <form className="tk-c-stack" onSubmit={event => { event.preventDefault(); void run(async () => {
      const contextWindow = positiveInput(context, '上下文容量'), outputLimit = positiveInput(output, '输出预留'), inputBudget = positiveInput(budget, '输入预算');
      if (!inputBudget) throw new Error('填写这次使用的输入预算');
      if (original.contextWindow !== undefined && contextWindow === undefined || original.outputLimit !== undefined && outputLimit === undefined) throw new Error('填写容量数值，或保留原来的设置');
      if (contextWindow !== undefined && outputLimit !== undefined && outputLimit >= contextWindow) throw new Error('输出预留应小于上下文容量');
      setMatch(await api.setModelOverride({ provider: connection.provider, model, override: { alias, ...(purpose ? { purpose } : {}), ...(contextWindow ? { contextWindow } : {}), ...(outputLimit ? { outputLimit } : {}), ...flags } }));
      await api.setPreference({ provider: connection.provider, preference: { inputBudget } }); await reload();
    }, '能力设置已保存'); }}>
      <div className="tk-c-fields"><Field label="展示名"><input value={alias} onChange={event => setAlias(event.target.value)} placeholder={model} /></Field><Field label="模型用途"><select value={purpose ?? ''} onChange={event => setPurpose(event.target.value ? event.target.value as ModelOverride['purpose'] : undefined)}>{original.purpose === undefined && <option value="">沿用当前资料</option>}{Object.entries(purposeLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></Field><Field label="上下文容量"><input type="number" min="1" step="1" value={context} onChange={event => setContext(event.target.value)} placeholder="按站点资料手填" /></Field><Field label="输出预留"><input type="number" min="1" step="1" value={output} onChange={event => setOutput(event.target.value)} placeholder="留空沿用当前配置" /></Field><Field label="输入预算"><input type="number" min="1" step="1" required value={budget} onChange={event => setBudget(event.target.value)} /></Field>{(['imageInput', 'reasoning', 'temperature', 'stop'] as const).map(key => <Field key={key} label={`${capabilityNames.find(row => row[0] === key)![1]}设置`}><select value={flags[key] === undefined ? '' : String(flags[key])} onChange={event => setFlags(current => ({ ...current, [key]: event.target.value === '' ? undefined : event.target.value === 'true' }))}>{original[key] === undefined && <option value="">沿用当前资料</option>}<option value="true">支持</option><option value="false">不支持</option></select></Field>)}</div><div className="tk-c-row"><Button type="submit" primary disabled={busy}>保存能力设置</Button><small className="tk-c-muted">人工设置优先，原始调用 ID 保持完整。</small></div>
      <Feedback error={error || readError} notice={notice} />
    </form>
  </section>;
}

function FallbackEditor({ api, connection, connections, model, reload }: { api: ConnectionsPanelApi; connection: ConnectionView; connections: ConnectionView[]; model: string; reload: () => Promise<ConnectionView[]> }) {
  const [enabled, setEnabled] = useState(Boolean(connection.preference.fallback?.length));
  const [routes, setRoutes] = useState<Route[]>(connection.preference.fallback ?? []), [onError, setOnError] = useState(connection.preference.fallbackOnError ?? true);
  const [patterns, setPatterns] = useState(connection.preference.errorPatterns?.join('\n') ?? '');
  const [provider, setProvider] = useState(connections.find(row => row.provider !== connection.provider)?.provider ?? connection.provider);
  const target = connections.find(row => row.provider === provider);
  const [nextModel, setNextModel] = useState(target?.preference.selectedModel ?? target?.models[0]?.id ?? '');
  const { run, busy, error, notice } = useAction();
  const modelsId = useId();
  function move(index: number, step: number) { setRoutes(current => { const result = [...current]; const other = index + step; if (!result[other]) return current; [result[index], result[other]] = [result[other]!, result[index]!]; return result; }); }
  async function save(): Promise<void> {
    const errorPatterns = patterns.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    validateErrorPatterns(errorPatterns);
    await api.setPreference({ provider: connection.provider, preference: { fallback: enabled ? routes : [], fallbackOnError: onError, errorPatterns } });
    await reload();
  }
  return <section className="tk-c-card tk-c-stack" aria-label="备用模型">
    <div className="tk-c-row"><h2>备用模型</h2><label className="tk-c-check"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />启用备用模型</label><label className="tk-c-check"><input type="checkbox" checked={onError} onChange={event => setOnError(event.target.checked)} />报错时自动换备用</label></div>
    <div><Field label="只匹配这些报错"><textarea rows={3} disabled={!enabled || !onError} value={patterns} onChange={event => setPatterns(event.target.value)} spellCheck={false} placeholder="留空时各类报错都尝试；每行一条" /></Field><small className="tk-c-muted">普通文字区分大小写；/表达式/i 可忽略大小写。</small></div>
    <div className="tk-c-chain"><div className="tk-c-chain-row"><span className="tk-c-tag">当前</span><strong>{connection.name}</strong><span className="tk-c-raw">{model || '先选主模型'}</span></div>{routes.map((route, index) => <div className="tk-c-chain-row" key={`${route.provider}\n${route.model}`}><span className="tk-c-tag">备用 {index + 1}</span><div className="tk-c-grow"><strong>{connections.find(row => row.provider === route.provider)?.name ?? route.provider}</strong><span className="tk-c-raw">{route.model}</span></div><div className="tk-c-row"><Button aria-label={`上移备用 ${index + 1}`} disabled={!enabled || index === 0} onClick={() => move(index, -1)}>上移</Button><Button aria-label={`下移备用 ${index + 1}`} disabled={!enabled || index === routes.length - 1} onClick={() => move(index, 1)}>下移</Button><Button aria-label={`移除备用 ${index + 1}`} disabled={!enabled} onClick={() => setRoutes(current => current.filter((_, at) => at !== index))}>移除</Button></div></div>)}</div>
    <div className="tk-c-fields"><Field label="备用连接"><select disabled={!enabled} value={provider} onChange={event => { setProvider(event.target.value); const row = connections.find(row => row.provider === event.target.value); setNextModel(row?.preference.selectedModel ?? row?.models[0]?.id ?? ''); }}>{connections.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}</select></Field><Field label="备用模型 ID"><input disabled={!enabled} list={modelsId} value={nextModel} onChange={event => setNextModel(event.target.value)} spellCheck={false} /></Field><datalist id={modelsId}>{target?.models.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</datalist></div>
    <Feedback error={error} notice={notice} /><div className="tk-c-row"><Button disabled={busy || !enabled || !provider || !nextModel} onClick={() => void run(async () => { if (routes.some(route => route.provider === provider && route.model === nextModel) || provider === connection.provider && nextModel === model) throw new Error('这条模型已经在链里了'); setRoutes(current => [...current, { provider, model: nextModel, connectionId: target?.id, inputBudget: target?.preference.inputBudget ?? 24000, group: target?.preference.group }]); })}>加入备用链</Button><Button primary disabled={busy} onClick={() => void run(save, enabled ? '备用顺序已保存' : '备用模型已关闭')}>保存备用链</Button><small className="tk-c-muted">按顺序尝试，生成到一半的回复会保留。</small></div>
  </section>;
}

function amount(value: number | undefined, unit: BalanceView['unit']): string {
  if (value === undefined || !Number.isFinite(value)) return '未返回';
  const type = unit.displayType?.toUpperCase();
  if (!unit.quotaPerUnit || type === 'TOKENS') return `${value.toLocaleString('zh-CN', { maximumSignificantDigits: 12 })} ${type === 'TOKENS' ? 'tokens' : '额度单位'}`;
  const scaled = value / unit.quotaPerUnit;
  const rate = type === 'CNY' ? unit.usdExchangeRate : type === 'CUSTOM' ? unit.customCurrencyExchangeRate : 1;
  const number = rate === undefined ? undefined : scaled * rate;
  if (number === undefined) return `${value.toLocaleString('zh-CN')} 额度单位`;
  const symbol = type === 'USD' ? 'USD' : type === 'CNY' ? 'CNY' : unit.symbol;
  return symbol ? `${number.toLocaleString('zh-CN', { maximumSignificantDigits: 12 })} ${symbol}` : `${value.toLocaleString('zh-CN')} 额度单位`;
}
function BalanceCard({ balance, title }: { balance?: BalanceView; title: string }) {
  return <section className="tk-c-balance" aria-label={title}><h3>{title}</h3><div className="tk-c-row"><strong>{balance?.unlimited ? '无限额' : balance ? amount(balance.remaining, balance.unit) : '未返回'}</strong>{balance?.used !== undefined && <small className="tk-c-muted">已用 {amount(balance.used, balance.unit)}</small>}</div></section>;
}

function AccountPanel({ api, accounts, connections, adapters, currentProvider, reloadAccounts, reloadConnections }: { api: ConnectionsPanelApi; accounts: AccountView[]; connections: ConnectionView[]; adapters: Adapter[]; currentProvider: string; reloadAccounts: () => Promise<AccountView[]>; reloadConnections: () => Promise<ConnectionView[]> }) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const account = accounts.find(row => row.id === accountId);
  const [definition, setDefinition] = useState({ id: account?.id ?? '', name: account?.name ?? '', siteURL: account?.siteURL ?? '', apiURL: account?.apiURL ?? '' });
  const [mode, setMode] = useState<'password' | 'pat'>('password'), [username, setUsername] = useState(''), [password, setPassword] = useState(''), [token, setToken] = useState(''), [userId, setUserId] = useState('');
  const [challenge, setChallenge] = useState<LoginResult>(), [code, setCode] = useState(''), [method, setMethod] = useState('');
  const [status, setStatus] = useState<SiteStatus>(), [groups, setGroups] = useState<AccountGroup[]>([]), [group, setGroup] = useState(''), [models, setModels] = useState<string[]>([]);
  const [balance, setBalance] = useState<BalanceView>(), [keyBalance, setKeyBalance] = useState<BalanceView>(), [keys, setKeys] = useState<AccountKeyPage>();
  const [detailsErrors, setDetailsErrors] = useState<string[]>([]), [modelError, setModelError] = useState('');
  const [targetProvider, setTargetProvider] = useState(currentProvider || connections[0]?.provider || ''), [newProvider, setNewProvider] = useState('');
  const [adapterId, setAdapterId] = useState(adapters[0]?.provider ?? ''), [bindProtocol, setBindProtocol] = useState('openai-completions');
  const { run, busy, error, notice } = useAction();
  const requestVersion = useRef(0), modelVersion = useRef(0);
  useEffect(() => {
    const row = accounts.find(row => row.id === accountId);
    setDefinition({ id: row?.id ?? '', name: row?.name ?? '', siteURL: row?.siteURL ?? '', apiURL: row?.apiURL ?? '' });
    setChallenge(undefined); setPassword(''); setToken(''); setCode(''); setStatus(undefined); setGroups([]); setGroup(''); setModels([]); setKeys(undefined); setBalance(undefined); setKeyBalance(undefined); setDetailsErrors([]); setModelError('');
    requestVersion.current++; modelVersion.current++;
  }, [accountId]);
  useEffect(() => () => { requestVersion.current++; modelVersion.current++; }, []);
  async function readDetails() {
    if (!accountId) return;
    const version = ++requestVersion.current;
    const results = await Promise.allSettled([api.self({ accountId }), api.groups({ accountId }), api.accountBalance({ accountId }), api.listKeys({ accountId, page: 1, pageSize: 20 })] as const);
    if (version !== requestVersion.current) return;
    const [self, visible, wallet, listed] = results;
    if (visible.status === 'fulfilled') { setGroups(visible.value); setGroup(previous => previous || (self.status === 'fulfilled' && visible.value.some(row => row.id === self.value.group) ? self.value.group! : visible.value[0]?.id ?? '')); }
    if (wallet.status === 'fulfilled') setBalance(wallet.value);
    if (listed.status === 'fulfilled') setKeys(listed.value);
    setDetailsErrors([...new Set(results.filter((row): row is PromiseRejectedResult => row.status === 'rejected').map(row => errorText(row.reason)))]);
  }
  useEffect(() => {
    if (account?.authenticated) void readDetails();
    return () => { requestVersion.current++; };
  }, [api, accountId, account?.authenticated]);
  useEffect(() => {
    if (!account?.authenticated) return;
    const version = ++modelVersion.current;
    setModels([]); setModelError('');
    void api.models({ accountId, group }).then(rows => { if (version === modelVersion.current) setModels(rows); }, error => { if (version === modelVersion.current) setModelError(errorText(error)); });
    return () => { modelVersion.current++; };
  }, [api, accountId, group, account?.authenticated]);
  async function accept(result: LoginResult) {
    if (result.state === 'verification') { setChallenge(result); setMethod(result.methods?.find(row => row.available)?.method ?? ''); return; }
    setChallenge(undefined); setCode(''); await reloadAccounts();
  }
  async function signIn() {
    if (!account) throw new Error('先保存账号站点与模型 API 地址');
    const typed = mode === 'pat' ? token : password;
    setPassword(''); setToken('');
    const info = await api.status({ accountId }); setStatus(info);
    if (info.ssoOnly || info.passwordLogin === false && mode === 'password') throw new Error('这个站点使用网页登录，请在「添加连接」中粘贴聊天 key');
    if (mode === 'pat') await accept(await api.loginPat({ accountId, token: typed, userId: positiveInput(userId, '用户 ID') }));
    else await accept(await api.login({ accountId, username, password: typed }));
  }
  const provider = targetProvider === '__new' ? newProvider : targetProvider;
  const target = connections.find(row => row.provider === targetProvider);
  const adapter = adapters.find(row => row.provider === adapterId);
  const visibleKeys = keys?.items.filter(row => !group || row.group === group) ?? [];
  return <div className="tk-c-stack">
    <div className="tk-c-card tk-c-row"><h2>登录站点账号</h2><Field label="站点账号"><select disabled={busy} value={accountId} onChange={event => setAccountId(event.target.value)}><option value="">添加站点账号</option>{accounts.map(row => <option key={row.id} value={row.id}>{row.name ?? row.id}{row.authenticated ? ' · 已登录' : ''}</option>)}</select></Field><small className="tk-c-muted">查看本人分组、模型和额度，选自己的 key 用于聊天。</small></div>
    <details className="tk-c-card" open={!account}><summary>账号站点与模型 API 地址</summary><form className="tk-c-stack tk-c-detail-body" onSubmit={event => { event.preventDefault(); void run(async () => { const saved = await api.saveAccount(definition); await reloadAccounts(); setAccountId(saved.id); }, '站点地址已保存'); }}><div className="tk-c-fields"><Field label="站点标识"><input required disabled={Boolean(account)} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={definition.id} onChange={event => setDefinition(value => ({ ...value, id: event.target.value }))} placeholder="例如 my-site" /></Field><Field label="站点名称"><input value={definition.name} onChange={event => setDefinition(value => ({ ...value, name: event.target.value }))} /></Field><Field label="账号站点地址"><input required type="url" value={definition.siteURL} onChange={event => setDefinition(value => ({ ...value, siteURL: event.target.value }))} placeholder="https://accounts.example.com" /></Field><Field label="模型 API 地址"><input required type="url" value={definition.apiURL} onChange={event => setDefinition(value => ({ ...value, apiURL: event.target.value }))} placeholder="https://api.example.com/v1" /></Field></div><div className="tk-c-row"><Button type="submit" disabled={busy} primary>保存站点地址</Button><small className="tk-c-muted">账号登录和聊天分别使用这两个地址。</small></div></form></details>
    {account && !account.authenticated && <section className="tk-c-card tk-c-stack" aria-label="账号登录">{!challenge ? <form className="tk-c-stack" onSubmit={event => { event.preventDefault(); void run(signIn); }}>
      <div className="tk-c-row" role="radiogroup" aria-label="登录方式"><label className="tk-c-check"><input type="radio" name="tk-account-login" checked={mode === 'password'} onChange={() => { setMode('password'); setToken(''); }} />账号密码</label><label className="tk-c-check"><input type="radio" name="tk-account-login" checked={mode === 'pat'} onChange={() => { setMode('pat'); setPassword(''); }} />个人访问令牌</label></div>
      <div className="tk-c-fields">{mode === 'password' ? <><Field label="用户名"><input autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} /></Field><Field label="密码"><input autoComplete="current-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} /></Field></> : <><Field label="账号访问令牌"><input type="password" required autoComplete="off" value={token} onChange={event => setToken(event.target.value)} placeholder="例如 nap_ 开头的个人访问令牌" /></Field><Field label="用户 ID（站点要求时填写）"><input type="number" min="1" value={userId} onChange={event => setUserId(event.target.value)} /></Field></>}</div><div className="tk-c-row"><Button type="submit" primary disabled={busy}>{mode === 'password' ? '登录账号' : '连接账号'}</Button>{status?.version && <small className="tk-c-muted">{status.version}</small>}</div>
    </form> : <form className="tk-c-stack" onSubmit={event => { event.preventDefault(); void run(async () => { const typed = code; setCode(''); await accept(await api.verify({ accountId, code: typed, method: method || undefined })); }); }}><div className="tk-c-row"><h3>完成二次验证</h3>{challenge.expiresAt && <small className="tk-c-muted">验证有效期至 {new Date(challenge.expiresAt * 1000).toLocaleTimeString('zh-CN')}</small>}</div><div className="tk-c-fields"><Field label="验证方式"><select value={method} onChange={event => setMethod(event.target.value)}>{challenge.methods?.map(row => <option key={row.method} value={row.method} disabled={!row.available}>{row.name ?? '二步验证'}</option>)}</select></Field><Field label="验证码"><input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} /></Field></div><div className="tk-c-row"><Button type="submit" primary disabled={busy}>完成验证</Button><Button disabled={busy} onClick={() => { setChallenge(undefined); setCode(''); }}>重新登录</Button></div></form>}</section>}
    {account?.authenticated && <>
      <div className="tk-c-card tk-c-row"><div className="tk-c-grow"><h2>{account.user?.displayName ?? account.user?.username ?? account.name ?? account.id}</h2><small className="tk-c-muted">{account.family === 'pat' ? '个人访问令牌已连接' : '账号已登录'}</small></div><Button disabled={busy} onClick={() => void run(readDetails)}>刷新账户</Button><Button disabled={busy} onClick={() => void run(async () => { try { await api.logout({ accountId }); } finally { await reloadAccounts(); } setGroups([]); setModels([]); setKeys(undefined); setBalance(undefined); setChallenge(undefined); }, '账号已退出，已绑定的聊天 key 仍可单独使用')}>退出账号</Button></div>
      {detailsErrors.map(message => <div className="tk-c-row tk-c-feedback tk-c-error" role="alert" key={message}><span className="tk-c-grow">{message}</span><Button disabled={busy} onClick={() => void run(readDetails)}>重试读取</Button></div>)}
      <div className="tk-c-balance-grid"><BalanceCard balance={balance} title="账户额度" /><BalanceCard balance={keyBalance} title="当前 key 额度" /></div>
      <section className="tk-c-card tk-c-stack" aria-label="本人分组与模型"><div className="tk-c-row"><h2>本人分组与模型</h2><Field label="查看分组"><select value={group} onChange={event => setGroup(event.target.value)}><option value="">全部可见分组</option>{groups.map(row => <option key={row.id} value={row.id}>{row.description === row.id ? row.id : `${row.description} · ${row.id}`}</option>)}</select></Field><small className="tk-c-muted">{models.length} 个目录模型</small></div>{modelError ? <div role="alert" className="tk-c-error">{modelError}</div> : <div className="tk-c-models" tabIndex={0}>{models.map(id => <span key={id} className="tk-c-model-id">{id}</span>)}{models.length === 0 && <span className="tk-c-muted">这个分组暂未返回模型</span>}</div>}</section>
      <section className="tk-c-card tk-c-stack" aria-label="选择聊天 key"><div className="tk-c-row"><h2>选择已有聊天 key</h2><small className="tk-c-muted">选中后用于聊天，分组沿用 key 自己的设置。</small></div><div className="tk-c-fields"><Field label="绑定到连接"><select disabled={busy} value={targetProvider} onChange={event => { setTargetProvider(event.target.value); setKeyBalance(undefined); }}><option value="">选择连接</option>{connections.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}<option value="__new">建立新连接</option></select></Field>{targetProvider === '__new' && <><Field label="新连接标识"><input disabled={busy} value={newProvider} onChange={event => { setNewProvider(event.target.value); setKeyBalance(undefined); }} /></Field><Field label="协议适配器"><select value={adapterId} onChange={event => setAdapterId(event.target.value)}><option value="">选择 DSH 适配器</option>{adapters.map(row => <option key={row.provider} value={row.provider}>{row.name}</option>)}</select></Field><Field label="协议"><input value={bindProtocol} onChange={event => setBindProtocol(event.target.value)} /></Field></>}</div>
        <div className="tk-c-key-list">{visibleKeys.map(key => <section className="tk-c-key-row" key={key.id} aria-label={key.name}><div className="tk-c-grow"><div className="tk-c-row"><strong>{key.name}</strong><span className="tk-c-tag">{key.group || '默认分组'}</span>{key.status !== undefined && key.status !== 1 && <span className="tk-c-tag">当前不可用</span>}</div><small className="tk-c-muted">{key.unlimited ? '无限额' : `key 额度 ${balance ? amount(key.remaining, balance.unit) : key.remaining === undefined ? '未返回' : `${key.remaining.toLocaleString('zh-CN')} 额度单位`}`}</small></div><Button primary disabled={busy || !provider || key.status !== undefined && key.status !== 1 || targetProvider === '__new' && !adapter} onClick={() => void run(async () => { const result = await api.bindKey({ accountId, keyId: key.id, provider, settingsNs: target?.settingsNs ?? adapter?.settingsNs, api: target?.api ?? bindProtocol }); await reloadConnections(); setKeyBalance(await api.keyBalance({ provider: result.provider, accountId })); }, '这个 key 已绑定到聊天连接')}>用于聊天</Button></section>)}{keys && visibleKeys.length === 0 && <div className="tk-c-row"><span className="tk-c-muted">本页没有这个分组的 key</span><Button onClick={() => setGroup('')}>查看全部分组</Button></div>}</div>
        {keys && <div className="tk-c-row tk-c-pagination"><small className="tk-c-muted">第 {keys.page} 页 · 共 {keys.total} 个 key</small><Button disabled={busy || keys.page <= 1} onClick={() => void run(async () => { setKeys(await api.listKeys({ accountId, page: keys.page - 1, pageSize: keys.pageSize })); })}>上一页</Button><Button disabled={busy || keys.page * keys.pageSize >= keys.total} onClick={() => void run(async () => { setKeys(await api.listKeys({ accountId, page: keys.page + 1, pageSize: keys.pageSize })); })}>下一页</Button></div>}
      </section>
    </>}
    <Feedback error={error} notice={notice} />
  </div>;
}

const PANEL_CSS = `
.tk-connections {
  --tk-c-canvas:var(--tk-page-canvas,var(--tk-canvas,var(--tk-bg,#f1eee5)));
  --tk-c-panel:var(--tk-page-panel,var(--tk-surface,#fffcf4));
  --tk-c-edge:var(--tk-page-edge,var(--tk-border,#d8cebc));
  --tk-c-accent:var(--tk-page-accent,var(--tk-accent,#586748));
  --tk-c-focus:var(--tk-page-focus,var(--tk-focus,#586748));
  --tk-c-radius:var(--tk-page-radius,var(--tk-radius,16px));
  --tk-c-inset:var(--tk-page-inset-shadow,inset 0 1px 0 #ffffff24);
  color:var(--tk-text,var(--text-color,#544633));background:var(--tk-c-canvas);
  font:400 14px/1.6 var(--tk-font-family,"Nunito",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif);
  width:100%;height:100%;min-width:0;min-height:0;overflow:auto;overscroll-behavior:auto;scrollbar-width:thin;
}
.tk-connections *,.tk-connections *::before,.tk-connections *::after { box-sizing:border-box; }
.tk-connections :is(h1,h2,h3,p,dl,dd) { margin:0; }
.tk-connections h1 { font:700 26px/1.3 var(--tk-title-font-family,var(--tk-font-family,inherit));letter-spacing:-.025em; }
.tk-connections h2 { font-size:16px;line-height:1.45; }
.tk-connections h3 { font-size:14px;line-height:1.5; }
.tk-connections p { color:var(--tk-muted,#78694f); }
.tk-c-page { width:min(1200px,100%);margin-inline:auto;padding:clamp(18px,3vw,38px) clamp(14px,3vw,36px) max(32px,env(safe-area-inset-bottom));display:grid;gap:18px; }
.tk-c-header { display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:20px;border-bottom:1px solid var(--tk-c-edge);min-width:0; }
.tk-c-identity { display:flex;align-items:center;gap:14px;min-width:0; }
.tk-c-header p { font-size:13px;margin-top:4px; }
.tk-c-page-mark { display:grid;grid-template-columns:repeat(2,9px);grid-template-rows:repeat(2,9px);place-content:center;gap:3px;flex:none;width:46px;height:46px;border:1px solid var(--tk-c-edge);border-radius:var(--tk-c-radius);background:var(--tk-c-panel);color:var(--tk-c-accent);box-shadow:var(--tk-c-inset); }
.tk-c-page-mark > span { border:1px solid currentColor;border-radius:2px; }
.tk-c-page-mark > span:first-child { grid-row:1/3;background:color-mix(in srgb,var(--tk-c-accent) 15%,transparent); }
.tk-c-page-mark > span:last-child { background:currentColor;opacity:.6; }
.tk-c-row { display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;min-width:0; }
.tk-c-stack { display:grid;gap:16px;min-width:0;align-content:start; }
.tk-c-grow { flex:1 1 160px;min-width:0; }
.tk-c-grow > :is(small,.tk-c-raw) { display:block; }
.tk-c-muted { color:var(--tk-muted,#78694f);font-size:12px; }
.tk-c-eyebrow { display:block;margin-bottom:3px;color:var(--tk-muted,#78694f);font-size:11px;letter-spacing:.06em; }
.tk-c-card { padding:20px;border:1px solid var(--tk-c-edge);border-radius:var(--tk-c-radius);background:var(--tk-c-panel);box-shadow:var(--tk-c-inset);min-width:0; }
.tk-c-tabs { display:flex;gap:4px;align-items:center;justify-self:start;max-width:100%;overflow-x:auto;padding:4px;border:1px solid var(--tk-c-edge);border-radius:var(--tk-c-radius);background:var(--tk-c-panel);box-shadow:var(--tk-c-inset);scrollbar-width:thin; }
.tk-c-tabs button { display:inline-flex;align-items:center;justify-content:center;flex:none;min-height:40px;padding:7px 18px;border:1px solid transparent;border-radius:max(0px,calc(var(--tk-c-radius) - 4px));background:transparent;color:var(--tk-muted,#78694f);white-space:nowrap;font:inherit;font-size:13px;cursor:pointer; }
.tk-c-tabs button[aria-selected="true"] { background:color-mix(in srgb,var(--tk-c-accent) 11%,var(--tk-c-panel));color:var(--tk-text,#544633);border-color:color-mix(in srgb,var(--tk-c-accent) 25%,transparent);font-weight:700; }
.tk-c-workspace { display:grid;grid-template-columns:minmax(230px,.8fr) minmax(0,2fr);gap:20px;align-items:start; }
.tk-c-connection-shelf { display:grid;gap:12px;min-width:0;padding:18px 14px;border:1px solid var(--tk-c-edge);border-radius:var(--tk-c-radius);background:color-mix(in srgb,var(--tk-c-panel) 45%,transparent); }
.tk-c-shelf-heading { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 4px 4px; }
.tk-c-shelf-count { display:grid;place-items:center;min-width:30px;height:30px;padding-inline:6px;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 6px));background:var(--tk-c-panel);font-size:13px;font-variant-numeric:tabular-nums; }
.tk-c-connection-grid { display:grid;gap:8px; }
.tk-c-connection { min-width:0;overflow:hidden;border:1px solid transparent;border-radius:max(0px,calc(var(--tk-c-radius) - 4px));background:var(--tk-c-panel); }
.tk-c-connection[data-selected="true"] { border-color:var(--tk-c-accent);background:color-mix(in srgb,var(--tk-c-accent) 6%,var(--tk-c-panel));box-shadow:var(--tk-c-inset); }
.tk-c-connection:focus-within { outline:2px solid var(--tk-c-focus);outline-offset:3px; }
.tk-c-connection-select { display:grid;gap:9px;width:100%;min-width:0;padding:13px;text-align:left;border:0;border-radius:inherit;background:transparent;color:inherit;font:inherit;cursor:pointer; }
.tk-c-connection-heading { display:flex;align-items:center;gap:10px;min-width:0; }
.tk-c-connection-monogram { display:grid;place-items:center;flex:none;width:34px;height:36px;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 7px));background:color-mix(in srgb,var(--tk-c-accent) 8%,var(--tk-c-panel));color:var(--tk-c-accent);font-size:16px;font-family:var(--tk-title-font-family,inherit); }
.tk-c-connection-name { display:grid;gap:2px;min-width:0; }
.tk-c-connection-name strong { font-size:14px;overflow-wrap:anywhere; }
.tk-c-connection-state { display:flex;align-items:center;gap:5px;color:var(--tk-muted,#78694f);font-size:11px; }
.tk-c-connection-state > span { width:5px;height:5px;border-radius:50%;background:var(--tk-muted,#78694f); }
.tk-c-connection-state > span[data-active="true"] { background:var(--tk-c-accent); }
.tk-c-connection-arrow { margin-left:auto;color:var(--tk-c-accent);font-size:21px;opacity:0; }
.tk-c-connection[data-selected="true"] .tk-c-connection-arrow { opacity:1; }
.tk-c-address { display:block;max-width:100%;overflow:auto;white-space:nowrap;font-size:11px;color:var(--tk-muted,#78694f);scrollbar-width:thin; }
.tk-c-connection-meta { display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--tk-muted,#78694f); }
.tk-c-connection > .tk-c-error { margin:0 12px 10px;font-size:12px;overflow-wrap:anywhere; }
.tk-c-shelf-actions { display:flex;flex-wrap:wrap;gap:6px;padding-top:5px; }
.tk-c-shelf-actions .tk-c-button { flex:1 1 auto;padding-inline:10px; }
.tk-c-connection-desk { display:grid;gap:14px;min-width:0; }
.tk-c-model-heading { display:flex;align-items:center;flex-wrap:wrap;gap:8px 12px;padding-bottom:14px;border-bottom:1px solid var(--tk-c-edge); }
.tk-c-model-heading h2 { font-size:20px;font-family:var(--tk-title-font-family,inherit); }
.tk-c-model-heading .tk-c-grow { flex-basis:200px; }
.tk-c-model-picker .tk-c-fields { grid-template-columns:minmax(0,1fr);gap:14px;margin-block:18px; }
.tk-c-model-actions { padding-top:2px; }
.tk-c-model-actions > small { flex-basis:100%;margin-top:2px; }
.tk-c-button { display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;max-width:100%;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 6px));padding:7px 13px;background:var(--tk-c-panel);color:inherit;font:inherit;font-size:13px;line-height:1.45;text-decoration:none;cursor:pointer;box-shadow:var(--tk-c-inset);transition:background-color .15s,border-color .15s;touch-action:manipulation; }
.tk-c-button.tk-c-primary { background:var(--tk-c-accent);color:var(--tk-accent-ink,#fffcf4);border-color:transparent;box-shadow:var(--tk-c-inset);font-weight:700; }
.tk-c-primary:not(:disabled):active { filter:brightness(.95); }
.tk-connections button:disabled { cursor:default;opacity:.5; }
.tk-c-tag { display:inline-flex;align-items:center;gap:5px;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 8px));background:color-mix(in srgb,var(--tk-c-accent) 6%,var(--tk-c-panel));color:var(--tk-muted,#78694f);padding:2px 7px;font-size:11px;white-space:nowrap; }
.tk-c-tag[data-ready="true"] { color:var(--tk-c-accent); }
.tk-c-fields { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-block:14px; }
.tk-c-field { display:grid;align-content:start;gap:6px;min-width:0;font-size:12px;font-weight:600; }
.tk-c-row > .tk-c-field { min-width:min(100%,190px); }
.tk-c-field :is(input,select,textarea) { display:block;width:100%;min-width:0;min-height:42px;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 7px));padding:9px 11px;background:color-mix(in srgb,var(--tk-c-canvas) 45%,var(--tk-c-panel));color:inherit;font:inherit;font-size:14px;font-weight:400;box-shadow:var(--tk-c-inset); }
.tk-c-field :is(input,textarea)::placeholder { color:var(--tk-muted,#78694f);opacity:.8; }
.tk-c-field :is(input,select,textarea):disabled { opacity:.55; }
.tk-c-field textarea { resize:vertical;line-height:1.6; }
.tk-c-field small { font-weight:400;color:var(--tk-muted,#78694f); }
.tk-c-check { display:inline-flex;align-items:center;gap:7px;font-size:13px;min-height:40px;cursor:pointer; }
.tk-c-check input { width:17px;height:17px;accent-color:var(--tk-c-focus);margin:0; }
.tk-connections :is(button,input,select,textarea,a,summary,[tabindex]):focus-visible { outline:2px solid var(--tk-c-focus);outline-offset:3px; }
.tk-c-feedback { display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 13px;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 6px));background:var(--tk-c-panel);font-size:13px;margin-block:2px;overflow-wrap:anywhere; }
.tk-c-error { color:var(--tk-danger,#96443d); }
.tk-c-feedback.tk-c-error { border-color:var(--tk-danger,#96443d); }
.tk-c-detail-body { margin-top:16px; }
.tk-connections summary { cursor:pointer;font-weight:600;min-height:30px; }
.tk-c-facts { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-block:1px solid var(--tk-c-edge); }
.tk-c-facts > div { padding:12px 10px 12px 0; }
.tk-c-facts dt { font-size:11px;color:var(--tk-muted,#78694f); }
.tk-c-facts dd { font-weight:600;font-variant-numeric:tabular-nums;overflow-wrap:anywhere; }
.tk-c-facts small { display:block;color:var(--tk-muted,#78694f);font-size:10px;font-weight:400; }
.tk-c-candidate { padding:10px;background:var(--tk-c-canvas);border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 7px)); }
.tk-c-advanced-heading { align-items:center; }
.tk-c-advanced-workspace { display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start;min-width:0; }
.tk-c-chain { display:grid; }
.tk-c-chain-row { display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:12px 0;border-bottom:1px solid var(--tk-c-edge);min-width:0; }
.tk-c-chain-row:last-child { border-bottom:0; }
.tk-c-raw { overflow-wrap:anywhere;font-size:12px;color:var(--tk-muted,#78694f); }
.tk-c-balance-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px; }
.tk-c-balance { padding:16px 18px;border:1px solid var(--tk-c-edge);border-radius:var(--tk-c-radius);background:var(--tk-c-panel);box-shadow:var(--tk-c-inset);min-width:0; }
.tk-c-balance h3 { margin-bottom:5px;color:var(--tk-muted,#78694f);font-weight:500; }
.tk-c-balance strong { font-size:25px;line-height:1.4;font-variant-numeric:tabular-nums;overflow-wrap:anywhere; }
.tk-c-key-list { display:grid;max-height:440px;overflow:auto;scrollbar-width:thin; }
.tk-c-key-row { display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--tk-c-edge); }
.tk-c-key-row:last-child { border-bottom:0; }
.tk-c-models { display:flex;align-content:start;flex-wrap:wrap;gap:6px;max-height:180px;overflow:auto;scrollbar-width:thin; }
.tk-c-model-id { padding:4px 8px;border:1px solid var(--tk-c-edge);border-radius:max(0px,calc(var(--tk-c-radius) - 9px));font-size:12px;overflow-wrap:anywhere; }
.tk-c-pagination { justify-content:flex-end;padding-top:12px;border-top:1px solid var(--tk-c-edge); }
.tk-c-sponsor-intro { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px 24px;background:color-mix(in srgb,var(--tk-c-accent) 7%,var(--tk-c-panel)); }
.tk-c-sponsor-intro h2 { font-size:19px; }
.tk-c-sponsor-intro p { margin-top:4px; }
.tk-c-sponsor-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:16px;align-items:start; }
.tk-c-sponsor { display:grid;gap:16px; }
.tk-c-logo { width:46px;height:46px;object-fit:contain; }
.tk-c-sponsor .tk-c-tag { margin-top:4px; }
.tk-c-sponsor h3 { font-size:16px; }
.tk-c-sponsor-dialog { width:min(480px,calc(100% - 24px));max-height:calc(100dvh - max(24px,env(safe-area-inset-top)) - env(safe-area-inset-bottom));margin:auto;padding:20px;border:1px solid var(--tk-c-edge);border-radius:var(--tk-c-radius);background:var(--tk-c-panel);color:inherit;font:inherit;overflow:auto;overscroll-behavior:contain; }
.tk-c-sponsor-dialog::backdrop { background:rgb(24 20 16 / .48); }
.tk-c-sponsor-dialog-head { display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--tk-c-edge); }
.tk-c-sponsor-dialog-head h2 { font-size:19px; }
.tk-c-sponsor-dialog-head button { flex:none; }
.tk-c-sponsor-letter { display:grid;gap:12px;padding-top:14px; }
.tk-c-sponsor-letter p { color:inherit; }
.tk-c-sponsor-letter a { color:inherit;font-weight:700;text-decoration:underline;text-underline-offset:.18em; }
.tk-c-empty { display:grid;justify-items:start;gap:18px;padding-block:30px; }
.tk-c-empty h2 { font-size:20px; }
.tk-c-empty p { margin-top:6px; }
.tk-c-empty-mark { display:flex;align-items:center;gap:5px;color:var(--tk-c-accent); }
.tk-c-empty-mark > span { width:30px;height:24px;border:1px solid currentColor;border-radius:max(0px,calc(var(--tk-c-radius) - 8px));box-shadow:var(--tk-c-inset); }
.tk-c-empty-mark > span:last-child { width:20px;background:color-mix(in srgb,currentColor 12%,transparent); }
.tk-c-loading { display:flex;align-items:center;gap:12px; }
.tk-c-loading .tk-c-muted { display:block;margin-top:2px; }
.tk-c-loading-mark { width:28px;height:32px;border:1px solid var(--tk-c-edge);border-left:3px solid var(--tk-c-accent);border-radius:max(0px,calc(var(--tk-c-radius) - 8px));background:var(--tk-c-canvas); }
@media(min-width:1200px) { .tk-c-model-picker .tk-c-fields { grid-template-columns:minmax(0,1fr) minmax(0,1.1fr); } }
@media(hover:hover) and (pointer:fine) { .tk-c-button:not(:disabled):hover,.tk-c-tabs button:not([aria-selected="true"]):hover { border-color:var(--tk-c-accent);background:color-mix(in srgb,var(--tk-c-accent) 7%,var(--tk-c-panel)); } .tk-c-button.tk-c-primary:not(:disabled):hover { background:var(--tk-c-accent);filter:brightness(1.07); } .tk-c-connection-select:hover { background:color-mix(in srgb,var(--tk-c-accent) 5%,transparent); } }
@media(max-width:840px) { .tk-c-workspace { grid-template-columns:minmax(0,1fr);gap:14px; } .tk-c-connection-shelf { padding:14px; } .tk-c-connection-grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .tk-c-shelf-actions { padding-top:0; } .tk-c-shelf-actions .tk-c-button { flex:initial; } }
@media(max-width:600px) { .tk-c-page { padding:20px 12px max(26px,env(safe-area-inset-bottom));gap:14px; } .tk-c-header { padding-bottom:16px;gap:10px; } .tk-c-identity { gap:10px; } .tk-c-page-mark { width:38px;height:40px; } .tk-connections h1 { font-size:22px; } .tk-c-header p { font-size:12px; } .tk-c-card { padding:16px; } .tk-c-tabs { justify-self:stretch;width:100%; } .tk-c-tabs button { padding-inline:12px;flex:1 0 auto; } .tk-c-fields { gap:14px;grid-template-columns:minmax(0,1fr); } .tk-c-field :is(input,select,textarea) { font-size:16px; } .tk-c-key-row { align-items:flex-start; } .tk-c-key-row .tk-c-grow { flex-basis:100px; } .tk-c-model-heading h2 { font-size:18px; } .tk-c-model-heading .tk-c-grow { flex-basis:100%; } .tk-c-facts { grid-template-columns:repeat(2,minmax(0,1fr)); } .tk-c-balance-grid { gap:8px; } .tk-c-balance { padding:13px; } .tk-c-balance strong { font-size:21px; } .tk-c-advanced-heading > .tk-c-field { flex-basis:100%; } }
@media(max-width:380px) { .tk-c-connection-grid { grid-template-columns:minmax(0,1fr); } .tk-c-page-mark { display:none; } .tk-c-page { padding-inline:10px; } }
@media(prefers-reduced-motion:reduce) { .tk-connections * { transition:none!important;scroll-behavior:auto!important; } }
`;
