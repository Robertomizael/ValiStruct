'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Inject post-load renderer improvements in the same main world as app.js.
// This keeps the production app.js untouched while allowing focused hotfixes.
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType && contents.getType() !== 'window') return;
  contents.on('did-finish-load', async () => {
    for (const file of ['renderer-fixes.js', 'v54-desktop-session-auth.js', 'content-validity-xlsx-renderer.js', 'content-validity-xlsx-results.js', 'content-validity-xlsx-hardening.js', 'v54-content-validity-runtime-fix.js', 'v54-analysis-workflow.js', 'v54-diagnostics-interpretation.js', 'v54-cfa-professional-path.js', 'v54-results-hub.js']) {
      try {
        const patchPath = path.join(__dirname, file);
        const source = fs.readFileSync(patchPath, 'utf8');
        await contents.executeJavaScript(source, true);
      } catch (err) {
        console.error(`[ValiStruct] ${file} injection failed:`, err);
      }
    }
    try {
      await contents.executeJavaScript(`
        [['cviWorkspace','cviXlsxControls'],['lawsheWorkspace','lawsheXlsxControls'],['delphiWorkspace','delphiXlsxControls']].forEach(([hostId,boxId])=>{
          const host=document.getElementById(hostId),box=document.getElementById(boxId);
          if(!host||!box||box.parentElement===host)return;
          const anchor=host.querySelector('.button-row');
          if(anchor)anchor.insertAdjacentElement('afterend',box); else host.appendChild(box);
        });
      `, true);
    } catch (err) {
      console.error('[ValiStruct] content-validity XLSX layout normalization failed:', err);
    }
  });
});

require('./main.js');
