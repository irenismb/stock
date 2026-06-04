window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  const { CONFIG, UI } = A;
  const state = A.state;
  const App = A.App = A.App || {};

  function normalizeText(s){
    // ✅ Normalización más robusta para comparaciones:
    // - minúsculas
    // - sin tildes
    // - colapsa espacios
    // - elimina puntuación (deja letras/números/espacios)
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')     // sin tildes
      .replace(/[^a-z0-9]+/g, ' ')         // quita puntuación/símbolos
      .replace(/\s+/g, ' ')                // colapsa espacios
      .trim();
  }

  Object.assign(App, {
    normalizeText,

    /* ---------- Helpers de reglas ---------- */
    requiresEmpresaForTipo(tipo){
      return (CONFIG.TIPOS_REQUIEREN_EMPRESA || []).includes(tipo);
    },
    disableTerceroForTipo(tipo){
      return (CONFIG.TIPOS_SIN_TERCERO || []).includes(tipo);
    },
    // ✅ Gastos: obligatorio tercero/destino (maneja variantes como "Gasto en efectivo1")
    isGastoTipo(tipo){
      const t = String(tipo || '');
      if ((CONFIG.TIPOS_GASTO || []).includes(t)) return true;
      const nt = this.normalizeText(t);
      return nt.startsWith('gasto en efectivo');
    },
    // ✅ Regla final: obligatorio en créditos (según fórmulas) y en gastos en efectivo
    requiresTerceroObligatorioForTipo(tipo){
      return this.requiresEmpresaForTipo(tipo) || this.isGastoTipo(tipo);
    },
    // ✅ Valida que en conceptos obligatorios NO quede vacío
    validateEmpresaGrupo(records){
      const faltantes = (records || []).filter(r =>
        this.requiresTerceroObligatorioForTipo(r.tipo) &&
        !String(r.tercero || '').trim()
      );
      if (faltantes.length) {
        const tipos = Array.from(new Set(faltantes.map(f => f.tipo)));
        alert(
          'Debes seleccionar el Tercero / Destino para estos conceptos antes de enviar:\n\n' +
          tipos.map(t => `- ${t}`).join('\n')
        );
        return false;
      }
      return true;
    },

    /* ---------- Estado de red ---------- */
    updateNetworkStatus(){
      const online = navigator.onLine;
      UI.networkStatus?.classList.toggle('status-online', online);
      UI.networkStatus?.classList.toggle('status-offline', !online);
      if (UI.networkStatus) UI.networkStatus.textContent = online ? 'Online' : 'Offline';
    },

    /* ---------- Sesión ---------- */
    getStorageKey(){
      if (!state.session.date || !state.session.pos) return null;
      return `${CONFIG.LS_RECORDS_KEY}_${state.session.date}_${state.session.pos}`;
    },
    saveSession(){
      localStorage.setItem(CONFIG.LS_SESSION_KEY, JSON.stringify(state.session));
    },
    loadSession(){
      state.session = JSON.parse(localStorage.getItem(CONFIG.LS_SESSION_KEY)) || { date: null, pos: null };
    }
  });
})(window.Arcadia);

