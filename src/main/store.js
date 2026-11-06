/*
 * Orbit — local JSON storage (%AppData%\Orbit\orbit-data.json).
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  idleMinutes: 2, // 0 = never idle
  goalHours: 0, // 0 = no daily goal
  autoStart: false,
  ignored: [], // executable names, e.g. ["explorer.exe"]
  language: 'auto', // auto | pt-BR | en
  theme: 'dark', // dark | light | pink
};

function emptyData() {
  return { version: 1, days: {}, apps: {}, settings: { ...DEFAULT_SETTINGS } };
}

function normalize(raw) {
  const data = emptyData();
  if (raw && typeof raw === 'object') {
    if (raw.days && typeof raw.days === 'object') data.days = raw.days;
    if (raw.apps && typeof raw.apps === 'object') data.apps = raw.apps;
    if (raw.settings && typeof raw.settings === 'object') data.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
  }
  if (!Array.isArray(data.settings.ignored)) data.settings.ignored = [];
  return data;
}

class Store {
  constructor(file) {
    this.file = file;
    this.data = emptyData();
    this.dirty = false;
  }

  load() {
    try {
      this.data = normalize(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // Keep a copy of a damaged file instead of overwriting it silently.
        try { fs.copyFileSync(this.file, this.file + '.broken-' + Date.now()); } catch { /* ignore */ }
      }
      this.data = emptyData();
    }
    return this.data;
  }

  save() {
    if (!this.dirty) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  clearHistory() {
    this.data.days = {};
    this.dirty = true;
    this.save();
  }
}

module.exports = { Store, DEFAULT_SETTINGS, normalize, emptyData };
