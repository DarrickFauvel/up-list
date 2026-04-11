import { getAccessToken } from './auth.js';

const SANDBOX = process.env.EBAY_SANDBOX === 'true';
const BASE_URL = SANDBOX
  ? 'https://api.sandbox.ebay.com'
  : 'https://api.ebay.com';

async function ebayFetch(userId, path, options = {}) {
  const token = await getAccessToken(userId);
  const resp  = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en-US',
      ...options.headers,
    },
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`eBay API error ${resp.status}: ${body}`);
  }

  return resp.status === 204 ? null : resp.json();
}

/**
 * Publish an item draft to eBay.
 * Returns the eBay listing ID on success.
 */
export async function publishItem(userId, item) {
  const sku = String(item.id);

  // 1. Create/replace inventory item
  await ebayFetch(userId, `/sell/inventory/v1/inventory_item/${sku}`, {
    method: 'PUT',
    body: JSON.stringify({
      product: {
        title:       item.title,
        description: item.description,
        aspects:     item.item_specifics
          ? JSON.parse(String(item.item_specifics))
          : {},
      },
      condition:            mapCondition(String(item.condition ?? 'USED_GOOD')),
      availability: {
        shipToLocationAvailability: { quantity: 1 },
      },
    }),
  });

  // 2. Create offer
  const offer = await ebayFetch(userId, '/sell/inventory/v1/offer', {
    method: 'POST',
    body: JSON.stringify({
      sku,
      marketplaceId: 'EBAY_US',
      format:        'FIXED_PRICE',
      listingDescription: item.description,
      pricingSummary: {
        price: {
          value:    String(item.final_price ?? item.suggested_price ?? 9.99),
          currency: item.currency ?? 'USD',
        },
      },
      categoryId: item.category_id ?? '99',
      listingPolicies: {
        // TODO: populate with user's saved eBay policy IDs
        fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID ?? '',
        paymentPolicyId:     process.env.EBAY_PAYMENT_POLICY_ID ?? '',
        returnPolicyId:      process.env.EBAY_RETURN_POLICY_ID ?? '',
      },
    }),
  });

  // 3. Publish offer
  const published = await ebayFetch(
    userId,
    `/sell/inventory/v1/offer/${offer.offerId}/publish`,
    { method: 'POST' }
  );

  return published?.listingId ?? offer.offerId;
}

function mapCondition(condition) {
  const map = {
    NEW:          'NEW',
    LIKE_NEW:     'LIKE_NEW',
    USED_GOOD:    'USED_EXCELLENT',
    USED_FAIR:    'USED_GOOD',
    FOR_PARTS:    'FOR_PARTS_OR_NOT_WORKING',
  };
  return map[condition] ?? 'USED_GOOD';
}
