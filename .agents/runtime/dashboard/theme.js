'use strict';

const darkPalette = `
    color-scheme: dark;
    --bg: #0b1018; --surface: #121a26; --surface-hover: #1b283a; --border: #64748b; --border-muted: #253247;
    --text-main: #e2eaf5; --text-muted: #a0aec0;
    --accent: #7dd3fc; --success: #86efac; --warning: #fcd34d; --danger: #fda4af;
    --primary-bg: #1f4268; --primary-hover: #285480; --primary-text: #ffffff;
`;
const lightPalette = `
    color-scheme: light;
    --bg: #f5f7fb; --surface: #ffffff; --surface-hover: #e8eef6; --border: #718096; --border-muted: #d5dce6;
    --text-main: #172033; --text-muted: #475569;
    --accent: #075985; --success: #166534; --warning: #854d0e; --danger: #9f1239;
    --primary-bg: #075985; --primary-hover: #0c4a6e; --primary-text: #ffffff;
`;
const themeStyles = `
  :root {${darkPalette}}
  :root[data-theme=light] {${lightPalette}}
  @media (prefers-color-scheme: dark) {
    :root[data-theme-preference=system] {${darkPalette}}
  }
  @media (prefers-color-scheme: light) {
    :root[data-theme-preference=system] {${lightPalette}}
  }
  .theme-control { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted); }
  .theme-control select { min-height: 44px; max-width: 120px; padding: 6px; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); color: var(--text-main); font: inherit; }
  .theme-feedback { font-size: 11px; color: var(--warning); }
`;

const themeControl = `<label class="theme-control">Theme
  <select id="theme-select" onchange="window.dashboardTheme.setPreference(this.value)">
    <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
  </select></label><span class="theme-feedback" id="theme-feedback" role="status"></span>`;

function themeScript() {
  return `(() => {
    const key = 'fluttercrew-theme';
    const valid = value => ['system', 'light', 'dark'].includes(value);
    const media = matchMedia('(prefers-color-scheme: dark)');
    let preference = 'system';
    let storageFailed = false;
    function warn(error) {
      if (!storageFailed) console.warn('Theme preference could not be saved or restored.', error);
      storageFailed = true;
    }
    try {
      const saved = localStorage.getItem(key);
      if (valid(saved)) preference = saved;
    } catch (error) { warn(error); }
    if (window.parent !== window) {
      try {
        const inherited = window.parent.dashboardTheme?.preference;
        if (valid(inherited)) preference = inherited;
      } catch (error) { console.warn('Parent theme unavailable; using local preference.', error); }
    }
    function syncFrames() {
      document.querySelectorAll('iframe').forEach(frame => {
        frame.contentWindow?.postMessage({ type: 'fluttercrew-theme', preference }, '*');
      });
    }
    function apply() {
      document.documentElement.dataset.themePreference = preference;
      document.documentElement.dataset.theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
      const select = document.getElementById('theme-select');
      if (select) select.value = preference;
      const feedback = document.getElementById('theme-feedback');
      if (feedback) feedback.textContent = storageFailed ? 'Theme applies now; browser storage is unavailable.' : '';
      syncFrames();
    }
    function setPreference(value, notifyParent = true) {
      if (!valid(value)) { console.warn('Invalid theme preference:', value); return; }
      preference = value;
      try { localStorage.setItem(key, value); } catch (error) { warn(error); }
      apply();
      if (notifyParent && window.parent !== window) {
        window.parent.postMessage({ type: 'fluttercrew-theme', preference }, '*');
      }
    }
    window.dashboardTheme = { get preference() { return preference; }, setPreference, syncFrames };
    window.addEventListener('message', event => {
      const trusted = (window.parent !== window && event.source === window.parent) ||
        [...document.querySelectorAll('iframe')].some(frame => frame.contentWindow === event.source);
      if (trusted && event.data?.type === 'fluttercrew-theme' && valid(event.data.preference) && event.data.preference !== preference) {
        setPreference(event.data.preference, false);
      }
    });
    window.addEventListener('storage', event => {
      if (event.key === key && (event.newValue === null || valid(event.newValue))) {
        preference = event.newValue || 'system';
        apply();
      }
    });
    media.addEventListener('change', () => { if (preference === 'system') apply(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('iframe').forEach(frame => frame.addEventListener('load', syncFrames));
      apply();
    }, { once: true });
    apply();
  })();`;
}

module.exports = { themeStyles, themeScript, themeControl };
