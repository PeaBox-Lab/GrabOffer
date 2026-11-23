const CUELINKS_BASE = 'https://developers.cuelinks.com/pub_api/v3';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=600',
      ...extraHeaders,
    },
  });
}

export async function onRequestGet(context) {
  const apiKey = context.env.CUELINKS_API_KEY;
  if (!apiKey) {
    return json({ error: 'CUELINKS_API_KEY is not configured' }, 500, { 'cache-control': 'no-store' });
  }

  const incoming = new URL(context.request.url);
  const upstream = new URL(`${CUELINKS_BASE}/offers`);
  const allowed = ['q', 'campaign_id', 'category_ids[]', 'offer_type', 'channel_id', 'valid_on', 'sort', 'order', 'page', 'per_page'];

  for (const key of allowed) {
    const values = incoming.searchParams.getAll(key);
    for (const value of values) {
      if (value !== '') upstream.searchParams.append(key, value);
    }
  }
  if (!upstream.searchParams.has('per_page')) upstream.searchParams.set('per_page', '30');

  try {
    const res = await fetch(upstream.toString(), {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json; charset=utf-8';
    return new Response(text, {
      status: res.status,
      headers: {
        'content-type': contentType,
        'cache-control': res.ok ? 'public, max-age=300, s-maxage=600' : 'no-store',
      },
    });
  } catch (error) {
    return json({ error: 'Failed to fetch offers', detail: String(error) }, 502, { 'cache-control': 'no-store' });
  }
}