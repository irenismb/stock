// Reubica el buscador dentro de la fila de acciones móviles SOLO en pantallas pequeñas.
// Requiere que config-estado-dom.js ya haya definido searchInput
// y que utilidades-imagenes-galeria.js haya definido debounce.
//
// ✅ FIX:
// En algunos móviles, al tocar el buscador se abre el teclado y el navegador
// dispara un resize. Si el script reubica/re-append el input en ese momento,
// el elemento puede perder foco y el teclado se oculta.
// Solución: NO mover el input si ya está en el contenedor correcto,
// y evitar moverlo cuando está enfocado.

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
      const isFocused = document.activeElement === searchInput;

      // Preparar wrapper solo en móvil
      if (isMobile) {
        ensureButtonsWrapper(row);
      }

      const targetParent = isMobile ? row : controlsTop;

      // ✅ No hacer nada si ya está donde debe estar
      if (searchInput.parentElement !== targetParent) {
        // ✅ Evitar perder foco cuando se abre el teclado
        if (isFocused) return;

        targetParent.appendChild(searchInput);
      }

      // Volver a dejar botones como HTML original en escritorio
      if (!isMobile) {
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

  // ✅ Mantener el resize, pero ahora es seguro porque no reubica innecesariamente
  window.addEventListener("resize", debounce(placeSearch, 120));
})();

