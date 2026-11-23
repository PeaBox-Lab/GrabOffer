const CUELINKS_BASE = 'https://developers.cuelinks.com/pub_api/v3';

export async function onRequestGet(context) {
  const apiKey = context.env.CUELINKS_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'CUELINKS_API_KEY is not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  try {
    const res = await fetch(`${CUELINKS_BASE}/categories`, {
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Accept': 'application/json',
      },
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json; charset=utf-8',
        'cache-control': res.ok ? 'public, max-age=3600, s-maxage=3600' : 'no-store',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch categories', detail: String(error) }), {
      status: 502,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}