// ===== 农村跑腿管理控制台 JS =====
const APP_CONFIG = window.__APP_CONFIG__ || {};
const API_BASE = (APP_CONFIG.apiBase || '/api').replace(/\/$/, '');

function buildApiUrl(url) {
    if (!url) return API_BASE;
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/api/')) return `${API_BASE}${url.slice(4)}`;
    if (url === '/api') return API_BASE;
    if (url.startsWith('/')) return `${API_BASE}${url}`;
    return `${API_BASE}/${url}`;
}

// ===== 全局状态 =====
let adminInfo = null;
let currentPage = 'dashboard';
let confirmCallback = null;

// 分页状态
const pageState = {
    orders: { page: 1, pageSize: 15, total: 0, search: '', status: '', urgent: '' },
    users: { page: 1, pageSize: 15, total: 0, search: '', status: '' },
    withdraw: { page: 1, pageSize: 15, total: 0, status: 'pending' },
    earnings: { page: 1, pageSize: 15, total: 0, search: '', type: '', status: '' },
    reviews: { page: 1, pageSize: 15, total: 0 },
    feedback: { page: 1, pageSize: 15, total: 0, status: 'pending' },
};

function getAdminToken() {
    return localStorage.getItem('adminToken') || adminInfo?.token || '';
}

function persistAdminSession(data) {
    const token = data?.token || getAdminToken();
    adminInfo = { ...(data || {}) };
    if (token) {
        adminInfo.token = token;
        localStorage.setItem('adminToken', token);
    }

    const storedInfo = { ...adminInfo };
    delete storedInfo.token;
    localStorage.setItem('adminInfo', JSON.stringify(storedInfo));
}

function clearAdminSession() {
    adminInfo = null;
    localStorage.removeItem('adminInfo');
    localStorage.removeItem('adminToken');
}

// ===== API 请求封装 =====
async function api(method, url, data = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAdminToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const opts = { method, headers };
    if (data) opts.body = JSON.stringify(data);

    try {
        const res = await fetch(buildApiUrl(url), opts);
        let payload = {};
        try {
            payload = await res.json();
        } catch (_) {
            payload = {};
        }

        if (res.status === 401) {
            clearAdminSession();
            return { code: 1, message: payload.detail || payload.message || '管理员未登录或登录已过期', unauthorized: true };
        }

        if (res.status === 403) {
            return { code: 1, message: payload.detail || payload.message || '没有权限执行该操作', forbidden: true };
        }

        return payload;
    } catch (e) {
        console.error('API Error:', e);
        return { code: 1, message: '网络请求失败' };
    }
}

// ===== Toast 提示 =====
function showToast(msg, type = 'success') {
    const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span class="toast-msg">${msg}</span><span class="toast-close"><i class="fas fa-times"></i></span>`;
    container.appendChild(toast);
    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    setTimeout(() => removeToast(toast), 3500);
}
function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}

// ===== 确认弹窗 =====
function showConfirm(title, message, callback, showReason = false) {
    document.getElementById('confirmTitle').innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${title}`;
    document.getElementById('confirmMessage').textContent = message;
    const reasonGroup = document.getElementById('confirmReasonGroup');
    const reasonInput = document.getElementById('confirmReason');
    if (showReason) { reasonGroup.classList.remove('hidden'); reasonInput.value = ''; }
    else { reasonGroup.classList.add('hidden'); }
    confirmCallback = () => callback(showReason ? reasonInput.value : null);
    openModal('confirmModal');
}

