// flipkart-category.js — renders category/subcategory listing pages from flipkart-products.json

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
    const params = new URLSearchParams(location.search);
    const catSlug = params.get('cat');

    const res = await fetch(DATA_URL);
    const data = await res.json();

    let cat = null;
    let products = [];

    if (catSlug) {
      for (const c of data.categories) {
        if (c.slug === catSlug) {
          cat = c;
          products = c.products || [];
          break;
        }
        const subProducts = (c.products || []).filter(p => {
          const subSlug = (p.subcategory || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
          return subSlug === catSlug;
        });
        if (subProducts.length) {
          cat = { slug: c.slug, name: c.name, products: subProducts };
          products = subProducts;
          break;
        }
      }
    }

    const catName = cat ? cat.name : catSlug || 'Unknown';
    document.title = `GrabOffer Flipkart – ${catName} Best Sellers`;
    const h1 = document.querySelector('.category-hero h1');
    if (h1) h1.textContent = `${MERCHANT} – ${catName} — Best Sellers (Rewritten)`;
    const heroP = document.querySelector('.category-hero p');
    if (heroP) heroP.textContent = `We hand-pick the top-selling products from Flipkart, rewrite every listing in our own words, remix real user reviews into authentic summaries, and give you clean product pages with tracked affiliate links.`;

    const prodStat = document.getElementById('stat-products');
    if (prodStat) prodStat.textContent = (products.length ? products.length : 0).toLocaleString();

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
            <img class="merchant-logo" src="https://www.google.com/s2/favicons?domain=flipkart.com&sz=64" alt="Flipkart" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'FL'}))">
            <span class="deal-type-dot is-deal" title="Best Seller"></span>
          </div>
          <div class="deal-main">
            <div class="deal-topline">
              <span class="deal-cat">${esc(p.category)}</span>
              <span class="deal-merchant">${MERCHANT}</span>
              <span class="type-badge deal">Best Seller</span>
            </div>
            <h3 class="card-title"><a href="product.html?id=${p.id}">${esc(p.title)}</a></h3>
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
            <a class="buy-btn" href="${buildBuyLink(p.buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">View on Flipkart <span aria-hidden="true">→</span></a>
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
