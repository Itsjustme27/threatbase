import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3-geo'
import * as topojson from 'topojson-client'
import { getBaseUrl, fmt, timeAgo } from '../utils'
import { COUNTRY_COORDS, TARGET_HUBS } from '../lib/countryCoords'

// Fallback origins used until real geo data loads (or if it fails).
const CITIES = [
  { name: "New York", coords: [-74.006, 40.7128] },
  { name: "London", coords: [-0.1276, 51.5074] },
  { name: "Tokyo", coords: [139.6917, 35.6895] },
  { name: "Moscow", coords: [37.6173, 55.7558] },
  { name: "Beijing", coords: [116.4074, 39.9042] },
  { name: "Sydney", coords: [151.2093, -33.8688] },
  { name: "São Paulo", coords: [-46.6333, -23.5505] },
  { name: "Johannesburg", coords: [28.0473, -26.2041] },
  { name: "San Francisco", coords: [-122.4194, 37.7749] },
  { name: "Singapore", coords: [103.8198, 1.3521] },
  { name: "Frankfurt", coords: [8.6821, 50.1109] },
  { name: "Dubai", coords: [55.2708, 25.2048] }
]

// Category → accent colour for the ticker dot.
const CATEGORY_COLOR: Record<string, string> = {
  C2: '#ef4444', Botnet: '#f97316', 'Brute-Force': '#f59e0b', Malware: '#ec4899',
  Exploit: '#d946ef', Compromised: '#fb7185', Spam: '#10b981', Tor: '#8b5cf6',
  Scanner: '#84cc16', Malicious: '#38bdf8', Mixed: '#94a3b8',
}

// Category → severity tier (drives the live-feed row accent + label),
// modelled on how FortiGuard / Check Point rank threat classes.
const SEVERITY: Record<string, { label: string; color: string }> = {
  C2: { label: 'CRIT', color: '#ef4444' },
  Exploit: { label: 'CRIT', color: '#ef4444' },
  Malware: { label: 'HIGH', color: '#f97316' },
  Botnet: { label: 'HIGH', color: '#f97316' },
  'Brute-Force': { label: 'HIGH', color: '#f97316' },
  Compromised: { label: 'MED', color: '#f59e0b' },
  Spam: { label: 'MED', color: '#f59e0b' },
  Malicious: { label: 'MED', color: '#f59e0b' },
  Tor: { label: 'LOW', color: '#8b5cf6' },
  Scanner: { label: 'LOW', color: '#84cc16' },
  Mixed: { label: 'INFO', color: '#94a3b8' },
}
function sevFor(cat: string) {
  return SEVERITY[cat] ?? { label: 'INFO', color: '#94a3b8' }
}

// Build an SVG path string for the trend sparkline.
function sparkLine(vals: number[], w: number, h: number) {
  if (vals.length < 2) return ''
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const step = w / (vals.length - 1)
  return vals
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)} ${(h - ((v - min) / span) * h).toFixed(1)}`)
    .join(' ')
}

// Real country flag (flagcdn.com); hides itself if the code has no flag.
function Flag({ cc }: { cc: string }) {
  const code = cc.toLowerCase()
  return (
    <img
      src={`https://flagcdn.com/24x18/${code}.png`}
      srcSet={`https://flagcdn.com/48x36/${code}.png 2x`}
      width={16}
      height={12}
      loading="lazy"
      decoding="async"
      alt=""
      aria-hidden="true"
      className="h-3 w-4 shrink-0 rounded-[2px] object-cover ring-1 ring-white/15"
      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
    />
  )
}

interface Attack {
  id: number
  source: { x: number, y: number }
  target: { x: number, y: number }
  progress: number
  speed: number
  color: string
}

interface Explosion {
  x: number
  y: number
  progress: number
  color: string
}

// Weighted picker built from real counts (geo countries or categories).
interface Weighted<T> {
  items: T[]
  cumulative: number[]
  total: number
}

interface TickerEntry { id: number; src: string; tgt: string; cat: string; ts: number }

