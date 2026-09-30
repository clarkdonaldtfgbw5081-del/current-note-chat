const test = require('node:test');
const assert = require('node:assert/strict');
const { install } = require('./helpers/obsidian.cjs');
install();
const { LEVELS, profileLines, applyProfileAnswers, wizardQuestions } = require('../src/learner-profile');
const { buildPrompt, buildScreenPrompt } = require('../src/prompts');

test('unset learner level keeps the historical prompt behavior', () => {
  assert.deepEqual(profileLines({}), []);
  assert.deepEqual(profileLines({ learnerLevel: '' }), []);
  assert.deepEqual(profileLines({ learnerLevel: 'unknown' }), []);
  const before = buildPrompt('p.md', 'text', [], 'q');
  assert.equal(buildPrompt('p.md', 'text', [], 'q', []), before);
  assert.equal(buildScreenPrompt([], 'q'), buildScreenPrompt([], 'q', []));
});

test('profile lines reflect level, depth, examples and bounded background', () => {
  const lines = profileLines({ learnerLevel: 'beginner', answerDepth: true, answerExamples: true, learnerBackground: '  第三年统计学  ' });
  assert.equal(lines.length, 4);
  assert.match(lines[0], /just starting out/);
  assert.match(lines[0], /第三年统计学/);
  assert.match(lines[2], /underlying principle/);
  assert.match(lines[3], /2-3 worked examples/);
  assert.match(lines[3], /grounded in the provided source/);
  const advanced = profileLines({ learnerLevel: 'advanced' });
  assert.equal(advanced.length, 2);
  assert.match(advanced[0], /depth/);
  assert.match(buildPrompt('p.md', 't', [], 'q', lines), /2-3 worked examples/);
  assert.ok(buildPrompt('p.md', 't', [], 'q', lines).trimEnd().endsWith('"}'), 'data JSON stays last');
  const long = 'x'.repeat(300);
  assert.ok(profileLines({ learnerLevel: 'advanced', learnerBackground: long })[0].length < 300 + 200);
});

test('applyProfileAnswers maps wizard answers onto a settings patch', () => {
  assert.deepEqual(applyProfileAnswers({ level: 'beginner', style: 'concise', background: ' 统计大三 ' }), {
    profileWizardDone: true, learnerLevel: 'beginner', learnerBackground: '统计大三', answerDepth: false, answerExamples: false
  });
  assert.deepEqual(applyProfileAnswers({ level: 'advanced', style: 'examples', background: '' }), {
    profileWizardDone: true, learnerLevel: 'advanced', learnerBackground: '', answerDepth: true, answerExamples: true
  });
  assert.deepEqual(applyProfileAnswers({ level: 'intermediate', style: 'deep', background: '' }), {
    profileWizardDone: true, learnerLevel: 'intermediate', learnerBackground: '', answerDepth: true, answerExamples: false
  });
  const skip = applyProfileAnswers({ style: 'deep' });
  assert.equal(skip.learnerLevel, undefined);
  assert.equal(skip.profileWizardDone, true);
  assert.deepEqual(wizardQuestions().map(question => question.key), ['level', 'style']);
  assert.equal(Object.keys(LEVELS).length, 3);
});
