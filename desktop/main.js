'use strict';

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const tar = require('tar');
const XLSX = require('xlsx');

let backendProcess = null;
let runtimeInfo = null;

ipcMain.handle('valistruct:parse-spreadsheet', async (_event, payload) => {
  try {
    const name = String(payload?.name || 'archivo.xlsx');
    if (!/\.(xlsx|xls)$/i.test(name)) {
      return { ok: false, error: 'Formato no compatible. Use .xls o .xlsx.' };
    }
    const bytes = payload?.data;
    if (!bytes) return { ok: false, error: 'El archivo está vacío.' };
    const buffer = Buffer.from(bytes);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheet = workbook.SheetNames?.[0];
    if (!firstSheet) return { ok: false, error: 'El libro de Excel no contiene hojas.' };
    const sheet = workbook.Sheets[firstSheet];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n', blankrows: false });
    if (!csv.trim()) return { ok: false, error: 'La primera hoja no contiene datos.' };
    return { ok: true, csv, sheet: firstSheet };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

function resourcePath(...parts) {
  const base = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..');
  return path.join(base, ...parts);
}

function commandExists(command, args = ['--version'], env = process.env) {
  try {
    const result = spawnSync(command, args, { stdio: 'ignore', shell: false, env });
    return result.status === 0;
  } catch (_) {
    return false;
  }
}

function firstExisting(paths) {
  return paths.find((p) => p && fs.existsSync(p)) || null;
}

function runtimeExecutables(runtimeDir) {
  const python = firstExisting(process.platform === 'win32'
    ? [path.join(runtimeDir, 'python.exe'), path.join(runtimeDir, 'Scripts', 'python.exe')]
    : [path.join(runtimeDir, 'bin', 'python3'), path.join(runtimeDir, 'bin', 'python')]);

  const rscript = firstExisting(process.platform === 'win32'
    ? [
        path.join(runtimeDir, 'Scripts', 'Rscript.exe'),
        path.join(runtimeDir, 'Library', 'bin', 'Rscript.exe'),
        path.join(runtimeDir, 'Lib', 'R', 'bin', 'x64', 'Rscript.exe'),
        path.join(runtimeDir, 'Lib', 'R', 'bin', 'Rscript.exe')
      ]
    : [path.join(runtimeDir, 'bin', 'Rscript')]);

  const rHome = firstExisting(process.platform === 'win32'
    ? [path.join(runtimeDir, 'Lib', 'R'), path.join(runtimeDir, 'Library', 'lib', 'R')]
    : [path.join(runtimeDir, 'lib', 'R')]);

  const pathDirs = process.platform === 'win32'
    ? [runtimeDir, path.join(runtimeDir, 'Scripts'), path.join(runtimeDir, 'Library', 'bin'), path.join(runtimeDir, 'Lib', 'R', 'bin', 'x64')]
    : [path.join(runtimeDir, 'bin'), path.join(runtimeDir, 'lib', 'R', 'bin')];

  const env = {
    ...process.env,
    PATH: [...pathDirs.filter(fs.existsSync), process.env.PATH || ''].join(path.delimiter),
    CONDA_PREFIX: runtimeDir
  };
  if (rHome) env.R_HOME = rHome;

  return { python, rscript, rHome, env };
}

function bundledRuntimeDir() {
  // Conda's relocated R launcher on macOS is not reliable when the target
  // prefix contains spaces (for example ~/Library/Application Support/...).
  // Keep the embedded runtime in a private, space-free folder under $HOME.
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), '.valistruct', 'runtime-v2');
  }
  return path.join(app.getPath('userData'), 'runtime-v2');
}

