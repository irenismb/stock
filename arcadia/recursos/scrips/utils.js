window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  const Utils = {
    safeNumber(val){
      // ✅ Soporta:
      // - number
      // - "10000"
      // - "10.000"
      // - "$ 10.000"
      // - "COP 10.000"
      // - "10.000,50" (si algún día llega con decimales)
      if (typeof val === 'number') return isFinite(val) ? val : 0;

      let cleanStr = String(val ?? '0').trim();
      if (!cleanStr) return 0;

      // Quita todo excepto dígitos, coma, punto y signo -
      cleanStr = cleanStr.replace(/[^0-9,.\-]/g, '');

      // Formato típico es-CO: miles "." y decimales ","
      // Quitamos miles "." y convertimos "," a "."
      cleanStr = cleanStr.replace(/\./g, '').replace(/,/g, '.');

      const n = parseFloat(cleanStr);
      return isFinite(n) ? n : 0;
    },
    formatCurrency(num){
      return new Intl.NumberFormat('es-CO',{
        style:'currency', currency:'COP',
        minimumFractionDigits:0, maximumFractionDigits:0
      }).format(Math.round(num));
    },
    formatNumber(num){
      return new Intl.NumberFormat('es-CO',{
        minimumFractionDigits:0, maximumFractionDigits:0
      }).format(Math.round(num));
    },
    nowDateISO(){ return new Date().toISOString().slice(0,10); },
    dateAddDays(iso, days){
      const d = new Date(iso);
      d.setDate(d.getDate()+days);
      return d.toISOString().slice(0,10);
    },
    yesterdayISO(){ return Utils.dateAddDays(Utils.nowDateISO(), -1); },
    uuidv4(){
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c==='x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    },
    escapeHtml(s){
      return String(s == null ? '' : s)
        .replaceAll('&','&amp;')
        .replaceAll('<','&lt;')
        .replaceAll('>','&gt;')
        .replaceAll('"','&quot;');
    },
    getDatesInRange(startDate, endDate) {
      const date = new Date(startDate + 'T12:00:00');
      const end = new Date(endDate + 'T12:00:00');
      const dates = [];
      while (date <= end) {
        dates.push(date.toISOString().slice(0, 10));
        date.setDate(date.getDate() + 1);
      }
      return dates;
    },
    loadScript(src, opts = {}){
      const { test, timeoutMs = 12000 } = opts;
      return new Promise((resolve, reject) => {
        let done = false;
        const finish = (ok, err) => {
          if (done) return;
          done = true;
          ok ? resolve(true) : reject(err);
        };
        try{
          if (typeof test === 'function' && test()) {
            finish(true);
            return;
          }
        }catch(_){}
        const already = Array.from(document.scripts || []).some(s => s && s.src && s.src === src);
        if (already) {
          try{
            if (!test || test()) finish(true);
            else finish(false, new Error('Script existente pero test no pasó: ' + src));
          }catch(e){
            finish(false, e);
          }
          return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => {
          try{
            if (typeof test === 'function') {
              if (test()) finish(true);
              else finish(false, new Error('Script cargado pero test no pasó: ' + src));
            } else {
              finish(true);
            }
          }catch(e){
            finish(false, e);
          }
        };
        s.onerror = () => finish(false, new Error('No se pudo cargar el script: ' + src));
        document.head.appendChild(s);
        if (timeoutMs) {
          setTimeout(() => {
            try{
              if (typeof test === 'function' && test()) finish(true);
              else finish(false, new Error('Tiempo de espera al cargar: ' + src));
            }catch(e){
              finish(false, e);
            }
          }, timeoutMs);
        }
      });
    }
  };
  A.Utils = Utils;
})(window.Arcadia);


