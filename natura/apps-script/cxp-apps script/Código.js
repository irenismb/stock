const CONFIG = {
  appName: 'Programación de obligaciones - API externa',
  defaultHeaderRow: 2,
  books: [
    {
      id: '1T-99tlkUibLlKUcszPftZlntoI4qCW_PVghrieBZ01I',
      name: 'Libro principal',
      enabled: true,
    },
  ],
};

function doGet(e) {
  try {
    const action = ((e && e.parameter && e.parameter.action) || 'ping').trim();

    if (action === 'data') {
      const headerRows = parseHeaderRows_(e && e.parameter ? e.parameter.headerRows : null);
      const data = getConsolidatedData_(headerRows);

      return respond_({
        ok: true,
        columns: data.columns,
        rows: data.rows,
        count: data.rows.length
      }, e);
    }

    if (action === 'saveProgramacion') {
      return respond_({
        ok: false,
        message: 'Sugerido es de solo lectura.'
      }, e);
    }

    return respond_({
      ok: true,
      message: 'API activa',
      usage: {
        data: '?action=data&prefix=miCallback&headerRows=%7B%22ID_LIBRO%22%3A2%7D',
        save: '?action=saveProgramacion&prefix=miCallback&spreadsheetId=...&sheetName=...&rowNumber=...&headerRow=2&value=12345',
        note: 'La columna Sugerido es de solo lectura.'
      }
    }, e);
  } catch (error) {
    return respond_({
      ok: false,
      message: String(error && error.message ? error.message : error)
    }, e);
  }
}

