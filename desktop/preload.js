'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('valistructDesktop', {
  platform: process.platform,
  desktop: true,
  version: '3.0.0-beta.1',
  parseSpreadsheet: async (name, bytes) => {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return ipcRenderer.invoke('valistruct:parse-spreadsheet', { name, data });
  },
  createSpreadsheet: async (csv, format = 'xlsx') => {
    return ipcRenderer.invoke('valistruct:create-spreadsheet', { csv, format });
  }
});
