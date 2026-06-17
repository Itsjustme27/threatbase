import { motion } from 'framer-motion'
import Leaderboard from './Leaderboard'
import { useSEO } from '../useSEO'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import AnoAI from '@/components/ui/animated-shader-background'

export default function ContributorsPage() {
  useSEO({
    title: 'Top Contributors — Threatbase Community Intel',
    description: 'View the top contributors who are defending networks globally by reporting threats.',
    path: '/contributors',
  })

  return (
    <main className="bg-app min-h-screen">
      <div className="pt-28 pb-24 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none z-10"></div>
        <div className="absolute inset-0 z-0 opacity-80 mix-blend-screen">
          <AnoAI />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F19]/20 via-[#0B0F19]/60 to-[#0B0F19] z-0 pointer-events-none"></div>

        <div className="mx-auto max-w-4xl px-4 lg:px-8 relative z-10 space-y-10">
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center relative"
          >
            <h1 className="text-4xl md:text-5xl font-black font-righteous flex items-center justify-center gap-2 text-white tracking-tighter pb-2">
              <span className="text-liquid-red drop-shadow-md">Top Contributors</span>
            </h1>
            <p className="mt-2 text-slate-400 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
              Recognizing the community leaders who help defend networks globally.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Ambient card glow */}
            <div className="pointer-events-none absolute -inset-px rounded-[1.4rem] bg-gradient-to-b from-blue-500/20 via-transparent to-transparent opacity-60 blur-xl" />

            <Card className="relative z-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-2xl backdrop-blur-xl">
              {/* top sheen */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <CardHeader className="relative border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent px-6 pb-6 pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-3 text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                    <img src={`${import.meta.env.BASE_URL}img/community.png`} alt="Community Icon" className="h-10 w-10 object-contain drop-shadow-md" />
                  </div>
                  <div>
                    <CardTitle className="text-[22px] font-bold tracking-wide text-white drop-shadow-sm">Leaderboard</CardTitle>
                    <CardDescription className="mt-0.5 text-slate-400">Global threat intelligence leaders</CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="px-3 py-4 sm:px-4">
                  <Leaderboard />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </main>
  )
}
