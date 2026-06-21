import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import IsoPageShell from './layout/IsoPageShell'
import { Search, ShieldCheck, Share2, ArrowRight, Github } from 'lucide-react'
import { useSEO } from '@/useSEO'

export default function AboutPage() {
  useSEO({
    title: 'About — Threatbase | Community-Driven Threat Intelligence',
    description: 'Learn about Threatbase, a community-driven threat intelligence platform for researchers, analysts, and cybersecurity enthusiasts. Discover IOCs, track threats, and transform security data into actionable intelligence.',
    path: '/about',
  })

  const features = [
    {
      icon: <img src={`${import.meta.env.BASE_URL}img/database.png`} alt="Database" className="w-8 h-8 object-contain drop-shadow-sm" />,
      iconColorClass: "text-destructive bg-red-950/30 border-destructive/20 group-hover:border-destructive/40",
      title: "Discover IOCs",
      desc: "Access verified indicators of compromise to proactively defend networks."
    },
    {
      icon: <img src={`${import.meta.env.BASE_URL}img/threat.png`} alt="Threats" className="w-8 h-8 object-contain drop-shadow-sm" />,
      iconColorClass: "text-indigo-400 bg-indigo-950/30 border-indigo-500/20 group-hover:border-indigo-500/40",
      title: "Track Threats",
      desc: "Monitor emerging threat actors, malware campaigns, and attack vectors."
    },
    {
      icon: <img src={`${import.meta.env.BASE_URL}img/action.png`} alt="Actionable Intel" className="w-8 h-8 object-contain drop-shadow-sm" />,
      iconColorClass: "text-blue-400 bg-blue-950/30 border-blue-500/20 group-hover:border-blue-500/40",
      title: "Actionable Intel",
      desc: "Transform raw security data and logs into clear, actionable intelligence."
    }
  ]

  const stats = [
    { value: "6+", label: "IOC Categories" },
    { value: "24/7", label: "Live Feed Sync" },
    { value: "Open", label: "Source & Free" },
    { value: "Global", label: "Community" },
  ]

  const steps = [
    {
      icon: Search,
      step: "01",
      title: "Scan & Investigate",
      desc: "Look up any IP or domain against aggregated blocklists and community reports in real time.",
    },
    {
      icon: ShieldCheck,
      step: "02",
      title: "Report Threats",
      desc: "Submit malicious indicators with evidence. Whitelist protection prevents false positives automatically.",
    },
    {
      icon: Share2,
      step: "03",
      title: "Defend Together",
      desc: "Verified submissions feed high-performance blocklists that defenders deploy worldwide.",
    },
  ]

  return (
    <IsoPageShell>

        {/* Top Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl text-xs font-bold uppercase tracking-widest mb-6 text-destructive">
            About ThreatBase
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-white mb-6 drop-shadow-2xl">
            Community-Driven <br />
            <span className="text-red-500">
              Threat Intelligence.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-8">
            ThreatBase is a community-driven threat intelligence platform designed for researchers, analysts, and cybersecurity enthusiasts. Discover IOCs, track emerging threats, explore vulnerabilities, and transform raw security data into actionable intelligence.
          </p>

          <div className="inline-block p-[1px] rounded-2xl bg-gradient-to-r from-red-500/40 to-red-800/40 mb-16 shadow-2xl">
            <div className="px-8 py-4 rounded-2xl bg-slate-950/80 backdrop-blur-xl">
              <span className="font-mono text-lg text-slate-200 tracking-wide">
                <span className="text-destructive">&gt;</span> Curiosity fuels discovery.
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stats band */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto w-full mb-24"
        >
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md px-4 py-6 text-center"
            >
              <div className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-500 tracking-tight">
                {s.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-slate-500 font-semibold">
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full mb-28">
          {features.map((f, i) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1), duration: 0.5 }}
              key={f.title}
              className="group relative flex flex-col justify-start overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40 p-8 transition-all duration-300 hover:bg-slate-900/60 hover:border-white/10 hover:-translate-y-1 hover:shadow-2xl backdrop-blur-md text-left"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

              <div className={`p-3 w-fit rounded-2xl border transition-all duration-300 mb-6 ${f.iconColorClass}`}>
                {f.icon}
              </div>

              <h3 className="text-xl font-bold text-white mb-3 tracking-tight group-hover:text-red-100 transition-colors">
                {f.title}
              </h3>

              <p className="text-slate-400 font-medium leading-relaxed group-hover:text-slate-300 transition-colors">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* How it works */}
        <div className="max-w-5xl mx-auto w-full mb-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3">
              How It Works
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              A simple loop that turns individual observations into collective defense.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="relative rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md p-8 text-left"
                >
                  <span className="absolute top-6 right-7 font-mono text-5xl font-black text-white/5 select-none">
                    {s.step}
                  </span>
                  <div className="h-12 w-12 rounded-2xl border border-white/10 bg-slate-950/60 flex items-center justify-center mb-5 text-blue-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 tracking-tight">{s.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative max-w-4xl mx-auto w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 backdrop-blur-xl p-10 md:p-14 text-center shadow-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-red-900/10 pointer-events-none" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4">
              Join the defense.
            </h2>
            <p className="text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
              Every report strengthens the feed. Submit malicious indicators, explore the
              data, and help protect networks around the world.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/report"
                className="group inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-white text-black font-semibold text-sm transition-all hover:bg-slate-200"
              >
                <ShieldCheck className="h-4 w-4" />
                Report a Threat
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="https://github.com/kalidada18/threatbase"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl border border-white/10 bg-slate-950/40 text-white font-semibold text-sm transition-all hover:border-white/20 hover:bg-slate-950/60"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </motion.div>

    </IsoPageShell>
  )
}
