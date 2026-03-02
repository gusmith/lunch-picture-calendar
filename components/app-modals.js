class AppModals extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <!-- Config notice still lives outside this component in index.html -->

      <!-- 1. Add photo choice -->
      <div class="modal-overlay" id="add-modal">
        <div class="modal">
          <button class="modal-close" id="add-modal-close">✕</button>
          <h2 id="add-modal-title">Add photo</h2>
          <p id="add-modal-sub">How would you like to add the lunch photo?</p>
          <div class="modal-actions">
            <button class="btn-icon" id="open-camera-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              Take photo
            </button>
            <button class="btn-icon" id="open-gallery-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              From gallery
            </button>
          </div>
          <input type="file" id="gallery-input" accept="image/*" style="display:none">
        </div>
      </div>

      <!-- 2. Camera -->
      <div class="modal-overlay" id="camera-modal">
        <div class="modal" style="max-width:500px">
          <button class="modal-close" id="camera-modal-close">✕</button>
          <h2>Take a photo</h2>
          <video id="camera-preview" autoplay playsinline muted></video>
          <div class="modal-actions">
            <button class="btn btn-primary" id="snap-btn">📸 Snap</button>
            <button class="btn btn-secondary" id="camera-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>

      <!-- 3. Import — date confirmation -->
      <div class="modal-overlay" id="import-modal">
        <div class="modal">
          <button class="modal-close" id="import-modal-close">✕</button>
          <h2>When was this taken?</h2>
          <p id="import-msg"></p>
          <div class="date-detected" id="import-detected"></div>
          <label class="field-label">Confirm or choose a different date</label>
          <input type="date" id="import-date-input">
          <div class="modal-actions">
            <button class="btn btn-primary"    id="import-confirm-btn">Use this date</button>
            <button class="btn btn-secondary"  id="import-cancel-btn">Cancel</button>
          </div>
        </div>
      </div>

      <!-- 4. Replace confirmation -->
      <div class="modal-overlay" id="replace-modal">
        <div class="modal">
          <button class="modal-close" id="replace-modal-close">✕</button>
          <h2>Replace existing photo?</h2>
          <p>This day already has a photo. Would you like to replace it?</p>
          <img class="existing-thumb" id="replace-thumb" src="" alt="Existing photo">
          <div class="modal-actions">
            <button class="btn btn-danger"    id="replace-confirm-btn">Replace</button>
            <button class="btn btn-secondary" id="replace-cancel-btn">Keep existing</button>
          </div>
        </div>
      </div>

      <!-- Lightbox -->
      <div id="lightbox">
        <button id="lightbox-close">✕</button>
        <img id="lightbox-img" src="" alt="Lunch photo">
        <div id="lightbox-caption"></div>
      </div>

      <!-- Spinner -->
      <div class="spinner-overlay" id="spinner">
        <div class="spinner"></div>
      </div>

      <!-- Toast -->
      <div class="toast" id="toast"></div>

      <!-- Hidden canvas for compression / camera snap -->
      <canvas id="work-canvas" style="display:none"></canvas>
    `;
  }
}
customElements.define('app-modals', AppModals);
