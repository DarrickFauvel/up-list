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
  router.use('/dashboard', requireAuth, (req, res) => res.render('pages/dashboard'));
  router.use('/items',     requireAuth, itemRoutes);
  router.use('/ebay',      requireAuth, ebayRoutes);
  router.use('/sync',      requireAuth, syncRoutes);
  router.use('/settings',  requireAuth, (req, res) => res.render('pages/settings'));

  return router;
}
