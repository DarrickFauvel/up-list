import { Router } from 'express';
import { requireAuth } from './middleware/auth-guard.js';
import authRoutes from './routes/auth.js';
import itemRoutes from './routes/items.js';
import ebayRoutes from './routes/ebay.js';
import syncRoutes from './routes/sync.js';

export function createRouter() {
  const router = Router();

  // Public
  router.get('/', (req, res) => {
    if (req.user) return res.redirect('/dashboard');
    res.render('pages/landing');
  });

  // Auth
  router.use('/auth', authRoutes);

  // Protected
  router.use('/dashboard', requireAuth, async (req, res) => {
    const { db } = await import('./db/client.js');
    const result = await db.execute({
      sql: `SELECT id, title, status, image_url, suggested_price, final_price, updated_at
            FROM items WHERE user_id = ? ORDER BY updated_at DESC`,
      args: [req.user.id],
    });
    res.render('pages/dashboard', { items: result.rows });
  });
  router.use('/items',     requireAuth, itemRoutes);
  router.use('/ebay',      requireAuth, ebayRoutes);
  router.use('/sync',      requireAuth, syncRoutes);
  router.use('/settings',  requireAuth, async (req, res) => {
    const { db } = await import('./db/client.js');
    const result = await db.execute({
      sql: 'SELECT id FROM ebay_connections WHERE user_id = ?',
      args: [req.user.id],
    });
    res.render('pages/settings', {
      ebayConnected:    result.rows.length > 0,
      ebayError:        req.query.ebay === 'error',
    });
  });

  return router;
}