// ===== 弹窗控制 =====
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ===== 时间格式化 =====
function formatTime(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function formatDate(ts) {
    if (!ts) return '--';
    const d = new Date(ts);
    if (isNaN(d)) return ts;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ===== 状态徽章 =====
function orderStatusBadge(status) {
    const map = { pending: ['badge-pending', '待接单'], ongoing: ['badge-ongoing', '进行中'], completed: ['badge-completed', '已完成'], cancelled: ['badge-cancelled', '已取消'] };
    const [cls, txt] = map[status] || ['badge-cancelled', status];
    return `<span class="badge ${cls}">${txt}</span>`;
}
function earningStatusBadge(status) {
    const map = { pending: ['badge-pending', '待结算'], completed: ['badge-completed', '已完成'], rejected: ['badge-rejected', '已拒绝'] };
    const [cls, txt] = map[status] || ['badge-cancelled', status];
    return `<span class="badge ${cls}">${txt}</span>`;
}
function withdrawStatusBadge(status) {
    const map = {
        pending: ['badge-pending', '待审核'],
        approved: ['badge-completed', '已通过'],
        rejected: ['badge-rejected', '已拒绝']
    };
    const [cls, txt] = map[status] || ['badge-cancelled', status];
    return `<span class="badge ${cls}">${txt}</span>`;
}
function userStatusBadge(status) {
    return status === 'banned' ? `<span class="badge badge-banned">已封禁</span>` : `<span class="badge badge-active">正常</span>`;
}
function roleBadge(role) {
    const map = { super: ['badge-super', '超级管理员'], admin: ['badge-admin', '普通管理员'], finance: ['badge-finance', '财务专员'] };
    const [cls, txt] = map[role] || ['badge-admin', role];
    return `<span class="badge ${cls}">${txt}</span>`;
}
function starsHtml(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<i class="fas fa-star ${i <= rating ? 'stars' : 'stars-empty'}"></i>`;
    return s;
}

// ===== 分页渲染 =====
function renderPagination(containerId, state, loadFn) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const totalPages = Math.ceil(state.total / state.pageSize) || 1;
    if (totalPages <= 1 && state.total <= state.pageSize) { container.innerHTML = ''; return; }
    let html = `<span class="page-info">共 ${state.total} 条</span>`;
    html += `<button class="page-btn" ${state.page <= 1 ? 'disabled' : ''} data-p="${state.page - 1}"><i class="fas fa-chevron-left"></i></button>`;
    const start = Math.max(1, state.page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) {
        html += `<button class="page-btn ${i === state.page ? 'active' : ''}" data-p="${i}">${i}</button>`;
    }
    html += `<button class="page-btn" ${state.page >= totalPages ? 'disabled' : ''} data-p="${state.page + 1}"><i class="fas fa-chevron-right"></i></button>`;
    container.innerHTML = html;
    container.querySelectorAll('.page-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => { state.page = parseInt(btn.dataset.p); loadFn(); });
    });
}

// ===== 用户头像 =====
function avatarHtml(user, size = 'sm') {
    const name = (user?.name || user?.username || '?')[0].toUpperCase();
    if (user?.avatar) {
        return `<div class="user-avatar-${size}"><img src="${user.avatar}" onerror="this.parentElement.innerHTML='${name}'"></div>`;
    }
    return `<div class="user-avatar-${size}">${name}</div>`;
}

// ===== 登录逻辑 =====
function initLogin() {
    const loginBtn = document.getElementById('loginBtn');
    const usernameInput = document.getElementById('adminUsername');
    const passwordInput = document.getElementById('adminPassword');
    const togglePwd = document.getElementById('togglePwd');
    const loginError = document.getElementById('loginError');

    togglePwd.addEventListener('click', () => {
        const isText = passwordInput.type === 'text';
        passwordInput.type = isText ? 'password' : 'text';
        togglePwd.innerHTML = `<i class="fas fa-eye${isText ? '-slash' : ''}"></i>`;
    });

    async function doLogin() {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (!username || !password) {
            loginError.textContent = '请输入账号和密码';
            loginError.classList.remove('hidden');
            return;
        }
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 登录中...';
        const res = await api('POST', '/api/admin/login', { username, password });
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 登录';
        if (res.code === 0) {
            persistAdminSession(res.data);
            loginError.classList.add('hidden');
            enterPanel();
        } else {
            loginError.textContent = res.detail || res.message || '账号或密码错误';
            loginError.classList.remove('hidden');
        }
    }

    async function restoreSession() {
        const cachedInfo = localStorage.getItem('adminInfo');
        const cachedToken = localStorage.getItem('adminToken');
        if (!cachedToken) {
            clearAdminSession();
            return;
        }

        if (cachedInfo) {
            try {
                adminInfo = { ...JSON.parse(cachedInfo), token: cachedToken };
            } catch {
                clearAdminSession();
            }
        }

        const res = await api('GET', '/api/admin/me');
        if (res.code === 0) {
            persistAdminSession({ ...res.data, token: cachedToken });
            enterPanel();
        } else {
            clearAdminSession();
        }
    }

    loginBtn.addEventListener('click', doLogin);
    [usernameInput, passwordInput].forEach(el => el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
    restoreSession();
}

function enterPanel() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainPanel').classList.remove('hidden');
    const name = adminInfo?.name || adminInfo?.username || '管理员';
    const role = adminInfo?.role || 'admin';
    document.getElementById('sidebarAdminName').textContent = name;
    document.getElementById('sidebarAdminRole').textContent = { super: '超级管理员', admin: '普通管理员', finance: '财务专员' }[role] || '管理员';
    document.getElementById('topbarAdminName').textContent = name;
    const initial = name[0].toUpperCase();
    document.getElementById('sidebarAvatar').textContent = initial;
    document.getElementById('topbarAvatar').textContent = initial;
    navigateTo('dashboard');
    startClock();
    loadBadgeCounts();
}

// ===== 导航 =====
function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const pageEl = document.getElementById(`page-${page}`);
    if (pageEl) pageEl.classList.remove('hidden');

    const breadcrumbMap = {
        dashboard: '数据总览', orders: '订单管理', users: '用户管理',
        withdraw: '提现审核', earnings: '收益流水', reviews: '评价管理',
        feedback: '反馈建议', permissions: '权限设置', settings: '系统配置'
    };
    document.getElementById('breadcrumb').innerHTML = `<i class="fas fa-home"></i> ${breadcrumbMap[page] || page}`;

    const loaders = {
        dashboard: loadDashboard, orders: loadOrders, users: loadUsers,
        withdraw: loadWithdraw, earnings: loadEarnings, reviews: loadReviews,
        feedback: loadFeedback, permissions: loadPermissions, settings: loadSettings
    };
    if (loaders[page]) loaders[page]();
}

// ===== 时钟 =====
function startClock() {
    const el = document.getElementById('topbarClock');
    function tick() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        el.textContent = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    tick();
    setInterval(tick, 1000);
}

// ===== 徽章数量 =====
async function loadBadgeCounts() {
    const res = await api('GET', '/api/admin/badge-counts');
    if (res.code === 0) {
        const { pending_orders, pending_withdraw } = res.data;
        const pb = document.getElementById('pendingBadge');
        const wb = document.getElementById('withdrawBadge');
        if (pending_orders > 0) { pb.textContent = pending_orders; pb.style.display = ''; }
        if (pending_withdraw > 0) { wb.textContent = pending_withdraw; wb.style.display = ''; }
    }
}

// ===== 数据总览 =====
async function loadDashboard() {
    const res = await api('GET', '/api/admin/dashboard');
    if (res.code !== 0) { showToast('加载数据失败', 'error'); return; }
    const d = res.data;
    document.getElementById('stat-today-orders').textContent = d.today_orders ?? '--';
    document.getElementById('stat-pending-orders').textContent = d.pending_orders ?? '--';
    document.getElementById('stat-total-users').textContent = d.total_users ?? '--';
    document.getElementById('stat-total-orders').textContent = d.total_orders ?? '--';
    document.getElementById('stat-total-earnings').textContent = d.total_earnings != null ? `¥${parseFloat(d.total_earnings).toFixed(0)}` : '--';
    document.getElementById('stat-pending-withdraw').textContent = d.pending_withdraw ?? '--';

    renderOrderTrendChart(d.order_trend || []);
    renderStatusPieChart(d.status_dist || {});
    renderEarningsTrendChart(d.earnings_trend || []);
    renderRecentOrders(d.recent_orders || []);
}

function renderOrderTrendChart(data) {
    const el = document.getElementById('chart-orders');
    if (!el) return;
    const chart = echarts.init(el);
    const dates = data.map(d => d.date);
    const counts = data.map(d => d.count);
    chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 40, right: 20, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', minInterval: 1, axisLabel: { fontSize: 11 } },
        series: [{
            type: 'bar', data: counts, barMaxWidth: 40,
            itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#34d399' }] }, borderRadius: [4, 4, 0, 0] },
            emphasis: { itemStyle: { color: '#059669' } }
        }]
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderStatusPieChart(data) {
    const el = document.getElementById('chart-status');
    if (!el) return;
    const chart = echarts.init(el);
    const pieData = [
        { name: '待接单', value: data.pending || 0, itemStyle: { color: '#f59e0b' } },
        { name: '进行中', value: data.ongoing || 0, itemStyle: { color: '#3b82f6' } },
        { name: '已完成', value: data.completed || 0, itemStyle: { color: '#10b981' } },
        { name: '已取消', value: data.cancelled || 0, itemStyle: { color: '#94a3b8' } },
    ].filter(d => d.value > 0);
    chart.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
            type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
            data: pieData.length ? pieData : [{ name: '暂无数据', value: 1, itemStyle: { color: '#e2e8f0' } }],
            label: { show: false }, emphasis: { label: { show: true, fontSize: 12 } }
        }]
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderEarningsTrendChart(data) {
    const el = document.getElementById('chart-earnings');
    if (!el) return;
    const chart = echarts.init(el);
    chart.setOption({
        tooltip: { trigger: 'axis', formatter: params => `${params[0].name}<br/>¥${params[0].value}` },
        grid: { left: 50, right: 20, top: 20, bottom: 30 },
        xAxis: { type: 'category', data: data.map(d => d.date), axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', axisLabel: { fontSize: 11, formatter: v => `¥${v}` } },
        series: [{
            type: 'line', data: data.map(d => d.amount), smooth: true,
            lineStyle: { color: '#10b981', width: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(16,185,129,.3)' }, { offset: 1, color: 'rgba(16,185,129,.02)' }] } },
            symbol: 'circle', symbolSize: 6, itemStyle: { color: '#10b981' }
        }]
    });
    window.addEventListener('resize', () => chart.resize());
}

function renderRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersBody');
    if (!orders.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">暂无订单数据</td></tr>'; return; }
    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">#${o.id}</span></td>
            <td>${o.title || '--'}</td>
            <td><div class="user-cell">${avatarHtml(o.user)}<div><div class="user-cell-name">${o.user?.name || '--'}</div></div></div></td>
            <td><strong style="color:#10b981">¥${parseFloat(o.fee||0).toFixed(2)}</strong></td>
            <td>${orderStatusBadge(o.status)}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(o.created_at)}</td>
            <td><button class="action-btn action-btn-primary" onclick="viewOrderDetail(${o.id})"><i class="fas fa-eye"></i> 详情</button></td>
        </tr>
    `).join('');
}

// ===== 订单管理 =====
async function loadOrders() {
    const s = pageState.orders;
    const params = new URLSearchParams({ page: s.page, page_size: s.pageSize, search: s.search, status: s.status, urgent: s.urgent });
    const res = await api('GET', `/api/admin/orders?${params}`);
    if (res.code !== 0) { showToast('加载订单失败', 'error'); return; }
    s.total = res.data.total;
    const tbody = document.getElementById('ordersTableBody');
    if (!res.data.items.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-row">暂无订单数据</td></tr>'; renderPagination('ordersPagination', s, loadOrders); return; }
    tbody.innerHTML = res.data.items.map(o => `
        <tr>
            <td>
                <span style="font-family:monospace;color:#64748b">#${o.id}</span>
                ${o.order_number ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px">${o.order_number}</div>` : ''}
            </td>
            <td><div style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.title}">${o.title}</div></td>
            <td><div class="user-cell">${avatarHtml(o.user)}<div class="user-cell-name">${o.user?.name || '--'}</div></div></td>
            <td>${o.runner ? `<div class="user-cell">${avatarHtml(o.runner)}<div class="user-cell-name">${o.runner.name}</div></div>` : '<span style="color:#94a3b8">未接单</span>'}</td>
            <td><strong style="color:#10b981">¥${parseFloat(o.fee||0).toFixed(2)}</strong></td>
            <td>${o.is_urgent ? '<span class="badge badge-urgent">加急</span>' : '<span style="color:#94a3b8">普通</span>'}</td>
            <td>${orderStatusBadge(o.status)}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(o.created_at)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn action-btn-primary" onclick="viewOrderDetail(${o.id})"><i class="fas fa-eye"></i></button>
                    ${['pending','ongoing'].includes(o.status) ? `<button class="action-btn action-btn-danger" onclick="cancelOrder(${o.id})"><i class="fas fa-ban"></i></button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination('ordersPagination', s, loadOrders);
}

async function viewOrderDetail(orderId) {
    const res = await api('GET', `/api/orders/${orderId}`);
    if (res.code !== 0) { showToast('加载订单详情失败', 'error'); return; }
    const o = res.data;
    document.getElementById('orderDetailContent').innerHTML = `
        <div class="order-detail-grid">
            <div class="detail-section">
                <h4><i class="fas fa-info-circle" style="color:#10b981;margin-right:6px"></i>基本信息</h4>
                <div class="detail-row"><span class="detail-label">订单ID</span><span class="detail-value">#${o.id}</span></div>
                ${o.order_number ? `<div class="detail-row"><span class="detail-label">订单编号</span><span class="detail-value" style="font-family:monospace">${o.order_number}</span></div>` : ''}
                <div class="detail-row"><span class="detail-label">订单标题</span><span class="detail-value">${o.title}</span></div>
                <div class="detail-row"><span class="detail-label">配送费用</span><span class="detail-value" style="color:#10b981;font-size:16px">¥${parseFloat(o.fee||0).toFixed(2)}</span></div>
                <div class="detail-row"><span class="detail-label">订单状态</span><span class="detail-value">${orderStatusBadge(o.status)}</span></div>
                <div class="detail-row"><span class="detail-label">是否加急</span><span class="detail-value">${o.is_urgent ? '<span class="badge badge-urgent">加急</span>' : '普通'}</span></div>
                <div class="detail-row"><span class="detail-label">支付方式</span><span class="detail-value">${o.payment_method === 'cash' ? '现金到付' : '在线支付'}</span></div>
                <div class="detail-row"><span class="detail-label">发布时间</span><span class="detail-value">${formatTime(o.created_at)}</span></div>
                ${o.cancelled_at ? `<div class="detail-row"><span class="detail-label">取消时间</span><span class="detail-value">${formatTime(o.cancelled_at)}</span></div>` : ''}
                ${o.cancel_reason ? `<div class="detail-row"><span class="detail-label">取消原因</span><span class="detail-value">${o.cancel_reason}</span></div>` : ''}
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-map-marker-alt" style="color:#10b981;margin-right:6px"></i>地址信息</h4>
                <div class="detail-row"><span class="detail-label">取件地址</span><span class="detail-value">${o.pickup_address}</span></div>
                <div class="detail-row"><span class="detail-label">送达地址</span><span class="detail-value">${o.delivery_address}</span></div>
                <div class="detail-row"><span class="detail-label">配送距离</span><span class="detail-value">${o.distance ? o.distance + ' km' : '--'}</span></div>
                <div class="detail-row"><span class="detail-label">期望时间</span><span class="detail-value">${o.delivery_time || '--'}</span></div>
                ${o.remark ? `<div class="detail-row"><span class="detail-label">备注</span><span class="detail-value">${o.remark}</span></div>` : ''}
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-user" style="color:#10b981;margin-right:6px"></i>发布者</h4>
                ${o.user ? `
                    <div class="detail-row"><span class="detail-label">用户名</span><span class="detail-value">${o.user.name}</span></div>
                    <div class="detail-row"><span class="detail-label">手机号</span><span class="detail-value">${o.user.phone || '--'}</span></div>
                ` : '<div style="color:#94a3b8;font-size:13px">用户信息不可用</div>'}
            </div>
            <div class="detail-section">
                <h4><i class="fas fa-running" style="color:#10b981;margin-right:6px"></i>跑腿员</h4>
                ${o.runner ? `
                    <div class="detail-row"><span class="detail-label">用户名</span><span class="detail-value">${o.runner.name}</span></div>
                    <div class="detail-row"><span class="detail-label">手机号</span><span class="detail-value">${o.runner.phone || '--'}</span></div>
                    <div class="detail-row"><span class="detail-label">评分</span><span class="detail-value">${starsHtml(Math.round(o.runner.rating || 5))}</span></div>
                ` : '<div style="color:#94a3b8;font-size:13px">暂未接单</div>'}
            </div>
        </div>
    `;
    const cancelBtn = document.getElementById('orderCancelBtn');
    if (['pending', 'ongoing'].includes(o.status)) {
        cancelBtn.classList.remove('hidden');
        cancelBtn.onclick = () => { closeModal('orderDetailModal'); cancelOrder(o.id); };
    } else {
        cancelBtn.classList.add('hidden');
    }
    openModal('orderDetailModal');
}

function cancelOrder(orderId) {
    showConfirm('强制取消订单', `确认强制取消订单 #${orderId}？此操作不可撤销。`, async (reason) => {
        const res = await api('PUT', `/api/admin/orders/${orderId}/cancel`, { reason: reason || '管理员强制取消' });
        closeModal('confirmModal');
        if (res.code === 0) { showToast('订单已取消'); loadOrders(); loadBadgeCounts(); }
        else showToast(res.message || '操作失败', 'error');
    }, true);
}

