import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, Copy, Check, ChevronLeft, ChevronRight, HelpCircle, Users, ShieldCheck, ListFilter
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthComponent } from '@/components/ui/sign-up'
import supabaseClient from '../supabaseClient'
import { fmt, timeAgo, getAvatarForName, getCategoryIconPath } from '../utils'
import { useAuth } from '../AuthContext'
import { useSEO } from '@/useSEO'
import DOMPurify from 'dompurify'
import { DNS_WHITELIST_CIDRS, PRIVATE_RESERVED_CIDRS, inCidr, isPrivateReservedIpv6 } from '@/lib/ipValidation'

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PageShell from './layout/PageShell'
import Container from './layout/Container'

const REPORT_PAGE_SIZE = 10
const SUBMIT_COOLDOWN = 15000

const THREAT_CATEGORIES = [
  { value: 'malware', label: 'Malware Distribution' },
  { value: 'phishing', label: 'Phishing' },
  { value: 'spam', label: 'Spam' },
  { value: 'ddos', label: 'DDoS Attack' },
  { value: 'brute-force', label: 'Brute Force' },
  { value: 'scanning', label: 'Port Scanning' },
  { value: 'botnet', label: 'Botnet' },
  { value: 'other', label: 'Other' },
];

const CommentCell = ({ comment }: { comment: string }) => {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 100;

  if (!comment) return <span className="text-slate-500 italic">No comment provided</span>;
  
  if (comment.length <= maxLength) {
    return <div className="whitespace-pre-wrap break-words leading-relaxed text-slate-300 font-elegant text-[13px] tracking-wide">{comment}</div>;
  }

  return (
    <div className="whitespace-pre-wrap break-words leading-relaxed text-slate-300 font-elegant text-[13px] tracking-wide">
      {expanded ? comment : `${comment.substring(0, maxLength).trim()}...`}
      <div className="text-right mt-1">
        <button 
          onClick={() => setExpanded(!expanded)} 
          className="text-[#3b82f6] hover:underline text-[11px] font-sans font-medium"
        >
          {expanded ? 'show less' : 'show more'}
        </button>
      </div>
    </div>
  );
};

