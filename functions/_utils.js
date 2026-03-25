const ALLOWED_ORIGIN = 'https://lunch-picture-calendar.pages.dev';

export function handlePreflight(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export function corsHeaders(request, extra = {}) {
  let allowOrigin = ALLOWED_ORIGIN;
  if (request) {
    const origin = request.headers.get('Origin');
    if (origin && (
      origin.startsWith('http://localhost') || 
      origin.startsWith('http://127.0.0.1')
    )) {
      allowOrigin = origin;
    }
  }
  return {
    'Access-Control-Allow-Origin':  allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, CF-Authorization',
    'Access-Control-Allow-Credentials': 'true',
    ...extra,
  };
}

export function json(data, request, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(request, { 'Content-Type': 'application/json' }),
  });
}

export function err(msg, request, status = 400) {
  return json({ error: msg }, request, status);
}


// ── Date validation ───────────────────────────────────────────────────────────
export function isValidDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}
 
// ── Generate date range (Mon–Fri) ─────────────────────────────────────────────
export function generateWeekDates(startDate) {
  const dates = [];
  const base = new Date(startDate);
  for (let i = 0; i < 5; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}
 
// ── Image data decoding ───────────────────────────────────────────────────────
export function decodeImageData(imageData) {
  try {
    const clean = imageData.replace(/^data:image\/\w+;base64,/, '');
    return Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  } catch {
    return null;
  }
}