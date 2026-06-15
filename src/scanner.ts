import { getBaseUrl } from './utils'
import supabaseClient from './supabaseClient'

const feedCache = {}
const statsCache = {}

async function getStats(rawBaseUrl) {
  if (statsCache[rawBaseUrl]) return statsCache[rawBaseUrl]
  try {
    const r = await fetch(rawBaseUrl + 'stats.json?_=' + Date.now())
    if (r.ok) {
      const data = await r.json()
      statsCache[rawBaseUrl] = data
      return data
    }
  } catch (e) {
    console.error('Failed to fetch stats:', rawBaseUrl, e)
  }
  return null
}

async function fetchAndCacheFeed(baseUrl, filename, feedVersion) {
  const cacheKey = `${filename}?v=${feedVersion}`
  if (feedCache[cacheKey]) return feedCache[cacheKey]
  
  let stats = await getStats(baseUrl)
  const GITHUB_RAW = 'https://raw.githubusercontent.com/kalidada18/threatbase/main/ioc/'
  
  if (!stats) {
    stats = await getStats(GITHUB_RAW)
  }
  
  let filesToFetch = [filename]
  if (stats && stats.chunk_files && stats.chunk_files[filename]) {
    filesToFetch = stats.chunk_files[filename]
  }
  
  let allLines = []
  let success = false
  
  // Try Supabase Storage first
  try {
    const fetchPromises = filesToFetch.map(async (file) => {
      const url = `${baseUrl}${file}?v=${feedVersion}`
      const r = await fetch(url)
      if (!r.ok) throw new Error(`Supabase fetch error: ${r.status}`)
      const text = await r.text()
      return text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('ip,'))
    })
    
    const results = await Promise.all(fetchPromises)
    for (const lines of results) {
      allLines = allLines.concat(lines)
    }
    success = true
  } catch (e) {
    console.warn(`Supabase Storage fetch failed for ${filename}, falling back to GitHub Raw:`, e)
  }
  
  // Fallback to GitHub Raw if Supabase failed or returned empty
  if (!success || allLines.length === 0) {
    let githubFiles = [filename]
    const githubStats = await getStats(GITHUB_RAW)
    if (githubStats && githubStats.chunk_files && githubStats.chunk_files[filename]) {
      githubFiles = githubStats.chunk_files[filename]
    }
    
    try {
      const fetchPromises = githubFiles.map(async (file) => {
        const url = `${GITHUB_RAW}${file}?v=${feedVersion}`
        const r = await fetch(url)
        if (!r.ok) return []
        const text = await r.text()
        return text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('ip,'))
      })
      
      const results = await Promise.all(fetchPromises)
      allLines = []
      for (const lines of results) {
        allLines = allLines.concat(lines)
      }
    } catch (e) {
      console.error('GitHub Raw fallback fetch failed:', e)
    }
  }
  
  feedCache[cacheKey] = allLines
  return allLines
}

function ipCsvCompare(query, line) {
  const ipPart = line.split(',')[0]
  const pA = query.split('.').map(Number)
  const pB = ipPart.split('.').map(Number)
  for (let i = 0; i < 4; i++) {
    if ((pA[i] || 0) < (pB[i] || 0)) return -1
    if ((pA[i] || 0) > (pB[i] || 0)) return 1
  }
  return 0
}

function stringCompare(query, line) {
  if (query < line) return -1
  if (query > line) return 1
  return 0
}

function binarySearchArray(arr, query, compareFn) {
  let low = 0
  let high = arr.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const comp = compareFn(query, arr[mid])
    if (comp === 0) return arr[mid]
    if (comp < 0) high = mid - 1
    else low = mid + 1
  }
  return null
}

/**
 * Classify the indicator type and search against cached feed files.
 * Returns { type, isMalicious, riskScore, feedCount }
 */
export async function scanIndicatorLogic(rawInput, feedVersion) {
  const isURL = /^https?:\/\/.+/.test(rawInput)
  const isHash = /^[a-fA-F0-9]{32}(?:[a-fA-F0-9]{8})?(?:[a-fA-F0-9]{24})?$/.test(rawInput)
  const ip = isURL && !isHash ? rawInput : rawInput.toLowerCase()

  const isIP =
    /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip)
  const isIPv6 = ip.includes(':') && /^[0-9a-fA-F:]+$/.test(ip) && !ip.includes('/')
  const isCIDR = ip.includes('/') && /^[a-fA-F0-9:.]+\/\d{1,3}$/.test(ip)
  const isDomain =
    !isIP &&
    !isIPv6 &&
    !isCIDR &&
    !isURL &&
    !isHash &&
    /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*\.[A-Za-z]{2,}$/.test(ip)

  if (!isIP && !isIPv6 && !isCIDR && !isDomain && !isHash && !isURL) {
    return { type: 'invalid', ip, isIP, isDomain, isHash, isURL, isIPv6, isCIDR, isMalicious: false, riskScore: 'Low', feedCount: 1 }
  }

  let scanType = 'Indicator'
  if (isIP) scanType = 'IP Address'
  else if (isIPv6) scanType = 'IPv6 Address'
  else if (isCIDR) scanType = 'CIDR Block'
  else if (isHash) scanType = 'File Hash'
  else if (isURL) scanType = 'URL'
  else if (isDomain) scanType = 'Domain'

  const RAW = getBaseUrl()
  let isMalicious = false
  let riskScore = 'Low'
  let feedCount = 1
  let isDisputed = false
  let disputeCount = 0
  let tags = []

  try {
    let list = []
    let compareFn = stringCompare

    if (isIP) {
      list = await fetchAndCacheFeed(RAW, 'malicious_ips.txt', feedVersion)
      compareFn = ipCsvCompare
    } else if (isIPv6) {
      list = await fetchAndCacheFeed(RAW, 'malicious_ipv6.txt', feedVersion)
    } else if (isCIDR) {
      list = await fetchAndCacheFeed(RAW, 'malicious_cidrs.txt', feedVersion)
    } else if (isDomain) {
      list = await fetchAndCacheFeed(RAW, 'malicious_domains.txt', feedVersion)
    } else if (isHash) {
      list = await fetchAndCacheFeed(RAW, 'malicious_hashes.txt', feedVersion)
    } else if (isURL) {
      list = await fetchAndCacheFeed(RAW, 'malicious_urls.txt', feedVersion)
    }

    const result = binarySearchArray(list, ip, compareFn)

    if (result) {
      isMalicious = true
      const parts = result.split(',')
      if (parts.length >= 3) {
        feedCount = parts[1]
        riskScore = parts[2]
      }
      if (parts.length >= 4) {
        tags = parts[3].split('|').filter(t => t.trim() !== '' && t !== 'Mixed')
      }

      if (supabaseClient) {
        try {
          const { count } = await supabaseClient
            .from('disputes')
            .select('*', { count: 'exact', head: true })
            .eq('ip', ip)

          if (count !== null) {
            disputeCount = count
            if (count >= 3) {
              isMalicious = false
              isDisputed = true
            }
          }
        } catch (err) {
          console.error('Failed to check disputes:', err)
        }
      }
    }
  } catch (e) {
    console.error(e)
  }

  return { type: scanType, ip, isIP, isDomain, isHash, isURL, isIPv6, isCIDR, isMalicious, riskScore, feedCount, isDisputed, disputeCount, tags }
}
