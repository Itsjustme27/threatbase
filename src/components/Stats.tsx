import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Radar, Network, Fingerprint, Unlink, Layers } from 'lucide-react'
import { animateValue } from '../utils'

export default function Stats({ statsData }: any) {
  useEffect(() => {
    if (statsData) {
      animateValue(document.getElementById('n-total'), statsData.total_unique_ips)
      animateValue(document.getElementById('n-domains'), statsData.total_unique_domains || 0)
      animateValue(document.getElementById('n-hashes'), statsData.total_unique_hashes || 0)
      animateValue(document.getElementById('n-urls'), statsData.total_unique_urls || 0)
      animateValue(document.getElementById('n-ipv6'), statsData.total_unique_ipv6 || 0)
      animateValue(document.getElementById('n-cidrs'), statsData.total_unique_cidrs || 0)
    }
  }, [statsData])

  return (
    <section className="py-12 md:py-20" id="stats">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            label="Malicious IPs"
            icon={<Radar size={20} />}
            iconClass="text-red-500 bg-red-500/10 group-hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
            valueId="n-total"
            sub="Active IPv4 addresses"
            trendId="trend-ips"
          />
          <StatCard
            label="Domains"
            icon={<Network size={20} />}
            iconClass="text-purple-500 bg-purple-500/10 group-hover:bg-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
            valueId="n-domains"
            sub="Known malicious domains"
            trendId="trend-domains"
          />
          <StatCard
            label="File Hashes"
            icon={<Fingerprint size={20} />}
            iconClass="text-amber-500 bg-amber-500/10 group-hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]"
            valueId="n-hashes"
            sub="SHA-256 signatures"
            trendId="trend-hashes"
          />
          <StatCard
            label="Malicious URLs"
            icon={<Unlink size={20} />}
            iconClass="text-blue-500 bg-blue-500/10 group-hover:bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]"
            valueId="n-urls"
            sub="Active phishing URLs"
            trendId="trend-urls"
          />
          <StatCard
            label="IPv6 Addresses"
            icon={<Network size={20} />}
            iconClass="text-teal-500 bg-teal-500/10 group-hover:bg-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.1)]"
            valueId="n-ipv6"
            sub="Active IPv6 threats"
            trendId="trend-ipv6"
          />
          <StatCard
            label="CIDR Blocks"
            icon={<Layers size={20} />}
            iconClass="text-orange-500 bg-orange-500/10 group-hover:bg-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.1)]"
            valueId="n-cidrs"
            sub="Malicious subnets"
            trendId="trend-cidrs"
          />
        </div>
      </div>
    </section>
  )
}

function StatCard({ label, icon, iconClass, valueId, sub, trendId }: any) {
  return (
    <motion.div 
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:bg-slate-900/60 hover:border-white/20 hover:-translate-y-1" 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      {/* Subtle top gradient glow effect on hover */}
      <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-400 tracking-wide">{label}</span>
        <div className={`p-2.5 rounded-xl transition-colors duration-300 ${iconClass}`}>{icon}</div>
      </div>
      <div className="mt-6 text-4xl font-extrabold tracking-tight text-white tabular-nums drop-shadow-sm" id={valueId}>-</div>
      <div className="mt-2 text-xs text-slate-400 flex items-center gap-2 font-medium">
        {sub} <span id={trendId} className="font-semibold px-2 py-0.5 rounded-full bg-slate-800/50"></span>
      </div>
    </motion.div>
  )
}
