// Acceso al administrador de precios. Solo aparece con ?administrar=precios.
(() => {
  const boton = document.getElementById("priceAdminBtn");
  if (!boton) return;

  const parametros = new URL(window.location.href).searchParams;
  const modoAdministrador = parametros.get("administrar") === "precios";
  const endpoint = String(window.PRECIOS_ADMIN_CONFIG?.endpoint || "").trim();

  if (!modoAdministrador || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) {
    return;
  }

  boton.hidden = false;
  let ventanaAdministrador = null;

  boton.addEventListener("click", () => {
    ventanaAdministrador = window.open(
      endpoint,
      "irenismbAdministrarPrecios",
      "popup=yes,width=1080,height=760,resizable=yes,scrollbars=yes"
    );
    if (!ventanaAdministrador) {
      window.alert("El navegador bloqueó la ventana de administración. Permite ventanas emergentes para este sitio.");
    }
  });

  window.addEventListener("message", event => {
    if (!ventanaAdministrador || event.source !== ventanaAdministrador) return;
    if (!event.data || event.data.tipo !== "irenismb-precio-actualizado") return;
    window.location.reload();
  });
})();
