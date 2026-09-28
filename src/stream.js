const { throwIfAborted, withAbort } = require('./tasks');
const MAX_RESPONSE_CHARS = 64000;
class StreamingUnsupportedError extends Error {}
class IncompleteStreamError extends Error {}

async function responseError(response) {
  let detail = '';
  try { detail = (await response.json())?.error?.message || ''; } catch { /* Non-JSON upstream errors. */ }
  const error = new Error(`HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 240)}` : ''}`);
  error.status = response.status;
  if ([405, 406, 501].includes(response.status) || response.status === 400 && /stream.*(unsupported|not supported|not implemented)/i.test(detail)) return new StreamingUnsupportedError(error.message);
  return error;
}

/** Decode SSE across arbitrary byte boundaries, including CRLF and final unterminated lines. */
async function readSSE(body, onDelta, signal) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];
  let eventChars = 0;
  let full = '';
  let finished = false;
  let doneMarker = false;
  const dispatch = () => {
    if (!dataLines.length) return;
    const payload = dataLines.join('\n').trim();
    dataLines = [];
    eventChars = 0;
    if (payload === '[DONE]') { doneMarker = true; return; }
    let event;
    try { event = JSON.parse(payload); } catch { throw new IncompleteStreamError('Malformed event received from the AI service.'); }
    if (event.error) throw new Error(String(event.error.message || event.error).slice(0, 240));
    const choice = event.choices?.[0];
    if (['length', 'content_filter'].includes(choice?.finish_reason)) throw new IncompleteStreamError(`Response stopped early: ${choice.finish_reason}.`);
    if (choice?.finish_reason) finished = true;
    const delta = choice?.delta?.content;
    if (typeof delta === 'string' && delta) {
      full += delta;
      if (full.length > MAX_RESPONSE_CHARS) throw new Error('The answer exceeds the response size limit.');
      throwIfAborted(signal);
      onDelta(full);
    }
  };
  const line = value => {
    const clean = value.replace(/\r$/, '');
    if (!clean) return dispatch();
    if (clean.startsWith('data:')) {
      eventChars += clean.length;
      if (eventChars > 1024 * 1024) throw new Error('The streaming event exceeds the size limit.');
      dataLines.push(clean.slice(5).replace(/^ /, ''));
    }
  };
  const consume = () => {
    let index;
    while (!doneMarker && (index = buffer.indexOf('\n')) !== -1) {
      const value = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      line(value);
    }
    if (buffer.length > 1024 * 1024) throw new Error('The streaming event exceeds the size limit.');
  };
  try {
    while (!doneMarker) {
      throwIfAborted(signal);
      const { done, value } = await withAbort(reader.read(), signal);
      if (done) {
        buffer += decoder.decode();
        consume();
        if (buffer && !doneMarker) line(buffer);
        dispatch();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      consume();
    }
    throwIfAborted(signal);
    if (!doneMarker && !finished) throw new IncompleteStreamError('The connection closed before the answer completed. Please retry.');
    if (!full.trim()) throw new Error('The AI service returned no displayable answer.');
    return full;
  } finally {
    // Do not wait for a broken transport to acknowledge cancellation.
    Promise.resolve(reader.cancel()).catch(() => {});
    reader.releaseLock();
  }
}

async function streamChat(url, headers, body, onDelta, signal, fetchImpl = fetch) {
  throwIfAborted(signal);
  const response = await withAbort(fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal }), signal);
  if (!response.ok) throw await responseError(response);
  if (/application\/json/i.test(response.headers?.get('content-type') || '')) {
    const data = await withAbort(response.json(), signal);
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) throw new Error('The AI service returned no displayable answer.');
    if (answer.length > MAX_RESPONSE_CHARS) throw new Error('The answer exceeds the response size limit.');
    onDelta(answer);
    return answer;
  }
  if (!response.body) throw new IncompleteStreamError('The AI service returned no response stream.');
  return readSSE(response.body, onDelta, signal);
}

async function requestChat({ config, body, onDelta, signal, request, fetchImpl }) {
  if (onDelta) {
    try { return await streamChat(config.url, config.headers, { ...body, stream: true }, onDelta, signal, fetchImpl); }
    catch (error) { if (!(error instanceof StreamingUnsupportedError)) throw error; }
  }
  throwIfAborted(signal);
  const response = await withAbort(request({ url: config.url, method: 'POST', headers: config.headers, body: JSON.stringify({ ...body, stream: false }), throw: false }), signal);
  if (response.status < 200 || response.status >= 300) {
    const error = new Error(`HTTP ${response.status}: ${String(response.json?.error?.message || 'API request failed').slice(0, 240)}`);
    error.status = response.status;
    throw error;
  }
  const content = response.json?.choices?.[0]?.message?.content;
  const answer = typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => part?.text || '').join('\n') : '';
  if (!answer.trim()) throw new Error('The AI service returned no displayable answer.');
  if (answer.length > MAX_RESPONSE_CHARS) throw new Error('The answer exceeds the response size limit.');
  return answer.trim();
}
module.exports = { StreamingUnsupportedError, IncompleteStreamError, readSSE, streamChat, requestChat };
