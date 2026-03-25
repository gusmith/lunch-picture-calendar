/**
 * POST /api/photo
 * Uploads a photo for a specific date
 *
 * Body:
 *   {
 *     date: "YYYY-MM-DD",
 *     sha: "sha256hash",
 *     imageData: "base64string",
 *     contentType: "image/jpeg" (optional),
 *     force: false (optional, true to replace existing)
 *   }
 *
 * Responses:
 *   200 { success: true, date }
 *   409 { duplicate: true, existingDate } - SHA already exists elsewhere
 *   409 { conflict: true, date } - Photo exists for this date, need force=true
 *   400+ various validation errors
 */

import { err, json, isValidDate, decodeImageData, handlePreflight } from '../_utils.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  if (request.method !== 'POST') {
    return err('Method not allowed', request, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return err('Invalid JSON', request, 400);
  }

  const { date, sha, imageData, contentType = 'image/jpeg', force = false } = body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!date || !isValidDate(date)) {
    return err('Invalid date', request, 400);
  }
  if (!sha) {
    return err('Missing sha', request, 400);
  }
  if (!imageData) {
    return err('Missing imageData', request, 400);
  }

  try {
    // ── Duplicate SHA check ───────────────────────────────────────────────
    // Same photo already saved on a different date
    const dupRow = await env.DB
      .prepare('SELECT date FROM photos WHERE sha = ?')
      .bind(sha)
      .first();

    if (dupRow) {
      return json({ duplicate: true, existingDate: dupRow.date }, request, 409);
    }

    // ── Existing photo for this date ──────────────────────────────────────
    // Photo already exists for this date; ask user to confirm replacement
    const existingRow = await env.DB
      .prepare('SELECT sha FROM photos WHERE date = ?')
      .bind(date)
      .first();

    if (existingRow && !force) {
      return json({ conflict: true, date }, request, 409);
    }

    // ── Decode image data ─────────────────────────────────────────────────
    const binary = decodeImageData(imageData);
    if (!binary) {
      return err('Invalid image data', request, 400);
    }

    // ── Store in R2 ──────────────────────────────────────────────────────
    await env.PHOTOS_BUCKET.put(`photos/${date}`, binary, {
      httpMetadata: { contentType },
    });

    // ── Upsert metadata in D1 ─────────────────────────────────────────────
    await env.DB
      .prepare('INSERT OR REPLACE INTO photos (date, sha, uploaded_at) VALUES (?, ?, ?)')
      .bind(date, sha, new Date().toISOString())
      .run();

    return json({ success: true, date }, request);
  } catch (e) {
    console.error('POST /api/photo error:', e);
    return err('Internal server error', 500);
  }
}