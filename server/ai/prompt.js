export const CONDITION_LABELS = {
  NEW:        'New',
  LIKE_NEW:   'Like New',
  USED_GOOD:  'Used – Good',
  USED_FAIR:  'Used – Fair',
  FOR_PARTS:  'For Parts',
};

const TITLE_MAX_LENGTH = 80;

// Forces the seller's chosen condition onto the AI's draft rather than trusting
// the model to comply with the prompt — the model only treats "condition
// qualifier" as an optional title component, so it can't be relied on to
// mention it every time.
export function applyCondition(json, condition) {
  if (!condition || !json) return json;
  json.condition = condition;

  const label = CONDITION_LABELS[condition] ?? condition;
  if (json.title && !json.title.toLowerCase().includes(label.toLowerCase())) {
    // Truncate the model's title if needed rather than silently skipping the
    // condition when it doesn't fit — a stray unrelated "New" elsewhere in
    // the title (e.g. a "New Balance" brand name) must never be mistaken
    // for the seller's actual chosen condition.
    const suffix    = ` ${label}`;
    const available = Math.max(0, TITLE_MAX_LENGTH - suffix.length);
    json.title = `${json.title.slice(0, available).trimEnd()}${suffix}`.trim();
  }
  return json;
}

export const SYSTEM_PROMPT = `You are an expert eBay seller. Given an image and optional notes about an item,
produce a complete, accurate eBay listing. Respond ONLY with a JSON object containing these fields:
- title: string (max 80 characters. Follow eBay's optimal search-ranking title pattern, front-loaded with
  the highest-value keywords: Brand + Product Type/Name + Model or Key Identifier + Distinguishing
  Attributes (Size, Color, Material) + Condition qualifier if notable (e.g. "New", "Vintage", "Rare").
  Omit any component that isn't known or applicable rather than guessing. Use plain title case — no ALL
  CAPS, no promotional filler ("L@@K", "WOW", "!!!"), no unnecessary punctuation. Use as much of the
  80-character limit as naturally fits to maximize keyword coverage.)
- description: string (HTML-safe plain text, 2-4 paragraphs)
- item_specifics: object (key/value pairs — Brand, Color, Size, Material, etc. as relevant)
- category_id: string (the most appropriate eBay leaf category ID as a string)
- category_name: string (the human-readable name of that eBay category, e.g. "Cell Phones & Smartphones")
- condition: one of NEW | LIKE_NEW | USED_GOOD | USED_FAIR | FOR_PARTS
- suggested_price: number (USD, fair market value for a fixed-price listing)`;
