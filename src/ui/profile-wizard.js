const { Modal } = require('obsidian');
const { L } = require('../i18n');
const { applyProfileAnswers, wizardQuestions } = require('../learner-profile');

/** First-run onboarding: three quick answers tune how Q&A explains things. */
class ProfileWizardModal extends Modal {
  constructor(plugin, { closable = true } = {}) {
    super(plugin.app);
    this.plugin = plugin;
    this.closable = closable;
    this.answers = { level: plugin.settings.learnerLevel || 'intermediate', style: plugin.settings.answerExamples ? 'examples' : plugin.settings.answerDepth ? 'deep' : 'concise', background: plugin.settings.learnerBackground || '' };
  }
  onOpen() {
    this.modalEl.addClass('current-note-chat-wizard');
    const root = this.contentEl;
    root.empty();
    root.createEl('h2', { text: L('先花 30 秒，让 AI 更懂你', '30 seconds to tailor the AI to you') });
    root.createEl('p', { text: L('回答三个小问题，之后的提问会按你的基础讲透原理、附上例子；随时可在设置中修改。', 'Answer three quick questions; future answers will match your level, explain principles and add examples. Change it any time in settings.') });
    for (const question of wizardQuestions()) {
      const field = root.createDiv({ cls: 'current-note-chat-wizard__field' });
      field.createEl('div', { cls: 'current-note-chat-wizard__label', text: question.title });
      const group = field.createDiv({ cls: 'current-note-chat-wizard__options', attr: { role: 'radiogroup', 'aria-label': question.title } });
      for (const option of question.options) {
        const button = group.createEl('button', { cls: 'current-note-chat-wizard__option', attr: { type: 'button', role: 'radio', 'aria-checked': String(this.answers[question.key] === option.value) } });
        button.createSpan({ text: option.label });
        button.addEventListener('click', () => {
          this.answers[question.key] = option.value;
          for (const sibling of group.children) sibling.setAttribute('aria-checked', String(sibling === button));
        });
      }
    }
    const backgroundField = root.createDiv({ cls: 'current-note-chat-wizard__field' });
    backgroundField.createEl('div', { cls: 'current-note-chat-wizard__label', text: L('背景补充（可选）', 'Background (optional)') });
    this.backgroundEl = backgroundField.createEl('textarea', { cls: 'current-note-chat-wizard__background', attr: { rows: '2', placeholder: L('例如：大三统计学，学过概率论与数理统计', 'e.g. Third-year statistics; covered probability theory'), maxlength: '200' } });
    this.backgroundEl.value = this.answers.background;
    this.backgroundEl.addEventListener('input', () => { this.answers.background = this.backgroundEl.value; });
    const actions = root.createDiv({ cls: 'current-note-chat-wizard__actions' });
    const save = actions.createEl('button', { text: L('保存，开始使用', 'Save and start'), cls: 'mod-cta' });
    save.addEventListener('click', () => { this.apply(applyProfileAnswers(this.answers)); });
    if (this.closable) {
      const skip = actions.createEl('button', { text: L('跳过，保持默认', 'Skip; keep defaults') });
      skip.addEventListener('click', () => this.apply({ profileWizardDone: true }));
    }
  }
  apply(patch) {
    Object.assign(this.plugin.settings, patch);
    void this.plugin.saveSettings();
    this.close();
    this.plugin.widget?.refresh?.();
  }
  onClose() { this.contentEl.empty(); }
}

module.exports = { ProfileWizardModal };
