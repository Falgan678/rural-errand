# ============================================================
#  农村跑腿 - Windows 端一键上传脚本
# ============================================================
#  作用：把项目代码打包并上传到您的服务器
#  用法：右键此文件 → "用 PowerShell 运行"
#       或在项目目录打开 PowerShell 执行：.\one-click-upload.ps1
# ============================================================

$ErrorActionPreference = "Stop"

# ===== 配置 =====
$SERVER_IP = "119.91.112.109"
$SERVER_USER = "root"
$REMOTE_DIR = "/www/wwwroot/rural-errand"
$PROJECT_DIR = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  农村跑腿 - 一键上传到服务器" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "服务器：$SERVER_USER@$SERVER_IP"
Write-Host "目标目录：$REMOTE_DIR"
Write-Host "本地目录：$PROJECT_DIR"
Write-Host ""

# ===== 检查 scp 是否可用 =====
$scpCmd = Get-Command scp -ErrorAction SilentlyContinue
if (-not $scpCmd) {
    Write-Host "[错误] 未找到 scp 命令" -ForegroundColor Red
    Write-Host ""
    Write-Host "请安装以下任一工具：" -ForegroundColor Yellow
    Write-Host "  1. Git for Windows: https://gitforwindows.org/" -ForegroundColor Yellow
    Write-Host "  2. Windows 10/11 自带 OpenSSH（设置 → 应用 → 可选功能 → 添加 OpenSSH 客户端）" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按任意键退出"
    exit 1
}

# ===== 询问确认 =====
Write-Host "本次将上传以下内容到服务器：" -ForegroundColor Cyan
Write-Host "  - main.py（后端代码）"
Write-Host "  - requirements.txt"
Write-Host "  - cloudbaserc.json"
Write-Host "  - cloudrun-seed.sql（数据库初始化）"
Write-Host "  - cloudrun-entrypoint.sh"
Write-Host "  - Dockerfile（备用）"
Write-Host "  - static/（管理端 + 客户端 H5 静态文件）"
Write-Host "  - mapModule.js / orderData.js / orderRenderer.js"
Write-Host "  - auto-deploy.sh（自动部署脚本）"
Write-Host "  - DEPLOYMENT.md / V2_ROADMAP.md / .env.example"
Write-Host ""

$confirm = Read-Host "确认开始上传？(Y/N)"
if ($confirm -notmatch '^[Yy]') {
    Write-Host "已取消"
    exit 0
}

# ===== 切换到项目目录 =====
Set-Location $PROJECT_DIR

# ===== 第一步：在服务器创建目标目录 =====
Write-Host ""
Write-Host "[1/3] 在服务器创建目录..." -ForegroundColor Cyan
ssh "${SERVER_USER}@${SERVER_IP}" "mkdir -p $REMOTE_DIR && chmod 755 $REMOTE_DIR"
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] SSH 连接失败" -ForegroundColor Red
    Write-Host "请确认：" -ForegroundColor Yellow
    Write-Host "  1. 服务器 IP 是否正确：$SERVER_IP"
    Write-Host "  2. 您是否能用 ssh root@$SERVER_IP 连接（首次会要求输 root 密码）"
    Write-Host "  3. 在腾讯云控制台「重置密码」可以设置 root 密码"
    Read-Host "按任意键退出"
    exit 1
}

# ===== 第二步：上传文件 =====
Write-Host ""
Write-Host "[2/3] 上传项目文件..." -ForegroundColor Cyan

$filesToUpload = @(
    "main.py",
    "requirements.txt",
    "cloudbaserc.json",
    "cloudrun-seed.sql",
    "cloudrun-entrypoint.sh",
    "Dockerfile",
    "mapModule.js",
    "orderData.js",
    "orderRenderer.js",
    "auto-deploy.sh",
    "DEPLOYMENT.md",
    "V2_ROADMAP.md",
    ".env.example"
)

# 上传单个文件
foreach ($file in $filesToUpload) {
    $localPath = Join-Path $PROJECT_DIR $file
    if (Test-Path $localPath) {
        Write-Host "  上传: $file"
        scp $localPath "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/" 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [警告] 上传 $file 失败，继续..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "  跳过（不存在）: $file" -ForegroundColor DarkGray
    }
}

# 上传 static 目录
$staticDir = Join-Path $PROJECT_DIR "static"
if (Test-Path $staticDir) {
    Write-Host "  上传目录: static/"
    scp -r $staticDir "${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/" 2>&1 | Out-Null
}

Write-Host "[2/3] 上传完成 ✓" -ForegroundColor Green

# ===== 第三步：在服务器执行部署脚本 =====
Write-Host ""
Write-Host "[3/3] 在服务器执行部署..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  即将在服务器执行 auto-deploy.sh，需要约 5~10 分钟" -ForegroundColor Yellow
Write-Host "   过程中可能要求输入 MySQL root 密码（如果检测不到）" -ForegroundColor Yellow
Write-Host ""

$runDeploy = Read-Host "是否立即在服务器执行部署？(Y/N)"
if ($runDeploy -match '^[Yy]') {
    ssh "${SERVER_USER}@${SERVER_IP}" "cd $REMOTE_DIR && chmod +x auto-deploy.sh && bash auto-deploy.sh"
} else {
    Write-Host ""
    Write-Host "已跳过自动部署。您可以稍后手动执行：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  ssh root@$SERVER_IP" -ForegroundColor White
    Write-Host "  cd $REMOTE_DIR" -ForegroundColor White
    Write-Host "  bash auto-deploy.sh" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  脚本执行完毕" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Read-Host "按任意键退出"
