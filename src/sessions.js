const { randomUUID } = require('node:crypto');
const { MAX_SESSION_KEYS, MAX_SESSION_MESSAGES } = require('./constants');
const MAX_MESSAGE_CHARS = 64000;
function newMessage(role, text, extra = {}) {
  return { id: randomUUID(), role, text: String(text).slice(0, MAX_MESSAGE_CHARS), ...extra };
}
/** @param {Map<string, import('./types').ChatMessage[]>} sessions */
function trimSessions(sessions) {
  for (const thread of sessions.values()) {
    if (thread.length > MAX_SESSION_MESSAGES) thread.splice(0, thread.length - MAX_SESSION_MESSAGES);
    while (thread.length && thread[0].role !== 'user') thread.shift();
  }
  while (sessions.size > MAX_SESSION_KEYS) sessions.delete(sessions.keys().next().value);
}
function loadSessions(raw) {
  const sessions = new Map();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return sessions;
  for (const [key, value] of Object.entries(raw).slice(-MAX_SESSION_KEYS)) {
    if (!key || key.length > 4096 || !Array.isArray(value)) continue;
    const thread = [];
    let questionId;
    for (const candidate of value.slice(-MAX_SESSION_MESSAGES)) {
      if (!candidate || !['user', 'assistant'].includes(candidate.role) || typeof candidate.text !== 'string') continue;
      const message = newMessage(candidate.role, candidate.text, { id: typeof candidate.id === 'string' && candidate.id.length <= 128 ? candidate.id : randomUUID() });
      if (message.role === 'user') questionId = message.id;
      else {
        message.replyTo = questionId;
        if (candidate.error || candidate.streaming) message.error = true;
        if (candidate.streaming) message.text = 'The previous response was interrupted. Please retry.';
      }
      thread.push(message);
    }
    if (thread.length) sessions.set(key, thread);
  }
  trimSessions(sessions);
  return sessions;
}
function touchSession(sessions, key, thread) {
  sessions.delete(key);
  sessions.set(key, thread);
  trimSessions(sessions);
}
function serializeSessions(sessions) {
  trimSessions(sessions);
  return Object.fromEntries([...sessions].map(([key, thread]) => [key, thread.map(message => ({
    id: message.id, role: message.role, text: message.text.slice(0, MAX_MESSAGE_CHARS),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    ...(message.error || message.streaming ? { error: true } : {})
  }))]));
}
module.exports = { MAX_MESSAGE_CHARS, newMessage, trimSessions, loadSessions, touchSession, serializeSessions };
