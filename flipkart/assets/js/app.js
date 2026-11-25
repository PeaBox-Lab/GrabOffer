// GrabOffer — vanilla JS app
const DEALS_URL = 'data/deals.json';
const OFFERS_API = '/api/offers';
let useLiveApi = false;
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

const MERCHANT_DOMAINS = {
  'amazon': 'amazon.in', 'flipkart': 'flipkart.com', 'myntra': 'myntra.com',
  'ajio': 'ajio.com', 'croma': 'croma.com', 'tata cliq': 'tatacliq.com',
  'vijay sales': 'vijaysales.com', 'reliance digital': 'reliancedigital.in',
  'bigbasket': 'bigbasket.com', 'nykaa': 'nykaa.com', 'decathlon': 'decathlon.in',
  'udemy': 'udemy.com', 'jockey': 'jockey.in', 'h&m': 'hm.com', 'uniqlo': 'uniqlo.com',
  'leverage edu': 'leverageedu.com', 'bewakoof': 'bewakoof.com', 'pepe jeans': 'pepejeans.in',
  'bookmyshow': 'bookmyshow.com', 'makemytrip': 'makemytrip.com', 'goibibo': 'goibibo.com',
  'oyo': 'oyorooms.com', 'zomato': 'zomato.com', 'swiggy': 'swiggy.com',
};

function merchantDomain(deal) {
  const merchant = normalizeMerchant(deal.merchant || deal.site || '').toLowerCase();
  if (MERCHANT_DOMAINS[merchant]) return MERCHANT_DOMAINS[merchant];
  try {
    const url = new URL(String(deal.buyLink || ''));
    const dest = url.searchParams.get('url') || url.href;
    const parsed = new URL(dest);
    return parsed.hostname.replace(/^www\./, '');
  } catch (_) {}
  return '';
}

