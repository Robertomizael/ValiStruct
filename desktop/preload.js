'use strict';

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('valistructDesktop', {
  platform: process.platform,
  desktop: true,
  version: '3.0.0-beta.1'
});
