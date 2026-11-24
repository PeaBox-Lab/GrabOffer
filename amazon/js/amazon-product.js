// amazon-product.js — renders a single product detail from amazon-products.json

(function () {
  'use strict';

  const DATA_URL = '../data/amazon-products.json';
  const TRACKING_ID = 'iwebslog01-21';

  function buildBuyLink(originalLink) {
    if (!originalLink) return '#';
    const url = new URL(originalLink);
    url.searchParams.set('tag', TRACKING_ID);
    return url.href;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatINR(v) {
    const num = Number(v || 0);
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2).replace(/\.00$/, '') + ' Lakh';
    if (num >= 10000) return '₹' + (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return '₹' + num.toLocaleString('en-IN');
  }

  async function init() {
    const container = document.getElementById('product-detail');
    if (!container) return;

    const params = new URLSearchParams(location.search);
    const id = params.get('id') || (params.get('asin') || '');

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
          <img src="https://www.google.com/s2/favicons?domain=amazon.in&sz=64" alt="Amazon.in" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'AM'}))">
        </div>
        <div class="detail-head-main">
          <div class="deal-topline">
            <span class="deal-cat">${escapeHtml(product.category)}</span>
            <span class="deal-merchant">Amazon.in</span>
            <span class="type-badge deal">Best Seller</span>
          </div>
          <h1 class="deal-title">${escapeHtml(product.title)}</h1>
          <div class="detail-dates">
            <span class="is-live">Best Seller · #{product.rank}</span>
            <span>Rating: ${product.rating} (${product.reviewCount.toLocaleString()} reviews)</span>
          </div>
        </div>
      </div>

      <div class="detail-body">
        <div class="deal-price-row">
          <span class="deal-price">${formatINR(product.price)}</span>
          ${product.mrp ? `<span class="deal-mrp">${formatINR(product.mrp)}</span>` : ''}
          ${product.discount ? `<span class="deal-discount">${product.discount}% off</span>` : ''}
        </div>
        <p class="deal-description">${escapeHtml(product.description)}</p>

        ${product.specifications ? `
          <section class="detail-section">
            <h2>Specifications</h2>
            <table style="width:100%; border-collapse:collapse;">
              <tbody>
                ${Object.entries(product.specifications).map(([k, v]) => `
                  <tr><td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">${escapeHtml(k)}</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(v)}</td></tr>`).join('')}
              </tbody>
            </table>
          </section>
        ` : ''}

        ${product.reviews && product.reviews.length ? `
          <section class="detail-section">
            <h2>What Users Say</h2>
            ${product.reviews.map(r => `
              <div style="padding:12px 0;border-bottom:1px solid #eee;">
                <strong>${escapeHtml(r.title)}</strong> — <span style="color:${r.rating >= 4 ? '#067d62' : (r.rating >= 3 ? '#b12704' : '#c40000')}">Rated ${r.rating}/5</span>
                <p class="u-text-sm" style="margin-top:6px;">${escapeHtml(r.body)}</p>
                <p class="u-text-sm" style="color:#565959;">— ${escapeHtml(r.author)}${r.verified ? ' · Verified Purchase' : ''}</p>
              </div>
            `).join('')}
          </section>
        ` : ''}

        <div class="deal-coupon">Source: Amazon.in Best Sellers · Seller: ${escapeHtml(product.seller || 'Amazon.in')} · Tracking: ${escapeHtml(TRACKING_ID)}</div>
        <div class="deal-actions">
          <a class="buy-btn" href="${buyLink}" target="_blank" rel="nofollow sponsored noopener noreferrer">Buy Now on Amazon <span aria-hidden="true">&rarr;</span></a>
        </div>
        <section class="detail-section">
          <h2>Metrics & Insights</h2>
          <p class="u-text-sm">Best Seller Rank: ${escapeHtml(product.metrics?.bestSellerRank || '—')}</p>
          <p class="u-text-sm">Average Rating: ${product.rating} · Reviews: ${product.reviewCount}</p>
          <p class="u-text-sm">Price: ${formatINR(product.price)} (MRP ${product.mrp ? formatINR(product.mrp) : '—'}) · Discount: ${product.discount || 0}%</p>
        </section>
      </div>
    `;

    const title = `${product.title} — GrabOffer Amazon.in`;
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', product.description.slice(0, 160));
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', title);
  }

  init();
})();
