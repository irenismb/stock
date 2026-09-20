// Construcción y obtención del índice público de imágenes.

function getCachedImageIndex_() {
  let cached = readImageIndexCache_();

  if (cached) {
    return cached;
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    /*
     * Otra ejecución podría haber generado
     * la caché mientras esta esperaba.
     */
    cached = readImageIndexCache_();

    if (cached) {
      return cached;
    }

    const result = buildImageIndex();

    writeImageIndexCache_(result);

    return result;

  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}

function buildImageIndex() {
  const root = DriveApp.getFolderById(
    CONFIG.PRODUCTS_FOLDER_ID
  );

  const result = {
    ok: true,
    version: 1,
    generatedAt: new Date().toISOString(),

    source: {
      provider: 'Google Drive',
      productsFolderId:
        CONFIG.PRODUCTS_FOLDER_ID
    },

    products: {},
    gifts: {},
    assets: {}
  };


  /*
   * ==========================================
   * PRODUCTOS
   * ==========================================
   *
   * Solo procesa imágenes directamente dentro
   * de la carpeta productos.
   *
   * Ejemplo:
   *
   * 0579_01_kit_maracuya.webp
   *
   * se registra como:
   *
   * products["0579"]
   */
  const productFiles = root.getFiles();

  while (productFiles.hasNext()) {
    const file = productFiles.next();

    if (!isImage(file)) {
      continue;
    }

    const name = file.getName();
    const code = extractProductCode(name);

    if (!code) {
      continue;
    }

    /*
     * Si existen varias imágenes para
     * el mismo código, se guardan en array.
     */
    if (!result.products[code]) {
      result.products[code] = [];
    }

    result.products[code].push(
      fileInfo(file)
    );
  }


  /*
   * Ordena imágenes de cada producto.
   *
   * 0579_01...
   * 0579_02...
   * 0579_03...
   */
  Object.keys(result.products)
    .forEach(code => {

      result.products[code].sort(
        (a, b) =>
          a.name.localeCompare(
            b.name,
            'es',
            {
              numeric: true,
              sensitivity: 'base'
            }
          )
      );
    });


  /*
   * ==========================================
   * SUBCARPETAS
   * ==========================================
   */
  const folders = root.getFolders();

  while (folders.hasNext()) {
    const folder = folders.next();

    const folderName = normalizeFolderName_(
      folder.getName()
    );


    /*
     * REGALOS
     */
    if (
      folderName ===
      normalizeFolderName_(
        CONFIG.GIFTS_FOLDER_NAME
      )
    ) {
      result.source.giftsFolderId =
        folder.getId();

      indexGiftFolder(
        folder,
        result.gifts
      );

      continue;
    }


    /*
     * RECURSOS WEB
     *
     * Ejemplo:
     *
     * recursos-web/
     *   logos/
     *   otras-carpetas/
     *
     * La carpeta "iconos" se ignora.
     */
    if (
      folderName ===
      normalizeFolderName_(
        CONFIG.RESOURCES_FOLDER_NAME
      )
    ) {
      result.source.resourcesFolderId =
        folder.getId();

      indexResourcesFolder(
        folder,
        '',
        result.assets
      );
    }
  }


  /*
   * Estadísticas.
   */
  result.counts = {
    products:
      Object.keys(result.products).length,

    productImages:
      Object.values(result.products)
        .reduce(
          (sum, images) =>
            sum + images.length,
          0
        ),

    gifts:
      Object.keys(result.gifts).length,

    assets:
      Object.keys(result.assets).length
  };


  return result;
}

function indexGiftFolder(folder, target) {
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();

    if (!isImage(file)) {
      continue;
    }

    target[file.getName()] =
      fileInfo(file);
  }
}

function indexResourcesFolder(
  folder,
  relativePath,
  target
) {
  /*
   * Archivos directamente dentro
   * de la carpeta actual.
   */
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();

    if (!isImage(file)) {
      continue;
    }

    const path = relativePath
      ? relativePath + '/' + file.getName()
      : file.getName();

    target[path] =
      fileInfo(file);
  }


  /*
   * Subcarpetas.
   */
  const folders = folder.getFolders();

  while (folders.hasNext()) {
    const child = folders.next();

    const childName =
      normalizeFolderName_(
        child.getName()
      );

    /*
     * Ignora completamente las carpetas
     * excluidas, incluida "iconos".
     */
    if (
      isExcludedResourceFolder_(
        childName
      )
    ) {
      continue;
    }

    const childPath = relativePath
      ? relativePath + '/' + child.getName()
      : child.getName();

    indexResourcesFolder(
      child,
      childPath,
      target
    );
  }
}
