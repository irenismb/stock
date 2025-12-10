window.Arcadia = window.Arcadia || {};
(function (A) {
  'use strict';

  const { Utils, UI } = A;
  const state = A.state;
  const App = A.App;

  Object.assign(App, {
    init(){
      this.populatePuntoVentaSelect();
      this.loadSession();

      this.bindNav();
      this.bindCaptureEvents();
      this.bindReportEvents();

      this.updateNetworkStatus();

      window.addEventListener('online', () => this.updateNetworkStatus());
      window.addEventListener('offline', () => this.updateNetworkStatus());

      const ayer = Utils.yesterdayISO();
      if (UI.fechaDesde) UI.fechaDesde.value = ayer;
      if (UI.fechaHasta) UI.fechaHasta.value = ayer;

      UI.resumeLastBtn.disabled = !(state.session.date && state.session.pos);

      if (UI.reportPass) UI.reportPass.value = '';
      UI.reportTableWrapper?.classList.add('hidden');
    },

    /* ---------- Navegación ---------- */
    bindNav(){
      UI.goReportBtn.addEventListener('click', () => {
        this.showSection('report');
        if (!state.reportUnlocked) {
          UI.reportGate.classList.remove('hidden');
          UI.reportControls.classList.add('hidden');
          if (UI.reportPass) UI.reportPass.value = '';
        }
      });

      UI.goCaptureBtn.addEventListener('click', () => this.showSection('capture'));
      UI.backHome1.addEventListener('click', () => this.showSection('home'));
      UI.backHome2.addEventListener('click', () => this.showSection('home'));

      UI.resumeLastBtn.addEventListener('click', () => {
        if(state.session.date && state.session.pos){
          this.showSection('capture');
          this.startSession(state.session.date, state.session.pos, true);
          UI.resumeHint.style.display = '';
        }
      });
    },

    showSection(name){
      UI.home.classList.toggle('hidden', name!=='home');
      UI.capture.classList.toggle('hidden', name!=='capture');
      UI.report.classList.toggle('hidden', name!=='report');

      if(name==='capture' && !(state.session.date && state.session.pos)){
        UI.fechaInput.value = Utils.yesterdayISO();
      }

      if(name==='report'){
        UI.reportTag.textContent = 'Reporte';
        UI.reportTableWrapper?.classList.add('hidden');

        if (!state.reportUnlocked) {
          UI.reportGate.classList.remove('hidden');
          UI.reportControls.classList.add('hidden');
          if (UI.reportPass) UI.reportPass.value = '';
        } else {
          // Intentar revalidar soporte Excel al entrar otra vez
          this.refreshExportSupport();
        }
      }
    }
  });

  // Bootstrap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }

})(window.Arcadia);
