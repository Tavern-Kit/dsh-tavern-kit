// Reproducible MIT vendor extraction. Does not install, run, or modify the reference project.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { transform } from 'esbuild';
const source = new URL('../../../../references/xi4u/', import.meta.url);
const target = new URL('./vendor/', import.meta.url);
const revision = '336d2a38ed8c170a4599493f1bc20c6c1ef7962c';
if (execFileSync('git', ['-C', fileURLToPath(source), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== revision) throw new Error('xi4u reference revision changed');
function replace(text, before, after) {
  before = before.replace(/^ +/, '');
  if (text.split(before).length !== 2) throw new Error(`Expected exactly one source boundary: ${before.slice(0, 90)}`);
  return text.replace(before, after);
}
function section(text, first, last, value) {
  first = first.replace(/^ +/, ''); last = last.replace(/^ +/, '');
  const start = text.indexOf(first), end = text.indexOf(last, start);
  if (start < 0 || end < start) throw new Error(`Missing source section: ${first}`);
  return text.slice(0, start) + value + text.slice(end);
}
function adaptWorld(text) {
  for (const line of [
    "import {createSceneTransition} from './scene-transition';\n",
    "import {createWeatherCycle} from './weather-cycle';\n",
    "import {createDaylightTransition} from './daylight-transition';\n",
    'declare const __MINITOOL__: boolean;\n',
  ]) text = replace(text, line, '');
  text = replace(text, "import * as T from 'three';", "import * as T from 'three';\nimport {disposeGardenResources} from '../resources.js';");
  text = section(text, 'export function createWorld(', '  const rr=', `export function createWorld(host,options={}){
 const resources=new Set(),releases=[];let disposed=false;
 const own=release=>releases.push(release);
 function dispose(){if(disposed)return;disposed=true;for(const release of releases.reverse()){try{release();}catch{/* Complete the remaining GPU cleanup even if one driver fails. */}}releases.length=0;}
 try{
 const gardenClock=createGardenClock();
 const state={season:options.season,night:options.scheme==='dark',weather:'clear',paused:false,sound:false,pixelated:false,renderStyle:'clear'};
 gardenClock.setSeason(state.season);gardenClock.setHour(state.night?22:12);gardenClock.setRunning(false);
 let clockSnapshot=gardenClock.getSnapshot();
 let seed=29417;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
`);
  text = replace(text, "  const state={season:'summer',night:false,weather:'clear',paused:false,sound:false,pixelated:false,renderStyle:'clear'};\n", '');
  text = replace(text, '  const scene=new T.Scene();scene.background=null;', `  const scene=new T.Scene();scene.background=null;own(()=>disposeGardenResources(scene,resources));const previousBackground=host.style.getPropertyValue('--xi4u-background'),previousPriority=host.style.getPropertyPriority('--xi4u-background');own(()=>previousBackground?host.style.setProperty('--xi4u-background',previousBackground,previousPriority):host.style.removeProperty('--xi4u-background'));`);
  text = replace(text, "const renderer=new T.WebGLRenderer({antialias:false,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});", "const renderer=options.createRenderer?.()??new T.WebGLRenderer({antialias:false,alpha:true,premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'default'});\n own(()=>{try{renderer.renderLists?.dispose();renderer.dispose();}finally{try{renderer.forceContextLoss();}finally{renderer.domElement.remove();}}});");
  text = text.replaceAll('__MINITOOL__?1:2', '2').replaceAll('__MINITOOL__?1024:4096', '2048');
  text = replace(text, '  const pixelRenderer=createPixelRenderer(renderer,scene,camera);', '  const controlsRoot=renderer.domElement.getRootNode();own(()=>{controlsRoot.removeEventListener(\'keyup\',controls._interceptControlUp,true);controls.dispose();});\n  const changed=()=>options.onInvalidate?.();controls.addEventListener(\'change\',changed);own(()=>controls.removeEventListener(\'change\',changed));\n  const pixelRenderer=(options.createPixelRenderer??createPixelRenderer)(renderer,scene,camera);own(()=>pixelRenderer.dispose());');
  text = replace(text, '  const sceneTransition=createSceneTransition({host,canvas:renderer.domElement});\n', '');
  text = replace(text, '  const resources=new Set();const animations=[];const snowCaps=[];const rockMoss=[];const lanterns=[];const seasonal=[];', '  const animations=[];const snowCaps=[];const rockMoss=[];const lanterns=[];const seasonal=[];');
  text = replace(text, '  sun.shadow.autoUpdate=false;', '  sun.shadow.autoUpdate=false;own(()=>sun.shadow.dispose());');
  text = replace(text, "  const celestial=createCelestialBodies(scene,camera);", "  const celestial=createCelestialBodies(scene,camera);");
  text = section(text, '  let time=0,nightMix=0,last=', '  let currentSeason=', `  let time=0,nightMix=state.night?1:0;const themeColors=Object.fromEntries(Object.entries(gardenTheme).map(([key,tone])=>[key,{day:new T.Color(tone.day),night:new T.Color(tone.night)}]));const targetBg=new T.Color(gardenTheme[state.season].day);let cloudMix=0,summerClosedMix=0,precipitationMix=0;
`);
  text = section(text, '  const framing=createPortraitFraming', ' const wind= gardenWind(time)', `  const framing=createPortraitFraming(camera,controls,collectGardenFramePoints(root));
  function resize(w,h){if(disposed||w<=0||h<=0)return;renderer.setSize(w,h);pixelRenderer.resize(w,h);rainEffect.resize(w,h);framing.resize(w,h);camera.clearViewOffset();}
  function render(deltaSeconds=0){if(disposed)return;
  const dt=Number.isFinite(deltaSeconds)?Math.max(0,Math.min(deltaSeconds,.045)):0;
  const d=state.paused?0:dt;time+=d;controls.update();
  clockSnapshot=gardenClock.getSnapshot();
  if(state.season!==currentSeason)applySeason();
  root.userData.gardenTime=clockSnapshot;
`);
  text = replace(text, 'if(seeking||d&&Math.floor(time*15)!==Math.floor((time-d)*15))', 'if(d&&Math.floor(time*15)!==Math.floor((time-d)*15))');
  text = section(text, '  const closedSummer=', 'shadowMat.opacity=', `  const closedSummer=state.season==='summer'&&state.night;summerClosedMix=closedSummer?1:0;const cloudy=state.weather!=='clear';const palette=themeColors[state.season];cloudMix=cloudy?1:0;targetBg.copy(state.night?palette.night:palette.day);host.style.setProperty('--xi4u-background',targetBg.getStyle());`);
  text = replace(text, '  pixelRenderer.render();sceneTransition.update(dt);', '  pixelRenderer.render();');
  text = section(text, '  frame=requestAnimationFrame(animate);', '\n}', `  return {scene,camera,element:renderer.domElement,getTime:()=>gardenClock.getSnapshot(),
  update(next){if(disposed)return;const season=GARDEN_SEASONS.includes(next.season)?next.season:state.season;const night=next.scheme==='dark';
   gardenClock.setSeason(season);gardenClock.setHour(night?22:12);gardenClock.setRunning(false);clockSnapshot=gardenClock.getSnapshot();
   Object.assign(state,{season,night,weather:'clear',renderStyle:'clear',pixelated:false});applySeason();renderer.shadowMap.needsUpdate=true;
  },resize,render,setInteractive(enabled){controls.enabled=enabled;},dispose};
 }catch(error){dispose();throw error;}`);
  return text;
}
await mkdir(target, { recursive: true });
for (const name of (await readdir(new URL('app/', source))).filter(name => name.endsWith('.ts')).sort()) {
  let text = await readFile(new URL(`app/${name}`, source), 'utf8');
  if (name === 'world.ts') text = adaptWorld(text);
  if (name === 'portrait-framing.ts') {
    text = section(text, '   const left=phone?', '   const usableW=', '   const left=8,rightMargin=8,top=8,bottom=8;\n');
    text = replace(text, '   const preferredY=phone?h*.52:(top+h-bottom)*.5;', '   const preferredY=h*.5;');
  }
  text = text.replace(/(from\s+['"])(\.\/[^'"]+)(['"])/g, '$1$2.js$3');
  const result = await transform(text, { loader: 'ts', format: 'esm', target: 'es2022', legalComments: 'none', sourcefile: name });
  const header = `/* SPDX-License-Identifier: MIT\n * Copyright (c) 2026 AC.\n * Source: https://github.com/annac777/xi4u @ ${revision}, app/${name}\n * Reproducible typed-syntax removal and documented local integration edits: ../sync-vendor.mjs, ../README.md.\n */\n`;
  await writeFile(new URL(name.replace(/\.ts$/, '.js'), target), header + result.code);
}
await writeFile(new URL('./LICENSE', import.meta.url), await readFile(new URL('LICENSE', source), 'utf8'));
console.log('Vendored 31 original MIT garden modules at ' + revision);
