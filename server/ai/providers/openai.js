import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompt.js';

const client = new OpenAI();

export async function* generate({ imageBase64, mimeType, notes }) {
  const userContent = [];

  if (imageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${mimeType ?? 'image/jpeg'};base64,${imageBase64}` },
    });
  }

  userContent.push({
    type: 'text',
    text: notes
      ? `Additional notes from the seller: ${notes}`
      : 'Please analyse the item in the image and produce a listing.',
  });

  const response = await client.chat.completions.create({
    model:       process.env.OPENAI_MODEL ?? 'gpt-4o',
    max_tokens:  1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    response_format: { type: 'json_object' },
  });

  const json = JSON.parse(response.choices[0].message.content);
  const fields = ['title', 'description', 'item_specifics', 'category_id', 'condition', 'suggested_price'];
  for (const field of fields) {
    if (json[field] !== undefined) {
      yield { field, value: json[field] };
    }
  }
}
