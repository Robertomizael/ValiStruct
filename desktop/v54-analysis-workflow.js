(() => {
  'use strict';

  const q = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
  const getGlobal = name => { try { return window.eval(name); } catch (_) { return null; } };
  const csvEsc = value => `"${String(value ?? '').replaceAll('"','""')}"`;

  function dataToCsv(data) {
    if (!data?.itemNames?.length || !data?.matrix?.length) throw new Error('No hay una matriz AFC activa.');
    return [data.itemNames, ...data.matrix].map(row => row.map(csvEsc).join(',')).join('\n');
  }

  function cfaSyntaxToLavaan(text) {
    const lines = String(text || '').split(/\n+/).map(x => x.trim()).filter(Boolean);
    if (!lines.length) throw new Error('Especifique al menos un factor antes de estimar.');
    return lines.map(line => {
      if (line.includes('=~')) return line;
      const match = line.match(/^([^=]+)=(.+)$/);
      if (!match) throw new Error(`Sintaxis AFC no reconocida: ${line}`);
      const factor = match[1].trim();
      const items = match[2].split(',').map(x => x.trim()).filter(Boolean);
      if (items.length < 2) throw new Error(`El factor ${factor} requiere al menos dos indicadores.`);
      return `${factor} =~ ${items.join(' + ')}`;
    }).join('\n');
  }

  function apiBase() {
    try {
      const fn = getGlobal('getProApiBase');
      if (typeof fn === 'function') return String(fn()).replace(/\/$/, '');
    } catch (_) {}
    return 'http://127.0.0.1:8765';
  }

  function fitValue(result, name) {
    const robust = result?.fit_robust || {};
    const standard = result?.fit || {};
    const candidates = {
      cfi: [robust['cfi.robust'], robust['cfi.scaled'], standard.cfi],
      tli: [robust['tli.robust'], robust['tli.scaled'], standard.tli],
      rmsea: [robust['rmsea.robust'], robust['rmsea.scaled'], standard.rmsea],
      chisq: [robust['chisq.scaled'], standard.chisq],
      df: [robust['df.scaled'], standard.df],
      pvalue: [robust['pvalue.scaled'], standard.pvalue],
      srmr: [standard.srmr], aic: [standard.aic], bic: [standard.bic]
    }[name] || [standard[name]];
    return candidates.find(v => Number.isFinite(Number(v)));
  }

  function omegaFromProfessionalCfa(result) {
    const params = Array.isArray(result?.parameters) ? result.parameters : [];
    const loadingRows = params.filter(p => p.op === '=~' && Number.isFinite(Number(p.std_all)));
    const residualRows = params.filter(p => p.op === '~~' && p.lhs === p.rhs && Number.isFinite(Number(p.std_all)));
    const residualByItem = new Map(residualRows.map(p => [p.lhs, Number(p.std_all)]));
    const factors = [...new Set(loadingRows.map(p => p.lhs))];
    const rows = [];
    for (const factor of factors) {
      const loads = loadingRows.filter(p => p.lhs === factor);
      const lambdas = loads.map(p => Number(p.std_all));
      const theta = loads.map(p => residualByItem.get(p.rhs)).filter(Number.isFinite);
      if (lambdas.length < 2 || theta.length !== lambdas.length) continue;
      const sumLambda = lambdas.reduce((a,b) => a+b, 0);
      const numerator = sumLambda * sumLambda;
      const denominator = numerator + theta.reduce((a,b) => a+b, 0);
      if (!(denominator > 0)) continue;
      rows.push({factor, omega:numerator/denominator, items:loads.map(p => p.rhs)});
    }
    return rows;
  }

  function fmt(value, digits=3) {
    return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
  }

  function professionalCfaHtml(result) {
    const omega = omegaFromProfessionalCfa(result);
    const loadings = (result.parameters || []).filter(p => p.op === '=~' && Number.isFinite(Number(p.std_all)));
    const estimator = esc(result.estimator || '—');
    const cards = [
      ['Estimador', estimator], ['CFI', fmt(fitValue(result,'cfi'))], ['TLI', fmt(fitValue(result,'tli'))],
      ['RMSEA', fmt(fitValue(result,'rmsea'))], ['SRMR', fmt(fitValue(result,'srmr'))]
    ].map(([label,value]) => `<div class="result-card"><span>${label}</span><strong>${value}</strong></div>`).join('');

    const loadRows = loadings.map(p => `<tr><td>${esc(p.lhs)}</td><td>${esc(p.rhs)}</td><td>${fmt(p.est)}</td><td><strong>${fmt(p.std_all)}</strong></td><td>${fmt(p.se)}</td><td>${fmt(p.pvalue)}</td></tr>`).join('');
    const omegaRows = omega.map(x => `<tr><td>${esc(x.factor)}</td><td>${x.items.length}</td><td><strong>${fmt(x.omega)}</strong></td><td>${x.omega >= .70 ? 'Favorable' : 'Revisar'}</td></tr>`).join('');
    const guidance = (result.guidance || []).map(x => `<li>${esc(x)}</li>`).join('');

    return `<div class="results-summary"><div class="report-header"><h3>AFC profesional · R/lavaan</h3><p>Estimación confirmatoria con el motor estadístico integrado.</p></div><div class="result-cards">${cards}</div></div>
      <div class="workspace"><h3>Cargas factoriales estandarizadas</h3><table class="results-table"><thead><tr><th>Factor</th><th>Ítem</th><th>Estimación</th><th>Carga estandarizada</th><th>EE</th><th>p</th></tr></thead><tbody>${loadRows}</tbody></table></div>
      <div class="workspace"><h3>Omega de McDonald basado en el modelo</h3>${omegaRows ? `<table class="results-table"><thead><tr><th>Factor</th><th>Ítems</th><th>ω</th><th>Orientación</th></tr></thead><tbody>${omegaRows}</tbody></table>` : '<p>No fue posible derivar omega de la solución estandarizada.</p>'}
      <p class="ci-note">ω se calcula por factor a partir de cargas estandarizadas y varianzas residuales del AFC. En modelos multidimensionales no se reporta un “omega total” único automáticamente. Omega jerárquico requiere un modelo jerárquico o bifactor explícito.</p></div>
      ${guidance ? `<div class="notice"><strong>Orientación metodológica</strong><ul>${guidance}</ul></div>` : ''}`;
  }

  async function runProfessionalCfa() {
    const output = q('cfaProfessionalResults');
    const status = q('cfaProfessionalStatus');
    try {
      const data = getGlobal('cfaData');
      if (!data) throw new Error('Importe o cargue primero la matriz de datos del AFC.');
      const syntax = cfaSyntaxToLavaan(q('cfaSyntax')?.value);
      const estimator = q('cfaProfessionalEstimator')?.value || 'AUTO';
      const dataType = q('cfaProfessionalDataType')?.value || 'auto';
      const ordinalVars = dataType === 'ordinal' ? data.itemNames.slice() : [];
      status.textContent = 'Estimando modelo con R/lavaan…';
      output.innerHTML = '';
      const headers = {'Content-Type':'application/json'};
      const token = window.valistructDesktop?.scientificToken;
      if (token) headers['X-ValiStruct-Session'] = token;
      const response = await fetch(`${apiBase()}/estimate`, {
        method:'POST', headers,
        body:JSON.stringify({
          syntax, csv_text:dataToCsv(data), estimator,
          data_type:dataType, ordinal_vars:ordinalVars,
          missing:['ML','MLR','AUTO'].includes(estimator) ? 'fiml' : 'pairwise',
          bootstrap:0
        })
      });
      const text = await response.text();
      let result;
      try { result = JSON.parse(text); } catch (_) { throw new Error('Motor R respondió en formato no válido.'); }
      if (!response.ok || !result?.ok) throw new Error(result?.error || `Motor R respondió HTTP ${response.status}.`);
      window.__valistructCfaProfessionalLast = result;
      output.innerHTML = professionalCfaHtml(result);
      status.innerHTML = `<strong>AFC profesional calculado.</strong> Estimador utilizado: ${esc(result.estimator)}.`;
      updateOmegaPanel();
      captureAllResults();
    } catch (err) {
      status.innerHTML = `<span class="model-error">${esc(err.message || err)}</span>`;
    }
  }

  function installProfessionalCfa() {
    const cfa = q('cfa');
    if (!cfa || q('cfaProfessionalPanel')) return;
    const model = cfa.querySelector('.model-builder');
    if (!model) return;
    const panel = document.createElement('section');
    panel.id = 'cfaProfessionalPanel';
    panel.className = 'model-builder';
    panel.innerHTML = `<h3>Estimación profesional del AFC</h3>
      <p>Seleccione el <strong>estimador del modelo</strong>. En AFC no se utilizan “métodos de extracción” como en AFE.</p>
      <div class="config-grid">
        <label>Estimador<select id="cfaProfessionalEstimator">
          <option value="AUTO" selected>Automático recomendado</option><option value="ML">ML</option><option value="MLR">MLR · robusto</option>
          <option value="GLS">GLS</option><option value="ULS">ULS</option><option value="DWLS">DWLS</option>
          <option value="WLSMV">WLSMV · ordinal</option><option value="ULSMV">ULSMV · robusto</option>
        </select></label>
        <label>Tipo de indicadores<select id="cfaProfessionalDataType"><option value="auto" selected>Detectar automáticamente</option><option value="continuous">Continuos</option><option value="ordinal">Ordinales / Likert</option></select></label>
      </div>
      <div class="button-row"><button type="button" id="runCfaProfessional" class="primary">Estimar AFC con R/lavaan</button></div>
      <p id="cfaProfessionalStatus" class="efa-engine-status" role="status">El AFC local se conserva sin cambios. Este botón ejecuta una estimación independiente con el motor R.</p>
      <div id="cfaProfessionalResults"></div>`;
    model.insertAdjacentElement('beforebegin', panel);
    q('runCfaProfessional')?.addEventListener('click', runProfessionalCfa);
  }

  function updateOmegaPanel() {
    const out = q('modelOmegaResults');
    if (!out) return;
    const result = window.__valistructCfaProfessionalLast;
    if (!result) {
      out.innerHTML = '<p class="ci-note">Ejecute primero un AFC profesional para disponer de cargas y varianzas residuales.</p>';
      return;
    }
    const rows = omegaFromProfessionalCfa(result);
    if (!rows.length) {
      out.innerHTML = '<div class="model-error">La solución AFC no contiene parámetros suficientes para calcular omega.</div>';
      return;
    }
    out.innerHTML = `<table class="results-table"><thead><tr><th>Factor</th><th>N ítems</th><th>Omega</th><th>Orientación</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.factor)}</td><td>${x.items.length}</td><td><strong>${fmt(x.omega)}</strong></td><td>${x.omega>=.70?'Favorable':'Revisar'}</td></tr>`).join('')}</tbody></table>
      <p class="ci-note">Omega procede del modelo AFC profesional. Para omega jerárquico se requiere especificar explícitamente un modelo de segundo orden o bifactor.</p>`;
  }

  function installOmegaPanel() {
    const rel = q('reliability');
    if (!rel || q('modelOmegaPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'modelOmegaPanel';
    panel.className = 'workspace';
    panel.innerHTML = `<h3>Omega de McDonald basado en modelo factorial</h3><p>Evita la aproximación retirada anteriormente. Requiere una solución AFC profesional válida.</p><div class="button-row"><button id="refreshModelOmega" type="button">Usar último AFC profesional</button></div><div id="modelOmegaResults"></div>`;
    const results = q('relResults');
    if (results) results.insertAdjacentElement('beforebegin', panel); else rel.appendChild(panel);
    q('refreshModelOmega')?.addEventListener('click', updateOmegaPanel);
    updateOmegaPanel();
  }

  const resultSources = [
    ['aikenResults','Validez de contenido · V de Aiken'], ['cviResults','Validez de contenido · I-CVI/S-CVI'],
    ['modifiedKappaResults','Validez de contenido · Kappa modificado'], ['lawsheResults','Validez de contenido · Lawshe'],
    ['delphiResults','Validez de contenido · Delphi'], ['efaDiagnosticResults','AFE · Diagnósticos'], ['efaResults','AFE'],
    ['cfaResults','AFC local'], ['cfaProfessionalResults','AFC profesional'], ['relResults','Fiabilidad'],
    ['modelOmegaResults','Fiabilidad · Omega'], ['proResults','Motor Pro'], ['advancedResults','Validación avanzada'],
    ['qualityDashboardContent','Resumen de calidad'], ['articleTablesPreview','Tablas para artículo']
  ];

  const registry = new Map();
  function tableTitle(container, table, index) {
    const heading = table.previousElementSibling?.matches?.('h2,h3,h4') ? table.previousElementSibling.textContent.trim() : '';
    return heading || `${container.dataset.vsLabel || 'Resultado'} · Tabla ${index+1}`;
  }
  function snapshotKey(sourceId, title, html) {
    return `${sourceId}|${title}|${html.length}|${html.slice(0,160)}`;
  }
  function captureAllResults() {
    for (const [id,label] of resultSources) {
      const container = q(id); if (!container) continue;
      container.dataset.vsLabel = label;
      [...container.querySelectorAll('table')].forEach((table,index) => {
        const title = tableTitle(container,table,index);
        const html = table.outerHTML;
        const key = snapshotKey(id,title,html);
        registry.set(key,{key,sourceId:id,module:label,title,html,createdAt:new Date().toISOString()});
      });
    }
    renderResultCatalog();
  }

  function downloadHtml(entry) {
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(entry.title)}</title><style>body{font-family:Arial,sans-serif;margin:36px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:7px}th{background:#f3f3f3}</style><h1>${esc(entry.title)}</h1><p>${esc(entry.module)}</p>${entry.html}`;
    const blob = new Blob([html],{type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href=url; a.download=`ValiStruct_${entry.title.replace(/[^a-z0-9]+/gi,'_').replace(/^_|_$/g,'')}.html`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function renderResultCatalog() {
    const list = q('vsResultCatalogList'); if (!list) return;
    const entries = [...registry.values()];
    if (!entries.length) { list.innerHTML='<p class="ci-note">Todavía no hay tablas calculadas en esta sesión.</p>'; return; }
    list.innerHTML = entries.map((entry,index)=>`<article class="card"><label><input type="checkbox" class="vs-result-pick" data-key="${esc(entry.key)}"> <strong>${esc(entry.title)}</strong></label><p>${esc(entry.module)}</p><div class="button-row compact"><button type="button" class="vs-result-view" data-key="${esc(entry.key)}">Ver tabla</button><button type="button" class="vs-result-download" data-key="${esc(entry.key)}">Descargar HTML</button></div><div class="vs-result-preview" id="vsResultPreview${index}" hidden></div></article>`).join('');
    list.querySelectorAll('.vs-result-view').forEach((button,index)=>button.addEventListener('click',()=>{
      const entry=registry.get(button.dataset.key); const preview=q(`vsResultPreview${index}`); if(!entry||!preview)return; preview.hidden=!preview.hidden; preview.innerHTML=entry.html;
    }));
    list.querySelectorAll('.vs-result-download').forEach(button=>button.addEventListener('click',()=>{const entry=registry.get(button.dataset.key);if(entry)downloadHtml(entry);}));
  }

  function downloadSelectedResults() {
    const keys=[...document.querySelectorAll('.vs-result-pick:checked')].map(x=>x.dataset.key);
    if(!keys.length)return alert('Seleccione al menos una tabla.');
    const entries=keys.map(k=>registry.get(k)).filter(Boolean);
    const body=entries.map((e,i)=>`<section><h2>Tabla ${i+1}. ${esc(e.title)}</h2><p>${esc(e.module)}</p>${e.html}</section>`).join('<hr>');
    const blob=new Blob([`<!doctype html><meta charset="utf-8"><title>ValiStruct · Resultados seleccionados</title><style>body{font-family:Arial,sans-serif;margin:36px}table{border-collapse:collapse;width:100%;margin-bottom:28px}th,td{border:1px solid #bbb;padding:7px}th{background:#f3f3f3}</style><h1>ValiStruct · Resultados seleccionados</h1>${body}`],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ValiStruct_resultados_seleccionados.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  function installResultCatalog() {
    const section=q('resultcenter'); if(!section||q('vsResultCatalog'))return;
    const box=document.createElement('section'); box.id='vsResultCatalog'; box.className='workspace';
    box.innerHTML='<h3>Catálogo de todas las tablas generadas</h3><p>Revise las tablas producidas durante la sesión y descargue únicamente las que decida conservar.</p><div class="button-row"><button id="vsRefreshResultCatalog" type="button" class="primary">Actualizar catálogo</button><button id="vsDownloadSelectedResults" type="button">Descargar selección</button></div><div id="vsResultCatalogList"></div>';
    const heading=section.querySelector('.section-heading'); if(heading)heading.insertAdjacentElement('afterend',box);else section.insertBefore(box,section.firstChild);
    q('vsRefreshResultCatalog')?.addEventListener('click',captureAllResults); q('vsDownloadSelectedResults')?.addEventListener('click',downloadSelectedResults);
    captureAllResults();
  }

  function observeOutputs() {
    const observer=new MutationObserver(()=>captureAllResults());
    resultSources.forEach(([id])=>{const el=q(id);if(el)observer.observe(el,{childList:true,subtree:true});});
  }

  installProfessionalCfa();
  installOmegaPanel();
  installResultCatalog();
  observeOutputs();
  window.ValiStructCaptureAllResults = captureAllResults;
  window.ValiStructModelOmega = omegaFromProfessionalCfa;
})();
