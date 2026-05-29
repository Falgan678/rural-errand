# 部署指引（新服务器 / 新域名）

> **版本说明**：当前为 **v1** 生产版本。微信支付 / 头像 COS / 订阅消息 / 实时定位 等业务增强功能已规划在 v2，详见 [`V2_ROADMAP.md`](./V2_ROADMAP.md)。
>
> 本文档同时覆盖：后端（FastAPI on 云托管/Docker）+ 客户端小程序（uni-app）+ 管理端（静态 Web）。
> 建议在测试环境完整跑一遍后再切换正式流量。

---

## 1. 后端（FastAPI）

### 1.1 必须配置的环境变量

| 变量 | 用途 | 必填 | 示例 |
|------|------|------|------|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 | ✅ | `gz-cdb-xxx.sql.tencentcdb.com` / `3306` / ... |
| `ALLOWED_ORIGINS` | CORS 白名单，逗号分隔的可信源 | ✅（生产） | `https://m.example.com,https://admin.example.com` |
| `INITIAL_ADMIN_USERNAME` | 首次启动自动建库时的超管账号 | 推荐 | `admin` |
| `INITIAL_ADMIN_PASSWORD` | 首次启动自动建库时的超管密码 | 推荐 | `请改成强密码` |
| `INITIAL_ADMIN_ROLE` | 超管角色 | 否 | `super` |
| `INITIAL_ADMIN_NAME` | 超管显示名 | 否 | `系统管理员` |
| `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` | 腾讯云短信 | 生产必填 | - |
| `SMS_SDK_APP_ID` | 短信 SDK AppId | 生产必填 | - |
| `SMS_SIGN_NAME` | 短信签名 | 生产必填 | `农村跑腿` |
| `SMS_TEMPLATE_ID` | 短信模板 ID | 生产必填 | - |
| `PLATFORM_COMMISSION_RATE` | 平台抽佣比例（0~1） | 否 | `0.05` 表示 5% |
| `REDIS_URL` | Redis 持久化会话/验证码 | 推荐 | `redis://:password@host:6379/0` |
| `APP_ENV` | 环境标识 | 否 | `production` |
| `ENABLE_DEBUG_TOOLS` | 是否启用 `/api/debug/*` 调试接口 | 生产必为空 | 留空 |
| `ENABLE_PROJECT_DOWNLOAD` | 是否启用项目打包下载 | 生产必为空 | 留空 |
| `DEMO_MODE` | 是否启用演示模式（绕过数据库） | 生产必为空 | 留空 |

### 1.2 启动

容器入口（参见 `cloudrun-entrypoint.sh`）：

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --workers 2
```

健康检查：`GET /api/health` 返回 200 + `{code:0, data:{db:true,redis:true|false,...}}` 表示就绪。

### 1.3 上线前检查清单

- [ ] `ALLOWED_ORIGINS` 已配置为新域名白名单
- [ ] 演示开关 / 调试开关 / 项目下载 三项均为关闭状态
- [ ] `INITIAL_ADMIN_PASSWORD` 已改为强密码，**首次登录后立即在管理端修改密码**
- [ ] `TENCENT_SMS_*` 全部配置正确（否则会进入 dev_mode 不下发真实短信）
- [ ] 已挂载 Redis 或接受"容器重启用户需要重新登录"
- [ ] 数据库 schema 与 `cloudrun-seed.sql` 对齐（重点：`users.status`、`withdrawals`、`feedback`、`admins` 表存在）

---

## 2. 客户端小程序（uni-app）

### 2.1 切换 API 地址（推荐方式：环境变量）

在 `miniprogram` 目录下新建 `.env.production` 文件：

```ini
VITE_API_BASE=https://api.example.com/api
```

然后执行：

```bash
cd miniprogram
npm install
npm run build:mp-weixin   # 或 build:h5 / build:mp-alipay 等
```

构建产物会自动使用上述地址。

### 2.2 兜底方式

若不便配置环境变量，直接修改 `miniprogram/src/utils/api.js` 第 3 行：

```js
let API_BASE = 'https://你的新域名/api'
```

### 2.3 微信小程序后台需要做的事

1. 「开发」→「服务器域名」→ 添加 `request 合法域名`：`https://你的新域名`
2. 提交版本审核前确保 `pages.json`、`manifest.json` 中 `appid` 正确
3. 提审材料参考根目录 `小程序提审材料包.md`

---

## 3. 管理端（静态 Web）

### 3.1 修改 API 地址

修改 `static/config.js` 中的默认值即可（已支持自动识别 localhost，无需手动判断本地/线上）：

```js
var defaults = {
    apiBase: 'https://api.example.com/api',
    ...
};
```

### 3.2 部署方式

- **CDN/静态托管**：把整个 `static/` 目录上传（EdgeOne Pages / COS+CDN / Nginx 均可）
- **同源部署**：直接随后端一起挂载（FastAPI 已在 `main.py` 末尾通过 `app.mount('/static', ...)` 自动暴露）
- **域名建议**：管理后台域名独立配置，例如 `admin.example.com`，并加白名单 IP 访问控制

---

## 4. 部署后冒烟测试

| # | 场景 | 预期 |
|---|------|------|
| 1 | `curl https://api.example.com/api/health` | 返回 `code:0`，`db:true` |
| 2 | 客户 A 注册 → 登录 → 发布订单 ¥10 | home 显示"我有 1 待接单" |
| 3 | 跑腿 B 看到 A 的订单 → 接单 | A 那边状态变 ongoing |
| 4 | B 完成订单（抽佣 5%） | B 余额 +9.5，平台 earnings +0.5 |
| 5 | A 在订单详情点"去评价"，提交 4 分 | B 评分被更新；A 再进**不再有去评价按钮** |
| 6 | B 申请提现 ¥9.5 | 余额变 0，记录显示"审核中" |
| 7 | 管理端提现审核通过 | B 客户端记录显示**"已到账"** |
| 8 | B 接单后选择"放弃接单" | 订单回到 pending；A 那边状态退回"待接单" |
| 9 | 未登录访问 `/api/orders?status=pending` | 返回脱敏的 pending 列表，**无 500** |
| 10 | 普通用户 token 访问 `/api/admin/users` | 返回 401 |
| 11 | A 尝试自接自己的订单 | 返回"不能接自己发布的订单" |
| 12 | 重启容器后用旧 token 调 `/api/orders` | 配置了 Redis → 仍然 200；未配置 → 401（符合预期） |

---

## 5. 安全提示

- 切勿在公网暴露 `ENABLE_DEBUG_TOOLS=1`
- 切勿在生产开启 `DEMO_MODE=1`，演示账户密码 `admin/admin123` 是公开的
- 上线后建议在云托管/网关层加 WAF 规则，拦截 SQL 注入、CC 攻击
- 头像目前仍写本地磁盘，**强烈建议改用 COS**（容器扩容/重启会丢图）

---

## 6. 回滚

如果上线后出现问题：

```bash
# 云托管控制台：回滚到上一个镜像版本
# 或本地构建并 push 上次的 commit
git checkout <last_stable_commit>
docker build -t rural-errand-api:rollback .
```

数据库结构本次未做不兼容变更（仅新增 `cancel_record`、`runner_cancel`、`platform_fee` 三种 earnings.type，旧版本前端会简单忽略），无需做数据迁移。
