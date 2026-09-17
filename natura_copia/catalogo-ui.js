// Compartir catálogo: módulo aislado que no altera la lógica principal.
    (() => {
      const shareBtn = document.getElementById("shareCatalogBtn");

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
    })();
