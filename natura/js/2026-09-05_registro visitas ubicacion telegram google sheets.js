// Producción: Google Drive es la fuente autoritativa de imágenes del catálogo.
// Este cargador se ejecuta antes de que termine la carga asíncrona del inventario.
(() => {
  'use strict';

  const SCRIPT_BASE = (() => {
    try {
      return new URL('.', document.currentScript && document.currentScript.src ? document.currentScript.src : location.href).href;
    } catch (_) {
      return 'https://irenismb.github.io/stock/natura/js/';
    }
  })();

  const DRIVE_MAP_SOURCE = new URL('catalogo-imagenes-drive-map.js', SCRIPT_BASE).href;
  const ANALYTICS_RUNTIME = new URL('analytics-visitas-runtime.js?v=2026-09-11-gdrive', SCRIPT_BASE).href;
  const PRODUCT_PATH_MARKER = '/stock/natura/productos/';
  const DRIVE_IMAGE_BASE = 'https://lh3.googleusercontent.com/d/';

  const GIFT_DRIVE_BY_FILE = Object.freeze({
    '1.webp': '1VkM-lp9lE8YY8l46LeXeI_ZAzHxpUsC0',
    '2.webp': '1BvYz5IpAyYOvMJnPfpBvYFuVWqBMPR7u',
    '3.webp': '1PtuZ6dPJzEB2MGcYtuycK1XIWBb4yjCo',
    '4.webp': '18Wk5a-OriwGRBnfbdxkHljxvW8TYdUq0',
    '5.webp': '1K-d8UjSZIIx2SPb_-2LbPjPjO0cEFSz9',
    '6.webp': '1-aJdnoNHqFA2t1DfcfQkletQF1_43TDJ',
    '7.webp': '10rD3CAstjBWQiO_67zHTyJuMBND4hm2d'
  });

  let driveByCode = Object.create(null);

  async function loadDriveMap() {
    const response = await fetch(DRIVE_MAP_SOURCE, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar el índice de imágenes de Drive: HTTP ${response.status}`);
    const source = await response.text();
    const match = source.match(/const\s+DRIVE_BY_CODE\s*=\s*(\{[\s\S]*?\});/);
    if (!match) throw new Error('No se encontró el índice DRIVE_BY_CODE.');
    const parsed = Function(`"use strict"; return (${match[1]});`)();
    if (!parsed || typeof parsed !== 'object') throw new Error('El índice de Drive no es válido.');
    driveByCode = Object.freeze({ ...parsed });
    return driveByCode;
  }

  const driveMapReady = loadDriveMap().catch(error => {
    console.error('No se pudo preparar el índice autoritativo de imágenes de Google Drive. Se usarán imágenes suplentes.', error);
    driveByCode = Object.freeze({});
    return driveByCode;
  });

  window.DRIVE_PRODUCT_IMAGE_SOURCE = Object.freeze({
    provider: 'Google Drive',
    folderId: '133WAYlDKSt3r8KIObttDcv86eHPmPQ5b',
    endpoint: 'lh3.googleusercontent.com',
    authoritative: true,
    ready: driveMapReady
  });

  function driveImageUrl(id) {
    return DRIVE_IMAGE_BASE + encodeURIComponent(String(id || ''));
  }

  function resolveDriveImage(raw) {
    try {
      const original = String(raw || '');
      if (!original) return original;
      const url = new URL(original, location.href);
      const markerIndex = url.pathname.indexOf(PRODUCT_PATH_MARKER);
      if (markerIndex < 0) return original;

      const relative = decodeURIComponent(url.pathname.slice(markerIndex + PRODUCT_PATH_MARKER.length));
      const parts = relative.split('/').filter(Boolean);

      if (parts.length >= 2 && parts[0].toLowerCase() === 'regalos') {
        const filename = parts[parts.length - 1];
        const giftId = GIFT_DRIVE_BY_FILE[filename] || '';
        return giftId ? driveImageUrl(giftId) : driveImageUrl(`__drive_missing_gift_${filename}__`);
      }

      const filename = parts[parts.length - 1] || '';
      const codeMatch = filename.match(/^(\d{4})(?=_|[.\s-]|$)/);
      if (!codeMatch) return driveImageUrl('__drive_missing_product__');
      const id = driveByCode[codeMatch[1]] || '';
      return id ? driveImageUrl(id) : driveImageUrl(`__drive_missing_${codeMatch[1]}__`);
    } catch (_) {
      return String(raw || '');
    }
  }

  // Intercepta únicamente las imágenes que el catálogo identifica dentro de productos/.
  // No modifica logos, iconos ni la imagen suplente alojada con la web.
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  if (srcDescriptor && srcDescriptor.set && srcDescriptor.get) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: srcDescriptor.configurable,
      enumerable: srcDescriptor.enumerable,
      get: srcDescriptor.get,
      set(value) {
        return srcDescriptor.set.call(this, resolveDriveImage(value));
      }
    });
  }

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (this instanceof HTMLImageElement && String(name).toLowerCase() === 'src') {
      value = resolveDriveImage(value);
    }
    return nativeSetAttribute.call(this, name, value);
  };

  // El JS histórico del catálogo consulta un árbol de GitHub para construir el índice.
  // Se intercepta solo esa petición y se le entrega un índice sintético construido desde Drive.
  // Así una imagen no necesita existir en GitHub para aparecer en producción.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    let url = '';
    try {
      url = typeof input === 'string' ? input : String(input && input.url || '');
    } catch (_) {}

    if (/^https:\/\/api\.github\.com\/repos\/irenismb\/stock\/git\/trees\//i.test(url)) {
      return driveMapReady.then(map => {
        const tree = Object.keys(map).sort().map(code => ({
          path: `natura/productos/${code}_01_drive.webp`,
          type: 'blob',
          mode: '100644',
          sha: `drive-${code}`
        }));
        Object.keys(GIFT_DRIVE_BY_FILE).sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).forEach(filename => {
          tree.push({
            path: `natura/productos/regalos/${filename}`,
            type: 'blob',
            mode: '100644',
            sha: `drive-regalo-${filename}`
          });
        });
        return new Response(JSON.stringify({ sha: 'google-drive-authoritative', truncated: false, tree }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-ratelimit-remaining': '999'
          }
        });
      });
    }

    return nativeFetch(input, init);
  };

  // Conserva sin cambios el registro de visitas que ya existía en producción.
  const analyticsScript = document.createElement('script');
  analyticsScript.src = ANALYTICS_RUNTIME;
  analyticsScript.async = false;
  analyticsScript.onerror = () => console.error('No se pudo cargar el módulo de analítica de visitas.');
  document.head.appendChild(analyticsScript);
})();
