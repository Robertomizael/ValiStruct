/*
 * ValiStruct · PATH v2 — diagrama del modelo de medición (AFC).
 *
 * Capa exclusivamente visual. Arquitectura:
 *
 *   Resultados AFC / lavaan
 *     -> Adapter   (modelo gráfico normalizado e inmutable)
 *     -> Layout    (posiciones; no lee valores numéricos)
 *     -> Renderer  (lista de primitivas de dibujo)
 *     -> Exporter  (SVG / PNG / PDF vectorial)
 *     -> Controls  (panel, orientación, zoom, arrastre)
 *
 * Regla científica: este módulo NO estima nada. Solo transcribe los parámetros
 * que entregan R/lavaan (Motor Pro) o el AFC rápido. La única identidad usada
 * es R² = 1 − θ estandarizada (varianza residual std.all), y se aplica en el
 * Adapter, nunca en el renderer. Nunca se etiqueta `est` como estandarizado.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports) module.exports=api;
  if(root){
    root.ValiStructPathV2=api;
    if(root.document) api.install(root);
  }
})(typeof window!=='undefined'?window:null,function(){
'use strict';

const VERSION='2.0.0';
const R2_TOLERANCE=1e-6;

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const num=v=>{
  if(v===null || v===undefined || v==='') return null;
  const x=Number(v);
  return Number.isFinite(x)?x:null;
};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function deepFreeze(o){
  if(o && typeof o==='object' && !Object.isFrozen(o)){
    Object.values(o).forEach(deepFreeze);
    Object.freeze(o);
  }
  return o;
}
function pick(p){
  return {
    est:num(p.est), se:num(p.se), z:num(p.z), pvalue:num(p.pvalue),
    std_all:num(p.std_all!==undefined?p.std_all:p['std.all'])
  };
}

/* ------------------------------------------------------------------ */
/* Adapter: resultados -> modelo gráfico normalizado                   */
/* ------------------------------------------------------------------ */
function r2FromTheta(theta){
  // R² = 1 − θ estandarizada. Solo se recorta ante desviaciones de tolerancia numérica.
  if(theta===null) return {value:null,improper:false};
  let value=1-theta;
  if(value<0 && value>-R2_TOLERANCE) value=0;
  if(value>1 && value<1+R2_TOLERANCE) value=1;
  return {value,improper:value<0 || value>1};
}

function finalize(m){
  const primary=new Map();
  m.loadings.forEach(l=>{ if(!primary.has(l.indicator)) primary.set(l.indicator,l.factor); });
  m.indicators=m.indicators.map(name=>{
    const rv=m.residualVariances.find(r=>r.indicator===name) || null;
    const r2=r2FromTheta(rv?rv.std_all:null);
    return {
      name, primary:primary.get(name) ?? null,
      crossLoaded:m.loadings.filter(l=>l.indicator===name).length>1,
      r2:r2.value, improper:r2.improper
    };
  });
  const all=[...m.loadings,...m.factorCovariances,...m.residualVariances,...m.residualCovariances,...m.factorVariances];
  m.capabilities={
    std:m.loadings.some(l=>l.std_all!==null),
    unstd:m.loadings.some(l=>l.est!==null),
    pvalue:all.some(p=>p.pvalue!==null)
  };
  return deepFreeze(m);
}

function fromLavaan(data){
  if(!data || !Array.isArray(data.parameters)) return null;
  const params=data.parameters;
  const latent=new Set(params.filter(p=>p.op==='=~').map(p=>String(p.lhs??'').trim()).filter(Boolean));
  if(!latent.size) return null;
  const m={
    kind:'pro', source:'Motor Pro · R/lavaan',
    factors:[...latent].map(name=>({name})),
    indicators:[], loadings:[], factorVariances:[], factorCovariances:[],
    residualVariances:[], residualCovariances:[], undrawn:[]
  };
  const indicatorSet=new Set();
  params.forEach(p=>{
    if(p.op!=='=~') return;
    const f=String(p.lhs??'').trim(), i=String(p.rhs??'').trim();
    if(!f || !i) return;
    if(latent.has(i)){ m.undrawn.push({type:'carga de orden superior',lhs:f,op:'=~',rhs:i}); return; }
    if(!indicatorSet.has(i)){ indicatorSet.add(i); m.indicators.push(i); }
    m.loadings.push({factor:f,indicator:i,...pick(p)});
  });
  params.forEach(p=>{
    const a=String(p.lhs??'').trim(), b=String(p.rhs??'').trim();
    if(p.op==='~~'){
      const la=latent.has(a), lb=latent.has(b), ia=indicatorSet.has(a), ib=indicatorSet.has(b);
      if(a===b){
        if(la) m.factorVariances.push({factor:a,...pick(p)});
        else if(ia) m.residualVariances.push({indicator:a,...pick(p)});
        else m.undrawn.push({type:'varianza de variable externa',lhs:a,op:'~~',rhs:b});
      }else if(la && lb) m.factorCovariances.push({a,b,...pick(p)});
      else if(ia && ib) m.residualCovariances.push({a,b,...pick(p)});
      else m.undrawn.push({type:'covarianza no representable',lhs:a,op:'~~',rhs:b});
    }else if(p.op==='~'){
      m.undrawn.push({type:'regresión estructural',lhs:a,op:'~',rhs:b});
    }
  });
  if(!m.indicators.length) return null;
  return finalize(m);
}

function fromQuickCfa(r){
  if(!r || !Array.isArray(r.factorResults) || !r.factorResults.length) return null;
  const m={
    kind:'quick', source:'AFC rápido · vista diagnóstica (prototipo, no lavaan)',
    factors:[], indicators:[], loadings:[], factorVariances:[], factorCovariances:[],
    residualVariances:[], residualCovariances:[], undrawn:[]
  };
  const none={est:null,se:null,z:null,pvalue:null};
  r.factorResults.forEach((f,fi)=>{
    const name=String(f.name||`Factor${fi+1}`);
    m.factors.push({name});
    (f.items||[]).forEach((it,k)=>{
      const item=String(it);
      if(!m.indicators.includes(item)) m.indicators.push(item);
      m.loadings.push({factor:name,indicator:item,...none,std_all:num(f.loadings?.[k])});
      const theta=num(f.residuals?.[k]);
      if(theta!==null) m.residualVariances.push({indicator:item,...none,std_all:theta});
    });
  });
  if(Array.isArray(r.phi)){
    for(let i=0;i<m.factors.length;i++) for(let j=i+1;j<m.factors.length;j++){
      const v=num(r.phi?.[i]?.[j]);
      if(v!==null) m.factorCovariances.push({a:m.factors[i].name,b:m.factors[j].name,...none,std_all:v});
    }
  }
  if(!m.indicators.length) return null;
  return finalize(m);
}

