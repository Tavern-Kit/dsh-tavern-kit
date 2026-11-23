import React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-connection/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-theme/client';
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-settings/types';
import appearanceRemote from '../lib/typert.remote-client.js';
import { AppearanceClientStore } from './client-store.js';
import { AppearancePanel, AppearancePanelIcon } from './AppearancePanel.js';
import { ThemedScene } from './ThemedScene.js';
import { installAppearance } from './runtime.js';
import { APPEARANCE_SETTINGS_NAMESPACE } from './preferences.js';
import { en, zh, type AppearanceLocaleKey } from './locales.js';
import type { AppearanceRemote } from './types.js';

export const NS = 'tkAppearance';
export const PANEL_ID = 'tk-appearance' as MainPanelId;
export const inject = ['slots', 'locale', 'layout', 'theme', 'remote'];
export interface RpAppearanceUi {
  open(): void;
  renderScene(area: 'home' | 'chat'): React.ReactNode;
}
declare module '@deepseek-ai/cordis' { interface Context { rpAppearanceUi: RpAppearanceUi } }
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { tkAppearance: AppearanceLocaleKey } }

/** The owner alone mounts its strict Remote contribution and its presentation resources. */
export async function apply(ctx: Context): Promise<void> {
  const releaseRemote = await ctx.remote.$mount(appearanceRemote);
  ctx.effect(() => releaseRemote);
  ctx.inject(['remote.rpAppearance'], scope => {
    scope.effect(() => scope.locale.register(NS, { zh, en }));
    const t = scope.locale.bind(NS);
    const installation = installAppearance(document, scope.theme);
    scope.effect(() => () => installation.dispose());
    const remote: AppearanceRemote = {
      async get() { const result = await scope.remote.rpAppearance.get(); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async update(patch) { const result = await scope.remote.rpAppearance.update(patch); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async reset() { const result = await scope.remote.rpAppearance.reset(); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async export() { const result = await scope.remote.rpAppearance.export(); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async listThemes() { const result = await scope.remote.rpAppearance.listThemes(); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async getTheme(id) { const result = await scope.remote.rpAppearance.getTheme(id); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async importTheme(input) { const result = await scope.remote.rpAppearance.importTheme(input); if (!result.ok) throw new Error(result.error.message); return result.value; },
      async exportTheme(id) { const result = await scope.remote.rpAppearance.exportTheme(id); if (!result.ok) throw new Error(result.error.message); return result.value; },
    };
    const store = new AppearanceClientStore(remote, (preferences, theme) => installation.update(preferences, theme));
    scope.effect(() => () => store.dispose());
    scope.effect(() => scope.remote.$on('settings/document-updated', (namespace: string) => { if (namespace === APPEARANCE_SETTINGS_NAMESPACE) void store.load(); }));
    scope.effect(() => scope.on('connection/reset', () => { void store.load(); }));
    scope.effect(() => scope.slots.inject('main', () => scope.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ store, t }) }, AppearancePanel)));
    scope.effect(() => scope.slots.inject('sidebar.panellist', () => scope.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 45, label: () => t('panel'), locale: NS }, AppearancePanelIcon)));
    scope.provide('rpAppearanceUi', { open: () => scope.layout.selectPanel(PANEL_ID), renderScene: area => <ThemedScene store={store} area={area} /> });
    void store.load();
  });
}
