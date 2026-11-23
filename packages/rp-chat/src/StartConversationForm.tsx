import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, FolderHeart, Layers2, RefreshCw } from './ThemeIcons.js';
import type { MaterialSummary, MaterialVersion, MaterialVersionRef, PortableResource } from '@tavern-kit/rp-materials/types';
import type { Route } from '@tavern-kit/rp-connections/types';
import type { CreateInput } from './protocol.js';
import { defaultSettings } from './types.js';
import { macros } from './prompt.js';

export interface StartConversationFormProps {
  materials: MaterialSummary[];
  routes: Route[];
  initialCharacterId?: string;
  readVersion(ref: MaterialVersionRef): Promise<MaterialVersion>;
  readResources?(ref: MaterialVersionRef): Promise<PortableResource[]>;
  onCreate(input: CreateInput): Promise<void>;
  onNavigate(destination: 'materials' | 'connections'): void;
  busy?: boolean;
}

type MaterialLoad = { key: string; status: 'loading' } | { key: string; status: 'ready'; value: MaterialVersion } | { key: string; status: 'error'; message: string };
const materialKey = (ref: MaterialVersionRef): string => JSON.stringify([ref.id, ref.version]);
const routeKey = (route: Route): string => JSON.stringify([route.provider, route.model, route.connectionId, route.group]);
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error);

