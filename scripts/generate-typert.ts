import { resolve, dirname, relative } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { WorkspaceTypertGenerator, writeWorkspaceArtifacts } from '@deepseek-ai/dsh-typert-generator';

/** Preserve official protocol types while supplying the module identity expected by this generator version. */
function prepareProtocolIdentity(root: string): void {
  const require = createRequire(import.meta.url);
  const manifestFile = require.resolve('@deepseek-ai/dsh-typert-protocol/package.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as { types: string };
  const config = JSON.parse(readFileSync(resolve(root, 'tsconfig.json'), 'utf8')) as { compilerOptions: { paths: Record<string, string[]> } };
  const output = resolve(root, '.build', 'typert');
  mkdirSync(output, { recursive: true });
  writeFileSync(resolve(output, 'protocol.d.ts'), readFileSync(resolve(root, 'scripts', 'typert-protocol.template'), 'utf8'));
  writeFileSync(resolve(root, '.build', 'typert-host.json'), JSON.stringify({ compilerOptions: { paths: {
    ...config.compilerOptions.paths,
    '@deepseek-ai/dsh-typert-protocol': [relative(root, resolve(output, 'protocol.d.ts'))],
    '@tavern-build/official-typert': [relative(root, resolve(dirname(manifestFile), manifest.types))],
  } } }, null, 2) + '\n');
}

/** Generate the public Host/Remote contracts from source, never from last build's declarations. */
export function generateHostArtifacts(root: string): void {
  prepareProtocolIdentity(root);
  const generator = new WorkspaceTypertGenerator(root, { checkDiagnostics: true, rejectBuildOutputs: true });
  const artifacts = generator.generateContributors(['host']);
  if (artifacts.length !== 5 || artifacts.some(artifact => artifact.remote === undefined)) {
    throw new Error(`Expected the five Host services to publish Remote contracts; generated ${artifacts.length}`);
  }
  writeWorkspaceArtifacts(root, artifacts);
  for (const artifact of artifacts) console.log(`Typert: ${artifact.package} (${artifact.face})`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  generateHostArtifacts(resolve(import.meta.dirname, '..'));
}
