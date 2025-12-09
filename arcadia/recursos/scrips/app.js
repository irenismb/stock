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

      // Asegura que el campo de clave no tenga valor residual
      if (UI.reportPass) UI.reportPass.value = '';

      // Oculta visualización del reporte por requerimiento
      UI.reportTableWrapper?.classList.add('hidden');
    },

    /* ---------- Helpers de reglas ---------- */
    requiresEmpresaForTipo(tipo){
      return (CONFIG.TIPOS_REQUIEREN_EMPRESA || []).includes(tipo);
    },

    // ✅ Nuevo: tipos donde el campo Tercero/Destino NO aplica
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
          'Debes seleccionar el Nombre de la empresa del grupo para estos conceptos antes de enviar:\n\n' +
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
      CONFIG.PUNTOS_VENTA.forEach(pv => { select.innerHTML += `<option value="${pv}">${pv}</option>`; });
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
        // ✅ Desactiva el campo para los tipos definidos en CONFIG.TIPOS_SIN_TERCERO
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

      // ✅ Solo detalles (se eliminan totales enviados a la hoja)
      const detailData = records.map(r => {
        const empresaGrupoVal = this.requiresEmpresaForTipo(r.tipo) ? (r.tercero || '') : '';
        return {
          fecha: state.session.date,
          puntoVenta: state.session.pos,
          tipo: r.tipo,
          tercero: r.tercero,
          detalle: r.detalle,
          valor: r.valor,
          devoluciones: r.devoluciones,
          total: r.total,
          empresaGrupo: empresaGrupoVal,
          "Nombre de la empresa del grupo": empresaGrupoVal
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
      // Si hay soporte XLSX: ocultar HTML
      if (xlsxSupported) {
        UI.btnExportarHTML?.classList.add('hidden');
      } else {
        // Sin XLSX: se mantiene HTML como respaldo
        UI.btnExportarHTML?.classList.remove('hidden');
      }
    },

    buildDetallesPlano(desde, hasta){
      const all = state.reporte.detalles || [];
      const rows = all.filter(r => {
        const f = r.fecha || '';
        const tipo = String(r.tipo || '');
        return (f >= desde && f <= hasta) && !tipo.startsWith('Total ');
      });

      return rows.map(r => {
        const valor = Number(r.valor) || 0;
        const devol = Number(r.devoluciones) || 0;
        const total = (r.total !== undefined && r.total !== null && r.total !== '')
          ? Number(r.total)
          : (valor - devol);

        return {
          Fecha: r.fecha || '',
          Punto: r.punto || r.puntoVenta || '',
          Tipo: r.tipo || '',
          Tercero: r.tercero || '',
          Detalle: r.detalle || '',
          Valor: Math.round(valor),
          Devoluciones: Math.round(devol),
          Total: Math.round(total)
        };
      });
    },

    async exportarExcelDetalles(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;

      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      UI.reportStatus.textContent = 'Cargando detalles del servidor...';

      try{
        await this.ensureDataForRange(desde, hasta);
        const data = this.buildDetallesPlano(desde, hasta);

        if (!data.length){
          alert('No hay detalles para exportar en el rango seleccionado.');
          UI.reportStatus.textContent = 'Sin datos para exportar.';
          return;
        }

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;

        // ✅ Intento XLSX con SheetJS
        if (window.XLSX && window.XLSX.utils) {
          const ws = window.XLSX.utils.json_to_sheet(data, { skipHeader: false });
          const wb = window.XLSX.utils.book_new();
          window.XLSX.utils.book_append_sheet(wb, ws, 'Detalles');
          const filename = `reporte_detalles_${rangeTxt}.xlsx`;
          window.XLSX.writeFile(wb, filename);
          UI.reportStatus.textContent = `Excel XLSX generado (${data.length} filas).`;
          return;
        }

        // ⛑️ Fallback XLS (HTML -> Excel)
        const th = `
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Fecha</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Punto</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Tipo</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Tercero</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Detalle</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Valor</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Devoluciones</th>
          <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Total</th>
        `;

        const filasHtml = data.map(r => `
          <tr>
            <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.Fecha)}</td>
            <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.Punto)}</td>
            <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.Tipo)}</td>
            <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.Tercero)}</td>
            <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.Detalle)}</td>
            <td style="border:1px solid #ddd; mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${r.Valor}</td>
            <td style="border:1px solid #ddd; mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${r.Devoluciones}</td>
            <td style="border:1px solid #ddd; mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${r.Total}</td>
          </tr>
        `).join('');

        const htmlDoc = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office"
                xmlns:x="urn:schemas-microsoft-com:office:excel"
                xmlns="http://www.w3.org/TR/REC-html40">
          <head><meta charset="UTF-8"></head>
          <body>
            <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse; width:100%;">
              <thead><tr>${th}</tr></thead>
              <tbody>${filasHtml}</tbody>
            </table>
          </body></html>
        `.trim();

        const blob = new Blob([htmlDoc], {type: 'application/vnd.ms-excel;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_detalles_${rangeTxt}.xls`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        // Habilita HTML como respaldo visible si no hay XLSX
        this.updateExportButtonsVisibility();
        UI.reportStatus.textContent = `Excel XLS generado (${data.length} filas).`;
      }catch(e){
        console.error(e);
        UI.reportStatus.textContent = 'Error al exportar detalles.';
        alert('No se pudo exportar el reporte.');
      }
    },

    async exportarHTMLDetalles(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;

      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      UI.reportStatus.textContent = 'Cargando detalles del servidor...';

      try{
        await this.ensureDataForRange(desde, hasta);
        const data = this.buildDetallesPlano(desde, hasta);

        if (!data.length){
          alert('No hay detalles para exportar en el rango seleccionado.');
          UI.reportStatus.textContent = 'Sin datos para exportar.';
          return;
        }

        const rangeTxt = (desde===hasta) ? desde : `${desde}_${hasta}`;
        const th = `<th>Fecha</th><th>Punto</th><th>Tipo</th><th>Tercero</th><th>Detalle</th><th>Valor</th><th>Devoluciones</th><th>Total</th>`;

        const filasHtml = data.map(r => `
          <tr>
            <td>${Utils.escapeHtml(r.Fecha)}</td>
            <td>${Utils.escapeHtml(r.Punto)}</td>
            <td>${Utils.escapeHtml(r.Tipo)}</td>
            <td>${Utils.escapeHtml(r.Tercero)}</td>
            <td>${Utils.escapeHtml(r.Detalle)}</td>
            <td style="text-align:right;">${Utils.formatNumber(r.Valor)}</td>
            <td style="text-align:right;">${Utils.formatNumber(r.Devoluciones)}</td>
            <td style="text-align:right;"><strong>${Utils.formatNumber(r.Total)}</strong></td>
          </tr>
        `).join('');

        const htmlDoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Detalles</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;line-height:1.35;padding:12px;}
  table{border-collapse:collapse;width:100%;}
  th,td{border:1px solid #ddd;padding:6px 8px;}
  thead th{background:#e8f0fe;}
</style>
</head>
<body>
  <table>
    <thead><tr>${th}</tr></thead>
    <tbody>${filasHtml}</tbody>
  </table>
</body>
</html>`.trim();

        const blob = new Blob([htmlDoc], {type:'text/html;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_detalles_${rangeTxt}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        UI.reportStatus.textContent = `HTML generado (${data.length} filas).`;
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

