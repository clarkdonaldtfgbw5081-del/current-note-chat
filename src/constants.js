const VIEW_TYPE = "current-note-chat-view";
const SCREEN_CHAT_KEY = "__current_screen__";
const MAX_CONTEXT_CHARS = 6e3;
const MAX_QUESTION_CHARS = 8e3;
const MAX_EDIT_CHARS = 12e3;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SESSION_MESSAGES = 80;
const MAX_SESSION_KEYS = 40;
const TEXT_EXTENSIONS = /* @__PURE__ */ new Set(["md", "txt", "csv", "json", "html", "htm", "xml", "yaml", "yml"]);
const SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([...TEXT_EXTENSIONS, "pdf", "doc", "docx"]);
const DEFAULT_SETTINGS = {
  contextMode: "screen",
  learningMode: false,
  backend: "codex",
  codexPath: "",
  codexTimeoutSeconds: 300,
  deepseekModel: "deepseek-flash",
  deepseekSecretName: "",
  deepseekThinking: false,
  openaiModel: "gpt-4.1-mini",
  openaiSecretName: "",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiModel: "",
  apiSecretName: "",
  saveQA: true,
  noteSaveMode: 'conversation',
  qaFolder: "",
  autoClassify: true,
  knowledgeFolder: "",
  showLauncher: true,
  screenshotMaxEdge: 2048,
  screenFollowCursor: false,
  previewScreenshot: true,
  apiTimeoutSeconds: 120,
  streamingEnabled: true,
  codexIgnoreUserConfig: true
};

module.exports = { VIEW_TYPE, SCREEN_CHAT_KEY, MAX_CONTEXT_CHARS, MAX_QUESTION_CHARS, MAX_EDIT_CHARS, MAX_FILE_BYTES, MAX_SESSION_MESSAGES, MAX_SESSION_KEYS, TEXT_EXTENSIONS, SUPPORTED_EXTENSIONS, DEFAULT_SETTINGS };
