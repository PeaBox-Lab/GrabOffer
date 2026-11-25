// build-categories.js — generates a static best-seller index page per category
// under outgoing/<category>/index.html, listing the top products with tracked buy links.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..', '..');
const root = resolve(__dirname);

const TRACKING_ID = 'iwebslogt';
const MERCHANT = 'Flipkart';

function buildBuyLink(originalLink) {
  if (!originalLink) return '#';
  const u = new URL(originalLink);
  u.searchParams.set('tag', TRACKING_ID);
  return u.href;
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inr(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

function merchantLogo() {
  return `<img src="https://www.google.com/s2/favicons?domain=flipkart.com&sz=64" alt="Flipkart" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'FL'}))" />`;
}

const data = JSON.parse(readFileSync(resolve(root, 'data', 'flipkart-products.json'), 'utf8'));

for (const cat of data.categories) {
  const products = (cat.products || []).slice(0, 50);
  const dir = resolve(root, 'outgoing', cat.slug);
  mkdirSync(dir, { recursive: true });
  const rows = products
    .map((p) => `
      <article class="deal-card">
        <div class="deal-row">
          <div class="deal-icon">${merchantLogo()}</div>
          <div class="deal-main">
            <div class="deal-topline">
              <span class="deal-cat">${esc(p.category)}</span>
              <span class="deal-merchant">${MERCHANT}</span>
              <span class="type-badge deal">Best Seller #${p.rank}</span>
            </div>
            <h3 class="card-title"><a href="./${p.id}.html">${esc(p.title)}</a></h3>
            <div class="price-row">
              <span class="price">${inr(p.price)}</span>
              ${p.mrp ? `<span class="mrp">${inr(p.mrp)}</span>` : ''}
              ${p.discount ? `<span class="discount-text">${p.discount}% off</span>` : ''}
            </div>
            <p class="desc">${esc((p.description || '').slice(0, 120))}…</p>
            <div class="deal-meta">
              <span>⭐ ${p.rating} (${Number(p.reviewCount || 0).toLocaleString()}+)</span>
              <span>#${p.rank} in ${esc(p.subcategory)}</span>
            </div>
          </div>
          <div class="deal-side">
            <a class="buy-btn" href="${buildBuyLink(p.buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">View on Flipkart <span aria-hidden="true">→</span></a>
            <span class="no-coupon">No code needed</span>
          </div>
        </div>
      </article>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="GrabOffer Flipkart – ${esc(cat.name)} best sellers. Rewritten listings with tracked affiliate links." />
  <meta property="og:title" content="GrabOffer Flipkart – ${esc(cat.name)} Best Sellers" />
  <meta property="og:description" content="Top Flipkart best-seller products in the ${esc(cat.name)} category, rewritten and remixed with tracked affiliate buy links." />
  <meta property="og:type" content="website" />
  <title>GrabOffer Flipkart – ${esc(cat.name)} Best Sellers</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232874f0'/%3E%3Ctext x='50' y='72' font-size='60' text-anchor='middle' fill='%23ffd814'%3EF%3C/text%3E%3C/svg%3E" />
  <link rel="stylesheet" href="../../assets/css/style.css" />
  <link rel="stylesheet" href="../../assets/css/flipkart.css" />
</head>
<body>
  <header>
    <div class="container">
      <a href="../../index.html" class="logo">GrabOffer <span style="color:#ffd814;">Flipkart</span></a>
      <nav class="nav-links">
        <a href="../../index.html">Home</a>
        <a href="../../category.html?cat=electronics">Electronics</a>
        <a href="../../category.html?cat=fashion">Fashion</a>
        <a href="../../category.html?cat=home-kitchen">Home & Kitchen</a>
        <a href="../../category.html?cat=grocery">Grocery</a>
        <a href="../../category.html?cat=health-beauty">Health & Beauty</a>
        <a href="../../category.html?cat=sports">Sports</a>
      </nav>
    </div>
  </header>

  <section class="category-hero">
    <div class="container">
      <h1>Flipkart – ${esc(cat.name)} — Best Sellers (Rewritten)</h1>
      <p>We hand-pick the top-selling products from Flipkart, rewrite every listing in our own words, remix real user reviews into authentic summaries, and give you clean product pages with tracked affiliate links.</p>
      <div class="hero-stats">
        <div><div class="stat">${products.length}</div><div>Products</div></div>
      </div>
    </div>
  </section>

  <section class="categories-section">
    <div class="container">
      <h2>Top ${esc(cat.name)} Picks</h2>
      <div class="featured-deals-grid">
        ${rows || '<p class="u-text-center u-text-sm">No products found.</p>'}
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <div>
        <div class="logo">GrabOffer <span style="color:#ffd814;">Flipkart</span></div>
        <p class="u-text-sm">Curated best-seller listings rewritten for clarity.</p>
      </div>
      <div>
        <h3>Categories</h3>
        <ul class="footer-links">
          <li><a href="../../index.html">Back to Home</a></li>
          <li><a href="../../category.html?cat=${cat.slug}">${esc(cat.name)}</a></li>
        </ul>
      </div>
      <div>
        <h3>Affiliate</h3>
        <p class="u-text-sm">All links include tracking ID <strong>${TRACKING_ID}</strong>.</p>
      </div>
    </div>
    <div class="container">
      <p class="copyright">© 2026 GrabOffer. Product data sourced from Flipkart best-seller lists. All listings rewritten. Affiliate tracking ID: <strong>${TRACKING_ID}</strong>.</p>
    </div>
  </footer>

  <script src="../../assets/js/app.js"></script>
</body>
</html>`;

  writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
  console.log('Wrote', resolve(dir, 'index.html'), 'products:', products.length);
}

console.log('Done generating Flipkart category index pages.');
