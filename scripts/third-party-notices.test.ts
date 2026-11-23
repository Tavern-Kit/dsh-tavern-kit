import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { writeBundledNotices } from './third-party-notices.js';

test('collects original notices once from all bundled inputs, including virtual CSS and font assets', async () => {
  const fixtures = resolve(import.meta.dirname, '..', '.build');
  await mkdir(fixtures, { recursive: true });
  const root = await mkdtemp(join(fixtures, 'notices-test-'));
  const host = join(root, 'node_modules', '@fixture', 'host');
  const visual = join(root, 'node_modules', '@fixture', 'visual');
  const unused = join(root, 'node_modules', '@fixture', 'unused');
  for (const [folder, name] of [[host, 'host'], [visual, 'visual'], [unused, 'unused']] as const) {
    await mkdir(join(folder, 'dist'), { recursive: true });
    await writeFile(join(folder, 'package.json'), JSON.stringify({ name: `@fixture/${name}`, version: '1.0.0' }));
  }
  const license = 'Copyright (c) Host Author\nPermission is hereby granted, free of charge.\n';
  const copying = 'COPYING original terms\nAll copyright lines retained.\n';
  const font = 'SIL OPEN FONT LICENSE Version 1.1\nCopyright Visual Author\n';
  await writeFile(join(host, 'LICENSE'), license);
  await writeFile(join(host, 'COPYING'), copying);
  await writeFile(join(visual, 'OFL.txt'), font);
  await writeFile(join(unused, 'NOTICE'), 'Not included in the build');
  const output = join(root, 'lib', 'THIRD_PARTY_NOTICES.txt');
  await writeBundledNotices([
    join(host, 'dist', 'first.js'), join(host, 'dist', 'second.js'),
    `inline-css:${join(visual, 'dist', 'style.css')}`, join(visual, 'dist', 'font.woff2'),
    join(root, 'packages', 'own', 'src', 'index.ts'),
  ], output, root);
  const text = await readFile(output, 'utf8');
  assert.ok(text.includes(license));
  assert.ok(text.includes(copying));
  assert.ok(text.includes(font));
  assert.equal(text.split(license).length - 1, 1);
  assert.ok(!text.includes('Not included in the build'));
  assert.ok(!text.includes(root));
});
