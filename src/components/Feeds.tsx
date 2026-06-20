import { Download } from 'lucide-react'
import { motion } from 'framer-motion'
import Section from './layout/Section'
import Container from './layout/Container'

const BASE = import.meta.env.BASE_URL

const CAT_RAW = 'https://raw.githubusercontent.com/kalidada18/threatbase/main/ioc/categories/'

// Display metadata for the per-category IP feeds (keyed by filename slug).
// Ordered by typical blocking priority. Only categories present in
// stats.json (ip_category_files) are rendered, so this can be a superset.
const CATEGORY_META: Record<string, { label: string; blurb: string; dot: string; ring: string }> = {
  c2:          { label: 'C2',          blurb: 'Command-and-control servers — block aggressively.', dot: 'bg-red-500',     ring: 'hover:border-red-500/40' },
  botnet:      { label: 'Botnet',      blurb: 'Known botnet members and infected hosts.',          dot: 'bg-orange-500',  ring: 'hover:border-orange-500/40' },
  malware:     { label: 'Malware',     blurb: 'Malware hosting and delivery infrastructure.',       dot: 'bg-amber-500',   ring: 'hover:border-amber-500/40' },
  exploit:     { label: 'Exploit',     blurb: 'Active exploitation and attack attempts.',           dot: 'bg-pink-500',    ring: 'hover:border-pink-500/40' },
  compromised: { label: 'Compromised', blurb: 'Hijacked or compromised legitimate hosts.',          dot: 'bg-rose-500',    ring: 'hover:border-rose-500/40' },
  bruteforce:  { label: 'Brute-Force', blurb: 'SSH/FTP/RDP brute-force sources.',                    dot: 'bg-yellow-500',  ring: 'hover:border-yellow-500/40' },
  scanner:     { label: 'Scanner',     blurb: 'Mass port and vulnerability scanners.',              dot: 'bg-lime-500',    ring: 'hover:border-lime-500/40' },
  spam:        { label: 'Spam',        blurb: 'Spam-source networks and relays.',                    dot: 'bg-emerald-500', ring: 'hover:border-emerald-500/40' },
  malicious:   { label: 'Malicious',   blurb: 'General high-confidence malicious IPs.',             dot: 'bg-sky-500',     ring: 'hover:border-sky-500/40' },
  tor:         { label: 'Tor',         blurb: 'Tor exit nodes — often alert-only.',                 dot: 'bg-violet-500',  ring: 'hover:border-violet-500/40' },
  mixed:       { label: 'Mixed',       blurb: 'Uncategorized malicious IPs.',                        dot: 'bg-slate-400',   ring: 'hover:border-slate-400/40' },
}
const CATEGORY_ORDER = ['c2', 'botnet', 'malware', 'exploit', 'compromised', 'bruteforce', 'scanner', 'spam', 'malicious', 'tor', 'mixed']

const slugFromFile = (file: string) => file.replace(/^threatbase-ip-/, '').replace(/\.txt$/, '')

const feeds = [
  {
    name: 'IPv4 Blocklist',
    desc: 'High-confidence malicious IPv4 addresses actively involved in cyber attacks, ready for firewall ingestion.',
    file: 'threatbase-ip.txt',
    icon: <img src={`${BASE}img/ipv4icon.png`} alt="IPv4" className="w-8 h-8 object-contain invert opacity-80" />,
    color: 'text-destructive bg-destructive/10 border-destructive/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]',
  },
  {
    name: 'Domain Blocklist',
    desc: 'Malicious, phishing, and C2 domains ready for immediate DNS sinkholing and blocking.',
    file: 'threatbase-domain.txt',
    icon: <img src={`${BASE}img/domain.png`} alt="Domain" className="w-8 h-8 object-contain drop-shadow-sm" />,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]',
  },
  {
    name: 'Hash Blocklist',
    desc: 'SHA-256 malware file signatures tailored for endpoint detection and AV scanners.',
    file: 'threatbase-hash.txt',
    icon: <img src={`${BASE}img/file.png`} alt="File" className="w-8 h-8 object-contain drop-shadow-sm" />,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
  },
  {
    name: 'URL Blocklist',
    desc: 'Verified malicious URLs optimized for web proxies, gateways, and content filtering.',
    file: 'threatbase-url.txt',
    icon: <img src={`${BASE}img/url.png`} alt="URL" className="w-8 h-8 object-contain drop-shadow-sm" />,
    color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
  },
  {
    name: 'IPv6 Blocklist',
    desc: 'High-confidence malicious IPv6 addresses for comprehensive, modern network defense.',
    file: 'threatbase-ipv6.txt',
    icon: <img src={`${BASE}img/ipv6.png`} alt="IPv6" className="w-8 h-8 object-contain invert opacity-80" />,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(14,165,233,0.15)]',
  },
  {
    name: 'CIDR Blocklist',
    desc: 'Aggregated malicious IPv4 and IPv6 subnets (CIDR notation) for broad-spectrum blocking.',
    file: 'threatbase-cidr.txt',
    icon: <img src={`${BASE}img/cidrs.png`} alt="CIDR" className="w-8 h-8 object-contain drop-shadow-sm" />,
    color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    glow: 'group-hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]',
  },
]

