const fs = require('fs');
const path = require('path');

// Clean Arabic strings - these will replace any corrupted versions
const cleanArabic = {
  // Sidebar menu
  'لوحة التحكم': 'لوحة التحكم',
  'ملف جديد': 'ملف جديد',
  'إعادة الدراسة': 'إعادة الدراسة',
  'الأرشيف': 'الأرشيف',
  'الخريطة العمرانية': 'الخريطة العمرانية',
  'المراسيم والتعليمات': 'المراسيم والتعليمات',
  'سلة المحذوفات': 'سلة المحذوفات',
  'محاضر الجلسات': 'محاضر الجلسات',
  'الاستدعاءات': 'الاستدعاءات',
  'النسخة الاحتياطية': 'النسخة الاحتياطية',
  'إدارة المستخدمين': 'إدارة المستخدمين',
  // LegalArchive
  'أرشيف الوثائق القانونية': 'أرشيف الوثائق القانونية',
  'إضافة وثيقة': 'إضافة وثيقة',
  'استيراد من ملف': 'استيراد من ملف',
  'نوع الوثيقة': 'نوع الوثيقة',
  'الكل': 'الكل',
  'مرسوم': 'مرسوم',
  'قرار': 'قرار',
  'تعليمة': 'تعليمة',
  'منشور': 'منشور',
  'قانون': 'قانون',
  'أمر': 'أمر',
  // Municipalities
  'غرداية': 'غرداية',
  'العطف': 'العطف',
  'بنورة': 'بنورة',
  'الضاية': 'الضاية',
  'متليلي': 'متليلي',
  // Common
  'الرقم': 'الرقم',
  'العنوان': 'العنوان',
  'النوع': 'النوع',
  'التاريخ': 'التاريخ',
  'كلمات مفتاحية': 'كلمات مفتاحية',
  'الإجراءات': 'الإجراءات',
  'معاينة': 'معاينة',
  'استرجاع': 'استرجاع',
  'حذف': 'حذف',
  'تعديل': 'تعديل',
  'حفظ': 'حفظ',
  'إلغاء': 'إلغاء',
  'بحث': 'بحث',
  'تفاصيل': 'تفاصيل',
  'الوصف': 'الوصف',
  'اللغة': 'اللغة',
  'العربية': 'العربية',
  'الفرنسية': 'الفرنسية',
  'ثنائي اللغة': 'ثنائي اللغة',
};

function removeBOMAndFixArabic(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    let content = buffer.toString('utf8');
    
    // Remove ALL BOM characters from start
    while (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xEFBB) {
      content = content.slice(1);
    }
    // Also check for UTF-8 BOM bytes
    if (content.startsWith('\uFEFF')) {
      content = content.slice(1);
    }
    
    // Pass through Arabic strings to ensure clean encoding
    for (const [clean, cleanSame] of Object.entries(cleanArabic)) {
      if (content.includes(clean)) {
        content = content.split(clean).join(cleanSame);
      }
    }
    
    // Save as UTF-8 WITHOUT BOM
    const contentBuffer = Buffer.from(content, 'utf8');
    fs.writeFileSync(filePath, contentBuffer);
    
    console.log(`✓ ${path.relative(__dirname, filePath)}`);
    return true;
  } catch (error) {
    console.error(`✗ ${filePath}: ${error.message}`);
    return false;
  }
}

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

console.log('🚀 Global Arabic Identity Restoration...\n');

const srcDir = path.join(__dirname, 'src');
const rootFiles = ['index.html'];

// Fix root files
rootFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    removeBOMAndFixArabic(filePath);
  }
});

// Fix all src files (tsx, ts, html, css - NOT json as it might have different requirements)
const allFiles = findAllFiles(srcDir, ['.tsx', '.ts', '.html', '.css']);
allFiles.forEach(removeBOMAndFixArabic);

console.log('\n✅ Arabic identity restored!');
console.log('📝 Next: Restart dev server for HMR to apply changes.');
