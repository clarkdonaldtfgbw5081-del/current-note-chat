const { MAX_CONTEXT_CHARS } = require('./constants');
function questionTerms(question) {
  const cleaned = question.toLowerCase().replace(/(是什么|什么意思|有什么区别|怎么理解|如何理解|请解释|解释一下|请问|什么是|请|一下|吗|呢|？|\?)/g, ' ').replace(/[，。,:：；;（）()\s]+/g, ' ');
  const words = cleaned.split(/(?:\s+|与|和|及|的)/).filter(word => word.length >= 2);
  const terms = new Set(words);
  for (const word of words) {
    if (/[\u3400-\u9fff]/.test(word) && word.length > 4) {
      for (let i = 0; i + 3 <= word.length; i++) terms.add(word.slice(i, i + 3));
    }
  }
  return [...terms].sort((a, b) => b.length - a.length).slice(0, 100);
}
function splitContext(text) {
  const markers = [...text.matchAll(/\[Page \d+\]/g)];
  const pages = markers.length ? markers.map((marker, index) => ({ label: marker[0], offset: marker.index, body: text.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? text.length) })) : [{ label: '', offset: 0, body: text }];
  if (markers.length && markers[0].index > 0) pages.unshift({ label: '', offset: 0, body: text.slice(0, markers[0].index) });
  const chunks = [];
  for (const page of pages) {
    for (let start = 0; start < page.body.length; start += 1200) {
      const body = page.body.slice(start, start + 1500);
      chunks.push({ index: chunks.length, offset: page.offset + start, text: `${page.label ? `${page.label}\n` : ''}${body}` });
    }
  }
  return chunks;
}
function selectRelevantContext(text, question, limit = MAX_CONTEXT_CHARS) {
  if (text.length <= limit) return { text, partial: false };
  const terms = questionTerms(question);
  const chunks = splitContext(text);
  const ranked = chunks.map(chunk => {
    const lower = chunk.text.toLowerCase();
    return { ...chunk, score: terms.reduce((sum, term) => sum + (lower.includes(term) ? term.length : 0), 0) };
  }).sort((a, b) => b.score - a.score || a.index - b.index);
  const candidates = ranked[0]?.score ? ranked : chunks.length > 3 ? [chunks[0], chunks[Math.floor(chunks.length / 2)], chunks.at(-1), ...chunks] : chunks;
  const chosen = [];
  const seen = new Set();
  let size = 0;
  for (const chunk of candidates) {
    if (seen.has(chunk.index) || size + chunk.text.length + 2 > limit) continue;
    seen.add(chunk.index);
    chosen.push(chunk);
    size += chunk.text.length + 2;
  }
  chosen.sort((a, b) => a.offset - b.offset);
  return { text: chosen.map(chunk => chunk.text).join('\n\n'), partial: true };
}
module.exports = { questionTerms, selectRelevantContext, splitContext };
