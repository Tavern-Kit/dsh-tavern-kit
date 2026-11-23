import React, { useEffect, useRef, useState } from 'react';
import type { MaterialSummary, MaterialVersion, MaterialVersionRef, PortableResource } from '@tavern-kit/rp-materials/types';

export interface PersonaPickerProps {
  materials: MaterialSummary[];
  value?: MaterialVersionRef;
  readVersion(ref: MaterialVersionRef): Promise<MaterialVersion>;
  readResources?(ref: MaterialVersionRef): Promise<PortableResource[]>;
  onSelect(ref: MaterialVersionRef | undefined, persona?: NonNullable<MaterialVersion['projection']['persona']>): void;
  onPending?(pending: boolean): void;
  onManage(): void;
}

type FailedRead = { ref: MaterialVersionRef; apply: boolean; message: string };
const refKey = (ref: MaterialVersionRef | undefined) => ref ? JSON.stringify([ref.id, ref.version]) : '';

export function PersonaPicker(props: PersonaPickerProps): React.ReactElement {
  const { materials, value, onManage } = props;
  const [loaded, setLoaded] = useState<MaterialVersion>(), [target, setTarget] = useState<MaterialVersionRef>();
  const [pending, setPending] = useState(false), [failed, setFailed] = useState<FailedRead>();
  const [avatar, setAvatar] = useState<{ key: string; url: string }>();
  const latest = useRef(props), generation = useRef(0), mounted = useRef(true), cached = useRef<MaterialVersion>();
  const selectedKey = refKey(value), currentKey = useRef(selectedKey);
  latest.current = props; currentKey.current = selectedKey;
  const identified = refKey(loaded) === selectedKey ? loaded : undefined;
  const persona = identified?.projection.persona;
  const entries = materials.filter(material => material.kind === 'persona' && material.enabled);

  function reportPending(next: boolean) {
    setPending(next); if (!next) setTarget(undefined); latest.current.onPending?.(next);
  }
  function read(ref: MaterialVersionRef, apply: boolean) {
    const ticket = ++generation.current, expectedValue = currentKey.current;
    const active = () => mounted.current && ticket === generation.current && expectedValue === currentKey.current;
    setFailed(undefined); setTarget(apply ? ref : undefined); reportPending(true);
    void (async () => {
      try {
        const version = await latest.current.readVersion(ref);
        if (!active()) return;
        if (version.id !== ref.id || version.version !== ref.version || version.projection.kind !== 'persona' || !version.projection.persona) {
          throw new Error('这份人设版本不完整，请重新选择');
        }
        cached.current = version; setLoaded(version);
        if (apply) latest.current.onSelect(ref, version.projection.persona);
      } catch (error) {
        if (active()) setFailed({ ref, apply, message: error instanceof Error ? error.message : String(error) });
      } finally {
        if (active()) reportPending(false);
      }
    })();
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ++generation.current; latest.current.onPending?.(false); };
  }, []);
  useEffect(() => {
    ++generation.current; setFailed(undefined);
    if (!value) { cached.current = undefined; setLoaded(undefined); reportPending(false); }
    else if (refKey(cached.current) === selectedKey) reportPending(false);
    else read(value, false);
  }, [selectedKey]);

  useEffect(() => {
    let disposed = false; setAvatar(undefined);
    const reader = latest.current.readResources, path = persona?.avatarPath;
    if (reader && identified && path) {
      void (async () => {
        try {
          const resources = await reader({ id: identified.id, version: identified.version });
          const resource = resources.find(item => item.path === path && ['image/png', 'image/jpeg', 'image/webp'].includes(item.mediaType));
          if (!disposed && resource) setAvatar({ key: refKey(identified), url: `data:${resource.mediaType};base64,${resource.base64}` });
        } catch { /* A missing local avatar keeps the identity initial. */ }
      })();
    }
    return () => { disposed = true; };
  }, [identified]);

  function choose(key: string) {
    if (!key) {
      ++generation.current; setFailed(undefined); reportPending(false); latest.current.onSelect(undefined); return;
    }
    if (key === selectedKey) {
      ++generation.current; setFailed(undefined); reportPending(false);
      if (value && refKey(cached.current) !== selectedKey) read(value, false);
      return;
    }
    const material = entries.find(item => refKey({ id: item.id, version: item.currentVersion }) === key);
    const ref = material ? { id: material.id, version: material.currentVersion } : value;
    if (ref) read(ref, true);
  }
  const listed = entries.some(material => refKey({ id: material.id, version: material.currentVersion }) === selectedKey);
  return <div className="tk-persona-picker">
    <div className="tk-start-persona">
      <div className="tk-start-persona-avatar" aria-hidden={avatar?.key !== selectedKey || !avatar ? true : undefined}>
        {avatar?.key === selectedKey ? <img src={avatar.url} alt="我的人设头像" onError={() => setAvatar(undefined)} /> : <span>{persona?.name.slice(0, 1) || '我'}</span>}
      </div>
      <label className="tk-start-persona-choice">我的人设<select aria-label="我的人设" value={refKey(target) || selectedKey} onChange={event => choose(event.target.value)}>
        <option value="">手动填写</option>
        {value && !listed && <option value={selectedKey}>{persona?.name || '已选人设'} · 版本 {value.version}</option>}
        {entries.map(material => <option key={material.id} value={refKey({ id: material.id, version: material.currentVersion })}>{material.name} · 版本 {material.currentVersion}</option>)}
      </select></label>
      <button type="button" onClick={onManage}>管理我的人设</button>
    </div>
    {pending && <span role="status">正在读取人设…</span>}
    {failed && <div className="tk-start-read-error" role="alert"><span>{failed.message}</span><button type="button" onClick={() => read(failed.ref, failed.apply)}>重新读取人设</button></div>}
  </div>;
}
