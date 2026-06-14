/**
 * Threatbase IOC Scanner — Cloudflare Worker
 * Detects IOC type (IP / domain / URL / hash) and queries VirusTotal v3.
 * Returns normalized JSON. Caches results in KV to save API quota.
 *
 * Setup:
 *   wrangler kv namespace create IOC_CACHE   -> add id to wrangler.toml
 *   wrangler secret put VT_API_KEY            -> paste your VT API key
 *   wrangler deploy
 *
 * Usage: GET /?ioc=<ip|domain|url|hash>
 */

const VT_API = 'https://www.virustotal.com/api/v3';
const CACHE_TTL = 3600; // seconds

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // tighten to https://threatbase.qzz.io if needed
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(obj: any, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extra },
  });
}

function detectType(ioc: string) {
  if (/^[a-fA-F0-9]{32}$/.test(ioc)) return 'hash';   // MD5
  if (/^[a-fA-F0-9]{40}$/.test(ioc)) return 'hash';   // SHA1
  if (/^[a-fA-F0-9]{64}$/.test(ioc)) return 'hash';   // SHA256
  if (/^https?:\/\//i.test(ioc)) return 'url';
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(ioc)) {
    return ioc.split('.').every(o => +o >= 0 && +o <= 255) ? 'ip' : null;
  }
  if (ioc.includes(':') && /^[0-9a-fA-F:]+$/.test(ioc)) return 'ip'; // IPv6, simplified
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/.test(ioc)) return 'domain';
  return null;
}

function urlToVtId(url: string) {
  // VT v3 URL id = base64url(url) without padding
  return btoa(url).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function endpointFor(type: string, ioc: string) {
  switch (type) {
    case 'ip': return `/ip_addresses/${ioc}`;
    case 'domain': return `/domains/${ioc}`;
    case 'url': return `/urls/${urlToVtId(ioc)}`;
    case 'hash': return `/files/${ioc}`;
  }
}

function normalize(ioc: string, type: string, vt: any) {
  const attrs = vt?.data?.attributes || {};
  const stats = attrs.last_analysis_stats || {};
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;

  let verdict = 'unknown';
  if (malicious > 0) verdict = 'malicious';
  else if (suspicious > 0) verdict = 'suspicious';
  else if (Object.keys(stats).length) verdict = 'clean';

  return {
    ioc,
    type,
    verdict,
    stats: {
      malicious,
      suspicious,
      harmless: stats.harmless || 0,
      undetected: stats.undetected || 0,
    },
    reputation: attrs.reputation ?? null,
    last_analysis_date: attrs.last_analysis_date
      ? new Date(attrs.last_analysis_date * 1000).toISOString()
      : null,
    extra: {
      country: attrs.country || null,
      as_owner: attrs.as_owner || null,
      asn: attrs.asn || null,
      categories: attrs.categories || null,
      type_description: attrs.type_description || null, // hash files
      meaningful_name: attrs.meaningful_name || null,    // hash files
    },
    vt_link: `https://www.virustotal.com/gui/search/${encodeURIComponent(ioc)}`,
  };
}

export default {
  async fetch(request: Request, env: any) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const ioc = new URL(request.url).searchParams.get('ioc')?.trim();
    if (!ioc) return jsonResponse({ error: 'Missing ?ioc= param' }, 400);

    const type = detectType(ioc);
    if (!type) return jsonResponse({ error: 'Could not detect IOC type', ioc }, 400);

    const cacheKey = `vt:${type}:${ioc}`;
    const cached = await env.IOC_CACHE?.get(cacheKey);
    if (cached) return jsonResponse(JSON.parse(cached), 200, { 'X-Cache': 'HIT' });

    let vtRes;
    try {
      vtRes = await fetch(`${VT_API}${endpointFor(type, ioc)}`, {
        headers: { 'x-apikey': env.VT_API_KEY },
      });
    } catch (e: any) {
      return jsonResponse({ error: 'VT request failed', detail: e.message }, 502);
    }

    let result;
    if (vtRes.status === 404) {
      result = { ioc, type, verdict: 'unknown', message: 'Not found in VirusTotal' };
    } else if (!vtRes.ok) {
      return jsonResponse({ error: 'VT lookup failed', status: vtRes.status }, 502);
    } else {
      result = normalize(ioc, type, await vtRes.json());
    }

    await env.IOC_CACHE?.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL });
    return jsonResponse(result, 200, { 'X-Cache': 'MISS' });
  },
};