function pickWeighted<T>(w: Weighted<T> | null): T | null {
  if (!w || w.total <= 0) return null
  const r = Math.random() * w.total
  let lo = 0, hi = w.cumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (w.cumulative[mid] < r) lo = mid + 1
    else hi = mid
  }
  return w.items[lo]
}

export default function ThreatMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Weighted pickers, read live by the animation loop.
  const geoRef = useRef<Weighted<{ coords: [number, number]; cc: string }> | null>(null)
  const catRef = useRef<Weighted<string> | null>(null)
  const [ticker, setTicker] = useState<TickerEntry[]>([])
  const [totalSeen, setTotalSeen] = useState(0)
  // Ticking clock so relative timestamps ("now", "5s") stay fresh.
  const [now, setNow] = useState(() => Date.now())
  // Real CTI stats for the "Last 24h" analytics strip.
  const [stats, setStats] = useState<{ total: number; cats: Record<string, number>; feeds: number; updated: string } | null>(null)
  const [trend, setTrend] = useState<{ delta: number; pct: number; spark: number[] } | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // Fetch real attacker geolocation + category mix to drive the map.
  useEffect(() => {
    let cancelled = false

    fetch(getBaseUrl() + 'geo.json?_=' + Date.now())
      .then(r => r.json())
      .then((geo: { countries?: Record<string, number> }) => {
        if (cancelled || !geo?.countries) return
        const items: { coords: [number, number]; cc: string }[] = []
        const cumulative: number[] = []
        let total = 0
        for (const [cc, count] of Object.entries(geo.countries) as [string, number][]) {
          const place = COUNTRY_COORDS[cc]
          if (!place || count <= 0) continue
          total += count
          items.push({ coords: place.coords, cc })
          cumulative.push(total)
        }
        if (items.length > 0) geoRef.current = { items, cumulative, total }
      })
      .catch(() => { /* keep CITIES fallback */ })

    fetch(getBaseUrl() + 'stats.json?_=' + Date.now())
      .then(r => r.json())
      .then((data: { category_counts?: Record<string, number>; total_unique_ips?: number; active_feeds?: number; last_updated?: string }) => {
        if (cancelled || !data?.category_counts) return
        const items: string[] = []
        const cumulative: number[] = []
        let total = 0
        for (const [cat, count] of Object.entries(data.category_counts) as [string, number][]) {
          if (count <= 0) continue
          total += count
          items.push(cat)
          cumulative.push(total)
        }
        if (items.length > 0) catRef.current = { items, cumulative, total }
        setStats({
          total: data.total_unique_ips ?? total,
          cats: data.category_counts,
          feeds: data.active_feeds ?? 0,
          updated: data.last_updated ?? '',
        })
      })
      .catch(() => { /* ticker shows a generic category */ })

    // Daily history → real "last 24h" delta + 14-day trend sparkline.
    fetch(getBaseUrl() + 'history.json?_=' + Date.now())
      .then(r => r.json())
      .then((hist: Array<{ total_unique_ips?: number }>) => {
        if (cancelled || !Array.isArray(hist)) return
        const totals = hist.map(h => h.total_unique_ips ?? 0).filter(n => n > 0)
        if (totals.length < 2) return
        const today = totals[totals.length - 1]
        const prev = totals[totals.length - 2]
        const delta = today - prev
        const pct = prev > 0 ? (delta / prev) * 100 : 0
        setTrend({ delta, pct, spark: totals.slice(-14) })
      })
      .catch(() => { /* no trend strip */ })

    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    let animationFrameId: number
    let attacks: Attack[] = []
    let explosions: Explosion[] = []
    let width = 0
    let height = 0
    let tickerId = 0

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = width
      canvas.height = height
    }

    window.addEventListener('resize', resize)
    resize()

    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then(world => {
        const land = topojson.feature(world, world.objects.countries) as any
        const borders = topojson.mesh(world, world.objects.countries)

        const projection = d3.geoEquirectangular()
          .fitSize([width, height * 1.4], land)
          .translate([width / 2, height / 2 + 130])

        // Cache the Radware-style base map (teal ocean + graticule grid +
        // filled countries + cyan borders) to an offscreen canvas.
        const baseCanvas = document.createElement('canvas')
        baseCanvas.width = width
        baseCanvas.height = height
        const baseCtx = baseCanvas.getContext('2d')
        if (!baseCtx) return

        const path = d3.geoPath().projection(projection).context(baseCtx)

        // Ocean — subtle dark-teal vertical wash.
        const ocean = baseCtx.createLinearGradient(0, 0, 0, height)
        ocean.addColorStop(0, '#06121b')
        ocean.addColorStop(1, '#070d14')
        baseCtx.fillStyle = ocean
        baseCtx.fillRect(0, 0, width, height)

        // Graticule grid (faint cyan).
        baseCtx.beginPath()
        path(d3.geoGraticule().step([15, 15])() as any)
        baseCtx.lineWidth = 0.5
        baseCtx.strokeStyle = 'rgba(34, 211, 238, 0.07)'
        baseCtx.stroke()

        // Filled landmasses (dim teal-slate).
        baseCtx.beginPath()
        path(land)
        baseCtx.fillStyle = 'rgba(45, 78, 99, 0.34)'
        baseCtx.fill()

        // Country borders (thin cyan).
        baseCtx.beginPath()
        path(borders as any)
        baseCtx.lineWidth = 0.6
        baseCtx.strokeStyle = 'rgba(34, 211, 238, 0.30)'
        baseCtx.stroke()

        // Red attack arcs — Radware structure, ThreatBase brand accent.
        const colors = ['#ef4444', '#f87171', '#fb7185', '#dc2626']

        const spawnAttack = () => {
          const geoPick = pickWeighted(geoRef.current)
          let srcCoords: [number, number]
          let srcCC: string | null = null

          if (geoPick) {
            srcCoords = geoPick.coords
            srcCC = geoPick.cc
          } else {
            srcCoords = CITIES[Math.floor(Math.random() * CITIES.length)].coords as [number, number]
          }

          // Target a victim hub (real) or a random different city (fallback).
          let tgtCoords: [number, number]
          let tgtCC: string | null = null
          if (geoPick) {
            const hub = TARGET_HUBS[Math.floor(Math.random() * TARGET_HUBS.length)]
            tgtCoords = hub.coords
            tgtCC = hub.cc
          } else {
            let t = CITIES[Math.floor(Math.random() * CITIES.length)]
            while (t.coords[0] === srcCoords[0] && t.coords[1] === srcCoords[1]) {
              t = CITIES[Math.floor(Math.random() * CITIES.length)]
            }
            tgtCoords = t.coords as [number, number]
          }

          const srcProj = projection(srcCoords)
          const tgtProj = projection(tgtCoords)
          if (!srcProj || !tgtProj) return
          if (Math.abs(srcProj[0] - tgtProj[0]) < 1 && Math.abs(srcProj[1] - tgtProj[1]) < 1) return

          attacks.push({
            id: Math.random(),
            source: { x: srcProj[0], y: srcProj[1] },
            target: { x: tgtProj[0], y: tgtProj[1] },
            progress: 0,
            speed: 0.003 + Math.random() * 0.004,
            color: colors[Math.floor(Math.random() * colors.length)]
          })

          // Feed the live ticker only with real, attributable attacks.
          if (srcCC && tgtCC && srcCC !== tgtCC) {
            const cat = pickWeighted(catRef.current) ?? 'Malicious'
            tickerId += 1
            const entry: TickerEntry = { id: tickerId, src: srcCC, tgt: tgtCC, cat, ts: Date.now() }
            setTicker(prev => [entry, ...prev].slice(0, 7))
            setTotalSeen(n => n + 1)
          }
        }

        for (let i = 0; i < 5; i++) spawnAttack()

        const render = () => {
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(baseCanvas, 0, 0)

          if (Math.random() < 0.03 && attacks.length < 15) {
            spawnAttack()
          }

          ctx.globalCompositeOperation = 'screen'

          for (let i = attacks.length - 1; i >= 0; i--) {
            const a = attacks[i]
            a.progress += a.speed

            if (a.progress >= 1) {
              explosions.push({ x: a.target.x, y: a.target.y, progress: 0, color: a.color })
              attacks.splice(i, 1)
              continue
            }

            const midX = (a.source.x + a.target.x) / 2
            const midY = (a.source.y + a.target.y) / 2
            const dist = Math.sqrt(Math.pow(a.target.x - a.source.x, 2) + Math.pow(a.target.y - a.source.y, 2))
            const cpY = midY - dist * 0.3

            const tailLength = 0.15
            const segments = 20

            for (let j = 0; j < segments; j++) {
              const pointT = a.progress - (tailLength * (j / segments))
              if (pointT < 0) continue

              const invT = 1 - pointT
              const px = invT * invT * a.source.x + 2 * invT * pointT * midX + pointT * pointT * a.target.x
              const py = invT * invT * a.source.y + 2 * invT * pointT * cpY + pointT * pointT * a.target.y

              const opacity = 1 - (j / segments)
              const radius = 2.5 * opacity

              ctx.beginPath()
              ctx.arc(px, py, radius, 0, Math.PI * 2)
              ctx.fillStyle = `rgba(${hexToRgb(a.color)}, ${opacity})`

              if (j === 0) {
                ctx.shadowBlur = 15
                ctx.shadowColor = a.color
              } else {
                ctx.shadowBlur = 0
              }

              ctx.fill()
              ctx.shadowBlur = 0
            }
          }

          for (let i = explosions.length - 1; i >= 0; i--) {
            const e = explosions[i]
            e.progress += 0.025

            if (e.progress >= 1) {
              explosions.splice(i, 1)
              continue
            }

            const radius = e.progress * 25
            const opacity = 1 - Math.pow(e.progress, 1.5)

            ctx.beginPath()
            ctx.arc(e.x, e.y, radius, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${hexToRgb(e.color)}, ${opacity})`
            ctx.lineWidth = 1.5
            ctx.shadowBlur = 12
            ctx.shadowColor = e.color
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(e.x, e.y, radius * 0.4, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${hexToRgb(e.color)}, ${opacity * 0.6})`
            ctx.fill()

            ctx.shadowBlur = 0
          }

          ctx.globalCompositeOperation = 'source-over'
          animationFrameId = requestAnimationFrame(render)
        }

        render()
      })
      .catch(err => {
        console.error('Failed to load map data:', err)
      })

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  // Attack-type breakdown (real category counts), sorted desc.
  const breakdown = stats
    ? (() => {
      const entries = Object.entries(stats.cats)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
      const sum = entries.reduce((s, [, n]) => s + n, 0) || 1
      return { entries, sum }
    })()
    : null

  // Sparkline geometry for the trend chart.
  const SW = 104, SH = 30
  const sparkD = trend ? sparkLine(trend.spark, SW, SH) : ''
  const sparkLastY = trend && trend.spark.length > 1
    ? (() => {
      const v = trend.spark
      const min = Math.min(...v), max = Math.max(...v)
      const span = max - min || 1
      return SH - ((v[v.length - 1] - min) / span) * SH
    })()
    : 0

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0 w-full h-full bg-app"
      />

      {/* Live CTI HUD — FortiGuard-style threat feed + 24h analytics, bottom-right of the hero */}
      {(stats || ticker.length > 0) && (
        <div className="hidden lg:flex flex-col absolute bottom-6 right-6 z-10 w-[24rem] h-[400px] overflow-hidden rounded-2xl bg-transparent pointer-events-none">

          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-100">
              Live Threat Intel
            </span>
            {stats && (
              <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-slate-500">
                <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                {stats.feeds} FEEDS
              </span>
            )}
          </div>

          {/* Last-24h analytics strip */}
          {stats && (
            <div className="border-b border-white/[0.07] px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[26px] font-bold leading-none tracking-tight text-white tabular-nums">
                    {fmt(stats.total)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active Threats</span>
                    {trend && (
                      <span className="flex items-center gap-0.5 font-mono text-[10px] font-semibold tabular-nums text-red-400">
                        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5 stroke-current" fill="none" strokeWidth="1.7" aria-hidden="true">
                          <path d="M5 8V2.2M2.2 5 5 2.2 7.8 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {fmt(trend.delta)}
                        <span className="ml-0.5 text-slate-600">·24h</span>
                      </span>
                    )}
                  </div>
                </div>
                {trend && sparkD && (
                  <div className="flex flex-col items-end">
                    <svg viewBox={`0 0 ${SW} ${SH}`} className="h-[30px] w-[104px] overflow-visible" aria-hidden="true">
                      <defs>
                        <linearGradient id="tb-spark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={`${sparkD} L${SW} ${SH} L0 ${SH} Z`} fill="url(#tb-spark)" />
                      <path d={sparkD} fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={SW} cy={sparkLastY} r="2" fill="#fca5a5" />
                    </svg>
                    <span className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.14em] text-slate-600">14-day trend</span>
                  </div>
                )}
              </div>

              {/* Attack-type breakdown bar + legend */}
              {breakdown && (
                <>
                  <div className="mt-3 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-white/5">
                    {breakdown.entries.map(([cat, n]) => (
                      <span
                        key={cat}
                        title={`${cat} · ${((n / breakdown.sum) * 100).toFixed(1)}%`}
                        style={{ width: `${(n / breakdown.sum) * 100}%`, backgroundColor: CATEGORY_COLOR[cat] ?? '#94a3b8' }}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {breakdown.entries.slice(0, 3).map(([cat, n]) => (
                      <span key={cat} className="flex items-center gap-1.5 text-[9px] font-medium text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLOR[cat] ?? '#94a3b8' }} />
                        {cat}
                        <span className="tabular-nums text-slate-500">{((n / breakdown.sum) * 100).toFixed(0)}%</span>
                      </span>
                    ))}
                    {breakdown.entries.length > 3 && (
                      <span className="text-[9px] font-medium text-slate-600">+{breakdown.entries.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Live feed sub-header */}
          <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">Live Feed</span>
            {stats?.updated && (
              <span className="font-mono text-[9px] tabular-nums text-slate-600">{timeAgo(stats.updated)}</span>
            )}
          </div>

          {/* Feed: fixed height, older rows fade out at the bottom */}
          <div className="relative flex-1 overflow-hidden">
            <div className="flex flex-col px-1.5">
              {ticker.length === 0 && (
                <div className="px-2 py-2 text-[11px] text-slate-600">Listening for live threats…</div>
              )}
              {ticker.map((t) => {
                const c = CATEGORY_COLOR[t.cat] ?? '#94a3b8'
                const s = sevFor(t.cat)
                return (
                  <div key={t.id} className="ticker-in flex items-center gap-2 rounded-lg px-2 py-[5px]">
                    <span className="h-3.5 w-0.5 shrink-0 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}cc` }} />
                    <Flag cc={t.src} />
                    <span className="w-5 font-mono text-[12px] font-medium tabular-nums text-slate-100">{t.src}</span>
                    <svg viewBox="0 0 16 8" className="h-2 w-3.5 shrink-0 stroke-slate-600" fill="none" strokeWidth="1.4" aria-hidden="true">
                      <path d="M1 4h12M10 1.5 13.5 4 10 6.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <Flag cc={t.tgt} />
                    <span className="w-5 font-mono text-[12px] font-medium tabular-nums text-slate-400">{t.tgt}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span
                        className="rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em]"
                        style={{ color: c, backgroundColor: `${c}1f` }}
                      >
                        {t.cat}
                      </span>
                      <span className="flex w-9 items-center gap-1">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-[8.5px] font-semibold tracking-wide" style={{ color: s.color }}>{s.label}</span>
                      </span>
                      <span className="w-6 text-right font-mono text-[10px] tabular-nums text-slate-600">
                        {relTime(t.ts, now)}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Bottom fade mask */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/60 via-slate-950/20 to-transparent" />
          </div>
        </div>
      )}

    </>
  )
}

// Compact relative time for the live feed: "now" → "5s" → "3m".
function relTime(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 1) return 'now'
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m`
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ?
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}
