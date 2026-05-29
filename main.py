from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form, Header, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
import pymysql
import os
from datetime import datetime
import socket


def load_local_env_file():
    env_path = ".env"
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            os.environ.setdefault(key, value)


load_local_env_file()
import bcrypt
import hashlib
import time
import secrets

app = FastAPI(title="农村跑腿API")

# CORS 配置：生产环境建议通过 ALLOWED_ORIGINS 环境变量传入逗号分隔的可信源
# 例如：ALLOWED_ORIGINS=https://admin.example.com,https://m.example.com
_raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
if _raw_origins:
    _allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
    _allow_credentials = True
else:
    # 未配置时退回旧行为，但 allow_credentials 必须关掉，否则浏览器会拒绝
    _allow_origins = ["*"]
    _allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 数据库配置（生产环境通过环境变量注入；本地开发可放在 .env 文件中）
DB_CONFIG = {
    "host": os.getenv("DB_HOST", ""),
    "port": int(os.getenv("DB_PORT", "3306") or "3306"),
    "user": os.getenv("DB_USER", ""),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", ""),
    "charset": "utf8mb4"
}

APP_ENV = os.getenv("APP_ENV", "production").strip().lower()
DEBUG_TOOLS_ENABLED = os.getenv("ENABLE_DEBUG_TOOLS", "").strip().lower() in {"1", "true", "yes", "on"}
PROJECT_DOWNLOAD_ENABLED = os.getenv("ENABLE_PROJECT_DOWNLOAD", "").strip().lower() in {"1", "true", "yes", "on"}
USER_SESSION_EXPIRE_SECONDS = 7 * 24 * 3600
ADMIN_SESSION_EXPIRE_SECONDS = 12 * 3600

# 平台抽佣比例：0~1 之间，默认 0（不抽佣）。可通过环境变量 PLATFORM_COMMISSION_RATE 配置，例如 0.05 = 5%
try:
    PLATFORM_COMMISSION_RATE = float(os.getenv("PLATFORM_COMMISSION_RATE", "0") or 0)
except ValueError:
    PLATFORM_COMMISSION_RATE = 0.0
if PLATFORM_COMMISSION_RATE < 0 or PLATFORM_COMMISSION_RATE >= 1:
    print(f"[警告] PLATFORM_COMMISSION_RATE 配置非法（{PLATFORM_COMMISSION_RATE}），已重置为 0")
    PLATFORM_COMMISSION_RATE = 0.0

# 短信开关：DISABLE_SMS=true 时跳过短信验证（适用于不接入短信服务的部署场景）
# 关闭后：注册不要求验证码、登录只允许密码方式、修改手机号不要求验证码、send-sms 接口直接返回成功提示
DISABLE_SMS = os.getenv("DISABLE_SMS", "").strip().lower() in {"1", "true", "yes", "on"}
if DISABLE_SMS:
    print("[配置] DISABLE_SMS=true，短信验证已禁用，注册/登录走纯密码模式")

# 内存中的token存储（生产环境应使用Redis）
# 结构: {token: {user_id, phone, expire_time}}
active_tokens = {}

# 管理员token存储（生产环境应使用Redis）
# 结构: {token: {admin_id, username, role, expire_time}}
admin_active_tokens = {}

# ---- 可选 Redis 持久化：通过环境变量 REDIS_URL=redis://... 启用 ----
# 启用后 active_tokens / admin_active_tokens / sms_codes 的 set/get/del 操作会同步写入 Redis，
# 容器重启或扩容时用户和管理员会话不会丢失。
REDIS_URL = os.getenv("REDIS_URL", "").strip()
redis_client = None
if REDIS_URL:
    try:
        import redis as _redis  # type: ignore
        redis_client = _redis.Redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=2)
        redis_client.ping()
        print(f"[Redis] 已连接 {REDIS_URL}，会话/验证码将持久化")
    except Exception as e:
        print(f"[Redis] 连接失败，降级使用进程内存: {e}")
        redis_client = None


def _redis_set_json(key: str, value: dict, ttl: int):
    if not redis_client:
        return
    try:
        import json as _json
        redis_client.setex(key, ttl, _json.dumps(value))
    except Exception as e:
        print(f"[Redis] set 失败 {key}: {e}")


def _redis_get_json(key: str) -> Optional[dict]:
    if not redis_client:
        return None
    try:
        import json as _json
        raw = redis_client.get(key)
        return _json.loads(raw) if raw else None
    except Exception as e:
        print(f"[Redis] get 失败 {key}: {e}")
        return None


def _redis_del(key: str):
    if not redis_client:
        return
    try:
        redis_client.delete(key)
    except Exception:
        pass

# 演示模式开关（环境变量 DEMO_MODE=1 时启用，本地预览专用）
DEMO_MODE = os.getenv("DEMO_MODE", "").strip().lower() in {"1", "true", "yes", "on"}

# 演示模式内置数据
DEMO_ADMIN = {
    "id": 999,
    "username": "admin",
    "password": "admin123",
    "name": "演示管理员",
    "role": "super",
    "created_at": "2026-01-01 00:00:00"
}
DEMO_USERS = [
    {"id": 1, "username": "张三", "phone": "13800000001", "location": "东村", "balance": 88.50,
     "completed_orders": 12, "total_earnings": 240.00, "rating": 4.8, "status": "active",
     "created_at": "2026-04-01 10:00:00", "avatar": "👤"},
    {"id": 2, "username": "李四", "phone": "13800000002", "location": "西村", "balance": 156.30,
     "completed_orders": 25, "total_earnings": 510.00, "rating": 4.9, "status": "active",
     "created_at": "2026-03-15 14:30:00", "avatar": "👤"},
    {"id": 3, "username": "王五", "phone": "13800000003", "location": "南村", "balance": 0.00,
     "completed_orders": 5, "total_earnings": 95.00, "rating": 4.5, "status": "banned",
     "created_at": "2026-02-20 09:15:00", "avatar": "👤"},
]
DEMO_ORDERS = [
    {"id": 1001, "title": "代买生活用品", "publisher_id": 1, "publisher_name": "张三",
     "runner_id": 2, "runner_name": "李四", "fee": 15.00, "is_urgent": 0,
     "status": "completed", "pickup_address": "镇上超市", "delivery_address": "东村3组",
     "phone": "13800000001", "remark": "买盐和酱油", "created_at": "2026-05-08 14:00:00"},
    {"id": 1002, "title": "代取快递", "publisher_id": 1, "publisher_name": "张三",
     "runner_id": None, "runner_name": None, "fee": 8.00, "is_urgent": 1,
     "status": "pending", "pickup_address": "村委会代收点", "delivery_address": "东村5组",
     "phone": "13800000001", "remark": "圆通快递两件", "created_at": "2026-05-09 10:30:00"},
    {"id": 1003, "title": "送午餐到田里", "publisher_id": 3, "publisher_name": "王五",
     "runner_id": 2, "runner_name": "李四", "fee": 12.00, "is_urgent": 0,
     "status": "ongoing", "pickup_address": "南村家中", "delivery_address": "南村稻田",
     "phone": "13800000003", "remark": "带瓶水", "created_at": "2026-05-09 11:00:00"},
]


# 数据库连接
def get_db_connection():
    try:
        return pymysql.connect(
            **DB_CONFIG,
            connect_timeout=5,
            read_timeout=10,
            write_timeout=10
        )
    except pymysql.MySQLError as exc:
        print(f"[数据库连接失败] {exc}")
        raise HTTPException(status_code=503, detail="数据库连接失败，当前暂时无法完成注册或登录")


def get_bearer_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    return authorization.replace("Bearer ", "").strip() or None


# 生成安全token
def generate_token(user_id: int, phone: str) -> str:
    token = secrets.token_hex(32)
    expire_time = time.time() + USER_SESSION_EXPIRE_SECONDS
    payload = {
        "user_id": user_id,
        "phone": phone,
        "expire_time": expire_time
    }
    active_tokens[token] = payload
    _redis_set_json(f"sess:user:{token}", payload, USER_SESSION_EXPIRE_SECONDS)
    return token


def generate_admin_token(admin_id: int, username: str, role: str) -> str:
    token = secrets.token_hex(32)
    expire_time = time.time() + ADMIN_SESSION_EXPIRE_SECONDS
    payload = {
        "admin_id": admin_id,
        "username": username,
        "role": role,
        "expire_time": expire_time
    }
    admin_active_tokens[token] = payload
    _redis_set_json(f"sess:admin:{token}", payload, ADMIN_SESSION_EXPIRE_SECONDS)
    return token


def load_user_auth_from_header(authorization: Optional[str]) -> Optional[dict]:
    token = get_bearer_token(authorization)
    if not token:
        return None
    token_data = active_tokens.get(token)
    if not token_data:
        # 进程内存未命中：尝试从 Redis 恢复（容器重启常见场景）
        token_data = _redis_get_json(f"sess:user:{token}")
        if token_data:
            active_tokens[token] = token_data
    if not token_data:
        return None

    if time.time() > token_data["expire_time"]:
        active_tokens.pop(token, None)
        _redis_del(f"sess:user:{token}")
        return None

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, name, phone, status FROM users WHERE id = %s", (token_data["user_id"],))
            user = cursor.fetchone()
    finally:
        conn.close()

    if not user:
        active_tokens.pop(token, None)
        _redis_del(f"sess:user:{token}")
        return None

    if (user.get("status") or "active") == "banned":
        active_tokens.pop(token, None)
        _redis_del(f"sess:user:{token}")
        raise HTTPException(status_code=403, detail="账号已被封禁，请联系管理员")

    return {
        "user_id": user["id"],
        "phone": user["phone"],
        "username": user["name"],
        "status": user.get("status") or "active",
        "expire_time": token_data["expire_time"]
    }



def load_admin_auth_from_header(authorization: Optional[str]) -> Optional[dict]:
    token = get_bearer_token(authorization)
    if not token:
        return None
    token_data = admin_active_tokens.get(token)
    if not token_data:
        token_data = _redis_get_json(f"sess:admin:{token}")
        if token_data:
            admin_active_tokens[token] = token_data
    if not token_data:
        return None

    if time.time() > token_data["expire_time"]:
        admin_active_tokens.pop(token, None)
        _redis_del(f"sess:admin:{token}")
        return None

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, username, name, role FROM admins WHERE id = %s", (token_data["admin_id"],))
            admin = cursor.fetchone()
    finally:
        conn.close()

    if not admin:
        admin_active_tokens.pop(token, None)
        _redis_del(f"sess:admin:{token}")
        return None

    return {
        "admin_id": admin["id"],
        "username": admin["username"],
        "name": admin.get("name") or admin["username"],
        "role": admin.get("role") or "admin",
        "expire_time": token_data["expire_time"]
    }


# 需要认证的依赖
def require_auth(authorization: Optional[str] = Header(None)) -> dict:
    token_data = load_user_auth_from_header(authorization)
    if not token_data:
        raise HTTPException(status_code=401, detail="未登录或登录已过期")
    return token_data


def require_admin_auth(authorization: Optional[str] = Header(None)) -> dict:
    token_data = load_admin_auth_from_header(authorization)
    if not token_data:
        raise HTTPException(status_code=401, detail="管理员未登录或登录已过期")
    return token_data


def require_super_admin(admin_auth: dict = Depends(require_admin_auth)) -> dict:
    if admin_auth.get("role") != "super":
        raise HTTPException(status_code=403, detail="仅超级管理员可执行此操作")
    return admin_auth


def require_finance_admin(admin_auth: dict = Depends(require_admin_auth)) -> dict:
    if admin_auth.get("role") not in {"super", "finance"}:
        raise HTTPException(status_code=403, detail="仅财务管理员或超级管理员可执行此操作")
    return admin_auth


def require_actor_auth(authorization: Optional[str] = Header(None)) -> dict:
    admin_auth = load_admin_auth_from_header(authorization)
    if admin_auth:
        return {**admin_auth, "actor_type": "admin"}

    user_auth = load_user_auth_from_header(authorization)
    if user_auth:
        return {**user_auth, "actor_type": "user"}

    raise HTTPException(status_code=401, detail="未登录或登录已过期")


def actor_is_admin(actor: Optional[dict]) -> bool:
    return bool(actor and actor.get("actor_type") == "admin")


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone or len(phone) < 7:
        return phone
    return f"{phone[:3]}****{phone[-4:]}"


def can_view_full_order(actor: dict, order: dict) -> bool:
    if actor_is_admin(actor):
        return True
    user_id = actor.get("user_id")
    return user_id in {order.get("user_id"), order.get("runner_id")}


def sanitize_order_for_actor(order: dict, actor: dict) -> dict:
    sanitized = dict(order)
    if can_view_full_order(actor, sanitized):
        return sanitized

    if "contact_phone" in sanitized:
        sanitized["contact_phone"] = mask_phone(sanitized.get("contact_phone"))
    if "user_phone" in sanitized:
        sanitized["user_phone"] = mask_phone(sanitized.get("user_phone"))
    if "runner_phone" in sanitized:
        sanitized["runner_phone"] = None
    if sanitized.get("runner") and isinstance(sanitized["runner"], dict):
        sanitized["runner"]["phone"] = None

    return sanitized


