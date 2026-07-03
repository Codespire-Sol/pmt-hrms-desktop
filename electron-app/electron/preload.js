'use strict';
// Minimal, safe preload. contextIsolation stays ON and nodeIntegration OFF in
// the window; we expose only a tiny, explicit API over the context bridge.
// Nothing here grants the renderer arbitrary Node/IPC access.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  // The launcher landing page uses these to open a specific UI or read share info.
  openPmt: () => ipcRenderer.send('open-ui', 'pmt'),
  openHrms: () => ipcRenderer.send('open-ui', 'hrms'),
  // Returns { publicHost, pmtPort, hrmsPort, apiPort } for building share links.
  getShareInfo: () => ipcRenderer.invoke('get-share-info'),

  // ── First-run setup screen (setup.html) ──────────────────────────────────
  // Returns { hasAdmin: boolean } so the page can skip the form if an admin
  // already exists.
  getSetupState: () => ipcRenderer.invoke('setup:get-state'),
  // Creates the first admin. Resolves { success, error? }. On success the main
  // process swaps the window to the launcher.
  createAdmin: (payload) => ipcRenderer.invoke('setup:create-admin', payload),

  // ── Reset-password window (reset.html) ────────────────────────────────────
  // Resets the admin password (host-only). Resolves { success, email?, error? }.
  resetAdmin: (payload) => ipcRenderer.invoke('reset:reset-admin', payload),
  // Returns a strong random password string for the "generate" helper.
  generatePassword: () => ipcRenderer.invoke('reset:generate-password'),
});
