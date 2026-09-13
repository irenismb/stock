// Ajustes del pie del catálogo: texto comercial/SEO y retiro del listado completo de productos.
(() => {
  document.querySelector(".beauty-products-details")?.remove();

  const footerText = document.querySelector(".footer-card p");
  if(!footerText) return;

  footerText.innerHTML = `
    Irenismb Stock Natura es una tienda en línea con punto físico en Santa Marta, especializada en productos Natura y AVON. Encuentra perfumes, maquillaje y productos para el cuidado facial, corporal y capilar, con líneas como Natura Tododia, Ekos, Lumina, Chronos, Kaiak, Essencial, Homem, Una y Faces, además de AVON Care y Far Away.
    Te asesoramos por <a href="https://wa.me/573042088961" target="_blank" rel="noopener noreferrer">WhatsApp</a>, vía telefónica o de manera presencial en el barrio Almendros.
    <strong>Dirección:</strong> Calle 10A #20A-06.
    <strong>Teléfono:</strong> <a href="tel:+573042088961" rel="nofollow">+57 304 208 8961</a>.
    Realizamos envíos nacionales e internacionales.
  `;
})();

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
