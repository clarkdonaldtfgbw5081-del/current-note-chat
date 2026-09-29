const test = require('node:test');
const assert = require('node:assert/strict');
const { install, TFile } = require('./helpers/obsidian.cjs'); install();
const { KnowledgeNotes, candidatesFor, parsePlan, loadArchives } = require('../src/knowledge-notes');
const { newMessage } = require('../src/sessions');
const { CurrentNoteChatWidget } = require('../src/ui/widget');
const { withAbort } = require('../src/tasks');
const Plugin = require('../src/main');
function plan(extra = {}) { return JSON.stringify({ action: 'new', path: '', category: ['Mathematics', 'Probability'], title: 'Independence', confidence: 0.94, reason: 'The answer defines independence.', summary: 'Events are independent when \\(P(A \\cap B)=P(A)P(B)\\).', ...extra }); }
function fixture(settings = {}) {
  const files = new Map(), content = new Map(), calls = [];
  const folder = path => {
    if (!path || files.has(path)) return;
    const parent = path.split('/').slice(0, -1).join('/'); folder(parent);
    files.set(path, { path, get children() { return [...files.values()].filter(item => item.path.split('/').slice(0, -1).join('/') === path); } });
  };
  const vault = {
    getAbstractFileByPath: path => files.get(path), getMarkdownFiles: () => [...files.values()].filter(file => file instanceof TFile),
    createFolder: async path => { folder(path); },
    create: async (path, text) => { assert(!files.has(path)); folder(path.split('/').slice(0, -1).join('/')); const file = new TFile(path); file.basename = path.split('/').at(-1).slice(0, -3); files.set(path, file); content.set(path, text); return file; },
    process: async (file, fn) => { content.set(file.path, fn(content.get(file.path))); },
    read: async file => content.get(file.path)
  };
  const plugin = { settings: { autoClassify: true, noteSaveMode: 'conversation', knowledgeFolder: 'AI Knowledge', ...settings }, app: { vault }, queueSaveSessions: () => {}, refreshViews: () => {}, askClassification: async (prompt, signal) => { calls.push({ prompt, signal }); return plan(); } };
  const notes = new KnowledgeNotes(plugin); plugin.knowledgeNotes = notes;
  const user = newMessage('user', 'Explain independence'), reply = newMessage('assistant', 'Two events are independent when knowing one does not change the probability of the other.', { replyTo: user.id });
  return { files, content, vault, plugin, notes, user, reply, calls, queue: (meta = {}, force = false) => plugin.knowledgeNotes.queue('screen', user, reply, { transcriptPath: 'AI Q&A/session.md', ...meta }, force) };
}
test('AI creates a topic note in the scoped knowledge tree with native math and a transcript link', async () => {
  const f = fixture(); await f.vault.create('Private/independence.md', 'PRIVATE_CONTENT');
  const path = await f.queue(); assert.equal(path, 'AI Knowledge/Mathematics/Probability/Independence.md');
  const text = f.content.get(path); assert(text.includes('$P(A \\cap B)=P(A)P(B)$')); assert(text.includes('[[AI Q&A/session.md|Full conversation]]'));
  assert(!text.includes('cnc-')); assert(!text.includes('current-note-chat:'));
  const data = JSON.parse(f.calls[0].prompt.split('\n\n').at(-1)); assert.deepEqual(data.candidates, []); assert(!f.calls[0].prompt.includes('PRIVATE_CONTENT'));
});
test('an existing topic receives an appended summary without changing handwritten content or frontmatter', async () => {
  const f = fixture(), path = 'AI Knowledge/Probability/Independence.md', original = '---\naliases: [independent events]\n---\n# My explanation\nHandwritten proof\n';
  await f.vault.create(path, original); f.plugin.askClassification = async prompt => { f.calls.push({ prompt }); return plan({ action: 'existing', path }); };
  assert.equal(await f.queue(), path); assert(f.content.get(path).startsWith(original)); assert(f.content.get(path).includes('Events are independent'));
  assert.equal(f.vault.getMarkdownFiles().length, 1); const data = JSON.parse(f.calls[0].prompt.split('\n\n').at(-1)); assert.deepEqual(data.candidates, [{ path, title: 'Independence' }]); assert(!f.calls[0].prompt.includes('Handwritten proof'));
});
test('uncertain classifications go to Inbox with their routing reason', async () => {
  const f = fixture(); f.plugin.askClassification = async () => plan({ confidence: 0.5, reason: 'The subject is unclear.' });
  const path = await f.queue(); assert.equal(path, 'AI Knowledge/Inbox.md'); assert(f.content.get(path).includes('Classification needs review')); assert(f.content.get(path).includes('The subject is unclear.'));
});
test('bad JSON, request failures and unsafe destinations retain the original answer in Inbox', async () => {
  for (const result of ['not JSON', plan({ category: ['..'] }), plan({ category: ['C:\\Other'] }), plan({ title: 'CON' }), plan({ action: 'existing', path: 'Private/secret.md' }), null]) {
    const f = fixture(); f.plugin.askClassification = async () => { if (result === null) throw Error('Network unavailable'); return result; };
    const path = await f.queue(); assert.equal(path, 'AI Knowledge/Inbox.md'); assert(f.content.get(path).includes(f.reply.text)); assert(f.content.get(path).includes('original answer is retained'));
    assert([...f.files.keys()].every(path => path.startsWith('AI Knowledge')));
  }
});
test('disabled, off, streaming and failed answers make no classification request or file', async () => {
  for (const change of [{ settings: { autoClassify: false } }, { settings: { noteSaveMode: 'off' } }, { reply: { streaming: true } }, { reply: { error: true } }]) {
    const f = fixture(change.settings); Object.assign(f.reply, change.reply); assert.equal(await f.queue(), null); assert.equal(f.calls.length, 0); assert.equal(f.files.size, 0);
  }
  const f = fixture({ autoClassify: false, noteSaveMode: 'off' }); assert(await f.queue({}, true)); assert.equal(f.calls.length, 1);
});
test('concurrent queueing and restarts do not classify or append the same completed answer twice', async () => {
  const f = fixture(); const paths = await Promise.all([f.queue(), f.queue()]); assert.equal(paths[0], paths[1]); assert.equal(f.calls.length, 1);
  const original = f.content.get(paths[0]); f.plugin.knowledgeNotes = new KnowledgeNotes(f.plugin, JSON.parse(JSON.stringify(f.notes.serialize())));
  await f.queue(); assert.equal(f.calls.length, 1); assert.equal(f.content.get(paths[0]), original);
  await f.queue({}, true); assert.equal(f.calls.length, 1); assert.equal(f.content.get(paths[0]), original);
});
test('disabling classification or unloading during an unabortable transport prevents late writes', async () => {
  for (const unload of [false, true]) {
    const f = fixture(); let release, start; const started = new Promise(resolve => { start = resolve; });
    f.plugin.askClassification = () => { start(); return new Promise(resolve => { release = resolve; }); };
    const pending = f.queue(); await started;
    if (unload) f.plugin.disposed = true; else f.plugin.settings.autoClassify = false;
    f.notes.cancel(); release(plan()); assert.equal(await pending, null); assert.equal(f.files.size, 0); assert.equal(f.notes.records.size, 0);
  }
});
test('changing the knowledge folder cancels both active and queued work for the previous folder', async () => {
  const f = fixture(); let release, start; const started = new Promise(resolve => { start = resolve; });
  f.plugin.askClassification = (...args) => { f.calls.push(args); start(); return new Promise(resolve => { release = resolve; }); };
  const first = f.queue(); await started;
  const second = f.notes.queue('screen', newMessage('user', 'Next concept'), f.reply);
  f.plugin.settings.knowledgeFolder = 'Other Knowledge'; f.notes.cancel(); release(plan()); await Promise.all([first, second]);
  assert.equal(f.calls.length, 1); assert.equal(f.files.size, 0);
});
test('quickly disabling and re-enabling classification does not revive previously queued work', async () => {
  const f = fixture(); let release, start; const started = new Promise(resolve => { start = resolve; });
  f.plugin.askClassification = (...args) => { f.calls.push(args); start(); return new Promise(resolve => { release = resolve; }); };
  const first = f.queue(); await started; const second = f.notes.queue('screen', newMessage('user', 'Next concept'), f.reply);
  f.plugin.settings.autoClassify = false; f.notes.cancel(); f.plugin.settings.autoClassify = true;
  release(plan()); await Promise.all([first, second]); assert.equal(f.calls.length, 1); assert.equal(f.files.size, 0);
});
test('knowledge summaries keep headings below the entry and leave code intact', async () => {
  const f = fixture(); f.plugin.askClassification = async () => plan({ summary: '# Definition\n\n## Formula\n\n```md\n# Code example\n```' });
  const path = await f.queue(), text = f.content.get(path);
  assert(text.includes('### Definition')); assert(text.includes('### Formula')); assert(text.includes('```md\n# Code example\n```'));
});
test('per-answer saving archives only after a successful note write and supplies its link', async () => {
  const f = fixture({ noteSaveMode: 'answer', qaFolder: 'AI Q&A' }), archives = []; let finished = false;
  const create = f.vault.create; f.vault.create = async (...args) => { const file = await create(...args); finished = true; return file; };
  f.plugin.queueKnowledgeArchive = (...args) => { assert(finished); archives.push(args); };
  await Plugin.prototype.saveQAToNote.call(f.plugin, f.user.text, f.reply.text, { archiveKey: 'screen', archiveMessageId: f.user.id });
  assert.equal(archives.length, 1); assert(f.files.has(archives[0][3].transcriptPath)); assert.equal(archives[0][1].id, f.user.id);
  f.vault.create = async () => { throw Error('Disk unavailable'); }; finished = false;
  await Plugin.prototype.saveQAToNote.call(f.plugin, 'Another question', 'Answer'); assert.equal(archives.length, 1);
});
test('moved/deleted candidate notes are not recreated or written outside the allowed folder', async () => {
  const f = fixture(), path = 'AI Knowledge/Independence.md'; await f.vault.create(path, 'Handwritten content');
  f.plugin.askClassification = async () => { f.files.delete(path); return plan({ action: 'existing', path }); };
  assert.equal(await f.queue(), null); assert(!f.files.has(path)); assert.equal(f.notes.statuses.get('screen').state, 'error');
});
test('candidate selection is bounded, ranks relevant titles and excludes source/transcript and unrelated folders', async () => {
  const f = fixture();
  for (let i = 0; i < 150; i++) await f.vault.create(`AI Knowledge/Topic ${i}.md`, 'PRIVATE');
  await f.vault.create('AI Knowledge/Independence.md', 'PRIVATE'); await f.vault.create('AI Knowledge-other/Independence.md', 'PRIVATE');
  const candidates = candidatesFor(f.vault, 'AI Knowledge', 'Explain independence', ['AI Knowledge/Topic 0.md']);
  assert.equal(candidates.length, 120); assert.equal(candidates[0].title, 'Independence'); assert(!candidates.some(item => item.path.startsWith('AI Knowledge-other'))); assert(!candidates.some(item => item.path.endsWith('Topic 0.md')));
  assert.throws(() => parsePlan(plan({ action: 'existing', path: '../outside.md' }), candidates, 'AI Knowledge'));
});
test('a failed vault write does not poison the queue and malformed persisted bindings are discarded', async () => {
  const f = fixture(), create = f.vault.create; let first = true;
  f.vault.create = async (...args) => { if (first) { first = false; throw Error('Disk unavailable'); } return create(...args); };
  assert.equal(await f.queue(), null); assert(await f.queue());
  const raw = f.notes.serialize(), id = Object.keys(raw)[0]; raw[id].path = '../outside.md'; assert.equal(loadArchives(raw).size, 0);
});
test('renaming a topic note updates its persisted binding and deleting it allows safe re-archiving', async () => {
  const f = fixture(), path = await f.queue(), moved = 'AI Knowledge/Moved.md';
  const file = f.files.get(path); f.files.delete(path); file.path = moved; f.files.set(moved, file); f.content.set(moved, f.content.get(path)); f.content.delete(path); f.notes.rename(path, moved);
  assert.equal(await f.queue(), moved); assert.equal(f.calls.length, 1);
  f.files.delete(moved); f.notes.deleted(moved); assert(await f.queue()); assert.equal(f.calls.length, 2);
});
test('widget archives only successful complete answers, after conversation saving', async () => {
  const f = fixture(), source = new TFile('Source.md'), order = []; f.files.set(source.path, source);
  Object.assign(f.plugin, { activeFile: source, settings: { ...f.plugin.settings, contextMode: 'file', backend: 'api' }, messagesByNote: new Map(), currentModel: () => 'synthetic', runTask: (work, signal) => work(signal), readCurrentFile: async () => 'Synthetic context', ask: async () => 'Complete answer', saveConversation: async () => { order.push('save'); return 'AI Q&A/session.md'; }, queueKnowledgeArchive: () => { order.push('archive'); } });
  const widget = new CurrentNoteChatWidget(f.plugin); widget.inputEl = { value: 'Explain independence' }; widget.refresh = () => {};
  await widget.sendQuestion(); assert.equal(order.filter(item => item === 'archive').length, 1); assert.equal(order.at(-2), 'save'); assert.equal(order.at(-1), 'archive');
  let start; const started = new Promise(resolve => { start = resolve; }); f.plugin.ask = (...args) => { start(); return withAbort(new Promise(() => {}), args[5]); };
  widget.inputEl.value = 'Slow question'; const pending = widget.sendQuestion(); await started; widget.cancel(); await pending;
  assert.equal(order.filter(item => item === 'archive').length, 1);
});

