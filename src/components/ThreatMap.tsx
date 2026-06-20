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

// Weighted origin list built from real geo.json counts.
interface WeightedGeo {
  items: { coords: [number, number]; cc: string }[]
  cumulative: number[]
  total: number
}

interface Origin { cc: string; name: string; count: number }

export default function ThreatMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest weighted origins, read live by the animation loop.
  const weightedRef = useRef<WeightedGeo | null>(null)
  const [topOrigins, setTopOrigins] = useState<Origin[]>([])
  const [totalThreats, setTotalThreats] = useState<number>(0)

  // Fetch real attacker geolocation and build a weighted picker.
  useEffect(() => {
    let cancelled = false
    fetch(getBaseUrl() + 'geo.json?_=' + Date.now())
      .then(r => r.json())
      .then((geo: { countries?: Record<string, number>; total_geolocated?: number }) => {
        if (cancelled || !geo?.countries) return
        const entries = Object.entries(geo.countries) as [string, number][]

        // Weighted picker — only countries we can place on the map.
        const items: WeightedGeo['items'] = []
        const cumulative: number[] = []
        let total = 0
        for (const [cc, count] of entries) {
          const place = COUNTRY_COORDS[cc]
          if (!place || count <= 0) continue
          total += count
          items.push({ coords: place.coords, cc })
          cumulative.push(total)
        }
        if (items.length > 0) weightedRef.current = { items, cumulative, total }

        // HUD: top origins (use full counts so the list is accurate).
        const top = entries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([cc, count]) => ({ cc, name: COUNTRY_COORDS[cc]?.name ?? cc, count }))
        setTopOrigins(top)
        setTotalThreats(geo.total_geolocated ?? entries.reduce((s, [, c]) => s + c, 0))
      })
      .catch(() => { /* keep CITIES fallback */ })
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

    // Fetch world topology and generate dots
    fetch('https://unpkg.com/world-atlas@2.0.2/countries-110m.json')
      .then(r => r.json())
      .then(world => {
        const land = topojson.feature(world, world.objects.countries)

        // Setup D3 Projection
        const projection = d3.geoEquirectangular()
          .fitSize([width, height * 1.4], land as any) // Scale slightly larger
          .translate([width / 2, height / 2 + 130])

        // Create a hidden canvas to draw the solid map
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

        // Scan hidden canvas to create the dotted effect
        const imageData = hiddenCtx.getImageData(0, 0, width, height).data
        const newDots = []
        const step = 7 // Space between dots

        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const index = (y * width + x) * 4
            // If the pixel is white (land)
            if (imageData[index] > 128) {
              newDots.push({ x, y })
            }
          }
        }

        // Cache map dots to an offscreen canvas for extreme performance.
        // Calm, muted steel-blue base map — the attack arcs are the only
        // vivid elements (professional threat-map aesthetic).
        const dotCanvas = document.createElement('canvas')
        dotCanvas.width = width
        dotCanvas.height = height
        const dotCtx = dotCanvas.getContext('2d')
        if (dotCtx) {
          dotCtx.beginPath()
          newDots.forEach(dot => {
            dotCtx.moveTo(dot.x, dot.y)
            dotCtx.arc(dot.x, dot.y, 1.3, 0, Math.PI * 2)
          })
          dotCtx.shadowColor = 'rgba(56, 89, 138, 0.35)'
          dotCtx.shadowBlur = 3
          dotCtx.fillStyle = 'rgba(80, 104, 140, 0.55)'
          dotCtx.fill()
        }

        // Coherent, vivid accent palette for attacks against the calm map.
        const colors = ['#22d3ee', '#f59e0b', '#f43f5e']

        // Pick an origin [lon,lat] weighted by real attacker counts; fall
        // back to a random city until geo.json has loaded.
        const pickSource = (): [number, number] => {
          const w = weightedRef.current
          if (w && w.total > 0) {
            const r = Math.random() * w.total
            let lo = 0, hi = w.cumulative.length - 1
            while (lo < hi) {
              const mid = (lo + hi) >> 1
              if (w.cumulative[mid] < r) lo = mid + 1
              else hi = mid
            }
            return w.items[lo].coords
          }
          return CITIES[Math.floor(Math.random() * CITIES.length)].coords as [number, number]
        }

        const pickTarget = (srcCoords: [number, number]): [number, number] => {
          if (weightedRef.current) {
            return TARGET_HUBS[Math.floor(Math.random() * TARGET_HUBS.length)].coords
          }
          // Fallback: a random city different from the source.
          let t = CITIES[Math.floor(Math.random() * CITIES.length)]
          while (t.coords[0] === srcCoords[0] && t.coords[1] === srcCoords[1]) {
            t = CITIES[Math.floor(Math.random() * CITIES.length)]
          }
          return t.coords as [number, number]
        }

        const spawnAttack = () => {
          const srcCoords = pickSource()
          const tgtCoords = pickTarget(srcCoords)

          const srcProj = projection(srcCoords)
          const tgtProj = projection(tgtCoords)
          if (!srcProj || !tgtProj) return
          // Skip degenerate (same point) arcs.
          if (Math.abs(srcProj[0] - tgtProj[0]) < 1 && Math.abs(srcProj[1] - tgtProj[1]) < 1) return

          attacks.push({
            id: Math.random(),
            source: { x: srcProj[0], y: srcProj[1] },
            target: { x: tgtProj[0], y: tgtProj[1] },
            progress: 0,
            speed: 0.003 + Math.random() * 0.004, // Slower, more beautiful animation
            color: colors[Math.floor(Math.random() * colors.length)]
          })
        }

        // Pre-project the victim hubs so we can render soft "impact" pulses.
        const hubPoints = TARGET_HUBS
          .map(h => projection(h.coords))
          .filter((p): p is [number, number] => !!p)

        // Spawn initial attacks
        for (let i = 0; i < 5; i++) spawnAttack()

        let frame = 0
        const render = () => {
          frame++
          // Clear the canvas completely every frame for crisp 60fps (no smudging)
          ctx.clearRect(0, 0, width, height)

          // Draw cached background map
          ctx.drawImage(dotCanvas, 0, 0)

          // Soft pulsing markers at the destination hubs
          ctx.globalCompositeOperation = 'screen'
          for (let h = 0; h < hubPoints.length; h++) {
            const [hx, hy] = hubPoints[h]
            const pulse = (Math.sin(frame * 0.04 + h) + 1) / 2 // 0..1
            ctx.beginPath()
            ctx.arc(hx, hy, 2.2 + pulse * 1.5, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(34, 211, 238, ${0.25 + pulse * 0.35})`
            ctx.shadowBlur = 8
            ctx.shadowColor = 'rgba(34, 211, 238, 0.8)'
            ctx.fill()
            ctx.shadowBlur = 0
          }
          ctx.globalCompositeOperation = 'source-over'

          // Spawn new attacks randomly
          if (Math.random() < 0.02 && attacks.length < 15) {
            spawnAttack()
          }

          // Enable screen blending for beautiful neon overlap
          ctx.globalCompositeOperation = 'screen'

          // Update and draw attacks
          for (let i = attacks.length - 1; i >= 0; i--) {
            const a = attacks[i]
            a.progress += a.speed

            if (a.progress >= 1) {
              explosions.push({
                x: a.target.x,
                y: a.target.y,
                progress: 0,
                color: a.color
              })
              attacks.splice(i, 1)
              continue
            }

            const midX = (a.source.x + a.target.x) / 2
            const midY = (a.source.y + a.target.y) / 2
            const dist = Math.sqrt(Math.pow(a.target.x - a.source.x, 2) + Math.pow(a.target.y - a.source.y, 2))
            const cpY = midY - dist * 0.3

            // Procedurally draw the comet tail (20 trailing segments)
            const tailLength = 0.15 // Length of the tail relative to the curve
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

              // Only the head of the comet glows intensely
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

          // Update and draw explosions
          for (let i = explosions.length - 1; i >= 0; i--) {
            const e = explosions[i]
            e.progress += 0.025 // Explosion speed

            if (e.progress >= 1) {
              explosions.splice(i, 1)
              continue
            }

            const radius = e.progress * 25 // Max radius 25px
            const opacity = 1 - Math.pow(e.progress, 1.5) // Fade out curve

            ctx.beginPath()
            ctx.arc(e.x, e.y, radius, 0, Math.PI * 2)
            ctx.strokeStyle = `rgba(${hexToRgb(e.color)}, ${opacity})`
            ctx.lineWidth = 1.5
            ctx.shadowBlur = 12
            ctx.shadowColor = e.color
            ctx.stroke()

            // Inner core blast
            ctx.beginPath()
            ctx.arc(e.x, e.y, radius * 0.4, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${hexToRgb(e.color)}, ${opacity * 0.6})`
            ctx.fill()

            ctx.shadowBlur = 0
          }

          // Reset composite operation for next frame
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

  const maxCount = topOrigins.length > 0 ? topOrigins[0].count : 0

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-0 w-full h-full bg-app"
      />

      {/* Live threat-origins HUD — bottom-right, clear of the hero copy */}
      {topOrigins.length > 0 && (
        <div className="hidden lg:block absolute bottom-6 right-6 z-10 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 backdrop-blur-2xl shadow-2xl ring-1 ring-inset ring-white/5 pointer-events-none">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-3">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-300">
              Live Threat Origins
            </span>
          </div>

          <div className="px-4 py-4">
            {/* Headline metric */}
            <div className="mb-4">
              <div className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-black leading-none tracking-tight text-transparent tabular-nums">
                {totalThreats.toLocaleString()}
              </div>
              <div className="mt-1.5 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                Geolocated malicious IPs
              </div>
            </div>

            {/* Top origin countries */}
            <div className="flex flex-col gap-2.5">
              {topOrigins.map((o) => (
                <div key={o.cc} className="flex items-center gap-2.5">
                  <span className="w-6 shrink-0 text-[11px] font-bold text-slate-300">{o.cc}</span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-500">{o.name}</span>
                  <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500"
                      style={{ width: `${maxCount ? Math.max(8, (o.count / maxCount) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-[10px] font-semibold text-slate-400 tabular-nums">
                    {o.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
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
