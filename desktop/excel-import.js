(() => {
  'use strict';

  const EXCEL_EXT = /\.(xlsx|xls)$/i;
  const CSV_EXT = /\.csv$/i;
  const ACCEPT = '.csv,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blobRegistry = new Map();
  let pendingExcelExport = null;
  let efaManualOverride = false;
  let lastStatAction = null;

  // ---------------------------------------------------------------------------
  // Statistical compatibility layer for AFE/AFC in app.js
  // ---------------------------------------------------------------------------
  const numericMean = a => a.reduce((s, x) => s + Number(x), 0) / a.length;
  const numericVariance = a => {
    if (!Array.isArray(a) || a.length < 2) return NaN;
    const m = numericMean(a);
    return a.reduce((s, x) => s + (Number(x) - m) ** 2, 0) / (a.length - 1);
  };

  if (typeof globalThis.mean !== 'function') globalThis.mean = numericMean;
  if (typeof globalThis.variance !== 'function') globalThis.variance = numericVariance;

  if (typeof globalThis.correlation !== 'function') {
    globalThis.correlation = function correlation(a, b) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length < 2) return NaN;
      const ma = numericMean(a), mb = numericMean(b);
      let cov = 0, sa = 0, sb = 0;
      for (let i = 0; i < a.length; i++) {
        const da = Number(a[i]) - ma, db = Number(b[i]) - mb;
        cov += da * db; sa += da * da; sb += db * db;
      }
      return sa > 0 && sb > 0 ? cov / Math.sqrt(sa * sb) : NaN;
    };
  }

  // Symmetric Jacobi eigendecomposition. app.js expects:
  // { values: descending eigenvalues, vectors: list of corresponding eigenvectors }.
  if (typeof globalThis.jacobiEigen !== 'function') {
    globalThis.jacobiEigen = function jacobiEigen(A) {
      if (!Array.isArray(A) || !A.length || A.some(r => !Array.isArray(r) || r.length !== A.length)) {
        throw new Error('La matriz para descomposición espectral no es cuadrada.');
      }
      const n = A.length;
      const M = A.map(r => r.map(Number));
      const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
      const maxIter = Math.max(80, 120 * n * n);

      for (let iter = 0; iter < maxIter; iter++) {
        let p = 0, q = 1, max = 0;
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const v = Math.abs(M[i][j]);
            if (v > max) { max = v; p = i; q = j; }
          }
        }
        if (max < 1e-11) break;
        const app = M[p][p], aqq = M[q][q], apq = M[p][q];
        const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
        const c = Math.cos(phi), s = Math.sin(phi);

        for (let i = 0; i < n; i++) {
          if (i === p || i === q) continue;
          const mip = M[i][p], miq = M[i][q];
          M[i][p] = M[p][i] = c * mip - s * miq;
          M[i][q] = M[q][i] = s * mip + c * miq;
        }
        M[p][p] = c*c*app - 2*s*c*apq + s*s*aqq;
        M[q][q] = s*s*app + 2*s*c*apq + c*c*aqq;
        M[p][q] = M[q][p] = 0;

        for (let i = 0; i < n; i++) {
          const vip = V[i][p], viq = V[i][q];
          V[i][p] = c * vip - s * viq;
          V[i][q] = s * vip + c * viq;
        }
      }

      const pairs = Array.from({ length: n }, (_, j) => ({
        value: M[j][j],
        vector: Array.from({ length: n }, (_, i) => V[i][j])
      })).sort((a, b) => b.value - a.value);
      return { values: pairs.map(x => x.value), vectors: pairs.map(x => x.vector) };
    };
  }

  function globalEval(code) {
    try { return window.eval(code); } catch (_) { return undefined; }
  }

  function statErrorMessage(err) {
    const msg = err?.message || String(err || 'Error desconocido');
    return `No fue posible completar el ${lastStatAction || 'análisis'}. ${msg}`;
  }

  window.addEventListener('error', event => {
    if (!lastStatAction) return;
    const msg = event?.error?.message || event?.message || '';
    if (!msg) return;
    const action = lastStatAction;
    lastStatAction = null;
    setTimeout(() => alert(`ValiStruct detectó un error durante ${action}: ${msg}`), 0);
  });

  // ---------------------------------------------------------------------------
  // Excel import/export bridge
  // ---------------------------------------------------------------------------
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

  function downloadBytes(bytes, filename, mime) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const blob = new Blob([data], { type: mime });
    const url = originalCreateObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => originalRevokeObjectURL(url), 1500);
  }

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

  async function excelToCsvFile(file) {
    if (!window.valistructDesktop?.parseSpreadsheet) throw new Error('El conversor de Excel no está disponible.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await window.valistructDesktop.parseSpreadsheet(file.name, bytes);
    if (!result?.ok || typeof result.csv !== 'string') throw new Error(result?.error || 'No fue posible leer Excel.');
    const base = file.name.replace(/\.(xlsx|xls)$/i, '');
    return { file: new File(['\ufeff' + result.csv], `${base}.csv`, { type: 'text/csv;charset=utf-8' }), config: result.config || null };
  }

  async function exportCsvBlobAsExcel(blob, csvFilename, format, request = {}) {
    if (!window.valistructDesktop?.createSpreadsheet) throw new Error('El generador de Excel no está disponible.');
    const csv = await blob.text();
    const options = request.sourceId === 'downloadTemplate' ? aikenTemplateMeta() : {};
    const result = await window.valistructDesktop.createSpreadsheet(csv, format, options);
    if (!result?.ok || !result.data) throw new Error(result?.error || 'No fue posible crear Excel.');
    const ext = format === 'xls' ? 'xls' : 'xlsx';
    const mime = format === 'xls' ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    downloadBytes(result.data, String(csvFilename || 'ValiStruct_resultados.csv').replace(/\.csv$/i, `.${ext}`), mime);
  }

  function applySpreadsheetConfig(config) {
    if (!config) return;
    [['judgeCount','judges'],['scaleMin','min'],['scaleMax','max']].forEach(([id,key]) => {
      const el = document.getElementById(id); if (el && Number.isFinite(Number(config[key]))) el.value = Number(config[key]);
    });
    if (Array.isArray(config.criteria) && config.criteria.length) {
      document.querySelectorAll('.criterion-check').forEach(el => { el.checked = config.criteria.includes(el.value); });
    }
  }

  // ---------------------------------------------------------------------------
  // Data reset controls
  // ---------------------------------------------------------------------------
  function clearModule(prefix, globals) {
    globalEval(globals);
    const input = document.getElementById(`${prefix}CsvFile`); if (input) input.value = '';
    const summary = document.getElementById(`${prefix}DatasetSummary`); if (summary) summary.innerHTML = '';
    const preview = document.getElementById(`${prefix}DataPreview`); if (preview) preview.innerHTML = '';
    const results = document.getElementById(`${prefix}Results`); if (results) results.innerHTML = '';
    const actions = document.getElementById(`${prefix}Actions`); if (actions) actions.classList.add('hidden');
    if (prefix === 'cfa') { const s=document.getElementById('cfaStatus'); if(s)s.innerHTML=''; }
    if (prefix === 'efa') document.getElementById('valistructVarianceTable')?.remove();
  }

  function addClearButton(afterId, id, handler, confirmText) {
    if (document.getElementById(id)) return;
    const anchor = document.getElementById(afterId); if (!anchor) return;
    const btn = document.createElement('button');
    btn.id = id; btn.type = 'button'; btn.textContent = 'Borrar datos';
    btn.title = 'Borra la base, la vista previa y los resultados para cargar otro archivo.';
    anchor.insertAdjacentElement('afterend', btn);
    btn.addEventListener('click', () => { if (confirm(confirmText)) handler(); });
  }

  function ensureDataResetButtons() {
    addClearButton('loadRelExample','clearRelData',()=>clearModule('rel','relData=null; relLast=null;'),'¿Desea borrar los datos y resultados de confiabilidad?');
    addClearButton('loadEfaExample','clearEfaData',()=>{ clearModule('efa','efaData=null; efaLastResults=null;'); efaManualOverride=false; },'¿Desea borrar los datos y resultados del AFE?');
    addClearButton('loadCfaExample','clearCfaData',()=>clearModule('cfa','cfaData=null; cfaLastResults=null;'),'¿Desea borrar los datos y resultados del AFC?');
  }

  // ---------------------------------------------------------------------------
  // AFE exploratory workflow
  // ---------------------------------------------------------------------------
  function corrMatrix(matrix) {
    const k = matrix[0].length;
    const cols = Array.from({ length:k }, (_,j) => matrix.map(r => Number(r[j])));
    return Array.from({ length:k }, (_,i) => Array.from({ length:k }, (_,j) => i===j ? 1 : globalThis.correlation(cols[i],cols[j])));
  }

  function getEfaData() { return globalEval('efaData'); }
  function getEfaResults() { return globalEval('efaLastResults'); }

  function hideEfaFactorQuestion() {
    const input = document.getElementById('efaFactors');
    if (!input) return;
    const label = input.closest('label');
    if (label) label.style.display = 'none';
    if (document.getElementById('efaAutoRetentionNote')) return;
    const host = document.getElementById('efaRotation')?.closest('label')?.parentElement || input.parentElement;
    if (!host) return;
    const note = document.createElement('div');
    note.id='efaAutoRetentionNote'; note.className='efa-guidance';
    note.innerHTML='<strong>Retención inicial automática</strong><br>La primera exploración no exige fijar factores. ValiStruct calcula la solución inicial con el criterio de autovalor &gt; 1 y muestra análisis paralelo, varianza total explicada y gráfica de sedimentación. La decisión final corresponde al investigador.';
    host.appendChild(note);
  }

  function setAutomaticEfaFactors() {
    const data = getEfaData();
    const input = document.getElementById('efaFactors');
    if (!data?.matrix?.length || !input) return;
    const eig = globalThis.jacobiEigen(corrMatrix(data.matrix)).values;
    const retained = Math.max(1, Math.min(data.k, eig.filter(v => v > 1).length));
    input.value = retained;
    input.dataset.autoRetained = String(retained);
  }

  function varianceTableHtml(r) {
    if (!r?.eigenvalues?.length) return '';
    const k=r.eigenvalues.length; let cum=0, extCum=0, rotCum=0;
    const rotSS=Array.from({length:r.m||0},(_,f)=>(r.loadings||[]).reduce((s,row)=>s+(Number(row[f])||0)**2,0));
    const rows=r.eigenvalues.map((eig,i)=>{
      const pct=100*eig/k; cum+=pct;
      let ext='',ep='',ec='',rot='',rp='',rc='';
      if(i<r.m){ ext=eig.toFixed(3); ep=pct.toFixed(2); extCum+=pct; ec=extCum.toFixed(2); const ss=rotSS[i]??eig; const q=100*ss/k; rotCum+=q; rot=ss.toFixed(3); rp=q.toFixed(2); rc=rotCum.toFixed(2); }
      return `<tr><td>${i+1}</td><td>${eig.toFixed(3)}</td><td>${pct.toFixed(2)}</td><td>${cum.toFixed(2)}</td><td>${ext}</td><td>${ep}</td><td>${ec}</td><td>${rot}</td><td>${rp}</td><td>${rc}</td></tr>`;
    }).join('');
    return `<div id="valistructVarianceTable"><h3>Varianza total explicada</h3><p class="ci-note">La retención inicial es provisional. Integre autovalores, porcentaje acumulado, análisis paralelo, sedimentación e interpretación teórica.</p><div class="workspace"><table class="results-table"><thead><tr><th>Componente</th><th>Autovalor</th><th>% varianza</th><th>% acumulado</th><th>Extracción</th><th>% extracción</th><th>% acum. extracción</th><th>Rotación</th><th>% rotación</th><th>% acum. rotación</th></tr></thead><tbody>${rows}</tbody></table></div><div class="efa-guidance" style="margin-top:14px"><strong>Decisión posterior a la exploración</strong><br><label>Probar otra solución factorial <input id="efaPostFactors" type="number" min="1" max="${k}" value="${r.m}"></label> <button id="efaReestimate" type="button">Recalcular solución</button></div></div>`;
  }

  function enhanceEfaResults() {
    const r=getEfaResults(); const results=document.getElementById('efaResults');
    if(!r||!results||!results.innerHTML.trim()) return;
    document.getElementById('valistructVarianceTable')?.remove();
    results.insertAdjacentHTML('afterbegin',varianceTableHtml(r));
    document.getElementById('efaReestimate')?.addEventListener('click',()=>{
      const n=Number(document.getElementById('efaPostFactors')?.value);
      const hidden=document.getElementById('efaFactors');
      if(!hidden||!Number.isInteger(n)||n<1||n>getEfaData().k) return alert('Indique un número válido de factores.');
      hidden.value=n; efaManualOverride=true; document.getElementById('calculateEfa')?.click();
    });
  }

  // ---------------------------------------------------------------------------
  // V de Aiken judge XLSX template
  // ---------------------------------------------------------------------------
  async function downloadJudgeTemplateXlsx() {
    if (!window.valistructDesktop?.createSpreadsheet) return alert('La plantilla XLSX requiere la aplicación de escritorio.');
    const meta=aikenTemplateMeta();
    try {
      const result=await window.valistructDesktop.createSpreadsheet('Item,Criterio,Juez1,Juez2,Comentario\n','xlsx',meta);
      if(!result?.ok||!result.data)throw new Error(result?.error||'No fue posible crear la plantilla.');
      downloadBytes(result.data,`ValiStruct_Plantilla_Jueces_V_Aiken_${meta.items}_items_${meta.judges}_jueces.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch(err){ alert(`No fue posible generar la plantilla para jueces: ${err.message}`); }
  }

  function ensureJudgeTemplatePanel(){
    if(document.getElementById('valistructJudgeTemplatePanel'))return;
    const aiken=document.getElementById('aiken'),box=aiken?.querySelector('.import-box'); if(!aiken||!box)return;
    const panel=document.createElement('div'); panel.id='valistructJudgeTemplatePanel'; panel.className='import-box';
    panel.innerHTML='<div><h3>Plantilla para juicio de expertos</h3><p>Genere el archivo <strong>.xlsx antes de realizar cualquier cálculo</strong>, entréguelo a los jueces y vuelva a cargar el mismo archivo respondido.</p></div><div class="button-row compact"><button id="downloadJudgeTemplateXlsx" type="button" class="primary">Generar plantilla para jueces (.xlsx)</button></div>';
    box.insertAdjacentElement('beforebegin',panel); panel.querySelector('#downloadJudgeTemplateXlsx')?.addEventListener('click',downloadJudgeTemplateXlsx);
  }

  // ---------------------------------------------------------------------------
  // Generic enhancement
  // ---------------------------------------------------------------------------
  function replaceVisibleTextPreservingChildren(el,nextText){
    const node=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
    if(node)node.textContent=`${nextText} `; else el.insertBefore(document.createTextNode(`${nextText} `),el.firstChild||null);
  }

  function enhanceFileInputs(root=document){
    root.querySelectorAll('input[type="file"]').forEach(input=>{
      const accept=(input.getAttribute('accept')||'').toLowerCase();
      if(!accept||accept.includes('csv')||accept.includes('excel')||accept.includes('spreadsheet')){
        input.setAttribute('accept',ACCEPT); input.dataset.valistructExcelEnabled='true';
      }
    });
    root.querySelectorAll('button,label,span,p,div').forEach(el=>{
      const t=(el.textContent||'').trim();
      if(t==='Importar CSV')replaceVisibleTextPreservingChildren(el,'Importar CSV / XLSX');
      else if(t==='Archivo CSV')replaceVisibleTextPreservingChildren(el,'Archivo CSV / XLSX');
      else if(t==='Seleccionar CSV')replaceVisibleTextPreservingChildren(el,'Seleccionar CSV / XLSX');
    });
    root.querySelectorAll('button[id]').forEach(button=>{
      const text=(button.textContent||'').trim();
      if(!/descargar (plantilla|resultados) csv/i.test(text)||button.dataset.excelButtonsAdded==='true')return;
      button.dataset.excelButtonsAdded='true';
      ['xlsx','xls'].forEach(format=>{
        const b=document.createElement('button'); b.type='button'; b.className=button.className;
        b.textContent=text.replace(/CSV/i,format==='xlsx'?'Excel (.xlsx)':'Excel 97-2003 (.xls)');
        b.dataset.excelSource=button.id; b.dataset.excelFormat=format; button.insertAdjacentElement('afterend',b);
      });
    });
    ensureJudgeTemplatePanel(); ensureDataResetButtons(); hideEfaFactorQuestion();
  }

  document.addEventListener('click',event=>{
    const efaBtn=event.target.closest?.('#calculateEfa');
    if(efaBtn){
      lastStatAction='AFE';
      try { if(efaManualOverride)efaManualOverride=false; else setAutomaticEfaFactors(); }
      catch(err){ event.preventDefault(); event.stopImmediatePropagation(); lastStatAction=null; return alert(statErrorMessage(err)); }
      setTimeout(()=>{ try{enhanceEfaResults();}finally{lastStatAction=null;} },80);
    }
    const cfaBtn=event.target.closest?.('#estimateCfa');
    if(cfaBtn){ lastStatAction='AFC'; setTimeout(()=>{lastStatAction=null;},500); }

    const trigger=event.target.closest?.('button[data-excel-source]');
    if(trigger){ const source=document.getElementById(trigger.dataset.excelSource); if(!source)return; pendingExcelExport={format:trigger.dataset.excelFormat||'xlsx',sourceId:source.id}; source.click(); return; }
    const anchor=event.target.closest?.('a[download]');
    if(!anchor||!pendingExcelExport||!CSV_EXT.test(anchor.download||''))return;
    const blob=blobRegistry.get(anchor.href); if(!blob)return;
    event.preventDefault(); event.stopImmediatePropagation(); const req=pendingExcelExport; pendingExcelExport=null;
    exportCsvBlobAsExcel(blob,anchor.download,req.format,req).catch(err=>alert(`No fue posible exportar a Excel: ${err.message}`));
  },true);

  document.addEventListener('change',async event=>{
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||input.type!=='file'||input.dataset.valistructExcelEnabled!=='true')return;
    const file=input.files?.[0]; if(!file||CSV_EXT.test(file.name)||!EXCEL_EXT.test(file.name))return;
    event.stopImmediatePropagation(); event.preventDefault();
    try{
      input.disabled=true; const converted=await excelToCsvFile(file); applySpreadsheetConfig(converted.config);
      const dt=new DataTransfer(); dt.items.add(converted.file); input.files=dt.files; input.disabled=false; input.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(err){input.disabled=false;input.value='';alert(`No fue posible importar el archivo de Excel: ${err.message}`);}
  },true);

  enhanceFileInputs();
  const observer=new MutationObserver(()=>enhanceFileInputs());
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