// ===== 用户管理 =====
let currentViewUserId = null; // 记录当前查看的用户ID
let currentViewUserName = null; // 记录当前查看的用户名
let currentViewUserBalance = 0; // 记录当前查看的用户余额
async function loadUsers() {
    const s = pageState.users;
    const params = new URLSearchParams({ page: s.page, page_size: s.pageSize, search: s.search, status: s.status });
    const res = await api('GET', `/api/admin/users?${params}`);
    if (res.code !== 0) { showToast('加载用户失败', 'error'); return; }
    s.total = res.data.total;
    const tbody = document.getElementById('usersTableBody');
    if (!res.data.items.length) { tbody.innerHTML = '<tr><td colspan="11" class="empty-row">暂无用户数据</td></tr>'; renderPagination('usersPagination', s, loadUsers); return; }
    tbody.innerHTML = res.data.items.map(u => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">${u.id}</span></td>
            <td>${avatarHtml(u)}</td>
            <td><div class="user-cell-name">${u.name || u.username}</div></td>
            <td style="font-family:monospace;font-size:12px">${u.phone || '--'}</td>
            <td>${u.location || '--'}</td>
            <td>${u.total_orders || 0}</td>
            <td><span style="color:#10b981;font-weight:600">¥${parseFloat(u.total_earnings||0).toFixed(2)}</span></td>
            <td>${starsHtml(Math.round(u.rating || 5))} <span style="font-size:11px;color:#94a3b8">${parseFloat(u.rating||5).toFixed(1)}</span></td>
            <td>${userStatusBadge(u.status)}</td>
            <td style="color:#94a3b8;font-size:12px">${formatDate(u.created_at)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn action-btn-primary" onclick="viewUserDetail(${u.id})" title="查看"><i class="fas fa-eye"></i></button>
                    <button class="action-btn action-btn-warning" onclick="openEditUserModal(${u.id})" title="编辑"><i class="fas fa-pen"></i></button>
                    ${u.status === 'banned'
                        ? `<button class="action-btn action-btn-success" onclick="toggleUserStatus(${u.id},'active')" title="解封"><i class="fas fa-unlock"></i></button>`
                        : `<button class="action-btn action-btn-danger" onclick="toggleUserStatus(${u.id},'banned')" title="封禁"><i class="fas fa-ban"></i></button>`
                    }
                    <button class="action-btn action-btn-danger" onclick="deleteUser(${u.id}, ${JSON.stringify(u.name || u.username || '').replace(/"/g, '&quot;')})" title="删除"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination('usersPagination', s, loadUsers);
}

