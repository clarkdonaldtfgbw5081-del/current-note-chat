const test = require('node:test');
const assert = require('node:assert/strict');
const { extractPDF, extractWord, FileTextCache, assertDocxLimits } = require('../src/files');
const { createZip } = require('../scripts/zip.cjs');
const { pdf } = require('./helpers/documents.cjs');
test('real PDF text extraction works with the embedded worker and page labels', async () => {
  const text = await extractPDF(pdf('Hello embedded worker'));
  assert(text.includes('Hello embedded worker')); assert(text.includes('[Page 1]'));
});
test('real DOCX extraction works on a ZIP document', async () => {
  const document = createZip([{ name: '[Content_Types].xml', data: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' }, { name: 'word/document.xml', data: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello Word</w:t></w:r></w:p></w:body></w:document>' }]);
  assert((await extractWord(document)).includes('Hello Word'));
});
test('cache reuses unchanged files and invalidates modified or cancelled reads', async () => {
  const cache = new FileTextCache(); const file = { path: 'test.pdf', extension: 'pdf', stat: { size: 1000, mtime: 1 } }; let reads = 0;
  const read = async () => { reads++; return pdf('Version ' + file.stat.mtime); };
  await cache.read(file, read); await cache.read(file, read); assert.equal(reads, 1);
  file.stat.mtime = 2; assert((await cache.read(file, read)).includes('Version 2')); assert.equal(reads, 2);
  const controller = new AbortController(); controller.abort();
  cache.clear(); await assert.rejects(cache.read(file, read, controller.signal)); assert.equal(cache.entries.size, 0);
});
test('malformed and oversized documents fail without populating the cache', async () => {
  const cache = new FileTextCache(); const file = { path: 'bad.pdf', extension: 'pdf', stat: { size: 100, mtime: 1 } };
  await assert.rejects(cache.read(file, async () => Buffer.from('not a PDF')));
  file.stat.size = 26 * 1024 * 1024; await assert.rejects(cache.read(file, async () => { throw new Error('Must not read'); }), /25 MB/);
  assert.equal(cache.entries.size, 0);
});
test('DOCX declared decompression bombs are rejected before extracting content', () => {
  const zip = createZip([{ name: 'word/document.xml', data: '<xml />' }]);
  const central = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  zip.writeUInt32LE(100 * 1024 * 1024, central + 24);
  assert.throws(() => assertDocxLimits(zip), /decompressed size limit/);
});