# 用户头像工具函数
def normalize_user_avatar(user: dict, cursor=None) -> bool:
    if not isinstance(user, dict):
        return False
    avatar = user.get("avatar")
    if not avatar or not isinstance(avatar, str):
        return False
    if avatar.startswith("/static/uploads/avatars/"):
        file_path = avatar.lstrip("/")
        if not os.path.exists(file_path):
            user["avatar"] = None
            if cursor is not None and "id" in user:
                cursor.execute("UPDATE users SET avatar = NULL WHERE id = %s", (user["id"],))
                return True
    return False

# Pydantic模型
class User(BaseModel):
    name: str
    phone: str
    location: Optional[str] = None

class Order(BaseModel):
    title: str
    pickup_address: str
    delivery_address: str
    delivery_time: str
    goods_name: str
    fee: float
    is_urgent: bool = False
    remark: Optional[str] = None
    payment_method: str = "wechat"
    contact_phone: str
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None

class OrderCoordinateUpdate(BaseModel):
    pickup_lat: float
    pickup_lng: float
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None

class AdminLogin(BaseModel):
    username: str
    password: str

class WithdrawRequest(BaseModel):
    amount: float

class UserRegister(BaseModel):
    username: str
    phone: str
    password: str
    sms_code: Optional[str] = None  # 关闭短信时可不传

class UserLogin(BaseModel):
    username: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    sms_code: Optional[str] = None
    type: str  # 'password' 或 'sms'

class SendSmsRequest(BaseModel):
    phone: str
    type: str  # 'login' 或 'register' 或 'change_phone'

class FeedbackCreate(BaseModel):
    type: str = "suggestion"
    content: str
    contact: Optional[str] = None

class ReviewCreate(BaseModel):
    order_id: int
    runner_id: int
    rating: int
    comment: Optional[str] = None

class UpdateProfileRequest(BaseModel):
    name: str
    phone: Optional[str] = None
    sms_code: Optional[str] = None

# 临时存储验证码（生产环境应使用Redis）
sms_codes = {}

# 腾讯云短信配置
TENCENT_SMS_CONFIG = {
    "secret_id": os.getenv("TENCENT_SECRET_ID", ""),
    "secret_key": os.getenv("TENCENT_SECRET_KEY", ""),
    "sms_sdk_app_id": os.getenv("SMS_SDK_APP_ID", ""),
    "sign_name": os.getenv("SMS_SIGN_NAME", "农村跑腿"),
    "template_id": os.getenv("SMS_TEMPLATE_ID", ""),
}

def send_sms_via_tencent(phone: str, code: str) -> bool:
    """通过腾讯云发送短信验证码"""
    try:
        is_dev_mode = (
            not TENCENT_SMS_CONFIG["secret_id"] or
            not TENCENT_SMS_CONFIG["secret_key"] or
            TENCENT_SMS_CONFIG["secret_id"] == "your_secret_id_here" or
            TENCENT_SMS_CONFIG["secret_key"] == "your_secret_key_here" or
            not TENCENT_SMS_CONFIG["sms_sdk_app_id"] or
            not TENCENT_SMS_CONFIG["template_id"]
        )

        if is_dev_mode:
            print(f"[开发模式] 验证码已发送到 {phone}: {code}")
            return True

        from tencentcloud.common import credential
        from tencentcloud.common.exception.tencent_cloud_sdk_exception import TencentCloudSDKException
        from tencentcloud.sms.v20210111 import sms_client, models

        cred = credential.Credential(TENCENT_SMS_CONFIG["secret_id"], TENCENT_SMS_CONFIG["secret_key"])
        client = sms_client.SmsClient(cred, "ap-guangzhou")
        req = models.SendSmsRequest()
        req.SmsSdkAppId = TENCENT_SMS_CONFIG["sms_sdk_app_id"]
        req.SignName = TENCENT_SMS_CONFIG["sign_name"]
        req.TemplateId = TENCENT_SMS_CONFIG["template_id"]
        req.TemplateParamSet = [code, "5"]
        req.PhoneNumberSet = [f"+86{phone}"]
        resp = client.SendSms(req)

        if resp.SendStatusSet[0].Code == "Ok":
            print(f"[生产模式] 短信发送成功: {phone}")
            return True
        else:
            print(f"[生产模式] 短信发送失败: {resp.SendStatusSet[0].Message}")
            return False

    except ImportError:
        print(f"[开发模式] 腾讯云SDK未安装，使用模拟发送: {phone}: {code}")
        return True
    except Exception as e:
        print(f"[错误] 短信发送异常: {e}")
        is_dev_mode_check = (
            not TENCENT_SMS_CONFIG["secret_id"] or
            TENCENT_SMS_CONFIG["secret_id"] == "your_secret_id_here"
        )
        if is_dev_mode_check:
            print(f"[开发模式] 忽略错误，验证码: {code}")
            return True
        return False

# 根路径重定向
@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/api/health")
async def health_check():
    """健康检查接口，云托管/容器探针使用。

    返回 200 表示数据库可达；db 异常时返回 503，使滚动更新/扩容能正确剔除故障实例。
    """
    db_ok = False
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            db_ok = True
        finally:
            conn.close()
    except Exception as e:
        return {"code": 1, "message": "db unreachable", "detail": str(e)[:200]}, 503
    return {
        "code": 0,
        "data": {
            "db": db_ok,
            "redis": bool(redis_client),
            "demo_mode": DEMO_MODE,
            "disable_sms": DISABLE_SMS,
            "commission_rate": PLATFORM_COMMISSION_RATE,
            "active_user_tokens": len(active_tokens),
            "active_admin_tokens": len(admin_active_tokens),
        }
    }

# ==================== 认证相关API ====================

@app.post("/api/auth/send-sms")
async def send_sms(request: SendSmsRequest):
    """发送短信验证码。

    DISABLE_SMS=true 时直接返回提示，前端会回退到密码登录方式。
    """
    if DISABLE_SMS:
        return {"code": 1, "message": "当前版本暂未开放短信验证，请使用密码方式"}
    phone = request.phone
    sms_type = request.type

    import re
    if not re.match(r'^1[3-9]\d{9}$', phone):
        return {"code": 1, "message": "手机号格式不正确"}

    # 频率限制：同一手机号 60 秒内只能发送 1 次（独立于验证码 10 分钟有效期）
    key = f"{phone}_{sms_type}"
    SMS_RESEND_INTERVAL = 60  # 秒
    SMS_CODE_TTL = 600        # 10 分钟
    if key in sms_codes:
        existing = sms_codes[key]
        sent_at = existing.get('sent_at') or (existing.get('expire_time', 0) - SMS_CODE_TTL)
        elapsed = time.time() - sent_at
        if not existing.get('used') and elapsed < SMS_RESEND_INTERVAL:
            remain = int(SMS_RESEND_INTERVAL - elapsed)
            return {"code": 1, "message": f"请{max(remain, 1)}秒后再试"}

    import random
    code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    success = send_sms_via_tencent(phone, code)

    if not success:
        return {"code": 1, "message": "短信发送失败，请稍后重试"}

    expire_time = time.time() + SMS_CODE_TTL  # 10 分钟后过期
    sms_codes[key] = {
        'code': code,
        'expire_time': expire_time,
        'sent_at': time.time(),
        'used': False
    }

    print(f"[验证码] 手机号: {phone}, 类型: {sms_type}, 验证码: {code}, 过期时间: {datetime.fromtimestamp(expire_time).strftime('%Y-%m-%d %H:%M:%S')}")
    return {"code": 0, "message": "验证码已发送"}

@app.post("/api/auth/register")
async def register(user: UserRegister):
    """用户注册。

    - DISABLE_SMS=true 时不要求 sms_code，但仍要求手机号格式合法且未注册
    - DISABLE_SMS=false 时强制要求短信验证码与发送时的手机号一致
    """
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 用户名长度验证
            if len(user.username) < 2 or len(user.username) > 20:
                return {"code": 1, "message": "用户名长度为2-20个字符"}

            # 手机号格式校验
            import re
            if not re.match(r'^1[3-9]\d{9}$', user.phone or ''):
                return {"code": 1, "message": "手机号格式不正确"}

            # 密码强度验证
            if len(user.password) < 6:
                return {"code": 1, "message": "密码至少6位"}

            # 短信验证码校验（仅在未禁用短信时）
            if not DISABLE_SMS:
                if not user.sms_code:
                    return {"code": 1, "message": "请输入短信验证码"}
                key = f"{user.phone}_register"
                sms_data = sms_codes.get(key)
                if not sms_data:
                    return {"code": 1, "message": "验证码错误或已过期"}
                if sms_data.get('used'):
                    return {"code": 1, "message": "验证码已使用"}
                if time.time() > sms_data.get('expire_time', 0):
                    sms_codes.pop(key, None)
                    return {"code": 1, "message": "验证码已过期"}
                if sms_data.get('code') != user.sms_code:
                    return {"code": 1, "message": "验证码错误"}
                sms_data['used'] = True

            cursor.execute("SELECT id FROM users WHERE name = %s", (user.username,))
            if cursor.fetchone():
                return {"code": 1, "message": "用户名已存在"}

            cursor.execute("SELECT id FROM users WHERE phone = %s", (user.phone,))
            if cursor.fetchone():
                return {"code": 1, "message": "手机号已注册"}

            hashed_password = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())
            cursor.execute(
                "INSERT INTO users (name, phone, password) VALUES (%s, %s, %s)",
                (user.username, user.phone, hashed_password.decode())
            )
            conn.commit()

            return {"code": 0, "message": "注册成功"}
    except Exception as e:
        import traceback
        print(f"注册失败: {str(e)}\n{traceback.format_exc()}")
        return {"code": 1, "message": "注册失败，请重试"}
    finally:
        conn.close()