/* ------------------------------------------------------------------ */
/* Opciones                                                            */
/* ------------------------------------------------------------------ */
const DIRS=['LR','TB','RL','BT'];
function defaults(){
  return {
    design:'amosH', dir:'LR', mirror:false, compact:false,
    style:'modern', est:'std',
    show:{loadings:true,r2:true,errors:true,factorCov:true,residCov:true,sig:false,factorNames:true,itemLabels:true},
    fontSize:12, spacing:1, lineWidth:1.4, manual:{}
  };
}
function normalizeOptions(model,o){
  const d=defaults();
  const out={...d,...(o||{}),show:{...d.show,...((o&&o.show)||{})},manual:{...((o&&o.manual)||{})}};
  // Nunca ofrecer estimaciones que la fuente no contiene.
  if(out.est==='unstd' && !model.capabilities.unstd) out.est='std';
  if(out.est==='std' && !model.capabilities.std && model.capabilities.unstd) out.est='unstd';
  if(!model.capabilities.pvalue) out.show.sig=false;
  if(!DIRS.includes(out.dir)) out.dir='LR';
  out.fontSize=clamp(Number(out.fontSize)||12,9,18);
  out.spacing=clamp(Number(out.spacing)||1,0.7,2);
  out.lineWidth=clamp(Number(out.lineWidth)||1.4,0.6,3);
  return out;
}

/* ------------------------------------------------------------------ */
/* Layout: solo geometría (no lee estimaciones)                        */
/* ------------------------------------------------------------------ */
const FID=n=>'F:'+n, IID=n=>'I:'+n, EID=n=>'E:'+n;

function boundary(n,tx,ty){
  const dx=tx-n.x, dy=ty-n.y;
  if(!dx && !dy) return {x:n.x,y:n.y};
  if(n.kind==='indicator'){
    const k=Math.min(dx?n.hw/Math.abs(dx):Infinity, dy?n.hh/Math.abs(dy):Infinity);
    return {x:n.x+dx*k,y:n.y+dy*k};
  }
  const k=1/Math.sqrt((dx/n.hw)**2+(dy/n.hh)**2);
  return {x:n.x+dx*k,y:n.y+dy*k};
}

function assignLanes(arcs){
  // Carriles dinámicos: arcos anidados van por fuera; arcos que se solapan no comparten carril.
  const placed=[];
  arcs.slice().sort((p,q)=>(p.hi-p.lo)-(q.hi-q.lo) || p.lo-q.lo).forEach(a=>{
    let lane=1;
    const busy=new Set();
    placed.forEach(p=>{
      const overlap=p.lo<a.hi && a.lo<p.hi;
      if(!overlap) return;
      const nested=p.lo>=a.lo && p.hi<=a.hi;
      if(nested) lane=Math.max(lane,p.lane+1); else busy.add(p.lane);
    });
    while(busy.has(lane)) lane++;
    a.lane=lane;
    placed.push(a);
  });
  return arcs;
}

function layout(model,o){
  const fs=o.fontSize, sp=o.spacing, compact=!!o.compact, sh=o.show;
  const horiz=o.dir==='LR' || o.dir==='RL';
  const maxItem=sh.itemLabels?Math.max(2,...model.indicators.map(i=>i.name.length)):2;
  const maxFac=sh.factorNames?Math.max(2,...model.factors.map(f=>f.name.length)):2;
  const itemW=clamp(maxItem*fs*0.6+16,compact?44:56,170), itemH=fs+(compact?10:16);
  const facRx=clamp(maxFac*fs*0.31+20,compact?36:48,130), facRy=fs+(compact?10:16);
  const errR=Math.round(fs*(compact?0.85:1.05));
  const lblW=fs*3.4, small=fs*0.85;

  const step=horiz
    ? (Math.max(itemH,2*errR)+fs+(compact?2:6))*sp
    : (Math.max(itemW,sh.errors?2*errR+lblW+6:0)+(compact?8:16))*sp;
  const groupGap=(horiz?22:28)*(compact?0.6:1)*sp;
  const itemHalf=horiz?itemH/2:itemW/2;
  const facSpan=horiz?2*facRy:2*facRx;
  const mFI=horiz ? facRx+itemW/2+(compact?70:110)*sp : facRy+itemH/2+(compact?70:105)*sp;
  const mIE=horiz ? itemW/2+errR+(compact?22:30) : itemH/2+errR+(compact?20:26);

  const u={LR:{x:1,y:0},RL:{x:-1,y:0},TB:{x:0,y:1},BT:{x:0,y:-1}}[o.dir];
  const v=horiz?{x:0,y:1}:{x:1,y:0};
  const map=(m,c)=>{
    const cc=o.mirror?-c:c;
    return {x:u.x*m+v.x*cc, y:u.y*m+v.y*cc};
  };
  const manual=id=>o.manual[id] || {dx:0,dy:0};

  const nodes={}, order=[];
  let c=0;
  model.factors.forEach(f=>{
    const items=model.indicators.filter(i=>i.primary===f.name);
    const span=Math.max(0,(items.length-1)*step);
    const extent=Math.max(span+Math.max(2*itemHalf,step),facSpan);
    const start=c+(extent-span)/2;
    const fp=map(0,c+extent/2), fm=manual(FID(f.name));
    nodes[FID(f.name)]={id:FID(f.name),kind:'factor',name:f.name,x:fp.x+fm.dx,y:fp.y+fm.dy,hw:facRx,hh:facRy};
    order.push(FID(f.name));
    items.forEach((it,k)=>{
      const ip=map(mFI,start+k*step), im=manual(IID(it.name));
      nodes[IID(it.name)]={id:IID(it.name),kind:'indicator',name:it.name,x:ip.x+im.dx,y:ip.y+im.dy,hw:itemW/2,hh:itemH/2};
      order.push(IID(it.name));
    });
    c+=extent+groupGap;
  });
  // Indicadores sin factor primario resoluble (no debería ocurrir): se añaden al final.
  model.indicators.filter(i=>!nodes[IID(i.name)]).forEach(it=>{
    const ip=map(mFI,c);
    nodes[IID(it.name)]={id:IID(it.name),kind:'indicator',name:it.name,x:ip.x,y:ip.y,hw:itemW/2,hh:itemH/2};
    order.push(IID(it.name));
    c+=step;
  });
  if(sh.errors){
    model.indicators.forEach((it,k)=>{
      const n=nodes[IID(it.name)], em=manual(EID(it.name));
      nodes[EID(it.name)]={id:EID(it.name),kind:'error',name:it.name,label:'e'+(k+1),
        x:n.x+u.x*mIE+em.dx,y:n.y+u.y*mIE+em.dy,hw:errR,hh:errR};
      order.push(EID(it.name));
    });
  }

  const edges={loadings:[],errors:[],factorCov:[],residCov:[]};
  const labels={r2:[],theta:[],factorVar:[]};
  const tLabel=horiz?0.62:0.66;

  model.loadings.forEach((l,idx)=>{
    const a=nodes[FID(l.factor)], b=nodes[IID(l.indicator)];
    if(!a || !b) return;
    const p1=boundary(a,b.x,b.y), p2=boundary(b,a.x,a.y);
    edges.loadings.push({ref:idx,p1,p2,label:{x:p1.x+(p2.x-p1.x)*tLabel,y:p1.y+(p2.y-p1.y)*tLabel}});
  });

  model.indicators.forEach((it,idx)=>{
    const n=nodes[IID(it.name)], f=nodes[FID(it.primary)], e=nodes[EID(it.name)];
    if(e){
      edges.errors.push({ind:idx,p1:boundary(e,n.x,n.y),p2:boundary(n,e.x,e.y)});
      labels.theta.push(horiz
        ? {ind:idx,x:e.x,y:e.y-errR-3,anchor:'middle'}
        : {ind:idx,x:e.x+errR+3,y:e.y+small*0.35,anchor:'start'});
    }
    if(horiz) labels.r2.push({ind:idx,x:n.x,y:n.y-n.hh-3,anchor:'middle'});
    else{
      const side=(f && n.x<f.x)?-1:1;
      labels.r2.push({ind:idx,x:n.x+side*(n.hw+12),y:u.y>0?n.y-n.hh-3:n.y+n.hh+small,anchor:side<0?'start':'end'});
    }
  });

  model.factorVariances.forEach((fv,idx)=>{
    const f=nodes[FID(fv.factor)];
    if(f) labels.factorVar.push({ref:idx,x:f.x-f.hw*0.72,y:f.y-f.hh*0.78-3,anchor:'end'});
  });

  const cross=n=>n.x*v.x+n.y*v.y;
  function arcs(pairs,nodeOf,dirSign,base){
    const used=[...new Set(pairs.flatMap(p=>[p.a,p.b]))].map(nodeOf).filter(Boolean)
      .sort((p,q)=>cross(p)-cross(q));
    const index=new Map(used.map((n,i)=>[n.id,i]));
    const list=[];
    pairs.forEach((p,ref)=>{
      const a=nodeOf(p.a), b=nodeOf(p.b);
      if(!a || !b) return;
      const ia=index.get(a.id), ib=index.get(b.id);
      list.push({ref,a,b,lo:Math.min(ia,ib),hi:Math.max(ia,ib)});
    });
    assignLanes(list);
    const gap=(horiz?lblW+6:fs+12)*Math.max(sp,0.8);
    const w={x:u.x*dirSign,y:u.y*dirSign};
    return list.map(arc=>{
      const depth=base+arc.lane*gap;
      const ang=clamp(55-14*(arc.lane-1),12,55)*Math.PI/180;
      const anchor=(n,other)=>{
        const s=Math.sign(cross(other)-cross(n)) || 1;
        const dx=w.x*Math.cos(ang)+v.x*s*Math.sin(ang), dy=w.y*Math.cos(ang)+v.y*s*Math.sin(ang);
        return boundary(n,n.x+dx*1000,n.y+dy*1000);
      };
      const A=anchor(arc.a,arc.b), B=anchor(arc.b,arc.a);
      const P1={x:A.x+w.x*depth,y:A.y+w.y*depth}, P2={x:B.x+w.x*depth,y:B.y+w.y*depth};
      return {ref:arc.ref,lane:arc.lane,A,P1,P2,B,
        label:{x:(A.x+B.x)/2+w.x*depth*0.75,y:(A.y+B.y)/2+w.y*depth*0.75}};
    });
  }
  if(sh.factorCov) edges.factorCov=arcs(model.factorCovariances,n=>nodes[FID(n)],-1,18);
  if(sh.residCov) edges.residCov=arcs(model.residualCovariances,n=>nodes[EID(n)] || nodes[IID(n)],1,14);

  // Separación simple de etiquetas de covarianza que colisionen.
  const covLabels=[...edges.factorCov,...edges.residCov].map(e=>e.label);
  const bw=lblW+4, bh=fs+6;
  for(let pass=0;pass<4;pass++){
    let moved=false;
    for(let i=0;i<covLabels.length;i++) for(let j=i+1;j<covLabels.length;j++){
      const p=covLabels[i], q=covLabels[j];
      if(Math.abs(p.x-q.x)<bw && Math.abs(p.y-q.y)<bh){
        const shift=horiz?bh:bw;
        q.x+=v.x*shift; q.y+=v.y*shift; moved=true;
      }
    }
    if(!moved) break;
  }

  return {nodes,order,edges,labels,u,v,horiz,metrics:{fs,small,itemW,itemH,facRx,facRy,errR,lblW,step}};
}

