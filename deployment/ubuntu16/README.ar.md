# تصدير المنصة إلى Ubuntu 16.04 LTS

## تسجيل الدخول الافتراضي

- اسم المستخدم: `OPVM`
- كلمة المرور: `OPVM2026`

يُربط اسم المستخدم داخلياً بالبريد `opvm@opvm.local`.
عند أول تسجيل دخول من خلال الواجهة المتصلة بـ Supabase السحابي، يتم
إنشاء هذا الحساب تلقائياً عبر دالة `bootstrap-opvm-user` ومنحه دور
`admin`. أما في النشر المحلي على الخادم، يجب إنشاء نفس الحساب يدوياً
في قاعدة `auth.users` بنفس البريد وكلمة المرور، ثم إضافة صف في
`public.user_roles` بدور `admin`.

## الملخص

هذا المشروع عبارة عن واجهة `Vite + React` مرتبطة بخدمات `Supabase` التالية:

- قاعدة بيانات PostgreSQL
- المصادقة `Auth`
- الدوال `Edge Functions`
- سياسات صلاحيات `RLS`

لذلك فإن نقل المنصة "مع قاعدة البيانات" إلى خادم محلي لا يقتصر على نسخ مجلد `dist`.

## قيد مهم جداً

`Ubuntu 16.04 LTS` نظام قديم جداً وانتهى دعمه القياسي في أبريل 2021.  
تشغيل نسخة محلية حديثة من `Supabase` عليه سيكون عالي المخاطرة، وقد يتعطل بسبب:

- إصدارات Docker و Docker Compose القديمة
- متطلبات Node الحديثة لبناء الواجهة
- مكونات Supabase الحديثة التي تتطلب نظاماً أحدث

## المسار الموصى به

إذا أردت نسخة محلية كاملة مع قاعدة البيانات والمصادقة والدوال:

1. استخدم خادماً أحدث مثل `Ubuntu 22.04 LTS` أو `Ubuntu 24.04 LTS`.
2. شغّل `Supabase` محلياً على الخادم الأحدث.
3. طبّق ملفات `migrations` الموجودة في هذا المشروع.
4. انشر ملفات الواجهة المبنية من مجلد `dist`.
5. استورد البيانات من النسخة الاحتياطية `JSON` من داخل صفحة النسخ الاحتياطي في المنصة.

## المسار الممكن على Ubuntu 16.04

إذا كنت مضطراً لاستخدام `Ubuntu 16.04`، فالمسار الأكثر واقعية هو:

1. استضافة الواجهة فقط على الخادم المحلي عبر `nginx`.
2. إبقاء `Supabase` على الخادم الحالي أو الخدمة السحابية الحالية.
3. تحديث ملف `.env` في الحزمة بقيم الاتصال الحالية.

هذا المسار لا يحقق "قاعدة بيانات محلية كاملة"، لكنه هو الأكثر استقراراً على هذا النظام القديم.

## ما الذي تم تجهيزه داخل هذا المستودع؟

تمت إضافة العناصر التالية:

- ملف إعدادات مثال: `.env.example`
- إعداد `nginx`: `deployment/nginx/opvm.conf`
- سكريبت تصدير حزمة النقل: `scripts/export-ubuntu-bundle.ps1`

## إنشاء حزمة التصدير

من جهاز التطوير الحالي شغّل:

```powershell
npm run export:ubuntu16
```

سيتم إنشاء مجلد بالشكل التالي:

```text
release/opvm-ubuntu16-bundle/
```

ومحتوياته تشمل:

- `dist/` نسخة الواجهة الجاهزة للنشر
- `supabase/migrations/` مخطط قاعدة البيانات
- `supabase/functions/` الدوال المستخدمة
- `.env.example`
- إعداد `nginx`
- هذا الدليل

## خطوات النشر على خادم Ubuntu 16.04

### 1) نقل الحزمة

انسخ المجلد `release/opvm-ubuntu16-bundle` إلى الخادم.

### 2) تثبيت nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 3) نسخ ملفات الواجهة

```bash
sudo mkdir -p /var/www/opvm
sudo cp -r opvm-ubuntu16-bundle/dist /var/www/opvm/
```

### 4) تفعيل إعداد nginx

```bash
sudo cp opvm-ubuntu16-bundle/nginx/opvm.conf /etc/nginx/sites-available/opvm.conf
sudo ln -sf /etc/nginx/sites-available/opvm.conf /etc/nginx/sites-enabled/opvm.conf
sudo nginx -t
sudo systemctl restart nginx
```

### 5) إعداد متغيرات البيئة

أنشئ ملف `.env` على جهاز البناء قبل تنفيذ `npm run build` أو عدّل القيم ثم أعد التصدير من جديد.

