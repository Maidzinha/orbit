/*
 * Orbit — preload bridge. The page gets only these calls, never Node.js.
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbit', {
  snapshot: () => ipcRenderer.invoke('orbit:snapshot'),
  saveSettings: (patch) => ipcRenderer.invoke('orbit:settings', patch),
  exportCsv: () => ipcRenderer.invoke('orbit:exportCsv'),
  clearHistory: () => ipcRenderer.invoke('orbit:clearHistory'),
  openDataFolder: () => ipcRenderer.invoke('orbit:openDataFolder'),
  openRepo: () => ipcRenderer.invoke('orbit:openRepo'),
  onDemo: (fn) => ipcRenderer.on('orbit:demo', (_e, payload) => fn(payload)),
});
