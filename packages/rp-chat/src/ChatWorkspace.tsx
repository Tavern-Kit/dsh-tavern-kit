import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, ChevronRight, Courtyard, Download, FolderHeart, Import, Layers2, LockKeyhole, Menu, NotebookPen, Plus, Search, Settings2 } from './ThemeIcons.js';
import type { MaterialSummary, MaterialVersion } from '@tavern-kit/rp-materials/types';
import type { ConnectionView } from '@tavern-kit/rp-connections/types';
import type { Conversation, Memo } from './types.js';
import { StoryCover } from './ChatChrome.js';
import { OverflowLine } from './OverflowLine.js';
import { TavernScene, TaskStamp, TavernEmblem } from './TavernArt.js';

const dateLabel = (value: number) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
const originLabel = (value: Conversation) => value.source?.kind === 'deepseek-chat-export' ? 'DeepSeek 迁入' : value.bindings.length ? '角色对话' : '自由对话';

export function ConversationList({ conversations, currentId, onOpen, searchable = false, disabled = false }: { conversations: Conversation[]; currentId?: string; onOpen(id: string): void; searchable?: boolean; disabled?: boolean }): React.ReactElement {
  const [search, setSearch] = useState('');
  const visible = conversations.filter(value => value.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <>{searchable && <label className="tk-conversation-search"><Search size={15} aria-hidden="true" /><input type="search" aria-label="搜索对话" placeholder="搜索对话" value={search} onChange={event => setSearch(event.target.value)} /></label>}
    <div className="tk-sidebar-section"><span>最近对话</span><span>{search ? `${visible.length} / ` : ''}{conversations.length}</span></div>
    <div className="tk-nav-cards">{visible.map(value => <button className={`tk-conversation ${currentId === value.id ? 'tk-selected' : ''}`} aria-label={value.title} aria-current={currentId === value.id ? 'page' : undefined} key={value.id} disabled={disabled} onClick={() => onOpen(value.id)}>
      <StoryCover seed={value.title} /><span className="tk-conversation-copy"><strong><OverflowLine>{value.title}</OverflowLine></strong><span className="tk-conversation-meta"><small>{dateLabel(value.updatedAt)}</small><span>{originLabel(value)}</span></span></span>
    </button>)}{!visible.length && <p className="tk-sidebar-empty">{search ? '没有找到这段对话，换个名字试试。' : '带上角色，从第一句话开始。'}</p>}</div>
  </>;
}

interface WorkspaceHomeProps {
  conversations: Conversation[];
  materials: MaterialSummary[];
  connections: ConnectionView[];
  onOpen(id: string): void;
  onBegin(characterId?: string): void;
  onNavigate(destination: 'materials' | 'import' | 'connections' | 'appearance'): void;
  onShowAll(): void;
  onRestore(file: File): void;
  renderScene?(area: 'home' | 'chat'): React.ReactNode;
}

export function WorkspaceHome({ conversations, materials, connections, onOpen, onBegin, onNavigate, onShowAll, onRestore, renderScene }: WorkspaceHomeProps): React.ReactElement {
  const latest = conversations[0];
  const backupFile = useRef<HTMLInputElement>(null);
  const characters = materials.filter(value => value.kind === 'character' && value.enabled);
  return <div className="tk-home">
    <header className="tk-home-top">
      <div className="tk-home-location">
        <button type="button" className="tk-mobile-navigation tk-icon-control" aria-label="打开会话列表" onClick={onShowAll}><Menu size={20} aria-hidden="true" /></button>
        <span className="tk-home-sign"><TavernEmblem /><span>Tavern Kit</span></span>
      </div>
      <button type="button" className="tk-restore-link" onClick={() => backupFile.current?.click()}><Download size={16} aria-hidden="true" /><span>恢复对话</span></button>
      <input ref={backupFile} hidden type="file" accept=".zip,application/zip" aria-label="选择对话备份文件" onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) onRestore(file);
      }} />
    </header>
    <div className="tk-home-heading"><h1>我的酒馆</h1><button className="tk-primary tk-home-new" onClick={() => onBegin()}><Plus size={15} aria-hidden="true" />新对话</button></div>
    <div className="tk-home-launchpad">
      <section className="tk-continue-card"><button type="button" className="tk-continue-link" aria-label={latest ? `继续聊天：${latest.title}` : '开一段新的对话'} onClick={() => latest ? onOpen(latest.id) : onBegin()}>
        <span className="tk-continue-copy"><span className="tk-card-kicker"><span className="tk-status-dot" />{latest ? '上次聊到' : '从第一句话开始'}</span><strong>{latest?.title ?? '开一段新对话'}</strong><span className="tk-continue-caption">{latest ? `${dateLabel(latest.updatedAt)} · ${originLabel(latest)}` : '可以先选角色，也可以直接聊'}</span><span className="tk-continue-action">{latest ? '继续聊天' : '开始聊天'}<span><ArrowRight size={16} aria-hidden="true" /></span></span></span></button><div className="tk-home-scene">{renderScene ? renderScene('home') : <TavernScene className="tk-welcome-scene" />}</div>
      </section>
      <div className="tk-entry-stack"><button className="tk-start-entry" onClick={() => onNavigate('import')}><span className="tk-entry-icon"><TaskStamp kind="letter" /></span><span><strong>接回旧对话</strong><small>DeepSeek ZIP 或酒馆 JSONL</small></span><ChevronRight size={16} aria-hidden="true" /></button><button className="tk-start-entry" onClick={() => onNavigate('materials')}><span className="tk-entry-icon"><TaskStamp kind="library" /></span><span><strong>带上角色卡</strong><small>角色、世界书和熟悉的设定</small></span><ChevronRight size={16} aria-hidden="true" /></button></div>
    </div>
    <section className="tk-home-recents"><header><div className="tk-section-title"><BookOpen size={17} aria-hidden="true" /><h2>最近的对话</h2><span className="tk-count-badge">{conversations.length}</span></div><button className="tk-text-action" onClick={onShowAll}>全部对话<ChevronRight size={14} aria-hidden="true" /></button></header>
      {conversations.length > 1 ? <div className="tk-recent-grid">{conversations.slice(1, 5).map(value => <button key={value.id} className="tk-recent-card" onClick={() => onOpen(value.id)}><StoryCover seed={value.title} /><span className="tk-recent-copy"><strong>{value.title}</strong><small><span>{originLabel(value)}</span><i /><time dateTime={new Date(value.updatedAt).toISOString()}>{dateLabel(value.updatedAt)}</time></small></span><ChevronRight className="tk-recent-arrow" size={16} aria-hidden="true" /></button>)}</div> : <div className="tk-home-empty"><BookOpen size={22} strokeWidth={1.5} aria-hidden="true" /><span><strong>{latest ? '只有一段对话' : '还没有对话'}</strong><small>{latest ? '上次的对话可以从上方打开' : '可以新建，也可以导入旧对话'}</small></span><button className="tk-text-action" onClick={() => onBegin()}>新对话<Plus size={15} aria-hidden="true" /></button></div>}
    </section>
    <section className="tk-home-library"><header><div className="tk-section-title"><FolderHeart size={17} aria-hidden="true" /><h2>我的角色</h2><span className="tk-count-badge">{characters.length}</span></div><button className="tk-text-action" onClick={() => onNavigate('materials')}>整理素材<ChevronRight size={14} aria-hidden="true" /></button></header>{characters.length ? <div className="tk-character-shortcuts">{characters.slice(0, 4).map(value => <button key={value.id} onClick={() => onBegin(value.id)}><StoryCover seed={value.name} /><span><strong>{value.name}</strong><small>使用此角色开聊</small></span><Plus size={15} aria-hidden="true" /></button>)}</div> : <button className="tk-add-character" onClick={() => onNavigate('materials')}><span className="tk-add-character-icon"><Plus size={20} aria-hidden="true" /></span><span><strong>带一位角色来</strong><small>本地导入角色卡，保留原件与设定</small></span><ArrowRight size={16} aria-hidden="true" /></button>}</section>
    <footer className="tk-home-footer"><Layers2 size={15} aria-hidden="true" /><span>{connections.length ? `${connections.length} 个模型连接` : '先连接一个模型，就可以开始聊天'}</span><button className="tk-text-action" onClick={() => onNavigate('connections')}>管理连接<ChevronRight size={13} aria-hidden="true" /></button></footer>
  </div>;
}

