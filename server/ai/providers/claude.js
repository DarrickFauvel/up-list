import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert eBay seller. Given an image and optional notes about an item,
produce a complete, accurate eBay listing. Respond ONLY with a JSON object containing these fields:
- title: string (max 80 chars, eBay-optimised with keywords first)
- description: string (HTML-safe plain text, 2-4 paragraphs)
- item_specifics: object (key/value pairs — Brand, Color, Size, Material, etc. as relevant)
- category_id: string (the most appropriate eBay leaf category ID as a string)
- condition: one of NEW | LIKE_NEW | USED_GOOD | USED_FAIR | FOR_PARTS
- suggested_price: number (USD, fair market value for a fixed-price listing)`;

export async function* generate({ imageBase64, mimeType, notes }) {
  const userContent = [];

  if (imageBase64) {
    userContent.push({
      type: 'image',
      source: {
        type:       'base64',
        media_type: mimeType ?? 'image/jpeg',
        data:       imageBase64,
      },
    });
  }

  userContent.push({
    type: 'text',
    text: notes
      ? `Additional notes from the seller: ${notes}`
      : 'Please analyse the item in the image and produce a listing.',
  });

  const stream = client.messages.stream({
    model:      process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
    max_tokens: 1024,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userContent }],
  });

  let buffer = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      buffer += event.delta.text;
    }
  }

  // Parse the complete JSON response
  const json = extractJson(buffer);
  if (!json) throw new Error('AI returned unparseable response');

  const fields = ['title', 'description', 'item_specifics', 'category_id', 'condition', 'suggested_price'];
  for (const field of fields) {
    if (json[field] !== undefined) {
      yield { field, value: json[field] };
    }
  }
}

function extractJson(text) {
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/```\s*$/m, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Try to find a JSON object anywhere in the text
    const match = text.match(/\{[\s\S]+\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { return null; }
    }
    return null;
  }
}
