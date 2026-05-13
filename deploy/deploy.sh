#!/usr/bin/env bash
set -euo pipefail

APP_NAME="lingxuan-nest"
APP_DIR="${APP_DIR:-/opt/${APP_NAME}}"
WEB_DIR="${WEB_DIR:-/var/www/${APP_NAME}}"
DATA_DIR="${DATA_DIR:-/var/lib/${APP_NAME}}"
ENV_DIR="${ENV_DIR:-/etc/${APP_NAME}}"
SERVICE_NAME="${SERVICE_NAME:-${APP_NAME}-backend}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/${APP_NAME}.conf}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
SERVER_NAME="${SERVER_NAME:-_}"
OPEN_FIREWALL="${OPEN_FIREWALL:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  printf '\033[1;32m[INFO]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[WARN]\033[0m %s\n' "$*"
}

fail() {
  printf '\033[1;31m[ERROR]\033[0m %s\n' "$*" >&2
  exit 1
}

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "请使用 root 执行：sudo bash deploy/deploy.sh"
  fi
}

need_command() {
  command -v "$1" >/dev/null 2>&1 || fail "未找到命令：$1"
}

version_ge() {
  local current="$1"
  local required="$2"
  [ "$(printf '%s\n%s\n' "$required" "$current" | sort -V | head -n1)" = "$required" ]
}

check_runtime() {
  need_command node
  need_command npm
  need_command openssl

  local node_version
  node_version="$(node -v | sed 's/^v//')"
  if ! version_ge "$node_version" "18.18.0"; then
    fail "当前 Node.js 版本为 ${node_version}，项目要求 Node.js >= 18.18.0"
  fi

  if ! command -v nginx >/dev/null 2>&1; then
    if command -v yum >/dev/null 2>&1; then
      log "未检测到 nginx，尝试使用 yum 安装 nginx"
      yum install -y nginx
    else
      fail "未找到 nginx，请先安装 nginx"
    fi
  fi
}

prepare_dirs() {
  log "创建部署目录"
  mkdir -p "$APP_DIR" "$WEB_DIR" "$DATA_DIR/uploads/rerun-requests" "$ENV_DIR"
}

