import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity } from 'lucide-react'
import { getBaseUrl, fmt } from '../utils'

const GITHUB_RAW = 'https://raw.githubusercontent.com/kalidada18/threatbase/main/ioc/'

type Trend = { diff: number } | null

type MetricDef = {
  key: string
  label: string
  tag: string
  statKey: string
  img: string
  invert?: boolean
  sub: string
  accent: string      // icon container classes
  ring: string        // hover glow color
}

const METRICS: MetricDef[] = [
  {
    key: 'ip', label: 'Malicious IPs', tag: 'IPv4', statKey: 'total_unique_ips',
    img: 'ipv4icon.png', invert: true, sub: 'Active IPv4 addresses',
    accent: 'text-destructive bg-red-950/40 border-destructive/20 group-hover:border-destructive/50',
    ring: 'group-hover:shadow-[0_8px_50px_-12px_rgba(239,68,68,0.45)]',
  },
  {
    key: 'domain', label: 'Domains', tag: 'Domain', statKey: 'total_unique_domains',
    img: 'domain.png', sub: 'Known malicious domains',
    accent: 'text-indigo-300 bg-indigo-950/40 border-indigo-500/20 group-hover:border-indigo-500/50',
    ring: 'group-hover:shadow-[0_8px_50px_-12px_rgba(99,102,241,0.45)]',
  },
  {
    key: 'hash', label: 'File Hashes', tag: 'File Hash', statKey: 'total_unique_hashes',
    img: 'file.png', sub: 'Malware signatures',
    accent: 'text-blue-300 bg-blue-950/40 border-blue-500/20 group-hover:border-blue-500/50',
    ring: 'group-hover:shadow-[0_8px_50px_-12px_rgba(59,130,246,0.45)]',
  },
  {
    key: 'url', label: 'Malicious URLs', tag: 'URL', statKey: 'total_unique_urls',
    img: 'url.png', sub: 'Active phishing URLs',
    accent: 'text-rose-300 bg-rose-950/40 border-rose-500/20 group-hover:border-rose-500/50',
    ring: 'group-hover:shadow-[0_8px_50px_-12px_rgba(244,63,94,0.45)]',
  },
  {
    key: 'ipv6', label: 'IPv6 Addresses', tag: 'IPv6', statKey: 'total_unique_ipv6',
    img: 'ipv6.png', invert: true, sub: 'Active IPv6 threats',
    accent: 'text-sky-300 bg-sky-950/40 border-sky-500/20 group-hover:border-sky-500/50',
    ring: 'group-hover:shadow-[0_8px_50px_-12px_rgba(14,165,233,0.45)]',
  },
  {
    key: 'cidr', label: 'CIDR Blocks', tag: 'CIDR', statKey: 'total_unique_cidrs',
    img: 'cidrs.png', sub: 'Malicious subnets',
    accent: 'text-orange-300 bg-orange-950/40 border-orange-500/20 group-hover:border-orange-500/50',
    ring: 'group-hover:shadow-[0_8px_50px_-12px_rgba(249,115,22,0.45)]',
  },
]

/** Count up to a target, easing out, returning the live displayed value. */
function useCountUp(target: number | null, duration = 1600) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (target == null) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

