import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Activity, Database, Radio, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { getBaseUrl, fmt } from '../utils'

const GITHUB_RAW = 'https://raw.githubusercontent.com/kalidada18/threatbase/main/ioc/'

type Series = number[]

type MetricDef = {
  key: string
  label: string
  tag: string
  statKey: string
  img: string
  invert?: boolean
  sub: string
  /** rgb triple used for accents, sparkline + glow */
  rgb: string
  iconWrap: string
}

const METRICS: MetricDef[] = [
  {
    key: 'ip', label: 'Malicious IPs', tag: 'IPv4', statKey: 'total_unique_ips',
    img: 'ipv4icon.png', invert: true, sub: 'Active IPv4 addresses',
    rgb: '239,68,68', iconWrap: 'bg-red-950/40 border-destructive/20 group-hover:border-destructive/50',
  },
  {
    key: 'domain', label: 'Domains', tag: 'Domain', statKey: 'total_unique_domains',
    img: 'domain.png', sub: 'Known malicious domains',
    rgb: '99,102,241', iconWrap: 'bg-indigo-950/40 border-indigo-500/20 group-hover:border-indigo-500/50',
  },
  {
    key: 'hash', label: 'File Hashes', tag: 'File Hash', statKey: 'total_unique_hashes',
    img: 'file.png', sub: 'Malware signatures',
    rgb: '59,130,246', iconWrap: 'bg-blue-950/40 border-blue-500/20 group-hover:border-blue-500/50',
  },
  {
    key: 'url', label: 'Malicious URLs', tag: 'URL', statKey: 'total_unique_urls',
    img: 'url.png', sub: 'Active phishing URLs',
    rgb: '244,63,94', iconWrap: 'bg-rose-950/40 border-rose-500/20 group-hover:border-rose-500/50',
  },
  {
    key: 'ipv6', label: 'IPv6 Addresses', tag: 'IPv6', statKey: 'total_unique_ipv6',
    img: 'ipv6.png', invert: true, sub: 'Active IPv6 threats',
    rgb: '14,165,233', iconWrap: 'bg-sky-950/40 border-sky-500/20 group-hover:border-sky-500/50',
  },
  {
    key: 'cidr', label: 'CIDR Blocks', tag: 'CIDR', statKey: 'total_unique_cidrs',
    img: 'cidrs.png', sub: 'Malicious subnets',
    rgb: '249,115,22', iconWrap: 'bg-orange-950/40 border-orange-500/20 group-hover:border-orange-500/50',
  },
]

