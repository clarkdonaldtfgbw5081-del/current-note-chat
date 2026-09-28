const test = require('node:test');
const assert = require('node:assert/strict');
const { selectRelevantContext } = require('../src/retrieval');
const { loadSessions, trimSessions, serializeSessions, touchSession, newMessage } = require('../src/sessions');
const { selectScreenSource } = require('../src/screen');
const { TaskManager, withAbort } = require('../src/tasks');
const { safeFolder } = require('../src/note-path');
test('long PDF pages retain the matching passage with its page number', () => {
  const input = '[Page 1]\n' + 'x'.repeat(6500) + ' UNIQUE_TARGET\n[Page 2]\nUnrelated text.';
  const context = selectRelevantContext(input, 'UNIQUE_TARGET');
  assert(context.partial); assert(context.text.includes('UNIQUE_TARGET')); assert(context.text.includes('[Page 1]')); assert(context.text.length <= 6000);
});
test('a broad summary samples the start, middle and end of the file', () => {
  const input = 'BEGIN' + 'a'.repeat(8000) + 'MIDDLE' + 'b'.repeat(8000) + 'END';
  const context = selectRelevantContext(input, 'summarize everything');
  assert(context.text.includes('BEGIN')); assert(context.text.includes('END')); assert(context.text.length <= 6000);
});
test('legacy history is validated and interrupted answers become retryable errors', () => {
  const sessions = loadSessions({ note: [{ role: 'user', text: 'question' }, { role: 'assistant', text: 'partial', streaming: true }, { role: 'system', text: 'bad' }, { role: 'user', text: 123 }] });
  const thread = sessions.get('note'); assert.equal(thread.length, 2); assert(thread[1].error); assert.equal(thread[1].replyTo, thread[0].id);
});
test('message and session limits apply in memory and include the screen session', () => {
  const sessions = new Map();
  for (let i = 0; i < 45; i++) sessions.set('note-' + i, Array.from({ length: 100 }, (_, n) => newMessage(n % 2 ? 'assistant' : 'user', 'text')));
  touchSession(sessions, '__current_screen__', [newMessage('user', 'screen')]); trimSessions(sessions);
  assert.equal(sessions.size, 40); assert(sessions.has('__current_screen__'));
  for (const thread of sessions.values()) assert(thread.length <= 80);
  assert.equal(Object.keys(serializeSessions(sessions)).length, 40);
});
test('touching an old session protects it from recency eviction', () => {
  const sessions = new Map(Array.from({ length: 40 }, (_, i) => [String(i), [newMessage('user', 'q')]]));
  touchSession(sessions, '0', sessions.get('0')); touchSession(sessions, 'new', [newMessage('user', 'q')]);
  assert(sessions.has('0')); assert(!sessions.has('1'));
});
test('missing and empty display IDs never fall back to another monitor', () => {
  const thumbnail = { isEmpty: () => false };
  assert.throws(() => selectScreenSource([{ display_id: '2', thumbnail }], 1), /No screenshot was sent/);
  assert.throws(() => selectScreenSource([{ display_id: '', thumbnail }], 1), /No screenshot was sent/);
  assert.equal(selectScreenSource([{ display_id: '1', thumbnail }], 1).display_id, '1');
});
test('timeout and unload terminate waiting tasks; future work is rejected', async () => {
  const manager = new TaskManager();
  await assert.rejects(manager.run(0.02, () => new Promise(() => {})), /timed out/);
  const pending = manager.run(10, () => new Promise(() => {})); manager.dispose();
  await assert.rejects(pending, /unloaded/); await assert.rejects(manager.run(10, () => 'late'), /unloaded/);
  assert.equal(manager.controllers.size, 0);
});
test('cancellation suppresses late responses from an uncancellable transport', async () => {
  const controller = new AbortController(); let resolve;
  const pending = withAbort(new Promise(done => { resolve = done; }), controller.signal);
  controller.abort(); await assert.rejects(pending); resolve('late');
});
test('note output folders remain inside the vault', () => {
  const normalize = path => path.replace(/\/+/g, '/');
  assert.throws(() => safeFolder('../outside', normalize, 'AI Q&A'));
  assert.throws(() => safeFolder('C:\\outside', normalize, 'AI Q&A'));
  assert.equal(safeFolder('Notes\\AI', normalize, 'AI Q&A'), 'Notes/AI');
});
