const test = require('node:test');
const assert = require('node:assert/strict');
const { install, notices, TFile } = require('./helpers/obsidian.cjs');
install();
const { CurrentNoteChatWidget } = require('../src/ui/widget');
const { withAbort } = require('../src/tasks');

function fixture() {
  const file = new TFile('note.md');
  const files = new Map([[file.path, file]]);
  const plugin = {
    settings: { contextMode: 'file', backend: 'api', previewScreenshot: false, qaAppendSource: false },
    activeFile: file,
    messagesByNote: new Map([['note.md', []]]),
    app: { vault: { getAbstractFileByPath: path => files.get(path) } },
    queueSaveSessions: () => {},
    currentModel: () => 'test-model',
    getEditableMarkdownView: () => null,
    saveConversation: async () => null,
    runTask: (work, signal) => work(signal),
    readCurrentFile: async () => 'file context',
    ask: async () => 'unused'
  };
  const widget = new CurrentNoteChatWidget(plugin);
  widget.inputEl = { value: '' };
  widget.refresh = () => {};
  return { widget, plugin, files };
}

test('questions typed while busy queue up and run afterwards', async () => {
  const f = fixture(); f.widget.inputEl.value = 'first';
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  f.plugin.ask = async (path, text, history, question) => { started(); await new Promise(resolve => setTimeout(resolve, 5)); return `answer to ${question}`; };
  const pending = f.widget.sendQuestion();
  await ready;
  assert.equal(f.widget.busy, true);
  f.widget.inputEl.value = 'second';
  await f.widget.sendQuestion();
  assert.equal(f.widget.inputEl.value, '');
  assert.equal(f.widget.queue.length, 1);
  assert.equal(f.widget.queue[0].key, 'note.md');
  assert.equal(f.widget.queue[0].text, 'second');
  await pending;
  for (let i = 0; i < 200 && (f.widget.busy || f.widget.queue.length); i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.widget.queue.length, 0);
  const thread = f.plugin.messagesByNote.get('note.md');
  assert.deepEqual(thread.filter(message => message.role === 'user').map(message => message.text), ['first', 'second']);
  assert.equal(thread.at(-1).text, 'answer to second');
});

test('the queue holds at most five pending questions', async () => {
  const f = fixture(); f.widget.inputEl.value = 'initial';
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  f.plugin.ask = (...args) => { started(); return withAbort(new Promise(() => {}), args[5]); };
  const pending = f.widget.sendQuestion();
  await ready;
  const before = notices.length;
  for (let index = 0; index < 6; index++) {
    f.widget.inputEl.value = `queued ${index}`;
    await f.widget.sendQuestion();
  }
  assert.equal(f.widget.queue.length, 5);
  assert.equal(f.widget.inputEl.value, 'queued 5');
  assert.ok(notices.length > before, 'the sixth question reports the cap');
  f.widget.unmount();
  await pending.catch(() => {});
  assert.equal(f.widget.queue.length, 0);
});

test('clearing a chat drops only its own queued questions', () => {
  const f = fixture();
  f.widget.queue.push({ key: 'note.md', text: 'one' }, { key: 'other.md', text: 'two' });
  f.widget.clearQueueFor('note.md');
  assert.deepEqual(f.widget.queue, [{ key: 'other.md', text: 'two' }]);
});

