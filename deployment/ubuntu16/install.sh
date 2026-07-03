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