function merchantIcon(deal) {
  const merchant = normalizeMerchant(deal.merchant || deal.site || 'Store');
  const domain = merchantDomain(deal);
  const initials = merchant.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const fallback = `<span class="merchant-fallback">${escapeHtml(initials)}</span>`;
  if (!domain) return fallback;
  return `<img class="merchant-logo" src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="${escapeHtml(merchant)} logo" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'merchant-fallback',textContent:'${escapeHtml(initials)}'}))">`;
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function computeExtraTags(deal) {
  const endTs = deal.endDate ? new Date(deal.endDate).getTime() : NaN;
  const addedTs = deal.offerAddedAt ? new Date(deal.offerAddedAt).getTime() : NaN;
  const now = Date.now();
  const endingSoon = !Number.isNaN(endTs) && endTs > now && endTs - now <= 7 * 86400000;
  const isNew = !Number.isNaN(addedTs) && now - addedTs <= 7 * 86400000;
  return [endingSoon ? 'Ends soon' : '', isNew ? 'New' : ''].filter(Boolean);
}

function dealAllTags(deal) {
  return [...computeExtraTags(deal), ...(Array.isArray(deal.tags) ? deal.tags : [])];
}

function dealCardTemplate(deal) {
  const expired = isExpired(deal);
  const price = deal.discountPrice ?? deal.price;
  const mrp = deal.originalPrice ?? deal.mrp;
  const percentOff = deal.percentOff ?? deal.discount;
  const hasPrice = price && price > 0;
  const hasMrp = mrp && mrp > 0;
  const hasDiscount = percentOff && percentOff > 0;
  const merchant = normalizeMerchant(deal.merchant || deal.site);
  const category = normalizeCategory(deal.category);
  const coupon = deal.couponCode && deal.couponCode.trim() ? deal.couponCode.trim() : null;
  const buyLink = sanitizeUrl(deal.buyLink);
  const endDate = formatDate(deal.endDate);
  const startDate = formatDate(deal.startDate);
  const extraTags = computeExtraTags(deal);
  const buyAction = buyLink    ? `<a class="buy-btn" href="${escapeHtml(buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">${expired ? 'View offer' : 'Buy Now'} <span aria-hidden="true">&rarr;</span></a>`
    : `<span class="buy-btn buy-btn-disabled" aria-disabled="true">Link unavailable</span>`;

  return `
    <article class="deal-card" data-deal-id="${escapeHtml(deal.id)}">
      <div class="deal-row">
        <div class="deal-icon">
          ${merchantIcon(deal)}
          <span class="deal-type-dot ${deal.offerType === 'coupon' ? 'is-coupon' : 'is-deal'}" title="${deal.offerType === 'coupon' ? 'Coupon' : 'Deal'}"></span>
        </div>
        <div class="deal-main">
          <div class="deal-topline">
            <span class="deal-cat">${escapeHtml(category)}</span>
            <span class="deal-merchant">${escapeHtml(merchant)}</span>
            ${deal.offerType ? `<span class="type-badge ${deal.offerType}">${deal.offerType === 'coupon' ? 'Coupon' : 'Deal'}</span>` : ''}
          </div>
          <h3 class="card-title"><a href="deal-detail.html?id=${encodeURIComponent(deal.id)}">${escapeHtml(deal.title)}</a></h3>
          ${hasPrice || hasMrp ? `
          <div class="price-row">
            ${hasPrice ? `<span class="price">${formatPrice(price)}</span>` : ''}
            ${hasMrp ? `<span class="mrp">${formatPrice(mrp)}</span>` : ''}
            ${hasDiscount ? `<span class="discount-text">${escapeHtml(Math.round(percentOff) + '% off')}</span>` : ''}
          </div>` : ''}
          <p class="desc">${escapeHtml(deal.description)}</p>
          ${(Array.isArray(deal.tags) && deal.tags.length) || extraTags.length ? `<div class="tag-row">${[...extraTags, ...(deal.tags || [])].slice(0, 6).map((tag) => `<span class="tag-pill ${tag === 'Ends soon' ? 'tag-soon' : (tag === 'New' ? 'tag-new' : '')}">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
          <div class="deal-meta">
            ${startDate ? `<span>Start: ${escapeHtml(startDate)}</span>` : ''}
            ${endDate ? `<span>Ends: ${escapeHtml(endDate)}</span>` : ''}
          </div>
        </div>
        <div class="deal-side">
          ${buyAction}
          ${coupon ? `<span class="coupon-pill">${escapeHtml(coupon)}</span>` : '<span class="no-coupon">No code needed</span>'}
        </div>
      </div>
    </article>
  `;
}

function renderDeals(containerId, list) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const isGrid = containerId === 'deals-grid' || containerId === 'featured-deals';
  if (isGrid) filteredDeals = list;
  const perPage = isGrid ? DEALS_PER_PAGE : list.length;
  const totalPages = Math.max(1, Math.ceil(list.length / perPage));
  if (isGrid && currentPage > totalPages) currentPage = totalPages;
  const start = isGrid ? (currentPage - 1) * perPage : 0;
  const pageItems = isGrid ? list.slice(start, start + perPage) : list;
  container.innerHTML = pageItems.length
    ? pageItems.map(dealCardTemplate).join('')
    : `<p class="u-text-center u-text-sm">No deals match your search.</p>`;

  renderPagination(isGrid ? totalPages : 0, list.length);
}

function renderPagination(totalPages, totalItems) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (totalPages <= 1) { el.innerHTML = totalItems ? `<p class="page-summary">Showing all ${totalItems} offers</p>` : ''; return; }

  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== '...') pages.push('...');
  }

  el.innerHTML = `
    <p class="page-summary">Showing ${(currentPage - 1) * DEALS_PER_PAGE + 1}–${Math.min(currentPage * DEALS_PER_PAGE, totalItems)} of ${totalItems} offers</p>
    <nav class="pager" aria-label="Deal pagination">
      <button type="button" class="pager-btn" data-page="prev" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
      ${pages.map((p) => p === '...' ? '<span class="pager-gap">…</span>' : `<button type="button" class="pager-btn ${p === currentPage ? 'is-current' : ''}" data-page="${p}" aria-current="${p === currentPage ? 'page' : 'false'}">${p}</button>`).join('')}
      <button type="button" class="pager-btn" data-page="next" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    </nav>`;
}

let deals = [];
let filteredDeals = [];
let currentPage = 1;
const DEALS_PER_PAGE = 12;