@app.post("/api/auth/login")
async def login(login_data: UserLogin):
    """用户登录"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            if login_data.type == 'password':
                import re
                is_phone = re.match(r'^1[3-9]\d{9}$', login_data.username or '')

                if is_phone:
                    cursor.execute("SELECT * FROM users WHERE phone = %s", (login_data.username,))
                else:
                    cursor.execute("SELECT * FROM users WHERE name = %s", (login_data.username,))

                user = cursor.fetchone()
                if not user:
                    return {"code": 1, "message": "用户名或密码错误"}

                if not bcrypt.checkpw(login_data.password.encode(), user['password'].encode()):
                    return {"code": 1, "message": "用户名或密码错误"}

                if normalize_user_avatar(user, cursor):
                    conn.commit()

            elif login_data.type == 'sms':
                if DISABLE_SMS:
                    return {"code": 1, "message": "当前版本暂未开放短信登录，请使用密码登录"}
                key = f"{login_data.phone}_login"

                if key not in sms_codes:
                    return {"code": 1, "message": "验证码错误或已过期"}

                sms_data = sms_codes[key]
                if sms_data['used']:
                    return {"code": 1, "message": "验证码已使用"}
                if time.time() > sms_data['expire_time']:
                    del sms_codes[key]
                    return {"code": 1, "message": "验证码已过期"}
                if sms_data['code'] != login_data.sms_code:
                    return {"code": 1, "message": "验证码错误"}

                cursor.execute("SELECT * FROM users WHERE phone = %s", (login_data.phone,))
                user = cursor.fetchone()
                if not user:
                    return {"code": 1, "message": "手机号未注册"}

                if normalize_user_avatar(user, cursor):
                    conn.commit()

                sms_codes[key]['used'] = True

                import threading
                def delete_code():
                    time.sleep(300)
                    if key in sms_codes:
                        del sms_codes[key]
                threading.Thread(target=delete_code, daemon=True).start()
            else:
                return {"code": 1, "message": "登录方式不正确"}

            # 生成安全token
            token = generate_token(user['id'], user['phone'])

            return {"code": 0, "message": "登录成功", "data": {
                "id": user['id'],
                "username": user['name'],
                "phone": user['phone'],
                "location": user.get('location', ''),
                "avatar": user.get('avatar'),
                "rating": float(user.get('rating') or 5.0),
                "good_rate": float(user.get('good_rate') or 100),
                "total_orders": int(user.get('total_orders') or 0),
                "total_earnings": float(user.get('total_earnings') or 0),
                "month_earnings": float(user.get('month_earnings') or 0),
                "pending_earnings": float(user.get('pending_earnings') or 0),
                "token": token
            }}
    except Exception as e:
        import traceback
        print(f"登录失败: {str(e)}\n{traceback.format_exc()}")
        return {"code": 1, "message": "登录失败，请重试"}
    finally:
        conn.close()

@app.post("/api/auth/logout")
async def logout(auth: dict = Depends(require_auth), authorization: Optional[str] = Header(None)):
    """退出登录"""
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token:
            active_tokens.pop(token, None)
            _redis_del(f"sess:user:{token}")
    return {"code": 0, "message": "已退出登录"}

# ==================== 用户相关API ====================

@app.get("/api/users/{phone}")
async def get_user_by_phone(phone: str):
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM users WHERE phone = %s", (phone,))
            user = cursor.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="用户不存在")

            if normalize_user_avatar(user, cursor):
                conn.commit()

            user['total_earnings'] = float(user.get('total_earnings') or 0)
            user['month_earnings'] = float(user.get('month_earnings') or 0)
            user['pending_earnings'] = float(user.get('pending_earnings') or 0)
            user['rating'] = float(user.get('rating') or 5.0)
            user['good_rate'] = float(user.get('good_rate') or 100)
            user['total_orders'] = int(user.get('total_orders') or 0)
            # 不返回密码字段
            user.pop('password', None)

            return {"code": 0, "data": user}
    finally:
        conn.close()

@app.post("/api/users")
async def create_user(user: User):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (name, phone, location) VALUES (%s, %s, %s)",
                (user.name, user.phone, user.location)
            )
            conn.commit()
            return {"code": 0, "message": "用户创建成功", "user_id": cursor.lastrowid}
    except pymysql.IntegrityError:
        raise HTTPException(status_code=400, detail="手机号已存在")
    finally:
        conn.close()

@app.get("/api/users")
async def get_all_users(page: int = 1, page_size: int = 20, keyword: Optional[str] = None):
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            offset = (page - 1) * page_size
            base_query = "SELECT id, name, phone, avatar, location, rating, good_rate, total_orders, total_earnings, month_earnings, pending_earnings, created_at FROM users WHERE 1=1"
            params = []

            if keyword:
                base_query += " AND (name LIKE %s OR phone LIKE %s)"
                like_kw = f"%{keyword}%"
                params.extend([like_kw, like_kw])

            count_query = base_query.replace(
                "SELECT id, name, phone, avatar, location, rating, good_rate, total_orders, total_earnings, month_earnings, pending_earnings, created_at",
                "SELECT COUNT(*) as total"
            )
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']

            base_query += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
            params.extend([page_size, offset])
            cursor.execute(base_query, params)
            users = cursor.fetchall()

            has_updates = False
            for u in users:
                if normalize_user_avatar(u, cursor):
                    has_updates = True
            if has_updates:
                conn.commit()

            # 处理数值类型
            for u in users:
                u['total_earnings'] = float(u.get('total_earnings') or 0)
                u['month_earnings'] = float(u.get('month_earnings') or 0)
                u['pending_earnings'] = float(u.get('pending_earnings') or 0)
                u['rating'] = float(u.get('rating') or 5.0)
                u['good_rate'] = float(u.get('good_rate') or 100)
                u['total_orders'] = int(u.get('total_orders') or 0)

            return {"code": 0, "data": {"users": users, "total": total, "page": page, "page_size": page_size}}
    finally:
        conn.close()

@app.post("/api/users/upload-avatar")
async def upload_avatar(avatar: UploadFile = File(...), authorization: Optional[str] = Header(None)):
    """上传用户头像。

    ⚠️ 已知限制（v2 版本待修复）：当前头像写入容器本地磁盘 static/uploads/avatars/，
    云托管/Docker 容器扩容或滚动更新时**会丢失图片**。生产部署建议：
      1) 挂载持久化卷（例如腾讯云 CFS / NFS）到 /app/static/uploads
      2) 或改用对象存储 COS（推荐方案，v2 版本会切换）
    """
    auth = require_auth(authorization)
    user_id = auth["user_id"]
    try:
        if not avatar.content_type.startswith('image/'):
            return {"code": 1, "message": "请上传图片文件"}

        # 限制文件大小（5MB）
        content = await avatar.read()
        if len(content) > 5 * 1024 * 1024:
            return {"code": 1, "message": "图片大小不能超过5MB"}

        upload_dir = "static/uploads/avatars"
        os.makedirs(upload_dir, exist_ok=True)

        file_extension = avatar.filename.split('.')[-1].lower()
        if file_extension not in ['jpg', 'jpeg', 'png', 'gif', 'webp']:
            return {"code": 1, "message": "只支持jpg、png、gif、webp格式"}

        filename = f"avatar_{user_id}_{int(datetime.now().timestamp())}.{file_extension}"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as f:
            f.write(content)

        avatar_url = f"/static/uploads/avatars/{filename}"
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("UPDATE users SET avatar = %s WHERE id = %s", (avatar_url, user_id))
                conn.commit()
        finally:
            conn.close()

        return {"code": 0, "message": "头像上传成功", "data": {"avatar_url": avatar_url}}
    except Exception as e:
        print(f"上传头像失败: {e}")
        return {"code": 1, "message": "上传失败"}

@app.put("/api/users/update-profile")
async def update_profile(data: UpdateProfileRequest, auth: dict = Depends(require_auth)):
    user_id = auth["user_id"]

    if not data.name or len(data.name.strip()) < 2:
        return {"code": 1, "message": "姓名至少2个字符"}

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT phone FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            if not user:
                return {"code": 1, "message": "用户不存在"}

            old_phone = user['phone']

            if data.phone and data.phone != old_phone:
                # 手机号格式校验
                import re
                if not re.match(r'^1[3-9]\d{9}$', data.phone):
                    return {"code": 1, "message": "新手机号格式不正确"}

                # 短信验证（仅在未禁用短信时）
                if not DISABLE_SMS:
                    if not data.sms_code:
                        return {"code": 1, "message": "请输入验证码"}

                    key = f"{data.phone}_change_phone"
                    if key not in sms_codes:
                        return {"code": 1, "message": "验证码错误或已过期"}

                    code_data = sms_codes[key]
                    if code_data['used']:
                        return {"code": 1, "message": "验证码已使用"}
                    if time.time() > code_data['expire_time']:
                        return {"code": 1, "message": "验证码已过期"}
                    if code_data['code'] != data.sms_code:
                        return {"code": 1, "message": "验证码错误"}

                    code_data['used'] = True

                cursor.execute("SELECT id FROM users WHERE phone = %s AND id != %s", (data.phone, user_id))
                if cursor.fetchone():
                    return {"code": 1, "message": "该手机号已被使用"}

                cursor.execute("UPDATE users SET name = %s, phone = %s WHERE id = %s", (data.name.strip(), data.phone, user_id))
            else:
                cursor.execute("UPDATE users SET name = %s WHERE id = %s", (data.name.strip(), user_id))

            conn.commit()
            return {"code": 0, "message": "修改成功"}
    finally:
        conn.close()

# ==================== 订单相关API ====================

def generate_order_number(payment_method: str):
    now = datetime.now()
    day_prefix = now.strftime("%m%d")
    time_prefix = now.strftime("%m%d%H%M")

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT order_number FROM orders WHERE order_number LIKE %s ORDER BY id DESC LIMIT 1",
                (f"{day_prefix}%",)
            )
            result = cursor.fetchone()

            if result and result[0] and len(result[0]) >= 14:
                try:
                    last_number = int(result[0][-6:])
                    new_number = last_number + 1
                except ValueError:
                    new_number = 1
            else:
                new_number = 1

            return f"{time_prefix}{new_number:06d}"
    finally:
        conn.close()

def calc_distance_km(lat1, lng1, lat2, lng2) -> float:
    """根据经纬度计算两点直线距离（公里），用于发布订单时计算配送距离。

    若任一坐标缺失则回退到基于地址 hash 的伪距离（保留兼容性）。
    """
    try:
        if None in (lat1, lng1, lat2, lng2):
            return 0.0
        import math
        lat1, lng1, lat2, lng2 = map(float, (lat1, lng1, lat2, lng2))
        R = 6371.0  # 地球半径（km）
        d_lat = math.radians(lat2 - lat1)
        d_lng = math.radians(lng2 - lng1)
        a = (math.sin(d_lat / 2) ** 2
             + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except Exception:
        return 0.0


@app.post("/api/orders")
async def create_order(order: Order, auth: dict = Depends(require_auth)):
    """创建订单（需要登录）"""
    user_id = auth["user_id"]

    # 输入验证
    if order.fee <= 0 or order.fee > 9999:
        return {"code": 1, "message": "配送费用不合法"}
    if len(order.pickup_address) < 2:
        return {"code": 1, "message": "取件地址不能为空"}
    if len(order.delivery_address) < 2:
        return {"code": 1, "message": "送达地址不能为空"}

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            order_number = generate_order_number(order.payment_method)

            # 优先使用经纬度计算真实距离；坐标缺失时再用 hash 兜底以保证字段非空
            distance = calc_distance_km(order.pickup_lat, order.pickup_lng,
                                        order.delivery_lat, order.delivery_lng)
            if not distance:
                distance = round(abs(hash(order.pickup_address + order.delivery_address)) % 10 + 1, 1)

            cursor.execute(
                """INSERT INTO orders (user_id, order_number, title, pickup_address, delivery_address,
                delivery_time, goods_name, fee, is_urgent, remark, payment_method, contact_phone, distance,
                pickup_lat, pickup_lng, delivery_lat, delivery_lng)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (user_id, order_number, order.title, order.pickup_address, order.delivery_address,
                 order.delivery_time, order.goods_name, order.fee, order.is_urgent,
                 order.remark, order.payment_method, order.contact_phone,
                 distance, order.pickup_lat, order.pickup_lng, order.delivery_lat, order.delivery_lng)
            )
            conn.commit()
            return {"code": 0, "message": "订单创建成功", "order_id": cursor.lastrowid, "order_number": order_number}
    finally:
        conn.close()

@app.put("/api/orders/{order_id}/coordinates")
async def update_order_coordinates(order_id: int, payload: OrderCoordinateUpdate,
                                   auth: dict = Depends(require_auth)):
    """补写订单地图坐标，便于地图展示，并按真实经纬度重算 distance。

    权限：仅订单发布者或管理员可调用。
    """
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, user_id FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                return {"code": 1, "message": "订单不存在"}
            # 权限校验：管理员通过 require_actor_auth 不走这里，这里 auth 一定是 user
            if order['user_id'] != auth.get('user_id'):
                raise HTTPException(status_code=403, detail="无权修改该订单坐标")

            new_distance = calc_distance_km(payload.pickup_lat, payload.pickup_lng,
                                            payload.delivery_lat, payload.delivery_lng)
            cursor.execute(
                """UPDATE orders
                   SET pickup_lat = %s,
                       pickup_lng = %s,
                       delivery_lat = %s,
                       delivery_lng = %s,
                       distance = COALESCE(NULLIF(%s, 0), distance)
                   WHERE id = %s""",
                (
                    payload.pickup_lat,
                    payload.pickup_lng,
                    payload.delivery_lat,
                    payload.delivery_lng,
                    new_distance,
                    order_id,
                ),
            )
            conn.commit()
            return {"code": 0, "message": "订单坐标已更新", "data": {"distance": new_distance}}
    finally:
        conn.close()

