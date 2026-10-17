'use strict';

const fs = require('node:fs');
const path = require('node:path');

function escapeHtml(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Local wall-clock time (HH:MM:SS) for a timestamp, or '' when invalid/absent. */
function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Last `lines` lines of a project-relative log file ('' if unreadable). */
function tailLog(root, relative, lines = 8) {
  try {
    if (!relative || !root) return '';
    return fs.readFileSync(path.join(root, relative), 'utf8').trim().split('\n').slice(-lines).join('\n');
  } catch { return ''; }
}

module.exports = { escapeHtml, formatTime, tailLog };
