window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';
  A.UI = {
    home: document.getElementById('home'),
    capture: document.getElementById('capture'),
    report: document.getElementById('report'),

    goCaptureBtn: document.getElementById('go-capture'),
    goReportBtn: document.getElementById('go-report'),
    backHome1: document.getElementById('back-home-1'),
    backHome2: document.getElementById('back-home-2'),
    resumeLastBtn: document.getElementById('resume-last'),
    resumeHint: document.getElementById('resume-hint'),

    // captura
    sessionSetup: document.getElementById('session-setup-fields'),
    sessionInfo: document.getElementById('session-info'),
    sessionDate: document.getElementById('session-date-display'),
    sessionPos: document.getElementById('session-pos-display'),
    networkStatus: document.getElementById('network-status'),
    recordsBody: document.getElementById('recordsListBody'),
    recordsFooter: document.getElementById('recordsTableFooter'),
    fechaInput: document.getElementById('fecha'),
    puntoVentaInput: document.getElementById('puntoVenta'),

    // reporte
    reportGate: document.getElementById('reportGate'),
    reportPass: document.getElementById('reportPass'),
    btnGateOpen: document.getElementById('btnGateOpen'),
    fechaDesde: document.getElementById('fechaDesde'),
    fechaHasta: document.getElementById('fechaHasta'),
    btnExportarExcel: document.getElementById('btnExportarExcel'),
    btnExportarHTML: document.getElementById('btnExportarHTML'),
    reportStatus: document.getElementById('reportStatus'),
    reportControls: document.getElementById('report-controls'),
    reportTag: document.getElementById('reportTag'),
    reportTableWrapper: document.getElementById('reportTableWrapper')
  };
})(window.Arcadia);

