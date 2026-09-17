import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import { aiStream } from '../sse/ai-stream.js';

const router = Router();

// ── List (dashboard) ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const result = await db.execute({
    sql: `SELECT id, title, status, suggested_price, final_price, updated_at,
                 (image_url IS NOT NULL) AS has_image
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

// ── Thumbnail ─────────────────────────────────────────────────────────────────
// Serves the item's primary photo as a real image response (not inlined base64),
// so the dashboard can reference it by URL and the browser can cache/lazy-load it.

router.get('/:id/photo', async (req, res) => {
  const result = await db.execute({
    sql: 'SELECT image_url FROM items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id],
  });
  const imageUrl = result.rows[0]?.image_url;
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:')) {
    return res.status(404).end();
  }

  const comma = imageUrl.indexOf(',');
  const semi  = imageUrl.indexOf(';');
  res.setHeader('Content-Type', imageUrl.slice(5, semi));
  // Safe to cache forever: the URL is fingerprinted with ?v=<updated_at> by the caller.
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(Buffer.from(imageUrl.slice(comma + 1), 'base64'));
});

// ── AI generation (SSE) ───────────────────────────────────────────────────────

router.post('/:id/generate', aiStream);

// ── Save draft fields ─────────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  const {
    title, description, item_specifics, category_id, category_name, condition, final_price,
    image_url, images, notes,
    sku, location, cost,
    shipping_weight, shipping_length, shipping_width, shipping_height,
  } = req.body;

  if (images) {
    let parsed;
    try { parsed = JSON.parse(images); } catch { parsed = null; }
    if (!Array.isArray(parsed) || parsed.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 photos allowed' });
    }
  }

  await db.execute({
    sql: `UPDATE items
          SET title=?, description=?, item_specifics=?, category_id=?, category_name=?,
              condition=?, final_price=?, image_url=?, images=?, notes=?,
              sku=?, location=?, cost=?,
              shipping_weight=?, shipping_length=?, shipping_width=?, shipping_height=?,
              updated_at=?
          WHERE id=? AND user_id=?`,
    args: [
      title, description,
      item_specifics ? JSON.stringify(item_specifics) : null,
      category_id, category_name ?? null, condition,
      final_price ? Number(final_price) : null,
      image_url ?? null,
      images ?? null,
      notes ?? null,
      sku ?? null, location ?? null,
      cost ? Number(cost) : null,
      shipping_weight ? Number(shipping_weight) : null,
      shipping_length ? Number(shipping_length) : null,
      shipping_width  ? Number(shipping_width)  : null,
      shipping_height ? Number(shipping_height) : null,
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

// ── Save as an eBay draft ───────────────────────────────────────────────────

router.post('/:id/publish', async (req, res) => {
  const { createDraftOffer } = await import('../ebay/client.js');

  const result = await db.execute({
    sql: 'SELECT * FROM items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id],
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

  const item = result.rows[0];
  try {
    const offerId = await createDraftOffer(req.user.id, item);
    await db.execute({
      sql: `UPDATE items SET status='ebay_draft', ebay_offer_id=?, updated_at=?
            WHERE id=?`,
      args: [offerId, Date.now(), req.params.id],
    });
    res.json({ ok: true, ebayOfferId: offerId });
  } catch (err) {
    await db.execute({
      sql: `UPDATE items SET status='failed', updated_at=? WHERE id=?`,
      args: [Date.now(), req.params.id],
    });
    res.status(502).json({ error: err.message });
  }
});

// ── Go live on eBay ──────────────────────────────────────────────────────────

router.post('/:id/go-live', async (req, res) => {
  const { publishOffer } = await import('../ebay/client.js');

  const result = await db.execute({
    sql: 'SELECT * FROM items WHERE id = ? AND user_id = ?',
    args: [req.params.id, req.user.id],
  });
  if (!result.rows.length) return res.status(404).json({ error: 'Not found' });

  const item = result.rows[0];
  if (!item.ebay_offer_id) {
    return res.status(400).json({ error: 'No eBay draft to publish yet — save a draft first.' });
  }

  try {
    const listingId = await publishOffer(req.user.id, item.ebay_offer_id);
    await db.execute({
      sql: `UPDATE items SET status='published', ebay_listing_id=?, updated_at=?
            WHERE id=?`,
      args: [listingId, Date.now(), req.params.id],
    });
    res.json({ ok: true, ebayListingId: listingId });
  } catch (err) {
    await db.execute({
      sql: `UPDATE items SET status='failed', updated_at=? WHERE id=?`,
      args: [Date.now(), req.params.id],
    });
    res.status(502).json({ error: err.message });
  }
});

export default router;
