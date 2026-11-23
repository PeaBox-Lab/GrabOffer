const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEALS_PATH = path.join(ROOT, 'data', 'deals.json');
const CACHE_PATH = path.join(ROOT, 'data', 'image-cache.json');
const CONCURRENCY = Number(process.env.IMAGE_FETCH_CONCURRENCY || 6);
const TIMEOUT_MS = Number(process.env.IMAGE_FETCH_TIMEOUT_MS || 12000);
const LIMIT = Number(process.env.IMAGE_FETCH_LIMIT || 0); // 0 = all
const RETRY_FAILED = process.env.RETRY_FAILED === '1' || process.argv.includes('--retry-failed');

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
  const raw = String(value || '').trim().replace(/&amp;/g, '&').replace(/&quot;/g, '"');
  if (!raw) return '';
  if (raw.startsWith('data:')) return '';
  try {
    const url = new URL(raw, baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const lower = url.href.toLowerCase();
    if (lower.includes('logo') && lower.includes('icon')) return '';
    if (lower.endsWith('.svg')) return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

function extractMetaContent(html, attr, name) {
  const patterns = [
    new RegExp(`<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'ig'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["'][^>]*>`, 'ig'),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) if (m[1]) return m[1];
  }
  return '';
}

function extractJsonLdImages(html, baseUrl) {
  const images = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/ig;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        collectJsonLdImages(item, baseUrl, images);
      }
    } catch (_) {}
  }
  return images;
}

function collectJsonLdImages(node, baseUrl, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => collectJsonLdImages(n, baseUrl, out));
    return;
  }
  const type = String(node['@type'] || '').toLowerCase();
  const image = node.image;
  const push = (v) => {
    const n = normalizeImageUrl(typeof v === 'string' ? v : (v && v.url) || '', baseUrl);
    if (n) out.push({ url: n, score: type.includes('product') ? 100 : 60 });
  };
  if (typeof image === 'string') push(image);
  else if (Array.isArray(image)) image.forEach(push);
  else if (image && typeof image === 'object') push(image);

  for (const key of ['@graph', 'mainEntity', 'offers', 'itemListElement']) {
    if (node[key]) collectJsonLdImages(node[key], baseUrl, out);
  }
}

function extractImgCandidates(html, baseUrl) {
  const candidates = [];
  const re = /<img\b[^>]*>/ig;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const src = (tag.match(/\b(?:data-src|data-lazy-src|data-original|src)=["']([^"']+)["']/i) || [])[1] || '';
    const alt = (tag.match(/\balt=["']([^"']*)["']/i) || [])[1] || '';
    const width = Number((tag.match(/\bwidth=["']?(\d+)/i) || [])[1] || 0);
    const height = Number((tag.match(/\bheight=["']?(\d+)/i) || [])[1] || 0);
    const normalized = normalizeImageUrl(src, baseUrl);
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (lower.includes('sprite') || lower.includes('icon') || lower.includes('logo') || lower.includes('pixel') || lower.includes('tracking')) continue;
    let score = 10;
    if (width >= 200 || height >= 200) score += 20;
    if (width >= 400 || height >= 400) score += 20;
    if (/product|hero|main|banner|offer|deal/i.test(alt + ' ' + lower)) score += 25;
    if (/cdn|images|media|product/i.test(lower)) score += 10;
    candidates.push({ url: normalized, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function pickBestImage(html, baseUrl) {
  const candidates = [];

  const metaNames = [
    ['property', 'og:image:secure_url'],
    ['property', 'og:image:url'],
    ['property', 'og:image'],
    ['property', 'product:image'],
    ['name', 'twitter:image:src'],
    ['name', 'twitter:image'],
    ['itemprop', 'image'],
  ];
  for (const [attr, name] of metaNames) {
    const val = extractMetaContent(html, attr, name);
    const n = normalizeImageUrl(val, baseUrl);
    if (n) candidates.push({ url: n, score: 120 });
  }

  const linkRel = html.match(/<link[^>]+rel=["'](?:image_src|thumbnailUrl)["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:image_src|thumbnailUrl)["'][^>]*>/i);
  if (linkRel && linkRel[1]) {
    const n = normalizeImageUrl(linkRel[1], baseUrl);
    if (n) candidates.push({ url: n, score: 90 });
  }

  candidates.push(...extractJsonLdImages(html, baseUrl));
  candidates.push(...extractImgCandidates(html, baseUrl).slice(0, 5));

  const seen = new Set();
  const unique = candidates.filter((c) => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
  unique.sort((a, b) => b.score - a.score);
  return unique[0] ? unique[0].url : '';
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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
    const image = pickBestImage(html, res.url || destination);
    if (!image) return { image: '', reason: 'no-image-found', destination, finalUrl: res.url };
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
    if (cached && cached.reason && cached.reason !== 'ok' && !RETRY_FAILED) return false;
    return true;
  });

  const selected = LIMIT > 0 ? targets.slice(0, LIMIT) : targets;
  console.log(`Deals: ${deals.length}. Targets: ${targets.length}. Processing: ${selected.length}. Concurrency: ${CONCURRENCY}. RetryFailed: ${RETRY_FAILED}`);

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