async function ensureBundledRuntime() {
  if (!app.isPackaged) return null;

  const archive = resourcePath('runtime', 'valistruct-runtime.tar.gz');
  if (!fs.existsSync(archive)) {
    throw new Error('El instalador no contiene el motor autónomo de ValiStruct.');
  }

  const runtimeDir = bundledRuntimeDir();
  const marker = path.join(runtimeDir, '.valistruct-runtime-ready');

  if (!fs.existsSync(marker)) {
    await dialog.showMessageBox({
      type: 'info',
      title: 'ValiStruct Desktop',
      message: 'Preparando el motor estadístico integrado',
      detail: 'Esta preparación ocurre una sola vez y puede tardar algunos minutos. No requiere instalar Python ni R por separado.',
      buttons: ['Continuar'],
      defaultId: 0
    });

    fs.rmSync(runtimeDir, { recursive: true, force: true });
    fs.mkdirSync(runtimeDir, { recursive: true });
    await tar.x({ file: archive, cwd: runtimeDir });

    let candidate = runtimeExecutables(runtimeDir);
    if (!candidate.python) {
      throw new Error('El runtime integrado se extrajo, pero no se encontró Python.');
    }

    const unpack = firstExisting(process.platform === 'win32'
      ? [path.join(runtimeDir, 'Scripts', 'conda-unpack-script.py'), path.join(runtimeDir, 'Scripts', 'conda-unpack.exe')]
      : [path.join(runtimeDir, 'bin', 'conda-unpack')]);

    if (unpack) {
      let result;
      if (process.platform === 'win32' && unpack.toLowerCase().endsWith('.exe')) {
        result = spawnSync(unpack, [], { cwd: runtimeDir, env: candidate.env, encoding: 'utf8' });
      } else {
        result = spawnSync(candidate.python, [unpack], { cwd: runtimeDir, env: candidate.env, encoding: 'utf8' });
      }
      if (result && result.status !== 0) {
        throw new Error(`No fue posible preparar el runtime integrado: ${result.stderr || result.stdout || 'conda-unpack falló'}`);
      }
    }

    candidate = runtimeExecutables(runtimeDir);
    if (!candidate.python || !candidate.rscript) {
      throw new Error('El runtime integrado se extrajo, pero no se encontraron Python y Rscript.');
    }
    if (!commandExists(candidate.python, ['--version'], candidate.env)) {
      throw new Error('Python integrado no pudo iniciarse.');
    }
    if (!commandExists(candidate.rscript, ['--version'], candidate.env)) {
      throw new Error('R integrado no pudo iniciarse.');
    }

    const rCheck = spawnSync(candidate.rscript, ['-e', 'library(jsonlite); library(lavaan); library(psych); library(naniar); cat("OK")'], {
      env: candidate.env,
      encoding: 'utf8',
      timeout: 120000
    });
    if (rCheck.status !== 0) {
      throw new Error(`El runtime de R no contiene todos los paquetes requeridos: ${rCheck.stderr || rCheck.stdout || ''}`);
    }

    fs.writeFileSync(marker, new Date().toISOString(), 'utf8');

    // Remove the failed legacy macOS runtime only after v2 is proven healthy.
    if (process.platform === 'darwin') {
      const legacyRuntime = path.join(app.getPath('userData'), 'runtime-v1');
      if (legacyRuntime !== runtimeDir) {
        fs.rmSync(legacyRuntime, { recursive: true, force: true });
      }
    }
  }

  return runtimeExecutables(runtimeDir);
}

function findSystemRuntime() {
  const pythonCandidates = process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python'];
  let python = null;
  for (const cmd of pythonCandidates) {
    if (commandExists(cmd, cmd === 'py' ? ['-3', '--version'] : ['--version'])) {
      python = cmd;
      break;
    }
  }
  const rscript = commandExists('Rscript') ? 'Rscript' : null;
  return { python, rscript, env: process.env };
}

function waitForBackend(timeoutMs = 45000) {
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
  const runtime = runtimeInfo || findSystemRuntime();
  if (!runtime.python) throw new Error('No se encontró el motor Python integrado.');
  if (!runtime.rscript) throw new Error('No se encontró el motor R integrado.');

  const backendDir = app.isPackaged ? resourcePath('backend') : path.resolve(__dirname, '..', 'backend');
  const apiFile = path.join(backendDir, 'api.py');
  if (!fs.existsSync(apiFile)) throw new Error(`No se encontró el backend: ${apiFile}`);

  const args = runtime.python === 'py' ? ['-3', apiFile] : [apiFile];
  backendProcess = spawn(runtime.python, args, {
    cwd: backendDir,
    env: {
      ...runtime.env,
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

async function injectDesktopUX(win) {
  const cssPath = path.join(__dirname, 'ux-shell.css');
  const jsPath = path.join(__dirname, 'ux-shell.js');
  const excelPath = path.join(__dirname, 'excel-import.js');
  if (fs.existsSync(cssPath)) {
    await win.webContents.insertCSS(fs.readFileSync(cssPath, 'utf8'));
  }
  if (fs.existsSync(jsPath)) {
    await win.webContents.executeJavaScript(fs.readFileSync(jsPath, 'utf8'));
  }
  if (fs.existsSync(excelPath)) {
    await win.webContents.executeJavaScript(fs.readFileSync(excelPath, 'utf8'));
  }
}

async function createWindow() {
  try {
    runtimeInfo = await ensureBundledRuntime();
    startBackend();
    await waitForBackend();
  } catch (err) {
    dialog.showErrorBox('ValiStruct Desktop Beta', `${err.message}\n\nEl instalador autónomo no pudo preparar el motor estadístico.`);
  }

  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1180,
    minHeight: 760,
    title: 'ValiStruct v3.0.0 Beta 1',
    backgroundColor: '#f4f6f8',
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
  await injectDesktopUX(win);
  win.maximize();
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
