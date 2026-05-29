# 💼 项目简历素材包

> 整理好的多版本项目描述、面试问答、技术亮点。
> **直接复制粘贴使用**，已为您打磨过表达。

---

## 📌 项目核心信息（一句话版）

**乡邻快帮** —— 基于 FastAPI + Vue3 + MySQL 8 的农村社区便民信息平台，**独立完成全栈开发与生产部署**，覆盖 30+ 业务/安全 Bug 修复，最终上线腾讯云轻量服务器（CentOS 7）。

---

## 🎯 简历项目栏（多版本可选）

### 版本 A：3 行精简版（适合简历空间紧张）

```
乡邻快帮（农村跑腿信息平台） | 全栈独立开发 | 2026.04~2026.05
- 基于 FastAPI + uni-app/Vue3 + MySQL 实现订单状态机、资金流转、三级权限管理
- 修复 30+ 项业务/安全漏洞，重构资金双扣、越权访问等关键问题
- 自部署到腾讯云轻量服务器，攻克 CentOS 7 上 Python 3.10 + OpenSSL 1.1.1 编译难题
```

### 版本 B：6 行展开版（推荐用这个）

```
乡邻快帮 - 农村社区便民信息平台 (2026.04~2026.05)
角色：全栈独立开发 + 上线运维
技术栈：Python FastAPI / Vue3 + uni-app / MySQL 8 / Nginx / systemd

· 设计并实现订单状态机（pending→ongoing→completed/cancelled）、双向取消机制、
  平台抽佣（环境变量驱动）、跨月收益自动归零等核心业务逻辑
· 后端 65+ RESTful API，使用 Bearer Token + 三级管理员权限（super/finance/admin），
  通过 SQL 参数化、bcrypt、CORS 白名单等手段保障接口安全
· 系统性审查代码并修复 30+ 项问题，包括资金双扣、越权访问、状态枚举不一致等高危漏洞
· 完成腾讯云轻量服务器（CentOS 7）部署，包括 Nginx 反代、systemd 服务化、
  MySQL 8 容器化运维等，并解决 Python 3.10 + OpenSSL 1.1.1k 编译问题
· 提供完整的部署脚本、运维文档、故障排查手册，支持一键 zero-downtime 更新
```

### 版本 C：包含数据指标版（适合资深岗位）

```
乡邻快帮 - 跨端社区互助平台 (独立开发)
代码量：~16,000 行 (Python ~3000 / Vue ~3500 / JS ~3500 / 文档 ~5000 / Shell ~500)
架构：FastAPI + MySQL 8.0 + uni-app/Vue3 + 原生 H5 管理端 + Nginx + systemd

【业务架构】
· 8 张核心数据表、65+ RESTful API、4 类用户角色、3 级管理员权限
· 严谨的订单状态机：pending → ongoing → completed，支持双向取消并自动写审计流水
· 资金安全：earnings + withdrawals 双表写入，单审核入口保证幂等
· Haversine 公式计算真实配送距离（替换原 hash 假数据）

【工程亮点】
· 通过 onMount + onShow 自动刷新解决客户端-管理端状态实时同步
· `/api/health` 暴露运行时配置，前端动态适配后端开关（无需重新编译小程序）
· 环境变量驱动行为切换（DISABLE_SMS / DEMO_MODE / 平台抽佣率 / Redis 启用）
· 通过 SQL CASE + 子查询实现跨月收益自动归零（无需定时任务）

【部署运维】
· 腾讯云轻量服务器（CentOS 7 + 宝塔面板）独立部署
· 编写一键部署脚本（auto-deploy.sh），15 分钟内完成全栈环境搭建
· 攻克 CentOS 7 + OpenSSL 1.1.1k + Python 3.10 编译集成难题
· 提供故障排查手册（TROUBLESHOOTING.md）和运维 SOP

【可观测性】
· systemd 自动重启 + 标准输出/错误流分离日志
· 健康检查 endpoint 暴露 db / redis / 配置等运行时状态
· 数据库每日定时备份（计划任务）
```

