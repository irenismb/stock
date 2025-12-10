window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  const { CONFIG, Utils, UI, Api } = A;
  const ADMIN_PASS = A.ADMIN_PASS;

  const state = {
    session: { date: null, pos: null },
    reporte: {
      desde: null,
      hasta: null,
      detalles: [],
      detallesSource: 'server',
      detallesRange: { desde: null, hasta: null }
    },
    reportUnlocked: false
  };

  function normalizeText(s){
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  const App = {
    init(){
      this.populatePuntoVentaSelect();
      this.loadSession();
      this.bindNav();
      this.bindCaptureEvents();
      this.bindReportEvents();
      this.updateNetworkStatus();

      window.addEventListener('online', () => this.updateNetworkStatus());
      window.addEventListener('offline', () => this.updateNetworkStatus());

      const ayer = Utils.yesterdayISO();
      if (UI.fechaDesde) UI.fechaDesde.value = ayer;
      if (UI.fechaHasta) UI.fechaHasta.value = ayer;

      UI.resumeLastBtn.disabled = !(state.session.date && state.session.pos);

      if (UI.reportPass) UI.reportPass.value = '';

      UI.reportTableWrapper?.classList.add('hidden');
    },

    /* ---------- Helpers de reglas ---------- */
    requiresEmpresaForTipo(tipo){
      return (CONFIG.TIPOS_REQUIEREN_EMPRESA || []).includes(tipo);
    },
    disableTerceroForTipo(tipo){
      return (CONFIG.TIPOS_SIN_TERCERO || []).includes(tipo);
    },
    validateEmpresaGrupo(records){
      const faltantes = (records || []).filter(r =>
        this.requiresEmpresaForTipo(r.tipo) && !String(r.tercero || '').trim()
      );
      if (faltantes.length) {
        const tipos = Array.from(new Set(faltantes.map(f => f.tipo)));
        alert(
          'Debes seleccionar el Tercero (empresa del grupo) para estos conceptos antes de enviar:\n\n' +
          tipos.map(t => `- ${t}`).join('\n')
        );
        return false;
      }
      return true;
    },

    /* ---------- Navegación ---------- */
    bindNav(){
      UI.goReportBtn.addEventListener('click', () => {
        this.showSection('report');
        if (!state.reportUnlocked) {
          UI.reportGate.classList.remove('hidden');
          UI.reportControls.classList.add('hidden');
          if (UI.reportPass) UI.reportPass.value = '';
        }
      });

      UI.goCaptureBtn.addEventListener('click', () => this.showSection('capture'));
      UI.backHome1.addEventListener('click', () => this.showSection('home'));
      UI.backHome2.addEventListener('click', () => this.showSection('home'));

      UI.resumeLastBtn.addEventListener('click', () => {
        if(state.session.date && state.session.pos){
          this.showSection('capture');
          this.startSession(state.session.date, state.session.pos, true);
          UI.resumeHint.style.display = '';
        }
      });
    },

    showSection(name){
      UI.home.classList.toggle('hidden', name!=='home');
      UI.capture.classList.toggle('hidden', name!=='capture');
      UI.report.classList.toggle('hidden', name!=='report');

      if(name==='capture' && !(state.session.date && state.session.pos)){
        UI.fechaInput.value = Utils.yesterdayISO();
      }

      if(name==='report'){
        UI.reportTag.textContent = 'Reporte';
        UI.reportTableWrapper?.classList.add('hidden');
        if (!state.reportUnlocked) {
          UI.reportGate.classList.remove('hidden');
          UI.reportControls.classList.add('hidden');
          if (UI.reportPass) UI.reportPass.value = '';
        } else {
          this.updateExportButtonsVisibility();
        }
      }
    },

    /* ---------- Captura ---------- */
    populatePuntoVentaSelect(){
      const select = UI.puntoVentaInput;
      select.innerHTML = '<option value="">Seleccione...</option>';
      CONFIG.PUNTOS_VENTA.forEach(pv => {
        select.innerHTML += `<option value="${pv}">${pv}</option>`;
      });
    },

    bindCaptureEvents(){
      document.getElementById('start-session-btn').addEventListener('click', () => {
        const fecha = UI.fechaInput.value;
        const puntoVenta = UI.puntoVentaInput.value;

        if (!fecha || !puntoVenta) {
          alert('Por favor, seleccione fecha y punto de venta.');
          return;
        }

        const ayer = Utils.yesterdayISO();
        if (fecha !== ayer && !confirm(`Vas a abrir la sesión para ${fecha} (no es el día anterior: ${ayer}). ¿Continuar?`)) {
          return;
        }

        const prevKey = this.getStorageKey();
        if (prevKey && localStorage.getItem(prevKey)) {
          if (!confirm('Hay datos locales de la sesión anterior. Si cambias de sesión podrían perderse. ¿Continuar?')) {
            return;
          }
        }

        this.startSession(fecha, puntoVenta);
      });

      document.getElementById('add-nomina-btn')
        .addEventListener('click', () =>
          this.addRow({
            tipo: 'Ventas a crédito (descuentos por nómina)',
            category: 'credito',
            isRemovable: true,
            styleHint: 'credito-nomina'
          })
        );

      document.getElementById('add-formulas-btn')
        .addEventListener('click', () =>
          this.addRow({
            tipo: 'Ventas a crédito (fórmulas)',
            category: 'credito',
            isRemovable: true,
            styleHint: 'credito-formulas'
          })
        );

      document.getElementById('add-kardex-btn')
        .addEventListener('click', () =>
          this.addRow({
            tipo: 'Faltantes en kardex (descuentos por nomina)',
            category: 'credito',
            isRemovable: true,
            styleHint: 'credito-nomina'
          })
        );

      document.getElementById('add-gasto-btn')
        .addEventListener('click', () =>
          this.addRow({
            tipo: 'Gasto en efectivo',
            category: 'gasto',
            isRemovable: true,
            styleHint: 'gasto'
          })
        );

      document.getElementById('add-interco-btn')
        .addEventListener('click', () =>
          this.addRow({
            tipo: 'Ventas a crédito a empresas del grupo',
            category: 'credito',
            isRemovable: true,
            styleHint: 'interco'
          })
        );

      UI.recordsBody.addEventListener('input', (e) => this.handleTableInput(e));
      // ✅ asegura guardado del select de Tercero
      UI.recordsBody.addEventListener('change', (e) => this.handleTableInput(e));
      UI.recordsBody.addEventListener('click', (e) => this.handleTableClick(e));

      document.getElementById('sendAllBtn').addEventListener('click', () => this.handleSendAll());
      document.getElementById('clearAllBtn').addEventListener('click', () => this.handleClearAll());
    },

    handleTableInput(e){
      const target = e.target;
      if (!target.classList.contains('table-input')) return;

      const field = target.dataset.field;
      if (field !== 'valor' && field !== 'devoluciones' && field !== 'tercero' && field !== 'detalle') return;

      const tr = target.closest('tr');
      if (!tr) return;

      if (field === 'valor' || field === 'devoluciones') {
        const val = Utils.safeNumber(tr.querySelector('[data-field="valor"]').value);
        const dev = Utils.safeNumber(tr.querySelector('[data-field="devoluciones"]').value);
        const total = val - dev;
        const totalCell = tr.querySelector('.col-total');
        if (totalCell) totalCell.textContent = Utils.formatCurrency(total);
        this.updateTotalsDisplay();
      }

      this.saveRecords();
    },

    handleTableClick(e){
      const btn = e.target.closest('button');
      if (!btn) return;

      if (btn.dataset.action === 'delete') {
        const tr = btn.closest('tr');
        if (tr && confirm('¿Eliminar fila?')) {
          tr.remove();
          this.updateTotalsDisplay();
          this.saveRecords();
        }
      }
    },

    startSession(date, pos, fromStorage = false){
      state.session.date = date;
      state.session.pos = pos;

      this.saveSession();

      UI.sessionDate.textContent = date;
      UI.sessionPos.textContent = pos;

      document.getElementById('session-setup-fields').classList.add('hidden');
      UI.sessionInfo.classList.remove('hidden');

      const key = this.getStorageKey();
      if (fromStorage) {
        this.loadRecords();
      } else {
        if (key && localStorage.getItem(key)) {
          const reanudar = confirm(
            'Ya existen datos guardados localmente para esta fecha y punto.\n' +
            '¿Deseas reanudarlos en lugar de iniciar desde cero?'
          );
          if (reanudar) {
            this.loadRecords();
          } else {
            localStorage.removeItem(key);
            this.createInitialRows();
            this.saveRecords();
          }
        } else {
          this.createInitialRows();
          this.saveRecords();
        }
      }

      this.updateTotalsDisplay();
    },

    createInitialRows(){
      UI.recordsBody.innerHTML = '';
      const initialData = [
        { tipo: 'Efectivo POS del comprobante diario', category: 'efectivo', styleHint: 'efectivo' },
        { tipo: 'Ventas con QR', category: 'electronica', styleHint: 'electronica' },
        { tipo: 'Ventas con tarjeta debito', category: 'electronica', styleHint: 'electronica' },
        { tipo: 'Ventas con tarjeta credito', category: 'electronica', styleHint: 'electronica' },
      ];
      initialData.forEach(data => this.addRow(data, true));
      this.saveRecords();
    },

    addRow(data = {}, skipSave = false){
      const defaults = {
        id: Utils.uuidv4(),
        tipo: '',
        valor: 0,
        devoluciones: 0,
        tercero: '',
        detalle: '',
        isRemovable: false,
        category: 'default',
        styleHint: 'electronica'
      };
      const record = { ...defaults, ...data };

      const tr = document.createElement('tr');
      tr.dataset.id = record.id;
      tr.dataset.category = record.category;
      tr.dataset.styleHint = record.styleHint;
      tr.classList.add(`row-style-${record.styleHint}`);

      const total = Utils.safeNumber(record.valor) - Utils.safeNumber(record.devoluciones);

      const requiereEmpresa = this.requiresEmpresaForTipo(record.tipo);
      const terceroDisabled = this.disableTerceroForTipo(record.tipo);

      let terceroCellHtml = `<input type="text" class="table-input" data-field="tercero" value="${record.tercero || ''}">`;

      if (requiereEmpresa) {
        const optionsHtml = CONFIG.EMPRESAS_GRUPO
          .map(empresa => `<option value="${empresa}" ${record.tercero === empresa ? 'selected' : ''}>${empresa}</option>`)
          .join('');

        terceroCellHtml = `
          <select class="table-input" data-field="tercero">
            <option value="">Seleccione empresa del grupo...</option>
            ${optionsHtml}
          </select>
        `;
      } else if (terceroDisabled) {
        terceroCellHtml = `
          <input
            type="text"
            class="table-input"
            data-field="tercero"
            value=""
            placeholder="No aplica"
            disabled
          >
        `;
      }

      tr.innerHTML = `
        <td class="truncate" title="${Utils.escapeHtml(record.tipo)}">${Utils.escapeHtml(record.tipo)}</td>
        <td class="col-number"><input type="text" inputmode="decimal" class="table-input" data-field="valor" value="${record.valor || ''}" placeholder="0"></td>
        <td class="col-number"><input type="text" inputmode="decimal" class="table-input" data-field="devoluciones" value="${record.devoluciones || ''}" placeholder="0"></td>
        <td class="col-total" data-field="total">${Utils.formatCurrency(total)}</td>
        <td>${terceroCellHtml}</td>
        <td><input type="text" class="table-input" data-field="detalle" value="${record.detalle || ''}"></td>
        <td class="col-action">${record.isRemovable ? '<button class="btn btn-danger btn-small" data-action="delete">Borrar</button>' : ''}</td>
      `;

      UI.recordsBody.appendChild(tr);

      const firstInput = tr.querySelector('[data-field="valor"]');
      if (firstInput) firstInput.focus();

      if (!skipSave) {
        this.saveRecords();
        this.updateTotalsDisplay();
      }

      return tr;
    },

    getCalculatedState(){
      let efectivo = 0, electronica = 0, credito = 0, gasto = 0;

      UI.recordsBody.querySelectorAll('tr[data-id]').forEach(tr => {
        const valor = Utils.safeNumber(tr.querySelector('[data-field="valor"]').value);
        const devoluciones = Utils.safeNumber(tr.querySelector('[data-field="devoluciones"]').value);
        const currentTotal = valor - devoluciones;

        tr.querySelector('[data-field="total"]').textContent = Utils.formatCurrency(currentTotal);

        const category = tr.dataset.category;
        switch (category) {
          case 'efectivo': efectivo += currentTotal; break;
          case 'electronica': electronica += currentTotal; break;
          case 'credito': credito += currentTotal; break;
          case 'gasto': gasto += currentTotal; break;
        }
      });

      const ventasNetoEfectivo = efectivo - credito;
      const ventasElectronicas = electronica;
      const ventasCredito      = credito;
      const ventasGlobal       = ventasNetoEfectivo + ventasElectronicas + ventasCredito;
      const gastosEfectivo     = gasto;
      const esperadoTesoreria  = ventasNetoEfectivo - gastosEfectivo;

      return {
        summary: {
          ventasNetoEfectivo,
          ventasElectronicas,
          ventasCredito,
          gastosEfectivo,
          ventasGlobal,
          esperadoTesoreria
        }
      };
    },

    updateTotalsDisplay(){
      const s = this.getCalculatedState().summary;

      UI.recordsFooter.querySelector('[data-summary-id="total_ventas_efectivo"] .col-total')
        .textContent = Utils.formatCurrency(s.ventasNetoEfectivo);
      UI.recordsFooter.querySelector('[data-summary-id="total_ventas_electronicas"] .col-total')
        .textContent = Utils.formatCurrency(s.ventasElectronicas);
      UI.recordsFooter.querySelector('[data-summary-id="total_ventas_credito"] .col-total')
        .textContent = Utils.formatCurrency(s.ventasCredito);
      UI.recordsFooter.querySelector('[data-summary-id="total_gastos_efectivo"] .col-total')
        .textContent = Utils.formatCurrency(s.gastosEfectivo);
      UI.recordsFooter.querySelector('[data-summary-id="total_ventas_global"] .col-total')
        .textContent = Utils.formatCurrency(s.ventasGlobal);
      UI.recordsFooter.querySelector('[data-summary-id="total_esperado_tesoreria"] .col-total')
        .textContent = Utils.formatCurrency(s.esperadoTesoreria);
    },

    getRecordsFromTable(){
      const records = [];

      UI.recordsBody.querySelectorAll('tr[data-id]').forEach(tr => {
        const valor = Utils.safeNumber(tr.querySelector('[data-field="valor"]').value);
        const devoluciones = Utils.safeNumber(tr.querySelector('[data-field="devoluciones"]').value);

        if (valor !== 0 || devoluciones !== 0) {
          records.push({
            id: tr.dataset.id,
            tipo: tr.cells[0].textContent,
            valor,
            devoluciones,
            total: valor - devoluciones,
            tercero: tr.querySelector('[data-field="tercero"]').value,
            detalle: tr.querySelector('[data-field="detalle"]').value,
            category: tr.dataset.category,
          });
        }
      });

      return records;
    },

    async handleSendAll(){
      const records = this.getRecordsFromTable();

      if (records.length === 0) {
        alert('No hay registros con valores para guardar.');
        return;
      }

      if (!this.validateEmpresaGrupo(records)) return;

      const btn = document.getElementById('sendAllBtn');
      btn.disabled = true;
      btn.textContent = 'Guardando...';

      /*
        ✅ Nuevo formato para hoja:
        - Guardar VALOR ya neto (valor - devoluciones)
        - Usar Tercero como campo final
        - No enviar devoluciones ni total
      */
      const detailData = records.map(r => {
        const neto = Number(r.total || 0);
        return {
          fecha: state.session.date,
          puntoVenta: state.session.pos,
          tipo: r.tipo,
          tercero: r.tercero,
          Tercero: r.tercero, // ✅ nombre esperado en hoja
          detalle: r.detalle,
          valor: neto
        };
      });

      const dataToSend = [...detailData];

      try{
        const url = CONFIG.SCRIPT_URL + (CONFIG.API_KEY ? ('?key='+encodeURIComponent(CONFIG.API_KEY)) : '');
        const response = await fetch(url, {
          method:'POST',
          body: JSON.stringify(dataToSend),
          headers:{'Content-Type':'text/plain;charset=utf-8'}
        });

        const text = await response.text();
        let result;

        try {
          result = JSON.parse(text);
        } catch {
          throw new Error('Respuesta no válida del servidor.');
        }

        if (!response.ok || result.result !== 'success') {
          throw new Error(result.error || `Error del servidor (HTTP ${response.status}).`);
        }

        alert('¡Registros guardados con éxito!');
        btn.textContent = '✔️ Guardado';
      }catch(error){
        console.error("Error al enviar datos:", error);
        alert('Error: No se pudieron guardar los registros.');
        btn.disabled = false;
        btn.textContent = '📤 Guardar Todo en la Nube';
      }
    },

    handleClearAll(){
      if(confirm('¿Finalizar el reporte? Se limpiarán todos los registros y la sesión.')) {
        localStorage.removeItem(this.getStorageKey());
        localStorage.removeItem(CONFIG.LS_SESSION_KEY);
        location.reload();
      }
    },

    updateNetworkStatus(){
      const online = navigator.onLine;
      UI.networkStatus?.classList.toggle('status-online', online);
      UI.networkStatus?.classList.toggle('status-offline', !online);
      if (UI.networkStatus) UI.networkStatus.textContent = online ? 'Online' : 'Offline';
    },

    getStorageKey(){
      if (!state.session.date || !state.session.pos) return null;
      return `${CONFIG.LS_RECORDS_KEY}_${state.session.date}_${state.session.pos}`;
    },

    saveSession(){
      localStorage.setItem(CONFIG.LS_SESSION_KEY, JSON.stringify(state.session));
    },

    loadSession(){
      state.session = JSON.parse(localStorage.getItem(CONFIG.LS_SESSION_KEY)) || { date: null, pos: null };
    },

    saveRecords(){
      const key = this.getStorageKey();
      if (!key) return;

      const records = [];
      UI.recordsBody.querySelectorAll('tr[data-id]').forEach(tr => {
        records.push({
          id: tr.dataset.id,
          tipo: tr.cells[0].textContent,
          valor: tr.querySelector('[data-field="valor"]').value,
          devoluciones: tr.querySelector('[data-field="devoluciones"]').value,
          tercero: tr.querySelector('[data-field="tercero"]').value,
          detalle: tr.querySelector('[data-field="detalle"]').value,
          category: tr.dataset.category,
          styleHint: tr.dataset.styleHint,
          isRemovable: !!tr.querySelector('[data-action="delete"]'),
        });
      });

      localStorage.setItem(key, JSON.stringify(records));
    },

    loadRecords(){
      const key = this.getStorageKey();
      if (!key) return;

      const savedRecords = JSON.parse(localStorage.getItem(key)) || [];
      UI.recordsBody.innerHTML = '';

      if (savedRecords.length > 0) {
        savedRecords.forEach(rec => this.addRow(rec, true));
      } else {
        this.createInitialRows();
      }
    },

    /* ---------- Reporte (protegido y simplificado) ---------- */
    bindReportEvents(){
      UI.btnGateOpen.addEventListener('click', () => {
        const pass = (UI.reportPass.value || '').trim();
        if(!pass){ alert('Ingresa la clave.'); return; }
        if(pass !== ADMIN_PASS){ alert('Clave incorrecta.'); return; }

        state.reportUnlocked = true;
        UI.reportGate.classList.add('hidden');
        UI.reportControls.classList.remove('hidden');

        this.toggleExportButtons(true);
        this.updateExportButtonsVisibility();

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

    updateExportButtonsVisibility(){
      const xlsxSupported = !!(window.XLSX && window.XLSX.utils);
      if (xlsxSupported) {
        UI.btnExportarHTML?.classList.add('hidden');
      } else {
        UI.btnExportarHTML?.classList.remove('hidden');
      }
    },

    /* =========================================================
       ✅ NUEVO FORMATO DE REPORTE
       Columnas finales:
       Fecha | Punto | Tipo | Tercero | Detalle | Valor
       - Valor ya viene neto desde la hoja
       - No se incluye Devoluciones ni Total
       - Se mantienen totales por bloque (si no son cero)
       ========================================================= */

    getDetallesFiltrados(desde, hasta){
      const all = state.reporte.detalles || [];
      return all.filter(r => {
        const f = r.fecha || '';
        const p = r.punto || '';
        const tipo = String(r.tipo || '');
        if (!f || !p || !tipo) return false;
        if (f < desde || f > hasta) return false;
        if (tipo.startsWith('Total ')) return false;
        return true;
      });
    },

    sortDetallesParaExport(rows){
      const order = CONFIG.EXPORT_TIPO_ORDER || [];
      const idx = new Map(order.map((t,i)=>[t,i]));
      return [...rows].sort((a,b) => {
        const ia = idx.has(a.tipo) ? idx.get(a.tipo) : 9999;
        const ib = idx.has(b.tipo) ? idx.get(b.tipo) : 9999;
        if (ia !== ib) return ia - ib;
        const ta = normalizeText(a.tipo);
        const tb = normalizeText(b.tipo);
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        return 0;
      });
    },

    groupByFechaPunto(rows){
      const map = new Map();
      rows.forEach(r => {
        const key = `${r.fecha}__${r.punto}`;
        if (!map.has(key)) map.set(key, { fecha: r.fecha, punto: r.punto, items: [] });
        map.get(key).items.push(r);
      });

      const groups = Array.from(map.values());
      groups.sort((a,b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
        return normalizeText(a.punto) < normalizeText(b.punto) ? -1 : 1;
      });

      groups.forEach(g => g.items = this.sortDetallesParaExport(g.items));
      return groups;
    },

    buildReporteWorksheet(desde, hasta){
      const detalles = this.getDetallesFiltrados(desde, hasta);
      const groups = this.groupByFechaPunto(detalles);

      const HEADERS = [
        'Fecha',
        'Punto',
        'Tipo',
        'Tercero',
        'Detalle',
        'Valor'
      ];

      const thin = { style: 'thin', color: { rgb: '000000' } };
      const baseBorder = { top: thin, bottom: thin, left: thin, right: thin };

      const styles = {
        header: {
          font: { bold: true, color: { rgb: '000000' } },
          fill: { patternType: 'solid', fgColor: { rgb: 'E8F0FE' } },
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
          .map(t => `SUMIFS(${valorRange},${tipoRange},"${safeExcelStr(t)}")`)
          .join('+');
      };

      const sumByTipos = (items, tipos) => {
        const set = new Set(tipos || []);
        return (items || []).reduce((acc, it) => {
          if (!set.has(it.tipo)) return acc;
          const v = Number(it.valor || 0);
          return acc + v;
        }, 0);
      };

      const aoa = [];
      let rowCursor = 0;
      const originRow = 2; // Encabezado inicial en fila 2

      const addRow = (cells) => {
        aoa.push(cells);
        rowCursor++;
      };

      groups.forEach(group => {
        const { fecha, punto, items } = group;
        if (!items.length) return;

        // Encabezado del bloque
        addRow(headerRow());
        const excelHeaderRow = originRow + (rowCursor - 1);

        // Detalle
        const firstDetailExcelRow = excelHeaderRow + 1;

        items.forEach((r) => {
          addRow([
            { v: fecha, t: 's', s: styles.cell },
            { v: punto, t: 's', s: styles.cell },
            { v: r.tipo || '', t: 's', s: styles.cell },
            { v: r.tercero || '', t: 's', s: styles.cell },
            { v: r.detalle || '', t: 's', s: styles.cell },
            { v: Number(r.valor || 0), t: 'n', s: styles.number }
          ]);
        });

        const lastDetailExcelRow = firstDetailExcelRow + items.length - 1;

        // Con origin B2:
        // B Fecha, C Punto, D Tipo, E Tercero, F Detalle, G Valor
        const tipoRange  = `$D$${firstDetailExcelRow}:$D$${lastDetailExcelRow}`;
        const valorRange = `$G$${firstDetailExcelRow}:$G$${lastDetailExcelRow}`;

        const creditoTypes     = CONFIG.TIPOS_REQUIEREN_EMPRESA || [];
        const efectivoTypes    = CONFIG.TIPOS_EFECTIVO || [];
        const electronicaTypes = CONFIG.TIPOS_ELECTRONICOS || [];
        const gastoTypes       = CONFIG.TIPOS_GASTO || [];

        const fCredito     = sumifsFormula(valorRange, tipoRange, creditoTypes);
        const fEfectivo    = sumifsFormula(valorRange, tipoRange, efectivoTypes);
        const fElectronica = sumifsFormula(valorRange, tipoRange, electronicaTypes);
        const fGasto       = sumifsFormula(valorRange, tipoRange, gastoTypes);

        // Valores numéricos para decidir si se muestran totales
        const creditoVal     = sumByTipos(items, creditoTypes);
        const efectivoBruto  = sumByTipos(items, efectivoTypes);
        const electronicaVal = sumByTipos(items, electronicaTypes);
        const gastoVal       = sumByTipos(items, gastoTypes);

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

        // Totales (solo si el valor esperado no es 0)
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

      const ws = XLSX.utils.aoa_to_sheet([]);
      XLSX.utils.sheet_add_aoa(ws, aoa, { origin: 'B2' });

      // ✅ Inmoviliza la fila 2
      ws['!freeze'] = {
        xSplit: 0,
        ySplit: 2,
        topLeftCell: 'A3',
        activePane: 'bottomLeft',
        state: 'frozen'
      };

      // Anchos aproximados (A es “columna fantasma” por origin B)
      ws['!cols'] = [
        { wch: 6 },   // A
        { wch: 12 },  // B Fecha
        { wch: 14 },  // C Punto
        { wch: 40 },  // D Tipo
        { wch: 28 },  // E Tercero
        { wch: 32 },  // F Detalle
        { wch: 14 }   // G Valor
      ];

      return ws;
    },

    /* =========================
       ✅ HTML base para reporte
       (reutilizado por HTML y por XLS fallback)
       ========================= */
    buildReporteHtmlDocument(detalles){
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
        const set = new Set(tipos || []);
        return (items || []).reduce((acc, it) => {
          if (!set.has(it.tipo)) return acc;
          const v = Number(it.valor || 0);
          return acc + v;
        }, 0);
      };

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

      groups.forEach(g => {
        const items = g.items || [];
        if (!items.length) return;

        filas.push(headerHtml);

        items.forEach(it => {
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

        const creditoTypes     = CONFIG.TIPOS_REQUIEREN_EMPRESA || [];
        const efectivoTypes    = CONFIG.TIPOS_EFECTIVO || [];
        const electronicaTypes = CONFIG.TIPOS_ELECTRONICOS || [];
        const gastoTypes       = CONFIG.TIPOS_GASTO || [];

        const creditoVal     = sumByTipos(items, creditoTypes);
        const efectivoBruto  = sumByTipos(items, efectivoTypes);
        const electronicaVal = sumByTipos(items, electronicaTypes);
        const gastoVal       = sumByTipos(items, gastoTypes);

        const efectivoNetoVal = efectivoBruto - creditoVal;
        const totalVentasVal  = efectivoNetoVal + electronicaVal + creditoVal;
        const tesoreriaVal    = efectivoNetoVal - gastoVal;

        if (efectivoNetoVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total ventas en efectivo', efectivoNetoVal));
        if (electronicaVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total ventas por medios electronicos', electronicaVal));
        if (creditoVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total ventas a credito', creditoVal));
        if (totalVentasVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total ventas', totalVentasVal));
        if (gastoVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total gastos en efectivo', gastoVal));
        if (tesoreriaVal !== 0) filas.push(totalRow(g.fecha, g.punto, 'Total dinero a recibir por tesoreria', tesoreriaVal));
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

      return htmlDoc;
    },

    /* =========================
       ✅ Exportar Excel (.xls)
       - Si XLSX existe: genera .xls real via SheetJS
       - Si NO existe: genera .xls basado en HTML
       ========================= */
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

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;

        // ✅ Ruta 1: con librería XLSX disponible
        if (window.XLSX && window.XLSX.utils) {
          const ws = this.buildReporteWorksheet(desde, hasta);
          const wb = window.XLSX.utils.book_new();
          window.XLSX.utils.book_append_sheet(wb, ws, 'Reporte');

          const filename = `reporte_${rangeTxt}.xls`;
          window.XLSX.writeFile(wb, filename, { bookType: 'xls', cellStyles: true });

          UI.reportStatus.textContent = `Excel generado con formato de reporte (${detalles.length} detalles).`;
          return;
        }

        // ✅ Ruta 2 (importantísima): sin librería, igual generar .xls
        await this.exportarXlsFallback(desde, hasta, detalles, rangeTxt);

      }catch(e){
        console.error(e);
        UI.reportStatus.textContent = 'Error al exportar detalles.';
        alert('No se pudo exportar el reporte.');
      }
    },

    async exportarXlsFallback(desde, hasta, detalles, rangeTxt){
      // Si no vienen detalles precargados por alguna razón, calcula aquí
      const detallesOk = Array.isArray(detalles) && detalles.length
        ? detalles
        : this.getDetallesFiltrados(desde, hasta);

      if (!detallesOk.length){
        alert('No hay detalles para exportar en el rango seleccionado.');
        UI.reportStatus.textContent = 'Sin datos para exportar.';
        return;
      }

      const htmlDoc = this.buildReporteHtmlDocument(detallesOk);

      // Truco clásico: Excel abre HTML con extensión .xls
      const blob = new Blob(
        ['\ufeff', htmlDoc],
        { type: 'application/vnd.ms-excel;charset=utf-8;' }
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte_${rangeTxt}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      UI.reportStatus.textContent =
        `XLS generado en modo compatibilidad (${detallesOk.length} detalles).`;
    },

    /* =========================
       ✅ Exportar HTML puro
       ========================= */
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
        const htmlDoc = this.buildReporteHtmlDocument(detalles);

        const blob = new Blob([htmlDoc], {type:'text/html;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${rangeTxt}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        UI.reportStatus.textContent = `HTML generado con formato de reporte (${detalles.length} detalles).`;

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
        state.reporte.detalles = detallesSrv || [];
        state.reporte.detallesRange = { desde, hasta };
        state.reporte.detallesSource = 'server';
      }
    }
  };

  A.App = App;
  A.state = state;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(window.Arcadia);

