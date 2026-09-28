function safeFolder(raw, normalizePath, fallback) {
  const value = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || fallback;
  if (value.split('/').some(part => ['.', '..'].includes(part)) || value.includes(':') || [...value].some(char => char.charCodeAt(0) < 32)) throw new Error('Choose a folder path inside this vault.');
  return normalizePath(value);
}
module.exports = { safeFolder };
