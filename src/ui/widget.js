const { Component, MarkdownRenderer, Notice, setIcon } = require('obsidian');
const { L, interfaceLanguage } = require('../i18n');
const { SCREEN_CHAT_KEY, MAX_QUESTION_CHARS, MAX_QUEUE } = require('../constants');
const { normalizeMathDelimiters } = require('../prompts');
const { selectRelevantContext } = require('../retrieval');
const { newMessage, touchSession } = require('../sessions');
const { abortError, throwIfAborted, withAbort } = require('../tasks');
const { EditPreviewModal } = require('./edit-preview');
const { previewScreenshot } = require('./screenshot-preview');
const { FeynmanLearning } = require('./feynman');
const { noteSaveMode } = require('../conversation-notes');
const { buttonContent, iconButton } = require('./elements');

class CurrentNoteChatWidget {
  constructor(plugin) {
    this.plugin = plugin;
    this.busy = false;
    this.queue = [];
    this.queuePaused = false;
    this.snapshots = new Map();
    this.streamingElements = new Map();
    this.learning = new FeynmanLearning(this);
  }
  mount() {
    this.unmounted = false;
    this.rootEl = document.body.createDiv({ cls: 'current-note-chat-float' });
    this.launcherEl = this.rootEl.createEl('button', { cls: 'current-note-chat-float__launcher', text: L('问', 'Ask'), attr: { 'aria-label': L('打开屏幕与文件问答', 'Open Screen & File Q&A'), 'aria-expanded': 'false' } });
    this.launcherEl.setText(''); setIcon(this.launcherEl, 'messages-square');
    this.launcherEl.addEventListener('click', () => this.setOpen(!this.isOpen));
    const root = this.rootEl.createDiv({ cls: 'current-note-chat-float__panel current-note-chat' });
    root.setAttribute('lang', interfaceLanguage());
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', L('屏幕与文件问答', 'Screen & File Q&A'));
    root.addEventListener('keydown', event => { if (event.key === 'Escape') this.setOpen(false); });
    const header = root.createDiv({ cls: 'current-note-chat__header' });
    const brand = header.createDiv({ cls: 'current-note-chat__brand' });
    const mark = brand.createSpan({ cls: 'current-note-chat__brand-mark', attr: { 'aria-hidden': 'true' } }); setIcon(mark, 'messages-square');
    const heading = brand.createDiv();
    this.titleEl = heading.createDiv({ cls: 'current-note-chat__title', text: L('屏幕与文件问答', 'Screen & File Q&A') });
    this.subtitleEl = heading.createDiv({ cls: 'current-note-chat__subtitle', text: L('理解知识，留下记录', 'Understand. Keep a record.') });
    const actions = header.createDiv({ cls: 'current-note-chat__header-actions' });
    this.clearButton = iconButton(actions, L('新对话', 'New chat'), 'plus');
    this.clearButton.addEventListener('click', () => this.plugin.clearCurrentChat());
    this.exportButton = iconButton(actions, L('查看笔记', 'View note'), 'file-text');
    this.exportButton.addEventListener('click', () => noteSaveMode(this.plugin.settings) === 'conversation' ? void this.plugin.openConversationNote() : this.exportCurrentChat());
    iconButton(actions, L('插件设置', 'Plugin settings'), 'settings-2').addEventListener('click', () => this.plugin.openSettings());
    iconButton(actions, L('收起', 'Collapse'), 'chevron-down').addEventListener('click', () => this.setOpen(false));
    const controls = root.createDiv({ cls: 'current-note-chat__controls' });
    const sourceRow = controls.createDiv({ cls: 'current-note-chat__source-row' });
    sourceRow.createSpan({ cls: 'current-note-chat__section-label', text: L('提问来源', 'Source') });
    const modes = sourceRow.createDiv({ cls: 'current-note-chat__modes current-note-chat__sources' });
    this.modeButtons = {};
    for (const [mode, text] of [['screen', L('屏幕', 'Screen')], ['file', L('文件', 'File')]]) {
      const button = modes.createEl('button', { text, attr: { 'aria-pressed': 'false' } });
      buttonContent(button, text, mode === 'screen' ? 'monitor' : 'file');
      button.addEventListener('click', async () => {
        if (this.busy) return;
        this.plugin.settings.contextMode = mode;
        await this.plugin.saveSettings(); this.refresh();
      });
      this.modeButtons[mode] = button;
    }
    this.learning.mount(controls);
    this.noteEl = controls.createDiv({ cls: 'current-note-chat__note' });
    this.archiveRow = controls.createDiv({ cls: 'current-note-chat__archive-row', attr: { 'aria-live': 'polite' } });
    this.archiveStatusEl = this.archiveRow.createSpan();
    this.archiveButton = iconButton(this.archiveRow, L('查看知识笔记', 'View knowledge note'), 'folder-open');
    this.archiveButton.addEventListener('click', () => {
      const path = this.plugin.knowledgeNotes?.statuses.get(this.getChatKey())?.path;
      if (path && this.plugin.app.vault.getAbstractFileByPath(path)) void this.plugin.app.workspace.openLinkText(path, '', true);
    });
    iconButton(this.archiveRow, L('归档任务与用量', 'Archive tasks and usage'), 'list-checks').addEventListener('click', () => { const { ArchiveTasksModal } = require('./archive-tasks'); new ArchiveTasksModal(this.plugin).open(); });
    this.messagesEl = root.createDiv({ cls: 'current-note-chat__messages', attr: { 'aria-live': 'polite', 'aria-label': L('对话记录', 'Conversation') } });
    const composer = root.createDiv({ cls: 'current-note-chat__composer' });
    this.queueEl = composer.createDiv({ cls: 'current-note-chat__queue', attr: { role: 'list', 'aria-live': 'polite', 'aria-label': L('待执行的问题', 'Queued questions') } });
    this.inputEl = composer.createEl('textarea', { cls: 'current-note-chat__input', attr: { 'aria-label': L('问题或笔记修改要求', 'Question or note revision instruction') } });
    this.inputEl.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); void this.sendQuestion(); }
    });
    const footer = composer.createDiv({ cls: 'current-note-chat__actions' });
    const tips = footer.createDiv({ cls: 'current-note-chat__composer-tips' });
    this.statusEl = tips.createSpan({ cls: 'current-note-chat__status' });
    tips.createSpan({ cls: 'current-note-chat__keyboard-hint', text: L('Enter 发送 · Shift+Enter 换行', 'Enter to send · Shift+Enter for a new line') });
    const sendActions = footer.createDiv({ cls: 'current-note-chat__send-actions' });
    this.editButton = iconButton(sendActions, L('优化/修改笔记', 'Revise note'), 'pencil-line');
    this.editButton.addEventListener('click', () => void this.editNote());
    this.sendButton = sendActions.createEl('button', { text: L('发送', 'Send'), cls: 'mod-cta current-note-chat__send' });
    this.sendButton.addEventListener('click', () => this.busy ? this.cancel() : void this.sendQuestion());
    this.refresh();
  }
  cancel() { this.queuePaused = true; this.requestController?.abort(abortError(L('已停止请求。', 'Request stopped.'))); }
  unmount() {
    this.unmounted = true; this.cancel();
    this.queue = [];
    clearTimeout(this._streamRenderTimer); this._streamRenderTimer = null;
    clearTimeout(this._snapshotExpiryTimer); this._snapshotExpiryTimer = null;
    this.renderComponent?.unload(); this.renderComponent = null;
    this.snapshots.clear(); this.streamingElements.clear(); this.rootEl?.remove();
  }
  setOpen(open) {
    if (this.unmounted) return;
    this.isOpen = open;
    this.rootEl.toggleClass('is-open', open); this.launcherEl.setAttribute('aria-expanded', String(open));
    if (open) {
      this.refresh(); this.inputEl.focus();
      if (!this.plugin.settings.profileWizardDone && !this._wizardShown) {
        this._wizardShown = true;
        const { ProfileWizardModal } = require('./profile-wizard');
        new ProfileWizardModal(this.plugin).open();
      }
    }
    else if (this.plugin.settings.showLauncher !== false) this.launcherEl.focus();
  }
  getChatKey() { return this.learning.enabled ? this.learning.key() : this.plugin.settings.contextMode === 'screen' ? SCREEN_CHAT_KEY : this.plugin.activeFile?.path; }
  refresh() {
    if (this.unmounted || !this.noteEl) return;
    this.plugin.settingsTab?.setBusy(this.busy);
    this.launcherEl.toggleClass('is-hidden', this.plugin.settings.showLauncher === false);
    const screen = this.plugin.settings.contextMode === 'screen';
    const file = this.plugin.activeFile;
    this.noteEl.setText(screen ? L('截取当前显示器，画面可能包含其他应用窗口。', 'Captures the current display, including other app windows.') : file ? `${L('当前文件', 'Current file')}: ${file.path}` : L('请打开支持的文件。', 'Open a supported file.'));
    if (this.learning.enabled && this.learning.state()?.source?.mode === 'screen') this.noteEl.setText(L('学习资料：本轮固定截图，后续作答会复用这张图。', 'Learning source: the frozen screenshot is reused for this round.'));
    this.noteEl.setAttribute('title', this.noteEl.textContent || this.noteEl.text || '');
    this.inputEl.placeholder = this.busy ? L('回答进行中：输入下一个问题，回车排队执行…', 'Answer in progress: type the next question and press Enter to queue it…') : screen ? L('询问屏幕内容，或输入笔记修改要求…', 'Ask about the screen, or request a note revision…') : L('询问文件内容，或输入笔记修改要求…', 'Ask about the file, or request a note revision…');
    this.inputEl.setAttribute('aria-label', L('问题或笔记修改要求', 'Question or note revision instruction'));
    this.inputEl.disabled = !screen && !file;
    this.sendButton.disabled = !this.busy && !screen && !file;
    buttonContent(this.sendButton, this.busy ? L('停止', 'Stop') : L('发送', 'Send'), this.busy ? 'square' : 'arrow-up');
    this.clearButton.disabled = !this.getChatKey() || this.busy; this.exportButton.disabled = this.busy;
    buttonContent(this.clearButton, L('新对话', 'New chat'), 'plus', true);
    buttonContent(this.exportButton, noteSaveMode(this.plugin.settings) === 'conversation' ? L('查看笔记', 'View note') : L('导出', 'Export'), 'file-text', true);
    this.editButton.disabled = this.busy || !this.plugin.getEditableMarkdownView();
    for (const [mode, button] of Object.entries(this.modeButtons)) { button.disabled = this.busy; button.setAttribute('aria-pressed', String(this.plugin.settings.contextMode === mode)); }
    const provider = { codex: 'Codex CLI', deepseek: 'DeepSeek', openai: 'OpenAI', api: L('自定义 API', 'Custom API') }[this.plugin.settings.backend];
    this.statusEl.setText(this.busy ? `${provider} · ${L('正在处理', 'Working')}…` : `${provider}${noteSaveMode(this.plugin.settings) === 'conversation' ? ` · ${L('自动记录', 'Auto-save')}` : ''}`);
    this.refreshArchive();
    this.learning.refresh();
    this.renderMessages();
    this.renderQueue();
    if (!this.busy && !this.queuePaused && this.queue.length) setTimeout(() => this.drainQueue(), 0);
  }
  validKey(key) { return key === SCREEN_CHAT_KEY || Boolean(this.plugin.app.vault.getAbstractFileByPath(key)); }
  clearQueueFor(key) {
    const before = this.queue.length;
    this.queue = this.queue.filter(item => item.key !== key && !item.key.startsWith(key + '/'));
    if (this.queue.length !== before) this.renderQueue();
  }
  renameQueue(oldPath, newPath) {
    for (const item of this.queue) if (item.key === oldPath || item.key.startsWith(oldPath + '/')) item.key = newPath + item.key.slice(oldPath.length);
    this.renderQueue();
  }
  renderQueue() {
    if (this.unmounted || !this.queueEl) return;
    this.queueEl.empty();
    this.queueEl.toggleClass('is-empty', !this.queue.length);
    if (this.queuePaused && this.queue.length) {
      const resume = this.queueEl.createEl('button', { text: L('继续执行待提问问题', 'Resume queued questions') });
      resume.disabled = this.busy || this.learning.enabled;
      resume.addEventListener('click', () => { this.queuePaused = false; this.drainQueue(); });
    }
    const current = this.getChatKey();
    for (const item of this.queue) {
      const row = this.queueEl.createDiv({ cls: 'current-note-chat__queue-item' });
      row.setAttribute('role', 'listitem');
      const icon = row.createSpan({ cls: 'current-note-chat__queue-icon', attr: { 'aria-hidden': 'true' } });
      setIcon(icon, 'clock');
      const source = item.key === current ? '' : `${item.key === SCREEN_CHAT_KEY ? L('屏幕', 'Screen') : item.key.split('/').at(-1)} · `;
      row.createSpan({ cls: 'current-note-chat__queue-text', text: `⏳ ${source}${item.text.split('\n')[0]}`.slice(0, 120), attr: { title: item.text } });
      const remove = iconButton(row, L('移除待执行问题', 'Remove queued question'), 'x');
      remove.addClass('current-note-chat__queue-remove');
      remove.addEventListener('click', () => {
        const at = this.queue.indexOf(item);
        if (at >= 0) this.queue.splice(at, 1);
        this.renderQueue();
      });
    }
  }
  drainQueue() {
    if (this.unmounted || this.busy || this.learning.enabled || this.queuePaused) return;
    this.queue = this.queue.filter(item => this.validKey(item.key) && (!item.sourceFile || this.plugin.app.vault.getAbstractFileByPath(item.key) === item.sourceFile));
    const key = this.getChatKey();
    const index = key ? this.queue.findIndex(item => item.key === key) : -1;
    if (index < 0) { this.renderQueue(); return; }
    const [item] = this.queue.splice(index, 1);
    this.renderQueue();
    void this.sendQuestion(null, item.text, item.sourceTarget);
  }
  refreshArchive() {
    if (this.unmounted) return;
    const archive = this.plugin.knowledgeNotes?.statuses.get(this.getChatKey());
    this.archiveRow?.toggleClass('is-hidden', !archive);
    if (archive && this.archiveStatusEl) {
      const title = archive.path?.split('/').at(-1).replace(/\.md$/, '');
      const labels = { queued: L('等待归档…', 'Queued for archiving…'), classifying: L('正在分类…', 'Classifying…'), paused: L('归档已暂停，可在归档任务中重试。', 'Archiving paused; retry in Archive tasks.'), cancelled: L('归档已取消。', 'Archiving cancelled.'), error: L('归档未完成，请查看归档任务。', 'Archiving incomplete; open Archive tasks.') };
      this.archiveStatusEl.setText(archive.state === 'saved' ? `${archive.inbox ? L('待整理', 'Inbox') : L('已归档', 'Archived')}: ${title}` : labels[archive.state] || L('正在整理知识…', 'Organizing knowledge…'));
      this.archiveStatusEl.setAttribute('title', archive.error || archive.path || '');
      this.archiveButton.toggleClass('is-hidden', !archive.path); this.archiveButton.disabled = this.busy;
    }
  }
  nearBottom() { return this.messagesEl.scrollHeight - this.messagesEl.scrollTop - this.messagesEl.clientHeight < 70; }
  renderMessages() {
    if (this.unmounted || !this.messagesEl) return;
    const key = this.getChatKey();
    const stick = this._renderKey !== key || this.nearBottom();
    const previousTop = this.messagesEl.scrollTop;
    this._renderKey = key;
    this.renderComponent?.unload(); this.renderComponent = new Component(); this.renderComponent.load();
    this.messagesEl.empty(); this.streamingElements.clear();
    const thread = this.plugin.messagesByNote.get(key) || [];
    if (!thread.length) this.messagesEl.createDiv({ cls: 'current-note-chat__empty', text: this.learning.enabled ? L('输入知识点名称开始费曼学习。', 'Enter a concept to start Feynman learning.') : L('输入问题开始对话。', 'Ask a question to start a conversation.') });
    for (const message of thread) {
      const bubble = this.messagesEl.createDiv({ cls: `current-note-chat__message current-note-chat__message--${message.role}` });
      if (message.role === 'assistant' && !message.error) {
        const metadata = bubble.createDiv({ cls: 'current-note-chat__message-meta' });
        metadata.createSpan({ text: L('AI 助手', 'Assistant') });
        const content = bubble.createDiv({ cls: 'current-note-chat__rendered markdown-rendered' });
        if (message.streaming) { content.setText(message.text || L('正在等待回答…', 'Waiting for an answer…')); this.streamingElements.set(message.id, content); }
        else {
          const component = this.renderComponent;
          const source = this.learning.enabled ? this.learning.state()?.source?.path || this.learning.sourceKey() : key;
          void MarkdownRenderer.render(this.plugin.app, normalizeMathDelimiters(message.text), content, source === SCREEN_CHAT_KEY ? '' : source || '', component).catch(() => {
            if (!this.unmounted && component === this.renderComponent) content.setText(message.text);
          });
          const copy = iconButton(metadata, L('复制回答', 'Copy answer'), 'copy'); copy.addClass('current-note-chat__copy');
          copy.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(message.text); new Notice(L('已复制回答。', 'Answer copied.')); }
            catch { new Notice(L('无法访问剪贴板。', 'Could not access the clipboard.')); }
          });
        }
      } else {
        bubble.setText(message.text);
        if (message.error && message.replyTo) {
          const retry = bubble.createEl('button', { cls: 'current-note-chat__copy', text: L('重试这条问题', 'Retry this question') });
          retry.disabled = this.busy || (this.learning.enabled && !this.learning.canRetry(message.replyTo));
          retry.addEventListener('click', () => void this.sendQuestion(message.replyTo));
        }
      }
    }
    this.messagesEl.scrollTop = stick ? this.messagesEl.scrollHeight : previousTop;
  }
  updateStreamingMessage(message, text) {
    if (this.unmounted) return;
    message.text = text;
    if (this._streamRenderTimer) return;
    this._streamRenderTimer = setTimeout(() => {
      this._streamRenderTimer = null;
      if (this.unmounted) return;
      const content = this.streamingElements.get(message.id);
      if (!content) return;
      const stick = this.nearBottom(); content.setText(message.text);
      if (stick) this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }, 120);
  }
  cacheSnapshot(id, snapshot) {
    const now = Date.now();
    for (const [key, entry] of this.snapshots) if (now - entry.at > 10 * 60 * 1000) this.snapshots.delete(key);
    this.snapshots.delete(id); this.snapshots.set(id, { snapshot, at: now });
    let bytes = [...this.snapshots.values()].reduce((sum, item) => sum + (item.snapshot.screenshot?.length || 0), 0);
    while (this.snapshots.size > 6 || bytes > 8000000) {
      const key = this.snapshots.keys().next().value;
      bytes -= this.snapshots.get(key).snapshot.screenshot?.length || 0; this.snapshots.delete(key);
    }
    this.pruneSnapshots();
  }
  pruneSnapshots() {
    clearTimeout(this._snapshotExpiryTimer); this._snapshotExpiryTimer = null;
    const now = Date.now();
    for (const [key, entry] of this.snapshots) if (now - entry.at >= 10 * 60 * 1000) this.snapshots.delete(key);
    if (!this.snapshots.size || this.unmounted) return;
    const delay = Math.max(1, Math.min(...[...this.snapshots.values()].map(entry => entry.at + 10 * 60 * 1000 - now)));
    this._snapshotExpiryTimer = setTimeout(() => this.pruneSnapshots(), delay);
    this._snapshotExpiryTimer?.unref?.();
  }
  async sendQuestion(retryId, presetText, presetTarget) {
    if (this.learning.enabled) return this.learning.send(retryId);
    if (this.unmounted) return;
    if (this.busy) {
      if (retryId || presetText) return;
      const key = this.getChatKey();
      if (!key) { new Notice(L('请先打开支持的文件。', 'Open a supported file first.')); return; }
      const text = this.inputEl.value.trim();
      if (!text) return;
      if (text.length > MAX_QUESTION_CHARS) { new Notice(L('问题不能超过 8000 字符。', 'Keep the question within 8000 characters.')); return; }
      if (this.queue.length >= MAX_QUEUE) { new Notice(L('待执行问题最多 5 条，请等当前回答完成。', 'At most 5 queued questions; wait for the current answer.')); return; }
      this.queue.push({ key, text, ...(key === SCREEN_CHAT_KEY ? { sourceTarget: this.plugin.activeFile || null } : { sourceFile: this.plugin.app.vault.getAbstractFileByPath(key) }) });
      this.inputEl.value = '';
      this.renderQueue();
      return;
    }
    const key = this.getChatKey();
    if (!key) { new Notice(L('请先打开支持的文件。', 'Open a supported file first.')); return; }
    const thread = this.plugin.messagesByNote.get(key) || [];
    const userIndex = retryId ? thread.findIndex(item => item.id === retryId && item.role === 'user') : -1;
    if (retryId && userIndex < 0) return;
    const question = retryId ? thread[userIndex].text : (presetText ?? this.inputEl.value.trim());
    if (!question) return;
    if (question.length > MAX_QUESTION_CHARS) { new Notice(L('问题不能超过 8000 字符。', 'Keep the question within 8000 characters.')); return; }
    const mode = key === SCREEN_CHAT_KEY ? 'screen' : 'file';
    const file = mode === 'file' ? this.plugin.app.vault.getAbstractFileByPath(key) : null;
    const sourceTarget = mode === 'file' ? file : presetTarget !== undefined ? presetTarget : this.plugin.activeFile;
    const history = thread.slice(0, retryId ? userIndex : thread.length).filter(item => !item.error && !item.streaming).slice(-6).map(({ role, text }) => ({ role, text }));
    const user = retryId ? thread[userIndex] : newMessage('user', question);
    if (!retryId) { thread.push(user); if (!presetText) this.inputEl.value = ''; }
    const reply = newMessage('assistant', '', { streaming: true, replyTo: user.id });
    const oldError = retryId ? thread.findIndex(item => item.error && item.replyTo === user.id) : -1;
    if (oldError >= 0) thread.splice(oldError, 1, reply); else thread.push(reply);
    touchSession(this.plugin.messagesByNote, key, thread);
    this.queuePaused = false;
    this.busy = true; this.requestController = new AbortController(); this.refresh();
    let meta = { mode, source: mode === 'file' ? key : undefined, model: this.plugin.currentModel() };
    let snapshot = null;
    let answerNotePath = null;
    try {
      await this.plugin.saveConversation?.(key, thread, meta);
      snapshot = retryId ? this.snapshots.get(user.id) : null;
      snapshot = snapshot && Date.now() - snapshot.at < 10 * 60 * 1000 ? snapshot.snapshot : null;
      const signal = this.requestController.signal;
      if (!snapshot) {
        if (retryId) new Notice(L('原始上下文已不可用，将读取当前文件或重新截图。', 'Original context is unavailable; reading the current file or capturing a new screenshot.'));
        snapshot = { mode, source: mode === 'file' ? key : undefined, question, history, sourceTarget };
        if (mode === 'screen') {
          this.rootEl.addClass('is-capturing');
          try {
            await withAbort(new Promise(resolve => setTimeout(resolve, 180)), signal);
            snapshot.screenshot = await this.plugin.runTask(inner => this.plugin.captureCurrentScreen(inner), signal);
          } finally { this.rootEl.removeClass('is-capturing'); }
        } else {
          const full = await this.plugin.runTask(inner => this.plugin.readCurrentFile(file, inner), signal);
          const context = selectRelevantContext(full, question);
          snapshot.partial = context.partial;
          snapshot.noteText = context.partial ? `The following are excerpts and may not cover the full file.\n\n${context.text}` : context.text;
        }
        throwIfAborted(signal); this.cacheSnapshot(user.id, snapshot);
      }
      if (snapshot.screenshot && this.plugin.settings.previewScreenshot) {
        const confirmed = await previewScreenshot(this.plugin.app, snapshot.screenshot, signal);
        throwIfAborted(signal); if (!confirmed) throw abortError(L('已取消发送截图。', 'Screenshot sending cancelled.'));
      }
      meta = { mode, source: snapshot.source, model: this.plugin.currentModel() };
      const onDelta = partial => this.updateStreamingMessage(reply, partial);
      const answer = snapshot.screenshot
        ? await this.plugin.askScreen(snapshot.screenshot, snapshot.history, question, onDelta, signal)
        : await this.plugin.ask(snapshot.source, snapshot.noteText, snapshot.history, question, onDelta, signal);
      throwIfAborted(signal); if (this.unmounted) return;
      reply.streaming = false;
      reply.text = snapshot.partial ? `${answer}\n\n${L('（本次基于相关片段回答，未涵盖全文。）', '(Answered from selected excerpts, not the complete file.)')}` : answer;
      if (noteSaveMode(this.plugin.settings) === 'answer') answerNotePath = await this.plugin.saveQAToNote(question, reply.text, { ...meta, archiveKey: mode === 'file' ? file?.path || key : key, archiveMessageId: user.id });
    } catch (error) {
      this.queuePaused = true;
      if (!this.unmounted) { reply.streaming = false; reply.error = true; reply.text = `${L('无法回答', 'Could not answer')}: ${error.message || error}`; }
    } finally {
      clearTimeout(this._streamRenderTimer); this._streamRenderTimer = null;
      const savedKey = mode === 'file' ? file?.path || key : key;
      const ownsThread = !this.unmounted && this.plugin.messagesByNote.get(savedKey) === thread;
      const transcriptPath = ownsThread ? await this.plugin.saveConversation?.(savedKey, thread, { ...meta, source: mode === 'file' ? savedKey : undefined }) || answerNotePath : null;
      if (transcriptPath && ownsThread && noteSaveMode(this.plugin.settings) === 'conversation' && !reply.error && !reply.streaming) void this.plugin.queueKnowledgeArchive?.(savedKey, user, reply, { ...meta, transcriptPath, source: mode === 'file' ? savedKey : undefined });
      else if (!transcriptPath && ownsThread && noteSaveMode(this.plugin.settings) === 'conversation' && !reply.error && !reply.streaming) this.plugin.knowledgeNotes?.deferTranscript(savedKey, user, reply, { ...meta, source: mode === 'file' ? savedKey : undefined });
      if (ownsThread && !reply.error && !reply.streaming && this.plugin.settings.qaAppendSource && this.plugin.sourceNotes) {
        const target = snapshot?.sourceTarget !== undefined ? snapshot.sourceTarget : sourceTarget;
        if (target?.extension?.toLowerCase() === 'md') void this.plugin.sourceNotes.append(target.path, { id: user.id, question, answer: reply.text, screenshot: snapshot?.screenshot || null, transcriptPath: transcriptPath || null, mode });
        else new Notice(L('提问未写入笔记：', 'Question not appended: ') + (mode === 'file' ? L('被提问的是 PDF 等非 Markdown 文件，只有 Markdown 笔记能写入。', 'the asked file is not a Markdown note; only Markdown notes can receive appends.') : target ? L('提问时打开的不是 Markdown 笔记，屏幕提问只写入当时打开的 Markdown 笔记。', 'no Markdown note was open when asking; screen questions only append to the Markdown note open at ask time.') : L('提问时没有打开任何 Markdown 笔记，屏幕提问需要一个打开的笔记作为写入目标。', 'no Markdown note was open when asking; screen questions need an open note as the write target.')), 8000);
      }
      this.busy = false; this.requestController = null;
      if (!this.unmounted) { this.plugin.queueSaveSessions(); this.refresh(); this.drainQueue(); }
    }
  }
  async editNote() {
    if (this.busy || this.unmounted) return;
    const instruction = this.inputEl.value.trim() || L('优化笔记结构、语言和排版，保留原意、公式、引用和链接。', 'Improve structure, wording and formatting, retaining meaning, formulas, references and links.');
    if (instruction.length > MAX_QUESTION_CHARS) { new Notice(L('修改要求不能超过 8000 字符。', 'Keep the revision request within 8000 characters.')); return; }
    this.busy = true; this.requestController = new AbortController(); this.refresh();
    try {
      const proposal = await this.plugin.proposeNoteEdit(instruction, this.requestController.signal);
      throwIfAborted(this.requestController.signal);
      if (!this.unmounted) new EditPreviewModal(this.plugin, proposal).open();
    } catch (error) { if (!this.unmounted) new Notice(`${L('无法生成修改', 'Could not draft revision')}: ${error.message || error}`); }
    finally { this.busy = false; this.requestController = null; if (!this.unmounted) this.refresh(); }
  }
  exportCurrentChat() {
    if (this.busy || this.unmounted) return;
    const key = this.getChatKey();
    const thread = (this.plugin.messagesByNote.get(key) || []).filter(item => !item.error && !item.streaming && item.text.trim());
    if (!thread.length) { new Notice(L('没有可导出的对话。', 'There is no conversation to export.')); return; }
    if (this.learning.enabled) {
      const state = this.learning.state();
      const summary = newMessage('assistant', this.learning.report(state));
      void this.plugin.exportChatToNote([...thread, summary], { mode: this.plugin.settings.contextMode, source: state?.source?.path || (this.learning.sourceKey() === SCREEN_CHAT_KEY ? null : this.learning.sourceKey()), activity: 'feynman' });
    } else void this.plugin.exportChatToNote(thread, { mode: key === SCREEN_CHAT_KEY ? 'screen' : 'file', source: key === SCREEN_CHAT_KEY ? null : key });
  }
}
module.exports = { CurrentNoteChatWidget };
