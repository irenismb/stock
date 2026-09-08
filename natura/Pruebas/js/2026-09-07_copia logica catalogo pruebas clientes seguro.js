// Lógica principal del catálogo público.

// ==========================================
    // AJUSTES LOCALES Y CONFIGURACIÓN GLOBAL
    // ==========================================
    // Los valores locales funcionan como respaldo.
    // Si existen las hojas "Configuracion" y "Categorias" en el Google Sheet,
    // sus valores se aplican globalmente a todos los visitantes.

    // Fuente principal de datos comerciales del catálogo: Google Sheet oficial.
    // Las imágenes se relacionan por el código interno global de cuatro dígitos.
    // Hoja Productos, estructura A:N: Código, Sección, Categoría, Subcategoría, Familia olfativa, Condición, Estado comercial, Nombre, Precio, Costo, Stock, Referencia externa, Descripción y Código Natura.
    const GOOGLE_SHEET_SOURCE = {
      spreadsheetId: "19sf8MrzGftXVb4sp9i9FptZk5_TckzRhuJUL-3bUQyA",
      sheetName: "Productos",
      gid: "893686273"
    };

    // Control global remoto. Las hojas deben estar en el mismo archivo de Google Sheets.
    // Configuracion: A=Control, B=Estado, C=Qué hace, D=Recomendación, E=Clave técnica.
    // Categorias: A=Sección, B=Categoría, C=Subcategoría, D=Familia olfativa, E=Estado comercial, F=Ocultar del catálogo, G=Excluir de búsquedas, H=Nota.
    const REMOTE_CONTROL_SOURCE = {
      enabled: true,
      spreadsheetId: GOOGLE_SHEET_SOURCE.spreadsheetId,
      controlsSheetName: "Configuracion",
      categoriesSheetName: "Categorias",
      refreshMs: 60000
    };
    window.REMOTE_CONTROL_SOURCE = REMOTE_CONTROL_SOURCE;

    // Las imágenes normales se relacionan por el código interno global de cuatro dígitos.
    // Todas las imágenes de producto viven directamente en la carpeta productos y se relacionan por el código global de cuatro dígitos.
    const GITHUB_CATALOG_SOURCE = {
      owner: "irenismb",
      repo: "stock",
      branch: "main",
      catalogDir: "natura",
      productsFolder: "productos"
    };


    // Galería visual exclusiva de "Regalos para toda ocasión".
    // La carpeta de trabajo está en Drive, pero la web solo consume su publicación en GitHub.
    // Los regalos no forman parte del inventario del Google Sheet y sus nombres de archivo no se muestran.
    const GIFT_GITHUB_SOURCE = {
      section: "Regalos para toda ocasión",
      folder: "regalos"
    };

	const INTERRUPTORES = {
	  MOSTRAR_CANTIDAD_STOCK: false,
	  MOSTRAR_TEXTO_ESTADO_STOCK: false,
	  MOSTRAR_PRECIOS_PRODUCTO: true,
	  MOSTRAR_CODIGOS_PRODUCTO: true,
	  ENVIAR_CODIGOS_PRODUCTO_WHATSAPP: true,
	  HABILITAR_UBICACION_GPS: true,
	  APLICAR_LIMITES_STOCK: false,
	  MOSTRAR_IMAGENES_PRODUCTO: true,
	  IMAGEN_SUPLENTE_PRODUCTO: "suplente.webp",

	  PERMITIR_TOGGLE_PALABRAS_SUGERIDAS: true,
	  PALABRAS_SUGERIDAS_INICIAN_VISIBLES: false,
	  MOSTRAR_PRODUCTOS_COINCIDENTES_AL_ESCRIBIR: false,
	  MOSTRAR_IMAGEN_PRODUCTO_EN_CATEGORIAS_SUBCATEGORIAS: true,
	  APLICAR_ALBUMES_OCULTOS: true,
	  APLICAR_EXCLUSION_ALBUMES_EN_BUSQUEDA: true
    };
    window.INTERRUPTORES = INTERRUPTORES;
    const REMOTE_BOOLEAN_CONTROL_KEYS = new Set(
      Object.keys(INTERRUPTORES).filter(key => typeof INTERRUPTORES[key] === "boolean")
    );
    window.REMOTE_CONTROL_VALUES = window.REMOTE_CONTROL_VALUES || {};

    const ALBUMES_OCULTOS_SEGUROS = [
      "Otros productos|Otros productos|Medicamentos||A la venta",
      "Otros productos|Otros productos|Electrodomésticos de segunda mano no a la venta||No a la venta"
    ];
    const ALBUMES_EXCLUIDOS_SEGUROS = ALBUMES_OCULTOS_SEGUROS.slice();
    const REMOTE_CATEGORIES_CACHE_KEY = "irenismb_remote_routes_cache";

    function readRemoteCategoryCache(){
      try{
        const raw = localStorage.getItem(REMOTE_CATEGORIES_CACHE_KEY);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        if(!parsed || typeof parsed !== "object") return null;

        const cleanList = value => Array.isArray(value)
          ? value
              .map(item => String(item || "").trim())
              .filter(Boolean)
              .filter(item => item.split("|").length === 5)
          : null;

        const hidden = cleanList(parsed.hidden);
        const excluded = cleanList(parsed.excluded);
        if(!hidden || !excluded) return null;

        return { hidden, excluded };
      }catch(_){
        return null;
      }
    }

    function saveRemoteCategoryCache(hidden, excluded){
      try{
        localStorage.setItem(REMOTE_CATEGORIES_CACHE_KEY, JSON.stringify({
          hidden: Array.isArray(hidden) ? hidden : [],
          excluded: Array.isArray(excluded) ? excluded : []
        }));
      }catch(_){}
    }

    const cachedCategoryConfig = readRemoteCategoryCache();

    const ALBUMES_OCULTOS = cachedCategoryConfig
      ? cachedCategoryConfig.hidden.slice()
      : ALBUMES_OCULTOS_SEGUROS.slice();
    window.ALBUMES_OCULTOS = ALBUMES_OCULTOS;

    const ALBUMES_EXCLUIDOS_EN_BUSQUEDA = cachedCategoryConfig
      ? cachedCategoryConfig.excluded.slice()
      : ALBUMES_EXCLUIDOS_SEGUROS.slice();
    window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA = ALBUMES_EXCLUIDOS_EN_BUSQUEDA;

    function shouldEnforceStockLimits(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.APLICAR_LIMITES_STOCK === true);
    }
    function shouldShowProductImages(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_IMAGENES_PRODUCTO !== false);
    }
    function shouldShowProductPrices(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_PRECIOS_PRODUCTO !== false);
    }
    function shouldShowProductCodes(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_CODIGOS_PRODUCTO !== false);
    }
    function shouldSendProductCodesByWhatsApp(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.ENVIAR_CODIGOS_PRODUCTO_WHATSAPP !== false);
    }
    function shouldAllowSuggestionToggle(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.PERMITIR_TOGGLE_PALABRAS_SUGERIDAS !== false);
    }
    function shouldShowSuggestionsInitially(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.PALABRAS_SUGERIDAS_INICIAN_VISIBLES === true);
    }

    function shouldShowProductImageInNavigationPanels(){
      return !!(
        shouldShowProductImages() &&
        window.INTERRUPTORES &&
        window.INTERRUPTORES.MOSTRAR_IMAGEN_PRODUCTO_EN_CATEGORIAS_SUBCATEGORIAS === true
      );
    }
    const _hasIdle = ("requestIdleCallback" in window);
    function runIdle(fn, timeout=1200){
      if(_hasIdle) return requestIdleCallback(fn, { timeout });
      return setTimeout(fn, Math.min(250, timeout));
    }

    const WHATSAPP_NUMBER = "573042088961";

    const LOGOS_DIR = "logos";

    const fmtCOP = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 });

    const SITE_BASE = `https://${GITHUB_CATALOG_SOURCE.owner}.github.io/${GITHUB_CATALOG_SOURCE.repo}/${GITHUB_CATALOG_SOURCE.catalogDir}/`;

    const COMPANY_LOGOS = [
      SITE_BASE + LOGOS_DIR + "/logo_empresa.webp",
      SITE_BASE + LOGOS_DIR + "/logo_empresa.png"
    ];
    const COMPANY_LOGO = COMPANY_LOGOS[0];

    function normalizeText(t){
      return (t || "")
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
    }

    function categoryDisplayLabel(value){
      const raw = String(value || "").trim();
      if(!raw) return "";
      const key = normalizeText(raw).replace(/\s+/g, " ");
      const labels = {
        "otros productos": "Otros productos",
        "perfumes": "Perfumes",
        "desodorantes": "Desodorantes",
        "maquillaje": "Maquillaje",
        "cuidado facial": "Cuidado facial",
        "cuidado corporal": "Cuidado corporal",
        "cabello": "Cabello",
        "manos y pies": "Manos y pies",
        "higiene corporal": "Higiene corporal",
        "higiene intima": "Higiene íntima",
        "proteccion solar": "Protección solar",
        "kits y combos": "Kits y combos",
        "tecnologia y hogar": "Tecnología y hogar",
        "juguetes": "Juguetes",
        "papeleria": "Papelería",
        "medicamentos": "Medicamentos"
      };
      if(labels[key]) return labels[key];
      return raw.charAt(0).toLocaleUpperCase("es-CO") + raw.slice(1);
    }

    function shouldApplyHiddenAlbums(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.APLICAR_ALBUMES_OCULTOS === true);
    }
    function shouldApplySearchAlbumExclusions(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.APLICAR_EXCLUSION_ALBUMES_EN_BUSQUEDA === true);
    }
    function getHiddenAlbumNames(){
      if(!shouldApplyHiddenAlbums()) return [];
      return (Array.isArray(window.ALBUMES_OCULTOS) ? window.ALBUMES_OCULTOS : [])
        .map(item => normalizeText(item))
        .filter(Boolean);
    }
    function getSearchExcludedAlbumNames(){
      if(!shouldApplySearchAlbumExclusions()) return [];
      return (Array.isArray(window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA) ? window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA : [])
        .map(item => normalizeText(item))
        .filter(Boolean);
    }

    function toNumberDigits(s){
      return Number(String(s ?? "").replace(/[^\d]/g,"")) || 0;
    }
    function safeInt(s, def=0){
      const n = parseInt(String(s ?? "").replace(/[^\d]/g,""), 10);
      return Number.isFinite(n) ? n : def;
    }
    function extOf(filename){
      const i = String(filename || "").lastIndexOf(".");
      if(i < 0) return "";
      return String(filename).slice(i+1).toLowerCase();
    }
    function encodePath(p){
      return String(p || "")
        .split("/")
        .map(seg => encodeURIComponent(seg))
        .join("/");
    }
    function sanitizeLogoFilename(input){
      const raw = String(input || "").trim();
      if(!raw) return "";
      const just = raw.split(/[\/\\]/).pop();
      if(!just || just.includes("..")) return "";
      return just.replace(/[^\w.\- ]+/g, "").trim();
    }

    function buildPlaceholderCandidates(){
      const list = [];
      const picked = sanitizeLogoFilename(window.INTERRUPTORES?.IMAGEN_SUPLENTE_PRODUCTO);

      if(picked){
        const e = extOf(picked);
        if(e){
          list.push(SITE_BASE + LOGOS_DIR + "/" + encodePath(picked));
        }else{
          list.push(SITE_BASE + LOGOS_DIR + "/" + encodePath(picked) + ".webp");
          list.push(SITE_BASE + LOGOS_DIR + "/" + encodePath(picked) + ".png");
        }
      }

      list.push(
        SITE_BASE + LOGOS_DIR + "/suplente.webp",
        SITE_BASE + LOGOS_DIR + "/suplente.png",
        ...COMPANY_LOGOS
      );

      return [...new Set(list)];
    }

    let PRODUCT_PLACEHOLDERS = buildPlaceholderCandidates();
    let PRODUCT_PLACEHOLDER_IMAGE = (PRODUCT_PLACEHOLDERS[0] || COMPANY_LOGO);

    function productPlaceholderAbsoluteUrl(){
      return PRODUCT_PLACEHOLDER_IMAGE || COMPANY_LOGO;
    }


    function warmupPlaceholderOnce(){
      return new Promise((resolve)=>{
        try{
          PRODUCT_PLACEHOLDERS = buildPlaceholderCandidates();

          let i = 0;
          const tryNext = ()=>{
            if(i >= PRODUCT_PLACEHOLDERS.length){
              PRODUCT_PLACEHOLDER_IMAGE = COMPANY_LOGO;
              resolve();
              return;
            }

            const url = PRODUCT_PLACEHOLDERS[i++];
            const test = new Image();
            test.onload = ()=>{
              PRODUCT_PLACEHOLDER_IMAGE = url;
              resolve();
            };
            test.onerror = tryNext;
            test.decoding = "async";
            test.loading = "eager";
            test.src = url;
          };

          tryNext();
        }catch(_){
          PRODUCT_PLACEHOLDER_IMAGE = COMPANY_LOGO;
          resolve();
        }
      });
    }


    const GOOGLE_SHEET_QUERY_TIMEOUT_MS = 25000;
    const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_CATALOG_SOURCE.owner}/${GITHUB_CATALOG_SOURCE.repo}`;
    const PRODUCT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);
    const GITHUB_IMAGE_INDEX_CACHE_KEY = "irenismb_github_image_index_cache";

    function googleSheetQueryUrl(callbackName){
      const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(GOOGLE_SHEET_SOURCE.spreadsheetId)}/gviz/tq`;
      const query = new URLSearchParams({
        sheet: GOOGLE_SHEET_SOURCE.sheetName,
        headers: "1",
        range: "A:N",
        tq: "select A,B,C,D,E,F,G,H,I,J,K,L,M,N",
        tqx: `out:json;responseHandler:${callbackName}`
      });
      return `${base}?${query.toString()}`;
    }

    function loadGoogleSheetRows(){
      return new Promise((resolve, reject)=>{
        const callbackName = "__googleSheetCatalog_" + Date.now() + "_" + Math.random().toString(36).slice(2);
        const script = document.createElement("script");
        let settled = false;

        const cleanup = ()=>{
          try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
          if(script.parentNode) script.parentNode.removeChild(script);
        };

        const timer = window.setTimeout(()=>{
          if(settled) return;
          settled = true;
          cleanup();
          reject(new Error("Tiempo de espera agotado al consultar el Google Sheet."));
        }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

        window[callbackName] = (payload)=>{
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

          const cellValue = (cell)=>{
            if(!cell) return "";
            if(cell.f !== undefined && cell.f !== null) return String(cell.f);
            if(cell.v !== undefined && cell.v !== null) return String(cell.v);
            return "";
          };

          const rows = payload.table.rows.map(row=>{
            const c = Array.isArray(row && row.c) ? row.c : [];
            const value = index => cellValue(c[index]).trim();
            let code = value(0);
            if(/^\d{1,4}$/.test(code)) code = code.padStart(4, "0");

            return {
              code,
              section: value(1),
              category: value(2),
              subcategory: value(3),
              fragranceFamily: value(4),
              condition: value(5),
              commercialState: value(6),
              name: value(7),
              priceText: value(8),
              costText: value(9),
              stockText: value(10),
              referenceExternal: value(11),
              description: value(12),
              codeNatura: value(13),
              fullTxtRecord: [
                value(7),
                "",
                `Precio: ${value(8)} Costo: ${value(9)} Stock: ${value(10)} Referencia externa: ${value(11)}. ${value(12)}`
              ].join("\n")
            };
          }).filter(row => /^\d{4}$/.test(row.code) && row.name);

          resolve(rows);
        };

        script.onerror = ()=>{
          if(settled) return;
          settled = true;
          window.clearTimeout(timer);
          cleanup();
          reject(new Error("No se pudo conectar con Google Sheets."));
        };

        script.src = googleSheetQueryUrl(callbackName);
        script.async = true;
        document.head.appendChild(script);
      });
    }


    function googleSheetRemoteQueryUrl(sheetName, range, tq, callbackName){
      const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(REMOTE_CONTROL_SOURCE.spreadsheetId)}/gviz/tq`;
      const query = new URLSearchParams({
        sheet: sheetName,
        headers: "1",
        range,
        tq,
        tqx: `out:json;responseHandler:${callbackName}`
      });
      return `${base}?${query.toString()}`;
    }

    function loadGoogleSheetRemoteMatrix(sheetName, range, tq, callbackPrefix){
      return new Promise((resolve, reject)=>{
        const callbackName = `${callbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement("script");
        let settled = false;

        const cleanup = ()=>{
          try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
          if(script.parentNode) script.parentNode.removeChild(script);
        };

        const timer = window.setTimeout(()=>{
          if(settled) return;
          settled = true;
          cleanup();
          reject(new Error(`Tiempo de espera agotado al consultar la hoja ${sheetName}.`));
        }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

        window[callbackName] = (payload)=>{
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

          const cellValue = (cell)=>{
            if(!cell) return "";
            if(cell.f !== undefined && cell.f !== null) return String(cell.f);
            if(cell.v !== undefined && cell.v !== null) return String(cell.v);
            return "";
          };

          resolve(payload.table.rows.map(row=>{
            const cells = Array.isArray(row && row.c) ? row.c : [];
            return cells.map(cellValue);
          }));
        };

        script.onerror = ()=>{
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
    }

    function parseRemoteBoolean(value){
      const normalized = normalizeText(value).replace(/\s+/g, " ");
      if(["activado","activo","true","verdadero","si","sí","1","on"].includes(normalized)) return true;
      if(["desactivado","inactivo","false","falso","no","0","off"].includes(normalized)) return false;
      return null;
    }

    function applyRemoteControlRows(rows){
      let changed = false;
      for(const row of (Array.isArray(rows) ? rows : [])){
        const key = String(row?.[4] || "").trim().toUpperCase();
        if(!key) continue;

        const rawState = String(row?.[1] || "").trim();
        window.REMOTE_CONTROL_VALUES[key] = rawState;

        const state = parseRemoteBoolean(rawState);
        if(state === null || !REMOTE_BOOLEAN_CONTROL_KEYS.has(key)) continue;
        if(INTERRUPTORES[key] !== state){
          INTERRUPTORES[key] = state;
          changed = true;
        }
      }
      return changed;
    }

    function routeKeyFromParts(section, category, subcategory, fragranceFamily, commercialState){
      return [section, category, subcategory, fragranceFamily, commercialState]
        .map(value => normalizeText(value).replace(/\s+/g, " "))
        .join("|");
    }

    function applyRemoteCategoryRows(rows){
      const hidden = [];
      const excluded = [];
      const allowed = [];
      let validRows = 0;

      for(const row of (Array.isArray(rows) ? rows : [])){
        const section = String(row?.[0] || "").trim();
        const category = String(row?.[1] || "").trim();
        const subcategory = String(row?.[2] || "").trim();
        const fragranceFamily = String(row?.[3] || "").trim();
        const commercialState = String(row?.[4] || "").trim();
        if(!section || !category || !commercialState) continue;

        const hiddenState = parseRemoteBoolean(row?.[5]);
        const excludedState = parseRemoteBoolean(row?.[6]);
        if(hiddenState === null && excludedState === null) continue;

        validRows++;
        const routeKey = routeKeyFromParts(section, category, subcategory, fragranceFamily, commercialState);
        allowed.push(routeKey);
        if(hiddenState === true) hidden.push(routeKey);
        if(excludedState === true) excluded.push(routeKey);
      }

      if(validRows === 0){
        console.info("La hoja Categorias no devolvió rutas válidas; se conserva la configuración anterior.");
        return false;
      }

      const uniqueHidden = [...new Set(hidden)];
      const uniqueExcluded = [...new Set(excluded)];
      const uniqueAllowed = [...new Set(allowed)];

      const previousHidden = JSON.stringify(window.ALBUMES_OCULTOS || []);
      const previousExcluded = JSON.stringify(window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA || []);
      const previousAllowed = JSON.stringify([...allowedProductRouteKeySet].sort());

      window.ALBUMES_OCULTOS = uniqueHidden;
      window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA = uniqueExcluded;
      allowedProductRouteKeySet = new Set(uniqueAllowed);
      saveRemoteCategoryCache(uniqueHidden, uniqueExcluded);

      return previousHidden !== JSON.stringify(uniqueHidden) ||
             previousExcluded !== JSON.stringify(uniqueExcluded) ||
             previousAllowed !== JSON.stringify([...allowedProductRouteKeySet].sort());
    }

    async function refreshRemoteCatalogConfiguration(options = {}){
      const rebuild = options.rebuild !== false;
      const initial = options.initial === true;

      if(!REMOTE_CONTROL_SOURCE.enabled) return false;

      const [controlsResult, categoriesResult] = await Promise.allSettled([
        loadGoogleSheetRemoteMatrix(
          REMOTE_CONTROL_SOURCE.controlsSheetName,
          "A:E",
          "select A,B,C,D,E",
          "__remoteCatalogControls"
        ),
        loadGoogleSheetRemoteMatrix(
          REMOTE_CONTROL_SOURCE.categoriesSheetName,
          "A:H",
          "select A,B,C,D,E,F,G,H",
          "__remoteCatalogCategories"
        )
      ]);

      let changed = false;

      if(controlsResult.status === "fulfilled"){
        changed = applyRemoteControlRows(controlsResult.value) || changed;
      }else{
        console.info("Configuración remota no disponible; se conservan los interruptores locales.", controlsResult.reason);
      }

      if(categoriesResult.status === "fulfilled"){
        changed = applyRemoteCategoryRows(categoriesResult.value) || changed;
      }else{
        console.info("Categorías remotas no disponibles; se conservan las listas locales.", categoriesResult.reason);
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
    }

    let remoteConfigPollingTimer = 0;
    let remoteConfigReadyResolver = null;
    window.REMOTE_CONFIG_READY = new Promise(resolve => {
      remoteConfigReadyResolver = resolve;
    });

    async function initializeRemoteCatalogConfiguration(){
      try{
        await refreshRemoteCatalogConfiguration({ rebuild:false, initial:true });
      }catch(error){
        console.info("No se pudo inicializar la configuración global remota.", error);
      }finally{
        if(remoteConfigReadyResolver){
          remoteConfigReadyResolver(true);
          remoteConfigReadyResolver = null;
        }
      }

      const interval = Math.max(30000, Number(REMOTE_CONTROL_SOURCE.refreshMs) || 60000);
      if(REMOTE_CONTROL_SOURCE.enabled && !remoteConfigPollingTimer){
        remoteConfigPollingTimer = window.setInterval(()=>{
          refreshRemoteCatalogConfiguration({ rebuild:true }).catch(error=>{
            console.info("No se pudo actualizar la configuración global remota.", error);
          });
        }, interval);
      }
    }

    function readGitHubImageIndexCache(){
      try{
        const raw = localStorage.getItem(GITHUB_IMAGE_INDEX_CACHE_KEY);
        if(!raw) return [];
        const parsed = JSON.parse(raw);
        const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
        return entries
          .map(entry => ({ path:String(entry?.path || "").trim(), type:"blob" }))
          .filter(entry => entry.path && PRODUCT_IMAGE_EXTENSIONS.has(extensionOfFilename(entry.path)));
      }catch(_){
        return [];
      }
    }

    function saveGitHubImageIndexCache(entries){
      try{
        const paths = (Array.isArray(entries) ? entries : [])
          .map(entry => String(entry?.path || "").trim())
          .filter(Boolean);
        localStorage.setItem(GITHUB_IMAGE_INDEX_CACHE_KEY, JSON.stringify({
          savedAt:Date.now(),
          entries:paths.map(path => ({ path }))
        }));
      }catch(_){}
    }

    async function fetchGitHubJson(url){
      const controller = new AbortController();
      const timer = window.setTimeout(()=>controller.abort(), GOOGLE_SHEET_QUERY_TIMEOUT_MS);
      try{
        const response = await fetch(url, {
          cache:"no-store",
          signal:controller.signal,
          headers:{ "Accept":"application/vnd.github+json" }
        });
        if(!response.ok){
          const remaining = response.headers.get("x-ratelimit-remaining");
          const suffix = remaining === "0" ? " Se alcanzó temporalmente el límite de consultas de la API." : "";
          throw new Error(`GitHub respondió ${response.status} al consultar las imágenes.${suffix}`);
        }
        return await response.json();
      }finally{
        window.clearTimeout(timer);
      }
    }

    async function loadGitHubImageIndex(){
      try{
        const ref = encodeURIComponent(GITHUB_CATALOG_SOURCE.branch);
        const treeUrl = `${GITHUB_API_BASE}/git/trees/${ref}?recursive=1`;
        const treePayload = await fetchGitHubJson(treeUrl);
        if(!treePayload || !Array.isArray(treePayload.tree) || treePayload.truncated){
          throw new Error("La API de GitHub no devolvió un árbol completo del repositorio.");
        }

        const prefix = `${GITHUB_CATALOG_SOURCE.catalogDir}/${GITHUB_CATALOG_SOURCE.productsFolder}/`;
        const entries = treePayload.tree
          .filter(entry => {
            if(!entry || entry.type !== "blob") return false;
            const fullPath = String(entry.path || "");
            if(!fullPath.startsWith(prefix)) return false;
            const filename = fullPath.split("/").pop() || "";
            return PRODUCT_IMAGE_EXTENSIONS.has(extensionOfFilename(filename));
          })
          .map(entry => ({
            ...entry,
            path:String(entry.path || "").slice(prefix.length)
          }));

        if(!entries.length){
          throw new Error("La API de GitHub no encontró imágenes publicadas dentro de la carpeta productos.");
        }

        saveGitHubImageIndexCache(entries);
        return entries;
      }catch(error){
        const cached = readGitHubImageIndexCache();
        if(cached.length){
          console.warn("No se pudo actualizar el índice dinámico de imágenes; se conserva el último índice válido guardado en el navegador.", error);
          return cached;
        }
        console.warn("No se pudo construir el índice dinámico de imágenes desde la API de GitHub; se usarán imágenes suplentes.", error);
        return [];
      }
    }

    function encodeRepoPath(path){
      return String(path || "")
        .split("/")
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join("/");
    }

    function publishedGitHubAssetUrl(relativePath){
      const clean = String(relativePath || "").replace(/^\/+/, "");
      return `${SITE_BASE}${encodeRepoPath(clean)}`;
    }

    function extractGlobalProductCode(filename){
      const name = String(filename || "").trim();
      const match = name.match(/^(\d{4})(?=$|[_.\s-])/);
      return match ? match[1] : "";
    }

    function extensionOfFilename(filename){
      const name = String(filename || "");
      const dot = name.lastIndexOf(".");
      return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
    }

    function extractProductImageSequence(filename){
      const name = String(filename || "").trim();
      const match = name.match(/^\d{4}_(\d{2,})(?=$|[_.\s-])/);
      if(!match) return null;
      const value = Number(match[1]);
      return Number.isSafeInteger(value) ? value : null;
    }

    function choosePreferredImage(currentEntry, candidateEntry){
      if(!currentEntry) return candidateEntry;
      const ranking = { webp:1, png:2, jpg:3, jpeg:4, avif:5, gif:6 };
      const currentRank = ranking[extensionOfFilename(currentEntry.path)] || 99;
      const candidateRank = ranking[extensionOfFilename(candidateEntry.path)] || 99;
      return candidateRank < currentRank ? candidateEntry : currentEntry;
    }

    function orderProductImageEntries(entries){
      const numbered = new Map();
      const legacyByStem = new Map();

      for(const entry of (Array.isArray(entries) ? entries : [])){
        const path = String(entry && entry.path || "");
        if(!path) continue;
        const filename = path.split("/").pop() || "";
        const sequence = extractProductImageSequence(filename);

        if(sequence !== null){
          numbered.set(sequence, choosePreferredImage(numbered.get(sequence), entry));
          continue;
        }

        const stem = path.replace(/\.[^.\/]+$/, "").toLowerCase();
        legacyByStem.set(stem, choosePreferredImage(legacyByStem.get(stem), entry));
      }

      const numberedEntries = [...numbered.entries()]
        .sort((a,b)=>a[0]-b[0])
        .map(([,entry])=>entry);
      const legacyEntries = [...legacyByStem.values()]
        .sort((a,b)=>String(a.path || "").localeCompare(String(b.path || ""), "es", { numeric:true, sensitivity:"base" }));

      return numberedEntries.length ? [...numberedEntries, ...legacyEntries] : legacyEntries;
    }

    async function loadGoogleSheetCatalog(){
      let rows = [];
      try{
        rows = await loadGoogleSheetRows();
      }catch(error){
        const sheetError = error instanceof Error ? error : new Error(String(error || "No se pudo leer el Google Sheet."));
        sheetError.catalogStage = "sheet";
        throw sheetError;
      }

      let imageEntries = [];
      try{
        imageEntries = await loadGitHubImageIndex();
      }catch(error){
        console.warn("Los productos se cargaron desde el Google Sheet, pero no se pudo actualizar el índice dinámico de imágenes publicadas. Se usarán imágenes suplentes.", error);
        imageEntries = [];
      }

      const sheetCodes = new Set(
        rows.map(row => String(row && row.code || "").trim()).filter(Boolean)
      );
      const imagesByCode = new Map();
      const entries = Array.isArray(imageEntries) ? imageEntries : [];

      try{
        for(const entry of entries){
          const relativePath = String(entry && entry.path || "");
          const filename = relativePath.split("/").pop() || "";
          if(!relativePath || !filename) continue;

          const code = extractGlobalProductCode(filename);
          if(!code || !sheetCodes.has(code)) continue;

          const list = imagesByCode.get(code) || [];
          list.push(entry);
          imagesByCode.set(code, list);
        }

        for(const [code, entriesForCode] of imagesByCode){
          imagesByCode.set(code, orderProductImageEntries(entriesForCode));
        }
      }catch(error){
        console.warn("No se pudo asociar el índice de imágenes a los productos. El catálogo continuará con imágenes suplentes.", error);
        imagesByCode.clear();
      }

      let giftImageUrls = [];
      try{
        const giftPrefix = `${String(GIFT_GITHUB_SOURCE.folder || "").toLowerCase()}/`;
        giftImageUrls = entries
          .filter(entry => {
            const relativePath = String(entry && entry.path || "");
            return relativePath.toLowerCase().startsWith(giftPrefix) &&
                   PRODUCT_IMAGE_EXTENSIONS.has(extensionOfFilename(relativePath));
          })
          .sort((a,b)=>String(a.path || "").localeCompare(String(b.path || ""), "es", { numeric:true, sensitivity:"base" }))
          .map(entry => {
            const publishedPath = `${GITHUB_CATALOG_SOURCE.productsFolder}/${entry.path}`;
            return publishedGitHubAssetUrl(publishedPath);
          });
      }catch(error){
        console.warn("No se pudo preparar la galería de regalos. Los productos del inventario continuarán cargando.", error);
        giftImageUrls = [];
      }

      return {
        sheetEntries: rows.map(row => ({ row, imageIndex:imagesByCode })),
        giftImageUrls
      };
    }

    function parseOptionalWholeNumber(value){
      const raw = String(value ?? "").trim();
      if(!raw) return null;
      const digits = raw.replace(/[^\d]/g, "");
      if(!digits) return null;
      const parsed = Number(digits);
      return Number.isSafeInteger(parsed) ? parsed : null;
    }

    function parseOfficialInventoryRecord(item){
      const rawName = String((item && item.name) || "").trim();
      const rawDescription = String((item && item.description) || "").trim();
      const officialRecordPattern = /^([\s\S]+?)\.\s*Precio:\s*([\d.\s]*)\s*Costo:\s*([\d.\s]*)\s*Stock:\s*([\d\s]*)\s*Referencia externa:\s*([\s\S]*)$/i;

      let match = null;
      for(const candidate of [rawDescription, rawName]){
        match = candidate.match(officialRecordPattern);
        if(match) break;
      }

      if(!match){
        const fallbackPrice = parseOptionalWholeNumber(item && item.priceMineText);
        const numericPrice = Number(item && item.priceMine);
        const explicitStock = parseOptionalWholeNumber(item && item.stock);
        return {
          matched: false,
          name: rawName,
          description: rawDescription,
          price: fallbackPrice ?? (numericPrice > 0 ? numericPrice : 0),
          hasPrice: fallbackPrice !== null || numericPrice > 0,
          stock: explicitStock,
          referenceExternal: ""
        };
      }

      const priceText = match[2].trim();
      const stockText = match[4].trim();
      const referenceAndDescription = match[5].trim();
      let referenceExternal = "";
      let description = referenceAndDescription;
      const firstSentenceEnd = referenceAndDescription.indexOf(". ");
      if(firstSentenceEnd > 0){
        const possibleReference = referenceAndDescription.slice(0, firstSentenceEnd).trim();
        const remainingDescription = referenceAndDescription.slice(firstSentenceEnd + 2).trim();
        const words = possibleReference.split(/\s+/).filter(Boolean);
        const connectors = new Set(["a", "al", "de", "del", "el", "en", "la", "las", "los", "para", "y"]);
        const looksLikeSourceLabel = words.length > 0
          && words.length <= 8
          && possibleReference.length <= 80
          && words.every(word => connectors.has(normalizeText(word)) || /^[A-ZÁÉÍÓÚÜÑ0-9]/.test(word));
        if(looksLikeSourceLabel && remainingDescription){
          referenceExternal = possibleReference;
          description = remainingDescription;
        }
      }

      return {
        matched: true,
        name: match[1].trim(),
        description,
        price: parseOptionalWholeNumber(priceText) ?? 0,
        hasPrice: Boolean(priceText),
        stock: parseOptionalWholeNumber(stockText),
        referenceExternal
      };
    }

    function makeProductFromGoogleSheet(entry){
      const row = entry && entry.row;
      const imageIndex = entry && entry.imageIndex;
      if(!row) return null;

      const code = String(row.code || "").trim();
      const name = String(row.name || "").trim();
      const section = String(row.section || "").trim();
      const rawCategory = String(row.category || "").trim();
      const category = section === "Regalos para toda ocasión" ? rawCategory : (rawCategory || "General");
      const subcategory = String(row.subcategory || "").trim();
      const fragranceFamily = String(row.fragranceFamily || "").trim();
      const condition = String(row.condition || "").trim();
      const commercialState = String(row.commercialState || "A la venta").trim() || "A la venta";
      if(!/^\d{4}$/.test(code) || !name) return null;

      const indexedImages = imageIndex && imageIndex.get(code);
      const imageEntries = Array.isArray(indexedImages)
        ? indexedImages
        : (indexedImages ? [indexedImages] : []);
      const imageRelativePaths = imageEntries
        .map(imageEntry => String(imageEntry && imageEntry.path || ""))
        .filter(Boolean);
      const imageUrls = imageRelativePaths.map(imageRelativePath => {
        const publishedPath = `${GITHUB_CATALOG_SOURCE.productsFolder}/${imageRelativePath}`;
        return publishedGitHubAssetUrl(publishedPath);
      });
      const imageRelativePath = imageRelativePaths[0] || "";
      const docsImageUrl = imageUrls[0] || "";
      const syntheticFilename = imageRelativePath || `${code}.webp`;

      const priceText = String(row.priceText || "").trim();
      const stockText = String(row.stockText || "").trim();

      return {
        id: code,
        name,
        section,
        category,
        subcategory,
        fragranceFamily,
        condition,
        commercialState,
        brand: /\bnatura\b/i.test(name) ? "Natura" : (/\bavon\b/i.test(name) ? "AVON" : ""),
        price: parseOptionalWholeNumber(priceText) ?? 0,
        hasPrice: Boolean(priceText),
        cost: parseOptionalWholeNumber(row.costText),
        costText: String(row.costText || ""),
        stock: parseOptionalWholeNumber(stockText),
        referenceExternal: String(row.referenceExternal || "").trim(),
        codeNatura: String(row.codeNatura || "").trim(),
        srcFilename: syntheticFilename,
        imgFilename: syntheticFilename,
        fileExt: extensionOfFilename(syntheticFilename) || "webp",
        hasImage: Boolean(docsImageUrl),
        isDocumentFirst: false,
        description: String(row.description || "").trim(),
        fullTxtRecord: String(row.fullTxtRecord || ""),
        docsImageUrl,
        imageUrls,
        docsDocumentUrl: `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_SOURCE.spreadsheetId}/edit#gid=${GOOGLE_SHEET_SOURCE.gid}`,
        searchKey: normalizeText([code, name, section, category, subcategory, fragranceFamily, condition, row.description, row.referenceExternal].filter(Boolean).join(" "))
      };
    }


    function makeGiftGalleryProducts(imageUrls){
      const images = Array.isArray(imageUrls) ? imageUrls : [];
      return images
        .map((imageUrl,index)=>{
          const src = String(imageUrl || "").trim();
          if(!/^https:\/\//i.test(src)) return null;
          return {
            id: `regalo-galeria-${String(index + 1).padStart(2,"0")}`,
            name: "",
            section: GIFT_GITHUB_SOURCE.section,
            category: "Regalos",
            subcategory: "",
            fragranceFamily: "",
            condition: "",
            commercialState: "A la venta",
            brand: "",
            price: 0,
            hasPrice: false,
            cost: null,
            costText: "",
            stock: null,
            referenceExternal: "",
            codeNatura: "",
            srcFilename: "",
            imgFilename: "",
            fileExt: "webp",
            hasImage: true,
            isDocumentFirst: false,
            isGiftGalleryImage: true,
            description: "",
            fullTxtRecord: "",
            docsImageUrl: src,
            imageUrls: [src],
            docsDocumentUrl: "",
            searchKey: normalizeText("regalo regalos toda ocasión detalles arreglos para regalar")
          };
        })
        .filter(Boolean);
    }

    function clearLegacyProductCaches(){
      return;
    }

    function updateCatalogFooterProducts(products){
      const list = document.getElementById("beautyProductsList");
      const count = document.querySelector(".beauty-products-count");
      const source = Array.isArray(products) ? products : [];
      const namedProducts = source.filter(product => product && String(product.name || "").trim());

      if(count){
        count.textContent = `${namedProducts.length} ${namedProducts.length === 1 ? "producto" : "productos"}`;
      }
      if(!list) return;

      const sorted = source.slice().sort((a,b)=>
        String(a?.section || "").localeCompare(String(b?.section || ""), "es", { sensitivity:"base" }) ||
        String(a?.category || "").localeCompare(String(b?.category || ""), "es", { sensitivity:"base" }) ||
        String(a?.subcategory || "").localeCompare(String(b?.subcategory || ""), "es", { sensitivity:"base" }) ||
        String(a?.fragranceFamily || "").localeCompare(String(b?.fragranceFamily || ""), "es", { sensitivity:"base" }) ||
        String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity:"base" })
      );
      const fragment = document.createDocumentFragment();
      for(const product of sorted){
        const name = String(product?.name || "").trim();
        if(!name) continue;

        const item = document.createElement("li");
        item.dataset.productCode = String(product?.id || "").trim();

        const title = document.createElement("strong");
        title.className = "beauty-product-name";
        title.textContent = name;

        const meta = document.createElement("span");
        meta.className = "beauty-product-meta";
        const metaParts = [];
        const mainGroup = mainNavigationGroupForProduct(product);
        const subcategory = navigationCategoryForProduct(product);
        if(mainGroup) metaParts.push(mainGroup);
        if(subcategory && cleanNavKey(subcategory) !== cleanNavKey(mainGroup)) metaParts.push(subcategory);
        if(product?.fragranceFamily) metaParts.push(product.fragranceFamily);
        if(product?.id && shouldShowProductCodes()) metaParts.push(`Código ${product.id}`);
        if(shouldShowProductPrices() && product?.hasPrice !== false && Number(product?.price) >= 0){
          metaParts.push(fmtCOP.format(Number(product.price)));
        }
        const hasKnownStock = Number.isInteger(product?.stock) && product.stock >= 0;
        if(INTERRUPTORES.MOSTRAR_CANTIDAD_STOCK){
          metaParts.push(hasKnownStock ? `Stock: ${product.stock}` : "Stock: Por confirmar");
        }
        if(INTERRUPTORES.MOSTRAR_TEXTO_ESTADO_STOCK){
          metaParts.push(hasKnownStock
            ? (product.stock > 0 ? "Disponible" : "Sin stock")
            : "Disponibilidad por confirmar");
        }
        meta.textContent = metaParts.filter(Boolean).join(" · ");

        const description = document.createElement("span");
        description.className = "beauty-product-description";
        description.textContent = String(product?.description || `Producto disponible en ${product?.category || "Irenismb Stock Natura"}.`).trim();

        item.append(title, meta, description);
        fragment.appendChild(item);
      }
      list.replaceChildren(fragment);
    }

    function isMobileDevice(){
      try{
        const ua = (navigator.userAgent || "").toLowerCase();
        const byUA = /android|iphone|ipad|ipod|iemobile|opera mini/.test(ua);
        const byPointer = window.matchMedia && window.matchMedia("(pointer:coarse)").matches;
        return Boolean(byUA || byPointer);
      }catch(_){
        return false;
      }
    }

    /* ==========================
       WhatsApp (la compra se envía al WhatsApp de la tienda)
       ========================== */
    const LS_CLIENT_KEY = "irenismb_client";
    const LS_ADDRESS_KEY = "irenismb_address";
    const LS_SHIPPING_KEY = "irenismb_shipping_cop";

    function readJsonLS(key, fallbackObj){
      try{
        const raw = localStorage.getItem(key);
        if(!raw) return fallbackObj;
        const obj = JSON.parse(raw);
        if(obj && typeof obj === "object") return obj;
        return fallbackObj;
      }catch(_){
        return fallbackObj;
      }
    }
    function writeJsonLS(key, obj){
      try{ localStorage.setItem(key, JSON.stringify(obj || {})); }catch(_){}
    }
    function readStringLS(key, fallback=""){
      try{
        const raw = localStorage.getItem(key);
        if(raw == null) return fallback;
        return String(raw);
      }catch(_){
        return fallback;
      }
    }
    function writeStringLS(key, val){
      try{ localStorage.setItem(key, String(val ?? "")); }catch(_){}
    }


    function getWhatsAppTo(){
      return WHATSAPP_NUMBER;
    }

    function waLinkTo(toDigits, text){
      const msg = String(text || "");
      const to = String(toDigits || "");
      if (isMobileDevice()){
        return `https://wa.me/${encodeURIComponent(to)}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
      }
      return `https://web.whatsapp.com/send?phone=${encodeURIComponent(to)}${msg ? `&text=${encodeURIComponent(msg)}` : ""}`;
    }
    function waLink(text){
      return waLinkTo(getWhatsAppTo(), text);
    }

    (function syncTopWhatsApp(){
      const a = document.getElementById("waTopLink");
      if (!a) return;
      a.href = waLink("");
      a.setAttribute("aria-label", isMobileDevice() ? "WhatsApp" : "WhatsApp Web");
    })();

    const imgModal = document.getElementById("imgModal");
    const imgModalImg = document.getElementById("imgModalImg");
    const imgModalClose = document.getElementById("imgModalClose");
    const imgModalBackdrop = document.getElementById("imgModalBackdrop");

    let _modalLockCount = 0;
    function lockBodyScroll(){
      _modalLockCount++;
      document.body.style.overflow = "hidden";
    }
    function unlockBodyScroll(){
      _modalLockCount = Math.max(0, _modalLockCount - 1);
      if(_modalLockCount === 0) document.body.style.overflow = "";
    }

    function rememberModalTrigger(modal){
      if(modal) modal.__lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    function restoreModalTrigger(modal){
      const prev = modal && modal.__lastFocused;
      if(prev && typeof prev.focus === "function"){
        try{ prev.focus({ preventScroll:true }); }catch(_){ try{ prev.focus(); }catch(__){} }
      }
      if(modal) modal.__lastFocused = null;
    }
    function focusElement(el){
      if(el && typeof el.focus === "function"){
        try{ el.focus({ preventScroll:true }); }catch(_){ try{ el.focus(); }catch(__){} }
      }
    }
    function focusFirstInModal(modal, preferred){
      if(preferred){
        focusElement(preferred);
        return;
      }
      if(!modal) return;
      const first = modal.querySelector('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      focusElement(first);
    }
    function getOpenModal(){
      return [imgModal, addressModal, clientModal, cartModal].find(m => m && m.classList && m.classList.contains("open")) || null;
    }
    function trapFocusInModal(modal, e){
      if(!modal || e.key !== "Tab") return;
      const nodes = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
      if(!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if(e.shiftKey){
        if(active === first || !modal.contains(active)){
          e.preventDefault();
          focusElement(last);
        }
      }else{
        if(active === last || !modal.contains(active)){
          e.preventDefault();
          focusElement(first);
        }
      }
    }

    function openImgModal(src, alt){
      if(!imgModal || !imgModalImg || !src) return;
      if(imgModal.classList.contains("open")) return;
      rememberModalTrigger(imgModal);
      imgModalImg.src = src;
      imgModalImg.alt = alt || "Imagen ampliada del producto";
      imgModal.classList.add("open");
      imgModal.setAttribute("aria-hidden","false");
      lockBodyScroll();
      focusFirstInModal(imgModal, imgModalClose);
    }
    function closeImgModal(){
      if(!imgModal || !imgModalImg) return;
      if(!imgModal.classList.contains("open")) return;
      imgModal.classList.remove("open");
      imgModal.setAttribute("aria-hidden","true");
      imgModalImg.src = "";
      unlockBodyScroll();
      restoreModalTrigger(imgModal);
    }
    if(imgModalClose) imgModalClose.addEventListener("click", closeImgModal);
    if(imgModalBackdrop) imgModalBackdrop.addEventListener("click", closeImgModal);

    function makeImgFromFilename(filename, name, docsImageUrl=""){
      const img = document.createElement("img");
      img.alt = name ? ("Foto " + name) : "Foto del producto";
      img.loading = "lazy";
      img.decoding = "async";

      let zoomable = false;
      function setNonZoom(){
        zoomable = false;
        img.style.cursor = "default";
      }

      const preferredUrl = String(docsImageUrl || "").trim();
      const allowReal = shouldShowProductImages() && Boolean(preferredUrl);

      if(!allowReal){
        img.src = productPlaceholderAbsoluteUrl();
        setNonZoom();
      }else{
        zoomable = true;
        img.src = preferredUrl;
      }

      img.onerror = ()=>{
        if(img.dataset.fallbackTried === "1"){
          img.onerror = null;
          img.src = COMPANY_LOGO;
          setNonZoom();
          return;
        }
        img.dataset.fallbackTried = "1";
        img.src = productPlaceholderAbsoluteUrl();
        setNonZoom();
      };

      img.addEventListener("click", ()=>{
        if(!zoomable) return;
        const src = img.currentSrc || img.src;
        if(src) openImgModal(src, img.alt);
      });

      return img;
    }

    function makeCartThumbFromFilename(filename, name, docsImageUrl=""){
      const img = document.createElement("img");
      img.className = "cart-thumb";
      img.alt = name ? ("Foto " + name) : "Foto del producto";
      img.loading = "lazy";
      img.decoding = "async";

      let zoomable = false;
      function setNonZoom(){
        zoomable = false;
        img.style.cursor = "default";
      }

      const preferredUrl = String(docsImageUrl || "").trim();
      const allowReal = shouldShowProductImages() && Boolean(preferredUrl);

      if(!allowReal){
        img.src = productPlaceholderAbsoluteUrl();
        setNonZoom();
      }else{
        zoomable = true;
        img.src = preferredUrl;
      }

      img.onerror = ()=>{
        if(img.dataset.fallbackTried === "1"){
          img.onerror = null;
          img.src = COMPANY_LOGO;
          setNonZoom();
          return;
        }
        img.dataset.fallbackTried = "1";
        img.src = productPlaceholderAbsoluteUrl();
        setNonZoom();
      };

      img.addEventListener("click", ()=>{
        if(!zoomable) return;
        const src = img.currentSrc || img.src;
        if(src) openImgModal(src, img.alt);
      });

      return img;
    }

    let allLoadedProducts = [];
    let all = [];
    let productById = new Map();

    const ROOT_ALBUM_KEY = "__root__";
    const ALBUM_COLORS = [
      { top:"#f3a7b9", base:"#e790ab", tab:"#eb99b1", shadow:"rgba(203, 112, 145, .32)" },
      { top:"#82ace8", base:"#5f8fda", tab:"#6f9ee1", shadow:"rgba(77, 123, 205, .30)" },
      { top:"#e7bc80", base:"#d7a35f", tab:"#deaf70", shadow:"rgba(178, 121, 43, .30)" },
      { top:"#ee9fc2", base:"#de79a8", tab:"#e58bb4", shadow:"rgba(189, 86, 138, .30)" },
      { top:"#71c7ab", base:"#4db08e", tab:"#5cb999", shadow:"rgba(45, 134, 104, .28)" },
      { top:"#f0cf58", base:"#e0b921", tab:"#e8c43a", shadow:"rgba(171, 128, 11, .28)" },
      { top:"#54d0c5", base:"#26b8ab", tab:"#3cc4b7", shadow:"rgba(21, 134, 126, .28)" },
      { top:"#d6c3a6", base:"#c5ad88", tab:"#ceb796", shadow:"rgba(129, 100, 58, .24)" }
    ];
    function githubPagesAssetUrl(relativePath){
      return SITE_BASE + encodeRepoPath(relativePath);
    }

    const ROOT_ICON_IMAGES = {
      ella: githubPagesAssetUrl("iconos/2026-09-06_icono categoria para ella perfume floral.webp"),
      el: githubPagesAssetUrl("iconos/2026-09-06_icono categoria para el perfume azul.webp"),
      unisex: githubPagesAssetUrl("iconos/2026-09-06_icono categoria unisex cuidado botanico neutro.webp"),
      regalos: githubPagesAssetUrl("iconos/2026-09-06_icono categoria regalos caja lazo rosa.webp"),
      otros: githubPagesAssetUrl("iconos/2026-09-06_icono categoria otros productos hogar variedad.webp")
    };

    const NAV_AUDIENCES = [
      {
        label:"Perfumes y fragancias",
        section:"Belleza y cuidado",
        subtitle:"Perfumería femenina, perfumería masculina y perfumes.",
        iconImage:githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria perfumes fragancia floral rosa.webp"),
        theme:"perfumes"
      },
      {
        label:"Cabello",
        section:"Belleza y cuidado",
        subtitle:"Reparación, nutrición, hidratación, rizos, anticaída, color, limpieza y protección.",
        iconImage:githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria cabello mechon brillante capilar.webp"),
        theme:"cabello"
      },
      {
        label:"Cuidado personal",
        section:"Belleza y cuidado",
        subtitle:"Cuidado facial y corporal, higiene, desodorantes, manos, pies y protección solar.",
        iconImage:githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria cuidado corporal locion vegetal.webp"),
        theme:"personal"
      },
      {
        label:"Maquillaje",
        section:"Belleza y cuidado",
        subtitle:"Productos de maquillaje.",
        iconImage:githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria maquillaje brocha labial rosa.webp"),
        theme:"maquillaje"
      },
      {
        label:"Kits y combos",
        section:"Belleza y cuidado",
        subtitle:"Combinaciones de distintas familias de productos.",
        iconImage:githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria kits combos regalo cosmeticos.webp"),
        theme:"kits",
        directProducts:true
      },
      {
        label:"Regalos",
        section:"Regalos para toda ocasión",
        subtitle:"Detalles y arreglos listos para regalar en cualquier ocasión.",
        iconImage:ROOT_ICON_IMAGES.regalos,
        theme:"regalos",
        directProducts:true
      },
      {
        label:"Otros productos",
        section:"Otros productos",
        subtitle:"Electrodomésticos, juguetes, papelería, medicamentos y más.",
        iconImage:ROOT_ICON_IMAGES.otros,
        theme:"otros"
      }
    ];

    const SUBCATEGORY_ICON_IMAGES = {
      "perfumes": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria perfumes fragancia floral rosa.webp"),
      "desodorantes": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria desodorantes roll on vegetal.webp"),
      "maquillaje": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria maquillaje brocha labial rosa.webp"),
      "cuidado facial": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria cuidado facial crema rosa.webp"),
      "cuidado corporal": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria cuidado corporal locion vegetal.webp"),
      "cabello": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria cabello mechon brillante capilar.webp"),
      "manos y pies": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria manos pies cuidado suave.webp"),
      "higiene corporal": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria higiene corporal jabon turquesa.webp"),
      "higiene intima": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria higiene intima flor rosa.webp"),
      "proteccion solar": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria proteccion solar crema amarilla.webp"),
      "kits y combos": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria kits combos regalo cosmeticos.webp"),
      "tecnologia y hogar": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria tecnologia hogar asistente inteligente.webp"),
      "juguetes": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria juguetes oso bloques infantiles.webp"),
      "papeleria": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria papeleria cuaderno lapiz corazon.webp"),
      "medicamentos": githubPagesAssetUrl("iconos/2026-09-06_icono subcategoria medicamentos frasco capsulas medicas.webp")
    };

    const CATEGORY_VISUALS = {
      "perfumes": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "desodorantes": { iconImage:SUBCATEGORY_ICON_IMAGES["desodorantes"] },
      "maquillaje": { iconImage:SUBCATEGORY_ICON_IMAGES["maquillaje"] },
      "cuidado facial": { iconImage:SUBCATEGORY_ICON_IMAGES["cuidado facial"] },
      "cuidado corporal": { iconImage:SUBCATEGORY_ICON_IMAGES["cuidado corporal"] },
      "cabello": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "manos y pies": { iconImage:SUBCATEGORY_ICON_IMAGES["manos y pies"] },
      "higiene corporal": { iconImage:SUBCATEGORY_ICON_IMAGES["higiene corporal"] },
      "higiene intima": { iconImage:SUBCATEGORY_ICON_IMAGES["higiene intima"] },
      "proteccion solar": { iconImage:SUBCATEGORY_ICON_IMAGES["proteccion solar"] },
      "kits y combos": { iconImage:SUBCATEGORY_ICON_IMAGES["kits y combos"] },
      "tecnologia y hogar": { iconImage:SUBCATEGORY_ICON_IMAGES["tecnologia y hogar"] },
      "juguetes": { iconImage:SUBCATEGORY_ICON_IMAGES["juguetes"] },
      "papeleria": { iconImage:SUBCATEGORY_ICON_IMAGES["papeleria"] },
      "medicamentos": { iconImage:SUBCATEGORY_ICON_IMAGES["medicamentos"] },
      "perfumeria femenina": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "perfumeria masculina": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "fragancias femeninas": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "fragancias masculinas": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "fragancias unisex": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "frescas, citricas y acuaticas": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "florales y frutales": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "dulces y orientales": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "amaderadas, chipre y especiadas": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "aromaticas y herbales": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "amaderadas y especiadas": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "intensas y ambaradas": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "frescas, citricas y verdes": { iconImage:SUBCATEGORY_ICON_IMAGES["perfumes"] },
      "cuidado capilar": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "reparacion y nutricion": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "peinado y proteccion": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "rizos y definicion": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "anticaida y crecimiento": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "hidratacion": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "color, matizacion y liso": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "limpieza y anticaspa": { iconImage:SUBCATEGORY_ICON_IMAGES["cabello"] },
      "hidratacion y tratamiento corporal": { iconImage:SUBCATEGORY_ICON_IMAGES["cuidado corporal"] },
      "cuidado de manos y pies": { iconImage:SUBCATEGORY_ICON_IMAGES["manos y pies"] },
      "higiene y exfoliacion corporal": { iconImage:SUBCATEGORY_ICON_IMAGES["higiene corporal"] },
      "electrodomesticos de segunda mano a la venta": { iconImage:SUBCATEGORY_ICON_IMAGES["tecnologia y hogar"] },
      "electrodomesticos de segunda mano no a la venta": { iconImage:SUBCATEGORY_ICON_IMAGES["tecnologia y hogar"] },
      "juguetes de segunda mano": { iconImage:SUBCATEGORY_ICON_IMAGES["juguetes"] },
      "papeleria de segunda mano": { iconImage:SUBCATEGORY_ICON_IMAGES["papeleria"] },
      "regalos": { icon:"🎁" }
    };

    let albums = [];
    let albumByKey = new Map();
    let selectedAudience = "";
    let selectedCategory = "";
    let selectedFamily = "";
    let selectedAlbumKey = "";
    let hiddenAlbumNameSet = new Set(getHiddenAlbumNames());
    let searchExcludedAlbumNameSet = new Set(getSearchExcludedAlbumNames());
    let allowedProductRouteKeySet = new Set();

    function cleanNavKey(value){
      return normalizeText(value).replace(/\s+/g, " ");
    }

    function getProductRouteKey(p){
      if(!p) return "";
      return routeKeyFromParts(p.section, p.category, p.subcategory, p.fragranceFamily, p.commercialState);
    }

    function isProductRouteAuthorized(p){
      if(!p) return false;
      if(p.isGiftGalleryImage === true) return true;
      if(allowedProductRouteKeySet.size === 0) return true;
      const key = getProductRouteKey(p);
      return Boolean(key && allowedProductRouteKeySet.has(key));
    }

    function isProductHiddenByRoute(p){
      const key = getProductRouteKey(p);
      return Boolean(key && hiddenAlbumNameSet.has(key));
    }

    function isProductExcludedFromSearchByRoute(p){
      const key = getProductRouteKey(p);
      return Boolean(key && searchExcludedAlbumNameSet.has(key));
    }

    function mainNavigationGroupForProduct(p){
      if(!p) return "";
      if(p.section === "Regalos para toda ocasión") return "Regalos";
      return String(p.category || "").trim();
    }

    function productMatchesAudience(p, audienceLabel){
      return cleanNavKey(mainNavigationGroupForProduct(p)) === cleanNavKey(audienceLabel);
    }

    function navigationCategoryForProduct(p){
      if(!p) return "General";
      return String(p.subcategory || p.category || "General").trim() || "General";
    }

    function navigationFamilyForProduct(p){
      if(!p) return "";
      return String(p.fragranceFamily || "").trim();
    }

    function isDirectProductAudience(audienceLabel){
      const group = NAV_AUDIENCES.find(item => cleanNavKey(item.label) === cleanNavKey(audienceLabel));
      return !!(group && group.directProducts === true);
    }

    function isDirectProductSection(sectionLabel){
      return NAV_AUDIENCES.some(item => item.directProducts === true && cleanNavKey(item.section) === cleanNavKey(sectionLabel));
    }

    function collectAlbumPreview(found, p){
      if(!found.cover) found.cover = p;
      const previewImage = String((p && p.docsImageUrl) || (p && p.imgFilename) || "").trim();
      if(p && (p.hasImage || p.docsImageUrl) && previewImage && !found.previewImages.includes(previewImage)){
        if(p.isDocumentFirst) found.previewImages.unshift(previewImage);
        else found.previewImages.push(previewImage);
      }
    }

    function buildRootAlbums(list){
      const out = [];
      for(const group of NAV_AUDIENCES){
        const products = (Array.isArray(list) ? list : []).filter(p => productMatchesAudience(p, group.label));
        const album = {
          key:`audience::${cleanNavKey(group.label)}`,
          navType:"audience",
          navValue:group.label,
          label:group.label,
          subtitle:group.subtitle,
          icon:group.icon || "",
          iconSvg:group.iconSvg || "",
          iconImage:group.iconImage || "",
          theme:group.theme || "",
          products,
          cover:null,
          previewImages:[],
          searchKey:normalizeText(`${group.label} ${group.subtitle}`),
          hasStructuredProducts:true,
          hasUnstructuredProducts:false,
          onlyUnstructured:false,
          count:products.length,
          colorIndex:out.length % ALBUM_COLORS.length
        };
        for(const p of products) collectAlbumPreview(album,p);
        out.push(album);
      }
      return out;
    }

    function buildCategoryAlbums(list, audienceLabel){
      const byCategory = new Map();
      for(const p of (Array.isArray(list) ? list : [])){
        if(!productMatchesAudience(p, audienceLabel)) continue;
        const category = navigationCategoryForProduct(p);
        const key = cleanNavKey(category);
        const visual = CATEGORY_VISUALS[cleanNavKey(category)] || { icon:"•" };
        const found = byCategory.get(key) || {
          key:`category::${cleanNavKey(audienceLabel)}::${key}`,
          navType:"category",
          navValue:category,
          audience:audienceLabel,
          label:categoryDisplayLabel(category),
          subtitle:"",
          icon:visual.icon || "•",
          iconImage:visual.iconImage || "",
          products:[],
          cover:null,
          previewImages:[],
          searchKey:normalizeText(`${category} ${audienceLabel}`),
          hasStructuredProducts:true,
          hasUnstructuredProducts:false
        };
        found.products.push(p);
        collectAlbumPreview(found,p);
        byCategory.set(key,found);
      }
      return Array.from(byCategory.values())
        .sort((a,b)=>a.label.localeCompare(b.label,"es",{sensitivity:"base"}))
        .map((album,index)=>({
          ...album,
          count:album.products.length,
          onlyUnstructured:false,
          colorIndex:index % ALBUM_COLORS.length
        }));
    }

    function buildFamilyAlbums(list, audienceLabel, categoryLabel){
      const byFamily = new Map();
      for(const p of (Array.isArray(list) ? list : [])){
        if(!productMatchesAudience(p, audienceLabel)) continue;
        if(cleanNavKey(navigationCategoryForProduct(p)) !== cleanNavKey(categoryLabel)) continue;
        const family = navigationFamilyForProduct(p);
        if(!family) continue;
        const key = cleanNavKey(family);
        const visual = CATEGORY_VISUALS[key] || { icon:"•" };
        const found = byFamily.get(key) || {
          key:`family::${cleanNavKey(audienceLabel)}::${cleanNavKey(categoryLabel)}::${key}`,
          navType:"family",
          navValue:family,
          audience:audienceLabel,
          category:categoryLabel,
          label:categoryDisplayLabel(family),
          subtitle:"",
          icon:visual.icon || "•",
          iconImage:visual.iconImage || "",
          products:[],
          cover:null,
          previewImages:[],
          searchKey:normalizeText(`${family} ${categoryLabel} ${audienceLabel}`),
          hasStructuredProducts:true,
          hasUnstructuredProducts:false
        };
        found.products.push(p);
        collectAlbumPreview(found,p);
        byFamily.set(key,found);
      }
      return Array.from(byFamily.values())
        .sort((a,b)=>a.label.localeCompare(b.label,"es",{sensitivity:"base"}))
        .map((album,index)=>({
          ...album,
          count:album.products.length,
          onlyUnstructured:false,
          colorIndex:index % ALBUM_COLORS.length
        }));
    }

    function buildAlbums(list){
      if(selectedAudience && selectedCategory) return buildFamilyAlbums(list, selectedAudience, selectedCategory);
      return selectedAudience ? buildCategoryAlbums(list, selectedAudience) : buildRootAlbums(list);
    }

    function refreshNavigationAlbums(){
      if(selectedFamily){
        albums = [];
        albumByKey = new Map();
        selectedAlbumKey = `family::${cleanNavKey(selectedAudience)}::${cleanNavKey(selectedCategory)}::${cleanNavKey(selectedFamily)}`;
        return;
      }
      albums = buildAlbums(all);
      albumByKey = new Map(albums.map(album => [album.key, album]));
      if(selectedCategory){
        selectedAlbumKey = `category::${cleanNavKey(selectedAudience)}::${cleanNavKey(selectedCategory)}`;
      }else{
        selectedAlbumKey = selectedAudience ? `audience::${cleanNavKey(selectedAudience)}` : "";
      }
    }

    function getProductAlbumKey(p){
      return cleanNavKey(navigationCategoryForProduct(p) || "General") || ROOT_ALBUM_KEY;
    }

    function albumLabelFromKey(key){
      const found = albumByKey.get(String(key || ""));
      if(found) return found.label;
      if(key === ROOT_ALBUM_KEY) return "General";
      return categoryDisplayLabel(key);
    }

    function filterVisibleProducts(list){
      const source = Array.isArray(list) ? list : [];
      return source.filter(p => isProductRouteAuthorized(p) && !isProductHiddenByRoute(p));
    }

    function filterSearchExcludedProducts(list){
      const source = Array.isArray(list) ? list : [];
      if(!shouldApplySearchAlbumExclusions()) return source.slice();
      return source.filter(p => !isProductExcludedFromSearchByRoute(p));
    }

    function hasAlbumFolders(){
      return all.length > 0;
    }

    function albumModeEnabled(){
      return hasAlbumFolders();
    }

    function shouldShowAlbumGrid(){
      // La configuración remota puede hacer que, al escribir en el buscador,
      // se muestren de inmediato las tarjetas de producto coincidentes.
      // Con el control desactivado se conserva la navegación por categorías
      // y sus contadores de coincidencias.
      const searchActive = getCombinedWordTerms().length > 0;
      const showDirectMatches = !!(
        searchActive &&
        window.INTERRUPTORES &&
        window.INTERRUPTORES.MOSTRAR_PRODUCTOS_COINCIDENTES_AL_ESCRIBIR === true
      );
      return albumModeEnabled() && albums.length > 0 && !selectedFamily && !isDirectProductAudience(selectedAudience) && !showDirectMatches;
    }

    function getSelectedAlbum(){
      if(selectedFamily){
        return { label:selectedFamily, navType:"family", audience:selectedAudience, category:selectedCategory };
      }
      if(selectedCategory){
        return { label:selectedCategory, navType:"category", audience:selectedAudience };
      }
      if(selectedAudience){
        return { label:selectedAudience, navType:"audience" };
      }
      return null;
    }

    function currentProductSourceList(){
      let source = all.slice();
      if(selectedAudience){
        source = source.filter(p => productMatchesAudience(p, selectedAudience));
      }
      if(selectedCategory){
        source = source.filter(p => cleanNavKey(navigationCategoryForProduct(p)) === cleanNavKey(selectedCategory));
      }
      if(selectedFamily){
        source = source.filter(p => cleanNavKey(navigationFamilyForProduct(p)) === cleanNavKey(selectedFamily));
      }
      return source;
    }

    function refreshFilterOptionsForScope(){
      if(catSel){
        catSel.value = "";
        clearSelectButKeepFirst(catSel);
        catSel.hidden = true;
        catSel.disabled = true;
      }
      if(brandSel){
        brandSel.value = "";
        clearSelectButKeepFirst(brandSel);
        brandSel.hidden = true;
        brandSel.disabled = true;
      }
    }

    const cart = (() => {
      try{
        const rawCart = localStorage.getItem("cart");
        const parsed = JSON.parse(rawCart || "{}");
        return (parsed && typeof parsed === "object") ? parsed : {};
      }catch(_){
        localStorage.removeItem("cart");
        return {};
      }
    })();

    const cartCountEl = document.getElementById("cartCount");

    function cartItemsArray(){
      return Object.values(cart)
        .filter(it => it && it.qty > 0 && it.id && productById.has(String(it.id)));
    }
    function cartTotalValue(){
      return cartItemsArray().reduce((s,it)=> s + ((Number(it.price)||0) * (Number(it.qty)||0)), 0);
    }
    function cartHasUnpricedItems(){
      return cartItemsArray().some(it => it && it.hasPrice === false);
    }
    function cartTotalQty(){
      return cartItemsArray().reduce((s,it)=> s + (Number(it.qty)||0), 0);
    }
    function refreshCartCount(){
      if(!cartCountEl) return;
      const qty = cartTotalQty();
      cartCountEl.textContent = String(qty);
      cartCountEl.classList.toggle("has-items", qty > 0);
    }
    function saveCart(){
      try{
        localStorage.setItem("cart", JSON.stringify(cart));
      }catch(_){}
      refreshCartCount();
    }

    function detectarMarcaDispositivo(modelo, ua){
      const texto = `${String(modelo || "")} ${String(ua || "")}`.toLowerCase();
      if(/iphone|ipad|ipod/.test(texto)) return "Apple";
      if(/\bsm-|\bgt-|\bsgh-|\bsch-|samsung/.test(texto)) return "Samsung";
      if(/pixel/.test(texto)) return "Google";
      if(/redmi|poco|xiaomi|\bmi\s/.test(texto)) return "Xiaomi";
      if(/\bcph\d+/i.test(modelo || "") || /oppo/.test(texto)) return "OPPO";
      if(/\brmx\d+/i.test(modelo || "") || /realme/.test(texto)) return "realme";
      if(/oneplus/.test(texto)) return "OnePlus";
      if(/\bv\d{4,}[a-z]?\b/i.test(modelo || "") || /vivo/.test(texto)) return "vivo";
      if(/\bxt\d+/i.test(modelo || "") || /moto\s|motorola/.test(texto)) return "Motorola";
      if(/huawei/.test(texto)) return "Huawei";
      if(/honor/.test(texto)) return "HONOR";
      if(/tecno/.test(texto)) return "TECNO";
      if(/infinix/.test(texto)) return "Infinix";
      if(/nokia|\bhmd\b/.test(texto)) return "Nokia";
      if(/zte/.test(texto)) return "ZTE";
      return "";
    }

    async function obtenerDetalleDispositivoVisita(){
      const ua = String(navigator.userAgent || "");
      const tipo = /iPad|Tablet/i.test(ua)
        ? "Tablet"
        : (/Mobi|Android|iPhone/i.test(ua) ? "Móvil" : "Computador");

      let sistema = "";
      if(/Android/i.test(ua)) sistema = "Android";
      else if(/iPhone|iPad|iPod/i.test(ua)) sistema = "iOS";
      else if(/Windows/i.test(ua)) sistema = "Windows";
      else if(/Mac OS X|Macintosh/i.test(ua)) sistema = "macOS";
      else if(/Linux/i.test(ua)) sistema = "Linux";

      let navegador = "";
      if(/Edg\//i.test(ua)) navegador = "Edge";
      else if(/Firefox\//i.test(ua)) navegador = "Firefox";
      else if(/CriOS\//i.test(ua)) navegador = "Chrome";
      else if(/Chrome\//i.test(ua)) navegador = "Chrome";
      else if(/Safari\//i.test(ua)) navegador = "Safari";

      let modelo = "";
      try{
        if(navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === "function"){
          const datos = await navigator.userAgentData.getHighEntropyValues(["model"]);
          modelo = String(datos && datos.model || "").trim();
        }
      }catch(_){}

      if(!modelo && /Android/i.test(ua)){
        const match = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|;|\))/i);
        if(match) modelo = String(match[1] || "").trim();
      }

      if(!modelo && /iPhone/i.test(ua)) modelo = "iPhone";
      if(!modelo && /iPad/i.test(ua)) modelo = "iPad";

      modelo = modelo
        .replace(/^wv$/i, "")
        .replace(/\s+Build\/.*/i, "")
        .trim();

      const marca = detectarMarcaDispositivo(modelo, ua);

      return {
        marca,
        modelo,
        resumen: [tipo, sistema, navegador].filter(Boolean).join(" · ")
      };
    }

    function resumenOrigenVisita(){
      const limpiar = value => String(value || "").trim();
      const normalizar = value => limpiar(value).toLowerCase().replace(/[_.-]+/g, " ").replace(/\s+/g, " ");

      const nombreFuente = value => {
        const key = normalizar(value);
        if(!key) return "";

        const aliases = [
          [/^(whatsapp|wa|wsp|whats app)$/, "WhatsApp"],
          [/^(facebook|fb)$/, "Facebook"],
          [/^(facebook marketplace|marketplace|fb marketplace)$/, "Facebook Marketplace"],
          [/^(instagram|ig)$/, "Instagram"],
          [/^(messenger|facebook messenger|fb messenger)$/, "Messenger"],
          [/^(tiktok|tik tok)$/, "TikTok"],
          [/^(telegram|tg)$/, "Telegram"],
          [/^(google|google search|busqueda google|búsqueda google)$/, "Google"],
          [/^(google ads|googleads|adwords)$/, "Google Ads"],
          [/^(youtube|you tube)$/, "YouTube"],
          [/^(bing|microsoft bing)$/, "Bing"],
          [/^(microsoft ads|bing ads)$/, "Microsoft Ads"],
          [/^(duckduckgo|duck duck go)$/, "DuckDuckGo"],
          [/^(yahoo)$/, "Yahoo"],
          [/^(linkedin|linked in)$/, "LinkedIn"],
          [/^(x|twitter)$/, "X"],
          [/^(threads|threads net)$/, "Threads"],
          [/^(pinterest)$/, "Pinterest"],
          [/^(reddit)$/, "Reddit"],
          [/^(snapchat|snap)$/, "Snapchat"],
          [/^(discord)$/, "Discord"],
          [/^(signal)$/, "Signal"],
          [/^(teams|microsoft teams)$/, "Microsoft Teams"],
          [/^(gmail|google mail)$/, "Gmail"],
          [/^(outlook|hotmail|live mail)$/, "Outlook"],
          [/^(email|correo|correo electronico|correo electrónico|mail)$/, "Correo electrónico"],
          [/^(sms|mensaje de texto)$/, "SMS"],
          [/^(qr|codigo qr|código qr)$/, "Código QR"],
          [/^(direct|directo)$/, "Directo / no detectable"]
        ];

        for(const [pattern, label] of aliases){
          if(pattern.test(key)) return label;
        }

        return limpiar(value);
      };

      const origenUtm = (source, medium) => {
        const fuente = nombreFuente(source);
        const medio = normalizar(medium);
        if(!fuente) return "";

        const esPago = /(cpc|ppc|paid|paid social|paid_social|display|ads?|advertising)/i.test(medio);
        if(esPago){
          if(fuente === "Google") return "Google Ads";
          if(fuente === "Bing") return "Microsoft Ads";
          if(fuente === "Facebook") return "Facebook Ads";
          if(fuente === "Instagram") return "Instagram Ads";
          if(fuente === "TikTok") return "TikTok Ads";
          if(fuente === "LinkedIn") return "LinkedIn Ads";
          if(fuente === "X") return "X Ads";
          return `${fuente} · publicidad`;
        }

        if(/(organic|seo)/i.test(medio)){
          if(["Google", "Bing", "DuckDuckGo", "Yahoo"].includes(fuente)) return `${fuente} · búsqueda orgánica`;
        }

        if(/(email|mail|newsletter)/i.test(medio)) return fuente === "Correo electrónico" ? fuente : `${fuente} · correo`;
        if(/(social|social media|social_media)/i.test(medio)) return fuente;
        if(/(referral|referido)/i.test(medio)) return `${fuente} · referido`;

        return fuente;
      };

      const origenClickId = params => {
        if(params.has("gclid") || params.has("dclid") || params.has("gbraid") || params.has("wbraid") || params.has("gad_source")) return "Google Ads";
        if(params.has("msclkid")) return "Microsoft Ads";
        if(params.has("ttclid")) return "TikTok Ads";
        if(params.has("li_fat_id")) return "LinkedIn Ads";
        if(params.has("twclid")) return "X Ads";
        if(params.has("fbclid")) return "Meta · Facebook/Instagram";
        if(params.has("igshid")) return "Instagram";
        if(params.has("sccid")) return "Snapchat Ads";
        if(params.has("mc_cid") || params.has("mc_eid")) return "Correo electrónico · Mailchimp";
        return "";
      };

      const origenReferrer = ref => {
        if(!ref) return "";
        let host = "";
        try{ host = new URL(ref).hostname.toLowerCase().replace(/^www\./, ""); }catch(_){ return ""; }
        if(!host || host === window.location.hostname.toLowerCase()) return "";

        const reglas = [
          [/(^|\.)web\.whatsapp\.com$/, "WhatsApp"],
          [/(^|\.)(facebook\.com|fb\.com|l\.facebook\.com|lm\.facebook\.com)$/, "Facebook"],
          [/(^|\.)instagram\.com$/, "Instagram"],
          [/(^|\.)messenger\.com$/, "Messenger"],
          [/(^|\.)tiktok\.com$/, "TikTok"],
          [/(^|\.)(t\.me|telegram\.me|web\.telegram\.org)$/, "Telegram"],
          [/(^|\.)mail\.google\.com$/, "Gmail"],
          [/(^|\.)(outlook\.live\.com|outlook\.office\.com)$/, "Outlook"],
          [/(^|\.)(google\.[a-z.]+|googleusercontent\.com)$/, "Google · búsqueda orgánica"],
          [/(^|\.)bing\.com$/, "Bing · búsqueda orgánica"],
          [/(^|\.)duckduckgo\.com$/, "DuckDuckGo · búsqueda orgánica"],
          [/(^|\.)search\.yahoo\.com$/, "Yahoo · búsqueda orgánica"],
          [/(^|\.)(youtube\.com|youtu\.be)$/, "YouTube"],
          [/(^|\.)linkedin\.com$/, "LinkedIn"],
          [/(^|\.)(x\.com|twitter\.com|t\.co)$/, "X"],
          [/(^|\.)threads\.net$/, "Threads"],
          [/(^|\.)pinterest\.[a-z.]+$/, "Pinterest"],
          [/(^|\.)reddit\.com$/, "Reddit"],
          [/(^|\.)snapchat\.com$/, "Snapchat"],
          [/(^|\.)discord\.com$/, "Discord"],
          [/(^|\.)teams\.microsoft\.com$/, "Microsoft Teams"]
        ];

        for(const [pattern, label] of reglas){
          if(pattern.test(host)) return label;
        }
        return `Sitio web externo · ${host}`;
      };

      try{
        const actual = new URL(window.location.href);
        const params = actual.searchParams;

        for(const key of ["origen", "fuente", "source"]){
          const explicit = limpiar(params.get(key));
          if(explicit) return nombreFuente(explicit);
        }

        const utmSource = limpiar(params.get("utm_source"));
        const utmMedium = limpiar(params.get("utm_medium"));
        if(utmSource) return origenUtm(utmSource, utmMedium);

        const porClickId = origenClickId(params);
        if(porClickId) return porClickId;

        const porReferrer = origenReferrer(limpiar(document.referrer));
        if(porReferrer) return porReferrer;

        return "Directo / no detectable";
      }catch(_){
        return "Directo / no detectable";
      }
    }

    const ATTRIBUTION_FIRST_KEY = "irenismb_attribution_first";
    const ATTRIBUTION_LAST_KEY = "irenismb_attribution_last";
    const ATTRIBUTION_CONVERSION_KEY = "irenismb_attribution_conversion";

    function leerAtribucionGuardada(storage, key){
      try{
        const raw = storage.getItem(key);
        const value = raw ? JSON.parse(raw) : null;
        return value && typeof value === "object" ? value : null;
      }catch(_){
        return null;
      }
    }

    function guardarAtribucion(storage, key, value){
      try{ storage.setItem(key, JSON.stringify(value)); }catch(_){}
    }

    function obtenerCampanaVisita(){
      try{
        const params = new URL(window.location.href).searchParams;
        return String(
          params.get("utm_campaign")
          || params.get("campana")
          || params.get("campaña")
          || params.get("campaign")
          || ""
        ).trim();
      }catch(_){
        return "";
      }
    }

    function obtenerMedioVisita(){
      try{
        const params = new URL(window.location.href).searchParams;
        return String(params.get("utm_medium") || params.get("medio") || params.get("medium") || "").trim();
      }catch(_){
        return "";
      }
    }

    function certezaOrigenVisita(){
      try{
        const params = new URL(window.location.href).searchParams;
        if(["origen","fuente","source"].some(key => String(params.get(key) || "").trim())) return "Confirmado por enlace";
        if(String(params.get("utm_source") || "").trim()) return "Confirmado por UTM";
        if(["gclid","dclid","gbraid","wbraid","gad_source","msclkid","ttclid","li_fat_id","twclid","fbclid","igshid","sccid","mc_cid","mc_eid"].some(key => params.has(key))){
          return "Confirmado por identificador publicitario";
        }
        if(String(document.referrer || "").trim()) return "Detectado por referente";
      }catch(_){}
      return "No detectable";
    }

    function contextoAtribucionVisita(){
      const actual = {
        origen: String(resumenOrigenVisita() || "Directo / no detectable"),
        medio: obtenerMedioVisita(),
        campana: obtenerCampanaVisita(),
        certeza: certezaOrigenVisita(),
        ts: Date.now()
      };

      let primero = leerAtribucionGuardada(localStorage, ATTRIBUTION_FIRST_KEY);
      if(!primero){
        primero = actual;
        guardarAtribucion(localStorage, ATTRIBUTION_FIRST_KEY, primero);
      }
      guardarAtribucion(localStorage, ATTRIBUTION_LAST_KEY, actual);

      const conversion = leerAtribucionGuardada(sessionStorage, ATTRIBUTION_CONVERSION_KEY) || null;

      return { actual, primero, ultimo:actual, conversion };
    }

    function registrarConversionCatalogo(tipo, detalle){
      const nombre = String(tipo || "").trim();
      if(!nombre) return;

      const prioridades = {
        "Añadió al carrito": 10,
        "Abrió WhatsApp": 20,
        "Inició pedido por WhatsApp": 30,
        "Pedido registrado": 40
      };
      const existente = leerAtribucionGuardada(sessionStorage, ATTRIBUTION_CONVERSION_KEY);
      if((prioridades[nombre] || 1) < (prioridades[String(existente?.tipo || "")] || 0)) return;

      const evento = {
        tipo: nombre,
        detalle: String(detalle || "").trim(),
        origen: String(resumenOrigenVisita() || ""),
        campana: obtenerCampanaVisita(),
        ts: Date.now()
      };
      guardarAtribucion(sessionStorage, ATTRIBUTION_CONVERSION_KEY, evento);

      try{
        window.dispatchEvent(new CustomEvent("catalogo:conversion", { detail:evento }));
      }catch(_){}
    }
    window.registrarConversionCatalogo = registrarConversionCatalogo;

    try{ contextoAtribucionVisita(); }catch(_){}

    window.obtenerContextoVisitaCatalogo = async function(){
      const detalle = await obtenerDetalleDispositivoVisita();
      const atribucion = contextoAtribucionVisita();
      const conversion = atribucion.conversion || {};
      try{
        const album = getSelectedAlbum();
        const items = cartItemsArray();
        const primerProducto = items[0]?.name || "";
        return {
          dispositivo: detalle.resumen,
          marca: detalle.marca,
          modelo: detalle.modelo,
          origen: String(atribucion.actual.origen || ""),
          primer_origen: String(atribucion.primero?.origen || ""),
          ultimo_origen: String(atribucion.ultimo?.origen || ""),
          medio: String(atribucion.actual.medio || ""),
          campana: String(atribucion.actual.campana || ""),
          certeza_origen: String(atribucion.actual.certeza || ""),
          conversion: String(conversion.tipo || ""),
          conversion_detalle: String(conversion.detalle || ""),
          categoria: String(album?.label || ""),
          producto: String(primerProducto || ""),
          carrito_productos: String(items.length),
          carrito_unidades: String(cartTotalQty()),
          carrito_total: String(Math.round(cartTotalValue()))
        };
      }catch(_){
        return {
          dispositivo: detalle.resumen,
          marca: detalle.marca,
          modelo: detalle.modelo,
          origen: String(atribucion.actual.origen || ""),
          primer_origen: String(atribucion.primero?.origen || ""),
          ultimo_origen: String(atribucion.ultimo?.origen || ""),
          medio: String(atribucion.actual.medio || ""),
          campana: String(atribucion.actual.campana || ""),
          certeza_origen: String(atribucion.actual.certeza || ""),
          conversion: String(conversion.tipo || ""),
          conversion_detalle: String(conversion.detalle || ""),
          categoria: "",
          producto: "",
          carrito_productos: "0",
          carrito_unidades: "0",
          carrito_total: "0"
        };
      }
    };

    function sanitizeCartWithStock(){
      const enforce = shouldEnforceStockLimits();
      let changed = false;

      for(const key of Object.keys(cart)){
        const it = cart[key];
        if(!it || !it.id){
          delete cart[key];
          changed = true;
          continue;
        }
        const id = String(it.id);
        const p = productById.get(id);
        if(!p){
          delete cart[key];
          changed = true;
          continue;
        }

        const hasKnownStock = Number.isFinite(p.stock) && p.stock >= 0;
        const maxStock = hasKnownStock ? p.stock : null;
        const qty = Math.max(0, safeInt(it.qty, 0));

        const newQty = enforce
          ? (hasKnownStock ? Math.min(qty, maxStock) : 0)
          : qty;

        const newObj = {
          id: p.id,
          name: p.name,
          price: p.price,
          hasPrice: p.hasPrice !== false,
          qty: newQty,
          stock: p.stock,
          imgFilename: p.imgFilename || null
        };

        cart[id] = newObj;
        if(id !== key) delete cart[key];

        if(newQty !== qty) changed = true;
      }

      if(changed) saveCart(); else refreshCartCount();
    }

    const shippingCopInp = document.getElementById("shippingCop");
    function getShippingCop(){
      const raw = (shippingCopInp ? shippingCopInp.value : readStringLS(LS_SHIPPING_KEY, "")) || "";
      return toNumberDigits(raw);
    }
    function loadShippingFromLS(){
      if(!shippingCopInp) return;

      const MIN_SHIPPING = 6000;

      const raw = readStringLS(LS_SHIPPING_KEY, "");
      const v = toNumberDigits(raw);

      // Si no hay valor guardado, usar 6.000 por defecto (editable).
      shippingCopInp.value = (v ? String(v) : String(MIN_SHIPPING));
    }
    function saveShippingToLS(){
      if(!shippingCopInp) return;
      const v = toNumberDigits(shippingCopInp.value);
      writeStringLS(LS_SHIPPING_KEY, v ? String(v) : "");
    }

    const STORE_INFO = {
      name: "IRENISMB STOCK NATURA",
      whatsappDisplay: "+57 304 208 8961",
      whatsappDigits: "573042088961",
      direccion: "Calle 10A #20A-06, Santa Marta, Magdalena",
      barrio: "Los Almendros",
      mapa: "https://maps.google.com/?q=11.244833370782679,-74.19066001689564",
      catalogo: "https://irenismb.github.io/stock/natura/catalogo.html",
      referencias: "Entre la tienda Surtifruver y la tienda 5Y6, por la panadería Madepan."
    };

    const ORDER_LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycby85yLxa9PK8-cbwTk-FVlS3zKE0HqFs3rQf6D7pZPNzylaxDGPagOhfG0rZy_A0cxP/exec";
	
    const ORDER_LOG_TIMEOUT_MS = 6500;

    function buildLineItems(){
      const items = cartItemsArray();
      const includeCode = shouldSendProductCodesByWhatsApp();
      const showPrices = shouldShowProductPrices();
      return items.map(it => {
        const codePart = includeCode ? ` (Id: ${it.id})` : "";
        if(!showPrices || it.hasPrice === false){
          return `* ${it.name}${codePart} x${it.qty} = Precio por confirmar`;
        }
        return `* ${it.name}${codePart} x${it.qty} = ${fmtCOP.format((Number(it.price)||0) * (Number(it.qty)||0))}`;
      });
    }

    function oneLineText(s){
      return String(s ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\n+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function viaTypeLabel(tipo){
      const t = String(tipo || "").trim();
      const map = { Cl:"Calle", Cra:"Carrera", Av:"Avenida", Dg:"Diagonal", Tv:"Transversal" };
      return map[t] || t;
    }

    function buildViaString(tipo, num, placa){
      const t = viaTypeLabel(tipo);
      const n = String(num || "").trim();
      const p = String(placa || "").trim();
      if(t && n && p) return `${t} ${n} #${p}`;
      return joinParts([t, n, p ? `#${p}` : ""], " ");
    }

    function getClientDataCurrent(){
      const nameInp = document.getElementById("clientName");
      const phoneInp = document.getElementById("clientPhone");
      const obsInp = document.getElementById("clientObs");

      const obj = readJsonLS(LS_CLIENT_KEY, {});
      const name = String((nameInp && nameInp.value) ?? (obj.clientName ?? "")).trim();
      const phone = String((phoneInp && phoneInp.value) ?? (obj.clientPhone ?? "")).trim();
      const obs = String((obsInp && obsInp.value) ?? (obj.clientObs ?? ""));

      return { name, phone, obs };
    }

    function getAddressDataCurrent(){
      const obj = readJsonLS(LS_ADDRESS_KEY, {});

      const cityInp = document.getElementById("addrCity");
      const regionInp = document.getElementById("addrRegion");
      const tipoInp = document.getElementById("addrViaTipo");
      const numInp = document.getElementById("addrViaNum");
      const placaInp = document.getElementById("addrPlaca");
      const barrioInp = document.getElementById("addrBarrio");

      const city = String((cityInp && cityInp.value) ?? (obj.addrCity ?? "")).trim();
      const region = String((regionInp && regionInp.value) ?? (obj.addrRegion ?? "")).trim();
      const tipo = String((tipoInp && tipoInp.value) ?? (obj.addrViaTipo ?? "")).trim();
      const num = String((numInp && numInp.value) ?? (obj.addrViaNum ?? "")).trim();
      const placa = String((placaInp && placaInp.value) ?? (obj.addrPlaca ?? "")).trim();
      const barrio = String((barrioInp && barrioInp.value) ?? (obj.addrBarrio ?? "")).trim();

      const via = buildViaString(tipo, num, placa);
      const addressLine = joinParts([via, city, region], ", ");

      // IMPORTANTE: barrio NO se incluye en el enlace de Google Maps
      const mapLink = addressLine
        ? ("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(addressLine))
        : "";

      return { addressLine, barrio, mapLink };
    }
	function buildBuyerMessage(){
	  const items = cartItemsArray();
	  const client = getClientDataCurrent();
	  const addr = getAddressDataCurrent();

	  const subtotal = cartTotalValue();
	  const envio = getShippingCop();
	  const total = subtotal + envio;
	  const showPrices = shouldShowProductPrices();
	  const hasUnpricedItems = !showPrices || cartHasUnpricedItems();

	  const lines = [];

	  lines.push("*INFORMACIÓN DEL CLIENTE*");
	  lines.push(`*Nombre:* ${client.name || ""}`.trimEnd());
	  lines.push(`*Celular:* ${client.phone || ""}`.trimEnd());
	  lines.push(`*Dirección:* ${addr.addressLine || ""}`.trimEnd());
	  lines.push(`*Barrio:* ${addr.barrio || ""}`.trimEnd());
	  lines.push(`*Ubicación:* ${addr.mapLink || ""}`.trimEnd());
	  lines.push(`*Observación:* ${oneLineText(client.obs || "")}`.trimEnd());

	  lines.push("");
	  lines.push("*PRODUCTOS SOLICITADOS*");

	  if(items.length){
		lines.push(...buildLineItems());
	  }

	  lines.push("");
	  lines.push(`*Subtotal:* ${hasUnpricedItems ? "Por confirmar" : fmtCOP.format(subtotal)}`);
	  lines.push(`*Envío:* ${fmtCOP.format(envio)}`);
	  lines.push(`*Total:* ${hasUnpricedItems ? "Por confirmar" : fmtCOP.format(total)}`);
	  if(hasUnpricedItems){
		lines.push("*Nota:* Hay productos cuyo precio debe confirmarse antes de cerrar el pedido.");
	  }

	  // ✅ Celular tienda sin +57 (solo para el mensaje)
	  const storePhoneNo57 = String(STORE_INFO.whatsappDisplay || "")
		.replace(/^\s*\+?\s*57\s*/i, "")
		.trim();

	  lines.push("");
	  lines.push("*INFORMACIÓN DE LA TIENDA*");
	  lines.push(STORE_INFO.name);
	  lines.push(`*Celular:* ${storePhoneNo57}`);
	  lines.push(`*Dirección:* ${STORE_INFO.direccion}`);
	  lines.push(`*Barrio:* ${STORE_INFO.barrio}`);

	  // Orden solicitado: primero punto de referencia y luego enlaces
	  lines.push(`*Puntos de referencia:* ${STORE_INFO.referencias}`);
	  lines.push(`*Ubicación:* ${STORE_INFO.mapa}`);
	  lines.push(`*Catálogo:* ${STORE_INFO.catalogo}`);

	  return lines.join("\n");
	}

    function buildOrderPayload(){
      const items = cartItemsArray();
      const client = getClientDataCurrent();
      const atribucion = contextoAtribucionVisita();
      const addr = getAddressDataCurrent();
      const subtotal = cartTotalValue();
      const envio = getShippingCop();
      const totalPedido = subtotal + envio;
      const direccionClienteVisible = joinParts([addr.addressLine || "", addr.barrio ? `Barrio ${addr.barrio}` : ""], ", ");

      return {
        source: "catalogo-whatsapp",
        client_request_id: `${Date.now()}-${Math.random().toString(36).slice(2,10)}`,
        totalPedido,
        cliente: {
          nombre: client.name || "",
          celular: client.phone || "",
          direccion: direccionClienteVisible || "",
          direccionBase: addr.addressLine || "",
          direccionMapa: addr.mapLink || "",
          barrio: addr.barrio || ""
        },
        atribucion: {
          origenActual: String(atribucion.actual?.origen || ""),
          primerOrigen: String(atribucion.primero?.origen || ""),
          ultimoOrigen: String(atribucion.ultimo?.origen || ""),
          medio: String(atribucion.actual?.medio || ""),
          campana: String(atribucion.actual?.campana || ""),
          certeza: String(atribucion.actual?.certeza || ""),
          conversion: String(atribucion.conversion?.tipo || "")
        },
        items: items.map(it => {
          const p = productById.get(String(it.id)) || {};
          const valorUnitario = Number(it.price) || 0;
          const cantidadSolicitada = Number(it.qty) || 0;
          return {
            nombreProducto: it.name || "",
            valorUnitario,
            precioPendiente: it.hasPrice === false,
            cantidadSolicitada,
            totalPedido,
            marca: p.brand || "",
            categoria: p.category || "",
            codigo: shouldSendProductCodesByWhatsApp() ? String(it.id || "") : ""
          };
        })
      };
    }

    function fetchWithTimeout(url, options = {}, timeoutMs = 6500){
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Tiempo de espera agotado al registrar el pedido.")), timeoutMs);
        fetch(url, options)
          .then((res) => {
            clearTimeout(timer);
            resolve(res);
          })
          .catch((err) => {
            clearTimeout(timer);
            reject(err);
          });
      });
    }

    async function registerOrderInSheet(){
      const payload = buildOrderPayload();
      if(!Array.isArray(payload.items) || !payload.items.length) return { ok:false, skipped:true };

      const body = JSON.stringify(payload);

      await fetchWithTimeout(ORDER_LOG_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        cache: "no-store",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body
      }, ORDER_LOG_TIMEOUT_MS);

      return { ok:true, skipped:false };
    }

    let orderSending = false;

    const cartModal = document.getElementById("cartModal");
    const cartModalClose = document.getElementById("cartModalClose");
    const cartModalBackdrop = document.getElementById("cartModalBackdrop");
    const cartItemsEl = document.getElementById("cartItems");
    const cartTotalEl = document.getElementById("cartTotal");
    const cartBuyBtn = document.getElementById("cartBuyBtn");
    const cartClearBtn = document.getElementById("cartClearBtn");
    const cartAddressBtn = document.getElementById("cartAddressBtn");
    const cartClientBtn = document.getElementById("cartClientBtn");

    function openCartModal(){
      if(cartModal.classList.contains("open")) return;
      rememberModalTrigger(cartModal);
      renderCartModal();
      cartModal.classList.add("open");
      cartModal.setAttribute("aria-hidden", "false");
      lockBodyScroll();
      focusFirstInModal(cartModal, cartModalClose);
    }
    function closeCartModal(){
      if(!cartModal.classList.contains("open")) return;
      cartModal.classList.remove("open");
      cartModal.setAttribute("aria-hidden", "true");
      unlockBodyScroll();
      restoreModalTrigger(cartModal);
    }

    function renderCartModal(){
      const enforce = shouldEnforceStockLimits();
      const items = cartItemsArray();
      const total = cartTotalValue() + getShippingCop();
      const showPrices = shouldShowProductPrices();
      const hasUnpricedItems = items.some(it => it && it.hasPrice === false);
      cartTotalEl.textContent = (!showPrices || hasUnpricedItems)
        ? "Total: Por confirmar"
        : ("Total: " + fmtCOP.format(total));

      if(!items.length){
        cartItemsEl.innerHTML = `<div class="cart-empty">Carrito vacío.</div>`;
        return;
      }

      const frag = document.createDocumentFragment();
      items.forEach(it=>{
        const row = document.createElement("div");
        row.className = "cart-item";
        row.setAttribute("data-id", it.id);

        const left = document.createElement("div");
        left.className = "cart-item-left";

        const p = productById.get(String(it.id));
        const imgFilename = (p && p.imgFilename) ? p.imgFilename : it.imgFilename;

        left.appendChild(makeCartThumbFromFilename(imgFilename, it.name, p && p.docsImageUrl));

        const main = document.createElement("div");
        main.className = "cart-item-main";
        main.innerHTML = `
          <p class="cart-item-name"></p>
          <p class="cart-item-sub"></p>
        `;
        main.querySelector(".cart-item-name").textContent = it.name;
        const cartMetaParts = [];
        if(shouldShowProductCodes()) cartMetaParts.push(`Id: ${it.id}`);
        if(shouldShowProductPrices()){
          cartMetaParts.push(it.hasPrice === false ? "Precio: Por confirmar" : `Precio: ${fmtCOP.format(Number(it.price)||0)}`);
        }else{
          cartMetaParts.push("Precio: Por confirmar");
        }
        main.querySelector(".cart-item-sub").textContent = cartMetaParts.join(" · ");
        left.appendChild(main);

        const controls = document.createElement("div");
        controls.className = "cart-controls";
        controls.innerHTML = `
          <button class="cart-qty-btn" type="button" data-act="dec" aria-label="Disminuir">−</button>
          <span class="cart-qty" aria-label="Cantidad">${it.qty}</span>
          <button class="cart-qty-btn" type="button" data-act="inc" aria-label="Aumentar">+</button>
        `;

        const incBtn = controls.querySelector('button[data-act="inc"]');
        const hasKnownStock = Number.isFinite(it.stock) && it.stock >= 0;
        const maxStock = hasKnownStock ? it.stock : null;

        if(incBtn){
          incBtn.disabled = enforce
            ? (!hasKnownStock || maxStock <= 0 || (Number(it.qty)||0) >= maxStock)
            : false;
        }

        const subtotal = document.createElement("div");
        subtotal.className = "cart-subtotal";
        subtotal.textContent = (!shouldShowProductPrices() || it.hasPrice === false)
          ? "Por confirmar"
          : fmtCOP.format((Number(it.price)||0) * (Number(it.qty)||0));

        const remove = document.createElement("button");
        remove.className = "cart-remove";
        remove.type = "button";
        remove.textContent = "Eliminar";
        remove.setAttribute("data-act", "remove");

        row.appendChild(left);
        row.appendChild(controls);
        row.appendChild(subtotal);
        row.appendChild(remove);
        frag.appendChild(row);
      });

      cartItemsEl.innerHTML = "";
      cartItemsEl.appendChild(frag);
    }

    cartItemsEl.addEventListener("click", (e)=>{
      const btn = e.target.closest("button");
      if(!btn) return;
      const itemRow = e.target.closest(".cart-item");
      if(!itemRow) return;
      const id = itemRow.getAttribute("data-id");
      if(!id || !cart[id]) return;

      const enforce = shouldEnforceStockLimits();
      const act = btn.getAttribute("data-act");
      const current = cart[id];

      const hasKnownStock = Number.isFinite(current.stock) && current.stock >= 0;
      const maxStock = hasKnownStock ? current.stock : null;
      let newQty = safeInt(current.qty, 0);

      if(act === "inc"){
        if(!enforce){
          newQty += 1;
        }else if(hasKnownStock && maxStock > 0 && newQty < maxStock){
          newQty += 1;
        }
      }
      if(act === "dec"){
        newQty = Math.max(0, newQty - 1);
      }
      if(act === "remove"){
        newQty = 0;
      }

      if(!newQty) delete cart[id];
      else cart[id].qty = newQty;

      if(act === "inc" && newQty > safeInt(current.qty, 0)){
        registrarConversionCatalogo("Añadió al carrito", String(current.name || ""));
      }
      saveCart();
      renderCartModal();
    });

    function openWhatsAppTo(toDigits, text){
      const msg = String(text || "").trim() || "Hola, quiero información del catálogo.";
      window.open(waLinkTo(toDigits, msg), "_blank", "noopener");
    }

    const waTopTrackingLink = document.getElementById("waTopLink");
    if(waTopTrackingLink){
      waTopTrackingLink.addEventListener("click", ()=>{
        registrarConversionCatalogo("Abrió WhatsApp", "Contacto superior");
      });
    }

    // ÚNICO BOTÓN: Registrar pedido y luego abrir WhatsApp (se envía al número de la tienda)
    if(cartBuyBtn){
      cartBuyBtn.addEventListener("click", async ()=>{
        if(orderSending) return;

        orderSending = true;
        const previousText = cartBuyBtn.textContent;
        cartBuyBtn.disabled = true;
        cartBuyBtn.textContent = "Registrando pedido...";

        try{
          saveClientToLS();
          saveAddressToLS();
          saveShippingToLS();

          registrarConversionCatalogo("Inició pedido por WhatsApp", String(cartTotalQty()));
          try{
            await registerOrderInSheet();
            registrarConversionCatalogo("Pedido registrado", String(cartTotalQty()));
          }catch(err){
            console.error("No se pudo registrar el pedido en Google Sheets:", err);
          }

          // El mensaje SIEMPRE se envía al número de la tienda
          registrarConversionCatalogo("Abrió WhatsApp", "Compra desde carrito");
          openWhatsAppTo(getWhatsAppTo(), buildBuyerMessage());
        }finally{
          setTimeout(()=>{
            orderSending = false;
            cartBuyBtn.disabled = false;
            cartBuyBtn.textContent = previousText;
          }, 1200);
        }
      });
    }
    if(cartClearBtn){
      cartClearBtn.addEventListener("click", ()=>{
        for(const k of Object.keys(cart)) delete cart[k];
        saveCart();
        renderCartModal();
        render();
      });
    }

    if(cartModalClose) cartModalClose.addEventListener("click", closeCartModal);
    if(cartModalBackdrop) cartModalBackdrop.addEventListener("click", closeCartModal);

    if(shippingCopInp){
      shippingCopInp.addEventListener("input", ()=>{
        saveShippingToLS();
        if(cartModal.classList.contains("open")) renderCartModal();
      });
    }

    /* ==========================
       Modales Dirección / Otros datos
       ========================== */
    const addressModal = document.getElementById("addressModal");
    const addressModalClose = document.getElementById("addressModalClose");
    const addressModalBackdrop = document.getElementById("addressModalBackdrop");
    const addrCancelBtn = document.getElementById("addrCancelBtn");
    const addrSaveBtn = document.getElementById("addrSaveBtn");
    const addrMapsLink = document.getElementById("addrMapsLink");

    const addrCity = document.getElementById("addrCity");
    const addrRegion = document.getElementById("addrRegion");
    const addrViaTipo = document.getElementById("addrViaTipo");
    const addrViaNum = document.getElementById("addrViaNum");
    const addrPlaca = document.getElementById("addrPlaca");
    const addrBarrio = document.getElementById("addrBarrio");
    const addrFinal = document.getElementById("addrFinal");

    const DEFAULT_CITY = "Santa Marta";
    const DEFAULT_REGION = "Magdalena";

    function openAddressModal(){
      if(addressModal.classList.contains("open")) return;
      rememberModalTrigger(addressModal);
      loadAddressFromLS();
      addressModal.classList.add("open");
      addressModal.setAttribute("aria-hidden","false");
      lockBodyScroll();
      focusFirstInModal(addressModal, addrCity || addressModalClose);
    }
    function closeAddressModal(){
      if(!addressModal.classList.contains("open")) return;
      addressModal.classList.remove("open");
      addressModal.setAttribute("aria-hidden","true");
      unlockBodyScroll();
      restoreModalTrigger(addressModal);
    }

    function joinParts(parts, sep=" "){
      return parts.filter(Boolean).join(sep).replace(/\s+/g," ").trim();
    }

    function refreshAddressModalPreview(){
      const city = String(addrCity?.value || "").trim();
      const region = String(addrRegion?.value || "").trim();
      const tipo = String(addrViaTipo?.value || "").trim();
      const num = String(addrViaNum?.value || "").trim();
      const placa = String(addrPlaca?.value || "").trim();

      // Dirección final SOLO con vía + ciudad + departamento (sin barrio)
      const via = buildViaString(tipo, num, placa);
      const final = joinParts([via || "", city || "", region || ""], ", ");

      if(addrFinal) addrFinal.value = final;

      // El barrio NO se usa para el enlace de Google Maps
      const hasVia = !!(tipo && num && placa);
      if(addrMapsLink){
        if(!hasVia || !final){
          addrMapsLink.setAttribute("aria-disabled","true");
          addrMapsLink.setAttribute("tabindex","-1");
          addrMapsLink.href = "#";
        }else{
          addrMapsLink.removeAttribute("aria-disabled");
          addrMapsLink.setAttribute("tabindex","0");
          addrMapsLink.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(final);
        }
      }
    }

    function loadAddressFromLS(){
      const obj = readJsonLS(LS_ADDRESS_KEY, {});

      const hasCity = Object.prototype.hasOwnProperty.call(obj, "addrCity");
      const hasRegion = Object.prototype.hasOwnProperty.call(obj, "addrRegion");

      const cityVal = hasCity ? String(obj.addrCity ?? "") : DEFAULT_CITY;
      const regionVal = hasRegion ? String(obj.addrRegion ?? "") : DEFAULT_REGION;

      if(addrCity) addrCity.value = cityVal;
      if(addrRegion) addrRegion.value = regionVal;
      if(addrViaTipo) addrViaTipo.value = String(obj.addrViaTipo ?? "");
      if(addrViaNum) addrViaNum.value = String(obj.addrViaNum ?? "");
      if(addrPlaca) addrPlaca.value = String(obj.addrPlaca ?? "");
      if(addrBarrio) addrBarrio.value = String(obj.addrBarrio ?? "");
      refreshAddressModalPreview();
    }

    function saveAddressToLS(){
      const obj = readJsonLS(LS_ADDRESS_KEY, {});
      obj.addrCity = String(addrCity?.value ?? "");
      obj.addrRegion = String(addrRegion?.value ?? "");
      obj.addrViaTipo = String(addrViaTipo?.value ?? "");
      obj.addrViaNum = String(addrViaNum?.value ?? "");
      obj.addrPlaca = String(addrPlaca?.value ?? "");
      obj.addrBarrio = String(addrBarrio?.value ?? "");
      obj.addrFinal = String(addrFinal?.value ?? "");
      writeJsonLS(LS_ADDRESS_KEY, obj);
    }

    [addrCity, addrRegion, addrViaTipo, addrViaNum, addrPlaca, addrBarrio].forEach(el=>{
      if(!el) return;
      el.addEventListener("input", refreshAddressModalPreview);
      el.addEventListener("change", refreshAddressModalPreview);
    });

    if(addressModalClose) addressModalClose.addEventListener("click", closeAddressModal);
    if(addressModalBackdrop) addressModalBackdrop.addEventListener("click", closeAddressModal);
    if(addrCancelBtn) addrCancelBtn.addEventListener("click", closeAddressModal);
    if(addrSaveBtn) addrSaveBtn.addEventListener("click", ()=>{
      refreshAddressModalPreview();
      saveAddressToLS();
      closeAddressModal();
    });

    const clientModal = document.getElementById("clientModal");
    const clientModalClose = document.getElementById("clientModalClose");
    const clientModalBackdrop = document.getElementById("clientModalBackdrop");
    const clientCancelBtn = document.getElementById("clientCancelBtn");
    const clientSaveBtn = document.getElementById("clientSaveBtn");

    const clientName = document.getElementById("clientName");
    const clientPhone = document.getElementById("clientPhone");
    const clientObs = document.getElementById("clientObs");

    function openClientModal(){
      if(clientModal.classList.contains("open")) return;
      rememberModalTrigger(clientModal);
      loadClientFromLS();
      clientModal.classList.add("open");
      clientModal.setAttribute("aria-hidden","false");
      lockBodyScroll();
      focusFirstInModal(clientModal, clientName || clientModalClose);
    }
    function closeClientModal(){
      if(!clientModal.classList.contains("open")) return;
      clientModal.classList.remove("open");
      clientModal.setAttribute("aria-hidden","true");
      unlockBodyScroll();
      restoreModalTrigger(clientModal);
    }

    function loadClientFromLS(){
      const obj = readJsonLS(LS_CLIENT_KEY, {});
      if(clientName) clientName.value = String(obj.clientName ?? "");
      if(clientPhone) clientPhone.value = String(obj.clientPhone ?? "");
      if(clientObs) clientObs.value = String(obj.clientObs ?? "");
    }

    function saveClientToLS(){
      const obj = readJsonLS(LS_CLIENT_KEY, {});
      obj.clientName = String(clientName?.value ?? "");
      obj.clientPhone = String(clientPhone?.value ?? "");
      obj.clientObs = String(clientObs?.value ?? "");
      writeJsonLS(LS_CLIENT_KEY, obj);
    }

    if(clientModalClose) clientModalClose.addEventListener("click", closeClientModal);
    if(clientModalBackdrop) clientModalBackdrop.addEventListener("click", closeClientModal);
    if(clientCancelBtn) clientCancelBtn.addEventListener("click", closeClientModal);
    if(clientSaveBtn) clientSaveBtn.addEventListener("click", ()=>{
      saveClientToLS();
      closeClientModal();
    });

    if(cartAddressBtn) cartAddressBtn.addEventListener("click", openAddressModal);
    if(cartClientBtn) cartClientBtn.addEventListener("click", openClientModal);

    document.addEventListener("keydown", (e)=>{
      const activeModal = getOpenModal();
      if(activeModal && e.key === "Tab"){
        trapFocusInModal(activeModal, e);
        return;
      }
      if(e.key === "Escape"){
        if(imgModal && imgModal.classList.contains("open")){ closeImgModal(); return; }
        if(addressModal && addressModal.classList.contains("open")){ closeAddressModal(); return; }
        if(clientModal && clientModal.classList.contains("open")){ closeClientModal(); return; }
        if(cartModal && cartModal.classList.contains("open")){ closeCartModal(); return; }
      }
    });

    // El JSON-LD se sincroniza con los productos visibles del inventario oficial.
    let _jsonLdTimer = 0;
    function scheduleJsonLdUpdate(){
      clearTimeout(_jsonLdTimer);
      _jsonLdTimer = setTimeout(()=>{
        const node = document.getElementById("ld-products");
        if(!node) return;
        const source = (Array.isArray(all) ? all : [])
          .filter(p => p && !p.isGiftGalleryImage);
        const itemListElement = source.map((p,index)=>{
          const item = {
            "@type":"Product",
            "name":String(p.name || ""),
            "description":String(p.description || ""),
            "category":[p.category, p.subcategory, p.fragranceFamily]
              .filter(Boolean)
              .join(" > ")
          };
          if(shouldShowProductCodes()) item.sku = String(p.id || "");
          if(shouldShowProductImages() && p.docsImageUrl) item.image = [p.docsImageUrl];
          if(p.brand) item.brand = { "@type":"Brand", "name":p.brand };
          if(p.codeNatura) item.mpn = p.codeNatura;
          if(shouldShowProductPrices() && p.hasPrice !== false && Number(p.price) > 0){
            item.offers = {
              "@type":"Offer",
              "priceCurrency":"COP",
              "price":Number(p.price),
              "url":location.href.split("?")[0]
            };
          }
          return { "@type":"ListItem", "position":index+1, item };
        });
        node.textContent = JSON.stringify({
          "@context":"https://schema.org",
          "@type":"ItemList",
          "name":"Catálogo de productos de Irenismb Stock Natura",
          "numberOfItems":itemListElement.length,
          itemListElement
        });
      }, 0);
    }

    const cardTemplate = document.createElement("template");
    cardTemplate.innerHTML = `
      <article class="card">
        <div class="img"></div>
        <div class="pad">
          <h3 class="name"></h3>
          <p class="meta"></p>
          <p class="description" lang="es-CO"></p>
          <div class="row">
            <span class="price"></span>
            <span class="pill" data-role="qty"></span>
          </div>
          <div class="actions">
            <button type="button" class="btn-danger" data-act="dec">Quitar</button>
            <button type="button" class="btn-acc" data-act="inc">Agregar</button>
          </div>
        </div>
      </article>
    `;

    const albumTemplate = document.createElement("template");
    albumTemplate.innerHTML = `
      <article class="album-card">
        <button type="button" class="album-folder" data-album-open="">
          <div class="album-preview"></div>
          <div class="album-pad">
            <div class="album-card-top">
              <span class="album-icon" aria-hidden="true"></span>
              <span class="album-count-badge"></span>
            </div>
            <div class="album-copy">
              <h3 class="album-label"></h3>
              <p class="album-meta"></p>
            </div>
          </div>
        </button>
      </article>
    `;

    function stockMetaText(p){
      const hasKnownStock = Number.isInteger(p.stock) && p.stock >= 0;
      const stockVal = hasKnownStock ? p.stock : 0;
      const parts = [];
      const mainGroup = mainNavigationGroupForProduct(p);
      const subcategory = navigationCategoryForProduct(p);
      if(mainGroup) parts.push(mainGroup);
      if(subcategory && cleanNavKey(subcategory) !== cleanNavKey(mainGroup)) parts.push(subcategory);
      if(p.fragranceFamily) parts.push(p.fragranceFamily);
      if(p.id && shouldShowProductCodes()) parts.push(`Código ${p.id}`);
      if(INTERRUPTORES.MOSTRAR_CANTIDAD_STOCK){
        parts.push(hasKnownStock ? `Stock: ${stockVal}` : "Stock: Por confirmar");
      }
      if(INTERRUPTORES.MOSTRAR_TEXTO_ESTADO_STOCK){
        parts.push(hasKnownStock
          ? (stockVal > 0 ? "Disponible" : "Sin stock")
          : "Disponibilidad por confirmar");
      }
      return parts.filter(Boolean).join(" · ");
    }

    function refreshCardUI(card, p){
      const row = card.querySelector(".row");
      const actions = card.querySelector(".actions");
      const meta = card.querySelector(".meta");

      if(meta) meta.hidden = false;
      if(row) row.hidden = false;
      if(actions) actions.hidden = false;

      const enforce = shouldEnforceStockLimits();
      const id = String(p.id);
      const q = (cart[id]?.qty || 0);

      const qtyPill = card.querySelector('[data-role="qty"]');
      const decBtn = card.querySelector('button[data-act="dec"]');
      const incBtn = card.querySelector('button[data-act="inc"]');

      if(qtyPill) qtyPill.textContent = `En carrito: ${q}`;
      if(decBtn) decBtn.disabled = q <= 0;

      const hasKnownStock = Number.isFinite(p.stock) && p.stock >= 0;
      const maxStock = hasKnownStock ? p.stock : null;
      const canAdd = !enforce || (hasKnownStock && maxStock > 0 && q < maxStock);

      if(incBtn){
        incBtn.disabled = !canAdd;
        incBtn.classList.toggle("in-cart", q > 0);
        if(enforce && !hasKnownStock){
          incBtn.textContent = "Stock por confirmar";
        }else if(enforce && maxStock <= 0){
          incBtn.textContent = "Sin stock";
        }else{
          incBtn.textContent = "Agregar";
        }
      }
    }

    function makeCard(p){
      const card = cardTemplate.content.firstElementChild.cloneNode(true);
      card.id = "p-" + encodeURIComponent(String(p.id));
      card.dataset.id = String(p.id);

      const imgBox = card.querySelector(".img");
      imgBox.appendChild(makeImgFromFilename(p.imgFilename, p.name, p.docsImageUrl));

      const nameEl = card.querySelector(".name");
      const metaEl = card.querySelector(".meta");
      const descriptionEl = card.querySelector(".description");
      const priceEl = card.querySelector(".price");

      const visibleName = String(p.name || "");
      nameEl.textContent = visibleName;
      nameEl.title = visibleName;
      metaEl.textContent = stockMetaText(p);
      descriptionEl.textContent = String((p && p.description) || "").trim();
      descriptionEl.hidden = !descriptionEl.textContent;
      card.classList.toggle("has-long-description", descriptionEl.textContent.length > 900);
      priceEl.textContent = shouldShowProductPrices()
        ? (p.hasPrice === false ? "Consultar precio" : fmtCOP.format(p.price))
        : "";

      if(p && p.isGiftGalleryImage){
        card.classList.add("gift-gallery-card");
        const pad = card.querySelector(".pad");
        if(pad) pad.hidden = true;
        imgBox.setAttribute("aria-label", "Imagen de regalo para toda ocasión");
      }

      refreshCardUI(card, p);
      return card;
    }


    function makeAlbumPreview(sources, label){
      const img = document.createElement("img");
      img.alt = label ? ("Vista previa " + label) : "Vista previa de la categoría";
      img.loading = "lazy";
      img.decoding = "async";

      const sourceList = (Array.isArray(sources) ? sources : [sources])
        .map(source => String(source || "").trim())
        .filter(source => /^https:\/\//i.test(source));
      const candidates = [...new Set([
        sourceList[0],
        productPlaceholderAbsoluteUrl(),
        COMPANY_LOGO
      ].filter(Boolean))];

      let index = 0;
      img.src = candidates[index] || COMPANY_LOGO;
      img.onerror = ()=>{
        index++;
        if(index < candidates.length){
          img.src = candidates[index];
          return;
        }
        img.onerror = null;
      };

      return img;
    }

    function makeAlbumCard(album){
      const card = albumTemplate.content.firstElementChild.cloneNode(true);
      const btn = card.querySelector(".album-folder");
      const preview = card.querySelector(".album-preview");
      const icon = card.querySelector(".album-icon");
      const badge = card.querySelector(".album-count-badge");
      const label = card.querySelector(".album-label");
      const meta = card.querySelector(".album-meta");
      const unitLabel = album.count === 1 ? "producto" : "productos";
      const isAudience = album.navType === "audience";
      const searchActive = getCombinedWordTerms().length > 0;
      const matchCount = Number(album.count) || 0;
      const matchingProducts = searchActive && Array.isArray(album.matchingProducts)
        ? album.matchingProducts
        : [];

      card.classList.toggle("album-root-card", isAudience);
      card.classList.toggle("album-category-card", !isAudience);
      card.classList.toggle("search-reactive", searchActive);
      card.classList.toggle("search-hit", searchActive && matchCount > 0);
      card.classList.toggle("search-miss", searchActive && matchCount === 0);
      // Durante una búsqueda por categorías, los paneles sin coincidencias
      // desaparecen progresivamente conforme el texto reduce los resultados.
      card.hidden = searchActive && matchCount === 0;
      if(isAudience && album.theme) card.dataset.navTheme = album.theme;

      btn.dataset.albumOpen = album.key;
      btn.dataset.navType = album.navType || "category";

      if(searchActive){
        const matchWord = matchCount === 1 ? "coincidencia" : "coincidencias";
        const sampleNames = matchingProducts
          .slice(0, 2)
          .map(product => String(product?.name || "").trim())
          .filter(Boolean);
        const extraMatches = Math.max(0, matchCount - sampleNames.length);
        const sampleText = sampleNames.join(" · ");
        const moreText = extraMatches > 0 ? `${sampleText ? " · " : ""}+${extraMatches} más` : "";

        btn.setAttribute(
          "aria-label",
          `${album.label}: ${matchCount} ${matchWord}${matchCount > 0 ? ". Abrir resultados" : ""}`
        );
        btn.title = `${album.label} · ${matchCount} ${matchWord}`;
        if(badge) badge.textContent = `${matchCount} ${matchWord}`;
        if(meta){
          const giftGalleryMatches = matchingProducts.length > 0 &&
            matchingProducts.every(product => product && product.isGiftGalleryImage);
          meta.textContent = matchCount > 0
            ? (giftGalleryMatches
                ? `${matchCount} ${matchCount === 1 ? "imagen disponible" : "imágenes disponibles"}`
                : `${sampleText}${moreText}`)
            : "Sin coincidencias con tu búsqueda.";
        }
      }else{
        btn.setAttribute("aria-label", isAudience ? `Abrir ${album.label}` : `Abrir categoría ${album.label}`);
        btn.title = `${album.label} · ${album.count} ${unitLabel}`;
        if(badge) badge.textContent = `${album.count} ${unitLabel}`;
        if(meta){
          meta.textContent = isAudience
            ? (album.subtitle || "")
            : `${album.count} ${unitLabel}`;
        }
      }

      if(preview) preview.hidden = true;
      if(icon){
        const matchingPreviewSources = searchActive
          ? matchingProducts
              .map(product => String(product?.docsImageUrl || "").trim())
              .filter(Boolean)
          : [];
        const normalPreviewSources = Array.isArray(album.previewImages)
          ? album.previewImages
          : [];
        const productPreviewSources = matchingPreviewSources.length
          ? matchingPreviewSources
          : normalPreviewSources;
        const useProductPreview =
          shouldShowProductImageInNavigationPanels() &&
          productPreviewSources.length > 0;

        if(useProductPreview){
          const img = makeAlbumPreview(productPreviewSources, album.label);
          img.className = "album-icon-image album-product-preview";
          img.alt = searchActive && matchingPreviewSources.length
            ? `Producto coincidente en ${album.label}`
            : `Producto representativo de ${album.label}`;
          icon.replaceChildren(img);
          card.classList.add("album-uses-product-preview");
          card.classList.toggle("album-preview-is-search-match", searchActive && matchingPreviewSources.length > 0);
        }else if(album.iconImage){
          const img = document.createElement("img");
          img.className = "album-icon-image";
          img.alt = "";
          img.decoding = "async";
          img.loading = "eager";
          img.src = album.iconImage;
          icon.replaceChildren(img);
        }else if(album.iconSvg){
          icon.innerHTML = album.iconSvg;
        }else{
          icon.textContent = album.icon || "•";
        }
      }
      label.textContent = album.label;

      return card;
    }

    function makeEmptyState(message){
      const div = document.createElement("div");
      div.className = "empty-state";
      div.textContent = message;
      return div;
    }

    const catSel = document.getElementById("cat");
    const brandSel = document.getElementById("brand");
    const sortSel = document.getElementById("sort");
    const qInp = document.getElementById("q");
    const grid = document.getElementById("grid");
    const countEl = document.getElementById("count");
    const albumNav = document.getElementById("albumNav");
    const albumNavHost = document.getElementById("albumNavHost");
    const albumBackBtn = document.getElementById("albumBackBtn");
    const albumPath = document.getElementById("albumPath");
    const catalogEntryIntro = document.getElementById("catalogEntryIntro");
    const catalogEntryTitle = document.getElementById("catalogEntryTitle");
    const catalogEntryText = document.getElementById("catalogEntryText");

    const searchWrap = document.getElementById("searchWrap");
    const searchTicker = document.getElementById("searchTicker");
    const tickerInner = document.getElementById("tickerInner");

    const countSlot = document.getElementById("countSlot");
    const topline = document.getElementById("topline");
    const mqCountMobile = window.matchMedia("(max-width:760px)");

    const wordPanel = document.getElementById("wordPanel");
    const wordChips = document.getElementById("wordChips");
    const activeTermsWrap = document.getElementById("activeTermsWrap");
    const activeTerms = document.getElementById("activeTerms");
    const clearTermsBtn = document.getElementById("clearTermsBtn");
    const toggleWordPanelBtn = document.getElementById("toggleWordPanelBtn");

    let wordSuggestionsVisible = shouldShowSuggestionsInitially();

    function syncWordToggleButton(){
      if(!toggleWordPanelBtn) return;

      const canToggle = shouldAllowSuggestionToggle();
      const isVisible = wordSuggestionsVisible;

      toggleWordPanelBtn.hidden = !canToggle;
      toggleWordPanelBtn.disabled = !canToggle;
      toggleWordPanelBtn.textContent = isVisible ? "Ocultar palabras" : "Mostrar palabras";
      toggleWordPanelBtn.setAttribute("aria-pressed", isVisible ? "true" : "false");
      toggleWordPanelBtn.classList.toggle("is-active", isVisible);
    }

    function setWordSuggestionsVisible(nextValue){
      wordSuggestionsVisible = !!nextValue;

      if(!wordSuggestionsVisible){
        selectedSuggestionTerms = [];
      }

      syncWordToggleButton();
    }

    function toggleWordSuggestionsVisible(){
      if(!shouldAllowSuggestionToggle()) return;
      setWordSuggestionsVisible(!wordSuggestionsVisible);
      render();
    }

    function placeResponsiveHeaderMeta(){
      if(!countEl || !countSlot || !topline || !albumNav || !albumNavHost) return;

      if(mqCountMobile.matches){
        if(countEl.parentElement !== countSlot){
          countSlot.appendChild(countEl);
        }
        if(albumNav.parentElement !== countSlot){
          countSlot.appendChild(albumNav);
        }
        countEl.classList.add("count-mobile");
        topline.classList.add("hidden");
      }else{
        if(countEl.parentElement !== topline){
          topline.appendChild(countEl);
        }
        if(albumNav.parentElement !== albumNavHost){
          albumNavHost.appendChild(albumNav);
        }
        countEl.classList.remove("count-mobile");
        topline.classList.remove("hidden");
      }

      countSlot.classList.toggle("has-album-nav", !albumNav.hidden);
    }

    if(typeof mqCountMobile.addEventListener === "function"){
      mqCountMobile.addEventListener("change", placeResponsiveHeaderMeta);
    }else if(typeof mqCountMobile.addListener === "function"){
      mqCountMobile.addListener(placeResponsiveHeaderMeta);
    }
    placeResponsiveHeaderMeta();

    function updateTickerVisibility(){
      if(!searchWrap || !qInp) return;
      const empty = !String(qInp.value || "").trim();
      const focused = (document.activeElement === qInp);
      searchWrap.classList.toggle("show-ticker", empty && !focused);
    }

    function updateCountAttention(){
      if(!countEl || !qInp) return;
      const hasQuery = getCombinedWordTerms().length > 0;
      countEl.classList.toggle("search-active", hasQuery);
    }

    const SUGGESTION_STOPWORDS = new Set([
      "a","al","algo","alguna","algunas","alguno","algunos","ante","bajo","cabe","con","contra",
      "cual","cuales","como","cuando","de","del","desde","donde","dos","el","ella","ellas","ellos",
      "en","entre","era","eres","es","esa","esas","ese","eso","esos","esta","estas","este","esto","estos",
      "ha","hacia","hasta","la","las","le","les","lo","los","mas","mi","mis","muy","ni","no","nos","o",
      "otra","otro","otros","para","pero","por","que","se","segun","ser","si","sin","sobre","su","sus",
      "te","tu","tus","u","un","una","uno","unos","unas","y","ya","kit","ml","gr","kg","oz","cm","mm",
      "x","und","unds","unidad","unidades","ref","tipo"
    ]);
    const SUGGESTION_MIN_LEN = 3;
    // Sin límite de cantidad: las sugerencias no se recortan por número.
    let selectedSuggestionTerms = [];

    function parseSearchTerms(text){
      return normalizeText(text)
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean);
    }

    function parseSuggestionTokens(text){
      return normalizeText(text)
        .split(/[^a-z0-9]+/g)
        .map(t => t.trim())
        .filter(token => {
          if(!token) return false;
          if(token.length < SUGGESTION_MIN_LEN) return false;
          if(/^\d+$/.test(token)) return false;
          if(SUGGESTION_STOPWORDS.has(token)) return false;
          return true;
        });
    }

    function uniqueTerms(list){
      const out = [];
      const seen = new Set();
      for(const term of (Array.isArray(list) ? list : [])){
        const clean = normalizeText(term);
        if(!clean || seen.has(clean)) continue;
        seen.add(clean);
        out.push(clean);
      }
      return out;
    }

    function getCombinedWordTerms(){
      const typed = parseSearchTerms(qInp ? qInp.value : "");
      return uniqueTerms([...(selectedSuggestionTerms || []), ...typed]);
    }

    function getSuggestionScopeProducts(){
      const source = currentProductSourceList();
      const cat = catSel ? catSel.value : "";
      const br = brandSel ? brandSel.value : "";

      return source.filter(p => {
        if(cat && p.category !== cat) return false;
        if(br && p.brand !== br) return false;
        return true;
      });
    }

    function getSuggestionBlockedTerms(list){
      const blocked = new Set();

      for(const p of (Array.isArray(list) ? list : [])){
        for(const token of parseSuggestionTokens(p && p.category ? p.category : "")) blocked.add(token);
        for(const token of parseSuggestionTokens(p && p.section ? p.section : "")) blocked.add(token);
      }

      return blocked;
    }

    function addSuggestionCountsFromText(counts, text, blockedTerms){
      const unique = new Set(parseSuggestionTokens(text));
      for(const token of unique){
        if(blockedTerms && blockedTerms.has(token)) continue;
        counts.set(token, (counts.get(token) || 0) + 1);
      }
    }

    function getSuggestionMatchedProducts(){
      const scopeProducts = getSuggestionScopeProducts();
      const activeTerms = getCombinedWordTerms();
      if(!activeTerms.length) return scopeProducts;

      const eligibleProducts = filterSearchExcludedProducts(scopeProducts);
      return eligibleProducts.filter(p => activeTerms.every(term => p.searchKey.includes(term)));
    }

    function buildSuggestionEntries(){
      if(shouldShowAlbumGrid()){
        return [];
      }

      const scopeProducts = getSuggestionScopeProducts();
      const matchedProducts = getSuggestionMatchedProducts();
      const typedTerms = parseSearchTerms(qInp ? qInp.value : "");
      const selectedSet = new Set(uniqueTerms(selectedSuggestionTerms || []));
      const hasActiveTerms = typedTerms.length > 0 || selectedSet.size > 0;
      const sourceProducts = hasActiveTerms ? matchedProducts : scopeProducts;
      const blockedTerms = getSuggestionBlockedTerms(sourceProducts);
      const totalVisibleProducts = sourceProducts.length;

      for(const term of typedTerms){
        blockedTerms.add(term);
      }
      for(const term of selectedSet){
        blockedTerms.add(term);
      }

      selectedSuggestionTerms = uniqueTerms((selectedSuggestionTerms || []).filter(term => {
        return !getSuggestionBlockedTerms(sourceProducts).has(term);
      }));

      const counts = new Map();
      for(const p of sourceProducts){
        const rawText = `${p.name || ""}`;
        addSuggestionCountsFromText(counts, rawText, blockedTerms);
      }

	return Array.from(counts.entries())
	  .map(([term, count]) => ({
		term,
		count,
		remaining: count,
		reduction: Math.max(0, totalVisibleProducts - count)
	  }))
	  .sort((a,b)=> {
		const aSelected = selectedSet.has(a.term) ? 1 : 0;
		const bSelected = selectedSet.has(b.term) ? 1 : 0;

		if(aSelected !== bSelected) return bSelected - aSelected;

		// Primero las de más coincidencias
		if(b.count !== a.count) return b.count - a.count;

		return a.term.localeCompare(b.term, "es", { sensitivity:"base" });
	});		
    }

    function toggleSuggestionTerm(term){
      const clean = normalizeText(term);
      if(!clean) return;

      if(selectedSuggestionTerms.includes(clean)){
        selectedSuggestionTerms = selectedSuggestionTerms.filter(t => t !== clean);
      }else{
        selectedSuggestionTerms = uniqueTerms([...(selectedSuggestionTerms || []), clean]);
      }
      render();
    }

    function removeSuggestionTerm(term){
      const clean = normalizeText(term);
      if(!clean) return;
      selectedSuggestionTerms = selectedSuggestionTerms.filter(t => t !== clean);
      render();
    }

    function renderWordSuggestions(){
      if(!wordPanel || !wordChips || !activeTerms || !activeTermsWrap || !clearTermsBtn) return;

      syncWordToggleButton();

      const showAlbumGrid = shouldShowAlbumGrid();
      if(showAlbumGrid || !wordSuggestionsVisible){
        wordPanel.hidden = true;
        clearTermsBtn.hidden = true;
        activeTermsWrap.hidden = true;
        wordChips.innerHTML = "";
        activeTerms.innerHTML = "";
        return;
      }

      const entries = buildSuggestionEntries();
      const activeTermsList = uniqueTerms(selectedSuggestionTerms || []);
      const rawQuery = qInp ? String(qInp.value || "") : "";
      const typedTerms = parseSearchTerms(rawQuery);
      const hasTypedCharacters = rawQuery.trim().length > 0;
      const hasWordFilter = activeTermsList.length > 0 || typedTerms.length > 0;

      wordPanel.hidden = !(entries.length || activeTermsList.length || typedTerms.length);
      clearTermsBtn.hidden = !(activeTermsList.length > 0 || hasTypedCharacters);
      clearTermsBtn.classList.toggle("search-active", hasTypedCharacters);
      activeTermsWrap.hidden = !activeTermsList.length;

      wordChips.innerHTML = "";
      activeTerms.innerHTML = "";

      if(activeTermsList.length){
        const activeFrag = document.createDocumentFragment();
        for(const term of activeTermsList){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "term-chip is-active";
          btn.dataset.term = term;
          btn.dataset.role = "remove-active-term";
          btn.setAttribute("aria-label", `Quitar palabra ${term}`);
          btn.innerHTML = `<span>${term}</span><span class="term-chip-remove" aria-hidden="true">×</span>`;
          activeFrag.appendChild(btn);
        }
        activeTerms.appendChild(activeFrag);
      }

      if(!entries.length){
        const empty = document.createElement("div");
        empty.className = "word-empty";
        empty.textContent = "No hay palabras sugeridas para esta vista.";
        wordChips.appendChild(empty);
      }else{
        const frag = document.createDocumentFragment();
        for(const entry of entries){
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "term-chip" + (activeTermsList.includes(entry.term) ? " is-active" : "");
          btn.dataset.term = entry.term;
          btn.dataset.role = "toggle-term";
          btn.setAttribute("aria-pressed", activeTermsList.includes(entry.term) ? "true" : "false");
          btn.innerHTML = `<span>${entry.term}</span><span class="term-chip-count">${entry.count}</span>`;
          frag.appendChild(btn);
        }
        wordChips.appendChild(frag);
      }
    }

    function rebuildSearchTicker(){
      if(!searchWrap || !searchTicker || !tickerInner || !qInp) return;

      const text = String(qInp.getAttribute("placeholder") || "").trim();
      if(!text){
        tickerInner.innerHTML = "";
        searchWrap.style.setProperty("--marquee-distance", "0px");
        return;
      }

      tickerInner.innerHTML = "";

      const seq = document.createElement("div");
      seq.className = "ticker-seq";
      tickerInner.appendChild(seq);

      const available = Math.max(1, searchTicker.clientWidth || searchWrap.clientWidth || 1);
      const target = Math.max(280, Math.floor(available * 1.7));

      let guard = 0;
      while(seq.scrollWidth < target && guard < 60){
        const item = document.createElement("span");
        item.className = "ticker-item";
        item.textContent = text;
        seq.appendChild(item);
        guard++;
      }

      const seqWidth = seq.scrollWidth || 0;
      if(seqWidth <= 0) return;

      const clone = seq.cloneNode(true);
      tickerInner.appendChild(clone);

      const SPEED_PX_PER_SEC = 60;
      const duration = Math.max(8, seqWidth / SPEED_PX_PER_SEC);

      searchWrap.style.setProperty("--marquee-distance", seqWidth + "px");
      searchWrap.style.setProperty("--marquee-duration", duration.toFixed(2) + "s");
    }

    function clearSelectButKeepFirst(sel){
      const first = sel.querySelector("option[value='']");
      sel.innerHTML = "";
      if(first) sel.appendChild(first);
      else{
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = (sel === catSel) ? "Todas las categorías" : "Todas las marcas";
        sel.appendChild(opt);
      }
    }

    function fillSelect(sel, values){
      clearSelectButKeepFirst(sel);
      for(const v of values){
        const opt = document.createElement("option");
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
      }
    }

    function syncFilterVisibility(){
      const showAlbumGrid = shouldShowAlbumGrid();
      const directSelected = isDirectProductAudience(selectedAudience);

      if(catSel){
        catSel.hidden = true;
        catSel.disabled = true;
        catSel.value = "";
      }
      if(brandSel){
        brandSel.hidden = true;
        brandSel.disabled = true;
        brandSel.value = "";
      }
      if(sortSel){
        sortSel.hidden = showAlbumGrid;
        sortSel.disabled = showAlbumGrid;
      }
      if(albumNav){
        albumNav.hidden = !selectedAudience;
      }
      if(albumBackBtn){
        albumBackBtn.textContent = selectedFamily
          ? `← Volver a ${selectedCategory}`
          : (selectedCategory ? `← Volver a ${selectedAudience}` : "← Volver al inicio");
      }
      placeResponsiveHeaderMeta();
      if(albumPath){
        albumPath.textContent = selectedAudience
          ? (selectedFamily
              ? `${selectedAudience} › ${selectedCategory} › ${selectedFamily}`
              : (selectedCategory ? `${selectedAudience} › ${selectedCategory}` : selectedAudience))
          : "";
      }
      if(qInp){
        const searchScopeLabel = selectedFamily || selectedCategory || selectedAudience;
        qInp.placeholder = selectedAudience
          ? `🔍 Buscar dentro de ${searchScopeLabel}...`
          : "🔍 Busca aquí por nombre del producto...";
        qInp.setAttribute("aria-label", selectedAudience ? `Buscar dentro de ${searchScopeLabel}` : "Buscar producto por nombre");
      }
      if(grid){
        grid.classList.toggle("album-grid-mode", showAlbumGrid);
        grid.classList.toggle("root-nav-mode", showAlbumGrid && !selectedAudience);
        const label = !selectedAudience
          ? "Secciones principales"
          : (directSelected
              ? "Productos"
              : (!selectedCategory ? "Subcategorías" : (albums.length > 0 && !selectedFamily ? "Familias olfativas" : "Productos")));
        grid.setAttribute("aria-label", showAlbumGrid ? label : "Productos");
      }
      if(catalogEntryIntro){
        const hasTerms = getCombinedWordTerms().length > 0;
        catalogEntryIntro.hidden = hasTerms || !!selectedCategory || directSelected;
        if(catalogEntryTitle){
          catalogEntryTitle.textContent = selectedAudience || "¿Qué estás buscando?";
        }
        if(catalogEntryText){
          catalogEntryText.textContent = selectedAudience
            ? (directSelected ? "Explora los regalos disponibles." : "Elige una categoría para ver los productos disponibles.")
            : "Elige una categoría para comenzar.";
        }
      }

      rebuildSearchTicker();
      updateTickerVisibility();
    }

    function readStateFromUrl(){
      const u = new URL(location.href);
      const q = (u.searchParams.get("q") || "").trim();
      const sort = (u.searchParams.get("sort") || "").trim();
      const audience = (u.searchParams.get("audience") || "").trim();
      const category = (u.searchParams.get("category") || "").trim();
      const family = (u.searchParams.get("family") || "").trim();
      const tags = (u.searchParams.get("tags") || "").trim();

      if(qInp) qInp.value = q || "";
      selectedSuggestionTerms = wordSuggestionsVisible ? uniqueTerms(tags ? tags.split(",") : []) : [];
      const validAudience = NAV_AUDIENCES.find(item => cleanNavKey(item.label) === cleanNavKey(audience));
      selectedAudience = validAudience ? validAudience.label : "";
      selectedCategory = selectedAudience && category && !isDirectProductAudience(selectedAudience) ? category : "";
      selectedFamily = selectedCategory && family ? family : "";
      if(sort && sortSel) sortSel.value = sort;
    }

    let _urlTimer = null;
    function writeStateToUrl(){
      const u = new URL(location.href);
      const q = qInp.value.trim();
      const cat = catSel.value;
      const br = brandSel.value;
      const sort = sortSel ? sortSel.value : "";
      const tags = uniqueTerms(selectedSuggestionTerms || []).join(",");

      if (q) u.searchParams.set("q", q); else u.searchParams.delete("q");
      if (cat) u.searchParams.set("cat", cat); else u.searchParams.delete("cat");
      if (br) u.searchParams.set("brand", br); else u.searchParams.delete("brand");
      if (sort) u.searchParams.set("sort", sort); else u.searchParams.delete("sort");
      if (selectedAudience) u.searchParams.set("audience", selectedAudience); else u.searchParams.delete("audience");
      if (selectedCategory) u.searchParams.set("category", selectedCategory); else u.searchParams.delete("category");
      if (selectedFamily) u.searchParams.set("family", selectedFamily); else u.searchParams.delete("family");
      u.searchParams.delete("album");
      if (tags) u.searchParams.set("tags", tags); else u.searchParams.delete("tags");

      history.replaceState(null, "", u.toString());
    }
    function scheduleWriteStateToUrl(){
      clearTimeout(_urlTimer);
      _urlTimer = setTimeout(writeStateToUrl, 180);
    }

    function resetDiscoveryFilters(){
      if(qInp) qInp.value = "";
      if(catSel) catSel.value = "";
      if(brandSel) brandSel.value = "";
      if(sortSel) sortSel.value = "";
      selectedSuggestionTerms = [];
    }

    function openAlbum(key, opts={}){
      const target = albumByKey.get(String(key || ""));
      if(!target) return;
      if(target.navType === "audience"){
        selectedAudience = target.navValue;
        selectedCategory = "";
        selectedFamily = "";
      }else if(target.navType === "category"){
        selectedAudience = target.audience || selectedAudience;
        selectedCategory = target.navValue;
        selectedFamily = "";
      }else if(target.navType === "family"){
        selectedAudience = target.audience || selectedAudience;
        selectedCategory = target.category || selectedCategory;
        selectedFamily = target.navValue;
      }
      if(!opts.keepFilters) resetDiscoveryFilters();
      refreshNavigationAlbums();
      refreshFilterOptionsForScope();
      render();
    }

    function closeAlbum(opts={}){
      if(selectedFamily){
        selectedFamily = "";
      }else if(selectedCategory){
        selectedCategory = "";
      }else{
        selectedAudience = "";
      }
      if(!opts.keepFilters) resetDiscoveryFilters();
      refreshNavigationAlbums();
      refreshFilterOptionsForScope();
      render();
    }

    function buildFilteredList(){
      const source = currentProductSourceList();
      const sortMode = sortSel ? sortSel.value : "";
      const terms = getCombinedWordTerms();
      const searchableSource = terms.length ? filterSearchExcludedProducts(source) : source;

      let filtered = searchableSource.filter(p=>{
        if(terms.length){
          return terms.every(t => p.searchKey.includes(t));
        }
        return true;
      });

      filtered.sort((a,b)=>{

        if(sortMode === "price_asc"){
          if((a.hasPrice !== false) !== (b.hasPrice !== false)) return a.hasPrice === false ? 1 : -1;
          return (a.price||0) - (b.price||0)
            || String(a.name||"").localeCompare(String(b.name||""), "es", { sensitivity:"base" })
            || String(a.id).localeCompare(String(b.id));
        }

        if(sortMode === "price_desc"){
          if((a.hasPrice !== false) !== (b.hasPrice !== false)) return a.hasPrice === false ? 1 : -1;
          return (b.price||0) - (a.price||0)
            || String(a.name||"").localeCompare(String(b.name||""), "es", { sensitivity:"base" })
            || String(a.id).localeCompare(String(b.id));
        }

        return String(a.name||"").localeCompare(String(b.name||""), "es", { sensitivity:"base" })
          || String(a.id).localeCompare(String(b.id));
      });

      return filtered;
    }

    function buildFilteredAlbums(){
      const terms = getCombinedWordTerms();
      let filtered = albums.map(album => {
        if(!terms.length) return album;
        const searchableProducts = filterSearchExcludedProducts(album.products || []);
        const matchingProducts = searchableProducts.filter(p => terms.every(t => p.searchKey.includes(t)));
        return {
          ...album,
          count:matchingProducts.length,
          matchingProducts
        };
      });

      filtered.sort((a,b)=>{
        if(!selectedAudience){
          const order = new Map(NAV_AUDIENCES.map((item,index)=>[item.label,index]));
          return (order.get(a.label) ?? 99) - (order.get(b.label) ?? 99);
        }
        return a.label.localeCompare(b.label, "es", { sensitivity:"base" });
      });
      return filtered;
    }

    let _renderToken = 0;
    function render(){
      const token = ++_renderToken;

      hiddenAlbumNameSet = new Set(getHiddenAlbumNames());
      searchExcludedAlbumNameSet = new Set(getSearchExcludedAlbumNames());

      syncFilterVisibility();
      syncWordToggleButton();
      updateTickerVisibility();
      renderWordSuggestions();
      updateCountAttention();
      scheduleWriteStateToUrl();

      const qHas = getCombinedWordTerms().length > 0;

      if(shouldShowAlbumGrid()){
        const filteredAlbums = buildFilteredAlbums();
        const visibleAlbumCount = qHas
          ? filteredAlbums.filter(album => (Number(album.count) || 0) > 0).length
          : filteredAlbums.length;
        if(grid){
          grid.classList.toggle("album-three-column-layout", visibleAlbumCount >= 5);
        }
        if(countEl){
          const totalProducts = filteredAlbums.reduce((sum,album)=>sum + (Number(album.count) || 0), 0);
          const activeCards = filteredAlbums.filter(album => (Number(album.count) || 0) > 0).length;
          if(qHas){
            const productWord = totalProducts === 1 ? "producto encontrado" : "productos encontrados";
            const groupWord = selectedAudience
              ? (activeCards === 1 ? "categoría" : "categorías")
              : (activeCards === 1 ? "sección" : "secciones");
            countEl.textContent = `${totalProducts} ${productWord} en ${activeCards} ${groupWord}`;
          }else{
            const productWord = totalProducts === 1 ? "producto" : "productos";
            const groupWord = selectedAudience
              ? (filteredAlbums.length === 1 ? "categoría" : "categorías")
              : (filteredAlbums.length === 1 ? "opción" : "opciones");
            countEl.textContent = `${totalProducts} ${productWord} · ${filteredAlbums.length} ${groupWord}`;
          }
          countEl.classList.toggle("search-active", qHas);
        }

        scheduleJsonLdUpdate([]);

        if(token !== _renderToken) return;

        const frag = document.createDocumentFragment();
        if(!filteredAlbums.length){
          frag.appendChild(makeEmptyState(!selectedAudience ? "No se encontraron secciones con ese nombre." : "No se encontraron categorías con ese nombre."));
        }else{
          for(const album of filteredAlbums){
            frag.appendChild(makeAlbumCard(album));
          }
        }

        grid.innerHTML = "";
        grid.appendChild(frag);
        return;
      }

      if(grid){
        grid.classList.remove("album-three-column-layout");
      }

      const filtered = buildFilteredList();

      if(countEl){
        countEl.textContent = `${filtered.length} ${filtered.length === 1 ? "producto" : "productos"}`;
        countEl.classList.toggle("search-active", qHas);
      }

      scheduleJsonLdUpdate(filtered);

      if(token !== _renderToken) return;

      const frag = document.createDocumentFragment();
      if(!filtered.length){
        frag.appendChild(makeEmptyState("No se encontraron productos con ese nombre."));
      }else{
        for(const p of filtered){
          frag.appendChild(makeCard(p));
        }
      }

      grid.innerHTML = "";
      grid.appendChild(frag);

      for(const el of grid.querySelectorAll(".card")){
        const id = el.dataset.id;
        const p = productById.get(String(id));
        if(p) refreshCardUI(el, p);
      }
    }

    function updateCountTextLoading(){
      if(countEl) countEl.textContent = "Cargando productos…";
    }

    function updateCountTextError(msg){
      if(countEl) countEl.textContent = msg || "Error al cargar productos.";
    }

    function bindGridActions(){
      grid.addEventListener("click", (e)=>{
        const albumBtn = e.target.closest("[data-album-open]");
        if(albumBtn){
          const key = albumBtn.getAttribute("data-album-open") || "";
          if(key) openAlbum(key, { keepFilters:getCombinedWordTerms().length > 0 });
          return;
        }

        const btn = e.target.closest("button[data-act]");
        if(!btn) return;
        const card = e.target.closest(".card");
        if(!card) return;
        const id = card.dataset.id;
        if(!id) return;

        const p = productById.get(String(id));
        if(!p) return;

        const act = btn.getAttribute("data-act");
        const enforce = shouldEnforceStockLimits();
        const hasKnownStock = Number.isFinite(p.stock) && p.stock >= 0;
        const maxStock = hasKnownStock ? p.stock : null;

        const currentQty = safeInt(cart[id]?.qty, 0);

        let newQty = currentQty;

        if(act === "inc"){
          if(!enforce){
            newQty = currentQty + 1;
          }else if(hasKnownStock && maxStock > 0 && currentQty < maxStock){
            newQty = currentQty + 1;
          }else{
            newQty = currentQty;
          }
        }else if(act === "dec"){
          newQty = Math.max(0, currentQty - 1);
        }

        if(newQty <= 0){
          delete cart[id];
        }else{
          cart[id] = {
            id: p.id,
            name: p.name,
            price: p.price,
            hasPrice: p.hasPrice !== false,
            qty: newQty,
            stock: p.stock,
            imgFilename: p.imgFilename || null
          };
        }

        if(act === "inc" && newQty > currentQty){
          registrarConversionCatalogo("Añadió al carrito", String(p.name || ""));
        }
        saveCart();
        refreshCardUI(card, p);

        if(cartModal && cartModal.classList.contains("open")){
          renderCartModal();
        }
      });
    }

    function bindFilters(){
      [sortSel].forEach(sel=>{
        if(!sel) return;
        sel.addEventListener("change", ()=>{
          render();
        });
      });

      qInp.addEventListener("input", ()=>{
        render();
      });

      if(wordChips){
        wordChips.addEventListener("click", (e)=>{
          const btn = e.target.closest("[data-role='toggle-term']");
          if(!btn) return;
          toggleSuggestionTerm(btn.getAttribute("data-term") || "");
        });
      }

      if(activeTerms){
        activeTerms.addEventListener("click", (e)=>{
          const btn = e.target.closest("[data-role='remove-active-term']");
          if(!btn) return;
          removeSuggestionTerm(btn.getAttribute("data-term") || "");
        });
      }

      if(clearTermsBtn){
        clearTermsBtn.addEventListener("click", ()=>{
          selectedSuggestionTerms = [];
          if(qInp) qInp.value = "";
          render();
        });
      }

      if(toggleWordPanelBtn){
        toggleWordPanelBtn.addEventListener("click", ()=>{
          toggleWordSuggestionsVisible();
        });
      }

      qInp.addEventListener("focus", ()=>{
        updateTickerVisibility();
      });
      qInp.addEventListener("blur", ()=>{
        updateTickerVisibility();
      });

      window.addEventListener("resize", ()=>{
        rebuildSearchTicker();
        updateTickerVisibility();
      }, { passive:true });
    }

    function buildCategoriesAndBrands(list){
      const cats = new Set();
      const brands = new Set();
      for(const p of list){
        if(p.category) cats.add(p.category);
        if(p.brand) brands.add(p.brand);
      }
      return {
        cats: Array.from(cats).sort((a,b)=> a.localeCompare(b,"es",{sensitivity:"base"})),
        brands: Array.from(brands).sort((a,b)=> a.localeCompare(b,"es",{sensitivity:"base"}))
      };
    }

    function rebuildCatalogVisibility(){
      hiddenAlbumNameSet = new Set(getHiddenAlbumNames());
      searchExcludedAlbumNameSet = new Set(getSearchExcludedAlbumNames());

      all = filterVisibleProducts(allLoadedProducts);
      productById = new Map(all.map(p => [String(p.id), p]));
      refreshNavigationAlbums();

      updateCatalogFooterProducts(all);
      scheduleJsonLdUpdate();
      refreshFilterOptionsForScope();
      sanitizeCartWithStock();
      render();
    }

    async function loadProducts(){
      updateCountTextLoading();
      clearLegacyProductCaches();

      try{
        await warmupPlaceholderOnce();
      }catch(error){
        console.warn("No se pudo preparar la imagen suplente. El catálogo continuará.", error);
      }

      let catalogSource;
      try{
        catalogSource = await loadGoogleSheetCatalog();
      }catch(err){
        console.error("Error al cargar el Google Sheet oficial.", err);
        updateCountTextError("No se pudieron cargar los productos desde el Google Sheet oficial. Reintenta más tarde.");
        return;
      }

      let sheetProducts = [];
      try{
        sheetProducts = (Array.isArray(catalogSource?.sheetEntries) ? catalogSource.sheetEntries : [])
          .map(makeProductFromGoogleSheet)
          .filter(Boolean);
      }catch(err){
        console.error("El Google Sheet respondió, pero ocurrió un error al procesar sus productos.", err);
        updateCountTextError("El Google Sheet respondió, pero no se pudieron procesar los productos. Revisa la consola para el detalle.");
        return;
      }

      if(!sheetProducts.length){
        console.error("El Google Sheet respondió, pero no produjo productos válidos para mostrar.");
        updateCountTextError("El Google Sheet respondió, pero no se encontraron productos válidos para mostrar.");
        return;
      }

      let giftProducts = [];
      try{
        giftProducts = makeGiftGalleryProducts(catalogSource?.giftImageUrls);
      }catch(err){
        console.warn("No se pudo preparar la galería de regalos. El inventario continuará disponible.", err);
        giftProducts = [];
      }

      allLoadedProducts = [...sheetProducts, ...giftProducts];

      try{
        hiddenAlbumNameSet = new Set(getHiddenAlbumNames());
        searchExcludedAlbumNameSet = new Set(getSearchExcludedAlbumNames());
        all = filterVisibleProducts(allLoadedProducts);
      }catch(err){
        console.warn("No se pudieron aplicar todos los controles de categorías. Se muestran los productos cargados para no dejar el catálogo vacío.", err);
        all = allLoadedProducts.slice();
      }

      try{
        productById = new Map(all.map(p => [String(p.id), p]));
        readStateFromUrl();
        if(selectedCategory){
          const hasCategory = all.some(p => productMatchesAudience(p, selectedAudience) && cleanNavKey(navigationCategoryForProduct(p)) === cleanNavKey(selectedCategory));
          if(!hasCategory){
            selectedCategory = "";
            selectedFamily = "";
          }
        }
        if(selectedFamily){
          const hasFamily = all.some(p =>
            productMatchesAudience(p, selectedAudience) &&
            cleanNavKey(navigationCategoryForProduct(p)) === cleanNavKey(selectedCategory) &&
            cleanNavKey(navigationFamilyForProduct(p)) === cleanNavKey(selectedFamily)
          );
          if(!hasFamily) selectedFamily = "";
        }
        refreshNavigationAlbums();
      }catch(err){
        console.warn("Los productos se cargaron, pero no se pudo reconstruir toda la navegación. Se restablece la vista principal.", err);
        selectedAudience = "";
        selectedCategory = "";
        selectedFamily = "";
        selectedAlbumKey = "";
        albums = [];
        albumByKey = new Map();
        productById = new Map(all.map(p => [String(p.id), p]));
      }

      try{ updateCatalogFooterProducts(all); }catch(err){ console.warn("No se pudo actualizar el pie del catálogo.", err); }
      try{ scheduleJsonLdUpdate(); }catch(err){ console.warn("No se pudo actualizar JSON-LD.", err); }
      try{ refreshFilterOptionsForScope(); }catch(err){ console.warn("No se pudieron actualizar todos los filtros.", err); }
      try{ sanitizeCartWithStock(); }catch(err){ console.warn("No se pudo validar el carrito contra el stock.", err); }

      try{
        render();
      }catch(err){
        console.error("Los productos se cargaron, pero ocurrió un error al renderizar el catálogo.", err);
        updateCountTextError("Los productos se cargaron, pero ocurrió un error al mostrar el catálogo. Revisa la consola para el detalle.");
      }
    }

    function initCartButton(){
      const btnCart = document.getElementById("btn-cart");
      if(!btnCart) return;
      btnCart.addEventListener("click", ()=>{
        openCartModal();
      });
    }

    function initShipping(){
      loadShippingFromLS();
    }

    function initKeyboardAccessibility(){
      // Cierre de modales ya está en Escape
    }

    async function init(){
      refreshCartCount();
      initCartButton();
      initShipping();
      bindFilters();
      bindGridActions();
      initKeyboardAccessibility();

      if(albumBackBtn){
        albumBackBtn.addEventListener("click", ()=>{
          closeAlbum({ keepFilters:getCombinedWordTerms().length > 0 });
        });
      }

      syncWordToggleButton();
      rebuildSearchTicker();
      updateTickerVisibility();
      updateCountAttention();

      loadClientFromLS();     // precarga datos
      loadAddressFromLS();    // precarga datos (Santa Marta / Magdalena por defecto)

      await initializeRemoteCatalogConfiguration();
      await loadProducts();
    }

    // Arranque
    init().catch(error=>{
      console.error("No se pudo iniciar el catálogo.", error);
      updateCountTextError("No se pudo iniciar el catálogo. Reintenta más tarde.");
    });

// Detalle auxiliar conservado del bloque clásico original.
const visitorDetails = document.getElementById("visitorDetails");
    visitorDetails?.addEventListener("toggle", () => {
      if (visitorDetails.open) {
        requestAnimationFrame(() => visitorDetails.scrollIntoView({ block:"start" }));
      }
    });
