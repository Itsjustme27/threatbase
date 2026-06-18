import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Turnstile } from '@marsidev/react-turnstile'
import { X, Shield } from 'lucide-react'

interface TurnstileModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (token: string) => void
  siteKey?: string
}

export default function TurnstileModal({ isOpen, onClose, onSuccess, siteKey = '0x4AAAAAADj2T6kY9_5dXRhs' }: TurnstileModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0B0F19]/90 backdrop-blur-sm transition-opacity"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="relative z-10 w-full max-w-sm px-4"
          >
            <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
              
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2} />
              </button>
              
              <div className="mb-6 mt-1 flex flex-col items-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-slate-800 bg-slate-900 shadow-lg">
                  <img src={`${import.meta.env.BASE_URL}img/logo.png`} alt="Threatbase Logo" className="h-full w-full object-cover" />
                </div>
                <h3 className="text-lg font-medium text-slate-100 tracking-tight">Human Verification</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-[280px]">
                  Please complete the security check to proceed with your scan.
                </p>
              </div>

              <div className="flex justify-center">
                <div className="overflow-hidden rounded-lg border border-slate-800 bg-[#222]">
                  <Turnstile
                    siteKey={siteKey}
                    onSuccess={(token) => {
                      setTimeout(() => onSuccess(token), 300)
                    }}
                    options={{
                      theme: 'dark',
                      size: 'normal'
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