export function ConversationContext({ conversation, bound, memo, image, connections, onSettings, onMemo }: { conversation: Conversation; bound: MaterialVersion[]; memo?: Memo; image?: string; connections: ConnectionView[]; onSettings(): void; onMemo(): void }): React.ReactElement {
  const role = bound.find(value => value.projection.character)?.projection.character;
  const route = conversation.settings.mainRoute;
  const connection = connections.find(value => value.provider === route?.provider);
  const books = bound.filter(value => value.projection.worldbook);
  const preset = bound.find(value => value.projection.preset);
  return <aside className="tk-conversation-context" aria-label="当前对话资料">
    <div className="tk-context-heading"><span>人物与约定</span><button className="tk-icon-control" aria-label="调整对话资料" onClick={onSettings}><Settings2 size={16} aria-hidden="true" /></button></div>
    {role ? <section className="tk-context-character"><StoryCover seed={role.name} image={image} /><div><span className="tk-context-eyebrow">此刻，和你对话的人</span><h2>{role.name}</h2>{(role.personality || role.scenario) && <p>{role.personality || role.scenario}</p>}</div><div className="tk-context-identity"><span>你是</span><strong>{conversation.settings.playerName}</strong><button className="tk-text-action" onClick={onSettings}>调整称呼</button></div></section> : <section className="tk-context-player"><span className="tk-player-initial" aria-hidden="true">{conversation.settings.playerName.slice(0, 1)}</span><div><span>你的身份</span><strong>{conversation.settings.playerName}</strong>{conversation.settings.playerDescription && <p>{conversation.settings.playerDescription}</p>}</div><button className="tk-text-action" aria-label="修改玩家设定" onClick={onSettings}>修改</button></section>}
    <section className="tk-context-model" aria-label="当前模型"><header><Layers2 size={16} aria-hidden="true" /><h2>{connection?.name ?? route?.provider ?? '聊天模型'}</h2><button className="tk-text-action" aria-label="更换模型连接" onClick={onSettings}>更换</button></header>{route ? <><code title={route.model}>{route.model}</code><div className="tk-context-model-meta">{route.group && <span>{route.group}</span>}<span>{conversation.settings.parallel ? `同时 ${conversation.settings.parallelCount} 条` : '单条回复'}</span></div></> : <button className="tk-text-action" onClick={onSettings}>选择聊天模型<ArrowRight size={13} aria-hidden="true" /></button>}</section>
    <section className="tk-context-memo"><header><NotebookPen size={16} aria-hidden="true" /><h2>剧情备忘</h2><button className="tk-icon-control" aria-label="编辑剧情备忘" onClick={onMemo}><ArrowRight size={16} aria-hidden="true" /></button></header>{memo?.content ? <><p>{memo.content}</p>{memo.locked.length > 0 && <span className="tk-memo-lock"><LockKeyhole size={12} aria-hidden="true" />{memo.locked.length} 项已锁定</span>}</> : <p className="tk-context-empty">把称呼和约定，记在这一页。</p>}</section>
    {(books.length > 0 || preset) && <div className="tk-context-bindings">{books.length > 0 && <span><BookOpen size={14} aria-hidden="true" />{books.length} 份世界书</span>}{preset && <span><Settings2 size={13} aria-hidden="true" />{preset.projection.name}</span>}</div>}
  </aside>;
}

