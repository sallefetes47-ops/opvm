import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.resolve(__dirname, '../src/data/mzab_cadastre_map.json');
const text = fs.readFileSync(filePath, 'utf-8');

// Split on the boundary: "}\n{" where the second starts a new FeatureCollection
const splitRegex = /\}\s*\{\s*"type"\s*:\s*"FeatureCollection"/;
const match = splitRegex.exec(text);

if (!match) {
  console.log('No split found — file may already be valid JSON');
  // Try parsing as-is
  try {
    JSON.parse(text);
    console.log('Valid JSON, no action needed');
    process.exit(0);
  } catch (e) {
    console.error('Invalid JSON and no split found:', e.message);
    process.exit(1);
  }
}

const splitPos = match.index + 1; // after the first }
const block1 = text.substring(0, splitPos).trim();
const block2 = text.substring(splitPos).trim();

console.log(`Block 1: ${block1.length} chars`);
console.log(`Block 2: ${block2.length} chars`);

const fc1 = JSON.parse(block1);
const fc2 = JSON.parse(block2);

console.log(`FC1 features: ${fc1.features.length}`);
console.log(`FC2 features: ${fc2.features.length}`);

// Merge features into first FeatureCollection
fc1.features = fc1.features.concat(fc2.features);

console.log(`Merged features: ${fc1.features.length}`);

// Write merged result
fs.writeFileSync(filePath, JSON.stringify(fc1), 'utf-8');
console.log('✅ Merged and saved successfully');
