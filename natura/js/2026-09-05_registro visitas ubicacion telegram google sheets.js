// Producción: Google Drive es la fuente autoritativa de todas las imágenes del catálogo.
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
  const CATALOG_PATH_MARKER = '/stock/natura/';
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

  const DRIVE_ASSET_BY_PATH = Object.freeze({
    'logos/youtube.webp': '1TAPz3EcrWi7Wyj2gwR5ZNK-7O2tDs3P8',
    'logos/whatsapp.webp': '1KAD5ufqQZ7n79L10mepkIoGBWt_W4qsY',
    'logos/tiktok.webp': '1HLfckCdrAcRY6V5Zf8lte1c6rie0Kaon',
    'logos/suplente.webp': '1NG_kfr3Gb09_eAoIKUNRdEPaTtYqAHFI',
    'logos/suplente.png': '1SDGHgGqwKH03X3W6JTLpt4we5gg8AiHe',
    'logos/maps.webp': '1VdcarKEUJV-aDLRxC7axY9_oIUtGPZgH',
    'logos/logo_empresa.webp': '1_szHpI2Ow1TBsHBVyDSGoXfUa7Ra8ndf',
    'logos/logo_empresa.png': '1qAB4okTAZONuiEo_Jl_DLMIj6VKrzl10',
    'logos/instagram.webp': '1XcVrp0joflfMotor_B7rfarR_77txQuB',
    'logos/google_business.webp': '1hviVePMA_HTHl7RBhEf0GK_ZTj1L7-xX',
    'logos/facebook.webp': '13iR-ONK1qBZI4ymsasnX7YNxg6c3wHl6',
    'iconos/2026-09-06_icono categoria otros productos hogar variedad.webp': '1sIxlmqRA01wpi1ZbtAEAvG86ALqeJ72W',
    'iconos/2026-09-06_icono categoria regalos caja lazo rosa.webp': '1NnsN9ZrVNpao6gYimZZmGYMy_5bSWLNI',
    'iconos/2026-09-06_icono categoria unisex cuidado botanico neutro.webp': '1PHh42WcxXfdVgRCYCQ0zi6Dd0U9Hy0sq',
    'iconos/2026-09-06_icono categoria para el perfume azul.webp': '1CowK9gWD7LX6b4_bjRx23qzYtYxI3KGF',
    'iconos/2026-09-06_icono categoria para ella perfume floral.webp': '1cH0WDt139_pqQ6NBPg3m7PjsAkvO6Qye',
    'iconos/2026-09-06_icono subcategoria medicamentos frasco capsulas medicas.webp': '1Kq3r6c21h_qLghuDI2LSmAgKawWZCEnh',
    'iconos/2026-09-06_icono subcategoria papeleria cuaderno lapiz corazon.webp': '197cN4XvIx6wfaGM7dHzSAjWFJcdwq8A4',
    'iconos/2026-09-06_icono subcategoria juguetes oso bloques infantiles.webp': '1An2vuZPrJA8jnXCzsiquy1mp1hVDp0Q6',
    'iconos/2026-09-06_icono subcategoria tecnologia hogar asistente inteligente.webp': '1VRVceYVGC_ioTQua9eBLXdIcwrBX3m3X',
    'iconos/2026-09-06_icono subcategoria maquillaje brocha labial rosa.webp': '1W1dXo_ZXbNrAxlxftipkvQ2DCbn4xYl3',
    'iconos/2026-09-06_icono subcategoria kits combos regalo cosmeticos.webp': '1Cn90ErJ_Pu7KHtREPruFFJPElSQrwfnd',
    'iconos/2026-09-06_icono subcategoria proteccion solar crema amarilla.webp': '1pbGbiNfDMERMPRxnYDtXQxWPscYopO1p',
    'iconos/2026-09-06_icono subcategoria higiene intima flor rosa.webp': '112fB2HGlqsBxYH7WbOJqJWWrxQJgx5qq',
    'iconos/2026-09-06_icono subcategoria higiene corporal jabon turquesa.webp': '1isgXCkTL9PVftJpNtFbWmQ3fw7odOqWR',
    'iconos/2026-09-06_icono subcategoria manos pies cuidado suave.webp': '1nlskH4xkbTUXF4eFjCaYynoLXVKd-yCQ',
    'iconos/2026-09-06_icono subcategoria cabello mechon brillante capilar.webp': '1e7JSLZmsdJAcIFukSJKtA8iZQDwpRGjs',
    'iconos/2026-09-06_icono subcategoria cuidado corporal locion vegetal.webp': '1IkB6Y3e-jIoofccwwJGuz9hwgB3VZ9J5',
    'iconos/2026-09-06_icono subcategoria cuidado facial crema rosa.webp': '18Qnxbp4qT6t78Q2hm2ktQiK3p1GvsKOK',
    'iconos/2026-09-06_icono subcategoria desodorantes roll on vegetal.webp': '1bBXisFh7g2ZcmLdJg6PtqaDjlxg41Edc',
    'iconos/2026-09-06_icono subcategoria perfumes fragancia floral rosa.webp': '1aguCZaRTwEKbB5eLGDQOYtB3kSaULj_7'
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

  window.DRIVE_IMAGE_SOURCE = Object.freeze({
    provider: 'Google Drive',
    folderId: '133WAYlDKSt3r8KIObttDcv86eHPmPQ5b',
    resourcesFolderId: '1VftdVdVOzva6xNVG0TvEkR-h6eh90duP',
    endpoint: 'lh3.googleusercontent.com',
    authoritative: true,
    products: true,
    gifts: true,
    logos: true,
    icons: true,
    placeholders: true,
    ready: driveMapReady
  });
  window.DRIVE_PRODUCT_IMAGE_SOURCE = window.DRIVE_IMAGE_SOURCE;

  function driveImageUrl(id) {
    return DRIVE_IMAGE_BASE + encodeURIComponent(String(id || ''));
  }

  function catalogRelativePath(url) {
    const markerIndex = url.pathname.indexOf(CATALOG_PATH_MARKER);
    if (markerIndex < 0) return '';
    return decodeURIComponent(url.pathname.slice(markerIndex + CATALOG_PATH_MARKER.length));
  }

  function resolveDriveImage(raw) {
    try {
      const original = String(raw || '');
      if (!original) return original;
      const url = new URL(original, location.href);

      if (url.hostname === 'lh3.googleusercontent.com') return original;

      const relative = catalogRelativePath(url);
      if (!relative) return original;

      const fixedAssetId = DRIVE_ASSET_BY_PATH[relative] || '';
      if (fixedAssetId) return driveImageUrl(fixedAssetId);

      if (relative.startsWith('logos/') || relative.startsWith('iconos/')) {
        return driveImageUrl(`__drive_missing_asset_${relative.split('/').pop() || 'unknown'}__`);
      }

      if (!relative.startsWith('productos/')) return original;

      const productRelative = relative.slice('productos/'.length);
      const parts = productRelative.split('/').filter(Boolean);

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

  const sourceSrcsetDescriptor = typeof HTMLSourceElement !== 'undefined'
    ? Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'srcset')
    : null;
  if (sourceSrcsetDescriptor && sourceSrcsetDescriptor.set && sourceSrcsetDescriptor.get) {
    Object.defineProperty(HTMLSourceElement.prototype, 'srcset', {
      configurable: sourceSrcsetDescriptor.configurable,
      enumerable: sourceSrcsetDescriptor.enumerable,
      get: sourceSrcsetDescriptor.get,
      set(value) {
        return sourceSrcsetDescriptor.set.call(this, resolveDriveImage(value));
      }
    });
  }

  const nativeSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    const attr = String(name).toLowerCase();
    if (this instanceof HTMLImageElement && attr === 'src') {
      value = resolveDriveImage(value);
    } else if (typeof HTMLSourceElement !== 'undefined' && this instanceof HTMLSourceElement && attr === 'srcset') {
      value = resolveDriveImage(value);
    }
    return nativeSetAttribute.call(this, name, value);
  };

  function remapExistingDocumentImages() {
    document.querySelectorAll('img[src]').forEach(img => {
      const mapped = resolveDriveImage(img.getAttribute('src'));
      if (mapped && mapped !== img.getAttribute('src')) img.src = mapped;
    });

    document.querySelectorAll('source[srcset]').forEach(source => {
      const current = source.getAttribute('srcset');
      const mapped = resolveDriveImage(current);
      if (mapped && mapped !== current) source.srcset = mapped;
    });

    document.querySelectorAll('link[rel~="icon"][href], link[rel="apple-touch-icon"][href], link[rel="preload"][as="image"][href]').forEach(link => {
      const current = link.getAttribute('href');
      const mapped = resolveDriveImage(current);
      if (mapped && mapped !== current) link.setAttribute('href', mapped);
    });

    document.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').forEach(meta => {
      const current = meta.getAttribute('content');
      const mapped = resolveDriveImage(current);
      if (mapped && mapped !== current) meta.setAttribute('content', mapped);
    });
  }

  remapExistingDocumentImages();

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

  const analyticsScript = document.createElement('script');
  analyticsScript.src = ANALYTICS_RUNTIME;
  analyticsScript.async = false;
  analyticsScript.onerror = () => console.error('No se pudo cargar el módulo de analítica de visitas.');
  document.head.appendChild(analyticsScript);
})();
