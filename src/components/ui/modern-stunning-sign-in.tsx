"use client"

import * as React from "react"
import { ShieldCheck } from "lucide-react"
import { useAuth } from "../../AuthContext"

const SignIn1 = () => {
  const { signInWithGoogle, signInWithGithub } = useAuth()

  return (
    <div className="flex flex-col items-center justify-center w-full relative overflow-hidden py-10">
      {/* Centered glass card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 backdrop-blur-md shadow-2xl p-8 flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center justify-center w-24 h-24 rounded-full mb-6 shadow-2xl border-2 border-white/10 bg-black overflow-hidden">
          <img src={`${import.meta.env.BASE_URL}img/logo.png`} alt="ThreatBase Logo" className="w-full h-full object-cover scale-110" />
        </div>
        
        {/* Title */}
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2 text-center">
          ThreatBase Intel
        </h2>
        <p className="text-sm text-slate-400 text-center mb-8">
          Join the intel network to report and track malicious indicators.
        </p>

        {/* Form */}
        <div className="flex flex-col w-full gap-4">
          <button 
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white text-black rounded-xl px-5 py-3.5 font-bold shadow-lg hover:bg-slate-200 transition-all text-sm group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>
          
          <button 
            onClick={signInWithGithub}
            className="w-full flex items-center justify-center gap-3 bg-[#24292e] text-white rounded-xl px-5 py-3.5 font-bold shadow-lg hover:bg-[#2f363d] transition-all text-sm group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform fill-current" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
            </svg>
            Continue with GitHub
          </button>
          
          <div className="w-full text-center mt-4">
            <span className="text-xs text-slate-500 font-medium">
              By joining, you agree to our Community Policy.
            </span>
          </div>
        </div>
      </div>

      {/* User count and avatars */}
      <div className="relative z-10 mt-12 flex flex-col items-center text-center">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Join <span className="text-white">thousands</span> of elite defenders
        </p>
        <div className="flex -space-x-3">
          <img
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80"
            alt="Defender"
            className="w-9 h-9 rounded-full border-2 border-[#0B0F19] object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80"
            alt="Defender"
            className="w-9 h-9 rounded-full border-2 border-[#0B0F19] object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=100&q=80"
            alt="Defender"
            className="w-9 h-9 rounded-full border-2 border-[#0B0F19] object-cover"
          />
          <img
            src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=100&q=80"
            alt="Defender"
            className="w-9 h-9 rounded-full border-2 border-[#0B0F19] object-cover"
          />
        </div>
      </div>
    </div>
  )
}

export { SignIn1 }
