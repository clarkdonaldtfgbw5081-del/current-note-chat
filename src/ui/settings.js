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
        await this.plugin.saveSettings(); this.plugin.refreshViews();
      }));
    new Setting(containerEl).setName(L("对话笔记保存位置", "Conversation notes folder")).setDesc(L("仓库内的文件夹路径；留空时默认为「AI 问答」（英文界面为 AI Q&A），文件夹不存在会自动创建。修改后新的对话使用新位置，已有对话继续更新原笔记。", "A folder path in the vault; empty defaults to AI Q&A. Missing folders are created. Folder changes apply to new conversations; existing ones keep updating their original note.")).addText((text) => text.setPlaceholder(L("AI 问答", "AI Q&A")).setValue(this.plugin.settings.qaFolder ?? "").onChange(async (value) => {
      this.plugin.settings.qaFolder = value.trim();
      await this.plugin.saveSettings();
    }));
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
