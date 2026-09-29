const { createHash } = require('node:crypto');
const { TFile } = require('obsidian');
const hash = text => createHash('sha256').update(text).digest('hex');
const validPath = path => typeof path === 'string' && path.length <= 4000 && !/[\\:]/.test(path) && ![...path].some(char => char.charCodeAt(0) < 32) && !path.startsWith('/') && path.split('/').every(part => part && part !== '.' && part !== '..');
const inside = (path, folder) => validPath(path) && path.startsWith(folder + '/') && path.endsWith('.md');
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function loadJobs(raw) {
  const jobs = new Map();
  for (const item of (Array.isArray(raw) ? raw.slice(0, 20) : [])) {
    if (!item || !hex(item.id) || !hex(item.fingerprint) || typeof item.key !== 'string' || item.key.length > 4096 || !validPath(item.folder) || typeof item.question !== 'string' || item.question.length > 8000 || typeof item.answer !== 'string' || item.answer.length > 64000 || !['transcript', 'queued', 'requesting', 'classified', 'prepared', 'paused'].includes(item.stage)) continue;
    const meta = {};
    for (const name of ['source', 'transcriptPath']) if (validPath(item.meta?.[name]) && (name === 'source' || item.meta[name].endsWith('.md'))) meta[name] = item.meta[name];
    for (const name of ['activity', 'topic']) if (typeof item.meta?.[name] === 'string') meta[name] = item.meta[name].slice(0, 300);
    const job = { id: item.id, key: item.key, fingerprint: item.fingerprint, question: item.question, answer: item.answer, folder: item.folder, meta, force: item.force === true, stage: item.stage, error: typeof item.error === 'string' ? item.error.slice(0, 600) : '' };
    for (const name of ['userId', 'conversationId']) if (typeof item[name] === 'string' && item[name].length <= 128) job[name] = item[name];
    if (job.stage === 'transcript' && !job.userId) continue;
    if (item.plan && inside(item.plan.path, job.folder) && typeof item.plan.title === 'string' && item.plan.title.length <= 300 && typeof item.plan.summary === 'string' && item.plan.summary.length <= 64000) job.plan = { path: item.plan.path, title: item.plan.title, summary: item.plan.summary, reason: String(item.plan.reason || '').slice(0, 600), inbox: item.plan.inbox === true, existing: item.plan.existing === true };
    const p = item.prepared;
    if (p && job.plan && p.path === job.plan.path && inside(p.path, job.folder) && hex(p.beforeHash) && hex(p.afterHash) && hex(p.blockHash) && Number.isSafeInteger(p.start) && p.start >= 0 && p.start <= 32 * 1024 * 1024 && typeof p.block === 'string' && p.block.length <= 80000 && hash(p.block) === p.blockHash && (p.exists === true || typeof p.newContent === 'string' && p.newContent.length <= 90000 && hash(p.newContent) === p.afterHash)) job.prepared = { path: p.path, exists: p.exists === true, beforeHash: p.beforeHash, afterHash: p.afterHash, blockHash: p.blockHash, start: p.start, block: p.block, ...(p.newContent ? { newContent: p.newContent } : {}) };
    if (['classified', 'prepared'].includes(job.stage) && !job.plan || job.stage === 'prepared' && !job.prepared) job.stage = 'paused';
    jobs.set(job.id, job);
  }
  return jobs;
}
async function readTarget(vault, path) {
  const file = vault.getAbstractFileByPath(path);
  if (!file) return { file: null, text: '' };
  if (!(file instanceof TFile)) throw Error('Archive destination is a folder.');
  if (file.stat?.size > 32 * 1024 * 1024) throw Error('Knowledge note exceeds 32 MB.');
  return { file, text: await (vault.read ? vault.read(file) : vault.cachedRead(file)) };
}
async function commitPrepared(vault, prepared, check) {
  const { file, text } = await readTarget(vault, prepared.path);
  check();
  if (file && (hash(text) === prepared.afterHash || hash(text.slice(prepared.start, prepared.start + prepared.block.length)) === prepared.blockHash)) return;
  if (hash(text) !== prepared.beforeHash || Boolean(file) !== prepared.exists) throw Error('Knowledge note changed before writing. Retry to append without replacing your edits.');
  if (file) await vault.process(file, current => { check(); if (hash(current) !== prepared.beforeHash) throw Error('Knowledge note changed while writing; retry.'); return current + prepared.block; });
  else { check(); await vault.create(prepared.path, prepared.newContent); }
}
module.exports = { hash, validPath, inside, hex, loadJobs, readTarget, commitPrepared };
