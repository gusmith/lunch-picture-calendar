/**
 * GET /api/photo/:date
 * Retrieves a photo for a specific date
 *
 * DELETE /api/photo/:date
 * Deletes a photo for a specific date
 */

import { corsHeaders, json, isValidDate, handlePreflight } from '../../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const date = params.date; // Dynamic segment from [date]

  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  // Validate date format
  if (!isValidDate(date)) {
    return new Response('Invalid date format', { status: 400 });
  }

  try {
    // ── GET /api/photo/:date ──────────────────────────────────────────────
    if (request.method === 'GET') {
      return handleGetPhoto(date, request, env);
    }

    // ── DELETE /api/photo/:date ───────────────────────────────────────────
    if (request.method === 'DELETE') {
      return handleDeletePhoto(date, request, env);
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e) {
    console.error(`/api/photo/${date} error:`, e);
    return json({ error: 'Internal server error' }, request, 500);
  }
}

// ── GET Handler ───────────────────────────────────────────────────────────────
async function handleGetPhoto(date, request, env) {
  const obj = await env.PHOTOS_BUCKET.get(`photos/${date}`);

  if (!obj) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(obj.body, {
    headers:  corsHeaders(request, {
      'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
    }),
  });
}

// ── DELETE Handler ────────────────────────────────────────────────────────────
async function handleDeletePhoto(date, request, env) {
  await env.PHOTOS_BUCKET.delete(`photos/${date}`);
  await env.DB.prepare('DELETE FROM photos WHERE date = ?').bind(date).run();

  return json({ success: true }, request);
}