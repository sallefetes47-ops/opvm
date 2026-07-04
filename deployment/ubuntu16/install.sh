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

# ==== دالة المساعدة ====
show_help() {
    cat <<'HLP'
سكريبت تثبيت منصة OPVM على Ubuntu (16.04 وأحدث)

الاستخدام:
  sudo bash install.sh [خيارات]

الخيارات:
  -h, --help              عرض هذه الرسالة والخروج.
  -s, --simulate          تفعيل وضع المحاكاة (لا يعدّل إعدادات النظام النهائية).
      --dry-run           اسم بديل لـ --simulate.

متغيرات البيئة:
  OPVM_SIMULATE=1
      يفعّل وضع المحاكاة (مكافئ لـ --simulate). في هذا الوضع:
        • لا تُكتب أي ملفات في /etc/systemd/journald*/ ولا في /etc/logrotate.d/.
        • تُنشأ إعدادات وسجلات اختبار داخل دليل مؤقت واحد فقط.
        • يُحذف الدليل المؤقت بالكامل عند انتهاء السكريبت (trap EXIT).

  OPVM_SIM_DIR=/مسار/دليل
      اختيار مسار مخصص للدليل المؤقت بدلاً من mktemp الافتراضي.
      إن لم يكن موجوداً يُنشأ، ويُحذف عند الخروج (إلا إذا استخدمت OPVM_SIM_KEEP=1).

  OPVM_SIM_PREFIX=<اسم>
      بادئة اسم دليل mktemp (الافتراضي: opvm-simulate).
      يُنتج مسار من الشكل:  $TMPDIR/<اسم>-XXXXXX

  OPVM_SIM_TMPDIR=/مسار
      جذر بديل يُمرَّر إلى mktemp عبر -p (الافتراضي: $TMPDIR أو /tmp).

  OPVM_SIM_KEEP=1
      عدم حذف الدليل المؤقت بعد الانتهاء (مفيد للتفتيش اليدوي).

أمثلة:
  sudo OPVM_SIMULATE=1 bash install.sh
  sudo bash install.sh --simulate
  sudo OPVM_SIMULATE=1 OPVM_SIM_PREFIX=opvm-test OPVM_SIM_TMPDIR=/var/tmp bash install.sh
  sudo OPVM_SIMULATE=1 OPVM_SIM_DIR=/var/tmp/opvm-check OPVM_SIM_KEEP=1 bash install.sh
HLP
}

# ==== تحليل الخيارات ====
SIMULATE=0
for arg in "$@"; do
    case "$arg" in
        -h|--help)          show_help; exit 0 ;;
        -s|--simulate|--dry-run) SIMULATE=1 ;;
        *) echo "خيار غير معروف: $arg (استخدم --help)"; exit 2 ;;
    esac
done
if [ "${OPVM_SIMULATE:-0}" = "1" ]; then
    SIMULATE=1
fi

# ==== تهيئة دليل المحاكاة ====
if [ "$SIMULATE" = "1" ]; then
    echo "🧪 وضع المحاكاة مُفعَّل — لن يتم تعديل إعدادات journald/logrotate النهائية."
    SIM_PREFIX="${OPVM_SIM_PREFIX:-opvm-simulate}"
    SIM_TMPDIR="${OPVM_SIM_TMPDIR:-${TMPDIR:-/tmp}}"
    if [ -n "${OPVM_SIM_DIR:-}" ]; then
        SIM_ROOT="$OPVM_SIM_DIR"
        mkdir -p "$SIM_ROOT"
    else
        SIM_ROOT="$(mktemp -d -p "$SIM_TMPDIR" "${SIM_PREFIX}-XXXXXX")"
    fi
    if [ "${OPVM_SIM_KEEP:-0}" = "1" ]; then
        trap 'echo "📁 الاحتفاظ بدليل المحاكاة: $SIM_ROOT"' EXIT
    else
        trap 'echo "🧹 تنظيف دليل المحاكاة: $SIM_ROOT"; rm -rf "$SIM_ROOT"' EXIT
    fi
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
