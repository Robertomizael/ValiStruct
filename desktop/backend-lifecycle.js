'use strict';

/*
 * ValiStruct v5.4 · M3: ciclo de vida del backend de escritorio.
 *
 * Módulo de Node puro (sin Electron) para poder probarlo de forma aislada.
 * Objetivos:
 *   1. Antes de arrancar, detectar si 127.0.0.1:8765 ya está ocupado.
 *   2. Terminar solo un backend ValiStruct huérfano, identificado por dos
 *      señales independientes: /version responde app = "ValiStruct" y la línea
 *      de comandos del proceso que escucha el puerto ejecuta backend/api.py de
 *      ValiStruct. Un proceso ajeno nunca se termina.
 *   3. Aceptar como listo únicamente el backend de esta instancia
 *      (instance_id de /version), no cualquier proceso que responda.
 *   4. Terminar el proceso hijo al salir.
 * No interviene en ningún cálculo estadístico.
 */

const http = require('http');
const net = require('net');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const BACKEND_HOST = '127.0.0.1';
const BACKEND_PORT = 8765;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function newInstanceId() {
  return crypto.randomBytes(16).toString('hex');
}

function getJson(pathname, { host = BACKEND_HOST, port = BACKEND_PORT, timeoutMs = 1500 } = {}) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: pathname }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) { json = null; }
        resolve({ status: res.statusCode || 0, json, body });
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(null); });
  });
}

function isPortOpen({ host = BACKEND_HOST, port = BACKEND_PORT, timeoutMs = 800 } = {}) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open) => { socket.destroy(); resolve(open); };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(timeoutMs, () => done(false));
  });
}

function findListeningPid(port = BACKEND_PORT, platform = process.platform) {
  try {
    if (platform === 'win32') {
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)`],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      const pid = parseInt(String(r.stdout || '').trim(), 10);
      return Number.isInteger(pid) && pid > 0 ? pid : null;
    }
    const r = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', timeout: 15000 });
    const pid = parseInt(String(r.stdout || '').split(/\s+/).find(Boolean) || '', 10);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch (_) {
    return null;
  }
}

function processCommandLine(pid, platform = process.platform) {
  if (!Number.isInteger(pid) || pid <= 0) return '';
  try {
    if (platform === 'win32') {
      const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`],
        { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      return String(r.stdout || '').trim();
    }
    const r = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8', timeout: 15000 });
    return String(r.stdout || '').trim();
  } catch (_) {
    return '';
  }
}

function isValiStructBackendCommand(commandLine) {
  const cmd = String(commandLine || '').replace(/\\/g, '/').toLowerCase();
  return /(^|[\s/"'])api\.py(["'\s]|$)/.test(cmd) && cmd.includes('valistruct');
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (err) { return err && err.code === 'EPERM'; }
}

async function stopPid(pid, { platform = process.platform, graceMs = 4000 } = {}) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  if (platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 15000 });
    return;
  }
  try { process.kill(pid, 'SIGTERM'); } catch (_) { return; }
  const started = Date.now();
  while (processAlive(pid) && Date.now() - started < graceMs) await sleep(100);
  if (processAlive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
}

/*
 * Devuelve { status: 'free' } o { status: 'reclaimed', pid }.
 * Lanza un error comprensible si el puerto lo ocupa un proceso que no se
 * puede identificar como backend de ValiStruct.
 */
async function ensurePortAvailable({ port = BACKEND_PORT, host = BACKEND_HOST, platform = process.platform, log = console.log } = {}) {
  if (!(await isPortOpen({ host, port }))) return { status: 'free' };

  const version = await getJson('/version', { host, port });
  const pid = findListeningPid(port, platform);
  const commandLine = processCommandLine(pid, platform);
  const isValiStruct = version?.json?.app === 'ValiStruct' && isValiStructBackendCommand(commandLine);

  if (!isValiStruct) {
    throw new Error(`El puerto ${port} está ocupado por otro programa${pid ? ` (PID ${pid})` : ''}. ` +
      'ValiStruct no lo cerrará porque no puede identificarlo como su propio motor. ' +
      'Cierre ese programa o reinicie el equipo y vuelva a abrir ValiStruct.');
  }

  log(`[ValiStruct] Backend huérfano detectado en el puerto ${port} (PID ${pid}, versión ${version.json.version || 'desconocida'}). Se cierra antes de iniciar el motor de esta sesión.`);
  await stopPid(pid, { platform });
  const started = Date.now();
  while (await isPortOpen({ host, port })) {
    if (Date.now() - started > 8000) {
      throw new Error(`No fue posible liberar el puerto ${port} ocupado por un motor anterior de ValiStruct (PID ${pid}).`);
    }
    await sleep(200);
  }
  return { status: 'reclaimed', pid };
}

/*
 * Espera a que responda el backend de ESTA instancia (instance_id) y, después,
 * a que /health responda como antes (< 500). Falla de inmediato si el proceso
 * hijo termina.
 */
async function waitForInstance(instanceId, { host = BACKEND_HOST, port = BACKEND_PORT, timeoutMs = 45000, childExited = () => false } = {}) {
  const started = Date.now();
  let identified = false;
  while (Date.now() - started <= timeoutMs) {
    if (childExited()) throw new Error('El motor estadístico de ValiStruct se detuvo durante el arranque.');
    if (!identified) {
      const v = await getJson('/version', { host, port });
      if (v?.json && v.json.instance_id === instanceId) identified = true;
      else if (v?.json && v.json.app) {
        // Responde un backend, pero no el de esta sesión: se sigue esperando
        // hasta el límite y nunca se usa en silencio.
      }
    }
    if (identified) {
      const h = await getJson('/health', { host, port, timeoutMs: 35000 });
      if (h && h.status > 0 && h.status < 500) return;
    }
    await sleep(700);
  }
  throw new Error(identified ? 'Backend no disponible' : 'El motor que responde en el puerto 8765 no corresponde a esta sesión de ValiStruct.');
}

module.exports = {
  BACKEND_HOST,
  BACKEND_PORT,
  newInstanceId,
  getJson,
  isPortOpen,
  findListeningPid,
  processCommandLine,
  isValiStructBackendCommand,
  stopPid,
  ensurePortAvailable,
  waitForInstance
};
