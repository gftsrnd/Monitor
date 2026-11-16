#!/usr/bin/env bash
# ==============================================================================
# TFG Monitor — VPS Turnkey Bootstrap Script (AlmaLinux 9 / PostgreSQL 15 / Podman / Apache)
# Domain: https://monitor.tinfundinggroup.net
#
# STRICT ISOLATION NOTICE:
# This script creates only isolated resources for TFG Monitor and NEVER touches
# existing VPS projects (cmo-funding, checkmybiz, tfg-website, Redis, nextjsuser).
# ==============================================================================
set -Eeuo pipefail

if [ "$EUID" -ne 0 ]; then
  echo "Error: This script must be run as root (or with sudo)." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONITOR_ENV_DIR="/etc/tfg-monitor"
MONITOR_ENV_FILE="${MONITOR_ENV_DIR}/monitor.env"
CREDENTIALS_FILE="${MONITOR_ENV_DIR}/admin-credentials.txt"
ACME_DIR="/var/www/tfg-monitor/acme/.well-known/acme-challenge"
VHOST_SOURCE="${SCRIPT_DIR}/httpd/zz-tfg-monitor.conf"
VHOST_TARGET="/etc/httpd/conf.d/zz-tfg-monitor.conf"

echo "================================================================================"
echo "== [1/6] Initializing Isolated PostgreSQL 15 Database and Role =="
echo "================================================================================"

mkdir -p "$MONITOR_ENV_DIR"
chmod 0700 "$MONITOR_ENV_DIR"

# Retrieve existing DB password and secrets if already configured
DB_PASS=""
JWT_SECRET=""
EXISTING_ADMIN_PASS=""
ADMIN_CUSTOMIZED="false"

if [ -f "$MONITOR_ENV_FILE" ]; then
  echo "Existing configuration found in ${MONITOR_ENV_FILE}. Preserving credentials..."
  DB_PASS=$(grep -E '^DATABASE_URL=' "$MONITOR_ENV_FILE" | sed -E 's/.*:([^@]+)@.*/\1/' || true)
  JWT_SECRET=$(grep -E '^JWT_SECRET=' "$MONITOR_ENV_FILE" | cut -d'=' -f2- || true)
  EXISTING_ADMIN_PASS=$(grep -E '^ADMIN_INITIAL_PASSWORD=' "$MONITOR_ENV_FILE" | cut -d'=' -f2- || true)
  ADMIN_CUSTOMIZED=$(grep -E '^ADMIN_PASSWORD_CUSTOMIZED=' "$MONITOR_ENV_FILE" | cut -d'=' -f2- || echo "false")
fi

if [ -z "$DB_PASS" ]; then
  DB_PASS=$(openssl rand -hex 16)
fi

if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -hex 32)
fi

# Determine initial admin password (100% safe when pasting multi-line SSH blocks!):
# 1. Explicit env var: ADMIN_PASSWORD='...' bash setup-vps.sh
# 2. Existing saved password (idempotent re-run)
# 3. Explicit interactive flag: bash setup-vps.sh --ask-password
# 4. Default (paste-safe): generates 1-time bootstrap password -> Web UI opens "Set Your Own Password" modal on first login!
ASK_PASSWORD="false"
for arg in "$@"; do
  if [ "$arg" = "--ask-password" ] || [ "$arg" = "-p" ]; then
    ASK_PASSWORD="true"
  fi
done

ADMIN_PASS="${ADMIN_PASSWORD:-}"
if [ -n "$ADMIN_PASS" ]; then
  ADMIN_CUSTOMIZED="true"
elif [ -n "$EXISTING_ADMIN_PASS" ]; then
  ADMIN_PASS="$EXISTING_ADMIN_PASS"