function doPost(e) {
  try {
    const payload = extractPayloadFromEvent_(e);
    const action = (payload.action || '').trim();

    if (action === 'saveProgramacion') {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, message: 'Sugerido es de solo lectura.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, message: 'Acción POST no soportada.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        message: String(error && error.message ? error.message : error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function extractPayloadFromEvent_(e) {
  const out = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (key) {
      out[key] = e.parameter[key];
    });
  }

  if (e && e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    try {
      const json = JSON.parse(raw);
      Object.keys(json).forEach(function (key) {
        out[key] = json[key];
      });
    } catch (jsonError) {}
  }

  return out;
}

function parseHeaderRows_(headerRowsText) {
  if (!headerRowsText) return {};
  try {
    const parsed = JSON.parse(headerRowsText);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function respond_(obj, e) {
  const text = JSON.stringify(obj);
  const prefix = e && e.parameter ? String(e.parameter.prefix || '').trim() : '';

  if (prefix) {
    if (!/^[a-zA-Z_$][0-9a-zA-Z_$\.]*$/.test(prefix)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, message: 'Callback inválido.' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(prefix + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

function getConsolidatedData_(headerRows) {
  const rows = [];
  const registry = {
    columns: [],
    bySignature: {},
    usedKeys: {}
  };

  CONFIG.books.forEach(function (book) {
    if (!book.enabled) return;

    const spreadsheet = SpreadsheetApp.openById(book.id);
    const sheet = spreadsheet.getSheets()[0];
    if (!sheet) return;

    const headerRow = Number(headerRows[book.id] || CONFIG.defaultHeaderRow || 2);
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();

    if (lastRow < headerRow || lastColumn < 1) return;

    const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getDisplayValues()[0];
    const localColumns = buildColumnsFromHeaders_(headers, registry);

    if (lastRow === headerRow) return;

    const dataRange = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, lastColumn);
    const rawValues = dataRange.getValues();
    const displayValues = dataRange.getDisplayValues();

    updateColumnTypesFromSamples_(localColumns, rawValues);

    displayValues.forEach(function (row, idx) {
      if (isEmptyRow_(row)) return;

      const sourceRow = headerRow + 1 + idx;
      const item = {};

      localColumns.forEach(function (col, colIndex) {
        item[col.key] = row[colIndex] === undefined || row[colIndex] === null
          ? ''
          : String(row[colIndex]).trim();
      });

      item.__origenLibro = spreadsheet.getName();
      item.__meta = {
        spreadsheetId: spreadsheet.getId(),
        spreadsheetName: spreadsheet.getName(),
        sheetName: sheet.getName(),
        sourceRow: sourceRow,
        headerRow: headerRow
      };

      rows.push(item);
    });
  });

  if (!registry.usedKeys.__origenLibro) {
    registry.columns.push({
      key: '__origenLibro',
      titulo: 'Libro de origen',
      clase: '',
      tipo: 'texto'
    });
    registry.usedKeys.__origenLibro = true;
  }

  return {
    columns: registry.columns,
    rows: rows
  };
}

function buildColumnsFromHeaders_(headers, registry) {
  const localCounts = {};
  const localColumns = [];

  headers.forEach(function (header, index) {
    const tituloBase = toHeaderTitle_(header, index + 1);
    const baseKey = normalizeDynamicKey_(tituloBase) || ('columna_' + (index + 1));

    localCounts[baseKey] = (localCounts[baseKey] || 0) + 1;
    const occurrence = localCounts[baseKey];
    const signature = baseKey + '|' + occurrence;

    if (!registry.bySignature[signature]) {
      const uniqueBase = occurrence > 1 ? (baseKey + '_' + occurrence) : baseKey;
      const key = makeUniqueKey_(uniqueBase, registry.usedKeys);

      registry.bySignature[signature] = {
        key: key,
        titulo: occurrence > 1 ? (tituloBase + ' (' + occurrence + ')') : tituloBase,
        clase: '',
        tipo: 'texto'
      };

      registry.columns.push(registry.bySignature[signature]);
    }

    localColumns.push(registry.bySignature[signature]);
  });

  return localColumns;
}

function updateColumnTypesFromSamples_(localColumns, rawValues) {
  localColumns.forEach(function (col, colIndex) {
    const inferred = inferColumnType_(rawValues, colIndex);
    col.tipo = mergeColumnType_(col.tipo, inferred);
    if (col.tipo === 'moneda' || col.tipo === 'numero') {
      col.clase = 'num';
    }
  });
}

function inferColumnType_(rawValues, colIndex) {
  let nonEmpty = 0;
  let numeric = 0;
  let dates = 0;

  for (var i = 0; i < rawValues.length; i++) {
    const value = rawValues[i][colIndex];
    if (value === '' || value === null || value === undefined) continue;

    nonEmpty += 1;

    if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
      dates += 1;
      continue;
    }

    if (typeof value === 'number' && isFinite(value)) {
      numeric += 1;
      continue;
    }
  }

  if (!nonEmpty) return 'texto';
  if (dates / nonEmpty >= 0.6) return 'fecha';
  if (numeric / nonEmpty >= 0.6) return 'moneda';
  return 'texto';
}

function mergeColumnType_(actual, inferred) {
  const current = String(actual || 'texto');
  const next = String(inferred || 'texto');

  if (current === 'moneda' || current === 'numero') return current;
  if (current === 'fecha' && next === 'texto') return current;
  if (current === 'texto' && next !== 'texto') return next;
  if (current === 'fecha' && (next === 'moneda' || next === 'numero')) return next;

  return current;
}

function toHeaderTitle_(value, position) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  return text || ('Columna ' + position);
}

function normalizeDynamicKey_(value) {
  return String(value === null || value === undefined ? '' : value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();
}

function makeUniqueKey_(baseKey, usedKeys) {
  let candidate = baseKey || 'columna';
  let suffix = 2;

  while (usedKeys[candidate]) {
    candidate = baseKey + '_' + suffix;
    suffix += 1;
  }

  usedKeys[candidate] = true;
  return candidate;
}

function saveProgramacion_(payload) {
  throw new Error('Sugerido es de solo lectura.');
}

function toNumber_(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (Object.prototype.toString.call(value) === '[object Date]') return 0;

  var text = String(value).trim();
  if (!text) return 0;

  text = text.replace(/\s/g, '');

  if (text.indexOf(',') > -1 && text.indexOf('.') > -1) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (text.indexOf(',') > -1) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }

  var num = Number(text);
  return isFinite(num) ? num : 0;
}

function isEmptyRow_(row) {
  return row.every(function (cell) {
    return cell === '' || cell === null || cell === undefined;
  });
}