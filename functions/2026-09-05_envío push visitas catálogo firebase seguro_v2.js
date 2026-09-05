// Envío seguro de notificaciones push por nuevas visitas al catálogo.
// Versión: 2

import { initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { defineSecret } from "firebase-functions/params";
import { onValueCreated } from "firebase-functions/v2/database";

initializeApp();

const PUSH_DESTINATION_FID = defineSecret("PUSH_DESTINATION_FID");
const CATALOGO_URL = "https://irenismb.github.io/stock/natura/catalogo.html";
const LOGO_URL = "https://irenismb.github.io/stock/natura/logos/logo_empresa.png";

export const notificarNuevaVisitaCatalogo = onValueCreated(
  {
    ref: "/presencia_mundial_2026/ultimas_salidas/{usuarioId}/catalogo_visitas_semana/{fecha}",
    instance: "mundial-a9de1-default-rtdb",
    region: "us-central1",
    secrets: [PUSH_DESTINATION_FID]
  },
  async event => {
    const visita = event.data.val() || {};
    const fid = limpiar(PUSH_DESTINATION_FID.value(), 512);
    if (!fid) {
      console.error("PUSH_DESTINATION_FID no está configurado.");
      return;
    }

    const ciudad = limpiar(visita.ciudad || "Ubicación no disponible");
    const pais = limpiar(visita.pais || "");
    const direccion = limpiar(visita.direccion || "", 180);
    const lat = numero(visita.lat);
    const lng = numero(visita.lng);
    const tieneGps = Number.isFinite(lat) && Number.isFinite(lng);
    const gps = tieneGps ? `${lat}, ${lng}` : "No autorizado";
    const consultaUbicacion = [direccion, ciudad, pais].filter(Boolean).join(", ");
    const mapsUrl = tieneGps
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : limpiar(visita.maps_url || "", 500)
        || (consultaUbicacion
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(consultaUbicacion)}`
          : CATALOGO_URL);

    const ubicacion = [ciudad, pais].filter(Boolean).join(", ");
    const lineas = [
      direccion ? `🏠 Dirección: ${direccion}` : "",
      !direccion && ubicacion ? `📍 Ubicación aproximada: ${ubicacion}` : "",
      `🛰️ GPS: ${gps}`,
      tieneGps ? "📌 Toca para ver ubicación exacta" : "📌 Toca para abrir la ubicación disponible"
    ].filter(Boolean);

    const mensaje = {
      fid,
      notification: {
        title: "🔔 Nueva visita al catálogo",
        body: lineas.join("\n")
      },
      data: {
        ciudad,
        pais,
        direccion,
        lat: tieneGps ? String(lat) : "",
        lng: tieneGps ? String(lng) : "",
        maps_url: mapsUrl,
        fecha: limpiar(event.params.fecha || ""),
        fuente: limpiar(visita.fuente || "")
      },
      webpush: {
        fcmOptions: {
          link: mapsUrl
        },
        notification: {
          icon: LOGO_URL,
          badge: LOGO_URL,
          tag: `visita-catalogo-${event.params.usuarioId}-${event.params.fecha}`,
          data: { url: mapsUrl, maps_url: mapsUrl }
        }
      }
    };

    const respuesta = await getMessaging().send(mensaje);
    console.info("Notificación push enviada.", respuesta);
  }
);

function limpiar(valor, maximo = 100) {
  return String(valor || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maximo);
}

function numero(valor) {
  if (valor === "" || valor === null || valor === undefined) return NaN;
  const resultado = Number(valor);
  return Number.isFinite(resultado) ? resultado : NaN;
}
