import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import IsoPageShell from './layout/IsoPageShell'
import {
  ShieldCheck, Target, FileSearch, UserX, Ban, Scale, AlertTriangle, ArrowRight
} from 'lucide-react'
import { useSEO } from '@/useSEO'

const SECTIONS = [
  {
    icon: Target,
    accent: 'text-destructive bg-red-950/30 border-destructive/20',
    title: 'Target Integrity',
    body: 'Only report public IP addresses that demonstrate genuine malicious activity. Do not report private networks (e.g. 192.168.x.x), loopback addresses, or legitimate DNS, CDN, and cloud infrastructure unless it is actively being weaponized against you.',
    points: [
      'Verify the indicator is a routable, public IP address.',
      'Private, reserved, and whitelisted ranges are automatically blocked.',
      'Avoid reporting shared infrastructure that affects innocent users.',
    ],
  },
  {
    icon: FileSearch,
    accent: 'text-blue-400 bg-blue-950/30 border-blue-500/20',
    title: 'Accuracy & Evidence',
    body: 'Every submission must include clear, concise evidence or reasoning in the description field. Quality intelligence depends on accurate, well-documented reports the community can trust and act upon.',
    points: [
      'Describe the observed behaviour (e.g. SSH brute force, C2 callback, scanning).',
      'Include relevant timestamps, ports, or log excerpts where possible.',
      'Choose the most accurate threat category for the activity.',
    ],
  },
  {
    icon: UserX,
    accent: 'text-amber-400 bg-amber-950/30 border-amber-500/20',
    title: 'No Personal Information',
    body: 'Do not include Personally Identifiable Information (PII) in your reports unless it is directly part of the threat indicator — for example, a phishing email address operated by an attacker.',
    points: [
      'Never submit innocent third-party personal data.',
      'Redact sensitive internal details from log evidence.',
      'PII unrelated to the threat will be removed or rejected.',
    ],
  },
  {
    icon: Ban,
    accent: 'text-purple-400 bg-purple-950/30 border-purple-500/20',
    title: 'Prohibited Conduct',
    body: 'The platform exists to defend networks, not to harm them. Deliberate abuse of the reporting system undermines the entire community and will not be tolerated.',
    points: [
      'No false reports, manufactured false positives, or targeted harassment.',
      'No submitting competitors, personal grudges, or retaliatory listings.',
      'No automated mass submissions or attempts to game contributor rankings.',
    ],
  },
  {
    icon: Scale,
    accent: 'text-emerald-400 bg-emerald-950/30 border-emerald-500/20',
    title: 'Moderation & Enforcement',
    body: 'Submissions are subject to review. We reserve the right to edit, de-list, or remove any report, and to restrict or permanently ban accounts that violate this policy.',
    points: [
      'Violations may result in an immediate, permanent account ban.',
      'Repeatedly inaccurate reports reduce contributor trust.',
      'Listings can be disputed or corrected through your profile.',
    ],
  },
]

export default function PolicyPage() {
  useSEO({
    title: 'Community Reporting Policy — Threatbase',
    description: 'The rules and standards for submitting malicious IP addresses to the Threatbase community intelligence feed. Report accurately, ethically, and responsibly.',
    path: '/policy',
  })

  return (
    <IsoPageShell>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto w-full text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl text-xs font-bold uppercase tracking-widest mb-6 text-destructive">
            <ShieldCheck className="h-3.5 w-3.5" />
            Community Standards
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter text-white mb-5 drop-shadow-2xl">
            Reporting{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-blue-500">
              Policy
            </span>
          </h1>

          <p className="text-base md:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Threatbase is powered by the community. These standards keep the intelligence
            feed accurate, ethical, and trustworthy. By submitting a report, you agree to
            abide by the rules below.
          </p>
          <p className="text-sm text-slate-500 mt-4">Effective Date: June 12, 2026</p>
        </motion.div>

        {/* Policy sections */}
        <div className="max-w-4xl mx-auto w-full grid grid-cols-1 gap-5">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.section
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.5 }}
                className="group relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 md:p-8 shadow-2xl transition-all duration-300 hover:border-white/20 hover:bg-slate-900/70"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="relative flex flex-col md:flex-row gap-5 md:gap-6">
                  <div className={`shrink-0 h-12 w-12 rounded-2xl border flex items-center justify-center ${s.accent}`}>
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="flex-1">
                    <h2 className="flex items-baseline gap-2 text-xl font-bold text-white mb-3 tracking-tight">
                      <span className="text-slate-600 font-mono text-sm">{String(i + 1).padStart(2, '0')}</span>
                      {s.title}
                    </h2>
                    <p className="text-slate-300 leading-relaxed mb-4">{s.body}</p>
                    <ul className="space-y-2">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-start gap-2.5 text-sm text-slate-400">
                          <ArrowRight className="h-4 w-4 mt-0.5 shrink-0 text-slate-600" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.section>
            )
          })}
        </div>

        {/* Disclaimer + CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="max-w-4xl mx-auto w-full mt-8"
        >
          <div className="rounded-3xl border border-amber-500/20 bg-amber-950/10 backdrop-blur-xl p-6 md:p-7 flex items-start gap-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-slate-400 leading-relaxed">
              <span className="font-semibold text-amber-200">Disclaimer.</span> Threat
              intelligence is provided on an “as is” basis and may contain inaccuracies.
              Listings reflect community submissions and should be independently verified
              before being used for blocking or enforcement decisions. Review our{' '}
              <Link to="/terms" className="text-blue-400 hover:underline font-medium">Terms</Link>{' '}
              and{' '}
              <Link to="/privacy" className="text-blue-400 hover:underline font-medium">Privacy Policy</Link>{' '}
              for full details.
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/report"
              className="group inline-flex items-center gap-2 px-7 py-3 rounded-2xl bg-white text-black font-semibold text-sm transition-all hover:bg-slate-200"
            >
              <ShieldCheck className="h-4 w-4" />
              Submit a Report
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl text-white font-semibold text-sm transition-all hover:border-white/20 hover:bg-slate-900/80"
            >
              Learn More
            </Link>
          </div>
        </motion.div>

    </IsoPageShell>
  )
}