export default function Feeds({ statsData }: { statsData?: any }) {
  const getChunks = (filename: string) => {
    if (statsData && statsData.chunk_files && statsData.chunk_files[filename]) {
      return statsData.chunk_files[filename]
    }
    return [filename]
  }

  // Build the ordered list of category feeds from stats.json.
  const catFiles: Record<string, number> = statsData?.ip_category_files ?? {}
  const categoryFeeds = Object.entries(catFiles)
    .map(([file, count]) => ({ file, count: count as number, slug: slugFromFile(file) }))
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.slug)
      const ib = CATEGORY_ORDER.indexOf(b.slug)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })

  return (
    <Section id="feeds" container={false} className="overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent"></div>

      <Container width="wide" className="relative z-10">
        <div className="mb-16 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-5xl font-black flex items-center justify-center md:justify-start gap-4 text-white tracking-tight">
              Threat Intelligence Feeds
            </h2>
            <p className="mt-5 text-slate-400 text-lg font-medium leading-relaxed">
              Integrate these plain text indicators directly into your Firewalls, IDS/IPS, and SIEMs. Feeds are updated continuously as the community reports new threats.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {feeds.map((f, i) => {
            const chunks = getChunks(f.file)
            return (
              <motion.div
                className={`group flex flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-xl p-8 shadow-xl transition-all duration-500 hover:bg-slate-800/50 hover:border-white/10 hover:-translate-y-1.5 ${f.glow}`}
                key={f.file}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: "easeOut" }}
              >
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`p-3.5 rounded-2xl border transition-all duration-500 shadow-inner group-hover:scale-110 ${f.color}`}>
                      {f.icon}
                    </div>
                    <h3 className="text-xl font-bold text-white tracking-tight">{f.name}</h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium group-hover:text-slate-300 transition-colors">
                    {f.desc}
                  </p>
                </div>
                {chunks.length > 1 ? (
                  <div className="flex flex-col gap-2.5 w-full">
                    <span className="text-[11px] text-slate-400 text-center font-bold tracking-wider uppercase mb-1">
                      Split Feed ({chunks.length} Parts)
                    </span>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      {chunks.slice(0, 3).map((chunk, idx) => (
                        <a
                          key={chunk}
                          href={`https://raw.githubusercontent.com/kalidada18/threatbase/main/ioc/${chunk}`}
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all duration-300 border border-white/10 rounded-xl bg-white/5 text-white hover:bg-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm overflow-hidden relative group/chunk"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download size={12} className="transition-transform group-hover/chunk:-translate-y-0.5" />
                          <span>Part {idx + 1}</span>
                        </a>
                      ))}
                      {chunks.length > 3 && (
                        <a
                          href="https://github.com/kalidada18/threatbase/tree/main/ioc"
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-all duration-300 border border-white/10 rounded-xl bg-white/5 text-white hover:bg-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm overflow-hidden relative group/chunk"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <span>+{chunks.length - 3} More</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <a
                    href={`https://raw.githubusercontent.com/kalidada18/threatbase/main/ioc/${f.file}`}
                    className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 text-sm font-bold transition-all duration-300 border border-white/10 rounded-2xl bg-white/5 text-white hover:bg-white/10 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-sm overflow-hidden relative"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                    <Download size={16} className="transition-transform group-hover:-translate-y-0.5" /> 
                    <span>Download Feed</span>
                  </a>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Category-split IP feeds */}
        {categoryFeeds.length > 0 && (
          <div className="mt-20">
            <div className="mb-8 text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                Category-Split IP Feeds
              </h3>
              <p className="mt-3 text-slate-400 text-base font-medium leading-relaxed max-w-2xl mx-auto md:mx-0">
                Same malicious IPs, sliced by threat type — so you can hard-block C2 and botnets
                while only alerting on Tor. Each feed uses the <code className="text-slate-300">IP,FeedCount,RiskScore,Tags</code> format.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryFeeds.map((c, i) => {
                const meta = CATEGORY_META[c.slug] ?? {
                  label: c.slug, blurb: 'Categorized malicious IPs.', dot: 'bg-slate-400', ring: 'hover:border-slate-400/40',
                }
                return (
                  <motion.a
                    key={c.file}
                    href={`${CAT_RAW}${c.file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ delay: i * 0.04, duration: 0.4, ease: 'easeOut' }}
                    className={`group flex items-center justify-between gap-4 rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-xl px-5 py-4 transition-all duration-300 hover:bg-slate-800/50 hover:-translate-y-0.5 ${meta.ring}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} shadow-[0_0_8px] shadow-current`} />
                        <span className="font-bold text-white text-sm tracking-tight">{meta.label}</span>
                        <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                          {c.count.toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-400 leading-snug truncate group-hover:text-slate-300 transition-colors">
                        {meta.blurb}
                      </p>
                    </div>
                    <Download size={16} className="shrink-0 text-slate-500 group-hover:text-white transition-all group-hover:-translate-y-0.5" />
                  </motion.a>
                )
              })}
            </div>
          </div>
        )}
      </Container>
    </Section>
  )
}
