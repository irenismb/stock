import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

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

const FIREBASE_VISITAS = "presencia_mundial_2026/ultimas_salidas";
const CATALOGO_NODO = "catalogo_visitas_semana";
const MAX_CITY_ROWS = 7;

const daysBody = reemplazarElemento("visitorWeekDaysBody", false);
const citiesBody = reemplazarElemento("visitorWeekCitiesBody", false);
const statusEl = reemplazarElemento("visitorWeekStatus", true);
const weekTotalEl = reemplazarElemento("visitorWeekTotal", true);
const todayTotalEl = reemplazarElemento("visitorTodayTotal", true);
const topCityEl = reemplazarElemento("visitorTopCity", true);

if (daysBody && citiesBody && statusEl && weekTotalEl && todayTotalEl && topCityEl) {
  prepararPresentacionGlobal();
  iniciarLecturaGlobal();
}

function reemplazarElemento(id, conservarContenido) {
  const anterior = document.getElementById(id);
  if (!anterior) return null;

  const nuevo = anterior.cloneNode(Boolean(conservarContenido));
  anterior.replaceWith(nuevo);
  return nuevo;
}

function prepararPresentacionGlobal() {
  const details = document.getElementById("visitorWeekDetails");
  const cards = document.getElementById("visitorWeekCards");

  if (details) details.setAttribute("aria-label", "Visitantes globales");
  if (cards) cards.setAttribute("aria-label", "Detalle global de visitantes");

  const weekItem = weekTotalEl.closest(".visitor-week-summary-item");
  const todayItem = todayTotalEl.closest(".visitor-week-summary-item");
  const topCityItem = topCityEl.closest(".visitor-week-summary-item");

  if (weekItem) weekItem.replaceChildren(document.createTextNode("Visitantes globales esta semana: "), weekTotalEl);
  if (todayItem) todayItem.replaceChildren(document.createTextNode("Hoy en el mundo: "), todayTotalEl);
  if (topCityItem) topCityItem.replaceChildren(document.createTextNode("Ciudad principal global: "), topCityEl);

  const daysCard = daysBody.closest(".visitor-week-card");
  if (daysCard) daysCard.setAttribute("aria-label", "Visitantes globales de los últimos siete días");

  const daysTable = daysBody.closest("table");
  const daysTitle = daysTable?.querySelector(".visitor-week-title-row th");
  if (daysTitle) daysTitle.textContent = "Visitantes globales de los últimos 7 días";

  const citiesCard = citiesBody.closest(".visitor-week-card");
  if (citiesCard) citiesCard.setAttribute("aria-label", "Visitantes globales por ciudad y país");

  const citiesTable = citiesBody.closest("table");
  if (citiesTable) {
    citiesTable.classList.add("visitor-week-table--cities");

    const title = citiesTable.querySelector(".visitor-week-title-row th");
    if (title) {
      title.colSpan = 3;
      title.textContent = "Visitantes globales por ciudad";
    }

    const headerRows = citiesTable.querySelectorAll("thead tr");
    const header = headerRows[1];
    if (header) {
      header.replaceChildren(
        crearEncabezado("Ciudad / país"),
        crearEncabezado("Total visitantes"),
        crearEncabezado("Visitantes hoy")
      );
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    .visitor-week-table--cities tbody td:nth-child(2),
    .visitor-week-table--cities tbody td:nth-child(3){
      text-align:center;
      font-weight:900;
    }
    .visitor-week-table--cities th:first-child,
    .visitor-week-table--cities td:first-child{
      width:50%;
    }
  `;
  document.head.appendChild(style);

  pintarCargaInicial();
}

function crearEncabezado(texto) {
  const th = document.createElement("th");
  th.scope = "col";
  th.textContent = texto;
  return th;
}

function pintarCargaInicial() {
  const fechas = ultimasSieteFechas();
  const fragmentoDias = document.createDocumentFragment();

  for (const fecha of fechas) {
    const fila = document.createElement("tr");
    const celdaFecha = document.createElement("td");
    const celdaCantidad = document.createElement("td");
    celdaFecha.textContent = fecha;
    celdaCantidad.textContent = "--";
    fila.append(celdaFecha, celdaCantidad);
    fragmentoDias.appendChild(fila);
  }
  daysBody.replaceChildren(fragmentoDias);

  const fragmentoCiudades = document.createDocumentFragment();
  for (let index = 0; index < MAX_CITY_ROWS; index += 1) {
    const fila = document.createElement("tr");
    fila.append(crearCelda("--"), crearCelda("--"), crearCelda("--"));
    fragmentoCiudades.appendChild(fila);
  }
  citiesBody.replaceChildren(fragmentoCiudades);

  weekTotalEl.textContent = "--";
  todayTotalEl.textContent = "--";
  topCityEl.textContent = "Cargando...";
  statusEl.textContent = "Cargando visitantes globales...";
}

async function iniciarLecturaGlobal() {
  let app = getApps().find(item => item.name === "catalogoVisitantesSemana");

  if (!app) {
    app = initializeApp(firebaseConfig, "catalogoVisitantesGlobales");
  }

  const auth = getAuth(app);
  const db = getDatabase(app);

  try {
    if (!auth.currentUser) await signInAnonymously(auth);
  } catch (error) {
    console.error("No fue posible autenticar la lectura global de visitantes.", error);
  }

  onValue(
    ref(db, FIREBASE_VISITAS),
    snapshot => {
      const datos = resumirVisitantesGlobales(snapshot.val());
      pintarDias(datos.fechas, datos.visitantesPorDia);
      pintarCiudades(datos.ciudades);
      weekTotalEl.textContent = String(datos.totalSemana);
      todayTotalEl.textContent = String(datos.totalHoy);
      topCityEl.textContent = datos.ciudadPrincipal || "Sin datos";
      statusEl.textContent = "";
    },
    error => {
      statusEl.textContent = "Sin lectura de visitantes globales.";
      console.error(error);
    }
  );
}

function resumirVisitantesGlobales(usuarios) {
  const hoy = fechaColombia(Date.now());
  const fechas = ultimasSieteFechas();
  const fechasSet = new Set(fechas);
  const visitantesPorDia = new Map(fechas.map(fecha => [fecha, 0]));
  const ciudades = new Map();

  if (usuarios && typeof usuarios === "object") {
    for (const registroUsuario of Object.values(usuarios)) {
      if (!registroUsuario || typeof registroUsuario !== "object") continue;

      const visitasCatalogo = registroUsuario[CATALOGO_NODO];
      if (!visitasCatalogo || typeof visitasCatalogo !== "object") continue;

      for (const [fecha, visita] of Object.entries(visitasCatalogo)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
        if (!visita || typeof visita !== "object") continue;

        if (fechasSet.has(fecha)) {
          visitantesPorDia.set(fecha, (visitantesPorDia.get(fecha) || 0) + 1);
        }

        const ciudad = normalizarTexto(visita.ciudad || "Ubicación no disponible");
        const pais = normalizarTexto(visita.pais || "");
        const etiqueta = pais ? ciudad + ", " + pais : ciudad;
        const actual = ciudades.get(etiqueta) || {
          ciudad: etiqueta,
          total: 0,
          hoy: 0
        };

        actual.total += 1;
        if (fecha === hoy) actual.hoy += 1;
        ciudades.set(etiqueta, actual);
      }
    }
  }

  const listaCiudades = [...ciudades.values()].sort((a, b) =>
    b.total - a.total ||
    b.hoy - a.hoy ||
    a.ciudad.localeCompare(b.ciudad, "es")
  );

  return {
    fechas,
    visitantesPorDia,
    ciudades: listaCiudades.slice(0, MAX_CITY_ROWS),
    totalSemana: [...visitantesPorDia.values()].reduce((total, cantidad) => total + cantidad, 0),
    totalHoy: visitantesPorDia.get(hoy) || 0,
    ciudadPrincipal: listaCiudades[0]?.ciudad || ""
  };
}

function pintarDias(fechas, visitantesPorDia) {
  const fragmento = document.createDocumentFragment();

  for (const fecha of fechas) {
    const fila = document.createElement("tr");
    const celdaFecha = document.createElement("td");
    const celdaCantidad = document.createElement("td");
    celdaFecha.textContent = fecha;
    celdaCantidad.textContent = String(visitantesPorDia.get(fecha) || 0);
    fila.append(celdaFecha, celdaCantidad);
    fragmento.appendChild(fila);
  }

  daysBody.replaceChildren(fragmento);
}

function pintarCiudades(ciudades) {
  const fragmento = document.createDocumentFragment();

  for (let index = 0; index < MAX_CITY_ROWS; index += 1) {
    const item = ciudades[index];
    const fila = document.createElement("tr");

    if (item) {
      fila.append(
        crearCelda(item.ciudad),
        crearCelda(String(item.total)),
        crearCelda(String(item.hoy))
      );
    } else {
      const ciudad = crearCelda("");
      const total = crearCelda("");
      const hoy = crearCelda("");
      ciudad.className = "visitor-empty-cell";
      total.className = "visitor-empty-cell";
      hoy.className = "visitor-empty-cell";
      fila.append(ciudad, total, hoy);
    }

    fragmento.appendChild(fila);
  }

  citiesBody.replaceChildren(fragmento);
}

function crearCelda(texto) {
  const td = document.createElement("td");
  td.textContent = texto;
  return td;
}

function ultimasSieteFechas() {
  const hoy = fechaColombia(Date.now());
  return Array.from({ length: 7 }, (_, index) => sumarDias(hoy, index - 6));
}

function fechaColombia(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(fecha));
}

function sumarDias(fechaIso, cantidad) {
  const [anio, mes, dia] = fechaIso.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + cantidad));
  return fecha.toISOString().slice(0, 10);
}

function normalizarTexto(valor) {
  return String(valor || "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 80);
}