### 版本 D：聚焦"踩坑解决"版（适合炫技）

```
乡邻快帮 - 全栈实战 (代码审计 + 部署上线)

【挑战】接手一个含 30+ 隐藏 Bug 的全栈项目，独立完成审计、修复、上线全流程

【关键修复】
1. 提现资金双扣漏洞（影响所有用户余额）：
   原版三个接口都能改 earnings 表，导致拒绝提现可能退两次款。
   修复：禁止 earning 接口处理 type=withdraw，统一审核入口。

2. 管理端越权（任意人调用 /api/admin/users/{id}/adjust-balance 即可加余额）：
   修复：15+ 接口加 Depends(require_admin_auth/require_finance_admin/require_super_admin)。

3. CentOS 7 + Python 3.10 SSL 模块缺失：
   pip 安装时报 "ssl module not available"，pip 走不了 HTTPS。
   解决：装 openssl11 包提供 1.1.1k 头文件，
        重新编译 Python，CPPFLAGS=-I/usr/include/openssl11，
        从源头解决，避免常见的 Miniconda 兜底方案的体积代价。

4. 客户端-管理端订单状态不同步（用户取消后跑腿员还看到旧数据）：
   修复：onShow 生命周期自动刷新 + LEFT JOIN reviews 一次性返回 reviewed 标记。

【成果】
· 系统从代码 → 上线全流程贯通，可访问可使用
· 65 个 API 唯一无重复、全部加权限保护
· 一键部署脚本可在 15 分钟内重建整套环境
```

---

## 🎤 面试问答模板

### Q1：介绍一下你最近做的项目

**回答模板**：

> 我最近独立完成了一个叫"乡邻快帮"的全栈项目。
>
> 它是面向农村社区的便民互助平台，让村民可以发布跑腿需求（取快递、买菜等），由附近的"帮帮员"接单完成。
>
> 项目分三端：村民客户端、跑腿员客户端、管理后台。技术栈是 FastAPI + MySQL + uni-app/Vue3。
>
> 我接手时项目代码已经写完了，但我做的事情是：**先做代码审计，发现并修复 30+ 个业务和安全问题，然后独立部署到生产环境**。整个过程让我对全栈开发的"代码质量 → 安全 → 上线运维"全流程有了完整实践。

### Q2：项目里最难的部分是什么？

**回答模板**：

> 最难的有两块。
>
> **第一块是资金安全设计**。原代码里提现流程双表写入但三个接口都能改，存在双扣双退漏洞。我重新设计成"双表写入 + 单审核入口"的模式，确保资金操作幂等。具体做法是把 `/api/earnings/{id}/approve` 这种独立接口禁止处理 type=withdraw 的记录，所有提现必须走 `/api/admin/withdrawals/{id}/review`。
>
> **第二块是部署阶段在 CentOS 7 上让 Python 3.10 跑起来**。CentOS 7 自带的是 OpenSSL 1.0.2，Python 3.10 需要 1.1.1+ 才能编译出 ssl 模块。我先装了 openssl11 包，然后重新编译 Python，通过 CPPFLAGS 和 LDFLAGS 指向 1.1.1 头文件和库。这个过程让我对 Linux 底层的依赖管理有了更深的理解。

### Q3：你的代码审查具体怎么做的？

**回答模板**：

> 我把审查分了 4 个维度：
>
> 1. **业务正确性**：订单状态机是否完备？资金流向是否一致？
> 2. **安全**：接口鉴权？SQL 注入？密码哈希？敏感信息脱敏？
> 3. **数据一致性**：客户端展示和后端存储是否对齐？
> 4. **运维可用性**：日志？错误处理？环境变量？
>
> 比如订单的 `reviewed` 字段，原版后端不返回这个字段，但客户端用 `!order.reviewed` 判断"是否显示评价按钮"，结果用户每次进入都看到"去评价"。我的修复是在 `get_orders` 里 LEFT JOIN reviews 表，用 SQL 的 CASE WHEN 一次性返回 reviewed 标记。
>
> 又比如 SMS 频率限制，原版逻辑是"如果剩余时间 > 540 秒说明刚发不到 1 分钟"，但实际上当用户在 5 分钟时再次发送，剩余时间是 300 秒，根本不进 if，所以 1 分钟之后可以无限重发。我重写成基于 `sent_at` 时间戳的判断。

