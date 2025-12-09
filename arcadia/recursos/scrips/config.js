// Namespace global
window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  A.ADMIN_PASS = '2525';
  A.CONFIG = {
    LS_RECORDS_KEY: 'salesGridRecords_v2',
    LS_SESSION_KEY: 'sessionGrid_v2',
    WHATSAPP_PHONE: '573007248537',
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx-_O7ZMuWAZKZppxFa0_cOd4yTI5wiqJuMVjIqRoJEucqjFbL4Jlri57OoYXNIFykouA/exec',
    API_KEY: '',
    PUNTOS_VENTA: ['Almendros','Aroma','Ferrocarril','Flora','Irotama','Libertador','Minca','Neguanje','Orient','Playa','Reserva','Rodadero'],
    EMPRESAS_GRUPO: ['Unidad Hemato O.','Sembrando Esperanza','Inversiones ARCADIA','Doctor Ahorro','Heritage','Distribuidora'],

    // Tipos que obligan a escoger empresa del grupo
    TIPOS_REQUIEREN_EMPRESA: [
      'Ventas a crédito (descuentos por nómina)',
      'Ventas a crédito (fórmulas)',
      'Faltantes en kardex (descuentos por nomina)',
      'Ventas a crédito a empresas del grupo'
    ],

    TOTAL_KEYS: [
      {key:'total_esperado_tesoreria', label:'Total dinero a recibir por tesoreria'},
      {key:'total_gastos_efectivo',   label:'Total gastos en efectivo'},
      {key:'total_ventas_global',     label:'Total ventas'},
      {key:'total_ventas_credito',    label:'Total ventas a credito'},
      {key:'total_ventas_efectivo',   label:'Efectivo neto (efectivo - crédito)'},
      {key:'total_ventas_electronicas',label:'Total ventas por medios electronicos'}
    ],
    TIPO_A_CLAVE: {
      'Total dinero a recibir por tesoreria':'total_esperado_tesoreria',
      'Total gastos en efectivo':'total_gastos_efectivo',
      'Total ventas':'total_ventas_global',
      'Total ventas a credito':'total_ventas_credito',
      'Total ventas en efectivo':'total_ventas_efectivo',
      'Total ventas por medios electronicos':'total_ventas_electronicas'
    }
  };
})(window.Arcadia);

