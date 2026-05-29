# 🚀 立即部署指南（您的服务器：119.91.112.109）

> 适用：腾讯云轻量服务器 CentOS 2核2G，目标 30 分钟内部署完成、用 IP 直接访问。
> 备案通过后再切换到正式域名 + HTTPS（参考 `DEPLOYMENT.md`）。

---

## 第一步：在腾讯云控制台开放防火墙端口 ⚠️

**这一步如果不做，您的浏览器永远访问不了服务器！**

1. 打开 https://console.cloud.tencent.com/lighthouse/instance
2. 点击您的实例 **CentOS-RFGS** 进入详情
3. 切换到顶部「**防火墙**」标签
4. 点「**添加规则**」按下面表格逐项添加：

| 应用类型 | 协议 | 端口 | 来源 | 备注 |
|---------|------|------|------|------|
| HTTP | TCP | 80 | 0.0.0.0/0 | Nginx |
| HTTPS | TCP | 443 | 0.0.0.0/0 | 备案后启用 |

> SSH (22) 默认已开，无需操作。

---

## 第二步：登录服务器

### 方法 A（推荐 / 最简单）：网页终端

1. 在轻量服务器列表，点您实例右上角「**登录**」按钮
2. 选择「**Workbench**」或「**OrcaTerm**」 → 自动打开网页终端
3. 自动以 root 登录，无需输密码

### 方法 B：本地 SSH（如果您熟悉）

```bash
ssh root@119.91.112.109
# 如果没有密码，请先在控制台「重置密码」
```

---

## 第三步：把项目代码上传到服务器

在**您本地 Windows PowerShell** 中执行（**不是服务器上**）：

```powershell
# 切换到项目目录
cd C:\Users\v_falgan\Desktop\农村跑腿小程序

# 用 scp 上传到服务器（系统会提示输 root 密码）
# 注意：不上传 dist、__pycache__、.git 等冗余目录
scp -r `
  main.py mapModule.js orderData.js orderRenderer.js `
  cloudbaserc.json cloudrun-entrypoint.sh cloudrun-seed.sql `
  Dockerfile requirements.txt deploy-to-server.sh `
  .env.example DEPLOYMENT.md V2_ROADMAP.md README-DEPLOY-NOW.md `
  static `
  root@119.91.112.109:/root/rural-errand/
```

> 如果您 Windows 没有 scp 命令，可以：
> - 安装 Git for Windows（自带 scp）：https://gitforwindows.org/
> - 或使用 WinSCP 图形化工具：https://winscp.net/
> - 或在腾讯云网页终端的「文件」功能上传

---

## 第四步：在服务器执行一键部署

在**服务器终端**（网页终端或 SSH）中执行：

```bash
cd /root/rural-errand
chmod +x deploy-to-server.sh

# 可选：用您自己的强密码（不设的话脚本会自动生成）
export ADMIN_PASSWORD="您的强密码123"
export DB_PASSWORD="您的数据库密码456"
export MYSQL_ROOT_PASSWORD="您的MySQL_root密码789"

./deploy-to-server.sh
```

脚本会自动完成：
- ✅ 安装 Docker
- ✅ 启动 MySQL 8.0 容器（数据持久化到 `/var/lib/rural-mysql/`）
- ✅ 导入数据库 schema
- ✅ 构建后端 API 镜像
- ✅ 启动 API 容器（监听 127.0.0.1:8000）
- ✅ 安装并配置 Nginx 反代
- ✅ 生成管理员账号

**预计耗时：5~10 分钟**（首次构建 Docker 镜像稍慢）

---

## 第五步：验证部署成功

部署完成后，**在您本地浏览器**打开下面链接：

| 链接 | 应该看到 |
|------|---------|
| http://119.91.112.109/api/health | JSON：`{"code":0,"data":{"db":true,"disable_sms":true,...}}` |
| http://119.91.112.109/ | 自动跳转到登录页 |
| http://119.91.112.109/static/login.html | 管理端登录页 |
| http://119.91.112.109/static/index.html | 客户端首页 |

如果都正常打开，**部署成功** ✅

---

## 第六步：登录管理端

