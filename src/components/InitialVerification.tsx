import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Turnstile } from '@marsidev/react-turnstile'
import { Check, Loader2 } from 'lucide-react'

interface InitialVerificationProps {
  onSuccess: (token: string) => void
  siteKey?: string
}

const HOSTNAME = 'threatbase.qzz.io'

type Phase = 'verifying' | 'success'

export default function InitialVerification({ onSuccess, siteKey = '0x4AAAAAADj2T6kY9_5dXRhs' }: InitialVerificationProps) {
  const [phase, setPhase] = React.useState<Phase>('verifying')
  const tokenRef = React.useRef<string>('')

  // Stable Ray ID for the lifetime of the page (avoids re-randomising on every render).
  const rayId = React.useMemo(
    () => Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    []
  )

  const handleSuccess = (token: string) => {
    tokenRef.current = token
    setPhase('success')
    // Brief "waiting for host to respond" beat, mirroring the Cloudflare interstitial,
    // then hand control back to the app.
    setTimeout(() => onSuccess(token), 1400)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0c0f] font-sans antialiased">
      {/* Subtle background grid for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative w-full max-w-md px-6"
      >
        <div className="rounded-xl border border-white/10 bg-[#15171c]/80 shadow-2xl shadow-black/50 backdrop-blur-sm">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
            <img
              src={`${import.meta.env.BASE_URL}img/logo.png`}
              alt="Threatbase"
              className="h-7 w-7 shrink-0 object-contain"
            />
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-white">Threatbase Intel</p>
              <p className="text-[11px] text-slate-500">{HOSTNAME}</p>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-7">
            <AnimatePresence mode="wait">
              {phase === 'verifying' ? (
                <motion.div
                  key="verifying"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <h1 className="text-base font-medium text-slate-100">
                    Verifying you are human
                  </h1>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-400">
                    This website uses a security service to protect itself from malicious bots.
                    Complete the check below to continue to {HOSTNAME}.
                  </p>

                  <div className="mt-6">
                    <Turnstile
                      siteKey={siteKey}
                      onSuccess={handleSuccess}
                      options={{ theme: 'dark', size: 'flexible' }}
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="py-2"
                >
                  <div className="flex items-center gap-3">
                    <motion.span
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40"
                    >
                      <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} />
                    </motion.span>
                    <span className="text-sm font-medium text-slate-100">Verification successful</span>
                  </div>

                  <div className="mt-5 flex items-center gap-2.5 text-[13px] text-slate-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                    <span>
                      Waiting for <span className="text-slate-300">{HOSTNAME}</span> to respond&hellip;
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-6 py-4">
            <p className="text-[11px] leading-relaxed text-slate-600">
              Ray ID: <span className="font-mono text-slate-500">{rayId}</span>
              <br />
              Performance &amp; security by <span className="text-slate-400">Cloudflare</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
