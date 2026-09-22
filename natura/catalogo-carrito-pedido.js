// Carrito, pedido, WhatsApp, resumen PNG, cliente y dirección.

    const WHATSAPP_NUMBER = "573042088961";

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
      if(!cartItems.length) throw new Error("Agrega al menos un producto al carrito antes de generar el resumen.");
      if(!shouldShowProductPrices()){
        throw new Error("No se puede generar un resumen de pedido con los precios ocultos.");
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
      if(!measureCtx) throw new Error("No fue posible preparar el resumen PNG.");
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
      if(!ctx) throw new Error("No fue posible preparar el resumen PNG.");

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
      ctx.fillText("Resumen de pedido", 195, 111);
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
      ctx.fillText("RESUMEN DE PEDIDO", 918, 103);
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
        "Resumen comercial del pedido.",
        "Valores expresados en pesos colombianos.",
        "Gracias por confiar en tu consultora de belleza."
      ];
      noteLines.forEach((lineText,i)=>ctx.fillText(lineText,82,summaryTop+68+i*23));

      ctx.fillStyle = softGold; ctx.strokeStyle = "#e1bb74";
      invoiceRoundRect(ctx, 565, summaryTop, 482, summaryHeight, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gold;
      ctx.font = "900 16px system-ui, -apple-system, Segoe UI, Arial, sans-serif";
      ctx.fillText("RESUMEN DEL PEDIDO", 595, summaryTop+36);
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
        canvas.toBlob(blob=> blob ? resolve(blob) : reject(new Error("No fue posible convertir el resumen a PNG.")), "image/png");
      });
    }

    async function invoiceBuildPng(){
      const canvas = await invoiceBuildCanvas();
      const blob = await invoiceCanvasToBlob(canvas);
      return { blob };
    }

    function invoiceDownloadPng(blob){
      if(!blob) throw new Error("No fue posible preparar la descarga del resumen.");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resumen-pedido-${invoiceDateColombia()}.png`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }

    async function invoiceGeneratePngFromCart(){
      invoiceValidateInput();

      let copyError = null;
      let downloadError = null;
      const buildPromise = invoiceBuildPng();
      const blobPromise = buildPromise.then(result=>result.blob);
      let copyPromise = Promise.resolve(false);

      if(navigator.clipboard && typeof navigator.clipboard.write === "function" && typeof ClipboardItem !== "undefined"){
        try{
          copyPromise = navigator.clipboard
            .write([new ClipboardItem({"image/png":blobPromise})])
            .then(()=>true, error=>{
              copyError = error;
              return false;
            });
        }catch(error){
          copyError = error;
        }
      }else{
        copyError = new Error("Este navegador no permite copiar imágenes PNG directamente al portapapeles.");
      }

      const built = await buildPromise;
      try{
        invoiceDownloadPng(built.blob);
      }catch(error){
        downloadError = error;
      }

      const copied = await copyPromise;
      if(copyError) console.error("No se pudo copiar el resumen PNG.", copyError);
      if(downloadError) console.error("No se pudo descargar el resumen PNG.", downloadError);

      return {copied, downloaded:!downloadError};
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

    function buildOrderPayload(tipoMovimiento="Pedido", requestId=""){
      const items = cartItemsArray();
      const client = getClientDataCurrent();
      const atribucion = contextoAtribucionVisita();
      const addr = getAddressDataCurrent();
      const envio = getShippingCop();
      const direccionClienteVisible = joinParts([addr.addressLine || "", addr.barrio ? `Barrio ${addr.barrio}` : ""], ", ");

      tipoMovimiento = normalizeText(tipoMovimiento) === "venta" ? "Venta" : "Pedido";

      return {
        source: tipoMovimiento === "Venta" ? "catalogo-factura" : "catalogo-whatsapp",
        tipoMovimiento,
        client_request_id: requestId || "",
        envio,
        cliente: {
          nombre: client.name || "",
          celular: client.phone || "",
          direccion: direccionClienteVisible || "",
          direccionBase: addr.addressLine || "",
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
          return {
            codigo: String(it.id || ""),
            cantidadSolicitada: Number(it.qty) || 0,
            marca: p.brand || ""
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

    function createOrderRequestId(){
      const randomPart = (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID().replace(/-/g, "")
        : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
      return `ord_${Date.now()}_${randomPart}`;
    }

    function orderRequestFingerprint(payload){
      return JSON.stringify({
        tipoMovimiento: payload.tipoMovimiento,
        envio: Number(payload.envio) || 0,
        cliente: payload.cliente || {},
        items: (payload.items || []).map(item => ({
          codigo: String(item.codigo || ""),
          cantidadSolicitada: Number(item.cantidadSolicitada) || 0,
          marca: String(item.marca || "")
        }))
      });
    }

    function getPendingOrderRequest(payload){
      const key = "irenismb_pending_order_request_v1";
      const fingerprint = orderRequestFingerprint(payload);
      const saved = readJsonLS(key, null);
      if(saved && saved.id && saved.fingerprint === fingerprint){
        return { key, id: String(saved.id), fingerprint };
      }
      const id = createOrderRequestId();
      writeJsonLS(key, { id, fingerprint, createdAt: Date.now() });
      return { key, id, fingerprint };
    }

    function clearPendingOrderRequest(key, requestId){
      try{
        const saved = readJsonLS(key, null);
        if(saved && String(saved.id || "") === String(requestId || "")){
          localStorage.removeItem(key);
        }
      }catch(_){ }
    }

    function delayMs(ms){
      return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    }

    function fetchOrderStatusJsonp(requestId, timeoutMs = 3500){
      return new Promise((resolve, reject) => {
        const callbackName = `__naturaOrderStatus_${Date.now()}_${Math.random().toString(36).slice(2,9)}`;
        const script = document.createElement("script");
        let settled = false;
        const cleanup = () => {
          try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
          if(script.parentNode) script.parentNode.removeChild(script);
        };
        const finish = (fn, value) => {
          if(settled) return;
          settled = true;
          clearTimeout(timer);
          cleanup();
          fn(value);
        };
        const timer = setTimeout(() => finish(reject, new Error("No se pudo confirmar el registro del pedido.")), timeoutMs);

        window[callbackName] = (data) => finish(resolve, data || {});
        script.async = true;
        script.onerror = () => finish(reject, new Error("No se pudo consultar el estado del pedido."));
        const query = new URLSearchParams({
          request_id: String(requestId || ""),
          prefix: callbackName,
          _: String(Date.now())
        });
        script.src = `${ORDER_LOG_ENDPOINT}?${query.toString()}`;
        document.head.appendChild(script);
      });
    }

    async function confirmOrderRegistration(requestId){
      const deadline = Date.now() + 10000;
      let lastError = null;

      while(Date.now() < deadline){
        try{
          const status = await fetchOrderStatusJsonp(requestId, 3000);
          if(status && status.status === "registered" && status.ok === true) return status;
          if(status && status.status === "error"){
            throw new Error(status.message || "El servidor rechazó el pedido.");
          }
        }catch(err){
          lastError = err;
          if(err && /rechazó el pedido|inválid|no hay productos|código|precio|categoría/i.test(String(err.message || err))){
            throw err;
          }
        }
        await delayMs(450);
      }

      throw lastError || new Error("El pedido se envió, pero no fue posible confirmar su registro.");
    }

    async function registerOrderInSheet(tipoMovimiento="Pedido"){
      const basePayload = buildOrderPayload(tipoMovimiento);
      if(!Array.isArray(basePayload.items) || !basePayload.items.length) return { ok:false, skipped:true };

      const pending = getPendingOrderRequest(basePayload);
      const payload = Object.assign({}, basePayload, { client_request_id: pending.id });
      const body = JSON.stringify(payload);

      try{
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

        const confirmation = await confirmOrderRegistration(pending.id);
        clearPendingOrderRequest(pending.key, pending.id);
        return Object.assign({ skipped:false }, confirmation);
      }catch(err){
        if(err && /rechazó el pedido|inválid|no hay productos|código|precio|categoría/i.test(String(err.message || err))){
          clearPendingOrderRequest(pending.key, pending.id);
        }
        throw err;
      }
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
      const previousQty = safeInt(current.qty, 0);

      const hasKnownStock = Number.isFinite(current.stock) && current.stock >= 0;
      const maxStock = hasKnownStock ? current.stock : null;
      let newQty = previousQty;

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

      if(act === "inc" && newQty > previousQty){
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
        cartInvoiceBtn.textContent = "Generando resumen...";
        try{
          saveClientToLS();
          saveAddressToLS();
          saveShippingToLS();
          const result = await invoiceGeneratePngFromCart();
          if(result.copied && result.downloaded){
            cartInvoiceBtn.textContent = "Resumen generado";
          }else if(result.downloaded){
            cartInvoiceBtn.textContent = "Resumen descargado";
            alert("El resumen se descargó, pero este navegador no permitió copiarlo al portapapeles.");
          }else if(result.copied){
            cartInvoiceBtn.textContent = "Resumen copiado";
            alert("El resumen se copió, pero el navegador no permitió descargarlo.");
          }else{
            throw new Error("No se pudo copiar ni descargar el resumen.");
          }
        }catch(err){
          console.error("No se pudo generar el resumen PNG:", err);
          alert(String(err?.message || "No se pudo generar el resumen PNG."));
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
            await registerOrderInSheet("Pedido");
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
