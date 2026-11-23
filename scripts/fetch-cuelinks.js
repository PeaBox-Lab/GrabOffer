const fs = require('fs');
const path = require('path');

const API_KEY = process.env.CUELINKS_API_KEY;
const BASE = 'https://developers.cuelinks.com/pub_api/v3';
const OUT = path.join(__dirname, '..', 'data', 'deals.json');
const CACHE_IMG = path.join(__dirname, '..', 'data', 'image-cache.json');

if (!API_KEY) {
  console.error('Missing CUELINKS_API_KEY environment variable.');
  process.exit(1);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function normalizeCategory(name) {
  const raw = String(name || '').trim();
  const map = {
    'health & beauty': 'Health & Beauty',
    'fashion': 'Fashion',
    'electronics': 'Electronics',
    'mobiles': 'Mobiles & Accessories',
    'mobile': 'Mobiles & Accessories',
    'accessories': 'Mobiles & Accessories',
    'home & kitchen': 'Home & Kitchen',
    'travel': 'Travel',
    'education': 'Education',
    'software': 'Software & Services',
    'services': 'Software & Services',
    'sports': 'Sports & Outdoors',
    'entertainment': 'Entertainment',
    'gaming': 'Gaming',
    'flowers & gifts': 'Gifts & Flowers',
    'baby & kids': 'Baby & Kids',
    'books': 'Books & Stationery',
    'food & grocery': 'Food & Grocery',
    'grocery': 'Food & Grocery',
    'finance': 'Finance',
    'recharge': 'Finance',
  };
  return map[raw.toLowerCase()] || raw || 'Others';
}

function buildTags(offer, category) {
  const tags = new Set([category]);
  if (offer.campaign_name) tags.add(offer.campaign_name);
  if (offer.coupon_code) tags.add('Coupon Code');
  if (offer.offer_type === 'deal') tags.add('Deal');
  if (offer.percent_off) tags.add(`${Math.round(Number(offer.percent_off))}% Off`);
  if (offer.shipping_charge && /free/i.test(String(offer.shipping_charge))) tags.add('Free Delivery');
  const cats = Array.isArray(offer.categories) ? offer.categories : [];
  cats.slice(0, 2).forEach((c) => { if (c && c.name) tags.add(normalizeCategory(c.name)); });
  return [...tags].slice(0, 8);
}

async function fetchPage(page, perPage) {
  const url = new URL(`${BASE}/offers`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('sort', 'created_at');
  url.searchParams.set('order', 'desc');
  const res = await fetch(url.toString(), {
    headers: { 'Authorization': `Token ${API_KEY}`, 'Accept': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cuelinks API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function main() {
  const perPage = 500;
  let page = 1;
  let totalPages = 1;
  const offers = [];

  while (page <= totalPages) {
    console.log(`Fetching offers page ${page}/${totalPages}...`);
    const data = await fetchPage(page, perPage);
    const rows = Array.isArray(data.data) ? data.data : [];
    offers.push(...rows);
    const meta = data.meta || {};
    totalPages = Number(meta.total_pages || 1);
    page += 1;
    if (page <= totalPages) await new Promise((r) => setTimeout(r, 250));
  }

  const imageCache = readJson(CACHE_IMG, {});
  const deals = offers.map((offer) => {
    const category = normalizeCategory(offer.categories?.[0]?.name);
    const id = String(offer.id);
    const cached = imageCache[id];
    const image = (cached && cached.image) ? cached.image : '';
    return {
      id,
      title: String(offer.title || ''),
      merchant: String(offer.campaign_name || 'Store'),
      category,
      tags: buildTags(offer, category),
      description: String(offer.description || ''),
      terms: String(offer.terms || ''),
      couponCode: String(offer.coupon_code || '').trim(),
      offerType: offer.offer_type === 'coupon' ? 'coupon' : 'deal',
      buyLink: String(offer.tracking_url || ''),
      status: String(offer.status || 'live').toLowerCase() === 'live' ? 'live' : 'expired',
      startDate: String(offer.start_date || ''),
      endDate: String(offer.end_date || ''),
      offerAddedAt: String(offer.created_at || ''),
      image,
      imageSource: image ? 'product-page' : 'none',
      campaignId: String(offer.campaign_id || ''),
      campaign: String(offer.campaign_name || ''),
      originalPrice: offer.original_price ?? null,
      discountPrice: offer.discount_price ?? null,
      percentOff: offer.percent_off ?? null,
      shippingCharge: offer.shipping_charge ?? null,
      currency: 'INR',
    };
  });

  fs.writeFileSync(OUT, JSON.stringify({ deals, source: 'cuelinks', updatedAt: new Date().toISOString() }, null, 2));
  console.log(`Wrote ${deals.length} deals to ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});