window.Arcadia = window.Arcadia || {};

(function (A) {
  'use strict';

  const Utils = {
    safeNumber(val){
      const cleanStr = String(val || '0').replace(/\./g, '').replace(/,/g, '.');
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
    }
  };

  A.Utils = Utils;
})(window.Arcadia);
