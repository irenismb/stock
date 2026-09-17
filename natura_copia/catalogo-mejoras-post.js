// Ajustes de ejecución de la copia de pruebas; conserva las funciones del catálogo.
(() => {
  "use strict";

  if (typeof loadGoogleSheetRows !== "function" || typeof loadGoogleSheetRemoteMatrix !== "function") return;

  function cellValue(cell) {
    if (!cell) return "";
    if (cell.f !== undefined && cell.f !== null) return String(cell.f);
    if (cell.v !== undefined && cell.v !== null) return String(cell.v);
    return "";
  }

  loadGoogleSheetRows = function optimizedLoadGoogleSheetRows() {
    return new Promise((resolve, reject) => {
      const callbackName = "__googleSheetCatalog_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Tiempo de espera agotado al consultar el Google Sheet."));
      }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

      window[callbackName] = payload => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        if (!payload || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)) {
          const errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
          const detail = errors.map(error => error && (error.detailed_message || error.message)).filter(Boolean).join(" · ");
          reject(new Error(detail || "Google Sheets devolvió una respuesta no válida. Verifica que el archivo permita lectura pública."));
          return;
        }

        const rows = payload.table.rows.map(row => {
          const cells = Array.isArray(row && row.c) ? row.c : [];
          const value = index => cellValue(cells[index]).trim();
          let code = value(0);
          if (/^\d{1,4}$/.test(code)) code = code.padStart(4, "0");

          return {
            code,
            section: value(1),
            category: value(2),
            subcategory: value(3),
            fragranceFamily: value(4),
            condition: value(5),
            name: value(6),
            priceText: value(7),
            costText: value(8),
            stockText: value(9),
            referenceExternal: value(10),
            description: value(11),
            codeNatura: "",
            fullTxtRecord: [
              value(6),
              "",
              `Precio: ${value(7)} Costo: ${value(8)} Stock: ${value(9)} Referencia externa: ${value(10)}. ${value(11)}`
            ].join("\n")
          };
        }).filter(row => /^\d{4}$/.test(row.code) && row.name);

        resolve(rows);
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new Error("No se pudo conectar con Google Sheets."));
      };

      script.src = googleSheetQueryUrl(callbackName);
      script.async = true;
      document.head.appendChild(script);
    });
  };

  loadGoogleSheetRemoteMatrix = function optimizedLoadGoogleSheetRemoteMatrix(sheetName, range, tq, callbackPrefix) {
    return new Promise((resolve, reject) => {
      const callbackName = `${callbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      };

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Tiempo de espera agotado al consultar la hoja ${sheetName}.`));
      }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

      window[callbackName] = payload => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        if (!payload || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)) {
          const errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
          const detail = errors.map(error => error && (error.detailed_message || error.message)).filter(Boolean).join(" · ");
          reject(new Error(detail || `No se pudo leer la hoja ${sheetName}.`));
          return;
        }

        resolve(payload.table.rows.map(row => {
          const cells = Array.isArray(row && row.c) ? row.c : [];
          return cells.map(cellValue);
        }));
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new Error(`No se pudo conectar con la hoja ${sheetName}.`));
      };

      script.src = googleSheetRemoteQueryUrl(sheetName, range, tq, callbackName);
      script.async = true;
      document.head.appendChild(script);
    });
  };

  refreshRemoteCatalogConfiguration = async function optimizedRefreshRemoteCatalogConfiguration(options = {}) {
    const rebuild = options.rebuild !== false;
    const initial = options.initial === true;
    if (!REMOTE_CONTROL_SOURCE.enabled) return false;

    let changed = false;
    try {
      const rows = await loadGoogleSheetRemoteMatrix(
        REMOTE_CONTROL_SOURCE.controlsSheetName,
        "A:E",
        "select A,B,C,D,E",
        "__remoteCatalogControls"
      );
      changed = applyRemoteControlRows(rows) || changed;
    } catch (error) {
      console.info("Configuración remota no disponible; se conservan los interruptores locales.", error);
    }

    if (initial) {
      wordSuggestionsVisible = shouldShowSuggestionsInitially();
      syncWordToggleButton();
    }

    if (changed && rebuild && allLoadedProducts.length) {
      rebuildCatalogVisibility();
      syncWordToggleButton();
      rebuildSearchTicker();
      updateTickerVisibility();
      if (cartModal && cartModal.classList.contains("open")) renderCartModal();
    }

    return changed;
  };

  loadGoogleSheetCatalog = async function optimizedLoadGoogleSheetCatalog(options = {}) {
    const refreshImages = options.refreshImages !== false;
    const imagePromise = refreshImages
      ? loadAppsScriptImageIndex()
      : Promise.resolve(readAppsScriptImageIndexCache());

    const [rowsResult, imageResult] = await Promise.allSettled([
      loadGoogleSheetRows(),
      imagePromise
    ]);

    if (rowsResult.status !== "fulfilled") {
      const error = rowsResult.reason;
      const sheetError = error instanceof Error ? error : new Error(String(error || "No se pudo leer el Google Sheet."));
      sheetError.catalogStage = "sheet";
      throw sheetError;
    }

    const rows = rowsResult.value;
    const imagePayload = imageResult.status === "fulfilled" ? imageResult.value : null;
    if (imageResult.status !== "fulfilled") {
      console.warn("Los productos se cargaron, pero no se pudo leer el índice de imágenes. Se usarán imágenes suplentes.", imageResult.reason);
    }

    const imagesByCode = new Map();
    const productsIndex = imagePayload && imagePayload.products && typeof imagePayload.products === "object"
      ? imagePayload.products
      : {};

    for (const row of rows) {
      const code = String(row && row.code || "").trim();
      const entries = Array.isArray(productsIndex[code]) ? productsIndex[code] : [];
      if (entries.length) imagesByCode.set(code, orderProductImageEntries(entries));
    }

    const giftImageUrls = Array.isArray(imagePayload?.gifts)
      ? imagePayload.gifts.map(entry => String(entry && entry.url || "").trim()).filter(Boolean)
      : [];

    return {
      sheetEntries: rows.map(row => ({ row, imageIndex: imagesByCode })),
      giftImageUrls
    };
  };

  // La imagen suplente se solicita solo cuando una tarjeta realmente la necesita.
  warmupPlaceholderOnce = () => Promise.resolve();

  let foregroundRefreshInFlight = false;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || foregroundRefreshInFlight) return;
    foregroundRefreshInFlight = true;

    Promise.allSettled([
      refreshRemoteCatalogConfiguration({ rebuild: true }),
      loadProducts({ silent: true, refreshImages: false })
    ]).finally(() => {
      foregroundRefreshInFlight = false;
    });
  });
})();
