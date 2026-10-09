// Lógica principal del catálogo público.

// ==========================================
    // AJUSTES LOCALES Y CONFIGURACIÓN GLOBAL
    // ==========================================
    // Los valores locales funcionan como respaldo.
    // La hoja configuracion_publica contiene exclusivamente los ajustes publicados del catálogo.

    // Fuente principal de datos comerciales del catálogo: Google Sheet oficial.
    // Las imágenes se relacionan por el código interno global de cuatro dígitos.
    // Los campos de Productos se resuelven por sus encabezados, independientemente de su posición.
    const GOOGLE_SHEET_SOURCE = {
      spreadsheetId: "1x7mC7iq-vbOcvSL58cL-slC55gP4aoCKCig-WpggCNs",
      sheetName: "Productos",
      gid: "893686273"
    };

    // Apps Script guarda los ajustes y publica exclusivamente las claves públicas en esta hoja.
    const REMOTE_CONTROL_SOURCE = {
      enabled: true,
      endpoint: "https://script.google.com/macros/s/AKfycbzotfE1aifLWmjJjyQRTXZo2C9intQnhGZA57n27MCqDDB_BnuhkxhDvDmeuUlK9v09/exec",
      cacheKey: "irenismb_public_configuration_v1"
    };
    window.REMOTE_CONTROL_SOURCE = REMOTE_CONTROL_SOURCE;
    const PUBLIC_CONFIGURATION_KEYS = Object.freeze([
      "REGISTRAR_VISITAS_PROPIAS", "MOSTRAR_CANTIDAD_STOCK", "MOSTRAR_PRECIOS_PRODUCTO",
      "ORDEN_NAVEGACION", "ORDEN_PRODUCTOS"
    ]);
    // Solo limita intentos duplicados de imágenes; no programa peticiones.
    const IMAGE_INDEX_MIN_RETRY_MS = 120000;
    function completeRefresh(state, successful){
      state.failures = successful ? 0 : Math.min((state.failures || 0) + 1, 3);
      state.nextAt = Date.now() + IMAGE_INDEX_MIN_RETRY_MS * Math.pow(2, state.failures);
    }
    // GitHub Pages se conserva únicamente para recursos web fijos del sitio (logos, iconos y archivos publicados).
    // Las imágenes dinámicas de productos y regalos NO se obtienen de GitHub.
    const GITHUB_CATALOG_SOURCE = {
      owner: "irenismb",
      repo: "stock",
      branch: "main",
      catalogDir: "natura"
    };

    // Servicio público vigente que indexa directamente la carpeta productos de Google Drive.
    // Devuelve products, gifts, ads y assets con id, name y url para cada imagen.
    const APPS_SCRIPT_IMAGE_SOURCE = {
      endpoint: "https://script.google.com/macros/s/AKfycbzuHYa9Uf_5v5-FhDXQFu6WRuW49DgxJLUHrm_tq1Vdk539VZjeQeGrlWWqgJj4SzMg2w/exec",
      cacheKey: "irenismb_apps_script_image_index_v2",
      timeoutMs: 25000
    };

    // Galería visual exclusiva de "Regalos para toda ocasión".
    // Vive en la subcarpeta regalos de Google Drive y se sirve mediante el mismo Apps Script.
    const GIFT_IMAGE_SOURCE = {
      section: "Belleza y cuidado",
      category: "Regalos"
    };

	const INTERRUPTORES = {
	  MOSTRAR_CANTIDAD_STOCK: false,
	  MOSTRAR_PRECIOS_PRODUCTO: true,
	  IMAGEN_SUPLENTE_PRODUCTO: "suplente.webp"
    };
    window.INTERRUPTORES = INTERRUPTORES;
    const NAVIGATION_ORDER_CONFIG_KEY = "ORDEN_NAVEGACION";
    const ALL_NAVIGATION_LEVELS = Object.freeze(["section","category","subcategory","public","line","product"]);
    const DEFAULT_NAVIGATION_CONFIG = Object.freeze(ALL_NAVIGATION_LEVELS.map(level=>Object.freeze({level,enabled:true})));
    let CATALOG_NAVIGATION_CONFIG = DEFAULT_NAVIGATION_CONFIG.map(item=>({...item}));
    let CATALOG_NAVIGATION_ORDER = ALL_NAVIGATION_LEVELS.slice();
    window.CATALOG_NAVIGATION_CONFIG = CATALOG_NAVIGATION_CONFIG.map(item=>({...item}));
    window.CATALOG_NAVIGATION_ORDER = CATALOG_NAVIGATION_ORDER.slice();
    const REMOTE_BOOLEAN_CONTROL_KEYS = new Set([
      "MOSTRAR_CANTIDAD_STOCK",
      "MOSTRAR_PRECIOS_PRODUCTO"
    ]);
    const REMOTE_CONTROL_DEFAULTS = Object.freeze({
      REGISTRAR_VISITAS_PROPIAS: "DESACTIVADO",
      MOSTRAR_CANTIDAD_STOCK: "DESACTIVADO",
      MOSTRAR_PRECIOS_PRODUCTO: "ACTIVADO",
      ORDEN_NAVEGACION: ALL_NAVIGATION_LEVELS.join(",")
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
      const base = REMOTE_CONTROL_SOURCE.endpoint;
      const query = new URLSearchParams({
        modo: "productos",
        callback: callbackName,
        // Evita que el navegador, un proxy o Google reutilicen una respuesta anterior.
        // Cada apertura del catálogo consulta la versión más reciente de Productos.
        _: `${Date.now()}_${Math.random().toString(36).slice(2)}`
      });
      return `${base}?${query.toString()}`;
    }

    function catalogHeaderKey(value){
      return normalizeText(value).replace(/\s+/g, " ");
    }

    function catalogHeaderIndices(columns, requiredLabels){
      const indices = new Map();
      for(const [index, column] of (Array.isArray(columns) ? columns : []).entries()){
        const label = catalogHeaderKey(column?.label);
        if(label) indices.set(label, indices.has(label) ? -1 : index);
      }
      for(const label of requiredLabels){
        const index = indices.get(catalogHeaderKey(label));
        if(index === undefined || index < 0){
          throw new Error(`Encabezado indispensable ${index === undefined ? "ausente" : "duplicado"}: ${label}.`);
        }
      }
      return indices;
    }

    function catalogCellText(cell){
      return String(cell?.f ?? cell?.v ?? "").trim();
    }

    function catalogCellNumber(cell){
      // v conserva el número real; f se utiliza exclusivamente para presentación.
      if(cell?.v === null || cell?.v === undefined){
        return {value:null, valid:!catalogCellText(cell), present:!!catalogCellText(cell)};
      }
      const valid = typeof cell.v === "number" && Number.isFinite(cell.v) && cell.v >= 0;
      return {value:valid ? cell.v : null, valid, present:true};
    }

    function readGoogleSheetProductRows(table){
      const indices = catalogHeaderIndices(table?.cols, ["Código", "Nombre", "Categoría", "Precio", "Sección", "Estado comercial"]);
      if(!Array.isArray(table?.rows)) throw new Error("Productos no contiene filas legibles.");
      const fields = {
        section:"Sección", category:"Categoría", subcategory:"Subcategoría",
        condition:"Condición", name:"Nombre", priceText:"Precio", costText:"Costo", stockText:"Stock",
        referenceExternal:"Referencia externa", description:"Descripción", codeNatura:"Código Natura",
        line:"Línea", public:"Público", commercialStatus:"Estado comercial", brand:"Marca",
        productType:"Tipo de producto", variant:"Variante", characteristic:"Característica",
        presentation:"Presentación", content:"Contenido", unit:"Unidad", units:"Cantidad de unidades",
        needsText:"Necesidades de asesoría", useInstructions:"Modo de uso", suitableFor:"Adecuado para",
        model:"Modelo", componentClass:"Clase de componente"
      };
      const rows = [];
      for(const [index, source] of table.rows.entries()){
        try{
          if(!Array.isArray(source?.c)) throw new Error("Fila no legible");
          if(!source.c.some(cell=>cell?.v !== null && cell?.v !== undefined || catalogCellText(cell))) continue;
          const cell = label => source.c[indices.get(catalogHeaderKey(label))];
          const row = {sourceRow:index + 2, technicalIssues:[]};
          for(const [field, label] of Object.entries(fields)) row[field] = catalogCellText(cell(label));
          const code = cell("Código")?.v;
          row.code = typeof code === "number" && Number.isSafeInteger(code) && code >= 0 && code <= 9999
            ? String(code).padStart(4, "0")
            : (typeof code === "string" && /^\d{1,4}$/.test(code.trim()) ? code.trim().padStart(4, "0") : "");
          const price = catalogCellNumber(cell("Precio"));
          row.priceValue = price.value;
          row.costValue = catalogCellNumber(cell("Costo")).value;
          row.stockValue = catalogCellNumber(cell("Stock")).value;
          row.contentValue = catalogCellNumber(cell("Contenido")).value;
          row.unitsValue = catalogCellNumber(cell("Cantidad de unidades")).value;
          row.components = [];
          for(let componentIndex=1;componentIndex<=4;componentIndex++){
            const componentName=catalogCellText(cell(`Nombre del componente ${componentIndex}`));
            if(!componentName) continue;
            row.components.push({name:componentName,
              units:catalogCellText(cell(`Cantidad de unidades del componente ${componentIndex}`)),
              content:catalogCellText(cell(`Contenido del componente ${componentIndex}`)),
              unit:catalogCellText(cell(`Unidad del componente ${componentIndex}`))});
          }
          if(!/^\d{4}$/.test(row.code)) row.technicalIssues.push({reason:"Código ausente o inválido", change:"Informar un Código entero de hasta cuatro dígitos."});
          if(!row.name || /^#(?:REF!|VALUE!|N\/A|ERROR!|NAME\?|DIV\/0!|NUM!)/i.test(row.name)) row.technicalIssues.push({reason:"Nombre vigente vacío o con error", change:"Corregir el dato o la fórmula de Nombre en el catálogo original."});
          if(!row.category) row.technicalIssues.push({reason:"Categoría vacía", change:"Completar Categoría para identificar la ficha y registrar pedidos."});
          if(!row.section) row.technicalIssues.push({reason:"Sección vacía", change:"Completar Sección para aplicar sus reglas de publicación."});
          if(!price.valid) row.technicalIssues.push({reason:"Precio informado no es un número válido no negativo", change:"Corregir Precio como número real en Sheets o conservarlo vacío si se desconoce."});
          row.fullTxtRecord = [row.name, "", `Precio: ${row.priceText} Stock: ${row.stockText}. ${row.description}`].join("\n");
          rows.push(row);
        }catch(_){
          rows.push({code:"", sourceRow:index + 2, technicalIssues:[{reason:"Fila de Productos no legible", change:"Revisar la estructura de esa fila en el catálogo original."}]});
        }
      }
      return rows;
    }

    function buildCompatibleGoogleSheetProducts(entries){
      const source = Array.isArray(entries) ? entries : [];
      const occurrences = new Map();
      for(const entry of source){
        const code = String(entry?.row?.code || "");
        if(/^\d{4}$/.test(code)) occurrences.set(code, (occurrences.get(code) || 0) + 1);
      }
      const products = [], records = [];
      for(const entry of source){
        const row = entry?.row;
        const code = String(row?.code || "");
        const issues = Array.isArray(row?.technicalIssues) ? row.technicalIssues.slice() : [];
        if(occurrences.get(code) > 1) issues.push({reason:"Código duplicado", change:"Resolver la identidad duplicada sin elegir arbitrariamente una fila."});
        let product = null;
        if(!issues.length){
          try{
            product = makeProductFromGoogleSheet(entry);
            if(!product) issues.push({reason:"Ficha sin identidad o nombre válido", change:"Revisar Código y Nombre vigentes."});
          }catch(error){
            issues.push({reason:`No se pudo construir la ficha (${error?.name || "Error"})`, change:"Revisar la lectura de esta fila; las demás continúan disponibles."});
          }
        }
        if(product) products.push(product);
        records.push({code, sourceRow:row?.sourceRow ?? null, status:product ? "COMPATIBLE" : "PENDIENTE", causes:issues});
      }
      return {products, report:{total:records.length, compatible:products.length, pending:records.length - products.length, records}};
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

          if(!payload || payload.ok !== true || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)){
            const errors = payload && Array.isArray(payload.errors) ? payload.errors : [];
            const detail = errors.map(e => e && (e.detailed_message || e.message)).filter(Boolean).join(" · ");
            reject(new Error(detail || "El servicio del catálogo no devolvió una lectura válida."));
            return;
          }

          try{
            resolve(readGoogleSheetProductRows(payload.table));
          }catch(error){
            reject(error);
          }
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


    function validatePublicConfiguration(values){
      if(!values || typeof values !== "object") return false;
      if(!PUBLIC_CONFIGURATION_KEYS.every(key=>typeof values[key] === "string")) return false;
      if(!PUBLIC_CONFIGURATION_KEYS.slice(0,3).every(key=>parseRemoteBoolean(values[key]) !== null)) return false;
      if(!["price_asc","price_desc","name_asc","name_desc"].includes(values.ORDEN_PRODUCTOS)) return false;
      const levels = values.ORDEN_NAVEGACION.split(",").map(item=>item.replace(/^!/, ""));
      return levels.length === ALL_NAVIGATION_LEVELS.length && new Set(levels).size === levels.length
        && levels.every(level=>ALL_NAVIGATION_LEVELS.includes(level));
    }
    function loadRemoteCatalogConfiguration(callbackPrefix){
      return new Promise((resolve,reject)=>{
        const endpoint=String(REMOTE_CONTROL_SOURCE.endpoint||"").trim();
        if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){
          reject(new Error("Lector público de configuración no disponible."));return;
        }
        const cb=`${callbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const node=document.createElement("script");let done=false;
        const finish=(error,value)=>{
          if(done)return;done=true;clearTimeout(timer);node.remove();
          window[cb]=()=>{};setTimeout(()=>{try{delete window[cb]}catch(_){}} ,60000);
          if(error)reject(error);else resolve(value);
        };
        const timer=setTimeout(()=>finish(new Error("Tiempo de espera agotado en configuración pública.")),25000);
        window[cb]=data=>{
          if(data?.ok!==true||!validatePublicConfiguration(data.valores)
            ||!data.publicadoEn||!Number.isFinite(Date.parse(data.publicadoEn))){
            finish(new Error("La configuración pública no pudo verificarse."));return;
          }
          finish(null,{valores:data.valores,publicadoEn:data.publicadoEn});
        };
        node.onerror=()=>finish(new Error("No se pudo consultar el lector público de configuración."));
        const url=new URL(endpoint);
        url.search=new URLSearchParams({modo:"config",callback:cb,_:String(Date.now())}).toString();
        node.src=url.toString();node.async=true;document.head.appendChild(node);
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

        if(key===NAVIGATION_ORDER_CONFIG_KEY){
          changed=setCatalogNavigationOrder(rawState)||changed;
          continue;
        }

        if(key==="ORDEN_PRODUCTOS"){
          changed=window.applyCatalogDefaultProductOrder?.(rawState)||changed;
          continue;
        }

        const state = parseRemoteBoolean(rawState);
        if(state === null || !REMOTE_BOOLEAN_CONTROL_KEYS.has(key)) continue;
        if(INTERRUPTORES[key] !== state){
          INTERRUPTORES[key] = state;
          changed = true;
        }
      }
      return changed;
    }

    let remoteConfigInFlight = null;
    let remoteConfigGeneration = 0;
    let remoteConfigRevision = "";
    window.CATALOG_PUBLIC_CONFIG_CONFIRMED = false;
    let remoteConfigReadyResolver = null;
    window.REMOTE_CONFIG_READY = new Promise(resolve=>{ remoteConfigReadyResolver = resolve; });

    function setConfigurationNotice(message){
      let notice = document.getElementById("catalogConfigurationNotice");
      if(!notice){
        notice = document.createElement("p"); notice.id = "catalogConfigurationNotice";
        notice.setAttribute("role", "status");
        document.getElementById("grid")?.insertAdjacentElement("beforebegin", notice);
      }
      notice.textContent = message; notice.hidden = !message;
    }
    function acceptCatalogPublicConfiguration(values, options = {}){
      if(!validatePublicConfiguration(values)) return false;
      const revision = String(options.revision || "");
      if(!Number.isFinite(Date.parse(revision))) return false;
      if(remoteConfigRevision && Date.parse(revision) < Date.parse(remoteConfigRevision)) return false;
      const source = Object.fromEntries(PUBLIC_CONFIGURATION_KEYS.map(key=>[key,values[key]]));
      const first = !window.CATALOG_PUBLIC_CONFIG_CONFIRMED;
      const changed = applyRemoteControlValues(source);
      remoteConfigRevision = revision; remoteConfigGeneration++;
      window.CATALOG_PUBLIC_CONFIG_CONFIRMED = true;
      try{ localStorage.setItem(REMOTE_CONTROL_SOURCE.cacheKey, JSON.stringify({valores:source, publicadoEn:revision})); }catch(_){}
      setConfigurationNotice("");
      if((changed || first) && options.rebuild !== false && allLoadedProducts.length){
        rebuildCatalogVisibility(); syncWordToggleButton();
        if(cartModal?.classList.contains("open")) renderCartModal();
      }
      return true;
    }
    window.acceptCatalogPublicConfiguration = acceptCatalogPublicConfiguration;
    function refreshRemoteCatalogConfiguration(options = {}){
      if(remoteConfigInFlight) return remoteConfigInFlight;
      const generation = remoteConfigGeneration;
      remoteConfigInFlight = (async ()=>{
        try{
          const snapshot = await loadRemoteCatalogConfiguration("__remoteCatalogControls");
          // An older response cannot replace a configuration just saved by the administrator.
          if(generation === remoteConfigGeneration){
            acceptCatalogPublicConfiguration(snapshot.valores, {revision:snapshot.publicadoEn, rebuild:options.rebuild !== false});
          }
          return true;
        }catch(error){
          setConfigurationNotice(window.CATALOG_PUBLIC_CONFIG_CONFIRMED
            ? "No se pudo actualizar la configuración. Se conserva la última configuración válida."
            : "No se pudo cargar la configuración del catálogo. Recarga la página para volver a intentarlo.");
          console.info("Configuración pública no disponible; se conserva únicamente la última configuración válida.", error);
          return false;
        }finally{
          if(options.initial){ wordSuggestionsVisible = shouldShowSuggestionsInitially(); syncWordToggleButton(); }
          syncAdministrativeToolVisibility();
        }
      })().finally(()=>{ remoteConfigInFlight = null; });
      return remoteConfigInFlight;
    }
    async function initializeRemoteCatalogConfiguration(){
      try{
        const cached = JSON.parse(localStorage.getItem(REMOTE_CONTROL_SOURCE.cacheKey) || "null");
        if(cached) acceptCatalogPublicConfiguration(cached.valores, {revision:cached.publicadoEn, rebuild:false});
      }catch(_){}
      await refreshRemoteCatalogConfiguration({rebuild:false, initial:true});
      remoteConfigReadyResolver?.(window.CATALOG_PUBLIC_CONFIG_CONFIRMED);
      remoteConfigReadyResolver = null;
    }

    function normalizeImageServiceFile(file, acceptImageMimeType = false){
      if(!file || typeof file !== "object") return null;
      const id = String(file.id || "").trim();
      const name = String(file.name || "").trim();
      const url = String(file.url || "").trim();
      const mimeType = String(file.mimeType || "").trim();
      const isImage = PRODUCT_IMAGE_EXTENSIONS.has(extensionOfFilename(name))
        || (acceptImageMimeType && /^image\//i.test(mimeType));
      if(!name || !url || !isImage) return null;
      return { id, name, url, path:name, type:"drive-image", mimeType };
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

    // Comparte las solicitudes concurrentes del catálogo y de los anuncios.
    let imageIndexInFlight = null;
    let lastImageIndex = null;
    const imageIndexRefresh = {nextAt:0, failures:0};
    function loadAppsScriptImageIndex(){
      if(!imageIndexInFlight && Date.now() < imageIndexRefresh.nextAt) return Promise.resolve(lastImageIndex || readAppsScriptImageIndexCache() || {ok:false, products:{}, gifts:[]});
      if(!imageIndexInFlight){
        imageIndexInFlight = fetchAppsScriptImageIndex().finally(()=>{
          imageIndexInFlight = null;
        });
      }
      return imageIndexInFlight;
    }

    async function fetchAppsScriptImageIndex(){
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
        completeRefresh(imageIndexRefresh, true); lastImageIndex = normalized;
        return normalized;
      }catch(error){
        completeRefresh(imageIndexRefresh, false);
        const cached = readAppsScriptImageIndexCache();
        if(cached){
          console.warn("No se pudo actualizar el índice de imágenes desde Apps Script; se conserva el último índice válido guardado en el navegador.", error);
          lastImageIndex = cached; return cached;
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
        if(progressEnabled) setCatalogLoadingStage("Cargando imágenes…", 31, 94);
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

    function makeProductFromGoogleSheet(entry){
      const row = entry && entry.row;
      const imageIndex = entry && entry.imageIndex;
      if(!row) return null;

      const code = String(row.code || "").trim();
      const name = String(row.name || "").trim();
      const section = String(row.section || "").trim();
      const rawCategory = String(row.category || "").trim();
      const category = rawCategory;
      const subcategory = String(row.subcategory || "").trim();
      const line = String(row.line || "").trim();
      const publicLabel = String(row.public || "").trim();
      const commercialStatus = String(row.commercialStatus || "").trim();
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

      return {
        id: code,
        name,
        section,
        category,
        subcategory,
        line,
        public: publicLabel,
        commercialStatus,
        condition,
        brand: String(row.brand || "").trim() || (/\bnatura\b/i.test(name) ? "Natura" : (/\bavon\b/i.test(name) ? "AVON" : "")),
        productType: String(row.productType || "").trim(),
        variant: String(row.variant || "").trim(),
        characteristic: String(row.characteristic || "").trim(),
        presentation: String(row.presentation || "").trim(),
        content: String(row.content || "").trim(),
        unit: String(row.unit || "").trim(),
        units: String(row.units || "").trim(),
        model: String(row.model || "").trim(),
        needs: String(row.needsText || "").split(/\s*;\s*/).filter(Boolean),
        useInstructions: String(row.useInstructions || "").trim(),
        suitableFor: String(row.suitableFor || "").trim(),
        components: Array.isArray(row.components) ? row.components : [],
        price: row.priceValue ?? 0,
        priceText,
        hasPrice: row.priceValue !== null && row.priceValue !== undefined,
        cost: row.costValue ?? null,
        costText: String(row.costText || ""),
        stock: row.stockValue ?? null,
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
        searchKey: normalizeText([code, name, section, category, subcategory, publicLabel, line, condition,
          row.brand,row.productType,row.variant,row.characteristic,row.presentation,row.needsText,
          row.suitableFor,row.description,...(row.components||[]).map(c=>c.name)].filter(Boolean).join(" "))
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
            category: GIFT_IMAGE_SOURCE.category,
            subcategory: "",
            line: "",
            public: "",
            commercialStatus: "",
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
      if(preferredUrl) img.crossOrigin = "anonymous";
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
    let publicCatalogProducts = [];
    let all = [];
    let productById = new Map();
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

    const NAV_SECTIONS = [
      {
        label:"Belleza y cuidado",
        subtitle:"Perfumes, cabello, cuidado personal, maquillaje, kits y combos.",
        iconImage:ROOT_ICON_IMAGES.ella,
        theme:"belleza"
      },
      {
        label:"Otros productos",
        subtitle:"Tecnología y hogar, juguetes, papelería, medicamentos y más.",
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
    let selectedSection = "";      // Sección
    let selectedCategory = "";      // Categoría
    let selectedSubcategory = "";   // Subcategoría
    let selectedPublic = "";       // Público
    let selectedLine = "";         // Línea
    let selectedAlbumKey = "";

    const NAV_LEVELS = Object.freeze({
      section:{label:"Sección"},
      category:{label:"Categoría"},
      subcategory:{label:"Subcategoría"},
      public:{label:"Público"},
      line:{label:"Línea"},
      product:{label:"Producto"}
    });

    function cleanNavKey(value){
      return normalizeText(value).replace(/\s+/g, " ");
    }

    function normalizeNavigationConfig(value){
      const alias={
        section:"section",seccion:"section",
        category:"category",categoria:"category",
        subcategory:"subcategory",subcategoria:"subcategory",
        public:"public",publico:"public",
        line:"line",linea:"line",
        product:"product",producto:"product"
      };
      const source=Array.isArray(value)?value:String(value??"").split(",");
      const parsed=[];
      const seen=new Set();
      let hasExplicitState=false;
      for(const rawItem of source){
        let raw=typeof rawItem==="object"&&rawItem ? String(rawItem.level||"").trim() : String(rawItem??"").trim();
        let enabled=typeof rawItem==="object"&&rawItem ? rawItem.enabled!==false : true;
        if(raw.startsWith("!")){hasExplicitState=true;enabled=false;raw=raw.slice(1).trim();}
        const level=alias[cleanNavKey(raw).replace(/\s+/g,"")]||"";
        if(!level||seen.has(level)) continue;
        seen.add(level); parsed.push({level,enabled});
      }
      const parsedLevels=parsed.map(item=>item.level);
      const legacyMiddleOnly=!hasExplicitState && parsed.length===4 && !parsedLevels.includes("section") && !parsedLevels.includes("product") && ["category","subcategory","public","line"].every(level=>parsedLevels.includes(level));
      if(legacyMiddleOnly) return [{level:"section",enabled:true},...parsed.map(item=>({level:item.level,enabled:true})),{level:"product",enabled:true}];
      if(!parsed.length) return DEFAULT_NAVIGATION_CONFIG.map(item=>({...item}));
      for(const level of ALL_NAVIGATION_LEVELS) if(!seen.has(level)) parsed.push({level,enabled:false});
      return parsed;
    }

    function serializeNavigationConfig(value){
      return normalizeNavigationConfig(value).map(item=>`${item.enabled===false?"!":""}${item.level}`).join(",");
    }

    function setCatalogNavigationOrder(value){
      const nextConfig=normalizeNavigationConfig(value);
      const nextOrder=nextConfig.filter(item=>item.enabled!==false).map(item=>item.level);
      const nextSerialized=serializeNavigationConfig(nextConfig);
      const previousSerialized=serializeNavigationConfig(CATALOG_NAVIGATION_CONFIG);
      const changed=nextSerialized!==previousSerialized;
      CATALOG_NAVIGATION_CONFIG=nextConfig.map(item=>({...item}));
      CATALOG_NAVIGATION_ORDER=nextOrder.slice();
      window.CATALOG_NAVIGATION_CONFIG=CATALOG_NAVIGATION_CONFIG.map(item=>({...item}));
      window.CATALOG_NAVIGATION_ORDER=CATALOG_NAVIGATION_ORDER.slice();
      window.REMOTE_CONTROL_VALUES=window.REMOTE_CONTROL_VALUES||{};
      window.REMOTE_CONTROL_VALUES[NAVIGATION_ORDER_CONFIG_KEY]=nextSerialized;
      return changed;
    }

    function navigationOrderedLevels(){
      return CATALOG_NAVIGATION_ORDER.slice();
    }

    function navigationDepthForType(type){
      const index=CATALOG_NAVIGATION_ORDER.indexOf(String(type||""));
      return index>=0?index+1:0;
    }

    function navigationLevelLabel(type,plural=false){
      const level=String(type||"");
      if(!plural) return NAV_LEVELS[level]?.label||"Nivel";
      const labels={section:"Secciones",category:"Categorías",subcategory:"Subcategorías",public:"Públicos",line:"Líneas",product:"Productos"};
      return labels[level]||"Opciones";
    }

    function navigationSectionForProduct(p){
      if(!p) return "";
      return String(p.section || "").trim();
    }

    function productMatchesSection(p, sectionLabel){
      return cleanNavKey(navigationSectionForProduct(p)) === cleanNavKey(sectionLabel);
    }

    function navigationCategoryForProduct(p){
      if(!p) return "";
      return String(p.category || "").trim();
    }

    function navigationSubcategoryForProduct(p){
      if(!p) return "";
      return String(p.subcategory || "").trim();
    }

    function navigationPublicForProduct(p){
      if(!p) return "";
      return String(p.public || "").trim();
    }

    function navigationLineForProduct(p){
      if(!p) return "";
      return String(p.line || "").trim();
    }

    function navigationValueForProduct(p,level){
      if(level==="section") return navigationSectionForProduct(p);
      if(level==="category") return navigationCategoryForProduct(p);
      if(level==="subcategory") return navigationSubcategoryForProduct(p);
      if(level==="public") return navigationPublicForProduct(p);
      if(level==="line") return navigationLineForProduct(p);
      if(level==="product") return String(p?.name||"").trim();
      return "";
    }

    function selectedNavigationValue(level){
      if(level==="section") return selectedSection;
      if(level==="category") return selectedCategory;
      if(level==="subcategory") return selectedSubcategory;
      if(level==="public") return selectedPublic;
      if(level==="line") return selectedLine;
      return "";
    }

    function setSelectedNavigationValue(level,value){
      const clean=String(value||"").trim();
      if(level==="section") selectedSection=clean;
      else if(level==="category") selectedCategory=clean;
      else if(level==="subcategory") selectedSubcategory=clean;
      else if(level==="public") selectedPublic=clean;
      else if(level==="line") selectedLine=clean;
    }

    function clearSelectedNavigationValues(){
      selectedSection="";selectedCategory="";selectedSubcategory="";selectedPublic="";selectedLine="";
    }

    function clearNavigationLevelsAfter(level){
      const order=navigationOrderedLevels();
      const index=order.indexOf(level);
      if(index<0) return;
      for(const next of order.slice(index+1)) setSelectedNavigationValue(next,"");
    }

    function navigationSelectionContext(){
      return {
        section:selectedSection,
        category:selectedCategory,
        subcategory:selectedSubcategory,
        public:selectedPublic,
        line:selectedLine
      };
    }

    function selectedNavigationTrail(){
      const trail=[];
      for(const level of navigationOrderedLevels()){
        if(level==="product") break;
        const label=selectedNavigationValue(level);
        if(label) trail.push({level,label,depth:navigationDepthForType(level)});
      }
      return trail;
    }

    window.getCatalogNavigationConfig=()=>CATALOG_NAVIGATION_CONFIG.map(item=>({...item}));
    window.getCatalogNavigationOrder=()=>navigationOrderedLevels();
    window.applyCatalogNavigationOrder=(value,options={})=>{
      const changed=setCatalogNavigationOrder(value);
      if(changed&&options.rebuild!==false&&Array.isArray(allLoadedProducts)&&allLoadedProducts.length){
        validateNavigationStateAgainstProducts();
        rebuildCatalogVisibility();
      }
      return {changed,order:navigationOrderedLevels(),config:window.getCatalogNavigationConfig()};
    };

    function productsForSection(sectionLabel, list = all){
      return (Array.isArray(list) ? list : []).filter(p => productMatchesSection(p, sectionLabel));
    }

    function isDirectProductSection(sectionLabel){
      const products = productsForSection(sectionLabel);
      if(!products.length) return false;
      return !products.some(p => navigationOrderedLevels().some(level=>Boolean(navigationValueForProduct(p,level))));
    }

    function collectAlbumPreview(found, p){
      if(!found.cover) found.cover = p;
      const previewImage = String((p && p.docsImageUrl) || (p && p.imgFilename) || "").trim();
      if(p && (p.hasImage || p.docsImageUrl) && previewImage && !found.previewImages.includes(previewImage)){
        if(p.isDocumentFirst) found.previewImages.unshift(previewImage);
        else found.previewImages.push(previewImage);
      }
    }

    function navAlbumBase({key,navType,navValue,label,subtitle="",icon="•",iconImage="",products=[],extra={}}){
      const album={
        key,navType,navValue,label,subtitle,icon,iconImage,
        navDepth:navigationDepthForType(navType),
        products,cover:null,previewImages:[],
        searchKey:normalizeText([label,subtitle,...Object.values(extra)].filter(Boolean).join(" ")),
        hasStructuredProducts:true,hasUnstructuredProducts:false,onlyUnstructured:false,
        ...extra
      };
      for(const p of products) collectAlbumPreview(album,p);
      return album;
    }

    function finalizeAlbums(values, orderMap=null){
      return values
        .map(album=>({ ...album, count:album.products.length }))
        .sort((a,b)=>{
          if(orderMap){
            const ar=orderMap.get(cleanNavKey(a.label)) ?? 999;
            const br=orderMap.get(cleanNavKey(b.label)) ?? 999;
            if(ar!==br) return ar-br;
          }
          return a.label.localeCompare(b.label,"es",{sensitivity:"base"});
        })
        .map((album,index)=>({ ...album, colorIndex:index % ALBUM_COLORS.length }));
    }

    function buildRootAlbums(list){
      const byGroup=new Map();
      for(const p of (Array.isArray(list)?list:[])){
        const label=String(navigationSectionForProduct(p)||"").trim();
        if(!label) continue;
        const key=cleanNavKey(label);
        const item=byGroup.get(key)||{label,products:[]};
        item.products.push(p);byGroup.set(key,item);
      }
      const preferredOrder=new Map(NAV_SECTIONS.map((item,index)=>[cleanNavKey(item.label),index]));
      const rootAlbums=Array.from(byGroup.values()).map(group=>{
        const config=NAV_SECTIONS.find(item=>cleanNavKey(item.label)===cleanNavKey(group.label))||{};
        return navAlbumBase({
          key:`section::${cleanNavKey(group.label)}`,navType:"section",navValue:group.label,
          label:group.label,subtitle:String(config.subtitle||`Productos disponibles en ${group.label}.`).trim(),
          icon:config.icon||"•",iconImage:config.iconImage||"",products:group.products,
          extra:{theme:config.theme||""}
        });
      });
      return finalizeAlbums(rootAlbums,preferredOrder);
    }

    function buildCategoryAlbums(list,sectionLabel){
      const byValue=new Map();
      for(const p of (Array.isArray(list)?list:[])){
        if(!productMatchesSection(p,sectionLabel)) continue;
        const value=navigationCategoryForProduct(p); if(!value) continue;
        const key=cleanNavKey(value); const visual=CATEGORY_VISUALS[key]||{icon:"•"};
        const found=byValue.get(key)||navAlbumBase({
          key:`category::${cleanNavKey(sectionLabel)}::${key}`,navType:"category",navValue:value,label:categoryDisplayLabel(value),
          icon:visual.icon||"•",iconImage:visual.iconImage||"",products:[],extra:{section:sectionLabel}
        });
        found.products.push(p); collectAlbumPreview(found,p); byValue.set(key,found);
      }
      return finalizeAlbums(Array.from(byValue.values()));
    }

    function buildSubcategoryAlbums(list,sectionLabel,categoryLabel){
      const byValue=new Map();
      for(const p of (Array.isArray(list)?list:[])){
        if(!productMatchesSection(p,sectionLabel)) continue;
        if(cleanNavKey(navigationCategoryForProduct(p))!==cleanNavKey(categoryLabel)) continue;
        const value=navigationSubcategoryForProduct(p); if(!value) continue;
        const key=cleanNavKey(value); const visual=CATEGORY_VISUALS[key]||{icon:"•"};
        const found=byValue.get(key)||navAlbumBase({
          key:`subcategory::${cleanNavKey(sectionLabel)}::${cleanNavKey(categoryLabel)}::${key}`,
          navType:"subcategory",navValue:value,label:categoryDisplayLabel(value),icon:visual.icon||"•",iconImage:visual.iconImage||"",products:[],
          extra:{section:sectionLabel,category:categoryLabel}
        });
        found.products.push(p); collectAlbumPreview(found,p); byValue.set(key,found);
      }
      return finalizeAlbums(Array.from(byValue.values()));
    }

    function buildPublicAlbums(list,sectionLabel,categoryLabel,subcategoryLabel=""){
      const byValue=new Map();
      for(const p of (Array.isArray(list)?list:[])){
        if(!productMatchesSection(p,sectionLabel)) continue;
        if(cleanNavKey(navigationCategoryForProduct(p))!==cleanNavKey(categoryLabel)) continue;
        if(subcategoryLabel && cleanNavKey(navigationSubcategoryForProduct(p))!==cleanNavKey(subcategoryLabel)) continue;
        const value=navigationPublicForProduct(p); if(!value) continue;
        const key=cleanNavKey(value);
        const found=byValue.get(key)||navAlbumBase({
          key:`public::${cleanNavKey(sectionLabel)}::${cleanNavKey(categoryLabel)}::${cleanNavKey(subcategoryLabel)}::${key}`,
          navType:"public",navValue:value,label:value,
          icon:key===cleanNavKey("Femeninos")?"♀":(key===cleanNavKey("Masculinos")?"♂":"•"),products:[],
          extra:{section:sectionLabel,category:categoryLabel,subcategory:subcategoryLabel}
        });
        found.products.push(p); collectAlbumPreview(found,p); byValue.set(key,found);
      }
      const order=new Map([[cleanNavKey("Femeninos"),0],[cleanNavKey("Masculinos"),1],[cleanNavKey("Unisex"),2]]);
      return finalizeAlbums(Array.from(byValue.values()),order);
    }

    function buildLineAlbums(list,sectionLabel,categoryLabel,subcategoryLabel="",publicLabel=""){
      const byValue=new Map();
      for(const p of (Array.isArray(list)?list:[])){
        if(!productMatchesSection(p,sectionLabel)) continue;
        if(cleanNavKey(navigationCategoryForProduct(p))!==cleanNavKey(categoryLabel)) continue;
        if(subcategoryLabel && cleanNavKey(navigationSubcategoryForProduct(p))!==cleanNavKey(subcategoryLabel)) continue;
        if(publicLabel && cleanNavKey(navigationPublicForProduct(p))!==cleanNavKey(publicLabel)) continue;
        const value=navigationLineForProduct(p); if(!value) continue;
        const key=cleanNavKey(value); const visual=CATEGORY_VISUALS[key]||{icon:"•"};
        const found=byValue.get(key)||navAlbumBase({
          key:`line::${cleanNavKey(sectionLabel)}::${cleanNavKey(categoryLabel)}::${cleanNavKey(subcategoryLabel)}::${cleanNavKey(publicLabel)}::${key}`,
          navType:"line",navValue:value,label:categoryDisplayLabel(value),icon:visual.icon||"•",iconImage:visual.iconImage||"",products:[],
          extra:{section:sectionLabel,category:categoryLabel,subcategory:subcategoryLabel,public:publicLabel}
        });
        found.products.push(p); collectAlbumPreview(found,p); byValue.set(key,found);
      }
      return finalizeAlbums(Array.from(byValue.values()));
    }

    function navigationLastSelectedIndex(){
      const order=navigationOrderedLevels();
      let last=-1;
      for(let index=0;index<order.length;index++){
        if(order[index]==="product") break;
        if(selectedNavigationValue(order[index])) last=index;
      }
      return last;
    }

    function scopedProductsForCurrentNavigation(list=all){
      let source=(Array.isArray(list)?list:[]).slice();
      const order=navigationOrderedLevels();
      const lastSelected=navigationLastSelectedIndex();
      for(let index=0;index<=lastSelected;index++){
        const level=order[index];
        if(level==="product") break;
        const selected=selectedNavigationValue(level);
        if(selected) source=source.filter(p=>cleanNavKey(navigationValueForProduct(p,level))===cleanNavKey(selected));
        else source=source.filter(p=>!String(navigationValueForProduct(p,level)||"").trim());
      }
      return source;
    }

    function buildLevelAlbums(scoped,level){
      const byValue=new Map();
      const context=navigationSelectionContext();
      for(const p of (Array.isArray(scoped)?scoped:[])){
        const value=navigationValueForProduct(p,level); if(!value) continue;
        const keyValue=cleanNavKey(value);
        const visual=level==="section"?(NAV_SECTIONS.find(item=>cleanNavKey(item.label)===keyValue)||{}):(CATEGORY_VISUALS[keyValue]||{icon:"•"});
        const key=[level,context.section,context.category,context.subcategory,context.public,context.line,value].map(cleanNavKey).join("::");
        const label=level==="public"?value:categoryDisplayLabel(value);
        const icon=level==="public" ? (keyValue===cleanNavKey("Femeninos")?"♀":(keyValue===cleanNavKey("Masculinos")?"♂":"•")) : (visual.icon||"•");
        const found=byValue.get(keyValue)||navAlbumBase({
          key,navType:level,navValue:value,label,icon,iconImage:visual.iconImage||"",products:[],
          subtitle:level==="section"?String(visual.subtitle||"").trim():"",
          extra:{...context,theme:level==="section"?(visual.theme||""):""}
        });
        found.products.push(p); collectAlbumPreview(found,p); byValue.set(keyValue,found);
      }
      let preferredOrder=null;
      if(level==="public") preferredOrder=new Map([[cleanNavKey("Femeninos"),0],[cleanNavKey("Masculinos"),1],[cleanNavKey("Unisex"),2]]);
      else if(level==="section") preferredOrder=new Map(NAV_SECTIONS.map((item,index)=>[cleanNavKey(item.label),index]));
      return finalizeAlbums(Array.from(byValue.values()),preferredOrder);
    }

    function buildAlbumsFromOrder(scoped,startIndex=0){
      const order=navigationOrderedLevels();
      if(startIndex>=order.length || !scoped.length) return [];
      const level=order[startIndex];
      if(level==="product") return [];
      const withValue=[],withoutValue=[];
      for(const p of scoped) String(navigationValueForProduct(p,level)||"").trim()?withValue.push(p):withoutValue.push(p);
      const out=[];
      if(withValue.length) out.push(...buildLevelAlbums(withValue,level));
      if(withoutValue.length) out.push(...buildAlbumsFromOrder(withoutValue,startIndex+1));
      return out.sort((a,b)=>(Number(a.navDepth)||99)-(Number(b.navDepth)||99)||a.label.localeCompare(b.label,"es",{sensitivity:"base"}));
    }

    function navigationViewModeForProducts(scoped,startIndex=navigationLastSelectedIndex()+1){
      const order=navigationOrderedLevels();
      if(!order.length) return {mode:"empty",level:"",index:-1};
      const source=Array.isArray(scoped)?scoped:[];
      for(let index=Math.max(0,startIndex);index<order.length;index++){
        const level=order[index];
        if(level==="product") return {mode:"products",level,index};
        if(source.some(p=>String(navigationValueForProduct(p,level)||"").trim())) return {mode:"albums",level,index};
      }
      return {mode:"terminal",level:"",index:order.length};
    }

    function navigationViewMode(){
      return navigationViewModeForProducts(scopedProductsForCurrentNavigation(all));
    }

    function buildAlbums(list){
      const order=navigationOrderedLevels();
      if(!order.length) return [];
      const scoped=scopedProductsForCurrentNavigation(list);
      const view=navigationViewModeForProducts(scoped);
      if(view.mode!=="albums") return [];
      return buildAlbumsFromOrder(scoped,view.index);
    }

    function refreshNavigationAlbums(){
      albums=buildAlbums(all);
      albumByKey=new Map(albums.map(album=>[album.key,album]));
      const trail=selectedNavigationTrail();
      const current=trail.at(-1);
      selectedAlbumKey=current?`${current.level}::${cleanNavKey(current.label)}`:"";
    }

    window.getCatalogAlbumByKey=key=>albumByKey.get(String(key||""))||null;

    function filterVisibleProducts(list){
      const source = Array.isArray(list) ? list : [];
      return typeof window.isCatalogProductPublic === "function" ? source.filter(window.isCatalogProductPublic) : [];
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
      return albumModeEnabled() && navigationViewMode().mode==="albums" && albums.length > 0;
    }

    function getSelectedAlbum(){
      const trail=selectedNavigationTrail();
      const current=trail.at(-1);
      if(!current) return null;
      return {label:current.label,navType:current.level,...navigationSelectionContext()};
    }

    function currentProductSourceList(){
      return scopedProductsForCurrentNavigation(all);
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
            "category":[p.category, p.subcategory, navigationPublicForProduct(p), p.line]
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
          <p class="product-line"></p>
          <h3 class="name"></h3>
          <p class="meta"></p>
          <p class="description" lang="es-CO"></p>
          <div class="row">
            <span class="price"></span>
            <span class="pill" data-role="qty"></span>
          </div>
          <div class="actions">
            <button type="button" class="btn-danger" data-act="dec" aria-label="Quitar una unidad del carrito">−</button>
            <button type="button" class="btn-acc" data-act="inc"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" ><path d="M3 3h2l2.4 11.4a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21 7H6M10 21h.01M18 21h.01"/></svg><span class="cart-action-label">Agregar al carrito</span></button>
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
      const isSection = album.navType === "section";
      const searchActive = getCombinedWordTerms().length > 0;
      const matchCount = Number(album.count) || 0;
      const matchingProducts = searchActive && Array.isArray(album.matchingProducts)
        ? album.matchingProducts
        : [];

      card.classList.toggle("album-root-card", isSection);
      card.classList.toggle("album-category-card", !isSection);
      card.dataset.navLevel = album.navType || "category";
      card.dataset.navDepth = String(album.navDepth || navigationDepthForType(album.navType));
      card.classList.toggle("search-reactive", searchActive);
      card.classList.toggle("search-hit", searchActive && matchCount > 0);
      card.classList.toggle("search-miss", searchActive && matchCount === 0);
      // Durante una búsqueda por categorías, los paneles sin coincidencias
      // desaparecen progresivamente conforme el texto reduce los resultados.
      card.hidden = searchActive && matchCount === 0;
      if(isSection && album.theme) card.dataset.navTheme = album.theme;

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
        btn.setAttribute("aria-label", isSection ? `Abrir ${album.label}` : `Abrir ${NAV_LEVELS[album.navType]?.label || "nivel"} ${album.label}`);
        btn.title = `${album.label} · ${album.count} ${unitLabel}`;
        if(badge) badge.textContent = `${album.count} ${unitLabel}`;
        if(meta){
          meta.textContent = isSection
            ? (album.subtitle || "")
            : "";
        }
      }

      if(preview) preview.hidden = true;
      if(icon){
        const previewProducts = orderedAlbumPreviewProducts(album,searchActive ? matchingProducts : null);
        const productPreviewSources = previewProducts
          .filter(product => product && (product.hasImage || product.docsImageUrl))
          .map(product => String(product.docsImageUrl || product.imgFilename || "").trim())
          .filter(source => /^https:\/\//i.test(source));
        const matchingPreviewSources = searchActive ? productPreviewSources : [];
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
      if(meta){meta.hidden=!meta.textContent;setSearchHighlightedText(meta,meta.textContent || "");}

      return card;
    }
    const catSel = document.getElementById("cat");
    const brandSel = document.getElementById("brand");
    const sortSel = document.getElementById("sort");
    const PRODUCT_ORDER_STORAGE_KEY="irenismb_product_order_v1";
    const PRODUCT_ORDER_MODES=["price_asc","price_desc","name_asc","name_desc"];
    let catalogDefaultProductOrder="price_asc";
    let productOrderChosen=false;
    try{
      const saved=localStorage.getItem(PRODUCT_ORDER_STORAGE_KEY);
      if(PRODUCT_ORDER_MODES.includes(saved)){sortSel.value=saved;productOrderChosen=true;}
      else if(sortSel) sortSel.value=catalogDefaultProductOrder;
    }catch(_){if(sortSel) sortSel.value=catalogDefaultProductOrder;}
    window.getCatalogDefaultProductOrder=()=>catalogDefaultProductOrder;
    window.applyCatalogDefaultProductOrder=value=>{
      if(!PRODUCT_ORDER_MODES.includes(value)) return false;
      catalogDefaultProductOrder=value;
      if(productOrderChosen || !sortSel || sortSel.value===value) return false;
      sortSel.value=value;
      window.dispatchEvent(new Event("irenismb:product-order-change"));
      return true;
    };

    const qInp = document.getElementById("q");
    const grid = document.getElementById("grid");
    const countEl = document.getElementById("count");
    const albumNav = document.getElementById("albumNav");
    const albumNavHost = document.getElementById("albumNavHost");
    const albumBackBtn = document.getElementById("albumBackBtn");
    const albumPath = document.getElementById("albumPath");

    const searchWrap = document.getElementById("searchWrap");

    const countSlot = document.getElementById("countSlot");
    const topline = document.getElementById("topline");

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
      if(countEl && countSlot && countEl.parentElement!==countSlot)countSlot.appendChild(countEl);
      if(albumNav && albumNavHost && albumNav.parentElement!==albumNavHost)albumNavHost.appendChild(albumNav);
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

    function normalizePublicLabel(value){
      const key=cleanNavKey(value);
      if(["femeninos","femenino","fragancias femeninas"].includes(key)) return "Femeninos";
      if(["masculinos","masculino","fragancias masculinas"].includes(key)) return "Masculinos";
      if(["unisex","fragancias unisex"].includes(key)) return "Unisex";
      return String(value || "").trim();
    }

    function setNavigationFromRawState({section="",category="",subcategory="",public:publicValue="",line="",audience="",gender="",family=""}={}){
      section=String(section || audience || "").trim();
      category=String(category || "").trim();
      subcategory=String(subcategory || "").trim();
      publicValue=normalizePublicLabel(publicValue || gender || "");
      line=String(line || family || "").trim();
      const legacyGiftSection=cleanNavKey(section);
      if([cleanNavKey("Regalos"),cleanNavKey("Regalos para toda ocasión")].includes(legacyGiftSection)){
        section="Belleza y cuidado"; if(!category) category="Regalos";
      }
      clearSelectedNavigationValues();
      const source=Array.isArray(all)?all:[];
      if(section){
        const sections=[...new Set(source.map(navigationSectionForProduct).map(v=>String(v||"").trim()).filter(Boolean))];
        const validSection=sections.find(label=>cleanNavKey(label)===cleanNavKey(section));
        if(validSection) section=validSection;
        else{
          const legacyProduct=source.find(p=>cleanNavKey(navigationCategoryForProduct(p))===cleanNavKey(section));
          if(legacyProduct){
            const legacyMiddle=category; section=navigationSectionForProduct(legacyProduct); category=navigationCategoryForProduct(legacyProduct);
            const categoryProducts=source.filter(p=>productMatchesSection(p,section)&&cleanNavKey(navigationCategoryForProduct(p))===cleanNavKey(category));
            const matchingSub=categoryProducts.find(p=>cleanNavKey(navigationSubcategoryForProduct(p))===cleanNavKey(legacyMiddle));
            subcategory=matchingSub?navigationSubcategoryForProduct(matchingSub):subcategory;
            if(!matchingSub&&legacyMiddle&&!publicValue) publicValue=normalizePublicLabel(legacyMiddle);
          }else section="";
        }
      }
      selectedSection=section; selectedCategory=category; selectedSubcategory=subcategory; selectedPublic=publicValue; selectedLine=line;
    }

    function readStateFromUrl(){
      readAdvisoryFiltersFromUrl();
      const u = new URL(location.href);
      const q = (u.searchParams.get("q") || "").trim();
      const sort = (u.searchParams.get("sort") || "").trim();
      const section = (u.searchParams.get("section") || u.searchParams.get("audience") || "").trim();
      const category = (u.searchParams.get("category") || "").trim();
      const subcategory = (u.searchParams.get("subcategory") || "").trim();
      const publicValue = (u.searchParams.get("public") || u.searchParams.get("gender") || "").trim();
      const line = (u.searchParams.get("line") || u.searchParams.get("family") || "").trim();
      const tags = (u.searchParams.get("tags") || "").trim();

      if(qInp) qInp.value = q || "";
      selectedSuggestionTerms = wordSuggestionsVisible ? uniqueTerms(tags ? tags.split(",") : []) : [];
      setNavigationFromRawState({section,category,subcategory,public:publicValue,line});
      validateNavigationStateAgainstProducts();
      if(PRODUCT_ORDER_MODES.includes(sort) && sortSel){sortSel.value=sort;productOrderChosen=true;}
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
          version:4,
          pathname:location.pathname,
          q:qInp ? String(qInp.value || "") : "",
          sort:sortSel ? String(sortSel.value || "") : "",
          tags:uniqueTerms(selectedSuggestionTerms || []),
          section:String(selectedSection || ""),
          category:String(selectedCategory || ""),
          subcategory:String(selectedSubcategory || ""),
          public:String(selectedPublic || ""),
          line:String(selectedLine || ""),
          admin:window.CATALOG_ADMIN_MODE_ACTIVE === true,
          adminSection:String(window.CATALOG_ADMIN_SECTION || "catalogo"),
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
        return ["q","sort","tags","section","category","subcategory","public","line","audience","gender","family","cat","brand","album","seleccion","necesidad","presupuesto"]
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
        if(!snapshot || ![1,2,3,4].includes(snapshot.version) || snapshot.pathname!==location.pathname) return null;
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
        if(!snapshot || ![1,2,3,4].includes(snapshot.version) || snapshot.pathname!==location.pathname) return null;
        return snapshot;
      }catch(_){
        return null;
      }
    }

    function applyCatalogReloadViewState(snapshot){
      if(!snapshot) return;
      if(qInp) qInp.value=String(snapshot.q || "");
      if(sortSel) sortSel.value=PRODUCT_ORDER_MODES.includes(snapshot.sort) ? snapshot.sort : catalogDefaultProductOrder;
      selectedSuggestionTerms=uniqueTerms(Array.isArray(snapshot.tags)?snapshot.tags:[]);
      setNavigationFromRawState({
        section:String(snapshot.section || snapshot.audience || ""),
        category:String(snapshot.category || ""),
        subcategory:String(snapshot.subcategory || ""),
        public:String(snapshot.public || snapshot.gender || ""),
        line:String(snapshot.line || snapshot.family || "")
      });
      validateNavigationStateAgainstProducts();

      const u=new URL(location.href);
      const q=String(snapshot.q || "").trim();
      const sort=String(snapshot.sort || "").trim();
      const tags=uniqueTerms(Array.isArray(snapshot.tags)?snapshot.tags:[]).join(",");
      if(q)u.searchParams.set("q",q);else u.searchParams.delete("q");
      if(sort)u.searchParams.set("sort",sort);else u.searchParams.delete("sort");
      if(tags)u.searchParams.set("tags",tags);else u.searchParams.delete("tags");
      if(selectedSection)u.searchParams.set("section",selectedSection);else u.searchParams.delete("section");
      if(selectedCategory)u.searchParams.set("category",selectedCategory);else u.searchParams.delete("category");
      if(selectedSubcategory)u.searchParams.set("subcategory",selectedSubcategory);else u.searchParams.delete("subcategory");
      if(selectedPublic)u.searchParams.set("public",selectedPublic);else u.searchParams.delete("public");
      if(selectedLine)u.searchParams.set("line",selectedLine);else u.searchParams.delete("line");
      u.searchParams.delete("audience"); u.searchParams.delete("gender"); u.searchParams.delete("family");
      u.searchParams.delete("album");

      const atRoot=isCatalogRootNavigation();
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
      const section=String(snapshot.adminSection||"catalogo");
      try{window.setCatalogAdminSection?.(section)}catch(_){ }
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
          section:selectedSection || "",
          category:selectedCategory || "",
          subcategory:selectedSubcategory || "",
          public:selectedPublic || "",
          line:selectedLine || ""
        }
      };
    }

    function isCatalogRootNavigation(){
      return !selectedSection && !selectedCategory && !selectedSubcategory && !selectedPublic && !selectedLine;
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

    function makeCatalogHistoryStateForNavigation(index, section="", category="", subcategory="", publicValue="", line="", exitGuardType=""){
      const base = history.state && typeof history.state === "object" ? { ...history.state } : {};
      delete base[CATALOG_EXIT_GUARD_KEY];
      const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
      const state = {
        ...base,
        [CATALOG_HISTORY_KEY]:{
          index:safeIndex,
          section:String(section || ""),
          category:String(category || ""),
          subcategory:String(subcategory || ""),
          public:String(publicValue || ""),
          line:String(line || "")
        }
      };
      if(exitGuardType) state[CATALOG_EXIT_GUARD_KEY] = { type:String(exitGuardType) };
      return state;
    }

    function catalogUrlForRestoredNavigation(section="", category="", subcategory="", publicValue="", line="", {preserveDiscovery=false,baseHref=location.href}={}){
      const u = new URL(baseHref, location.href);
      if(!preserveDiscovery){
        for(const key of ["q","cat","brand","sort","tags","album"]) u.searchParams.delete(key);
      }else u.searchParams.delete("album");
      if(section) u.searchParams.set("section", section); else u.searchParams.delete("section");
      if(category) u.searchParams.set("category", category); else u.searchParams.delete("category");
      if(subcategory) u.searchParams.set("subcategory", subcategory); else u.searchParams.delete("subcategory");
      if(publicValue) u.searchParams.set("public", publicValue); else u.searchParams.delete("public");
      if(line) u.searchParams.set("line", line); else u.searchParams.delete("line");
      return u.toString();
    }

    function rebuildCatalogHistoryForRestoredNavigation({force=false}={}){
      validateNavigationStateAgainstProducts();
      const trail=selectedNavigationTrail();
      if(!trail.length) return false;
      if(!force && currentCatalogHistoryIndex() > 0) return false;
      const restoredUrl=location.href;
      const steps=[],current={section:"",category:"",subcategory:"",publicValue:"",line:""};
      const fieldByLevel={section:"section",category:"category",subcategory:"subcategory",public:"publicValue",line:"line"};
      for(const crumb of trail){const field=fieldByLevel[crumb.level];if(!field) continue;current[field]=crumb.label;steps.push({...current});}
      if(!steps.length) return false;
      const rootUrl=catalogUrlForRestoredNavigation("","","","","",{preserveDiscovery:false,baseHref:restoredUrl});
      history.replaceState(makeCatalogHistoryStateForNavigation(0,"","","","","","sentinel"),"",rootUrl);
      history.pushState(makeCatalogHistoryStateForNavigation(0,"","","","","","guard"),"",rootUrl);
      steps.forEach((step,idx)=>{
        const index=idx+1,isCurrent=idx===steps.length-1;
        history.pushState(makeCatalogHistoryStateForNavigation(index,step.section,step.category,step.subcategory,step.publicValue,step.line),"",catalogUrlForRestoredNavigation(step.section,step.category,step.subcategory,step.publicValue,step.line,{preserveDiscovery:isCurrent,baseHref:restoredUrl}));
      });
      lastCatalogHistoryIndex=steps.length; return true;
    }

    function writeStateToUrl({push=false,index=currentCatalogHistoryIndex()}={}){
      const u = new URL(location.href);
      const q = qInp.value.trim();
      const cat = catSel.value;
      const br = brandSel.value;
      const sort = sortSel ? sortSel.value : "";
      const tags = uniqueTerms(selectedSuggestionTerms || []).join(",");

      if(q) u.searchParams.set("q",q); else u.searchParams.delete("q");
      if(cat) u.searchParams.set("cat",cat); else u.searchParams.delete("cat");
      if(br) u.searchParams.set("brand",br); else u.searchParams.delete("brand");
      if(sort) u.searchParams.set("sort",sort); else u.searchParams.delete("sort");
      if(selectedSection) u.searchParams.set("section",selectedSection); else u.searchParams.delete("section");
      if(selectedCategory) u.searchParams.set("category",selectedCategory); else u.searchParams.delete("category");
      if(selectedSubcategory) u.searchParams.set("subcategory",selectedSubcategory); else u.searchParams.delete("subcategory");
      if(selectedPublic) u.searchParams.set("public",selectedPublic); else u.searchParams.delete("public");
      if(selectedLine) u.searchParams.set("line",selectedLine); else u.searchParams.delete("line");
      u.searchParams.delete("audience"); u.searchParams.delete("gender"); u.searchParams.delete("family");
      u.searchParams.delete("album");
      if(tags) u.searchParams.set("tags",tags); else u.searchParams.delete("tags");
      writeAdvisoryFiltersToUrl(u);

      const safeIndex=Number.isInteger(index)&&index>=0?index:0;
      const state=makeCatalogHistoryState(safeIndex,{preserveExitGuard:!push});
      if(push) history.pushState(state,"",u.toString()); else history.replaceState(state,"",u.toString());
      lastCatalogHistoryIndex=safeIndex;
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
      const order=navigationOrderedLevels();
      const activeGroups=new Set(order.filter(level=>level!=="product"));
      for(const level of ["section","category","subcategory","public","line"]) if(!activeGroups.has(level)) setSelectedNavigationValue(level,"");
      const productIndex=order.indexOf("product");
      if(productIndex>=0) for(const level of order.slice(productIndex+1)) setSelectedNavigationValue(level,"");
      let scoped=Array.isArray(all)?all.slice():[];
      const lastSelected=navigationLastSelectedIndex();
      for(let index=0;index<=lastSelected;index++){
        const level=order[index]; if(level==="product") break;
        const selected=selectedNavigationValue(level);
        const matching=selected ? scoped.filter(p=>cleanNavKey(navigationValueForProduct(p,level))===cleanNavKey(selected)) : scoped.filter(p=>!String(navigationValueForProduct(p,level)||"").trim());
        if(!matching.length){
          if(selected) setSelectedNavigationValue(level,"");
          for(const later of order.slice(index+1)) setSelectedNavigationValue(later,"");
          return;
        }
        scoped=matching;
      }
    }

    function restoreCatalogStateFromHistory(event){
      clearTimeout(_urlTimer);
      _urlTimer = null;

      const poppedState = event && typeof event === "object" ? event.state : history.state;
      const poppedGuardType = catalogExitGuardType(poppedState);
      const poppedCatalogState = poppedState && typeof poppedState === "object" ? poppedState[CATALOG_HISTORY_KEY] : null;
      const poppedAtRoot = !String(poppedCatalogState?.section || poppedCatalogState?.audience || "").trim()
        && !String(poppedCatalogState?.category || "").trim()
        && !String(poppedCatalogState?.subcategory || "").trim()
        && !String(poppedCatalogState?.public || poppedCatalogState?.gender || "").trim()
        && !String(poppedCatalogState?.line || poppedCatalogState?.family || "").trim();

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
      advisoryState.facets={};advisoryState.needs.clear();advisoryState.budget=null;advisoryState.includeUnknown=false;advisoryState.sharedCodes=null;
      const budget=document.getElementById("advisorBudget"),unknown=document.getElementById("advisorIncludeUnknown");if(budget)budget.value="";if(unknown)unknown.checked=false;
      if(qInp) qInp.value = "";
      if(catSel) catSel.value = "";
      if(brandSel) brandSel.value = "";
      selectedSuggestionTerms = [];
    }
    function compareCatalogProductOrder(a,b){
      const mode=sortSel ? sortSel.value : "";
      const byName=String(a.name||"").localeCompare(String(b.name||""),"es",{sensitivity:"base"});
      const byId=String(a.id||"").localeCompare(String(b.id||""));
      if(mode==="price_asc" || mode==="price_desc"){
        if((a.hasPrice!==false)!==(b.hasPrice!==false)) return a.hasPrice===false ? 1 : -1;
        const byPrice=(Number(a.price)||0)-(Number(b.price)||0);
        return (mode==="price_desc" ? -byPrice : byPrice) || byName || byId;
      }
      return (mode==="name_desc" ? -byName : byName) || byId;
    }

    function orderedAlbumPreviewProducts(album,matchingProducts=null){
      return (matchingProducts || album.products || []).filter(product=>{
        const source=String(product?.docsImageUrl || product?.imgFilename || "").trim();
        return product && (product.hasImage || product.docsImageUrl) && /^https:\/\//i.test(source);
      }).slice().sort(compareCatalogProductOrder);
    }

    function buildFilteredList(){
      const source = currentProductSourceList();
      const sortMode = sortSel ? sortSel.value : "";
      const terms = getCombinedWordTerms();
      const searchableSource = terms.length ? filterSearchExcludedProducts(source) : source;

      let filtered = searchableSource.filter(p=>{
        if(!window.CATALOG_ADMIN_MODE_ACTIVE && advisoryState.sharedCodes && !advisoryState.sharedCodes.has(String(p.id)))return false;
        if(!window.CATALOG_ADMIN_MODE_ACTIVE && advisoryExperienceAvailable() && !p.isGiftGalleryImage && !advisoryMatches(p)) return false;
        if(terms.length){
          return terms.every(t => p.searchKey.includes(t));
        }
        return true;
      });

      filtered.sort(compareCatalogProductOrder);

      return filtered;
    }

    function buildFilteredAlbums(){
      const terms=getCombinedWordTerms();
      let filtered=albums.map(album=>{
        if(!terms.length) return album;
        const searchableProducts=filterSearchExcludedProducts(album.products||[]);
        const matchingProducts=searchableProducts.filter(p=>terms.every(t=>p.searchKey.includes(t)));
        return {...album,count:matchingProducts.length,matchingProducts};
      });
      const mode=sortSel ? sortSel.value : "";
      const representatives=new Map(filtered.map(album=>[
        album.key,orderedAlbumPreviewProducts(album,terms.length ? (album.matchingProducts || []) : null)[0] || null
      ]));
      filtered.sort((a,b)=>{
        const byName=String(a.label||"").localeCompare(String(b.label||""),"es",{sensitivity:"base"});
        if(mode==="price_asc" || mode==="price_desc"){
          const ap=representatives.get(a.key),bp=representatives.get(b.key);
          const aPriced=!!ap && ap.hasPrice!==false;
          const bPriced=!!bp && bp.hasPrice!==false;
          if(aPriced!==bPriced) return aPriced ? -1 : 1;
          if(aPriced && bPriced){
            const delta=(Number(ap.price)||0)-(Number(bp.price)||0);
            if(delta) return mode==="price_desc" ? -delta : delta;
          }
          return byName;
        }
        return mode==="name_desc" ? -byName : byName;
      });
      return filtered;
    }

    // Asesoría comparte la selección de Folleto y respeta los niveles activos.
    const ADVISORY_FACETS = Object.freeze({brand:"advisorBrand",line:"advisorLine",productType:"advisorType",variant:"advisorVariant",presentation:"advisorPresentation",public:"advisorPublic"});
    const advisoryState = {facets:{},needs:new Set(),budget:null,includeUnknown:false,sharedCodes:null,comparison:new Set(),comparisonOpen:false,initialized:false};

    function advisoryExperienceAvailable(){return !!document.getElementById("advisorBrowse");}
    function advisoryPrice(product){
      return shouldShowProductPrices() ? product.hasPrice===false ? "Precio por confirmar" : new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:2}).format(product.price) : "";
    }
    function advisoryMatches(product,state=advisoryState,exceptFacet="",ignoreNeeds=false){
      if(!product || product.isGiftGalleryImage) return false;
      for(const [field,value] of Object.entries(state.facets||{})){
        if(field!==exceptFacet && value && normalizeText(product[field])!==normalizeText(value)) return false;
      }
      if(!ignoreNeeds && state.needs?.size && ![...(state.needs)].every(need=>(product.needs||[]).some(value=>normalizeText(value)===normalizeText(need)))) return false;
      if(state.budget!==null && state.budget!==undefined){
        if(product.hasPrice===false) return state.includeUnknown===true;
        if(!Number.isFinite(product.price) || product.price>state.budget) return false;
      }
      return true;
    }
    function advisoryComponents(product){
      return (product.components||[]).map(component=>{
        const quantity=String(component.quantity??component.units??"").trim(),content=String(component.content??"").trim(),unit=String(component.unit||"").trim();
        return [component.name,quantity ? `${quantity} ×` : "",[content,unit].filter(Boolean).join(" ")].filter(Boolean).join(" · ");
      });
    }
    function advisoryPresentation(product){return [product.presentation,[product.content,product.unit].filter(Boolean).join(" "),product.units?`${product.units} unidades`:""].filter(Boolean).join(" · ");}
    function advisorySelectedProducts(){
      if(window.CATALOG_PUBLIC_VISIBILITY_CONFIRMED!==true) return [];
      return allLoadedProducts.filter(p=>!p.isGiftGalleryImage && FOLLETO_SELECTION.has(String(p.id)) && window.isCatalogProductPublic?.(p));
    }
    function advisorySharedText(products,note=""){
      const url=new URL(SITE_BASE+"catalogo.html");
      url.searchParams.set("seleccion",products.map(p=>String(p.id)).join(","));
      return ["Selección recomendada",String(note||"").trim(),...products.map(p=>[`${p.name} · Código ${p.id}`,advisoryPrice(p),(p.needs||[]).join(" · "),...advisoryComponents(p)].filter(Boolean).join("\n")),`Ver selección: ${url.toString()}`].filter(Boolean).join("\n\n");
    }
    function writeAdvisoryFiltersToUrl(url){
      if(!advisoryState.initialized) return;
      for(const field of Object.keys(ADVISORY_FACETS)){
        const key="asesoria_"+field,value=advisoryState.facets[field];
        if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
      }
      if(advisoryState.needs.size)url.searchParams.set("necesidad",[...advisoryState.needs].join(";"));else url.searchParams.delete("necesidad");
      if(advisoryState.budget!==null)url.searchParams.set("presupuesto",String(advisoryState.budget));else url.searchParams.delete("presupuesto");
      if(advisoryState.includeUnknown)url.searchParams.set("sin_precio","1");else url.searchParams.delete("sin_precio");
      if(advisoryState.sharedCodes)url.searchParams.set("seleccion",[...advisoryState.sharedCodes].join(","));else url.searchParams.delete("seleccion");
    }
    function readAdvisoryFiltersFromUrl(){
      if(!advisoryState.initialized)return;
      const query=new URL(location.href).searchParams;
      advisoryState.sharedCodes=query.has("seleccion")?new Set((query.get("seleccion")||"").split(",").filter(id=>/^\d{4}$/.test(id))):null;
      advisoryState.facets={};for(const field of Object.keys(ADVISORY_FACETS))advisoryState.facets[field]=query.get("asesoria_"+field)||"";
      advisoryState.needs=new Set((query.get("necesidad")||"").split(";").filter(Boolean));
      const budget=query.get("presupuesto"),amount=Number(budget);advisoryState.budget=budget!==null&&budget!==""&&Number.isFinite(amount)&&amount>=0?amount:null;
      advisoryState.includeUnknown=query.get("sin_precio")==="1";
      const input=document.getElementById("advisorBudget"),unknown=document.getElementById("advisorIncludeUnknown");if(input)input.value=advisoryState.budget===null?"":String(advisoryState.budget);if(unknown)unknown.checked=advisoryState.includeUnknown;
    }
    function advisoryButton(label,className,action){
      const button=document.createElement("button");button.type="button";button.textContent=label;button.className=className;
      if(action)button.addEventListener("click",action);return button;
    }
    function advisoryStatus(message){const status=document.getElementById("advisorSelectionStatus");if(status)status.textContent=message;}
    function syncAdvisorySelection(){
      if(!advisoryExperienceAvailable())return;
      const products=advisorySelectedProducts(),admin=window.CATALOG_ADMIN_MODE_ACTIVE;
      document.getElementById("advisorSelectionCount").textContent=`(${products.length})`;
      const panel=document.getElementById("advisorSelection"),items=document.getElementById("advisorSelectionItems");
      panel.hidden=!!admin||!products.length;items.replaceChildren();
      for(const product of products){
        const item=document.createElement("div");item.className="advisor-selection-item";
        item.append(makeImgFromFilename(product.imgFilename,product.name,product.docsImageUrl));
        const name=document.createElement("span");name.textContent=product.name;
        const remove=advisoryButton("×","advisor-remove",()=>{FOLLETO_SELECTION.delete(String(product.id));advisoryState.comparison.delete(String(product.id));saveAdvisorySelection();render();});
        remove.setAttribute("aria-label","Quitar "+product.name+" de la selección");item.append(name,remove);items.append(item);
      }
      for(const id of [...advisoryState.comparison])if(!products.some(p=>String(p.id)===id))advisoryState.comparison.delete(id);
      document.querySelectorAll("[data-folleto-select]").forEach(input=>{input.checked=FOLLETO_SELECTION.has(input.dataset.folletoSelect);});
      renderAdvisoryComparison();
    }
    function saveAdvisorySelection(){
      try{localStorage.setItem("natura_asesoria_seleccion_v1",JSON.stringify([...FOLLETO_SELECTION].filter(id=>/^\d{4}$/.test(id))));}catch(_){}
      syncAdvisorySelection();
    }
    function compareAdvisoryProduct(product){
      const id=String(product.id);
      if(advisoryState.comparison.has(id))advisoryState.comparison.delete(id);
      else{
        if(advisoryState.comparison.size>=3){advisoryStatus("Puedes comparar hasta tres productos. Quita una opción de la comparación para añadir otra.");document.getElementById("advisorComparison")?.scrollIntoView({behavior:"smooth",block:"center"});return;}
        FOLLETO_SELECTION.add(id);advisoryState.comparison.add(id);
      }
      advisoryState.comparisonOpen=true;saveAdvisorySelection();render();
      document.getElementById("advisorComparison")?.scrollIntoView({behavior:"smooth",block:"start"});
    }
    function renderAdvisoryComparison(){
      const panel=document.getElementById("advisorComparison");if(!panel)return;
      const products=advisorySelectedProducts().filter(p=>advisoryState.comparison.has(String(p.id))).slice(0,3);
      panel.hidden=!!window.CATALOG_ADMIN_MODE_ACTIVE||!advisoryState.comparisonOpen||!products.length;
      if(panel.hidden)return;
      const container=document.getElementById("advisorComparisonContent");container.replaceChildren();
      const table=document.createElement("table");table.className="advisor-comparison-table";
      const caption=document.createElement("caption");caption.className="visually-hidden";caption.textContent="Comparación de los productos seleccionados";table.append(caption);
      const head=document.createElement("thead"),headRow=document.createElement("tr"),corner=document.createElement("th");corner.scope="col";corner.textContent="Producto";headRow.append(corner);
      for(const p of products){
        const cell=document.createElement("th");cell.scope="col";const label=document.createElement("span");label.textContent=p.name;
        const remove=advisoryButton("Quitar","advisor-remove-comparison",()=>{advisoryState.comparison.delete(String(p.id));render();});remove.setAttribute("aria-label","Quitar "+p.name+" de la comparación");cell.append(label,remove);headRow.append(cell);
      }
      head.append(headRow);table.append(head);
      const body=document.createElement("tbody"),fields=[
        ["Necesidades",p=>(p.needs||[]).join("; ")],["Descripción",p=>p.description],
        ["Componentes del kit",p=>advisoryComponents(p).join("\n")],["Presentación",advisoryPresentation],
        ["Tipo",p=>p.productType],["Línea",p=>p.line],["Variante",p=>p.variant],
        ["Adecuado para",p=>p.suitableFor],["Modo de uso confirmado",p=>p.useInstructions],
        ["Código",p=>p.id]
      ];
      if(shouldShowProductPrices())fields.splice(0,0,["Precio",advisoryPrice]);
      for(const [label,value] of fields){
        const row=document.createElement("tr"),heading=document.createElement("th");heading.scope="row";heading.textContent=label;row.append(heading);
        for(const p of products){const cell=document.createElement("td");cell.textContent=value(p)||"Sin información confirmada";row.append(cell);}body.append(row);
      }
      table.append(body);container.append(table);
    }
    function openAdvisoryDetail(product){
      let dialog=document.getElementById("advisorDetailDialog");
      if(!dialog){dialog=document.createElement("dialog");dialog.id="advisorDetailDialog";dialog.className="advisor-detail-dialog";document.body.append(dialog);dialog.addEventListener("click",event=>{if(event.target===dialog){const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();}});}
      dialog.replaceChildren();dialog.setAttribute("aria-labelledby","advisorDetailTitle");
      const close=advisoryButton("Cerrar","btn-ghost",()=>dialog.close());close.classList.add("advisor-detail-close");
      const title=document.createElement("h2");title.id="advisorDetailTitle";title.textContent=product.name;
      const image=makeImgFromFilename(product.imgFilename,product.name,product.docsImageUrl);image.classList.add("advisor-detail-image");
      dialog.append(close,title,image);
      const fields=[["Precio",advisoryPrice(product)],["Necesidades",(product.needs||[]).join("; ")],["Descripción",product.description],["Componentes",advisoryComponents(product).join("\n")],["Presentación",advisoryPresentation(product)],["Marca",product.brand],["Línea",product.line],["Tipo",product.productType],["Variante",product.variant],["Público",product.public],["Adecuado para",product.suitableFor],["Modo de uso confirmado",product.useInstructions],["Código",product.id]];
      const details=document.createElement("dl");
      for(const [label,value] of fields){if(!value)continue;const term=document.createElement("dt"),definition=document.createElement("dd");term.textContent=label;definition.textContent=value;details.append(term,definition);}dialog.append(details);
      dialog.showModal();
    }
    function renderAdvisoryProductCard(card,product){
      card.classList.add("advisor-product-card");
      const pad=card.querySelector(".pad"),name=card.querySelector(".name"),details=card.querySelector(".product-details"),description=card.querySelector(".description"),row=card.querySelector(".row");
      setSearchHighlightedText(name,product.name);name.title=product.name;
      const meta=card.querySelector(".meta");meta.textContent=INTERRUPTORES.MOSTRAR_CANTIDAD_STOCK?(Number.isFinite(product.stock)?`Stock: ${product.stock}`:"Stock: Por confirmar"):"";meta.hidden=!meta.textContent;
      if(details){details.before(description);details.remove();}
      description.classList.add("advisor-product-description");
      const badges=document.createElement("div");badges.className="advisor-product-needs";
      for(const need of (product.needs||[]).slice(0,3)){const tag=document.createElement("span");tag.textContent=need;badges.append(tag);}name.after(badges);
      const components=advisoryComponents(product);
      if(components.length){const list=document.createElement("ul");list.className="advisor-components";for(const text of components){const item=document.createElement("li");item.textContent=text;list.append(item);}description.after(list);}
      const presentation=document.createElement("p");presentation.className="advisor-product-presentation";presentation.textContent=advisoryPresentation(product);presentation.hidden=!presentation.textContent;row.before(presentation);
      const code=document.createElement("span");code.className="advisor-product-code";code.textContent=`Código ${product.id}`;row.append(code);
      const price=card.querySelector(".price");price.textContent=advisoryPrice(product);price.hidden=!price.textContent;
      const controls=document.createElement("div");controls.className="advisor-product-buttons";
      const compare=advisoryButton(advisoryState.comparison.has(String(product.id))?"Quitar comparación":"Comparar","btn-ghost",()=>compareAdvisoryProduct(product));compare.setAttribute("aria-pressed",String(advisoryState.comparison.has(String(product.id))));
      controls.append(advisoryButton("Ver detalle","btn-ghost",()=>openAdvisoryDetail(product)),compare);pad.append(controls);
      const selection=card.querySelector(".product-selection");if(selection){selection.title="Añadir a mi selección";selection.querySelector("input").setAttribute("aria-label","Seleccionar "+product.name+" para asesorar o crear un folleto");}
    }
    function renderAdvisoryFacets(source){
      for(const [field,id] of Object.entries(ADVISORY_FACETS)){
        const select=document.getElementById(id),current=advisoryState.facets[field]||"";
        const options=[...new Set(source.filter(p=>advisoryMatches(p,advisoryState,field)).map(p=>String(p[field]||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
        if(current&&!options.includes(current))options.unshift(current);
        select.replaceChildren();const first=document.createElement("option");first.value="";first.textContent=field==="productType"||field==="public"?"Todos":"Todas";select.append(first);
        for(const value of options){const option=document.createElement("option");option.value=value;option.textContent=value;select.append(option);}select.value=current;
      }
      const needs=document.getElementById("advisorNeeds"),counts=new Map();needs.replaceChildren();
      for(const p of source.filter(p=>advisoryMatches(p,advisoryState,"",true))){for(const need of new Set(p.needs||[]))counts.set(need,(counts.get(need)||0)+1);}
      for(const need of advisoryState.needs)if(!counts.has(need))counts.set(need,0);
      const options=[...counts].sort((a,b)=>Number(advisoryState.needs.has(b[0]))-Number(advisoryState.needs.has(a[0]))||b[1]-a[1]||a[0].localeCompare(b[0],"es"));
      let extra;
      if(options.length>8){extra=document.createElement("details");extra.className="advisor-more-needs";const summary=document.createElement("summary");summary.textContent="Más necesidades";extra.append(summary);}
      options.forEach(([need,count],index)=>{
        const button=advisoryButton(`${need} (${count})`,"advisor-need",()=>{advisoryState.needs.has(need)?advisoryState.needs.delete(need):advisoryState.needs.add(need);render();});button.setAttribute("aria-pressed",String(advisoryState.needs.has(need)));button.disabled=!count&&!advisoryState.needs.has(need);
        if(index<8)needs.append(button);else extra.append(button);
      });
      if(extra)needs.append(extra);document.getElementById("advisorNeedsEmpty").hidden=options.length>0;
      const active=document.getElementById("advisorActiveFilters");active.replaceChildren();
      const labels=[...Object.values(advisoryState.facets).filter(Boolean),...advisoryState.needs,advisoryState.budget===null?"":`Hasta ${new Intl.NumberFormat("es-CO").format(advisoryState.budget)}`].filter(Boolean);
      active.textContent=labels.length?labels.join(" · "):"";
      document.getElementById("advisorIncludeUnknown").disabled=advisoryState.budget===null;
    }
    function renderAdvisoryExperience(viewMode){
      if(!advisoryExperienceAvailable())return false;
      const host=document.getElementById("advisorBrowse");host.hidden=!!window.CATALOG_ADMIN_MODE_ACTIVE;
      document.getElementById("advisorPageTitle").textContent=window.CATALOG_ADMIN_MODE_ACTIVE?"Catálogo":"Encuentra el producto ideal";
      syncAdvisorySelection();
      if(window.CATALOG_ADMIN_MODE_ACTIVE)return false;
      grid.classList.remove("album-grid-mode");
      const source=currentProductSourceList().filter(p=>!advisoryState.sharedCodes||advisoryState.sharedCodes.has(String(p.id))),eligible=source.filter(p=>!p.isGiftGalleryImage);
      renderAdvisoryFacets(eligible);
      const albumsHost=document.getElementById("advisorAlbums");albumsHost.replaceChildren();
      const terms=getCombinedWordTerms();
      const directRequested=window.isCatalogShowAllProductsDirectEnabled?.()===true || terms.length>0&&window.isCatalogQuickImageSearchEnabled?.()===true;
      const renderProducts=viewMode.mode==="products" || directRequested&&navigationOrderedLevels().includes("product");
      const filtered=source.filter(p=>(p.isGiftGalleryImage ? !terms.length&&!advisoryState.needs.size&&!Object.values(advisoryState.facets).some(Boolean)&&advisoryState.budget===null : advisoryMatches(p)&&(!terms.length||terms.every(term=>p.searchKey.includes(term))))).sort(compareCatalogProductOrder);
      if(viewMode.mode==="albums"){
        const matching=new Set(filtered.map(p=>String(p.id)));
        for(const album of buildFilteredAlbums()){
          const count=(album.products||[]).filter(p=>matching.has(String(p.id))).length;if(!count)continue;
          const unit=count===1?"producto":"productos";
          const button=advisoryButton("","advisor-album",()=>openAlbum(album.key,{keepFilters:true}));button.setAttribute("aria-label",`${album.label}, ${count} ${unit}`);
          const icon=document.createElement("span");icon.className="advisor-album-icon";icon.setAttribute("aria-hidden","true");
          const shapes={
            perfumeria:'<path d="M9 3h6v4H9zM8 8h8l3 5v10H5V13z"/><path d="M8 15h8v5H8z"/>',
            cabello:'<path d="M7 6c0-4 10-4 10 0v17H7zM9 5h6M10 8v12M13 8v12M16 8v12"/>',
            'cuidado personal':'<path d="M5 8h6v15H4V10zM5 4h6v4H5zM15 12h6v11h-6zM16 8h4v4h-4z"/>',
            'kits y combos':'<path d="M3 10h18v13H3zM3 10l5-5h8l5 5M12 10v13M6 14h3M15 14h3"/>',
            maquillaje:'<path d="M4 12h6v11H4zM5 12V5l4-2v9M16 13v10h3V13M15 4h5v5l-2 4h-2l-2-4z"/>',
            regalos:'<path d="M3 10h18v4H3zM5 14v9h14v-9M12 10v13M12 10C2 10 5 1 9 5l3 5c10 0 7-9 3-5z"/>'
          };
          const shape=shapes[normalizeText(album.label)];
          if(shape)icon.innerHTML='<svg viewBox="0 0 24 26" xmlns="http://www.w3.org/2000/svg" fill="#f1d8df" stroke="#a27d66" stroke-width="1.3" stroke-linejoin="round">'+shape+'</svg>';else icon.textContent=album.icon&&album.icon!=="•"?album.icon:"✦";
          const label=document.createElement("span");label.textContent=album.label;const total=document.createElement("small");total.textContent=`${count} ${unit}`;button.append(icon,label,total);albumsHost.append(button);
        }
      }
      if(renderProducts){
        grid.replaceChildren();const fragment=document.createDocumentFragment();
        if(!filtered.length)fragment.append(makeEmptyState("No hay productos con estos filtros."));else for(const p of filtered)fragment.append(makeCard(p));grid.append(fragment);
        document.getElementById("advisorResultsTitle").textContent=advisoryState.sharedCodes?"Selección compartida":selectedCategory?`Opciones de ${selectedCategory.toLocaleLowerCase("es")}`:"Opciones para ti";scheduleJsonLdUpdate(filtered);
      }else if(viewMode.mode==="albums"){
        grid.replaceChildren(makeEmptyState(albumsHost.children.length?"Elige una opción para continuar":"No hay opciones con estos filtros."));
        document.getElementById("advisorResultsTitle").textContent="Explora tus opciones";scheduleJsonLdUpdate([]);
      }else{grid.replaceChildren(makeEmptyState("No hay un nivel posterior configurado para esta vista."));scheduleJsonLdUpdate([]);}
      grid.classList.toggle("advisor-grid",renderProducts);grid.classList.remove("album-three-column-layout");
      grid.setAttribute("aria-label",renderProducts?"Productos":"Navegación del catálogo");
      const count=filtered.filter(p=>!p.isGiftGalleryImage).length;
      document.getElementById("advisorResultCount").textContent=`${count} ${count===1?"producto":"productos"}`;
      if(countEl){countEl.textContent=`${count} ${count===1?"producto":"productos"}`;countEl.classList.toggle("search-active",!!terms.length);}
      return true;
    }
    function initAdvisoryExperience(){
      if(!advisoryExperienceAvailable()||advisoryState.initialized)return;advisoryState.initialized=true;
      const query=new URL(location.href).searchParams;
      advisoryState.sharedCodes=query.has("seleccion")?new Set((query.get("seleccion")||"").split(",").filter(id=>/^\d{4}$/.test(id))):null;
      for(const [field,id] of Object.entries(ADVISORY_FACETS)){
        advisoryState.facets[field]=query.get("asesoria_"+field)||"";
        document.getElementById(id).addEventListener("change",event=>{advisoryState.facets[field]=event.target.value;render();});
      }
      advisoryState.needs=new Set((query.get("necesidad")||"").split(";").filter(Boolean));
      const budget=query.get("presupuesto"),amount=Number(budget);advisoryState.budget=budget!==null&&budget!==""&&Number.isFinite(amount)&&amount>=0?amount:null;
      const budgetInput=document.getElementById("advisorBudget");budgetInput.value=advisoryState.budget===null?"":String(advisoryState.budget);
      budgetInput.addEventListener("input",event=>{const value=event.target.value,number=Number(value);advisoryState.budget=value!==""&&Number.isFinite(number)&&number>=0?number:null;render();});
      const unknown=document.getElementById("advisorIncludeUnknown");unknown.checked=advisoryState.includeUnknown=query.get("sin_precio")==="1";unknown.addEventListener("change",()=>{advisoryState.includeUnknown=unknown.checked;render();});
      let selected=[];try{selected=JSON.parse(localStorage.getItem("natura_asesoria_seleccion_v1")||"[]");}catch(_){}
      if(query.has("seleccion"))selected=(query.get("seleccion")||"").split(",");
      if(Array.isArray(selected))for(const id of selected)if(/^\d{4}$/.test(String(id)))FOLLETO_SELECTION.add(String(id));
      document.addEventListener("change",event=>{if(event.target?.dataset?.folletoSelect){const id=event.target.dataset.folletoSelect;event.target.checked?FOLLETO_SELECTION.add(id):FOLLETO_SELECTION.delete(id);if(!event.target.checked)advisoryState.comparison.delete(id);saveAdvisorySelection();}});
      document.getElementById("advisorClearBtn").addEventListener("click",()=>{advisoryState.facets={};advisoryState.needs.clear();advisoryState.budget=null;advisoryState.includeUnknown=false;budgetInput.value="";unknown.checked=false;resetDiscoveryFilters();render();});
      document.getElementById("advisorNavBtn").addEventListener("click",()=>{window.setCatalogShowAllProductsDirectEnabled?.(true);document.getElementById("advisorBrowse").scrollIntoView({behavior:"smooth",block:"start"});});
      document.getElementById("advisorSelectionNavBtn").addEventListener("click",()=>{if(!advisorySelectedProducts().length){advisoryStatus("Selecciona productos usando el corazón de cada ficha.");const panel=document.getElementById("advisorSelection");panel.hidden=false;}document.getElementById("advisorSelection").scrollIntoView({behavior:"smooth",block:"start"});});
      document.getElementById("advisorCompareSelectionBtn").addEventListener("click",()=>{const products=advisorySelectedProducts();if(products.length>3){advisoryStatus("Selecciona hasta tres productos para comparar, o usa Comparar en las fichas.");return;}advisoryState.comparison=new Set(products.map(p=>String(p.id)));advisoryState.comparisonOpen=true;renderAdvisoryComparison();document.getElementById("advisorComparison").scrollIntoView({behavior:"smooth",block:"start"});});
      document.getElementById("advisorCloseComparisonBtn").addEventListener("click",()=>{advisoryState.comparisonOpen=false;renderAdvisoryComparison();});
      document.getElementById("advisorClearSelectionBtn").addEventListener("click",()=>{FOLLETO_SELECTION.clear();advisoryState.comparison.clear();saveAdvisorySelection();render();});
      const recommendation=()=>advisorySharedText(advisorySelectedProducts(),document.getElementById("advisorNote").value);
      document.getElementById("advisorShareBtn").addEventListener("click",()=>{if(!advisorySelectedProducts().length)return;window.open("https://wa.me/?text="+encodeURIComponent(recommendation()),"_blank","noopener,noreferrer");});
      document.getElementById("advisorCopyBtn").addEventListener("click",async()=>{try{if(!advisorySelectedProducts().length)return;await copyProductText(recommendation());advisoryStatus("Recomendación copiada.");}catch(error){advisoryStatus(error.message);}});
      document.getElementById("advisorCartBtn").addEventListener("click",()=>{const products=advisorySelectedProducts();for(const p of products){const id=String(p.id);cart[id]={id:p.id,name:p.name,price:p.price,hasPrice:p.hasPrice!==false,qty:(cart[id]?.qty||0)+1,stock:p.stock,imgFilename:p.imgFilename||null};}saveCart();refreshCartCount();render();advisoryStatus(`${products.length} productos añadidos al carrito.`);});
      window.addEventListener("irenismb:admin-mode-change",()=>{document.getElementById("advisorDetailDialog")?.close();syncAdvisorySelection();});
    }

    window.acceptCatalogAdminProductTable=function(table){
      const imageIndex=new Map(Object.entries(lastImageIndex?.products||{}).map(([code,entries])=>[code,orderProductImageEntries(entries)]));
      const assessment=buildCompatibleGoogleSheetProducts(readGoogleSheetProductRows(table).map(row=>({row,imageIndex})));
      allLoadedProducts=[...assessment.products,...publicCatalogProducts.filter(p=>p.isGiftGalleryImage)];
    };
    window.restoreCatalogPublicProducts=function(){
      for(const product of allLoadedProducts){product.cost=null;product.costText="";}
      allLoadedProducts=publicCatalogProducts.slice();
      rebuildCatalogVisibility();
      loadProducts({silent:true,refreshImages:false});
    };

    let _renderToken = 0;
    function render(){
      const token = ++_renderToken;

      // Mientras termina la carga inicial, el progreso es la única vista válida.
      // Evita renders prematuros, incluso al restaurar automáticamente el modo administrador.
      if(window.CATALOG_INITIAL_LOAD_READY !== true) return;

      if(!window.CATALOG_PUBLIC_CONFIG_CONFIRMED){
        if(grid){grid.classList.remove("album-three-column-layout");grid.replaceChildren(makeEmptyState("Esperando la configuración del catálogo…"));}
        if(countEl) countEl.textContent = "Configuración pendiente";
        scheduleJsonLdUpdate([]);
        return;
      }
      if(window.CATALOG_PUBLIC_VISIBILITY_CONFIRMED !== true && !window.CATALOG_ADMIN_MODE_ACTIVE){
        if(grid){grid.classList.remove("album-three-column-layout");grid.replaceChildren(makeEmptyState("No se pudieron confirmar las reglas de publicación. Recarga el catálogo."));}
        if(countEl) countEl.textContent = "Publicación pendiente de confirmar";
        scheduleJsonLdUpdate([]);
        return;
      }
      syncFilterVisibility();
      syncWordToggleButton();
      renderWordSuggestions();
      updateCountAttention();
      scheduleWriteStateToUrl();

      const qHas = getCombinedWordTerms().length > 0;
      const viewMode=navigationViewMode();

      if(viewMode.mode==="empty"){
        for(const id of ["advisorBrowse","advisorSelection","advisorComparison"]){const panel=document.getElementById(id);if(panel)panel.hidden=true;}
        if(grid){grid.classList.remove("album-three-column-layout");grid.innerHTML="";grid.appendChild(makeEmptyState("No hay niveles de navegación activos."));}
        if(countEl){countEl.textContent="0 niveles activos";countEl.classList.remove("search-active");}
        scheduleJsonLdUpdate([]);
        return;
      }

      if(renderAdvisoryExperience(viewMode)) return;

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
          const navTypes=[...new Set(filteredAlbums.map(album=>album.navType).filter(Boolean))];
          const groupType=navTypes[0]||viewMode.level||"section";
          const mixedTypes=navTypes.length>1;
          if(qHas){
            const productWord = totalProducts === 1 ? "producto encontrado" : "productos encontrados";
            const groupWord=mixedTypes?"grupos de navegación":(activeCards===1?navigationLevelLabel(groupType,false).toLowerCase():navigationLevelLabel(groupType,true).toLowerCase());
            countEl.textContent = `${totalProducts} ${productWord} en ${activeCards} ${groupWord}`;
          }else{
            const productWord = totalProducts === 1 ? "producto" : "productos";
            const groupWord=mixedTypes?"grupos de navegación":(filteredAlbums.length===1?navigationLevelLabel(groupType,false).toLowerCase():navigationLevelLabel(groupType,true).toLowerCase());
            countEl.textContent = `${totalProducts} ${productWord} · ${filteredAlbums.length} ${groupWord}`;
          }
          countEl.classList.toggle("search-active", qHas);
        }

        scheduleJsonLdUpdate([]);

        if(token !== _renderToken) return;

        const frag = document.createDocumentFragment();
        if(!filteredAlbums.length){
          const emptyType=filteredAlbums[0]?.navType||albums[0]?.navType;
          frag.appendChild(makeEmptyState(`No se encontraron ${navigationLevelLabel(emptyType||viewMode.level||"category",true).toLowerCase()} con ese nombre.`));
        }else{
          for(const album of filteredAlbums){
            frag.appendChild(makeAlbumCard(album));
          }
        }

        grid.innerHTML = "";
        grid.appendChild(frag);
        return;
      }

      if(grid){grid.classList.remove("album-three-column-layout");}

      if(viewMode.mode==="terminal"){
        if(grid){grid.innerHTML="";grid.appendChild(makeEmptyState("No hay un nivel posterior configurado para esta vista."));}
        if(countEl){countEl.textContent="";countEl.classList.remove("search-active");}
        scheduleJsonLdUpdate([]);
        return;
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
        if(gap <= 0) return;
        catalogLoadingProgress = Math.min(catalogLoadingCeiling, catalogLoadingProgress + 1);
        renderCatalogLoadingProgress();
      }, 450);
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
      catalogLoadingCeiling = 30;
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
    function rebuildCatalogVisibility(){
      all = filterVisibleProducts(allLoadedProducts);
      productById = new Map(all.map(p => [String(p.id), p]));
      validateNavigationStateAgainstProducts();
      refreshNavigationAlbums();

      scheduleJsonLdUpdate();
      refreshFilterOptionsForScope();
      sanitizeCartWithStock();
      render();
    }

    async function loadProducts(options = {}){
      const silent = options.silent === true;
      const refreshImages = options.refreshImages !== false;
      if(!silent){
        window.CATALOG_INITIAL_LOAD_READY = false;
        startCatalogLoadingProgress();
      }

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
        return false;
      }

      if(!silent) setCatalogLoadingStage("Preparando catálogo…", 95, 99);

      const assessment = buildCompatibleGoogleSheetProducts(catalogSource?.sheetEntries);
      const sheetProducts = assessment.products;
      window.CATALOG_COMPATIBILITY_REPORT = assessment.report;
      window.dispatchEvent(new CustomEvent("irenismb:compatibilidad-actualizada", {detail:assessment.report}));

      let giftProducts = [];
      try{
        giftProducts = makeGiftGalleryProducts(catalogSource?.giftImageUrls);
      }catch(err){
        console.warn("No se pudo preparar la galería de regalos. El inventario continuará disponible.", err);
        giftProducts = [];
      }

      publicCatalogProducts = [...sheetProducts, ...giftProducts];
      if(!window.CATALOG_ADMIN_MODE_ACTIVE) allLoadedProducts = publicCatalogProducts.slice();

      all = filterVisibleProducts(allLoadedProducts);

      try{
        productById = new Map(all.map(p => [String(p.id), p]));
        readStateFromUrl();
        validateNavigationStateAgainstProducts();
        refreshNavigationAlbums();
      }catch(err){
        console.warn("Los productos se cargaron, pero no se pudo reconstruir toda la navegación. Se restablece la vista principal.", err);
        selectedSection = "";
        selectedCategory = "";
        selectedSubcategory = "";
        selectedPublic = "";
        selectedLine = "";
        selectedAlbumKey = "";
        albums = [];
        albumByKey = new Map();
        productById = new Map(all.map(p => [String(p.id), p]));
      }

      try{ scheduleJsonLdUpdate(); }catch(err){ console.warn("No se pudo actualizar JSON-LD.", err); }
      try{ refreshFilterOptionsForScope(); }catch(err){ console.warn("No se pudieron actualizar todos los filtros.", err); }
      try{ sanitizeCartWithStock(); }catch(err){ console.warn("No se pudo validar el carrito contra el stock.", err); }

      try{
        if(!silent){
          updateCountTextReady();
          await new Promise(resolve=>window.setTimeout(resolve, 220));
          window.CATALOG_INITIAL_LOAD_READY = true;
        }
        render();
        if(!silent){
          window.dispatchEvent(new CustomEvent("catalog-initial-load-ready"));
        }
      }catch(err){
        console.error("Los productos se cargaron, pero ocurrió un error al renderizar el catálogo.", err);
        if(!silent) updateCountTextError("Los productos se cargaron, pero ocurrió un error al mostrar el catálogo. Revisa la consola para el detalle.");
      }
      return true;
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
  albumPath.classList.add("fixed-route");
  const trail=selectedNavigationTrail();
  if(!trail.length) return;
  const slots=[{level:"root",label:"Inicio",column:1},...trail.map((item,index)=>({level:item.level,label:item.label,column:index+2}))];
  const currentLevel=slots.at(-1)?.level||"root";
  for(const crumb of slots){
    const slot=document.createElement("span"); slot.className="breadcrumb-slot"; slot.dataset.navLevel=crumb.level; slot.dataset.navDepth=String(Math.max(0,crumb.column-1)); slot.style.setProperty("--route-column",String(crumb.column));
    if(crumb.level!=="root"){const sep=document.createElement("span");sep.className="breadcrumb-separator";sep.textContent="›";sep.setAttribute("aria-hidden","true");slot.appendChild(sep);}
    const current=crumb.level===currentLevel;
    if(current){const span=document.createElement("span");span.className="breadcrumb-current";span.textContent=crumb.label;span.setAttribute("aria-current","page");slot.appendChild(span);}
    else{const btn=document.createElement("button");btn.type="button";btn.className="breadcrumb-link";btn.dataset.breadcrumbLevel=crumb.level;btn.textContent=crumb.label;slot.appendChild(btn);}
    albumPath.appendChild(slot);
  }
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
  const label=btn.querySelector(".cart-action-label");
  if(label)label.textContent="✓ Agregado";
  setTimeout(()=>{
    btn.classList.remove("just-added");
    if(card&&card.isConnected) refreshCardUI(card,p);
  },850);
}

function syncWordToggleButton(){
  if(!toggleWordPanelBtn) return;
  const canToggle=shouldAllowSuggestionToggle();
  const activeCount=uxActiveFilterEntries().length;
  toggleWordPanelBtn.hidden=!canToggle;
  toggleWordPanelBtn.disabled=!canToggle;
  const filterLabel=toggleWordPanelBtn.querySelector("span");
  if(filterLabel)filterLabel.textContent=activeCount?`Filtrar (${activeCount})`:"Filtrar";
  toggleWordPanelBtn.title=wordSuggestionsVisible?"Ocultar palabras sugeridas":"Mostrar palabras sugeridas";
  toggleWordPanelBtn.setAttribute("aria-label",toggleWordPanelBtn.title);
  toggleWordPanelBtn.setAttribute("aria-pressed",wordSuggestionsVisible?"true":"false");
  toggleWordPanelBtn.setAttribute("aria-expanded",wordSuggestionsVisible?"true":"false");
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
  const entries=buildSuggestionEntries();
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

  if(!entries.length){
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
  const trail=selectedNavigationTrail();
  const view=navigationViewMode();
  if(catSel){catSel.hidden=true;catSel.disabled=true;catSel.value="";}
  if(brandSel){brandSel.hidden=true;brandSel.disabled=true;brandSel.value="";}
  if(sortSel){sortSel.hidden=view.mode!=="products";sortSel.disabled=view.mode!=="products";}
  if(albumNav) albumNav.hidden=!trail.length;
  if(albumBackBtn){const parent=trail.length>1?trail[trail.length-2].label:"inicio";albumBackBtn.textContent=`← Volver a ${parent}`;}
  uxRenderBreadcrumb(); placeResponsiveHeaderMeta();
  if(qInp){const scope=trail.at(-1)?.label||"";qInp.placeholder=trail.length?`Buscar en ${scope}`:"Buscar producto, línea o categoría";qInp.setAttribute("aria-label",trail.length?`Buscar dentro de ${scope}`:"Buscar producto, línea o categoría");}
  if(grid){
    grid.classList.toggle("album-grid-mode",showAlbumGrid); grid.classList.toggle("root-nav-mode",showAlbumGrid&&trail.length===0);
    let label="Productos";
    if(view.mode==="empty") label="Sin niveles de navegación activos";
    else if(showAlbumGrid){const types=[...new Set(albums.map(album=>album.navType).filter(Boolean))];label=types.length>1?"Niveles de navegación":navigationLevelLabel(types[0]||view.level||"category",true);}
    else if(view.mode==="terminal") label=trail.at(-1)?.label||"Navegación";
    grid.setAttribute("aria-label",label);
  }
  uxRenderFilterSummary();
}

function refreshCardUI(card,p){
  const row=card.querySelector(".row");
  const actions=card.querySelector(".actions");
  const meta=card.querySelector(".meta");
  if(meta) meta.hidden=!String(meta.textContent||"").trim();
  if(row) row.hidden=false;
  if(actions) actions.hidden=false;
  const enforce=shouldEnforceStockLimits();
  const id=String(p.id);
  const q=cart[id]?.qty||0;
  const qtyPill=card.querySelector('[data-role="qty"]');
  const decBtn=card.querySelector('button[data-act="dec"]');
  const incBtn=card.querySelector('button[data-act="inc"]');
  if(qtyPill){qtyPill.hidden=q<=0;qtyPill.textContent=q>0?`${q} en carrito`:"";qtyPill.classList.toggle("has-items",q>0);}
  if(decBtn){decBtn.disabled=q<=0;decBtn.hidden=q<=0;}
  if(actions) actions.classList.toggle("has-items",q>0);
  const hasKnownStock=Number.isFinite(p.stock)&&p.stock>=0;
  const maxStock=hasKnownStock?p.stock:null;
  const canAdd=!enforce||(hasKnownStock&&maxStock>0&&q<maxStock);
  if(incBtn){
    incBtn.disabled=!canAdd;
    incBtn.classList.toggle("in-cart",q>0);
    const label=incBtn.querySelector(".cart-action-label");
    if(label) label.textContent=enforce&&!hasKnownStock?"Stock por confirmar":enforce&&maxStock<=0?"Sin stock":q>0?"Agregar otro":"Agregar al carrito";
  }
}

async function copyProductText(text){
  if(navigator.clipboard?.writeText){
    try{await navigator.clipboard.writeText(text);return}catch(_){}
  }
  const area=document.createElement("textarea");
  area.value=text;
  area.setAttribute("readonly","");
  area.style.cssText="position:fixed;left:-9999px;top:0";
  const focused=document.activeElement;
  document.body.appendChild(area);
  area.focus();area.select();
  let ok=false;
  try{ok=document.execCommand("copy")}finally{area.remove();focused?.focus?.({preventScroll:true})}
  if(!ok)throw new Error("El navegador no permitió copiar al portapapeles.");
}

function catalogProductDisplayName(value){
  const name=String(value||"");
  if(name!==name.toLocaleUpperCase("es"))return name;
  const lower=new Set(["de","del","la","las","el","los","con","para","en","y","al","a","por","un","una","ml","g","kg","l"]);
  const upper=new Set(["avon","uv","uva","uvb","spf","fps","bb","cc","edt","edp"]);
  let first=true;
  return name.toLocaleLowerCase("es").replace(/\p{L}+/gu,word=>{
    const start=first;first=false;
    if(upper.has(word))return word.toLocaleUpperCase("es");
    if(!start&&lower.has(word))return word;
    return word.charAt(0).toLocaleUpperCase("es")+word.slice(1);
  });
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
  const lineEl=card.querySelector(".product-line");
  lineEl.textContent=String(p.line||p.brand||"").trim();
  lineEl.hidden=!lineEl.textContent;
  const productName=String(p.name||"");
  nameEl.title=productName;
  setSearchHighlightedText(nameEl,catalogProductDisplayName(p.isGiftGalleryImage?productName:catalogFichaName(p)));
  const metaText=stockMetaText(p);
  setSearchHighlightedText(metaEl,metaText);
  const description=String(p?.description||"").trim();
  setSearchHighlightedText(descriptionEl,description);
  descriptionEl.hidden=!description;
  priceEl.textContent=shouldShowProductPrices()?(p.hasPrice===false?"Consultar precio":fmtCOP.format(p.price)):"";
  if(p?.isGiftGalleryImage){
    card.classList.add("gift-gallery-card");
    const pad=card.querySelector(".pad");
    if(pad) pad.hidden=true;
    imgBox.setAttribute("aria-label","Imagen de regalo para toda ocasión");
  }
  if(!p.isGiftGalleryImage){
    const details=document.createElement("details");
    details.className="product-details";
    const summary=document.createElement("summary");summary.textContent="Descripción";
    descriptionEl.insertAdjacentElement("beforebegin",details);
    details.append(summary,descriptionEl);
    const selection=document.createElement("label");selection.className="product-selection";
    const check=document.createElement("input");check.type="checkbox";
    check.checked=FOLLETO_SELECTION.has(String(p.id));check.dataset.folletoSelect=String(p.id);
    check.setAttribute("aria-label","Seleccionar "+productName+" para el folleto");
    selection.title="Seleccionar para Folleto";
    const label=document.createElement("span");label.textContent="Seleccionar para Folleto";label.className="visually-hidden";
    selection.append(check,label);imgBox.appendChild(selection);
  }
    if(!p.isGiftGalleryImage){
      if(!window.CATALOG_ADMIN_MODE_ACTIVE && advisoryExperienceAvailable()) renderAdvisoryProductCard(card,p);
      else renderCatalogFicha(card,p);
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
      for(const product of new Set([...all,...publicCatalogProducts])){
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
  const order=navigationOrderedLevels();
  const index=order.indexOf(target.navType);
  const nextView=navigationViewModeForProducts(target.products||[],index>=0?index+1:order.length);
  // Si este es el último nivel activo y no conduce a Producto, el clic no navega.
  if(nextView.mode==="terminal"||nextView.mode==="empty") return;
  writeStateToUrl();
  uxScrollStack().push({scrollY:window.scrollY||0});
  if(index>=0){setSelectedNavigationValue(target.navType,target.navValue);clearNavigationLevelsAfter(target.navType);}
  if(!opts.keepFilters) resetDiscoveryFilters();
  refreshNavigationAlbums();refreshFilterOptionsForScope();pushNavigationStateToUrl();render();uxScrollToCatalogStart();
}

function closeAlbum(opts={}){
  if(currentCatalogHistoryIndex()>0){history.back();return;}
  const restore=uxScrollStack().pop();
  const selectedLevels=navigationOrderedLevels().filter(level=>level!=="product"&&Boolean(selectedNavigationValue(level)));
  if(selectedLevels.length) setSelectedNavigationValue(selectedLevels.at(-1),"");
  else clearSelectedNavigationValues();
  if(!opts.keepFilters) resetDiscoveryFilters();
  refreshNavigationAlbums();refreshFilterOptionsForScope();writeStateToUrl();installCatalogExitGuardIfAtRoot();render();
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
  if(cartInvoiceBtn) cartInvoiceBtn.hidden=window.CATALOG_ADMIN_MODE_ACTIVE!==true;
  if(cartInvoiceBtn && !invoiceCopying){
    const canGenerateSummary=window.CATALOG_ADMIN_MODE_ACTIVE===true&&items.length>0&&showPrices&&!hasUnpricedItems;
    cartInvoiceBtn.disabled=!canGenerateSummary;
    cartInvoiceBtn.title=canGenerateSummary
      ? "Crear salida de inventario PNG; no descuenta existencias"
      : !items.length
        ? "Agrega productos para crear la salida de inventario"
        : "Todos los productos deben tener un precio visible";
  }
  if(cartBuyBtn && !orderSending) cartBuyBtn.disabled=items.length===0;
  if(cartClearBtn) cartClearBtn.disabled=items.length===0;
  if(subtotalEl) subtotalEl.textContent=(!showPrices||hasUnpricedItems)?"Por confirmar":fmtCOP.format(subtotalValue);
  if(shippingEl) shippingEl.textContent=fmtCOP.format(shippingValue);
  cartTotalEl.textContent=(!showPrices||hasUnpricedItems)?"Total: Por confirmar":"Total: "+fmtCOP.format(total);
  if(!items.length){
    cartItemsEl.innerHTML="";
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
  if(sortSel) sortSel.addEventListener("change",()=>{
    productOrderChosen=true;
    try{localStorage.setItem(PRODUCT_ORDER_STORAGE_KEY,sortSel.value);}catch(_){}
    render();
  });
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
    if(level==="root") clearSelectedNavigationValues();
    else if(navigationOrderedLevels().includes(level)) clearNavigationLevelsAfter(level);
    resetDiscoveryFilters();
    refreshNavigationAlbums();
    refreshFilterOptionsForScope();
    render();
    uxScrollToCatalogStart();
  });
  window.addEventListener("scroll",uxSaveScrollPosition,{passive:true});
  window.addEventListener("pagehide",captureCatalogReloadViewState);
  window.addEventListener("beforeunload",captureCatalogReloadViewState);
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")captureCatalogReloadViewState()});
}

async function init(){
  initAdvisoryExperience();
  refreshCartCount();
  initCartButton();
  initShipping();
  bindFilters();
  bindGridActions();
  window.addEventListener("popstate",restoreCatalogStateFromHistory);
  initFolleto();
  initCatalogFichas();
  if(albumBackBtn) albumBackBtn.addEventListener("click",()=>closeAlbum({keepFilters:getCombinedWordTerms().length>0}));
  syncWordToggleButton();
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
  // Las reglas se cargan en paralelo, pero ninguna ficha pública se prepara antes de resolverlas.
  await window.CATALOG_PUBLIC_VISIBILITY_READY;
  await loadProducts();
  rebuildCatalogHistoryForRestoredNavigation({force:shouldForceRestoredHistory});
  installCatalogExitGuardIfAtRoot();
  // Los datos se consultan al abrir o recargar; no hay sondeos automáticos.
  await restoreCatalogAdminAfterReload(startupAdminState);
  uxRestoreScrollPosition();
}



