window.Arcadia = window.Arcadia || {};

(function (A) {
  'use strict';

  const { CONFIG, Utils } = A;

  async function fetchJson(url, opt = {}, errorPrefix = 'Error'){
    const res = await fetch(url, opt);
    const text = await res.text().catch(()=> '');
    if(!res.ok){
      const msg = `${errorPrefix}: HTTP ${res.status} — ${text.slice(0,180)}`;
      throw new Error(msg);
    }
    try{
      return JSON.parse(text);
    }catch(e){
      throw new Error(`${errorPrefix}: JSON inválido — ${text.slice(0,180)}`);
    }
  }

  async function cargarDetallesDesdeServidor(desde, hasta){
    const url = `${CONFIG.SCRIPT_URL}?action=details&from=${encodeURIComponent(desde)}&to=${encodeURIComponent(hasta)}${
      CONFIG.API_KEY ? '&key='+encodeURIComponent(CONFIG.API_KEY) : ''
    }`;

    const rows = await fetchJson(url, { headers: { 'Accept': 'application/json' } }, 'Detalles');
    return (rows || []).map(r => ({
      fecha: r.fecha || r.Fecha || '',
      punto: r.punto || r.puntoVenta || r.Punto || '',
      tipo: r.tipo || r.Tipo || '',
      tercero: r.tercero || r.Tercero || '',
      detalle: r.detalle || r.Detalle || '',
      valor: Number(r.valor || r.Valor || 0),
      devoluciones: Number(r.devoluciones || r.Devoluciones || 0),
      total: (r.total !== undefined) ? Number(r.total) : undefined
    }));
  }

  A.Api = { fetchJson, cargarDetallesDesdeServidor };
})(window.Arcadia);
