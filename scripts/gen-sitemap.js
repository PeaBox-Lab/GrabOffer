const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/deals.json', 'utf8'));
const deals = data.deals || [];
const base = 'https://graboffer.github.io';
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const urls = [
  { loc: base + '/', changefreq: 'daily', priority: '1.0' },
  { loc: base + '/deals.html', changefreq: 'daily', priority: '0.9' },
  ...deals.map((x) => ({ loc: base + '/deal-detail.html?id=' + encodeURIComponent(x.id), changefreq: 'weekly', priority: '0.6' }))
];
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url>\n    <loc>${esc(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync('sitemap.xml', xml);
console.log('sitemap urls', urls.length);