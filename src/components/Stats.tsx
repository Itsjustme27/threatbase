import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, Radio } from 'lucide-react'
import { fmt } from '../utils'

type MetricDef = {
  key: string
  label: string
  statKey: string
  img: string
  invert?: boolean
  sub: string
  /** rgb triple used for accent wash + glow */
  rgb: string
  iconWrap: string
}

const METRICS: MetricDef[] = [
  {
    key: 'ip', label: 'Malicious IPs', statKey: 'total_unique_ips',
    img: 'ipv4icon.png', invert: true, sub: 'Active IPv4 addresses',
    rgb: '239,68,68', iconWrap: 'bg-red-950/40 border-destructive/20 group-hover:border-destructive/50',
  },
  {
    key: 'domain', label: 'Domains', statKey: 'total_unique_domains',
    img: 'domain.png', sub: 'Known malicious domains',
    rgb: '99,102,241', iconWrap: 'bg-indigo-950/40 border-indigo-500/20 group-hover:border-indigo-500/50',
  },
  {
    key: 'hash', label: 'File Hashes', statKey: 'total_unique_hashes',
    img: 'file.png', sub: 'Malware signatures',
    rgb: '59,130,246', iconWrap: 'bg-blue-950/40 border-blue-500/20 group-hover:border-blue-500/50',
  },
  {
    key: 'url', label: 'Malicious URLs', statKey: 'total_unique_urls',
    img: 'url.png', sub: 'Active phishing URLs',
    rgb: '244,63,94', iconWrap: 'bg-rose-950/40 border-rose-500/20 group-hover:border-rose-500/50',
  },
  {
    key: 'ipv6', label: 'IPv6 Addresses', statKey: 'total_unique_ipv6',
    img: 'ipv6.png', invert: true, sub: 'Active IPv6 threats',
    rgb: '14,165,233', iconWrap: 'bg-sky-950/40 border-sky-500/20 group-hover:border-sky-500/50',
  },
  {
    key: 'cidr', label: 'CIDR Blocks', statKey: 'total_unique_cidrs',
    img: 'cidrs.png', sub: 'Malicious subnets',
    rgb: '249,115,22', iconWrap: 'bg-orange-950/40 border-orange-500/20 group-hover:border-orange-500/50',
  },
]

/** Count up to a target, easing out. */
function useCountUp(target: number | null, duration = 1700) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target == null) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 4)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function Stats({ statsData }: any) {
  const lastUpdated = useMemo(() => {
    const ts = statsData?.last_updated
    if (!ts) return null
    try {
      return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch { return null }
  }, [statsData])

  const totalTracked = useMemo(() => {
    if (!statsData) return null
    return METRICS.reduce((sum, m) => sum + (statsData[m.statKey] || 0), 0)
  }, [statsData])

  return (
    <section className="relative py-12 md:py-20 overflow-hidden scroll-mt-24" id="stats">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12">

        {/* Section header */}
        <motion.div
          className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-4">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live Intelligence
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              Threat Database at a Glance
            </h2>
            <p className="mt-3 text-slate-400 text-base md:text-lg font-medium max-w-2xl leading-relaxed">
              Aggregated, de-duplicated indicators of compromise — refreshed continuously and ready for ingestion.
            </p>
          </div>
          {lastUpdated && (
            <div className="shrink-0 flex items-center gap-2 text-[11px] font-semibold text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2">
              <Activity size={13} className="text-emerald-400" />
              <span className="uppercase tracking-wider">Synced</span>
              <span className="text-slate-300 font-bold">{lastUpdated}</span>
            </div>
          )}
        </motion.div>

        {/* Summary strip */}
        <SummaryStrip total={totalTracked} feeds={statsData?.active_feeds ?? null} />

        {/* Metric grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6"
          variants={gridVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
        >
          {METRICS.map((m) => (
            <StatCard
              key={m.key}
              metric={m}
              target={statsData ? (statsData[m.statKey] ?? 0) : null}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function SummaryStrip({ total, feeds }: { total: number | null; feeds: number | null }) {
  const totalVal = useCountUp(total)
  return (
    <motion.div
      className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
    >
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-transparent p-5 backdrop-blur-xl flex items-center gap-4">
        <div className="p-3 rounded-2xl border border-white/10 bg-white/[0.04] text-white shrink-0">
          <Database size={22} />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Total Indicators Tracked</div>
          <div className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tight mt-0.5">
            {total != null ? fmt(totalVal) : '—'}
          </div>
        </div>
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-5 backdrop-blur-xl flex items-center gap-4">
        <div className="p-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shrink-0">
          <Radio size={22} />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Active Intelligence Feeds</div>
          <div className="text-2xl md:text-3xl font-black text-white tabular-nums tracking-tight mt-0.5">
            {feeds != null ? fmt(feeds) : '—'}
          </div>
        </div>
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-500/[0.06] blur-3xl pointer-events-none" />
      </div>
    </motion.div>
  )
}

function StatCard({ metric, target }: { metric: MetricDef; target: number | null }) {
  const value = useCountUp(target)
  const ready = target != null

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-7 backdrop-blur-[40px]"
      style={{ ['--mc' as any]: metric.rgb }}
    >
      {/* Color wash keyed to the metric */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(130% 90% at 100% 0%, rgba(${metric.rgb},0.12), transparent 55%)` }}
      />
      {/* Top accent line on hover */}
      <div
        className="absolute top-0 inset-x-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ backgroundImage: `linear-gradient(90deg, transparent, rgba(${metric.rgb},0.7), transparent)` }}
      />
      {/* Corner glow */}
      <div
        className="absolute -top-20 -right-20 w-44 h-44 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `rgba(${metric.rgb},0.10)` }}
      />

      {/* Header row */}
      <div className="flex items-center justify-between relative z-10">
        <span className="text-xs font-bold text-slate-400 tracking-widest uppercase group-hover:text-slate-200 transition-colors">
          {metric.label}
        </span>
        <div className={`p-3 rounded-2xl border transition-all duration-300 shadow-inner group-hover:scale-105 ${metric.iconWrap}`}>
          <img
            src={`${import.meta.env.BASE_URL}img/${metric.img}`}
            alt=""
            aria-hidden="true"
            className={`w-7 h-7 object-contain ${metric.invert ? 'invert opacity-80' : 'drop-shadow-sm'}`}
          />
        </div>
      </div>

      {/* Value */}
      <div className="mt-8 relative z-10">
        <span className="block text-4xl lg:text-5xl font-black tracking-tighter text-white tabular-nums drop-shadow-md leading-none">
          {ready ? fmt(value) : <span className="text-slate-600">—</span>}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-white/[0.05] relative z-10">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider group-hover:text-slate-400 transition-colors">
          {metric.sub}
        </span>
      </div>
    </motion.div>
  )
}
