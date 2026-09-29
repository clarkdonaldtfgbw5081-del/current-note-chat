const test = require('node:test');
const assert = require('node:assert/strict');
const { install, TFile, notices } = require('./helpers/obsidian.cjs');
install();
const { SourceNotes, attachmentFolderFor, buildQaBlock } = require('../src/source-notes');

function fixture(settings = {}, files = new Map()) {
  const content = new Map();
  const vault = {
    getAbstractFileByPath: path => files.get(path),
    createFolder: async path => { files.set(path, { path }); },
    createBinary: async (path, bytes) => { const file = new TFile(path); files.set(path, file); content.set(path, bytes); return file; },
    process: async (file, work) => { assert.ok(files.has(file.path), 'process targets an existing file'); content.set(file.path, work(content.get(file.path) ?? '')); }
  };
  const plugin = { disposed: false, appendedQa: new Set(), settings: { qaFolder: '', knowledgeFolder: '', qaAppendAnswer: true, ...settings }, app: { vault }, queueSaveSessions: () => {} };
  return { plugin, sourceNotes: new SourceNotes(plugin), files, content };
}

test('attachmentFolderFor resolves Obsidian attachment settings', () => {
  assert.equal(attachmentFolderFor('attachments', 'notes/a.md', 'fallback'), 'attachments');
  assert.equal(attachmentFolderFor('/', 'notes/a.md', 'fallback'), '');
  assert.equal(attachmentFolderFor('./images', 'notes/a.md', 'fallback'), 'notes/images');
  assert.equal(attachmentFolderFor('./', 'notes/a.md', 'fallback'), 'notes');
  assert.equal(attachmentFolderFor('./', 'a.md', 'fallback'), '');
  assert.equal(attachmentFolderFor(null, 'notes/a.md', 'fallback'), 'fallback');
});

test('buildQaBlock records question, answer, screenshots and the conversation link', () => {
  const base = { when: new Date('2026-09-29T10:20:00'), includeAnswer: true };
  const block = buildQaBlock({ ...base, question: 'What is the covariance matrix?', answer: 'The spread of X.' });
  assert(block.startsWith('---\n\n> [!question]'));
  assert(block.includes('> What is the covariance matrix?'));
  assert(block.includes('**'));
  assert(block.includes('The spread of X.'));
  const embed = buildQaBlock({ ...base, question: 'Read this shot', embed: '![[AI-QA-1.png]]', answer: 'Answer' });
  assert(embed.includes('> ![[AI-QA-1.png]]'));
  const link = buildQaBlock({ ...base, question: 'Q', answer: 'A', transcriptPath: 'AI/chat.md' });
  assert(link.includes('[[AI/chat.md]]'));
  const questionOnly = buildQaBlock({ ...base, question: 'Only the question', answer: 'Unused answer text', includeAnswer: false });
  assert(questionOnly.includes('Only the question'));
  assert(!questionOnly.includes('Unused answer text'));
  assert.equal(buildQaBlock({ ...base, question: '   ', answer: 'A' }), '');
});

test('marker injection in questions is escaped in appended blocks', () => {
  const block = buildQaBlock({ when: new Date(), includeAnswer: true, question: '[cnc-message-x]: #\nsecond line', answer: 'with %% current-note-chat: nope' });
  assert(!block.includes('[cnc-message-x]: #'));
  assert(!block.includes('%% current-note-chat:'));
});

test('appends land once per question and respect folder guards', async () => {
  const files = new Map(); const note = new TFile('course/note.md'); files.set('course/note.md', note);
  const f = fixture({ qaFolder: 'AI 问答', knowledgeFolder: 'AI 知识库' }, files);
  f.content.set('course/note.md', '# Course note\n');
  await f.sourceNotes.append('course/note.md', { id: 'q1', question: 'Explain section 2.2', answer: 'Gaussian.', transcriptPath: null });
  const text = f.content.get('course/note.md');
  assert(text.includes('# Course note'));
  assert(text.includes('> Explain section 2.2'));
  assert(text.includes('Gaussian.'));
  await f.sourceNotes.append('course/note.md', { id: 'q1', question: 'Explain section 2.2', answer: 'Different answer.' });
  assert.equal(f.content.get('course/note.md'), text);
  const pdf = new TFile('course/file.pdf'); files.set('course/file.pdf', pdf);
  await f.sourceNotes.append('course/file.pdf', { id: 'q2', question: 'Q', answer: 'A' });
  assert(!f.content.has('course/file.pdf'));
  const own = new TFile('AI 问答/chat.md'); files.set('AI 问答/chat.md', own); f.content.set('AI 问答/chat.md', 'kept');
  await f.sourceNotes.append('AI 问答/chat.md', { id: 'q3', question: 'Q', answer: 'A' });
  assert.equal(f.content.get('AI 问答/chat.md'), 'kept');
  const knowledge = new TFile('AI 知识库/topic.md'); files.set('AI 知识库/topic.md', knowledge); f.content.set('AI 知识库/topic.md', 'kept');
  await f.sourceNotes.append('AI 知识库/topic.md', { id: 'q4', question: 'Q', answer: 'A' });
  assert.equal(f.content.get('AI 知识库/topic.md'), 'kept');
});

