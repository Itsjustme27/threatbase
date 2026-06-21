'use client'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Precision radar scanner for the "scanning target" state.
 * Cold-luxury language: platinum hairline bezel + dial ticks, a single rotating
 * ruby sweep beam, expanding ping rings, and a gem-like core orb.
 * Collapses to a static instrument under prefers-reduced-motion.
 */
export default function RadarScan({ size = 184 }: { size?: number }) {
  const reduce = useReducedMotion()

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* Depth glow seated under the instrument */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle at center, rgba(207,23,51,0.14), transparent 62%)' }}
      />

      {/* Concentric hairline rings — precision bezel */}
      <div className="absolute inset-0 rounded-full border border-platinum-400/[0.08]" />
      <div className="absolute rounded-full border border-platinum-400/[0.10]" style={{ inset: size * 0.16 }} />
      <div className="absolute rounded-full border border-platinum-400/[0.12]" style={{ inset: size * 0.31 }} />

      {/* Crosshair */}
      <div className="absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2 bg-platinum-400/[0.06]" />
      <div className="absolute top-1/2 left-4 right-4 h-px -translate-y-1/2 bg-platinum-400/[0.06]" />

      {/* Dial ticks — major every 90°, fine markers between */}
      {Array.from({ length: 12 }).map((_, i) => {
        const major = i % 3 === 0
        return (
          <span
            key={i}
            className={`absolute left-1/2 top-1/2 w-px rounded-full ${major ? 'bg-platinum-300/40' : 'bg-platinum-400/[0.15]'}`}
            style={{
              height: major ? 9 : 5,
              transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(${-(size / 2 - 10)}px)`,
            }}
          />
        )
      })}

      {/* Rotating ruby sweep beam (masked to spare the core) */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, rgba(207,23,51,0) 0deg, rgba(207,23,51,0) 292deg, rgba(207,23,51,0.16) 338deg, rgba(207,23,51,0.5) 360deg)',
          WebkitMaskImage: 'radial-gradient(circle, transparent 16%, #000 42%)',
          maskImage: 'radial-gradient(circle, transparent 16%, #000 42%)',
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 3.4, ease: 'linear', repeat: Infinity }}
      />

      {/* Expanding ping rings emanating from the core */}
      {!reduce &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border"
            style={{ inset: 0, margin: 'auto', width: 56, height: 56, borderColor: 'rgba(207,23,51,0.45)' }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 2.4], opacity: [0, 0.5, 0] }}
            transition={{ duration: 3, ease: 'easeOut', repeat: Infinity, delay: i }}
          />
        ))}

      {/* Gem-like core orb */}
      <motion.div
        className="relative rounded-full"
        style={{
          width: 18,
          height: 18,
          background: 'radial-gradient(circle at 32% 28%, #f7c2ca, #cf1733 55%, #8f1023)',
          boxShadow: '0 0 0 1px rgba(207,23,51,0.30), 0 0 22px 4px rgba(207,23,51,0.5)',
        }}
        animate={reduce ? undefined : { scale: [1, 1.14, 1] }}
        transition={reduce ? undefined : { duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  )
}
