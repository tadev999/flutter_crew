'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { themeScript, themeStyles } = require('../.agents/runtime/dashboard/theme');
const { generateDashboardHtml } = require('../.agents/runtime/dashboard');

function boot({ saved = null, dark = false, storageError = false, inherited } = {}) {
  const events = {};
  const warnings = [];
  const select = {};
  const feedback = {};
  const messages = [];
  let stored = saved;
  let loaded;
  let mediaChange;
  const child = { postMessage: message => messages.push(message) };
  const frame = { contentWindow: child, addEventListener() {} };
  const media = { matches: dark, addEventListener(_event, callback) { mediaChange = callback; } };
  const document = {
    documentElement: { dataset: {} },
    getElementById: id => id === 'theme-select' ? select : feedback,
    querySelectorAll: () => [frame],
    addEventListener(event, callback) { if (event === 'DOMContentLoaded') loaded = callback; }
  };
  const window = { addEventListener(name, callback) { events[name] = callback; } };
  window.parent = inherited ? { dashboardTheme: { preference: inherited }, postMessage: message => messages.push(message) } : window;
  vm.runInNewContext(themeScript(), {
    window, document, matchMedia: () => media,
    console: { warn: (...args) => warnings.push(args) },
    localStorage: {
      getItem() { if (storageError) throw new Error('Denied'); return stored; },
      setItem(_key, value) { if (storageError) throw new Error('Denied'); stored = value; }
    }
  });
  return { api: window.dashboardTheme, document, select, feedback, events, warnings, messages,
    child, parent: window.parent, stored: () => stored, loaded,
    systemChange(value) { media.matches = value; mediaChange(); } };
}

test('system default follows OS changes; explicit preference overrides them', () => {
  const page = boot();
  assert.equal(page.api.preference, 'system');
  assert.equal(page.document.documentElement.dataset.themePreference, 'system');
  assert.equal(page.document.documentElement.dataset.theme, 'light');
  page.systemChange(true);
  assert.equal(page.document.documentElement.dataset.theme, 'dark');
  page.api.setPreference('light');
  page.systemChange(true);
  assert.equal(page.document.documentElement.dataset.theme, 'light');
  assert.equal(page.stored(), 'light');
  assert.equal(boot({ saved: page.stored(), dark: true }).select.value, 'light');
});

test('theme applies in the head before body rendering', () => {
  const html = generateDashboardHtml({});
  assert.ok(html.indexOf("const key = 'fluttercrew-theme'") < html.indexOf('<body'));
  assert.ok(html.indexOf("const key = 'fluttercrew-theme'") < html.indexOf('<style>'));
  assert.match(html, /id="theme-select"/);
  assert.match(html, /:root\[data-theme-preference=system\]/);
});

test('invalid stored preferences use system; invalid actions warn without writing', () => {
  const page = boot({ saved: '<script>', dark: true });
  assert.equal(page.api.preference, 'system');
  page.api.setPreference('invalid');
  assert.equal(page.api.preference, 'system');
  assert.equal(page.warnings.length, 1);
});

test('unavailable storage keeps controls working and surfaces persistence failure', () => {
  const page = boot({ storageError: true });
  page.api.setPreference('dark');
  page.loaded();
  assert.equal(page.document.documentElement.dataset.theme, 'dark');
  assert.equal(page.select.value, 'dark');
  assert.match(page.feedback.textContent, /storage is unavailable/);
  assert.equal(page.warnings.length, 1);
});

test('replay frames inherit parent preference and synchronize in both directions', () => {
  const page = boot({ inherited: 'dark', saved: 'light' });
  assert.equal(page.api.preference, 'dark');
  page.api.setPreference('light');
  assert.equal(page.messages.at(-1).preference, 'light');
  page.events.message({ source: page.parent, data: { type: 'fluttercrew-theme', preference: 'system' } });
  assert.equal(page.api.preference, 'system');
  page.events.message({ source: {}, data: { type: 'fluttercrew-theme', preference: 'dark' } });
  assert.equal(page.api.preference, 'system');
  page.events.message({ source: page.child, data: { type: 'fluttercrew-theme', preference: 'dark' } });
  assert.equal(page.api.preference, 'dark');
});

test('storage changes synchronize tabs and removing preference restores system', () => {
  const page = boot({ saved: 'light', dark: true });
  page.events.storage({ key: 'fluttercrew-theme', newValue: 'dark' });
  assert.equal(page.api.preference, 'dark');
  page.events.storage({ key: 'other', newValue: 'light' });
  assert.equal(page.api.preference, 'dark');
  page.events.storage({ key: 'fluttercrew-theme', newValue: null });
  assert.equal(page.api.preference, 'system');
});

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => {
    const channel = parseInt(value, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);

test('both palettes meet 4.5:1 text contrast, 3:1 control borders and primary-button contrast', () => {
  for (const block of themeStyles.matchAll(/:root(?:\[data-theme=light\])? \{([^}]+)\}/g)) {
    const tokens = Object.fromEntries([...block[1].matchAll(/--([\w-]+): (#[a-f\d]{6})/gi)].map(match => [match[1], match[2]]));
    for (const background of ['bg', 'surface', 'surface-hover']) {
      for (const text of ['text-main', 'text-muted', 'accent', 'success', 'warning', 'danger']) {
        assert.ok(contrast(tokens[text], tokens[background]) >= 4.5, `${text} on ${background}: ${contrast(tokens[text], tokens[background])}`);
      }
      assert.ok(contrast(tokens.border, tokens[background]) >= 3, `border on ${background}`);
    }
    for (const background of ['primary-bg', 'primary-hover']) {
      assert.ok(contrast(tokens['primary-text'], tokens[background]) >= 4.5);
    }
    assert.ok(contrast(tokens['heading-mark-text'], tokens['heading-mark-bg']) >= 4.5,
      'Section heading marker must preserve readable text contrast');
  }
});
