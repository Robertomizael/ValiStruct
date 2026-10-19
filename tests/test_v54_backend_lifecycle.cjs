'use strict';
/*
 * M3 · ciclo de vida del backend de escritorio (procesos reales, sin Electron).
 * Simula un backend ValiStruct huérfano, un programa ajeno en el puerto y el
 * backend de la sesión actual. Usa un puerto de prueba para no interferir con
 * una instalación real.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const lifecycle = require('../desktop/backend-lifecycle.js');

const PORT = 18765;
const HOST = '127.0.0.1';

function fakeServer(dir, file, versionJson) {
  fs.mkdirSync(dir, { recursive: true });
  const script = path.join(dir, file);
  fs.writeFileSync(script, `
    const http = require('http');
    http.createServer((req, res) => {
      if (req.url === '/version') { res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify(${JSON.stringify(versionJson)})); }
      if (req.url === '/health') { res.setHeader('Content-Type','application/json'); return res.end('{"ok":true}'); }
      res.statusCode = 404; res.setHeader('Content-Type','text/html'); res.end('<!doctype html><title>404</title>');
    }).listen(${PORT}, '${HOST}');
  `);
  return spawn(process.execPath, [script], { stdio: 'ignore' });
}

async function waitOpen(open = true, ms = 5000) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    if ((await lifecycle.isPortOpen({ host: HOST, port: PORT })) === open) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-m3-'));

test('identifica la línea de comandos del backend de ValiStruct', () => {
  assert.equal(lifecycle.isValiStructBackendCommand('/Users/x/.valistruct/runtime-v2/bin/python3 /Applications/ValiStruct.app/Contents/Resources/backend/api.py'), true);
  assert.equal(lifecycle.isValiStructBackendCommand('"C:\\Users\\x\\AppData\\Roaming\\ValiStruct\\runtime-v2\\python.exe" "C:\\Program Files\\ValiStruct\\resources\\backend\\api.py"'), true);
  assert.equal(lifecycle.isValiStructBackendCommand('python3 -m http.server 8765'), false);
  assert.equal(lifecycle.isValiStructBackendCommand('python3 /srv/otra-app/api.py'), false);
  assert.equal(lifecycle.isValiStructBackendCommand('python3 /srv/valistruct/api.pyc'), false);
});

test('puerto libre: no hace nada', async () => {
  const r = await lifecycle.ensurePortAvailable({ host: HOST, port: PORT, log: () => {} });
  assert.deepEqual(r, { status: 'free' });
});

test('backend ValiStruct huérfano: se identifica, se cierra y se libera el puerto', async () => {
  const orphan = fakeServer(path.join(tmp, 'ValiStruct.app', 'backend'), 'api.py',
    { ok: true, app: 'ValiStruct', version: '3.0.0-rc.6' });
  assert.ok(await waitOpen(true), 'el huérfano simulado debe escuchar');
  const r = await lifecycle.ensurePortAvailable({ host: HOST, port: PORT, log: () => {} });
  assert.equal(r.status, 'reclaimed');
  assert.equal(r.pid, orphan.pid);
  assert.ok(await waitOpen(false), 'el puerto debe quedar libre');
});

test('programa ajeno en el puerto: no se cierra y se informa', async () => {
  const foreign = fakeServer(path.join(tmp, 'otra'), 'servidor.js', { ok: true, app: 'OtraApp' });
  try {
    assert.ok(await waitOpen(true));
    await assert.rejects(lifecycle.ensurePortAvailable({ host: HOST, port: PORT, log: () => {} }), /ocupado por otro programa/);
    assert.equal(foreign.exitCode, null, 'el proceso ajeno debe seguir vivo');
  } finally {
    foreign.kill('SIGKILL');
    await waitOpen(false);
  }
});

test('proceso que dice ser ValiStruct pero no ejecuta su backend: no se cierra', async () => {
  const impostor = fakeServer(path.join(tmp, 'otra2'), 'servidor.js', { ok: true, app: 'ValiStruct' });
  try {
    assert.ok(await waitOpen(true));
    await assert.rejects(lifecycle.ensurePortAvailable({ host: HOST, port: PORT, log: () => {} }), /ocupado por otro programa/);
    assert.equal(impostor.exitCode, null);
  } finally {
    impostor.kill('SIGKILL');
    await waitOpen(false);
  }
});

test('solo se acepta el backend de esta instancia', async () => {
  const other = fakeServer(path.join(tmp, 'ValiStruct2', 'backend'), 'api.py',
    { ok: true, app: 'ValiStruct', instance_id: 'instancia-anterior' });
  try {
    assert.ok(await waitOpen(true));
    await assert.rejects(
      lifecycle.waitForInstance('instancia-actual', { host: HOST, port: PORT, timeoutMs: 1500 }),
      /no corresponde a esta sesión/);
    await lifecycle.waitForInstance('instancia-anterior', { host: HOST, port: PORT, timeoutMs: 3000 });
  } finally {
    other.kill('SIGKILL');
    await waitOpen(false);
  }
});

test('si el proceso hijo termina durante el arranque, falla de inmediato', async () => {
  const started = Date.now();
  await assert.rejects(
    lifecycle.waitForInstance('x', { host: HOST, port: PORT, timeoutMs: 10000, childExited: () => true }),
    /se detuvo durante el arranque/);
  assert.ok(Date.now() - started < 2000);
});

test('main.js usa el ciclo de vida M3 y conserva el token de sesión', () => {
  const main = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'package.json'), 'utf8'));
  assert.ok(main.includes("require('./backend-lifecycle.js')"));
  assert.ok(main.includes('app.requestSingleInstanceLock()'));
  assert.ok(main.includes('await backendLifecycle.ensurePortAvailable()'));
  assert.ok(main.includes('VALISTRUCT_DESKTOP_INSTANCE_ID: backendInstanceId'));
  assert.ok(main.includes("app.on('before-quit', stopBackend)"));
  assert.ok(main.includes("app.on('will-quit', stopBackend)"));
  assert.ok(main.includes('VALISTRUCT_DESKTOP_SESSION_TOKEN: desktopSessionToken'));
  assert.ok(pkg.build.files.includes('backend-lifecycle.js'));
});