/* ------------------------------------------------------------------ */
/* Renderer: modelo + layout -> lista de primitivas                    */
/* ------------------------------------------------------------------ */
const STYLES={
  classic:{font:'Arial, Helvetica, sans-serif',facFill:'#ffffff',facStroke:'#000000',indFill:'#ffffff',indStroke:'#000000',
    errFill:'#ffffff',errStroke:'#000000',line:'#000000',cov:'#000000',text:'#000000',sub:'#000000',note:'#333333',
    rectR:0,nodeSw:1.2,brand:true,source:true},
  modern:{font:'Arial, Helvetica, sans-serif',facFill:'#f8e9ec',facStroke:'#7c1f2a',indFill:'#ffffff',indStroke:'#445160',
    errFill:'#fff7e6',errStroke:'#b98514',line:'#374151',cov:'#7c1f2a',text:'#1f2937',sub:'#0c356d',note:'#475569',
    rectR:5,nodeSw:1.6,brand:true,source:true},
  publication:{font:'Arial, Helvetica, sans-serif',facFill:'#ffffff',facStroke:'#111111',indFill:'#ffffff',indStroke:'#111111',
    errFill:'#ffffff',errStroke:'#111111',line:'#111111',cov:'#111111',text:'#111111',sub:'#111111',note:'#111111',
    rectR:0,nodeSw:1,brand:false,source:false}
};
const fmt=v=>v===null || v===undefined ? '—' : v.toFixed(2);
const textWidth=(s,size)=>String(s).length*size*0.56;

function stars(p,o){
  if(!o.show.sig || p.pvalue===null) return '';
  return p.pvalue<.001?'***':p.pvalue<.01?'**':p.pvalue<.05?'*':'';
}
function valueOf(p,o){ return o.est==='std'?p.std_all:p.est; }

function hiddenParameters(model,o){
  const h=[];
  if(!o.show.loadings && model.loadings.length) h.push('cargas');
  if(!o.show.errors && model.residualVariances.length) h.push('varianzas residuales');
  if(!o.show.factorCov && model.factorCovariances.length) h.push('covarianzas entre factores');
  if(!o.show.residCov && model.residualCovariances.length) h.push('covarianzas residuales');
  if(model.undrawn.length) h.push(`${model.undrawn.length} parámetro(s) estructural(es) no representable(s) en este diagrama de medición`);
  return h;
}

function arrowHead(tip,from,size){
  const dx=tip.x-from.x, dy=tip.y-from.y, len=Math.hypot(dx,dy) || 1;
  const ux=dx/len, uy=dy/len, bx=tip.x-ux*size, by=tip.y-uy*size, hw=size*0.38;
  return {base:{x:bx,y:by},d:[['M',tip.x,tip.y],['L',bx-uy*hw,by+ux*hw],['L',bx+uy*hw,by-ux*hw],['Z']]};
}

