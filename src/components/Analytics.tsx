import { useEffect, useRef, useState } from 'react'
import { TrendingUp, Activity } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  SubTitle,
} from 'chart.js'
import { Line, Doughnut } from 'react-chartjs-2'
import { getBaseUrl, fmt } from '../utils'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Filler, Tooltip, Legend, SubTitle)

export default function Analytics({ statsData, feedVersion }: any) {
  return (
    <section className="py-12 md:py-24 relative" id="analytics">
      <div className="mx-auto max-w-7xl px-6 lg:px-12 relative z-10">
        <div className="mb-14 text-center md:text-left flex flex-col items-center md:items-start">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl text-xs font-bold uppercase tracking-widest mb-6 text-slate-300">
            <span className="relative flex h-2.5 w-2.5 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
            Live Telemetry
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold flex items-center justify-center md:justify-start gap-4 text-white drop-shadow-sm tracking-tight">
            Threat Landscape
          </h2>
          <p className="mt-5 text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
            90-day volume trend of tracked malicious indicators across our global sensor network, aggregated in real-time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Line Chart Card */}
          <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-[2px] w-full bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
            
            <div className="relative z-10">
              <h3 className="text-xl font-extrabold mb-8 text-white tracking-tight flex items-center gap-2">
                <Activity className="text-cyan-400" size={20} /> Volume Trend
              </h3>
              <div className="h-80 w-full">
                <HistoryChart feedVersion={feedVersion} />
              </div>
            </div>
          </div>

          {/* Donut Chart Card */}
          <div className="rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-3xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] p-8 relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-[2px] w-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
            
            <div className="relative z-10 h-full flex flex-col">
              <h3 className="text-xl font-extrabold mb-8 text-white tracking-tight">Specialized Categories</h3>
              <div className="flex-1 w-full relative flex items-center justify-center min-h-[300px]">
                {statsData?.category_counts && (
                  <CategoryChart categories={statsData.category_counts} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HistoryChart({ feedVersion }: any) {
  const chartRef = useRef(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    const RAW = getBaseUrl()
    fetch(RAW + 'history.json?v=' + feedVersion)
      .then((r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (!data || data.length === 0) return
        setHistory(data)

        // Update trends
        if (data.length >= 2) {
          const today = data[data.length - 1]
          const yday = data[data.length - 2]
          const updateTrend = (id: string, cur: number, prev: number) => {
            const el = document.getElementById(id)
            if (!el || typeof cur !== 'number' || typeof prev !== 'number') return
            const diff = cur - prev
            if (diff > 0) {
              el.textContent = `↑ +${fmt(diff)}`
              el.className = 'text-xs font-bold text-red-400 ml-2 drop-shadow-sm'
            } else if (diff < 0) {
              el.textContent = `↓ ${fmt(diff)}`
              el.className = 'text-xs font-bold text-emerald-400 ml-2 drop-shadow-sm'
            } else {
              el.textContent = '— 0'
              el.className = 'text-xs font-bold text-slate-500 ml-2'
            }
          }
          updateTrend('trend-ips', today.total_unique_ips, yday.total_unique_ips)
          updateTrend('trend-domains', today.total_unique_domains, yday.total_unique_domains)
          updateTrend('trend-hashes', today.total_unique_hashes, yday.total_unique_hashes)
          updateTrend('trend-urls', today.total_unique_urls, yday.total_unique_urls)
          updateTrend('trend-ipv6', today.total_unique_ipv6, yday.total_unique_ipv6)
          updateTrend('trend-cidrs', today.total_unique_cidrs, yday.total_unique_cidrs)
        }
      })
      .catch((e) => console.warn('history.json unavailable', e))
  }, [feedVersion])

  const gridColor = 'rgba(255, 255, 255, 0.03)'
  const textColor = '#64748b' // slate-500

  const labels = history.map((h) => {
    const d = new Date(h.date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  })

  // Function to create gradient fills for lines
  const createGradient = (context: any, colorStart: string, colorEnd: string) => {
    const chart = context.chart
    const { ctx, chartArea } = chart
    if (!chartArea) return null
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
    gradient.addColorStop(0, colorStart)
    gradient.addColorStop(1, colorEnd)
    return gradient
  }

  const data = {
    labels,
    datasets: [
      {
        label: 'IPv4',
        data: history.map((h) => h.total_unique_ips || 0),
        borderColor: '#06b6d4', // Cyan
        backgroundColor: (c: any) => createGradient(c, 'rgba(6, 182, 212, 0.3)', 'rgba(6, 182, 212, 0.0)'),
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Domains',
        data: history.map((h) => h.total_unique_domains || 0),
        borderColor: '#a855f7', // Purple
        backgroundColor: (c: any) => createGradient(c, 'rgba(168, 85, 247, 0.2)', 'rgba(168, 85, 247, 0.0)'),
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
        fill: true,
      },
      {
        label: 'IPv6',
        data: history.map((h) => h.total_unique_ipv6 || 0),
        borderColor: '#10b981', // Emerald
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
      },
      {
        label: 'URLs',
        data: history.map((h) => h.total_unique_urls || 0),
        borderColor: '#f59e0b', // Amber
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
      },
      {
        label: 'Hashes',
        data: history.map((h) => h.total_unique_hashes || 0),
        borderColor: '#f43f5e', // Rose
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 6,
        tension: 0.4,
      }
    ],
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true,
        position: 'top',
        labels: {
          color: '#e2e8f0',
          usePointStyle: true,
          boxWidth: 8,
          font: { size: 12, family: "'Inter', sans-serif", weight: '600' }
        }
      },
      subtitle: {
        display: labels.length > 0,
        text: labels.length > 0 ? '* Feed started ' + labels[0] + ' (Baseline aggregation)' : '',
        color: textColor,
        font: { size: 12, weight: 'normal', style: 'italic' },
        padding: { bottom: 20 },
        align: 'start',
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 16,
        displayColors: true,
        usePointStyle: true,
        boxPadding: 6,
        titleFont: { size: 14, family: "'Inter', sans-serif" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        mode: 'index',
        intersect: false,
        callbacks: { label: (c: any) => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { maxTicksLimit: 8, color: textColor, font: { family: "'Inter', sans-serif" } },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: {
          color: textColor,
          font: { family: "'Inter', sans-serif" },
          callback: (v: number) =>
            v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(0) + 'K' : v,
        },
      },
    },
    interaction: { mode: 'index', intersect: false },
  }

  return <Line ref={chartRef} data={data} options={options} />
}

function CategoryChart({ categories }: any) {
  const textColor = '#cbd5e1'
  // Premium tech palette: Red, Orange, Amber, Emerald, Cyan, Purple
  const bgColors = ['#f43f5e', '#f97316', '#eab308', '#10b981', '#06b6d4', '#a855f7'] 

  const sorted = Object.entries(categories)
    .filter(([k]) => k !== 'Mixed' && k !== 'Unknown')
    .sort((a: any, b: any) => b[1] - a[1])
  const labels = sorted.map(([k]) => k)
  const vals = sorted.map(([, v]) => v)

  const data = {
    labels,
    datasets: [
      {
        data: vals,
        backgroundColor: bgColors,
        borderWidth: 0, // Remove stroke for sleek modern look
        borderRadius: 8, // Rounded segments
        hoverOffset: 8,
      },
    ],
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '80%', // Thinner sleek ring
    plugins: {
      legend: {
        position: 'bottom',
        labels: { 
          color: textColor, 
          font: { size: 12, family: "'Inter', sans-serif", weight: '500' }, 
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20 
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 16,
        usePointStyle: true,
        boxPadding: 6,
        bodyFont: { size: 14, family: "'Inter', sans-serif", weight: '600' },
        callbacks: {
          label: (context: any) => ' ' + context.label + ': ' + fmt(context.parsed),
        },
      },
    },
  }

  return <Doughnut data={data} options={options} />
}
