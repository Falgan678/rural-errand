#!/bin/bash
# ============================================================
# 农村跑腿小程序 - 一键部署脚本（CentOS / 腾讯云轻量服务器）
# ============================================================
# 适用场景：CentOS 7/8 + 全新或干净的服务器
# 包含：Docker、MySQL、Nginx、后端 API、管理端静态文件
# 用法：
#   1. 把整个项目目录上传到服务器 /root/rural-errand/
#   2. cd /root/rural-errand && chmod +x deploy-to-server.sh
#   3. sudo ./deploy-to-server.sh
# ============================================================

set -e  # 任何命令失败立即退出

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
DB_NAME="rural_errand"
DB_USER="rural_user"
# ⚠️ 部署前请修改下面 3 个密码为强密码
DB_PASSWORD="${DB_PASSWORD:-RuralPass_$(date +%s | sha256sum | head -c 12)}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin_$(date +%s | sha256sum | head -c 12)}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-Root_$(date +%s | sha256sum | head -c 12)}"

echo ""
echo "========================================"
echo "  农村跑腿 - 一键部署"
echo "========================================"
echo ""
echo "项目目录: $PROJECT_DIR"
echo "数据库名: $DB_NAME"
echo "数据库用户: $DB_USER"
echo "数据库密码: $DB_PASSWORD"
echo "MySQL root 密码: $MYSQL_ROOT_PASSWORD"
echo "管理员账号: admin"
echo "管理员密码: $ADMIN_PASSWORD"
echo ""
echo "⚠️  请记下上述密码！部署完成后这些密码不会再显示"
echo ""
read -p "确认开始部署？(y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# ============================================================
# 1. 安装 Docker（如未安装）
# ============================================================
if ! command -v docker &> /dev/null; then
    echo ""
    echo "[1/6] 安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "[1/6] Docker 安装完成: $(docker --version)"
else
    echo "[1/6] Docker 已安装: $(docker --version)"
fi

# ============================================================
# 2. 启动 MySQL 容器
# ============================================================
echo ""
echo "[2/6] 配置 MySQL..."

if ! docker ps -a --format '{{.Names}}' | grep -q '^rural-mysql$'; then
    docker run -d \
        --name rural-mysql \
        --restart unless-stopped \
        -e MYSQL_ROOT_PASSWORD="$MYSQL_ROOT_PASSWORD" \
        -e MYSQL_DATABASE="$DB_NAME" \
        -e MYSQL_USER="$DB_USER" \
        -e MYSQL_PASSWORD="$DB_PASSWORD" \
        -p 127.0.0.1:3306:3306 \
        -v /var/lib/rural-mysql:/var/lib/mysql \
        --health-cmd="mysqladmin ping -h localhost" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=10 \
        mysql:8.0 \
        --character-set-server=utf8mb4 \
        --collation-server=utf8mb4_unicode_ci

    echo "等待 MySQL 启动（约 30 秒）..."
    for i in {1..30}; do
        if docker exec rural-mysql mysqladmin ping -h localhost --silent &> /dev/null; then
            echo "MySQL 已就绪"
            break
        fi
        sleep 2
    done

    # 导入 schema
    if [ -f "$PROJECT_DIR/cloudrun-seed.sql" ]; then
        echo "导入数据库初始 schema..."
        docker exec -i rural-mysql mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$DB_NAME" < "$PROJECT_DIR/cloudrun-seed.sql" || true
    fi
    echo "[2/6] MySQL 容器启动完成"
else
    echo "[2/6] MySQL 容器已存在，跳过创建"
    docker start rural-mysql || true
fi

# ============================================================
# 3. 构建后端镜像
# ============================================================
echo ""
echo "[3/6] 构建后端 API 镜像..."
cd "$PROJECT_DIR"
docker build -t rural-errand-api:latest .
echo "[3/6] 镜像构建完成"

# ============================================================
# 4. 启动后端 API 容器
# ============================================================
echo ""
echo "[4/6] 启动后端 API 容器..."

# 停止旧容器（如果存在）
docker rm -f rural-api 2>/dev/null || true

PUBLIC_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "您的IP")

