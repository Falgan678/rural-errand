# 高德地图API配置指南

## 简介

本项目使用高德地图JavaScript API来实现地图功能，包括：
- 显示待接订单的地理位置（蓝色标记）
- 订单路线规划（取件点→送达点）
- 预估配送时间和距离
- 地图选点功能（发布订单时选择地址）

## 申请步骤

### 1. 注册高德开放平台账号

1. 访问高德开放平台：https://lbs.amap.com/
2. 点击右上角"注册"按钮
3. 填写注册信息（手机号、邮箱等）
4. 完成邮箱验证和手机验证

### 2. 实名认证（可选但推荐）

1. 登录后进入控制台
2. 点击右上角头像 → "账号设置"
3. 选择"实名认证"
4. 根据提示完成个人或企业认证
   - 个人认证：需要身份证信息
   - 企业认证：需要营业执照等信息

**注意**：实名认证后可以获得更高的配额和更多功能。

### 3. 创建应用

1. 登录控制台后，点击"应用管理" → "我的应用"
2. 点击"创建新应用"按钮
3. 填写应用信息：
   - **应用名称**：农村跑腿（或您自定义的名称）
   - **应用类型**：Web端
   - **应用简介**：农村跑腿服务平台（可选）
4. 点击"提交"创建应用

### 4. 添加Key

1. 在"我的应用"列表中找到刚创建的应用
2. 点击应用名称进入详情页
3. 点击"添加Key"按钮
4. 填写Key信息（**重要**）：

   **表单填写说明：**
   
   - **Key名称**：`农村跑腿` 或 `农村跑腿Web端`（自定义名称）
   
   - **服务平台**：⭐ **必须选择 `Web端(JS API)`**
     - ❌ 不要选择 Android平台
     - ❌ 不要选择 iOS平台
     - ✅ 选择 Web端(JS API)
   
   - **可使用服务**：选择Web端后会自动显示可用服务，无需额外操作
   
   - **发布版安全码SHA1**：**留空**（仅Android/iOS需要）
   
   - **调试版安全码SHA1**：**留空**（仅Android/iOS需要）
   
   - **PackageName**：**留空**（仅Android/iOS需要）
   
   - **协议勾选**：✅ 勾选"阅读并同意高德地图开放平台服务协议和隐私政策"

5. 点击"提交"创建Key
6. 创建成功后，会显示一个Key值，类似：
   ```
   a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   ```
7. **重要**：请妥善保管这个Key，后续配置需要使用

**常见错误：**
- ❌ 错误：选择了Android平台，导致需要填写SHA1和PackageName
- ✅ 正确：选择Web端(JS API)，SHA1和PackageName字段会隐藏或不需要填写

### 5. 配置安全密钥（推荐）

为了保护您的Key不被盗用，建议配置安全密钥：

1. 在Key详情页，找到"安全密钥"设置
2. 点击"设置"按钮
3. 输入一个安全密钥（建议使用随机字符串）
4. 保存后，记录这个安全密钥

### 6. 配置域名白名单

1. 在Key详情页，找到"白名单"设置
2. 点击"设置"按钮
3. 添加允许使用该Key的域名：
   - 开发环境：`localhost`、`127.0.0.1`
   - 预览环境：`*.preview.with.woa.com`
   - 生产环境：您的实际域名
4. 多个域名用英文逗号分隔，例如：
   ```
   localhost,*.preview.with.woa.com,yourdomain.com
   ```
5. 保存设置

## 配置到项目

### 方法1：直接修改HTML文件（推荐用于开发测试）

1. 打开 `/static/index.html` 文件
2. 找到高德地图API引入的script标签（大约在第10行）：
   ```html
   <script src="https://webapi.amap.com/maps?v=2.0&key=YOUR_AMAP_KEY&plugin=AMap.MarkerClusterer,AMap.Driving"></script>
   ```
3. 将 `YOUR_AMAP_KEY` 替换为您申请的Key：
   ```html
   <script src="https://webapi.amap.com/maps?v=2.0&key=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6&plugin=AMap.MarkerClusterer,AMap.Driving"></script>
   ```
4. 保存文件

### 方法2：使用环境变量（推荐用于生产环境）

1. 在项目根目录创建或编辑 `.env` 文件
2. 添加以下配置：
   ```bash
   AMAP_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
   AMAP_SECRET=your_security_key_here
   ```
3. 修改后端代码，在渲染HTML时注入Key
4. 修改 `main.py`，添加环境变量读取：
   ```python
   import os
   from fastapi.templating import Jinja2Templates
   
   templates = Jinja2Templates(directory="static")
   AMAP_KEY = os.getenv("AMAP_KEY", "YOUR_AMAP_KEY")
   
   @app.get("/")
   async def root(request: Request):
       return templates.TemplateResponse("index.html", {
           "request": request,
           "amap_key": AMAP_KEY
       })
   ```
