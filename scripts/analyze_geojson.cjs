const fs = require('fs');
const path = require('path');

let raw = fs.readFileSync(path.join(__dirname, '..', 'public', 'mzab_cadastre_map.geojson'), 'utf8');

// Check character at the error position
const pos = 72262190;
console.log('File length:', raw.length);
console.log('Chars around error position:');
console.log('Before:', JSON.stringify(raw.substring(pos - 50, pos)));
console.log('At:', JSON.stringify(raw.substring(pos, pos + 50)));

// Try trimming and parsing
raw = raw.trim();
try {
  const data = JSON.parse(raw);
  console.log('Trimmed parse succeeded! Features:', data.features.length);
} catch(e) {
  console.log('Still fails:', e.message);
  // Look for BOM or other issues
  console.log('First char code:', raw.charCodeAt(0));
  if (raw.charCodeAt(0) === 0xFEFF) {
    raw = raw.substring(1);
    try {
      const data = JSON.parse(raw);
      console.log('BOM-stripped parse succeeded! Features:', data.features.length);
    } catch(e2) {
      console.log('Still fails after BOM strip');
    }
  }
}
