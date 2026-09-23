// Lógica principal del catálogo público.

// ==========================================
    // AJUSTES LOCALES Y CONFIGURACIÓN GLOBAL
    // ==========================================
    // Los valores locales funcionan como respaldo.
    // La hoja "Configuracion" conserva únicamente los controles que siguen siendo editables.

    // Fuente principal de datos comerciales del catálogo: Google Sheet oficial.
    // Las imágenes se relacionan por el código interno global de cuatro dígitos.
    // Hoja Productos, estructura A:N: Código, Sección, Categoría, Subcategoría, Familia olfativa, Condición, Nombre, Precio, Costo, Stock, Referencia externa, Descripción, Código Natura y Línea.
    const GOOGLE_SHEET_SOURCE = {
      spreadsheetId: "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs",
      sheetName: "Productos",
      gid: "893686273"
    };

    // Configuración pública remota. Se guarda en Propiedades del Apps Script
    // administrativo y no depende de que exista una pestaña Configuracion.
    const REMOTE_CONFIG_ENDPOINT = String(window.PRECIOS_ADMIN_CONFIG?.endpoint || "").trim();
    const REMOTE_CONTROL_SOURCE = {
      enabled: /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(REMOTE_CONFIG_ENDPOINT),
      endpoint: REMOTE_CONFIG_ENDPOINT,
      refreshMs: 60000
    };
    window.REMOTE_CONTROL_SOURCE = REMOTE_CONTROL_SOURCE;

    // GitHub Pages se conserva únicamente para recursos web fijos del sitio (logos, iconos y archivos publicados).
    // Las imágenes dinámicas de productos y regalos NO se obtienen de GitHub.
    const GITHUB_CATALOG_SOURCE = {
      owner: "irenismb",
      repo: "stock",
      branch: "main",
      catalogDir: "natura"
    };

    // Servicio público vigente que indexa directamente la carpeta productos de Google Drive.
    // Devuelve products, gifts y assets con id, name y url para cada imagen.
    const APPS_SCRIPT_IMAGE_SOURCE = {
      endpoint: "https://script.google.com/macros/s/AKfycbzuHYa9Uf_5v5-FhDXQFu6WRuW49DgxJLUHrm_tq1Vdk539VZjeQeGrlWWqgJj4SzMg2w/exec",
      cacheKey: "irenismb_apps_script_image_index_v1",
      timeoutMs: 25000
    };

    // Galería visual exclusiva de "Regalos para toda ocasión".
    // Vive en la subcarpeta regalos de Google Drive y se sirve mediante el mismo Apps Script.
    const GIFT_IMAGE_SOURCE = {
      section: "Regalos para toda ocasión"
    };

	const INTERRUPTORES = {
	  MOSTRAR_CANTIDAD_STOCK: false,
	  MOSTRAR_PRECIOS_PRODUCTO: true,
	  MOSTRAR_SPRE: false,
	  MOSTRAR_FOLLETO: false,
	  IMAGEN_SUPLENTE_PRODUCTO: "suplente.webp"
    };
    window.INTERRUPTORES = INTERRUPTORES;
    const REMOTE_BOOLEAN_CONTROL_KEYS = new Set([
      "MOSTRAR_CANTIDAD_STOCK",
      "MOSTRAR_PRECIOS_PRODUCTO",
      "MOSTRAR_SPRE",
      "MOSTRAR_FOLLETO"
    ]);
    const REMOTE_CONTROL_DEFAULTS = Object.freeze({
      REGISTRAR_VISITAS_PROPIAS: "DESACTIVADO",
      MOSTRAR_CANTIDAD_STOCK: "DESACTIVADO",
      MOSTRAR_PRECIOS_PRODUCTO: "ACTIVADO",
      MOSTRAR_SPRE: "DESACTIVADO",
      MOSTRAR_FOLLETO: "DESACTIVADO"
    });
    window.REMOTE_CONTROL_VALUES = window.REMOTE_CONTROL_VALUES || {};
    for(const [key, value] of Object.entries(REMOTE_CONTROL_DEFAULTS)){
      if(!Object.prototype.hasOwnProperty.call(window.REMOTE_CONTROL_VALUES, key)){
        window.REMOTE_CONTROL_VALUES[key] = value;
      }
    }

    function shouldEnforceStockLimits(){
      return false;
    }
    function shouldShowProductImages(){
      return true;
    }
    function shouldShowProductPrices(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_PRECIOS_PRODUCTO !== false);
    }
    function shouldShowAdministrativeSPRE(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_SPRE === true);
    }
    function shouldShowAdministrativeFolleto(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_FOLLETO === true);
    }
    function shouldShowProductCodes(){
      return true;
    }
    function shouldSendProductCodesByWhatsApp(){
      return true;
    }
    function shouldAllowSuggestionToggle(){
      return true;
    }
    function shouldShowSuggestionsInitially(){
      return false;
    }

    function shouldShowProductImageInNavigationPanels(){
      return true;
    }
    const _hasIdle = ("requestIdleCallback" in window);
    function runIdle(fn, timeout=1200){
      if(_hasIdle) return requestIdleCallback(fn, { timeout });
      return setTimeout(fn, Math.min(250, timeout));
    }

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
    const PRODUCT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

    function googleSheetQueryUrl(callbackName){
      const base = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(GOOGLE_SHEET_SOURCE.spreadsheetId)}/gviz/tq`;
      const query = new URLSearchParams({
        sheet: GOOGLE_SHEET_SOURCE.sheetName,
        headers: "1",
        range: "A:N",
        tq: "select A,B,C,D,E,F,G,H,I,J,K,L,M,N",
        tqx: `out:json;responseHandler:${callbackName}`,
        // Evita que el navegador, un proxy o Google reutilicen una respuesta anterior.
        // Cada apertura del catálogo consulta la versión más reciente de Productos.
        _: `${Date.now()}_${Math.random().toString(36).slice(2)}`
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
              name: value(6),
              priceText: value(7),
              costText: value(8),
              stockText: value(9),
              referenceExternal: value(10),
              description: value(11),
              codeNatura: value(12),
              line: value(13),
              fullTxtRecord: [
                value(6),
                "",
                `Precio: ${value(7)} Costo: ${value(8)} Stock: ${value(9)} Referencia externa: ${value(10)}. ${value(11)}`
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


    function loadRemoteCatalogConfiguration(callbackPrefix){
      return new Promise((resolve, reject)=>{
        if(!REMOTE_CONTROL_SOURCE.enabled || !REMOTE_CONTROL_SOURCE.endpoint){
          resolve({ ...REMOTE_CONTROL_DEFAULTS });
          return;
        }

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
          reject(new Error("Tiempo de espera agotado al consultar la configuración administrativa."));
        }, GOOGLE_SHEET_QUERY_TIMEOUT_MS);

        window[callbackName] = (payload)=>{
          if(settled) return;
          settled = true;
          window.clearTimeout(timer);
          cleanup();

          if(!payload || payload.ok !== true || !payload.valores || typeof payload.valores !== "object"){
            reject(new Error(String(payload?.error || "El administrador devolvió una configuración no válida.")));
            return;
          }
          resolve(payload.valores);
        };

        script.onerror = ()=>{
          if(settled) return;
          settled = true;
          window.clearTimeout(timer);
          cleanup();
          reject(new Error("No se pudo conectar con la configuración administrativa."));
        };

        const url = new URL(REMOTE_CONTROL_SOURCE.endpoint);
        url.searchParams.set("modo", "config");
        url.searchParams.set("callback", callbackName);
        url.searchParams.set("_", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
        script.src = url.toString();
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

    function applyRemoteControlValues(values){
      let changed = false;
      const source = values && typeof values === "object" ? values : {};
      for(const [rawKey, rawValue] of Object.entries(source)){
        const key = String(rawKey || "").trim().toUpperCase();
        if(!key) continue;

        const rawState = String(rawValue ?? "").trim();
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

    async function refreshRemoteCatalogConfiguration(options = {}){
      const rebuild = options.rebuild !== false;
      const initial = options.initial === true;

      if(!REMOTE_CONTROL_SOURCE.enabled) return false;

      const controlsResult = await Promise.allSettled([
        loadRemoteCatalogConfiguration("__remoteCatalogControls")
      ]).then(results => results[0]);

      let changed = false;

      if(controlsResult.status === "fulfilled"){
        changed = applyRemoteControlValues(controlsResult.value) || changed;
      }else{
        console.info("Configuración administrativa no disponible; se conservan los valores locales.", controlsResult.reason);
      }

      if(initial){
        wordSuggestionsVisible = shouldShowSuggestionsInitially();
        syncWordToggleButton();
      }

      syncAdministrativeToolVisibility();

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

    function normalizeImageServiceFile(file){
      if(!file || typeof file !== "object") return null;
      const id = String(file.id || "").trim();
      const name = String(file.name || "").trim();
      const url = String(file.url || "").trim();
      if(!name || !url || !PRODUCT_IMAGE_EXTENSIONS.has(extensionOfFilename(name))) return null;
      return { id, name, url, path:name, type:"drive-image" };
    }

    function normalizeImageServicePayload(payload){
      if(!payload || payload.ok !== true || typeof payload !== "object") return null;
      const products = {};
      const rawProducts = payload.products && typeof payload.products === "object" ? payload.products : {};
      for(const [rawCode, rawFiles] of Object.entries(rawProducts)){
        const code = String(rawCode || "").trim().padStart(4, "0");
        if(!/^\d{4}$/.test(code)) continue;
        const files = (Array.isArray(rawFiles) ? rawFiles : [rawFiles])
          .map(normalizeImageServiceFile)
          .filter(Boolean);
        if(files.length) products[code] = orderProductImageEntries(files);
      }

      const gifts = [];
      const rawGifts = payload.gifts && typeof payload.gifts === "object" ? payload.gifts : {};
      for(const file of Object.values(rawGifts)){
        const normalized = normalizeImageServiceFile(file);
        if(normalized) gifts.push(normalized);
      }
      gifts.sort((a,b)=>String(a.name || "").localeCompare(String(b.name || ""), "es", { numeric:true, sensitivity:"base" }));

      return {
        ok:true,
        generatedAt:String(payload.generatedAt || ""),
        products,
        gifts
      };
    }

    function readAppsScriptImageIndexCache(){
      try{
        const raw = localStorage.getItem(APPS_SCRIPT_IMAGE_SOURCE.cacheKey);
        if(!raw) return null;
        return normalizeImageServicePayload(JSON.parse(raw));
      }catch(_){
        return null;
      }
    }

    function saveAppsScriptImageIndexCache(payload){
      try{
        localStorage.setItem(APPS_SCRIPT_IMAGE_SOURCE.cacheKey, JSON.stringify(payload));
      }catch(_){}
    }

    async function loadAppsScriptImageIndex(){
      const controller = new AbortController();
      const timer = window.setTimeout(()=>controller.abort(), APPS_SCRIPT_IMAGE_SOURCE.timeoutMs);
      try{
        const url = new URL(APPS_SCRIPT_IMAGE_SOURCE.endpoint);
        url.searchParams.set("_", `${Date.now()}_${Math.random().toString(36).slice(2)}`);
        const response = await fetch(url.toString(), { cache:"no-store", signal:controller.signal });
        if(!response.ok) throw new Error(`Apps Script respondió ${response.status} al consultar las imágenes.`);
        const rawPayload = await response.json();
        const normalized = normalizeImageServicePayload(rawPayload);
        if(!normalized) throw new Error("Apps Script devolvió un índice de imágenes no válido.");
        saveAppsScriptImageIndexCache(rawPayload);
        return normalized;
      }catch(error){
        const cached = readAppsScriptImageIndexCache();
        if(cached){
          console.warn("No se pudo actualizar el índice de imágenes desde Apps Script; se conserva el último índice válido guardado en el navegador.", error);
          return cached;
        }
        console.warn("No se pudo cargar el índice de imágenes desde Apps Script; se usarán imágenes suplentes.", error);
        return { ok:false, products:{}, gifts:[] };
      }finally{
        window.clearTimeout(timer);
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

    async function loadGoogleSheetCatalog(options = {}){
      const refreshImages = options.refreshImages !== false;
      const progressEnabled = options.progressEnabled === true;
      let rows = [];
      try{
        rows = await loadGoogleSheetRows();
        if(progressEnabled) setCatalogLoadingStage("Cargando productos…", 35, 69);
      }catch(error){
        const sheetError = error instanceof Error ? error : new Error(String(error || "No se pudo leer el Google Sheet."));
        sheetError.catalogStage = "sheet";
        throw sheetError;
      }

      let imagePayload = null;
      try{
        imagePayload = refreshImages ? await loadAppsScriptImageIndex() : readAppsScriptImageIndexCache();
      }catch(error){
        console.warn("Los productos se cargaron desde el Google Sheet, pero no se pudo leer el índice de imágenes de Apps Script. Se usarán imágenes suplentes.", error);
        imagePayload = null;
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
      const line = String(row.line || "").trim();
      const condition = String(row.condition || "").trim();
      if(!/^\d{4}$/.test(code) || !name) return null;

      const indexedImages = imageIndex && imageIndex.get(code);
      const imageEntries = Array.isArray(indexedImages)
        ? indexedImages
        : (indexedImages ? [indexedImages] : []);
      const imageUrls = imageEntries
        .map(imageEntry => String(imageEntry && imageEntry.url || "").trim())
        .filter(Boolean);
      const imageNames = imageEntries
        .map(imageEntry => String((imageEntry && (imageEntry.name || imageEntry.path)) || "").trim())
        .filter(Boolean);
      const docsImageUrl = imageUrls[0] || "";
      const syntheticFilename = imageNames[0] || `${code}.webp`;

      const priceText = String(row.priceText || "").trim();
      const stockText = String(row.stockText || "").trim();

      return {
        id: code,
        name,
        section,
        category,
        subcategory,
        fragranceFamily,
        line,
        condition,
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
        searchKey: normalizeText([code, name, section, category, subcategory, line, fragranceFamily, condition, row.description, row.referenceExternal].filter(Boolean).join(" "))
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
            section: GIFT_IMAGE_SOURCE.section,
            category: "Regalos",
            subcategory: "",
            fragranceFamily: "",
            line: "",
            condition: "",
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
        String(a?.line || "").localeCompare(String(b?.line || ""), "es", { sensitivity:"base" }) ||
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
        meta.textContent = `Código ${String(product?.id || "").trim()}`;

        item.append(title, meta);
        fragment.appendChild(item);
      }
      list.replaceChildren(fragment);
    }

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

    function cleanNavKey(value){
      return normalizeText(value).replace(/\s+/g, " ");
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
      return String(p.subcategory || "General").trim() || "General";
    }

    function navigationFamilyForProduct(p){
      if(!p) return "";
      return String(p.line || "").trim();
    }

    function productsForNavigationGroup(audienceLabel, list = all){
      return (Array.isArray(list) ? list : []).filter(p => productMatchesAudience(p, audienceLabel));
    }

    function isDirectProductAudience(audienceLabel){
      const products = productsForNavigationGroup(audienceLabel);
      if(!products.length) return false;
      // Si la hoja define al menos una subcategoría, la navegación la muestra automáticamente.
      // Solo se entra directo a productos cuando ninguna fila del grupo tiene subcategoría.
      return !products.some(p => String(p && p.subcategory || "").trim());
    }

    function isDirectProductSection(sectionLabel){
      const products = (Array.isArray(all) ? all : []).filter(p => cleanNavKey(p && p.section) === cleanNavKey(sectionLabel));
      return products.length > 0 && !products.some(p => String(p && p.subcategory || "").trim());
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
      const source = Array.isArray(list) ? list : [];
      const byGroup = new Map();

      for(const p of source){
        const label = String(mainNavigationGroupForProduct(p) || "").trim();
        if(!label) continue;
        const key = cleanNavKey(label);
        const existing = byGroup.get(key) || { label, products:[] };
        existing.products.push(p);
        byGroup.set(key, existing);
      }

      const preferredOrder = new Map(NAV_AUDIENCES.map((item,index)=>[cleanNavKey(item.label), index]));
      const groups = Array.from(byGroup.values()).sort((a,b)=>{
        const aRank = preferredOrder.has(cleanNavKey(a.label)) ? preferredOrder.get(cleanNavKey(a.label)) : Number.MAX_SAFE_INTEGER;
        const bRank = preferredOrder.has(cleanNavKey(b.label)) ? preferredOrder.get(cleanNavKey(b.label)) : Number.MAX_SAFE_INTEGER;
        return aRank - bRank || a.label.localeCompare(b.label, "es", { sensitivity:"base" });
      });

      return groups.map((dynamicGroup,index)=>{
        const group = NAV_AUDIENCES.find(item => cleanNavKey(item.label) === cleanNavKey(dynamicGroup.label)) || {};
        const visual = CATEGORY_VISUALS[cleanNavKey(dynamicGroup.label)] || {};
        const subtitle = String(group.subtitle || `Productos disponibles en ${dynamicGroup.label}.`).trim();
        const album = {
          key:`audience::${cleanNavKey(dynamicGroup.label)}`,
          navType:"audience",
          navValue:dynamicGroup.label,
          label:dynamicGroup.label,
          subtitle,
          icon:group.icon || visual.icon || "•",
          iconSvg:group.iconSvg || "",
          iconImage:group.iconImage || visual.iconImage || "",
          theme:group.theme || "",
          products:dynamicGroup.products,
          cover:null,
          previewImages:[],
          searchKey:normalizeText(`${dynamicGroup.label} ${subtitle}`),
          hasStructuredProducts:true,
          hasUnstructuredProducts:false,
          onlyUnstructured:false,
          count:dynamicGroup.products.length,
          colorIndex:index % ALBUM_COLORS.length
        };
        for(const p of dynamicGroup.products) collectAlbumPreview(album,p);
        return album;
      });
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
        const family = navigationFamilyForProduct(p) || "General";
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
        .map(album=>({ ...album, count:album.products.length }))
        .sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label,"es",{sensitivity:"base"}))
        .map((album,index)=>({
          ...album,
          onlyUnstructured:false,
          colorIndex:index % ALBUM_COLORS.length
        }));
    }

    function buildAlbums(list){
      if(selectedAudience && selectedCategory){
        const scoped = (Array.isArray(list) ? list : []).filter(p =>
          productMatchesAudience(p, selectedAudience) &&
          cleanNavKey(navigationCategoryForProduct(p)) === cleanNavKey(selectedCategory)
        );
        const hasFamilies = scoped.some(p => Boolean(navigationFamilyForProduct(p)));
        return hasFamilies ? buildFamilyAlbums(list, selectedAudience, selectedCategory) : [];
      }
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
      return source.slice();
    }

    function filterSearchExcludedProducts(list){
      const source = Array.isArray(list) ? list : [];
      return source.slice();
    }

    function hasAlbumFolders(){
      return all.length > 0;
    }

    function albumModeEnabled(){
      return hasAlbumFolders();
    }

    function shouldShowAlbumGrid(){
      return albumModeEnabled() && albums.length > 0 && !selectedFamily && !isDirectProductAudience(selectedAudience);
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
        if(cleanNavKey(selectedFamily) === cleanNavKey("General")){
          source = source.filter(p => !navigationFamilyForProduct(p));
        }else{
          source = source.filter(p => cleanNavKey(navigationFamilyForProduct(p)) === cleanNavKey(selectedFamily));
        }
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
            "category":[p.category, p.subcategory, p.line]
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
      if(p.line) parts.push(p.line);
      if(p.fragranceFamily && cleanNavKey(p.fragranceFamily) !== cleanNavKey(p.line)) parts.push(p.fragranceFamily);
      if(p.id && shouldShowProductCodes()) parts.push(`Código ${p.id}`);
      if(INTERRUPTORES.MOSTRAR_CANTIDAD_STOCK){
        parts.push(hasKnownStock ? `Stock: ${stockVal}` : "Stock: Por confirmar");
      }
      return parts.filter(Boolean).join(" · ");
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
          img.onerror = ()=>{
            img.onerror = null;
            img.remove();
            icon.textContent = album.icon || "•";
          };
          img.src = album.iconImage;
          icon.replaceChildren(img);
        }else if(album.iconSvg){
          icon.innerHTML = album.iconSvg;
        }else{
          icon.textContent = album.icon || "•";
        }
      }
      setSearchHighlightedText(label,album.label);
      if(meta) setSearchHighlightedText(meta,meta.textContent || "");

      return card;
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

    // Resalta únicamente las palabras escritas en el buscador.
    // La comparación ignora mayúsculas y tildes, igual que la búsqueda normal.
    function typedSearchHighlightTerms(){
      return uniqueTerms(parseSearchTerms(qInp ? qInp.value : ""));
    }

    function normalizeForHighlightPiece(text){
      return String(text || "")
        .toLocaleLowerCase("es-CO")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    function searchHighlightRanges(text,terms){
      const source=String(text ?? "");
      const wanted=(Array.isArray(terms)?terms:[]).map(normalizeText).filter(Boolean);
      if(!source || !wanted.length) return [];

      let normalized="";
      const starts=[];
      const ends=[];
      for(let index=0;index<source.length;){
        const codePoint=source.codePointAt(index);
        const char=String.fromCodePoint(codePoint);
        const start=index;
        index+=char.length;
        const piece=normalizeForHighlightPiece(char);
        for(const unit of piece){
          normalized+=unit;
          starts.push(start);
          ends.push(index);
        }
      }

      const ranges=[];
      for(const term of wanted){
        let from=0;
        while(from<=normalized.length-term.length){
          const found=normalized.indexOf(term,from);
          if(found<0) break;
          const last=found+term.length-1;
          if(starts[found]!==undefined && ends[last]!==undefined){
            ranges.push([starts[found],ends[last]]);
          }
          from=found+Math.max(1,term.length);
        }
      }
      ranges.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);

      const merged=[];
      for(const range of ranges){
        const previous=merged[merged.length-1];
        if(previous && range[0]<=previous[1]) previous[1]=Math.max(previous[1],range[1]);
        else merged.push(range.slice());
      }
      return merged;
    }

    function setSearchHighlightedText(element,text){
      if(!element) return;
      const source=String(text ?? "");
      const ranges=searchHighlightRanges(source,typedSearchHighlightTerms());
      if(!ranges.length){
        element.textContent=source;
        return;
      }

      const fragment=document.createDocumentFragment();
      let cursor=0;
      for(const [start,end] of ranges){
        if(start>cursor) fragment.appendChild(document.createTextNode(source.slice(cursor,start)));
        const mark=document.createElement("mark");
        mark.className="search-match-highlight";
        mark.textContent=source.slice(start,end);
        fragment.appendChild(mark);
        cursor=end;
      }
      if(cursor<source.length) fragment.appendChild(document.createTextNode(source.slice(cursor)));
      element.replaceChildren(fragment);
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
      const liveAudienceLabels = [...new Set((Array.isArray(all) ? all : [])
        .map(mainNavigationGroupForProduct)
        .map(value => String(value || "").trim())
        .filter(Boolean))];
      const validAudience = liveAudienceLabels.find(label => cleanNavKey(label) === cleanNavKey(audience));
      selectedAudience = validAudience || "";
      selectedCategory = selectedAudience && category && !isDirectProductAudience(selectedAudience) ? category : "";
      selectedFamily = selectedCategory && family ? family : "";
      if(sort && sortSel) sortSel.value = sort;
    }

    let _urlTimer = null;
    const CATALOG_HISTORY_KEY = "irenismbCatalogNavigation";
    const CATALOG_EXIT_GUARD_KEY = "irenismbCatalogExitGuard";
    const CATALOG_RELOAD_VIEW_KEY = "irenismb_catalog_reload_view_v1";
    const CATALOG_PERSISTENT_VIEW_KEY = "irenismb_catalog_last_view_v1";
    let lastCatalogHistoryIndex = 0;

    function catalogNavigationIsReload(){
      try{
        const navEntry = performance.getEntriesByType?.("navigation")?.[0];
        if(navEntry && navEntry.type) return navEntry.type === "reload";
        return Number(performance.navigation?.type) === 1;
      }catch(_){
        return false;
      }
    }

    function captureCatalogReloadViewState(){
      try{
        const collapse = document.querySelector("[data-admin-config-collapse]");
        const snapshot = {
          version:1,
          pathname:location.pathname,
          q:qInp ? String(qInp.value || "") : "",
          sort:sortSel ? String(sortSel.value || "") : "",
          tags:uniqueTerms(selectedSuggestionTerms || []),
          audience:String(selectedAudience || ""),
          category:String(selectedCategory || ""),
          family:String(selectedFamily || ""),
          admin:window.CATALOG_ADMIN_MODE_ACTIVE === true,
          adminConfigExpanded:collapse?.getAttribute("aria-expanded") === "true",
          scrollY:Math.max(0,Math.round(window.scrollY || 0)),
          savedAt:Date.now()
        };
        sessionStorage.setItem(CATALOG_RELOAD_VIEW_KEY,JSON.stringify(snapshot));
        sessionStorage.setItem("irenismb_catalog_scroll_position",String(snapshot.scrollY));

        localStorage.setItem(CATALOG_PERSISTENT_VIEW_KEY,JSON.stringify(snapshot));
      }catch(_){ }
    }

    function catalogUrlHasExplicitViewState(){
      try{
        const params=new URL(location.href).searchParams;
        return ["q","sort","tags","audience","category","family","cat","brand","album"]
          .some(key=>params.has(key));
      }catch(_){
        return false;
      }
    }

    function readCatalogPersistentViewState(){
      if(catalogNavigationIsReload()) return null;
      try{
        const raw=localStorage.getItem(CATALOG_PERSISTENT_VIEW_KEY);
        if(!raw) return null;
        const snapshot=JSON.parse(raw);
        if(!snapshot || snapshot.version!==1 || snapshot.pathname!==location.pathname) return null;
        return snapshot;
      }catch(_){
        return null;
      }
    }

    function readCatalogReloadViewState(){
      if(!catalogNavigationIsReload()) return null;
      try{
        const raw=sessionStorage.getItem(CATALOG_RELOAD_VIEW_KEY);
        if(!raw) return null;
        const snapshot=JSON.parse(raw);
        if(!snapshot || snapshot.version!==1 || snapshot.pathname!==location.pathname) return null;
        return snapshot;
      }catch(_){
        return null;
      }
    }

    function applyCatalogReloadViewState(snapshot){
      if(!snapshot) return;
      if(qInp) qInp.value=String(snapshot.q || "");
      if(sortSel) sortSel.value=String(snapshot.sort || "");
      selectedSuggestionTerms=uniqueTerms(Array.isArray(snapshot.tags)?snapshot.tags:[]);
      selectedAudience=String(snapshot.audience || "");
      selectedCategory=String(snapshot.category || "");
      selectedFamily=String(snapshot.family || "");

      const u=new URL(location.href);
      const q=String(snapshot.q || "").trim();
      const sort=String(snapshot.sort || "").trim();
      const tags=uniqueTerms(Array.isArray(snapshot.tags)?snapshot.tags:[]).join(",");
      const audience=String(snapshot.audience || "").trim();
      const category=String(snapshot.category || "").trim();
      const family=String(snapshot.family || "").trim();
      if(q)u.searchParams.set("q",q);else u.searchParams.delete("q");
      if(sort)u.searchParams.set("sort",sort);else u.searchParams.delete("sort");
      if(tags)u.searchParams.set("tags",tags);else u.searchParams.delete("tags");
      if(audience)u.searchParams.set("audience",audience);else u.searchParams.delete("audience");
      if(category)u.searchParams.set("category",category);else u.searchParams.delete("category");
      if(family)u.searchParams.set("family",family);else u.searchParams.delete("family");
      u.searchParams.delete("album");

      const atRoot=!audience&&!category&&!family;
      const state=makeCatalogHistoryState(currentCatalogHistoryIndex(),{preserveExitGuard:atRoot});
      history.replaceState(state,"",u.toString());
      lastCatalogHistoryIndex=currentCatalogHistoryIndex();
      if(Number.isFinite(Number(snapshot.scrollY))){
        sessionStorage.setItem("irenismb_catalog_scroll_position",String(Math.max(0,Math.round(Number(snapshot.scrollY)))));
      }
    }

    function waitForCatalogCondition(test,timeoutMs=16000,intervalMs=100){
      return new Promise(resolve=>{
        const started=Date.now();
        const check=()=>{
          let value=null;
          try{value=test()}catch(_){value=null}
          if(value){resolve(value);return}
          if(Date.now()-started>=timeoutMs){resolve(null);return}
          setTimeout(check,intervalMs);
        };
        check();
      });
    }

    async function restoreCatalogAdminAfterReload(snapshot){
      if(!snapshot?.admin) return;
      const adminButton=document.getElementById("priceAdminBtn");
      if(!adminButton) return;
      if(window.CATALOG_ADMIN_MODE_ACTIVE!==true) adminButton.click();
      const started=await waitForCatalogCondition(()=>window.CATALOG_ADMIN_MODE_ACTIVE===true,16500,100);
      if(!started) return;
      if(snapshot.adminConfigExpanded){
        const collapse=await waitForCatalogCondition(()=>document.querySelector("[data-admin-config-collapse]"),4000,80);
        if(collapse && collapse.getAttribute("aria-expanded")!=="true") collapse.click();
      }
    }

    function catalogExitGuardType(state = history.state){
      const guard = state && typeof state === "object" ? state[CATALOG_EXIT_GUARD_KEY] : null;
      return guard && typeof guard === "object" ? String(guard.type || "") : "";
    }

    function currentCatalogHistoryIndex(){
      const state = history.state;
      const catalogState = state && typeof state === "object" ? state[CATALOG_HISTORY_KEY] : null;
      const index = Number(catalogState && catalogState.index);
      return Number.isInteger(index) && index >= 0 ? index : 0;
    }

    function makeCatalogHistoryState(index = currentCatalogHistoryIndex(), {preserveExitGuard=true}={}){
      const base = history.state && typeof history.state === "object" ? { ...history.state } : {};
      if(!preserveExitGuard) delete base[CATALOG_EXIT_GUARD_KEY];
      const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
      return {
        ...base,
        [CATALOG_HISTORY_KEY]:{
          index:safeIndex,
          audience:selectedAudience || "",
          category:selectedCategory || "",
          family:selectedFamily || ""
        }
      };
    }

    function isCatalogRootNavigation(){
      return !selectedAudience && !selectedCategory && !selectedFamily;
    }

    function catalogStateWithExitGuard(type){
      return {
        ...makeCatalogHistoryState(0,{preserveExitGuard:false}),
        [CATALOG_EXIT_GUARD_KEY]:{ type:String(type || "") }
      };
    }

    function installCatalogExitGuardIfAtRoot(){
      if(!isCatalogRootNavigation()) return;
      const guardType = catalogExitGuardType();
      if(guardType === "guard") return;
      if(guardType === "sentinel") {
        history.pushState(catalogStateWithExitGuard("guard"), "", location.href);
        lastCatalogHistoryIndex = 0;
        return;
      }
      history.replaceState(catalogStateWithExitGuard("sentinel"), "", location.href);
      history.pushState(catalogStateWithExitGuard("guard"), "", location.href);
      lastCatalogHistoryIndex = 0;
    }

    function rearmCatalogExitGuard(){
      history.pushState(catalogStateWithExitGuard("guard"), "", location.href);
      lastCatalogHistoryIndex = 0;
    }

    function makeCatalogHistoryStateForNavigation(index, audience="", category="", family="", exitGuardType=""){
      const base = history.state && typeof history.state === "object" ? { ...history.state } : {};
      delete base[CATALOG_EXIT_GUARD_KEY];
      const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
      const state = {
        ...base,
        [CATALOG_HISTORY_KEY]:{
          index:safeIndex,
          audience:String(audience || ""),
          category:String(category || ""),
          family:String(family || "")
        }
      };
      if(exitGuardType){
        state[CATALOG_EXIT_GUARD_KEY] = { type:String(exitGuardType) };
      }
      return state;
    }

    function catalogUrlForRestoredNavigation(audience="", category="", family="", {preserveDiscovery=false,baseHref=location.href}={}){
      const u = new URL(baseHref, location.href);
      if(!preserveDiscovery){
        for(const key of ["q","cat","brand","sort","tags","album"]){
          u.searchParams.delete(key);
        }
      }else{
        u.searchParams.delete("album");
      }
      if(audience) u.searchParams.set("audience", audience); else u.searchParams.delete("audience");
      if(category) u.searchParams.set("category", category); else u.searchParams.delete("category");
      if(family) u.searchParams.set("family", family); else u.searchParams.delete("family");
      return u.toString();
    }

    function rebuildCatalogHistoryForRestoredNavigation({force=false}={}){
      validateNavigationStateAgainstProducts();
      if(isCatalogRootNavigation()) return false;

      // En una carga normal con historial interno vigente no se duplica la cadena.
      // Cuando la vista viene de una sesión persistida se fuerza la reconstrucción:
      // algunos navegadores restauran history.state, pero no todas las entradas previas.
      if(!force && currentCatalogHistoryIndex() > 0) return false;

      const audience = String(selectedAudience || "");
      const category = String(selectedCategory || "");
      const family = String(selectedFamily || "");
      if(!audience) return false;

      const restoredUrl = location.href;
      const steps = [
        { audience, category:"", family:"" }
      ];
      if(category) steps.push({ audience, category, family:"" });
      if(family) steps.push({ audience, category, family });

      const rootUrl = catalogUrlForRestoredNavigation("", "", "", {preserveDiscovery:false,baseHref:restoredUrl});
      history.replaceState(
        makeCatalogHistoryStateForNavigation(0, "", "", "", "sentinel"),
        "",
        rootUrl
      );
      history.pushState(
        makeCatalogHistoryStateForNavigation(0, "", "", "", "guard"),
        "",
        rootUrl
      );

      steps.forEach((step, idx)=>{
        const index = idx + 1;
        const isCurrent = idx === steps.length - 1;
        history.pushState(
          makeCatalogHistoryStateForNavigation(index, step.audience, step.category, step.family),
          "",
          catalogUrlForRestoredNavigation(step.audience, step.category, step.family, {preserveDiscovery:isCurrent,baseHref:restoredUrl})
        );
      });

      lastCatalogHistoryIndex = steps.length;
      return true;
    }

    function writeStateToUrl({push=false,index=currentCatalogHistoryIndex()}={}){
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

      const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
      const state = makeCatalogHistoryState(safeIndex,{preserveExitGuard:!push});
      if(push) history.pushState(state, "", u.toString());
      else history.replaceState(state, "", u.toString());
      lastCatalogHistoryIndex = safeIndex;
    }

    function pushNavigationStateToUrl(){
      clearTimeout(_urlTimer);
      _urlTimer = null;
      writeStateToUrl({push:true,index:currentCatalogHistoryIndex()+1});
    }

    function scheduleWriteStateToUrl(){
      clearTimeout(_urlTimer);
      _urlTimer = setTimeout(()=>writeStateToUrl(), 180);
    }

    function validateNavigationStateAgainstProducts(){
      if(selectedCategory){
        const hasCategory = all.some(p => productMatchesAudience(p, selectedAudience) && cleanNavKey(navigationCategoryForProduct(p)) === cleanNavKey(selectedCategory));
        if(!hasCategory){
          selectedCategory = "";
          selectedFamily = "";
        }
      }
      if(selectedFamily){
        const hasFamily = all.some(p => {
          if(!productMatchesAudience(p, selectedAudience)) return false;
          if(cleanNavKey(navigationCategoryForProduct(p)) !== cleanNavKey(selectedCategory)) return false;
          if(cleanNavKey(selectedFamily) === cleanNavKey("General")) return !navigationFamilyForProduct(p);
          return cleanNavKey(navigationFamilyForProduct(p)) === cleanNavKey(selectedFamily);
        });
        if(!hasFamily) selectedFamily = "";
      }
    }

    function restoreCatalogStateFromHistory(event){
      clearTimeout(_urlTimer);
      _urlTimer = null;

      const poppedState = event && typeof event === "object" ? event.state : history.state;
      const poppedGuardType = catalogExitGuardType(poppedState);
      const poppedCatalogState = poppedState && typeof poppedState === "object" ? poppedState[CATALOG_HISTORY_KEY] : null;
      const poppedAtRoot = !String(poppedCatalogState?.audience || "").trim()
        && !String(poppedCatalogState?.category || "").trim()
        && !String(poppedCatalogState?.family || "").trim();

      if(poppedGuardType === "sentinel" && poppedAtRoot){
        const shouldExit = window.confirm("¿Quieres salir del catálogo?");
        if(shouldExit){
          history.back();
        }else{
          rearmCatalogExitGuard();
        }
        return;
      }

      const nextIndex = currentCatalogHistoryIndex();
      const goingBack = nextIndex < lastCatalogHistoryIndex;
      const restore = goingBack ? uxScrollStack().pop() : null;
      lastCatalogHistoryIndex = nextIndex;
      readStateFromUrl();
      validateNavigationStateAgainstProducts();
      refreshNavigationAlbums();
      refreshFilterOptionsForScope();
      render();
      if(restore && Number.isFinite(restore.scrollY)){
        requestAnimationFrame(()=>window.scrollTo({top:restore.scrollY,left:0,behavior:"smooth"}));
      }else{
        requestAnimationFrame(()=>uxScrollToCatalogStart());
      }
    }

    function resetDiscoveryFilters(){
      if(qInp) qInp.value = "";
      if(catSel) catSel.value = "";
      if(brandSel) brandSel.value = "";
      if(sortSel) sortSel.value = "";
      selectedSuggestionTerms = [];
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
          const order = new Map(NAV_AUDIENCES.map((item,index)=>[cleanNavKey(item.label),index]));
          const aRank = order.has(cleanNavKey(a.label)) ? order.get(cleanNavKey(a.label)) : Number.MAX_SAFE_INTEGER;
          const bRank = order.has(cleanNavKey(b.label)) ? order.get(cleanNavKey(b.label)) : Number.MAX_SAFE_INTEGER;
          return aRank - bRank || a.label.localeCompare(b.label, "es", { sensitivity:"base" });
        }
        return a.label.localeCompare(b.label, "es", { sensitivity:"base" });
      });
      return filtered;
    }

    let _renderToken = 0;
    function render(){
      const token = ++_renderToken;

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

    let catalogLoadingProgress = 0;
    let catalogLoadingCeiling = 0;
    let catalogLoadingLabel = "Cargando productos…";
    let catalogLoadingTimer = 0;
    window.CATALOG_INITIAL_LOAD_READY = false;

    function renderCatalogLoadingProgress(){
      if(!countEl) return;
      const pct = Math.max(0, Math.min(99, Math.round(catalogLoadingProgress)));
      countEl.textContent = `${catalogLoadingLabel} ${pct}%`;
    }

    function stopCatalogLoadingProgress(){
      if(catalogLoadingTimer){
        window.clearInterval(catalogLoadingTimer);
        catalogLoadingTimer = 0;
      }
    }

    function ensureCatalogLoadingTimer(){
      if(catalogLoadingTimer) return;
      catalogLoadingTimer = window.setInterval(()=>{
        if(catalogLoadingProgress >= catalogLoadingCeiling) return;
        const gap = catalogLoadingCeiling - catalogLoadingProgress;
        const step = gap > 24 ? 2 : 1;
        catalogLoadingProgress = Math.min(catalogLoadingCeiling, catalogLoadingProgress + step);
        renderCatalogLoadingProgress();
      }, 140);
    }

    function setCatalogLoadingStage(label, floor, ceiling){
      catalogLoadingLabel = String(label || catalogLoadingLabel || "Cargando productos…");
      const safeFloor = Math.max(0, Math.min(99, Number(floor) || 0));
      const safeCeiling = Math.max(safeFloor, Math.min(99, Number(ceiling) || safeFloor));
      catalogLoadingProgress = Math.max(catalogLoadingProgress, safeFloor);
      catalogLoadingCeiling = safeCeiling;
      renderCatalogLoadingProgress();
      ensureCatalogLoadingTimer();
    }

    function startCatalogLoadingProgress(){
      stopCatalogLoadingProgress();
      catalogLoadingProgress = 1;
      catalogLoadingCeiling = 34;
      catalogLoadingLabel = "Cargando productos…";
      renderCatalogLoadingProgress();
      ensureCatalogLoadingTimer();
    }

    function updateCountTextReady(){
      stopCatalogLoadingProgress();
      catalogLoadingProgress = 100;
      if(countEl) countEl.textContent = "Listo · 100%";
    }

    function updateCountTextError(msg){
      stopCatalogLoadingProgress();
      if(countEl) countEl.textContent = msg || "Error al cargar productos.";
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
      all = filterVisibleProducts(allLoadedProducts);
      productById = new Map(all.map(p => [String(p.id), p]));
      refreshNavigationAlbums();

      updateCatalogFooterProducts(all);
      scheduleJsonLdUpdate();
      refreshFilterOptionsForScope();
      sanitizeCartWithStock();
      render();
    }

    let inventoryRefreshInFlight = false;
    const INVENTORY_REFRESH_MS = 60000;
    let inventoryRefreshTimer = 0;

    async function loadProducts(options = {}){
      const silent = options.silent === true;
      const refreshImages = options.refreshImages !== false;
      if(!silent){
        window.CATALOG_INITIAL_LOAD_READY = false;
        startCatalogLoadingProgress();
      }
      clearLegacyProductCaches();

      try{
        await warmupPlaceholderOnce();
      }catch(error){
        console.warn("No se pudo preparar la imagen suplente. El catálogo continuará.", error);
      }

      let catalogSource;
      try{
        catalogSource = await loadGoogleSheetCatalog({ refreshImages, progressEnabled:!silent });
      }catch(err){
        console.error("Error al cargar el Google Sheet oficial.", err);
        if(!silent) updateCountTextError("No se pudieron cargar los productos desde el Google Sheet oficial. Reintenta más tarde.");
        return;
      }

      if(!silent) setCatalogLoadingStage("Preparando catálogo…", 70, 98);

      let sheetProducts = [];
      try{
        sheetProducts = (Array.isArray(catalogSource?.sheetEntries) ? catalogSource.sheetEntries : [])
          .map(makeProductFromGoogleSheet)
          .filter(Boolean);
      }catch(err){
        console.error("El Google Sheet respondió, pero ocurrió un error al procesar sus productos.", err);
        if(!silent) updateCountTextError("El Google Sheet respondió, pero no se pudieron procesar los productos. Revisa la consola para el detalle.");
        return;
      }

      if(!sheetProducts.length){
        console.error("El Google Sheet respondió, pero no produjo productos válidos para mostrar.");
        if(!silent) updateCountTextError("El Google Sheet respondió, pero no se encontraron productos válidos para mostrar.");
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

      all = filterVisibleProducts(allLoadedProducts);

      try{
        productById = new Map(all.map(p => [String(p.id), p]));
        readStateFromUrl();
        validateNavigationStateAgainstProducts();
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
        if(!silent){
          updateCountTextReady();
          await new Promise(resolve=>window.setTimeout(resolve, 220));
        }
        render();
        if(!silent){
          window.CATALOG_INITIAL_LOAD_READY = true;
          window.dispatchEvent(new CustomEvent("catalog-initial-load-ready"));
        }
      }catch(err){
        console.error("Los productos se cargaron, pero ocurrió un error al renderizar el catálogo.", err);
        if(!silent) updateCountTextError("Los productos se cargaron, pero ocurrió un error al mostrar el catálogo. Revisa la consola para el detalle.");
      }
    }

    function startInventoryAutoRefresh(){
      if(inventoryRefreshTimer) return;
      inventoryRefreshTimer = window.setInterval(async ()=>{
        if(inventoryRefreshInFlight || document.hidden) return;
        inventoryRefreshInFlight = true;
        try{
          // La hoja Productos se relee periódicamente. Las imágenes usan el último índice
          // conocido para evitar consumir innecesariamente la API pública de GitHub.
          await loadProducts({ silent:true, refreshImages:false });
        }catch(error){
          console.info("No se pudo actualizar el inventario automáticamente; se conserva la vista actual.", error);
        }finally{
          inventoryRefreshInFlight = false;
        }
      }, INVENTORY_REFRESH_MS);
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

    
// Detalle auxiliar conservado del bloque clásico original.
const visitorDetails = document.getElementById("visitorDetails");
    visitorDetails?.addEventListener("toggle", () => {
      if (visitorDetails.open) {
        requestAnimationFrame(() => visitorDetails.scrollIntoView({ block:"start" }));
      }
    });


// UX visual compatible con el catálogo de referencia (sin cambiar la fuente de datos).
function uxActiveFilterEntries(){
  const entries=[];
  const query=qInp?String(qInp.value||"").trim():"";
  if(query) entries.push({key:"query",label:`Búsqueda: ${query}`});
  for(const term of uniqueTerms(selectedSuggestionTerms||[])) entries.push({key:`term:${term}`,label:term});
  return entries;
}

function uxRenderFilterSummary(){
  const host=document.getElementById("filterSummary");
  if(!host) return;
  const entries=uxActiveFilterEntries();
  host.hidden=entries.length===0;
  host.innerHTML="";
  if(!entries.length) return;
  const label=document.createElement("span");
  label.className="filter-summary-label";
  label.textContent="Filtros activos";
  host.appendChild(label);
  for(const entry of entries){
    const btn=document.createElement("button");
    btn.type="button";
    btn.className="filter-summary-chip";
    btn.dataset.clearFilter=entry.key;
    btn.setAttribute("aria-label",`Quitar ${entry.label}`);
    btn.innerHTML=`<span>${entry.label}</span><span aria-hidden="true">×</span>`;
    host.appendChild(btn);
  }
}

function uxRenderBreadcrumb(){
  if(!albumPath) return;
  albumPath.innerHTML="";
  if(!selectedAudience) return;
  const crumbs=[{level:"root",label:"Inicio"},{level:"audience",label:selectedAudience}];
  if(selectedCategory) crumbs.push({level:"category",label:selectedCategory});
  if(selectedFamily) crumbs.push({level:"family",label:selectedFamily});
  crumbs.forEach((crumb,index)=>{
    if(index){
      const sep=document.createElement("span");
      sep.className="breadcrumb-separator";
      sep.textContent="›";
      sep.setAttribute("aria-hidden","true");
      albumPath.appendChild(sep);
    }
    const current=index===crumbs.length-1;
    if(current){
      const span=document.createElement("span");
      span.className="breadcrumb-current";
      span.textContent=crumb.label;
      span.setAttribute("aria-current","page");
      albumPath.appendChild(span);
    }else{
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="breadcrumb-link";
      btn.dataset.breadcrumbLevel=crumb.level;
      btn.textContent=crumb.label;
      albumPath.appendChild(btn);
    }
  });
}

function uxClearOneFilter(key){
  if(key==="query"&&qInp) qInp.value="";
  else if(String(key||"").startsWith("term:")){
    const term=String(key).slice(5);
    selectedSuggestionTerms=selectedSuggestionTerms.filter(item=>normalizeText(item)!==normalizeText(term));
  }
  render();
}

function uxClearAllFilters(){
  if(qInp) qInp.value="";
  selectedSuggestionTerms=[];
  render();
}

function uxScrollStack(){
  if(!Array.isArray(window.__catalogUxScrollStack)) window.__catalogUxScrollStack=[];
  return window.__catalogUxScrollStack;
}

function uxScrollToCatalogStart(){
  let target=document.querySelector("main")||grid;
  if(window.CATALOG_ADMIN_MODE_ACTIVE&&grid){
    const first=Array.from(grid.children).find(el=>{
      if(!el||!el.matches?.(".album-card,.card")||el.hidden) return false;
      const style=window.getComputedStyle(el);
      return style.display!=="none"&&style.visibility!=="hidden";
    });
    target=first||grid;
  }
  if(!target) return;
  const y=Math.max(0,target.getBoundingClientRect().top+window.scrollY-86);
  requestAnimationFrame(()=>window.scrollTo({top:y,left:0,behavior:"smooth"}));
}

function uxSaveScrollPosition(){
  clearTimeout(window.__catalogUxScrollTimer);
  window.__catalogUxScrollTimer=setTimeout(()=>{
    try{sessionStorage.setItem("irenismb_catalog_scroll_position",String(Math.max(0,Math.round(window.scrollY||0))));}catch(_){ }
  },120);
}

function uxRestoreScrollPosition(){
  let saved=0;
  try{saved=Number(sessionStorage.getItem("irenismb_catalog_scroll_position")||0);}catch(_){ }
  if(saved>0) requestAnimationFrame(()=>requestAnimationFrame(()=>window.scrollTo({top:saved,left:0,behavior:"auto"})));
}

function uxFlashAdded(card,p){
  const btn=card&&card.querySelector('button[data-act="inc"]');
  if(!btn) return;
  btn.classList.add("just-added");
  btn.textContent="✓ Agregado";
  setTimeout(()=>{
    btn.classList.remove("just-added");
    if(card&&card.isConnected) refreshCardUI(card,p);
  },850);
}

function rebuildSearchTicker(){
  if(tickerInner) tickerInner.innerHTML="";
  if(searchWrap) searchWrap.classList.remove("show-ticker");
}

function updateTickerVisibility(){
  if(searchWrap) searchWrap.classList.remove("show-ticker");
}

function syncWordToggleButton(){
  if(!toggleWordPanelBtn) return;
  const canToggle=shouldAllowSuggestionToggle();
  const activeCount=uxActiveFilterEntries().length;
  toggleWordPanelBtn.hidden=!canToggle;
  toggleWordPanelBtn.disabled=!canToggle;
  toggleWordPanelBtn.textContent=activeCount?`Filtros (${activeCount})`:"Filtros";
  toggleWordPanelBtn.title=wordSuggestionsVisible?"Ocultar filtros":"Mostrar filtros";
  toggleWordPanelBtn.setAttribute("aria-label",toggleWordPanelBtn.title);
  toggleWordPanelBtn.setAttribute("aria-pressed",wordSuggestionsVisible?"true":"false");
  toggleWordPanelBtn.classList.toggle("is-active",wordSuggestionsVisible||activeCount>0);
}

function renderWordSuggestions(){
  if(!wordPanel||!wordChips||!activeTerms||!activeTermsWrap||!clearTermsBtn) return;
  syncWordToggleButton();
  if(!wordSuggestionsVisible){
    wordPanel.hidden=true;
    clearTermsBtn.hidden=true;
    activeTermsWrap.hidden=true;
    wordChips.innerHTML="";
    activeTerms.innerHTML="";
    const summary=document.getElementById("filterSummary");
    if(summary) summary.hidden=true;
    return;
  }
  wordPanel.hidden=false;
  const showAlbumGrid=shouldShowAlbumGrid();
  const entries=showAlbumGrid?[]:buildSuggestionEntries();
  const activeTermsList=uniqueTerms(selectedSuggestionTerms||[]);
  const rawQuery=qInp?String(qInp.value||""):"";
  const typedTerms=parseSearchTerms(rawQuery);
  clearTermsBtn.hidden=uxActiveFilterEntries().length===0;
  activeTermsWrap.hidden=!activeTermsList.length;
  wordChips.innerHTML="";
  activeTerms.innerHTML="";
  uxRenderFilterSummary();

  if(activeTermsList.length){
    for(const term of activeTermsList){
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="term-chip is-active";
      btn.dataset.term=term;
      btn.dataset.role="remove-active-term";
      btn.setAttribute("aria-label",`Quitar palabra ${term}`);
      btn.innerHTML=`<span>${term}</span><span class="term-chip-remove" aria-hidden="true">×</span>`;
      activeTerms.appendChild(btn);
    }
  }

  if(showAlbumGrid){
    const note=document.createElement("div");
    note.className="word-empty";
    note.textContent=typedTerms.length?"La búsqueda está filtrando las categorías visibles.":"Abre una categoría para ver filtros y palabras más específicas.";
    wordChips.appendChild(note);
  }else if(!entries.length){
    const empty=document.createElement("div");
    empty.className="word-empty";
    empty.textContent="No hay palabras adicionales para esta vista.";
    wordChips.appendChild(empty);
  }else{
    for(const entry of entries){
      const btn=document.createElement("button");
      btn.type="button";
      btn.className="term-chip"+(activeTermsList.includes(entry.term)?" is-active":"");
      btn.dataset.term=entry.term;
      btn.dataset.role="toggle-term";
      btn.setAttribute("aria-pressed",activeTermsList.includes(entry.term)?"true":"false");
      btn.innerHTML=`<span>${entry.term}</span><span class="term-chip-count">${entry.count}</span>`;
      wordChips.appendChild(btn);
    }
  }
}

function syncFilterVisibility(){
  const showAlbumGrid=shouldShowAlbumGrid();
  const directSelected=isDirectProductAudience(selectedAudience);
  if(catSel){catSel.hidden=true;catSel.disabled=true;catSel.value="";}
  if(brandSel){brandSel.hidden=true;brandSel.disabled=true;brandSel.value="";}
  if(sortSel){sortSel.hidden=showAlbumGrid;sortSel.disabled=showAlbumGrid;}
  syncSPREButtonVisibility();
  if(albumNav) albumNav.hidden=!selectedAudience;
  if(albumBackBtn){
    albumBackBtn.textContent=selectedFamily?`← Volver a ${selectedCategory}`:(selectedCategory?`← Volver a ${selectedAudience}`:"← Volver al inicio");
  }
  uxRenderBreadcrumb();
  placeResponsiveHeaderMeta();
  if(qInp){
    const scope=selectedFamily||selectedCategory||selectedAudience;
    qInp.placeholder=selectedAudience?`Buscar en ${scope}`:"Buscar producto, línea o categoría";
    qInp.setAttribute("aria-label",selectedAudience?`Buscar dentro de ${scope}`:"Buscar producto, línea o categoría");
  }
  if(grid){
    grid.classList.toggle("album-grid-mode",showAlbumGrid);
    grid.classList.toggle("root-nav-mode",showAlbumGrid&&!selectedAudience);
    const label=!selectedAudience?"Categorías principales":(directSelected?"Productos":(!selectedCategory?"Subcategorías":(albums.length>0&&!selectedFamily?"Líneas":"Productos")));
    grid.setAttribute("aria-label",showAlbumGrid?label:"Productos");
  }
  if(catalogEntryIntro){
    const hasTerms=getCombinedWordTerms().length>0;
    catalogEntryIntro.hidden=hasTerms||!!selectedCategory||directSelected;
    if(catalogEntryTitle) catalogEntryTitle.textContent=selectedAudience||"¿Qué estás buscando?";
    if(catalogEntryText) catalogEntryText.textContent=selectedAudience?(directSelected?"Explora los productos disponibles.":"Elige una categoría para ver los productos disponibles."):"Elige una categoría para comenzar.";
  }
  rebuildSearchTicker();
  updateTickerVisibility();
  uxRenderFilterSummary();
}

function refreshCardUI(card,p){
  const row=card.querySelector(".row");
  const actions=card.querySelector(".actions");
  const meta=card.querySelector(".meta");
  if(meta) meta.hidden=false;
  if(row) row.hidden=false;
  if(actions) actions.hidden=false;
  const enforce=shouldEnforceStockLimits();
  const id=String(p.id);
  const q=cart[id]?.qty||0;
  const qtyPill=card.querySelector('[data-role="qty"]');
  const decBtn=card.querySelector('button[data-act="dec"]');
  const incBtn=card.querySelector('button[data-act="inc"]');
  if(qtyPill){qtyPill.textContent=q>0?`${q} en carrito`:"No agregado al carrito";qtyPill.classList.toggle("has-items",q>0);}
  if(decBtn) decBtn.disabled=q<=0;
  const hasKnownStock=Number.isFinite(p.stock)&&p.stock>=0;
  const maxStock=hasKnownStock?p.stock:null;
  const canAdd=!enforce||(hasKnownStock&&maxStock>0&&q<maxStock);
  if(incBtn){
    incBtn.disabled=!canAdd;
    incBtn.classList.toggle("in-cart",q>0);
    if(enforce&&!hasKnownStock) incBtn.textContent="Stock por confirmar";
    else if(enforce&&maxStock<=0) incBtn.textContent="Sin stock";
    else incBtn.textContent=q>0?"Agregar otro":"Agregar";
  }
}

function makeCard(p){
  const card=cardTemplate.content.firstElementChild.cloneNode(true);
  card.id="p-"+encodeURIComponent(String(p.id));
  card.dataset.id=String(p.id);
  const imgBox=card.querySelector(".img");
  imgBox.appendChild(makeImgFromFilename(p.imgFilename,p.name,p.docsImageUrl));
  const nameEl=card.querySelector(".name");
  const metaEl=card.querySelector(".meta");
  const descriptionEl=card.querySelector(".description");
  const priceEl=card.querySelector(".price");
  const productName=String(p.name||"");
  nameEl.title=productName;
  setSearchHighlightedText(nameEl,productName);
  const metaText=stockMetaText(p);
  setSearchHighlightedText(metaEl,metaText);
  const description=String(p?.description||"").trim();
  setSearchHighlightedText(descriptionEl,description);
  descriptionEl.hidden=true;
  if(description){
    card.classList.add("description-collapsible");
    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="description-toggle";
    toggle.dataset.descriptionToggle="";
    toggle.textContent="Descripción";
    toggle.setAttribute("aria-expanded","false");
    descriptionEl.insertAdjacentElement("afterend",toggle);
  }
  priceEl.textContent=shouldShowProductPrices()?(p.hasPrice===false?"Consultar precio":fmtCOP.format(p.price)):"";
  if(p?.isGiftGalleryImage){
    card.classList.add("gift-gallery-card");
    const pad=card.querySelector(".pad");
    if(pad) pad.hidden=true;
    imgBox.setAttribute("aria-label","Imagen de regalo para toda ocasión");
  }
  refreshCardUI(card,p);
  return card;
}

window.addEventListener("irenismb:precio-guardado",event=>{
  const detail=event?.detail||{};
  const code=String(detail.codigo||"").trim();
  const normalizedPrice=String(detail.precio||"").trim();
  if(!/^\d{4}$/.test(code)) return;
  if(normalizedPrice!=="" && !/^\d+$/.test(normalizedPrice)) return;

  let changed=false;
  for(const product of all){
    if(String(product?.id||"").trim()!==code) continue;
    product.priceText=normalizedPrice;
    product.price=normalizedPrice===""?0:Number(normalizedPrice);
    product.hasPrice=normalizedPrice!=="";
    changed=true;
  }

  if(changed) scheduleJsonLdUpdate();
});

function makeEmptyState(message){
  const div=document.createElement("div");
  div.className="empty-state";
  const title=document.createElement("strong");
  title.className="empty-state-title";
  title.textContent=message;
  div.appendChild(title);
  if(getCombinedWordTerms().length){
    const help=document.createElement("p");
    help.className="empty-state-text";
    help.textContent="Prueba con menos palabras o limpia los filtros para volver a explorar el catálogo.";
    const actions=document.createElement("div");
    actions.className="empty-state-actions";
    const clear=document.createElement("button");
    clear.type="button";
    clear.className="btn-acc";
    clear.dataset.clearSearch="all";
    clear.textContent="Limpiar búsqueda y filtros";
    actions.appendChild(clear);
    div.append(help,actions);
  }
  return div;
}

function openAlbum(key,opts={}){
  const target=albumByKey.get(String(key||""));
  if(!target) return;
  writeStateToUrl();
  uxScrollStack().push({scrollY:window.scrollY||0});
  if(target.navType==="audience"){selectedAudience=target.navValue;selectedCategory="";selectedFamily="";}
  else if(target.navType==="category"){selectedAudience=target.audience||selectedAudience;selectedCategory=target.navValue;selectedFamily="";}
  else if(target.navType==="family"){selectedAudience=target.audience||selectedAudience;selectedCategory=target.category||selectedCategory;selectedFamily=target.navValue;}
  if(!opts.keepFilters) resetDiscoveryFilters();
  refreshNavigationAlbums();
  refreshFilterOptionsForScope();
  pushNavigationStateToUrl();
  render();
  uxScrollToCatalogStart();
}

function closeAlbum(opts={}){
  if(currentCatalogHistoryIndex()>0){
    history.back();
    return;
  }
  const restore=uxScrollStack().pop();
  if(selectedFamily) selectedFamily="";
  else if(selectedCategory) selectedCategory="";
  else selectedAudience="";
  if(!opts.keepFilters) resetDiscoveryFilters();
  refreshNavigationAlbums();
  refreshFilterOptionsForScope();
  writeStateToUrl();
  installCatalogExitGuardIfAtRoot();
  render();
  if(restore&&Number.isFinite(restore.scrollY)) requestAnimationFrame(()=>window.scrollTo({top:restore.scrollY,left:0,behavior:"smooth"}));
}

function renderCartModal(){
  const items=cartItemsArray();
  const subtotalValue=cartTotalValue();
  const shippingValue=getShippingCop();
  const total=subtotalValue+shippingValue;
  const showPrices=shouldShowProductPrices();
  const hasUnpricedItems=items.some(it=>it&&it.hasPrice===false);
  const subtotalEl=document.getElementById("cartSubtotal");
  const shippingEl=document.getElementById("cartShippingTotal");
  if(cartInvoiceBtn && !invoiceCopying){
    const canGenerateSummary=items.length>0&&showPrices&&!hasUnpricedItems;
    cartInvoiceBtn.disabled=!canGenerateSummary;
    cartInvoiceBtn.title=canGenerateSummary
      ? "Crear un resumen PNG del pedido; no registra una venta"
      : !items.length
        ? "Agrega productos para crear el resumen"
        : "Todos los productos deben tener un precio visible";
  }
  if(cartBuyBtn && !orderSending) cartBuyBtn.disabled=items.length===0;
  if(cartClearBtn) cartClearBtn.disabled=items.length===0;
  if(subtotalEl) subtotalEl.textContent=(!showPrices||hasUnpricedItems)?"Por confirmar":fmtCOP.format(subtotalValue);
  if(shippingEl) shippingEl.textContent=fmtCOP.format(shippingValue);
  cartTotalEl.textContent=(!showPrices||hasUnpricedItems)?"Total: Por confirmar":"Total: "+fmtCOP.format(total);
  if(!items.length){
    cartItemsEl.innerHTML='<div class="cart-empty"><strong>Tu carrito está vacío.</strong><span>Agrega productos para preparar el pedido por WhatsApp.</span></div>';
    return;
  }
  const frag=document.createDocumentFragment();
  items.forEach(it=>{
    const row=document.createElement("div");
    row.className="cart-item";
    row.dataset.id=it.id;
    const left=document.createElement("div");
    left.className="cart-item-left";
    const p=productById.get(String(it.id));
    const imgFilename=p?.imgFilename||it.imgFilename;
    left.appendChild(makeCartThumbFromFilename(imgFilename,it.name,p&&p.docsImageUrl));
    const main=document.createElement("div");
    main.className="cart-item-main";
    main.innerHTML='<p class="cart-item-name"></p><p class="cart-item-sub"></p>';
    main.querySelector(".cart-item-name").textContent=it.name;
    const meta=[];
    if(shouldShowProductCodes()) meta.push(`Código ${it.id}`);
    meta.push(shouldShowProductPrices()?(it.hasPrice===false?"Precio por confirmar":`${fmtCOP.format(Number(it.price)||0)} c/u`):"Precio por confirmar");
    main.querySelector(".cart-item-sub").textContent=meta.join(" · ");
    left.appendChild(main);
    const controls=document.createElement("div");
    controls.className="cart-controls";
    controls.innerHTML=`<button class="cart-qty-btn" type="button" data-act="dec" aria-label="Disminuir cantidad">−</button><span class="cart-qty" aria-label="Cantidad">${it.qty}</span><button class="cart-qty-btn" type="button" data-act="inc" aria-label="Aumentar cantidad">+</button>`;
    const incBtn=controls.querySelector('button[data-act="inc"]');
    const enforce=shouldEnforceStockLimits();
    const known=Number.isFinite(it.stock)&&it.stock>=0;
    const max=known?it.stock:null;
    if(incBtn) incBtn.disabled=enforce?(!known||max<=0||(Number(it.qty)||0)>=max):false;
    const subtotal=document.createElement("div");
    subtotal.className="cart-subtotal";
    subtotal.innerHTML=`<span>Subtotal</span><strong>${(!shouldShowProductPrices()||it.hasPrice===false)?"Por confirmar":fmtCOP.format((Number(it.price)||0)*(Number(it.qty)||0))}</strong>`;
    row.append(left,controls,subtotal);
    frag.appendChild(row);
  });
  cartItemsEl.innerHTML="";
  cartItemsEl.appendChild(frag);
}

function bindGridActions(){
  grid.addEventListener("click",e=>{
    const clear=e.target.closest("[data-clear-search]");
    if(clear){uxClearAllFilters();return;}
    const desc=e.target.closest("[data-description-toggle]");
    if(desc){
      const card=desc.closest(".card");
      if(!card) return;
      const expanded=card.classList.toggle("description-expanded");
      const descriptionEl=card.querySelector(".description");
      if(descriptionEl) descriptionEl.hidden=!expanded;
      desc.textContent=expanded?"Ocultar descripción":"Descripción";
      desc.setAttribute("aria-expanded",expanded?"true":"false");
      return;
    }
    const albumBtn=e.target.closest("[data-album-open]");
    if(albumBtn){
      const key=albumBtn.getAttribute("data-album-open")||"";
      if(key) openAlbum(key,{keepFilters:getCombinedWordTerms().length>0});
      return;
    }
    const btn=e.target.closest("button[data-act]");
    if(!btn) return;
    const card=e.target.closest(".card");
    if(!card) return;
    const id=card.dataset.id;
    if(!id) return;
    const p=productById.get(String(id));
    if(!p) return;
    const act=btn.dataset.act;
    const enforce=shouldEnforceStockLimits();
    const known=Number.isFinite(p.stock)&&p.stock>=0;
    const max=known?p.stock:null;
    const current=safeInt(cart[id]?.qty,0);
    let next=current;
    if(act==="inc"){
      if(!enforce) next=current+1;
      else if(known&&max>0&&current<max) next=current+1;
    }else if(act==="dec") next=Math.max(0,current-1);
    if(next<=0) delete cart[id];
    else cart[id]={id:p.id,name:p.name,price:p.price,hasPrice:p.hasPrice!==false,qty:next,stock:p.stock,imgFilename:p.imgFilename||null};
    if(act==="inc"&&next>current) registrarConversionCatalogo("Añadió al carrito",String(p.name||""));
    saveCart();
    refreshCardUI(card,p);
    if(act==="inc"&&next>current) uxFlashAdded(card,p);
    if(cartModal&&cartModal.classList.contains("open")) renderCartModal();
  });
}

function bindFilters(){
  if(sortSel) sortSel.addEventListener("change",render);
  qInp.addEventListener("input",render);
  wordChips?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-role='toggle-term']");
    if(btn) toggleSuggestionTerm(btn.dataset.term||"");
  });
  activeTerms?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-role='remove-active-term']");
    if(btn) removeSuggestionTerm(btn.dataset.term||"");
  });
  document.getElementById("filterSummary")?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-clear-filter]");
    if(btn) uxClearOneFilter(btn.dataset.clearFilter||"");
  });
  clearTermsBtn?.addEventListener("click",uxClearAllFilters);
  toggleWordPanelBtn?.addEventListener("click",toggleWordSuggestionsVisible);
  albumPath?.addEventListener("click",e=>{
    const btn=e.target.closest("[data-breadcrumb-level]");
    if(!btn) return;
    const level=btn.dataset.breadcrumbLevel;
    uxScrollStack().length=0;
    if(level==="root"){selectedAudience="";selectedCategory="";selectedFamily="";}
    else if(level==="audience"){selectedCategory="";selectedFamily="";}
    else if(level==="category") selectedFamily="";
    resetDiscoveryFilters();
    refreshNavigationAlbums();
    refreshFilterOptionsForScope();
    render();
    uxScrollToCatalogStart();
  });
  qInp.addEventListener("focus",updateTickerVisibility);
  qInp.addEventListener("blur",updateTickerVisibility);
  window.addEventListener("resize",()=>{rebuildSearchTicker();updateTickerVisibility();},{passive:true});
  window.addEventListener("scroll",uxSaveScrollPosition,{passive:true});
  window.addEventListener("pagehide",captureCatalogReloadViewState);
  window.addEventListener("beforeunload",captureCatalogReloadViewState);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")captureCatalogReloadViewState()});
}

async function init(){
  refreshCartCount();
  initCartButton();
  initShipping();
  bindFilters();
  bindGridActions();
  window.addEventListener("popstate",restoreCatalogStateFromHistory);
  initKeyboardAccessibility();
  initCollageFeature();
  initSPREFeature();
  if(albumBackBtn) albumBackBtn.addEventListener("click",()=>closeAlbum({keepFilters:getCombinedWordTerms().length>0}));
  syncWordToggleButton();
  rebuildSearchTicker();
  updateTickerVisibility();
  updateCountAttention();
  loadClientFromLS();
  loadAddressFromLS();
  const reloadViewState=readCatalogReloadViewState();
  const persistentViewState=reloadViewState ? null : readCatalogPersistentViewState();
  const startupViewState=reloadViewState || (catalogUrlHasExplicitViewState() ? null : persistentViewState);
  const startupAdminState=reloadViewState || persistentViewState;
  const shouldForceRestoredHistory=!!persistentViewState && !catalogNavigationIsReload();
  applyCatalogReloadViewState(startupViewState);
  await initializeRemoteCatalogConfiguration();
  await loadProducts();
  rebuildCatalogHistoryForRestoredNavigation({force:shouldForceRestoredHistory});
  installCatalogExitGuardIfAtRoot();
  startInventoryAutoRefresh();
  await restoreCatalogAdminAfterReload(startupAdminState);
  uxRestoreScrollPosition();
}
