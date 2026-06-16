import React from 'react'
import IsoLevelWarp from '@/components/ui/isometric-wave-grid-background'
import { motion } from 'framer-motion'
import { useSEO } from '@/useSEO'

export default function PrivacyPage() {
  useSEO({
    title: 'Privacy Policy — Threatbase',
    description: 'Privacy Policy for Threatbase.',
    path: '/privacy',
  })

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans bg-app">
      
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
            Privacy Policy
          </h1>
          <p className="text-sm text-slate-400 mb-10 border-b border-white/10 pb-6">Effective Date: June 12, 2026</p>

          <div className="space-y-8 text-slate-300 leading-relaxed text-base">
            
            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">1.</span> Introduction
              </h3>
              <p>This Privacy Policy explains how we collect, use, and protect information when you visit Threatbase.</p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">2.</span> Information We Collect
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li><strong className="text-white">Automatically Collected Data</strong>: We (or our hosting provider) may collect standard server logs such as IP address, browser type, operating system, access times, and referring pages.</li>
                <li><strong className="text-white">No User Accounts</strong>: The Service does not require registration or login to view data. Authenticaton may be used via trusted third-party providers (like Google) for submitting data, but we do not store sensitive personal passwords.</li>
                <li><strong className="text-white">Threat Data</strong>: Feeds and IOCs are publicly available security indicators and generally do not contain personal information.</li>
              </ul>
              <p className="mt-4">We do not intentionally collect personal data such as names or private email addresses.</p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">3.</span> How We Use Information
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>To operate, maintain, and improve the Service.</li>
                <li>For security monitoring and analytics.</li>
                <li>We do not sell or rent personal data to third parties.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">4.</span> Cookies and Tracking
              </h3>
              <p>The Site may use minimal cookies or local storage for basic functionality. We do not use extensive tracking or advertising cookies.</p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">5.</span> Data Sharing
              </h3>
              <ul className="list-disc list-inside space-y-2 ml-2">
                <li>Data may be disclosed if required by law or to protect the Service.</li>
                <li>Threat intelligence data is publicly accessible as part of the feed.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span className="text-destructive">6.</span> Third-Party Services
              </h3>
              <p>The Site may link to or rely on third-party services (e.g., GitHub, Supabase). Their privacy practices are governed by their own policies.</p>
            </section>

          </div>

        </motion.div>
      </div>
    </div>
  )
}
