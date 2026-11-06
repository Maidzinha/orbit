/*
 * Orbit — sample data used only to take the README screenshots (npm run screenshots).
 * It is never saved and never mixed with real data.
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
'use strict';

const stats = require('../shared/stats');
const { emptyData } = require('./store');

const APPS = [
  ['chrome.exe', 'Google Chrome', 3.1, [0, 20, 21, 22, 23]],
  ['code.exe', 'Visual Studio Code', 2.1, [9, 10, 11, 14, 15, 16]],
  ['discord.exe', 'Discord', 1.2, [13, 19, 20, 21]],
  ['steam.exe', 'Steam', 0.9, [18, 19]],
  ['spotify.exe', 'Spotify', 0.7, [10, 11, 15]],
  ['explorer.exe', 'Windows Explorer', 0.35, [9, 12, 17]],
  ['obs64.exe', 'OBS Studio', 0.3, [17]],
  ['notepad.exe', 'Notepad', 0.15, [12]],
];

// Deterministic pseudo-random numbers so screenshots are always the same.
function rng(seed) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function build() {
  const data = emptyData();
  const rand = rng(42);
  const keys = stats.lastDays(30);
  keys.forEach((key, i) => {
    const today = i === keys.length - 1;
    const dayFactor = today ? 1 : 0.55 + rand() * 0.9;
    for (const [exe, , hours, peak] of APPS) {
      const total = hours * 3600 * dayFactor * (today ? 1 : 0.6 + rand() * 0.8);
      peak.forEach((h) => stats.addUsage(data.days, key, exe, h, total / peak.length));
    }
  });
  for (const [exe, name] of APPS) data.apps[exe] = { name, icon: null };
  data.settings.goalHours = 10;
  return data;
}

module.exports = { build };
