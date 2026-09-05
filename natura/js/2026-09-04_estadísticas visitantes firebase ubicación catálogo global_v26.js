// Estadísticas, Firebase y ubicación de visitantes.
// Versión: 26

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
    import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
    import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

    const firebaseConfig = {
      apiKey: "AIzaSyCrC5pmGyX-VaX4f-KI0AU8A6GWP-YDngM",
      authDomain: "mundial-a9de1.firebaseapp.com",
      databaseURL: "https://mundial-a9de1-default-rtdb.firebaseio.com",
      projectId: "mundial-a9de1",
      storageBucket: "mundial-a9de1.firebasestorage.app",
      messagingSenderId: "598028608340",
      appId: "1:598028608340:web:a176c1fbdfcef564419ec1",
      measurementId: "G-YJY5PWKPGJ"
    };

    const APP_NAME = "catalogoPaginaUnificada";
    const FIREBASE_VISITAS = "presencia_mundial_2026/ultimas_salidas";
    // Se conserva este nodo para mantener el historial ya acumulado por el catálogo.
    const PAGINA_NODO = "catalogo_visitas_semana";
    const GPS_LOG_ENDPOINT = "https://script.google.com/macros/s/AKfycbygXijUyDrpyeA8qmheyZpYw9HVWuN_JZPIeYNbqRKKNYhqFFUguEMZmof4yLTtGbVO/exec";
    const USER_ID_KEY = "irenismb_user_id";
    const MAX_CITY_ROWS = 7;
    const MAX_TOP_DAYS = 3;

    const totalEl = document.getElementById("visitorTotal");
    const todayEl = document.getElementById("visitorToday");
    const topCityEl = document.getElementById("visitorTopCity");
    const daysBody = document.getElementById("visitorDaysBody");
    const citiesBody = document.getElementById("visitorCitiesBody");
    const statusEl = document.getElementById("visitorStatus");

    iniciarContador();

    async function iniciarContador() {
      try{
        if(window.REMOTE_CONFIG_READY) await window.REMOTE_CONFIG_READY;
      }catch(_){}

      let app = getApps().find(item => item.name === APP_NAME);
      if (!app) app = initializeApp(firebaseConfig, APP_NAME);

      const auth = getAuth(app);
      const db = getDatabase(app);
      const hoy = fechaColombia(Date.now());
      let usuario = null;
      let ubicacion = null;
      let registrado = false;

      onAuthStateChanged(auth, async user => {
        usuario = user || null;
        await registrarCuandoEsteListo();
      });

      obtenerUbicacionPreferida()
        .then(async resultado => {
          ubicacion = resultado;
          enviarRegistroUbicacion(resultado);
          await registrarCuandoEsteListo();
        })
        .catch(async error => {
          console.info("Ubicación no disponible.", error);
          ubicacion = ubicacionNoDisponible();
          enviarRegistroUbicacion(ubicacion);
          await registrarCuandoEsteListo();
        });

      try {
        if (!auth.currentUser) {
          const credencial = await signInAnonymously(auth);
          usuario = credencial.user || auth.currentUser;
        } else {
          usuario = auth.currentUser;
        }

        onValue(
          ref(db, FIREBASE_VISITAS),
          snapshot => {
            const datos = resumirVisitantes(snapshot.val(), hoy);
            pintarResumen(datos);
            pintarDias(datos.diasTop);
            pintarCiudades(datos.ciudades);
            statusEl.textContent = "";
          },
          error => {
            statusEl.textContent = "Sin lectura de visitantes globales.";
            console.error(error);
          }
        );

        await registrarCuandoEsteListo();
      } catch (error) {
        statusEl.textContent = "No fue posible autenticar el contador.";
        console.error(error);
      }

      async function registrarCuandoEsteListo() {
        if (registrado || !usuario || !ubicacion) return;
        registrado = true;
        const visitaRef = ref(db, `${FIREBASE_VISITAS}/${usuario.uid}/${PAGINA_NODO}/${hoy}`);
        const ahora = Date.now();
        try {
          await runTransaction(visitaRef, actual => {
            const base = actual && typeof actual === "object" ? actual : {};
            return {
              primera_visita: Number(base.primera_visita) || ahora,
              ultima_visita: ahora,
              ciudad: normalizarTexto(ubicacion.ciudad || "Ubicación no disponible"),
              pais: normalizarTexto(ubicacion.pais || ""),
              fuente: normalizarTexto(ubicacion.fuente || "SIN_UBICACION")
            };
          });
        } catch (error) {
          registrado = false;
          statusEl.textContent = "No fue posible registrar esta visita.";
          console.error(error);
        }
      }
    }

    function resumirVisitantes(usuarios, hoy) {
      const visitasPorDia = new Map();
      const ciudades = new Map();
      let totalHistorico = 0;

      if (usuarios && typeof usuarios === "object") {
        for (const registroUsuario of Object.values(usuarios)) {
          if (!registroUsuario || typeof registroUsuario !== "object") continue;
          const visitasPagina = registroUsuario[PAGINA_NODO];
          if (!visitasPagina || typeof visitasPagina !== "object") continue;

          for (const [fecha, visita] of Object.entries(visitasPagina)) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
            if (!visita || typeof visita !== "object") continue;
            totalHistorico += 1;
            visitasPorDia.set(fecha, (visitasPorDia.get(fecha) || 0) + 1);

            const ciudad = normalizarTexto(visita.ciudad || "Ubicación no disponible");
            const pais = normalizarTexto(visita.pais || "");
            const etiqueta = pais ? `${ciudad}, ${pais}` : ciudad;
            const actual = ciudades.get(etiqueta) || { ciudad:etiqueta, total:0, hoy:0 };
            actual.total += 1;
            if (fecha === hoy) actual.hoy += 1;
            ciudades.set(etiqueta, actual);
          }
        }
      }

      const diasTop = [...visitasPorDia.entries()]
        .map(([fecha, cantidad]) => ({ fecha, cantidad }))
        .sort((a, b) => b.cantidad - a.cantidad || b.fecha.localeCompare(a.fecha))
        .slice(0, MAX_TOP_DAYS);

      const listaCiudades = [...ciudades.values()]
        .sort((a, b) => b.total - a.total || b.hoy - a.hoy || a.ciudad.localeCompare(b.ciudad, "es"));

      return {
        totalHistorico,
        totalHoy: visitasPorDia.get(hoy) || 0,
        ciudadPrincipal: listaCiudades[0]?.ciudad || "Sin datos",
        diasTop,
        ciudades: listaCiudades.slice(0, MAX_CITY_ROWS)
      };
    }

    function pintarResumen(datos) {
      totalEl.textContent = String(datos.totalHistorico);
      todayEl.textContent = String(datos.totalHoy);
      topCityEl.textContent = datos.ciudadPrincipal;
    }

    function pintarDias(items) {
      const fragmento = document.createDocumentFragment();
      for (let i = 0; i < MAX_TOP_DAYS; i += 1) {
        const fila = document.createElement("tr");
        const item = items[i];
        fila.append(crearCelda(item?.fecha || ""), crearCelda(item ? String(item.cantidad) : ""));
        fragmento.appendChild(fila);
      }
      daysBody.replaceChildren(fragmento);
    }

    function pintarCiudades(items) {
      const fragmento = document.createDocumentFragment();
      for (let i = 0; i < MAX_CITY_ROWS; i += 1) {
        const fila = document.createElement("tr");
        const item = items[i];
        fila.append(
          crearCelda(item?.ciudad || ""),
          crearCelda(item ? String(item.total) : ""),
          crearCelda(item ? String(item.hoy) : "")
        );
        fragmento.appendChild(fila);
      }
      citiesBody.replaceChildren(fragmento);
    }

    function crearCelda(texto) {
      const td = document.createElement("td");
      td.textContent = texto;
      return td;
    }

    async function obtenerUbicacionPreferida() {
      if(window.INTERRUPTORES && window.INTERRUPTORES.HABILITAR_UBICACION_GPS === false){
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
        console.info("GPS no disponible; se usa ubicación por IP.", error);
        return obtenerUbicacionPorIp();
      }
    }

    function obtenerCoordenadasGps() {
      return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) return reject(new Error("Geolocalización no disponible"));
        navigator.geolocation.getCurrentPosition(
          posicion => {
            const c = posicion?.coords;
            if (!c) return reject(new Error("Coordenadas no disponibles"));
            resolve({
              latitude: Number(c.latitude),
              longitude: Number(c.longitude),
              accuracy: Number(c.accuracy)
            });
          },
          error => reject(error || new Error("No se obtuvo permiso de ubicación")),
          { enableHighAccuracy:true, timeout:15000, maximumAge:300000 }
        );
      });
    }

    async function obtenerCiudadDesdeGps(coords) {
      const url = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      url.searchParams.set("latitude", String(coords.latitude));
      url.searchParams.set("longitude", String(coords.longitude));
      url.searchParams.set("localityLanguage", "es");
      const respuesta = await fetchConTiempo(url.toString(), 8000);
      if (!respuesta.ok) throw new Error("Sin geocodificación GPS");
      const datos = await respuesta.json();
      const ciudad = normalizarTexto(datos.locality || datos.city || datos.principalSubdivision || "");
      const pais = normalizarTexto(datos.countryName || datos.countryCode || "");
      if (!ciudad) throw new Error("Ciudad GPS no disponible");
      return { ciudad, pais };
    }

    async function obtenerUbicacionPorIp() {
      const servicios = [
        { url:"https://ipapi.co/json/", ciudad:d=>d.city, pais:d=>d.country_name || d.country },
        { url:"https://api.db-ip.com/v2/free/self", ciudad:d=>d.city, pais:d=>d.countryName || d.countryCode },
        { url:"https://ipwho.is/", ciudad:d=>d.city, pais:d=>d.country || d.country_code, fallo:d=>d?.success === false }
      ];
      for (const servicio of servicios) {
        try {
          const respuesta = await fetchConTiempo(servicio.url, 7000);
          if (!respuesta.ok) continue;
          const datos = await respuesta.json();
          if (servicio.fallo?.(datos)) continue;
          const ciudad = normalizarTexto(servicio.ciudad(datos) || "");
          const pais = normalizarTexto(servicio.pais(datos) || "");
          if (ciudad || pais) {
            return {
              ciudad: ciudad || "Ubicación no disponible",
              pais,
              fuente: "IP",
              lat: "",
              lng: "",
              acc: ""
            };
          }
        } catch (error) {
          console.info(error);
        }
      }
      return ubicacionNoDisponible();
    }

    async function fetchConTiempo(url, timeoutMs) {
      const controlador = new AbortController();
      const temporizador = setTimeout(() => controlador.abort(), timeoutMs);
      try {
        return await fetch(url, { cache:"no-store", signal:controlador.signal });
      } finally {
        clearTimeout(temporizador);
      }
    }

    function enviarRegistroUbicacion(ubicacion) {
      try {
        const userId = obtenerIdLocal();
        const payload = new URLSearchParams({
          lat: String(ubicacion.lat ?? ""),
          lng: String(ubicacion.lng ?? ""),
          acc: String(ubicacion.acc ?? ""),
          fuente: String(ubicacion.fuente || "SIN_UBICACION"),
          src: String(ubicacion.fuente || "SIN_UBICACION"),
          ciudad: String(ubicacion.ciudad || ""),
          pais: String(ubicacion.pais || ""),
          navegador: userId,
          user_id: userId,
          load_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          ts: String(Date.now()),
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
        pais: "",
        fuente: "SIN_UBICACION",
        lat: "",
        lng: "",
        acc: ""
      };
    }

    function fechaColombia(fecha) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(fecha));
    }

    function normalizarTexto(valor) {
      return String(valor || "").replace(/[<>]/g, "").trim().slice(0, 80);
    }
