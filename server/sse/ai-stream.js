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

  send({ generating: true, error: null, ai_status: 'Connecting to AI…' });

  // Datastar sends signals as `imageMimeType`; fall back to DB image if none captured
  let { imageBase64, imageMimeType = 'image/jpeg', notes = '', condition = '' } = req.body;

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

  // Captured only after the DB-fallback above has had a chance to correct it —
  // otherwise a non-JPEG fallback image would still be sent to the model
  // labeled as image/jpeg, which Anthropic's API rejects outright.
  const mimeType = imageMimeType;

  const provider = process.env.AI_PROVIDER ?? 'claude';
  const draft = {};

  // The real Anthropic call is a single blocking request with no true
  // token-level streaming, so there's a real gap between "Connecting…" and
  // the first yielded field with zero feedback. Fill it with a progressive
  // ticker so it doesn't look stuck, and clear it the moment real output
  // starts arriving.
  const statusMessages = [
    'Analyzing your photo…',
    'Still working — this can take several seconds…',
    'Almost there…',
  ];
  let statusIdx = 0;
  send({ ai_status: statusMessages[0] });
  const statusInterval = setInterval(() => {
    statusIdx = Math.min(statusIdx + 1, statusMessages.length - 1);
    send({ ai_status: statusMessages[statusIdx] });
  }, 4000);

  try {
    let firstUpdate = true;
    for await (const update of generateListing({ imageBase64, mimeType, notes, condition, provider })) {
      if (firstUpdate) {
        clearInterval(statusInterval);
        send({ ai_status: 'Received response — filling in the listing…' });
        firstUpdate = false;
      }
      draft[update.field] = update.value;
      send({ [update.field]: update.value });
    }

    // Persist completed draft. location/cost use COALESCE since the model only
    // supplies them when found in the seller's notes — an absent value here
    // must never wipe out something the seller already typed in manually.
    await db.execute({
      sql: `UPDATE items
            SET title=?, description=?, item_specifics=?, category_id=?, category_name=?,
                condition=?, suggested_price=?, ai_provider=?, updated_at=?,
                location=COALESCE(?, location), cost=COALESCE(?, cost)
            WHERE id=?`,
      args: [
        draft.title ?? null,
        draft.description ?? null,
        draft.item_specifics ? JSON.stringify(draft.item_specifics) : null,
        draft.category_id ?? null,
        draft.category_name ?? null,
        draft.condition ?? null,
        draft.suggested_price ?? null,
        provider,
        Date.now(),
        draft.location ?? null,
        draft.cost ?? null,
        id,
      ],
    });

    send({ generating: false, saved: true, ai_status: 'Done' });
  } catch (err) {
    console.error('[ai-stream]', err);
    send({ generating: false, error: String(err.message), ai_status: '' });
  } finally {
    clearInterval(statusInterval);
  }

  res.end();
}
