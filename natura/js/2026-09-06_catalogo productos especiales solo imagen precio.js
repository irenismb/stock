// Lógica principal del catálogo público.

// ==========================================
    // AJUSTES LOCALES Y CONFIGURACIÓN GLOBAL
    // ==========================================
    // Los valores locales funcionan como respaldo.
    // Si existen las hojas "Configuracion" y "Categorias" en el Google Sheet,
    // sus valores se aplican globalmente a todos los visitantes.

    // Fuente principal de datos comerciales del catálogo: Google Sheet oficial.
    // Los productos especiales pueden obtener su precio directamente del nombre de la imagen.
    // Hoja Productos, estructura A:M: Código, Sección, Público, Categoría, Condición, Estado comercial, Nombre, Precio, Costo, Stock, Referencia externa, Descripción y Código Natura.
    const GOOGLE_SHEET_SOURCE = {
      spreadsheetId: "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs",
      sheetName: "Productos",
      gid: "893686273"
    };

    // Control global remoto. Las hojas deben estar en el mismo archivo de Google Sheets.
    // Configuracion: A=Control, B=Estado, C=Qué hace, D=Recomendación, E=Clave técnica.
    // Categorias: A=Sección, B=Público, C=Categoría, D=Estado comercial, E=Ocultar del catálogo, F=Excluir de búsquedas, G=Nota.
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

    // Productos especiales que no existen en Google Sheets.
    // PRECIO_NOMBRE.ext aporta precio y nombre en MAYÚSCULAS.
    // Si no cumple la estructura, el archivo especial se muestra únicamente como imagen.
    // Esta lista queda disponible solo como respaldo manual opcional.
    const PRODUCTOS_SOLO_IMAGEN_PRECIO = [
      // { imagen: "regalos amor y amistad/65000_producto.webp", precio: 65000, nombre: "PRODUCTO" }
    ];
    window.PRODUCTOS_SOLO_IMAGEN_PRECIO = PRODUCTOS_SOLO_IMAGEN_PRECIO;

	const INTERRUPTORES = {
	  MOSTRAR_CANTIDAD_STOCK: false,
	  MOSTRAR_TEXTO_ESTADO_STOCK: false,
	  MOSTRAR_PRECIOS_PRODUCTO: true,
	  MOSTRAR_CODIGOS_PRODUCTO: true,
	  ENVIAR_CODIGOS_PRODUCTO_WHATSAPP: true,
	  HABILITAR_UBICACION_GPS: true,
	  HABILITAR_NOTIFICACIONES_TELEGRAM: true,
	  APLICAR_LIMITES_STOCK: false,
	  MOSTRAR_IMAGENES_PRODUCTO: true,
	  IMAGEN_SUPLENTE_PRODUCTO: "suplente.webp",

	  // Muestra u oculta los archivos especiales que no tienen fila en Productos.
	  // PRECIO_NOMBRE aporta datos; otros nombres se muestran únicamente como imagen.
	  MOSTRAR_ARCHIVOS_SIN_PARAMETROS: false,

	  // Si los archivos especiales están visibles, muestra el nombre solo cuando
	  // existe después del guion bajo en la estructura PRECIO_NOMBRE.
	  MOSTRAR_NOMBRES_ARCHIVOS_SIN_PARAMETROS: false,

	  // Control independiente para mostrar u ocultar el precio de archivos especiales.
	  // No depende del control general de precios de los productos del Google Sheet.
	  MOSTRAR_PRECIOS_ARCHIVOS_ESPECIALES: true,

	  PERMITIR_TOGGLE_PALABRAS_SUGERIDAS: true,
	  PALABRAS_SUGERIDAS_INICIAN_VISIBLES: false,
	  APLICAR_ALBUMES_OCULTOS: true,
	  APLICAR_EXCLUSION_ALBUMES_EN_BUSQUEDA: true
    };
    window.INTERRUPTORES = INTERRUPTORES;
    const REMOTE_BOOLEAN_CONTROL_KEYS = new Set(
      Object.keys(INTERRUPTORES).filter(key => typeof INTERRUPTORES[key] === "boolean")
    );

    const ALBUMES_OCULTOS_SEGUROS = [
      "Otros productos||Medicamentos|A la venta",
      "Otros productos||Tecnología y hogar|No a la venta"
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
          ? value.map(item => String(item || "").trim()).filter(Boolean)
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
    function shouldShowFilesWithoutParameters(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_ARCHIVOS_SIN_PARAMETROS === true);
    }
    function isFileWithoutSheetParameters(product){
      return !!(product && (product.isUnstructured || product.isImagePriceOnly));
    }
    function shouldAllowSuggestionToggle(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.PERMITIR_TOGGLE_PALABRAS_SUGERIDAS !== false);
    }
    function shouldShowSuggestionsInitially(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.PALABRAS_SUGERIDAS_INICIAN_VISIBLES === true);
    }
    const _hasIdle = ("requestIdleCallback" in window);
    function runIdle(fn, timeout=1200){
      if(_hasIdle) return requestIdleCallback(fn, { timeout });
      return setTimeout(fn, Math.min(250, timeout));
    }
	
	function shouldShowUnstructuredFileNames(){
	  return !!(
		window.INTERRUPTORES &&
		window.INTERRUPTORES.MOSTRAR_NOMBRES_ARCHIVOS_SIN_PARAMETROS !== false
	  );
	}

    function shouldShowSpecialFilePrices(){
      return !!(
        window.INTERRUPTORES &&
        window.INTERRUPTORES.MOSTRAR_PRECIOS_ARCHIVOS_ESPECIALES !== false
      );
    }

    const WHATSAPP_NUMBER = "573042088961";

    const LOGOS_DIR = "logos";

    const fmtCOP = new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 });

    const SITE_BASE = new URL("./", document.baseURI).href;

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
        "para ella": "Para ella",
        "para el": "Para él",
        "unisex": "Unisex",
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
        "medicamentos": "Medicamentos",
        "regalos": "Regalos"
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
    function baseOf(filename){
      const s = String(filename || "");
      const i = s.lastIndexOf(".");
      return (i < 0) ? s : s.slice(0, i);
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
    const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_CATALOG_SOURCE.owner}/${GITHUB_CATALOG_SOURCE.repo}/${encodeURIComponent(GITHUB_CATALOG_SOURCE.branch)}`;
    const PRODUCT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

    function googleSheetQueryUrl(callbackName){
      const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(GOOGLE_SHEET_SOURCE.spreadsheetId)}/gviz/tq`;
      const query = new URLSearchParams({
        sheet: GOOGLE_SHEET_SOURCE.sheetName,
        headers: "1",
        range: "A:M",
        tq: "select A,B,C,D,E,F,G,H,I,J,K,L,M",
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
            let code = cellValue(c[0]).trim();
            if(/^\d{1,4}$/.test(code)) code = code.padStart(4, "0");

            return {
              code,
              section: cellValue(c[1]).trim(),
              audience: cellValue(c[2]).trim(),
              category: cellValue(c[3]).trim(),
              condition: cellValue(c[4]).trim(),
              commercialState: cellValue(c[5]).trim(),
              name: cellValue(c[6]).trim(),
              priceText: cellValue(c[7]).trim(),
              costText: cellValue(c[8]).trim(),
              stockText: cellValue(c[9]).trim(),
              referenceExternal: cellValue(c[10]).trim(),
              description: cellValue(c[11]).trim(),
              codeNatura: cellValue(c[12]).trim(),
              fullTxtRecord: [
                cellValue(c[6]).trim(),
                "",
                `Precio: ${cellValue(c[7]).trim()} Costo: ${cellValue(c[8]).trim()} Stock: ${cellValue(c[9]).trim()} Referencia externa: ${cellValue(c[10]).trim()}. ${cellValue(c[11]).trim()}`
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
        const state = parseRemoteBoolean(row?.[1]);
        const key = String(row?.[4] || "").trim().toUpperCase();
        if(state === null || !REMOTE_BOOLEAN_CONTROL_KEYS.has(key)) continue;
        if(INTERRUPTORES[key] !== state){
          INTERRUPTORES[key] = state;
          changed = true;
        }
      }
      return changed;
    }

    function routeKeyFromParts(section, audience, category, commercialState){
      return [section, audience, category, commercialState]
        .map(value => normalizeText(value).replace(/\s+/g, " "))
        .join("|");
    }

    function applyRemoteCategoryRows(rows){
      const hidden = [];
      const excluded = [];
      let validRows = 0;

      for(const row of (Array.isArray(rows) ? rows : [])){
        const section = String(row?.[0] || "").trim();
        const audience = String(row?.[1] || "").trim();
        const category = String(row?.[2] || "").trim();
        const commercialState = String(row?.[3] || "").trim();
        if(!section || !category) continue;

        const hiddenState = parseRemoteBoolean(row?.[4]);
        const excludedState = parseRemoteBoolean(row?.[5]);
        if(hiddenState === null && excludedState === null) continue;

        validRows++;
        const routeKey = routeKeyFromParts(section, audience, category, commercialState);
        if(hiddenState === true) hidden.push(routeKey);
        if(excludedState === true) excluded.push(routeKey);
      }

      if(validRows === 0){
        console.info("La hoja Categorias no devolvió rutas válidas; se conserva la configuración anterior.");
        return false;
      }

      const previousHidden = JSON.stringify(window.ALBUMES_OCULTOS || []);
      const previousExcluded = JSON.stringify(window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA || []);

      window.ALBUMES_OCULTOS = hidden;
      window.ALBUMES_EXCLUIDOS_EN_BUSQUEDA = excluded;
      saveRemoteCategoryCache(hidden, excluded);

      return previousHidden !== JSON.stringify(hidden) ||
             previousExcluded !== JSON.stringify(excluded);
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
          "A:G",
          "select A,B,C,D,E,F,G",
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
        wordSuggestionsVisible = shouldAllowSuggestionToggle() && shouldShowSuggestionsInitially();
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

    async function fetchGitHubJson(url){
      const controller = new AbortController();
      const timer = setTimeout(()=>controller.abort(), GOOGLE_SHEET_QUERY_TIMEOUT_MS);
      try{
        const response = await fetch(url, {
          cache:"no-store",
          signal:controller.signal,
          headers:{ "Accept":"application/vnd.github+json" }
        });
        if(!response.ok) throw new Error(`GitHub respondió ${response.status} al consultar las imágenes.`);
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    }

    function encodeRepoPath(path){
      return String(path || "")
        .split("/")
        .filter(Boolean)
        .map(segment => encodeURIComponent(segment))
        .join("/");
    }

    function rawGitHubUrl(path){
      return `${GITHUB_RAW_BASE}/${encodeRepoPath(path)}`;
    }

    function extractGlobalProductCode(filename){
      const name = String(filename || "").trim();
      const match = name.match(/^(\d{4})(?=$|[_.\s-])/);
      return match ? match[1] : "";
    }

    function parseImagePriceProductFilename(filename){
      const stem = String(filename || "").replace(/\.[^.]+$/, "").trim();
      if(!stem) return null;

      const separatorIndex = stem.indexOf("_");
      if(separatorIndex <= 0 || separatorIndex >= stem.length - 1) return null;

      const rawPrice = stem.slice(0, separatorIndex).trim();
      const rawName = stem.slice(separatorIndex + 1).trim();
      if(!rawName) return null;

      const normalizedPrice = rawPrice
        .replace(/^\$\s*/, "")
        .replace(/[.\s]/g, "");

      if(!/^[1-9]\d{0,8}$/.test(normalizedPrice)) return null;

      const price = Number(normalizedPrice);
      if(!Number.isSafeInteger(price) || price <= 0 || price > 9999999) return null;

      const name = rawName
        .replace(/_+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleUpperCase("es-CO");

      if(!name) return null;
      return { price, name };
    }

    function extractImagePriceFromFilename(filename){
      return parseImagePriceProductFilename(filename)?.price ?? null;
    }

    function extractImageProductNameFromFilename(filename){
      return parseImagePriceProductFilename(filename)?.name || "";
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

    async function loadGitHubImageIndex(){
      try{
        const ref = encodeURIComponent(GITHUB_CATALOG_SOURCE.branch);
        const catalogDir = encodeRepoPath(GITHUB_CATALOG_SOURCE.catalogDir);
        const parentUrl = `${GITHUB_API_BASE}/contents/${catalogDir}?ref=${ref}`;
        const parentEntries = await fetchGitHubJson(parentUrl);
        if(!Array.isArray(parentEntries)) return [];

        const productsEntry = parentEntries.find(entry =>
          entry && entry.type === "dir" &&
          String(entry.name || "").toLowerCase() === GITHUB_CATALOG_SOURCE.productsFolder.toLowerCase()
        );
        if(!productsEntry || !productsEntry.sha) return [];

        const treeUrl = `${GITHUB_API_BASE}/git/trees/${encodeURIComponent(productsEntry.sha)}?recursive=1`;
        const treePayload = await fetchGitHubJson(treeUrl);
        if(!treePayload || !Array.isArray(treePayload.tree) || treePayload.truncated) return [];

        return treePayload.tree.filter(entry => {
          if(!entry || entry.type !== "blob") return false;
          const filename = String(entry.path || "").split("/").pop() || "";
          return PRODUCT_IMAGE_EXTENSIONS.has(extensionOfFilename(filename));
        });
      }catch(err){
        console.warn("No se pudo construir el índice de imágenes de GitHub; se usarán imágenes suplentes.", err);
        return [];
      }
    }

    async function loadGoogleSheetCatalog(){
      const [rows, imageEntries] = await Promise.all([
        loadGoogleSheetRows(),
        loadGitHubImageIndex()
      ]);

      const sheetCodes = new Set(
        rows.map(row => String(row && row.code || "").trim()).filter(Boolean)
      );
      const imagesByCode = new Map();
      const imagePriceOnlyItems = [];
      const foldersWithSheetProducts = new Set();
      const entries = Array.isArray(imageEntries) ? imageEntries : [];

      for(const entry of entries){
        const relativePath = String(entry && entry.path || "");
        const filename = relativePath.split("/").pop() || "";
        if(!relativePath || !filename) continue;

        const code = extractGlobalProductCode(filename);
        if(!code || !sheetCodes.has(code)) continue;

        const list = imagesByCode.get(code) || [];
        list.push(entry);
        imagesByCode.set(code, list);

        const folder = normalizeText(relativePath.split("/")[0] || "").replace(/\s+/g, " ");
        if(folder) foldersWithSheetProducts.add(folder);
      }

      for(const entry of entries){
        const relativePath = String(entry && entry.path || "");
        const filename = relativePath.split("/").pop() || "";
        if(!relativePath || !filename) continue;

        const code = extractGlobalProductCode(filename);
        if(code && sheetCodes.has(code)) continue;

        const folder = normalizeText(relativePath.split("/")[0] || "").replace(/\s+/g, " ");
        const parsed = parseImagePriceProductFilename(filename);

        if(parsed){
          imagePriceOnlyItems.push({
            imagen: relativePath,
            precio: parsed.price,
            nombre: parsed.name,
            tieneParametrosEspeciales: true
          });
          continue;
        }

        // En carpetas que no contienen productos vinculados al Sheet,
        // un archivo sin PRECIO_NOMBRE sigue siendo publicable como imagen sola.
        if(folder && !foldersWithSheetProducts.has(folder)){
          imagePriceOnlyItems.push({
            imagen: relativePath,
            precio: null,
            nombre: "",
            tieneParametrosEspeciales: false
          });
        }
      }

      for(const [code, entries] of imagesByCode){
        imagesByCode.set(code, orderProductImageEntries(entries));
      }

      imagePriceOnlyItems.sort((a,b)=>
        String(a.imagen || "").localeCompare(String(b.imagen || ""), "es", { numeric:true, sensitivity:"base" })
      );

      return {
        sheetEntries: rows.map(row => ({ row, imageIndex:imagesByCode })),
        imagePriceOnlyItems
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
      const audience = String(row.audience || "").trim();
      const category = String(row.category || "General").trim() || "General";
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
        const fullImagePath = `${GITHUB_CATALOG_SOURCE.catalogDir}/${GITHUB_CATALOG_SOURCE.productsFolder}/${imageRelativePath}`;
        return rawGitHubUrl(fullImagePath);
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
        audience,
        category,
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
        isUnstructured: false,
        originalFilename: "",
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
        searchKey: normalizeText([code, name, section, audience, category, condition, row.description, row.referenceExternal].filter(Boolean).join(" "))
      };
    }


    function makeImagePriceOnlyProduct(item, index){
      const imageRelativePath = String(item && item.imagen || "").trim().replace(/^\/+/, "");
      if(!imageRelativePath) return null;

      const filename = imageRelativePath.split("/").pop() || "";
      const parsedFromFilename = parseImagePriceProductFilename(filename);
      const configuredPrice = parseOptionalWholeNumber(item && item.precio);
      const price = configuredPrice ?? parsedFromFilename?.price ?? null;
      const configuredName = String(item && item.nombre || "").trim();
      const name = (configuredName || parsedFromFilename?.name || "")
        .replace(/_+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleUpperCase("es-CO");
      const hasSpecialParameters = Boolean(name) && price !== null;

      const pathParts = imageRelativePath.split("/").filter(Boolean);
      const category = categoryDisplayLabel(pathParts.length > 1 ? pathParts[0] : "General") || "General";
      const fullImagePath = `${GITHUB_CATALOG_SOURCE.catalogDir}/${GITHUB_CATALOG_SOURCE.productsFolder}/${imageRelativePath}`;
      const imageUrl = rawGitHubUrl(fullImagePath);
      const internalId = `imagen-precio-${index + 1}-${normalizeText(imageRelativePath).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

      return {
        id: internalId,
        name,
        category,
        brand: "",
        price: price ?? 0,
        hasPrice: price !== null,
        hasSpecialParameters,
        cost: null,
        costText: "",
        stock: null,
        referenceExternal: "",
        codeNatura: "",
        isUnstructured: false,
        isImagePriceOnly: true,
        originalFilename: imageRelativePath.split("/").pop() || "",
        srcFilename: imageRelativePath,
        imgFilename: imageRelativePath,
        fileExt: extensionOfFilename(imageRelativePath) || "webp",
        hasImage: true,
        isDocumentFirst: false,
        description: "",
        fullTxtRecord: "",
        docsImageUrl: imageUrl,
        imageUrls: [imageUrl],
        docsDocumentUrl: "",
        searchKey: normalizeText([name, category, imageRelativePath].join(" "))
      };
    }


    function clearLegacyProductCaches(){
      return;
    }

    function updateCatalogFooterProducts(products){
      const list = document.getElementById("beautyProductsList");
      const count = document.querySelector(".beauty-products-count");
      const source = Array.isArray(products) ? products : [];
      const namedProducts = source.filter(product =>
        product && !product.isImagePriceOnly && String(product.name || "").trim()
      );

      if(count){
        count.textContent = `${namedProducts.length} ${namedProducts.length === 1 ? "producto" : "productos"}`;
      }
      if(!list) return;

      const sorted = source.slice().sort((a,b)=>
        String(a?.section || "").localeCompare(String(b?.section || ""), "es", { sensitivity:"base" }) ||
        String(a?.audience || "").localeCompare(String(b?.audience || ""), "es", { sensitivity:"base" }) ||
        String(a?.category || "").localeCompare(String(b?.category || ""), "es", { sensitivity:"base" }) ||
        String(a?.name || "").localeCompare(String(b?.name || ""), "es", { sensitivity:"base" })
      );
      const fragment = document.createDocumentFragment();
      for(const product of sorted){
        if(product?.isImagePriceOnly) continue;
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
        if(product?.section === "Belleza y cuidado" && product?.audience) metaParts.push(String(product.audience));
        if(product?.category) metaParts.push(String(product.category));
        if(product?.id) metaParts.push(`Código ${product.id}`);
        if(product?.hasPrice !== false && Number(product?.price) >= 0) metaParts.push(fmtCOP.format(Number(product.price)));
        if(Number.isInteger(product?.stock) && product.stock >= 0) metaParts.push(product.stock > 0 ? "Disponible" : "Sin stock");
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
    const NAV_AUDIENCES = [
      { label:"Para ella", section:"Belleza y cuidado", subtitle:"Belleza y cuidado" },
      { label:"Para él", section:"Belleza y cuidado", subtitle:"Belleza y cuidado" },
      { label:"Unisex", section:"Belleza y cuidado", subtitle:"Belleza y cuidado" },
      { label:"Otros productos", section:"Otros productos", subtitle:"Hogar, regalos y más" }
    ];

    let albums = [];
    let albumByKey = new Map();
    let selectedAudience = "";
    let selectedCategory = "";
    let selectedAlbumKey = "";
    let hiddenAlbumNameSet = new Set(getHiddenAlbumNames());
    let searchExcludedAlbumNameSet = new Set(getSearchExcludedAlbumNames());

    function cleanNavKey(value){
      return normalizeText(value).replace(/\s+/g, " ");
    }

    function getProductRouteKey(p){
      if(!p || p.isUnstructured || p.isImagePriceOnly) return "";
      return routeKeyFromParts(p.section, p.audience, p.category, p.commercialState);
    }

    function isProductHiddenByRoute(p){
      const key = getProductRouteKey(p);
      return Boolean(key && hiddenAlbumNameSet.has(key));
    }

    function isProductExcludedFromSearchByRoute(p){
      const key = getProductRouteKey(p);
      return Boolean(key && searchExcludedAlbumNameSet.has(key));
    }

    function productMatchesAudience(p, audienceLabel){
      if(!p || p.isUnstructured || p.isImagePriceOnly) return false;
      if(audienceLabel === "Otros productos") return p.section === "Otros productos";
      return p.section === "Belleza y cuidado" && p.audience === audienceLabel;
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
        if(!products.length) continue;
        const album = {
          key:`audience::${cleanNavKey(group.label)}`,
          navType:"audience",
          navValue:group.label,
          label:group.label,
          subtitle:group.subtitle,
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
        const category = String(p.category || "General").trim() || "General";
        const key = cleanNavKey(category);
        const found = byCategory.get(key) || {
          key:`category::${cleanNavKey(audienceLabel)}::${key}`,
          navType:"category",
          navValue:category,
          audience:audienceLabel,
          label:categoryDisplayLabel(category),
          subtitle:"",
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

    function buildAlbums(list){
      return selectedAudience ? buildCategoryAlbums(list, selectedAudience) : buildRootAlbums(list);
    }

    function refreshNavigationAlbums(){
      if(selectedCategory){
        albums = [];
        albumByKey = new Map();
        selectedAlbumKey = `category::${cleanNavKey(selectedAudience)}::${cleanNavKey(selectedCategory)}`;
        return;
      }
      albums = buildAlbums(all);
      albumByKey = new Map(albums.map(album => [album.key, album]));
      selectedAlbumKey = selectedAudience ? `audience::${cleanNavKey(selectedAudience)}` : "";
    }

    function getProductAlbumKey(p){
      return cleanNavKey((p && p.category) || "General") || ROOT_ALBUM_KEY;
    }

    function albumLabelFromKey(key){
      const found = albumByKey.get(String(key || ""));
      if(found) return found.label;
      if(key === ROOT_ALBUM_KEY) return "General";
      return categoryDisplayLabel(key);
    }

    function filterVisibleProducts(list){
      const baseList = Array.isArray(list) ? list : [];
      const manualFiltered = shouldShowFilesWithoutParameters()
        ? baseList.slice()
        : baseList.filter(p => !isFileWithoutSheetParameters(p));

      return manualFiltered.filter(p => {
        if(isFileWithoutSheetParameters(p)) return true;
        if(cleanNavKey(p.commercialState) === "no a la venta") return false;
        return !isProductHiddenByRoute(p);
      });
    }

    function filterSearchExcludedProducts(list){
      const source = Array.isArray(list) ? list : [];
      if(!shouldApplySearchAlbumExclusions()) return source.slice();

      return source.filter(p => {
        if(isFileWithoutSheetParameters(p)) return true;
        return !isProductExcludedFromSearchByRoute(p);
      });
    }

    function hasAlbumFolders(){
      return all.length > 0;
    }

    function albumModeEnabled(){
      return hasAlbumFolders();
    }

    function shouldShowAlbumGrid(){
      return albumModeEnabled() && !selectedCategory && getCombinedWordTerms().length === 0;
    }

    function getSelectedAlbum(){
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
        source = source.filter(p => cleanNavKey(p.category) === cleanNavKey(selectedCategory));
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
      try{
        const actual = new URL(window.location.href);
        const utm = String(actual.searchParams.get("utm_source") || "").trim();
        if(utm) return utm;

        const ref = String(document.referrer || "").trim();
        if(!ref) return "Directo";

        const host = new URL(ref).hostname.replace(/^www\./i, "");
        if(!host || host === window.location.hostname) return "Directo";
        return host;
      }catch(_){
        return "Directo";
      }
    }

    window.obtenerContextoVisitaCatalogo = async function(){
      const detalle = await obtenerDetalleDispositivoVisita();
      try{
        const album = getSelectedAlbum();
        const items = cartItemsArray();
        const primerProducto = items[0]?.name || "";
        return {
          dispositivo: detalle.resumen,
          marca: detalle.marca,
          modelo: detalle.modelo,
          origen: resumenOrigenVisita(),
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
          origen: resumenOrigenVisita(),
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
        if(!p || p.isUnstructured || p.isImagePriceOnly){
          delete cart[key];
          changed = true;
          continue;
        }

        const maxStock = Number.isFinite(p.stock) ? p.stock : 0;
        const qty = Math.max(0, safeInt(it.qty, 0));

        const newQty = enforce
          ? ((maxStock > 0) ? Math.min(qty, maxStock) : 0)
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
      return items.map(it => {
        const codePart = includeCode ? ` (Id: ${it.id})` : "";
        if(it.hasPrice === false){
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
	  const hasUnpricedItems = cartHasUnpricedItems();

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
      const hasUnpricedItems = items.some(it => it && it.hasPrice === false);
      cartTotalEl.textContent = hasUnpricedItems ? "Total: Por confirmar" : ("Total: " + fmtCOP.format(total));

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
        cartMetaParts.push(it.hasPrice === false ? "Precio: Por confirmar" : `Precio: ${fmtCOP.format(Number(it.price)||0)}`);
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
        const maxStock = Number.isFinite(it.stock) ? it.stock : 0;

        if(incBtn){
          incBtn.disabled = enforce ? (!(maxStock > 0) || (Number(it.qty)||0) >= maxStock) : false;
        }

        const subtotal = document.createElement("div");
        subtotal.className = "cart-subtotal";
        subtotal.textContent = it.hasPrice === false
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

      const maxStock = Number.isFinite(current.stock) ? current.stock : 0;
      let newQty = safeInt(current.qty, 0);

      if(act === "inc"){
        if(!enforce){
          newQty += 1;
        }else{
          if(maxStock > 0 && newQty < maxStock) newQty += 1;
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

      saveCart();
      renderCartModal();
    });

    function openWhatsAppTo(toDigits, text){
      const msg = String(text || "").trim() || "Hola, quiero información del catálogo.";
      window.open(waLinkTo(toDigits, msg), "_blank", "noopener");
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

          try{
            await registerOrderInSheet();
          }catch(err){
            console.error("No se pudo registrar el pedido en Google Sheets:", err);
          }

          // El mensaje SIEMPRE se envía al número de la tienda
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
        const source = (Array.isArray(all) ? all : []).filter(p => p && !p.isImagePriceOnly && !p.isUnstructured);
        const itemListElement = source.map((p,index)=>{
          const item = {
            "@type":"Product",
            "name":String(p.name || ""),
            "description":String(p.description || ""),
            "category":[p.audience, p.category].filter(Boolean).join(" > "),
            "sku":String(p.id || "")
          };
          if(p.docsImageUrl) item.image = [p.docsImageUrl];
          if(p.brand) item.brand = { "@type":"Brand", "name":p.brand };
          if(p.codeNatura) item.mpn = p.codeNatura;
          if(p.hasPrice !== false && Number(p.price) > 0){
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
            <h3 class="album-label"></h3>
            <p class="album-meta"></p>
          </div>
        </button>
      </article>
    `;

    function stockMetaText(p){
      if(p && (p.isUnstructured || p.isImagePriceOnly)){
        return "";
      }

      const hasKnownStock = Number.isInteger(p.stock) && p.stock >= 0;
      const stockVal = hasKnownStock ? p.stock : 0;
      let stockPart = "";
      if (INTERRUPTORES.MOSTRAR_CANTIDAD_STOCK){
        stockPart = hasKnownStock ? ` · Stock: ${stockVal}` : " · Stock: Por confirmar";
      } else if (INTERRUPTORES.MOSTRAR_TEXTO_ESTADO_STOCK){
        stockPart = hasKnownStock
          ? ` · ${stockVal > 0 ? "Disponible" : "Sin stock"}`
          : " · Disponibilidad por confirmar";
      }
      const parts = [];
      if(p.section === "Belleza y cuidado" && p.audience) parts.push(p.audience);
      if(p.category) parts.push(p.category);
      if(p.brand) parts.push(p.brand);
      if(shouldShowProductCodes()) parts.push(`Id: ${p.id}`);
      const base = parts.filter(Boolean).join(" · ");
      return `${base}${stockPart}`;
    }

    function refreshCardUI(card, p){
      const row = card.querySelector(".row");
      const actions = card.querySelector(".actions");
      const meta = card.querySelector(".meta");

      if(p && p.isUnstructured){
        if(meta) meta.hidden = true;
        if(row) row.hidden = true;
        if(actions) actions.hidden = true;
        return;
      }

      if(p && p.isImagePriceOnly){
        if(meta) meta.hidden = true;
        if(row) row.hidden = false;
        if(actions) actions.hidden = true;
        const qtyPill = card.querySelector('[data-role="qty"]');
        if(qtyPill) qtyPill.hidden = true;
        return;
      }

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

      const maxStock = Number.isFinite(p.stock) ? p.stock : 0;
      const canAdd = !enforce ? true : ((maxStock > 0) && (q < maxStock));

      if(incBtn){
        incBtn.disabled = !canAdd;
        incBtn.classList.toggle("in-cart", q > 0);
        if(enforce && maxStock <= 0){
          incBtn.textContent = INTERRUPTORES.MOSTRAR_TEXTO_ESTADO_STOCK ? "Sin stock" : "Agregar";
        }else{
          incBtn.textContent = "Agregar";
        }
      }
    }

    function makeCard(p){
      const card = cardTemplate.content.firstElementChild.cloneNode(true);
      card.id = "p-" + encodeURIComponent(String(p.id));
      card.dataset.id = String(p.id);
      card.classList.toggle("is-unstructured", !!(p && p.isUnstructured));
      card.classList.toggle("is-image-price-only", !!(p && p.isImagePriceOnly));

      const imgBox = card.querySelector(".img");
      imgBox.appendChild(makeImgFromFilename(p.imgFilename, p.name, p.docsImageUrl));

	  const rawFileName = String(p.name || baseOf(p.originalFilename || "") || "");

	 const visibleName = (p && p.isImagePriceOnly)
	   ? (shouldShowUnstructuredFileNames()
	      ? (String(p.name || "").trim()
	         ? String(p.name || "").toLocaleUpperCase("es-CO")
	         : String(p.originalFilename || "").trim())
	      : "")
	   : ((p && p.isUnstructured)
	      ? (shouldShowUnstructuredFileNames() ? rawFileName : "")
	      : String(p.name || ""));
	   
      const nameEl = card.querySelector(".name");
      const metaEl = card.querySelector(".meta");
      const descriptionEl = card.querySelector(".description");
      const priceEl = card.querySelector(".price");
      const rowEl = card.querySelector(".row");
      const actionsEl = card.querySelector(".actions");

      nameEl.textContent = visibleName;
      nameEl.title = visibleName;
      metaEl.textContent = stockMetaText(p);
      descriptionEl.textContent = String((p && p.description) || "").trim();
      descriptionEl.hidden = !descriptionEl.textContent;
      card.classList.toggle("has-long-description", descriptionEl.textContent.length > 900);
      priceEl.textContent = (p && p.isUnstructured)
        ? ""
        : ((p && p.isImagePriceOnly)
          ? (shouldShowSpecialFilePrices() && p.hasPrice !== false ? fmtCOP.format(p.price) : "")
          : (shouldShowProductPrices() ? (p.hasPrice === false ? "Consultar precio" : fmtCOP.format(p.price)) : ""));

      if(p && p.isImagePriceOnly){
        if(nameEl && !visibleName) nameEl.remove();
        if(actionsEl) actionsEl.remove();
        if(metaEl) metaEl.remove();
        if(descriptionEl) descriptionEl.remove();
        const qtyPill = rowEl && rowEl.querySelector('[data-role="qty"]');
        if(qtyPill) qtyPill.remove();
        if(rowEl && (!shouldShowSpecialFilePrices() || p.hasPrice === false)) rowEl.remove();
      }

      if(p && p.isUnstructured){
        if(actionsEl) actionsEl.remove();
        if(rowEl) rowEl.remove();
        if(metaEl) metaEl.remove();
        if(descriptionEl) descriptionEl.remove();
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
        .filter(source => /^https?:\/\//i.test(source));
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
      const label = card.querySelector(".album-label");
      const meta = card.querySelector(".album-meta");
      const unitLabel = album.count === 1 ? "producto" : "productos";

      card.classList.toggle("album-root-card", album.navType === "audience");
      btn.dataset.albumOpen = album.key;
      btn.dataset.navType = album.navType || "category";
      btn.setAttribute("aria-label", album.navType === "audience" ? `Abrir ${album.label}` : `Abrir categoría ${album.label}`);
      btn.title = `${album.label} · ${album.count} ${unitLabel}`;

      const previewSource = album.previewImages && album.previewImages.length
        ? album.previewImages
        : "";

      preview.appendChild(makeAlbumPreview(previewSource, album.label));
      label.textContent = album.label;
      meta.textContent = album.subtitle
        ? `${album.subtitle} · ${album.count} ${unitLabel}`
        : `${album.count} ${unitLabel}`;

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

    let wordSuggestionsVisible = shouldAllowSuggestionToggle() && shouldShowSuggestionsInitially();

    function syncWordToggleButton(){
      if(!toggleWordPanelBtn) return;

      const canToggle = shouldAllowSuggestionToggle();
      const isVisible = canToggle && wordSuggestionsVisible;

      toggleWordPanelBtn.hidden = !canToggle;
      toggleWordPanelBtn.disabled = !canToggle;
      toggleWordPanelBtn.textContent = isVisible ? "Ocultar palabras" : "Mostrar palabras";
      toggleWordPanelBtn.setAttribute("aria-pressed", isVisible ? "true" : "false");
      toggleWordPanelBtn.classList.toggle("is-active", isVisible);
    }

    function setWordSuggestionsVisible(nextValue){
      const canToggle = shouldAllowSuggestionToggle();
      wordSuggestionsVisible = canToggle && !!nextValue;

      if(!wordSuggestionsVisible){
        selectedSuggestionTerms = [];
      }

      syncWordToggleButton();
    }

    function toggleWordSuggestionsVisible(){
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
        for(const token of parseSuggestionTokens(p && p.audience ? p.audience : "")) blocked.add(token);
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
        albumBackBtn.textContent = selectedCategory ? `← Volver a ${selectedAudience}` : "← Volver al inicio";
      }
      placeResponsiveHeaderMeta();
      if(albumPath){
        albumPath.textContent = selectedAudience
          ? (selectedCategory ? `${selectedAudience} › ${selectedCategory}` : selectedAudience)
          : "";
      }
      if(qInp){
        qInp.placeholder = selectedAudience
          ? `🔍 Buscar dentro de ${selectedCategory || selectedAudience}...`
          : "🔍 Busca aquí por nombre del producto...";
        qInp.setAttribute("aria-label", selectedAudience ? `Buscar dentro de ${selectedCategory || selectedAudience}` : "Buscar producto por nombre");
      }
      if(grid){
        grid.classList.toggle("album-grid-mode", showAlbumGrid);
        grid.classList.toggle("root-nav-mode", showAlbumGrid && !selectedAudience);
        const label = !selectedAudience ? "Secciones principales" : (!selectedCategory ? "Categorías" : "Productos");
        grid.setAttribute("aria-label", showAlbumGrid ? label : "Productos");
      }
      if(catalogEntryIntro){
        const hasTerms = getCombinedWordTerms().length > 0;
        catalogEntryIntro.hidden = hasTerms || !!selectedCategory;
        if(catalogEntryTitle){
          catalogEntryTitle.textContent = selectedAudience || "¿Qué estás buscando?";
        }
        if(catalogEntryText){
          catalogEntryText.textContent = selectedAudience
            ? "Elige una categoría para ver los productos disponibles."
            : "Elige Para ella, Para él, Unisex u Otros productos para comenzar.";
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
      const tags = (u.searchParams.get("tags") || "").trim();

      if(qInp) qInp.value = q || "";
      selectedSuggestionTerms = wordSuggestionsVisible ? uniqueTerms(tags ? tags.split(",") : []) : [];
      const validAudience = NAV_AUDIENCES.find(item => cleanNavKey(item.label) === cleanNavKey(audience));
      selectedAudience = validAudience ? validAudience.label : "";
      selectedCategory = selectedAudience && category ? category : "";
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
      }else if(target.navType === "category"){
        selectedAudience = target.audience || selectedAudience;
        selectedCategory = target.navValue;
      }
      if(!opts.keepFilters) resetDiscoveryFilters();
      refreshNavigationAlbums();
      refreshFilterOptionsForScope();
      render();
    }

    function closeAlbum(opts={}){
      if(selectedCategory){
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
        const aWithoutSheet = isFileWithoutSheetParameters(a);
        const bWithoutSheet = isFileWithoutSheetParameters(b);
        if(aWithoutSheet !== bWithoutSheet) return aWithoutSheet ? 1 : -1;

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
      let filtered = albums.slice();

      if(terms.length){
        filtered = filtered.filter(album => terms.every(t => album.searchKey.includes(t)));
      }

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
        if(countEl){
          countEl.textContent = !selectedAudience
            ? `${filteredAlbums.length} ${filteredAlbums.length === 1 ? "opción" : "opciones"}`
            : `${filteredAlbums.length} categor${filteredAlbums.length === 1 ? "ía" : "ías"}`;
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

      const filtered = buildFilteredList();

      if(countEl){
        const onlyUnstructured = filtered.length > 0 && filtered.every(isFileWithoutSheetParameters);
        countEl.textContent = `${filtered.length} ${onlyUnstructured ? (filtered.length === 1 ? "archivo" : "archivos") : (filtered.length === 1 ? "producto" : "productos")}`;
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
          if(key) openAlbum(key);
          return;
        }

        const btn = e.target.closest("button[data-act]");
        if(!btn) return;
        const card = e.target.closest(".card");
        if(!card) return;
        const id = card.dataset.id;
        if(!id) return;

        const p = productById.get(String(id));
        if(!p || p.isUnstructured || p.isImagePriceOnly) return;

        const act = btn.getAttribute("data-act");
        const enforce = shouldEnforceStockLimits();
        const maxStock = Number.isFinite(p.stock) ? p.stock : 0;

        const currentQty = safeInt(cart[id]?.qty, 0);

        let newQty = currentQty;

        if(act === "inc"){
          if(!enforce){
            newQty = currentQty + 1;
          }else{
            if(maxStock > 0 && currentQty < maxStock){
              newQty = currentQty + 1;
            }else{
              newQty = currentQty;
            }
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

      await warmupPlaceholderOnce();

      try{
        const catalogSource = await loadGoogleSheetCatalog();
        const products = catalogSource.sheetEntries
          .map(makeProductFromGoogleSheet)
          .filter(Boolean);

        const imagePriceItemsByPath = new Map();
        for(const item of (catalogSource.imagePriceOnlyItems || [])){
          const path = String(item && item.imagen || "").trim().replace(/^\/+/, "");
          if(path) imagePriceItemsByPath.set(normalizeText(path), item);
        }
        for(const item of PRODUCTOS_SOLO_IMAGEN_PRECIO){
          const path = String(item && item.imagen || "").trim().replace(/^\/+/, "");
          if(path) imagePriceItemsByPath.set(normalizeText(path), item);
        }

        const imagePriceOnlyProducts = Array.from(imagePriceItemsByPath.values())
          .map(makeImagePriceOnlyProduct)
          .filter(Boolean);

        if(!products.length && !imagePriceOnlyProducts.length){
          throw new Error("No se encontraron productos válidos para mostrar.");
        }

        allLoadedProducts = [...products, ...imagePriceOnlyProducts];

        hiddenAlbumNameSet = new Set(getHiddenAlbumNames());
        searchExcludedAlbumNameSet = new Set(getSearchExcludedAlbumNames());
        all = filterVisibleProducts(allLoadedProducts);
        productById = new Map(all.map(p => [String(p.id), p]));
        readStateFromUrl();
        if(selectedCategory){
          const hasCategory = all.some(p => productMatchesAudience(p, selectedAudience) && cleanNavKey(p.category) === cleanNavKey(selectedCategory));
          if(!hasCategory) selectedCategory = "";
        }
        refreshNavigationAlbums();

        updateCatalogFooterProducts(all);
        scheduleJsonLdUpdate();
        refreshFilterOptionsForScope();
        sanitizeCartWithStock();
        render();
      }catch(err){
        console.error(err);
        updateCountTextError("No se pudieron cargar los productos desde el Google Sheet oficial. Reintenta más tarde.");
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
          closeAlbum();
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