function render(model,opts){
  const o=normalizeOptions(model,opts);
  const lay=layout(model,o);
  const st=STYLES[o.style] || STYLES.modern;
  const {fs,small,errR}=lay.metrics;
  const lw=o.lineWidth, ah=6+lw*1.6;
  const ops=[];
  const label=(x,y,s,extra)=>{
    const size=(extra&&extra.size) || small, w=textWidth(s,size)+6, anchor=(extra&&extra.anchor) || 'middle';
    const left=anchor==='middle'?x-w/2:anchor==='end'?x-w+3:x-3;
    ops.push({t:'rect',x:left,y:y-size*0.95,w,h:size*1.3,r:2,fill:'#ffffff'});
    ops.push({t:'text',x,y,s,size,anchor,fill:(extra&&extra.fill) || st.text});
  };
  const arc=(e,p,color)=>{
    const h1=arrowHead(e.A,e.P1,ah), h2=arrowHead(e.B,e.P2,ah);
    ops.push({t:'path',d:[['M',h1.base.x,h1.base.y],['C',e.P1.x,e.P1.y,e.P2.x,e.P2.y,h2.base.x,h2.base.y]],stroke:color,sw:lw});
    ops.push({t:'path',d:h1.d,fill:color},{t:'path',d:h2.d,fill:color});
    return ()=>label(e.label.x,e.label.y+small*0.35,fmt(valueOf(p,o))+stars(p,o),{fill:color});
  };
  const deferred=[];

  // 1) Covarianzas (al fondo)
  lay.edges.factorCov.forEach(e=>deferred.push(arc(e,model.factorCovariances[e.ref],st.cov)));
  lay.edges.residCov.forEach(e=>deferred.push(arc(e,model.residualCovariances[e.ref],st.cov)));

  // 2) Cargas
  if(o.show.loadings) lay.edges.loadings.forEach(e=>{
    const p=model.loadings[e.ref], h=arrowHead(e.p2,e.p1,ah);
    ops.push({t:'path',d:[['M',e.p1.x,e.p1.y],['L',h.base.x,h.base.y]],stroke:st.line,sw:lw});
    ops.push({t:'path',d:h.d,fill:st.line});
    deferred.push(()=>label(e.label.x,e.label.y+small*0.35,fmt(valueOf(p,o))+stars(p,o)));
  });

  // 3) Flechas de error
  lay.edges.errors.forEach(e=>{
    const h=arrowHead(e.p2,e.p1,ah*0.85);
    ops.push({t:'path',d:[['M',e.p1.x,e.p1.y],['L',h.base.x,h.base.y]],stroke:st.errStroke,sw:lw*0.85});
    ops.push({t:'path',d:h.d,fill:st.errStroke});
  });

  // 4) Nodos
  lay.order.forEach(id=>{
    const n=lay.nodes[id];
    if(n.kind==='factor'){
      ops.push({t:'ellipse',cx:n.x,cy:n.y,rx:n.hw,ry:n.hh,fill:st.facFill,stroke:st.facStroke,sw:st.nodeSw,node:id});
      if(o.show.factorNames) ops.push({t:'text',x:n.x,y:n.y+fs*0.35,s:n.name,size:fs,anchor:'middle',bold:true,fill:st.text,node:id});
    }else if(n.kind==='indicator'){
      ops.push({t:'rect',x:n.x-n.hw,y:n.y-n.hh,w:2*n.hw,h:2*n.hh,r:st.rectR,fill:st.indFill,stroke:st.indStroke,sw:st.nodeSw*0.85,node:id});
      if(o.show.itemLabels) ops.push({t:'text',x:n.x,y:n.y+fs*0.35,s:n.name,size:fs,anchor:'middle',fill:st.text,node:id});
    }else{
      ops.push({t:'ellipse',cx:n.x,cy:n.y,rx:errR,ry:errR,fill:st.errFill,stroke:st.errStroke,sw:st.nodeSw*0.75,node:id});
      ops.push({t:'text',x:n.x,y:n.y+small*0.33,s:n.label,size:Math.min(small,errR*0.95),anchor:'middle',fill:st.text,node:id});
    }
  });

  // 5) Etiquetas numéricas (encima de todo)
  deferred.forEach(fn=>fn());
  if(o.show.r2) lay.labels.r2.forEach(l=>{
    const it=model.indicators[l.ind];
    if(it.r2===null) return; // sin información estandarizada no se inventa R²
    ops.push({t:'text',x:l.x,y:l.y,s:'R²='+fmt(it.r2)+(it.improper?' !':''),size:small,anchor:l.anchor,fill:st.sub});
  });
  if(o.show.errors) lay.labels.theta.forEach(l=>{
    const rv=model.residualVariances.find(r=>r.indicator===model.indicators[l.ind].name);
    if(!rv) return;
    ops.push({t:'text',x:l.x,y:l.y,s:fmt(valueOf(rv,o))+stars(rv,o),size:small,anchor:l.anchor,fill:st.errStroke});
  });
  if(o.est==='unstd') lay.labels.factorVar.forEach(l=>{
    const fv=model.factorVariances[l.ref];
    if(fv.est!==null) ops.push({t:'text',x:l.x,y:l.y,s:fmt(fv.est),size:small,anchor:'end',fill:st.cov});
  });

  // 6) Caja envolvente con TODOS los elementos (incluye error, θ y etiquetas)
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  const grow=(x,y)=>{ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; };
  ops.forEach(p=>{
    if(p.t==='ellipse'){ grow(p.cx-p.rx,p.cy-p.ry); grow(p.cx+p.rx,p.cy+p.ry); }
    else if(p.t==='rect'){ grow(p.x,p.y); grow(p.x+p.w,p.y+p.h); }
    else if(p.t==='path') p.d.forEach(s=>{ for(let i=1;i<s.length;i+=2) grow(s[i],s[i+1]); });
    else if(p.t==='text'){
      const w=textWidth(p.s,p.size)*1.12;
      const x0=p.anchor==='middle'?p.x-w/2:p.anchor==='end'?p.x-w:p.x;
      grow(x0,p.y-p.size); grow(x0+w,p.y+p.size*0.3);
    }
  });
  const margin=34, dx=margin-minX, dy=margin-minY;
  ops.forEach(p=>{
    if(p.t==='ellipse'){ p.cx+=dx; p.cy+=dy; }
    else if(p.t==='rect' || p.t==='text'){ p.x+=dx; p.y+=dy; }
    else p.d.forEach(s=>{ for(let i=1;i<s.length;i+=2){ s[i]+=dx; s[i+1]+=dy; } });
  });
  let width=maxX-minX+2*margin, height=maxY-minY+2*margin;

  // 7) Notas al pie (dentro del área exportable)
  const notes=[];
  notes.push(o.est==='std'
    ? 'Estimaciones estandarizadas (λstd, std.all). R² = 1 − θ estandarizada.'
    : 'Estimaciones no estandarizadas (B). R² procede de la solución estandarizada.');
  if(o.show.sig) notes.push('* p < .05   ** p < .01   *** p < .001');
  const hidden=hiddenParameters(model,o);
  if(hidden.length) notes.push('Vista parcial: no se representan todos los parámetros del modelo ('+hidden.join('; ')+').');
  const improper=model.indicators.filter(i=>i.improper).map(i=>i.name);
  if(improper.length) notes.push('Aviso (!): varianza residual estandarizada fuera de [0, 1] en '+improper.join(', ')+'. Revise la solución.');
  if(st.source) notes.push('Fuente: '+model.source+'.');
  if(st.brand) notes.push('ValiStruct · Dr. Roberto Joel Tirado Reyes · UAS');
  const noteSize=Math.max(9,fs*0.8);
  notes.forEach((s,i)=>{
    ops.push({t:'text',x:margin,y:height+i*(noteSize+5),s,size:noteSize,anchor:'start',fill:st.note,note:true});
    width=Math.max(width,margin*2+textWidth(s,noteSize)*1.05);
  });
  height+=notes.length*(noteSize+5)+8;

  return {ops,width:Math.ceil(width),height:Math.ceil(height),offset:{dx,dy},layout:lay,options:o,style:st,hidden,notes};
}

