import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const { createZip } = createRequire(import.meta.url)('./zip.cjs');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
function tree(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.posix.join(directory, entry.name);
    if (entry.name === 'generated') return [];
    return entry.isDirectory() ? tree(target) : [target];
  });
}
const runtime = ['main.js', 'manifest.json', 'styles.css', 'LICENSE', 'THIRD_PARTY_LICENSES.md', ...tree('licenses')];
const source = ['package.json', 'package-lock.json', '.npmrc', '.gitignore', 'eslint.config.mjs', 'manifest.json', 'versions.json', 'styles.css', 'LICENSE', 'THIRD_PARTY_LICENSES.md', 'README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md', ...tree('src'), ...tree('scripts'), ...tree('test'), ...tree('docs'), ...tree('licenses'), ...tree('.github')];
fs.mkdirSync('dist', { recursive: true });
for (const [kind, names] of [['plugin', runtime], ['source', source]]) {
  if (names.some(name => /(?:^|\/)(?:data\.json|sessions\.json|node_modules|\.local-backup|\.npm-cache)(?:\/|$)/.test(name))) throw new Error('Private or local files entered the package.');
  const filename = `dist/${manifest.id}-${kind}-${manifest.version}.zip`;
  fs.writeFileSync(filename, createZip([...new Set(names)].sort().map(name => ({ name, data: fs.readFileSync(name) }))));
  console.log(`Packaged ${filename}`);
}
const checksums = runtime.filter(file => !file.startsWith('licenses/')).map(file => `${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${file}`);
fs.writeFileSync('dist/SHA256SUMS.txt', checksums.join('\n') + '\n');
