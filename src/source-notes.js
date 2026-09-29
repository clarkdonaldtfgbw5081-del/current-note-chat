const { Notice, TFile, normalizePath } = require('obsidian');
const { L } = require('./i18n');
const { noteBody, answerBody } = require('./conversation-notes');
const { validPath } = require('./archive-journal');
const { safeFolder } = require('./note-path');

// One entry per appended question, kept so a retried answer never appends twice.
const MAX_QA_APPENDS = 200;
const PNG_PREFIX = 'data:image/png;base64,';

function pad(value) { return String(value).padStart(2, '0'); }
function stampText(now) { return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`; }
function fileStamp(now) { return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`; }

/** Resolve Obsidian's attachment folder setting ("", "/", "folder", "./relative"). */
function attachmentFolderFor(config, notePath, fallback) {
  if (typeof config !== 'string') return fallback;
  const trimmed = config.trim();
  if (!trimmed || trimmed === '/') return '';
  if (trimmed.startsWith('./')) {
    const sub = trimmed.slice(2).replace(/\/+$/, '');
    const parent = typeof notePath === 'string' && notePath.includes('/') ? notePath.slice(0, notePath.lastIndexOf('/')) : '';
    return sub ? (parent ? `${parent}/${sub}` : sub) : parent;
  }
  return trimmed.replace(/\/+$/, '');
}

/**
 * Build the Markdown block appended to the asked-about note. Returns '' when
 * there is nothing to record. Never mutates the note's frontmatter.
 */
function buildQaBlock({ question, answer, embed, when, includeAnswer, transcriptPath }) {
  const body = [];
  if (embed) body.push(embed);
  if (question?.trim()) body.push(noteBody(question));
  if (!body.length) return '';
  const label = embed && !question?.trim() ? L('截图提问', 'Screenshot question') : L('提问', 'Question');
  const quoted = body.join('\n\n').split('\n').map(line => `> ${line}`).join('\n');
  const conversation = transcriptPath ? `\n\n${L('完整对话', 'Full conversation')}: [[${transcriptPath}]]` : '';
  let block = `---\n\n> [!question] 🙋 ${label} · ${stampText(when)}\n${quoted}${conversation}\n`;
  if (includeAnswer !== false && answer?.trim()) block += `\n**${L('AI 解答', 'AI answer')}**\n\n${answerBody(answer)}\n`;
  return block;
}

async function ensureFolder(vault, folder) {
  let current = '';
  for (const part of folder.split('/').filter(Boolean)) {
    current = current ? `${current}/${part}` : part;
    if (!vault.getAbstractFileByPath(current)) {
      try { await vault.createFolder(current); }
      catch (error) { if (!vault.getAbstractFileByPath(current)) throw error; }
    }
  }
}

/** Store a screenshot next to the note (Obsidian attachment settings) and return the saved path. */
async function saveScreenshotImage(vault, dataUrl, notePath, settings) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(PNG_PREFIX)) return null;
  const fallback = `${safeFolder(settings.qaFolder, normalizePath, L('AI 问答', 'AI Q&A'))}/images`;
  let config;
  try { config = vault.getConfig?.('attachmentFolderPath'); } catch { /* Use the plugin attachment folder. */ }
  const folder = normalizePath(attachmentFolderFor(config, notePath, fallback));
  if (folder && !validPath(folder)) throw new Error('Choose an attachment folder inside this vault.');
  if (folder) await ensureFolder(vault, folder);
  const now = new Date();
  const base = `AI-QA-${fileStamp(now)}`;
  const prefix = folder ? `${folder}/` : '';
  let path = `${prefix}${base}.png`;
  let suffix = 2;
  while (vault.getAbstractFileByPath(path)) path = `${prefix}${base} (${suffix++}).png`;
  await vault.createBinary(normalizePath(path), Buffer.from(dataUrl.slice(PNG_PREFIX.length), 'base64'));
  return path;
}

class SourceNotes {
  constructor(plugin) {
    this.plugin = plugin;
    this.chain = Promise.resolve();
  }
  /** Append a finished Q&A turn to the asked-about note; deduplicated by the user-message id. */
  append(targetPath, record) {
    const target = this.plugin.app.vault.getAbstractFileByPath(targetPath);
    this.chain = this.chain.catch(() => {}).then(() => this.write(target, record)).catch(error => {
      if (!this.plugin.disposed) new Notice(`${L('原笔记写回失败，回答仍保留在对话中', 'Could not append to the source note; the answer remains in the conversation')}: ${error?.message || error}`);
      return null;
    });
    return this.chain;
  }
  async write(file, record) {
    const plugin = this.plugin;
    if (!record || typeof record.id !== 'string' || plugin.appendedQa.has(record.id)) return null;
    const vault = plugin.app.vault;
    const canWrite = () => {
      if (plugin.disposed || plugin.settings.qaAppendSource === false || !(file instanceof TFile) || !validPath(file.path) || file.extension.toLowerCase() !== 'md' || vault.getAbstractFileByPath(file.path) !== file) return false;
      const bases = [safeFolder(plugin.settings.qaFolder, normalizePath, L('AI 问答', 'AI Q&A')), safeFolder(plugin.settings.knowledgeFolder, normalizePath, L('AI 知识库', 'AI Knowledge'))];
      return !bases.some(base => file.path.startsWith(base + '/'));
    };
    if (!canWrite()) return null;
    let embed = null;
    if (record.screenshot) {
      try { embed = await saveScreenshotImage(vault, record.screenshot, file.path, plugin.settings); }
      catch (error) { if (!plugin.disposed) new Notice(`${L('截图附件保存失败', 'Could not save the screenshot attachment')}: ${error?.message || error}`); }
    }
    if (!canWrite()) return null;
    const block = buildQaBlock({ question: record.question, answer: record.answer, embed: embed ? `![[${embed}]]` : null, when: new Date(), includeAnswer: plugin.settings.qaAppendAnswer, transcriptPath: record.transcriptPath });
    if (!block) return null;
    let written = false;
    await vault.process(file, content => {
      if (!canWrite()) return content;
      written = true;
      return content.trim() ? content.replace(/[ \t]*\r?\n*$/, '') + '\n\n' + block : block.replace(/^---\n\n/, '');
    });
    if (!written) return null;
    plugin.appendedQa.add(record.id);
    while (plugin.appendedQa.size > MAX_QA_APPENDS) plugin.appendedQa.delete(plugin.appendedQa.keys().next().value);
    plugin.queueSaveSessions();
    return file.path;
  }
}

module.exports = { SourceNotes, MAX_QA_APPENDS, attachmentFolderFor, buildQaBlock, saveScreenshotImage };
