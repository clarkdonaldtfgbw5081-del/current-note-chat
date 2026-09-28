const { Modal, Notice } = require('obsidian');
const { L } = require('../i18n');
const EditPreviewModal = class extends Modal {
  constructor(plugin, proposal) {
    super(plugin.app);
    this.plugin = plugin;
    this.proposal = proposal;
  }
  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("current-note-chat-edit-modal");
    contentEl.empty();
    contentEl.addClass("current-note-chat-edit-preview");
    contentEl.createEl("h2", { text: L("确认笔记修改", "Review note changes") });
    contentEl.createDiv({ cls: "current-note-chat-edit-preview__target", text: `${L("目标", "Target")}: ${this.proposal.file.path} \xB7 ${this.proposal.scope === "selection" ? L("仅选中内容", "selection only") : L("整篇笔记", "whole note")}` });
    contentEl.createDiv({ cls: "current-note-chat-edit-preview__hint", text: L("检查 AI 的改写，再应用到笔记。右侧内容可以先手动调整。", "Review the AI revision before applying it to your note. You can also tweak the right-hand side first.") });
    const columns = contentEl.createDiv({ cls: "current-note-chat-edit-preview__columns" });
    const original = columns.createDiv();
    original.createEl("label", { text: L("原文", "Original") });
    original.createEl("textarea", { attr: { readonly: "", "aria-label": L("笔记原文", "Original note text") } }).value = this.proposal.originalText;
    const updated = columns.createDiv();
    updated.createEl("label", { text: L("修改后", "Revised") });
    const resultEl = updated.createEl("textarea", { attr: { "aria-label": L("修改后的笔记内容", "Revised note text") } });
    resultEl.value = this.proposal.revisedText;
    const errorEl = contentEl.createDiv({ cls: "current-note-chat-edit-preview__error" });
    const actions = contentEl.createDiv({ cls: "current-note-chat-edit-preview__actions" });
    actions.createEl("button", { text: L("取消", "Cancel") }).addEventListener("click", () => this.close());
    const applyButton = actions.createEl("button", { text: L("应用到当前笔记", "Apply to note"), cls: "mod-cta" });
    applyButton.addEventListener("click", async () => {
      applyButton.disabled = true;
      errorEl.setText("");
      try {
        await this.plugin.applyEditProposal(this.proposal, resultEl.value);
        new Notice(this.proposal.editor ? L("已更新当前笔记，可在编辑器中撤销。", "Note updated. You can undo it in the editor.") : L("已更新当前笔记。", "Note updated."), 5e3);
        this.close();
      } catch (error) {
        errorEl.setText(error?.message || String(error));
        applyButton.disabled = false;
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

module.exports = { EditPreviewModal };
