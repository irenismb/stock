const IMG_BASE_PATH = "./imagenes/";
const IMG_EXTS = ["webp", "WEBP", "jpg", "jpeg", "png"];
const imageCache = new Map();
let lastPreviewRequestId = 0;

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function testImageOnce(url, timeout = 1200) {
  return new Promise(resolve => {
    const img = new Image();
    let done = false;

    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        img.src = "";
        resolve(false);
      }
    }, timeout);

    img.onload = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(true);
      }
    };
    img.onerror = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(false);
      }
    };

    img.decoding = "async";
    img.loading = "eager";
    img.src = url;
  });
}

async function resolveImageForCode(code, name) {
  if (!code) return null;

  const safeName = (name || "").trim();
  const baseVariants = [];

  baseVariants.push(String(code));

  if (safeName) {
    const safeNameSlug = safeName
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (safeNameSlug) {
      baseVariants.push(`${code}-${safeNameSlug}`);
    }
    baseVariants.push(`${code}-${safeName}`);
    baseVariants.push(`${code}@${safeName}`);
  }

  for (const base of baseVariants) {
    for (const ext of IMG_EXTS) {
      const key = `${base}.${ext}`;
      const cached = imageCache.get(key);
      if (cached) {
        if (cached.ok) return cached.url;
        continue;
      }
      const url = IMG_BASE_PATH + encodeURIComponent(base) + "." + ext;
      const ok = await testImageOnce(url);
      imageCache.set(key, { ok, url });
      if (ok) return url;
    }
  }

  return null;
}

async function findAllImagesForProduct(prod, maxChildren = 12) {
  if (!prod || !prod.id) return [];
  const id = String(prod.id).trim();
  const name = String(prod.name || "").trim();
  const images = [];

  const main = await resolveImageForCode(id, name);
  if (main) images.push(main);

  for (let i = 1; i <= maxChildren; i++) {
    const childCode = `${id}-${i}`;
    const url = await resolveImageForCode(childCode, name);
    if (url) images.push(url);
  }

  return images;
}

export function createGallery({
  previewImg,
  previewName,
  previewCaption,
  thumbs,
  galleryPrevBtn,
  galleryNextBtn,
  imageStatus,
  stage,
}) {
  let currentGallery = { productId: null, images: [], index: 0 };

  function renderThumbs(imgs, activeIndex) {
    thumbs.innerHTML = "";
    imgs.forEach((url, idx) => {
      const im = document.createElement("img");
      im.src = url;
      im.loading = "lazy";
      im.decoding = "async";
      im.alt = `Miniatura ${idx + 1}`;
      if (idx === activeIndex) im.classList.add("active");
      im.addEventListener("click", () => setGalleryIndex(idx, true));
      thumbs.appendChild(im);
    });
  }

  function updateNavButtons() {
    const len = currentGallery.images.length;
    const disabled = len <= 1;
    galleryPrevBtn.disabled = disabled;
    galleryNextBtn.disabled = disabled;
  }

  function setGalleryIndex(newIndex, userAction) {
    const imgs = currentGallery.images;
    const len = imgs.length;
    if (!len) return;

    if (newIndex < 0) newIndex = len - 1;
    if (newIndex >= len) newIndex = 0;

    currentGallery.index = newIndex;
    const url = imgs[newIndex];

    previewImg.style.display = "block";
    previewImg.loading = "lazy";
    previewImg.decoding = "async";
    previewImg.src = url;
    previewImg.alt = `Imagen de ${previewName.textContent || "producto"}`;

    thumbs.querySelectorAll("img").forEach((im, idx) => {
      im.classList.toggle("active", idx === newIndex);
    });

    updateNavButtons();
  }

  async function showPreviewForProduct(prod) {
    if (!prod) return;

    const requestId = ++lastPreviewRequestId;

    const name = (prod.name || "").trim();
    const descriptionText = prod.description || "Sin descripción para este producto.";
    previewName.textContent = name ? name.toUpperCase() : "";

    previewCaption.textContent = descriptionText;
    previewCaption.classList.remove("loading");

    previewImg.style.display = "none";
    previewImg.src = "";
    thumbs.innerHTML = "";
    currentGallery = { productId: prod.id, images: [], index: 0 };
    updateNavButtons();

    if (imageStatus) {
      imageStatus.textContent = "Cargando imagen...";
      imageStatus.classList.add("visible");
    }

    const imgs = await findAllImagesForProduct(prod);
    if (requestId !== lastPreviewRequestId) {
      return;
    }

    currentGallery.images = imgs;
    currentGallery.index = 0;

    if (!imgs.length) {
      if (imageStatus) {
        imageStatus.textContent = "Próximamente tendrás la imagen de tu producto aquí";
        imageStatus.classList.add("visible");
      }
      updateNavButtons();
      return;
    }

    if (imageStatus) {
      imageStatus.textContent = "";
      imageStatus.classList.remove("visible");
    }

    renderThumbs(imgs, 0);
    setGalleryIndex(0);
  }

  galleryPrevBtn.addEventListener("click", () => setGalleryIndex(currentGallery.index - 1, true));
  galleryNextBtn.addEventListener("click", () => setGalleryIndex(currentGallery.index + 1, true));

  if (stage) {
    let startX = null;
    stage.addEventListener("touchstart", e => {
      startX = e.changedTouches[0].clientX;
    }, { passive: true });
    stage.addEventListener("touchend", e => {
      if (startX == null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) {
        if (dx > 0) setGalleryIndex(currentGallery.index - 1, true);
        else setGalleryIndex(currentGallery.index + 1, true);
      }
      startX = null;
    }, { passive: true });
  }

  return { showPreviewForProduct };
}
