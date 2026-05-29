# 🛵 农村跑腿（Rural Errand）

> 面向乡镇／农村场景的"互助型跑腿"全栈项目：用户发布跑腿需求，附近的同村跑腿员就近接单赚取跑腿费。包含 **微信小程序 + Web 客户端 + 管理后台 + FastAPI 后端 + MySQL** 的完整实现，并已部署到腾讯云 CloudBase 云托管。

[![Made with FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![WeChat MiniProgram](https://img.shields.io/badge/Frontend-微信小程序-07C160?logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/)
[![Deploy on CloudBase](https://img.shields.io/badge/Deploy-Tencent%20CloudBase-00A4FF?logo=tencentqq&logoColor=white)](https://tcb.cloud.tencent.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌐 在线体验

| 入口 | 地址 | 说明 |
| ---- | ---- | ---- |
| **Web 客户端**（推荐） | <https://cloud1-1goqml70f3d9d1d1-1394833136.tcloudbaseapp.com/> | 用户端首页：发布需求、抢单、查看分布图 |
| **登录页** | <https://cloud1-1goqml70f3d9d1d1-1394833136.tcloudbaseapp.com/login.html> | 用户/跑腿员/管理员统一登录 |
| **管理后台** | <https://cloud1-1goqml70f3d9d1d1-1394833136.tcloudbaseapp.com/admin-panel.html> | 订单管理、用户管理、对账 |
| **后端 API** | `https://rural-errand-api-246677-4-1394833136.sh.run.tcloudbase.com/api` | FastAPI（Swagger 文档：在 URL 末尾加 `/docs`） |
| **GitHub Pages 镜像** | <https://falgan678.github.io/rural-errand/> | 静态镜像（开启方式：仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main` / 目录 `/static`，几分钟后生效。API 仍指向上面的 CloudRun） |

> 💡 **测试账号**：见 [`TEST_ACCOUNTS.md`](./TEST_ACCOUNTS.md)
>
> ⚠️ 体验环境为公益演示，请勿提交真实订单和真实手机号。

---

## ✨ 核心功能

### 用户端（"我有需求"）
- 📍 一键发布跑腿需求（带地图选点、起止地点、跑腿费、备注）
- 🗺 跑腿需求**地图分布图**（基于高德地图 API）
- 📋 实时订单列表 / 我的订单 / 订单状态跟踪
- 👤 个人中心（信誉值、累计订单）

### 跑腿员端（"我当跑腿"）
- 🔍 附近订单浏览（按距离排序）
- ✅ 一键抢单 / 完成订单 / 上传送达照片
- 💰 收益统计、提现申请

### 管理后台
- 📦 订单全生命周期管理（待接单 / 进行中 / 已完成 / 异常）
- 👥 用户与跑腿员审核
- 💸 平台抽佣配置（环境变量 `PLATFORM_COMMISSION_RATE`）
- 📊 订单/收益数据看板

### 微信小程序（`miniprogram/`）
- 与 Web 端共用同一套 FastAPI 后端
- 支持微信原生授权登录、扫码、定位

---

## 🏗 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Python 3.11 · FastAPI · PyMySQL · bcrypt · uvicorn |
| 数据库 | MySQL 8.0（生产）/ MariaDB（本地） |
| Web 前端 | 原生 HTML/CSS/JS · TailwindCSS（CDN）· Flatpickr · 高德地图 JS API |
| 小程序 | 微信原生小程序框架 |
| 部署 | 腾讯云 CloudBase 云托管（CloudRun，容器化）+ 静态网站托管 |
| 容器 | Docker（见 [`Dockerfile`](./Dockerfile)） |

---

## 📁 目录结构

```
.
├── main.py                    # FastAPI 主入口（所有 API 路由）
├── Dockerfile                 # CloudRun 容器镜像
├── requirements.txt           # Python 依赖
├── cloudrun-entrypoint.sh     # 生产容器启动脚本
├── cloudbaserc.json           # CloudBase 项目配置
│
├── static/                    # Web 客户端 + 管理后台（静态托管）
│   ├── index.html             #   用户客户端
│   ├── login.html             #   登录页
│   ├── admin-panel.html       #   管理后台
│   ├── client-main.js
│   ├── admin-panel-main.js
│   └── config.js              #   API 地址自动切换（本地 / 线上）
│
├── miniprogram/               # 微信小程序源码
│
├── PRD_极简通俗版.md           # 产品需求文档
├── DEPLOYMENT.md              # 部署指南
├── DEVELOPMENT_GUIDE.md       # 本地开发指南
├── V2_ROADMAP.md              # V2 路线图
└── .env.example               # 环境变量模板
```

---

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/Falgan678/rural-errand.git
cd rural-errand
```

### 2. 后端本地运行
```bash
# 创建虚拟环境
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
#  然后编辑 .env，填入你的 MySQL 连接信息

# 启动（默认 http://127.0.0.1:8001 ）
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

启动后访问：
- API 文档：<http://127.0.0.1:8001/docs>
- Web 客户端：<http://127.0.0.1:8001/static/index.html>

### 3. 前端本地预览
`static/config.js` 已自动识别 `localhost`，会把 API 转向本地 8001 端口，直接用 VS Code Live Server / `python -m http.server` 打开 `static/` 即可。

### 4. 微信小程序
用**微信开发者工具**导入 `miniprogram/` 目录即可。`appid` 在 `miniprogram/project.config.json` 中按需修改。

---

## ☁️ 部署到腾讯云 CloudBase

```bash
# 安装 CLI
npm i -g @cloudbase/cli

# 登录并部署
tcb login
tcb run deploy --envId <你的环境ID>
```

详见 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 与 [`README-DEPLOY-NOW.md`](./README-DEPLOY-NOW.md)。

---

## 📚 文档

- [`PRD_极简通俗版.md`](./PRD_极简通俗版.md) · 产品需求（极简版）
- [`DEVELOPMENT_GUIDE.md`](./DEVELOPMENT_GUIDE.md) · 本地开发指南
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) · 部署手册
- [`AMAP_CONFIG_GUIDE.md`](./AMAP_CONFIG_GUIDE.md) · 高德地图 Key 申请
- [`SMS_CONFIG.md`](./SMS_CONFIG.md) · 短信验证码配置
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) · 常见问题
- [`V2_ROADMAP.md`](./V2_ROADMAP.md) · V2 路线图

---

## 🤝 贡献

欢迎 Issue 和 PR。特别欢迎：
- 新场景适配（社区团购、应急代购、农资配送等）
- 国际化 / 多方言支持
- 性能与安全优化

---

## 📄 License

[MIT](./LICENSE) © 2026 Falgan678
