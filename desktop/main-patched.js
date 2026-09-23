'use strict';

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Inject post-load renderer improvements in the same main world as app.js.
// This keeps the production app.js untouched while allowing focused hotfixes.
app.on('web-contents-created', (_event, contents) => {
  if (contents.getType && contents.getType() !== 'window') return;
  contents.on('did-finish-load', async () => {
    try {
      const patchPath = path.join(__dirname, 'renderer-fixes.js');
      const source = fs.readFileSync(patchPath, 'utf8');
      await contents.executeJavaScript(source, true);
    } catch (err) {
      console.error('[ValiStruct] renderer-fixes injection failed:', err);
    }
  });
});

require('./main.js');
