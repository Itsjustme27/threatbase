import { getBaseUrl } from './utils'
import supabaseClient from './supabaseClient'

type CompareFn = (query: string, line: string) => number

const feedCache: Record<string, string> = {}

async function fetchAndCacheFeedText(
  baseUrl: string,
  filename: string,
  feedVersion: string | number,
): Promise<string> {
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
export function ipv4ToLong(ip: string): number | null {
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
export function findMatchingCidr(cidrText: string, ipLong: number | null): string | null {
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

export function ipCsvCompare(query: string, line: string): number {
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

export function stringCompare(query: string, line: string): number {
  if (line.startsWith('#') || line.startsWith('ip,')) return 1;
  const key = line.split(',')[0];
  if (query < key) return -1
  if (query > key) return 1
  return 0
}

export function binarySearchString(text: string, query: string, compareFn: CompareFn): string | null {
  if (!text) return null;
  let low = 0;
  let high = text.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);

    let start = mid;
    while (start > 0 && text[start - 1] !== '\n') start--;

    let end = mid;
    while (end < text.length && text[end] !== '\n' && text[end] !== '\r') end++;

    const line = text.slice(start, end).trim();
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
 * Classify a raw indicator string into its type. Pure (no network I/O) and
 * exported so the classification rules can be unit-tested in isolation.
 *
 * Hash detection is restricted to the three standard hex lengths — MD5 (32),
 * SHA-1 (40) and SHA-256 (64) — so odd-length hex (e.g. 56 chars) is no longer
 * misrouted to the hash feed.
 */
export function classifyIndicator(rawInput: string) {
  const isURL = /^https?:\/\/.+/.test(rawInput)
  const isHash = /^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/.test(rawInput)
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

  let type = 'invalid'
  if (isIP) type = 'IP Address'
  else if (isIPv6) type = 'IPv6 Address'
  else if (isCIDR) type = 'CIDR Block'
  else if (isHash) type = 'File Hash'
  else if (isURL) type = 'URL'
  else if (isDomain) type = 'Domain'

  return { ip, type, isIP, isIPv6, isCIDR, isHash, isURL, isDomain }
}

/**
 * Classify the indicator type and search against cached feed files.
 * Returns { type, isMalicious, riskScore, feedCount }
 */
export async function scanIndicatorLogic(rawInput: string, feedVersion: string | number) {
  const { ip, type, isIP, isIPv6, isCIDR, isHash, isURL, isDomain } = classifyIndicator(rawInput)

  if (type === 'invalid') {
    return { type: 'invalid', ip, isIP, isDomain, isHash, isURL, isIPv6, isCIDR, isMalicious: false, riskScore: 'Low', feedCount: 1 }
  }

  const scanType = type

  const RAW = getBaseUrl()
  let isMalicious = false
  let riskScore = 'Low'
  let feedCount: number | string = 1
  let isDisputed = false
  let disputeCount = 0
  let tags: string[] = []
  let matchedCidr: string | null = null

  try {
    let textData = ''
    let compareFn: CompareFn = stringCompare

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

    const result = binarySearchString(textData, ip, compareFn)

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
          tags = parts[3].split('|').filter((t) => t.trim() !== '' && t !== 'Mixed')
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
