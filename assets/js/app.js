// GrabOffer — vanilla JS app
const DEALS_URL = 'data/deals.json';
const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
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
  const merchant = deal.merchant || deal.site || 'Store';
  const coupon = deal.couponCode && deal.couponCode.trim() ? deal.couponCode.trim() : null;

  return `
    <article class="deal-card" data-deal-id="${escapeHtml(deal.id)}">
      <div class="image-wrapper">
        <img src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.title)}" loading="lazy" width="600" height="600">
        ${hasDiscount ? `<span class="badge-discount">${escapeHtml(deal.discount + '% off')}</span>` : ''}
        <span class="badge-site">${escapeHtml(merchant)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title"><a href="deal-detail.html?id=${encodeURIComponent(deal.id)}">${escapeHtml(deal.title)}</a></h3>
        <div class="card-site">${escapeHtml(deal.category)} · ${escapeHtml(merchant)}</div>
        ${hasPrice || hasMrp ? `
        <div class="price-row">
          ${hasPrice ? `<span class="price">${formatPrice(deal.price)}</span>` : ''}
          ${hasMrp ? `<span class="mrp">${formatPrice(deal.mrp)}</span>` : ''}
          ${hasDiscount ? `<span class="discount-text">${escapeHtml(deal.discount + '% off')}</span>` : ''}
        </div>` : ''}
        <p class="desc">${escapeHtml(deal.description)}</p>
        <div class="card-actions">
          <a class="buy-btn" href="${escapeHtml(deal.buyLink)}" target="_blank" rel="nofollow sponsored noopener">${expired ? 'View offer' : 'Buy Now'}</a>
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
    const response = await fetch(DEALS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    deals = data.deals || [];
  } catch (error) {
    console.error('Failed to load deals:', error);
    deals = [];
  }

  if (document.getElementById('featured-deals')) {
    renderDeals('featured-deals', deals.slice(0, 6));
  }

  if (document.getElementById('deals-grid')) {
    initFilters();
    initSearchFromUrl();
  }

  if (document.getElementById('deal-detail')) {
    renderDealDetail();
  }
}

function initSearchFromUrl() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const category = params.get('category');
  const site = params.get('site');
  const search = document.getElementById('searchInput');
  if (search && q) search.value = q;

  if (category) {
    const btn = document.querySelector(`[data-category="${cssEscape(category)}"]`);
    if (btn) btn.classList.add('active');
  }
  if (site) {
    const btn = document.querySelector(`[data-site="${cssEscape(site)}"]`);
    if (btn) btn.classList.add('active');
  }
  applyFilters();
}

function cssEscape(value) {
  return String(value).replace(/[^a-zA-Z0-9 _-]/g, '\\$&');
}

function initFilters() {
  const categoryButtons = document.querySelectorAll('[data-category]');
  const siteButtons = document.querySelectorAll('[data-site]');
  const search = document.getElementById('searchInput');

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

  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  const category = params.get('category');
  const site = params.get('site');

  if (q) {
    const btn = document.querySelector(`[data-category="all"]`);
    if (btn) btn.classList.add('active');
    const siteBtn = document.querySelector(`[data-site="all"]`);
    if (siteBtn) siteBtn.classList.add('active');
  }

  if (category) {
    const btn = document.querySelector(`[data-category="${cssEscape(category)}"]`);
    if (btn) btn.classList.add('active');
  }

  if (site) {
    const btn = document.querySelector(`[data-site="${cssEscape(site)}"]`);
    if (btn) btn.classList.add('active');
  }

  applyFilters();
}

function toggleButton(button) {
  const group = button.dataset.category !== undefined ? 'category' : 'site';
  document.querySelectorAll(`[data-${group}]`).forEach((btn) => {
    if (btn !== button) btn.classList.remove('active');
  });
  button.classList.toggle('active');
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
    const dealCategory = deal.category || '';
    const dealMerchant = deal.merchant || deal.site || '';
    if (activeCategory && activeCategory !== 'all' && dealCategory !== activeCategory) return false;
    if (activeSite && activeSite !== 'all' && dealMerchant !== activeSite) return false;
    if (query) {
      const haystack = `${deal.title} ${deal.description} ${dealCategory} ${dealMerchant}`.toLowerCase();
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
  const merchant = deal.merchant || deal.site || 'Store';
  const coupon = deal.couponCode && deal.couponCode.trim() ? deal.couponCode.trim() : null;

  container.innerHTML = `
    <article class="deal-detail-card">
      <div class="image-wrapper">
        <img src="${escapeHtml(deal.image)}" alt="${escapeHtml(deal.title)}" loading="lazy" width="800" height="800">
      </div>
      <h1 class="deal-title">${escapeHtml(deal.title)}</h1>
      <div class="deal-site">${escapeHtml(deal.category)} · ${escapeHtml(merchant)}</div>
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
        <a class="buy-btn" href="${escapeHtml(deal.buyLink)}" target="_blank" rel="nofollow sponsored noopener">${expired ? 'View offer' : 'Buy Now'}</a>
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
    image: deal.image,
    sku: deal.id,
    offers: {
      '@type': 'Offer',
      price: deal.price || 0,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: deal.buyLink,
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

document.addEventListener('DOMContentLoaded', loadDeals);