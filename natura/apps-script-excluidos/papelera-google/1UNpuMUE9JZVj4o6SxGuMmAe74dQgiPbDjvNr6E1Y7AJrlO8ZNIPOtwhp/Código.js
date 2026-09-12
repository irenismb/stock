/**
 * Servicio de solo lectura para el catálogo de productos.
 * v: 2026-08-07 10:27:13 p. m.
 * La primera imagen de cada documento se usa como portada única de su categoría.
 *
 * Lee todos los documentos de Google de la carpeta indicada por la página,
 * empareja cada imagen con el registro que empieza por su código de cuatro
 * dígitos y devuelve un catálogo único mediante JSON o JSONP.
 */

const CACHE_KEY_PREFIX = 'inventory_catalog_v4_';
const CACHE_SECONDS = 8 * 60;
const CACHE_CHUNK_CHARS = 20000;

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = sanitizeCallback_(params.callback || params.prefix || '');
  const force = String(params.refresh || '') === '1';
  const folderId = extractFolderId_(params.folderUrl || params.folderId || '');

  try {
    if (!folderId) {
      throw new Error('No se recibió un enlace válido de una carpeta de Google Drive.');
    }
    const payload = buildPayload_(folderId, force);
    return output_(payload, callback);
  } catch (error) {
    const payload = {
      ok: false,
      generatedAt: new Date().toISOString(),
      error: String(error && error.message ? error.message : error),
      products: []
    };
    return output_(payload, callback);
  }
}

function buildPayload_(folderId, force) {
  const cacheKey = CACHE_KEY_PREFIX + folderId;
  if (!force) {
    const cached = readChunkedCache_(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      parsed.cache = 'hit';
      return parsed;
    }
  }

  const inventoryDocs = listInventoryDocs_(folderId);
  const products = [];
  const documents = [];
  const errors = [];
  const responses = fetchDocs_(inventoryDocs);

  inventoryDocs.forEach(function (source, index) {
    try {
      const item = responses[index];
      if (!item || !item.ok) {
        throw new Error(item && item.error ? item.error : 'No se recibió respuesta de Google Docs.');
      }
      const doc = item.doc;
      const title = String(doc.title || source.title || source.category || '').trim();
      const extracted = extractProducts_(doc, source, title);
      products.push.apply(products, extracted);
      documents.push({
        id: source.id,
        title: title,
        category: source.category,
        products: extracted.length
      });
    } catch (error) {
      errors.push({
        documentId: source.id,
        category: source.category,
        error: String(error && error.message ? error.message : error)
      });
    }
  });

  products.sort(function (a, b) {
    return String(a.code).localeCompare(String(b.code), 'es', { numeric: true });
  });

  const duplicateCodes = findDuplicateCodes_(products);
  const payload = {
    ok: errors.length === 0 && duplicateCodes.length === 0,
    generatedAt: new Date().toISOString(),
    cache: 'miss',
    folderId: folderId,
    productCount: products.length,
    documentCount: documents.length,
    duplicateCodes: duplicateCodes,
    errors: errors,
    documents: documents,
    products: products
  };

  // contentUri tiene vida limitada; no se cachea por demasiado tiempo.
  writeChunkedCache_(cacheKey, JSON.stringify(payload));
  return payload;
}

function listInventoryDocs_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  const sources = [];

  while (files.hasNext()) {
    const file = files.next();
    const title = String(file.getName() || '').trim();
    sources.push({
      id: file.getId(),
      title: title,
      category: categoryFromTitle_(title)
    });
  }

  sources.sort(function (a, b) {
    return String(a.title).localeCompare(String(b.title), 'es', { sensitivity: 'base' });
  });
  return sources;
}