copy_source() {
  log "复制项目文件到 ${APP_DIR}"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude='.git' \
      --exclude='backend/node_modules' \
      --exclude='backend/dist' \
      --exclude='backend/uploads' \
      --exclude='backend/prisma/*.db' \
      --exclude='backend/.env' \
      --exclude='frontend/node_modules' \
      --exclude='frontend/dist' \
      --exclude='frontend/tmp-vite-check' \
      --exclude='logs' \
      --exclude='release' \
      "$SOURCE_DIR/" "$APP_DIR/"
  else
    warn "未找到 rsync，使用 cp 复制；若目录已有旧文件，建议先人工备份"
    cp -a "$SOURCE_DIR/." "$APP_DIR/"
    rm -rf "$APP_DIR/backend/node_modules" "$APP_DIR/backend/dist" "$APP_DIR/backend/uploads"
    rm -rf "$APP_DIR/frontend/node_modules" "$APP_DIR/frontend/dist" "$APP_DIR/frontend/tmp-vite-check"
    rm -rf "$APP_DIR/logs" "$APP_DIR/release"
    rm -f "$APP_DIR"/backend/prisma/*.db "$APP_DIR/backend/.env"
  fi
}

write_env() {
  local env_file="${ENV_DIR}/backend.env"
  local db_file="${DATA_DIR}/supplier_system.db"
  local jwt_secret
  local admin_password
  jwt_secret="$(openssl rand -hex 32)"
  admin_password="$(openssl rand -base64 24 | tr -d '=+/')"

  if [ ! -f "$env_file" ]; then
    log "生成环境变量文件 ${env_file}"
    cat > "$env_file" <<EOF
PORT="${BACKEND_PORT}"
DATABASE_URL="file:${db_file}"
JWT_SECRET="${jwt_secret}"
INIT_ADMIN_PASSWORD="${admin_password}"
UPLOAD_DIR="${DATA_DIR}/uploads/rerun-requests"

# 如需启用真实邮件发送，请由甲方填写 SMTP 参数。
SMTP_HOST=
SMTP_PORT=25
SMTP_FROM=
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_TLS=false

# 学校统一认证 OAuth2/OIDC 参数；现场拿到资料后再启用。
SSO_ENABLED=false
SSO_AUTHORIZATION_URL=
SSO_TOKEN_URL=
SSO_USERINFO_URL=
SSO_CLIENT_ID=
SSO_CLIENT_SECRET=
SSO_REDIRECT_URI=
SSO_SCOPE="openid profile email"
SSO_FRONTEND_CALLBACK_URL="http://服务器IP/sso/callback"
SSO_USERNAME_FIELD="sub,username,account,user_name"
SSO_DISPLAY_NAME_FIELD="name,display_name,realName,nickname"
SSO_EMAIL_FIELD="email,mail"
SSO_DEFAULT_ROLE=user
SSO_ADMIN_USERNAMES=
SSO_SUPER_ADMIN_USERNAMES=
EOF
    chmod 600 "$env_file"
    printf '%s\n' "初始超级管理员：admin"
    printf '%s\n' "初始密码：${admin_password}"
  else
    log "环境变量文件已存在，保留原配置：${env_file}"
  fi
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "${ENV_DIR}/backend.env"
  set +a
}

install_and_build() {
  log "安装并构建 NestJS 后端"
  mkdir -p "$DATA_DIR/uploads/rerun-requests"
  cd "$APP_DIR/backend"
  npm ci
  npx prisma generate
  npx prisma db push
  npm run seed
  npm run build

  log "安装并构建前端"
  cd "$APP_DIR/frontend"
  npm ci
  npm run build

  log "发布前端文件到 ${WEB_DIR}"
  rm -rf "${WEB_DIR:?}/"*
  cp -a "$APP_DIR/frontend/dist/." "$WEB_DIR/"
}

write_systemd() {
  local node_bin
  node_bin="$(command -v node)"

  log "写入 systemd 服务：${SERVICE_NAME}.service"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Lingxuan Nest Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=${APP_DIR}/backend
EnvironmentFile=${ENV_DIR}/backend.env
ExecStart=${node_bin} dist/main.js
Restart=always
RestartSec=5
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  systemctl restart "$SERVICE_NAME"
}

write_nginx() {
  log "写入 Nginx 配置：${NGINX_CONF}"
  cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${WEB_DIR};
    index index.html;

    client_max_body_size 50m;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${BACKEND_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  nginx -t

  if command -v setsebool >/dev/null 2>&1; then
    setsebool -P httpd_can_network_connect 1 >/dev/null 2>&1 || warn "SELinux httpd_can_network_connect 设置失败；若接口 502，请甲方检查 SELinux"
  fi

  systemctl enable nginx
  systemctl restart nginx
}

open_firewall() {
  if [ "$OPEN_FIREWALL" != "1" ]; then
    log "按配置跳过防火墙开放"
    return
  fi

  if command -v firewall-cmd >/dev/null 2>&1 && systemctl is-active firewalld >/dev/null 2>&1; then
    log "开放防火墙 80/tcp"
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --reload
  else
    warn "未检测到运行中的 firewalld，跳过防火墙配置"
  fi
}

print_result() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  log "部署完成"
  printf '\n'
  printf '后端服务状态：systemctl status %s\n' "$SERVICE_NAME"
  printf '后端日志查看：journalctl -u %s -f\n' "$SERVICE_NAME"
  printf 'Nginx 状态：systemctl status nginx\n'
  printf '环境变量文件：%s/backend.env\n' "$ENV_DIR"
  printf '数据库文件：%s\n' "${DATABASE_URL#file:}"
  printf '上传文件目录：%s/uploads/rerun-requests\n' "$DATA_DIR"
  printf '\n'
  if [ -n "$ip" ]; then
    printf '局域网访问地址：http://%s/\n' "$ip"
  else
    printf '局域网访问地址：http://服务器IP/\n'
  fi
}

main() {
  need_root
  check_runtime
  prepare_dirs
  copy_source
  write_env
  load_env
  install_and_build
  write_systemd
  write_nginx
  open_firewall
  print_result
}

main "$@"
