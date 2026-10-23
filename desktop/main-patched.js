'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

require('./v54-macos-window-lifecycle.js');

// Windows can transiently keep files inside runtime-v2 busy during a reinstall,
// first launch, antivirus scan or after a prior interrupted session. Node's
// recursive rm supports retries for ENOTEMPTY/EBUSY/EPERM, but main.js used the
// defaults (zero retries). Harden only the ValiStruct runtime-v2 cleanup path so
// scientific/project files and unrelated removals keep their original behavior.
if (process.platform === 'win32') {
  const originalRmSync = fs.rmSync.bind(fs);
  fs.rmSync = function valistructRmSync(target, options) {
    const targetPath = String(target || '');
    const isRuntimeV2 = path.basename(targetPath).toLowerCase() === 'runtime-v2';
    const recursive = Boolean(options && typeof options === 'object' && options.recursive);
    if (isRuntimeV2 && recursive) {
      return originalRmSync(target, {
        ...options,
        maxRetries: Math.max(Number(options.maxRetries) || 0, 20),
        retryDelay: Math.max(Number(options.retryDelay) || 0, 250)
      });
    }
    return originalRmSync(target, options);
  };
}

// Inject post-load renderer improvements in the same main world as app.js.
// This keeps the production app.js untouched while allowing focused hotfixes.
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType && contents.getType() !== 'window') return;
  contents.on('did-finish-load', async () => {
    for (const file of ['renderer-fixes.js', 'v54-desktop-session-auth.js', 'v54-release-coherence.js', 'content-validity-xlsx-renderer.js', 'content-validity-xlsx-results.js', 'content-validity-xlsx-hardening.js', 'v54-content-validity-runtime-fix.js', 'v54-analysis-workflow.js', 'v54-diagnostics-interpretation.js', 'v54-cfa-professional-path.js', 'v54-results-hub.js', 'v54-results-preview-fix.js', 'v54-latencia-editing.js', 'v54-context-menu.js', 'v54-visual-polish.js', 'v54-legibility-polish.js']) {
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