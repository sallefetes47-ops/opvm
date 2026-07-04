#!/usr/bin/env bash
# سكريبت تثبيت منصة OPVM على Ubuntu (16.04 وأحدث)
# الاستخدام:  sudo bash install.sh
set -e

APP_DIR="/var/www/opvm"
NGINX_CONF="/etc/nginx/sites-available/opvm.conf"
SYSTEMD_UNIT="/etc/systemd/system/opvm.service"
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> تثبيت nginx..."
apt-get update
apt-get install -y nginx

echo "==> نسخ ملفات الواجهة إلى $APP_DIR ..."
mkdir -p "$APP_DIR"
cp -r "$BUNDLE_DIR/dist/." "$APP_DIR/"
chown -R www-data:www-data "$APP_DIR"

echo "==> إعداد nginx..."
cp "$BUNDLE_DIR/nginx/opvm.conf" "$NGINX_CONF"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/opvm.conf
rm -f /etc/nginx/sites-enabled/default || true
nginx -t

echo "==> تثبيت خدمة systemd (opvm.service) ..."
cp "$BUNDLE_DIR/systemd/opvm.service" "$SYSTEMD_UNIT"
systemctl daemon-reload

# تعطيل خدمة nginx الافتراضية لتفادي التعارض
systemctl disable --now nginx.service 2>/dev/null || true

# تمكين الخدمة وتشغيلها مباشرةً (enable --now)
# تُضمن تفعيل opvm تلقائياً بعد إعادة تشغيل النظام
systemctl enable --now opvm.service

echo "==> ضبط تدوير السجلات (journald + logrotate) لتجنّب امتلاء القرص..."
# 1) إعدادات journald خاصة بخدمة opvm
mkdir -p /etc/systemd/journald@opvm.conf.d
cp "$BUNDLE_DIR/systemd/opvm-journald.conf" /etc/systemd/journald@opvm.conf.d/00-opvm.conf

# إعدادات journald عامة كحد أمان (في حال لم يدعم الإصدار journald@)
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/00-opvm-limits.conf <<'EOF'
[Journal]
SystemMaxUse=500M
SystemKeepFree=1G
SystemMaxFileSize=50M
MaxRetentionSec=30day
MaxFileSec=1week
Compress=yes
Storage=persistent
EOF

systemctl restart systemd-journald || true

# 2) logrotate لسجلات nginx الخاصة بـ opvm
cp "$BUNDLE_DIR/logrotate/opvm" /etc/logrotate.d/opvm
chmod 0644 /etc/logrotate.d/opvm
# اختبار مبدئي (بدون تنفيذ فعلي)
logrotate -d /etc/logrotate.d/opvm >/dev/null 2>&1 || true

# 3) تحقق فعلي من عمل تدوير السجلات
echo "==> التحقق من عمل تدوير السجلات (logrotate) ..."
mkdir -p /var/log/nginx /var/log/opvm
TEST_LOG="/var/log/nginx/opvm_access.log"
# توليد سجل تجريبي بحجم يتجاوز حد التدوير لضمان التنفيذ
head -c 1048576 /dev/urandom | base64 > "$TEST_LOG" 2>/dev/null || \
    dd if=/dev/zero of="$TEST_LOG" bs=1M count=2 >/dev/null 2>&1
chown www-data:adm "$TEST_LOG" 2>/dev/null || true

# تنفيذ التدوير قسراً
if logrotate -f /etc/logrotate.d/opvm; then
    # التأكد من وجود ملف مدوَّر (opvm_access.log.1 أو .1.gz)
    if ls /var/log/nginx/opvm_access.log.1* >/dev/null 2>&1; then
        echo "✅ تدوير السجلات يعمل بنجاح."
        ls -lh /var/log/nginx/opvm_access.log* 2>/dev/null || true
    else
        echo "⚠️  تم تنفيذ logrotate لكن لم يُعثر على ملف مدوَّر — راجع الإعدادات."
    fi
else
    echo "❌ فشل تنفيذ logrotate — راجع /etc/logrotate.d/opvm"
fi



echo ""
echo "✅ تم التثبيت بنجاح."
echo ""
echo "الحالة:"
systemctl --no-pager status opvm.service | head -12 || true
echo ""
echo "افتح المتصفح على:  http://<عنوان-السيرفر>/"
echo ""
echo "أوامر مفيدة:"
echo "  sudo systemctl status opvm    # عرض الحالة"
echo "  sudo systemctl restart opvm   # إعادة التشغيل"
echo "  sudo journalctl -u opvm -f    # متابعة السجلات"
