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

  /*
    Ahora el servidor debe devolver (o se leerá desde la hoja):
    - fecha
    - punto
    - tipo
    - tercero
    - detalle
    - valor (ya neto)
  */
  async function cargarDetallesDesdeServidor(desde, hasta){
    const url = `${CONFIG.SCRIPT_URL}?action=details&from=${encodeURIComponent(desde)}&to=${encodeURIComponent(hasta)}${
      CONFIG.API_KEY ? '&key='+encodeURIComponent(CONFIG.API_KEY) : ''
    }`;

    const rows = await fetchJson(
      url,
      { headers: { 'Accept': 'application/json' } },
      'Detalles'
    );

    return (rows || []).map(r => ({
      fecha: r.fecha || r.Fecha || '',
      punto: r.punto || r.puntoVenta || r.Punto || '',
      tipo: r.tipo || r.Tipo || '',
      tercero:
        r.tercero ||
        r.Tercero ||
        r["Tercero"] ||
        '',
      detalle: r.detalle || r.Detalle || '',
      // ✅ valor ya debe venir neto desde la hoja
      valor: Number(r.valor || r.Valor || 0)
    }));
  }

  A.Api = { fetchJson, cargarDetallesDesdeServidor };
})(window.Arcadia);

