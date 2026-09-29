const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [1, 3, 7, 14];
const { validPath } = require('./archive-journal');
function validReview(raw) {
  if (!raw || !Number.isFinite(raw.completedAt) || raw.completedAt <= 0 || !Number.isFinite(raw.dueAt) || raw.dueAt < raw.completedAt || raw.dueAt > 8640000000000000 || !Number.isSafeInteger(raw.streak) || raw.streak < 0 || raw.streak > 3) return null;
  return { completedAt: raw.completedAt, dueAt: raw.dueAt, streak: raw.streak, delayedPasses: Math.max(0, Math.min(100000, Math.floor(Number(raw.delayedPasses) || 0))) };
}
function completeReview(previous, now = Date.now()) {
  const before = validReview(previous);
  if (before && now < before.dueAt) return { ...before, early: true };
  const streak = before ? Math.min(3, before.streak + 1) : 0;
  return { completedAt: now, dueAt: now + INTERVALS[streak] * DAY, streak, delayedPasses: (before?.delayedPasses || 0) + (before ? 1 : 0), early: false };
}
function loadReviews(raw) {
  const records = new Map();
  for (const item of (Array.isArray(raw) ? raw.slice(-100) : [])) {
    const review = validReview(item);
    if (!review || typeof item.id !== 'string' || item.id.length > 128 || typeof item.topic !== 'string' || !item.topic.trim() || item.topic.length > 300 || !validPath(item.source)) continue;
    records.set(item.id, { id: item.id, topic: item.topic, source: item.source, ...review, attempts: Math.max(0, Math.min(1000000, Math.floor(Number(item.attempts) || 0))), gaps: (Array.isArray(item.gaps) ? item.gaps : []).filter(gap => typeof gap === 'string').slice(0, 6).map(gap => gap.slice(0, 500)) });
  }
  return records;
}
function checkIndependence(state, answer) {
  if (state.phase !== 'apply' || state.source?.mode !== 'file' || !/(?:independence|independent|独立)/i.test(state.topic)) return null;
  const formula = state.source.text.replace(/\s|\$/g, '').replace(/\\cap/g, '∩').replace(/\\times/g, '×');
  if (!/P\(A∩B\)=P\(A\)[×*⋅]?P\(B\)/i.test(formula)) return null;
  const challenge = state.challenge.replace(/\\cap/g, '∩');
  const probability = symbol => {
    const match = new RegExp(`P\\s*\\(\\s*${symbol}\\s*\\)\\s*[=＝]\\s*(0(?:\\.\\d+)?|1(?:\\.0+)?)(?![\\d.])`, 'i').exec(challenge);
    return match ? Number(match[1]) : NaN;
  };
  const a = probability('A'), b = probability('B'), joint = probability('A\\s*∩\\s*B');
  if (![a, b, joint].every(Number.isFinite) || joint > Math.min(a, b) || joint < Math.max(0, a + b - 1)) return null;
  const no = /(?:不独立|并非独立|不是独立|not\s+(?:statistically\s+)?independent|\bdependent\b)/i.test(answer);
  const yes = !no && /(?:独立|\bindependent\b)/i.test(answer);
  if (!no && !yes) return null;
  const expectedIndependent = Math.abs(a * b - joint) <= 4 * Number.EPSILON * Math.max(a * b, joint, Number.MIN_VALUE);
  return { consistent: yes === expectedIndependent, expectedIndependent };
}
module.exports = { INTERVALS, validReview, completeReview, loadReviews, checkIndependence };