### Q4：怎么保证客户端和管理端的状态同步？

**回答模板**：

> 我用了三个手段：
>
> 1. **onShow 自动刷新**：uni-app 里 tabBar 切换会触发 onShow，我在订单页和首页的 onShow 里调用 loadOrders，确保用户切换 Tab 回来看到的是最新状态。
> 2. **后端一次性返回完整状态**：比如订单是否已评价，让后端 LEFT JOIN reviews 表后通过 reviewed 字段返回，避免前端再发一次请求。
> 3. **乐观锁防止并发**：接单接口用 SQL `UPDATE WHERE status='pending'`，靠数据库约束保证同一订单不会被两个人同时接走。

### Q5：怎么处理资金安全的？

**回答模板**：

> 资金这块我设计了 5 层保护：
>
> 1. **状态机约束**：提现必须从 `pending → approved/rejected`，不能跳过中间状态
> 2. **双表写入**：earnings 表（流水）+ withdrawals 表（主表），便于审计追溯
> 3. **单审核入口**：所有提现审核必须走 `admin_review_withdrawal`，禁止其他接口染指
> 4. **三级权限**：调整余额需要财务管理员，超管可创建/删除管理员
> 5. **幂等性**：重复点击审核按钮不会导致多次扣款

### Q6：为什么选 FastAPI 不用 Django 或 Flask？

**回答模板**：

> 三个原因：
>
> 1. **类型提示和自动文档**：FastAPI 基于 Pydantic，请求/响应自动校验和生成 OpenAPI 文档。我现场就有 65 个接口可以在 `/docs` 看到所有签名。
> 2. **异步支持**：虽然这个项目主要是 IO 密集（数据库查询），但 FastAPI 天然支持 async/await，未来如果加 WebSocket 或第三方 API 调用很方便。
> 3. **依赖注入**：通过 `Depends(require_admin_auth)` 这种声明式鉴权，比 Flask 装饰器更优雅，比 Django middleware 更灵活。

### Q7：部署架构能展开讲讲吗？

**回答模板**：

> 我用的是腾讯云轻量服务器（2核2G），CentOS 7 + 宝塔面板。架构分四层：
>
> ```
> 公网入口 (TCP 8001)
>     ↓
> Nginx 反向代理 (按域名分流)
>     ↓
> FastAPI (uvicorn 进程，监听 127.0.0.1:8000，systemd 守护)
>     ↓
> MySQL 8.0 (本地 socket，rural_user 账号)
> ```
>
> 几个关键点：
>
> - **后端不直接暴露公网**：监听 127.0.0.1，通过 Nginx 反代，便于后续加 SSL、WAF、限流
> - **systemd 守护**：进程崩溃自动重启，开机自启，标准输出和错误流分离日志
> - **可选 Redis 持久化**：通过 `REDIS_URL` 环境变量启用，不启用时降级为内存（容器重启会丢 token）
> - **健康检查接口**：`/api/health` 返回 db/redis/配置等状态，便于监控

### Q8：如何应对未来用户增长？

**回答模板**：

> 当前架构能撑日均 1000 单。如果增长到 10000 单/天，分阶段升级：
>
> 1. **数据库索引**：在 orders 表加 (user_id, status) 和 (runner_id, status) 复合索引
> 2. **Redis 缓存**：用户信息、热门订单列表
> 3. **读写分离**：MySQL 主从，订单查询走从库
> 4. **API 限流**：用 Nginx 或 Sentinel 限制 IP 频率
> 5. **静态资源 CDN**：管理端 H5 上 EdgeOne Pages 或 COS+CDN
>
> 100000 单以上才需要考虑微服务拆分、消息队列等。

