(() => {
  'use strict';

  const NS='http://www.w3.org/2000/svg';
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
  const clamp=v=>v==null?null:Math.max(0,Math.min(1,v));
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function prototypeModel(r){
    if(!r?.factorResults?.length)return null;
    const factors=r.factorResults.map((f,fi)=>({
      name:String(f.name||`Factor${fi+1}`),
      items:f.items.map((name,i)=>{
        const loading=n(f.loadings?.[i]);
        const r2=loading==null?null:clamp(loading*loading);
        const residual=n(f.residuals?.[i]) ?? (r2==null?null:clamp(1-r2));
        return {name:String(name),loading,r2,residual};
      })
    }));
    const covariances=[];
    if(Array.isArray(r.phi)){
      for(let i=0;i<factors.length;i++)for(let j=i+1;j<factors.length;j++){
        const value=n(r.phi?.[i]?.[j]);
        if(value!=null)covariances.push({from:factors[i].name,to:factors[j].name,value});
      }
    }
    return {factors,covariances,source:'AFC preliminar'};
  }

  function proModel(data){
    if(!Array.isArray(data?.parameters))return null;
    const map=new Map(), covariances=[];
    data.parameters.forEach(p=>{
      if(p.op==='=~'){
        const factor=String(p.lhs||'').trim(), item=String(p.rhs||'').trim();
        if(!factor||!item)return;
        if(!map.has(factor))map.set(factor,[]);
        const loading=n(p.std_all ?? p['std.all'] ?? p.est);
        const r2=loading==null?null:clamp(loading*loading);
        map.get(factor).push({name:item,loading,r2,residual:r2==null?null:clamp(1-r2)});
      }else if(p.op==='~~' && p.lhs!==p.rhs){
        const value=n(p.std_all ?? p['std.all'] ?? p.est);
        if(value!=null)covariances.push({from:String(p.lhs),to:String(p.rhs),value});
      }
    });
    const factors=[...map.entries()].map(([name,items])=>({name,items}));
    return factors.length?{factors,covariances,source:'Motor Pro · lavaan'}:null;
  }

  function buildPathDiagram(model){
    const rows=model.factors.length;
    const maxItems=Math.max(...model.factors.map(f=>f.items.length));
    const W=Math.max(1180,460+maxItems*135);
    const rowGap=180, firstY=125, H=Math.max(560,firstY+(rows-1)*rowGap+135);
    const factorX=175, itemStart=390, itemGap=135, itemW=92, itemH=42, errDy=65;
    const factorPos=new Map();

    let s=`<div class="cfa-diagram vs-publication-diagram"><div class="vs-diagram-head"><div><h3>Path diagram SEM de publicación</h3><p>${esc(model.source)} · cargas estandarizadas, R², errores residuales y covarianzas factoriales</p></div><span class="badge">AMOS / lavaan style</span></div><div class="vs-diagram-scroll"><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Path diagram SEM"><defs><marker id="vsArr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#4b5563"/></marker><marker id="vsBiA" markerWidth="8" markerHeight="8" refX="1" refY="4" orient="auto"><path d="M8,0 L0,4 L8,8 Z" fill="#7c1f2a"/></marker><marker id="vsBiB" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="#7c1f2a"/></marker></defs>`;

    model.factors.forEach((f,fi)=>factorPos.set(f.name,{x:factorX,y:firstY+fi*rowGap}));

    // Factor covariances: routed in a dedicated left rail to avoid crossing item paths.
    (model.covariances||[]).forEach((c,ci)=>{
      const a=factorPos.get(c.from), b=factorPos.get(c.to); if(!a||!b)return;
      const railX=35+(ci%5)*18;
      const ay=a.y, by=b.y, edgeX=factorX-72;
      const d=`M ${edgeX} ${ay} C ${railX} ${ay}, ${railX} ${by}, ${edgeX} ${by}`;
      s+=`<path d="${d}" fill="none" stroke="#7c1f2a" stroke-width="1.5" opacity="0.72" marker-start="url(#vsBiA)" marker-end="url(#vsBiB)"/>`;
      s+=`<rect x="${railX-20}" y="${(ay+by)/2-10}" width="42" height="20" rx="7" fill="#fff" opacity="0.94"/><text x="${railX+1}" y="${(ay+by)/2+4}" text-anchor="middle" font-size="11" fill="#7c1f2a">${c.value.toFixed(2)}</text>`;
    });

    model.factors.forEach((f,fi)=>{
      const fy=firstY+fi*rowGap;
      s+=`<ellipse cx="${factorX}" cy="${fy}" rx="72" ry="34" fill="#f8e9ec" stroke="#7c1f2a" stroke-width="2"/><text x="${factorX}" y="${fy+5}" text-anchor="middle" font-size="14" font-weight="600" fill="#222">${esc(f.name)}</text>`;
      f.items.forEach((it,k)=>{
        const ix=itemStart+k*itemGap, iy=fy;
        const ex=ix+itemW/2, ey=iy+errDy;
        s+=`<path d="M ${factorX+72} ${fy} L ${ix-itemW/2} ${iy}" stroke="#4b5563" stroke-width="1.4" fill="none" marker-end="url(#vsArr)"/>`;
        if(it.loading!=null)s+=`<text x="${(factorX+72+ix-itemW/2)/2}" y="${iy-10}" text-anchor="middle" font-size="11" fill="#111">λ=${it.loading.toFixed(2)}</text>`;
        s+=`<rect x="${ix-itemW/2}" y="${iy-itemH/2}" width="${itemW}" height="${itemH}" rx="7" fill="#fff" stroke="#445160" stroke-width="1.3"/><text x="${ix}" y="${iy-2}" text-anchor="middle" font-size="12" font-weight="600" fill="#222">${esc(it.name)}</text>`;
        if(it.r2!=null)s+=`<text x="${ix}" y="${iy+14}" text-anchor="middle" font-size="10" fill="#0c356d">R²=${it.r2.toFixed(2)}</text>`;
        s+=`<circle cx="${ex}" cy="${ey}" r="20" fill="#fff7e6" stroke="#b98514" stroke-width="1.3"/><text x="${ex}" y="${ey+4}" text-anchor="middle" font-size="10" fill="#6b4b00">e${fi+1}.${k+1}</text><path d="M ${ex} ${ey-20} L ${ex} ${iy+itemH/2}" stroke="#8b6a25" stroke-width="1.2" marker-end="url(#vsArr)"/>`;
        if(it.residual!=null)s+=`<text x="${ex+28}" y="${ey+4}" font-size="10" fill="#6b4b00">θ=${it.residual.toFixed(2)}</text>`;
      });
    });

    s+=`<text x="${W-18}" y="${H-20}" text-anchor="end" font-size="10" fill="#64748b">ValiStruct · Dr. Roberto Joel Tirado Reyes · UAS</text></svg></div><p class="ci-note"><strong>Lectura:</strong> óvalos = factores latentes; rectángulos = indicadores; λ = carga estandarizada; R² = varianza explicada del indicador; e/θ = error residual; flechas curvas bidireccionales = covarianzas/correlaciones entre factores.</p></div>`;
    return s;
  }

  // Override the AFC prototype diagram with the publication layout.
  if(typeof renderCfaDiagram==='function'){
    renderCfaDiagram=function(r){
      const model=prototypeModel(r);
      return model?buildPathDiagram(model):'<div class="notice">No fue posible construir el diagrama.</div>';
    };
  }

  // Append a professional diagram every time Motor Pro renders lavaan output.
  if(typeof renderProResults==='function'){
    const previousRenderPro=renderProResults;
    renderProResults=function(data){
      previousRenderPro(data);
      const model=proModel(data);
      if(model && typeof proResults!=='undefined' && proResults){
        proResults.insertAdjacentHTML('beforeend',buildPathDiagram(model));
      }
    };
  }

  // Replace the Motor Pro click path to avoid AUTH_TOKEN_KEY temporal-dead-zone failures.
  const runBtn=document.getElementById('runProModel');
  if(runBtn){
    runBtn.addEventListener('click',async ev=>{
      ev.preventDefault(); ev.stopImmediatePropagation();
      let payload;
      try{payload=buildProPayload();}catch(e){return alert(e.message);}
      proResults.innerHTML='<div class="notice">Ejecutando modelo…</div>';
      try{
        const headers={'Content-Type':'application/json'};
        try{
          const token=sessionStorage.getItem('valistruct_auth_token_v23');
          if(token)headers.Authorization=`Bearer ${token}`;
        }catch(_){}
        const res=await fetch(`${getProApiBase()}/estimate`,{method:'POST',headers,body:JSON.stringify(payload)});
        const data=await res.json();
        if(!res.ok||data.ok===false)throw new Error(data.error||'No fue posible estimar el modelo.');
        proLastResponse=data;
        renderProResults(data);
      }catch(e){
        proResults.innerHTML=`<div class="model-error"><strong>No se pudo ejecutar el Motor Pro.</strong><br>${esc(e.message)}<br><br>Compruebe que el backend incluido en ValiStruct esté activo.</div>`;
      }
    },true);
  }

  const style=document.createElement('style');
  style.textContent=`
    .vs-publication-diagram{margin-top:28px;background:#fff;border:1px solid #d9e2ec;border-radius:16px;padding:18px;box-shadow:0 1px 4px rgba(15,23,42,.05)}
    .vs-diagram-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:10px}
    .vs-diagram-head h3{margin:0 0 4px;color:#123c73}.vs-diagram-head p{margin:0;color:#64748b;font-size:13px}
    .vs-diagram-scroll{overflow:auto;border:1px solid #edf1f5;border-radius:12px;background:#fff;padding:8px}
    .vs-diagram-scroll svg{display:block;max-width:none;background:white}
  `;
  document.head.appendChild(style);
})();
