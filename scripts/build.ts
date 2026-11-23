import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { build, type Metafile, type Plugin } from 'esbuild';
import { generateHostArtifacts } from './generate-typert.js';
import { writeBundledNotices } from './third-party-notices.js';

export const workspaceRoot = resolve(import.meta.dirname, '..');
export const pluginDirectories = ['rp-materials', 'rp-connections', 'rp-chat', 'rp-deepseek-import', 'rp-appearance'] as const;
const bundledInputs = new Map<string, Set<string>>();
function recordBundledInputs(directory: string, metafile: Metafile): void {
  const inputs = bundledInputs.get(directory) ?? new Set<string>();
  for (const input of Object.keys(metafile.inputs)) inputs.add(input);
  bundledInputs.set(directory, inputs);
}
interface PackageManifest { name: string; exports: Record<string, string | { types?: string; default: string }> }
interface SourceMap { sources: string[]; sourceRoot?: string; mappings: string; [field: string]: unknown }

/** Lower standard decorators before bundling. Type checking remains a separate, mandatory pass. */
const standardDecorators: Plugin = {
  name: 'typescript-standard-decorators',
  setup(builder) {
    builder.onLoad({ filter: /\.[cm]?tsx?$/ }, async args => {
      if (args.path.endsWith('.d.ts')) return;
      const result = ts.transpileModule(await readFile(args.path, 'utf8'), {
        fileName: args.path,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2023,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.Preserve,
          useDefineForClassFields: true,
          experimentalDecorators: false,
          sourceMap: true,
          inlineSources: true,
        },
      });
      const errors = result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
      if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, diagnosticHost));
      const contents = result.outputText.replace(/\/\/# sourceMappingURL=.*\n?$/, '')
        + (result.sourceMapText ? `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(result.sourceMapText).toString('base64')}` : '');
      return { contents, loader: args.path.endsWith('x') ? 'jsx' : 'js', resolveDir: dirname(args.path) };
    });
  },
};

const inlineCss: Plugin = {
  name: 'inline-local-css',
  setup(builder) {
    builder.onResolve({ filter: /\.css\?inline$/ }, async args => {
      const result = await builder.resolve(args.path.slice(0, -'?inline'.length), { resolveDir: args.resolveDir, kind: args.kind });
      if (result.errors.length) return { errors: result.errors };
      return { path: relative(workspaceRoot, result.path).split(sep).join('/'), namespace: 'inline-css' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'inline-css' }, async args => ({ contents: await readFile(resolve(workspaceRoot, args.path), 'utf8'), loader: 'text' }));
  },
};

const diagnosticHost: ts.FormatDiagnosticsHost = {
  getCanonicalFileName: file => file,
  getCurrentDirectory: () => workspaceRoot,
  getNewLine: () => '\n',
};

function programFor(configName: string, overrides: ts.CompilerOptions = {}): ts.Program {
  const configPath = join(workspaceRoot, configName);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.formatDiagnosticsWithColorAndContext([config.error], diagnosticHost));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, workspaceRoot, undefined, configPath);
  if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, diagnosticHost));
  return ts.createProgram({ rootNames: parsed.fileNames, options: { ...parsed.options, ...overrides } });
}

/** A fresh semantic pass validates the actual sources, including Client wrappers and tests. */
export function typecheck(): void {
  const program = programFor('tsconfig.json', { noEmit: true });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost));
  console.log('TypeScript: strict source check passed');
}

/** Emit declarations from the checked source graph, preserving source-map navigation after relocation. */
export async function emitDeclarations(): Promise<void> {
  const program = programFor('tsconfig.declarations.json');
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, diagnosticHost));
  const writes: Promise<void>[] = [];
  const stagingRoot = join(workspaceRoot, '.build', 'declarations');
  const writeOutput: ts.WriteFileCallback = (output, contents) => {
    const local = relative(stagingRoot, output);
    const [directory, src, ...tail] = local.split(sep);
    if (directory === undefined || src !== 'src' || tail.length === 0 || local.startsWith('..')) throw new Error(`Unexpected declaration output: ${output}`);
    const target = join(workspaceRoot, 'packages', directory, 'lib', 'types', ...tail);
    if (output.endsWith('.d.ts.map')) {
      const map = JSON.parse(contents) as SourceMap;
      map.sources = map.sources.map(source => relative(dirname(target), resolve(dirname(output), map.sourceRoot ?? '', source)).split(sep).join('/'));
      map.sourceRoot = '';
      contents = JSON.stringify(map);
    }
    writes.push(mkdir(dirname(target), { recursive: true }).then(() => writeFile(target, contents)));
  };
  // JSON modules have no declarations: TypeScript marks the aggregate emit as skipped for them.
  // Emit every checked code source individually so a skipped declaration remains a build error.
  for (const source of program.getSourceFiles()) {
    if (source.isDeclarationFile || source.fileName.endsWith('.json') || program.isSourceFileFromExternalLibrary(source)) continue;
    const emitted = program.emit(source, writeOutput);
    if (emitted.emitSkipped || emitted.diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(emitted.diagnostics, diagnosticHost) || `TypeScript declaration emit was skipped: ${source.fileName}`);
  }
  await Promise.all(writes);
  console.log('TypeScript: declaration files and source maps emitted');
}

