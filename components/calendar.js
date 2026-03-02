class CalendarGrid extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `<div class="calendar" id="calendar"></div>`;
  }
}
customElements.define('calendar-grid', CalendarGrid);