/* ------------------------------------------------------------------ */
/* Exporter: primitivas -> SVG / PDF                                   */
/* ------------------------------------------------------------------ */
const f2=n=>(Math.round(n*100)/100).toString();
function pathD(d){
  return d.map(s=>s[0]+s.slice(1).map(f2).join(' ')).join(' ');
}
function svgInner(scene){
  const font=scene.style.font;
  return scene.ops.map(p=>{
    const node=p.node?` data-node="${esc(p.node)}"`:'';
    const paint=`fill="${p.fill || 'none'}"`+(p.stroke?` stroke="${p.stroke}" stroke-width="${f2(p.sw || 1)}"`:'');
    if(p.t==='ellipse') return `<ellipse cx="${f2(p.cx)}" cy="${f2(p.cy)}" rx="${f2(p.rx)}" ry="${f2(p.ry)}" ${paint}${node}/>`;
    if(p.t==='rect') return `<rect x="${f2(p.x)}" y="${f2(p.y)}" width="${f2(p.w)}" height="${f2(p.h)}"${p.r?` rx="${f2(p.r)}"`:''} ${paint}${node}/>`;
    if(p.t==='path') return `<path d="${pathD(p.d)}" ${paint} stroke-linecap="round"/>`;
    return `<text x="${f2(p.x)}" y="${f2(p.y)}" font-family="${font}" font-size="${f2(p.size)}" text-anchor="${p.anchor || 'start'}"${p.bold?' font-weight="700"':''} fill="${p.fill}"${node}>${esc(p.s)}</text>`;
  }).join('');
}
function toSvg(scene){
  const {width:w,height:h}=scene;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Diagrama PATH del AFC" data-path-renderer="v2"><rect x="0" y="0" width="${w}" height="${h}" fill="#ffffff"/>${svgInner(scene)}</svg>`;
}

// PDF vectorial mínimo (sin dependencias): Helvetica, Helvetica-Bold y Symbol para griegas.
const WIN_EXTRA={'—':0x97,'–':0x96,'’':0x92,'‘':0x91,'“':0x93,'”':0x94,'•':0x95,'…':0x85,'€':0x80,'−':0x2d};
const SYMBOL={'λ':'l','θ':'q','χ':'c','α':'a','β':'b','δ':'d','ε':'e','φ':'f','ψ':'y','ω':'w','σ':'s','ρ':'r','μ':'m','η':'h','ξ':'x',
  'Δ':'D','Σ':'S','Φ':'F','Ψ':'Y','Ω':'W','Λ':'L','Θ':'Q','≤':'£','≥':'³'};
function pdfRuns(s,bold){
  const runs=[];
  for(const ch of String(s)){
    const code=ch.codePointAt(0);
    let font=bold?'F2':'F1', byte, sup=false;
    if(ch==='²'){ byte=0x32; sup=true; } // superíndice dibujado: no depende de la fuente del visor
    else if(code>=32 && code<127) byte=code;
    else if(code>=0xA0 && code<=0xFF) byte=code;
    else if(WIN_EXTRA[ch]!==undefined) byte=WIN_EXTRA[ch];
    else if(SYMBOL[ch]!==undefined){ font='F3'; byte=SYMBOL[ch].charCodeAt(0); }
    else byte=63; // '?'
    const hex=byte.toString(16).padStart(2,'0');
    const last=runs[runs.length-1];
    if(last && last.font===font && !!last.sup===sup) last.hex+=hex; else runs.push({font,hex,sup});
  }
  return runs;
}
function hexColor(c){
  const m=/^#?([0-9a-f]{6})$/i.exec(c || '');
  const n=m?parseInt(m[1],16):0;
  return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255].map(x=>(Math.round(x*1000)/1000).toString()).join(' ');
}
function toPdf(scene,measure){
  const W=scene.width, H=scene.height, out=[];
  const width=measure || ((s,size)=>textWidth(s,size));
  out.push(`1 0 0 -1 0 ${f2(H)} cm`,'1 J 1 j');
  const paint=p=>{
    if(p.fill) out.push(hexColor(p.fill)+' rg');
    if(p.stroke) out.push(hexColor(p.stroke)+' RG',f2(p.sw || 1)+' w');
    return p.fill && p.stroke?'B':p.fill?'f':'S';
  };
  const K=0.5523;
  scene.ops.forEach(p=>{
    if(p.t==='ellipse'){
      const op=paint(p), {cx,cy,rx,ry}=p, kx=rx*K, ky=ry*K;
      out.push(`${f2(cx+rx)} ${f2(cy)} m`,
        `${f2(cx+rx)} ${f2(cy+ky)} ${f2(cx+kx)} ${f2(cy+ry)} ${f2(cx)} ${f2(cy+ry)} c`,
        `${f2(cx-kx)} ${f2(cy+ry)} ${f2(cx-rx)} ${f2(cy+ky)} ${f2(cx-rx)} ${f2(cy)} c`,
        `${f2(cx-rx)} ${f2(cy-ky)} ${f2(cx-kx)} ${f2(cy-ry)} ${f2(cx)} ${f2(cy-ry)} c`,
        `${f2(cx+kx)} ${f2(cy-ry)} ${f2(cx+rx)} ${f2(cy-ky)} ${f2(cx+rx)} ${f2(cy)} c`,'h '+op);
    }else if(p.t==='rect'){
      const op=paint(p);
      out.push(`${f2(p.x)} ${f2(p.y)} ${f2(p.w)} ${f2(p.h)} re`,op);
    }else if(p.t==='path'){
      const op=paint(p);
      p.d.forEach(s=>{
        if(s[0]==='M') out.push(`${f2(s[1])} ${f2(s[2])} m`);
        else if(s[0]==='L') out.push(`${f2(s[1])} ${f2(s[2])} l`);
        else if(s[0]==='C') out.push(s.slice(1).map(f2).join(' ')+' c');
        else out.push('h');
      });
      out.push(op);
    }else{
      const w=width(p.s,p.size,!!p.bold);
      const x=p.anchor==='middle'?p.x-w/2:p.anchor==='end'?p.x-w:p.x;
      out.push('BT',hexColor(p.fill)+' rg',`1 0 0 -1 ${f2(x)} ${f2(p.y)} Tm`);
      pdfRuns(p.s,p.bold).forEach(r=>out.push(r.sup
        ? `/${r.font} ${f2(p.size*0.62)} Tf ${f2(p.size*0.38)} Ts <${r.hex}> Tj 0 Ts`
        : `/${r.font} ${f2(p.size)} Tf <${r.hex}> Tj`));
      out.push('ET');
    }
  });
  const stream=out.join('\n');
  const objs=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(W)} ${f2(H)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Symbol >>'
  ];
  let pdf='%PDF-1.4\n';
  const offsets=[];
  objs.forEach((body,i)=>{ offsets.push(pdf.length); pdf+=`${i+1} 0 obj\n${body}\nendobj\n`; });
  const xref=pdf.length;
  pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('');
  pdf+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R /Info << /Title (ValiStruct PATH AFC) /Producer (ValiStruct PATH v${VERSION}) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

