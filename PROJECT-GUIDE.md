# GrabOffer — Project & Operations Guide

**Last updated:** 2026-11-24
**Repository:** `PeaBox-Lab/GrabOffer` (branch `main`)
**Live domain (CNAME):** `sale.graboffer.in`

This document is the single source of truth for how the GrabOffer site works, how to run it, how to refresh and add deals, and what rules to follow when extending it (including with an AI coding agent). If you are an AI tool picking this project up, read this file first, then the specific files named in each section.

---

## Table of contents

1. [TL;DR](#1-tldr)
2. [What this project is](#2-what-this-project-is)
3. [Current snapshot](#3-current-snapshot)
4. [Architecture and data flow](#4-architecture-and-data-flow)
5. [Repository map](#5-repository-map)
6. [Tech stack, conventions, constraints](#6-tech-stack-conventions-constraints)
7. [Local development](#7-local-development)
8. [Configuration and secrets](#8-configuration-and-secrets)
9. [Data model (`data/deals.json`)](#9-data-model-datadealsjson)
10. [Deal pipeline: daily and weekly processing](#10-deal-pipeline-daily-and-weekly-processing)
11. [Adding, editing, removing deals manually](#11-adding-editing-removing-deals-manually)
12. [Categories and tags](#12-categories-and-tags)
13. [Frontend behaviour](#13-frontend-behaviour)
14. [Theme and CSS](#14-theme-and-css)
15. [API proxy (Cloudflare Pages Functions)](#15-api-proxy-cloudflare-pages-functions)
16. [Deployment](#16-deployment)
17. [Affiliate links and compliance](#17-affiliate-links-and-compliance)
18. [Runbook: common commands](#18-runbook-common-commands)
19. [Troubleshooting](#19-troubleshooting)
20. [QA checklist](#20-qa-checklist)
21. [Known limitations and inconsistencies](#21-known-limitations-and-inconsistencies)
22. [Roadmap and suggested next work](#22-roadmap-and-suggested-next-work)
23. [Instructions for AI coding agents](#23-instructions-for-ai-coding-agents)
24. [Glossary](#24-glossary)
25. [Document maintenance](#25-document-maintenance)

---

## 1. TL;DR

| Task | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Run the site locally | `npm start` (or `npx http-server -p 5000 -c-1`) |
| Refresh deals from Cuelinks | `npm run fetch-deals` (or `node scripts/fetch-cuelinks.js`; needs `CUELINKS_API_KEY`) |
| Rebuild the sitemap | `node scripts/gen-sitemap.js` |
| Optional: fetch product images | `npm run fetch-images` |
| Legacy CSV import (**avoid**) | `npm run generate` |
| Serve Cloudflare Functions locally | `npx wrangler pages dev .` (needs `.dev.vars`) |

Key facts:

- Static HTML/CSS/vanilla-JS site. **No framework, no build step.**
- Deals come from the **Cuelinks V3 API** and are cached into `data/deals.json`.
- The browser prefers the live proxy `/api/offers` and **falls back to `data/deals.json`**.
- The layout is a **single-column deal list** (by explicit user preference — do not reintroduce the 3-column card grid).
- Cards show **merchant icons/logos**, not product photos.
- `data/deals.json` is the file that must be refreshed and committed after a fetch.
- **Never commit API keys.**

---

## 2. What this project is

GrabOffer is a deals-and-coupons aggregator. It ingests affiliate offers (coupons and deals) from the Cuelinks V3 publisher API and presents them in a clean, modern, European-inspired reading layout:

- **Home** (`index.html`): hero, category tiles, search, all featured deals with pagination.
- **Deals** (`deals.html`): the full browsable list with multi-select dropdown filters, search, and pagination.
- **Deal detail** (`deal-detail.html?id=…`): logo, title, merchant, dates, description, price/discount, coupon code, Buy Now, terms, and an “About vendor” block.
- **404** (`404.html`).

Monetisation is via Cuelinks affiliate tracking links (`linksredirect.com`) plus the Cuelinks on-page script (`cId = 176`) that can rewrite/attribute merchant links.

---

## 3. Current snapshot

Snapshot taken from the committed `data/deals.json` on 2026-11-24:

| Metric | Value |
| --- | --- |
| Deals in `data/deals.json` | **1,185** |
| Source | `cuelinks` |
| `updatedAt` | `2026-11-23T18:11:26.322Z` |
| Offers with a coupon code | 309 |
| Offers of type `deal` | 876 |
| Offers of type `coupon` | 309 |
| Unique merchants | 265 |
| Offers with an `endDate` | 1,185 |
| Offers already past `endDate` | 2 |
| Deals with an `image` value | 483 (images are currently **not displayed** in cards) |
| `data/image-cache.json` entries | 1,714 (mix of current and legacy IDs) |
| Sitemap URLs | 1,187 (home + deals + 1,185 detail pages) |
| `data/deals.json` size | ~1.26 MB |
| `data/offers.csv` (legacy) | ~0.86 MB |

> Counts change every refresh. Treat this table as an example, not a guarantee.

Category distribution at snapshot time (raw data values):

| Category | Count |
| --- | --- |
| Health & Beauty | 293 |
| Fashion | 184 |
| Food & Grocery | 125 |
| Travel | 125 |
| Software & Services | 108 |
| Sports & Outdoors | 66 |
| Electronics | 57 |
| Others | 48 |
| Gifts & Flowers | 38 |
| Baby & Kids | 30 |
| Gaming | 28 |
| Entertainment | 22 |
| Home & Kitchen | 22 |
| Mobiles & Accessories | 15 |
| Artificial Intelligence | 9 |
| Books & Stationery | 7 |
| Education | 5 |
| Finance | 3 |

Note: the UI merges **Artificial Intelligence** into **Software & Services**, so the filter shows 117 for that bucket while the raw JSON has 108 + 9.

---

## 4. Architecture and data flow

### 4.1 Ingestion (scheduled or manual)

```
Cuelinks V3 API  ──►  scripts/fetch-cuelinks.js  ──►  data/deals.json
   (auth: Token)          (Node 18+, fetch)            (committed to git)
                                                          │
GitHub Actions (every 6 h) ── runs fetch ── commits data/deals.json ──┘
```

### 4.2 Serving

```
Visitor
  │
  ├─► static host (GitHub Pages or Cloudflare Pages)
  │      ├─ index.html, deals.html, deal-detail.html, 404.html
  │      ├─ assets/css/style.css
  │      ├─ assets/js/app.js
  │      └─ data/deals.json
  │
  └─► app.js first tries GET /api/offers?per_page=60&sort=created_at&order=desc
         │
         ├─ Cloudflare Pages Function (functions/api/offers.js)
         │     └─► Cuelinks V3 /offers with secret CUELINKS_API_KEY
         │
         └─ on any failure → falls back to data/deals.json
```

### 4.3 Render

```
DOMContentLoaded
  └─ loadDeals()
       ├─ fetch live offers (http/https only) or local JSON
       ├─ update hero stats (#stat-deals, #stat-stores)
       ├─ index?  renderDeals('featured-deals') + initIndexPagination()
       ├─ deals?  renderFilters() + initFilters() (multi-select dropdowns)
       └─ detail? renderDealDetail() (lookup by ?id=)
```

---

## 5. Repository map

| Path | Purpose | Notes |
| --- | --- | --- |
| `index.html` | Home page | Hero, 6 category tiles, featured deals grid, pagination, footer, Cuelinks script |
| `deals.html` | All deals page | Search form, 4 dropdown filters, results grid, pagination |
| `deal-detail.html` | Deal detail shell | Content rendered client-side by `app.js` |
| `404.html` | Not-found page | Static |
| `assets/css/style.css` | All styling | CSS variables at the top; responsive rules |
| `assets/js/app.js` | All frontend logic | Data loading, cards, filters, pagination, detail, SEO meta/JSON-LD |
| `data/deals.json` | **Production data** | `{ deals: [...], source, updatedAt }` |
| `data/image-cache.json` | Product-image cache | Optional; used by `scripts/fetch-images.js` |
| `data/offers.csv` | Legacy CSV source | Only used by legacy `generate-deals.js` |
| `functions/api/offers.js` | Secure API proxy for offers | Cloudflare Pages Function |
| `functions/api/categories.js` | Secure API proxy for categories | Cloudflare Pages Function |
| `scripts/fetch-cuelinks.js` | Cuelinks → `deals.json` | Main ingestion script |
| `scripts/gen-sitemap.js` | Rebuild `sitemap.xml` | Base URL hard-coded |
| `scripts/fetch-images.js` | Optional image enrichment | Reads `buyLink`, writes cache + deals |
| `generate-deals.js` | **Legacy** CSV → JSON + sitemap + script injection | Do not run for normal refreshes |
| `.github/workflows/fetch-cuelinks.yml` | Scheduled refresh | Every 6 hours + manual dispatch |
| `.dev.vars.example` | Local Functions env template | Copy to `.dev.vars` |
| `sitemap.xml` | Generated sitemap | 1,187 URLs in snapshot |
| `robots.txt` | Crawler rules | References GitHub Pages sitemap |
| `CNAME` | Custom domain | `sale.graboffer.in` |
| `.nojekyll` | GitHub Pages marker | Disables Jekyll processing |
| `README.md` | Short setup overview | Points here for full details |
| `package.json` | npm scripts + 2 dev deps | `fetch-deals`, `start`, `fetch-images`, `sitemap`, legacy `generate` |

Files/directories that should **not** be resurrected:

- `v1-old/` — the previous design. It is deleted and git-ignored. The user explicitly does not want the v1 design.

---

## 6. Tech stack, conventions, constraints

### 6.1 Stack

- Plain HTML5, CSS3 (custom properties, grid/flex), ES2017+ JavaScript (no modules).
- Node.js scripts (CommonJS `require`) for ingestion and tooling.
- Cloudflare Pages Functions (ES modules, WinterCG `fetch`).
- GitHub Actions for scheduling.
- No bundler, no TypeScript, no SPA router, no database.

### 6.2 Hard rules (do not break)

1. **Never commit or hard-code the Cuelinks API key.** It belongs in `.dev.vars`, Cloudflare secrets, or GitHub Actions secrets.
2. **Keep the single-column deal list.** The user rejected the 3-column layout. Use the 3-part row inside each card (logo / details / action) but the outer grid stays `1fr`.
3. **Use merchant logos/icons, not product photos**, in deal cards.
4. **Escape and sanitise everything rendered from deal data** (`escapeHtml`, `sanitizeUrl`). Deals are untrusted third-party content.
5. **Keep the static fallback.** The site must still work when `/api/offers` is missing (GitHub Pages, local static server, offline).
6. **Do not delete `data/deals.json`** or replace it with an empty array.
7. **Do not run `generate-deals.js` / `npm run generate`** unless you intentionally want to rebuild from the legacy CSV — it overwrites the Cuelinks data.
8. **Keep affiliate attributes** on outbound links: `rel="nofollow sponsored noopener noreferrer"`, `target="_blank"`.
9. **Relative asset paths** (`assets/...`, `deal-detail.html?id=...`) so the site works from any path/domain.
10. **Mobile-first, accessible**: native checkboxes, `aria-expanded`, `aria-current`, `aria-live`, visible focus styles.

### 6.3 Content/layout preferences

- Modern, muted, European-inspired palette (sage, terracotta, slate) — see §14.
- Inter/system font stack, generous whitespace, subtle borders/shadows.
- Dates shown where available (`Start: 23 Nov 2026`, `Ends: 31 Dec 2026`).
- Every card shows: category, merchant, type badge, title, description, tags, dates, Buy Now, coupon/no-code indicator.
- Detail page adds terms and an “About {merchant}” block with a vendor link.
- Pagination is mandatory (12 per page). Do not render all ~1,200 offers at once.

---

## 7. Local development

### 7.1 Prerequisites

- Node.js 18+ (CI uses Node 20; local Node 24 works).
- npm.
- Optional: a Cuelinks V3 API key with `read:offers` scope.

### 7.2 Install and run

```bash
npm install
npm start
# → http://127.0.0.1:5000
```

`npm start` runs `npx http-server -p 5000`. To avoid stale caches while developing:

```bash
npx http-server -p 5000 -c-1
```

### 7.3 What works on a plain static server

- Pages, CSS, JS, local `data/deals.json`, filters, pagination, detail pages.
- `/api/offers` returns **404** — this is expected. `app.js` logs a warning and falls back to local data.

### 7.4 Testing Cloudflare Functions locally

```bash
npm install -D wrangler            # or use npx
copy .dev.vars.example .dev.vars   # Windows
# cp .dev.vars.example .dev.vars   # macOS/Linux
# edit .dev.vars and set CUELINKS_API_KEY
npx wrangler pages dev .
```

Wrangler serves the static site plus `/api/offers` and `/api/categories`. `.dev.vars` is git-ignored.

### 7.5 Syntax checks (no test suite exists)

```bash
node --check assets/js/app.js
node --check scripts/fetch-cuelinks.js
node --check functions/api/offers.js   # if you edit it
```

### 7.6 Browser smoke test

1. Open `/` → hero stats populate, 12 cards, pager.
2. Go to page 2 → new IDs, summary `Showing 13–24 of …`.
3. Open `/deals.html` → 4 dropdowns with counts.
4. Select two categories → result count shrinks, URL gains `?category=A,B`.
5. Select a topic and a store → AND behaviour across groups.
6. Click a card title → detail page shows logo, title, dates, tags, Buy Now.
7. Console: only the expected `/api/offers` 404 on static preview.

---

## 8. Configuration and secrets

| Variable | Where | Purpose |
| --- | --- | --- |
| `CUELINKS_API_KEY` | Local PowerShell/bash session, `.dev.vars`, Cloudflare Pages secret, GitHub Actions secret | Authorises Cuelinks V3 calls |

### 8.1 Cuelinks API basics

- Base URL: `https://developers.cuelinks.com/pub_api/v3`
- Auth header: `Authorization: Token <CUELINKS_API_KEY>`
- `Accept: application/json`
- Offers endpoint: `GET /offers`
- Offers params used/supported: `q`, `campaign_id`, `category_ids[]`, `offer_type` (`coupon`/`deal`), `channel_id`, `valid_on`, `sort`, `order`, `page`, `per_page` (max 500).
- Categories endpoint: `GET /categories`.

### 8.2 Setting the key locally (PowerShell)

```powershell
$env:CUELINKS_API_KEY = "your_key_here"   # current session only
node scripts/fetch-cuelinks.js
```

Do not write the key into a file that is tracked by git.

### 8.3 GitHub Actions secret

Repo → Settings → Secrets and variables → Actions → New repository secret:

- Name: `CUELINKS_API_KEY`
- Value: your Cuelinks V3 key

### 8.4 Cloudflare Pages secret

Cloudflare dashboard → Pages project → Settings → Environment variables → add `CUELINKS_API_KEY` (encrypt it). Redeploy after adding.

---

## 9. Data model (`data/deals.json`)

### 9.1 Top-level shape

```json
{
  "deals": [ /* deal objects */ ],
  "source": "cuelinks",
  "updatedAt": "2026-11-23T18:11:26.322Z"
}
```

The frontend only requires `deals` to be an array; it ignores `source`/`updatedAt`. Keep them for traceability.

### 9.2 Deal object fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Cuelinks offer ID. Unique. Used in URLs and image cache keys. |
| `title` | string | yes | Offer headline. |
| `merchant` | string | yes | Campaign/brand name, e.g. `Vijay Sales`. Drives logo lookup and store filter. |
| `category` | string | yes | Primary category (see §12). |
| `tags` | string[] | recommended | Category, merchant, type, extra categories, `Coupon Code`, `Deal`, percent-off, `Free Delivery`. |
| `description` | string | yes | Plain text (escaped on render). |
| `terms` | string | no | Shown on the detail page when present. |
| `couponCode` | string | no | Empty string if not a coupon. |
| `offerType` | `"coupon"` \| `"deal"` | yes | Drives badge, filter, type dot. |
| `buyLink` | string | yes | HTTPS tracking URL (`linksredirect.com`). |
| `status` | `"live"` \| `"expired"` | yes | Mirrors Cuelinks status; the UI additionally computes expiry from `endDate`. |
| `startDate` | string | no | `YYYY-MM-DD`. |
| `endDate` | string | no | `YYYY-MM-DD`; expiry is evaluated at 23:59:59 local time. |
| `offerAddedAt` | string | no | ISO timestamp; used for the `New` badge (≤ 7 days). |
| `image` | string | no | Product/logo image URL; **currently not rendered** in cards. |
| `imageSource` | `"product-page"` \| `"campaign"` \| `"none"` | yes | Provenance. |
| `campaignId` | string | no | Cuelinks campaign ID. |
| `campaign` | string | no | Cuelinks campaign name. |
| `originalPrice` | number \| null | no | MRP. |
| `discountPrice` | number \| null | no | Deal price. |
| `percentOff` | number \| null | no | Discount percentage. |
| `shippingCharge` | string/number \| null | no | Free-delivery text or amount. |
| `currency` | string | yes | Always `INR` from the fetch script. |

Legacy fields still read by the UI as fallbacks: `price`, `mrp`, `discount`, `site`, `expiresAt`. Keep them supported if you touch the renderer.

### 9.3 Example deal

```json
{
  "id": "132826",
  "title": "MacBooks From Rs.71,990 Await!",
  "merchant": "Vijay Sales",
  "category": "Electronics",
  "tags": ["Electronics", "Vijay Sales", "Deal"],
  "description": "Browse the newest MacBooks at fantastic rates…",
  "terms": "",
  "couponCode": "",
  "offerType": "deal",
  "buyLink": "https://linksredirect.com/?cid=176&source=api&url=https%3A%2F%2Fwww.vijaysales.com%2Fc%2Fmacbooks",
  "status": "live",
  "startDate": "2026-11-23",
  "endDate": "2026-12-31",
  "offerAddedAt": "2026-11-23T19:54:37Z",
  "image": "https://www.vijaysales.com/.../vs-logo-png.png",
  "imageSource": "product-page",
  "campaignId": "4164",
  "campaign": "Vijay Sales",
  "originalPrice": null,
  "discountPrice": null,
  "percentOff": null,
  "shippingCharge": null,
  "currency": "INR"
}
```

### 9.4 Cuelinks → JSON field mapping

| JSON field | Cuelinks offer field |
| --- | --- |
| `id` | `id` (stringified) |
| `title` | `title` |
| `merchant` | `campaign_name` (fallback `Store`) |
| `category` | `categories[0].name` (normalised) |
| `description` / `terms` | `description` / `terms` |
| `couponCode` | `coupon_code` (trimmed) |
| `offerType` | `offer_type` (`coupon` → coupon, everything else → deal) |
| `buyLink` | `tracking_url` |
| `status` | `status` (`live` → live, otherwise expired) |
| `startDate` / `endDate` / `offerAddedAt` | `start_date` / `end_date` / `created_at` |
| `originalPrice` / `discountPrice` / `percentOff` / `shippingCharge` | same names with underscores |
| `campaignId` / `campaign` | `campaign_id` / `campaign_name` |
| `image` | from `data/image-cache.json` only (API has no product images) |

### 9.5 Invariants

- IDs must be unique strings.
- `buyLink` must be `http(s)`; the UI refuses other schemes.
- Dates stay as plain strings; do not convert to timestamps in the JSON.
- `tags` stay an array of short strings (target ≤ 8).
- File remains valid JSON and pretty-printed with 2 spaces.
- Do not reorder/rename fields casually — `app.js` and legacy fallbacks depend on them.

---

## 10. Deal pipeline: daily and weekly processing

### 10.1 Automated refresh (recommended)

Workflow: `.github/workflows/fetch-cuelinks.yml`

- Triggers:
  - `workflow_dispatch` (manual “Run workflow” button)
  - `schedule: cron '0 */6 * * *'` → every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Steps: checkout → Node 20 → `node scripts/fetch-cuelinks.js` → commit `data/deals.json` if changed → push.
- Required secret: `CUELINKS_API_KEY`.

What it does **not** do: regenerate `sitemap.xml`, fetch images, or deploy. The host redeploys automatically on push (GitHub Pages / Cloudflare Pages).

**Daily check (2 minutes):**

1. GitHub → Actions → “Fetch Cuelinks Deals” → latest run green.
2. Confirm a recent `chore: refresh cuelinks deals` commit exists.
3. Open the site → hero deal count changed / cards render.
4. Spot-check 2–3 cards and one detail page.

### 10.2 Manual refresh (local)

PowerShell:

```powershell
cd "C:\Users\Rajesh\Documents\My Apps\GitHub\GrabOffer-site"
$env:CUELINKS_API_KEY = "your_key_here"

npm run fetch-deals                  # same as node scripts/fetch-cuelinks.js
node scripts/gen-sitemap.js          # prints "sitemap urls N"

git add data/deals.json sitemap.xml
git commit -m "chore: refresh cuelinks deals"
git push
```

Bash (CI/macOS/Linux):

```bash
CUELINKS_API_KEY=your_key_here node scripts/fetch-cuelinks.js
node scripts/gen-sitemap.js
git add data/deals.json sitemap.xml
git commit -m "chore: refresh cuelinks deals"
git push
```

Notes:

- The script paginates at `per_page=500`, `sort=created_at`, `order=desc`, with a 250 ms delay between pages.
- If the API is down or the key is missing, it exits non-zero and leaves `deals.json` untouched.
- The script does not prune anything; it replaces the array with the current API result, so deals removed upstream disappear on the next successful fetch.

### 10.3 Verification after any refresh

```powershell
node -e "const d=require('./data/deals.json'); console.log(d.deals.length, d.source, d.updatedAt)"
```

Check:

- Count is plausible (currently ~1,100–1,300).
- Every deal has `id`, `title`, `merchant`, `category`, `offerType`, `buyLink`.
- No `buyLink` starts with `javascript:` (the sanitizer would drop it, but data should be clean).
- Open the site and confirm 12 cards + pagination.

### 10.4 Suggested operating calendar

| Frequency | Action |
| --- | --- |
| Every 6 h | Automated workflow (no action if green) |
| Daily | Check workflow run + one page load |
| Weekly | Skim new categories/merchants, check broken/blank logos, run `node scripts/gen-sitemap.js` if deals changed outside the workflow |
| Monthly | Review expired deals, spot-check affiliate links, review analytics/search terms, update category aliases if new verticals appear |
| On demand | Manual fetch, add a hand-picked deal, theme changes, deploy config changes |

### 10.5 When to regenerate the sitemap

- After any change to `data/deals.json` made **outside** the GitHub Action (manual fetch, hand-added deals, deletions).
- After changing the canonical domain (also update `scripts/gen-sitemap.js` and `robots.txt`).
- The Action currently does not regenerate it — if you want this automated, add `node scripts/gen-sitemap.js` and `git add sitemap.xml` to the workflow (see §22).

### 10.6 Optional image enrichment

Product images are **no longer displayed** (merchant logos are used instead), so this is optional and mainly for future use:

```bash
npm run fetch-images
# knobs:
# IMAGE_FETCH_CONCURRENCY=6
# IMAGE_FETCH_TIMEOUT_MS=12000
# IMAGE_FETCH_LIMIT=0          # 0 = all pending
# RETRY_FAILED=1 or --retry-failed
```

It unwraps `linksredirect.com?url=`, fetches the merchant page, extracts `og:image` / JSON-LD / `<img>` candidates, updates `data/deals.json` and `data/image-cache.json`. It can be slow and is subject to merchant blocking.

---

## 11. Adding, editing, removing deals manually

You do not need the API to add a curated deal. Edit `data/deals.json` carefully.

### 11.1 Add one deal

1. Open `data/deals.json`.
2. Add an object to the **start** of the `deals` array (so it appears early).
3. Use a unique string `id` (e.g. `manual-2026-11-24-01`).
4. Keep commas/braces valid JSON.
5. Regenerate the sitemap and test.

Minimal example:

```json
{
  "id": "manual-2026-11-24-01",
  "title": "Flat 40% Off Running Shoes",
  "merchant": "Example Sports",
  "category": "Sports & Outdoors",
  "tags": ["Sports & Outdoors", "Example Sports", "Deal", "40% Off"],
  "description": "Limited-time discount on selected running shoes.",
  "terms": "Valid online only. Cannot be combined with other offers.",
  "couponCode": "",
  "offerType": "deal",
  "buyLink": "https://linksredirect.com/?cid=176&source=api&url=https%3A%2F%2Fexample.com%2Fsale",
  "status": "live",
  "startDate": "2026-11-24",
  "endDate": "2026-12-05",
  "offerAddedAt": "2026-11-24T09:00:00Z",
  "image": "",
  "imageSource": "none",
  "campaignId": "",
  "campaign": "Example Sports",
  "originalPrice": 4999,
  "discountPrice": 2999,
  "percentOff": 40,
  "shippingCharge": "Free Delivery",
  "currency": "INR"
}
```

### 11.2 Edit a deal

- Safe to edit: `title`, `description`, `terms`, `category`, `tags`, `dates`, `prices`, `couponCode`.
- Changing `id` breaks old links and the image cache mapping — avoid unless necessary.
- Keep `offerType` consistent with `couponCode` (coupon with a code, deal without).

### 11.3 Remove / expire

- Delete the object and regenerate the sitemap.
- Or set `endDate` in the past — the UI marks it expired and shows “View offer” instead of “Buy Now”, but keeps the page.

### 11.4 Add a merchant logo mapping

`assets/js/app.js` → `MERCHANT_DOMAINS` maps a lowercase merchant name to a domain used with Google’s favicon service. If a logo is missing/blank:

```js
'example sports': 'examplesports.com',
```

Otherwise the code tries to extract the destination hostname from `buyLink`’s `url` parameter. If both fail, initials are shown.

---

## 12. Categories and tags

### 12.1 Canonical categories

The UI accepts any string but groups known aliases into these buckets:

`Health & Beauty`, `Fashion`, `Food & Grocery`, `Travel`, `Software & Services`, `Sports & Outdoors`, `Electronics`, `Others`, `Gifts & Flowers`, `Baby & Kids`, `Gaming`, `Entertainment`, `Home & Kitchen`, `Mobiles & Accessories`, `Books & Stationery`, `Education`, `Finance`, plus whatever unknown values Cuelinks returns (they pass through).

### 12.2 Where aliases live (keep in sync)

| File | Function | Notes |
| --- | --- | --- |
| `scripts/fetch-cuelinks.js` | `normalizeCategory` | Applied when writing JSON |
| `assets/js/app.js` | `normalizeCategory` | Applied at render/filter time |
| `generate-deals.js` | inline `categoryMap` | Legacy CSV path only |

Known drift: `fetch-cuelinks.js` has no `artificial intelligence` alias, so JSON can contain `Artificial Intelligence`; `app.js` maps it to `Software & Services`. Adding the alias to the fetch script would normalise the data too.

### 12.3 Tag generation (fetch script)

`buildTags(offer, category)` adds, up to 8:

- the category
- `campaign_name` (merchant)
- `Coupon Code` if a coupon exists
- `Deal` if `offer_type === 'deal'`
- `NN% Off` if `percent_off`
- `Free Delivery` if shipping contains “free”
- up to 2 additional category names

The live-API path in `app.js` currently builds a smaller set: `[category, merchant, Coupon Code|Deal]`.

### 12.4 UI-only tags

Computed at render time and included in filtering:

- `New` — `offerAddedAt` within the last 7 days.
- `Ends soon` — `endDate` within the next 7 days and not already past.

### 12.5 How tags are used

- Card: first 6 tags (auto tags first), colour-coded for `New` / `Ends soon`.
- Detail: all tags.
- Topic filter dropdown: top 16 tags by frequency across loaded deals.
- URL: `?tag=New,Coupon%20Code` (comma-separated, OR within the group).

### 12.6 Add a new category end-to-end

1. Add alias(es) to `normalizeCategory` in `scripts/fetch-cuelinks.js`.
2. Add the same alias(es) to `normalizeCategory` in `assets/js/app.js`.
3. If it should appear on the home page, add a `.categories-card` to `index.html` with
   `href="deals.html?category=My%20Category"`.
4. Optionally add it to the footer “Browse” list.
5. Re-fetch deals (or edit JSON), regenerate the sitemap, test the filter and a detail page.

No CSS changes are required; category tiles are generic.

---

## 13. Frontend behaviour

All logic is in `assets/js/app.js` (single file, executed on `DOMContentLoaded`).

### 13.1 Loading and fallback

- On `http(s)`, tries `GET /api/offers?per_page=60&sort=created_at&order=desc` (+ `q`, `offer_type` from URL).
- On any non-OK response, network error, or `file://`, loads `data/deals.json`.
- Sets `useLiveApi` (currently informational) and updates hero stats:
  - `#stat-deals` → `${deals.length}+`
  - `#stat-stores` → unique merchant count + `+`
- If loading fails entirely, `deals = []` and pages show empty states.

> **Important:** in live-API mode only the newest 60 offers are loaded. Category/store/tag filters and pagination then operate on those 60, and detail links for older IDs will not resolve. The static `deals.json` mode loads all ~1,185.

### 13.2 Cards (`dealCardTemplate`)

Single-column card with a 3-part row:

1. **Logo block** — favicon/logo + coupon/deal dot.
2. **Details** — category, merchant, type badge, title (link to detail), price/MRP/% off (if present), 2-line description, tags, start/end dates.
3. **Action** — Buy Now (or “View offer” if expired, or disabled if no link), coupon code pill or “No code needed”.

Links: `target="_blank"`, `rel="nofollow sponsored noopener noreferrer"`. Images use `loading="lazy"`, `referrerpolicy="no-referrer"`.

### 13.3 Filters (`deals.html`)

Four multi-select dropdowns: **Offer type**, **Topic**, **Category**, **Store**.

- Checkboxes; OR within a group, AND across groups.
- Counts are totals across all loaded deals (not faceted).
- Topic list = top 16 tags; store list = top 40 merchants; categories = all; types = coupons/deals.
- Trigger shows a count badge and a selected state.
- “Clear all” clears checkboxes **and** the search box.
- Panels close on outside click and `Esc`; flip up near the bottom; right-align near the viewport edge.
- URL params (comma-separated): `category`, `site`, `type`, `tag`, plus `q`. Written with `history.replaceState`, read on load.
- Any change resets pagination to page 1.

### 13.4 Pagination

- 12 per page (`DEALS_PER_PAGE = 12`) on both home and deals pages.
- Previous / Next + first, last, and ±1 page numbers with ellipses.
- Summary: `Showing 1–12 of 1,185 offers`; when one page: `Showing all N offers`.
- Page number is **not** in the URL; reloading returns to page 1.

### 13.5 Search

- Deals page: typing filters client-side across title, description, category, merchant, coupon code, type, tags. The form submit is prevented.
- Home hero: submits `?q=...` to `deals.html`.
- In live-API mode, `q` is also sent to the API.

### 13.6 Detail page

- Looks up `?id=` in the loaded array (no extra request).
- Shows logo, category/merchant/type, title, dates + live/expired status, price row, description, tags, coupon guidance, Buy Now, terms, and “About {merchant}” with the vendor domain.
- Updates `document.title`, `meta[name=description]`, `og:title`, `og:description`, and injects Product JSON-LD (`priceCurrency: INR`, availability `InStock`/`Discontinued`).
- Unknown ID → “Deal not found” message.

### 13.7 Misc

- Newsletter forms are a front-end stub (`alert`), no backend.
- Cuelinks script `cId = 176` is included before `</body>` on pages.
- Hero stats have static defaults (`1,700+`, `50+`) until JS runs.

---

## 14. Theme and CSS

Single stylesheet: `assets/css/style.css`. Design tokens at the top:

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f7f6f3` | Page background |
| `--surface` | `#ffffff` | Cards, panels |
| `--surface-alt` | `#f1efe9` | Logo tiles, subtle fills |
| `--text` | `#1f2428` | Body text |
| `--muted` | `#667085` | Secondary text |
| `--border` | `#e6e2da` | Borders/dividers |
| `--primary` | `#2f4f4f` | Buttons, active states |
| `--primary-hover` | `#243d3d` | Hover |
| `--accent` | `#7a9e7e` | Sage highlights |
| `--accent-soft` | `#e8efe8` | Tag backgrounds |
| `--warn` | `#b86b4b` | Coupons, expiry, “Ends soon” |
| `--radius` | `16px` | Large radii |
| `--radius-sm` | `10px` | Small radii |
| `--shadow` | `0 10px 30px rgba(31,36,40,.05)` | Cards |
| `--max-width` | `1180px` | Container |

Key layout classes:

- `.container` — width clamp + centred.
- `.featured-deals-grid` — **1 column**, 1rem gap.
- `.deal-card` → `.deal-row` → `.deal-icon` / `.deal-main` / `.deal-side` (grid `88px minmax(0,1fr) 220px`).
- `.filter-bar`, `.filter-dropdown`, `.filter-trigger`, `.filter-panel`, `.filter-option` — dropdown filters.
- `.pagination`, `.pager`, `.pager-btn` — pager.
- `.deal-detail-card`, `.detail-head`, `.detail-body`, `.detail-section` — detail layout.
- Utility: `.u-flex`, `.u-text-center`, `.u-text-sm`.

Breakpoints: `1024px` (nav/categories), `860px` (deal row drops the action column), `720px` (filters/mobile nav), `640px` (detail/footer), `520px` (single-column deal row).

Restyling rules:

- Change tokens first; most colours derive from them.
- Keep contrast accessible (muted text on `--bg`).
- Do not reintroduce image-based cards or a multi-column deal grid.
- Test at 360 px, 768 px, 1024 px, 1440 px.

---

## 15. API proxy (Cloudflare Pages Functions)

### 15.1 `functions/api/offers.js`

- `GET /api/offers` → forwards to `https://developers.cuelinks.com/pub_api/v3/offers`.
- Injects `Authorization: Token <env.CUELINKS_API_KEY>`.
- Whitelists query params: `q`, `campaign_id`, `category_ids[]`, `offer_type`, `channel_id`, `valid_on`, `sort`, `order`, `page`, `per_page`.
- Defaults `per_page=30` if absent.
- Success cache: `public, max-age=300, s-maxage=600`; errors `no-store`.
- Missing key → `500 {"error":"CUELINKS_API_KEY is not configured"}`.
- Network failure → `502` with detail.

### 15.2 `functions/api/categories.js`

- `GET /api/categories` → Cuelinks `/categories`.
- Cache `max-age=3600, s-maxage=3600`.
- Same auth/error behaviour.
- Currently not called by the frontend; available for future category-driven UI.

### 15.3 Security model

- The API key never reaches the browser.
- Only whitelisted params are forwarded (no arbitrary path/param injection).
- Responses are passed through with their content type.
- CORS is same-origin by default (Functions live on the same host).

### 15.4 Testing

```bash
npx wrangler pages dev .
curl "http://127.0.0.1:8788/api/offers?per_page=2"
curl "http://127.0.0.1:8788/api/categories"
```

Check status, JSON shape (`data`, `meta`), and cache headers.

---

## 16. Deployment

### 16.1 Option A — GitHub Pages (current repo markers)

- `CNAME` = `sale.graboffer.in`
- `.nojekyll` present
- Push to `main`; Pages serves the repo root.
- Custom domain must be configured in GitHub → Settings → Pages.
- No `CUELINKS_API_KEY` on Pages → `/api/*` is 404 → the site uses `data/deals.json`. That is fine and expected.

> Inconsistency: `robots.txt` and `sitemap.xml`/`scripts/gen-sitemap.js` use `https://graboffer.github.io`, while `CNAME` points at `sale.graboffer.in`. If the custom domain is canonical, update the base URL in `scripts/gen-sitemap.js`, `robots.txt`, and regenerate the sitemap.

### 16.2 Option B — Cloudflare Pages (enables live API)

1. Push to GitHub (private repo recommended).
2. Cloudflare Pages → Create project → connect repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(empty)*
   - Output directory: `/`
4. Environment variable: `CUELINKS_API_KEY` (encrypted).
5. Deploy.
6. Point `sale.graboffer.in` at the Pages project (custom domain), or keep the Pages subdomain.

With Functions live, the browser gets the newest 60 offers from the API; the bundled JSON remains the fallback.

### 16.3 Post-deploy checks

- Home renders and stats populate.
- `/deals.html` filters have counts; multi-select works.
- Detail page from a card works.
- `/api/offers?per_page=2` returns 200 (Cloudflare) or 404 (Pages static).
- No mixed-content warnings.
- `sitemap.xml` loads and lists detail URLs.

### 16.4 Caching

- Static assets: host defaults; bump or purge after CSS/JS changes.
- Functions: 5 min browser / 10 min edge for offers; 1 h for categories.
- `data/deals.json` is fetched at runtime; a new deploy/commit makes it fresh. If you see stale cards, hard-refresh and check the deployed JSON.

---

## 17. Affiliate links and compliance

- All outbound merchant links are Cuelinks tracking URLs: `https://linksredirect.com/?cid=176&source=api&url=<encoded destination>`.
- The `cid` (channel/campaign ID) is **176** throughout the site and in the Cuelinks page script. If the account/channel changes, update:
  - links returned by the API (automatic),
  - the inline `cId` scripts in `index.html`, `deals.html`, `deal-detail.html`, `404.html`,
  - `generate-deals.js` (legacy).
- Outbound links use `rel="nofollow sponsored noopener noreferrer"` and `target="_blank"`.
- Footer discloses affiliate participation.
- Do not strip tracking params or wrap links in redirects that drop them.
- Prices/discounts are third-party; the footer disclaimer covers changeability.

---

## 18. Runbook: common commands

| Need | Command |
| --- | --- |
| Install | `npm install` |
| Local site | `npm start` |
| Local site, no cache | `npx http-server -p 5000 -c-1` |
| Functions dev | `npx wrangler pages dev .` |
| Fetch deals | `npm run fetch-deals` (or `node scripts/fetch-cuelinks.js`) |
| Count/verify data | `node -e "const d=require('./data/deals.json'); console.log(d.deals.length)"` |
| Sitemap | `node scripts/gen-sitemap.js` |
| Images | `npm run fetch-images` |
| Retry failed images | `$env:RETRY_FAILED='1'; npm run fetch-images` |
| JS syntax | `node --check assets/js/app.js` |
| Git status | `git status --short` |
| Commit refresh | `git add data/deals.json sitemap.xml; git commit -m "chore: refresh deals"; git push` |
| Legacy CSV rebuild (danger) | `npm run generate` |

PowerShell note: `;` separates commands; use `$env:NAME = "value"` for env vars. Do not paste keys into committed files.

---

## 19. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `/api/offers` 404 in console | Static host (GitHub Pages/local http-server) | Expected; site falls back to `data/deals.json` |
| No cards at all | `data/deals.json` missing/invalid, or fetch failed | Validate JSON; run fetch; check network tab |
| Filter dropdowns empty | `renderFilters()` didn’t run or no deals | Confirm `#deals-grid` exists and data loaded |
| Category link shows 0 results | Category name mismatch/alias missing | Check `normalizeCategory` maps; compare URL to filter values |
| Detail page says “Deal not found” | ID not in loaded set (live API only has 60) or deleted | Use static mode / refresh data; verify ID |
| Logo blank/white tile | Favicon missing or white-on-transparent | Add `MERCHANT_DOMAINS` entry; fallback initials |
| Buy Now disabled | Missing/invalid `buyLink` | Fix URL to `http(s)` |
| Old deals still visible | Stale deploy/cache or workflow didn’t commit | Check Actions run, deployed JSON, hard refresh |
| Workflow fails | Missing/expired `CUELINKS_API_KEY`, API 401/429 | Rotate key; re-run; respect rate limits |
| Fetch writes 0 deals | API returned empty page / auth issue | Inspect error text; test `/offers` directly |
| Sitemap has old URLs | Not regenerated after data change | `node scripts/gen-sitemap.js` and commit |
| Prices show ₹ for non-INR offers | Currency hard-coded INR | Future work: per-offer currency |
| Layout breaks after edit | Over-broad CSS or grid change | Keep 1-column grid; test breakpoints |

---

## 20. QA checklist

### Every data refresh

- [ ] Fetch completed with a plausible count.
- [ ] JSON parses; no `null` required fields.
- [ ] 12 cards render; pagination summary correct.
- [ ] At least 3 cards open detail pages.
- [ ] Buy Now links resolve to `linksredirect.com` (or intended destination).
- [ ] Filters have counts; multi-select + clear-all work.
- [ ] Dates display and expiry logic looks sane.
- [ ] No console errors except the expected API 404 on static preview.

### Every code change

- [ ] `node --check assets/js/app.js` passes.
- [ ] No inline event handlers added that bypass escaping.
- [ ] All deal text rendered through `escapeHtml`.
- [ ] All URLs through `sanitizeUrl`.
- [ ] Layout tested at 360 / 768 / 1024 / 1440 px.
- [ ] Filters, pagination, search, detail page re-tested.
- [ ] Accessibility: keyboard dropdown open/close, focus visible, labels on inputs.
- [ ] No secrets, build artifacts, or `v1-old` files added.

### Every deploy

- [ ] Environment variable present (Cloudflare) or fallback data committed (static).
- [ ] `sitemap.xml`/`robots.txt` domain correct.
- [ ] Custom domain/HTTPS active.
- [ ] Cuelinks script loads (network tab).
- [ ] No mixed content.

---

## 21. Known limitations and inconsistencies

1. **Sitemap/robots domain mismatch** — `CNAME` says `sale.graboffer.in`; sitemap/robots use `graboffer.github.io`.
2. **Live-API mode is shallow** — only the newest 60 offers are fetched; no server-side pagination; category/store/tag filtering and detail lookups only cover those 60. Static JSON mode covers all.
3. **Detail pages are client-rendered** — social crawlers and some search bots see the generic shell, not per-deal meta. The sitemap still lists every deal.
4. **No product images from Cuelinks** — the API payload lacks them; logos come from Google’s favicon service, which is a third-party dependency and can return blanks.
5. **Prices are sparse and INR-only** — many offers have `null` prices; UI formats everything as INR although copy says “global”.
6. **GitHub Action doesn’t rebuild the sitemap** — manual refresh steps include it; automate if desired.
7. **No expired-deal pruning** — expired offers stay in JSON and pages; UI labels them.
8. **`status` is not used for expiry** — `isExpired()` relies on `endDate` only.
9. **Filter option lists are capped** — top 16 topics, top 40 stores; search covers the rest.
10. **Page number not in URL** — reloads/back button return to page 1.
11. **Newsletter is a stub** — `alert()` only.
12. **Legacy CSV generator is dangerous** — `npm run generate` overwrites `data/deals.json` from `data/offers.csv`.
13. **Category alias drift** — `Artificial Intelligence` normalises differently in ingestion vs UI.
14. **No automated tests/CI validation** — only `node --check` is available.
15. **Cuelinks `cId` hard-coded (176)** — update all pages if the account changes.
16. **Footer store links may not match real merchants** (Amazon/Flipkart/Myntra/Ajio) and can yield 0 results.

---

## 22. Roadmap and suggested next work

Prioritised ideas for future iterations (validate with the user first):

1. **Pre-render or SSR detail pages** for SEO/social previews (e.g. build-time static pages per deal, or Cloudflare Pages Function HTML rendering).
2. **Move filtering/pagination server-side** in live mode (use Cuelinks `page`, `per_page`, `category_ids[]`, `campaign_id`, `q`) so all offers are reachable.
3. **Automate sitemap regeneration** in the refresh workflow; unify canonical domain.
4. **Faceted counts** in filters (counts relative to current selection).
5. **Expired-deal lifecycle**: hide/archive after N days, keep 410/404 semantics, clean sitemap.
6. **Price/currency normalisation** (per-offer currency, INR display, “approx.” handling).
7. **Logo quality**: self-host or cache merchant logos instead of Google favicons.
8. **Search improvements**: debounce, synonyms, merchant aliases, zero-result suggestions.
9. **Analytics + affiliate click tracking** (privacy-friendly), plus “top deals” reporting.
10. **Newsletter/backend** (real signup, double opt-in, unsubscribe).
11. **Add tests**: unit tests for normalisation/expiry/tagging; Playwright smoke tests.
12. **Accessibility audit**: full keyboard flow for dropdowns, screen-reader labels for pager.
13. **Performance**: split CSS, preload critical assets, reduce JSON payload (compressed feed or per-page files).
14. **Remove/retire legacy** `generate-deals.js` and `data/offers.csv` once confirmed unused, or move to `legacy/`.

---

## 23. Instructions for AI coding agents

### 23.1 Read order

1. `PROJECT-GUIDE.md` (this file)
2. `assets/js/app.js`
3. `assets/css/style.css`
4. `index.html`, `deals.html`, `deal-detail.html`
5. `scripts/fetch-cuelinks.js`, `functions/api/*.js`
6. `data/deals.json` (sample 1–2 records only; it is large)

### 23.2 Invariants to preserve

- 1-column deal list; logo-first cards; no product-photo cards.
- All deal text escaped; all URLs sanitised; affiliate rel/target intact.
- Static fallback must keep working without Functions.
- 12 per page; filters multi-select with URL sync.
- Data stays in `data/deals.json` with the documented schema.
- No secrets in the repo; no new build step unless justified.
- Do not resurrect `v1-old/`.

### 23.3 Task → files map

| Task | Files to touch |
| --- | --- |
| Card layout/content | `assets/js/app.js` (`dealCardTemplate`), `assets/css/style.css` |
| Filters/search | `assets/js/app.js` (`renderFilters`, `initFilters`, `applyFilters`), `deals.html` |
| Pagination | `assets/js/app.js` (`renderDeals`, `renderPagination`, `initIndexPagination`), page HTML (`#pagination`) |
| Detail page | `assets/js/app.js` (`renderDealDetail`), `deal-detail.html`, CSS |
| Category mapping | `scripts/fetch-cuelinks.js`, `assets/js/app.js`, `index.html` tiles |
| Tag rules | `scripts/fetch-cuelinks.js` (`buildTags`), `assets/js/app.js` (`computeExtraTags`, live mapping) |
| Ingestion/API params | `scripts/fetch-cuelinks.js`, `functions/api/offers.js` |
| Refresh automation | `.github/workflows/fetch-cuelinks.yml` |
| SEO | `scripts/gen-sitemap.js`, `robots.txt`, meta tags in HTML, JSON-LD in `app.js` |
| Theme | `assets/css/style.css` (`:root` tokens first) |
| Deployment | `CNAME`, Cloudflare dashboard, README |

### 23.4 Working method

1. Inspect before editing; prefer targeted edits over rewrites.
2. Make changes consistent with existing naming/formatting (2-space indent, semicolons, template literals).
3. Run `node --check` on edited JS.
4. Test with a local static server and the browser: home, deals, filters, pagination, detail.
5. Verify no console errors besides the expected `/api/offers` 404 on static.
6. Summarise what changed, what was tested, and any known gaps.
7. Never commit unless the user asks; never commit keys.

### 23.5 Style guide

- Vanilla ES2017+, no dependencies for frontend code.
- Functions are small and named descriptively; comments sparingly.
- Use the existing CSS tokens and class naming (kebab-case, blocks like `deal-*`).
- Keep inline styles out of new markup unless matching existing patterns.
- Prefer semantic HTML (`article`, `section`, `nav`, `h1`–`h3`).
- Keep copy English, concise, and neutral.

### 23.6 Things that will get a change rejected

- Reintroducing the 3-column card grid or full product images.
- Removing the JSON fallback or requiring Cloudflare to function.
- Rendering unescaped third-party strings or allowing `javascript:` URLs.
- Loading all ~1,200 offers on one page.
- Hard-coding API keys, tokens, or secrets.
- Rewriting the site into a framework without an explicit request.

### 23.7 Copy-paste prompt for an AI tool

```text
You are working on the GrabOffer repo: a static deals site (HTML/CSS/vanilla JS)
whose data comes from the Cuelinks V3 API and is cached in data/deals.json.

Read PROJECT-GUIDE.md in full first, then:
- assets/js/app.js
- assets/css/style.css
- deals.html, index.html, deal-detail.html
- scripts/fetch-cuelinks.js and functions/api/*.js (only if relevant)

Follow every invariant in PROJECT-GUIDE.md section 23.2. In particular:
- single-column, logo-first deal cards (never product-photo cards)
- 12 offers per page with pagination
- multi-select dropdown filters with URL sync
- graceful fallback to data/deals.json when /api/offers is unavailable
- escape all deal text and sanitise all URLs; keep affiliate rel/target
- no secrets in the repo; no new build step unless explicitly approved

Do not paste the whole 1.2 MB data/deals.json into context — read one or two
sample records instead.

Work in small, targeted edits. Before finishing:
1. run node --check on every edited JS file,
2. serve locally (npm start) and test home, deals filters, pagination, and a detail page,
3. report what changed, what you tested, and any known gaps.
```

---

## 24. Glossary

| Term | Meaning |
| --- | --- |
| **Cuelinks** | Affiliate/deals network providing the offers API and tracking links. |
| **V3 API** | Cuelinks publisher API version used here (`/pub_api/v3`). |
| **`cId`** | Cuelinks channel/campaign ID embedded in the on-page script (currently `176`). |
| **`linksredirect.com`** | Cuelinks redirect domain used for affiliate tracking. |
| **Coupon** | Offer that requires/contains a promo code. |
| **Deal** | Offer with a discount but no code required. |
| **Pages Function** | Cloudflare serverless handler (`functions/api/*.js`) proxying the API. |
| **`deals.json`** | Static, committed snapshot of offers used by the frontend fallback. |
| **Favicon service** | Google `s2/favicons` endpoint used to render merchant logos. |
| **JSON-LD** | Structured data injected on detail pages for search engines. |
| **i18n/locale** | Dates use `en-IN`; prices use `en-IN`/INR. |

---

## 25. Document maintenance

- Update this file whenever you change: data schema, fetch workflow, filters, pagination, deployment, domain, or affiliate IDs.
- Refresh the “Current snapshot” table after a major data refresh (counts, date, notable changes).
- Keep commands copy-paste accurate for Windows PowerShell (primary environment) and bash (CI).
- If you add a new top-level script or page, add it to the repository map and task table.

**Change log**

| Date | Change |
| --- | --- |
| 2026-11-24 | Initial comprehensive guide (architecture, data model, daily processing, filters, operations, AI-agent instructions). |
