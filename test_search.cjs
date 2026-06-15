const fs = require('fs');

function stringCompare(query, line) {
  if (line.startsWith('#') || line.startsWith('ip,')) return 1;
  const key = line.split(',')[0];
  if (query < key) return -1;
  if (query > key) return 1;
  return 0;
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

const text = fs.readFileSync('ioc/malicious_hashes_0.txt', 'utf8');
const query = "00000077553a5b27a610ac98f29563bbd6e0decc020c2d49e4fa0d89197e7fd8";
console.log("Searching for", query);
console.log("Result:", binarySearchString(text, query, stringCompare));
