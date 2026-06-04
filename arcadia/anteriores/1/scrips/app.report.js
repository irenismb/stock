window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  const { CONFIG, Utils, UI, Api } = A;
  const state = A.state;
  const ADMIN_PASS = A.ADMIN_PASS;
  const App = A.App;

  Object.assign(App, {
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
          await Utils.loadScript(src, { test: () => this.isExcelLibAvailable(), timeoutMs: 12000 });
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
        UI.reportStatus.textContent = this.isExcelLibAvailable()
          ? 'Librería de Excel lista. Se exportarán detalles + totales desde la nube.'
          : 'No se encontró la librería de Excel. Puedes descargar HTML. Se exportarán detalles + totales desde la nube.';
      }
    },

    /* ===========================
       Totales: resolver por CLAVE
       =========================== */
    resolveTotalKeyFromTipo(tipo){
      const t = String(tipo || '').trim();
      if (!t) return null;
      const nt = this.normalizeText(t);
      const map = CONFIG.TIPO_A_CLAVE || {};
      for (const label in map) {
        if (this.normalizeText(label) === nt) return map[label];
      }
      // fallback: por si llega "Total ..." pero con variantes no mapeadas
      if (nt.startsWith('total ')) return '__unmapped_total__';
      return null;
    },

    getRowsFiltrados(desde, hasta){
      const all = state.reporte.detalles || [];
      return all.filter(r => {
        const f = String(r.fecha || '').trim();
        const p = String(r.punto || '').trim();
        const tipo = String(r.tipo || '').trim();
        if (!f || !p || !tipo) return false;
        if (f < desde || f > hasta) return false;
        return true;
      });
    },

    splitDetallesYTotales(rows){
      const detalles = [];
      const totales = [];
      (rows || []).forEach(r => {
        const k = this.resolveTotalKeyFromTipo(r.tipo);
        if (k && k !== '__unmapped_total__') totales.push({ ...r, totalKey: k });
        else if (k === '__unmapped_total__') totales.push({ ...r, totalKey: '__unmapped_total__' });
        else detalles.push(r);
      });
      return { detalles, totales };
    },

    sortDetallesParaExport(rows){
      const order = CONFIG.EXPORT_TIPO_ORDER || [];
      const idx = new Map(order.map((t,i)=>[t,i]));
      return [...rows].sort((a,b) => {
        const ia = idx.has(a.tipo) ? idx.get(a.tipo) : 9999;
        const ib = idx.has(b.tipo) ? idx.get(b.tipo) : 9999;
        if (ia !== ib) return ia - ib;
        const ta = this.normalizeText(a.tipo);
        const tb = this.normalizeText(b.tipo);
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return 0;
      });
    },

    groupByFechaPunto(rows){
      const map = new Map();
      (rows || []).forEach(r => {
        const key = `${r.fecha}__${r.punto}`;
        if (!map.has(key)) map.set(key, { fecha: r.fecha, punto: r.punto, items: [] });
        map.get(key).items.push(r);
      });
      const groups = Array.from(map.values());
      groups.sort((a,b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
        return this.normalizeText(a.punto) < this.normalizeText(b.punto) ? -1 : 1;
      });
      groups.forEach(g => g.items = this.sortDetallesParaExport(g.items));
      return groups;
    },

    indexTotalesPorGrupo(totales){
      // key: fecha__punto -> Map(totalKey -> {labelOriginal, valor})
      const byGroup = new Map();
      (totales || []).forEach(r => {
        const key = `${r.fecha}__${r.punto}`;
        if (!byGroup.has(key)) byGroup.set(key, new Map());
        const m = byGroup.get(key);
        const tk = r.totalKey || this.resolveTotalKeyFromTipo(r.tipo) || '__unmapped_total__';
        m.set(tk, { label: String(r.tipo || '').trim(), valor: Number(r.valor || 0) });
      });
      return byGroup;
    },

    getTotalOrder(){
      // usa el orden “oficial” de tu app
      return (CONFIG.TOTAL_KEYS || []).map(x => ({ key: x.key, label: x.label }));
    },

    /* ===========================
       Excel / HTML (detalles + totales nube)
       =========================== */
    buildReporteWorksheet(desde, hasta){
      const rows = this.getRowsFiltrados(desde, hasta);
      const { detalles, totales } = this.splitDetallesYTotales(rows);

      const gruposDetalles = this.groupByFechaPunto(detalles);
      const totalesIndex = this.indexTotalesPorGrupo(totales);

      const keys = new Set();
      gruposDetalles.forEach(g => keys.add(`${g.fecha}__${g.punto}`));
      for (const k of totalesIndex.keys()) keys.add(k);

      const groups = Array.from(keys).map(k => {
        const [fecha, punto] = k.split('__');
        const detGroup = gruposDetalles.find(g => `${g.fecha}__${g.punto}` === k);
        return { fecha, punto, items: detGroup ? detGroup.items : [] };
      });

      groups.sort((a,b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
        return this.normalizeText(a.punto) < this.normalizeText(b.punto) ? -1 : 1;
      });

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
        cell: { border: baseBorder, alignment: { vertical: 'center', wrapText: true } },
        number: { border: baseBorder, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0' },
        totalRow: { font: { bold: true }, border: baseBorder, alignment: { vertical: 'center', wrapText: true } },
        totalNumber: { font: { bold: true }, border: baseBorder, alignment: { horizontal: 'right', vertical: 'center' }, numFmt: '#,##0' }
      };

      const aoa = [];
      const headerRow = () => HEADERS.map(h => ({ v: h, t: 's', s: styles.header }));
      const addRow = (cells) => aoa.push(cells);

      const totalOrder = this.getTotalOrder();
      const missingNotes = [];

      groups.forEach(g => {
        addRow(headerRow());

        (g.items || []).forEach(r => {
          addRow([
            { v: g.fecha, t: 's', s: styles.cell },
            { v: g.punto, t: 's', s: styles.cell },
            { v: r.tipo || '', t: 's', s: styles.cell },
            { v: r.tercero || '', t: 's', s: styles.cell },
            { v: r.detalle || '', t: 's', s: styles.cell },
            { v: Number(r.valor || 0), t: 'n', s: styles.number }
          ]);
        });

        const key = `${g.fecha}__${g.punto}`;
        const m = totalesIndex.get(key) || new Map();

        const totalsReceived = Array.from(m.keys()).filter(k => k !== '__unmapped_total__').length;
        if (!totalsReceived) {
          missingNotes.push(`${g.fecha} / ${g.punto}: NO llegaron filas de totales desde la nube`);
        }

        totalOrder.forEach(t => {
          const found = m.get(t.key);
          const labelOut = (found && found.label) ? found.label : t.label;
          const valOut = found ? Number(found.valor || 0) : 0;
          if (!found) missingNotes.push(`${g.fecha} / ${g.punto}: falta "${t.label}" (se exporta 0)`);

          addRow([
            { v: g.fecha, t: 's', s: styles.totalRow },
            { v: g.punto, t: 's', s: styles.totalRow },
            { v: labelOut, t: 's', s: styles.totalRow },
            { v: '', t: 's', s: styles.totalRow },
            { v: '', t: 's', s: styles.totalRow },
            { v: valOut, t: 'n', s: styles.totalNumber }
          ]);
        });
      });

      if (missingNotes.length) {
        console.warn('[TotalesExport] Avisos:\n' + missingNotes.join('\n'));
        UI.reportStatus.textContent =
          'Aviso: faltan totales desde la nube (se exportaron como 0).';
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
      ws['!cols'] = [{ wch: 12 },{ wch: 14 },{ wch: 40 },{ wch: 28 },{ wch: 32 },{ wch: 14 }];
      return ws;
    },

    buildReporteHTMLString(desde, hasta){
      const rows = this.getRowsFiltrados(desde, hasta);
      const { detalles, totales } = this.splitDetallesYTotales(rows);

      const gruposDetalles = this.groupByFechaPunto(detalles);
      const totalesIndex = this.indexTotalesPorGrupo(totales);

      const keys = new Set();
      gruposDetalles.forEach(g => keys.add(`${g.fecha}__${g.punto}`));
      for (const k of totalesIndex.keys()) keys.add(k);

      const groups = Array.from(keys).map(k => {
        const [fecha, punto] = k.split('__');
        const detGroup = gruposDetalles.find(g => `${g.fecha}__${g.punto}` === k);
        return { fecha, punto, items: detGroup ? detGroup.items : [] };
      });

      groups.sort((a,b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
        return this.normalizeText(a.punto) < this.normalizeText(b.punto) ? -1 : 1;
      });

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

      const filas = [];
      const totalOrder = this.getTotalOrder();
      const missingNotes = [];

      groups.forEach(g => {
        filas.push(headerHtml);

        (g.items || []).forEach(it => {
          const valor = Number(it.valor || 0);
          filas.push(`
            <tr>
              <td style="border:1px solid #000;">${Utils.escapeHtml(g.fecha)}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(g.punto)}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(it.tipo || '')}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(it.tercero || '')}</td>
              <td style="border:1px solid #000;">${Utils.escapeHtml(it.detalle || '')}</td>
              <td style="border:1px solid #000;text-align:right;font-weight:600;">${Utils.formatNumber(valor)}</td>
            </tr>
          `);
        });

        const key = `${g.fecha}__${g.punto}`;
        const m = totalesIndex.get(key) || new Map();

        const totalsReceived = Array.from(m.keys()).filter(k => k !== '__unmapped_total__').length;
        if (!totalsReceived) missingNotes.push(`${g.fecha} / ${g.punto}: NO llegaron filas de totales desde la nube`);

        totalOrder.forEach(t => {
          const found = m.get(t.key);
          const labelOut = (found && found.label) ? found.label : t.label;
          const valOut = found ? Number(found.valor || 0) : 0;
          if (!found) missingNotes.push(`${g.fecha} / ${g.punto}: falta "${t.label}" (se exporta 0)`);
          filas.push(totalRow(g.fecha, g.punto, labelOut, valOut));
        });
      });

      if (missingNotes.length) {
        console.warn('[TotalesExportHTML] Avisos:\n' + missingNotes.join('\n'));
        UI.reportStatus.textContent =
          'Aviso: faltan totales desde la nube (se exportaron como 0).';
      }

      const title = (CONFIG.REPORT_TITLE || 'Reporte').trim();
      const rangeLabel = (desde === hasta) ? `Fecha: ${desde}` : `Rango: ${desde} a ${hasta}`;
      const htmlDoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${Utils.escapeHtml(title)}</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;line-height:1.35;padding:12px;}
  h2{margin:0 0 6px 0;}
  .meta{color:#555;margin:0 0 12px 0;}
  table{border-collapse:collapse;width:100%;}
  th,td{padding:6px 8px;}
</style>
</head>
<body>
  <h2>${Utils.escapeHtml(title)}</h2>
  <div class="meta">${Utils.escapeHtml(rangeLabel)}</div>
  <table>
    <tbody>
      ${filas.join('')}
    </tbody>
  </table>
</body>
</html>`.trim();

      return { htmlDoc, detallesCount: detalles.length };
    },

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

    safeBaseFilename(){
      const base = (CONFIG.REPORT_TITLE || 'Reporte').trim() || 'Reporte';
      return base.replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g,'');
    },

    async exportarExcelDetalles(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      UI.reportStatus.textContent = 'Cargando detalles y totales desde la nube...';
      try{
        await this.ensureDataForRange(desde, hasta);

        const rows = this.getRowsFiltrados(desde, hasta);
        const { detalles, totales } = this.splitDetallesYTotales(rows);

        UI.reportStatus.textContent = `Recibido desde nube: ${detalles.length} detalles y ${totales.length} totales.`;

        if (!detalles.length){
          alert('No hay detalles para exportar en el rango seleccionado.');
          UI.reportStatus.textContent = 'Sin datos para exportar.';
          return;
        }

        await this.ensureExcelLibLoaded();
        if (!this.isExcelLibAvailable()){
          alert('No se pudo generar el archivo porque la librería de Excel no está disponible. Puedes descargar HTML.');
          this.updateExportButtonsVisibility();
          return;
        }

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;
        const ws = this.buildReporteWorksheet(desde, hasta);
        const wb = window.XLSX.utils.book_new();
        const sheetName = (CONFIG.REPORT_TITLE || 'Reporte').slice(0,31);
        window.XLSX.utils.book_append_sheet(wb, ws, sheetName);

        const baseName = this.safeBaseFilename();
        const filenameXlsx = `${baseName}_${rangeTxt}.xlsx`;
        window.XLSX.writeFile(wb, filenameXlsx, { bookType: 'xlsx', cellStyles: true });

        this.updateExportButtonsVisibility();

      }catch(e){
        console.error(e);
        UI.reportStatus.textContent = 'Error al exportar Excel.';
        alert('No se pudo exportar el Excel. Si el problema persiste, usa el botón HTML.');
        this.updateExportButtonsVisibility();
      }
    },

    async exportarHTMLDetalles(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      UI.reportStatus.textContent = 'Cargando detalles y totales desde la nube...';
      try{
        await this.ensureDataForRange(desde, hasta);

        const rows = this.getRowsFiltrados(desde, hasta);
        const { detalles, totales } = this.splitDetallesYTotales(rows);

        UI.reportStatus.textContent = `Recibido desde nube: ${detalles.length} detalles y ${totales.length} totales.`;

        if (!detalles.length){
          alert('No hay detalles para exportar en el rango seleccionado.');
          UI.reportStatus.textContent = 'Sin datos para exportar.';
          return;
        }

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;
        const { htmlDoc, detallesCount } = this.buildReporteHTMLString(desde, hasta);
        const blob = new Blob([htmlDoc], {type:'text/html;charset=utf-8;'});
        const baseName = this.safeBaseFilename();

        this.downloadBlob(blob, `${baseName}_${rangeTxt}.html`);
        UI.reportStatus.textContent = `HTML generado (${detallesCount} detalles).`;

      }catch(e){
        console.error(e);
        UI.reportStatus.textContent = 'Error al exportar HTML.';
        alert('No se pudo exportar el HTML.');
      }
    },

    // =========================================================
    // ✅ MODIFICADO: cargar DETALLES (action=details) + TOTALES (action=report)
    // =========================================================
    async ensureDataForRange(desde, hasta){
      const r = state.reporte.detallesRange || {};
      if (r.desde !== desde || r.hasta !== hasta || !Array.isArray(state.reporte.detalles)) {

        // 1) Detalles (sin totales)
        const detallesSrv = await Api.cargarDetallesDesdeServidor(desde, hasta);

        // 2) Totales (endpoint report)
        const urlTotales = `${CONFIG.SCRIPT_URL}?action=report&from=${encodeURIComponent(desde)}&to=${encodeURIComponent(hasta)}${
          CONFIG.API_KEY ? '&key='+encodeURIComponent(CONFIG.API_KEY) : ''
        }`;

        let totalesRaw = [];
        try{
          totalesRaw = await Api.fetchJson(
            urlTotales,
            { headers: { 'Accept': 'application/json' } },
            'Totales'
          );
        }catch(err){
          console.warn('[Totales] No se pudieron cargar desde la nube:', err);
          totalesRaw = [];
        }

        const totalesSrv = (totalesRaw || []).map(t => ({
          fecha: t.fecha || t.Fecha || '',
          punto:
            t.punto || t.puntoVenta || t.Punto || t.PuntoVenta ||
            t["Punto de venta"] || t["Punto"] || '',
          tipo: t.tipo || t.Tipo || t["Tipo"] || '',
          tercero: '',
          detalle: '',
          valor: Utils.safeNumber(t.valor ?? t.Valor ?? t["Valor"] ?? 0)
        })).filter(x => String(x.fecha||'').trim() && String(x.punto||'').trim() && String(x.tipo||'').trim());

        // 3) Unir para que splitDetallesYTotales() encuentre los totales
        state.reporte.detalles = [...(detallesSrv || []), ...totalesSrv];
        state.reporte.detallesRange = { desde, hasta };
        state.reporte.detallesSource = 'server';
      }
    }
  });
})(window.Arcadia);