test('Stop pauses queued requests until the user resumes them', async () => {
  const f = fixture(); f.widget.inputEl.value = 'first';
  let started; const ready = new Promise(resolve => { started = resolve; }); let calls = 0;
  f.plugin.ask = (...args) => { calls++; started(); return withAbort(new Promise(() => {}), args[5]); };
  const pending = f.widget.sendQuestion(); await ready;
  f.widget.inputEl.value = 'second'; await f.widget.sendQuestion();
  f.widget.cancel(); await pending;
  f.widget.drainQueue();
  assert.equal(calls, 1);
  assert.equal(f.widget.queuePaused, true);
  assert.equal(f.widget.queue.length, 1);
  f.plugin.ask = async () => { calls++; return 'resumed'; };
  f.widget.queuePaused = false; f.widget.drainQueue();
  for (let i = 0; i < 100 && f.widget.busy; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(calls, 2);
  assert.equal(f.plugin.messagesByNote.get('note.md').at(-1).text, 'resumed');
});

test('provider errors pause the queue without losing queued questions or the draft', async () => {
  const f = fixture(); f.widget.inputEl.value = 'first';
  let fail; f.plugin.ask = () => new Promise((resolve, reject) => { fail = reject; });
  const pending = f.widget.sendQuestion();
  while (!fail) await new Promise(resolve => setTimeout(resolve, 1));
  f.widget.inputEl.value = 'second'; await f.widget.sendQuestion();
  f.widget.inputEl.value = 'unsent draft'; fail(new Error('Provider unavailable')); await pending;
  assert.equal(f.widget.queue.length, 1);
  assert.equal(f.widget.queuePaused, true);
  assert.equal(f.widget.inputEl.value, 'unsent draft');
});

test('queued file questions wait for their own file, follow renames and preserve a draft', async () => {
  const f = fixture(); const sourceFile = f.plugin.activeFile;
  f.widget.queue.push({ key: 'note.md', text: 'queued question', sourceFile });
  const other = new TFile('other.md'); f.files.set(other.path, other); f.plugin.activeFile = other;
  let path; f.plugin.ask = async askedPath => { path = askedPath; return 'A'; };
  f.widget.drainQueue(); assert.equal(path, undefined); assert.equal(f.widget.queue.length, 1);
  f.files.delete(sourceFile.path); sourceFile.path = 'renamed.md'; f.files.set(sourceFile.path, sourceFile);
  f.widget.renameQueue('note.md', sourceFile.path);
  f.plugin.activeFile = sourceFile; f.widget.inputEl.value = 'draft'; f.widget.drainQueue();
  for (let i = 0; i < 100 && f.widget.busy; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(path, sourceFile.path);
  assert.equal(f.widget.inputEl.value, 'draft');
});

test('deleted or replaced queued sources are dropped, and folder renames update child tasks', () => {
  const f = fixture(); const file = f.plugin.activeFile;
  f.widget.queue.push({ key: file.path, text: 'old', sourceFile: file });
  f.files.set(file.path, new TFile(file.path)); f.widget.drainQueue();
  assert.equal(f.widget.queue.length, 0);
  f.widget.queue.push({ key: 'course/a.md', text: 'a' }, { key: 'course/b.md', text: 'b' });
  f.widget.renameQueue('course', 'new-course');
  assert.deepEqual(f.widget.queue.map(item => item.key), ['new-course/a.md', 'new-course/b.md']);
  f.widget.clearQueueFor('new-course'); assert.equal(f.widget.queue.length, 0);
});

test('screen answers and cached retries write to the note selected when the question began', async () => {
  const f = fixture(); const original = f.plugin.activeFile; const other = new TFile('other.md');
  f.files.set(other.path, other); f.plugin.settings.contextMode = 'screen'; f.plugin.settings.qaAppendSource = true;
  f.widget.rootEl = { addClass: () => {}, removeClass: () => {}, remove: () => {} };
  const written = []; f.plugin.sourceNotes = { append: async (path, record) => written.push({ path, record }) };
  f.plugin.captureCurrentScreen = async () => 'data:image/png;base64,image';
  let first = true; f.plugin.askScreen = async () => {
    f.plugin.activeFile = other;
    if (first) { first = false; throw new Error('Try again'); }
    return 'Screen answer';
  };
  f.widget.inputEl.value = 'Screen Q'; await f.widget.sendQuestion();
  assert.equal(written.length, 0);
  const user = f.plugin.messagesByNote.get('__current_screen__')[0];
  await f.widget.sendQuestion(user.id);
  assert.equal(written.length, 1); assert.equal(written[0].path, original.path);
  assert.equal(written[0].record.screenshot, 'data:image/png;base64,image');
  f.widget.unmount();
});

test('queued screen questions retain their target note but capture only when executed', async () => {
  const f = fixture(); const original = f.plugin.activeFile; f.plugin.settings.contextMode = 'screen'; f.plugin.settings.qaAppendSource = true;
  f.widget.rootEl = { addClass: () => {}, removeClass: () => {}, remove: () => {} }; f.widget.busy = true;
  let captures = 0; f.plugin.captureCurrentScreen = async () => { captures++; return 'data:image/png;base64,image'; };
  let target; f.plugin.sourceNotes = { append: async path => { target = path; } }; f.plugin.askScreen = async () => 'A';
  f.widget.inputEl.value = 'Queued screen Q'; await f.widget.sendQuestion(); assert.equal(captures, 0);
  f.plugin.activeFile = new TFile('other.md'); f.widget.busy = false; f.widget.drainQueue();
  for (let i = 0; i < 300 && f.widget.busy; i++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(captures, 1); assert.equal(target, original.path);
  f.widget.unmount();
});

test('per-answer output supplies the generated note link to the source append', async () => {
  const f = fixture(); f.plugin.settings.noteSaveMode = 'answer'; f.plugin.settings.qaAppendSource = true;
  f.plugin.saveQAToNote = async () => 'AI Q&A/answer.md'; let record;
  f.plugin.sourceNotes = { append: async (path, turn) => { record = turn; } };
  f.widget.inputEl.value = 'Q'; await f.widget.sendQuestion();
  assert.equal(record.transcriptPath, 'AI Q&A/answer.md');
});

test('a complete file question saves its transcript, appends to the source and archives into the knowledge tree', async () => {
  const { ConversationNotes } = require('../src/conversation-notes');
  const { SourceNotes } = require('../src/source-notes');
  const { KnowledgeNotes } = require('../src/knowledge-notes');
  const f = fixture(); const content = new Map([['note.md', '# Handwritten note\n\nMy proof.\n']]);
  const original = content.get('note.md'); const vault = f.plugin.app.vault;
  const folder = path => {
    if (!path || f.files.has(path)) return;
    folder(path.split('/').slice(0, -1).join('/'));
    f.files.set(path, { path, get children() { return [...f.files.values()].filter(item => item.path.split('/').slice(0, -1).join('/') === path); } });
  };
  vault.createFolder = async path => folder(path);
  vault.create = async (path, text) => {
    assert.equal(f.files.has(path), false); folder(path.split('/').slice(0, -1).join('/'));
    const file = new TFile(path); file.basename = path.split('/').at(-1).slice(0, -3); f.files.set(path, file); content.set(path, text); return file;
  };
  vault.read = vault.cachedRead = async file => content.get(file.path);
  vault.process = async (file, change) => content.set(file.path, change(content.get(file.path)));
  Object.assign(f.plugin.settings, { qaAppendSource: true, qaAppendAnswer: true, noteSaveMode: 'conversation', autoClassify: true, qaFolder: 'AI Q&A', knowledgeFolder: 'AI Knowledge' });
  f.plugin.appendedQa = new Set(); f.plugin.saveSettings = async () => {};
  f.plugin.conversationNotes = new ConversationNotes(f.plugin); f.plugin.sourceNotes = new SourceNotes(f.plugin); f.plugin.knowledgeNotes = new KnowledgeNotes(f.plugin);
  f.plugin.saveConversation = (...args) => f.plugin.conversationNotes.save(...args);
  f.plugin.queueKnowledgeArchive = (...args) => f.plugin.knowledgeNotes.queue(...args);
  let classifications = 0;
  f.plugin.ask = async () => 'Independent events satisfy \\(P(A \\cap B)=P(A)P(B)\\).';
  f.plugin.askClassification = async prompt => {
    classifications++;
    const transcript = f.plugin.conversationNotes.records.get('note.md')?.path;
    assert.ok(content.get(transcript)?.includes('Independent events'), 'complete answer is saved before classification');
    assert.equal(prompt.includes('My proof.'), false, 'handwritten source body is not sent to classification');
    return JSON.stringify({ action: 'new', category: ['Mathematics'], title: 'Independence', confidence: 0.95, reason: 'Clear topic', summary: 'Independent events satisfy \\(P(A \\cap B)=P(A)P(B)\\).' });
  };
  f.widget.inputEl.value = 'Explain independence'; await f.widget.sendQuestion();
  await Promise.all([f.plugin.sourceNotes.chain, f.plugin.knowledgeNotes.chain]);
  const transcript = f.plugin.conversationNotes.records.get('note.md').path;
  assert.ok(content.get('note.md').startsWith(original.trimEnd()));
  assert.ok(content.get('note.md').includes(`[[${transcript}]]`));
  assert.ok(content.get('note.md').includes('$P(A \\cap B)=P(A)P(B)$'));
  assert.ok(content.get('AI Knowledge/Mathematics/Independence.md').includes(transcript));
  assert.equal(classifications, 1); assert.equal(f.plugin.appendedQa.size, 1);
  assert.equal([...content.values()].some(text => text.includes('current-note-chat:') || text.includes('[cnc-message-')), false);
  f.widget.unmount();
});
