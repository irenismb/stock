// Servicios auxiliares de ubicación, distancia, geocodificación y Telegram.

// ===================== DISTANCIA (HAVERSINE) =====================
function haversineMeters_(lat1, lng1, lat2, lng2){
  const R = 6371000; // metros
  const toRad = (x) => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const aLat1 = toRad(lat1);
  const aLat2 = toRad(lat2);

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(aLat1) * Math.cos(aLat2) *
    Math.sin(dLng/2) * Math.sin(dLng/2);

  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

// ===================== TELEGRAM =====================
function sendVisitToTelegram_(data){
  const token = getTelegramProperty_(TELEGRAM_BOT_TOKEN_PROPERTY);
  const chatId = getTelegramProperty_(TELEGRAM_CHAT_ID_PROPERTY);
  if (!token || !chatId) return;

  const visitLabel = data.visitaNumero
    ? `${data.visitanteTipo || "Visitante"} · visita #${data.visitaNumero}`
    : (data.visitanteTipo || "Visitante");

  const approximateLocation = [data.ciudad, data.departamento, data.pais]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  const locationText = data.tieneCoordenadas && data.direccion
    ? data.direccion
    : (approximateLocation || data.direccion || "Ubicación no disponible");

  let gpsText = "No disponible";
  const source = String(data.fuente || "").trim().toUpperCase();

  if (data.tieneCoordenadas){
    gpsText = data.precision !== ""
      ? `Autorizado · precisión ${Math.round(Number(data.precision) || 0)} m`
      : "Autorizado";
  } else if (source === "IP"){
    gpsText = "No autorizado · ubicación aproximada por IP";
  }

  const interestParts = [data.categoria, data.producto]
    .map(value => String(value || "").trim())
    .filter(Boolean);

  const visibleName = String(data.nombre || "").trim() || "Sin identificar";
  const straightLineDistance = formatDistance_(data.distanciaMetros);

  const parts = [
    "🔔 Nueva visita al catálogo Natura",
    `👤 Visitante: ${visibleName} · ${visitLabel}`,
    data.idNavegador ? `🆔 ID navegador: ${data.idNavegador}` : "",
    data.ipExterna ? `🌐 IP externa: ${data.ipExterna}` : "",
    data.ipExterna && data.visitasIpExterna
      ? `🔁 Visitas registradas desde esta IP: ${data.visitasIpExterna}`
      : "",
    data.ipLocal ? `🏠 IP local: ${data.ipLocal}` : "",
    `📍 Ubicación: ${locationText}`,
    `🎯 GPS: ${gpsText}`,
    straightLineDistance
      ? `📏 Distancia en línea recta al punto de referencia: ${straightLineDistance}`
      : "",
    [data.marca, data.modelo, data.dispositivo]
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .length
        ? `📱 Dispositivo: ${[data.marca, data.modelo, data.dispositivo]
            .map(value => String(value || "").trim())
            .filter(Boolean)
            .join(" · ")}`
        : "",
    data.origen ? `🌐 Origen: ${data.origen}` : "",
    interestParts.length ? `🛍️ Interés: ${interestParts.join(" · ")}` : "",
    data.carritoProductos > 0
      ? `🛒 Carrito: ${data.carritoProductos} producto${data.carritoProductos === 1 ? "" : "s"} · ${data.carritoUnidades} unidad${data.carritoUnidades === 1 ? "" : "es"} · ${formatCop_(data.carritoTotal)}`
      : "",
    `📅 Fecha y hora: ${data.fecha || ""} · ${data.hora || ""}`
  ].filter(Boolean);

  sendTelegramMessage_(token, chatId, parts.join("\n"), data.mapsUrl || "");
}

function formatDistance_(value){
  if (value == null || String(value).trim() === "") return "";
  const meters = Number(value);
  if (!Number.isFinite(meters) || meters < 0) return "";
  if (meters < 1000){
    return `${Math.round(meters).toLocaleString("es-CO")} m`;
  }
  const kilometers = Math.round((meters / 1000) * 100) / 100;
  return `${kilometers.toLocaleString("es-CO", { maximumFractionDigits: 2 })} km`;
}

function formatCop_(value){
  const amount = Math.max(0, Number(value) || 0);
  return "$" + Math.round(amount).toLocaleString("es-CO");
}

function sendTelegramMessage_(token, chatId, text, mapsUrl){
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const payload = {
    chat_id: chatId,
    text: String(text || "")
  };

  if (mapsUrl){
    payload.reply_markup = {
      inline_keyboard: [[
        { text: "Abrir en Google Maps", url: mapsUrl }
      ]]
    };
  }

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();
  if (code < 200 || code >= 300){
    throw new Error(`Telegram respondió ${code}: ${body}`);
  }

  let parsed = null;
  try{ parsed = JSON.parse(body); }catch(_){}
  if (parsed && parsed.ok === false){
    throw new Error(`Telegram rechazó el mensaje: ${body}`);
  }
}

function getTelegramProperty_(name){
  return String(
    PropertiesService.getScriptProperties().getProperty(name) || ""
  ).trim();
}

// ===================== REVERSE GEOCODING + CACHE =====================
function reverseGeocodeCached_(lat, lng){
  try{
    const cache = CacheService.getScriptCache();

    // ✅ más preciso que toFixed(4)
    const key = "addr_" + lat.toFixed(ADDRESS_CACHE_DECIMALS) + "_" + lng.toFixed(ADDRESS_CACHE_DECIMALS);

    const cached = cache.get(key);
    if (cached != null){
      const sep = cached.indexOf("|");
      if (sep >= 0) return { status: cached.slice(0, sep), address: cached.slice(sep + 1) };
      return { status: "CACHED", address: cached };
    }

    const res = Maps.newGeocoder()
      .setLanguage("es")
      .setRegion("co")
      .reverseGeocode(lat, lng);

    const status = String(res && res.status ? res.status : "");
    let addr = "";

    if (status === "OK" && res.results && res.results.length){
      addr = res.results[0].formatted_address || "";
    }

    const toStore = status + "|" + addr;
    cache.put(key, toStore, addr ? ADDRESS_CACHE_SECONDS : ADDRESS_CACHE_EMPTY_SECONDS);

    return { status: status || "NO_STATUS", address: addr };
  }catch(_){
    return { status: "EXCEPTION", address: "" };
  }
}
