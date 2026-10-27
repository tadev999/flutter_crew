'use strict';

const path = require('node:path');
const { PATHS, LIMITS } = require('./constants');
const { read } = require('./fsutil');

/**
 * Optional, committed project configuration: docs/fluttercrew/config.json
 *
 * {
 *   "gates": {
 *     "analyzeFatalInfos": true,
 *     "timeoutMs": 600000,
 *     "codegen":  { "enabled": true },
 *     "coverage": { "enabled": true, "minPercent": 80 }
 *   },
 *   "preflight": { "suppress": [{ "rule": "typed-converter", "reason": "Uses freezed fromJson" }] },
 *   "entrypoints": ["lib/main_dev.dart"]
 * }
 *
 * Defaults reproduce the original behaviour (format, analyze, test only).
 */
const DEFAULTS = Object.freeze({
  gates: { analyzeFatalInfos: true, timeoutMs: LIMITS.commandTimeoutMs, codegen: false, coverage: false, minCoverage: 80 },
  suppress: [],
  entrypoints: []
});

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

/** Load and validate the config. Never throws: a problem is reported in `error`. */
function loadConfig(root) {
  const file = path.join(root, PATHS.configFile);
  const raw = read(file);
  const config = { ...DEFAULTS, gates: { ...DEFAULTS.gates }, suppress: [], entrypoints: [], error: null };
  if (!raw.trim()) return config;
  try {
    const value = JSON.parse(raw);
    if (!isObject(value)) throw new Error('must be a JSON object');
    const gates = value.gates || {};
    if (!isObject(gates)) throw new Error('"gates" must be an object');
    if (gates.analyzeFatalInfos !== undefined) config.gates.analyzeFatalInfos = gates.analyzeFatalInfos !== false;
    if (gates.timeoutMs !== undefined) {
      if (!Number.isInteger(gates.timeoutMs) || gates.timeoutMs < 1000) throw new Error('"gates.timeoutMs" must be an integer >= 1000');
      config.gates.timeoutMs = gates.timeoutMs;
    }
    config.gates.codegen = isObject(gates.codegen) ? gates.codegen.enabled === true : gates.codegen === true;
    if (isObject(gates.coverage)) {
      config.gates.coverage = gates.coverage.enabled === true;
      if (gates.coverage.minPercent !== undefined) {
        const min = gates.coverage.minPercent;
        if (typeof min !== 'number' || min < 0 || min > 100) throw new Error('"gates.coverage.minPercent" must be 0-100');
        config.gates.minCoverage = min;
      }
    } else config.gates.coverage = gates.coverage === true;

    const suppress = value.preflight?.suppress ?? [];
    if (!Array.isArray(suppress)) throw new Error('"preflight.suppress" must be an array');
    for (const entry of suppress) {
      if (!isObject(entry) || typeof entry.rule !== 'string' || !entry.rule.trim() ||
          typeof entry.reason !== 'string' || !entry.reason.trim()) {
        throw new Error('every "preflight.suppress" entry needs a "rule" and a non-empty "reason"');
      }
      config.suppress.push({ rule: entry.rule.trim(), reason: entry.reason.trim() });
    }
    const entrypoints = value.entrypoints ?? [];
    if (!Array.isArray(entrypoints) || !entrypoints.every((item) => typeof item === 'string' && item.trim())) {
      throw new Error('"entrypoints" must be an array of project-relative paths');
    }
    config.entrypoints = entrypoints.map((item) => item.trim());
  } catch (error) {
    config.error = `Invalid ${PATHS.configFile}: ${error.message}`;
  }
  return config;
}

module.exports = { loadConfig, DEFAULTS };
