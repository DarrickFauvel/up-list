import { nanoid } from 'nanoid';
import { db } from '../db/client.js';

const SANDBOX  = process.env.EBAY_SANDBOX === 'true';
const AUTH_URL = SANDBOX
  ? 'https://auth.sandbox.ebay.com/oauth2/authorize'
  : 'https://auth.ebay.com/oauth2/authorize';
const TOKEN_URL = SANDBOX
  ? 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
  : 'https://api.ebay.com/identity/v1/oauth2/token';

const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.inventory.readonly',
].join(' ');

export function getAuthUrl() {
  const params = new URLSearchParams({
    client_id:     process.env.EBAY_APP_ID,
    redirect_uri:  process.env.EBAY_REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES,
  });
  return `${AUTH_URL}?${params}`;
}

export async function handleCallback(code, userId) {
  const credentials = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`
  ).toString('base64');

  const body = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: process.env.EBAY_REDIRECT_URI,
  });

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`eBay token exchange failed: ${text}`);
  }

  const data = await resp.json();

  // Upsert — one connection per user
  const existing = await db.execute({
    sql: 'SELECT id FROM ebay_connections WHERE user_id = ?',
    args: [userId],
  });

  const id = existing.rows.length ? String(existing.rows[0].id) : nanoid();
  await db.execute({
    sql: `INSERT INTO ebay_connections (id, user_id, access_token, refresh_token, expires_at, scope)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            access_token=excluded.access_token,
            refresh_token=excluded.refresh_token,
            expires_at=excluded.expires_at,
            scope=excluded.scope`,
    args: [
      id, userId,
      data.access_token,
      data.refresh_token,
      Date.now() + (data.expires_in ?? 7200) * 1000,
      data.scope ?? null,
    ],
  });
}

export async function getAccessToken(userId) {
  const result = await db.execute({
    sql: 'SELECT * FROM ebay_connections WHERE user_id = ?',
    args: [userId],
  });
  if (!result.rows.length) throw new Error('No eBay connection found. Please connect your account.');

  const conn = result.rows[0];
  // Refresh if within 5 minutes of expiry
  if (Number(conn.expires_at) - Date.now() < 300_000) {
    return refreshToken(userId, String(conn.refresh_token));
  }
  return String(conn.access_token);
}

async function refreshToken(userId, refreshToken) {
  const credentials = Buffer.from(
    `${process.env.EBAY_APP_ID}:${process.env.EBAY_CERT_ID}`
  ).toString('base64');

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });

  if (!resp.ok) throw new Error('eBay token refresh failed');

  const data = await resp.json();
  await db.execute({
    sql: `UPDATE ebay_connections
          SET access_token=?, expires_at=? WHERE user_id=?`,
    args: [data.access_token, Date.now() + (data.expires_in ?? 7200) * 1000, userId],
  });
  return data.access_token;
}