test('screenshot questions are stored as vault attachments and embedded', async () => {
  const files = new Map(); const note = new TFile('course/note.md'); files.set('course/note.md', note);
  const f = fixture({ qaFolder: 'AI 问答' }, files);
  f.content.set('course/note.md', '# Course note\n');
  const dataUrl = `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`;
  await f.sourceNotes.append('course/note.md', { id: 's1', question: 'What is on screen?', answer: 'A formula.', screenshot: dataUrl });
  const image = [...files.keys()].find(path => path.endsWith('.png'));
  assert(image, 'screenshot saved as attachment');
  assert(image.startsWith('AI 问答/images/'));
  const text = f.content.get('course/note.md');
  assert(text.includes(`![[${image}]]`));
  assert(text.includes('What is on screen?'));
});

test('unavailable attachment configuration still saves a real fallback attachment', async () => {
  const note = new TFile('course/note.md'); const f = fixture({}, new Map([[note.path, note]]));
  f.plugin.app.vault.getConfig = () => { throw new Error('Config unavailable'); };
  await f.sourceNotes.append(note.path, { id: 'fallback', question: 'Q', screenshot: PNG() });
  const image = [...f.files.keys()].find(path => path.endsWith('.png'));
  assert.ok(image?.startsWith('AI Q&A/images/'));
  assert.ok(f.content.get(note.path).includes(`![[${image}]]`));
});

function PNG() { return `data:image/png;base64,${Buffer.from('test image').toString('base64')}`; }

test('unsafe attachment folders never create files outside the vault', async () => {
  const note = new TFile('note.md'); const f = fixture({}, new Map([[note.path, note]]));
  f.plugin.app.vault.getConfig = () => '../outside';
  const before = notices.length;
  await f.sourceNotes.append(note.path, { id: 'unsafe', question: 'Keep this question', screenshot: PNG() });
  assert.equal([...f.files.keys()].filter(path => path.endsWith('.png')).length, 0);
  assert.ok(f.content.get(note.path).includes('Keep this question'));
  assert.ok(notices.length > before);
});

test('disabling source writes or unloading during attachment storage prevents a late append', async () => {
  for (const action of ['disable', 'unload', 'move']) {
    const note = new TFile('note.md'); const f = fixture({}, new Map([[note.path, note]]));
    f.content.set(note.path, 'Handwritten content');
    const original = f.plugin.app.vault.createBinary;
    f.plugin.app.vault.createBinary = async (...args) => {
      const image = await original(...args);
      if (action === 'disable') f.plugin.settings.qaAppendSource = false;
      if (action === 'unload') f.plugin.disposed = true;
      if (action === 'move') { f.files.delete(note.path); note.path = 'AI Knowledge/note.MD'; f.files.set(note.path, note); f.content.set(note.path, 'Handwritten content'); }
      return image;
    };
    await f.sourceNotes.append('note.md', { id: action, question: 'Q', screenshot: PNG() });
    assert.equal(f.content.get(note.path), 'Handwritten content');
    assert.equal(f.plugin.appendedQa.size, 0);
  }
});

test('failed source writes are reported and do not block the next append', async () => {
  const note = new TFile('note.md'); const f = fixture({}, new Map([[note.path, note]]));
  const original = f.plugin.app.vault.process; let first = true; const before = notices.length;
  f.plugin.app.vault.process = async (...args) => { if (first) { first = false; throw new Error('Disk full'); } return original(...args); };
  assert.equal(await f.sourceNotes.append(note.path, { id: 'failed', question: 'First' }), null);
  assert.equal(f.plugin.appendedQa.size, 0);
  assert.ok(notices.slice(before).some(text => text.includes('Disk full')));
  await f.sourceNotes.append(note.path, { id: 'next', question: 'Next' });
  assert.ok(f.content.get(note.path).includes('Next'));
});

test('a queued source write follows a rename and refuses a replacement at the same path', async () => {
  const note = new TFile('note.md'); const f = fixture({}, new Map([[note.path, note]]));
  let release; f.sourceNotes.chain = new Promise(resolve => { release = resolve; });
  const pending = f.sourceNotes.append(note.path, { id: 'rename', question: 'Follow rename' });
  f.files.delete(note.path); note.path = 'renamed.md'; f.files.set(note.path, note); release();
  assert.equal(await pending, 'renamed.md');
  const obsolete = new TFile('old.md'); f.files.set(obsolete.path, obsolete);
  const replacementWrite = f.sourceNotes.append(obsolete.path, { id: 'replace', question: 'Do not write' });
  f.files.set(obsolete.path, new TFile(obsolete.path));
  assert.equal(await replacementWrite, null);
  assert.equal(f.content.has(obsolete.path), false);
});

test('appending to an empty note cannot introduce an unterminated frontmatter block', async () => {
  const note = new TFile('empty.md'); const f = fixture({}, new Map([[note.path, note]]));
  await f.sourceNotes.append(note.path, { id: 'empty', question: 'Q', answer: 'A' });
  assert.ok(f.content.get(note.path).startsWith('> [!question]'));
});
