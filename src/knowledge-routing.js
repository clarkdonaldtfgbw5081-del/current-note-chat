const { TFile } = require('obsidian');

const GROUPS = [
  ['independence', 'independent', '独立性', '独立事件'],
  ['bayes', 'bayesian', '贝叶斯'], ['probability', '概率'],
  ['interpolation', '插值'], ['derivative', '导数'], ['integral', '积分'],
  ['matrix', '矩阵'], ['variance', '方差'], ['expectation', '期望'],
  ['conditional', '条件概率'], ['regression', '回归'], ['hypothesis', '假设检验']
];
function terms(text) {
  const normalized = String(text || '').slice(0, 24000).toLowerCase();
  const result = new Set((normalized.match(/[a-z0-9]{2,}|[\u4e00-\u9fff]{2,}/g) || []).flatMap(word => /^[\u4e00-\u9fff]+$/.test(word) ? Array.from({ length: Math.max(0, word.length - 1) }, (_, index) => word.slice(index, index + 2)) : [word]));
  for (const group of GROUPS) if (group.some(word => normalized.includes(word))) for (const word of group) result.add(word);
  return [...result].slice(0, 180);
}
function scopedFiles(vault, folder) {
  const root = vault.getAbstractFileByPath(folder);
  if (!root || root instanceof TFile) return [];
  const stack = [...(root.children || [])], seen = new Set(), files = [];
  while (stack.length) {
    const node = stack.pop();
    if (!node?.path?.startsWith(folder + '/') || seen.has(node.path)) continue;
    seen.add(node.path);
    if (node instanceof TFile) { if (node.extension?.toLowerCase() === 'md') files.push(node); }
    else if (Array.isArray(node.children)) stack.push(...node.children);
  }
  return files;
}
function candidatesFor(vault, folder, question, excluded = [], answer = '', metadataCache) {
  const questionTerms = terms(question), answerTerms = terms(answer);
  const score = (text, words) => words.reduce((sum, word) => sum + (text.includes(word) ? 1 : 0), 0);
  return scopedFiles(vault, folder).filter(file => !excluded.includes(file.path) && !/(?:^|\/)(?:Inbox|待整理)\.md$/i.test(file.path)).map(file => {
    const rawAliases = metadataCache?.getFileCache(file)?.frontmatter?.aliases;
    const aliases = (Array.isArray(rawAliases) ? rawAliases : typeof rawAliases === 'string' ? [rawAliases] : []).filter(alias => typeof alias === 'string').slice(0, 12).join(' ').slice(0, 1000);
    const title = file.basename || file.path.split('/').at(-1).slice(0, -3);
    const name = `${title} ${aliases}`.toLowerCase(), route = file.path.toLowerCase();
    return { path: file.path, title, score: 6 * score(name, questionTerms) + 3 * score(name, answerTerms) + score(route, questionTerms) + score(route, answerTerms) };
  }).sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, 120).map(({ path, title }) => ({ path, title }));
}
module.exports = { candidatesFor, scopedFiles, terms };
