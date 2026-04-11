import { db } from '../db/client.js';

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS  =  7 * 24 * 60 * 60 * 1000;

export async function sessionMiddleware(req, res, next) {
  const token = req.cookies?.session;
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const now = Date.now();
    const result = await db.execute({
      sql: `SELECT s.id, s.user_id, s.expires_at,
                   u.email, u.name, u.avatar_url
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > ?`,
      args: [token, now],
    });

    if (!result.rows.length) {
      res.clearCookie('session');
      req.user = null;
      return next();
    }

    const row = result.rows[0];
    req.user = {
      id: String(row.user_id),
      email: String(row.email),
      name: row.name ? String(row.name) : null,
      avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    };

    // Sliding renewal
    if (Number(row.expires_at) - now < SEVEN_DAYS) {
      const newExpiry = now + THIRTY_DAYS;
      await db.execute({
        sql: 'UPDATE sessions SET expires_at = ? WHERE token = ?',
        args: [newExpiry, token],
      });
      res.cookie('session', token, cookieOpts(THIRTY_DAYS));
    }
  } catch (err) {
    console.error('[session]', err);
    req.user = null;
  }

  next();
}

export function cookieOpts(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
  };
}
