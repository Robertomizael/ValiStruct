/* ValiStruct v5.1 · almacén de participantes en memoria, separado de los jueces.
   No persiste datos ni modifica la matriz de Aiken. */
(function () {
  'use strict';
  let current = null;
  let generation = 0;
  const missing = value => value === undefined || value === null ||
    ['', 'NA', 'N/A', 'NULL', '.'].includes(String(value).trim().toUpperCase());
  const encode = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const safeHash = input => { // Identificador de sesión; NO es huella criptográfica.
    let h = 2166136261;
    for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16);
  };
  const manager = {
    get revision() { return generation; },
    get hasData() { return Boolean(current); },
    get summary() {
      if (!current) return null;
      return Object.freeze({source:current.source,format:current.format,
        n:current.rows.length,variables:[...current.columns],revision:generation,
        labels:Object.freeze({...current.labels}),
        sessionId:current.sessionId});
    },
    setCsv(csvText, metadata = {}) {
      if (typeof parseCSV !== 'function') throw new Error('Importador CSV no disponible.');
      const parsed = parseCSV(String(csvText).replace(/^\uFEFF/, ''));
      if (!parsed.length || !parsed[0].length) throw new Error('La base no contiene encabezados.');
      const columns = parsed[0].map(x => String(x).trim());
      if (columns.some(x => !x) || new Set(columns).size !== columns.length)
        throw new Error('Los nombres de las variables deben existir y ser únicos.');
      const rows = parsed.slice(1).filter(row => row.some(cell => !missing(cell)))
        .map(row => columns.map((_, i) => row[i] ?? ''));
      if (!rows.length) throw new Error('La base no contiene registros.');
      const newFingerprint = safeHash(csvText);
      if (current?.fingerprint === newFingerprint && current?.source === (metadata.source || 'CSV'))
        return this.summary;
      current = {source:metadata.source || 'CSV',format:metadata.format || 'csv',
        columns,rows,fingerprint:newFingerprint,
        labels:metadata.labels && typeof metadata.labels==='object' ? {...metadata.labels} : {},
        sessionId:'participant-'+Date.now().toString(36)+'-'+newFingerprint};
      generation++;
      if (typeof invalidateParticipantAnalyses === 'function') invalidateParticipantAnalyses();
      document.dispatchEvent(new CustomEvent('valistruct:participants-changed',
        {detail:{revision:generation,n:rows.length}}));
      return this.summary;
    },
    toCsv() {
      if (!current) throw new Error('Primero importe la base de participantes en el Centro de datos.');
      return [
        current.columns.map(encode).join(','),
        ...current.rows.map(row => current.columns.map((_,i)=>encode(row[i] ?? '')).join(','))
      ].join('\n');
    },
    numericFrame(options = {}) {
      if (!current) throw new Error('Primero importe la base de participantes en el Centro de datos.');
      const first = options.firstColumn || 'auto';
      const idIndex = first === 'id' ? 0 :
        first === 'auto' && /^(id|folio|participante|sujeto|caso)$/i.test(current.columns[0]) ? 0 : -1;
      const selected = (options.items || []).map(x => String(x).trim()).filter(Boolean);
      const chosen = selected.length ? selected : current.columns.filter((_,i) =>
        i !== idIndex && current.rows.some(r => !missing(r[i])) &&
        current.rows.every(r => missing(r[i]) || Number.isFinite(Number(r[i]))));
      if (!chosen.length) throw new Error('No se detectaron variables numéricas utilizables.');
      const indices = chosen.map(name => {
        const index = current.columns.indexOf(name);
        if (index < 0) throw new Error('No existe la variable: ' + name);
        if (index === idIndex) throw new Error('El identificador no puede ser una variable analítica: ' + name);
        return index;
      });
      const matrix=current.rows.map((row,rowIndex)=>indices.map(index=>{
        const value=row[index];
        if(missing(value))return null;
        const number=Number(value);
        if(!Number.isFinite(number))throw new Error('Dato no numérico en fila '+(rowIndex+2)+', variable '+current.columns[index]+'.');
        return number;
      }));
      const completeRows=[],excludedRows=[];
      matrix.forEach((row,i)=>(row.every(Number.isFinite)?completeRows:excludedRows).push(i+1));
      return {
        itemNames:[...chosen],names:[...chosen],matrix,n:matrix.length,k:chosen.length,
        nOriginal:current.rows.length,nComplete:completeRows.length,nExcluded:excludedRows.length,
        completeRows,excludedRows,revision:generation,source:current.source
      };
    },
    numericMatrix(options = {}) {
      const frame=this.numericFrame(options);
      if(frame.k < 2) throw new Error('Seleccione al menos dos ítems numéricos.');
      const complete=frame.matrix.filter(row=>row.every(Number.isFinite));
      if (complete.length < 2) throw new Error('No hay suficientes casos completos en los ítems seleccionados.');
      return {itemNames:frame.itemNames,matrix:complete,n:complete.length,k:frame.k,
        nOriginal:frame.nOriginal,nExcluded:frame.nExcluded,excludedRows:frame.excludedRows,
        revision:generation,source:frame.source,
        csv:[frame.itemNames.map(encode).join(','), ...complete.map(row=>row.map(encode).join(','))].join('\n')};
    },
    clear() {
      current = null; generation++;
      if (typeof invalidateParticipantAnalyses === 'function') invalidateParticipantAnalyses();
    }
  };
  Object.defineProperty(window,'ValiStructParticipantData',{value:manager,writable:false,configurable:false});
})();