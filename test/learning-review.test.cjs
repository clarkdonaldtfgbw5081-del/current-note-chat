const test = require('node:test');
const assert = require('node:assert/strict');
const { install } = require('./helpers/obsidian.cjs'); install();
const { completeReview, loadReviews, checkIndependence } = require('../src/learning-review');
const { createLesson, parseAssessment, applyAssessment } = require('../src/feynman');
const DAY = 86400000;

test('delayed reviews progress through 1, 3, 7 and 14 days; immediate practice is not retention evidence', () => {
  const now = Date.UTC(2026, 8, 29), first = completeReview(null, now);
  assert.equal(first.dueAt, now + DAY); assert.equal(first.delayedPasses, 0);
  const early = completeReview(first, now + 3600000); assert.equal(early.dueAt, first.dueAt); assert.equal(early.delayedPasses, 0);
  const second = completeReview(first, first.dueAt); assert.equal(second.dueAt, first.dueAt + 3 * DAY); assert.equal(second.delayedPasses, 1);
  const third = completeReview(second, second.dueAt); assert.equal(third.dueAt, second.dueAt + 7 * DAY);
  const fourth = completeReview(third, third.dueAt); assert.equal(fourth.dueAt, third.dueAt + 14 * DAY);
});

test('review plans are bounded, reject unsafe sources and preserve valid dates after serialization', () => {
  const review = completeReview(null, Date.UTC(2026, 8, 29));
  const raw = Array.from({ length: 120 }, (_, i) => ({ id: String(i), topic: 'Concept ' + i, source: 'Source.md', ...review }));
  const restored = loadReviews(JSON.parse(JSON.stringify(raw))); assert.equal(restored.size, 100); assert.equal(restored.get('119').dueAt, review.dueAt);
  assert.equal(loadReviews([{ ...raw[0], source: '../Private.md' }, { ...raw[0], dueAt: -1 }]).size, 0);
  assert(!JSON.stringify([...restored.values()]).includes('sourceEvidence'));
});

test('a source-grounded numerical check vetoes an AI pass for an incorrect independence conclusion', () => {
  const state = createLesson('事件独立性'); state.phase = 'apply'; state.source = { mode: 'file', path: 'Source.md', text: '独立的判定条件：P(A∩B)=P(A)×P(B)。' };
  state.challenge = 'P(A)=0.5、P(B)=0.4、P(A∩B)=0.1，是否独立？';
  assert.equal(checkIndependence(state, '不独立，因为两个概率的乘积是 0.2，与联合概率不同。').consistent, true);
  const answer = 'A 与 B 独立，因为我认为它们相互不影响。';
  const response = { supported: true, sourceEvidence: '独立的判定条件', feedback: 'Excellent', gaps: [], checks: Object.fromEntries(['accuracy', 'reasoning', 'plainLanguage', 'example'].map(name => [name, { result: 'pass', evidence: answer, reason: 'AI thinks correct' }])), applicationChallenge: '' };
  const assessed = parseAssessment(JSON.stringify(response), state, answer);
  assert.equal(applyAssessment(state, assessed, answer).passed, false); assert.equal(assessed.checks.accuracy.result, 'retry');
  state.source.text = 'Source without a numerical independence rule.'; assert.equal(checkIndependence(state, answer), null);
  state.source.text = 'P(A∩B)=P(A)P(B)'; state.challenge = 'A general essay question'; assert.equal(checkIndependence(state, answer), null);
});
