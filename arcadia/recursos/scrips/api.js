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

    const rows = await fetchJson(
      url,
      { headers: { 'Accept': 'application/json' } },
      'Detalles'
    );

    return (rows || []).map(r => {
      const rawValor =
        r.valor ?? r.Valor ?? r["Valor"] ?? r["VALOR"] ??
        r.total ?? r.Total ?? r["Total"] ?? r["TOTAL"] ??
        r.monto ?? r.Monto ?? r["Monto"] ?? r["MONTO"] ??
        r.valorNeto ?? r.valorneto ?? r.Neto ?? r.neto ??
        0;

      return {
        fecha: r.fecha || r.Fecha || '',
        punto:
          r.punto || r.puntoVenta || r.Punto || r.PuntoVenta ||
          r["Punto de venta"] || r["Punto"] || '',
        tipo: r.tipo || r.Tipo || r["Tipo"] || '',
        tercero: r.tercero || r.Tercero || r["Tercero"] || '',
        detalle: r.detalle || r.Detalle || r["Detalle"] || '',
        valor: Utils.safeNumber(rawValor)
      };
    });
  }

  A.Api = { fetchJson, cargarDetallesDesdeServidor };
})(window.Arcadia);

