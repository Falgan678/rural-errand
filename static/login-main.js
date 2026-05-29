// 登录注册页面交互逻辑
const APP_CONFIG = window.__APP_CONFIG__ || {};
const API_BASE = (APP_CONFIG.apiBase || '/api').replace(/\/$/, '');
const PAGE_URLS = {
    login: APP_CONFIG.loginPage || 'login.html',
    client: APP_CONFIG.clientPage || 'index.html'
};

// 全局状态
let smsCountdown = 0;
let smsTimer = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkLoginStatus();
});

// 初始化事件监听器
function initEventListeners() {
    // 登录/注册标签切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });

    // 登录按钮
    document.getElementById('loginSubmitBtn').addEventListener('click', handleLogin);

    // 注册按钮
    document.getElementById('registerSubmitBtn').addEventListener('click', handleRegister);

    // 回车键提交
    document.getElementById('loginPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    document.getElementById('registerConfirmPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });

    // 密码显示/隐藏切换
    document.querySelectorAll('.toggle-password-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.dataset.target;
            const input = document.getElementById(targetId);
            const eyeOff = btn.querySelector('.eye-off');
            const eyeOn = btn.querySelector('.eye-on');
            
            if (input.type === 'password') {
                input.type = 'text';
                eyeOff.classList.add('hidden');
                eyeOn.classList.remove('hidden');
            } else {
                input.type = 'password';
                eyeOff.classList.remove('hidden');
                eyeOn.classList.add('hidden');
            }
        });
    });
}

// 切换登录/注册标签
function switchTab(tab) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    // 切换表单显示
    document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
}

