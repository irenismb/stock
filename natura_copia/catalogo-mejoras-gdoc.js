// Mejoras consolidadas de las revisiones horarias del catálogo de pruebas.
// Este archivo actúa solo sobre la copia de pruebas y no escribe en recursos externos.
(() => {
  const PRODUCT_QUERY_CACHE_WINDOW_MS = 60000;
  const IMAGE_INDEX_CACHE_WINDOW_MS = 60000;

  function cacheWindowToken(windowMs){
    const safeWindow = Math.max(1000, Number(windowMs) || 60000);
    return String(Math.floor(Date.now() / safeWindow));
  }

  function sheetCellValue(cell){
    if(!cell) return "";
    if(cell.f !== undefined && cell.f !== null) return String(cell.f);
    if(cell.v !== undefined && cell.v !== null) return String(cell.v);
    return "";
  }

  // La imagen suplente se validará solo cuando una tarjeta realmente la necesite.
  // Los archivos suplente.webp/png existen en esta copia; no hace falta descargarlos al arrancar.
  warmupPlaceholderOnce = async function(){ return true; };

  // La URL del inventario permanece estable durante un minuto. Así el navegador puede
  // reutilizar una respuesta reciente y el refresco periódico sigue obteniendo datos nuevos.
  googleSheetQueryUrl = function(callbackName){
    const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(GOOGLE_SHEET_SOURCE.spreadsheetId)}/gviz/tq`;
    const query = new URLSearchParams({
      sheet: GOOGLE_SHEET_SOURCE.sheetName,
      headers: "1",
      range: "A:L",
      tq: "select A,B,C,D,E,F,G,H,I,J,K,L",
      tqx: `out:json;responseHandler:${callbackName}`,
      _: cacheWindowToken(PRODUCT_QUERY_CACHE_WINDOW_MS)
    });
    return `${base}?${query.toString()}`;
  };

  let productRowsInFlight = null;
  loadGoogleSheetRows = function(){
    if(productRowsInFlight) return productRowsInFlight;

    productRowsInFlight = new Promise((resolve, reject) => {
      const callbackName = "__googleSheetCatalogResponse";
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      };

      const timer = window.setTimeout(() => {
        if(settled) return;
        settled = true;
        cleanup();
        reject(new Error("Tiempo de espera agotado al consultar el Google Sheet."));
      }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

      window[callbackName] = payload => {
        if(settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        if(!payload || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)){
          const errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
          const detail = errors.map(e => e && (e.detailed_message || e.message)).filter(Boolean).join(" · ");
          reject(new Error(detail || "Google Sheets devolvió una respuesta no válida. Verifica que el archivo permita lectura pública."));
          return;
        }

        const rows = payload.table.rows.map(row => {
          const cells = Array.isArray(row && row.c) ? row.c : [];
          const value = index => sheetCellValue(cells[index]).trim();
          let code = value(0);
          if(/^\d{1,4}$/.test(code)) code = code.padStart(4, "0");

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
        if(settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        reject(new Error("No se pudo conectar con Google Sheets."));
      };

      script.src = googleSheetQueryUrl(callbackName);
      script.async = true;
      document.head.appendChild(script);
    }).finally(() => {
      productRowsInFlight = null;
    });

    return productRowsInFlight;
  };

  // Una sola función compartida lee las celdas de todas las consultas de Sheets.
  loadGoogleSheetRemoteMatrix = function(sheetName, range, tq, callbackPrefix){
    return new Promise((resolve, reject) => {
      const callbackName = `${callbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      };

      const timer = window.setTimeout(() => {
        if(settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Tiempo de espera agotado al consultar la hoja ${sheetName}.`));
      }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

      window[callbackName] = payload => {
        if(settled) return;
        settled = true;
        window.clearTimeout(timer);
        cleanup();

        if(!payload || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)){
          const errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
          const detail = errors.map(e => e && (e.detailed_message || e.message)).filter(Boolean).join(" · ");
          reject(new Error(detail || `No se pudo leer la hoja ${sheetName}.`));
          return;
        }

        resolve(payload.table.rows.map(row => {
          const cells = Array.isArray(row && row.c) ? row.c : [];
          return cells.map(sheetCellValue);
        }));
      };

      script.onerror = () => {
        if(settled) return;
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

  // Evita la envoltura allSettled para una única consulta y no consulta en segundo plano.
  refreshRemoteCatalogConfiguration = async function(options = {}){
    const rebuild = options.rebuild !== false;
    const initial = options.initial === true;

    if(!REMOTE_CONTROL_SOURCE.enabled) return false;
    if(!initial && document.hidden) return false;

    let changed = false;
    try{
      const controls = await loadGoogleSheetRemoteMatrix(
        REMOTE_CONTROL_SOURCE.controlsSheetName,
        "A:E",
        "select A,B,C,D,E",
        "__remoteCatalogControls"
      );
      changed = applyRemoteControlRows(controls) || changed;
    }catch(error){
      console.info("Configuración remota no disponible; se conservan los interruptores locales.", error);
    }

    if(initial){
      wordSuggestionsVisible = shouldShowSuggestionsInitially();
      syncWordToggleButton();
    }

    if(changed && rebuild && allLoadedProducts.length){
      rebuildCatalogVisibility();
      syncWordToggleButton();
      rebuildSearchTicker();
      updateTickerVisibility();
      if(cartModal && cartModal.classList.contains("open")) renderCartModal();
    }

    return changed;
  };

  document.addEventListener("visibilitychange", () => {
    if(document.hidden) return;
    refreshRemoteCatalogConfiguration({ rebuild:true }).catch(error => {
      console.info("No se pudo actualizar la configuración al volver a la pestaña.", error);
    });
  }, { passive:true });

  async function refreshImageIndex(){
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), APPS_SCRIPT_IMAGE_SOURCE.timeoutMs);
    try{
      const url = new URL(APPS_SCRIPT_IMAGE_SOURCE.endpoint);
      url.searchParams.set("_", cacheWindowToken(IMAGE_INDEX_CACHE_WINDOW_MS));
      const response = await fetch(url.toString(), { cache:"default", signal:controller.signal });
      if(!response.ok) throw new Error(`Apps Script respondió ${response.status} al consultar las imágenes.`);
      const rawPayload = await response.json();
      const normalized = normalizeImageServicePayload(rawPayload);
      if(!normalized) throw new Error("Apps Script devolvió un índice de imágenes no válido.");
      saveAppsScriptImageIndexCache(rawPayload);
      return normalized;
    }finally{
      window.clearTimeout(timer);
    }
  }

  // Usa de inmediato el índice local y lo renueva en segundo plano. Si no existe caché,
  // espera la consulta remota para no mostrar el catálogo sin imágenes innecesariamente.
  loadAppsScriptImageIndex = async function(){
    const cached = readAppsScriptImageIndexCache();
    if(cached){
      refreshImageIndex().catch(error => {
        console.warn("No se pudo actualizar el índice de imágenes; se conserva la copia guardada.", error);
      });
      return cached;
    }

    try{
      return await refreshImageIndex();
    }catch(error){
      console.warn("No se pudo cargar el índice de imágenes desde Apps Script; se usarán imágenes suplentes.", error);
      return { ok:false, products:{}, gifts:[] };
    }
  };

  // Productos e imágenes comienzan al mismo tiempo. Cuando existe índice guardado,
  // este se usa de inmediato mientras la renovación continúa en segundo plano.
  loadGoogleSheetCatalog = async function(options = {}){
    const refreshImages = options.refreshImages !== false;
    const rowsPromise = loadGoogleSheetRows();
    const imagePromise = refreshImages
      ? loadAppsScriptImageIndex()
      : Promise.resolve(readAppsScriptImageIndexCache());

    let rows = [];
    try{
      rows = await rowsPromise;
    }catch(error){
      const sheetError = error instanceof Error ? error : new Error(String(error || "No se pudo leer el Google Sheet."));
      sheetError.catalogStage = "sheet";
      throw sheetError;
    }

    let imagePayload = null;
    try{
      imagePayload = await imagePromise;
    }catch(error){
      console.warn("Los productos se cargaron, pero no se pudo leer el índice de imágenes. Se usarán imágenes suplentes.", error);
    }

    const imagesByCode = new Map();
    const productsIndex = imagePayload && imagePayload.products && typeof imagePayload.products === "object"
      ? imagePayload.products
      : {};

    for(const row of rows){
      const code = String(row && row.code || "").trim();
      const entries = Array.isArray(productsIndex[code]) ? productsIndex[code] : [];
      if(entries.length) imagesByCode.set(code, orderProductImageEntries(entries));
    }

    const giftImageUrls = Array.isArray(imagePayload?.gifts)
      ? imagePayload.gifts.map(entry => String(entry && entry.url || "").trim()).filter(Boolean)
      : [];

    return {
      sheetEntries: rows.map(row => ({ row, imageIndex:imagesByCode })),
      giftImageUrls
    };
  };
})();
