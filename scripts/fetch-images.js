const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEALS_PATH = path.join(ROOT, 'data', 'deals.json');
const CACHE_PATH = path.join(ROOT, 'data', 'image-cache.json');
const CONCURRENCY = Number(process.env.IMAGE_FETCH_CONCURRENCY || 6);
const TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 12000);
const LIMIT = Number(process.env.IMAGE_FETCH_LIMIT || 0); // 0 = all

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

function unwrapDestination(buyLink) {
  const raw = String(buyLink || '').trim();
  if (!isHttpUrl(raw)) return '';
  try {
    const url = new URL(raw);
    if (url.hostname.includes('linksredirect.com')) {
      const dest = url.searchParams.get('url');
      if (isHttpUrl(dest)) return dest;
    }
  } catch (_) {}
  return raw;
}

function normalizeImageUrl(value, baseUrl) {
  const raw = String(value || '').trim().replace(/&amp;/g, '&');
  if (!raw) return '';
  if (raw.startsWith('data:')) return '';
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

function extractMetaContent(html, attr, name) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'ig');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["'][^>]*>`, 'ig');
  let m;
  while ((m = re.exec(html))) if (m[1]) return m[1];
  while ((m = re2.exec(html))) if (m[1]) return m[1];
  return '';
}

function extractImageFromHtml(html, baseUrl) {
  const candidates = [
    extractMetaContent(html, 'property', 'og:image:secure_url'),
    extractMetaContent(html, 'property', 'og:image:url'),
    extractMetaContent(html, 'property', 'og:image'),
    extractMetaContent(html, 'name', 'twitter:image:src'),
    extractMetaContent(html, 'name', 'twitter:image'),
    extractMetaContent(html, 'itemprop', 'image'),
  ];

  const linkRel = html.match(/<link[^>]+rel=["'](?:image_src|thumbnailUrl)["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:image_src|thumbnailUrl)["'][^>]*>/i);
  if (linkRel && linkRel[1]) candidates.push(linkRel[1]);

  for (const candidate of candidates) {
    const normalized = normalizeImageUrl(candidate, baseUrl);
    if (normalized) return normalized;
  }
  return '';
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; GrabOfferImageBot/1.0; +https://graboffer.github.io)',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-IN,en;q=0.9',
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchProductImage(buyLink) {
  const destination = unwrapDestination(buyLink);
  if (!isHttpUrl(destination)) return { image: '', reason: 'invalid-destination', destination };

  try {
    const res = await fetchWithTimeout(destination, TIMEOUT_MS);
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) return { image: '', reason: `http-${res.status}`, destination, finalUrl: res.url };
    if (!contentType.includes('text/html')) return { image: '', reason: 'not-html', destination, finalUrl: res.url };

    const html = await res.text();
    const image = extractImageFromHtml(html, res.url || destination);
    if (!image) return { image: '', reason: 'no-image-meta', destination, finalUrl: res.url };
    return { image, reason: 'ok', destination, finalUrl: res.url };
  } catch (error) {
    return { image: '', reason: error && error.name ? error.name : 'fetch-error', destination };
  }
}

async function runPool(items, worker, concurrency) {
  const queue = [...items];
  const results = [];
  let active = 0;
  let done = 0;

  await new Promise((resolve) => {
    const next = () => {
      while (active < concurrency && queue.length) {
        const item = queue.shift();
        active += 1;
        Promise.resolve(worker(item))
          .then((result) => results.push(result))
          .catch((error) => results.push({ error }))
          .finally(() => {
            active -= 1;
            done += 1;
            if (done % 25 === 0) console.log(`Processed ${done}/${items.length}`);
            if (!queue.length && active === 0) resolve();
            else next();
          });
      }
      if (!queue.length && active === 0) resolve();
    };
    next();
  });

  return results;
}

async function main() {
  const data = readJson(DEALS_PATH, { deals: [] });
  const deals = Array.isArray(data.deals) ? data.deals : [];
  const cache = readJson(CACHE_PATH, {});

  const targets = deals.filter((deal) => {
    const buyLink = String(deal.buyLink || '');
    if (!buyLink) return false;
    const key = String(deal.id || buyLink);
    const cached = cache[key];
    if (cached && cached.image) return false;
    if (cached && cached.reason && cached.reason !== 'ok') return false; // skip known failures; rerun by clearing cache
    return true;
  });

  const selected = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
  console.log(`Deals: ${deals.length}. Targets: ${targets.length}. Processing: ${selected.length}. Concurrency: ${CONCURRENCY}`);

  await runPool(selected, async (deal) => {
    const key = String(deal.id || deal.buyLink);
    const result = await fetchProductImage(deal.buyLink);
    cache[key] = {
      ...result,
      checkedAt: new Date().toISOString(),
    };
    if (result.image) {
      deal.image = result.image;
      deal.imageSource = 'product-page';
    }
    return result;
  }, CONCURRENCY);

  data.deals = deals;
  writeJson(DEALS_PATH, data);
  writeJson(CACHE_PATH, cache);

  const fetched = Object.values(cache).filter((v) => v && v.image).length;
  console.log(`Done. Cached images: ${fetched}. Updated ${DEALS_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
