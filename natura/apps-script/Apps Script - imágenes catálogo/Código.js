const PRODUCTOS_FOLDER_ID = '133WAYlDKSt3r8KIObttDcv86eHPmPQ5b';
const REGALOS_FOLDER_ID = '11btU0Pcd61_y9Aa1esXB_Jq8bN_83sgb';
const CACHE_SECONDS = 300;

function doGet() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('image-index-v1');
    if (cached) {
      return json_(JSON.parse(cached));
    }

    const payload = {
      ok: true,
      generatedAt: Utilities.formatDate(new Date(), 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      products: indexProducts_(DriveApp.getFolderById(PRODUCTOS_FOLDER_ID)),
      gifts: indexFiles_(DriveApp.getFolderById(REGALOS_FOLDER_ID)),
      assets: []
    };

    try {
      cache.put('image-index-v1', JSON.stringify(payload), CACHE_SECONDS);
    } catch (_) {}

    return json_(payload);
  } catch (error) {
    return json_({
      ok: false,
      generatedAt: Utilities.formatDate(new Date(), 'America/Bogota', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      error: String(error && error.message ? error.message : error)
    });
  }
}

function indexProducts_(folder) {
  const products = {};
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (!isImage_(file)) continue;

    const name = file.getName();
    const match = name.match(/^(\d{4})(?=$|[_.\s-])/);
    if (!match) continue;

    const code = match[1];
    if (!products[code]) products[code] = [];
    products[code].push(fileRecord_(file));
  }

  Object.keys(products).forEach(function (code) {
    products[code].sort(compareFiles_);
  });

  return products;
}

function indexFiles_(folder) {
  const output = [];
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    if (isImage_(file)) output.push(fileRecord_(file));
  }

  output.sort(compareFiles_);
  return output;
}

function fileRecord_(file) {
  const id = file.getId();
  return {
    id: id,
    name: file.getName(),
    url: 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(id)
  };
}

function isImage_(file) {
  return String(file.getMimeType() || '').toLowerCase().indexOf('image/') === 0;
}

function compareFiles_(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'es', {
    numeric: true,
    sensitivity: 'base'
  });
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
