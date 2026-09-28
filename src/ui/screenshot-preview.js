const { Modal } = require('obsidian');
const { L } = require('../i18n');
const { throwIfAborted } = require('../tasks');
class ScreenshotPreviewModal extends Modal {
  constructor(app, screenshot, signal, resolve) {
    super(app);
    this.screenshot = screenshot;
    this.signal = signal;
    this.resolve = resolve;
    this.onAbort = () => this.close();
  }
  onOpen() {
    this.modalEl.addClass('current-note-chat-screenshot-preview');
    this.contentEl.createEl('h2', { text: L('确认发送的屏幕画面', 'Review the screenshot to send') });
    this.contentEl.createEl('p', { text: L('这张图片会发送给当前选择的 AI 服务商。请检查是否包含不想发送的内容。', 'This image will be sent to your selected AI provider. Check the contents before sending.') });
    this.contentEl.createEl('img', { attr: { src: this.screenshot, alt: L('待发送的截图', 'Screenshot to send') } });
    const actions = this.contentEl.createDiv({ cls: 'current-note-chat-edit-preview__actions' });
    actions.createEl('button', { text: L('取消', 'Cancel') }).addEventListener('click', () => this.close());
    actions.createEl('button', { text: L('发送这张截图', 'Send this screenshot'), cls: 'mod-cta' }).addEventListener('click', () => {
      if (!this.signal?.aborted) this.finish(this.screenshot);
      this.close();
    });
    this.signal?.addEventListener('abort', this.onAbort, { once: true });
    if (this.signal?.aborted) this.close();
  }
  finish(value) {
    if (!this.resolve) return;
    const resolve = this.resolve;
    this.resolve = null;
    resolve(value);
  }
  onClose() {
    this.signal?.removeEventListener('abort', this.onAbort);
    this.finish(null);
    this.contentEl.empty();
  }
}
function previewScreenshot(app, screenshot, signal) {
  throwIfAborted(signal);
  return new Promise(resolve => new ScreenshotPreviewModal(app, screenshot, signal, resolve).open());
}
module.exports = { ScreenshotPreviewModal, previewScreenshot };
