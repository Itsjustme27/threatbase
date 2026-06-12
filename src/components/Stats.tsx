import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Radar, Network, Fingerprint, Unlink, Layers } from 'lucide-react'
import { animateValue, getBaseUrl, fmt } from '../utils'

export default function Stats({ statsData }: any) {
  useEffect(() => {
    if (statsData) {
      animateValue(document.getElementById('n-total'), statsData.total_unique_ips)
      animateValue(document.getElementById('n-domains'), statsData.total_unique_domains || 0)
      animateValue(document.getElementById('n-hashes'), statsData.total_unique_hashes || 0)
      animateValue(document.getElementById('n-urls'), statsData.total_unique_urls || 0)
      animateValue(document.getElementById('n-ipv6'), statsData.total_unique_ipv6 || 0)
      animateValue(document.getElementById('n-cidrs'), statsData.total_unique_cidrs || 0)
      
      // Fetch history to show daily deltas
      const fetchHistory = async () => {
        try {
          const res = await fetch(`${getBaseUrl()}history.json?v=${Date.now()}`)
          const data = await res.json()
          if (data && data.length >= 2) {
            const today = data[data.length - 1]
            const yday = data[data.length - 2]
            
            const updateTrend = (id: string, cur: number, prev: number) => {
              const el = document.getElementById(id)
              if (!el || typeof cur !== 'number' || typeof prev !== 'number') return
              const diff = cur - prev
              if (diff > 0) {
                el.textContent = `↑ +${fmt(diff)}`
                el.className = 'font-semibold px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 shadow-sm group-hover:bg-red-500/20 transition-colors duration-200 text-xs'
              } else if (diff < 0) {
                el.textContent = `↓ ${fmt(diff)}`
                el.className = 'font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-sm group-hover:bg-emerald-500/20 transition-colors duration-200 text-xs'
              } else {
                el.textContent = '— 0'
                el.className = 'font-semibold px-2 py-0.5 rounded bg-slate-500/10 border border-slate-500/20 text-slate-400 shadow-sm group-hover:bg-slate-500/20 transition-colors duration-200 text-xs'
              }
            }
            
            updateTrend('trend-ips', today.total_unique_ips, yday.total_unique_ips)
            updateTrend('trend-domains', today.total_unique_domains, yday.total_unique_domains)
            updateTrend('trend-hashes', today.total_unique_hashes, yday.total_unique_hashes)
            updateTrend('trend-urls', today.total_unique_urls, yday.total_unique_urls)
            updateTrend('trend-ipv6', today.total_unique_ipv6 || 0, yday.total_unique_ipv6 || 0)
            updateTrend('trend-cidrs', today.total_unique_cidrs || 0, yday.total_unique_cidrs || 0)
          }
        } catch (e) {
          console.error("Failed to load history for trends", e)
        }
      }
      fetchHistory()
    }
  }, [statsData])

  return (
    <section className="relative py-12 md:py-20 overflow-hidden scroll-mt-24" id="stats">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            label="Malicious IPs"
            icon={<Radar size={20} />}
            iconColorClass="text-red-400 bg-red-950/30 border-red-500/20 group-hover:border-red-500/40"
            valueId="n-total"
            sub="Active IPv4 addresses"
            trendId="trend-ips"
          />
          <StatCard
            label="Domains"
            icon={<Network size={20} />}
            iconColorClass="text-indigo-400 bg-indigo-950/30 border-indigo-500/20 group-hover:border-indigo-500/40"
            valueId="n-domains"
            sub="Known malicious domains"
            trendId="trend-domains"
          />
          <StatCard
            label="File Hashes"
            icon={<Fingerprint size={20} />}
            iconColorClass="text-blue-400 bg-blue-950/30 border-blue-500/20 group-hover:border-blue-500/40"
            valueId="n-hashes"
            sub="SHA-256 signatures"
            trendId="trend-hashes"
          />
          <StatCard
            label="Malicious URLs"
            icon={<Unlink size={20} />}
            iconColorClass="text-rose-400 bg-rose-950/30 border-rose-500/20 group-hover:border-rose-500/40"
            valueId="n-urls"
            sub="Active phishing URLs"
            trendId="trend-urls"
          />
          <StatCard
            label="IPv6 Addresses"
            icon={<Network size={20} />}
            iconColorClass="text-sky-400 bg-sky-950/30 border-sky-500/20 group-hover:border-sky-500/40"
            valueId="n-ipv6"
            sub="Active IPv6 threats"
            trendId="trend-ipv6"
          />
          <StatCard
            label="CIDR Blocks"
            icon={<Layers size={20} />}
            iconColorClass="text-red-500 bg-red-950/30 border-red-500/20 group-hover:border-red-500/40"
            valueId="n-cidrs"
            sub="Malicious subnets"
            trendId="trend-cidrs"
          />
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, icon, iconColorClass, valueId, sub, trendId }: any) {
  return (
    <motion.div
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.01] p-6 sm:p-8 transition-all duration-500 hover:bg-white/[0.03] hover:border-white/10 hover:-translate-y-1 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-[40px] font-elegant"
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Subtle Aurora Glow per card */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors duration-500 pointer-events-none z-0" />
      
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase group-hover:text-slate-300 transition-colors duration-200">{label}</span>
        <div className={`p-3 rounded-2xl border transition-all duration-300 shadow-inner ${iconColorClass}`}>
          {icon}
        </div>
      </div>

      <div className="mt-8 text-4xl lg:text-5xl font-black tracking-tighter text-white tabular-nums relative z-10 drop-shadow-md" id={valueId}>-</div>

      <div className="mt-6 text-[11px] text-slate-500 flex items-center justify-between font-medium relative z-10 uppercase tracking-widest">
        <span className="group-hover:text-slate-400 transition-colors duration-200">{sub}</span>
        <span id={trendId} className="font-bold px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] text-slate-300 shadow-inner group-hover:bg-white/[0.05] transition-colors duration-200"></span>
      </div>
    </motion.div>
  )
}
