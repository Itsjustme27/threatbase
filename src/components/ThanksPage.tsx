import { motion } from 'framer-motion'
import { useSEO } from '@/useSEO'
import { useAuth } from '@/AuthContext'
import { ParticleCanvas } from '@/components/ui/particle-canvas-1'

export default function ThanksPage() {
  const { user, profile } = useAuth()
  const displayName = profile?.username || user?.email?.split('@')[0] || 'Contributor'

  useSEO({
    title: 'Thank You — Threatbase',
    description: 'Thank you for your contribution to the Threatbase community.',
    path: '/thanks',
  })

  return (
    <main className="min-h-screen relative bg-[#0B0F19] overflow-hidden font-sans flex items-center justify-center">
      <ParticleCanvas speedScale={1.5} maxParticles={600} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center px-6"
      >
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mb-8 mx-auto w-32 h-32 md:w-40 md:h-40 rounded-full bg-white/5 border border-white/10 shadow-[0_0_40px_rgba(34,211,238,0.15)] backdrop-blur-md flex items-center justify-center p-6 overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 to-transparent opacity-50"></div>
          <img src={`${import.meta.env.BASE_URL}img/thanks.png`} alt="Thanks" className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" />
        </motion.div>

        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-400 tracking-tight drop-shadow-sm pb-2 mb-4">
          Thank you, @{displayName}!
        </h1>
        
        <p className="text-slate-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed drop-shadow">
          Your contribution is vital to keeping networks safe. The Threatbase community appreciates your effort in reporting this indicator.
        </p>
      </motion.div>
    </main>
  )
}
