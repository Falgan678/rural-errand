# 农村跑腿 - 微信小程序

基于 uni-app + Vue3 开发的微信小程序，复现了农村跑腿 Web 应用的完整功能。

## 项目结构

```
miniprogram/
├── src/
│   ├── pages/
│   │   ├── login/          # 登录/注册页面
│   │   ├── home/           # 首页（我有需求）
│   │   ├── runner/         # 跑腿页面（我当跑腿）
│   │   ├── orders/         # 订单管理
│   │   ├── profile/        # 个人中心
│   │   ├── order-detail/   # 订单详情
│   │   ├── publish/        # 发布需求
│   │   ├── withdraw/       # 申请提现
│   │   └── reviews/        # 评价页面
│   ├── stores/
│   │   └── user.js         # 用户状态管理（Pinia）
│   ├── utils/
│   │   └── api.js          # API 接口封装
│   ├── App.vue             # 全局入口
│   ├── main.js             # 主入口
│   ├── manifest.json       # uni-app 配置
│   └── pages.json          # 页面路由配置
├── package.json
└── vite.config.js
```

## 功能列表

- ✅ 登录/注册（密码登录 + 验证码登录）
- ✅ 发布跑腿需求
- ✅ 查看待接订单（跑腿员视角）
- ✅ 接单/完成订单/取消订单
- ✅ 订单管理（多状态筛选、搜索）
- ✅ 个人中心（收益统计、资料编辑）
- ✅ 申请提现
- ✅ 评价系统
- ✅ 意见反馈

## 如何发布到微信小程序

### 第一步：安装依赖

```bash
cd miniprogram
npm install
```

### 第二步：编译为微信小程序

```bash
npm run build:mp-weixin
```

编译完成后，会在 `miniprogram/dist/build/mp-weixin/` 目录生成小程序代码。

### 第三步：用微信开发者工具打开

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开微信开发者工具
3. 点击「导入项目」
4. 选择 `miniprogram/dist/build/mp-weixin/` 目录
5. 填入你的小程序 AppID（在微信公众平台申请）
6. 点击「确定」

### 第四步：配置后端地址

在 `src/utils/api.js` 中修改 `API_BASE` 为你的后端服务地址：

```javascript
const API_BASE = 'https://你的域名/api'
```

> ⚠️ 微信小程序要求后端必须是 HTTPS，且域名需要在微信公众平台配置白名单

### 第五步：发布上线

1. 在微信开发者工具中点击「上传」
2. 填写版本号和备注
3. 登录 [微信公众平台](https://mp.weixin.qq.com)
4. 进入「版本管理」→「开发版本」
5. 提交审核
6. 审核通过后点击「发布」

## 测试账号

| 手机号 | 密码 |
|--------|------|
| 13800138001 | 123456 |
| 13800138002 | 123456 |

## 注意事项

1. **AppID**：需要在微信公众平台注册小程序并获取 AppID
2. **域名备案**：后端服务器域名需要完成 ICP 备案
3. **HTTPS**：后端必须支持 HTTPS
4. **域名白名单**：在微信公众平台「开发」→「开发管理」→「服务器域名」中添加后端域名
