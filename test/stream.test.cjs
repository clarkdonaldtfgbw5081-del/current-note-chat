const test = require('node:test');
const assert = require('node:assert/strict');
const { readSSE, requestChat } = require('../src/stream');
function body(chunks) {
  return new ReadableStream({ start(controller) {
    for (const chunk of chunks) controller.enqueue(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
    controller.close();
  } });
}
const delta = text => 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\r\n\r\n';
const config = { url: 'https://example.invalid/chat/completions', headers: {}, model: 'test' };
test('SSE decodes Chinese text split at every UTF-8 byte', async () => {
  const bytes = new TextEncoder().encode(delta('你好') + 'data: [DONE]\r\n\r\n');
  assert.equal(await readSSE(body([...bytes].map(byte => Uint8Array.of(byte))), () => {}), '你好');
});
test('SSE consumes a final unterminated event with finish_reason', async () => {
  const event = 'data: ' + JSON.stringify({ choices: [{ delta: { content: 'complete' }, finish_reason: 'stop' }] });
  assert.equal(await readSSE(body([event]), () => {}), 'complete');
});
test('SSE rejects disconnection after partial output', async () => {
  await assert.rejects(readSSE(body([delta('partial')]), () => {}), /before the answer completed/);
});
test('SSE surfaces provider error after partial text', async () => {
  await assert.rejects(readSSE(body([delta('partial'), 'data: {"error":{"message":"generation failed"}}\n\n']), () => {}), /generation failed/);
});
test('SSE rejects malformed events and token limit truncation', async () => {
  await assert.rejects(readSSE(body(['data: broken\n\n']), () => {}), /Malformed/);
  await assert.rejects(readSSE(body([delta('partial'), 'data: {"choices":[{"finish_reason":"length"}]}\n\n']), () => {}), /stopped early/);
});
test('SSE returns on DONE without waiting for connection closure', async () => {
  let reads = 0;
  const source = { getReader: () => ({ read: async () => {
    reads++; if (reads > 1) throw new Error('Read after DONE');
    return { done: false, value: new TextEncoder().encode(delta('ready') + 'data: [DONE]\n\n') };
  }, cancel: () => {}, releaseLock: () => {} }) };
  assert.equal(await readSSE(source, () => {}), 'ready'); assert.equal(reads, 1);
});
test('401 and network errors never cause duplicate non-streaming requests', async () => {
  let repeats = 0;
  const request = async () => { repeats++; };
  await assert.rejects(requestChat({ config, body: {}, onDelta: () => {}, request, fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid key' } }) }) }), /401/);
  await assert.rejects(requestChat({ config, body: {}, onDelta: () => {}, request, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), /Failed to fetch/);
  assert.equal(repeats, 0);
});
test('explicit unsupported streaming allows a single fallback', async () => {
  let repeats = 0;
  const answer = await requestChat({ config, body: {}, onDelta: () => {}, request: async () => { repeats++; return { status: 200, json: { choices: [{ message: { content: 'fallback' } }] } }; }, fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'stream is not supported' } }) }) });
  assert.equal(answer, 'fallback'); assert.equal(repeats, 1);
});
test('a JSON response to stream=true is accepted without resending', async () => {
  let repeats = 0;
  const answer = await requestChat({ config, body: {}, onDelta: () => {}, request: () => { repeats++; }, fetchImpl: async () => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => ({ choices: [{ message: { content: 'whole answer' } }] }) }) });
  assert.equal(answer, 'whole answer'); assert.equal(repeats, 0);
});