5. 修改 `index.html`，使用模板变量：
   ```html
   <script src="https://webapi.amap.com/maps?v=2.0&key={{ amap_key }}&plugin=AMap.MarkerClusterer,AMap.Driving"></script>
   ```

## 功能说明

### 1. 订单地图标记

- **蓝色圆形图标**：代表一个待接订单
- **数字聚合**：当订单密集时，会自动聚合显示数量
- **点击标记**：显示订单详细信息

### 2. 路线规划

- 点击订单信息窗口中的"🚗 查看配送路线"按钮
- 地图会自动规划从取件点到送达点的最优路线
- 显示预估配送距离和时间
- 绿色标记：取件点
- 红色标记：送达点
- 蓝色线条：配送路线

### 3. 配送时间预估

- 基于高德地图的实时路况数据
- 考虑道路拥堵情况
- 显示预计用时（分钟）

### 4. 地图选点（发布订单时）

- 在发布订单页面，点击地址输入框旁的"📍"按钮
- 在地图上点击选择位置
- 自动获取该位置的详细地址
- 自动填充到表单中

## 配额说明

### 免费配额

高德地图为个人开发者提供免费配额：

- **日调用量**：30万次/天
- **并发量**：300次/秒
- **服务**：基础地图、路线规划、地理编码等

对于中小型应用，免费配额通常足够使用。

### 付费套餐

如果免费配额不够，可以购买付费套餐：

- **标准版**：100万次/天，约300元/月
- **专业版**：500万次/天，约1000元/月
- **企业版**：定制化服务，价格面议

购买地址：https://lbs.amap.com/pricing

## 常见问题

### Q1: Key无效或加载失败

**可能原因：**
- Key输入错误
- 域名不在白名单中
- Key已过期或被禁用

**解决方法：**
1. 检查Key是否正确复制
2. 确认当前域名在白名单中
3. 登录控制台检查Key状态

### Q2: 地图显示空白

**可能原因：**
- 网络连接问题
- API加载失败
- 浏览器控制台有错误

**解决方法：**
1. 检查网络连接
2. 打开浏览器控制台（F12）查看错误信息
3. 确认API URL正确

### Q3: 路线规划失败

**可能原因：**
- 起点或终点坐标无效
- 两点距离过远
- 没有可用路线

**解决方法：**
1. 检查订单的经纬度数据是否正确
2. 确认起终点在合理范围内
3. 查看控制台错误信息

### Q4: 超出配额限制

**可能原因：**
- 日调用量超过限制
- 并发请求过多

**解决方法：**
1. 优化代码，减少不必要的API调用
2. 添加缓存机制
3. 升级到付费套餐

### Q5: 地图加载慢

**可能原因：**
- 网络速度慢
- 加载的数据量大
- 服务器响应慢

**解决方法：**
1. 使用CDN加速
2. 启用地图瓦片缓存
3. 优化数据查询

## 安全建议

1. **不要将Key提交到公开代码仓库**
   - 使用 `.gitignore` 忽略 `.env` 文件
   - 使用环境变量管理敏感信息

2. **配置域名白名单**
   - 限制Key只能在指定域名使用
   - 定期检查和更新白名单

3. **启用安全密钥**
   - 为Key配置安全密钥
   - 在请求时携带安全密钥验证

4. **监控使用情况**
   - 定期查看控制台的使用统计
   - 设置异常告警
   - 及时发现异常调用

5. **定期更换Key**
   - 建议每3-6个月更换一次Key
   - 发现泄露立即更换

## 相关链接

- [高德开放平台](https://lbs.amap.com/)
- [JavaScript API文档](https://lbs.amap.com/api/javascript-api/summary)
- [路线规划API](https://lbs.amap.com/api/javascript-api/reference/route-search)
- [地理编码API](https://lbs.amap.com/api/javascript-api/reference/lnglat-to-address)
- [示例中心](https://lbs.amap.com/demo/javascript-api/example/map/map-show)
- [常见问题](https://lbs.amap.com/faq/js-api/map-js-api)

## 技术支持

如有问题，可以通过以下方式获取帮助：

1. **官方文档**：https://lbs.amap.com/api/javascript-api/guide/abc/prepare
2. **开发者社区**：https://lbs.amap.com/dev/
3. **工单系统**：登录控制台提交工单
4. **技术支持QQ群**：见官网

---

**更新时间**：2026-02-13
**版本**：v1.0
