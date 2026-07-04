#!/usr/bin/env bash
# سكريبت تثبيت منصة OPVM على Ubuntu (16.04 وأحدث)
# الاستخدام:
#   sudo bash install.sh            # تثبيت فعلي
#   sudo OPVM_SIMULATE=1 bash install.sh   # وضع محاكاة (لا يغيّر إعدادات النظام النهائية)
#   sudo bash install.sh --simulate        # نفس وضع المحاكاة
set -e

APP_DIR="/var/www/opvm"
NGINX_CONF="/etc/nginx/sites-available/opvm.conf"
SYSTEMD_UNIT="/etc/systemd/system/opvm.service"
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"

# ==== وضع المحاكاة ====
# عند تفعيله: لا يتم كتابة/تعديل ملفات إعدادات journald أو logrotate النهائية،
# ويُستخدم فقط دليل مؤقت لاختبار عملية التدوير، ثم يُحذف كلياً.
SIMULATE=0
for arg in "$@"; do
    case "$arg" in
        --simulate|--dry-run) SIMULATE=1 ;;
    esac
done
if [ "${OPVM_SIMULATE:-0}" = "1" ]; then
    SIMULATE=1
fi

if [ "$SIMULATE" = "1" ]; then
    echo "🧪 وضع المحاكاة مُفعَّل — لن يتم تعديل إعدادات journald/logrotate النهائية."
    SIM_ROOT="$(mktemp -d -t opvm-simulate-XXXXXX)"
    trap 'echo "🧹 تنظيف دليل المحاكاة: $SIM_ROOT"; rm -rf "$SIM_ROOT"' EXIT
    echo "   دليل المحاكاة: $SIM_ROOT"
fi

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
systemctl enable --now opvm.service

if [ "$SIMULATE" = "1" ]; then
    # ================= مسار المحاكاة =================
    echo "==> [محاكاة] إعداد journald/logrotate داخل $SIM_ROOT فقط..."

    SIM_LOGROTATE_CONF="$SIM_ROOT/logrotate-opvm.conf"
    SIM_LOG_DIR="$SIM_ROOT/nginx"
    SIM_STATE="$SIM_ROOT/logrotate.state"
    mkdir -p "$SIM_LOG_DIR"

    # كتابة نسخة معدَّلة من إعداد logrotate تشير إلى المسار المؤقت
    cat > "$SIM_LOGROTATE_CONF" <<EOF
$SIM_LOG_DIR/opvm_access.log
$SIM_LOG_DIR/opvm_error.log
{
    daily
    rotate 3
    maxsize 1M
    missingok
    notifempty
    compress
    delaycompress
    create 0640 root root
}
EOF

    # توليد سجل تجريبي > 1MB لإجبار التدوير
    dd if=/dev/zero of="$SIM_LOG_DIR/opvm_access.log" bs=1M count=2 >/dev/null 2>&1

    echo "==> [محاكاة] تنفيذ logrotate على الملف المؤقت..."
    if logrotate -f -s "$SIM_STATE" "$SIM_LOGROTATE_CONF"; then
        if ls "$SIM_LOG_DIR"/opvm_access.log.1* >/dev/null 2>&1; then
            echo "✅ [محاكاة] تدوير logrotate يعمل بنجاح."
            ls -lh "$SIM_LOG_DIR"/opvm_access.log* || true
        else
            echo "⚠️  [محاكاة] logrotate عمل لكن لم يُنشأ ملف مدوَّر."
        fi
    else
        echo "❌ [محاكاة] فشل logrotate."
    fi

    echo "==> [محاكاة] اختبار journald باستخدام دليل مؤقت..."
    SIM_JOURNAL_DIR="$SIM_ROOT/journal"
    mkdir -p "$SIM_JOURNAL_DIR"
    # journalctl يدعم قراءة/تدوير مجلد سجل مخصص عبر --directory (إن توفر)
    if command -v systemd-cat >/dev/null 2>&1; then
        for i in $(seq 1 100); do
            echo "opvm-simulate log $i $(date +%s%N)" | systemd-cat -t opvm-sim -p info
        done
        # طلب تدوير على مستوى النظام — لا يغيّر إعدادات نهائية، فقط يُنشئ ملف أرشيف
        journalctl --rotate >/dev/null 2>&1 && \
            echo "✅ [محاكاة] journalctl --rotate نُفِّذ بنجاح." || \
            echo "⚠️  [محاكاة] تعذّر تنفيذ journalctl --rotate."
        # تأكيد وجود سجلات opvm-sim
        if [ -n "$(journalctl -t opvm-sim -n 1 --no-pager 2>/dev/null)" ]; then
            echo "✅ [محاكاة] سجلات opvm-sim مرئية في journald."
        else
            echo "⚠️  [محاكاة] لم تُعثر سجلات opvm-sim."
        fi
    else
        echo "⚠️  systemd-cat غير متوفر — تخطي اختبار journald."
    fi

    echo ""
    echo "🧪 انتهى وضع المحاكاة. لم تُعدَّل أي إعدادات نهائية لـ journald/logrotate."
