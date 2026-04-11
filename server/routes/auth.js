import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { cookieOpts } from '../middleware/session.js';

const router = Router();
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createSession(userId) {
  const id    = nanoid();
  const token = nanoid(48);
  await db.execute({
    sql: 'INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
    args: [id, userId, token, Date.now() + THIRTY_DAYS],
  });
  return token;
}

// ── Register ─────────────────────────────────────────────────────────────────

router.get('/register', (req, res) => res.render('pages/auth/register'));

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || password.length < 8) {
    return res.render('pages/auth/register', {
      error: 'Email and a password of at least 8 characters are required.',
      values: { email, name },
    });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const id   = nanoid();
    await db.execute({
      sql: 'INSERT INTO users (id, email, password, name, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [id, email.toLowerCase().trim(), hash, name?.trim() || null, Date.now()],
    });

    const token = await createSession(id);
    res.cookie('session', token, cookieOpts(THIRTY_DAYS));
    res.redirect('/dashboard');
  } catch (err) {
    const duplicate = err.message?.includes('UNIQUE');
    res.render('pages/auth/register', {
      error: duplicate ? 'An account with that email already exists.' : 'Registration failed.',
      values: { email, name },
    });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────

router.get('/login', (req, res) => res.render('pages/auth/login', { next: req.query.next || '/dashboard' }));

router.post('/login', async (req, res) => {
  const { email, password, next = '/dashboard' } = req.body;

  const result = await db.execute({
    sql: 'SELECT id, password FROM users WHERE email = ?',
    args: [email?.toLowerCase().trim()],
  });

  const user = result.rows[0];
  const valid = user?.password && await bcrypt.compare(password, String(user.password));

  if (!valid) {
    return res.render('pages/auth/login', {
      error: 'Invalid email or password.',
      values: { email },
      next,
    });
  }

  const token = await createSession(String(user.id));
  res.cookie('session', token, cookieOpts(THIRTY_DAYS));
  res.redirect(next.startsWith('/') ? next : '/dashboard');
});

// ── Logout ────────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res) => {
  const token = req.cookies?.session;
  if (token) {
    await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] });
  }
  res.clearCookie('session');
  res.redirect('/');
});

// ── OAuth ─────────────────────────────────────────────────────────────────────
// TODO: implement Google and GitHub OAuth flows
// Each provider redirects to its authorization URL, then handles the callback
// at /auth/callback/:provider, exchanges the code for tokens, finds or creates
// a user row, links an oauth_accounts row, and creates a session.

router.get('/oauth/:provider', (req, res) => {
  res.status(501).send('OAuth not yet configured.');
});

router.get('/callback/:provider', (req, res) => {
  res.status(501).send('OAuth callback not yet configured.');
});

export default router;
