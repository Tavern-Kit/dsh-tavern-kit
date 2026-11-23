import React, { useId } from 'react';
import type { Xi4uAppearance } from './types.js';

const seasons = {
  spring: { label: '春', light: '#f0dedf', dark: '#2b2530', leaf: '#df9cb5', soft: '#fbe1e8' },
  summer: { label: '夏', light: '#dce8de', dark: '#172c2b', leaf: '#329b79', soft: '#79bf65' },
  autumn: { label: '秋', light: '#efe0cf', dark: '#302820', leaf: '#d27544', soft: '#f2cc76' },
  winter: { label: '冬', light: '#dce7ed', dark: '#152633', leaf: '#eef4ef', soft: '#d9e7e7' },
} as const;

/** Offline error/loading illustration only; a successful scene always uses the original 3D garden. */
export function StaticGarden({ season, scheme }: Xi4uAppearance): React.ReactElement {
  const id = useId().replaceAll(':', '');
  const palette = seasons[season], night = scheme === 'dark';
  return <svg className="tk-xi4u-still" viewBox="0 0 440 280" role="img" aria-label={`${palette.label}日静态庭院`}>
    <defs>
      <linearGradient id={`${id}-water`} x2="1" y2="1"><stop stopColor={night ? '#4b6b88' : '#77b9b3'} /><stop offset="1" stopColor={night ? '#304858' : '#bdd8d0'} /></linearGradient>
    </defs>
    <rect width="440" height="280" fill={night ? palette.dark : palette.light} />
    <path d="M35 192 123 154 312 163 408 210 294 263 110 249Z" fill={night ? '#445549' : '#a6bb8f'} stroke="#586052" strokeWidth="2" />
    <path d="M224 171C177 196 262 206 221 225L177 256 243 263C273 238 312 218 293 199L264 174Z" fill={`url(#${id}-water)`} />
    <g stroke="#574b40" strokeWidth="2" strokeLinejoin="round">
      <path d="m91 151 90-36 143 51-90 35Z" fill="#a68059" />
      <path d="m101 136 91-38 120 43v40l-94 33-117-43Z" fill={night ? '#8e8466' : '#ebdfb8'} />
      <path d="m89 133 100-49 145 48-100 43Z" fill={night ? '#42656b' : '#60928e'} />
      <path d="m89 133 145 42 100-43" fill="none" stroke="#335f64" strokeWidth="5" />
      <path d="m111 139 107 34v38m26-39v31m31-44v33m29-44v33m-86-8 94-33m-94 21 94-34m-71 12v39m24-47v38m23-46v38" fill="none" stroke="#795c42" strokeWidth="2" />
      <path d="m98 172 120 40 108-39v11l-107 39-121-40Z" fill="#b78b5d" />
      <path d="m211 225 71-32 25 11-71 33Z" fill="#b5a17c" />
      <path d="m219 222 24 10m-8-17 24 11m-8-18 24 11m-8-18 24 11" fill="none" />
    </g>
    <path d="M94 210c12-40 3-71 14-99l3-54m-6 71-37-29-16-29m53 42 42-30 9-34m-47 56-13-32" fill="none" stroke={night ? '#665344' : '#795a42'} strokeWidth="12" strokeLinecap="round" />
    <g fill={palette.leaf} stroke={night ? '#665e62' : '#a38c85'} strokeWidth="1.5">
      <path d="m31 59 19-25 35-6 26 13 22-12 32 12 15 27-13 27-37 5-28-13-33 11-31-11Z" />
      <path d="m100 38 17-22 32 6 19 16-12 25-30 5Z" fill={palette.soft} />
      <path d="m147 75 20-17 26 4 18 17-8 17-33 7Z" fill={palette.soft} />
    </g>
    <path d="m341 194 19-6 8 7-20 7Z" fill="#879484" />
    <path d="M352 192v-19m-9 0h18l-3-12h-12Z" fill={night ? '#e5b96e' : '#d9d6ba'} stroke="#6b7669" strokeWidth="3" />
    {season === 'winter' && <g fill="#edf4f2"><path d="m90 129 99-49 140 48-12 3-127-40-88 44Z" /><path d="m45 52 16-19 26-2 21 10-3 5-28-8-20 20Z" /></g>}
    {season === 'spring' && <g fill="#f8d9df"><circle cx="77" cy="64" r="5" /><circle cx="135" cy="40" r="5" /><circle cx="157" cy="79" r="4" /><path d="m133 205 9 3-5 5-7-3Z" /></g>}
    {season === 'summer' && <g fill="#7da665" stroke="#47785e"><ellipse cx="255" cy="229" rx="12" ry="5" /><ellipse cx="274" cy="215" rx="10" ry="4" /></g>}
    {season === 'autumn' && <g fill="#dfaa60"><path d="m126 224 8-5 6 7-9 4Zm22 8 8-4 4 6-9 3Z" /><circle cx="300" cy="169" r="4" /></g>}
    {night && <path d="M359 38a18 18 0 0 0 20 25 19 19 0 1 1-20-25Z" fill="#dce7db" />}
  </svg>;
}