const hostRequire = createRequire(import.meta.url);
const bundledOfficialSources = new Set([
  '@deepseek-ai/dsh-deepseek-chat-import/src/archive.ts',
  '@deepseek-ai/dsh-deepseek-chat-import/src/conversation.ts',
  '@deepseek-ai/dsh-deepseek-chat-import/src/format.ts',
  '@deepseek-ai/dsh-llm-pi-ai/src/discovery.ts',
  '@deepseek-ai/dsh-llm-pi-ai/src/catalog.ts',
  '@deepseek-ai/dsh-llm-pi-ai/src/auth.ts',
]);
function bareExternal(request: string): boolean {
  if (bundledOfficialSources.has(request)) return false;
  return request.startsWith('@deepseek-ai/') || request.startsWith('@tavern-kit/') || request === 'cordis' || request.startsWith('cordis/');
}

/** Keep Host services supplied by DSH external. Pure Remote codec code is bundled just as in the official Client build. */
const clientFrameworkExternals: Plugin = {
  name: 'client-framework-externals',
  setup(builder) {
    builder.onResolve({ filter: /^(?:@deepseek-ai\/|cordis(?:\/|$))/ }, args => {
      if (args.path === '@deepseek-ai/dsh-typert-protocol/remote-info') return undefined;
      return { path: args.path, external: true };
    });
  },
};

export async function bundleHost(directory: string): Promise<void> {
  const packageRoot = join(workspaceRoot, 'packages', directory);
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as PackageManifest;
  const entries: Record<string, string> = { host: join(packageRoot, 'src', 'host.ts') };
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (subpath === '.' || subpath.startsWith('./client') || subpath === './typert' || subpath === './remote') continue;
    if (typeof target === 'string' || !target.types?.startsWith('./lib/types/')) continue;
    const name = target.types.slice('./lib/types/'.length, -'.d.ts'.length);
    const source = join(packageRoot, 'src', `${name}.ts`);
    if (existsSync(source)) entries[name] = source;
  }
  const result = await build({
    absWorkingDir: workspaceRoot,
    entryPoints: entries,
    outdir: join(packageRoot, 'lib'),
    platform: 'node',
    format: 'esm',
    target: 'node24',
    bundle: true,
    sourcemap: true,
    metafile: true,
    plugins: [standardDecorators, {
      name: 'host-public-package-boundaries',
      setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, args => {
          // These fixed pure helpers use their published declarations for checking, and real sources at runtime.
          if (bundledOfficialSources.has(args.path)) {
            const marker = args.path.indexOf('/src/');
            const manifest = hostRequire.resolve(`${args.path.slice(0, marker)}/package.json`);
            return { path: join(dirname(manifest), args.path.slice(marker + 1)) };
          }
          // Preserve package-local resources and YAML's native CommonJS built-in resolution.
          return args.path === 'css-tree' || args.path === 'yaml' || bareExternal(args.path) ? { path: args.path, external: true } : undefined;
        });
      },
    }],
    tsconfig: join(workspaceRoot, 'tsconfig.json'),
    logLevel: 'warning',
  });
  recordBundledInputs(directory, result.metafile);
  console.log(`Host: ${manifest.name}`);
}

