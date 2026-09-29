function safeFolder(raw, normalizePath, fallback) {
  const value = String(raw || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') || fallback;
  if (value.split('/').some(part => ['.', '..'].includes(part)) || value.includes(':') || [...value].some(char => char.charCodeAt(0) < 32)) throw new Error('Choose a folder path inside this vault.');
  return normalizePath(value);
}
function keyAfterRename(key, oldPath, newPath) {
  const prefix = key.startsWith('__feynman__:') ? '__feynman__:' : '';
  const source = key.slice(prefix.length);
  return source === oldPath || source.startsWith(oldPath + '/') ? prefix + newPath + source.slice(oldPath.length) : key;
}
module.exports = { safeFolder, keyAfterRename };
