const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'mzab_cadastre_map.geojson'), 'utf8'));

console.log('Total features:', data.features.length);

const communes = [...new Set(data.features.map(f => f.properties.COMMUNE))].sort();
console.log('Communes:', communes.join(', '));

const propKeys = Object.keys(data.features[0].properties);
console.log('Property keys:', propKeys.join(', '));

console.log('\nSample properties (first 3):');
data.features.slice(0, 3).forEach((f, i) => {
  console.log(`Feature ${i}:`, JSON.stringify(f.properties));
});

// Check sample sections and ilots
const sampleCommune = communes[0];
const communeFeatures = data.features.filter(f => f.properties.COMMUNE === sampleCommune);
const sections = [...new Set(communeFeatures.map(f => f.properties.SECTION))].sort((a, b) => a - b);
console.log(`\nCommune ${sampleCommune}: ${communeFeatures.length} features, sections: ${sections.join(', ')}`);
