// Identidad del navegador y reglas de visitas propias.

// ===================== NAVEGADORES (FUNCIONES) =====================
function normalizeName_(value){
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getBrowserIdentity_(userId){
  const id = String(userId || "").trim();
  if (!id) return { id:"", nombre:"", navegador:"" };

  try{
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName(BROWSER_ID_SHEET_NAME);
    if (!sh || sh.getLastRow() < 2){
      return { id, nombre:"", navegador:id };
    }

    const found = sh
      .getRange(2, 1, sh.getLastRow() - 1, 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext();

    if (!found) return { id, nombre:"", navegador:id };

    const nombre = String(sh.getRange(found.getRow(), 2).getDisplayValue() || "").trim();
    return { id, nombre, navegador:nombre || id };
  }catch(error){
    console.error("No se pudo consultar id_navegador: " + error);
    return { id, nombre:"", navegador:id };
  }
}

function getConfigValueByKey_(key){
  try{
    const ss = SpreadsheetApp.openById(CONFIG_SPREADSHEET_ID);
    const sh = ss.getSheetByName(CONFIG_SHEET_NAME);
    if (!sh) return "";

    const lastRow = sh.getLastRow();
    if (lastRow < 1) return "";

    const values = sh
      .getRange(1, 1, lastRow, Math.min(5, sh.getLastColumn()))
      .getDisplayValues();

    const wanted = String(key || "").trim().toUpperCase();
    for (const row of values){
      const current = String(row[4] || "").trim().toUpperCase();
      if (current === wanted) return String(row[1] || "").trim();
    }
  }catch(error){
    console.error("No se pudo leer Configuracion: " + error);
  }
  return "";
}

function shouldSkipOwnVisit_(identity){
  const normalizedName = normalizeName_(identity && identity.nombre);
  if (!OWN_VISITOR_NAMES.has(normalizedName)) return false;

  const state = normalizeName_(getConfigValueByKey_(OWN_VISITS_CONTROL_KEY));
  return state === "DESACTIVADO";
}

function isPrivateIpv4_(value){
  const ip = String(value || "").trim();
  const match = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const p = match.slice(1).map(Number);
  if (p.some(n => n < 0 || n > 255)) return false;
  if (p[0] === 10) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  return false;
}