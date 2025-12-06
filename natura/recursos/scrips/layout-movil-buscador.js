// Reubica el buscador dentro de la fila de acciones móviles SOLO en pantallas pequeñas.
// Requiere que config-estado-dom.js ya haya definido searchInput
// y que utilidades-imagenes-galeria.js haya definido debounce.

(function setupMobileSearchPlacement() {
  function ensureButtonsWrapper(row) {
    let wrap = row.querySelector(".mobile-actions-buttons");
    if (wrap) return wrap;

    wrap = document.createElement("div");
    wrap.className = "mobile-actions-buttons";

    // Mover botones existentes al wrapper
    const btns = Array.from(row.querySelectorAll(".mobile-action-btn"));
    btns.forEach(b => wrap.appendChild(b));

    row.appendChild(wrap);
    return wrap;
  }

  function placeSearch() {
    try {
      const row = document.getElementById("mobileActionsRow");
      const controlsTop = document.querySelector(".controls-top");
      if (!row || !controlsTop || typeof searchInput === "undefined" || !searchInput) return;

      const isMobile = window.innerWidth <= 768;

      if (isMobile) {
        ensureButtonsWrapper(row);
        // Poner el buscador debajo de la fila de botones móviles
        row.appendChild(searchInput);
      } else {
        // Volver a dejar el buscador en su lugar original (escritorio)
        controlsTop.appendChild(searchInput);

        // Opcional: deshacer wrapper para volver al HTML original
        const wrap = row.querySelector(".mobile-actions-buttons");
        if (wrap) {
          Array.from(wrap.children).forEach(ch => row.appendChild(ch));
          wrap.remove();
        }
      }
    } catch (e) {
      // Silencioso por robustez
    }
  }

  document.addEventListener("DOMContentLoaded", placeSearch);
  window.addEventListener("resize", debounce(placeSearch, 120));
})();
