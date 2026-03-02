import { createClient } from '@supabase/supabase-js';

// استخدام import.meta.env بدلاً من process.env لأننا في Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// حماية لمنع الانهيار الكلي (White Screen)
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ تحذير: مفاتيح Supabase مفقودة. تأكد من إعداد ملف .env بشكل صحيح.");
}

// تصدير العميل مع قيم افتراضية لمنع الخطأ 'supabaseKey is required'
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);