test('renaming the source and manual archiving reuse the same stable message identity', async () => {
  const f = fixture(); const path = await f.notes.queue('source.md', f.user, f.reply), original = f.content.get(path);
  await f.notes.queue('renamed.md', f.user, f.reply, {}, true);
  assert.equal(f.calls.length, 1); assert.equal(f.content.get(path), original);
});

test('a persisted prepared write resumes after restart without repeating classification', async () => {
  const f = fixture(), create = f.vault.create; f.vault.create = async () => { throw Error('Disk unavailable'); };
  assert.equal(await f.queue(), null); assert.equal(f.calls.length, 1);
  const jobs = JSON.parse(JSON.stringify(f.notes.serializeJobs())); assert.equal(jobs[0].stage, 'prepared');
  f.vault.create = create; const restored = new KnowledgeNotes(f.plugin, f.notes.serialize(), jobs, f.notes.usage); f.plugin.knowledgeNotes = restored;
  restored.resume(); await restored.chain;
  assert.equal(f.calls.length, 1); assert.equal(restored.jobs.size, 0); assert(f.content.get(jobs[0].plan.path).includes('Events are independent'));
});

test('a crash after writing but before metadata commit does not append a second copy', async () => {
  const f = fixture(), create = f.vault.create; let crash = true;
  f.vault.create = async (...args) => { const file = await create(...args); if (crash) { crash = false; throw Error('Interrupted after write'); } return file; };
  assert.equal(await f.queue(), null); const jobs = f.notes.serializeJobs(), path = jobs[0].plan.path, original = f.content.get(path);
  const restored = new KnowledgeNotes(f.plugin, {}, jobs); f.plugin.knowledgeNotes = restored;
  restored.resume(); await restored.chain;
  assert.equal(f.content.get(path), original); assert.equal(f.calls.length, 1); assert.equal(restored.records.size, 1);
});

