# 🚨 故障排查速查手册（FAQ）

> 当系统出问题时，**按下面顺序检查**通常能在 5 分钟内定位问题。

---

## 🆘 紧急情况：网站完全打不开

### Step 1：判断问题层级

```bash
# 在本地命令行（不是服务器）执行
curl -I http://119.91.112.109:8001/api/health
```

- **超时（卡住没响应）** → 服务器/防火墙问题
- **Connection refused** → Nginx 没起来或防火墙拒绝
- **HTTP 502** → 后端服务挂了
- **HTTP 503** → 数据库挂了
- **HTTP 200** → 服务正常，可能是您的浏览器缓存

### Step 2：登录服务器排查

```bash
# 服务器（宝塔终端）
echo "=== 1. 服务状态 ==="
systemctl status rural-errand --no-pager
systemctl status nginx --no-pager
systemctl status mysqld --no-pager

echo "=== 2. 端口监听 ==="
ss -tlnp | grep -E "(80|443|8000|8001|3306)"

echo "=== 3. 健康检查 ==="
curl -s http://127.0.0.1:8000/api/health

echo "=== 4. 错误日志 ==="
tail -n 30 /var/log/rural-errand.err
```

### Step 3：常见症状对应解决

| 症状 | 原因 | 解决 |
|------|------|------|
| `systemctl status` 显示 `failed` | 后端崩溃 | `journalctl -u rural-errand -n 50` 看日志 |
| 端口 8000 没监听 | 后端没起来 | `systemctl restart rural-errand` |
| 端口 8001 没监听 | Nginx 配置问题 | `nginx -t` 测试 → `systemctl reload nginx` |
| `curl` 返回 `db unreachable` | MySQL 挂了 | `systemctl restart mysqld` |
| 公网 ping 不通 | 腾讯云防火墙 | 控制台 → 防火墙 → 检查 8001 规则 |

---

## 📋 按问题分类查找

### 🔴 后端相关

#### 问题：API 返回 500
```bash
# 看完整 traceback
tail -n 100 /var/log/rural-errand.err | grep -A 20 "Traceback"
```

#### 问题：API 返回 503 数据库连接失败
```bash
# 1. 检查 MySQL 服务
systemctl status mysqld

# 2. 测试连接
mysql -urural_user -p'0Wdd274VbeNwPXCRFK5t' -h127.0.0.1 -e "SELECT 1"

# 3. 检查 systemd 配置中的密码
systemctl show rural-errand -p Environment | tr ' ' '\n' | grep DB_

# 4. 重启
systemctl restart rural-errand
```

#### 问题：修改了 main.py 不生效
```bash
# 必须重启服务才能生效
systemctl restart rural-errand
sleep 3
curl http://127.0.0.1:8000/api/health
```

#### 问题：依赖找不到 / ImportError
```bash
cd /www/wwwroot/rural-errand
./venv/bin/pip install -r requirements.txt -i https://mirrors.tencent.com/pypi/simple/
systemctl restart rural-errand
```

### 🔴 数据库相关

#### 问题：登不上 MySQL
```bash
# 用 root 登录
mysql -uroot -p'309aaa9d65c73a99'

# 如果 root 密码也错了，宝塔里能改：
# 宝塔 → 数据库 → 找 rural_errand 那行右边的「root 密码」按钮
```

#### 问题：表丢了 / 数据丢了
```bash
# 还原最近的备份
ls -la /root/backups/
gunzip < /root/backups/rural_errand_最新日期.sql.gz | mysql -uroot -p rural_errand
```

#### 问题：MySQL 占用过高
```bash
# 看是不是有慢查询
mysql -uroot -p -e "SHOW PROCESSLIST"

# 看连接数
mysql -uroot -p -e "SHOW STATUS LIKE 'Threads_connected'"

# 必要时重启（注意会断所有连接）
systemctl restart mysqld
systemctl restart rural-errand
```

### 🔴 登录相关

#### 问题：管理员密码忘了
```bash
# 查看部署时的凭证文件
cat /root/rural-errand-credentials.txt

# 或者重置 admin 密码（用 Python 生成 bcrypt 哈希）
cd /www/wwwroot/rural-errand
./venv/bin/python -c "
import bcrypt, pymysql
new_pwd = '您的新密码'
hashed = bcrypt.hashpw(new_pwd.encode(), bcrypt.gensalt()).decode()
conn = pymysql.connect(host='127.0.0.1', user='rural_user', password='0Wdd274VbeNwPXCRFK5t', database='rural_errand')
with conn.cursor() as c:
    c.execute('UPDATE admins SET password=%s WHERE username=%s', (hashed, 'admin'))
    conn.commit()
print('已重置 admin 密码为:', new_pwd)
"
```

