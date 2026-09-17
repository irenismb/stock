// Optimizaciones de red para la copia de pruebas de Natura.
(() => {
  "use strict";

  const PRODUCT_CACHE_KEY = "irenismb_catalog_product_payload_v1";
  const PRODUCT_CACHE_TTL_MS = 15000;
  const IMAGE_CACHE_KEY = "irenismb_apps_script_image_index_v1";
  const IMAGE_REFRESH_AT_KEY = "irenismb_apps_script_image_index_refreshed_at_v1";
  const IMAGE_REFRESH_MIN_AGE_MS = 60000;
  const IMAGE_ENDPOINT = "https://script.google.com/macros/s/AKfycbzuHYa9Uf_5v5-FhDXQFu6WRuW49DgxJLUHrm_tq1Vdk539VZjeQeGrlWWqgJj4SzMg2w/exec";

  function readJson(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function writeJson(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function responseHandlerName(url) {
    try {
      const tqx = new URL(url).searchParams.get("tqx") || "";
      const match = tqx.match(/(?:^|;)responseHandler:([^;]+)/);
      return match ? match[1] : "";
    } catch (_) {
      return "";
    }
  }

  const originalHeadAppendChild = document.head.appendChild.bind(document.head);
  document.head.appendChild = function optimizedHeadAppendChild(node) {
    try {
      if (node instanceof HTMLScriptElement && /docs\.google\.com\/spreadsheets\/d\/.+\/gviz\/tq/i.test(node.src)) {
        const url = new URL(node.src);
        const sheet = String(url.searchParams.get("sheet") || "");
        const callbackName = responseHandlerName(url.toString());

        if (sheet === "Productos" && callbackName) {
          const cached = readJson(sessionStorage, PRODUCT_CACHE_KEY);
          if (
            cached &&
            cached.savedAt &&
            Date.now() - Number(cached.savedAt) <= PRODUCT_CACHE_TTL_MS &&
            cached.payload
          ) {
            queueMicrotask(() => {
              const callback = window[callbackName];
              if (typeof callback === "function") callback(cached.payload);
            });
            return node;
          }

          const callback = window[callbackName];
          if (typeof callback === "function") {
            window[callbackName] = payload => {
              if (payload && payload.status === "ok") {
                writeJson(sessionStorage, PRODUCT_CACHE_KEY, {
                  savedAt: Date.now(),
                  payload
                });
              }
              callback(payload);
            };
          }

          url.searchParams.delete("_");
          node.src = url.toString();
        } else if (sheet === "Configuracion" && callbackName) {
          const callback = window[callbackName];
          if (typeof callback === "function") {
            window[callbackName] = payload => {
              setTimeout(() => callback(payload), 0);
            };
          }
        }
      }
    } catch (_) {}

    return originalHeadAppendChild(node);
  };

  const originalFetch = window.fetch.bind(window);
  let imageRefreshPromise = null;

  function normalizeImageEndpoint(input) {
    try {
      const url = new URL(typeof input === "string" ? input : input.url, location.href);
      return url.origin + url.pathname;
    } catch (_) {
      return "";
    }
  }

  async function fetchFreshImagePayload() {
    if (imageRefreshPromise) return imageRefreshPromise;

    imageRefreshPromise = (async () => {
      const response = await originalFetch(IMAGE_ENDPOINT, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Índice de imágenes: ${response.status}`);
      const payload = await response.json();
      if (!payload || payload.ok !== true) throw new Error("Índice de imágenes no válido");
      writeJson(localStorage, IMAGE_CACHE_KEY, payload);
      try { localStorage.setItem(IMAGE_REFRESH_AT_KEY, String(Date.now())); } catch (_) {}
      return payload;
    })();

    try {
      return await imageRefreshPromise;
    } finally {
      imageRefreshPromise = null;
    }
  }

  function jsonResponse(payload) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  window.fetch = function optimizedFetch(input, init = {}) {
    if (normalizeImageEndpoint(input) === IMAGE_ENDPOINT) {
      const cached = readJson(localStorage, IMAGE_CACHE_KEY);
      if (cached && cached.ok === true) {
        let lastRefreshAt = 0;
        try { lastRefreshAt = Number(localStorage.getItem(IMAGE_REFRESH_AT_KEY) || 0); } catch (_) {}
        if (Date.now() - lastRefreshAt >= IMAGE_REFRESH_MIN_AGE_MS) {
          fetchFreshImagePayload().catch(() => {});
        }
        return Promise.resolve(jsonResponse(cached));
      }

      return fetchFreshImagePayload().then(jsonResponse);
    }

    return originalFetch(input, init);
  };

  // Comienza a actualizar el índice de imágenes mientras el catálogo consulta los productos.
  if (!document.hidden) {
    fetchFreshImagePayload().catch(() => {});
  }

  const originalSetInterval = window.setInterval.bind(window);
  window.setInterval = function visibleInterval(callback, delay, ...args) {
    if (Number(delay) === 60000 && typeof callback === "function") {
      return originalSetInterval(() => {
        if (!document.hidden) callback(...args);
      }, delay);
    }
    return originalSetInterval(callback, delay, ...args);
  };
})();
