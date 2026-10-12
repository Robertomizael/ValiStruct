'use strict';

const { app, BrowserWindow } = require('electron');

if (process.platform === 'darwin') {
  let quitting = false;

  app.on('before-quit', () => {
    quitting = true;
  });

  app.on('browser-window-created', (_event, win) => {
    win.on('close', (event) => {
      if (quitting || win.isDestroyed()) return;
      event.preventDefault();
      win.hide();
    });
  });

  app.on('activate', () => {
    const windows = BrowserWindow.getAllWindows();
    if (!windows.length) return;
    const win = windows[0];
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    win.focus();
  });
}
