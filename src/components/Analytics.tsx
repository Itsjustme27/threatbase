import { useEffect, useRef, useState } from 'react'
import { TrendingUp } from 'lucide-react'
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
    <section className="py-12 md:py-20" id="analytics">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-14 text-center md:text-left">
          <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 drop-shadow-sm">Insights</div>
          <h2 className="text-3xl md:text-5xl font-extrabold flex items-center justify-center md:justify-start gap-4 text-white">
            <TrendingUp className="text-red-500" size={36} /> Threat Landscape
          </h2>
          <p className="mt-5 text-slate-400 text-lg max-w-2xl font-medium leading-relaxed">
            90-day volume trend of tracked malicious IPv4 addresses across our sensor network.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md p-8 shadow-2xl transition-all duration-300 hover:bg-slate-900/60 relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <h3 className="text-xl font-bold mb-8 text-white tracking-tight">Volume Trend</h3>
            <div className="h-80 w-full relative">
              <HistoryChart feedVersion={feedVersion} />
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-slate-900/40 backdrop-blur-md p-8 shadow-2xl transition-all duration-300 hover:bg-slate-900/60 relative overflow-hidden group">
            <div className="absolute top-0 inset-x-0 h-px w-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <h3 className="text-xl font-bold mb-8 text-white tracking-tight">Specialized Threat Categories</h3>
            <div className="h-80 w-full relative flex items-center justify-center">
              {statsData?.category_counts && (
                <CategoryChart categories={statsData.category_counts} />
              )}
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
              el.className = 'text-xs font-medium text-destructive ml-2'
            } else if (diff < 0) {
              el.textContent = `↓ ${fmt(diff)}`
              el.className = 'text-xs font-medium text-green-500 ml-2'
            } else {
              el.textContent = '— 0'
              el.className = 'text-xs font-medium text-muted-foreground ml-2'
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

  const accentColor = '#06b6d4' // Neon Cyan
  const gridColor = 'rgba(255, 255, 255, 0.05)'
  const textColor = '#94a3b8'

  const labels = history.map((h) => {
    const d = new Date(h.date)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  })
  const vals = history.map((h) => h.total_unique_ips)

  const data = {
    labels,
    datasets: [
      {
        label: 'Tracked Malicious IPs',
        data: vals,
        borderColor: accentColor,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx
          const gradient = ctx.createLinearGradient(0, 0, 0, 350)
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.3)') // Cyan glow
          gradient.addColorStop(1, 'rgba(6, 182, 212, 0)')
          return gradient
        },
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: accentColor,
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4, // Smoother curves
      },
    ],
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      subtitle: {
        display: labels.length > 0,
        text: labels.length > 0 ? '* Feed started ' + labels[0] + ' (Baseline aggregation)' : '',
        color: textColor,
        font: { size: 12, weight: 'normal', style: 'italic' },
        padding: { bottom: 16 },
        align: 'start',
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: { label: (c: any) => fmt(c.parsed.y) + ' IPs' },
      },
    },
    scales: {
      x: {
        grid: { display: false, drawBorder: false },
        ticks: { maxTicksLimit: 8, color: textColor },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: {
          color: textColor,
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
  const textColor = '#94a3b8'
  const bgColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#a855f7'] // Vibrant neon palette

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
        borderWidth: 2,
        borderColor: '#0f172a', // Dark borders to match theme
        hoverOffset: 4,
      },
    ],
  }

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: textColor, font: { size: 12 }, boxWidth: 12, padding: 16 },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => ' ' + context.label + ': ' + fmt(context.parsed),
        },
      },
    },
  }

  return <Doughnut data={data} options={options} />
}
