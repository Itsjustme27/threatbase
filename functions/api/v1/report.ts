import supabaseClient from '../../../src/supabaseClient'
import { isValidPublicIp, isValidCategory, MAX_COMMENT_LENGTH } from '../../../src/lib/apiValidation'

export const onRequestPost = async (context: any) => {
  const { request, data } = context;
  const userId = data.userId; // Provided by middleware

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const { ip, category, comment } = body ?? {};

    if (typeof ip !== 'string' || typeof category !== 'string' || typeof comment !== 'string') {
      return new Response(JSON.stringify({ error: "Missing required fields: ip, category, comment" }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const cleanIp = ip.trim();
    const cleanCategory = category.trim();
    const cleanComment = comment.trim();

    if (!cleanIp || !cleanCategory || !cleanComment) {
      return new Response(JSON.stringify({ error: "Missing required fields: ip, category, comment" }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // Reject anything that isn't a publicly routable IP so the API cannot be
    // used to poison the community blocklist with junk or internal addresses.
    if (!isValidPublicIp(cleanIp)) {
      return new Response(JSON.stringify({ error: "Invalid IP address. Provide a public IPv4 or IPv6 address." }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!isValidCategory(cleanCategory)) {
      return new Response(JSON.stringify({ error: "Invalid category." }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (cleanComment.length > MAX_COMMENT_LENGTH) {
      return new Response(JSON.stringify({ error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters).` }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Fetch user's alias
    let reporter_alias = "API User";
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    
    if (profile && profile.username) {
      reporter_alias = profile.username;
    }

    // 2. Check if already reported
    const { data: existingReport } = await supabaseClient
      .from('reported_ips')
      .select('id')
      .eq('ip', cleanIp)
      .eq('reporter_alias', reporter_alias)
      .maybeSingle()

    if (existingReport) {
      return new Response(JSON.stringify({ error: "You have already reported this IP." }), {
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Insert report securely via RPC to bypass RLS for anon requests
    const { error: insertError } = await supabaseClient.rpc('api_insert_report', {
      p_ip: cleanIp,
      p_category: cleanCategory,
      p_comment: cleanComment,
      p_reporter_alias: reporter_alias
    });

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, message: "IP reported successfully." }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('POST /api/v1/report failed:', err?.message || err);
    return new Response(JSON.stringify({ error: "Failed to process request" }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
