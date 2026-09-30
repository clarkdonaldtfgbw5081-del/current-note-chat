const { scopedFiles, terms } = require('./knowledge-routing');
const { MEMORY_MAX_ENTRIES, MEMORY_MAX_CHARS, MEMORY_HITS_CAP, MEMORY_NOTE_READS, MEMORY_NOTE_CHARS, MEMORY_SNIPPET_CHARS } = require('./constants');

// Hindsight-inspired local recall: knowledge notes plus past questions form the
// memory body; every ordinary question recalls a few related snippets as prompt
// background. Everything is local — no service, no extra requests.
function scoreText(haystack, words) {
  return words.reduce((sum, word) => sum + (haystack.includes(word) ? word.length >= 4 ? 2 : 1 : 0), 0);
}
function aliasesOf(metadataCache, file) {
  const raw = metadataCache?.getFileCache?.(file)?.frontmatter?.aliases;
  return (Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []).filter(alias => typeof alias === 'string').slice(0, 12).join(' ');
}
function bestSnippet(body, words, limit = MEMORY_SNIPPET_CHARS) {
  const paragraphs = String(body || '').split(/\n{2,}/).map(paragraph => paragraph.replace(/\s+/g, ' ').trim()).filter(paragraph => paragraph.length > 8);
  let best = null;
  for (const paragraph of paragraphs) {
    const score = scoreText(paragraph.toLowerCase(), words);
    if (score > 0 && (!best || score > best.score)) best = { score, text: paragraph };
  }
  return best ? best.text.slice(0, limit) : null;
}
/**
 * Recall up to MEMORY_MAX_ENTRIES related memories for a question.
 * Stage one scores knowledge-note names (no file reads); stage two reads only
 * the top names to extract a matching snippet. Past user questions from other
 * conversations are scored in memory and carry their answer's opening.
 */
async function recallMemories({ vault, metadataCache, folder, threads, hits = new Map(), readNote, excludeMessageId }, question) {
  const words = terms(question);
  if (!words.length) return [];
  const read = typeof readNote === 'function' ? readNote : async file => (vault.read ? vault.read(file) : vault.cachedRead(file));
  const entries = [];
  const notes = scopedFiles(vault, folder).filter(file => !/(?:^|\/)(?:Inbox|待整理)\.md$/i.test(file.path));
  for (const file of notes) {
    const title = file.basename || file.path.split('/').at(-1).slice(0, -3);
    const name = `${title} ${aliasesOf(metadataCache, file)}`.toLowerCase();
    const relevance = scoreText(name, words);
    if (relevance >= 2) entries.push({ key: file.path, kind: 'note', title, path: file.path, file, base: relevance + Math.min(5, hits.get(file.path) || 0), snippet: '' });
  }
  entries.sort((a, b) => b.base - a.base);
  const deepRead = entries.slice(0, MEMORY_NOTE_READS);
  for (const entry of deepRead) {
    try {
      const body = String(await read(entry.file) || '').slice(0, MEMORY_NOTE_CHARS);
      const snippet = bestSnippet(body, words);
      if (snippet) { entry.snippet = snippet; entry.base += 3 + scoreText(snippet.toLowerCase(), words); }
    } catch { /* Unreadable notes stay as title-only candidates. */ }
  }
  for (const [key, thread] of threads || []) {
    if (!Array.isArray(thread)) continue;
    for (let index = 0; index < thread.length; index++) {
      const message = thread[index];
      if (message?.role !== 'user' || !message.text?.trim() || message.error || message.id === excludeMessageId) continue;
      const text = message.text.trim();
      const relevance = scoreText(text.toLowerCase(), words);
      if (relevance < 4) continue;
      const reply = thread.slice(index + 1).find(item => item.role === 'assistant' && item.replyTo === message.id && !item.error && !item.streaming && item.text?.trim());
      if (!reply) continue;
      const base = relevance + Math.min(5, hits.get(`thread:${key}:${message.id}`) || 0);
      entries.push({ key: `thread:${key}:${message.id}`, kind: 'thread', title: text.split('\n')[0].slice(0, 80), source: key, base, snippet: `${text.slice(0, 200)}\n→ ${reply.text.trim().slice(0, 300)}` });
    }
  }
  const chosen = [];
  let size = 0;
  const usedKeys = new Set();
  for (const entry of entries.sort((a, b) => b.base - a.base)) {
    if (chosen.length >= MEMORY_MAX_ENTRIES || size >= MEMORY_MAX_CHARS) break;
    if (usedKeys.has(entry.key) || !entry.snippet) continue;
    usedKeys.add(entry.key);
    const text = entry.snippet.slice(0, MEMORY_SNIPPET_CHARS);
    if (size + text.length > MEMORY_MAX_CHARS) continue;
    size += text.length;
    chosen.push({ key: entry.key, kind: entry.kind, title: entry.title, path: entry.path || null, snippet: text });
  }
  return chosen;
}
function memoryBlock(entries) {
  if (!entries?.length) return '';
  const lines = entries.map(entry => `- ${entry.kind === 'note' ? 'Knowledge note' : 'Earlier question'}${entry.path ? ` (${entry.path})` : ''}: ${entry.title}\n  ${entry.snippet.replace(/\n/g, ' ')}`);
  return [
    'Related memories below were auto-recalled from this vault (your earlier questions and knowledge notes). They are background only and may be incomplete or outdated; the attached file or screenshot remains the authoritative source for factual answers.',
    lines.join('\n')
  ].join('\n\n');
}
function loadHits(raw) {
  const hits = new Map();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return hits;
  for (const [key, value] of Object.entries(raw).slice(-MEMORY_HITS_CAP)) {
    if (typeof key === 'string' && key.length <= 4096 && Number.isSafeInteger(value) && value > 0 && value <= 99) hits.set(key, Math.floor(value));
  }
  return hits;
}
function serializeHits(hits) {
  return Object.fromEntries([...(hits || [])].slice(-MEMORY_HITS_CAP).filter(([, value]) => value > 0));
}
/** Reinforce recalled memories after a successful answer (bounded, never overwrites). */
function reinforce(hits, entries) {
  for (const entry of entries || []) {
    if (!entry?.key || typeof entry.key !== 'string') continue;
    hits.set(entry.key, Math.min(99, (hits.get(entry.key) || 0) + 1));
  }
  while (hits.size > MEMORY_HITS_CAP) hits.delete(hits.keys().next().value);
  return hits;
}

module.exports = { recallMemories, memoryBlock, loadHits, serializeHits, reinforce, bestSnippet };
