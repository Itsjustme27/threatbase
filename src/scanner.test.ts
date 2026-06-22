import { describe, it, expect } from 'vitest'
import {
  classifyIndicator,
  ipv4ToLong,
  findMatchingCidr,
  binarySearchString,
  ipCsvCompare,
  stringCompare,
} from './scanner'

describe('classifyIndicator', () => {
  it('classifies IPv4 addresses', () => {
    expect(classifyIndicator('8.8.8.8').type).toBe('IP Address')
    expect(classifyIndicator('1.1.1.1').isIP).toBe(true)
  })

  it('classifies IPv6 addresses', () => {
    const r = classifyIndicator('2001:db8::1')
    expect(r.type).toBe('IPv6 Address')
    expect(r.isIPv6).toBe(true)
  })

  it('classifies CIDR blocks', () => {
    expect(classifyIndicator('10.0.0.0/8').type).toBe('CIDR Block')
  })

  it('classifies domains and URLs', () => {
    expect(classifyIndicator('example.com').type).toBe('Domain')
    expect(classifyIndicator('http://evil.example/x').type).toBe('URL')
  })

  it('accepts only the three standard hash lengths (MD5/SHA1/SHA256)', () => {
    expect(classifyIndicator('d41d8cd98f00b204e9800998ecf8427e').type).toBe('File Hash') // 32
    expect(classifyIndicator('a'.repeat(40)).type).toBe('File Hash') // 40
    expect(classifyIndicator('a'.repeat(64)).type).toBe('File Hash') // 64
  })

  it('no longer misroutes odd-length hex to the hash feed (fix #8)', () => {
    expect(classifyIndicator('a'.repeat(56)).type).not.toBe('File Hash')
    expect(classifyIndicator('a'.repeat(56)).type).toBe('invalid')
  })

  it('flags unparseable input as invalid', () => {
    expect(classifyIndicator('256.1.1.1').type).toBe('invalid')
    expect(classifyIndicator('not a thing!!').type).toBe('invalid')
  })
})

describe('ipv4ToLong', () => {
  it('converts valid addresses', () => {
    expect(ipv4ToLong('0.0.0.0')).toBe(0)
    expect(ipv4ToLong('255.255.255.255')).toBe(4294967295)
    expect(ipv4ToLong('1.2.3.4')).toBe(16909060)
  })

  it('rejects malformed addresses', () => {
    expect(ipv4ToLong('1.2.3')).toBeNull()
    expect(ipv4ToLong('1.2.3.256')).toBeNull()
  })
})

describe('findMatchingCidr', () => {
  const cidrs = '# comment\n10.0.0.0/8\n192.168.0.0/16\n2001:db8::/32\n'

  it('matches an IP inside a listed subnet', () => {
    expect(findMatchingCidr(cidrs, ipv4ToLong('10.5.5.5'))).toBe('10.0.0.0/8')
  })

  it('returns null when no subnet contains the IP', () => {
    expect(findMatchingCidr(cidrs, ipv4ToLong('8.8.8.8'))).toBeNull()
  })

  it('skips IPv6 ranges and comments for IPv4 tests', () => {
    expect(findMatchingCidr(cidrs, ipv4ToLong('172.16.0.1'))).toBeNull()
  })
})

describe('binarySearchString', () => {
  const ipFeed = [
    'ip,feedcount,risk,tags',
    '1.1.1.1,2,High,C2',
    '8.8.8.8,1,Low,Tor',
    '200.0.0.1,3,Medium,Spam',
  ].join('\n')

  it('finds present IPs in a numerically sorted CSV feed', () => {
    expect(binarySearchString(ipFeed, '8.8.8.8', ipCsvCompare)).toBe('8.8.8.8,1,Low,Tor')
    expect(binarySearchString(ipFeed, '1.1.1.1', ipCsvCompare)).toBe('1.1.1.1,2,High,C2')
    expect(binarySearchString(ipFeed, '200.0.0.1', ipCsvCompare)).toBe('200.0.0.1,3,Medium,Spam')
  })

  it('returns null for absent IPs and never returns the header', () => {
    expect(binarySearchString(ipFeed, '9.9.9.9', ipCsvCompare)).toBeNull()
    expect(binarySearchString(ipFeed, 'ip', ipCsvCompare)).toBeNull()
  })

  it('finds present entries in a lexically sorted feed (domains/hashes)', () => {
    const domainFeed = ['aaa.com', 'bbb.com', 'ccc.com'].join('\n')
    expect(binarySearchString(domainFeed, 'bbb.com', stringCompare)).toBe('bbb.com')
    expect(binarySearchString(domainFeed, 'zzz.com', stringCompare)).toBeNull()
  })
})
