// Resolución segura de tablas y encabezados del registro de pedidos.

function normalizeHeader_(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
function canonicalHeaderMap_(headers) {
  const map = {};
  (headers || []).forEach(function(header) {
    map[normalizeHeader_(header)] = header;
  });
  return map;
}
function resolveTableContext_(spreadsheet, requiredHeaders, onlySheetName) {
  const canonical = canonicalHeaderMap_(requiredHeaders);
  const requiredKeys = Object.keys(canonical);
  const matches = [];
  const duplicateRows = [];
  const sheets = onlySheetName ? [spreadsheet.getSheetByName(onlySheetName)] : spreadsheet.getSheets();

  if (onlySheetName && !sheets[0]) {
    throw new Error("No existe la pestaña requerida: " + onlySheetName);
  }

  sheets.forEach(function(sheet) {
    if (!sheet) return;
    const rowCount = Math.min(sheet.getMaxRows(), HEADER_SCAN_MAX_ROWS);
    const colCount = Math.min(sheet.getMaxColumns(), HEADER_SCAN_MAX_COLS);
    if (rowCount < 1 || colCount < 1) return;

    const values = sheet.getRange(1, 1, rowCount, colCount).getDisplayValues();
    values.forEach(function(row, rowIndex) {
      const found = {};
      const duplicates = [];

      row.forEach(function(value, colIndex) {
        const key = normalizeHeader_(value);
        if (!canonical[key]) return;
        if (found[key]) {
          duplicates.push(canonical[key]);
          return;
        }
        found[key] = colIndex + 1;
      });

      if (duplicates.length) {
        duplicateRows.push(sheet.getName() + " fila " + (rowIndex + 1) + ": " + duplicates.join(", "));
        return;
      }

      const complete = requiredKeys.every(function(key) { return !!found[key]; });
      if (!complete) return;

      const columnByHeader = {};
      requiredKeys.forEach(function(key) {
        columnByHeader[canonical[key]] = found[key];
      });

      matches.push({
        sheet: sheet,
        headerRow: rowIndex + 1,
        columnByHeader: columnByHeader
      });
    });
  });

  if (matches.length !== 1) {
    const duplicateDetail = duplicateRows.length ? " Encabezados duplicados: " + duplicateRows.join(" | ") : "";
    throw new Error(
      "No se pudo identificar de forma única la tabla por sus encabezados. Coincidencias: " + matches.length + "." + duplicateDetail
    );
  }

  return matches[0];
}
function resolveSheetContext_() {
  return resolveTableContext_(SpreadsheetApp.openById(SPREADSHEET_ID), REQUIRED_HEADERS, "");
}
function resolveInventoryContext_() {
  return resolveTableContext_(
    SpreadsheetApp.openById(INVENTORY_SPREADSHEET_ID),
    INVENTORY_REQUIRED_HEADERS,
    INVENTORY_SHEET_NAME
  );
}