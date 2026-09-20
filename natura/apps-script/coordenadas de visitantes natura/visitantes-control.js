// Control de duplicados, frecuencia y modos de registro de visitas.

// ===================== CONTROL DE VISITAS =====================
function getVisitMode_(){
  try{
    const ss = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sh) return DEFAULT_VISIT_MODE;

    const lastRow = sh.getLastRow();
    if (lastRow < 1) return DEFAULT_VISIT_MODE;

    const values = sh
      .getRange(1, 1, lastRow, Math.min(5, sh.getLastColumn()))
      .getDisplayValues();

    for (const row of values){
      const key = String(row[4] || "").trim().toUpperCase();
      if (key !== VISIT_MODE_CONTROL_KEY) continue;
      return normalizeVisitMode_(row[1]);
    }
  }catch(_){
  }

  return DEFAULT_VISIT_MODE;
}

function normalizeVisitMode_(value){
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

  return VISIT_MODES.has(normalized) ? normalized : DEFAULT_VISIT_MODE;
}

function getVisitStats_(sh, headerIndex, userIdRaw){
  const id = String(userIdRaw || "").trim();
  if (!id || headerIndex.id_navegador == null){
    return { tipo:"No identificado", numero:"" };
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2){
    return { tipo:"Nuevo", numero:1 };
  }

  const matches = sh
    .getRange(2, headerIndex.id_navegador + 1, lastRow - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findAll();

  const previous = matches.length;
  return {
    tipo: previous > 0 ? "Recurrente" : "Nuevo",
    numero: previous + 1
  };
}

function shouldRegisterVisit_(sh, headerIndex, userIdRaw, dateStr, mode){
  const normalizedMode = normalizeVisitMode_(mode);

  if (normalizedMode === "NINGUNA") return false;
  if (normalizedMode === "TODAS") return true;

  const id = String(userIdRaw || "").trim();

  // El catálogo normalmente envía user_id. Si faltara, se conserva la visita
  // porque no existe una identidad fiable con la cual deduplicarla.
  if (!id) return true;

  const idIndex = headerIndex.id_navegador;
  if (idIndex == null) return true;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return true;

  const matches = sh
    .getRange(2, idIndex + 1, lastRow - 1, 1)
    .createTextFinder(id)
    .matchEntireCell(true)
    .findAll();

  if (!matches.length) return true;

  if (normalizedMode === "UNA POR DISPOSITIVO"){
    return false;
  }

  if (normalizedMode === "UNA POR DIA"){
    const dateIndex = headerIndex.fecha;
    if (dateIndex == null) return false;

    for (const match of matches){
      const existingDate = String(
        sh.getRange(match.getRow(), dateIndex + 1).getDisplayValue() || ""
      ).trim();

      if (existingDate === dateStr) return false;
    }
  }

  return true;
}