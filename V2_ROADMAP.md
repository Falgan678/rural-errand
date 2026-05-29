# v2 版本迭代路线图

> 当前 v1 版本已完成生产可用度交付，下列功能为业务增强项，**不影响 v1 上线运行**，将在后续迭代中补全。

---

## 🟡 v2 中优先级（建议在 v1 上线 1~2 个月内完成）

### 1. 微信小程序支付（JSAPI）+ 退款 API

**当前状态（v1）**
- `payment_method` 字段保留 `'wechat'` / `'cash'` 两个枚举值
- 客户端发布订单页**已临时屏蔽"微信支付"选项**（点击会提示"即将开放"），默认值为 `cash`
- 所有结算依靠管理员在管理端手工审核

**v2 目标**
- 接入微信支付 JSAPI（小程序内调起 `wx.requestPayment`）
- 后端新增 `/api/orders/{id}/pay`（统一下单）和 `/api/orders/{id}/refund`（退款）
- 微信支付回调 `/api/wxpay/notify` 写入 `payments` 表
- 取消订单流程联动退款

**预计工作量**：3~5 工作日（不含商户号申请审核时间）

**前置条件**
- 申请微信支付商户号（mch_id）
- 配置 API v3 密钥
- 服务器部署 SSL 证书（已在 v1 完成）

---

### 2. 头像 / 图片附件改用对象存储（COS）

**当前状态（v1）**
- `/api/users/upload-avatar` 写入容器本地 `static/uploads/avatars/`
- 容器扩容/滚动更新时图片会丢失
- `main.py` 已在该接口加注释提示此限制

**v2 目标**
- 集成腾讯云 COS Python SDK
- 后端只生成上传凭证，客户端直传 COS（不经过后端流量）
- `users.avatar` 字段存 COS URL（`https://<bucket>.cos.<region>.myqcloud.com/avatars/...`）
- 老的本地路径自动降级（`normalize_user_avatar` 已具备清理逻辑）

**预计工作量**：1 工作日

**临时缓解方案（v1 阶段）**
- 在云托管/Docker 上挂载 CFS/NFS 持久化卷到 `/app/static/uploads`
- 或运维侧定期把 `static/uploads/avatars/` 目录备份到 COS

---

### 3. 微信订阅消息推送

**当前状态（v1）**
- 接单/完成/取消/审核等关键事件，对方端**没有任何系统通知**
- 用户只能靠主动刷新查看（v1 已为 home/orders/runner 页加上 `onShow` 自动刷新作为缓解）

**v2 目标**
- 客户端集成 `wx.requestSubscribeMessage`（接单/完成/取消三类模板）
- 后端事件触发点：
  - `accept_order` → 通知发布者"您的订单已被接单"
  - `complete_order` → 通知发布者"订单已完成，请评价"
  - `cancel_order` / `runner_cancel_order` → 通知对方
  - `admin_review_withdrawal` → 通知用户提现结果
- 引入 `notifications` 表做消息历史记录

**预计工作量**：2~3 工作日

**前置条件**
- 在微信公众平台申请订阅消息模板（每个模板需要审核 1~3 天）

---

### 4. 跑腿员实时定位 + 地图轨迹

**当前状态（v1）**
- `mapModule.js` 仅做静态展示订单的取/送地址点
- 发布者看不到跑腿员位置
- 订单 `distance` 字段在 v1 已改用 Haversine 真实距离计算

**v2 目标**
- 跑腿员客户端在 `ongoing` 状态下定时（30s）调用 `wx.getLocation` 上报位置到 `/api/orders/{id}/runner-location`
- 后端新增 `runner_locations` 表（order_id, lat, lng, speed, ts），并设置 TTL 7 天
- 发布者订单详情页内嵌地图，定时拉取最近坐标点绘制轨迹
- 订单完成后冻结轨迹用于事后追溯

**预计工作量**：3~4 工作日

**注意**：需要在小程序后台开启`scope.userLocation`权限申请，并准备隐私协议补充说明

---

## 🔵 v3 低优先级（可选）

| 项 | 说明 |
|----|------|
| 数据库索引优化 | `orders` 数据增长后加 `idx_user_status`、`idx_runner_status` 复合索引 |
| API IP 维度限流 | 网关层接入，避免短信接口被刷号 |
| 后端日志收集 | print → 腾讯云 CLS 或 ELK |
| 数据库主备 + 自动备份 | TencentDB 控制台开启 |
| 监控告警 | 后端 5xx、提现待审核积压、DB 连接失败 |
| Dockerfile 多阶段构建 | 镜像体积 500MB → 150MB |
| 平台抽佣报表 | 管理端新增"平台收入"页面，基于 `earnings.type='platform_fee'` 聚合 |
| 跑腿员等级体系 | 完成单数/评分驱动的青铜/白银/金牌跑腿员，享受不同抽佣比例 |

---

## 📅 建议节奏

| 时间 | 内容 |
|------|------|
| 当前 | v1 上线，运营 2~4 周收集真实问题 |
| v1.1（1~2 周后） | 修复运营反馈的细节 bug，不引入大功能 |
| v2.0（1~2 个月后） | 完成上述 4 项中优先级（按业务紧迫度排序） |
| v3.0（半年后） | 工程化深度优化 + 业务增长功能 |

---

## v1 已交付的能力清单（用于对比）

- ✅ 用户注册/登录（密码 + 短信验证码）
- ✅ 订单全流程：发布 → 接单 → 完成 → 评价
- ✅ 双向取消机制：发布者取消 + 跑腿员放弃接单
- ✅ 余额/提现：申请 → 财务管理员审核 → 到账/拒绝
- ✅ 平台抽佣（通过 `PLATFORM_COMMISSION_RATE` 环境变量配置）
- ✅ 管理后台：订单/用户/提现/收益/反馈/评价 全部 CRUD
- ✅ 三级管理员：超管/普通管理员/财务
- ✅ Redis 可选会话持久化
- ✅ 健康检查 `/api/health`
- ✅ Haversine 真实距离计算
- ✅ 完备的部署文档 `DEPLOYMENT.md`
