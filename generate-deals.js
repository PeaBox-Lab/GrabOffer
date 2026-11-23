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
for (let i = 1; i < records.length; i++) {
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
  const catList = categoriesRaw.split(',').map(c => c.trim()).filter(c => c);
  const category = catList[0] || 'Uncategorized';

  const deal = {
    id: id,
    title: title,
    merchant: merchant,
    category: category,
    description: description,
    terms: terms,
    couponCode: couponCode,
    buyLink: url,
    status: status === 'live' ? 'live' : 'expired',
    startDate: startDate,
    endDate: endDate,
    offerAddedAt: offerAddedAt,
    image: imageUrl,
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

console.log('🎉 Deal generation complete!');
