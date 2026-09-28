const test = require('node:test');
const assert = require('node:assert/strict');
const { install, TFile, MarkdownView } = require('./helpers/obsidian.cjs');
install();
const Plugin = require('../src/main');
const { CurrentNoteChatWidget } = require('../src/ui/widget');
const { newMessage } = require('../src/sessions');
const { withAbort } = require('../src/tasks');
function widgetFixture(thread) {
  const file = new TFile('note.md'); let saved = 0; const questions = [];
  const plugin = {
    settings: { contextMode: 'file', backend: 'api', previewScreenshot: false }, activeFile: file,
    messagesByNote: new Map([[file.path, thread]]), app: { vault: { getAbstractFileByPath: () => file } },
    queueSaveSessions: () => {}, currentModel: () => 'test-model',
    getEditableMarkdownView: () => null,
    saveQAToNote: async () => { saved++; }, runTask: (work, signal) => work(signal),
    readCurrentFile: async () => 'Current file context',
    ask: async (...args) => { questions.push(args); return 'retry answer'; }
  };
  const widget = new CurrentNoteChatWidget(plugin);
  widget.inputEl = { value: '' }; widget.refresh = () => {};
  return { widget, plugin, questions, saved: () => saved };
}
test('retrying an older error uses that question and retains later conversation', async () => {
  const first = newMessage('user', 'first question'), error = newMessage('assistant', 'failed', { error: true, replyTo: first.id });
  const latest = newMessage('user', 'latest question'), answer = newMessage('assistant', 'latest answer', { replyTo: latest.id });
  const thread = [first, error, latest, answer]; const fixture = widgetFixture(thread);
  fixture.widget.cacheSnapshot(first.id, { mode: 'file', source: 'note.md', question: first.text, history: [], noteText: 'Original file context' });
  await fixture.widget.sendQuestion(first.id);
  assert.equal(fixture.questions[0][3], 'first question'); assert.equal(fixture.questions[0][1], 'Original file context');
  assert.equal(thread.length, 4); assert.equal(thread[3].text, 'latest answer'); assert.equal(thread[1].text, 'retry answer');
});
test('screen retries reuse cached screenshots rather than capturing a new monitor', async () => {
  const first = newMessage('user', 'screen question');
  const fixture = widgetFixture([first, newMessage('assistant', 'failed', { error: true, replyTo: first.id })]);
  fixture.plugin.settings.contextMode = 'screen'; fixture.plugin.messagesByNote = new Map([['__current_screen__', fixture.plugin.messagesByNote.get('note.md')]]);
  let captures = 0, image;
  fixture.plugin.captureCurrentScreen = () => { captures++; throw new Error('Should not capture'); };
  fixture.plugin.askScreen = async screenshot => { image = screenshot; return 'screen answer'; };
  fixture.widget.cacheSnapshot(first.id, { mode: 'screen', screenshot: 'data:image/png;base64,ORIGINAL', history: [] });
  await fixture.widget.sendQuestion(first.id);
  assert.equal(captures, 0); assert.equal(image, 'data:image/png;base64,ORIGINAL');
});
test('stopping a request never auto-saves a partial answer', async () => {
  const fixture = widgetFixture([]); fixture.widget.inputEl.value = 'question';
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  fixture.plugin.ask = (...args) => { started(); return withAbort(new Promise(() => {}), args[5]); };
  const pending = fixture.widget.sendQuestion(); await ready; fixture.widget.cancel(); await pending;
  assert.equal(fixture.saved(), 0); assert(fixture.plugin.messagesByNote.get('note.md').at(-1).error); assert.equal(fixture.widget.busy, false);
});
test('note revisions reject intervening changes and preserve editor undo operations', async () => {
  const plugin = new Plugin(); const file = new TFile('note.md'); const view = new MarkdownView();
  view.file = file; let text = 'Original'; let writes = 0;
  view.editor = { getValue: () => text, lastLine: () => 0, getLine: () => text, replaceRange: value => { writes++; text = value; } };
  plugin.app = { vault: { getAbstractFileByPath: () => file }, workspace: { getActiveViewOfType: () => view } }; plugin.refreshViews = () => {};
  const proposal = { file, view, editor: view.editor, scope: 'document', wholeText: 'Original' };
  text = 'New user edit'; await assert.rejects(plugin.applyEditProposal(proposal, 'AI edit'), /note changed/); assert.equal(writes, 0);
  text = 'Original'; await plugin.applyEditProposal(proposal, 'AI edit'); assert.equal(writes, 1); assert.equal(text, 'AI edit');
});
test('settings and chat persistence serialize writes in order', async () => {
  const plugin = new Plugin(); plugin.settings = { backend: 'api' }; plugin.messagesByNote = new Map(); plugin._saveChain = Promise.resolve();
  const seen = []; let active = 0;
  plugin.saveData = async data => { active++; assert.equal(active, 1); await new Promise(resolve => setTimeout(resolve, 5)); seen.push(data.backend); active--; };
  const first = plugin.saveSettings(); plugin.settings.backend = 'codex'; const second = plugin.saveSettings(); await Promise.all([first, second]);
  assert.deepEqual(seen, ['api', 'codex']);
});
test('legacy chat history migrates through plugin data without overwriting the legacy file', async () => {
  const plugin = new Plugin(); const legacy = JSON.stringify({ 'note.md': [{ role: 'user', text: 'legacy question' }, { role: 'assistant', text: 'legacy answer' }] });
  let legacyReads = 0, writes = 0, saved;
  plugin.manifest = { dir: 'plugins/current-note-chat' };
  plugin.loadData = async () => ({ backend: 'api', apiSecretName: 'synthetic-secret' });
  plugin.saveData = async data => { saved = data; };
  for (const name of ['registerView', 'addSettingTab', 'addRibbonIcon', 'addCommand', 'registerEvent']) plugin[name] = () => {};
  plugin.app = { vault: { adapter: { exists: async () => true, read: async () => { legacyReads++; return legacy; }, write: async () => { writes++; } }, on: () => null }, workspace: { on: () => null, onLayoutReady: () => {} } };
  await plugin.onload(); await plugin.saveSettings();
  assert.equal(legacyReads, 1); assert.equal(writes, 0); assert.equal(saved.apiSecretName, 'synthetic-secret'); assert.equal(saved.sessionHistory['note.md'][1].text, 'legacy answer');
  plugin.loadData = async () => saved; await plugin.onload(); assert.equal(legacyReads, 1);
  assert.equal(plugin.messagesByNote.get('note.md').length, 2);
});
test('expired screenshot snapshots are actually removed from memory', () => {
  const fixture = widgetFixture([]);
  fixture.widget.snapshots.set('expired', { at: Date.now() - 600001, snapshot: { screenshot: 'synthetic' } });
  fixture.widget.pruneSnapshots(); assert.equal(fixture.widget.snapshots.size, 0);
});
test('streaming updates retain earlier bubbles and preserve a reader scrolling in history', async context => {
  const { Element } = require('./helpers/element.cjs'); const originalDocument = global.document;
  global.document = { body: new Element('body') }; context.after(() => { global.document = originalDocument; });
  const user = newMessage('user', 'question'), reply = newMessage('assistant', '', { streaming: true, replyTo: user.id });
  const fixture = widgetFixture([user, reply]);
  CurrentNoteChatWidget.prototype.refresh.call(fixture.widget); // No-op before mount.
  fixture.widget.refresh = CurrentNoteChatWidget.prototype.refresh;
  fixture.widget.mount();
  const bubble = fixture.widget.messagesEl.children[0], component = fixture.widget.renderComponent;
  fixture.widget.messagesEl.scrollHeight = 1000; fixture.widget.messagesEl.scrollTop = 10;
  fixture.widget.updateStreamingMessage(reply, 'First delta'); await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(fixture.widget.messagesEl.children[0], bubble); assert.equal(fixture.widget.renderComponent, component);
  assert.equal(fixture.widget.streamingElements.get(reply.id).text, 'First delta'); assert.equal(fixture.widget.messagesEl.scrollTop, 10);
  fixture.widget.unmount();
});
test('cancelling screenshot preview resolves without sending the screenshot', async context => {
  const { Element } = require('./helpers/element.cjs'); const originalDocument = global.document;
  global.document = { body: new Element('body') }; context.after(() => { global.document = originalDocument; });
  const { previewScreenshot } = require('../src/ui/screenshot-preview');
  const controller = new AbortController(); const pending = previewScreenshot({}, 'data:image/png;base64,SYNTHETIC', controller.signal);
  controller.abort(); assert.equal(await pending, null);
});

