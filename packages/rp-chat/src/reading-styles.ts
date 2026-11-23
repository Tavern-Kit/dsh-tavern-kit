/** Reading, local feedback and optional scene regions share the same data in every theme. */
export const READING_STYLES = `
.tk-rp.tk-chat-layout .tk-nav-bottom button{flex-direction:column;gap:4px;min-height:52px;white-space:nowrap;line-height:1.3;padding:6px 3px}
.tk-rp.tk-chat-layout .tk-nav-bottom button>svg{flex:none}
.tk-rp.tk-chat-layout .tk-version-update{flex:none;display:inline-flex;align-items:center;justify-content:center;min-width:36px;min-height:28px;margin-left:3px;padding:2px 6px;border:1px dashed var(--tk-ui-accent);border-radius:var(--tk-control-radius,5px);background:var(--tk-accent-soft,var(--tk-ui-soft));color:var(--tk-ui-accent);font-size:11px;line-height:1.2;white-space:nowrap}
@media(max-width:760px){.tk-rp.tk-chat-layout .tk-version-update{min-width:40px;min-height:40px;padding:2px;font-size:12px}}
@media(max-width:360px){.tk-rp.tk-chat-layout .tk-chat-title>span:has(.tk-version-update) .tk-chat-rounds{display:none}}
.tk-rp.tk-chat-layout .tk-sidebar-actions{display:grid;grid-template-columns:minmax(0,1fr) 40px;align-items:stretch;gap:8px}
.tk-rp.tk-chat-layout .tk-sidebar-actions>.tk-new-conversation{min-width:0}
.tk-rp.tk-chat-layout .tk-sidebar-actions>.tk-search-shortcut{width:40px;min-height:40px;border:1px solid var(--tk-ui-border);border-radius:var(--tk-control-radius,9px);background:var(--tk-ui-surface);color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-start-persona{display:grid;grid-template-columns:40px minmax(0,1fr) auto;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,10px);background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-start-persona-avatar{display:grid;place-items:center;width:40px;height:40px;overflow:hidden;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,9px);background:var(--tk-ui-surface);color:var(--tk-ui-accent);font-size:18px;font-weight:650}
.tk-rp.tk-chat-layout .tk-start-persona-avatar img{display:block;width:100%;height:100%;object-fit:cover}
.tk-rp.tk-chat-layout .tk-start-persona-choice{display:grid;gap:3px;min-width:0;font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-start-persona-choice select{min-width:0;width:100%;min-height:40px;font-size:14px;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-model-setting-field{display:grid;gap:6px;min-width:0;align-content:start}
.tk-rp.tk-chat-layout .tk-model-setting-field>label{font-size:13px;font-weight:600}
.tk-rp.tk-chat-layout .tk-model-setting-control{display:flex;align-items:center;gap:6px;min-width:0}
.tk-rp.tk-chat-layout .tk-model-setting-control>select{flex:1;min-width:0;width:0}
.tk-rp.tk-chat-layout .tk-model-setting-control>button{flex:none;width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-start-persona>button{min-height:40px;font-size:12px;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-start-persona>[role],.tk-rp.tk-chat-layout .tk-start-persona>p{grid-column:1/-1;margin:0;min-width:0;font-size:12px}
.tk-rp.tk-chat-layout .tk-continue-link{display:flex;align-items:center;justify-content:flex-start;min-width:0;min-height:0;height:100%;padding:0;border:0;background:transparent;color:var(--tk-ui-text);text-align:left;box-shadow:none;border-radius:0}
.tk-rp.tk-chat-layout .tk-continue-link:not(:disabled):hover{background:transparent;border-color:transparent}
.tk-rp.tk-chat-layout .tk-home-scene{align-self:stretch;min-width:0;min-height:145px;position:relative;z-index:1;display:grid;place-items:center;border-radius:var(--tk-control-radius,10px);overflow:hidden}
.tk-rp.tk-chat-layout .tk-home-scene>.tk-welcome-scene{margin:0;min-height:0}
.tk-rp.tk-chat-layout .tk-home-scene>:not(.tk-welcome-scene){width:100%;height:100%;min-height:145px}
.tk-rp.tk-chat-layout .tk-model-picker-panel{display:grid;gap:14px;min-width:0}
.tk-rp.tk-chat-layout .tk-model-picker-identity{display:flex;align-items:center;gap:10px;min-width:0;padding:12px;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,10px);background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-model-picker-identity>div{display:grid;gap:3px;min-width:0;flex:1}
.tk-rp.tk-chat-layout .tk-model-picker-identity>div>strong{font-size:14px;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-model-picker-identity .tk-muted,.tk-rp.tk-chat-layout .tk-model-picker-count{font-size:12px;line-height:1.4}
.tk-rp.tk-chat-layout .tk-model-picker-count{white-space:nowrap;color:var(--tk-ui-muted);font-variant-numeric:tabular-nums}
.tk-rp.tk-chat-layout .tk-model-picker-fields{display:grid;grid-template-columns:minmax(135px,.85fr) minmax(0,1.35fr);gap:12px}
.tk-rp.tk-chat-layout .tk-model-picker-search>span:last-child{display:flex;align-items:center;gap:7px;min-width:0;padding:0 10px;border:1px solid var(--tk-ui-border);border-radius:var(--tk-control-radius,9px);background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-model-picker-search>span:last-child:focus-within{outline:2px solid var(--tk-ui-focus);outline-offset:2px}
.tk-rp.tk-chat-layout .tk-model-picker-search input{min-width:0;padding:8px 0;border:0;background:transparent;box-shadow:none;outline:0}
.tk-rp.tk-chat-layout .tk-model-picker-results{display:grid;align-content:start;gap:7px;max-height:42dvh;overflow-y:auto;scrollbar-width:thin;min-width:0;padding:2px}
.tk-rp.tk-chat-layout .tk-model-picker-option{display:flex;align-items:center;justify-content:flex-start;gap:10px;min-height:65px;padding:10px;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,9px);background:var(--tk-ui-surface);text-align:left}
.tk-rp.tk-chat-layout .tk-model-picker-option[aria-pressed=true]{border-color:var(--tk-ui-accent);background:var(--tk-accent-soft,var(--tk-ui-soft));box-shadow:inset 3px 0 0 var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-model-picker-option-mark{display:grid;place-items:center;flex:none;width:32px;height:36px;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,7px);background:var(--tk-ui-soft);font-size:15px;color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-model-picker-option-copy{display:grid;flex:1;gap:4px;min-width:0}
.tk-rp.tk-chat-layout .tk-model-picker-option-name{font-size:13px;font-weight:650;line-height:1.5;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-model-picker-option-id{font:400 12px/1.5 var(--tk-font-family,system-ui,sans-serif);color:var(--tk-ui-muted);overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-model-picker-option-state{flex:none;white-space:nowrap;font-size:12px;color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-model-picker-footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;padding-top:10px;border-top:1px solid var(--tk-ui-line);font-size:12px}
.tk-rp.tk-chat-layout .tk-model-picker-empty{display:flex;align-items:center;justify-content:center;gap:10px;min-height:100px;color:var(--tk-ui-muted);font-size:13px}
.tk-rp.tk-chat-layout .tk-candidate-feedback{position:relative;margin:14px 0 0 37px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--tk-danger,#a7463b) 40%,var(--tk-ui-border));border-left:3px solid var(--tk-danger,#a7463b);border-radius:var(--tk-control-radius,9px);background:color-mix(in srgb,var(--tk-danger,#a7463b) 5%,var(--tk-ui-surface));font-size:13px;line-height:1.7}
.tk-rp.tk-chat-layout .tk-candidate-feedback>header{display:flex;align-items:center;flex-wrap:wrap;gap:6px;color:var(--tk-danger,#a7463b);font-size:13px}
.tk-rp.tk-chat-layout .tk-feedback-symbol{display:grid;place-items:center;width:19px;height:19px;border:1px solid currentColor;border-radius:5px;font-size:12px;font-weight:700}
.tk-rp.tk-chat-layout .tk-feedback-code,.tk-rp.tk-chat-layout .tk-candidate-feedback header>code{font:600 11px/1.5 var(--tk-font-family,system-ui,sans-serif);border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:4px;padding:1px 5px;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-feedback-route{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;min-width:0;margin-top:5px;color:var(--tk-ui-muted);font-size:12px}
.tk-rp.tk-chat-layout .tk-feedback-route code{font:inherit;overflow-wrap:anywhere;min-width:0}
.tk-rp.tk-chat-layout .tk-feedback-excerpt{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-wrap;margin-top:8px;overflow-wrap:anywhere;color:var(--tk-ui-text);font-size:13px}
.tk-rp.tk-chat-layout .tk-feedback-original>summary{padding:7px 0;font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-feedback-original pre{margin:6px 0 10px;padding:10px;max-height:38dvh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,6px);background:var(--tk-ui-surface);font:400 12px/1.75 ui-monospace,monospace}
.tk-rp.tk-chat-layout .tk-feedback-actions{display:flex;align-items:center;flex-wrap:wrap;gap:4px 12px;margin-top:3px}
.tk-rp.tk-chat-layout .tk-feedback-actions .tk-text-action{font-size:12px;min-height:32px;gap:5px}
.tk-rp.tk-chat-layout .tk-feedback-recovered{border-color:var(--tk-ui-line);border-left-color:var(--tk-ui-accent);background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-feedback-recovered>header{color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-markdown{white-space:normal;min-width:0;max-width:100%;line-height:1.85;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-markdown>:first-child{margin-top:0}
.tk-rp.tk-chat-layout .tk-markdown>:last-child{margin-bottom:0}
.tk-rp.tk-chat-layout .tk-markdown p{white-space:pre-wrap;margin:0}
.tk-rp.tk-chat-layout .tk-markdown p+p{margin-top:.72em}
.tk-rp.tk-chat-layout .tk-markdown :is(ul,ol){margin:.65em 0;padding-inline-start:1.6em}
.tk-rp.tk-chat-layout .tk-markdown li{padding-inline-start:.15em;margin:.2em 0;white-space:normal}
.tk-rp.tk-chat-layout .tk-markdown li>p{margin:.25em 0}
.tk-rp.tk-chat-layout .tk-markdown :is(h1,h2,h3,h4,h5,h6){color:var(--tk-ui-text);font-family:var(--tk-title-font-family,var(--tk-font-family,inherit));font-weight:700;line-height:1.5;margin:1.05em 0 .45em;letter-spacing:0}
.tk-rp.tk-chat-layout .tk-markdown h1{font-size:1.2em}.tk-rp.tk-chat-layout .tk-markdown h2{font-size:1.12em}.tk-rp.tk-chat-layout .tk-markdown :is(h3,h4,h5,h6){font-size:1em}
.tk-rp.tk-chat-layout .tk-markdown em{color:var(--tk-ink-soft,var(--tk-ui-muted));font-style:italic}
.tk-rp.tk-chat-layout .tk-markdown strong{font-weight:700;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-markdown a{color:var(--tk-ui-accent);text-decoration-line:underline;text-decoration-thickness:1px;text-underline-offset:3px;word-break:break-word}
.tk-rp.tk-chat-layout .tk-markdown blockquote{margin:.8em 0;padding:8px 13px;border-left:3px solid var(--tk-ui-accent);border-radius:0 var(--tk-control-radius,6px) var(--tk-control-radius,6px) 0;background:var(--tk-ui-soft);color:var(--tk-ink-soft,var(--tk-ui-muted))}
.tk-rp.tk-chat-layout .tk-markdown :not(pre)>code{padding:.12em .35em;background:var(--tk-ui-soft);border:1px solid var(--tk-ui-line);border-radius:4px;color:var(--tk-ui-text);font:400 .86em/1.6 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:break-spaces}
.tk-rp.tk-chat-layout .tk-markdown-scroll{min-width:0;max-width:100%;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:thin;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,8px);margin:.8em 0;background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-markdown-code pre{margin:0;padding:12px 14px;min-width:100%;width:max-content;white-space:pre;font:400 13px/1.75 ui-monospace,SFMono-Regular,Consolas,monospace}
.tk-rp.tk-chat-layout .tk-markdown-code code{font:inherit;color:var(--tk-ui-text);background:transparent;border:0;padding:0}
.tk-rp.tk-chat-layout .tk-markdown-table table{border-collapse:collapse;min-width:100%;width:max-content;font-size:.88em;line-height:1.7}
.tk-rp.tk-chat-layout .tk-markdown-table :is(th,td){padding:8px 12px;border-bottom:1px solid var(--tk-ui-line);text-align:left;min-width:80px;max-width:400px;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-markdown-table th{background:var(--tk-ui-surface);font-weight:650}
.tk-rp.tk-chat-layout .tk-markdown hr{border:0;border-top:1px solid var(--tk-ui-line);margin:1em 0}

/* The transcript is the primary surface. Only the real courtyard has a companion. */
.tk-rp.tk-chat-layout .tk-workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);min-height:0}
.tk-rp.tk-chat-layout .tk-workspace>.tk-transcript{grid-column:1;grid-row:1;min-height:0;display:flex;flex-direction:column}
.tk-rp.tk-chat-layout .tk-companion{display:none;min-width:0;min-height:0}
:root[data-tk-scene-kind=image] .tk-rp.tk-chat-layout .tk-companion{display:none}
.tk-rp.tk-chat-layout.tk-view-chat .tk-chat-header{display:flex;align-items:center;gap:10px;height:60px;min-height:60px;padding:7px 18px}
.tk-rp.tk-chat-layout .tk-chat-title{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-chat-title h1{flex:1;min-width:0;margin:0;overflow:visible;font-size:18px;line-height:1.6}
.tk-rp.tk-chat-layout .tk-chat-title>span{display:flex;flex:none;margin:0;gap:5px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-chat-title .tk-chat-partner,.tk-rp.tk-chat-layout .tk-chat-title>span>i{display:none}
.tk-rp.tk-chat-layout .tk-header-actions{display:flex;gap:0;flex:none}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control,.tk-rp.tk-chat-layout .tk-action-menu>summary{width:40px;height:40px;min-width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control>span{display:none}
.tk-rp.tk-chat-layout .tk-reading{padding:20px clamp(16px,4vw,42px) 28px;scroll-padding-block:20px 28px;scrollbar-gutter:stable both-edges}
.tk-rp.tk-chat-layout .tk-reading>.tk-reading-seal{display:none}
/* A reply is one reading object: quiet identity and navigation share its opening. */
.tk-rp.tk-chat-layout .tk-message{width:min(100%,var(--tk-reading-width,680px));margin-inline:auto;margin-bottom:26px}
.tk-rp.tk-chat-layout .tk-character>.tk-message-body{margin-left:0;letter-spacing:.006em;line-height:1.9;padding-bottom:2px}
.tk-rp.tk-chat-layout .tk-current-reply{margin-bottom:8px;padding-bottom:2px}
.tk-rp.tk-chat-layout .tk-message-heading{margin-bottom:9px;min-height:28px}
.tk-rp.tk-chat-layout .tk-message-avatar{width:28px;height:30px;font-size:13px;box-shadow:none}
.tk-rp.tk-chat-layout .tk-message-byline>strong{font-size:14px;font-weight:600}
.tk-rp.tk-chat-layout .tk-message-meta{font-size:12px}
.tk-rp.tk-chat-layout .tk-reply-header{display:flex;align-items:center;flex-wrap:wrap;gap:2px 14px;margin-bottom:12px;min-width:0}
.tk-rp.tk-chat-layout .tk-reply-header>.tk-message-heading{display:flex;align-items:center;gap:8px;flex:0 1 auto;min-width:0;margin:0;font-size:13px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-reply-header .tk-message-meta:empty{display:none}
.tk-rp.tk-chat-layout .tk-reply-header .tk-candidate-bar{flex:1 1 300px;min-width:0;margin:0;padding:0}
.tk-rp.tk-chat-layout .tk-candidate-bar{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-height:40px;padding:0;margin:0 0 12px;border:0;border-radius:0;background:transparent;box-shadow:none;width:auto}
.tk-rp.tk-chat-layout .tk-candidate-switch{display:flex;flex:none;align-items:center;gap:0;grid-column:auto;grid-row:auto;margin:0}
.tk-rp.tk-chat-layout .tk-favorite-filter{display:flex;align-items:center;flex:none;grid-column:auto;grid-row:auto;padding:0 6px;min-height:40px;margin:0}
.tk-rp.tk-chat-layout .tk-roll-actions{display:flex;align-items:center;flex:none;grid-column:auto;grid-row:auto;margin-left:auto;gap:2px}
.tk-rp.tk-chat-layout .tk-candidate-switch>.tk-icon-control,.tk-rp.tk-chat-layout .tk-roll-actions>.tk-icon-control{width:40px;min-width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-candidate-number{gap:3px;white-space:nowrap;font-size:12px}
.tk-rp.tk-chat-layout .tk-candidate-number input{font-weight:600;font-variant-numeric:tabular-nums}
.tk-rp.tk-chat-layout .tk-roll-button{font-size:12px;min-height:40px;border:0;box-shadow:none;background:transparent;padding:0 8px}
.tk-rp.tk-chat-layout .tk-reply-actions{display:flex;align-items:center;flex-wrap:wrap;gap:2px 10px;margin:10px 0 0;padding:4px 0 0;border:0;min-height:40px}
.tk-rp.tk-chat-layout .tk-return-route{font-size:12px;min-height:40px;gap:5px;order:3}
.tk-rp.tk-chat-layout .tk-reply-tools{display:flex;align-items:center;gap:0;margin-right:auto}
.tk-rp.tk-chat-layout .tk-reply-tools>.tk-icon-control,.tk-rp.tk-chat-layout .tk-reply-menu>summary{width:40px;min-width:40px;height:40px;min-height:40px;border:0;box-shadow:none;background:transparent}
.tk-rp.tk-chat-layout .tk-reply-decisions{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.tk-rp.tk-chat-layout .tk-reply-decisions>.tk-text-action{min-height:40px;padding:0 10px;font-size:12px}
.tk-rp.tk-chat-layout .tk-reply-decisions .tk-select-reply{border:1px solid transparent;box-shadow:none;font-weight:600;background:var(--tk-accent-soft,var(--tk-ui-soft));color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-reply-decisions .tk-select-reply[aria-pressed=true]{background:transparent;border-color:var(--tk-ui-line);color:var(--tk-ui-muted);box-shadow:none}
.tk-rp.tk-chat-layout .tk-reply-menu .tk-menu-sheet{top:auto;bottom:calc(100% + 6px);left:0;right:auto;width:210px;transform-origin:bottom left}
.tk-rp.tk-chat-layout .tk-reply-menu .tk-menu-sheet button{width:100%;height:auto;min-height:40px;padding:8px 10px;border:0;background:transparent;justify-content:flex-start;font-size:13px}
.tk-rp.tk-chat-layout .tk-reply-menu .tk-menu-sheet .tk-model-detail>span{display:inline}
.tk-rp.tk-chat-layout .tk-writing-dock{border-top:0;padding:6px clamp(16px,4vw,42px) max(12px,env(safe-area-inset-bottom));flex:none;min-height:0;background:transparent}
.tk-rp.tk-chat-layout .tk-composer{width:min(100%,var(--tk-reading-width,680px));margin-inline:auto;padding:10px 12px 7px;min-height:0;border-radius:var(--tk-writing-rest-radius,var(--tk-control-radius,12px));background:var(--tk-writing-rest-bg,var(--tk-ui-surface));box-shadow:none;transition:border-radius 160ms var(--tk-ease-out,cubic-bezier(.23,1,.32,1)),background-color 160ms ease,border-color 160ms ease}
.tk-rp.tk-chat-layout .tk-composer textarea{min-height:36px;line-height:1.65;max-height:22dvh;padding:2px 0;resize:none;field-sizing:content}
.tk-rp.tk-chat-layout .tk-composer-actions{min-width:0;gap:8px;margin-top:2px;align-items:center}
.tk-rp.tk-chat-layout .tk-model-picker{min-width:0;max-width:calc(100% - 48px);flex:1;margin-right:auto}
.tk-rp.tk-chat-layout .tk-model-picker-trigger{display:flex;align-items:center;gap:6px;max-width:100%;width:max-content;min-width:0;min-height:36px;padding:2px 4px;border:0;border-radius:4px;background:transparent;text-align:left;box-shadow:none}
.tk-rp.tk-chat-layout .tk-model-picker-trigger>svg{flex:none}
.tk-rp.tk-chat-layout .tk-model-picker-trigger-copy{min-width:0;flex:1;display:block}
.tk-rp.tk-chat-layout .tk-model-picker-provider,.tk-rp.tk-chat-layout .tk-model-picker-model{display:inline;font-size:12px;line-height:1.6;white-space:nowrap;overflow:visible;text-overflow:clip}
.tk-rp.tk-chat-layout .tk-model-picker-provider{color:var(--tk-ui-muted);font-weight:400}
.tk-rp.tk-chat-layout .tk-model-picker-model{font-weight:600}
.tk-rp.tk-chat-layout .tk-model-separator{color:var(--tk-ui-muted);padding-inline:3px;opacity:.65}
.tk-rp.tk-chat-layout .tk-overflow-line{display:block;min-width:0;max-width:100%}
.tk-rp.tk-chat-layout .tk-overflow-scroll{display:block;min-width:0;max-width:100%;overflow-x:auto;overflow-y:hidden;white-space:nowrap;scrollbar-width:none;padding-block:2px;overscroll-behavior-inline:contain;mask-image:none;-webkit-mask-image:none}
.tk-rp.tk-chat-layout .tk-overflow-scroll::-webkit-scrollbar{display:none}
.tk-rp.tk-chat-layout .tk-overflow-line:focus-within{outline:2px solid var(--tk-ui-focus);outline-offset:2px;border-radius:3px}
.tk-rp.tk-chat-layout .tk-overflow-line[data-overflow-end]>.tk-overflow-scroll{mask-image:linear-gradient(to right,#000 calc(100% - 12px),transparent);-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 12px),transparent)}
.tk-rp.tk-chat-layout .tk-overflow-line[data-overflow-start]>.tk-overflow-scroll{mask-image:linear-gradient(to right,transparent,#000 12px);-webkit-mask-image:linear-gradient(to right,transparent,#000 12px)}
.tk-rp.tk-chat-layout .tk-overflow-line[data-overflow-start][data-overflow-end]>.tk-overflow-scroll{mask-image:linear-gradient(to right,transparent,#000 12px,#000 calc(100% - 12px),transparent);-webkit-mask-image:linear-gradient(to right,transparent,#000 12px,#000 calc(100% - 12px),transparent)}
.tk-rp.tk-chat-layout .tk-conversation-copy strong,.tk-rp.tk-chat-layout .tk-message-byline>strong{overflow:visible;min-width:0}
.tk-rp.tk-chat-layout .tk-conversation-copy,.tk-rp.tk-chat-layout .tk-message-byline{min-width:0}
.tk-rp.tk-chat-layout .tk-rp-dialog .tk-conversation-context{display:block;width:auto;min-height:0;max-height:none;padding:0;margin:0;overflow:visible;background:transparent;border:0;box-shadow:none}
.tk-rp.tk-chat-layout .tk-quick-menu{position:relative;flex:none}
.tk-rp.tk-chat-layout .tk-quick-menu>summary{display:grid;place-items:center;width:40px;min-height:40px;list-style:none;cursor:pointer;border-radius:6px}
.tk-rp.tk-chat-layout .tk-quick-menu>summary::-webkit-details-marker{display:none}
.tk-rp.tk-chat-layout .tk-quick-menu>div{position:absolute;bottom:calc(100% + 8px);left:0;z-index:6;display:grid;max-height:40dvh;overflow:auto;min-width:180px;max-width:min(70vw,320px);padding:6px;border:1px solid var(--tk-ui-border);border-radius:var(--tk-control-radius,8px);background:var(--tk-ui-elevated);box-shadow:var(--tk-shadow)}
.tk-rp.tk-chat-layout .tk-quick-menu>div>button{min-height:40px;text-align:left;padding:6px 10px;white-space:normal}
/* Writing is a state of the reading surface, not another floating card. */
.tk-rp.tk-chat-layout{--tk-ease-out:cubic-bezier(.23,1,.32,1)}
.tk-rp.tk-chat-layout .tk-composer:is(:focus-within,[data-phase=draft],[data-phase=sending]){border-radius:var(--tk-writing-active-radius,var(--tk-control-radius,8px));background:var(--tk-writing-active-bg,var(--tk-ui-surface));border-color:color-mix(in srgb,var(--tk-ui-accent) 55%,var(--tk-ui-line));box-shadow:0 0 0 1px color-mix(in srgb,var(--tk-ui-accent) 8%,transparent)}
.tk-rp.tk-chat-layout .tk-send-button{position:relative;display:grid;place-items:center;flex:none;width:40px;min-width:40px;height:40px;min-height:40px;overflow:hidden}
.tk-rp.tk-chat-layout .tk-send-button>span{grid-area:1/1;display:grid;place-items:center;opacity:0;transform:scale(.85);transition:opacity 160ms var(--tk-ease-out),transform 160ms var(--tk-ease-out);pointer-events:none}
.tk-rp.tk-chat-layout .tk-send-button[data-mode=send]>.tk-send-icon,.tk-rp.tk-chat-layout .tk-send-button[data-mode=stop]>.tk-stop-icon,.tk-rp.tk-chat-layout .tk-send-button[data-mode=busy]>.tk-send-busy{opacity:1;transform:none}
.tk-rp.tk-chat-layout .tk-send-busy{width:12px;height:12px;border:2px solid currentColor;border-radius:50%}
.tk-rp.tk-chat-layout .tk-generation-state{font-size:12px;line-height:1.5;min-height:18px;font-variant-numeric:tabular-nums}
.tk-rp.tk-chat-layout .tk-generation-state>i{transition:background-color 160ms ease,opacity 160ms ease}
.tk-rp.tk-chat-layout .tk-inline-editor{display:block;margin:0;min-width:0;border:1px solid color-mix(in srgb,var(--tk-ui-accent) 30%,var(--tk-ui-line));border-radius:var(--tk-editor-radius,var(--tk-control-radius,8px));background:var(--tk-writing-active-bg,var(--tk-ui-surface));padding:0 12px;box-shadow:none;transform-origin:top left}
.tk-rp.tk-chat-layout .tk-inline-editor-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:40px;color:var(--tk-ui-muted);font-size:12px;line-height:1.5;border-bottom:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-inline-editor-heading>span{display:flex;align-items:center;gap:6px}
.tk-rp.tk-chat-layout .tk-inline-editor-heading>button{width:40px;min-height:40px;border:0;background:transparent}
.tk-rp.tk-chat-layout .tk-inline-editor>textarea{display:block;width:100%;min-height:5lh;max-height:22dvh;overflow:auto;margin:10px 0;padding:0;border:0;border-radius:0;background:transparent;font-family:inherit;font-size:var(--tk-font-size,17px);font-weight:400;line-height:1.9;letter-spacing:.006em;white-space:pre-wrap;resize:vertical;field-sizing:content;box-shadow:none;outline:none;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-inline-editor:focus-within{border-color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-inline-editor>footer{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:6px 0;border-top:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-inline-editor>footer>button{min-height:40px;padding-inline:10px;font-size:13px}
.tk-rp.tk-chat-layout .tk-inline-editor-error{margin:8px 0;color:var(--tk-danger,#a7463b);font-size:13px;line-height:1.6;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-inline-editor[data-phase=saving]>footer{color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout[data-tk-input=keyboard] :is(.tk-composer,.tk-send-button>span,.tk-generation-state>i){transition:none}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-send-button>span{transform:none;transition-property:opacity}
@media(hover:hover) and (pointer:fine){.tk-rp.tk-chat-layout .tk-reply-actions :is(button,summary):not(:disabled):hover{background:var(--tk-accent-soft,var(--tk-ui-soft))}}
@media(max-width:760px){.tk-rp.tk-chat-layout .tk-inline-editor{padding-inline:10px}.tk-rp.tk-chat-layout .tk-inline-editor>textarea{max-height:26dvh;font-size:max(16px,var(--tk-font-size,17px))}}

/* Small visible materials inside stable touch targets; themes provide one family of ink and edges. */
.tk-rp.tk-chat-layout :is(button,summary,label).tk-micro-control.tk-micro-control{position:relative;isolation:isolate;min-height:40px;min-width:40px;border:0;border-radius:0;background:transparent;box-shadow:none;outline:none;transform:none;overflow:visible;line-height:1.4}
.tk-rp.tk-chat-layout .tk-micro-control::before{content:"";position:absolute;inset:6px 4px;z-index:-1;pointer-events:none;border:1px solid var(--tk-micro-edge,transparent);border-radius:var(--tk-micro-radius,6px);background:var(--tk-micro-bg,transparent);box-shadow:var(--tk-micro-shadow,none);transition:background-color 140ms ease,border-color 140ms ease,box-shadow 140ms ease}
.tk-rp.tk-chat-layout .tk-micro-control>.tk-theme-icon{width:16px;height:16px}
.tk-rp.tk-chat-layout .tk-micro-control:focus-visible::before,.tk-rp.tk-chat-layout .tk-micro-control:has(>input:focus-visible)::before{outline:2px solid var(--tk-ui-focus);outline-offset:2px}
.tk-rp.tk-chat-layout .tk-micro-control.tk-micro-control:focus-within{outline:none}
.tk-rp.tk-chat-layout .tk-micro-control:is([aria-expanded=true],.tk-filter-active,[aria-pressed=true])::before{background:var(--tk-micro-selected-bg,var(--tk-accent-soft,var(--tk-ui-soft)));border-color:color-mix(in srgb,var(--tk-ui-accent) 24%,transparent)}
.tk-rp.tk-chat-layout .tk-micro-control:is([aria-pressed=true],.tk-filter-active){color:var(--tk-micro-selected-ink,var(--tk-ui-accent))}
.tk-rp.tk-chat-layout .tk-micro-control.tk-select-reply[aria-pressed=true]{color:var(--tk-ui-muted);font-weight:500}
.tk-rp.tk-chat-layout .tk-micro-control.tk-select-reply[aria-pressed=true]::before{background:var(--tk-micro-bg,transparent);border-color:var(--tk-micro-edge,transparent)}
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button::before{inset:5px;background:var(--tk-ui-accent);border-color:transparent;box-shadow:var(--tk-micro-shadow,none)}
.tk-rp.tk-chat-layout .tk-micro-control.tk-micro-control.tk-send-button{background:transparent;border:0;box-shadow:none;color:var(--tk-ui-accent-ink)}
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button[data-mode=stop]::before,.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button[data-mode=busy]::before{background:var(--tk-micro-selected-bg,var(--tk-ui-soft));border-color:var(--tk-micro-edge,var(--tk-ui-border))}
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button:is([data-mode=stop],[data-mode=busy]){color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button>span{position:relative;z-index:0}
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button>span>.tk-theme-icon{width:16px;height:16px}
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button>.tk-stop-icon>.tk-theme-icon{width:12px;height:12px}
.tk-rp.tk-chat-layout .tk-origin-label,.tk-rp.tk-chat-layout .tk-generation-state{display:inline-flex;align-items:center;gap:4px;min-height:22px;padding:1px 5px;border:1px solid var(--tk-micro-edge,transparent);border-radius:var(--tk-micro-radius,6px);background:var(--tk-micro-bg,transparent);font-size:12px;font-weight:400;line-height:1.4}
.tk-rp.tk-chat-layout .tk-candidate-number input{font-size:12px;font-weight:600}
.tk-rp.tk-chat-layout .tk-inline-editor .tk-micro-control.tk-primary{color:var(--tk-micro-selected-ink,var(--tk-ui-accent))}
.tk-rp.tk-chat-layout .tk-inline-editor .tk-micro-control.tk-primary::before{background:var(--tk-micro-selected-bg,var(--tk-ui-soft));border-color:var(--tk-micro-edge,var(--tk-ui-border))}
.tk-rp.tk-chat-layout .tk-micro-control:disabled::before{box-shadow:none}
.tk-rp.tk-chat-layout .tk-favorite-filter:has(>input:disabled){opacity:.4;cursor:default}
.tk-rp.tk-chat-layout .tk-favorite-filter>input:disabled{cursor:default}
.tk-rp.tk-chat-layout .tk-favorite-filter:has(>input:disabled)::before{box-shadow:none}
@media(hover:hover) and (pointer:fine){.tk-rp.tk-chat-layout .tk-micro-control:not(:disabled):not(:has(>input:disabled)):hover::before{background:var(--tk-micro-selected-bg,var(--tk-ui-soft));border-color:color-mix(in srgb,var(--tk-ui-accent) 25%,transparent)}}
.tk-rp.tk-chat-layout .tk-micro-control:not(:disabled):not(:has(>input:disabled)):active::before{background:var(--tk-micro-selected-bg,var(--tk-ui-soft));box-shadow:inset 0 1px 2px color-mix(in srgb,var(--tk-ui-accent) 18%,transparent)}
/* A pale secondary hover must never leave the primary send glyph on a pale surface. */
.tk-rp.tk-chat-layout .tk-micro-control.tk-send-button[data-mode=send]:is(:hover,:active)::before{background:var(--tk-ui-accent);border-color:transparent}
.tk-rp.tk-chat-layout[data-tk-input=keyboard] .tk-micro-control::before{transition:none}
@media(prefers-reduced-motion:reduce){.tk-rp.tk-chat-layout .tk-micro-control::before{transition:none}}

/* The courtyard is one background layer, never a reserved column or row. */
.tk-rp.tk-chat-layout .tk-workspace{position:relative;isolation:isolate}
.tk-rp.tk-chat-layout .tk-workspace>.tk-transcript{position:relative;z-index:1}
:root[data-tk-scene-kind=xi4u] .tk-rp.tk-chat-layout .tk-companion{display:block;position:absolute;inset:0;padding:0;min-width:0;pointer-events:none;z-index:auto}
.tk-rp.tk-chat-layout .tk-workspace.tk-courtyard-inspecting>.tk-companion{z-index:3}
.tk-rp.tk-chat-layout .tk-workspace.tk-courtyard-inspecting>.tk-transcript{opacity:0;pointer-events:none}
.tk-rp.tk-chat-layout .tk-presentation{position:absolute;inset:0;min-width:0;overflow:hidden;border:0;background:transparent;box-shadow:none}
.tk-rp.tk-chat-layout .tk-presentation>header{position:absolute;right:14px;top:10px;z-index:4;display:flex;align-items:center;gap:6px;pointer-events:auto;padding:2px 4px;border:1px solid var(--tk-ui-line);border-radius:24px;background:color-mix(in srgb,var(--tk-ui-surface) 88%,transparent);backdrop-filter:blur(12px);font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-presentation>header>span{display:none}
.tk-rp.tk-chat-layout .tk-presentation-actions{display:flex;gap:2px}
.tk-rp.tk-chat-layout .tk-presentation-actions button{min-height:36px;min-width:40px;padding:0 10px;border:0;border-radius:20px;background:transparent;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-presentation-actions button[aria-pressed=true]{color:var(--tk-ui-accent);background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-presentation-view{position:absolute;inset:0;z-index:0;height:100%;overflow:hidden;pointer-events:none}
.tk-rp.tk-chat-layout .tk-presentation-view>*{width:100%;height:100%;min-width:0}
.tk-rp.tk-chat-layout .tk-presentation-large .tk-presentation-view{pointer-events:auto}
.tk-rp.tk-chat-layout .tk-presentation-view img{object-fit:contain}
.tk-rp.tk-chat-layout[data-tk-input=keyboard] :is(button,summary,.tk-presentation-view){transition:none}
.tk-rp.tk-chat-layout .tk-menu-sheet{transform-origin:top right;will-change:transform,opacity}
.tk-rp.tk-chat-layout .tk-rp-dialog{transform-origin:50% 38%}
@media(max-width:760px){
.tk-rp.tk-chat-layout.tk-view-chat .tk-chat-header{display:flex;gap:4px;height:56px;min-height:56px;padding:6px 10px}
.tk-rp.tk-chat-layout .tk-chat-header>.tk-avatar{display:none}
.tk-rp.tk-chat-layout .tk-chat-title{display:block;min-width:0;flex:1}
.tk-rp.tk-chat-layout .tk-chat-title h1{font-size:16px;line-height:1.6;min-width:0}
.tk-rp.tk-chat-layout .tk-chat-title>span{display:none}
.tk-rp.tk-chat-layout .tk-header-actions{display:flex;gap:0}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control,.tk-rp.tk-chat-layout .tk-header-actions>details,.tk-rp.tk-chat-layout .tk-action-menu>summary{width:40px;min-width:40px;height:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-reading{padding:18px 16px 28px;scrollbar-gutter:auto}
.tk-rp.tk-chat-layout .tk-message{margin-bottom:24px}
.tk-rp.tk-chat-layout .tk-reply-header{gap:0 8px;margin-bottom:10px}
.tk-rp.tk-chat-layout .tk-reply-header>.tk-message-heading{flex-basis:100%;min-height:28px}
.tk-rp.tk-chat-layout .tk-reply-header .tk-candidate-bar{flex-basis:100%;margin:0;padding:0;gap:2px}
.tk-rp.tk-chat-layout .tk-message-avatar{width:26px;height:28px}
.tk-rp.tk-chat-layout .tk-message-byline>strong{font-size:14px}
.tk-rp.tk-chat-layout .tk-candidate-switch{gap:0}
.tk-rp.tk-chat-layout .tk-candidate-number{align-items:baseline;font-variant-numeric:tabular-nums}
.tk-rp.tk-chat-layout .tk-candidate-number input{font-size:16px;line-height:1.25;min-width:40px;min-height:40px;padding-inline:2px}
.tk-rp.tk-chat-layout .tk-favorite-filter{padding:0 6px;min-width:40px;justify-content:center}
.tk-rp.tk-chat-layout .tk-favorite-filter>span{display:none}
.tk-rp.tk-chat-layout .tk-roll-button{width:40px;min-width:40px;min-height:40px;padding:0;display:grid;place-items:center}
.tk-rp.tk-chat-layout .tk-roll-button>span{display:none}
.tk-rp.tk-chat-layout .tk-reply-actions{gap:4px 8px}
.tk-rp.tk-chat-layout .tk-model-detail{min-width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-model-detail>span{display:none}
.tk-rp.tk-chat-layout .tk-reply-tools .tk-icon-control{width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-writing-dock{padding:4px 16px max(10px,env(safe-area-inset-bottom))}
.tk-rp.tk-chat-layout .tk-composer{padding:7px 10px 5px}
.tk-rp.tk-chat-layout .tk-composer textarea{font-size:16px;min-height:36px}
.tk-rp.tk-chat-layout .tk-model-picker{max-width:calc(100% - 44px)}
.tk-rp.tk-chat-layout .tk-model-picker-trigger{min-height:36px;gap:4px;padding:0}
.tk-rp.tk-chat-layout .tk-model-picker-fields{grid-template-columns:1fr}
.tk-rp.tk-chat-layout .tk-model-picker-provider,.tk-rp.tk-chat-layout .tk-model-picker-model{font-size:12px}
.tk-rp.tk-chat-layout .tk-model-picker-option-state{font-size:12px}
.tk-rp.tk-chat-layout .tk-candidate-feedback{margin-left:0;padding:10px 12px}
.tk-rp.tk-chat-layout .tk-feedback-actions .tk-text-action{min-height:40px}
.tk-rp.tk-chat-layout .tk-feedback-code,.tk-rp.tk-chat-layout .tk-candidate-feedback header>code{font-size:12px}
.tk-rp.tk-chat-layout .tk-markdown-code pre{font-size:12px;padding:10px 12px}
.tk-rp.tk-chat-layout .tk-variables .tk-variable-row{grid-template-columns:minmax(66px,1fr) 66px minmax(80px,1.1fr);gap:6px}
.tk-rp.tk-chat-layout .tk-variables .tk-variable-row>:nth-child(3){grid-column:auto}
}
@media(max-width:375px){.tk-rp.tk-chat-layout .tk-candidate-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px}.tk-rp.tk-chat-layout .tk-candidate-switch{grid-column:1/-1;justify-self:start}.tk-rp.tk-chat-layout .tk-favorite-filter{grid-column:1;justify-self:start}.tk-rp.tk-chat-layout .tk-roll-actions{grid-column:2;margin:0;justify-self:end}}
@media(prefers-reduced-motion:reduce){.tk-rp.tk-chat-layout .tk-presentation-view{transition:none}}
`;
