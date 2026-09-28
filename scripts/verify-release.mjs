import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const versions = JSON.parse(fs.readFileSync('versions.json', 'utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(pkg.version, manifest.version, 'Package and manifest versions must match.');
assert.equal(versions[manifest.version], manifest.minAppVersion);
assert.equal(manifest.isDesktopOnly, true);
assert.match(manifest.name, /^[A-Za-z0-9 +()-]+$/, 'Community directory names use Basic Latin and limited punctuation.');
assert(!/(?:obsidian|plugin)/i.test(manifest.name), 'The display name must not contain Obsidian or Plugin.');
assert(manifest.description.length <= 250 && manifest.description.endsWith('.'));
assert(!manifest.id.includes('obsidian'));
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, manifest.version, 'The tag must exactly match manifest.version.');
for (const file of ['main.js', 'styles.css', 'LICENSE', 'README.md', 'package-lock.json']) assert(fs.statSync(file).size > 0, `Missing ${file}`);
execFileSync(process.execPath, ['--check', 'main.js']);
const bundle = fs.readFileSync('main.js', 'utf8');
assert(bundle.includes('data:text/javascript;base64,'), 'The worker must be loaded from embedded source.');
assert(bundle.includes('Mozilla Foundation') && bundle.includes('word-extractor@'), 'Bundled notices must survive the build.');
const meta = JSON.parse(fs.readFileSync('dist/build-meta.json', 'utf8'));
assert(Object.keys(meta.inputs).includes('src/generated/pdf-worker.js'), 'Missing embedded worker module.');
for (const output of Object.values(meta.outputs)) for (const imported of output.imports) {
  assert(!['@napi-rs/canvas', 'pdf-parse', 'word-extractor', 'pdfjs-dist'].includes(imported.path), `Unbundled runtime dependency: ${imported.path}`);
}
console.log('Release manifest, versions, syntax, worker packaging and dependency notices verified.');