/** Count up to a target, easing out. */
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
  const [history, setHistory] = useState<any[] | null>(null)

  useEffect(() => {
    if (!statsData) return
    let active = true
    const load = async () => {
      const urls = [`${getBaseUrl()}history.json?v=${Date.now()}`, `${GITHUB_RAW}history.json?v=${Date.now()}`]
      for (const url of urls) {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error('HTTP ' + res.status)
          const data = await res.json()
          if (active && Array.isArray(data) && data.length) { setHistory(data); return }
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

  // Aggregate headline number across every indicator type.
  const totalTracked = useMemo(() => {
    if (!statsData) return null
    return METRICS.reduce((sum, m) => sum + (statsData[m.statKey] || 0), 0)
  }, [statsData])

  const seriesFor = (statKey: string): Series =>
    history ? history.map((h) => Number(h?.[statKey] || 0)).filter((n) => !Number.isNaN(n)) : []

  return (
    <section className="relative py-12 md:py-20 overflow-hidden scroll-mt-24" id="stats">
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-12">

        {/* Section header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-5">
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
        </div>

        {/* Summary strip */}
        <SummaryStrip total={totalTracked} feeds={statsData?.active_feeds ?? null} />

        {/* Metric grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {METRICS.map((m, i) => (
            <StatCard
              key={m.key}
              metric={m}
              target={statsData ? (statsData[m.statKey] ?? 0) : null}
              series={seriesFor(m.statKey)}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function SummaryStrip({ total, feeds }: { total: number | null; feeds: number | null }) {
  const totalVal = useCountUp(total)
  return (
    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>
  )
}

function StatCard({ metric, target, series, index }: { metric: MetricDef; target: number | null; series: Series; index: number }) {
  const value = useCountUp(target)
  const ready = target != null

  // Day-over-day delta from the trailing two history points.
  const delta = series.length >= 2 ? series[series.length - 1] - series[series.length - 2] : null
  const pct = delta != null && series[series.length - 2] > 0
    ? (delta / series[series.length - 2]) * 100
    : null

  return (
    <motion.div
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.015] p-6 transition-all duration-500 hover:bg-white/[0.035] hover:border-white/10 hover:-translate-y-1 backdrop-blur-[40px]"
      style={{ ['--mc' as any]: metric.rgb }}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, ease: 'easeOut', delay: index * 0.06 }}
    >
      {/* Color wash + glow keyed to the metric */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(120% 80% at 100% 0%, rgba(${metric.rgb},0.10), transparent 60%)` }}
      />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ backgroundImage: `linear-gradient(90deg, transparent, rgba(${metric.rgb},0.6), transparent)` }} />

      {/* Header row */}
      <div className="flex items-start justify-between relative z-10">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase group-hover:text-slate-300 transition-colors">
            {metric.label}
          </span>
          <span className="w-fit text-[10px] font-bold tracking-wider uppercase text-slate-500 bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-0.5">
            {metric.tag}
          </span>
        </div>
        <div className={`p-3 rounded-2xl border transition-all duration-300 shadow-inner ${metric.iconWrap}`}>
          <img
            src={`${import.meta.env.BASE_URL}img/${metric.img}`}
            alt=""
            aria-hidden="true"
            className={`w-7 h-7 object-contain ${metric.invert ? 'invert opacity-80' : 'drop-shadow-sm'}`}
          />
        </div>
      </div>

      {/* Value + delta */}
      <div className="mt-6 flex items-end justify-between gap-3 relative z-10">
        <span className="block text-4xl lg:text-[2.75rem] font-black tracking-tighter text-white tabular-nums drop-shadow-md leading-none">
          {ready ? fmt(value) : <span className="text-slate-600">—</span>}
        </span>
        <DeltaPill delta={delta} pct={pct} rgb={metric.rgb} />
      </div>

      {/* Sparkline */}
      <div className="mt-5 relative z-10 h-10">
        <Sparkline series={series} rgb={metric.rgb} />
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center justify-between relative z-10">
        <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider group-hover:text-slate-400 transition-colors">
          {metric.sub}
        </span>
        <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
          {series.length > 1 ? `${series.length}-day trend` : 'vs. yesterday'}
        </span>
      </div>
    </motion.div>
  )
}

function DeltaPill({ delta, pct, rgb }: { delta: number | null; pct: number | null; rgb: string }) {
  if (delta == null) {
    return <span className="h-6 w-16 rounded-lg bg-white/[0.03] border border-white/[0.05] animate-pulse shrink-0" aria-hidden="true" />
  }
  const up = delta > 0
  const flat = delta === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  // For threat counts: growth = more threats (red), shrink = cleaner (green).
  const cls = flat
    ? 'bg-slate-500/10 border-slate-500/20 text-slate-400'
    : up
      ? 'bg-destructive/10 border-destructive/20 text-destructive'
      : 'bg-primary/10 border-primary/20 text-primary'
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border tabular-nums shadow-sm ${cls}`}
      title="Change vs. previous daily snapshot"
    >
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      {flat ? '0' : `${up ? '+' : ''}${fmt(delta)}`}
      {pct != null && !flat && (
        <span className="opacity-70 font-semibold">({pct > 0 ? '+' : ''}{pct.toFixed(1)}%)</span>
      )}
      <span className="sr-only">
        {up ? 'increased by' : flat ? 'no change' : 'decreased by'} {Math.abs(delta)} since the previous snapshot
      </span>
    </span>
  )
}

/** Compact inline SVG sparkline with gradient fill. */
function Sparkline({ series, rgb }: { series: Series; rgb: string }) {
  const W = 240
  const H = 40
  if (!series || series.length < 2) {
    return (
      <div className="h-full w-full flex items-end gap-0.5 opacity-30">
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} className="flex-1 bg-white/10 rounded-sm" style={{ height: `${20 + (i % 5) * 12}%` }} />
        ))}
      </div>
    )
  }
  const min = Math.min(...series)
  const max = Math.max(...series)
  const range = max - min || 1
  const stepX = W / (series.length - 1)
  const pts = series.map((v, i) => {
    const x = i * stepX
    const y = H - ((v - min) / range) * (H - 4) - 2
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const gid = `spark-${rgb.replace(/[^0-9]/g, '')}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`rgb(${rgb})`} stopOpacity="0.28" />
          <stop offset="100%" stopColor={`rgb(${rgb})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={`rgb(${rgb})`} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={`rgb(${rgb})`} />
    </svg>
  )
}
