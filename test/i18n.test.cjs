const test = require('node:test');
const assert = require('node:assert/strict');
const { install, fake } = require('./helpers/obsidian.cjs');
install();
const originalLanguage = fake.getLanguage;
const originalLocale = fake.moment.locale;

test('interface labels follow app language independently of the date locale', context => {
  context.after(() => { fake.getLanguage = originalLanguage; fake.moment.locale = originalLocale; });
  fake.getLanguage = () => 'zh'; fake.moment.locale = () => 'en-gb';
  delete require.cache[require.resolve('../src/i18n')];
  let { L, interfaceLanguage } = require('../src/i18n');
  assert.equal(L('发送', 'Send'), '发送'); assert.equal(interfaceLanguage(), 'zh');
  fake.getLanguage = () => 'en'; fake.moment.locale = () => 'zh-cn';
  delete require.cache[require.resolve('../src/i18n')];
  ({ L, interfaceLanguage } = require('../src/i18n'));
  assert.equal(L('发送', 'Send'), 'Send'); assert.equal(interfaceLanguage(), 'en');
});
