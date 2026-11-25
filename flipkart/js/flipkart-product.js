// flipkart-product.js — renders a single Flipkart product detail from flipkart-products.json

(function () {
  'use strict';

  const DATA_URL = 'data/flipkart-products.json';
  const TRACKING_ID = 'iwebslogt';
  const MERCHANT = 'Flipkart';

  function buildBuyLink(originalLink) {
    if (!originalLink) return '#';
    const url = new URL(originalLink);
    url.searchParams.set('tag', TRACKING_ID);
    return url.href;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function inr(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN');
  }

  async function init() {
    const container = document.getElementById('product-detail');
    if (!container) return;

    const params = new URLSearchParams(location.search);
    const id = params.get('id') || params.get('asin') || '';

    const res = await fetch(DATA_URL);
    const data = await res.json();
    const product = data.categories.flatMap(c => c.products || []).find(p => p.id === id || p.asin === id);

    if (!product) {
      container.innerHTML = '<p class="u-text-center u-text-sm">Product not found.</p>';
      return;
    }

    const buyLink = buildBuyLink(product.buyLink);

    container.innerHTML = `
      <div class="detail-head">
        <div class="detail-logo">
          <img src="https://www.google.com/s2/favicons?domain=flipkart.com&sz=64" alt="Flipkart" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'FL'}))">
        </div>
        <div class="detail-head-main">
          <div class="deal-topline">
            <span class="deal-cat">${esc(product.category)}</span>
            <span class="deal-merchant">${MERCHANT}</span>
            <span class="type-badge deal">Best Seller</span>
          </div>
          <h1 class="deal-title">${esc(product.title)}</h1>
          <div class="detail-dates">
            <span class="is-live">Best Seller · #${product.rank}</span>
            <span>Rating: ${product.rating} (${product.reviewCount.toLocaleString()} reviews)</span>
          </div>
        </div>
      </div>

      <div class="detail-body">
        <div class="deal-price-row">
          <span class="deal-price">${inr(product.price)}</span>
          ${product.mrp ? `<span class="deal-mrp">${inr(product.mrp)}</span>` : ''}
          ${product.discount ? `<span class="deal-discount">${product.discount}% off</span>` : ''}
        </div>
        <p class="deal-description">${esc(product.description)}</p>
        <img class="deal-image" src="${esc(product.image)}" alt="${esc(product.title)}" style="width:100%;max-height:420px;object-fit:contain;margin-bottom:1rem;" />

        ${product.specifications ? `
          <section class="detail-section">
            <h2>Specifications</h2>
            <table style="width:100%; border-collapse:collapse;">
              <tbody>
                ${Object.entries(product.specifications).map(([k, v]) => `
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${esc(k)}</td><td style="padding:8px;border-bottom:1px solid #eee;">${esc(v)}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        ` : ''}

        ${product.reviews && product.reviews.length ? `
          <section class="detail-section">
            <h2>What Users Say</h2>
            ${product.reviews.map(r => `
              <div style="padding:12px 0;border-bottom:1px solid #eee;">
                <strong>${esc(r.title)}</strong> — <span style="color:${r.rating >= 4 ? '#067d62' : (r.rating >= 3 ? '#b12704' : '#c40000')}">Rated ${r.rating}/5</span>
                <p class="u-text-sm" style="margin-top:6px;">${esc(r.body)}</p>
                <p class="u-text-sm" style="color:#565959;">— ${esc(r.author)}${r.verified ? ' · Verified Purchase' : ''}</p>
              </div>
            `).join('')}
          </section>
        ` : ''}

        <div class="deal-coupon">Source: ${MERCHANT} Best Sellers · Seller: ${esc(product.seller || MERCHANT)} · Tracking: ${esc(TRACKING_ID)}</div>
        <div class="deal-actions">
          <a class="buy-btn" href="${buyLink}" target="_blank" rel="nofollow sponsored noopener noreferrer">Buy Now on Flipkart <span aria-hidden="true">→</span></a>
        </div>
        <section class="detail-section">
          <h2>Metrics & Insights</h2>
          <p class="u-text-sm">Best Seller Rank: ${esc(product.metrics?.bestSellerRank || '—')}</p>
          <p class="u-text-sm">Average Rating: ${product.rating} · Reviews: ${product.reviewCount}</p>
          <p class="u-text-sm">Price: ${inr(product.price)} (MRP ${product.mrp ? inr(product.mrp) : '—'}) · Discount: ${product.discount || 0}%</p>
        </section>
      </div>
    `;

    document.title = `${product.title} — GrabOffer Flipkart`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', product.description.slice(0, 160));
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${product.title} — GrabOffer Flipkart`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
