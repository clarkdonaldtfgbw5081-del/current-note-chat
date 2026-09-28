const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const { runProcess } = require('../src/codex');
test('Codex runner consumes the final JSONL event even without a newline', async () => {
  const code = 'process.stdout.write(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"final answer"}}))';
  assert.equal(await runProcess(process.execPath, ['-e', code], { cwd: os.tmpdir(), json: true }), 'final answer');
});
test('Codex runner rejects process errors instead of treating earlier text as success', async () => {
  const code = 'console.log(JSON.stringify({type:"item.completed",item:{type:"agent_message",text:"partial"}}));console.log(JSON.stringify({type:"turn.failed",error:{message:"failure"}}))';
  await assert.rejects(runProcess(process.execPath, ['-e', code], { cwd: os.tmpdir(), json: true }), /failure/);
});
test('Codex subprocess is terminated when a request is cancelled', async () => {
  const controller = new AbortController();
  const pending = runProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { cwd: os.tmpdir(), signal: controller.signal });
  setTimeout(() => controller.abort(new Error('cancelled by user')), 50);
  await assert.rejects(pending, /cancelled by user/);
});
