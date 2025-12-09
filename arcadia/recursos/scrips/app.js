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
      tipo: 'totales',
      matriz: null,
      detalles: [],
      detallesSource: 'server',
      cursor: { puntosConDatos: [], puntoIndex: 0, currentPuntoFilter: null },
      detallesRange: { desde: null, hasta: null },
      totalesRange: { desde: null, hasta: null }
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
      this.populatePuntoEnviarSelect();
      this.loadSession();
      this.bindNav();
      this.bindCaptureEvents();
      this.bindReportEvents();
      this.bindReportNavEvents();
      this.updateNetworkStatus();

      window.addEventListener('online', () => this.updateNetworkStatus());
      window.addEventListener('offline', () => this.updateNetworkStatus());

      const ayer = Utils.yesterdayISO();
      UI.fechaDesde.value = ayer;
      UI.fechaHasta.value = ayer;

      UI.resumeLastBtn.disabled = !(state.session.date && state.session.pos);
      setDetallesOptionLabel();
    },

    /* ---------- Helpers de reglas ---------- */
    requiresEmpresaForTipo(tipo){
      return (CONFIG.TIPOS_REQUIEREN_EMPRESA || []).includes(tipo);
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
        } else {
          this.updateReportNavBar();
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
      if(name==='report' && !state.reportUnlocked){
        UI.reportGate.classList.remove('hidden');
        UI.reportControls.classList.add('hidden');
      }
      if(name==='report'){
        this.updateReportNavBar();
        setDetallesOptionLabel();
      }
    },

    /* ---------- Captura ---------- */
    populatePuntoVentaSelect(){
      const select = UI.puntoVentaInput;
      select.innerHTML = '<option value="">Seleccione...</option>';
      CONFIG.PUNTOS_VENTA.forEach(pv => { select.innerHTML += `<option value="${pv}">${pv}</option>`; });
    },

    populatePuntoEnviarSelect(){
      const select = UI.puntoEnviar;
      if(!select) return;
      select.innerHTML = '<option value="Todos">Todos</option>';
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

        // Advertencia por datos de sesión anterior (si existen)
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
      document.getElementById('sendWhatsAppBtn').addEventListener('click', () => this.handleSendWhatsApp());
      document.getElementById('clearAllBtn').addEventListener('click', () => this.handleClearAll());
    },

    handleTableInput(e){
      const target = e.target;
      if (!target.classList.contains('table-input')) return;

      const field = target.dataset.field;
      if (field !== 'valor' && field !== 'devoluciones' && field !== 'tercero' && field !== 'detalle') return;

      const tr = target.closest('tr');
      if (!tr) return;

      // Recalcular total solo si cambia valor/devoluciones
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

      // Para ciertos tipos es obligatorio escoger empresa del grupo
      const requiereEmpresa = this.requiresEmpresaForTipo(record.tipo);

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

      // Fórmulas solicitadas
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

          // Campos extra para compatibilidad con nuevo encabezado en hoja
          empresaGrupo: empresaGrupoVal,
          "Nombre de la empresa del grupo": empresaGrupoVal
        };
      });

      const c = this.getCalculatedState().summary;

      const summaryData = [
        { tipo: 'Total ventas en efectivo', valor: c.ventasNetoEfectivo },
        { tipo: 'Total ventas por medios electronicos', valor: c.ventasElectronicas },
        { tipo: 'Total ventas a credito', valor: c.ventasCredito },
        { tipo: 'Total ventas', valor: c.ventasGlobal },
        { tipo: 'Total gastos en efectivo', valor: c.gastosEfectivo },
        { tipo: 'Total dinero a recibir por tesoreria', valor: c.esperadoTesoreria },
      ].map(item => ({
        fecha: state.session.date,
        puntoVenta: state.session.pos,
        tipo: item.tipo,
        tercero: '',
        detalle: '',
        valor: item.valor,
        devoluciones: 0,
        total: item.valor,
        empresaGrupo: '',
        "Nombre de la empresa del grupo": ''
      }));

      const dataToSend = [...detailData, ...summaryData];

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

    handleSendWhatsApp(){
      if (!state.session.date || !state.session.pos) return;

      const rows = this.getRecordsFromTable();
      if (rows.length === 0) {
        alert('No hay registros con valores para enviar.');
        return;
      }

      if (!this.validateEmpresaGrupo(rows)) return;

      const money = (n) => Utils.formatCurrency(n).replace(/\s/g,'');
      const oneLine = (s) => String(s ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\|+/g, '/')
        .trim();

      const bloques = [];
      bloques.push(`*Punto que reporta:* ${state.session.pos}`);
      bloques.push(`*Fecha que se reporta:* ${state.session.date}`);

      const detalleLineas = [
        '*Detalle de ventas*',
        ...rows.map(r => {
          const terceroTxt = oneLine(r.tercero) || '-';
          const detalleTxt = oneLine(r.detalle) || '-';
          return `*${r.tipo}*\n${state.session.pos} | ${terceroTxt} | ${detalleTxt} | ${money(r.total)}`;
        })
      ];
      bloques.push(detalleLineas.join('\n\n'));

      const t = this.getCalculatedState().summary;
      const totales = [
        '*Totales*',
        `*Efectivo neto (efectivo - crédito):* ${money(t.ventasNetoEfectivo)}`,
        `*Total ventas por medios electronicos:* ${money(t.ventasElectronicas)}`,
        `*Total ventas a credito:* ${money(t.ventasCredito)}`,
        `*Total ventas:* ${money(t.ventasGlobal)}`,
        `*Total gastos en efectivo:* ${money(t.gastosEfectivo)}`,
        `*Total dinero a recibir por tesoreria:* ${money(t.esperadoTesoreria)}`
      ].join('\n\n');
      bloques.push(totales);

      const finalMessage = bloques.join('\n\n');

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const base = isMobile ? 'https://wa.me' : 'https://web.whatsapp.com/send';
      const url = isMobile
        ? `${base}/${CONFIG.WHATSAPP_PHONE}?text=${encodeURIComponent(finalMessage)}`
        : `${base}?phone=${CONFIG.WHATSAPP_PHONE}&text=${encodeURIComponent(finalMessage)}`;

      window.open(url,'_blank');
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

    saveSession(){ localStorage.setItem(CONFIG.LS_SESSION_KEY, JSON.stringify(state.session)); },
    loadSession(){ state.session = JSON.parse(localStorage.getItem(CONFIG.LS_SESSION_KEY)) || { date: null, pos: null }; },

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

    /* ---------- Reporte (protegido) ---------- */
    bindReportEvents(){
      UI.btnGateOpen.addEventListener('click', () => {
        const pass = (UI.reportPass.value || '').trim();
        if(!pass){ alert('Ingresa la clave.'); return; }
        if(pass !== ADMIN_PASS){ alert('Clave incorrecta.'); return; }

        state.reportUnlocked = true;
        UI.reportGate.classList.add('hidden');
        UI.reportControls.classList.remove('hidden');

        this.toggleShareButtons(false);
        this.updateReportNavBar();
        setDetallesOptionLabel();
        this.populatePuntoEnviarSelect();
      });

      UI.tipoReporte.addEventListener('change', () => {
        state.reporte.tipo = UI.tipoReporte.value;
        UI.reportTag.textContent = (state.reporte.tipo === 'detalles') ? 'Reporte de detalles (servidor)' : 'Reporte de totales';
        UI.reportTableWrapper.classList.toggle('details-mode', state.reporte.tipo === 'detalles');

        if (state.reporte.desde && state.reporte.hasta) {
          this.repintarSegunTipo();
          this.updateReportNavBar();
        }
        setDetallesOptionLabel();
      });

      UI.btnCargarReporte.addEventListener('click', () => {
        if(!state.reportUnlocked){ alert('Debes desbloquear el reporte con la clave.'); return; }
        this.cargarReporte();
      });

      UI.btnExportarExcel.addEventListener('click', () => {
        if(!state.reportUnlocked){ alert('Debes desbloquear el reporte con la clave.'); return; }
        this.exportarExcelPorPuntosConfigurados();
      });

      UI.btnEnviarWhatsAppReporte.addEventListener('click', () => {
        if(!state.reportUnlocked){ alert('Debes desbloquear el reporte con la clave.'); return; }
        this.handleSendWhatsAppReporte();
      });

      UI.btnExportarHTML.addEventListener('click', () => {
        if(!state.reportUnlocked){ alert('Debes desbloquear el reporte con la clave.'); return; }
        this.exportarHTMLPorPunto();
      });
    },

    bindReportNavEvents(){
      UI.navPrevBtn.addEventListener('click', () => {
        if (state.reporte.tipo === 'detalles') this.navPrevPunto();
        else this.navPrevDia();
      });

      UI.navNextBtn.addEventListener('click', () => {
        if (state.reporte.tipo === 'detalles') this.navNextPunto();
        else this.navNextDia();
      });
    },

    updateReportNavBar(){
      const { tipo, desde, hasta, cursor } = state.reporte;
      const rangoUnDia = !!(desde && hasta && desde === hasta);
      const show = (tipo === 'detalles' && rangoUnDia) || (tipo === 'totales' && rangoUnDia);

      UI.reportNav.classList.toggle('hidden', !show);

      if (!show) { 
        UI.navInfo.textContent = ''; 
        return; 
      }

      if (tipo === 'detalles') {
        const puntosConDatos = Array.from(new Set(
          (state.reporte.detalles || [])
            .filter(r => r.fecha === desde)
            .map(r => r.punto || r.puntoVenta || '')
        ));

        cursor.puntosConDatos = puntosConDatos.length ? puntosConDatos : CONFIG.PUNTOS_VENTA.slice();
        if (cursor.puntoIndex >= cursor.puntosConDatos.length) cursor.puntoIndex = 0;

        cursor.currentPuntoFilter = cursor.puntosConDatos[cursor.puntoIndex] || null;
        UI.navInfo.textContent = `Día: ${desde} — Punto: ${cursor.currentPuntoFilter || 'N/A'}`;

        this.pintarTablaDetalles();
      } else {
        UI.navInfo.textContent = `Día: ${desde}`;
      }
    },

    navPrevPunto(){
      const c = state.reporte.cursor;
      if (!c.puntosConDatos.length) return;

      c.puntoIndex = (c.puntoIndex - 1 + c.puntosConDatos.length) % c.puntosConDatos.length;
      c.currentPuntoFilter = c.puntosConDatos[c.puntoIndex];

      this.pintarTablaDetalles();
      UI.navInfo.textContent = `Día: ${state.reporte.desde} — Punto: ${c.currentPuntoFilter}`;
    },

    navNextPunto(){
      const c = state.reporte.cursor;
      if (!c.puntosConDatos.length) return;

      c.puntoIndex = (c.puntoIndex + 1) % c.puntosConDatos.length;
      c.currentPuntoFilter = c.puntosConDatos[c.puntoIndex];

      this.pintarTablaDetalles();
      UI.navInfo.textContent = `Día: ${state.reporte.desde} — Punto: ${c.currentPuntoFilter}`;
    },

    navPrevDia(){
      const { desde, hasta } = state.reporte;
      if (!(desde && hasta && desde === hasta)) return;

      const newDay = Utils.dateAddDays(desde, -1);
      UI.fechaDesde.value = newDay; 
      UI.fechaHasta.value = newDay;
      this.cargarReporte();
    },

    navNextDia(){
      const { desde, hasta } = state.reporte;
      if (!(desde && hasta && desde === hasta)) return;

      const newDay = Utils.dateAddDays(desde, 1);
      UI.fechaDesde.value = newDay; 
      UI.fechaHasta.value = newDay;
      this.cargarReporte();
    },

    toggleShareButtons(enabled){
      UI.btnExportarExcel.disabled = !enabled;
      UI.btnEnviarWhatsAppReporte.disabled = !enabled;
      UI.btnExportarHTML.disabled = !enabled;
    },

    async cargarReporte(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Seleccione el rango de fechas.'); return; }
      if(desde > hasta){ alert('La fecha "Desde" no puede ser mayor que "Hasta".'); return; }

      state.reporte.desde = desde;
      state.reporte.hasta = hasta;

      this.toggleShareButtons(false);

      const rangoTxt = desde===hasta ? `del ${desde}` : `del ${desde} al ${hasta}`;
      UI.reportStatus.textContent = 'Cargando detalles del servidor para calcular totales...';

      try{
        const detallesSrv = await Api.cargarDetallesDesdeServidor(desde, hasta);
        state.reporte.detalles = detallesSrv;
        state.reporte.detallesSource = 'server';
        state.reporte.detallesRange = { desde, hasta };

        this.calcularMatrizGeneral();
        state.reporte.totalesRange = { desde, hasta };

        if (state.reporte.tipo === 'detalles') {
          setDetallesOptionLabel();
          state.reporte.cursor.puntoIndex = 0;
          this.pintarTablaDetalles();
          UI.reportStatus.textContent = `Detalles ${rangoTxt} (servidor). Filas: ${detallesSrv.length}.`;
        } else {
          this.pintarTablaTotales();
          UI.reportStatus.textContent = `Totales calculados ${rangoTxt}.`;
        }

        this.toggleShareButtons(true);
      }catch(e){
        console.error(e);
        state.reporte.detalles = [];
        state.reporte.matriz = null;
        UI.reportStatus.textContent = 'Error al cargar datos del servidor.';
      }

      this.updateReportNavBar();
    },

    calcularMatrizGeneral(){
      const rows = state.reporte.detalles || [];
      const matriz = {};

      CONFIG.PUNTOS_VENTA.forEach(p => {
        const pointRows = rows.filter(r => (r.punto === p || r.puntoVenta === p));
        matriz[p] = this.calculateMetricsForRows(pointRows);
      });

      state.reporte.matriz = matriz;
    },

    calculateMetricsForRows(rows){
      let raw_efectivo = 0, electronica = 0, credito = 0, gasto = 0;

      rows.forEach(r => {
        let val = 0;
        if(r.total !== undefined && r.total !== null && r.total !== '') {
          val = Number(r.total);
        } else {
          val = Number(r.valor) || 0;
        }

        const tipoOriginal = (r.tipo || '');
        const tipo = normalizeText(tipoOriginal);

        if (tipo.startsWith('total ')) return;

        // Efectivo base
        if (tipo.includes('efectivo pos')) {
          raw_efectivo += val;
          return;
        }

        // Medios electrónicos
        if (tipo.includes('qr') || tipo.includes('tarjeta debito') || tipo.includes('tarjeta credito') || tipo.includes('tarjeta')) {
          // Nota: las ventas a crédito NO deberían incluir "tarjeta", pero dejamos la regla original que evita confusión
          electronica += val;
          return;
        }

        // Créditos (incluye kardex)
        if (tipo.includes('faltantes en kardex') || tipo.includes('kardex')) {
          credito += val;
          return;
        }

        if (tipo.includes('credito')) {
          // Evitar que algo raro con "tarjeta" se cuele como crédito
          if (!tipo.includes('tarjeta')) {
            credito += val;
          }
          return;
        }

        // Gastos
        if (tipo.includes('gasto')) {
          gasto += val;
          return;
        }
      });

      // Fórmulas solicitadas
      const total_ventas_efectivo = raw_efectivo - credito;
      const total_ventas_global = total_ventas_efectivo + electronica + credito;
      const total_esperado_tesoreria = total_ventas_efectivo - gasto;

      return {
        total_ventas_efectivo,
        total_ventas_electronicas: electronica,
        total_ventas_credito: credito,
        total_ventas_global,
        total_gastos_efectivo: gasto,
        total_esperado_tesoreria
      };
    },

    repintarSegunTipo(){
      if (state.reporte.tipo === 'detalles') this.pintarTablaDetalles();
      else this.pintarTablaTotales();
    },

    pintarTablaTotales(){
      const puntos = CONFIG.PUNTOS_VENTA;

      UI.theadTot.innerHTML = '';
      const trh = document.createElement('tr');
      trh.innerHTML =
        `<th>Concepto / Punto</th>` +
        puntos.map(p=>`<th class="right">${p}</th>`).join('') +
        `<th class="right">Total general</th>`;
      UI.theadTot.appendChild(trh);

      UI.tbodyTot.innerHTML = '';
      CONFIG.TOTAL_KEYS.forEach(row=>{
        const tr = document.createElement('tr');
        let totalGeneral = 0;

        const celdas = puntos.map(p=>{
          const v = state.reporte.matriz?.[p]?.[row.key] || 0;
          totalGeneral += v;
          return `<td class="right">${Utils.formatCurrency(v)}</td>`;
        }).join('');

        tr.innerHTML =
          `<td><strong>${row.label}</strong></td>` +
          `${celdas}` +
          `<td class="right"><strong>${Utils.formatCurrency(totalGeneral)}</strong></td>`;

        UI.tbodyTot.appendChild(tr);
      });

      UI.tfootTot.innerHTML = '';
    },

    pintarTablaDetalles(){
      const rows = state.reporte.detalles || [];
      const { desde, hasta, cursor } = state.reporte;

      const rangoUnDia = (desde && hasta && desde === hasta);
      const filtroPunto = (rangoUnDia ? (cursor.currentPuntoFilter || null) : null);

      const rowsFiltradas = (filtroPunto)
        ? rows.filter(r => r.fecha === desde && ((r.punto || r.puntoVenta) === filtroPunto))
        : rows;

      UI.theadTot.innerHTML = '';
      const trh = document.createElement('tr');
      trh.innerHTML = `
        <th>Fecha</th>
        <th>Punto</th>
        <th>Tipo</th>
        <th>Tercero / Destino</th>
        <th>Detalle</th>
        <th class="right">Valor</th>`;
      UI.theadTot.appendChild(trh);

      UI.tbodyTot.innerHTML = '';
      let totalGeneral = 0;

      rowsFiltradas.forEach(r => {
        const punto = r.punto || r.puntoVenta || '';
        const valMostrar = (r.total !== undefined) ? Number(r.total) : Number(r.valor);
        totalGeneral += valMostrar || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${Utils.escapeHtml(r.fecha || '')}</td>
          <td>${Utils.escapeHtml(punto)}</td>
          <td><strong>${Utils.escapeHtml(r.tipo || '')}</strong></td>
          <td>${Utils.escapeHtml(r.tercero || '')}</td>
          <td>${Utils.escapeHtml(r.detalle || '')}</td>
          <td class="right">${Utils.formatCurrency(valMostrar || 0)}</td>
        `;
        UI.tbodyTot.appendChild(tr);
      });

      UI.tfootTot.innerHTML = '';
      const trf = document.createElement('tr');
      trf.innerHTML =
        `<td colspan="5" class="right"><strong>Total general (filas visibles)</strong></td>` +
        `<td class="right"><strong>${Utils.formatCurrency(totalGeneral)}</strong></td>`;
      UI.tfootTot.appendChild(trf);
    },

    /* ===== Exportaciones y WhatsApp del reporte ===== */
    async exportarExcelPorPuntosConfigurados(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Primero carga el reporte.'); return; }

      const puntoSel = UI.puntoEnviar?.value || 'Todos';
      const modo = UI.modoEnvio?.value || 'ambos';

      await this.ensureDataForRange(desde, hasta);

      const basePoints = (puntoSel === 'Todos') ? CONFIG.PUNTOS_VENTA.slice() : [puntoSel];
      const dateRange = Utils.getDatesInRange(desde, hasta);

      let combinedHtml = "";
      let countTables = 0;

      basePoints.forEach(pt => {
        let pointHeaderAdded = false;

        dateRange.forEach(date => {
          const all = state.reporte.detalles || [];

          const dayRows = all.filter(r => {
            const f = r.fecha || '';
            const punto = r.punto || r.puntoVenta || '';
            const t = (r.tipo || '');
            return (f === date) && (punto === pt) && !t.startsWith('Total ');
          });

          const dayMetrics = this.calculateMetricsForRows(dayRows);

          const hasActivity = (
            dayMetrics.total_ventas_global > 0 ||
            dayMetrics.total_gastos_efectivo > 0 ||
            dayMetrics.total_esperado_tesoreria !== 0 ||
            dayRows.length > 0
          );

          if (!hasActivity) return;

          countTables++;

          if(!pointHeaderAdded) {
            combinedHtml += `<h2 style="color:#0056b3; margin-top:30px; border-bottom:2px solid #0056b3;">${pt.toUpperCase()}</h2>`;
            pointHeaderAdded = true;
          }

          let filasHtml = "";

          if (modo === 'detalles' || modo === 'ambos') {
            filasHtml = dayRows.map(r=>{
              const val = (r.total !== undefined) ? Number(r.total) : Number(r.valor);
              return `<tr>
                <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.fecha||'')}</td>
                <td style="border:1px solid #ddd;">${Utils.escapeHtml(pt)}</td>
                <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.tipo||'')}</td>
                <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.tercero||'')}</td>
                <td style="border:1px solid #ddd;">${Utils.escapeHtml(r.detalle||'')}</td>
                <td style="border:1px solid #ddd; mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${val}</td>
              </tr>`;
            }).join('');
          }

          let totalesHtml = "";

          if (modo === 'totales' || modo === 'ambos'){
            const m = dayMetrics;
            const fila = (label, val, bg='#fff') =>
              `<tr style="background:${bg}">
                <td colspan="5" style="border:1px solid #ddd; font-weight:bold;">${label}</td>
                <td style="border:1px solid #ddd; mso-number-format:'\\#\\,\\#\\#0'; text-align:right; font-weight:bold;">${val}</td>
              </tr>`;

            totalesHtml = [
              fila('Total ventas', m.total_ventas_global),
              fila('Total gastos en efectivo', m.total_gastos_efectivo),
              fila('Total dinero a recibir por tesoreria', m.total_esperado_tesoreria, '#EAF4FF')
            ].join('');
          }

          const th = `
            <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Fecha</th>
            <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Punto</th>
            <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Tipo</th>
            <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Tercero</th>
            <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Detalle</th>
            <th style="background:#e8f0fe; font-weight:bold; border:1px solid #999;">Valor</th>`;

          combinedHtml += `
            <table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse; width:100%; margin-bottom:20px;">
              <thead><tr>${th}</tr></thead>
              <tbody>${filasHtml}</tbody>
              <tfoot>${totalesHtml}</tfoot>
            </table>
          `;
        });
      });

      if (countTables === 0){ alert('No hay datos para exportar con la configuración actual.'); return; }

      const rangeTxt = (desde===hasta) ? desde : `${desde} al ${hasta}`;
      const htmlDoc = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head>
        <body><h2>REPORTE CONSOLIDADO - ${rangeTxt}</h2>${combinedHtml}</body></html>`.trim();

      const blob = new Blob([htmlDoc], {type: 'application/vnd.ms-excel;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const suf = (puntoSel==='Todos') ? 'todos' : puntoSel;

      a.href = url;
      a.download = `reporte_excel_${suf}_${(desde===hasta)?desde:(desde+'_'+hasta)}.xls`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      UI.reportStatus.textContent = `Excel generado (${countTables} tablas diarias).`;
    },

    async exportarHTMLPorPunto(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }

      const puntoSel = UI.puntoEnviar?.value || 'Todos';
      const modo = UI.modoEnvio?.value || 'ambos';

      await this.ensureDataForRange(desde, hasta);

      const basePoints = (puntoSel === 'Todos') ? CONFIG.PUNTOS_VENTA.slice() : [puntoSel];
      const dateRange = Utils.getDatesInRange(desde, hasta);

      let combinedHtml = "";
      let countTables = 0;

      basePoints.forEach(pt => {
        let pointHeaderAdded = false;

        dateRange.forEach(date => {
          const all = state.reporte.detalles || [];

          const dayRows = all.filter(r => {
            const f = r.fecha || '';
            const punto = r.punto || r.puntoVenta || '';
            const t = (r.tipo || '');
            return (f === date) && (punto === pt) && !t.startsWith('Total ');
          });

          const dayMetrics = this.calculateMetricsForRows(dayRows);

          const hasActivity = (
            dayMetrics.total_ventas_global > 0 ||
            dayMetrics.total_gastos_efectivo > 0 ||
            dayMetrics.total_esperado_tesoreria !== 0 ||
            dayRows.length > 0
          );

          if (!hasActivity) return;

          countTables++;

          if(!pointHeaderAdded) {
            combinedHtml += `<h2 style="color:#0056b3; margin-top:30px; border-bottom:2px solid #0056b3;">${pt.toUpperCase()}</h2>`;
            pointHeaderAdded = true;
          }

          let filasHtml = "";

          if (modo === 'detalles' || modo === 'ambos'){
            filasHtml = dayRows.map(r=>{
              const val = (r.total !== undefined) ? Number(r.total) : Number(r.valor);
              return `<tr>
                <td>${Utils.escapeHtml(r.fecha||'')}</td>
                <td>${Utils.escapeHtml(pt)}</td>
                <td>${Utils.escapeHtml(r.tipo||'')}</td>
                <td>${Utils.escapeHtml(r.tercero||'')}</td>
                <td>${Utils.escapeHtml(r.detalle||'')}</td>
                <td style="text-align:right;">${Utils.formatNumber(val)}</td>
              </tr>`;
            }).join('');
          }

          let totalesHtml = "";

          if (modo === 'totales' || modo === 'ambos'){
            const m = dayMetrics;
            const fila = (label, val, extraStyle='') =>
              `<tr style="${extraStyle}">
                <td colspan="5"><strong>${label}</strong></td>
                <td style="text-align:right;"><strong>${Utils.formatNumber(val)}</strong></td>
              </tr>`;

            totalesHtml = [
              fila('Total ventas', m.total_ventas_global),
              fila('Total gastos en efectivo', m.total_gastos_efectivo),
              fila('Total dinero a recibir por tesoreria', m.total_esperado_tesoreria, 'background:#EAF4FF;color:#0B5BD3;border-top:2px solid #0B5BD3;')
            ].join('');
          }

          const th = `<th>fecha</th><th>punto</th><th>tipo</th><th>tercero</th><th>detalle</th><th>valor</th>`;

          combinedHtml += `<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse; width:100%; max-width:100%; margin-bottom:20px;">
            <thead style="background:#e8f0fe;"><tr>${th}</tr></thead>
            <tbody>${filasHtml}</tbody>
            <tfoot>${totalesHtml}</tfoot>
          </table>`;
        });
      });

      if (countTables === 0){ alert('No hay puntos con valores mayores a cero.'); return; }

      const htmlDoc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte HTML</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;line-height:1.35;padding:12px;}
  h3{color:#0b5bd3}
</style>
</head>
<body>${combinedHtml}</body>
</html>`.trim();

      const blob = new Blob([htmlDoc], {type:'text/html;charset=utf-8;'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);

      const suf = (puntoSel==='Todos') ? 'todos' : puntoSel;
      a.download = `reporte_html_${suf}_${(desde===hasta)?desde:(desde+'_'+hasta)}.html`;

      document.body.appendChild(a);
      a.click();
      a.remove();

      UI.reportStatus.textContent = `HTML generado (${countTables} tablas).`;
    },

    async handleSendWhatsAppReporte(){
      const desde = UI.fechaDesde.value, hasta = UI.fechaHasta.value;
      if(!desde || !hasta){ alert('Selecciona el rango de fechas.'); return; }

      const puntoSel = UI.puntoEnviar?.value || 'Todos';
      const modo = UI.modoEnvio?.value || 'ambos';

      await this.ensureDataForRange(desde, hasta);

      const basePoints = (puntoSel === 'Todos') ? CONFIG.PUNTOS_VENTA.slice() : [puntoSel];
      const bloques = [];

      const money = (n) => Utils.formatCurrency(n).replace(/\s/g,'');
      const oneLine = (s) => String(s ?? '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/\|+/g, '/')
        .trim();

      basePoints.forEach((pt, idx) => {
        const globalMatriz = state.reporte.matriz?.[pt];
        const hasGlobalData = (globalMatriz && (globalMatriz.total_ventas_global > 0 || globalMatriz.total_esperado_tesoreria !== 0));
        if (!hasGlobalData) return;

        const rangeTxt = (desde===hasta) ? desde : `${desde} al ${hasta}`;
        const titulo = [`*PUNTO:* ${pt.toUpperCase()}`, `*FECHA:* ${rangeTxt.toUpperCase()}`];
        const secciones = [titulo.join('\n')];

        if (modo === 'detalles' || modo === 'ambos') {
          const all = state.reporte.detalles || [];
          const filas = all.filter(r => {
            const f = r.fecha || '';
            const t = r.tipo || '';
            return (f >= desde && f <= hasta) && (r.punto === pt || r.puntoVenta === pt) && !t.startsWith('Total ');
          });

          if (filas.length){
            const det = ['*Detalles*', ...filas.map(r => {
              const val = (r.total !== undefined) ? Number(r.total) : Number(r.valor);
              return `*${r.tipo}*\n${oneLine(r.tercero)} | ${oneLine(r.detalle)} | ${money(val||0)}`;
            })].join('\n\n');
            secciones.push(det);
          }
        }

        if (modo === 'totales' || modo === 'ambos') {
          const m = globalMatriz;
          const tot = ['*Totales*',
            `Ventas Efec. Neto: ${money(m.total_ventas_efectivo)}`,
            `Ventas Elect.: ${money(m.total_ventas_electronicas)}`,
            `Ventas Crédito: ${money(m.total_ventas_credito)}`,
            `*TOTAL VENTAS: ${money(m.total_ventas_global)}*`,
            `Gastos: ${money(m.total_gastos_efectivo)}`,
            `*TESORERIA: ${money(m.total_esperado_tesoreria)}*`
          ].join('\n');
          secciones.push(tot);
        }

        bloques.push(secciones.join('\n\n'));
        if (idx < basePoints.length - 1){ bloques.push('--------------------'); }
      });

      if (bloques.length === 0){ alert('No hay puntos con movimiento.'); return; }

      const finalMessage = bloques.join('\n\n');

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const base = isMobile ? 'https://wa.me' : 'https://web.whatsapp.com/send';

      const url = isMobile
        ? `${base}/${CONFIG.WHATSAPP_PHONE}?text=${encodeURIComponent(finalMessage)}`
        : `${base}?phone=${CONFIG.WHATSAPP_PHONE}&text=${encodeURIComponent(finalMessage)}`;

      window.open(url,'_blank');
    },

    async ensureDataForRange(desde, hasta){
      const r = state.reporte.detallesRange || {};

      if (r.desde !== desde || r.hasta !== hasta || !Array.isArray(state.reporte.detalles) || state.reporte.detalles.length === 0) {
        const detallesSrv = await Api.cargarDetallesDesdeServidor(desde, hasta);
        state.reporte.detalles = detallesSrv;
        state.reporte.detallesRange = { desde, hasta };
        state.reporte.detallesSource = 'server';
        this.calcularMatrizGeneral();
        state.reporte.totalesRange = { desde, hasta };
      }
    }
  };

  function setDetallesOptionLabel(){
    const el = document.getElementById('opt-detalles-label');
    if(!el) return;
    el.textContent = 'Detalles (servidor: hoja de cálculo)';
  }

  // Exponer App por si luego quieres depurar desde consola
  A.App = App;
  A.state = state;

  // Arranque seguro cuando el DOM ya existe
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})(window.Arcadia);

