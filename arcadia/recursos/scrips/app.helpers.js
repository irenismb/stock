window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  const { CONFIG, UI } = A;
  const state = A.state;
  const App = A.App = A.App || {};

  function normalizeText(s){
    return String(s || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Cache simple de sets normalizados para evitar recalcular
  const _normSetCache = new Map();

  function getNormalizedSet(list){
    const arr = Array.isArray(list) ? list : [];
    const key = arr.join('||'); // suficiente para estas listas fijas de config
    if (_normSetCache.has(key)) return _normSetCache.get(key);
    const set = new Set(arr.map(normalizeText));
    _normSetCache.set(key, set);
    return set;
  }

  Object.assign(App, {
    normalizeText,

    /* =========================================================
       ✅ Normalización y equivalencias de tipos
       - Evita fallos por tildes o mínimas variaciones.
       - Se usa en validaciones, reglas y exportaciones.
       ========================================================= */

    getAllTiposCanonicos(){
      if (this._allTiposCanonicosCache) return this._allTiposCanonicosCache;

      const raw = [
        ...(CONFIG.TIPOS_SIN_TERCERO || []),
        ...(CONFIG.TIPOS_REQUIEREN_EMPRESA || []),
        ...(CONFIG.TIPOS_EFECTIVO || []),
        ...(CONFIG.TIPOS_ELECTRONICOS || []),
        ...(CONFIG.TIPOS_GASTO || []),
        ...(CONFIG.EXPORT_TIPO_ORDER || [])
      ];

      const uniq = [];
      const seenNorm = new Set();
      raw.forEach(t => {
        const n = normalizeText(t);
        if (!n) return;
        if (seenNorm.has(n)) return;
        seenNorm.add(n);
        uniq.push(t);
      });

      this._allTiposCanonicosCache = uniq;
      return uniq;
    },

    isTipoInList(tipo, list){
      const nTipo = normalizeText(tipo);
      if (!nTipo) return false;
      const set = getNormalizedSet(list);
      return set.has(nTipo);
    },

    canonicalTipo(tipo){
      const raw = String(tipo || '').trim();
      if (!raw) return '';
      const n = normalizeText(raw);

      const canon = this.getAllTiposCanonicos();
      for (const t of canon) {
        if (normalizeText(t) === n) return t;
      }
      // Si no coincide con ningún conocido, devolver el original
      return raw;
    },

    /* ---------- Helpers de reglas ---------- */
    requiresEmpresaForTipo(tipo){
      return this.isTipoInList(tipo, CONFIG.TIPOS_REQUIEREN_EMPRESA || []);
    },

    disableTerceroForTipo(tipo){
      return this.isTipoInList(tipo, CONFIG.TIPOS_SIN_TERCERO || []);
    },

    validateEmpresaGrupo(records){
      const faltantes = (records || []).filter(r =>
        this.requiresEmpresaForTipo(r.tipo) && !String(r.tercero || '').trim()
      );
      if (faltantes.length) {
        const tipos = Array.from(
          new Set(faltantes.map(f => this.canonicalTipo(f.tipo)))
        );
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

