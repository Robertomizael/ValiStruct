(() => {
  'use strict';

  const EXCEL_EXT = /\.(xlsx|xls)$/i;
  const CSV_EXT = /\.csv$/i;
  const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blobRegistry = new Map();
  let pendingExcelExport = null;

  // Desktop compatibility bridge for statistical helpers used by app.js.
  // The AFE/AFC code calls correlation(), while the reliability module exposes corr().
  // Providing the alias here prevents the silent ReferenceError that left “Ejecutar AFE” without results.
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
      profile: 'aiken-template',
      judges,
      items,
      min,
      max,
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
      document.querySelectorAll('.criterion-check').forEach(el => {
        el.checked = config.criteria.includes(el.value);
      });
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
    const placeholder = 'Item,Criterio,Juez1,Juez2,Comentario\n';
    try {
      const result = await window.valistructDesktop.createSpreadsheet(placeholder, 'xlsx', meta);
      if (!result?.ok || !result.data) throw new Error(result?.error || 'No fue posible crear la plantilla.');
      downloadBytes(
        result.data,
        `ValiStruct_Plantilla_Jueces_V_Aiken_${meta.items}_items_${meta.judges}_jueces.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
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
    panel.innerHTML = `
      <div>
        <h3>Plantilla para juicio de expertos</h3>
        <p>Genere el archivo <strong>.xlsx antes de realizar cualquier cálculo</strong>, entréguelo a los jueces y, cuando esté respondido, vuelva a cargar el mismo archivo en ValiStruct.</p>
      </div>
      <div class="button-row compact">
        <button id="downloadJudgeTemplateXlsx" type="button" class="primary">Generar plantilla para jueces (.xlsx)</button>
      </div>`;
    importBox.insertAdjacentElement('beforebegin', panel);
    panel.querySelector('#downloadJudgeTemplateXlsx')?.addEventListener('click', downloadJudgeTemplateXlsx);
  }

  function clearReliabilityData() {
    // relData/relLast are global lexical bindings created by app.js.
    // Direct eval inherits the page global lexical environment and resets them safely.
    try {
      eval('relData = null; relLast = null;');
    } catch (_) {
      // UI reset still permits a new import; app.js will replace relData on the next load.
    }
    const input = document.getElementById('relCsvFile');
    if (input) input.value = '';
    const summary = document.getElementById('relDatasetSummary');
    const preview = document.getElementById('relDataPreview');
    const results = document.getElementById('relResults');
    const actions = document.getElementById('relActions');
    if (summary) summary.innerHTML = '';
    if (preview) preview.innerHTML = '';
    if (results) results.innerHTML = '';
    if (actions) actions.classList.add('hidden');
  }

  function ensureReliabilityClearButton() {
    if (document.getElementById('clearRelData')) return;
    const reliability = document.getElementById('reliability');
    const loadExample = document.getElementById('loadRelExample');
    if (!reliability || !loadExample) return;
    const button = document.createElement('button');
    button.id = 'clearRelData';
    button.type = 'button';
    button.textContent = 'Borrar datos';
    button.title = 'Borra la base, la vista previa y los resultados para cargar un archivo nuevo.';
    loadExample.insertAdjacentElement('afterend', button);
    button.addEventListener('click', () => {
      const hasData = Boolean(document.getElementById('relDataPreview')?.textContent.trim());
      if (hasData && !confirm('¿Desea borrar los datos cargados y los resultados de confiabilidad?')) return;
      clearReliabilityData();
    });
  }

  function installReliabilityParserGuard() {
    const current = globalThis.parseRelCSV;
    if (typeof current !== 'function' || current.__valistructDerivedFilter) return;

    const wrapped = function(text) {
      const parsed = current(text);
      const derived = /^(?:D\d+_media|Total_media|Total_suma)$/i;
      const keep = parsed.itemNames
        .map((name, idx) => ({ name, idx }))
        .filter(x => !derived.test(String(x.name || '').trim()));

      if (keep.length === parsed.itemNames.length || keep.length < 2) return parsed;
      const matrix = parsed.matrix.map(row => keep.map(x => row[x.idx]));
      return {
        itemNames: keep.map(x => x.name),
        matrix,
        n: matrix.length,
        k: keep.length
      };
    };
    wrapped.__valistructDerivedFilter = true;
    globalThis.parseRelCSV = wrapped;
  }

  function replaceVisibleTextPreservingChildren(el, nextText) {
    const textNode = [...el.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) {
      textNode.textContent = `${nextText} `;
    } else {
      el.insertBefore(document.createTextNode(`${nextText} `), el.firstChild || null);
    }
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
      if (!/descargar (plantilla|resultados) csv/i.test(text)) return;
      if (button.dataset.excelButtonsAdded === 'true') return;
      button.dataset.excelButtonsAdded = 'true';

      const xlsxBtn = document.createElement('button');
      xlsxBtn.type = 'button';
      xlsxBtn.className = button.className;
      xlsxBtn.textContent = text.replace(/CSV/i, 'Excel (.xlsx)');
      xlsxBtn.dataset.excelSource = button.id;
      xlsxBtn.dataset.excelFormat = 'xlsx';

      const xlsBtn = document.createElement('button');
      xlsBtn.type = 'button';
      xlsBtn.className = button.className;
      xlsBtn.textContent = text.replace(/CSV/i, 'Excel 97-2003 (.xls)');
      xlsBtn.dataset.excelSource = button.id;
      xlsBtn.dataset.excelFormat = 'xls';

      button.insertAdjacentElement('afterend', xlsBtn);
      button.insertAdjacentElement('afterend', xlsxBtn);
    });

    ensureJudgeTemplatePanel();
    ensureReliabilityClearButton();
    installReliabilityParserGuard();
  }

  async function excelToCsvFile(file) {
    if (!window.valistructDesktop?.parseSpreadsheet) {
      throw new Error('El conversor de Excel no está disponible en esta compilación de ValiStruct.');
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await window.valistructDesktop.parseSpreadsheet(file.name, bytes);
    if (!result?.ok || typeof result.csv !== 'string') {
      throw new Error(result?.error || 'No fue posible leer el archivo de Excel.');
    }
    const base = file.name.replace(/\.(xlsx|xls)$/i, '');
    return {
      file: new File(['\ufeff' + result.csv], `${base}.csv`, { type: 'text/csv;charset=utf-8' }),
      config: result.config || null,
      sheet: result.sheet || null
    };
  }

  async function exportCsvBlobAsExcel(blob, csvFilename, format, request = {}) {
    if (!window.valistructDesktop?.createSpreadsheet) {
      throw new Error('El generador de Excel no está disponible en esta compilación de ValiStruct.');
    }
    const csv = await blob.text();
    const options = request.sourceId === 'downloadTemplate' ? aikenTemplateMeta() : {};
    const result = await window.valistructDesktop.createSpreadsheet(csv, format, options);
    if (!result?.ok || !result.data) {
      throw new Error(result?.error || 'No fue posible crear el archivo de Excel.');
    }
    const ext = format === 'xls' ? 'xls' : 'xlsx';
    const mime = format === 'xls'
      ? 'application/vnd.ms-excel'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const filename = String(csvFilename || 'ValiStruct_resultados.csv').replace(/\.csv$/i, `.${ext}`);
    downloadBytes(result.data, filename, mime);
  }

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.('button[data-excel-source]');
    if (trigger) {
      const source = document.getElementById(trigger.dataset.excelSource);
      if (!source) return;
      pendingExcelExport = {
        format: trigger.dataset.excelFormat || 'xlsx',
        sourceId: source.id
      };
      source.click();
      return;
    }

    const anchor = event.target.closest?.('a[download]');
    if (!anchor || !pendingExcelExport) return;
    const filename = anchor.download || '';
    if (!CSV_EXT.test(filename)) return;

    const blob = blobRegistry.get(anchor.href);
    if (!blob) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const request = pendingExcelExport;
    pendingExcelExport = null;

    exportCsvBlobAsExcel(blob, filename, request.format, request).catch(err => {
      alert(`No fue posible exportar a Excel: ${err.message}`);
    });
  }, true);

  document.addEventListener('change', async event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    if (input.dataset.valistructExcelEnabled !== 'true') return;

    const file = input.files?.[0];
    if (!file || CSV_EXT.test(file.name) || !EXCEL_EXT.test(file.name)) return;

    event.stopImmediatePropagation();
    event.preventDefault();

    try {
      input.disabled = true;
      const converted = await excelToCsvFile(file);
      applySpreadsheetConfig(converted.config);
      const dt = new DataTransfer();
      dt.items.add(converted.file);
      input.files = dt.files;
      input.disabled = false;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      input.disabled = false;
      input.value = '';
      alert(`No fue posible importar el archivo de Excel: ${err.message}`);
    }
  }, true);

  enhanceFileInputs();
  const observer = new MutationObserver(() => enhanceFileInputs());
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
