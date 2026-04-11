import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';

const router = Router();

/**
 * POST /sync/batch
 *
 * Body: { items: Array<item> }
 * Each item is a draft that was created or edited offline (from IndexedDB).
 * We upsert them and return the canonical server IDs.
 */
router.post('/batch', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || !items.length) {
    return res.json({ synced: [] });
  }

  const synced = [];
  const now = Date.now();

  for (const item of items) {
    // Use the client-supplied id if it looks like a valid nanoid; otherwise mint new.
    const id = item.id && /^[A-Za-z0-9_-]{21}$/.test(item.id) ? item.id : nanoid();

    await db.execute({
      sql: `INSERT INTO items
              (id, user_id, status, image_url, notes, title, description,
               item_specifics, category_id, condition, suggested_price,
               final_price, currency, created_at, updated_at, synced_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              notes=excluded.notes, title=excluded.title,
              description=excluded.description,
              item_specifics=excluded.item_specifics,
              category_id=excluded.category_id,
              condition=excluded.condition,
              suggested_price=excluded.suggested_price,
              final_price=excluded.final_price,
              updated_at=excluded.updated_at,
              synced_at=excluded.synced_at`,
      args: [
        id, req.user.id, item.status ?? 'draft',
        item.image_url ?? null,
        item.notes ?? null, item.title ?? null,
        item.description ?? null,
        item.item_specifics ? JSON.stringify(item.item_specifics) : null,
        item.category_id ?? null, item.condition ?? null,
        item.suggested_price ?? null, item.final_price ?? null,
        item.currency ?? 'USD',
        item.created_at ?? now, now, now,
      ],
    });

    synced.push({ localId: item.id, serverId: id });
  }

  res.json({ synced });
});

export default router;