async function viewUserDetail(userId) {
    const res = await api('GET', `/api/admin/users/${userId}`);
    if (res.code !== 0) { showToast('加载用户详情失败', 'error'); return; }
    const u = res.data;
    currentViewUserId = userId;
    currentViewUserName = u.name || u.username || u.phone || `用户${userId}`;
    currentViewUserBalance = parseFloat(u.pending_earnings || 0);
    document.getElementById('userDetailContent').innerHTML = `
        <div class="user-detail-header">
            <div class="user-detail-avatar">${u.avatar ? `<img src="${u.avatar}">` : (u.name||u.username||'?')[0].toUpperCase()}</div>
            <div>
                <div class="user-detail-name">${u.name || u.username}</div>
                <div class="user-detail-phone">${u.phone || '--'} &nbsp;|&nbsp; ${u.location || '未知位置'}</div>
                <div style="margin-top:6px">${userStatusBadge(u.status)}</div>
            </div>
        </div>
        <div class="user-stats-grid">
            <div class="user-stat-item"><div class="user-stat-value">${u.total_orders || 0}</div><div class="user-stat-label">完成订单</div></div>
            <div class="user-stat-item"><div class="user-stat-value" style="color:#10b981">¥${parseFloat(u.total_earnings||0).toFixed(0)}</div><div class="user-stat-label">总收益</div></div>
            <div class="user-stat-item"><div class="user-stat-value">${parseFloat(u.rating||5).toFixed(1)}</div><div class="user-stat-label">评分</div></div>
            <div class="user-stat-item"><div class="user-stat-value">${parseFloat(u.good_rate||100).toFixed(0)}%</div><div class="user-stat-label">好评率</div></div>
        </div>
        <div class="detail-section">
            <h4>账号信息</h4>
            <div class="detail-row"><span class="detail-label">用户ID</span><span class="detail-value">${u.id}</span></div>
            <div class="detail-row"><span class="detail-label">用户名</span><span class="detail-value">${u.username}</span></div>
            <div class="detail-row"><span class="detail-label">手机号</span><span class="detail-value">${u.phone || '--'}</span></div>
            <div class="detail-row"><span class="detail-label">注册时间</span><span class="detail-value">${formatTime(u.created_at)}</span></div>
            <div class="detail-row"><span class="detail-label">本月收益</span><span class="detail-value" style="color:#10b981">¥${parseFloat(u.month_earnings||0).toFixed(2)}</span></div>
            <div class="detail-row"><span class="detail-label">可提现余额</span><span class="detail-value" style="color:#f59e0b;font-weight:600">¥${parseFloat(u.pending_earnings||0).toFixed(2)}</span></div>
        </div>
    `;
    openModal('userDetailModal');
}

