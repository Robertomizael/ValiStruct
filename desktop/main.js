'use strict';

const { app, BrowserWindow, dialog } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

let backendProcess = null;

function resourcePath(...parts) {
  const base = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
  return path.join(base, ...parts);
}

function commandExists(command, args = ['--version']) {
  try {
    const result = spawnSync(command, args, { stdio: 'ignore', shell: false });
    return result.status === 0;
  } catch (_) {
    return false;
  }
}

function findPython() {
  const candidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  for (const cmd of candidates) {
    if (commandExists(cmd, cmd === 'py' ? ['-3', '--version'] : ['--version'])) return cmd;
  }
  return null;
}

function waitForBackend(timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const req = http.get('http://127.0.0.1:8765/health', (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve();
        if (Date.now() - started > timeoutMs) return reject(new Error('Backend no disponible'));
        setTimeout(probe, 700);
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) return reject(new Error('Backend no disponible'));
        setTimeout(probe, 700);
      });
      req.setTimeout(1500, () => req.destroy());
    };
    probe();
  });
}

function startBackend() {
  const python = findPython();
  if (!python) throw new Error('No se encontró Python 3. Esta Beta Desktop aún requiere Python instalado.');
  if (!commandExists('Rscript')) throw new Error('No se encontró Rscript. Esta Beta Desktop aún requiere R instalado y disponible en PATH.');

  const backendDir = app.isPackaged ? resourcePath('backend') : path.resolve(__dirname, '..', 'backend');
  const apiFile = path.join(backendDir, 'api.py');
  if (!fs.existsSync(apiFile)) throw new Error(`No se encontró el backend: ${apiFile}`);

  const args = python === 'py' ? ['-3', apiFile] : [apiFile];
  backendProcess = spawn(python, args, {
    cwd: backendDir,
    env: {
      ...process.env,
      VALISTRUCT_AUTH_ENABLED: 'false',
      VALISTRUCT_PROJECT_LIBRARY_ENABLED: 'false',
      VALISTRUCT_ENV: 'development',
      FLASK_RUN_PORT: '8765'
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  backendProcess.stdout.on('data', (d) => console.log(`[backend] ${d}`));
  backendProcess.stderr.on('data', (d) => console.error(`[backend] ${d}`));
  backendProcess.on('exit', (code) => console.log(`Backend finalizado: ${code}`));
}

async function createWindow() {
  try {
    startBackend();
    await waitForBackend();
  } catch (err) {
    dialog.showErrorBox('ValiStruct Desktop Beta', `${err.message}\n\nEn la siguiente fase integraremos Python y R dentro del instalador para eliminar este requisito.`);
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1100,
    minHeight: 720,
    title: 'ValiStruct v3.0.0 Beta 1',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  const frontend = app.isPackaged
    ? resourcePath('app', 'index.html')
    : path.resolve(__dirname, '..', 'index.html');

  await win.loadFile(frontend);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
});
