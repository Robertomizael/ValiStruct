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

function normalizeExcelLabel(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function worksheetRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false });
}

function findAikenHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const headers = (rows[i] || []).map(normalizeExcelLabel);
    const hasCriterion = headers.includes('criterio');
    const hasJudges = headers.filter(x => /^juez\s*\d+$/.test(x)).length >= 2;
    const hasItem = headers.some(x => ['item', 'no item', 'numero item', 'numero de item'].includes(x));
    if (hasCriterion && hasJudges && hasItem) return i;
  }
  return -1;
}

function detectAikenSheet(workbook) {
  const preferred = workbook.SheetNames.find(name => /matriz[ _-]*aiken/i.test(name));
  if (preferred && findAikenHeader(worksheetRows(workbook.Sheets[preferred])) >= 0) return preferred;

  for (const name of workbook.SheetNames) {
    const rows = worksheetRows(workbook.Sheets[name]);
    if (findAikenHeader(rows) >= 0) return name;
  }
  return null;
}

function extractAikenConfig(workbook, fallbackJudges, fallbackCriteria) {
  const config = {
    judges: fallbackJudges,
    min: null,
    max: null,
    criteria: fallbackCriteria
  };
  const instructionsName = workbook.SheetNames.find(name => normalizeExcelLabel(name).includes('instrucciones'));
  if (!instructionsName) return config;

  const rows = worksheetRows(workbook.Sheets[instructionsName]);
  for (const row of rows) {
    const key = normalizeExcelLabel(row?.[0]);
    const value = row?.[1];
    if (key === 'numero de jueces') {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 2) config.judges = n;
    } else if (key === 'escala minima') {
      const n = Number(value);
      if (Number.isFinite(n)) config.min = n;
    } else if (key === 'escala maxima') {
      const n = Number(value);
      if (Number.isFinite(n)) config.max = n;
    } else if (key === 'criterios' && String(value || '').trim()) {
      config.criteria = String(value)
        .split(/[,;]+/)
        .map(x => x.trim())
        .filter(Boolean);
    }
  }
  return config;
}

