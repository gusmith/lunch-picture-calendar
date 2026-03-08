// import component definitions so index.html can stay slim
import './components/app-header.js';
import './components/week-nav.js';
import './components/calendar.js';
import './components/app-modals.js';

// the rest of the script originally in index.html, minus <script> tags
import Exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/lite.esm.js';

/* ────────────────────────────────────────────────────────────
   In production, Cloudflare Pages substitutes %%API_BASE%%.
   Locally, the placeholder is never substituted, so we detect
   it and fall back to the local wrangler dev port automatically.
   ──────────────────────────────────────────────────────────── */
const _RAW = '%%API_BASE%%';
export const API_BASE = _RAW.includes('%%') ? 'http://localhost:8787' : _RAW;
/* ────────────────────────────────────────────────────────────── */

// ── State ──
export let currentWeekStart = getMonday(new Date());
export let weekPhotos = {};   // { 'YYYY-MM-DD': { sha, uploadedAt } }
export let pending = null; // file being imported/processed
export let cameraStream = null;
export let targetDate = null; // day card clicked

// ── Date helpers ──
export function getMonday(d) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}
export function addDays(d, n) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
export function fmtISO(d)  { return d.toISOString().split('T')[0]; }
export function parseISO(s) {
  const [y,m,day] = s.split('-').map(Number);
  return new Date(y, m - 1, day);
}
export function isWeekend(d) { const n = d.getDay(); return n === 0 || n === 6; }
export function isToday(d)   { return fmtISO(d) === fmtISO(new Date()); }
export function fmtFull(d)   {
  return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
export function fmtWeekLabel(a, b) {
  return `${a.toLocaleDateString('en-GB',{day:'numeric',month:'long'})} – ${b.toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}`;
}

// ── SHA-256 ──
export async function sha256(buf) {
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── Image compression ──
export async function compress(file, maxW = 2800, q = 0.94) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale  = Math.min(1, maxW / img.width);
      const canvas = document.getElementById('work-canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', q));
    };
    img.src = url;
  });
}

// ── API calls ──
export function photoUrl(date) { return `${API_BASE}/api/photo/${date}`; }

