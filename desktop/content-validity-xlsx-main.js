'use strict';

const { ipcMain } = require('electron');
const XLSX = require('xlsx');

const norm = value => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ');
const rowsOf = sheet => XLSX.utils.sheet_to_json(sheet,{header:1,defval:'',raw:false,blankrows:false});
const judgeColumns = headers => headers.map((x,i)=>{const m=norm(x).match(/^(?:juez|experto)\s*(\d+)$/);return m?{idx:i,num:Number(m[1])}:null;}).filter(Boolean).sort((a,b)=>a.num-b.num);
const findCol = (headers,names) => headers.map(norm).findIndex(x=>names.includes(x));

function instructionsSheet(title, purpose, rows=[]){
  const data=[
    ['UNIVERSIDAD AUTÓNOMA DE SINALOA · FACULTAD DE ENFERMERÍA CULIACÁN'],[''],[title],
    ['Plantilla compatible con ValiStruct para validación de contenido por expertos'],[''],
    ['Responsable','Dr. Roberto Joel Tirado Reyes'],['Propósito',purpose],[''],...rows,
    [''],['INSTRUCCIONES'],['Complete únicamente las celdas de respuesta y observaciones. No cambie nombres de hojas ni encabezados. Guarde el archivo como .xlsx y cárguelo directamente en ValiStruct.']
  ];
  const ws=XLSX.utils.aoa_to_sheet(data); ws['!cols']=[{wch:30},{wch:100},{wch:60}];
  return ws;
}

function appendDictionary(wb, rows){
  const ws=XLSX.utils.aoa_to_sheet([['Campo','Descripción','Regla para importación'],...rows]);
  ws['!cols']=[{wch:24},{wch:70},{wch:72}]; XLSX.utils.book_append_sheet(wb,ws,'Diccionario');
}

function baseOptions(o){
  return {judges:Math.max(2,Math.floor(Number(o.judges)||5)),items:Math.max(1,Math.floor(Number(o.items)||5)),itemNames:Array.isArray(o.itemNames)?o.itemNames:[]};
}

function buildCvi(o={}){
  const b=baseOptions(o), min=Number.isFinite(Number(o.min))?Number(o.min):1, max=Number.isFinite(Number(o.max))?Number(o.max):4, relevantFrom=Number.isFinite(Number(o.relevantFrom))?Number(o.relevantFrom):3;
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,instructionsSheet('JUICIO DE EXPERTOS · I-CVI / S-CVI/Ave','Valorar la relevancia de los ítems para calcular I-CVI por ítem y S-CVI/Ave para la escala.',[
    ['Número de expertos',b.judges],['Escala mínima',min],['Escala máxima',max],['Se considera relevante desde',relevantFrom],
    ['Codificación',`Use valores enteros de ${min} a ${max}. ValiStruct considerará relevantes las puntuaciones ≥ ${relevantFrom}.`]
  ]),'Instrucciones');
  const h=['Dimensión','No. ítem','Ítem',...Array.from({length:b.judges},(_,i)=>`Juez ${i+1}`),'Observaciones'];
  const data=[h]; for(let i=1;i<=b.items;i++)data.push(['',i,String(b.itemNames[i-1]||`Ítem ${i}`),...Array(b.judges).fill(''),'']);
  const ws=XLSX.utils.aoa_to_sheet(data); ws['!cols']=[{wch:28},{wch:10},{wch:70},...Array.from({length:b.judges},()=>({wch:12})),{wch:45}]; ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:data.length-1,c:h.length-1}})}; XLSX.utils.book_append_sheet(wb,ws,'Matriz_CVI');
  appendDictionary(wb,[['Ítem','Texto del reactivo.','No modificar después de distribuir.'],['Juez 1…n',`Valor entero ${min}-${max}.`,'No dejar vacía una respuesta incluida en el análisis.'],['Observaciones','Comentario cualitativo.','Opcional.'],['Compatibilidad','Matriz_CVI es reconocida automáticamente por ValiStruct.','Conservar hoja y encabezados.']]);
  return wb;
}

function buildLawshe(o={}){
  const b=baseOptions(o); const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,instructionsSheet('JUICIO DE EXPERTOS · CVR DE LAWSHE','Clasificar cada ítem según su esencialidad para calcular CVR.',[
    ['Número de expertos',b.judges],['Opciones válidas','Esencial | Útil pero no esencial | No necesario'],['Fórmula','CVR = (Ne − N/2) / (N/2)']
  ]),'Instrucciones');
  const h=['Dimensión','No. ítem','Ítem',...Array.from({length:b.judges},(_,i)=>`Juez ${i+1}`),'Observaciones'];
  const data=[h]; for(let i=1;i<=b.items;i++)data.push(['',i,String(b.itemNames[i-1]||`Ítem ${i}`),...Array(b.judges).fill(''),'']);
  const ws=XLSX.utils.aoa_to_sheet(data); ws['!cols']=[{wch:28},{wch:10},{wch:70},...Array.from({length:b.judges},()=>({wch:22})),{wch:45}]; XLSX.utils.book_append_sheet(wb,ws,'Matriz_Lawshe');
  appendDictionary(wb,[['Juez 1…n','Clasificación del ítem.','Solo: Esencial, Útil pero no esencial, No necesario.'],['Observaciones','Comentario cualitativo.','Opcional.'],['Compatibilidad','Matriz_Lawshe es reconocida automáticamente por ValiStruct.','Conservar hoja y encabezados.']]);
  return wb;
}

