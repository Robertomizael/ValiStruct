(() => {
  'use strict';

  const EXCEL_EXT = /\.(xlsx|xls)$/i;
  const CSV_EXT = /\.csv$/i;
  const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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
