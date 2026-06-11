import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react'

export default function ReportScanner({ scanResult, isScanning, showReport, scanInput }: any) {
  if (!showReport) return null

  const ip = scanResult?.ip || scanInput?.trim() || ''
  const isMalicious = scanResult?.isMalicious
  const type = scanResult
    ? isMalicious
      ? 'danger'
      : scanResult.type === 'invalid'
        ? 'warn'
        : 'safe'
    : null

  // Build external links
  let vtHref = '#'
  let abuseHref = '#'
  let showVt = false
  let showAbuse = false
  if (scanResult) {
    const { isIP, isIPv6, isHash, isURL, isDomain } = scanResult
    if (isIP || isIPv6) {
      vtHref = 'https://www.virustotal.com/gui/ip-address/' + encodeURIComponent(ip)
      abuseHref = 'https://www.abuseipdb.com/check/' + encodeURIComponent(ip)
      showVt = true
      showAbuse = true
    } else if (isHash) {
      vtHref = 'https://www.virustotal.com/gui/file/' + ip
      showVt = true
    } else if (isURL) {
      vtHref = 'https://www.virustotal.com/gui/search/' + encodeURIComponent(ip)
      showVt = true
    } else if (isDomain) {
      vtHref = 'https://www.virustotal.com/gui/domain/' + ip
      showVt = true
    }
  }

  const StatusIcon = type === 'danger' ? ShieldAlert : type === 'safe' ? ShieldCheck : AlertTriangle

  return (
    <section className="py-12" id="report-section" aria-live="polite">
      <div className="mx-auto max-w-4xl px-6 lg:px-12 relative">
        {isScanning && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="p-4 rounded-full bg-cyan-500/20 text-cyan-400 mb-4 animate-pulse shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Search size={32} />
            </div>
            <div className="text-xl font-semibold mb-2 text-white">Checking blocklists...</div>
            <div className="text-slate-400 font-mono mb-6 tracking-wider">{ip}</div>
            <div className="w-full max-w-md h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.8)]" 
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.5, ease: [0.1, 0.8, 0.3, 1] }}
              />
            </div>
          </div>
        )}

        <AnimatePresence>
          {scanResult && !isScanning && (
            <motion.div 
              className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <div className={`p-6 md:p-8 flex items-start justify-between border-b ${type === 'danger' ? 'bg-red-500/10 border-red-500/20' : type === 'safe' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${type === 'danger' ? 'bg-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : type === 'safe' ? 'bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'}`}>
                    <StatusIcon size={24} />
                  </div>
                  <div>
                    <h3 className={`font-bold tracking-wide ${type === 'danger' ? 'text-red-500' : type === 'safe' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {type === 'danger' ? 'Malicious Indicator Confirmed' : type === 'safe' ? 'Not found in active blocklists' : 'Invalid format'}
                    </h3>
                    <div className="text-xl font-mono mt-1 text-slate-200">{ip}</div>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${type === 'danger' ? 'bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : type === 'safe' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]'}`}>
                  {type === 'danger' ? 'THREAT DETECTED' : type === 'safe' ? 'NOT LISTED' : 'WARNING'}
                </div>
              </div>

              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Assessment</h4>
                  {type === 'danger' ? (
                    <p className="text-slate-300 leading-relaxed text-lg">
                      The indicator <code className="px-2 py-1 rounded bg-black/40 border border-white/10 font-mono text-red-400 shadow-inner">{ip}</code> has been positively identified as malicious by the
                      HimalayaFeed global sensor network. It is currently active in our threat intelligence blocklists.
                    </p>
                  ) : type === 'safe' ? (
                    <p className="text-slate-300 leading-relaxed text-lg">
                      The indicator <code className="px-2 py-1 rounded bg-black/40 border border-white/10 font-mono text-emerald-400 shadow-inner">{ip}</code> is <strong>not currently listed</strong> in the active
                      HimalayaFeed threat database.
                    </p>
                  ) : (
                    <p className="text-slate-300 leading-relaxed text-lg">Please enter a valid IPv4 address, Domain, SHA-256 Hash, or URL.</p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Intelligence Sources</h4>
                  <div className="space-y-3">
                    {showVt && (
                      <a href={vtHref} target="_blank" rel="noopener" className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-sm font-bold tracking-wide text-slate-300 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] group">
                        <img src="https://www.virustotal.com/gui/images/favicon.png" alt="" className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                        VirusTotal
                      </a>
                    )}
                    {showAbuse && (
                      <a href={abuseHref} target="_blank" rel="noopener" className="flex items-center gap-3 px-4 py-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-sm font-bold tracking-wide text-slate-300 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] group">
                        <AlertOctagon size={20} className="text-slate-400 group-hover:text-red-400 transition-colors duration-300" />
                        AbuseIPDB
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
