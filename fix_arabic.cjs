const fs = require('fs');
const path = require('path');

// Map of corrupted text to clean Arabic
const replacements = {
  // Common corrupted patterns
  'ط§ظ„ظƒظ„': 'الكل',
  'ظ…ط±ط³ظˆظ…': 'مرسوم',
  'ظ‚ط±ط§ط±': 'قرار',
  'ظ…ظ†ط´ظˆط±': 'منشور',
  'ظ‚ط§ظ†ظˆظ†': 'قانون',
  'ط£ظ…ط±': 'أمر',
  'ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆف§ت': 'سلة المحذوفات',
  'ظ‚ط§ط¦ظ…ط© ط§ظ„ظˆط«ط§ط¦ظ‚': 'قائمة الوثائق',
  'ظ…ظ„ف ظ…ط­ط°ظˆف': 'ملف محذوف',
  'ظˆط«ي‚ط©': 'وثيقة',
  'ظ„ط§ تˆط¬ط¯ ظˆط«ط§ط¦ظ‚ ظ…ط·ط§ط¨‚ط©': 'لا توجد وثائق مطابقة',
  'ط§ظ„ط±‚ظ…': 'الرقم',
  'ط§ظ„ط¹ظ†ظˆط§ظ†': 'العنوان',
  'ط§ظ„ظ†ظˆط¹': 'النوع',
  'ط§ظ„ت§ط±ي®': 'التاريخ',
  'ظƒظ„ظ…ط§ت ظ…فتط§طي©': 'كلمات مفتاحية',
  'ط§ظ„ط¥ط¬ط±ط§ء§ط': 'الإجراءات',
  'ظ…ط¹ط§ي†ط© ط§ظ„ظ…ظ„ف ط§ظ„ط£طµظ„ي': 'معاينة الملف الأصلي',
  'ظ…ط¹ط§ي†ط© ط§ظ„ظ…ظ„ف': 'معاينة الملف',
  'ط§ط³ت±ط¬ط§ط¹': 'استرجاع',
  'ط­ط°ف ظ†ظ‡ط§ط¦ي': 'حذف نهائي',
  'ت¹ط¯يظ„': 'تعديل',
  'ط­ط°ف (ظ†‚ظ„ ظ„ظ„ط³ظ„ط©)': 'حذف (نقل للسلة)',
  'تفط§طµيظ„ ط§ظ„ظˆطي‚ط©': 'تفاصيل الوثيقة',
  'ط§ظ„ط¹ظ†ظˆط§ظ† ط¨ط§ظ„ط¹ط±طي©': 'العنوان بالعربية',
  'ط§ظ„ط¹ظ†ظˆط§ظ† ط¨ط§ظ„فط±ظ†ط³ي©': 'العنوان بالفرنسية',
  'ط³ظ„ط© ط§ظ„ظ…ط­ط°ظˆف§ت ف§ط±غ©': 'سلة المحذوفات فارغة',
  'ط¹ط±ط¶': 'عرض',
  'ظˆط«ي‚ط©': 'وثيقة',
  'ت¹ظ„ي…ط©': 'تعليمة',
};

const filesToFix = [
  'src/pages/LegalArchive.tsx',
];

const srcDir = path.join(__dirname, 'src');

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    
    for (const [corrupted, clean] of Object.entries(replacements)) {
      content = content.split(corrupted).join(clean);
    }
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`✗ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

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

console.log('Fixing Arabic text encoding...\n');

// Fix specific files
filesToFix.forEach(fixFile);

// Also fix all tsx/ts files in src
const allFiles = findAllFiles(srcDir, ['.tsx', '.ts']);
allFiles.forEach(fixFile);

console.log('\nDone!');
