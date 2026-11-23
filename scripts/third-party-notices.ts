import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

/** Copy the original notice files of packages whose code or assets were bundled. */
export async function writeBundledNotices(inputFiles: Iterable<string>, outputFile: string, workspaceRoot: string): Promise<void> {
  const packages = new Map<string, { name: string; version: string }>();
  const folders = new Set<string>();
  for (const input of inputFiles) {
    const file = resolve(workspaceRoot, input.replace(/^inline-css:/, ''));
    if (!file.split(sep).includes('node_modules')) continue;
    let folder = dirname(file);
    if (folders.has(folder)) continue;
    folders.add(folder);
    for (;;) {
      if (packages.has(folder)) break;
      const manifest = join(folder, 'package.json');
      if (existsSync(manifest)) {
        const metadata: unknown = JSON.parse(await readFile(manifest, 'utf8'));
        if (typeof metadata === 'object' && metadata !== null
          && 'name' in metadata && typeof metadata.name === 'string'
          && 'version' in metadata && typeof metadata.version === 'string') {
          packages.set(folder, { name: metadata.name, version: metadata.version });
          break;
        }
      }
      const parent = dirname(folder);
      if (parent === folder) break;
      folder = parent;
    }
  }
  const notices = new Map<string, string>();
  for (const [folder, metadata] of packages) {
    const files = await readdir(folder, { withFileTypes: true });
    for (const file of files) {
      if ((!file.isFile() && !file.isSymbolicLink()) || !/^(?:licen[cs]e|copying|notice|ofl|copyright)/i.test(file.name)) continue;
      const key = `${metadata.name}@${metadata.version} / ${file.name}`;
      notices.set(key, await readFile(join(folder, file.name), 'utf8'));
    }
  }
  const contents = [...notices].sort(([left], [right]) => left.localeCompare(right))
    .map(([label, text]) => `${label}\n${'='.repeat(label.length)}\n${text}\n`).join('\n');
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, contents);
}