export async function apiFetchWeek(weekStart) {
  const res = await fetch(`${API_BASE}/api/week?start=${fmtISO(weekStart)}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('week fetch failed');
  const arr = await res.json();
  const map = {};
  for (const item of arr) {
    if (item.hasPhoto) map[item.date] = { sha: item.sha, uploadedAt: item.uploadedAt };
  }
  return map;
}

export async function apiUpload(date, dataUrl, sha, force = false) {
  const res = await fetch(`${API_BASE}/api/photo`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date, sha,
      imageData:   dataUrl.split(',')[1],
      contentType: 'image/jpeg',
      force,
    }),
  });
  return { status: res.status, data: await res.json() };
}

// ── UI helpers ──
export const spinner   = document.getElementById('spinner');
export const toastEl   = document.getElementById('toast');
let toastTimer;

export function spin(on)  { spinner.classList.toggle('active', on); }
export function showToast(msg, err = false) {
  toastEl.textContent = msg;
  toastEl.className   = 'toast show' + (err ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
}
export function openModal(id)  { document.getElementById(id).classList.add('active'); }
export function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ── Render ──
export function renderCalendar() {
  const cal  = document.getElementById('calendar');
  cal.innerHTML = '';
  const days = Array.from({ length: 5 }, (_, i) => addDays(currentWeekStart, i));
  document.getElementById('week-label').textContent = fmtWeekLabel(days[0], days[4]);

  for (const date of days) {
    const ds  = fmtISO(date);
    const has = !!weekPhotos[ds];

    const card = document.createElement('div');
    card.className  = 'day-card' + (isToday(date) ? ' today' : '');
    card.dataset.date = ds;

    card.innerHTML = `
      <div class="day-header">
        <div class="day-name">${date.toLocaleDateString('en-GB',{weekday:'short'})}</div>
        <div class="day-number">${date.getDate()}</div>
      </div>
      <div class="day-photo-area">
        ${has
          ? `<img src="${photoUrl(ds)}?t=${weekPhotos[ds].uploadedAt}" alt="Lunch ${ds}" loading="lazy">`
          : `<div class="day-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              <span>Add photo</span>
            </div>`
        }
      </div>`;

    card.addEventListener('click', () => onDayClick(ds, has));
    cal.appendChild(card);
  }
}

export async function loadWeek() {
  spin(true);
  try {
    weekPhotos = await apiFetchWeek(currentWeekStart);
    renderCalendar();
  } catch {
    showToast('Could not load photos — check API_BASE config.', true);
    if (API_BASE.includes('YOUR_WORKER')) {
      document.getElementById('config-notice').classList.add('show');
    }
    weekPhotos = {};
    renderCalendar();
  } finally {
    spin(false);
  }
}

// ── Day click ──
export function onDayClick(ds, has) {
  targetDate = ds;
  if (has) {
    openLightbox(ds);
  } else {
    const d = parseISO(ds);
    document.getElementById('add-modal-title').textContent =
      `Add photo — ${d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}`;
    openModal('add-modal');
  }
}

// ── Lightbox ──
export function openLightbox(ds) {
  const d = parseISO(ds);
  document.getElementById('lightbox-img').src         = photoUrl(ds) + `?t=${weekPhotos[ds]?.uploadedAt ?? ''}`;
  document.getElementById('lightbox-caption').textContent = fmtFull(d);
  document.getElementById('lightbox').classList.add('active');
}

document.getElementById('lightbox-close').onclick = () =>
  document.getElementById('lightbox').classList.remove('active');
document.getElementById('lightbox').addEventListener('click', e => {
  if (e.target === document.getElementById('lightbox'))
    document.getElementById('lightbox').classList.remove('active');
});

// ── Camera ──
document.getElementById('open-camera-btn').onclick = async () => {
  closeModal('add-modal');
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    document.getElementById('camera-preview').srcObject = cameraStream;
    openModal('camera-modal');
  } catch {
    showToast('Cannot access camera', true);
    openModal('add-modal');
  }
};

export function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
}
document.getElementById('camera-modal-close').onclick = () => { stopCamera(); closeModal('camera-modal'); };
document.getElementById('camera-cancel-btn').onclick  = () => { stopCamera(); closeModal('camera-modal'); };

document.getElementById('snap-btn').onclick = async () => {
  const video  = document.getElementById('camera-preview');
  const canvas = document.getElementById('work-canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  stopCamera();
  closeModal('camera-modal');

  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  const buf     = await (await fetch(dataUrl)).arrayBuffer();
  const sha     = await sha256(buf);
  await processUpload(targetDate, dataUrl, sha);
};

// ── Gallery import ──
document.getElementById('open-gallery-btn').onclick = () =>
  document.getElementById('gallery-input').click();

document.getElementById('gallery-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  closeModal('add-modal');
  await handleFileImport(file);
});

export async function handleFileImport(file) {
  spin(true);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const sha         = await sha256(arrayBuffer);
    const dataUrl     = await compress(file);

    let exifDate = null;
    try {
      const exif = await Exifr.parse(file, { pick: ['DateTimeOriginal', 'DateTime'] });
      const raw  = exif?.DateTimeOriginal ?? exif?.DateTime;
      if (raw) exifDate = new Date(raw);
    } catch { /* no EXIF */ }

    pending = { sha, dataUrl, exifDate };
    spin(false);
    showImportModal(exifDate);
  } catch {
    spin(false);
    showToast('Error reading file', true);
  }
}

export function showImportModal(exifDate) {
  const msg      = document.getElementById('import-msg');
  const detected = document.getElementById('import-detected');
  const input    = document.getElementById('import-date-input');

  let defaultDate = fmtISO(new Date());

  if (exifDate && !isNaN(exifDate)) {
    defaultDate = fmtISO(exifDate);
    if (isWeekend(exifDate)) {
      msg.textContent = `This photo was taken on ${fmtFull(exifDate)}, which is a weekend. Please choose a school day.`;
    } else {
      msg.textContent = `This photo appears to have been taken on ${fmtFull(exifDate)}. Is that the right school day?`;
    }
    detected.textContent = fmtFull(exifDate);
  } else {
    msg.textContent = "We couldn't detect when this photo was taken. Please choose the right date.";
    detected.textContent = 'No date found in photo';
  }

  input.value = defaultDate;
  openModal('import-modal');
}

document.getElementById('import-confirm-btn').onclick = async () => {
  const ds = document.getElementById('import-date-input').value;
  if (!ds) { showToast('Please pick a date', true); return; }
  const d  = parseISO(ds);
  if (isWeekend(d)) { showToast('Please choose a school day (Mon–Fri)', true); return; }

  closeModal('import-modal');
  currentWeekStart = getMonday(d);
  await loadWeek();
  await processUpload(ds, pending.dataUrl, pending.sha);
};

document.getElementById('import-cancel-btn').onclick   = () => { pending = null; closeModal('import-modal'); };
document.getElementById('import-modal-close').onclick  = () => { pending = null; closeModal('import-modal'); };

// ── Upload pipeline ──
export async function processUpload(ds, dataUrl, sha) {
  if (weekPhotos[ds]) {
    // Show existing photo and ask to replace
    document.getElementById('replace-thumb').src = photoUrl(ds) + `?t=${weekPhotos[ds].uploadedAt}`;
    pending = { ...(pending ?? {}), ds, dataUrl, sha };
    openModal('replace-modal');
    return;
  }
  await doUpload(ds, dataUrl, sha, false);
}

document.getElementById('replace-confirm-btn').onclick = async () => {
  closeModal('replace-modal');
  const { ds, dataUrl, sha } = pending;
  await doUpload(ds, dataUrl, sha, true);
};

document.getElementById('replace-cancel-btn').onclick  = () => { pending = null; closeModal('replace-modal'); showToast('Kept existing photo'); };
document.getElementById('replace-modal-close').onclick = () => { pending = null; closeModal('replace-modal'); };

export async function doUpload(ds, dataUrl, sha, force) {
  spin(true);
  try {
    const { status, data } = await apiUpload(ds, dataUrl, sha, force);

    if (status === 409) {
      const d = parseISO(data.existingDate ?? ds);
      showToast(`This photo was already saved for ${fmtFull(d)}`, true);
      return;
    }
    if (status !== 200) throw new Error(data.error ?? 'Upload failed');

    showToast('Photo saved! 🥗');
    pending = null;
    weekPhotos = await apiFetchWeek(currentWeekStart);
    renderCalendar();
  } catch {
    showToast('Upload failed — please try again.', true);
  } finally {
    spin(false);
  }
}

// ── Misc modal close buttons ──
document.getElementById('add-modal-close').onclick = () => closeModal('add-modal');

// ── Week navigation ──
document.getElementById('prev-week').onclick = () => { currentWeekStart = addDays(currentWeekStart, -7); loadWeek(); };
document.getElementById('next-week').onclick = () => { currentWeekStart = addDays(currentWeekStart,  7); loadWeek(); };

// ── Init ──
if (!API_BASE.includes('localhost') && API_BASE.includes('YOUR_WORKER')) {
  document.getElementById('config-notice').classList.add('show');
}
loadWeek();
