(() => {
  'use strict';

  const EXCEL_EXT = /\.(xlsx|xls)$/i;
  const CSV_EXT = /\.csv$/i;
  const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blobRegistry = new Map();
  let pendingExcelExport = null;

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

  function enhanceFileInputs(root = document) {
    root.querySelectorAll('input[type="file"]').forEach(input => {
      const accept = (input.getAttribute('accept') || '').toLowerCase();
      if (!accept || accept.includes('csv') || accept.includes('excel') || accept.includes('spreadsheet')) {
        input.setAttribute('accept', ACCEPT);
        input.dataset.valistructExcelEnabled = 'true';
      }
    });

    root.querySelectorAll('button, label, span, p, div').forEach(el => {
      if (el.children.length) return;
      const t = (el.textContent || '').trim();
      if (t === 'Importar CSV') el.textContent = 'Importar CSV / Excel';
      else if (t === 'Archivo CSV') el.textContent = 'Archivo CSV / Excel';
      else if (t === 'Seleccionar CSV') el.textContent = 'Seleccionar CSV / Excel';
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
    return new File(['\ufeff' + result.csv], `${base}.csv`, { type: 'text/csv;charset=utf-8' });
  }

  async function exportCsvBlobAsExcel(blob, csvFilename, format) {
    if (!window.valistructDesktop?.createSpreadsheet) {
      throw new Error('El generador de Excel no está disponible en esta compilación de ValiStruct.');
    }
    const csv = await blob.text();
    const result = await window.valistructDesktop.createSpreadsheet(csv, format);
    if (!result?.ok || !result.data) {
      throw new Error(result?.error || 'No fue posible crear el archivo de Excel.');
    }
    const ext = format === 'xls' ? 'xls' : 'xlsx';
    const mime = format === 'xls'
      ? 'application/vnd.ms-excel'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const filename = String(csvFilename || 'ValiStruct_resultados.csv').replace(/\.csv$/i, `.${ext}`);
    const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
    const excelBlob = new Blob([bytes], { type: mime });
    const url = originalCreateObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => originalRevokeObjectURL(url), 1500);
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

    exportCsvBlobAsExcel(blob, filename, request.format).catch(err => {
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
      const csvFile = await excelToCsvFile(file);
      const dt = new DataTransfer();
      dt.items.add(csvFile);
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
