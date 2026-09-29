const { Modal, Notice, TFile } = require('obsidian');
const { L } = require('../i18n');
const { SCREEN_CHAT_KEY, SUPPORTED_EXTENSIONS } = require('../constants');
const { createLesson, learningKey } = require('../feynman');
const { validReview } = require('../learning-review');
const { newMessage } = require('../sessions');

class ReviewPlanModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; }
  onOpen() {
    this.modalEl.addClass('current-note-chat-tasks-modal');
    const root = this.contentEl; root.empty();
    root.createEl('h2', { text: L('知识复习计划', 'Knowledge review plan') });
    root.createEl('p', { text: L('通过后按 1、3、7、14 天安排下一次复习。提前复习不推进间隔。这里记录 AI 对作答的判断，请先收起资料再尝试；不会后台发送请求或系统通知。', 'Passed rounds schedule the next review after 1, 3, 7 and 14 days. Early reviews do not advance the interval. These are AI assessments; put the source aside before answering. No background requests or system notifications are sent.') });
    const records = [...(this.plugin.learningReviews?.values() || [])].sort((a, b) => a.dueAt - b.dueAt);
    if (!records.length) root.createEl('p', { text: L('完成一次费曼学习后，这里会出现复习计划。', 'Complete a Feynman round to add a review plan.') });
    for (const record of records) {
      const row = root.createDiv({ cls: 'current-note-chat__archive-task' });
      row.createEl('h3', { text: record.topic });
      row.createEl('p', { text: `${record.dueAt <= Date.now() ? L('到期', 'Due') : L('下次复习', 'Next review')}: ${new Date(record.dueAt).toLocaleDateString()} · ${L('延迟复习通过次数', 'Delayed rounds passed')}: ${record.delayedPasses || 0}` });
      row.createEl('p', { text: record.source === SCREEN_CHAT_KEY ? L('屏幕资料：复习时需重新截图。', 'Screen source: capture a fresh screenshot for review.') : record.source });
      const start = row.createEl('button', { text: L('收起资料，开始复习', 'Start review without the source') });
      start.disabled = this.plugin.widget?.busy;
      start.addEventListener('click', () => this.start(record));
      row.createEl('button', { text: L('移除计划', 'Remove plan') }).addEventListener('click', () => { this.plugin.learningReviews.delete(record.id); this.plugin.queueSaveSessions(); this.onOpen(); });
    }
  }
  start(record) {
    const plugin = this.plugin, widget = plugin.widget;
    if (!widget?.rootEl || widget.busy || plugin.disposed) return;
    if (record.source !== SCREEN_CHAT_KEY) {
      const file = plugin.app.vault.getAbstractFileByPath(record.source);
      if (!(file instanceof TFile) || !SUPPORTED_EXTENSIONS.has(file.extension.toLowerCase())) { new Notice(L('复习来源已移动或删除，请先打开资料新建知识点。', 'The source moved or was deleted; open the material and start a topic.')); return; }
      plugin.setActiveFile(file, null); plugin.settings.contextMode = 'file';
    } else plugin.settings.contextMode = 'screen';
    plugin.settings.learningMode = true; plugin.clearCurrentChat();
    const key = learningKey(record.source), state = createLesson(record.topic);
    state.review = validReview(record); state.reviewId = record.id; state.difficulty = plugin.settings.learningDifficulty || 2;
    plugin.learningSessions.set(key, state);
    const question = newMessage('user', record.topic);
    plugin.messagesByNote.set(key, [question, newMessage('assistant', state.challenge, { replyTo: question.id })]);
    void widget.learning.saveTranscript(key, plugin.messagesByNote.get(key), state);
    plugin.queueSaveSessions(); widget.setOpen(true); this.close();
  }
  onClose() { this.contentEl.empty(); }
}
module.exports = { ReviewPlanModal };
