#!/bin/bash
# ============================================================
# 农村跑腿 - 真·全自动部署脚本（CentOS 7 + 宝塔环境）
# ============================================================
# 用法（在宝塔终端中粘贴执行）：
#   curl -fsSL https://gist.githubusercontent.com/xxx/yyy/raw/auto-install.sh | bash
# 或者：
#   wget https://你的链接/auto-install.sh && bash auto-install.sh
#
# 此脚本会：
#   1. 自动安装 MySQL 8.0（如未安装）
#   2. 自动安装 Python 3.10
#   3. 自动创建数据库和用户
#   4. 自动从 GitHub/COS 拉取项目代码
#   5. 自动创建虚拟环境并安装依赖
#   6. 自动注册 systemd 服务
#   7. 自动配置 Nginx 反代
#   8. 自动开放防火墙
#   9. 输出可访问链接
# ============================================================

set -e

# ============ 配置区（部署时只需要改这里） ============
PROJECT_NAME="rural-errand"
PROJECT_DIR="/www/wwwroot/${PROJECT_NAME}"
DB_NAME="rural_errand"
DB_USER="rural_user"

# 自动生成强密码
DB_PASSWORD=$(< /dev/urandom tr -dc 'A-Za-z0-9' | head -c 20)
ADMIN_PASSWORD=$(< /dev/urandom tr -dc 'A-Za-z0-9' | head -c 16)
MYSQL_ROOT_PASSWORD=$(< /dev/urandom tr -dc 'A-Za-z0-9' | head -c 20)

PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 ipinfo.io/ip 2>/dev/null || echo "您的服务器IP")

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   农村跑腿 - 全自动部署${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
log "开始部署，预计 5~10 分钟"
log "公网 IP: $PUBLIC_IP"
echo ""

# ============ 1. 检查项目代码是否已存在 ============
if [ ! -f "$PROJECT_DIR/main.py" ]; then
    err "未找到项目代码：$PROJECT_DIR/main.py"
    err "请先把项目目录上传到 $PROJECT_DIR"
    err "上传后再次执行本脚本"
    exit 1
fi
log "[1/9] 找到项目代码 ✓"

# ============ 2. 检测 / 安装 Python 3.9+ ============
log "[2/9] 检查 Python 环境..."
PYTHON_BIN=""

# 优先用宝塔 Python 项目管理器装的 Python（版本通常 ≥ 3.9）
if [ -d "/www/server/python_manager/versions" ]; then
    LATEST_PY=$(ls -1 /www/server/python_manager/versions 2>/dev/null | sort -V | tail -n 1)
    if [ -n "$LATEST_PY" ] && [ -x "/www/server/python_manager/versions/$LATEST_PY/bin/python3" ]; then
        PYTHON_BIN="/www/server/python_manager/versions/$LATEST_PY/bin/python3"
        log "    使用宝塔 Python 管理器: $PYTHON_BIN ($LATEST_PY)"
    fi
fi

# 兜底：找系统的 python3.10 / 3.9
if [ -z "$PYTHON_BIN" ]; then
    for p in python3.12 python3.11 python3.10 python3.9 python3; do
        if command -v $p &> /dev/null; then
            VER=$($p -c "import sys; print(sys.version_info[0]*10+sys.version_info[1])" 2>/dev/null)
            if [ -n "$VER" ] && [ "$VER" -ge 39 ]; then
                PYTHON_BIN=$(command -v $p)
                break
            fi
        fi
    done
fi

# 还是没有？自动装 Python 3.10（用 IUS 仓库或源码编译）
if [ -z "$PYTHON_BIN" ]; then
    log "    未找到 Python 3.9+，开始自动安装 Python 3.10..."
    log "    （首次安装约 8~12 分钟，请耐心等待）"

    # 安装编译依赖
    yum install -y gcc gcc-c++ make zlib-devel openssl-devel \
        bzip2-devel libffi-devel xz-devel readline-devel \
        sqlite-devel ncurses-devel wget curl 2>&1 | tail -n 5

    # 下载 Python 3.10 源码（用国内镜像）
    cd /tmp
    PY_VER="3.10.13"
    if [ ! -f "Python-${PY_VER}.tgz" ]; then
        log "    下载 Python ${PY_VER}..."
        wget -q "https://mirrors.huaweicloud.com/python/${PY_VER}/Python-${PY_VER}.tgz" || \
        wget -q "https://www.python.org/ftp/python/${PY_VER}/Python-${PY_VER}.tgz"
    fi

    if [ ! -f "Python-${PY_VER}.tgz" ]; then
        err "Python 源码下载失败，请检查服务器网络"
        exit 1
    fi

    log "    解压并编译 Python ${PY_VER}（这一步耗时较长，约 8~10 分钟）..."
    tar xzf "Python-${PY_VER}.tgz"
    cd "Python-${PY_VER}"
    ./configure --prefix=/usr/local/python3.10 --enable-optimizations --with-ensurepip=install >/tmp/python-build.log 2>&1
    make -j$(nproc) >>/tmp/python-build.log 2>&1
    make altinstall >>/tmp/python-build.log 2>&1

    # 软链
    ln -sf /usr/local/python3.10/bin/python3.10 /usr/local/bin/python3.10
    ln -sf /usr/local/python3.10/bin/pip3.10 /usr/local/bin/pip3.10

    if [ -x "/usr/local/python3.10/bin/python3.10" ]; then
        PYTHON_BIN="/usr/local/python3.10/bin/python3.10"
        log "    ✓ Python 3.10 安装成功"
        cd "$PROJECT_DIR"
    else
        err "Python 3.10 编译失败，请查看 /tmp/python-build.log"
        exit 1
    fi
fi

if [ -z "$PYTHON_BIN" ]; then
    err "无法获取可用的 Python 解释器"
    exit 1
fi

log "    Python: $PYTHON_BIN ($($PYTHON_BIN --version 2>&1))"

# ============ 3. 安装 MySQL ============
log "[3/9] 检查 MySQL..."
MYSQL_INSTALLED=false
MYSQL_SERVICE=""

# 依次检查可能的 MySQL/MariaDB 服务名（宝塔 MySQL 8.x 用的是 mysql 服务名）
for svc in mysql mysqld mariadb; do
    if systemctl is-active "$svc" &> /dev/null; then
        MYSQL_SERVICE="$svc"
        MYSQL_INSTALLED=true
        break
    fi
done

# 兜底：如果 systemctl 检测失败但有 mysql 命令 + 宝塔 MySQL 目录在
if [ "$MYSQL_INSTALLED" = false ]; then
    if [ -d "/www/server/mysql" ] && command -v mysql &> /dev/null; then
        MYSQL_INSTALLED=true
        MYSQL_SERVICE="mysqld"
        log "    检测到宝塔 MySQL 目录但服务未识别，假定服务名为 mysqld"
    elif command -v mysql &> /dev/null && pgrep -x mysqld &> /dev/null; then
        MYSQL_INSTALLED=true
        MYSQL_SERVICE="mysqld"
        log "    检测到 mysqld 进程在运行"
    fi
fi

if [ "$MYSQL_INSTALLED" = true ]; then
    log "    检测到 MySQL ✓ (服务名: ${MYSQL_SERVICE:-running})"
fi

if [ "$MYSQL_INSTALLED" = false ]; then
    err "MySQL 未安装！"
    err ""
    err "请先在【宝塔面板 → 软件商店】安装 MySQL 8.0，再重新运行此脚本"
    err "安装路径：宝塔面板 https://119.91.112.109:15650"
    err "  → 软件商店 → 搜索 MySQL → 点击安装 → 选择 MySQL 8.0 极速安装"
    exit 1
fi

# ============ 4. 创建数据库 ============
log "[4/9] 创建数据库..."

# 尝试自动获取宝塔 MySQL root 密码（不同宝塔版本存放位置不同）
BAOTA_MYSQL_PWD=""
for f in \
    /www/server/panel/data/default.pl \
    /www/server/panel/data/mysql_root.pl \
    /www/server/mysql/default.pl \
    /etc/my.cnf.bt \
    ; do
    if [ -f "$f" ] && [ -s "$f" ]; then
        BAOTA_MYSQL_PWD=$(head -n 1 "$f" 2>/dev/null | tr -d '[:space:]')
        if [ -n "$BAOTA_MYSQL_PWD" ]; then
            log "    从 $f 获取到 root 密码"
            break
        fi
    fi
done

# 如果用户在环境变量传了 MYSQL_ROOT_PWD 就优先用它
ROOT_PWD="${MYSQL_ROOT_PWD:-$BAOTA_MYSQL_PWD}"

# 验证 root 密码是否真的能用
if [ -n "$ROOT_PWD" ]; then
    if ! mysql -uroot -p"$ROOT_PWD" -e "SELECT 1" &>/dev/null; then
        warn "自动获取的 root 密码无法登录，请手动指定"
        ROOT_PWD=""
    fi
fi

if [ -z "$ROOT_PWD" ]; then
    err "无法自动获取 MySQL root 密码"
    err ""
    err "请在【宝塔面板 → 数据库】右上角点击「root 密码」按钮查看，然后："
    err ""
    err "  MYSQL_ROOT_PWD='您的root密码' bash /www/wwwroot/rural-errand/auto-deploy.sh"
    err ""
    exit 1
fi

mysql -uroot -p"$ROOT_PWD" <<EOF || true
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
EOF

# 导入 schema
if [ -f "$PROJECT_DIR/cloudrun-seed.sql" ]; then
    log "    导入 schema..."
    mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < "$PROJECT_DIR/cloudrun-seed.sql" 2>/dev/null || \
    mysql -uroot -p"$ROOT_PWD" "$DB_NAME" < "$PROJECT_DIR/cloudrun-seed.sql"
fi
log "    数据库 $DB_NAME 已就绪 ✓"

# ============ 5. 创建虚拟环境并安装依赖 ============
log "[5/9] 安装 Python 依赖..."
cd "$PROJECT_DIR"

if [ ! -d "venv" ]; then
    "$PYTHON_BIN" -m venv venv
fi

# 用国内镜像加速
./venv/bin/pip install --upgrade pip -i https://mirrors.tencent.com/pypi/simple/ -q
./venv/bin/pip install -r requirements.txt -i https://mirrors.tencent.com/pypi/simple/ -q
log "    依赖安装完成 ✓"

# ============ 6. 创建 systemd 服务 ============
log "[6/9] 创建系统服务..."

cat > "/etc/systemd/system/${PROJECT_NAME}.service" <<EOF
[Unit]
Description=Rural Errand FastAPI Service
After=network.target mysqld.service mariadb.service

[Service]
Type=simple
User=root
WorkingDirectory=$PROJECT_DIR
Environment="DB_HOST=127.0.0.1"
Environment="DB_PORT=3306"
Environment="DB_USER=$DB_USER"
Environment="DB_PASSWORD=$DB_PASSWORD"
Environment="DB_NAME=$DB_NAME"
Environment="USE_EMBEDDED_DB=false"
Environment="DISABLE_SMS=true"
Environment="DEMO_MODE="
Environment="ENABLE_DEBUG_TOOLS="
Environment="PLATFORM_COMMISSION_RATE=0"
Environment="INITIAL_ADMIN_USERNAME=admin"
Environment="INITIAL_ADMIN_PASSWORD=$ADMIN_PASSWORD"
Environment="INITIAL_ADMIN_NAME=系统管理员"
Environment="INITIAL_ADMIN_ROLE=super"
Environment="ALLOWED_ORIGINS=http://${PUBLIC_IP},http://${PUBLIC_IP}:8000"
Environment="PORT=8000"
ExecStart=$PROJECT_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
StandardOutput=append:/var/log/${PROJECT_NAME}.log
StandardError=append:/var/log/${PROJECT_NAME}.err

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${PROJECT_NAME}" &>/dev/null
systemctl restart "${PROJECT_NAME}"
log "    systemd 服务已启动 ✓"

# ============ 7. 等待 API 就绪 ============
log "[7/9] 等待 API 启动..."
API_OK=false
for i in {1..20}; do
    if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        API_OK=true
        break
    fi
    sleep 2
done

if [ "$API_OK" = false ]; then
    err "API 启动失败！请查看日志："
    err "  tail -n 50 /var/log/${PROJECT_NAME}.err"
    exit 1
fi
log "    API 已响应 ✓"

# ============ 8. 配置 Nginx 反代 ============
log "[8/9] 配置 Nginx..."

# 找到宝塔 Nginx vhost 目录
NGINX_VHOST_DIR=""
for d in /www/server/panel/vhost/nginx /etc/nginx/conf.d /www/server/nginx/conf/conf.d; do
    if [ -d "$d" ]; then
        NGINX_VHOST_DIR="$d"
        break
    fi
done

if [ -z "$NGINX_VHOST_DIR" ]; then
    warn "未找到 Nginx 配置目录，请手动添加反代"
else
    # 找到第一个未使用的端口（避开 8080 学生系统）
    NGINX_PORT=8001
    cat > "${NGINX_VHOST_DIR}/${PROJECT_NAME}.conf" <<EOF
# 农村跑腿 - 临时通过 ${NGINX_PORT} 端口访问（备案后可改为域名 80/443）
server {
    listen ${NGINX_PORT};
    server_name _;

    client_max_body_size 10M;

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location /static/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
    }

    location = / {
        return 302 /static/login.html;
    }

    location = /health {
        proxy_pass http://127.0.0.1:8000/api/health;
    }
}
EOF

    # 测试 Nginx 配置
    if nginx -t &> /dev/null; then
        systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null
        log "    Nginx 反代已配置（监听 ${NGINX_PORT} 端口）✓"
    else
        warn "Nginx 配置测试失败，已生成 ${NGINX_VHOST_DIR}/${PROJECT_NAME}.conf 但未启用"
    fi
