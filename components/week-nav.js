class WeekNav extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <nav class="week-nav">
        <button class="nav-btn" id="prev-week" title="Previous week">&#8592;</button>
        <span class="week-label" id="week-label"></span>
        <button class="nav-btn" id="next-week" title="Next week">&#8594;</button>
      </nav>
    `;
  }
}
customElements.define('week-nav', WeekNav);
