export class BloomFilter {
  private bitArray: Uint8Array;
  private size: number;
  private hashCount: number;

  constructor(n: number, p: number = 0.01) {
    // Optimal size of bit array (m)
    // m = -(n * ln(p)) / (ln(2)^2)
    this.size = Math.max(8, Math.ceil(-(n * Math.log(p)) / (Math.LN2 * Math.LN2)));
    
    // Optimal number of hash functions (k)
    // k = (m / n) * ln(2)
    this.hashCount = Math.max(1, Math.round((this.size / n) * Math.LN2));
    
    this.bitArray = new Uint8Array(Math.ceil(this.size / 8));
  }

  // FNV-1a inspired hash 1
  private hash1(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // Alternate hash for double-hashing
  private hash2(str: string): number {
    let h = 0x12345678;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x5bd1e995);
    }
    return h >>> 0;
  }

  add(item: string): void {
    const h1 = this.hash1(item);
    const h2 = this.hash2(item);

    for (let i = 0; i < this.hashCount; i++) {
      const h = Math.abs((h1 + Math.imul(i, h2)) % this.size);
      const byteIndex = h >>> 3; // equivalent to Math.floor(h / 8)
      const bitIndex = h & 7;    // equivalent to h % 8
      this.bitArray[byteIndex] |= (1 << bitIndex);
    }
  }

  has(item: string): boolean {
    const h1 = this.hash1(item);
    const h2 = this.hash2(item);

    for (let i = 0; i < this.hashCount; i++) {
      const h = Math.abs((h1 + Math.imul(i, h2)) % this.size);
      const byteIndex = h >>> 3;
      const bitIndex = h & 7;
      if ((this.bitArray[byteIndex] & (1 << bitIndex)) === 0) {
        return false;
      }
    }
    return true;
  }
}
