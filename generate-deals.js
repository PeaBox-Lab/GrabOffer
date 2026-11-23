const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Read CSV data
const csvPath = path.join(__dirname, 'data', 'offers.csv');
const csvContent = fs.readFileSync(csvPath, 'utf8');
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true
});

// Columns: Id,Title,Merchant,Categories,Description,Terms,Coupon Code,URL,Status,Start Date,End Date,Offer Added At,Image URL,Campaign ID,Campaign Name
const headers = ['Id','Title','Merchant','Categories','Description','Terms','Coupon Code','URL','Status','Start Date','End Date','Offer Added At','Image URL','Campaign ID','Campaign Name'];

const deals = [];
const existingPath = path.join(__dirname, 'data', 'deals.json');
const imageCachePath = path.join(__dirname, 'data', 'image-cache.json');
let existingImages = new Map();
try {
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  (existing.deals || []).forEach((d) => {
    if (d && d.id && d.image) existingImages.set(String(d.id), { image: d.image, imageSource: d.imageSource || '' });
  });
} catch (_) {}
try {
  const cache = JSON.parse(fs.readFileSync(imageCachePath, 'utf8'));
  Object.entries(cache).forEach(([id, v]) => {
    if (v && v.image) existingImages.set(String(id), { image: v.image, imageSource: 'product-page' });
  });
} catch (_) {}

for (let i = 0; i < records.length; i++) {
  const row = records[i];
  const id = String(row.Id || '');
  const title = String(row.Title || '');
  const merchant = String(row.Merchant || '');
  const categoriesRaw = String(row.Categories || '');
  const description = String(row.Description || '');
  const terms = String(row.Terms || '');
  const couponCode = String(row['Coupon Code'] || '').trim();
  const url = String(row.URL || '');
  const status = String(row.Status || 'live').toLowerCase();
  const startDate = String(row['Start Date'] || '');
  const endDate = String(row['End Date'] || '');
  const offerAddedAt = String(row['Offer Added At'] || '');
  const imageUrl = String(row['Image URL'] || '');
  const campaignId = String(row['Campaign ID'] || '');
  const campaignName = String(row['Campaign Name'] || '');

  // Parse categories
  const catList = categoriesRaw.split(',').map(c => c.trim()).filter(Boolean);
  const categoryMap = {
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
  const rawCategory = catList[0] || 'Others';
  const category = categoryMap[rawCategory.toLowerCase()] || rawCategory;

  const text = `${title} ${description} ${terms} ${couponCode} ${merchant} ${catList.join(' ')}`.toLowerCase();
  const tags = new Set();
  tags.add(category);
  if (merchant) tags.add(merchant);
  catList.slice(1, 4).forEach((c) => { const n = categoryMap[c.toLowerCase()] || c; if (n && n !== category) tags.add(n); });
  if (couponCode) tags.add('Coupon Code');
  if (/free shipping|free delivery/.test(text)) tags.add('Free Delivery');
  if (/cashback|cash back/.test(text)) tags.add('Cashback');
  if (/new user|first order|first purchase/.test(text)) tags.add('New User');
  if (/app only|app-exclusive|on app/.test(text)) tags.add('App Deal');
  if (/% off|flat \d+|rs\.\s*\d+ off|₹\s*\d+ off|discount/.test(text)) tags.add('Discount');
  if (/free/.test(text) && !/free shipping|free delivery/.test(text)) tags.add('Freebie');

  const deal = {
    id: id,
    title: title,
    merchant: merchant,
    category: category,
    tags: [...tags].slice(0, 8),
    description: description,
    terms: terms,
    couponCode: couponCode,
    buyLink: url,
    status: status === 'live' ? 'live' : 'expired',
    startDate: startDate,
    endDate: endDate,
    offerAddedAt: offerAddedAt,
    image: (existingImages.get(id) && existingImages.get(id).image) ? existingImages.get(id).image : imageUrl,
    imageSource: (existingImages.get(id) && existingImages.get(id).imageSource) ? existingImages.get(id).imageSource : 'campaign',
    campaignId: campaignId,
    campaign: campaignName
  };

  deals.push(deal);
}

// Write deals.json
fs.writeFileSync(path.join(__dirname, 'data', 'deals.json'), JSON.stringify({ deals }, null, 2));
console.log(`✅ Generated ${deals.length} deals in data/deals.json`);

// Add Cuelinks script to all HTML files
const htmlFiles = [
  'index.html',
  'deals.html',
  'deal-detail.html',
  '404.html'
];

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (!content.includes('cuelinksv2.js')) {
      const script = `<script type='text/javascript'>\n  var cId = '176';\n  (function(d, t) {\n    var s = document.createElement('script');\n    s.type = 'text/javascript';\n    s.async = true;\n    s.src = (document.location.protocol == 'https:' ? 'https://cdn0.cuelinks.com/js/' : 'http://cdn0.cuelinks.com/js/')  + 'cuelinksv2.js';\n    document.getElementsByTagName('body')[0].appendChild(s);\n  })(document, document.createElement('script'));\n</script>`;
      
      const newContent = content.replace(/<\/body>/i, `${script}\n</body>`);
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Added Cuelinks script to ${file}`);
    }
  }
});

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const baseUrl = 'https://graboffer.github.io';
const urls = [
  { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
  { loc: `${baseUrl}/deals.html`, changefreq: 'daily', priority: '0.9' },
  ...deals.map((deal) => ({
    loc: `${baseUrl}/deal-detail.html?id=${encodeURIComponent(deal.id)}`,
    changefreq: 'weekly',
    priority: '0.6'
  }))
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${xmlEscape(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), sitemap);
console.log(`✅ Generated sitemap.xml with ${urls.length} URLs`);
console.log('🎉 Deal generation complete!');
