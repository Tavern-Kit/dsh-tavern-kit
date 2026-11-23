import type { AppearancePreferences, ThemeDocument } from './types.js';
import { compileThemeDocument } from './theme.js';

export function appearanceTokens(preferences: AppearancePreferences, theme: ThemeDocument, scheme: 'light' | 'dark' = 'light'): Record<string, { light: string; dark: string }> {
  const compiled = compileThemeDocument(theme, scheme, preferences.season);
  const values = { ...compiled.tokens, '--tk-font-size': `${preferences.fontSize}px`, '--tk-reading-width': `${preferences.readingWidth}px` };
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { light: value, dark: value }]));
}

/** Theme material only. All functional selectors are confined to this plugin's panel. */
export const APPEARANCE_CSS = `
.tk-rp {
  color:var(--tk-text,#f4e9dc);background-color:var(--tk-custom-bg,#201b24);
  background-image:var(--tk-background-image,none);background-position:center bottom;
  background-repeat:no-repeat;background-size:var(--tk-background-size,100% auto);
  font-family:var(--tk-font-family,sans-serif);-webkit-font-smoothing:antialiased;
  accent-color:var(--tk-accent);color-scheme:light dark;
}
:root[data-tk-scheme="light"] .tk-rp{color-scheme:light}
:root[data-tk-scheme="dark"] .tk-rp{color-scheme:dark}
.tk-rp .tk-themed-scene{width:100%;height:100%;min-height:0;overflow:hidden;position:relative}
.tk-rp .tk-themed-scene>img{display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
.tk-appearance{
  --tk-a-canvas:var(--tk-page-canvas,var(--tk-canvas,var(--tk-bg,#f1eee5)));
  --tk-a-panel:var(--tk-page-panel,var(--tk-surface,#fffcf4));
  --tk-a-edge:var(--tk-page-edge,var(--tk-border,#d8cebc));
  --tk-a-accent:var(--tk-page-accent,var(--tk-accent,#586748));
  --tk-a-focus:var(--tk-page-focus,var(--tk-focus,#586748));
  --tk-a-radius:var(--tk-page-radius,var(--tk-radius,16px));
  --tk-a-inset:var(--tk-page-inset-shadow,inset 0 1px 0 #ffffff24);
  height:100%;min-height:0;min-width:0;overflow-y:auto;font-size:14px;line-height:1.6;
  color:var(--tk-text,#544633);background:var(--tk-a-canvas);scrollbar-width:thin;
}
.tk-appearance *,.tk-appearance *::before,.tk-appearance *::after{box-sizing:border-box}
.tk-appearance :is(h1,h2,h3,p){margin:0}
.tk-appearance :is(button,input){font:inherit;color:inherit}
.tk-appearance :is(button,input):focus-visible{outline:2px solid var(--tk-a-focus);outline-offset:3px}
.tk-appearance button{touch-action:manipulation;cursor:pointer}
.tk-appearance button:disabled{cursor:default;opacity:.5}
.tk-appearance button:not(:disabled):active{filter:brightness(.96)}
.tk-appearance .tk-settings{width:min(1200px,100%);margin-inline:auto;padding:clamp(18px,3vw,38px) clamp(14px,3vw,36px) max(32px,env(safe-area-inset-bottom));display:grid;gap:20px;min-width:0}
.tk-appearance .tk-settings-header{display:flex;align-items:center;justify-content:space-between;gap:18px;min-width:0;padding-bottom:20px;border-bottom:1px solid var(--tk-a-edge)}
.tk-appearance .tk-settings-identity{display:flex;align-items:center;gap:14px;min-width:0}
.tk-appearance .tk-settings-mark{display:grid;place-items:center;flex:none;width:46px;height:46px;border:1px solid var(--tk-a-edge);border-radius:var(--tk-a-radius);background:var(--tk-a-panel);color:var(--tk-a-accent);box-shadow:var(--tk-a-inset)}
.tk-appearance .tk-settings-identity h1{font:700 26px/1.3 var(--tk-title-font-family,var(--tk-font-family,inherit));letter-spacing:-.025em}
.tk-appearance .tk-settings-identity p{margin-top:4px;color:var(--tk-muted,#78694f);font-size:13px}
.tk-appearance .tk-settings-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;min-width:0}
.tk-appearance .tk-inline-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--tk-muted,#78694f);white-space:nowrap}
.tk-appearance .tk-save-indicator{width:5px;height:5px;flex:none;border-radius:50%;background:var(--tk-a-accent)}
.tk-appearance [aria-busy="true"] .tk-save-indicator{opacity:.4}
.tk-appearance .tk-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;max-width:100%;padding:7px 13px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 6px));background:var(--tk-a-panel);font-size:13px;line-height:1.45;white-space:nowrap;box-shadow:var(--tk-a-inset);transition:background-color 150ms,border-color 150ms}
.tk-appearance .tk-button-quiet{background:transparent;box-shadow:none;color:var(--tk-muted,#78694f)}
.tk-appearance .tk-template-section{padding:20px;border:1px solid var(--tk-a-edge);border-radius:var(--tk-a-radius);background:var(--tk-a-panel);box-shadow:var(--tk-a-inset);min-width:0}
.tk-appearance .tk-section-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:18px}
.tk-appearance .tk-section-identity{display:flex;align-items:center;gap:9px}
.tk-appearance .tk-section-heading h2{font-size:16px;font-weight:700}
.tk-appearance .tk-skin-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:start}
.tk-appearance .tk-skin-tile{position:relative;display:grid;gap:0;width:100%;padding:5px;min-width:0;overflow:hidden;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 4px));text-align:left;background:var(--tk-a-canvas);transition:border-color 150ms,background-color 150ms}
.tk-appearance .tk-skin-tile[aria-pressed="true"]{border-color:var(--tk-a-accent);background:color-mix(in srgb,var(--tk-a-accent) 7%,var(--tk-a-canvas));box-shadow:inset 0 0 0 1px var(--tk-a-accent)}
.tk-appearance .tk-theme-thumbnail{display:grid;grid-template-columns:16% minmax(0,1fr);grid-template-rows:minmax(0,1fr) 18%;aspect-ratio:1.65;min-width:0;border:1px solid currentColor;border-radius:max(0px,calc(var(--tk-a-radius) - 8px));overflow:hidden;color:#b99e75;background:#30261f}
.tk-appearance .tk-theme-thumbnail>img{display:block;width:100%;height:100%;min-height:0;object-fit:contain;padding:6px}
.tk-appearance .tk-thumbnail-rail{grid-row:1/3;display:grid;align-content:start;gap:6px;padding:9px 4px;border-right:1px solid currentColor;opacity:.5}
.tk-appearance .tk-thumbnail-rail>i{display:block;height:14px;border:1px solid currentColor;border-radius:2px}
.tk-appearance .tk-thumbnail-rail>i:first-child{background:currentColor;opacity:.45}
.tk-appearance .tk-thumbnail-caption{display:flex;align-items:center;gap:6px;padding:0 8px;border-top:1px solid currentColor}
.tk-appearance .tk-thumbnail-caption>i{width:32%;height:2px;background:currentColor;opacity:.4}
.tk-appearance .tk-thumbnail-caption>span{width:10px;height:7px;margin-left:auto;border:1px solid currentColor;border-radius:2px}
.tk-appearance .tk-theme-thumbnail-island{color:#8b9377;background:#f1eee2}
.tk-appearance .tk-theme-thumbnail-pixel{color:#91bfa3;background:#222d3e;border-radius:0;border-width:2px;image-rendering:pixelated}
.tk-appearance .tk-theme-thumbnail-pixel :is(i,.tk-thumbnail-caption>span){border-radius:0}
.tk-appearance .tk-theme-thumbnail-xi4u{color:#748573;background:#e8ebe2}
.tk-appearance .tk-skin-tile-footer{display:grid;gap:12px;padding:12px 9px 8px;min-width:0}
.tk-appearance .tk-skin-label{display:grid;gap:4px;min-width:0}
.tk-appearance .tk-skin-label strong{font-size:14px;font-weight:700}
.tk-appearance .tk-skin-label>span{font-size:12px;color:var(--tk-muted,#78694f);line-height:1.5}
.tk-appearance .tk-skin-label>small{font-size:10px;line-height:1.5;color:var(--tk-muted,#78694f);font-weight:400;overflow-wrap:anywhere}
.tk-appearance .tk-template-selection{display:flex;align-items:center;gap:6px;color:var(--tk-muted,#78694f);font-size:11px;min-width:0}
.tk-appearance [aria-pressed="true"]>.tk-skin-tile-footer .tk-template-selection{color:var(--tk-a-accent);font-weight:650}
.tk-appearance .tk-theme-check{display:grid;place-items:center;flex:none;width:20px;height:20px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 9px));color:transparent;background:var(--tk-a-panel)}
.tk-appearance .tk-theme-check>svg{width:13px;height:13px}
.tk-appearance [aria-pressed="true"] .tk-theme-check{background:var(--tk-a-accent);border-color:var(--tk-a-accent);color:var(--tk-accent-ink,#fffcf4)}
.tk-appearance .tk-theme-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:18px;padding-top:17px;border-top:1px solid var(--tk-a-edge)}
.tk-appearance .tk-theme-modes>div{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;min-width:0}
.tk-appearance .tk-theme-modes>div:only-child{grid-column:1/-1}
.tk-appearance .tk-theme-modes .tk-segmented{flex:1 1 230px;max-width:420px}
.tk-appearance .tk-setting-label{font-size:13px;font-weight:650}
.tk-appearance .tk-segmented{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3px;min-width:0;padding:3px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 6px));background:var(--tk-a-canvas)}
.tk-appearance .tk-segmented button{min-width:0;min-height:40px;padding:7px 9px;border:1px solid transparent;border-radius:max(0px,calc(var(--tk-a-radius) - 9px));background:transparent;color:var(--tk-muted,#78694f);font-size:13px;line-height:1.4;transition:background-color 150ms,color 150ms}
.tk-appearance .tk-segmented button[aria-pressed="true"]{background:var(--tk-a-panel);border-color:var(--tk-a-edge);color:var(--tk-text,#544633);box-shadow:var(--tk-a-inset);font-weight:650}
.tk-appearance .tk-season-controls.tk-segmented{grid-template-columns:repeat(4,minmax(0,1fr))}
.tk-appearance .tk-settings-body{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:start;gap:20px;min-width:0}
.tk-appearance .tk-controls{padding:20px;min-width:0;border:1px solid var(--tk-a-edge);border-radius:var(--tk-a-radius);background:var(--tk-a-panel);box-shadow:var(--tk-a-inset)}
.tk-appearance .tk-controls-title{display:flex;align-items:center;gap:8px;padding-bottom:16px;border-bottom:1px solid var(--tk-a-edge);font-size:16px;font-weight:700}
.tk-appearance .tk-controls-title>svg{color:var(--tk-a-accent)}
.tk-appearance .tk-range-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;padding:18px 0 16px;border-bottom:1px solid var(--tk-a-edge)}
.tk-appearance .tk-range-setting{min-width:0}
.tk-appearance .tk-range-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px}
.tk-appearance .tk-range-heading label{font-size:13px;font-weight:650}
.tk-appearance .tk-range-heading output{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:45px;min-height:27px;padding:2px 6px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 9px));background:var(--tk-a-canvas);font-size:12px;font-weight:650;font-variant-numeric:tabular-nums}
.tk-appearance .tk-range-setting>p{font-size:12px;color:var(--tk-muted,#78694f);line-height:1.6}
.tk-appearance .tk-range-setting input[type="range"]{display:block;width:100%;min-width:0;height:40px;margin:3px 0 0;appearance:none;background:transparent;cursor:pointer}
.tk-appearance input[type="range"]::-webkit-slider-runnable-track{height:3px;border-radius:var(--tk-a-radius);background:var(--tk-a-edge)}
.tk-appearance input[type="range"]::-moz-range-track{height:3px;border-radius:var(--tk-a-radius);background:var(--tk-a-edge)}
.tk-appearance input[type="range"]::-webkit-slider-thumb{width:16px;height:16px;margin-top:-6px;appearance:none;border:3px solid var(--tk-a-panel);border-radius:var(--tk-a-radius);background:var(--tk-a-accent);box-shadow:0 0 0 1px var(--tk-a-accent)}
.tk-appearance input[type="range"]::-moz-range-thumb{width:10px;height:10px;border:3px solid var(--tk-a-panel);border-radius:var(--tk-a-radius);background:var(--tk-a-accent);box-shadow:0 0 0 1px var(--tk-a-accent)}
.tk-appearance .tk-setting-row{display:flex;align-items:center;justify-content:space-between;gap:16px;min-width:0;padding:16px 0;border-bottom:1px solid var(--tk-a-edge)}
.tk-appearance .tk-setting-row>label{font-size:13px;font-weight:650}
.tk-appearance .tk-setting-row small{display:block;margin-top:4px;color:var(--tk-muted,#78694f);font-size:12px;font-weight:400;line-height:1.5}
.tk-appearance .tk-setting-value{display:flex;align-items:center;gap:8px;flex:none;font-size:12px;color:var(--tk-muted,#78694f)}
.tk-appearance .tk-switch{display:grid;place-items:center;width:44px;min-height:40px;padding:0;border:0;border-radius:max(0px,calc(var(--tk-a-radius) - 7px));background:transparent}
.tk-appearance .tk-switch>span{position:relative;width:36px;height:22px;border:1px solid var(--tk-a-edge);border-radius:var(--tk-a-radius);background:var(--tk-a-canvas);transition:background-color 150ms,border-color 150ms}
.tk-appearance .tk-switch>span::after{content:'';display:block;width:14px;height:14px;margin:3px;border-radius:max(0px,calc(var(--tk-a-radius) - 7px));background:var(--tk-muted,#78694f);transition:transform 150ms}
.tk-appearance .tk-switch[aria-checked="true"]>span{background:var(--tk-a-accent);border-color:var(--tk-a-accent)}
.tk-appearance .tk-switch[aria-checked="true"]>span::after{background:var(--tk-accent-ink,#fffcf4);transform:translateX(13px)}
.tk-appearance .tk-background-setting{padding-top:16px}
.tk-appearance .tk-background-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.tk-appearance .tk-custom-background{margin-top:8px}
.tk-appearance .tk-custom-background .tk-setting-row{border-bottom:0;padding-bottom:12px}
.tk-appearance .tk-color-value{display:flex;align-items:center;gap:10px;color:var(--tk-muted,#78694f);font-size:12px;font-variant-numeric:tabular-nums}
.tk-appearance input[type="color"]{width:44px;height:40px;padding:5px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 8px));background:var(--tk-a-canvas);cursor:pointer}
.tk-appearance .tk-image-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.tk-appearance .tk-file-control{position:relative;display:inline-flex;cursor:pointer}
.tk-appearance .tk-file-control input{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0}
.tk-appearance .tk-file-control:focus-within{outline:2px solid var(--tk-a-focus);outline-offset:3px}
.tk-appearance .tk-preferences-export{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap;padding-top:17px}
.tk-appearance .tk-preferences-export>span{font-size:10px;line-height:1.5;color:var(--tk-muted,#78694f);overflow-wrap:anywhere}
.tk-appearance .tk-preview-card{position:sticky;top:16px;isolation:isolate;min-width:0;padding:6px;border:1px solid var(--tk-a-edge);border-radius:var(--tk-a-radius);background:color-mix(in srgb,var(--tk-a-panel) 45%,var(--tk-a-canvas));box-shadow:var(--tk-a-inset)}
.tk-appearance .tk-preview-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px 15px;min-height:54px}
.tk-appearance .tk-preview-header h2{font-size:14px;font-weight:700}
.tk-appearance .tk-preview-header>div>span{display:block;margin-top:3px;color:var(--tk-muted,#78694f);font-size:11px}
.tk-appearance .tk-letter-mark{display:block;width:100px;height:48px;flex:none;color:var(--tk-a-accent);pointer-events:none}
.tk-appearance .tk-letter-mark>:is(img,svg){display:block;width:100%;height:100%;object-fit:contain;pointer-events:none}
.tk-appearance .tk-reading-preview{min-width:0;padding:20px 22px 8px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 5px));background:var(--tk-a-panel);line-height:1.9;box-shadow:var(--tk-a-inset)}
.tk-appearance .tk-sample-byline{display:flex;align-items:center;gap:8px;margin-bottom:13px;color:var(--tk-muted,#78694f);font-size:12px;font-weight:650}
.tk-appearance .tk-sample-avatar{display:grid;place-items:center;width:28px;height:30px;border:1px solid var(--tk-a-edge);border-radius:max(0px,calc(var(--tk-a-radius) - 8px));background:color-mix(in srgb,var(--tk-a-accent) 9%,var(--tk-a-panel));color:var(--tk-a-accent);font-size:12px;font-weight:650}
.tk-appearance .tk-reading-preview p{margin:0 0 16px;text-wrap:pretty;overflow-wrap:anywhere}
.tk-appearance .tk-preview-answer{display:block;width:fit-content;max-width:90%;margin:0 0 16px auto;padding:8px 12px;border-radius:max(0px,calc(var(--tk-a-radius) - 6px));background:var(--tk-user-bg,var(--tk-a-canvas));color:var(--tk-text,#544633);font-size:.86em}
.tk-appearance .tk-reading-preview[data-bubbles="off"] .tk-preview-answer{background:transparent;padding-inline:0;color:var(--tk-muted,#78694f)}
.tk-appearance .tk-preview-caption{display:flex;align-items:center;gap:7px;padding:12px 14px 8px;color:var(--tk-muted,#78694f);font-size:11px;line-height:1.5}
.tk-appearance .tk-preview-caption>svg{flex:none;color:var(--tk-a-accent)}
.tk-appearance .tk-theme-confirm{display:flex;align-items:center;gap:18px;padding:18px;border:1px solid var(--tk-a-accent);border-radius:var(--tk-a-radius);background:var(--tk-a-panel);box-shadow:var(--tk-a-inset)}
.tk-appearance .tk-theme-confirm>img{width:100px;height:76px;object-fit:contain;flex:none}
.tk-appearance .tk-theme-confirm h2{font-size:15px;margin-bottom:4px}
.tk-appearance .tk-theme-confirm p{font-size:12px;color:var(--tk-muted,#78694f);margin:6px 0 10px}
.tk-appearance .tk-error{padding:12px 14px;border:1px solid var(--tk-danger,#96443d);border-radius:max(0px,calc(var(--tk-a-radius) - 5px));background:var(--tk-a-panel);color:var(--tk-danger,#96443d);font-size:13px;overflow-wrap:anywhere}
.tk-appearance .tk-error-actions{display:flex;align-items:center;justify-content:space-between;gap:12px}
.tk-appearance .tk-loading{display:grid;gap:20px}
.tk-appearance .tk-loading-strip{height:216px;border:1px solid var(--tk-a-edge);border-radius:var(--tk-a-radius);background:var(--tk-a-panel)}
@media(hover:hover) and (pointer:fine){
.tk-appearance .tk-button:not(:disabled):hover{background:color-mix(in srgb,var(--tk-a-accent) 6%,var(--tk-a-panel));border-color:var(--tk-a-accent)}
.tk-appearance .tk-skin-tile:not(:disabled):hover{border-color:var(--tk-a-accent)}
.tk-appearance .tk-segmented button:not(:disabled):not([aria-pressed="true"]):hover{color:var(--tk-text,#544633);background:var(--tk-a-panel)}
}
@media(max-width:1000px){
.tk-appearance .tk-skin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.tk-appearance .tk-skin-tile{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);align-items:center;gap:4px}
.tk-appearance .tk-theme-thumbnail{aspect-ratio:1.25}
.tk-appearance .tk-skin-tile-footer{padding:10px 8px;gap:8px}
.tk-appearance .tk-theme-thumbnail>img{padding:4px}
.tk-appearance .tk-settings-body{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:16px}
.tk-appearance .tk-range-grid{grid-template-columns:minmax(0,1fr);gap:14px}
.tk-appearance .tk-range-heading{justify-content:start}
.tk-appearance .tk-range-heading output{margin-left:auto}
.tk-appearance .tk-reading-preview{padding-inline:17px}
}
@media(max-width:760px){
.tk-appearance .tk-settings-header{flex-wrap:wrap;gap:12px}
.tk-appearance .tk-settings-header>.tk-settings-actions{margin-left:auto}
.tk-appearance .tk-settings-body{grid-template-columns:minmax(0,1fr)}
.tk-appearance .tk-range-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}
.tk-appearance .tk-preview-card{position:relative;top:auto}
.tk-appearance .tk-theme-modes{grid-template-columns:minmax(0,1fr);gap:14px}
}
@media(max-width:600px){
.tk-appearance .tk-settings{padding:20px 12px max(26px,env(safe-area-inset-bottom));gap:16px}
.tk-appearance .tk-settings-header{padding-bottom:16px}
.tk-appearance .tk-settings-identity{gap:10px}
.tk-appearance .tk-settings-mark{width:38px;height:40px}
.tk-appearance .tk-settings-identity h1{font-size:22px}
.tk-appearance .tk-settings-identity p{font-size:12px}
.tk-appearance .tk-settings-header>.tk-settings-actions{width:100%;justify-content:flex-end;gap:8px}
.tk-appearance .tk-settings-header .tk-inline-status{margin-right:auto}
.tk-appearance .tk-template-section{padding:15px}
.tk-appearance .tk-section-heading{gap:12px;margin-bottom:15px}
.tk-appearance .tk-theme-file-actions{margin-left:auto;gap:6px}
.tk-appearance .tk-theme-file-actions .tk-button{padding-inline:10px;font-size:12px}
.tk-appearance .tk-skin-grid{grid-template-columns:minmax(0,1fr);gap:9px}
.tk-appearance .tk-skin-tile{grid-template-columns:minmax(0,.9fr) minmax(0,1fr);gap:7px}
.tk-appearance .tk-theme-thumbnail{aspect-ratio:1.5}
.tk-appearance .tk-skin-tile-footer{gap:9px;padding:9px 6px}
.tk-appearance .tk-skin-label>small{font-size:10px}
.tk-appearance .tk-controls{padding:16px}
.tk-appearance .tk-range-grid{gap:16px}
.tk-appearance .tk-range-heading{flex-wrap:wrap;gap:5px}
.tk-appearance .tk-range-heading label{font-size:13px}
.tk-appearance .tk-range-heading output{margin-left:0;min-width:41px}
.tk-appearance .tk-setting-row{gap:12px}
.tk-appearance .tk-segmented button{font-size:12px;padding-inline:6px}
.tk-appearance .tk-theme-modes .tk-segmented{flex-basis:100%;max-width:none}
.tk-appearance .tk-preview-header{padding-inline:12px}
.tk-appearance .tk-reading-preview{padding:19px 18px 6px}
.tk-appearance .tk-preview-caption{padding-inline:12px}
.tk-appearance input:not([type="range"]):not([type="checkbox"]){font-size:16px}
.tk-appearance .tk-theme-confirm{align-items:flex-start;gap:12px;padding:14px}
.tk-appearance .tk-theme-confirm>img{width:64px;height:64px}
}
@media(max-width:380px){
.tk-appearance .tk-settings{padding-inline:10px}
.tk-appearance .tk-settings-mark{display:none}
.tk-appearance .tk-theme-file-actions{width:100%;margin-left:0}
.tk-appearance .tk-theme-file-actions .tk-button{flex:1}
.tk-appearance .tk-range-grid{grid-template-columns:minmax(0,1fr);gap:12px}
.tk-appearance .tk-skin-tile{grid-template-columns:minmax(0,.75fr) minmax(0,1fr)}
}
@media(prefers-reduced-motion:reduce){
.tk-appearance *,.tk-appearance *::before,.tk-appearance *::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
`;
