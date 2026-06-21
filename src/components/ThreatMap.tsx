import React, { useEffect, useRef, useState, useCallback } from 'react'
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
  C2: '#cf1733', Botnet: '#f97316', 'Brute-Force': '#f59e0b', Malware: '#ec4899',
  Exploit: '#d946ef', Compromised: '#fb7185', Spam: '#10b981', Tor: '#8b5cf6',
  Scanner: '#84cc16', Malicious: '#38bdf8', Mixed: '#94a3b8',
}

// Category → severity tier
const SEVERITY: Record<string, { label: string; color: string }> = {
  C2: { label: 'CRIT', color: '#cf1733' },
  Exploit: { label: 'CRIT', color: '#cf1733' },
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
  sourceLonLat: [number, number]
  targetLonLat: [number, number]
  progress: number
  speed: number
  color: string
}

interface Explosion {
  lonLat: [number, number]
  progress: number
  color: string
}

// A whole-country flash triggered when an attack lands on it.
interface CountryHit {
  feature: any
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

/**
 * Interpolate along a great-circle arc on the globe surface.
 * Returns [lon, lat] at parameter t in [0, 1].
 */
function interpolateGreatArc(src: [number, number], tgt: [number, number], t: number): [number, number] {
  const interp = d3.geoInterpolate(src, tgt)
  return interp(t) as [number, number]
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

  // Globe rotation state — stored in refs for non-React render loop access
  const rotationRef = useRef<[number, number]>([30, -20]) // [lambda, phi] starting view
  const autoRotateRef = useRef(true)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<[number, number]>([0, 0])
  const rotStartRef = useRef<[number, number]>([0, 0])

  // Hover state — cursor position (canvas-local px) + currently highlighted country
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const hoveredFeatureRef = useRef<any>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

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

  // ─── Drag-to-rotate handlers (pointer events on the canvas) ───
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true
    autoRotateRef.current = false
    dragStartRef.current = [e.clientX, e.clientY]
    rotStartRef.current = [...rotationRef.current]
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Always track cursor position (canvas-local px) so the render loop can
    // hit-test which country sits under the pointer.
    const canvas = canvasRef.current
    if (canvas) {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }
    if (!isDraggingRef.current) return
    const dx = e.clientX - dragStartRef.current[0]
    const dy = e.clientY - dragStartRef.current[1]
    const sensitivity = 0.3
    rotationRef.current = [
      rotStartRef.current[0] + dx * sensitivity,
      Math.max(-60, Math.min(60, rotStartRef.current[1] - dy * sensitivity)),
    ]
  }, [])

  const onPointerUp = useCallback(() => {
    isDraggingRef.current = false
    // Resume auto-rotate after 3 seconds of no interaction
    setTimeout(() => {
      if (!isDraggingRef.current) autoRotateRef.current = true
    }, 3000)
  }, [])

  const onPointerLeave = useCallback(() => {
    // Clear hover so the highlight + tooltip disappear when the cursor leaves.
    mouseRef.current = null
    isDraggingRef.current = false
    setTimeout(() => {
      if (!isDraggingRef.current) autoRotateRef.current = true
    }, 3000)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let attacks: Attack[] = []
    let explosions: Explosion[] = []
    let countryHits: CountryHit[] = []
    let width = 0
    let height = 0
    let tickerId = 0

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = parent.clientWidth
      height = parent.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    window.addEventListener('resize', resize)
    resize()

    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then(world => {
        const land = topojson.feature(world, world.objects.countries) as any
        const countryFeatures = (land.features ?? []) as any[]
        const borders = topojson.mesh(world, world.objects.countries)
        const graticule = d3.geoGraticule().step([15, 15])()

        // Globe projection — orthographic for 3D sphere effect
        const globeRadius = Math.min(width, height) * 0.42
        // Horizontal placement of the globe centre (0.5 = dead centre). < 0.5 shifts it left.
        const globeCenterFactor = 0.38
        const projection = d3.geoOrthographic()
          .scale(globeRadius)
          .translate([width * globeCenterFactor, height / 2])
          .clipAngle(90) // Only show the front hemisphere
          .precision(0.5)

        const path = d3.geoPath().projection(projection)

        // Red attack arcs — Radware structure, ThreatBase brand accent.
        const colors = ['#cf1733', '#e2566c', '#f0768c', '#b3122b']

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

          attacks.push({
            id: Math.random(),
            sourceLonLat: srcCoords,
            targetLonLat: tgtCoords,
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
          // Auto-rotate slowly when not dragging
          if (autoRotateRef.current && !isDraggingRef.current) {
            rotationRef.current[0] += 0.08
          }

          // Update projection rotation
          projection.rotate([rotationRef.current[0], rotationRef.current[1]])

          ctx.clearRect(0, 0, width, height)

          // ── Globe atmosphere glow ──
          const cx = width / 2, cy = height / 2
          const atmosGrad = ctx.createRadialGradient(cx, cy, globeRadius * 0.92, cx, cy, globeRadius * 1.15)
          atmosGrad.addColorStop(0, 'rgba(207, 23, 51, 0)')
          atmosGrad.addColorStop(0.5, 'rgba(207, 23, 51, 0.05)')
          atmosGrad.addColorStop(1, 'rgba(207, 23, 51, 0)')
          ctx.fillStyle = atmosGrad
          ctx.fillRect(0, 0, width, height)

          // ── Globe body ──
          // Ocean sphere
          ctx.beginPath()
          ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
          const oceanGrad = ctx.createRadialGradient(cx - globeRadius * 0.3, cy - globeRadius * 0.3, 0, cx, cy, globeRadius)
          oceanGrad.addColorStop(0, '#0f1929')
          oceanGrad.addColorStop(0.6, '#0b1120')
          oceanGrad.addColorStop(1, '#070c17')
          ctx.fillStyle = oceanGrad
          ctx.fill()

          // Graticule grid on the globe
          ctx.beginPath()
          path.context(ctx)(graticule as any)
          ctx.lineWidth = 0.4
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)'
          ctx.stroke()

          // Filled landmasses
          ctx.beginPath()
          path.context(ctx)(land)
          ctx.fillStyle = 'rgba(71, 85, 105, 0.55)'
          ctx.fill()

          // Country borders
          ctx.beginPath()
          path.context(ctx)(borders as any)
          ctx.lineWidth = 0.5
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)'
          ctx.stroke()

          // ── Globe rim highlight (subtle 3D edge light) ──
          ctx.beginPath()
          ctx.arc(cx, cy, globeRadius, 0, Math.PI * 2)
          ctx.lineWidth = 1.5
          const rimGrad = ctx.createLinearGradient(cx - globeRadius, cy - globeRadius, cx + globeRadius, cy + globeRadius)
          rimGrad.addColorStop(0, 'rgba(148, 163, 184, 0.12)')
          rimGrad.addColorStop(0.5, 'rgba(148, 163, 184, 0.04)')
          rimGrad.addColorStop(1, 'rgba(148, 163, 184, 0.08)')
          ctx.strokeStyle = rimGrad
          ctx.stroke()

          // ── Hover highlight: find + accent the country under the cursor ──
          let hovered: any = null
          if (!isDraggingRef.current && mouseRef.current) {
            const mx = mouseRef.current.x, my = mouseRef.current.y
            const offX = mx - cx, offY = my - cy
            // Only hit-test inside the projected disc of the globe.
            if (offX * offX + offY * offY <= globeRadius * globeRadius) {
              const inv = projection.invert ? projection.invert([mx, my]) : null
              if (inv) {
                for (const f of countryFeatures) {
                  if (d3.geoContains(f, inv as [number, number])) { hovered = f; break }
                }
              }
            }
          }
          hoveredFeatureRef.current = hovered

          if (hovered) {
            ctx.beginPath()
            path.context(ctx)(hovered)
            ctx.fillStyle = 'rgba(207, 23, 51, 0.32)'
            ctx.fill()
            ctx.lineWidth = 1.2
            ctx.strokeStyle = 'rgba(226, 86, 108, 0.95)'
            ctx.shadowBlur = 8
            ctx.shadowColor = 'rgba(207, 23, 51, 0.6)'
            ctx.stroke()
            ctx.shadowBlur = 0

            const tip = tooltipRef.current
            if (tip && mouseRef.current) {
              const name = (hovered.properties && hovered.properties.name) || 'Unknown'
              if (tip.textContent !== name) tip.textContent = name
              tip.style.transform = `translate(${mouseRef.current.x + 14}px, ${mouseRef.current.y + 14}px)`
              tip.style.opacity = '1'
            }
          } else {
            const tip = tooltipRef.current
            if (tip) tip.style.opacity = '0'
          }

          // ── Country impact flashes: the whole hit country lights up, then fades ──
          for (let i = countryHits.length - 1; i >= 0; i--) {
            const h = countryHits[i]
            h.progress += 0.014
            if (h.progress >= 1) { countryHits.splice(i, 1); continue }
            // Fast ramp to full, then a slow ease-out fade.
            const intensity = h.progress < 0.12
              ? h.progress / 0.12
              : 1 - ((h.progress - 0.12) / 0.88)
            const opacity = Math.max(0, intensity)
            const rgb = hexToRgb(h.color)

            ctx.beginPath()
            path.context(ctx)(h.feature)
            ctx.fillStyle = `rgba(${rgb}, ${opacity * 0.45})`
            ctx.fill()
            ctx.lineWidth = 1.1
            ctx.strokeStyle = `rgba(${rgb}, ${opacity * 0.95})`
            ctx.shadowBlur = 12 * opacity
            ctx.shadowColor = h.color
            ctx.stroke()
            ctx.shadowBlur = 0
          }

          // ── Spawn new attacks ──
          if (Math.random() < 0.03 && attacks.length < 15) {
            spawnAttack()
          }

          // ── Render attack arcs (great-circle arcs on the globe) ──
          ctx.globalCompositeOperation = 'screen'

          for (let i = attacks.length - 1; i >= 0; i--) {
            const a = attacks[i]
            a.progress += a.speed

            if (a.progress >= 1) {
              explosions.push({ lonLat: a.targetLonLat, progress: 0, color: a.color })
              // Light up the whole country that was hit, then let it fade.
              const hitFeature = countryFeatures.find(f => d3.geoContains(f, a.targetLonLat))
              if (hitFeature) {
                const existing = countryHits.find(h => h.feature === hitFeature)
                if (existing) { existing.progress = 0; existing.color = a.color }
                else countryHits.push({ feature: hitFeature, progress: 0, color: a.color })
              }
              attacks.splice(i, 1)
              continue
            }

            const tailLength = 0.15
            const segments = 20

            for (let j = 0; j < segments; j++) {
              const pointT = a.progress - (tailLength * (j / segments))
              if (pointT < 0 || pointT > 1) continue

              // Get point along great-circle arc
              const arcPoint = interpolateGreatArc(a.sourceLonLat, a.targetLonLat, pointT)

              // Check if this point is on the visible side of the globe
              const dist = d3.geoDistance(arcPoint, [-rotationRef.current[0], -rotationRef.current[1]])
              if (dist > Math.PI / 2) continue // behind the globe

              const projected = projection(arcPoint)
              if (!projected) continue

              // Lift arcs off the surface for 3D effect
              const arcHeight = Math.sin(pointT * Math.PI) * 20
              const py = projected[1] - arcHeight

              const opacity = 1 - (j / segments)
              const radius = 2.5 * opacity

              ctx.beginPath()
              ctx.arc(projected[0], py, radius, 0, Math.PI * 2)
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

          // ── Explosions (impact flares on the globe surface) ──
          for (let i = explosions.length - 1; i >= 0; i--) {
            const e = explosions[i]
            e.progress += 0.025

            if (e.progress >= 1) {
              explosions.splice(i, 1)
              continue
            }

            // Check visibility
            const dist = d3.geoDistance(e.lonLat, [-rotationRef.current[0], -rotationRef.current[1]])
            if (dist > Math.PI / 2) continue

            const projected = projection(e.lonLat)
            if (!projected) continue

            const radius = e.progress * 22
            const opacity = 1 - Math.pow(e.progress, 1.5)

            ctx.beginPath()
            ctx.arc(projected[0], projected[1], radius, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${hexToRgb(e.color)}, ${opacity})`
            ctx.lineWidth = 1.5
            ctx.shadowBlur = 12
            ctx.shadowColor = e.color
            ctx.stroke()

            ctx.beginPath()
            ctx.arc(projected[0], projected[1], radius * 0.4, 0, Math.PI * 2)
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
        className="absolute inset-0 z-0 w-full h-full bg-transparent cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
      />

      {/* Hover tooltip — country name under the cursor (positioned imperatively) */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-20 hidden whitespace-nowrap rounded-md border border-red-500/30 bg-[#0a0e17]/90 px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide text-slate-100 shadow-lg backdrop-blur-sm transition-opacity duration-150 will-change-transform sm:block"
        style={{ opacity: 0 }}
      />

      {/* Live CTI HUD — premium cold-luxury threat console, bottom-right of the hero */}
      {(stats || ticker.length > 0) && (
        <div className="hidden lg:flex flex-col absolute bottom-6 right-6 z-10 w-[23rem] max-h-[400px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0a0e17]/75 backdrop-blur-2xl shadow-glass-lux pointer-events-none">
          {/* Platinum top hairline + faint ruby corner glow */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-platinum-300/25 to-transparent" />
          <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-red-500/10 blur-3xl" />

          {/* Header */}
          <div className="relative flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(207,23,51,0.9)]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-platinum-200">
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
            <div className="relative border-b border-white/[0.06] px-4 py-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[28px] font-bold leading-none tracking-tight text-white tabular-nums drop-shadow-[0_2px_10px_rgba(207,23,51,0.18)]">
                    {fmt(stats.total)}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[8.5px] font-semibold uppercase tracking-[0.2em] text-platinum-400">Active Threats</span>
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
                          <stop offset="0%" stopColor="#cf1733" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#cf1733" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={`${sparkD} L${SW} ${SH} L0 ${SH} Z`} fill="url(#tb-spark)" />
                      <path d={sparkD} fill="none" stroke="#e2566c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={SW} cy={sparkLastY} r="2.2" fill="#f0768c" />
                    </svg>
                    <span className="mt-1 text-[8px] font-medium uppercase tracking-[0.18em] text-slate-600">14-day trend</span>
                  </div>
                )}
              </div>

              {/* Attack-type breakdown bar + legend */}
              {breakdown && (
                <>
                  <div className="mt-3.5 flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-white/5 ring-1 ring-inset ring-white/[0.05]">
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
          <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.22em] text-platinum-400">Live Feed</span>
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
                        className="rounded-[5px] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.06em]"
                        style={{ color: c, backgroundColor: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}33` }}
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0a0e17]/85 via-[#0a0e17]/30 to-transparent" />
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
