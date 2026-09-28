const { MAX_FILE_BYTES } = require('./constants');
const { throwIfAborted } = require('./tasks');
let workerConfigured = false;
async function extractPDF(binary) {
  const { PDFParse } = require('pdf-parse');
  if (!workerConfigured) {
    // Build-generated source is embedded in main.js; no extra installation asset or network fetch.
    const source = require('./generated/pdf-worker');
    PDFParse.setWorker(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    workerConfigured = true;
  }
  const parser = new PDFParse({ data: new Uint8Array(binary), isEvalSupported: false });
  try {
    const result = await parser.getText();
    return result.pages?.length ? result.pages.map((page, index) => `[Page ${page.num || index + 1}]\n${page.text}`).join('\n\n') : result.text;
  } finally { await parser.destroy(); }
}
async function extractWord(binary) {
  assertDocxLimits(binary);
  const WordExtractor = require('word-extractor');
  const document = await new WordExtractor().extract(Buffer.from(binary));
  return [document.getBody(), document.getHeaders(), document.getFootnotes(), document.getEndnotes()].filter(Boolean).join('\n\n');
}
function assertDocxLimits(binary) {
  const data = Buffer.from(binary);
  if (data.length < 4) throw new Error('The Word document is empty or malformed.');
  if (data.readUInt32LE(0) !== 0x04034b50) return;
  let end = -1;
  for (let at = data.length - 22; at >= Math.max(0, data.length - 65557); at--) if (data.readUInt32LE(at) === 0x06054b50) { end = at; break; }
  if (end < 0) throw new Error('Malformed DOCX ZIP directory.');
  const count = data.readUInt16LE(end + 10);
  let offset = data.readUInt32LE(end + 16), total = 0;
  if (count > 1000 || count === 65535 || offset === 0xffffffff) throw new Error('DOCX archive exceeds the entry limit or uses unsupported ZIP64.');
  for (let i = 0; i < count; i++) {
    if (offset + 46 > data.length || data.readUInt32LE(offset) !== 0x02014b50) throw new Error('Malformed DOCX ZIP directory.');
    const size = data.readUInt32LE(offset + 24); total += size;
    if (size > 32 * 1024 * 1024 || total > 64 * 1024 * 1024) throw new Error('DOCX archive exceeds the decompressed size limit.');
    offset += 46 + data.readUInt16LE(offset + 28) + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
  }
}
class FileTextCache {
  constructor() { this.entries = new Map(); this.totalChars = 0; }
  invalidate(filePath) {
    const item = this.entries.get(filePath);
    if (item) this.totalChars -= item.text.length;
    this.entries.delete(filePath);
  }
  clear() { this.entries.clear(); this.totalChars = 0; }
  async read(file, readBinary, signal) {
    if (file.stat.size > MAX_FILE_BYTES) throw new Error('The file exceeds 25 MB.');
    const version = `${file.stat.mtime}:${file.stat.size}`;
    const item = this.entries.get(file.path);
    if (item?.version === version) {
      this.entries.delete(file.path); this.entries.set(file.path, item);
      return item.text;
    }
    throwIfAborted(signal);
    const binary = await readBinary(file);
    throwIfAborted(signal);
    if (binary.byteLength > MAX_FILE_BYTES) throw new Error('The file exceeds 25 MB.');
    const text = file.extension.toLowerCase() === 'pdf' ? await extractPDF(binary) : await extractWord(binary);
    throwIfAborted(signal);
    if (!text?.trim()) throw new Error('No text could be extracted. Scanned PDFs require OCR.');
    if (text.length > 2000000) throw new Error('Extracted text exceeds the size limit. Split the file and retry.');
    this.invalidate(file.path);
    this.entries.set(file.path, { version, text }); this.totalChars += text.length;
    while (this.entries.size > 6 || this.totalChars > 4000000) this.invalidate(this.entries.keys().next().value);
    return text;
  }
}
module.exports = { FileTextCache, extractPDF, extractWord, assertDocxLimits };
