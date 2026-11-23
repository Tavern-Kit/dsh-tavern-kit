export const MATERIALS_STYLES = `
.tk-rp.tk-materials{
  --mat-ink:var(--tk-text,var(--dsw-alias-label-primary,#493d2e));
  --mat-muted:var(--tk-muted,var(--dsw-alias-label-secondary,#7b705e));
  --mat-canvas:var(--tk-page-canvas,var(--tk-bg,var(--dsw-alias-bg-base,#f3efe6)));
  --mat-paper:var(--tk-page-panel,var(--tk-surface,var(--dsw-alias-bg-layer-1,#fffcf4)));
  --mat-soft:var(--tk-surface-soft,var(--dsw-alias-card-fill,#eeeadf));
  --mat-line:var(--tk-page-edge,var(--tk-border,var(--dsw-alias-border-l3,#d8cfbb)));
  --mat-accent:var(--tk-page-accent,var(--tk-accent,#665f43));
  --mat-accent-ink:var(--tk-accent-ink,var(--dsw-alias-bg-base,#fffdf5));
  --mat-focus:var(--tk-page-focus,var(--tk-focus,var(--mat-accent)));
  --mat-radius:var(--tk-page-radius,var(--tk-radius,16px));
  --mat-inset:var(--tk-page-inset-shadow,inset 0 1px 0 color-mix(in srgb,var(--mat-paper) 80%,transparent));
  --mat-danger:var(--tk-danger,var(--dsw-alias-state-error-primary,#a7463b));
  color:var(--mat-ink);background:var(--mat-canvas);font-family:var(--tk-font-family,system-ui,sans-serif);font-size:14px;font-weight:400;line-height:1.55;
  padding:clamp(16px,2.5vw,32px);height:100%;min-height:0;overflow:auto;box-sizing:border-box;isolation:isolate;
}
.tk-materials *{box-sizing:border-box}
.tk-materials :is(h1,h2,h3,h4,p,figure){margin:0}
.tk-materials :is(button,input,select,textarea){font:inherit;color:inherit}
.tk-materials button{cursor:pointer;min-height:40px;padding:7px 12px;border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.5);background:var(--mat-paper);white-space:nowrap;box-shadow:var(--mat-inset);transition:background 160ms,color 160ms,border-color 160ms}
.tk-materials button:disabled{cursor:default;opacity:.5}
.tk-materials :is(button,input,select,textarea,summary):focus-visible{outline:2px solid var(--mat-focus);outline-offset:3px}
.tk-materials :is(input:not([type=checkbox]),select,textarea){min-width:0;min-height:40px;border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.45);background:var(--mat-paper);padding:8px 11px;box-shadow:var(--mat-inset)}
.tk-materials input::placeholder{color:var(--mat-muted)}
.tk-materials .mat-primary{background:var(--mat-accent);color:var(--mat-accent-ink);border-color:transparent;box-shadow:var(--tk-shadow,none);font-weight:700}
.tk-materials .mat-danger{color:var(--mat-danger)}
.tk-materials .mat-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip-path:inset(50%)}
.tk-materials .mat-heading,.tk-materials .mat-heading-copy,.tk-materials .mat-actions,.tk-materials .mat-section-head,.tk-materials .mat-card-foot,.tk-materials .mat-save-row,.tk-materials .mat-maintenance{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tk-materials .mat-heading{justify-content:space-between;gap:16px;margin:0 auto 20px;max-width:1260px}
.tk-materials .mat-heading-copy{flex-wrap:nowrap;min-width:0;gap:12px}
.tk-materials .mat-mark{width:52px;height:54px;flex:none;color:var(--mat-accent);padding:5px;border-bottom:1px solid var(--mat-line)}
.tk-materials h1{font:700 26px/1.25 var(--tk-title-font-family,var(--tk-font-family,system-ui,sans-serif));letter-spacing:-.025em}
.tk-materials .mat-heading p{color:var(--mat-muted);margin-top:5px;font-size:12px}
.tk-materials .mat-heading>.mat-actions button:not(.mat-primary){background:transparent;box-shadow:none;border-color:transparent}
.tk-materials .mat-collection{max-width:1260px;margin:auto}
.tk-materials .mat-collection-tools{padding:14px 16px 0;background:var(--mat-paper);border:1px solid var(--mat-line);border-radius:var(--mat-radius);box-shadow:var(--mat-inset)}
.tk-materials .mat-toolbar{display:grid;grid-template-columns:minmax(180px,1fr) minmax(120px,164px) minmax(120px,148px);gap:12px;align-items:end}
.tk-materials .mat-search{display:flex;align-items:center;gap:9px;min-width:0}
.tk-materials .mat-search input{width:100%;background:var(--mat-soft);border-color:transparent}
.tk-materials .mat-filter{display:grid;gap:4px;color:var(--mat-muted);font-size:12px;font-weight:500}
.tk-materials .mat-filter select{color:var(--mat-ink);width:100%}
.tk-materials .mat-kinds{display:flex;gap:4px;overflow:auto;padding:10px 0 0;scrollbar-width:thin;scroll-padding-inline:4px}
.tk-materials .mat-kinds button{position:relative;display:flex;align-items:center;gap:7px;min-height:42px;border:0;border-radius:0;background:transparent;padding:8px 10px 11px;box-shadow:none;font-size:13px;color:var(--mat-muted)}
.tk-materials .mat-kinds button[aria-pressed=true]{color:var(--mat-ink);font-weight:700}
.tk-materials .mat-kinds button[aria-pressed=true]::after{content:'';position:absolute;inset:auto 9px 0;height:2px;background:var(--mat-accent)}
.tk-materials .mat-kinds span{font-size:12px;color:var(--mat-muted);font-variant-numeric:tabular-nums}
.tk-materials .mat-shelf-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:20px 0 12px}
.tk-materials .mat-shelf-head h2{font-size:15px;letter-spacing:.025em}
.tk-materials .mat-shelf-head>span{color:var(--mat-muted);font-size:12px}
.tk-materials .mat-feedback{font-size:12px;color:var(--mat-muted);display:flex;gap:10px}
.tk-materials .mat-feedback:not(:empty){padding-top:10px}
.tk-materials .mat-error{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--mat-danger);border-radius:calc(var(--mat-radius)*.5);color:var(--mat-danger);padding:10px 12px;margin-block:10px;overflow-wrap:anywhere}
.tk-materials .mat-error button{flex:none}
.tk-materials .mat-notice{color:var(--mat-accent);font-size:13px}
.tk-materials .mat-location{max-width:1260px;margin:0 auto 12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 12px;background:var(--mat-paper);border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.5);font-size:12px}
.tk-materials .mat-location span{color:var(--mat-muted)}
.tk-materials .mat-location code{overflow-wrap:anywhere}
.tk-materials .mat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:14px;align-items:start}
.tk-materials .mat-card{position:relative;border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.7);padding:16px;background:var(--mat-paper);min-width:0;box-shadow:var(--mat-inset)}
.tk-materials .mat-card::before{content:'';position:absolute;inset:12px auto 12px 0;width:2px;background:color-mix(in srgb,var(--mat-accent) 35%,transparent)}
.tk-materials .mat-card[data-enabled=false]::before{background:var(--mat-line)}
.tk-materials .mat-card-open{display:flex;align-items:center;gap:14px;width:100%;min-height:76px;padding:0;white-space:normal;text-align:left;border:0;background:transparent;box-shadow:none}
.tk-materials .mat-book{position:relative;width:54px;height:72px;display:inline-flex;align-items:center;justify-content:center;flex:none;border:1px solid color-mix(in srgb,var(--mat-accent) 55%,var(--mat-line));border-left-width:4px;border-radius:2px calc(var(--mat-radius)*.25) calc(var(--mat-radius)*.25) 2px;color:var(--mat-accent);background:var(--mat-soft);font:600 25px/1.2 var(--tk-title-font-family,serif);box-shadow:inset 3px 0 0 color-mix(in srgb,var(--mat-paper) 65%,transparent),2px 3px 0 color-mix(in srgb,var(--mat-line) 40%,transparent)}
.tk-materials .mat-book::before,.tk-materials .mat-book::after{content:'';position:absolute;left:9px;right:6px;border-top:1px solid color-mix(in srgb,var(--mat-accent) 32%,transparent)}
.tk-materials .mat-book::before{top:9px}.tk-materials .mat-book::after{bottom:9px}
.tk-materials .mat-card[data-kind=persona] .mat-book{border-left-width:1px;border-bottom-width:4px;transform:rotate(-3deg)}
.tk-materials .mat-card[data-kind=worldbook] .mat-book{background:color-mix(in srgb,var(--mat-accent) 12%,var(--mat-paper))}
.tk-materials .mat-card[data-kind=regex] .mat-book{background:var(--mat-paper);border-style:dashed}
.tk-materials .mat-card-title{display:grid;gap:4px;min-width:0}
.tk-materials .mat-card-title strong{overflow-wrap:anywhere;font-size:17px;line-height:1.45;font-weight:700}
.tk-materials .mat-card-title>span{font-size:12px;color:var(--mat-muted)}
.tk-materials .mat-dot{padding-inline:6px}
.tk-materials .mat-card-foot{margin-top:14px;padding-top:10px;border-top:1px solid color-mix(in srgb,var(--mat-line) 65%,transparent);justify-content:space-between;align-items:center;gap:6px}
.tk-materials .mat-card-tags{display:flex;flex-wrap:wrap;gap:3px 8px;flex:1;min-width:0}
.tk-materials .mat-card-tags span{font-size:12px;color:var(--mat-muted);overflow-wrap:anywhere}
.tk-materials .mat-card-tags span+span::before{content:'#';color:var(--mat-line);margin-right:2px}
.tk-materials .mat-toggle{display:flex;align-items:center;gap:6px;padding:5px 2px;min-height:40px;border:0;background:transparent;box-shadow:none;font-size:12px;color:var(--mat-muted)}
.tk-materials .mat-toggle>span{width:25px;height:15px;border:1px solid var(--mat-line);border-radius:20px;background:var(--mat-soft);padding:2px;display:block}
.tk-materials .mat-toggle>span::after{content:'';width:9px;height:9px;border-radius:50%;display:block;background:var(--mat-muted);transition:transform 160ms}
.tk-materials .mat-toggle[aria-checked=true]>span{background:var(--mat-accent);border-color:var(--mat-accent)}
.tk-materials .mat-toggle[aria-checked=true]>span::after{background:var(--mat-accent-ink);transform:translateX(10px)}
.tk-materials .mat-empty{grid-column:1/-1;display:grid;justify-items:start;gap:10px;padding:32px clamp(18px,4vw,48px);border:1px dashed var(--mat-line);border-radius:var(--mat-radius);background:var(--mat-paper);min-width:0}
.tk-materials .mat-empty strong{font:700 22px/1.4 var(--tk-title-font-family,system-ui,sans-serif)}
.tk-materials .mat-empty p{color:var(--mat-muted);font-size:13px;max-width:42ch}
.tk-materials .mat-count{font-size:12px;color:var(--mat-muted);padding:16px 0 4px}
.tk-materials .mat-avatar{width:42px;height:48px;border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.45);background:var(--mat-soft);display:inline-flex;align-items:center;justify-content:center;flex:none;font-size:19px;color:var(--mat-muted);object-fit:cover}
.tk-materials .mat-drawer{color:var(--mat-ink);background:var(--mat-paper);border:1px solid var(--mat-line);border-radius:var(--mat-radius) 0 0 var(--mat-radius);padding:0;width:min(900px,calc(100vw - 28px));max-width:none;height:100dvh;max-height:100dvh;margin:0 0 0 auto;inset:0 0 0 auto;overflow:hidden;box-shadow:var(--tk-shadow-md,none)}
.tk-materials .mat-drawer[open]{display:flex;flex-direction:column}
.tk-materials .mat-drawer::backdrop{background:color-mix(in srgb,var(--mat-ink) 28%,transparent);backdrop-filter:blur(3px)}
.tk-materials .mat-drawer-head{display:flex;align-items:center;gap:12px;padding:16px 22px;border-bottom:1px solid var(--mat-line);background:var(--mat-paper);flex:none}
.tk-materials .mat-drawer-head>div{min-width:0}
.tk-materials .mat-detail-avatar{width:46px;height:56px}
.tk-materials h2{font-size:20px;overflow-wrap:anywhere;line-height:1.4}
.tk-materials .mat-close{margin-left:auto;flex:none;background:transparent;border-color:transparent;box-shadow:none}
.tk-materials .mat-drawer-body{overflow:auto;min-height:0;padding:20px 22px max(24px,env(safe-area-inset-bottom));display:grid;gap:20px;align-content:start;overscroll-behavior:contain}
.tk-materials .mat-paper{border:0;border-radius:0;background:transparent;padding:0;min-width:0}
.tk-materials h3{font-size:15px;font-weight:700}
.tk-materials .mat-section-head{justify-content:space-between;gap:8px;margin-bottom:12px}
.tk-materials .mat-section-head button{padding:5px 10px;font-size:12px;min-height:40px}
.tk-materials .mat-muted{color:var(--mat-muted);font-size:12px}
.tk-materials .mat-meta{padding-bottom:20px;border-bottom:1px solid var(--mat-line)}
.tk-materials .mat-meta-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:12px}
.tk-materials label{font-size:13px;font-weight:600;display:grid;gap:5px;min-width:0}
.tk-materials .mat-meta-grid input{width:100%;font-weight:400}
.tk-materials .mat-wide{grid-column:1/-1}
.tk-materials .mat-inline{display:flex;align-items:center;gap:8px}
.tk-materials .mat-inline select{min-height:40px;padding:5px 8px;font-size:13px;max-width:150px}
.tk-materials .mat-edit-tabs{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--mat-line)}
.tk-materials .mat-edit-tabs button{border-color:transparent;background:transparent;box-shadow:none;font-size:13px}
.tk-materials .mat-edit-tabs button[aria-pressed=true]{background:var(--mat-soft);color:var(--mat-accent);font-weight:700}
.tk-materials .mat-edit-tabs>.mat-muted{margin-left:auto}
.tk-materials .mat-field-picker{margin-bottom:12px}
.tk-materials .mat-field-picker select{width:100%}
.tk-materials .mat-json-label{gap:7px}
.tk-materials .mat-json-label>span{display:flex;align-items:center;gap:8px}
.tk-materials .mat-json-label small{color:var(--mat-muted);font-size:12px;font-weight:400}
.tk-materials .mat-json-label textarea{width:100%;min-height:240px;resize:vertical;font-weight:400;line-height:1.75;tab-size:2}
.tk-materials .mat-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:13px}
.tk-materials .mat-save-row{justify-content:space-between;gap:10px;margin-top:16px;padding-top:12px;border-top:1px solid var(--mat-line)}
.tk-materials .mat-bindings{margin-top:18px;padding:14px;border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.6);background:var(--mat-soft)}
.tk-materials .mat-bindings h4{font-size:14px;margin-bottom:10px}
.tk-materials .mat-bound-books{display:grid;gap:6px;max-height:220px;overflow:auto;margin-bottom:9px}
.tk-materials .mat-binding-row{display:flex;align-items:center;gap:10px;justify-content:space-between;min-width:0}
.tk-materials .mat-binding-row>label{display:flex;align-items:center;gap:7px;font-weight:400;overflow-wrap:anywhere;min-width:0;flex:1}
.tk-materials .mat-binding-row select{max-width:140px}
.tk-materials .mat-binding-row input[type=checkbox]{accent-color:var(--mat-accent);width:16px;height:16px;flex:none}
.tk-materials .mat-preset-label{margin-top:10px}
.tk-materials .mat-capabilities{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding-top:4px}
.tk-materials .mat-capability h3{display:flex;align-items:center;gap:8px;font-size:14px}
.tk-materials .mat-capability h3 span{color:var(--mat-muted);font-size:12px;font-variant-numeric:tabular-nums;font-weight:400}
.tk-materials .mat-capability-items{max-height:240px;overflow:auto;margin-top:10px;border-top:1px solid var(--mat-line)}
.tk-materials .mat-capability-items>div{display:grid;gap:3px;padding:9px 0;border-bottom:1px solid color-mix(in srgb,var(--mat-line) 60%,transparent);font-size:12px;overflow-wrap:anywhere}
.tk-materials .mat-capability-items strong{font-weight:600}
.tk-materials .mat-capability-items :is(code,span){font-size:12px;color:var(--mat-muted)}
.tk-materials .mat-capability-items>p{padding-top:10px}
.tk-materials .mat-resources{border-block:1px solid var(--mat-line);padding-block:12px}
.tk-materials .mat-resources summary{font-size:13px;cursor:pointer;font-weight:600;min-height:32px;align-content:center}
.tk-materials .mat-resources summary span{color:var(--mat-muted);font-size:12px;font-weight:400;padding-left:8px}
.tk-materials .mat-resource-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;padding-top:12px}
.tk-materials .mat-resource-grid figure{border:1px solid var(--mat-line);border-radius:calc(var(--mat-radius)*.5);overflow:hidden;background:var(--mat-soft);min-width:0;align-self:start}
.tk-materials .mat-resource-grid img{display:block;width:100%;height:110px;object-fit:contain;background:var(--mat-paper)}
.tk-materials .mat-resource-grid figcaption{padding:8px;font-size:12px;overflow-wrap:anywhere}
.tk-materials .mat-resource-grid small{display:block;color:var(--mat-muted);font-size:12px;margin-top:3px}
.tk-materials .mat-file-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px;background:var(--mat-soft);border-radius:calc(var(--mat-radius)*.6);box-shadow:var(--mat-inset)}
.tk-materials .mat-file-actions h3{margin-bottom:4px}
.tk-materials .mat-file-actions .mat-actions{gap:6px}
.tk-materials .mat-file-actions button,.tk-materials .mat-maintenance button{font-size:13px;padding:6px 10px}
.tk-materials .mat-maintenance{justify-content:space-between;gap:10px}
.tk-materials .mat-maintenance button{background:transparent;border-color:transparent;box-shadow:none}
.tk-materials .mat-remove{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid var(--mat-danger);padding:12px;border-radius:calc(var(--mat-radius)*.5)}
.tk-materials .mat-remove p{color:var(--mat-muted);font-size:12px;margin-top:4px}
.tk-materials .mat-persona-create{width:min(600px,calc(100vw - 28px))}
.tk-materials .mat-persona-create .mat-paper{padding:0}
:root[data-tk-skin=pixel] .tk-materials .mat-book{transform:none;border-radius:0;box-shadow:2px 3px 0 var(--mat-line)}
:root[data-tk-skin=pixel] .tk-materials .mat-toggle>span,:root[data-tk-skin=pixel] .tk-materials .mat-toggle>span::after{border-radius:0}
@media(hover:hover){
  .tk-materials button:not(:disabled):hover{background:var(--mat-soft)}
  .tk-materials .mat-primary:not(:disabled):hover{background:var(--mat-accent);filter:brightness(1.04)}
  .tk-materials .mat-card:has(.mat-card-open:hover){border-color:var(--mat-accent)}
  .tk-materials .mat-card-open:hover{background:transparent}
  .tk-materials .mat-heading>.mat-actions button:not(:disabled):hover{background:var(--mat-soft)}
}
@media(max-width:680px){
  .tk-rp.tk-materials{padding:16px 12px max(18px,env(safe-area-inset-bottom))}
  .tk-materials .mat-heading{gap:12px;margin-bottom:16px}
  .tk-materials .mat-heading-copy{gap:10px;align-items:flex-start}
  .tk-materials .mat-heading>.mat-actions{width:100%;justify-content:flex-end;gap:4px}
  .tk-materials .mat-heading>.mat-actions button{font-size:12px;padding-inline:9px}
  .tk-materials .mat-mark{width:42px;height:48px}
  .tk-materials h1{font-size:24px}
  .tk-materials .mat-heading p{max-width:30ch;line-height:1.6}
  .tk-materials .mat-collection-tools{padding:12px 12px 0}
  .tk-materials .mat-toolbar{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
  .tk-materials .mat-search{grid-column:1/-1}
  .tk-materials .mat-kinds{margin-top:3px}
  .tk-materials .mat-grid{grid-template-columns:1fr;gap:12px}
  .tk-materials .mat-card{padding:14px}
  .tk-materials .mat-card-open{gap:12px;min-height:70px}
  .tk-materials .mat-book{width:48px;height:64px;font-size:23px}
  .tk-materials .mat-drawer{width:100vw;height:100dvh;border-radius:0;inset:0;margin:0}
  .tk-materials .mat-drawer-head{padding:12px 14px;gap:10px}
  .tk-materials .mat-drawer-body{padding:16px 14px max(20px,env(safe-area-inset-bottom));gap:18px}
  .tk-materials .mat-capabilities{grid-template-columns:1fr;gap:16px}
  .tk-materials .mat-meta-grid{gap:10px}
  .tk-materials .mat-save-row{gap:8px}
  .tk-materials .mat-save-row>span{flex:1 1 150px}
  .tk-materials .mat-save-row>button{flex:none}
  .tk-materials .mat-json-label textarea{min-height:200px}
  .tk-materials .mat-inline select{max-width:130px}
  .tk-materials .mat-edit-tabs>.mat-muted{margin-left:0}
  .tk-materials .mat-typed-editor :is(input:not([type=checkbox]),select,textarea),.tk-materials :is(input:not([type=checkbox]),select,textarea){font-size:16px}
  .tk-materials .mat-entry-picker{flex-wrap:wrap;gap:6px}
  .tk-materials .mat-entry-picker label{flex:1 1 100%;min-width:0}
  .tk-materials .mat-form-grid{grid-template-columns:minmax(0,1fr)}
  .tk-materials .mat-persona-identity{gap:10px}
  .tk-materials .mat-persona-identity>.mat-avatar{width:48px;height:58px}
}
@media(prefers-reduced-motion:reduce){.tk-materials *{transition:none!important;scroll-behavior:auto!important}}
`;
