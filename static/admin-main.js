// 后台管理系统主程序
const API_BASE = '/api';
let adminInfo = null;
let currentPage = 'dashboard';
let currentOrderPage = 1;
let currentUserPage = 1;
let currentEarningPage = 1;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    initEventListeners();
    updateTime();
    setInterval(updateTime, 1000);
});

// 检查登录状态
function checkLogin() {
    const admin = localStorage.getItem('adminInfo');
    if (admin) {
        try {
            adminInfo = JSON.parse(admin);
            showAdminPage();
        } catch (e) {
            localStorage.removeItem('adminInfo');
            showLoginPage();
        }
    } else {
        showLoginPage();
    }
}

// 显示登录页面
function showLoginPage() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('adminPage').classList.add('hidden');
}

// 显示管理页面
function showAdminPage() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('adminPage').classList.remove('hidden');

    if (adminInfo) {
        document.getElementById('adminName').textContent = adminInfo.name || adminInfo.username;
        document.getElementById('adminRole').textContent = adminInfo.role === 'super_admin' ? '超级管理员' : '管理员';
    }

    loadDashboard();
}

// 初始化事件监听
function initEventListeners() {
    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 侧边栏导航
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            switchPage(page);
        });
    });

    // 查看更多链接
    document.querySelectorAll('.view-more').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            switchPage(page);
        });
    });

    // 订单状态筛选
    const orderStatusFilter = document.getElementById('orderStatusFilter');
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', () => {
            currentOrderPage = 1;
            loadOrders();
        });
    }

    // 订单搜索
    const orderSearch = document.getElementById('orderSearch');
    if (orderSearch) {
        let searchTimer;
        orderSearch.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                currentOrderPage = 1;
                loadOrders();
            }, 500);
        });
        orderSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                currentOrderPage = 1;
                loadOrders();
            }
        });
    }

    // 用户搜索
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        let searchTimer;
        userSearch.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                currentUserPage = 1;
                loadUsers();
            }, 500);
        });
        userSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimer);
                currentUserPage = 1;
                loadUsers();
            }
        });
    }

    // 收益状态筛选
    const earningStatusFilter = document.getElementById('earningStatusFilter');
    if (earningStatusFilter) {
        earningStatusFilter.addEventListener('change', () => {
            currentEarningPage = 1;
            loadEarnings();
        });
    }

    // 收益类型筛选
    const earningTypeFilter = document.getElementById('earningTypeFilter');
    if (earningTypeFilter) {
        earningTypeFilter.addEventListener('change', () => {
            currentEarningPage = 1;
            loadEarnings();
        });
    }

    // 点击弹窗背景关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showToast('请输入用户名和密码', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '登录中...';
    }

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const result = await response.json();

        if (result.code === 0) {
            adminInfo = result.data;
            localStorage.setItem('adminInfo', JSON.stringify(adminInfo));
            showAdminPage();
        } else {
            showToast(result.detail || result.message || '登录失败，请检查用户名和密码', 'error');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showToast('登录失败，请重试', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '登录';
        }
    }
}

// 处理退出登录
function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('adminInfo');
        adminInfo = null;
        showLoginPage();
    }
}

// 切换页面
function switchPage(page) {
    currentPage = page;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === page);
    });

    const titles = {
        dashboard: '数据概览',
        orders: '订单管理',
        users: '用户管理',
        earnings: '收益审核'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;

    document.querySelectorAll('.content-page').forEach(p => {
        p.classList.add('hidden');
    });
    document.getElementById(`${page}Page`).classList.remove('hidden');

    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'orders': loadOrders(); break;
        case 'users': loadUsers(); break;
        case 'earnings': loadEarnings(); break;
    }
}

// 更新时间
function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    const timeEl = document.getElementById('currentTime');
    if (timeEl) timeEl.textContent = timeStr;
}

