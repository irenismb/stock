window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';

  const { CONFIG, UI } = A;
  const state = A.state;

  const App = A.App = A.App || {};

  function normalizeText(s){
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
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
