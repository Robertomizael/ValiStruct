(() => {
  'use strict';

  const EXCEL_EXT = /\.(xlsx|xls)$/i;
  const CSV_EXT = /\.csv$/i;
  const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blobRegistry = new Map();
  let pendingExcelExport = null;
  let efaManualOverride = false;

  // Compatibility helper used by AFE/AFC in app.js.
  if (typeof globalThis.correlation !== 'function') {
    globalThis.correlation = function correlation(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) return NaN;
      const meanA = a.reduce((s, x) => s + Number(x), 0) / a.length;
      const meanB = b.reduce((s, x) => s + Number(x), 0) / b.length;
      let cov = 0, ssA = 0, ssB = 0;
      for (let i = 0; i < a.length; i++) {
        const da = Number(a[i]) - meanA;
        const db = Number(b[i]) - meanB;
        cov += da * db;
        ssA += da * da;
        ssB += db * db;
      }
      return ssA > 0 && ssB > 0 ? cov / Math.sqrt(ssA * ssB) : NaN;
    };
  }

  function globalEval(code) {
    try { return window.eval(code); } catch (_) { return undefined; }
  }

  const originalCreateObjectURL = URL.createObjectURL.bind(URL);
  const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => {
    const url = originalCreateObjectURL(blob);
    blobRegistry.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = url => {
    setTimeout(() => blobRegistry.delete(url), 3000);
    originalRevokeObjectURL(url);
  };

  function aikenTemplateMeta() {
    const judges = Math.max(2, Number(document.getElementById('judgeCount')?.value || 5));
    const items = Math.max(1, Number(document.getElementById('itemCount')?.value || 1));
    const min = Number(document.getElementById('scaleMin')?.value || 1);
    const max = Number(document.getElementById('scaleMax')?.value || 5);
    const criteria = [...document.querySelectorAll('.criterion-check:checked')].map(el => el.value);
    const itemNames = [];
    for (let i = 1; i <= items; i++) {
      const el = document.querySelector(`.item-name[data-item="${i}"]`);
      itemNames.push((el?.value || `Ítem ${i}`).trim() || `Ítem ${i}`);
    }
    return {
      profile: 'aiken-template', judges, items, min, max,
      criteria: criteria.length ? criteria : ['Claridad', 'Coherencia', 'Relevancia'],
      itemNames,
      institution: 'Universidad Autónoma de Sinaloa',
      faculty: 'Facultad de Enfermería Culiacán',
      responsible: 'Dr. Roberto Joel Tirado Reyes'
    };
  }

  function applySpreadsheetConfig(config) {
    if (!config) return;
    const judgeCount = document.getElementById('judgeCount');
    const scaleMin = document.getElementById('scaleMin');
    const scaleMax = document.getElementById('scaleMax');
    if (judgeCount && Number.isFinite(Number(config.judges))) judgeCount.value = Number(config.judges);
    if (scaleMin && Number.isFinite(Number(config.min))) scaleMin.value = Number(config.min);
    if (scaleMax && Number.isFinite(Number(config.max))) scaleMax.value = Number(config.max);
    if (Array.isArray(config.criteria) && config.criteria.length) {
      document.querySelectorAll('.criterion-check').forEach(el => { el.checked = config.criteria.includes(el.value); });
    }
  }

  function downloadBytes(bytes, filename, mime) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const blob = new Blob([data], { type: mime });
    const url = originalCreateObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => originalRevokeObjectURL(url), 1500);
  }

  async function downloadJudgeTemplateXlsx() {
    if (!window.valistructDesktop?.createSpreadsheet) {
      alert('La generación de plantillas XLSX está disponible en la aplicación de escritorio de ValiStruct.');
      return;
    }
    const meta = aikenTemplateMeta();
    try {
      const result = await window.valistructDesktop.createSpreadsheet('Item,Criterio,Juez1,Juez2,Comentario\n', 'xlsx', meta);
      if (!result?.ok || !result.data) throw new Error(result?.error || 'No fue posible crear la plantilla.');
      downloadBytes(result.data, `ValiStruct_Plantilla_Jueces_V_Aiken_${meta.items}_items_${meta.judges}_jueces.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (err) {
      alert(`No fue posible generar la plantilla para jueces: ${err.message}`);
    }
  }

  function ensureJudgeTemplatePanel() {
    if (document.getElementById('valistructJudgeTemplatePanel')) return;
    const aiken = document.getElementById('aiken');
    const importBox = aiken?.querySelector('.import-box');
    if (!aiken || !importBox) return;
    const panel = document.createElement('div');
    panel.id = 'valistructJudgeTemplatePanel';
    panel.className = 'import-box';
    panel.innerHTML = `<div><h3>Plantilla para juicio de expertos</h3><p>Genere el archivo <strong>.xlsx antes de realizar cualquier cálculo</strong>, entréguelo a los jueces y, cuando esté respondido, vuelva a cargar el mismo archivo en ValiStruct.</p></div><div class="button-row compact"><button id="downloadJudgeTemplateXlsx" type="button" class="primary">Generar plantilla para jueces (.xlsx)</button></div>`;
    importBox.insertAdjacentElement('beforebegin', panel);
    panel.querySelector('#downloadJudgeTemplateXlsx')?.addEventListener('click', downloadJudgeTemplateXlsx);
  }

  function clearReliabilityData() {
    globalEval('relData = null; relLast = null;');
    const input = document.getElementById('relCsvFile'); if (input) input.value = '';
    const summary = document.getElementById('relDatasetSummary'); if (summary) summary.innerHTML = '';
    const preview = document.getElementById('relDataPreview'); if (preview) preview.innerHTML = '';
    const results = document.getElementById('relResults'); if (results) results.innerHTML = '';
    const actions = document.getElementById('relActions'); if (actions) actions.classList.add('hidden');
  }

  function clearEfaData() {
    globalEval('efaData = null; efaLastResults = null;');
    const input = document.getElementById('efaCsvFile'); if (input) input.value = '';
    const summary = document.getElementById('efaDatasetSummary'); if (summary) summary.innerHTML = '';
    const preview = document.getElementById('efaDataPreview'); if (preview) preview.innerHTML = '';
    const results = document.getElementById('efaResults'); if (results) results.innerHTML = '';
    const actions = document.getElementById('efaActions'); if (actions) actions.classList.add('hidden');
    document.getElementById('valistructVarianceTable')?.remove();
    efaManualOverride = false;
  }

  function clearCfaData() {
    globalEval('cfaData = null; cfaLastResults = null;');
    const input = document.getElementById('cfaCsvFile'); if (input) input.value = '';
    const summary = document.getElementById('cfaDatasetSummary'); if (summary) summary.innerHTML = '';
    const preview = document.getElementById('cfaDataPreview'); if (preview) preview.innerHTML = '';
    const results = document.getElementById('cfaResults'); if (results) results.innerHTML = '';
    const status = document.getElementById('cfaStatus'); if (status) status.innerHTML = '';
    const actions = document.getElementById('cfaActions'); if (actions) actions.classList.add('hidden');
  }

  function addClearButton(afterId, buttonId, handler, confirmText) {
    if (document.getElementById(buttonId)) return;
    const anchor = document.getElementById(afterId);
    if (!anchor) return;
    const button = document.createElement('button');
    button.id = buttonId;
    button.type = 'button';
    button.textContent = 'Borrar datos';
    button.title = 'Borra la base, la vista previa y los resultados para cargar un archivo nuevo.';
    anchor.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      if (!confirm(confirmText)) return;
      handler();
    });
  }

  function ensureDataResetButtons() {
    addClearButton('loadRelExample', 'clearRelData', clearReliabilityData, '¿Desea borrar los datos cargados y los resultados de confiabilidad?');
    addClearButton('loadEfaExample', 'clearEfaData', clearEfaData, '¿Desea borrar los datos cargados y los resultados del AFE?');
    addClearButton('loadCfaExample', 'clearCfaData', clearCfaData, '¿Desea borrar los datos cargados y los resultados del AFC?');
  }

  function replaceVisibleTextPreservingChildren(el, nextText) {
    const textNode = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = `${nextText} `;
    else el.insertBefore(document.createTextNode(`${nextText} `), el.firstChild || null);
  }

  function hideEfaFactorQuestion() {
    const factorInput = document.getElementById('efaFactors');
    if (!factorInput) return;
    const label = factorInput.closest('label');
    if (label) label.style.display = 'none';
    if (document.getElementById('efaAutoRetentionNote')) return;
    const rotation = document.getElementById('efaRotation');
    const host = rotation?.closest('label')?.parentElement || factorInput.parentElement;
    if (!host) return;
    const note = document.createElement('div');
    note.id = 'efaAutoRetentionNote';
    note.className = 'efa-guidance';
    note.innerHTML = `<strong>Retención inicial automática</strong><br>ValiStruct no solicita un número de factores antes de explorar los datos. La primera solución usa como referencia <strong>autovalores &gt; 1</strong> y muestra además <strong>análisis paralelo, varianza total explicada y gráfica de sedimentación</strong>. La decisión final corresponde al investigador.`;
    host.appendChild(note);
  }

  function corrMatrix(matrix) {
    const k = matrix[0].length;
    const cols = Array.from({ length: k }, (_, j) => matrix.map(r => Number(r[j])));
    return Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => i === j ? 1 : globalThis.correlation(cols[i], cols[j])));
  }

  function jacobiValues(A) {
    const n = A.length;
    const M = A.map(r => r.slice());
    for (let iter = 0; iter < 120 * n * n; iter++) {
      let p = 0, q = 1, max = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const v = Math.abs(M[i][j]);
        if (v > max) { max = v; p = i; q = j; }
      }
      if (max < 1e-10) break;
      const phi = 0.5 * Math.atan2(2 * M[p][q], M[q][q] - M[p][p]);
      const c = Math.cos(phi), s = Math.sin(phi);
      const app = c*c*M[p][p] - 2*s*c*M[p][q] + s*s*M[q][q];
      const aqq = s*s*M[p][p] + 2*s*c*M[p][q] + c*c*M[q][q];
      for (let i = 0; i < n; i++) {
        if (i === p || i === q) continue;
        const aip = M[i][p], aiq = M[i][q];
        M[i][p] = M[p][i] = c*aip - s*aiq;
        M[i][q] = M[q][i] = s*aip + c*aiq;
      }
      M[p][p] = app; M[q][q] = aqq; M[p][q] = M[q][p] = 0;
    }
    return M.map((r, i) => r[i]).sort((a, b) => b - a);
  }

  function getEfaData() { return globalEval('efaData'); }
  function getEfaResults() { return globalEval('efaLastResults'); }

  function setAutomaticEfaFactors() {
    const data = getEfaData();
    const input = document.getElementById('efaFactors');
    if (!data?.matrix?.length || !input) return;
    const eig = jacobiValues(corrMatrix(data.matrix));
    const retained = Math.max(1, Math.min(data.k, eig.filter(v => v > 1).length));
    input.value = retained;
    input.dataset.autoRetained = String(retained);
  }

  function varianceTableHtml(r) {
    if (!r?.eigenvalues?.length) return '';
    const k = r.eigenvalues.length;
    let cum = 0, extCum = 0, rotCum = 0;
    const rotatedSS = Array.from({ length: r.m || 0 }, (_, f) => (r.loadings || []).reduce((s, row) => s + (Number(row[f]) || 0) ** 2, 0));
    const rows = r.eigenvalues.map((eig, i) => {
      const pct = 100 * eig / k; cum += pct;
      let ext = '', extPct = '', extC = '', rot = '', rotPct = '', rotC = '';
      if (i < r.m) {
        ext = eig.toFixed(3); extPct = pct.toFixed(2); extCum += pct; extC = extCum.toFixed(2);
        const rss = rotatedSS[i] ?? eig; const rp = 100 * rss / k; rotCum += rp;
        rot = rss.toFixed(3); rotPct = rp.toFixed(2); rotC = rotCum.toFixed(2);
      }
      return `<tr><td>${i + 1}</td><td>${eig.toFixed(3)}</td><td>${pct.toFixed(2)}</td><td>${cum.toFixed(2)}</td><td>${ext}</td><td>${extPct}</td><td>${extC}</td><td>${rot}</td><td>${rotPct}</td><td>${rotC}</td></tr>`;
    }).join('');
    return `<div id="valistructVarianceTable"><h3>Varianza total explicada</h3><p class="ci-note">La retención inicial es automática y provisional. Revise conjuntamente autovalores, porcentaje acumulado, análisis paralelo, gráfica de sedimentación e interpretación teórica.</p><div class="workspace"><table class="results-table"><thead><tr><th rowspan="2">Componente</th><th colspan="3">Autovalores iniciales</th><th colspan="3">Sumas de cargas al cuadrado de la extracción</th><th colspan="3">Sumas de cargas al cuadrado de la rotación</th></tr><tr><th>Total</th><th>% varianza</th><th>% acumulado</th><th>Total</th><th>% varianza</th><th>% acumulado</th><th>Total</th><th>% varianza</th><th>% acumulado</th></tr></thead><tbody>${rows}</tbody></table></div><div class="efa-guidance" style="margin-top:14px"><strong>Decisión posterior a la exploración</strong><br>Si, después de revisar la varianza total explicada, el scree plot, el análisis paralelo y la teoría, desea probar una solución diferente, indique el número de factores y recalcule.<div class="button-row compact" style="margin-top:10px"><input id="efaPostFactors" type="number" min="1" max="${k}" value="${r.m}" style="max-width:120px"><button id="recalculateEfaFactors" type="button">Recalcular solución factorial</button></div></div></div>`;
  }

  function enhanceEfaResults() {
    const results = document.getElementById('efaResults');
    const r = getEfaResults();
    if (!results || !r?.eigenvalues?.length) return;
    document.getElementById('valistructVarianceTable')?.remove();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = varianceTableHtml(r);
    if (wrapper.firstElementChild) results.insertAdjacentElement('afterbegin', wrapper.firstElementChild);
    const recalc = document.getElementById('recalculateEfaFactors');
    recalc?.addEventListener('click', () => {
      const n = Math.floor(Number(document.getElementById('efaPostFactors')?.value));
      const hidden = document.getElementById('efaFactors');
      if (!hidden || !Number.isInteger(n) || n < 1 || n > Number(hidden.max || 20)) return alert('Indique un número válido de factores.');
      hidden.value = n;
      efaManualOverride = true;
      document.getElementById('calculateEfa')?.click();
    });
  }

  function installDerivedColumnGuards() {
    const derived = /^(?:D\d+_media|Total_media|Total_suma)$/i;
    ['parseRelCSV', 'parseEfaCSV', 'parseCfaCSV'].forEach(fnName => {
      const current = globalThis[fnName];
      if (typeof current !== 'function' || current.__valistructDerivedFilter) return;
      const wrapped = function(text) {
        const parsed = current(text);
        if (!parsed?.itemNames || !parsed?.matrix) return parsed;
        const keep = parsed.itemNames.map((name, idx) => ({ name, idx })).filter(x => !derived.test(String(x.name || '').trim()));
        if (keep.length === parsed.itemNames.length || keep.length < 2) return parsed;
        const matrix = parsed.matrix.map(row => keep.map(x => row[x.idx]));
        return { ...parsed, itemNames: keep.map(x => x.name), matrix, n: matrix.length, k: keep.length };
      };
      wrapped.__valistructDerivedFilter = true;
      globalThis[fnName] = wrapped;
    });
  }

  function enhanceFileInputs(root = document) {
    root.querySelectorAll('input[type="file"]').forEach(input => {
      const accept = (input.getAttribute('accept') || '').toLowerCase();
      if (!accept || accept.includes('csv') || accept.includes('excel') || accept.includes('spreadsheet')) {
        input.setAttribute('accept', ACCEPT);
        input.dataset.valistructExcelEnabled = 'true';
      }
    });

    root.querySelectorAll('button, label, span, p, div').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t === 'Importar CSV') replaceVisibleTextPreservingChildren(el, 'Importar CSV / XLSX');
      else if (t === 'Archivo CSV') replaceVisibleTextPreservingChildren(el, 'Archivo CSV / XLSX');
      else if (t === 'Seleccionar CSV') replaceVisibleTextPreservingChildren(el, 'Seleccionar CSV / XLSX');
    });

    root.querySelectorAll('button[id]').forEach(button => {
      const text = (button.textContent || '').trim();
      if (!/descargar (plantilla|resultados) csv/i.test(text) || button.dataset.excelButtonsAdded === 'true') return;
      button.dataset.excelButtonsAdded = 'true';
      const xlsxBtn = document.createElement('button'); xlsxBtn.type = 'button'; xlsxBtn.className = button.className; xlsxBtn.textContent = text.replace(/CSV/i, 'Excel (.xlsx)'); xlsxBtn.dataset.excelSource = button.id; xlsxBtn.dataset.excelFormat = 'xlsx';
      const xlsBtn = document.createElement('button'); xlsBtn.type = 'button'; xlsBtn.className = button.className; xlsBtn.textContent = text.replace(/CSV/i, 'Excel 97-2003 (.xls)'); xlsBtn.dataset.excelSource = button.id; xlsBtn.dataset.excelFormat = 'xls';
      button.insertAdjacentElement('afterend', xlsBtn); button.insertAdjacentElement('afterend', xlsxBtn);
    });

    ensureJudgeTemplatePanel();
    ensureDataResetButtons();
    hideEfaFactorQuestion();
    installDerivedColumnGuards();
  }

  async function excelToCsvFile(file) {
    if (!window.valistructDesktop?.parseSpreadsheet) throw new Error('El conversor de Excel no está disponible en esta compilación de ValiStruct.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await window.valistructDesktop.parseSpreadsheet(file.name, bytes);
    if (!result?.ok || typeof result.csv !== 'string') throw new Error(result?.error || 'No fue posible leer el archivo de Excel.');
    const base = file.name.replace(/\.(xlsx|xls)$/i, '');
    return { file: new File(['\ufeff' + result.csv], `${base}.csv`, { type: 'text/csv;charset=utf-8' }), config: result.config || null, sheet: result.sheet || null };
  }

  async function exportCsvBlobAsExcel(blob, csvFilename, format, request = {}) {
    if (!window.valistructDesktop?.createSpreadsheet) throw new Error('El generador de Excel no está disponible en esta compilación de ValiStruct.');
    const csv = await blob.text();
    const options = request.sourceId === 'downloadTemplate' ? aikenTemplateMeta() : {};
    const result = await window.valistructDesktop.createSpreadsheet(csv, format, options);
    if (!result?.ok || !result.data) throw new Error(result?.error || 'No fue posible crear el archivo de Excel.');
    const ext = format === 'xls' ? 'xls' : 'xlsx';
    const mime = format === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    downloadBytes(result.data, String(csvFilename || 'ValiStruct_resultados.csv').replace(/\.csv$/i, `.${ext}`), mime);
  }

  document.addEventListener('click', event => {
    const efaButton = event.target.closest?.('#calculateEfa');
    if (efaButton) {
      if (efaManualOverride) efaManualOverride = false;
      else setAutomaticEfaFactors();
      setTimeout(enhanceEfaResults, 0);
    }

    const trigger = event.target.closest?.('button[data-excel-source]');
    if (trigger) {
      const source = document.getElementById(trigger.dataset.excelSource);
      if (!source) return;
      pendingExcelExport = { format: trigger.dataset.excelFormat || 'xlsx', sourceId: source.id };
      source.click();
      return;
    }

    const anchor = event.target.closest?.('a[download]');
    if (!anchor || !pendingExcelExport || !CSV_EXT.test(anchor.download || '')) return;
    const blob = blobRegistry.get(anchor.href); if (!blob) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const request = pendingExcelExport; pendingExcelExport = null;
    exportCsvBlobAsExcel(blob, anchor.download || 'ValiStruct_resultados.csv', request.format, request).catch(err => alert(`No fue posible exportar a Excel: ${err.message}`));
  }, true);

  document.addEventListener('change', async event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file' || input.dataset.valistructExcelEnabled !== 'true') return;
    const file = input.files?.[0];
    if (!file || CSV_EXT.test(file.name) || !EXCEL_EXT.test(file.name)) return;
    event.stopImmediatePropagation(); event.preventDefault();
    try {
      input.disabled = true;
      const converted = await excelToCsvFile(file);
      applySpreadsheetConfig(converted.config);
      const dt = new DataTransfer(); dt.items.add(converted.file); input.files = dt.files;
      input.disabled = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      input.disabled = false; input.value = '';
      alert(`No fue posible importar el archivo de Excel: ${err.message}`);
    }
  }, true);

  document.addEventListener('click', event => {
    if (event.target.closest?.('#loadEfaExample')) setTimeout(() => { setAutomaticEfaFactors(); }, 0);
  });

  enhanceFileInputs();
  const observer = new MutationObserver(() => enhanceFileInputs());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();