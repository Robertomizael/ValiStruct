/* ValiStruct v5.2 · Interfaz modular.
 * Preserva los nodos heredados y sus manejadores; inserta tres espacios
 * de validación externa sin fingir cálculos no implementados.
 * Se carga después de navigation-v51.js y antes de app.js.
 */
(function () {
  'use strict';
  const nav = document.querySelector('nav.nav');
  const main = document.getElementById('mainContent');
  if (!nav || !main || nav.dataset.v52Ready === 'yes') return;
  document.body.classList.add('vs-v52');
  nav.dataset.v52Ready = 'yes';
  nav.dataset.valistructNav = 'v5';

  const original = [...nav.querySelectorAll('button[data-section]')];
  const byId = new Map(original.map(button => [button.dataset.section, button]));
  const externalModules = [
    {id:'stability',title:'Estabilidad y concordancia',icon:'↔',
      subtitle:'Test–retest, concordancia entre evaluadores e instrumentos',
      procedures:[
        {value:'test-retest',label:'Estabilidad test–retest (CCI / correlación)'},
        {value:'kappa',label:'Concordancia categórica (kappa de Cohen)'},
        {value:'kappa-weighted',label:'Concordancia ordinal (kappa ponderado)'},
        {value:'icc',label:'Concordancia cuantitativa (CCI configurable)'}],
      description:'La correlación mide asociación; el CCI y kappa permiten evaluar concordancia según el tipo de dato.'},
    {id:'criterion',title:'Validez de criterio',icon:'◎',
      subtitle:'Evidencia concurrente y predictiva frente a un criterio externo',
      procedures:[
        {value:'concurrent',label:'Criterio concurrente · correlación'},
        {value:'predictive',label:'Criterio predictivo · correlación'},
        {value:'linear',label:'Regresión lineal'},
        {value:'logistic',label:'Regresión logística'}],
      description:'Seleccione un criterio externo y documente si se mide simultáneamente o en un momento posterior.'},
    {id:'performance',title:'Rendimiento y baremación',icon:'◉',
      subtitle:'Curvas ROC, umbrales de decisión y normas descriptivas',
      procedures:[
        {value:'roc',label:'ROC / AUC · criterio binario'},
        {value:'youden',label:'Umbral mediante índice de Youden'},
        {value:'norms',label:'Percentiles y puntuaciones normalizadas'},
        {value:'bands',label:'Bandas descriptivas / semáforo configurable'}],
      description:'Un punto de corte necesita criterio externo. Los percentiles y las bandas descriptivas no equivalen a umbrales clínicos.'}
  ];

  // Crear paneles reales antes de que app.js registre los botones de navegación.
  externalModules.forEach(module => {
    if (!document.getElementById(module.id)) {
      const section = document.createElement('section');
      section.id = module.id;
      section.className = 'panel vs-v52-module';
      section.innerHTML = `
        <div class="vs-v52-breadcrumb">Inicio <span>›</span> Validación externa <span>›</span> ${module.title}</div>
        <div class="vs-v52-module-header">
          <div><span class="vs-v52-eyebrow">ETAPA II · VALIDACIÓN EXTERNA</span>
          <h2>${module.title}</h2><p>${module.subtitle}</p></div>
          <span class="vs-v52-status">Interfaz de preparación</span>
        </div>
        <div class="vs-v52-context">${module.description}</div>
        <div class="vs-v52-form-card">
          <div class="vs-v52-card-heading"><span class="vs-v52-step">01</span>
            <div><h3>Prepare el análisis</h3><p>Seleccione las variables y documente la configuración metodológica.</p></div>
          </div>
          <div class="vs-v52-form-grid">
            <label>Procedimiento<select class="vs-v52-procedure">${module.procedures.map(p=>`<option value="${p.value}">${p.label}</option>`).join('')}</select></label>
            <label>Variable o puntuación principal<input class="vs-v52-variable" type="text" placeholder="Ej.: Total_instrumento"></label>
            <label>Variable de comparación o criterio<input class="vs-v52-reference" type="text" placeholder="Ej.: Retest_total / Diagnóstico"></label>
            <label>Variable identificadora<input class="vs-v52-join" type="text" placeholder="Ej.: ID (para unir bases)"></label>
          </div>
          <div class="vs-v52-linked-data" role="status">No se ha seleccionado una base de participantes.</div>
          <div class="vs-v52-actions">
            <button type="button" class="vs-v52-outline vs-v52-open-data">Abrir Centro de datos</button>
            <button type="button" class="vs-v52-primary vs-v52-save">Guardar configuración en esta sesión</button>
          </div>
          <p class="vs-v52-method-note">Los cálculos estadísticos y las exportaciones de este módulo se habilitarán tras su implementación y contraste con R. Esta pantalla no presenta estimaciones simuladas.</p>
          <div class="vs-v52-config-status" role="status" aria-live="polite"></div>
        </div>
        <details class="vs-v52-help"><summary>Ayuda metodológica y criterios de interpretación</summary>
          <p>${module.description} Los resultados deberán incluir tamaños de muestra, manejo de faltantes, parámetros del procedimiento e intervalos de confianza cuando correspondan.</p>
        </details>`;
      main.appendChild(section);
    }
    if (!byId.has(module.id)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.section = module.id;
      button.textContent = module.title;
      byId.set(module.id, button);
    }
  });

  const icon = (name) => ({
    home:'⌂',database:'▤',internal:'◇',external:'◎',
    motor:'⌘',report:'▧',project:'▣',advanced:'⚙'
  })[name] || '◦';

  const groups = [
    {name:'Centro de datos',glyph:icon('database'),open:false,ids:['dataimport','legacyimport','diagnostics','multidiag','missingpro']},
    {name:'Validación interna',glyph:icon('internal'),open:true,ids:['aiken','efa','cfa','reliability','advanced']},
    {name:'Validación externa',glyph:icon('external'),open:false,ids:['stability','criterion','performance']},
    {name:'Resultados y reportes',glyph:icon('report'),open:false,ids:['qualitydashboard','resultcenter','reportapa','articletables','conclusionassistant','finalcheck','journalready']},
    {name:'Proyectos',glyph:icon('project'),open:false,ids:['projects','guidedproject','history','migration','privacy','encryption','profiles']}
  ];
  nav.replaceChildren();
  nav.classList.add('nav-v52');
  nav.setAttribute('aria-label','Navegación científica');
  const brand=document.createElement('div');
  brand.className='vs-v52-brand';
  brand.innerHTML='<span class="vs-v52-brand-symbol" aria-hidden="true">V</span><div><strong>ValiStruct</strong><small>Plataforma científica</small></div>';
  nav.appendChild(brand);
  const home = byId.get('inicio');
  if (home) {
    home.classList.add('vs-v52-nav-home');
    home.innerHTML='<span aria-hidden="true">'+icon('home')+'</span><span>Inicio</span>';
    nav.appendChild(home);
    byId.delete('inicio');
  }
  const groupElements=[];
  groups.forEach(group=>{
    const wrap=document.createElement('details');
    wrap.className='vs-v52-group';
    wrap.open=group.open;
    const head=document.createElement('summary');
    head.innerHTML='<span class="vs-v52-group-icon" aria-hidden="true">'+group.glyph+'</span><span>'+group.name+'</span><span class="vs-v52-chevron" aria-hidden="true">⌄</span>';
    wrap.appendChild(head);
    const items=document.createElement('div');
    items.className='vs-v52-group-items';
    group.ids.forEach(id=>{
      const btn=byId.get(id);if(!btn)return;
      btn.classList.add('vs-v52-item');
      if(id==='efa')btn.textContent='Análisis factorial exploratorio';
      if(id==='cfa')btn.textContent='Análisis factorial confirmatorio';
      if(id==='aiken')btn.textContent='Validez de contenido · V de Aiken';
      if(id==='reliability')btn.textContent='Fiabilidad';
      if(id==='dataimport')btn.textContent='Base de participantes';
      items.appendChild(btn);byId.delete(id);
    });
    wrap.appendChild(items);nav.appendChild(wrap);groupElements.push(wrap);
    wrap.addEventListener('toggle',()=>{
      if(wrap.open)groupElements.forEach(other=>{if(other!==wrap)other.open=false;});
    });
  });
  const motor=byId.get('motorpro');
  if(motor){
    motor.classList.add('vs-v52-motor');
    motor.innerHTML='<span aria-hidden="true">'+icon('motor')+'</span><span>Motor Pro · R/lavaan</span>';
    nav.appendChild(motor);byId.delete('motorpro');
  }
  const other=document.createElement('details');
  other.className='vs-v52-group vs-v52-other';
  other.innerHTML='<summary><span class="vs-v52-group-icon" aria-hidden="true">'+icon('advanced')+'</span><span>Más herramientas</span><span class="vs-v52-chevron">⌄</span></summary>';
  const otherItems=document.createElement('div');otherItems.className='vs-v52-group-items';
  byId.forEach(button=>{button.classList.add('vs-v52-item');otherItems.appendChild(button)});
  other.appendChild(otherItems);nav.appendChild(other);groupElements.push(other);
  other.addEventListener('toggle',()=>{if(other.open)groupElements.forEach(x=>{if(x!==other)x.open=false;})});
  const footer=document.createElement('div');
  footer.className='vs-v52-sidebar-credit';
  footer.innerHTML='<strong>Dr. Roberto Joel Tirado Reyes</strong><span>Autor conceptual y director científico</span>';
  nav.appendChild(footer);

  // Portada breve: oculta el catálogo heredado, que permanece intacto para revertir.
  const initial=document.getElementById('inicio');
  if(initial){
    const dashboard=document.createElement('div');
    dashboard.className='vs-v52-dashboard';
    dashboard.innerHTML=`
      <div class="vs-v52-welcome">
        <div><span class="vs-v52-eyebrow">VALISTRUCT · ESPACIO DE INVESTIGACIÓN</span>
          <h2>Su investigación, paso a paso.</h2>
          <p>Organice sus datos, construya evidencia de validación y recupere sus resultados desde un mismo espacio de trabajo.</p>
          <div class="vs-v52-hero-actions">
            <button type="button" data-vs-target="guidedproject" class="vs-v52-primary">Nuevo proyecto <span aria-hidden="true">↗</span></button>
            <button type="button" data-vs-target="projects" class="vs-v52-outline">Abrir proyecto</button>
          </div>
        </div><div class="vs-v52-hero-mark" aria-hidden="true"><span>V</span><span>✧</span></div>
      </div>
      <div class="vs-v52-overview">
        <div class="vs-v52-overview-title"><h3>¿En qué desea trabajar?</h3><p>Seleccione una actividad para abrir únicamente ese módulo.</p></div>
        <div class="vs-v52-quick-grid">
          <button type="button" data-vs-target="dataimport"><span class="vs-v52-quick-icon">▤</span><strong>Importar datos</strong><small>Participantes, ítems y dimensiones</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="aiken"><span class="vs-v52-quick-icon">◇</span><strong>Validación interna</strong><small>Contenido, AFE, AFC y fiabilidad</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="stability"><span class="vs-v52-quick-icon">◎</span><strong>Validación externa</strong><small>Estabilidad, criterio y rendimiento</small><span class="vs-v52-link-arrow">↗</span></button>
          <button type="button" data-vs-target="resultcenter"><span class="vs-v52-quick-icon">▧</span><strong>Resultados</strong><small>Tablas, informes y exportación</small><span class="vs-v52-link-arrow">↗</span></button>
        </div>
      </div>
      <div class="vs-v52-home-bottom"><span class="vs-v52-live-dot"></span><span>Motor Pro disponible desde el menú lateral. V de Aiken utiliza una base independiente de jueces expertos.</span></div>`;
    initial.insertBefore(dashboard,initial.firstChild);
    initial.classList.add('vs-v52-home');
    dashboard.querySelectorAll('[data-vs-target]').forEach(btn=>btn.addEventListener('click',()=>{
      nav.querySelector('button[data-section="'+btn.dataset.vsTarget+'"]')?.click();
    }));
  }

  // Conservar la navegación nativa de app.js. La vista activa es siempre una.
  const activateGroup=()=>{
    const active=nav.querySelector('button[data-section].active');
    const parent=active?.closest('details');
    if(parent && !parent.open)parent.open=true;
    const label=active?.textContent.trim() || 'Inicio';
    const bar=document.querySelector('.vs-v52-current-module');
    if(bar)bar.textContent=label;
  };
  nav.addEventListener('click',event=>{if(event.target.closest('button[data-section]'))setTimeout(activateGroup,0)});
  const observer=new MutationObserver(activateGroup);
  nav.querySelectorAll('button[data-section]').forEach(btn=>observer.observe(btn,{attributes:true,attributeFilter:['class']}));

  const current=document.createElement('div');current.className='vs-v52-current';
  current.innerHTML='<span class="vs-v52-current-dot"></span><span class="vs-v52-current-module">Inicio</span>';
  const header=document.querySelector('.topbar');
  if(header)header.appendChild(current);
  activateGroup();

  externalModules.forEach(module=>{
    const panel=document.getElementById(module.id);
    const status=panel.querySelector('.vs-v52-linked-data');
    const refresh=()=>{
      const summary=window.ValiStructParticipantData?.summary;
      status.textContent=summary ?
        'Base disponible: '+summary.source+' · '+summary.n+' participantes · '+summary.variables.length+' variables. Verifique la correspondencia por ID antes de combinar mediciones.' :
        'Sin base compartida. Importe participantes desde el Centro de datos.';
    };
    panel.querySelector('.vs-v52-open-data').addEventListener('click',()=>{
      nav.querySelector('button[data-section="dataimport"]')?.click();
    });
    panel.querySelector('.vs-v52-save').addEventListener('click',()=>{
      const procedure=panel.querySelector('.vs-v52-procedure');
      const variable=panel.querySelector('.vs-v52-variable').value.trim();
      const reference=panel.querySelector('.vs-v52-reference').value.trim();
      const join=panel.querySelector('.vs-v52-join').value.trim();
      const feedback=panel.querySelector('.vs-v52-config-status');
      if(!variable || !reference){feedback.textContent='Especifique la variable principal y la variable de comparación.';return;}
      const summary=window.ValiStructParticipantData?.summary;
      if(summary && (!summary.variables.includes(variable) || !summary.variables.includes(reference))){
        feedback.textContent='Revise los nombres: las variables deben existir en la base activa. Bases externas se integrarán en la siguiente fase.';return;
      }
      panel.dataset.configured='yes'; // Solo metadatos de preparación; nunca guarda datos crudos.
      feedback.textContent='Configuración de '+procedure.selectedOptions[0].textContent+
        ' preparada para esta sesión'+(join?' · clave de unión: '+join:'')+
        '. Cálculo pendiente de implementación estadística validada.';
    });
    refresh();
    document.addEventListener('valistruct:participants-changed',refresh);
  });
})();
