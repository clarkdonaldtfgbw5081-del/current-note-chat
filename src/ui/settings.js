const { PluginSettingTab, SecretComponent, Setting } = require('obsidian');
const { L } = require('../i18n');
const { noteSaveMode } = require('../conversation-notes');
const CurrentNoteChatSettings = class extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.diagnosticController?.abort(); this.diagnosticController = null; this.diagnosticBusy = false;
    this.containerEl.empty();
    const containerEl = this.containerEl.createEl('fieldset', { cls: 'current-note-chat-settings-form' });
    this.formEl = containerEl; this.setBusy(this.plugin.widget?.busy);
    new Setting(containerEl).setName(L('屏幕与文件问答', 'Screen & File Q&A')).setHeading();
    new Setting(containerEl).setName(L('发送前预览截图', 'Preview screenshots before sending')).setDesc(L('预览将发送的画面，确认后才会请求 AI。', 'Review the captured image before it is sent to AI.')).addToggle(toggle => toggle.setValue(this.plugin.settings.previewScreenshot).onChange(async value => {
      this.plugin.settings.previewScreenshot = value; await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('API 超时时间', 'API timeout')).addDropdown(dropdown => dropdown.addOption('60', L('1 分钟', '1 minute')).addOption('120', L('2 分钟', '2 minutes')).addOption('300', L('5 分钟', '5 minutes')).setValue(String(this.plugin.settings.apiTimeoutSeconds)).onChange(async value => {
      this.plugin.settings.apiTimeoutSeconds = Number(value); await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('流式回答', 'Stream answers')).setDesc(L('若服务商阻止浏览器流式请求，请关闭此项使用 Obsidian 请求接口。网络错误不会自动重发。', 'Disable if the provider blocks browser streaming. Network errors are never automatically resent.')).addToggle(toggle => toggle.setValue(this.plugin.settings.streamingEnabled).onChange(async value => {
      this.plugin.settings.streamingEnabled = value; await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('笔记自动保存方式', 'Automatic note saving')).setDesc(L('默认将同一对话的提问、回答和费曼学习进度持续写入同一篇笔记，无需手动导出。新对话使用新笔记，已有笔记会保留。', 'By default, questions, responses and Feynman progress update one note per conversation. No manual export is needed. New chats create new notes; existing notes are retained.')).addDropdown(dropdown => dropdown
      .addOption('conversation', L('每个对话一篇笔记（默认）', 'One note per conversation (default)'))
      .addOption('answer', L('每次回答单独一篇笔记', 'One note per answer'))
      .addOption('off', L('关闭自动保存', 'Off'))
      .setValue(noteSaveMode(this.plugin.settings)).onChange(async value => {
        this.plugin.settings.noteSaveMode = value; this.plugin.settings.saveQA = value !== 'off';
        if (value === 'off') this.plugin.knowledgeNotes?.cancel();
        await this.plugin.saveSettings(); this.plugin.refreshViews();
      }));
    new Setting(containerEl).setName(L("对话笔记保存位置", "Conversation notes folder")).setDesc(L("仓库内的文件夹路径；留空时默认为「AI 问答」（英文界面为 AI Q&A），文件夹不存在会自动创建。修改后新的对话使用新位置，已有对话继续更新原笔记。", "A folder path in the vault; empty defaults to AI Q&A. Missing folders are created. Folder changes apply to new conversations; existing ones keep updating their original note.")).addText((text) => text.setPlaceholder(L("AI 问答", "AI Q&A")).setValue(this.plugin.settings.qaFolder ?? "").onChange(async (value) => {
      this.plugin.settings.qaFolder = value.trim();
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('将提问写入被提问的笔记', 'Append questions to the asked note')).setDesc(L('回答完成后追加到被提问的 Markdown 笔记；屏幕提问绑定提交或排队时打开的笔记，截图存为附件再嵌入。此开关独立于对话自动保存。AI 问答与知识库目录中的笔记不会被写入。', 'Append to the asked Markdown note after completion. Screen questions use the note open when submitted or queued; screenshots become embedded attachments. This toggle is independent of conversation auto-save. Notes in the AI Q&A and knowledge folders are protected.')).addToggle(toggle => toggle.setValue(this.plugin.settings.qaAppendSource !== false).onChange(async value => {
      this.plugin.settings.qaAppendSource = value; await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('写入提问时包含 AI 回答', 'Include the AI answer when appending')).setDesc(L('关闭后只在笔记里记录问题本身；完整回答仍在对话笔记中。', 'Off records only the question; the full answer stays in the conversation note.')).addToggle(toggle => toggle.setValue(this.plugin.settings.qaAppendAnswer !== false).onChange(async value => {
      this.plugin.settings.qaAppendAnswer = value; await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('学习画像', 'Learner profile')).setDesc(L('回答三个小问题（基础水平、回答风格、背景），之后普通问答会按你的情况讲透原理并附例子；费曼学习与笔记改写不受影响。', 'Three quick questions (level, answer style, background). Ordinary Q&A then explains principles at your level and adds examples. Feynman learning and note revision are unaffected.')).addButton(button => button.setButtonText(L('打开向导', 'Open wizard')).onClick(() => { const { ProfileWizardModal } = require('./profile-wizard'); new ProfileWizardModal(this.plugin).open(); }));
    new Setting(containerEl).setName(L('基础水平', 'Level')).setDesc(L('可不设置基础水平，仍能单独启用详细讲解、例子和背景补充。', 'Level is optional; detailed explanations, examples and background can be enabled independently.')).addDropdown(dropdown => dropdown.addOption('', L('未设置', 'Unset')).addOption('beginner', L('刚入门', 'Beginner')).addOption('intermediate', L('有基础', 'Intermediate')).addOption('advanced', L('想深入原理', 'Advanced')).setValue(this.plugin.settings.learnerLevel || '').onChange(async value => { this.plugin.settings.learnerLevel = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('详细讲解原理', 'Explain principles in depth')).setDesc(L('先给直接答案，再一步步讲清背后的原理和联系，不需要追问也能真正弄懂。回答会变长、增加 token 用量。', 'Direct answer first, then the underlying reasoning step by step, so follow-ups are unnecessary. Answers get longer and cost more tokens.')).addToggle(toggle => toggle.setValue(this.plugin.settings.answerDepth === true).onChange(async value => { this.plugin.settings.answerDepth = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('回答后附例子', 'Add worked examples')).setDesc(L('回答末尾附 2-3 个同一知识点的例题（由易到难、带简答），帮助举一反三；例子超出资料来源时会明确标注。', 'End with 2-3 examples of increasing difficulty on the same point, each with a brief solution. Examples beyond the source are clearly marked.')).addToggle(toggle => toggle.setValue(this.plugin.settings.answerExamples === true).onChange(async value => { this.plugin.settings.answerExamples = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('跨对话记忆召回', 'Cross-conversation memory recall')).setDesc(L('提问前自动从「AI 知识库」笔记和历史问答里召回最相关的几条作为背景注入，回答后命中的条目会被强化；全部本地完成、无额外请求。召回内容会随提问发送给 AI 服务商，关闭后立即恢复原行为。', 'Before each question, recall the most related knowledge-note snippets and past questions as prompt background; recalled entries are reinforced after successful answers. Everything runs locally with no extra requests. Recalled content is sent to the AI provider with the question; turn off to restore the previous behavior.')).addToggle(toggle => toggle.setValue(this.plugin.settings.memoryRecallEnabled !== false).onChange(async value => { this.plugin.settings.memoryRecallEnabled = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('背景补充', 'Background notes')).setDesc(L('选填，最多 200 字：专业、学过的课程等，帮助 AI 贴合你的情况。此内容会随每次提问发送给 AI 服务商。', 'Optional, up to 200 characters: major, courses taken and similar context. Sent to the AI provider with every question.')).addText(text => text.setPlaceholder(L('例如：大三统计学，学过概率论', 'e.g. Third-year statistics; covered probability')).setValue(this.plugin.settings.learnerBackground || '').onChange(async value => { this.plugin.settings.learnerBackground = value.trim().slice(0, 200); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('AI 自动分类归档', 'AI classification and archiving')).setDesc(L('完整回答保存后，额外请求一次当前 AI，提炼知识点并归入知识目录中的主题笔记。只发送问题、回答和候选笔记名称；原对话保留。不确定时放入“待整理”。费曼学习完成后归档通过记录。关闭自动保存时也停止自动归档。', 'After saving a complete answer, make one additional request to the current AI to summarize and file it in a topic note. Only the question, answer and candidate note names are sent; the transcript stays intact. Uncertain results go to Inbox. Feynman rounds archive on completion. Turning off automatic saving also stops automatic archiving.')).addToggle(toggle => toggle.setValue(this.plugin.settings.autoClassify).onChange(async value => {
      this.plugin.settings.autoClassify = value; if (!value) this.plugin.knowledgeNotes?.cancel(); await this.plugin.saveSettings(); this.plugin.refreshViews();
    }));
    new Setting(containerEl).setName(L('知识笔记目录', 'Knowledge notes folder')).setDesc(L('默认“AI 知识库”。只在此目录及子目录寻找已有主题笔记；需要时创建分类目录和主题笔记。已有内容保留，摘要追加在末尾。分类请求可能产生额外 AI 费用。', 'Defaults to AI Knowledge. Search for existing topic notes only inside this folder and its subfolders; create categories and topic notes when needed. Summaries append without replacing existing content. Classification requests may incur additional AI usage.')).addText(text => text.setPlaceholder(L('AI 知识库', 'AI Knowledge')).setValue(this.plugin.settings.knowledgeFolder).onChange(async value => {
      this.plugin.knowledgeNotes?.cancel(); this.plugin.settings.knowledgeFolder = value.trim(); await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L('分类专用模型', 'Classification model')).setDesc(L('留空沿用问答模型；API 连接可填写同一服务商支持的低成本文本模型。Codex CLI 沿用其自身配置。', 'Empty uses the Q&A model. API connections may use another text model supported by the same provider. Codex CLI keeps its own configuration.')).addText(text => text.setValue(this.plugin.settings.classificationModel).onChange(async value => { this.plugin.settings.classificationModel = value.trim().slice(0, 200); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('每日分类请求上限', 'Daily classification request limit')).setDesc(L('限制额外分类请求次数，失败请求也计入；不限制普通问答。达到上限时保留任务，可在明天重试。', 'Limits extra classification attempts, including failed requests. Q&A is unaffected. Pending tasks remain available to retry tomorrow.')).addDropdown(dropdown => dropdown.addOption('0', L('不限次数', 'Unlimited')).addOption('10', '10').addOption('25', '25').addOption('50', '50').addOption('100', '100').setValue(String(this.plugin.settings.classificationDailyLimit)).onChange(async value => { this.plugin.settings.classificationDailyLimit = Number(value); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('归档任务与用量', 'Archive tasks and usage')).addButton(button => button.setButtonText(L('查看任务', 'View tasks')).onClick(() => { const { ArchiveTasksModal } = require('./archive-tasks'); new ArchiveTasksModal(this.plugin).open(); }));
    new Setting(containerEl).setName(L('应用题难度', 'Application difficulty')).addDropdown(dropdown => dropdown.addOption('1', L('基础应用', 'Direct application')).addOption('2', L('迁移与推理', 'Transfer and reasoning')).addOption('3', L('反例与边界', 'Counterexamples and limits')).setValue(String(this.plugin.settings.learningDifficulty)).onChange(async value => { this.plugin.settings.learningDifficulty = Number(value); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L('记录间隔复习计划', 'Track spaced review plans')).setDesc(L('完成费曼学习后记录下一次复习日期；只在本地显示，不自动请求 AI。', 'Track the next review date after a Feynman round. Local display only; never requests AI automatically.')).addToggle(toggle => toggle.setValue(this.plugin.settings.learningReviewEnabled).onChange(async value => { this.plugin.settings.learningReviewEnabled = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(L("显示悬浮提问按钮", "Show floating Ask button")).setDesc(L("关闭后可从左侧功能区图标或命令面板打开问答窗口。", "Turn off to open the panel from the left ribbon icon or the command palette instead.")).addToggle((toggle) => toggle.setValue(this.plugin.settings.showLauncher !== false).onChange(async (value) => {
      this.plugin.settings.showLauncher = value;
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
    }));
    new Setting(containerEl).setName(L("屏幕截图最长边", "Screenshot max edge")).setDesc(L("发送前把截图等比缩小到该像素数以内，可显著降低视觉模型的费用；选“原始分辨率”则不缩放。", "Downscale screenshots to fit this pixel size before sending to cut vision API costs; choose \u201COriginal\u201D to disable.")).addDropdown((dropdown) => dropdown.addOption("1600", "1600 px").addOption("2048", L("2048 px（推荐）", "2048 px (recommended)")).addOption("2560", "2560 px").addOption("0", L("原始分辨率", "Original")).setValue(String(this.plugin.settings.screenshotMaxEdge ?? 2048)).onChange(async (value) => {
      this.plugin.settings.screenshotMaxEdge = Number(value);
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L("屏幕问答捕获鼠标所在显示器", "Screen Q&A follows the cursor")).setDesc(L("开启后截取鼠标所在的显示器，而不是 Obsidian 窗口所在的显示器。", "Capture the display the mouse is on instead of the one Obsidian occupies.")).addToggle((toggle) => toggle.setValue(this.plugin.settings.screenFollowCursor === true).onChange(async (value) => {
      this.plugin.settings.screenFollowCursor = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L("AI 连接方式", "AI backend")).setDesc(L("选择本机 Codex，或使用对应服务的 API 密钥。", "Use the local Codex CLI, or an API key from a supported provider.")).addDropdown((dropdown) => dropdown.addOption("codex", "Codex CLI").addOption("deepseek", "DeepSeek").addOption("openai", "OpenAI").addOption("api", L("自定义兼容 API", "Custom compatible API")).setValue(this.plugin.settings.backend).onChange(async (value) => {
      this.plugin.settings.backend = value;
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
      this.display();
    }));
    if (this.plugin.settings.backend === "codex") {
      new Setting(containerEl).setName(L('忽略 Codex 用户配置', 'Ignore Codex user configuration')).setDesc(L('默认隔离本机 config.toml 中的工具和服务配置，仍使用本机登录。需要 Codex 支持 --ignore-user-config。', 'Ignore local config.toml tool and service settings while using the local login. Requires --ignore-user-config support.')).addToggle(toggle => toggle.setValue(this.plugin.settings.codexIgnoreUserConfig).onChange(async value => {
        this.plugin.settings.codexIgnoreUserConfig = value; await this.plugin.saveSettings();
      }));
      new Setting(containerEl).setName(L("Codex 可执行文件", "Codex executable")).setDesc(L("留空会自动查找本机 Codex 或使用 PATH 中的 codex；找不到时填写 codex.exe 的完整路径。", "Leave empty to auto-detect Codex or use codex from PATH; otherwise enter the full path to codex.exe.")).addText((text) => text.setPlaceholder(L("自动查找", "Auto-detect")).setValue(this.plugin.settings.codexPath).onChange(async (value) => {
        this.plugin.settings.codexPath = value;
        await this.plugin.saveSettings();
      }));
      new Setting(containerEl).setName(L("Codex 最长等待时间", "Codex timeout")).setDesc(L("复杂文件可能需要更久；优先选取相关片段后通常会更快。", "Complex files may take longer; relevant-excerpt mode is usually faster.")).addDropdown((dropdown) => dropdown.addOption("120", L("2 分钟", "2 min")).addOption("300", L("5 分钟（推荐）", "5 min (recommended)")).addOption("600", L("10 分钟", "10 min")).setValue(String(this.plugin.settings.codexTimeoutSeconds)).onChange(async (value) => {
        this.plugin.settings.codexTimeoutSeconds = Number(value);
        await this.plugin.saveSettings();
      }));
      containerEl.createEl("p", { text: L("Codex CLI 需要先在本机登录。问答以只读临时会话运行。", "Codex CLI must be signed in on this machine. Q&A runs in a read-only temporary session.") });
      this.addDiagnostics(containerEl);
      return;
    }
    if (this.plugin.settings.backend === "deepseek" || this.plugin.settings.backend === "openai") {
      const isDeepSeek = this.plugin.settings.backend === "deepseek";
      const modelKey = isDeepSeek ? "deepseekModel" : "openaiModel";
      const secretKey = isDeepSeek ? "deepseekSecretName" : "openaiSecretName";
      containerEl.createEl("p", {
        text: isDeepSeek ? L("使用 DeepSeek 官方 Chat Completions 接口。需要单独的 DeepSeek API 密钥。", "Uses the official DeepSeek Chat Completions API. Requires a separate DeepSeek API key.") : L("使用 OpenAI 官方 Chat Completions 接口。需要单独的 OpenAI API 密钥。", "Uses the official OpenAI Chat Completions API. Requires a separate OpenAI API key.")
      });
      new Setting(containerEl).setName(L("模型名称", "Model name")).setDesc(L("按服务商当前支持的模型 ID 填写；预填值可以修改。", "Enter a model ID supported by your provider; the preset can be changed.")).addText((input) => input.setValue(this.plugin.settings[modelKey]).onChange(async (value) => {
        this.plugin.settings[modelKey] = value;
        await this.plugin.saveSettings();
      }));
      if (isDeepSeek) {
        new Setting(containerEl).setName(L("DeepSeek 深度思考", "DeepSeek deep thinking")).setDesc(L("默认关闭以加快当前文件问答；复杂推理题可以开启。", "Off by default for faster Q&A; enable for harder reasoning.")).addToggle((toggle) => toggle.setValue(this.plugin.settings.deepseekThinking).onChange(async (value) => {
          this.plugin.settings.deepseekThinking = value;
          await this.plugin.saveSettings();
        }));
      }
      new Setting(containerEl).setName(L("API 密钥", "API key")).setDesc(L("从 Obsidian SecretStorage 选择或新建密钥；不要把密钥写进笔记。", "Pick or create a secret via Obsidian SecretStorage; never store keys in notes.")).addComponent((el) => new SecretComponent(this.app, el).setValue(this.plugin.settings[secretKey]).onChange(async (value) => {
        this.plugin.settings[secretKey] = value;
        await this.plugin.saveSettings();
      }));
      this.addDiagnostics(containerEl);
      return;
    }
    new Setting(containerEl).setName(L("Chat Completions 地址", "Chat Completions URL")).setDesc(L("例如 https://api.openai.com/v1/chat/completions；本机 localhost 可使用 HTTP。", "e.g. https://api.openai.com/v1/chat/completions; local HTTP hosts are allowed.")).addText((text) => text.setValue(this.plugin.settings.apiUrl).onChange(async (value) => {
      this.plugin.settings.apiUrl = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L("模型名称", "Model name")).setDesc(L("填写你的服务支持的模型 ID。", "Enter a model ID supported by your service.")).addText((text) => text.setValue(this.plugin.settings.apiModel).onChange(async (value) => {
      this.plugin.settings.apiModel = value;
      await this.plugin.saveSettings();
    }));
    new Setting(containerEl).setName(L("API 密钥", "API key")).setDesc(L("从 Obsidian SecretStorage 选择或新建密钥；本地无鉴权服务可留空。", "Pick or create a secret via Obsidian SecretStorage; leave empty for local services without auth.")).addComponent((el) => new SecretComponent(this.app, el).setValue(this.plugin.settings.apiSecretName).onChange(async (value) => {
      this.plugin.settings.apiSecretName = value;
      await this.plugin.saveSettings();
    }));
    this.addDiagnostics(containerEl);
  }
  setBusy(busy) {
    if (this.formEl) this.formEl.disabled = Boolean(busy || this.diagnosticBusy);
  }
  hide() { this.diagnosticController?.abort(); }
  addDiagnostics(containerEl) {
    let resultEl;
    const buttons = [];
    let busy = false;
    const run = async (kind) => {
      if (busy) return;
      busy = true;
      const controller = new AbortController(); this.diagnosticController = controller;
      this.diagnosticBusy = true; this.setBusy(this.plugin.widget?.busy);
      for (const button of buttons) button.setDisabled(true);
      resultEl.classList.remove("is-error");
      resultEl.setText(kind === 'connection' ? L('正在检测连接…', 'Checking connection…') : kind === 'image' ? L('正在检测图片输入…', 'Checking image input…') : L('正在检测文字请求…', 'Checking text requests…'));
      try {
        const result = kind === 'connection' ? await this.plugin.checkConnection(controller.signal) : await this.plugin.checkModel(kind, controller.signal);
        if (this.plugin.disposed || !resultEl.isConnected) return;
        resultEl.setText(result);
      } catch (error) {
        if (this.plugin.disposed || !resultEl.isConnected) return;
        resultEl.classList.add("is-error");
        resultEl.setText(`${L("检测失败", "Check failed")}: ${error?.message || String(error)}`);
      } finally {
        busy = false;
        if (this.diagnosticController === controller) { this.diagnosticController = null; this.diagnosticBusy = false; this.setBusy(this.plugin.widget?.busy); }
        if (!this.plugin.disposed) for (const button of buttons) button.setDisabled(false);
      }
    };
    new Setting(containerEl).setName(L('连接与能力检测', 'Connection and capability checks')).setDesc(L('文件检测发送少量文字；屏幕检测发送内置字母图，不读取真实屏幕。可能产生少量 API 用量。', 'File check sends test text; screen check sends a built-in letter image without capturing the real screen. These checks may incur minor API usage.')).addButton((button) => {
      button.setButtonText(L("检测连接", "Check connection")).onClick(() => void run("connection"));
      buttons.push(button);
    }).addButton((button) => {
      button.setButtonText(L('检测文件问答', 'Check File Q&A')).onClick(() => void run('text'));
      buttons.push(button);
    }).addButton(button => {
      button.setButtonText(L('检测屏幕问答', 'Check Screen Q&A')).onClick(() => void run('image'));
      buttons.push(button);
    });
    resultEl = containerEl.createDiv({ cls: "current-note-chat__diagnostic-result", text: L("尚未检测连接或模型。", "No check has been run yet.") });
  }
};

module.exports = { CurrentNoteChatSettings };