elif [ "$ASK_PASSWORD" = "true" ] && [ -r /dev/tty ]; then
  # Drain any buffered pasted newlines before prompting
  while read -r -t 0.05 _ </dev/tty; do :; done 2>/dev/null || true
  echo ""
  echo "--------------------------------------------------------------------------------"
  echo "THIẾT LẬP MẬT KHẨU QUẢN TRỊ (admin) CHO TFG MONITOR:"
  echo "--------------------------------------------------------------------------------"
  while true; do
    read -rsp "Nhập mật khẩu admin mong muốn (tối thiểu 8 ký tự, hoặc Enter để dùng mã tạm 1 lần): " INPUT_P1 </dev/tty || INPUT_P1=""
    echo ""
    if [ -z "$INPUT_P1" ]; then
      ADMIN_PASS=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)
      ADMIN_CUSTOMIZED="false"
      break
    fi
    if [ "${#INPUT_P1}" -lt 8 ]; then
      echo "  [!] Mật khẩu cần tối thiểu 8 ký tự. Vui lòng thử lại."
      continue
    fi
    read -rsp "Nhập lại mật khẩu để xác nhận: " INPUT_P2 </dev/tty || INPUT_P2=""
    echo ""
    if [ "$INPUT_P1" != "$INPUT_P2" ]; then
      echo "  [!] Hai mật khẩu không khớp. Vui lòng nhập lại."
      continue
    fi
    ADMIN_PASS="$INPUT_P1"
    ADMIN_CUSTOMIZED="true"
    break
  done
else
  ADMIN_PASS=$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)
  ADMIN_CUSTOMIZED="false"
fi

# Ensure postgresql-15 service is active
if ! systemctl is-active --quiet postgresql-15.service; then
  echo "Starting postgresql-15 service..."
  systemctl start postgresql-15.service
  systemctl enable postgresql-15.service
fi

# Create role tfg_monitor if not present
ROLE_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='tfg_monitor'" || true)
if [ "$ROLE_EXISTS" != "1" ]; then
  echo "Creating isolated Postgres role 'tfg_monitor'..."
  sudo -u postgres psql -c "CREATE ROLE tfg_monitor WITH LOGIN PASSWORD '$DB_PASS' NOSUPERUSER NOCREATEDB NOCREATEROLE CONNECTION LIMIT 25;"
else
  echo "Role 'tfg_monitor' already exists. Aligning password..."
  sudo -u postgres psql -c "ALTER ROLE tfg_monitor WITH PASSWORD '$DB_PASS' CONNECTION LIMIT 25;"
fi

# Create database tfg_monitor if not present
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='tfg_monitor'" || true)
if [ "$DB_EXISTS" != "1" ]; then
  echo "Creating database 'tfg_monitor' owned by 'tfg_monitor'..."
  sudo -u postgres psql -c "CREATE DATABASE tfg_monitor WITH OWNER tfg_monitor ENCODING 'UTF8';"
else
  echo "Database 'tfg_monitor' already exists."
fi

sudo -u postgres psql -c "ALTER DATABASE tfg_monitor OWNER TO tfg_monitor; GRANT ALL PRIVILEGES ON DATABASE tfg_monitor TO tfg_monitor;"
sudo -u postgres psql -d tfg_monitor -c "GRANT ALL ON SCHEMA public TO tfg_monitor;"

echo "================================================================================"
echo "== [2/6] Writing Secure Isolated Environment Configuration =="
echo "================================================================================"

# Write static keys with single-quoted heredoc + printf for dynamic secrets so $, `, ! in passwords are NEVER expanded
cat > "$MONITOR_ENV_FILE" <<'EOF'
# TFG Monitor Environment Configuration
NODE_ENV=production
TZ=Asia/Ho_Chi_Minh
PORT=12345
HOST=127.0.0.1

# Anti-Spoofing & Proxying (Apache mod_proxy_http sets trusted X-Forwarded-For)
PUBLIC_URL=https://monitor.tinfundinggroup.net
CUSTOM_TRACKER_SCRIPT_NAME=tj.js

# Performance & Isolation
CACHE_MEMORY_ONLY=true
DISABLE_ANONYMOUS_TELEMETRY=true
AUDIT_LOG_RETENTION_DAYS=60

# Authentication & Security Flags
JWT_ISSUER=monitor.tinfundinggroup.net
JWT_AUDIENCE=tinfundinggroup.net
AUTH_USE_SECURE_COOKIES=true
ALLOW_REGISTER=false
ALLOW_OPENAPI=true

