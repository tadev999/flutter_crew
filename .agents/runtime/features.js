'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { PATHS, DRAFT_MARKER } = require('./constants');
const { read, writeFileAtomic } = require('./fsutil');
const { FEATURE_SLUG } = require('./spec');

/**
 * Living feature catalog under docs/features/:
 *   catalog.json            accumulated requirements per feature (across runs)
 *   README.md               generated index
 *   <feature>/FEATURE.md    human narrative + generated requirements block
 * One plan function feeds both `feature sync` (writes) and the finish gate (compares).
 */
const CATALOG = `${PATHS.featuresDir}/catalog.json`;
const INDEX = `${PATHS.featuresDir}/README.md`;
const TEMPLATE = path.join(__dirname, '..', 'templates', 'FEATURE.template.md');
const TODO = '_TODO_';
const BEGIN = '<!-- FLUTTERCREW:GENERATED:BEGIN';
const END = '<!-- FLUTTERCREW:GENERATED:END -->';
const featureDoc = (slug) => `${PATHS.featuresDir}/${slug}/FEATURE.md`;

/** JSON with sorted object keys so hand-reordered files still compare equal. */
const canonical = (value) => JSON.stringify(value, (_key, item) => (item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item));
const sortObject = (object, map = (value) => value) =>
  Object.fromEntries(Object.keys(object).sort().map((key) => [key, map(object[key])]));
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const titleCase = (slug) => slug.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');

function loadCatalog(root) {
  const file = path.join(root, CATALOG);
  if (!fs.existsSync(file)) return { schemaVersion: 1, features: {} };
  let value;
  try { value = JSON.parse(read(file)); } catch (error) { throw new Error(`Invalid ${CATALOG}: ${error.message}`); }
  if (value?.schemaVersion !== 1 || !value.features || typeof value.features !== 'object' || Array.isArray(value.features)) {
    throw new Error(`${CATALOG} requires schemaVersion: 1 and a features object.`);
  }
  for (const [slug, feature] of Object.entries(value.features)) {
    if (!FEATURE_SLUG.test(slug) || !feature?.requirements || typeof feature.requirements !== 'object') {
      throw new Error(`Invalid feature "${slug}" in ${CATALOG}.`);
    }
  }
  return value;
}

/** Requirement IDs must be unique across the whole app, not just within one run. */
function catalogConflicts(root, requirements, catalog = loadCatalog(root)) {
  const issues = [];
  for (const [slug, feature] of Object.entries(catalog.features)) {
    for (const id of Object.keys(feature.requirements)) {
      const requirement = requirements.find((entry) => entry.id === id);
      if (requirement?.feature && requirement.feature !== slug) {
        issues.push(`${id} already belongs to feature "${slug}" in ${CATALOG}; use a new ID (prefer feature-prefixed IDs such as ${requirement.feature.toUpperCase()}-001).`);
      }
    }
  }
  return issues;
}

const linked = (requirement, kind) => [...new Set((requirement.references || [])
  .filter((ref) => ref.kind === kind).map((ref) => ref.evidence))].sort();

const entryOf = (requirement) => ({
  description: requirement.description, source: requirement.source,
  acceptanceCriteria: [...requirement.acceptanceCriteria], verification: requirement.verification,
  status: requirement.status, implementation: linked(requirement, 'implementation'), tests: linked(requirement, 'tests')
});

function renderBlock(feature) {
  const entries = Object.entries(feature.requirements);
  const lines = [
    `${BEGIN} (written by \`node .agents/runtime/crew.js feature sync\`; edit the sections above, not this block) -->`,
    '## Requirements and acceptance criteria', '',
    '| ID | Requirement | Verification | Status | Updated |', '|---|---|---|---|---|',
    ...entries.map(([id, entry]) => `| ${cell(id)} | ${cell(entry.description)} | ${cell(entry.verification)} | ${cell(entry.status)} | ${cell(String(entry.updatedAt || '').slice(0, 10))} |`),
    ''
  ];
  for (const [id, entry] of entries) {
    const files = (list) => (list?.length ? list.map((file) => `\`${file}\``).join(', ') : '—');
    lines.push(`### ${id} — ${cell(entry.description)}`, '', `Source: ${cell(entry.source)}`, '',
      ...(entry.acceptanceCriteria || []).map((criterion) => `- ${cell(criterion)}`), '',
      `Implementation: ${files(entry.implementation)}  `, `Tests: ${files(entry.tests)}`, '');
  }
  lines.push(END);
  return lines.join('\n');
}

function withBlock(doc, block) {
  const start = doc.indexOf(BEGIN);
  const end = doc.indexOf(END);
  if (start >= 0 && end > start) return `${doc.slice(0, start)}${block}${doc.slice(end + END.length)}`;
  return `${doc.replace(/\s*$/, '')}\n\n${block}\n`;
}