function buildDelphi(o={}){
  const b=baseOptions(o), min=Number.isFinite(Number(o.min))?Number(o.min):1,max=Number.isFinite(Number(o.max))?Number(o.max):5,round=Math.max(1,Math.floor(Number(o.round)||1)),mode=o.mode==='modified'?'Delphi modificado':'Delphi';
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,instructionsSheet(`JUICIO DE EXPERTOS · ${mode.toUpperCase()} · RONDA ${round}`,'Recoger valoraciones de una ronda Delphi conservando trazabilidad entre rondas.',[
    ['Modalidad',mode],['Ronda',round],['Número de expertos',b.judges],['Escala mínima',min],['Escala máxima',max],['Nota metodológica','Delphi es un proceso iterativo; ValiStruct resume acuerdo, mediana e IQR y conserva cada ronda por separado.']
  ]),'Instrucciones');
  const h=['Dimensión','No. ítem','Ítem','Ronda',...Array.from({length:b.judges},(_,i)=>`Experto ${i+1}`),'Observaciones'];
  const data=[h]; for(let i=1;i<=b.items;i++)data.push(['',i,String(b.itemNames[i-1]||`Ítem ${i}`),round,...Array(b.judges).fill(''),'']);
  const ws=XLSX.utils.aoa_to_sheet(data); ws['!cols']=[{wch:28},{wch:10},{wch:70},{wch:10},...Array.from({length:b.judges},()=>({wch:13})),{wch:48}]; XLSX.utils.book_append_sheet(wb,ws,`Ronda_${round}`);
  appendDictionary(wb,[['Ronda','Número de ronda Delphi.','No modificar.'],['Experto 1…n',`Valor entero ${min}-${max}.`,'Mantener la misma escala entre rondas comparadas.'],['Observaciones','Justificación o propuesta del experto.','Opcional.'],['Compatibilidad','Ronda_n es reconocida automáticamente por ValiStruct.','Conservar hoja y encabezados.']]);
  return wb;
}

function findProfileSheet(wb,profile){
  const rx=profile==='cvi'?/^matriz[ _-]*cvi$/i:profile==='lawshe'?/^matriz[ _-]*lawshe$/i:/^ronda[ _-]*\d+$/i;
  return wb.SheetNames.find(n=>rx.test(n));
}

function canonicalize(wb,profile){
  const name=findProfileSheet(wb,profile); if(!name)throw new Error(`No se encontró una hoja compatible con ${profile.toUpperCase()}.`);
  const rows=rowsOf(wb.Sheets[name]); if(rows.length<2)throw new Error('La matriz no contiene respuestas.');
  const headers=rows[0], judges=judgeColumns(headers), itemIdx=findCol(headers,['item']), numIdx=findCol(headers,['no item','numero item','numero de item']), obsIdx=findCol(headers,['observaciones','observacion','comentario','comentarios']), roundIdx=findCol(headers,['ronda']);
  if(itemIdx<0||judges.length<2)throw new Error('La hoja debe contener Ítem y al menos dos columnas Juez/Experto.');
  const out=[];
  for(const row of rows.slice(1)){
    if(!row||!row.some(v=>String(v??'').trim()))continue;
    const item=String(row[itemIdx]??'').trim() || (numIdx>=0?`Ítem ${row[numIdx]}`:''); if(!item)continue;
    out.push({item,round:roundIdx>=0?Number(row[roundIdx])||1:1,ratings:judges.map(c=>String(row[c.idx]??'').trim()),observation:obsIdx>=0?String(row[obsIdx]??'').trim():''});
  }
  if(!out.length)throw new Error('No se encontraron ítems para importar.');
  let config={judges:judges.length,items:out.length};
  const inst=wb.SheetNames.find(n=>norm(n).includes('instrucciones'));
  if(inst){for(const row of rowsOf(wb.Sheets[inst])){const k=norm(row?.[0]),v=row?.[1]; if(k==='escala minima')config.min=Number(v); else if(k==='escala maxima')config.max=Number(v); else if(k==='se considera relevante desde')config.relevantFrom=Number(v); else if(k==='modalidad')config.mode=norm(v).includes('modificado')?'modified':'classic'; else if(k==='ronda')config.round=Number(v)||1;}}
  return {profile,rows:out,config,sheet:name};
}

function install(){
  ipcMain.removeHandler('valistruct:create-content-validity-xlsx');
  ipcMain.removeHandler('valistruct:parse-content-validity-xlsx');
  ipcMain.handle('valistruct:create-content-validity-xlsx',async(_e,p)=>{
    try{const profile=String(p?.profile||''); const options=p?.options||{}; const wb=profile==='cvi'?buildCvi(options):profile==='lawshe'?buildLawshe(options):profile==='delphi'?buildDelphi(options):null; if(!wb)return{ok:false,error:'Perfil XLSX no compatible.'}; const data=XLSX.write(wb,{type:'buffer',bookType:'xlsx',compression:true}); return{ok:true,data:new Uint8Array(data)};}catch(err){return{ok:false,error:err?.message||String(err)};}
  });
  ipcMain.handle('valistruct:parse-content-validity-xlsx',async(_e,p)=>{
    try{const bytes=p?.data;if(!bytes)return{ok:false,error:'El archivo está vacío.'}; const wb=XLSX.read(Buffer.from(bytes),{type:'buffer',cellDates:true}); const profiles=['cvi','lawshe','delphi']; for(const profile of profiles){if(findProfileSheet(wb,profile)){const r=canonicalize(wb,profile);return{ok:true,...r};}} return{ok:false,error:'No se identificó una plantilla ValiStruct de CVI, Lawshe o Delphi.'};}catch(err){return{ok:false,error:err?.message||String(err)};}
  });
}

module.exports={install,buildCvi,buildLawshe,buildDelphi,canonicalize};
