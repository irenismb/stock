// Modal "Sobre Nosotros" (especial para móviles, pero funciona en cualquier dispositivo)
(function () {
  const aboutBtn = document.getElementById("aboutBtn");
  const aboutModal = document.getElementById("aboutModal");
  const aboutModalBody = document.getElementById("aboutModalBody");
  const aboutModalClose = document.getElementById("aboutModalClose");
  const aboutModalBackdrop = document.getElementById("aboutModalBackdrop");

  if (!aboutModal || !aboutModalBody) return;

  function fillModalBodyOnce() {
    if (aboutModalBody.dataset.filled === "1") return;

    const contactInfo = document.querySelector(".contact-info");
    if (!contactInfo) return;

    // Clonar TODO el contenido del "Sobre Nosotros", pero sin repetir el <h3> del contenedor.
    const clone = contactInfo.cloneNode(true);

    // Quitar el primer h3 si existe (el modal ya tiene su propio título)
    const firstTitle = clone.querySelector("h3");
    if (firstTitle) firstTitle.remove();

    // Pasar el contenido al modal
    aboutModalBody.innerHTML = "";
    Array.from(clone.childNodes).forEach(node => {
      // Evitar meter nodos vacíos inútiles
      aboutModalBody.appendChild(node.cloneNode(true));
    });

    aboutModalBody.dataset.filled = "1";
  }

  function openAboutModal() {
    fillModalBodyOnce();
    aboutModal.classList.add("open");
    aboutModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeAboutModal() {
    aboutModal.classList.remove("open");
    aboutModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  if (aboutBtn) {
    aboutBtn.addEventListener("click", openAboutModal);
  }
  if (aboutModalClose) {
    aboutModalClose.addEventListener("click", closeAboutModal);
  }
  if (aboutModalBackdrop) {
    aboutModalBackdrop.addEventListener("click", closeAboutModal);
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && aboutModal.classList.contains("open")) {
      closeAboutModal();
    }
  });
})();