function categoryFromTitle_(title) {
  const value = String(title || 'General').replace(/\s+/g, ' ').trim() || 'General';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function extractFolderId_(value) {
  const text = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return text;
  const match = text.match(/\/folders\/([A-Za-z0-9_-]+)/i);
  return match ? match[1] : '';
}

function fetchDocs_(inventoryDocs) {
  const token = ScriptApp.getOAuthToken();
  const requests = inventoryDocs.map(function (source) {
    return {
      url: 'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(source.id) + '?includeTabsContent=true',
      method: 'get',
      muteHttpExceptions: true,
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json'
      }
    };
  });

  if (!requests.length) return [];

  const responses = UrlFetchApp.fetchAll(requests);
  return responses.map(function (response, index) {
    const status = response.getResponseCode();
    const text = response.getContentText();
    if (status < 200 || status >= 300) {
      return {
        ok: false,
        error: 'Docs API ' + status + ' para ' + inventoryDocs[index].id + ': ' + text.slice(0, 400)
      };
    }
    try {
      return { ok: true, doc: JSON.parse(text) };
    } catch (error) {
      return { ok: false, error: 'JSON inválido para ' + inventoryDocs[index].id + ': ' + error.message };
    }
  });
}

function readChunkedCache_(cacheKey) {
  const cache = CacheService.getScriptCache();
  const metaKey = cacheKey + '_meta';
  const metaRaw = cache.get(metaKey);
  if (!metaRaw) return '';
  try {
    const meta = JSON.parse(metaRaw);
    const count = Number(meta.count || 0);
    if (!count) return '';
    const keys = [];
    for (let i = 0; i < count; i += 1) keys.push(cacheKey + '_' + i);
    const values = cache.getAll(keys);
    const parts = keys.map(function (key) { return values[key] || ''; });
    if (parts.some(function (part) { return !part; })) return '';
    return parts.join('');
  } catch (_) {
    return '';
  }
}

function writeChunkedCache_(cacheKey, text) {
  const cache = CacheService.getScriptCache();
  const chunks = [];
  for (let i = 0; i < text.length; i += CACHE_CHUNK_CHARS) {
    chunks.push(text.slice(i, i + CACHE_CHUNK_CHARS));
  }
  const entries = {};
  chunks.forEach(function (chunk, index) {
    entries[cacheKey + '_' + index] = chunk;
  });
  cache.putAll(entries, CACHE_SECONDS);
  cache.put(cacheKey + '_meta', JSON.stringify({ count: chunks.length }), CACHE_SECONDS);
}

function extractProducts_(doc, source, title) {
  const tab = firstDocumentTab_(doc);
  const body = (tab && tab.body && tab.body.content) || (doc.body && doc.body.content) || [];
  const inlineObjects = (tab && tab.inlineObjects) || doc.inlineObjects || {};
  const result = [];
  let pendingImage = null;

  body.forEach(function (structuralElement) {
    const paragraph = structuralElement.paragraph;
    if (!paragraph) return;

    const imageInfo = imageFromParagraph_(paragraph, inlineObjects);
    const text = paragraphText_(paragraph).replace(/\u00a0/g, ' ').trim();

    if (imageInfo) {
      pendingImage = imageInfo;
    }

    if (!/^\d{4}\s*-\s*/.test(text)) return;

    const parsed = parseInventoryRecord_(text);
    if (!parsed) return;

    parsed.category = source.category;
    parsed.documentTitle = title;
    parsed.documentId = source.id;
    parsed.documentUrl = 'https://docs.google.com/document/d/' + source.id + '/edit';
    parsed.image = pendingImage;
    parsed.isDocumentFirst = result.length === 0;
    result.push(parsed);
    pendingImage = null;
  });

  return result;
}

function firstDocumentTab_(doc) {
  if (!doc || !Array.isArray(doc.tabs) || !doc.tabs.length) return null;
  const first = doc.tabs[0];
  return first && first.documentTab ? first.documentTab : null;
}

function paragraphText_(paragraph) {
  return (paragraph.elements || []).map(function (element) {
    return element && element.textRun ? String(element.textRun.content || '') : '';
  }).join('');
}

