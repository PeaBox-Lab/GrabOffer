# GrabOffer Amazon.in Store

This folder contains a complete, self-contained Amazon.in affiliate store inside the GrabOffer repo.

## Directory layout

```
amazon/
├── index.html                      # Store home — category tiles + top picks
├── category.html                   # Generic category listing page (?cat=slug)
├── product.html                    # Generic product detail page (?id=...)
├── assets/css/style.css            # Parent GrabOffer CSS (copied)
├── assets/css/amazon.css           # Amazon.in theme layer (orange/dark theme)
├── assets/js/app.js                # Parent GrabOffer JS (copied)
├── js/amazon-index.js              # Home + category rendering logic
├── js/amazon-product.js            # Product detail rendering logic
├── data/amazon-products.json       # Scraped Amazon best-sellers (core dataset)
├── incoming/                       # Raw scraped product JSONs (one per product)
│   └── amazon/<category>/<id>.json
├── outgoing/                       # generated product listings (static HTML)
│   └── electronics/amz-el-001.html
└── scripts/                        # Future scrape / remix generation scripts
```

## Data flow

1. **Incoming** — raw product data fetched from Amazon.in category/subcategory best-seller pages (title, description, price, MRP, ratings, reviews, specs, images, seller, buy link).
2. **Remix** — every field is rewritten in our own words; reviews are remixed into authentic summaries; a fresh listing is generated.
3. **Outgoing** — static HTML product pages under `outgoing/<category>/<id>.html` serve the curated listing, each with a **Buy Now** link appended with affiliate tag `?tag=<your-amazon-tag>`.

## Affiliate tracking

All outbound Amazon links carry the tracking ID:

```
?tag=<your-amazon-tag>
```

This is applied by `buildBuyLink()` in both JS files, so every sale is attributed to your Cuelinks / Amazon affiliate account.

## Run locally

```bash
# From repo root
npx http-server -p 5000
# open http://localhost:5000/amazon/index.html
```

## Notes

- Live scraping of amazon.in was blocked by a bot-check page from this environment, so `data/amazon-products.json` is currently a **seed dataset** with 2 categories and a handful of products. Replace it with your real scraper output as you scale to 50 products per category.
- The parent GrabOffer CSS is inherited via `assets/css/style.css`; `assets/css/amazon.css` adds the Amazon.in orange / dark header theme.