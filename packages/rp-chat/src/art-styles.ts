import { THEME_ICON_STYLES } from './ThemeIcons.js';

/** Artwork and material treatment; functional layout remains in styles.ts. */
export const TAVERN_ART_STYLES = THEME_ICON_STYLES + `
.tk-rp .tk-theme-scene,.tk-rp .tk-tavern-emblem,.tk-rp .tk-task-stamp{position:relative;display:inline-flex;flex:none;pointer-events:none;isolation:isolate}
.tk-rp :is(.tk-theme-scene,.tk-tavern-emblem,.tk-task-stamp)>svg{display:none;width:100%;height:100%;overflow:visible}
.tk-rp :is(.tk-theme-scene,.tk-tavern-emblem,.tk-task-stamp)>.tk-art-island{display:block}
:root[data-tk-skin=classic] .tk-rp :is(.tk-theme-scene,.tk-tavern-emblem,.tk-task-stamp)>.tk-art-island,:root[data-tk-skin=pixel] .tk-rp :is(.tk-theme-scene,.tk-tavern-emblem,.tk-task-stamp)>.tk-art-island{display:none}
:root[data-tk-skin=classic] .tk-rp :is(.tk-theme-scene,.tk-tavern-emblem,.tk-task-stamp)>.tk-art-classic,:root[data-tk-skin=pixel] .tk-rp :is(.tk-theme-scene,.tk-tavern-emblem,.tk-task-stamp)>.tk-art-pixel{display:block}
.tk-rp .tk-tavern-emblem{width:44px;height:44px;color:var(--tk-ui-accent,var(--tk-accent))}
.tk-rp .tk-theme-scene{width:100%;aspect-ratio:20/11}
.tk-rp .tk-task-stamp{width:58px;height:58px;color:var(--tk-ui-accent,var(--tk-accent))}
.tk-rp.tk-chat-layout .tk-story-mark{width:48px;height:48px;background:transparent;border-radius:0;box-shadow:none}
.tk-rp.tk-chat-layout .tk-brand-home{gap:8px}
.tk-rp.tk-chat-layout .tk-brand-home strong{font-size:19px;letter-spacing:-.025em}
.tk-rp.tk-chat-layout .tk-brand-home small{font-size:12px;letter-spacing:.02em;margin-top:5px}
.tk-rp.tk-chat-layout .tk-sidebar-brand{position:relative;padding:22px 1px 18px;margin-bottom:12px;border-bottom:1px solid var(--tk-ui-border)}
.tk-rp.tk-chat-layout .tk-sidebar-brand::after{content:'';position:absolute;bottom:-3px;left:50%;width:5px;height:5px;transform:rotate(45deg);background:var(--tk-ui-accent);box-shadow:0 0 0 4px var(--tk-sidebar-bg,var(--tk-ui-soft))}
.tk-rp.tk-chat-layout .tk-conversations{position:relative;padding:0 14px;background-image:repeating-linear-gradient(90deg,transparent 0 5px,color-mix(in srgb,var(--tk-ui-accent) 2%,transparent) 5px 6px)}
.tk-rp.tk-chat-layout .tk-new-conversation{justify-content:center;min-height:42px;border:1px solid color-mix(in srgb,var(--tk-ui-accent) 65%,var(--tk-ui-border));box-shadow:0 3px 0 color-mix(in srgb,var(--tk-ui-accent) 22%,var(--tk-sidebar-bg))}
.tk-rp.tk-chat-layout .tk-conversation{border-radius:8px;padding:9px 7px;gap:11px;min-height:74px}
.tk-rp.tk-chat-layout .tk-conversation.tk-selected{border-color:color-mix(in srgb,var(--tk-ui-accent) 40%,var(--tk-ui-border));box-shadow:inset 3px 0 0 var(--tk-ui-accent),var(--tk-shadow)}
.tk-rp.tk-chat-layout .tk-conversation-copy>strong{font-size:14px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-conversation-meta,.tk-rp.tk-chat-layout .tk-conversation-meta>span,.tk-rp.tk-chat-layout .tk-sidebar-section>span:last-child{font-size:12px}
.tk-rp.tk-chat-layout .tk-conversation-search{background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-nav-cards{position:relative;z-index:1}
.tk-rp.tk-chat-layout .tk-sidebar-scene{height:92px;overflow:hidden;flex:none;margin:0 -7px;opacity:.85;mask-image:linear-gradient(to bottom,transparent,#000 12%)}
.tk-rp.tk-chat-layout .tk-sidebar-scene .tk-theme-scene{height:135px;max-width:245px;display:block;margin:0 auto;transform:translateY(-17px)}
.tk-rp.tk-chat-layout .tk-nav-bottom{position:relative;margin-inline:-2px;padding:10px 0 14px}
.tk-rp.tk-chat-layout .tk-nav-bottom button{background:color-mix(in srgb,var(--tk-ui-surface) 40%,transparent);border:1px solid var(--tk-ui-line);font-size:12px;border-radius:7px}
.tk-rp.tk-chat-layout .tk-home{padding:24px 32px 28px}
.tk-rp.tk-chat-layout .tk-home-top{margin-bottom:19px;min-height:48px}
.tk-rp.tk-chat-layout .tk-home-sign{display:flex;align-items:center;gap:8px}
.tk-rp.tk-chat-layout .tk-home-sign .tk-tavern-emblem{width:35px;height:35px}
.tk-rp.tk-chat-layout .tk-home-sign>span{font-size:16px;line-height:1.5;letter-spacing:.03em}
.tk-rp.tk-chat-layout .tk-home-location small{font-size:12px;letter-spacing:0;line-height:1.5}
.tk-rp.tk-chat-layout .tk-home-heading{margin-bottom:18px}
.tk-rp.tk-chat-layout .tk-home-heading h1{font-size:26px;letter-spacing:.02em}
.tk-rp.tk-chat-layout .tk-home-heading p{font-size:13px}
.tk-rp.tk-chat-layout .tk-home-launchpad{grid-template-columns:minmax(0,1.65fr) minmax(250px,1fr);gap:16px}
.tk-rp.tk-chat-layout .tk-continue-card{min-height:222px;display:grid;grid-template-columns:minmax(0,1fr) 45%;padding:25px 12px 22px 25px;gap:3px;background:var(--tk-ui-surface);border:1px solid var(--tk-ui-border);border-radius:var(--tk-radius,18px);box-shadow:var(--tk-shadow-md);isolation:isolate;overflow:hidden}
.tk-rp.tk-chat-layout .tk-continue-card::before{content:'';position:absolute;inset:7px;border:1px solid color-mix(in srgb,var(--tk-ui-accent) 23%,transparent);border-radius:calc(var(--tk-radius,18px) - 5px);pointer-events:none}
.tk-rp.tk-chat-layout .tk-continue-copy{gap:10px;z-index:1;padding-right:0}
.tk-rp.tk-chat-layout .tk-continue-copy>strong{font-size:21px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;overflow-wrap:anywhere;max-width:100%}
.tk-rp.tk-chat-layout .tk-card-kicker{font-size:12px}
.tk-rp.tk-chat-layout .tk-continue-caption{font-size:12px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-continue-action{min-height:36px;padding:5px 6px 5px 12px;font-size:13px;border:1px solid color-mix(in srgb,var(--tk-ui-accent) 20%,transparent);border-radius:7px;margin-top:2px}
.tk-rp.tk-chat-layout .tk-welcome-scene{width:100%;align-self:end;justify-self:end;margin-bottom:-5px;z-index:0;min-height:145px}
.tk-rp.tk-chat-layout .tk-entry-stack{gap:12px}
.tk-rp.tk-chat-layout .tk-start-entry{min-height:105px;gap:10px;padding:15px 16px 15px 8px;background:var(--tk-ui-surface);border:1px solid var(--tk-ui-border);border-radius:12px;box-shadow:var(--tk-shadow);position:relative}
.tk-rp.tk-chat-layout .tk-start-entry::after{content:'';position:absolute;inset:5px;border:1px dashed var(--tk-ui-line);border-radius:8px;pointer-events:none}
.tk-rp.tk-chat-layout .tk-entry-icon{width:62px;height:62px;border:0;background:none;box-shadow:none;border-radius:0}
.tk-rp.tk-chat-layout .tk-start-entry strong{font-size:15px}
.tk-rp.tk-chat-layout .tk-start-entry small{font-size:12px;line-height:1.7}
.tk-rp.tk-chat-layout .tk-section-title{gap:8px}
.tk-rp.tk-chat-layout .tk-section-title h2{font-size:16px;font-weight:700}
.tk-rp.tk-chat-layout .tk-count-badge{font-size:12px}
.tk-rp.tk-chat-layout :is(.tk-home-recents,.tk-home-library){margin-top:22px}
.tk-rp.tk-chat-layout .tk-recent-card{position:relative;min-height:109px;gap:14px;padding:17px 19px;border-radius:11px;border:1px solid var(--tk-ui-border);background:var(--tk-ui-surface);box-shadow:var(--tk-shadow);overflow:hidden}
.tk-rp.tk-chat-layout .tk-recent-card>.tk-story-cover{width:47px;height:63px}
.tk-rp.tk-chat-layout .tk-recent-card strong{padding-right:8px;font-size:14px;line-height:1.6}
.tk-rp.tk-chat-layout :is(.tk-recent-card small,.tk-character-shortcuts small,.tk-add-character small){font-size:12px}
.tk-rp.tk-chat-layout .tk-character-shortcuts>button{border-color:var(--tk-ui-border);background:var(--tk-ui-surface);min-height:73px}
.tk-rp.tk-chat-layout .tk-home-footer{padding:12px 15px;margin-top:17px;border:1px solid var(--tk-ui-line);border-radius:8px;background:var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-chat-header{height:78px;padding:0 24px;background:color-mix(in srgb,var(--tk-ui-surface) 30%,transparent)}
.tk-rp.tk-chat-layout .tk-chat-title h1{font-size:20px;line-height:1.5;letter-spacing:.01em}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control{min-height:38px;border-color:var(--tk-ui-border)}
.tk-rp.tk-chat-layout .tk-workspace{margin:0 20px 18px;gap:16px}
.tk-rp.tk-chat-layout .tk-transcript{position:relative;border-color:var(--tk-ui-border);border-radius:var(--tk-radius,16px);box-shadow:var(--tk-shadow-md)}
.tk-rp.tk-chat-layout .tk-transcript::before{content:'';position:absolute;inset:7px;z-index:0;pointer-events:none;border:1px solid color-mix(in srgb,var(--tk-ui-accent) 16%,transparent);border-radius:calc(var(--tk-radius,16px) - 5px)}
.tk-rp.tk-chat-layout .tk-reading{position:relative;z-index:1;padding:18px 28px 4px}
.tk-rp.tk-chat-layout .tk-reading-seal{display:flex;align-items:center;justify-content:center;gap:10px;width:min(100%,var(--tk-reading-width,760px));margin:0 auto 12px;pointer-events:none;color:var(--tk-ui-accent);opacity:.6}
.tk-rp.tk-chat-layout .tk-reading-seal>.tk-tavern-emblem{width:31px;height:31px}
.tk-rp.tk-chat-layout .tk-reading-seal>span:not(.tk-tavern-emblem){width:55px;height:1px;background:currentColor;opacity:.5}
.tk-rp.tk-chat-layout .tk-speaker-mark{border-radius:50% 50% 8px 8px;border-color:var(--tk-ui-border);color:var(--tk-ui-accent);width:29px;height:32px}
.tk-rp.tk-chat-layout .tk-message>header{font-size:13px;margin-bottom:9px}
.tk-rp.tk-chat-layout .tk-message-body{letter-spacing:.015em}
.tk-rp.tk-chat-layout :is(.tk-reply-ordinal,.tk-origin-label,.tk-generation-state,.tk-history-pages){font-size:12px}
.tk-rp.tk-chat-layout .tk-reply-actions{margin-top:12px;padding-top:6px}
.tk-rp.tk-chat-layout .tk-writing-dock{position:relative;z-index:1;background:var(--tk-ui-surface);padding:8px 22px max(14px,env(safe-area-inset-bottom))}
.tk-rp.tk-chat-layout .tk-candidate-switch{border:1px solid var(--tk-ui-border);background:var(--tk-ui-soft);border-radius:8px}
.tk-rp.tk-chat-layout .tk-roll-button{border-color:color-mix(in srgb,var(--tk-ui-accent) 50%,var(--tk-ui-border));background:var(--tk-accent-soft,var(--tk-ui-soft));min-height:38px;font-size:13px}
.tk-rp.tk-chat-layout .tk-composer{background:var(--tk-ui-elevated);border-color:var(--tk-ui-border);box-shadow:inset 0 2px 3px #00000006;border-radius:11px}
.tk-rp.tk-chat-layout .tk-composer textarea{min-height:36px}
.tk-rp.tk-chat-layout .tk-composer-actions{margin-top:6px}
.tk-rp.tk-chat-layout .tk-composer-actions .tk-model-choice{font-size:12px}
.tk-rp.tk-chat-layout .tk-send-button{width:36px;min-height:36px;border-radius:8px;box-shadow:0 2px 0 color-mix(in srgb,var(--tk-ui-accent) 30%,var(--tk-ui-surface))}
.tk-rp.tk-chat-layout .tk-context-heading{padding:5px 3px 10px;font-size:13px;border-bottom:1px solid var(--tk-ui-border);margin-bottom:10px}
.tk-rp.tk-chat-layout :is(.tk-context-player,.tk-context-character,.tk-context-model){border-color:var(--tk-ui-border);box-shadow:var(--tk-shadow);border-radius:11px}
.tk-rp.tk-chat-layout .tk-context-memo{border:1px solid var(--tk-ui-border);border-top:3px double var(--tk-ui-border);border-radius:3px 10px 10px 3px;background:var(--tk-ui-surface);box-shadow:3px 3px 0 color-mix(in srgb,var(--tk-ui-border) 25%,transparent)}
.tk-rp.tk-chat-layout .tk-context-memo::after{content:'';position:absolute;right:12px;top:-7px;width:35px;height:12px;transform:rotate(5deg);background:color-mix(in srgb,var(--tk-ui-accent) 19%,var(--tk-ui-surface));border:1px solid color-mix(in srgb,var(--tk-ui-border) 30%,transparent);pointer-events:none}
.tk-rp.tk-chat-layout :is(.tk-context-model,.tk-context-memo)>header h2{font-size:13px}
.tk-rp.tk-chat-layout .tk-context-model code{font-size:12px}
.tk-rp.tk-chat-layout .tk-rp-dialog{border:1px solid var(--tk-ui-border);box-shadow:0 28px 100px #11121b77,inset 0 0 0 5px var(--tk-ui-surface)}
.tk-rp.tk-chat-layout .tk-dialog-header{position:relative}
.tk-rp.tk-chat-layout .tk-dialog-header::after{content:'';position:absolute;bottom:0;left:23px;right:23px;height:3px;border-top:1px solid var(--tk-ui-line);border-bottom:1px solid var(--tk-ui-line);pointer-events:none}
.tk-rp.tk-chat-layout .tk-cover-pixel{display:none!important}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-cover-vector{display:none}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-cover-pixel{display:block!important}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-pixel-cutout{fill:var(--tk-cover-bg)}
:root[data-tk-skin=classic] .tk-rp.tk-chat-layout :is(.tk-home-heading h1,.tk-continue-copy>strong){font-family:Georgia,"Songti SC","Noto Serif CJK SC",serif;letter-spacing:.045em}
:root[data-tk-skin=island] .tk-rp.tk-chat-layout .tk-start-entry::after{border-style:dashed}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout :is(.tk-continue-card,.tk-transcript,.tk-recent-card,.tk-start-entry){border-radius:0}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-welcome-scene{aspect-ratio:20/11;image-rendering:pixelated}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-task-stamp{width:48px;height:48px}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-context-memo::after{transform:none;border-width:2px}
.tk-rp.tk-chat-layout .tk-start-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px 12px}
.tk-rp.tk-chat-layout .tk-start-form>:is(section,.tk-error){grid-column:1/-1;margin:0}
.tk-rp.tk-chat-layout .tk-start-identity{padding:15px 16px 10px;border:1px solid var(--tk-ui-border);background:var(--tk-ui-soft);border-radius:var(--tk-control-radius,10px)}
.tk-rp.tk-chat-layout .tk-start-nameplate{display:flex;align-items:center;gap:11px;margin-bottom:15px}
.tk-rp.tk-chat-layout .tk-start-initial{display:grid;place-items:center;flex:none;width:42px;height:50px;background:var(--tk-ui-surface);color:var(--tk-ui-accent);border:1px solid var(--tk-ui-border);border-radius:5px 10px 10px 5px;box-shadow:inset 3px 0 0 var(--tk-ui-line);font:700 23px var(--tk-title-font-family,inherit)}
.tk-rp.tk-chat-layout .tk-start-nameplate>div{display:grid;gap:5px;min-width:0}
.tk-rp.tk-chat-layout .tk-start-nameplate strong{font-size:16px}
.tk-rp.tk-chat-layout .tk-start-nameplate small{font-size:12px;color:var(--tk-ui-muted);line-height:1.5}
.tk-rp.tk-chat-layout .tk-start-material-action{display:flex;justify-content:flex-end;margin-top:3px}
.tk-rp.tk-chat-layout .tk-start-player{grid-template-columns:minmax(0,1fr) minmax(0,1.7fr);align-items:start}
.tk-rp.tk-chat-layout .tk-start-player textarea{min-height:76px}
.tk-rp.tk-chat-layout .tk-start-greeting{padding:14px 16px;border:1px solid var(--tk-ui-border);border-top:3px double var(--tk-ui-border);background:var(--tk-ui-surface);border-radius:var(--tk-control-radius,8px)}
.tk-rp.tk-chat-layout .tk-start-greeting>header{display:flex;align-items:center;justify-content:space-between;gap:12px}
.tk-rp.tk-chat-layout .tk-start-greeting>header>div:first-child{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px}
.tk-rp.tk-chat-layout .tk-start-greeting strong{font-size:14px}
.tk-rp.tk-chat-layout .tk-start-greeting small{font-size:12px;color:var(--tk-ui-muted)}
.tk-rp.tk-chat-layout .tk-start-greeting-nav{display:flex;flex:none;gap:3px}
.tk-rp.tk-chat-layout .tk-start-greeting-nav button{border:1px solid var(--tk-ui-border);background:var(--tk-ui-soft);width:35px;min-height:35px}
.tk-rp.tk-chat-layout .tk-start-greeting-preview{font-size:15px;line-height:1.85;white-space:pre-wrap;overflow-wrap:anywhere;max-height:174px;overflow:auto;margin:9px 0 2px;padding:0 2px;scrollbar-width:thin}
.tk-rp.tk-chat-layout .tk-start-read-error{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.tk-rp.tk-chat-layout .tk-start-model{display:flex;align-items:end;gap:6px;min-width:0}
.tk-rp.tk-chat-layout .tk-start-model>label{flex:1;min-width:0}
.tk-rp.tk-chat-layout .tk-start-model>button{flex:none;min-height:40px}
.tk-rp.tk-chat-layout .tk-start-actions{align-self:end;display:flex;align-items:center;margin:0}
.tk-rp.tk-chat-layout .tk-start-actions>button{min-height:40px;white-space:nowrap}
@media(max-width:760px){.tk-rp.tk-chat-layout .tk-start-form{gap:14px 8px}.tk-rp.tk-chat-layout .tk-start-player{grid-template-columns:1fr}.tk-rp.tk-chat-layout .tk-start-player textarea{min-height:68px}.tk-rp.tk-chat-layout .tk-start-identity,.tk-rp.tk-chat-layout .tk-start-greeting{padding:12px}.tk-rp.tk-chat-layout .tk-start-model{flex-wrap:wrap}.tk-rp.tk-chat-layout .tk-start-model>label{flex-basis:100%}.tk-rp.tk-chat-layout .tk-start-actions{align-self:start;padding-top:27px}.tk-rp.tk-chat-layout .tk-start-greeting-preview{max-height:154px}}
@media(max-height:780px){.tk-rp.tk-chat-layout .tk-sidebar-scene{display:none}}
@media(min-width:1180px){.tk-rp.tk-chat-layout .tk-workspace{grid-template-columns:minmax(0,1fr) 232px}}
@media(min-width:761px) and (max-width:1179px){.tk-rp.tk-chat-layout .tk-home-launchpad{grid-template-columns:1fr}.tk-rp.tk-chat-layout .tk-entry-stack{grid-template-columns:1fr 1fr}.tk-rp.tk-chat-layout .tk-continue-card{min-height:208px}.tk-rp.tk-chat-layout .tk-welcome-scene{width:min(100%,300px);min-height:0}}
@media(max-width:760px){
.tk-rp.tk-chat-layout .tk-home{padding:14px 16px 22px}
.tk-rp.tk-chat-layout .tk-home-top{margin-bottom:16px;gap:8px}
.tk-rp.tk-chat-layout .tk-home-sign .tk-tavern-emblem{width:28px;height:28px}
.tk-rp.tk-chat-layout .tk-home-sign>span{font-size:15px}
.tk-rp.tk-chat-layout .tk-home-location small{font-size:12px}
.tk-rp.tk-chat-layout .tk-restore-link{font-size:12px;min-height:38px;padding:6px 9px;flex:none}
.tk-rp.tk-chat-layout .tk-home-heading h1{font-size:23px}
.tk-rp.tk-chat-layout .tk-home-heading p{font-size:12px;max-width:230px}
.tk-rp.tk-chat-layout .tk-home-new{min-height:38px;font-size:12px}
.tk-rp.tk-chat-layout .tk-home-launchpad{grid-template-columns:1fr;gap:12px}
.tk-rp.tk-chat-layout .tk-continue-card{min-height:195px;padding:19px 8px 18px 21px;grid-template-columns:minmax(0,1fr) 43%}
.tk-rp.tk-chat-layout .tk-continue-copy{gap:7px}
.tk-rp.tk-chat-layout .tk-continue-copy>strong{font-size:19px;line-height:1.5}
.tk-rp.tk-chat-layout .tk-continue-caption,.tk-rp.tk-chat-layout .tk-card-kicker{font-size:12px}
.tk-rp.tk-chat-layout .tk-welcome-scene{width:100%;min-height:120px;margin-right:0;margin-bottom:0}
.tk-rp.tk-chat-layout .tk-entry-stack{grid-template-columns:1fr 1fr;gap:10px}
.tk-rp.tk-chat-layout .tk-start-entry{display:grid;grid-template-columns:40px minmax(0,1fr);min-height:104px;padding:11px 12px 12px 8px;gap:4px 5px}
.tk-rp.tk-chat-layout .tk-entry-icon{grid-row:1;width:40px;height:40px}
.tk-rp.tk-chat-layout .tk-task-stamp{width:40px;height:40px}
.tk-rp.tk-chat-layout .tk-start-entry>span:not(.tk-entry-icon){display:contents}
.tk-rp.tk-chat-layout .tk-start-entry strong{grid-column:2;grid-row:1;font-size:13px;letter-spacing:0}
.tk-rp.tk-chat-layout .tk-start-entry small{grid-column:1/-1;grid-row:2;padding-left:4px;font-size:12px;line-height:1.65}
.tk-rp.tk-chat-layout .tk-start-entry>svg{display:none}
.tk-rp.tk-chat-layout .tk-recent-card{padding:14px 12px;min-height:110px;gap:9px}
.tk-rp.tk-chat-layout .tk-recent-card>.tk-story-cover{width:33px;height:45px}
.tk-rp.tk-chat-layout .tk-recent-card strong{font-size:13px;padding-right:0}
.tk-rp.tk-chat-layout .tk-recent-card small{flex-direction:row;flex-wrap:wrap;font-size:12px}
.tk-rp.tk-chat-layout .tk-chat-header{height:70px;padding:0 10px 0 5px}
.tk-rp.tk-chat-layout .tk-chat-title h1{font-size:16px}
.tk-rp.tk-chat-layout .tk-chat-title>span{font-size:12px}
.tk-rp.tk-chat-layout .tk-header-actions>.tk-icon-control{border:0;background:transparent;width:34px}
.tk-rp.tk-chat-layout .tk-workspace{margin:0}
.tk-rp.tk-chat-layout .tk-transcript{border-radius:0;box-shadow:none;border:0}
.tk-rp.tk-chat-layout .tk-transcript::before{inset:6px 7px 0;border-bottom:0;border-radius:0;opacity:.65}
.tk-rp.tk-chat-layout .tk-reading{padding:13px 18px 4px}
.tk-rp.tk-chat-layout .tk-reading-seal{margin-bottom:8px}
.tk-rp.tk-chat-layout .tk-reading-seal>.tk-tavern-emblem{width:26px;height:26px}
.tk-rp.tk-chat-layout .tk-message-body{margin-left:0}
.tk-rp.tk-chat-layout .tk-message>header{font-size:12px}
.tk-rp.tk-chat-layout .tk-reply-ordinal{font-size:12px}
.tk-rp.tk-chat-layout .tk-writing-dock{padding:7px 12px max(12px,env(safe-area-inset-bottom))}
.tk-rp.tk-chat-layout .tk-composer textarea{min-height:36px}
.tk-rp.tk-chat-layout .tk-composer-actions .tk-model-choice{font-size:12px;min-height:34px}
.tk-rp.tk-chat-layout .tk-roll-button{min-height:40px;font-size:12px}
.tk-rp.tk-chat-layout .tk-rp-dialog{border-radius:16px 16px 0 0}
}
@media(max-width:355px){.tk-rp.tk-chat-layout .tk-home-sign small{display:none}.tk-rp.tk-chat-layout .tk-start-entry{padding:10px 8px}.tk-rp.tk-chat-layout .tk-continue-copy>strong{font-size:17px}.tk-rp.tk-chat-layout .tk-home-heading h1{font-size:21px}.tk-rp.tk-chat-layout .tk-home-sign>span{font-size:14px}.tk-rp.tk-chat-layout .tk-home-sign .tk-tavern-emblem{width:25px;height:25px}}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout :is(button,input,textarea,select,summary,.tk-candidate-switch,.tk-composer,.tk-message-body,.tk-context-character,.tk-context-model,.tk-context-memo,.tk-context-player,.tk-conversation-search,.tk-menu-sheet,.tk-rp-dialog,.tk-story-cover,.tk-avatar,.tk-player-initial,.tk-speaker-mark,.tk-origin-label,.tk-home-footer,.tk-start-initial,.tk-chip,.tk-update,.tk-error,.tk-candidate-route,.tk-usage-summary){border-radius:0}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout :is(.tk-composer,.tk-context-character,.tk-context-model,.tk-context-player,.tk-context-memo,.tk-menu-sheet,.tk-rp-dialog,.tk-story-cover){border-width:2px;box-shadow:var(--tk-shadow,3px 3px 0 #0b1024)}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout :is(.tk-composer textarea,.tk-conversation-search input,.tk-candidate-number input){border:0;box-shadow:none;background:transparent}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-context-memo{border-top-width:4px}
:root[data-tk-skin=pixel] .tk-rp.tk-chat-layout .tk-transcript{box-shadow:3px 3px 0 #0b1024}
`;