/* ------------------------------------------------------------------ */
/* Controls: montaje en el DOM                                         */
/* ------------------------------------------------------------------ */
const CSS=`
.vs-path-v2{margin-top:26px;background:#fff;border:1px solid #d9e2ec;border-radius:14px;padding:16px;color:#1f2937}
.vs-path-v2 .vsp-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:10px}
.vs-path-v2 .vsp-head h3{margin:0 0 3px;color:#123c73}
.vs-path-v2 .vsp-head p{margin:0;font-size:13px;color:#64748b}
.vs-path-v2 .vsp-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0}
.vs-path-v2 .vsp-bar label{font-size:12px;color:#475569;display:inline-flex;gap:5px;align-items:center}
.vs-path-v2 .vsp-bar button,.vs-path-v2 .vsp-bar select{font-size:12px;padding:5px 9px;border:1px solid #cbd5e1;border-radius:7px;background:#f8fafc;color:#1f2937;cursor:pointer;min-height:0;width:auto;margin:0}
.vs-path-v2 .vsp-bar button:hover{background:#eef2f7}
.vs-path-v2 .vsp-sep{width:1px;height:20px;background:#e2e8f0;margin:0 3px}
.vs-path-v2 .vsp-zoom{font-size:12px;min-width:44px;text-align:center;color:#475569}
.vs-path-v2 details.vsp-panel{border:1px solid #e5eaf0;border-radius:9px;padding:6px 10px;margin:6px 0;background:#fbfcfe}
.vs-path-v2 details.vsp-panel summary{cursor:pointer;font-size:13px;font-weight:600;color:#123c73}
.vs-path-v2 .vsp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:4px 16px;margin-top:8px}
.vs-path-v2 .vsp-grid label{font-size:12.5px;display:flex;gap:6px;align-items:center;color:#334155}
.vs-path-v2 .vsp-grid label.vsp-off{color:#94a3b8}
.vs-path-v2 .vsp-grid input[type=checkbox]{width:auto;margin:0}
.vs-path-v2 .vsp-grid input[type=range]{flex:1;min-width:80px;padding:0}
.vs-path-v2 .vsp-grid label select{font-size:12px;padding:3px 6px;width:auto;min-width:0;max-width:62%;flex:0 1 auto;margin:0;min-height:0}
.vs-path-v2 .vsp-viewport{position:relative;height:560px;min-height:260px;border:1px solid #e5eaf0;border-radius:10px;background:#fff;overflow:hidden;resize:vertical;touch-action:none;cursor:grab}
.vs-path-v2 .vsp-viewport.vsp-panning{cursor:grabbing}
.vs-path-v2 .vsp-viewport svg{display:block;width:100%;height:100%;user-select:none}
.vs-path-v2 .vsp-viewport [data-node]{cursor:move}
.vs-path-v2 .vsp-warning{font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:5px 9px;margin:6px 0}
.vs-path-v2 .vsp-hint{font-size:12px;color:#64748b;margin:8px 0 0}
`;

const lastOptions={};

function controlsHtml(model,o){
  const cap=model.capabilities;
  const chk=(key,text,enabled=true,why='')=>`<label class="${enabled?'':'vsp-off'}" title="${esc(why)}"><input type="checkbox" data-show="${key}" ${o.show[key]?'checked':''} ${enabled?'':'disabled'}> ${text}${enabled?'':' <em>(no disponible)</em>'}</label>`;
  const sel=(v,cur,text,dis=false)=>`<option value="${v}" ${v===cur?'selected':''} ${dis?'disabled':''}>${text}</option>`;
  return `
  <div class="vsp-head"><div><h3>Diagrama PATH del modelo de medición</h3><p>${esc(model.source)}</p></div><span class="badge">PATH v2 · estilo AMOS</span></div>
  <div class="vsp-bar">
    <label>Diseño del diagrama
      <select data-opt="design">
        ${sel('amosH',o.design,'AMOS horizontal')}${sel('amosV',o.design,'AMOS vertical')}${sel('jaspV',o.design,'JASP vertical')}${sel('auto',o.design,'Automático')}${sel('publication',o.design,'Modo publicación')}
      </select></label>
    <span class="vsp-sep"></span>
    <button type="button" data-act="horizontal">Horizontal</button>
    <button type="button" data-act="vertical">Vertical</button>
    <button type="button" data-act="rotate">Rotar 90°</button>
    <button type="button" data-act="flipH">Invertir horizontal</button>
    <button type="button" data-act="flipV">Invertir vertical</button>
    <span class="vsp-sep"></span>
    <button type="button" data-act="zoomOut" aria-label="Reducir zoom">−</button>
    <span class="vsp-zoom" data-role="zoom">100%</span>
    <button type="button" data-act="zoomIn" aria-label="Aumentar zoom">+</button>
    <button type="button" data-act="fit">Ajustar a pantalla</button>
    <button type="button" data-act="center">Centrar</button>
    <button type="button" data-act="relayout">Layout automático</button>
    <button type="button" data-act="reset">Restablecer diseño</button>
    <span class="vsp-sep"></span>
    <button type="button" data-act="svg">Exportar SVG</button>
    <button type="button" data-act="png">Exportar PNG</button>
    <button type="button" data-act="pdf">Exportar PDF</button>
  </div>
  <details class="vsp-panel"><summary>Opciones de visualización</summary>
    <div class="vsp-grid">
      ${chk('loadings','Cargas (λ)')}
      ${chk('r2','R² de los ítems')}
      ${chk('errors','Errores')}
      ${chk('factorCov','Covarianzas entre factores')}
      ${chk('residCov','Covarianzas residuales')}
      ${chk('sig','Significancia',cap.pvalue,'Esta fuente no contiene valores p')}
      ${chk('factorNames','Nombres de factores')}
      ${chk('itemLabels','Etiquetas de ítems')}
      <label title="${cap.unstd?'':'Esta fuente no contiene estimaciones no estandarizadas'}">Estimaciones
        <select data-opt="est">${sel('std',o.est,'Estandarizadas',!cap.std)}${sel('unstd',o.est,cap.unstd?'No estandarizadas':'No estandarizadas (no disponible)',!cap.unstd)}</select></label>
      <label>Apariencia
        <select data-opt="style">${sel('classic',o.style,'AMOS clásico')}${sel('modern',o.style,'AMOS moderno')}${sel('publication',o.style,'Publicación')}</select></label>
      <label>Fuente <input type="range" data-num="fontSize" min="9" max="18" step="1" value="${o.fontSize}"></label>
      <label>Separación <input type="range" data-num="spacing" min="0.7" max="2" step="0.1" value="${o.spacing}"></label>
      <label>Grosor de línea <input type="range" data-num="lineWidth" min="0.6" max="3" step="0.2" value="${o.lineWidth}"></label>
    </div>
  </details>
  <div class="vsp-warning" data-role="warning" hidden></div>
  <div class="vsp-viewport" data-role="viewport"><svg data-path-renderer="v2" data-vs-enhanced="1" role="img" aria-label="Diagrama PATH del AFC"></svg></div>
  <p class="vsp-hint">Arrastre el fondo para desplazar y los nodos para reacomodarlos. Zoom: botones, Ctrl/⌘ + rueda o gesto de pellizco. La exportación incluye solo el diagrama, con la orientación y los elementos visibles.</p>`;
}