// 加载数据概览
async function loadDashboard() {
    try {
        const [statsRes, ordersRes] = await Promise.all([
            fetch(`${API_BASE}/stats`),
            fetch(`${API_BASE}/orders?page=1&page_size=5`)
        ]);

        const statsResult = await statsRes.json();
        if (statsResult.code === 0) {
            const stats = statsResult.data;
            document.getElementById('statTodayOrders').textContent = stats.today_orders;
            document.getElementById('statPendingOrders').textContent = stats.pending_orders;
            document.getElementById('statTotalUsers').textContent = stats.total_users;
            document.getElementById('statTotalEarnings').textContent = parseFloat(stats.total_earnings || 0).toFixed(2);
        }

        const ordersResult = await ordersRes.json();
        if (ordersResult.code === 0) {
            renderRecentOrders(ordersResult.data.orders);
        }
    } catch (error) {
        console.error('加载数据失败:', error);
        showToast('加载数据失败', 'error');
    }
}

// 渲染最近订单
function renderRecentOrders(orders) {
    const tbody = document.getElementById('recentOrdersTable');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: #9ca3af;">暂无订单</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${escapeHtml(order.title)}</td>
            <td>${escapeHtml(order.user_name || '-')}</td>
            <td>¥${parseFloat(order.fee || 0).toFixed(2)}</td>
            <td>${renderStatusBadge(order.status)}</td>
            <td>${formatDateTime(order.created_at)}</td>
        </tr>
    `).join('');
}

// 加载订单列表
async function loadOrders() {
    try {
        const status = document.getElementById('orderStatusFilter').value;
        const keyword = document.getElementById('orderSearch')?.value?.trim() || '';
        const params = new URLSearchParams({
            page: currentOrderPage,
            page_size: 20
        });

        if (status) params.append('status', status);
        if (keyword) params.append('keyword', keyword);

        const response = await fetch(`${API_BASE}/orders?${params.toString()}`);
        const result = await response.json();

        if (result.code === 0) {
            renderOrdersTable(result.data.orders);
            renderPagination('ordersPagination', currentOrderPage, result.data.total, 20, (page) => {
                currentOrderPage = page;
                loadOrders();
            });
        }
    } catch (error) {
        console.error('加载订单失败:', error);
        showToast('加载订单失败', 'error');
    }
}

// 渲染订单表格
function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTable');
    if (!tbody) return;

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #9ca3af;">暂无订单</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map(order => `
        <tr>
            <td>#${order.id}</td>
            <td>${escapeHtml(order.title)}</td>
            <td>${escapeHtml(order.user_name || '-')}</td>
            <td>${order.runner_id ? '已分配' : '-'}</td>
            <td title="${escapeHtml(order.pickup_address)}">${escapeHtml(truncate(order.pickup_address, 15))}</td>
            <td title="${escapeHtml(order.delivery_address)}">${escapeHtml(truncate(order.delivery_address, 15))}</td>
            <td>¥${parseFloat(order.fee || 0).toFixed(2)}</td>
            <td>${renderStatusBadge(order.status)}</td>
            <td>${formatDateTime(order.created_at)}</td>
            <td>
                <button class="action-btn btn-secondary" onclick="viewOrderDetail(${order.id})">查看</button>
                ${order.status === 'pending' ? `<button class="action-btn btn-danger" onclick="adminCancelOrder(${order.id})">取消</button>` : ''}
            </td>
        </tr>
    `).join('');
}

// 加载用户列表
async function loadUsers() {
    try {
        const keyword = document.getElementById('userSearch')?.value?.trim() || '';
        const params = new URLSearchParams({
            page: currentUserPage,
            page_size: 20
        });

        if (keyword) params.append('keyword', keyword);

        const response = await fetch(`${API_BASE}/users?${params.toString()}`);
        const result = await response.json();

        if (result.code === 0) {
            renderUsersTable(result.data.users);
            renderPagination('usersPagination', currentUserPage, result.data.total, 20, (page) => {
                currentUserPage = page;
                loadUsers();
            });
        }
    } catch (error) {
        console.error('加载用户失败:', error);
        showToast('加载用户失败', 'error');
    }
}

// 渲染用户表格
function renderUsersTable(users) {
    const tbody = document.getElementById('usersTable');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #9ca3af;">暂无用户</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>#${user.id}</td>
            <td>${escapeHtml(user.name)}</td>
            <td>${user.phone}</td>
            <td>${escapeHtml(user.location || '-')}</td>
            <td>${parseFloat(user.rating || 5).toFixed(1)}</td>
            <td>${parseFloat(user.good_rate || 100).toFixed(1)}%</td>
            <td>${user.total_orders || 0}</td>
            <td>¥${parseFloat(user.total_earnings || 0).toFixed(2)}</td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>
                <button class="action-btn btn-secondary" onclick="viewUserDetail(${user.id}, '${escapeHtml(user.name)}', '${user.phone}')">查看</button>
            </td>
        </tr>
    `).join('');
}

