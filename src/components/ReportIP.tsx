import { useState, useEffect, useCallback, useRef } from 'react'
import { Flag, Globe, Tag, MessageSquare, Send, List, Inbox, ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react'
import supabaseClient from '../supabaseClient'
import { fmt, timeAgo } from '../utils'
import { Button } from '@/components/ui/button'

const REPORT_PAGE_SIZE = 10
const SUBMIT_COOLDOWN = 15000

export default function ReportIP({ addToast }: any) {
  const [ipValue, setIpValue] = useState('')
  const [category, setCategory] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const lastSubmitRef = useRef(0)

  // Reported IPs table state
  const [reports, setReports] = useState<any[]>([])
  const [reportCount, setReportCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(false)

  const totalPages = Math.ceil(reportCount / REPORT_PAGE_SIZE)

  const loadReportedIPs = useCallback(async (pg = 0) => {
    if (!supabaseClient) return
    const p = Math.max(0, pg)
    setPage(p)
    setLoading(true)
    setIsEmpty(false)

    const from = p * REPORT_PAGE_SIZE
    const to = from + REPORT_PAGE_SIZE - 1

    try {
      const { data, error, count } = await supabaseClient
        .from('reported_ips')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      if (!data || data.length === 0) {
        if (p === 0) {
          setIsEmpty(true)
          setReports([])
          setReportCount(0)
        } else {
          loadReportedIPs(p - 1)
          return
        }
      } else {
        setReports(data)
        setReportCount(count || 0)
        setIsEmpty(false)
      }
    } catch (err) {
      console.error('Failed to load reports:', err)
      setReports([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => loadReportedIPs(0), 500)
    return () => clearTimeout(timer)
  }, [loadReportedIPs])

  const handleSubmit = useCallback(async () => {
    if (!supabaseClient) {
      addToast('Supabase connection unavailable', 'error')
      return
    }

    const now = Date.now()
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN) {
      const remaining = Math.ceil((SUBMIT_COOLDOWN - (now - lastSubmitRef.current)) / 1000)
      addToast(`Please wait ${remaining}s before submitting again`, 'error')
      return
    }

    if (!ipValue.trim()) {
      addToast('Please enter an IP address', 'error')
      return
    }

    const isValidIP =
      /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(ipValue.trim()) ||
      (ipValue.includes(':') && /^[0-9a-fA-F:]+$/.test(ipValue.trim()))

    if (!isValidIP) {
      addToast('Please enter a valid IPv4 or IPv6 address', 'error')
      return
    }

    if (!category) {
      addToast('Please select a threat category', 'error')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabaseClient
        .from('reported_ips')
        .insert([{ ip: ipValue.trim(), category, comment: comment.trim() }])

      if (error) throw error

      lastSubmitRef.current = Date.now()
      addToast('Report submitted successfully!', 'success')
      setIpValue('')
      setCategory('')
      setComment('')
      loadReportedIPs(0)
    } catch (err: any) {
      console.error('Submit error:', err)
      addToast('Submission failed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }, [ipValue, category, comment, addToast, loadReportedIPs])

  return (
    <main className="min-h-screen pt-32 pb-20 relative bg-slate-950 overflow-hidden">
      {/* Premium Ambient Background Effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none z-0">
        <div className="absolute inset-0 bg-red-600 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute inset-20 bg-rose-500 rounded-full blur-[100px] mix-blend-screen"></div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
        {/* Page Header */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            Community Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold flex items-center justify-center gap-4 text-white tracking-tight drop-shadow-md">
            Report Malicious IP
          </h1>
          <p className="mt-6 text-slate-300 text-base md:text-lg max-w-2xl mx-auto font-medium leading-relaxed drop-shadow">
            Help strengthen our global threat intelligence by reporting suspicious IPs. Your contributions directly empower defenders worldwide.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Col: Submit Form */}
          <div className="xl:col-span-4 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
            
            <div className="space-y-6 relative z-10">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold mb-2 text-slate-300" htmlFor="rip-ip-input">
                  <Globe size={16} className="text-red-400" /> IP Address
                </label>
                <input
                  type="text"
                  id="rip-ip-input"
                  className="w-full flex h-14 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:border-red-500/50 focus-visible:ring-red-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-inner"
                  placeholder="e.g. 192.168.1.1"
                  autoComplete="off"
                  spellCheck="false"
                  value={ipValue}
                  onChange={(e) => setIpValue(e.target.value)}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold mb-2 text-slate-300" htmlFor="rip-category">
                  <Tag size={16} className="text-rose-400" /> Category
                </label>
                <select
                  id="rip-category"
                  className="w-full flex h-14 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:border-rose-500/50 focus-visible:ring-rose-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all appearance-none shadow-inner"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="" disabled>Select threat category...</option>
                  <option value="Brute Force">Brute Force</option>
                  <option value="Port Scan">Port Scan</option>
                  <option value="Phishing">Phishing</option>
                  <option value="Malware / C2">Malware / C2</option>
                  <option value="DDoS">DDoS</option>
                  <option value="Spam">Spam</option>
                  <option value="Exploit Attempt">Exploit Attempt</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold mb-2 text-slate-300" htmlFor="rip-comment">
                  <MessageSquare size={16} className="text-orange-400" /> Comment
                </label>
                <textarea
                  id="rip-comment"
                  className="flex min-h-[120px] w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all shadow-inner"
                  rows={4}
                  placeholder="Describe the suspicious activity..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                ></textarea>
              </div>

              <Button
                className="w-full h-14 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-base shadow-[0_0_20px_rgba(225,29,72,0.3)] hover:shadow-[0_0_25px_rgba(225,29,72,0.5)] transition-all border border-red-500/20 mt-4"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send size={18} /> Submit Report
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Right Col: Reported IPs Table */}
          <div className="xl:col-span-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative">
            <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
            
            {/* Table Header Section */}
            <div className="p-6 md:px-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <h3 className="font-bold text-xl flex items-center gap-3 text-white">
                <List className="text-slate-400" size={20} /> 
                Recent Community Reports
              </h3>
              <div className="hidden sm:flex text-sm text-slate-300 font-bold bg-black/40 px-4 py-2 rounded-full border border-white/10 shadow-inner items-center gap-2">
                <ShieldAlert size={16} className="text-red-400"/>
                {reportCount > 0 ? `${fmt(reportCount)} Total Reports` : 'Syncing...'}
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              {loading ? (
                <div className="p-20 flex flex-col items-center justify-center text-slate-400">
                  <span className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-red-500 mb-6" />
                  <p className="font-medium tracking-wide">Loading threat intel database...</p>
                </div>
              ) : isEmpty ? (
                <div className="p-24 flex flex-col items-center justify-center text-slate-500 text-center">
                  <Inbox size={56} className="mb-6 opacity-20" />
                  <p className="text-xl font-semibold text-slate-300 mb-2">No reports yet.</p>
                  <p className="text-sm">Be the first to submit a malicious IP to the global database!</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-black/20 text-slate-400 font-semibold border-b border-white/5">
                    <tr>
                      <th className="px-6 py-5 tracking-widest whitespace-nowrap">IP Address</th>
                      <th className="px-6 py-5 tracking-widest whitespace-nowrap">Category</th>
                      <th className="px-6 py-5 tracking-widest">Comment</th>
                      <th className="px-6 py-5 tracking-widest whitespace-nowrap text-right">Reported</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {reports.map((row) => (
                      <tr key={row.id || row.created_at} className="hover:bg-white/[0.03] transition-colors group">
                        <td className="px-6 py-5 font-mono font-medium text-slate-200 whitespace-nowrap">
                          {row.ip}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold tracking-wider uppercase bg-white/5 text-slate-300 border border-white/10 shadow-sm group-hover:border-white/20 transition-colors">
                            {row.category}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-slate-400 truncate max-w-[200px] sm:max-w-xs font-medium" title={row.comment || ''}>
                          {row.comment || '—'}
                        </td>
                        <td className="px-6 py-5 text-slate-400 whitespace-nowrap font-medium text-right">
                          {timeAgo(row.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && !loading && !isEmpty && (
              <div className="p-4 md:px-8 border-t border-white/10 flex items-center justify-between bg-white/[0.02]">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-black/20 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-lg px-5 transition-all"
                  onClick={() => loadReportedIPs(page - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft size={16} className="mr-1" /> Prev
                </Button>
                <span className="text-sm text-slate-400 font-semibold tracking-wide">
                  Page <span className="text-white">{page + 1}</span> of <span className="text-white">{totalPages}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-black/20 border-white/10 text-white hover:bg-white/10 hover:text-white rounded-lg px-5 transition-all"
                  onClick={() => loadReportedIPs(page + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