@app.get("/api/orders")
async def get_orders(status: Optional[str] = None, user_id: Optional[int] = None,
                     runner_id: Optional[int] = None, keyword: Optional[str] = None,
                     time_filter: Optional[str] = None,
                     start_date: Optional[str] = None, end_date: Optional[str] = None,
                     min_fee: Optional[float] = None, max_fee: Optional[float] = None,
                     min_distance: Optional[float] = None, max_distance: Optional[float] = None,
                     page: int = 1, page_size: int = 20,
                     role: Optional[str] = None, my_tasks: Optional[bool] = None,
                     is_urgent: Optional[bool] = None,
                     authorization: Optional[str] = Header(None)):
    # 待接单列表允许未登录用户查看（首页公开展示）
    auth = None
    admin_auth = load_admin_auth_from_header(authorization)
    if admin_auth:
        auth = {**admin_auth, "actor_type": "admin"}
    else:
        user_auth = load_user_auth_from_header(authorization)
        if user_auth:
            auth = {**user_auth, "actor_type": "user"}

    # 非 pending 查询或涉及个人数据时必须登录
    if not auth and status != 'pending':
        raise HTTPException(status_code=401, detail="未登录或登录已过期")

    current_user_id = auth.get("user_id") if auth else None

    if auth and not actor_is_admin(auth):
        if role == 'customer':
            user_id = current_user_id
            runner_id = None
        elif role == 'runner':
            user_id = None
            if my_tasks or status != 'pending':
                runner_id = current_user_id
            else:
                runner_id = None
        else:
            if user_id is not None and user_id != current_user_id:
                raise HTTPException(status_code=403, detail="只能查看自己的订单")
            if runner_id is not None and runner_id != current_user_id:
                raise HTTPException(status_code=403, detail="只能查看自己的接单记录")
            if user_id is None and runner_id is None and status != 'pending':
                user_id = current_user_id

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 通过 LEFT JOIN reviews 同步返回 reviewed 标记，避免客户端重复跳"去评价"
            query = ("SELECT o.*, u.name as user_name, u.phone as user_phone, "
                     "(CASE WHEN rv.id IS NULL THEN 0 ELSE 1 END) AS reviewed "
                     "FROM orders o "
                     "LEFT JOIN users u ON o.user_id = u.id "
                     "LEFT JOIN reviews rv ON rv.order_id = o.id "
                     "WHERE 1=1")
            params = []

            if status:
                query += " AND o.status = %s"
                params.append(status)
            if user_id:
                query += " AND o.user_id = %s"
                params.append(user_id)
            if runner_id:
                query += " AND o.runner_id = %s"
                params.append(runner_id)
            if is_urgent is not None:
                query += " AND o.is_urgent = %s"
                params.append(1 if is_urgent else 0)

            if keyword:
                query += " AND (o.order_number LIKE %s OR o.title LIKE %s OR o.goods_name LIKE %s OR o.pickup_address LIKE %s OR o.delivery_address LIKE %s OR o.remark LIKE %s)"
                keyword_param = f"%{keyword}%"
                params.extend([keyword_param] * 6)

            if time_filter and time_filter != 'all':
                import datetime as dt
                now = dt.datetime.now()
                if time_filter == '1':
                    query += " AND o.created_at >= %s"
                    params.append(now - dt.timedelta(days=1))
                elif time_filter == '3':
                    query += " AND o.created_at >= %s"
                    params.append(now - dt.timedelta(days=3))
                elif time_filter == '7':
                    query += " AND o.created_at >= %s"
                    params.append(now - dt.timedelta(days=7))
                elif time_filter == '30':
                    query += " AND o.created_at >= %s"
                    params.append(now - dt.timedelta(days=30))
                elif time_filter == 'custom' and start_date and end_date:
                    query += " AND DATE(o.created_at) BETWEEN %s AND %s"
                    params.extend([start_date, end_date])

            if min_fee is not None:
                query += " AND o.fee >= %s"
                params.append(min_fee)
            if max_fee is not None:
                query += " AND o.fee <= %s"
                params.append(max_fee)
            if min_distance is not None:
                query += " AND o.distance >= %s"
                params.append(min_distance)
            if max_distance is not None:
                query += " AND o.distance <= %s"
                params.append(max_distance)

            # 复用 WHERE 子句构造 count 查询（剥离 SELECT 字段，避免 LEFT JOIN 多行计数）
            where_clause = query.split("WHERE", 1)[1]
            count_query = ("SELECT COUNT(DISTINCT o.id) as total FROM orders o "
                           "LEFT JOIN users u ON o.user_id = u.id "
                           "LEFT JOIN reviews rv ON rv.order_id = o.id WHERE " + where_clause)
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']

            query += " ORDER BY o.created_at DESC LIMIT %s OFFSET %s"
            offset = (page - 1) * page_size
            params.extend([page_size, offset])

            cursor.execute(query, params)
            orders = cursor.fetchall()

            sanitized_orders = []
            for order in orders:
                order['fee'] = float(order.get('fee') or 0)
                order['distance'] = float(order.get('distance') or 0)
                order['is_urgent'] = bool(order.get('is_urgent'))
                order['reviewed'] = bool(order.get('reviewed'))
                if auth is None:
                    # 未登录仅允许看待接单（pending）公开列表，需脱敏手机号
                    if order.get('status') != 'pending':
                        continue
                    pseudo_actor = {"actor_type": "user", "user_id": None}
                    sanitized_orders.append(sanitize_order_for_actor(order, pseudo_actor))
                    continue
                if not actor_is_admin(auth) and order.get('status') != 'pending' and not can_view_full_order(auth, order):
                    continue
                sanitized_orders.append(sanitize_order_for_actor(order, auth))

            return {"code": 0, "data": {"orders": sanitized_orders, "total": total, "page": page, "page_size": page_size}}
    finally:
        conn.close()

