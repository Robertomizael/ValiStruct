'use strict';

(() => {
  const nav = document.querySelector('.nav');
  const main = document.querySelector('main');
  const topbar = document.querySelector('.topbar');
  if (!nav || !main || nav.dataset.uxReady === '1') return;
  nav.dataset.uxReady = '1';

  const groups = [
    { title: 'Inicio', icon: '⌂', open: true, items: ['inicio', 'assistantflow', 'guidedproject'] },
    { title: '1. Preparar estudio', icon: '01', open: true, items: ['profiles', 'dataimport', 'legacyimport', 'templates', 'samplesize', 'diagnostics', 'multidiag', 'missingpro'] },
    { title: '2. Validar instrumento', icon: '02', open: true, items: ['aiken', 'reliability', 'efa'] },
    { title: '3. Confirmar estructura', icon: '03', open: true, items: ['cfa', 'latencia', 'motorpro', 'advanced', 'estimadorguide', 'syntaxpro', 'semmontecarlo', 'modelcheck', 'modelcompare'] },
    { title: '4. Interpretar y reportar', icon: '04', open: true, items: ['qualitydashboard', 'resultcenter', 'conclusionassistant', 'articletables', 'reportapa', 'finalcheck', 'journalready'] },
    { title: '5. Gestionar proyecto', icon: '05', open: false, items: ['projects', 'migration', 'history', 'versions', 'sync', 'teams', 'peerreview', 'activitylog', 'tasks', 'kanban', 'approvals', 'conflicts', 'collabexport', 'notifications'] },
    { title: 'Ayuda y configuración', icon: '?', open: false, items: ['helpcenter', 'methodguide', 'guia', 'referencias', 'accessibility', 'privacy', 'encryption', 'appsettings', 'systemcheck', 'advancedsettings', 'updates', 'acerca'] },
    { title: 'Administración técnica', icon: '⚙', open: false, items: ['auth', 'institutionlib', 'backendtests', 'adminpanel', 'oidc', 'telemetry', 'releases', 'auditpackage', 'servermonitor', 'backuprestore', 'serverwizard', 'incidents', 'userdocs', 'e2e', 'installer', 'scheduledbackup', 'loadtesting', 'a11yaudit', 'betametrics', 'releasecandidate', 'regression', 'securityreview', 'betaready'] }
  ];

  const allButtons = [...nav.querySelectorAll('button[data-section]')];
  const byId = new Map(allButtons.map(btn => [btn.dataset.section, btn]));
  nav.innerHTML = '';
  nav.classList.add('workflow-sidebar');

  const brand = document.createElement('div');
  brand.className = 'sidebar-brand';
  brand.innerHTML = `
    <div class="sidebar-brand-mark">VS</div>
    <div>
      <strong>ValiStruct</strong>
      <span class="uas-signature">Universidad Autónoma de Sinaloa</span>
      <span>Ruta inteligente de validación</span>
    </div>`;
  nav.appendChild(brand);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'sidebar-search';
  searchWrap.innerHTML = '<input type="search" aria-label="Buscar módulo" placeholder="Buscar módulo…"><button type="button" class="sidebar-clear" aria-label="Limpiar búsqueda">×</button>';
  nav.appendChild(searchWrap);

  const groupHost = document.createElement('div');
  groupHost.className = 'sidebar-groups';
  nav.appendChild(groupHost);

  const used = new Set();
  groups.forEach((group, index) => {
    const details = document.createElement('details');
    details.className = 'sidebar-group';
    details.open = group.open;
    details.dataset.groupIndex = String(index);

    const summary = document.createElement('summary');
    summary.innerHTML = `<span class="sidebar-step">${group.icon}</span><span>${group.title}</span><span class="sidebar-chevron">›</span>`;
    details.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'sidebar-items';
    group.items.forEach(id => {
      const btn = byId.get(id);
      if (!btn) return;
      used.add(id);
      btn.classList.add('sidebar-item');
      list.appendChild(btn);
    });
    details.appendChild(list);
    groupHost.appendChild(details);
  });

  const remaining = allButtons.filter(btn => !used.has(btn.dataset.section));
  if (remaining.length) {
    const details = document.createElement('details');
    details.className = 'sidebar-group';
    const summary = document.createElement('summary');
    summary.innerHTML = '<span class="sidebar-step">+</span><span>Más herramientas</span><span class="sidebar-chevron">›</span>';
    details.appendChild(summary);
    const list = document.createElement('div');
    list.className = 'sidebar-items';
    remaining.forEach(btn => { btn.classList.add('sidebar-item'); list.appendChild(btn); });
    details.appendChild(list);
    groupHost.appendChild(details);
  }

  const footer = document.createElement('div');
  footer.className = 'sidebar-footer';
  footer.innerHTML = '<strong>ValiStruct Desktop Beta</strong><span>Validación · Psicometría · CFA/SEM</span><span class="uas-footer">Identidad azul y oro · UAS</span>';
  nav.appendChild(footer);

  const search = searchWrap.querySelector('input');
  const clear = searchWrap.querySelector('.sidebar-clear');
  const filter = () => {
    const q = search.value.trim().toLowerCase();
    groupHost.querySelectorAll('.sidebar-group').forEach(group => {
      let matches = 0;
      group.querySelectorAll('.sidebar-item').forEach(btn => {
        const visible = !q || btn.textContent.toLowerCase().includes(q);
        btn.hidden = !visible;
        if (visible) matches += 1;
      });
      group.hidden = matches === 0;
      if (q && matches) group.open = true;
    });
  };
  search.addEventListener('input', filter);
  clear.addEventListener('click', () => { search.value = ''; filter(); search.focus(); });

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sidebar-toggle';
  toggle.setAttribute('aria-label', 'Mostrar u ocultar navegación');
  toggle.textContent = '☰';
  document.body.appendChild(toggle);
  toggle.addEventListener('click', () => document.body.classList.toggle('sidebar-collapsed'));

  const workflow = document.createElement('section');
  workflow.className = 'workflow-overview';
  workflow.innerHTML = `
    <div class="workflow-intro">
      <div>
        <span class="eyebrow">VALISTRUCT · RUTA CIENTÍFICA UAS</span>
        <h2>De tus datos a una decisión metodológica clara.</h2>
        <p>Valida instrumentos, explora su estructura, confirma modelos y prepara resultados científicos siguiendo una ruta ordenada. ValiStruct organiza las herramientas por proceso para que siempre sepas dónde estás y cuál es el siguiente paso.</p>
      </div>
      <button type="button" class="workflow-primary" data-target="guidedproject">Comenzar proyecto guiado</button>
    </div>
    <div class="workflow-steps" aria-label="Ruta de trabajo recomendada">
      <button type="button" class="workflow-card" data-target="dataimport"><span>01</span><strong>Preparar</strong><small>Importa datos, revisa calidad y define el tamaño muestral.</small></button>
      <button type="button" class="workflow-card" data-target="aiken"><span>02</span><strong>Validar</strong><small>Evalúa contenido y confiabilidad sin decisiones automáticas.</small></button>
      <button type="button" class="workflow-card" data-target="efa"><span>03</span><strong>Explorar</strong><small>Identifica la estructura latente mediante análisis factorial exploratorio.</small></button>
      <button type="button" class="workflow-card" data-target="cfa"><span>04</span><strong>Confirmar</strong><small>Contrasta CFA/SEM, ajuste, validez convergente y discriminante.</small></button>
      <button type="button" class="workflow-card" data-target="reportapa"><span>05</span><strong>Comunicar</strong><small>Interpreta, genera tablas y prepara el reporte científico.</small></button>
    </div>
    <div class="quick-actions">
      <span>Accesos rápidos</span>
      <button type="button" data-target="assistantflow">Asistente paso a paso</button>
      <button type="button" data-target="resultcenter">Centro de resultados</button>
      <button type="button" data-target="projects">Mis proyectos</button>
      <button type="button" data-target="helpcenter">Centro de ayuda</button>
    </div>`;

  const inicio = document.getElementById('inicio');
  if (inicio) inicio.insertBefore(workflow, inicio.firstChild);

  workflow.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const original = nav.querySelector(`button[data-section="${target}"]`);
      if (original) original.click();
    });
  });

  const syncActiveGroup = () => {
    const active = nav.querySelector('.sidebar-item.active');
    if (!active) return;
    const group = active.closest('details');
    if (group) group.open = true;
  };

  nav.addEventListener('click', event => {
    if (event.target.closest('.sidebar-item')) {
      setTimeout(syncActiveGroup, 0);
      if (window.innerWidth < 900) document.body.classList.add('sidebar-collapsed');
    }
  });
  syncActiveGroup();

  const observer = new MutationObserver(syncActiveGroup);
  allButtons.forEach(btn => observer.observe(btn, { attributes: true, attributeFilter: ['class'] }));

  if (topbar) {
    topbar.classList.add('desktop-topbar');
    const title = topbar.querySelector('h1');
    const subtitle = topbar.querySelector('p');
    if (title) title.textContent = 'ValiStruct';
    if (subtitle) subtitle.textContent = 'Plataforma científica de validación de instrumentos y modelamiento estructural · UAS';
  }
  main.classList.add('desktop-workspace');
})();
