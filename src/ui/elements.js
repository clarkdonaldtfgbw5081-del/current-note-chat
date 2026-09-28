const { setIcon } = require('obsidian');
function buttonContent(button, label, icon, iconOnly = false) {
  button.setText(iconOnly ? '' : label);
  button.setAttribute('aria-label', label); button.setAttribute('title', label);
  if (icon) {
    const glyph = button.createSpan({ cls: 'current-note-chat__icon', prepend: true, attr: { 'aria-hidden': 'true' } });
    setIcon(glyph, icon);
  }
}
function iconButton(parent, label, icon) {
  const button = parent.createEl('button', { cls: 'current-note-chat__icon-button', attr: { type: 'button' } });
  buttonContent(button, label, icon, true);
  return button;
}
module.exports = { buttonContent, iconButton };
