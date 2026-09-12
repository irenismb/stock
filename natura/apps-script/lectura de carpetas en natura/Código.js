const CONFIG = {
  PRODUCTS_FOLDER_ID: '133WAYlDKSt3r8KIObttDcv86eHPmPQ5b',

  GIFTS_FOLDER_NAME: 'regalos',
  RESOURCES_FOLDER_NAME: 'recursos-web',

  // Carpetas dentro de recursos-web que NO deben indexarse.
  EXCLUDED_RESOURCE_FOLDERS: [
    'iconos'
  ],

  IMAGE_EXTENSIONS: [
    'webp',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'avif'
  ],

  // Caché del índice completo.
  CACHE_SECONDS: 300, // 5 minutos

  // Divide el JSON para evitar el límite por entrada
  // de CacheService.
  CACHE_CHUNK_SIZE: 20000,

  CACHE_KEY_PREFIX: 'image_index_v1'
};


/**
 * Endpoint público.
 *
 * Devuelve un JSON de solo lectura con:
 * - productos
 * - regalos
 * - recursos-web
 *
 * No modifica, mueve ni elimina ningún archivo.
 */
function doGet(e) {
  try {
    const result = getCachedImageIndex_();

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: String(
          error && error.message
            ? error.message
            : error
        )
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


/**
 * Obtiene el índice desde caché.
 *
 * Si no existe:
 * - bloquea temporalmente;
 * - vuelve a comprobar;
 * - reconstruye el índice;
 * - lo guarda en caché.
 *
 * Así varias visitas simultáneas no recorren
 * Google Drive al mismo tiempo.
 */
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


/**
 * Construye el índice completo.
 */
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


/**
 * Indexa imágenes de regalos.
 *
 * Ejemplo:
 *
 * regalos/
 *   1.webp
 *   2.webp
 */
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


/**
 * Recorre recursos-web de manera recursiva.
 *
 * Ejemplo:
 *
 * recursos-web/
 *   logos/logo_empresa.webp
 *   banners/banner.webp
 *   iconos/...              <- SE IGNORA
 *
 * produce:
 *
 * assets["logos/logo_empresa.webp"]
 * assets["banners/banner.webp"]
 *
 * pero no registra nada dentro de iconos.
 */
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


/**
 * Determina si una carpeta de recursos-web
 * debe ignorarse.
 */
function isExcludedResourceFolder_(
  normalizedFolderName
) {
  return CONFIG.EXCLUDED_RESOURCE_FOLDERS
    .some(name =>
      normalizeFolderName_(name) ===
      normalizedFolderName
    );
}


/**
 * Normaliza nombres de carpetas
 * para compararlos correctamente.
 */
function normalizeFolderName_(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}


/**
 * Obtiene información pública necesaria
 * para mostrar la imagen.
 */
function fileInfo(file) {
  const id = file.getId();

  return {
    id: id,
    name: file.getName(),

    /*
     * URL utilizada por el catálogo.
     */
    url:
      'https://lh3.googleusercontent.com/d/' +
      encodeURIComponent(id)
  };
}


/**
 * Extrae un código de producto
 * de cuatro dígitos.
 *
 * Ejemplos válidos:
 *
 * 0579_01_producto.webp
 * 0579-producto.webp
 * 0579 producto.webp
 */
function extractProductCode(name) {
  const match = String(name).match(
    /^(\d{4})(?=_|[\s.-]|$)/
  );

  return match
    ? match[1]
    : '';
}


/**
 * Determina si el archivo
 * tiene una extensión de imagen admitida.
 */
function isImage(file) {
  const name =
    String(file.getName())
      .toLowerCase();

  const extension =
    name.includes('.')
      ? name.split('.').pop()
      : '';

  return CONFIG.IMAGE_EXTENSIONS
    .includes(extension);
}


/*
 * ==========================================
 * CACHÉ
 * ==========================================
 */


/**
 * Lee el índice completo desde CacheService.
 *
 * El JSON se guarda dividido en fragmentos.
 */
function readImageIndexCache_() {
  try {
    const cache =
      CacheService.getScriptCache();

    const metaKey =
      CONFIG.CACHE_KEY_PREFIX +
      '_meta';

    const metaText =
      cache.get(metaKey);

    if (!metaText) {
      return null;
    }

    const meta =
      JSON.parse(metaText);

    const chunks =
      Number(meta.chunks) || 0;

    if (chunks < 1) {
      return null;
    }

    const keys = [];

    for (
      let i = 0;
      i < chunks;
      i++
    ) {
      keys.push(
        CONFIG.CACHE_KEY_PREFIX +
        '_chunk_' +
        i
      );
    }

    const values =
      cache.getAll(keys);

    let json = '';

    for (const key of keys) {
      if (!(key in values)) {
        return null;
      }

      json += values[key];
    }

    return JSON.parse(json);

  } catch (_) {
    return null;
  }
}


/**
 * Guarda el índice completo en caché.
 */
function writeImageIndexCache_(result) {
  try {
    const cache =
      CacheService.getScriptCache();

    const json =
      JSON.stringify(result);

    const chunks = [];

    for (
      let i = 0;
      i < json.length;
      i += CONFIG.CACHE_CHUNK_SIZE
    ) {
      chunks.push(
        json.substring(
          i,
          i + CONFIG.CACHE_CHUNK_SIZE
        )
      );
    }

    const entries = {};

    chunks.forEach(
      (chunk, index) => {

        entries[
          CONFIG.CACHE_KEY_PREFIX +
          '_chunk_' +
          index
        ] = chunk;
      }
    );

    cache.putAll(
      entries,
      CONFIG.CACHE_SECONDS
    );

    cache.put(
      CONFIG.CACHE_KEY_PREFIX +
      '_meta',

      JSON.stringify({
        chunks: chunks.length
      }),

      CONFIG.CACHE_SECONDS
    );

  } catch (_) {
    /*
     * Si la caché falla, el endpoint
     * sigue funcionando normalmente.
     *
     * Simplemente reconstruirá el índice
     * en una solicitud posterior.
     */
  }
}


/**
 * Borra manualmente la caché.
 *
 * Útil después de agregar, cambiar
 * o quitar imágenes si quieres ver
 * el resultado inmediatamente.
 */
function clearImageIndexCache() {
  const cache =
    CacheService.getScriptCache();

  const metaKey =
    CONFIG.CACHE_KEY_PREFIX +
    '_meta';

  let chunks = 0;

  try {
    const metaText =
      cache.get(metaKey);

    if (metaText) {
      const meta =
        JSON.parse(metaText);

      chunks =
        Number(meta.chunks) || 0;
    }
  } catch (_) {}

  const keys = [
    metaKey
  ];

  for (
    let i = 0;
    i < chunks;
    i++
  ) {
    keys.push(
      CONFIG.CACHE_KEY_PREFIX +
      '_chunk_' +
      i
    );
  }

  cache.removeAll(keys);
}


/**
 * Fuerza una reconstrucción inmediata
 * del índice y actualiza la caché.
 *
 * Ejecuta esta función manualmente
 * después de instalar esta nueva versión.
 */
function refreshImageIndexCache() {
  clearImageIndexCache();

  const result =
    buildImageIndex();

  writeImageIndexCache_(result);

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}


/**
 * Prueba manual desde el editor.
 *
 * Usa exactamente el mismo mecanismo
 * que utiliza el endpoint público.
 */
function testIndex() {
  const result =
    getCachedImageIndex_();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );
}