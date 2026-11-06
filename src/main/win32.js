/*
 * Orbit — reads the foreground window on Windows through user32/kernel32 (koffi FFI).
 * Only the executable path and the window rectangle are read. Window titles are never read.
 * © 2026 Helder (Maidzinha) — PolyForm Noncommercial 1.0.0
 */
'use strict';

const path = require('path');

let api = null;

function load() {
  if (api) return api;
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');

  const RECT = koffi.struct('ORBIT_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  const MONITORINFO = koffi.struct('ORBIT_MONITORINFO', {
    cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32',
  });
  const HANDLE = koffi.pointer('ORBIT_HANDLE', koffi.opaque());

  api = {
    koffi,
    MONITORINFO,
    GetForegroundWindow: user32.func('ORBIT_HANDLE __stdcall GetForegroundWindow()'),
    GetWindowThreadProcessId: user32.func('uint32 __stdcall GetWindowThreadProcessId(ORBIT_HANDLE hWnd, _Out_ uint32 *pid)'),
    GetWindowRect: user32.func('bool __stdcall GetWindowRect(ORBIT_HANDLE hWnd, _Out_ ORBIT_RECT *rect)'),
    IsIconic: user32.func('bool __stdcall IsIconic(ORBIT_HANDLE hWnd)'),
    MonitorFromWindow: user32.func('ORBIT_HANDLE __stdcall MonitorFromWindow(ORBIT_HANDLE hWnd, uint32 flags)'),
    GetMonitorInfoW: user32.func('bool __stdcall GetMonitorInfoW(ORBIT_HANDLE hMonitor, _Inout_ ORBIT_MONITORINFO *info)'),
    OpenProcess: kernel32.func('ORBIT_HANDLE __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)'),
    QueryFullProcessImageNameW: kernel32.func('bool __stdcall QueryFullProcessImageNameW(ORBIT_HANDLE process, uint32 flags, _Out_ uint8_t *buffer, _Inout_ uint32 *size)'),
    CloseHandle: kernel32.func('bool __stdcall CloseHandle(ORBIT_HANDLE handle)'),
  };
  return api;
}

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
const MONITOR_DEFAULTTONEAREST = 2;
const pathCache = new Map(); // pid -> exe path

function processPath(a, pid) {
  if (pathCache.has(pid)) return pathCache.get(pid);
  const handle = a.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
  if (!handle) return null;
  try {
    const buf = Buffer.alloc(2048);
    const size = [1024];
    if (!a.QueryFullProcessImageNameW(handle, 0, buf, size)) return null;
    const exePath = buf.toString('utf16le', 0, size[0] * 2);
    if (pathCache.size > 500) pathCache.clear();
    pathCache.set(pid, exePath);
    return exePath;
  } finally {
    a.CloseHandle(handle);
  }
}

/**
 * Returns { exe, path, fullscreen } for the foreground window, or null when there is none
 * (lock screen, minimized, access denied).
 */
function foregroundApp() {
  const a = load();
  const hwnd = a.GetForegroundWindow();
  if (!hwnd || a.IsIconic(hwnd)) return null;

  const pid = [0];
  a.GetWindowThreadProcessId(hwnd, pid);
  if (!pid[0]) return null;

  const exePath = processPath(a, pid[0]);
  if (!exePath) return null;

  let fullscreen = false;
  const rect = {};
  if (a.GetWindowRect(hwnd, rect)) {
    const monitor = a.MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
    const zero = { left: 0, top: 0, right: 0, bottom: 0 };
    const info = { cbSize: a.koffi.sizeof(a.MONITORINFO), rcMonitor: zero, rcWork: zero, dwFlags: 0 };
    if (monitor && a.GetMonitorInfoW(monitor, info)) {
      const m = info.rcMonitor;
      fullscreen = rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom;
    }
  }

  return { exe: path.basename(exePath).toLowerCase(), path: exePath, fullscreen };
}

module.exports = { foregroundApp };
