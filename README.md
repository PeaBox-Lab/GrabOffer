# GrabOffer

Global deals and coupons website powered by the **Cuelinks V3 API**.

## Documentation

**[`PROJECT-GUIDE.md`](PROJECT-GUIDE.md)** is the full project and operations guide: architecture, data model, daily/weekly processing, adding deals, categories/tags, filters, deployment, troubleshooting, and instructions for AI coding agents. Start there.

## Stack

- **Frontend**: static HTML/CSS/vanilla JS (Cloudflare Pages / GitHub Pages compatible)
- **Live API proxy**: Cloudflare Pages Functions (`functions/api/offers.js`, `functions/api/categories.js`)
- **Data refresh**: `scripts/fetch-cuelinks.js` pulls offers from Cuelinks and writes `data/deals.json`
- **Design**: modern, clean, European-inspired palette

## Setup

### 1. Get Cuelinks API key
Create a V3 API key in Cuelinks with at least `read:offers` scope.

### 2. Local development
```bash
npm install
# optional: fetch live deals into data/deals.json
CUELINKS_API_KEY=your_key node scripts/fetch-cuelinks.js
npm start
```

For Cloudflare Pages Functions locally, use Wrangler and set `CUELINKS_API_KEY` in `.dev.vars` (see `.dev.vars.example`).

### 3. Deploy on GitHub + Cloudflare Pages
1. Push this repo to a **private GitHub repo**.
2. In **Cloudflare Pages**, create a project from that repo.
3. Build settings:
   - Framework preset: None
   - Build command: *(empty)*
   - Output directory: `/`
4. Add environment variable/secret in Cloudflare Pages:
   - `CUELINKS_API_KEY` = your Cuelinks V3 key
5. Deploy. The frontend will call `/api/offers`, which is proxied by Pages Functions using the secret key.

### 4. Refresh deals
- **Automatic/scheduled**: GitHub Action `.github/workflows/fetch-cuelinks.yml` runs every 6 hours or manually. Add repo secret `CUELINKS_API_KEY`.
- **Manual**: run `npm run fetch-deals` (or `node scripts/fetch-cuelinks.js`) with `CUELINKS_API_KEY` set, then `npm run sitemap`.

## Important

- **Never commit API keys**. Use Cloudflare secrets, GitHub Actions secrets, or local `.dev.vars`.
- The frontend falls back to `data/deals.json` if `/api/offers` is unavailable.
- `data/offers.csv` and old v1 files are legacy/reference; Cuelinks API is the new source.