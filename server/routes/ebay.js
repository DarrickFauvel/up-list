import { Router } from 'express';
import { getAuthUrl, handleCallback } from '../ebay/auth.js';
import { db } from '../db/client.js';

const router = Router();

// Redirect user to eBay OAuth consent page
router.get('/connect', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

// eBay redirects back here with ?code=
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/settings?ebay=error');

  try {
    await handleCallback(String(code), req.user.id);
    res.redirect('/settings?ebay=connected');
  } catch (err) {
    console.error('[ebay/callback]', err);
    res.redirect('/settings?ebay=error');
  }
});

// Disconnect eBay
router.post('/disconnect', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM ebay_connections WHERE user_id = ?',
    args: [req.user.id],
  });
  res.redirect('/settings?ebay=disconnected');
});

export default router;
