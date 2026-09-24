/*
 * ValiStruct · Importador de sintaxis JASP.
 * Analiza texto localmente: NUNCA ejecuta el código R pegado.
 * Admite modelos lavaan directos y llamadas sencillas lavaan::cfa/sem con
 * modelo literal o variable asignada a una cadena de texto.
 */
(function(){
'use strict';
const el=id=>document.getElementById(id);
const SUPPORTED=new Set(['ML','MLR','WLSMV']);
const IDENT=/^[A-Za-z][A-Za-z0-9_.]*$/;
let parsed=null;

function stripComments(text){
  return text.split(/\r?\n/).map(line=>{
    let quote=null,escaped=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(escaped){escaped=false;continue;}
      if(c==='\\'&&quote){escaped=true;continue;}
      if(quote){if(c===quote)quote=null;}
      else if(c==="'"||c==='"')quote=c;
      else if(c==='#')return line.slice(0,i);
    }
    return line;
  }).join('\n');
}
function unescapeRString(value){
  // No evaluación de R/JS; únicamente escapes propios de literales simples.
  return value.replace(/\\([\\'"])/g,'$1').replace(/\\n/g,'\n').replace(/\\t/g,'\t');
}
function findModelLiteral(source){
  // Captura una cadena asignada con <- o = a model/modelSyntax.
  const assign=/(?:^|[\r\n;])\s*(model|modelo|modelSyntax)\s*(?:<-|=)\s*(['"])((?:\\.|(?!\2)[\s\S])*?)\2/gim;
  let m;
  while((m=assign.exec(source))!==null){
    const candidate=unescapeRString(m[3]);
    if(/(?:=~|~~|(?:^|\n)\s*[A-Za-z]\w*\s*~)/.test(candidate)) return candidate;
  }
  // cfa(model = '...', data = ...), sem('...') o lavaan(model = "...")
  const calls=/(?:lavaan::)?(?:cfa|sem|lavaan)\s*\(\s*(?:model\s*=\s*)?(['"])((?:\\.|(?!\1)[\s\S])*?)\1/gim;
  while((m=calls.exec(source))!==null){
    const candidate=unescapeRString(m[2]);
    if(candidate.includes('=~'))return candidate;
  }
  return null;
}
function parseOptions(source){
  const out={warnings:[],ordinal:[]};
  const estimator=source.match(/\bestimator\s*=\s*['"]([^'"]+)['"]/i);
  if(estimator){
    const value=estimator[1].toUpperCase();
    if(SUPPORTED.has(value))out.estimator=value;
    else out.warnings.push('Estimador '+value+' no disponible en este Motor Pro; seleccione manualmente uno compatible antes de ejecutar.');
  }
  const missing=source.match(/\bmissing\s*=\s*['"]([^'"]+)['"]/i);
  if(missing){
    const value=missing[1].toLowerCase();
    if(['fiml','ml','ml.x'].includes(value))out.missing='fiml';
    else if(['listwise','complete'].includes(value))out.missing='listwise';
    else out.warnings.push('Tratamiento de faltantes '+value+' no se importó: seleccione una opción compatible.');
  }
  const ordered=source.match(/\bordered\s*=\s*c\s*\(([^)]*)\)/i);
  if(ordered){
    const matches=[...ordered[1].matchAll(/['"]([^'"]+)['"]/g)].map(x=>x[1]);
    if(matches.length)out.ordinal=[...new Set(matches)];
    else out.warnings.push('No se interpretó ordered=c(...). Indique las variables ordinales manualmente.');
  }else if(/\bordered\s*=/.test(source)){
    out.warnings.push('ordered contiene una expresión de R: indique los nombres de los ítems ordinales manualmente.');
  }
  const unsupported=['group','group.equal','sampling.weights','cluster','fixed.x','parameterization','std.lv','se','test','bootstrap'];
  unsupported.forEach(key=>{
    if(new RegExp('\\b'+key.replace('.','\\.')+'\\s*=').test(source)){
      out.warnings.push('La opción R '+key+' no se reproduce automáticamente; verifique la configuración y los resultados.');
    }
  });
  if(/\b(?:jaspSem|jaspFactor|jaspDescriptives)::/.test(source))
    out.warnings.push('Código específico de JASP: solo se extrae el modelo lavaan. Otras operaciones de JASP no se reproducen.');
  return out;
}
function inspectModel(model){
  const clean=stripComments(model).trim();
  const lines=clean.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const factors=new Set(),required=new Set(),unsupported=[];
  if(!lines.length)throw Error('No se detectaron ecuaciones de un modelo.');
  lines.forEach((line,i)=>{
    const m=line.match(/^([A-Za-z][A-Za-z0-9_.]*)\s*(=~|~~|~|:=)\s*(.+)$/);
    if(!m){unsupported.push('Línea '+(i+1)+': '+line.slice(0,85));return;}
    const [_,lhs,op,rhs]=m;
    if(op==='=~')factors.add(lhs);
    if(op===':=')return;
    if(op==='=~'){
      rhs.split('+').forEach(term=>{
        const name=term.trim().replace(/^(?:[-+]?(?:\d+(?:\.\d+)?|\.\d+)\s*\*\s*)/,'').trim();
        if(IDENT.test(name)) required.add(name);
        else unsupported.push('Indicador no interpretable en línea '+(i+1)+': '+term.trim().slice(0,45));
      });
    }
  });
  if(!factors.size)throw Error('Se requiere al menos una ecuación de medición con =~ (AFC/SEM).');
  if(unsupported.length)throw Error('La sintaxis contiene expresiones fuera del importador seguro: '+unsupported.slice(0,3).join('; '));
  return {model:clean,factors:[...factors],required:[...required]};
}
function parseJasp(input){
  if(!input||!input.trim())throw Error('Pegue primero la sintaxis de JASP o lavaan.');
  const source=input.replace(/^\uFEFF/,'').trim();
  if(source.length>100000)throw Error('La sintaxis supera el límite de 100 000 caracteres.');
  const looksLikeR=/(?:\b(?:cfa|sem|lavaan)\s*\(|\bmodel\s*(?:<-|=)|\b(?:library|require)\s*\()/i.test(source);
  let model=findModelLiteral(source);
  if(!model){
    if(looksLikeR)throw Error('El código R no contiene un modelo lavaan literal reconocible. Copie las ecuaciones =~ directamente o asigne el modelo a model <- "..." .');
    model=source;
  }
  const inspected=inspectModel(model);
  const options=looksLikeR?parseOptions(source):{warnings:[],ordinal:[]};
  return {...inspected,...options,warnings:[...options.warnings]};
}
function datasetHeaders(){
  if(typeof proCsvText!=='string'||!proCsvText.trim())return null;
  const rows=parseCSV(proCsvText.replace(/^\uFEFF/,''));
  if(!rows.length)throw Error('El CSV del Motor Pro está vacío.');
  return rows[0].map(x=>String(x).trim());
}
function status(message,kind){
  const box=el('jaspImportStatus');
  box.className=kind==='error'?'model-error':'sem-engine-note';
  box.textContent=message;
}
function renderPreview(result){
  el('jaspPreview').value=result.model;
  el('jaspImportSummary').textContent='Modelo: '+result.factors.length+' factores; '+result.required.length+' indicadores. '+(result.estimator?'Estimador: '+result.estimator+'. ':'');
  const heads=datasetHeaders();
  const missing=heads?result.required.filter(x=>!heads.includes(x)):[];
  if(missing.length)result.warnings.push('No aparecen en el CSV cargado: '+missing.join(', ')+'.');
  const warn=el('jaspImportWarnings');
  warn.replaceChildren();
  result.warnings.forEach(message=>{
    const li=document.createElement('li');li.textContent=message;warn.appendChild(li);
  });
  status(heads?(missing.length?'Hay nombres de ítems que no coinciden con la base de datos.':'Modelo leído; las variables de medición coinciden con el CSV.'):'Modelo leído. Importe el CSV en Motor Pro para comprobar los nombres de los ítems.',missing.length?'error':'ok');
  return !missing.length;
}
function inspect(){
  parsed=null;
  el('jaspApply').disabled=true;
  el('jaspApplyRun').disabled=true;
  el('jaspPreview').value='';
  el('jaspImportSummary').textContent='';
  el('jaspImportWarnings').replaceChildren();
  try{
    const result=parseJasp(el('jaspSource').value);
    const namesOK=renderPreview(result);
    if(!namesOK)return;
    parsed=result;
    el('jaspApply').disabled=false;
    el('jaspApplyRun').disabled=false;
  }catch(e){status(e.message,'error');}
}
function apply(run){
  if(!parsed)return status('Revise primero la sintaxis.','error');
  let heads;
  try{heads=datasetHeaders();}catch(e){return status(e.message,'error');}
  if(run&&!heads)return status('Importe primero una base CSV en el Motor Pro.','error');
  if(heads){
    const missing=parsed.required.filter(x=>!heads.includes(x));
    if(missing.length)return status('El CSV no contiene: '+missing.join(', '),'error');
  }
  el('proSyntax').value=parsed.model;
  if(parsed.estimator)el('proEstimator').value=parsed.estimator;
  if(parsed.missing)el('proMissing').value=parsed.missing;
  if(parsed.ordinal.length){
    el('proOrdinalVars').value=parsed.ordinal.join(', ');
    el('proDataType').value='ordinal';
  }else if(parsed.estimator==='WLSMV'){
    el('proDataType').value='ordinal';
  }
  // Valor por omisión de UI = 1000; importación nunca inicia bootstrap no solicitado.
  el('proBootstrap').value='0';
  if(typeof renderActiveResidualCovariances==='function')renderActiveResidualCovariances();
  status('Sintaxis transferida al Motor Pro. Compruebe la configuración del estimador, identificación y datos perdidos.'+(run?' Iniciando el cálculo...':''),'ok');
  if(run)runProModel();
}
el('jaspInspect')?.addEventListener('click',inspect);
el('jaspApply')?.addEventListener('click',()=>apply(false));
el('jaspApplyRun')?.addEventListener('click',()=>apply(true));
el('jaspExample')?.addEventListener('click',()=>{
  el('jaspSource').value="library(lavaan)\nmodel <- '\\nF1 =~ i01 + i02 + i03 + i04 + i05 + i06\\nF2 =~ i07 + i08 + i09 + i10 + i11 + i12\\nF3 =~ i25 + i26 + i27 + i28 + i29 + i30\\nF4 =~ i19 + i20 + i21 + i22 + i23 + i24\\nF5 =~ i13 + i14 + i15 + i16 + i17 + i18\\n'\nfit <- cfa(model, data = datos, estimator = 'WLSMV', ordered = c('i01','i02','i03','i04'))";
  inspect();
});
window.ValiStructJaspImporter=Object.freeze({parse:parseJasp,inspectModel});
})();