async function fetchLiveOffers() {
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const apiParams = new URLSearchParams({ per_page: '60', sort: 'created_at', order: 'desc' });
  if (q) apiParams.set('q', q);
  if (type === 'coupon' || type === 'deal') apiParams.set('offer_type', type);
  const res = await fetch(`${OFFERS_API}?${apiParams.toString()}`, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data.data) ? data.data : [];
  return rows.map((offer) => {
    const category = normalizeCategory(offer.categories?.[0]?.name || 'Others');
    const merchant = normalizeMerchant(offer.campaign_name || 'Store');
    return {
      id: String(offer.id),
      title: String(offer.title || ''),
      merchant,
      category,
      tags: Array.isArray(offer.categories) ? [category, merchant, offer.offer_type === 'coupon' ? 'Coupon Code' : 'Deal'].filter(Boolean).slice(0,6) : [category],
      description: String(offer.description || ''),
      terms: String(offer.terms || ''),
      couponCode: String(offer.coupon_code || '').trim(),
      offerType: offer.offer_type === 'coupon' ? 'coupon' : 'deal',
      buyLink: String(offer.tracking_url || ''),
      status: String(offer.status || 'live').toLowerCase() === 'live' ? 'live' : 'expired',
      startDate: String(offer.start_date || ''),
      endDate: String(offer.end_date || ''),
      image: '',
      imageSource: 'none',
      percentOff: offer.percent_off ?? null,
      originalPrice: offer.original_price ?? null,
      discountPrice: offer.discount_price ?? null,
    };
  });
}

