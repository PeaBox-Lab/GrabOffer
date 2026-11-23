// GrabOffer — vanilla JS app
const DEALS_URL = 'data/deals.json';
const PLACEHOLDER_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"%3E%3Crect width="600" height="600" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2364748b" font-family="Arial" font-size="28"%3ENo Image%3C/text%3E%3C/svg%3E';
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(value, { allowRelative = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (allowRelative && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  try {
    const url = new URL(raw, location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch (_) {
    return '';
  }
  return '';
}

function normalizeMerchant(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Store';
  const map = {
    'tatacliq': 'Tata Cliq',
    'tata cliq': 'Tata Cliq',
    'croma retail': 'Croma',
    'croma': 'Croma',
    'amazon.in': 'Amazon.in',
    'amazon': 'Amazon.in',
  };
  return map[raw.toLowerCase()] || raw;
}

function normalizeCategory(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'Others';
  const map = {
    'grocery': 'Food & Grocery',
    'food & grocery': 'Food & Grocery',
    'health & beauty': 'Health & Beauty',
    'beauty': 'Health & Beauty',
    'health': 'Health & Beauty',
    'fashion': 'Fashion',
    'electronics': 'Electronics',
    'mobiles': 'Mobiles & Accessories',
    'mobile': 'Mobiles & Accessories',
    'accessories': 'Mobiles & Accessories',
    'home & kitchen': 'Home & Kitchen',
    'home': 'Home & Kitchen',
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
    'artificial intelligence': 'Software & Services',
    'finance': 'Finance',
    'recharge': 'Finance',
    'others': 'Others',
    'uncategorized': 'Others'
  };
  return map[raw.toLowerCase()] || raw;
}

function formatPrice(value) {
  const num = Number(value);
  if (!num || Number.isNaN(num)) return '';
  return currency.format(num);
}

function isExpired(deal) {
  const end = new Date((deal.endDate || deal.expiresAt) + 'T23:59:59');
  return Number.isNaN(end.getTime()) ? false : end < new Date();
}

function dealCardTemplate(deal) {
  const expired = isExpired(deal);
  const hasPrice = deal.price && deal.price > 0;
  const hasMrp = deal.mrp && deal.mrp > 0;
  const hasDiscount = deal.discount && deal.discount > 0;
  const merchant = normalizeMerchant(deal.merchant || deal.site);
  const category = normalizeCategory(deal.category);
  const coupon = deal.couponCode && deal.couponCode.trim() ? deal.couponCode.trim() : null;
  const imageUrl = sanitizeUrl(deal.image) || PLACEHOLDER_IMAGE;
  const buyLink = sanitizeUrl(deal.buyLink);
  const buyAction = buyLink
    ? `<a class="buy-btn" href="${escapeHtml(buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">${expired ? 'View offer' : 'Buy Now'}</a>`
    : `<span class="buy-btn buy-btn-disabled" aria-disabled="true">Link unavailable</span>`;

  return `
    <article class="deal-card" data-deal-id="${escapeHtml(deal.id)}">
      <div class="image-wrapper">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(deal.title)}" loading="lazy" width="600" height="600" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
        ${hasDiscount ? `<span class="badge-discount">${escapeHtml(deal.discount + '% off')}</span>` : ''}
        <span class="badge-site">${escapeHtml(merchant)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title"><a href="deal-detail.html?id=${encodeURIComponent(deal.id)}">${escapeHtml(deal.title)}</a></h3>
        <div class="card-site">${escapeHtml(category)} · ${escapeHtml(merchant)}</div>
        ${hasPrice || hasMrp ? `
        <div class="price-row">
          ${hasPrice ? `<span class="price">${formatPrice(deal.price)}</span>` : ''}
          ${hasMrp ? `<span class="mrp">${formatPrice(deal.mrp)}</span>` : ''}
          ${hasDiscount ? `<span class="discount-text">${escapeHtml(deal.discount + '% off')}</span>` : ''}
        </div>` : ''}
        <p class="desc">${escapeHtml(deal.description)}</p>
        ${Array.isArray(deal.tags) && deal.tags.length ? `<div class="tag-row">${deal.tags.slice(0, 4).map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <div class="card-actions">
          ${buyAction}
          ${coupon
            ? `<span class="coupon-pill">Coupon: ${escapeHtml(coupon)}</span>`
            : '<span class="no-coupon">No coupon needed</span>'}
        </div>
      </div>
    </article>
  `;
}

function renderDeals(containerId, deals) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = deals.length
    ? deals.map(dealCardTemplate).join('')
    : `<p class="u-text-center u-text-sm">No deals match your search.</p>`;
}

let deals = [];

async function loadDeals() {
  try {
    const response = await fetch(DEALS_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    deals = data.deals || [];
  } catch (error) {
    console.error('Failed to load deals:', error);
    deals = [];
  }

  const dealsStat = document.getElementById('stat-deals');
  const storesStat = document.getElementById('stat-stores');
  if (dealsStat) dealsStat.textContent = `${deals.length.toLocaleString('en-IN')}+`;
  if (storesStat) {
    const storeCount = new Set(deals.map((d) => normalizeMerchant(d.merchant || d.site))).size;
    storesStat.textContent = `${storeCount}+`;
  }

  if (document.getElementById('featured-deals')) {
    renderDeals('featured-deals', deals.slice(0, 6));
  }

  if (document.getElementById('deals-grid')) {
    renderFilters();
    initFilters();
  }

  if (document.getElementById('deal-detail')) {
    renderDealDetail();
  }
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9 _-]/g, '\\$&');
}

function renderFilters() {
  const categoryContainer = document.getElementById('category-filters');
  const siteContainer = document.getElementById('site-filters');
  if (!categoryContainer || !siteContainer) return;

  const categoryCounts = new Map();
  const siteCounts = new Map();
  deals.forEach((deal) => {
    const category = normalizeCategory(deal.category);
    const merchant = normalizeMerchant(deal.merchant || deal.site);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    siteCounts.set(merchant, (siteCounts.get(merchant) || 0) + 1);
  });

  const categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
  const sites = [...siteCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 24)
    .map(([name]) => name);

  categoryContainer.innerHTML = [
    '<button type="button" class="filter-btn active" data-category="all" aria-pressed="true">All</button>',
    ...categories.map((name) => `<button type="button" class="filter-btn" data-category="${escapeHtml(name)}" aria-pressed="false">${escapeHtml(name)}</button>`)
  ].join('');

  siteContainer.innerHTML = [
    '<button type="button" class="filter-btn active" data-site="all" aria-pressed="true">All Stores</button>',
    ...sites.map((name) => `<button type="button" class="filter-btn" data-site="${escapeHtml(name)}" aria-pressed="false">${escapeHtml(name)}</button>`)
  ].join('');
}

function initFilters() {
  const categoryButtons = document.querySelectorAll('[data-category]');
  const siteButtons = document.querySelectorAll('[data-site]');
  const search = document.getElementById('searchInput');
  const searchForm = search ? search.closest('form') : null;

  categoryButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleButton(btn);
      applyFilters();
    });
  });

  siteButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleButton(btn);
      applyFilters();
    });
  });

  if (search) {
    search.addEventListener('input', applyFilters);
  }
  if (searchForm) {
    searchForm.addEventListener('submit', (event) => event.preventDefault());
  }

  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const categoryParam = params.get('category');
  const siteParam = params.get('site');
  const category = categoryParam ? normalizeCategory(categoryParam) : '';
  const site = siteParam ? normalizeMerchant(siteParam) : '';

  if (search && q) search.value = q;

  if (category) {
    const btn = document.querySelector(`[data-category="${cssEscape(category)}"]`);
    if (btn) {
      document.querySelectorAll('[data-category]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }
  } else {
    const allCategory = document.querySelector('[data-category="all"]');
    if (allCategory) allCategory.classList.add('active');
  }

  if (site) {
    const btn = document.querySelector(`[data-site="${cssEscape(site)}"]`);
    if (btn) {
      document.querySelectorAll('[data-site]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    }
  } else {
    const allSite = document.querySelector('[data-site="all"]');
    if (allSite) allSite.classList.add('active');
  }

  syncFilterPressedState();
  applyFilters();
}

function syncFilterPressedState() {
  document.querySelectorAll('.filter-btn[data-category], .filter-btn[data-site]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}

function toggleButton(button) {
  const group = button.dataset.category !== undefined ? 'category' : 'site';
  document.querySelectorAll(`[data-${group}]`).forEach((btn) => {
    btn.classList.remove('active');
    btn.setAttribute('aria-pressed', 'false');
  });
  button.classList.add('active');
  button.setAttribute('aria-pressed', 'true');
}

function getFilterState() {
  const activeCategory = document.querySelector('[data-category].active')?.dataset.category || '';
  const activeSite = document.querySelector('[data-site].active')?.dataset.site || '';
  const query = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
  return { activeCategory, activeSite, query };
}

function applyFilters() {
  const { activeCategory, activeSite, query } = getFilterState();
  const filtered = deals.filter((deal) => {
    const dealCategory = normalizeCategory(deal.category);
    const dealMerchant = normalizeMerchant(deal.merchant || deal.site);
    if (activeCategory && activeCategory !== 'all' && dealCategory !== activeCategory) return false;
    if (activeSite && activeSite !== 'all' && dealMerchant !== activeSite) return false;
    if (query) {
      const haystack = `${deal.title} ${deal.description} ${dealCategory} ${dealMerchant} ${deal.couponCode || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  renderDeals('deals-grid', filtered);
}

function renderDealDetail() {
  const container = document.getElementById('deal-detail');
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const deal = deals.find((item) => String(item.id) === String(id));

  if (!deal) {
    container.innerHTML = '<p class="u-text-center u-text-sm">Deal not found. <a href="deals.html">Back to all deals</a></p>';
    return;
  }

  const expired = isExpired(deal);
  const hasPrice = deal.price && deal.price > 0;
  const hasMrp = deal.mrp && deal.mrp > 0;
  const hasDiscount = deal.discount && deal.discount > 0;
  const merchant = normalizeMerchant(deal.merchant || deal.site);
  const category = normalizeCategory(deal.category);
  const coupon = deal.couponCode && deal.couponCode.trim() ? deal.couponCode.trim() : null;
  const imageUrl = sanitizeUrl(deal.image) || PLACEHOLDER_IMAGE;
  const buyLink = sanitizeUrl(deal.buyLink);
  const buyAction = buyLink
    ? `<a class="buy-btn" href="${escapeHtml(buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">${expired ? 'View offer' : 'Buy Now'}</a>`
    : `<span class="buy-btn buy-btn-disabled" aria-disabled="true">Link unavailable</span>`;

  container.innerHTML = `
    <article class="deal-detail-card">
      <div class="image-wrapper">
        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(deal.title)}" loading="lazy" width="800" height="800" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER_IMAGE}'">
      </div>
      <h1 class="deal-title">${escapeHtml(deal.title)}</h1>
      <div class="deal-site">${escapeHtml(category)} · ${escapeHtml(merchant)}</div>
      ${hasPrice || hasMrp ? `
      <div class="deal-price-row">
        ${hasPrice ? `<span class="deal-price">${formatPrice(deal.price)}</span>` : ''}
        ${hasMrp ? `<span class="deal-mrp">${formatPrice(deal.mrp)}</span>` : ''}
        ${hasDiscount ? `<span class="deal-discount">${escapeHtml(deal.discount + '% off')}</span>` : ''}
      </div>` : ''}
      <p class="deal-description">${escapeHtml(deal.description)}</p>
      <div class="deal-coupon">
        ${coupon
          ? `Use coupon code <strong>${escapeHtml(coupon)}</strong> for additional savings.`
          : 'No coupon needed — the discount is already applied.'}
      </div>
      <div class="deal-actions">
        ${buyAction}
      </div>
    </article>
  `;

  // Update meta tags & JSON-LD for SEO
  const title = `${deal.title} | GrabOffer`;
  const description = deal.description;
  document.title = title;
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content', description);
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', description);

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: deal.title,
    description: deal.description,
    image: imageUrl,
    sku: String(deal.id || ''),
    offers: {
      '@type': 'Offer',
      price: hasPrice ? Number(deal.price) : 0,
      priceCurrency: 'INR',
      availability: expired ? 'https://schema.org/Discontinued' : 'https://schema.org/InStock',
      url: buyLink || undefined,
      seller: {
        '@type': 'Organization',
        name: merchant
      }
    }
  };
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
}

function initNewsletterForms() {
  document.querySelectorAll('form.newsletter').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = form.querySelector('input[type="email"]');
      const value = email ? email.value.trim() : '';
      if (!value) {
        alert('Please enter your email address.');
        return;
      }
      alert('Thanks! Newsletter signup will be available soon.');
      form.reset();
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNewsletterForms();
  loadDeals();
});