/*
 * Orbit — main process: tracking loop, tray, storage and IPC.
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
'use strict';

const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const stats = require('../shared/stats');
const { Store } = require('./store');
const win32 = require('./win32');
const demo = require('./demo');

const ROOT = path.join(__dirname, '..', '..');
const ASSETS = path.join(ROOT, 'assets');
const REPO_URL = 'https://github.com/Maidzinha/orbit';

const screenshotArg = process.argv.find((a) => a.startsWith('--screenshots='));
const SCREENSHOT_DIR = screenshotArg ? path.resolve(screenshotArg.split('=')[1]) : null;
const START_HIDDEN = process.argv.includes('--hidden');

app.setAppUserModelId('com.maidzinha.orbit');

if (!SCREENSHOT_DIR && !app.requestSingleInstanceLock()) {
  app.quit();
}

let store;
let win = null;
let tray = null;
let quitting = false;
let status = { tracking: false, idle: false, fullscreen: false, exe: null, locked: false, error: null };
const pendingMeta = new Set();

/* ---------------- app metadata (friendly name + icon) ---------------- */

function fileDescription(exePath) {
  return new Promise((resolve) => {
    const cmd = '$p=$env:ORBIT_EXE_PATH; try { (Get-Item -LiteralPath $p).VersionInfo.FileDescription } catch { "" }';
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', cmd],
      { env: { ...process.env, ORBIT_EXE_PATH: exePath }, windowsHide: true, timeout: 8000 },
      (err, stdout) => resolve(err ? '' : String(stdout).trim())
    );
  });
}

