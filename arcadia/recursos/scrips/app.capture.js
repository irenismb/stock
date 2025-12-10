window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';

  const { CONFIG, Utils, UI } = A;
  const state = A.state;
  const App = A.App;

  Object.assign(App, {
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

      const detailData = records.map(r => {
        const neto = Number(r.total || 0);
        return {
          fecha: state.session.date,
          puntoVenta: state.session.pos,
          tipo: r.tipo,
          tercero: r.tercero,
          Tercero: r.tercero,
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
    }
  });

})(window.Arcadia);
