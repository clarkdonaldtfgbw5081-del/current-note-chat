const { L } = require('./i18n');
const { requestUrl } = require('obsidian');
const { throwIfAborted, withAbort } = require('./tasks');
function extractApiAnswer(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => part?.text || "").join("\n").trim();
    if (text) return text;
  }
  throw new Error(L("AI 服务没有返回可显示的回答。", "The AI service returned no displayable answer."));
}
function validateApiUrl(raw) {
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error(L("请在插件设置中填写有效的 API 地址。", "Enter a valid API URL in the plugin settings."));
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password) throw new Error(L('API 地址不能包含用户名或密码，请使用 SecretStorage。', 'Do not embed credentials in the API URL; use SecretStorage.'));
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new Error(L("API 地址必须使用 HTTPS；本机 localhost 可使用 HTTP。", "The API URL must use HTTPS; plain HTTP is allowed for localhost only."));
  }
  return url.toString();
}
function modelListUrl(chatUrl) {
  const url = new URL(validateApiUrl(chatUrl));
  if (!url.pathname.endsWith("/chat/completions")) {
    throw new Error(L("模型检测需要以 /chat/completions 结尾的 API 地址。", "The model check needs an API URL ending with /chat/completions."));
  }
  url.pathname = url.pathname.slice(0, -"/chat/completions".length) + "/models";
  url.search = "";
  return url.toString();
}
function apiError(response) {
  let detail = "";
  try {
    detail = JSON.parse(response.text)?.error?.message || "";
  } catch {
  }
  return `HTTP ${response.status}${detail ? `\uFF1A${String(detail).slice(0, 240)}` : ""}`;
}
function networkError(error) {
  const message = String(error?.message || error);
  if (/ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED/.test(message)) {
    return new Error(L("无法连接系统代理。请启动代理软件或检查系统代理设置后重试。", "Cannot connect through the system proxy. Start your proxy app or fix the system proxy settings, then retry."));
  }
  if (/ERR_NAME_NOT_RESOLVED/.test(message)) return new Error(L("无法解析 API 域名，请检查网络和接口地址。", "Cannot resolve the API domain; check your network and the API URL."));
  if (/ERR_TIMED_OUT|ETIMEDOUT/.test(message)) return new Error(L("连接 API 超时，请检查网络或稍后重试。", "The API request timed out; check your network or retry later."));
  return error instanceof Error ? error : new Error(message);
}
async function apiRequest(options, signal) {
  try {
    throwIfAborted(signal);
    return await withAbort(requestUrl(options), signal);
  } catch (error) {
    throw networkError(error);
  }
}
function diagnosticImage() {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(L("无法生成测试图片。", "Could not generate the test image."));
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 96, 96);
  context.fillStyle = "#111111";
  context.font = "bold 64px sans-serif";
  context.fillText("A", 21, 72);
  return canvas.toDataURL("image/png");
}

module.exports = { extractApiAnswer, validateApiUrl, modelListUrl, apiError, networkError, apiRequest, diagnosticImage };
