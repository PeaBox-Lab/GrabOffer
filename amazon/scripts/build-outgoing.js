// build-outgoing.js — generates a static HTML listing under outgoing/<category>/<id>.html
// for every product in data/amazon-products.json, with affiliate tracking id appended.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const TRACKING_ID = 'YOUR_AMAZON_TAG';

function buildBuyLink(url) {
  const u = new URL(url);
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

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const data = JSON.parse(readFileSync(resolve(root, 'data', 'amazon-products.json'), 'utf8'));

for (const cat of data.categories) {
  for (const p of cat.products) {
    const dir = resolve(root, 'outgoing', slugify(cat.name));
    mkdirSync(dir, { recursive: true });
    const outPath = resolve(dir, `${p.id}.html`);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${esc(p.description.slice(0, 160))}" />
  <meta property="og:title" content="${esc(p.title)} — GrabOffer Amazon.in" />
  <meta property="og:description" content="${esc(p.description.slice(0, 160))}" />
  <meta property="og:type" content="product" />
  <title>${esc(p.title)} | GrabOffer Amazon.in</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%23131921'/%3E%3Ctext x='50' y='72' font-size='60' text-anchor='middle' fill='%23ff9900'%3EA%3C/text%3E%3C/svg%3E" />
  <link rel="stylesheet" href="../../assets/css/style.css" />
  <link rel="stylesheet" href="../../assets/css/amazon.css" />
</head>
<body>
  <header>
    <div class="container">
      <a href="../../index.html" class="logo">GrabOffer <span style="color:#ff9900;">Amazon.in</span></a>
      <nav class="nav-links">
        <a href="../../index.html">Home</a>
        <a href="../../category.html?cat=${slugify(cat.name)}">${esc(cat.name)}</a>
      </nav>
    </div>
  </header>

  <section class="amazon-hero">
    <div class="container">
      <h1>${esc(p.title)}</h1>
      <p class="u-text-sm">Product details, specifications, and buy link.</p>
    </div>
  </section>

  <section class="categories-section">
    <div class="container">
      <div class="deal-detail-card">
        <div class="detail-head">
          <div class="detail-logo">
            <img src="https://www.google.com/s2/favicons?domain=amazon.in&sz=64" alt="Amazon.in" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'AM'}))">
          </div>
          <div class="detail-head-main">
            <div class="deal-topline">
              <span class="deal-cat">${esc(p.category)}</span>
              <span class="deal-merchant">Amazon.in</span>
              <span class="type-badge deal">Best Seller #${p.rank}</span>
            </div>
            <h1 class="deal-title">${esc(p.title)}</h1>
            <div class="detail-dates">
              <span class="is-live">Best Seller · #${p.rank} in ${esc(p.subcategory)}</span>
              <span>${p.rating} ⭐ (${p.reviewCount.toLocaleString()} reviews)</span>
            </div>
          </div>
        </div>
        <div class="detail-body">
          <div class="deal-price-row">
            <span class="deal-price">${inr(p.price)}</span>
            ${p.mrp ? `<span class="deal-mrp">${inr(p.mrp)}</span>` : ''}
            ${p.discount ? `<span class="deal-discount">${p.discount}% off</span>` : ''}
          </div>
          <p class="deal-description">${esc(p.description)}</p>
          ${p.specifications ? `
          <section class="detail-section">
            <h2>Specifications</h2>
            <table style="width:100%; border-collapse:collapse;">
              ${Object.entries(p.specifications).map(([k, v]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${esc(k)}</td><td style="padding:8px;border-bottom:1px solid #eee;">${esc(v)}</td></tr>`).join('')}
            </table>
          </section>` : ''}
          ${p.reviews && p.reviews.length ? `
          <section class="detail-section">
            <h2>What Users Say</h2>
            ${p.reviews.map(r => `<div style="padding:12px 0;border-bottom:1px solid #eee;">
              <strong>${esc(r.title)}</strong> — <span style="color:${r.rating >= 4 ? '#067d62' : '#b12704'}">Rated ${r.rating}/5</span>
              <p class="u-text-sm" style="margin-top:6px;">${esc(r.body)}</p>
              <p class="u-text-sm" style="color:#565959;">— ${esc(r.author)}${r.verified ? ' · Verified Purchase' : ''}</p>
            </div>`).join('')}
          </section>` : ''}
          <div class="deal-coupon">Seller: ${esc(p.seller || 'Amazon.in')}</div>
          <div class="deal-actions">
            <a class="buy-btn" href="${buildBuyLink(p.buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">Buy Now on Amazon <span aria-hidden="true">&rarr;</span></a>
          </div>
          <section class="detail-section">
            <h2>Metrics & Insights</h2>
            <p class="u-text-sm">Best Seller Rank: ${esc(p.metrics?.bestSellerRank || '—')}</p>
            <p class="u-text-sm">Price ${inr(p.price)} · MRP ${inr(p.mrp)} · Discount ${p.discount || 0}%</p>
          </section>
        </div>
      </div>
    </div>
  </section>

  <footer>
    <div class="container">
      <div>
        <div class="logo">GrabOffer <span style="color:#ff9900;">Amazon.in</span></div>
        <p class="u-text-sm">GrabOffer is an affiliate deals website. We may earn commission from qualifying purchases on partner e-commerce sites.</p>
      </div>
      <div>
        <h3>Categories</h3>
        <ul class="footer-links">
          <li><a href="../../index.html">Back to Home</a></li>
          <li><a href="../../category.html?cat=${slugify(cat.name)}">${esc(cat.name)}</a></li>
        </ul>
      </div>
      <div>
        <h3>Affiliate</h3>
        <p class="u-text-sm">GrabOffer is an affiliate deals website and partner of e-commerce sites. Prices and availability may change.</p>
      </div>
    </div>
    <div class="container">
      <p class="copyright">© 2026 GrabOffer. Deals and product listings are curated for convenience. GrabOffer is an affiliate partner of e-commerce sites and may earn commission from qualifying purchases.</p>
    </div>
  </footer>

  <script src="../../assets/js/app.js"></script>
</body>
</html>`;

    writeFileSync(outPath, html, 'utf8');
    console.log('Wrote', outPath);
  }
}

console.log('Done generating outgoing listings.');
