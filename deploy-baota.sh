#!/bin/bash
# ============================================================
# 农村跑腿 - 宝塔环境一键部署脚本（不依赖 Docker）
# ============================================================
# 适用：宝塔面板 + CentOS 7 + 已装 Nginx 1.24
# 假设：MySQL 已通过宝塔安装、数据库已通过宝塔创建
# 用法：
#   1. 把代码上传到 /www/wwwroot/rural-errand/
#   2. ssh 到服务器
#   3. cd /www/wwwroot/rural-errand
#   4. chmod +x deploy-baota.sh
#   5. DB_PASSWORD='您在宝塔里设的密码' ADMIN_PASSWORD='管理员强密码' ./deploy-baota.sh
# ============================================================

set -e

PROJECT_DIR="/www/wwwroot/rural-errand"
PYTHON_BIN="/www/server/python_manager/versions/3.10.13/bin/python3"  # 宝塔 Python 路径
VENV_DIR="$PROJECT_DIR/venv"
SERVICE_NAME="rural-errand"

# 必须传入的环境变量
: "${DB_PASSWORD:?需要设置 DB_PASSWORD（在宝塔创建数据库时的密码）}"
: "${ADMIN_PASSWORD:?需要设置 ADMIN_PASSWORD（管理员强密码）}"

DB_USER="${DB_USER:-rural_user}"
DB_NAME="${DB_NAME:-rural_errand}"

echo "========================================="
echo "  农村跑腿 - 宝塔环境部署"
echo "========================================="
echo "项目目录: $PROJECT_DIR"
echo "数据库: $DB_NAME / 用户: $DB_USER"
echo ""

# 1. 检查 Python
if [ ! -f "$PYTHON_BIN" ]; then
    # 尝试系统 Python
    PYTHON_BIN=$(command -v python3.10 || command -v python3.9 || command -v python3)
    if [ -z "$PYTHON_BIN" ]; then
        echo "❌ 未找到 Python 3.x，请先在宝塔「软件商店」安装 Python 项目管理器或 Python 3.10"
        exit 1
    fi
fi
echo "[1/5] 使用 Python: $PYTHON_BIN"

# 2. 创建虚拟环境
echo ""
echo "[2/5] 创建虚拟环境并安装依赖..."
cd "$PROJECT_DIR"
if [ ! -d "$VENV_DIR" ]; then
    "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/pip" install --upgrade pip -i https://mirrors.tencent.com/pypi/simple/
"$VENV_DIR/bin/pip" install -r requirements.txt -i https://mirrors.tencent.com/pypi/simple/
echo "[2/5] 依赖安装完成"

# 3. 创建 systemd 服务
echo ""
echo "[3/5] 创建 systemd 服务..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Rural Errand FastAPI Service
After=network.target mysql.service mysqld.service mariadb.service

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
Environment="ALLOWED_ORIGINS=http://119.91.112.109,http://119.91.112.109:8000"
Environment="PORT=8000"
ExecStart=$VENV_DIR/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
StandardOutput=append:/var/log/${SERVICE_NAME}.log
StandardError=append:/var/log/${SERVICE_NAME}.err

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
echo "[3/5] systemd 服务已启动"

# 4. 等服务就绪
echo ""
echo "[4/5] 等待 API 启动..."
for i in {1..15}; do
    if curl -sf http://127.0.0.1:8000/api/health > /dev/null 2>&1; then
        echo "✅ API 服务已就绪"
        break
    fi
    if [ "$i" -eq 15 ]; then
        echo "⚠️  API 启动超时，请查看日志：tail -f /var/log/${SERVICE_NAME}.err"
    fi
    sleep 2
done

# 5. 输出 Nginx 反代配置示例
echo ""
echo "[5/5] 生成 Nginx 反代配置示例（请在宝塔「网站 → 反向代理」中添加）..."
cat > "$PROJECT_DIR/nginx-rural-errand.conf.example" <<'EOF'
# 把此配置加入您的 Nginx 站点，或在宝塔「反向代理」图形界面录入
# 推荐：将「rural.您的域名.com」反代到 127.0.0.1:8000

location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    client_max_body_size 10M;
}

location /static/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
}

location = / {
    return 302 /static/login.html;
}
EOF

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "119.91.112.109")

echo ""
echo "========================================="
echo "  ✅ 部署完成！"
echo "========================================="
echo ""
echo "管理员账号: admin"
echo "管理员密码: $ADMIN_PASSWORD"
echo ""
echo "如何访问？"
echo ""
echo "【方式 1：临时通过 8000 端口直接访问（需在腾讯云防火墙开 8000）】"
echo "  修改 systemctl 配置 host=0.0.0.0 后即可，命令："
echo "  sed -i 's/--host 127.0.0.1/--host 0.0.0.0/' /etc/systemd/system/${SERVICE_NAME}.service"
echo "  systemctl daemon-reload && systemctl restart ${SERVICE_NAME}"
echo "  然后浏览器：http://${PUBLIC_IP}:8000/static/login.html"
echo ""
echo "【方式 2：通过 Nginx 反代（推荐，使用 80 端口）】"
echo "  在宝塔「网站 → 反向代理」添加："
echo "    域名: rural.您的域名.com（备案后）"
echo "    目标 URL: http://127.0.0.1:8000"
echo "  访问：http://rural.您的域名.com/static/login.html"
echo ""
echo "常用命令："
echo "  查看日志:   tail -f /var/log/${SERVICE_NAME}.log"
echo "  查看错误:   tail -f /var/log/${SERVICE_NAME}.err"
echo "  重启服务:   systemctl restart ${SERVICE_NAME}"
echo "  停止服务:   systemctl stop ${SERVICE_NAME}"
echo "  服务状态:   systemctl status ${SERVICE_NAME}"
echo ""
echo "数据库管理："
echo "  通过宝塔「数据库」→ phpMyAdmin 图形界面操作"
echo ""