@app.put("/api/orders/{order_id}/accept")
async def accept_order(order_id: int, auth: dict = Depends(require_auth)):
    """接单（需要登录）。

    增加：
      - 禁止自己接自己发布的订单（避免数据双角色串扰、防刷接单数）
      - 通过 SQL WHERE 条件保证只有 pending 才能被接，避免并发接单导致状态错乱
    """
    runner_id = auth["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, user_id, status FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                return {"code": 1, "message": "订单不存在"}
            if order['status'] != 'pending':
                return {"code": 1, "message": "订单不存在或已被接单"}
            if order['user_id'] == runner_id:
                return {"code": 1, "message": "不能接自己发布的订单"}

            cursor.execute(
                "UPDATE orders SET runner_id = %s, status = 'ongoing' WHERE id = %s AND status = 'pending'",
                (runner_id, order_id)
            )
            if cursor.rowcount == 0:
                return {"code": 1, "message": "订单不存在或已被接单"}
            conn.commit()
            return {"code": 0, "message": "接单成功"}
    finally:
        conn.close()

@app.get("/api/orders/{order_id}")
async def get_order_detail(order_id: int):
    """获取订单详情"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                """SELECT o.*,
                   u.name as user_name, u.phone as user_phone, u.avatar as user_avatar,
                   r.name as runner_name, r.phone as runner_phone, r.avatar as runner_avatar, r.rating as runner_rating
                   FROM orders o
                   LEFT JOIN users u ON o.user_id = u.id
                   LEFT JOIN users r ON o.runner_id = r.id
                   WHERE o.id = %s""",
                (order_id,)
            )
            order = cursor.fetchone()

            if not order:
                return {"code": 1, "message": "订单不存在"}

            order['fee'] = float(order.get('fee') or 0)
            order['distance'] = float(order.get('distance') or 0)

            return {"code": 0, "data": order}
    finally:
        conn.close()

@app.put("/api/orders/{order_id}/complete")
async def complete_order(order_id: int, auth: dict = Depends(require_auth)):
    """完成订单（需要登录，且必须是接单的跑腿员）。

    资金/统计联动：
      1. orders.status -> completed，写 completed_at
      2. 按 PLATFORM_COMMISSION_RATE 拆分：
         runner_income = fee * (1 - rate)
         platform_fee  = fee * rate
         分别记入 earnings 表：跑腿员 type='order' 一条 + 平台 type='platform_fee' 一条
      3. 累加 users.total_earnings/month_earnings/pending_earnings/total_orders 时**仅累计 runner_income**
         month_earnings 在跨月时会自动重置
    """
    runner_id = auth["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM orders WHERE id = %s AND status = 'ongoing'", (order_id,))
            order = cursor.fetchone()
            if not order:
                return {"code": 1, "message": "订单不存在或状态不正确"}

            if order['runner_id'] != runner_id:
                return {"code": 1, "message": "您不是该订单的跑腿员"}

            fee = float(order.get('fee') or 0)
            platform_fee = round(fee * PLATFORM_COMMISSION_RATE, 2)
            runner_income = round(fee - platform_fee, 2)

            cursor.execute("UPDATE orders SET status = 'completed', completed_at = NOW() WHERE id = %s", (order_id,))

            cursor.execute(
                "INSERT INTO earnings (user_id, order_id, amount, type, status) VALUES (%s, %s, %s, 'order', 'completed')",
                (runner_id, order_id, runner_income)
            )
            if platform_fee > 0:
                # 平台抽佣流水：user_id 记为 NULL，便于管理端 SUM(amount WHERE type='platform_fee') 算平台净收益
                try:
                    cursor.execute(
                        "INSERT INTO earnings (user_id, order_id, amount, type, status) "
                        "VALUES (NULL, %s, %s, 'platform_fee', 'completed')",
                        (order_id, platform_fee)
                    )
                except Exception:
                    # earnings.user_id 若为 NOT NULL，则把抽佣记到跑腿员名下，但 amount 标负数表示扣减
                    cursor.execute(
                        "INSERT INTO earnings (user_id, order_id, amount, type, status) "
                        "VALUES (%s, %s, %s, 'platform_fee', 'completed')",
                        (runner_id, order_id, -platform_fee)
                    )

            # 跨月清零 month_earnings：用 SQL 表达式判断"最近一笔已完成订单"是否在本月之内
            cursor.execute(
                """UPDATE users SET
                   total_earnings = total_earnings + %s,
                   month_earnings = CASE
                       WHEN (SELECT MAX(completed_at) FROM (
                                SELECT completed_at FROM orders
                                WHERE runner_id = users.id AND status = 'completed' AND id <> %s
                            ) t) IS NULL
                            OR YEAR((SELECT MAX(completed_at) FROM (
                                SELECT completed_at FROM orders
                                WHERE runner_id = users.id AND status = 'completed' AND id <> %s
                            ) t)) <> YEAR(NOW())
                            OR MONTH((SELECT MAX(completed_at) FROM (
                                SELECT completed_at FROM orders
                                WHERE runner_id = users.id AND status = 'completed' AND id <> %s
                            ) t)) <> MONTH(NOW())
                       THEN %s
                       ELSE month_earnings + %s
                   END,
                   pending_earnings = pending_earnings + %s,
                   total_orders = total_orders + 1
                   WHERE id = %s""",
                (runner_income, order_id, order_id, order_id,
                 runner_income, runner_income, runner_income, runner_id)
            )

            conn.commit()
            return {"code": 0, "message": "订单已完成，收益已到账", "data": {
                "fee": fee, "platform_fee": platform_fee, "runner_income": runner_income
            }}
    finally:
        conn.close()

@app.put("/api/orders/{order_id}/cancel")
async def cancel_order(order_id: int, reason: Optional[str] = None,
                       body: dict = Body(default={}),
                       auth: dict = Depends(require_auth)):
    """取消订单（需要登录，且必须是订单发布者）。

    若订单已处于 ongoing（已有跑腿员接单），则在取消时：
      1. 把订单关联的 runner_id 保留作为审计依据（不清空，便于事后追溯）
      2. 在 earnings 表写入一条 type='cancel_record', amount=0, status='completed' 的审计流水，
         便于管理端及跑腿员看到"某单被发布者中途取消"的痕迹，避免客户端只看到订单消失。
    """
    user_id = auth["user_id"]
    cancel_reason = reason or body.get("reason", "用户取消")
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()

            if not order:
                return {"code": 1, "message": "订单不存在"}

            if order['user_id'] != user_id:
                return {"code": 1, "message": "您不是该订单的发布者"}

            if order['status'] not in ['pending', 'ongoing']:
                return {"code": 1, "message": "该订单状态不允许取消"}

            cursor.execute(
                "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = %s WHERE id = %s",
                (cancel_reason, order_id)
            )

            # ongoing 状态被发布者取消，给跑腿员留下审计痕迹
            if order.get('status') == 'ongoing' and order.get('runner_id'):
                try:
                    cursor.execute(
                        "INSERT INTO earnings (user_id, order_id, amount, type, status) "
                        "VALUES (%s, %s, 0, 'cancel_record', 'completed')",
                        (order['runner_id'], order_id)
                    )
                except Exception as e:
                    print(f"[cancel_order] 写入跑腿员审计流水失败: {e}")

            conn.commit()
            return {"code": 0, "message": "订单已取消"}
    finally:
        conn.close()


@app.put("/api/orders/{order_id}/runner-cancel")
async def runner_cancel_order(order_id: int, body: dict = Body(default={}),
                              auth: dict = Depends(require_auth)):
    """跑腿员中途取消已接订单（需要登录且是该订单的 runner）。

    业务规则：
      1. 订单回退到 pending 状态、清空 runner_id，允许其他人接单
      2. 写入 cancel_log（earnings 表 type=runner_cancel 审计流水）便于风控
      3. 同一跑腿员同一订单只允许触发一次（通过返回 message 提示）
    """
    runner_id = auth["user_id"]
    cancel_reason = body.get("reason", "跑腿员取消接单")
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, runner_id, status FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                return {"code": 1, "message": "订单不存在"}
            if order['status'] != 'ongoing':
                return {"code": 1, "message": "当前订单状态不允许跑腿员取消"}
            if order['runner_id'] != runner_id:
                return {"code": 1, "message": "您不是该订单的跑腿员"}

            cursor.execute(
                "UPDATE orders SET status = 'pending', runner_id = NULL, cancel_reason = %s WHERE id = %s",
                (cancel_reason, order_id)
            )
            try:
                cursor.execute(
                    "INSERT INTO earnings (user_id, order_id, amount, type, status) "
                    "VALUES (%s, %s, 0, 'runner_cancel', 'completed')",
                    (runner_id, order_id)
                )
            except Exception as e:
                print(f"[runner_cancel_order] 写入审计流水失败: {e}")
            conn.commit()
            return {"code": 0, "message": "已退回为待接单状态"}
    finally:
        conn.close()

# ==================== 评价相关API ====================

@app.post("/api/reviews")
async def create_review(review: ReviewCreate, auth: dict = Depends(require_auth)):
    """创建评价（需要登录）"""
    user_id = auth["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                "SELECT * FROM orders WHERE id = %s AND user_id = %s AND status = 'completed'",
                (review.order_id, user_id)
            )
            order = cursor.fetchone()
            if not order:
                return {"code": 1, "message": "订单不存在或未完成"}

            cursor.execute("SELECT id FROM reviews WHERE order_id = %s", (review.order_id,))
            if cursor.fetchone():
                return {"code": 1, "message": "该订单已评价"}

            if review.rating < 1 or review.rating > 5:
                return {"code": 1, "message": "评分必须在1-5之间"}

            cursor.execute(
                "INSERT INTO reviews (order_id, user_id, runner_id, rating, comment) VALUES (%s, %s, %s, %s, %s)",
                (review.order_id, user_id, review.runner_id, review.rating, review.comment)
            )

            cursor.execute(
                """SELECT AVG(rating) as avg_rating,
                   COUNT(*) as total_reviews,
                   SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) as good_reviews
                   FROM reviews WHERE runner_id = %s""",
                (review.runner_id,)
            )
            stats = cursor.fetchone()

            if stats and stats['total_reviews'] > 0:
                avg_rating = round(float(stats['avg_rating']), 1)
                good_rate = round((stats['good_reviews'] / stats['total_reviews']) * 100, 1)
                cursor.execute(
                    "UPDATE users SET rating = %s, good_rate = %s WHERE id = %s",
                    (avg_rating, good_rate, review.runner_id)
                )

            conn.commit()
            return {"code": 0, "message": "评价成功"}
    finally:
        conn.close()

@app.get("/api/reviews")
async def get_reviews(runner_id: Optional[int] = None, order_id: Optional[int] = None,
                      page: int = 1, page_size: int = 20):
    """获取评价列表"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            query = """SELECT r.*, u.name as user_name, u.avatar as user_avatar, o.title as order_title
                      FROM reviews r
                      LEFT JOIN users u ON r.user_id = u.id
                      LEFT JOIN orders o ON r.order_id = o.id
                      WHERE 1=1"""
            params = []

            if runner_id:
                query += " AND r.runner_id = %s"
                params.append(runner_id)
            if order_id:
                query += " AND r.order_id = %s"
                params.append(order_id)

            count_query = query.replace(
                "SELECT r.*, u.name as user_name, u.avatar as user_avatar, o.title as order_title",
                "SELECT COUNT(*) as total"
            )
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']

            query += " ORDER BY r.created_at DESC LIMIT %s OFFSET %s"
            offset = (page - 1) * page_size
            params.extend([page_size, offset])

            cursor.execute(query, params)
            reviews = cursor.fetchall()

            return {"code": 0, "data": {"reviews": reviews, "total": total, "page": page, "page_size": page_size}}
    finally:
        conn.close()

# ==================== 收益相关API ====================

@app.get("/api/earnings")
async def get_earnings(user_id: Optional[int] = None, status: Optional[str] = None,
                       page: int = 1, page_size: int = 20,
                       auth: dict = Depends(require_auth)):
    current_user_id = auth["user_id"]
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            query = """SELECT e.*, o.title as order_title, u.name as user_name, u.phone as user_phone
                      FROM earnings e
                      LEFT JOIN orders o ON e.order_id = o.id
                      LEFT JOIN users u ON e.user_id = u.id
                      WHERE e.user_id = %s"""
            params = [current_user_id]

            if status:
                query += " AND e.status = %s"
                params.append(status)

            count_query = query.replace(
                "SELECT e.*, o.title as order_title, u.name as user_name, u.phone as user_phone",
                "SELECT COUNT(*) as total"
            )
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']

            query += " ORDER BY e.created_at DESC LIMIT %s OFFSET %s"
            offset = (page - 1) * page_size
            params.extend([page_size, offset])

            cursor.execute(query, params)
            earnings = cursor.fetchall()

            for e in earnings:
                e['amount'] = float(e.get('amount') or 0)
                e['user_phone'] = mask_phone(e.get('user_phone'))

            return {"code": 0, "data": {"earnings": earnings, "total": total, "page": page, "page_size": page_size}}
    finally:
        conn.close()

@app.post("/api/earnings/withdraw")
async def request_withdraw(withdraw: WithdrawRequest, auth: dict = Depends(require_auth)):
    """申请提现（需要登录）"""
    user_id = auth["user_id"]

    if withdraw.amount <= 0:
        return {"code": 1, "message": "提现金额必须大于0"}

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT pending_earnings FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()
            if not user:
                return {"code": 1, "message": "用户不存在"}

            pending = float(user['pending_earnings'] or 0)
            if pending < withdraw.amount:
                return {"code": 1, "message": f"余额不足，可提现金额：¥{pending:.2f}"}

            # 写入earnings表
            cursor.execute(
                "INSERT INTO earnings (user_id, order_id, amount, type, status) VALUES (%s, NULL, %s, 'withdraw', 'pending')",
                (user_id, -withdraw.amount)
            )

            # 同时写入withdrawals表，供管理端审核
            cursor.execute(
                "INSERT INTO withdrawals (user_id, amount, method, status) VALUES (%s, %s, '微信', 'pending')",
                (user_id, withdraw.amount)
            )

            cursor.execute(
                "UPDATE users SET pending_earnings = pending_earnings - %s WHERE id = %s",
                (withdraw.amount, user_id)
            )

            conn.commit()
            return {"code": 0, "message": "提现申请已提交，请等待审核"}
    finally:
        conn.close()

@app.put("/api/earnings/{earning_id}/approve")
async def approve_earning(earning_id: int, admin_auth: dict = Depends(require_finance_admin)):
    """审核通过收益条目。

    禁止直接处理 type='withdraw' 的提现条目，提现必须走 /api/admin/withdrawals/{id}/review
    以保证 withdrawals 主表与 earnings 流水状态同步、避免余额被重复退还。
    """
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM earnings WHERE id = %s", (earning_id,))
            earning = cursor.fetchone()
            if not earning:
                raise HTTPException(status_code=404, detail="记录不存在")
            if earning.get('type') == 'withdraw':
                return {"code": 1, "message": "提现记录请通过提现审核接口处理"}

            cursor.execute("UPDATE earnings SET status = 'completed' WHERE id = %s", (earning_id,))
            conn.commit()
            return {"code": 0, "message": "审核通过"}
    finally:
        conn.close()

@app.put("/api/earnings/{earning_id}/reject")
async def reject_earning(earning_id: int, body: dict = Body(default={}),
                         admin_auth: dict = Depends(require_finance_admin)):
    """拒绝收益申请。同样禁止直接拒绝 withdraw 类型。"""
    reason = body.get("reason", "管理员拒绝")
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM earnings WHERE id = %s", (earning_id,))
            earning = cursor.fetchone()
            if not earning:
                raise HTTPException(status_code=404, detail="记录不存在")

            if earning['status'] != 'pending':
                return {"code": 1, "message": "只能拒绝待审核的记录"}

            if earning.get('type') == 'withdraw':
                return {"code": 1, "message": "提现记录请通过提现审核接口处理"}

            cursor.execute("UPDATE earnings SET status = 'rejected' WHERE id = %s", (earning_id,))
            conn.commit()
            return {"code": 0, "message": "已拒绝"}
    finally:
        conn.close()

# ==================== 反馈相关API ====================

@app.post("/api/feedback")
async def create_feedback(feedback: FeedbackCreate, auth: dict = Depends(require_auth)):
    """提交反馈（需要登录）"""
    user_id = auth["user_id"]

    if not feedback.content or len(feedback.content.strip()) < 5:
        return {"code": 1, "message": "反馈内容至少5个字符"}

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "INSERT INTO feedback (user_id, type, content, contact) VALUES (%s, %s, %s, %s)",
                (user_id, feedback.type, feedback.content.strip(), feedback.contact)
            )
            conn.commit()
            return {"code": 0, "message": "反馈提交成功，感谢您的建议！"}
    finally:
        conn.close()

# ==================== 管理员相关API ====================

@app.put("/api/admin/orders/{order_id}/cancel")
async def admin_cancel_order(order_id: int, body: dict = Body(default={}),
                             admin_auth: dict = Depends(require_admin_auth)):
    """管理员取消订单（仅管理员可用）。

    旧版本未做鉴权，且后面又被同名路由覆盖。现统一为唯一入口并强制管理员登录。
    若订单处于 ongoing，会同时清空 runner_id 关联，避免历史接单数据干扰跑腿员"我的任务"列表。
    """
    cancel_reason = body.get("reason", "管理员取消")
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM orders WHERE id = %s", (order_id,))
            order = cursor.fetchone()
            if not order:
                return {"code": 1, "message": "订单不存在"}
            if order['status'] not in ['pending', 'ongoing']:
                return {"code": 1, "message": "该订单状态不允许取消"}
            cursor.execute(
                "UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancel_reason = %s WHERE id = %s",
                (cancel_reason, order_id)
            )
            conn.commit()
            return {"code": 0, "message": "订单已取消"}
    finally:
        conn.close()

@app.post("/api/admin/login")
async def admin_login(login: AdminLogin):
    # ===== 演示模式：绕过数据库 =====
    if DEMO_MODE:
        if login.username == DEMO_ADMIN['username'] and login.password == DEMO_ADMIN['password']:
            token = generate_admin_token(DEMO_ADMIN['id'], DEMO_ADMIN['username'], DEMO_ADMIN['role'])
            return {"code": 0, "data": {
                "id": DEMO_ADMIN['id'],
                "username": DEMO_ADMIN['username'],
                "name": DEMO_ADMIN['name'],
                "role": DEMO_ADMIN['role'],
                "token": token
            }}
        else:
            raise HTTPException(status_code=401, detail="演示模式：请使用 admin / admin123 登录")

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM admins WHERE username = %s", (login.username,))
            admin = cursor.fetchone()
            if not admin:
                raise HTTPException(status_code=401, detail="用户名或密码错误")

            password_ok = False
            needs_rehash = False
            stored_pwd = admin.get('password') or ''
            try:
                if stored_pwd.startswith('$2b$') or stored_pwd.startswith('$2a$'):
                    password_ok = bcrypt.checkpw(login.password.encode(), stored_pwd.encode())
                else:
                    password_ok = (stored_pwd == login.password)
                    needs_rehash = password_ok
            except Exception as e:
                print(f"密码验证异常: {e}")
                password_ok = False

            if not password_ok:
                raise HTTPException(status_code=401, detail="用户名或密码错误")

            if needs_rehash:
                hashed = bcrypt.hashpw(login.password.encode(), bcrypt.gensalt()).decode()
                cursor.execute("UPDATE admins SET password = %s WHERE id = %s", (hashed, admin['id']))
                conn.commit()

            token = generate_admin_token(admin['id'], admin['username'], admin.get('role') or 'admin')
            return {"code": 0, "data": {
                "id": admin['id'],
                "username": admin['username'],
                "name": admin.get('name') or admin['username'],
                "role": admin.get('role') or 'admin',
                "token": token
            }}
    finally:
        conn.close()


@app.post("/api/admin/logout")
async def admin_logout(admin_auth: dict = Depends(require_admin_auth), authorization: Optional[str] = Header(None)):
    token = get_bearer_token(authorization)
    if token:
        admin_active_tokens.pop(token, None)
        _redis_del(f"sess:admin:{token}")
    return {"code": 0, "message": "已退出管理登录"}


@app.get("/api/admin/me")
async def admin_me(admin_auth: dict = Depends(require_admin_auth)):
    return {"code": 0, "data": {
        "id": admin_auth['admin_id'],
        "username": admin_auth['username'],
        "name": admin_auth['name'],
        "role": admin_auth['role']
    }}

# ==================== 统计数据API ====================

@app.get("/api/stats")
async def get_stats(admin_auth: dict = Depends(require_admin_auth)):
    """全站统计数据（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()")
            today_orders = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'")
            pending_orders = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM users")
            total_users = cursor.fetchone()['count']

            cursor.execute("SELECT COUNT(*) as count FROM orders")
            total_orders = cursor.fetchone()['count']

            cursor.execute("SELECT COALESCE(SUM(fee), 0) as total FROM orders WHERE status = 'completed'")
            total_earnings = float(cursor.fetchone()['total'])

            return {"code": 0, "data": {
                "today_orders": today_orders,
                "pending_orders": pending_orders,
                "total_users": total_users,
                "total_orders": total_orders,
                "total_earnings": total_earnings
            }}
    finally:
        conn.close()

# ==================== 调试接口（仅开发环境）====================

@app.get("/api/debug/sms-codes")
async def debug_sms_codes(admin_auth: dict = Depends(require_super_admin)):
    """查看当前所有验证码（仅用于开发调试）"""
    if not DEBUG_TOOLS_ENABLED:
        raise HTTPException(status_code=404, detail="接口不存在")

    result = {}
    for key, data in sms_codes.items():
        parts = key.rsplit('_', 1)
        phone = parts[0] if len(parts) > 1 else key
        sms_type = parts[1] if len(parts) > 1 else 'unknown'
        remaining_time = int(data['expire_time'] - time.time())
        result[key] = {
            'phone': phone,
            'type': sms_type,
            'code': data['code'],
            'used': data['used'],
            'remaining_seconds': remaining_time if remaining_time > 0 else 0,
            'expired': remaining_time <= 0
        }
    return {"code": 0, "data": result, "total": len(result)}

