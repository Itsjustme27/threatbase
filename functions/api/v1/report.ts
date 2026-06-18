import supabaseClient from '../../../src/supabaseClient'

export const onRequestPost = async (context: any) => {
  const { request, data } = context;
  const userId = data.userId; // Provided by middleware

  try {
    const body = await request.json();
    const { ip, category, comment } = body;

    if (!ip || !category || !comment) {
      return new Response(JSON.stringify({ error: "Missing required fields: ip, category, comment" }), { 
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
      .eq('ip', ip.trim())
      .eq('reporter_alias', reporter_alias)
      .maybeSingle()

    if (existingReport) {
      return new Response(JSON.stringify({ error: "You have already reported this IP." }), { 
        status: 409, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Insert report
    const { error: insertError } = await supabaseClient
      .from('reported_ips')
      .insert([{ 
        ip: ip.trim(), 
        category: category, 
        comment: comment.trim(), 
        reporter_alias: reporter_alias 
      }]);

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, message: "IP reported successfully." }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to process request" }), { 
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
