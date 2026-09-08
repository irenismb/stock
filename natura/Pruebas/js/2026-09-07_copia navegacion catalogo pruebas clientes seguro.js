// Navegación, compartir y controles auxiliares.

// Navegación auxiliar y compartir: en pruebas, los controles flotantes recorren el historial interno del catálogo.
    (() => {
      const backBtn = document.getElementById("catalogBackBtn");
      const forwardBtn = document.getElementById("catalogForwardBtn");
      const shareBtn = document.getElementById("shareCatalogBtn");

      function actualizarBotonesHistorial(detail){
        const state = detail || window.CATALOG_NAV_HISTORY?.getState?.() || {canBack:false,canForward:false};
        if(backBtn){
          backBtn.disabled = !state.canBack;
          backBtn.setAttribute("aria-disabled",state.canBack ? "false" : "true");
        }
        if(forwardBtn){
          forwardBtn.disabled = !state.canForward;
          forwardBtn.setAttribute("aria-disabled",state.canForward ? "false" : "true");
        }
      }

      backBtn?.addEventListener("click", () => {
        window.CATALOG_NAV_HISTORY?.back?.();
      });

      forwardBtn?.addEventListener("click", () => {
        window.CATALOG_NAV_HISTORY?.forward?.();
      });

      window.addEventListener("catalog-navigation-history-change",(event)=>{
        actualizarBotonesHistorial(event.detail);
      });

      shareBtn?.addEventListener("click", async () => {
        const url = window.location.href.split("#")[0];
        const datos = {
          title:document.title,
          text:"Catálogo Irenismb Stock Natura",
          url
        };

        try{
          if(typeof navigator.share === "function"){
            await navigator.share(datos);
            return;
          }
          if(navigator.clipboard?.writeText){
            await navigator.clipboard.writeText(url);
            const tituloAnterior = shareBtn.title;
            shareBtn.title = "Enlace copiado";
            shareBtn.setAttribute("aria-label", "Enlace del catálogo copiado");
            setTimeout(() => {
              shareBtn.title = tituloAnterior || "Compartir catálogo";
              shareBtn.setAttribute("aria-label", "Compartir catálogo");
            }, 1800);
            return;
          }
          window.prompt("Copia el enlace del catálogo:", url);
        }catch(error){
          if(error?.name !== "AbortError") console.error("No fue posible compartir el catálogo.", error);
        }
      });

      actualizarBotonesHistorial();
    })();