test('uncertain requests pause on restart and are not automatically charged again', async () => {
  const f = fixture(); let release, start; const started = new Promise(resolve => { start = resolve; });
  f.plugin.askClassification = (...args) => { f.calls.push(args); start(); return new Promise(resolve => { release = resolve; }); };
  const pending = f.queue(); await started; f.plugin.disposed = true; f.notes.cancel(true); release(plan()); await pending;
  f.plugin.disposed = false; const restored = new KnowledgeNotes(f.plugin, {}, f.notes.serializeJobs()); f.plugin.knowledgeNotes = restored;
  restored.resume(); await restored.chain;
  assert.equal(f.calls.length, 1); assert.equal(restored.jobs.values().next().value.stage, 'paused');
  assert.equal(await f.queue(), null); assert.equal(f.calls.length, 1);
  f.plugin.askClassification = async (...args) => { f.calls.push(args); return plan(); };
  assert(await restored.retry([...restored.jobs.keys()][0])); assert.equal(f.calls.length, 2);
});

test('a write conflict preserves manual edits and retries the saved plan without another AI call', async () => {
  const f = fixture(), path = 'AI Knowledge/Independence.md'; await f.vault.create(path, '# My note\nHandwritten.\n');
  f.plugin.askClassification = async (...args) => { f.calls.push(args); return plan({ action: 'existing', path }); };
  let changed = false; f.plugin.saveSettings = async () => { if (!changed && [...f.notes.jobs.values()].some(job => job.stage === 'prepared')) { changed = true; f.content.set(path, f.content.get(path) + 'A concurrent manual addition.\n'); } };
  assert.equal(await f.queue(), null); assert(f.content.get(path).includes('A concurrent manual addition')); assert(!f.content.get(path).includes('Events are independent'));
  assert(await f.notes.retry([...f.notes.jobs.keys()][0])); assert.equal(f.calls.length, 1); assert(f.content.get(path).includes('Handwritten.')); assert(f.content.get(path).includes('Events are independent'));
});

