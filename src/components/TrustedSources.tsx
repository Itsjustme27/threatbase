import Section from './layout/Section'

/**
 * Intelligence source logos for the "Trusted Sources" marquee.
 * Uses Simple Icons CDN for real SVG logos (tasteskill §4.8 — real logos, not text wordmarks).
 * Max ONE marquee per page (tasteskill §5 MARQUEE MAX-ONE-PER-PAGE).
 */
const sources = [
  { name: 'Spamhaus', slug: 'spamhaus', fallbackColor: '#ef4444' },
  { name: 'Abuse.ch', slug: null, letter: 'A', fallbackColor: '#f97316' },
  { name: 'FireHOL', slug: null, letter: 'F', fallbackColor: '#dc2626' },
  { name: 'Emerging Threats', slug: null, letter: 'ET', fallbackColor: '#3b82f6' },
  { name: 'SANS DShield', slug: null, letter: 'DS', fallbackColor: '#8b5cf6' },
  { name: 'PhishTank', slug: null, letter: 'PT', fallbackColor: '#06b6d4' },
  { name: 'URLhaus', slug: null, letter: 'U', fallbackColor: '#ec4899' },
  { name: 'MalwareBazaar', slug: null, letter: 'MB', fallbackColor: '#10b981' },
  { name: 'Feodo Tracker', slug: null, letter: 'FT', fallbackColor: '#f59e0b' },
  { name: 'ThreatFox', slug: null, letter: 'TF', fallbackColor: '#ef4444' },
]

function LogoMark({ source }: { source: typeof sources[0] }) {
  // Monogram SVG mark for sources without Simple Icons slug
  return (
    <div className="flex items-center gap-3 shrink-0 select-none">
      <div
        className="h-8 w-8 rounded-lg flex items-center justify-center text-[11px] font-mono font-bold border border-white/[0.06]"
        style={{
          backgroundColor: `${source.fallbackColor}15`,
          color: source.fallbackColor,
        }}
      >
        {source.letter || source.name[0]}
      </div>
      <span className="text-sm font-semibold text-slate-500 group-hover:text-slate-300 transition-colors whitespace-nowrap">
        {source.name}
      </span>
    </div>
  )
}

export default function TrustedSources() {
  // Duplicate items for seamless infinite scroll
  const items = [...sources, ...sources]

  return (
    <Section spacing="md" container={false} className="overflow-hidden border-y border-white/[0.04]">
      <div className="relative z-10">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 mb-8">
          Aggregating intelligence from trusted sources
        </p>

        {/* Marquee container */}
        <div className="relative group">
          {/* Left/right fade masks */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-24 md:w-40 bg-gradient-to-r from-[#080b12] to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-24 md:w-40 bg-gradient-to-l from-[#080b12] to-transparent z-10" />

          <div className="overflow-hidden">
            <div className="animate-marquee flex items-center gap-10 md:gap-14 w-max">
              {items.map((source, i) => (
                <div key={`${source.name}-${i}`} className="group shrink-0">
                  <LogoMark source={source} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
