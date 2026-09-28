const { getLanguage } = require('obsidian');
function interfaceLanguage() { return getLanguage(); }
function L(zh, en) { return /^zh/i.test(interfaceLanguage()) ? zh : en; }
module.exports = { L, interfaceLanguage };
