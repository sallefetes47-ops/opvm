# التثبيت المحلي الكامل (التطبيق + قاعدة البيانات) على سيرفر داخلي

هذا الدليل يحوّل المنصة كاملةً لتعمل على سيرفر داخلي بدون أي اعتماد على
السحابة: قاعدة بيانات PostgreSQL، خدمة المصادقة Auth، الواجهة Vite،
كل شيء داخل حاويات Docker على نفس الجهاز.

> ⚠️ تنبيه: ننصح باستعمال **Ubuntu 22.04 LTS** أو **Ubuntu 24.04 LTS**.
> نظام Ubuntu 16.04 قديم جداً، وحاويات Supabase الحديثة لا تعمل عليه
> بثبات (Docker و glibc قديمين). إن كنت مضطراً للبقاء على 16.04، شغّل
> الواجهة فقط على نفس السيرفر عبر nginx، واترك قاعدة البيانات على
> جهاز آخر أحدث.

## المتطلبات على السيرفر

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin nginx git
sudo systemctl enable --now docker
```

## 1) تجهيز الحزمة

من جهاز التطوير شغّل:

```bash
npm install
npm run build
mkdir -p deployment/self-hosted/web
cp -r dist/* deployment/self-hosted/web/
cp -r supabase/migrations deployment/self-hosted/supabase/
```

## 2) نقل المجلد إلى السيرفر

```bash
scp -r deployment/self-hosted user@SERVER:/opt/opvm
ssh user@SERVER
cd /opt/opvm
cp .env.example .env
nano .env   # عدّل كلمات السر والسر JWT
```

> أنشئ `JWT_SECRET` قوياً مثلاً عبر:
> `openssl rand -base64 48`

## 3) إقلاع كامل الخدمات

```bash
docker compose up -d
docker compose ps
```

سيتم:

- إنشاء قاعدة بيانات Postgres محلية على المنفذ 5432
- تشغيل GoTrue (المصادقة) و PostgREST (واجهة REST) خلف Kong على المنفذ 8000
- تشغيل nginx على المنفذ 80 ليخدم الواجهة من `./web`

## 4) إنشاء مستخدم OPVM الافتراضي

```bash
docker compose exec -T db psql -U postgres < scripts/seed-opvm-user.sql
```

- اسم المستخدم في الواجهة: `OPVM`
- كلمة المرور: `OPVM2026`

(يمكنك بعد أول دخول تغيير كلمة المرور من شاشة إدارة المستخدمين.)

## 5) ربط الواجهة بـ Supabase المحلي

عدّل ملف `.env` في **مشروع الواجهة قبل البناء**:

```env
VITE_SUPABASE_URL=http://SERVER_IP:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<anon_jwt_signed_with_JWT_SECRET>
```

لإنشاء مفتاح `anon` المحلي بنفس سر JWT المستعمل في `.env`:

```bash
docker run --rm node:20-alpine sh -c '
  npx --yes jsonwebtoken-cli sign \
    "{\"role\":\"anon\",\"iss\":\"supabase\",\"iat\":$(date +%s)}" \
    --secret "$JWT_SECRET"'
```

> أعد بناء الواجهة (`npm run build`) بعد كل تعديل لقيم `VITE_*`
> ثم انسخ `dist/*` إلى `/opt/opvm/web/`.

## 6) استيراد البيانات الحالية

من الإصدار السحابي الحالي:

1. افتح صفحة **النسخ الاحتياطي** في التطبيق.
2. اضغط **تصدير JSON**.
3. انسخ الملف إلى السيرفر المحلي.
4. سجّل دخولاً كـ OPVM وافتح صفحة النسخ الاحتياطي → **استيراد JSON**.

## 7) النسخ الاحتياطي اليومي لقاعدة البيانات

```bash
sudo tee /etc/cron.daily/opvm-backup >/dev/null <<'EOF'
#!/bin/bash
DEST=/var/backups/opvm
mkdir -p "$DEST"
cd /opt/opvm
docker compose exec -T db pg_dump -U postgres postgres \
  | gzip > "$DEST/opvm-$(date +%F).sql.gz"
find "$DEST" -name 'opvm-*.sql.gz' -mtime +30 -delete
EOF
sudo chmod +x /etc/cron.daily/opvm-backup
```

## ملاحظات أمنية

- لا تفتح المنفذ 5432 على الإنترنت — اتركه على شبكة المكتب فقط.
- ضع nginx خلف HTTPS داخلي (شهادة self-signed أو Let's Encrypt إذا كان
  السيرفر مرئياً من الخارج).
- غيّر كلمة مرور OPVM فور أول تسجيل دخول.
- خذ نسخة من `.env` في مكان آمن — فقدان `JWT_SECRET` يعني إعادة إصدار
  المفاتيح وإعادة بناء الواجهة.

## ملفات الحزمة

```
deployment/self-hosted/
├── docker-compose.yml      # كل الخدمات (db / auth / rest / kong / web)
├── kong.yml                # توجيه /auth/v1 و /rest/v1
├── nginx.conf              # SPA fallback للواجهة
├── .env.example            # المتغيرات السرية
├── scripts/seed-opvm-user.sql
└── web/                    # ضع هنا مخرجات npm run build
```
