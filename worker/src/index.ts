export interface Env {
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}
		
		const url = new URL(request.url);
		const ioc = url.searchParams.get('ioc') || url.searchParams.get('ip');
		
		if (!ioc) {
			return new Response(JSON.stringify({ error: 'Missing IOC parameter' }), { 
				status: 400, 
				headers: { 'Content-Type': 'application/json', ...corsHeaders } 
			});
		}

		try {
			// Query ThreatFox API
			const threatFoxRequest = {
				query: 'search_ioc',
				search_term: ioc
			};

			const tfRes = await fetch('https://threatfox-api.abuse.ch/api/v1/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(threatFoxRequest)
			});

			const data = await tfRes.json() as any;

			if (data.query_status === 'ok' && data.data) {
				const tags = new Set<string>();
				let malwarePrintable = '';
				
				for (const item of data.data) {
					if (item.tags) {
						for (const t of item.tags) {
							tags.add(t);
						}
					}
					if (item.threat_type) {
						tags.add(item.threat_type);
					}
					if (item.malware_printable) {
						malwarePrintable = item.malware_printable;
					}
				}
				
				return new Response(JSON.stringify({
					success: true,
					tags: Array.from(tags),
					malware: malwarePrintable
				}), {
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			} else {
				return new Response(JSON.stringify({
					success: true,
					tags: [],
					malware: null
				}), {
					headers: {
						'Content-Type': 'application/json',
						...corsHeaders
					}
				});
			}
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { 
				status: 500, 
				headers: { 'Content-Type': 'application/json', ...corsHeaders } 
			});
		}
	},
};
