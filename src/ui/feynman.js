const { Notice } = require('obsidian');
const { L } = require('../i18n');
const { SCREEN_CHAT_KEY, MAX_QUESTION_CHARS } = require('../constants');
const { learningKey, phaseLabel, createLesson, lessonReportId, buildLearningPrompt, parseAssessment, applyAssessment, formatAssessment } = require('../feynman');
const { newMessage, touchSession } = require('../sessions');
const { selectRelevantContext } = require('../retrieval');
const { throwIfAborted, withAbort, abortError } = require('../tasks');
const { previewScreenshot } = require('./screenshot-preview');
const { noteSaveMode } = require('../conversation-notes');
const { buttonContent } = require('./elements');
const { completeReview } = require('../learning-review');

class FeynmanLearning {
  constructor(widget) { this.widget = widget; this.plugin = widget.plugin; }
  get enabled() { return this.plugin.settings.learningMode === true; }
  sourceKey() { return this.plugin.settings.contextMode === 'screen' ? SCREEN_CHAT_KEY : this.plugin.activeFile?.path; }
  key() { const source = this.sourceKey(); return source ? learningKey(source) : null; }
  state() { return this.plugin.learningSessions?.get(this.key()); }
  mount(root) {
    const activities = root.createDiv({ cls: 'current-note-chat__modes current-note-chat__activities' });
    this.buttons = {};
    for (const [enabled, text] of [[false, L('自由问答', 'Q&A')], [true, L('费曼学习', 'Feynman learning')]]) {
      const button = activities.createEl('button', { text, attr: { 'aria-pressed': 'false' } });
      buttonContent(button, text, enabled ? 'graduation-cap' : 'messages-square');
      button.addEventListener('click', () => this.setEnabled(enabled)); this.buttons[String(enabled)] = button;
    }
    this.progressEl = root.createDiv({ cls: 'current-note-chat__learning', attr: { 'aria-live': 'polite' } });
    this.labelEl = this.progressEl.createDiv({ cls: 'current-note-chat__learning-stage' });
    this.detailEl = this.progressEl.createDiv();
    const actions = this.progressEl.createDiv({ cls: 'current-note-chat__learning-actions' });
    this.hintButton = actions.createEl('button', { text: L('给一点提示', 'Give me a hint') });
    this.hintButton.addEventListener('click', () => void this.send(null, 'hint'));
    this.reviewButton = actions.createEl('button', { text: L('开始复习', 'Start review') });
    this.reviewButton.addEventListener('click', () => this.review());
    const planButton = actions.createEl('button', { text: L('复习计划', 'Review plan') });
    planButton.addEventListener('click', () => { const { ReviewPlanModal } = require('./review-plan'); new ReviewPlanModal(this.plugin).open(); });
  }
  setEnabled(enabled) {
    if (this.widget.busy || this.widget.unmounted || !this.widget.inputEl) return;
    this.plugin.settings.learningMode = enabled;
    this.widget.inputEl.value = '';
    this.widget.refresh();
    void this.plugin.saveSettings().catch(() => new Notice(L('模式设置保存失败。', 'Could not save the activity setting.')));
  }
  refresh() {
    if (!this.progressEl) return;
    const state = this.state(), widget = this.widget;
    for (const [enabled, button] of Object.entries(this.buttons)) {
      button.disabled = widget.busy; button.setAttribute('aria-pressed', String(this.enabled === (enabled === 'true')));
    }
    this.progressEl.toggleClass('is-hidden', !this.enabled);
    if (!this.enabled) return;
    this.labelEl.setText(state ? `${state.topic} · ${phaseLabel(state.phase)}` : L('选择一个知识点', 'Choose one concept'));
    const frozen = state?.source?.mode === 'file' ? L('基于本轮固定的文件片段；新建知识点可更新资料。', 'Using frozen file excerpts; start a new topic to update the source.') : state?.source?.mode === 'screen' ? L('复用本轮截图，内存缓存最多十分钟；过期后需新建知识点。', 'Reusing this round’s screenshot for up to ten minutes; start a new topic after expiry.') : '';
    this.detailEl.setText(state ? [frozen, state.source?.partial ? L('片段未涵盖全文。', 'Excerpts do not cover the full file.') : '', state.gaps.length ? `${L('待补强', 'Work on')}: ${state.gaps.join('；')}` : '', state.phase === 'complete' ? L('建议明天不看资料复习。', 'Review tomorrow without the source.') : state.challenge].filter(Boolean).join('\n') : L('输入要学的知识点名称，例如“贝叶斯定理”。接下来需要你解释、作答并再次讲清楚。', 'Enter a concept, such as “Bayes’ theorem”. You will explain it, solve a problem and teach it back.'));
    widget.inputEl.placeholder = !state ? L('输入一个知识点名称（最多 300 字符）…', 'Enter one concept (up to 300 characters)…') : state.phase === 'complete' ? L('点击“开始复习”或“新知识点”。', 'Use Start review or New topic.') : L('用自己的话解释，或回答上面的题目…', 'Explain in your own words, or answer the question above…');
    widget.inputEl.setAttribute?.('aria-label', !state ? L('知识点名称', 'Concept name') : L('我的解释或应用题答案', 'My explanation or application answer'));
    widget.inputEl.disabled = widget.inputEl.disabled || widget.busy || state?.phase === 'complete';
    widget.sendButton.disabled = widget.sendButton.disabled || (!widget.busy && state?.phase === 'complete');
    buttonContent(widget.sendButton, widget.busy ? L('停止', 'Stop') : !state ? L('开始学习', 'Start learning') : L('提交解释', 'Submit answer'), widget.busy ? 'square' : 'arrow-up');
    buttonContent(widget.clearButton, L('新知识点', 'New topic'), 'plus', true);
    widget.editButton.disabled = true;
    this.hintButton.disabled = widget.busy || !state || state.phase === 'complete';
    this.reviewButton.disabled = widget.busy || state?.phase !== 'complete';
    if (state?.phase === 'complete' && state.review && this.plugin.settings.learningReviewEnabled !== false) this.detailEl.setText(`${L('下次脱离资料复习', 'Next review without the source')}: ${new Date(state.review.dueAt).toLocaleDateString()}\n${L('已完成的延迟复习', 'Delayed review rounds passed')}: ${state.review.delayedPasses || 0}`);
  }
  canRetry(id) {
    const state = this.state();
    return state?.pending?.userId === id && state.pending.revision === state.revision;
  }
  review() {
    if (this.widget.busy || !this.state() || this.state().phase !== 'complete') return;
    const previous = this.state(); const state = createLesson(previous.topic);
    state.source = previous.source;
    state.difficulty = this.plugin.settings.learningDifficulty || 2;
    state.review = previous.review;
    state.reviewId = previous.reviewId || lessonReportId(previous);
    state.revision = previous.revision + 1;
    this.plugin.learningSessions.set(this.key(), state);
    const thread = this.plugin.messagesByNote.get(this.key()) || [];
    const user = newMessage('user', L('开始复习', 'Start review'));
    thread.push(user, newMessage('assistant', state.challenge, { replyTo: user.id }));
    touchSession(this.plugin.messagesByNote, this.key(), thread);
    void this.saveTranscript(this.key(), thread, state);
    this.plugin.queueSaveSessions(); this.widget.refresh();
  }
  saveTranscript(key, thread, state) {
    const source = state?.source?.path || key.slice('__feynman__:'.length);
    return this.plugin.saveConversation?.(key, thread, { mode: source === SCREEN_CHAT_KEY ? 'screen' : 'file', source: source === SCREEN_CHAT_KEY ? undefined : source, activity: 'feynman', summary: this.report(state) });
  }
  async sourceFor(state, key, signal) {
    const widget = this.widget;
    const cached = widget.snapshots.get(key);
    if (state.source?.mode === 'file') return { source: state.source };
    if (state.source?.mode === 'screen') {
      if (!cached || Date.now() - cached.at >= 10 * 60 * 1000) throw new Error(L('本轮截图已过期或插件已重启。请点击“新知识点”，重新截图学习。', 'This round’s screenshot expired or the plugin restarted. Use New topic to capture a fresh learning source.'));
      return { source: state.source, screenshot: cached.snapshot.screenshot };
    }
    const source = key.slice('__feynman__:'.length);
    if (source !== SCREEN_CHAT_KEY) {
      const file = this.plugin.app.vault.getAbstractFileByPath(source);
      const full = await this.plugin.runTask(inner => this.plugin.readCurrentFile(file, inner), signal);
      const context = selectRelevantContext(full, state.topic);
      if (!context.text.trim()) throw new Error(L('当前文件没有可用于学习的文字。', 'The file has no text to learn from.'));
      return { source: { mode: 'file', path: source, text: context.text, partial: context.partial } };
    }
    let screenshot;
    widget.rootEl.addClass('is-capturing');
    try {
      await withAbort(new Promise(resolve => setTimeout(resolve, 180)), signal);
      screenshot = await this.plugin.runTask(inner => this.plugin.captureCurrentScreen(inner), signal);
    } finally { widget.rootEl.removeClass('is-capturing'); }
    if (this.plugin.settings.previewScreenshot) {
      const confirmed = await previewScreenshot(this.plugin.app, screenshot, signal);
      throwIfAborted(signal); if (!confirmed) throw abortError(L('已取消发送截图。', 'Screenshot sending cancelled.'));
    }
    throwIfAborted(signal); widget.cacheSnapshot(key, { screenshot });
    return { source: { mode: 'screen' }, screenshot };
  }
  async send(retryId, action = 'answer') {
    const widget = this.widget;
    if (widget.busy || widget.unmounted) return;
    const key = this.key();
    if (!key) { new Notice(L('请先打开支持的文件。', 'Open a supported file first.')); return; }
    this.plugin.learningSessions ||= new Map();
    let state = this.plugin.learningSessions.get(key);
    const thread = this.plugin.messagesByNote.get(key) || [];
    const index = retryId ? thread.findIndex(item => item.id === retryId && item.role === 'user') : -1;
    if (retryId && (index < 0 || !this.canRetry(retryId))) { new Notice(L('学习阶段已变化，无法重试旧答案，请提交当前阶段的答案。', 'The learning stage changed. Submit an answer to the current stage instead.')); return; }
    if (retryId) action = state.pending.action;
    const answer = retryId ? thread[index].text : action === 'hint' ? L('请给我一点提示，不要直接给出完整答案。', 'Give me a small hint without the full answer.') : widget.inputEl.value.trim();
    if (!answer) return;
    if (answer.length > (state ? MAX_QUESTION_CHARS : 300)) { new Notice(state ? L('回答不能超过 8000 字符。', 'Keep the answer within 8000 characters.') : L('知识点名称不能超过 300 字符。', 'Keep the concept name within 300 characters.')); return; }
    if (state?.phase === 'complete') { new Notice(L('点击“开始复习”可再次检验。', 'Use Start review to test yourself again.')); return; }
    const user = retryId ? thread[index] : newMessage('user', answer);
    if (!retryId) { thread.push(user); if (action !== 'hint') widget.inputEl.value = ''; }
    if (!state) {
      state = createLesson(answer); this.plugin.learningSessions.set(key, state);
      state.difficulty = this.plugin.settings.learningDifficulty || 2;
      thread.push(newMessage('assistant', `**${state.topic} · ${phaseLabel(state.phase)}**\n\n${state.challenge}`, { replyTo: user.id }));
      touchSession(this.plugin.messagesByNote, key, thread);
      await this.saveTranscript(key, thread, state);
      this.plugin.queueSaveSessions(); widget.refresh(); return;
    }
    const reply = newMessage('assistant', L('正在核对解释与资料…', 'Checking your answer against the source…'), { streaming: true, replyTo: user.id });
    const old = retryId ? thread.findIndex(item => item.error && item.replyTo === user.id) : -1;
    if (old >= 0) thread.splice(old, 1, reply); else thread.push(reply);
    touchSession(this.plugin.messagesByNote, key, thread);
    state.pending = { userId: user.id, phase: state.phase, revision: state.revision, action };
    widget.busy = true; this.requestKey = key; widget.requestController = new AbortController(); widget.refresh();
    try {
      await this.saveTranscript(key, thread, state);
      const signal = widget.requestController.signal;
      const context = await this.sourceFor(state, key, signal);
      throwIfAborted(signal); state.source = context.source;
      // Copying a substantial source passage alone is not a teach-back.
      if (action === 'answer' && state.source.mode === 'file' && answer.length >= 24 && state.source.text.includes(answer)) throw new Error(L('这段回答与原文一致。请用自己的话解释，并补充原因或例子。', 'This answer matches the source. Explain it in your own words and add reasoning or an example.'));
      const prompt = buildLearningPrompt(state, answer, action);
      const raw = await this.plugin.askLearning(prompt, context.screenshot, signal);
      throwIfAborted(signal); if (widget.unmounted || this.plugin.learningSessions.get(key) !== state) return;
      const result = parseAssessment(raw, state, answer, action);
      const transition = applyAssessment(state, result, answer, action);
      if (transition.state.phase === 'complete') transition.state.reportId = user.id;
      if (transition.state.phase === 'complete' && this.plugin.settings.learningReviewEnabled !== false) {
        this.plugin.learningReviews ||= new Map();
        const sameTopic = [...this.plugin.learningReviews.values()].find(item => item.topic === state.topic && item.source === this.sourceKey());
        transition.state.review = completeReview(state.review || sameTopic);
        const reviewId = transition.state.reviewId || sameTopic?.id || user.id;
        transition.state.reviewId = reviewId;
        this.plugin.learningReviews.delete(reviewId);
        this.plugin.learningReviews.set(reviewId, { id: reviewId, topic: state.topic, source: this.sourceKey(), ...transition.state.review, attempts: transition.state.attempts, gaps: [...transition.state.gaps] });
        while (this.plugin.learningReviews.size > 100) this.plugin.learningReviews.delete(this.plugin.learningReviews.keys().next().value);
      }
      reply.text = formatAssessment(state, transition, result, action); reply.streaming = false;
      this.plugin.learningSessions.delete(key); this.plugin.learningSessions.set(key, transition.state);
      if (noteSaveMode(this.plugin.settings) === 'answer') {
        const content = transition.state.phase === 'complete' ? `${reply.text}\n\n${this.report(transition.state)}` : reply.text;
        await this.plugin.saveQAToNote(answer, content, { mode: state.source.mode, source: state.source.path, model: this.plugin.currentModel(), activity: 'feynman', archiveReady: transition.state.phase === 'complete', archiveKey: key, archiveMessageId: user.id, topic: state.topic });
      }
    } catch (error) {
      if (!widget.unmounted) { reply.streaming = false; reply.error = true; reply.text = `${L('学习反馈未完成', 'Learning feedback incomplete')}: ${error.message || error}`; }
    } finally {
      const savedState = this.plugin.learningSessions.get(key);
      const transcriptPath = !widget.unmounted && this.plugin.messagesByNote.get(key) === thread && savedState ? await this.saveTranscript(key, thread, savedState) : null;
      if (transcriptPath && !widget.unmounted && savedState?.phase === 'complete' && !reply.error && !reply.streaming && noteSaveMode(this.plugin.settings) === 'conversation') void this.plugin.queueKnowledgeArchive?.(key, { id: lessonReportId(savedState), text: savedState.topic }, { text: this.report(savedState) }, { activity: 'feynman', transcriptPath, topic: savedState.topic, source: savedState.source?.path });
      else if (!transcriptPath && !widget.unmounted && savedState?.phase === 'complete' && !reply.error && !reply.streaming && noteSaveMode(this.plugin.settings) === 'conversation') this.plugin.knowledgeNotes?.deferTranscript(key, { id: lessonReportId(savedState), text: savedState.topic }, { text: this.report(savedState) }, { activity: 'feynman', topic: savedState.topic, source: savedState.source?.path });
      widget.busy = false; this.requestKey = null; widget.requestController = null;
      if (!widget.unmounted) { this.plugin.queueSaveSessions(); widget.refresh(); }
    }
  }
  report(state = this.state()) {
    if (!state) return '';
    return [`# ${L('费曼学习记录', 'Feynman learning record')}: ${state.topic}`, `${L('阶段', 'Stage')}: ${phaseLabel(state.phase)} · ${L('作答次数', 'Attempts')}: ${state.attempts}`, state.gaps.length ? `${L('待补强', 'Work on')}: ${state.gaps.join('；')}` : '', ...state.evidence.map(item => `## ${phaseLabel(item.phase)}\n\n${item.challenge}\n\n${item.answer}\n\n${L('资料依据', 'Source evidence')}: ${item.sourceEvidence}`), L('通过仅表示 AI 对本轮解释、应用题和再次讲解的评价。建议次日脱离资料复习。', 'A pass reflects AI assessment of this round’s explanation, application and teach-back. Review tomorrow without the source.')].filter(Boolean).join('\n\n');
  }
}
module.exports = { FeynmanLearning };
