import React, { useId } from 'react';
import { KUBAI_PATHS } from './assets/kubai-icons/paths.js';

export type DetailIcon = 'search' | 'memo' | 'settings' | 'courtyard';

/** Layers from MIT-licensed Kubai Icons. CSS drives the pose from the surrounding control. */
export function DetailArtwork({ kind }: { kind: DetailIcon }): React.ReactElement {
  const id = useId();
  const cut = `url(#${id})`;
  if (kind === 'search') {
    const [handle, lens, gleam] = KUBAI_PATHS.Search;
    return <svg className="tk-icon-duotone" viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" focusable="false">
      <defs><mask id={id}><rect width="16" height="16" fill="white" /><path d={lens} fill="black" stroke="black" strokeWidth="2" /></mask></defs>
      <path d={handle} mask={cut} fill="currentColor" />
      <path d={lens} className="tk-icon-body" />
      <path d={gleam} className="tk-icon-glint" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>;
  }
  if (kind === 'settings') {
    const [rails, upper, lower] = KUBAI_PATHS.Sliders;
    return <svg className="tk-icon-duotone" viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" focusable="false">
      <defs><mask id={id}>
        <rect width="16" height="16" fill="white" />
        <path d={upper} className="tk-icon-slider-up" fill="black" stroke="black" strokeWidth="2" />
        <path d={lower} className="tk-icon-slider-down" fill="black" stroke="black" strokeWidth="2" />
      </mask></defs>
      <path d={rails} mask={cut} fill="currentColor" />
      <path d={upper} className="tk-icon-body tk-icon-slider-up" />
      <path d={lower} className="tk-icon-body tk-icon-slider-down" />
    </svg>;
  }
  if (kind === 'courtyard') {
    return <svg className="tk-icon-duotone" viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" focusable="false">
      <path d="M2 13V7a6 6 0 0 1 12 0v6Z" className="tk-icon-body" />
      <path d="M2 13V7a6 6 0 0 1 6-6v12Z" className="tk-icon-shutter" />
      <path d="M8 2v11M2 8h12M1.5 14h13" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>;
  }
  const [cover, ink, rings] = KUBAI_PATHS.Notebook;
  const [left, right, leftInk, rightInk] = KUBAI_PATHS.Book;
  return <svg className="tk-icon-duotone" viewBox="0 0 16 16" width="24" height="24" aria-hidden="true" focusable="false">
    <g className="tk-icon-notebook">
      <defs><mask id={id}><rect width="16" height="16" fill="white" /><path d={rings} fill="black" stroke="black" strokeWidth="2" /></mask></defs>
      <path d={cover} className="tk-icon-body" mask={cut} />
      <path d={ink} className="tk-icon-ink" fill="currentColor" />
      <path d={rings} fill="currentColor" />
    </g>
    <g className="tk-icon-folio">
      <path d={left} className="tk-icon-body" /><path d={right} className="tk-icon-body" />
      <path d={leftInk} fill="currentColor" /><path d={rightInk} fill="currentColor" />
      <g className="tk-icon-page"><path d={right} className="tk-icon-body" /><path d={rightInk} fill="currentColor" /></g>
    </g>
  </svg>;
}

export const DETAIL_ICON_STYLES = `
.tk-rp .tk-theme-icon>.tk-icon-duotone,.tk-rp .tk-icon-folio{display:none}
:root:is([data-tk-skin=classic],[data-tk-skin=island],[data-tk-skin=xi4u]) .tk-rp [data-tk-icon-trigger] .tk-theme-icon:has(>.tk-icon-duotone)>.tk-icon-vector{display:none}
:root:is([data-tk-skin=classic],[data-tk-skin=island],[data-tk-skin=xi4u]) .tk-rp [data-tk-icon-trigger] .tk-theme-icon>.tk-icon-duotone{display:inline}
:root[data-tk-skin=classic] .tk-rp .tk-icon-notebook{display:none}
:root[data-tk-skin=classic] .tk-rp .tk-icon-folio{display:inline}
.tk-rp .tk-icon-body{fill:color-mix(in srgb,currentColor 48%,var(--tk-page-panel,var(--tk-ui-surface,#fff)))}
.tk-rp .tk-icon-shutter{fill:currentColor;opacity:.6;transform-box:view-box;transform-origin:2px 8px}
.tk-rp .tk-icon-ink{transform-box:fill-box;transform-origin:left center}
.tk-rp .tk-icon-page{transform-box:view-box;transform-origin:8.5px 8px;opacity:0}
.tk-rp .tk-icon-glint{opacity:.7}
.tk-rp .tk-icon-pixel-flash{opacity:0;fill:currentColor}
@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
  .tk-rp [data-tk-icon-trigger] :is(.tk-icon-page,.tk-icon-shutter,.tk-icon-ink,.tk-icon-slider-up,.tk-icon-slider-down,.tk-icon-glint){transition:transform var(--tk-icon-time,160ms) var(--tk-ease-out,cubic-bezier(.23,1,.32,1)),opacity var(--tk-icon-time,160ms) var(--tk-ease-out,cubic-bezier(.23,1,.32,1))}
  .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-glint{transform:translate(1px,1px);opacity:1}
  .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-slider-up{transform:translateX(-2px)}
  .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-slider-down{transform:translateX(2px)}
  .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-page{transform:scaleX(-.88);opacity:1}
  .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-ink{transform:scaleX(.48)}
  .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-shutter{transform:scaleX(.4)}
  :root[data-tk-skin=xi4u] .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-glint{transform:translateX(-1px);opacity:1}
  :root[data-tk-skin=pixel] .tk-rp [data-tk-icon-trigger] .tk-icon-pixel-flash{transition:opacity 100ms steps(2,end)}
  :root[data-tk-skin=pixel] .tk-rp [data-tk-icon-trigger]:hover:not(:disabled) .tk-icon-pixel-flash{opacity:1}
}
`;
