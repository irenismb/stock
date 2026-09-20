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

// ===================== ENDPOINT PÚBLICO =====================
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