/** Produce the lazy module format consumed by the existing DSH browser loader. */
export async function bundleClient(directory: string): Promise<void> {
  const packageRoot = join(workspaceRoot, 'packages', directory);
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as PackageManifest;
  const entry = ['client.tsx', 'client.ts'].map(file => join(packageRoot, 'src', file)).find(existsSync);
  if (!entry) throw new Error(`${manifest.name} has no Client source`);
  const result = await build({
    absWorkingDir: workspaceRoot,
    entryPoints: [entry],
    outfile: join(packageRoot, 'lib', 'client.js'),
    platform: 'browser',
    format: 'cjs',
    target: 'es2022',
    bundle: true,
    write: false,
    sourcemap: 'external',
    metafile: true,
    external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'zod', 'zod/*'],
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    inject: [join(workspaceRoot, 'scripts', 'react-shim.ts')],
    plugins: [inlineCss, clientFrameworkExternals, standardDecorators],
    loader: { '.woff2': 'dataurl', '.svg': 'dataurl' },
    tsconfig: join(workspaceRoot, 'tsconfig.json'),
    logLevel: 'warning',
  });
  const js = result.outputFiles.find(file => file.path.endsWith('.js'));
  const sourceMap = result.outputFiles.find(file => file.path.endsWith('.js.map'));
  if (!js || !sourceMap) throw new Error(`${manifest.name} Client did not emit JavaScript and a source map`);
  const prefix = `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(manifest.name)},\n  factory(require) {\n    const module = { exports: {} };\n    const exports = module.exports;\n`;
  const map = JSON.parse(sourceMap.text) as SourceMap;
  map.mappings = ';'.repeat(prefix.split('\n').length - 1) + map.mappings;
  await mkdir(join(packageRoot, 'lib'), { recursive: true });
  await writeFile(join(packageRoot, 'lib', 'client.js'), `${prefix}${js.text}\n    return module.exports;\n  },\n});\n//# sourceMappingURL=client.js.map\n`);
  await writeFile(join(packageRoot, 'lib', 'client.js.map'), JSON.stringify(map));
  const externals = [...new Set(Object.values(result.metafile.outputs).flatMap(output => output.imports.filter(item => item.external).map(item => item.path)))];
  const baseline = /^(?:react(?:\/.*)?|react-dom(?:\/.*)?|zod(?:\/.*)?|@deepseek-ai\/cordis|cordis)$/;
  const undeclared = externals.filter(name => !baseline.test(name));
  if (undeclared.length) throw new Error(`${manifest.name} imports non-baseline browser modules: ${undeclared.join(', ')}`);
  recordBundledInputs(directory, result.metafile);
  console.log(`Client: ${manifest.name} (host modules: ${externals.join(', ') || 'none'})`);
}

export async function bundlePublicClientEntries(directory: string): Promise<void> {
  const packageRoot = join(workspaceRoot, 'packages', directory);
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as PackageManifest;
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    if (!subpath.startsWith('./client/') || typeof target === 'string' || !target.types?.startsWith('./lib/types/')) continue;
    const name = target.types.slice('./lib/types/'.length, -'.d.ts'.length);
    const source = ['tsx', 'ts'].map(extension => join(packageRoot, 'src', `${name}.${extension}`)).find(existsSync);
    if (!source) throw new Error(`${manifest.name} export ${subpath} has no source`);
    const result = await build({
      absWorkingDir: workspaceRoot,
      entryPoints: [source],
      outfile: join(packageRoot, target.default),
      platform: 'browser', format: 'esm', target: 'es2022', bundle: true, sourcemap: true, metafile: true,
      external: ['react', 'react/*', 'react-dom', 'react-dom/*', 'zod', 'zod/*'],
      jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
      inject: [join(workspaceRoot, 'scripts', 'react-shim.ts')],
      plugins: [inlineCss, clientFrameworkExternals, standardDecorators],
      loader: { '.woff2': 'dataurl', '.svg': 'dataurl' },
      tsconfig: join(workspaceRoot, 'tsconfig.json'), logLevel: 'warning',
    });
    recordBundledInputs(directory, result.metafile);
  }
}

export async function buildWorkspace(): Promise<void> {
  bundledInputs.clear();
  generateHostArtifacts(workspaceRoot);
  typecheck();
  await emitDeclarations();
  for (const directory of pluginDirectories) await bundleHost(directory);
  for (const directory of pluginDirectories) {
    await bundlePublicClientEntries(directory);
    await bundleClient(directory);
    await writeBundledNotices(bundledInputs.get(directory) ?? [], join(workspaceRoot, 'packages', directory, 'lib', 'THIRD_PARTY_NOTICES.txt'), workspaceRoot);
  }
  console.log('Built five independent plugins and the configuration-only suite');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await buildWorkspace();
}