/** One courtyard moves between an inert atmosphere and an explicit viewing surface. */
export function PresentationRegion({ renderScene, onInspectChange }: { renderScene(area: 'home' | 'chat'): React.ReactNode; onInspectChange?(inspecting: boolean): void }): React.ReactElement {
  const [expanded, setExpanded] = useState(true), [large, setLarge] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const inspecting = expanded && large;
  useEffect(() => { onInspectChange?.(inspecting); }, [inspecting, onInspectChange]);
  useEffect(() => () => { onInspectChange?.(false); }, [onInspectChange]);
  useEffect(() => {
    const root = toggle.current?.ownerDocument.documentElement;
    if (!root) return;
    // This suite-owned attribute also changes when appearance is unloaded or its background is disabled.
    const observer = new MutationObserver(() => { if (root.dataset.tkSceneKind !== 'xi4u') setLarge(false); });
    observer.observe(root, { attributes: true, attributeFilter: ['data-tk-scene-kind'] });
    return () => observer.disconnect();
  }, []);
  return <section className={`tk-presentation${inspecting ? ' tk-presentation-large' : ''}`} aria-label="主题场景" onKeyDown={event => {
    if (event.key === 'Escape' && inspecting) { event.preventDefault(); event.stopPropagation(); setLarge(false); toggle.current?.focus(); }
  }}>
    <header><span>窗外一角</span><div className="tk-presentation-actions"><button ref={toggle} type="button" className="tk-text-action tk-micro-control" aria-label={inspecting ? '还原场景' : '放大场景'} aria-pressed={inspecting} data-tk-icon-trigger="" onClick={() => { setExpanded(true); setLarge(value => !value); }}><Courtyard size={16} aria-hidden="true" />{inspecting ? '返回对话' : '看看庭院'}</button><button type="button" className="tk-text-action tk-micro-control" aria-label={expanded ? '收起场景' : '展开场景'} aria-expanded={expanded} onClick={() => { setExpanded(value => !value); setLarge(false); }}>{expanded ? '隐藏' : '显示'}<ChevronRight size={13} aria-hidden="true" /></button></div></header>
    {expanded && <div className="tk-presentation-view" ref={element => { if (element) element.inert = !inspecting; }} aria-hidden={inspecting ? undefined : true}>{renderScene('chat')}</div>}
  </section>;
}