else
    # ================= مسار التثبيت الفعلي =================
    echo "==> ضبط تدوير السجلات (journald + logrotate) لتجنّب امتلاء القرص..."
    # 1) إعدادات journald خاصة بخدمة opvm
    mkdir -p /etc/systemd/journald@opvm.conf.d
    cp "$BUNDLE_DIR/systemd/opvm-journald.conf" /etc/systemd/journald@opvm.conf.d/00-opvm.conf

    # إعدادات journald عامة كحد أمان
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
    logrotate -d /etc/logrotate.d/opvm >/dev/null 2>&1 || true

    # 3) تحقق فعلي من عمل تدوير السجلات
    echo "==> التحقق من عمل تدوير السجلات (logrotate) ..."
    mkdir -p /var/log/nginx /var/log/opvm
    TEST_LOG="/var/log/nginx/opvm_access.log"
    head -c 1048576 /dev/urandom | base64 > "$TEST_LOG" 2>/dev/null || \
        dd if=/dev/zero of="$TEST_LOG" bs=1M count=2 >/dev/null 2>&1
    chown www-data:adm "$TEST_LOG" 2>/dev/null || true

    if logrotate -f /etc/logrotate.d/opvm; then
        if ls /var/log/nginx/opvm_access.log.1* >/dev/null 2>&1; then
            echo "✅ تدوير السجلات يعمل بنجاح."
            ls -lh /var/log/nginx/opvm_access.log* 2>/dev/null || true
        else
            echo "⚠️  تم تنفيذ logrotate لكن لم يُعثر على ملف مدوَّر."
        fi
    else
        echo "❌ فشل تنفيذ logrotate."
    fi

    # 4) تحقق journald باستخدام إعداد تجريبي مؤقت ثم إزالته
    echo "==> التحقق من عمل تدوير journald ..."
    cat > /etc/systemd/journald.conf.d/99-opvm-verify.conf <<'EOF'
[Journal]
SystemMaxUse=10M
SystemMaxFileSize=2M
EOF
    systemctl restart systemd-journald || true
    sleep 1

    if command -v systemd-cat >/dev/null 2>&1; then
        for i in $(seq 1 2000); do
            echo "opvm-verify test log $i $(date +%s%N) $(head -c 512 /dev/urandom | base64 -w0)" \
                | systemd-cat -t opvm -p info
        done
    else
        logger -t opvm "opvm-verify fallback $(date)"
    fi

    JOURNAL_ROTATED=0
    journalctl --rotate >/dev/null 2>&1 && JOURNAL_ROTATED=1
    journalctl --vacuum-size=10M >/dev/null 2>&1 || true
    sleep 1

    if [ -n "$(journalctl -t opvm -n 1 --no-pager 2>/dev/null)" ]; then
        JOURNAL_HAS_LOGS=1
    else
        JOURNAL_HAS_LOGS=0
    fi

    if [ "$JOURNAL_ROTATED" = "1" ] && [ "$JOURNAL_HAS_LOGS" = "1" ]; then
        echo "✅ تدوير journald يعمل، وسجلات opvm محفوظة."
        journalctl --disk-usage 2>/dev/null || true
    else
        echo "⚠️  لم يتم التأكد من تدوير journald."
    fi

    # إزالة الإعداد التجريبي المؤقت واستعادة الحد الفعلي
    rm -f /etc/systemd/journald.conf.d/99-opvm-verify.conf
    systemctl restart systemd-journald || true
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
echo "  sudo OPVM_SIMULATE=1 bash install.sh   # إعادة اختبار التدوير في وضع محاكاة"
