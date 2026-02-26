const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const rootFiles = ['index.html'];

// Find all tsx and ts files
function findAllFiles(dir, extensions) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(findAllFiles(file, extensions));
    } else {
      if (extensions.some(ext => file.endsWith(ext))) {
        results.push(file);
      }
    }
  });
  return results;
}

function saveWithBOM(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // UTF-8 with BOM: EF BB BF
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const contentBuffer = Buffer.from(content, 'utf8');
    const withBOM = Buffer.concat([bom, contentBuffer]);
    fs.writeFileSync(filePath, withBOM);
    console.log(`✓ Saved with BOM: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`✗ Error saving ${filePath}:`, error.message);
    return false;
  }
}

console.log('Saving all project files with UTF-8 BOM...\n');

// Fix root files
rootFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    saveWithBOM(filePath);
  }
});

// Fix all src files
const allFiles = findAllFiles(srcDir, ['.tsx', '.ts', '.html', '.css', '.json']);
allFiles.forEach(saveWithBOM);

console.log('\nDone!');