// 切换登录方式
function switchLoginMethod(method) {
    // 更新按钮状态
    document.querySelectorAll('.method-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });

    // 切换表单显示
    document.getElementById('passwordLogin').classList.toggle('hidden', method !== 'password');
    document.getElementById('smsLogin').classList.toggle('hidden', method !== 'sms');
}

// 发送验证码
async function sendSmsCode(type) {
    const phoneInput = type === 'login' 
        ? document.getElementById('loginPhone')
        : document.getElementById('registerPhone');
    const sendBtn = type === 'login'
        ? document.getElementById('loginSendSms')
        : document.getElementById('registerSendSms');

    const phone = phoneInput.value.trim();

    // 验证手机号
    if (!phone) {
        showToast('请输入手机号', 'error');
        return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        showToast('请输入正确的手机号', 'error');
        return;
    }

    // 防止重复点击
    if (smsCountdown > 0) {
        return;
    }

    try {
        sendBtn.disabled = true;
        const response = await fetch(`${API_BASE}/auth/send-sms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phone, type })
        });

        const result = await parseApiResponse(response);
        if (result.code === 0) {
            showToast('验证码已发送，请注意查收', 'success');
            startCountdown(sendBtn);
        } else {
            showToast(result.message || '发送失败', 'error');
            sendBtn.disabled = false;
        }
    } catch (error) {
        console.error('发送验证码失败:', error.message || error);
        console.error('错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showToast(error.message || '网络错误，请重试', 'error');
        sendBtn.disabled = false;
    }
}

// 保留空函数以兼容旧调用，正式环境不再展示开发模式验证码
async function showDevModeHint() {
    return null;
}

// 倒计时
function startCountdown(btn) {
    smsCountdown = 60;
    btn.textContent = `${smsCountdown}秒后重试`;
    
    smsTimer = setInterval(() => {
        smsCountdown--;
        if (smsCountdown > 0) {
            btn.textContent = `${smsCountdown}秒后重试`;
        } else {
            clearInterval(smsTimer);
            btn.textContent = '获取验证码';
            btn.disabled = false;
        }
    }, 1000);
}

async function parseApiResponse(response) {
    const text = await response.text();

    let result = {};
    if (text) {
        try {
            result = JSON.parse(text);
        } catch (error) {
            throw new Error(response.ok ? '服务器返回数据格式异常' : `服务器异常（${response.status}）`);
        }
    }

    if (!response.ok) {
        const message = result.message || result.detail?.message || result.detail || `请求失败（${response.status}）`;
        throw new Error(message);
    }

    return result;
}

// 处理登录
async function handleLogin() {
    const agreement = document.getElementById('loginAgreement').checked;

    if (!agreement) {
        showToast('请先阅读并同意用户协议和隐私政策', 'error');
        return;
    }

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username) {
        showToast('请输入用户名或手机号', 'error');
        return;
    }
    if (!password) {
        showToast('请输入密码', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('密码至少6位', 'error');
        return;
    }

    const loginData = { username, password, type: 'password' };

    try {
        const btn = document.getElementById('loginSubmitBtn');
        btn.disabled = true;
        btn.textContent = '登录中...';

        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });

        const result = await response.json();
        
        if (result.code === 0) {
            showToast('登录成功', 'success');
            // 保存登录信息
            localStorage.setItem('userInfo', JSON.stringify(result.data));
            localStorage.setItem('token', result.data.token);
            
            // 跳转到主页
            setTimeout(() => {
                window.location.href = PAGE_URLS.client;
            }, 1000);
        } else {
            showToast(result.message || '登录失败', 'error');
            btn.disabled = false;
            btn.textContent = '登录';
        }
    } catch (error) {
        console.error('登录失败:', error.message || error);
        console.error('错误详情:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showToast(error.message || '登录失败，请重试', 'error');
        const btn = document.getElementById('loginSubmitBtn');
        btn.disabled = false;
        btn.textContent = '登录';
    }
}

// 处理注册
async function handleRegister() {
    const username = document.getElementById('registerUsername').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const agreement = document.getElementById('registerAgreement').checked;

    // 验证表单
    if (!username) {
        showToast('请输入用户名', 'error');
        return;
    }
    if (username.length < 2 || username.length > 20) {
        showToast('用户名长度为2-20个字符', 'error');
        return;
    }
    if (!phone) {
        showToast('请输入手机号', 'error');
        return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        showToast('请输入正确的手机号', 'error');
        return;
    }
    if (!password) {
        showToast('请输入密码', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('密码至少6位', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('两次密码输入不一致', 'error');
        return;
    }
    if (!agreement) {
        showToast('请先阅读并同意用户协议和隐私政策', 'error');
        return;
    }

    try {
        const btn = document.getElementById('registerSubmitBtn');
        btn.disabled = true;
        btn.textContent = '注册中...';

        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                phone,
                sms_code: '000000',
                password
            })
        });

        const result = await parseApiResponse(response);
        
        if (result.code === 0) {
            showToast('注册成功，即将跳转登录', 'success');
            
            // 清空表单
            document.getElementById('registerUsername').value = '';
            document.getElementById('registerPhone').value = '';
            document.getElementById('registerPassword').value = '';
            document.getElementById('registerConfirmPassword').value = '';
            document.getElementById('registerAgreement').checked = false;
            
            // 切换到登录页面
            setTimeout(() => {
                switchTab('login');
                document.getElementById('loginUsername').value = username;
            }, 1500);
        } else {
            showToast(result.message || '注册失败', 'error');
        }
        
        btn.disabled = false;
        btn.textContent = '注册';
    } catch (error) {
        console.error('注册失败:', error.message || error);
        showToast(error.message || '注册失败，请重试', 'error');
        const btn = document.getElementById('registerSubmitBtn');
        btn.disabled = false;
        btn.textContent = '注册';
    }
}

// 检查登录状态
function checkLoginStatus() {
    const userInfo = localStorage.getItem('userInfo');
    const token = localStorage.getItem('token');
    
    if (userInfo && token) {
        // 已登录，跳转到主页
        window.location.href = PAGE_URLS.client;
    }
}

// 显示提示消息
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// 调试验证码工具已下线，避免在正式界面暴露开发入口
window.debugSmsCode = undefined;

// 导出函数供其他页面使用
window.logout = function() {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('token');
    window.location.href = PAGE_URLS.login;
};

window.checkAuth = function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = PAGE_URLS.login;
        return false;
    }
    return true;
};
