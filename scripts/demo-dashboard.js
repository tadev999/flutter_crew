#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { generateDashboardHtml } = require('../.agents/runtime/dashboard');
const { CRITERIA, GATES } = require('../.agents/runtime/constants');

const root = path.resolve(__dirname, '..');
const chrome = process.env.CHROME_BIN || ({
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'chrome'
}[process.platform]);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'fluttercrew-dashboard-demo-'));
const at = '2026-01-01T09:00:00.000Z';
const descriptions = [
  'Sign in with Firebase Auth',
  'Save owner-only task records',
  'Accessible task list and retry states'
];
const scenes = [
  { title: '01 / Developer approval', completed: 0, phase: 'approval', duration: 2600 },
  { title: '02 / Implementation in progress', completed: 1, phase: 'implementation', duration: 2600 },
  { title: '03 / Testing and requirement traces', completed: 4, phase: 'testing', duration: 2600 },
  { title: '04 / Local gates and review evidence', completed: 6, phase: 'verify', duration: 2600 },
  { title: '05 / All evidence current', completed: 6, phase: 'done', duration: 3200 },
  { title: '06 / Source edit invalidates evidence', completed: 6, phase: 'stale', duration: 3400 },
  { title: '07 / Revalidated / light theme', completed: 6, phase: 'done', light: true, duration: 3200 }
];

function reportFor(scene) {
  const stale = scene.phase === 'stale';
  const done = scene.phase === 'done';
  const approved = scene.phase !== 'approval';
  const verified = done || stale;
  const requirements = descriptions.map((description, index) => ({
    id: `REQ-00${index + 1}`, description,
    status: stale ? 'stale' : (scene.completed >= (index + 1) * 2 ? 'passed' : 'pending'),
    recordedStatus: stale ? 'passed' : undefined,
    source: 'Demo brief', verification: 'automated', feature: 'demo',
    acceptanceCriteria: ['Given a signed-in user When the action succeeds, fails or is unauthorized Then the matching state is shown.'],
    references: [], notes: 'Illustrative data only; no commands or backend tests were executed.'
  }));
  const tasks = requirements.flatMap(({ id }, index) =>
    ['implementation', 'testing'].map((phase, offset) => {
      const slot = index * 2 + offset;
      return {
        id, phase, at,
        status: stale ? 'stale' : (slot < scene.completed ? 'done' :
          approved && slot === scene.completed ? 'in_progress' : 'pending'),
        recordedStatus: stale ? 'done' : undefined,
        notes: stale ? 'Earlier completion preserved; changed inputs need review.' : 'Simulated task record.'
      };
    }));
  const command = (args) => `node .agents/runtime/crew.js ${args}`;
  const action = (kind, issue, cause, args, extra = {}) =>
    ({ kind, issue, cause, commands: [command(args)], ...extra });
  let actions;
  if (!approved) {
    actions = [action('approval', 'Developer approval required',
      'Review the baselined requirements before application source edits.', 'approve "Reviewed scope"')];
  } else if (stale) {
    actions = [action('verify', 'Source changed', 'Re-run checks and review stale traces and attestations.', 'verify')];
  } else if (done) {
    actions = [];
  } else if (scene.completed === 6) {
    actions = [action('verify', 'Run local quality gates',
      'Tasks are complete. Format, analyzer, tests and reviewed evidence still apply.', 'verify')];
  } else {
    const current = tasks[scene.completed];
    actions = [
      action('task', `${current.id} ${current.phase}: in_progress`, 'Complete the recorded work; no live execution is inferred.',
        `task ${current.id} ${current.phase} done "Reviewed work"`,
        { requirementId: current.id, phase: current.phase, state: 'in_progress' }),
      action('trace', `${current.id}: pending`, 'Record implementation, tests and actual evidence before completion.',
        `trace ${current.id} <trace.json>`, { requirementId: current.id })
    ];
  }
  return {
    status: done ? 'done' : stale ? 'blocked' : 'in_progress',
    backend: 'firebase', requirements: 'task-manager-demo.md', startedAt: at,
    spec: { revision: 1, at, ids: requirements.map(({ id }) => id) },
    specIssues: [], preflight: [],
    approved: approved ? { at } : undefined,
    approvalStatus: { valid: approved, status: approved ? 'valid' : 'missing',
      issues: approved ? [] : ['Developer approval is missing.'] },
    requirementStatus: requirements, taskStatus: tasks,
    traceability: Object.fromEntries(requirements.filter(r => ['passed', 'stale'].includes(r.status))
      .map(r => [r.id, { status: 'passed', at }])),
    verification: verified ? {
      passed: true, at, checks: GATES.map(({ name }) =>
        ({ name, passed: true, simulated: true, log: `demo/${name}.txt` }))
    } : null,
    verificationStatus: {
      valid: done, status: stale ? 'stale' : done ? 'valid' : 'missing',
      checks: GATES.map(({ name }) => ({ name, status: stale ? 'stale' : done ? 'passed' : 'pending' })),
      issues: stale ? ['Source changed since the illustrated verification.'] : []
    },
    acceptance: verified ? Object.fromEntries(CRITERIA.map(id => [id, { at, evidence: 'demo-review.md' }])) : {},
    missingOrStaleCriteria: done ? [] : CRITERIA,
    sourceChangedSinceVerification: stale, nextActions: actions,
    resume: { retained: { spec: true, approval: approved, verification: done,
      requirements: done ? requirements.map(r => r.id) : [], criteria: done ? CRITERIA : [] } }
  };
}

function execute(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 120000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${executable} failed:\n${result.stderr || result.stdout}`);
}

try {
  const frames = scenes.map((scene, index) => {
    let html = generateDashboardHtml(reportFor(scene));
    const style = `<style>
      .demo-banner { padding:14px 24px; background:#173b35; color:#d8f26a; display:flex;
        justify-content:space-between; font:600 15px system-ui; border-bottom:1px solid #64748b; }
      .demo-banner small { color:inherit; font-size:13px; }
      .container { max-width:1392px; }
      *, *::before, *::after { animation:none !important; transition:none !important; }
    </style>`;
    const setup = `<script>
      window.dashboardTheme.setPreference('${scene.light ? 'light' : 'dark'}', false);
      toggleAutoRefresh(false);
      document.querySelectorAll('.req-card').forEach((card, index) => { card.open = index === 0; });
      document.getElementById('checks-details').open = true;
      const attention = document.getElementById('attention-details');
      if (attention) attention.open = true;
      scrollTo(0, 0);
    </script>`;
    html = html.replace('</head>', `${style}</head>`)
      .replace(/(<body[^>]*>)/, `$1<div class="demo-banner"><span>${scene.title}</span><small>SIMULATED DASHBOARD DEMO / not a live run</small></div>`)
      .replace('</body>', `${setup}</body>`);
    const file = path.join(temporary, `scene-${index}.html`);
    const image = path.join(temporary, `scene-${index}.png`);
    fs.writeFileSync(file, html);
    execute(chrome, [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      `--user-data-dir=${path.join(temporary, 'browser')}`,
      '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1440,1360',
      '--virtual-time-budget=1500', `--screenshot=${image}`, pathToFileURL(file).href
    ]);
    console.log(`Captured ${scene.title}`);
    return { image, duration: scene.duration };
  });
  const output = path.join(root, 'assets/dashboard_walkthrough.webp');
  execute('img2webp', ['-loop', '0', '-lossy', '-q', '88', '-m', '6',
    ...frames.flatMap(({ image, duration }) => ['-d', String(duration), image]), '-o', output]);
  console.log(`Saved ${output} (${fs.statSync(output).size} bytes). All scenes are simulated.`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
