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
			const tags = new Set<string>();
			let malwarePrintable = '';

			// 1. Prepare ThreatFox Request
			const threatFoxRequest = {
				query: 'search_ioc',
				search_term: ioc
			};
			const tfPromise = fetch('https://threatfox-api.abuse.ch/api/v1/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(threatFoxRequest)
			}).then(res => res.json());

			// 2. Prepare AlienVault OTX Request
			const otxPromise = fetch(`https://otx.alienvault.com/api/v1/indicators/IPv4/${ioc}/general`)
				.then(res => res.json());

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
			}

			// Process AlienVault OTX Data
			if (otxResult.status === 'fulfilled') {
				const data = otxResult.value as any;
				if (data.pulse_info && data.pulse_info.pulses) {
					for (const pulse of data.pulse_info.pulses) {
						if (pulse.tags) pulse.tags.forEach((t: string) => tags.add(t));
					}
				}
			}

			return new Response(JSON.stringify({
				success: true,
				tags: Array.from(tags),
				malware: malwarePrintable || null
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
