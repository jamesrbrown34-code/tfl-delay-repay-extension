import { SELECTORS } from '../selectors.js';

export class StatusPanel {
  constructor({
    isExpectedTfLPage,
    isMyOysterCardsPage,
    isTfLJourneyHistoryPage,
    pathnameProvider = () => window.location.pathname.toLowerCase()
  }) {
    this.isExpectedTfLPage = isExpectedTfLPage;
    this.isMyOysterCardsPage = isMyOysterCardsPage;
    this.isTfLJourneyHistoryPage = isTfLJourneyHistoryPage;
    this.pathnameProvider = pathnameProvider;
  }

  ensure() {
    if (!this.isExpectedTfLPage()) return null;

    let panel = document.querySelector(SELECTORS.navigation.helperPanel);
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'tfl-delay-helper-panel';
    panel.style.position = 'fixed';
    panel.style.top = '16px';
    panel.style.right = '16px';
    panel.style.zIndex = '2147483647';
    panel.style.background = '#0f766e';
    panel.style.color = '#fff';
    panel.style.borderRadius = '10px';
    panel.style.padding = '10px 12px';
    panel.style.fontSize = '12px';
    panel.style.width = '280px';
    panel.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
    panel.innerHTML = '<strong>TubeRefund</strong><div id="tfl-delay-helper-panel-status" style="margin-top:4px;line-height:1.4"></div>';
    document.body.appendChild(panel);
    return panel;
  }

  update(status, detail = '') {
    const panel = this.ensure();
    if (!panel) return;

    const statusNode = panel.querySelector(SELECTORS.navigation.helperPanelStatus);
    if (!statusNode) return;

    statusNode.innerHTML = detail ? `${status}<br><span style="opacity:0.9">${detail}</span>` : status;
  }

  showReadyState(pageType) {
    if (pageType === 'my-oyster-cards') {
      this.update('Ready on My Oyster cards', 'Use Run full flow in the extension popup to open journey history and begin collection.');
      return;
    }

    if (pageType === 'journey-history') {
      this.update('Ready on Journey history', 'Waiting for collection/analyse command from the extension popup.');
      return;
    }

    if (pageType === 'service-delay-refunds') {
      this.update('Service delay refunds page detected', 'Auto-fill will continue while this tab remains open.');
      return;
    }

    this.update('TubeRefund active');
  }

  showWorkflowProgress(completed, remaining) {
    this.update('Selecting Oyster card', `Submitted ${completed || 0}, remaining ${remaining || 0}.`);
  }
}
