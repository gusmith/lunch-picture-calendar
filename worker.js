/**
 * Lunch Calendar — Cloudflare Worker
 *
 * Bindings required (set in wrangler.toml or Cloudflare dashboard):
 *   - PHOTOS_BUCKET  → R2 bucket called "lunch-photos"
 *   - DB             → D1 database called "lunch-calendar"
 *   - API_KEY        → Secret string (same value set in index.html if you add key-based auth)
 *
 * D1 schema (run once — see setup guide):
 *   CREATE TABLE photos (
 *     date        TEXT PRIMARY KEY,
 *     sha         TEXT NOT NULL,
 *     uploaded_at TEXT NOT NULL
 *   );
 *   CREATE INDEX idx_sha ON photos(sha);
 */

// ── CORS headers ──────────────────────────────────────────────────────────────
// Replace the wildcard with your exact Cloudflare Pages URL once deployed,
// e.g. "https://lunch-calendar.pages.dev"
const ALLOWED_ORIGIN = 'https://lunch-calendar-worker.gwil1248.workers.dev/';

function corsHeaders(extra = {}) {
  return {
    'Access-Control-Allow-Origin':  ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...extra,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({ 'Content-Type': 'application/json' }),
  });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    try {
      // ── GET /api/week?start=YYYY-MM-DD ───────────────────────────────────
      if (method === 'GET' && path === '/api/week') {
        const start = url.searchParams.get('start');
        if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return err('Invalid start date');

        // Build Mon–Fri date strings
        const dates = [];
        const base  = new Date(start);
        for (let i = 0; i < 5; i++) {
          const d = new Date(base);
          d.setUTCDate(d.getUTCDate() + i);
          dates.push(d.toISOString().split('T')[0]);
        }

        const rows = await env.DB
          .prepare(`SELECT date, sha, uploaded_at FROM photos WHERE date IN (${dates.map(() => '?').join(',')})`)
          .bind(...dates)
          .all();

        const map = {};
        for (const row of rows.results) map[row.date] = row;

        const result = dates.map(date => ({
          date,
          hasPhoto:   !!map[date],
          sha:        map[date]?.sha        ?? null,
          uploadedAt: map[date]?.uploaded_at ?? null,
        }));

        return json(result);
      }

      // ── GET /api/photo/:date ─────────────────────────────────────────────
      if (method === 'GET' && /^\/api\/photo\/\d{4}-\d{2}-\d{2}$/.test(path)) {
        const date = path.split('/').pop();
        const obj  = await env.PHOTOS_BUCKET.get(`photos/${date}`);
        if (!obj) return new Response('Not found', { status: 404, headers: corsHeaders() });

        return new Response(obj.body, {
          headers: corsHeaders({
            'Content-Type':  obj.httpMetadata?.contentType ?? 'image/jpeg',
            'Cache-Control': 'private, max-age=86400',
          }),
        });
      }

      // ── POST /api/photo ──────────────────────────────────────────────────
      if (method === 'POST' && path === '/api/photo') {
        let body;
        try { body = await request.json(); }
        catch { return err('Invalid JSON'); }

        const { date, sha, imageData, contentType = 'image/jpeg', force = false } = body;

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return err('Invalid date');
        if (!sha)       return err('Missing sha');
        if (!imageData) return err('Missing imageData');

        // ── Duplicate SHA check ──
        const dupRow = await env.DB
          .prepare('SELECT date FROM photos WHERE sha = ?')
          .bind(sha)
          .first();

        if (dupRow) {
          // Same photo already saved somewhere
          return json({ duplicate: true, existingDate: dupRow.date }, 409);
        }

        // ── Existing photo for this date (replace flow) ──
        const existingRow = await env.DB
          .prepare('SELECT sha FROM photos WHERE date = ?')
          .bind(date)
          .first();

        if (existingRow && !force) {
          // Client should have shown the replace dialog — this is a safety check
          return json({ conflict: true, date }, 409);
        }

        // ── Decode base64 → binary ──
        let binary;
        try {
          const clean = imageData.replace(/^data:image\/\w+;base64,/, '');
          binary = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
        } catch {
          return err('Invalid image data');
        }

        // ── Store in R2 ──
        await env.PHOTOS_BUCKET.put(`photos/${date}`, binary, {
          httpMetadata: { contentType },
        });

        // ── Upsert metadata in D1 ──
        await env.DB
          .prepare('INSERT OR REPLACE INTO photos (date, sha, uploaded_at) VALUES (?, ?, ?)')
          .bind(date, sha, new Date().toISOString())
          .run();

        return json({ success: true, date });
      }

      // ── DELETE /api/photo/:date ──────────────────────────────────────────
      if (method === 'DELETE' && /^\/api\/photo\/\d{4}-\d{2}-\d{2}$/.test(path)) {
        const date = path.split('/').pop();
        await env.PHOTOS_BUCKET.delete(`photos/${date}`);
        await env.DB.prepare('DELETE FROM photos WHERE date = ?').bind(date).run();
        return json({ success: true });
      }

      return new Response('Not found', { status: 404, headers: corsHeaders() });

    } catch (e) {
      console.error('Worker error:', e);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};