القيم المطلوبة:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ADMIN_PASSWORD`
- `VITE_GOOGLE_MAPS_API_KEY` إذا كنت تحتاج خرائط Google

## كيف تنقل البيانات؟

لأن المشروع يعتمد على Supabase، يوجد فرق بين:

- `schema`: موجود بالفعل في `supabase/migrations`
- `data`: يجب تصديرها من المنصة نفسها

لنقل البيانات الفعلية:

1. افتح صفحة النسخ الاحتياطي داخل التطبيق.
2. نفذ `تصدير JSON`.
3. احتفظ بالملف الناتج مع حزمة النشر.
4. بعد تجهيز البيئة الجديدة، استورد الملف من صفحة النسخ الاحتياطي.

## إذا أردت قاعدة البيانات محلياً فعلاً

في هذه الحالة أوصيك بعدم استخدام `Ubuntu 16.04`.  
استخدم نظاماً أحدث ثم نفذ هذا التسلسل:

1. تثبيت Docker و Supabase CLI.
2. تشغيل `supabase start`.
3. تطبيق ملفات `supabase/migrations`.
4. نشر `supabase/functions`.
5. تعديل `VITE_SUPABASE_URL` و `VITE_SUPABASE_PUBLISHABLE_KEY`.
6. بناء الواجهة من جديد ثم نشرها.

## اختبار التثبيت بدون تعديل النظام (وضع المحاكاة)

يقدّم `install.sh` وضع محاكاة يختبر تدوير السجلات (journald + logrotate) داخل دليل مؤقت فقط، دون تغيير إعدادات النظام النهائية.

### متغيرات التحكم

- `OPVM_SIMULATE=1` — تفعيل وضع المحاكاة.
- `OPVM_SIM_DIR=/مسار/دليل` — تحديد دليل مؤقت ثابت.
- `OPVM_SIM_PREFIX=<اسم>` — بادئة اسم الدليل المؤقت (`opvm-simulate-XXXXXX`).
- `OPVM_SIM_TMPDIR=/مسار` — جذر بديل لـ `mktemp`.
- `OPVM_SIM_KEEP=1` — الاحتفاظ بالدليل المؤقت بعد الانتهاء للتفتيش.

### أمثلة تشغيل

تشغيل المحاكاة بإعدادات افتراضية:

```bash
sudo OPVM_SIMULATE=1 bash install.sh
```

أو باستخدام الخيار المختصر:

```bash
sudo bash install.sh --simulate
```

تحديد بادئة وجذر مخصص للدليل المؤقت:

```bash
sudo OPVM_SIMULATE=1 OPVM_SIM_PREFIX=opvm-test OPVM_SIM_TMPDIR=/var/tmp bash install.sh
```

تحديد مسار الدليل المؤقت يدوياً والاحتفاظ به بعد الاختبار:

```bash
sudo OPVM_SIMULATE=1 OPVM_SIM_DIR=/var/tmp/opvm-check OPVM_SIM_KEEP=1 bash install.sh
```

الاحتفاظ بدليل المحاكاة الافتراضي بعد الاختبار (مفيد للتفتيش):

```bash
sudo OPVM_SIMULATE=1 OPVM_SIM_KEEP=1 bash install.sh
```

الاحتفاظ بدليل محاكاة ببادئة مخصصة في `/var/tmp`:

```bash
sudo OPVM_SIMULATE=1 OPVM_SIM_KEEP=1 OPVM_SIM_PREFIX=opvm-debug OPVM_SIM_TMPDIR=/var/tmp bash install.sh
```

سيكون الخرج مشابهاً لما يلي (عند عدم الاحتفاظ):

```text
🧪 وضع المحاكاة مُفعَّل — لن يتم تعديل إعدادات journald/logrotate النهائية.
   دليل المحاكاة: /tmp/opvm-simulate-a1B2c3
...
✅ [محاكاة] تدوير logrotate يعمل بنجاح.
✅ [محاكاة] سجلات opvm-sim مرئية في journald.
🧹 تنظيف دليل المحاكاة: /tmp/opvm-simulate-a1B2c3
```

وعند استخدام `OPVM_SIM_KEEP=1` سيظهر بدلاً من تنظيف الدليل:

```text
📁 الاحتفاظ بدليل المحاكاة: /tmp/opvm-simulate-a1B2c3
```

## ملاحظة مهمة

هذا المستودع لا يحتوي على بيانات قاعدة البيانات نفسها بشكل صريح، بل يحتوي على:

- بنية القاعدة
- الدوال
- الواجهة

أما البيانات الحية الحالية، فيجب إخراجها من النظام العامل عبر وظيفة النسخ الاحتياطي أو من خادم Supabase الحالي مباشرة.
