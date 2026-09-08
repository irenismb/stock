// Navegación, compartir y controles auxiliares.

// Navegación auxiliar y compartir: módulo aislado que no altera la lógica del catálogo.
    (() => {
      const startBtn = document.getElementById("goToStartBtn");
      const finalBtn = document.getElementById("goToEndBtn");
      const footer = document.querySelector(".site-footer");
      const shareBtn = document.getElementById("shareCatalogBtn");

      function actualizarBotonesNavegacion(){
        const doc = document.documentElement;
        const sinDesplazamiento = doc.scrollHeight <= window.innerHeight + 24;
        const cercaDelInicio = window.scrollY <= 180;
        const cercaDelFinal = window.scrollY + window.innerHeight >= doc.scrollHeight - 180;
        startBtn?.classList.toggle("is-hidden", sinDesplazamiento || cercaDelInicio);
        finalBtn?.classList.toggle("is-hidden", sinDesplazamiento || cercaDelFinal);
      }

      startBtn?.addEventListener("click", () => {
        window.scrollTo({ top:0, left:0, behavior:"smooth" });
      });

      finalBtn?.addEventListener("click", () => {
        if(footer){
          footer.scrollIntoView({ behavior:"smooth", block:"end" });
        }else{
          window.scrollTo({ top:document.documentElement.scrollHeight, behavior:"smooth" });
        }
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

      window.addEventListener("scroll", actualizarBotonesNavegacion, { passive:true });
      window.addEventListener("resize", actualizarBotonesNavegacion, { passive:true });
      actualizarBotonesNavegacion();
    })();
