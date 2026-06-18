import { scanIndicatorLogic } from '../../../src/scanner'

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

  try {
    const result = await scanIndicatorLogic(ip, 'latest');
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
