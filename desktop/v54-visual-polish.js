'use strict';

(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function num(value) {
    if (value === null || value === undefined) return NaN;
    const normalized = String(value).trim().replace(',', '.').replace(/[^0-9eE+\-.]/g, '');
    return Number(normalized);
  }

  function text(el) {
    return (el && el.textContent ? el.textContent : '').trim();
  }

  function svgEl(name, attrs = {}, value = null) {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    if (value !== null) el.textContent = value;
    return el;
  }

  function ensureStyles() {
    if (document.getElementById('v54-visual-polish-styles')) return;
    const style = document.createElement('style');
    style.id = 'v54-visual-polish-styles';
    style.textContent = `
      .v54-scientific-chart{margin:18px 0 26px;padding:18px 18px 14px;border:1px solid #dbe5ef;border-radius:14px;background:#fff;box-shadow:0 8px 26px rgba(20,57,96,.06)}
      .v54-scientific-chart h3{margin:0 0 4px;color:#143960;font-size:1.08rem}
      .v54-scientific-chart p{margin:0 0 12px;color:#61768d;font-size:.9rem;line-height:1.45}
      .v54-scientific-chart svg{display:block;width:100%;max-width:820px;height:auto;margin:0 auto;background:#fff}
      .v54-chart-note{margin-top:8px!important;font-size:.82rem!important;color:#66798c!important}
      .v54-chart-legend{display:flex;gap:18px;flex-wrap:wrap;margin:6px 0 0;font-size:.82rem;color:#4b6279}
      .v54-chart-legend span{display:inline-flex;align-items:center;gap:6px}
      .v54-legend-line{width:24px;height:0;border-top:3px solid #155c8a;display:inline-block}
      .v54-legend-line.parallel{border-top-color:#b57b17;border-top-style:dashed}
      .v54-legend-line.reference{border-top-color:#8797a8;border-top-style:dashed}
      .v54-roc-existing-hidden{display:none!important}
    `;
    document.head.appendChild(style);
  }

  function metricCardByLabel(root, label) {
    return Array.from(root.querySelectorAll('.result-card')).find(card => text(card.querySelector('span')).toLowerCase() === label.toLowerCase());
  }

  function parseRoc(root) {
    const tables = Array.from(root.querySelectorAll('table'));
    const table = tables.find(t => /Sensibilidad/i.test(text(t)) && /Especificidad/i.test(text(t)) && /Youden/i.test(text(t)));
    if (!table) return null;
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
      const c = tr.querySelectorAll('td');
      if (c.length < 4) return null;
      const threshold = num(text(c[0]));
      const sensitivity = num(text(c[1]));
      const specificity = num(text(c[2]));
      const youden = num(text(c[3]));
      if (![sensitivity, specificity].every(Number.isFinite)) return null;
      return { threshold, sensitivity, specificity, fpr: 1 - specificity, youden };
    }).filter(Boolean);
    if (!rows.length) return null;

    const aucCard = metricCardByLabel(root, 'AUC');
    const cutCard = metricCardByLabel(root, 'Corte Youden');
    const sensCard = metricCardByLabel(root, 'Sensibilidad');
    const specCard = metricCardByLabel(root, 'Especificidad');
    const auc = num(text(aucCard?.querySelector('strong')));
    const aucCIText = text(aucCard?.querySelector('small'));
    const cutoff = num(text(cutCard?.querySelector('strong')));
    const sensitivity = num(text(sensCard?.querySelector('strong')));
    const specificity = num(text(specCard?.querySelector('strong')));
    const optimal = rows.slice().sort((a,b) => (b.youden - a.youden))[0];
    return { rows, auc, aucCIText, cutoff, sensitivity, specificity, optimal };
  }

  function buildRocSvg(data) {
    const W = 820, H = 570, left = 84, top = 70, right = 34, bottom = 82;
    const plotW = W - left - right, plotH = H - top - bottom;
    const x = v => left + Math.max(0, Math.min(1, v)) * plotW;
    const y = v => top + (1 - Math.max(0, Math.min(1, v))) * plotH;
    const svg = svgEl('svg', { viewBox:`0 0 ${W} ${H}`, role:'img', 'aria-label':'Curva ROC profesional' });

    svg.appendChild(svgEl('rect', { x:0, y:0, width:W, height:H, rx:14, fill:'#ffffff' }));

    for (let i=0;i<=5;i++) {
      const v=i/5;
      const gx=x(v), gy=y(v);
      svg.appendChild(svgEl('line',{x1:gx,y1:top,x2:gx,y2:top+plotH,stroke:'#e7edf3','stroke-width':1}));
      svg.appendChild(svgEl('line',{x1:left,y1:gy,x2:left+plotW,y2:gy,stroke:'#e7edf3','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:gx,y:top+plotH+26,'text-anchor':'middle','font-size':12,fill:'#536b82'},v.toFixed(1)));
      svg.appendChild(svgEl('text',{x:left-14,y:gy+4,'text-anchor':'end','font-size':12,fill:'#536b82'},v.toFixed(1)));
    }

    svg.appendChild(svgEl('line',{x1:left,y1:top+plotH,x2:left+plotW,y2:top+plotH,stroke:'#203e5a','stroke-width':1.6}));
    svg.appendChild(svgEl('line',{x1:left,y1:top,x2:left,y2:top+plotH,stroke:'#203e5a','stroke-width':1.6}));
    svg.appendChild(svgEl('line',{x1:x(0),y1:y(0),x2:x(1),y2:y(1),stroke:'#8797a8','stroke-width':1.7,'stroke-dasharray':'8 7'}));

    const ordered = [{fpr:0,sensitivity:0}, ...data.rows.slice().sort((a,b)=>a.fpr-b.fpr), {fpr:1,sensitivity:1}];
    const d = ordered.map((p,i)=>`${i?'L':'M'} ${x(p.fpr).toFixed(2)} ${y(p.sensitivity).toFixed(2)}`).join(' ');
    svg.appendChild(svgEl('path',{d,fill:'none',stroke:'#155c8a','stroke-width':4,'stroke-linejoin':'round','stroke-linecap':'round'}));

    const opt = data.optimal || { fpr: 1-data.specificity, sensitivity:data.sensitivity, threshold:data.cutoff, youden:NaN };
    if (Number.isFinite(opt.fpr) && Number.isFinite(opt.sensitivity)) {
      const cx=x(opt.fpr), cy=y(opt.sensitivity);
      svg.appendChild(svgEl('circle',{cx,cy,r:7.5,fill:'#b57b17',stroke:'#fff','stroke-width':3}));
      const boxW=235, boxH=82;
      const bx=Math.min(left+plotW-boxW-8, Math.max(left+8,cx+16));
      const by=Math.max(top+8, Math.min(top+plotH-boxH-8,cy-88));
      svg.appendChild(svgEl('rect',{x:bx,y:by,width:boxW,height:boxH,rx:9,fill:'#fffaf0',stroke:'#d8b264','stroke-width':1.2}));
      const lines=[
        `Corte óptimo: ${Number.isFinite(data.cutoff)?data.cutoff.toFixed(3):(Number.isFinite(opt.threshold)?opt.threshold.toFixed(3):'—')}`,
        `Sensibilidad: ${Number.isFinite(data.sensitivity)?data.sensitivity.toFixed(3):opt.sensitivity.toFixed(3)}`,
        `Especificidad: ${Number.isFinite(data.specificity)?data.specificity.toFixed(3):(1-opt.fpr).toFixed(3)}`,
        `Youden J: ${Number.isFinite(opt.youden)?opt.youden.toFixed(3):'—'}`
      ];
      lines.forEach((line,i)=>svg.appendChild(svgEl('text',{x:bx+12,y:by+20+i*17,'font-size':12.5,fill:i===0?'#7d5712':'#445d74','font-weight':i===0?'700':'500'},line)));
    }

    svg.appendChild(svgEl('text',{x:W/2,y:28,'text-anchor':'middle','font-size':18,fill:'#143960','font-weight':'700'},'Curva ROC del rendimiento discriminativo'));
    const aucLabel = Number.isFinite(data.auc) ? `AUC = ${data.auc.toFixed(3)}${data.aucCIText ? ` · ${data.aucCIText}` : ''}` : 'Curva ROC';
    svg.appendChild(svgEl('text',{x:W/2,y:50,'text-anchor':'middle','font-size':12.5,fill:'#61768d'},aucLabel));
    svg.appendChild(svgEl('text',{x:left+plotW/2,y:H-25,'text-anchor':'middle','font-size':13,fill:'#304e69','font-weight':'600'},'Tasa de falsos positivos (1 − especificidad)'));
    svg.appendChild(svgEl('text',{x:22,y:top+plotH/2,'text-anchor':'middle','font-size':13,fill:'#304e69','font-weight':'600',transform:`rotate(-90 22 ${top+plotH/2})`},'Sensibilidad'));
    return svg;
  }

  function enhanceRoc() {
    const root=document.getElementById('performanceResults');
    if (!root) return;
    const oldSvg=root.querySelector('svg[aria-label="Curva ROC"]');
    if (!oldSvg) return;
    const data=parseRoc(root);
    if (!data) return;
    const sig=[data.rows.length,data.auc,data.cutoff,data.sensitivity,data.specificity].join('|');
    let card=root.querySelector('.v54-roc-polish');
    if (card && card.dataset.signature===sig) return;
    if (card) card.remove();
    oldSvg.classList.add('v54-roc-existing-hidden');
    card=document.createElement('section');
    card.className='v54-scientific-chart v54-roc-polish';
    card.dataset.signature=sig;
    card.innerHTML='<h3>Curva ROC · presentación científica</h3><p>La diagonal representa discriminación nula (AUC = 0.50). El marcador identifica el punto de corte que maximiza el índice de Youden.</p>';
    card.appendChild(buildRocSvg(data));
    const legend=document.createElement('div');
    legend.className='v54-chart-legend';
    legend.innerHTML='<span><i class="v54-legend-line"></i>Curva ROC</span><span><i class="v54-legend-line reference"></i>Referencia AUC = 0.50</span><span>● Punto óptimo de Youden</span>';
    card.appendChild(legend);
    const note=document.createElement('p');
    note.className='v54-chart-note';
    note.textContent='El IC 95 % del AUC mostrado por ValiStruct se estima mediante bootstrap percentil; el corte de Youden es un criterio estadístico y no sustituye una decisión clínica.';
    card.appendChild(note);
    oldSvg.parentElement.insertBefore(card, oldSvg);
  }

  function parseScree(root) {
    const tables=Array.from(root.querySelectorAll('table'));
    const table=tables.find(t=>/Observado \(R\)/i.test(text(t)) && /Simulado/i.test(text(t)));
    if (!table) return null;
    const rows=Array.from(table.querySelectorAll('tbody tr')).map(tr=>{
      const c=tr.querySelectorAll('td');
      if(c.length<3)return null;
      const component=num(text(c[0])), observed=num(text(c[1])), parallel=num(text(c[2]));
      if(!Number.isFinite(component)||!Number.isFinite(observed))return null;
      return {component,observed,parallel};
    }).filter(Boolean);
    if(!rows.length)return null;
    const gridCards=Array.from(root.querySelectorAll('.efa-result-grid > div'));
    const suggestedCard=gridCards.find(c=>/Análisis paralelo/i.test(text(c)));
    const suggested=num(text(suggestedCard?.querySelector('strong')));
    return {rows,suggested};
  }

  function buildScreeSvg(data) {
    const W=820,H=500,left=76,top=62,right=30,bottom=76;
    const plotW=W-left-right,plotH=H-top-bottom;
    const n=data.rows.length;
    const maxY=Math.max(1,...data.rows.flatMap(r=>[r.observed,Number.isFinite(r.parallel)?r.parallel:0]));
    const yMax=Math.ceil(maxY*1.1*10)/10;
    const x=i=>left+(n<=1?0:(i-1)/(n-1))*plotW;
    const y=v=>top+(1-Math.max(0,Math.min(yMax,v))/yMax)*plotH;
    const svg=svgEl('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'Gráfico de sedimentación y análisis paralelo'});
    svg.appendChild(svgEl('rect',{x:0,y:0,width:W,height:H,rx:14,fill:'#fff'}));
    for(let i=0;i<=5;i++){
      const v=yMax*i/5,gy=y(v);
      svg.appendChild(svgEl('line',{x1:left,y1:gy,x2:left+plotW,y2:gy,stroke:'#e7edf3','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:left-12,y:gy+4,'text-anchor':'end','font-size':12,fill:'#536b82'},v.toFixed(1)));
    }
    data.rows.forEach((r,idx)=>{
      const gx=x(r.component);
      svg.appendChild(svgEl('line',{x1:gx,y1:top,x2:gx,y2:top+plotH,stroke:'#f3f6f9','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:gx,y:top+plotH+24,'text-anchor':'middle','font-size':11.5,fill:'#536b82'},String(r.component)));
    });
    svg.appendChild(svgEl('line',{x1:left,y1:top+plotH,x2:left+plotW,y2:top+plotH,stroke:'#203e5a','stroke-width':1.6}));
    svg.appendChild(svgEl('line',{x1:left,y1:top,x2:left,y2:top+plotH,stroke:'#203e5a','stroke-width':1.6}));
    const observedPath=data.rows.map((r,i)=>`${i?'L':'M'} ${x(r.component).toFixed(2)} ${y(r.observed).toFixed(2)}`).join(' ');
    const parallelRows=data.rows.filter(r=>Number.isFinite(r.parallel));
    const parallelPath=parallelRows.map((r,i)=>`${i?'L':'M'} ${x(r.component).toFixed(2)} ${y(r.parallel).toFixed(2)}`).join(' ');
    svg.appendChild(svgEl('path',{d:observedPath,fill:'none',stroke:'#155c8a','stroke-width':3.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
    if(parallelRows.length)svg.appendChild(svgEl('path',{d:parallelPath,fill:'none',stroke:'#b57b17','stroke-width':3,'stroke-dasharray':'8 6','stroke-linejoin':'round','stroke-linecap':'round'}));
    data.rows.forEach(r=>svg.appendChild(svgEl('circle',{cx:x(r.component),cy:y(r.observed),r:4.5,fill:'#155c8a',stroke:'#fff','stroke-width':1.5})));
    parallelRows.forEach(r=>svg.appendChild(svgEl('rect',{x:x(r.component)-4,y:y(r.parallel)-4,width:8,height:8,rx:1,fill:'#b57b17',stroke:'#fff','stroke-width':1.2})));
    if(Number.isFinite(data.suggested) && data.suggested>=1 && data.suggested<=n){
      const gx=x(data.suggested);
      svg.appendChild(svgEl('line',{x1:gx,y1:top,x2:gx,y2:top+plotH,stroke:'#4f8c65','stroke-width':2,'stroke-dasharray':'5 5'}));
      svg.appendChild(svgEl('text',{x:gx+7,y:top+16,'font-size':12,fill:'#356a4b','font-weight':'700'},`Retención sugerida: ${data.suggested}`));
    }
    svg.appendChild(svgEl('text',{x:W/2,y:28,'text-anchor':'middle','font-size':18,fill:'#143960','font-weight':'700'},'Gráfico de sedimentación y análisis paralelo'));
    svg.appendChild(svgEl('text',{x:W/2,y:49,'text-anchor':'middle','font-size':12.5,fill:'#61768d'},'Autovalores observados frente a autovalores simulados'));
    svg.appendChild(svgEl('text',{x:left+plotW/2,y:H-24,'text-anchor':'middle','font-size':13,fill:'#304e69','font-weight':'600'},'Componente / factor'));
    svg.appendChild(svgEl('text',{x:22,y:top+plotH/2,'text-anchor':'middle','font-size':13,fill:'#304e69','font-weight':'600',transform:`rotate(-90 22 ${top+plotH/2})`},'Autovalor'));
    return svg;
  }

  function enhanceScree() {
    const root=document.getElementById('efaResults');
    const rRoot=root?.querySelector('.efa-r-results');
    if(!rRoot)return;
    const data=parseScree(rRoot);
    if(!data)return;
    const sig=data.rows.map(r=>`${r.component}:${r.observed}:${r.parallel}`).join('|')+`|${data.suggested}`;
    let card=rRoot.querySelector('.v54-scree-polish');
    if(card && card.dataset.signature===sig)return;
    if(card)card.remove();
    card=document.createElement('section');
    card.className='v54-scientific-chart v54-scree-polish';
    card.dataset.signature=sig;
    card.innerHTML='<h3>Gráfico de sedimentación y análisis paralelo</h3><p>Compare la caída de los autovalores observados con los autovalores simulados. La retención debe integrarse con análisis paralelo, cargas, comunalidades y sustento teórico.</p>';
    card.appendChild(buildScreeSvg(data));
    const legend=document.createElement('div');
    legend.className='v54-chart-legend';
    legend.innerHTML='<span><i class="v54-legend-line"></i>Autovalores observados</span><span><i class="v54-legend-line parallel"></i>Autovalores simulados</span>';
    card.appendChild(legend);
    const details=rRoot.querySelector('details');
    if(details)rRoot.insertBefore(card,details); else rRoot.appendChild(card);
  }

  function enhanceAll(){
    try{ensureStyles();enhanceRoc();enhanceScree();}catch(err){console.error('[ValiStruct] visual polish failed:',err);}
  }

  function mount(){
    ensureStyles();
    enhanceAll();
    const observer=new MutationObserver(()=>enhanceAll());
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.__ValiStructVisualPolishObserver=observer;
    window.ValiStructVisualPolish={enhanceAll,enhanceRoc,enhanceScree};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
