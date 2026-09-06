(() => {
  const GPS_LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbygXijUyDrpyeA8qmheyZpYw9HVWuN_JZPIeYNbqRKKNYhqFFUguEMZmof4yLTtGbVO/exec";
  const USER_ID_KEY = "irenismb_user_id";

  iniciarRegistroVisita();

  async function iniciarRegistroVisita() {
    try {
      if (window.REMOTE_CONFIG_READY) await window.REMOTE_CONFIG_READY;
    } catch (_) {}

    try {
      const ubicacion = await obtenerUbicacionPreferida();
      await enviarRegistroUbicacion(ubicacion);
    } catch (error) {
      console.info("Ubicación no disponible.", error);
      await enviarRegistroUbicacion(ubicacionNoDisponible());
    }
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

  async function enviarRegistroUbicacion(ubicacion) {
    try {
      const userId = obtenerIdLocal();
      const [contexto, ipLocal] = await Promise.all([
        typeof window.obtenerContextoVisitaCatalogo === "function"
          ? window.obtenerContextoVisitaCatalogo()
          : Promise.resolve({}),
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

      fetch(`${GPS_LOG_ENDPOINT}?${payload.toString()}`, {
        method: "GET",
        mode: "no-cors",
        cache: "no-store",
        keepalive: true
      }).catch(() => {});
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