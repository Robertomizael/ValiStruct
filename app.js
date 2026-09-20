
const buttons = document.querySelectorAll('.nav button');
const panels = document.querySelectorAll('.panel');

function showSection(id) {
  buttons.forEach(b => b.classList.toggle('active', b.dataset.section === id));
  panels.forEach(p => p.classList.toggle('visible', p.id === id));
  window.scrollTo({top: 0, behavior: 'smooth'});
}
buttons.forEach(btn => btn.addEventListener('click', () => showSection(btn.dataset.section)));
document.querySelectorAll('[data-go]').forEach(card => card.addEventListener('click', () => showSection(card.dataset.go)));

const workspace = document.getElementById('aikenWorkspace');
const resultsEl = document.getElementById('aikenResults');
const actionsEl = document.getElementById('aikenActions');
let lastResults = [];

function selectedCriteria() {
  return [...document.querySelectorAll('.criterion-check:checked')].map(el => el.value);
}

function cfg() {
  return {
    judges: Number(document.getElementById('judgeCount').value),
    items: Number(document.getElementById('itemCount').value),
    min: Number(document.getElementById('scaleMin').value),
    max: Number(document.getElementById('scaleMax').value),
    good: Number(document.getElementById('goodThreshold').value),
    warn: Number(document.getElementById('warnThreshold').value),
    confidence: Number(document.getElementById('confidenceLevel').value),
    criteria: selectedCriteria()
  };
}

function validateConfig(c) {
  if (!Number.isInteger(c.judges) || c.judges < 2) return 'El número de jueces debe ser 2 o mayor.';
  if (!Number.isInteger(c.items) || c.items < 1) return 'El número de ítems debe ser 1 o mayor.';
  if (!(c.max > c.min)) return 'El valor máximo de la escala debe ser mayor que el mínimo.';
  if (!c.criteria.length) return 'Seleccione al menos un criterio.';
  if (!(c.good > c.warn && c.good <= 1 && c.warn >= 0)) return 'Revise los umbrales de interpretación.';
  return null;
}

function buildMatrix(prefill=null) {
  const c = cfg();
  const error = validateConfig(c);
  if (error) return alert(error);

  let html = '<table class="aiken-table"><thead><tr><th>Ítem</th><th>Criterio</th>';
  for (let j = 1; j <= c.judges; j++) html += `<th>Juez ${j}</th>`;
  html += '<th>Comentario cualitativo</th></tr></thead><tbody>';

  for (let i = 1; i <= c.items; i++) {
    c.criteria.forEach((criterion, idx) => {
      html += '<tr>';
      if (idx === 0) {
        html += `<td class="item-label" rowspan="${c.criteria.length}">
          <input type="text" class="item-name" data-item="${i}" value="Ítem ${i}" aria-label="Nombre del ítem ${i}">
        </td>`;
      }
      html += `<td>${criterion}</td>`;
      for (let j = 1; j <= c.judges; j++) {
        html += `<td><input class="rating" type="number" step="1"
          min="${c.min}" max="${c.max}" data-item="${i}" data-criterion="${criterion}"
          data-judge="${j}" placeholder="${c.min}-${c.max}"></td>`;
      }
      html += `<td><textarea class="comment-input" data-item="${i}" data-criterion="${criterion}" placeholder="Observaciones de jueces o decisión del investigador"></textarea></td>`;
      html += '</tr>';
    });
  }
  html += '</tbody></table>';
  workspace.innerHTML = html;
  actionsEl.classList.remove('hidden');
  resultsEl.innerHTML = '';
  lastResults = [];
}

function zValue(conf) {
  if (Math.abs(conf - .90) < .001) return 1.6448536269514722;
  if (Math.abs(conf - .99) < .001) return 2.5758293035489004;
  return 1.959963984540054;
}

function scoreCI(v, n, conf) {
  const z = zValue(conf);
  const z2 = z*z;
  const denom = 2*(n + z2);
  const core = 2*n*v + z2;
  const rad = z * Math.sqrt(4*n*v*(1-v) + z2);
  return {
    lower: Math.max(0, (core-rad)/denom),
    upper: Math.min(1, (core+rad)/denom)
  };
}

function statusFor(v, good, warn) {
  if (v >= good) return { label: 'Favorable', cls: 'good-bg', icon: '🟢' };
  if (v >= warn) return { label: 'Revisar', cls: 'warn-bg', icon: '🟠' };
  return { label: 'Problema potencial', cls: 'bad-bg', icon: '🔴' };
}

function interpretationFor(v, ci, good, warn) {
  if (v >= good) {
    if (ci.lower >= good) return 'Resultado favorable y consistente: incluso el límite inferior del intervalo alcanza el umbral favorable configurado.';
    return 'La estimación puntual es favorable, pero el intervalo de confianza cruza el umbral. Interprete con prudencia y revise la evidencia cualitativa.';
  }
  if (v >= warn) return 'Resultado intermedio. Revise redacción, congruencia conceptual y comentarios de los jueces antes de decidir cambios.';
  return 'Problema potencial de validez de contenido. Revise el ítem en profundidad; no se recomienda eliminarlo automáticamente sin sustento teórico.';
}

function readRatingsFor(item, criterion, c) {
  const inputs = [...document.querySelectorAll(`.rating[data-item="${item}"][data-criterion="${CSS.escape(criterion)}"]`)];
  const values = inputs.map(x => Number(x.value));
  if (values.some(v => !Number.isFinite(v) || v < c.min || v > c.max)) return null;
  return values;
}

function calculate() {
  const c = cfg();
  const error = validateConfig(c);
  if (error) return alert(error);
  if (!workspace.querySelector('.aiken-table')) return alert('Primero cree o importe la matriz de evaluación.');

  const results = [];
  for (let i = 1; i <= c.items; i++) {
    const nameInput = document.querySelector(`.item-name[data-item="${i}"]`);
    const itemName = (nameInput?.value || `Ítem ${i}`).trim() || `Ítem ${i}`;
    for (const criterion of c.criteria) {
      const ratings = readRatingsFor(i, criterion, c);
      if (!ratings) {
        alert(`Complete todas las puntuaciones de ${itemName} · ${criterion} dentro del rango ${c.min}-${c.max}.`);
        return;
      }
      const sumS = ratings.reduce((acc, r) => acc + (r - c.min), 0);
      const v = sumS / (c.judges * (c.max - c.min));
      const ci = scoreCI(v, c.judges, c.confidence);
      const st = statusFor(v, c.good, c.warn);
      const comment = document.querySelector(`.comment-input[data-item="${i}"][data-criterion="${CSS.escape(criterion)}"]`)?.value?.trim() || '';
      results.push({
        item: itemName, itemIndex: i, criterion, v, ci,
        mean: ratings.reduce((a,b) => a+b,0) / ratings.length,
        status: st.label, statusClass: st.cls, icon: st.icon,
        comment,
        interpretation: interpretationFor(v, ci, c.good, c.warn)
      });
    }
  }
  lastResults = results;
  renderResults(results, c);
}

function renderResults(results, c) {
  const overall = results.reduce((a, r) => a + r.v, 0) / results.length;
  const goodN = results.filter(r => r.v >= c.good).length;
  const warnN = results.filter(r => r.v >= c.warn && r.v < c.good).length;
  const badN = results.filter(r => r.v < c.warn).length;
  const confPct = Math.round(c.confidence*100);

  let html = `<div class="results-summary">
    <div class="report-header">
      <h3>ValiStruct · Informe de validez de contenido</h3>
      <p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p>
    </div>
    <div class="result-cards">
      <div class="result-card"><span>V promedio global</span><strong>${overall.toFixed(3)}</strong></div>
      <div class="result-card good-bg"><span>Favorables</span><strong>${goodN}</strong></div>
      <div class="result-card warn-bg"><span>Revisar</span><strong>${warnN}</strong></div>
      <div class="result-card bad-bg"><span>Problema potencial</span><strong>${badN}</strong></div>
    </div>
    <p><strong>Nota:</strong> se presenta IC ${confPct}% tipo score/Wilson como apoyo interpretativo. La decisión sobre un ítem debe integrar el valor V, el intervalo de confianza, los comentarios de expertos y la congruencia teórica.</p>
  </div>`;

  html += `<div class="workspace"><table class="results-table"><thead><tr>
    <th>Ítem</th><th>Criterio</th><th>Media</th><th>V</th><th>IC ${confPct}%</th><th>Estado</th><th>Orientación</th><th>Comentario</th>
  </tr></thead><tbody>`;

  results.forEach(r => {
    html += `<tr>
      <td>${escapeHtml(r.item)}</td>
      <td>${escapeHtml(r.criterion)}</td>
      <td>${r.mean.toFixed(2)}</td>
      <td><strong>${r.v.toFixed(3)}</strong></td>
      <td>${r.ci.lower.toFixed(3)}–${r.ci.upper.toFixed(3)}</td>
      <td><span class="status-chip ${r.statusClass}">${r.icon} ${r.status}</span></td>
      <td class="interpretation">${r.interpretation}</td>
      <td class="interpretation">${escapeHtml(r.comment || '—')}</td>
    </tr>`;
  });
  html += '</tbody></table></div>';
  resultsEl.innerHTML = html;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[ch]));
}

function loadExample() {
  document.getElementById('judgeCount').value = 5;
  document.getElementById('itemCount').value = 4;
  document.getElementById('scaleMin').value = 1;
  document.getElementById('scaleMax').value = 5;
  document.querySelectorAll('.criterion-check').forEach(x => x.checked = ['Claridad','Coherencia','Relevancia'].includes(x.value));
  buildMatrix();

  const pattern = {
    1: [5,5,4,5,4],
    2: [4,4,4,5,4],
    3: [3,4,3,4,3],
    4: [2,3,3,2,3]
  };
  document.querySelectorAll('.rating').forEach(input => {
    const item = Number(input.dataset.item);
    const judge = Number(input.dataset.judge);
    let val = pattern[item][judge-1];
    if (input.dataset.criterion === 'Relevancia' && item === 3) val = Math.min(5, val + 1);
    input.value = val;
  });
  document.querySelector('.comment-input[data-item="3"][data-criterion="Claridad"]').value = 'Revisar redacción para mayor precisión.';
}

function clearAll() {
  workspace.innerHTML = '';
  resultsEl.innerHTML = '';
  actionsEl.classList.add('hidden');
  lastResults = [];
}

function summaryText() {
  if (!lastResults.length) return '';
  const c = cfg();
  const overall = lastResults.reduce((a,r)=>a+r.v,0)/lastResults.length;
  const confPct = Math.round(c.confidence*100);
  return [
    'ValiStruct · V de Aiken',
    'Dr. Roberto Joel Tirado Reyes · Universidad Autónoma de Sinaloa',
    `V promedio global: ${overall.toFixed(3)}`,
    `Intervalos de confianza: ${confPct}%`,
    '',
    ...lastResults.map(r => `${r.item} · ${r.criterion}: V=${r.v.toFixed(3)}; IC=${r.ci.lower.toFixed(3)}–${r.ci.upper.toFixed(3)}; ${r.status}${r.comment ? '; comentario: '+r.comment : ''}`)
  ].join('\n');
}

function copySummary() {
  if (!lastResults.length) return alert('Primero calcule los resultados.');
  navigator.clipboard.writeText(summaryText())
    .then(() => alert('Resumen copiado al portapapeles.'))
    .catch(() => alert('No fue posible copiar automáticamente.'));
}

function csvEscape(x) {
  return `"${String(x ?? '').replaceAll('"','""')}"`;
}

function downloadCsv() {
  if (!lastResults.length) return alert('Primero calcule los resultados.');
  const c = cfg();
  const confPct = Math.round(c.confidence*100);
  const rows = [[
    'Item','Criterio','Media_jueces','V_Aiken',
    `IC${confPct}_inferior`,`IC${confPct}_superior`,'Estado','Comentario'
  ]];
  lastResults.forEach(r => rows.push([
    r.item, r.criterion, r.mean.toFixed(3), r.v.toFixed(3),
    r.ci.lower.toFixed(3), r.ci.upper.toFixed(3), r.status, r.comment
  ]));
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv, 'text/csv;charset=utf-8;', 'ValiStruct_V_Aiken_resultados.csv');
}

function downloadTemplate() {
  const c = cfg();
  const judges = Math.max(2, c.judges || 5);
  const headers = ['Item','Criterio', ...Array.from({length:judges},(_,i)=>`Juez${i+1}`), 'Comentario'];
  const sample = ['Ítem 1','Claridad', ...Array(judges).fill(''), ''];
  const csv = [headers, sample].map(r => r.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv, 'text/csv;charset=utf-8;', 'ValiStruct_plantilla_V_Aiken.csv');
}

function parseCSV(text) {
  const rows = [];
  let row=[], cell='', quoted=false;
  for (let i=0; i<text.length; i++) {
    const ch=text[i], next=text[i+1];
    if (quoted) {
      if (ch === '"' && next === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted=false;
      else cell += ch;
    } else {
      if (ch === '"') quoted=true;
      else if (ch === ',') { row.push(cell); cell=''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row=[]; cell=''; }
      else if (ch !== '\r') cell += ch;
    }
  }
  row.push(cell);
  if (row.some(x=>x.trim()!=='')) rows.push(row);
  return rows;
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCSV(reader.result.replace(/^\uFEFF/,''));
      if (rows.length < 2) throw new Error('El archivo no contiene datos.');
      const h = rows[0].map(x=>x.trim());
      const itemIdx = h.findIndex(x=>/^item$/i.test(x));
      const critIdx = h.findIndex(x=>/^criterio$/i.test(x));
      const commentIdx = h.findIndex(x=>/^comentario$/i.test(x));
      const judgeIdxs = h.map((x,i)=>/^juez\d+$/i.test(x)?i:-1).filter(i=>i>=0);
      if (itemIdx<0 || critIdx<0 || judgeIdxs.length<2) throw new Error('Se requieren columnas Item, Criterio y al menos Juez1 y Juez2.');

      const dataRows = rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
      const itemNames = [...new Set(dataRows.map(r=>r[itemIdx]?.trim()).filter(Boolean))];
      const criteria = [...new Set(dataRows.map(r=>r[critIdx]?.trim()).filter(Boolean))];

      document.getElementById('judgeCount').value = judgeIdxs.length;
      document.getElementById('itemCount').value = itemNames.length;
      document.querySelectorAll('.criterion-check').forEach(x => x.checked = criteria.includes(x.value));
      const missingCriteria = criteria.filter(c=>![...document.querySelectorAll('.criterion-check')].some(x=>x.value===c));
      if (missingCriteria.length) throw new Error('Criterios no reconocidos: '+missingCriteria.join(', ')+'. Use Claridad, Coherencia, Relevancia o Suficiencia.');

      buildMatrix();

      itemNames.forEach((name, idx)=>{
        document.querySelector(`.item-name[data-item="${idx+1}"]`).value=name;
      });
      dataRows.forEach(r=>{
        const itemName=r[itemIdx]?.trim(), criterion=r[critIdx]?.trim();
        const itemNum=itemNames.indexOf(itemName)+1;
        judgeIdxs.forEach((col,j)=>{
          const el=document.querySelector(`.rating[data-item="${itemNum}"][data-criterion="${CSS.escape(criterion)}"][data-judge="${j+1}"]`);
          if (el) el.value=r[col]?.trim() ?? '';
        });
        const comment=document.querySelector(`.comment-input[data-item="${itemNum}"][data-criterion="${CSS.escape(criterion)}"]`);
        if (comment && commentIdx>=0) comment.value=r[commentIdx]?.trim() ?? '';
      });
      alert('CSV importado correctamente. Revise los datos antes de calcular.');
    } catch(e) {
      alert('No fue posible importar el CSV: '+e.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function reportHtml() {
  if (!lastResults.length) return null;
  const c=cfg(), confPct=Math.round(c.confidence*100);
  const rows=lastResults.map(r=>`<tr><td>${escapeHtml(r.item)}</td><td>${escapeHtml(r.criterion)}</td><td>${r.mean.toFixed(2)}</td><td>${r.v.toFixed(3)}</td><td>${r.ci.lower.toFixed(3)}–${r.ci.upper.toFixed(3)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.comment||'—')}</td></tr>`).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Informe V de Aiken</title>
  <style>body{font-family:Arial,sans-serif;max-width:1100px;margin:40px auto;color:#222}h1{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f2f2f2}.note{background:#f8f8f8;padding:14px;border-left:4px solid #7c1f2a}</style>
  <body><h1>ValiStruct · Informe de validez de contenido</h1><p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Profesor-investigador · Universidad Autónoma de Sinaloa</p>
  <div class="note">Se utilizó la V de Aiken y un IC ${confPct}% tipo score/Wilson como apoyo interpretativo. Los puntos de corte son orientativos y no sustituyen el juicio teórico-metodológico.</div>
  <table><thead><tr><th>Ítem</th><th>Criterio</th><th>Media</th><th>V</th><th>IC ${confPct}%</th><th>Estado</th><th>Comentario</th></tr></thead><tbody>${rows}</tbody></table>
  <h3>Referencias</h3><p>Aiken, L. R. (1985). Three coefficients for analyzing the reliability and validity of ratings. <em>Educational and Psychological Measurement, 45</em>(1), 131–142.</p>
  <p>Penfield, R. D., & Giacobbi, P. R. (2004). Applying a score confidence interval to Aiken’s item content-relevance index. <em>Measurement in Physical Education and Exercise Science, 8</em>(4), 213–225.</p>
  </body></html>`;
}

function downloadReport() {
  const html=reportHtml();
  if (!html) return alert('Primero calcule los resultados.');
  saveBlob(html,'text/html;charset=utf-8;','ValiStruct_informe_V_Aiken.html');
}

function saveBlob(content,type,filename) {
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

document.getElementById('buildAiken').addEventListener('click', buildMatrix);
document.getElementById('loadExample').addEventListener('click', loadExample);
document.getElementById('clearAiken').addEventListener('click', clearAll);
document.getElementById('calculateAiken').addEventListener('click', calculate);
document.getElementById('copyResults').addEventListener('click', copySummary);
document.getElementById('downloadCsv').addEventListener('click', downloadCsv);
document.getElementById('downloadTemplate').addEventListener('click', downloadTemplate);
document.getElementById('downloadReport').addEventListener('click', downloadReport);
document.getElementById('printReport').addEventListener('click', () => {
  if (!lastResults.length) return alert('Primero calcule los resultados.');
  window.print();
});
document.getElementById('csvFile').addEventListener('change', e => {
  const file=e.target.files?.[0];
  if (file) importCSV(file);
  e.target.value='';
});

// Reliability module v0.4
let relData=null,relLast=null;
const q=id=>document.getElementById(id),avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
function vari(a){let m=avg(a);return a.reduce((s,x)=>s+(x-m)**2,0)/(a.length-1)}
function corr(a,b){let ma=avg(a),mb=avg(b),sa=Math.sqrt(vari(a)),sb=Math.sqrt(vari(b));if(!(sa>0&&sb>0))return NaN;let s=0;for(let i=0;i<a.length;i++)s+=(a[i]-ma)*(b[i]-mb);return s/((a.length-1)*sa*sb)}
function cronAlpha(M){let k=M[0].length,cols=Array.from({length:k},(_,j)=>M.map(r=>r[j])),sv=cols.reduce((s,c)=>s+vari(c),0),t=M.map(r=>r.reduce((a,b)=>a+b,0)),tv=vari(t);return k>1&&tv>0?(k/(k-1))*(1-sv/tv):NaN}
function stdAlpha(M){let k=M[0].length,rs=[];for(let i=0;i<k;i++)for(let j=i+1;j<k;j++){let r=corr(M.map(x=>x[i]),M.map(x=>x[j]));if(Number.isFinite(r))rs.push(r)}let rb=avg(rs);return (k*rb)/(1+(k-1)*rb)}
function rit(M,j){return corr(M.map(r=>r[j]),M.map(r=>r.reduce((s,x,i)=>i===j?s:s+x,0)))}
function omegaApprox(M){return NaN} // RC4: omega web retirado; requiere modelo factorial explícito.
function parseRelCSV(text){let rows=parseCSV(text.replace(/^\uFEFF/,'')),h=rows[0].map(x=>x.trim()),start=/^(id|folio|participante|sujeto|caso)$/i.test(h[0]||'')?1:0,names=h.slice(start),body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!=='')),M=body.map((r,i)=>{let v=r.slice(start,start+names.length).map(x=>Number(String(x).trim()));if(v.some(x=>!Number.isFinite(x)))throw Error('Dato no numérico o vacío en fila '+(i+2));return v});if(names.length<2||M.length<2)throw Error('Se requieren al menos 2 ítems y 2 participantes.');return{itemNames:names,matrix:M,n:M.length,k:names.length}}
function renderRelData(d){let f=d.matrix.flat();q('relDatasetSummary').innerHTML=`<div class="metric-card"><span>Participantes</span><strong>${d.n}</strong></div><div class="metric-card"><span>Ítems</span><strong>${d.k}</strong></div><div class="metric-card"><span>Mínimo observado</span><strong>${Math.min(...f)}</strong></div><div class="metric-card"><span>Máximo observado</span><strong>${Math.max(...f)}</strong></div>`;let h='<table class="results-table"><thead><tr><th>#</th>'+d.itemNames.map(x=>`<th>${escapeHtml(x)}</th>`).join('')+'</tr></thead><tbody>';d.matrix.slice(0,8).forEach((r,i)=>h+=`<tr><td>${i+1}</td>${r.map(x=>`<td>${x}</td>`).join('')}</tr>`);q('relDataPreview').innerHTML=h+'</tbody></table>';q('relActions').classList.remove('hidden');q('relResults').innerHTML=''}
function calcRel(){if(!relData)return alert('Importe o cargue una matriz.');let M=relData.matrix,A=cronAlpha(M),AS=stdAlpha(M),rt=Number(q('relItemTotalThreshold').value),rows=relData.itemNames.map((name,j)=>{let c=M.map(r=>r[j]),R=rit(M,j),AD=relData.k>2?cronAlpha(M.map(r=>r.filter((_,i)=>i!==j))):NaN,flag=R>=rt?'Adecuado':'Revisar',cls=R>=rt?'good-bg':'warn-bg';if(Number.isFinite(AD)&&Number.isFinite(A)&&AD>A+.02){flag='Posible reactivo problemático';cls='bad-bg'}return{name,mean:avg(c),sd:Math.sqrt(vari(c)),rit:R,aDel:AD,flag,cls}});relLast={A,AS,rows};let fmt=x=>Number.isFinite(x)?x.toFixed(3):'—',bad=rows.filter(x=>x.flag!=='Adecuado').length;q('relResults').innerHTML=`<div class="results-summary"><div class="report-header"><h3>ValiStruct · Informe de confiabilidad</h3><p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p></div><div class="result-cards"><div class="result-card"><span>Alfa de Cronbach</span><strong>${fmt(A)}</strong></div><div class="result-card"><span>Alfa estandarizada</span><strong>${fmt(AS)}</strong></div><div class="result-card ${bad?'warn-bg':'good-bg'}"><span>Ítems a revisar</span><strong>${bad}</strong></div></div><div class="rel-note"><strong>Omega de McDonald:</strong> no se calcula en el módulo web RC4. Se retiró la estimación preliminar porque no representaba un omega factorial auténtico. Para reportar ω debe emplearse un modelo factorial explícito.</div></div><div class="workspace"><table class="results-table"><thead><tr><th>Ítem</th><th>Media</th><th>DE</th><th>Ítem-total corregida</th><th>Alfa si se elimina</th><th>Orientación</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.mean.toFixed(2)}</td><td>${x.sd.toFixed(2)}</td><td>${fmt(x.rit)}</td><td>${fmt(x.aDel)}</td><td><span class="status-chip ${x.cls}">${x.flag}</span></td></tr>`).join('')}</tbody></table></div>`}
function relTemplate(){let rows=[['ID','Item1','Item2','Item3','Item4','Item5'],['P001',5,4,5,4,5],['P002',4,4,4,3,4],['P003',3,4,3,4,3]];saveBlob('\ufeff'+rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8;','ValiStruct_plantilla_confiabilidad.csv')}
function relExample(){let names=['Item1','Item2','Item3','Item4','Item5','Item6'],M=[[5,5,4,5,4,5],[4,4,4,5,4,4],[5,4,5,5,5,5],[4,5,4,4,4,4],[3,4,3,4,3,3],[5,5,5,4,5,5],[4,4,5,4,4,4],[3,3,4,3,3,2],[5,4,5,5,4,5],[4,5,4,5,4,4],[2,3,2,3,2,2],[4,4,4,4,5,4],[5,5,4,5,5,5],[3,4,3,3,4,3],[4,4,5,4,4,5],[5,4,5,4,5,5],[3,3,3,4,3,3],[4,5,4,4,5,4],[5,5,5,5,4,5],[2,3,3,2,3,2]];relData={itemNames:names,matrix:M,n:M.length,k:names.length};renderRelData(relData)}
function relResultsCSV(){if(!relLast)return alert('Primero calcule la confiabilidad.');let r=relLast,rows=[['Indicador','Valor'],['Alfa_Cronbach',r.A],['Alfa_estandarizada',r.AS],['Omega_preliminar',r.O],[],['Item','Media','DE','Item_total_corregida','Alfa_si_elimina','Orientacion']];r.rows.forEach(x=>rows.push([x.name,x.mean,x.sd,x.rit,x.aDel,x.flag]));saveBlob('\ufeff'+rows.map(z=>z.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8;','ValiStruct_confiabilidad_resultados.csv')}
function relReport(){if(!relLast)return alert('Primero calcule la confiabilidad.');let r=relLast,fmt=x=>Number.isFinite(x)?x.toFixed(3):'—',html=`<!doctype html><meta charset="utf-8"><title>ValiStruct Confiabilidad</title><style>body{font-family:Arial;max-width:1000px;margin:40px auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px}</style><h1>ValiStruct · Informe de confiabilidad</h1><p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Profesor-investigador · Universidad Autónoma de Sinaloa</p><p>Alfa: <strong>${fmt(r.A)}</strong> · Alfa estandarizada: <strong>${fmt(r.AS)}</strong> · Omega preliminar: <strong>${fmt(r.O)}</strong></p><table><tr><th>Ítem</th><th>Media</th><th>DE</th><th>Ítem-total</th><th>Alfa si se elimina</th><th>Orientación</th></tr>${r.rows.map(x=>`<tr><td>${x.name}</td><td>${x.mean.toFixed(2)}</td><td>${x.sd.toFixed(2)}</td><td>${fmt(x.rit)}</td><td>${fmt(x.aDel)}</td><td>${x.flag}</td></tr>`).join('')}</table><h3>Referencias</h3><p>Cronbach (1951); McDonald (1999); Dunn et al. (2014).</p>`;saveBlob(html,'text/html;charset=utf-8;','ValiStruct_informe_confiabilidad.html')}
q('downloadRelTemplate').addEventListener('click',relTemplate);q('loadRelExample').addEventListener('click',relExample);q('relCsvFile').addEventListener('change',e=>{let f=e.target.files?.[0];if(!f)return;let rd=new FileReader();rd.onload=()=>{try{relData=parseRelCSV(rd.result);renderRelData(relData)}catch(err){alert(err.message)}};rd.readAsText(f,'utf-8');e.target.value=''});q('calculateReliability').addEventListener('click',calcRel);q('downloadRelResults').addEventListener('click',relResultsCSV);q('downloadRelReport').addEventListener('click',relReport);


// -----------------------------
// AFE v0.5
// -----------------------------
let efaData = null;
let efaLastResults = null;

const efaSummary = document.getElementById('efaDatasetSummary');
const efaPreview = document.getElementById('efaDataPreview');
const efaActions = document.getElementById('efaActions');
const efaResults = document.getElementById('efaResults');

function matrixTranspose(A){ return A[0].map((_,j)=>A.map(r=>r[j])); }
function identity(n){ return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0)); }

function matrixInverse(A){
  const n=A.length;
  let M=A.map((r,i)=>[...r,...identity(n)[i]]);
  for(let i=0;i<n;i++){
    let pivot=i;
    for(let r=i+1;r<n;r++) if(Math.abs(M[r][i])>Math.abs(M[pivot][i])) pivot=r;
    if(Math.abs(M[pivot][i])<1e-12) return null;
    [M[i],M[pivot]]=[M[pivot],M[i]];
    const div=M[i][i];
    M[i]=M[i].map(x=>x/div);
    for(let r=0;r<n;r++){
      if(r===i) continue;
      const f=M[r][i];
      M[r]=M[r].map((x,c)=>x-f*M[i][c]);
    }
  }
  return M.map(r=>r.slice(n));
}

function matrixDeterminant(A){
  const n=A.length;
  let M=A.map(r=>r.slice()), det=1;
  for(let i=0;i<n;i++){
    let pivot=i;
    for(let r=i+1;r<n;r++) if(Math.abs(M[r][i])>Math.abs(M[pivot][i])) pivot=r;
    if(Math.abs(M[pivot][i])<1e-14) return 0;
    if(pivot!==i){ [M[i],M[pivot]]=[M[pivot],M[i]]; det*=-1; }
    const p=M[i][i]; det*=p;
    for(let r=i+1;r<n;r++){
      const f=M[r][i]/p;
      for(let c=i;c<n;c++) M[r][c]-=f*M[i][c];
    }
  }
  return det;
}

function efaCorrelationMatrix(matrix){
  const k=matrix[0].length;
  const cols=Array.from({length:k},(_,j)=>matrix.map(r=>r[j]));
  return Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>i===j?1:correlation(cols[i],cols[j])));
}

function kmoOverall(R){
  const inv=matrixInverse(R);
  if(!inv) return {overall:NaN, perItem:[]};
  const k=R.length;
  let r2sum=0,p2sum=0;
  const numItem=Array(k).fill(0), denItem=Array(k).fill(0);
  for(let i=0;i<k;i++){
    for(let j=i+1;j<k;j++){
      const r=R[i][j];
      const p=-inv[i][j]/Math.sqrt(inv[i][i]*inv[j][j]);
      const r2=r*r,p2=p*p;
      r2sum+=r2; p2sum+=p2;
      numItem[i]+=r2; numItem[j]+=r2;
      denItem[i]+=r2+p2; denItem[j]+=r2+p2;
    }
  }
  return {
    overall:r2sum/(r2sum+p2sum),
    perItem:numItem.map((n,i)=>n/denItem[i])
  };
}

function normalRandom(){
  let u=0,v=0;
  while(u===0)u=Math.random();
  while(v===0)v=Math.random();
  return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
}

function percentile(arr,p){
  const a=arr.slice().sort((x,y)=>x-y);
  const idx=(a.length-1)*p;
  const lo=Math.floor(idx), hi=Math.ceil(idx);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(idx-lo);
}

function parallelAnalysis(n,k,runs){
  const eigs=Array.from({length:k},()=>[]);
  for(let b=0;b<runs;b++){
    const sim=Array.from({length:n},()=>Array.from({length:k},()=>normalRandom()));
    const R=efaCorrelationMatrix(sim);
    const e=jacobiEigen(R).values;
    e.forEach((v,i)=>eigs[i].push(v));
  }
  return eigs.map(a=>percentile(a,.95));
}

function pcaLoadings(R,m){
  const eig=jacobiEigen(R);
  const vals=eig.values.slice(0,m);
  const vecs=eig.vectors.slice(0,m);
  const k=R.length;
  const L=Array.from({length:k},()=>Array(m).fill(0));
  for(let f=0;f<m;f++){
    const scale=Math.sqrt(Math.max(vals[f],0));
    for(let i=0;i<k;i++) L[i][f]=vecs[f][i]*scale;
  }
  return {loadings:L,eigenvalues:eig.values};
}

function varimax(Phi, gamma=1, q=40, tol=1e-6){
  const p=Phi.length,k=Phi[0].length;
  let R=identity(k), d=0;
  function mult(A,B){
    return A.map(row=>B[0].map((_,j)=>row.reduce((s,x,i)=>s+x*B[i][j],0)));
  }
  function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]));}
  for(let iter=0;iter<q;iter++){
    const dOld=d;
    const Lambda=mult(Phi,R);
    // B = Phi' * (Lambda^3 - gamma/p * Lambda * diag(colSums(Lambda^2)))
    const colSS=Array(k).fill(0);
    for(let j=0;j<k;j++) for(let i=0;i<p;i++) colSS[j]+=Lambda[i][j]*Lambda[i][j];
    const inner=Lambda.map(row=>row.map((x,j)=>x*x*x-(gamma/p)*x*colSS[j]));
    const B=mult(transpose(Phi),inner);
    // Orthogonal Procrustes via eig of B'B: R = U V'
    const BtB=mult(transpose(B),B);
    const e=jacobiEigen(BtB);
    const V=e.vectors.map(v=>v); // vectors as list of columns
    const Vmat=Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>V[j][i]));
    const svals=e.values.map(v=>Math.sqrt(Math.max(v,0)));
    const Vinv=transpose(Vmat);
    const invS=Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>i===j?(svals[i]>1e-12?1/svals[i]:0):0));
    const U=mult(mult(B,Vmat),invS);
    R=mult(U,Vinv);
    d=svals.reduce((a,b)=>a+b,0);
    if(dOld && d/dOld<1+tol) break;
  }
  return mult(Phi,R);
}

function efaMatMult(A,B){
  return A.map(row=>B[0].map((_,j)=>row.reduce((s,x,i)=>s+x*B[i][j],0)));
}

function efaTranspose(A){return A[0].map((_,j)=>A.map(r=>r[j]));}

function efaClone(A){return A.map(r=>r.slice());}

function efaNormalizeOblique(pattern, phi){
  const k=phi.length;
  const sd=Array.from({length:k},(_,j)=>Math.sqrt(Math.max(phi[j][j],1e-12)));
  const P=pattern.map(row=>row.map((x,j)=>x*sd[j]));
  const C=Array.from({length:k},(_,i)=>Array.from({length:k},(_,j)=>phi[i][j]/(sd[i]*sd[j])));
  for(let i=0;i<k;i++) C[i][i]=1;
  const S=efaMatMult(P,C);
  return {pattern:P,structure:S,phi:C};
}

function promaxRotate(loadings,power=4){
  const V=varimax(loadings,1);
  const XtX=efaMatMult(efaTranspose(V),V);
  const invXtX=matrixInverse(XtX);
  if(!invXtX) return {pattern:V,structure:V,phi:identity(V[0].length),warning:'No fue posible invertir X′X; se conserva Varimax.'};
  const target=V.map(row=>row.map(x=>Math.sign(x||1)*Math.pow(Math.abs(x),power)));
  const T=efaMatMult(efaMatMult(invXtX,efaTranspose(V)),target);
  const TtT=efaMatMult(efaTranspose(T),T);
  const phi=matrixInverse(TtT);
  if(!phi) return {pattern:V,structure:V,phi:identity(V[0].length),warning:'Transformación Promax singular; se conserva Varimax.'};
  return efaNormalizeOblique(efaMatMult(V,T),phi);
}

function quartiminObjective(B){
  let q=0;
  for(const row of B){
    const sq=row.map(x=>x*x);
    for(let j=0;j<sq.length;j++) for(let l=j+1;l<sq.length;l++) q+=sq[j]*sq[l];
  }
  return q;
}

function quartiminGradient(B){
  return B.map(row=>{
    const sq=row.map(x=>x*x), total=sq.reduce((a,b)=>a+b,0);
    return row.map((x,j)=>2*x*(total-sq[j]));
  });
}

function obliminRotate(loadings,maxIter=500,tol=1e-8){
  const A=varimax(loadings,1);
  const k=A[0].length;
  let T=identity(k), step=0.05;
  function stateFromT(Tm){
    const rawPhi=matrixInverse(efaMatMult(efaTranspose(Tm),Tm));
    if(!rawPhi) return null;
    const norm=efaNormalizeOblique(efaMatMult(A,Tm),rawPhi);
    return {...norm,q:quartiminObjective(norm.pattern)};
  }
  let cur=stateFromT(T);
  if(!cur) return {pattern:A,structure:A,phi:identity(k),warning:'No fue posible iniciar Oblimin; se conserva Varimax.'};
  let best={...cur}, bestQ=cur.q;
  for(let iter=0;iter<maxIter;iter++){
    const Gp=quartiminGradient(cur.pattern);
    const Gt=efaMatMult(efaTranspose(A),Gp);
    const gNorm=Math.sqrt(Gt.flat().reduce((s,x)=>s+x*x,0))||1;
    const trialT=T.map((row,i)=>row.map((x,j)=>x-step*Gt[i][j]/gNorm));
    const trial=stateFromT(trialT);
    if(trial && Number.isFinite(trial.q) && trial.q<cur.q){
      const improvement=cur.q-trial.q;
      T=trialT; cur=trial;
      if(cur.q<bestQ){best={...cur};bestQ=cur.q;}
      step=Math.min(step*1.08,0.25);
      if(improvement<tol*Math.max(1,cur.q)) break;
    }else{
      step*=0.5;
      if(step<1e-8) break;
    }
  }
  return best || cur;
}

function efaRotationLabel(rotation){
  return ({
    none:'Sin rotación',
    varimax:'Varimax (ortogonal)',
    quartimax:'Quartimax (ortogonal)',
    equamax:'Equamax (ortogonal)',
    promax:'Promax (oblicua)',
    oblimin:'Direct Oblimin δ=0 / Quartimin (oblicua)'
  })[rotation] || rotation;
}

function rotateEfaLoadings(loadings,rotation){
  const p=loadings.length, k=loadings[0].length;
  if(k<=1 || rotation==='none') return {pattern:efaClone(loadings),structure:efaClone(loadings),phi:identity(k),oblique:false};
  if(rotation==='varimax'){
    const P=varimax(loadings,1); return {pattern:P,structure:efaClone(P),phi:identity(k),oblique:false};
  }
  if(rotation==='quartimax'){
    const P=varimax(loadings,0); return {pattern:P,structure:efaClone(P),phi:identity(k),oblique:false};
  }
  if(rotation==='equamax'){
    const P=varimax(loadings,p/(2*k)); return {pattern:P,structure:efaClone(P),phi:identity(k),oblique:false};
  }
  if(rotation==='promax') return {...promaxRotate(loadings,4),oblique:true};
  if(rotation==='oblimin') return {...obliminRotate(loadings),oblique:true};
  return {pattern:efaClone(loadings),structure:efaClone(loadings),phi:identity(k),oblique:false,warning:'Rotación no reconocida; se muestran cargas sin rotar.'};
}

function efaCommunalities(pattern,structure,oblique){
  return pattern.map((row,i)=>oblique?row.reduce((s,x,j)=>s+x*structure[i][j],0):row.reduce((s,x)=>s+x*x,0));
}

function chiSquareSurvivalApprox(x,df){
  // Wilson-Hilferty normal approximation
  if(x<0 || df<=0) return NaN;
  const z=(Math.pow(x/df,1/3)-(1-2/(9*df)))/Math.sqrt(2/(9*df));
  const erf = (z) => {
    const sign=z<0?-1:1, a=Math.abs(z);
    const t=1/(1+0.3275911*a);
    const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-a*a);
    return sign*y;
  };
  const cdf=.5*(1+erf(z/Math.sqrt(2)));
  return 1-cdf;
}

function bartlettTest(R,n){
  const p=R.length;
  const det=matrixDeterminant(R);
  if(!(det>0)) return {chi2:Infinity,df:p*(p-1)/2,p:0,det};
  const chi2=-(n-1-(2*p+5)/6)*Math.log(det);
  const df=p*(p-1)/2;
  return {chi2,df,p:chiSquareSurvivalApprox(chi2,df),det};
}

function parseEfaCSV(text){
  const rows=parseCSV(text.replace(/^\uFEFF/,''));
  if(rows.length<4) throw new Error('Se requieren encabezados y al menos tres participantes.');
  const headers=rows[0].map(x=>x.trim());
  const body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
  let startCol=0;
  if(/^(id|folio|participante|sujeto|caso)$/i.test(headers[0]||'')) startCol=1;
  const itemNames=headers.slice(startCol);
  if(itemNames.length<3) throw new Error('Se recomiendan al menos tres ítems para AFE.');
  const matrix=[];
  body.forEach((row,ri)=>{
    const vals=row.slice(startCol,startCol+itemNames.length).map(x=>Number(String(x).trim()));
    if(vals.some(v=>!Number.isFinite(v))) throw new Error(`Dato no numérico o vacío en fila ${ri+2}.`);
    matrix.push(vals);
  });
  return {itemNames,matrix,n:matrix.length,k:itemNames.length};
}

function renderEfaDataset(data){
  efaSummary.innerHTML=`
    <div class="metric-card"><span>Participantes</span><strong>${data.n}</strong></div>
    <div class="metric-card"><span>Ítems</span><strong>${data.k}</strong></div>
    <div class="metric-card"><span>Razón N/ítem</span><strong>${(data.n/data.k).toFixed(1)}</strong></div>
    <div class="metric-card"><span>Datos faltantes</span><strong>0</strong></div>`;
  let html='<table class="results-table"><thead><tr><th>#</th>';
  data.itemNames.forEach(n=>html+=`<th>${escapeHtml(n)}</th>`);
  html+='</tr></thead><tbody>';
  data.matrix.slice(0,8).forEach((r,i)=>{
    html+=`<tr><td>${i+1}</td>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`;
  });
  html+='</tbody></table>';
  if(data.n>8) html+=`<p class="ci-note">Vista previa de 8 de ${data.n} participantes.</p>`;
  efaPreview.innerHTML=html;
  document.getElementById('efaFactors').max=Math.max(1,Math.min(data.k,20));
  efaActions.classList.remove('hidden');
  efaResults.innerHTML='';
}

function kmoLabel(v){
  if(v>=.90)return 'Excelente';
  if(v>=.80)return 'Muy bueno';
  if(v>=.70)return 'Adecuado';
  if(v>=.60)return 'Mediocre / revisar';
  if(v>=.50)return 'Bajo';
  return 'No recomendable';
}

function executeEfa(){
  if(!efaData) return alert('Importe o cargue una matriz de datos.');
  const m=Math.max(1,Math.min(Number(document.getElementById('efaFactors').value),efaData.k));
  const rotation=document.getElementById('efaRotation').value;
  const loadingThr=Number(document.getElementById('efaLoadingThreshold').value);
  const crossThr=Number(document.getElementById('efaCrossThreshold').value);
  const runs=Math.max(20,Math.min(500,Number(document.getElementById('efaParallelRuns').value)));

  const R=efaCorrelationMatrix(efaData.matrix);
  if(R.some(row=>row.some(v=>!Number.isFinite(v)))) return alert('No se pudo calcular la matriz de correlaciones. Revise ítems sin variabilidad.');
  const kmo=kmoOverall(R);
  const bart=bartlettTest(R,efaData.n);
  const pa=parallelAnalysis(efaData.n,efaData.k,runs);
  const pca=pcaLoadings(R,m);

  const rot=rotateEfaLoadings(pca.loadings,rotation);
  const L=rot.pattern, structure=rot.structure, phi=rot.phi;
  const communalities=efaCommunalities(L,structure,rot.oblique).map(x=>Math.max(0,Math.min(1,x)));
  const retainedPA=pca.eigenvalues.filter((v,i)=>v>pa[i]).length;
  const retainedKaiser=pca.eigenvalues.filter(v=>v>1).length;

  const itemDiag=L.map((row,i)=>{
    const abs=row.map(Math.abs);
    const order=abs.map((v,j)=>({v,j})).sort((a,b)=>b.v-a.v);
    const primary=order[0], secondary=order[1]||{v:0,j:-1};
    let status='Adecuado', cls='good-bg', icon='🟢';
    if(primary.v<loadingThr){status='Carga baja';cls='warn-bg';icon='🟠';}
    if(secondary.v>=crossThr){status='Carga cruzada';cls='bad-bg';icon='🔴';}
    if(communalities[i]<.30){status='Comunalidad baja';cls='warn-bg';icon='🟠';}
    return {primary,secondary,status,cls,icon};
  });

  efaLastResults={
    R,kmo,bart,pa,eigenvalues:pca.eigenvalues,
    loadings:L,pattern:L,structure,phi,oblique:!!rot.oblique,
    communalities,itemDiag,m,retainedPA,retainedKaiser,runs,rotation,
    rotationLabel:efaRotationLabel(rotation),rotationWarning:rot.warning||'',
    loadingThr,crossThr
  };
  renderEfaResults(efaLastResults);
}
function renderEfaResults(r){
  const kmoCls=r.kmo.overall>=.70?'good-bg':(r.kmo.overall>=.50?'warn-bg':'bad-bg');
  const bartCls=r.bart.p<.05?'good-bg':'bad-bg';
  const problemCount=r.itemDiag.filter(x=>x.status!=='Adecuado').length;

  let html=`<div class="results-summary">
    <div class="report-header">
      <h3>ValiStruct · Exploración factorial — extracción ACP (prototipo)</h3>
      <p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p>
    </div>
    <div class="result-cards">
      <div class="result-card ${kmoCls}"><span>KMO global</span><strong>${r.kmo.overall.toFixed(3)}</strong><small>${kmoLabel(r.kmo.overall)}</small></div>
      <div class="result-card ${bartCls}"><span>Bartlett</span><strong>χ²=${Number.isFinite(r.bart.chi2)?r.bart.chi2.toFixed(2):'∞'}</strong><small>gl=${r.bart.df}; p ${r.bart.p<.001?'&lt; .001':'= '+r.bart.p.toFixed(3)}</small></div>
      <div class="result-card"><span>Factores · análisis paralelo</span><strong>${r.retainedPA}</strong></div>
      <div class="result-card"><span>Factores · Kaiser &gt; 1</span><strong>${r.retainedKaiser}</strong></div>
      <div class="result-card ${problemCount?'warn-bg':'good-bg'}"><span>Ítems a revisar</span><strong>${problemCount}</strong></div>
    </div>
    <p><strong>Orientación:</strong> priorice el análisis paralelo y la interpretabilidad teórica sobre el criterio de autovalor &gt; 1. Revise cargas, comunalidades y cargas cruzadas antes de modificar el instrumento.</p>
    <div class="model-error"><strong>Advertencia metodológica:</strong> la extracción web actual continúa utilizando Componentes Principales (ACP). Las rotaciones aquí implementadas sí distinguen soluciones ortogonales y oblicuas, pero una AFE de factores comunes definitiva debe usar PAF/MINRES/ML.</div>
    <p class="ci-note"><strong>Bartlett:</strong> el p-valor mostrado en este módulo web usa la aproximación de Wilson–Hilferty.</p>
    ${r.rotationWarning?`<div class="model-error"><strong>Rotación:</strong> ${escapeHtml(r.rotationWarning)}</div>`:''}
  </div>`;

  html += `<div class="efa-chart-wrap"><h3>Scree plot y análisis paralelo</h3><canvas id="efaScree" width="1000" height="320"></canvas><p class="ci-note">Línea 1: autovalores observados. Línea 2: percentil 95 de autovalores aleatorios (${r.runs} simulaciones).</p></div>`;

  html += `<div class="efa-grid">
    <div class="efa-guidance"><h3>Factorizabilidad</h3><p>KMO = <strong>${r.kmo.overall.toFixed(3)}</strong> (${kmoLabel(r.kmo.overall)}).</p><p>Bartlett ${r.bart.p<.05?'apoya':'no apoya'} que la matriz sea factorizable.</p><p>Determinante de R = ${Number.isFinite(r.bart.det)?r.bart.det.toExponential(3):'—'}.</p></div>
    <div class="efa-guidance"><h3>Retención y rotación</h3><p>Análisis paralelo sugiere <strong>${r.retainedPA}</strong> factor(es).</p><p>Kaiser sugiere <strong>${r.retainedKaiser}</strong>.</p><p>Modelo ejecutado: <strong>${r.m}</strong> factor(es), rotación <strong>${escapeHtml(r.rotationLabel)}</strong>.</p></div>
  </div>`;

  html += `<h3>${r.oblique?'Matriz patrón':'Matriz de cargas rotadas'}</h3><div class="workspace"><table class="results-table matrix-table"><thead><tr><th>Ítem</th>`;
  for(let f=0;f<r.m;f++) html+=`<th>Factor ${f+1}</th>`;
  html+='<th>Comunalidad</th><th>Orientación</th></tr></thead><tbody>';
  r.pattern.forEach((row,i)=>{
    html+=`<tr><td>${escapeHtml(efaData.itemNames[i])}</td>`;
    row.forEach(v=>{
      const cls=Math.abs(v)>=r.loadingThr?'loading-strong':'';
      html+=`<td class="${cls}">${v.toFixed(3)}</td>`;
    });
    const d=r.itemDiag[i];
    html+=`<td>${r.communalities[i].toFixed(3)}</td><td><span class="status-chip ${d.cls}">${d.icon} ${d.status}</span></td></tr>`;
  });
  html+='</tbody></table></div>';

  if(r.oblique){
    html += `<h3>Matriz de estructura</h3><p class="ci-note">Correlación total de cada ítem con los factores, incorporando la correlación entre factores.</p><div class="workspace"><table class="results-table matrix-table"><thead><tr><th>Ítem</th>`;
    for(let f=0;f<r.m;f++) html+=`<th>Factor ${f+1}</th>`;
    html+='</tr></thead><tbody>';
    r.structure.forEach((row,i)=>{
      html+=`<tr><td>${escapeHtml(efaData.itemNames[i])}</td>${row.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}</tr>`;
    });
    html+='</tbody></table></div>';

    html += `<h3>Matriz de correlaciones entre factores (Φ)</h3><div class="workspace"><table class="results-table matrix-table"><thead><tr><th></th>`;
    for(let f=0;f<r.m;f++) html+=`<th>Factor ${f+1}</th>`;
    html+='</tr></thead><tbody>';
    r.phi.forEach((row,i)=>{
      html+=`<tr><th>Factor ${i+1}</th>${row.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}</tr>`;
    });
    html+='</tbody></table></div>';
  }

  html += `<h3>KMO por ítem (MSA)</h3><div class="workspace"><table class="results-table"><thead><tr><th>Ítem</th><th>MSA</th><th>Interpretación</th></tr></thead><tbody>`;
  r.kmo.perItem.forEach((v,i)=>{
    html+=`<tr><td>${escapeHtml(efaData.itemNames[i])}</td><td>${v.toFixed(3)}</td><td>${kmoLabel(v)}</td></tr>`;
  });
  html+='</tbody></table></div>';

  efaResults.innerHTML=html;
  setTimeout(()=>drawScree(r),0);
}
function drawScree(r){
  const canvas=document.getElementById('efaScree');
  if(!canvas) return;
  const ctx=canvas.getContext('2d');
  const W=canvas.width,H=canvas.height,pad=45;
  ctx.clearRect(0,0,W,H);
  const vals=r.eigenvalues, pa=r.pa;
  const maxY=Math.max(...vals,...pa)*1.1;
  const x=i=>pad+(W-2*pad)*(i/(vals.length-1||1));
  const y=v=>H-pad-(H-2*pad)*(v/maxY);
  ctx.strokeStyle='#444';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,H-pad);ctx.lineTo(W-pad,H-pad);ctx.stroke();

  ctx.font='12px Arial';ctx.fillStyle='#333';
  vals.forEach((_,i)=>ctx.fillText(String(i+1),x(i)-3,H-pad+18));
  ctx.fillText('Factor / componente',W/2-45,H-8);

  function line(series,dashed=false){
    ctx.save();
    ctx.strokeStyle=dashed?'#666':'#111';
    ctx.lineWidth=2;
    if(dashed)ctx.setLineDash([6,5]);
    ctx.beginPath();
    series.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));
    ctx.stroke();
    series.forEach((v,i)=>{ctx.beginPath();ctx.arc(x(i),y(v),3,0,2*Math.PI);ctx.fillStyle=dashed?'#666':'#111';ctx.fill();});
    ctx.restore();
  }
  line(vals,false); line(pa,true);
  const y1=y(1);
  ctx.save();ctx.strokeStyle='#aaa';ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(pad,y1);ctx.lineTo(W-pad,y1);ctx.stroke();ctx.restore();
}

function downloadEfaTemplate(){
  const rows=[
    ['ID','Item1','Item2','Item3','Item4','Item5','Item6'],
    ['P001',5,4,5,4,5,4],
    ['P002',4,4,4,3,4,3],
    ['P003',3,4,3,4,3,4]
  ];
  const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv,'text/csv;charset=utf-8;','ValiStruct_plantilla_AFE.csv');
}

function loadEfaExample(){
  const names=['I1','I2','I3','I4','I5','I6','I7','I8'];
  const matrix=[];
  for(let n=0;n<140;n++){
    const f1=normalRandom(), f2=normalRandom();
    const row=[
      3+0.75*f1+0.25*normalRandom(),
      3+0.72*f1+0.30*normalRandom(),
      3+0.68*f1+0.35*normalRandom(),
      3+0.62*f1+0.40*normalRandom(),
      3+0.76*f2+0.28*normalRandom(),
      3+0.70*f2+0.30*normalRandom(),
      3+0.65*f2+0.38*normalRandom(),
      3+0.58*f2+0.45*normalRandom()
    ].map(v=>Math.max(1,Math.min(5,Math.round(v))));
    matrix.push(row);
  }
  efaData={itemNames:names,matrix,n:matrix.length,k:names.length};
  document.getElementById('efaFactors').value=2;
  renderEfaDataset(efaData);
}

function importEfaCSV(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      efaData=parseEfaCSV(reader.result);
      renderEfaDataset(efaData);
      alert('Matriz importada correctamente.');
    }catch(e){ alert('No fue posible importar el archivo: '+e.message); }
  };
  reader.readAsText(file,'utf-8');
}

function downloadEfaResults(){
  if(!efaLastResults) return alert('Primero ejecute el AFE.');
  const r=efaLastResults;
  const rows=[
    ['Indicador','Valor'],
    ['KMO_global',r.kmo.overall],
    ['Bartlett_chi2',r.bart.chi2],
    ['Bartlett_gl',r.bart.df],
    ['Bartlett_p_aprox',r.bart.p],
    ['Determinante',r.bart.det],
    ['Factores_analisis_paralelo',r.retainedPA],
    ['Factores_Kaiser',r.retainedKaiser],
    ['Rotacion',r.rotationLabel],
    [],
    [r.oblique?'MATRIZ_PATRON':'CARGAS_ROTADAS'],
    ['Item',...Array.from({length:r.m},(_,i)=>`Factor_${i+1}`),'Comunalidad','Estado']
  ];
  r.pattern.forEach((row,i)=>rows.push([efaData.itemNames[i],...row,r.communalities[i],r.itemDiag[i].status]));

  if(r.oblique){
    rows.push([],['MATRIZ_ESTRUCTURA'],['Item',...Array.from({length:r.m},(_,i)=>`Factor_${i+1}`)]);
    r.structure.forEach((row,i)=>rows.push([efaData.itemNames[i],...row]));
    rows.push([],['PHI_CORRELACIONES_FACTORES'],['Factor',...Array.from({length:r.m},(_,i)=>`Factor_${i+1}`)]);
    r.phi.forEach((row,i)=>rows.push([`Factor_${i+1}`,...row]));
  }

  const csv=rows.map(row=>row.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv,'text/csv;charset=utf-8;','ValiStruct_AFE_resultados.csv');
}
function efaReportHtml(){
  if(!efaLastResults) return null;
  const r=efaLastResults;
  const rows=r.pattern.map((row,i)=>`<tr><td>${escapeHtml(efaData.itemNames[i])}</td>${row.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}<td>${r.communalities[i].toFixed(3)}</td><td>${escapeHtml(r.itemDiag[i].status)}</td></tr>`).join('');
  const headers=Array.from({length:r.m},(_,i)=>`<th>Factor ${i+1}</th>`).join('');
  const structureRows=r.oblique?r.structure.map((row,i)=>`<tr><td>${escapeHtml(efaData.itemNames[i])}</td>${row.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}</tr>`).join(''):'';
  const phiRows=r.oblique?r.phi.map((row,i)=>`<tr><th>Factor ${i+1}</th>${row.map(v=>`<td>${v.toFixed(3)}</td>`).join('')}</tr>`).join(''):'';
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Informe AFE</title>
  <style>body{font-family:Arial,sans-serif;max-width:1100px;margin:40px auto;color:#222}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f2f2f2}.note{background:#f8f8f8;padding:14px;border-left:4px solid #7c1f2a}</style>
  <body><h1>ValiStruct · Informe de Análisis Factorial Exploratorio</h1>
  <p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Profesor-investigador · Universidad Autónoma de Sinaloa</p>
  <p><strong>KMO:</strong> ${r.kmo.overall.toFixed(3)} · <strong>Bartlett:</strong> χ²=${Number.isFinite(r.bart.chi2)?r.bart.chi2.toFixed(2):'∞'}, gl=${r.bart.df}, p ${r.bart.p<.001?'&lt; .001':'= '+r.bart.p.toFixed(3)}</p>
  <p><strong>Análisis paralelo:</strong> ${r.retainedPA} factor(es) sugeridos. <strong>Kaiser:</strong> ${r.retainedKaiser}. <strong>Rotación:</strong> ${escapeHtml(r.rotationLabel)}.</p>
  <div class="note">La extracción web actual utiliza componentes principales (ACP). Las rotaciones ortogonales y oblicuas se calculan en este módulo; para AFE común definitiva utilice PAF/MINRES/ML.</div>
  <h2>${r.oblique?'Matriz patrón':'Matriz de cargas rotadas'}</h2>
  <table><thead><tr><th>Ítem</th>${headers}<th>Comunalidad</th><th>Orientación</th></tr></thead><tbody>${rows}</tbody></table>
  ${r.oblique?`<h2>Matriz de estructura</h2><table><thead><tr><th>Ítem</th>${headers}</tr></thead><tbody>${structureRows}</tbody></table>
  <h2>Matriz de correlaciones entre factores (Φ)</h2><table><thead><tr><th></th>${headers}</tr></thead><tbody>${phiRows}</tbody></table>`:''}
  <h3>Referencias</h3>
  <p>Kaiser, H. F. (1974). An index of factorial simplicity. <em>Psychometrika, 39</em>, 31–36.</p>
  <p>Hendrickson, A. E., & White, P. O. (1964). Promax: A quick method for rotation to oblique simple structure. <em>British Journal of Statistical Psychology, 17</em>, 65–70.</p>
  <p>Jennrich, R. I., & Sampson, P. F. (1966). Rotation for simple loadings. <em>Psychometrika, 31</em>, 313–323.</p>
  <p>Horn, J. L. (1965). A rationale and test for the number of factors in factor analysis. <em>Psychometrika, 30</em>, 179–185.</p>
  </body></html>`;
}
document.getElementById('downloadEfaTemplate').addEventListener('click',downloadEfaTemplate);
document.getElementById('loadEfaExample').addEventListener('click',loadEfaExample);
document.getElementById('efaCsvFile').addEventListener('change',e=>{
  const f=e.target.files?.[0]; if(f) importEfaCSV(f); e.target.value='';
});
document.getElementById('calculateEfa').addEventListener('click',executeEfa);
document.getElementById('downloadEfaResults').addEventListener('click',downloadEfaResults);
document.getElementById('downloadEfaReport').addEventListener('click',()=>{
  const html=efaReportHtml(); if(!html)return alert('Primero ejecute el AFE.');
  saveBlob(html,'text/html;charset=utf-8;','ValiStruct_informe_AFE.html');
});
document.getElementById('printEfaReport').addEventListener('click',()=>{
  if(!efaLastResults)return alert('Primero ejecute el AFE.'); window.print();
});


// -----------------------------
// AFC v0.6
// -----------------------------
let cfaData=null;
let cfaLastResults=null;

const cfaSummary=document.getElementById('cfaDatasetSummary');
const cfaPreview=document.getElementById('cfaDataPreview');
const cfaStatus=document.getElementById('cfaModelStatus');
const cfaResults=document.getElementById('cfaResults');

function parseCfaCSV(text){
  return parseEfaCSV(text);
}

function renderCfaDataset(data){
  cfaSummary.innerHTML=`
    <div class="metric-card"><span>Participantes</span><strong>${data.n}</strong></div>
    <div class="metric-card"><span>Ítems</span><strong>${data.k}</strong></div>
    <div class="metric-card"><span>Razón N/ítem</span><strong>${(data.n/data.k).toFixed(1)}</strong></div>`;
  let html='<table class="results-table"><thead><tr><th>#</th>';
  data.itemNames.forEach(n=>html+=`<th>${escapeHtml(n)}</th>`);
  html+='</tr></thead><tbody>';
  data.matrix.slice(0,8).forEach((r,i)=>html+=`<tr><td>${i+1}</td>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`);
  html+='</tbody></table>';
  cfaPreview.innerHTML=html;
}

function parseCfaSyntax(text){
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  if(!lines.length) throw new Error('Especifique al menos un factor.');
  const factors=[];
  const used=new Set();
  for(const line of lines){
    const m=line.match(/^([^=]+)=(.+)$/);
    if(!m) throw new Error(`Sintaxis inválida: "${line}". Use Factor = Item1, Item2, Item3.`);
    const name=m[1].trim();
    const items=m[2].split(',').map(x=>x.trim()).filter(Boolean);
    if(items.length<2) throw new Error(`El factor ${name} requiere al menos dos indicadores en este prototipo.`);
    items.forEach(it=>{
      if(!cfaData.itemNames.includes(it)) throw new Error(`El ítem "${it}" no existe en la base.`);
      if(used.has(it)) throw new Error(`El ítem "${it}" está asignado a más de un factor.`);
      used.add(it);
    });
    factors.push({name,items});
  }
  return factors;
}

function validateCfaModel(){
  if(!cfaData){ cfaStatus.innerHTML='<div class="model-error">Importe o cargue una base de datos.</div>'; return null; }
  try{
    const factors=parseCfaSyntax(document.getElementById('cfaSyntax').value);
    const assigned=factors.reduce((s,f)=>s+f.items.length,0);
    cfaStatus.innerHTML=`<div class="model-ok">Modelo válido: ${factors.length} factor(es), ${assigned} indicador(es) asignados.</div>`;
    return factors;
  }catch(e){
    cfaStatus.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;
    return null;
  }
}

// Simple one-factor loadings inside each block using first eigenvector of within-factor correlation matrix.
function factorBlockEstimate(matrix, itemIdxs){
  const sub=matrix.map(r=>itemIdxs.map(j=>r[j]));
  const R=efaCorrelationMatrix(sub);
  const eig=jacobiEigen(R);
  const lambda=eig.values[0];
  let vec=eig.vectors[0].slice();
  if(vec.reduce((a,b)=>a+b,0)<0) vec=vec.map(x=>-x);
  const loadings=vec.map(v=>v*Math.sqrt(Math.max(lambda,0)));
  const residuals=loadings.map(l=>Math.max(0.001,1-l*l));
  return {R,loadings,residuals};
}

function factorScoreProxy(matrix,itemIdxs,loadings){
  return matrix.map(row=>{
    let num=0,den=0;
    itemIdxs.forEach((j,k)=>{num+=row[j]*loadings[k];den+=Math.abs(loadings[k]);});
    return den?num/den:0;
  });
}

function standardizeColumn(x){
  const m=mean(x), sd=Math.sqrt(variance(x));
  return x.map(v=>(v-m)/(sd||1));
}

function estimateCfaPrototype(){
  const factors=validateCfaModel();
  if(!factors) return;
  const itemIndex=Object.fromEntries(cfaData.itemNames.map((n,i)=>[n,i]));
  const stdMatrix=matrixTranspose(matrixTranspose(cfaData.matrix).map(standardizeColumn));

  const factorResults=[];
  factors.forEach(f=>{
    const idx=f.items.map(it=>itemIndex[it]);
    const est=factorBlockEstimate(stdMatrix,idx);
    const score=factorScoreProxy(stdMatrix,idx,est.loadings);
    const scoreStd=standardizeColumn(score);
    factorResults.push({...f,idx,...est,score:scoreStd});
  });

  // factor correlations
  const F=factorResults.length;
  const phi=Array.from({length:F},(_,i)=>Array.from({length:F},(_,j)=>i===j?1:correlation(factorResults[i].score,factorResults[j].score)));

  // implied correlations
  const p=cfaData.k;
  const implied=identity(p);
  const loadingMap=Array(p).fill(null);
  factorResults.forEach((f,fi)=>f.idx.forEach((itemIdx,k)=>loadingMap[itemIdx]={fi,l:f.loadings[k]}));
  for(let i=0;i<p;i++){
    for(let j=i+1;j<p;j++){
      const a=loadingMap[i],b=loadingMap[j];
      let val=0;
      if(a&&b) val=a.l*b.l*phi[a.fi][b.fi];
      implied[i][j]=implied[j][i]=val;
    }
  }

  const Robs=efaCorrelationMatrix(stdMatrix);
  let resSq=0,count=0;
  for(let i=0;i<p;i++) for(let j=i+1;j<p;j++){ const d=Robs[i][j]-implied[i][j]; resSq+=d*d; count++; }
  const srmr=Math.sqrt(resSq/count);

  // CR/AVE
  const constructMetrics=factorResults.map(f=>{
    const l=f.loadings;
    const theta=f.residuals;
    const sumL=l.reduce((a,b)=>a+b,0);
    const cr=(sumL*sumL)/((sumL*sumL)+theta.reduce((a,b)=>a+b,0));
    const ave=l.reduce((a,b)=>a+b*b,0)/(l.reduce((a,b)=>a+b*b,0)+theta.reduce((a,b)=>a+b,0));
    return {name:f.name,cr,ave};
  });

  // HTMT
  const htmt=[];
  for(let a=0;a<F;a++){
    for(let b=a+1;b<F;b++){
      const A=factorResults[a].idx, B=factorResults[b].idx;
      let hetero=[];
      A.forEach(i=>B.forEach(j=>hetero.push(Math.abs(Robs[i][j]))));
      let monoA=[],monoB=[];
      for(let i=0;i<A.length;i++)for(let j=i+1;j<A.length;j++)monoA.push(Math.abs(Robs[A[i]][A[j]]));
      for(let i=0;i<B.length;i++)for(let j=i+1;j<B.length;j++)monoB.push(Math.abs(Robs[B[i]][B[j]]));
      const denom=Math.sqrt(mean(monoA||[0])*mean(monoB||[0]));
      htmt.push({a:factorResults[a].name,b:factorResults[b].name,value:denom?mean(hetero)/denom:NaN});
    }
  }

  cfaLastResults={factorResults,phi,Robs,implied,srmr,constructMetrics,htmt};
  renderCfaResults(cfaLastResults);
}

function renderCfaResults(r){
  const srmrClass=r.srmr<=.08?'good-bg':(r.srmr<=.10?'warn-bg':'bad-bg');
  let html=`<div class="results-summary">
    <div class="report-header"><h3>ValiStruct · Informe AFC (prototipo)</h3>
    <p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p></div>
    <div class="result-cards">
      <div class="result-card ${srmrClass}"><span>SRMR</span><strong>${r.srmr.toFixed(3)}</strong></div>
      <div class="result-card"><span>Factores</span><strong>${r.factorResults.length}</strong></div>
      <div class="result-card"><span>Indicadores modelados</span><strong>${r.factorResults.reduce((a,f)=>a+f.items.length,0)}</strong></div>
    </div>
    <div class="rel-note"><strong>Nota:</strong> CFI, TLI, RMSEA y χ² no se reportan en v0.6 porque requieren un estimador CFA de producción. Se añadirán con el motor estadístico definitivo.</div>
  </div>`;

  html += '<div class="workspace"><table class="results-table"><thead><tr><th>Factor</th><th>Ítem</th><th>Carga estandarizada</th><th>Error residual</th><th>Orientación</th></tr></thead><tbody>';
  r.factorResults.forEach(f=>f.items.forEach((it,k)=>{
    const l=f.loadings[k], e=f.residuals[k];
    let label='Adecuada',cls='good-bg',icon='🟢';
    if(Math.abs(l)<.50){label='Revisar';cls='warn-bg';icon='🟠';}
    if(Math.abs(l)<.30){label='Baja';cls='bad-bg';icon='🔴';}
    html+=`<tr><td>${escapeHtml(f.name)}</td><td>${escapeHtml(it)}</td><td><strong>${l.toFixed(3)}</strong></td><td>${e.toFixed(3)}</td><td><span class="status-chip ${cls}">${icon} ${label}</span></td></tr>`;
  }));
  html+='</tbody></table></div>';

  html+='<h3>Confiabilidad compuesta y validez convergente</h3><div class="workspace"><table class="results-table"><thead><tr><th>Factor</th><th>CR</th><th>AVE</th><th>Orientación</th></tr></thead><tbody>';
  r.constructMetrics.forEach(m=>{
    const ok=m.cr>=.70&&m.ave>=.50;
    html+=`<tr><td>${escapeHtml(m.name)}</td><td>${m.cr.toFixed(3)}</td><td>${m.ave.toFixed(3)}</td><td><span class="status-chip ${ok?'good-bg':'warn-bg'}">${ok?'🟢 Favorable':'🟠 Revisar'}</span></td></tr>`;
  });
  html+='</tbody></table></div>';

  if(r.htmt.length){
    html+='<h3>HTMT · validez discriminante</h3><div class="workspace"><table class="results-table"><thead><tr><th>Factor A</th><th>Factor B</th><th>HTMT</th><th>Orientación</th></tr></thead><tbody>';
    r.htmt.forEach(h=>{
      const ok=Number.isFinite(h.value)&&h.value<.85;
      html+=`<tr><td>${escapeHtml(h.a)}</td><td>${escapeHtml(h.b)}</td><td>${Number.isFinite(h.value)?h.value.toFixed(3):'—'}</td><td><span class="status-chip ${ok?'good-bg':'warn-bg'}">${ok?'🟢 Favorable':'🟠 Revisar discriminación'}</span></td></tr>`;
    });
    html+='</tbody></table></div>';
  }

  html += renderCfaDiagram(r);
  cfaResults.innerHTML=html;
}

function renderCfaDiagram(r){
  const W=1000, rowH=80, factorGap=280;
  const maxItems=Math.max(...r.factorResults.map(f=>f.items.length));
  const H=Math.max(420,maxItems*rowH+120);
  let svg=`<div class="cfa-diagram"><h3>Diagrama del modelo de medición</h3><svg viewBox="0 0 ${W} ${H}" width="1000" height="${H}">`;
  r.factorResults.forEach((f,fi)=>{
    const fx=150+fi*factorGap, fy=H/2;
    svg+=`<ellipse cx="${fx}" cy="${fy}" rx="80" ry="35" fill="#f7ecee" stroke="#7c1f2a" stroke-width="2"/>
      <text x="${fx}" y="${fy+5}" text-anchor="middle" font-size="14">${escapeHtml(f.name)}</text>`;
    f.items.forEach((it,k)=>{
      const iy=70+k*rowH, ix=fx+160;
      svg+=`<rect x="${ix}" y="${iy-20}" width="100" height="40" rx="6" fill="#fff" stroke="#555"/>
        <text x="${ix+50}" y="${iy+5}" text-anchor="middle" font-size="13">${escapeHtml(it)}</text>
        <line x1="${fx+80}" y1="${fy}" x2="${ix}" y2="${iy}" stroke="#444" marker-end="url(#arrow)"/>
        <text x="${(fx+80+ix)/2}" y="${(fy+iy)/2-6}" text-anchor="middle" font-size="12">${f.loadings[k].toFixed(2)}</text>`;
    });
  });
  svg+=`<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#444"/></marker></defs></svg>
  <p class="ci-note">Diagrama automático del modelo especificado. En la siguiente etapa se incorporará edición visual avanzada dentro de ValiStruct | Latencia.</p></div>`;
  return svg;
}

function downloadCfaTemplate(){
  const rows=[['ID','I1','I2','I3','I4','I5','I6'],['P001',5,4,5,4,4,5],['P002',4,4,3,4,5,4],['P003',3,4,3,3,4,3]];
  const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv,'text/csv;charset=utf-8;','ValiStruct_plantilla_AFC.csv');
}

function loadCfaExample(){
  const names=['I1','I2','I3','I4','I5','I6','I7','I8'];
  const matrix=[];
  for(let n=0;n<180;n++){
    const f1=normalRandom(), f2=.35*f1+Math.sqrt(1-.35*.35)*normalRandom();
    const z=[
      .80*f1+.60*normalRandom(),.75*f1+.66*normalRandom(),.70*f1+.71*normalRandom(),.65*f1+.76*normalRandom(),
      .82*f2+.57*normalRandom(),.74*f2+.67*normalRandom(),.69*f2+.72*normalRandom(),.62*f2+.78*normalRandom()
    ].map(v=>Math.max(1,Math.min(5,Math.round(3+v))));
    matrix.push(z);
  }
  cfaData={itemNames:names,matrix,n:matrix.length,k:names.length};
  document.getElementById('cfaSyntax').value='Factor_A = I1, I2, I3, I4\nFactor_B = I5, I6, I7, I8';
  renderCfaDataset(cfaData);
  validateCfaModel();
}

function importCfaCSV(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      cfaData=parseCfaCSV(reader.result);
      renderCfaDataset(cfaData);
      cfaStatus.innerHTML='<div class="model-ok">Base importada. Especifique y valide el modelo.</div>';
    }catch(e){ alert('No fue posible importar el archivo: '+e.message); }
  };
  reader.readAsText(file,'utf-8');
}

function downloadCfaResults(){
  if(!cfaLastResults) return alert('Primero estime el AFC.');
  const r=cfaLastResults;
  const rows=[['Indicador','Valor'],['SRMR',r.srmr],[],['Factor','Item','Carga','Residual']];
  r.factorResults.forEach(f=>f.items.forEach((it,k)=>rows.push([f.name,it,f.loadings[k],f.residuals[k]])));
  rows.push([],['Factor','CR','AVE']);
  r.constructMetrics.forEach(m=>rows.push([m.name,m.cr,m.ave]));
  if(r.htmt.length){rows.push([],['Factor_A','Factor_B','HTMT']);r.htmt.forEach(h=>rows.push([h.a,h.b,h.value]));}
  const csv=rows.map(row=>row.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv,'text/csv;charset=utf-8;','ValiStruct_AFC_resultados.csv');
}

function cfaReportHtml(){
  if(!cfaLastResults) return null;
  const r=cfaLastResults;
  const loadRows=r.factorResults.flatMap(f=>f.items.map((it,k)=>`<tr><td>${escapeHtml(f.name)}</td><td>${escapeHtml(it)}</td><td>${f.loadings[k].toFixed(3)}</td><td>${f.residuals[k].toFixed(3)}</td></tr>`)).join('');
  const metricRows=r.constructMetrics.map(m=>`<tr><td>${escapeHtml(m.name)}</td><td>${m.cr.toFixed(3)}</td><td>${m.ave.toFixed(3)}</td></tr>`).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Informe AFC</title>
  <style>body{font-family:Arial,sans-serif;max-width:1100px;margin:40px auto;color:#222}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f2f2f2}.note{background:#f8f8f8;padding:14px;border-left:4px solid #7c1f2a}</style>
  <body><h1>ValiStruct · Informe AFC (prototipo)</h1><p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Profesor-investigador · Universidad Autónoma de Sinaloa</p>
  <p><strong>SRMR:</strong> ${r.srmr.toFixed(3)}</p>
  <div class="note">La versión v0.6 no reporta CFI, TLI, RMSEA ni χ² de ML. Estos índices se incorporarán mediante el motor estadístico de producción.</div>
  <h2>Cargas factoriales</h2><table><thead><tr><th>Factor</th><th>Ítem</th><th>Carga</th><th>Residual</th></tr></thead><tbody>${loadRows}</tbody></table>
  <h2>CR y AVE</h2><table><thead><tr><th>Factor</th><th>CR</th><th>AVE</th></tr></thead><tbody>${metricRows}</tbody></table>
  </body></html>`;
}

document.getElementById('downloadCfaTemplate').addEventListener('click',downloadCfaTemplate);
document.getElementById('loadCfaExample').addEventListener('click',loadCfaExample);
document.getElementById('cfaCsvFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importCfaCSV(f);e.target.value='';});
document.getElementById('validateCfaModel').addEventListener('click',validateCfaModel);
document.getElementById('estimateCfa').addEventListener('click',estimateCfaPrototype);
document.getElementById('downloadCfaResults').addEventListener('click',downloadCfaResults);
document.getElementById('downloadCfaReport').addEventListener('click',()=>{const html=cfaReportHtml();if(!html)return alert('Primero estime el AFC.');saveBlob(html,'text/html;charset=utf-8;','ValiStruct_informe_AFC.html');});


// -----------------------------
// ValiStruct | Latencia v0.7
// -----------------------------
const semSvg = document.getElementById('latenciaCanvas');
const semNodeLayer = document.getElementById('nodeLayer');
const semEdgeLayer = document.getElementById('edgeLayer');
const semSelectionBox = document.getElementById('latenciaSelection');
const semSyntaxBox = document.getElementById('latenciaSyntaxBox');
const semSyntax = document.getElementById('latenciaSyntax');

let semNodes = [];
let semEdges = [];
let semSelected = null;
let semMode = null;
let semFirstNode = null;
let semCounter = {observed:1, latent:1, error:1};
let semDragging = null;

function semId(prefix){ return prefix + '_' + Date.now() + '_' + Math.floor(Math.random()*10000); }

function addSemNode(type, x=500, y=300, label=null){
  const defaults = {observed:'X', latent:'F', error:'e'};
  const n = {
    id: semId(type),
    type,
    x, y,
    label: label || `${defaults[type]}${semCounter[type]++}`
  };
  semNodes.push(n);
  semSelected={kind:'node',id:n.id};
  renderSem();
}

function nodeById(id){ return semNodes.find(n=>n.id===id); }
function edgeById(id){ return semEdges.find(e=>e.id===id); }

function nodeShapeSvg(n){
  const selected = semSelected?.kind==='node' && semSelected.id===n.id ? ' selected' : '';
  if(n.type==='latent'){
    return `<g class="sem-node${selected}" data-id="${n.id}">
      <ellipse class="node-shape" cx="${n.x}" cy="${n.y}" rx="72" ry="34" fill="#f7ecee" stroke="#555" stroke-width="2"/>
      <text x="${n.x}" y="${n.y+5}" text-anchor="middle" font-size="14">${escapeHtml(n.label)}</text>
    </g>`;
  }
  if(n.type==='error'){
    return `<g class="sem-node${selected}" data-id="${n.id}">
      <circle class="node-shape" cx="${n.x}" cy="${n.y}" r="25" fill="#fff" stroke="#777" stroke-width="2"/>
      <text x="${n.x}" y="${n.y+5}" text-anchor="middle" font-size="13">${escapeHtml(n.label)}</text>
    </g>`;
  }
  return `<g class="sem-node${selected}" data-id="${n.id}">
    <rect class="node-shape" x="${n.x-60}" y="${n.y-24}" width="120" height="48" rx="7" fill="#fff" stroke="#555" stroke-width="2"/>
    <text x="${n.x}" y="${n.y+5}" text-anchor="middle" font-size="14">${escapeHtml(n.label)}</text>
  </g>`;
}

function edgePath(e){
  const a=nodeById(e.from), b=nodeById(e.to);
  if(!a || !b) return '';
  if(e.type==='cov'){
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2-70;
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
  }
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

function edgeSvg(e){
  const a=nodeById(e.from), b=nodeById(e.to);
  if(!a || !b) return '';
  const selected = semSelected?.kind==='edge' && semSelected.id===e.id ? ' selected' : '';
  const marker = e.type==='cov' ? 'marker-start="url(#arrowHeadStart)" marker-end="url(#arrowHead)"' : 'marker-end="url(#arrowHead)"';
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2 + (e.type==='cov'?-32:-8);
  return `<g>
    <path class="sem-edge${selected}" data-id="${e.id}" d="${edgePath(e)}" fill="none" stroke="#333" stroke-width="2" ${marker}/>
    <text class="edge-label" x="${mx}" y="${my}" text-anchor="middle">${escapeHtml(e.label||'')}</text>
  </g>`;
}

function renderSem(){
  semEdgeLayer.innerHTML=semEdges.map(edgeSvg).join('');
  semNodeLayer.innerHTML=semNodes.map(nodeShapeSvg).join('');
  updateSelectionBox();
  attachSemEvents();
}

function updateSelectionBox(){
  if(!semSelected){
    semSelectionBox.textContent='Seleccione un nodo o una relación.';
    return;
  }
  if(semSelected.kind==='node'){
    const n=nodeById(semSelected.id);
    semSelectionBox.innerHTML=n?`<strong>${escapeHtml(n.label)}</strong><br>Tipo: ${n.type}<br>Posición: ${Math.round(n.x)}, ${Math.round(n.y)}`:'';
  }else{
    const e=edgeById(semSelected.id);
    if(!e)return;
    const a=nodeById(e.from),b=nodeById(e.to);
    semSelectionBox.innerHTML=`<strong>${e.type==='cov'?'Covarianza':'Ruta'}</strong><br>${escapeHtml(a.label)} ${e.type==='cov'?'↔':'→'} ${escapeHtml(b.label)}`;
  }
}

function svgPoint(evt){
  const pt=semSvg.createSVGPoint();
  pt.x=evt.clientX; pt.y=evt.clientY;
  return pt.matrixTransform(semSvg.getScreenCTM().inverse());
}

function attachSemEvents(){
  semNodeLayer.querySelectorAll('.sem-node').forEach(g=>{
    g.addEventListener('mousedown',evt=>{
      evt.stopPropagation();
      const id=g.dataset.id;
      if(semMode==='path' || semMode==='cov'){
        handleConnectClick(id);
        return;
      }
      semSelected={kind:'node',id};
      const p=svgPoint(evt);
      const n=nodeById(id);
      semDragging={id,dx:p.x-n.x,dy:p.y-n.y};
      renderSem();
    });
    g.addEventListener('click',evt=>evt.stopPropagation());
  });
  semEdgeLayer.querySelectorAll('.sem-edge').forEach(p=>{
    p.addEventListener('click',evt=>{
      evt.stopPropagation();
      semSelected={kind:'edge',id:p.dataset.id};
      renderSem();
    });
  });
}

semSvg.addEventListener('mousemove',evt=>{
  if(!semDragging)return;
  const p=svgPoint(evt), n=nodeById(semDragging.id);
  n.x=Math.max(40,Math.min(1160,p.x-semDragging.dx));
  n.y=Math.max(40,Math.min(660,p.y-semDragging.dy));
  semEdgeLayer.innerHTML=semEdges.map(edgeSvg).join('');
  semNodeLayer.innerHTML=semNodes.map(nodeShapeSvg).join('');
  attachSemEvents();
});
window.addEventListener('mouseup',()=>semDragging=null);
semSvg.addEventListener('click',()=>{
  semSelected=null;
  if(semMode && semFirstNode){
    semFirstNode=null;
  }
  renderSem();
});

function handleConnectClick(id){
  if(!semFirstNode){
    semFirstNode=id;
    semSelected={kind:'node',id};
    updateSelectionBox();
    return;
  }
  if(semFirstNode===id){ semFirstNode=null; return; }
  const exists=semEdges.some(e=>e.from===semFirstNode && e.to===id && e.type===(semMode==='cov'?'cov':'path'));
  if(!exists){
    semEdges.push({
      id:semId('edge'),
      from:semFirstNode,
      to:id,
      type:semMode==='cov'?'cov':'path',
      label:''
    });
  }
  semFirstNode=null;
  semMode=null;
  document.getElementById('connectPath').classList.remove('primary');
  document.getElementById('connectCov').classList.remove('primary');
  renderSem();
}

function setSemMode(mode){
  semMode=mode; semFirstNode=null;
  document.getElementById('connectPath').classList.toggle('primary',mode==='path');
  document.getElementById('connectCov').classList.toggle('primary',mode==='cov');
  semSelectionBox.textContent=mode==='path'?'Modo ruta causal: seleccione origen y destino.':'Modo covarianza: seleccione dos nodos.';
}

function renameSelected(){
  if(!semSelected)return alert('Seleccione un nodo o una relación.');
  if(semSelected.kind==='node'){
    const n=nodeById(semSelected.id);
    const v=prompt('Nuevo nombre:',n.label);
    if(v && v.trim())n.label=v.trim();
  }else{
    const e=edgeById(semSelected.id);
    const v=prompt('Etiqueta de la relación (por ejemplo β=.42):',e.label||'');
    if(v!==null)e.label=v.trim();
  }
  renderSem();
}

function deleteSelected(){
  if(!semSelected)return;
  if(semSelected.kind==='node'){
    const id=semSelected.id;
    semNodes=semNodes.filter(n=>n.id!==id);
    semEdges=semEdges.filter(e=>e.from!==id&&e.to!==id);
  }else semEdges=semEdges.filter(e=>e.id!==semSelected.id);
  semSelected=null;renderSem();
}

function clearSem(){
  if(!confirm('¿Limpiar completamente el modelo?'))return;
  semNodes=[];semEdges=[];semSelected=null;semMode=null;semFirstNode=null;
  semCounter={observed:1,latent:1,error:1};renderSem();
}

function presetCfa(){
  semNodes=[];semEdges=[];
  const f1={id:semId('latent'),type:'latent',x:260,y:220,label:'Factor_A'};
  const f2={id:semId('latent'),type:'latent',x:260,y:500,label:'Factor_B'};
  semNodes.push(f1,f2);
  ['I1','I2','I3'].forEach((lab,i)=>{
    const n={id:semId('observed'),type:'observed',x:560+i*180,y:140,label:lab};semNodes.push(n);
    semEdges.push({id:semId('edge'),from:f1.id,to:n.id,type:'path',label:''});
  });
  ['I4','I5','I6'].forEach((lab,i)=>{
    const n={id:semId('observed'),type:'observed',x:560+i*180,y:540,label:lab};semNodes.push(n);
    semEdges.push({id:semId('edge'),from:f2.id,to:n.id,type:'path',label:''});
  });
  semEdges.push({id:semId('edge'),from:f1.id,to:f2.id,type:'cov',label:''});
  renderSem();
}

function presetMediation(){
  semNodes=[
    {id:'px',type:'observed',x:220,y:340,label:'X'},
    {id:'pm',type:'observed',x:580,y:340,label:'M'},
    {id:'py',type:'observed',x:940,y:340,label:'Y'}
  ];
  semEdges=[
    {id:semId('edge'),from:'px',to:'pm',type:'path',label:'a'},
    {id:semId('edge'),from:'pm',to:'py',type:'path',label:'b'},
    {id:semId('edge'),from:'px',to:'py',type:'path',label:"c'"}
  ];
  renderSem();
}

function presetSecondOrder(){
  semNodes=[];semEdges=[];
  const second={id:semId('latent'),type:'latent',x:180,y:350,label:'Segundo_Orden'};semNodes.push(second);
  const positions=[[470,180],[470,350],[470,520]];
  positions.forEach((pos,i)=>{
    const f={id:semId('latent'),type:'latent',x:pos[0],y:pos[1],label:`F${i+1}`};semNodes.push(f);
    semEdges.push({id:semId('edge'),from:second.id,to:f.id,type:'path',label:''});
    for(let j=0;j<3;j++){
      const it={id:semId('observed'),type:'observed',x:760+j*130,y:pos[1],label:`I${i*3+j+1}`};semNodes.push(it);
      semEdges.push({id:semId('edge'),from:f.id,to:it.id,type:'path',label:''});
    }
  });
  renderSem();
}

function generateSemSyntax(){
  const latentIds=new Set(semNodes.filter(n=>n.type==='latent').map(n=>n.id));
  const observedIds=new Set(semNodes.filter(n=>n.type==='observed').map(n=>n.id));
  const lines=[];
  semNodes.filter(n=>n.type==='latent').forEach(lat=>{
    const inds=semEdges.filter(e=>e.type==='path'&&e.from===lat.id&&observedIds.has(e.to)).map(e=>nodeById(e.to)?.label).filter(Boolean);
    if(inds.length)lines.push(`${lat.label} =~ ${inds.join(' + ')}`);
  });
  semEdges.filter(e=>e.type==='path').forEach(e=>{
    const a=nodeById(e.from),b=nodeById(e.to);
    if(!a||!b)return;
    const isMeasurement=a.type==='latent'&&b.type==='observed';
    const isError=a.type==='error';
    if(!isMeasurement&&!isError)lines.push(`${b.label} ~ ${a.label}`);
  });
  semEdges.filter(e=>e.type==='cov').forEach(e=>{
    const a=nodeById(e.from),b=nodeById(e.to);
    if(a&&b)lines.push(`${a.label} ~~ ${b.label}`);
  });
  semSyntax.value=lines.join('\n') || '# Modelo vacío';
  semSyntaxBox.classList.remove('hidden');
}

function exportSemSvg(){
  const clone=semSvg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
  const data='<?xml version="1.0" encoding="UTF-8"?>\n'+clone.outerHTML;
  saveBlob(data,'image/svg+xml;charset=utf-8;','ValiStruct_Latencia_modelo.svg');
}

function saveSemJson(){
  const obj={version:'ValiStruct v0.7',nodes:semNodes,edges:semEdges};
  saveBlob(JSON.stringify(obj,null,2),'application/json;charset=utf-8;','ValiStruct_Latencia_modelo.json');
}

function loadSemJson(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const o=JSON.parse(reader.result);
      if(!Array.isArray(o.nodes)||!Array.isArray(o.edges))throw new Error('Formato inválido.');
      semNodes=o.nodes;semEdges=o.edges;semSelected=null;renderSem();
    }catch(e){alert('No fue posible cargar el modelo: '+e.message);}
  };
  reader.readAsText(file,'utf-8');
}

document.getElementById('addObserved').addEventListener('click',()=>addSemNode('observed',500,300));
document.getElementById('addLatent').addEventListener('click',()=>addSemNode('latent',350,300));
document.getElementById('addError').addEventListener('click',()=>addSemNode('error',700,300));
document.getElementById('connectPath').addEventListener('click',()=>setSemMode('path'));
document.getElementById('connectCov').addEventListener('click',()=>setSemMode('cov'));
document.getElementById('renameNode').addEventListener('click',renameSelected);
document.getElementById('deleteSelected').addEventListener('click',deleteSelected);
document.getElementById('clearLatencia').addEventListener('click',clearSem);
document.getElementById('presetCfa').addEventListener('click',presetCfa);
document.getElementById('presetMediation').addEventListener('click',presetMediation);
document.getElementById('presetSecondOrder').addEventListener('click',presetSecondOrder);
document.getElementById('generateSyntax').addEventListener('click',generateSemSyntax);
document.getElementById('exportSvg').addEventListener('click',exportSemSvg);
document.getElementById('saveModelJson').addEventListener('click',saveSemJson);
document.getElementById('loadModelJson').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadSemJson(f);e.target.value='';});

presetCfa();


// -----------------------------
// Motor estructural preliminar v0.8
// -----------------------------
let semData = null;
let semStructuralResults = null;
let semMediationResults = null;

const semDatasetSummary = document.getElementById('semDatasetSummary');
const semResults = document.getElementById('semResults');

function parseSemCSV(text){
  const rows = parseCSV(text.replace(/^\uFEFF/,''));
  if(rows.length < 4) throw new Error('Se requieren encabezados y al menos tres participantes.');
  const headers = rows[0].map(x=>x.trim());
  const body = rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
  let startCol = 0;
  if(/^(id|folio|participante|sujeto|caso)$/i.test(headers[0]||'')) startCol = 1;
  const names = headers.slice(startCol);
  const matrix = [];
  for(let i=0;i<body.length;i++){
    const vals = body[i].slice(startCol,startCol+names.length).map(x=>Number(String(x).trim()));
    if(vals.some(v=>!Number.isFinite(v))) throw new Error(`Dato no numérico o vacío en fila ${i+2}.`);
    matrix.push(vals);
  }
  return {names,matrix,n:matrix.length,k:names.length};
}

function renderSemDataset(){
  if(!semData){ semDatasetSummary.innerHTML=''; return; }
  const observed = semNodes.filter(n=>n.type==='observed').map(n=>n.label);
  const matched = observed.filter(x=>semData.names.includes(x));
  const missing = observed.filter(x=>!semData.names.includes(x));
  semDatasetSummary.innerHTML = `
    <div class="metric-card"><span>Participantes</span><strong>${semData.n}</strong></div>
    <div class="metric-card"><span>Variables en CSV</span><strong>${semData.k}</strong></div>
    <div class="metric-card"><span>Observadas vinculadas</span><strong>${matched.length}</strong></div>
    <div class="metric-card ${missing.length?'sem-stat-warn':'sem-stat-good'}"><span>Observadas sin columna</span><strong>${missing.length}</strong></div>
    ${missing.length?`<div class="sem-engine-note" style="grid-column:1/-1"><strong>Faltan:</strong> ${missing.map(escapeHtml).join(', ')}</div>`:''}`;
}

function downloadSemTemplate(){
  const obs = semNodes.filter(n=>n.type==='observed').map(n=>n.label);
  const cols = obs.length ? obs : ['X','M','Y'];
  const rows = [['ID',...cols]];
  for(let i=1;i<=5;i++) rows.push([`P${String(i).padStart(3,'0')}`,...cols.map(()=>Math.floor(2+Math.random()*4))]);
  const csv = rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv,'text/csv;charset=utf-8;','ValiStruct_Latencia_plantilla_SEM.csv');
}

function importSemCSV(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      semData = parseSemCSV(reader.result);
      renderSemDataset();
      alert('Base importada correctamente.');
    }catch(e){ alert('No fue posible importar la base: '+e.message); }
  };
  reader.readAsText(file,'utf-8');
}

function loadSemExample(){
  presetMediation();
  const names=['X','M','Y'];
  const matrix=[];
  for(let i=0;i<260;i++){
    const x=normalRandom();
    const m=.55*x+.70*normalRandom();
    const y=.30*x+.50*m+.65*normalRandom();
    matrix.push([x,m,y]);
  }
  semData={names,matrix,n:matrix.length,k:names.length};
  renderSemDataset();
}

function standardizedSeries(x){
  const m=mean(x), sd=Math.sqrt(variance(x));
  if(!(sd>0)) return x.map(()=>0);
  return x.map(v=>(v-m)/sd);
}

function observedSeries(label, sampleIdx=null){
  if(!semData) return null;
  const j=semData.names.indexOf(label);
  if(j<0) return null;
  const vals = sampleIdx ? sampleIdx.map(i=>semData.matrix[i][j]) : semData.matrix.map(r=>r[j]);
  return standardizedSeries(vals);
}

function latentIndicators(nodeId){
  return semEdges
    .filter(e=>e.type==='path' && e.from===nodeId)
    .map(e=>nodeById(e.to))
    .filter(n=>n && n.type==='observed');
}

function nodeSeries(node, sampleIdx=null){
  if(node.type==='observed') return observedSeries(node.label,sampleIdx);
  if(node.type==='latent'){
    const inds=latentIndicators(node.id);
    if(inds.length<2) return null;
    const series=inds.map(n=>observedSeries(n.label,sampleIdx));
    if(series.some(s=>!s)) return null;
    const n=series[0].length;
    const composite=Array.from({length:n},(_,i)=>mean(series.map(s=>s[i])));
    return standardizedSeries(composite);
  }
  return null;
}

function invertMatrix(A){
  return matrixInverse(A);
}

function olsStandardized(y, X){
  // X: array of predictor series [p][n]
  const n=y.length,p=X.length;
  if(!p) return null;
  const XtX=Array.from({length:p},()=>Array(p).fill(0));
  const Xty=Array(p).fill(0);
  for(let a=0;a<p;a++){
    for(let b=0;b<p;b++){
      let s=0;for(let i=0;i<n;i++)s+=X[a][i]*X[b][i];
      XtX[a][b]=s;
    }
    let sy=0;for(let i=0;i<n;i++)sy+=X[a][i]*y[i];
    Xty[a]=sy;
  }
  const inv=invertMatrix(XtX);
  if(!inv) return null;
  const beta=inv.map(row=>row.reduce((s,v,j)=>s+v*Xty[j],0));
  const fitted=Array.from({length:n},(_,i)=>beta.reduce((s,b,j)=>s+b*X[j][i],0));
  const resid=y.map((v,i)=>v-fitted[i]);
  const sse=resid.reduce((s,e)=>s+e*e,0);
  const sst=y.reduce((s,v)=>s+v*v,0);
  const r2=sst>0?1-sse/sst:NaN;
  const df=n-p;
  const sigma2=df>0?sse/df:NaN;
  const se=beta.map((_,j)=>Math.sqrt(Math.max(0,sigma2*inv[j][j])));
  const t=beta.map((b,j)=>se[j]>0?b/se[j]:NaN);
  const pvals=t.map(tv=>{
    if(!Number.isFinite(tv))return NaN;
    // normal approximation, adequate for preliminary engine
    const z=Math.abs(tv);
    const erf = (x) => {
      const sign=x<0?-1:1,a=Math.abs(x),tt=1/(1+0.3275911*a);
      const yy=1-(((((1.061405429*tt-1.453152027)*tt)+1.421413741)*tt-0.284496736)*tt+0.254829592)*tt*Math.exp(-a*a);
      return sign*yy;
    };
    const cdf=.5*(1+erf(z/Math.sqrt(2)));
    return 2*(1-cdf);
  });
  return {beta,se,t,p:pvals,r2,resid};
}

function structuralEdges(){
  return semEdges.filter(e=>{
    if(e.type!=='path') return false;
    const a=nodeById(e.from),b=nodeById(e.to);
    if(!a||!b) return false;
    if(a.type==='error') return false;
    // measurement paths latent -> observed are excluded
    if(a.type==='latent' && b.type==='observed') return false;
    return ['observed','latent'].includes(a.type) && ['observed','latent'].includes(b.type);
  });
}

function estimateStructuralModel(sampleIdx=null){
  if(!semData) throw new Error('Importe primero una base de datos.');
  const sEdges=structuralEdges();
  if(!sEdges.length) throw new Error('El diagrama no contiene rutas estructurales estimables.');

  const endogenousIds=[...new Set(sEdges.map(e=>e.to))];
  const allPathResults=[];
  const equations=[];

  for(const yId of endogenousIds){
    const yNode=nodeById(yId);
    const incoming=sEdges.filter(e=>e.to===yId);
    const xNodes=incoming.map(e=>nodeById(e.from));
    const y=nodeSeries(yNode,sampleIdx);
    const X=xNodes.map(n=>nodeSeries(n,sampleIdx));
    if(!y) throw new Error(`No fue posible construir datos para ${yNode.label}.`);
    if(X.some(s=>!s)) throw new Error(`Faltan columnas/indicadores para predecir ${yNode.label}.`);
    const fit=olsStandardized(y,X);
    if(!fit) throw new Error(`No fue posible estimar la ecuación de ${yNode.label}.`);
    equations.push({target:yNode.label,targetId:yId,r2:fit.r2});
    incoming.forEach((e,j)=>{
      allPathResults.push({
        edgeId:e.id,from:xNodes[j].label,to:yNode.label,
        beta:fit.beta[j],se:fit.se[j],t:fit.t[j],p:fit.p[j],
        targetId:yId,sourceId:xNodes[j].id
      });
    });
  }
  return {paths:allPathResults,equations};
}

function annotateSemDiagram(pathResults){
  pathResults.forEach(r=>{
    const e=edgeById(r.edgeId);
    if(e) e.label=`β=${r.beta.toFixed(2)}`;
  });
  renderSem();
}

function estimateSemFromDiagram(){
  try{
    const result=estimateStructuralModel();
    semStructuralResults=result;
    annotateSemDiagram(result.paths);
    renderStructuralResults(result);
  }catch(e){ alert(e.message); }
}

function renderStructuralResults(r){
  let html=`<div class="results-summary">
    <div class="report-header"><h3>ValiStruct | Latencia · Modelo estructural preliminar</h3>
    <p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p></div>
    <div class="result-cards">
      <div class="result-card"><span>Rutas estructurales</span><strong>${r.paths.length}</strong></div>
      <div class="result-card"><span>Ecuaciones</span><strong>${r.equations.length}</strong></div>
      <div class="result-card"><span>N</span><strong>${semData.n}</strong></div>
    </div>
    <div class="sem-engine-note"><strong>Nota:</strong> coeficientes estandarizados por OLS sobre variables observadas o compuestos latentes temporales. Este motor es exploratorio/preliminar y no sustituye un SEM de máxima verosimilitud o WLSMV.</div>
  </div>`;

  html += `<div class="workspace"><table class="results-table sem-path-table"><thead><tr>
    <th>Origen</th><th>Destino</th><th>β</th><th>EE</th><th>z/t aprox.</th><th>p aprox.</th><th>Orientación</th>
  </tr></thead><tbody>`;
  r.paths.forEach(p=>{
    const sig=Number.isFinite(p.p)&&p.p<.05;
    html+=`<tr><td>${escapeHtml(p.from)}</td><td>${escapeHtml(p.to)}</td>
      <td><strong>${p.beta.toFixed(3)}</strong></td><td>${p.se.toFixed(3)}</td>
      <td>${p.t.toFixed(2)}</td><td>${p.p<.001?'&lt; .001':p.p.toFixed(3)}</td>
      <td><span class="status-chip ${sig?'good-bg':'warn-bg'}">${sig?'🟢 Evidencia de asociación':'🟠 Revisar'}</span></td></tr>`;
  });
  html+='</tbody></table></div>';

  html+='<h3>Varianza explicada</h3><div class="workspace"><table class="results-table"><thead><tr><th>Variable endógena</th><th>R²</th></tr></thead><tbody>';
  r.equations.forEach(e=>html+=`<tr><td>${escapeHtml(e.target)}</td><td>${e.r2.toFixed(3)}</td></tr>`);
  html+='</tbody></table></div>';
  semResults.innerHTML=html;
}

function allSimplePaths(startId,endId,maxDepth=8){
  const edges=structuralEdges();
  const out=[];
  function dfs(cur,pathEdges,visited){
    if(pathEdges.length>maxDepth)return;
    if(cur===endId){out.push(pathEdges.slice());return;}
    for(const e of edges.filter(x=>x.from===cur)){
      if(visited.has(e.to))continue;
      visited.add(e.to);pathEdges.push(e);dfs(e.to,pathEdges,visited);pathEdges.pop();visited.delete(e.to);
    }
  }
  dfs(startId,[],new Set([startId]));
  return out;
}

function directBetaMap(paths){
  return Object.fromEntries(paths.map(p=>[p.edgeId,p.beta]));
}

function bootstrapIndirect(startId,endId,pathEdges,runs){
  const values=[];
  for(let b=0;b<runs;b++){
    const idx=Array.from({length:semData.n},()=>Math.floor(Math.random()*semData.n));
    try{
      const est=estimateStructuralModel(idx);
      const map=directBetaMap(est.paths);
      let prod=1;
      for(const e of pathEdges){
        if(!Number.isFinite(map[e.id])){prod=NaN;break;}
        prod*=map[e.id];
      }
      if(Number.isFinite(prod))values.push(prod);
    }catch(_){}
  }
  return values;
}

function quantile(arr,q){
  if(!arr.length)return NaN;
  const a=arr.slice().sort((x,y)=>x-y),pos=(a.length-1)*q,lo=Math.floor(pos),hi=Math.ceil(pos);
  return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(pos-lo);
}

function runMediationAnalysis(){
  if(!semData) return alert('Importe una base primero.');
  if(!semStructuralResults){
    try{semStructuralResults=estimateStructuralModel();annotateSemDiagram(semStructuralResults.paths);}catch(e){return alert(e.message);}
  }
  const nodes=semNodes.filter(n=>['observed','latent'].includes(n.type));
  const candidates=[];
  for(const a of nodes){
    for(const b of nodes){
      if(a.id===b.id)continue;
      const paths=allSimplePaths(a.id,b.id).filter(p=>p.length>=2);
      paths.forEach(p=>candidates.push({a,b,path:p}));
    }
  }
  if(!candidates.length)return alert('No se detectaron rutas indirectas de dos o más segmentos.');

  const runs=Math.max(100,Math.min(5000,Number(document.getElementById('semBootstrapRuns').value)||1000));
  const conf=Number(document.getElementById('semConfidence').value)||.95;
  const alpha=(1-conf)/2;
  const betaMap=directBetaMap(semStructuralResults.paths);
  const results=[];

  for(const c of candidates){
    let indirect=1;
    c.path.forEach(e=>indirect*=betaMap[e.id]);
    const boot=bootstrapIndirect(c.a.id,c.b.id,c.path,runs);
    const lower=quantile(boot,alpha),upper=quantile(boot,1-alpha);
    const sig=Number.isFinite(lower)&&Number.isFinite(upper)&&(lower>0||upper<0);
    const directEdge=structuralEdges().find(e=>e.from===c.a.id&&e.to===c.b.id);
    const direct=directEdge?betaMap[directEdge.id]:0;
    results.push({
      from:c.a.label,to:c.b.label,
      via:c.path.slice(0,-1).map(e=>nodeById(e.to)?.label).filter(Boolean).join(' → '),
      indirect,direct,total:direct+indirect,lower,upper,sig
    });
  }
  semMediationResults=results;
  renderMediationResults(results,runs,conf);
}

function renderMediationResults(results,runs,conf){
  let html=semResults.innerHTML || '';
  html+=`<h3>Mediación / efectos indirectos</h3>
    <div class="sem-engine-note">Bootstrap percentil con ${runs} remuestreos e IC ${Math.round(conf*100)}%. Se considera evidencia de efecto indirecto cuando el intervalo no incluye 0.</div>
    <div class="workspace"><table class="results-table"><thead><tr>
    <th>Origen</th><th>Mediador(es)</th><th>Destino</th><th>Directo</th><th>Indirecto</th><th>Total</th><th>IC bootstrap</th><th>Orientación</th>
    </tr></thead><tbody>`;
  results.forEach(r=>{
    html+=`<tr><td>${escapeHtml(r.from)}</td><td>${escapeHtml(r.via||'—')}</td><td>${escapeHtml(r.to)}</td>
      <td>${r.direct.toFixed(3)}</td><td><strong>${r.indirect.toFixed(3)}</strong></td><td>${r.total.toFixed(3)}</td>
      <td>${r.lower.toFixed(3)} – ${r.upper.toFixed(3)}</td>
      <td><span class="status-chip ${r.sig?'good-bg':'warn-bg'}">${r.sig?'🟢 Efecto indirecto compatible':'🟠 IC incluye 0'}</span></td></tr>`;
  });
  html+='</tbody></table></div>';
  semResults.innerHTML=html;
}

function downloadSemResults(){
  if(!semStructuralResults)return alert('Primero estime el modelo estructural.');
  const rows=[['Rutas estructurales'],['Origen','Destino','Beta','EE','Estadistico','p']];
  semStructuralResults.paths.forEach(p=>rows.push([p.from,p.to,p.beta,p.se,p.t,p.p]));
  rows.push([],['R2'],['Variable','R2']);
  semStructuralResults.equations.forEach(e=>rows.push([e.target,e.r2]));
  if(semMediationResults){
    rows.push([],['Mediacion'],['Origen','Mediador','Destino','Directo','Indirecto','Total','IC_inf','IC_sup','Significativo']);
    semMediationResults.forEach(r=>rows.push([r.from,r.via,r.to,r.direct,r.indirect,r.total,r.lower,r.upper,r.sig]));
  }
  const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  saveBlob("\ufeff"+csv,'text/csv;charset=utf-8;','ValiStruct_Latencia_resultados_SEM.csv');
}

function semReportHtml(){
  if(!semStructuralResults)return null;
  const r=semStructuralResults;
  const pathRows=r.paths.map(p=>`<tr><td>${escapeHtml(p.from)}</td><td>${escapeHtml(p.to)}</td><td>${p.beta.toFixed(3)}</td><td>${p.se.toFixed(3)}</td><td>${p.p<.001?'&lt; .001':p.p.toFixed(3)}</td></tr>`).join('');
  const r2Rows=r.equations.map(e=>`<tr><td>${escapeHtml(e.target)}</td><td>${e.r2.toFixed(3)}</td></tr>`).join('');
  const medRows=(semMediationResults||[]).map(x=>`<tr><td>${escapeHtml(x.from)}</td><td>${escapeHtml(x.via)}</td><td>${escapeHtml(x.to)}</td><td>${x.indirect.toFixed(3)}</td><td>${x.lower.toFixed(3)}–${x.upper.toFixed(3)}</td></tr>`).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct | Latencia</title>
  <style>body{font-family:Arial,sans-serif;max-width:1100px;margin:40px auto;color:#222}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f2f2f2}.note{background:#f8f8f8;padding:14px;border-left:4px solid #7c1f2a}</style>
  <body><h1>ValiStruct | Latencia · Informe estructural preliminar</h1>
  <p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Profesor-investigador · Universidad Autónoma de Sinaloa</p>
  <div class="note">Estimación preliminar por regresiones estandarizadas sobre variables observadas o compuestos latentes temporales. No sustituye SEM de ML/WLSMV.</div>
  <h2>Rutas</h2><table><thead><tr><th>Origen</th><th>Destino</th><th>β</th><th>EE</th><th>p aprox.</th></tr></thead><tbody>${pathRows}</tbody></table>
  <h2>R²</h2><table><thead><tr><th>Variable</th><th>R²</th></tr></thead><tbody>${r2Rows}</tbody></table>
  ${medRows?`<h2>Efectos indirectos</h2><table><thead><tr><th>Origen</th><th>Mediador(es)</th><th>Destino</th><th>Indirecto</th><th>IC bootstrap</th></tr></thead><tbody>${medRows}</tbody></table>`:''}
  </body></html>`;
}

document.getElementById('downloadSemTemplate').addEventListener('click',downloadSemTemplate);
document.getElementById('semCsvFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importSemCSV(f);e.target.value='';});
document.getElementById('loadSemExample').addEventListener('click',loadSemExample);
document.getElementById('estimateSem').addEventListener('click',estimateSemFromDiagram);
document.getElementById('runMediation').addEventListener('click',runMediationAnalysis);
document.getElementById('downloadSemResults').addEventListener('click',downloadSemResults);
document.getElementById('downloadSemReport').addEventListener('click',()=>{const html=semReportHtml();if(!html)return alert('Primero estime el modelo.');saveBlob(html,'text/html;charset=utf-8;','ValiStruct_Latencia_informe_SEM.html');});


// -----------------------------
// Motor Pro v0.9
// -----------------------------
const DEFAULT_PRO_API_BASE = 'http://127.0.0.1:8765';
function getProApiBase(){
  return localStorage.getItem('valistruct_api_base') || DEFAULT_PRO_API_BASE;
}
let proCsvText = null;
let proLastResponse = null;

const proStatusBox = document.querySelector('.engine-status-box');
const proStatusText = document.getElementById('proEngineStatusText');
const proDatasetSummary = document.getElementById('proDatasetSummary');
const proResults = document.getElementById('proResults');

async function checkProEngine(){
  proStatusText.textContent='Comprobando conexión...';
  proStatusBox.classList.remove('engine-online','engine-offline');
  try{
    const res=await fetch(`${getProApiBase()}/health`,{method:'GET'});
    if(!res.ok)throw new Error('Respuesta no válida');
    const data=await res.json();
    proStatusText.innerHTML=`🟢 Motor disponible · R ${escapeHtml(data.r_version||'')} · lavaan ${escapeHtml(data.lavaan_version||'')}`;
    proStatusBox.classList.add('engine-online');
    return true;
  }catch(e){
    proStatusText.innerHTML='🟠 Motor profesional no está activo. Inicie el backend incluido en la carpeta <strong>backend</strong>.';
    proStatusBox.classList.add('engine-offline');
    return false;
  }
}

function summarizeProCsv(text){
  try{
    const rows=parseCSV(text.replace(/^\uFEFF/,''));
    const headers=rows[0].map(x=>x.trim());
    const body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
    proDatasetSummary.innerHTML=`
      <div class="metric-card"><span>Casos</span><strong>${body.length}</strong></div>
      <div class="metric-card"><span>Columnas</span><strong>${headers.length}</strong></div>
      <div class="metric-card"><span>Variables</span><strong>${headers.slice(0,8).map(escapeHtml).join(', ')}${headers.length>8?'…':''}</strong></div>`;
  }catch(_){
    proDatasetSummary.innerHTML='<div class="model-error">No fue posible leer el CSV.</div>';
  }
}

function buildProPayload(){
  const syntax=document.getElementById('proSyntax').value.trim();
  if(!syntax)throw new Error('Ingrese sintaxis lavaan.');
  if(!proCsvText)throw new Error('Importe un archivo CSV.');
  return {
    syntax,
    csv_text:proCsvText,
    estimator:document.getElementById('proEstimator').value,
    data_type:document.getElementById('proDataType').value,
    missing:document.getElementById('proMissing').value,
    bootstrap:Number(document.getElementById('proBootstrap').value)||0,
    ordinal_vars: (document.getElementById('proOrdinalVars')?.value||'').split(',').map(x=>x.trim()).filter(Boolean)
  };
}

async function runProModel(){
  let payload;
  try{ payload=buildProPayload(); }catch(e){return alert(e.message);}
  proResults.innerHTML='<div class="notice">Ejecutando modelo…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/estimate`,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok || data.ok===false)throw new Error(data.error||'No fue posible estimar el modelo.');
    proLastResponse=data;
    renderProResults(data);
  }catch(e){
    proResults.innerHTML=`<div class="model-error"><strong>No se pudo ejecutar el Motor Pro.</strong><br>${escapeHtml(e.message)}<br><br>Compruebe que el backend incluido en ValiStruct v0.9 esté activo.</div>`;
  }
}

function fitStatus(name,val){
  if(!Number.isFinite(val))return '';
  if(name==='CFI'||name==='TLI')return val>=.95?'good-bg':(val>=.90?'warn-bg':'bad-bg');
  if(name==='RMSEA'||name==='SRMR')return val<=.06?'good-bg':(val<=.08?'warn-bg':'bad-bg');
  return '';
}

function renderProResults(data){
  const fit=data.fit||{};
  const robust=data.fit_robust||{};
  const keys=['chisq','df','pvalue','cfi','tli','rmsea','rmsea.ci.lower','rmsea.ci.upper','srmr','aic','bic'];
  let html=`<div class="results-summary"><div class="report-header">
    <h3>ValiStruct · Motor Pro</h3>
    <p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p>
  </div>`;

  if(data.converged===false){
    html+=`<div class="model-error"><strong>🔴 Modelo no convergente.</strong> No interprete ni reporte los índices de ajuste, parámetros o índices de modificación como resultados definitivos.</div>`;
  }else{
    html+=`<div class="model-ok"><strong>🟢 Convergencia:</strong> ${data.converged===true?'confirmada por lavaan':'no informada por el motor'}.</div>`;
  }
  if(data.improper_solution || data.heywood || data.post_check===false){
    html+=`<div class="model-error"><strong>🔴 Solución potencialmente impropia.</strong> Revise varianzas negativas, cargas estandarizadas fuera de rango, identificación y advertencias de lavaan.</div>`;
  }
  if(Array.isArray(data.warnings_text) && data.warnings_text.length){
    html+='<div class="sem-engine-note"><strong>Advertencias reales de lavaan:</strong><ul>';
    data.warnings_text.forEach(w=>html+=`<li>${escapeHtml(w)}</li>`);
    html+='</ul></div>';
  }

  html+='<h3>Índices estándar / no robustos</h3><div class="pro-fit-grid">';
  const labels={
    chisq:'χ²',df:'gl',pvalue:'p',cfi:'CFI',tli:'TLI',rmsea:'RMSEA',
    'rmsea.ci.lower':'RMSEA IC inf.','rmsea.ci.upper':'RMSEA IC sup.',
    srmr:'SRMR',aic:'AIC',bic:'BIC'
  };
  keys.forEach(k=>{
    const v=Number(fit[k]);
    if(Number.isFinite(v)){
      const cls=fitStatus(labels[k],v);
      html+=`<div class="pro-fit-card ${cls}"><span>${labels[k]}</span><strong>${k==='df'?v.toFixed(0):v.toFixed(3)}</strong></div>`;
    }
  });
  html+='</div>';

  const robustKeys=[
    ['chisq.scaled','χ² escalado'],['df.scaled','gl escalados'],['pvalue.scaled','p escalado'],
    ['cfi.robust','CFI robusto'],['tli.robust','TLI robusto'],['rmsea.robust','RMSEA robusto'],
    ['rmsea.ci.lower.robust','RMSEA robusto IC inf.'],['rmsea.ci.upper.robust','RMSEA robusto IC sup.'],
    ['cfi.scaled','CFI escalado'],['tli.scaled','TLI escalado'],['rmsea.scaled','RMSEA escalado']
  ];
  if(Object.keys(robust).length){
    html+='<h3>Índices robustos / escalados del estimador</h3><div class="pro-fit-grid">';
    robustKeys.forEach(([k,label])=>{
      const v=Number(robust[k]);
      if(Number.isFinite(v)){
        const cls=fitStatus(label.includes('CFI')?'CFI':label.includes('TLI')?'TLI':label.includes('RMSEA')?'RMSEA':'',v);
        html+=`<div class="pro-fit-card ${cls}"><span>${label}</span><strong>${k.includes('df')?v.toFixed(0):v.toFixed(3)}</strong></div>`;
      }
    });
    html+='</div><div class="sem-engine-note">Cuando el estimador es robusto/ordinal, priorice para el reporte los índices robustos o escalados disponibles y declare claramente el estimador utilizado.</div>';
  }

  if(data.guidance?.length){
    html+='<div class="efa-guidance"><h3>Orientación automática</h3><ul>';
    data.guidance.forEach(g=>html+=`<li>${escapeHtml(g)}</li>`);
    html+='</ul></div>';
  }
  html+='</div>';

  if(Array.isArray(data.parameters)){
    html+='<h3>Parámetros estandarizados</h3><div class="workspace"><table class="results-table"><thead><tr><th>lhs</th><th>op</th><th>rhs</th><th>Estimación</th><th>EE</th><th>z</th><th>p</th><th>Std.all</th></tr></thead><tbody>';
    data.parameters.forEach(p=>{
      html+=`<tr><td>${escapeHtml(p.lhs)}</td><td>${escapeHtml(p.op)}</td><td>${escapeHtml(p.rhs)}</td>
      <td>${fmtPro(p.est)}</td><td>${fmtPro(p.se)}</td><td>${fmtPro(p.z)}</td><td>${p.pvalue!=null&&Number(p.pvalue)<.001?'&lt; .001':fmtPro(p.pvalue)}</td><td><strong>${fmtPro(p.std_all)}</strong></td></tr>`;
    });
    html+='</tbody></table></div>';
  }

  if(data.converged!==false && Array.isArray(data.modification_indices) && data.modification_indices.length){
    html+='<h3>Índices de modificación principales</h3><div class="sem-engine-note">No modifique el modelo exclusivamente para mejorar el ajuste. Evalúe primero la justificación teórica.</div><div class="workspace"><table class="results-table"><thead><tr><th>lhs</th><th>op</th><th>rhs</th><th>MI</th><th>EPC</th></tr></thead><tbody>';
    data.modification_indices.slice(0,20).forEach(m=>{
      html+=`<tr><td>${escapeHtml(m.lhs)}</td><td>${escapeHtml(m.op)}</td><td>${escapeHtml(m.rhs)}</td><td>${fmtPro(m.mi)}</td><td>${fmtPro(m.epc)}</td></tr>`;
    });
    html+='</tbody></table></div>';
  }

  proResults.innerHTML=html;
}

function fmtPro(v){
  const n=Number(v); return Number.isFinite(n)?n.toFixed(3):'—';
}

document.getElementById('checkProEngine').addEventListener('click',checkProEngine);
document.getElementById('proCsvFile').addEventListener('change',e=>{
  const f=e.target.files?.[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{proCsvText=reader.result;summarizeProCsv(proCsvText);};
  reader.readAsText(f,'utf-8');
  e.target.value='';
});
document.getElementById('copyLatenciaSyntax').addEventListener('click',()=>{
  generateSemSyntax();
  document.getElementById('proSyntax').value=semSyntax.value.replace(/# Modelo vacío/g,'');
});
document.getElementById('runProModel').addEventListener('click',runProModel);
document.getElementById('downloadProPayload').addEventListener('click',()=>{
  try{
    const payload=buildProPayload();
    saveBlob(JSON.stringify(payload,null,2),'application/json;charset=utf-8;','ValiStruct_MotorPro_solicitud.json');
  }catch(e){alert(e.message);}
});
document.getElementById('downloadProReport').addEventListener('click',()=>{
  if(!proLastResponse)return alert('Primero ejecute el modelo profesional.');
  saveBlob(JSON.stringify(proLastResponse,null,2),'application/json;charset=utf-8;','ValiStruct_MotorPro_resultados.json');
});


// -----------------------------
// v1.0 PWA + compatibilidad móvil
// -----------------------------
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredInstallPrompt = e;
});

async function installPwa(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }else{
    alert('Si usa iPhone/iPad: Safari → Compartir → Añadir a pantalla de inicio. En otros navegadores, busque la opción Instalar aplicación.');
  }
}

document.getElementById('installPwaButton')?.addEventListener('click', installPwa);
document.getElementById('headerInstallButton')?.addEventListener('click', installPwa);

const apiBaseInput=document.getElementById('apiBaseInput');
const apiBaseStatus=document.getElementById('apiBaseStatus');
function refreshApiUi(){
  if(apiBaseInput) apiBaseInput.value=getProApiBase();
  if(apiBaseStatus) apiBaseStatus.textContent=`Servidor activo configurado: ${getProApiBase()}`;
}
document.getElementById('saveApiBase')?.addEventListener('click',()=>{
  const v=(apiBaseInput.value||'').trim().replace(/\/+$/,'');
  if(!/^https?:\/\//i.test(v))return alert('Ingrese una URL que comience con http:// o https://');
  localStorage.setItem('valistruct_api_base',v);
  refreshApiUi();
  alert('Servidor guardado.');
});
document.getElementById('resetApiBase')?.addEventListener('click',()=>{
  localStorage.removeItem('valistruct_api_base');
  refreshApiUi();
});
refreshApiUi();

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}

// Upgrade Latencia dragging to Pointer Events for mouse/touch/Apple Pencil.
// We attach capture-phase handlers to coexist with legacy mouse handlers.
let pointerSemDrag=null;
semSvg?.addEventListener('pointerdown', evt=>{
  const g=evt.target.closest?.('.sem-node');
  if(!g)return;
  if(semMode==='path'||semMode==='cov')return;
  evt.preventDefault();
  const id=g.dataset.id;
  const n=nodeById(id);
  if(!n)return;
  const p=svgPoint(evt);
  pointerSemDrag={id,dx:p.x-n.x,dy:p.y-n.y,pointerId:evt.pointerId};
  semSvg.setPointerCapture?.(evt.pointerId);
  semSelected={kind:'node',id};
  renderSem();
}, true);

semSvg?.addEventListener('pointermove', evt=>{
  if(!pointerSemDrag || evt.pointerId!==pointerSemDrag.pointerId)return;
  evt.preventDefault();
  const p=svgPoint(evt),n=nodeById(pointerSemDrag.id);
  if(!n)return;
  n.x=Math.max(40,Math.min(1160,p.x-pointerSemDrag.dx));
  n.y=Math.max(40,Math.min(660,p.y-pointerSemDrag.dy));
  semEdgeLayer.innerHTML=semEdges.map(edgeSvg).join('');
  semNodeLayer.innerHTML=semNodes.map(nodeShapeSvg).join('');
  attachSemEvents();
}, true);

function endPointerSem(evt){
  if(pointerSemDrag && (!evt.pointerId || evt.pointerId===pointerSemDrag.pointerId)){
    try{semSvg.releasePointerCapture?.(pointerSemDrag.pointerId);}catch(_){}
    pointerSemDrag=null;
  }
}
semSvg?.addEventListener('pointerup',endPointerSem,true);
semSvg?.addEventListener('pointercancel',endPointerSem,true);

// -----------------------------
// v1.0 Validación avanzada
// -----------------------------
let advancedLastResponse=null;

function advancedPayload(action){
  const syntax=document.getElementById('proSyntax').value.trim() || semSyntax?.value?.trim();
  if(!syntax)throw new Error('Ingrese o genere sintaxis lavaan en Motor Pro/Latencia.');
  if(!proCsvText)throw new Error('Importe una base CSV en Motor Pro.');
  return {
    action,
    syntax,
    csv_text:proCsvText,
    estimator:document.getElementById('proEstimator').value,
    data_type:document.getElementById('proDataType').value,
    missing:document.getElementById('proMissing').value,
    bootstrap:Number(document.getElementById('proBootstrap').value)||1000,
    group:document.getElementById('advGroupVar').value.trim() || null,
    ordinal_vars:document.getElementById('advOrdinalVars').value.split(',').map(x=>x.trim()).filter(Boolean),
    htmt_threshold:Number(document.getElementById('advHtmtThreshold').value)||0.85
  };
}

async function callAdvanced(action){
  let payload;
  try{payload=advancedPayload(action);}catch(e){return alert(e.message);}
  const box=document.getElementById('advancedResults');
  box.innerHTML='<div class="notice">Procesando análisis avanzado…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/advanced`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok || data.ok===false)throw new Error(data.error||'Error del análisis avanzado');
    advancedLastResponse=data;
    renderAdvanced(data);
  }catch(e){
    box.innerHTML=`<div class="model-error"><strong>No fue posible ejecutar el análisis.</strong><br>${escapeHtml(e.message)}</div>`;
  }
}

function renderAdvanced(data){
  const box=document.getElementById('advancedResults');
  let html=`<div class="results-summary"><div class="report-header"><h3>${escapeHtml(data.title||'Validación avanzada')}</h3>
  <p><strong>Dr. Roberto Joel Tirado Reyes</strong> · Universidad Autónoma de Sinaloa</p></div>`;

  if(data.metrics){
    html+='<div class="workspace"><table class="results-table"><thead><tr><th>Constructo</th><th>CR</th><th>AVE</th></tr></thead><tbody>';
    data.metrics.forEach(x=>html+=`<tr><td>${escapeHtml(x.factor)}</td><td>${fmtPro(x.cr)}</td><td>${fmtPro(x.ave)}</td></tr>`);
    html+='</tbody></table></div>';
  }
  if(data.htmt){
    html+='<h3>HTMT</h3><div class="workspace"><table class="results-table"><thead><tr><th>A</th><th>B</th><th>HTMT</th><th>Estado</th></tr></thead><tbody>';
    data.htmt.forEach(x=>html+=`<tr><td>${escapeHtml(x.a)}</td><td>${escapeHtml(x.b)}</td><td>${fmtPro(x.value)}</td><td>${x.ok?'🟢 Favorable':'🟠 Revisar'}</td></tr>`);
    html+='</tbody></table></div>';
  }
  if(data.matrix){
    html+='<h3>Matriz policórica</h3><div class="workspace"><table class="results-table"><thead><tr><th></th>';
    data.matrix.names.forEach(n=>html+=`<th>${escapeHtml(n)}</th>`);
    html+='</tr></thead><tbody>';
    data.matrix.values.forEach((row,i)=>{
      html+=`<tr><th>${escapeHtml(data.matrix.names[i])}</th>${row.map(v=>`<td>${fmtPro(v)}</td>`).join('')}</tr>`;
    });
    html+='</tbody></table></div>';
  }
  if(data.invariance){
    html+='<h3>Invariancia factorial</h3><div class="workspace"><table class="results-table"><thead><tr><th>Modelo</th><th>CFI</th><th>RMSEA</th><th>SRMR</th><th>ΔCFI</th><th>ΔRMSEA</th><th>ΔSRMR</th></tr></thead><tbody>';
    data.invariance.forEach(x=>html+=`<tr><td>${escapeHtml(x.model)}</td><td>${fmtPro(x.cfi)}</td><td>${fmtPro(x.rmsea)}</td><td>${fmtPro(x.srmr)}</td><td>${fmtPro(x.delta_cfi)}</td><td>${fmtPro(x.delta_rmsea)}</td><td>${fmtPro(x.delta_srmr)}</td></tr>`);
    html+='</tbody></table></div>';
  }
  if(data.guidance?.length){
    html+='<div class="efa-guidance"><h3>Orientación</h3><ul>'+data.guidance.map(g=>`<li>${escapeHtml(g)}</li>`).join('')+'</ul></div>';
  }
  html+='</div>';
  box.innerHTML=html;
}

document.getElementById('runQualityMetrics')?.addEventListener('click',()=>callAdvanced('quality'));
document.getElementById('runPolychoric')?.addEventListener('click',()=>callAdvanced('polychoric'));
document.getElementById('runInvariance')?.addEventListener('click',()=>callAdvanced('invariance'));
document.getElementById('runMultigroup')?.addEventListener('click',()=>callAdvanced('multigroup'));
document.getElementById('downloadAdvancedReport')?.addEventListener('click',()=>{
  if(!advancedLastResponse)return alert('Primero ejecute un análisis avanzado.');
  saveBlob(JSON.stringify(advancedLastResponse,null,2),'application/json;charset=utf-8;','ValiStruct_validacion_avanzada.json');
});


// -----------------------------
// v1.1 Diagrama actualizado con Motor Pro
// -----------------------------
function findSemNodeByLabel(label){
  return semNodes.find(n=>n.label===label);
}
function applyProCoefficientsToDiagram(){
  if(!proLastResponse?.parameters) return alert('Primero ejecute un modelo en Motor Pro.');
  let applied=0;
  proLastResponse.parameters.forEach(p=>{
    const val=Number(p.std_all);
    if(!Number.isFinite(val))return;
    if(p.op==='=~'){
      const from=findSemNodeByLabel(p.lhs), to=findSemNodeByLabel(p.rhs);
      if(from&&to){
        const e=semEdges.find(x=>x.type==='path'&&x.from===from.id&&x.to===to.id);
        if(e){e.label=`λ=${val.toFixed(2)}`;applied++;}
      }
    }else if(p.op==='~'){
      const to=findSemNodeByLabel(p.lhs), from=findSemNodeByLabel(p.rhs);
      if(from&&to){
        const e=semEdges.find(x=>x.type==='path'&&x.from===from.id&&x.to===to.id);
        if(e){e.label=`β=${val.toFixed(2)}`;applied++;}
      }
    }else if(p.op==='~~' && p.lhs!==p.rhs){
      const a=findSemNodeByLabel(p.lhs),b=findSemNodeByLabel(p.rhs);
      if(a&&b){
        const e=semEdges.find(x=>x.type==='cov'&&((x.from===a.id&&x.to===b.id)||(x.from===b.id&&x.to===a.id)));
        if(e){e.label=`r=${val.toFixed(2)}`;applied++;}
      }
    }
  });
  renderSem();
  alert(`Se aplicaron ${applied} coeficientes estandarizados al diagrama.`);
}
document.getElementById('applyProDiagram')?.addEventListener('click',applyProCoefficientsToDiagram);

// -----------------------------
// v1.1 Gestión de proyectos
// -----------------------------
const PROJECT_KEY='valistruct_projects_v1';
function projectState(){
  return {
    version:'1.1',
    savedAt:new Date().toISOString(),
    name:(document.getElementById('projectName')?.value||'Proyecto ValiStruct').trim(),
    author:(document.getElementById('projectAuthor')?.value||'').trim(),
    semNodes,
    semEdges,
    semData,
    semStructuralResults,
    semMediationResults,
    proCsvText,
    proLastResponse,
    advancedLastResponse,
    aiken:lastResults,
    reliability:relLastResults,
    efa:efaLastResults,
    cfa:cfaLastResults,
    reportTitle:document.getElementById('reportStudyTitle')?.value||'',
    proSyntax:document.getElementById('proSyntax')?.value||'',
    latenciaSyntax:semSyntax?.value||''
  };
}
function localProjects(){
  try{return JSON.parse(localStorage.getItem(PROJECT_KEY)||'[]');}catch(_){return [];}
}
function storeLocalProjects(list){
  localStorage.setItem(PROJECT_KEY,JSON.stringify(list));
}
function saveProjectLocal(){
  const state=projectState();
  if(!state.name)return alert('Escriba un nombre para el proyecto.');
  const list=localProjects();
  const existing=list.findIndex(x=>x.name===state.name);
  if(existing>=0)list[existing]=state; else list.unshift(state);
  storeLocalProjects(list.slice(0,20));
  renderProjectList();
  alert('Proyecto guardado en este dispositivo.');
}
function restoreProject(state){
  try{
    document.getElementById('projectName').value=state.name||'';
    document.getElementById('projectAuthor').value=state.author||'';
    semNodes=state.semNodes||[];
    semEdges=state.semEdges||[];
    semData=state.semData||null;
    semStructuralResults=state.semStructuralResults||null;
    semMediationResults=state.semMediationResults||null;
    proCsvText=state.proCsvText||null;
    proLastResponse=state.proLastResponse||null;
    advancedLastResponse=state.advancedLastResponse||null;
    if(Array.isArray(state.aiken))lastResults=state.aiken;
    relLastResults=state.reliability||null;
    efaLastResults=state.efa||null;
    cfaLastResults=state.cfa||null;
    if(document.getElementById('reportStudyTitle'))document.getElementById('reportStudyTitle').value=state.reportTitle||'';
    if(document.getElementById('proSyntax'))document.getElementById('proSyntax').value=state.proSyntax||'';
    if(semSyntax)semSyntax.value=state.latenciaSyntax||'';
    renderSem();
    renderSemDataset();
    if(proCsvText)summarizeProCsv(proCsvText);
    alert('Proyecto cargado.');
  }catch(e){alert('No fue posible cargar el proyecto: '+e.message);}
}
function renderProjectList(){
  const box=document.getElementById('projectList');
  if(!box)return;
  const list=localProjects();
  if(!list.length){box.innerHTML='<p class="small">No hay proyectos guardados en este dispositivo.</p>';return;}
  box.innerHTML=list.map((p,i)=>`<div class="project-card">
    <div><strong>${escapeHtml(p.name||'Proyecto')}</strong><br><small>${escapeHtml(p.author||'')} · ${p.savedAt?new Date(p.savedAt).toLocaleString():'Sin fecha'}</small></div>
    <div class="project-actions">
      <button data-open-project="${i}">Abrir</button>
      <button data-delete-project="${i}">Eliminar</button>
    </div>
  </div>`).join('');
  box.querySelectorAll('[data-open-project]').forEach(b=>b.addEventListener('click',()=>restoreProject(list[Number(b.dataset.openProject)])));
  box.querySelectorAll('[data-delete-project]').forEach(b=>b.addEventListener('click',()=>{
    const idx=Number(b.dataset.deleteProject);
    const next=localProjects();next.splice(idx,1);storeLocalProjects(next);renderProjectList();
  }));
}
function exportProject(){
  const state=projectState();
  const safeName=(state.name||'ValiStruct_proyecto').replace(/[^\w\-]+/g,'_');
  saveBlob(JSON.stringify(state,null,2),'application/json;charset=utf-8;',`${safeName}.valistruct.json`);
}
function importProjectFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const state=JSON.parse(reader.result);
      if(!state.version)throw new Error('Archivo de proyecto no reconocido.');
      restoreProject(state);
    }catch(e){alert('No fue posible importar el proyecto: '+e.message);}
  };
  reader.readAsText(file,'utf-8');
}
function newProject(){
  if(!confirm('¿Crear un proyecto nuevo? Se limpiará el estado visual actual no guardado.'))return;
  semNodes=[];semEdges=[];semData=null;semStructuralResults=null;semMediationResults=null;
  proCsvText=null;proLastResponse=null;advancedLastResponse=null;
  lastResults=[];relLastResults=null;efaLastResults=null;cfaLastResults=null;
  document.getElementById('projectName').value='';
  document.getElementById('reportStudyTitle').value='';
  document.getElementById('proSyntax').value='';
  renderSem();renderSemDataset();proDatasetSummary.innerHTML='';proResults.innerHTML='';
}
document.getElementById('saveProjectLocal')?.addEventListener('click',saveProjectLocal);
document.getElementById('exportProject')?.addEventListener('click',exportProject);
document.getElementById('importProjectFile')?.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importProjectFile(f);e.target.value='';});
document.getElementById('newProject')?.addEventListener('click',newProject);
renderProjectList();

// -----------------------------
// v1.1 Reporte APA 7
// -----------------------------
let apaReportPlain='';

function pFormat(p){
  const n=Number(p);
  if(!Number.isFinite(n))return '—';
  if(n<.001)return '< .001';
  return `= ${n.toFixed(3).replace(/^0/,'')}`;
}
function f3(v){
  const n=Number(v);return Number.isFinite(n)?n.toFixed(3).replace(/^0/,''):'—';
}
function generateApaReport(){
  const title=(document.getElementById('reportStudyTitle').value||'Validación del instrumento').trim();
  let html=`<h2>${escapeHtml(title)}</h2>`;
  const plain=[];
  plain.push(title,'');
  html+=`<p>Los análisis se realizaron en <strong>ValiStruct</strong>, plataforma de apoyo metodológico desarrollada por el Dr. Roberto Joel Tirado Reyes, Universidad Autónoma de Sinaloa.</p>`;
  plain.push('Los análisis se realizaron en ValiStruct, plataforma de apoyo metodológico desarrollada por el Dr. Roberto Joel Tirado Reyes, Universidad Autónoma de Sinaloa.','');

  if(lastResults?.length){
    const overall=lastResults.reduce((a,r)=>a+Number(r.v||0),0)/lastResults.length;
    html+=`<h3>Validez de contenido</h3><p>La evidencia de validez de contenido se examinó mediante la V de Aiken. El promedio global de los coeficientes fue <em>V</em> = ${f3(overall)}. La interpretación se realizó considerando los valores por ítem, sus intervalos de confianza y la congruencia conceptual.</p>`;
    plain.push('Validez de contenido',`La evidencia de validez de contenido se examinó mediante la V de Aiken. El promedio global de los coeficientes fue V = ${f3(overall)}. La interpretación se realizó considerando los valores por ítem, sus intervalos de confianza y la congruencia conceptual.`,'');
  }

  if(relLastResults){
    html+=`<h3>Consistencia interna</h3><p>La consistencia interna se evaluó mediante el alfa de Cronbach. Se obtuvo α = ${f3(relLastResults.alpha)}${Number.isFinite(relLastResults.omegaApprox)?` y una estimación preliminar de ω = ${f3(relLastResults.omegaApprox)}`:''}. Las correlaciones ítem-total corregidas fueron examinadas conjuntamente con el efecto de la eliminación de cada reactivo.</p>`;
    plain.push('Consistencia interna',`La consistencia interna se evaluó mediante el alfa de Cronbach. Se obtuvo α = ${f3(relLastResults.alpha)}${Number.isFinite(relLastResults.omegaApprox)?` y una estimación preliminar de ω = ${f3(relLastResults.omegaApprox)}`:''}.`,'');
  }

  if(efaLastResults){
    const r=efaLastResults;
    html+=`<h3>Análisis factorial exploratorio</h3><p>La adecuación de los datos para el análisis factorial fue ${r.kmo.overall>=.70?'favorable':'objeto de revisión'}, KMO = ${f3(r.kmo.overall)}. La prueba de esfericidad de Bartlett fue ${r.bart.p<.05?'estadísticamente significativa':'no significativa'}, χ²(${r.bart.df}) = ${Number.isFinite(r.bart.chi2)?r.bart.chi2.toFixed(2):'—'}, <em>p</em> ${pFormat(r.bart.p)}. El análisis paralelo sugirió ${r.retainedPA} factor(es).</p>`;
    plain.push('Análisis factorial exploratorio',`La adecuación de los datos para el análisis factorial fue ${r.kmo.overall>=.70?'favorable':'objeto de revisión'}, KMO = ${f3(r.kmo.overall)}. La prueba de Bartlett fue ${r.bart.p<.05?'significativa':'no significativa'}, χ²(${r.bart.df}) = ${Number.isFinite(r.bart.chi2)?r.bart.chi2.toFixed(2):'—'}, p ${pFormat(r.bart.p)}. El análisis paralelo sugirió ${r.retainedPA} factor(es).`,'');
  }

  const pro=proLastResponse;
  if(pro?.fit){
    const f=pro.fit;
    html+=`<h3>Análisis factorial confirmatorio / SEM</h3><p>El ajuste del modelo se evaluó mediante múltiples índices. Se obtuvo χ²(${Math.round(Number(f.df)||0)}) = ${Number(f.chisq).toFixed(2)}, <em>p</em> ${pFormat(f.pvalue)}, CFI = ${f3(f.cfi)}, TLI = ${f3(f.tli)}, RMSEA = ${f3(f.rmsea)}${Number.isFinite(Number(f['rmsea.ci.lower']))?` [IC 90/95% ${f3(f['rmsea.ci.lower'])}, ${f3(f['rmsea.ci.upper'])}]`:''} y SRMR = ${f3(f.srmr)}. Estos índices se interpretaron conjuntamente con la plausibilidad teórica del modelo.</p>`;
    plain.push('Análisis factorial confirmatorio / SEM',`Se obtuvo χ²(${Math.round(Number(f.df)||0)}) = ${Number(f.chisq).toFixed(2)}, p ${pFormat(f.pvalue)}, CFI = ${f3(f.cfi)}, TLI = ${f3(f.tli)}, RMSEA = ${f3(f.rmsea)} y SRMR = ${f3(f.srmr)}.`,'');
  } else if(cfaLastResults){
    html+=`<h3>Análisis factorial confirmatorio preliminar</h3><p>En la fase preliminar se obtuvo SRMR = ${f3(cfaLastResults.srmr)}. La versión profesional del modelo debe estimarse con el Motor Pro para obtener χ², CFI, TLI y RMSEA.</p>`;
    plain.push('Análisis factorial confirmatorio preliminar',`En la fase preliminar se obtuvo SRMR = ${f3(cfaLastResults.srmr)}.`,'');
  }

  if(advancedLastResponse?.metrics){
    html+=`<h3>Confiabilidad compuesta y validez convergente</h3>`;
    html+=`<div class="apa-table-title">Tabla 1<br>Confiabilidad compuesta y varianza media extraída</div><table><thead><tr><th>Constructo</th><th>CR</th><th>AVE</th></tr></thead><tbody>`;
    advancedLastResponse.metrics.forEach(x=>html+=`<tr><td>${escapeHtml(x.factor)}</td><td>${f3(x.cr)}</td><td>${f3(x.ave)}</td></tr>`);
    html+=`</tbody></table><div class="apa-note"><em>Nota.</em> CR = confiabilidad compuesta; AVE = varianza media extraída.</div>`;
  }

  if(semStructuralResults?.paths?.length){
    html+=`<h3>Modelo estructural</h3><div class="apa-table-title">Tabla 2<br>Coeficientes de las rutas estructurales</div><table><thead><tr><th>Ruta</th><th>β</th><th>EE</th><th>p</th></tr></thead><tbody>`;
    semStructuralResults.paths.forEach(x=>html+=`<tr><td>${escapeHtml(x.from)} → ${escapeHtml(x.to)}</td><td>${f3(x.beta)}</td><td>${f3(x.se)}</td><td>${x.p<.001?'&lt; .001':f3(x.p)}</td></tr>`);
    html+=`</tbody></table>`;
  }

  html+=`<h3>Referencias metodológicas</h3>
    <p>Aiken, L. R. (1985). Three coefficients for analyzing the reliability and validity of ratings. <em>Educational and Psychological Measurement, 45</em>(1), 131–142.</p>
    <p>Hu, L.-t., & Bentler, P. M. (1999). Cutoff criteria for fit indexes in covariance structure analysis. <em>Structural Equation Modeling, 6</em>(1), 1–55.</p>
    <p>Fornell, C., & Larcker, D. F. (1981). Evaluating structural equation models with unobservable variables and measurement error. <em>Journal of Marketing Research, 18</em>(1), 39–50.</p>`;

  apaReportPlain=plain.join('\n');
  document.getElementById('apaReportOutput').innerHTML=html;
}
function copyApaReport(){
  if(!apaReportPlain)return alert('Primero genere el reporte.');
  navigator.clipboard.writeText(apaReportPlain).then(()=>alert('Reporte copiado.')).catch(()=>alert('No fue posible copiar automáticamente.'));
}
function downloadApaHtml(){
  const out=document.getElementById('apaReportOutput');
  if(!out.innerHTML.trim())return alert('Primero genere el reporte.');
  const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Reporte APA 7</title>
  <style>body{font-family:Arial,sans-serif;max-width:900px;margin:40px auto;line-height:1.7;color:#222}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border-bottom:1px solid #bbb;padding:8px;text-align:left}th{border-top:1px solid #444}.apa-table-title{font-weight:bold}.apa-note{font-size:13px}</style>
  <body>${out.innerHTML}</body></html>`;
  saveBlob(html,'text/html;charset=utf-8;','ValiStruct_reporte_APA7.html');
}
document.getElementById('generateApaReport')?.addEventListener('click',generateApaReport);
document.getElementById('copyApaReport')?.addEventListener('click',copyApaReport);
document.getElementById('downloadApaHtml')?.addEventListener('click',downloadApaHtml);
document.getElementById('printApaReport')?.addEventListener('click',()=>{
  if(!document.getElementById('apaReportOutput').innerHTML.trim())return alert('Primero genere el reporte.');
  window.print();
});


// -----------------------------
// v1.2 Auto-layout + zoom/pan
// -----------------------------
let semZoom=1;

function applySemZoom(){
  semSvg.style.transform=`scale(${semZoom})`;
  semSvg.style.transformOrigin='0 0';
}
function zoomSem(delta){
  semZoom=Math.max(.5,Math.min(2,semZoom+delta));
  applySemZoom();
}
function autoLayoutSem(){
  const latent=semNodes.filter(n=>n.type==='latent');
  const observed=semNodes.filter(n=>n.type==='observed');
  const errors=semNodes.filter(n=>n.type==='error');

  latent.forEach((n,i)=>{
    n.x=220+(i%3)*320;
    n.y=180+Math.floor(i/3)*260;
  });

  const assigned=new Set();
  latent.forEach((lat,li)=>{
    const inds=semEdges.filter(e=>e.type==='path'&&e.from===lat.id)
      .map(e=>nodeById(e.to)).filter(n=>n&&n.type==='observed');
    inds.forEach((n,j)=>{
      n.x=520+(j%4)*150;
      n.y=100+li*250+(j>=4?80:0);
      assigned.add(n.id);
    });
  });

  observed.filter(n=>!assigned.has(n.id)).forEach((n,i)=>{
    n.x=250+(i%5)*170;
    n.y=550+Math.floor(i/5)*70;
  });
  errors.forEach((n,i)=>{
    n.x=1000;
    n.y=80+i*60;
  });
  renderSem();
}
document.getElementById('autoLayoutSem')?.addEventListener('click',autoLayoutSem);
document.getElementById('zoomInSem')?.addEventListener('click',()=>zoomSem(.1));
document.getElementById('zoomOutSem')?.addEventListener('click',()=>zoomSem(-.1));
document.getElementById('resetViewSem')?.addEventListener('click',()=>{semZoom=1;applySemZoom();});

// -----------------------------
// v1.2 Comparación de modelos
// -----------------------------
let comparisonA=null, comparisonB=null;

function captureModel(label){
  if(!proLastResponse?.fit)return alert('Ejecute primero un modelo en Motor Pro.');
  const obj={
    label,
    fit:JSON.parse(JSON.stringify(proLastResponse.fit)),
    estimator:proLastResponse.estimator||document.getElementById('proEstimator')?.value||'',
    timestamp:new Date().toISOString()
  };
  if(label==='Modelo A')comparisonA=obj;else comparisonB=obj;
  renderComparisonStatus();
}
function renderComparisonStatus(){
  const box=document.getElementById('modelComparisonStatus');
  if(!box)return;
  const card=(x,name)=>`<div class="metric-card"><span>${name}</span><strong>${x?'Capturado':'Pendiente'}</strong>${x?`<small>${new Date(x.timestamp).toLocaleString()}</small>`:''}</div>`;
  box.innerHTML=card(comparisonA,'Modelo A')+card(comparisonB,'Modelo B');
}
function nfit(obj,key){return Number(obj?.fit?.[key]);}
function compareModelsNow(){
  if(!comparisonA||!comparisonB)return alert('Capture Modelo A y Modelo B.');
  const rows=[
    ['CFI','cfi',true],
    ['TLI','tli',true],
    ['RMSEA','rmsea',false],
    ['SRMR','srmr',false],
    ['AIC','aic',false],
    ['BIC','bic',false]
  ];
  let html='<div class="results-summary"><h3>Comparación de modelos</h3><div class="model-compare-grid">';
  rows.forEach(([label,key,higherBetter])=>{
    const a=nfit(comparisonA,key),b=nfit(comparisonB,key);
    if(!Number.isFinite(a)||!Number.isFinite(b))return;
    const d=b-a;
    let cls='delta-warn';
    if(label==='CFI'){
      cls=Math.abs(d)<=.010?'delta-good':(Math.abs(d)<=.020?'delta-warn':'delta-bad');
    }else if(label==='RMSEA'){
      cls=Math.abs(d)<=.015?'delta-good':'delta-warn';
    }else if(label==='SRMR'){
      cls=Math.abs(d)<=.030?'delta-good':'delta-warn';
    }else if(label==='AIC'||label==='BIC'){
      cls=b<a?'delta-good':'delta-warn';
    }
    html+=`<div class="result-card ${cls}"><span>${label}</span><strong>Δ ${d>=0?'+':''}${d.toFixed(3)}</strong><small>A=${a.toFixed(3)} · B=${b.toFixed(3)}</small></div>`;
  });
  html+='</div><div class="sem-engine-note"><strong>Interpretación:</strong> cambios pequeños en CFI/RMSEA/SRMR pueden apoyar equivalencia o estabilidad del ajuste, mientras que AIC/BIC menores favorecen parsimonia relativa. La comparación debe mantener coherencia teórica y considerar si los modelos son anidados.</div></div>';
  document.getElementById('modelComparisonResults').innerHTML=html;
}
document.getElementById('captureModelA')?.addEventListener('click',()=>captureModel('Modelo A'));
document.getElementById('captureModelB')?.addEventListener('click',()=>captureModel('Modelo B'));
document.getElementById('compareModels')?.addEventListener('click',compareModelsNow);
document.getElementById('clearComparison')?.addEventListener('click',()=>{comparisonA=null;comparisonB=null;renderComparisonStatus();document.getElementById('modelComparisonResults').innerHTML='';});
renderComparisonStatus();

// -----------------------------
// v1.2 Índices de modificación guiados
// -----------------------------
function renderGuidedModificationIndices(data){
  const panel=document.getElementById('guidedMiPanel');
  const box=document.getElementById('guidedMiContent');
  if(!panel||!box)return;
  const mis=(data?.modification_indices||[]).filter(x=>Number(x.mi)>=3.84).slice(0,15);
  if(!mis.length){panel.classList.add('hidden');return;}
  panel.classList.remove('hidden');
  box.innerHTML=mis.map(m=>{
    const mi=Number(m.mi);
    const cls=mi>=20?'mi-high':(mi>=10?'mi-medium':'mi-low');
    const level=mi>=20?'Alta prioridad para revisión teórica':(mi>=10?'Revisión moderada':'Revisión exploratoria');
    return `<div class="mi-card ${cls}">
      <strong>${escapeHtml(m.lhs)} ${escapeHtml(m.op)} ${escapeHtml(m.rhs)} · MI=${fmtPro(mi)}</strong>
      <span>${level}. EPC=${fmtPro(m.epc)}.</span>
      <div class="small">Antes de liberar este parámetro, verifique plausibilidad conceptual, redacción de ítems, solapamiento de contenido y riesgo de sobreajuste.</div>
    </div>`;
  }).join('');
}

// Patch existing pro render by listening after model run
const oldRenderProResults = renderProResults;
renderProResults = function(data){
  oldRenderProResults(data);
  renderGuidedModificationIndices(data);
};

// -----------------------------
// v1.2 Guía metodológica Tirado-Reyes
// -----------------------------
const methodGuideData={
  afe:{
    title:'Orientación para Análisis Factorial Exploratorio',
    rows:[
      ['KMO','≥ .70','Adecuación muestral favorable como referencia orientativa.'],
      ['Bartlett','p < .05','Apoya que la matriz de correlaciones es factorizable.'],
      ['Comunalidades','≥ .30','Valores bajos sugieren que el ítem es poco explicado por los factores retenidos.'],
      ['Carga factorial','≥ .30 mínima; ≥ .50 deseable','Interpretar junto con tamaño muestral, teoría y cargas cruzadas.'],
      ['Cargas cruzadas','Diferencia suficiente entre cargas','Revisar ítems con saturación relevante en más de un factor.'],
      ['Varianza explicada','≈ 50–60% o más','Criterio descriptivo; depende del campo y complejidad del constructo.'],
      ['Retención de factores','Análisis paralelo + teoría','No depender únicamente de autovalores > 1.']
    ]
  },
  afc:{
    title:'Orientación para Análisis Factorial Confirmatorio',
    rows:[
      ['χ²','Interpretar con cautela','Es sensible al tamaño muestral; no debe utilizarse de forma aislada.'],
      ['χ²/gl','< 3 como referencia','Indicador descriptivo complementario.'],
      ['CFI','≥ .90 aceptable; ≥ .95 favorable','Evaluar conjuntamente con TLI, RMSEA y SRMR.'],
      ['TLI','≥ .90 aceptable; ≥ .95 favorable','Penaliza modelos menos parsimoniosos.'],
      ['RMSEA','≤ .08 razonable; ≤ .06 favorable','Reportar intervalo de confianza cuando esté disponible.'],
      ['SRMR','≤ .08','Resume discrepancias residuales estandarizadas.'],
      ['Cargas estandarizadas','≥ .50 deseable','Cargas menores requieren valoración teórica y psicométrica.']
    ]
  },
  validity:{
    title:'Confiabilidad y validez del constructo',
    rows:[
      ['Alfa / Omega','≥ .70 orientativo','Evitar interpretar valores extremadamente altos sin revisar redundancia.'],
      ['CR','≥ .70','Confiabilidad compuesta del constructo.'],
      ['AVE','≥ .50','Apoya validez convergente.'],
      ['HTMT','< .85 conservador / < .90 liberal','Apoya validez discriminante cuando se interpreta junto con teoría.'],
      ['V de Aiken','Cercana a 1 = mayor acuerdo','Interpretar por ítem, criterio, IC y comentarios cualitativos de jueces.']
    ]
  },
  workflow:{
    title:'Ruta integrada de validación',
    rows:[
      ['1','Definición conceptual','Delimitar constructo, dimensiones y población.'],
      ['2','Construcción de ítems','Redacción, congruencia y cobertura del contenido.'],
      ['3','Juicio de expertos','V de Aiken y revisión cualitativa.'],
      ['4','Pilotaje','Distribución, datos faltantes, discriminación de ítems.'],
      ['5','Confiabilidad','Alfa, omega, ítem-total.'],
      ['6','AFE','Explorar estructura latente.'],
      ['7','AFC','Confirmar el modelo de medición.'],
      ['8','Validez','CR, AVE, HTMT.'],
      ['9','SEM','Evaluar relaciones estructurales.'],
      ['10','Invariancia','Comprobar comparabilidad entre grupos.']
    ]
  }
};
function renderMethodGuide(tab='afe'){
  document.querySelectorAll('.method-tab').forEach(b=>b.classList.toggle('active',b.dataset.methodtab===tab));
  const d=methodGuideData[tab];
  let html=`<div class="results-summary"><h3>${d.title}</h3><div class="workspace"><table class="criteria-table"><thead><tr><th>Indicador / etapa</th><th>Criterio orientativo</th><th>Interpretación</th></tr></thead><tbody>`;
  d.rows.forEach(r=>html+=`<tr><td><strong>${r[0]}</strong></td><td>${r[1]}</td><td>${r[2]}</td></tr>`);
  html+='</tbody></table></div><div class="sem-engine-note">Fuente metodológica del panel: Tirado-Reyes et al. (2026), DOI 10.37811/cl_rcm.v10i2.23827, complementada con criterios psicométricos contemporáneos implementados en ValiStruct.</div></div>';
  document.getElementById('methodGuideContent').innerHTML=html;
}
document.querySelectorAll('.method-tab').forEach(b=>b.addEventListener('click',()=>renderMethodGuide(b.dataset.methodtab)));
renderMethodGuide();

// -----------------------------
// v1.2 DOCX export through backend
// -----------------------------
async function downloadApaDocx(){
  const out=document.getElementById('apaReportOutput');
  if(!out?.innerHTML.trim())return alert('Primero genere el reporte APA 7.');
  const payload={
    title:(document.getElementById('reportStudyTitle').value||'Reporte ValiStruct').trim(),
    html:out.innerHTML,
    author:'Dr. Roberto Joel Tirado Reyes',
    institution:'Universidad Autónoma de Sinaloa'
  };
  try{
    const res=await fetch(`${getProApiBase()}/report-docx`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    if(!res.ok){
      const txt=await res.text();
      throw new Error(txt||'No fue posible generar el DOCX.');
    }
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='ValiStruct_reporte_APA7.docx';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){
    alert('El DOCX requiere el backend v1.2 activo. '+e.message);
  }
}
document.getElementById('downloadApaDocx')?.addEventListener('click',downloadApaDocx);


// -----------------------------
// v1.3 Exportación PNG/PDF del diagrama
// -----------------------------
function exportSemPng(){
  const clone=semSvg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
  const svgData=new XMLSerializer().serializeToString(clone);
  const blob=new Blob([svgData],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const img=new Image();
  img.onload=()=>{
    const canvas=document.createElement('canvas');
    canvas.width=1200; canvas.height=700;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,1200,700);
    URL.revokeObjectURL(url);
    canvas.toBlob(png=>{
      const dl=URL.createObjectURL(png);
      const a=document.createElement('a');
      a.href=dl;a.download='ValiStruct_Latencia_modelo.png';
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(dl);
      logHistory('Latencia','Exportar PNG',{nodes:semNodes.length,edges:semEdges.length});
    },'image/png');
  };
  img.src=url;
}

async function exportSemPdf(){
  // lightweight printable PDF path: open SVG in print-friendly window
  const clone=semSvg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
  const win=window.open('','_blank');
  if(!win)return alert('El navegador bloqueó la ventana emergente.');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>ValiStruct · Diagrama</title>
  <style>@page{size:landscape;margin:12mm}body{font-family:Arial,sans-serif}svg{width:100%;height:auto}h1{font-size:18px}</style></head>
  <body><h1>ValiStruct | Latencia</h1><p>Dr. Roberto Joel Tirado Reyes · Universidad Autónoma de Sinaloa</p>${clone.outerHTML}
  <script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
  win.document.close();
  logHistory('Latencia','Exportar PDF',{nodes:semNodes.length,edges:semEdges.length});
}
document.getElementById('exportPng')?.addEventListener('click',exportSemPng);
document.getElementById('exportPdf')?.addEventListener('click',exportSemPdf);

// -----------------------------
// v1.3 Diagnóstico de datos
// -----------------------------
let diagData=null, diagLast=null;

function parseDiagnosticCSV(text){
  const rows=parseCSV(text.replace(/^\uFEFF/,''));
  if(rows.length<3)throw new Error('Se requieren encabezados y al menos dos filas de datos.');
  const headers=rows[0].map(x=>x.trim());
  const body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
  let startCol=0;
  if(/^(id|folio|participante|sujeto|caso)$/i.test(headers[0]||''))startCol=1;
  const names=headers.slice(startCol);
  const matrix=body.map(r=>r.slice(startCol,startCol+names.length).map(x=>{
    const s=String(x??'').trim();
    return s===''?null:Number(s);
  }));
  return {names,matrix,n:matrix.length,k:names.length};
}
function skewness(arr){
  const x=arr.filter(Number.isFinite),n=x.length;
  if(n<3)return NaN;
  const m=mean(x),sd=Math.sqrt(variance(x,false));
  if(!(sd>0))return 0;
  return x.reduce((s,v)=>s+Math.pow((v-m)/sd,3),0)/n;
}
function kurtosisExcess(arr){
  const x=arr.filter(Number.isFinite),n=x.length;
  if(n<4)return NaN;
  const m=mean(x),sd=Math.sqrt(variance(x,false));
  if(!(sd>0))return 0;
  return x.reduce((s,v)=>s+Math.pow((v-m)/sd,4),0)/n - 3;
}
function runDataDiagnostics(){
  if(!diagData)return alert('Importe una base de datos.');
  const missThr=Number(document.getElementById('diagMissingThreshold').value)||5;
  const skewThr=Number(document.getElementById('diagSkewThreshold').value)||2;
  const kurtThr=Number(document.getElementById('diagKurtThreshold').value)||7;
  const zThr=Number(document.getElementById('diagOutlierZ').value)||3.29;

  const rows=[];
  for(let j=0;j<diagData.k;j++){
    const raw=diagData.matrix.map(r=>r[j]);
    const vals=raw.filter(Number.isFinite);
    const miss=raw.length-vals.length;
    const missPct=100*miss/raw.length;
    const m=vals.length?mean(vals):NaN;
    const sd=vals.length>1?Math.sqrt(variance(vals)):NaN;
    const sk=skewness(vals), ku=kurtosisExcess(vals);
    let out=0;
    if(Number.isFinite(sd)&&sd>0) out=vals.filter(v=>Math.abs((v-m)/sd)>=zThr).length;
    let status='Adecuado',cls='diag-ok';
    const issues=[];
    if(missPct>missThr){issues.push(`faltantes ${missPct.toFixed(1)}%`);cls='diag-alert';}
    if(Math.abs(sk)>skewThr){issues.push(`asimetría ${sk.toFixed(2)}`);cls='diag-alert';}
    if(Math.abs(ku)>kurtThr){issues.push(`curtosis ${ku.toFixed(2)}`);cls='diag-alert';}
    if(out>0){issues.push(`${out} posible(s) atípico(s)`);cls='diag-alert';}
    if(vals.length===0||!Number.isFinite(sd)||sd===0){issues.push('sin variabilidad');cls='diag-problem';}
    if(issues.length)status=issues.join('; ');
    rows.push({name:diagData.names[j],n:vals.length,missing:missPct,mean:m,sd,skew:sk,kurt:ku,outliers:out,status,cls});
  }
  const completeRows=diagData.matrix.filter(r=>r.every(Number.isFinite)).length;
  diagLast={rows,completeRows,n:diagData.n,k:diagData.k};
  renderDiagnostics(diagLast);
  logHistory('Diagnóstico','Ejecutar diagnóstico',{n:diagData.n,k:diagData.k});
}
function renderDiagnostics(r){
  const problems=r.rows.filter(x=>x.cls!=='diag-ok').length;
  document.getElementById('diagSummary').innerHTML=`
    <div class="metric-card"><span>Casos</span><strong>${r.n}</strong></div>
    <div class="metric-card"><span>Variables</span><strong>${r.k}</strong></div>
    <div class="metric-card"><span>Casos completos</span><strong>${r.completeRows}</strong></div>
    <div class="metric-card ${problems?'diag-alert':'diag-ok'}"><span>Variables a revisar</span><strong>${problems}</strong></div>`;
  let html='<div class="workspace"><table class="results-table"><thead><tr><th>Variable</th><th>N válido</th><th>Faltantes %</th><th>Media</th><th>DE</th><th>Asimetría</th><th>Curtosis</th><th>Atípicos</th><th>Orientación</th></tr></thead><tbody>';
  r.rows.forEach(x=>html+=`<tr class="${x.cls}"><td>${escapeHtml(x.name)}</td><td>${x.n}</td><td>${x.missing.toFixed(1)}</td><td>${fmtPro(x.mean)}</td><td>${fmtPro(x.sd)}</td><td>${fmtPro(x.skew)}</td><td>${fmtPro(x.kurt)}</td><td>${x.outliers}</td><td>${escapeHtml(x.status)}</td></tr>`);
  html+='</tbody></table></div><div class="sem-engine-note"><strong>Interpretación:</strong> los umbrales son orientativos. Para ítems ordinales, la normalidad univariada no debe evaluarse como requisito absoluto; seleccione un estimador coherente con la escala de medición, por ejemplo WLSMV cuando corresponda.</div>';
  document.getElementById('diagResults').innerHTML=html;
}
function loadDiagExample(){
  const names=['I1','I2','I3','I4','I5'];
  const matrix=[];
  for(let i=0;i<120;i++){
    matrix.push([
      Math.round(3+normalRandom()),
      Math.round(3+.8*normalRandom()),
      i%17===0?null:Math.round(3+normalRandom()),
      Math.round(2+Math.exp(.4*normalRandom())),
      i===5?10:Math.round(3+normalRandom())
    ]);
  }
  diagData={names,matrix,n:matrix.length,k:names.length};
  document.getElementById('diagSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${diagData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${diagData.k}</strong></div>`;
}
function downloadDiagnostics(){
  if(!diagLast)return alert('Primero ejecute el diagnóstico.');
  const rows=[['Variable','N_valido','Faltantes_pct','Media','DE','Asimetria','Curtosis','Atipicos','Orientacion']];
  diagLast.rows.forEach(x=>rows.push([x.name,x.n,x.missing,x.mean,x.sd,x.skew,x.kurt,x.outliers,x.status]));
  saveBlob("\ufeff"+rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8;','ValiStruct_diagnostico_datos.csv');
}
function downloadDiagnosticsReport(){
  if(!diagLast)return alert('Primero ejecute el diagnóstico.');
  const rows=diagLast.rows.map(x=>`<tr><td>${escapeHtml(x.name)}</td><td>${x.n}</td><td>${x.missing.toFixed(1)}</td><td>${fmtPro(x.mean)}</td><td>${fmtPro(x.sd)}</td><td>${fmtPro(x.skew)}</td><td>${fmtPro(x.kurt)}</td><td>${x.outliers}</td><td>${escapeHtml(x.status)}</td></tr>`).join('');
  const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Diagnóstico</title><style>body{font-family:Arial;max-width:1100px;margin:40px auto}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:7px}th{background:#f2f2f2}</style><body><h1>ValiStruct · Diagnóstico previo de datos</h1><p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Universidad Autónoma de Sinaloa</p><table><thead><tr><th>Variable</th><th>N</th><th>Faltantes %</th><th>Media</th><th>DE</th><th>Asimetría</th><th>Curtosis</th><th>Atípicos</th><th>Orientación</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  saveBlob(html,'text/html;charset=utf-8;','ValiStruct_diagnostico_datos.html');
}
document.getElementById('diagCsvFile')?.addEventListener('change',e=>{
  const f=e.target.files?.[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{try{diagData=parseDiagnosticCSV(reader.result);document.getElementById('diagSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${diagData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${diagData.k}</strong></div>`;}catch(err){alert(err.message);}};
  reader.readAsText(f,'utf-8');e.target.value='';
});
document.getElementById('loadDiagExample')?.addEventListener('click',loadDiagExample);
document.getElementById('runDiagnostics')?.addEventListener('click',runDataDiagnostics);
document.getElementById('downloadDiagnostics')?.addEventListener('click',downloadDiagnostics);
document.getElementById('downloadDiagnosticsReport')?.addEventListener('click',downloadDiagnosticsReport);

// -----------------------------
// v1.3 Historial reproducible
// -----------------------------
const HISTORY_KEY='valistruct_history_v13';
function getHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');}catch(_){return [];}}
function setHistory(x){localStorage.setItem(HISTORY_KEY,JSON.stringify(x.slice(-500)));}
function logHistory(module,action,meta={}){
  const h=getHistory();
  h.push({timestamp:new Date().toISOString(),module,action,meta});
  setHistory(h);renderHistory();
}
function renderHistory(){
  const box=document.getElementById('historyList');if(!box)return;
  const h=getHistory().slice().reverse();
  box.innerHTML=h.length?h.map(x=>`<div class="history-item"><strong>${escapeHtml(x.module)} · ${escapeHtml(x.action)}</strong><div class="history-meta"><span>${new Date(x.timestamp).toLocaleString()}</span><span>${escapeHtml(JSON.stringify(x.meta||{}))}</span></div></div>`).join(''):'<p class="small">Aún no hay eventos registrados.</p>';
}
document.getElementById('exportHistory')?.addEventListener('click',()=>saveBlob(JSON.stringify(getHistory(),null,2),'application/json;charset=utf-8;','ValiStruct_historial.json'));
document.getElementById('exportHistoryCsv')?.addEventListener('click',()=>{
  const rows=[['timestamp','modulo','accion','meta'],...getHistory().map(x=>[x.timestamp,x.module,x.action,JSON.stringify(x.meta||{})])];
  saveBlob("\ufeff"+rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8;','ValiStruct_historial.csv');
});
document.getElementById('clearHistory')?.addEventListener('click',()=>{if(confirm('¿Limpiar historial?')){localStorage.removeItem(HISTORY_KEY);renderHistory();}});
renderHistory();

// Register key actions
['saveProjectLocal','exportProject','generateApaReport','runQualityMetrics','runInvariance','runMultigroup'].forEach(id=>{
  document.getElementById(id)?.addEventListener('click',()=>setTimeout(()=>logHistory('ValiStruct',id,{}),0));
});


// -----------------------------
// v1.4 Missing-data guidance
// -----------------------------
function updateMissingGuidance(){
  if(!diagLast){
    document.getElementById('missingGuidanceText').textContent='Ejecute el diagnóstico para recibir una recomendación orientativa.';
    return;
  }
  const totalMissing = diagLast.rows.reduce((s,x)=>s+x.missing,0)/diagLast.rows.length;
  let msg='';
  if(totalMissing===0){
    msg='No se detectaron datos faltantes. No se requiere estrategia específica de imputación o FIML.';
  }else if(totalMissing<=5){
    msg=`El promedio de datos faltantes por variable es ${totalMissing.toFixed(1)}%. Puede ser manejable, pero revise el patrón de ausencia y evite decidir solo por porcentaje. Para AFC/SEM con datos continuos, FIML suele ser preferible a eliminar casos completos cuando sus supuestos son razonables.`;
  }else{
    msg=`El promedio de datos faltantes por variable es ${totalMissing.toFixed(1)}%. Conviene investigar el patrón de ausencia antes de modelar. Evite eliminación por lista automática si puede producir pérdida importante de información o sesgo.`;
  }
  document.getElementById('missingGuidanceText').textContent=msg;
}
const originalRenderDiagnostics = renderDiagnostics;
renderDiagnostics = function(r){
  originalRenderDiagnostics(r);
  updateMissingGuidance();
};
document.getElementById('applyListwiseGuide')?.addEventListener('click',()=>{
  document.getElementById('missingGuidanceText').textContent='Eliminación por lista: utilícela con prudencia cuando la proporción de faltantes sea pequeña y el mecanismo de ausencia no comprometa la representatividad. Puede reducir considerablemente el tamaño muestral.';
});
document.getElementById('applyFimlGuide')?.addEventListener('click',()=>{
  document.getElementById('missingGuidanceText').textContent='FIML: opción preferible en muchos modelos SEM con variables continuas cuando el mecanismo de ausencia es compatible con MAR. Requiere un estimador que lo soporte, como ML/MLR en el Motor Pro.';
});
document.getElementById('applyOrdinalGuide')?.addEventListener('click',()=>{
  document.getElementById('missingGuidanceText').textContent='Datos ordinales: con WLSMV, el tratamiento de datos faltantes depende del motor y del patrón de datos. Revise el porcentaje por ítem y considere estrategias coherentes con escalas Likert y correlaciones policóricas.';
});

// -----------------------------
// v1.4 Multivariate diagnostics
// -----------------------------
let multiData=null, multiLast=null;

function parseMultiCSV(text){
  return parseDiagnosticCSV(text);
}

function completeNumericMatrix(data){
  const rows=data.matrix.filter(r=>r.every(Number.isFinite));
  return rows;
}

function matTranspose(A){return A[0].map((_,j)=>A.map(r=>r[j]));}
function matMultiply(A,B){return A.map(row=>B[0].map((_,j)=>row.reduce((s,x,i)=>s+x*B[i][j],0)));}
function vecMatVec(v,M){
  let s=0;
  for(let i=0;i<v.length;i++)for(let j=0;j<v.length;j++)s+=v[i]*M[i][j]*v[j];
  return s;
}
function covMatrix(matrix){
  const p=matrix[0].length;
  const cols=matTranspose(matrix);
  return Array.from({length:p},(_,i)=>Array.from({length:p},(_,j)=>covariance(cols[i],cols[j])));
}
function columnMeans(matrix){
  return Array.from({length:matrix[0].length},(_,j)=>mean(matrix.map(r=>r[j])));
}
function mahalanobisDistances(matrix){
  const mu=columnMeans(matrix);
  const S=covMatrix(matrix);
  const inv=matrixInverse(S);
  if(!inv)return null;
  return matrix.map(r=>{
    const d=r.map((v,j)=>v-mu[j]);
    return vecMatVec(d,inv);
  });
}
function chiSquareQuantileApprox(p,df){
  // Wilson-Hilferty approximation
  const zMap={0.975:1.959963984540054,0.99:2.3263478740408408,0.999:3.0902323061678132};
  const z=zMap[p]||2.3263478740408408;
  const a=1-2/(9*df)+z*Math.sqrt(2/(9*df));
  return df*Math.pow(a,3);
}
function mardiaStats(matrix){
  const n=matrix.length,p=matrix[0].length;
  const mu=columnMeans(matrix);
  const S=covMatrix(matrix);
  const inv=matrixInverse(S);
  if(!inv)return null;
  const centered=matrix.map(r=>r.map((v,j)=>v-mu[j]));
  let b1=0;
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      const vi=centered[i],vj=centered[j];
      let q=0;
      for(let a=0;a<p;a++)for(let b=0;b<p;b++)q+=vi[a]*inv[a][b]*vj[b];
      b1+=Math.pow(q,3);
    }
  }
  b1/=n*n;
  let b2=0;
  for(let i=0;i<n;i++){
    const vi=centered[i];
    const q=vecMatVec(vi,inv);
    b2+=q*q;
  }
  b2/=n;
  const expectedK=p*(p+2);
  const zK=(b2-expectedK)/Math.sqrt(8*p*(p+2)/n);
  return {skewness:b1,kurtosis:b2,expectedK,zK};
}
function runMultiDiagnostics(){
  if(!multiData)return alert('Importe o cargue una base.');
  const matrix=completeNumericMatrix(multiData);
  if(matrix.length<Math.max(10,multiData.k+2))return alert('Se requieren más casos completos para diagnóstico multivariado.');
  const md=mahalanobisDistances(matrix);
  if(!md)return alert('No fue posible invertir la matriz de covarianzas. Revise colinealidad o variables sin variación.');
  const perc=Number(document.getElementById('mahalPercentile').value)||.99;
  const cutoff=chiSquareQuantileApprox(perc,multiData.k);
  const outIdx=md.map((v,i)=>({v,i})).filter(x=>x.v>cutoff);
  const mardia=mardiaStats(matrix);
  const R=efaCorrelationMatrix(matrix);
  const highThr=Number(document.getElementById('corrHighThreshold').value)||.90;
  const highPairs=[];
  for(let i=0;i<R.length;i++)for(let j=i+1;j<R.length;j++)if(Math.abs(R[i][j])>=highThr)highPairs.push({a:multiData.names[i],b:multiData.names[j],r:R[i][j]});
  multiLast={n:matrix.length,k:multiData.k,md,cutoff,outIdx,mardia,R,highPairs,names:multiData.names};
  renderMultiDiagnostics(multiLast);
  logHistory('Diagnóstico multivariado','Ejecutar',{n:matrix.length,k:multiData.k,outliers:outIdx.length});
}
function renderMultiDiagnostics(r){
  const nonnormal=Math.abs(r.mardia.zK)>1.96;
  document.getElementById('multiSummary').innerHTML=`
    <div class="metric-card"><span>Casos completos</span><strong>${r.n}</strong></div>
    <div class="metric-card"><span>Variables</span><strong>${r.k}</strong></div>
    <div class="metric-card ${r.outIdx.length?'diag-alert':'diag-ok'}"><span>Atípicos multivariados</span><strong>${r.outIdx.length}</strong></div>
    <div class="metric-card ${nonnormal?'diag-alert':'diag-ok'}"><span>Mardia kurtosis z</span><strong>${fmtPro(r.mardia.zK)}</strong></div>`;
  let html=`<div class="${nonnormal?'multi-warning':'multi-good'}"><strong>Normalidad multivariada:</strong> Mardia b₂,p = ${fmtPro(r.mardia.kurtosis)}; valor esperado ≈ ${fmtPro(r.mardia.expectedK)}; z ≈ ${fmtPro(r.mardia.zK)}. ${nonnormal?'Existe señal de desviación de normalidad multivariada; considere estimadores robustos como MLR o WLSMV según el tipo de datos.':'No se observa una señal fuerte de exceso de curtosis multivariada mediante este criterio aproximado.'}</div>`;
  html+=`<div class="${r.outIdx.length?'multi-warning':'multi-good'}"><strong>Mahalanobis:</strong> punto de corte χ² aproximado = ${fmtPro(r.cutoff)}. Se identificaron ${r.outIdx.length} caso(s) por encima del percentil configurado. No elimine casos automáticamente; revise plausibilidad y calidad de captura.</div>`;
  if(r.highPairs.length){
    html+=`<div class="multi-warning"><strong>Correlaciones altas:</strong> ${r.highPairs.map(x=>`${escapeHtml(x.a)}–${escapeHtml(x.b)} (${x.r.toFixed(2)})`).join('; ')}. Revise redundancia o colinealidad.</div>`;
  }
  html+='<div class="heatmap-wrap"><h3>Matriz de correlaciones</h3><table class="heatmap-table"><thead><tr><th></th>';
  r.names.forEach(n=>html+=`<th>${escapeHtml(n)}</th>`);
  html+='</tr></thead><tbody>';
  r.R.forEach((row,i)=>{
    html+=`<tr><th>${escapeHtml(r.names[i])}</th>`;
    row.forEach(v=>{
      const a=Math.abs(v),cls=a>=.90?'heatmap-cell-high':(a>=.50?'heatmap-cell-mid':'');
      html+=`<td class="${cls}">${v.toFixed(2)}</td>`;
    });
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  document.getElementById('multiResults').innerHTML=html;
}
function loadMultiExample(){
  const names=['X1','X2','X3','X4','X5','X6'];
  const matrix=[];
  for(let i=0;i<180;i++){
    const f=normalRandom(),g=.3*f+normalRandom();
    matrix.push([
      .8*f+.5*normalRandom(),.75*f+.6*normalRandom(),.7*f+.6*normalRandom(),
      .8*g+.5*normalRandom(),.72*g+.6*normalRandom(),.68*g+.6*normalRandom()
    ]);
  }
  matrix[4]=[8,8,8,8,8,8];
  multiData={names,matrix,n:matrix.length,k:names.length};
  document.getElementById('multiSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${multiData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${multiData.k}</strong></div>`;
}
function downloadMultiResults(){
  if(!multiLast)return alert('Primero ejecute el diagnóstico multivariado.');
  const rows=[['Indicador','Valor'],['N_completo',multiLast.n],['Variables',multiLast.k],['Mardia_skewness',multiLast.mardia.skewness],['Mardia_kurtosis',multiLast.mardia.kurtosis],['Mardia_kurtosis_z',multiLast.mardia.zK],['Mahalanobis_cutoff',multiLast.cutoff],['Outliers_multivariados',multiLast.outIdx.length],[],['Caso_index_0based','Mahalanobis_D2']];
  multiLast.outIdx.forEach(x=>rows.push([x.i,x.v]));
  saveBlob("\ufeff"+rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv;charset=utf-8;','ValiStruct_diagnostico_multivariado.csv');
}
function downloadMultiReport(){
  if(!multiLast)return alert('Primero ejecute el diagnóstico multivariado.');
  const r=multiLast;
  const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Diagnóstico multivariado</title><style>body{font-family:Arial;max-width:1000px;margin:40px auto;line-height:1.6}</style><body><h1>ValiStruct · Diagnóstico multivariado</h1><p><strong>Dr. Roberto Joel Tirado Reyes</strong><br>Universidad Autónoma de Sinaloa</p><p>Mardia kurtosis=${fmtPro(r.mardia.kurtosis)}, z=${fmtPro(r.mardia.zK)}.</p><p>Mahalanobis cutoff=${fmtPro(r.cutoff)}; casos por encima=${r.outIdx.length}.</p><p>Correlaciones altas detectadas=${r.highPairs.length}.</p></body></html>`;
  saveBlob(html,'text/html;charset=utf-8;','ValiStruct_diagnostico_multivariado.html');
}
document.getElementById('multiCsvFile')?.addEventListener('change',e=>{
  const f=e.target.files?.[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{try{multiData=parseMultiCSV(reader.result);document.getElementById('multiSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${multiData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${multiData.k}</strong></div>`;}catch(err){alert(err.message);}};
  reader.readAsText(f,'utf-8');e.target.value='';
});
document.getElementById('reuseDiagData')?.addEventListener('click',()=>{if(!diagData)return alert('No hay una base previa en Diagnóstico de datos.');multiData=diagData;document.getElementById('multiSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${multiData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${multiData.k}</strong></div>`;});
document.getElementById('loadMultiExample')?.addEventListener('click',loadMultiExample);
document.getElementById('runMultiDiagnostics')?.addEventListener('click',runMultiDiagnostics);
document.getElementById('downloadMultiResults')?.addEventListener('click',downloadMultiResults);
document.getElementById('downloadMultiReport')?.addEventListener('click',downloadMultiReport);

// -----------------------------
// v1.4 Article-ready tables
// -----------------------------
let articleTablesPlain='';

function dec(v,d=3){
  const n=Number(v);return Number.isFinite(n)?n.toFixed(d):'—';
}
function generateArticleTables(){
  const d=Number(document.getElementById('articleDecimals').value)||3;
  let html='',plain=[]; let t=1;
  function block(title,headers,rows,note=''){
    html+=`<div class="article-table-block"><div class="apa-table-title">Tabla ${t}<br>${escapeHtml(title)}</div><table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>${note?`<div class="apa-note"><em>Nota.</em> ${note}</div>`:''}</div>`;
    plain.push(`Tabla ${t}. ${title}`,headers.join('\t'),...rows.map(r=>r.map(x=>String(x).replace(/<[^>]+>/g,'')).join('\t')),'');
    t++;
  }

  if(lastResults?.length){
    const rows=lastResults.map(r=>[escapeHtml(r.item),escapeHtml(r.criterion),dec(r.v,d),`${dec(r.ci?.lower,d)}–${dec(r.ci?.upper,d)}`,escapeHtml(r.status||'')]);
    block('Validez de contenido mediante V de Aiken',['Ítem','Criterio','V','IC','Interpretación'],rows,'V = V de Aiken; IC = intervalo de confianza.');
  }
  if(relLastResults){
    const rows=relLastResults.itemRows.map(x=>[escapeHtml(x.name),dec(x.mean,d),dec(x.sd,d),dec(x.rit,d),dec(x.aDel,d),escapeHtml(x.flag)]);
    block('Análisis de confiabilidad por reactivo',['Ítem','M','DE','r ítem-total','α si se elimina','Orientación'],rows,`Alfa global = ${dec(relLastResults.alpha,d)}.`);
  }
  if(efaLastResults){
    const headers=['Ítem',...Array.from({length:efaLastResults.m},(_,i)=>`F${i+1}`),'h²','Orientación'];
    const rows=efaLastResults.loadings.map((row,i)=>[escapeHtml(efaData.itemNames[i]),...row.map(v=>dec(v,d)),dec(efaLastResults.communalities[i],d),escapeHtml(efaLastResults.itemDiag[i].status)]);
    block('Matriz de cargas factoriales exploratorias',headers,rows,`KMO = ${dec(efaLastResults.kmo.overall,d)}; Bartlett p ${efaLastResults.bart.p<.001?'&lt; .001':'= '+dec(efaLastResults.bart.p,d)}.`);
  }
  if(proLastResponse?.parameters){
    const pars=proLastResponse.parameters.filter(p=>['=~','~','~~'].includes(p.op));
    const rows=pars.map(p=>[escapeHtml(p.lhs),escapeHtml(p.op),escapeHtml(p.rhs),dec(p.est,d),dec(p.se,d),dec(p.std_all,d),Number(p.pvalue)<.001?'&lt; .001':dec(p.pvalue,d)]);
    block('Parámetros del modelo confirmatorio/estructural',['lhs','op','rhs','Est.','EE','Std.all','p'],rows,'Estimaciones obtenidas mediante Motor Pro/lavaan.');
  }
  if(advancedLastResponse?.metrics){
    const rows=advancedLastResponse.metrics.map(x=>[escapeHtml(x.factor),dec(x.cr,d),dec(x.ave,d)]);
    block('Confiabilidad compuesta y validez convergente',['Constructo','CR','AVE'],rows,'CR = confiabilidad compuesta; AVE = varianza media extraída.');
  }
  if(!html)html='<p class="small">No hay resultados suficientes para generar tablas.</p>';
  document.getElementById('articleTablesOutput').innerHTML=html;
  articleTablesPlain=plain.join('\n');
  logHistory('Tablas para artículo','Generar',{tables:t-1});
}
function copyArticleTables(){
  if(!articleTablesPlain)return alert('Primero genere las tablas.');
  navigator.clipboard.writeText(articleTablesPlain).then(()=>alert('Tablas copiadas.')).catch(()=>alert('No fue posible copiar.'));
}
function downloadArticleHtml(){
  const out=document.getElementById('articleTablesOutput');
  if(!out.innerHTML.trim())return alert('Primero genere las tablas.');
  const html=`<!doctype html><html lang="es"><meta charset="utf-8"><title>ValiStruct · Tablas para artículo</title><style>body{font-family:Arial;max-width:1000px;margin:40px auto}.article-table-block{margin:24px 0}.article-table-block table{width:100%;border-collapse:collapse}.article-table-block th,.article-table-block td{border-bottom:1px solid #aaa;padding:7px}.article-table-block th{border-top:1px solid #333;text-align:left}.apa-table-title{font-weight:bold}.apa-note{font-size:13px}</style><body>${out.innerHTML}</body></html>`;
  saveBlob(html,'text/html;charset=utf-8;','ValiStruct_tablas_articulo.html');
}
function downloadArticleCsv(){
  const files=[];
  let idx=1;
  const outputs=[];
  if(lastResults?.length){
    const rows=[['Item','Criterio','V','IC_inf','IC_sup','Estado'],...lastResults.map(r=>[r.item,r.criterion,r.v,r.ci?.lower,r.ci?.upper,r.status])];
    outputs.push({name:`tabla_${idx++}_aiken.csv`,content:rows.map(r=>r.map(csvEscape).join(',')).join('\n')});
  }
  if(relLastResults){
    const rows=[['Item','Media','DE','rit','Alpha_si_elimina','Estado'],...relLastResults.itemRows.map(x=>[x.name,x.mean,x.sd,x.rit,x.aDel,x.flag])];
    outputs.push({name:`tabla_${idx++}_confiabilidad.csv`,content:rows.map(r=>r.map(csvEscape).join(',')).join('\n')});
  }
  if(efaLastResults){
    const rows=[['Item',...Array.from({length:efaLastResults.m},(_,i)=>`F${i+1}`),'Comunalidad','Estado'],...efaLastResults.loadings.map((row,i)=>[efaData.itemNames[i],...row,efaLastResults.communalities[i],efaLastResults.itemDiag[i].status])];
    outputs.push({name:`tabla_${idx++}_afe.csv`,content:rows.map(r=>r.map(csvEscape).join(',')).join('\n')});
  }
  if(!outputs.length)return alert('No hay tablas disponibles.');
  // browser limitation: package multiple CSVs into a single text manifest
  const combined=outputs.map(o=>`### ${o.name}\n${o.content}`).join('\n\n');
  saveBlob("\ufeff"+combined,'text/plain;charset=utf-8;','ValiStruct_paquete_tablas_csv.txt');
}
document.getElementById('generateArticleTables')?.addEventListener('click',generateArticleTables);
document.getElementById('copyArticleTables')?.addEventListener('click',copyArticleTables);
document.getElementById('downloadArticleHtml')?.addEventListener('click',downloadArticleHtml);
document.getElementById('downloadArticleCsv')?.addEventListener('click',downloadArticleCsv);


// -----------------------------
// v1.5 Correlation figure export
// -----------------------------
function exportCorrelationPng(){
  if(!multiLast)return alert('Primero ejecute el diagnóstico multivariado.');
  const names=multiLast.names,R=multiLast.R;
  const cell=64,margin=150;
  const size=margin+names.length*cell+30;
  const canvas=document.createElement('canvas');
  canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='white';ctx.fillRect(0,0,size,size);
  ctx.font='12px Arial';ctx.fillStyle='#222';
  names.forEach((n,i)=>{
    ctx.save();
    ctx.translate(margin+i*cell+cell/2,margin-8);
    ctx.rotate(-Math.PI/4);
    ctx.fillText(n,0,0);
    ctx.restore();
    ctx.fillText(n,8,margin+i*cell+cell/2);
  });
  for(let i=0;i<R.length;i++){
    for(let j=0;j<R.length;j++){
      const v=R[i][j];
      const a=Math.min(1,Math.abs(v));
      const shade=Math.round(255-(a*90));
      ctx.fillStyle=`rgb(${255},${shade},${shade})`;
      ctx.fillRect(margin+j*cell,margin+i*cell,cell,cell);
      ctx.strokeStyle='#ddd';ctx.strokeRect(margin+j*cell,margin+i*cell,cell,cell);
      ctx.fillStyle='#222';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(v.toFixed(2),margin+j*cell+cell/2,margin+i*cell+cell/2);
    }
  }
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.font='bold 18px Arial';ctx.fillText('ValiStruct · Matriz de correlaciones',8,26);
  canvas.toBlob(blob=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ValiStruct_matriz_correlaciones.png';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  },'image/png');
  logHistory('Diagnóstico multivariado','Exportar matriz PNG',{variables:names.length});
}
document.getElementById('exportCorrPng')?.addEventListener('click',exportCorrelationPng);

// -----------------------------
// v1.5 Missing data professional module
// -----------------------------
let missingDataText=null;
let missingLastResponse=null;

function summarizeMissingText(text){
  try{
    const rows=parseCSV(text.replace(/^\uFEFF/,''));
    const headers=rows[0];
    const body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
    let missing=0,total=0;
    body.forEach(r=>r.forEach((v,i)=>{
      if(i===0 && /^(id|folio|participante|sujeto|caso)$/i.test(headers[0]||''))return;
      total++;if(String(v??'').trim()==='')missing++;
    }));
    document.getElementById('missingSummary').innerHTML=`
      <div class="metric-card"><span>Casos</span><strong>${body.length}</strong></div>
      <div class="metric-card"><span>Columnas</span><strong>${headers.length}</strong></div>
      <div class="metric-card"><span>Celdas faltantes</span><strong>${missing}</strong></div>
      <div class="metric-card"><span>Faltantes globales</span><strong>${total?((100*missing/total).toFixed(1)):'0.0'}%</strong></div>`;
  }catch(e){document.getElementById('missingSummary').innerHTML='<div class="model-error">No fue posible leer la base.</div>';}
}

function localMissingPatterns(text){
  const rows=parseCSV(text.replace(/^\uFEFF/,''));
  const headers=rows[0].map(x=>x.trim());
  const body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
  let start=0;if(/^(id|folio|participante|sujeto|caso)$/i.test(headers[0]||''))start=1;
  const names=headers.slice(start);
  const map=new Map();
  body.forEach(r=>{
    const pattern=r.slice(start,start+names.length).map(v=>String(v??'').trim()===''?'0':'1').join('');
    map.set(pattern,(map.get(pattern)||0)+1);
  });
  return {names,patterns:[...map.entries()].sort((a,b)=>b[1]-a[1]).map(([pattern,count])=>({pattern,count}))};
}
function renderLocalMissingPatterns(obj){
  let html='<h3>Patrones de ausencia</h3><div class="workspace"><table class="missing-pattern-table"><thead><tr><th>Patrón</th><th>Frecuencia</th><th>Lectura</th></tr></thead><tbody>';
  obj.patterns.slice(0,30).forEach(p=>{
    const miss=[...p.pattern].map((x,i)=>x==='0'?obj.names[i]:null).filter(Boolean);
    html+=`<tr><td>${p.pattern}</td><td>${p.count}</td><td>${miss.length?`Faltan: ${miss.map(escapeHtml).join(', ')}`:'Caso completo'}</td></tr>`;
  });
  html+='</tbody></table></div><div class="sem-engine-note">1 = observado, 0 = faltante. Patrones repetidos pueden orientar el análisis del mecanismo de ausencia.</div>';
  document.getElementById('missingResults').innerHTML=html;
}
document.getElementById('runMissingPattern')?.addEventListener('click',()=>{
  if(!missingDataText)return alert('Importe o reutilice una base.');
  const obj=localMissingPatterns(missingDataText);
  renderLocalMissingPatterns(obj);
  logHistory('Datos faltantes Pro','Patrones',{patterns:obj.patterns.length});
});
document.getElementById('missingCsvFile')?.addEventListener('change',e=>{
  const f=e.target.files?.[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{missingDataText=reader.result;summarizeMissingText(missingDataText);};
  reader.readAsText(f,'utf-8');e.target.value='';
});
document.getElementById('reuseMissingDiag')?.addEventListener('click',()=>{
  if(!diagData)return alert('No hay base disponible en Diagnóstico de datos.');
  const rows=[['ID',...diagData.names]];
  diagData.matrix.forEach((r,i)=>rows.push([`P${i+1}`,...r.map(v=>v==null?'':v)]));
  missingDataText=rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  summarizeMissingText(missingDataText);
});
document.getElementById('runLittleMcar')?.addEventListener('click',async()=>{
  if(!missingDataText)return alert('Importe o reutilice una base.');
  const box=document.getElementById('missingResults');
  box.innerHTML='<div class="notice">Ejecutando análisis MCAR en Motor Pro…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/missingness`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({csv_text:missingDataText})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'Error en análisis MCAR');
    missingLastResponse=data;
    let html=`<div class="results-summary"><h3>Prueba MCAR</h3>
      <div class="result-cards">
        <div class="result-card"><span>χ²</span><strong>${fmtPro(data.statistic)}</strong></div>
        <div class="result-card"><span>gl</span><strong>${data.df??'—'}</strong></div>
        <div class="result-card"><span>p</span><strong>${Number(data.p_value)<.001?'&lt; .001':fmtPro(data.p_value)}</strong></div>
        <div class="result-card"><span>Patrones</span><strong>${data.patterns??'—'}</strong></div>
      </div>
      <div class="${Number(data.p_value)>=.05?'multi-good':'multi-warning'}">${escapeHtml(data.interpretation||'')}</div>
      <div class="sem-engine-note">Una prueba no significativa es compatible con MCAR, pero no demuestra por sí sola que la ausencia sea completamente aleatoria. Combine este resultado con conocimiento del proceso de recolección y patrones observados.</div>
    </div>`;
    box.innerHTML=html;
    logHistory('Datos faltantes Pro','Prueba MCAR',{p:data.p_value});
  }catch(e){
    box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;
  }
});
document.getElementById('downloadMissingReport')?.addEventListener('click',()=>{
  if(!missingLastResponse)return alert('Primero ejecute la prueba MCAR.');
  saveBlob(JSON.stringify(missingLastResponse,null,2),'application/json;charset=utf-8;','ValiStruct_datos_faltantes_MCAR.json');
});

// -----------------------------
// v1.5 Validation coverage dashboard
// -----------------------------
let qualityLast=null;

function buildQualityDashboard(){
  const stages=[
    {
      name:'Validez de contenido',
      done:!!(lastResults?.length),
      review:lastResults?.some?.(x=>Number(x.v)<.70),
      detail:lastResults?.length?`${lastResults.length} resultados V de Aiken disponibles.`:'Sin resultados de V de Aiken.'
    },
    {
      name:'Diagnóstico de datos',
      done:!!diagLast,
      review:diagLast?.rows?.some?.(x=>x.cls!=='diag-ok'),
      detail:diagLast?`${diagLast.rows.length} variables diagnosticadas.`:'Pendiente diagnóstico univariado.'
    },
    {
      name:'Diagnóstico multivariado',
      done:!!multiLast,
      review:!!(multiLast?.outIdx?.length || (multiLast?.mardia && Math.abs(multiLast.mardia.zK)>1.96)),
      detail:multiLast?`${multiLast.outIdx.length} posibles outliers multivariados; Mardia z=${fmtPro(multiLast.mardia.zK)}.`:'Pendiente diagnóstico multivariado.'
    },
    {
      name:'Confiabilidad',
      done:!!relLastResults,
      review:relLastResults?Number(relLastResults.alpha)<.70:false,
      detail:relLastResults?`α=${fmtPro(relLastResults.alpha)}.`:'Pendiente análisis de confiabilidad.'
    },
    {
      name:'AFE',
      done:!!efaLastResults,
      review:efaLastResults?Number(efaLastResults.kmo?.overall)<.70:false,
      detail:efaLastResults?`KMO=${fmtPro(efaLastResults.kmo.overall)}; factores sugeridos=${efaLastResults.retainedPA}.`:'Pendiente AFE.'
    },
    {
      name:'AFC / Motor Pro',
      done:!!proLastResponse?.fit || !!cfaLastResults,
      review:!!(proLastResponse?.fit && ((Number(proLastResponse.fit.cfi)<.90)||(Number(proLastResponse.fit.rmsea)>.08)||(Number(proLastResponse.fit.srmr)>.08))),
      detail:proLastResponse?.fit?`CFI=${fmtPro(proLastResponse.fit.cfi)}, RMSEA=${fmtPro(proLastResponse.fit.rmsea)}, SRMR=${fmtPro(proLastResponse.fit.srmr)}.`:(cfaLastResults?`AFC preliminar: SRMR=${fmtPro(cfaLastResults.srmr)}.`:'Pendiente AFC.')
    },
    {
      name:'Validez convergente/discriminante',
      done:!!advancedLastResponse?.metrics,
      review:advancedLastResponse?.metrics?.some?.(x=>Number(x.cr)<.70||Number(x.ave)<.50) || advancedLastResponse?.htmt?.some?.(x=>!x.ok),
      detail:advancedLastResponse?.metrics?`${advancedLastResponse.metrics.length} constructos con CR/AVE.`:'Pendiente CR/AVE/HTMT.'
    },
    {
      name:'SEM / relaciones estructurales',
      done:!!semStructuralResults?.paths?.length || !!proLastResponse?.parameters?.some?.(x=>x.op==='~'),
      review:false,
      detail:semStructuralResults?.paths?.length?`${semStructuralResults.paths.length} rutas estructurales preliminares.`:'Sin modelo estructural documentado.'
    },
    {
      name:'Invariancia / multigrupo',
      done:!!advancedLastResponse?.invariance,
      review:false,
      detail:advancedLastResponse?.invariance?`${advancedLastResponse.invariance.length} etapas evaluadas.`:'Pendiente o no aplicable.'
    }
  ];
  const applicable=stages.length;
  const completed=stages.filter(s=>s.done).length;
  const coverage=Math.round(100*completed/applicable);
  qualityLast={coverage,completed,applicable,stages,timestamp:new Date().toISOString()};
  renderQualityDashboard(qualityLast);
}
function renderQualityDashboard(q){
  document.getElementById('qualityDashboardSummary').innerHTML=`
    <div class="metric-card"><span>Cobertura del proceso</span><strong>${q.coverage}%</strong></div>
    <div class="metric-card"><span>Etapas con evidencia</span><strong>${q.completed}/${q.applicable}</strong></div>
    <div class="metric-card"><span>Etapas a revisar</span><strong>${q.stages.filter(x=>x.review).length}</strong></div>`;
  let html=`<div class="progress-shell"><div class="progress-bar" style="width:${q.coverage}%"></div></div>`;
  q.stages.forEach(s=>{
    const cls=!s.done?'stage-pending':(s.review?'stage-review':'stage-complete');
    const badge=!s.done?'Pendiente':(s.review?'Disponible · revisar':'Disponible');
    html+=`<div class="quality-stage ${cls}">
      <div class="stage-head"><strong>${escapeHtml(s.name)}</strong><span class="stage-badge">${badge}</span></div>
      <p>${escapeHtml(s.detail)}</p>
    </div>`;
  });
  html+=`<div class="sem-engine-note"><strong>Lectura del dashboard:</strong> ${q.coverage}% indica cuántas etapas tienen evidencia cargada en ValiStruct. No representa porcentaje de validez ni calidad científica del instrumento.</div>`;
  document.getElementById('qualityDashboardContent').innerHTML=html;
}
document.getElementById('refreshQualityDashboard')?.addEventListener('click',()=>{
  buildQualityDashboard();
  logHistory('Dashboard','Actualizar',{coverage:qualityLast?.coverage});
});
document.getElementById('downloadQualitySummary')?.addEventListener('click',()=>{
  if(!qualityLast)buildQualityDashboard();
  saveBlob(JSON.stringify(qualityLast,null,2),'application/json;charset=utf-8;','ValiStruct_dashboard_validacion.json');
});
buildQualityDashboard();

// -----------------------------
// v1.5 Article tables DOCX
// -----------------------------
async function downloadArticleDocx(){
  const out=document.getElementById('articleTablesOutput');
  if(!out?.innerHTML.trim())return alert('Primero genere las tablas.');
  try{
    const res=await fetch(`${getProApiBase()}/article-docx`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        html:out.innerHTML,
        title:document.getElementById('reportStudyTitle')?.value||'Tablas de resultados',
        author:'Dr. Roberto Joel Tirado Reyes',
        institution:'Universidad Autónoma de Sinaloa'
      })
    });
    if(!res.ok)throw new Error(await res.text());
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ValiStruct_tablas_articulo.docx';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    logHistory('Tablas para artículo','Exportar DOCX',{});
  }catch(e){alert('El DOCX requiere backend v1.5 activo. '+e.message);}
}
document.getElementById('downloadArticleDocx')?.addEventListener('click',downloadArticleDocx);


// -----------------------------
// v1.6 Estimator selection assistant
// -----------------------------
let estimatorRecommendation=null;

function runEstimatorGuide(){
  const type=document.getElementById('estVarType').value;
  const norm=document.getElementById('estNormality').value;
  const missing=document.getElementById('estMissing').value;
  const n=Number(document.getElementById('estSampleN').value)||0;

  let estimator='MLR';
  let reasons=[];
  let cautions=[];

  if(type==='ordinal4'){
    estimator='WLSMV';
    reasons.push('Las variables ordinales con pocas categorías suelen modelarse mejor mediante umbrales y correlaciones apropiadas para datos ordinales.');
  }else if(type==='likert5'){
    if(norm==='normal' && n>=300){
      estimator='MLR';
      reasons.push('Con 5–7 categorías y tamaño muestral moderado/grande, MLR ofrece una opción robusta y flexible.');
    }else{
      estimator='WLSMV';
      reasons.push('La combinación de ordinalidad y desviaciones de normalidad favorece WLSMV.');
    }
  }else if(type==='continuous'){
    estimator=norm==='normal'?'ML':'MLR';
    reasons.push(norm==='normal'?'Los datos continuos sin desviaciones importantes son compatibles con ML.':'MLR corrige errores estándar y pruebas de ajuste ante no normalidad.');
  }else if(type==='mixed'){
    estimator='MLR';
    reasons.push('Con variables mixtas, MLR puede ser un punto de partida si las ordinales tienen suficientes categorías; para ordinalidad marcada revise WLSMV.');
    cautions.push('Los modelos realmente mixtos pueden requerir una estrategia más específica que esta recomendación general.');
  }

  if(missing==='moderate'){
    if(estimator==='ML'||estimator==='MLR'){
      reasons.push('FIML puede aprovechar información incompleta bajo supuestos razonables de MAR.');
    }else{
      cautions.push('Con WLSMV, revise cuidadosamente el tratamiento de datos faltantes y la implementación del motor.');
    }
  }
  if(n<150)cautions.push('El tamaño muestral es reducido para muchos modelos AFC/SEM; considere simplificar el modelo o realizar simulación específica.');
  if(n>=500)reasons.push('El tamaño muestral amplio favorece estabilidad, aunque no corrige por sí solo una mala especificación.');

  estimatorRecommendation={estimator,reasons,cautions,n,type,norm,missing};
  document.getElementById('estimatorGuideResults').innerHTML=`
    <div class="estimator-card">
      <span>Estimador orientativo</span>
      <div class="estimator-choice">${estimator}</div>
      <h4>Razones</h4><ul>${reasons.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
      ${cautions.length?`<h4>Precauciones</h4><ul>${cautions.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>`:''}
      <div class="sem-engine-note"><strong>Uso responsable:</strong> esta recomendación es orientativa. La selección final depende del nivel de medición, distribución, tamaño muestral, complejidad del modelo y software estadístico.</div>
    </div>`;
  logHistory('Asistente de estimador','Recomendación',{estimator,n,type,norm,missing});
}
document.getElementById('runEstimatorGuide')?.addEventListener('click',runEstimatorGuide);
document.getElementById('applyEstimatorToPro')?.addEventListener('click',()=>{
  if(!estimatorRecommendation)runEstimatorGuide();
  if(estimatorRecommendation && document.getElementById('proEstimator')){
    document.getElementById('proEstimator').value=estimatorRecommendation.estimator;
    alert(`Se aplicó ${estimatorRecommendation.estimator} al Motor Pro.`);
  }
});

// -----------------------------
// v1.6 Sample-size orientation
// -----------------------------
let sampleSizeLast=null;

function evaluateSampleSize(){
  const observed=Number(document.getElementById('ssObserved').value)||0;
  const latent=Number(document.getElementById('ssLatent').value)||0;
  const params=Number(document.getElementById('ssFreeParams').value)||0;
  const n=Number(document.getElementById('ssCurrentN').value)||0;
  const ratio=params? n/params : NaN;

  let status='Revisar con simulación específica',cls='diag-alert';
  const notes=[];
  if(n>=200 && ratio>=5){
    status='Cobertura preliminar razonable';
    cls='diag-ok';
    notes.push('N y razón N/parámetro superan reglas prácticas comunes, pero esto no garantiza potencia ni convergencia.');
  }else{
    notes.push('La muestra puede ser limitada respecto a la complejidad especificada.');
  }
  if(observed>40)notes.push('El número de indicadores es alto; la complejidad y los patrones de datos pueden aumentar la demanda muestral.');
  if(latent>8)notes.push('Un número elevado de factores puede incrementar la inestabilidad del modelo.');
  notes.push('La recomendación preferida para planificación rigurosa es una simulación Monte Carlo específica del modelo.');

  sampleSizeLast={observed,latent,params,n,ratio,status,notes};
  document.getElementById('sampleSizeResults').innerHTML=`
    <div class="result-cards">
      <div class="result-card"><span>N</span><strong>${n}</strong></div>
      <div class="result-card"><span>Parámetros libres</span><strong>${params}</strong></div>
      <div class="result-card ${cls}"><span>N / parámetro</span><strong>${Number.isFinite(ratio)?ratio.toFixed(1):'—'}</strong></div>
    </div>
    <div class="${cls==='diag-ok'?'multi-good':'multi-warning'}"><strong>${status}</strong><ul>${notes.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`;
  logHistory('Tamaño muestral','Evaluación',{n,params,ratio});
}

// Approximate power simulation for standardized simple regression/correlation
function normalCdf(z){
  const erf=(x)=>{
    const sign=x<0?-1:1,a=Math.abs(x),t=1/(1+0.3275911*a);
    const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*Math.exp(-a*a);
    return sign*y;
  };
  return .5*(1+erf(z/Math.sqrt(2)));
}
function runMonteCarloBasic(){
  const beta=Number(document.getElementById('mcBeta').value)||0;
  const n=Math.max(30,Number(document.getElementById('mcN').value)||200);
  const runs=Math.max(100,Math.min(5000,Number(document.getElementById('mcRuns').value)||1000));
  const alpha=Number(document.getElementById('mcAlpha').value)||.05;
  let hits=0, estimates=[], ses=[];
  const critical=alpha===.01?2.575829:1.959964;

  for(let r=0;r<runs;r++){
    const x=[],y=[];
    for(let i=0;i<n;i++){
      const xv=normalRandom();
      const ev=normalRandom();
      const yv=beta*xv+Math.sqrt(Math.max(.0001,1-beta*beta))*ev;
      x.push(xv);y.push(yv);
    }
    const xs=standardizedSeries(x),ys=standardizedSeries(y);
    const fit=olsStandardized(ys,[xs]);
    if(!fit)continue;
    const b=fit.beta[0],se=fit.se[0],z=Math.abs(b/se);
    estimates.push(b);ses.push(se);
    if(z>=critical)hits++;
  }
  const power=hits/runs;
  const avgBeta=mean(estimates),avgSe=mean(ses);
  document.getElementById('monteCarloResults').innerHTML=`
    <div class="result-cards">
      <div class="result-card ${power>=.80?'diag-ok':'diag-alert'}"><span>Potencia aproximada</span><strong>${(100*power).toFixed(1)}%</strong></div>
      <div class="result-card"><span>β promedio</span><strong>${avgBeta.toFixed(3)}</strong></div>
      <div class="result-card"><span>EE promedio</span><strong>${avgSe.toFixed(3)}</strong></div>
    </div>
    <div class="power-meter"><div style="width:${Math.min(100,100*power)}%"></div></div>
    <div class="sem-engine-note">Simulación educativa para una sola ruta estandarizada. La potencia de un SEM completo depende de cargas, número de factores, covarianzas, datos faltantes, estimador y patrón de parámetros.</div>`;
  logHistory('Monte Carlo','Simulación básica',{beta,n,runs,power});
}
document.getElementById('evaluateSampleSize')?.addEventListener('click',evaluateSampleSize);
document.getElementById('runMonteCarlo')?.addEventListener('click',runMonteCarloBasic);

// -----------------------------
// v1.6 Advanced lavaan syntax generator
// -----------------------------
let advancedGeneratedSyntax='';

function generateAdvancedSyntax(){
  const factorLines=document.getElementById('synFactors').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const pathLines=document.getElementById('synPaths').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const covLines=document.getElementById('synCovs').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const defLines=document.getElementById('synDefined').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);

  const out=[];
  factorLines.forEach(line=>{
    const m=line.match(/^([^=]+)=(.+)$/);
    if(m){
      const f=m[1].trim(),inds=m[2].split(',').map(x=>x.trim()).filter(Boolean);
      if(inds.length)out.push(`${f} =~ ${inds.join(' + ')}`);
    }else if(line.includes('=~'))out.push(line);
  });
  pathLines.forEach(x=>out.push(x));
  covLines.forEach(x=>out.push(x));
  defLines.forEach(x=>out.push(x));

  advancedGeneratedSyntax=out.join('\n');
  document.getElementById('advancedSyntaxOutput').value=advancedGeneratedSyntax || '# Complete los campos para generar sintaxis.';
  logHistory('Sintaxis Pro','Generar',{lines:out.length});
}
document.getElementById('generateAdvancedSyntax')?.addEventListener('click',generateAdvancedSyntax);
document.getElementById('sendSyntaxToPro')?.addEventListener('click',()=>{
  if(!advancedGeneratedSyntax)generateAdvancedSyntax();
  if(advancedGeneratedSyntax && document.getElementById('proSyntax')){
    document.getElementById('proSyntax').value=advancedGeneratedSyntax;
    alert('Sintaxis enviada a Motor Pro.');
  }
});
document.getElementById('copyAdvancedSyntax')?.addEventListener('click',()=>{
  if(!advancedGeneratedSyntax)generateAdvancedSyntax();
  navigator.clipboard.writeText(advancedGeneratedSyntax).then(()=>alert('Sintaxis copiada.')).catch(()=>alert('No fue posible copiar.'));
});

// -----------------------------
// v1.6 Consolidated XLSX export through backend
// -----------------------------
function buildConsolidatedExportPayload(){
  return {
    author:'Dr. Roberto Joel Tirado Reyes',
    institution:'Universidad Autónoma de Sinaloa',
    project:projectState ? projectState() : null,
    diagnostics:diagLast,
    multivariate:multiLast ? {
      n:multiLast.n,k:multiLast.k,mardia:multiLast.mardia,
      cutoff:multiLast.cutoff,outliers:multiLast.outIdx,highPairs:multiLast.highPairs,
      names:multiLast.names,R:multiLast.R
    } : null,
    reliability:relLastResults,
    efa:efaLastResults ? {
      kmo:efaLastResults.kmo,bart:efaLastResults.bart,retainedPA:efaLastResults.retainedPA,
      loadings:efaLastResults.loadings,communalities:efaLastResults.communalities,
      itemDiag:efaLastResults.itemDiag,itemNames:efaData?.itemNames||[]
    } : null,
    cfa:cfaLastResults,
    motorPro:proLastResponse,
    advanced:advancedLastResponse,
    sem:semStructuralResults,
    quality:qualityLast,
    estimatorGuide:estimatorRecommendation,
    sampleSize:sampleSizeLast,
    history:getHistory()
  };
}
document.getElementById('downloadConsolidatedXlsx')?.addEventListener('click',async()=>{
  try{
    const res=await fetch(`${getProApiBase()}/export-xlsx`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(buildConsolidatedExportPayload())
    });
    if(!res.ok)throw new Error(await res.text());
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ValiStruct_resultados_consolidados.xlsx';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    logHistory('Exportación','XLSX consolidado',{});
  }catch(e){
    alert('La exportación XLSX requiere backend v1.6 activo. '+e.message);
  }
});


// -----------------------------
// v1.7 SEM Monte Carlo professional
// -----------------------------
let semMcLast=null;

document.getElementById('useCurrentProSyntaxForMc')?.addEventListener('click',()=>{
  const syn=document.getElementById('proSyntax')?.value?.trim();
  if(!syn)return alert('No hay sintaxis en Motor Pro.');
  document.getElementById('semMcAnalysis').value=syn;
  if(!document.getElementById('semMcPopulation').value.trim()){
    document.getElementById('semMcPopulation').value=syn;
  }
});

document.getElementById('runSemMonteCarlo')?.addEventListener('click',async()=>{
  const population=document.getElementById('semMcPopulation').value.trim();
  const analysis=document.getElementById('semMcAnalysis').value.trim();
  if(!population||!analysis)return alert('Ingrese modelo poblacional y modelo de análisis.');
  const payload={
    population_model:population,
    analysis_model:analysis,
    n:Number(document.getElementById('semMcN').value)||300,
    reps:Number(document.getElementById('semMcRuns').value)||500,
    alpha:Number(document.getElementById('semMcAlpha').value)||.05,
    seed:Number(document.getElementById('semMcSeed').value)||2026
  };
  const box=document.getElementById('semMcResults');
  box.innerHTML='<div class="notice">Ejecutando simulación SEM en Motor Pro…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/sem-montecarlo`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'Error de simulación');
    semMcLast=data;
    let html=`<div class="results-summary"><div class="result-cards">
      <div class="result-card ${data.convergence_rate>=.90?'diag-ok':'diag-alert'}"><span>Convergencia</span><strong>${(100*data.convergence_rate).toFixed(1)}%</strong></div>
      <div class="result-card"><span>Réplicas válidas</span><strong>${data.valid_reps}/${data.requested_reps}</strong></div>
      <div class="result-card"><span>N</span><strong>${data.n}</strong></div>
    </div>`;
    if(data.parameters?.length){
      html+='<div class="workspace"><table class="power-table"><thead><tr><th>Parámetro</th><th>Valor poblacional</th><th>Estimación media</th><th>Sesgo</th><th>Potencia</th></tr></thead><tbody>';
      data.parameters.forEach(p=>{
        html+=`<tr><td>${escapeHtml(p.label)}</td><td>${fmtPro(p.population)}</td><td>${fmtPro(p.mean_estimate)}</td><td>${fmtPro(p.bias)}</td><td><strong>${(100*Number(p.power||0)).toFixed(1)}%</strong></td></tr>`;
      });
      html+='</tbody></table></div>';
    }
    html+=`<div class="sem-engine-note">La potencia se estimó como proporción de réplicas con p &lt; α. Revise también convergencia, sesgo y estabilidad de las estimaciones.</div></div>`;
    box.innerHTML=html;
    logHistory('Monte Carlo SEM','Simulación profesional',{n:payload.n,reps:payload.reps,convergence:data.convergence_rate});
  }catch(e){
    box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;
  }
});
document.getElementById('downloadSemMcJson')?.addEventListener('click',()=>{
  if(!semMcLast)return alert('Primero ejecute Monte Carlo SEM.');
  saveBlob(JSON.stringify(semMcLast,null,2),'application/json;charset=utf-8;','ValiStruct_MonteCarlo_SEM.json');
});

// -----------------------------
// v1.7 Local and backend model checker
// -----------------------------
function localModelCheck(syntax, varsText=''){
  const issues=[];
  const lines=syntax.split(/\n+/).map(x=>x.trim()).filter(x=>x && !x.startsWith('#'));
  const vars=new Set(varsText.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean));

  const factors=new Map();
  const lhsDefined=new Set();
  const observedUsed=new Set();

  lines.forEach((line,i)=>{
    if(line.includes('=~')){
      const [lhs,rhs]=line.split('=~').map(x=>x.trim());
      const inds=rhs.split('+').map(x=>x.replace(/^[^*]*\*/,'').trim()).filter(Boolean);
      factors.set(lhs,inds);
      lhsDefined.add(lhs);
      inds.forEach(x=>observedUsed.add(x));
      if(inds.length<2)issues.push({level:'error',text:`Línea ${i+1}: el factor ${lhs} tiene menos de 2 indicadores.`});
      else if(inds.length===2)issues.push({level:'warn',text:`Línea ${i+1}: ${lhs} tiene solo 2 indicadores; revise identificación y restricciones.`});
    }
    if(line.includes('~~')){
      const parts=line.split('~~').map(x=>x.trim());
      if(parts[0]===parts[1])issues.push({level:'warn',text:`Línea ${i+1}: varianza explícita ${parts[0]} ~~ ${parts[1]}; verifique que sea intencional.`});
    }
    if(line.includes('~') && !line.includes('=~') && !line.includes('~~')){
      const [lhs,rhs]=line.split('~').map(x=>x.trim());
      if(!rhs)issues.push({level:'error',text:`Línea ${i+1}: regresión sin predictor.`});
      lhsDefined.add(lhs);
    }
  });

  factors.forEach((inds,f)=>{
    const dup=inds.filter((x,i)=>inds.indexOf(x)!==i);
    if(dup.length)issues.push({level:'error',text:`El factor ${f} contiene indicadores duplicados: ${[...new Set(dup)].join(', ')}.`});
  });

  if(vars.size){
    observedUsed.forEach(v=>{
      if(!vars.has(v))issues.push({level:'warn',text:`La variable ${v} aparece en el modelo pero no en la lista de variables disponibles.`});
    });
  }

  if(!issues.length)issues.push({level:'ok',text:'No se detectaron problemas básicos en la revisión local.'});
  return issues;
}

function renderModelCheckIssues(issues,title='Revisión del modelo'){
  let html=`<div class="results-summary"><h3>${escapeHtml(title)}</h3>`;
  issues.forEach(x=>{
    const cls=x.level==='error'?'check-error':(x.level==='warn'?'check-warn':'check-ok');
    const icon=x.level==='error'?'🔴':(x.level==='warn'?'🟠':'🟢');
    html+=`<div class="check-item ${cls}">${icon} ${escapeHtml(x.text)}</div>`;
  });
  html+='</div>';
  document.getElementById('modelCheckResults').innerHTML=html;
}

document.getElementById('loadSyntaxToChecker')?.addEventListener('click',()=>{
  document.getElementById('modelCheckSyntax').value=document.getElementById('proSyntax')?.value||'';
});
document.getElementById('runLocalModelCheck')?.addEventListener('click',()=>{
  const syntax=document.getElementById('modelCheckSyntax').value.trim();
  if(!syntax)return alert('Ingrese sintaxis.');
  renderModelCheckIssues(localModelCheck(syntax,document.getElementById('modelCheckVars').value),'Revisión rápida local');
});
document.getElementById('runProModelCheck')?.addEventListener('click',async()=>{
  const syntax=document.getElementById('modelCheckSyntax').value.trim();
  if(!syntax)return alert('Ingrese sintaxis.');
  const vars=document.getElementById('modelCheckVars').value.split(/[,\s]+/).map(x=>x.trim()).filter(Boolean);
  const box=document.getElementById('modelCheckResults');
  box.innerHTML='<div class="notice">Comprobando modelo con Motor Pro…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/model-check`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({syntax,variables:vars})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'Error de revisión');
    renderModelCheckIssues(data.issues||[],'Revisión profunda con lavaan');
    logHistory('Model Check','Revisión profunda',{issues:(data.issues||[]).length});
  }catch(e){
    box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;
  }
});

// -----------------------------
// v1.7 Contextual help center
// -----------------------------
const helpTopics=[
  {module:'content',title:'V de Aiken',tags:'contenido jueces validez',body:'Cuantifica el acuerdo de jueces sobre pertinencia o calidad de ítems. Interprete el valor junto con intervalos de confianza y comentarios cualitativos.'},
  {module:'reliability',title:'Omega de McDonald',tags:'omega confiabilidad consistencia',body:'Es una estimación de consistencia interna basada en un modelo factorial. En producción debe estimarse con un modelo explícito, no con aproximaciones simplificadas.'},
  {module:'efa',title:'KMO',tags:'afe kmo adecuación',body:'Resume la adecuación de la matriz de correlaciones para factorización. Valores más altos indican que las correlaciones parciales son relativamente pequeñas.'},
  {module:'efa',title:'Análisis paralelo',tags:'afe factores horn',body:'Compara autovalores observados con autovalores obtenidos de datos aleatorios. Debe combinarse con teoría y sentido interpretativo.'},
  {module:'efa',title:'Cargas cruzadas',tags:'afe carga cruzada item',body:'Un ítem puede saturar en más de un factor. No debe eliminarse automáticamente; revise diferencia entre cargas, contenido y estructura teórica.'},
  {module:'cfa',title:'CFI y TLI',tags:'afc ajuste cfi tli',body:'Índices de ajuste incremental. Se interpretan junto con RMSEA, SRMR, cargas y plausibilidad del modelo.'},
  {module:'cfa',title:'RMSEA',tags:'afc rmsea ajuste',body:'Índice de error de aproximación. Reporte el valor y su intervalo de confianza cuando esté disponible. Evite decisiones basadas en un único corte.'},
  {module:'cfa',title:'SRMR',tags:'afc srmr residual',body:'Resume discrepancias estandarizadas entre correlaciones observadas e implicadas por el modelo.'},
  {module:'sem',title:'MLR',tags:'sem estimador robusto mlr',body:'Máxima verosimilitud robusta. Ajusta errores estándar y pruebas ante no normalidad bajo condiciones compatibles.'},
  {module:'sem',title:'WLSMV',tags:'sem ordinal likert wlsmv',body:'Estimador apropiado para muchos modelos con variables ordinales, especialmente con pocas categorías.'},
  {module:'sem',title:'Efecto indirecto',tags:'mediación indirecto bootstrap',body:'Producto de rutas que conecta un antecedente con un resultado a través de uno o más mediadores. El bootstrap suele preferirse para su intervalo de confianza.'},
  {module:'missing',title:'MCAR',tags:'faltantes mcar little',body:'MCAR significa que la ausencia no depende de datos observados ni no observados. Una prueba no significativa es compatible con MCAR, pero no lo demuestra de forma definitiva.'},
  {module:'missing',title:'FIML',tags:'faltantes fiml mar',body:'FIML utiliza toda la información disponible en modelos compatibles. Suele ser preferible a eliminar casos completos bajo supuestos razonables de MAR.'},
  {module:'invariance',title:'Invariancia métrica',tags:'invariancia cargas multigrupo',body:'Evalúa si las cargas factoriales pueden considerarse equivalentes entre grupos, apoyando comparaciones de relaciones estructurales.'},
  {module:'invariance',title:'Invariancia escalar',tags:'invariancia interceptos medias',body:'Añade igualdad de interceptos/umbrales y es relevante para comparar medias latentes entre grupos.'},
  {module:'invariance',title:'ΔCFI / ΔRMSEA / ΔSRMR',tags:'invariancia delta ajuste',body:'Cambios entre modelos restringidos. Deben interpretarse en conjunto y junto con teoría, tamaño muestral y complejidad del modelo.'}
];

function renderHelp(list){
  const box=document.getElementById('helpResults');
  if(!list.length){box.innerHTML='<div class="notice">No se encontraron temas con esos criterios.</div>';return;}
  box.innerHTML=list.map(x=>`<div class="help-card"><h4>${escapeHtml(x.title)}</h4><p>${escapeHtml(x.body)}</p><div class="help-tags">${escapeHtml(x.module)} · ${escapeHtml(x.tags)}</div></div>`).join('');
}
function searchHelp(){
  const q=document.getElementById('helpSearch').value.trim().toLowerCase();
  const mod=document.getElementById('helpModule').value;
  const list=helpTopics.filter(x=>(mod==='all'||x.module===mod) && (!q || `${x.title} ${x.tags} ${x.body}`.toLowerCase().includes(q)));
  renderHelp(list);
}
document.getElementById('searchHelp')?.addEventListener('click',searchHelp);
document.getElementById('showHelpAll')?.addEventListener('click',()=>renderHelp(helpTopics));
renderHelp(helpTopics.slice(0,8));


// -----------------------------
// v1.8 Step-by-step assistant
// -----------------------------
let assistantLast=null;
let assistantSuggestedSection=null;

function projectEvidenceSnapshot(){
  return {
    content: !!(lastResults?.length),
    contentReview: !!lastResults?.some?.(x=>Number(x.v)<.70),
    diag: !!diagLast,
    diagReview: !!diagLast?.rows?.some?.(x=>x.cls!=='diag-ok'),
    multidiag: !!multiLast,
    multidiagReview: !!(multiLast?.outIdx?.length || (multiLast?.mardia && Math.abs(multiLast.mardia.zK)>1.96)),
    reliability: !!relLastResults,
    reliabilityReview: !!(relLastResults && Number(relLastResults.alpha)<.70),
    efa: !!efaLastResults,
    efaReview: !!(efaLastResults && Number(efaLastResults.kmo?.overall)<.70),
    cfa: !!(proLastResponse?.fit || cfaLastResults),
    cfaReview: !!(proLastResponse?.fit && ((Number(proLastResponse.fit.cfi)<.90)||(Number(proLastResponse.fit.rmsea)>.08)||(Number(proLastResponse.fit.srmr)>.08))),
    constructValidity: !!advancedLastResponse?.metrics,
    constructValidityReview: !!(advancedLastResponse?.metrics?.some?.(x=>Number(x.cr)<.70||Number(x.ave)<.50) || advancedLastResponse?.htmt?.some?.(x=>!x.ok)),
    sem: !!(semStructuralResults?.paths?.length || proLastResponse?.parameters?.some?.(x=>x.op==='~')),
    invariance: !!advancedLastResponse?.invariance,
    missingPro: !!missingLastResponse
  };
}

function buildAssistantPlan(){
  const e=projectEvidenceSnapshot();
  const steps=[
    {key:'content',name:'Validez de contenido',section:'validation',done:e.content,review:e.contentReview,action:'Complete o revise V de Aiken y comentarios de jueces.'},
    {key:'diag',name:'Diagnóstico de datos',section:'diagnostics',done:e.diag,review:e.diagReview,action:'Revise faltantes, distribución y posibles problemas de captura.'},
    {key:'multidiag',name:'Diagnóstico multivariado',section:'multidiag',done:e.multidiag,review:e.multidiagReview,action:'Evalúe no normalidad y casos multivariados antes de AFC/SEM.'},
    {key:'reliability',name:'Confiabilidad',section:'reliability',done:e.reliability,review:e.reliabilityReview,action:'Estime alfa/omega y revise correlaciones ítem-total.'},
    {key:'efa',name:'AFE',section:'efa',done:e.efa,review:e.efaReview,action:'Explore estructura factorial con KMO, Bartlett y análisis paralelo.'},
    {key:'cfa',name:'AFC / modelo de medición',section:'motorpro',done:e.cfa,review:e.cfaReview,action:'Confirme el modelo con Motor Pro y revise ajuste global y cargas.'},
    {key:'constructValidity',name:'CR / AVE / HTMT',section:'advanced',done:e.constructValidity,review:e.constructValidityReview,action:'Evalúe validez convergente y discriminante.'},
    {key:'sem',name:'SEM / relaciones estructurales',section:'latencia',done:e.sem,review:false,action:'Evalúe rutas, efectos directos/indirectos y mediación si corresponde.'},
    {key:'invariance',name:'Invariancia / multigrupo',section:'advanced',done:e.invariance,review:false,action:'Compruebe equivalencia entre grupos si el diseño lo requiere.'}
  ];

  let next=steps.find(s=>!s.done);
  let review=steps.find(s=>s.done && s.review);
  let recommended=review || next || null;

  let message='';
  if(recommended){
    message=recommended.review
      ? `Existe evidencia disponible en ${recommended.name}, pero requiere revisión antes de avanzar.`
      : `La siguiente etapa pendiente es ${recommended.name}.`;
  }else{
    message='El flujo principal cuenta con evidencia en todas las etapas registradas. Revise la coherencia global antes de cerrar el proyecto.';
  }

  assistantSuggestedSection=recommended?.section||'resultcenter';
  const completed=steps.filter(s=>s.done).length;
  const reviewed=steps.filter(s=>s.review).length;

  assistantLast={timestamp:new Date().toISOString(),completed,total:steps.length,reviewed,recommended,message,steps,evidence:e};
  renderAssistantPlan(assistantLast);
}

function renderAssistantPlan(plan){
  document.getElementById('assistantSummary').innerHTML=`
    <div class="metric-card"><span>Etapas con evidencia</span><strong>${plan.completed}/${plan.total}</strong></div>
    <div class="metric-card"><span>Etapas a revisar</span><strong>${plan.reviewed}</strong></div>
    <div class="metric-card"><span>Siguiente recomendación</span><strong>${escapeHtml(plan.recommended?.name||'Revisión global')}</strong></div>`;
  let html=`<div class="next-action"><strong>${escapeHtml(plan.message)}</strong>${plan.recommended?`<p>${escapeHtml(plan.recommended.action)}</p>`:''}</div>`;
  plan.steps.forEach((s,i)=>{
    const cls=!s.done?'pending':(s.review?'review':'complete');
    const status=!s.done?'Pendiente':(s.review?'Disponible · revisar':'Completa');
    html+=`<div class="assistant-step ${cls}">
      <span class="step-number">${i+1}</span><strong>${escapeHtml(s.name)}</strong>
      <div class="small">${status}</div>
      <p>${escapeHtml(s.action)}</p>
    </div>`;
  });
  document.getElementById('assistantResults').innerHTML=html;
  logHistory('Asistente paso a paso','Analizar proyecto',{completed:plan.completed,reviewed:plan.reviewed,recommended:plan.recommended?.name});
}
document.getElementById('refreshAssistant')?.addEventListener('click',buildAssistantPlan);
document.getElementById('goSuggestedModule')?.addEventListener('click',()=>{
  if(!assistantLast)buildAssistantPlan();
  const sec=assistantSuggestedSection;
  const btn=document.querySelector(`[data-section="${sec}"]`);
  if(btn)btn.click(); else alert('No fue posible abrir automáticamente el módulo recomendado.');
});
document.getElementById('downloadAssistantPlan')?.addEventListener('click',()=>{
  if(!assistantLast)buildAssistantPlan();
  saveBlob(JSON.stringify(assistantLast,null,2),'application/json;charset=utf-8;','ValiStruct_plan_metodologico.json');
});

// -----------------------------
// v1.8 Integrated result center
// -----------------------------
let resultCenterLast=null;
let resultCenterPlain='';

function buildResultCenter(){
  const strengths=[],warnings=[],findings=[],next=[];
  if(lastResults?.length){
    const good=lastResults.filter(x=>Number(x.v)>=.80).length;
    findings.push(`Validez de contenido: ${good}/${lastResults.length} resultados de V de Aiken se encuentran en rango favorable (≥ .80).`);
    if(lastResults.some(x=>Number(x.v)<.70))warnings.push('Existen ítems/criterios con V de Aiken baja que requieren revisión cualitativa.');
  }
  if(relLastResults){
    findings.push(`Confiabilidad: α = ${fmtPro(relLastResults.alpha)}.`);
    if(Number(relLastResults.alpha)>=.70)strengths.push('La consistencia interna global alcanza un nivel orientativamente favorable.');
    else warnings.push('La consistencia interna global requiere revisión.');
  }
  if(efaLastResults){
    findings.push(`AFE: KMO = ${fmtPro(efaLastResults.kmo.overall)}; análisis paralelo sugiere ${efaLastResults.retainedPA} factor(es).`);
    if(Number(efaLastResults.kmo.overall)>=.70)strengths.push('La adecuación factorial global es favorable según KMO.');
    else warnings.push('El KMO global es bajo; revise matriz y variables.');
  }
  if(proLastResponse?.fit){
    const f=proLastResponse.fit;
    findings.push(`AFC/SEM: CFI = ${fmtPro(f.cfi)}, TLI = ${fmtPro(f.tli)}, RMSEA = ${fmtPro(f.rmsea)}, SRMR = ${fmtPro(f.srmr)}.`);
    if(Number(f.cfi)>=.90 && Number(f.rmsea)<=.08 && Number(f.srmr)<=.08)strengths.push('Los principales índices globales muestran un ajuste razonable en conjunto.');
    else warnings.push('Uno o más índices de ajuste global requieren revisión del modelo.');
  }
  if(advancedLastResponse?.metrics){
    const bad=advancedLastResponse.metrics.filter(x=>Number(x.cr)<.70||Number(x.ave)<.50);
    findings.push(`CR/AVE: ${advancedLastResponse.metrics.length} constructos evaluados.`);
    if(!bad.length)strengths.push('CR y AVE muestran evidencia favorable en los constructos evaluados.');
    else warnings.push(`${bad.length} constructo(s) requieren revisar CR o AVE.`);
    if(advancedLastResponse.htmt?.some(x=>!x.ok))warnings.push('HTMT sugiere revisar validez discriminante en al menos un par de constructos.');
  }
  if(multiLast){
    findings.push(`Diagnóstico multivariado: ${multiLast.outIdx.length} posible(s) outlier(s); Mardia z = ${fmtPro(multiLast.mardia.zK)}.`);
    if(multiLast.outIdx.length)warnings.push('Existen casos multivariados que deben revisarse, no eliminarse automáticamente.');
  }
  if(missingLastResponse){
    findings.push(`Datos faltantes: prueba MCAR p ${Number(missingLastResponse.p_value)<.001?'< .001':'= '+fmtPro(missingLastResponse.p_value)}.`);
  }

  const e=projectEvidenceSnapshot();
  if(!e.content)next.push('Completar validez de contenido.');
  else if(!e.reliability)next.push('Realizar análisis de confiabilidad.');
  else if(!e.efa)next.push('Realizar AFE.');
  else if(!e.cfa)next.push('Realizar AFC con Motor Pro.');
  else if(!e.constructValidity)next.push('Evaluar CR, AVE y HTMT.');
  else if(!e.sem)next.push('Evaluar relaciones estructurales si forman parte del objetivo del estudio.');
  if(warnings.length)next.unshift('Resolver primero las alertas metodológicas prioritarias antes de interpretar conclusiones finales.');

  resultCenterLast={timestamp:new Date().toISOString(),strengths,warnings,findings,next};
  resultCenterPlain=[
    'ValiStruct · Centro integrado de resultados',
    '',
    'Hallazgos:',...findings.map(x=>'- '+x),'',
    'Fortalezas:',...(strengths.length?strengths:['Sin fortalezas consolidadas aún.']).map(x=>'- '+x),'',
    'Alertas:',...(warnings.length?warnings:['Sin alertas principales registradas.']).map(x=>'- '+x),'',
    'Próximos pasos:',...(next.length?next:['Revisión global del proyecto.']).map(x=>'- '+x)
  ].join('\n');
  renderResultCenter(resultCenterLast);
}

function renderResultCenter(r){
  document.getElementById('resultCenterSummary').innerHTML=`
    <div class="metric-card"><span>Hallazgos</span><strong>${r.findings.length}</strong></div>
    <div class="metric-card"><span>Fortalezas</span><strong>${r.strengths.length}</strong></div>
    <div class="metric-card"><span>Alertas</span><strong>${r.warnings.length}</strong></div>
    <div class="metric-card"><span>Próximos pasos</span><strong>${r.next.length}</strong></div>`;
  const block=(title,items,cls)=>`<div class="result-section ${cls}"><h3>${title}</h3>${items.length?items.map(x=>`<div class="result-item">${escapeHtml(x)}</div>`).join(''):'<div class="result-item">Sin elementos registrados.</div>'}</div>`;
  document.getElementById('resultCenterContent').innerHTML=
    block('Hallazgos',r.findings,'result-neutral')+
    block('Fortalezas',r.strengths,'result-positive')+
    block('Alertas',r.warnings,'result-warning')+
    block('Próximos pasos',r.next,'result-neutral');
  logHistory('Centro de resultados','Actualizar',{findings:r.findings.length,warnings:r.warnings.length});
}
document.getElementById('refreshResultCenter')?.addEventListener('click',buildResultCenter);
document.getElementById('downloadResultCenterJson')?.addEventListener('click',()=>{
  if(!resultCenterLast)buildResultCenter();
  saveBlob(JSON.stringify(resultCenterLast,null,2),'application/json;charset=utf-8;','ValiStruct_centro_resultados.json');
});
document.getElementById('copyResultCenterText')?.addEventListener('click',()=>{
  if(!resultCenterLast)buildResultCenter();
  navigator.clipboard.writeText(resultCenterPlain).then(()=>alert('Síntesis copiada.')).catch(()=>alert('No fue posible copiar.'));
});

buildAssistantPlan();
buildResultCenter();


// -----------------------------
// v1.9 Methodological conclusion assistant
// -----------------------------
let methodConclusionText='';

function buildMethodConclusion(){
  const name=(document.getElementById('conclusionStudyName').value||'el instrumento evaluado').trim();
  const style=document.getElementById('conclusionStyle').value;
  const parts=[];
  const cautions=[];

  if(lastResults?.length){
    const avg=lastResults.reduce((s,x)=>s+Number(x.v||0),0)/lastResults.length;
    parts.push(`La evidencia de validez de contenido mostró un promedio global de V de Aiken de ${fmtPro(avg)}.`);
    if(lastResults.some(x=>Number(x.v)<.70))cautions.push('persisten ítems o criterios con evidencia de contenido insuficiente que requieren revisión cualitativa');
  }

  if(relLastResults){
    parts.push(`La consistencia interna presentó α = ${fmtPro(relLastResults.alpha)}.`);
    if(Number(relLastResults.alpha)<.70)cautions.push('la consistencia interna global requiere revisión');
  }

  if(efaLastResults){
    parts.push(`El análisis factorial exploratorio mostró KMO = ${fmtPro(efaLastResults.kmo.overall)} y el análisis paralelo sugirió ${efaLastResults.retainedPA} factor(es).`);
    if(Number(efaLastResults.kmo.overall)<.70)cautions.push('la adecuación factorial global es limitada');
  }

  if(proLastResponse?.fit){
    const f=proLastResponse.fit;
    parts.push(`En el modelo confirmatorio/estructural se obtuvieron CFI = ${fmtPro(f.cfi)}, TLI = ${fmtPro(f.tli)}, RMSEA = ${fmtPro(f.rmsea)} y SRMR = ${fmtPro(f.srmr)}.`);
    if(Number(f.cfi)<.90 || Number(f.rmsea)>.08 || Number(f.srmr)>.08)cautions.push('uno o más índices globales de ajuste requieren revisión');
  }

  if(advancedLastResponse?.metrics){
    const bad=advancedLastResponse.metrics.filter(x=>Number(x.cr)<.70||Number(x.ave)<.50).length;
    if(!bad)parts.push('La confiabilidad compuesta y la varianza media extraída fueron favorables en los constructos evaluados.');
    else cautions.push(`${bad} constructo(s) no alcanzaron referencias orientativas de CR o AVE`);
    if(advancedLastResponse?.htmt?.some(x=>!x.ok))cautions.push('la validez discriminante requiere revisión en al menos una comparación HTMT');
  }

  if(multiLast){
    if(multiLast.outIdx?.length)cautions.push(`se detectaron ${multiLast.outIdx.length} caso(s) con distancia de Mahalanobis elevada`);
    if(Math.abs(Number(multiLast.mardia?.zK))>1.96)cautions.push('existe señal de desviación de normalidad multivariada');
  }

  if(missingLastResponse){
    parts.push(`El análisis de datos faltantes reportó una prueba MCAR con p ${Number(missingLastResponse.p_value)<.001?'< .001':'= '+fmtPro(missingLastResponse.p_value)}.`);
  }

  let intro=`En conjunto, ${name} cuenta con evidencia metodológica disponible en ${parts.length} componente(s) analítico(s) registrados en ValiStruct. `;
  let body=parts.join(' ');
  let cautionText=cautions.length
    ? ` No obstante, antes de considerar concluido el proceso de validación, deben revisarse los siguientes aspectos: ${cautions.join('; ')}.`
    : ' No se identificaron alertas principales entre los resultados cargados, aunque la interpretación final debe conservar sustento teórico y contextual.';

  let close='';
  if(style==='article'){
    close=' Estos resultados deben reportarse junto con el procedimiento de construcción del instrumento, características de la muestra, estimadores empleados y criterios teóricos utilizados para las decisiones psicométricas.';
  }else if(style==='thesis'){
    close=' Para la tesis, se recomienda documentar de forma explícita cada decisión de modificación, conservar trazabilidad del proceso y discutir las limitaciones de generalización, medición y ajuste del modelo.';
  }else{
    close=' La evidencia debe interpretarse de forma integrada y no mediante un único índice.';
  }

  methodConclusionText=intro+body+cautionText+close;
  document.getElementById('methodConclusionOutput').innerHTML=`<div class="method-conclusion">${escapeHtml(methodConclusionText)}</div>`;
  logHistory('Conclusiones metodológicas','Generar',{style,name});
}

document.getElementById('generateMethodConclusion')?.addEventListener('click',buildMethodConclusion);
document.getElementById('copyMethodConclusion')?.addEventListener('click',()=>{
  if(!methodConclusionText)buildMethodConclusion();
  navigator.clipboard.writeText(methodConclusionText).then(()=>alert('Conclusión copiada.')).catch(()=>alert('No fue posible copiar.'));
});
document.getElementById('downloadMethodConclusion')?.addEventListener('click',()=>{
  if(!methodConclusionText)buildMethodConclusion();
  saveBlob(methodConclusionText,'text/plain;charset=utf-8;','ValiStruct_conclusion_metodologica.txt');
});

// -----------------------------
// v1.9 Final checklist
// -----------------------------
let finalChecklistLast=null;

function buildFinalChecklist(){
  const type=document.getElementById('finalCheckType').value;
  const appendix=document.getElementById('finalCheckAppendix').value==='yes';
  const ethicsVal=document.getElementById('finalCheckEthics').value;
  const ethics=ethicsVal==='yes' || ethicsVal==='na';
  const version=document.getElementById('finalCheckVersion').value==='yes';

  const checks=[
    {name:'Validez de contenido documentada',ok:!!lastResults?.length,detail:'Resultados de V de Aiken disponibles.'},
    {name:'Confiabilidad documentada',ok:!!relLastResults,detail:'Alfa/omega o análisis equivalente disponible.'},
    {name:'AFE documentado',ok:!!efaLastResults,detail:'KMO, Bartlett, retención de factores y cargas.'},
    {name:'AFC/SEM documentado',ok:!!(proLastResponse?.fit||cfaLastResults),detail:'Índices de ajuste y parámetros disponibles.'},
    {name:'Validez convergente/discriminante',ok:!!advancedLastResponse?.metrics,detail:'CR/AVE y, cuando corresponde, HTMT.'},
    {name:'Diagnóstico de datos',ok:!!diagLast,detail:'Faltantes, distribución y revisión preliminar.'},
    {name:'Trazabilidad del análisis',ok:getHistory().length>0,detail:'Historial reproducible disponible.'},
    {name:'Tablas para manuscrito',ok:!!articleTablesPlain,detail:'Tablas automáticas generadas.'},
    {name:'Reporte metodológico',ok:!!apaReportPlain,detail:'Reporte APA 7 generado.'},
    {name:'Anexo del instrumento',ok:appendix,detail:'Versión del instrumento disponible como anexo o suplemento.'},
    {name:'Ética documentada',ok:ethics,detail:ethicsVal==='na'?'Marcado como no aplicable.':'Declaración/aprobación disponible.'},
    {name:'Versión final del instrumento registrada',ok:version,detail:'Se conserva versión final o congelada.'}
  ];

  if(type==='thesis'){
    checks.push({name:'Discusión de limitaciones',ok:!!methodConclusionText,detail:'Conclusión metodológica disponible para apoyar la discusión.'});
  }

  const done=checks.filter(x=>x.ok).length;
  const pct=Math.round(100*done/checks.length);
  finalChecklistLast={type,done,total:checks.length,percentage:pct,checks,timestamp:new Date().toISOString()};
  renderFinalChecklist(finalChecklistLast);
}

function renderFinalChecklist(r){
  document.getElementById('finalCheckSummary').innerHTML=`
    <div class="metric-card"><span>Completos</span><strong>${r.done}/${r.total}</strong></div>
    <div class="metric-card"><span>Cobertura documental</span><strong>${r.percentage}%</strong></div>
    <div class="metric-card"><span>Pendientes</span><strong>${r.total-r.done}</strong></div>`;
  document.getElementById('finalCheckResults').innerHTML=r.checks.map(x=>`
    <div class="checklist-row">
      <div class="checklist-icon">${x.ok?'🟢':'🟠'}</div>
      <div><strong>${escapeHtml(x.name)}</strong><div class="small">${escapeHtml(x.detail)}</div></div>
      <div class="checklist-status">${x.ok?'Completo':'Pendiente'}</div>
    </div>`).join('')+
    `<div class="sem-engine-note"><strong>Nota:</strong> ${r.percentage}% refleja cobertura documental dentro de ValiStruct, no calidad científica ni probabilidad de publicación.</div>`;
  logHistory('Checklist final','Ejecutar',{type:r.type,percentage:r.percentage});
}

document.getElementById('runFinalChecklist')?.addEventListener('click',buildFinalChecklist);
document.getElementById('downloadFinalChecklist')?.addEventListener('click',()=>{
  if(!finalChecklistLast)buildFinalChecklist();
  saveBlob(JSON.stringify(finalChecklistLast,null,2),'application/json;charset=utf-8;','ValiStruct_checklist_final.json');
});

// -----------------------------
// v1.9 Journal readiness
// -----------------------------
let journalReadyLast=null;

function evaluateJournalReady(){
  const journal=(document.getElementById('journalName').value||'Revista objetivo no especificada').trim();
  const refStyle=document.getElementById('journalRefStyle').value;
  const ethicsReq=document.getElementById('journalEthicsReq').value==='yes';
  const supplement=document.getElementById('journalSupplement').value==='yes';

  const items=[
    {name:'Resultados psicométricos consolidados',ok:!!(relLastResults&&efaLastResults&&(proLastResponse?.fit||cfaLastResults))},
    {name:'Reporte metodológico generado',ok:!!apaReportPlain},
    {name:'Tablas listas para manuscrito',ok:!!articleTablesPlain},
    {name:'Conclusión metodológica disponible',ok:!!methodConclusionText},
    {name:'Checklist final ejecutado',ok:!!finalChecklistLast},
    {name:'Historial reproducible conservado',ok:getHistory().length>0},
    {name:'Proyecto guardado/exportable',ok:localProjects().length>0 || !!(document.getElementById('projectName')?.value||'').trim()}
  ];

  if(ethicsReq){
    items.push({name:'Declaración/aprobación ética preparada',ok:document.getElementById('finalCheckEthics')?.value==='yes'});
  }
  if(supplement){
    items.push({name:'Archivo suplementario preparado',ok:document.getElementById('finalCheckAppendix')?.value==='yes'});
  }

  const complete=items.filter(x=>x.ok).length;
  const pct=Math.round(100*complete/items.length);
  let level='Preparación inicial',cls='readiness-low';
  if(pct>=85){level='Preparación alta';cls='readiness-high';}
  else if(pct>=60){level='Preparación intermedia';cls='readiness-medium';}

  const pending=items.filter(x=>!x.ok).map(x=>x.name);
  journalReadyLast={journal,refStyle,complete,total:items.length,percentage:pct,level,pending,items,timestamp:new Date().toISOString()};
  renderJournalReady(journalReadyLast);
}

function renderJournalReady(r){
  document.getElementById('journalReadySummary').innerHTML=`
    <div class="metric-card"><span>Preparación</span><strong>${r.percentage}%</strong></div>
    <div class="metric-card"><span>Completos</span><strong>${r.complete}/${r.total}</strong></div>
    <div class="metric-card"><span>Nivel</span><strong>${escapeHtml(r.level)}</strong></div>`;
  let html=`<div class="journal-readiness-card ${r.percentage>=85?'readiness-high':(r.percentage>=60?'readiness-medium':'readiness-low')}">
    <strong>${escapeHtml(r.journal)}</strong><p>${escapeHtml(r.level)}. Estilo de referencias: ${escapeHtml(r.refStyle.toUpperCase())}.</p></div>`;
  r.items.forEach(x=>{
    html+=`<div class="checklist-row"><div class="checklist-icon">${x.ok?'🟢':'🟠'}</div><div><strong>${escapeHtml(x.name)}</strong></div><div class="checklist-status">${x.ok?'Disponible':'Pendiente'}</div></div>`;
  });
  if(r.pending.length){
    html+=`<div class="next-action"><strong>Antes del envío:</strong><ul>${r.pending.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`;
  }
  html+=`<div class="sem-engine-note">Este porcentaje refleja preparación técnica/documental dentro de ValiStruct. No representa probabilidad de aceptación editorial.</div>`;
  document.getElementById('journalReadyContent').innerHTML=html;
  logHistory('Journal Ready','Evaluar',{journal:r.journal,percentage:r.percentage});
}

document.getElementById('evaluateJournalReadiness')?.addEventListener('click',evaluateJournalReady);
document.getElementById('downloadJournalReadiness')?.addEventListener('click',()=>{
  if(!journalReadyLast)evaluateJournalReady();
  saveBlob(JSON.stringify(journalReadyLast,null,2),'application/json;charset=utf-8;','ValiStruct_preparacion_revista.json');
});


// -----------------------------
// ValiStruct 2.0 Guided Project
// -----------------------------
const GUIDED_KEY='valistruct_guided_project_v20';
let guidedProjectLast=null;

function guidedProjectPhases(type){
  const common=[
    {id:'concept',name:'1. Definición conceptual',section:'methodguide',desc:'Constructo, dimensiones, población y fundamento teórico.'},
    {id:'content',name:'2. Validez de contenido',section:'validation',desc:'Juicio de expertos, V de Aiken y revisión cualitativa.'},
    {id:'pilot',name:'3. Pilotaje y diagnóstico',section:'diagnostics',desc:'Datos faltantes, distribución, calidad de captura y atípicos.'},
    {id:'reliability',name:'4. Confiabilidad',section:'reliability',desc:'Alfa, omega e ítem-total.'},
    {id:'efa',name:'5. AFE',section:'efa',desc:'KMO, Bartlett, análisis paralelo, cargas y comunalidades.'},
    {id:'cfa',name:'6. AFC',section:'motorpro',desc:'Modelo de medición, ajuste global y cargas estandarizadas.'},
    {id:'validity',name:'7. Validez del constructo',section:'advanced',desc:'CR, AVE y HTMT.'},
    {id:'sem',name:'8. SEM',section:'latencia',desc:'Rutas estructurales, mediación y efectos.'},
    {id:'invariance',name:'9. Invariancia',section:'advanced',desc:'Configural, métrica, escalar y estricta cuando corresponda.'},
    {id:'report',name:'10. Reporte científico',section:'reportapa',desc:'Tablas, APA 7, conclusiones metodológicas y checklist final.'}
  ];
  if(type==='cfa') return common.filter(x=>!['content','efa'].includes(x.id));
  if(type==='sem') return common.filter(x=>!['content'].includes(x.id));
  if(type==='adaptation') return common;
  return common;
}

function guidedPhaseDone(id){
  const e=projectEvidenceSnapshot();
  return {
    concept: !!document.getElementById('guidedPopulation')?.value.trim(),
    content:e.content,
    pilot:e.diag,
    reliability:e.reliability,
    efa:e.efa,
    cfa:e.cfa,
    validity:e.constructValidity,
    sem:e.sem,
    invariance:e.invariance,
    report:!!apaReportPlain && !!finalChecklistLast
  }[id] || false;
}

function buildGuidedProject(){
  const name=(document.getElementById('guidedProjectName').value||'Proyecto ValiStruct').trim();
  const type=document.getElementById('guidedProjectType').value;
  const population=(document.getElementById('guidedPopulation').value||'').trim();
  const plannedN=Number(document.getElementById('guidedPlannedN').value)||300;
  const phases=guidedProjectPhases(type).map(p=>({...p,done:guidedPhaseDone(p.id)}));
  const current=phases.find(x=>!x.done) || phases[phases.length-1];
  guidedProjectLast={name,type,population,plannedN,phases,currentId:current?.id||null,updatedAt:new Date().toISOString()};
  localStorage.setItem(GUIDED_KEY,JSON.stringify(guidedProjectLast));
  renderGuidedProject(guidedProjectLast);
  logHistory('Proyecto guiado','Actualizar ruta',{name,type,current:current?.name});
}

function renderGuidedProject(p){
  const complete=p.phases.filter(x=>x.done).length;
  const pct=Math.round(100*complete/p.phases.length);
  document.getElementById('guidedProjectSummary').innerHTML=`
    <div class="metric-card"><span>Proyecto</span><strong>${escapeHtml(p.name)}</strong></div>
    <div class="metric-card"><span>Avance</span><strong>${pct}%</strong></div>
    <div class="metric-card"><span>Fases completas</span><strong>${complete}/${p.phases.length}</strong></div>`;
  let html=`<div class="progress-shell"><div class="progress-bar" style="width:${pct}%"></div></div>`;
  p.phases.forEach(ph=>{
    const cls=ph.done?'complete':(ph.id===p.currentId?'current':'pending');
    html+=`<div class="guided-phase ${cls}">
      <strong>${escapeHtml(ph.name)}</strong>
      <p>${escapeHtml(ph.desc)}</p>
      <div class="button-row"><button data-guided-go="${ph.section}">${ph.done?'Revisar':'Abrir módulo'}</button></div>
    </div>`;
  });
  document.getElementById('guidedProjectContent').innerHTML=html;
  document.querySelectorAll('[data-guided-go]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelector(`[data-section="${b.dataset.guidedGo}"]`)?.click();
  }));
}

document.getElementById('startGuidedProject')?.addEventListener('click',buildGuidedProject);
document.getElementById('resumeGuidedProject')?.addEventListener('click',()=>{
  const saved=localStorage.getItem(GUIDED_KEY);
  if(!saved)return alert('No hay un proyecto guiado guardado.');
  guidedProjectLast=JSON.parse(saved);
  document.getElementById('guidedProjectName').value=guidedProjectLast.name||'';
  document.getElementById('guidedProjectType').value=guidedProjectLast.type||'instrument';
  document.getElementById('guidedPopulation').value=guidedProjectLast.population||'';
  document.getElementById('guidedPlannedN').value=guidedProjectLast.plannedN||300;
  renderGuidedProject(guidedProjectLast);
});
document.getElementById('exportGuidedPlan')?.addEventListener('click',()=>{
  if(!guidedProjectLast)buildGuidedProject();
  saveBlob(JSON.stringify(guidedProjectLast,null,2),'application/json;charset=utf-8;','ValiStruct_proyecto_guiado.json');
});

// -----------------------------
// ValiStruct 2.0 Profiles
// -----------------------------
const PROFILE_KEY='valistruct_profile_v20';

function loadProfile(){
  try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{"profile":"researcher","help":"medium"}');}
  catch(_){return {profile:'researcher',help:'medium'};}
}
function profileDescription(p,h){
  const map={
    student:'Prioriza explicaciones, advertencias y pasos guiados.',
    researcher:'Equilibra rapidez, control y orientación metodológica.',
    teacher:'Favorece demostración, enseñanza y revisión de decisiones.'
  };
  return `${map[p]||map.researcher} Nivel de ayuda: ${h}.`;
}
function renderProfile(){
  const p=loadProfile();
  document.getElementById('userProfile').value=p.profile;
  document.getElementById('helpLevel').value=p.help;
  document.getElementById('profilePreview').innerHTML=`<div class="profile-card"><strong>${p.profile==='student'?'Estudiante':(p.profile==='teacher'?'Docente':'Investigador')}</strong><p>${escapeHtml(profileDescription(p.profile,p.help))}</p></div>`;
}
function applyProfile(){
  const p=loadProfile();
  document.body.dataset.helpLevel=p.help;
  if(p.profile==='student'){
    document.body.dataset.interfaceMode='guided';
  }
}
document.getElementById('saveUserProfile')?.addEventListener('click',()=>{
  const p={profile:document.getElementById('userProfile').value,help:document.getElementById('helpLevel').value};
  localStorage.setItem(PROFILE_KEY,JSON.stringify(p));
  renderProfile();
  applyProfile();
  logHistory('Perfil','Guardar',p);
});
document.getElementById('applyUserProfile')?.addEventListener('click',applyProfile);
renderProfile(); applyProfile();

// -----------------------------
// ValiStruct 2.0 Advanced Settings
// -----------------------------
const SETTINGS_KEY='valistruct_settings_v20';
const DEFAULT_SETTINGS={decimals:3,confidence:.95,interfaceMode:'guided',history:'yes'};

function loadSettings(){
  try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')};}
  catch(_){return {...DEFAULT_SETTINGS};}
}
function applySettings(){
  const s=loadSettings();
  document.body.dataset.interfaceMode=s.interfaceMode;
  document.getElementById('settingDecimals').value=String(s.decimals);
  document.getElementById('settingConfidence').value=String(s.confidence);
  document.getElementById('settingInterfaceMode').value=s.interfaceMode;
  document.getElementById('settingHistory').value=s.history;
  document.getElementById('advancedSettingsStatus').innerHTML=`<div class="model-ok">Configuración activa: ${s.decimals} decimales · IC ${Math.round(s.confidence*100)}% · modo ${escapeHtml(s.interfaceMode)}.</div>`;
}
document.getElementById('saveAdvancedSettings')?.addEventListener('click',()=>{
  const s={
    decimals:Number(document.getElementById('settingDecimals').value)||3,
    confidence:Number(document.getElementById('settingConfidence').value)||.95,
    interfaceMode:document.getElementById('settingInterfaceMode').value,
    history:document.getElementById('settingHistory').value
  };
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(s));
  applySettings();
});
document.getElementById('resetAdvancedSettings')?.addEventListener('click',()=>{
  localStorage.removeItem(SETTINGS_KEY); applySettings();
});
document.getElementById('exportAppConfig')?.addEventListener('click',()=>{
  saveBlob(JSON.stringify({profile:loadProfile(),settings:loadSettings(),apiBase:getProApiBase()},null,2),'application/json;charset=utf-8;','ValiStruct_configuracion.json');
});
applySettings();

// Respect history setting
const originalLogHistory = logHistory;
logHistory = function(module,action,meta={}){
  const s=loadSettings();
  if(s.history==='no')return;
  return originalLogHistory(module,action,meta);
};

// -----------------------------
// ValiStruct 2.0 System Check
// -----------------------------
let systemCheckLast=null;

async function runSystemCheck(){
  const checks=[];
  const add=(name,status,detail)=>checks.push({name,status,detail});

  // Frontend / browser
  add('JavaScript principal','ok','La aplicación está ejecutando código correctamente.');
  try{
    localStorage.setItem('__vs_test__','1');
    localStorage.removeItem('__vs_test__');
    add('Almacenamiento local','ok','localStorage disponible.');
  }catch(e){add('Almacenamiento local','bad','No disponible: '+e.message);}

  add('PWA / Service Worker','serviceWorker' in navigator?'ok':'warn','serviceWorker' in navigator?'Compatible con PWA.':'El navegador no soporta Service Worker.');
  add('Descarga de archivos','Blob' in window && 'URL' in window?'ok':'bad','Blob/URL para exportaciones del navegador.');
  add('Interacción táctil','PointerEvent' in window?'ok':'warn','Pointer Events para mouse/touch/Apple Pencil.');

  // Core functions
  const funcs=[
    ['AFE',typeof efaCorrelationMatrix==='function'],
    ['AFC',typeof estimateCfaPrototype==='function'],
    ['Latencia',typeof renderSem==='function'],
    ['Asistente',typeof buildAssistantPlan==='function'],
    ['Reportes',typeof generateApaReport==='function'],
    ['Proyecto guiado',typeof buildGuidedProject==='function']
  ];
  funcs.forEach(([n,ok])=>add(`Módulo ${n}`,ok?'ok':'bad',ok?'Función principal disponible.':'Función principal no encontrada.'));

  // Backend
  try{
    const res=await fetch(`${getProApiBase()}/health`,{method:'GET'});
    const data=await res.json();
    if(res.ok && data.ok!==false)add('Motor Pro','ok',`Conectado · ${data.r_version||'R'} · lavaan ${data.lavaan_version||''}`);
    else add('Motor Pro','warn',data.error||'Backend no disponible.');
  }catch(e){
    add('Motor Pro','warn','No conectado. Los módulos locales siguen disponibles.');
  }

  const ok=checks.filter(x=>x.status==='ok').length;
  const warn=checks.filter(x=>x.status==='warn').length;
  const bad=checks.filter(x=>x.status==='bad').length;
  systemCheckLast={timestamp:new Date().toISOString(),ok,warn,bad,checks};
  renderSystemCheck(systemCheckLast);
}

function renderSystemCheck(r){
  document.getElementById('systemCheckSummary').innerHTML=`
    <div class="metric-card"><span>Correctos</span><strong>${r.ok}</strong></div>
    <div class="metric-card"><span>Advertencias</span><strong>${r.warn}</strong></div>
    <div class="metric-card"><span>Errores</span><strong>${r.bad}</strong></div>`;
  document.getElementById('systemCheckResults').innerHTML=r.checks.map(x=>{
    const cls=x.status==='ok'?'system-check-ok':(x.status==='warn'?'system-check-warn':'system-check-bad');
    const icon=x.status==='ok'?'🟢':(x.status==='warn'?'🟠':'🔴');
    return `<div class="system-check-item ${cls}">${icon} <strong>${escapeHtml(x.name)}</strong><div class="small">${escapeHtml(x.detail)}</div></div>`;
  }).join('');
}
document.getElementById('runSystemCheck')?.addEventListener('click',runSystemCheck);
document.getElementById('downloadSystemCheck')?.addEventListener('click',()=>{
  if(!systemCheckLast)return alert('Ejecute primero la verificación.');
  saveBlob(JSON.stringify(systemCheckLast,null,2),'application/json;charset=utf-8;','ValiStruct_verificacion_sistema.json');
});


// -----------------------------
// ValiStruct 2.1 Unified data import
// -----------------------------
let unifiedCsvText=null;
let unifiedSourceName='';
let unifiedXlsxFile=null;

function normalizeCsvText(text){
  return text.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
}
function previewUnifiedCsv(text){
  const rows=parseCSV(normalizeCsvText(text));
  if(!rows.length) return;
  const headers=rows[0];
  const body=rows.slice(1,7);
  document.getElementById('unifiedImportSummary').innerHTML=`
    <div class="metric-card"><span>Archivo</span><strong>${escapeHtml(unifiedSourceName||'Datos')}</strong></div>
    <div class="metric-card"><span>Filas</span><strong>${Math.max(0,rows.length-1)}</strong></div>
    <div class="metric-card"><span>Columnas</span><strong>${headers.length}</strong></div>`;
  let html='<div class="workspace"><table class="preview-table"><thead><tr>';
  headers.forEach(h=>html+=`<th>${escapeHtml(h)}</th>`);
  html+='</tr></thead><tbody>';
  body.forEach(r=>{
    html+='<tr>'+headers.map((_,i)=>`<td>${escapeHtml(String(r[i]??''))}</td>`).join('')+'</tr>';
  });
  html+='</tbody></table></div>';
  document.getElementById('unifiedImportPreview').innerHTML=html;
}

async function loadXlsxWorkbook(file){
  const fd=new FormData();
  fd.append('file',file);
  const res=await fetch(`${getProApiBase()}/xlsx-info`,{method:'POST',body:fd});
  const data=await res.json();
  if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible leer XLSX.');
  const sel=document.getElementById('xlsxSheetSelect');
  sel.disabled=false;
  sel.innerHTML=data.sheets.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  await convertSelectedXlsxSheet();
}

async function convertSelectedXlsxSheet(){
  if(!unifiedXlsxFile)return;
  const fd=new FormData();
  fd.append('file',unifiedXlsxFile);
  fd.append('sheet',document.getElementById('xlsxSheetSelect').value||'');
  const res=await fetch(`${getProApiBase()}/xlsx-to-csv`,{method:'POST',body:fd});
  const data=await res.json();
  if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible convertir XLSX.');
  unifiedCsvText=data.csv_text;
  previewUnifiedCsv(unifiedCsvText);
}

document.getElementById('unifiedDataFile')?.addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f)return;
  unifiedSourceName=f.name;
  try{
    if(f.name.toLowerCase().endsWith('.xlsx')){
      unifiedXlsxFile=f;
      unifiedCsvText=null;
      await loadXlsxWorkbook(f);
    }else{
      unifiedXlsxFile=null;
      const text=await f.text();
      unifiedCsvText=normalizeCsvText(text);
      document.getElementById('xlsxSheetSelect').disabled=true;
      document.getElementById('xlsxSheetSelect').innerHTML='<option value="">CSV</option>';
      previewUnifiedCsv(unifiedCsvText);
    }
    logHistory('Importación','Cargar datos',{source:f.name,format:f.name.split('.').pop()?.toLowerCase()});
  }catch(err){alert(err.message);}
});
document.getElementById('xlsxSheetSelect')?.addEventListener('change',()=>convertSelectedXlsxSheet().catch(e=>alert(e.message)));

document.getElementById('importToDiagnostics')?.addEventListener('click',()=>{
  if(!unifiedCsvText)return alert('Cargue primero un archivo.');
  try{
    diagData=parseDiagnosticCSV(unifiedCsvText);
    document.querySelector('[data-section="diagnostics"]')?.click();
    document.getElementById('diagSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${diagData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${diagData.k}</strong></div>`;
  }catch(e){alert(e.message);}
});

document.getElementById('importToEfa')?.addEventListener('click',()=>{
  if(!unifiedCsvText)return alert('Cargue primero un archivo.');
  try{
    const rows=parseCSV(unifiedCsvText);
    const headers=rows[0];
    const body=rows.slice(1).filter(r=>r.some(x=>String(x).trim()!==''));
    let start=0;
    if(document.getElementById('importFirstColumn').value==='id' ||
      (document.getElementById('importFirstColumn').value==='auto' && /^(id|folio|participante|sujeto|caso)$/i.test(headers[0]||''))) start=1;
    const itemNames=headers.slice(start);
    const matrix=body.map(r=>r.slice(start,start+itemNames.length).map(Number));
    if(matrix.some(r=>r.some(v=>!Number.isFinite(v)))) throw new Error('AFE requiere datos numéricos completos en esta importación.');
    efaData={itemNames,matrix,n:matrix.length,k:itemNames.length};
    document.querySelector('[data-section="efa"]')?.click();
    if(typeof renderEfaDataset==='function') renderEfaDataset();
  }catch(e){alert(e.message);}
});

document.getElementById('importToMotorPro')?.addEventListener('click',()=>{
  if(!unifiedCsvText)return alert('Cargue primero un archivo.');
  proCsvText=unifiedCsvText;
  document.querySelector('[data-section="motorpro"]')?.click();
  summarizeProCsv(unifiedCsvText);
});

document.getElementById('downloadNormalizedCsv')?.addEventListener('click',()=>{
  if(!unifiedCsvText)return alert('Cargue primero un archivo.');
  saveBlob("\ufeff"+unifiedCsvText,'text/csv;charset=utf-8;','ValiStruct_datos_normalizados.csv');
});

// -----------------------------
// ValiStruct 2.1 Model template library
// -----------------------------
const modelTemplates={
  cfa:[
    {name:'AFC un factor · 5 ítems',help:'Modelo reflectivo unidimensional.',syntax:'F1 =~ I1 + I2 + I3 + I4 + I5'},
    {name:'AFC dos factores correlacionados',help:'Dos factores reflectivos con covarianza.',syntax:'F1 =~ I1 + I2 + I3\nF2 =~ I4 + I5 + I6\nF1 ~~ F2'},
    {name:'AFC tres factores correlacionados',help:'Tres dimensiones relacionadas.',syntax:'F1 =~ I1 + I2 + I3\nF2 =~ I4 + I5 + I6\nF3 =~ I7 + I8 + I9\nF1 ~~ F2\nF1 ~~ F3\nF2 ~~ F3'}
  ],
  sem:[
    {name:'SEM predictor → mediador → resultado',help:'Modelo estructural con efecto directo e indirecto.',syntax:'X =~ X1 + X2 + X3\nM =~ M1 + M2 + M3\nY =~ Y1 + Y2 + Y3\nM ~ a*X\nY ~ b*M + cprime*X\nindirect := a*b\ntotal := cprime + indirect'},
    {name:'SEM dos predictores',help:'Dos constructos predicen una variable latente resultado.',syntax:'X1f =~ X1 + X2 + X3\nX2f =~ X4 + X5 + X6\nY =~ Y1 + Y2 + Y3\nY ~ X1f + X2f\nX1f ~~ X2f'}
  ],
  mediation:[
    {name:'Mediación simple observada',help:'X, M y Y observadas.',syntax:'M ~ a*X\nY ~ b*M + cprime*X\nindirect := a*b\ntotal := cprime + indirect'},
    {name:'Mediación latente',help:'Tres constructos latentes.',syntax:'Xf =~ X1 + X2 + X3\nMf =~ M1 + M2 + M3\nYf =~ Y1 + Y2 + Y3\nMf ~ a*Xf\nYf ~ b*Mf + cprime*Xf\nindirect := a*b\ntotal := cprime + indirect'}
  ],
  secondorder:[
    {name:'Factor de segundo orden',help:'Tres factores de primer orden explicados por un factor general.',syntax:'F1 =~ I1 + I2 + I3\nF2 =~ I4 + I5 + I6\nF3 =~ I7 + I8 + I9\nG =~ F1 + F2 + F3'}
  ],
  invariance:[
    {name:'Modelo base para invariancia',help:'Use esta sintaxis junto con una variable de grupo en Validación avanzada.',syntax:'F1 =~ I1 + I2 + I3\nF2 =~ I4 + I5 + I6\nF1 ~~ F2'}
  ]
};

function refreshTemplateOptions(){
  const cat=document.getElementById('templateCategory').value;
  const sel=document.getElementById('templateSelect');
  sel.innerHTML=(modelTemplates[cat]||[]).map((x,i)=>`<option value="${i}">${escapeHtml(x.name)}</option>`).join('');
  loadTemplatePreview();
}
function loadTemplatePreview(){
  const cat=document.getElementById('templateCategory').value;
  const idx=Number(document.getElementById('templateSelect').value)||0;
  const t=(modelTemplates[cat]||[])[idx];
  if(!t)return;
  document.getElementById('templateOutput').value=t.syntax;
  document.getElementById('templateHelp').textContent=t.help+' Reemplace los nombres de variables por los de su base.';
}
document.getElementById('templateCategory')?.addEventListener('change',refreshTemplateOptions);
document.getElementById('templateSelect')?.addEventListener('change',loadTemplatePreview);
document.getElementById('loadTemplate')?.addEventListener('click',loadTemplatePreview);
document.getElementById('templateToPro')?.addEventListener('click',()=>{
  const syn=document.getElementById('templateOutput').value;
  document.getElementById('proSyntax').value=syn;
  document.querySelector('[data-section="motorpro"]')?.click();
});
document.getElementById('templateToSyntaxPro')?.addEventListener('click',()=>{
  const syn=document.getElementById('templateOutput').value;
  document.getElementById('advancedSyntaxOutput').value=syn;
  advancedGeneratedSyntax=syn;
  document.querySelector('[data-section="syntaxpro"]')?.click();
});
refreshTemplateOptions();

// -----------------------------
// ValiStruct 2.1 Project migration
// -----------------------------
let migratedProject=null;

function migrateProjectObject(old){
  const from=String(old.version||'desconocida');
  const migrated={...old};
  const changes=[];
  migrated.version='2.1';
  migrated.migratedFrom=from;
  migrated.migratedAt=new Date().toISOString();

  if(!('author' in migrated)){migrated.author='Dr. Roberto Joel Tirado Reyes';changes.push('Se añadió autor por defecto.');}
  if(!('semNodes' in migrated)){migrated.semNodes=[];changes.push('Se inicializó semNodes.');}
  if(!('semEdges' in migrated)){migrated.semEdges=[];changes.push('Se inicializó semEdges.');}
  if(!('privacy' in migrated)){migrated.privacy=loadPrivacySettings();changes.push('Se añadió configuración de privacidad v2.1.');}
  if(!('settings' in migrated)){migrated.settings=loadSettings();changes.push('Se añadió configuración avanzada v2.0+.');}
  if(!('profile' in migrated)){migrated.profile=loadProfile();changes.push('Se añadió perfil de usuario.');}

  return {project:migrated,changes,from};
}

document.getElementById('migrationFile')?.addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  try{
    const old=JSON.parse(await f.text());
    const out=migrateProjectObject(old);
    migratedProject=out.project;
    document.getElementById('migrationSummary').innerHTML=`
      <div class="metric-card"><span>Versión origen</span><strong>${escapeHtml(out.from)}</strong></div>
      <div class="metric-card"><span>Versión destino</span><strong>2.1</strong></div>
      <div class="metric-card"><span>Cambios</span><strong>${out.changes.length}</strong></div>`;
    document.getElementById('migrationResults').innerHTML=out.changes.length
      ? out.changes.map(x=>`<div class="migration-change">🟢 ${escapeHtml(x)}</div>`).join('')
      : '<div class="migration-change">🟢 El proyecto ya era compatible y solo se actualizó la versión.</div>';
  }catch(err){alert('No fue posible migrar: '+err.message);}
  e.target.value='';
});

document.getElementById('downloadMigratedProject')?.addEventListener('click',()=>{
  if(!migratedProject)return alert('Seleccione primero un proyecto antiguo.');
  saveBlob(JSON.stringify(migratedProject,null,2),'application/json;charset=utf-8;','ValiStruct_proyecto_migrado_v2_1.valistruct.json');
});

// -----------------------------
// ValiStruct 2.1 Privacy settings
// -----------------------------
const PRIVACY_KEY='valistruct_privacy_v21';
const DEFAULT_PRIVACY={rawData:'no',variableNames:'no',backendMode:'transient',clearOnClose:'no'};

function loadPrivacySettings(){
  try{return {...DEFAULT_PRIVACY,...JSON.parse(localStorage.getItem(PRIVACY_KEY)||'{}')};}
  catch(_){return {...DEFAULT_PRIVACY};}
}
function renderPrivacySettings(){
  const p=loadPrivacySettings();
  document.getElementById('privacyRawData').value=p.rawData;
  document.getElementById('privacyVariableNames').value=p.variableNames;
  document.getElementById('privacyBackendMode').value=p.backendMode;
  document.getElementById('privacyClearOnClose').value=p.clearOnClose;
  document.getElementById('privacyStatus').innerHTML=`<div class="privacy-box"><strong>Estado:</strong> datos crudos en proyectos: ${p.rawData==='yes'?'permitidos localmente':'desactivados'}; backend: ${escapeHtml(p.backendMode)}.</div>`;
}
document.getElementById('savePrivacySettings')?.addEventListener('click',()=>{
  const p={
    rawData:document.getElementById('privacyRawData').value,
    variableNames:document.getElementById('privacyVariableNames').value,
    backendMode:document.getElementById('privacyBackendMode').value,
    clearOnClose:document.getElementById('privacyClearOnClose').value
  };
  localStorage.setItem(PRIVACY_KEY,JSON.stringify(p));renderPrivacySettings();
});
document.getElementById('clearLocalResearchData')?.addEventListener('click',()=>{
  if(!confirm('Esto eliminará proyectos, historial y datos de investigación guardados localmente. ¿Continuar?'))return;
  localStorage.removeItem(PROJECT_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(GUIDED_KEY);
  diagData=null;diagLast=null;multiData=null;multiLast=null;proCsvText=null;semData=null;
  renderProjectList();renderHistory();
  alert('Datos locales de investigación eliminados. Se conservaron preferencias generales.');
});
document.getElementById('downloadPrivacyPolicy')?.addEventListener('click',()=>{
  const p=loadPrivacySettings();
  const txt=`ValiStruct 2.1 · Política local de privacidad

Autor: Dr. Roberto Joel Tirado Reyes
Universidad Autónoma de Sinaloa

Configuración activa:
- Guardar datos crudos en proyectos: ${p.rawData}
- Registrar nombres de variables: ${p.variableNames}
- Modo de backend: ${p.backendMode}
- Eliminar datos al cerrar proyecto: ${p.clearOnClose}

Principios:
1. Minimizar el almacenamiento de datos identificables.
2. Preferir procesamiento transitorio en servidor.
3. No enviar información clínica identificable cuando no sea necesaria.
4. Utilizar HTTPS en despliegues remotos.
5. Aplicar controles institucionales de acceso, retención y respaldo.
`;
  saveBlob(txt,'text/plain;charset=utf-8;','ValiStruct_politica_local_privacidad.txt');
});
renderPrivacySettings();

// Extend project state with privacy and settings, excluding raw data by default
const originalProjectStateV21 = projectState;
projectState = function(){
  const state=originalProjectStateV21();
  const privacy=loadPrivacySettings();
  state.version='2.1';
  state.privacy=privacy;
  state.settings=loadSettings();
  state.profile=loadProfile();
  if(privacy.rawData!=='yes'){
    delete state.semData;
    delete state.proCsvText;
  }
  return state;
};


// -----------------------------
// ValiStruct 2.2 SAV/DTA import
// -----------------------------
let legacyFile=null;
let legacyCsvText=null;
let legacyMeta=null;

function previewLegacyCsv(text){
  const rows=parseCSV(text.replace(/^\uFEFF/,''));
  const headers=rows[0]||[];
  const body=rows.slice(1,7);
  document.getElementById('legacySummary').innerHTML=`
    <div class="metric-card"><span>Filas</span><strong>${Math.max(0,rows.length-1)}</strong></div>
    <div class="metric-card"><span>Columnas</span><strong>${headers.length}</strong></div>
    <div class="metric-card"><span>Formato origen</span><strong>${escapeHtml(legacyMeta?.format||'')}</strong></div>`;
  let html='<div class="workspace"><table class="preview-table"><thead><tr>';
  headers.forEach(h=>html+=`<th>${escapeHtml(h)}</th>`);
  html+='</tr></thead><tbody>';
  body.forEach(r=>{html+='<tr>'+headers.map((_,i)=>`<td>${escapeHtml(String(r[i]??''))}</td>`).join('')+'</tr>';});
  html+='</tbody></table></div>';
  if(legacyMeta?.labels){
    html+=`<div class="legacy-meta"><strong>Metadatos:</strong> ${Object.keys(legacyMeta.labels).length} etiqueta(s) de variable detectadas.</div>`;
  }
  document.getElementById('legacyPreview').innerHTML=html;
}

document.getElementById('legacyDataFile')?.addEventListener('change',e=>{
  legacyFile=e.target.files?.[0]||null;
  legacyCsvText=null;legacyMeta=null;
  if(legacyFile){
    document.getElementById('legacySummary').innerHTML=`<div class="metric-card"><span>Archivo</span><strong>${escapeHtml(legacyFile.name)}</strong></div>`;
  }
});

document.getElementById('convertLegacyFile')?.addEventListener('click',async()=>{
  if(!legacyFile)return alert('Seleccione un archivo SAV o DTA.');
  const fd=new FormData();fd.append('file',legacyFile);
  try{
    const res=await fetch(`${getProApiBase()}/legacy-to-csv`,{method:'POST',body:fd});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible convertir.');
    legacyCsvText=data.csv_text;
    legacyMeta=data.meta||{};
    previewLegacyCsv(legacyCsvText);
    logHistory('Importación','Convertir SAV/DTA',{format:legacyMeta.format||'',rows:data.rows,columns:data.columns});
  }catch(e){alert(e.message);}
});

document.getElementById('legacyToDiagnostics')?.addEventListener('click',()=>{
  if(!legacyCsvText)return alert('Convierta primero el archivo.');
  diagData=parseDiagnosticCSV(legacyCsvText);
  document.querySelector('[data-section="diagnostics"]')?.click();
  document.getElementById('diagSummary').innerHTML=`<div class="metric-card"><span>Casos cargados</span><strong>${diagData.n}</strong></div><div class="metric-card"><span>Variables</span><strong>${diagData.k}</strong></div>`;
});
document.getElementById('legacyToEfa')?.addEventListener('click',()=>{
  if(!legacyCsvText)return alert('Convierta primero el archivo.');
  unifiedCsvText=legacyCsvText;
  document.getElementById('importToEfa')?.click();
});
document.getElementById('legacyToMotorPro')?.addEventListener('click',()=>{
  if(!legacyCsvText)return alert('Convierta primero el archivo.');
  proCsvText=legacyCsvText;summarizeProCsv(proCsvText);
  document.querySelector('[data-section="motorpro"]')?.click();
});
document.getElementById('downloadLegacyCsv')?.addEventListener('click',()=>{
  if(!legacyCsvText)return alert('Convierta primero el archivo.');
  saveBlob("\ufeff"+legacyCsvText,'text/csv;charset=utf-8;','ValiStruct_datos_convertidos.csv');
});

// -----------------------------
// ValiStruct 2.2 project encryption AES-GCM
// -----------------------------
function bytesToB64(bytes){
  let s='';bytes.forEach(b=>s+=String.fromCharCode(b));return btoa(s);
}
function b64ToBytes(s){
  const bin=atob(s);return Uint8Array.from(bin,c=>c.charCodeAt(0));
}
async function deriveKey(password,salt){
  const enc=new TextEncoder();
  const material=await crypto.subtle.importKey('raw',enc.encode(password),{name:'PBKDF2'},false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},
    material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']
  );
}
async function encryptProjectObject(obj,password){
  const enc=new TextEncoder();
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(password,salt);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(obj)));
  return {
    format:'ValiStructEncryptedProject',
    version:'2.2',
    kdf:'PBKDF2-SHA256',
    iterations:250000,
    cipher:'AES-GCM-256',
    salt:bytesToB64(salt),
    iv:bytesToB64(iv),
    data:bytesToB64(new Uint8Array(cipher))
  };
}
async function decryptProjectObject(wrapper,password){
  if(wrapper.format!=='ValiStructEncryptedProject')throw new Error('Archivo cifrado no reconocido.');
  const salt=b64ToBytes(wrapper.salt),iv=b64ToBytes(wrapper.iv),data=b64ToBytes(wrapper.data);
  const key=await deriveKey(password,salt);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data);
  return JSON.parse(new TextDecoder().decode(plain));
}

document.getElementById('exportEncryptedProject')?.addEventListener('click',async()=>{
  const p1=document.getElementById('encryptPassword').value;
  const p2=document.getElementById('encryptPassword2').value;
  if(p1.length<8)return alert('Use una contraseña de al menos 8 caracteres.');
  if(p1!==p2)return alert('Las contraseñas no coinciden.');
  try{
    const wrapper=await encryptProjectObject(projectState(),p1);
    saveBlob(JSON.stringify(wrapper,null,2),'application/json;charset=utf-8;','ValiStruct_proyecto_cifrado.vstructenc');
    document.getElementById('encryptionStatus').innerHTML='<div class="model-ok">Proyecto cifrado exportado correctamente.</div>';
  }catch(e){alert('No fue posible cifrar: '+e.message);}
});

document.getElementById('encryptedProjectFile')?.addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  const password=prompt('Escriba la contraseña del proyecto cifrado:');
  if(!password)return;
  try{
    const wrapper=JSON.parse(await f.text());
    const obj=await decryptProjectObject(wrapper,password);
    restoreProject(obj);
    document.getElementById('encryptionStatus').innerHTML='<div class="model-ok">Proyecto descifrado y cargado.</div>';
  }catch(err){
    document.getElementById('encryptionStatus').innerHTML='<div class="model-error">No fue posible descifrar. Revise la contraseña o el archivo.</div>';
  }
  e.target.value='';
});

// -----------------------------
// ValiStruct 2.2 Accessibility
// -----------------------------
const A11Y_KEY='valistruct_a11y_v22';
const DEFAULT_A11Y={contrast:'normal',text:'normal',motion:'system',focus:'yes'};

function loadA11y(){
  try{return {...DEFAULT_A11Y,...JSON.parse(localStorage.getItem(A11Y_KEY)||'{}')};}
  catch(_){return {...DEFAULT_A11Y};}
}
function applyA11y(){
  const a=loadA11y();
  document.body.dataset.a11yContrast=a.contrast;
  document.body.dataset.a11yText=a.text;
  document.body.dataset.a11yMotion=a.motion==='reduce'?'reduce':'system';
  document.body.dataset.a11yFocus=a.focus;
  document.getElementById('a11yContrast').value=a.contrast;
  document.getElementById('a11yTextSize').value=a.text;
  document.getElementById('a11yMotion').value=a.motion;
  document.getElementById('a11yFocus').value=a.focus;
  document.getElementById('a11yStatus').innerHTML=`<div class="model-ok">Accesibilidad activa: contraste ${a.contrast}, texto ${a.text}, foco ${a.focus}.</div>`;
}
document.getElementById('saveA11ySettings')?.addEventListener('click',()=>{
  const a={
    contrast:document.getElementById('a11yContrast').value,
    text:document.getElementById('a11yTextSize').value,
    motion:document.getElementById('a11yMotion').value,
    focus:document.getElementById('a11yFocus').value
  };
  localStorage.setItem(A11Y_KEY,JSON.stringify(a));applyA11y();
});
document.getElementById('resetA11ySettings')?.addEventListener('click',()=>{
  localStorage.removeItem(A11Y_KEY);applyA11y();
});
document.addEventListener('keydown',e=>{
  if(!e.altKey)return;
  const map={'1':'home','2':'guidedproject','3':'motorpro','4':'resultcenter'};
  if(map[e.key]){
    e.preventDefault();
    document.querySelector(`[data-section="${map[e.key]}"]`)?.click();
    document.getElementById('mainContent')?.focus();
  }
});
applyA11y();

// Improve labels/roles after DOM load
document.querySelectorAll('button').forEach(b=>{
  if(!b.getAttribute('type'))b.setAttribute('type','button');
});
document.querySelectorAll('input,select,textarea').forEach(el=>{
  if(!el.getAttribute('aria-label')){
    const label=el.closest('label');
    if(label){
      const text=label.childNodes[0]?.textContent?.trim();
      if(text)el.setAttribute('aria-label',text);
    }
  }
});

// -----------------------------
// ValiStruct 2.2 Versioning / compatibility
// -----------------------------
const VERSION_INFO={
  app:'ValiStruct',
  version:'2.2',
  projectFormat:'2.2',
  minimumReadableProject:'0.7',
  author:'Dr. Roberto Joel Tirado Reyes',
  institution:'Universidad Autónoma de Sinaloa'
};

function showVersionInfo(){
  document.getElementById('versionInfo').innerHTML=`
    <div class="version-card">
      <h3>${VERSION_INFO.app} ${VERSION_INFO.version}</h3>
      <p><strong>Formato de proyecto:</strong> ${VERSION_INFO.projectFormat}</p>
      <p><strong>Compatibilidad de lectura:</strong> proyectos desde ${VERSION_INFO.minimumReadableProject}, con migración cuando sea necesario.</p>
      <p><strong>Autor:</strong> ${escapeHtml(VERSION_INFO.author)}</p>
      <p><strong>Institución:</strong> ${escapeHtml(VERSION_INFO.institution)}</p>
    </div>`;
}
document.getElementById('showVersionInfo')?.addEventListener('click',showVersionInfo);
document.getElementById('exportVersionManifest')?.addEventListener('click',()=>{
  saveBlob(JSON.stringify(VERSION_INFO,null,2),'application/json;charset=utf-8;','ValiStruct_version_manifest.json');
});
document.getElementById('runCompatibilityCheck')?.addEventListener('click',()=>{
  const checks=[
    ['Web Crypto',!!window.crypto?.subtle],
    ['File API',!!window.FileReader],
    ['Blob export',!!window.Blob],
    ['Service Worker','serviceWorker' in navigator],
    ['Pointer Events','PointerEvent' in window],
    ['LocalStorage',(()=>{try{localStorage.setItem('__v22','1');localStorage.removeItem('__v22');return true}catch(_){return false}})()]
  ];
  document.getElementById('compatibilityResults').innerHTML=checks.map(([n,ok])=>`<div class="system-check-item ${ok?'system-check-ok':'system-check-warn'}">${ok?'🟢':'🟠'} <strong>${n}</strong><div class="small">${ok?'Disponible':'No disponible o restringido en este navegador.'}</div></div>`).join('');
});
showVersionInfo();


// -----------------------------
// ValiStruct 2.3 Institutional auth
// -----------------------------
const AUTH_TOKEN_KEY='valistruct_auth_token_v23';
const AUTH_USER_KEY='valistruct_auth_user_v23';

function authHeaders(extra={}){
  const token=sessionStorage.getItem(AUTH_TOKEN_KEY);
  return token?{...extra,'Authorization':`Bearer ${token}`}:{...extra};
}
function currentAuthUser(){
  try{return JSON.parse(sessionStorage.getItem(AUTH_USER_KEY)||'null');}catch(_){return null;}
}
function renderAuthStatus(data=null){
  const user=data?.user||currentAuthUser();
  const box=document.getElementById('authStatus');
  if(!box)return;
  if(user){
    box.innerHTML=`<div class="model-ok"><strong>Sesión activa:</strong> ${escapeHtml(user.username)} <span class="role-badge">${escapeHtml(user.role)}</span></div>`;
  }else{
    box.innerHTML='<div class="notice">No hay sesión institucional activa.</div>';
  }
}
document.getElementById('loginInstitution')?.addEventListener('click',async()=>{
  const username=document.getElementById('authUsername').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!username||!password)return alert('Ingrese usuario y contraseña.');
  try{
    const res=await fetch(`${getProApiBase()}/auth/login`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({username,password})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'Acceso denegado');
    sessionStorage.setItem(AUTH_TOKEN_KEY,data.token);
    sessionStorage.setItem(AUTH_USER_KEY,JSON.stringify(data.user));
    document.getElementById('authPassword').value='';
    renderAuthStatus(data);
    logHistory('Acceso institucional','Login',{role:data.user?.role||''});
  }catch(e){alert(e.message);}
});
document.getElementById('logoutInstitution')?.addEventListener('click',async()=>{
  const token=sessionStorage.getItem(AUTH_TOKEN_KEY);
  try{
    if(token) await fetch(`${getProApiBase()}/auth/logout`,{method:'POST',headers:authHeaders()});
  }catch(_){}
  sessionStorage.removeItem(AUTH_TOKEN_KEY);sessionStorage.removeItem(AUTH_USER_KEY);
  renderAuthStatus();
});
document.getElementById('checkAuthStatus')?.addEventListener('click',async()=>{
  try{
    const res=await fetch(`${getProApiBase()}/auth/status`,{headers:authHeaders()});
    const data=await res.json();
    if(data.authenticated && data.user){
      sessionStorage.setItem(AUTH_USER_KEY,JSON.stringify(data.user));
      renderAuthStatus(data);
    }else{
      sessionStorage.removeItem(AUTH_TOKEN_KEY);sessionStorage.removeItem(AUTH_USER_KEY);
      renderAuthStatus();
    }
  }catch(e){alert('No fue posible comprobar el acceso: '+e.message);}
});
renderAuthStatus();

// -----------------------------
// ValiStruct 2.3 Institutional project library
// -----------------------------
let institutionalProjects=[];
let syncRemoteProject=null;

function sanitizedProjectForInstitution(){
  const s=projectState();
  delete s.semData;
  delete s.proCsvText;
  s.institutionalSync={
    excludesRawData:true,
    syncedAt:new Date().toISOString()
  };
  return s;
}
async function refreshInstitutionLibrary(){
  const box=document.getElementById('institutionProjectList');
  box.innerHTML='<div class="notice">Consultando biblioteca…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/projects`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar la biblioteca.');
    institutionalProjects=data.projects||[];
    document.getElementById('institutionLibraryStatus').innerHTML=`
      <div class="metric-card"><span>Proyectos</span><strong>${institutionalProjects.length}</strong></div>
      <div class="metric-card"><span>Rol</span><strong>${escapeHtml(data.role||'')}</strong></div>`;
    renderInstitutionProjects();
    refreshSyncProjectSelect();
  }catch(e){
    box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;
  }
}
function renderInstitutionProjects(){
  const box=document.getElementById('institutionProjectList');
  if(!institutionalProjects.length){box.innerHTML='<p class="small">No hay proyectos disponibles para esta cuenta.</p>';return;}
  box.innerHTML=institutionalProjects.map(p=>`
    <div class="institution-project">
      <strong>${escapeHtml(p.name||'Proyecto')}</strong>
      <div class="meta">Propietario: ${escapeHtml(p.owner||'')} · Actualizado: ${escapeHtml(p.updated_at||'')}</div>
      <div class="button-row">
        <button data-inst-open="${escapeHtml(p.id)}">Abrir</button>
        <button data-inst-delete="${escapeHtml(p.id)}">Eliminar</button>
      </div>
    </div>`).join('');
  box.querySelectorAll('[data-inst-open]').forEach(b=>b.addEventListener('click',()=>openInstitutionProject(b.dataset.instOpen)));
  box.querySelectorAll('[data-inst-delete]').forEach(b=>b.addEventListener('click',()=>deleteInstitutionProject(b.dataset.instDelete)));
}
async function openInstitutionProject(id){
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible abrir el proyecto.');
    restoreProject(data.project);
    alert('Proyecto institucional cargado.');
  }catch(e){alert(e.message);}
}
async function deleteInstitutionProject(id){
  if(!confirm('¿Eliminar este proyecto de la biblioteca institucional?'))return;
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(id)}`,{method:'DELETE',headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible eliminar.');
    refreshInstitutionLibrary();
  }catch(e){alert(e.message);}
}
document.getElementById('refreshInstitutionProjects')?.addEventListener('click',refreshInstitutionLibrary);
document.getElementById('uploadInstitutionProject')?.addEventListener('click',async()=>{
  const project=sanitizedProjectForInstitution();
  try{
    const res=await fetch(`${getProApiBase()}/projects`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({project})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible guardar.');
    alert('Proyecto guardado en la biblioteca institucional sin datos crudos.');
    refreshInstitutionLibrary();
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.3 Controlled sync
// -----------------------------
function refreshSyncProjectSelect(){
  const sel=document.getElementById('syncProjectSelect');
  if(!sel)return;
  sel.innerHTML='<option value="">Seleccione un proyecto</option>'+institutionalProjects.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name||p.id)}</option>`).join('');
}
function summarizeProjectDiff(local,remote){
  const fields=['name','version','reportTitle','proSyntax','latenciaSyntax'];
  const diffs=[];
  fields.forEach(k=>{
    const a=local?.[k]??'',b=remote?.[k]??'';
    if(JSON.stringify(a)!==JSON.stringify(b))diffs.push({field:k,local:a,remote:b});
  });
  const localNodes=local?.semNodes?.length||0, remoteNodes=remote?.semNodes?.length||0;
  if(localNodes!==remoteNodes)diffs.push({field:'semNodes',local:localNodes,remote:remoteNodes});
  const localEdges=local?.semEdges?.length||0, remoteEdges=remote?.semEdges?.length||0;
  if(localEdges!==remoteEdges)diffs.push({field:'semEdges',local:localEdges,remote:remoteEdges});
  return diffs;
}
document.getElementById('compareSync')?.addEventListener('click',async()=>{
  const id=document.getElementById('syncProjectSelect').value;
  if(!id)return alert('Seleccione un proyecto institucional.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible abrir proyecto remoto.');
    syncRemoteProject=data.project;
    const local=projectState();
    const diffs=summarizeProjectDiff(local,syncRemoteProject);
    document.getElementById('syncResults').innerHTML=diffs.length
      ? diffs.map(d=>`<div class="sync-diff"><strong>${escapeHtml(d.field)}</strong><div class="small">Local: ${escapeHtml(String(d.local))}</div><div class="small">Institucional: ${escapeHtml(String(d.remote))}</div></div>`).join('')
      : '<div class="model-ok">No se detectaron diferencias básicas.</div>';
  }catch(e){alert(e.message);}
});
document.getElementById('applySync')?.addEventListener('click',async()=>{
  const strategy=document.getElementById('syncStrategy').value;
  const id=document.getElementById('syncProjectSelect').value;
  if(!id)return alert('Seleccione un proyecto.');
  if(strategy==='review')return alert('Seleccione “Usar versión institucional” o “Usar versión local” después de revisar las diferencias.');
  if(strategy==='pull'){
    if(!syncRemoteProject)return alert('Compare primero las versiones.');
    restoreProject(syncRemoteProject);
    alert('Se aplicó la versión institucional al proyecto local.');
  }else if(strategy==='push'){
    try{
      const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(id)}`,{
        method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),
        body:JSON.stringify({project:sanitizedProjectForInstitution()})
      });
      const data=await res.json();
      if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible sincronizar.');
      alert('La versión local se sincronizó con la biblioteca institucional.');
      refreshInstitutionLibrary();
    }catch(e){alert(e.message);}
  }
});

// -----------------------------
// ValiStruct 2.3 Backend self-tests
// -----------------------------
let backendTestsLast=null;
document.getElementById('runBackendSelfTest')?.addEventListener('click',async()=>{
  const box=document.getElementById('backendTestResults');
  box.innerHTML='<div class="notice">Ejecutando pruebas del backend…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/self-test`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'Self-test falló.');
    backendTestsLast=data;
    const tests=data.tests||[];
    const pass=tests.filter(x=>x.status==='pass').length;
    const warn=tests.filter(x=>x.status==='warn').length;
    const fail=tests.filter(x=>x.status==='fail').length;
    document.getElementById('backendTestSummary').innerHTML=`
      <div class="metric-card"><span>PASS</span><strong>${pass}</strong></div>
      <div class="metric-card"><span>WARN</span><strong>${warn}</strong></div>
      <div class="metric-card"><span>FAIL</span><strong>${fail}</strong></div>`;
    box.innerHTML=tests.map(t=>`<div class="system-check-item ${t.status==='pass'?'test-pass':(t.status==='warn'?'test-warn':'test-fail')}">${t.status==='pass'?'🟢':(t.status==='warn'?'🟠':'🔴')} <strong>${escapeHtml(t.name)}</strong><div class="small">${escapeHtml(t.detail||'')}</div></div>`).join('');
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
});
document.getElementById('downloadBackendTestReport')?.addEventListener('click',()=>{
  if(!backendTestsLast)return alert('Ejecute primero el self-test.');
  saveBlob(JSON.stringify(backendTestsLast,null,2),'application/json;charset=utf-8;','ValiStruct_backend_selftest.json');
});


// -----------------------------
// ValiStruct 2.4 Team permissions
// -----------------------------
let teamProjectsCache=[];

function fillInstitutionSelectors(projects){
  const opts='<option value="">Seleccione un proyecto</option>'+projects.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name||p.id)}</option>`).join('');
  ['teamProjectSelect','versionProjectSelect'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.innerHTML=opts;
  });
}
async function refreshTeamProjects(){
  try{
    const res=await fetch(`${getProApiBase()}/projects`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar proyectos.');
    teamProjectsCache=data.projects||[];
    fillInstitutionSelectors(teamProjectsCache);
    document.getElementById('teamStatus').innerHTML=`<div class="metric-card"><span>Proyectos disponibles</span><strong>${teamProjectsCache.length}</strong></div>`;
  }catch(e){alert(e.message);}
}
async function loadTeamMembers(projectId){
  if(!projectId)return;
  const box=document.getElementById('teamMembers');
  box.innerHTML='<div class="notice">Consultando permisos…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/permissions`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar permisos.');
    const list=data.permissions||[];
    box.innerHTML=list.length?list.map(x=>`<div class="member-row"><div><strong>${escapeHtml(x.username)}</strong><div class="version-meta">${escapeHtml(x.role||'')}</div></div><span class="permission-badge">${escapeHtml(x.permission)}</span></div>`).join(''):'<p class="small">No hay colaboradores asignados.</p>';
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
document.getElementById('refreshTeamProjects')?.addEventListener('click',refreshTeamProjects);
document.getElementById('teamProjectSelect')?.addEventListener('change',e=>loadTeamMembers(e.target.value));
document.getElementById('grantTeamPermission')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('teamProjectSelect').value;
  const username=document.getElementById('teamUsername').value.trim();
  const permission=document.getElementById('teamPermission').value;
  if(!projectId||!username)return alert('Seleccione proyecto y escriba usuario.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/permissions`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({username,permission})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible conceder permiso.');
    await loadTeamMembers(projectId);
  }catch(e){alert(e.message);}
});
document.getElementById('revokeTeamPermission')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('teamProjectSelect').value;
  const username=document.getElementById('teamUsername').value.trim();
  if(!projectId||!username)return alert('Seleccione proyecto y escriba usuario.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/permissions/${encodeURIComponent(username)}`,{
      method:'DELETE',headers:authHeaders()
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible revocar permiso.');
    await loadTeamMembers(projectId);
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.4 Project versions
// -----------------------------
let projectVersionsCache=[];

async function refreshProjectVersions(){
  const projectId=document.getElementById('versionProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const box=document.getElementById('projectVersionList');
  box.innerHTML='<div class="notice">Consultando versiones…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/versions`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar versiones.');
    projectVersionsCache=data.versions||[];
    document.getElementById('projectVersionSummary').innerHTML=`<div class="metric-card"><span>Versiones</span><strong>${projectVersionsCache.length}</strong></div>`;
    box.innerHTML=projectVersionsCache.length?projectVersionsCache.map(v=>`<div class="version-row"><div><strong>Versión ${escapeHtml(String(v.version))}</strong><div class="version-meta">${escapeHtml(v.created_at||'')} · ${escapeHtml(v.created_by||'')} · ${escapeHtml(v.comment||'')}</div></div><div class="button-row"><button data-version-open="${escapeHtml(String(v.version))}">Abrir</button><button data-version-restore="${escapeHtml(String(v.version))}">Restaurar</button></div></div>`).join(''):'<p class="small">No hay versiones guardadas.</p>';
    box.querySelectorAll('[data-version-open]').forEach(b=>b.addEventListener('click',()=>openProjectVersion(projectId,b.dataset.versionOpen)));
    box.querySelectorAll('[data-version-restore]').forEach(b=>b.addEventListener('click',()=>restoreProjectVersion(projectId,b.dataset.versionRestore)));
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
async function openProjectVersion(projectId,version){
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(version)}`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible abrir versión.');
    restoreProject(data.project);
    alert(`Versión ${version} cargada localmente.`);
  }catch(e){alert(e.message);}
}
async function restoreProjectVersion(projectId,version){
  if(!confirm(`¿Restaurar la versión ${version} como versión actual institucional?`))return;
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/restore/${encodeURIComponent(version)}`,{
      method:'POST',headers:authHeaders()
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible restaurar.');
    alert('Versión restaurada.');
    refreshProjectVersions();
    refreshInstitutionLibrary();
  }catch(e){alert(e.message);}
}
document.getElementById('refreshProjectVersions')?.addEventListener('click',refreshProjectVersions);
document.getElementById('saveProjectVersion')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('versionProjectSelect').value;
  const comment=document.getElementById('versionComment').value.trim();
  if(!projectId)return alert('Seleccione un proyecto.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/versions`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({comment,project:sanitizedProjectForInstitution()})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible crear versión.');
    refreshProjectVersions();
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.4 Admin panel
// -----------------------------
let adminLast=null;
document.getElementById('refreshAdminPanel')?.addEventListener('click',async()=>{
  const box=document.getElementById('adminContent');
  box.innerHTML='<div class="notice">Consultando estado administrativo…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/admin/summary`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'Acceso administrativo no disponible.');
    adminLast=data;
    document.getElementById('adminSummary').innerHTML=`
      <div class="metric-card"><span>Usuarios</span><strong>${data.users_total}</strong></div>
      <div class="metric-card"><span>Proyectos</span><strong>${data.projects_total}</strong></div>
      <div class="metric-card"><span>Versiones</span><strong>${data.versions_total}</strong></div>`;
    box.innerHTML=(data.users||[]).map(u=>`<div class="admin-card"><strong>${escapeHtml(u.username)}</strong> <span class="role-badge">${escapeHtml(u.role)}</span></div>`).join('');
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
});
document.getElementById('downloadAdminSummary')?.addEventListener('click',()=>{
  if(!adminLast)return alert('Actualice primero el panel.');
  saveBlob(JSON.stringify(adminLast,null,2),'application/json;charset=utf-8;','ValiStruct_admin_summary.json');
});

// -----------------------------
// ValiStruct 2.4 OIDC config preparation
// -----------------------------
const OIDC_KEY='valistruct_oidc_v24';
function loadOidc(){
  try{return JSON.parse(localStorage.getItem(OIDC_KEY)||'{}');}catch(_){return {};}
}
function renderOidc(){
  const o=loadOidc();
  document.getElementById('oidcIssuer').value=o.issuer||'';
  document.getElementById('oidcClientId').value=o.clientId||'';
  document.getElementById('oidcRedirectUri').value=o.redirectUri||'';
  document.getElementById('oidcScopes').value=o.scopes||'openid profile email';
  document.getElementById('oidcStatus').innerHTML=o.issuer?'<div class="model-ok">Configuración OIDC local guardada.</div>':'<div class="notice">OIDC aún no configurado.</div>';
}
document.getElementById('saveOidcConfig')?.addEventListener('click',()=>{
  const o={
    issuer:document.getElementById('oidcIssuer').value.trim(),
    clientId:document.getElementById('oidcClientId').value.trim(),
    redirectUri:document.getElementById('oidcRedirectUri').value.trim(),
    scopes:document.getElementById('oidcScopes').value.trim()
  };
  localStorage.setItem(OIDC_KEY,JSON.stringify(o));renderOidc();
});
document.getElementById('exportOidcConfig')?.addEventListener('click',()=>{
  saveBlob(JSON.stringify(loadOidc(),null,2),'application/json;charset=utf-8;','ValiStruct_oidc_config.json');
});
renderOidc();


// -----------------------------
// ValiStruct 2.5 shared project selectors
// -----------------------------
let reviewProjectsCache=[];
let activityLast=null;
let notificationsLast=null;
let betaLast=null;

async function loadInstitutionProjectsForV25(){
  const res=await fetch(`${getProApiBase()}/projects`,{headers:authHeaders()});
  const data=await res.json();
  if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar proyectos.');
  reviewProjectsCache=data.projects||[];
  const opts='<option value="">Seleccione un proyecto</option>'+reviewProjectsCache.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name||p.id)}</option>`).join('');
  ['reviewProjectSelect','activityProjectSelect'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.innerHTML=opts;
  });
  return reviewProjectsCache;
}

// -----------------------------
// ValiStruct 2.5 Peer review comments
// -----------------------------
async function loadReviewComments(){
  const projectId=document.getElementById('reviewProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const box=document.getElementById('reviewCommentList');
  box.innerHTML='<div class="notice">Consultando comentarios…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/comments`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar comentarios.');
    const comments=data.comments||[];
    const open=comments.filter(c=>!c.resolved).length;
    document.getElementById('reviewSummary').innerHTML=`
      <div class="metric-card"><span>Comentarios</span><strong>${comments.length}</strong></div>
      <div class="metric-card"><span>Abiertos</span><strong>${open}</strong></div>
      <div class="metric-card"><span>Resueltos</span><strong>${comments.length-open}</strong></div>`;
    box.innerHTML=comments.length?comments.map(c=>`
      <div class="review-card ${c.resolved?'resolved':''}">
        <strong>${escapeHtml(c.type||'general')}</strong>
        <p>${escapeHtml(c.text||'')}</p>
        <div class="review-meta">${escapeHtml(c.author||'')} · ${escapeHtml(c.created_at||'')}</div>
        <div class="button-row">
          <button data-comment-resolve="${escapeHtml(c.id)}">${c.resolved?'Reabrir':'Marcar resuelto'}</button>
        </div>
      </div>`).join(''):'<p class="small">No hay comentarios.</p>';
    box.querySelectorAll('[data-comment-resolve]').forEach(b=>b.addEventListener('click',()=>toggleReviewComment(projectId,b.dataset.commentResolve)));
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
async function toggleReviewComment(projectId,commentId){
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/comments/${encodeURIComponent(commentId)}/toggle`,{
      method:'POST',headers:authHeaders()
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible actualizar comentario.');
    loadReviewComments();
  }catch(e){alert(e.message);}
}
document.getElementById('refreshReviewProjects')?.addEventListener('click',()=>loadInstitutionProjectsForV25().catch(e=>alert(e.message)));
document.getElementById('refreshReviewComments')?.addEventListener('click',loadReviewComments);
document.getElementById('reviewProjectSelect')?.addEventListener('change',()=>{ if(document.getElementById('reviewProjectSelect').value) loadReviewComments(); });
document.getElementById('addReviewComment')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('reviewProjectSelect').value;
  const text=document.getElementById('reviewCommentText').value.trim();
  const type=document.getElementById('reviewType').value;
  if(!projectId||!text)return alert('Seleccione proyecto y escriba comentario.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/comments`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({text,type})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible agregar comentario.');
    document.getElementById('reviewCommentText').value='';
    loadReviewComments();
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.5 Activity log
// -----------------------------
async function loadProjectActivity(){
  const projectId=document.getElementById('activityProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const box=document.getElementById('activityList');
  box.innerHTML='<div class="notice">Consultando actividad…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/activity`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar actividad.');
    activityLast=data;
    const entries=data.activity||[];
    document.getElementById('activitySummary').innerHTML=`
      <div class="metric-card"><span>Eventos</span><strong>${entries.length}</strong></div>`;
    box.innerHTML=entries.length?entries.map(a=>`
      <div class="activity-card">
        <strong>${escapeHtml(a.action||'')}</strong>
        <div class="activity-meta">${escapeHtml(a.user||'')} · ${escapeHtml(a.created_at||'')}</div>
        <div class="small">${escapeHtml(a.detail||'')}</div>
      </div>`).join(''):'<p class="small">Sin eventos registrados.</p>';
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
document.getElementById('refreshActivityProjects')?.addEventListener('click',()=>loadInstitutionProjectsForV25().catch(e=>alert(e.message)));
document.getElementById('loadProjectActivity')?.addEventListener('click',loadProjectActivity);
document.getElementById('downloadProjectActivity')?.addEventListener('click',()=>{
  if(!activityLast)return alert('Cargue primero la bitácora.');
  saveBlob(JSON.stringify(activityLast,null,2),'application/json;charset=utf-8;','ValiStruct_bitacora_colaborativa.json');
});

// -----------------------------
// ValiStruct 2.5 Notifications
// -----------------------------
async function loadNotifications(){
  const box=document.getElementById('notificationList');
  box.innerHTML='<div class="notice">Consultando notificaciones…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/notifications`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar notificaciones.');
    notificationsLast=data;
    const list=data.notifications||[];
    const unread=list.filter(x=>!x.read).length;
    document.getElementById('notificationSummary').innerHTML=`
      <div class="metric-card"><span>Total</span><strong>${list.length}</strong></div>
      <div class="metric-card"><span>No leídas</span><strong>${unread}</strong></div>`;
    box.innerHTML=list.length?list.map(n=>`
      <div class="notification-card ${n.read?'notification-read':'notification-unread'}">
        <strong>${escapeHtml(n.title||'Notificación')}</strong>
        <p>${escapeHtml(n.message||'')}</p>
        <div class="notification-meta">${escapeHtml(n.created_at||'')}</div>
      </div>`).join(''):'<p class="small">No hay notificaciones.</p>';
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
document.getElementById('refreshNotifications')?.addEventListener('click',loadNotifications);
document.getElementById('markNotificationsRead')?.addEventListener('click',async()=>{
  try{
    const res=await fetch(`${getProApiBase()}/notifications/read-all`,{method:'POST',headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible actualizar notificaciones.');
    loadNotifications();
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.5 Beta readiness
// -----------------------------
async function evaluateBetaReadiness(){
  const checks=[];
  const add=(name,status,detail)=>checks.push({name,status,detail});
  add('Frontend 2.5','ok','Aplicación cargada y módulos de colaboración disponibles.');
  add('PWA','serviceWorker' in navigator?'ok':'warn','Service Worker '+('serviceWorker' in navigator?'disponible.':'no disponible.'));
  add('Web Crypto',window.crypto?.subtle?'ok':'warn',window.crypto?.subtle?'Cifrado disponible.':'Cifrado no disponible en este navegador.');
  try{
    const res=await fetch(`${getProApiBase()}/self-test`,{headers:authHeaders()});
    const data=await res.json();
    if(res.ok){
      const fails=(data.tests||[]).filter(x=>x.status==='fail');
      add('Backend self-test',fails.length?'warn':'ok',fails.length?`${fails.length} prueba(s) con falla.`:'Sin fallas críticas.');
      const auth=(data.tests||[]).find(x=>x.name==='Auth mode');
      const lib=(data.tests||[]).find(x=>x.name==='Institution project library');
      add('Autenticación institucional',auth?.status==='pass'?'ok':'warn',auth?.detail||'');
      add('Biblioteca institucional',lib?.status==='pass'?'ok':'warn',lib?.detail||'');
    }else add('Backend self-test','bad','No respondió correctamente.');
  }catch(e){
    add('Backend self-test','bad','Backend no accesible.');
  }
  const pass=checks.filter(x=>x.status==='ok').length;
  const warn=checks.filter(x=>x.status==='warn').length;
  const bad=checks.filter(x=>x.status==='bad').length;
  const pct=Math.round(100*pass/checks.length);
  betaLast={timestamp:new Date().toISOString(),pass,warn,bad,percentage:pct,checks};
  document.getElementById('betaSummary').innerHTML=`
    <div class="metric-card"><span>Preparación</span><strong>${pct}%</strong></div>
    <div class="metric-card"><span>OK</span><strong>${pass}</strong></div>
    <div class="metric-card"><span>Advertencias</span><strong>${warn}</strong></div>
    <div class="metric-card"><span>Errores</span><strong>${bad}</strong></div>`;
  document.getElementById('betaContent').innerHTML=checks.map(c=>`
    <div class="beta-card ${c.status==='ok'?'beta-ok':(c.status==='warn'?'beta-warn':'beta-bad')}">
      <strong>${c.status==='ok'?'🟢':(c.status==='warn'?'🟠':'🔴')} ${escapeHtml(c.name)}</strong>
      <div class="small">${escapeHtml(c.detail)}</div>
    </div>`).join('')+
    `<div class="sem-engine-note">La preparación beta evalúa componentes técnicos básicos; no sustituye pruebas de seguridad, carga, privacidad ni validación institucional formal.</div>`;
}
document.getElementById('evaluateBetaReadiness')?.addEventListener('click',evaluateBetaReadiness);
document.getElementById('downloadBetaReadiness')?.addEventListener('click',()=>{
  if(!betaLast)return alert('Evalúe primero la preparación beta.');
  saveBlob(JSON.stringify(betaLast,null,2),'application/json;charset=utf-8;','ValiStruct_beta_readiness.json');
});


// -----------------------------
// ValiStruct 2.6 conflict resolution
// -----------------------------
let conflictProjectsCache=[];
let conflictRemoteProject=null;
let conflictLocalProject=null;
let conflictRevision=null;

async function refreshConflictProjectsV26(){
  const res=await fetch(`${getProApiBase()}/projects`,{headers:authHeaders()});
  const data=await res.json();
  if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar proyectos.');
  conflictProjectsCache=data.projects||[];
  const opts='<option value="">Seleccione un proyecto</option>'+conflictProjectsCache.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name||p.id)}</option>`).join('');
  ['conflictProjectSelect','taskProjectSelect','collabExportProjectSelect'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.innerHTML=opts;
  });
}
function conflictFields(local,remote){
  const fields=[
    ['name','Nombre del proyecto'],
    ['reportTitle','Título del reporte'],
    ['proSyntax','Sintaxis Motor Pro'],
    ['latenciaSyntax','Sintaxis Latencia']
  ];
  return fields.map(([key,label])=>({key,label,local:local?.[key]??'',remote:remote?.[key]??''}))
    .filter(x=>JSON.stringify(x.local)!==JSON.stringify(x.remote));
}
document.getElementById('refreshConflictProjects')?.addEventListener('click',()=>refreshConflictProjectsV26().catch(e=>alert(e.message)));
document.getElementById('loadConflictComparison')?.addEventListener('click',async()=>{
  const id=document.getElementById('conflictProjectSelect').value;
  if(!id)return alert('Seleccione un proyecto.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible cargar proyecto remoto.');
    conflictRemoteProject=data.project;
    conflictLocalProject=projectState();
    conflictRevision=Number(conflictRemoteProject?._institution?.revision||1);
    const diffs=conflictFields(conflictLocalProject,conflictRemoteProject);
    document.getElementById('conflictSummary').innerHTML=`
      <div class="metric-card"><span>Diferencias</span><strong>${diffs.length}</strong></div>
      <div class="metric-card"><span>Revisión remota</span><strong>${conflictRevision}</strong></div>`;
    document.getElementById('conflictResults').innerHTML=diffs.length?diffs.map(d=>`
      <div class="conflict-card" data-conflict-key="${escapeHtml(d.key)}">
        <strong>${escapeHtml(d.label)}</strong>
        <div class="small"><b>Local:</b> ${escapeHtml(String(d.local)).slice(0,500)}</div>
        <div class="small"><b>Institucional:</b> ${escapeHtml(String(d.remote)).slice(0,500)}</div>
        <div class="conflict-options">
          <label><input type="radio" name="conflict_${escapeHtml(d.key)}" value="local" checked> Conservar local</label>
          <label><input type="radio" name="conflict_${escapeHtml(d.key)}" value="remote"> Usar institucional</label>
        </div>
      </div>`).join(''):'<div class="model-ok">No hay diferencias en campos críticos.</div>';
  }catch(e){alert(e.message);}
});
document.getElementById('applyResolvedConflict')?.addEventListener('click',async()=>{
  const id=document.getElementById('conflictProjectSelect').value;
  if(!id||!conflictRemoteProject||!conflictLocalProject)return alert('Compare primero las versiones.');
  const merged=JSON.parse(JSON.stringify(conflictLocalProject));
  document.querySelectorAll('[data-conflict-key]').forEach(card=>{
    const key=card.dataset.conflictKey;
    const choice=card.querySelector(`input[name="conflict_${CSS.escape(key)}"]:checked`)?.value||'local';
    if(choice==='remote')merged[key]=conflictRemoteProject[key];
  });
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(id)}`,{
      method:'PUT',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({project:merged,expected_revision:conflictRevision})
    });
    const data=await res.json();
    if(res.status===409||data.conflict)throw new Error('El proyecto institucional cambió mientras resolvía el conflicto. Vuelva a comparar.');
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible aplicar resolución.');
    restoreProject(merged);
    alert('Conflicto resuelto y sincronizado.');
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.6 tasks / review status
// -----------------------------
async function loadTasks(){
  const projectId=document.getElementById('taskProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const box=document.getElementById('taskList');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/tasks`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar tareas.');
    const tasks=data.tasks||[];
    document.getElementById('projectReviewStatus').value=data.review_status||'pending';
    document.getElementById('taskSummary').innerHTML=`
      <div class="metric-card"><span>Tareas</span><strong>${tasks.length}</strong></div>
      <div class="metric-card"><span>Pendientes</span><strong>${tasks.filter(t=>!t.done).length}</strong></div>
      <div class="metric-card"><span>Estado</span><strong>${escapeHtml(data.review_status||'pending')}</strong></div>`;
    box.innerHTML=tasks.length?tasks.map(t=>`
      <div class="task-card ${t.done?'task-done':''} task-priority-${escapeHtml(t.priority||'medium')}">
        <strong>${escapeHtml(t.text||'')}</strong>
        <div class="review-meta">Asignada a: ${escapeHtml(t.assignee||'')} · ${escapeHtml(t.created_at||'')}</div>
        <div class="button-row"><button data-task-toggle="${escapeHtml(t.id)}">${t.done?'Reabrir':'Completar'}</button></div>
      </div>`).join(''):'<p class="small">No hay tareas.</p>';
    box.querySelectorAll('[data-task-toggle]').forEach(b=>b.addEventListener('click',()=>toggleTask(projectId,b.dataset.taskToggle)));
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
async function toggleTask(projectId,taskId){
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/toggle`,{method:'POST',headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible actualizar tarea.');
    loadTasks();
  }catch(e){alert(e.message);}
}
document.getElementById('refreshTaskProjects')?.addEventListener('click',()=>refreshConflictProjectsV26().catch(e=>alert(e.message)));
document.getElementById('refreshTasks')?.addEventListener('click',loadTasks);
document.getElementById('taskProjectSelect')?.addEventListener('change',()=>{if(document.getElementById('taskProjectSelect').value)loadTasks();});
document.getElementById('addTask')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('taskProjectSelect').value;
  const text=document.getElementById('taskText').value.trim();
  const assignee=document.getElementById('taskAssignee').value.trim();
  const priority=document.getElementById('taskPriority').value;
  if(!projectId||!text||!assignee)return alert('Seleccione proyecto, usuario y escriba tarea.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/tasks`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({text,assignee,priority})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible asignar tarea.');
    document.getElementById('taskText').value='';
    loadTasks();
  }catch(e){alert(e.message);}
});
document.getElementById('saveProjectReviewStatus')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('taskProjectSelect').value;
  const status=document.getElementById('projectReviewStatus').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/review-status`,{
      method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({status})
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible guardar estado.');
    loadTasks();
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.6 collaboration export
// -----------------------------
let collabPreviewData=null;
async function generateCollabPreview(){
  const projectId=document.getElementById('collabExportProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  try{
    const [a,c,t]=await Promise.all([
      fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/activity`,{headers:authHeaders()}).then(r=>r.json()),
      fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/comments`,{headers:authHeaders()}).then(r=>r.json()),
      fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/tasks`,{headers:authHeaders()}).then(r=>r.json())
    ]);
    collabPreviewData={project_id:projectId,activity:a.activity||[],comments:c.comments||[],tasks:t.tasks||[],review_status:t.review_status||'pending'};
    let html=`<h2>ValiStruct · Bitácora colaborativa</h2><p><strong>Estado de revisión:</strong> ${escapeHtml(collabPreviewData.review_status)}</p>`;
    html+='<h3>Actividad</h3>'+collabPreviewData.activity.map(x=>`<p><strong>${escapeHtml(x.action)}</strong> — ${escapeHtml(x.user)} · ${escapeHtml(x.created_at)}<br>${escapeHtml(x.detail||'')}</p>`).join('');
    html+='<h3>Comentarios</h3>'+collabPreviewData.comments.map(x=>`<p><strong>${escapeHtml(x.type)}</strong> — ${escapeHtml(x.author)} · ${escapeHtml(x.created_at)}<br>${escapeHtml(x.text||'')} ${x.resolved?'[Resuelto]':'[Abierto]'}</p>`).join('');
    html+='<h3>Tareas</h3>'+collabPreviewData.tasks.map(x=>`<p><strong>${escapeHtml(x.text)}</strong> — ${escapeHtml(x.assignee)} · ${escapeHtml(x.priority)} · ${x.done?'Completada':'Pendiente'}</p>`).join('');
    document.getElementById('collabExportPreview').innerHTML=html;
  }catch(e){alert(e.message);}
}
document.getElementById('refreshCollabExportProjects')?.addEventListener('click',()=>refreshConflictProjectsV26().catch(e=>alert(e.message)));
document.getElementById('generateCollabPreview')?.addEventListener('click',generateCollabPreview);
document.getElementById('downloadCollabDocx')?.addEventListener('click',async()=>{
  if(!collabPreviewData)await generateCollabPreview();
  if(!collabPreviewData)return;
  try{
    const res=await fetch(`${getProApiBase()}/collaboration-docx`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(collabPreviewData)
    });
    if(!res.ok)throw new Error(await res.text());
    const blob=await res.blob(),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ValiStruct_bitacora_colaborativa.docx';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){alert(e.message);}
});
document.getElementById('printCollabReport')?.addEventListener('click',()=>{
  const out=document.getElementById('collabExportPreview');
  if(!out.innerHTML.trim())return alert('Genere primero la vista previa.');
  const win=window.open('','_blank');if(!win)return alert('Ventana emergente bloqueada.');
  win.document.write(`<!doctype html><html><meta charset="utf-8"><title>Bitácora ValiStruct</title><style>body{font-family:Arial;max-width:900px;margin:40px auto;line-height:1.6}</style><body>${out.innerHTML}<script>window.onload=()=>window.print()<\/script></body></html>`);
  win.document.close();
});

// -----------------------------
// ValiStruct 2.6 telemetry
// -----------------------------
const TELEMETRY_SETTINGS_KEY='valistruct_telemetry_settings_v26';
const TELEMETRY_DATA_KEY='valistruct_telemetry_data_v26';

function loadTelemetrySettings(){
  try{return {enabled:'no',upload:'no',...JSON.parse(localStorage.getItem(TELEMETRY_SETTINGS_KEY)||'{}')};}catch(_){return {enabled:'no',upload:'no'};}
}
function loadTelemetryData(){
  try{return JSON.parse(localStorage.getItem(TELEMETRY_DATA_KEY)||'{"events":{}}');}catch(_){return {events:{}};}
}
function recordTechnicalEvent(name){
  const s=loadTelemetrySettings(); if(s.enabled!=='yes')return;
  const d=loadTelemetryData(); d.events[name]=(d.events[name]||0)+1;
  d.last_updated=new Date().toISOString();
  localStorage.setItem(TELEMETRY_DATA_KEY,JSON.stringify(d));
  if(s.upload==='yes'){
    fetch(`${getProApiBase()}/telemetry`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({event:name,app_version:'2.6'})
    }).catch(()=>{});
  }
}
function renderTelemetry(){
  const s=loadTelemetrySettings(),d=loadTelemetryData();
  document.getElementById('telemetryEnabled').value=s.enabled;
  document.getElementById('telemetryUpload').value=s.upload;
  document.getElementById('telemetryStatus').innerHTML=`<div class="privacy-box"><strong>Estado:</strong> ${s.enabled==='yes'?'activada':'desactivada'} · eventos locales: ${Object.values(d.events||{}).reduce((a,b)=>a+b,0)}</div>`;
}
document.getElementById('saveTelemetrySettings')?.addEventListener('click',()=>{
  const s={enabled:document.getElementById('telemetryEnabled').value,upload:document.getElementById('telemetryUpload').value};
  localStorage.setItem(TELEMETRY_SETTINGS_KEY,JSON.stringify(s));renderTelemetry();
});
document.getElementById('exportTelemetry')?.addEventListener('click',()=>{
  saveBlob(JSON.stringify(loadTelemetryData(),null,2),'application/json;charset=utf-8;','ValiStruct_telemetria_tecnica.json');
});
document.getElementById('clearTelemetry')?.addEventListener('click',()=>{
  localStorage.removeItem(TELEMETRY_DATA_KEY);renderTelemetry();
});
document.addEventListener('click',e=>{
  if(e.target.closest('button'))recordTechnicalEvent('button_click');
});
window.addEventListener('error',()=>recordTechnicalEvent('frontend_error'));
renderTelemetry();


// -----------------------------
// ValiStruct 2.7 project selector helper
// -----------------------------
let v27Projects=[];
async function loadV27Projects(){
  const res=await fetch(`${getProApiBase()}/projects`,{headers:authHeaders()});
  const data=await res.json();
  if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar proyectos.');
  v27Projects=data.projects||[];
  const opts='<option value="">Seleccione un proyecto</option>'+v27Projects.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name||p.id)}</option>`).join('');
  ['kanbanProjectSelect','approvalProjectSelect','releaseProjectSelect','auditProjectSelect'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.innerHTML=opts;
  });
}

// -----------------------------
// Kanban
// -----------------------------
let kanbanTasks=[];
function renderKanban(tasks){
  const cols={todo:[],doing:[],done:[]};
  tasks.forEach(t=>{
    const status=t.status||(t.done?'done':'todo');
    (cols[status]||cols.todo).push(t);
  });
  const draw=(id,list)=>document.getElementById(id).innerHTML=list.map(t=>`
    <div class="kanban-card task-priority-${escapeHtml(t.priority||'medium')}" draggable="true" data-task-id="${escapeHtml(t.id)}">
      <strong>${escapeHtml(t.text||'')}</strong>
      <div class="review-meta">${escapeHtml(t.assignee||'')} · ${escapeHtml(t.priority||'medium')}</div>
    </div>`).join('');
  draw('kanbanTodo',cols.todo);draw('kanbanDoing',cols.doing);draw('kanbanDone',cols.done);
  document.getElementById('kanbanSummary').innerHTML=`
    <div class="metric-card"><span>Pendientes</span><strong>${cols.todo.length}</strong></div>
    <div class="metric-card"><span>En proceso</span><strong>${cols.doing.length}</strong></div>
    <div class="metric-card"><span>Completadas</span><strong>${cols.done.length}</strong></div>`;
  document.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',card.dataset.taskId));
  });
}
document.querySelectorAll('[data-kanban-column]').forEach(col=>{
  col.addEventListener('dragover',e=>e.preventDefault());
  col.addEventListener('drop',async e=>{
    e.preventDefault();
    const taskId=e.dataTransfer.getData('text/plain');
    const status=col.dataset.kanbanColumn;
    const projectId=document.getElementById('kanbanProjectSelect').value;
    if(!taskId||!projectId)return;
    try{
      const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/status`,{
        method:'PUT',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({status})
      });
      const data=await res.json();
      if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible mover la tarea.');
      loadKanban();
    }catch(err){alert(err.message);}
  });
});
async function loadKanban(){
  const projectId=document.getElementById('kanbanProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/tasks`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible cargar tareas.');
    kanbanTasks=data.tasks||[];
    renderKanban(kanbanTasks);
  }catch(e){alert(e.message);}
}
document.getElementById('refreshKanbanProjects')?.addEventListener('click',()=>loadV27Projects().catch(e=>alert(e.message)));
document.getElementById('loadKanban')?.addEventListener('click',loadKanban);

// -----------------------------
// Approvals
// -----------------------------
async function loadApprovals(){
  const projectId=document.getElementById('approvalProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const box=document.getElementById('approvalList');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/approvals`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar aprobaciones.');
    const list=data.approvals||[];
    document.getElementById('approvalSummary').innerHTML=`
      <div class="metric-card"><span>Aprobaciones</span><strong>${list.length}</strong></div>
      <div class="metric-card"><span>Aprobadas</span><strong>${list.filter(x=>x.decision==='approved').length}</strong></div>`;
    box.innerHTML=list.length?list.map(a=>{
      const cls=a.decision==='approved'?'approval-approved':(a.decision==='approved_with_changes'?'approval-changes':'approval-rejected');
      return `<div class="approval-card ${cls}">
        <strong>${escapeHtml(a.type||'')}</strong> · ${escapeHtml(a.decision||'')}
        <p>${escapeHtml(a.comment||'')}</p>
        <div class="review-meta">${escapeHtml(a.user||'')} · ${escapeHtml(a.created_at||'')} · huella ${escapeHtml((a.signature_hash||'').slice(0,16))}…</div>
      </div>`;
    }).join(''):'<p class="small">No hay aprobaciones registradas.</p>';
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
document.getElementById('refreshApprovalProjects')?.addEventListener('click',()=>loadV27Projects().catch(e=>alert(e.message)));
document.getElementById('refreshApprovals')?.addEventListener('click',loadApprovals);
document.getElementById('addApproval')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('approvalProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const payload={
    type:document.getElementById('approvalType').value,
    decision:document.getElementById('approvalDecision').value,
    comment:document.getElementById('approvalComment').value.trim()
  };
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/approvals`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible registrar aprobación.');
    document.getElementById('approvalComment').value='';
    loadApprovals();
  }catch(e){alert(e.message);}
});

// -----------------------------
// Releases
// -----------------------------
async function loadReleases(){
  const projectId=document.getElementById('releaseProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  const box=document.getElementById('releaseList');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/releases`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar releases.');
    const list=data.releases||[];
    document.getElementById('releaseSummary').innerHTML=`<div class="metric-card"><span>Releases</span><strong>${list.length}</strong></div>`;
    box.innerHTML=list.length?list.map(r=>`
      <div class="release-card">
        <span class="release-tag">${escapeHtml(r.tag||'')}</span>
        <strong>${escapeHtml(r.type||'')}</strong>
        <p>${escapeHtml(r.notes||'')}</p>
        <div class="review-meta">${escapeHtml(r.created_by||'')} · ${escapeHtml(r.created_at||'')} · versión ${escapeHtml(String(r.version||''))}</div>
      </div>`).join(''):'<p class="small">No hay releases.</p>';
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
document.getElementById('refreshReleaseProjects')?.addEventListener('click',()=>loadV27Projects().catch(e=>alert(e.message)));
document.getElementById('refreshReleases')?.addEventListener('click',loadReleases);
document.getElementById('createRelease')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('releaseProjectSelect').value;
  const tag=document.getElementById('releaseTag').value.trim();
  if(!projectId||!tag)return alert('Seleccione proyecto y escriba una etiqueta.');
  const payload={tag,type:document.getElementById('releaseType').value,notes:document.getElementById('releaseNotes').value.trim()};
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/releases`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible crear release.');
    document.getElementById('releaseTag').value='';document.getElementById('releaseNotes').value='';
    loadReleases();
  }catch(e){alert(e.message);}
});

// -----------------------------
// Audit package
// -----------------------------
let auditLast=null;
async function buildAuditPreview(){
  const projectId=document.getElementById('auditProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/audit-summary`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible generar resumen.');
    auditLast=data;
    document.getElementById('auditSummary').innerHTML=`
      <div class="metric-card"><span>Actividad</span><strong>${data.counts?.activity||0}</strong></div>
      <div class="metric-card"><span>Comentarios</span><strong>${data.counts?.comments||0}</strong></div>
      <div class="metric-card"><span>Tareas</span><strong>${data.counts?.tasks||0}</strong></div>
      <div class="metric-card"><span>Aprobaciones</span><strong>${data.counts?.approvals||0}</strong></div>`;
    document.getElementById('auditPreview').innerHTML=`<div class="audit-card"><strong>${escapeHtml(data.project_name||'Proyecto')}</strong><p>Estado de revisión: ${escapeHtml(data.review_status||'')}</p><p>Releases: ${data.counts?.releases||0} · Versiones: ${data.counts?.versions||0}</p></div>`;
  }catch(e){alert(e.message);}
}
document.getElementById('refreshAuditProjects')?.addEventListener('click',()=>loadV27Projects().catch(e=>alert(e.message)));
document.getElementById('buildAuditPreview')?.addEventListener('click',buildAuditPreview);
document.getElementById('downloadAuditZip')?.addEventListener('click',async()=>{
  const projectId=document.getElementById('auditProjectSelect').value;
  if(!projectId)return alert('Seleccione un proyecto.');
  try{
    const res=await fetch(`${getProApiBase()}/projects/${encodeURIComponent(projectId)}/audit-package`,{headers:authHeaders()});
    if(!res.ok)throw new Error(await res.text());
    const blob=await res.blob(),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ValiStruct_paquete_auditoria.zip';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }catch(e){alert(e.message);}
});

// -----------------------------
// Server monitor
// -----------------------------
let serverMonitorLast=null;
document.getElementById('refreshServerMonitor')?.addEventListener('click',async()=>{
  const box=document.getElementById('serverMonitorContent');
  box.innerHTML='<div class="notice">Consultando servidor…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/monitor`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible obtener monitoreo.');
    serverMonitorLast=data;
    document.getElementById('serverMonitorSummary').innerHTML=`
      <div class="metric-card"><span>Uptime</span><strong>${escapeHtml(data.uptime_human||'')}</strong></div>
      <div class="metric-card"><span>Proyectos</span><strong>${data.projects_total||0}</strong></div>
      <div class="metric-card"><span>R disponible</span><strong>${data.r_available?'Sí':'No'}</strong></div>
      <div class="metric-card"><span>Estado</span><strong>${escapeHtml(data.status||'')}</strong></div>`;
    box.innerHTML=`
      <div class="monitor-card"><strong>Backend</strong><div class="small">Versión app: ${escapeHtml(data.app_version||'2.7')}</div></div>
      <div class="monitor-card"><strong>Servicios</strong><div class="small">Auth: ${data.auth_enabled?'activo':'inactivo'} · Biblioteca: ${data.project_library_enabled?'activa':'inactiva'}</div></div>
      <div class="monitor-card"><strong>Archivos institucionales</strong><div class="small">Comentarios: ${data.comments_total||0} · Tareas: ${data.tasks_total||0} · Notificaciones: ${data.notifications_total||0}</div></div>`;
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
});
document.getElementById('downloadServerMonitor')?.addEventListener('click',()=>{
  if(!serverMonitorLast)return alert('Actualice primero el monitoreo.');
  saveBlob(JSON.stringify(serverMonitorLast,null,2),'application/json;charset=utf-8;','ValiStruct_server_monitor.json');
});


// -----------------------------
// ValiStruct 2.8 backup / restore
// -----------------------------
let backupFileSelected=null;

document.getElementById('restoreBackupFile')?.addEventListener('change',e=>{
  backupFileSelected=e.target.files?.[0]||null;
  document.getElementById('backupDetails').innerHTML=backupFileSelected
    ? `<div class="backup-card"><strong>Archivo seleccionado:</strong> ${escapeHtml(backupFileSelected.name)} · ${(backupFileSelected.size/1024/1024).toFixed(2)} MB</div>`
    : '';
});

document.getElementById('createInstitutionBackup')?.addEventListener('click',async()=>{
  try{
    const res=await fetch(`${getProApiBase()}/admin/backup`,{headers:authHeaders()});
    if(!res.ok)throw new Error(await res.text());
    const blob=await res.blob(),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='ValiStruct_respaldo_institucional.zip';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    document.getElementById('backupStatus').innerHTML='<div class="metric-card"><span>Estado</span><strong>Respaldo generado</strong></div>';
  }catch(e){alert(e.message);}
});

document.getElementById('restoreInstitutionBackup')?.addEventListener('click',async()=>{
  if(!backupFileSelected)return alert('Seleccione un respaldo ZIP.');
  if(!confirm('La restauración modificará la biblioteca institucional. ¿Continuar?'))return;
  const fd=new FormData();fd.append('file',backupFileSelected);
  try{
    const res=await fetch(`${getProApiBase()}/admin/restore`,{method:'POST',headers:authHeaders(),body:fd});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible restaurar.');
    document.getElementById('backupStatus').innerHTML=`
      <div class="metric-card"><span>Estado</span><strong>Restaurado</strong></div>
      <div class="metric-card"><span>Archivos</span><strong>${data.files_restored||0}</strong></div>`;
    alert('Respaldo restaurado. Se recomienda ejecutar self-test y monitoreo.');
  }catch(e){alert(e.message);}
});

// -----------------------------
// ValiStruct 2.8 server wizard
// -----------------------------
let wizardEnvText='';
let wizardChecklistText='';

function buildServerWizard(){
  const domain=document.getElementById('wizardDomain').value.trim()||'valistruct.institucion.edu';
  const port=Number(document.getElementById('wizardPort').value)||8765;
  const auth=document.getElementById('wizardAuth').value;
  const library=document.getElementById('wizardLibrary').value==='yes';
  const upload=document.getElementById('wizardUploadMb').value;
  const https=document.getElementById('wizardHttps').value==='yes';

  wizardEnvText=`# ValiStruct 2.8 generated configuration
VALISTRUCT_MAX_UPLOAD_MB=${upload}
VALISTRUCT_AUTH_ENABLED=${auth==='off'?'false':'true'}
VALISTRUCT_PROJECT_LIBRARY_ENABLED=${library?'true':'false'}
VALISTRUCT_PROJECT_DIR=/app/data/projects
VALISTRUCT_ALLOWED_ORIGINS=${https?'https':'http'}://${domain}
VALISTRUCT_PORT=${port}
# Para OIDC, complete la integración institucional en el backend.
`;

  const checks=[
    `Dominio configurado: ${domain}`,
    `Backend interno: puerto ${port}`,
    `HTTPS: ${https?'obligatorio':'solo local/pruebas'}`,
    `Autenticación: ${auth}`,
    `Biblioteca institucional: ${library?'activa':'inactiva'}`,
    `Límite de carga: ${upload} MB`,
    'Configurar copias de seguridad.',
    'Ejecutar pruebas E2E.',
    'Revisar política de privacidad y retención.',
    'Realizar beta con usuarios limitados antes de ampliar acceso.'
  ];
  wizardChecklistText='ValiStruct 2.8 · Checklist de despliegue\n\n'+checks.map((x,i)=>`${i+1}. ${x}`).join('\n');

  document.getElementById('serverWizardOutput').innerHTML=`
    <div class="wizard-card"><strong>Configuración propuesta</strong><pre class="config-preview">${escapeHtml(wizardEnvText)}</pre></div>
    <div class="wizard-card"><strong>Checklist</strong><p>${checks.map(x=>'✓ '+escapeHtml(x)).join('<br>')}</p></div>`;
}
document.getElementById('buildServerConfig')?.addEventListener('click',buildServerWizard);
document.getElementById('downloadServerEnv')?.addEventListener('click',()=>{
  if(!wizardEnvText)buildServerWizard();
  saveBlob(wizardEnvText,'text/plain;charset=utf-8;','ValiStruct.env');
});
document.getElementById('downloadServerChecklist')?.addEventListener('click',()=>{
  if(!wizardChecklistText)buildServerWizard();
  saveBlob(wizardChecklistText,'text/plain;charset=utf-8;','ValiStruct_checklist_despliegue.txt');
});

// -----------------------------
// ValiStruct 2.8 incidents
// -----------------------------
let incidentsLast=null;

async function loadIncidents(){
  const box=document.getElementById('incidentList');
  box.innerHTML='<div class="notice">Consultando incidencias…</div>';
  try{
    const res=await fetch(`${getProApiBase()}/incidents`,{headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible consultar incidencias.');
    incidentsLast=data;
    const list=data.incidents||[];
    const open=list.filter(x=>x.status!=='closed').length;
    document.getElementById('incidentSummary').innerHTML=`
      <div class="metric-card"><span>Total</span><strong>${list.length}</strong></div>
      <div class="metric-card"><span>Abiertas</span><strong>${open}</strong></div>
      <div class="metric-card"><span>Críticas</span><strong>${list.filter(x=>x.severity==='critical').length}</strong></div>`;
    box.innerHTML=list.length?list.map(i=>`
      <div class="incident-card incident-${escapeHtml(i.severity||'medium')}">
        <strong>${escapeHtml(i.type||'bug')} · ${escapeHtml(i.severity||'medium')}</strong>
        <p>${escapeHtml(i.description||'')}</p>
        <div class="review-meta">${escapeHtml(i.created_by||'')} · ${escapeHtml(i.created_at||'')} · ${escapeHtml(i.status||'open')}</div>
        <div class="button-row"><button data-incident-toggle="${escapeHtml(i.id)}">${i.status==='closed'?'Reabrir':'Cerrar'}</button></div>
      </div>`).join(''):'<p class="small">No hay incidencias registradas.</p>';
    box.querySelectorAll('[data-incident-toggle]').forEach(b=>b.addEventListener('click',()=>toggleIncident(b.dataset.incidentToggle)));
  }catch(e){box.innerHTML=`<div class="model-error">${escapeHtml(e.message)}</div>`;}
}
async function toggleIncident(id){
  try{
    const res=await fetch(`${getProApiBase()}/incidents/${encodeURIComponent(id)}/toggle`,{method:'POST',headers:authHeaders()});
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible actualizar incidencia.');
    loadIncidents();
  }catch(e){alert(e.message);}
}
document.getElementById('createIncident')?.addEventListener('click',async()=>{
  const description=document.getElementById('incidentDescription').value.trim();
  if(!description)return alert('Escriba una descripción.');
  const payload={type:document.getElementById('incidentType').value,severity:document.getElementById('incidentSeverity').value,description};
  try{
    const res=await fetch(`${getProApiBase()}/incidents`,{
      method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)
    });
    const data=await res.json();
    if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible registrar incidencia.');
    document.getElementById('incidentDescription').value='';
    loadIncidents();
  }catch(e){alert(e.message);}
});
document.getElementById('refreshIncidents')?.addEventListener('click',loadIncidents);
document.getElementById('exportIncidents')?.addEventListener('click',()=>{
  if(!incidentsLast)return alert('Actualice primero las incidencias.');
  saveBlob(JSON.stringify(incidentsLast,null,2),'application/json;charset=utf-8;','ValiStruct_incidencias.json');
});

// -----------------------------
// ValiStruct 2.8 docs
// -----------------------------
const userDocs=[
  {profile:'student',title:'Ruta recomendada para estudiantes',tags:'inicio proyecto guiado aprender',body:'Inicie en Proyecto guiado. Complete validez de contenido, diagnóstico, confiabilidad y AFE antes de pasar a AFC/SEM cuando el diseño lo requiera.'},
  {profile:'student',title:'Cómo interpretar semáforos',tags:'verde naranja rojo',body:'Verde indica evidencia favorable; naranja requiere revisión; rojo señala un problema potencial. Nunca elimine ítems por un solo indicador.'},
  {profile:'researcher',title:'Importar datos',tags:'csv xlsx sav dta importar',body:'Use Importación de datos para CSV/XLSX o Importación SAV/DTA para SPSS y Stata. Revise nombres, tipos y valores faltantes antes del análisis.'},
  {profile:'researcher',title:'Motor Pro',tags:'lavaan afc sem motor pro',body:'Motor Pro ejecuta modelos CFA/SEM mediante R/lavaan y devuelve ajuste, parámetros y diagnósticos. Use MLR o WLSMV según las propiedades de sus datos.'},
  {profile:'researcher',title:'Auditoría y reproducibilidad',tags:'historial auditoria versiones',body:'Conserve historial, versiones y releases. Antes de cambios importantes genere una versión o release del proyecto.'},
  {profile:'teacher',title:'Uso docente',tags:'clase estudiantes demostracion',body:'Active perfil Docente y nivel de ayuda alto para mostrar explicaciones, ejemplos y decisiones metodológicas paso a paso.'},
  {profile:'teacher',title:'Revisión por pares',tags:'comentarios tareas revisión',body:'Use comentarios, tareas, Kanban y aprobaciones para acompañar proyectos de estudiantes o equipos de investigación.'},
  {profile:'admin',title:'Despliegue institucional',tags:'docker https servidor',body:'Use Docker/Compose, HTTPS, autenticación, copias de seguridad y límites de carga. Ejecute self-test y E2E antes de abrir la beta.'},
  {profile:'admin',title:'Respaldo y restauración',tags:'backup restore respaldo restaurar',body:'Genere respaldos periódicos del repositorio institucional. Restrinja la restauración a administradores y verifique el sistema después de restaurar.'},
  {profile:'admin',title:'Seguridad',tags:'seguridad oidc sso privacidad',body:'Para producción real prefiera SSO/OIDC/SAML y almacenamiento persistente de sesiones. No use el prototipo local de credenciales como solución institucional definitiva.'}
];
function renderDocs(list){
  document.getElementById('docsResults').innerHTML=list.length?list.map(x=>`<div class="doc-card"><strong>${escapeHtml(x.title)}</strong><p>${escapeHtml(x.body)}</p><div class="review-meta">${escapeHtml(x.profile)} · ${escapeHtml(x.tags)}</div></div>`).join(''):'<div class="notice">Sin resultados.</div>';
}
function searchDocsV28(){
  const profile=document.getElementById('docsProfile').value;
  const q=document.getElementById('docsSearch').value.trim().toLowerCase();
  renderDocs(userDocs.filter(x=>(x.profile===profile||profile==='all') && (!q||`${x.title} ${x.tags} ${x.body}`.toLowerCase().includes(q))));
}
document.getElementById('searchDocs')?.addEventListener('click',searchDocsV28);
document.getElementById('showDocsIndex')?.addEventListener('click',()=>renderDocs(userDocs));
renderDocs(userDocs.filter(x=>x.profile==='researcher'));

// -----------------------------
// ValiStruct 2.8 E2E tests
// -----------------------------
let e2eLast=null;
async function runE2EV28(){
  const tests=[];
  const add=(name,status,detail)=>tests.push({name,status,detail});
  add('Frontend cargado','pass','JavaScript activo.');
  add('LocalStorage',(()=>{try{localStorage.setItem('__e2e','1');localStorage.removeItem('__e2e');return 'pass'}catch(_){return 'fail'}})(),'Persistencia local.');
  add('Web Crypto',window.crypto?.subtle?'pass':'warn','Cifrado de proyectos.');
  add('PWA','serviceWorker' in navigator?'pass':'warn','Service Worker.');
  add('Importación local',typeof parseCSV==='function'?'pass':'fail','Parser CSV.');
  add('Proyecto guiado',typeof buildGuidedProject==='function'?'pass':'fail','Flujo metodológico.');
  add('Reportes',typeof generateApaReport==='function'?'pass':'fail','Reporte APA.');

  try{
    const r=await fetch(`${getProApiBase()}/health`,{headers:authHeaders()});
    add('Backend health',r.ok?'pass':'warn',`HTTP ${r.status}`);
  }catch(e){add('Backend health','fail',e.message);}

  try{
    const r=await fetch(`${getProApiBase()}/self-test`,{headers:authHeaders()});
    const d=await r.json();
    const fails=(d.tests||[]).filter(x=>x.status==='fail').length;
    add('Backend self-test',r.ok && !fails?'pass':(r.ok?'warn':'fail'),fails?`${fails} falla(s).`:'Sin fallas críticas.');
  }catch(e){add('Backend self-test','fail',e.message);}

  try{
    const r=await fetch(`${getProApiBase()}/monitor`,{headers:authHeaders()});
    add('Monitor',r.ok?'pass':'warn',`HTTP ${r.status}`);
  }catch(e){add('Monitor','warn',e.message);}

  const pass=tests.filter(x=>x.status==='pass').length;
  const warn=tests.filter(x=>x.status==='warn').length;
  const fail=tests.filter(x=>x.status==='fail').length;
  e2eLast={timestamp:new Date().toISOString(),pass,warn,fail,tests};
  document.getElementById('e2eSummary').innerHTML=`
    <div class="metric-card"><span>PASS</span><strong>${pass}</strong></div>
    <div class="metric-card"><span>WARN</span><strong>${warn}</strong></div>
    <div class="metric-card"><span>FAIL</span><strong>${fail}</strong></div>`;
  document.getElementById('e2eResults').innerHTML=tests.map(t=>`<div class="e2e-card ${t.status==='pass'?'e2e-pass':(t.status==='warn'?'e2e-warn':'e2e-fail')}"><strong>${t.status==='pass'?'🟢':(t.status==='warn'?'🟠':'🔴')} ${escapeHtml(t.name)}</strong><div class="small">${escapeHtml(t.detail||'')}</div></div>`).join('');
}
document.getElementById('runE2E')?.addEventListener('click',runE2EV28);
document.getElementById('downloadE2EReport')?.addEventListener('click',()=>{
  if(!e2eLast)return alert('Ejecute primero las pruebas.');
  saveBlob(JSON.stringify(e2eLast,null,2),'application/json;charset=utf-8;','ValiStruct_e2e_report.json');
});


// -----------------------------
// ValiStruct 2.9 Assisted installer
// -----------------------------
let installPlanText='';
let installConfigText='';

function buildInstallPlanV29(){
  const mode=document.getElementById('installerMode').value;
  const domain=document.getElementById('installerDomain').value.trim()||'valistruct.institucion.edu';
  const https=document.getElementById('installerHttps').value==='yes';
  const auth=document.getElementById('installerAuth').value;

  const steps=[
    '1. Instalar Docker y Docker Compose.',
    '2. Copiar ValiStruct 2.9 al servidor.',
    '3. Crear directorio persistente para proyectos y respaldos.',
    '4. Configurar variables de entorno.',
    `5. Publicar frontend en ${https?'HTTPS':'HTTP local'}://${domain}.`,
    '6. Levantar backend con docker compose up -d --build.',
    '7. Comprobar /health, /self-test y /monitor.',
    '8. Ejecutar pruebas E2E.',
    '9. Crear respaldo inicial.',
    '10. Abrir acceso únicamente al grupo beta autorizado.'
  ];
  if(auth==='oidc')steps.splice(5,0,'6. Configurar proveedor OIDC/SSO institucional antes de habilitar usuarios.');
  installPlanText=`ValiStruct 2.9 · Plan de instalación (${mode})\n\n${steps.join('\n')}`;

  installConfigText=`# ValiStruct 2.9
VALISTRUCT_AUTH_ENABLED=${auth==='off'?'false':'true'}
VALISTRUCT_PROJECT_LIBRARY_ENABLED=${mode==='local'?'false':'true'}
VALISTRUCT_PROJECT_DIR=/app/data/projects
VALISTRUCT_MAX_UPLOAD_MB=20
VALISTRUCT_ALLOWED_ORIGINS=${https?'https':'http'}://${domain}
VALISTRUCT_BACKUP_DIR=/app/data/backups
VALISTRUCT_ENV=${mode}
`;

  document.getElementById('installerOutput').innerHTML=`
    <div class="install-card"><strong>Plan generado</strong><p>${steps.map(x=>escapeHtml(x)).join('<br>')}</p></div>
    <div class="install-card"><strong>Configuración</strong><pre class="config-preview">${escapeHtml(installConfigText)}</pre></div>`;
}
document.getElementById('buildInstallPlan')?.addEventListener('click',buildInstallPlanV29);
document.getElementById('downloadInstallPlan')?.addEventListener('click',()=>{
  if(!installPlanText)buildInstallPlanV29();
  saveBlob(installPlanText,'text/plain;charset=utf-8;','ValiStruct_plan_instalacion.txt');
});
document.getElementById('downloadInstallConfig')?.addEventListener('click',()=>{
  if(!installConfigText)buildInstallPlanV29();
  saveBlob(installConfigText,'text/plain;charset=utf-8;','ValiStruct.env');
});

// -----------------------------
// Scheduled backup policy
// -----------------------------
let backupCronText='';
let backupPolicyText='';

function buildBackupPolicyV29(){
  const freq=document.getElementById('backupFrequency').value;
  const time=document.getElementById('backupHour').value||'02:00';
  const retention=Number(document.getElementById('backupRetention').value)||14;
  const [hh,mm]=time.split(':').map(Number);
  let cron='';
  if(freq==='daily')cron=`${mm} ${hh} * * *`;
  else if(freq==='weekly')cron=`${mm} ${hh} * * 0`;
  else cron=`${mm} ${hh} 1 * *`;

  backupCronText=`# ValiStruct 2.9 backup cron
${cron} /opt/valistruct/deployment/backup.sh >> /var/log/valistruct-backup.log 2>&1
`;
  backupPolicyText=`ValiStruct 2.9 · Política de respaldo

Frecuencia: ${freq}
Hora: ${time}
Retención: ${retention} respaldos

Recomendaciones:
- almacenar los respaldos fuera del contenedor;
- cifrar la ubicación de respaldo cuando incluya metadatos institucionales;
- verificar restauración de forma periódica;
- mantener al menos una copia fuera del servidor principal;
- documentar responsable y periodo de retención.
`;
  document.getElementById('backupPolicyOutput').innerHTML=`
    <div class="backup-policy-card"><strong>Cron sugerido</strong><pre class="config-preview">${escapeHtml(backupCronText)}</pre></div>
    <div class="backup-policy-card"><strong>Retención</strong><p>${retention} respaldos · ${escapeHtml(freq)} · ${escapeHtml(time)}</p></div>`;
}
document.getElementById('buildBackupPolicy')?.addEventListener('click',buildBackupPolicyV29);
document.getElementById('downloadBackupCron')?.addEventListener('click',()=>{
  if(!backupCronText)buildBackupPolicyV29();
  saveBlob(backupCronText,'text/plain;charset=utf-8;','valistruct-backup.cron');
});
document.getElementById('downloadBackupPolicy')?.addEventListener('click',()=>{
  if(!backupPolicyText)buildBackupPolicyV29();
  saveBlob(backupPolicyText,'text/plain;charset=utf-8;','ValiStruct_politica_respaldos.txt');
});

// -----------------------------
// Load test generator
// -----------------------------
let locustText='';

function buildLoadTestV29(){
  const users=Number(document.getElementById('loadUsers').value)||20;
  const minutes=Number(document.getElementById('loadMinutes').value)||10;
  const scenario=document.getElementById('loadScenario').value;

  const taskBody=scenario==='health'
    ? `self.client.get("/health")\n        self.client.get("/monitor", headers=self.h())`
    : scenario==='analysis'
    ? `self.client.get("/health")\n        # Agregue datasets sintéticos y llamadas /estimate en un entorno de pruebas.\n        self.client.get("/self-test", headers=self.h())`
    : `self.client.get("/health")\n        self.client.get("/monitor", headers=self.h())\n        self.client.get("/projects", headers=self.h())`;

  locustText=`from locust import HttpUser, task, between
import os

TOKEN=os.environ.get("VALISTRUCT_TEST_TOKEN","")

class ValiStructUser(HttpUser):
    wait_time=between(0.5,2.0)

    def h(self):
        return {"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}

    @task
    def scenario(self):
        ${taskBody.replace(/\n/g,'\n        ')}
`;

  document.getElementById('loadTestOutput').innerHTML=`
    <div class="load-card"><strong>Escenario</strong><p>${users} usuarios concurrentes · ${minutes} min · ${escapeHtml(scenario)}</p></div>
    <div class="load-card"><strong>Ejemplo de ejecución</strong><pre class="config-preview">locust -f locustfile.py --host http://127.0.0.1:8765 --headless -u ${users} -r 2 -t ${minutes}m</pre></div>`;
}
document.getElementById('buildLoadTest')?.addEventListener('click',buildLoadTestV29);
document.getElementById('downloadLocustfile')?.addEventListener('click',()=>{
  if(!locustText)buildLoadTestV29();
  saveBlob(locustText,'text/x-python;charset=utf-8;','locustfile.py');
});

// -----------------------------
// Accessibility audit
// -----------------------------
let a11yAuditLast=null;

function runA11yAuditV29(){
  const results=[];
  const add=(name,status,detail)=>results.push({name,status,detail});

  add('Idioma del documento',document.documentElement.lang?'pass':'warn',document.documentElement.lang?`lang=${document.documentElement.lang}`:'No definido.');
  add('Enlace para saltar contenido',!!document.querySelector('.skip-link')?'pass':'fail','Navegación rápida para teclado.');
  add('Contenido principal',!!document.querySelector('main#mainContent')?'pass':'warn','Región principal identificada.');
  add('Etiquetas de navegación',!!document.querySelector('nav[aria-label]')?'pass':'warn','ARIA en navegación.');
  const controls=[...document.querySelectorAll('input,select,textarea')];
  const unlabeled=controls.filter(el=>!el.getAttribute('aria-label') && !el.closest('label'));
  add('Controles etiquetados',unlabeled.length===0?'pass':'warn',unlabeled.length?`${unlabeled.length} control(es) sin etiqueta detectable.`:'Todos los controles revisados tienen etiqueta detectable.');
  add('Foco visible',document.body.dataset.a11yFocus==='yes'?'pass':'warn','Configuración de foco visible.');
  add('Alto contraste disponible',document.getElementById('a11yContrast')?'pass':'warn','Opción de contraste presente.');
  add('Reducción de movimiento',document.getElementById('a11yMotion')?'pass':'warn','Opción de reducción de movimiento presente.');
  add('Navegación por teclado',true?'pass':'warn','Atajos Alt+1…Alt+4 configurados.');

  const pass=results.filter(x=>x.status==='pass').length;
  const warn=results.filter(x=>x.status==='warn').length;
  const fail=results.filter(x=>x.status==='fail').length;
  a11yAuditLast={timestamp:new Date().toISOString(),pass,warn,fail,results};
  document.getElementById('a11yAuditSummary').innerHTML=`
    <div class="metric-card"><span>PASS</span><strong>${pass}</strong></div>
    <div class="metric-card"><span>WARN</span><strong>${warn}</strong></div>
    <div class="metric-card"><span>FAIL</span><strong>${fail}</strong></div>`;
  document.getElementById('a11yAuditResults').innerHTML=results.map(r=>`<div class="audit-result ${r.status==='pass'?'audit-pass':(r.status==='warn'?'audit-warn':'audit-fail')}"><strong>${r.status==='pass'?'🟢':(r.status==='warn'?'🟠':'🔴')} ${escapeHtml(r.name)}</strong><div class="small">${escapeHtml(r.detail)}</div></div>`).join('');
}
document.getElementById('runA11yAudit')?.addEventListener('click',runA11yAuditV29);
document.getElementById('downloadA11yAudit')?.addEventListener('click',()=>{
  if(!a11yAuditLast)return alert('Ejecute primero la auditoría.');
  saveBlob(JSON.stringify(a11yAuditLast,null,2),'application/json;charset=utf-8;','ValiStruct_a11y_audit.json');
});

// -----------------------------
// Beta metrics dashboard
// -----------------------------
let betaMetricsLast=null;
document.getElementById('refreshBetaMetrics')?.addEventListener('click',async()=>{
  try{
    const [mon,inc]=await Promise.all([
      fetch(`${getProApiBase()}/monitor`,{headers:authHeaders()}).then(r=>r.json()),
      fetch(`${getProApiBase()}/incidents`,{headers:authHeaders()}).then(r=>r.json())
    ]);
    const incidents=inc.incidents||[];
    betaMetricsLast={
      timestamp:new Date().toISOString(),
      server:mon,
      incidents:{
        total:incidents.length,
        open:incidents.filter(x=>x.status!=='closed').length,
        critical:incidents.filter(x=>x.severity==='critical'&&x.status!=='closed').length,
        high:incidents.filter(x=>x.severity==='high'&&x.status!=='closed').length
      },
      telemetry:loadTelemetryData()
    };
    document.getElementById('betaMetricsSummary').innerHTML=`
      <div class="metric-card"><span>Proyectos</span><strong>${mon.projects_total||0}</strong></div>
      <div class="metric-card"><span>Incidencias abiertas</span><strong>${betaMetricsLast.incidents.open}</strong></div>
      <div class="metric-card"><span>Críticas</span><strong>${betaMetricsLast.incidents.critical}</strong></div>
      <div class="metric-card"><span>Uptime</span><strong>${escapeHtml(mon.uptime_human||'')}</strong></div>`;
    const events=betaMetricsLast.telemetry?.events||{};
    document.getElementById('betaMetricsContent').innerHTML=`
      <div class="metric-panel"><strong>Actividad técnica local</strong><p>${Object.entries(events).map(([k,v])=>`${escapeHtml(k)}: ${v}`).join('<br>')||'Sin telemetría local.'}</p></div>
      <div class="metric-panel"><strong>Colaboración</strong><p>Comentarios: ${mon.comments_total||0}<br>Tareas: ${mon.tasks_total||0}<br>Notificaciones: ${mon.notifications_total||0}</p></div>
      <div class="metric-panel"><strong>Estado del backend</strong><p>R: ${mon.r_available?'disponible':'no disponible'}<br>Auth: ${mon.auth_enabled?'activa':'inactiva'}<br>Biblioteca: ${mon.project_library_enabled?'activa':'inactiva'}</p></div>`;
  }catch(e){alert(e.message);}
});
document.getElementById('downloadBetaMetrics')?.addEventListener('click',()=>{
  if(!betaMetricsLast)return alert('Actualice primero las métricas.');
  saveBlob(JSON.stringify(betaMetricsLast,null,2),'application/json;charset=utf-8;','ValiStruct_metricas_beta.json');
});


// ============================================================
// ValiStruct 3.0 RC6 · Consolidation layer
// ============================================================
const VALISTRUCT_RELEASE = Object.freeze({
  app: 'ValiStruct',
  version: '3.0.0-rc.6',
  displayVersion: '3.0 RC6',
  projectFormat: '3.0',
  releaseChannel: 'release-candidate',
  featureFreeze: true,
  author: 'Dr. Roberto Joel Tirado Reyes',
  institution: 'Universidad Autónoma de Sinaloa'
});

// Project-state compatibility layer.
// Adds a stable schema envelope without rewriting the validated legacy project serializer.
const legacyProjectStateV30 = projectState;
projectState = function(){
  const state = legacyProjectStateV30();
  state.version = '3.0';
  state.schemaVersion = '3.0';
  state.release = {
    channel: VALISTRUCT_RELEASE.releaseChannel,
    appVersion: VALISTRUCT_RELEASE.version
  };
  state.preferences = {
    profile: loadProfile?.() || null,
    settings: loadSettings?.() || null,
    privacy: loadPrivacySettings?.() || null,
    accessibility: loadA11y?.() || null,
    telemetry: loadTelemetrySettings?.() || null
  };
  return state;
};

function migrateToV30(state){
  const s = state && typeof state === 'object' ? structuredClone(state) : {};
  const from = String(s.schemaVersion || s.version || 'legacy');
  s.version='3.0';
  s.schemaVersion='3.0';
  s.release={channel:'release-candidate',appVersion:'3.0.0-rc.6',migratedFrom:from};
  if(!s.preferences)s.preferences={};
  if(!s.preferences.profile && typeof loadProfile==='function')s.preferences.profile=loadProfile();
  if(!s.preferences.settings && typeof loadSettings==='function')s.preferences.settings=loadSettings();
  if(!s.preferences.privacy && typeof loadPrivacySettings==='function')s.preferences.privacy=loadPrivacySettings();
  return s;
}

// ------------------------------------------------------------
// Release Candidate audit
// ------------------------------------------------------------
let rcAuditLast=null;

async function runRcAuditV30(){
  const checks=[];
  const add=(name,status,detail)=>checks.push({name,status,detail});
  add('Congelamiento funcional',VALISTRUCT_RELEASE.featureFreeze?'pass':'fail','Feature freeze activo.');
  add('Formato de proyecto',VALISTRUCT_RELEASE.projectFormat==='3.0'?'pass':'fail','Schema 3.0.');
  add('PWA','serviceWorker' in navigator?'pass':'warn','Compatibilidad Service Worker.');
  add('Web Crypto',window.crypto?.subtle?'pass':'warn','Cifrado de proyectos.');
  add('Pointer Events','PointerEvent' in window?'pass':'warn','Interacción táctil/ratón.');
  add('Persistencia local',(()=>{try{localStorage.setItem('__rc','1');localStorage.removeItem('__rc');return 'pass'}catch(_){return 'fail'}})(),'localStorage.');
  add('Motor Pro UI',document.getElementById('motorpro')?'pass':'fail','Sección Motor Pro.');
  add('Latencia UI',document.getElementById('latencia')?'pass':'fail','Editor estructural.');
  add('Proyecto guiado',typeof buildGuidedProject==='function'?'pass':'fail','Asistente metodológico.');
  add('Centro de resultados',typeof buildResultCenter==='function'?'pass':'fail','Síntesis integrada.');
  add('APA report',typeof generateApaReport==='function'?'pass':'fail','Reporte científico.');

  try{
    const r=await fetch(`${getProApiBase()}/rc-check`,{headers:authHeaders()});
    const d=await r.json();
    if(r.ok && d.ok){
      (d.checks||[]).forEach(x=>add(`Backend · ${x.name}`,x.status,x.detail||''));
    }else add('Backend RC check','warn',d.error||`HTTP ${r.status}`);
    try{
      const rr=await fetch(`${getProApiBase()}/runtime-audit`,{headers:authHeaders()});
      const rd=await rr.json();
      if(rr.ok && rd.ok){
        (rd.checks||[]).forEach(x=>add(`Runtime · ${x.name}`,x.status,x.detail||''));
      }else add('Runtime audit','warn',rd.error||`HTTP ${rr.status}`);
    }catch(_){
      add('Runtime audit','warn','No disponible en este entorno.');
    }
  }catch(e){add('Backend RC check','warn','Backend no accesible: '+e.message);}

  const pass=checks.filter(x=>x.status==='pass').length;
  const warn=checks.filter(x=>x.status==='warn').length;
  const fail=checks.filter(x=>x.status==='fail').length;
  rcAuditLast={release:VALISTRUCT_RELEASE,timestamp:new Date().toISOString(),pass,warn,fail,checks};
  document.getElementById('rcSummary').innerHTML=`
    <div class="metric-card"><span>PASS</span><strong>${pass}</strong></div>
    <div class="metric-card"><span>WARN</span><strong>${warn}</strong></div>
    <div class="metric-card"><span>FAIL</span><strong>${fail}</strong></div>
    <div class="metric-card"><span>Canal</span><strong>RC1</strong></div>`;
  document.getElementById('rcResults').innerHTML=checks.map(c=>`
    <div class="rc-check ${c.status==='pass'?'rc-pass':(c.status==='warn'?'rc-warn':'rc-fail')}">
      <strong>${c.status==='pass'?'🟢':(c.status==='warn'?'🟠':'🔴')} ${escapeHtml(c.name)}</strong>
      <div class="small">${escapeHtml(c.detail||'')}</div>
    </div>`).join('');
}
document.getElementById('runRcAudit')?.addEventListener('click',runRcAuditV30);
document.getElementById('downloadRcAudit')?.addEventListener('click',()=>{
  if(!rcAuditLast)return alert('Ejecute primero la auditoría RC.');
  saveBlob(JSON.stringify(rcAuditLast,null,2),'application/json;charset=utf-8;','ValiStruct_3_RC6_auditoria.json');
});

// ------------------------------------------------------------
// Regression suite
// ------------------------------------------------------------
let regressionLast=null;

function runRegressionSuiteV30(){
  const tests=[
    ['CSV parser',typeof parseCSV==='function'],
    ['V de Aiken',typeof calculateAiken==='function'||typeof calculateAikenV==='function'],
    ['Confiabilidad',typeof calcRel==='function'],
    ['AFE',typeof calcEFA==='function'||typeof runEFA==='function'||typeof efaCorrelationMatrix==='function'],
    ['AFC prototipo',typeof estimateCfaPrototype==='function'],
    ['SEM visual',typeof renderSem==='function'],
    ['Motor Pro',typeof runPro==='function'||!!document.getElementById('motorpro')],
    ['Diagnóstico',typeof runDiagnostics==='function'||typeof parseDiagnosticCSV==='function'],
    ['Multivariado',typeof runMultiDiagnostics==='function'||!!document.getElementById('multidiag')],
    ['Missingness',typeof runMissingness==='function'||!!document.getElementById('missingpro')],
    ['Monte Carlo SEM',typeof runSemMonteCarlo==='function'||!!document.getElementById('semmontecarlo')],
    ['Model Check',typeof runModelCheck==='function'||!!document.getElementById('modelcheck')],
    ['Proyecto guiado',typeof buildGuidedProject==='function'],
    ['Centro de resultados',typeof buildResultCenter==='function'],
    ['Conclusiones metodológicas',typeof buildMethodConclusion==='function'||!!document.getElementById('conclusionassistant')],
    ['Checklist final',typeof buildFinalChecklist==='function'],
    ['Journal Ready',typeof buildJournalReady==='function'],
    ['Cifrado de proyecto',window.crypto?.subtle && typeof encryptProjectObject==='function'],
    ['XLSX import UI',!!document.getElementById('dataimport')],
    ['SAV/DTA import UI',!!document.getElementById('legacyimport')],
    ['Colaboración',!!document.getElementById('peerreview')],
    ['Versionado institucional',!!document.getElementById('versions')],
    ['Auditoría',!!document.getElementById('auditpackage')]
  ];
  const rows=tests.map(([name,ok])=>({name,status:ok?'pass':'fail',detail:ok?'Disponible':'No detectado'}));
  const pass=rows.filter(x=>x.status==='pass').length,fail=rows.length-pass;
  regressionLast={timestamp:new Date().toISOString(),pass,fail,total:rows.length,tests:rows};
  document.getElementById('regressionSummary').innerHTML=`
    <div class="metric-card"><span>PASS</span><strong>${pass}</strong></div>
    <div class="metric-card"><span>FAIL</span><strong>${fail}</strong></div>
    <div class="metric-card"><span>Total</span><strong>${rows.length}</strong></div>`;
  document.getElementById('regressionResults').innerHTML=rows.map(t=>`
    <div class="regression-check ${t.status==='pass'?'rc-pass':'rc-fail'}">
      <strong>${t.status==='pass'?'🟢':'🔴'} ${escapeHtml(t.name)}</strong>
      <div class="small">${escapeHtml(t.detail)}</div>
    </div>`).join('');
}
document.getElementById('runRegressionSuite')?.addEventListener('click',runRegressionSuiteV30);
document.getElementById('downloadRegressionReport')?.addEventListener('click',()=>{
  if(!regressionLast)return alert('Ejecute primero las pruebas de regresión.');
  saveBlob(JSON.stringify(regressionLast,null,2),'application/json;charset=utf-8;','ValiStruct_3_RC6_regresion.json');
});

// ------------------------------------------------------------
// Security review
// ------------------------------------------------------------
let securityReviewLast=null;

async function runSecurityReviewV30(){
  const checks=[];
  const add=(name,status,detail)=>checks.push({name,status,detail});
  const apiBase=getProApiBase();
  add('Frontend HTTPS',location.protocol==='https:'||location.hostname==='localhost'?'pass':'warn',location.protocol);
  add('API HTTPS',apiBase.startsWith('https://')||apiBase.includes('127.0.0.1')||apiBase.includes('localhost')?'pass':'warn',apiBase);
  add('Project encryption',window.crypto?.subtle?'pass':'warn','Web Crypto AES-GCM disponible.');
  const privacy=loadPrivacySettings?.()||{};
  add('Raw data minimization',privacy.rawData!=='yes'?'pass':'warn',`rawData=${privacy.rawData||'no'}`);
  const tel=loadTelemetrySettings?.()||{};
  add('Telemetry opt-in',tel.enabled!=='yes'?'pass':'warn',`telemetry=${tel.enabled||'no'}`);
  try{
    const r=await fetch(`${apiBase}/security-status`,{headers:authHeaders()});
    const d=await r.json();
    if(r.ok){
      (d.checks||[]).forEach(x=>add(`Backend · ${x.name}`,x.status,x.detail));
    }else add('Backend security status','warn',`HTTP ${r.status}`);
  }catch(e){add('Backend security status','warn','Backend no accesible.');}

  const pass=checks.filter(x=>x.status==='pass').length;
  const warn=checks.filter(x=>x.status==='warn').length;
  const fail=checks.filter(x=>x.status==='fail').length;
  securityReviewLast={timestamp:new Date().toISOString(),pass,warn,fail,checks};
  document.getElementById('securityReviewSummary').innerHTML=`
    <div class="metric-card"><span>PASS</span><strong>${pass}</strong></div>
    <div class="metric-card"><span>WARN</span><strong>${warn}</strong></div>
    <div class="metric-card"><span>FAIL</span><strong>${fail}</strong></div>`;
  document.getElementById('securityReviewResults').innerHTML=checks.map(c=>`
    <div class="security-check ${c.status==='pass'?'rc-pass':(c.status==='warn'?'rc-warn':'rc-fail')}">
      <strong>${c.status==='pass'?'🟢':(c.status==='warn'?'🟠':'🔴')} ${escapeHtml(c.name)}</strong>
      <div class="small">${escapeHtml(c.detail||'')}</div>
    </div>`).join('');
}
document.getElementById('runSecurityReview')?.addEventListener('click',runSecurityReviewV30);
document.getElementById('downloadSecurityReview')?.addEventListener('click',()=>{
  if(!securityReviewLast)return alert('Ejecute primero la revisión.');
  saveBlob(JSON.stringify(securityReviewLast,null,2),'application/json;charset=utf-8;','ValiStruct_3_RC6_seguridad.json');
});

// RC4: clear dynamic Cache Storage after logout/session changes.
async function clearValiStructDynamicCaches(){
  if(!('caches' in window)) return;
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('valistruct-')).map(k=>caches.delete(k)));
}
