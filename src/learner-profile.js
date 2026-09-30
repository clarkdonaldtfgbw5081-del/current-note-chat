const { L } = require('./i18n');

// Learner profile: three quick onboarding answers tune how ordinary Q&A explains.
// An unset level means "never onboarded" and keeps the historical prompt behavior.
const MAX_BACKGROUND_CHARS = 200;

const LEVELS = {
  beginner: 'The learner is just starting out; avoid unexplained jargon, define terms in plain language and build up from the basics.',
  intermediate: 'The learner has working fundamentals; use standard terminology and focus on the reasoning behind results.',
  advanced: 'The learner wants depth; go into the underlying principles, assumptions and edge cases, and stay rigorous.'
};

function backgroundText(settings) {
  const raw = String(settings?.learnerBackground || '').trim();
  return raw ? raw.slice(0, MAX_BACKGROUND_CHARS) : '';
}

/** Instruction lines injected before the data block in Q&A prompts; [] keeps old behavior. */
function profileLines(settings) {
  const level = LEVELS[settings?.learnerLevel];
  const background = backgroundText(settings);
  if (!level && !background && !settings?.answerDepth && !settings?.answerExamples) return [];
  const lines = [];
  if (level || background) lines.push(`Learner profile: ${level || 'No level specified.'}${background ? ` Background: ${background}.` : ''}`);
  lines.push('Give the direct answer first. Tailor wording to any supplied learner profile; do not infer an unspecified level.');
  if (settings?.answerDepth) lines.push('After the direct answer, explain the underlying principle step by step — the why and how it connects, not just the conclusion — so the learner understands the real mechanism without asking follow-up questions.');
  if (settings?.answerExamples) lines.push('End with a clearly labeled section of 2-3 worked examples of increasing difficulty on the same knowledge point, each with a brief solution, so the learner can transfer the idea. These examples go beyond the source and must be visibly marked as such; factual answers themselves remain grounded in the provided source.');
  return lines;
}

/** Map the wizard's three answers onto a settings patch. */
function applyProfileAnswers(answers) {
  const patch = { profileWizardDone: true };
  if (answers && typeof answers.level === 'string' && LEVELS[answers.level]) patch.learnerLevel = answers.level;
  if (answers && typeof answers.background === 'string') patch.learnerBackground = answers.background.trim().slice(0, MAX_BACKGROUND_CHARS);
  patch.answerDepth = false;
  patch.answerExamples = false;
  if (answers?.style === 'deep') patch.answerDepth = true;
  if (answers?.style === 'examples') { patch.answerDepth = true; patch.answerExamples = true; }
  return patch;
}

/** Bilingual wizard definitions shared by the modal and settings tab. */
function wizardQuestions() {
  return [
    {
      key: 'level',
      title: L('你的基础', 'Your background'),
      options: [
        { value: 'beginner', label: L('刚入门，很多术语不熟', 'Just starting out; many terms are new') },
        { value: 'intermediate', label: L('有基础，想理解原理', 'Fundamentals in place; want the reasoning') },
        { value: 'advanced', label: L('想深入原理和边界', 'Want depth, assumptions and edge cases') }
      ]
    },
    {
      key: 'style',
      title: L('希望 AI 怎么回答', 'How should the AI answer'),
      options: [
        { value: 'concise', label: L('简明扼要，直接给结论', 'Concise and direct') },
        { value: 'deep', label: L('讲清原理，不用我追问', 'Explain the principle; no follow-ups needed') },
        { value: 'examples', label: L('讲透原理，再举几个例子', 'Deep explanation plus worked examples') }
      ]
    }
  ];
}

module.exports = { LEVELS, MAX_BACKGROUND_CHARS, profileLines, applyProfileAnswers, wizardQuestions, backgroundText };
