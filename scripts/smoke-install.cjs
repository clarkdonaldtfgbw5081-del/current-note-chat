const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { pdf } = require('../test/helpers/documents.cjs');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'current-note-chat-install-'));
const assets = ['main.js', 'manifest.json', 'styles.css'];
try {
  for (const file of assets) fs.copyFileSync(file, path.join(directory, file));
  const script = `
const Module = require('node:module');
const assert = require('node:assert/strict');
const original = Module._load;
class Stub {}
class Plugin extends Stub { loadData(){return Promise.resolve({})} registerView(){} addSettingTab(){} addRibbonIcon(){} addCommand(){} registerEvent(){} }
class TFile { constructor(){this.path='test.pdf';this.extension='pdf';this.stat={size:1000,mtime:1}} }
const fake = {Plugin, ItemView:Stub, MarkdownView:Stub, Modal:Stub, Notice:Stub, PluginSettingTab:Stub, SecretComponent:Stub, Setting:Stub, Component:Stub, TFile, getLanguage:()=> 'en', setIcon:()=> {}, moment:{locale:()=> 'en'}};
Module._load = function(name, ...args) {
 if(name==='obsidian')return fake;
 if(!Module.isBuiltin(name) && !name.startsWith('.') && !require('node:path').isAbsolute(name)) throw new Error('External runtime dependency requested: '+name);
 return original.call(this,name,...args);
};
// Electron renderers provide these Web APIs without a native canvas dependency.
global.DOMMatrix=class {constructor(){this.a=1;this.b=0;this.c=0;this.d=1;this.e=0;this.f=0}};
global.ImageData=class{}; global.Path2D=class{};
const CurrentNoteChat = require('./main.js');
const file = new TFile(); const plugin = new CurrentNoteChat(); plugin.manifest={dir:'plugins/current-note-chat'};
plugin.app={vault:{adapter:{exists:async()=>false,read:async()=>{throw new Error('Unexpected sidecar read')}},on:()=>null,readBinary:async()=>Buffer.from('${pdf('Isolated install PDF').toString('base64')}','base64')},workspace:{on:()=>null,onLayoutReady:()=>{}}};
(async()=>{await plugin.onload();const text=await plugin.readCurrentFile(file);assert(text.includes('Isolated install PDF'));assert(text.includes('[Page 1]'));console.log('Three-asset installation parsed PDF without a worker sidecar or installed npm dependencies.');})().catch(error=>{console.error(error);process.exitCode=1});
`;
  fs.writeFileSync(path.join(directory, 'smoke.cjs'), script);
  process.stdout.write(execFileSync(process.execPath, ['smoke.cjs'], { cwd: directory, encoding: 'utf8', timeout: 20000 }));
} finally {
  for (const file of [...assets, 'smoke.cjs']) { const target = path.join(directory, file); if (fs.existsSync(target)) fs.unlinkSync(target); }
  fs.rmdirSync(directory);
}
