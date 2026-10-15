/* ValiStruct v5.1 · navegación por etapas sin eliminar módulos anteriores.
   Se ejecuta antes de app.js para preservar los manejadores sobre cada botón original. */
(function () {
  'use strict';
  const nav = document.querySelector('nav.nav');
  if (!nav || nav.dataset.v51Grouped === 'yes') return;
  const originalButtons = [...nav.querySelectorAll('button[data-section]')];
  const byId = new Map(originalButtons.map(button => [button.dataset.section, button]));
  nav.dataset.v51Grouped = 'yes';
  nav.classList.add('nav-v51');
  nav.setAttribute('aria-label', 'Navegación de ValiStruct por etapas');
  const makeGroup = (title, ids, open = false) => {
    const detail = document.createElement('details');
    detail.className = 'nav-v51-group';
    detail.open = open;
    const summary = document.createElement('summary');
    summary.textContent = title;
    detail.appendChild(summary);
    const contents = document.createElement('div');
    contents.className = 'nav-v51-items';
    ids.forEach(id => {
      const button = byId.get(id);
      if (button) { contents.appendChild(button); byId.delete(id); }
    });
    detail.appendChild(contents);
    nav.appendChild(detail);
    return detail;
  };
  nav.replaceChildren();
  const home = byId.get('inicio');
  if (home) { home.classList.add('nav-v51-primary'); nav.appendChild(home); byId.delete('inicio'); }
  makeGroup('Etapa I · Validación interna', ['aiken','efa','cfa','reliability','diagnostics','multidiag','missingpro','advanced'], true);
  const external = document.createElement('div');
  external.className = 'nav-v51-coming';
  external.setAttribute('aria-label', 'Etapa IV de validación externa');
  external.textContent = 'Etapa IV · Estabilidad, criterio y rendimiento';
  nav.appendChild(external);
  makeGroup('Datos y resultados', ['dataimport','legacyimport','projects','qualitydashboard','resultcenter','reportapa','articletables','history','encryption','privacy'], true);
  const motor = byId.get('motorpro');
  if (motor) { motor.classList.add('nav-v51-primary','nav-v51-motor'); nav.appendChild(motor); byId.delete('motorpro'); }
  makeGroup('Herramientas avanzadas y administración', [...byId.keys()], false);
  const credit = document.createElement('p');
  credit.className = 'nav-v51-credit';
  credit.innerHTML = '<strong>Dr. Roberto Joel Tirado Reyes</strong><br>Autor conceptual y director científico';
  nav.appendChild(credit);

  /* Cargadores aislados de Etapa IV. Si un archivo no existe, el resto de
     ValiStruct continúa sin alteración. */
  window.addEventListener('load', () => {
    const loadModule=(globalName,file,datasetName,label)=>{
      if(window[globalName]){ window[globalName].mount?.(window); return; }
      const script=document.createElement('script');
      script.src=file;
      script.dataset.valistructModule=datasetName;
      script.addEventListener('load',()=>window[globalName]?.mount?.(window));
      script.addEventListener('error',()=>console.warn('ValiStruct: módulo de '+label+' no disponible; núcleo sin cambios.'));
      document.head.appendChild(script);
    };
    loadModule('ValiStructStability','stability-v54.js','stability-v54','estabilidad');
    loadModule('ValiStructCriterion','criterion-v54.js','criterion-v54','validez de criterio');

    /* Corrección visual localizada del shell preparatorio restante. */
    const performance=document.getElementById('performance');
    const eyebrow=performance?.querySelector('.vs-v52-eyebrow');
    if(eyebrow) eyebrow.textContent='ETAPA IV · VALIDACIÓN EXTERNA';
  }, {once:true});
})();