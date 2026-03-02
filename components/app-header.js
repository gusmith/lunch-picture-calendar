class AppHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="app-header">
        <h1 class="app-title">Lunch Calendar</h1>
        <span class="app-subtitle">What did we eat today?</span>
      </header>
    `;
  }
}
customElements.define('app-header', AppHeader);
