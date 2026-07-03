import { db } from '../db/client.js';
import { generateListing } from '../ai/adapter.js';

/**
 * POST /items/:id/generate
 *
 * Expects JSON body: { imageBase64, mimeType, notes }
 * Responds with an SSE stream of Datastar patch-signals events (v1.0.2 protocol).
 *
 * Datastar patch-signals event format:
 *   event: datastar-patch-signals
 *   data: signals <JSON>
 *
 * (blank line terminates the event)
 */
export async function aiStream(req, res) {
  const { id } = req.params;

  // Verify item belongs to user
  const check = await db.execute({
    sql: 'SELECT id FROM items WHERE id = ? AND user_id = ?',
    args: [id, req.user.id],
  });
  if (!check.rows.length) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Open SSE connection
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const send = (signals) => {
    res.write(`event: datastar-patch-signals\n`);
    res.write(`data: signals ${JSON.stringify(signals)}\n\n`);
  };

  send({ generating: true, error: null });

  // Datastar sends signals as `imageMimeType`; fall back to DB image if none captured
  let { imageBase64, imageMimeType = 'image/jpeg', notes = '', condition = '' } = req.body;
  const mimeType = imageMimeType;

  if (!imageBase64) {
    const imgRow = await db.execute({
      sql: 'SELECT image_url FROM items WHERE id = ?',
      args: [id],
    });
    const imageUrl = imgRow.rows[0]?.image_url;
    if (typeof imageUrl === 'string' && imageUrl.startsWith('data:')) {
      const comma = imageUrl.indexOf(',');
      imageBase64 = imageUrl.slice(comma + 1);
      const semi  = imageUrl.indexOf(';');
      imageMimeType = imageUrl.slice(5, semi);
    }
  }

  const provider = process.env.AI_PROVIDER ?? 'claude';
  const draft = {};

  try {
    for await (const update of generateListing({ imageBase64, mimeType, notes, condition, provider })) {
      draft[update.field] = update.value;
      send({ [update.field]: update.value });
    }

    // Persist completed draft
    await db.execute({
      sql: `UPDATE items
            SET title=?, description=?, item_specifics=?, category_id=?,
                condition=?, suggested_price=?, ai_provider=?, updated_at=?
            WHERE id=?`,
      args: [
        draft.title ?? null,
        draft.description ?? null,
        draft.item_specifics ? JSON.stringify(draft.item_specifics) : null,
        draft.category_id ?? null,
        draft.condition ?? null,
        draft.suggested_price ?? null,
        provider,
        Date.now(),
        id,
      ],
    });

    send({ generating: false, saved: true });
  } catch (err) {
    console.error('[ai-stream]', err);
    send({ generating: false, error: String(err.message) });
  }

  res.end();
}