function prettyExe(exe) {
  const base = exe.replace(/\.exe$/i, '');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

async function ensureMeta(exe, exePath) {
  const known = store.data.apps[exe];
  if ((known && known.icon) || pendingMeta.has(exe)) return;
  pendingMeta.add(exe);
  try {
    const meta = { name: (known && known.name) || prettyExe(exe), icon: null };
    const desc = await fileDescription(exePath);
    if (desc && desc.length <= 60) meta.name = desc;
    try {
      const icon = await app.getFileIcon(exePath, { size: 'normal' });
      if (!icon.isEmpty()) meta.icon = icon.toDataURL();
    } catch { /* no icon */ }
    store.data.apps[exe] = meta;
    store.dirty = true;
  } finally {
    pendingMeta.delete(exe);
  }
}

/* ---------------- tracking loop ---------------- */

let lastTick = Date.now();

function tick() {
  const now = Date.now();
  // Cap the step so sleep/hibernate gaps are never counted.
  const delta = Math.min((now - lastTick) / 1000, 3);
  lastTick = now;

  const s = store.data.settings;
  let fg = null;
  try {
    fg = win32.foregroundApp();
    status.error = null;
  } catch (err) {
    status.error = String(err && err.message ? err.message : err);
  }

  const idleSeconds = powerMonitor.getSystemIdleTime();
  const fullscreen = !!(fg && fg.fullscreen);
  const idle = s.idleMinutes > 0 && idleSeconds >= s.idleMinutes * 60 && !fullscreen;
  const ignored = fg && s.ignored.map((x) => x.toLowerCase()).includes(fg.exe);

  status = { ...status, exe: fg ? fg.exe : null, idle, fullscreen, tracking: false };
  if (process.env.ORBIT_DEBUG) console.log('[tick]', JSON.stringify({ fg, idleSeconds, idle, error: status.error }));

  if (!fg || idle || ignored || status.locked || delta <= 0) return;

  const d = new Date();
  stats.addUsage(store.data.days, stats.dayKey(d), fg.exe, d.getHours(), delta);
  store.dirty = true;
  status.tracking = true;
  ensureMeta(fg.exe, fg.path);
}

function updateTray() {
  if (!tray) return;
  const key = stats.dayKey();
  const total = stats.totalsByDay(store.data.days, [key])[0];
  const pt = isPortuguese();
  let state = pt ? 'rastreando' : 'tracking';
  if (status.locked) state = pt ? 'tela bloqueada' : 'screen locked';
  else if (status.idle) state = pt ? 'ocioso' : 'idle';
  tray.setToolTip(`Orbit — ${pt ? 'hoje' : 'today'}: ${stats.formatDuration(total)} (${state})`);
}

function isPortuguese() {
  const lang = store.data.settings.language;
  if (lang === 'pt-BR') return true;
  if (lang === 'en') return false;
  return app.getLocale().toLowerCase().startsWith('pt');
}

/* ---------------- window & tray ---------------- */

function createWindow(show) {
  win = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 860,
    minHeight: 600,
    show: false,
    title: 'Orbit',
    icon: path.join(ASSETS, 'icon.png'),
    backgroundColor: '#0f0b18',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (show) win.show(); });

  win.on('close', (e) => {
    if (!quitting && !SCREENSHOT_DIR) {
      e.preventDefault();
      win.hide();
    }
  });

  // Open external links (GitHub) in the default browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function showWindow() {
  if (!win) createWindow(true);
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function buildTrayMenu() {
  const pt = isPortuguese();
  return Menu.buildFromTemplate([
    { label: pt ? 'Abrir o Orbit' : 'Open Orbit', click: showWindow },
    { type: 'separator' },
    { label: pt ? 'Sair' : 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const img = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  tray = new Tray(img.isEmpty() ? nativeImage.createEmpty() : img);
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', showWindow);
  updateTray();
}

function applyAutoStart() {
  if (!app.isPackaged) return; // only for the installed/portable app
  app.setLoginItemSettings({
    openAtLogin: !!store.data.settings.autoStart,
    path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
    args: ['--hidden'],
  });
}

/* ---------------- IPC ---------------- */

function snapshot() {
  return {
    days: store.data.days,
    apps: store.data.apps,
    settings: store.data.settings,
    status,
    locale: app.getLocale(),
    version: app.getVersion(),
    repo: REPO_URL,
    dataFile: store.file,
  };
}

function registerIpc() {
  ipcMain.handle('orbit:snapshot', () => snapshot());

  ipcMain.handle('orbit:settings', (_e, patch) => {
    const s = store.data.settings;
    if (patch && typeof patch === 'object') {
      if (Number.isFinite(patch.idleMinutes)) s.idleMinutes = Math.max(0, Math.min(120, Math.round(patch.idleMinutes)));
      if (Number.isFinite(patch.goalHours)) s.goalHours = Math.max(0, Math.min(24, patch.goalHours));
      if (typeof patch.autoStart === 'boolean') s.autoStart = patch.autoStart;
      if (Array.isArray(patch.ignored)) {
        s.ignored = patch.ignored.map((x) => String(x).trim().toLowerCase()).filter(Boolean).slice(0, 200);
      }
      if (['auto', 'pt-BR', 'en'].includes(patch.language)) s.language = patch.language;
      if (['dark', 'light', 'pink'].includes(patch.theme)) s.theme = patch.theme;
    }
    store.dirty = true;
    store.save();
    applyAutoStart();
    if (tray) tray.setContextMenu(buildTrayMenu());
    updateTray();
    return s;
  });

  ipcMain.handle('orbit:exportCsv', async () => {
    const pt = isPortuguese();
    const res = await dialog.showSaveDialog(win, {
      title: pt ? 'Exportar histórico' : 'Export history',
      defaultPath: `orbit-${stats.dayKey()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (res.canceled || !res.filePath) return false;
    fs.writeFileSync(res.filePath, '﻿' + stats.toCsv(store.data.days, store.data.apps), 'utf8');
    return true;
  });

  ipcMain.handle('orbit:clearHistory', async () => {
    const pt = isPortuguese();
    const res = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: pt ? ['Cancelar', 'Apagar histórico'] : ['Cancel', 'Delete history'],
      defaultId: 0,
      cancelId: 0,
      title: 'Orbit',
      message: pt ? 'Apagar todo o histórico de tempo de tela?' : 'Delete all screen time history?',
      detail: pt ? 'Isso não pode ser desfeito.' : 'This cannot be undone.',
    });
    if (res.response !== 1) return false;
    store.clearHistory();
    return true;
  });

  ipcMain.handle('orbit:openDataFolder', () => shell.showItemInFolder(store.file));
  ipcMain.handle('orbit:openRepo', () => shell.openExternal(REPO_URL));
}

/* ---------------- screenshots for the README ---------------- */

async function takeScreenshots() {
  const shots = [
    { language: 'pt-BR', view: 'today', file: 'home.png' },
    { language: 'pt-BR', view: 'week', file: 'semana.png' },
    { language: 'pt-BR', view: 'settings', file: 'configuracoes.png' },
    { language: 'en', view: 'today', file: path.join('en', 'home.png') },
    { language: 'en', view: 'week', file: path.join('en', 'week.png') },
    { language: 'en', view: 'settings', file: path.join('en', 'settings.png') },
  ];
  await new Promise((r) => win.webContents.once('did-finish-load', r));
  win.show();
  for (const shot of shots) {
    store.data.settings.language = shot.language;
    win.webContents.send('orbit:demo', { view: shot.view });
    await new Promise((r) => setTimeout(r, 1500));
    const image = await win.webContents.capturePage();
    const out = path.join(SCREENSHOT_DIR, shot.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, image.toPNG());
    console.log('saved', out);
  }
  quitting = true;
  app.quit();
}

/* ---------------- lifecycle ---------------- */

app.on('second-instance', showWindow);

app.whenReady().then(() => {
  if (SCREENSHOT_DIR) {
    store = { data: demo.build(), file: 'demo', dirty: false, save() {}, clearHistory() {} };
    status = { ...status, tracking: true, exe: 'chrome.exe' };
    registerIpc();
    createWindow(false);
    win.setSize(1180, 760);
    takeScreenshots().catch((err) => { console.error(err); app.exit(1); });
    return;
  }

  store = new Store(path.join(app.getPath('userData'), 'orbit-data.json'));
  store.load();
  registerIpc();
  createTray();
  createWindow(!START_HIDDEN);
  applyAutoStart();

  powerMonitor.on('lock-screen', () => { status.locked = true; });
  powerMonitor.on('unlock-screen', () => { status.locked = false; lastTick = Date.now(); });
  powerMonitor.on('suspend', () => { store.save(); });
  powerMonitor.on('resume', () => { lastTick = Date.now(); });

  setInterval(tick, 1000);
  setInterval(updateTray, 5000);
  setInterval(() => { try { store.save(); } catch (err) { console.error(err); } }, 30000);
});

app.on('before-quit', () => {
  quitting = true;
  try { if (store && store.save) store.save(); } catch { /* ignore */ }
});

app.on('window-all-closed', () => {
  // Keep running in the tray.
  if (SCREENSHOT_DIR) app.quit();
});