export default function Stats({ statsData }: any) {
  const [trends, setTrends] = useState<Record<string, Trend>>({})

  useEffect(() => {
    if (!statsData) return
    let active = true

    const processHistory = (data: any) => {
      if (!active || !Array.isArray(data) || data.length < 2) return
      const today = data[data.length - 1]
      const yday = data[data.length - 2]
      const next: Record<string, Trend> = {}
      for (const m of METRICS) {
        const cur = today?.[m.statKey]
        const prev = yday?.[m.statKey]
        if (typeof cur === 'number' && typeof prev === 'number') {
          next[m.key] = { diff: cur - prev }
        }
      }
      setTrends(next)
    }

    const load = async () => {
      const urls = [`${getBaseUrl()}history.json?v=${Date.now()}`, `${GITHUB_RAW}history.json?v=${Date.now()}`]
      for (const url of urls) {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const data = await res.json()
          if (data?.length) { processHistory(data); return }
        } catch (e) {
          console.warn('Stats history fetch failed for', url, e)
        }
      }
    }

    load()
    return () => { active = false }
  }, [statsData])

  const lastUpdated = useMemo(() => {
    const ts = statsData?.last_updated
    if (!ts) return null
    try {
      return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    } catch { return null }
  }, [statsData])

  return (
    <section className="relative py-12 md:py-20 overflow-hidden scroll-mt-24" id="stats">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12">

        {/* Section header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live Intelligence
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
              Threat Database at a Glance
            </h2>
            <p className="mt-3 text-slate-400 text-base md:text-lg font-medium max-w-2xl leading-relaxed">
              Aggregated, de-duplicated indicators of compromise across {statsData?.active_feeds || 'dozens of'} intelligence
              feeds — refreshed continuously and ready for ingestion.
            </p>
          </div>
          {lastUpdated && (
            <div className="shrink-0 flex items-center gap-2 text-[11px] font-semibold text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3.5 py-2">
              <Activity size={13} className="text-emerald-400" />
              <span className="uppercase tracking-wider">Synced</span>
              <span className="text-slate-300 font-bold">{lastUpdated}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {METRICS.map((m, i) => (
            <StatCard
              key={m.key}
              metric={m}
              target={statsData ? (statsData[m.statKey] ?? 0) : null}
              trend={trends[m.key]}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatCard({ metric, target, trend, index }: { metric: MetricDef; target: number | null; trend: Trend; index: number }) {
  const value = useCountUp(target)
  const ready = target != null

  return (
    <motion.div
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.015] p-6 sm:p-7 transition-all duration-500 hover:bg-white/[0.035] hover:border-white/10 hover:-translate-y-1 backdrop-blur-[40px] ${metric.ring}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.06 }}
    >
      {/* Top accent line */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      {/* Corner glow */}
      <div className="absolute -top-20 -right-20 w-44 h-44 rounded-full bg-white/[0.04] blur-3xl group-hover:bg-white/[0.07] transition-colors duration-500 pointer-events-none" />

      {/* Header row: label + tag chip + icon */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase group-hover:text-slate-300 transition-colors">
            {metric.label}
          </span>
          <span className="w-fit text-[10px] font-bold tracking-wider uppercase text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-0.5">
            {metric.tag}
          </span>
        </div>
        <div className={`p-3 rounded-2xl border transition-all duration-300 shadow-inner ${metric.accent}`}>
          <img
            src={`${import.meta.env.BASE_URL}img/${metric.img}`}
            alt=""
            aria-hidden="true"
            className={`w-7 h-7 object-contain ${metric.invert ? 'invert opacity-80' : 'drop-shadow-sm'}`}
          />
        </div>
      </div>

      {/* Value */}
      <div className="mt-7 relative z-10">
        <span className="block text-4xl lg:text-5xl font-black tracking-tighter text-white tabular-nums drop-shadow-md leading-none">
          {ready ? fmt(value) : <span className="text-slate-600">—</span>}
        </span>
      </div>

      {/* Footer: sub label + trend */}
      <div className="mt-5 pt-4 border-t border-white/[0.05] flex items-center justify-between relative z-10">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider group-hover:text-slate-400 transition-colors">
          {metric.sub}
        </span>
        <TrendBadge trend={trend} />
      </div>
    </motion.div>
  )
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (!trend) {
    return <span className="h-5 w-12 rounded-md bg-white/[0.03] border border-white/[0.05] animate-pulse" aria-hidden="true" />
  }
  const { diff } = trend
  const up = diff > 0
  const flat = diff === 0
  const cls = flat
    ? 'bg-slate-500/10 border-slate-500/20 text-slate-400'
    : up
      ? 'bg-destructive/10 border-destructive/20 text-destructive'
      : 'bg-primary/10 border-primary/20 text-primary'
  const arrow = flat ? '—' : up ? '↑' : '↓'
  const text = flat ? '0' : `${up ? '+' : ''}${fmt(diff)}`
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border tabular-nums shadow-sm transition-colors ${cls}`}
      title="Change vs. previous daily snapshot"
    >
      <span aria-hidden="true">{arrow}</span> {text}
      <span className="sr-only">{up ? 'increased by' : flat ? 'no change' : 'decreased by'} {Math.abs(diff)} since yesterday</span>
    </span>
  )
}
