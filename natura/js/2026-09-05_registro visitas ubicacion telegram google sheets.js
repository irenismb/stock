(() => {
  const GPS_LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbygXijUyDrpyeA8qmheyZpYw9HVWuN_JZPIeYNbqRKKNYhqFFUguEMZmof4yLTtGbVO/exec";
  const USER_ID_KEY = "irenismb_user_id";
  const VISITOR_SHEET_ID = "1vxxTu4HWcgDm2HcCwPykMXyepVAFQcFsQkHUS6ed81g";
  const VISITOR_ID_SHEET = "id_navegador";
  const VISIT_MODE_KEY = "MODO_REGISTRO_VISITAS";
  const OWN_VISITS_KEY = "REGISTRAR_VISITAS_PROPIAS";
  const VISIT_DEVICE_MARKER = "irenismb_visit_registered_device";
  const VISIT_DAY_MARKER_PREFIX = "irenismb_visit_registered_day_";
  const OWN_BROWSER_IDS_FALLBACK = new Set([
    "461e0283-5358-4400-a31e-d8d74866d660",
    "7aa54b29-d9db-4d17-a8dd-56bdc11c1f74",
    "747d377e-20e4-423e-bed1-463b3154eb72",
    "bdfc4faf-9f3b-4b27-867d-538ab2392c60",
    "a2542505-3211-4970-885b-30dbeb5e43ee",
    "481dd00a-2810-4e7f-b371-d303a4a468a5",
    "dfd7a7e8-cf33-43d6-9ae3-a99309fe9508"
  ]);

  iniciarRegistroVisita();

  async function iniciarRegistroVisita() {
    await esperarConfiguracionSinBloquear();

    const userId = obtenerIdLocal();
    const politica = await obtenerPoliticaRegistroVisitas(userId);
    if (!politica.registrar) return;

    try {
      const ubicacion = await obtenerUbicacionPreferida();
      const enviado = await enviarRegistroUbicacion(ubicacion, userId);
      if (enviado) marcarRegistroVisita(politica.modo);
    } catch (error) {
      console.info("Ubicación no disponible.", error);
      try {
        const enviado = await enviarRegistroUbicacion(ubicacionNoDisponible(), userId);
        if (enviado) marcarRegistroVisita(politica.modo);
      } catch (sendError) {
        console.error("No se pudo enviar el registro de visita.", sendError);
      }
    }
  }

  async function esperarConfiguracionSinBloquear() {
    try {
      if (!window.REMOTE_CONFIG_READY) return;
      await Promise.race([
        window.REMOTE_CONFIG_READY,
        new Promise(resolve => setTimeout(resolve, 2200))
      ]);
    } catch (_) {}
  }

  async function obtenerUbicacionPreferida() {
    if (window.INTERRUPTORES && window.INTERRUPTORES.HABILITAR_UBICACION_GPS === false) {
      return obtenerUbicacionPorIp();
    }

    try {
      const coordenadas = await obtenerCoordenadasGps();
      const lugar = await obtenerCiudadDesdeGps(coordenadas);
      return {
        ...lugar,
        fuente: fuenteGps(coordenadas.accuracy),
        lat: coordenadas.latitude,
        lng: coordenadas.longitude,
        acc: coordenadas.accuracy
      };
    } catch (error) {
      console.info("GPS no disponible; se usa ubicación aproximada por IP.", error);
      return obtenerUbicacionPorIp();
    }
  }

  function obtenerCoordenadasGps() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocalización no disponible"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        posicion => {
          const c = posicion && posicion.coords;
          if (!c) {
            reject(new Error("Coordenadas no disponibles"));
            return;
          }
          resolve({
            latitude: Number(c.latitude),
            longitude: Number(c.longitude),
            accuracy: Number(c.accuracy)
          });
        },
        error => reject(error || new Error("No se obtuvo permiso de ubicación")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
      );
    });
  }

  async function obtenerCiudadDesdeGps(coords) {
    try {
      return await obtenerDireccionExactaDesdeGps(coords);
    } catch (error) {
      console.info("Dirección exacta no disponible; se usa geocodificación general.", error);
    }

    const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
    url.searchParams.set("latitude", String(coords.latitude));
    url.searchParams.set("longitude", String(coords.longitude));
    url.searchParams.set("localityLanguage", "es");

    const respuesta = await fetchConTiempo(url.toString(), 8000);
    if (!respuesta.ok) throw new Error("Sin geocodificación GPS");

    const datos = await respuesta.json();
    const departamento = normalizarTexto(datos.principalSubdivision || "");
    const ciudad = normalizarTexto(datos.locality || datos.city || departamento || "");
    const pais = normalizarTexto(datos.countryName || datos.countryCode || "");
    if (!ciudad) throw new Error("Ciudad GPS no disponible");

    return {
      ciudad,
      departamento,
      pais,
      direccion: [ciudad, departamento, pais].filter(Boolean).join(", ")
    };
  }

  async function obtenerDireccionExactaDesdeGps(coords) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(coords.latitude));
    url.searchParams.set("lon", String(coords.longitude));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "es");

    const respuesta = await fetchConTiempo(url.toString(), 8000);
    if (!respuesta.ok) throw new Error("Sin dirección exacta");

    const datos = await respuesta.json();
    const detalle = datos.address || {};
    const via = normalizarTexto(
      detalle.road || detalle.pedestrian || detalle.residential || detalle.footway || detalle.path || ""
    );
    const numero = normalizarTexto(detalle.house_number || "");
    const ciudad = normalizarTexto(
      detalle.city || detalle.town || detalle.village || detalle.municipality || detalle.county || detalle.state || ""
    ).replace(/^Perímetro Urbano\s+/i, "");
    const departamento = normalizarTexto(detalle.state || detalle.region || detalle.county || "");
    const pais = normalizarTexto(detalle.country || detalle.country_code || "");
    const direccion = via
      ? normalizarDireccion(`${via}${numero ? ` #${numero.replace(/^#\s*/, "")}` : ""}`)
      : [ciudad, departamento, pais].filter(Boolean).join(", ");

    if (!ciudad) throw new Error("Ciudad GPS no disponible");
    return { ciudad, departamento, pais, direccion };
  }

  async function obtenerUbicacionPorIp() {
    const servicios = [
      {
        url: "https://ipapi.co/json/",
        ciudad: d => d.city,
        departamento: d => d.region || d.region_code,
        pais: d => d.country_name || d.country
      },
      {
        url: "https://api.db-ip.com/v2/free/self",
        ciudad: d => d.city,
        departamento: d => d.stateProv,
        pais: d => d.countryName || d.countryCode
      },
      {
        url: "https://ipwho.is/",
        ciudad: d => d.city,
        departamento: d => d.region,
        pais: d => d.country || d.country_code,
        fallo: d => d && d.success === false
      }
    ];

    for (const servicio of servicios) {
      try {
        const respuesta = await fetchConTiempo(servicio.url, 7000);
        if (!respuesta.ok) continue;

        const datos = await respuesta.json();
        if (servicio.fallo && servicio.fallo(datos)) continue;

        const ciudad = normalizarTexto(servicio.ciudad(datos) || "");
        const departamento = normalizarTexto(servicio.departamento(datos) || "");
        const pais = normalizarTexto(servicio.pais(datos) || "");

        if (ciudad || pais) {
          return {
            ciudad: ciudad || "Ubicación no disponible",
            departamento,
            pais,
            direccion: [ciudad, departamento, pais].filter(Boolean).join(", "),
            fuente: "IP",
            lat: "",
            lng: "",
            acc: ""
          };
        }
      } catch (error) {
        console.info("Servicio de ubicación por IP no disponible.", error);
      }
    }

    return ubicacionNoDisponible();
  }

  async function fetchConTiempo(url, timeoutMs) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      return await fetch(url, { cache: "no-store", signal: controlador.signal });
    } finally {
      clearTimeout(temporizador);
    }
  }

  function esIpLocalNumerica(value) {
    const ip = String(value || "").trim();
    const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!match) return false;

    const partes = match.slice(1).map(Number);
    if (partes.some(parte => parte < 0 || parte > 255)) return false;

    if (partes[0] === 10) return true;
    if (partes[0] === 192 && partes[1] === 168) return true;
    if (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31) return true;
    return false;
  }

  function obtenerIpLocalNumerica() {
    return new Promise(resolve => {
      const RTCPeer = window.RTCPeerConnection || window.webkitRTCPeerConnection;
      if (!RTCPeer) {
        resolve("");
        return;
      }

      let terminado = false;
      let pc = null;
      const finalizar = value => {
        if (terminado) return;
        terminado = true;
        try { if (pc) pc.close(); } catch (_) {}
        resolve(esIpLocalNumerica(value) ? String(value).trim() : "");
      };

      const temporizador = setTimeout(() => finalizar(""), 1300);

      try {
        pc = new RTCPeer({ iceServers: [] });
        pc.createDataChannel("ip");

        pc.onicecandidate = event => {
          const candidate = String(event?.candidate?.candidate || "");
          const ips = candidate.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || [];
          const local = ips.find(esIpLocalNumerica);
          if (local) {
            clearTimeout(temporizador);
            finalizar(local);
          }
        };

        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {
            clearTimeout(temporizador);
            finalizar("");
          });
      } catch (_) {
        clearTimeout(temporizador);
        finalizar("");
      }
    });
  }

  async function enviarRegistroUbicacion(ubicacion, userId) {
    try {
      const contextoPromise = typeof window.obtenerContextoVisitaCatalogo === "function"
        ? Promise.race([
            Promise.resolve(window.obtenerContextoVisitaCatalogo()).catch(() => ({})),
            new Promise(resolve => setTimeout(() => resolve({}), 1600))
          ])
        : Promise.resolve({});

      const [contexto, ipLocal] = await Promise.all([
        contextoPromise,
        obtenerIpLocalNumerica()
      ]);
      const direccion = normalizarDireccion(
        ubicacion.direccion || [ubicacion.ciudad, ubicacion.departamento, ubicacion.pais].filter(Boolean).join(", ")
      );

      const payload = new URLSearchParams({
        lat: String(ubicacion.lat ?? ""),
        lng: String(ubicacion.lng ?? ""),
        acc: String(ubicacion.acc ?? ""),
        fuente: String(ubicacion.fuente || "SIN_UBICACION"),
        src: String(ubicacion.fuente || "SIN_UBICACION"),
        ciudad: String(ubicacion.ciudad || ""),
        departamento: String(ubicacion.departamento || ""),
        pais: String(ubicacion.pais || ""),
        direccion,
        navegador: userId,
        user_id: userId,
        load_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ts: String(Date.now()),
        dispositivo: String(contexto.dispositivo || ""),
        marca: String(contexto.marca || ""),
        modelo: String(contexto.modelo || ""),
        ip_local: String(ipLocal || ""),
        origen: String(contexto.origen || ""),
        categoria: String(contexto.categoria || ""),
        producto: String(contexto.producto || ""),
        carrito_productos: String(contexto.carrito_productos || "0"),
        carrito_unidades: String(contexto.carrito_unidades || "0"),
        carrito_total: String(contexto.carrito_total || "0"),
        cb: Math.random().toString(36).slice(2)
      });

      await fetch(`${GPS_LOG_ENDPOINT}?${payload.toString()}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        keepalive: true
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  async function obtenerPoliticaRegistroVisitas(userId) {
    const valores = window.REMOTE_CONTROL_VALUES || {};
    const modo = normalizarModoRegistro(valores[VISIT_MODE_KEY]);
    const registrarPropias = parsearBooleanoRemoto(valores[OWN_VISITS_KEY], false);

    if (modo === "NINGUNA") {
      return { registrar: false, modo };
    }

    if (!registrarPropias && await esNavegadorPropio(userId)) {
      return { registrar: false, modo };
    }

    if (modo === "UNA POR DISPOSITIVO" && tieneMarcaDispositivo()) {
      return { registrar: false, modo };
    }

    if (modo === "UNA POR DIA" && tieneMarcaDiaActual()) {
      return { registrar: false, modo };
    }

    return { registrar: true, modo };
  }

  function normalizarModoRegistro(value) {
    const normalized = normalizarClave(value);
    if (["TODAS", "UNA POR DIA", "UNA POR DISPOSITIVO", "NINGUNA"].includes(normalized)) return normalized;
    return "TODAS";
  }

  function parsearBooleanoRemoto(value, fallback) {
    const normalized = normalizarClave(value);
    if (["ACTIVADO", "ACTIVO", "TRUE", "VERDADERO", "SI", "SÍ", "1", "ON"].includes(normalized)) return true;
    if (["DESACTIVADO", "INACTIVO", "FALSE", "FALSO", "NO", "0", "OFF"].includes(normalized)) return false;
    return fallback;
  }

  function normalizarClave(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  async function esNavegadorPropio(userId) {
    if (!userId) return false;
    if (OWN_BROWSER_IDS_FALLBACK.has(userId)) return true;

    try {
      const ids = await cargarIdsNavegadoresPropios();
      return ids.has(userId);
    } catch (_) {
      return false;
    }
  }

  function cargarIdsNavegadoresPropios() {
    return new Promise((resolve, reject) => {
      const callbackName = `__irenismbOwnBrowsers_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      let settled = false;

      const cleanup = () => {
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        try { script.remove(); } catch (_) {}
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error("Tiempo de espera agotado al consultar navegadores propios."));
      }, 3500);

      window[callbackName] = payload => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();

        if (!payload || payload.status !== "ok" || !payload.table || !Array.isArray(payload.table.rows)) {
          reject(new Error("No se pudo leer la lista de navegadores propios."));
          return;
        }

        const ids = new Set(OWN_BROWSER_IDS_FALLBACK);
        for (const row of payload.table.rows) {
          const cells = Array.isArray(row && row.c) ? row.c : [];
          const id = valorCelda(cells[0]).trim();
          const nombre = normalizarClave(valorCelda(cells[1]));
          if (id && ["MARTIN", "IRENIS"].includes(nombre)) ids.add(id);
        }
        resolve(ids);
      };

      script.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        reject(new Error("No se pudo conectar con la lista de navegadores propios."));
      };

      const params = new URLSearchParams({
        sheet: VISITOR_ID_SHEET,
        range: "A:B",
        tq: "select A,B",
        tqx: `out:json;responseHandler:${callbackName}`
      });
      script.src = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(VISITOR_SHEET_ID)}/gviz/tq?${params.toString()}`;
      script.async = true;
      document.head.appendChild(script);
    });
  }

  function valorCelda(cell) {
    if (!cell) return "";
    if (cell.f !== undefined && cell.f !== null) return String(cell.f);
    if (cell.v !== undefined && cell.v !== null) return String(cell.v);
    return "";
  }

  function fechaActualColombia() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  }

  function tieneMarcaDispositivo() {
    try {
      return localStorage.getItem(VISIT_DEVICE_MARKER) === "1";
    } catch (_) {
      return false;
    }
  }

  function tieneMarcaDiaActual() {
    try {
      return localStorage.getItem(`${VISIT_DAY_MARKER_PREFIX}${fechaActualColombia()}`) === "1";
    } catch (_) {
      return false;
    }
  }

  function marcarRegistroVisita(modo) {
    try {
      if (modo === "UNA POR DISPOSITIVO") {
        localStorage.setItem(VISIT_DEVICE_MARKER, "1");
      } else if (modo === "UNA POR DIA") {
        localStorage.setItem(`${VISIT_DAY_MARKER_PREFIX}${fechaActualColombia()}`, "1");
      }
    } catch (_) {}
  }

  function obtenerIdLocal() {
    try {
      let id = localStorage.getItem(USER_ID_KEY);
      if (id) return id;

      id = window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(USER_ID_KEY, id);
      return id;
    } catch (_) {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function fuenteGps(accuracy) {
    const valor = Number(accuracy);
    if (!Number.isFinite(valor) || valor <= 35) return "GPS";
    if (valor <= 120) return "WI-FI";
    if (valor <= 1000) return "CELULAR";
    return "GPS";
  }

  function ubicacionNoDisponible() {
    return {
      ciudad: "Ubicación no disponible",
      departamento: "",
      pais: "",
      direccion: "",
      fuente: "SIN_UBICACION",
      lat: "",
      lng: "",
      acc: ""
    };
  }

  function normalizarTexto(valor) {
    return String(valor || "").replace(/[<>]/g, "").trim().slice(0, 80);
  }

  function normalizarDireccion(valor) {
    return String(valor || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 180);
  }
})();