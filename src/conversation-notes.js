const { randomUUID, createHash } = require('node:crypto');
const { TFile, normalizePath } = require('obsidian');
const { L } = require('./i18n');
const { safeFolder } = require('./note-path');
const { MAX_SESSION_KEYS } = require('./constants');
const { normalizeMathDelimiters } = require('./prompts');

function noteSaveMode(settings) {
  return ['conversation', 'answer', 'off'].includes(settings.noteSaveMode) ? settings.noteSaveMode : settings.saveQA === false ? 'off' : 'conversation';
}
function digest(text) { return createHash('sha256').update(text).digest('hex'); }
function validNotePath(path) {
  return typeof path === 'string' && path.length <= 4000 && path.endsWith('.md') && !/[\\:]/.test(path) && ![...path].some(char => char.charCodeAt(0) < 32) && !path.startsWith('/') && path.split('/').every(part => part && !['.', '..'].includes(part));
}
function loadNoteRecords(raw) {
  const records = new Map();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return records;
  for (const [key, item] of Object.entries(raw).slice(-MAX_SESSION_KEYS)) {
    if (!key || key.length > 4096 || !item || !/^[0-9a-f-]{36}$/i.test(item.id) || (item.path !== null && !validNotePath(item.path)) || typeof item.created !== 'string' || !Number.isFinite(Date.parse(item.created))) continue;
    const hashes = Object.fromEntries(Object.entries(item.hashes || {}).slice(-160).filter(([id, value]) => /^[a-f0-9]{64}$/.test(id) && typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)));
    const ranges = Object.fromEntries(Object.entries(item.ranges || {}).slice(-160).filter(([id, range]) => Object.hasOwn(hashes, id) && range && Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start >= 0 && range.end > range.start && range.end <= 32 * 1024 * 1024 && range.hash === hashes[id]).map(([id, range]) => [id, { start: range.start, end: range.end, hash: range.hash }]));
    records.set(key, { id: item.id, path: item.path, created: new Date(item.created).toISOString(), hashes, ranges, clean: item.clean === true });
  }
  return records;
}
function safeBody(text) {
  // Content from a source or model cannot forge the markers that delimit owned blocks.
  return String(text)
    .replace(/<!--\s*current-note-chat:/gi, '&lt;!-- current-note-chat:')
    .replace(/%%\s*current-note-chat:/gi, '&#37;&#37; current-note-chat:')
    .replace(/^(\s*)\[cnc-(conversation|message|end)-/gim, '$1&#91;cnc-$2-');
}
function noteBody(text) { return safeBody(normalizeMathDelimiters(String(text))); }
// Unused link reference definitions are invisible in standard Markdown renderers,
// including renderers that do not implement Obsidian's %% comments.
function marker(kind, id) { return `[cnc-${kind}-${id}]: #`; }
function migrateLegacyMarkers(content) {
  const migrated = content.replace(/(?:<!--\s*current-note-chat:(conversation|message|end):([0-9a-f-]+)\s*-->|%%\s*current-note-chat:(conversation|message|end):([0-9a-f-]+)\s*%%)/gi, (_, htmlKind, htmlId, kind, id) => marker((kind || htmlKind).toLowerCase(), (id || htmlId).toLowerCase()));
  // Definitions must be separate blocks, especially after a question callout.
  const lines = migrated.split('\n'), result = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^\[cnc-(?:conversation|message|end)-[0-9a-f-]+\]: #\r?$/.test(lines[i])) {
      if (result.length && result.at(-1).trim()) result.push('');
      result.push(lines[i]);
      if (i + 1 < lines.length && lines[i + 1].trim()) result.push('');
    } else result.push(lines[i]);
  }
  return result.join('\n');
}
function styleNote(content) {
  const front = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n)/.exec(content);
  if (!front || /^cssclasses:/m.test(front[0])) return content;
  return content.replace(/^---\r?\n/, '---\ncssclasses:\n  - current-note-chat-note\n');
}
function answerBody(text) {
  // Keep model headings subordinate to the note title; never change fenced code.
  let fence = null;
  return noteBody(text).split('\n').map(line => {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (match) {
      if (!fence) fence = match[1];
      else if (match[1][0] === fence[0] && match[1].length >= fence.length && /^ {0,3}(?:`+|~+)\s*$/.test(line)) fence = null;
      return line;
    }
    return fence ? line : line.replace(/^ {0,3}#{1,2}(?=\s)/, '###');
  }).join('\n');
}
function callout(type, title, body) {
  const quoted = noteBody(body).split('\n').map(line => `> ${line}`).join('\n');
  return `> [!${type}] ${title}\n${quoted}`;
}
function formatNoteMessage(message, activity = 'qa') {
  if (message.error) return `${callout('warning', L('回答未完成', 'Incomplete response'), message.text)}\n`;
  if (message.role === 'user') return `${callout('question', activity === 'feynman' ? L('我的解释 / 作答', 'My explanation / answer') : L('提问', 'Question'), message.text)}\n`;
  const label = activity === 'feynman' ? L('AI 学习反馈', 'AI learning feedback') : L('AI 解答', 'AI answer');
  return `**${label}**\n\n${answerBody(message.text)}\n`;
}
function blocksFor(thread, summary, activity = 'qa') {
  const blocks = new Map();
  for (const message of thread) {
    if (message.streaming || !message.text?.trim()) continue;
    const id = digest(message.role === 'assistant' && message.replyTo ? `assistant:${message.replyTo}` : `${message.role}:${message.id}`);
    blocks.set(id, formatNoteMessage(message, activity));
  }
  if (summary) blocks.set(digest('learning-summary'), noteBody(summary) + '\n');
  return blocks;
}
function cleanLegacyNote(content, record) {
  const migrated = migrateLegacyMarkers(content);
  if (!migrated.includes(marker('conversation', record.id))) return { content, ranges: record.ranges || {} };
  const front = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n)/.exec(migrated);
  const text = front ? migrated.replace(front[0], front[0].replace(/^conversation_id:.*\r?\n/gm, '')) : migrated;
  const tokens = /^\[cnc-(conversation|message|end)-([0-9a-f-]+)\]: #\r?(?:\n|$)/gm;
  let clean = '', cursor = 0, active = null;
  const ranges = {};
  for (const token of text.matchAll(tokens)) {
    clean += text.slice(cursor, token.index);
    cursor = token.index + token[0].length;
    if (token[1] === 'message') active = { id: token[2], start: clean.length };
    else if (token[1] === 'end' && active?.id === token[2]) {
      const raw = clean.slice(active.start);
      const candidates = [raw, raw.replace(/^\r?\n/, ''), raw.replace(/^(?:\r?\n){1,2}/, '')].flatMap(body => [body, body.replace(/(?:\r?\n){2}$/, '\n')]);
      const body = candidates.find(candidate => digest(candidate) === record.hashes[active.id]);
      if (body) {
        const start = active.start + raw.indexOf(body);
        ranges[active.id] = { start, end: start + body.length, hash: digest(body) };
      }
      active = null;
    }
  }
  clean += text.slice(cursor);
  return { content: clean, ranges };
}
function mergeBlocks(content, blocks, record) {
  let merged = content;
  const hashes = { ...record.hashes }, ranges = { ...record.ranges };
  // Positions and hashes live in plugin data, never in the generated Markdown.
  // If the user edits or shifts a saved block, leave it alone rather than guess
  // which paragraph to overwrite. New turns can still be appended safely.
  for (const [id, range] of Object.entries(ranges)) {
    if (digest(merged.slice(range.start, range.end)) !== range.hash) delete ranges[id];
  }
  for (const [id, body] of blocks) {
    const nextHash = digest(body);
    if (hashes[id] === nextHash) continue;
    const range = ranges[id];
    if (range) {
      const delta = body.length - (range.end - range.start);
      merged = merged.slice(0, range.start) + body + merged.slice(range.end);
      for (const [otherId, other] of Object.entries(ranges)) {
        if (otherId !== id && other.start >= range.end) ranges[otherId] = { ...other, start: other.start + delta, end: other.end + delta };
      }
      ranges[id] = { start: range.start, end: range.start + body.length, hash: nextHash };
    } else {
      if (Object.hasOwn(hashes, id)) continue;
      const start = merged.length + (merged.endsWith('\n\n') ? 0 : merged.endsWith('\n') ? 1 : 2);
      merged += '\n'.repeat(start - merged.length) + body;
      ranges[id] = { start, end: start + body.length, hash: nextHash };
    }
    hashes[id] = nextHash;
  }
  const retained = Object.fromEntries(Object.entries(hashes).slice(-160));
  return { content: merged, hashes: retained, ranges: Object.fromEntries(Object.entries(ranges).filter(([id]) => Object.hasOwn(retained, id))) };
}
class OwnershipError extends Error {}
class ConversationNotes {
  constructor(plugin, raw) {
    this.plugin = plugin; this.records = loadNoteRecords(raw); this.chain = Promise.resolve();
  }
  serialize() { return Object.fromEntries(loadNoteRecords(Object.fromEntries(this.records))); }
  forget(key) { this.records.delete(key); }
  moveKey(oldKey, newKey) {
    if (!this.records.has(oldKey)) return;
    this.records.set(newKey, this.records.get(oldKey)); this.records.delete(oldKey);
  }
  renameNote(oldPath, newPath) {
    for (const record of this.records.values()) {
      if (record.path === oldPath) record.path = newPath;
      else if (record.path?.startsWith(oldPath + '/')) record.path = newPath + record.path.slice(oldPath.length);
    }
  }
  deleteNote(path) {
    for (const record of this.records.values()) if (record.path === path || record.path?.startsWith(path + '/')) { record.path = null; record.hashes = {}; record.ranges = {}; record.clean = false; }
  }
  save(key, thread, meta = {}) {
    if (this.plugin.disposed || noteSaveMode(this.plugin.settings) !== 'conversation' || !key || !thread.some(message => message.role === 'user' && message.text.trim())) return Promise.resolve(null);
    let record = this.records.get(key);
    if (!record) record = { id: randomUUID(), path: null, created: new Date().toISOString(), hashes: {} };
    this.records.delete(key); this.records.set(key, record);
    while (this.records.size > MAX_SESSION_KEYS) this.records.delete(this.records.keys().next().value);
    // Capture the turn before the UI changes or trims in-memory history.
    const snapshot = { blocks: blocksFor(thread, meta.summary, meta.activity), title: thread.find(message => message.role === 'user').text, meta: { ...meta }, folder: this.plugin.settings.qaFolder };
    const task = this.chain.catch(() => {}).then(() => this.write(record, snapshot));
    this.chain = task;
    return task;
  }
  async write(record, snapshot) {
    if (this.plugin.disposed) return null;
    const vault = this.plugin.app.vault;
    let result;
    let file = record.path ? vault.getAbstractFileByPath(record.path) : null;
    if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
      try {
        await vault.process(file, content => {
          const migrated = migrateLegacyMarkers(content);
          const front = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n)/.exec(content)?.[0] || '';
          if (!migrated.includes(marker('conversation', record.id)) && !(record.clean && /^type: conversation\r?$/m.test(front))) throw new OwnershipError('The note is no longer a conversation note.');
          const legacy = cleanLegacyNote(content, record);
          // Insert styles before calculating offsets so positions remain exact.
          const styled = styleNote(legacy.content), shift = styled.length - legacy.content.length;
          const ranges = Object.fromEntries(Object.entries(legacy.ranges).map(([id, range]) => [id, { ...range, start: range.start + shift, end: range.end + shift }]));
          result = mergeBlocks(styled, snapshot.blocks, { hashes: record.hashes, ranges });
          return result.content;
        });
      } catch (error) {
        if (!(error instanceof OwnershipError)) throw error;
        file = null;
      }
    } else file = null;
    if (!file) {
      const folder = safeFolder(snapshot.folder, normalizePath, L('AI 问答', 'AI Q&A'));
      if (!vault.getAbstractFileByPath(folder)) {
        try { await vault.createFolder(folder); } catch (error) { if (!vault.getAbstractFileByPath(folder)) throw error; }
      }
      if (this.plugin.disposed) return null;
      const title = snapshot.title.split(/[\r\n]+/)[0].replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40).replace(/[.\s]+$/, '') || L('未命名对话', 'Untitled chat');
      const stamp = record.created.slice(0, 19).replace(/[T:]/g, '-');
      const base = `${folder}/${stamp} ${title} ${record.id.slice(0, 8)}`;
      let path = `${base}.md`, suffix = 2;
      while (vault.getAbstractFileByPath(path)) path = `${base} (${suffix++}).md`;
      const frontmatter = ['---', `date: ${record.created}`, 'type: conversation', `mode: ${snapshot.meta.mode === 'screen' ? 'screen' : 'file'}`, `activity: ${snapshot.meta.activity === 'feynman' ? 'feynman' : 'qa'}`, ...(snapshot.meta.source ? [`source: ${JSON.stringify(snapshot.meta.source)}`] : []), ...(snapshot.meta.model ? [`model: ${JSON.stringify(snapshot.meta.model)}`] : []), '---', '', `# ${safeBody(title)}`, ''].join('\n');
      result = mergeBlocks(styleNote(frontmatter), snapshot.blocks, { hashes: {}, ranges: {} });
      await vault.create(path, result.content);
      record.path = path; record.hashes = {};
    }
    record.hashes = result.hashes; record.ranges = result.ranges; record.clean = true;
    this.plugin.queueSaveSessions();
    return record.path;
  }
}
module.exports = { noteSaveMode, loadNoteRecords, noteBody, answerBody, formatNoteMessage, migrateLegacyMarkers, cleanLegacyNote, styleNote, ConversationNotes };
