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
    window.REMOTE_CONTROL_VALUES = window.REMOTE_CONTROL_VALUES || {};

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
        if(!section) continue;
        if(!category && !isDirectProductSection(section)) continue;

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
      const rawCategory = String(row.category || "").trim();
      const category = section === "Regalos para toda ocasión" ? rawCategory : (rawCategory || "General");
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
        if(product?.section === "Regalos para toda ocasión") metaParts.push(String(product.section));
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
    const ROOT_ICON_SVGS = {
      ella: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="156" y="176" width="200" height="220" rx="52" fill="#F7E7EE" stroke="#4A352B" stroke-width="24"/><rect x="208" y="116" width="96" height="70" rx="18" fill="#E3B3C5" stroke="#4A352B" stroke-width="24"/><path d="M232 116V86h48v30" stroke="#4A352B" stroke-width="24"/><path d="M256 236c-37-37-89 5-62 45 19 29 62 45 62 45s43-16 62-45c27-40-25-82-62-45Z" fill="#D982A6" stroke="#D982A6" stroke-width="8"/><path d="M314 134c18-24 43-20 58-6-3 25-21 43-49 43" stroke="#D6A45E" stroke-width="18"/><path d="M324 171c24 4 38 19 41 40-20 12-44 8-58-12" stroke="#D6A45E" stroke-width="18"/></g></svg>`,
      el: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="148" y="184" width="216" height="212" rx="44" fill="#E6EEF4" stroke="#3E4F5E" stroke-width="24"/><rect x="204" y="118" width="104" height="72" rx="16" fill="#B8CAD9" stroke="#3E4F5E" stroke-width="24"/><path d="M228 118V86h56v32" stroke="#3E4F5E" stroke-width="24"/><path d="M256 230l46 46-46 76-46-76 46-46Z" fill="#7094B2" stroke="#3E4F5E" stroke-width="18"/><path d="M211 184l45 46 45-46" stroke="#3E4F5E" stroke-width="18"/></g></svg>`,
      unisex: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M257 385c-62-54-83-104-62-148 17-37 56-54 62-99 7 45 46 62 63 99 20 44-1 94-63 148Z" fill="#DDEEE4" stroke="#496B57" stroke-width="22"/><path d="M234 305c-66 5-110-26-125-78 50-19 100-4 127 40" fill="#EAB4C8" stroke="#7B4E60" stroke-width="20"/><path d="M280 305c66 5 110-26 125-78-50-19-100-4-127 40" fill="#B9D9C4" stroke="#496B57" stroke-width="20"/><circle cx="257" cy="173" r="28" fill="#F3C97A" stroke="#775C2C" stroke-width="16"/></g></svg>`,
      regalos: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="112" y="214" width="288" height="196" rx="28" fill="#F4E4C6" stroke="#5B4334" stroke-width="24"/><rect x="96" y="176" width="320" height="78" rx="24" fill="#E6B45C" stroke="#5B4334" stroke-width="24"/><path d="M256 176v234" stroke="#D66C8D" stroke-width="34"/><path d="M256 176c-6-64-72-82-95-42-23 39 34 55 95 42Z" fill="#E7A2B8" stroke="#7D4A5A" stroke-width="18"/><path d="M256 176c6-64 72-82 95-42 23 39-34 55-95 42Z" fill="#E7A2B8" stroke="#7D4A5A" stroke-width="18"/></g></svg>`,
      otros: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M112 192l144-74 144 74-144 74-144-74Z" fill="#F0E4CF" stroke="#544333" stroke-width="22"/><path d="M112 192v150l144 76 144-76V192" fill="#FAF3E7" stroke="#544333" stroke-width="22"/><path d="M256 266v152" stroke="#544333" stroke-width="22"/><circle cx="194" cy="278" r="28" fill="#D88AA9" stroke="#754B5A" stroke-width="14"/><rect x="294" y="252" width="56" height="56" rx="12" fill="#93B6D2" stroke="#465A6B" stroke-width="14"/><path d="M180 350h54M307 350l28 28M335 350l-28 28" stroke="#C4984A" stroke-width="18"/></g></svg>`
    };

    const ROOT_ICON_IMAGES = {
      ella: "data:image/webp;base64,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",
      el: "data:image/webp;base64,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",
      unisex: "data:image/webp;base64,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",
      regalos: "data:image/webp;base64,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",
      otros: "data:image/webp;base64,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"
    };

    const NAV_AUDIENCES = [
      {
        label:"Para ella",
        section:"Belleza y cuidado",
        subtitle:"Belleza y cuidado seleccionados para ella.",
        iconImage:ROOT_ICON_IMAGES.ella,
        theme:"ella"
      },
      {
        label:"Para él",
        section:"Belleza y cuidado",
        subtitle:"Perfumes, desodorantes y cuidado personal para él.",
        iconImage:ROOT_ICON_IMAGES.el,
        theme:"el"
      },
      {
        label:"Unisex",
        section:"Belleza y cuidado",
        subtitle:"Cuidado para todos, sin repetir etiquetas.",
        iconImage:ROOT_ICON_IMAGES.unisex,
        theme:"unisex"
      },
      {
        label:"Regalos para toda ocasión",
        section:"Regalos para toda ocasión",
        subtitle:"Detalles y arreglos listos para regalar en cualquier ocasión.",
        iconImage:ROOT_ICON_IMAGES.regalos,
        theme:"regalos",
        directProducts:true
      },
      {
        label:"Otros productos",
        section:"Otros productos",
        subtitle:"Tecnología, hogar, juguetes, papelería y más.",
        iconImage:ROOT_ICON_IMAGES.otros,
        theme:"otros"
      }
    ];

    const SUBCATEGORY_ICON_IMAGES = {
      "perfumes": "data:image/webp;base64,UklGRhAOAABXRUJQVlA4WAoAAAAQAAAA/wAA/wAAQUxQSMAAAAABYOS2bST9/9M+TpsORrMnIiaAojnk7GUO/nJRuFBErhGZ9SK0VqQWitYyEVsjcgtE77QInhTFUyJ5QjQPi+hBUT0ksk+I6N4U4Rui/FSI9BMh2k+DiL8JRP0tIPJfANL+b/+3/9v/7f/2f/u//d/+b/+3/98EsccLAO64BWCOmwDeOA2wxomAM04FjLHVF9ttcULgirGmGO2J8ZaY6Yi5hpjth/l2KGmGql6oa4XSRihvgyVNsK4DVj967OUxoyhWUDggKg0AADBNAJ0BKgABAAE+PR6MRKIhoRMZ9KwgA8Syt3C2pwFRbL/LHtT+P+l/psa38tbpH/T/dl8RvWn5hv6o9Q7zJ/s/+4Hu+/7D9qveF/ffUK/tH9w63r0HOlq/s//MYrYCzWxjWvLgnFVVVVVVVVVVVVVVVVVVVUxad8fKynaXzOhWU7Tjt0NHXIBh2ZxfqIjlaLh1mZt1THs/EVpJiTJK6SR4EAzvnTa3KM0DR8z27TtugjCdk7x724RUprIJfTGbafyNFv94RB1fJoxD+PpZbytXd+0c6OxH4o8/WGExJmQHZZUz8cL7vvFry+9b5t3Jk04o/AmFrqHG7747D5T5EdsGEaNuoI0bQzjSUvGqghGySULIdqtXyNUAXKKLTUUy8EdjFyXsWn1aM/RmiAljnV2j3KtDmWBK3WlCux5cTkpuhHRGk37obleY5N5eAcsfF1JwgJlKWaPz9WQIuw3k5MrCC2Rs0Yzij1u+r8HyfW7EGaqSvaw8OlO2RPtmpJwuwlcOEFE0fuixv/9Wc9fKALSAZXBIGRp0leMWpRz1P+0a03+B2gjBYjvEi00XqGpTQ3jfhtZaSCi1x7beusANPoLXT3tkB2wgIsiePsiHzAT7xgeMHfZT9oLnYDtu4iLBlz4/+8epGs4Nr/hx1u/oW6gBEF0uy/fsfO0m7n1Yf2h2n79gV4SF66Az44I1oIPWhw0Y/P6G51wsTva7tYHJQA7G3CNcF0p2S6DGx/UNReLWHaXauevIf+l3NwKJ7aJY6d/3nACqqD//v3mD/EPf9AlwCBXN1YZBw3/LsW3KH8NbORRmfQ3lJvd3d3d3d3d3d20AAP7/ajXZpODSAAADgoAAACWUjV1ZR+aoIDLz6O8XRsI0DvcvQTxGAtMHUGpuPmorod78GqJEzPHLNW0gBGSaTgXFHLfJUZhYGWrzb6z1w6lNCG3pgMsxF24Bdq0a30NOkflfvrlqFmeJHf2SqhDQguBJPuhUJbyVqcesUu6v0jzP+u+rq/E8kOfLkS/g1bxUYxlDmIX8AK7gXEqCO2Q2y7FVKmUfn405WhN7cdbZNB/u78dwDCc8yU6mL8HEJ2jgrLtYpv+dt0DEnvvxlgKVTu2aX0JyqBoj8gzNgVqoP+1GuT/VVIQeNG7XsLR/BYEwYk9APhqXw53DV4MVjJ0pr7I8Ee7D9pfiw4MHlA+eNByMFlmu7ukFhVMYhHAEqbWz0i7FAPkGjMv5h5p4wBQxfsVNW6C9M5HFN7uJdY6MV04EhBxBDx1DD7CsF7qfZj3ssFpvd3Q75KW7ycO3ZXx1yTmINUuvM5RQc4xqeIjHwvEzmB7m5UnywSIae0g/57Fi/BA8+zCZzUfCGQSJY62snt4wH25tBfxy0NORLW/2seNgl8z0bniF64PmSmWsGAjLeBEO/GoG+nM4JokjA5wWHgHq/Udi2VW04eWmmJ+0WkLsiu5c9yz38+hUkeZWAI1Hpu44oWu/wQ24eI2X6cjXEkmFyIA4pLVL7wYrVFeYszjvv/+C9g0rf5c30p2EMIu+mCNqtZDTXcPqzF5Vuxc9fAX4Q05yXJSJp9oJvLeFbyfpwCR+Mbem/sbWx6xkp4mmp+VNBKum/RCpaplyyBHvOkbDu0N0Y5F72JfNKThqiDTtsbiev4jCDw6FQrWEIe0sUpqqK05x4jY2W3D8gocqWxg/kcePycA1BJybWVFMpd59zYxHpGjZOHq4cBc92aBx7V4WWVm+gM0uqoPoNizfDnsMG/IdxSds2HgO6JoD/t4YoTrdTRqIkMe1jyvuz83ZUKBe5mjyAPzwuNW3G+/gg17ZNgggMWUItXjnh/0+590xopliEMJEAtkytyGOlUs8fRwUQFlgexUsf2QQyfm7KQHyZvaGsvjxywgEl32ob/Wxn+2vCjV6KHm5nBsSw588R0IphCeoMhRnllvwSFw2MzrwG0GFCV7ZMLNCrbrV7/qzKH9vR3wN2VV7j/UJbXVUke8TpTAZqMDzGSe9EhssaYszm0GgcPT7Dda4A/nU8Bpt1ypqFKhprRjxql++dBfIg0pQp2FMCHjBvoGjqc32TsylvST+U80Jyx2+FEU68rWXrhvM7+9N+vC0Wug9gIRSieZB7DLSZ7C6U8UL59aTBXfkRPXPxecy+sS89JUlNMQojSHQBZAZYRBNO+oXRJzdro2AMLWpORyhY+MewKf1AkGV2eb1NwByLwWuL0519K0N4QsXt27/q9ruDSyCaa8tRey3gjCBpMHjzjXXxqmyXw89dvrz5H6qg8nwfKh8rYuPcjiL2Nxg/jNNeu9CPVp0OXl72OJJLD6mwq3/1S1qy3YM0gIaa08LXxQkIDLgtOWsTJ3nHaN/9hjcSSi/XSIvJMC1TutkdeLYZcmL45tVA2N/y3cmtZDAgzDZ9w4Y1hLGcLgyITFkW5r2pW9Rf+9QP7EapSlmx6ACLNkFCLQ/U/8S4sTGbdPS9a0SV4BLFC7oMaVjwSfwTTQ2nxAF5J7TBrlsxv6wJCJsdS36dfziIr64/nDIQS/JjNbqcJHf+62qT0iVLOr2wKnIfL0MkMqlCirJYe1VlrpwqSujF0MTeU9XMidet2/0Q6fRKZ6y/toph3nI/C7mC0xESM9WQZRkEIMb5nkDv9rxcN0Op1OZU7d97E1R87eJcC1Ah16+bnUyd8aqZ7DfTkupRD4chheW0vlKafmUGbZQyMRFkn13S+NqyTTkhS52PRJgBD4S0TmrwQ7kvWS7DbjTkyNXltdypm6BVLZxyXovGVRg30Rdlxh8lFqzNrZxMKXtebHpHJlem7pXKRForLnLNTCeb83UqKcDo4yKl3s7BZHwr847lIWoVkO7OSi/OgN45Yl9b0ZY1ui5qjeinLAtrtFQYfP7ZsW//rrefX4Ve/6BnUCcnJZ02m5nOM2UH8tFe6/R7dN5A1rGFSyWZkvFS1UId0hacxvOSpkJS/WU+TbX/jboaDGGmx4luOe0cQo3olwzpSoLlpx6TkFD3fIvVFtJor/VqCESD9jzB6Kg7uOcCbnhTqrUkH/WYoXIx1bBPg5ABL1pUWJXAqtxcqMf7DN3pzagCyjJo9pPB2FGn3VfyAa4gQ3MbwC8hOss7qqe5NOpnFrLsEnwJdZNiYXU7qfJTfC4ExUlHkpMoFXVmRmPsTyiJ9ddqnHUZeByG+RnY2/9u/oYeGfx/XVgr/75d6/sBcmBPZJodZ3qP+jWf9ON54wWgsc7ro3lnRfSfN8ZdwvXIo1IgJiwjhfMrbMeP8M7gm3PMX8lA8OZF4hBkl0kapfM+bIpRhqlV30uESYNSWA87VBQLEvCsxW3rclBCSZBzqRvqnm38kHJvF+ILIF8wceGGZ6j1q9apg8JJFjKs9ECB6WGvR3kCh6mih7lov9VAjj3m4N1pB+ZFb9fSuE+GrcBknzd/UziXStWyjmpggqsX6R9Wxqu1UZTNs0vppgKb3GQFv9vKwwILPInv0HU9EF5RKz01a9Sz1bEjOj3iE8dyAeXSomew638EyyboMEDnlgfRAFmeVVU2j7WbHpMFSpXRpashc97rYlfowjl8NjWNHxFw9qpzb6lSZo6sPVnNDZv+cjqdGWGMD8CjJ+Q4vqDrPuq32T5I0rqMG7p0PLBxL/pz97Oencb2KLU0Dfd0TGwYpyzL+/h031O2zC+Nhmr4v+pfCwbJ3SymHkUU3Gwnukl2d53G01xnRyz9UuTiwLyZ1eYK/IcIwW5/q8chBiV5oHKEl0KRJNiUyuN4+NArP46wucevq93YthCUPmlTVbt8pEA0lBMoA0Ec1G8dhmEdDmh29jqDYRDh/4MsTXsmwZzaT0gI/CRk0AVt1nLUei6u9UpIeiZ1Som8ZAfCBJ+bPdf9efn/qu2d/hbTyKt5Su80TmVQBO4WPmm4t21Y7AeF6wMGqReleue6GmcpHkNVSRsGiIYpUV2POyDb1eLTYLx7++UfykY5meWPrfYKt/cL+KPIdd+6x4/SZ8M4/dRtOGbPVRwViAbqedi4Srr6nard9/csC5s/xhPQdxK7vQTr91B7ZmZaRHcrM0zjZ0cIYRvbe9vpWuOFKk+C52C2Xaujz5lrIPwFpFPvEuRkBVEE2FKDrOMTMCkCJBVqAflv20B1BKoZTSRA40jRK6w9cmxlwKGUMSEl8AmsSa6lv75Sj28nkQpts3SYVr1Azzq8cOt4mvmfiCwPdx8cq5jRE+0TSUViR8r7ECh0BbqATn7Zr5bjkQfEjsRFsNf0MqP1Xvd3Hi8NX5IZ7gDMY3J2BbpndT1PbsX8W0gKsY76pVLwpCHBv7GpnrtWqW/hhytOIHrYotcZ7tP0s8O6YYC7LyOJNC6rbs8EdugSFAQjivkwcgNwDW8+HUZs4h0OPjw85xipQZ6U9R4FLIhAfW3HYhKhQIynJ4kHjopj1gGixMNymtlFLAHmGSJfL+K8EhlE0cba2l7jltvaAHrY8ELooge6/0LaoS1xk9rgAAAAAAAuKAAKV6gAAA=",
      "desodorantes": "data:image/webp;base64,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",
      "cuidado facial": "data:image/webp;base64,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",
      "cuidado corporal": "data:image/webp;base64,UklGRtwOAABXRUJQVlA4WAoAAAAQAAAA/wAA/wAAQUxQSMAAAAABYOS2bST9/9M+TpsORrMnIiaAojnk7GUO/nJRuFBErhGZ9SK0VqQWitYyEVsjcgtE77QInhTFUyJ5QjQPi+hBUT0ksk+I6N4U4Rui/FSI9BMh2k+DiL8JRP0tIPJfANL+b/+3/9v/7f/2f/u//d/+b/+3/98EsccLAO64BWCOmwDeOA2wxomAM04FjLHVF9ttcULgirGmGO2J8ZaY6Yi5hpjth/l2KGmGql6oa4XSRihvgyVNsK4DVj967OUxoyhWUDgg9g0AAFBRAJ0BKgABAAE+PR6NRKIhoSKnEOjoUAeJZ278RoaCRfqDu463CvOqbgbzIecT6Zf9Lvz+9WVrzmDPbfLXPk+OXa7/zfEMgA/MP57/yfCs/UPxA95e49/wH5YesB/gPI6849gX+Ofzn/W/b18j3/D50fqT/ie4h/I/5n/pP7vwj/6qkUHQvpx8c+rijRaQWcOhfTdUTYKz+iZ2C/pxMI68ts89+pydd0nW2JfzBMkXGZhSU/MDF2C6n854FY8LHh63uvefVAHRX3NaeRLnN9c4BSPvTIZPtcj76M2ZZ2deW8rbMDomn797VtOl9o6ohZdP19uDx9NLxJVEsaFIxQWZF2sSJY0TrmwQ+j1DXrBypTAUf153SDJkpq8gE19YRIQakPBVETVOFJe2K+fIPBwp/H7C/c0BMTnwAsi2FQu7uvxzxh6o9yGb7XOsYYlPbOvGhej7xTijIm2nSwcSW4OOCIEBQRSYPDLuzEhyMVKXnxl797q/2JTKhhK+U+I9t5fijy9NQR/iptbk/RdS4orSGG0YT1McKfdk+LYH5xlfevcA+tm+UWrTzFaDPLaSKWnWEhAgN7Z2z5ypssys4YbUL/Ol5+1Rx0RmUCIkQzTx8L1sgB+RGSx5ueMf5jC5Y3T0LwgJqHAUPdydyOl3AhQR57Iofo/2qGwFouytae/pd+DQ8gudnopCyvdJHOVEOEuKlHMT+eGo2avbKPYQpmJTkElQqWKDkKbjpverUgByk7nodIPdUqAK+pwJ8E7LWTFFkUMFanLYHV/3CLIUsVNZ7z9jXSfWpJOEoPbSlvXolbfZ6rEh4xvAUUWhVlVj1EZMBdKYhbBQBuYEfAqkGlZpbdlQR8dIkZzY59XFGi0gs4WgAP7913TYHSHAAAANkgAAAABm3jmgBoWaIPHLJIApO//rcXsSy+YcisfkZ+dyiuh3yUbt+A5YerHcfvlNCzWsP+Z7a+bKsyKEkigIP/UXChs6IeOCuMB6pbq4K8mGtkfLo+K+ubp0hm3/fCl/EedHJzaRtwBKtitIxaUfuw1g7QxroXxuCiYHfguppZgl5TCqeAMXNnxcgMYPZ8nsgPGFBCDKjFvl/AFdAXf9/cQMllbzsbC4x8y8a6aDpglg/52/98bkbot/icR/RW/7ZtsdpyJeVAEtIKrpRCU/Wc0j9nBIcVw54HoOdqLCQIb+gX/gDkGvE9wxMNrQm6+vFgvgXJ/3NjCOf5yy24oDTMcxpHNS6tiorBVLq6aa7RqqIdkMyF2dAI6mutFwu7Xyl80f8TmCX9OcmGW1CESILMGJmtDcY0t8VtEviRFBipLOQqKzPjW87ntbXOCsYxptj95Tv8uxThu719VdBVyYN8DFlFgIG+LDoV0puLiXnEaB3Nxi5CcwWjon0Je57mKfC+FYeBymYKUVFFEBf331Mty1YU4BE+413iR52FbN49kvz8UYRGrx55wmzbsdVPNV9mI8ON47RLUuHulGpQuS2BdiRVw7cCMeoCjFXBpqOXVcC9XFjtm+/bUjaUyblnLKsNeTBJoIafqPNMiF+RR35p1KtS2cEyw/lFRzBQ+D00szOiqamaeKWrCPaVDo2WQUuqkun6Tle0vEDSoU91/D24KtQ7ya5PF//CsWc2kYmRWM0tr4EzANQU8ZfhUAnchzRhGKU97PiD7f8J1PaCg1VtSt40N0dIbN6Ri0CuTSfqKbCdmse4Sy89JNbInmcaQv+gdrrZnIJ1uTIplTVxLK2Zb8RA5yep4Y5I1NV4OdnEqI0J7GAjw8mGU0JDS5K6LwPPcOtIoJPh7zgZKrUj75do3xtCS65GAZJeUoyI5v1Tz/Jk70yFPAy3SE9sR+8e64owuGwVHYNUtM4bwlBW5QIUwmi42nJMNsNr7SR2A7sWpGKBbXyiD5RCovm1nD7aq12FZy2+XYl6V2i6T8xJCaa2x7qwVr/tFptV1TJh/gRSw6YLbAUUASFt9C3tB3CnsAmdyv+b4ft4PN6CeqfM1u3iu2mrbvg1d+7FA56kQrUlUSsEP/d3g45J3hpGu1WsaUBnSWCcTh2K6vqC0nNzpQbtVe9t3olqWjDUidfgtDL+gUODUs9v149GGoy3PBYfpeHYvBkWA9nTP0VRC8hPRcT7eawQu2w9tRTr/YzFVVnJ3hXTQaa5wxgQgJQ0yjkIeKbdfxDelkxsz46Yf1WbaoobLvRA1pTqi9k/GNTt/R7ZtF3K4ehBmFFkRoZs0QLjbZWs3VAhQxzVKQJY5UKyw+FCaj2w3fHFYZxhLq4sQptQm2nKPeZPn0Xd51BpmgDCZoWrvY/d+cRHLmAamOD+sZ/+IekTSN/gM42z/dsPOI2Lx9MO/6b/RFzaF17X2t7XHv0ti6VnW/sse5mHGjDNLc0uiR/z/MuhnzNk6yPVDe125NtByqh61ey/+TBSrL3iFcZjFr7caBqfXlr141btfZGtBCUFkQaw1AxCD+4KpfD6iV/yVdsZwgnFUIuyXSoZSrDsIwLBt7lh0L+55blWdceNe1ao4y+0s5gLr+jU9USyc/O7tcHgzwtuurM06wxhhZxJyfzCSWMS5Iqab3lqMHvH22MozjrelchYKXrWO5aaAZR+V1Lf7r09URi2tvLeLb9hgDwn1R73EhRvVJ/fM0y9he9RHVmi6NIMW5YBLdaSaV2exxbiBZOwXZqT7fEqkxGev1VN4jDynmmC5mNGryphfy/KpK5LgWtXXYkPsS68v1skhsT8zbJ9/ED4kvDUa7Si3DOjuszhIKBUhU8P9QsHLhIT0H52T72KQpHQO3q+/HveNLKiXWquRPynBfnY6BWMnFgn5PYL1h4Sao/olL5XH5+ktM+Y8wupGX20VTBU59UrVpdguLD4/uhZS+KdapvRYn+GVOJc29yg0tcVgMpjK9deaBqOAoSHAuFUmhoIvNlvXApEOCqGVCFw3oKjzcV2JkTcd6pjiDCn47L2iE7uh3xpJZ4PB44s23W6+r7/Pv4hmVBESQxMcPfMbA5wUkAODzOid87P+mqgCZkn956TbYtkE8yWrX89I8wZmsHCSDnEd1k/EwQPvxqKQx7DF0a34wjZrvFGoWygWQLJ9D/mYs/O2f6yTXfuTMvL+Y8RH5bXH0A4mUsDG992Enj0/esckzmITGyLIVjDFpe6E+WXWQ7DXz3h3+Z2CnJQJEtwK/ZvugiY0vFi1LFcqKbp1S5CMf/+fNYvZT18onqShFZlj8x+Aj+/WmyoFTLGH9I9OvJZD9NnmUNSos3WBwA/XmhhfSxrj3veoEHQBE239hP0u/xYa1KXWMlGQytUbU5ZKo9x0oOmmdanpLwd2RsVUTy9+/kKxSa3LgzW5hcKn86NuinIj9wwzbNYhAWJApvoUhK+pgbchP9VWoFsou9yjSnXd0rgoU1QgIrw41yw9Z4IoFNvGYFdWwVvZRPQvgkG/32mAOb2nAy+LhTlyM5nw0eHaLmvnDwMly2MxLXgafpNekBC0GyhvxmrRiZISExUg17Cr+jcwaf036zcPEz+/9v4g9u9TXxP/YqyrjCYlcpRSGPNAD0IviM5Cxh7F7wS+oP6uD4UhILOO14Hc+cGsoHJomzwuvZH3iS/xNQsVYNSDshogtemzwUA2UpmQk3W+cqiP68novTRFflOch1tHRSvBVSnE0WUPJvWtgRIRjzrqeGXxmEmpVw/b55htrM/7f3LKRXEC+0V1ecyuvLIAKQzCSDDaugvHFtB/fw2vYQfYBFgL7dG9FLw1O8mfoRYCqy4QMgn8lIL7MS6C6vVcNxb8C5BUHa+VtXgP6OVLonNXidrNjJSXCGQ/0eFOmsrIJp5AkDU/KbKTj8W9p84KuHXDdFRttvBVbs5qkGt7LGkjH4CSORde3Lv6E2MXC1dxFv5h9lZPY2ila0LfqkgOdZnZXgN7a9tO3+VMySxpePVfnMaRWBTvjSa/yEOg4/f/6fDItGBfCjpCqLYH7H/mFHzcIxp7nZ0o5zQHYgYHqSw/uwNPuvkLGiAtck/aisEDC938TTaJGQxCsavLN5EVt4iZKCOSD800fyPSsa4xwmlEX/eoLplCWWT5n20UserfHJu16OV4jyUg2zf7jhQZoDrrwNPohJXXv2s/O9rMB3usCFuXYs0gLw8TAPO9m6F4XhK9PZNmOtvgOFFB05XSHsysCPKlyCt17XHUkHkYohfv8wNuBvm+Ax4Fa0kNU4fR/KPnhe0hEiPpSWSfh8HYfREKBXmMSzjJPRlBtBA2knVQMHmAJq+jIEk8rvl9yWoza7oenur1e5onTefivDG1Pam/4669dkL36VPAvf2xZs7MZZQ4GTCPlTE106yZvX7wpY6M00+JMPyocMo5hhaz8T7+L14k1yA64S/OR2qZbaUSqBHk7zC7pbGrl3COdg2xN+TJ7i8/xJ6WL9EliythmnM9mqJ3B+iCk1W8mNKPCru0HpWuKMWpT2PNhWUjEqKDysSa5/47Q8QUwlxBP6SC/2JnUMF9R/CBVuSdFCDhZVe9WzfzbfpDl1x5T//GncMWe7aFjhBSbo4WYTAR+mIlYtnfL2g1/TbhL5ccoS7ZO5d8AqCaRUvitY6n3/Nh/q8Ii8RtwKQFqshPcIUHLKEjXnsox/0y4DEV19FfB7+UX5Bw/lDT3uPdAEcBBVKy0D6iXZt0RDiDx4gmu5wfm1LBk7UkrIU6SqrDa1UpGHKGmqE4Md0R7KL+ZXFyYUz9Les6fpPtZxqimWV3b+Guw0po+H4OgGg/P3HwAAAAAAAAVkAAAFn0AAAA=",
      "cabello": "data:image/webp;base64,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",
      "manos y pies": "data:image/webp;base64,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",
      "higiene corporal": "data:image/webp;base64,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",
      "higiene intima": "data:image/webp;base64,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",
      "proteccion solar": "data:image/webp;base64,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",
      "kits y combos": "data:image/webp;base64,UklGRqoSAABXRUJQVlA4WAoAAAAQAAAA/wAA/wAAQUxQSMAAAAABYOS2bST9/9M+TpsORrMnIiaAojnk7GUO/nJRuFBErhGZ9SK0VqQWitYyEVsjcgtE77QInhTFUyJ5QjQPi+hBUT0ksk+I6N4U4Rui/FSI9BMh2k+DiL8JRP0tIPJfANL+b/+3/9v/7f/2f/u//d/+b/+3/98EsccLAO64BWCOmwDeOA2wxomAM04FjLHVF9ttcULgirGmGO2J8ZaY6Yi5hpjth/l2KGmGql6oa4XSRihvgyVNsK4DVj967OUxoyhWUDggxBEAALBZAJ0BKgABAAE+PRyMRCIhoZTrLNggA8Sxt2EoA0gcGkAcm/G86vHs7x8T+zvxm7F807o7znf471sfeZ6svTe8zH80/0X7c+7t6QfQA/n3+v62T0PPLq9n392v2U9sfMiOsvzFqCN+786vGn5WZI/9HtTMl/9g/4fIL2yHJK+a+fj/XeqL/x/lH7bPzz/Z/9n3D/5F/R/9d+df+I5Cj9NzHiGvjVK2xDXxqlbYhr41StsQif0IAGHKvar1qdKfOlyQJSwmpFz4Yk5H6DKY/Q443EypIcqHZutWXk2zbugcH+vb6z+TyWqqssf/P9OBqMIZ1PTSAQqi31A5jl8VdA9GOp5E3o3nVfqWAUGxUjdzqxmzgnzT7AVnYMcq3NziwMYlu41eR9fD4YT0QSM1gp3OqTlD/YU7XYnPJJcmDmmPXkNw+kXjhbF3wmSxQI8txP/8W8zydVrRK1d7LMJYSRYxxLODc4HinS++S3IRsVJr8wp/w7OlGc73fMLUm8V8+y5FupHkKDs7afq/oHb8erzC6amlja48Ij/4mkJ/DAUknlZppMsOBtlaXgON+MroxRohEpl4Z8GWMBu4WbK0mc0VhoKefQ3z4gHhztCHCICVzxQLSMBrMuS8w7XBYGfh5souHDN4/3sxt6djkP0C3r2VFj36Eugh8OtoU36jYpuDDgNH0kouvnCClwxTI+tr6mIQLNUx6Rt/mwFrutoHUrFH6YCJc3sjSSKNbgPbochi3bXHpmYBp/7bl4+cTgEGjK/kOGfGBpy4KtOa5e5FX8PkNMfCFltkFWFRLqZYYKW2fte2g3IuUIW3W8LiR0zOnKFDZGiiLaDknHwrFm8Q4RHpAgDhH4lITwMVwC8WeuP66vFjIinHZ6RTtjJq3/PJ4+XrpKM2oJ+HMB+gczoMB/pIZiCvgGiHMWo59ciZdlxT+TpuGUK3h7fPZO+ZdRr41StsQ18OAAD+/iUMFviuGAAAAP4gAAAAF35HcjWrvt46AYUaEHiRL/AiiRZXQQ7KvSdvOP9/ByHhNOQ7ovU3ddqHtY4MZ//xhJpnNnaN2RX/P+/4KtK05UHj/nUT2H668pSSM3Z8oRoKT2HMA1LgOJuXAJpZHAeQV7/1RZ1E3bZqzaiqxLp/FIeSKxyBwEMkwaCCsqCF28Yz5k64o7QnLP+SU9DSJmUXwPGJJO9WADHpyUlOxoDGuN9wmDq0GsfDr/tscRJ4IJLSWFal6bb5xUwo6Wa05Ttt//r8f609Udp3W9hqg08VscSg2HbVSPCennSGzg1ji9v+Nu86ZNR/vXlMZ+Wf8lBA8jF5lUaWieokUYOYZehGg2qPUmCPuo7ciYSYvHTUhJMnX2ZmdYUvBBTvX9XyCHDdyTyUYX4EF2wxyPBh1HyOV+Aj3CfajPA1bUjk0LBpqsMUrG+MpMMJpZ3MaMiQGjBVHtswKTILnaUAQGA9tP2uyCOnWH2DkuPK1kboehiYiR9KQNZ1+rUfiY/Jm4h2Uq0NfDaO4JQxQNWNaOrwn98R55+wLvnsNN8EkwS3+nQOsIEkZrnwtgAjUHMFw98hF25ZESbmt/6AYJgiEgiecg4oy1kEZ+2KWfjrSYTqdKXcB9vqahmd4VrSXPKl9cTzta8GBARCaGTaDEqpZ6daajAeFU3/IoaigprBKC/om724Dp2tUbZ/dbSHXMSeWbgS7wou9HDZYiJXrviTwJ7DSTDKJuuEdd+x+KhICV9KVHDbQG0MWYDglhKKeDuiGGIHe3Sc0+xUyoZAreA64z1LEaKI5aQ9oxF4GrH4dBAqJS2JQm9+R4WyqxCt0wsa2Ziwwlox3F/LSBR1WVQEphqbwE1zfZeaKExw9BqC+/ZtS+IgiDH3e7Lik+xfidEgXg3jOk7TVtEoLWq5ie92m6zFbENdfg41y1UYmkwt3nO8Pkb6x1Ln7ygRPgVpnqaOhcQInZfIPUNOjXR6s7j4eoYmYeMlsU0j66D14w/i0xvpYRGjx16DFiffNqNTLeQyZKXHLTY8xqOaOMD5Dfm9ICUc9yz0ynlHXwVyf/VpmrleEgg8QCyU9aMmShU8rV54Q5LuUJnK7pdsb8fHFhac2+xmM2MGrLnsJDfJ6u/hGzYKONkwbO60nWZogHKX5z9hGeqM7JqtsRdP7CoxdaGKojZTUf1PmJs5naIL/8G+Sl0MUKXp/9vULT8ZgCf7a7DY4F955SLW5eRNndjSwx88KTsD8Gx5DCmWK6nXKUZkHHV6CVrVSYChV2e2hHN+pqDickEXcPtRh88gPkdD6L+/Av9obQUx0svWJG0pwRg8YIcINBZUAakgbijA6/2Cy2wr5XXtHzYnrCA++NNwwzDItXqieuMw381xo4Sf9uZuG10iRHxMmwS+W9GYxVEaMQ3As6Udwm81OKP4BGo3YFXLqWZPGZY0RK2x2Y7L3A1xc5tyH6oY+dt5/erq/JA5qh9JT/PKPU4R4AdtVvFhUIfUa8ixEn/aXWnJHcg5g9/085UvJf+CX20bYLvKilgRllR/7EYAzujquPYsLk801RZKc+0xNL47lr6ivc1wda+b0BAqNXiZ9NXRuaHrlPWpK1cxPHLZJm+qpaaIw24mKtY1TlrYIiKRte3B5SKyTcb7cBy5Kdhl/uqtO+vJsPJ/P8oOHtjZ2XNt8wQKQDNgapIQiGifEx8CHEWIuIL1EnQ9+lv44On6Nm77u3BvCh5A5Wm8SsQDHWzvQ272PupO/+em5HD1fPx7juPRzK66c1ukfB4F2sjrNrh7NmxvV9C6xciRKNlYQXGYM38si1kf3E3sqgpU4aukj1c6UZ+dPQ+P4w1sZDpoOUf64uYVkH9vQ47zTWbalPP+WtII3hNEcb5cSSt1ioK9iAJ373lpneP1kwW7QlPL1O74ZX8p9Huolw6I6T3u5yhaYdmNdSfdOPX/ngFsR2PpT49MAkys7dUY0Kq0z3eD8w0tHM8KqVokLsku8Jge6FrgrQZ2yryN62h2FBoe0SnA+yvjd0S8IiFLJtQTugNNtLuJj4kVZZj4g3UzTxGQ39/LV7vP+Mkb5pqjQYS8FQHwlhjzoBw1yWVRrpAnqWkZqbFV8lzO+DE2RQVUWJ/sqqLroioKBA3Fv6P6Qg8sQ549ABDDir/7+RlWdosyRb0+rSzIrAsImqqFFvUvhxtTfQfjwlc4j4cAROJGcKy4lRX08DG13pbMcIt3Y9NcFGBoy2V86B/TmhRLeNBKB1cOqe1dQfzSRHC8mwJ+lWykWnmnLJsG7vtqIoGW0d3sRxFDFQL8lcqgdFtpGbXAk8g3UASbDI86o0CzYAHLiPFEw9+e/dQrUJyMsb7hJX7lQphyQlxjx5fmLC3PU0KtJtDJvevAuVm2/glsILYvic7C8JgHQm35C9n2XF0hA4epDynNhVa5/JeAmTA8A+HuxXiefKiy6gXdVkiby8bqSgzsgzYU77gsxCLXhdG48ww9CfSwt/6pnLWMy5/2VKjg8qxVwoZdNya2IkpeSg/a3YGTGazofVoyqR+SDxjPRcsR3OSAlKgg5UtlQZB3y5tEhZ6dtZ+DG4EPEc9kkztuFWbKa9bTApaLKdkBX0rXZdxCTiGrs1A76PnuxcM1kMDEol2P/Kivy1jv/euAmIEcTovmT9EHbvMfVESFRoYYd6E6g7eHNldKb/mvrva1tS0q7ORTvvKIB5Tdz9Ci9DXeOxLCLTSmFGkOxM52slzal6FEYPLLdJoSBeeLMt63nrqULB5j4CjnXSFegVNfTSfFxiJzchSQk+iiF3aXJagqhcAB70pJXkb+Z3UZBLVJtk8Q36b+nuZrwETJVQ9l3ZXoV5yc0U7wNX4IzPhLewpfGAHDJ2r0RiJ3OMQPpnbb+4S0bbPNoeC/TcZKUnTiWKltndQPCIDaT39UJ9H05cM7JasSjy+8TKCu81dv2HcYPk8xQfS4KIEvCJZj54ljN9+uRTsUDCTNzorZrwRG7w3cSiBY75K7xmoZoz9UiI/v8//clN3ki+bfTg8IbH3+F47+0R+R6wpdsb6bQ7xd46Ckioz+y1LCTILpzvZunr/bEB+9ZwNV/1gla3/O/umuD1MkVzxSI/szF60Gu+dilWKSW0bkJxgtr/64VjzNQOFSziT85S5M5itnGGjHdBiFYkumKzSSUQ1g0a8vnHFTwryq/1aOsgf7zGxjKA1RoDPlaut6mjIFvy0FtgBuzqn/irmDWkKzG7eSeVdjAUGdVedvKtPVTVdQte8qpDh+tipjc2OmRLWoXvRv92Am0kSVcLEXIpQJMus8sLSzKwoftLUIXr+l76rrAlGqJsJiQMCi3Txwjydn2Y/h+UmMK+FDkSPXkg80xl/9RKhLxK44rk7jFBTrjmC31GUnxhYDF81ly/vwPMJyhq9LY25auXNMjQzjnp3qmKZE4fNBCY43JkWHjn4SXNn/HoOB9XsWXA/wMTZMZ8RlmVTRjgfY8ApPeI5APQSTkSwb+FzzmFHprRuXGBXOATrMB5SEHJ2XaT7u8CoI/hDfnsQoGyvVtTAedOqNsSGOo5bf66/ci8INcBRbTIFDIGHilVSlDZ6DBbDubGZngdyiCeVd3mqJ3qrXIwbx16v49nFEMw02XZwHfy6R2IGtXUteJswkbAinzqG9Ul+jvsxJPT7NbYy5pbbptnACSUdMPWyZzR+9VQyLbwdikXmZArMQZdDWcOtE+V+GHMaSvaOi3XADavlgdH70Qj3yz8+9Ki4EfabGep+zYiIJYkE8clmkvC48hS02yFiDTa0WURFwq0/2p5keo2nhSGVb0V4NvWKM3ZTeKIKaylXhEQ4Fo1xzylYx1S1xP7cPCqo3dJZaynTZNRgD5TBYM8hbzaf3zYKGm9bAhYrwGmRhR2/A2bsr90LfPeF46C2FVbv2iyeZfzU/aJ4DnG9XWMfntyg5laYwbvnG0BF3ZFxFRj0H/PFUwsr7Umix+K5q7ir96NEkZ+7ju8YMjl9E/vsiVll3fV9sN6RRp17FHjOe5wmtBSUijrFLQmrpWkJeoIElNxjtKdpb4QtKIyBTgnyh0PeWhckyUNSipc+arxlxzt5AOccbHhsSiEIaxLi/L6yW4ODXBV8nV6PzKnX0Mfwi9MmcADSHkcpqKiNRnFU6LTtvePWlretxoG30LFakjHJ7PxDwljLY4swjalFkEuOTmkubgH+UPQsW2v/BAroy9MJa9KGopuPLy0U+TomKaMdmMV3CKmgNKr5XZhMUty5kjbxFeDYRU/xURqaanWn+/Eng2vo+ipQOgW+b1mR0VqTt6/pJt2gvzp23dWOqS92kdX1TktGvDbaiTq/GaymS/q9dKQB85s4Tp6i13VRAWhpLy10LkFKnwj8ebD8FAu8O4F4FQdwA+ncWW+yBpIYmYFqlWFqiHmQ+SDcjqjr00ZSljtJlUacBMqP6bGajfNqvwIhQyP0lK0HtN3g28tSG+ALeQ/4qseJs/E9CosANeEXsixoxzBzg+n1SZmDp8VB4DQfqjflp+S92ZvZ0c4zrHajGjSTqX/DWlHc8MZKixTrRj80rsvsDYFFNgX1fSkhlFw6+yD2Ysy6aOhxDZwsMNw45Pi63wU7AqMRt53gF2XAxNV8IMrQwNh2sEviBt1f2B4bqY32voPyEv9tK50VxtRoWL8TwC5vbBCXq76ZCGUhnN9f+hg5f9o8YlAlNtta3+VbhqFeBe6d/qk2WsdcqsO8t/++ctdjHuVstr8ONhOvBbyifQneIMILWoexty/vGFBkK6/QKYAGNPtW0jGB7ni7EDFZG1mpCyn5VwS/krmohrsr/vVWkcKqw2MmQ9TnUZoXygnXMIjq20o/olAc6JkAyeUodbqv+zws2+qJ3XvdrhdEqa3B7XweDzbS+1dpdGQa8RwRgtAFVfLhSupLU/wLunC5xcb22lWurRQ+3caSrBp0MZn9HGv5EXY7rVGJotLY29K3mDpnvywLVT/HeuBlXblmxZzVszeQ4KU4b2HiJBzohc/2R4Om6/Lw45PF7f9sWlB4fvKGEFkMu00rYH7Lva0XPHQEn6w5ZM6vgdCOs0iDEATKAAGa1wAAAAZxAAAAAAA==",
      "maquillaje": "data:image/webp;base64,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",
      "tecnologia y hogar": "data:image/webp;base64,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",
      "juguetes": "data:image/webp;base64,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",
      "papeleria": "data:image/webp;base64,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",
      "medicamentos": "data:image/webp;base64,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"
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
      "regalos": { icon:"🎁" }
    };

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
      const group = NAV_AUDIENCES.find(item => cleanNavKey(item.label) === cleanNavKey(audienceLabel));
      if(!group) return false;
      if(group.section === "Belleza y cuidado"){
        return p.section === group.section && p.audience === group.label;
      }
      return p.section === group.section;
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
        const category = String(p.category || "General").trim() || "General";
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
      // Mientras no se haya abierto una categoría concreta, el buscador conserva
      // la navegación por tarjetas y solo recalcula los contadores de cada grupo.
      // Las secciones principales marcadas como directProducts muestran sus productos
      // inmediatamente, sin crear un nivel adicional de subcategorías.
      return albumModeEnabled() && !selectedCategory && !isDirectProductAudience(selectedAudience);
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
            "category":p.section === "Regalos para toda ocasión"
              ? p.section
              : [p.audience, p.category].filter(Boolean).join(" > "),
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
      if(p.section === "Regalos para toda ocasión") parts.push(p.section);
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
          meta.textContent = matchCount > 0
            ? `${sampleText}${moreText}`
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
        if(album.iconImage){
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
        const label = !selectedAudience ? "Secciones principales" : (directSelected ? "Productos" : (!selectedCategory ? "Categorías" : "Productos"));
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
            : "Elige Para ella, Para él, Unisex, Regalos para toda ocasión u Otros productos para comenzar.";
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
      selectedCategory = selectedAudience && category && !isDirectProductAudience(selectedAudience) ? category : "";
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