#### 问题：用户登录失败
```bash
# 1. 确认账号存在
mysql -urural_user -p'0Wdd274VbeNwPXCRFK5t' rural_errand -e "SELECT id, name, phone, status FROM users WHERE phone='13800000001'"

# 2. 重置用户密码
# 在管理端 → 用户管理 → 找到该用户 → 重置密码
```

#### 问题：登录后立即被踢出
```bash
# 通常是 token 过期或服务重启
# 看后端日志
tail -f /var/log/rural-errand.err

# 重新登录即可
```

### 🔴 Nginx / 网络相关

#### 问题：重定向死循环
```bash
# 看 Nginx 配置是否有 return 302 死循环
cat /etc/nginx/conf.d/rural-errand.conf
```

#### 问题：CORS 错误（跨域）
```bash
# 在 systemd 配置里检查 ALLOWED_ORIGINS
systemctl show rural-errand -p Environment | grep ALLOWED_ORIGINS

# 如需添加新源
sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://119.91.112.109:8001,https://yourdomain.com|' /etc/systemd/system/rural-errand.service
systemctl daemon-reload
systemctl restart rural-errand
```

#### 问题：上传文件失败
```bash
# 1. Nginx 上传大小限制
grep client_max_body_size /etc/nginx/conf.d/rural-errand.conf
# 应该看到 client_max_body_size 10M;

# 2. 上传目录权限
ls -la /www/wwwroot/rural-errand/static/uploads/
# 如果没有该目录
mkdir -p /www/wwwroot/rural-errand/static/uploads/avatars
chmod 755 /www/wwwroot/rural-errand/static/uploads/avatars
```

### 🔴 性能问题

#### 问题：响应变慢
```bash
# 1. 看服务器资源
top                # 看 CPU / 内存
free -h            # 看内存
df -h              # 看磁盘

# 2. 看是否有大量待处理请求
ss -s              # 连接数
ss -tlnp | grep 8000

# 3. 看 MySQL 是否瓶颈
mysql -uroot -p -e "SHOW PROCESSLIST"
```

#### 问题：磁盘满了
```bash
# 找占用最大的目录
du -sh /* 2>/dev/null | sort -h | tail -10
du -sh /var/log/* 2>/dev/null | sort -h | tail -10
du -sh /www/wwwroot/* 2>/dev/null | sort -h | tail -10

# 清理日志（不会影响系统运行）
> /var/log/rural-errand.log
> /var/log/rural-errand.err
> /var/log/nginx/access.log
> /var/log/nginx/error.log

# 清理 pip 缓存
rm -rf /root/.cache/pip/

# 清理旧备份（保留最近 7 天）
find /root/backups -name "*.sql.gz" -mtime +7 -delete
```

---

## 🎯 检查清单：每周维护

每周花 5 分钟做一次：

```bash
# 1. 看服务状态
systemctl status rural-errand mysqld nginx

# 2. 看磁盘
df -h

# 3. 看备份是否生效
ls -la /root/backups/ | tail -10

# 4. 看异常日志
tail -n 100 /var/log/rural-errand.err | grep -i "error\|exception\|critical"

# 5. 健康检查
curl -s http://127.0.0.1:8000/api/health | python3 -m json.tool

# 6. 数据库 size
mysql -uroot -p -e "
SELECT table_schema 'DB', SUM(data_length+index_length)/1024/1024 'Size(MB)'
FROM information_schema.tables
WHERE table_schema='rural_errand' GROUP BY table_schema;
"
```

---

## 📞 升级故障：完全无法解决时

### 联系腾讯云技术支持

如果是服务器层面的问题（IP 不通、机器死机）：

- 工单：https://console.cloud.tencent.com/workorder
- 客服热线：4009100100

### 重置服务器（终极方案）

⚠️ **会丢失所有数据**，谨慎操作：

1. 备份数据库到本地
2. 备份 `/www/wwwroot/rural-errand/` 整个目录到本地
3. 腾讯云控制台 → 您的实例 → 「重装系统」
4. 重新执行 `auto-deploy.sh`
5. 还原数据库备份

---

## 🔁 常用一行命令

```bash
# 一键重启所有相关服务
systemctl restart rural-errand mysqld nginx

# 一键查看所有日志最后 20 行
tail -n 20 /var/log/rural-errand.err /var/log/rural-errand.log /var/log/nginx/error.log

# 一键备份
mysqldump -uroot -p'309aaa9d65c73a99' rural_errand | gzip > /root/backups/manual_$(date +%Y%m%d_%H%M%S).sql.gz

# 一键查看在线用户数
curl -s http://127.0.0.1:8000/api/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('用户:', d['data']['active_user_tokens'], '管理员:', d['data']['active_admin_tokens'])"

# 一键查看今日订单数
mysql -urural_user -p'0Wdd274VbeNwPXCRFK5t' rural_errand -e "SELECT COUNT(*) as today_orders FROM orders WHERE DATE(created_at)=CURDATE()"
```

---

**保持冷静，按步骤排查，95% 的问题都能在 10 分钟内解决** ✅