async function loadDeals() {
  try {
    // Prefer live API when deployed with Cloudflare Functions
    if (location.protocol !== 'file:') {
      try {
        deals = await fetchLiveOffers();
        useLiveApi = true;
      } catch (apiError) {
        console.warn('Live API unavailable, falling back to local data:', apiError);
        const response = await fetch(DEALS_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        deals = data.deals || [];
        useLiveApi = false;
      }
    } else {
      const response = await fetch(DEALS_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      deals = data.deals || [];
    }
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
    renderDeals('featured-deals', deals);
    initIndexPagination();
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

function renderFilterOptions(group, options) {
  const panel = document.querySelector(`#filter-${group} .filter-panel`);
  if (!panel) return;
  panel.innerHTML = options.map(({ value, label, count }) => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeHtml(value)}" data-filter-group="${group}" />
      <span class="filter-option-label">${escapeHtml(label)}</span>
      <span class="filter-option-count">${count || ''}</span>
    </label>`).join('');
}

function renderFilters() {
  const categoryCounts = new Map();
  const siteCounts = new Map();
  const tagCounts = new Map();
  let couponCount = 0;
  let dealCount = 0;

  deals.forEach((deal) => {
    const category = normalizeCategory(deal.category);
    const merchant = normalizeMerchant(deal.merchant || deal.site);
    const type = deal.offerType || (deal.couponCode ? 'coupon' : 'deal');
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
    siteCounts.set(merchant, (siteCounts.get(merchant) || 0) + 1);
    dealAllTags(deal).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
    if (type === 'coupon') couponCount += 1; else dealCount += 1;
  });

  renderFilterOptions('type', [
    { value: 'coupon', label: 'Coupons', count: couponCount },
    { value: 'deal', label: 'Deals', count: dealCount }
  ]);

  renderFilterOptions('tag', [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 16)
    .map(([label, count]) => ({ value: label, label, count })));

  renderFilterOptions('category', [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ value: label, label, count })));

  renderFilterOptions('site', [...siteCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([label, count]) => ({ value: label, label, count })));
}

function closeAllDropdowns() {
  document.querySelectorAll('.filter-dropdown').forEach((dd) => {
    dd.classList.remove('is-open');
    const trigger = dd.querySelector('.filter-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    const panel = dd.querySelector('.filter-panel');
    if (panel) panel.hidden = true;
  });
}

function updateFilterSummary() {
  document.querySelectorAll('.filter-dropdown').forEach((dd) => {
    const trigger = dd.querySelector('.filter-trigger');
    const count = dd.querySelectorAll('.filter-panel input:checked').length;
    const badge = trigger ? trigger.querySelector('.filter-count') : null;
    if (badge) { badge.hidden = count === 0; badge.textContent = String(count); }
    if (trigger) trigger.classList.toggle('has-selection', count > 0);
  });
  const clear = document.getElementById('clear-filters');
  if (clear) clear.hidden = !document.querySelector('.filter-panel input:checked');
}

function getCheckedValues(group) {
  return [...document.querySelectorAll(`#filter-${group} input[type="checkbox"]:checked`)].map((cb) => cb.value);
}

function getFilterState() {
  const searchInput = document.getElementById('searchInput');
  return {
    categories: getCheckedValues('category'),
    sites: getCheckedValues('site'),
    types: getCheckedValues('type'),
    tags: getCheckedValues('tag'),
    query: searchInput?.value.trim().toLowerCase() || '',
    queryRaw: searchInput?.value.trim() || ''
  };
}

function syncFilterUrl(state) {
  if (!window.history || typeof window.history.replaceState !== 'function') return;
  try {
    const url = new URL(location.href);
    const params = { category: state.categories, site: state.sites, type: state.types, tag: state.tags };
    Object.entries(params).forEach(([key, values]) => {
      if (values.length) url.searchParams.set(key, values.join(','));
      else url.searchParams.delete(key);
    });
    if (state.queryRaw) url.searchParams.set('q', state.queryRaw);
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url.pathname + url.search);
  } catch (_) { /* ignore unsupported environments */ }
}

function applyFilters() {
  currentPage = 1;
  const state = getFilterState();
  const { categories, sites, types, tags, query } = state;
  syncFilterUrl(state);
  const filtered = deals.filter((deal) => {
    const dealCategory = normalizeCategory(deal.category);
    const dealMerchant = normalizeMerchant(deal.merchant || deal.site);
    const dealType = deal.offerType || (deal.couponCode ? 'coupon' : 'deal');
    if (categories.length && !categories.includes(dealCategory)) return false;
    if (sites.length && !sites.includes(dealMerchant)) return false;
    if (types.length && !types.includes(dealType)) return false;
    if (tags.length && !tags.some((tag) => dealAllTags(deal).includes(tag))) return false;
    if (query) {
      const haystack = `${deal.title} ${deal.description} ${dealCategory} ${dealMerchant} ${deal.couponCode || ''} ${dealType} ${dealAllTags(deal).join(' ')}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  renderDeals('deals-grid', filtered);
}

function initFilters() {
  const search = document.getElementById('searchInput');
  const searchForm = search ? search.closest('form') : null;

  document.querySelectorAll('.filter-dropdown').forEach((dd) => {
    const trigger = dd.querySelector('.filter-trigger');
    if (!trigger) return;
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = dd.classList.contains('is-open');
      closeAllDropdowns();
      if (!isOpen) {
        dd.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
        const panel = dd.querySelector('.filter-panel');
        if (panel) {
          panel.hidden = false;
          panel.classList.remove('align-right', 'drop-up');
          let rect = panel.getBoundingClientRect();
          if (rect.right > window.innerWidth - 12) {
            panel.classList.add('align-right');
            rect = panel.getBoundingClientRect();
          }
          const triggerRect = trigger.getBoundingClientRect();
          if (rect.bottom > window.innerHeight - 12 && triggerRect.top > rect.height + 12) {
            panel.classList.add('drop-up');
          }
        }
      }
    });
  });

  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      updateFilterSummary();
      applyFilters();
    });
  });

  const clear = document.getElementById('clear-filters');
  if (clear) {
    clear.addEventListener('click', () => {
      document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach((cb) => { cb.checked = false; });
      if (search) search.value = '';
      updateFilterSummary();
      applyFilters();
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.filter-dropdown')) closeAllDropdowns();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAllDropdowns();
  });

  if (search) search.addEventListener('input', applyFilters);
  if (searchForm) searchForm.addEventListener('submit', (event) => event.preventDefault());

  const pager = document.getElementById('pagination');
  if (pager) {
    pager.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-page]');
      if (!btn) return;
      const raw = btn.dataset.page;
      const total = Math.max(1, Math.ceil(filteredDeals.length / DEALS_PER_PAGE));
      if (raw === 'prev') currentPage = Math.max(1, currentPage - 1);
      else if (raw === 'next') currentPage = Math.min(total, currentPage + 1);
      else currentPage = Number(raw) || 1;
      renderDeals('deals-grid', filteredDeals);
      const grid = document.getElementById('deals-grid');
      if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (search && q) search.value = q;

  const setChecked = (group, raw, normalizer) => {
    if (!raw) return;
    raw.split(',').map((v) => v.trim()).filter(Boolean).forEach((value) => {
      const normalized = normalizer ? normalizer(value) : value;
      const cb = document.querySelector(`#filter-${group} input[value="${cssEscape(normalized)}"]`);
      if (cb) cb.checked = true;
    });
  };
  setChecked('category', params.get('category'), normalizeCategory);
  setChecked('site', params.get('site'), normalizeMerchant);
  setChecked('type', params.get('type'));
  setChecked('tag', params.get('tag'));

  updateFilterSummary();
  applyFilters();
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
  const price = deal.discountPrice ?? deal.price;
  const mrp = deal.originalPrice ?? deal.mrp;
  const percentOff = deal.percentOff ?? deal.discount;
  const hasPrice = price && price > 0;
  const hasMrp = mrp && mrp > 0;
  const hasDiscount = percentOff && percentOff > 0;
  const merchant = normalizeMerchant(deal.merchant || deal.site);
  const category = normalizeCategory(deal.category);
  const coupon = deal.couponCode && deal.couponCode.trim() ? deal.couponCode.trim() : null;
  const buyLink = sanitizeUrl(deal.buyLink);
  const endDate = formatDate(deal.endDate);
  const startDate = formatDate(deal.startDate);
  const domain = merchantDomain(deal);
  const buyAction = buyLink
    ? `<a class="buy-btn" href="${escapeHtml(buyLink)}" target="_blank" rel="nofollow sponsored noopener noreferrer">${expired ? 'View offer' : 'Buy Now'} <span aria-hidden="true">&rarr;</span></a>`
    : `<span class="buy-btn buy-btn-disabled" aria-disabled="true">Link unavailable</span>`;

  container.innerHTML = `
    <article class="deal-detail-card">
      <div class="detail-head">
        <div class="detail-logo">${merchantIcon(deal)}</div>
        <div class="detail-head-main">
          <div class="deal-topline">
            <span class="deal-cat">${escapeHtml(category)}</span>
            <span class="deal-merchant">${escapeHtml(merchant)}</span>
            ${deal.offerType ? `<span class="type-badge ${deal.offerType}">${deal.offerType === 'coupon' ? 'Coupon' : 'Deal'}</span>` : ''}
          </div>
          <h1 class="deal-title">${escapeHtml(deal.title)}</h1>
          <div class="detail-dates">
            ${startDate ? `<span>Starts ${escapeHtml(startDate)}</span>` : ''}
            ${endDate ? `<span>Ends ${escapeHtml(endDate)}</span>` : ''}
            ${expired ? '<span class="is-expired">Expired</span>' : '<span class="is-live">Live offer</span>'}
          </div>
        </div>
      </div>

      <div class="detail-body">
        ${hasPrice || hasMrp ? `
        <div class="deal-price-row">
          ${hasPrice ? `<span class="deal-price">${formatPrice(price)}</span>` : ''}
          ${hasMrp ? `<span class="deal-mrp">${formatPrice(mrp)}</span>` : ''}
          ${hasDiscount ? `<span class="deal-discount">${escapeHtml(Math.round(percentOff) + '% off')}</span>` : ''}
        </div>` : ''}
        <p class="deal-description">${escapeHtml(deal.description)}</p>
        ${dealAllTags(deal).length ? `<div class="tag-row detail-tags">${dealAllTags(deal).map((tag) => `<span class="tag-pill ${tag === 'Ends soon' ? 'tag-soon' : (tag === 'New' ? 'tag-new' : '')}">${escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <div class="deal-coupon">
          ${coupon
            ? `Use coupon code <strong>${escapeHtml(coupon)}</strong> for additional savings.`
            : 'No coupon needed — the discount is already applied.'}
        </div>
        <div class="deal-actions">${buyAction}</div>
        ${deal.terms ? `<section class="detail-section"><h2>Terms &amp; conditions</h2><p>${escapeHtml(deal.terms)}</p></section>` : ''}
        ${domain ? `<section class="detail-section"><h2>About ${escapeHtml(merchant)}</h2><p>${escapeHtml(merchant)} is an online retailer offering deals through GrabOffer. Offers are subject to availability and the vendor's terms.</p><a class="vendor-link" href="https://${escapeHtml(domain)}" target="_blank" rel="noopener noreferrer nofollow">Visit ${escapeHtml(domain)} &rarr;</a></section>` : ''}
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
    sku: String(deal.id || ''),
    offers: {
      '@type': 'Offer',
      price: hasPrice ? Number(price) : 0,
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

function initIndexPagination() {
  const pager = document.getElementById('pagination');
  if (!pager) return;
  pager.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-page]');
    if (!btn) return;
    const raw = btn.dataset.page;
    const total = Math.max(1, Math.ceil(deals.length / DEALS_PER_PAGE));
    if (raw === 'prev') currentPage = Math.max(1, currentPage - 1);
    else if (raw === 'next') currentPage = Math.min(total, currentPage + 1);
    else currentPage = Number(raw) || 1;
    renderDeals('featured-deals', deals);
    const grid = document.getElementById('featured-deals');
    if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
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