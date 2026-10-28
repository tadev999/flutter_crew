'use strict';

const { MODES, MODE_LIMITS, DEFAULT_MODE } = require('./constants');

const text = (value) => typeof value === 'string' && value.trim().length > 0;

const FEATURE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GIVEN_WHEN_THEN = /^\s*given\s+\S[\s\S]*?\bwhen\s+\S[\s\S]*?\bthen\s+\S/i;

function strings(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) || !value.every(text)) {
    throw new Error(`${label} must be ${allowEmpty ? 'an' : 'a non-empty'} array of non-empty strings.`);
  }
}

/**
 * Validate a spec. New baselines are strict (feature slug + Given/When/Then);
 * `legacy` keeps specs baselined before those rules readable for existing runs.
 */
function validateSpec(value, { legacy = false } = {}) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.requirements) ||
      !value.requirements.length) {
    throw new Error('Spec requires schemaVersion: 1 and a non-empty requirements array.');
  }
  const mode = value.mode ?? DEFAULT_MODE;
  if (!MODES.includes(mode)) throw new Error(`Spec mode must be one of: ${MODES.join(', ')}.`);
  if (value.mode !== undefined && !text(value.modeReason)) {
    throw new Error('Spec mode requires a non-empty modeReason for the developer to review.');
  }
  const limit = MODE_LIMITS[mode]?.maxRequirements;
  if (limit && value.requirements.length > limit) {
    throw new Error(`Mode "${mode}" allows at most ${limit} requirements; use mode "feature" or "app".`);
  }
  const ids = new Set();
  for (const requirement of value.requirements) {
    if (!requirement || !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(requirement.id || '')) {
      throw new Error('Each requirement needs a stable ID such as REQ-001.');
    }
    if (ids.has(requirement.id)) throw new Error(`Duplicate requirement ID: ${requirement.id}`);
    ids.add(requirement.id);
    if (!text(requirement.description) || !text(requirement.source)) {
      throw new Error(`${requirement.id} requires description and source reference to the original brief.`);
    }
    strings(requirement.acceptanceCriteria, `${requirement.id}.acceptanceCriteria`);
    if (!['automated', 'manual'].includes(requirement.verification)) {
      throw new Error(`${requirement.id}.verification must be automated or manual.`);
    }
    if (requirement.feature !== undefined && !FEATURE_SLUG.test(requirement.feature)) {
      throw new Error(`${requirement.id}.feature must be a kebab-case slug such as "auth" or "task-board".`);
    }
    if (legacy) continue;
    if (requirement.feature === undefined) {
      throw new Error(`${requirement.id} requires a feature slug (e.g. "auth") for the feature catalog.`);
    }
    requirement.acceptanceCriteria.forEach((criterion, index) => {
      if (!GIVEN_WHEN_THEN.test(criterion)) {
        throw new Error(`${requirement.id}.acceptanceCriteria[${index}] must use "Given <context> When <action> Then <outcome>".`);
      }
    });
  }
  return value;
}

function validateTrace(value, requirement) {
  if (!value || !['pending', 'blocked', 'passed'].includes(value.status)) {
    throw new Error('Trace status must be pending, blocked or passed (no skipped completion).');
  }
  if (value.status !== 'passed') {
    if (!text(value.notes)) throw new Error('Pending/blocked traces require explanatory notes.');
    return value;
  }
  strings(value.implementation, 'Trace implementation');
  strings(value.tests, 'Trace tests', requirement.verification === 'manual');
  strings(value.evidence, 'Trace evidence');
  if (requirement.verification === 'manual' && !value.tests.length && !text(value.testRationale)) {
    throw new Error('Manual verification without automated tests requires testRationale.');
  }
  return value;
}

module.exports = { validateSpec, validateTrace, FEATURE_SLUG };