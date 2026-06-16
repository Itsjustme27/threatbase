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

async function fetchAndCacheFeedText(baseUrl, filename, feedVersion) {
  const cacheKey = `${filename}?v=${feedVersion}`
  if (feedCache[cacheKey]) return feedCache[cacheKey]

  let text = ''

  try {
    const url = `${baseUrl}${filename}?v=${feedVersion}`
    const r = await fetch(url)
    if (r.ok) {
      text = await r.text()
    } else {
      throw new Error(`GitHub Raw fetch error: ${r.status}`)
    }
  } catch (e) {
    console.error(`GitHub Raw fetch failed for ${filename}:`, e)
  }

  feedCache[cacheKey] = text
  return text
}

/** Convert a dotted IPv4 string to an unsigned 32-bit integer. */
function ipv4ToLong(ip) {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let acc = 0
  for (let i = 0; i < 4; i++) {
    const oct = Number(parts[i])
    if (!Number.isInteger(oct) || oct < 0 || oct > 255) return null
    acc = (acc << 8) + oct
  }
  return acc >>> 0
}

/**
 * Scan an IPv4 address against the malicious CIDR feed.
 * Closes the "hidden IP" gap: feeds like Spamhaus/FireHOL publish ranges,
 * so an IP malicious only by virtue of its subnet has no exact row in the IP feed.
 * Returns the matching CIDR string, or null.
 */
function findMatchingCidr(cidrText, ipLong) {
  if (!cidrText || ipLong === null) return null
  const lines = cidrText.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || line.startsWith('#')) continue
    // IPv6 CIDRs are stored here too; skip them for IPv4 membership tests.
    if (line.indexOf(':') !== -1) continue
    const slash = line.indexOf('/')
    if (slash === -1) continue
    const base = ipv4ToLong(line.slice(0, slash))
    if (base === null) continue
    const mask = Number(line.slice(slash + 1))
    if (!Number.isInteger(mask) || mask < 0 || mask > 32) continue
    const bitmask = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0
    if ((ipLong & bitmask) === (base & bitmask)) return line
  }
  return null
}

function ipCsvCompare(query, line) {
  if (line.startsWith('#') || line.startsWith('ip,')) return 1;
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
  if (line.startsWith('#') || line.startsWith('ip,')) return 1;
  const key = line.split(',')[0];
  if (query < key) return -1
  if (query > key) return 1
  return 0
}

function binarySearchString(text, query, compareFn) {
  if (!text) return null;
  let low = 0;
  let high = text.length - 1;
  
  while (low <= high) {
    let mid = Math.floor((low + high) / 2);
    
    let start = mid;
    while (start > 0 && text[start - 1] !== '\n') start--;
    
    let end = mid;
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;
    
    let line = text.slice(start, end).trim();
    if (line.length === 0) {
      // Empty line, safely move past it
      low = end + 1;
      continue;
    }
    
    const comp = compareFn(query, line);
    if (comp === 0) {
      if (line.startsWith('#') || line.startsWith('ip,')) return null;
      return line;
    }
    
    if (comp < 0) {
      high = start - 1;
    } else {
      low = end + 1;
    }
  }
  return null;
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
  let matchedCidr = null

  try {
    let textData = ''
    let compareFn = stringCompare

    if (isIP) {
      textData = await fetchAndCacheFeedText(RAW, 'threatbase-ip.txt', feedVersion)
      compareFn = ipCsvCompare
    } else if (isIPv6) {
      textData = await fetchAndCacheFeedText(RAW, 'threatbase-ipv6.txt', feedVersion)
    } else if (isCIDR) {
      textData = await fetchAndCacheFeedText(RAW, 'threatbase-cidr.txt', feedVersion)
    } else if (isDomain) {
      textData = await fetchAndCacheFeedText(RAW, 'threatbase-domain.txt', feedVersion)
    } else if (isHash) {
      textData = await fetchAndCacheFeedText(RAW, 'threatbase-hash.txt', feedVersion)
    } else if (isURL) {
      textData = await fetchAndCacheFeedText(RAW, 'threatbase-url.txt', feedVersion)
    }

    let result = binarySearchString(textData, ip, compareFn)

    // CIDR fallback: an IPv4 with no exact row may still be malicious because
    // it falls inside a listed malicious subnet (Spamhaus/FireHOL/etc).
    if (!result && isIP) {
      const cidrText = await fetchAndCacheFeedText(RAW, 'threatbase-cidr.txt', feedVersion)
      matchedCidr = findMatchingCidr(cidrText, ipv4ToLong(ip))
    }

    if (result || matchedCidr) {
      isMalicious = true
      if (result) {
        const parts = result.split(',')
        if (parts.length >= 3) {
          feedCount = parts[1]
          riskScore = parts[2]
        }
        if (parts.length >= 4) {
          tags = parts[3].split('|').filter(t => t.trim() !== '' && t !== 'Mixed')
        }
      } else if (matchedCidr) {
        // Range-based detection: high confidence, surface the matched subnet.
        riskScore = 'High'
        feedCount = 1
        tags = ['Malicious Subnet']
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

  return { type: scanType, ip, isIP, isDomain, isHash, isURL, isIPv6, isCIDR, isMalicious, riskScore, feedCount, isDisputed, disputeCount, tags, matchedCidr }
}
