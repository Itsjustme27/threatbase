export interface Env {
	THREATFOX_API_KEY?: string;
	OTX_API_KEY?: string;
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
		const type = url.searchParams.get('type') || 'IPv4'; // e.g., IPv4, domain, URL, file
		
		if (!ioc) {
			return new Response(JSON.stringify({ error: 'Missing IOC parameter' }), { 
				status: 400, 
				headers: { 'Content-Type': 'application/json', ...corsHeaders } 
			});
		}

		try {
			const tags = new Set<string>();
			let malwarePrintable = '';
			const errors: string[] = [];

			// 1. Prepare ThreatFox Request
			const threatFoxRequest = {
				query: 'search_ioc',
				search_term: ioc
			};
			const tfHeaders: Record<string, string> = { 
				'Content-Type': 'application/json',
				'User-Agent': 'Threatbase/1.0'
			};
			if (env.THREATFOX_API_KEY) {
				tfHeaders['Auth-Key'] = env.THREATFOX_API_KEY;
			}
			const tfPromise = fetch('https://threatfox-api.abuse.ch/api/v1/', {
				method: 'POST',
				headers: tfHeaders,
				body: JSON.stringify(threatFoxRequest)
			}).then(async res => {
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				return res.json();
			});

			// 2. Prepare AlienVault OTX Request
			const otxHeaders: Record<string, string> = {
				'User-Agent': 'Threatbase/1.0'
			};
			if (env.OTX_API_KEY) {
				otxHeaders['X-OTX-API-KEY'] = env.OTX_API_KEY;
			}
			
			// Map general type string to AlienVault expected types
			let otxType = type;
			if (type === 'hash' || type === 'file') otxType = 'file';
			else if (type === 'URL') otxType = 'url';
			
			const otxPromise = fetch(`https://otx.alienvault.com/api/v1/indicators/${otxType}/${encodeURIComponent(ioc)}/general`, {
				headers: otxHeaders
			}).then(async res => {
				if (!res.ok) {
					if (res.status === 404) return { pulse_info: { pulses: [] } }; // OTX returns 404 if not found
					throw new Error(`HTTP ${res.status}`);
				}
				return res.json();
			});

			// Execute concurrently
			const [tfResult, otxResult] = await Promise.allSettled([tfPromise, otxPromise]);

			// Process ThreatFox Data
			if (tfResult.status === 'fulfilled') {
				const data = tfResult.value as any;
				if (data.query_status === 'ok' && data.data) {
					for (const item of data.data) {
						if (item.tags) item.tags.forEach((t: string) => tags.add(t));
						if (item.threat_type) tags.add(item.threat_type);
						if (item.malware_printable && !malwarePrintable) {
							malwarePrintable = item.malware_printable;
						}
					}
				}
			} else {
				errors.push(`ThreatFox: ${tfResult.reason}`);
			}

			// Process AlienVault OTX Data
			if (otxResult.status === 'fulfilled') {
				const data = otxResult.value as any;
				if (data.pulse_info && data.pulse_info.pulses) {
					for (const pulse of data.pulse_info.pulses) {
						if (pulse.tags) pulse.tags.forEach((t: string) => tags.add(t));
					}
				}
			} else {
				errors.push(`OTX: ${otxResult.reason}`);
			}

			return new Response(JSON.stringify({
				success: true,
				tags: Array.from(tags),
				malware: malwarePrintable || null,
				errors: errors.length > 0 ? errors : undefined
			}), {
				headers: {
					'Content-Type': 'application/json',
					...corsHeaders
				}
			});
		} catch (e: any) {
			return new Response(JSON.stringify({ error: e.message }), { 
				status: 500, 
				headers: { 'Content-Type': 'application/json', ...corsHeaders } 
			});
		}
	},
};
