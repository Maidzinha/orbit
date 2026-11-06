/*
 * Orbit — shared statistics helpers.
 * Works in Node (main process, tests) and in the renderer (window.OrbitStats).
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
(function (root) {
  'use strict';

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  /** Local date key, e.g. "2026-11-06". */
  function dayKey(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Last `count` day keys ending at `end` (oldest first). */
  function lastDays(count, end) {
    const base = end ? new Date(end) : new Date();
    const keys = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
      keys.push(dayKey(d));
    }
    return keys;
  }

  /** Adds `seconds` of use for app `exe` at hour `hour` of day `key`. */
  function addUsage(days, key, exe, hour, seconds) {
    const day = (days[key] = days[key] || {});
    const rec = (day[exe] = day[exe] || { s: 0, h: new Array(24).fill(0) });
    rec.s += seconds;
    rec.h[hour] += seconds;
    return rec;
  }

  /** Ranking of apps for a list of day keys: [{ exe, seconds, share }], most used first. */
  function ranking(days, keys) {
    const totals = {};
    let all = 0;
    for (const k of keys) {
      const day = days[k];
      if (!day) continue;
      for (const exe of Object.keys(day)) {
        totals[exe] = (totals[exe] || 0) + day[exe].s;
        all += day[exe].s;
      }
    }
    return Object.keys(totals)
      .map((exe) => ({ exe, seconds: totals[exe], share: all ? totals[exe] / all : 0 }))
      .sort((a, b) => b.seconds - a.seconds);
  }

  /** Total seconds for each day key (optionally a single app). */
  function totalsByDay(days, keys, exe) {
    return keys.map((k) => {
      const day = days[k] || {};
      if (exe) return day[exe] ? day[exe].s : 0;
      return Object.values(day).reduce((sum, r) => sum + r.s, 0);
    });
  }

  /** Seconds per hour (24 values) for the given days (optionally a single app). */
  function totalsByHour(days, keys, exe) {
    const hours = new Array(24).fill(0);
    for (const k of keys) {
      const day = days[k] || {};
      const recs = exe ? (day[exe] ? [day[exe]] : []) : Object.values(day);
      for (const r of recs) for (let i = 0; i < 24; i++) hours[i] += r.h[i] || 0;
    }
    return hours;
  }

  /** All-time seconds per app. */
  function allTime(days) {
    const out = {};
    for (const k of Object.keys(days)) {
      for (const exe of Object.keys(days[k])) out[exe] = (out[exe] || 0) + days[k][exe].s;
    }
    return out;
  }

  /** Game-style level from all-time seconds: 1 XP per minute. */
  function level(seconds) {
    const xp = Math.floor(seconds / 60);
    const lvl = Math.floor(Math.sqrt(xp / 15)) + 1;
    const cur = 15 * (lvl - 1) * (lvl - 1);
    const next = 15 * lvl * lvl;
    return { level: lvl, xp, progress: next > cur ? (xp - cur) / (next - cur) : 0 };
  }

  /** Days in a row (ending today or yesterday) with at least `minSeconds` of tracked use. */
  function streak(days, today, minSeconds) {
    const min = minSeconds || 60;
    let count = 0;
    const base = today ? new Date(today) : new Date();
    for (let i = 0; i < 3650; i++) {
      const key = dayKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() - i));
      const total = totalsByDay(days, [key])[0];
      if (total >= min) count++;
      else if (i > 0) break;
    }
    return count;
  }

  /** Achievements unlocked on one day. */
  function achievements(days, key) {
    const day = days[key] || {};
    const recs = Object.values(day);
    const hours = totalsByHour(days, [key]);
    const total = recs.reduce((s, r) => s + r.s, 0);
    const list = [];
    if (recs.some((r) => r.s >= 3 * 3600)) list.push('marathoner');
    if (hours.slice(0, 5).reduce((a, b) => a + b, 0) >= 30 * 60) list.push('nightOwl');
    if (hours.slice(5, 8).reduce((a, b) => a + b, 0) >= 30 * 60) list.push('earlyBird');
    if (Object.keys(day).length >= 10) list.push('explorer');
    if (total > 0 && total <= 2 * 3600) list.push('balanced');
    return list;
  }

  /** Mascot mood from today's total and the optional daily goal (hours, 0 = off). */
  function mood(totalSeconds, goalHours) {
    const h = totalSeconds / 3600;
    if (goalHours > 0 && h > goalHours) return 'worried';
    if (h >= 6) return 'sleepy';
    if (h >= 2) return 'focused';
    return 'happy';
  }

  /** "2h 05min", "12min", "<1min". */
  function formatDuration(seconds) {
    const s = Math.round(seconds);
    if (s < 60) return '<1min';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (!h) return `${m}min`;
    return `${h}h ${pad(m)}min`;
  }

  /** CSV with one line per day and app. */
  function toCsv(days, apps) {
    const lines = ['date,app,executable,minutes'];
    for (const k of Object.keys(days).sort()) {
      for (const exe of Object.keys(days[k])) {
        const name = ((apps[exe] && apps[exe].name) || exe).replace(/"/g, '""');
        lines.push(`${k},"${name}","${exe}",${(days[k][exe].s / 60).toFixed(1)}`);
      }
    }
    return lines.join('\r\n') + '\r\n';
  }

  const api = {
    dayKey, lastDays, addUsage, ranking, totalsByDay, totalsByHour, allTime,
    level, streak, achievements, mood, formatDuration, toCsv,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OrbitStats = api;
})(typeof window !== 'undefined' ? window : globalThis);