@app.get("/api/debug/generate-password-hash")
async def generate_password_hash(password: str, admin_auth: dict = Depends(require_super_admin)):
    """生成密码哈希（仅用于开发调试）"""
    if not DEBUG_TOOLS_ENABLED:
        raise HTTPException(status_code=404, detail="接口不存在")

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    return {"code": 0, "hash": hashed.decode()}

# ==================== 启动初始化 ====================

@app.on_event("startup")
async def startup_tasks():
    """应用启动时执行的初始化任务"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            # 清理本地头像脏数据
            cursor.execute("SELECT id, avatar FROM users WHERE avatar IS NOT NULL")
            users = cursor.fetchall()
            cleaned_count = 0
            for u in users:
                if normalize_user_avatar(u, cursor):
                    cleaned_count += 1
            if cleaned_count:
                print(f"启动时已清理 {cleaned_count} 条无效头像数据")

            # 确保users表有status字段
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'")
                print("已添加 users.status 字段")
            except Exception:
                pass  # 字段已存在

            # 确保feedback表存在
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS feedback (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT,
                    type VARCHAR(20) NOT NULL DEFAULT 'suggestion',
                    content TEXT NOT NULL,
                    contact VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_status (status)
                )
            """)

            # 确保withdrawals表存在
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS withdrawals (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    method VARCHAR(50) DEFAULT '微信',
                    account VARCHAR(100),
                    remark VARCHAR(500),
                    status VARCHAR(20) DEFAULT 'pending',
                    review_reason VARCHAR(500),
                    reviewed_at DATETIME,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_user_id (user_id),
                    INDEX idx_status (status)
                )
            """)
            # 尝试给withdrawals表添加remark字段（兼容旧表）
            try:
                cursor.execute("ALTER TABLE withdrawals ADD COLUMN remark VARCHAR(500)")
            except Exception:
                pass

            # 确保admins表存在
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS admins (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    name VARCHAR(100),
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'admin',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            initial_admin_username = os.getenv('INITIAL_ADMIN_USERNAME', '').strip()
            initial_admin_password = os.getenv('INITIAL_ADMIN_PASSWORD', '').strip()
            initial_admin_name = os.getenv('INITIAL_ADMIN_NAME', '系统管理员').strip() or '系统管理员'
            initial_admin_role = os.getenv('INITIAL_ADMIN_ROLE', 'super').strip() or 'super'
            if initial_admin_role not in {'super', 'admin', 'finance'}:
                initial_admin_role = 'super'

            if initial_admin_username and initial_admin_password:
                cursor.execute("SELECT id FROM admins WHERE username = %s", (initial_admin_username,))
                existing_admin = cursor.fetchone()
                if not existing_admin:
                    hashed_admin = bcrypt.hashpw(initial_admin_password.encode(), bcrypt.gensalt())
                    cursor.execute(
                        "INSERT INTO admins (username, name, password, role) VALUES (%s, %s, %s, %s)",
                        (initial_admin_username, initial_admin_name, hashed_admin.decode(), initial_admin_role)
                    )
                    print(f"已根据环境变量初始化管理员账号: {initial_admin_username}")

            conn.commit()
    except Exception as e:
        print(f"启动任务执行失败: {e}")
    finally:
        if conn:
            conn.close()

# ==================== 管理端 Panel API ====================

class AdminCreate(BaseModel):
    username: str
    name: str
    password: str
    role: str = "admin"

class UserBanRequest(BaseModel):
    ban: bool
    reason: Optional[str] = None

@app.get("/api/admin/panel/stats")
async def admin_panel_stats(admin_auth: dict = Depends(require_admin_auth)):
    """[已废弃] 旧版管理控制台统计接口，保留兼容入口，转发到 /api/admin/dashboard 数据结构。

    新版管理端统一使用 /api/admin/dashboard、/api/admin/orders、/api/admin/users 等接口。
    此处仅返回最少必要字段，避免老客户端 404。
    """
    return await admin_dashboard(admin_auth=admin_auth)  # type: ignore[name-defined]


# ===== 以下旧 /api/admin/panel/* 路由已被新版 /api/admin/* 系列取代，统一删除以收敛攻击面 =====
# 旧路由包括：panel/orders, panel/users, panel/users/{id}, panel/users/{id}/ban,
# panel/feedback, panel/feedback/{id}/resolve, panel/feedback/{id},
# panel/reviews/{id}, panel/admins(GET/POST), panel/admins/{id}(DELETE)
# 它们均无任何前端调用方（已 grep 全仓库确认），且大多未带 admin 鉴权——保留即安全风险。




# ==================== 管理控制台新版API ====================

class AdminChangePassword(BaseModel):
    old_password: str
    new_password: str

@app.get("/api/admin/badge-counts")
async def admin_badge_counts(admin_auth: dict = Depends(require_admin_auth)):
    """获取徽章数量（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT COUNT(*) as c FROM orders WHERE status='pending'")
            pending_orders = cursor.fetchone()['c']
            try:
                cursor.execute("SELECT COUNT(*) as c FROM withdrawals WHERE status='pending'")
                pending_withdraw = cursor.fetchone()['c']
            except:
                pending_withdraw = 0
            return {"code": 0, "data": {"pending_orders": pending_orders, "pending_withdraw": pending_withdraw}}
    finally:
        conn.close()

