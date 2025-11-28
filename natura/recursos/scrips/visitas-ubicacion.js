// ================== REGISTRO DE VISITAS (POR SESIÓN) ==================
function sendVisitEvent(phase, { clickText = "", searchText = "" } = {}) {
  try {
    const sid = ensureSessionId();
    const bid = browserId || ensureBrowserId();

    const params = new URLSearchParams();
    params.set("action", "logVisit");
    params.set("sessionId", sid);
    params.set("phase", phase || "update");

    if (userName)        params.set("userName", userName);
    if (clientIpPublica) params.set("ipPublica", clientIpPublica);
    if (clientCiudad)    params.set("ciudad", clientCiudad);
    if (clickText)       params.set("clickText", String(clickText));
    if (searchText)      params.set("searchText", String(searchText));
    if (bid)             params.set("browserId", bid); // columna Id en Apps Script

    const url = APPS_SCRIPT_URL + "?" + params.toString();
    const options = { method: "GET", mode: "cors" };

    if (phase === "end") options.keepalive = true;

    fetch(url, options).catch(err => {
      console.error("Error enviando visita:", err);
    });
  } catch (e) {
    console.error("Error en sendVisitEvent:", e);
  }
}

async function initClientLocation() {
  try {
    const resp = await fetch(CLIENT_INFO_URL);
    if (!resp.ok) return;
    const data = await resp.json();
    clientIpPublica = data.ip || "";
    clientCiudad = data.city || "";
    sendVisitEvent("update");
  } catch (e) {
    console.error("No se pudo obtener IP/ciudad:", e);
  }
}
