import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bug, ShieldCheck, AlertTriangle, AlertOctagon, ChevronRight, Search, Check, ShieldAlert } from 'lucide-react'
import DOMPurify from 'dompurify'
import supabaseClient from '../supabaseClient'
import { timeAgo, getCategoryIconPath, normalizeTags } from '../utils'
import { useAuth } from '../AuthContext'
import Loader from './ui/loader'
import { getMalwareDescription } from '../malwareDictionary'

const getCategoryColor = (cat: string) => {
  if (!cat) return 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
  const c = cat.toLowerCase()
  if (c.includes('brute') || c.includes('force')) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
  if (c.includes('malware') || c.includes('exploit') || c.includes('zero-day')) return 'bg-destructive/10 text-destructive border border-destructive/20'
  if (c.includes('ddos')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
  if (c.includes('phish') || c.includes('harvest')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
  if (c.includes('scan') || c.includes('recon')) return 'bg-primary/10 text-primary border border-primary/20'
  if (c.includes('botnet') || c.includes('c2')) return 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
  return 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
}

function MalwareDescriptionBlock({ tag }: { tag: string }) {
  const desc = getMalwareDescription(tag) || getMalwareDescription('Malware');

  if (!desc) return null;
  
  return (
    <div className="mt-5 p-4 rounded-xl bg-slate-950/40 border border-rose-500/10 shadow-inner">
      <div className="flex items-start gap-3">
        <div className="bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20 shrink-0 mt-0.5">
          <img src={`${import.meta.env.BASE_URL}img/malware.png`} className="w-4 h-4 object-contain drop-shadow-sm" alt="Malware Icon" />
        </div>
        <div>
          <h4 className="text-slate-200 font-bold text-sm tracking-tight flex items-center gap-2">
            {tag} 
          </h4>
          <p className="text-slate-400 text-sm mt-1 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  )
}

export default function ReportScanner({ scanResult, isScanning, showReport, scanInput, addToast }: any) {
  const [reports, setReports] = useState<any[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  const [ipInfo, setIpInfo] = useState<any>(null)
  const [loadingIpInfo, setLoadingIpInfo] = useState(false)
  const [isDisputing, setIsDisputing] = useState(false)
  const [showDisputeForm, setShowDisputeForm] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')

  const { user } = useAuth()

  const ip = scanResult?.ip || scanInput?.trim() || ''
  const isMalicious = scanResult?.isMalicious
  const isDisputed = scanResult?.isDisputed

  const type = scanResult
    ? isMalicious
      ? 'danger'
      : isDisputed
        ? 'disputed'
        : scanResult.type === 'invalid'
          ? 'warn'
          : 'safe'
    : null

  useEffect(() => {
    if (scanResult && (scanResult.isIP || scanResult.isIPv6 || scanResult.isDomain) && ip) {
      setLoadingReports(true)

      supabaseClient
        .from('reported_ips')
        .select('*')
        .eq('ip', ip)
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => {
          if (data) setReports(data)
          setLoadingReports(false)
        })
        .catch(() => setLoadingReports(false))

      if (scanResult.isIP || scanResult.isIPv6) {
        setLoadingIpInfo(true)
        fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`)
          .then(r => r.json())
          .then(data => {
            if (data && data.ip) {
              setIpInfo({
                country: data.country,
                city: data.city,
                isp: data.organization_name || data.organization,
                asn: data.asn ? `AS${data.asn}` : null,
                country_flag: data.country_code ? `https://flagcdn.com/w20/${data.country_code.toLowerCase()}.png` : null
              })
            } else {
              setIpInfo(null)
            }
            setLoadingIpInfo(false)
          })
          .catch((err) => {
            console.error("IP lookup failed:", err);
            setIpInfo(null)
            setLoadingIpInfo(false)
          })
      } else {
        setLoadingIpInfo(false)
        setIpInfo(null)
      }
    } else {
      setReports([])
      setIpInfo(null)
    }
  }, [scanResult, ip])

  // Build external links
  let abuseHref = '#'
  let showAbuse = false
  if (scanResult) {
    const { isIP, isIPv6, isDomain } = scanResult
    if (isIP || isIPv6 || isDomain) {
      abuseHref = 'https://www.whois.com/whois/' + encodeURIComponent(ip)
      showAbuse = true
    }
  }

  const handleDispute = async () => {
    if (!user) return addToast('Please sign in to report a false positive.', 'error')
    if (!supabaseClient) return addToast('Database connection unavailable.', 'error')
    if (!disputeReason.trim()) return addToast('Please provide a reason.', 'error')
    if (disputeReason.length > 500) return addToast('Reason must be under 500 characters.', 'error')

    setIsDisputing(true)
    try {
      const alias = user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0]
      const safeReason = DOMPurify.sanitize(disputeReason.trim())
      const { error } = await supabaseClient.from('disputes').insert([{
        ip,
        reporter_alias: alias,
        reason: safeReason
      }])

      if (error) {
        if (error.code === '23505') {
          addToast('You have already disputed this indicator.', 'error')
        } else {
          throw error
        }
      } else {
        addToast('False positive report submitted! Thank you for helping the community.', 'success')
        setShowDisputeForm(false)
        setDisputeReason('')
      }
    } catch (err: any) {
      console.error(err)
      addToast('Failed to submit dispute: ' + err.message, 'error')
    } finally {
      setIsDisputing(false)
    }
  }



  const StatusIcon = type === 'danger' ? Bug : type === 'safe' ? ShieldCheck : type === 'disputed' ? ShieldAlert : AlertTriangle

  if (!showReport) return null;

  return (
    <section className="py-12" id="report-section" aria-live="polite">
      <div className="mx-auto max-w-5xl px-6 lg:px-12 relative">
        <AnimatePresence mode="wait">
          {isScanning ? (
            <motion.div 
              key="scanning"
              className="w-full min-h-[420px] flex flex-col items-center justify-center p-8 relative overflow-visible"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
            >
              {/* Subtle radial gradient background */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50 pointer-events-none"></div>

              {/* Gooey Loader Animation */}
              <div className="mb-6 mt-4 flex justify-center items-center">
                <div className="scale-50 transform origin-center">
                  <Loader />
                </div>
              </div>

              <div className="z-10 flex flex-col items-center mt-2">
                <div className="flex items-center gap-2 mb-3">
                  <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--tw-colors-primary)]" />
                  <span className="text-xs font-bold text-slate-300 tracking-[0.25em] uppercase drop-shadow-md">Scanning Target</span>
                </div>
                <div className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-white mb-6 drop-shadow-lg break-all text-center px-4 max-w-full">{ip}</div>
              </div>
            </motion.div>
          ) : scanResult ? (
            <motion.div
              key="results-container"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="w-full space-y-12"
            >
              {/* Scan Result Card */}
              <div className="w-full max-w-4xl bg-slate-900/60 backdrop-blur-xl border border-slate-800 shadow-2xl rounded-2xl mx-auto overflow-hidden font-sans relative">
                {/* Glow effect */}
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                
                {/* Header Section */}
                <div className="p-5 md:p-6 border-b border-slate-800 bg-slate-900/40">
                  <div className="flex items-start gap-4 mb-4">
                    <img src={`${import.meta.env.BASE_URL}img/logo.png`} className="w-10 h-10 rounded-full shadow-sm border border-white/5 shrink-0" alt="Threatbase Logo" />
                    <div>
                      <h3 className={`text-xl md:text-2xl font-bold tracking-tight mb-3 ${type === 'danger' ? 'text-rose-400' : type === 'safe' ? 'text-primary' : 'text-orange-400'}`}>
                        {type === 'danger' ? 'Threat found in our database' : type === 'safe' ? 'No threat found in our database' : 'This indicator is currently disputed'}
                      </h3>
                      <div className="inline-block bg-slate-950/80 border border-white/5 rounded-xl px-4 py-2.5 font-mono text-sm md:text-base text-slate-300 break-all shadow-inner relative overflow-hidden">
                        {ip}
                      </div>
                    </div>
                  </div>

                  {scanResult && (scanResult.isIP || scanResult.isIPv6 || scanResult.isDomain) && (
                    <>
                      <div className="flex items-center justify-between mt-2 text-sm font-semibold text-slate-400">
                        <span>Confidence of Abuse is {type === 'danger' ? '100%' : '0%'}:</span>
                        <span className="cursor-help font-bold text-slate-500 hover:text-slate-300 transition-colors bg-slate-800/50 rounded-full w-5 h-5 flex items-center justify-center text-xs" title="Confidence of Abuse score">?</span>
                      </div>
                      <div className="w-full bg-slate-950/50 h-6 mt-3 flex items-center rounded-lg overflow-hidden border border-slate-800 shadow-inner">
                        <div 
                          className={`h-full ${type === 'danger' ? 'bg-rose-500' : 'bg-primary'} flex items-center px-3 transition-all duration-1000 relative`} 
                          style={{ width: type === 'danger' ? '100%' : '10%' }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 pointer-events-none"></div>
                          <span className="text-white text-xs font-bold drop-shadow-sm relative z-10">{type === 'danger' ? '100%' : '0%'}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Malicious subnet (CIDR range) match */}
                  {type === 'danger' && scanResult?.matchedCidr && (
                    <div className="mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                      <ShieldAlert size={18} className="text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Listed via malicious subnet{' '}
                        <span className="font-mono font-bold text-rose-300 break-all">{scanResult.matchedCidr}</span>.
                        This address falls inside a range flagged by threat-intelligence feeds (e.g. Spamhaus, FireHOL).
                      </p>
                    </div>
                  )}

                  {/* Threat Tags and Severity */}
                  {type === 'danger' && (scanResult?.tags?.length > 0 || scanResult?.riskScore) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-4 pt-4 border-t border-slate-800/50">
                      {scanResult?.riskScore && scanResult.riskScore !== 'Low' && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Severity:</span>
                          <span className={`px-2.5 py-0.5 rounded text-xs font-bold shadow-sm ${
                            scanResult.riskScore.toLowerCase() === 'high' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                            scanResult.riskScore.toLowerCase() === 'medium' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          }`}>
                            {scanResult.riskScore}
                          </span>
                        </div>
                      )}
                      
                      {scanResult?.tags && scanResult.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Known Threats:</span>
                          {scanResult.tags.map((tag: string) => (
                            <span key={tag} className="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-bold shadow-sm flex items-center gap-1.5">
                              <img src={getCategoryIconPath(tag)} className="w-3.5 h-3.5 object-contain opacity-90" alt="Threat Icon" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Malware Descriptions */}
                  {type === 'danger' && scanResult?.tags?.length > 0 && (
                    <div className="flex flex-col">
                      {scanResult.tags.map((tag: string) => (
                        <MalwareDescriptionBlock key={`desc-${tag}`} tag={tag} />
                      ))}
                    </div>
                  )}

                  {/* Hash Simple Text */}
                  {type === 'danger' && scanResult?.isHash && (
                    <p className="mt-5 text-slate-300 text-sm leading-relaxed font-medium">This is a malicious hash found in our feed.</p>
                  )}
                </div>

                {/* Body / Table Section */}
                {scanResult && (scanResult.isIP || scanResult.isIPv6 || scanResult.isDomain) && (
                  <div className="bg-transparent">
                    <table className="w-full text-sm text-left border-collapse">
                      <tbody className="divide-y divide-slate-800/50">
                        {scanResult.isDomain ? (
                          <tr className="hover:bg-slate-800/20 transition-colors">
                            <td className="py-3.5 px-5 md:px-6 font-bold text-slate-400 w-[35%] bg-slate-900/20 border-r border-slate-800/50">Domain Name</td>
                            <td className="py-3.5 px-5 md:px-6 text-slate-200 font-medium break-all">{ip}</td>
                          </tr>
                        ) : (
                          <>
                            {(loadingIpInfo || ipInfo?.isp) && (
                              <tr className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-3.5 px-5 md:px-6 font-bold text-slate-400 w-[35%] bg-slate-900/20 border-r border-slate-800/50">ISP</td>
                                <td className="py-3.5 px-5 md:px-6 text-slate-200 font-medium">{loadingIpInfo ? 'Loading...' : ipInfo.isp}</td>
                              </tr>
                            )}
                            {(loadingIpInfo || ipInfo?.asn) && (
                              <tr className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-3.5 px-5 md:px-6 font-bold text-slate-400 w-[35%] bg-slate-900/20 border-r border-slate-800/50">ASN</td>
                                <td className="py-3.5 px-5 md:px-6 text-slate-200 font-mono text-xs">{loadingIpInfo ? 'Loading...' : ipInfo.asn}</td>
                              </tr>
                            )}
                            {(loadingIpInfo || ipInfo?.country) && (
                              <tr className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-3.5 px-5 md:px-6 font-bold text-slate-400 w-[35%] bg-slate-900/20 border-r border-slate-800/50">Country</td>
                                <td className="py-3.5 px-5 md:px-6 text-slate-200 font-medium flex items-center gap-2.5">
                                  {ipInfo?.country_flag && <img src={ipInfo.country_flag} className="w-5 shadow-sm rounded-sm object-cover border border-white/10" alt="Flag" />}
                                  {loadingIpInfo ? 'Loading...' : ipInfo.country}
                                </td>
                              </tr>
                            )}
                            {(loadingIpInfo || ipInfo?.city) && (
                              <tr className="hover:bg-slate-800/20 transition-colors">
                                <td className="py-3.5 px-5 md:px-6 font-bold text-slate-400 w-[35%] bg-slate-900/20 border-r border-slate-800/50">City</td>
                                <td className="py-3.5 px-5 md:px-6 text-slate-200 font-medium">{loadingIpInfo ? 'Loading...' : ipInfo.city}</td>
                              </tr>
                            )}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer Section */}
                {((scanResult && (scanResult.isIP || scanResult.isIPv6 || scanResult.isDomain)) || (!scanResult?.isHash || showAbuse)) && (
                  <div className="p-5 md:p-6 bg-slate-900/60 border-t border-slate-800">
                    {scanResult && (scanResult.isIP || scanResult.isIPv6) && (
                      <p className="text-xs text-slate-500 italic mb-5 font-medium tracking-wide">
                        IP info including ISP, Usage Type, and Location provided by Threatbase. Updated weekly.
                      </p>
                    )}
                    {scanResult && scanResult.isDomain && (
                      <p className="text-xs text-slate-500 italic mb-5 font-medium tracking-wide">
                        Domain information provided by Threatbase.
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3">
                      {!scanResult?.isHash && (
                        <button 
                          onClick={() => setShowDisputeForm(true)}
                          className="flex-1 bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-sm uppercase tracking-wider border border-slate-700/50 hover:border-slate-600"
                        >
                          REPORT FALSE POSITIVE
                        </button>
                      )}
                      {showAbuse && (
                        <a 
                          href={abuseHref} 
                          target="_blank" 
                          rel="noopener" 
                          className="flex-1 bg-white/10 hover:bg-white/15 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all shadow-sm uppercase tracking-wider text-center border border-white/5 hover:border-white/10"
                        >
                          WHOIS {ip}
                        </a>
                      )}
                    </div>

                    {/* Dispute Form */}
                    {showDisputeForm && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-5 pt-5 border-t border-slate-800 overflow-hidden">
                        <h5 className="text-sm font-bold text-slate-300 mb-3">Why is this a false positive? <span className="text-rose-400">*</span></h5>
                        <textarea
                          value={disputeReason}
                          onChange={e => setDisputeReason(e.target.value)}
                          className="w-full bg-slate-950/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 resize-none transition-all shadow-inner"
                          rows={3}
                          placeholder="Please provide details (e.g. 'This is a public DNS resolver', 'Internal proxy')..."
                        ></textarea>
                        <div className="flex items-center gap-3 mt-4 justify-end">
                          <button onClick={() => setShowDisputeForm(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider rounded-lg hover:bg-slate-800/50">Cancel</button>
                          <button onClick={handleDispute} disabled={isDisputing} className="px-5 py-2.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50 uppercase tracking-wider">
                            {isDisputing ? 'Submitting...' : 'Submit Dispute'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {loadingReports ? (
                <div
                  className="w-full flex flex-col items-center justify-center py-20 bg-slate-900 rounded-2xl border border-slate-800"
                >
                  <div className="relative h-8 w-8 mb-4">
                    <div className="absolute inset-0 rounded-full border border-slate-800"></div>
                    <div className="absolute inset-0 rounded-full border border-slate-500 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="font-semibold tracking-wider text-[10px] text-slate-500 uppercase">Fetching community reports...</p>
                </div>
              ) : reports.length > 0 ? (
                <div className="w-full space-y-6">
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-tight mb-2">
                      Community Reports for <span className="bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent font-mono break-all inline-block">{ip}</span>
                    </h3>
                    <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium">
                      This IP address has been reported <span className="text-white font-bold">{reports.length.toLocaleString()}</span> times. First reported on <span className="text-slate-300 font-medium">{new Date(reports[reports.length - 1].created_at || Date.now()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>, with the most recent report from <span className="text-slate-300 font-medium">{timeAgo(reports[0].created_at || new Date().toISOString())}</span>.
                    </p>
                  </div>

                  <div className="relative overflow-hidden bg-slate-900 border border-slate-800 border-l-2 border-l-orange-500 px-6 py-5 rounded-xl shadow-sm font-elegant">
                    <div className="space-y-1.5 relative z-10">
                      <strong className="text-orange-500 block text-[11px] uppercase tracking-widest font-bold">Active Threat Warning</strong>
                      <p className="text-slate-300 leading-relaxed text-xs">
                        Abusive activity was reported from this address within the past week. It may still be actively engaged in hostile operations.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left block md:table">
                        <thead className="hidden md:table-header-group text-[10px] uppercase bg-slate-950 text-slate-400 font-bold border-b border-slate-800 tracking-widest">
                          <tr>
                            <th className="px-6 py-5 w-[20%]">Reporter</th>
                            <th className="px-6 py-5 w-[25%]">
                              <div className="flex items-center gap-1.5">
                                IoA Timestamp (UTC)
                                <span className="text-primary text-[9px] font-bold bg-primary/10 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center cursor-help" title="Indicator of Attack timestamp">?</span>
                              </div>
                            </th>
                            <th className="px-6 py-5 w-[35%]">Comment</th>
                            <th className="px-6 py-5 text-right w-[20%]">Categories</th>
                          </tr>
                        </thead>
                        <tbody className="block md:table-row-group p-4 md:p-0 space-y-4 md:space-y-0 md:divide-y md:divide-slate-800">
                          {reports.map((row, idx) => {
                            const createdAt = row.created_at || new Date().toISOString();
                            const reporter = row.reporter_alias || 'Anonymous';
                            const comment = row.comment || 'No context provided.';
                            const categories = (row.category || 'Other').split(', ');

                            return (
                              <tr key={idx} className="block md:table-row bg-slate-950 md:bg-transparent hover:bg-slate-800/50 transition-colors group border border-slate-800 md:border-0 rounded-xl md:rounded-none p-4 md:p-0">
                                <td className="block md:table-cell px-0 py-1 md:px-6 md:py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Check size={14} className="text-primary shrink-0" strokeWidth={2.5} />
                                    <span className="font-bold text-slate-300">@{reporter}</span>
                                  </div>
                                </td>
                                <td className="block md:table-cell px-0 py-1 md:px-6 md:py-4 whitespace-nowrap text-slate-400">
                                  <div className="flex items-center gap-2 md:block">
                                    <div>{createdAt.replace('T', ' ').substring(0, 19)}</div>
                                    <div className="text-[10px] text-slate-500 font-medium md:mt-1">({timeAgo(createdAt)})</div>
                                  </div>
                                </td>
                                <td className="block md:table-cell px-0 py-3 md:px-6 md:py-4 text-slate-300 md:max-w-[300px] border-t border-b border-slate-800 md:border-0 my-3 md:my-0">
                                  <div className="leading-relaxed font-medium md:line-clamp-2" title={comment}>{comment}</div>
                                </td>
                                <td className="block md:table-cell px-0 py-1 md:px-6 md:py-4 text-right">
                                  <div className="flex flex-wrap md:justify-end gap-1.5 pt-1 md:pt-0">
                                    {categories.map((cat: string) => (
                                      <span key={cat} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${getCategoryColor(cat)}`}>
                                        <img src={getCategoryIconPath(cat)} alt={cat} className="w-3 h-3 object-contain drop-shadow-sm" />
                                        {cat}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  )
}