function renderIndex(root, catalog, files) {
  const rows = Object.entries(catalog.features).map(([slug, feature]) => {
    const doc = files.get(featureDoc(slug)) ?? read(path.join(root, featureDoc(slug)));
    const title = doc.match(/^# (.+)$/m)?.[1].trim() || titleCase(slug);
    const entries = Object.values(feature.requirements);
    const updated = entries.map((entry) => String(entry.updatedAt || '')).sort().pop()?.slice(0, 10) || '';
    return `| [${slug}](${slug}/FEATURE.md) | ${cell(title)} | ${entries.length} | ` +
      `${entries.filter((entry) => entry.status === 'passed').length} | ${updated} |`;
  });
  return ['# Feature catalog', '',
    '<!-- Generated by `node .agents/runtime/crew.js feature sync`. Edit each FEATURE.md, not this file. -->', '',
    'Living per-feature documentation: current behavior, Given/When/Then acceptance criteria and links to code and tests.', '',
    '| Feature | Title | Requirements | Passed | Last updated |', '|---|---|---|---|---|', ...rows, ''].join('\n');
}

/**
 * Compute the catalog files that should exist for the current spec requirements.
 * Unchanged entries keep their timestamp, so the plan is stable after a sync.
 */
function featurePlan(root, requirements, now = new Date().toISOString()) {
  const catalog = loadCatalog(root);
  const issues = catalogConflicts(root, requirements, catalog);
  const touched = new Map();
  for (const requirement of requirements) {
    if (!requirement.feature || issues.some((issue) => issue.startsWith(`${requirement.id} `))) continue;
    const feature = (catalog.features[requirement.feature] ??= { requirements: {} });
    const changed = touched.get(requirement.feature) || [];
    touched.set(requirement.feature, changed);
    const previous = feature.requirements[requirement.id];
    const entry = entryOf(requirement);
    const { updatedAt, ...recorded } = previous || {};
    if (previous && canonical(recorded) === canonical(entry)) continue;
    if (!previous || previous.description !== entry.description ||
        canonical(previous.acceptanceCriteria) !== canonical(entry.acceptanceCriteria)) changed.push(requirement.id);
    feature.requirements[requirement.id] = { ...entry, updatedAt: now };
  }
  const sorted = { schemaVersion: 1,
    features: sortObject(catalog.features, (feature) => ({ ...feature, requirements: sortObject(feature.requirements) })) };
  const files = new Map([[CATALOG, `${JSON.stringify(sorted, null, 2)}\n`]]);
  for (const [slug, changed] of touched) {
    const existing = read(path.join(root, featureDoc(slug)));
    let doc = existing.trim() ? existing
      : read(TEMPLATE).replaceAll('{{title}}', titleCase(slug)).replaceAll('{{slug}}', slug);
    if (existing.trim() && changed.length && !existing.includes(DRAFT_MARKER)) {
      doc = `<!-- ${DRAFT_MARKER}: requirements ${changed.join(', ')} changed; review every section above the generated block, then DELETE this line. -->\n${doc}`;
    }
    files.set(featureDoc(slug), withBlock(doc, renderBlock(sorted.features[slug])));
  }
  files.set(INDEX, renderIndex(root, sorted, files));
  return { issues, files, features: [...touched.keys()] };
}

/** Finish gate: the catalog matches the current spec/traces and touched pages are reviewed. */
function featureIssues(root, requirements) {
  if (!requirements.some((requirement) => requirement.feature)) return [];
  let plan;
  try { plan = featurePlan(root, requirements); } catch (error) { return [error.message]; }
  const issues = [...plan.issues];
  const stale = [...plan.files].filter(([relative, content]) => read(path.join(root, relative)) !== content)
    .map(([relative]) => relative);
  if (stale.length) issues.push(`Feature catalog out of date: ${stale.join(', ')}. Run feature sync and review the feature pages.`);
  for (const slug of plan.features) {
    const doc = plan.files.get(featureDoc(slug));
    if (doc.includes(DRAFT_MARKER) || doc.slice(0, doc.indexOf(BEGIN)).includes(TODO)) {
      issues.push(`${featureDoc(slug)} is a draft: replace every ${TODO} with reviewed facts and delete the ${DRAFT_MARKER} line.`);
    }
  }
  return issues;
}

/** Refuse to write through symlinked directories (could escape the project). */
function assertNoSymlink(root, relative) {
  let current = root;
  for (const part of path.dirname(relative).split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`Refusing to write the feature catalog through symlink: ${path.relative(root, current)}`);
    }
  }
}

function syncFeatures(root, requirements) {
  if (!requirements.some((requirement) => requirement.feature)) {
    throw new Error('No requirement in the current spec declares a feature. Rebaseline the spec with feature slugs.');
  }
  const plan = featurePlan(root, requirements);
  if (plan.issues.length) throw new Error(plan.issues.join('\n'));
  const written = [];
  for (const [relative, content] of plan.files) {
    assertNoSymlink(root, relative);
    if (read(path.join(root, relative)) === content) continue;
    writeFileAtomic(path.join(root, relative), content);
    written.push(relative);
  }
  return { written, features: plan.features };
}

module.exports = { featurePlan, featureIssues, syncFeatures, catalogConflicts, loadCatalog, CATALOG };
