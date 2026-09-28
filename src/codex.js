const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
function findCodexExecutable(configuredPath) {
  if (configuredPath.trim()) return configuredPath.trim();
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const root = path.join(process.env.LOCALAPPDATA, "OpenAI", "Codex", "bin");
    try {
      const choices = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name, "codex.exe")).filter((candidate) => fs.existsSync(candidate)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (choices.length) return choices[0];
    } catch {
    }
  }
  return "codex";
}

const { abortError, throwIfAborted } = require('./tasks');
function killProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const helper = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    helper.on('error', () => child.kill());
    helper.on('close', code => { if (code !== 0) child.kill(); });
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
  }
}
function runProcess(executable, args, { signal, cwd, prompt, json = false, onDelta }) {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    let pending = '', output = '', stderr = '', message = '', total = 0, failure;
    const parse = line => {
      try {
        const event = JSON.parse(line);
        if (event.type === 'item.completed' && event.item?.type === 'agent_message') {
          message = event.item.text || message;
          if (message.length > 64000) { failure = new Error('Codex answer exceeds the size limit.'); killProcessTree(child); return; }
          if (!signal?.aborted) onDelta?.(message);
        }
        if (event.type === 'turn.failed' || event.type === 'error') failure = new Error(event.error?.message || event.message || 'Codex failed.');
      } catch { /* CLI emits JSONL; non-event lines are ignored. */ }
    };
    const onAbort = () => { failure = signal.reason || abortError(); killProcessTree(child); };
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      total += chunk.length;
      if (total > 2000000) { failure = new Error('Codex returned too much data.'); killProcessTree(child); return; }
      if (json) {
        pending += chunk;
        const lines = pending.split('\n'); pending = lines.pop() || '';
        for (const line of lines) parse(line);
      } else output = (output + chunk).slice(-4000);
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1500); });
    child.on('error', error => { failure = error; });
    child.on('close', code => {
      signal?.removeEventListener('abort', onAbort);
      if (pending.trim()) parse(pending);
      const answer = json ? message.trim() : (output || stderr).trim();
      if (failure) reject(failure);
      else if (code !== 0 || !answer) reject(new Error(`Codex exited without an answer (${code}): ${stderr.slice(-400)}`));
      else resolve(answer);
    });
    child.stdin.on('error', () => {}); child.stdin.end(prompt || '');
    if (signal?.aborted) onAbort();
  });
}
async function runCodex(settings, prompt, screenshot, signal, onDelta) {
  throwIfAborted(signal);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'current-note-chat-'));
  let imagePath;
  try {
    const args = ['exec', '--json', '--ephemeral', '--sandbox', 'read-only', '--skip-git-repo-check', '--color', 'never'];
    if (settings.codexIgnoreUserConfig !== false) args.push('--ignore-user-config');
    if (screenshot) {
      imagePath = path.join(directory, 'screen.png');
      fs.writeFileSync(imagePath, Buffer.from(screenshot.slice('data:image/png;base64,'.length), 'base64'), { mode: 0o600 });
      args.push('--image', imagePath);
    }
    args.push('-');
    return await runProcess(findCodexExecutable(settings.codexPath), args, { cwd: directory, prompt, signal, json: true, onDelta });
  } finally {
    if (imagePath) { try { fs.unlinkSync(imagePath); } catch { /* The OS can keep a failed child handle briefly. */ } }
    try { fs.rmdirSync(directory); } catch { /* Preserve rather than recursively remove an unexpected directory. */ }
  }
}
module.exports = { findCodexExecutable, runProcess, runCodex };