function canonicalizeAikenWorkbook(workbook, sheetName) {
  const rows = worksheetRows(workbook.Sheets[sheetName]);
  const headerRow = findAikenHeader(rows);
  if (headerRow < 0) throw new Error('No se encontró una matriz compatible de V de Aiken.');

  const originalHeaders = (rows[headerRow] || []).map(x => String(x ?? '').trim());
  const normalized = originalHeaders.map(normalizeExcelLabel);
  const criterionIdx = normalized.findIndex(x => x === 'criterio');
  const itemTextIdx = normalized.findIndex(x => x === 'item');
  const itemNumberIdx = normalized.findIndex(x => ['no item', 'numero item', 'numero de item'].includes(x));
  const commentIdx = normalized.findIndex(x => /^(observacion|observaciones|comentario|comentarios|comentario cualitativo)$/.test(x));
  const judgeCols = normalized
    .map((x, idx) => {
      const m = x.match(/^juez\s*(\d+)$/);
      return m ? { idx, num: Number(m[1]) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.num - b.num);

  if (criterionIdx < 0 || judgeCols.length < 2 || (itemTextIdx < 0 && itemNumberIdx < 0)) {
    throw new Error('La hoja debe contener Ítem, Criterio y al menos dos columnas de jueces.');
  }

  const output = [[
    'Item',
    'Criterio',
    ...judgeCols.map((_, i) => `Juez${i + 1}`),
    'Comentario'
  ]];
  const criteria = [];

  for (const row of rows.slice(headerRow + 1)) {
    if (!row || !row.some(v => String(v ?? '').trim() !== '')) continue;
    const criterion = String(row[criterionIdx] ?? '').trim();
    if (!criterion) continue;

    const itemText = itemTextIdx >= 0 ? String(row[itemTextIdx] ?? '').trim() : '';
    const itemNo = itemNumberIdx >= 0 ? String(row[itemNumberIdx] ?? '').trim() : '';
    const item = itemText || (itemNo ? `Ítem ${itemNo}` : '');
    if (!item) continue;

    if (!criteria.includes(criterion)) criteria.push(criterion);
    output.push([
      item,
      criterion,
      ...judgeCols.map(col => String(row[col.idx] ?? '').trim()),
      commentIdx >= 0 ? String(row[commentIdx] ?? '').trim() : ''
    ]);
  }

  if (output.length < 2) throw new Error('La matriz de V de Aiken no contiene filas evaluadas.');

  const temp = XLSX.utils.aoa_to_sheet(output);
  const csv = XLSX.utils.sheet_to_csv(temp, { FS: ',', RS: '\n', blankrows: false });
  const config = extractAikenConfig(workbook, judgeCols.length, criteria);
  return { csv, config };
}

function buildAikenTemplateWorkbook(options = {}) {
  const judges = Math.max(2, Math.floor(Number(options.judges) || 5));
  const items = Math.max(1, Math.floor(Number(options.items) || 1));
  const min = Number.isFinite(Number(options.min)) ? Number(options.min) : 1;
  const max = Number.isFinite(Number(options.max)) && Number(options.max) > min ? Number(options.max) : 5;
  const criteria = Array.isArray(options.criteria) && options.criteria.length
    ? options.criteria.map(x => String(x).trim()).filter(Boolean)
    : ['Claridad', 'Coherencia', 'Relevancia'];
  const itemNames = Array.isArray(options.itemNames) ? options.itemNames : [];
  const responsible = String(options.responsible || 'Dr. Roberto Joel Tirado Reyes');
  const institution = String(options.institution || 'Universidad Autónoma de Sinaloa');
  const faculty = String(options.faculty || 'Facultad de Enfermería Culiacán');

  const workbook = XLSX.utils.book_new();

  const instructions = [
    [`${institution.toUpperCase()} · ${faculty.toUpperCase()}`],
    [''],
    ['JUICIO DE EXPERTOS · V DE AIKEN'],
    ['Plantilla compatible con ValiStruct para validación de contenido'],
    [''],
    ['Responsable', responsible],
    ['Propósito', 'Validación de contenido por juicio de expertos mediante V de Aiken.'],
    ['Número de jueces', judges],
    ['Escala mínima', min],
    ['Escala máxima', max],
    ['Criterios', criteria.join(', ')],
    ['Fórmula', 'V = Σ(r - lo) / [n(c - 1)]'],
    ['Referencia', 'Aiken, L. R. (1985). Educational and Psychological Measurement, 45(1), 131–142. https://doi.org/10.1177/0013164485451012'],
    [''],
    ['Puntuación', 'Interpretación general', 'Claridad', 'Coherencia/Relevancia'],
    [min, 'Nivel mínimo de cumplimiento', 'El ítem requiere revisión importante.', 'La relación con el constructo o dimensión es insuficiente.'],
    [max, 'Nivel máximo de cumplimiento', 'Redacción clara, precisa y comprensible.', 'Relación directa, pertinente y suficiente con el contenido evaluado.'],
    [''],
    ['Importante', 'No deje celdas vacías en la columna de juez que le corresponda.', `Use únicamente valores dentro del rango ${min} a ${max}.`, 'Puede agregar observaciones en la última columna.'],
    [''],
    ['INSTRUCCIONES PARA EL JUEZ'],
    [`En la hoja “Matriz_Aiken”, localice la columna correspondiente a su número de juez (Juez 1 a Juez ${judges}). Asigne una puntuación de ${min} a ${max} a cada ítem en cada criterio. No modifique el texto de los ítems, el número de ítem ni el nombre del criterio. Si considera necesario proponer un cambio, escríbalo en la columna Observaciones. Al concluir, guarde este mismo archivo .xlsx; posteriormente podrá cargarse directamente en ValiStruct para calcular la V de Aiken.`]
  ];
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  wsInstructions['!cols'] = [{ wch: 24 }, { wch: 78 }, { wch: 52 }, { wch: 52 }];
  wsInstructions['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
    { s: { r: 20, c: 0 }, e: { r: 20, c: 3 } },
    { s: { r: 21, c: 0 }, e: { r: 21, c: 3 } }
  ];
  XLSX.utils.book_append_sheet(workbook, wsInstructions, 'Instrucciones');

  const headers = ['Dimensión', 'No. ítem', 'Ítem', 'Criterio', ...Array.from({ length: judges }, (_, i) => `Juez ${i + 1}`), 'Observaciones'];
  const matrix = [headers];
  for (let i = 1; i <= items; i++) {
    const itemName = String(itemNames[i - 1] || `Ítem ${i}`).trim() || `Ítem ${i}`;
    for (const criterion of criteria) {
      matrix.push(['', i, itemName, criterion, ...Array(judges).fill(''), '']);
    }
  }
  const wsMatrix = XLSX.utils.aoa_to_sheet(matrix);
  wsMatrix['!cols'] = [
    { wch: 34 }, { wch: 10 }, { wch: 72 }, { wch: 18 },
    ...Array.from({ length: judges }, () => ({ wch: 12 })),
    { wch: 44 }
  ];
  wsMatrix['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: matrix.length - 1, c: headers.length - 1 } }) };
  XLSX.utils.book_append_sheet(workbook, wsMatrix, 'Matriz_Aiken');

  const dictionary = [
    ['Campo', 'Descripción', 'Regla para importación'],
    ['Dimensión', 'Dimensión teórica a la que pertenece el ítem.', 'Opcional para el cálculo; puede completarse sin modificar las demás columnas.'],
    ['No. ítem', 'Identificador numérico del ítem.', 'No duplicar un mismo número con textos de ítem diferentes.'],
    ['Ítem', 'Texto completo del reactivo que evaluarán los jueces.', 'No modificar después de distribuir la plantilla a jueces.'],
    ['Criterio', `Criterio de evaluación: ${criteria.join(', ')}.`, 'Debe conservar exactamente el nombre del criterio.'],
    ['Juez 1…n', `Puntuación entera entre ${min} y ${max}.`, 'No dejar vacía la columna correspondiente al juez que responde.'],
    ['Observaciones', 'Comentarios cualitativos y propuestas de modificación.', 'Texto libre; puede quedar vacío.'],
    ['Compatibilidad', 'La hoja Matriz_Aiken es leída automáticamente por ValiStruct.', 'Conservar el nombre de la hoja y los encabezados.']
  ];
  const wsDictionary = XLSX.utils.aoa_to_sheet(dictionary);
  wsDictionary['!cols'] = [{ wch: 22 }, { wch: 66 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(workbook, wsDictionary, 'Diccionario');

  return workbook;
}

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
    if (!workbook.SheetNames?.length) return { ok: false, error: 'El libro de Excel no contiene hojas.' };

    const aikenSheet = detectAikenSheet(workbook);
    if (aikenSheet) {
      const converted = canonicalizeAikenWorkbook(workbook, aikenSheet);
      return { ok: true, csv: converted.csv, sheet: aikenSheet, config: converted.config, profile: 'aiken' };
    }

    const firstSheet = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheet];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ',', RS: '\n', blankrows: false });
    if (!csv.trim()) return { ok: false, error: 'La primera hoja no contiene datos.' };
    return { ok: true, csv, sheet: firstSheet };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('valistruct:create-spreadsheet', async (_event, payload) => {
  try {
    const csv = String(payload?.csv || '').replace(/^\uFEFF/, '');
    const format = String(payload?.format || 'xlsx').toLowerCase();
    const options = payload?.options && typeof payload.options === 'object' ? payload.options : {};
    if (!csv.trim()) return { ok: false, error: 'No hay datos para exportar.' };
    if (!['xlsx', 'xls'].includes(format)) {
      return { ok: false, error: 'Formato de exportación no compatible.' };
    }

    let workbook;
    if (options.profile === 'aiken-template') {
      workbook = buildAikenTemplateWorkbook(options);
    } else {
      workbook = XLSX.read(csv, { type: 'string', raw: true });
      const firstSheet = workbook.SheetNames?.[0];
      if (!firstSheet) return { ok: false, error: 'No fue posible crear la hoja de Excel.' };
      workbook.Sheets[firstSheet]['!cols'] = Array.from({ length: 24 }, () => ({ wch: 18 }));
    }

    const bookType = format === 'xls' ? 'biff8' : 'xlsx';
    const output = XLSX.write(workbook, { type: 'buffer', bookType, compression: true });
    return { ok: true, data: new Uint8Array(output), format };
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
