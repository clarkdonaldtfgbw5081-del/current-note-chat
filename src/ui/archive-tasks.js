const { Modal, Notice, TFile } = require('obsidian');
const { L } = require('../i18n');

class ArchiveTasksModal extends Modal {
  constructor(plugin) { super(plugin.app); this.plugin = plugin; }
  onOpen() { this.render(); }
  render() {
    const root = this.contentEl, notes = this.plugin.knowledgeNotes;
    this.modalEl.addClass('current-note-chat-tasks-modal');
    root.empty(); root.createEl('h2', { text: L('归档任务与用量', 'Archive tasks and usage') });
    const today = new Date().toLocaleDateString('en-CA'), count = notes.usage.day === today ? notes.usage.count : 0;
    root.createEl('p', { text: L(`今日分类请求：${count} 次。按请求次数计数，失败或中断也可能计费；不代表服务商的金额账单。`, `Classification requests today: ${count}. Failed or interrupted requests can be charged; this count is not a provider billing statement.`) });
    root.createEl('p', { text: L('已保存分类结果的任务重试只恢复写入；请求结果不明确的任务重试可能再次调用 AI。', 'Retrying a task with a saved classification only restores the write. An uncertain request may call AI again.') });
    root.createEl('button', { text: L('刷新状态', 'Refresh') }).addEventListener('click', () => this.render());
    if (!notes.jobs.size) root.createEl('p', { text: L('没有待处理的归档任务。', 'No pending archive tasks.') });
    for (const job of notes.jobs.values()) {
      const row = root.createDiv({ cls: 'current-note-chat__archive-task' });
      row.createEl('h3', { text: job.meta.topic || job.question.slice(0, 80) });
      row.createEl('p', { text: job.error || L('任务已保存在本地，等待处理。', 'Task saved locally, waiting for processing.') });
      const canResume = job.plan && (!job.plan.existing || this.plugin.app.vault.getAbstractFileByPath(job.plan.path) instanceof TFile);
      const retry = row.createEl('button', { text: job.stage === 'transcript' ? L('恢复对话保存与归档', 'Restore conversation and archive') : canResume ? L('恢复写入', 'Resume writing') : L('重试分类（可能计费）', 'Retry classification (may incur a charge)') });
      retry.disabled = notes.pending.has(job.id);
      retry.addEventListener('click', async () => { retry.disabled = true; await notes.retry(job.id); if (this.contentEl.isConnected) this.render(); });
      const dismiss = row.createEl('button', { text: L('取消此任务', 'Dismiss task') });
      dismiss.addEventListener('click', () => { notes.dismiss(job.id); this.render(); });
    }
    const recent = [...notes.records.entries()].filter(([, record]) => record.range).slice(-5).reverse();
    if (recent.length) root.createEl('h3', { text: L('最近归档', 'Recent archives') });
    for (const [id, record] of recent) {
      const row = root.createDiv({ cls: 'current-note-chat__archive-task' }); row.createEl('p', { text: record.path });
      row.createEl('button', { text: L('打开笔记', 'Open note') }).addEventListener('click', () => void this.plugin.app.workspace.openLinkText(record.path, '', true));
      const undo = row.createEl('button', { text: L('撤销本次追加', 'Undo this addition') }); undo.disabled = notes.pending.size > 0;
      undo.addEventListener('click', async () => { undo.disabled = true; try { if (await notes.undo(id)) this.render(); } catch (error) { new Notice(error.message); undo.disabled = false; } });
    }
  }
  onClose() { this.contentEl.empty(); }
}
module.exports = { ArchiveTasksModal };
