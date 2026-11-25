// flipkart-index.js — renders the Flipkart store home page: hero, search form, stats, category cards, top picks

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

  async function loadData() {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('Failed to load Flipkart product data');
    return res.json();
  }

  function renderCategories(categories) {
    const grid = document.getElementById('category-grid');
    if (!grid) return;
    grid.innerHTML = categories.map(cat => `
      <a href="category.html?cat=${cat.slug}" class="categories-card">
        <div class="icon">📦</div>
        <h3>${esc(cat.name)}</h3>
        <p>${(cat.products || []).length} best-selling products</p>
      </a>
    `).join('');
    const catStat = document.getElementById('stat-cats');
    if (catStat) catStat.textContent = categories.length;
    const prodStat = document.getElementById('stat-products');
    if (prodStat) {
      const total = categories.reduce((sum, c) => sum + (c.products || []).length, 0);
      prodStat.textContent = total.toLocaleString() + '+';
    }
  }

  function renderTopPicks(categories) {
    const grid = document.getElementById('top-picks');
    if (!grid) return;
    const picks = [];
    for (const cat of categories.slice(0, 6)) {
      for (const p of (cat.products || []).slice(0, 1)) {
        picks.push(p);
      }
    }
    if (!picks.length) {
      grid.innerHTML = '<p class="u-text-center u-text-sm">No products found.</p>';
      return;
    }
    grid.innerHTML = picks.map(p => `
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

  async function init() {
    try {
      const data = await loadData();
      renderCategories(data.categories);
      renderTopPicks(data.categories);
    } catch (e) {
      console.error(e);
      const grid = document.getElementById('category-grid');
      if (grid) grid.innerHTML = '<p class="u-text-center u-text-sm">Failed to load categories.</p>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
