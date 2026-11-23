import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';
import { applyEntryPatches, entryListSchema, type PatchOptions } from '@deepseek-ai/cordis-plugin-include';
import { workspaceRoot, pluginDirectories } from './build.js';

interface ExportTarget { types?: string; default: string }
interface Manifest {
  name: string; version: string; main?: string; types?: string;
  files: string[]; exports: Record<string, string | ExportTarget>;
  dependencies?: Record<string, string>;
  dsh: { bundle: { patch: string }; client?: { inject: string[] } };
}
interface ClientContribution { inject: string[]; apply: (ctx: unknown) => unknown }
interface LazyModule { id: string; factory: (require: (id: string) => unknown) => ClientContribution }
const require = createRequire(import.meta.url);
// Use the same parser and dialect that the installed Include package declares and uses.
const yaml = createRequire(import.meta.resolve('@deepseek-ai/cordis-plugin-include'))('js-yaml') as { load(text: string, options: { schema: unknown }): unknown };
const generated = ['typert.host.js', 'typert.host.d.ts', 'typert.remote-client.js', 'typert.remote-client.d.ts', 'typert.remote-client.d.ts.map'];
const browserModules = /^(?:react(?:\/.*)?|react-dom(?:\/.*)?|zod(?:\/.*)?)$/;
const clientServiceModules: Record<string, string> = {
  remote: '@deepseek-ai/dsh-api-remotes', slots: '@deepseek-ai/dsh-client-ui-slots',
  locale: '@deepseek-ai/dsh-client-locale', layout: '@deepseek-ai/dsh-client-ui-layout',
  theme: '@deepseek-ai/dsh-client-ui-theme', rpChatUi: '@tavern-kit/rp-chat',
};
function plain(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }

async function manifestFor(directory: string): Promise<Manifest> {
  return JSON.parse(await readFile(join(workspaceRoot, 'packages', directory, 'package.json'), 'utf8')) as Manifest;
}
function exportPaths(value: string | ExportTarget): string[] { return typeof value === 'string' ? [value] : [value.default, ...(value.types ? [value.types] : [])]; }
function expandExport(root: string, file: string): string[] {
  if (!file.includes('*')) return [file];
  const directory = dirname(file);
  const [prefix, suffix] = file.slice(directory.length + 1).split('*');
  return readdirSync(join(root, directory)).filter(name => name.startsWith(prefix ?? '') && name.endsWith(suffix ?? '')).map(name => `${directory}/${name}`);
}

/** Execute only the lazy registration and factory, never apply() or any user model operation. */
async function verifyClient(root: string, manifest: Manifest): Promise<void> {
  let registration: LazyModule | undefined;
  let count = 0;
  const javascript = await readFile(join(root, 'lib', 'client.js'), 'utf8');
  runInNewContext(javascript, { window: { __ModuleLoader__: { load(value: LazyModule) { count++; registration = value; } } } }, { filename: `${manifest.name}/client.js`, timeout: 1000 });
  assert.equal(count, 1, `${manifest.name}: Client registers one lazy module`);
  assert.ok(registration);
  assert.equal(registration.id, manifest.name);
  const loaded: string[] = [];
  const client = registration.factory(id => {
    assert.match(id, browserModules, `${manifest.name}: Client requested a non-baseline runtime module`);
    loaded.push(id);
    return require(id);
  });
  assert.equal(typeof client.apply, 'function');
  assert.ok(Array.isArray(client.inject));
  for (const service of client.inject) {
    const owner = clientServiceModules[service];
    assert.ok(owner && manifest.dsh.client?.inject.includes(owner), `${manifest.name}: Client service ${service} has no declared provider module`);
  }
  assert.ok(loaded.includes('zod'), `${manifest.name}: Remote schemas use host zod`);
  const remote = await import(pathToFileURL(join(root, 'lib', 'typert.remote-client.js')).href) as { TYPERT_REMOTE: { methods: Record<string, unknown> } };
  assert.ok(Object.keys(remote.TYPERT_REMOTE.methods).length > 0, `${manifest.name}: official generated Remote metadata is present`);
}

