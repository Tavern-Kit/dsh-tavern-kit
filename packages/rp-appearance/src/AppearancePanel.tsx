import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { AppearanceClientStore } from './client-store.js';
import type { AppearanceBackground, AppearancePatch, AppearanceScheme, AppearanceSeason, AppearanceSkin, ThemeSummary } from './types.js';
import type { AppearanceTranslate } from './locales.js';
import { base64ToBytes, bytesToBase64 } from './theme.js';

export interface AppearancePanelProps { store: AppearanceClientStore; t: AppearanceTranslate }
function download(filename: string, mimeType: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes.byteLength); copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type: mimeType }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function fileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件没有读完'));
    reader.onload = () => reader.result instanceof ArrayBuffer ? resolve(new Uint8Array(reader.result)) : reject(new Error('文件没有读完'));
    reader.readAsArrayBuffer(file);
  });
}
function SmallIcon({ name, skin }: { name: 'download' | 'reset' | 'check' | 'reading' | 'letter'; skin?: AppearanceSkin }): React.JSX.Element {
  const pixel = {
    download: 'M10 2h4v10h4v2h-2v2h-2v2h-4v-2H8v-2H6v-2h4ZM4 18h2v2h12v-2h2v4H4Z',
    reset: 'M8 2h8v2h4v4h2v10h-2v4H8v-2H4v-4h4v2h10v-2h2V8h-2V6H8v2h4v2H2V0h2v6h2V4h2Z',
    check: 'M4 10h4v4h2v2h2v-4h2v-2h2V8h2V6h4v4h-2v2h-2v2h-2v2h-2v4h-4v-2H6v-2H4Z',
    reading: 'M2 4h20v4h-8v12h4v2H6v-2h4V8H2ZM4 14h2v6H4Zm14 0h2v6h-2Z',
    letter: 'M2 6h20v16H2Zm4 4H4v10h16V10h-2v2h-2v2h-2v2h-4v-2H8v-2H6Zm2-6h8V2H8Z',
  };
  const paths = { download: 'M12 3v11m-4-4 4 4 4-4M5 15v5h14v-5', reset: 'M4 9a8 8 0 1 1 0 6m0-12v6h6', check: 'm6 12 4 4 8-8', reading: 'M5 5h14M8 5v14m8-14v14M5 19h6m2 0h6', letter: 'M4 6h16v13H4Zm0 0 8 7 8-7M8 3h8' };
  return skin === 'pixel'
    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" shapeRendering="crispEdges" aria-hidden="true"><path d={pixel[name]} /></svg>
    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function ThemeThumbnail({ theme }: { theme: ThemeSummary }): React.JSX.Element {
  return <span className={`tk-theme-thumbnail tk-theme-thumbnail-${theme.id}`} aria-hidden="true"><span className="tk-thumbnail-rail"><i /><i /><i /></span><img src={theme.previewDataUrl} alt="" draggable={false} /><span className="tk-thumbnail-caption"><i /><i /><span /></span></span>;
}
export function AppearancePanel({ store, t }: AppearancePanelProps): React.JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const preferences = state.preferences;
  const [fontSize, setFontSize] = useState(preferences?.fontSize ?? 17);
  const [readingWidth, setReadingWidth] = useState(preferences?.readingWidth ?? 680);
  useEffect(() => { if (preferences) { setFontSize(preferences.fontSize); setReadingWidth(preferences.readingWidth); } }, [preferences]);
  const update = (patch: AppearancePatch): void => { void store.update(patch); };
  const exportPreferences = async (): Promise<void> => { const file = await store.export(); if (file) download(file.filename, file.mimeType, new TextEncoder().encode(file.text)); };
  const exportTheme = async (): Promise<void> => { if (!preferences) return; const file = await store.exportTheme(preferences.skin); if (file) download(file.filename, file.mimeType, base64ToBytes(file.base64)); };
  const importTheme = async (file?: File): Promise<void> => {
    if (!file) return;
    try { await store.importArchive({ filename: file.name, base64: bytesToBase64(await fileBytes(file)) }); }
    catch { store.error(t('themeReadError')); }
  };
  const chooseImage = (file?: File): void => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { store.error(t('imageError')); return; }
    if (file.size > 6 * 1024 * 1024) { store.error(t('imageTooLarge')); return; }
    const reader = new FileReader(); reader.onerror = () => store.error(t('readError'));
    reader.onload = () => { if (typeof reader.result === 'string') update({ background: 'custom', backgroundImage: reader.result }); else store.error(t('readError')); };
    reader.readAsDataURL(file);
  };
  if (!preferences) return <section className="tk-rp tk-appearance"><div className="tk-settings tk-loading" aria-busy="true"><header className="tk-settings-header" data-tk-page-heading><div className="tk-settings-identity"><span className="tk-settings-mark"><AppearancePanelIcon /></span><h1>{t('panel')}</h1></div><span className="tk-inline-status">{t('loading')}</span></header>{state.error ? <div className="tk-error tk-error-actions"><span role="alert">{state.error}</span><button className="tk-button" onClick={() => { void store.load(); }}>{t('retry')}</button></div> : <div className="tk-loading-strip" aria-hidden="true" />}</div></section>;
  const activeTheme = state.themes.find(theme => theme.id === preferences.skin);
  const commitSize = (): void => { if (fontSize !== preferences.fontSize) update({ fontSize }); };
  const commitWidth = (): void => { if (readingWidth !== preferences.readingWidth) update({ readingWidth }); };
  return <section className="tk-rp tk-appearance"><div className="tk-settings">
    <header className="tk-settings-header" data-tk-page-heading><div className="tk-settings-identity"><span className="tk-settings-mark"><AppearancePanelIcon /></span><div><h1>{t('panel')}</h1></div></div><div className="tk-settings-actions"><span className="tk-inline-status" aria-live="polite" aria-busy={state.pending}><span className="tk-save-indicator" aria-hidden="true" />{t(state.pending ? 'saving' : 'saved')}</span><button className="tk-button tk-button-quiet" disabled={state.pending} onClick={() => { void store.reset(); }}><SmallIcon skin={preferences.skin} name="reset" />{t('reset')}</button></div></header>
    {state.error && <div className="tk-error" role="alert">{state.error}</div>}
    {state.pendingImport && <section className="tk-theme-confirm" role="alertdialog" aria-labelledby="tk-overwrite-title"><img src={state.pendingImport.previewDataUrl} alt="" /><div><h2 id="tk-overwrite-title">{t('overwriteTitle')}</h2><strong>{state.pendingImport.name}</strong><p>{state.pendingImport.version} · {t('author')} {state.pendingImport.author}</p><p>{t('overwriteHint')}</p><div className="tk-settings-actions"><button className="tk-button" disabled={state.pending} onClick={() => { void store.confirmImport(); }}>{t('overwrite')}</button><button className="tk-button tk-button-quiet" onClick={() => store.cancelImport()}>{t('cancel')}</button></div></div></section>}
    <section className="tk-template-section" aria-labelledby="tk-template-title"><div className="tk-section-heading"><div className="tk-section-identity"><h2 id="tk-template-title">{t('title')}</h2></div><div className="tk-settings-actions tk-theme-file-actions"><label className="tk-file-control tk-button"><SmallIcon name="letter" skin={preferences.skin} />{t('importTheme')}<input type="file" accept=".zip,application/zip" aria-label={t('themeFile')} disabled={state.pending} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importTheme(file); }} /></label><button className="tk-button" onClick={() => { void exportTheme(); }}><SmallIcon skin={preferences.skin} name="download" />{t('exportTheme')}</button></div></div><div className="tk-skin-grid">{state.themes.map(theme => <button key={theme.id} type="button" className="tk-skin-tile" aria-label={theme.name} aria-pressed={preferences.skin === theme.id} disabled={state.pending} onClick={() => update({ skin: theme.id })}><ThemeThumbnail theme={theme} /><span className="tk-skin-tile-footer"><span className="tk-skin-label"><strong>{theme.name}</strong><span>{theme.description}</span><small>{t(theme.builtin ? 'builtin' : 'imported')} · {theme.version} · {theme.author}</small></span><span className="tk-template-selection"><span className="tk-theme-check" aria-hidden="true"><SmallIcon skin={preferences.skin} name="check" /></span><span>{t(preferences.skin === theme.id ? 'selected' : 'choose')}</span></span></span></button>)}</div><section className="tk-theme-modes"><div><span id="tk-scheme-label" className="tk-setting-label">{t('scheme')}</span><div className="tk-segmented" role="group" aria-labelledby="tk-scheme-label">{(['system', 'light', 'dark'] as const).map((scheme: AppearanceScheme) => <button key={scheme} aria-pressed={preferences.scheme === scheme} disabled={state.pending} onClick={() => update({ scheme })}>{t(scheme)}</button>)}</div></div>{activeTheme && activeTheme.seasons.length > 0 && <div><span id="tk-season-label" className="tk-setting-label">{t('season')}</span><div className="tk-segmented tk-season-controls" role="group" aria-labelledby="tk-season-label">{activeTheme.seasons.map((season: AppearanceSeason) => <button key={season} aria-pressed={preferences.season === season} disabled={state.pending} onClick={() => update({ season })}>{t(season)}</button>)}</div></div>}</section></section>
    <div className="tk-settings-body"><section className="tk-controls" aria-labelledby="tk-reading-title"><h2 id="tk-reading-title" className="tk-controls-title"><SmallIcon skin={preferences.skin} name="reading" />{t('reading')}</h2><div className="tk-range-grid"><div className="tk-range-setting"><div className="tk-range-heading"><label htmlFor="tk-font-size">{t('fontSize')}</label><output htmlFor="tk-font-size">{fontSize} {t('px')}</output></div><input id="tk-font-size" type="range" min={12} max={30} value={fontSize} disabled={state.pending} onChange={event => setFontSize(Number(event.target.value))} onPointerUp={commitSize} onKeyUp={commitSize} onBlur={commitSize} /><p>{t('fontSizeHint')}</p></div><div className="tk-range-setting"><div className="tk-range-heading"><label htmlFor="tk-reading-width">{t('readingWidth')}</label><output htmlFor="tk-reading-width">{readingWidth}</output></div><input id="tk-reading-width" type="range" min={480} max={1440} step={20} value={readingWidth} disabled={state.pending} onChange={event => setReadingWidth(Number(event.target.value))} onPointerUp={commitWidth} onKeyUp={commitWidth} onBlur={commitWidth} /><p>{t('readingWidthHint')}</p></div></div>
      <div className="tk-setting-row"><label id="tk-bubbles-label">{t('bubbles')}<small>{t('bubblesHint')}</small></label><div className="tk-setting-value tk-setting-toggle"><span>{t(preferences.bubbles ? 'on' : 'off')}</span><button className="tk-switch" type="button" role="switch" aria-labelledby="tk-bubbles-label" aria-checked={preferences.bubbles} disabled={state.pending} onClick={() => update({ bubbles: !preferences.bubbles })}><span aria-hidden="true" /></button></div></div>
      <div className="tk-background-setting"><div className="tk-background-heading"><span id="tk-background-label" className="tk-setting-label">{t('background')}</span><span className="tk-inline-status">{t(preferences.background)}</span></div><div className="tk-segmented" role="group" aria-labelledby="tk-background-label">{(['plain', 'illustrated', 'custom'] as const).map((background: AppearanceBackground) => <button type="button" key={background} aria-pressed={preferences.background === background} disabled={state.pending} onClick={() => update({ background })}>{t(background)}</button>)}</div></div>
      {preferences.background === 'custom' && <div className="tk-custom-background"><div className="tk-setting-row"><label htmlFor="tk-background-color">{t('backgroundColor')}</label><span className="tk-color-value"><span>{preferences.backgroundColor.toUpperCase()}</span><input id="tk-background-color" type="color" aria-label={t('backgroundColor')} value={preferences.backgroundColor} disabled={state.pending} onChange={event => update({ backgroundColor: event.target.value })} /></span></div><div className="tk-image-actions"><label className="tk-file-control tk-button" htmlFor="tk-background-image"><SmallIcon skin={preferences.skin} name="letter" />{t('pickImage')}<input id="tk-background-image" aria-label={t('chooseFile')} type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={state.pending} onChange={event => { chooseImage(event.target.files?.[0]); event.target.value = ''; }} /></label>{preferences.backgroundImage !== null && <><span className="tk-inline-status">{t('imageReady')}</span><button className="tk-button tk-button-quiet" disabled={state.pending} onClick={() => update({ backgroundImage: null })}>{t('removeImage')}</button></>}</div></div>}
      <div className="tk-preferences-export"><button className="tk-button tk-button-quiet" onClick={() => { void exportPreferences(); }}><SmallIcon skin={preferences.skin} name="download" />{t('export')}</button><span>{activeTheme?.author} · {activeTheme?.license}</span></div>
    </section><aside className="tk-preview-card"><div className="tk-preview-header"><div><h2 id="tk-reading-preview-title">{t('preview')}</h2><span>{activeTheme?.name}</span></div><span className="tk-letter-mark">{activeTheme && <img src={activeTheme.previewDataUrl} alt="" draggable={false} />}</span></div><article className="tk-reading-preview" aria-labelledby="tk-reading-preview-title" style={{ fontSize }} data-bubbles={preferences.bubbles ? 'on' : 'off'}><span className="tk-sample-byline"><span className="tk-sample-avatar">{t('sampleName').slice(0, 1)}</span>{t('sampleName')}</span><p>{t('sampleLine')}</p><span className="tk-preview-answer">{t('samplePlayer')}</span><p>{t('sampleReply')}</p></article><div className="tk-preview-caption"><SmallIcon skin={preferences.skin} name="check" />{t('previewCaption')}</div></aside></div>
  </div></section>;
}
export function AppearancePanelIcon(): React.JSX.Element { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 18c7 0 13-6 13-13C9 5 4 11 5 18Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 20 15 10m-6 6v-4m0 4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>; }
