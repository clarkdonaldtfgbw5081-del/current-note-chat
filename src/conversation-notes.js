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
    records.set(key, { id: item.id, path: item.path, created: new Date(item.created).toISOString(), hashes });
  }
  return records;
}
function safeBody(text) {
  // Content from a source or model cannot forge the markers that delimit owned blocks.
  return String(text)
    .replace(/<!--\s*current-note-chat:/gi, '&lt;!-- current-note-chat:')
    .replace(/%%\s*current-note-chat:/gi, '&#37;&#37; current-note-chat:');
}
function noteBody(text) { return safeBody(normalizeMathDelimiters(String(text))); }
function marker(kind, id) { return `%% current-note-chat:${kind}:${id} %%`; }
function migrateLegacyMarkers(content) {
  return content.replace(/<!--\s*current-note-chat:(conversation|message|end):([0-9a-f-]+)\s*-->/gi, (_, kind, id) => marker(kind.toLowerCase(), id.toLowerCase()));
}
function callout(type, title, body) {
  const quoted = noteBody(body).split('\n').map(line => `> ${line}`).join('\n');
  return `> [!${type}] ${title}\n${quoted}`;
}
function formatNoteMessage(message, activity = 'qa') {
  if (message.error) return `${callout('warning', L('回答未完成', 'Incomplete response'), message.text)}\n`;
  if (message.role === 'user') return `${callout('question', activity === 'feynman' ? L('我的解释 / 作答', 'My explanation / answer') : L('提问', 'Question'), message.text)}\n`;
  const label = activity === 'feynman' ? L('AI 学习反馈', 'AI learning feedback') : L('AI 解答', 'AI answer');
  return `## ${label}\n\n${noteBody(message.text)}\n`;
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
function mergeBlocks(content, blocks, hashes) {
  let merged = content;
  for (const [id, body] of blocks) {
    const nextHash = digest(body);
    // Leave handwritten changes to an unchanged turn intact, including after restart.
    if (hashes[id] === nextHash) continue;
    const start = marker('message', id);
    const end = marker('end', id);
    const block = `${start}\n${body}${end}`;
    const from = merged.indexOf(start), to = merged.indexOf(end, from);
    if (from >= 0 && to >= from) {
      const currentBody = merged.slice(from + start.length, to).replace(/^\r?\n/, '').replace(/\r\n/g, '\n');
      // A format migration may change the generated body. Preserve a turn that
      // the user edited after it was last written instead of restyling over it.
      if (hashes[id] && digest(currentBody) !== hashes[id]) continue;
      merged = merged.slice(0, from) + block + merged.slice(to + end.length);
    }
    else merged = merged.trimEnd() + '\n\n' + block + '\n';
  }
  return merged;
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
    for (const record of this.records.values()) if (record.path === path || record.path?.startsWith(path + '/')) { record.path = null; record.hashes = {}; }
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
    const owner = marker('conversation', record.id);
    let file = record.path ? vault.getAbstractFileByPath(record.path) : null;
    if (file instanceof TFile && file.extension.toLowerCase() === 'md') {
      try {
        await vault.process(file, content => {
          const migrated = migrateLegacyMarkers(content);
          if (!migrated.includes(owner)) throw new OwnershipError('The note no longer has its conversation marker.');
          return mergeBlocks(migrated, snapshot.blocks, record.hashes);
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
      const frontmatter = ['---', `date: ${record.created}`, 'type: conversation', `conversation_id: ${JSON.stringify(record.id)}`, `mode: ${snapshot.meta.mode === 'screen' ? 'screen' : 'file'}`, `activity: ${snapshot.meta.activity === 'feynman' ? 'feynman' : 'qa'}`, ...(snapshot.meta.source ? [`source: ${JSON.stringify(snapshot.meta.source)}`] : []), ...(snapshot.meta.model ? [`model: ${JSON.stringify(snapshot.meta.model)}`] : []), '---', '', owner, '', `# ${safeBody(title)}`, ''].join('\n');
      const content = mergeBlocks(frontmatter, snapshot.blocks, {});
      await vault.create(path, content);
      record.path = path; record.hashes = {};
    }
    record.hashes = Object.fromEntries([...Object.entries(record.hashes), ...[...snapshot.blocks].map(([id, body]) => [id, digest(body)])].slice(-160));
    this.plugin.queueSaveSessions();
    return record.path;
  }
}
module.exports = { noteSaveMode, loadNoteRecords, noteBody, formatNoteMessage, migrateLegacyMarkers, ConversationNotes };