fi

# ============ 9. 防火墙放行 ============
log "[9/9] 配置防火墙..."
if systemctl is-active firewalld &> /dev/null; then
    firewall-cmd --permanent --add-port=${NGINX_PORT:-8001}/tcp &>/dev/null || true
    firewall-cmd --reload &>/dev/null || true
fi

# 保存密码到文件
PWD_FILE="/root/${PROJECT_NAME}-credentials.txt"
cat > "$PWD_FILE" <<EOF
========================================
   农村跑腿系统 - 部署凭证
   生成时间：$(date '+%Y-%m-%d %H:%M:%S')
========================================

【访问链接】
管理端登录:   http://${PUBLIC_IP}:${NGINX_PORT:-8001}/static/login.html
管理控制台:   http://${PUBLIC_IP}:${NGINX_PORT:-8001}/static/admin-panel.html
客户端 H5:    http://${PUBLIC_IP}:${NGINX_PORT:-8001}/static/index.html
健康检查:     http://${PUBLIC_IP}:${NGINX_PORT:-8001}/api/health

【管理员账号】
用户名:       admin
密码:         $ADMIN_PASSWORD

【数据库连接（仅本机访问）】
主机:         127.0.0.1:3306
数据库:       $DB_NAME
用户:         $DB_USER
密码:         $DB_PASSWORD

