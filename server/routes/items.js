import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { aiStream } from '../sse/ai-stream.js';

const router = Router();

// ── List (dashboard) ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT id, title, status, image_url, suggested_price, final_price, updated_at
          FROM items WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [req.user.id],
  });
  res.render('pages/dashboard', { items: result.rows });
});

// ── New item form ─────────────────────────────────────────────────────────────

router.get('/new', async (req, res) => {
  let draft = null;
  if (req.query.draft) {
    const result = await db.execute({
      sql: 'SELECT id, notes, images, image_url FROM items WHERE id = ? AND user_id = ?',
      args: [req.query.draft, req.user.id],
    });
    draft = result.rows[0] ?? null;
  }
  res.render('pages/item-new', { draft });
});

// ── Create draft ──────────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { images, notes } = req.body ?? {};
  const id  = nanoid();
  const now = Date.now();

  let imageUrl = null;
  let imagesJson = null;

  if (images) {
    let parsed;
    try { parsed = JSON.parse(images); } catch { parsed = null; }
    if (!Array.isArray(parsed)) return res.status(400).json({ error: 'Invalid images payload' });
    if (parsed.length > 20) return res.status(400).json({ error: 'Maximum 20 photos allowed' });
    if (parsed.length) {
      imageUrl = parsed[0];
      imagesJson = JSON.stringify(parsed);
    }
  }

  await db.execute({
    sql: `INSERT INTO items (id, user_id, status, image_url, images, notes, created_at, updated_at)
          VALUES (?, ?, 'draft', ?, ?, ?, ?, ?)`,
    args: [id, req.user.id, imageUrl, imagesJson, notes || null, now, now],
  });

  const redirect = `/items/${id}`;
  if (req.is('json')) return res.json({ redirect, id });
  res.redirect(redirect);
});

// ── Edit / review draft ───────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT * FROM items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id],
  });
  if (!result.rows.length) return res.status(404).render('pages/404');

  const item = result.rows[0];
  if (item.item_specifics) {
    item.item_specifics = JSON.parse(String(item.item_specifics));
  }
  res.render('pages/item-edit', { item });
});

// ── AI generation (SSE) ───────────────────────────────────────────────────────

router.post('/:id/generate', aiStream);

// ── Save draft fields ─────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  const { title, description, item_specifics, category_id, condition, final_price, image_url, images, notes } = req.body;

  if (images) {
    let parsed;
    try { parsed = JSON.parse(images); } catch { parsed = null; }
    if (!Array.isArray(parsed) || parsed.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 photos allowed' });
    }
  }

  await db.execute({
    sql: `UPDATE items
          SET title=?, description=?, item_specifics=?, category_id=?,
              condition=?, final_price=?, image_url=?, images=?, notes=?, updated_at=?
          WHERE id=? AND user_id=?`,
    args: [
      title, description,
      item_specifics ? JSON.stringify(item_specifics) : null,
      category_id, condition,
      final_price ? Number(final_price) : null,
      image_url ?? null,
      images ?? null,
      notes ?? null,
      Date.now(),
      req.params.id, req.user.id,
    ],
  });
  res.json({ ok: true });
});

// ── Delete draft ──────────────────────────────────────────────────────────────

router.delete('/:id', async (req, res) => {
  await db.execute({
    sql: 'DELETE FROM items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id],
  });
  res.json({ ok: true });
});

// ── Publish to eBay ───────────────────────────────────────────────────────────

router.post('/:id/publish', async (req, res) => {
  const { publishItem } = await import('../ebay/client.js');

  const result = await db.execute({
    sql: 'SELECT * FROM items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id],
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

  const item = result.rows[0];
  try {
    const ebayId = await publishItem(req.user.id, item);
    await db.execute({
      sql: `UPDATE items SET status='published', ebay_listing_id=?, updated_at=?
            WHERE id=?`,
      args: [ebayId, Date.now(), req.params.id],
    });
    res.json({ ok: true, ebayListingId: ebayId });
  } catch (err) {
    await db.execute({
      sql: `UPDATE items SET status='failed', updated_at=? WHERE id=?`,
      args: [Date.now(), req.params.id],
    });
    res.status(502).json({ error: err.message });
  }
});

export default router;
