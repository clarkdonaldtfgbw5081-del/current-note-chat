const Module = require('node:module');
class TFile {
  constructor(path = 'note.md') { this.path = path; this.extension = path.split('.').at(-1); this.stat = { size: 10, mtime: 1 }; }
}
class MarkdownView {
  getMode() { return 'source'; }
}
class Component { load() {} unload() {} }
class Plugin {}
class Modal {
  constructor(app) { this.app = app; if (global.document) { this.contentEl = document.body.createDiv(); this.modalEl = this.contentEl; } }
  open() { this.onOpen?.(); }
  close() { this.onClose?.(); }
}
const notices = [];
class Notice { constructor(message) { notices.push(message); } }
const fake = { Plugin, ItemView: class {}, MarkdownView, Component, Modal, Notice, PluginSettingTab: class {}, SecretComponent: class {}, Setting: class {}, TFile,
  normalizePath: path => path.replace(/\\/g, '/').replace(/\/+/g, '/'), getLanguage: () => 'en', setIcon: () => {}, moment: { locale: () => 'en' }, MarkdownRenderer: { render: async () => {} } };
function install() {
  const original = Module._load;
  Module._load = function(name, ...rest) { return name === 'obsidian' ? fake : original.call(this, name, ...rest); };
  return () => { Module._load = original; };
}
module.exports = { install, fake, notices, TFile, MarkdownView };