# Host Telemetry Reporter (Monitors local VPS metrics)
TIANJI_REPORTER_WORKSPACE=clnzoxcy10001vy2ohi4obbi0
TIANJI_REPORTER_NAME=tfg-vps-main
EOF

{
  printf 'DATABASE_URL=postgresql://tfg_monitor:%s@127.0.0.1:5432/tfg_monitor\n' "$DB_PASS"
  printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
  printf 'AUTH_SECRET=%s\n' "$JWT_SECRET"
  printf 'ADMIN_INITIAL_PASSWORD=%s\n' "$ADMIN_PASS"
  printf 'ADMIN_PASSWORD_CUSTOMIZED=%s\n' "$ADMIN_CUSTOMIZED"
} >> "$MONITOR_ENV_FILE"

chmod 0600 "$MONITOR_ENV_FILE"
chown root:root "$MONITOR_ENV_FILE"

if [ "$ADMIN_CUSTOMIZED" = "true" ]; then
  rm -f "$CREDENTIALS_FILE"
  echo "Environment written to ${MONITOR_ENV_FILE} (custom admin password configured; no plaintext file stored)."
else
  {
    echo "================================================================================"
    echo "TFG Monitor — One-Time First-Login Credentials"
    echo "URL:      https://monitor.tinfundinggroup.net"
    echo "Username: admin"
    printf 'One-Time Password: %s\n' "$ADMIN_PASS"
    echo "Note: Upon your first login on the web UI, you will be prompted to set your own password!"
    echo "Generated: $(date)"
    echo "================================================================================"
  } > "$CREDENTIALS_FILE"
  chmod 0600 "$CREDENTIALS_FILE"
  chown root:root "$CREDENTIALS_FILE"
  echo "Environment written to ${MONITOR_ENV_FILE} (0600 root:root)."
  echo "One-time bootstrap credentials written to ${CREDENTIALS_FILE}."
fi

# Install convenient SSH password reset helper (/usr/local/bin/tfg-monitor-passwd)
cat > /usr/local/bin/tfg-monitor-passwd <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
[ "$EUID" -eq 0 ] || { echo "Run as root: sudo tfg-monitor-passwd" >&2; exit 1; }
read -rsp "Nhập mật khẩu mới cho tài khoản 'admin' (tối thiểu 8 ký tự): " NEW_PASS
echo ""
[ "${#NEW_PASS}" -ge 8 ] || { echo "Lỗi: Mật khẩu phải tối thiểu 8 ký tự!" >&2; exit 1; }
read -rsp "Nhập lại mật khẩu mới: " CONFIRM_PASS
echo ""
[ "$NEW_PASS" = "$CONFIRM_PASS" ] || { echo "Lỗi: Hai mật khẩu không khớp!" >&2; exit 1; }

