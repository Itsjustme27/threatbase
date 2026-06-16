import AnimatedHighlightedAreaChart from './blocks/animated-area-chart'

export default function Analytics({ statsData, feedVersion }: any) {
  return (
    <section className="py-12 md:py-24 relative overflow-hidden scroll-mt-24" id="analytics">
      <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
        <div className="mb-14 text-center md:text-left flex flex-col items-center md:items-start">
          <h2 className="text-4xl md:text-5xl font-extrabold flex items-center justify-center md:justify-start gap-4 text-white drop-shadow-sm tracking-tight">
            Threat Landscape
          </h2>
          <p className="mt-5 text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
            90-day volume trend of tracked malicious indicators across our global sensor network, aggregated in real-time.
          </p>
        </div>

        <div>
          <AnimatedHighlightedAreaChart feedVersion={feedVersion} />
        </div>
      </div>
    </section>
  )
}