/** Local drafts and version previews only; the existing Host owns creation and route resolution. */
export function StartConversationForm({ materials, routes, initialCharacterId, readVersion, readResources, onCreate, onNavigate, busy = false }: StartConversationFormProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [characterId, setCharacterId] = useState(initialCharacterId ?? '');
  const [modelKey, setModelKey] = useState('');
  const [playerName, setPlayerName] = useState(() => defaultSettings().playerName);
  const [playerDescription, setPlayerDescription] = useState('');
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [load, setLoad] = useState<MaterialLoad>();
  const [retry, setRetry] = useState(0);
  const [personaRef, setPersonaRef] = useState<MaterialVersionRef>();
  const [personaLoad, setPersonaLoad] = useState<MaterialLoad>();
  const [personaRetry, setPersonaRetry] = useState(0);
  const [avatar, setAvatar] = useState<{ key: string; url: string }>();
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const submitting = useRef(false);
  const reader = useRef(readVersion); reader.current = readVersion;
  const resourceReader = useRef(readResources); resourceReader.current = readResources;
  const characters = materials.filter(value => value.kind === 'character' && value.enabled);
  const personas = materials.filter(value => value.kind === 'persona' && value.enabled);
  const personaKey = personaRef ? materialKey(personaRef) : '';
  const loadedPersona = personaLoad?.key === personaKey ? personaLoad : undefined;
  const personaMaterial = loadedPersona?.status === 'ready' ? loadedPersona.value : undefined;
  const identity = personaMaterial?.projection.persona;
  const personaListed = personas.some(value => materialKey({ id: value.id, version: value.currentVersion }) === personaKey);
  const personaAvatar = avatar?.key === personaKey ? avatar.url : undefined;
  const waitingForPersona = Boolean(personaRef && !identity);
  const selected = characters.find(value => value.id === characterId);
  const version = selected?.currentVersion;
  const characterKey = `${characterId}@${version ?? 'missing'}`;
  const loaded = load?.key === characterKey ? load : undefined;
  const material = loaded?.status === 'ready' ? loaded.value : undefined;
  const character = material?.projection.character;
  const route = routes.find(value => routeKey(value) === modelKey) ?? routes[0];
  const greetings = character ? [character.firstMessage, ...character.alternateGreetings] : [];
  const waitingForCharacter = Boolean(characterId && !character);
  const disabled = busy || creating;

  useEffect(() => {
    let disposed = false;
    setGreetingIndex(0);
    if (!characterId) { setLoad(undefined); return; }
    if (version === undefined) {
      setLoad({ key: characterKey, status: 'error', message: '没有找到这份角色卡，请重新选择或到素材库检查。' });
      return;
    }
    setLoad({ key: characterKey, status: 'loading' });
    void (async () => {
      const value = await reader.current({ id: characterId, version });
      if (value.id !== characterId || value.version !== version || !value.projection.character) throw new Error('没有读到所选角色版本，请重新读取或选择角色卡。');
      if (!disposed) setLoad({ key: characterKey, status: 'ready', value });
    })().catch(reason => { if (!disposed) setLoad({ key: characterKey, status: 'error', message: errorText(reason) }); });
    return () => { disposed = true; };
  }, [characterId, characterKey, version, retry]);

  useEffect(() => {
    let disposed = false;
    if (!personaRef) { setPersonaLoad(undefined); return; }
    setPersonaLoad({ key: personaKey, status: 'loading' });
    void (async () => {
      const value = await reader.current(personaRef);
      const projection = value.projection.persona;
      if (value.id !== personaRef.id || value.version !== personaRef.version || !projection) throw new Error('没有读到所选人设版本，请重新读取或选择人设。');
      if (disposed) return;
      setPersonaLoad({ key: personaKey, status: 'ready', value });
      setPlayerName(projection.name);
      setPlayerDescription(projection.description);
    })().catch(reason => { if (!disposed) setPersonaLoad({ key: personaKey, status: 'error', message: errorText(reason) }); });
    return () => { disposed = true; };
  }, [personaKey, personaRetry]);

  useEffect(() => {
    let disposed = false;
    setAvatar(undefined);
    const read = resourceReader.current;
    if (!personaRef || !identity?.avatarPath || !read) return;
    const avatarPath = identity.avatarPath;
    void (async () => {
      const resources = await read(personaRef);
      if (disposed) return;
      const resource = resources.find(value => value.path === avatarPath && ['image/png', 'image/jpeg', 'image/webp'].includes(value.mediaType));
      if (resource) setAvatar({ key: personaKey, url: `data:${resource.mediaType};base64,${resource.base64}` });
    })().catch(() => undefined);
    return () => { disposed = true; };
  }, [personaKey, identity?.avatarPath, personaMaterial]);

  const preview = character ? macros(greetings[greetingIndex] ?? '', {
    char: character.name, user: playerName, persona: playerDescription,
    description: character.description, personality: character.personality, scenario: character.scenario,
  }) : '';
  async function create(): Promise<void> {
    if (busy || submitting.current || waitingForCharacter || waitingForPersona) return;
    submitting.current = true; setCreating(true); setError('');
    try {
      await onCreate({
        title: title.trim() || selected?.name || '新的对话',
        bindings: [...(material ? [{ id: material.id, version: material.version }] : []), ...(personaMaterial ? [{ id: personaMaterial.id, version: personaMaterial.version }] : [])],
        settings: { playerName, playerDescription, ...(route ? { mainRoute: route } : {}) },
        ...(material ? { greetingIndex } : {}),
      });
    } catch (reason) { setError(errorText(reason)); }
    finally { submitting.current = false; setCreating(false); }
  }

  return <form className="tk-start-form" onSubmit={event => { event.preventDefault(); void create(); }} aria-busy={disabled}>
    <section className="tk-start-identity">
      <div className="tk-start-nameplate"><span className="tk-start-initial" aria-hidden="true">{(character?.name ?? selected?.name ?? '聊').slice(0, 1)}</span><div><strong>{character?.name ?? selected?.name ?? '从一句你好开始'}</strong><small>{characterId ? '带着角色卡，写下新的相遇' : '自由对话，也可以稍后再带上角色'}</small></div></div>
      <div className="tk-form-grid">
        <label>对话名字<input value={title} disabled={disabled} placeholder={selected?.name ?? '新的对话'} onChange={event => setTitle(event.target.value)} /></label>
        <label>带上角色<select value={characterId} disabled={disabled} onChange={event => { setCharacterId(event.target.value); setGreetingIndex(0); setError(''); }}><option value="">暂不带角色</option>{characterId && !selected && <option value={characterId}>所选角色暂不可用</option>}{characters.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
      </div>
      <div className="tk-start-material-action"><button type="button" className="tk-text-action" disabled={disabled} onClick={() => onNavigate('materials')}><FolderHeart size={15} aria-hidden="true" />{characters.length ? '去素材库看看' : '带上角色卡'}</button></div>
    </section>
    <section className="tk-start-player" aria-label="玩家身份">
      <div className="tk-start-persona">
        <span className="tk-start-persona-avatar">{personaAvatar ? <img src={personaAvatar} alt="我的人设头像" onError={() => setAvatar(current => current?.key === personaKey ? undefined : current)} /> : <span aria-hidden="true">{(playerName || '我').slice(0, 1)}</span>}</span>
        <label className="tk-start-persona-choice">我的人设<select value={personaKey} disabled={disabled} onChange={event => {
          const selectedPersona = personas.find(value => materialKey({ id: value.id, version: value.currentVersion }) === event.target.value);
          setPersonaRef(selectedPersona ? { id: selectedPersona.id, version: selectedPersona.currentVersion } : undefined);
          setError('');
        }}><option value="">手动填写</option>{personaRef && !personaListed && <option value={personaKey}>{identity?.name ?? '已选人设'} · 版本 {personaRef.version}</option>}{personas.map(value => <option key={value.id} value={materialKey({ id: value.id, version: value.currentVersion })}>{value.name} · 版本 {value.currentVersion}</option>)}</select></label>
        <button type="button" className="tk-text-action" disabled={disabled} onClick={() => onNavigate('materials')}><FolderHeart size={15} aria-hidden="true" />管理我的人设</button>
      </div>
      {personaRef && (loadedPersona?.status === 'error' ? <div className="tk-error tk-start-read-error" role="alert"><span>{loadedPersona.message}</span><button type="button" className="tk-text-action" disabled={disabled} aria-label="重新读取人设" onClick={() => setPersonaRetry(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />重新读取</button></div> : waitingForPersona && <p role="status">正在读入我的人设…</p>)}
      <div className="tk-form-grid">
        <label>你的称呼<input value={playerName} disabled={disabled} onChange={event => setPlayerName(event.target.value)} /></label>
        <label>玩家设定<textarea value={playerDescription} disabled={disabled} rows={2} placeholder="例如：旧城书店的常客，喜欢海风" onChange={event => setPlayerDescription(event.target.value)} /></label>
      </div>
    </section>
    {characterId && <section className="tk-start-greeting" aria-label="角色开场" aria-busy={waitingForCharacter && loaded?.status !== 'error'}>
      <header><div><strong>第一句话</strong>{character && <small>{greetingIndex === 0 ? '默认首句' : `备选首句 ${greetingIndex}`} · {greetingIndex + 1} / {greetings.length}</small>}</div>{character && <div className="tk-start-greeting-nav"><button type="button" className="tk-icon-control" aria-label="上一个首句" disabled={disabled || greetingIndex === 0} onClick={() => setGreetingIndex(index => Math.max(0, index - 1))}><ChevronLeft size={17} aria-hidden="true" /></button><button type="button" className="tk-icon-control" aria-label="下一个首句" disabled={disabled || greetingIndex + 1 >= greetings.length} onClick={() => setGreetingIndex(index => Math.min(greetings.length - 1, index + 1))}><ChevronRight size={17} aria-hidden="true" /></button></div>}</header>
      {character ? <p className="tk-start-greeting-preview">{preview || '这段开场留白，从你的第一句话开始。'}</p> : loaded?.status === 'error' ? <div className="tk-error tk-start-read-error" role="alert"><span>{loaded.message}</span><button type="button" className="tk-text-action" disabled={disabled} aria-label="重新读取角色" onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />重新读取</button></div> : <p role="status">正在翻开角色的第一句话…</p>}
    </section>}
    <div className="tk-start-model"><label>使用模型<select value={route ? routeKey(route) : ''} disabled={disabled || !routes.length} onChange={event => setModelKey(event.target.value)}>{!routes.length && <option value="">稍后选择模型</option>}{routes.map(value => <option key={routeKey(value)} value={routeKey(value)}>{value.label ?? `${value.provider} · ${value.model}`}{value.group ? ` · ${value.group}` : ''}</option>)}</select></label><button type="button" className="tk-text-action" disabled={disabled} onClick={() => onNavigate('connections')}><Layers2 size={15} aria-hidden="true" />连接模型</button></div>
    {error && <p className="tk-error" role="alert">{error}</p>}
    <footer className="tk-start-actions"><button type="submit" className="tk-primary" disabled={disabled || waitingForCharacter || waitingForPersona}>{disabled ? '正在建立对话…' : '开始聊天'}<ArrowRight size={16} aria-hidden="true" /></button></footer>
  </form>;
}
