window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';

  // Estado único compartido por todos los módulos de la app
  A.state = {
    session: { date: null, pos: null },
    reporte: {
      desde: null,
      hasta: null,
      detalles: [],
      detallesSource: 'server',
      detallesRange: { desde: null, hasta: null }
    },
    reportUnlocked: false
  };

  // Asegurar contenedor App para extenderlo en otros archivos
  A.App = A.App || {};

})(window.Arcadia);