function imageFromParagraph_(paragraph, inlineObjects) {
  const elements = paragraph.elements || [];
  for (let i = 0; i < elements.length; i += 1) {
    const element = elements[i];
    const inline = element && element.inlineObjectElement;
    if (!inline || !inline.inlineObjectId) continue;
    const object = inlineObjects[inline.inlineObjectId];
    const embedded = object && object.inlineObjectProperties && object.inlineObjectProperties.embeddedObject;
    const props = embedded && embedded.imageProperties;
    if (!props || !props.contentUri) continue;

    return {
      inlineObjectId: inline.inlineObjectId,
      url: props.contentUri,
      sourceUrl: props.sourceUri || '',
      altText: (embedded.title || embedded.description || '').trim(),
      widthPt: embedded.size && embedded.size.width ? Number(embedded.size.width.magnitude || 0) : 0,
      heightPt: embedded.size && embedded.size.height ? Number(embedded.size.height.magnitude || 0) : 0
    };
  }
  return null;
}

function parseInventoryRecord_(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  const match = text.match(/^(\d{4})\s*-\s*/);
  if (!match) return null;

  const code = match[1];
  const afterCode = text.slice(match[0].length);
  const mineLabel = 'Precio conmigo:';
  const sourceLabel = 'Fuente de la imagen:';
  const internetLabel = 'Precio en internet:';

  const mineIndex = afterCode.indexOf(mineLabel);
  const sourceIndex = afterCode.indexOf(sourceLabel);
  const internetIndex = afterCode.indexOf(internetLabel);
  if (mineIndex < 0 || sourceIndex < 0 || internetIndex < 0 || !(mineIndex < sourceIndex && sourceIndex < internetIndex)) {
    return {
      code: code,
      name: cleanTerminalPeriod_(afterCode),
      priceMineText: '',
      priceMine: 0,
      imageSource: '',
      priceInternetText: '',
      priceInternet: 0,
      description: afterCode
    };
  }

  const nameRaw = afterCode.slice(0, mineIndex).trim();
  const mineRaw = afterCode.slice(mineIndex + mineLabel.length, sourceIndex).trim();
  const sourceRaw = afterCode.slice(sourceIndex + sourceLabel.length, internetIndex).trim();
  const afterInternet = afterCode.slice(internetIndex + internetLabel.length).trim();
  const splitInternet = splitInternetPriceAndDescription_(afterInternet);

  return {
    code: code,
    name: cleanTerminalPeriod_(nameRaw),
    priceMineText: cleanTerminalPeriod_(mineRaw),
    priceMine: parseCop_(mineRaw),
    imageSource: cleanTerminalPeriod_(sourceRaw),
    priceInternetText: cleanTerminalPeriod_(splitInternet.priceText),
    priceInternet: parseCop_(splitInternet.priceText),
    description: String(splitInternet.description || '').trim(),
    rawText: text
  };
}

function splitInternetPriceAndDescription_(text) {
  const value = String(text || '').trim();
  if (!value) return { priceText: '', description: '' };

  // Campo lleno según el esquema: 123.456 pesos colombianos. Descripción...
  const filled = value.match(/^(\d[\d.]*\s+pesos colombianos)\.\s*(.*)$/i);
  if (filled) {
    return { priceText: filled[1], description: filled[2] || '' };
  }

  // Campo vacío: el contenido empieza directamente con la descripción.
  return { priceText: '', description: value };
}

function cleanTerminalPeriod_(value) {
  return String(value || '').trim().replace(/\.\s*$/, '').trim();
}

function parseCop_(value) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function findDuplicateCodes_(products) {
  const counts = {};
  products.forEach(function (product) {
    counts[product.code] = (counts[product.code] || 0) + 1;
  });
  return Object.keys(counts).filter(function (code) { return counts[code] > 1; }).sort();
}

function sanitizeCallback_(value) {
  const callback = String(value || '').trim();
  if (!callback) return '';
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback) ? callback : '';
}

function output_(payload, callback) {
  const json = JSON.stringify(payload);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
