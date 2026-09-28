class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.classes = new Set(); this.attributes = {}; this.listeners = {};
    this.scrollTop = 0; this.scrollHeight = 0; this.clientHeight = 100; this.value = ''; this.isConnected = true;
  }
  createEl(tag, options = {}) {
    const child = new Element(tag); child.parent = this; child.text = options.text || '';
    for (const name of (options.cls || '').split(' ').filter(Boolean)) child.classes.add(name);
    for (const [key, value] of Object.entries(options.attr || {})) child.setAttribute(key, value);
    if (options.prepend) this.children.unshift(child); else this.children.push(child); return child;
  }
  createDiv(options) { return this.createEl('div', options); }
  createSpan(options) { return this.createEl('span', options); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  addEventListener(key, callback) { this.listeners[key] = callback; }
  setText(text) { this.text = text; this.children = []; }
  empty() { this.children = []; }
  addClass(name) { this.classes.add(name); }
  removeClass(name) { this.classes.delete(name); }
  toggleClass(name, on) { if (on) this.addClass(name); else this.removeClass(name); }
  focus() { this.focused = true; }
  remove() { this.isConnected = false; }
}
module.exports = { Element };
