// Caché del índice y funciones manuales de mantenimiento/prueba.

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
