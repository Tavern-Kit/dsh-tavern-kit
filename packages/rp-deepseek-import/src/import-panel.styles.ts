export const IMPORT_STYLES = `
.tk-rp.tk-import{
  --imp-ink:var(--tk-text,var(--dsw-alias-label-primary,#493d2e));
  --imp-muted:var(--tk-muted,var(--dsw-alias-label-secondary,#7b705e));
  --imp-canvas:var(--tk-page-canvas,var(--tk-bg,var(--dsw-alias-bg-base,#f3efe6)));
  --imp-panel:var(--tk-page-panel,var(--tk-surface,var(--dsw-alias-bg-layer-1,#fffcf4)));
  --imp-soft:var(--tk-surface-soft,var(--dsw-alias-card-fill,#eeeadf));
  --imp-edge:var(--tk-page-edge,var(--tk-border,var(--dsw-alias-border-l3,#d8cfbb)));
  --imp-accent:var(--tk-page-accent,var(--tk-accent,#665f43));
  --imp-accent-ink:var(--tk-accent-ink,var(--dsw-alias-bg-base,#fffdf5));
  --imp-focus:var(--tk-page-focus,var(--tk-focus,var(--imp-accent)));
  --imp-radius:var(--tk-page-radius,var(--tk-radius,16px));
  --imp-inset:var(--tk-page-inset-shadow,inset 0 1px 0 color-mix(in srgb,var(--imp-panel) 80%,transparent));
  --imp-danger:var(--tk-danger,var(--dsw-alias-state-error-primary,#a7463b));
  height:100%;min-height:0;overflow:auto;padding:clamp(16px,2.5vw,32px);box-sizing:border-box;background:var(--imp-canvas);color:var(--imp-ink);font-family:var(--tk-font-family,system-ui,sans-serif);font-size:14px;font-weight:400;line-height:1.6;isolation:isolate;
}
.tk-import *{box-sizing:border-box}
.tk-import :is(h1,h2,h3,p,ol){margin:0}
.tk-import button,.tk-import input{font:inherit;color:inherit}
.tk-import button{cursor:pointer;min-height:40px;padding:7px 12px;border:1px solid var(--imp-edge);border-radius:calc(var(--imp-radius)*.5);background:var(--imp-panel);white-space:nowrap;box-shadow:var(--imp-inset);transition:background 160ms,border-color 160ms,color 160ms}
.tk-import button:disabled{cursor:default;opacity:.5}
.tk-import :is(button,input):focus-visible{outline:2px solid var(--imp-focus);outline-offset:3px}
.tk-import .imp-primary{border-color:transparent;background:var(--imp-accent);color:var(--imp-accent-ink);font-weight:700;box-shadow:var(--tk-shadow,none)}
.tk-import .imp-wrap{max-width:1060px;margin:auto;min-width:0}
.tk-import .imp-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.tk-import .imp-heading-copy{display:flex;align-items:center;gap:12px;min-width:0}
.tk-import .imp-heading-mark{width:52px;height:54px;padding:4px;color:var(--imp-accent);flex:none}
.tk-import h1{font:700 26px/1.25 var(--tk-title-font-family,var(--tk-font-family,system-ui,sans-serif));letter-spacing:-.025em}
.tk-import h2{font:700 22px/1.4 var(--tk-title-font-family,var(--tk-font-family,system-ui,sans-serif));text-wrap:pretty}
.tk-import h3{font-size:16px;line-height:1.5;overflow-wrap:anywhere}
.tk-import .imp-file-input{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden;opacity:0}
.tk-import .imp-steps{display:flex;align-items:center;list-style:none;gap:0;padding:0 0 18px;border-bottom:1px solid var(--imp-edge);margin-bottom:20px}
.tk-import .imp-step{display:flex;align-items:center;gap:8px;flex:1;min-width:0;color:var(--imp-muted);font-size:13px}
.tk-import .imp-step:not(:last-child)::after{content:'';height:1px;flex:1;margin-inline:10px;background:var(--imp-edge)}
.tk-import .imp-step-number{display:grid;place-items:center;width:27px;height:27px;flex:none;border:1px solid var(--imp-edge);border-radius:calc(var(--imp-radius)*.3);font-size:12px;font-variant-numeric:tabular-nums;background:var(--imp-panel)}
.tk-import .imp-step[aria-current=step]{color:var(--imp-ink);font-weight:700}
.tk-import .imp-step[aria-current=step] .imp-step-number{background:var(--imp-accent);color:var(--imp-accent-ink);border-color:transparent}
.tk-import .imp-intro{position:relative;display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,.8fr);gap:28px;align-items:center;background:var(--imp-panel);border:1px solid var(--imp-edge);border-radius:var(--imp-radius);padding:28px;box-shadow:var(--imp-inset)}
.tk-import .imp-intro-copy{min-width:0}
.tk-import .imp-intro-copy>p{color:var(--imp-muted);max-width:42ch;margin-top:10px;line-height:1.8;font-size:14px}
.tk-import .imp-letter{width:104px;height:76px;display:block;margin-bottom:18px;color:var(--imp-accent)}
.tk-import .imp-source-list{display:grid;gap:0;padding-left:22px;border-left:1px solid var(--imp-edge)}
.tk-import .imp-source{display:grid;grid-template-columns:48px minmax(0,1fr);gap:12px;align-items:center;padding-block:16px}
.tk-import .imp-source+.imp-source{border-top:1px solid var(--imp-edge)}
.tk-import .imp-format{display:grid;place-items:center;width:46px;height:55px;border:1px solid var(--imp-edge);border-left:3px solid var(--imp-accent);border-radius:1px calc(var(--imp-radius)*.25) calc(var(--imp-radius)*.25) 1px;color:var(--imp-accent);font-size:12px;font-weight:700;background:var(--imp-soft)}
.tk-import .imp-source strong{display:block;font-size:14px;font-weight:700}
.tk-import .imp-source p{font-size:12px;color:var(--imp-muted);margin-top:3px}
.tk-import .imp-footnote{display:flex;align-items:center;gap:8px;margin-top:16px;font-size:12px;color:var(--imp-muted);flex-wrap:wrap}
.tk-import .imp-footnote span+span::before{content:'·';margin-right:8px;color:var(--imp-edge)}
.tk-import .imp-error{padding:12px 14px;border:1px solid var(--imp-danger);border-radius:calc(var(--imp-radius)*.5);color:var(--imp-danger);background:var(--imp-panel);overflow-wrap:anywhere;margin-block:14px;font-size:13px}
.tk-import .imp-file-summary{display:flex;align-items:center;gap:12px;padding:14px 16px;border:1px solid var(--imp-edge);border-radius:var(--imp-radius);background:var(--imp-panel);box-shadow:var(--imp-inset);min-width:0}
.tk-import .imp-file-icon{color:var(--imp-accent);width:32px;height:36px;flex:none}
.tk-import .imp-file-name{display:grid;gap:3px;min-width:0;flex:1}
.tk-import .imp-file-name strong{font-size:14px;overflow-wrap:anywhere;font-weight:600}
.tk-import .imp-file-name>span{font-size:12px;color:var(--imp-muted)}
.tk-import .imp-selection-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:16px 0 12px}
.tk-import .imp-selection-copy{display:flex;align-items:baseline;gap:8px;font-size:14px}
.tk-import .imp-selection-copy span{font-size:12px;color:var(--imp-muted)}
.tk-import .imp-actions{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.tk-import .imp-actions button:not(.imp-primary){border-color:transparent;background:transparent;box-shadow:none;font-size:13px}
.tk-import .imp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px;align-items:start}
.tk-import .imp-conversation{position:relative;min-width:0;padding:16px;border:1px solid var(--imp-edge);border-radius:calc(var(--imp-radius)*.7);background:var(--imp-panel);box-shadow:var(--imp-inset)}
.tk-import .imp-conversation[data-selected=true]{border-color:var(--imp-accent)}
.tk-import .imp-conversation[data-selected=true]::before{content:'';position:absolute;top:16px;bottom:16px;left:-1px;width:2px;background:var(--imp-accent)}
.tk-import .imp-conversation-head{display:flex;align-items:flex-start;gap:10px}
.tk-import .imp-select{display:flex;align-items:center;justify-content:center;flex:none;width:32px;min-height:40px;margin-top:-5px;margin-left:-6px;cursor:pointer}
.tk-import .imp-select:has(:disabled){cursor:default;opacity:.5}
.tk-import .imp-select input{accent-color:var(--imp-accent);width:17px;height:17px;cursor:inherit}
.tk-import .imp-title-group{flex:1;min-width:0}
.tk-import .imp-card-kind{font-size:12px;color:var(--imp-muted);margin-bottom:4px;display:block}
.tk-import .imp-card-state{font-size:12px;color:var(--imp-muted);white-space:nowrap;flex:none;padding:2px 0}
.tk-import .imp-conversation[data-selected=true] .imp-card-state{color:var(--imp-accent)}
.tk-import .imp-people{font-size:13px;color:var(--imp-muted);margin-top:7px;overflow-wrap:anywhere}
.tk-import .imp-card-meta{display:flex;align-items:center;gap:8px;color:var(--imp-muted);font-size:12px;margin-top:10px;flex-wrap:wrap}
.tk-import .imp-source-stats{display:flex;gap:4px 12px;color:var(--imp-muted);font-size:12px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--imp-edge) 65%,transparent);font-variant-numeric:tabular-nums}
.tk-import .imp-archive-note{color:var(--imp-muted);font-size:12px;line-height:1.7;margin-top:8px;overflow-wrap:anywhere}
.tk-import .imp-change-note{font-size:12px;color:var(--imp-accent);margin-top:8px}
.tk-import .imp-existing{margin-top:12px;box-shadow:none;font-size:13px}
.tk-import .imp-results{padding-top:24px;margin-top:24px;border-top:1px solid var(--imp-edge)}
.tk-import .imp-result-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.tk-import .imp-result-mark{display:grid;place-items:center;flex:none;width:40px;height:40px;color:var(--imp-accent);background:var(--imp-soft);border:1px solid var(--imp-edge);border-radius:calc(var(--imp-radius)*.5)}
.tk-import .imp-result-mark svg{width:22px;height:22px}
.tk-import .imp-result-heading strong{font-size:18px;line-height:1.4}
.tk-import .imp-result-heading p{color:var(--imp-muted);font-size:12px;margin-top:3px}
.tk-import .imp-result-item{display:grid;gap:12px}
.tk-import .imp-result-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.tk-import .imp-result-top button{flex:none}
.tk-import .imp-result-item .imp-source-stats{margin:0}
:root[data-tk-skin=pixel] .tk-import .imp-step-number,:root[data-tk-skin=pixel] .tk-import .imp-format{border-radius:0}
@media(hover:hover){.tk-import button:not(:disabled):hover{background:var(--imp-soft)}.tk-import .imp-primary:not(:disabled):hover{background:var(--imp-accent);filter:brightness(1.04)}}
@media(max-width:680px){
  .tk-rp.tk-import{padding:16px 12px max(20px,env(safe-area-inset-bottom))}
  .tk-import .imp-heading{gap:12px;margin-bottom:16px}
  .tk-import .imp-heading-copy{gap:10px}
  .tk-import .imp-heading-mark{width:42px;height:46px}
  .tk-import h1{font-size:24px}
  .tk-import .imp-heading>button{margin-left:auto;font-size:13px}
  .tk-import .imp-steps{padding-bottom:16px;margin-bottom:16px}
  .tk-import .imp-step{font-size:12px;gap:6px}
  .tk-import .imp-step-number{width:24px;height:24px}
  .tk-import .imp-step:not(:last-child)::after{margin-inline:7px}
  .tk-import .imp-intro{grid-template-columns:minmax(0,1fr);gap:20px;padding:20px}
  .tk-import .imp-letter{width:88px;height:64px;margin-bottom:12px}
  .tk-import h2{font-size:20px}
  .tk-import .imp-intro-copy>p{font-size:13px;margin-top:8px}
  .tk-import .imp-source-list{border-left:0;border-top:1px solid var(--imp-edge);padding:0}
  .tk-import .imp-source{padding-block:12px}
  .tk-import .imp-source:last-child{padding-bottom:0}
  .tk-import .imp-selection-bar{align-items:flex-start;gap:8px}
  .tk-import .imp-actions{width:100%;justify-content:flex-end;gap:2px}
  .tk-import .imp-actions button{font-size:12px;padding-inline:9px}
  .tk-import .imp-actions .imp-primary{margin-left:auto}
  .tk-import .imp-grid{grid-template-columns:minmax(0,1fr)}
  .tk-import .imp-conversation{padding:14px}
  .tk-import .imp-conversation-head{gap:8px}
  .tk-import .imp-card-state{white-space:normal;text-align:right;max-width:5em;line-height:1.6}
  .tk-import .imp-results{padding-top:20px;margin-top:20px}
  .tk-import .imp-result-top{gap:10px}
  .tk-import .imp-result-top>div{flex:1 1 140px;min-width:0}
}
@media(max-width:360px){.tk-import .imp-step{gap:5px}.tk-import .imp-step:not(:last-child)::after{margin-inline:4px}.tk-import .imp-step-number{width:22px;height:22px}.tk-import .imp-actions button{padding-inline:7px}}
@media(prefers-reduced-motion:reduce){.tk-import *{transition:none!important;scroll-behavior:auto!important}}
`;
