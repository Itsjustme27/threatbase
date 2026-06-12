import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Crown, Diamond, Star, Shield, Target, Trophy, ShieldCheck } from 'lucide-react'
import supabaseClient from '../supabaseClient'
import { fmt } from '../utils'

// Ranks based on number of reports
const getRankInfo = (count: number) => {
  if (count >= 500) {
    return {
      name: 'Legend',
      style: 'bg-amber-500/10 border-amber-500/30 text-amber-500 transition-all duration-500 group-hover:bg-amber-500/20 group-hover:border-amber-400/60 group-hover:text-amber-400',
      icon: <Trophy size={14} className="text-amber-500 transition-all duration-500 group-hover:text-amber-400" strokeWidth={2.5} />
    }
  }
  if (count >= 300) {
    return {
      name: 'Elite',
      style: 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-500 transition-all duration-500 group-hover:bg-fuchsia-500/20 group-hover:border-fuchsia-400/60 group-hover:text-fuchsia-400',
      icon: <Diamond size={14} className="text-fuchsia-500 transition-all duration-500 group-hover:text-fuchsia-400" strokeWidth={2.5} />
    }
  }
  if (count >= 100) {
    return {
      name: 'Pro',
      style: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-500 transition-all duration-500 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/60 group-hover:text-cyan-400',
      icon: <Star size={14} className="text-cyan-500 transition-all duration-500 group-hover:text-cyan-400" strokeWidth={2.5} />
    }
  }
  if (count >= 50) {
    return {
      name: 'Defender',
      style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 transition-all duration-500 group-hover:bg-emerald-500/20 group-hover:border-emerald-400/60 group-hover:text-emerald-400',
      icon: <Shield size={14} className="text-emerald-500 transition-all duration-500 group-hover:text-emerald-400" strokeWidth={2.5} />
    }
  }
  return {
    name: 'Initiate',
    style: 'bg-slate-500/10 border-slate-500/30 text-slate-400 transition-all duration-500 group-hover:bg-slate-400/20 group-hover:border-slate-300/40 group-hover:text-slate-200',
    icon: <Target size={14} className="text-slate-400 transition-all duration-500 group-hover:text-slate-200" strokeWidth={2.5} />
  }
}

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLeaders() {
      if (!supabaseClient) return
      setLoading(true)
      try {
        // We assume a view 'top_contributors' exists in Supabase
        const { data, error } = await supabaseClient
          .from('top_contributors')
          .select('*')
          .order('reports_count', { ascending: false })
          .limit(10)

        if (error) throw error
        if (data) setLeaders(data)
      } catch (err) {
        console.error('Failed to load leaderboard:', err)
      } finally {
        setLoading(false)
      }
    }

    loadLeaders()
    // Refresh leaderboard every 30 seconds
    const interval = setInterval(loadLeaders, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && leaders.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    )
  }

  if (leaders.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Award size={48} className="mx-auto mb-4 opacity-30" />
        <p>No contributors yet. Be the first to earn a rank!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {leaders.map((leader, index) => {
        const rank = getRankInfo(leader.reports_count)
        return (
          <motion.div
            key={leader.reporter_alias}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 hover:bg-white/[0.04] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm transition-all relative overflow-hidden group gap-4"
          >
            <div className="flex items-center gap-4 relative z-10 flex-1 min-w-0">
              <div className={`flex items-center justify-center flex-shrink-0 w-12 h-12 rounded-full font-bold font-elegant border transition-all duration-500 ${
                index === 0 ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-500 group-hover:bg-yellow-400/10 group-hover:border-yellow-400/50' :
                index === 1 ? 'bg-slate-400/5 border-slate-400/20 text-slate-400 group-hover:bg-slate-200/10 group-hover:border-slate-300/50' :
                index === 2 ? 'bg-orange-600/5 border-orange-600/20 text-orange-600 group-hover:bg-orange-500/10 group-hover:border-orange-400/50' :
                'bg-white/[0.02] text-slate-500 border-white/[0.03] text-[14px] group-hover:bg-white/[0.05] group-hover:border-white/[0.1] group-hover:text-slate-300'
              }`}>
                {index === 0 ? <Crown size={22} className="text-yellow-600 fill-transparent transition-all duration-500 group-hover:text-yellow-400 group-hover:fill-yellow-400/30" strokeWidth={2} /> :
                 index === 1 ? <Crown size={22} className="text-slate-400 fill-transparent transition-all duration-500 group-hover:text-slate-300 group-hover:fill-slate-300/30" strokeWidth={2} /> :
                 index === 2 ? <Crown size={22} className="text-orange-600 fill-transparent transition-all duration-500 group-hover:text-orange-400 group-hover:fill-orange-400/30" strokeWidth={2} /> :
                 `#${index + 1}`}
              </div>
              <div className="flex flex-col justify-center gap-2 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-semibold text-white/80 transition-all duration-500 group-hover:text-white text-[15px] md:text-[16px] tracking-tight font-elegant leading-tight break-words">@{leader.reporter_alias}</h4>
                  {leader.reporter_alias === 'lamichhanesujal18' && (
                    <span className="flex-shrink-0 px-1.5 py-[2px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-400/80 text-[9px] uppercase tracking-widest font-bold rounded flex items-center gap-1 transition-all duration-500 group-hover:bg-indigo-500/20 group-hover:border-indigo-400/50 group-hover:text-indigo-300">
                      <ShieldCheck size={10} strokeWidth={3} className="transition-all duration-500" />
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border backdrop-blur-sm flex-shrink-0 ${rank.style}`}>
                    {rank.icon}
                    <span className="text-[10px] uppercase font-bold tracking-[0.1em] text-slate-200">
                      {rank.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-right relative z-10 flex flex-col justify-center flex-shrink-0">
              <div className="text-[28px] font-black text-white font-elegant tracking-tight leading-none mb-1">
                {fmt(leader.reports_count)}
              </div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-slate-400 font-bold whitespace-nowrap">
                Intel Reports
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