// 加载收益列表
async function loadEarnings() {
    try {
        const status = document.getElementById('earningStatusFilter').value;
        const type = document.getElementById('earningTypeFilter').value;
        const params = new URLSearchParams({
            page: currentEarningPage,
            page_size: 20
        });

        if (status) params.append('status', status);

        const response = await fetch(`${API_BASE}/earnings?${params.toString()}`);
        const result = await response.json();

        if (result.code === 0) {
            let earnings = result.data.earnings;
            if (type) {
                earnings = earnings.filter(e => e.type === type);
            }

            renderEarningsTable(earnings);
            renderPagination('earningsPagination', currentEarningPage, result.data.total, 20, (page) => {
                currentEarningPage = page;
                loadEarnings();
            });
        }
    } catch (error) {
        console.error('加载收益失败:', error);
        showToast('加载收益失败', 'error');
    }
}

// 渲染收益表格
function renderEarningsTable(earnings) {
    const tbody = document.getElementById('earningsTable');
    if (!tbody) return;

    if (earnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: #9ca3af;">暂无记录</td></tr>';
        return;
    }

    tbody.innerHTML = earnings.map(earning => `
        <tr>
            <td>#${earning.id}</td>
            <td>${escapeHtml(earning.user_name || '-')}</td>
            <td>${earning.type === 'order' ? '订单收益' : '提现申请'}</td>
            <td style="color: ${parseFloat(earning.amount) >= 0 ? '#10b981' : '#ef4444'};">
                ¥${Math.abs(parseFloat(earning.amount || 0)).toFixed(2)}
            </td>
            <td>${escapeHtml(earning.order_title || '-')}</td>
            <td>${renderEarningStatusBadge(earning.status)}</td>
            <td>${formatDateTime(earning.created_at)}</td>
            <td>
                ${earning.status === 'pending' ? `
                    <button class="action-btn btn-primary" onclick="approveEarning(${earning.id})">通过</button>
                    <button class="action-btn btn-danger" onclick="rejectEarning(${earning.id})">拒绝</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

// 审核通过收益
async function approveEarning(id) {
    if (!confirm('确认通过此收益审核吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/earnings/${id}/approve`, { method: 'PUT' });
        const result = await response.json();

        if (result.code === 0) {
            showToast('审核通过', 'success');
            loadEarnings();
            loadDashboard();
        } else {
            showToast(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('审核失败:', error);
        showToast('操作失败，请重试', 'error');
    }
}

// 拒绝收益
async function rejectEarning(id) {
    const reason = prompt('请输入拒绝原因（可选）：');
    if (reason === null) return; // 用户取消

    try {
        const response = await fetch(`${API_BASE}/earnings/${id}/reject`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || '管理员拒绝' })
        });

        // 如果接口不存在，直接更新状态
        if (response.status === 404 || response.status === 405) {
            showToast('拒绝功能暂未开放', 'error');
            return;
        }

        const result = await response.json();
        if (result.code === 0) {
            showToast('已拒绝', 'success');
            loadEarnings();
        } else {
            showToast(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('拒绝失败:', error);
        showToast('操作失败，请重试', 'error');
    }
}

// 查看订单详情
async function viewOrderDetail(id) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}`);
        const result = await response.json();

        if (result.code === 0) {
            showOrderDetailModal(result.data);
        } else {
            showToast('获取订单详情失败', 'error');
        }
    } catch (error) {
        console.error('加载订单详情失败:', error);
        showToast('加载失败，请重试', 'error');
    }
}

// 显示订单详情弹窗
function showOrderDetailModal(order) {
    const statusMap = {
        pending: '待接单', ongoing: '进行中', completed: '已完成',
        cancelled: '已取消'
    };

    const content = `
        <div class="detail-grid">
            <div class="detail-row"><div class="detail-label">订单ID</div><div class="detail-value">#${order.id}</div></div>
            <div class="detail-row"><div class="detail-label">订单编号</div><div class="detail-value">${order.order_number || '-'}</div></div>
            <div class="detail-row"><div class="detail-label">标题</div><div class="detail-value">${escapeHtml(order.title)}</div></div>
            <div class="detail-row"><div class="detail-label">发布用户</div><div class="detail-value">${escapeHtml(order.user_name || '-')} (${order.user_phone || '-'})</div></div>
            <div class="detail-row"><div class="detail-label">跑腿员</div><div class="detail-value">${order.runner_name ? escapeHtml(order.runner_name) + ' (' + order.runner_phone + ')' : '未分配'}</div></div>
            <div class="detail-row"><div class="detail-label">联系电话</div><div class="detail-value">${order.contact_phone || '-'}</div></div>
            <div class="detail-row"><div class="detail-label">取件地址</div><div class="detail-value">${escapeHtml(order.pickup_address)}</div></div>
            <div class="detail-row"><div class="detail-label">送达地址</div><div class="detail-value">${escapeHtml(order.delivery_address)}</div></div>
            <div class="detail-row"><div class="detail-label">配送时间</div><div class="detail-value">${order.delivery_time || '-'}</div></div>
            <div class="detail-row"><div class="detail-label">配送货物</div><div class="detail-value">${escapeHtml(order.goods_name || '-')}</div></div>
            <div class="detail-row"><div class="detail-label">距离</div><div class="detail-value">${parseFloat(order.distance || 0).toFixed(1)}公里</div></div>
            <div class="detail-row"><div class="detail-label">费用</div><div class="detail-value" style="color:#ef4444;font-weight:bold;">¥${parseFloat(order.fee || 0).toFixed(2)}</div></div>
            <div class="detail-row"><div class="detail-label">状态</div><div class="detail-value">${renderStatusBadge(order.status)}</div></div>
            <div class="detail-row"><div class="detail-label">是否加急</div><div class="detail-value">${order.is_urgent ? '<span style="color:#ef4444;">⚡ 加急</span>' : '否'}</div></div>
            <div class="detail-row"><div class="detail-label">支付方式</div><div class="detail-value">${order.payment_method === 'cash' ? '现金到付' : order.payment_method === 'alipay' ? '支付宝' : '微信支付'}</div></div>
            ${order.remark ? `<div class="detail-row"><div class="detail-label">备注</div><div class="detail-value">${escapeHtml(order.remark)}</div></div>` : ''}
            <div class="detail-row"><div class="detail-label">创建时间</div><div class="detail-value">${formatDateTime(order.created_at)}</div></div>
            ${order.completed_at ? `<div class="detail-row"><div class="detail-label">完成时间</div><div class="detail-value">${formatDateTime(order.completed_at)}</div></div>` : ''}
            ${order.cancel_reason ? `<div class="detail-row"><div class="detail-label">取消原因</div><div class="detail-value">${escapeHtml(order.cancel_reason)}</div></div>` : ''}
        </div>
    `;

    document.getElementById('orderDetailContent').innerHTML = content;
    document.getElementById('orderDetailModal').classList.remove('hidden');
}

// 管理员取消订单
async function adminCancelOrder(id) {
    if (!confirm('确认取消此订单吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/admin/orders/${id}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: '管理员取消' })
        });
        const result = await response.json();

        if (result.code === 0) {
            showToast('订单已取消', 'success');
            loadOrders();
        } else {
            showToast(result.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('取消订单失败:', error);
        showToast('操作失败，请重试', 'error');
    }
}

// 查看用户详情
async function viewUserDetail(id, name, phone) {
    try {
        // 获取用户订单统计
        const [userRes, ordersRes] = await Promise.all([
            fetch(`${API_BASE}/users/${phone}`),
            fetch(`${API_BASE}/orders?user_id=${id}&page=1&page_size=5`)
        ]);

        const userResult = await userRes.json();
        const ordersResult = await ordersRes.json();

        if (userResult.code !== 0) {
            showToast('获取用户信息失败', 'error');
            return;
        }

        const user = userResult.data;
        const recentOrders = ordersResult.code === 0 ? ordersResult.data.orders : [];

        const content = `
            <div class="detail-grid">
                <div class="detail-row"><div class="detail-label">用户ID</div><div class="detail-value">#${user.id}</div></div>
                <div class="detail-row"><div class="detail-label">姓名</div><div class="detail-value">${escapeHtml(user.name)}</div></div>
                <div class="detail-row"><div class="detail-label">手机号</div><div class="detail-value">${user.phone}</div></div>
                <div class="detail-row"><div class="detail-label">位置</div><div class="detail-value">${escapeHtml(user.location || '-')}</div></div>
                <div class="detail-row"><div class="detail-label">评分</div><div class="detail-value">⭐ ${parseFloat(user.rating || 5).toFixed(1)}</div></div>
                <div class="detail-row"><div class="detail-label">好评率</div><div class="detail-value">${parseFloat(user.good_rate || 100).toFixed(1)}%</div></div>
                <div class="detail-row"><div class="detail-label">完成订单</div><div class="detail-value">${user.total_orders || 0} 单</div></div>
                <div class="detail-row"><div class="detail-label">总收益</div><div class="detail-value">¥${parseFloat(user.total_earnings || 0).toFixed(2)}</div></div>
                <div class="detail-row"><div class="detail-label">本月收益</div><div class="detail-value">¥${parseFloat(user.month_earnings || 0).toFixed(2)}</div></div>
                <div class="detail-row"><div class="detail-label">待结算</div><div class="detail-value">¥${parseFloat(user.pending_earnings || 0).toFixed(2)}</div></div>
                <div class="detail-row"><div class="detail-label">注册时间</div><div class="detail-value">${formatDateTime(user.created_at)}</div></div>
            </div>
            ${recentOrders.length > 0 ? `
                <div style="margin-top: 20px;">
                    <h4 style="margin-bottom: 10px; color: #374151;">最近发布的订单</h4>
                    <table style="width:100%; border-collapse: collapse; font-size: 13px;">
                        <thead>
                            <tr style="background: #f9fafb;">
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">标题</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">费用</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">状态</th>
                                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb;">时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentOrders.map(o => `
                                <tr>
                                    <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${escapeHtml(o.title)}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">¥${parseFloat(o.fee || 0).toFixed(2)}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${renderStatusBadge(o.status)}</td>
                                    <td style="padding: 8px; border-bottom: 1px solid #f3f4f6;">${formatDateTime(o.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        `;

        document.getElementById('userDetailContent').innerHTML = content;
        document.getElementById('userDetailModal').classList.remove('hidden');
    } catch (error) {
        console.error('加载用户详情失败:', error);
        showToast('加载失败，请重试', 'error');
    }
}

// 关闭弹窗
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// 渲染分页
function renderPagination(containerId, currentPage, total, pageSize, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(total / pageSize);

    if (totalPages <= 1) {
        container.innerHTML = `<span style="color: #9ca3af; font-size: 13px;">共 ${total} 条记录</span>`;
        return;
    }

    let html = `<span style="color: #9ca3af; font-size: 13px; margin-right: 10px;">共 ${total} 条</span>`;
    html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="adminChangePage(${currentPage - 1})">上一页</button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="adminChangePage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span>...</span>';
        }
    }

    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="adminChangePage(${currentPage + 1})">下一页</button>`;

    container.innerHTML = html;
    window.adminChangePage = onPageChange;
}

// 渲染订单状态标签
function renderStatusBadge(status) {
    const statusMap = {
        pending: { text: '待接单', class: 'status-pending' },
        ongoing: { text: '进行中', class: 'status-ongoing' },
        completed: { text: '已完成', class: 'status-completed' },
        cancelled: { text: '已取消', class: 'status-cancelled' }
    };

    const statusInfo = statusMap[status] || { text: status, class: '' };
    return `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
}

// 渲染收益状态标签
function renderEarningStatusBadge(status) {
    const statusMap = {
        pending: { text: '待审核', class: 'status-pending' },
        completed: { text: '已通过', class: 'status-completed' },
        rejected: { text: '已拒绝', class: 'status-cancelled' }
    };

    const statusInfo = statusMap[status] || { text: status, class: '' };
    return `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
}

// 格式化日期时间
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('zh-CN', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

// HTML转义
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 截断文本
function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

// 显示提示消息
function showToast(message, type = 'info') {
    // 创建或复用toast元素
    let toast = document.getElementById('adminToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'adminToast';
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            padding: 12px 20px; border-radius: 8px; font-size: 14px;
            color: white; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease; max-width: 300px;
        `;
        document.body.appendChild(toast);
    }

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };

    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
    }, 3000);
}
