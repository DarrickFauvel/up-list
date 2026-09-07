import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT, CONDITION_LABELS, applyCondition } from '../prompt.js';

const client = new Anthropic();

export async function* generate({ imageBase64, mimeType, notes, condition }) {
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

  const textParts = [];
  if (condition) {
    textParts.push(`The seller has already specified the item's condition as "${CONDITION_LABELS[condition] ?? condition}". Use this exact condition in your response, and write the title, description, and price to match it — do not infer a different condition.`);
  }
  textParts.push(notes
    ? `Additional notes from the seller: ${notes}`
    : 'Please analyse the item in the image and produce a listing.');

  userContent.push({ type: 'text', text: textParts.join('\n\n') });

  const response = await client.messages.create({
    model:      process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5',
    max_tokens: 1536,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: userContent }],
  });

  const buffer = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // TEMP (dev aid): surface the raw model text immediately, before parsing,
  // so it's visible even if extractJson() below fails.
  yield { field: 'ai_raw_output', value: buffer };

  // Parse the complete JSON response
  const json = extractJson(buffer);
  if (!json) throw new Error('AI returned unparseable response');
  applyCondition(json, condition);

  const fields = [
    'title', 'description', 'item_specifics', 'category_id', 'category_name',
    'category_suggestions', 'condition', 'suggested_price', 'location', 'cost',
  ];
  for (const field of fields) {
    // Skip null/undefined rather than yielding it — location/cost are only
    // present when the model actually found them in the seller's notes, and
    // yielding null would otherwise blank out whatever the seller already
    // typed into those fields.
    if (json[field] !== undefined && json[field] !== null) {
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
