import { TAVERN_ART_STYLES } from './art-styles.js';
import { READING_STYLES } from './reading-styles.js';

/** Shared functional workspace. Appearances provide materials, color and reader preferences. */
export const CHAT_STYLES = `
.tk-rp.tk-chat-layout{
 --tk-ui-bg:var(--tk-custom-bg,var(--tk-bg,var(--dsw-alias-bg-base,#f4f3ee)));
 --tk-ui-surface:var(--tk-surface,var(--dsw-alias-bg-base,#fffefb));
 --tk-ui-text:var(--tk-text,var(--dsw-alias-label-primary,#3e463c));
 --tk-ui-muted:var(--tk-muted,var(--dsw-alias-label-secondary,#74796d));
 --tk-ui-soft:var(--tk-surface-soft,color-mix(in srgb,var(--tk-ui-text) 5%,var(--tk-ui-surface)));
 --tk-ui-border:var(--tk-border,var(--dsw-alias-border-l1,#dedfd4));
 --tk-ui-line:var(--tk-line-soft,color-mix(in srgb,var(--tk-ui-border) 65%,transparent));
 --tk-ui-accent:var(--tk-accent,var(--dsw-alias-state-business-primary,#647650));
 --tk-ui-accent-ink:var(--tk-accent-ink,var(--dsw-alias-label-on-color,#fffef9));
 --tk-ui-focus:var(--tk-focus,var(--dsw-focus-ring-color,#647650));
 --tk-ui-elevated:var(--tk-elevated,var(--tk-ui-surface));
 --tk-ui-shadow:var(--tk-shadow-md,0 3px 15px #353e2710);
 --tk-ui-ease:cubic-bezier(.23,1,.32,1);
 box-sizing:border-box;min-width:0;min-height:0;width:100%;isolation:isolate;
 color:var(--tk-ui-text);background-color:var(--tk-ui-bg);font:400 14px/1.6 var(--tk-font-family,system-ui,sans-serif);-webkit-font-smoothing:antialiased;accent-color:var(--tk-ui-accent);
}
.tk-rp.tk-chat-layout *,.tk-rp.tk-chat-layout *::before,.tk-rp.tk-chat-layout *::after{box-sizing:border-box}
.tk-rp.tk-chat-layout :is(h1,h2,h3,p){margin:0;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout :is(h1,h2,h3){line-height:1.45;letter-spacing:-.025em;text-wrap:pretty}
.tk-rp.tk-chat-layout h1{font-size:24px;font-weight:750}
.tk-rp.tk-chat-layout h2{font-size:17px;font-weight:700}
.tk-rp.tk-chat-layout h3{font-size:14px;font-weight:650}
.tk-rp.tk-chat-layout :is(button,.tk-button){display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:36px;max-width:100%;padding:7px 12px;border:1px solid var(--tk-ui-border);border-radius:9px;background:var(--tk-ui-surface);color:var(--tk-ui-text);font:600 13px/1.45 var(--tk-font-family,system-ui,sans-serif);text-align:center;text-decoration:none;cursor:pointer;touch-action:manipulation;transition:background-color 140ms var(--tk-ui-ease),border-color 140ms var(--tk-ui-ease),transform 100ms var(--tk-ui-ease)}
.tk-rp.tk-chat-layout :is(button,.tk-button):disabled{opacity:.4;cursor:default}
.tk-rp.tk-chat-layout :is(button,.tk-button):not(:disabled):active{transform:translateY(1px)}
.tk-rp.tk-chat-layout :is(button,.tk-button).tk-primary{background:var(--tk-ui-accent);border-color:transparent;color:var(--tk-ui-accent-ink);box-shadow:inset 0 1px 0 #ffffff18,0 2px 3px #21271b0c}
.tk-rp.tk-chat-layout :is(button,input,textarea,select,summary,.tk-button):focus-visible{outline:2px solid var(--tk-ui-focus);outline-offset:3px}
.tk-rp.tk-chat-layout label{display:grid;min-width:0;gap:6px;font-size:13px;font-weight:600}
.tk-rp.tk-chat-layout :where(input:not([type=checkbox]):not([type=radio]),textarea,select){width:100%;min-width:0;max-width:100%;min-height:40px;padding:9px 11px;border:1px solid var(--tk-ui-border);border-radius:9px;background:var(--tk-ui-surface);color:var(--tk-ui-text);font:400 14px/1.55 var(--tk-font-family,system-ui,sans-serif)}
.tk-rp.tk-chat-layout textarea{resize:vertical}
.tk-rp.tk-chat-layout :is(input,textarea)::placeholder{color:var(--tk-ui-muted);opacity:.8}
.tk-rp.tk-chat-layout :is(input[type=checkbox],input[type=radio]){width:16px;height:16px;min-width:16px;flex:none;margin:0}
.tk-rp.tk-chat-layout :is(.tk-inline,.tk-toolbar){display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}
.tk-rp.tk-chat-layout .tk-toolbar{justify-content:space-between}
.tk-rp.tk-chat-layout .tk-inline>select{flex:1;width:auto;min-width:min(150px,100%)}
.tk-rp.tk-chat-layout .tk-check{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:400}
.tk-rp.tk-chat-layout .tk-muted{color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-chip{display:inline-flex;align-items:center;max-width:100%;padding:4px 8px;border-radius:6px;background:var(--tk-ui-soft);color:var(--tk-ui-muted);font-size:12px;font-weight:400}
.tk-rp.tk-chat-layout .tk-card{min-width:0;padding:16px;border:1px solid var(--tk-ui-line);border-radius:12px;background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout details{min-width:0}
.tk-rp.tk-chat-layout details>summary{padding:10px 0;color:var(--tk-ui-muted);font-size:13px;cursor:pointer}
.tk-rp.tk-chat-layout details[open]>summary{margin-bottom:7px}
.tk-rp.tk-chat-layout .tk-error{color:var(--tk-danger,#a55249);background:var(--tk-ui-surface);border:1px solid color-mix(in srgb,currentColor 28%,transparent);border-radius:10px;padding:10px 13px;font-size:13px;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-preserve{white-space:pre-wrap;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.tk-rp.tk-chat-layout .tk-span-all{grid-column:1/-1}
/* The navigation, reader and contextual cards have distinct visual weights. */
.tk-rp.tk-chat-layout{position:relative;display:grid;grid-template-columns:248px minmax(0,1fr);height:100%;max-height:100dvh;overflow:hidden}
.tk-rp.tk-chat-layout .tk-icon-control{flex:none;min-height:34px;width:34px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-text-action{padding:5px 3px;min-height:32px;border:0;border-radius:6px;background:transparent;color:var(--tk-ui-muted);font-size:12px;font-weight:550;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-conversations{display:flex;flex-direction:column;min-width:0;min-height:0;padding:0 12px;background:var(--tk-sidebar-bg,var(--tk-ui-soft));border-right:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-sidebar-brand{padding:22px 8px 19px}
.tk-rp.tk-chat-layout .tk-brand-home{padding:0;border:0;background:transparent;justify-content:flex-start;text-align:left;gap:11px}
.tk-rp.tk-chat-layout .tk-brand-home strong{display:block;font-size:19px;letter-spacing:-.6px;line-height:1.2;font-weight:750}
.tk-rp.tk-chat-layout .tk-brand-home small{display:block;margin-top:4px;font-size:11px;color:var(--tk-ui-muted);font-weight:400}
.tk-rp.tk-chat-layout .tk-story-mark{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:none;width:38px;height:40px;border-radius:11px;color:var(--tk-ui-accent);background:var(--tk-accent-soft,var(--tk-ui-soft));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tk-ui-accent) 10%,transparent)}
.tk-rp.tk-chat-layout .tk-story-mark>.tk-tavern-emblem{position:static;inset:auto;width:44px;height:44px;background:transparent;border-radius:0}
.tk-rp.tk-chat-layout .tk-new-conversation{width:100%;justify-content:flex-start;padding:9px 12px;min-height:40px;background:var(--tk-ui-accent);border-color:transparent;color:var(--tk-ui-accent-ink);box-shadow:inset 0 1px 0 #ffffff18,0 2px 4px #342c1a10;font-weight:650}
.tk-rp.tk-chat-layout .tk-conversation-search{display:flex;align-items:center;gap:8px;margin-top:14px;min-width:0;padding:0 10px;border:1px solid var(--tk-ui-line);border-radius:8px;background:color-mix(in srgb,var(--tk-ui-surface) 55%,transparent);color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-conversation-search input{min-height:35px;padding:5px 0;border:0;border-radius:0;background:transparent;font-size:12px;outline:0}
.tk-rp.tk-chat-layout .tk-conversation-search:focus-within{outline:2px solid var(--tk-ui-focus);outline-offset:2px}
.tk-rp.tk-chat-layout .tk-sidebar-section{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:19px 6px 9px;font-size:12px;color:var(--tk-ui-muted);font-weight:600}
.tk-rp.tk-chat-layout .tk-sidebar-section>span:last-child{font-size:11px;font-variant-numeric:tabular-nums;font-weight:400}
.tk-rp.tk-chat-layout .tk-nav-cards{flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;overflow-y:auto;padding:0 0 12px;scrollbar-width:thin}
.tk-rp.tk-chat-layout .tk-conversation{flex:none;position:relative;width:100%;justify-content:flex-start;gap:10px;border:1px solid transparent;border-radius:10px;background:transparent;padding:9px 8px;text-align:left;min-height:72px}
.tk-rp.tk-chat-layout .tk-conversation-copy{min-width:0;flex:1;display:grid;gap:5px}
.tk-rp.tk-chat-layout .tk-conversation-copy>strong{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:14px;line-height:1.5;font-weight:550}
.tk-rp.tk-chat-layout .tk-conversation-meta{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--tk-ui-muted);font-weight:400;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-conversation-meta small{font:inherit}
.tk-rp.tk-chat-layout .tk-conversation-meta>span{font-size:11px;padding-left:7px;border-left:1px solid var(--tk-ui-border)}
.tk-rp.tk-chat-layout .tk-conversation.tk-selected{background:var(--tk-ui-surface);border-color:var(--tk-ui-line);box-shadow:0 2px 5px #2c321208}
.tk-rp.tk-chat-layout .tk-conversation.tk-selected .tk-conversation-copy>strong{font-weight:750}
.tk-rp.tk-chat-layout .tk-sidebar-empty{padding:15px 8px;font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-nav-bottom{display:flex;align-items:center;gap:3px;padding:12px 0 18px;border-top:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-nav-bottom button{flex:1;gap:6px;border:0;background:transparent;min-height:40px;padding:6px;font-size:12px;font-weight:550;color:var(--tk-ui-muted)}
/* Story covers are original, local illustrations; actual card images take their place. */
.tk-rp.tk-chat-layout .tk-story-cover{--tk-cover-bg:#42565a;--tk-cover-ink:#e4d3ae;display:inline-flex;position:relative;flex:none;isolation:isolate;width:38px;height:48px;overflow:hidden;border-radius:4px 7px 7px 4px;background:var(--tk-cover-bg);color:var(--tk-cover-ink);box-shadow:inset 3px 0 2px #ffffff0b,inset -1px 0 0 #00000017,0 2px 4px #141a0f13}
.tk-rp.tk-chat-layout .tk-cover-1{--tk-cover-bg:#76806b;--tk-cover-ink:#f0e8c8}
.tk-rp.tk-chat-layout .tk-cover-2{--tk-cover-bg:#a17d6a;--tk-cover-ink:#f4e6cc}
.tk-rp.tk-chat-layout .tk-cover-3{--tk-cover-bg:#71677e;--tk-cover-ink:#ede0bd}
.tk-rp.tk-chat-layout .tk-story-cover>svg,.tk-rp.tk-chat-layout .tk-story-cover>img{display:block;width:100%;height:100%;object-fit:cover}
.tk-rp.tk-chat-layout .tk-cover-frame{stroke:currentColor;stroke-width:.65;opacity:.42}
.tk-rp.tk-chat-layout .tk-cover-window{fill:currentColor;fill-opacity:.08;stroke:currentColor;stroke-width:1;stroke-opacity:.8}
.tk-rp.tk-chat-layout .tk-cover-foil{stroke:currentColor;stroke-width:1.2;stroke-linecap:round;stroke-linejoin:round;opacity:.85}
.tk-rp.tk-chat-layout .tk-cover-moon{fill:currentColor;opacity:.85}
.tk-rp.tk-chat-layout .tk-cover-leaf{fill:currentColor;fill-opacity:.2;stroke:currentColor;stroke-width:1;stroke-linejoin:round}
.tk-rp.tk-chat-layout .tk-chat-main{position:relative;display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}
.tk-rp.tk-chat-layout .tk-chat-header{z-index:5;flex:none;display:flex;align-items:center;gap:12px;height:72px;min-width:0;padding:0 24px;background:transparent}
.tk-rp.tk-chat-layout .tk-avatar{width:38px;height:46px;border-radius:7px}
.tk-rp.tk-chat-layout .tk-chat-title{flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-chat-title h1{font-size:18px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:-.025em}
.tk-rp.tk-chat-layout .tk-chat-title>span{display:flex;gap:8px;align-items:center;white-space:nowrap;margin-top:3px;color:var(--tk-ui-muted);font-size:12px}
.tk-rp.tk-chat-layout .tk-chat-title .tk-chat-partner{min-width:0;overflow:hidden;text-overflow:ellipsis}
.tk-rp.tk-chat-layout .tk-chat-title .tk-chat-rounds{flex:none;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-chat-title i{font-style:normal;opacity:.55}
.tk-rp.tk-chat-layout .tk-header-actions{display:flex;align-items:center;gap:6px;flex:none}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control{width:auto;min-height:36px;padding:7px 10px;background:var(--tk-ui-surface);border:1px solid var(--tk-ui-line);color:var(--tk-ui-text);font-size:12px;gap:6px}
.tk-rp.tk-chat-layout .tk-mobile-back,.tk-rp.tk-chat-layout .tk-mobile-navigation{display:none}
.tk-rp.tk-chat-layout .tk-action-menu{position:relative;flex:none}
.tk-rp.tk-chat-layout .tk-action-menu>summary{display:flex;align-items:center;justify-content:center;list-style:none;width:36px;height:36px;margin:0!important;padding:0;color:var(--tk-ui-muted);border:1px solid var(--tk-ui-line);background:var(--tk-ui-surface);border-radius:8px}
.tk-rp.tk-chat-layout .tk-action-menu>summary::-webkit-details-marker{display:none}
.tk-rp.tk-chat-layout .tk-action-menu[open]>summary{background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-menu-sheet{position:absolute;z-index:30;top:calc(100% + 8px);right:0;display:grid;width:238px;padding:6px;border:1px solid var(--tk-ui-border);border-radius:12px;background:var(--tk-ui-elevated);box-shadow:var(--tk-ui-shadow),0 12px 35px #00000012}
.tk-rp.tk-chat-layout .tk-menu-sheet[hidden]{display:none}
.tk-rp.tk-chat-layout .tk-menu-heading{padding:7px 9px;font-size:11px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-menu-sheet button{justify-content:flex-start;border:0;padding:10px;min-height:40px;background:transparent;font-size:13px;gap:11px;font-weight:500}
.tk-rp.tk-chat-layout .tk-menu-sheet hr{width:calc(100% - 16px);margin:5px 8px;border:0;border-top:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-update{display:flex;align-items:center;justify-content:center;gap:14px;flex:none;margin:0 20px 10px;padding:7px 12px;border-radius:9px;font-size:12px;background:var(--tk-accent-soft,var(--tk-ui-soft))}
.tk-rp.tk-chat-layout .tk-workspace{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;flex:1;min-height:0;min-width:0;margin:0 20px 18px}
.tk-rp.tk-chat-layout .tk-transcript{display:flex;flex-direction:column;min-height:0;min-width:0;overflow:hidden;border:1px solid var(--tk-ui-line);border-radius:16px;background:var(--tk-ui-surface);box-shadow:var(--tk-ui-shadow)}
.tk-rp.tk-chat-layout .tk-reading{flex:1;width:100%;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;scrollbar-gutter:stable;padding:24px 28px 4px;scrollbar-width:thin;font-size:var(--tk-font-size,17px);line-height:1.8;overflow-wrap:anywhere}
.tk-rp.tk-chat-layout .tk-history-turn{display:contents}
.tk-rp.tk-chat-layout .tk-message{display:block;width:min(100%,var(--tk-reading-width,760px));min-width:0;margin:0 auto 22px}
.tk-rp.tk-chat-layout .tk-message.tk-current-reply{margin-bottom:8px}
.tk-rp.tk-chat-layout .tk-message>header{display:flex;align-items:center;gap:10px;min-height:36px;margin-bottom:12px;font-size:13px;line-height:1.5;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-message>header strong{font-weight:700;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-speaker-mark{display:inline-flex;align-items:center;justify-content:center;width:28px;height:30px;flex:none;border:1px solid color-mix(in srgb,var(--tk-ui-accent) 15%,transparent);border-radius:8px;background:var(--tk-accent-soft,var(--tk-ui-soft));color:var(--tk-ui-accent);font-size:12px}
.tk-rp.tk-chat-layout .tk-message>header .tk-text-action{margin-left:auto;font-size:11px;min-height:28px;padding:0 3px}
.tk-rp.tk-chat-layout .tk-message-body{min-width:0;margin-left:46px;padding:0;border:0;background:transparent;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.85;letter-spacing:.012em}
.tk-rp.tk-chat-layout .tk-player>header{justify-content:flex-end;gap:6px;margin-bottom:5px;font-size:12px;min-height:25px}
.tk-rp.tk-chat-layout .tk-player>header .tk-icon-control{width:28px;min-height:28px}
.tk-rp.tk-chat-layout .tk-message-user .tk-message-body{width:fit-content;max-width:88%;margin:0 0 0 auto;padding:11px 16px;background:var(--tk-user-bg,var(--tk-ui-soft));border:1px solid color-mix(in srgb,var(--tk-ui-border) 65%,transparent);border-radius:13px 4px 13px 13px;line-height:1.8;font-size:calc(var(--tk-font-size,17px) - 1px)}
.tk-rp.tk-chat-layout .tk-generation-state{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-generation-state>i,.tk-rp.tk-chat-layout .tk-status-dot{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--tk-ui-accent);flex:none}
.tk-rp.tk-chat-layout .tk-origin-label{font-size:11px;padding:2px 6px;border-radius:4px;background:var(--tk-ui-soft);color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-reply-ordinal{display:inline-flex;align-items:baseline;gap:6px;margin-left:auto;font-size:12px;color:var(--tk-ui-muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-reply-actions{display:flex;justify-content:space-between;align-items:center;gap:9px;margin:16px 0 0 46px;padding-top:8px;border-top:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-reply-tools,.tk-rp.tk-chat-layout .tk-reply-decisions{display:flex;align-items:center;gap:5px}
.tk-rp.tk-chat-layout .tk-reply-tools .tk-icon-control{width:34px;min-height:36px}
.tk-rp.tk-chat-layout .tk-reply-tools .tk-loved{color:var(--tk-heart,#b27072)}
.tk-rp.tk-chat-layout .tk-model-detail{font-size:12px;gap:5px}
.tk-rp.tk-chat-layout .tk-reply-decisions>.tk-text-action{font-size:12px;padding-inline:7px}
.tk-rp.tk-chat-layout .tk-reply-decisions .tk-select-reply{color:var(--tk-ui-accent);font-weight:650;background:var(--tk-accent-soft,var(--tk-ui-soft));padding-inline:10px;border-radius:var(--tk-control-radius,7px)}
.tk-rp.tk-chat-layout .tk-history-pages{display:flex;align-items:center;justify-content:space-between;gap:8px;width:min(100%,var(--tk-reading-width,760px));margin:0 auto 24px;padding-bottom:10px;border-bottom:1px solid var(--tk-ui-line);color:var(--tk-ui-muted);font-size:10px;font-variant-numeric:tabular-nums}
.tk-rp.tk-chat-layout .tk-history-pages .tk-text-action{font-size:11px}
.tk-rp.tk-chat-layout .tk-empty{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:12px;padding:25px 0;color:var(--tk-ui-muted);font-size:13px}
:root[data-tk-bubbles=off] .tk-rp.tk-chat-layout .tk-message-user .tk-message-body{background:transparent;padding:0;border-color:transparent;border-radius:0}
/* Identity, provenance and ordinal read as one small, deliberate object. */
.tk-rp.tk-chat-layout .tk-message-avatar{display:grid;place-items:center;width:36px;height:40px;flex:none;overflow:hidden;border:1px solid var(--tk-ui-line);border-radius:var(--tk-control-radius,10px);background:var(--tk-accent-soft,var(--tk-ui-soft));color:var(--tk-ui-accent);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--tk-ui-surface) 60%,transparent);font-size:14px;font-weight:600}
.tk-rp.tk-chat-layout .tk-message-avatar img{display:block;width:100%;height:100%;object-fit:cover}
.tk-rp.tk-chat-layout .tk-message-byline{display:flex;align-items:baseline;flex-wrap:wrap;min-width:0;gap:4px 8px}
.tk-rp.tk-chat-layout .tk-message-meta{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-message-meta:empty{display:none}
.tk-rp.tk-chat-layout .tk-reply-ordinal b{font-size:13px;font-weight:600;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-reply-ordinal>span{font-size:11px}
.tk-rp.tk-chat-layout .tk-select-reply[aria-pressed=true]{box-shadow:inset 0 -1px 0 color-mix(in srgb,var(--tk-ui-accent) 35%,transparent)}
.tk-rp.tk-chat-layout .tk-chat-settings>.tk-identity-grid>label:first-child{grid-column:1/-1}
/* Candidate navigation and the draft share one continuous writing tray. */
.tk-rp.tk-chat-layout .tk-writing-dock{flex:none;min-width:0;width:100%;align-self:center;padding:8px 20px max(14px,env(safe-area-inset-bottom));background:var(--tk-ui-surface);border-top:1px solid var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-candidate-bar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;min-height:46px;padding:0 0 8px}
.tk-rp.tk-chat-layout .tk-candidate-switch,.tk-rp.tk-chat-layout .tk-roll-actions{display:flex;align-items:center;gap:2px;min-width:0}
.tk-rp.tk-chat-layout .tk-candidate-switch{width:fit-content;padding:0;border:0;background:transparent;border-radius:var(--tk-control-radius,8px)}
.tk-rp.tk-chat-layout .tk-candidate-switch .tk-icon-control{width:30px;min-height:36px}
.tk-rp.tk-chat-layout .tk-candidate-number{display:inline-flex;align-items:baseline;gap:3px;min-width:0;white-space:nowrap;font-size:12px;color:var(--tk-ui-muted);font-variant-numeric:tabular-nums;font-weight:450}
.tk-rp.tk-chat-layout .tk-candidate-number input{min-width:2ch;width:3ch;min-height:28px;padding:2px 0;border:0;border-radius:4px;background:transparent;text-align:center;font-size:13px;font-weight:750;color:var(--tk-ui-text);appearance:textfield;-moz-appearance:textfield}
.tk-rp.tk-chat-layout .tk-candidate-number input::-webkit-inner-spin-button,.tk-rp.tk-chat-layout .tk-candidate-number input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.tk-rp.tk-chat-layout .tk-candidate-switch .tk-jump-action{width:23px;min-height:28px;border-radius:4px}
.tk-rp.tk-chat-layout .tk-favorite-filter{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:5px;margin-left:0;padding:4px 7px;min-height:36px;color:var(--tk-ui-muted);font-size:12px;font-weight:500;cursor:pointer;border-radius:var(--tk-control-radius,6px);white-space:nowrap}
.tk-rp.tk-chat-layout .tk-favorite-filter input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.tk-rp.tk-chat-layout .tk-favorite-filter:focus-within{outline:2px solid var(--tk-ui-focus);outline-offset:2px}
.tk-rp.tk-chat-layout .tk-filter-active{color:var(--tk-heart,#b27072);background:var(--tk-ui-elevated)}
.tk-rp.tk-chat-layout .tk-roll-button{min-height:38px;padding:7px 12px;border-color:var(--tk-ui-line);background:var(--tk-accent-soft,var(--tk-ui-soft));color:var(--tk-ui-accent);font-size:13px;font-weight:650;white-space:nowrap;border-radius:var(--tk-control-radius,8px)}
.tk-rp.tk-chat-layout .tk-quick-replies{display:flex;gap:6px;overflow-x:auto;padding:0 0 9px;scrollbar-width:thin}
.tk-rp.tk-chat-layout .tk-quick-replies>button{flex:none;min-height:30px;padding:4px 9px;font-size:12px;background:transparent}
.tk-rp.tk-chat-layout .tk-composer{position:relative;margin:0;padding:11px 13px 9px;border:1px solid var(--tk-ui-border);border-radius:var(--tk-control-radius,12px);background:var(--tk-ui-elevated);box-shadow:inset 0 1px 0 color-mix(in srgb,var(--tk-ui-surface) 70%,transparent)}
.tk-rp.tk-chat-layout .tk-composer:focus-within{border-color:color-mix(in srgb,var(--tk-ui-accent) 70%,var(--tk-ui-border));box-shadow:0 0 0 3px color-mix(in srgb,var(--tk-ui-accent) 8%,transparent)}
.tk-rp.tk-chat-layout .tk-composer textarea{display:block;width:100%;min-height:40px;max-height:22dvh;padding:0;border:0;border-radius:0;background:transparent;resize:vertical;font-size:16px;line-height:1.65;outline:0}
.tk-rp.tk-chat-layout .tk-composer-actions{display:flex;align-items:center;gap:10px;margin-top:4px}
.tk-rp.tk-chat-layout .tk-model-choice{min-width:0;max-width:67%;font-size:11px;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tk-rp.tk-chat-layout .tk-model-indicator{flex:none;width:5px;height:5px;background:var(--tk-ui-accent);border-radius:50%}
.tk-rp.tk-chat-layout .tk-parallel-caption{font-size:11px;color:var(--tk-ui-muted);white-space:nowrap}
.tk-rp.tk-chat-layout .tk-send-button{width:38px;min-height:38px;margin-left:auto;border:0;border-radius:var(--tk-control-radius,9px);padding:0;background:var(--tk-ui-accent);color:var(--tk-ui-accent-ink);box-shadow:inset 0 1px 0 #ffffff20}
.tk-rp.tk-chat-layout .tk-send-button:disabled{opacity:.45}
.tk-rp.tk-chat-layout .tk-chat-main>.tk-error{flex:none;margin:0 20px 10px;gap:12px}
.tk-rp.tk-chat-layout .tk-chat-main>.tk-error>span{flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-chat-loading{display:flex;align-items:center;justify-content:center;gap:13px;flex:1;color:var(--tk-ui-muted);font-size:13px}
/* Context is a compact, factual companion to the active transcript, never a second store. */
.tk-rp.tk-chat-layout .tk-conversation-context{display:none;min-width:0;min-height:0;overflow:auto;scrollbar-width:thin;font-size:12px;padding:0 1px}
.tk-rp.tk-chat-layout .tk-context-player{display:flex;align-items:center;gap:10px;padding:13px;border:1px solid var(--tk-ui-line);border-radius:11px;background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-player-initial{display:grid;place-items:center;flex:none;width:33px;height:36px;border-radius:9px;background:var(--tk-accent-soft,var(--tk-ui-soft));color:var(--tk-ui-accent);font-size:13px;font-weight:650}
.tk-rp.tk-chat-layout .tk-context-player>div{display:grid;flex:1;min-width:0;gap:2px}
.tk-rp.tk-chat-layout .tk-context-player>div>span{font-size:11px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-context-player strong{font-size:14px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-context-player p{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.7;font-size:12px;color:var(--tk-ui-muted);margin-top:4px}
.tk-rp.tk-chat-layout .tk-context-player>button{min-height:32px;padding:0 2px;font-size:11px}
.tk-rp.tk-chat-layout .tk-context-heading{display:flex;align-items:center;justify-content:space-between;font-weight:650;margin:0 0 8px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-context-character{display:grid;grid-template-columns:56px minmax(0,1fr);gap:12px;padding:15px;border:1px solid var(--tk-ui-line);border-radius:12px;background:var(--tk-ui-surface);box-shadow:0 2px 5px #29301b05}
.tk-rp.tk-chat-layout .tk-context-character>.tk-story-cover{width:56px;height:72px}
.tk-rp.tk-chat-layout .tk-context-eyebrow{font-size:11px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-context-character h2{font-size:15px;line-height:1.5;margin:3px 0 6px;font-weight:700}
.tk-rp.tk-chat-layout .tk-context-character p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;font-size:12px;color:var(--tk-ui-muted);line-height:1.7}
.tk-rp.tk-chat-layout .tk-context-identity{grid-column:1/-1;display:flex;align-items:center;gap:8px;padding-top:10px;border-top:1px solid var(--tk-ui-line);font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-context-identity strong{font-size:12px;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-context-identity button{margin-left:auto;min-height:24px;font-size:11px;padding:0}
.tk-rp.tk-chat-layout :is(.tk-context-model,.tk-context-memo){margin-top:12px;padding:14px;border:1px solid var(--tk-ui-line);border-radius:12px;background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout :is(.tk-context-model,.tk-context-memo)>header{display:flex;align-items:center;gap:7px;margin-bottom:12px;color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout :is(.tk-context-model,.tk-context-memo)>header h2{font-size:12px;font-weight:650;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout :is(.tk-context-model,.tk-context-memo)>header button{margin-left:auto;min-height:24px;font-size:11px;padding:0;width:auto}
.tk-rp.tk-chat-layout .tk-context-model>strong{font-size:12px;font-weight:600}
.tk-rp.tk-chat-layout .tk-context-model code{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;margin-top:5px;font:400 11px/1.7 var(--tk-font-family,system-ui,sans-serif);color:var(--tk-ui-muted);overflow-wrap:anywhere;font-size:12px}
.tk-rp.tk-chat-layout .tk-context-model-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:11px;font-size:11px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-context-model-meta>span{padding:3px 6px;border-radius:5px;background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-context-memo{position:relative;background:color-mix(in srgb,var(--tk-ui-surface) 92%,var(--tk-ui-accent));border-top:2px solid color-mix(in srgb,var(--tk-ui-accent) 40%,var(--tk-ui-border))}
.tk-rp.tk-chat-layout .tk-context-memo>p{display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line;font-size:12px;line-height:1.85}
.tk-rp.tk-chat-layout .tk-context-memo .tk-context-empty{color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-memo-lock{display:flex;align-items:center;gap:5px;border-top:1px dashed var(--tk-ui-border);margin-top:13px;padding-top:10px;color:var(--tk-ui-muted);font-size:11px}
.tk-rp.tk-chat-layout .tk-context-bindings{display:flex;flex-wrap:wrap;gap:8px;padding:13px 2px;color:var(--tk-ui-muted);font-size:12px}
.tk-rp.tk-chat-layout .tk-context-bindings>span{display:inline-flex;align-items:center;gap:5px;max-width:100%;overflow-wrap:anywhere}
@media(min-width:1180px){.tk-rp.tk-chat-layout .tk-workspace{grid-template-columns:minmax(0,1fr) 224px;gap:16px}.tk-rp.tk-chat-layout .tk-conversation-context{display:block}}
/* A personal collection of complete story objects, with practical entry points beside it. */
.tk-rp.tk-chat-layout .tk-home{height:100%;width:100%;overflow-y:auto;padding:23px 28px 26px}
.tk-rp.tk-chat-layout .tk-home>*{max-width:1080px;margin-inline:auto}
.tk-rp.tk-chat-layout .tk-home-top{display:flex;align-items:center;justify-content:space-between;min-height:35px;margin-bottom:24px}
.tk-rp.tk-chat-layout .tk-home-location{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:650}
.tk-rp.tk-chat-layout .tk-home-location small{display:block;font-size:9px;letter-spacing:.17em;color:var(--tk-ui-muted);font-weight:450;margin-top:1px}
.tk-rp.tk-chat-layout .tk-home .tk-restore-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding-inline: 8px;
  color: var(--tk-ui-muted);
  font-size: 12px;
  font-weight: 500;
  border: 0;
  border-radius: var(--tk-page-radius, 6px);
  background: transparent;
  box-shadow: none;
}
.tk-rp.tk-chat-layout .tk-home .tk-restore-link:focus-visible { outline: 2px solid var(--tk-ui-focus); outline-offset: 2px; }
.tk-rp.tk-chat-layout .tk-recent-arrow { flex: none; margin-inline-start: auto; color: var(--tk-ui-muted); }
.tk-rp.tk-chat-layout .tk-home-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}
.tk-rp.tk-chat-layout .tk-home-heading h1{font-size:25px;letter-spacing:.005em;font-weight:750}
.tk-rp.tk-chat-layout .tk-home-heading p{margin-top:5px;font-size:13px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-home-new{font-size:12px;min-height:36px;padding:7px 12px}
.tk-rp.tk-chat-layout .tk-home-launchpad{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:14px}
.tk-rp.tk-chat-layout .tk-continue-card{position:relative;display:flex;align-items:center;justify-content:flex-start;gap:23px;padding:22px;border:1px solid var(--tk-ui-line);border-radius:15px;text-align:left;background:var(--tk-ui-surface);box-shadow:var(--tk-ui-shadow);overflow:hidden}
.tk-rp.tk-chat-layout .tk-feature-cover{width:94px;height:124px;transform:rotate(-5deg);border-radius:6px 10px 10px 6px;box-shadow:3px 5px 8px #17200e19}
.tk-rp.tk-chat-layout .tk-continue-copy{position:relative;display:grid;justify-items:start;gap:8px;min-width:0;flex:1}
.tk-rp.tk-chat-layout .tk-card-kicker{display:flex;gap:6px;align-items:center;color:var(--tk-ui-muted);font-size:11px;font-weight:500}
.tk-rp.tk-chat-layout .tk-continue-copy>strong{font-size:19px;line-height:1.55;font-weight:750;letter-spacing:.005em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tk-rp.tk-chat-layout .tk-continue-caption{font-size:12px;color:var(--tk-ui-muted);font-weight:400}
.tk-rp.tk-chat-layout .tk-continue-action{display:inline-flex;align-items:center;gap:12px;margin-top:4px;padding:5px 5px 5px 10px;background:var(--tk-accent-soft,var(--tk-ui-soft));border-radius:8px;color:var(--tk-ui-accent);font-size:12px;font-weight:700}
.tk-rp.tk-chat-layout .tk-continue-action>span{display:grid;place-items:center;width:25px;height:25px;border-radius:6px;background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-entry-stack{display:grid;gap:12px}
.tk-rp.tk-chat-layout .tk-start-entry{display:flex;align-items:center;gap:13px;justify-content:flex-start;padding:16px;border:1px solid var(--tk-ui-line);border-radius:12px;background:var(--tk-ui-surface);text-align:left}
.tk-rp.tk-chat-layout .tk-entry-icon{display:grid;place-items:center;flex:none;width:40px;height:43px;color:var(--tk-ui-accent);border-radius:10px;background:var(--tk-accent-soft,var(--tk-ui-soft));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--tk-ui-accent) 8%,transparent)}
.tk-rp.tk-chat-layout .tk-start-entry>span:not(.tk-entry-icon){min-width:0;display:grid;gap:4px}
.tk-rp.tk-chat-layout .tk-start-entry strong{font-size:14px;font-weight:700}
.tk-rp.tk-chat-layout .tk-start-entry small{font-size:12px;color:var(--tk-ui-muted);font-weight:400;line-height:1.6}
.tk-rp.tk-chat-layout .tk-start-entry>svg{flex:none;margin-left:auto;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout :is(.tk-home-recents,.tk-home-library){margin-top:24px}
.tk-rp.tk-chat-layout :is(.tk-home-recents,.tk-home-library)>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
.tk-rp.tk-chat-layout .tk-section-title{display:flex;align-items:center;gap:8px;color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-section-title h2{font-size:14px;font-weight:650;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-count-badge{font-size:10px;line-height:1;min-width:19px;text-align:center;padding:4px 6px;border-radius:5px;background:var(--tk-ui-soft);color:var(--tk-ui-muted);font-variant-numeric:tabular-nums}
.tk-rp.tk-chat-layout .tk-recent-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.tk-rp.tk-chat-layout .tk-recent-card{justify-content:flex-start;gap:14px;padding:16px;border:1px solid var(--tk-ui-line);border-radius:12px;background:var(--tk-ui-surface);text-align:left;align-items:stretch}
.tk-rp.tk-chat-layout .tk-recent-card>.tk-story-cover{width:53px;height:69px;align-self:center}
.tk-rp.tk-chat-layout .tk-recent-copy{min-width:0;flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:5px}
.tk-rp.tk-chat-layout .tk-recent-card strong{font-size:14px;line-height:1.5;font-weight:650;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tk-rp.tk-chat-layout .tk-recent-card small{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--tk-ui-muted);font-weight:400}
.tk-rp.tk-chat-layout .tk-recent-card small i{width:2px;height:2px;border-radius:50%;background:currentColor;opacity:.6}
.tk-rp.tk-chat-layout .tk-home-empty{display:flex;align-items:center;gap:14px;padding:18px;border:1px dashed var(--tk-ui-border);border-radius:11px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-home-empty>span{display:grid;gap:4px;flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-home-empty strong{font-size:13px;font-weight:600;color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-home-empty small{font-size:12px;line-height:1.7}
.tk-rp.tk-chat-layout .tk-character-shortcuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tk-rp.tk-chat-layout .tk-character-shortcuts>button{gap:10px;justify-content:flex-start;padding:10px 12px;text-align:left;border-color:var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-character-shortcuts .tk-story-cover{width:29px;height:38px}
.tk-rp.tk-chat-layout .tk-character-shortcuts button>span:not(.tk-story-cover){flex:1;min-width:0;display:grid;gap:3px}
.tk-rp.tk-chat-layout .tk-character-shortcuts strong{font-size:13px;font-weight:600}
.tk-rp.tk-chat-layout .tk-character-shortcuts small{font-size:11px;font-weight:400;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-add-character{width:100%;justify-content:flex-start;gap:13px;text-align:left;padding:13px 16px;border:1px dashed var(--tk-ui-border);border-radius:11px;background:color-mix(in srgb,var(--tk-ui-surface) 45%,transparent)}
.tk-rp.tk-chat-layout .tk-add-character-icon{display:grid;place-items:center;width:37px;height:40px;flex:none;background:var(--tk-ui-surface);border:1px solid var(--tk-ui-line);border-radius:8px;color:var(--tk-ui-accent)}
.tk-rp.tk-chat-layout .tk-add-character>span:not(.tk-add-character-icon){display:grid;gap:4px;flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-add-character strong{font-size:13px;font-weight:650}
.tk-rp.tk-chat-layout .tk-add-character small{font-size:11px;color:var(--tk-ui-muted);font-weight:400}
.tk-rp.tk-chat-layout .tk-home-footer{display:flex;align-items:center;gap:8px;margin-top:20px;padding-top:12px;border-top:1px solid var(--tk-ui-line);font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-home-footer button{margin-left:auto}
/* Native top-layer surfaces retain focus, drafts and local error feedback. */
.tk-rp.tk-chat-layout .tk-rp-dialog{position:fixed;inset:0;width:min(590px,calc(100vw - 48px));max-width:none;max-height:min(88dvh,900px);margin:auto;padding:0;border:1px solid var(--tk-ui-border);border-radius:17px;overflow:hidden;background:var(--tk-ui-elevated);color:var(--tk-ui-text);box-shadow:0 24px 80px #16170e30;font:400 14px/1.6 var(--tk-font-family,system-ui,sans-serif)}
.tk-rp.tk-chat-layout .tk-rp-dialog[open]{display:flex;flex-direction:column}
.tk-rp.tk-chat-layout .tk-rp-dialog::backdrop{background:#191a1863;backdrop-filter:blur(5px)}
.tk-rp.tk-chat-layout .tk-rp-dialog .tk-dialog-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex:none;padding:19px 23px 16px;border-bottom:1px solid var(--tk-ui-line);background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-dialog-header h2{font-size:19px;font-weight:700;margin-top:2px}
.tk-rp.tk-chat-layout .tk-dialog-kicker{font-size:9px;color:var(--tk-ui-muted);letter-spacing:.14em}
.tk-rp.tk-chat-layout .tk-dialog-content{min-height:0;overflow-y:auto;padding:22px 23px;display:grid;gap:18px;overscroll-behavior:contain}
.tk-rp.tk-chat-layout .tk-dialog-content>label{font-size:13px;gap:8px}
.tk-rp.tk-chat-layout .tk-dialog-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-top:3px;font-size:12px}
.tk-rp.tk-chat-layout .tk-dialog-wide{width:min(760px,calc(100vw - 48px))}
.tk-rp.tk-chat-layout .tk-dialog-map{width:min(1060px,calc(100vw - 48px))}
.tk-rp.tk-chat-layout .tk-dialog-content pre{max-width:100%;padding:14px;margin:8px 0 0;overflow:auto;background:var(--tk-ui-soft);border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere;font:400 11px/1.75 ui-monospace,monospace}
.tk-rp.tk-chat-layout .tk-dialog-error{flex:none;display:flex;align-items:center;gap:12px;margin:12px 20px 0}
.tk-rp.tk-chat-layout .tk-dialog-error>span{flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-candidate-route{display:grid;gap:5px;min-width:0;padding:13px 15px;border:1px solid var(--tk-ui-line);border-radius:10px;background:var(--tk-ui-surface);font-size:12px}
.tk-rp.tk-chat-layout .tk-candidate-route>strong{font-size:14px;font-weight:600}
.tk-rp.tk-chat-layout .tk-candidate-route code{overflow-wrap:anywhere;font-size:12px;line-height:1.7}
.tk-rp.tk-chat-layout .tk-chat-settings{border:0;padding:0;background:transparent}
.tk-rp.tk-chat-layout .tk-chat-settings>.tk-inline{margin-top:18px;padding:13px;border-radius:9px;background:var(--tk-ui-soft)}
.tk-rp.tk-chat-layout .tk-chat-settings details{margin-top:16px;border-top:1px solid var(--tk-ui-line);padding-top:6px}
.tk-rp.tk-chat-layout .tk-chat-settings h3{margin:20px 0 10px}
.tk-rp.tk-chat-layout .tk-binding-options{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:19px}
.tk-rp.tk-chat-layout .tk-small-number{width:65px!important}
.tk-rp.tk-chat-layout .tk-dialog-conversations{display:flex;flex-direction:column;max-height:65dvh;min-height:0}
.tk-rp.tk-chat-layout .tk-dialog-conversations>.tk-conversation-search{margin-top:0}
.tk-rp.tk-chat-layout .tk-usage-summary{padding:11px 13px;border:1px solid var(--tk-ui-line);border-radius:9px;background:var(--tk-ui-soft);font-size:12px}
.tk-rp.tk-chat-layout .tk-map-preview{max-height:30dvh;overflow:auto}
.tk-rp.tk-chat-layout .tk-map-preview>.tk-inline{justify-content:space-between;margin-top:13px;font-size:12px}
@media(hover:hover) and (pointer:fine){
.tk-rp.tk-chat-layout :is(button,.tk-button):not(:disabled):hover{background:var(--tk-ui-soft);border-color:var(--tk-ui-border)}
.tk-rp.tk-chat-layout :is(button,.tk-button).tk-primary:not(:disabled):hover,.tk-rp.tk-chat-layout .tk-new-conversation:not(:disabled):hover{background:var(--tk-ui-accent);filter:brightness(1.07)}
.tk-rp.tk-chat-layout .tk-text-action:not(:disabled):hover{color:var(--tk-ui-text)}
.tk-rp.tk-chat-layout .tk-conversation:not(:disabled):hover{background:var(--tk-ui-surface);border-color:var(--tk-ui-line)}
.tk-rp.tk-chat-layout .tk-send-button:not(:disabled):hover{background:var(--tk-ui-accent);filter:brightness(1.1)}
}
@media(max-width:1000px) and (min-width:761px){.tk-rp.tk-chat-layout{grid-template-columns:218px minmax(0,1fr)}.tk-rp.tk-chat-layout .tk-home-launchpad{grid-template-columns:minmax(0,1fr)}.tk-rp.tk-chat-layout .tk-entry-stack{grid-template-columns:repeat(2,minmax(0,1fr))}.tk-rp.tk-chat-layout .tk-start-entry{padding:14px;gap:10px}.tk-rp.tk-chat-layout .tk-start-entry>svg{display:none}.tk-rp.tk-chat-layout .tk-favorite-filter>span{display:inline;font-size:0}.tk-rp.tk-chat-layout .tk-favorite-filter>span::after{content:"喜欢";font-size:12px}.tk-rp.tk-chat-layout .tk-home{padding-inline:22px}}
@media(max-width:760px){
.tk-rp.tk-chat-layout :where(input:not([type=checkbox]):not([type=radio]),textarea,select){font-size:16px}
.tk-rp.tk-chat-layout{display:flex;flex-direction:column}
.tk-rp.tk-chat-layout .tk-conversations{display:none}
.tk-rp.tk-chat-layout .tk-chat-main{flex:1}
.tk-rp.tk-chat-layout .tk-chat-header{height:64px;padding:0 12px 0 7px;gap:8px;border-bottom:1px solid var(--tk-ui-line);background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-mobile-back,.tk-rp.tk-chat-layout .tk-mobile-navigation{display:inline-flex}
.tk-rp.tk-chat-layout .tk-avatar{width:29px;height:36px;border-radius:6px}
.tk-rp.tk-chat-layout .tk-chat-title h1{font-size:14px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-chat-title>span{font-size:11px;gap:5px;margin-top:2px}
.tk-rp.tk-chat-layout .tk-header-actions{gap:2px}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control{width:36px;min-height:40px;padding:0;border:0;background:transparent}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control>span{display:none}
.tk-rp.tk-chat-layout .tk-icon-control{width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-action-menu>summary{width:36px;height:40px;border:0;background:transparent}
.tk-rp.tk-chat-layout .tk-menu-sheet{width:235px;right:0;top:calc(100% + 7px)}
.tk-rp.tk-chat-layout .tk-workspace{display:flex;flex-direction:column;margin:0;gap:0}
.tk-rp.tk-chat-layout .tk-transcript{flex:1;border:0;border-radius:0;box-shadow:none}
.tk-rp.tk-chat-layout .tk-reading{padding:20px 17px 4px;scrollbar-gutter:auto;font-size:var(--tk-font-size,17px)}
.tk-rp.tk-chat-layout .tk-message{margin-bottom:22px}
.tk-rp.tk-chat-layout .tk-message>header{font-size:13px;gap:9px;margin-bottom:12px}.tk-rp.tk-chat-layout .tk-message-avatar{width:32px;height:36px}.tk-rp.tk-chat-layout .tk-message-byline{gap:4px 6px}
.tk-rp.tk-chat-layout .tk-message-body{margin-left:0;line-height:1.85;letter-spacing:.005em}
.tk-rp.tk-chat-layout .tk-message-user .tk-message-body{max-width:92%;padding:10px 13px;font-size:calc(var(--tk-font-size,17px) - 1px);margin-left:auto}
.tk-rp.tk-chat-layout .tk-speaker-mark{width:26px;height:28px;font-size:11px}
.tk-rp.tk-chat-layout .tk-reply-ordinal{font-size:12px}
.tk-rp.tk-chat-layout .tk-reply-actions{margin:13px 0 0;padding-top:8px;gap:5px}
.tk-rp.tk-chat-layout .tk-reply-tools{gap:0}
.tk-rp.tk-chat-layout .tk-reply-tools .tk-icon-control,.tk-rp.tk-chat-layout .tk-player>header .tk-icon-control{width:36px;min-height:40px}
.tk-rp.tk-chat-layout .tk-model-detail{font-size:0;gap:0;width:36px;min-height:40px}
.tk-rp.tk-chat-layout .tk-model-detail>span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.tk-rp.tk-chat-layout .tk-reply-decisions{gap:5px}
.tk-rp.tk-chat-layout .tk-reply-decisions>.tk-text-action{font-size:12px;min-height:40px;padding-inline:6px}
.tk-rp.tk-chat-layout .tk-reply-decisions .tk-select-reply{padding-inline:10px}
.tk-rp.tk-chat-layout .tk-history-pages{gap:8px;flex-wrap:wrap;margin-bottom:19px;font-size:10px}
.tk-rp.tk-chat-layout .tk-history-pages>span{order:3;width:100%;text-align:center}
.tk-rp.tk-chat-layout .tk-history-pages .tk-text-action{font-size:11px;min-height:36px}
.tk-rp.tk-chat-layout .tk-writing-dock{padding:8px 12px max(12px,env(safe-area-inset-bottom))}
.tk-rp.tk-chat-layout .tk-candidate-bar{min-height:44px;padding-bottom:7px;gap:6px}
.tk-rp.tk-chat-layout .tk-candidate-switch{gap:0;padding:0}
.tk-rp.tk-chat-layout .tk-candidate-switch .tk-icon-control{width:40px;min-width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-candidate-number{font-size:11px}
.tk-rp.tk-chat-layout .tk-candidate-number input{font-size:15px;min-height:40px}
.tk-rp.tk-chat-layout .tk-candidate-switch .tk-jump-action{width:40px;min-width:40px;min-height:40px}
.tk-rp.tk-chat-layout .tk-favorite-filter{margin-left:2px;padding:4px;min-width:32px;min-height:40px;font-size:11px}
.tk-rp.tk-chat-layout .tk-favorite-filter>span{display:inline;font-size:0}.tk-rp.tk-chat-layout .tk-favorite-filter>span::after{content:"喜欢";font-size:12px}
.tk-rp.tk-chat-layout .tk-roll-button{font-size:12px;gap:5px;min-height:40px;padding:6px 10px}
.tk-rp.tk-chat-layout .tk-composer{border-radius:11px;padding:10px 11px 7px}
.tk-rp.tk-chat-layout .tk-composer textarea{min-height:36px;max-height:22dvh;font-size:16px}
.tk-rp.tk-chat-layout .tk-composer-actions{margin-top:2px}
.tk-rp.tk-chat-layout .tk-model-choice{font-size:11px;min-height:35px}
.tk-rp.tk-chat-layout .tk-send-button{min-height:38px;width:38px;border-radius:var(--tk-control-radius,8px)}
.tk-rp.tk-chat-layout .tk-home{padding:16px 16px 24px}
.tk-rp.tk-chat-layout .tk-home-top{margin-bottom:21px}
.tk-rp.tk-chat-layout .tk-home-location{font-size:13px;gap:5px}
.tk-rp.tk-chat-layout .tk-home-location small{font-size:8px;letter-spacing:.1em}
.tk-rp.tk-chat-layout .tk-restore-link{font-size:11px;padding:7px 9px}
.tk-rp.tk-chat-layout .tk-home-heading{gap:8px;margin-bottom:17px}
.tk-rp.tk-chat-layout .tk-home-heading h1{font-size:22px}
.tk-rp.tk-chat-layout .tk-home-heading p{font-size:12px;line-height:1.7;max-width:245px}
.tk-rp.tk-chat-layout .tk-home-new{min-height:35px;gap:5px;white-space:nowrap;padding:6px 9px}
.tk-rp.tk-chat-layout .tk-home-launchpad{grid-template-columns:minmax(0,1fr);gap:11px}
.tk-rp.tk-chat-layout .tk-continue-card{padding:19px 20px;gap:21px;border-radius:13px}
.tk-rp.tk-chat-layout .tk-feature-cover{width:77px;height:103px}
.tk-rp.tk-chat-layout .tk-continue-copy{gap:7px}
.tk-rp.tk-chat-layout .tk-continue-copy>strong{font-size:17px;line-height:1.55}
.tk-rp.tk-chat-layout .tk-card-kicker,.tk-rp.tk-chat-layout .tk-continue-caption{font-size:10px}
.tk-rp.tk-chat-layout .tk-continue-action{font-size:12px;margin-top:2px}
.tk-rp.tk-chat-layout .tk-entry-stack{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tk-rp.tk-chat-layout .tk-start-entry{position:relative;display:grid;grid-template-columns:28px minmax(0,1fr) 12px;align-items:center;gap:7px;padding:12px;border-radius:11px}
.tk-rp.tk-chat-layout .tk-entry-icon{width:28px;height:30px;border-radius:8px}
.tk-rp.tk-chat-layout .tk-start-entry>span:not(.tk-entry-icon){width:auto;gap:4px;display:contents}
.tk-rp.tk-chat-layout .tk-start-entry strong{font-size:13px;grid-column:2;grid-row:1}
.tk-rp.tk-chat-layout .tk-start-entry small{font-size:12px;line-height:1.6;grid-column:1/-1;grid-row:2}
.tk-rp.tk-chat-layout .tk-start-entry>svg{position:static;grid-column:3;grid-row:1;width:12px;margin:0}
.tk-rp.tk-chat-layout :is(.tk-home-recents,.tk-home-library){margin-top:23px}
.tk-rp.tk-chat-layout .tk-recent-grid{gap:10px}
.tk-rp.tk-chat-layout .tk-recent-card{display:flex;align-items:flex-start;gap:10px;padding:13px 11px}
.tk-rp.tk-chat-layout .tk-recent-card>.tk-story-cover{width:33px;height:43px;align-self:flex-start}
.tk-rp.tk-chat-layout .tk-recent-card strong{font-size:13px;line-height:1.6}
.tk-rp.tk-chat-layout .tk-recent-card small{font-size:11px;line-height:1.5;gap:3px}
.tk-rp.tk-chat-layout .tk-recent-card small i{display:none}
.tk-rp.tk-chat-layout .tk-recent-card small{flex-direction:column;align-items:flex-start}
.tk-rp.tk-chat-layout .tk-character-shortcuts{gap:9px}
.tk-rp.tk-chat-layout .tk-character-shortcuts>button{padding:9px;gap:8px}
.tk-rp.tk-chat-layout .tk-character-shortcuts strong{font-size:12px}
.tk-rp.tk-chat-layout .tk-character-shortcuts small{font-size:11px}
.tk-rp.tk-chat-layout .tk-character-shortcuts>button>svg{display:none}
.tk-rp.tk-chat-layout .tk-home-footer{font-size:11px;gap:7px}
.tk-rp.tk-chat-layout .tk-home-footer button{font-size:11px}
.tk-rp.tk-chat-layout .tk-add-character{padding:12px;gap:10px}
.tk-rp.tk-chat-layout .tk-add-character small{font-size:11px}
.tk-rp.tk-chat-layout .tk-home-empty{padding:14px;flex-wrap:wrap;gap:10px}
.tk-rp.tk-chat-layout .tk-home-empty small{font-size:11px}
.tk-rp.tk-chat-layout .tk-rp-dialog{inset:auto 0 0;width:100%;max-height:90dvh;margin:0;border-radius:18px 18px 0 0;border-width:1px 0 0}
.tk-rp.tk-chat-layout .tk-rp-dialog .tk-dialog-header{padding:19px 19px 15px}
.tk-rp.tk-chat-layout .tk-dialog-content{padding:19px 19px max(24px,env(safe-area-inset-bottom));gap:18px}
.tk-rp.tk-chat-layout .tk-dialog-header h2{font-size:18px}
.tk-rp.tk-chat-layout .tk-form-grid{grid-template-columns:1fr;gap:14px}.tk-rp.tk-chat-layout .tk-chat-settings>.tk-identity-grid{grid-template-columns:minmax(96px,.7fr) minmax(0,1.3fr);gap:12px}
.tk-rp.tk-chat-layout .tk-dialog-content .tk-card{padding:14px}
}
@media(max-width:355px){.tk-rp.tk-chat-layout .tk-favorite-filter>span{display:none}.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control{width:31px}.tk-rp.tk-chat-layout .tk-header-actions{gap:0}.tk-rp.tk-chat-layout .tk-roll-button{padding-inline:7px}.tk-rp.tk-chat-layout .tk-candidate-bar{flex-wrap:wrap}.tk-rp.tk-chat-layout .tk-roll-actions{margin-left:auto}.tk-rp.tk-chat-layout .tk-home-heading h1{font-size:20px}.tk-rp.tk-chat-layout .tk-recent-card{gap:7px;padding:11px 9px}.tk-rp.tk-chat-layout .tk-recent-card>.tk-story-cover{width:26px;height:36px}}
@media(prefers-reduced-motion:reduce){.tk-rp.tk-chat-layout *,.tk-rp.tk-chat-layout *::before,.tk-rp.tk-chat-layout *::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
${TAVERN_ART_STYLES}
${READING_STYLES}
/* Workspaces use the same paper, edge and control materials as the other views. */
.tk-rp.tk-chat-layout .tk-home {
  background-color: var(--tk-page-canvas, var(--tk-ui-bg));
}
.tk-rp.tk-chat-layout .tk-home-top {
  padding-block-end: 8px;
  border-block-end: 1px solid var(--tk-page-edge, var(--tk-ui-line));
  margin-block-end: 12px;
}
.tk-rp.tk-chat-layout .tk-home .tk-start-entry,
.tk-rp.tk-chat-layout .tk-home .tk-recent-card {
  min-height: 60px;
  border: 0;
  border-radius: var(--tk-page-radius, 6px);
  background: transparent;
  box-shadow: none;
}
.tk-rp.tk-chat-layout .tk-home .tk-start-entry + .tk-start-entry {
  border-block-start: 1px solid var(--tk-page-edge, var(--tk-ui-line));
}
.tk-rp.tk-chat-layout .tk-home .tk-entry-stack { gap: 0; }
.tk-rp.tk-chat-layout .tk-home .tk-entry-icon {
  border-radius: var(--tk-page-radius, 6px);
  box-shadow: none;
}
.tk-rp.tk-chat-layout .tk-rp-dialog .tk-dialog-header {
  padding-block: 12px;
  border-block-end-color: var(--tk-page-edge, var(--tk-ui-line));
  background: var(--tk-page-panel, var(--tk-ui-surface));
}
.tk-rp.tk-chat-layout .tk-rp-dialog .tk-dialog-header h2 { margin: 0; }
.tk-rp.tk-chat-layout .tk-rp-dialog .tk-dialog-header button { min-width: 40px; min-height: 40px; }
@media (hover: hover) and (pointer: fine) {
  .tk-rp.tk-chat-layout .tk-home :is(.tk-start-entry, .tk-recent-card, .tk-restore-link):hover {
    background-color: color-mix(in srgb, var(--tk-page-accent, var(--tk-ui-accent)) 8%, transparent);
  }
}
`;
