# 🛠 迭代开发指南

> 这份文档教您**如何安全高效地修改代码、添加功能、发布更新**。
> 适合：日常 bug 修复、添加小功能、运营功能迭代。

---

## 📋 目录

1. [开发环境准备](#开发环境准备)
2. [常见修改场景](#常见修改场景)
3. [代码修改流程（推荐 SOP）](#代码修改流程推荐-sop)
4. [典型功能添加示例](#典型功能添加示例)
5. [测试与验证](#测试与验证)
6. [发布与回滚](#发布与回滚)
7. [代码风格约定](#代码风格约定)

---

## 开发环境准备

### 本地开发（推荐）

```powershell
# Windows PowerShell
cd C:\Users\v_falgan\Desktop\农村跑腿小程序

# 创建本地虚拟环境（如果还没有）
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 设置本地环境变量并启动
$env:DEMO_MODE="1"           # 开演示模式，不需要数据库
$env:DISABLE_SMS="true"
python -m uvicorn main:app --reload --port 8001

# 浏览器访问 http://localhost:8001/static/login.html
```

### 直接在服务器开发（适合小修改）

```bash
# SSH 到服务器（或在宝塔的"终端"）
cd /www/wwwroot/rural-errand

# 用 vim / vi / 宝塔图形编辑器
vim main.py

# 修改完成后重启
systemctl restart rural-errand

# 验证
curl http://127.0.0.1:8000/api/health
```

---

## 常见修改场景

### 场景 1：修改文案（管理端 / 客户端）

**例**：把"农村跑腿"改成"乡邻互助"

```bash
# 在服务器执行（或本地修改后上传）
cd /www/wwwroot/rural-errand

# 1. 找到所有引用
grep -rn "农村跑腿" static/ main.py

# 2. 批量替换
sed -i 's/农村跑腿/乡邻互助/g' static/index.html static/login.html

# 3. 浏览器强制刷新（Ctrl+Shift+R）即可看到
```

### 场景 2：修改业务逻辑（后端）

**例**：把订单最低费用从 1 元改成 5 元

```bash
# 1. 编辑 main.py
vim /www/wwwroot/rural-errand/main.py

# 2. 找到 create_order 函数，修改判断条件：
#    if order.fee <= 0 or order.fee > 9999:
#  改为
#    if order.fee < 5 or order.fee > 9999:

# 3. 重启
systemctl restart rural-errand
```

### 场景 3：添加新接口

参考[典型功能添加示例](#典型功能添加示例)章节。

### 场景 4：修改数据库 schema

```bash
# 1. 备份数据库
bash /root/backup-mysql.sh

# 2. 通过宝塔 phpMyAdmin 修改（推荐）：
#    宝塔 → 数据库 → 找到 rural_errand → 点「管理」
#    在左侧选表 → 顶部「结构」标签 → 修改字段

# 或用命令行：
mysql -urural_user -p'0Wdd274VbeNwPXCRFK5t' rural_errand <<EOF
ALTER TABLE orders ADD COLUMN priority INT DEFAULT 0 COMMENT '订单优先级';
EOF

# 3. 修改后端代码使用新字段（如果需要）
# 4. 重启服务
systemctl restart rural-errand
```

### 场景 5：修改环境变量

```bash
# 编辑 systemd 配置
vim /etc/systemd/system/rural-errand.service

# 例如把抽佣率改成 5%：
# Environment=PLATFORM_COMMISSION_RATE=0.05

# 重新加载并重启
systemctl daemon-reload
systemctl restart rural-errand

# 验证
curl http://127.0.0.1:8000/api/health
# 看返回的 commission_rate 字段
```

### 场景 6：更新 Python 依赖

```bash
cd /www/wwwroot/rural-errand

# 1. 编辑 requirements.txt 添加新包

# 2. 安装
./venv/bin/pip install -r requirements.txt -i https://mirrors.tencent.com/pypi/simple/

# 3. 重启
systemctl restart rural-errand
```

### 场景 7：修改客户端小程序

```powershell
# 本地编辑
cd C:\Users\v_falgan\Desktop\农村跑腿小程序\miniprogram\src
# 修改 pages/xxx.vue

# 在 .env.production 配置 API 地址
# VITE_API_BASE=http://119.91.112.109:8001/api

# 编译
npm run build:mp-weixin

# 用微信开发者工具打开 dist/build/mp-weixin
# → 上传 → 微信公众平台 → 提交审核
```

---

## 代码修改流程（推荐 SOP）

### 🟢 安全的修改流程（避免线上事故）

```
1. 备份当前状态
   └─ 数据库备份 + 代码备份
2. 在测试环境验证（如果有）
   └─ 或在 main.py 上加 print 看实际行为
3. 修改代码
   └─ 一次只改一个功能，不要批量大改
4. 重启服务
   └─ systemctl restart rural-errand
5. 立即验证关键接口
   └─ curl http://127.0.0.1:8000/api/health
   └─ 浏览器测试受影响的功能
6. 等待 5~10 分钟观察日志
   └─ tail -f /var/log/rural-errand.err
7. 出问题立即回滚
```

### 🟡 一键备份脚本

把下面脚本存到 `/root/before-deploy.sh`：

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p /root/backups

echo "[1/3] 备份数据库..."
mysqldump -uroot -p'309aaa9d65c73a99' rural_errand | gzip > /root/backups/db_${DATE}.sql.gz

echo "[2/3] 备份代码..."
tar czf /root/backups/code_${DATE}.tar.gz -C /www/wwwroot rural-errand --exclude=venv --exclude='__pycache__'

echo "[3/3] 备份 systemd 配置..."
cp /etc/systemd/system/rural-errand.service /root/backups/service_${DATE}.bak

echo "完成 ✓ 备份位置：/root/backups/*_${DATE}.*"
ls -lah /root/backups/ | grep $DATE
```

修改前执行：
```bash
chmod +x /root/before-deploy.sh
/root/before-deploy.sh
```

---

## 典型功能添加示例

### 示例 1：添加"订单总数"统计接口

**目标**：管理端首页显示总订单数。

#### Step 1：后端添加接口

在 `main.py` 找个合适的位置加：

```python
@app.get("/api/admin/stats/orders-summary")
async def admin_orders_summary(admin_auth: dict = Depends(require_admin_auth)):
    """订单概览统计"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status='ongoing' THEN 1 ELSE 0 END) AS ongoing,
                    SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
                    SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
                    COALESCE(SUM(fee),0) AS total_fee
                FROM orders
            """)
            data = cursor.fetchone()
            data['total_fee'] = float(data['total_fee'] or 0)
            return {"code": 0, "data": data}
    finally:
        conn.close()
```

#### Step 2：重启服务

```bash
systemctl restart rural-errand
```

#### Step 3：测试

```bash
# 先登录拿 token
curl -X POST http://127.0.0.1:8000/api/admin/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"yx7iQyjbX6RJvHif"}'

# 用拿到的 token 调新接口
curl http://127.0.0.1:8000/api/admin/stats/orders-summary \
    -H "Authorization: Bearer <token>"
```

#### Step 4：管理端调用

编辑 `/www/wwwroot/rural-errand/static/admin-panel-main.js`，在仪表盘加载函数里加：

```javascript
async function loadOrderSummary() {
    const res = await api('GET', '/api/admin/stats/orders-summary');
    if (res.code !== 0) return;
    document.getElementById('total-orders').textContent = res.data.total;
    document.getElementById('total-fee').textContent = '¥' + res.data.total_fee.toFixed(2);
}
```

#### Step 5：浏览器强制刷新看效果

---

### 示例 2：给订单加"优先级"字段

#### Step 1：备份

```bash
/root/before-deploy.sh
```

#### Step 2：改 schema

```bash
mysql -urural_user -p'0Wdd274VbeNwPXCRFK5t' rural_errand <<EOF
ALTER TABLE orders ADD COLUMN priority TINYINT DEFAULT 0 COMMENT '0普通 1高 2紧急';
ALTER TABLE orders ADD INDEX idx_priority (priority);
EOF
```

#### Step 3：改后端 Pydantic 模型

```python
class Order(BaseModel):
    title: str
    pickup_address: str
    # ...
    priority: int = 0  # 新增
```

#### Step 4：改 INSERT 语句（在 create_order 中）

```python
cursor.execute(
    """INSERT INTO orders (..., priority) VALUES (..., %s)""",
    (..., order.priority)
)
```

#### Step 5：改客户端发布表单

`static/client-main.js` 添加优先级选择器，发布时带上 `priority` 字段。

#### Step 6：测试 + 验证

---

### 示例 3：给客户端添加"猜你想要"推荐

业务规则：根据订单关键词，给跑腿员推荐相似订单。

#### Step 1：后端加接口

```python
@app.get("/api/orders/recommend")
async def recommend_orders(keyword: str, limit: int = 5,
                            auth: dict = Depends(require_auth)):
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            like = f"%{keyword}%"
            cursor.execute(
                """SELECT id, title, fee, pickup_address, delivery_address
                   FROM orders
                   WHERE status='pending' AND (title LIKE %s OR goods_name LIKE %s)
                   ORDER BY created_at DESC LIMIT %s""",
                (like, like, limit)
            )
            return {"code": 0, "data": cursor.fetchall()}
    finally:
        conn.close()
```

---

## 测试与验证

### 测试矩阵（每次发布前必跑）

| # | 功能 | 操作 | 预期 |
|---|------|------|------|
| 1 | 客户端注册 | 访问 login.html → 填表注册 | 提示"注册成功" |
| 2 | 客户端登录 | 用刚注册的账号登录 | 跳转首页 |
| 3 | 发布订单 | 首页 → 发布需求 | 提示"发布成功"，订单列表多一条 |
| 4 | 跑腿员接单 | 切换"我来帮忙" → 接单 | 状态变 ongoing |
| 5 | 完成订单 | 我的订单 → 已送达 | 状态变 completed，余额增加 |
| 6 | 评价 | 进订单详情 → 评价 | 跑腿员评分更新 |
| 7 | 取消订单 | 待接单状态 → 取消 | 状态变 cancelled |
| 8 | 提现申请 | 个人中心 → 提现 | 余额减少，记录显示"审核中" |
| 9 | 管理端审核提现 | 提现管理 → 通过 | 客户端记录变"已到账" |
| 10 | 管理端封禁用户 | 用户管理 → 封禁 | 用户登录被拒 |
| 11 | 健康检查 | curl /api/health | db:true |
| 12 | API 鉴权 | 未带 token 调 admin 接口 | 401 |

### 性能测试

```bash
# 简单压测（200 个并发，1000 个请求）
ab -n 1000 -c 200 http://127.0.0.1:8000/api/health

# 期望：
# - Requests per second: > 200
# - 99% 响应时间 < 500ms
```

---

## 发布与回滚

### 标准发布流程

```bash
# 1. 备份
/root/before-deploy.sh

# 2. 拉取/上传新代码
# 通过宝塔上传 OR git pull OR scp

# 3. 安装依赖（如果有变动）
cd /www/wwwroot/rural-errand
./venv/bin/pip install -r requirements.txt

# 4. 数据库迁移（如果有 schema 变动）
mysql -urural_user -p rural_errand < migration.sql

# 5. 重启服务
systemctl restart rural-errand

# 6. 验证
sleep 5 && curl http://127.0.0.1:8000/api/health

# 7. 跑测试矩阵关键 case（10 分钟）
```

### 回滚流程

```bash
# 找到最近的备份
ls -t /root/backups/ | head -10

# 还原代码
cd /www/wwwroot
rm -rf rural-errand_old
mv rural-errand rural-errand_old
tar xzf /root/backups/code_20260520_HHMMSS.tar.gz

# 还原数据库（只在数据库变动后才需要）
gunzip < /root/backups/db_20260520_HHMMSS.sql.gz | mysql -uroot -p rural_errand

# 还原 systemd（只在配置变动后才需要）
cp /root/backups/service_20260520_HHMMSS.bak /etc/systemd/system/rural-errand.service
systemctl daemon-reload

# 重启
systemctl restart rural-errand

# 验证
curl http://127.0.0.1:8000/api/health
```

### 零停机更新（小改动）

对于只改 main.py 的小改动：

```bash
# 1. 修改 main.py
vim /www/wwwroot/rural-errand/main.py

# 2. 重启（systemd 会立即拉起新进程，~2 秒中断）
systemctl restart rural-errand

# 3. 验证
sleep 3 && curl http://127.0.0.1:8000/api/health
```

对于需要零中断的，可以引入 gunicorn 多 worker 滚动重启（v2 优化项）。

---

## 代码风格约定

### Python 后端

- **命名**：函数 snake_case，类 PascalCase，常量 UPPER_CASE
- **字符串**：优先用双引号 `"text"`，f-string 优于 .format
- **错误处理**：业务错误返回 `{"code": 1, "message": "..."}`，系统错误抛 `HTTPException`
- **SQL**：参数化查询（绝对不要拼字符串）
- **认证**：用 `Depends(require_xxx_auth)` 而不是手动检查 token

#### 添加接口的模板

```python
@app.get("/api/your-resource")
async def get_your_resource(
    page: int = 1,
    page_size: int = 20,
    admin_auth: dict = Depends(require_admin_auth)  # 鉴权
):
    """接口说明（一句话）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 业务逻辑
            cursor.execute("SELECT ... FROM ... WHERE ...", (params,))
            data = cursor.fetchall()
            return {"code": 0, "data": data}
    except Exception as e:
        print(f"[your_resource] error: {e}")
        return {"code": 1, "message": "操作失败"}
    finally:
        conn.close()
```

### 前端 / 静态 JS

- 用 `async/await` 不用 `.then`
- API 调用统一通过 `api()` 函数（在 admin-panel-main.js）
- DOM 操作用 `document.getElementById` 或 `querySelector`
- 字符串模板用反引号
- 错误处理：`if (res.code !== 0) showToast(res.message, 'error')`

---

## 📚 进阶参考

- **FastAPI 官方文档**：https://fastapi.tiangolo.com/
- **PyMySQL 文档**：https://pymysql.readthedocs.io/
- **systemd 服务管理**：`man systemd.service`
- **Nginx 配置参考**：https://nginx.org/en/docs/

---

**核心原则**：
- 改之前先备份
- 一次改一个功能
- 改完立即验证
- 出问题立即回滚

✨ **祝您迭代顺利！**
