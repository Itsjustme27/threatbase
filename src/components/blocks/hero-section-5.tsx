'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { InfiniteSlider } from '@/components/ui/infinite-slider'
import { ProgressiveBlur } from '@/components/ui/progressive-blur'
import { cn } from '@/lib/utils'
import ThreatMap from '../ThreatMap'
import { Menu, X, ChevronRight, Shield, Server, Database, Lock, Network, Cloud, Activity, Globe, Search, Flame, MailX, GlobeLock, Bug, ShieldAlert, ShieldBan, Zap, Key, Crosshair, ShieldCheck, Binary, Snowflake, Github } from 'lucide-react'
import { useScroll, motion, useMotionValueEvent } from 'framer-motion'

import GradientBarsBackground from '@/components/ui/gradient-bars-background'

export function HeroSection({ scanInput, setScanInput, handleScan, statsData }: any) {
    return (
        <>
            <div
                className="relative overflow-hidden w-full min-h-[90vh] bg-app"
            >
                <ThreatMap />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0B0F19]/50 to-[#0B0F19] pointer-events-none z-0" />
                <section className="relative z-10 pt-16 md:pt-20">
                    <div className="py-12 md:pb-24 lg:pb-32 lg:pt-16 relative">
                        <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 lg:block lg:px-12">
                            <div className="mx-auto max-w-2xl text-center lg:-ml-8 xl:-ml-12 lg:max-w-full lg:text-left relative">
                                <div className="relative z-10">
                                    <h1 className="mt-8 max-w-3xl text-balance text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white lg:mt-12 xl:text-7xl drop-shadow-lg">
                                        Built for Defenders <span className="block text-red-500 mt-2 pb-2">Powered by Open Intelligence</span>
                                    </h1>
                                    <p className="mt-5 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-300 drop-shadow">
                                        Access real-time threat data and indicators to proactively identify, investigate, and respond to cyber threats.
                                    </p>

                                    <div className="mt-8 sm:mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start w-full">
                                        <div className="relative w-full max-w-md flex items-center">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Scan IP, Domain, Hash..."
                                                className="h-14 w-full rounded-full border border-white/10 bg-slate-900/60 backdrop-blur-xl pl-12 pr-28 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:border-red-500/50 focus-visible:ring-1 focus-visible:ring-red-500/50 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] focus:shadow-[0_0_20px_rgba(239,68,68,0.2)]"
                                                value={scanInput}
                                                onChange={(e) => setScanInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                                            />
                                            <Button
                                                size="sm"
                                                className="absolute right-1.5 top-1.5 bottom-1.5 h-11 rounded-full px-5 sm:px-7 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 text-white font-semibold shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] transition-all border border-white/10"
                                                onClick={handleScan}
                                            >
                                                Scan
                                            </Button>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="lg"
                                            className="h-14 rounded-full px-8 text-base border-white/10 bg-black/50 backdrop-blur-md text-slate-200 hover:bg-white/10 hover:text-white hover:border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] transition-all duration-300"
                                            asChild
                                        >
                                            <a href="#feeds">Browse Feeds</a>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </>
    )
}