1. 打开 http://119.91.112.109/static/login.html
2. 用 `admin` + 您设置的密码登录
3. **第一件事：进「设置 → 修改密码」改密码**（虽然部署时已经强密码，但这是好习惯）

---

## 第七步：测试客户端

> 因为还没备案，**小程序无法上传到微信平台**，但您可以先用浏览器访问 H5 版本测试：

- 打开 http://119.91.112.109/static/index.html
- 点「注册」→ 创建一个测试用户
- 登录后发布订单、模拟接单、完成订单
- 在管理端查看是否同步显示

如果需要在微信里展示，可以暂时用 H5 版本，把链接发给好友访问。

---

## 第八步（之后做）：备案 + 正式上线

### 备案准备
1. 登录腾讯云备案 https://console.cloud.tencent.com/beian
2. 选「**个人主体备案**」
3. 网站名称建议：「**XX村互助平台**」（避免敏感词）
4. 提交后等待 7~15 天

### 备案通过后做的事
1. **DNS 解析**：在域名管理处把您的域名 A 记录指向 `119.91.112.109`
2. **申请免费 SSL 证书**：https://console.cloud.tencent.com/ssl
3. **修改 Nginx 配置**：加 HTTPS server 段（参考 `DEPLOYMENT.md` 中的 nginx-ssl 部分）
4. **修改 ALLOWED_ORIGINS** 环境变量为您的正式域名
5. **小程序后台**：「开发 → 服务器域名」加白您的域名
6. **客户端打包**：`cd miniprogram && npm run build:mp-weixin`，用微信开发者工具上传

---

## 常见问题

### Q1：部署完后浏览器打不开？
- 检查腾讯云防火墙 80 端口是否开放
- 在服务器执行 `curl http://127.0.0.1/api/health`，如果返回 200 说明本地服务正常，问题在防火墙
- 在服务器执行 `nginx -t && systemctl status nginx`

### Q2：API 报数据库连接失败？
```bash
# 查看 MySQL 容器日志
docker logs rural-mysql

# 重启 API
docker restart rural-api
```

### Q3：忘记管理员密码？
```bash
# 进入 API 容器
docker exec -it rural-api bash

# 用 Python 重置（演示）
python3 -c "
import bcrypt, pymysql, os
conn = pymysql.connect(host='mysql', user='rural_user', password=os.getenv('DB_PASSWORD'), database='rural_errand')
new_pwd = '新密码123'
hashed = bcrypt.hashpw(new_pwd.encode(), bcrypt.gensalt()).decode()
with conn.cursor() as c:
    c.execute('UPDATE admins SET password=%s WHERE username=%s', (hashed, 'admin'))
    conn.commit()
print('已重置')
"
```

### Q4：要更新代码怎么办？
```bash
# 1. 把新代码上传到 /root/rural-errand/（覆盖）
# 2. 在服务器执行
cd /root/rural-errand
docker build -t rural-errand-api:latest .
docker restart rural-api

# 验证
docker logs --tail 20 rural-api
```

### Q5：怎么备份数据？
```bash
# 备份数据库
docker exec rural-mysql mysqldump -u root -p"<MYSQL_ROOT_PASSWORD>" rural_errand > /root/backup-$(date +%Y%m%d).sql

# 备份头像目录
tar czf /root/uploads-$(date +%Y%m%d).tar.gz /var/lib/rural-uploads/

# 建议每周一次，把这两个文件下载到本地保存
```

---

## 资源消耗预估

| 服务 | 内存 | CPU |
|------|------|-----|
| MySQL 8.0 | ~400 MB | 低 |
| FastAPI | ~150 MB | 低 |
| Nginx | ~20 MB | 极低 |
| **总计** | **~600 MB** | 很轻 |

您的 2GB 内存还有 1.4GB 富余，足够支撑日均 1 万级订单。

---

## 一年成本汇总

| 项目 | 成本 |
|------|------|
| 服务器（已买，到 2027-05-12） | **¥0** |
| 数据库（自建在同一台） | **¥0** |
| 短信（已禁用） | **¥0** |
| 域名（已有） | **¥0** |
| SSL 证书（腾讯云免费） | **¥0** |
| 备案（个人主体） | **¥0** |
| **总计** | **¥0** |

🎉 **零成本运行一年。**
