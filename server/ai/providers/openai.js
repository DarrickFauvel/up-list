import OpenAI from 'openai';

const client = new OpenAI();

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