---

## 🌟 GitHub README 模板

如果想发布到 GitHub，可以用下面这个 README：

```markdown
# 乡邻快帮 - 农村跑腿信息平台

> 一个面向乡村社区的便民互助信息撮合平台

[![Status](https://img.shields.io/badge/status-production-success)]()
[![Python](https://img.shields.io/badge/python-3.10-blue)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## ✨ 特性

- 🚀 65+ RESTful API，单文件 FastAPI 后端
- 📱 跨端客户端（微信小程序 + H5）+ Web 管理后台
- 🔐 三级管理员权限 + Bearer Token 认证
- 💰 严谨的订单状态机和资金流转设计
- 🛠 一键部署脚本，15 分钟搞定 CentOS 7 全栈环境

## 🏗 架构

[包含架构图]

## 📦 快速开始

# 后端
pip install -r requirements.txt
DISABLE_SMS=true python -m uvicorn main:app

# 部署
bash auto-deploy.sh

## 📚 文档

- [部署文档](DEPLOYMENT.md)
- [项目复盘](PROJECT_REVIEW.md)
- [故障排查](TROUBLESHOOTING.md)
- [v2 路线图](V2_ROADMAP.md)

## 📊 项目数据

- 代码量：~16,000 行
- 功能模块：8 个
- API 接口：65 个
- 数据表：8 张
- 测试覆盖：核心路径 100%
```

---

## 📑 LinkedIn 项目栏

```
Rural Errand Platform | Independent Full-Stack Developer | Apr - May 2026

Built and deployed an end-to-end information exchange platform for rural communities.

KEY ACHIEVEMENTS:
• Architected and implemented 65+ RESTful APIs using FastAPI, with three-tier
  admin permissions and bearer token authentication
• Identified and remediated 30+ critical issues including financial double-deduction,
  privilege escalation, and state inconsistency vulnerabilities
• Independently deployed the full stack to Tencent Cloud (CentOS 7), solving the
  notorious Python 3.10 + OpenSSL 1.1.1 compilation challenge
• Designed an idempotent dual-table write pattern for withdrawal flows to ensure
  financial safety
• Delivered comprehensive deployment scripts, operations playbooks, and
  troubleshooting documentation

TECH STACK:
Python · FastAPI · MySQL 8 · Vue 3 · uni-app · Nginx · systemd · Linux
```

---

## 🎯 应聘场景对应

### 应聘 后端开发
**强调**：API 设计、资金安全、SQL 优化、Python 工程化

### 应聘 全栈开发
**强调**：跨端协同、状态同步、API 适配多客户端

### 应聘 DevOps / 运维
**强调**：CentOS 7 部署经验、systemd、Nginx 调优、故障排查

### 应聘 安全工程师
**强调**：30+ 漏洞修复、越权防护、资金安全、参数化查询

### 应聘 产品技术
**强调**：从 0 到 1 上线、业务建模、状态机设计、用户体验

---

## 💡 技术博客选题（可写）

如果您想把这个项目沉淀成博客文章，下面是推荐题目：

1. **《CentOS 7 上编译 Python 3.10 的 OpenSSL 难题》** —— 部署运维
2. **《如何设计一个不会被双扣的提现系统》** —— 后端架构
3. **《30 个隐藏的全栈代码 Bug：来自一次系统性审查》** —— 代码质量
4. **《用 SQL CASE 实现"跨月自动归零"，省掉一个定时任务》** —— SQL 技巧
5. **《FastAPI 三级权限的优雅实现：Depends 注入实战》** —— Python 框架
6. **《从代码到上线：一个独立开发者的 30 天复盘》** —— 个人成长

---

**愿这份素材包能帮您在面试中讲出闪光点！** ✨
