import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Heart, ExternalLink, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useSEO } from '@/useSEO'
import supabaseClient from '@/supabaseClient'
import AnimatedShaderBackground from '@/components/ui/animated-shader-background'
import { Sparkles } from '@/components/ui/sparkles'
import { InfiniteSlider } from '@/components/ui/infinite-slider'
import { ProgressiveBlur } from '@/components/ui/progressive-blur'

type Source = { name: string; desc: string; url: string }

const SOURCES: Source[] = [
  { name: 'Spamhaus', desc: 'DROP / EDROP hijacked & malicious netblocks', url: 'https://www.spamhaus.org/' },
  { name: 'FireHOL', desc: 'Curated IP blocklist aggregation (levels 1–3)', url: 'https://iplists.firehol.org/' },
  { name: 'Abuse.ch', desc: 'Feodo Tracker, ThreatFox, URLhaus & SSLBL', url: 'https://abuse.ch/' },
  { name: 'AbuseIPDB', desc: 'Community-reported IP abuse confidence scores', url: 'https://www.abuseipdb.com/' },
  { name: 'Emerging Threats', desc: 'Compromised hosts & firewall block rules', url: 'https://rules.emergingthreats.net/' },
  { name: 'SANS DShield', desc: 'Internet Storm Center attack sensor feed', url: 'https://www.dshield.org/' },
  { name: 'Blocklist.de', desc: 'Fail2ban-sourced brute-force & abuse reports', url: 'https://www.blocklist.de/' },
  { name: 'CINS Army', desc: 'CI Army low-noise malicious IP scoring', url: 'https://cinsscore.com/' },
  { name: 'IPsum', desc: 'Aggregated threat intelligence by source count', url: 'https://github.com/stamparm/ipsum' },
  { name: 'Binary Defense', desc: 'Community banlist of hostile systems', url: 'https://www.binarydefense.com/' },
  { name: 'GreenSnow', desc: 'Attackers detected probing servers worldwide', url: 'https://greensnow.co/' },
  { name: 'Tor Project', desc: 'Authoritative Tor exit-node lists', url: 'https://www.torproject.org/' },
  { name: 'OpenPhish', desc: 'Real-time phishing URL intelligence', url: 'https://openphish.com/' },
  { name: 'MalwareBazaar', desc: 'Malware sample hash sharing (abuse.ch)', url: 'https://bazaar.abuse.ch/' },
  { name: 'StevenBlack Hosts', desc: 'Unified malware & ad host blocklists', url: 'https://github.com/StevenBlack/hosts' },
  { name: 'DataPlane.org', desc: 'SSH, SIP & VNC abuse telemetry', url: 'https://dataplane.org/' },
]

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
}

export default function ThanksPage() {
  const [topReporter, setTopReporter] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTopReporter() {
      if (!supabaseClient) return
      try {
        const { data, error } = await supabaseClient
          .from('top_contributors')
          .select('reporter_alias')
          .order('reports_count', { ascending: false })
          .limit(1)
          .single()
        if (!error && data) setTopReporter(data.reporter_alias)
      } catch (err) {
        console.error('Failed to fetch top reporter:', err)
      }
    }
    fetchTopReporter()
  }, [])

  useSEO({
    title: 'Intel Sources — Threatbase | Open Source Threat Intelligence Credits',
    description: 'Threatbase is powered by the global cybersecurity community. Credits to Spamhaus, FireHOL, Emerging Threats, Abuse.ch, SANS DShield, and 15+ open-source threat intelligence providers.',
    path: '/thanks',
  })

  return (
    <main className="min-h-screen pt-28 pb-24 relative bg-app overflow-hidden font-sans">
      {/* Animated aurora shader background */}
      <AnimatedShaderBackground className="opacity-60" />
      {/* Readability overlay + texture on top of the shader */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F19]/40 via-[#0B0F19]/70 to-[#0B0F19] pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <div className="mx-auto max-w-6xl px-6 lg:px-12 relative z-10">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center flex flex-col items-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400 mb-7">
            <Heart className="h-3.5 w-3.5 fill-amber-400/30" />
            With Gratitude
          </span>

          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-500 tracking-tight pb-2">
            Intel Sources
          </h1>

          <p className="mt-5 text-slate-400 text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Threatbase stands on the shoulders of the global security community. Our coverage is
            made possible by the maintainers who tirelessly collect, verify, and share open threat
            intelligence — making the internet measurably safer for everyone.
          </p>
        </motion.div>

        {/* Scrolling feed-name marquee */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative mt-14"
        >
          <div className="relative h-[88px] w-full">
            <InfiniteSlider className="flex h-full w-full items-center" duration={40} gap={56}>
              {SOURCES.map((s) => (
                <span
                  key={s.name}
                  className="whitespace-nowrap text-lg md:text-xl font-bold tracking-tight text-slate-400/70 transition-colors hover:text-amber-300"
                >
                  {s.name}
                </span>
              ))}
            </InfiniteSlider>
            <ProgressiveBlur
              className="pointer-events-none absolute top-0 left-0 h-full w-[180px]"
              direction="left"
              blurIntensity={1}
            />
            <ProgressiveBlur
              className="pointer-events-none absolute top-0 right-0 h-full w-[180px]"
              direction="right"
              blurIntensity={1}
            />
          </div>

          <div className="relative -mt-6 h-28 w-full overflow-hidden [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
            <div className="absolute inset-0 before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_bottom_center,var(--gradient-color),transparent_70%)] before:opacity-30" />
            <div className="absolute -left-1/2 top-1/2 z-10 aspect-[1/0.7] w-[200%] rounded-[100%] border-t border-white/10 bg-app" />
            <Sparkles
              density={500}
              size={1.2}
              className="absolute inset-x-0 bottom-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,white,transparent_85%)]"
              color="#ffffff"
            />
          </div>
        </motion.div>

        {/* Top contributor highlight */}
        {topReporter && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
            className="mt-12 max-w-xl mx-auto"
          >
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.08] to-transparent backdrop-blur-xl px-6 py-5 flex items-center gap-4">
              <div className="shrink-0 h-12 w-12 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-center">
                <Trophy className="h-6 w-6 text-amber-400" />
              </div>
              <div className="text-left">
                <div className="text-[11px] font-bold uppercase tracking-widest text-amber-400/80">#1 Top Contributor</div>
                <div className="text-lg font-black text-white tracking-tight mt-0.5">
                  @{topReporter}
                </div>
              </div>
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
            </div>
          </motion.div>
        )}



        {/* Footer note + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-slate-500 max-w-2xl mx-auto leading-relaxed">
            …and many other community-driven projects whose dedication to open intelligence powers
            defenders worldwide. Want to be part of it?
          </p>
          <Link
            to="/report"
            className="group mt-6 inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-white text-black font-semibold text-sm transition-all hover:bg-slate-200"
          >
            <Heart className="h-4 w-4" />
            Contribute an Indicator
          </Link>
        </motion.div>

      </div>
    </main>
  )
}
