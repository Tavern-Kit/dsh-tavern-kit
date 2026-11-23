import React, { useEffect, useRef, useState } from 'react';
import type { GardenController } from './garden.js';
import { StaticGarden } from './StaticGarden.js';
import type { Xi4uAppearance } from './types.js';
export type { Xi4uAppearance, Xi4uSeason, Xi4uScheme } from './types.js';
export interface Xi4uSceneProps extends Xi4uAppearance { className?: string }

type SceneState = { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };
const styles = `
.tk-xi4u-scene{position:relative;width:100%;height:100%;min-height:0;isolation:isolate;overflow:hidden;contain:layout paint;color:var(--tk-text,var(--dsw-alias-label-primary,#344236));background:var(--xi4u-background,transparent)}
.tk-xi4u-stage{position:absolute;inset:0;width:100%;height:100%;min-height:0;background:var(--xi4u-background,transparent)}
.tk-xi4u-stage>canvas{display:block;width:100%;height:100%;max-width:100%;outline:none;touch-action:none}
.tk-xi4u-stage>canvas:focus-visible{outline:2px solid var(--tk-focus,var(--tk-accent,#6c977b));outline-offset:-3px}
.tk-xi4u-still{display:block;position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.tk-xi4u-notice{box-sizing:border-box;position:absolute;z-index:1;left:8px;right:8px;bottom:6px;max-height:calc(100% - 12px);overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:minmax(0,1fr);gap:8px;align-items:center;padding:6px 8px;background:var(--tk-elevated,var(--dsw-alias-bg-layer-1,#fffef8));border:1px solid var(--tk-border,#d3ceba);border-radius:var(--tk-radius,10px);box-shadow:var(--tk-shadow,0 2px 8px #0001);font:13px/1.5 var(--tk-font-family,system-ui,sans-serif)}
.tk-xi4u-notice p{min-width:0;min-height:0;max-height:100%;overflow:auto;margin:0;overflow-wrap:anywhere;white-space:pre-wrap}
.tk-xi4u-notice button{flex:0 0 auto;min-height:40px;padding:6px 12px;border:1px solid var(--tk-border,#d3ceba);border-radius:8px;background:var(--tk-surface,#fffef8);color:inherit;font:inherit;cursor:pointer}
.tk-xi4u-notice button:focus-visible{outline:2px solid var(--tk-focus,var(--tk-accent,#6c977b));outline-offset:2px}
`;

export function Xi4uScene({ season, scheme, className }: Xi4uSceneProps): React.ReactElement {
  const host = useRef<HTMLDivElement>(null), controller = useRef<GardenController | null>(null);
  const appearance = useRef<Xi4uAppearance>({ season, scheme });
  appearance.current = { season, scheme };
  const [attempt, retry] = useState(0), [state, setState] = useState<SceneState>({ kind: 'loading' });
  useEffect(() => {
    let disposed = false;
    setState({ kind: 'loading' });
    const failed = (error: unknown) => {
      if (disposed) return;
      controller.current?.dispose(); controller.current = null;
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    };
    import('./garden.js').then(({ createGarden }) => {
      if (disposed || !host.current) return;
      const instance = createGarden(host.current, appearance.current, failed);
      if (disposed) { instance.dispose(); return; }
      controller.current = instance; setState({ kind: 'ready' });
    }).catch(failed);
    return () => { disposed = true; controller.current?.dispose(); controller.current = null; };
  }, [attempt]);
  useEffect(() => { controller.current?.update({ season, scheme }); }, [season, scheme]);
  return <div className={`tk-xi4u-scene${className ? ` ${className}` : ''}`} data-season={season} data-scheme={scheme} data-state={state.kind}>
    <style>{styles}</style>
    {state.kind !== 'ready' && <StaticGarden season={season} scheme={scheme} />}
    <div ref={host} className="tk-xi4u-stage" />
    {state.kind === 'loading' && <div className="tk-xi4u-notice" role="status"><p>正在铺开四季庭院…</p></div>}
    {state.kind === 'error' && <div className="tk-xi4u-notice"><p role="alert">庭院暂时停留为静态画面：{state.message}</p><button type="button" onClick={() => retry(value => value + 1)}>重试庭院</button></div>}
  </div>;
}
