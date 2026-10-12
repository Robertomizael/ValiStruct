(() => {
  'use strict';

  const VERSION = '5.4.0-beta.1';
  const DISPLAY = '5.4 Beta';

  const banner = document.querySelector('.rc-banner');
  if (banner && /ValiStruct v5\.3\b/.test(banner.textContent || '')) {
    banner.innerHTML = banner.innerHTML.replace(/ValiStruct v5\.3/g, 'ValiStruct v5.4');
  }

  const originalProjectState = window.projectState;
  if (typeof originalProjectState === 'function' && !originalProjectState.__v54ReleaseCoherence) {
    const wrapped = function(...args) {
      const state = originalProjectState.apply(this, args);
      if (state && typeof state === 'object') {
        state.release = {
          ...(state.release || {}),
          channel: 'beta',
          appVersion: VERSION
        };
      }
      return state;
    };
    wrapped.__v54ReleaseCoherence = true;
    window.projectState = wrapped;
  }

  window.ValiStructRelease = Object.freeze({
    version: VERSION,
    displayVersion: DISPLAY,
    channel: 'beta'
  });
})();
