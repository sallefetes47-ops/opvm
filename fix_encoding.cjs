const fs = require('fs');
const path = require('path');

// Clean Arabic replacements for any remaining corrupted text
const arabicFixes = {
  // LegalArchive
  'المراسيم والتعليمات': 'المراسيم والتعليمات',
  'أرشيف الوثائق القانونية': 'أرشيف الوثائق القانونية',
  'إضافة وثيقة': 'إضافة وثيقة',
  'استيراد من ملف': 'استيراد من ملف',
  'نوع الوثيقة': 'نوع الوثيقة',
  // Common
  'الكل': 'الكل',
  'مرسوم': 'مرسوم',
  'قرار': 'قرار',
  'تعليمة': 'تعليمة',
  'منشور': 'منشور',
  'قانون': 'قانون',
  'أمر': 'أمر',
  'سلة المحذوفات': 'سلة المحذوفات',
  'قائمة الوثائق': 'قائمة الوثائق',
  'ملف محذوف': 'ملف محذوف',
  'وثيقة': 'وثيقة',
  'الرقم': 'الرقم',
  'العنوان': 'العنوان',
  'النوع': 'النوع',
  'التاريخ': 'التاريخ',
  'كلمات مفتاحية': 'كلمات مفتاحية',
  'الإجراءات': 'الإجراءات',
  'معاينة الملف': 'معاينة الملف',
  'استرجاع': 'استرجاع',
  'حذف نهائي': 'حذف نهائي',
  'تعديل': 'تعديل',
  'تفاصيل الوثيقة': 'تفاصيل الوثيقة',
  'العنوان بالعربية': 'العنوان بالعربية',
  'العنوان بالفرنسية': 'العنوان بالفرنسية',
  'عرض': 'عرض',
  'لا توجد وثائق مطابقة': 'لا توجد وثائق مطابقة',
  'سلة المحذوفات فارغة': 'سلة المحذوفات فارغة',
  // Municipalities
  'غرداية': 'غرداية',
  'العطف': 'العطف',
  'بنورة': 'بنورة',
  'الضاية': 'الضاية',
  'متليلي': 'متليلي',
};

const srcDir = path.join(__dirname, 'src');
const rootFiles = ['index.html'];

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

function fixAndSave(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Apply Arabic fixes
    for (const [bad, good] of Object.entries(arabicFixes)) {
      // Simple pass-through to ensure encoding is clean
      if (content.includes(bad)) {
        content = content.split(bad).join(good);
      }
    }
    
    // Save with UTF-8 BOM
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const contentBuffer = Buffer.from(content, 'utf8');
    const withBOM = Buffer.concat([bom, contentBuffer]);
    fs.writeFileSync(filePath, withBOM);
    
    console.log(`✓ ${path.relative(__dirname, filePath)}`);
    return true;
  } catch (error) {
    console.error(`✗ ${filePath}: ${error.message}`);
    return false;
  }
}

console.log('Applying UTF-8 encoding with clean Arabic text...\n');

// Root files
rootFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) fixAndSave(filePath);
});

// All src files
const allFiles = findAllFiles(srcDir, ['.tsx', '.ts', '.html', '.css', '.json']);
allFiles.forEach(fixAndSave);

console.log('\n✅ Encoding complete!');