/** Inspect actual npm tarballs, including rewritten workspace dependencies and all declared entry points. */
async function verifyPack(directory: string, manifest: Manifest): Promise<void> {
  const root = join(workspaceRoot, 'packages', directory);
  const destination = join(workspaceRoot, '.build', 'packs', directory);
  await mkdir(destination, { recursive: true });
  const packed = spawnSync('pnpm', ['pack', '--pack-destination', destination], {
    cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_verify_deps_before_run: 'false' },
  });
  assert.equal(packed.status, 0, `${manifest.name}: pnpm pack failed\n${packed.stdout}\n${packed.stderr}`);
  const filename = `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`;
  const tarball = join(destination, filename);
  assert.ok(existsSync(tarball), `${manifest.name}: expected archive ${filename}`);
  const listed = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' });
  assert.equal(listed.status, 0, listed.stderr);
  const names = new Set(listed.stdout.trim().split('\n').map(file => file.replace(/^package\//, '')));
  assert.ok([...names].every(file => !/\.test\.[cm]?tsx?$/.test(file)), `${manifest.name}: packed test source`);
  const packedManifest = spawnSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' });
  assert.equal(packedManifest.status, 0, packedManifest.stderr);
  const metadata = JSON.parse(packedManifest.stdout) as Manifest;
  for (const entry of Object.values(metadata.exports).flatMap(exportPaths).flatMap(file => expandExport(root, file))) {
    assert.ok(names.has(entry.replace(/^\.\//, '')), `${manifest.name}: packed export is missing ${entry}`);
  }
  for (const entry of [metadata.dsh.bundle.patch, 'icon.svg', 'README.md', 'LICENSE', 'locale/zh-CN.json', 'locale/en.json', 'docs/DETAIL.md']) {
    assert.ok(names.has(entry.replace(/^\.\//, '')), `${manifest.name}: packed resource is missing ${entry}`);
  }
  assert.ok(!Object.values(metadata.dependencies ?? {}).some(value => value.startsWith('workspace:')), `${manifest.name}: workspace dependencies were not rewritten`);
  for (const name of names) {
    if (!name.endsWith('.d.ts.map')) continue;
    const extracted = spawnSync('tar', ['-xOzf', tarball, `package/${name}`], { encoding: 'utf8' });
    assert.equal(extracted.status, 0, extracted.stderr);
    const map = JSON.parse(extracted.stdout) as { sourceRoot?: string; sources: string[] };
    for (const source of map.sources) {
      const target = posix.normalize(posix.join(posix.dirname(name), map.sourceRoot ?? '', source));
      assert.ok(!isAbsolute(source) && names.has(target), `${manifest.name}: packed declaration map ${name} points outside the archive: ${source}`);
    }
  }
  if (directory !== 'suite') {
    for (const entry of generated) assert.ok(names.has(`lib/${entry}`), `${manifest.name}: missing packed ${entry}`);
    assert.ok(names.has('lib/THIRD_PARTY_NOTICES.txt'), `${manifest.name}: bundled third-party notices are missing`);
  }
  if (directory !== 'suite') assert.ok(names.has('SOURCES.md'), `${manifest.name}: source provenance is missing`);
  if (['rp-chat', 'rp-deepseek-import', 'rp-connections'].includes(directory)) assert.ok(names.has('DEEPSEEK-MIT.txt'), `${manifest.name}: official source license is missing`);
  if (directory === 'rp-appearance') assert.ok(names.has('NUNITO-OFL.txt'), `${manifest.name}: font provenance is missing`);
  if (directory === 'rp-connections') assert.ok(names.has('PI-AI-MIT.txt'), `${manifest.name}: fixed SDK source license is missing`);
  console.log(`Packed: ${relative(workspaceRoot, tarball)} (${names.size} files)`);
}

export async function verifyDistribution(pack = false): Promise<void> {
  const packageNames: string[] = [];
  for (const directory of [...pluginDirectories, 'suite']) {
    const root = join(workspaceRoot, 'packages', directory);
    const manifest = await manifestFor(directory);
    for (const entry of Object.values(manifest.exports).flatMap(exportPaths).flatMap(file => expandExport(root, file))) {
      assert.ok(existsSync(join(root, entry)), `${manifest.name}: export is missing ${entry}`);
    }
    for (const locale of ['zh-CN', 'en']) {
      const content: unknown = JSON.parse(await readFile(join(root, 'locale', `${locale}.json`), 'utf8'));
      assert.ok(plain(content) && plain(content.meta), `${manifest.name}: ${locale} must export official meta display fields`);
      for (const field of ['title', 'description', 'detail']) assert.ok(typeof content.meta[field] === 'string' && content.meta[field].trim().length > 0, `${manifest.name}: ${locale} meta.${field} is missing`);
    }
    const patch = yaml.load(await readFile(join(root, manifest.dsh.bundle.patch), 'utf8'), { schema: entryListSchema }) as PatchOptions[];
    const rows = applyEntryPatches([], patch, message => { throw new Error(message); });
    const expected = directory === 'suite' ? packageNames : [manifest.name];
    assert.deepEqual(rows.map(row => row.name).sort(), [...expected].sort(), `${manifest.name}: patch must activate each promised plugin once`);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length, `${manifest.name}: duplicate entry ids`);
    if (directory !== 'suite') {
      packageNames.push(manifest.name);
      assert.ok(manifest.files.includes('lib/THIRD_PARTY_NOTICES.txt'), `${manifest.name}: files must include bundled notices`);
      assert.ok((await readFile(join(root, 'lib', 'THIRD_PARTY_NOTICES.txt'), 'utf8')).trim().length > 0, `${manifest.name}: bundled notices are empty`);
      for (const entry of generated) {
        assert.ok(manifest.files.includes(`lib/${entry}`), `${manifest.name}: files must explicitly list ${entry}`);
        assert.ok(!(await readFile(join(root, 'lib', entry), 'utf8')).includes('@tavern-build/'), `${manifest.name}: build-only aliases must not leak into published contracts`);
      }
      const hostUrl = pathToFileURL(join(root, manifest.main!)).href;
      const nativeHost = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(hostUrl)})`], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
      assert.equal(nativeHost.status, 0, `${manifest.name}: Host must load in native Node without a TypeScript loader\n${nativeHost.stdout}\n${nativeHost.stderr}`);
      const host = await import(hostUrl) as Record<string, unknown>;
      assert.ok(typeof host.default === 'function' || plain(host.default), `${manifest.name}: Host entry must be loadable`);
      const typert = await import(pathToFileURL(join(root, 'lib', 'typert.host.js')).href) as { TYPERT: { invocations: readonly unknown[] } };
      assert.ok(typert.TYPERT.invocations.length > 0, `${manifest.name}: strict Host Remote artifact is populated`);
      const bundledFiles = (await readdir(join(root, 'lib'))).filter(file => /\.js(?:\.map)?$/.test(file));
      for (const file of bundledFiles) {
        const content = await readFile(join(root, 'lib', file), 'utf8');
        assert.ok(!content.replaceAll('\\\\', '/').replaceAll('\\', '/').includes(`${workspaceRoot.replaceAll('\\', '/')}/`), `${manifest.name}: ${file} contains a checkout path`);
        if (file.endsWith('.map')) {
          const map = JSON.parse(content) as { sourceRoot?: string; sources: string[] };
          for (const source of [map.sourceRoot ?? '', ...map.sources]) {
            assert.ok(!/^(?:[a-z]+:)?(?:[/\\]|[A-Za-z]:[/\\])/i.test(source), `${manifest.name}: ${file} contains an absolute source path`);
          }
        }
      }
      await verifyClient(root, manifest);
      const types = await readFile(join(root, manifest.types!), 'utf8');
      assert.ok(types.includes('declare class') || types.includes('class ') || types.includes('export declare'), `${manifest.name}: declarations must come from source`);
      const mapFile = `${join(root, manifest.types!)}.map`;
      const map = JSON.parse(await readFile(mapFile, 'utf8')) as { sources: string[] };
      for (const source of map.sources) assert.ok(!isAbsolute(source) && existsSync(resolve(dirname(mapFile), source)), `${manifest.name}: declaration map points to missing source ${source}`);
    } else {
      assert.equal(manifest.main, undefined, 'suite is configuration-only');
      assert.equal(manifest.dsh.client, undefined, 'suite must not register an extra Client');
    }
    if (pack) await verifyPack(directory, manifest);
    console.log(`Verified: ${manifest.name}`);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifyDistribution(process.argv.includes('--pack'));
}
