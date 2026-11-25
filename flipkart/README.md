# GrabOffer Flipkart Store

This folder contains a self-contained **Flipkart affiliate store** inside the GrabOffer repo.

## Directory layout

```text
flipkart/
├── index.html                  # Store home — category tiles + top picks
├── category.html               # Generic category listing page (?cat=slug)
├── product.html                # Generic product detail page (?id=...)
├── assets/css/style.css        # Parent GrabOffer CSS (inherited)
├── assets/css/flipkart.css     # Flipkart color/theme layer
├── assets/js/app.js             # Parent GrabOffer JS (inherited)
├── js/flipkart-index.js        # Home + top picks rendering logic
├── js/flipkart-category.js     # Category listing rendering logic
├── js/flipkart-product.js      # Product detail rendering logic
├── data/flipkart-products.json # Flipkart best-seller dataset (core)
├── incoming/flipkart/          # Raw scraped/API product JSONs
├── outgoing/                   # Generated static listings + category indexes
└── scripts/
    ├── build-outgoing.js       # Generates static outgoing product pages from JSON
    └── build-categories.js     # Generates static category index pages from JSON
```

## Data flow

1. **Incoming** — real product data fetched from the **Flipkart Affiliate API**
   (`GET https://affiliate-api.flipkart.net/affiliate/1.0/search.json?query=<q>&resultCount=<n>`
   with headers `Fk-Affiliate-Id: iwebslogt` and `Fk-Affiliate-Token: <api key>`).
2. **Remix** — rewrite titles, descriptions, specifications, and reviews in our own words; remix reviews into authentic summaries.
3. **Outgoing** — static HTML listings generated from the dataset with a **Buy Now** link appended with affiliate tracking ID.

## Affiliate tracking

All outbound Flipkart links carry the tracking ID:

```text
?tag=iwebslogt
```

The current dataset also contains the Flipkart API key used by the feed pipeline:

```text
d3f94e31b58d47b2b0fd083d7e598679
```

## Build pipeline

```bash
# Generate static outgoing product pages (one HTML page per product)
node flipkart/scripts/build-outgoing.js

# Generate static category index pages (top picks per category, up to 50)
node flipkart/scripts/build-categories.js
```

## Run locally

```bash
npx http-server -p 5000
```

Open:

```text
http://localhost:5000/flipkart/index.html
http://localhost:5000/flipkart/category.html?cat=electronics
http://localhost:5000/flipkart/product.html?id=flp-el-001
http://localhost:5000/flipkart/outgoing/electronics/index.html
```

## Notes

- Live data is pulled from the **Flipkart Affiliate API** (Search endpoint). Product feed and top-seller feed endpoints were returning server errors during the last build, so the store currently serves the last successful API results through this pipeline.
- Generated category index pages list up to **50 top products** per category.
- The parent GrabOffer stylesheet is inherited through `assets/css/style.css`; `assets/css/flipkart.css` adds the Flipkart blue/yellow online-shopping theme.
