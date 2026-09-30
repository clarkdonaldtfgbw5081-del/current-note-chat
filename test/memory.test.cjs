const test = require('node:test');
const assert = require('node:assert/strict');
const { install, TFile } = require('./helpers/obsidian.cjs');
install();
const { recallMemories, memoryBlock, loadHits, serializeHits, reinforce, bestSnippet } = require('../src/memory');
const { buildPrompt, buildScreenPrompt } = require('../src/prompts');
const { MEMORY_MAX_ENTRIES, MEMORY_MAX_CHARS } = require('../src/constants');
const { newMessage } = require('../src/sessions');

function folderFixture(notes, threads = new Map(), hits = new Map()) {
  const files = new Map(), content = new Map(), aliases = new Map();
  const root = { path: 'AI 知识库', children: [] };
  for (const [name, body, alias] of notes) {
    const file = new TFile(`AI 知识库/${name}.md`);
    files.set(file.path, file); content.set(file.path, body); root.children.push(file);
    if (alias) aliases.set(file.path, alias);
  }
  const vault = {
    getAbstractFileByPath: path => (path === 'AI 知识库' ? root : files.get(path)),
    read: async file => content.get(file.path)
  };
  const metadataCache = { getFileCache: file => (aliases.get(file.path) ? { frontmatter: { aliases: [aliases.get(file.path)] } } : {}) };
  const run = question => recallMemories({ vault, metadataCache, folder: 'AI 知识库', threads, hits }, question);
  return { run, content, files };
}

test('recalls the matching knowledge note snippet and skips unrelated ones', async () => {
  const f = folderFixture([
    ['独立性', '别的段落。\n\n两个事件独立要求 P(A∩B)=P(A)P(B)；互斥时交集为空，两者一般不能同时成立。\n\n结尾段。'],
    ['回归分析', '回归系数的最小二乘估计及其性质。']
  ]);
  const entries = await f.run('独立事件和互斥事件的关系是什么');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].kind, 'note');
  assert.equal(entries[0].path, 'AI 知识库/独立性.md');
  assert.match(entries[0].snippet, /P\(A∩B\)=P\(A\)P\(B\)/);
  const block = memoryBlock(entries);
  assert.match(block, /auto-recalled/);
  assert.match(block, /authoritative source/);
  assert.match(block, /独立性\.md/);
  assert.equal(memoryBlock([]), '');
});

test('aliases widen recall and thread questions carry their answers', async () => {
  const q = newMessage('user', 'conditional variance 条件方差怎么算');
  const a = newMessage('assistant', '条件方差 = 边际方差 − 回归部分。', { replyTo: q.id });
  const f = folderFixture([['正态分布', '多元正态的边际与条件分布。', 'conditional distribution 条件分布']], new Map([['course/note.md', [q, a]]]));
  const entries = await f.run('条件方差 conditional variance 是什么');
  const kinds = Object.fromEntries(entries.map(entry => [entry.kind, entry]));
  assert.ok(kinds.thread, 'past question recalled');
  assert.match(kinds.thread.snippet, /条件方差/);
  assert.match(kinds.thread.snippet, /边际方差/);
  assert.ok(kinds.note || entries.some(entry => entry.kind === 'note'), 'aliased note recalled');
});

test('caps entries, characters and drops below-threshold noise', async () => {
  const notes = Array.from({ length: 8 }, (_, index) => [`方差笔记${index}`, `方差相关内容 ${index}：样本方差的自由度是 n-1。`]);
  const f = folderFixture(notes);
  const entries = await f.run('样本方差 自由度 方差');
  assert.ok(entries.length <= MEMORY_MAX_ENTRIES);
  assert.ok(entries.reduce((sum, entry) => sum + entry.snippet.length, 0) <= MEMORY_MAX_CHARS);
  const none = await folderFixture([['无关笔记', '完全不相干的内容。']]).run('样本方差自由度');
  assert.deepEqual(none, []);
});

test('hits boost ranking and reinforcement stays bounded', async () => {
  const f = folderFixture([
    ['普通笔记', '独立事件的乘法公式内容。'],
    ['热门笔记', '独立事件另一条独立事件内容。']
  ], new Map(), new Map([['AI 知识库/普通笔记.md', 5]]));
  const entries = await f.run('独立事件是什么');
  assert.equal(entries[0].path, 'AI 知识库/普通笔记.md');
  const hits = new Map();
  reinforce(hits, [{ key: 'a' }, { key: 'b' }, { key: 'a' }]);
  assert.equal(hits.get('a'), 2);
  reinforce(hits, [{ key: 'a', bad: null }, null, {}]);
  assert.equal(hits.get('a'), 3);
  const loaded = loadHits(serializeHits(hits));
  assert.equal(loaded.get('a'), 3);
  const strict = loadHits({ 'x': '3', 'y': -1, 'z': 1000 });
  assert.equal(strict.get('x'), undefined);
  assert.equal(strict.get('y'), undefined);
  assert.equal(strict.get('z'), undefined);
});

test('empty memory text keeps prompts byte-identical to the previous behavior', () => {
  const base = buildPrompt('p.md', 't', [], 'q', ['profile line']);
  assert.equal(buildPrompt('p.md', 't', [], 'q', ['profile line'], ''), base);
  assert.ok(buildPrompt('p.md', 't', [], 'q', [], 'MEMORY').includes('MEMORY'));
  assert.ok(buildPrompt('p.md', 't', [], 'q', [], 'MEMORY').trimEnd().endsWith('"}'));
  assert.ok(buildScreenPrompt([], 'q', [], 'MEMORY').includes('MEMORY'));
  assert.ok(bestSnippet('短。\n\n这一段包含独立事件关键词且足够长。', ['独立事件']).includes('独立事件'));
  assert.equal(bestSnippet('短。\n\n没有任何关键词命中且足够长的段落。', ['不存在词']), null);
});