function openAdjustBalanceModal() {
    if (!currentViewUserId) return;
    document.getElementById('adjustBalanceUserName').textContent = currentViewUserName || `用户${currentViewUserId}`;
    document.getElementById('adjustBalanceCurrentAmount').textContent = `¥${currentViewUserBalance.toFixed(2)}`;
    document.getElementById('adjustBalanceAmount').value = '';
    document.getElementById('adjustBalanceReason').value = '';
    document.getElementById('adjustTypeAdd').checked = true;
    openModal('adjustBalanceModal');
}

async function adjustUserBalance() {
    const amount = parseFloat(document.getElementById('adjustBalanceAmount').value);
    const reason = document.getElementById('adjustBalanceReason').value.trim();
    const type = document.querySelector('input[name="adjustType"]:checked').value;
    if (!amount || amount <= 0) { showToast('请输入有效金额', 'warning'); return; }
    if (!reason) { showToast('请输入调整原因', 'warning'); return; }
    const btn = document.getElementById('adjustBalanceSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    const res = await api('PUT', `/api/admin/users/${currentViewUserId}/adjust-balance`, { amount, reason, type });
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> 确认调整';
    if (res.code === 0) {
        showToast(res.message || '余额调整成功');
        closeModal('adjustBalanceModal');
        viewUserDetail(currentViewUserId);
        loadUsers();
    } else {
        showToast(res.message || '调整失败', 'error');
    }
}

function openResetPasswordModal() {
    if (!currentViewUserId) return;
    document.getElementById('resetPwdUserName').textContent = currentViewUserName || `用户${currentViewUserId}`;
    document.getElementById('resetUserNewPwd').value = '';
    document.getElementById('resetUserConfirmPwd').value = '';
    openModal('resetUserPasswordModal');
}

async function resetUserPassword() {
    const newPwd = document.getElementById('resetUserNewPwd').value;
    const confirmPwd = document.getElementById('resetUserConfirmPwd').value;
    if (!newPwd) { showToast('请输入新密码', 'warning'); return; }
    if (newPwd.length < 6) { showToast('密码长度不能少于6位', 'warning'); return; }
    if (newPwd !== confirmPwd) { showToast('两次输入的密码不一致', 'warning'); return; }
    const btn = document.getElementById('resetUserPwdSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 处理中...';
    const res = await api('PUT', `/api/admin/users/${currentViewUserId}/reset-password`, { new_password: newPwd });
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> 确认修改';
    if (res.code === 0) {
        showToast(res.message || '密码修改成功');
        closeModal('resetUserPasswordModal');
    } else {
        showToast(res.message || '密码修改失败', 'error');
    }
}

function toggleUserStatus(userId, newStatus) {
    const action = newStatus === 'banned' ? '封禁' : '解封';
    showConfirm(`${action}用户`, `确认${action}该用户？`, async () => {
        const res = await api('PUT', `/api/admin/users/${userId}/status`, { status: newStatus });
        closeModal('confirmModal');
        if (res.code === 0) { showToast(`用户已${action}`); loadUsers(); }
        else showToast(res.message || '操作失败', 'error');
    });
}

// ===== 用户：新增 / 编辑 / 删除 =====
function openCreateUserModal() {
    document.getElementById('userFormTitle').textContent = '新增用户';
    document.getElementById('userFormId').value = '';
    document.getElementById('userFormName').value = '';
    document.getElementById('userFormPhone').value = '';
    document.getElementById('userFormLocation').value = '';
    document.getElementById('userFormStatus').value = 'active';
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormPasswordLabel').textContent = '登录密码 *';
    document.getElementById('userFormPasswordHint').style.display = 'none';
    document.getElementById('userFormPassword').placeholder = '至少 6 位，使用 bcrypt 加密存储';
    openModal('userFormModal');
}

async function openEditUserModal(userId) {
    const res = await api('GET', `/api/admin/users/${userId}`);
    if (res.code !== 0) { showToast(res.message || '加载用户信息失败', 'error'); return; }
    const u = res.data || {};
    document.getElementById('userFormTitle').textContent = '编辑用户';
    document.getElementById('userFormId').value = userId;
    document.getElementById('userFormName').value = u.name || u.username || '';
    document.getElementById('userFormPhone').value = u.phone || '';
    document.getElementById('userFormLocation').value = u.location || '';
    document.getElementById('userFormStatus').value = u.status === 'banned' ? 'banned' : 'active';
    document.getElementById('userFormPassword').value = '';
    document.getElementById('userFormPasswordLabel').textContent = '重置密码（可选）';
    document.getElementById('userFormPassword').placeholder = '留空则不修改密码';
    document.getElementById('userFormPasswordHint').style.display = 'block';
    openModal('userFormModal');
}

async function submitUserForm() {
    const id = document.getElementById('userFormId').value.trim();
    const name = document.getElementById('userFormName').value.trim();
    const phone = document.getElementById('userFormPhone').value.trim();
    const location = document.getElementById('userFormLocation').value.trim();
    const status = document.getElementById('userFormStatus').value;
    const password = document.getElementById('userFormPassword').value;

    if (name.length < 2 || name.length > 20) { showToast('用户名长度需在 2-20 个字符', 'warning'); return; }
    if (!phone || phone.length < 6) { showToast('请输入有效的手机号', 'warning'); return; }
    if (!id && (!password || password.length < 6)) { showToast('密码至少 6 位', 'warning'); return; }
    if (id && password && password.length < 6) { showToast('新密码至少 6 位', 'warning'); return; }

    const btn = document.getElementById('userFormSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';

    const payload = { name, phone, location, status };
    if (password) payload.password = password;

    const res = id
        ? await api('PUT', `/api/admin/users/${id}`, payload)
        : await api('POST', '/api/admin/users', payload);

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> 保存';

    if (res.code === 0) {
        showToast(res.message || (id ? '用户已更新' : '用户已创建'));
        closeModal('userFormModal');
        loadUsers();
    } else {
        showToast(res.message || '保存失败', 'error');
    }
}

function deleteUser(userId, userName) {
    const tip = userName ? `确认删除用户「${userName}」吗？` : '确认删除该用户吗？';
    showConfirm(
        '删除用户',
        `${tip}<br><span style="color:#ef4444;font-size:12px">删除后将一并清除该用户的订单、收益和提现记录，且不可恢复。</span>`,
        async () => {
            const res = await api('DELETE', `/api/admin/users/${userId}`);
            closeModal('confirmModal');
            if (res.code === 0) { showToast(res.message || '用户已删除'); loadUsers(); }
            else showToast(res.message || '删除失败', 'error');
        },
        true
    );
}

// ===== 提现审核 =====
async function loadWithdrawStats() {
    const res = await api('GET', '/api/admin/withdrawals/stats');
    if (res.code !== 0) return;
    const d = res.data;
    document.getElementById('ws-pending-amount').textContent = `¥${parseFloat(d.pending_amount||0).toFixed(2)}`;
    document.getElementById('ws-pending-count').textContent = `${d.pending_count} 笔`;
    document.getElementById('ws-approved-amount').textContent = `¥${parseFloat(d.approved_amount||0).toFixed(2)}`;
    document.getElementById('ws-approved-count').textContent = `${d.approved_count} 笔`;
    document.getElementById('ws-today-amount').textContent = `¥${parseFloat(d.today_amount||0).toFixed(2)}`;
    document.getElementById('ws-today-count').textContent = `${d.today_count} 笔`;
    document.getElementById('ws-total-amount').textContent = `¥${parseFloat(d.total_amount||0).toFixed(2)}`;
    document.getElementById('ws-total-count').textContent = `${d.total_count} 笔`;
}

async function loadWithdraw() {
    loadWithdrawStats();
    const s = pageState.withdraw;
    const params = new URLSearchParams({ page: s.page, page_size: s.pageSize, status: s.status });
    const res = await api('GET', `/api/admin/withdrawals?${params}`);
    if (res.code !== 0) { showToast('加载提现记录失败', 'error'); return; }
    s.total = res.data.total;
    const tbody = document.getElementById('withdrawTableBody');
    if (!res.data.items.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty-row">暂无提现记录</td></tr>'; renderPagination('withdrawPagination', s, loadWithdraw); return; }
    tbody.innerHTML = res.data.items.map(w => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">${w.id}</span></td>
            <td><div class="user-cell">${avatarHtml(w.user)}<div><div class="user-cell-name">${w.user?.name || '--'}</div><div class="user-cell-phone">${w.user?.phone || ''}</div></div></div></td>
            <td><strong style="color:#10b981;font-size:16px">¥${parseFloat(w.amount||0).toFixed(2)}</strong></td>
            <td>${w.method || '微信'}</td>
            <td style="font-size:12px;color:#64748b">${w.account || '--'}</td>
            <td style="font-size:12px;color:#64748b;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${w.remark||''}">${w.remark || '<span style="color:#cbd5e1">无</span>'}</td>
            <td>${withdrawStatusBadge(w.status)}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(w.created_at)}</td>
            <td>
                <div class="action-btns">
                    ${w.status === 'pending' ? `
                        <button class="action-btn action-btn-success" onclick="reviewWithdraw(${w.id},'approved')"><i class="fas fa-check"></i> 通过</button>
                        <button class="action-btn action-btn-danger" onclick="reviewWithdraw(${w.id},'rejected')"><i class="fas fa-times"></i> 拒绝</button>
                    ` : `<span style="color:#94a3b8;font-size:12px">${w.review_reason ? `<span title="${w.review_reason}">已处理</span>` : '已处理'}</span>`}
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination('withdrawPagination', s, loadWithdraw);
}

function reviewWithdraw(id, action) {
    if (action === 'approved') {
        showConfirm('通过提现', `确认通过该提现申请？`, async () => {
            const res = await api('PUT', `/api/admin/withdrawals/${id}/review`, { action: 'approved', reason: '' });
            closeModal('confirmModal');
            if (res.code === 0) { showToast('已通过提现申请'); loadWithdraw(); loadBadgeCounts(); }
            else showToast(res.message || '操作失败', 'error');
        });
    } else {
        showConfirm('拒绝提现', `确认拒绝该提现申请？金额将退回用户账户。`, async (reason) => {
            const res = await api('PUT', `/api/admin/withdrawals/${id}/review`, { action: 'rejected', reason: reason || '审核不通过' });
            closeModal('confirmModal');
            if (res.code === 0) { showToast('已拒绝提现申请，金额已退回'); loadWithdraw(); loadBadgeCounts(); }
            else showToast(res.message || '操作失败', 'error');
        }, true);
    }
}

// ===== 收益流水 =====
async function loadEarnings() {
    const s = pageState.earnings;
    const params = new URLSearchParams({ page: s.page, page_size: s.pageSize, search: s.search, type: s.type, status: s.status });
    const res = await api('GET', `/api/admin/earnings?${params}`);
    if (res.code !== 0) { showToast('加载收益流水失败', 'error'); return; }
    s.total = res.data.total;
    const tbody = document.getElementById('earningsTableBody');
    if (!res.data.items.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">暂无收益记录</td></tr>'; renderPagination('earningsPagination', s, loadEarnings); return; }
    tbody.innerHTML = res.data.items.map(e => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">${e.id}</span></td>
            <td><div class="user-cell">${avatarHtml(e.user)}<div class="user-cell-name">${e.user?.name || '--'}</div></div></td>
            <td><span class="badge ${e.type === 'order' ? 'badge-ongoing' : 'badge-pending'}">${e.type === 'order' ? '订单收益' : '提现'}</span></td>
            <td><strong style="color:${e.type === 'withdraw' ? '#ef4444' : '#10b981'}">${e.type === 'withdraw' ? '-' : '+'}¥${parseFloat(e.amount||0).toFixed(2)}</strong></td>
            <td>${earningStatusBadge(e.status)}</td>
            <td>${e.order_id ? `<span style="font-family:monospace;color:#64748b">#${e.order_id}</span>` : '--'}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(e.created_at)}</td>
        </tr>
    `).join('');
    renderPagination('earningsPagination', s, loadEarnings);
}

// ===== 评价管理 =====
async function loadReviews() {
    const s = pageState.reviews;
    const params = new URLSearchParams({ page: s.page, page_size: s.pageSize });
    const res = await api('GET', `/api/admin/reviews?${params}`);
    if (res.code !== 0) { showToast('加载评价失败', 'error'); return; }
    s.total = res.data.total;
    const tbody = document.getElementById('reviewsTableBody');
    if (!res.data.items.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty-row">暂无评价数据</td></tr>'; renderPagination('reviewsPagination', s, loadReviews); return; }
    tbody.innerHTML = res.data.items.map(r => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">${r.id}</span></td>
            <td><div class="user-cell">${avatarHtml(r.user)}<div class="user-cell-name">${r.user?.name || '--'}</div></div></td>
            <td><div class="user-cell">${avatarHtml(r.runner)}<div class="user-cell-name">${r.runner?.name || '--'}</div></div></td>
            <td><span style="font-family:monospace;color:#64748b">#${r.order_id}</span></td>
            <td>${starsHtml(r.rating)} <span style="font-size:11px;color:#94a3b8">${r.rating}分</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.comment||''}">${r.comment || '<span style="color:#94a3b8">无评价内容</span>'}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(r.created_at)}</td>
            <td><button class="action-btn action-btn-danger" onclick="deleteReview(${r.id})"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    renderPagination('reviewsPagination', s, loadReviews);
}

function deleteReview(id) {
    showConfirm('删除评价', '确认删除该评价？此操作不可撤销。', async () => {
        const res = await api('DELETE', `/api/admin/reviews/${id}`);
        closeModal('confirmModal');
        if (res.code === 0) { showToast('评价已删除'); loadReviews(); }
        else showToast(res.message || '操作失败', 'error');
    });
}

// ===== 反馈建议 =====
async function loadFeedback() {
    const s = pageState.feedback;
    const params = new URLSearchParams({ page: s.page, page_size: s.pageSize, status: s.status });
    const res = await api('GET', `/api/admin/feedback?${params}`);
    if (res.code !== 0) { showToast('加载反馈失败', 'error'); return; }
    s.total = res.data.total;
    const tbody = document.getElementById('feedbackTableBody');
    if (!res.data.items.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">暂无反馈数据</td></tr>'; renderPagination('feedbackPagination', s, loadFeedback); return; }
    tbody.innerHTML = res.data.items.map(f => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">${f.id}</span></td>
            <td><div class="user-cell">${avatarHtml(f.user)}<div class="user-cell-name">${f.user?.name || '--'}</div></div></td>
            <td><span class="badge badge-ongoing">${f.type || '建议'}</span></td>
            <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${f.content}">${f.content}</td>
            <td>${f.status === 'processed' ? '<span class="badge badge-completed">已处理</span>' : '<span class="badge badge-pending">待处理</span>'}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(f.created_at)}</td>
            <td>
                <div class="action-btns">
                    ${f.status !== 'processed' ? `<button class="action-btn action-btn-success" onclick="processFeedback(${f.id})"><i class="fas fa-check"></i> 处理</button>` : ''}
                    <button class="action-btn action-btn-danger" onclick="deleteFeedback(${f.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination('feedbackPagination', s, loadFeedback);
}

function processFeedback(id) {
    showConfirm('标记已处理', '确认将该反馈标记为已处理？', async () => {
        const res = await api('PUT', `/api/admin/feedback/${id}/process`);
        closeModal('confirmModal');
        if (res.code === 0) { showToast('已标记为处理'); loadFeedback(); }
        else showToast(res.message || '操作失败', 'error');
    });
}

function deleteFeedback(id) {
    showConfirm('删除反馈', '确认删除该反馈记录？', async () => {
        const res = await api('DELETE', `/api/admin/feedback/${id}`);
        closeModal('confirmModal');
        if (res.code === 0) { showToast('反馈已删除'); loadFeedback(); }
        else showToast(res.message || '操作失败', 'error');
    });
}

// ===== 权限设置 =====
async function loadPermissions() {
    const res = await api('GET', '/api/admin/admins');
    if (res.code !== 0) { showToast('加载管理员列表失败', 'error'); return; }
    const tbody = document.getElementById('adminsTableBody');
    if (!res.data.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-row">暂无管理员</td></tr>'; return; }
    tbody.innerHTML = res.data.map(a => `
        <tr>
            <td><span style="font-family:monospace;color:#64748b">${a.id}</span></td>
            <td><strong>${a.username}</strong></td>
            <td>${a.name || '--'}</td>
            <td>${roleBadge(a.role)}</td>
            <td style="color:#94a3b8;font-size:12px">${formatTime(a.created_at)}</td>
            <td>
                ${a.username !== (adminInfo?.username) ? `<button class="action-btn action-btn-danger" onclick="deleteAdmin(${a.id},'${a.username}')"><i class="fas fa-trash"></i> 删除</button>` : '<span style="color:#94a3b8;font-size:12px">当前账号</span>'}
            </td>
        </tr>
    `).join('');
}

function deleteAdmin(id, username) {
    showConfirm('删除管理员', `确认删除管理员 "${username}"？`, async () => {
        const res = await api('DELETE', `/api/admin/admins/${id}`);
        closeModal('confirmModal');
        if (res.code === 0) { showToast('管理员已删除'); loadPermissions(); }
        else showToast(res.message || '操作失败', 'error');
    });
}

// ===== 系统配置 =====
async function loadSettings() {
    checkDbStatus();
}

async function checkDbStatus() {
    const res = await api('GET', '/api/admin/db-status');
    const statusEl = document.getElementById('db-status');
    const usersEl = document.getElementById('db-users-count');
    const ordersEl = document.getElementById('db-orders-count');
    if (res.code === 0) {
        statusEl.textContent = '✅ 连接正常';
        statusEl.className = 'db-status-value db-online';
        usersEl.textContent = `${res.data.users_count} 条记录`;
        ordersEl.textContent = `${res.data.orders_count} 条记录`;
    } else {
        statusEl.textContent = '❌ 连接失败';
        statusEl.className = 'db-status-value db-offline';
    }
}

async function changePassword() {
    const oldPwd = document.getElementById('old-password').value;
    const newPwd = document.getElementById('new-password').value;
    const confirmPwd = document.getElementById('confirm-password').value;
    if (!oldPwd || !newPwd || !confirmPwd) { showToast('请填写所有密码字段', 'warning'); return; }
    if (newPwd !== confirmPwd) { showToast('两次输入的新密码不一致', 'warning'); return; }
    if (newPwd.length < 6) { showToast('新密码长度不能少于6位', 'warning'); return; }
    const res = await api('PUT', '/api/admin/change-password', { old_password: oldPwd, new_password: newPwd });
    if (res.code === 0) {
        showToast('密码修改成功，请重新登录');
        document.getElementById('old-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
        setTimeout(() => {
            clearAdminSession();
            location.reload();
        }, 1200);
    } else {
        showToast(res.message || '密码修改失败', 'error');
    }
}

// ===== 初始化事件绑定 =====
function initEvents() {
    // 侧边栏折叠
    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
    });
    document.getElementById('topbarMenuBtn').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
    });

    // 导航点击
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', () => {
        showConfirm('退出登录', '确认退出管理控制台？', async () => {
            await api('POST', '/api/admin/logout');
            clearAdminSession();
            closeModal('confirmModal');
            location.reload();
        });
    });

    // 确认弹窗OK按钮
    document.getElementById('confirmOkBtn').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
    });

    // 弹窗背景点击关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    });

    // 订单搜索
    document.getElementById('orderSearchBtn').addEventListener('click', () => {
        pageState.orders.page = 1;
        pageState.orders.search = document.getElementById('orderSearch').value.trim();
        pageState.orders.status = document.getElementById('orderStatusFilter').value;
        pageState.orders.urgent = document.getElementById('orderUrgentFilter').value;
        loadOrders();
    });
    document.getElementById('orderResetBtn').addEventListener('click', () => {
        document.getElementById('orderSearch').value = '';
        document.getElementById('orderStatusFilter').value = '';
        document.getElementById('orderUrgentFilter').value = '';
        pageState.orders = { ...pageState.orders, page: 1, search: '', status: '', urgent: '' };
        loadOrders();
    });
    document.getElementById('orderSearch').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('orderSearchBtn').click(); });

    // 用户搜索
    document.getElementById('userSearchBtn').addEventListener('click', () => {
        pageState.users.page = 1;
        pageState.users.search = document.getElementById('userSearch').value.trim();
        pageState.users.status = document.getElementById('userStatusFilter').value;
        loadUsers();
    });
    document.getElementById('userResetBtn').addEventListener('click', () => {
        document.getElementById('userSearch').value = '';
        document.getElementById('userStatusFilter').value = '';
        pageState.users = { ...pageState.users, page: 1, search: '', status: '' };
        loadUsers();
    });
    document.getElementById('userSearch').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('userSearchBtn').click(); });

    // 用户新增 / 编辑
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) addUserBtn.addEventListener('click', openCreateUserModal);
    const userFormSubmitBtn = document.getElementById('userFormSubmitBtn');
    if (userFormSubmitBtn) userFormSubmitBtn.addEventListener('click', submitUserForm);
    const userFormPasswordInput = document.getElementById('userFormPassword');
    if (userFormPasswordInput) {
        userFormPasswordInput.addEventListener('keydown', e => { if (e.key === 'Enter') submitUserForm(); });
    }

    // 提现Tab
    document.querySelectorAll('#page-withdraw .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#page-withdraw .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            pageState.withdraw.status = btn.dataset.status;
            pageState.withdraw.page = 1;
            loadWithdraw();
        });
    });

    // 反馈Tab
    document.querySelectorAll('#page-feedback .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#page-feedback .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            pageState.feedback.status = btn.dataset.status;
            pageState.feedback.page = 1;
            loadFeedback();
        });
    });

    // 收益搜索
    document.getElementById('earningsSearchBtn').addEventListener('click', () => {
        pageState.earnings.page = 1;
        pageState.earnings.search = document.getElementById('earningsSearch').value.trim();
        pageState.earnings.type = document.getElementById('earningsTypeFilter').value;
        pageState.earnings.status = document.getElementById('earningsStatusFilter').value;
        loadEarnings();
    });
    document.getElementById('earningsResetBtn').addEventListener('click', () => {
        document.getElementById('earningsSearch').value = '';
        document.getElementById('earningsTypeFilter').value = '';
        document.getElementById('earningsStatusFilter').value = '';
        pageState.earnings = { ...pageState.earnings, page: 1, search: '', type: '', status: '' };
        loadEarnings();
    });

    // 重置用户密码弹窗
    document.getElementById('resetUserPwdSubmitBtn').addEventListener('click', resetUserPassword);
    document.getElementById('toggleResetPwd').addEventListener('click', () => {
        const input = document.getElementById('resetUserNewPwd');
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        document.getElementById('toggleResetPwd').innerHTML = `<i class="fas fa-eye${isText ? '-slash' : ''}"></i>`;
    });
    [document.getElementById('resetUserNewPwd'), document.getElementById('resetUserConfirmPwd')].forEach(el => {
        el.addEventListener('keydown', e => { if (e.key === 'Enter') resetUserPassword(); });
    });

    // 余额调整弹窗
    document.getElementById('adjustBalanceSubmitBtn').addEventListener('click', adjustUserBalance);
    document.getElementById('adjustBalanceAmount').addEventListener('keydown', e => { if (e.key === 'Enter') adjustUserBalance(); });

    // 添加管理员
    document.getElementById('addAdminSubmitBtn').addEventListener('click', async () => {
        const username = document.getElementById('newAdminUsername').value.trim();
        const name = document.getElementById('newAdminName').value.trim();
        const password = document.getElementById('newAdminPassword').value;
        const role = document.getElementById('newAdminRole').value;
        if (!username || !password) { showToast('请填写用户名和密码', 'warning'); return; }
        const res = await api('POST', '/api/admin/admins', { username, name, password, role });
        if (res.code === 0) {
            showToast('管理员添加成功');
            closeModal('addAdminModal');
            document.getElementById('newAdminUsername').value = '';
            document.getElementById('newAdminName').value = '';
            document.getElementById('newAdminPassword').value = '';
            loadPermissions();
        } else {
            showToast(res.message || '添加失败', 'error');
        }
    });
}

// ===== 入口 =====
document.addEventListener('DOMContentLoaded', () => {
    initLogin();
    initEvents();
});