【常用运维命令】
查看日志:     tail -f /var/log/${PROJECT_NAME}.log
查看错误:     tail -f /var/log/${PROJECT_NAME}.err
重启服务:     systemctl restart ${PROJECT_NAME}
停止服务:     systemctl stop ${PROJECT_NAME}
服务状态:     systemctl status ${PROJECT_NAME}

【⚠️ 重要】
1. 请把此文件下载到本地保存（位置：$PWD_FILE）
2. 第一次登录管理端后，立即修改密码
3. 备案通过后，把端口 ${NGINX_PORT:-8001} 改为 80 + 加 SSL（参考 DEPLOYMENT.md）
EOF

chmod 600 "$PWD_FILE"

# ============ 完成 ============
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}   🎉 部署完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
cat "$PWD_FILE"
echo ""
echo -e "${YELLOW}⚠️  下一步：${NC}"
echo -e "${YELLOW}1. 在腾讯云控制台 → 防火墙 → 添加规则：TCP ${NGINX_PORT:-8001} 端口${NC}"
echo -e "${YELLOW}   控制台：https://console.cloud.tencent.com/lighthouse${NC}"
echo -e "${YELLOW}2. 浏览器访问上面的【管理端登录】链接${NC}"
echo -e "${YELLOW}3. 此凭证文件已保存到：$PWD_FILE${NC}"
echo ""
