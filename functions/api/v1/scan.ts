import { scanIndicatorLogic } from '../../../src/scanner'
import { MAX_INDICATOR_LENGTH } from '../../../src/lib/apiValidation'

export const onRequest = async (context: any) => {
  const { request } = context;
  const url = new URL(request.url);
  const ip = url.searchParams.get('ip') || url.searchParams.get('indicator');

  if (!ip) {
    return new Response(JSON.stringify({ error: "Missing 'ip' parameter" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (ip.length > MAX_INDICATOR_LENGTH) {
    return new Response(JSON.stringify({ error: `Indicator is too long (max ${MAX_INDICATOR_LENGTH} characters).` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const result = await scanIndicatorLogic(ip, 'latest');
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('GET /api/v1/scan failed:', err?.message || err);
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
