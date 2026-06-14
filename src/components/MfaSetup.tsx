import React, { useState, useEffect } from 'react'
import supabaseClient from '../supabaseClient'
import { Shield, ShieldAlert, Loader2, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MfaSetup({ addToast }: { addToast: (msg: string, type: 'success'|'error') => void }) {
  const [loading, setLoading] = useState(true)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [factorId, setFactorId] = useState<string | null>(null)
  
  // Setup flow state
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [qrCodeSvg, setQrCodeSvg] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [unenrolling, setUnenrolling] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    if (!supabaseClient) return
    setLoading(true)
    try {
      const { data, error } = await supabaseClient.auth.mfa.listFactors()
      if (error) throw error
      
      const totpFactor = data?.totp?.[0]
      if (totpFactor && totpFactor.status === 'verified') {
        setIsEnrolled(true)
        setFactorId(totpFactor.id)
      } else {
        setIsEnrolled(false)
        setFactorId(null)
      }
    } catch (err) {
      console.error('Error fetching MFA factors:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStartSetup = async () => {
    if (!supabaseClient) return
    setIsSettingUp(true)
    setLoading(true)
    try {
      // 1. Enroll
      const { data: enrollData, error: enrollError } = await supabaseClient.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Threatbase'
      })
      
      if (enrollError) throw enrollError
      
      setFactorId(enrollData.id)
      setQrCodeSvg(enrollData.totp.qr_code)
      
      // 2. Challenge
      const { data: challengeData, error: challengeError } = await supabaseClient.auth.mfa.challenge({
        factorId: enrollData.id
      })
      
      if (challengeError) throw challengeError
      setChallengeId(challengeData.id)
      
    } catch (err: any) {
      console.error('MFA Setup initialization error:', err)
      addToast(err.message || 'Failed to initialize MFA setup.', 'error')
      setIsSettingUp(false)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifySetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabaseClient || !factorId || !challengeId) return
    
    if (otp.length < 6) {
      addToast('Please enter a 6-digit code', 'error')
      return
    }

    setVerifying(true)
    try {
      const { error } = await supabaseClient.auth.mfa.verify({
        factorId,
        challengeId,
        code: otp
      })
      
      if (error) throw error
      
      addToast('Two-Factor Authentication successfully enabled!', 'success')
      setIsEnrolled(true)
      setIsSettingUp(false)
      setOtp('')
    } catch (err: any) {
      console.error('MFA Verification error:', err)
      addToast(err.message || 'Invalid code.', 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleUnenroll = async () => {
    if (!supabaseClient || !factorId) return
    if (!window.confirm('Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.')) {
      return
    }
    
    setUnenrolling(true)
    try {
      const { error } = await supabaseClient.auth.mfa.unenroll({
        factorId
      })
      if (error) throw error
      
      addToast('Two-Factor Authentication disabled.', 'success')
      setIsEnrolled(false)
      setFactorId(null)
    } catch (err: any) {
      console.error('MFA Unenroll error:', err)
      addToast(err.message || 'Failed to disable MFA.', 'error')
    } finally {
      setUnenrolling(false)
    }
  }

  if (loading && !isSettingUp && !unenrolling) {
    return (
      <div className="flex items-center justify-center p-6 text-slate-500">
        <Loader2 className="animate-spin" size={20} />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/[0.05] bg-black/40 p-6 md:p-8 mt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <KeyRound size={16} className="text-blue-400" />
            Two-Factor Authentication
          </h3>
          <p className="text-xs text-slate-400 max-w-md">
            Add an extra layer of security to your account by requiring an authentication code when you log in.
          </p>
        </div>
        
        {!isSettingUp && (
          <div>
            {isEnrolled ? (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  <Shield size={14} /> Enabled
                </span>
                <Button
                  onClick={handleUnenroll}
                  variant="outline"
                  className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded text-xs px-4"
                  disabled={unenrolling}
                >
                  {unenrolling ? 'Disabling...' : 'Disable'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 bg-slate-500/10 px-3 py-1 rounded-full border border-slate-500/20">
                  <ShieldAlert size={14} /> Disabled
                </span>
                <Button
                  onClick={handleStartSetup}
                  variant="outline"
                  className="border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 rounded text-xs px-4"
                >
                  Set Up 2FA
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {isSettingUp && (
        <div className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center">
          <p className="text-sm text-slate-300 font-semibold mb-4 text-center">
            Scan this QR code with your authenticator app
          </p>
          
          {loading ? (
            <div className="w-48 h-48 bg-white/5 rounded-xl flex items-center justify-center animate-pulse">
              <Loader2 className="animate-spin text-slate-500" size={24} />
            </div>
          ) : qrCodeSvg ? (
            <div 
              className="bg-white p-4 rounded-xl border-4 border-blue-500/20"
              dangerouslySetInnerHTML={{ __html: qrCodeSvg }} 
            />
          ) : null}

          <form onSubmit={handleVerifySetup} className="mt-8 w-full max-w-xs space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 text-center block">
                Enter the 6-digit code generated by the app
              </label>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                className="w-full h-12 rounded-xl border border-white/10 bg-black/50 px-4 text-center text-xl tracking-[0.5em] text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/50 transition-colors font-mono"
                disabled={verifying}
              />
            </div>
            
            <div className="flex gap-3">
              <Button 
                type="submit"
                disabled={verifying || otp.length < 6}
                className="flex-1 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Verify & Enable'}
              </Button>
              <Button 
                type="button"
                onClick={() => {
                  setIsSettingUp(false)
                  setQrCodeSvg(null)
                  setOtp('')
                }}
                disabled={verifying}
                className="flex-1 h-10 rounded-xl bg-transparent border border-white/10 hover:bg-white/5 text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
