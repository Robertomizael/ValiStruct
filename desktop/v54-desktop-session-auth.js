(() => {
  'use strict';

  // Desktop-only compatibility layer: every request to the bundled scientific
  // backend must carry the same session token exposed by preload.js. This keeps
  // older modules (notably efa-v52.js) compatible without rewriting their
  // validated statistical logic.
  const nativeFetch = window.fetch.bind(window);
  const backendOrigin = 'http://127.0.0.1:8765';

  function requestUrl(input) {
    try {
      return new URL(input instanceof Request ? input.url : String(input), window.location.href);
    } catch (_) {
      return null;
    }
  }

  window.fetch = function valistructDesktopFetch(input, init = {}) {
    const url = requestUrl(input);
    const token = window.valistructDesktop?.scientificToken;
    if (!url || url.origin !== backendOrigin || !token) {
      return nativeFetch(input, init);
    }

    const baseHeaders = input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init.headers || baseHeaders || undefined);
    if (!headers.has('X-ValiStruct-Session')) {
      headers.set('X-ValiStruct-Session', token);
    }

    if (input instanceof Request) {
      return nativeFetch(new Request(input, { ...init, headers }));
    }
    return nativeFetch(input, { ...init, headers });
  };

  window.__valistructDesktopSessionAuth = true;
})();
