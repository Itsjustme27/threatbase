import { describe, it, expect } from 'vitest'
import { isValidPublicIp, isValidCategory, MAX_CATEGORY_LENGTH } from './apiValidation'

describe('isValidPublicIp', () => {
  it('accepts publicly routable IPv4', () => {
    expect(isValidPublicIp('8.8.8.8')).toBe(true)
    expect(isValidPublicIp('1.1.1.1')).toBe(true)
  })

  it('rejects private / reserved / loopback / link-local IPv4', () => {
    expect(isValidPublicIp('10.0.0.1')).toBe(false)
    expect(isValidPublicIp('192.168.1.1')).toBe(false)
    expect(isValidPublicIp('172.16.0.1')).toBe(false)
    expect(isValidPublicIp('127.0.0.1')).toBe(false)
    expect(isValidPublicIp('169.254.1.1')).toBe(false)
  })

  it('rejects malformed IPv4', () => {
    expect(isValidPublicIp('256.1.1.1')).toBe(false)
    expect(isValidPublicIp('1.2.3')).toBe(false)
    expect(isValidPublicIp('')).toBe(false)
  })

  it('handles IPv6 public vs reserved', () => {
    expect(isValidPublicIp('2001:4860:4860::8888')).toBe(true)
    expect(isValidPublicIp('::1')).toBe(false)
    expect(isValidPublicIp('fd00::1')).toBe(false)
  })
})

describe('isValidCategory', () => {
  it('accepts short alphanumeric labels with safe punctuation', () => {
    expect(isValidCategory('Malware')).toBe(true)
    expect(isValidCategory('C2/Botnet')).toBe(true)
    expect(isValidCategory('Brute-Force')).toBe(true)
  })

  it('rejects empty, overlong, or markup-bearing labels', () => {
    expect(isValidCategory('')).toBe(false)
    expect(isValidCategory('a'.repeat(MAX_CATEGORY_LENGTH + 1))).toBe(false)
    expect(isValidCategory('<script>')).toBe(false)
    expect(isValidCategory('bad;drop')).toBe(false)
  })
})