@app.get("/api/admin/dashboard")
async def admin_dashboard(admin_auth: dict = Depends(require_admin_auth)):
    """管理控制台数据总览（需管理员登录）"""
    if DEMO_MODE:
        return {"code": 0, "data": {
            "today_orders": 8, "pending_orders": 3, "total_users": 56, "total_orders": 234,
            "total_earnings": 5680.50, "pending_withdraw": 2,
            "today_trend": "+12%",
            "orders_trend": [
                {"date": "05-03", "count": 18}, {"date": "05-04", "count": 22},
                {"date": "05-05", "count": 25}, {"date": "05-06", "count": 30},
                {"date": "05-07", "count": 28}, {"date": "05-08", "count": 35},
                {"date": "05-09", "count": 8}
            ],
            "status_distribution": [
                {"status": "已完成", "count": 180}, {"status": "进行中", "count": 35},
                {"status": "待接单", "count": 15}, {"status": "已取消", "count": 4}
            ],
            "earnings_trend": [
                {"date": "05-03", "amount": 320}, {"date": "05-04", "amount": 450},
                {"date": "05-05", "amount": 520}, {"date": "05-06", "amount": 600},
                {"date": "05-07", "amount": 580}, {"date": "05-08", "amount": 720},
                {"date": "05-09", "amount": 180}
            ],
            "recent_orders": DEMO_ORDERS[:5]
        }}
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT COUNT(*) as c FROM orders WHERE DATE(created_at)=CURDATE()")
            today_orders = cursor.fetchone()['c']
            cursor.execute("SELECT COUNT(*) as c FROM orders WHERE status='pending'")
            pending_orders = cursor.fetchone()['c']
            cursor.execute("SELECT COUNT(*) as c FROM users")
            total_users = cursor.fetchone()['c']
            cursor.execute("SELECT COUNT(*) as c FROM orders")
            total_orders = cursor.fetchone()['c']
            cursor.execute("SELECT COALESCE(SUM(fee),0) as s FROM orders WHERE status='completed'")
            total_earnings = float(cursor.fetchone()['s'])
            try:
                cursor.execute("SELECT COUNT(*) as c FROM withdrawals WHERE status='pending'")
                pending_withdraw = cursor.fetchone()['c']
            except:
                pending_withdraw = 0

            # 近7日订单趋势
            cursor.execute("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM orders WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY DATE(created_at) ORDER BY date
            """)
            trend_raw = {str(r['date']): r['count'] for r in cursor.fetchall()}
            order_trend = []
            for i in range(6, -1, -1):
                from datetime import date, timedelta
                d = str(date.today() - timedelta(days=i))
                order_trend.append({"date": d[5:], "count": trend_raw.get(d, 0)})

            # 订单状态分布
            cursor.execute("SELECT status, COUNT(*) as c FROM orders GROUP BY status")
            status_dist = {r['status']: r['c'] for r in cursor.fetchall()}

            # 近7日收益趋势
            cursor.execute("""
                SELECT DATE(created_at) as date, COALESCE(SUM(fee),0) as amount
                FROM orders WHERE status='completed' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY DATE(created_at) ORDER BY date
            """)
            earn_raw = {str(r['date']): float(r['amount']) for r in cursor.fetchall()}
            earnings_trend = []
            for i in range(6, -1, -1):
                from datetime import date, timedelta
                d = str(date.today() - timedelta(days=i))
                earnings_trend.append({"date": d[5:], "amount": earn_raw.get(d, 0)})

            # 最新订单
            cursor.execute("""
                SELECT o.id, o.title, o.fee, o.status, o.is_urgent, o.created_at,
                       u.id as uid, u.name as uname, u.avatar as uavatar
                FROM orders o LEFT JOIN users u ON o.user_id=u.id
                ORDER BY o.created_at DESC LIMIT 8
            """)
            recent_orders = []
            for r in cursor.fetchall():
                recent_orders.append({
                    "id": r['id'], "title": r['title'], "fee": float(r['fee'] or 0),
                    "status": r['status'], "is_urgent": r['is_urgent'],
                    "created_at": str(r['created_at']) if r['created_at'] else None,
                    "user": {"id": r['uid'], "name": r['uname'], "avatar": r['uavatar']}
                })

            return {"code": 0, "data": {
                "today_orders": today_orders, "pending_orders": pending_orders,
                "total_users": total_users, "total_orders": total_orders,
                "total_earnings": total_earnings, "pending_withdraw": pending_withdraw,
                "order_trend": order_trend, "status_dist": status_dist,
                "earnings_trend": earnings_trend, "recent_orders": recent_orders
            }}
    finally:
        conn.close()

@app.get("/api/admin/orders")
async def admin_orders(page: int = 1, page_size: int = 15, search: str = '', status: str = '', urgent: str = '',
                       admin_auth: dict = Depends(require_admin_auth)):
    """管理端订单列表（需管理员登录）"""
    if DEMO_MODE:
        items = list(DEMO_ORDERS)
        if status:
            items = [o for o in items if o.get('status') == status]
        if urgent in ('0', '1'):
            items = [o for o in items if o.get('is_urgent') == int(urgent)]
        if search:
            kw = search.lower()
            items = [o for o in items if kw in (o.get('title') or '').lower() or kw in (o.get('publisher_name') or '').lower()]
        return {"code": 0, "data": {"list": items, "total": len(items), "page": page, "page_size": page_size}}
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            where = "WHERE 1=1"
            params = []
            if search:
                where += " AND (o.order_number LIKE %s OR CAST(o.id AS CHAR) LIKE %s OR o.title LIKE %s OR o.pickup_address LIKE %s OR o.delivery_address LIKE %s)"
                like = f"%{search}%"
                params.extend([like, like, like, like, like])
            if status:
                where += " AND o.status=%s"; params.append(status)
            if urgent != '':
                where += " AND o.is_urgent=%s"; params.append(int(urgent))

            count_sql = f"SELECT COUNT(*) as c FROM orders o {where}"
            cursor.execute(count_sql, params)
            total = cursor.fetchone()['c']

            sql = f"""SELECT o.id, o.order_number, o.title, o.fee, o.status, o.is_urgent, o.created_at,
                      u.id as uid, u.name as uname, u.avatar as uavatar,
                      r.id as rid, r.name as rname, r.avatar as ravatar
                      FROM orders o
                      LEFT JOIN users u ON o.user_id=u.id
                      LEFT JOIN users r ON o.runner_id=r.id
                      {where} ORDER BY o.created_at DESC LIMIT %s OFFSET %s"""
            params.extend([page_size, (page-1)*page_size])
            cursor.execute(sql, params)
            items = []
            for row in cursor.fetchall():
                items.append({
                    "id": row['id'], "order_number": row.get('order_number', ''), "title": row['title'], "fee": float(row['fee'] or 0),
                    "status": row['status'], "is_urgent": bool(row['is_urgent']),
                    "created_at": str(row['created_at']) if row['created_at'] else None,
                    "user": {"id": row['uid'], "name": row['uname'], "avatar": row['uavatar']},
                    "runner": {"id": row['rid'], "name": row['rname'], "avatar": row['ravatar']} if row['rid'] else None
                })
            return {"code": 0, "data": {"items": items, "total": total}}
    finally:
        conn.close()

@app.get("/api/admin/users")
async def admin_users(page: int = 1, page_size: int = 15, search: str = '', status: str = '',
                      admin_auth: dict = Depends(require_admin_auth)):
    """管理端用户列表（需管理员登录）"""
    if DEMO_MODE:
        items = list(DEMO_USERS)
        if status:
            items = [u for u in items if u.get('status') == status]
        if search:
            kw = search.lower()
            items = [u for u in items if kw in (u.get('username') or '').lower() or kw in (u.get('phone') or '').lower()]
        return {"code": 0, "data": {"list": items, "total": len(items), "page": page, "page_size": page_size}}
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            where = "WHERE 1=1"
            params = []
            if search:
                where += " AND (name LIKE %s OR phone LIKE %s)"
                like = f"%{search}%"
                params.extend([like, like])
            if status == 'banned':
                where += " AND status='banned'"
            elif status == 'active':
                where += " AND (status IS NULL OR status!='banned')"

            cursor.execute(f"SELECT COUNT(*) as c FROM users {where}", params)
            total = cursor.fetchone()['c']

            sql = f"""SELECT id, name, phone, location, avatar, total_orders,
                      total_earnings, month_earnings, pending_earnings, rating, good_rate,
                      status, created_at FROM users {where} ORDER BY created_at DESC LIMIT %s OFFSET %s"""
            params.extend([page_size, (page-1)*page_size])
            cursor.execute(sql, params)
            items = []
            for u in cursor.fetchall():
                items.append({
                    **{k: (float(v) if k in ['total_earnings','month_earnings','pending_earnings','rating','good_rate'] and v is not None else v)
                       for k, v in u.items()},
                    "username": u.get('name', ''),
                    "created_at": str(u['created_at']) if u['created_at'] else None
                })
            return {"code": 0, "data": {"items": items, "total": total}}
    finally:
        conn.close()

@app.get("/api/admin/users/{user_id}")
async def admin_user_detail(user_id: int, admin_auth: dict = Depends(require_admin_auth)):
    """管理端用户详情（需要管理员登录，禁止返回密码哈希）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM users WHERE id=%s", (user_id,))
            u = cursor.fetchone()
            if not u:
                return {"code": 1, "message": "用户不存在"}
            result = {k: (float(v) if k in ['total_earnings','month_earnings','pending_earnings','rating','good_rate'] and v is not None else v)
                      for k, v in u.items()}
            result['created_at'] = str(u['created_at']) if u['created_at'] else None
            # 关键：移除敏感字段（旧版本曾遗漏，会泄漏 bcrypt 哈希）
            result.pop('password', None)
            if 'username' not in result:
                result['username'] = result.get('name', '')
            return {"code": 0, "data": result}
    finally:
        conn.close()

@app.put("/api/admin/users/{user_id}/status")
async def admin_user_status(user_id: int, body: dict = Body(...),
                            admin_auth: dict = Depends(require_admin_auth)):
    """管理端修改用户状态（需管理员登录）"""
    new_status = body.get('status', 'active')
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE users SET status=%s WHERE id=%s", (new_status, user_id))
            conn.commit()
            return {"code": 0, "message": "状态已更新"}
    finally:
        conn.close()

@app.put("/api/admin/users/{user_id}/reset-password")
async def admin_reset_user_password(user_id: int, body: dict = Body(...), admin_auth: dict = Depends(require_super_admin)):
    """管理端重置用户密码"""
    new_password = body.get('new_password', '')
    if not new_password or len(new_password) < 6:
        return {"code": 1, "message": "新密码长度不能少于6位"}
    try:
        hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    except Exception as e:
        return {"code": 1, "message": f"密码加密失败: {str(e)}"}
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, name, phone FROM users WHERE id=%s", (user_id,))
            user = cursor.fetchone()
            if not user:
                return {"code": 1, "message": "用户不存在"}
            cursor.execute("UPDATE users SET password=%s WHERE id=%s", (hashed, user_id))
            conn.commit()
            return {"code": 0, "message": f"用户 {user.get('name', user.get('phone', user_id))} 的密码已重置成功"}
    finally:
        conn.close()


@app.post("/api/admin/users")
async def admin_create_user(body: dict = Body(...), admin_auth: dict = Depends(require_super_admin)):
    """管理端新增用户（密码使用 bcrypt 加密存储）"""
    name = (body.get('name') or body.get('username') or '').strip()
    phone = (body.get('phone') or '').strip()
    password = body.get('password') or ''
    location = (body.get('location') or '').strip() or None
    status_value = (body.get('status') or 'active').strip() or 'active'

    if len(name) < 2 or len(name) > 20:
        return {"code": 1, "message": "用户名长度需在 2-20 个字符"}
    if not phone or len(phone) < 6:
        return {"code": 1, "message": "请输入有效的手机号"}
    if not password or len(password) < 6:
        return {"code": 1, "message": "密码长度不能少于6位"}
    if status_value not in {"active", "banned"}:
        return {"code": 1, "message": "用户状态无效"}

    try:
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    except Exception as e:
        return {"code": 1, "message": f"密码加密失败: {str(e)}"}

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE name=%s", (name,))
            if cursor.fetchone():
                return {"code": 1, "message": "用户名已存在"}
            cursor.execute("SELECT id FROM users WHERE phone=%s", (phone,))
            if cursor.fetchone():
                return {"code": 1, "message": "手机号已注册"}

            cursor.execute(
                "INSERT INTO users (name, phone, password, location, status) VALUES (%s, %s, %s, %s, %s)",
                (name, phone, hashed, location, status_value)
            )
            new_id = cursor.lastrowid
            conn.commit()
            return {"code": 0, "message": "用户已创建", "data": {"id": new_id}}
    finally:
        conn.close()


@app.put("/api/admin/users/{user_id}")
async def admin_update_user(user_id: int, body: dict = Body(...), admin_auth: dict = Depends(require_super_admin)):
    """管理端编辑用户基本信息（用户名、手机号、位置、状态、可选重置密码）"""
    name = (body.get('name') or body.get('username') or '').strip()
    phone = (body.get('phone') or '').strip()
    location = body.get('location')
    if isinstance(location, str):
        location = location.strip() or None
    status_value = (body.get('status') or '').strip() or None
    new_password = body.get('password') or ''

    if not name or len(name) < 2 or len(name) > 20:
        return {"code": 1, "message": "用户名长度需在 2-20 个字符"}
    if not phone or len(phone) < 6:
        return {"code": 1, "message": "请输入有效的手机号"}
    if status_value and status_value not in {"active", "banned"}:
        return {"code": 1, "message": "用户状态无效"}
    if new_password and len(new_password) < 6:
        return {"code": 1, "message": "新密码长度不能少于6位"}

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id FROM users WHERE id=%s", (user_id,))
            if not cursor.fetchone():
                return {"code": 1, "message": "用户不存在"}

            cursor.execute("SELECT id FROM users WHERE name=%s AND id<>%s", (name, user_id))
            if cursor.fetchone():
                return {"code": 1, "message": "用户名已被其他账号占用"}
            cursor.execute("SELECT id FROM users WHERE phone=%s AND id<>%s", (phone, user_id))
            if cursor.fetchone():
                return {"code": 1, "message": "手机号已被其他账号占用"}

            sets = ["name=%s", "phone=%s", "location=%s"]
            params = [name, phone, location]
            if status_value:
                sets.append("status=%s")
                params.append(status_value)
            if new_password:
                try:
                    hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
                except Exception as e:
                    return {"code": 1, "message": f"密码加密失败: {str(e)}"}
                sets.append("password=%s")
                params.append(hashed)
            params.append(user_id)
            cursor.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=%s", params)
            conn.commit()
            return {"code": 0, "message": "用户信息已更新"}
    finally:
        conn.close()


@app.delete("/api/admin/users/{user_id}")
async def admin_delete_user(user_id: int, admin_auth: dict = Depends(require_super_admin)):
    """管理端删除用户（同时清理其订单、接单关联、收益、提现等数据）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, name, phone FROM users WHERE id=%s", (user_id,))
            user = cursor.fetchone()
            if not user:
                return {"code": 1, "message": "用户不存在"}

            try:
                cursor.execute("UPDATE orders SET runner_id=NULL WHERE runner_id=%s", (user_id,))
                cursor.execute("DELETE FROM reviews WHERE user_id=%s OR runner_id=%s", (user_id, user_id))
                cursor.execute("DELETE FROM earnings WHERE user_id=%s", (user_id,))
                cursor.execute("DELETE FROM withdrawals WHERE user_id=%s", (user_id,))
                cursor.execute("DELETE FROM feedback WHERE user_id=%s", (user_id,))
                cursor.execute("DELETE FROM orders WHERE user_id=%s", (user_id,))
            except Exception:
                # 容忍部分关联表不存在的情况，下面继续删除主表
                pass

            cursor.execute("DELETE FROM users WHERE id=%s", (user_id,))
            conn.commit()
            return {"code": 0, "message": f"用户 {user.get('name') or user.get('phone') or user_id} 已删除"}
    finally:
        conn.close()


# 注：旧版 admin_cancel_order_new 已合并到上方 admin_cancel_order，删除重复路由以避免 OpenAPI 警告。

@app.get("/api/admin/withdrawals")
async def admin_withdrawals(page: int = 1, page_size: int = 15, status: str = 'pending',
                            admin_auth: dict = Depends(require_admin_auth)):
    """管理端提现列表（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            try:
                where = "WHERE 1=1"
                params = []
                if status:
                    where += " AND w.status=%s"; params.append(status)
                cursor.execute(f"SELECT COUNT(*) as c FROM withdrawals w {where}", params)
                total = cursor.fetchone()['c']
                sql = f"""SELECT w.*, u.name as uname, u.phone as uphone, u.avatar as uavatar
                          FROM withdrawals w LEFT JOIN users u ON w.user_id=u.id
                          {where} ORDER BY w.created_at DESC LIMIT %s OFFSET %s"""
                params.extend([page_size, (page-1)*page_size])
                cursor.execute(sql, params)
                items = []
                for w in cursor.fetchall():
                    items.append({
                        "id": w['id'], "amount": float(w['amount'] or 0),
                        "method": w.get('method', '微信'), "account": w.get('account', '--'),
                        "status": w['status'],
                        "created_at": str(w['created_at']) if w['created_at'] else None,
                        "user": {"name": w['uname'], "phone": w['uphone'], "avatar": w['uavatar']}
                    })
                return {"code": 0, "data": {"items": items, "total": total}}
            except Exception as e:
                return {"code": 0, "data": {"items": [], "total": 0}}
    finally:
        conn.close()

@app.put("/api/admin/withdrawals/{withdrawal_id}/review")
async def admin_review_withdrawal(withdrawal_id: int, body: dict = Body(...),
                                  admin_auth: dict = Depends(require_finance_admin)):
    """审核提现申请（需财务/超级管理员）。

    审核拒绝时：
      1. 回写 withdrawals 表状态
      2. 同步对应 earnings 表的最新 pending 提现记录为 rejected
      3. 把冻结的 pending_earnings 退还给用户
    审核通过时：仅把对应 earnings 标记为 completed，不再二次扣减用户金额。
    """
    action = body.get('action', 'approved')
    reason = body.get('reason', '')
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            try:
                cursor.execute("SELECT * FROM withdrawals WHERE id=%s", (withdrawal_id,))
                w = cursor.fetchone()
                if not w:
                    return {"code": 1, "message": "提现记录不存在"}
                cursor.execute("UPDATE withdrawals SET status=%s, review_reason=%s, reviewed_at=NOW() WHERE id=%s",
                               (action, reason, withdrawal_id))
                if action == 'rejected':
                    cursor.execute("UPDATE users SET pending_earnings=pending_earnings+%s WHERE id=%s",
                                   (w['amount'], w['user_id']))
                    # 同步更新earnings表
                    cursor.execute(
                        "UPDATE earnings SET status='rejected' WHERE user_id=%s AND type='withdraw' AND status='pending' ORDER BY created_at DESC LIMIT 1",
                        (w['user_id'],)
                    )
                elif action == 'approved':
                    # 同步更新earnings表
                    cursor.execute(
                        "UPDATE earnings SET status='completed' WHERE user_id=%s AND type='withdraw' AND status='pending' ORDER BY created_at DESC LIMIT 1",
                        (w['user_id'],)
                    )
                conn.commit()
                return {"code": 0, "message": "审核完成"}
            except Exception as e:
                return {"code": 1, "message": str(e)}
    finally:
        conn.close()

@app.get("/api/admin/withdrawals/stats")
async def admin_withdrawal_stats(admin_auth: dict = Depends(require_admin_auth)):
    """提现统计数据（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            try:
                cursor.execute("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM withdrawals WHERE status='pending'")
                r = cursor.fetchone()
                pending_count = r['c']; pending_amount = float(r['s'])
                cursor.execute("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM withdrawals WHERE status='approved'")
                r = cursor.fetchone()
                approved_count = r['c']; approved_amount = float(r['s'])
                cursor.execute("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM withdrawals WHERE status='rejected'")
                r = cursor.fetchone()
                rejected_count = r['c']; rejected_amount = float(r['s'])
                cursor.execute("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM withdrawals")
                r = cursor.fetchone()
                total_count = r['c']; total_amount = float(r['s'])
                cursor.execute("SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as s FROM withdrawals WHERE DATE(created_at)=CURDATE()")
                r = cursor.fetchone()
                today_count = r['c']; today_amount = float(r['s'])
                return {"code": 0, "data": {
                    "pending_count": pending_count, "pending_amount": pending_amount,
                    "approved_count": approved_count, "approved_amount": approved_amount,
                    "rejected_count": rejected_count, "rejected_amount": rejected_amount,
                    "total_count": total_count, "total_amount": total_amount,
                    "today_count": today_count, "today_amount": today_amount
                }}
            except Exception as e:
                return {"code": 0, "data": {"pending_count":0,"pending_amount":0,"approved_count":0,"approved_amount":0,"rejected_count":0,"rejected_amount":0,"total_count":0,"total_amount":0,"today_count":0,"today_amount":0}}
    finally:
        conn.close()

class UserBalanceAdjust(BaseModel):
    amount: float
    reason: str = "管理员调整"
    type: str = "add"  # add 或 deduct

@app.put("/api/admin/users/{user_id}/adjust-balance")
async def admin_adjust_user_balance(user_id: int, body: UserBalanceAdjust,
                                    admin_auth: dict = Depends(require_finance_admin)):
    """管理端调整用户余额（需财务/超级管理员）"""
    if body.amount <= 0:
        return {"code": 1, "message": "金额必须大于0"}
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, name, phone, pending_earnings, total_earnings FROM users WHERE id=%s", (user_id,))
            user = cursor.fetchone()
            if not user:
                return {"code": 1, "message": "用户不存在"}
            if body.type == "deduct":
                current = float(user.get('pending_earnings') or 0)
                if current < body.amount:
                    return {"code": 1, "message": f"用户余额不足，当前余额：¥{current:.2f}"}
                cursor.execute("UPDATE users SET pending_earnings=pending_earnings-%s WHERE id=%s", (body.amount, user_id))
                cursor.execute("INSERT INTO earnings (user_id, order_id, amount, type, status) VALUES (%s, NULL, %s, 'adjust', 'completed')",
                               (user_id, -body.amount))
            else:
                cursor.execute("UPDATE users SET pending_earnings=pending_earnings+%s, total_earnings=total_earnings+%s WHERE id=%s",
                               (body.amount, body.amount, user_id))
                cursor.execute("INSERT INTO earnings (user_id, order_id, amount, type, status) VALUES (%s, NULL, %s, 'adjust', 'completed')",
                               (user_id, body.amount))
            conn.commit()
            action = "扣减" if body.type == "deduct" else "增加"
            return {"code": 0, "message": f"已{action}用户余额 ¥{body.amount:.2f}，原因：{body.reason}"}
    finally:
        conn.close()

@app.get("/api/admin/earnings")
async def admin_earnings(page: int = 1, page_size: int = 15, search: str = '', type: str = '', status: str = '',
                         admin_auth: dict = Depends(require_finance_admin)):
    """管理端收益流水"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            try:
                where = "WHERE 1=1"
                params = []
                if search:
                    where += " AND u.name LIKE %s"; params.append(f"%{search}%")
                if type:
                    where += " AND e.type=%s"; params.append(type)
                if status:
                    where += " AND e.status=%s"; params.append(status)
                cursor.execute(f"SELECT COUNT(*) as c FROM earnings e LEFT JOIN users u ON e.user_id=u.id {where}", params)
                total = cursor.fetchone()['c']
                sql = f"""SELECT e.*, u.name as uname, u.avatar as uavatar
                          FROM earnings e LEFT JOIN users u ON e.user_id=u.id
                          {where} ORDER BY e.created_at DESC LIMIT %s OFFSET %s"""
                params.extend([page_size, (page-1)*page_size])
                cursor.execute(sql, params)
                items = []
                for e in cursor.fetchall():
                    items.append({
                        "id": e['id'], "amount": float(e['amount'] or 0),
                        "type": e.get('type', 'order'), "status": e.get('status', 'completed'),
                        "order_id": e.get('order_id'),
                        "created_at": str(e['created_at']) if e['created_at'] else None,
                        "user": {"name": e['uname'], "avatar": e['uavatar']}
                    })
                return {"code": 0, "data": {"items": items, "total": total}}
            except Exception:
                return {"code": 0, "data": {"items": [], "total": 0}}
    finally:
        conn.close()

@app.get("/api/admin/reviews")
async def admin_reviews(page: int = 1, page_size: int = 15,
                        admin_auth: dict = Depends(require_admin_auth)):
    """管理端评价列表（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            try:
                cursor.execute("SELECT COUNT(*) as c FROM reviews")
                total = cursor.fetchone()['c']
                cursor.execute("""
                    SELECT r.*, u.name as uname, u.avatar as uavatar,
                           ru.name as rname, ru.avatar as ravatar
                    FROM reviews r
                    LEFT JOIN users u ON r.user_id=u.id
                    LEFT JOIN users ru ON r.runner_id=ru.id
                    ORDER BY r.created_at DESC LIMIT %s OFFSET %s
                """, (page_size, (page-1)*page_size))
                items = []
                for r in cursor.fetchall():
                    items.append({
                        "id": r['id'], "rating": r['rating'], "comment": r.get('comment', ''),
                        "order_id": r['order_id'],
                        "created_at": str(r['created_at']) if r['created_at'] else None,
                        "user": {"name": r['uname'], "avatar": r['uavatar']},
                        "runner": {"name": r['rname'], "avatar": r['ravatar']}
                    })
                return {"code": 0, "data": {"items": items, "total": total}}
            except Exception:
                return {"code": 0, "data": {"items": [], "total": 0}}
    finally:
        conn.close()

@app.delete("/api/admin/reviews/{review_id}")
async def admin_delete_review_new(review_id: int, admin_auth: dict = Depends(require_admin_auth)):
    """管理端删除评价（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM reviews WHERE id=%s", (review_id,))
            conn.commit()
            return {"code": 0, "message": "删除成功"}
    finally:
        conn.close()

@app.get("/api/admin/feedback")
async def admin_feedback(page: int = 1, page_size: int = 15, status: str = 'pending',
                         admin_auth: dict = Depends(require_admin_auth)):
    """管理端反馈列表（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            try:
                where = "WHERE 1=1"
                params = []
                if status == 'pending':
                    where += " AND (f.status IS NULL OR f.status!='processed')"
                elif status == 'processed':
                    where += " AND f.status='processed'"
                cursor.execute(f"SELECT COUNT(*) as c FROM feedback f {where}", params)
                total = cursor.fetchone()['c']
                sql = f"""SELECT f.*, u.name as uname, u.avatar as uavatar
                          FROM feedback f LEFT JOIN users u ON f.user_id=u.id
                          {where} ORDER BY f.created_at DESC LIMIT %s OFFSET %s"""
                params.extend([page_size, (page-1)*page_size])
                cursor.execute(sql, params)
                items = []
                for f in cursor.fetchall():
                    items.append({
                        "id": f['id'], "content": f.get('content', f.get('message', '')),
                        "type": f.get('type', '建议'), "status": f.get('status', 'pending'),
                        "created_at": str(f['created_at']) if f['created_at'] else None,
                        "user": {"name": f['uname'], "avatar": f['uavatar']}
                    })
                return {"code": 0, "data": {"items": items, "total": total}}
            except Exception:
                return {"code": 0, "data": {"items": [], "total": 0}}
    finally:
        conn.close()

@app.put("/api/admin/feedback/{feedback_id}/process")
async def admin_process_feedback(feedback_id: int, admin_auth: dict = Depends(require_admin_auth)):
    """标记反馈为已处理（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("UPDATE feedback SET status='processed' WHERE id=%s", (feedback_id,))
            conn.commit()
            return {"code": 0, "message": "已标记为处理"}
    finally:
        conn.close()

@app.delete("/api/admin/feedback/{feedback_id}")
async def admin_delete_feedback_new(feedback_id: int, admin_auth: dict = Depends(require_admin_auth)):
    """删除反馈（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM feedback WHERE id=%s", (feedback_id,))
            conn.commit()
            return {"code": 0, "message": "删除成功"}
    finally:
        conn.close()

@app.get("/api/admin/admins")
async def admin_list_admins(admin_auth: dict = Depends(require_super_admin)):
    """管理员列表（仅超级管理员可见）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id, username, name, role, created_at FROM admins ORDER BY id")
            admins = []
            for a in cursor.fetchall():
                admins.append({**a, "created_at": str(a['created_at']) if a['created_at'] else None})
            return {"code": 0, "data": admins}
    finally:
        conn.close()

@app.post("/api/admin/admins")
async def admin_create_admin_new(body: dict = Body(...),
                                 admin_auth: dict = Depends(require_super_admin)):
    """创建管理员（仅超级管理员）"""
    username = body.get('username', '').strip()
    name = body.get('name', '').strip()
    password = body.get('password', '')
    role = body.get('role', 'admin')
    if role not in {'super', 'admin', 'finance'}:
        return {"code": 1, "message": "角色无效"}
    if not username or not password:
        return {"code": 1, "message": "用户名和密码不能为空"}
    if len(password) < 6:
        return {"code": 1, "message": "密码至少6位"}
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT id FROM admins WHERE username=%s", (username,))
            if cursor.fetchone():
                return {"code": 1, "message": "账号已存在"}
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
            cursor.execute("INSERT INTO admins (username, name, password, role) VALUES (%s,%s,%s,%s)",
                           (username, name or username, hashed.decode(), role))
            conn.commit()
            return {"code": 0, "message": "管理员创建成功"}
    finally:
        conn.close()

@app.delete("/api/admin/admins/{admin_id}")
async def admin_delete_admin_new(admin_id: int, admin_auth: dict = Depends(require_super_admin)):
    """删除管理员（仅超级管理员）"""
    if admin_auth.get('admin_id') == admin_id:
        return {"code": 1, "message": "不能删除自己"}
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM admins WHERE id=%s", (admin_id,))
            conn.commit()
            return {"code": 0, "message": "删除成功"}
    finally:
        conn.close()

@app.get("/api/admin/db-status")
async def admin_db_status(admin_auth: dict = Depends(require_admin_auth)):
    """检测数据库状态（需管理员登录）"""
    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT COUNT(*) as c FROM users")
            users_count = cursor.fetchone()['c']
            cursor.execute("SELECT COUNT(*) as c FROM orders")
            orders_count = cursor.fetchone()['c']
            return {"code": 0, "data": {"users_count": users_count, "orders_count": orders_count}}
    except Exception as e:
        return {"code": 1, "message": str(e)}
    finally:
        conn.close()

@app.put("/api/admin/change-password")
async def admin_change_password(body: AdminChangePassword, admin_auth: dict = Depends(require_admin_auth)):
    """管理员修改密码"""
    if not body.new_password or len(body.new_password) < 6:
        return {"code": 1, "message": "新密码长度不能少于6位"}

    conn = get_db_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute("SELECT * FROM admins WHERE id = %s", (admin_auth['admin_id'],))
            admin = cursor.fetchone()
            if not admin:
                return {"code": 1, "message": "管理员不存在"}

            stored_pwd = admin.get('password') or ''
            try:
                if stored_pwd.startswith('$2b$') or stored_pwd.startswith('$2a$'):
                    valid = bcrypt.checkpw(body.old_password.encode(), stored_pwd.encode())
                else:
                    valid = stored_pwd == body.old_password
            except Exception:
                valid = False

            if not valid:
                return {"code": 1, "message": "当前密码错误"}

            hashed = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
            cursor.execute("UPDATE admins SET password=%s WHERE id=%s", (hashed, admin['id']))
            conn.commit()
            return {"code": 0, "message": "密码修改成功"}
    finally:
        conn.close()

@app.get("/admin")
async def admin_panel_redirect():
    """管理控制台入口"""
    return RedirectResponse(url="/static/admin-panel.html")

# ==================== 项目打包下载 ====================
import zipfile
import io
from fastapi.responses import StreamingResponse

@app.get("/api/download-project")
async def download_project(admin_auth: dict = Depends(require_super_admin)):
    """将整个项目打包为zip文件供下载"""
    if not PROJECT_DOWNLOAD_ENABLED:
        raise HTTPException(status_code=404, detail="接口不存在")

    project_root = os.path.dirname(os.path.abspath(__file__))

    # 需要排除的目录和文件
    exclude_dirs = {'.agent', '__pycache__', '.git', 'node_modules', '.venv', 'venv', 'dist', '.cache', '.codebuddy'}
    exclude_files = {'.DS_Store', 'Thumbs.db', '.env'}

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(project_root):
            # 排除不需要的目录
            dirs[:] = [d for d in dirs if d not in exclude_dirs]

            for file in files:
                if file in exclude_files:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, project_root)
                try:
                    zf.write(file_path, arcname)
                except Exception:
                    pass  # 跳过无法读取的文件

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": "attachment; filename=rural-errand-project.zip"
        }
    )

# 挂载静态文件（必须放在最后）
app.mount("/static", StaticFiles(directory="static"), name="static")