docker run -d \
    --name rural-api \
    --restart unless-stopped \
    --link rural-mysql:mysql \
    -p 127.0.0.1:8000:8000 \
    -e DB_HOST=mysql \
    -e DB_PORT=3306 \
    -e DB_USER="$DB_USER" \
    -e DB_PASSWORD="$DB_PASSWORD" \
    -e DB_NAME="$DB_NAME" \
    -e USE_EMBEDDED_DB=false \
    -e DISABLE_SMS=true \
    -e DEMO_MODE= \
    -e ENABLE_DEBUG_TOOLS= \
    -e PLATFORM_COMMISSION_RATE=0 \
    -e INITIAL_ADMIN_USERNAME=admin \
    -e INITIAL_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    -e INITIAL_ADMIN_NAME="系统管理员" \
    -e INITIAL_ADMIN_ROLE=super \
    -e ALLOWED_ORIGINS="http://${PUBLIC_IP},http://${PUBLIC_IP}:80" \
    -e PORT=8000 \
    -v /var/lib/rural-uploads:/app/static/uploads \
    rural-errand-api:latest

# 等服务起来
echo "等待 API 启动..."
for i in {1..15}; do
    if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        echo "API 服务已就绪"
        break
    fi
    sleep 2
done

echo "[4/6] 后端 API 启动完成"

# ============================================================
# 5. 安装并配置 Nginx 反代
# ============================================================
echo ""
echo "[5/6] 配置 Nginx..."

if ! command -v nginx &> /dev/null; then
    yum install -y epel-release
    yum install -y nginx
    systemctl enable nginx
fi

# 创建 Nginx 配置
cat > /etc/nginx/conf.d/rural-errand.conf <<EOF
server {
    listen 80 default_server;
    server_name _;

    # 上传大小限制（头像）
    client_max_body_size 10M;

    # API 反代到 FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # 静态资源（管理端 HTML/CSS/JS）
    location /static/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
    }

    # 根路径重定向到管理端登录
    location = / {
        return 302 /static/login.html;
    }

    # 健康检查
    location = /health {
        proxy_pass http://127.0.0.1:8000/api/health;
    }
}
EOF

# 删除默认配置
rm -f /etc/nginx/conf.d/default.conf

# 测试并重启
nginx -t
systemctl restart nginx

echo "[5/6] Nginx 配置完成"

# ============================================================
# 6. 防火墙
# ============================================================
echo ""
echo "[6/6] 检查防火墙..."

if systemctl is-active firewalld &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    echo "本机 firewalld 已放行 HTTP/HTTPS"
else
    echo "本机未启用 firewalld，跳过"
fi

echo ""
echo "⚠️  请确认在【腾讯云轻量服务器控制台 → 防火墙】中开放了 80、443 端口"

# ============================================================
# 完成
# ============================================================
echo ""
echo "========================================"
echo "  🎉 部署完成！"
echo "========================================"
echo ""
echo "访问链接（用浏览器打开）："
echo ""
echo "  管理端登录:  http://${PUBLIC_IP}/static/login.html"
echo "  管理控制台:  http://${PUBLIC_IP}/static/admin-panel.html"
echo "  客户端 H5:   http://${PUBLIC_IP}/static/index.html"
echo "  健康检查:    http://${PUBLIC_IP}/api/health"
echo ""
echo "管理员账号：admin"
echo "管理员密码：$ADMIN_PASSWORD"
echo ""
echo "数据库连接（仅本机）："
echo "  Host: 127.0.0.1:3306"
echo "  数据库: $DB_NAME"
echo "  用户: $DB_USER"
echo "  密码: $DB_PASSWORD"
echo "  Root 密码: $MYSQL_ROOT_PASSWORD"
echo ""
echo "查看后端日志: docker logs -f rural-api"
echo "查看 MySQL 日志: docker logs -f rural-mysql"
echo "重启后端: docker restart rural-api"
echo ""
echo "下一步：备案通过后，把这些密码记到 1Password/笔记里，"
echo "并修改 Nginx 配置加上 SSL 证书 (本目录 nginx-ssl-template.conf)"
echo ""
