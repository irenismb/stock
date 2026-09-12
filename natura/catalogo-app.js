// Lógica principal del catálogo público.

// ==========================================
    // AJUSTES LOCALES Y CONFIGURACIÓN GLOBAL
    // ==========================================
    // Los valores locales funcionan como respaldo.
    // La hoja "Configuracion" conserva únicamente los controles que siguen siendo editables.

    // Fuente principal de datos comerciales del catálogo: Google Sheet oficial.
    // Las imágenes se relacionan por el código interno global de cuatro dígitos.
    // Hoja Productos, estructura A:L: Código, Sección, Categoría, Subcategoría, Familia olfativa, Condición, Nombre, Precio, Costo, Stock, Referencia externa y Descripción.
    const GOOGLE_SHEET_SOURCE = {
      spreadsheetId: "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs",
      sheetName: "Productos",
      gid: "893686273"
    };

    // Control global remoto. La hoja debe estar en el mismo archivo de Google Sheets.
    // Configuracion: A=Control, B=Estado, C=Qué hace, D=Recomendación, E=Clave técnica.
    const REMOTE_CONTROL_SOURCE = {
      enabled: true,
      spreadsheetId: GOOGLE_SHEET_SOURCE.spreadsheetId,
      controlsSheetName: "Configuracion",
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
	  IMAGEN_SUPLENTE_PRODUCTO: "suplente.webp"
    };
    window.INTERRUPTORES = INTERRUPTORES;
    const REMOTE_BOOLEAN_CONTROL_KEYS = new Set([
      "MOSTRAR_CANTIDAD_STOCK",
      "MOSTRAR_PRECIOS_PRODUCTO"
    ]);
    window.REMOTE_CONTROL_VALUES = window.REMOTE_CONTROL_VALUES || {};

    function shouldEnforceStockLimits(){
      return false;
    }
    function shouldShowProductImages(){
      return true;
    }
    function shouldShowProductPrices(){
      return !!(window.INTERRUPTORES && window.INTERRUPTORES.MOSTRAR_PRECIOS_PRODUCTO !== false);
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
        range: "A:L",
        tq: "select A,B,C,D,E,F,G,H,I,J,K,L",
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
        tqx: `out:json;responseHandler:${callbackName}`,
        // La configuración y las rutas también deben consultarse sin caché.
        _: `${Date.now()}_${Math.random().toString(36).slice(2)}`
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

    async function refreshRemoteCatalogConfiguration(options = {}){
      const rebuild = options.rebuild !== false;
      const initial = options.initial === true;

      if(!REMOTE_CONTROL_SOURCE.enabled) return false;

      const controlsResult = await Promise.allSettled([
        loadGoogleSheetRemoteMatrix(
          REMOTE_CONTROL_SOURCE.controlsSheetName,
          "A:E",
          "select A,B,C,D,E",
          "__remoteCatalogControls"
        )
      ]).then(results => results[0]);

      let changed = false;

      if(controlsResult.status === "fulfilled"){
        changed = applyRemoteControlRows(controlsResult.value) || changed;
      }else{
        console.info("Configuración remota no disponible; se conservan los interruptores locales.", controlsResult.reason);
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
      let rows = [];
      try{
        rows = await loadGoogleSheetRows();
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
            section: GIFT_IMAGE_SOURCE.section,
            category: "Regalos",
            subcategory: "",
            fragranceFamily: "",
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
      return String(p.fragranceFamily || "").trim();
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
        .sort((a,b)=>a.label.localeCompare(b.label,"es",{sensitivity:"base"}))
        .map((album,index)=>({
          ...album,
          count:album.products.length,
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

      const MIN_SHIPPING = 7000;

      const raw = readStringLS(LS_SHIPPING_KEY, "");
      const v = toNumberDigits(raw);

      // Si no hay valor guardado, usar 7.000 por defecto (editable).
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

    const INVOICE_PAYMENT_LOCAL_KEY = "irenismb_invoice_payment_method";

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

    function invoiceDateColombia(){
      try{
        return new Intl.DateTimeFormat("en-CA", {
          timeZone:"America/Bogota",
          year:"numeric",
          month:"2-digit",
          day:"2-digit"
        }).format(new Date());
      }catch(_){
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      }
    }

    function invoiceMoney(value){
      const n = Math.max(0, Math.round(Number(value) || 0));
      return `COP ${new Intl.NumberFormat("es-CO", { maximumFractionDigits:0 }).format(n)}`;
    }

    function invoicePaymentMethod(){
      const el = document.getElementById("invoicePaymentMethod");
      const allowed = new Set(["Efectivo","Transferencia","Nequi","Daviplata","Tarjeta","Otro"]);
      const value = String(el?.value || "Nequi").trim();
      return allowed.has(value) ? value : "Nequi";
    }

    function invoiceValidateInput(){
      const cartItems = cartItemsArray();
      if(!cartItems.length) throw new Error("Agrega al menos un producto al carrito antes de generar la factura.");
      if(!shouldShowProductPrices()){
        throw new Error("No se puede generar una factura de venta con los precios ocultos.");
      }

      const items = cartItems.map(it=>{
        const qty = Math.max(0, safeInt(it.qty, 0));
        if(!qty) throw new Error(`La cantidad del producto ${it.name || it.id || ""} no es válida.`);
        if(it.hasPrice === false) throw new Error(`El producto ${it.name || it.id || ""} no tiene precio registrado en el carrito.`);
        return {
          ...it,
          id: String(it.id || ""),
          name: String(it.name || ""),
          price: Number(it.price) || 0,
          hasPrice: it.hasPrice !== false,
          qty
        };
      });

      const client = getClientDataCurrent();
      const addr = getAddressDataCurrent();
      return { items, client, addr };
    }

    function invoiceRoundRect(ctx, x, y, w, h, r){
      const radius = Math.max(0, Math.min(Number(r)||0, Math.min(w,h)/2));
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      ctx.closePath();
    }

    function invoiceWrapLines(ctx, text, maxWidth, maxLines=4){
      const words = String(text || "").replace(/\s+/g," ").trim().split(" ").filter(Boolean);
      if(!words.length) return [""];
      const lines = [];
      let current = "";
      for(const word of words){
        const test = current ? `${current} ${word}` : word;
        if(ctx.measureText(test).width <= maxWidth || !current){
          current = test;
        }else{
          lines.push(current);
          current = word;
          if(lines.length >= maxLines) break;
        }
      }
      if(lines.length < maxLines && current) lines.push(current);
      if(lines.length === maxLines){
        const usedWords = lines.join(" ").split(" ").length;
        if(usedWords < words.length){
          let last = lines[lines.length-1];
          while(last && ctx.measureText(last + "…").width > maxWidth) last = last.slice(0,-1).trimEnd();
          lines[lines.length-1] = (last || "") + "…";
        }
      }
      return lines;
    }

    function invoiceLoadImage(src){
      return new Promise((resolve, reject)=>{
        const img = new Image();
        img.onload = ()=>resolve(img);
        img.onerror = reject;
        img.decoding = "async";
        img.src = src;
      });
    }

    async function invoiceLoadOfficialLogo(){
      const candidates = ["logos/logo_empresa.webp", "logos/logo_empresa.png"];
      for(const src of candidates){
        try{ return await invoiceLoadImage(src); }catch(_){}
      }
      return null;
    }

    function invoiceDrawLabelValue(ctx, x, y, label, value, width){
      ctx.fillStyle = "#745d60";
      ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText(label.toUpperCase(), x, y);
      ctx.fillStyle = "#2d2628";
      ctx.font = "800 20px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      const lines = invoiceWrapLines(ctx, value, width, 2);
      lines.forEach((line, i)=>ctx.fillText(line, x, y + 31 + i*25));
    }

    async function invoiceBuildCanvas(){
      const { items, client, addr } = invoiceValidateInput();
      const width = 1103;
      const tableTop = 510;
      const tableHeaderHeight = 44;
      const cols = [52, 142, 637, 707, 867, 1047];
      const articleTextWidth = cols[2] - cols[1] - 24;

      // Calcula la altura de cada artículo según su nombre: la columna es más ancha
      // y las filas cortas ocupan menos espacio, por lo que caben más productos.
      const measureCanvas = document.createElement("canvas");
      const measureCtx = measureCanvas.getContext("2d");
      if(!measureCtx) throw new Error("No fue posible preparar la factura PNG.");
      measureCtx.font = "600 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      const preparedRows = items.map(it=>{
        const nameLines = invoiceWrapLines(measureCtx, String(it.name || ""), articleTextWidth, 4);
        const rowHeight = Math.max(60, 22 + nameLines.length * 19);
        return { it, nameLines, rowHeight };
      });

      const tableRowsHeight = preparedRows.reduce((sum,row)=>sum + row.rowHeight, 0);
      const tableHeight = tableHeaderHeight + tableRowsHeight;
      const summaryTop = tableTop + tableHeight + 22;
      const summaryHeight = 145;
      const footerTop = summaryTop + summaryHeight + 24;
      const height = Math.max(1040, footerTop + 135);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha:false });
      if(!ctx) throw new Error("No fue posible preparar la factura PNG.");

      const mauve = "#8f4963";
      const rose = "#c54e73";
      const purple = "#6f3aa0";
      const gold = "#b8781f";
      const ink = "#282326";
      const muted = "#735f65";
      const line = "#eadcda";
      const softRose = "#fff6f8";
      const softPurple = "#faf7ff";
      const softGold = "#fffaf1";

      ctx.fillStyle = "#fffdfc";
      ctx.fillRect(0,0,width,height);
      const topGrad = ctx.createLinearGradient(0,0,width,0);
      topGrad.addColorStop(0,"#c98a31");
      topGrad.addColorStop(.45,"#f0d58e");
      topGrad.addColorStop(1,"#b8701e");
      ctx.fillStyle = topGrad;
      ctx.fillRect(0,0,width,16);

      const logo = await invoiceLoadOfficialLogo();
      if(logo){
        const size = 112;
        ctx.drawImage(logo, 54, 37, size, size);
      }

      ctx.fillStyle = gold;
      ctx.font = "900 31px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("IRENISMB STOCK NATURA", 195, 76);
      ctx.fillStyle = ink;
      ctx.font = "500 21px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("Factura de venta", 195, 111);
      ctx.fillStyle = mauve;
      ctx.font = "800 20px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("Natura · AVON", 195, 143);

      ctx.fillStyle = softRose;
      ctx.strokeStyle = "#e7a7ba";
      ctx.lineWidth = 2;
      invoiceRoundRect(ctx, 790, 47, 257, 96, 17);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = rose;
      ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FACTURA DE VENTA", 918, 103);
      ctx.textAlign = "left";

      // Datos generales compactos.
      const metaY = 170;
      const metaH = 92;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      invoiceRoundRect(ctx, 52, metaY, 995, metaH, 17);
      ctx.fill(); ctx.stroke();
      const metaW = 995/4;
      const metaX = [75, 75+metaW, 75+metaW*2, 75+metaW*3];
      invoiceDrawLabelValue(ctx, metaX[0], metaY+29, "Fecha", invoiceDateColombia(), 190);
      invoiceDrawLabelValue(ctx, metaX[1], metaY+29, "Ciudad de envío", addr.city || "", 190);
      invoiceDrawLabelValue(ctx, metaX[2], metaY+29, "Medio de pago", invoicePaymentMethod(), 190);
      invoiceDrawLabelValue(ctx, metaX[3], metaY+29, "Moneda", "COP", 145);
      ctx.strokeStyle = line;
      for(let i=1;i<4;i++){
        const xx = 52 + metaW*i;
        ctx.beginPath(); ctx.moveTo(xx, metaY+14); ctx.lineTo(xx, metaY+metaH-14); ctx.stroke();
      }

      // Empresa y cliente: menos altura sin perder información útil.
      const boxY = 282, boxH = 202, boxW = 482;
      ctx.fillStyle = softPurple; ctx.strokeStyle = "#cdb7e4";
      invoiceRoundRect(ctx, 52, boxY, boxW, boxH, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = softRose; ctx.strokeStyle = "#efbdcc";
      invoiceRoundRect(ctx, 565, boxY, boxW, boxH, 18); ctx.fill(); ctx.stroke();

      ctx.fillStyle = purple;
      ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("DATOS DE LA EMPRESA", 82, boxY+36);
      ctx.fillStyle = ink;
      ctx.font = "800 18px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("Irenismb Stock Natura", 82, boxY+73);
      ctx.font = "500 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("Calle 10A #20A-06", 82, boxY+105);
      ctx.fillText("Barrio Los Almendros · Santa Marta", 82, boxY+133);
      ctx.fillText("Celular: 3042088961", 82, boxY+161);

      ctx.fillStyle = rose;
      ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("DATOS DEL CLIENTE", 595, boxY+36);
      ctx.fillStyle = ink;
      ctx.font = "800 18px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      const clientNameLines = invoiceWrapLines(ctx, client.name, 405, 2);
      clientNameLines.forEach((lineText,i)=>ctx.fillText(lineText,595,boxY+73+i*21));
      ctx.font = "500 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      const clientAddr = joinParts([addr.via, addr.barrio ? `Barrio ${addr.barrio}` : ""], ", ");
      const addrLines = invoiceWrapLines(ctx, clientAddr, 405, 2);
      const clientAddressY = boxY + 113 + Math.max(0,clientNameLines.length-1)*21;
      addrLines.forEach((lineText,i)=>ctx.fillText(lineText,595,clientAddressY+i*20));
      const afterAddrY = clientAddressY + addrLines.length*20;
      ctx.fillText(joinParts([addr.city, addr.region], ", "), 595, afterAddrY + 5);
      ctx.fillText(`Celular: ${client.phone}`, 595, afterAddrY + 31);

      // Tabla: artículo más ancho y filas de altura adaptativa.
      ctx.fillStyle = "#7648a5";
      invoiceRoundRect(ctx, cols[0], tableTop, cols[5]-cols[0], tableHeaderHeight, 13);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 13px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.textAlign = "center";
      const headers = ["CÓDIGO","ARTÍCULO","CANT.","VALOR UNITARIO","TOTAL"];
      for(let i=0;i<5;i++) ctx.fillText(headers[i], (cols[i]+cols[i+1])/2, tableTop+28);
      ctx.textAlign = "left";

      let rowY = tableTop + tableHeaderHeight;
      preparedRows.forEach((row,index)=>{
        const { it, nameLines, rowHeight } = row;
        const y = rowY;
        ctx.fillStyle = index % 2 ? "#fffdfd" : "#ffffff";
        ctx.fillRect(cols[0], y, cols[5]-cols[0], rowHeight);
        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        ctx.strokeRect(cols[0], y, cols[5]-cols[0], rowHeight);
        for(let c=1;c<5;c++){
          ctx.beginPath(); ctx.moveTo(cols[c], y); ctx.lineTo(cols[c], y+rowHeight); ctx.stroke();
        }

        const centerY = y + rowHeight/2 + 5;
        ctx.fillStyle = ink;
        ctx.textAlign = "center";
        ctx.font = "800 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
        ctx.fillText(String(it.id || ""), (cols[0]+cols[1])/2, centerY);
        ctx.fillText(String(Math.max(0, Number(it.qty)||0)), (cols[2]+cols[3])/2, centerY);
        ctx.font = "700 13px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
        ctx.fillText(invoiceMoney(it.price), (cols[3]+cols[4])/2, centerY);
        ctx.fillText(invoiceMoney((Number(it.price)||0)*(Number(it.qty)||0)), (cols[4]+cols[5])/2, centerY);

        ctx.textAlign = "left";
        ctx.font = "600 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
        const nameBlockHeight = nameLines.length * 19;
        const nameStartY = y + (rowHeight - nameBlockHeight)/2 + 15;
        nameLines.forEach((lineText,i)=>ctx.fillText(lineText, cols[1]+12, nameStartY+i*19));
        rowY += rowHeight;
      });
      ctx.textAlign = "left";

      const subtotal = items.reduce((sum,it)=>sum+(Number(it.price)||0)*(Number(it.qty)||0),0);
      const shipping = getShippingCop();
      const total = subtotal + shipping;

      ctx.fillStyle = softPurple; ctx.strokeStyle = "#cdb7e4";
      invoiceRoundRect(ctx, 52, summaryTop, 482, summaryHeight, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = purple;
      ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("INFORMACIÓN", 82, summaryTop+36);
      ctx.fillStyle = muted;
      ctx.font = "500 14px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      const noteLines = [
        "Factura comercial de venta.",
        "Valores expresados en pesos colombianos.",
        "Gracias por confiar en tu consultora de belleza."
      ];
      noteLines.forEach((lineText,i)=>ctx.fillText(lineText,82,summaryTop+68+i*23));

      ctx.fillStyle = softGold; ctx.strokeStyle = "#e1bb74";
      invoiceRoundRect(ctx, 565, summaryTop, 482, summaryHeight, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold;
      ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("RESUMEN DE LA VENTA", 595, summaryTop+36);
      ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillStyle = ink;
      ctx.fillText("Subtotal productos",595,summaryTop+68);
      ctx.fillText("Envío",595,summaryTop+94);
      ctx.textAlign = "right";
      ctx.fillText(invoiceMoney(subtotal),1015,summaryTop+68);
      ctx.fillText(invoiceMoney(shipping),1015,summaryTop+94);
      ctx.strokeStyle = "#e1bb74";
      ctx.beginPath(); ctx.moveTo(595,summaryTop+108); ctx.lineTo(1015,summaryTop+108); ctx.stroke();
      ctx.font = "900 22px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillStyle = gold;
      ctx.fillText(invoiceMoney(total),1015,summaryTop+135);
      ctx.textAlign = "left";

      ctx.fillStyle = rose;
      ctx.font = "500 italic 21px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText("Gracias por confiar en tu consultora de belleza", width/2, footerTop+43);
      ctx.fillStyle = "#a8878f";
      ctx.font = "700 12px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("BELLEZA QUE TRANSFORMA · CONFIANZA QUE PERDURA", width/2, footerTop+74);
      ctx.textAlign = "left";

      const bottomGrad = ctx.createLinearGradient(0,height-58,width,height);
      bottomGrad.addColorStop(0,"#b0446f");
      bottomGrad.addColorStop(.5,"#eaa5b7");
      bottomGrad.addColorStop(1,"#d5a04a");
      ctx.fillStyle = bottomGrad;
      ctx.beginPath();
      ctx.moveTo(0,height-40);
      ctx.quadraticCurveTo(width*.48,height-5,width,height-72);
      ctx.lineTo(width,height);
      ctx.lineTo(0,height);
      ctx.closePath();
      ctx.fill();

      return canvas;
    }

    function invoiceCanvasToBlob(canvas){
      return new Promise((resolve,reject)=>{
        canvas.toBlob(blob=> blob ? resolve(blob) : reject(new Error("No fue posible convertir la factura a PNG.")), "image/png");
      });
    }

    async function invoiceBuildPng(){
      const canvas = await invoiceBuildCanvas();
      const blob = await invoiceCanvasToBlob(canvas);
      return { blob };
    }

    async function invoiceCopyPngFromCart(){
      if(!navigator.clipboard || typeof navigator.clipboard.write !== "function" || typeof ClipboardItem === "undefined"){
        throw new Error("Este navegador no permite copiar imágenes PNG directamente al portapapeles.");
      }

      invoiceValidateInput();
      let built = null;
      const blobPromise = invoiceBuildPng().then(result=>{
        built = result;
        return result.blob;
      });

      await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
      return built;
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

      return { addressLine, barrio, mapLink, city, region, via };
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
    const cartInvoiceBtn = document.getElementById("cartInvoiceBtn");
    const invoicePaymentMethodInp = document.getElementById("invoicePaymentMethod");
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

    if(invoicePaymentMethodInp){
      try{
        const savedPayment = String(localStorage.getItem(INVOICE_PAYMENT_LOCAL_KEY) || "").trim();
        if(savedPayment && Array.from(invoicePaymentMethodInp.options).some(o=>o.value===savedPayment)){
          invoicePaymentMethodInp.value = savedPayment;
        }else{
          invoicePaymentMethodInp.value = "Nequi";
        }
      }catch(_){ invoicePaymentMethodInp.value = "Nequi"; }
      invoicePaymentMethodInp.addEventListener("change", ()=>{
        try{ localStorage.setItem(INVOICE_PAYMENT_LOCAL_KEY, invoicePaymentMethod()); }catch(_){}
      });
    }

    let invoiceCopying = false;
    if(cartInvoiceBtn){
      cartInvoiceBtn.addEventListener("click", async ()=>{
        if(invoiceCopying) return;
        invoiceCopying = true;
        const previousText = cartInvoiceBtn.textContent;
        cartInvoiceBtn.disabled = true;
        cartInvoiceBtn.textContent = "Generando factura...";
        try{
          saveClientToLS();
          saveAddressToLS();
          saveShippingToLS();
          await invoiceCopyPngFromCart();
          cartInvoiceBtn.textContent = "Factura copiada";
        }catch(err){
          console.error("No se pudo copiar la factura PNG:", err);
          alert(String(err?.message || "No se pudo copiar la factura PNG."));
        }finally{
          setTimeout(()=>{
            invoiceCopying = false;
            cartInvoiceBtn.disabled = false;
            cartInvoiceBtn.textContent = previousText;
          }, 1400);
        }
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

    function updateCountTextLoading(){
      if(countEl) countEl.textContent = "Cargando productos…";
    }

    function updateCountTextError(msg){
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
      if(!silent) updateCountTextLoading();
      clearLegacyProductCaches();

      try{
        await warmupPlaceholderOnce();
      }catch(error){
        console.warn("No se pudo preparar la imagen suplente. El catálogo continuará.", error);
      }

      let catalogSource;
      try{
        catalogSource = await loadGoogleSheetCatalog({ refreshImages });
      }catch(err){
        console.error("Error al cargar el Google Sheet oficial.", err);
        if(!silent) updateCountTextError("No se pudieron cargar los productos desde el Google Sheet oficial. Reintenta más tarde.");
        return;
      }

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

    
// ==========================================
// VISTA DE COLLAGE SEGÚN LA VISTA Y FILTROS ACTUALES
// ==========================================
function collageUniqueProducts(products){
  const seen=new Set();
  const out=[];
  for(const p of (Array.isArray(products)?products:[])){
    if(!p) continue;
    const key=String(p.id||p.code||p.name||"").trim();
    if(!key||seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function collageProductRoute(p){
  const route=[
    mainNavigationGroupForProduct(p),
    navigationCategoryForProduct(p),
    navigationFamilyForProduct(p)
  ]
    .map(value=>String(value||"").trim())
    .filter(Boolean);

  const out=[];
  for(const segment of route){
    if(out.length&&cleanNavKey(out[out.length-1])===cleanNavKey(segment)) continue;
    out.push(segment);
  }
  return out;
}

function collageCurrentTitleParts(){
  return [selectedAudience,selectedCategory,selectedFamily]
    .map(value=>String(value||"").trim())
    .filter(Boolean);
}

function collageRemainingRoute(p,titleParts){
  const fullRoute=collageProductRoute(p);
  let common=0;
  while(
    common<titleParts.length&&
    common<fullRoute.length&&
    cleanNavKey(titleParts[common])===cleanNavKey(fullRoute[common])
  ){
    common++;
  }
  return fullRoute.slice(common);
}

function collageBuildRouteTree(products,titleParts){
  const root={ label:"", products:[], children:new Map() };

  for(const p of (Array.isArray(products)?products:[])){
    const route=collageRemainingRoute(p,titleParts);
    let node=root;

    for(const segment of route){
      const key=cleanNavKey(segment)||String(segment||"").trim();
      if(!node.children.has(key)){
        node.children.set(key,{ label:String(segment||"").trim(), products:[], children:new Map() });
      }
      node=node.children.get(key);
    }

    node.products.push(p);
  }

  return root;
}

function collageCurrentSnapshot(){
  const searchActive=getCombinedWordTerms().length>0;
  let products=[];

  if(shouldShowAlbumGrid()){
    const filteredAlbums=buildFilteredAlbums();
    const visibleAlbums=filteredAlbums.filter(album=>!searchActive||(Number(album.count)||0)>0);

    for(const album of visibleAlbums){
      const source=searchActive&&Array.isArray(album.matchingProducts)
        ? album.matchingProducts
        : (Array.isArray(album.products)?album.products:[]);
      products.push(...source);
    }
    products=collageUniqueProducts(products);
  }else{
    products=collageUniqueProducts(buildFilteredList());
  }

  const titleParts=collageCurrentTitleParts();

  return {
    title:titleParts.length?titleParts.join(" › "):"Catálogo",
    titleParts,
    products,
    tree:collageBuildRouteTree(products,titleParts)
  };
}

function collagePriceText(p){
  if(!shouldShowProductPrices()) return "";
  return p&&p.hasPrice===false ? "Consultar precio" : fmtCOP.format(Number(p?.price)||0);
}

function spreCurrentLevelProducts(){
  return currentProductSourceList().filter(p => p && p.hasPrice === false);
}

function spreClipboardText(){
  return spreCurrentLevelProducts()
    .map(p=>{
      const name=String(p && p.name || "")
        .replace(/[\t\r\n]+/g," ")
        .replace(/\s{2,}/g," ")
        .trim();
      const code=String(p && p.id || "").trim();
      return name && code ? `${name}\t${code}` : "";
    })
    .filter(Boolean)
    .join("\r\n");
}

async function spreCopyCurrentLevel(){
  const text=spreClipboardText();
  if(!text) return;

  try{
    if(navigator.clipboard && typeof navigator.clipboard.writeText === "function"){
      await navigator.clipboard.writeText(text);
      return;
    }
  }catch(_){}

  try{
    const helper=document.createElement("textarea");
    helper.value=text;
    helper.setAttribute("readonly","");
    helper.setAttribute("aria-hidden","true");
    helper.style.position="fixed";
    helper.style.left="-9999px";
    helper.style.top="0";
    helper.style.opacity="0";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    helper.setSelectionRange(0,helper.value.length);
    document.execCommand("copy");
    helper.remove();
  }catch(_){}
}

function syncSPREButtonVisibility(){
  const btn=document.getElementById("spreBtn");
  if(!btn) return;
  const visible=Array.isArray(all) && all.length>0;
  btn.hidden=!visible;
  btn.disabled=!visible;
}

function initSPREFeature(){
  const toolbar=document.querySelector(".bar");
  if(!toolbar) return;

  let btn=document.getElementById("spreBtn");
  if(!btn){
    btn=document.createElement("button");
    btn.className="btn-ghost";
    btn.id="spreBtn";
    btn.type="button";
    btn.textContent="SPRE";
    btn.hidden=true;
    btn.setAttribute("aria-label","Copiar nombres y códigos de los productos sin precio del nivel actual");
    const collageBtn=document.getElementById("collageBtn");
    if(collageBtn) toolbar.insertBefore(btn,collageBtn);
    else toolbar.appendChild(btn);
  }

  if(btn.dataset.spreBound!=="1"){
    btn.dataset.spreBound="1";
    btn.addEventListener("click",()=>{ void spreCopyCurrentLevel(); });
  }

  syncSPREButtonVisibility();
}

function initCollageFeature(){
  const toolbar=document.querySelector(".bar");
  const cartButton=document.getElementById("btn-cart");
  if(!toolbar) return;

  let btn=document.getElementById("collageBtn");

  const style=document.createElement("style");
  style.id="collageFeatureStyles";
  style.textContent=`
    .collage-modal{position:fixed;inset:0;z-index:2200;display:none;align-items:center;justify-content:center;padding:18px}
    .collage-modal.open{display:flex}
    .collage-backdrop{position:absolute;inset:0;background:rgba(3,8,18,.78);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
    .collage-shell{position:relative;z-index:1;width:min(1080px,92vw,92vh);aspect-ratio:1/1;max-width:92vw;max-height:92vh;overflow:auto;background:#0f1726;border:1px solid #29354a;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.48);padding:22px}
    .collage-close{position:sticky;top:0;float:right;z-index:3;width:42px;height:42px;border-radius:999px;border:1px solid #334155;background:#172033;color:#fff;font-size:22px;line-height:1;cursor:pointer}
    .collage-heading{padding:4px 56px 14px 2px;text-align:center}
    .collage-route{margin:0;color:#f8fafc;font-size:clamp(23px,3vw,38px);line-height:1.1;font-weight:950;letter-spacing:-.025em}
    .collage-actions{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:12px;margin:0 0 18px}
    .collage-output-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:min(590px,100%)}
    .collage-selector-block{width:min(590px,100%)}
    .collage-control-label{margin:0 0 7px;color:#f8fafc;font-size:14px;line-height:1.2;font-weight:900;text-align:left}
    .collage-type-choices,.collage-format-choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%}
    .collage-type-option,.collage-format-option{min-height:48px;padding:10px 14px;border-radius:14px;border:1px solid #d9c9c1;background:#fffdfb;color:#352b2c;font-weight:900;cursor:pointer;box-shadow:0 4px 14px rgba(141,83,96,.08);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease}
    .collage-type-option:hover:not(:disabled),.collage-format-option:hover{transform:translateY(-1px);border-color:#b9954f;box-shadow:0 7px 18px rgba(141,83,96,.14)}
    .collage-type-option.is-active,.collage-format-option.is-active{background:#a55f70;border-color:#a55f70;color:#fff;box-shadow:0 8px 22px rgba(165,95,112,.28)}
    .collage-type-option:focus-visible,.collage-format-option:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(185,149,79,.24)}
    .collage-type-option:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
    .collage-size-control[hidden],.collage-selection-hint[hidden]{display:none!important}
    .collage-download,.collage-share{min-height:48px;min-width:220px;padding:11px 20px;border-radius:13px;font-weight:950;cursor:pointer}
    .collage-output-actions .collage-download,.collage-output-actions .collage-share{min-width:0;width:100%}
    .collage-download{border:1px solid #a55f70;background:#a55f70;color:#fff;box-shadow:0 8px 22px rgba(165,95,112,.22)}
    .collage-download:hover{background:#8f4f60;border-color:#8f4f60}
    .collage-share{border:1px solid #b9954f;background:#fff7ea;color:#8d5360;box-shadow:0 8px 22px rgba(185,149,79,.14)}
    .collage-share:hover{background:#fff0cf;border-color:#b9954f}
    .collage-download:disabled,.collage-share:disabled{opacity:.6;cursor:wait}
    .collage-selection-hint{width:min(590px,100%);margin:0;padding:13px 14px;border-radius:14px;background:rgba(185,149,79,.10);border:1px solid rgba(185,149,79,.28);color:#f3dfab;font-size:13px;line-height:1.4;font-weight:800;text-align:center}
    .card .description{text-align:justify!important;text-align-last:left!important;text-justify:inter-word!important;hyphens:auto!important;-webkit-hyphens:auto!important}
    .marketplace-preview-modal{position:fixed;inset:0;z-index:2210;display:none;align-items:center;justify-content:center;padding:18px}
    .marketplace-preview-modal.open{display:flex}
    .marketplace-preview-backdrop{position:absolute;inset:0;background:rgba(35,26,28,.62);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
    .marketplace-preview-shell{position:relative;z-index:1;width:min(860px,94vw);max-height:92vh;overflow:auto;background:#fffdfb;border:1px solid #eadfda;border-radius:24px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:22px}
    .marketplace-preview-close{position:sticky;top:0;float:right;z-index:3;width:42px;height:42px;border-radius:999px;border:1px solid #d9c9c1;background:#fff8f6;color:#8d5360;font-size:22px;line-height:1;cursor:pointer}
    .marketplace-preview-heading{padding:4px 56px 12px 2px;text-align:center}
    .marketplace-preview-title{margin:0;color:#352b2c;font-size:clamp(23px,3vw,34px);line-height:1.1;font-weight:950;letter-spacing:-.025em}
    .marketplace-preview-subtitle{margin:8px 0 0;color:#78696b;font-size:14px;line-height:1.35;font-weight:700}
    .marketplace-preview-stage{clear:both;display:flex;justify-content:center;padding:2px 0 8px}
    .marketplace-preview-image{display:block;width:min(100%,720px);height:auto;border-radius:18px;border:1px solid #eadfda;background:linear-gradient(180deg,#fffdfa 0%,#f4eee9 100%);box-shadow:0 10px 24px rgba(141,83,96,.12)}
    .marketplace-preview-status{margin:12px auto 2px;text-align:center;color:#78696b;font-size:14px;line-height:1.35;font-weight:700;max-width:680px}
    .marketplace-preview-actions{display:flex;justify-content:center;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
    .marketplace-preview-download,.marketplace-preview-share,.marketplace-preview-secondary{min-height:44px;min-width:200px;padding:10px 20px;border-radius:13px;font-weight:950;cursor:pointer}
    .marketplace-preview-download{border:1px solid #a55f70;background:#a55f70;color:#fff;box-shadow:0 8px 22px rgba(165,95,112,.22)}
    .marketplace-preview-download:hover{background:#8f4f60;border-color:#8f4f60}
    .marketplace-preview-share{border:1px solid #b9954f;background:#fff7ea;color:#8d5360;box-shadow:0 8px 22px rgba(185,149,79,.14)}
    .marketplace-preview-share:hover{background:#fff0cf;border-color:#b9954f}
    .marketplace-preview-secondary{border:1px solid #d9c9c1;background:#fff8f6;color:#8d5360}
    .marketplace-preview-secondary:hover{background:#fff2ee;border-color:#b9954f}
    .marketplace-preview-download:disabled,.marketplace-preview-share:disabled,.marketplace-preview-secondary:disabled{opacity:.62;cursor:wait}
    .collage-tree{clear:both}
    .collage-branch{margin-top:20px;border-left:2px solid rgba(125,211,252,.28);padding-left:14px}
    .collage-branch .collage-branch{margin-left:26px;margin-top:18px;border-left-color:rgba(34,211,168,.28)}
    .collage-branch .collage-branch .collage-branch{border-left-color:rgba(246,196,83,.28)}
    .collage-subtitle{margin:0 0 12px;color:#eaf0f8;font-weight:900;letter-spacing:.005em;line-height:1.25}
    .collage-depth-1>.collage-subtitle{font-size:clamp(18px,2.1vw,24px)}
    .collage-depth-2>.collage-subtitle{font-size:clamp(16px,1.8vw,20px);color:#dce7f4}
    .collage-depth-3>.collage-subtitle{font-size:15px;color:#c8d4e4}
    .collage-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;align-items:stretch}
    .collage-root-grid{margin-top:4px}
    .collage-item{min-width:0;background:#151e2e;border:1px solid #28354a;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.16);position:relative}
    .collage-item[data-ficha-selectable="true"]{cursor:pointer;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
    .collage-item[data-ficha-selectable="true"]:hover{transform:translateY(-1px);border-color:#b9954f}
    .collage-item[data-ficha-selectable="true"]:focus-visible{outline:none;border-color:#b9954f;box-shadow:0 0 0 3px rgba(185,149,79,.28)}
    .collage-item.is-selected{border:3px solid #b9954f;box-shadow:0 0 0 3px rgba(185,149,79,.26),0 12px 30px rgba(0,0,0,.25)}
    .collage-item.is-selected::after{content:"✓ Seleccionado";position:absolute;top:9px;right:9px;z-index:2;padding:6px 9px;border-radius:999px;background:#b9954f;color:#fff;font-size:11px;line-height:1;font-weight:950;box-shadow:0 4px 14px rgba(0,0,0,.20)}
    .collage-item.is-selected .collage-caption{background:rgba(185,149,79,.13)}
    .collage-image{height:190px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:10px}
    .collage-image img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}
    .collage-caption{padding:12px 12px 14px;text-align:center}
    .collage-name{margin:0;color:#f8fafc;font-size:14px;line-height:1.35;font-weight:850;display:block;white-space:normal;overflow:visible;overflow-wrap:anywhere;min-height:0}
    .collage-price{margin:7px 0 0;color:#dce6f5;font-size:15px;line-height:1.2;font-weight:950}
    .collage-empty{padding:38px 18px;text-align:center;color:#b7c2d3;border:1px dashed #344158;border-radius:18px;background:rgba(255,255,255,.025)}
    body.collage-open{overflow:hidden}
    @media(max-width:640px){
      .collage-modal{padding:8px}
      .collage-shell{width:min(96vw,96vh);aspect-ratio:1/1;max-width:96vw;max-height:96vh;border-radius:18px;padding:14px}
      .collage-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .collage-image{height:145px;padding:6px}
      .collage-caption{padding:9px 8px 11px}
      .collage-name{font-size:12.5px}
      .collage-price{font-size:14px}
      .collage-heading{padding-right:44px;padding-bottom:14px}
      .collage-selector-block{width:100%;max-width:320px}
      .collage-type-choices{grid-template-columns:repeat(2,minmax(0,1fr))}
      .collage-format-choices{grid-template-columns:1fr}
      .collage-type-option,.collage-format-option,.collage-download,.collage-share{width:100%;max-width:320px}
      .marketplace-preview-modal{padding:10px}
      .marketplace-preview-shell{width:min(96vw,96vh);max-height:96vh;border-radius:18px;padding:14px}
      .marketplace-preview-heading{padding-right:44px}
      .marketplace-preview-actions{flex-direction:column}
      .marketplace-preview-download,.marketplace-preview-share,.marketplace-preview-secondary{width:100%;max-width:320px}
      .collage-branch{padding-left:10px;margin-top:16px}
      .collage-branch .collage-branch{margin-left:14px;margin-top:14px}
      #collageBtn{padding-inline:12px}
    }
  `;
  if(!document.getElementById("collageFeatureStyles")) document.head.appendChild(style);

  if(!btn){
    btn=document.createElement("button");
    btn.className="btn-ghost";
    btn.id="collageBtn";
    btn.type="button";
    if(cartButton) toolbar.insertBefore(btn,cartButton);
    else toolbar.appendChild(btn);
  }
  btn.textContent="Folleto";
  btn.setAttribute("aria-label","Mostrar folleto de los productos de la vista actual");

  if(document.getElementById("collageModal")) return;

  const modal=document.createElement("div");
  modal.className="collage-modal";
  modal.id="collageModal";
  modal.setAttribute("aria-hidden","true");
  modal.setAttribute("aria-modal","true");
  modal.setAttribute("role","dialog");
  modal.innerHTML=`
    <div class="collage-backdrop" data-collage-close></div>
    <section class="collage-shell" role="document" aria-labelledby="collageRoute">
      <button class="collage-close" type="button" aria-label="Cerrar" data-collage-close>✕</button>
      <header class="collage-heading">
        <h2 class="collage-route" id="collageRoute"></h2>
      </header>
      <div class="collage-actions">
        <div class="collage-selector-block">
          <div class="collage-control-label">Tipo</div>
          <div class="collage-type-choices" role="group" aria-label="Tipo de imagen">
            <button class="collage-type-option is-active" id="collageTypeCollageBtn" type="button" data-collage-type="collage" aria-pressed="true">Collage</button>
            <button class="collage-type-option" id="collageFichaBtn" type="button" data-collage-type="ficha" aria-pressed="false" disabled>Ficha</button>
          </div>
        </div>
        <div class="collage-selector-block collage-size-control" id="collageSizeControl">
          <div class="collage-control-label">Tamaño</div>
          <div class="collage-format-choices" role="group" aria-label="Tamaño del collage">
            <button class="collage-format-option is-active" type="button" data-collage-format="instagram" aria-pressed="true">Instagram · 1080 × 1350</button>
            <button class="collage-format-option" type="button" data-collage-format="marketplace" aria-pressed="false">Marketplace · 1200 × 1200</button>
          </div>
        </div>
        <p class="collage-selection-hint" id="collageSelectionHint" hidden></p>
        <div class="collage-output-actions">
          <button class="collage-share" id="collageShareBtn" type="button" disabled>Preparando imagen…</button>
          <button class="collage-download" id="collageDownloadBtn" type="button" disabled>Preparando PNG…</button>
        </div>
      </div>
      <div class="collage-tree" id="collageTree" role="listbox" aria-label="Productos del collage; selecciona uno para crear su ficha"></div>
    </section>
  `;
  document.body.appendChild(modal);

  const routeEl=modal.querySelector("#collageRoute");
  const collageTree=modal.querySelector("#collageTree");
  const closeBtn=modal.querySelector(".collage-close");
  const collageTypeBtn=modal.querySelector("#collageTypeCollageBtn");
  const fichaBtn=modal.querySelector("#collageFichaBtn");
  const sizeControl=modal.querySelector("#collageSizeControl");
  const selectionHint=modal.querySelector("#collageSelectionHint");
  const downloadBtn=modal.querySelector("#collageDownloadBtn");
  const shareBtn=modal.querySelector("#collageShareBtn");
  const formatButtons=[...modal.querySelectorAll("[data-collage-format]")];
  let collageSelectedProduct=null;
  let collageExportMode="collage";
  let collagePreparedShareFile=null;
  let collagePreparedShareKey="";
  let collagePrepareSequence=0;
  let fichaPreparedFile=null;
  let fichaPreparedKey="";
  let fichaPrepareSequence=0;

  const COLLAGE_EXPORT_FORMATS={
    instagram:{
      key:"instagram",
      label:"Instagram",
      pageW:1080,
      pageH:1350,
      margin:48,
      accentText:"Selección del catálogo",
      downloadName:"collage-instagram-1080x1350.png"
    },
    marketplace:{
      key:"marketplace",
      label:"Marketplace",
      pageW:1200,
      pageH:1200,
      margin:52,
      accentText:"Ideal para Facebook Marketplace",
      downloadName:"collage-marketplace-1200x1200.png"
    }
  };

  function getCollageExportFormat(){
    const active=formatButtons.find(button=>button.classList.contains("is-active"));
    const selected=String(active?.dataset?.collageFormat||"instagram").trim().toLowerCase();
    return COLLAGE_EXPORT_FORMATS[selected]||COLLAGE_EXPORT_FORMATS.instagram;
  }

  function collageShareCacheKey(snapshot,format){
    const productKey=(snapshot?.products||[])
      .map(product=>String(product?.id||product?.code||product?.name||""))
      .join("|");
    return `${format?.key||"instagram"}::${String(snapshot?.title||"")}::${productKey}`;
  }

  function canClipboardPng(){
    return !!(navigator?.clipboard && typeof navigator.clipboard.write==="function" && typeof window.ClipboardItem==="function");
  }

  function copyPreparedPngFile(file){
    if(!file || file.type!=="image/png") throw new Error("No hay una imagen PNG lista para copiar.");
    if(!canClipboardPng()) throw new Error("Este navegador no permite copiar imágenes PNG al portapapeles.");
    return navigator.clipboard.write([new ClipboardItem({"image/png":file})]);
  }

  function downloadPreparedPngFile(file,fileName){
    if(!file) throw new Error("No hay una imagen PNG lista para descargar.");
    const url=URL.createObjectURL(file);
    const a=document.createElement("a");
    a.href=url;
    a.download=fileName||file.name||"imagen.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function setActionPreparing(){
    if(shareBtn){
      shareBtn.disabled=true;
      shareBtn.textContent="Preparando imagen…";
      shareBtn.title="";
    }
    if(downloadBtn){
      downloadBtn.disabled=true;
      downloadBtn.textContent="Preparando PNG…";
    }
  }

  function setActionReady(){
    const ready=collageExportMode==="ficha" ? !!fichaPreparedFile : !!collagePreparedShareFile;
    if(shareBtn){
      shareBtn.disabled=!ready;
      shareBtn.textContent="Copiar imagen";
      shareBtn.title=canClipboardPng()?"":"Tu navegador podría no permitir copiar imágenes al portapapeles.";
    }
    if(downloadBtn){
      downloadBtn.disabled=!ready;
      downloadBtn.textContent="Descargar PNG";
    }
  }

  function invalidateCollageSharePreparation(){
    collagePreparedShareFile=null;
    collagePreparedShareKey="";
    collagePrepareSequence++;
    if(collageExportMode==="collage") setActionPreparing();
  }

  function queueCollageSharePreparation(){
    const snapshot=collageCurrentSnapshot();
    if(!snapshot.products.length){
      collagePreparedShareFile=null;
      collagePreparedShareKey="";
      if(collageExportMode==="collage"){
        if(shareBtn){
          shareBtn.disabled=true;
          shareBtn.textContent="Copiar imagen";
        }
        if(downloadBtn){
          downloadBtn.disabled=true;
          downloadBtn.textContent="Descargar PNG";
        }
      }
      return;
    }
    const format=getCollageExportFormat();
    const key=collageShareCacheKey(snapshot,format);
    const token=++collagePrepareSequence;
    collagePreparedShareFile=null;
    collagePreparedShareKey="";
    if(collageExportMode==="collage") setActionPreparing();
    window.setTimeout(()=>{
      downloadCollageImage("prepare",{token,key}).catch(error=>{
        console.info("No se pudo preparar el PNG del collage.",error);
      });
    },0);
  }

  function fichaPreparationKey(product){
    return String(product?.id||product?.code||product?.name||"").trim();
  }

  function invalidateFichaPreparation(){
    fichaPreparedFile=null;
    fichaPreparedKey="";
    fichaPrepareSequence++;
    if(collageExportMode==="ficha") setActionPreparing();
  }

  function queueFichaPreparation(){
    const product=collageSelectedProduct;
    const key=fichaPreparationKey(product);
    const token=++fichaPrepareSequence;
    fichaPreparedFile=null;
    fichaPreparedKey="";
    if(collageExportMode==="ficha") setActionPreparing();

    if(!product || !key){
      if(collageExportMode==="ficha"){
        if(shareBtn){
          shareBtn.disabled=true;
          shareBtn.textContent="Copiar imagen";
        }
        if(downloadBtn){
          downloadBtn.disabled=true;
          downloadBtn.textContent="Descargar PNG";
        }
      }
      return;
    }

    window.setTimeout(async()=>{
      try{
        const {canvas,fileName}=await buildMarketplacePresentationCanvas(product);
        const prepared=await prepareCanvasPngFile(canvas,fileName);
        const file=prepared.file || (window.File ? new File([prepared.blob],fileName||"ficha.png",{type:"image/png"}) : null);
        const stillCurrent=token===fichaPrepareSequence && key===fichaPreparationKey(collageSelectedProduct);
        if(!stillCurrent) return;
        fichaPreparedFile=file;
        fichaPreparedKey=key;
        if(collageExportMode==="ficha") setActionReady();
      }catch(error){
        const stillCurrent=token===fichaPrepareSequence;
        if(stillCurrent){
          fichaPreparedFile=null;
          fichaPreparedKey="";
          if(collageExportMode==="ficha"){
            if(shareBtn){
              shareBtn.disabled=true;
              shareBtn.textContent="Copiar imagen";
            }
            if(downloadBtn){
              downloadBtn.disabled=true;
              downloadBtn.textContent="Descargar PNG";
            }
          }
        }
        console.error("No se pudo preparar la ficha del producto.",error);
      }
    },0);
  }

  function setCollageExportFormat(key){
    const selected=COLLAGE_EXPORT_FORMATS[key]?key:"instagram";
    for(const button of formatButtons){
      const active=button.dataset.collageFormat===selected;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",active?"true":"false");
    }
    if(modal.classList.contains("open") && collageExportMode==="collage") queueCollageSharePreparation();
  }

  function setCollageExportMode(mode){
    collageExportMode=mode==="ficha"?"ficha":"collage";
    const isFicha=collageExportMode==="ficha";
    modal.classList.toggle("is-ficha-mode",isFicha);
    collageTypeBtn?.classList.toggle("is-active",!isFicha);
    collageTypeBtn?.setAttribute("aria-pressed",isFicha?"false":"true");
    fichaBtn?.classList.toggle("is-active",isFicha);
    fichaBtn?.setAttribute("aria-pressed",isFicha?"true":"false");
    if(sizeControl) sizeControl.hidden=isFicha;
    if(selectionHint) selectionHint.hidden=!isFicha;

    if(isFicha){
      if(fichaPreparedFile && fichaPreparedKey===fichaPreparationKey(collageSelectedProduct)) setActionReady();
      else queueFichaPreparation();
    }else{
      if(collagePreparedShareFile && collagePreparedShareKey===collageShareCacheKey(collageCurrentSnapshot(),getCollageExportFormat())) setActionReady();
      else queueCollageSharePreparation();
    }
  }

  function setCollageSelectedProduct(product,item){
    collageSelectedProduct=product||null;
    for(const card of collageTree.querySelectorAll('.collage-item.is-selected')){
      card.classList.remove('is-selected');
      card.setAttribute('aria-selected','false');
    }
    if(collageSelectedProduct && item){
      item.classList.add('is-selected');
      item.setAttribute('aria-selected','true');
    }
    if(fichaBtn) fichaBtn.disabled=!collageSelectedProduct;
    if(selectionHint){
      selectionHint.textContent=collageSelectedProduct
        ? `Producto para Ficha: ${String(collageSelectedProduct.name||'Producto').trim()}`
        : 'No hay un producto disponible para preparar Ficha.';
    }
    invalidateFichaPreparation();
    if(collageExportMode==="ficha" && modal.classList.contains("open")) queueFichaPreparation();
  }

  function closeCollage(){
    if(!modal.classList.contains("open")) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden","true");
    document.body.classList.remove("collage-open");
    btn.focus({preventScroll:true});
  }

  function makeCollageGrid(products,isRoot=false){
    const gridEl=document.createElement("div");
    gridEl.className="collage-grid"+(isRoot?" collage-root-grid":"");
    const frag=document.createDocumentFragment();

    for(const p of products){
      const item=document.createElement("article");
      item.className="collage-item";
      item._collageProduct=p;
      const fichaSelectable=!(p && p.isGiftGalleryImage);
      item.dataset.fichaSelectable=fichaSelectable?"true":"false";
      if(fichaSelectable){
        item.tabIndex=0;
        item.setAttribute("role","option");
        item.setAttribute("aria-selected","false");
        item.setAttribute("aria-label",`Seleccionar ${String(p?.name||"producto").trim()||"producto"} para crear ficha`);
        const selectThis=()=>setCollageSelectedProduct(p,item);
        item.addEventListener("click",selectThis);
        item.addEventListener("keydown",event=>{
          if(event.key==="Enter"||event.key===" "){
            event.preventDefault();
            selectThis();
          }
        });
      }

      const imageBox=document.createElement("div");
      imageBox.className="collage-image";
      imageBox.appendChild(makeImgFromFilename(p.imgFilename,p.name,p.docsImageUrl));

      const caption=document.createElement("div");
      caption.className="collage-caption";

      const name=document.createElement("p");
      name.className="collage-name";
      name.textContent=String(p.name||"").trim()||"Producto";
      name.title=name.textContent;
      caption.appendChild(name);

      const priceText=collagePriceText(p);
      if(priceText){
        const price=document.createElement("p");
        price.className="collage-price";
        price.textContent=priceText;
        caption.appendChild(price);
      }

      item.append(imageBox,caption);
      frag.appendChild(item);
    }

    gridEl.appendChild(frag);
    return gridEl;
  }

  function appendTreeChildren(parentEl,node,depth){
    for(const child of node.children.values()){
      const branch=document.createElement("section");
      const safeDepth=Math.min(Math.max(depth,1),3);
      branch.className=`collage-branch collage-depth-${safeDepth}`;

      const heading=document.createElement(depth===1?"h3":"h4");
      heading.className="collage-subtitle";
      heading.textContent=child.label;
      branch.appendChild(heading);

      if(child.products.length){
        branch.appendChild(makeCollageGrid(child.products));
      }

      appendTreeChildren(branch,child,depth+1);
      parentEl.appendChild(branch);
    }
  }

  function collageExportBlocks(tree){
    const blocks=[];
    if(tree.products.length) blocks.push({type:"grid",depth:0,products:tree.products});

    function walk(node,depth){
      for(const child of node.children.values()){
        blocks.push({type:"heading",depth,label:child.label});
        if(child.products.length) blocks.push({type:"grid",depth,products:child.products});
        walk(child,depth+1);
      }
    }

    walk(tree,1);
    return blocks;
  }

  function collageCanvasRoundRect(ctx,x,y,w,h,r){
    const rr=Math.max(0,Math.min(r,Math.min(w,h)/2));
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }

  function collageCanvasWrapLines(ctx,text,maxWidth){
    const words=String(text||"").trim().split(/\s+/).filter(Boolean);
    if(!words.length) return ["Producto"];
    const lines=[];
    let line="";
    for(const word of words){
      const test=line?`${line} ${word}`:word;
      if(line&&ctx.measureText(test).width>maxWidth){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    }
    if(line) lines.push(line);
    return lines;
  }

  function collageExportImageUrl(p){
    const preferred=String(p?.docsImageUrl||"").trim();
    if(shouldShowProductImages()&&preferred) return preferred;
    return productPlaceholderAbsoluteUrl();
  }

  function collageLoadCanvasImage(p){
    const candidates=[
      collageExportImageUrl(p),
      productPlaceholderAbsoluteUrl(),
      COMPANY_LOGO
    ].map(v=>String(v||"").trim()).filter(Boolean);

    return new Promise(resolve=>{
      let index=0;
      const tryNext=()=>{
        if(index>=candidates.length){ resolve(null); return; }
        const img=new Image();
        const url=candidates[index++];
        try{
          const parsed=new URL(url,location.href);
          if(parsed.origin!==location.origin) img.crossOrigin="anonymous";
        }catch(_){}
        img.onload=()=>resolve(img);
        img.onerror=tryNext;
        img.src=url;
      };
      tryNext();
    });
  }

  function marketplacePresentationSanitizeFilename(value){
    const base=String(value||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase();
    return base.replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"") || "producto";
  }

  function marketplacePresentationTrimLine(ctx,text,maxWidth){
    let value=String(text||"").trim();
    if(!value) return "";
    if(ctx.measureText(value).width<=maxWidth) return value;
    while(value && ctx.measureText(`${value}…`).width>maxWidth){
      value=value.slice(0,-1).trimEnd();
    }
    return `${value}…`;
  }

  function marketplacePresentationWrapLines(ctx,text,maxWidth,maxLines=999){
    const words=String(text||"").trim().split(/\s+/).filter(Boolean);
    if(!words.length) return [];
    const lines=[];
    let line="";
    for(const word of words){
      const test=line?`${line} ${word}`:word;
      if(line && ctx.measureText(test).width>maxWidth){
        lines.push(line);
        line=word;
      }else{
        line=test;
      }
    }
    if(line) lines.push(line);
    if(lines.length<=maxLines) return lines;
    const clipped=lines.slice(0,maxLines);
    clipped[maxLines-1]=marketplacePresentationTrimLine(ctx,clipped[maxLines-1],maxWidth);
    return clipped;
  }

  function marketplacePresentationDrawJustified(ctx,lines,x,y,maxWidth,lineHeight){
    let currentY=y;
    for(let i=0;i<lines.length;i++){
      const line=String(lines[i]||"").trim();
      const words=line.split(/\s+/).filter(Boolean);
      const isLast=i===lines.length-1;
      if(!line){
        currentY+=lineHeight;
        continue;
      }
      if(isLast || words.length<3){
        ctx.fillText(line,x,currentY);
        currentY+=lineHeight;
        continue;
      }
      const widths=words.map(word=>ctx.measureText(word).width);
      const wordsWidth=widths.reduce((sum,width)=>sum+width,0);
      const gap=(maxWidth-wordsWidth)/(words.length-1);
      let currentX=x;
      for(let j=0;j<words.length;j++){
        ctx.fillText(words[j],currentX,currentY);
        currentX+=widths[j]+(j<words.length-1?gap:0);
      }
      currentY+=lineHeight;
    }
    return currentY;
  }

  function marketplacePresentationDrawContainedImage(ctx,img,x,y,w,h,padding=0){
    if(!img || !img.naturalWidth || !img.naturalHeight) return;
    const aw=Math.max(1,w-padding*2);
    const ah=Math.max(1,h-padding*2);
    const scale=Math.min(aw/img.naturalWidth,ah/img.naturalHeight);
    const dw=img.naturalWidth*scale;
    const dh=img.naturalHeight*scale;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
  }

  function marketplacePresentationLocalAssetUrl(relativePath){
    if(String(location.protocol||"").toLowerCase()!=="file:") return "";
    const clean=String(relativePath||"").replace(/^\/+/,"");
    if(!clean) return "";
    try{
      return new URL(encodeRepoPath(clean),location.href).href;
    }catch(_){
      return "";
    }
  }

  function marketplacePresentationRawGitHubUrl(relativePath){
    const clean=String(relativePath||"").replace(/^\/+/,"");
    if(!clean) return "";
    const owner=encodeURIComponent(String(GITHUB_CATALOG_SOURCE.owner||""));
    const repo=encodeURIComponent(String(GITHUB_CATALOG_SOURCE.repo||""));
    const branch=encodeURIComponent(String(GITHUB_CATALOG_SOURCE.branch||"main"));
    const basePath=encodeRepoPath(`${GITHUB_CATALOG_SOURCE.catalogDir}/${clean}`);
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${basePath}`;
  }

  function marketplacePresentationProductCandidates(p){
    const dynamicImages=Array.isArray(p?.imageUrls)?p.imageUrls:[];
    const preferred=String(p?.docsImageUrl||"").trim();
    return [
      preferred,
      ...dynamicImages,
      collageExportImageUrl(p),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/suplente.webp`),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/suplente.png`),
      productPlaceholderAbsoluteUrl(),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/logo_empresa.webp`),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/logo_empresa.png`),
      ...COMPANY_LOGOS
    ];
  }

  function marketplacePresentationLogoCandidates(){
    const isLocalFile=String(location.protocol||"").toLowerCase()==="file:";
    return [
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/logo_empresa.webp`),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/logo_empresa.png`),
      ...COMPANY_LOGOS,
      ...(isLocalFile?[]:[
        marketplacePresentationLocalAssetUrl(`${LOGOS_DIR}/logo_empresa.webp`),
        marketplacePresentationLocalAssetUrl(`${LOGOS_DIR}/logo_empresa.png`)
      ]),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/suplente.webp`),
      marketplacePresentationRawGitHubUrl(`${LOGOS_DIR}/suplente.png`),
      productPlaceholderAbsoluteUrl()
    ];
  }

  function marketplacePresentationSafeReadyDomImage(img){
    if(String(location.protocol||"").toLowerCase()==="file:") return null;
    if(!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return null;
    try{
      const src=img.currentSrc||img.src||"";
      const parsed=new URL(src,location.href);
      if(parsed.origin!==location.origin && img.crossOrigin!=="anonymous") return null;
    }catch(_){}
    return img;
  }

  function marketplacePresentationLoadImageCandidates(candidates,timeoutMs=6000){
    const urls=[...new Set((Array.isArray(candidates)?candidates:[candidates])
      .map(value=>String(value||"").trim())
      .filter(Boolean))];
    return new Promise(resolve=>{
      let index=0;
      let settled=false;
      let activeImg=null;
      const finish=value=>{
        if(settled) return;
        settled=true;
        clearTimeout(timer);
        if(activeImg){ activeImg.onload=null; activeImg.onerror=null; }
        resolve(value||null);
      };
      const timer=setTimeout(()=>finish(null),Math.max(1500,Number(timeoutMs)||6000));
      const tryNext=()=>{
        if(settled) return;
        if(index>=urls.length){ finish(null); return; }
        const img=new Image();
        activeImg=img;
        const url=urls[index++];
        try{
          const parsed=new URL(url,location.href);
          if(parsed.origin!==location.origin) img.crossOrigin="anonymous";
        }catch(_){}
        img.onload=()=>finish(img);
        img.onerror=tryNext;
        img.src=url;
      };
      tryNext();
    });
  }

  function marketplacePresentationOpenDownloadWindow(){
    try{
      const popup=window.open("about:blank","irenismb_ficha_png");
      if(!popup) return null;
      try{ popup.opener=null; }catch(_){}
      try{
        popup.document.open();
        popup.document.write('<!doctype html><meta charset="utf-8"><title>Generando ficha</title><body style="font-family:system-ui,Arial,sans-serif;padding:28px;color:#352b2c;background:#fffdfb"><p style="font-weight:800">Generando ficha PNG…</p><p>Esta pestaña se usa solo como respaldo de descarga.</p></body>');
        popup.document.close();
      }catch(_){}
      return popup;
    }catch(_){
      return null;
    }
  }

  function marketplacePresentationTriggerDataDownload(dataUrl,fileName,targetDocument=document){
    const a=targetDocument.createElement("a");
    a.href=dataUrl;
    a.download=fileName;
    a.rel="noopener";
    a.style.display="none";
    targetDocument.body.appendChild(a);
    a.click();
    a.remove();
  }

  function marketplacePresentationCanvasSafeImage(img,label="imagen"){
    if(!img || !img.naturalWidth || !img.naturalHeight) return null;
    try{
      const probe=document.createElement("canvas");
      probe.width=2;
      probe.height=2;
      const pctx=probe.getContext("2d");
      pctx.drawImage(img,0,0,2,2);
      // Esta lectura falla inmediatamente si la imagen contaminaría el canvas.
      pctx.getImageData(0,0,1,1);
      return img;
    }catch(error){
      console.warn(`La ${label} no es segura para exportar en canvas; se omite en la ficha.`,error);
      return null;
    }
  }

  function canNativeSharePng(file){
    if(!(navigator && typeof navigator.share === "function")) return false;
    if(typeof navigator.canShare === "function"){
      try{ return navigator.canShare({ files:[file] }); }catch(_){ return false; }
    }
    return true;
  }

  function sharePreparedPngFile(file){
    if(!(window.File && navigator && typeof navigator.share === "function")){
      throw new Error("Este navegador no permite compartir archivos PNG directamente.");
    }
    if(!file || file.type!=="image/png" || !canNativeSharePng(file)){
      throw new Error("Este navegador no permite compartir archivos PNG directamente.");
    }
    // navigator.share debe ejecutarse inmediatamente dentro del clic del usuario.
    // El PNG se prepara antes para conservar la activación necesaria en móviles.
    return navigator.share({ files:[file] });
  }

  function canvasToPngBlob(canvas){
    if(!canvas) return Promise.reject(new Error("No hay contenido listo para exportar."));
    return new Promise((resolve,reject)=>{
      try{
        canvas.toBlob(value=>value?resolve(value):reject(new Error("No se pudo crear el archivo PNG.")),"image/png",1);
      }catch(error){ reject(error); }
    });
  }

  async function prepareCanvasPngFile(canvas,fileName){
    const blob=await canvasToPngBlob(canvas);
    const file=window.File ? new File([blob],fileName||"imagen.png",{type:"image/png"}) : null;
    return {blob,file};
  }

  let marketplacePreviewState=null;

  function ensureMarketplacePresentationModal(){
    if(marketplacePreviewState) return marketplacePreviewState;

    const modal=document.createElement("div");
    modal.className="marketplace-preview-modal";
    modal.id="marketplacePresentationModal";
    modal.setAttribute("aria-hidden","true");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("role","dialog");
    modal.innerHTML=`
      <div class="marketplace-preview-backdrop" data-marketplace-preview-close></div>
      <section class="marketplace-preview-shell" role="document" aria-labelledby="marketplacePreviewTitle">
        <button class="marketplace-preview-close" type="button" aria-label="Cerrar" data-marketplace-preview-close>✕</button>
        <header class="marketplace-preview-heading">
          <h2 class="marketplace-preview-title" id="marketplacePreviewTitle">Ficha del producto</h2>
          <p class="marketplace-preview-subtitle" id="marketplacePreviewSubtitle" hidden></p>
        </header>
        <div class="marketplace-preview-stage">
          <img class="marketplace-preview-image" id="marketplacePreviewImage" alt="Vista previa de la ficha del producto" />
        </div>
        <p class="marketplace-preview-status" id="marketplacePreviewStatus">Pulsa Ficha para preparar la vista previa.</p>
        <div class="marketplace-preview-actions">
          <button class="marketplace-preview-download" id="marketplacePreviewDownloadBtn" type="button" disabled>Descargar PNG</button>
          <button class="marketplace-preview-share" id="marketplacePreviewShareBtn" type="button" disabled>Compartir PNG</button>
          <button class="marketplace-preview-secondary" id="marketplacePreviewCloseBtn" type="button" data-marketplace-preview-close>Cerrar</button>
        </div>
      </section>
    `;
    document.body.appendChild(modal);

    const state={
      modal,
      titleEl:modal.querySelector('#marketplacePreviewTitle'),
      subtitleEl:modal.querySelector('#marketplacePreviewSubtitle'),
      imageEl:modal.querySelector('#marketplacePreviewImage'),
      statusEl:modal.querySelector('#marketplacePreviewStatus'),
      downloadBtn:modal.querySelector('#marketplacePreviewDownloadBtn'),
      shareBtn:modal.querySelector('#marketplacePreviewShareBtn'),
      canvas:null,
      shareFile:null,
      fileName:'',
      product:null,
      opener:null,
      busy:false
    };

    const close=()=>{
      if(!state.modal.classList.contains('open')) return;
      state.modal.classList.remove('open');
      state.modal.setAttribute('aria-hidden','true');
      const collageModal=document.getElementById('collageModal');
      if(!(collageModal && collageModal.classList.contains('open'))){
        document.body.classList.remove('collage-open');
      }
      if(state.opener && typeof state.opener.focus==='function'){
        try{ state.opener.focus({preventScroll:true}); }catch(_){ try{ state.opener.focus(); }catch(_e){} }
      }
    };

    modal.addEventListener('click',event=>{
      if(event.target && event.target.closest('[data-marketplace-preview-close]')) close();
    });
    modal.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        event.preventDefault();
        close();
      }
    });

    state.downloadBtn.addEventListener('click',async ()=>{
      if(!state.canvas || state.busy) return;
      const original=state.downloadBtn.textContent;
      state.busy=true;
      state.downloadBtn.disabled=true;
      if(state.shareBtn) state.shareBtn.disabled=true;
      state.downloadBtn.textContent='Generando PNG…';
      try{
        const blob=await new Promise((resolve,reject)=>{
          try{
            state.canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo crear el archivo PNG.')),'image/png',1);
          }catch(error){ reject(error); }
        });
        const objectUrl=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=objectUrl;
        a.download=state.fileName || 'ficha_marketplace.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
        state.statusEl.textContent='PNG listo. Si tu navegador no lo guardó automáticamente, revisa la carpeta Descargas.';
        state.downloadBtn.textContent='Descargada';
        setTimeout(()=>{
          if(state.downloadBtn){
            state.downloadBtn.textContent='Descargar PNG';
            state.downloadBtn.disabled=false;
          }
          if(state.shareBtn) state.shareBtn.disabled=!state.canvas;
        },1100);
      }catch(error){
        console.error('No se pudo descargar la ficha Marketplace.',error);
        state.statusEl.textContent='No se pudo descargar el PNG. Abre la consola del navegador (F12) para ver el error exacto.';
        state.downloadBtn.textContent=original;
        state.downloadBtn.disabled=false;
        if(state.shareBtn) state.shareBtn.disabled=!state.canvas;
      }finally{
        state.busy=false;
      }
    });

    state.shareBtn?.addEventListener('click',async ()=>{
      if(!state.shareFile || state.busy) return;
      const original=state.shareBtn.textContent;
      state.busy=true;
      state.shareBtn.disabled=true;
      state.downloadBtn.disabled=true;
      state.shareBtn.textContent='Compartiendo…';
      try{
        const sharePromise=sharePreparedPngFile(state.shareFile);
        await sharePromise;
        state.statusEl.textContent='';
        state.shareBtn.textContent='Compartida';
        setTimeout(()=>{
          if(state.shareBtn){
            state.shareBtn.textContent='Compartir PNG';
            state.shareBtn.disabled=!state.shareFile;
          }
          if(state.downloadBtn) state.downloadBtn.disabled=!state.canvas;
        },1100);
      }catch(error){
        if(error && error.name==='AbortError'){
          state.statusEl.textContent='';
        }else{
          console.error('No se pudo compartir la ficha Marketplace.',error);
          state.statusEl.textContent='Este navegador no permite compartir archivos PNG directamente.';
        }
        state.shareBtn.textContent=original;
        state.shareBtn.disabled=!state.shareFile;
        state.downloadBtn.disabled=!state.canvas;
      }finally{
        state.busy=false;
      }
    });

    marketplacePreviewState=state;
    return state;
  }

  function openMarketplacePresentationModal(opener){
    const state=ensureMarketplacePresentationModal();
    state.opener=opener || null;
    state.modal.classList.add('open');
    state.modal.setAttribute('aria-hidden','false');
    document.body.classList.add('collage-open');
    return state;
  }

  async function buildMarketplacePresentationCanvas(p){
    const [loadedProductImage,loadedLogoImage]=await Promise.all([
      collageLoadCanvasImage(p),
      collageLoadCanvasImage({ docsImageUrl:COMPANY_LOGO })
    ]);
    const productImage=marketplacePresentationCanvasSafeImage(loadedProductImage,'imagen del producto');
    const logoImage=marketplacePresentationCanvasSafeImage(loadedLogoImage,'logo');

    const canvas=document.createElement('canvas');
    canvas.width=1200;
    canvas.height=1200;
    const ctx=canvas.getContext('2d');
    const W=canvas.width;
    const H=canvas.height;

    const cream='#fffdfb';
    const dark='#352b2c';
    const mauve='#a55f70';
    const mauveDark='#8d5360';
    const muted='#78696b';
    const gold='#b9954f';
    const border='#eadfda';
    const divider='#e6d8d2';

    const bg=ctx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#fffdfa');
    bg.addColorStop(.45,'#faf6f2');
    bg.addColorStop(1,'#f3ece7');
    ctx.fillStyle=bg;
    ctx.fillRect(0,0,W,H);
    ctx.textBaseline='top';

    const headerX=46;
    const headerY=34;
    const headerW=W-92;
    const headerH=126;
    collageCanvasRoundRect(ctx,headerX,headerY,headerW,headerH,22);
    ctx.fillStyle=cream;
    ctx.fill();
    ctx.strokeStyle=border;
    ctx.lineWidth=1.2;
    ctx.stroke();

    marketplacePresentationDrawContainedImage(ctx,logoImage,64,52,78,78,2);
    ctx.fillStyle=mauveDark;
    ctx.font='900 24px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    ctx.fillText('IRENISMB STOCK NATURA',164,61);
    ctx.fillStyle=muted;
    ctx.font='600 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    ctx.fillText('Natura & AVON · Santa Marta · Envíos a toda Colombia',164,96);
    ctx.fillStyle=gold;
    collageCanvasRoundRect(ctx,66,140,W-132,4,2);
    ctx.fill();

    const imageCard={x:58,y:194,w:470,h:438};
    collageCanvasRoundRect(ctx,imageCard.x,imageCard.y,imageCard.w,imageCard.h,24);
    ctx.fillStyle=cream;
    ctx.fill();
    ctx.strokeStyle=border;
    ctx.lineWidth=1.2;
    ctx.stroke();
    marketplacePresentationDrawContainedImage(ctx,productImage,imageCard.x,imageCard.y,imageCard.w,imageCard.h,30);

    const textX=566;
    const textW=W-textX-58;
    let y=205;
    ctx.fillStyle=mauve;
    ctx.font='900 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    ctx.fillText('PRESENTACIÓN DE PRODUCTO',textX,y);
    y+=34;

    ctx.fillStyle=dark;
    ctx.font='900 31px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    let titleLines=marketplacePresentationWrapLines(ctx,String(p.name||'Producto'),textW,5);
    for(const line of titleLines){
      ctx.fillText(line,textX,y);
      y+=38;
    }

    y+=6;
    if(shouldShowProductPrices() && p.hasPrice!==false && Number(p.price)>0){
      ctx.fillStyle=mauveDark;
      ctx.font='950 34px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
      ctx.fillText(fmtCOP.format(p.price),textX,y);
      y+=50;
    }

    const metaParts=[];
    if(p.id) metaParts.push(`Código ${p.id}`);
    if(p.category) metaParts.push(String(p.category).trim());
    if(p.subcategory) metaParts.push(String(p.subcategory).trim());
    ctx.fillStyle=muted;
    ctx.font='650 15px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    const metaLines=marketplacePresentationWrapLines(ctx,metaParts.filter(Boolean).join(' · '),textW,3);
    for(const line of metaLines){
      ctx.fillText(line,textX,y);
      y+=22;
    }

    const descX=58;
    const descY=672;
    const descW=W-116;
    const descH=370;
    collageCanvasRoundRect(ctx,descX,descY,descW,descH,24);
    ctx.fillStyle=cream;
    ctx.fill();
    ctx.strokeStyle=border;
    ctx.lineWidth=1.2;
    ctx.stroke();

    ctx.fillStyle=mauve;
    ctx.font='900 17px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    ctx.fillText('DESCRIPCIÓN',descX+24,descY+22);

    const description=String(p.description||'').trim()||'Descripción no disponible.';
    const descTextX=descX+24;
    const descTextY=descY+58;
    const descTextW=descW-48;
    const lineHeight=28;
    const maxLines=10;
    ctx.fillStyle=dark;
    ctx.font='500 17px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    const fullLines=marketplacePresentationWrapLines(ctx,description,descTextW,999);
    let descLines=fullLines.slice(0,maxLines);
    if(fullLines.length>maxLines){
      descLines[maxLines-1]=marketplacePresentationTrimLine(ctx,descLines[maxLines-1],descTextW);
    }
    marketplacePresentationDrawJustified(ctx,descLines,descTextX,descTextY,descTextW,lineHeight);

    const footerLineY=H-110;
    ctx.strokeStyle=divider;
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(58,footerLineY);
    ctx.lineTo(W-58,footerLineY);
    ctx.stroke();
    ctx.textAlign='center';
    ctx.fillStyle=dark;
    ctx.font='800 14px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    ctx.fillText('IRENISMB STOCK NATURA',W/2,H-84);
    ctx.fillStyle=muted;
    ctx.font='600 13px system-ui, -apple-system, Segoe UI, Arial, sans-serif';
    ctx.fillText('Santa Marta · WhatsApp +57 304 208 8961',W/2,H-60);
    ctx.textAlign='left';

    const code=String(p.id||'').trim();
    const safeName=marketplacePresentationSanitizeFilename(String(p.name||'')).slice(0,72);
    const fileName=`${code?`${code}_`:''}${safeName}_ficha_marketplace.png`;
    return {canvas,fileName};
  }

  async function downloadMarketplacePresentationCard(p,triggerBtn){
    if(!p) return;
    const state=openMarketplacePresentationModal(triggerBtn);
    const originalText=triggerBtn?.textContent||'Ficha';
    state.titleEl.textContent=String(p.name||'Ficha del producto').trim() || 'Ficha del producto';
    state.subtitleEl.textContent='';
    state.statusEl.textContent='Preparando la ficha…';
    state.downloadBtn.disabled=true;
    if(state.shareBtn) state.shareBtn.disabled=true;
    state.canvas=null;
    state.shareFile=null;
    state.fileName='';
    state.product=p;
    state.imageEl.removeAttribute('src');

    if(triggerBtn){
      triggerBtn.disabled=true;
      triggerBtn.textContent='Preparando…';
    }

    try{
      const {canvas,fileName}=await buildMarketplacePresentationCanvas(p);
      const prepared=await prepareCanvasPngFile(canvas,fileName);
      state.canvas=canvas;
      state.fileName=fileName;
      state.shareFile=(prepared.file && canNativeSharePng(prepared.file)) ? prepared.file : null;
      state.imageEl.src=canvas.toDataURL('image/png');
      state.statusEl.textContent='';
      state.downloadBtn.disabled=false;
      if(state.shareBtn){
        state.shareBtn.disabled=!state.shareFile;
        state.shareBtn.textContent=state.shareFile?'Compartir PNG':'Compartir no disponible';
        state.shareBtn.title=state.shareFile?'':'Este navegador no permite compartir archivos PNG directamente.';
      }
      if(triggerBtn){
        triggerBtn.textContent='Ficha';
      }
    }catch(error){
      console.error('No se pudo preparar la ficha Marketplace del producto.',error);
      state.statusEl.textContent='No se pudo preparar la ficha. Abre la consola del navegador (F12) para ver el error exacto.';
      state.downloadBtn.disabled=true;
      if(state.shareBtn) state.shareBtn.disabled=true;
      if(triggerBtn){
        triggerBtn.textContent=originalText;
      }
    }finally{
      if(triggerBtn){
        triggerBtn.disabled=false;
        if(triggerBtn.textContent!=='Ficha') triggerBtn.textContent=originalText;
      }
    }
  }


  async function downloadCollageImage(action="download",options={}){
    const snapshot=collageCurrentSnapshot();
    if(!snapshot.products.length){
      if(action!=="prepare") alert("No hay productos para descargar con los filtros actuales.");
      return;
    }

    const format=getCollageExportFormat();
    const shareKey=collageShareCacheKey(snapshot,format);
    const isCopyAction=action==="copy";
    const isPrepareAction=action==="prepare";

    if(isCopyAction){
      if(!collagePreparedShareFile || collagePreparedShareKey!==shareKey){
        queueCollageSharePreparation();
        return;
      }
      if(shareBtn){
        shareBtn.disabled=true;
        shareBtn.textContent="Copiando…";
      }
      try{
        await copyPreparedPngFile(collagePreparedShareFile);
        if(shareBtn) shareBtn.textContent="Copiada";
        window.setTimeout(()=>{
          if(shareBtn && collageExportMode==="collage"){
            shareBtn.disabled=false;
            shareBtn.textContent="Copiar imagen";
          }
        },900);
      }catch(copyError){
        console.error(`No se pudo copiar el PNG del collage para ${format.label}.`,copyError);
        alert("Este navegador no permite copiar esta imagen al portapapeles. Puedes usar Descargar PNG.");
        if(shareBtn){
          shareBtn.disabled=false;
          shareBtn.textContent="Copiar imagen";
        }
      }
      return;
    }

    const targetBtn=downloadBtn;
    const originalText=targetBtn?.textContent||"Descargar PNG";
    if(isPrepareAction){
      if(shareBtn){
        shareBtn.disabled=true;
        shareBtn.textContent="Preparando PNG…";
      }
    }else{
      if(downloadBtn) downloadBtn.disabled=true;
      if(shareBtn) shareBtn.disabled=true;
      if(targetBtn) targetBtn.textContent="Generando PNG…";
      for(const button of formatButtons) button.disabled=true;
    }

    try{
      const PAGE_W=format.pageW;
      const PAGE_H=format.pageH;
      const MARGIN=format.margin;
      const CONTENT_W=PAGE_W-(MARGIN*2);
      const total=snapshot.products.length;
      const isMarketplace=format.key==="marketplace";
      const columns=
        total<=4 ? 2 :
        total<=9 ? 3 :
        total<=16 ? 4 :
        total<=25 ? 5 :
        total<=36 ? 6 : 7;
      const gap=isMarketplace?16:14;
      const headingGap=isMarketplace?18:16;
      const titleFontSize=isMarketplace?36:38;
      const titleLineHeight=isMarketplace?44:46;
      const blocks=collageExportBlocks(snapshot.tree);
      const imageMap=new Map();

      await Promise.all(snapshot.products.map(async p=>{
        imageMap.set(p,await collageLoadCanvasImage(p));
      }));

      const probe=document.createElement("canvas");
      probe.width=PAGE_W;
      probe.height=PAGE_H;
      const pctx=probe.getContext("2d");
      const cardLayouts=new Map();

      function headingMetrics(depth){
        const size=depth===1?(isMarketplace?23:24):depth===2?(isMarketplace?19:20):(isMarketplace?16:17);
        return {
          size,
          lineHeight:Math.round(size*1.22),
          before:depth===1?18:12,
          after:10
        };
      }

      function trimWrappedLines(ctx,lines,maxWidth,maxLines=3){
        if(lines.length<=maxLines) return lines;
        const out=lines.slice(0,maxLines);
        let last=out[maxLines-1].replace(/[.…]+$/,""
        ).trim();
        while(last && ctx.measureText(last+"…").width>maxWidth){
          last=last.slice(0,-1).trimEnd();
        }
        out[maxLines-1]=(last||"Producto")+"…";
        return out;
      }

      function gridLayout(block){
        const indent=Math.min(block.depth,3)*18;
        const available=CONTENT_W-indent;
        const cols=Math.min(columns,Math.max(1,block.products.length));
        const cardW=Math.floor((available-gap*(cols-1))/cols);

        const imageH=Math.round(
          Math.min(isMarketplace?235:250,Math.max(columns<=3?(isMarketplace?178:190):118,cardW*(isMarketplace?.82:.88)))
        );
        const nameSize=columns<=2?(isMarketplace?23:25):columns===3?(isMarketplace?18:20):columns===4?16:columns===5?14:columns===6?12:11;
        const nameLine=Math.round(nameSize*1.28);
        const priceSize=Math.max(12,nameSize+2);
        const captionPad=columns<=3?(isMarketplace?12:14):10;

        pctx.font=`800 ${nameSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
        const items=block.products.map(product=>{
          const maxTextW=Math.max(64,cardW-(captionPad*2));
          let lines=collageCanvasWrapLines(
            pctx,
            String(product?.name||"Producto"),
            maxTextW
          );
          lines=trimWrappedLines(pctx,lines,maxTextW,columns>=5?2:3);
          const price=collagePriceText(product);
          const textH=
            lines.length*nameLine+
            (price?priceSize+10:0)+
            (captionPad*2);
          return {product,lines,price,height:imageH+textH};
        });

        const rows=[];
        for(let i=0;i<items.length;i+=cols){
          const rowItems=items.slice(i,i+cols);
          rows.push({items:rowItems,height:Math.max(...rowItems.map(v=>v.height))});
        }

        const height=
          rows.reduce((sum,row)=>sum+row.height,0)+
          gap*Math.max(0,rows.length-1);

        const layout={
          indent,cols,cardW,imageH,nameSize,nameLine,priceSize,captionPad,rows,height
        };
        cardLayouts.set(block,layout);
        return layout;
      }

      let naturalH=isMarketplace?68:72;
      pctx.font=`900 ${titleFontSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
      const titleLines=collageCanvasWrapLines(pctx,snapshot.title,CONTENT_W-120);
      naturalH+=Math.min(titleLines.length,2)*titleLineHeight+(isMarketplace?42:46);

      for(const block of blocks){
        if(block.type==="heading"){
          const m=headingMetrics(block.depth);
          naturalH+=m.before+m.lineHeight+m.after;
        }else{
          const gl=gridLayout(block);
          naturalH+=gl.height+headingGap;
        }
      }
      naturalH+=72;

      const natural=document.createElement("canvas");
      natural.width=PAGE_W;
      natural.height=Math.max(PAGE_H,Math.ceil(naturalH));
      const ctx=natural.getContext("2d");

      const bgGradient=ctx.createLinearGradient(0,0,0,natural.height);
      bgGradient.addColorStop(0,"#fffdfa");
      bgGradient.addColorStop(.42,"#faf6f2");
      bgGradient.addColorStop(1,"#f4eee9");
      ctx.fillStyle=bgGradient;
      ctx.fillRect(0,0,natural.width,natural.height);
      ctx.textBaseline="top";

      let y=isMarketplace?38:42;
      ctx.fillStyle="#b9954f";
      collageCanvasRoundRect(ctx,MARGIN,y,CONTENT_W,4,2);
      ctx.fill();
      y+=18;

      ctx.fillStyle="#8d5360";
      ctx.font="850 16px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.textAlign="center";
      ctx.fillText("IRENISMB STOCK NATURA",PAGE_W/2,y);
      y+=29;

      ctx.fillStyle="#352b2c";
      ctx.font=`900 ${titleFontSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
      const displayTitleLines=titleLines.slice(0,2);
      for(const line of displayTitleLines){
        ctx.fillText(line,PAGE_W/2,y);
        y+=titleLineHeight;
      }
      y+=14;
      ctx.textAlign="left";

      for(const block of blocks){
        if(block.type==="heading"){
          const m=headingMetrics(block.depth);
          y+=m.before;
          const indent=Math.min(block.depth-1,3)*18;
          ctx.fillStyle=
            block.depth===1?"#352b2c":
            block.depth===2?"#8d5360":
            "#78696b";
          ctx.font=`900 ${m.size}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
          ctx.fillText(String(block.label||""),MARGIN+indent,y);
          y+=m.lineHeight+m.after;
          continue;
        }

        const gl=cardLayouts.get(block)||gridLayout(block);
        const xStart=MARGIN+gl.indent;

        for(const row of gl.rows){
          for(let c=0;c<row.items.length;c++){
            const entry=row.items[c];
            const x=xStart+c*(gl.cardW+gap);
            const h=row.height;

            collageCanvasRoundRect(ctx,x,y,gl.cardW,h,16);
            ctx.save();
            ctx.shadowColor="rgba(104,72,78,.13)";
            ctx.shadowBlur=12;
            ctx.shadowOffsetY=5;
            ctx.fillStyle="#fffdfb";
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle="#eadfda";
            ctx.lineWidth=1.2;
            ctx.stroke();

            ctx.save();
            collageCanvasRoundRect(ctx,x,y,gl.cardW,gl.imageH,15);
            ctx.clip();
            ctx.fillStyle="#ffffff";
            ctx.fillRect(x,y,gl.cardW,gl.imageH);

            const img=imageMap.get(entry.product);
            if(img&&img.naturalWidth&&img.naturalHeight){
              const pad=Math.max(8,Math.min(16,gl.cardW*.07));
              const aw=gl.cardW-pad*2;
              const ah=gl.imageH-pad*2;
              const scale=Math.min(aw/img.naturalWidth,ah/img.naturalHeight);
              const dw=img.naturalWidth*scale;
              const dh=img.naturalHeight*scale;
              ctx.drawImage(
                img,
                x+(gl.cardW-dw)/2,
                y+(gl.imageH-dh)/2,
                dw,
                dh
              );
            }
            ctx.restore();

            ctx.strokeStyle="#f0e7e2";
            ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(x+10,y+gl.imageH);
            ctx.lineTo(x+gl.cardW-10,y+gl.imageH);
            ctx.stroke();

            let ty=y+gl.imageH+gl.captionPad;
            ctx.fillStyle="#352b2c";
            ctx.font=`800 ${gl.nameSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
            ctx.textAlign="center";
            for(const line of entry.lines){
              ctx.fillText(line,x+gl.cardW/2,ty);
              ty+=gl.nameLine;
            }

            if(entry.price){
              ty+=4;
              ctx.fillStyle="#8d5360";
              ctx.font=`950 ${gl.priceSize}px system-ui, -apple-system, Segoe UI, Arial, sans-serif`;
              ctx.fillText(entry.price,x+gl.cardW/2,ty);
            }
            ctx.textAlign="left";
          }
          y+=row.height+gap;
        }
        y-=gap;
        y+=headingGap;
      }

      y+=18;
      ctx.strokeStyle="#e6d8d2";
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(MARGIN,y);
      ctx.lineTo(PAGE_W-MARGIN,y);
      ctx.stroke();

      y+=14;
      ctx.fillStyle="#78696b";
      ctx.font="650 13px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.textAlign="center";
      ctx.fillText(
        "Irenismb Stock Natura · Santa Marta · WhatsApp +57 304 208 8961",
        PAGE_W/2,
        y
      );
      ctx.textAlign="left";
      y+=44;

      const finalCanvas=document.createElement("canvas");
      finalCanvas.width=PAGE_W;
      finalCanvas.height=PAGE_H;
      const fctx=finalCanvas.getContext("2d");

      const finalGradient=fctx.createLinearGradient(0,0,0,PAGE_H);
      finalGradient.addColorStop(0,"#fffdfa");
      finalGradient.addColorStop(1,"#f4eee9");
      fctx.fillStyle=finalGradient;
      fctx.fillRect(0,0,PAGE_W,PAGE_H);

      const usedHeight=Math.max(1,Math.min(natural.height,Math.ceil(y+42)));
      const verticalPadding=isMarketplace?24:18;
      const horizontalPadding=isMarketplace?24:0;
      const scale=Math.min(1,(PAGE_H-verticalPadding)/usedHeight,(PAGE_W-horizontalPadding)/PAGE_W);
      const drawW=PAGE_W*scale;
      const drawH=usedHeight*scale;

      fctx.drawImage(
        natural,
        0,0,PAGE_W,usedHeight,
        (PAGE_W-drawW)/2,
        (PAGE_H-drawH)/2,
        drawW,drawH
      );

      const blob=await new Promise((resolve,reject)=>{
        try{
          finalCanvas.toBlob(
            value=>value?resolve(value):reject(new Error("No se pudo crear el archivo PNG.")),
            "image/png",
            1
          );
        }catch(error){
          reject(error);
        }
      });

      if(isPrepareAction){
        const file=window.File ? new File([blob],format.downloadName,{type:"image/png"}) : null;
        const stillCurrent=options.token===collagePrepareSequence && options.key===shareKey;
        if(stillCurrent){
          collagePreparedShareFile=file;
          collagePreparedShareKey=file?shareKey:"";
          if(collageExportMode==="collage") setActionReady();
        }
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;
        a.download=format.downloadName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      }
    }catch(error){
      if(isPrepareAction){
        const stillCurrent=options.token===collagePrepareSequence;
        if(stillCurrent){
          collagePreparedShareFile=null;
          collagePreparedShareKey="";
          if(collageExportMode==="collage"){
            if(shareBtn){
              shareBtn.disabled=true;
              shareBtn.textContent="Copiar imagen";
              shareBtn.title="No se pudo preparar la imagen.";
            }
            if(downloadBtn){
              downloadBtn.disabled=true;
              downloadBtn.textContent="Descargar PNG";
            }
          }
        }
        console.info(`No se pudo preparar el PNG del collage para ${format.label}.`,error);
      }else{
        console.error(`No se pudo generar el PNG del collage para ${format.label}.`,error);
        alert("No se pudo generar la imagen del collage. Intenta nuevamente después de que terminen de cargar las imágenes.");
      }
    }finally{
      if(!isPrepareAction){
        for(const button of formatButtons) button.disabled=false;
        if(downloadBtn){
          downloadBtn.disabled=false;
          downloadBtn.textContent="Descargar PNG";
        }
        if(collageExportMode==="collage"){
          const currentKey=collageShareCacheKey(collageCurrentSnapshot(),getCollageExportFormat());
          const ready=!!collagePreparedShareFile && collagePreparedShareKey===currentKey;
          if(ready) setActionReady();
          else queueCollageSharePreparation();
        }
      }
    }
  }


  function renderCollage(){
    const snapshot=collageCurrentSnapshot();
    routeEl.textContent=snapshot.title;
    collageTree.innerHTML="";
    invalidateCollageSharePreparation();
    setCollageSelectedProduct(null,null);

    if(!snapshot.products.length){
      const empty=document.createElement("div");
      empty.className="collage-empty";
      empty.textContent="No hay productos para mostrar con los filtros actuales.";
      collageTree.appendChild(empty);
      return;
    }

    if(snapshot.tree.products.length){
      collageTree.appendChild(makeCollageGrid(snapshot.tree.products,true));
    }

    appendTreeChildren(collageTree,snapshot.tree,1);

    const firstSelectable=collageTree.querySelector('.collage-item[data-ficha-selectable="true"]');
    if(firstSelectable){
      setCollageSelectedProduct(firstSelectable._collageProduct||null,firstSelectable);
    }else{
      setCollageSelectedProduct(null,null);
    }
  }

  btn.addEventListener("click",()=>{
    renderCollage();
    modal.classList.add("open");
    modal.setAttribute("aria-hidden","false");
    document.body.classList.add("collage-open");
    setCollageExportMode("collage");
    requestAnimationFrame(()=>closeBtn?.focus({preventScroll:true}));
  });

  for(const button of formatButtons){
    button.addEventListener("click",()=>setCollageExportFormat(button.dataset.collageFormat));
  }
  setCollageExportFormat("instagram");
  collageTypeBtn?.addEventListener("click",()=>setCollageExportMode("collage"));
  fichaBtn?.addEventListener("click",()=>{
    if(!collageSelectedProduct) return;
    setCollageExportMode("ficha");
  });
  downloadBtn?.addEventListener("click",()=>{
    try{
      if(collageExportMode==="ficha"){
        if(!fichaPreparedFile) return queueFichaPreparation();
        downloadPreparedPngFile(fichaPreparedFile,fichaPreparedFile.name);
      }else{
        const currentKey=collageShareCacheKey(collageCurrentSnapshot(),getCollageExportFormat());
        if(collagePreparedShareFile && collagePreparedShareKey===currentKey){
          downloadPreparedPngFile(collagePreparedShareFile,collagePreparedShareFile.name);
        }else{
          queueCollageSharePreparation();
        }
      }
    }catch(error){
      console.error("No se pudo descargar el PNG.",error);
      alert("No se pudo descargar la imagen PNG.");
    }
  });
  shareBtn?.addEventListener("click",async()=>{
    const file=collageExportMode==="ficha"?fichaPreparedFile:collagePreparedShareFile;
    if(!file){
      if(collageExportMode==="ficha") queueFichaPreparation();
      else queueCollageSharePreparation();
      return;
    }
    shareBtn.disabled=true;
    shareBtn.textContent="Copiando…";
    try{
      await copyPreparedPngFile(file);
      shareBtn.textContent="Copiada";
      window.setTimeout(()=>{
        if(shareBtn){
          shareBtn.disabled=false;
          shareBtn.textContent="Copiar imagen";
        }
      },900);
    }catch(error){
      console.error("No se pudo copiar la imagen al portapapeles.",error);
      alert("Este navegador no permite copiar esta imagen al portapapeles. Puedes usar Descargar PNG.");
      shareBtn.disabled=false;
      shareBtn.textContent="Copiar imagen";
    }
  });

  modal.addEventListener("click",event=>{
    if(event.target.closest("[data-collage-close]")) closeCollage();
  });

  document.addEventListener("keydown",event=>{
    if(event.key==="Escape"&&modal.classList.contains("open")) closeCollage();
  });
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
  const target=document.querySelector("main")||grid;
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
    const label=!selectedAudience?"Secciones principales":(directSelected?"Productos":(!selectedCategory?"Subcategorías":(albums.length>0&&!selectedFamily?"Familias olfativas":"Productos")));
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
  if(qtyPill){qtyPill.textContent=q>0?`${q} en carrito`:"Aún no agregado";qtyPill.classList.toggle("has-items",q>0);}
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
  descriptionEl.hidden=!description;
  if(description.length>230){
    card.classList.add("description-collapsible");
    const toggle=document.createElement("button");
    toggle.type="button";
    toggle.className="description-toggle";
    toggle.dataset.descriptionToggle="";
    toggle.textContent="Ver detalles";
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
  uxScrollStack().push({scrollY:window.scrollY||0});
  if(target.navType==="audience"){selectedAudience=target.navValue;selectedCategory="";selectedFamily="";}
  else if(target.navType==="category"){selectedAudience=target.audience||selectedAudience;selectedCategory=target.navValue;selectedFamily="";}
  else if(target.navType==="family"){selectedAudience=target.audience||selectedAudience;selectedCategory=target.category||selectedCategory;selectedFamily=target.navValue;}
  if(!opts.keepFilters) resetDiscoveryFilters();
  refreshNavigationAlbums();
  refreshFilterOptionsForScope();
  render();
  uxScrollToCatalogStart();
}

function closeAlbum(opts={}){
  const restore=uxScrollStack().pop();
  if(selectedFamily) selectedFamily="";
  else if(selectedCategory) selectedCategory="";
  else selectedAudience="";
  if(!opts.keepFilters) resetDiscoveryFilters();
  refreshNavigationAlbums();
  refreshFilterOptionsForScope();
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
      desc.textContent=expanded?"Ocultar detalles":"Ver detalles";
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
}

async function init(){
  refreshCartCount();
  initCartButton();
  initShipping();
  bindFilters();
  bindGridActions();
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
  await initializeRemoteCatalogConfiguration();
  await loadProducts();
  startInventoryAutoRefresh();
  uxRestoreScrollPosition();
}
