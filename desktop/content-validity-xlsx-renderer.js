(() => {
  'use strict';

  const XLSX_MIME='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const q=id=>document.getElementById(id);
  const csvEsc=v=>`"${String(v??'').replaceAll('"','""')}"`;
  const toCsv=rows=>rows.map(r=>r.map(csvEsc).join(',')).join('\n');

  function parseCsv(text){
    const rows=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],next=text[i+1];
      if(quoted){if(ch==='"'&&next==='"'){cell+='"';i++;}else if(ch==='"')quoted=false;else cell+=ch;}
      else if(ch==='"')quoted=true; else if(ch===','){row.push(cell);cell='';} else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';} else if(ch!=='\r')cell+=ch;
    }
    row.push(cell); if(row.some(x=>String(x).trim()!==''))rows.push(row); return rows;
  }
  const norm=v=>String(v??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[._-]+/g,' ').replace(/\s+/g,' ');

  async function saveXlsx(rows,filename){
    if(!window.valistructDesktop?.createSpreadsheet)throw new Error('El generador XLSX de ValiStruct no está disponible.');
    const result=await window.valistructDesktop.createSpreadsheet(toCsv(rows),'xlsx',{});
    if(!result?.ok||!result.data)throw new Error(result?.error||'No fue posible crear el archivo XLSX.');
    const blob=new Blob([new Uint8Array(result.data)],{type:XLSX_MIME}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);
  }

  function commonHeader(title,purpose,meta){
    const rows=[
      ['VALISTRUCT · VALIDACIÓN DE CONTENIDO POR EXPERTOS'],
      ['Responsable','Dr. Roberto Joel Tirado Reyes'],['Institución','Universidad Autónoma de Sinaloa'],['Facultad','Facultad de Enfermería Culiacán'],
      ['Método',title],['Propósito',purpose]
    ]; Object.entries(meta).forEach(([k,v])=>rows.push([k,v]));
    rows.push([],['INSTRUCCIONES','Complete solamente las columnas de jueces/expertos y Observaciones. No cambie los encabezados. Guarde este mismo archivo .xlsx y súbalo a ValiStruct.'],[]); return rows;
  }

  function currentNames(selector,items){return Array.from({length:items},(_,i)=>document.querySelector(`${selector}[data-item="${i+1}"]`)?.value?.trim()||`Ítem ${i+1}`);}

  async function downloadCvi(){
    const judges=Math.max(2,Number(q('cviJudgeCount')?.value||6)),items=Math.max(1,Number(q('cviItemCount')?.value||5)),min=Number(q('cviScaleMin')?.value||1),max=Number(q('cviScaleMax')?.value||4),rel=Number(q('cviRelevantFrom')?.value||3);
    const rows=commonHeader('I-CVI / S-CVI/Ave','Valorar la relevancia de cada ítem. ValiStruct calculará I-CVI por ítem y S-CVI/Ave para la escala.',{'Número de jueces':judges,'Número de ítems':items,'Escala mínima':min,'Escala máxima':max,'Relevante desde':rel,'Opciones válidas':`${min} a ${max}`});
    rows.push(['Dimensión','No. ítem','Ítem',...Array.from({length:judges},(_,i)=>`Juez ${i+1}`),'Observaciones']);
    currentNames('.cvi-item-name',items).forEach((name,i)=>rows.push(['',i+1,name,...Array(judges).fill(''),'']));
    await saveXlsx(rows,'ValiStruct_plantilla_I-CVI_S-CVI.xlsx');
  }

  async function downloadLawshe(){
    const judges=Math.max(2,Number(q('lawsheJudgeCount')?.value||10)),items=Math.max(1,Number(q('lawsheItemCount')?.value||5));
    const rows=commonHeader('CVR de Lawshe','Clasificar cada ítem según su esencialidad para calcular CVR.',{'Número de jueces':judges,'Número de ítems':items,'Opciones válidas':'Esencial | Útil pero no esencial | No necesario'});
    rows.push(['Dimensión','No. ítem','Ítem',...Array.from({length:judges},(_,i)=>`Juez ${i+1}`),'Observaciones']);
    currentNames('.lawshe-item-name',items).forEach((name,i)=>rows.push(['',i+1,name,...Array(judges).fill(''),'']));
    await saveXlsx(rows,'ValiStruct_plantilla_CVR_Lawshe.xlsx');
  }

  function delphiRoundForTemplate(){const rounds=document.querySelectorAll('.delphi-round');return Math.max(1,rounds.length||1);}
  async function downloadDelphi(){
    const judges=Math.max(3,Number(q('delphiJudgeCount')?.value||8)),items=Math.max(1,Number(q('delphiItemCount')?.value||5)),min=Number(q('delphiScaleMin')?.value||1),max=Number(q('delphiScaleMax')?.value||5),round=delphiRoundForTemplate(),mode=q('delphiMode')?.value==='modified'?'Delphi modificado':'Delphi';
    const rows=commonHeader(mode,'Recoger una ronda de consenso de expertos y conservar su trazabilidad.',{'Modalidad':mode,'Ronda':round,'Número de expertos':judges,'Número de ítems':items,'Escala mínima':min,'Escala máxima':max,'Opciones válidas':`${min} a ${max}`});
    rows.push(['Dimensión','No. ítem','Ítem','Ronda',...Array.from({length:judges},(_,i)=>`Experto ${i+1}`),'Observaciones']);
    const names=Array.from({length:items},(_,i)=>document.querySelector(`.delphi-item-name[data-round="${round}"][data-item="${i+1}"]`)?.value?.trim()||`Ítem ${i+1}`);
    names.forEach((name,i)=>rows.push(['',i+1,name,round,...Array(judges).fill(''),'']));
    await saveXlsx(rows,`ValiStruct_plantilla_${mode.replaceAll(' ','_')}_Ronda_${round}.xlsx`);
  }

  async function readXlsx(file){
    if(!/\.xlsx$/i.test(file.name))throw new Error('Use una plantilla .xlsx de ValiStruct.');
    const result=await window.valistructDesktop.parseSpreadsheet(file.name,new Uint8Array(await file.arrayBuffer()));
    if(!result?.ok||typeof result.csv!=='string')throw new Error(result?.error||'No fue posible leer el XLSX.');
    return parseCsv(result.csv.replace(/^\uFEFF/,''));
  }

  function metadata(rows){const out={}; for(const r of rows.slice(0,20)){if(r?.length>=2&&String(r[0]).trim())out[norm(r[0])]=String(r[1]??'').trim();}return out;}
  function matrix(rows,expertPrefix){
    const idx=rows.findIndex(r=>{const h=(r||[]).map(norm);return h.includes('item')&&h.some(x=>new RegExp(`^(?:juez|experto)\\s*\\d+$`).test(x));});
    if(idx<0)throw new Error('No se encontró la matriz de respuestas. No cambie los encabezados de la plantilla.');
    const h=rows[idx].map(norm),itemIdx=h.indexOf('item'),obsIdx=h.findIndex(x=>['observaciones','observacion','comentarios','comentario'].includes(x)),roundIdx=h.indexOf('ronda');
    const judges=h.map((x,i)=>new RegExp(`^(?:juez|experto)\\s*(\\d+)$`).exec(x)?{i,n:Number(RegExp.$1)}:null).filter(Boolean).sort((a,b)=>a.n-b.n);
    const data=rows.slice(idx+1).filter(r=>r&&r.some(v=>String(v??'').trim()!=='')).map(r=>({item:String(r[itemIdx]??'').trim(),round:roundIdx>=0?Number(r[roundIdx])||1:1,ratings:judges.map(c=>String(r[c.i]??'').trim()),observation:obsIdx>=0?String(r[obsIdx]??'').trim():''})).filter(x=>x.item);
    if(!data.length)throw new Error('La plantilla no contiene ítems.'); return{data,judges:judges.length};
  }

  function setNum(id,v){const el=q(id);if(el&&Number.isFinite(Number(v)))el.value=Number(v);}
  function validateNumericRatings(data,min,max,label){for(const row of data){if(row.ratings.length<2||row.ratings.some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max))throw new Error(`Complete todas las respuestas de ${row.item} con valores ${min}-${max} antes de importar ${label}.`);}}

  async function importCvi(file){
    const rows=await readXlsx(file),meta=metadata(rows),m=matrix(rows,'juez'); const min=Number(meta['escala minima']||q('cviScaleMin')?.value||1),max=Number(meta['escala maxima']||q('cviScaleMax')?.value||4); validateNumericRatings(m.data,min,max,'I-CVI/S-CVI');
    setNum('cviJudgeCount',m.judges);setNum('cviItemCount',m.data.length);setNum('cviScaleMin',min);setNum('cviScaleMax',max);if(meta['relevante desde'])setNum('cviRelevantFrom',meta['relevante desde']); q('buildCvi')?.click();
    m.data.forEach((r,i)=>{const item=i+1;const name=document.querySelector(`.cvi-item-name[data-item="${item}"]`);if(name)name.value=r.item;r.ratings.forEach((v,j)=>{const el=document.querySelector(`.cvi-rating[data-item="${item}"][data-judge="${j+1}"]`);if(el)el.value=Number(v);});});
    q('cviResults').innerHTML='<div class="notice"><strong>XLSX importado correctamente.</strong> La estructura y las puntuaciones fueron validadas. Pulse “Calcular I-CVI / S-CVI/Ave”.</div>';
  }

  function lawValue(v){const n=norm(v);if(n==='esencial'||n==='essential')return'essential';if(n==='util pero no esencial'||n==='util no esencial'||n==='useful')return'useful';if(n==='no necesario'||n==='innecesario'||n==='unnecessary')return'unnecessary';return null;}
  async function importLawshe(file){
    const rows=await readXlsx(file),m=matrix(rows,'juez'); for(const r of m.data){if(r.ratings.some(v=>!lawValue(v)))throw new Error(`Respuesta no válida en ${r.item}. Use: Esencial, Útil pero no esencial o No necesario.`);}
    setNum('lawsheJudgeCount',m.judges);setNum('lawsheItemCount',m.data.length);q('buildLawshe')?.click();m.data.forEach((r,i)=>{const item=i+1,name=document.querySelector(`.lawshe-item-name[data-item="${item}"]`);if(name)name.value=r.item;r.ratings.forEach((v,j)=>{const el=document.querySelector(`.lawshe-rating[data-item="${item}"][data-judge="${j+1}"]`);if(el)el.value=lawValue(v);});});q('lawsheResults').innerHTML='<div class="notice"><strong>XLSX importado correctamente.</strong> Clasificaciones validadas. Pulse “Calcular CVR”.</div>';
  }

  const delphiImported=new Map();
  async function importDelphi(file){
    const rows=await readXlsx(file),meta=metadata(rows),m=matrix(rows,'experto'),round=Math.max(1,Number(meta['ronda']||m.data[0]?.round||1)),min=Number(meta['escala minima']||q('delphiScaleMin')?.value||1),max=Number(meta['escala maxima']||q('delphiScaleMax')?.value||5);validateNumericRatings(m.data,min,max,'Delphi'); delphiImported.set(round,{...m,round,min,max,mode:norm(meta['modalidad']).includes('modificado')?'modified':'classic'});
    const maxRound=Math.max(...delphiImported.keys());const first=delphiImported.get(Math.min(...delphiImported.keys()));setNum('delphiJudgeCount',first.judges);setNum('delphiItemCount',first.data.length);setNum('delphiScaleMin',first.min);setNum('delphiScaleMax',first.max);if(q('delphiMode'))q('delphiMode').value=first.mode;q('buildDelphi')?.click();for(let r=2;r<=maxRound;r++)q('addDelphiRound')?.click();
    delphiImported.forEach((entry,r)=>entry.data.forEach((row,i)=>{const item=i+1,name=document.querySelector(`.delphi-item-name[data-round="${r}"][data-item="${item}"]`);if(name)name.value=row.item;row.ratings.forEach((v,j)=>{const el=document.querySelector(`.delphi-rating[data-round="${r}"][data-item="${item}"][data-judge="${j+1}"]`);if(el)el.value=Number(v);});const c=document.querySelector(`.delphi-comment[data-round="${r}"][data-item="${item}"]`);if(c)c.value=row.observation||'';}));
    q('delphiResults').innerHTML=`<div class="notice"><strong>Ronda ${round} importada.</strong> Se conservan ${delphiImported.size} ronda(s) cargadas. Complete todas las rondas necesarias y pulse “Evaluar consenso”.</div>`;
  }

  function addControls(hostId,prefix,downloadFn,importFn,label){
    const host=q(hostId);if(!host||q(`${prefix}XlsxControls`))return;const box=document.createElement('div');box.id=`${prefix}XlsxControls`;box.className='import-box';box.innerHTML=`<div><h3>Flujo XLSX para expertos</h3><p>Descargue la plantilla, envíela a los expertos y vuelva a cargar el mismo archivo completado. ValiStruct validará la estructura antes del análisis.</p></div><div class="button-row compact"><button type="button" id="${prefix}DownloadXlsx">Descargar plantilla XLSX</button><label class="file-button">Subir XLSX completado<input id="${prefix}UploadXlsx" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div>`;host.insertAdjacentElement('afterend',box);
    q(`${prefix}DownloadXlsx`)?.addEventListener('click',async()=>{try{await downloadFn();}catch(e){alert(e.message);}});q(`${prefix}UploadXlsx`)?.addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{await importFn(f);}catch(err){alert(`No fue posible importar ${label}: ${err.message}`);}finally{e.target.value='';}});
  }

  addControls('cviWorkspace','cvi',downloadCvi,importCvi,'I-CVI/S-CVI');
  addControls('lawsheWorkspace','lawshe',downloadLawshe,importLawshe,'CVR de Lawshe');
  addControls('delphiWorkspace','delphi',downloadDelphi,importDelphi,'Delphi');
})();
