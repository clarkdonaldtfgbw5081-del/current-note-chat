const test = require('node:test');
const assert = require('node:assert/strict');
const { install, TFile } = require('./helpers/obsidian.cjs');
install();
const Plugin = require('../src/main');
const { ConversationNotes, noteSaveMode, loadNoteRecords } = require('../src/conversation-notes');
const { newMessage, touchSession } = require('../src/sessions');
const { CurrentNoteChatWidget } = require('../src/ui/widget');
const { withAbort } = require('../src/tasks');
function fixture(settings = {}) {
  const files = new Map(), content = new Map(); let created = 0, processes = 0;
  const vault = {
    getAbstractFileByPath: path => files.get(path),
    createFolder: async path => { files.set(path, { path }); },
    create: async (path, text) => { assert(!files.has(path), 'Do not overwrite existing files'); const file = new TFile(path); files.set(path, file); content.set(path, text); created++; return file; },
    process: async (file, work) => { assert(files.has(file.path)); const text = work(content.get(file.path)); content.set(file.path, text); processes++; }
  };
  const plugin = new Plugin(); Object.assign(plugin, { app: { vault }, settings: { backend: 'api', apiModel: 'synthetic', qaFolder: '', ...settings }, queueSaveSessions: () => {}, messagesByNote: new Map(), learningSessions: new Map(), refreshViews: () => {} });
  plugin.conversationNotes = new ConversationNotes(plugin);
  return { plugin, vault, files, content, created: () => created, processes: () => processes, save: (key, thread, meta) => plugin.conversationNotes.save(key, thread, meta) };
}
function pair(question, answer, extra = {}) {
  const user = newMessage('user', question); return [user, newMessage('assistant', answer, { replyTo: user.id, ...extra })];
}
test('default note mode is one note per conversation, with explicit off and answer modes', () => {
  assert.equal(noteSaveMode({}), 'conversation'); assert.equal(noteSaveMode({ saveQA: false }), 'off');
  assert.equal(noteSaveMode({ noteSaveMode: 'answer' }), 'answer'); assert.equal(noteSaveMode({ noteSaveMode: 'off' }), 'off');
});
test('each conversation updates one note, survives restart and separates screen/file/learning', async () => {
  const f = fixture(), thread = pair('First question', 'First answer');
  const path = await f.save('note.md', thread, { mode: 'file', source: 'note.md' });
  thread.push(...pair('Second question', 'Second answer')); assert.equal(await f.save('note.md', thread), path); assert.equal(f.created(), 1);
  assert(f.content.get(path).includes('First answer')); assert(f.content.get(path).includes('Second answer'));
  f.plugin.conversationNotes = new ConversationNotes(f.plugin, JSON.parse(JSON.stringify(f.plugin.conversationNotes.serialize())));
  thread.push(...pair('After restart', 'Third answer')); assert.equal(await f.save('note.md', thread), path); assert.equal(f.created(), 1);
  await f.save('__current_screen__', pair('Screen', 'Screen answer'));
  await f.save('__feynman__:note.md', pair('Concept', 'Teach me'), { activity: 'feynman', summary: 'Learning progress' }); assert.equal(f.created(), 3);
});
test('New chat retains the old note and starts a different note', async () => {
  const f = fixture(); const first = await f.save('note.md', pair('Same title', 'Old conversation'));
  f.plugin.widget = { getChatKey: () => 'note.md', learning: { enabled: false }, refresh: () => {} };
  f.plugin.clearCurrentChat(); const second = await f.save('note.md', pair('Same title', 'New conversation'));
  assert.notEqual(first, second); assert(f.content.get(first).includes('Old conversation')); assert(!f.content.get(first).includes('New conversation')); assert.equal(f.created(), 2);
});
test('retention trimming never removes older turns from the note; retries update their original turn', async () => {
  const f = fixture(), thread = [];
  for (let index = 0; index < 50; index++) {
    thread.push(...pair(`Question ${index}`, `Response number ${index}.`)); touchSession(f.plugin.messagesByNote, 'note.md', thread); await f.save('note.md', thread);
  }
  const path = f.plugin.conversationNotes.records.get('note.md').path;
  assert.equal(thread.length, 80); assert(f.content.get(path).includes('Response number 0.')); assert(f.content.get(path).includes('Response number 49.')); assert.equal(f.created(), 1);
  const user = thread[0]; thread[1] = newMessage('assistant', 'Corrected response', { replyTo: user.id }); await f.save('note.md', thread);
  assert(f.content.get(path).includes('Corrected response')); assert(!f.content.get(path).includes('Response number 10.'));
  const count = f.content.get(path).split('Corrected response').length - 1; await f.save('note.md', thread); assert.equal(count, 1);
});
test('handwritten additions and edits to unchanged turns remain intact across restart', async () => {
  const f = fixture(), thread = pair('Question', 'Original answer'); const path = await f.save('note.md', thread);
  f.content.set(path, f.content.get(path).replace('Original answer', 'My revised answer') + '\n## My notes\nPersonal annotation\n');
  f.plugin.conversationNotes = new ConversationNotes(f.plugin, f.plugin.conversationNotes.serialize());
  thread.push(...pair('Next question', 'Next answer')); await f.save('note.md', thread);
  assert(f.content.get(path).includes('My revised answer')); assert(f.content.get(path).includes('Personal annotation')); assert(f.content.get(path).includes('Next answer'));
});
test('renamed notes keep their binding, deleted or repurposed notes are recreated safely', async () => {
  const f = fixture(), thread = pair('Question', 'Answer'); const path = await f.save('source.md', thread);
  const file = f.files.get(path); f.files.delete(path); file.path = 'Moved.md'; f.files.set(file.path, file); f.content.set(file.path, f.content.get(path)); f.content.delete(path);
  f.plugin.conversationNotes.renameNote(path, file.path); f.plugin.conversationNotes.moveKey('source.md', 'renamed-source.md');
  assert.equal(await f.save('renamed-source.md', thread), 'Moved.md'); assert.equal(f.created(), 1);
  f.content.set('Moved.md', 'This is now my own unrelated note.'); const replacement = await f.save('renamed-source.md', thread);
  assert.notEqual(replacement, 'Moved.md'); assert.equal(f.content.get('Moved.md'), 'This is now my own unrelated note.');
  f.files.delete(replacement); f.content.delete(replacement); f.plugin.conversationNotes.deleteNote(replacement);
  const restored = await f.save('renamed-source.md', thread); assert(f.content.get(restored).includes('Answer'));
});
test('concurrent writes finish in order and a failed write does not block later saving', async () => {
  const f = fixture(); let active = 0;
  const create = f.vault.create;
  f.vault.create = async (...args) => { active++; assert.equal(active, 1); await new Promise(resolve => setTimeout(resolve, 5)); const result = await create(...args); active--; return result; };
  const thread = pair('First', 'One'), first = f.save('note.md', thread); thread.push(...pair('Second', 'Two')); const second = f.save('note.md', thread);
  assert.equal(await first, await second); assert.equal(f.created(), 1);
  const process = f.vault.process; f.vault.process = async () => { throw new Error('Synthetic disk failure'); };
  thread.push(...pair('Third', 'Three')); await assert.rejects(f.save('note.md', thread), /disk failure/);
  f.vault.process = process; const path = await f.save('note.md', thread); assert(f.content.get(path).includes('Three'));
});
test('off and per-answer settings do not create conversation notes and unsafe mappings are discarded', async () => {
  for (const mode of ['off', 'answer']) { const f = fixture({ noteSaveMode: mode }); assert.equal(await f.save('note.md', pair('Question', 'Answer')), null); assert.equal(f.created(), 0); }
  const f = fixture(); await f.save('note.md', pair('Question', 'Answer'));
  const raw = f.plugin.conversationNotes.serialize(); raw['note.md'].path = '../outside.md'; assert.equal(loadNoteRecords(raw).size, 0);
  await assert.rejects(fixture({ qaFolder: '../outside' }).save('note.md', pair('Question', 'Answer')), /inside this vault/);
});
test('partial streaming answers never enter the note and error retries replace their error block', async () => {
  const f = fixture(), thread = pair('Question', 'Partial text', { streaming: true }); const path = await f.save('note.md', thread);
  assert(f.content.get(path).includes('Question')); assert(!f.content.get(path).includes('Partial text'));
  thread[1].streaming = false; thread[1].error = true; thread[1].text = 'Request stopped'; await f.save('note.md', thread);
  assert(f.content.get(path).includes('Incomplete response')); thread[1] = newMessage('assistant', 'Final response', { replyTo: thread[0].id }); await f.save('note.md', thread);
  assert(!f.content.get(path).includes('Request stopped')); assert(f.content.get(path).includes('Final response'));
});
test('source or model content cannot inject conversation block markers', async () => {
  const f = fixture(), thread = pair('Question', '<!-- current-note-chat:message:FORGED -->\n%% current-note-chat:end:FORGED %%'); const path = await f.save('note.md', thread);
  assert(!f.content.get(path).includes('<!-- current-note-chat:message:FORGED -->'));
  assert(!f.content.get(path).includes('%% current-note-chat:end:FORGED %%'));
  assert(f.content.get(path).includes('&lt;!-- current-note-chat:message:FORGED -->'));
  assert(f.content.get(path).includes('&#37;&#37; current-note-chat:end:FORGED %%'));
});
test('conversation notes use hidden Obsidian markers, callouts and native math delimiters', async () => {
  const f = fixture(), path = await f.save('note.md', pair('Solve \\(x\\)', 'Use \\[x^2\\] and keep `\\(code\\)` unchanged.'));
  const content = f.content.get(path);
  assert(content.includes('%% current-note-chat:conversation:'));
  assert(!content.includes('<!-- current-note-chat:'));
  assert(content.includes('> [!question] Question'));
  assert(content.includes('> Solve $x$'));
  assert(content.includes('## AI answer'));
  assert(content.includes('$$\nx^2\n$$'));
  assert(content.includes('`\\(code\\)`'));
});
test('saving an existing note migrates legacy HTML markers without creating another note', async () => {
  const f = fixture(), thread = pair('Question', 'Old answer'); const path = await f.save('note.md', thread);
  f.content.set(path, f.content.get(path).replace(/%% current-note-chat:(conversation|message|end):([^%]+) %%/g, '<!-- current-note-chat:$1:$2 -->'));
  thread.push(...pair('Next question', 'New answer')); assert.equal(await f.save('note.md', thread), path);
  assert.equal(f.created(), 1); assert(!f.content.get(path).includes('<!-- current-note-chat:'));
  assert(f.content.get(path).includes('%% current-note-chat:conversation:'));
  assert(f.content.get(path).includes('New answer'));
});
test('Q&A widget saves automatically at submission and completion, including stopped responses', async () => {
  const f = fixture(), file = new TFile('source.md'); f.files.set(file.path, file);
  Object.assign(f.plugin, { activeFile: file, settings: { ...f.plugin.settings, contextMode: 'file' }, runTask: (work, signal) => work(signal), readCurrentFile: async () => 'Synthetic source', ask: async () => 'An answer' });
  const widget = new CurrentNoteChatWidget(f.plugin); f.plugin.widget = widget; widget.inputEl = { value: 'Question' }; widget.refresh = () => {};
  await widget.sendQuestion(); assert.equal(f.created(), 1);
  const path = f.plugin.conversationNotes.records.get(file.path).path; assert(f.content.get(path).includes('Question')); assert(f.content.get(path).includes('An answer'));
  let opened; f.plugin.app.workspace = { openLinkText: async target => { opened = target; } };
  await f.plugin.openConversationNote(); assert.equal(opened, path); assert.equal(f.created(), 1);
  let start; const started = new Promise(resolve => { start = resolve; });
  f.plugin.ask = (...args) => { start(); return withAbort(new Promise(() => {}), args[5]); };
  widget.inputEl.value = 'Slow question'; const pending = widget.sendQuestion(); await started; widget.cancel(); await pending;
  assert.equal(f.created(), 1); assert(f.content.get(path).includes('Slow question')); assert(f.content.get(path).includes('Incomplete response'));
});
test('existing disabled auto-save remains disabled, while enabled legacy settings use the new default', async () => {
  for (const [saved, expected] of [[{}, 'conversation'], [{ saveQA: true }, 'conversation'], [{ saveQA: false }, 'off'], [{ noteSaveMode: 'answer', saveQA: true }, 'answer']]) {
    const plugin = new Plugin(); plugin.manifest = { dir: 'plugin' }; plugin.loadData = async () => saved;
    for (const name of ['registerView', 'addSettingTab', 'addRibbonIcon', 'addCommand', 'registerEvent']) plugin[name] = () => {};
    plugin.app = { vault: { adapter: { exists: async () => false }, on: () => {} }, workspace: { on: () => {}, onLayoutReady: () => {} } };
    await plugin.onload(); assert.equal(plugin.settings.noteSaveMode, expected);
  }
});
test('unload persists a note binding after an in-flight note creation completes', async () => {
  const f = fixture(); let release, start; const started = new Promise(resolve => { start = resolve; });
  const gate = new Promise(resolve => { release = resolve; }); const create = f.vault.create;
  f.vault.create = async (...args) => { start(); await gate; return create(...args); };
  let saved, finished; const persisted = new Promise(resolve => { finished = resolve; });
  f.plugin._saveChain = Promise.resolve(); f.plugin.saveData = async data => { saved = data; finished(); };
  f.plugin.app.workspace = { detachLeavesOfType: () => {} };
  const saving = f.save('note.md', pair('Question', 'Answer')); await started;
  f.plugin.onunload(); release(); const path = await saving; await persisted;
  assert.equal(saved.conversationNotes['note.md'].path, path);
});