export default function ReportIP({ addToast }: any) {
  const { user, profile, signInWithGoogle } = useAuth()
  useSEO({
    title: 'Report Malicious IP — Threatbase Community Intel',
    description: 'Submit malicious IP addresses to the Threatbase community intelligence feed. Help defend networks globally by reporting threats, malware, phishing, DDoS attacks, and more.',
    path: '/report',
  })
  const [ipValue, setIpValue] = useState('')
  const [category, setCategory] = useState('')
  const [comment, setComment] = useState('')
  const [alias, setAlias] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const lastSubmitRef = useRef(0)

  // Reported IPs table state
  const [reports, setReports] = useState<any[]>([])
  const [reportCount, setReportCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isEmpty, setIsEmpty] = useState(false)
  const [copiedIp, setCopiedIp] = useState<string | null>(null)
  
  // Edit State
  const [editingRowId, setEditingRowId] = useState<number | null>(null)
  const [editComment, setEditComment] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const totalPages = Math.ceil(reportCount / REPORT_PAGE_SIZE)

  // Real-time IP validation
  const [ipStatus, setIpStatus] = useState<{ type: 'empty' | 'valid_v4' | 'valid_v6' | 'private' | 'whitelisted' | 'invalid', msg: string }>({ type: 'empty', msg: '' })

  useEffect(() => {
    if (profile?.username) {
      setAlias(profile.username)
    } else if (user) {
      const fallback = user.user_metadata?.custom_claims?.global_name || user.email?.split('@')[0] || ''
      setAlias(fallback.replace(/[^a-zA-Z0-9_-]/g, ''))
    }
  }, [profile, user])

  useEffect(() => {
    const raw = ipValue.trim()
    if (!raw) {
      setIpStatus({ type: 'empty', msg: '' })
      return
    }

    const isV4 = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(raw)
    const isV6 = raw.includes(':') && /^[0-9a-fA-F:]+$/.test(raw)

    if (isV4 || isV6) {
      let isPrivate = false
      let isWhitelisted = false
      let whitelistProvider = ''

      if (isV4) {
        for (const cidr of PRIVATE_RESERVED_CIDRS) {
          if (inCidr(raw, cidr)) {
            isPrivate = true; break;
          }
        }
        for (const cidr of DNS_WHITELIST_CIDRS) {
          if (inCidr(raw, cidr)) {
            isWhitelisted = true;
            whitelistProvider = "DNS Provider";
            break;
          }
        }
      } else if (isV6) {
        isPrivate = isPrivateReservedIpv6(raw)
      }

      if (isWhitelisted) {
        setIpStatus({ type: 'whitelisted', msg: `Whitelisted IP detected (${whitelistProvider}). Submissions blocked.` })
      } else if (isPrivate) {
        setIpStatus({ type: 'private', msg: 'Private/Reserved range warning.' })
      } else {
        setIpStatus({ type: isV4 ? 'valid_v4' : 'valid_v6', msg: `Verified ${isV4 ? 'IPv4' : 'IPv6'} address.` })
      }
    } else {
      setIpStatus({ type: 'invalid', msg: 'Valid IPv4 or IPv6 required.' })
    }
  }, [ipValue])

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
          setIsEmpty(true); setReports([]); setReportCount(0)
        } else {
          loadReportedIPs(p - 1)
        }
      } else {
        setReports(data); setReportCount(count || 0); setIsEmpty(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseClient) return addToast('Supabase connection unavailable', 'error')

    const now = Date.now()
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN) {
      const remaining = Math.ceil((SUBMIT_COOLDOWN - (now - lastSubmitRef.current)) / 1000)
      return addToast(`Wait ${remaining}s before submitting again`, 'error')
    }

    if (!ipValue.trim() || !category || !comment.trim()) {
      return addToast('Please fill all required fields', 'error')
    }

    // Input sanitization and secure coding constraints
    const raw = ipValue.trim()
    const rawComment = comment.trim()
    const rawAlias = alias.trim()

    if (rawComment.length > 1000) {
      return addToast('Comment is too long (max 1000 characters)', 'error')
    }
    
    if (rawAlias.length > 50) {
      return addToast('Alias is too long (max 50 characters)', 'error')
    }

    const canSubmit = ipStatus.type === 'valid_v4' || ipStatus.type === 'valid_v6'
    
    if (!canSubmit) {
      return addToast('Submission blocked due to invalid or private IP', 'error')
    }

    setSubmitting(true)

    // Translate value back to label for database consistency
    const catLabel = THREAT_CATEGORIES.find(c => c.value === category)?.label || category
    
    // Sanitize user inputs before insertion
    const safeComment = DOMPurify.sanitize(rawComment)
    const safeAlias = DOMPurify.sanitize(rawAlias)

    try {
      const { data: existingReport } = await supabaseClient
        .from('reported_ips')
        .select('id')
        .eq('ip', raw)
        .eq('reporter_alias', safeAlias || '')
        .maybeSingle()

      if (existingReport) {
        setSubmitting(false)
        return addToast('You have already reported this IP. You can edit your existing report in the feed below.', 'error')
      }

      const { error } = await supabaseClient
        .from('reported_ips')
        .insert([{ ip: raw, category: catLabel, comment: safeComment, reporter_alias: safeAlias || null }])

      if (error) throw error

      lastSubmitRef.current = Date.now()
      setSubmitSuccess(true)
      setIpValue('')
      setCategory('')
      setComment('')
      loadReportedIPs(0)
      
      setTimeout(() => {
        setSubmitSuccess(false)
      }, 3000)
    } catch (err: any) {
      addToast('Submission failed: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveEdit = async (id: number) => {
    if (!supabaseClient) return addToast('Supabase connection unavailable', 'error')
    if (!editComment.trim()) return addToast('Comment cannot be empty', 'error')
    if (editComment.trim().length > 1000) return addToast('Comment is too long (max 1000 characters)', 'error')

    setIsSavingEdit(true)
    try {
      const safeComment = DOMPurify.sanitize(editComment.trim())
      const { data, error } = await supabaseClient
        .from('reported_ips')
        .update({ comment: safeComment })
        .eq('id', id)
        .select()
        
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Update affected 0 rows. Check Supabase RLS policies.')
      }
      
      addToast('Comment updated successfully!', 'success')
      setEditingRowId(null)
      loadReportedIPs(page)
    } catch (err: any) {
      addToast('Failed to update comment: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip)
    setCopiedIp(ip)
    addToast(`Copied ${ip} to clipboard!`, 'success')
    setTimeout(() => setCopiedIp(null), 1500)
  }

  const getCategoryColor = (cat: string) => {
    if (!cat) return 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
    if (cat.includes('Brute') || cat.includes('Force')) return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
    if (cat.includes('Malware')) return 'bg-destructive/10 text-destructive border border-destructive/20'
    if (cat.includes('DDoS')) return 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
    if (cat.includes('Phish')) return 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
    if (cat.includes('Scan')) return 'bg-primary/10 text-primary border border-primary/20'
    return 'bg-slate-500/10 text-slate-300 border border-slate-500/20'
  }

  const isFormValid = () => {
    return ipValue.trim() !== "" && category !== "" && comment.trim() !== "" && (ipStatus.type === 'valid_v4' || ipStatus.type === 'valid_v6');
  }

  return (
    <PageShell>
        <Container width="wide" className="relative z-10 space-y-10">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="text-center relative max-w-3xl mx-auto"
          >
            <h1 className="text-5xl md:text-7xl font-space font-extrabold tracking-tighter text-white leading-[1.1] drop-shadow-2xl">
              Report a <br className="hidden sm:block" />
              <span className="text-liquid-red font-righteous tracking-wide">
                Malicious IP
              </span>
            </h1>

            <p className="mt-5 text-slate-400 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              Every verified submission strengthens the global blocklist — defending networks,
              tracking threat actors, and exposing malicious infrastructure.
            </p>


          </motion.div>

          <motion.div
            className="max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
          >
            <div>
              {!user ? (
                <div className="flex justify-center w-full my-8">
                  <AuthComponent />
                </div>
              ) : (
              <Card className="relative overflow-hidden border-white/[0.08] bg-slate-950/50 backdrop-blur-2xl shadow-[0_24px_70px_-20px_rgba(0,0,0,0.7)] rounded-3xl">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <CardHeader className="border-b border-white/[0.06] pb-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-destructive/20 to-destructive/5 rounded-2xl border border-destructive/20">
                      <img src={`${import.meta.env.BASE_URL}img/report.png`} alt="Report" className="w-7 h-7 object-contain invert opacity-90" />
                    </div>
                    <div>
                      <CardTitle className="text-xl md:text-2xl text-white tracking-tight">Submit Malicious IP</CardTitle>
                      <CardDescription className="text-slate-400 mt-0.5">
                        Provide the indicator and supporting evidence
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="ipAddress" className="text-sm font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
                          IP Address <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="ipAddress"
                            placeholder="e.g., 203.0.113.45"
                            value={ipValue}
                            onChange={(e) => setIpValue(e.target.value)}
                            className="h-12 bg-black/30 border-white/10 text-white font-mono placeholder:text-slate-600 placeholder:font-sans pr-11 focus-visible:ring-primary/40 focus-visible:border-primary/40 transition-colors"
                          />
                          {ipStatus.type !== 'empty' && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
                              {ipStatus.type === 'valid_v4' || ipStatus.type === 'valid_v6'
                                ? <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
                                : <AlertTriangle className="h-4 w-4 text-destructive" />}
                            </span>
                          )}
                        </div>
                        {ipStatus.msg && ipStatus.type !== 'empty' && (
                          <p className={`text-xs mt-1.5 font-medium ${ipStatus.type === 'valid_v4' || ipStatus.type === 'valid_v6' ? 'text-emerald-400' : 'text-destructive'}`}>
                            {ipStatus.msg}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-sm font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
                          Threat Category <span className="text-destructive">*</span>
                        </Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger id="category" className="h-12 bg-black/30 border-white/10 text-white focus:ring-primary/40">
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-white/10">
                            {THREAT_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value} className="text-slate-200 focus:bg-white/10">
                                <div className="flex items-center gap-2">
                                  <img src={`${import.meta.env.BASE_URL}img/${cat.value === 'scanning' ? 'other' : cat.value.replace('-', '')}.png`} alt={cat.label} className="w-4 h-4 object-contain drop-shadow-sm" onError={(e) => { e.currentTarget.src = `${import.meta.env.BASE_URL}img/other.png` }} />
                                  {cat.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="comment" className="text-sm font-semibold text-slate-200 tracking-wide flex items-center gap-1.5">
                            Description / Evidence <span className="text-destructive">*</span>
                          </Label>
                          <span className="text-[11px] tabular-nums text-slate-600">{comment.length}/1000</span>
                        </div>
                        <Textarea
                          id="comment"
                          placeholder="Describe the malicious activity — observed behaviour, timestamps, ports, or log excerpts."
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          maxLength={1000}
                          className="min-h-[120px] resize-none bg-black/30 border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-primary/40 focus-visible:border-primary/40 transition-colors leading-relaxed"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="contributorName" className="text-sm font-semibold text-slate-300 tracking-wide">
                          Your Alias
                        </Label>
                        <Input
                          id="contributorName"
                          placeholder="Anonymous"
                          value={alias}
                          readOnly
                          className="h-12 bg-black/20 border-white/[0.06] text-slate-400 font-mono cursor-not-allowed focus-visible:ring-0"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Locked to your profile username — change it in your <Link to={profile?.username ? `/u/${profile.username}` : "/profile"} className="text-blue-400 hover:underline font-semibold">Profile Settings</Link>.
                        </p>
                      </div>

                      <div className="pt-2 flex flex-col gap-3">
                        <Button
                          type="submit"
                          disabled={!isFormValid() || submitting}
                          className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-slate-200 rounded-xl shadow-[0_8px_30px_-8px_rgba(255,255,255,0.25)] transition-all hover:shadow-[0_8px_36px_-6px_rgba(255,255,255,0.35)] disabled:shadow-none"
                        >
                          {submitting ? (
                            <>
                              <div className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                              Submitting...
                            </>
                          ) : submitSuccess ? (
                            <>
                              <Check className="h-5 w-5 mr-2 text-primary" />
                              Submitted Successfully!
                            </>
                          ) : (
                            <>
                              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                              Submit Report
                            </>
                          )}
                        </Button>
                        <p className="text-xs text-center text-slate-500">
                          By submitting, you agree to our{' '}
                          <Link to="/policy" className="text-primary hover:underline">reporting policy</Link>
                          {' '}(<button type="button" onClick={() => setShowPolicyModal(true)} className="text-slate-400 hover:text-white hover:underline">quick view</button>).
                        </p>
                      </div>
                    </form>
                </CardContent>
              </Card>
              )}
            </div>
          </motion.div>

          {/* Submissions Feed */}
          <motion.div
            className="relative mt-14 w-full"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Static ambient glow (no animation) */}
            <div className="absolute -inset-x-10 -top-10 h-40 bg-gradient-to-r from-primary/10 via-blue-500/5 to-purple-500/10 blur-3xl pointer-events-none -z-10" />

            <Card className="relative z-10 shadow-[0_24px_70px_-24px_rgba(0,0,0,0.8)] border border-white/[0.08] bg-slate-950/50 backdrop-blur-2xl overflow-hidden rounded-3xl">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              {/* Header */}
              <div className="px-5 md:px-7 py-5 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent">
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 rounded-2xl border border-white/10 bg-white/[0.04] text-primary">
                    <ListFilter className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Submissions Feed</h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Latest community-reported indicators</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-300 font-bold bg-white/[0.04] px-3.5 py-1.5 rounded-xl border border-white/10 tabular-nums">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {reportCount > 0 ? `${fmt(reportCount)} total` : 'Live feed'}
                </div>
              </div>

              <div className="overflow-x-auto min-h-[320px]">
                {loading ? (
                  <div className="flex flex-col items-center justify-center text-slate-400 py-28">
                    <div className="relative h-8 w-8 mb-4">
                      <div className="absolute inset-0 rounded-full border border-slate-800"></div>
                      <div className="absolute inset-0 rounded-full border border-slate-500 border-t-transparent animate-spin"></div>
                    </div>
                    <p className="font-bold tracking-widest text-[10px] text-slate-500 uppercase">Syncing live database</p>
                  </div>
                ) : isEmpty ? (
                  <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                    <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] mb-4">
                      <ShieldCheck className="h-7 w-7 text-slate-600" />
                    </div>
                    <h3 className="text-sm font-bold text-white tracking-wide">No submissions yet</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed mt-1.5">
                      The intel feed is currently clear. Be the first to report malicious activity and protect the network.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left font-sans block md:table border-collapse">
                    <thead className="hidden md:table-header-group bg-black/30 border-b border-white/[0.08]">
                      <tr>
                        <th className="px-5 py-3.5 text-[10px] font-space font-bold tracking-[0.12em] uppercase text-slate-400 w-[16%]">IP Address</th>
                        <th className="px-5 py-3.5 text-[10px] font-space font-bold tracking-[0.12em] uppercase text-slate-400 w-[16%]">Reporter</th>
                        <th className="px-5 py-3.5 text-[10px] font-space font-bold tracking-[0.12em] uppercase text-slate-400 w-[20%]">
                          <span className="inline-flex items-center gap-1.5">
                            Timestamp (UTC)
                            <HelpCircle size={13} className="text-slate-500" />
                          </span>
                        </th>
                        <th className="px-5 py-3.5 text-[10px] font-space font-bold tracking-[0.12em] uppercase text-slate-400">Evidence</th>
                        <th className="px-5 py-3.5 text-[10px] font-space font-bold tracking-[0.12em] uppercase text-slate-400 text-right w-[16%]">Categories</th>
                      </tr>
                    </thead>
                    <tbody className="block md:table-row-group space-y-4 md:space-y-0 p-4 md:p-0">
                      <AnimatePresence>
                        {reports.reduce((acc: any[], row) => {
                          const isDuplicate = acc.some(r => r.ip === row.ip && r.reporter_alias === row.reporter_alias);
                          if (!isDuplicate) acc.push(row);
                          return acc;
                        }, []).map((row: any, idx: number, arr: any[]) => {
                          const dateObj = new Date(row.created_at);
                          const fullDate = dateObj.toISOString().replace('T', ' ').substring(0, 19);
                          const categories = (row.category || 'Other').split(', ');
                          const showIp = idx === 0 || arr[idx - 1].ip !== row.ip;

                          return (
                            <motion.tr
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                              key={row.id || row.created_at}
                              className="block md:table-row bg-slate-900/40 md:bg-transparent md:odd:bg-white/[0.015] hover:bg-white/[0.04] transition-colors group border border-white/10 md:border-0 md:border-b md:border-white/[0.05] last:border-0 rounded-2xl md:rounded-none p-4 md:p-0 align-top"
                            >
                              {/* IP Address */}
                              <td className="block md:table-cell px-0 py-1.5 md:px-5 md:py-4 align-top whitespace-nowrap">
                                {showIp ? (
                                  <div className="flex items-center gap-2 group/ip">
                                    <span className="text-slate-100 font-space text-[15px] font-bold tracking-wide">
                                      {row.ip}
                                    </span>
                                    <button
                                      onClick={() => handleCopyIp(row.ip)}
                                      className="p-1 rounded-md text-slate-500 hover:text-white hover:bg-white/10 transition-all md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                                      title="Copy IP"
                                    >
                                      {copiedIp === row.ip ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="hidden md:inline-block text-slate-700 select-none text-xs pl-1" title="Same as above">↳</span>
                                )}
                              </td>

                              {/* Reporter */}
                              <td className="block md:table-cell px-0 py-1 md:px-5 md:py-4 align-top whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <img src={getAvatarForName(row.reporter_alias)} alt="" className="w-6 h-6 rounded-full border border-white/10 bg-black/20 object-cover" />
                                  <span className="text-slate-200 group-hover:text-blue-400 transition-colors cursor-pointer font-elegant text-[14px] font-medium tracking-wide">
                                    {row.reporter_alias || 'Anonymous'}
                                  </span>
                                  {row.reporter_alias === 'lamichhanesujal18' && (
                                    <span className="flex items-center gap-1">
                                      <img src={`${import.meta.env.BASE_URL}img/admin.png`} title="Admin" alt="Admin" className="w-5 h-5 object-contain" />
                                      <img src={`${import.meta.env.BASE_URL}img/hunter.png`} title="Hunter" alt="Hunter" className="w-5 h-5 object-contain" />
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Timestamp */}
                              <td className="block md:table-cell px-0 py-1 md:px-5 md:py-4 align-top whitespace-nowrap">
                                <div className="flex items-center gap-2 md:block">
                                  <div className="text-[13px] text-slate-300 font-space font-medium tracking-tight">{fullDate}</div>
                                  <div className="text-[11px] text-slate-500 font-elegant mt-0.5">{timeAgo(row.created_at)}</div>
                                </div>
                              </td>

                              {/* Evidence / Comment */}
                              <td className="block md:table-cell px-0 py-3 md:px-5 md:py-4 align-top border-t border-b border-white/5 md:border-0 my-3 md:my-0 md:max-w-[320px]">
                                {editingRowId === row.id ? (
                                  <div className="flex flex-col gap-2 relative z-20">
                                    <Textarea
                                      value={editComment}
                                      onChange={(e) => setEditComment(e.target.value)}
                                      className="min-h-[80px] resize-none bg-black/40 border-white/20 text-white placeholder:text-slate-500 text-[12px] p-2"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <Button variant="ghost" size="sm" onClick={() => setEditingRowId(null)} disabled={isSavingEdit} className="h-7 text-xs px-2 text-slate-300 hover:text-white">Cancel</Button>
                                      <Button size="sm" onClick={() => handleSaveEdit(row.id)} disabled={isSavingEdit} className="h-7 text-xs px-3 bg-primary text-black hover:bg-primary/90">
                                        {isSavingEdit ? 'Saving...' : 'Save'}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative pr-8">
                                    <CommentCell comment={row.comment} />
                                    {alias && row.reporter_alias === alias && (
                                      <button
                                        onClick={() => { setEditingRowId(row.id); setEditComment(row.comment); }}
                                        className="absolute top-0 right-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-md shadow-sm"
                                        title="Edit your comment"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Categories */}
                              <td className="block md:table-cell px-0 py-1 md:px-5 md:py-4 align-top">
                                <div className="flex flex-wrap md:justify-end gap-1.5 pt-1 md:pt-0">
                                  {categories.map(cat => (
                                    <span key={cat} className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] rounded-md font-bold whitespace-nowrap ${getCategoryColor(cat)}`}>
                                      <img src={getCategoryIconPath(cat)} alt="" className="w-3 h-3 object-contain" />
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </motion.tr>
                          )
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                )}
              </div>

              {totalPages > 1 && !loading && !isEmpty && (
                <div className="px-5 md:px-7 py-4 border-t border-white/[0.06] flex items-center justify-between bg-black/20 select-none">
                  <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                    Page <span className="text-slate-300">{page + 1}</span> of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-bold text-xs disabled:opacity-40 border border-white/10"
                      onClick={() => loadReportedIPs(page - 1)}
                      disabled={page === 0}
                    >
                      <ChevronLeft size={14} className="mr-0.5" /> Prev
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:bg-white/5 hover:text-white rounded-lg transition-colors font-bold text-xs disabled:opacity-40 border border-white/10"
                      onClick={() => loadReportedIPs(page + 1)}
                      disabled={page >= totalPages - 1}
                    >
                      Next <ChevronRight size={14} className="ml-0.5" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>

        </Container>

        <AnimatePresence>
          {showPolicyModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPolicyModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
              <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }} transition={{ type: 'tween', duration: 0.2 }} className="relative bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl z-10 flex flex-col max-h-[85vh]">
                <div className="flex items-center gap-3 mb-6 shrink-0 border-b border-white/[0.05] pb-4">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2L4 5.5v5.5c0 5.5 3.5 10.2 8 11.5 4.5-1.3 8-6 8-11.5V5.5L12 2z" fill="url(#policyGlow)" opacity="0.1" />
                      <path d="M12 2L4 5.5v5.5c0 5.5 3.5 10.2 8 11.5 4.5-1.3 8-6 8-11.5V5.5L12 2z" stroke="url(#policyBorderGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 11l2 2 4-4" stroke="url(#policyBorderGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <defs>
                        <linearGradient id="policyGlow" x1="12" y1="2" x2="12" y2="22.5" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#3B82F6" />
                          <stop offset="1" stopColor="#1E3A8A" />
                        </linearGradient>
                        <linearGradient id="policyBorderGrad" x1="12" y1="2" x2="12" y2="22.5" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#60A5FA" />
                          <stop offset="0.5" stopColor="#3B82F6" />
                          <stop offset="1" stopColor="#1D4ED8" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white tracking-wide">Community Reporting Policy</h3>
                  </div>
                </div>
                <div className="text-xs text-slate-300 space-y-6 leading-relaxed overflow-y-auto pr-2 custom-scrollbar">
                  <div>
                    <h4 className="font-bold text-white text-sm mb-2 border-l-2 border-destructive pl-2">1. Target Integrity</h4>
                    <p className="text-slate-400">Only report public IP addresses demonstrating malicious activity. Do not report private networks (e.g., 192.168.x.x), loopback addresses, or legitimate DNS/infrastructure unless actively weaponized.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-2 border-l-2 border-destructive pl-2">2. Accuracy and Evidence</h4>
                    <p className="text-slate-400">Provide clear and concise evidence or reasoning in your submission comment. Deliberately submitting false reports, false positives, or targeted harassment will result in a permanent account ban.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm mb-2 border-l-2 border-destructive pl-2">3. No Personal Information</h4>
                    <p className="text-slate-400">Do not include Personally Identifiable Information (PII) in your reports unless it is directly part of the threat indicators (e.g., a phishing email address used by an attacker).</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 pt-4 mt-2 border-t border-white/[0.05] shrink-0">
                  <Link to="/policy" onClick={() => setShowPolicyModal(false)} className="text-xs font-semibold text-blue-400 hover:underline inline-flex items-center gap-1.5">
                    Read the full policy <ChevronRight size={14} />
                  </Link>
                  <button type="button" onClick={() => setShowPolicyModal(false)} className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all select-none">
                    I UNDERSTAND & AGREE
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </PageShell>
  )
}