function chooseAuto(model,o,vw,vh){
  let best=null;
  ['LR','TB'].forEach(dir=>{
    const sc=render(model,{...o,dir,manual:{}});
    const fit=Math.min(vw/sc.width,vh/sc.height);
    if(!best || fit>best.fit+1e-9) best={dir,fit};
  });
  return best.dir;
}

function mount(container,model,initial){
  const doc=container.ownerDocument, win=doc.defaultView;
  if(!doc.getElementById('vsPathV2Style')){
    const style=doc.createElement('style');
    style.id='vsPathV2Style'; style.textContent=CSS;
    doc.head.appendChild(style);
  }
  const host=doc.createElement('div');
  host.className='vs-path-v2';
  host.setAttribute('data-path-renderer','v2');
  host.setAttribute('data-path-source',model.kind);
  let o=normalizeOptions(model,{...(lastOptions[model.kind] || {}),...(initial || {}),manual:{}});
  host.innerHTML=controlsHtml(model,o);
  container.appendChild(host);

  const viewport=host.querySelector('[data-role="viewport"]');
  const svg=viewport.querySelector('svg');
  const zoomLabel=host.querySelector('[data-role="zoom"]');
  const warning=host.querySelector('[data-role="warning"]');
  const view={s:1,tx:0,ty:0,touched:false,fitAll:false};
  let scene=null;

  const size=()=>({w:viewport.clientWidth || 1000,h:viewport.clientHeight || 560});
  function applyView(){
    const g=svg.firstElementChild;
    if(g) g.setAttribute('transform',`translate(${f2(view.tx)} ${f2(view.ty)}) scale(${view.s.toFixed(4)})`);
    zoomLabel.textContent=Math.round(view.s*100)+'%';
  }
  function fit(readable){
    const {w,h}=size();
    const full=Math.min((w-16)/scene.width,(h-16)/scene.height);
    // Vista inicial: nunca por debajo de un tamaño legible; el modelo grande se navega con pan/zoom.
    view.s=clamp(readable?Math.max(full,0.62):full,0.1,1.6);
    center();
    if(readable){
      if(scene.width*view.s>w) view.tx=8;
      if(scene.height*view.s>h) view.ty=8;
      applyView();
    }
  }
  function center(){
    const {w,h}=size();
    view.tx=(w-scene.width*view.s)/2; view.ty=(h-scene.height*view.s)/2;
    applyView();
  }
  function zoomAt(factor,px,py){
    const {w,h}=size();
    const x=px ?? w/2, y=py ?? h/2, s=clamp(view.s*factor,0.1,6);
    view.tx=x-(x-view.tx)*(s/view.s); view.ty=y-(y-view.ty)*(s/view.s); view.s=s;
    view.touched=true; applyView();
  }
  function draw(refit){
    if(o.design==='auto' || o.design==='publication'){
      if(!o._dirLocked){ const {w,h}=size(); o.dir=chooseAuto(model,o,w,h); }
    }
    scene=render(model,o);
    svg.innerHTML=`<g>${svgInner(scene)}</g>`;
    if(scene.hidden.length){
      warning.hidden=false;
      warning.textContent='El diagrama no está representando todos los parámetros del modelo: '+scene.hidden.join('; ')+'.';
    }else warning.hidden=true;
    host.setAttribute('data-path-dir',o.dir);
    host.setAttribute('data-path-design',o.design);
    if(refit) fit(!view.fitAll); else applyView();
    const {manual,_dirLocked,...keep}=o;
    lastOptions[model.kind]=keep;
  }
  function syncControls(){
    host.querySelectorAll('[data-opt]').forEach(el=>{ el.value=o[el.dataset.opt]; });
    host.querySelectorAll('[data-show]').forEach(el=>{ el.checked=!!o.show[el.dataset.show]; });
    host.querySelectorAll('[data-num]').forEach(el=>{ el.value=o[el.dataset.num]; });
  }
  function setDesign(d){
    const prev=o.design;
    o.design=d; o.compact=d==='jaspV'; o._dirLocked=false; o.mirror=false; o.manual={};
    if(d==='amosH') o.dir='LR';
    if(d==='amosV' || d==='jaspV') o.dir='TB';
    if(d==='publication') o.style='publication';
    else if(prev==='publication' && o.style==='publication') o.style='modern';
  }

  const actions={
    horizontal(){ o.dir='LR'; o._dirLocked=true; draw(true); },
    vertical(){ o.dir='TB'; o._dirLocked=true; draw(true); },
    rotate(){ o.dir=DIRS[(DIRS.indexOf(o.dir)+1)%4]; o._dirLocked=true; o.manual={}; draw(true); },
    flipH(){ if(o.dir==='LR' || o.dir==='RL') o.dir=o.dir==='LR'?'RL':'LR'; else o.mirror=!o.mirror; o._dirLocked=true; o.manual={}; draw(true); },
    flipV(){ if(o.dir==='TB' || o.dir==='BT') o.dir=o.dir==='TB'?'BT':'TB'; else o.mirror=!o.mirror; o._dirLocked=true; o.manual={}; draw(true); },
    zoomIn(){ zoomAt(1.2); }, zoomOut(){ zoomAt(1/1.2); },
    fit(){ view.touched=false; view.fitAll=true; fit(false); }, center(){ center(); },
    relayout(){ o.manual={}; draw(true); },
    reset(){ o=normalizeOptions(model,defaults()); view.touched=false; view.fitAll=false; syncControls(); draw(true); },
    svg(){ download(new win.Blob([api.svgString()],{type:'image/svg+xml;charset=utf-8'}),'ValiStruct_PATH_AFC.svg'); },
    pdf(){ download(api.pdfBlob(),'ValiStruct_PATH_AFC.pdf'); },
    png(){ api.pngBlob().then(b=>download(b,'ValiStruct_PATH_AFC.png')).catch(e=>win.alert('No fue posible exportar PNG: '+e.message)); }
  };
  function download(blob,name){
    const url=win.URL.createObjectURL(blob), a=doc.createElement('a');
    a.href=url; a.download=name; doc.body.appendChild(a); a.click(); a.remove();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1500);
    try{ if(typeof win.logHistory==='function') win.logHistory('AFC','Exportar PATH',{archivo:name,orientacion:o.dir,estimaciones:o.est}); }catch(_){}
  }

  host.addEventListener('click',ev=>{
    const b=ev.target.closest('[data-act]');
    if(b && actions[b.dataset.act]){ ev.preventDefault(); actions[b.dataset.act](); }
  });
  host.addEventListener('change',ev=>{
    const el=ev.target;
    if(el.dataset.show){ o.show[el.dataset.show]=el.checked; o=normalizeOptions(model,o); draw(false); }
    else if(el.dataset.opt==='design'){ setDesign(el.value); syncControls(); draw(true); }
    else if(el.dataset.opt){ o[el.dataset.opt]=el.value; o=normalizeOptions(model,o); syncControls(); draw(false); }
  });
  host.addEventListener('input',ev=>{
    const el=ev.target;
    if(el.dataset.num){ o[el.dataset.num]=Number(el.value); o=normalizeOptions(model,o); draw(!view.touched); }
  });

  // Navegación: arrastre de fondo = pan; arrastre de nodo = reacomodo manual.
  let drag=null;
  viewport.addEventListener('pointerdown',ev=>{
    if(ev.button!==0) return;
    const nodeEl=ev.target.closest && ev.target.closest('[data-node]');
    drag={x:ev.clientX,y:ev.clientY,node:nodeEl?nodeEl.getAttribute('data-node'):null};
    try{ viewport.setPointerCapture(ev.pointerId); }catch(_){}
    if(!drag.node) viewport.classList.add('vsp-panning');
  });
  viewport.addEventListener('pointermove',ev=>{
    if(!drag) return;
    const dx=ev.clientX-drag.x, dy=ev.clientY-drag.y;
    drag.x=ev.clientX; drag.y=ev.clientY;
    if(drag.node){
      const m=o.manual[drag.node] || {dx:0,dy:0};
      o.manual={...o.manual,[drag.node]:{dx:m.dx+dx/view.s,dy:m.dy+dy/view.s}};
      const before=scene.offset;
      scene=render(model,o);
      // Mantener fijo el resto del diagrama aunque cambie la caja envolvente.
      view.tx-=(scene.offset.dx-before.dx)*view.s; view.ty-=(scene.offset.dy-before.dy)*view.s;
      svg.innerHTML=`<g>${svgInner(scene)}</g>`;
      applyView();
    }else{
      view.tx+=dx; view.ty+=dy; view.touched=true; applyView();
    }
  });
  const endDrag=()=>{ drag=null; viewport.classList.remove('vsp-panning'); };
  viewport.addEventListener('pointerup',endDrag);
  viewport.addEventListener('pointercancel',endDrag);
  viewport.addEventListener('wheel',ev=>{
    if(!(ev.ctrlKey || ev.metaKey)) return; // la rueda sin modificador sigue desplazando la página
    ev.preventDefault();
    const r=viewport.getBoundingClientRect();
    zoomAt(Math.exp(-ev.deltaY*0.0025),ev.clientX-r.left,ev.clientY-r.top);
  },{passive:false});
  viewport.addEventListener('dblclick',()=>actions.fit());
  if(win.ResizeObserver){
    new win.ResizeObserver(()=>{ if(scene && !view.touched) fit(!view.fitAll); }).observe(viewport);
  }

  const api={
    model,
    getOptions:()=>JSON.parse(JSON.stringify(o)),
    setOptions(patch){
      if(patch.design) setDesign(patch.design);
      const {design,...rest}=patch;
      o=normalizeOptions(model,{...o,...rest,show:{...o.show,...(rest.show || {})},manual:rest.manual || o.manual});
      syncControls(); draw(true);
    },
    act:name=>actions[name] && actions[name](),
    getScene:()=>scene,
    getView:()=>({...view}),
    svgString:()=>toSvg(scene),
    pdfString(){
      const ctx=doc.createElement('canvas').getContext('2d');
      const measure=ctx?((s,size,bold)=>{ ctx.font=`${bold?'bold ':''}${size}px Arial, Helvetica, sans-serif`; return ctx.measureText(s).width; }):null;
      return toPdf(scene,measure);
    },
    pdfBlob(){
      const s=api.pdfString(), bytes=new Uint8Array(s.length);
      for(let i=0;i<s.length;i++) bytes[i]=s.charCodeAt(i)&255;
      return new win.Blob([bytes],{type:'application/pdf'});
    },
    pngBlob(scale=3){
      return new Promise((resolve,reject)=>{
        const url=win.URL.createObjectURL(new win.Blob([toSvg(scene)],{type:'image/svg+xml;charset=utf-8'}));
        const img=new win.Image();
        img.onload=()=>{
          const canvas=doc.createElement('canvas');
          canvas.width=Math.round(scene.width*scale); canvas.height=Math.round(scene.height*scale);
          const ctx=canvas.getContext('2d');
          ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          win.URL.revokeObjectURL(url);
          canvas.toBlob(b=>b?resolve(b):reject(new Error('lienzo vacío')),'image/png');
        };
        img.onerror=()=>{ win.URL.revokeObjectURL(url); reject(new Error('no se pudo rasterizar el SVG')); };
        img.src=url;
      });
    }
  };
  host.__vsPath=api;
  draw(true);
  return api;
}

