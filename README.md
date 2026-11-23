# GrabOffer

Static deal aggregator for India. Deployable on GitHub Pages or Cloudflare Pages with no build step.

## Structure
- `index.html` — homepage with hero search, categories, and featured deals
- `deals.html` — full deal listing with search and category/site filters
- `deal-detail.html` — individual deal page rendered from `data/deals.json`
- `assets/css/style.css` — design system and components
- `assets/js/app.js` — vanilla JS: loads deal data, renders cards, filters/search
- `data/deals.json` — curated sample deals from Indian shopping sites
- `robots.txt`, `sitemap.xml` — SEO basics

## Local preview
```
npm start
# open http://localhost:5000
```

## Deploy
- GitHub Pages: push to `main`, enable Pages in repository settings (root folder).
- Cloudflare Pages: connect the repo and publish the root folder.

## Next
Replace placeholder images and `buyLink` URLs with real product/affiliate links. Affiliate scripts can be added later without changing the page structure.