test('compact toolbar actions have accessible names and open the plugin settings', context => {
  const { Element } = require('./helpers/element.cjs'); const originalDocument = global.document;
  global.document = { body: new Element('body') }; context.after(() => { global.document = originalDocument; });
  const fixture = widgetFixture([]); let opened;
  fixture.plugin.openSettings = () => { opened = true; };
  fixture.widget.refresh = CurrentNoteChatWidget.prototype.refresh;
  fixture.widget.mount(); context.after(() => fixture.widget.unmount());
  const buttons = [];
  const visit = element => { if (element.tag === 'button') buttons.push(element); element.children.forEach(visit); };
  visit(fixture.widget.rootEl);
  assert(buttons.every(button => button.text || button.attributes['aria-label']));
  const settings = buttons.find(button => button.attributes['aria-label'] === 'Plugin settings');
  settings.listeners.click(); assert.equal(opened, true);
  assert.equal(fixture.widget.exportButton.attributes['aria-label'], 'View note');
  assert.match(fixture.widget.statusEl.text, /Auto-save/);
});

test('settings shortcut targets this plugin rather than another settings tab', () => {
  const plugin = new Plugin(); const calls = [];
  plugin.manifest = { id: 'current-note-chat' };
  plugin.app = { setting: { open: () => calls.push('open'), openTabById: id => calls.push(id) } };
  plugin.openSettings(); assert.deepEqual(calls, ['open', 'current-note-chat']);
});