test('transcript failures retain a recovery job and never classify before saving succeeds', async () => {
  const f = fixture(), source = new TFile('Source.md'); f.files.set(source.path, source); let archives = 0;
  Object.assign(f.plugin, { activeFile: source, settings: { ...f.plugin.settings, contextMode: 'file', backend: 'api' }, messagesByNote: new Map(), currentModel: () => 'synthetic', runTask: (work, signal) => work(signal), readCurrentFile: async () => 'Context', ask: async () => 'Complete answer', saveConversation: async () => null, queueKnowledgeArchive: () => { archives++; } });
  const widget = new CurrentNoteChatWidget(f.plugin); widget.inputEl = { value: 'Question' }; widget.refresh = () => {};
  await widget.sendQuestion(); assert.equal(archives, 0); assert.equal(f.calls.length, 0); assert.equal(f.notes.jobs.size, 1);
  const job = [...f.notes.jobs.values()][0]; assert.equal(job.stage, 'transcript');
  f.plugin.saveConversation = async () => 'AI Q&A/recovered.md';
  await f.notes.retry(job.id); assert.equal(f.calls.length, 1); assert(f.content.get(job.plan.path).includes('AI Q&A/recovered.md'));
});

test('daily caps retain jobs while identical content reuses cached classification', async () => {
  const f = fixture({ classificationDailyLimit: 1 }); await f.queue();
  assert(await f.notes.queue('source2', newMessage('user', f.user.text), f.reply)); assert.equal(f.calls.length, 1);
  assert.equal(await f.notes.queue('source2', newMessage('user', 'Another question'), f.reply), null);
  assert.equal(f.calls.length, 1); assert.equal(f.notes.jobs.size, 1);
  f.notes.usage.day = '2000-01-01'; await f.notes.retry([...f.notes.jobs.keys()][0]); assert.equal(f.calls.length, 2);
});

