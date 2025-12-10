window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  const { CONFIG, Utils, UI, Api } = A;
  const state = A.state;
  const ADMIN_PASS = A.ADMIN_PASS;
  const App = A.App;

  Object.assign(App, {
    /* ---------- Reporte (protegido y simplificado) ---------- */
    bindReportEvents(){
      UI.btnGateOpen.addEventListener('click', async () => {
        const pass = (UI.reportPass.value || '').trim();
        if(!pass){ alert('Ingresa la clave.'); return; }
        if(pass !== ADMIN_PASS){ alert('Clave incorrecta.'); return; }

        state.reportUnlocked = true;
        UI.reportGate.classList.add('hidden');
        UI.reportControls.classList.remove('hidden');

        this.toggleExportButtons(true);

        await this.refreshExportSupport();
        if (UI.reportPass) UI.reportPass.value = '';
      });

      UI.btnExportarExcel.addEventListener('click', () => {
        if(!state.reportUnlocked){ alert('Debes desbloquear el reporte con la clave.'); return; }
        this.exportarExcelDetalles();
      });

      UI.btnExportarHTML?.addEventListener('click', () => {
        if(!state.reportUnlocked){ alert('Debes desbloquear el reporte con la clave.'); return; }
        this.exportarHTMLDetalles();
      });
    },

    toggleExportButtons(enabled){
      if (UI.btnExportarExcel) UI.btnExportarExcel.disabled = !enabled;
      if (UI.btnExportarHTML) UI.btnExportarHTML.disabled = !enabled;
    },

    isExcelLibAvailable(){
      return !!(window.XLSX && window.XLSX.utils && typeof window.XLSX.writeFile === 'function');
    },

    async ensureExcelLibLoaded(){
      if (this.isExcelLibAvailable()) return true;

      const candidates = [
        './recursos/scrips/vendor/xlsx-js-style.full.min.js',
        'https://cdn.jsdelivr.net/npm/xlsx-js-style/dist/xlsx.full.min.js',
        'https://unpkg.com/xlsx-js-style/dist/xlsx.full.min.js',
        'https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js',
        'https://unpkg.com/xlsx/dist/xlsx.full.min.js'
      ];

      for (const src of candidates) {
        if (this.isExcelLibAvailable()) break;
        try{
          await Utils.loadScript(src, {
            test: () => this.isExcelLibAvailable(),
            timeoutMs: 12000
          });
        }catch(e){
          console.warn('[ExcelLoader] falló:', src, e);
        }
      }
      return this.isExcelLibAvailable();
    },

    updateExportButtonsVisibility(){
      const excelSupported = this.isExcelLibAvailable();
      const unlocked = !!state.reportUnlocked;

      if (UI.btnExportarHTML) UI.btnExportarHTML.classList.remove('hidden');

      if (UI.btnExportarExcel) UI.btnExportarExcel.disabled = !(unlocked && excelSupported);
      if (UI.btnExportarHTML) UI.btnExportarHTML.disabled = !unlocked;
    },

    async refreshExportSupport(){
      try{
        UI.reportStatus.textContent = 'Verificando librería de Excel...';
        await this.ensureExcelLibLoaded();
      }finally{
        this.updateExportButtonsVisibility();
        if (this.isExcelLibAvailable()) {
          UI.reportStatus.textContent = 'Librería de Excel lista. También puedes descargar HTML.';
        } else {
          UI.reportStatus.textContent = 'No se encontró la librería de Excel. Puedes descargar HTML.';
        }
      }
    },

    /* =========================================================
       ✅ FORMATO DE REPORTE (EXPORT)
       Columnas finales:
       Fecha | Punto | Tipo | Tercero | Detalle | Valor
       ========================================================= */

    getDetallesFiltrados(desde, hasta){
      const all = state.reporte.detalles || [];

      return all.filter(r => {
        const f = r.fecha || '';
        const p = r.punto || '';
        const tipoCanon = this.canonicalTipo(r.tipo || '');

        if (!f || !p || !tipoCanon) return false;
        if (f < desde || f > hasta) return false;

        // Excluir filas de totales preexistentes
        if (String(tipoCanon).startsWith('Total ')) return false;

        return true;
      }).map(r => ({
        ...r,
        tipo: this.canonicalTipo(r.tipo || '')
      }));
    },

    sortDetallesParaExport(rows){
      const order = CONFIG.EXPORT_TIPO_ORDER || [];

      // índice por texto normalizado
      const idx = new Map(order.map((t,i)=>[this.normalizeText(t), i]));

      return [...rows].sort((a,b) => {
        const tipoA = this.canonicalTipo(a.tipo);
        const tipoB = this.canonicalTipo(b.tipo);

        const na = this.normalizeText(tipoA);
        const nb = this.normalizeText(tipoB);

        const ia = idx.has(na) ? idx.get(na) : 9999;
        const ib = idx.has(nb) ? idx.get(nb) : 9999;

        if (ia !== ib) return ia - ib;

        if (na < nb) return -1;
        if (na > nb) return 1;
        return 0;
      });
    },

    groupByFechaPunto(rows){
      const map = new Map();
      rows.forEach(r => {
        const tipoCanon = this.canonicalTipo(r.tipo || '');
        const rr = { ...r, tipo: tipoCanon };

        const key = `${rr.fecha}__${rr.punto}`;
        if (!map.has(key)) map.set(key, { fecha: rr.fecha, punto: rr.punto, items: [] });
        map.get(key).items.push(rr);
      });

      const groups = Array.from(map.values());
      groups.sort((a,b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
        return this.normalizeText(a.punto) < this.normalizeText(b.punto) ? -1 : 1;
      });

      groups.forEach(g => g.items = this.sortDetallesParaExport(g.items));
      return groups;
    },

    buildReporteWorksheet(desde, hasta){
      const detalles = this.getDetallesFiltrados(desde, hasta);
      const groups = this.groupByFechaPunto(detalles);

      const HEADERS = ['Fecha','Punto','Tipo','Tercero','Detalle','Valor'];

      const thin = { style: 'thin', color: { rgb: '000000' } };
      const baseBorder = { top: thin, bottom: thin, left: thin, right: thin };

      const styles = {
        header: {
          font: { bold: true, color: { rgb: '000000' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'CAEDFB' } },
          border: baseBorder,
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
        },
        cell: {
          border: baseBorder,
          alignment: { vertical: 'center', wrapText: true }
        },
        number: {
          border: baseBorder,
          alignment: { horizontal: 'right', vertical: 'center' },
          numFmt: '#,##0'
        },
        totalRow: {
          font: { bold: true },
          border: baseBorder,
          alignment: { vertical: 'center', wrapText: true }
        },
        totalNumber: {
          font: { bold: true },
          border: baseBorder,
          alignment: { horizontal: 'right', vertical: 'center' },
          numFmt: '#,##0'
        }
      };

      const headerRow = () => HEADERS.map(h => ({ v: h, t: 's', s: styles.header }));
      const safeExcelStr = (s) => String(s || '').replace(/"/g, '""');

      const sumifsFormula = (valorRange, tipoRange, tipos = []) => {
        if (!tipos.length) return '0';
        return tipos
          .map(t => `SUMIFS(${valorRange},${tipoRange},"${safeExcelStr(this.canonicalTipo(t))}")`)
          .join('+');
      };

      const sumByTipos = (items, tipos) => {
        return (items || []).reduce((acc, it) => {
          if (!this.isTipoInList(it.tipo, tipos)) return acc;
          const v = Number(it.valor || 0);
          return acc + v;
        }, 0);
      };

      const aoa = [];
      let rowCursor = 0;
      const originRow = 1;

      const addRow = (cells) => {
        aoa.push(cells);
        rowCursor++;
      };

      groups.forEach(group => {
        const { fecha, punto, items } = group;
        if (!items.length) return;

        addRow(headerRow());

        const excelHeaderRow = originRow + (rowCursor - 1);
        const firstDetailExcelRow = excelHeaderRow + 1;

        items.forEach((r) => {
          const tipoCanon = this.canonicalTipo(r.tipo);

          addRow([
            { v: fecha, t: 's', s: styles.cell },
            { v: punto, t: 's', s: styles.cell },
            { v: tipoCanon || '', t: 's', s: styles.cell },
            { v: r.tercero || '', t: 's', s: styles.cell },
            { v: r.detalle || '', t: 's', s: styles.cell },
            { v: Number(r.valor || 0), t: 'n', s: styles.number }
          ]);
        });

        const lastDetailExcelRow = firstDetailExcelRow + items.length - 1;

        const tipoRange  = `$C$${firstDetailExcelRow}:$C$${lastDetailExcelRow}`;
        const valorRange = `$F$${firstDetailExcelRow}:$F$${lastDetailExcelRow}`;

        const creditoTypes     = CONFIG.TIPOS_REQUIEREN_EMPRESA || [];
        const efectivoTypes    = CONFIG.TIPOS_EFECTIVO || [];
        const electronicaTypes = CONFIG.TIPOS_ELECTRONICOS || [];
        const gastoTypes       = CONFIG.TIPOS_GASTO || [];

        const fCredito     = sumifsFormula(valorRange, tipoRange, creditoTypes);
        const fEfectivo    = sumifsFormula(valorRange, tipoRange, efectivoTypes);
        const fElectronica = sumifsFormula(valorRange, tipoRange, electronicaTypes);
        const fGasto       = sumifsFormula(valorRange, tipoRange, gastoTypes);

        const creditoVal      = sumByTipos(items, creditoTypes);
        const efectivoBruto   = sumByTipos(items, efectivoTypes);
        const electronicaVal  = sumByTipos(items, electronicaTypes);
        const gastoVal        = sumByTipos(items, gastoTypes);

        const efectivoNetoVal = efectivoBruto - creditoVal;
        const totalVentasVal  = efectivoNetoVal + electronicaVal + creditoVal;
        const tesoreriaVal    = efectivoNetoVal - gastoVal;

        const addTotalRow = (label, formula) => {
          addRow([
            { v: fecha, t: 's', s: styles.totalRow },
            { v: punto, t: 's', s: styles.totalRow },
            { v: label, t: 's', s: styles.totalRow },
            { v: '', t: 's', s: styles.totalRow },
            { v: '', t: 's', s: styles.totalRow },
            { f: formula, t: 'n', s: styles.totalNumber }
          ]);
        };

        if (efectivoNetoVal !== 0) {
          addTotalRow('Total ventas en efectivo', `=(${fEfectivo})-(${fCredito})`);
        }
        if (electronicaVal !== 0) {
          addTotalRow('Total ventas por medios electronicos', `=(${fElectronica})`);
        }
        if (creditoVal !== 0) {
          addTotalRow('Total ventas a credito', `=(${fCredito})`);
        }
        if (totalVentasVal !== 0) {
          addTotalRow('Total ventas', `=(${fEfectivo})+(${fElectronica})`);
        }
        if (gastoVal !== 0) {
          addTotalRow('Total gastos en efectivo', `=(${fGasto})`);
        }
        if (tesoreriaVal !== 0) {
          addTotalRow('Total dinero a recibir por tesoreria', `=((${fEfectivo})-(${fCredito}))-(${fGasto})`);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws['!freeze'] = {
        xSplit: 0,
        ySplit: 1,
        topLeftCell: 'A2',
        activePane: 'bottomLeft',
        state: 'frozen'
      };

      ws['!cols'] = [
        { wch: 12 },
        { wch: 14 },
        { wch: 40 },
        { wch: 28 },
        { wch: 32 },
        { wch: 14 }
      ];

      try {
        const ref = ws['!ref'];
        if (ref) {
          const range = XLSX.utils.decode_range(ref);
          const colValor = 5; // F (0-based)
          for (let R = 1; R <= range.e.r; R++) { // desde fila 2
            const addr = XLSX.utils.encode_cell({ r: R, c: colValor });
            const cell = ws[addr];
            if (cell && cell.t === 'n') {
              cell.s = cell.s || {};
              cell.s.numFmt = '#,##0';
            }
          }
        }
      } catch (_) {}

      return ws;
    },

    /* ---------- Generador HTML reutilizable ---------- */
    buildReporteHTMLString(desde, hasta){
      const detalles = this.getDetallesFiltrados(desde, hasta);
      const groups = this.groupByFechaPunto(detalles);

      const headerHtml = `
        <tr>
          <th style="background:#e8f0fe;font-weight:bold;border:1px solid #000;">Fecha</th>
          <th style="background:#e8f0fe;font-weight:bold;border:1px solid #000;">Punto</th>
          <th style="background:#e8f0fe;font-weight:bold;border:1px solid #000;">Tipo</th>
          <th style="background:#e8f0fe;font-weight:bold;border:1px solid #000;">Tercero</th>
          <th style="background:#e8f0fe;font-weight:bold;border:1px solid #000;">Detalle</th>
          <th style="background:#e8f0fe;font-weight:bold;border:1px solid #000;">Valor</th>
        </tr>
      `;

      const sumByTipos = (items, tipos) => {
        return (items || []).reduce((acc, it) => {
          if (!this.isTipoInList(it.tipo, tipos)) return acc;
          const v = Number(it.valor || 0);
          return acc + v;
        }, 0);
      };

      const filas = [];

      const totalRow = (fecha, punto, label, value) => `
        <tr>
          <td style="border:1px solid #000;font-weight:bold;">${Utils.escapeHtml(fecha)}</td>
          <td style="border:1px solid #000;font-weight:bold;">${Utils.escapeHtml(punto)}</td>
          <td style="border:1px solid #000;font-weight:bold;">${Utils.escapeHtml(label)}</td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;"></td>
          <td style="border:1px solid #000;text-align:right;font-weight:bold;">${Utils.formatNumber(value)}</td>
        </tr>
      `;

      groups.forEach(g => {
        const items = g.items || [];
        if (!items.length) return;

        filas.push(headerHtml);

        items.forEach(it => {
          const valor = Number(it.valor || 0);
          const tipoCanon = this.canonicalTipo(it.tipo);

          filas.push(`
            <tr>
              <td style="border:1px solid #000;">${Utils.escapeHtml(g.fecha)}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(g.punto)}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(tipoCanon || '')}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(it.tercero || '')}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(it.detalle || '')}</td>
              <td style="border:1px solid #000;text-align:right;font-weight:600;">${Utils.formatNumber(valor)}</td>
            </tr>
          `);
        });

        const creditoTypes     = CONFIG.TIPOS_REQUIEREN_EMPRESA || [];
        const efectivoTypes    = CONFIG.TIPOS_EFECTIVO || [];
        const electronicaTypes = CONFIG.TIPOS_ELECTRONICOS || [];
        const gastoTypes       = CONFIG.TIPOS_GASTO || [];

        const creditoVal      = sumByTipos(items, creditoTypes);
        const efectivoBruto   = sumByTipos(items, efectivoTypes);
        const electronicaVal  = sumByTipos(items, electronicaTypes);
        const gastoVal        = sumByTipos(items, gastoTypes);

        const efectivoNetoVal = efectivoBruto - creditoVal;
        const totalVentasVal  = efectivoNetoVal + electronicaVal + creditoVal;
        const tesoreriaVal    = efectivoNetoVal - gastoVal;

        if (efectivoNetoVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total ventas en efectivo', efectivoNetoVal));
        if (electronicaVal !== 0)  filas.push(totalRow(g.fecha, g.punto, 'Total ventas por medios electronicos', electronicaVal));
        if (creditoVal !== 0)      filas.push(totalRow(g.fecha, g.punto, 'Total ventas a credito', creditoVal));
        if (totalVentasVal !== 0)  filas.push(totalRow(g.fecha, g.punto, 'Total ventas', totalVentasVal));
        if (gastoVal !== 0)        filas.push(totalRow(g.fecha, g.punto, 'Total gastos en efectivo', gastoVal));
        if (tesoreriaVal !== 0)    filas.push(totalRow(g.fecha, g.punto, 'Total dinero a recibir por tesoreria', tesoreriaVal));
      });

      const htmlDoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;line-height:1.35;padding:10px;}
  table{border-collapse:collapse;width:100%;}
  th,td{padding:6px 8px;}
</style>
</head>
<body>
  <table>
    <tbody>
      ${filas.join('')}
    </tbody>
  </table>
</body>
</html>`.trim();

      return { htmlDoc, detallesCount: detalles.length };
    },

    /* ---------- Descarga de blobs ---------- */
    downloadBlob(blob, filename){
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    /* ---------- Excel: XLSX principal con respaldo XLS ---------- */
    async exportarExcelDetalles(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      UI.reportStatus.textContent = 'Cargando detalles del servidor...';

      try{
        await this.ensureDataForRange(desde, hasta);

        const detalles = this.getDetallesFiltrados(desde, hasta);
        if (!detalles.length){
          alert('No hay detalles para exportar en el rango seleccionado.');
          UI.reportStatus.textContent = 'Sin datos para exportar.';
          return;
        }

        UI.reportStatus.textContent = 'Verificando librería de Excel...';
        await this.ensureExcelLibLoaded();

        if (!this.isExcelLibAvailable()){
          UI.reportStatus.textContent = 'No se encontró la librería de Excel.';
          alert('No se pudo generar el archivo porque la librería de Excel no está disponible. Puedes descargar HTML.');
          this.updateExportButtonsVisibility();
          return;
        }

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;
        const ws = this.buildReporteWorksheet(desde, hasta);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

        const filenameXlsx = `reporte_${rangeTxt}.xlsx`;

        try{
          window.XLSX.writeFile(wb, filenameXlsx, { bookType: 'xlsx', cellStyles: true });
          UI.reportStatus.textContent = `Excel XLSX generado con formato de reporte (${detalles.length} detalles).`;
        }catch(err){
          console.warn('[ExcelExport] fallo XLSX, intentando XLS:', err);
          const filenameXls = `reporte_${rangeTxt}.xls`;
          window.XLSX.writeFile(wb, filenameXls, { bookType: 'xls', cellStyles: true });
          UI.reportStatus.textContent = `Excel XLS generado como respaldo (${detalles.length} detalles).`;
        }

        this.updateExportButtonsVisibility();
      }catch(e){
        console.error(e);
        UI.reportStatus.textContent = 'Error al exportar Excel.';
        alert(
          'No se pudo exportar el Excel. ' +
          'Si el problema persiste, usa el botón HTML.'
        );
        this.updateExportButtonsVisibility();
      }
    },

    async exportarHTMLDetalles(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      UI.reportStatus.textContent = 'Cargando detalles del servidor...';

      try{
        await this.ensureDataForRange(desde, hasta);

        const detalles = this.getDetallesFiltrados(desde, hasta);
        if (!detalles.length){
          alert('No hay detalles para exportar en el rango seleccionado.');
          UI.reportStatus.textContent = 'Sin datos para exportar.';
          return;
        }

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;
        const { htmlDoc, detallesCount } = this.buildReporteHTMLString(desde, hasta);
        const blob = new Blob([htmlDoc], {type:'text/html;charset=utf-8;'});

        this.downloadBlob(blob, `reporte_${rangeTxt}.html`);
        UI.reportStatus.textContent = `HTML generado con formato de reporte (${detallesCount} detalles).`;
      }catch(e){
        console.error(e);
        UI.reportStatus.textContent = 'Error al exportar HTML.';
        alert('No se pudo exportar el HTML.');
      }
    },

    async ensureDataForRange(desde, hasta){
      const r = state.reporte.detallesRange || {};

      if (r.desde !== desde || r.hasta !== hasta || !Array.isArray(state.reporte.detalles)) {
        const detallesSrv = await Api.cargarDetallesDesdeServidor(desde, hasta);

        // ✅ Canonicalizar tipos al ingresar al estado del reporte
        state.reporte.detalles = (detallesSrv || []).map(d => ({
          ...d,
          tipo: this.canonicalTipo(d.tipo || '')
        }));

        state.reporte.detallesRange = { desde, hasta };
        state.reporte.detallesSource = 'server';
      }
    }
  });
})(window.Arcadia);