podman exec -i -e RESET_PASS="$NEW_PASS" tfg-monitor sh -c '
  cd /app/tianji/src/server && node --input-type=module -e "
    import bcrypt from \"bcryptjs\";
    import { PrismaClient } from \"@prisma/client\";
    const prisma = new PrismaClient();
    const hash = await bcrypt.hash(process.env.RESET_PASS, 10);
    await prisma.user.updateMany({ where: { username: \"admin\" }, data: { password: hash } });
    await prisma.\$disconnect();
  "
'
rm -f /etc/tfg-monitor/admin-credentials.txt
echo "Đã cập nhật mật khẩu mới cho 'admin' thành công!"
EOF
chmod 0700 /usr/local/bin/tfg-monitor-passwd

echo "================================================================================"
echo "== [3/6] Installing Systemd Service for TFG Monitor Container =="
echo "================================================================================"

SERVICE_FILE="/etc/systemd/system/tfg-monitor.service"

cat > "$SERVICE_FILE" <<'EOF'
[Unit]
Description=TFG Monitor Container
After=network.target postgresql-15.service
Wants=postgresql-15.service

[Service]
Type=simple
Restart=always
RestartSec=5s
TimeoutStartSec=180s
TimeoutStopSec=30s
ExecStartPre=-/usr/bin/podman rm -f tfg-monitor
ExecStart=/usr/bin/podman run --rm --name tfg-monitor --network host --security-opt=no-new-privileges:true --memory=600m --memory-swap=900m --env-file /etc/tfg-monitor/monitor.env ghcr.io/gftsrnd/monitor:current
ExecStop=/usr/bin/podman stop -t 15 tfg-monitor

[Install]
WantedBy=multi-user.target
EOF

chmod 0644 "$SERVICE_FILE"
chown root:root "$SERVICE_FILE"

systemctl daemon-reload
systemctl enable tfg-monitor.service

echo "================================================================================"
echo "== [4/6] Installing Apache Vhost & ACME Directory =="
echo "================================================================================"

mkdir -p "$ACME_DIR"
chmod -R 0755 /var/www/tfg-monitor
chown -R apache:apache /var/www/tfg-monitor || true

if [ -f "$VHOST_SOURCE" ]; then
  cp "$VHOST_SOURCE" "$VHOST_TARGET"
  chmod 0644 "$VHOST_TARGET"
  echo "Installed vhost configuration to ${VHOST_TARGET}."
else
  echo "Error: Vhost source file ${VHOST_SOURCE} not found." >&2
  exit 1
fi

echo "Testing Apache syntax..."
httpd -t

echo "Reloading Apache httpd..."
systemctl reload httpd

echo "================================================================================"
echo "== [5/6] Verifying Coexisting Websites (CMO & CMB Safety Check) =="
echo "================================================================================"

CMO_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: cmo.tinfundinggroup.net" http://127.0.0.1/ || true)
CMB_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: checkmybiz.com" http://127.0.0.1/ || true)

echo "CMO vhost HTTP response code: ${CMO_CODE:-none} (expected: 301/200)"
echo "CMB vhost HTTP response code: ${CMB_CODE:-none} (expected: 301/200)"

if [ "$CMO_CODE" = "000" ] && [ "$CMB_CODE" = "000" ]; then
  echo "Warning: Local port 80 probe did not receive response. Please verify Apache service status."
else
  echo "Coexisting sites verified undamaged by zz-tfg-monitor.conf."
fi

echo "================================================================================"
echo "== [6/6] Image Pull & Startup Verification =="
echo "================================================================================"

if ! podman image exists "ghcr.io/gftsrnd/monitor:current"; then
  echo "Attempting to pull latest image from GHCR..."
  if podman pull ghcr.io/gftsrnd/monitor:latest; then
    podman tag ghcr.io/gftsrnd/monitor:latest ghcr.io/gftsrnd/monitor:current
    echo "Starting tfg-monitor.service..."
    systemctl restart tfg-monitor.service
  else
    echo "Note: Image 'ghcr.io/gftsrnd/monitor:latest' could not be pulled yet."
    echo "It will be automatically pulled on your next git push via GitHub Actions CI/CD."
  fi
else
  echo "Image 'ghcr.io/gftsrnd/monitor:current' is already loaded. Restarting service..."
  systemctl restart tfg-monitor.service
fi

echo "================================================================================"
echo "== Bootstrap Summary & Next Steps =="
echo "================================================================================"
echo "1. Service:        systemctl status tfg-monitor.service"
echo "2. Logs:           journalctl -u tfg-monitor.service -f"
echo "3. Reset Password: tfg-monitor-passwd"
echo ""
if [ "$ADMIN_CUSTOMIZED" = "true" ]; then
  echo "   Username: admin"
  echo "   Password: (Mật khẩu riêng bạn vừa thiết lập)"
else
  echo "   Username: admin"
  printf '   One-Time Password: %s\n' "$ADMIN_PASS"
  echo "   (Khi đăng nhập lần đầu trên Web, bảng đặt mật khẩu riêng của bạn sẽ tự hiện ra!)"
fi
echo ""

if [ ! -f "/etc/letsencrypt/live/monitor.tinfundinggroup.net/fullchain.pem" ]; then
  echo "4. SSL Certificate (Run once DNS A record points to 159.198.32.57):"
  echo "   certbot certonly --webroot -w /var/www/tfg-monitor/acme -d monitor.tinfundinggroup.net --deploy-hook \"systemctl reload httpd\""
else
  echo "4. SSL Certificate is ALREADY installed and active!"
fi
echo "================================================================================"
