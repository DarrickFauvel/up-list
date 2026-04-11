/**
 * Provider-agnostic AI adapter.
 *
 * Each provider module in ./providers/ must export an async generator:
 *   async function* generate({ imageBase64, mimeType, notes })
 *
 * Yields objects of shape:
 *   { field: string, value: string | number | object }
 *
 * Fields: title | description | item_specifics | category_id | condition | suggested_price
 */
export async function* generateListing({ imageBase64, mimeType, notes, provider }) {
  const name = provider ?? process.env.AI_PROVIDER ?? 'claude';
  const mod  = await import(`./providers/${name}.js`);
  yield* mod.generate({ imageBase64, mimeType, notes });
}
