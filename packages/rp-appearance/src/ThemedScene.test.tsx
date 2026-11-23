// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {act,cleanup,render} from '@testing-library/react';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {AppearanceClientStore} from './client-store.js';
import {AppearancePreferencesController,DEFAULT_APPEARANCE} from './preferences.js';
import {ThemeLibrary} from './theme-library.js';
import {base64ToBytes,bytesToBase64} from './theme.js';
import {ThemedScene} from './ThemedScene.js';
import type {AppearanceRemote} from './types.js';
const disposers:Array<()=>void>=[];
afterEach(()=>{cleanup();for(const dispose of disposers.splice(0))dispose();});
it.each(['classic','island','pixel'])('%s only places its illustration on home, leaving the chat for the transcript',async(skin)=>{
 const dir=mkdtempSync(join(tmpdir(),'tk-scene-'));const library=new ThemeLibrary(resolve('packages/rp-appearance/themes'),dir);
 let saved={...DEFAULT_APPEARANCE,skin};
 const preferences=new AppearancePreferencesController({read:()=>saved,write:async next=>{saved=next;}});
 const remote:AppearanceRemote={get:async()=>preferences.get(),update:patch=>preferences.update(patch),reset:()=>preferences.reset(),export:async()=>preferences.export(),listThemes:async()=>library.list(),getTheme:async id=>library.get(id),importTheme:async input=>library.importArchive(base64ToBytes(input.base64),input.overwrite),exportTheme:async id=>({filename:'theme.zip',mimeType:'application/zip',base64:bytesToBase64(library.exportTheme(id))})};
 const store=new AppearanceClientStore(remote,()=>{});disposers.push(()=>{store.dispose();rmSync(dir,{recursive:true,force:true});});
 await store.load();const view=render(<ThemedScene store={store} area="chat"/>);
 expect(view.container.childElementCount).toBe(0);
 view.rerender(<ThemedScene store={store} area="home"/>);expect(view.container.querySelector('img')).not.toBeNull();
 await act(async()=>{await store.update({scheme:'dark'});});expect(view.container.querySelector('img')).not.toBeNull();
});