/* ------------------------------------------------------------------ */
/* Integración con la aplicación (con fallback al renderer anterior)   */
/* ------------------------------------------------------------------ */
function install(win){
  const doc=win.document;
  function hook(fnName,containerId,adapt){
    const original=win[fnName];
    if(typeof original!=='function' || original.__vsPathV2) return;
    const wrapped=function(data){
      const out=original.apply(this,arguments);
      try{
        const container=doc.getElementById(containerId);
        const model=adapt(data);
        if(container && model){
          API.mount(container,model);
          // Solo tras montar con éxito se retira el diagrama anterior (que queda como fallback).
          container.querySelectorAll('.cfa-diagram').forEach(n=>{ if(!n.closest('[data-path-renderer="v2"]')) n.remove(); });
        }
      }catch(err){
        if(win.console) win.console.error('[ValiStruct PATH v2] se mantiene el renderer anterior:',err);
      }
      return out;
    };
    wrapped.__vsPathV2=true;
    win[fnName]=wrapped;
  }
  hook('renderCfaResults','cfaResults',fromQuickCfa);
  hook('renderProResults','proResults',fromLavaan);
}

const API={VERSION,R2_TOLERANCE,fromLavaan,fromQuickCfa,defaults,normalizeOptions,layout,render,
  hiddenParameters,toSvg,toPdf,svgInner,assignLanes,mount,install};
return API;
});
