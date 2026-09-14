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
  createSpreadsheet: async (csv, format = 'xlsx', options = {}) => {
    return ipcRenderer.invoke('valistruct:create-spreadsheet', { csv, format, options });
  }
});

// AFC diagnostic assistant: Mardia + estimator guidance.
// This runs in the isolated preload world and does not alter the page's statistical state.
(() => {
  let lastCfaCsvFile = null;

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], next = text[i + 1];
      if (quoted) {
        if (ch === '"' && next === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (ch !== '\r') cell += ch;
      }
    }
    row.push(cell);
    if (row.some(x => String(x).trim() !== '')) rows.push(row);
    return rows;
  }

  function cleanMatrix(rows) {
    if (rows.length < 3) throw new Error('Se requieren encabezados y al menos dos casos.');
    let headers = rows[0].map(x => String(x).trim());
    let body = rows.slice(1).filter(r => r.some(x => String(x).trim() !== ''));

    let keepIdx = headers.map((h, i) => ({ h, i }));
    if (/^(id|idem|folio|participante|sujeto|caso)$/i.test(headers[0] || '')) keepIdx = keepIdx.slice(1);
    const derived = /^(?:D\d+_media|Total_media|Total_suma)$/i;
    keepIdx = keepIdx.filter(x => !derived.test(x.h));

    const numericCols = [];
    for (const col of keepIdx) {
      const vals = body.map(r => Number(String(r[col.i] ?? '').trim()));
      const finite = vals.filter(Number.isFinite);
      if (finite.length >= Math.max(3, Math.floor(body.length * .8))) numericCols.push({ name: col.h, i: col.i });
    }
    if (numericCols.length < 2) throw new Error('No se identificaron al menos dos variables numéricas para el diagnóstico.');

    const matrix = [];
    for (const r of body) {
      const vals = numericCols.map(c => Number(String(r[c.i] ?? '').trim()));
      if (vals.every(Number.isFinite)) matrix.push(vals);
    }
    if (matrix.length < 5) throw new Error('Hay menos de cinco casos completos para el diagnóstico multivariante.');
    return { headers: numericCols.map(x => x.name), matrix, n: matrix.length, p: numericCols.length };
  }

  function transpose(A) { return A[0].map((_, j) => A.map(r => r[j])); }
  function multiply(A, B) {
    return A.map(row => B[0].map((_, j) => row.reduce((s, x, i) => s + x * B[i][j], 0)));
  }
  function inverse(A) {
    const n = A.length;
    const M = A.map((r, i) => r.slice().concat(Array.from({ length: n }, (_, j) => i === j ? 1 : 0)));
    for (let c = 0; c < n; c++) {
      let pivot = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
      if (Math.abs(M[pivot][c]) < 1e-12) return null;
      [M[c], M[pivot]] = [M[pivot], M[c]];
      const d = M[c][c];
      for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
      }
    }
    return M.map(r => r.slice(n));
  }

  function logGamma(z) {
    const p = [0.9999999999998099,676.5203681218851,-1259.1392167224028,771.3234287776531,-176.6150291621406,12.5073432786869,-0.1385710952657201,9.984369578019572e-6,1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
    z -= 1;
    let x = p[0];
    for (let i = 1; i < p.length; i++) x += p[i] / (z + i);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function gammaQ(a, x) {
    if (!(x >= 0) || !(a > 0)) return NaN;
    if (x === 0) return 1;
    const ITMAX = 200, EPS = 3e-12, FPMIN = 1e-300;
    if (x < a + 1) {
      let ap = a, del = 1 / a, sum = del;
      for (let n = 1; n <= ITMAX; n++) {
        ap += 1; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * EPS) break;
      }
      const P = sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
      return Math.max(0, Math.min(1, 1 - P));
    }
    let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
    for (let i = 1; i <= ITMAX; i++) {
      const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; const del = d * c; h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return Math.max(0, Math.min(1, Math.exp(-x + a * Math.log(x) - logGamma(a)) * h));
  }
  function erf(x) {
    const sign = x < 0 ? -1 : 1, a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
    return sign * y;
  }
  function normalCdf(x) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }

  function isOrdinalMatrix(matrix) {
    const p = matrix[0].length;
    for (let j = 0; j < p; j++) {
      const vals = matrix.map(r => r[j]);
      const uniq = [...new Set(vals)];
      if (uniq.length < 2 || uniq.length > 7 || uniq.some(v => Math.abs(v - Math.round(v)) > 1e-10)) return false;
    }
    return true;
  }

  function mardia(matrix) {
    const n = matrix.length, p = matrix[0].length;
    if (n <= p) throw new Error(`Mardia requiere una matriz de covarianzas invertible; actualmente n=${n} y p=${p}. Se recomienda n > p.`);
    const means = Array.from({ length: p }, (_, j) => matrix.reduce((s, r) => s + r[j], 0) / n);
    const Z = matrix.map(r => r.map((x, j) => x - means[j]));
    const S = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => Z.reduce((s, r) => s + r[i] * r[j], 0) / n));
    const Sinv = inverse(S);
    if (!Sinv) throw new Error('La matriz de covarianzas es singular; no es posible calcular Mardia con seguridad.');
    const B = multiply(Z, Sinv);
    let sumCube = 0, sumDiagSq = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let aij = 0;
        for (let k = 0; k < p; k++) aij += B[i][k] * Z[j][k];
        sumCube += aij * aij * aij;
        if (i === j) sumDiagSq += aij * aij;
      }
    }
    const b1p = sumCube / (n * n);
    const skewStat = n * b1p / 6;
    const skewDf = p * (p + 1) * (p + 2) / 6;
    const skewP = gammaQ(skewDf / 2, skewStat / 2);
    const b2p = sumDiagSq / n;
    const expected = p * (p + 2);
    const kurtZ = (b2p - expected) / Math.sqrt(8 * p * (p + 2) / n);
    const kurtP = 2 * (1 - normalCdf(Math.abs(kurtZ)));
    return { n, p, b1p, skewStat, skewDf, skewP, b2p, expected, kurtZ, kurtP, normal: skewP >= .05 && kurtP >= .05 };
  }

  function ensurePanel() {
    if (document.getElementById('cfaMardiaPanel')) return;
    const cfa = document.getElementById('cfa');
    const importBox = cfa?.querySelector('.import-box');
    if (!cfa || !importBox) return;
    const panel = document.createElement('div');
    panel.id = 'cfaMardiaPanel';
    panel.className = 'workspace';
    panel.style.marginTop = '18px';
    panel.innerHTML = `
      <h3>Diagnóstico previo al AFC · normalidad multivariante y estimador</h3>
      <p>ValiStruct evalúa la <strong>prueba de Mardia</strong> cuando es apropiada y orienta la elección del estimador. Para ítems ordinales, el nivel de medición tiene prioridad sobre una prueba de normalidad.</p>
      <div class="config-grid">
        <label>Tipo de indicadores
          <select id="cfaIndicatorType">
            <option value="auto" selected>Detectar automáticamente</option>
            <option value="ordinal">Ordinales / Likert</option>
            <option value="continuous">Continuos</option>
          </select>
        </label>
      </div>
      <div class="button-row compact"><button id="runCfaMardia" type="button">Calcular Mardia y recomendar estimador</button></div>
      <div id="cfaMardiaResults" class="ci-note" style="margin-top:12px">Cargue una matriz para iniciar el diagnóstico.</div>
      <p class="ci-note"><strong>Aclaración:</strong> “ortogonal” no es un estimador de AFC. Ortogonal/oblicua describe la rotación en AFE. En AFC, la elección habitual es entre ML, MLR, WLSMV u otros estimadores según el nivel de medición y los supuestos.</p>`;
    importBox.insertAdjacentElement('afterend', panel);
    panel.querySelector('#runCfaMardia')?.addEventListener('click', () => {
      if (!lastCfaCsvFile) return alert('Primero cargue un archivo CSV/XLSX en AFC.');
      analyzeFile(lastCfaCsvFile);
    });
  }

  function pFmt(v) { return !Number.isFinite(v) ? '—' : v < .001 ? '< .001' : '= ' + v.toFixed(3); }

  async function analyzeFile(file) {
    ensurePanel();
    const out = document.getElementById('cfaMardiaResults');
    if (!out) return;
    try {
      const text = (await file.text()).replace(/^\uFEFF/, '');
      const data = cleanMatrix(parseCsv(text));
      const selected = document.getElementById('cfaIndicatorType')?.value || 'auto';
      const autoOrdinal = isOrdinalMatrix(data.matrix);
      const dataType = selected === 'auto' ? (autoOrdinal ? 'ordinal' : 'continuous') : selected;
      let m = null, mError = null;
      try { m = mardia(data.matrix); } catch (e) { mError = e.message; }

      let estimator, reason;
      if (dataType === 'ordinal') {
        estimator = 'WLSMV';
        reason = 'Los indicadores se consideran ordinales. La recomendación se basa en el nivel de medición; Mardia no debe utilizarse para forzar ML en ítems Likert.';
      } else if (m && m.normal) {
        estimator = 'ML';
        reason = 'Para indicadores continuos, Mardia no detecta evidencia de no normalidad multivariante al nivel .05. ML es una opción defendible si no hay otros problemas relevantes.';
      } else {
        estimator = 'MLR';
        reason = 'Para indicadores continuos, la normalidad multivariante no está apoyada o no pudo verificarse con seguridad. Se recomienda máxima verosimilitud robusta (MLR).';
      }

      const mardiaHtml = m ? `
        <div class="result-cards" style="margin-top:12px">
          <div class="result-card"><span>Mardia · asimetría</span><strong>${m.b1p.toFixed(3)}</strong><small>χ²(${Math.round(m.skewDf)}) ${pFmt(m.skewP)}</small></div>
          <div class="result-card"><span>Mardia · curtosis</span><strong>${m.b2p.toFixed(3)}</strong><small>z=${m.kurtZ.toFixed(3)}; p ${pFmt(m.kurtP)}</small></div>
          <div class="result-card ${m.normal ? 'good-bg' : 'warn-bg'}"><span>Normalidad multivariante</span><strong>${m.normal ? 'Compatible' : 'No apoyada'}</strong></div>
          <div class="result-card good-bg"><span>Estimador recomendado</span><strong>${estimator}</strong></div>
        </div>` : `<div class="model-error"><strong>Mardia no calculable:</strong> ${mError || 'no disponible'}.</div>`;

      out.innerHTML = `<p><strong>Casos completos:</strong> ${data.n} · <strong>Variables:</strong> ${data.p} · <strong>Tipo detectado:</strong> ${autoOrdinal ? 'ordinal/categórico ordenado' : 'continuo o con muchas categorías'}.</p>${mardiaHtml}<p><strong>Orientación:</strong> ${reason}</p><p class="ci-note">La recomendación es metodológica, no una decisión automática. Para escalas Likert de 5 categorías, WLSMV suele ser preferible en AFC cuando los ítems se modelan explícitamente como ordinales.</p>`;
    } catch (err) {
      out.innerHTML = `<div class="model-error"><strong>No fue posible calcular el diagnóstico:</strong> ${String(err.message || err)}</div>`;
    }
  }

  function revisePrototypeNotice() {
    const cfa = document.getElementById('cfa');
    if (!cfa) return;
    cfa.querySelectorAll('p,div').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t.includes('CFI, TLI, RMSEA') && t.includes('no se reportan')) {
        el.innerHTML = '<strong>Nota:</strong> el motor R/lavaan de ValiStruct ya está preparado para estimar χ², CFI, TLI, RMSEA, SRMR y versiones robustas según el estimador. Esta vista rápida del AFC sigue siendo un prototipo; para resultados finales use el motor de producción y el estimador recomendado por el diagnóstico previo.';
      }
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    ensurePanel();
    revisePrototypeNotice();
    const obs = new MutationObserver(() => { ensurePanel(); revisePrototypeNotice(); });
    obs.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('change', event => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.id !== 'cfaCsvFile') return;
      const file = input.files?.[0];
      if (!file) return;
      if (/\.csv$/i.test(file.name)) {
        lastCfaCsvFile = file;
        setTimeout(() => analyzeFile(file), 80);
      }
    }, true);
  });
})();
