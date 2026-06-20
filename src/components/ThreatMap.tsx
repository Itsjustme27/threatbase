import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3-geo'
import * as topojson from 'topojson-client'
import { getBaseUrl } from '../utils'
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

interface TickerEntry { id: number; src: string; tgt: string; cat: string }

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
      .then((stats: { category_counts?: Record<string, number> }) => {
        if (cancelled || !stats?.category_counts) return
        const items: string[] = []
        const cumulative: number[] = []
        let total = 0
        for (const [cat, count] of Object.entries(stats.category_counts) as [string, number][]) {
          if (count <= 0) continue
          total += count
          items.push(cat)
          cumulative.push(total)
        }
        if (items.length > 0) catRef.current = { items, cumulative, total }
      })
      .catch(() => { /* ticker shows a generic category */ })

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
        const land = topojson.feature(world, world.objects.countries)

        const projection = d3.geoEquirectangular()
          .fitSize([width, height * 1.4], land as any)
          .translate([width / 2, height / 2 + 130])

        const hiddenCanvas = document.createElement('canvas')
        hiddenCanvas.width = width
        hiddenCanvas.height = height
        const hiddenCtx = hiddenCanvas.getContext('2d')
        if (!hiddenCtx) return

        const path = d3.geoPath().projection(projection).context(hiddenCtx)
        hiddenCtx.fillStyle = 'black'
        hiddenCtx.fillRect(0, 0, width, height)
        hiddenCtx.fillStyle = 'white'
        hiddenCtx.beginPath()
        path(land as any)
        hiddenCtx.fill()

        const imageData = hiddenCtx.getImageData(0, 0, width, height).data
        const newDots = []
        const step = 7

        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4
            if (imageData[index] > 128) {
              newDots.push({ x, y })
            }
          }
        }

        // Cache the red dotted base map to an offscreen canvas.
        const dotCanvas = document.createElement('canvas')
        dotCanvas.width = width
        dotCanvas.height = height
        const dotCtx = dotCanvas.getContext('2d')
        if (dotCtx) {
          dotCtx.beginPath()
          newDots.forEach(dot => {
            dotCtx.moveTo(dot.x, dot.y)
            dotCtx.arc(dot.x, dot.y, 1.6, 0, Math.PI * 2)
          })
          dotCtx.shadowColor = 'rgba(255, 10, 10, 0.95)'
          dotCtx.shadowBlur = 8
          dotCtx.fillStyle = 'rgba(255, 20, 20, 1)'
          dotCtx.fill()
        }

        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']

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
            const entry: TickerEntry = { id: tickerId, src: srcCC, tgt: tgtCC, cat }
            setTicker(prev => [entry, ...prev].slice(0, 7))
          }
        }

        for (let i = 0; i < 5; i++) spawnAttack()

        const render = () => {
          ctx.clearRect(0, 0, width, height)
          ctx.drawImage(dotCanvas, 0, 0)

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

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0 w-full h-full bg-app"
      />

      {/* Live attack ticker — fixed-size feed, bottom-right of the hero */}
      {ticker.length > 0 && (
        <div className="hidden lg:flex flex-col absolute bottom-6 right-6 z-10 w-[18rem] h-[268px] overflow-hidden rounded-xl border border-white/[0.08] bg-slate-950/60 backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] pointer-events-none">
          <div className="flex items-center gap-2.5 border-b border-white/5 px-4 py-3">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500/90" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Live Attacks
            </span>
          </div>

          {/* Feed: fixed height, older rows fade out at the bottom */}
          <div className="relative flex-1 overflow-hidden">
            <div className="flex flex-col px-2 py-1.5">
              {ticker.map((t) => (
                <div key={t.id} className="ticker-in flex items-center gap-3 rounded-lg px-2 py-[7px]">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[t.cat] ?? '#94a3b8' }}
                  />
                  <span className="flex items-center gap-2 font-mono text-[13px] text-slate-200">
                    <span className="w-6 text-right tracking-wide">{t.src}</span>
                    <span className="text-slate-600">→</span>
                    <span className="w-6 tracking-wide">{t.tgt}</span>
                  </span>
                  <span className="ml-auto truncate text-[10px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    {t.cat}
                  </span>
                </div>
              ))}
            </div>
            {/* Bottom fade mask */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/90 to-transparent" />
          </div>
        </div>
      )}
    </>
  )
}

function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ?
    `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '255, 255, 255';
}
