/**
 * GET /api/week?start=YYYY-MM-DD
 * Returns photo metadata for Monday–Friday of the given week
 */

import { err, json, isValidDate, generateWeekDates, handlePreflight } from '../_utils.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return handlePreflight(request);
  }

  if (request.method !== 'GET') {
    return err('Method not allowed', request, 405);
  }

  const url = new URL(request.url);
  const start = url.searchParams.get('start');

  if (!start || !isValidDate(start)) {
    return err('Invalid start date', request);
  }

  try {
    const dates = generateWeekDates(start);

    const rows = await env.DB
      .prepare(
        `SELECT date, sha, uploaded_at FROM photos WHERE date IN (${dates.map(() => '?').join(',')})`
      )
      .bind(...dates)
      .all();

    const map = {};
    for (const row of rows.results) {
      map[row.date] = row;
    }

    const result = dates.map(date => ({
      date,
      hasPhoto: !!map[date],
      sha: map[date]?.sha ?? null,
      uploadedAt: map[date]?.uploaded_at ?? null,
    }));

    return json(result, request);
  } catch (e) {
    console.error('GET /api/week error:', e);
    return err('Internal server error', request, 500);
  }
}