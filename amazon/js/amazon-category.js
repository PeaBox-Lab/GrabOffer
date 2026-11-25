// amazon-category.js — renders category listing pages dynamically
// Reads ?cat=slug from URL, loads data/amazon-products.json, renders matching products.

(function () {
  'use strict';

  const DATA_URL = 'data/amazon-products.json';
  const TRACKING_ID = 'YOUR_AMAZON_TAG';

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
    const params = new URLSearchParams(location.search);
    const catSlug = params.get('cat');

    // Load data
    const res = await fetch(DATA_URL);
    const data = await res.json();

    // Find matching category
    let cat = null;
    let products = [];

    if (catSlug) {
      // Match by slug (category slug) or by subcategory slug
      for (const c of data.categories) {
        if (c.slug === catSlug) {
          cat = c;
          products = c.products || [];
          break;
        }
        // Also match by subcategory slug
        const subProducts = (c.products || []).filter(p => {
          const subSlug = (p.subcategorySlug || p.subcategory || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return subSlug === catSlug;
        });
        if (subProducts.length > 0) {
          cat = { slug: c.slug, name: c.name, products: subProducts };
          products = subProducts;
          break;
        }
      }
    }

    // Update page title and hero
    const catName = cat ? cat.name : (catSlug || 'Unknown');
    document.title = `GrabOffer Amazon.in – ${catName} Best Sellers`;
    const h1 = document.querySelector('.amazon-hero h1');
    if (h1) h1.textContent = `Amazon.in – ${catName} — Best Sellers`;
    const heroP = document.querySelector('.amazon-hero p');
    if (heroP) heroP.textContent = `We hand‑pick the top-selling products from Amazon.in, rewrite every listing in our own words, remix real user reviews into authentic summaries, and give you clean product pages with tracked affiliate links.`;

    // Update stats
    const prodStat = document.getElementById('stat-products');
    if (prodStat) prodStat.textContent = products.length.toLocaleString() + '+';

    // Render products
    const grid = document.getElementById('category-products');
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = '<p class="u-text-center u-text-sm">No products found for this category yet. Try <a href="index.html">back to home</a>.</p>';
      return;
    }

    grid.innerHTML = products.map(p => `
      <article class="deal-card">
        <div class="deal-row">
          <div class="deal-icon">
            <img class="merchant-logo" src="https://www.google.com/s2/favicons?domain=amazon.in&sz=64" alt="Amazon.in" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'AM'}))">
            <span class="deal-type-dot is-deal" title="Best Seller"></span>
          </div>
          <div class="deal-main">
            <div class="deal-topline">
              <span class="deal-cat">${esc(p.category)}</span>
              <span class="deal-merchant">Amazon.in</span>
              <span class="type-badge deal">Best Seller</span>
            </div>
            <h3 class="card-title"><a href="product.html?id=${p.id}" target="_blank" rel="nofollow sponsored noopener noreferrer">${esc(p.title)}</a></h3>
            <div class="price-row">
              <span class="price">${inr(p.price)}</span>
              ${p.mrp ? `<span class="mrp">${inr(p.mrp)}</span>` : ''}
              ${p.discount ? `<span class="discount-text">${p.discount}% off</span>` : ''}
            </div>
            <p class="desc">${esc(p.description.slice(0, 120))}…</p>
            <div class="deal-meta">
              <span>⭐ ${p.rating} (${p.reviewCount.toLocaleString()}+)</span>
              <span>#${p.rank} in ${esc(p.subcategory)}</span>
            </div>
          </div>
          <div class="deal-side">
            <a class="buy-btn" href="${buildBuyLink(p.buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">View on Amazon.in <span aria-hidden="true">&rarr;</span></a>
            <span class="no-coupon">No code needed</span>
          </div>
        </div>
      </article>
    `).join('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();