test('generic questions use answer keywords and bilingual aliases without vault-wide enumeration', async () => {
  const f = fixture(); for (let i = 0; i < 130; i++) await f.vault.create(`AI Knowledge/Topic ${i}.md`, 'Private body');
  const path = 'AI Knowledge/Z独立性.md'; await f.vault.create(path, 'Candidate body not sent');
  f.vault.getMarkdownFiles = () => { throw Error('Must not enumerate the whole vault'); };
  assert.equal(candidatesFor(f.vault, 'AI Knowledge', 'Explain this', [], 'Two events are independent')[0].path, path);
  const aliasPath = 'AI Knowledge/Example.md'; await f.vault.create(aliasPath, 'Private body');
  const cache = { getFileCache: file => file.path === aliasPath ? { frontmatter: { aliases: ['Bayes theorem'] } } : {} };
  assert.equal(candidatesFor(f.vault, 'AI Knowledge', 'Bayesian updating', [], '', cache)[0].path, aliasPath);
});

test('archive status updates never rerender the entire conversation', async () => {
  const f = fixture(); let statusUpdates = 0;
  f.plugin.widget = { refreshArchive: () => { statusUpdates++; }, renderMessages: () => { throw Error('Status must not render chat'); } };
  f.plugin.refreshViews = () => { throw Error('Status must not refresh all views'); };
  await f.queue(); assert(statusUpdates >= 3);
});

