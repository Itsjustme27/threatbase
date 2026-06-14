import React from 'react'
import IsoLevelWarp from '@/components/ui/isometric-wave-grid-background'
import { motion } from 'framer-motion'
import { useSEO } from '@/useSEO'

export default function TermsPage() {
  useSEO({
    title: 'Terms and Conditions — Threatbase',
    description: 'Terms and Conditions for Threatbase.',
    path: '/terms',
  })

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans bg-[#0A0C10]">
      
      {/* BACKGROUND */}
      <IsoLevelWarp 
        color="220, 38, 38" 
        density={50} 
        speed={1.2}
      />

      {/* CONTENT LAYER */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-6 py-32">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto w-full bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/80 border border-white/10 text-xs font-bold uppercase tracking-widest mb-8 text-blue-400">
            Legal Information
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Terms and Conditions
          </h1>
          <p className="text-sm text-slate-400 mb-10 border-b border-white/10 pb-6">Effective Date: June 12, 2026</p>

          <div className="space-y-8 text-slate-300 leading-relaxed text-base">
            
            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">1.</span> Acceptance of Terms
              </h3>
              <p>By accessing or using Threatbase, you agree to be bound by these Terms and Conditions. If you do not agree, you must not use the Service.</p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">2.</span> Description of Service
              </h3>
              <p>Threatbase is a free threat intelligence platform providing access to threat feeds, indicators of compromise (IOCs), and related security data. The Service is provided "as is" for informational, research, and defensive security purposes only.</p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">3.</span> User Responsibilities
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>You must comply with all applicable laws and regulations.</li>
                <li>You may not use the Service for malicious purposes, to distribute malware, or to conduct unauthorized attacks.</li>
                <li>You agree not to excessively scrape data, overload the Service, or attempt to reverse-engineer it.</li>
                <li>Any contact information you provide must be accurate.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">4.</span> Intellectual Property
              </h3>
              <p>All content on the Site, unless otherwise noted, belongs to or is licensed to the operator of Threatbase. You may use the data feeds for personal, research, or internal security purposes, provided you give appropriate attribution where required and respect any source-specific licenses.</p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">5.</span> Disclaimers and Limitation of Liability
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>The Service is provided <strong className="text-white">"AS IS"</strong> without any warranties.</li>
                <li>Threat intelligence data may contain inaccuracies or delays. You use the Service entirely at your own risk.</li>
                <li>In no event shall the operator be liable for any damages arising from your use of the Service.</li>
                <li>The Site may contain links to third-party websites; we are not responsible for their content or practices.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">6.</span> Termination
              </h3>
              <p>We reserve the right to restrict or block access to the Service at any time, without notice, for any reason.</p>
            </section>

          </div>

        </motion.div>
      </div>
    </div>
  )
}