test('explicit retry also recognizes a completed short write after a crash', async () => {
  const f = fixture(), create = f.vault.create; f.plugin.askClassification = async (...args) => { f.calls.push(args); return plan({ summary: 'Short definition.' }); };
  let crash = true; f.vault.create = async (...args) => { const file = await create(...args); if (crash) { crash = false; throw Error('Crash after write'); } return file; };
  assert.equal(await f.queue(), null); const job = [...f.notes.jobs.values()][0], original = f.content.get(job.plan.path);
  assert(await f.notes.retry(job.id)); assert.equal(f.content.get(job.plan.path), original); assert.equal(f.calls.length, 1);
});

test('undo removes only an unchanged owned section and invalidates identical-content cache bindings', async () => {
  const f = fixture(), path = 'AI Knowledge/Independence.md'; await f.vault.create(path, '# User note\nA handwritten proof.\n');
  f.plugin.askClassification = async (...args) => { f.calls.push(args); return plan({ action: 'existing', path }); };
  await f.queue(); await f.notes.queue('source2', newMessage('user', f.user.text), f.reply);
  const first = [...f.notes.records.keys()][0]; assert.equal(f.notes.records.size, 2);
  assert(await f.notes.undo(first)); assert(f.content.get(path).includes('A handwritten proof.')); assert(!f.content.get(path).includes('Events are independent')); assert.equal(f.notes.records.size, 0);
  await f.queue(); const id = [...f.notes.records.keys()][0]; f.content.set(path, 'Inserted by user.\n' + f.content.get(path));
  const edited = f.content.get(path); await assert.rejects(f.notes.undo(id), /edited or shifted/); assert.equal(f.content.get(path), edited);
});

test('persisting the journal must succeed before any paid request is sent', async () => {
  const f = fixture(); f.plugin.saveSettings = async () => { throw Error('Data storage unavailable'); };
  assert.equal(await f.queue(), null); assert.equal(f.calls.length, 0); assert.equal(f.vault.getMarkdownFiles().length, 0);
});

test('cancelled individual tasks cannot resume after late provider results', async () => {
  const f = fixture(); let release, start; const started = new Promise(resolve => { start = resolve; });
  f.plugin.askClassification = () => { start(); return new Promise(resolve => { release = resolve; }); };
  const pending = f.queue(); await started; f.notes.dismiss([...f.notes.jobs.keys()][0]); release(plan());
  assert.equal(await pending, null); assert.equal(f.notes.jobs.size, 0); assert.equal(f.vault.getMarkdownFiles().length, 0);
});

test('legacy path-based bindings migrate before a source rename', async () => {
  const f = fixture(), path = await f.queue(); const { hash } = require('../src/archive-journal');
  const legacy = { [hash(`source.md:${f.user.id}`)]: [...f.notes.records.values()][0] };
  f.plugin.messagesByNote = new Map([['source.md', [f.user, f.reply]]]);
  const restored = new KnowledgeNotes(f.plugin, legacy); await restored.queue('renamed.md', f.user, f.reply);
  assert.equal(f.calls.length, 1); assert.equal(f.content.get(path).split('Events are independent').length - 1, 1);
});
