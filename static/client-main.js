// 客户端主程序
const APP_CONFIG = window.__APP_CONFIG__ || {};
const API_BASE = (APP_CONFIG.apiBase || '/api').replace(/\/$/, '');
const PAGE_URLS = {
    login: APP_CONFIG.loginPage || 'login.html',
    client: APP_CONFIG.clientPage || 'index.html'
};
let CURRENT_USER_ID = 1; // 当前用户ID

function goToLoginPage() {
    window.location.href = PAGE_URLS.login;
}

// 获取认证请求头
function getAuthHeaders(extra = {}) {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...extra
    };
}

// 带认证的fetch封装
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        ...(options.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
    const response = await fetch(url, { ...options, headers });
    // 如果返回401，跳转到登录页
    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userInfo');
        goToLoginPage();
        return null;
    }
    return response;
}

async function parseApiResponse(response) {
    if (!response) {
        return null;
    }

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

function setActionButtonLoading(button, loadingText) {
    if (!button) {
        return;
    }

    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = loadingText;
    button.style.opacity = '0.6';
    button.style.cursor = 'not-allowed';
}

function restoreActionButton(button) {
    if (!button) {
        return;
    }

    button.disabled = false;
    button.textContent = button.dataset.originalText || '操作';
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
}

// 全局状态
let currentRole = 'customer';
let currentPage = 'customer';
let currentOrderType = 'my-orders';
let currentOrderStatus = 'all';
let userData = null;
let userInfo = null;
let flatpickrInstance = null; // Flatpickr实例
let advancedFilters = {
    minFee: null,
    maxFee: null,
    minDistance: null,
    maxDistance: null,
    startDate: null,
    endDate: null
};

// ==================== Toast提示工具函数 ====================
function showToast(message, type = 'info', duration = 3000) {
    let toast = document.getElementById('clientToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'clientToast';
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(20px);
            z-index: 99999; padding: 12px 24px; border-radius: 24px; font-size: 14px;
            color: white; font-weight: 500; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            transition: all 0.3s ease; max-width: 80vw; text-align: center;
            opacity: 0; pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    const colors = { success: '#10b981', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
    toast.style.background = colors[type] || colors.info;
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
}

// 初始化应用
async function initApp() {
    // 检查登录状态
    if (!checkLoginStatus()) {
        return;
    }
    
    await loadUserData();
    await loadStats();
    renderCustomerPage();
    bindEventListeners();
    initCarousel();
}

// 初始化Flatpickr日历组件
function initFlatpickr() {
    const dateInput = document.getElementById('customDateRange');
    if (!dateInput || flatpickrInstance) return;

    flatpickrInstance = flatpickr(dateInput, {
        mode: 'range',
        dateFormat: 'Y-m-d',
        locale: 'zh',
        maxDate: 'today',
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                // 用户选择了日期范围
                advancedFilters.startDate = flatpickr.formatDate(selectedDates[0], 'Y-m-d');
                advancedFilters.endDate = flatpickr.formatDate(selectedDates[1], 'Y-m-d');
                
                // 更新时间筛选下拉框显示
                const timeSelect = document.getElementById('timeFilterSelect');
                const displayText = `${advancedFilters.startDate} 至 ${advancedFilters.endDate}`;
                
                // 更新custom选项的文本
                const customOption = timeSelect.querySelector('option[value="custom"]');
                if (customOption) {
                    customOption.textContent = displayText;
                }
            }
        },
        onClose: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                // 日历关闭且选择了完整日期范围，自动应用筛选
                renderOrdersPage();
            }
        }
    });
}

// 检查登录状态
function checkLoginStatus() {
    const token = localStorage.getItem('token');
    const userInfoStr = localStorage.getItem('userInfo');
    
    if (!token || !userInfoStr) {
        // 未登录，跳转到登录页
        goToLoginPage();
        return false;
    }
    
    try {
        userInfo = JSON.parse(userInfoStr);
        CURRENT_USER_ID = userInfo.id;
        return true;
    } catch (error) {
        console.error('解析用户信息失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
        goToLoginPage();
        return false;
    }
}

// 加载用户数据
async function loadUserData() {
    try {
        // 如果有用户信息，使用用户ID获取最新数据
        if (userInfo && userInfo.phone) {
            const response = await fetch(`${API_BASE}/users/${userInfo.phone}`);
            const result = await response.json();
            if (result.code === 0) {
                userData = result.data;
                updateUserDisplay();
            }
        }
    } catch (error) {
        console.error('加载用户数据失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
    }
}

// 更新用户显示
function updateUserDisplay() {
    if (!userData) return;
    
    document.getElementById('userName').textContent = userData.name || '未设置';
    document.getElementById('userPhone').textContent = userData.phone ? userData.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    document.getElementById('userLocation').textContent = `当前位置：${userData.location || '未知'}`;
    document.getElementById('goodRate').textContent = `${userData.good_rate || 100}%`;
    document.getElementById('userRating').textContent = userData.rating || '5.0';
    document.getElementById('totalOrders').textContent = userData.total_orders || 0;
    
    // 确保数值字段安全调用 toFixed
    const totalEarnings = parseFloat(userData.total_earnings || 0);
    const monthEarnings = parseFloat(userData.month_earnings || 0);
    const pendingEarnings = parseFloat(userData.pending_earnings || 0);
    
    document.getElementById('totalEarnings').textContent = totalEarnings.toFixed(2);
    document.getElementById('monthEarnings').textContent = monthEarnings.toFixed(2);
    document.getElementById('pendingEarnings').textContent = pendingEarnings.toFixed(2);
    document.getElementById('availableAmount').textContent = pendingEarnings.toFixed(2);
    
    // 更新头像显示
    const avatarImage = document.getElementById('userAvatar');
    const avatarEmoji = document.getElementById('avatarEmoji');
    if (avatarImage && avatarEmoji) {
        // 优先使用服务器返回的头像，若为空则从localStorage读取本地缓存的头像
        let avatarUrl = userData.avatar;
        if (!avatarUrl) {
            try {
                const savedInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                if (savedInfo.avatar) {
                    avatarUrl = savedInfo.avatar;
                    userData.avatar = avatarUrl;
                }
            } catch (e) {}
        } else {
            // 服务器有头像时，同步更新localStorage缓存
            try {
                const savedInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                if (savedInfo.avatar !== avatarUrl) {
                    savedInfo.avatar = avatarUrl;
                    localStorage.setItem('userInfo', JSON.stringify(savedInfo));
                }
            } catch (e) {}
        }

        if (avatarUrl) {
            avatarImage.onerror = () => {
                console.warn('头像加载失败，使用默认头像', avatarUrl);
                avatarImage.classList.add('hidden');
                avatarEmoji.classList.remove('hidden');
            };
            avatarImage.src = avatarUrl;
            avatarImage.classList.remove('hidden');
            avatarEmoji.classList.add('hidden');
        } else {
            avatarImage.classList.add('hidden');
            avatarEmoji.classList.remove('hidden');
        }
    }
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
        const result = await response.json();
        if (result.code === 0) {
            const stats = result.data;
            // 确保元素存在再赋值
            const setContent = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            
            setContent('todayOrders', stats.today_orders);
            setContent('pendingOrders', stats.pending_orders);
            setContent('totalServices', stats.total_orders);
            
            setContent('runnerTodayOrders', stats.today_orders);
            setContent('runnerPendingOrders', stats.pending_orders);
            setContent('runnerTotalServices', stats.total_orders);
        }
    } catch (error) {
        console.error('加载统计数据失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
    }
}

// 绑定事件监听器
function bindEventListeners() {
    // 顶部角色切换（保留原有的，用于兼容）
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const role = e.target.dataset.role;
            switchRole(role);
        });
    });

    // Banner区域的角色切换按钮
    document.querySelectorAll('.banner-nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const role = e.target.dataset.role;
            switchRole(role);
        });
    });

    // 底部导航
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.currentTarget.dataset.page;
            switchPage(page);
        });
    });

    // "查看全部"按钮 - 跳转到订单页面并显示最近3天的所有订单
    document.querySelectorAll('.view-all').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            // 设置时间筛选为最近3天
            const timeFilterSelect = document.getElementById('timeFilterSelect');
            if (timeFilterSelect) {
                timeFilterSelect.value = '3';
            }
            // 跳转到订单页面
            switchPage('orders');
        });
    });

    // 发布需求按钮
    const publishBtn = document.getElementById('publishBtn');
    if (publishBtn) {
        publishBtn.addEventListener('click', showPublishModal);
    }

    // 地图按钮 (支持多个入口)
    document.querySelectorAll('.js-map-btn').forEach(btn => {
        btn.addEventListener('click', showMapModal);
    });
    // 兼容旧ID绑定
    const oldMapBtn = document.getElementById('mapBtn');
    if (oldMapBtn) {
        oldMapBtn.addEventListener('click', showMapModal);
    }

    // 提现按钮
    document.getElementById('withdrawBtn').addEventListener('click', showWithdrawModal);

    // 接单记录按钮
    document.getElementById('earningsRecordBtn').addEventListener('click', () => {
        switchPage('orders');
        switchOrderType('my-tasks');
        // 自动切换到"已完成"状态
        switchOrderStatus('completed');
    });

    // 退出登录按钮
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // 我的评价按钮
    document.getElementById('menuMyReviews').addEventListener('click', () => {
        loadMyReviews();
        document.getElementById('reviewsModal').classList.remove('hidden');
    });

    // 设置按钮
    document.getElementById('menuSettings').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('hidden');
    });

    // 建议与举报按钮
    document.getElementById('menuFeedback').addEventListener('click', () => {
        document.getElementById('feedbackModal').classList.remove('hidden');
    });

    // 头像上传功能
    const avatarContainer = document.getElementById('avatarContainer');
    const avatarInput = document.getElementById('avatarInput');
    if (avatarContainer && avatarInput) {
        avatarContainer.addEventListener('click', () => {
            avatarInput.click();
        });
        
        avatarInput.addEventListener('change', handleAvatarUpload);
    }

    // 修改个人信息按钮
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', showEditProfileModal);
    }

    // 关闭弹窗
    document.getElementById('closeModal').addEventListener('click', hidePublishModal);
    document.getElementById('closeMapModal').addEventListener('click', closeMapModal);
    document.getElementById('closeWithdrawModal').addEventListener('click', hideWithdrawModal);
    document.getElementById('closeTimePicker').addEventListener('click', hideTimePickerModal);
    document.getElementById('closeReviewsModal').addEventListener('click', () => {
        document.getElementById('reviewsModal').classList.add('hidden');
    });
    document.getElementById('closeSettingsModal').addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('hidden');
    });
    document.getElementById('closeFeedbackModal').addEventListener('click', () => {
        document.getElementById('feedbackModal').classList.add('hidden');
    });
    
    const closeEditProfileModal = document.getElementById('closeEditProfileModal');
    if (closeEditProfileModal) {
        closeEditProfileModal.addEventListener('click', () => {
            document.getElementById('editProfileModal').classList.add('hidden');
        });
    }

    // 关闭订单详情弹窗
    const closeOrderDetailModal = document.getElementById('closeOrderDetailModal');
    if (closeOrderDetailModal) {
        closeOrderDetailModal.addEventListener('click', () => {
            document.getElementById('orderDetailModal').classList.add('hidden');
        });
    }

    // 关闭评价弹窗
    const closeReviewModal = document.getElementById('closeReviewModal');
    if (closeReviewModal) {
        closeReviewModal.addEventListener('click', () => {
            document.getElementById('reviewModal').classList.add('hidden');
        });
    }

    // 关闭取消订单弹窗
    const closeCancelOrderModal = document.getElementById('closeCancelOrderModal');
    if (closeCancelOrderModal) {
        closeCancelOrderModal.addEventListener('click', () => {
            document.getElementById('cancelOrderModal').classList.add('hidden');
        });
    }

    // 评分星星点击事件
    const ratingStars = document.querySelectorAll('.rating-stars .star');
    ratingStars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            document.getElementById('reviewRating').value = rating;
            
            // 更新星星显示
            ratingStars.forEach((s, index) => {
                if (index < rating) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
            
            // 更新评分文本
            const ratingTexts = ['很差', '较差', '一般', '满意', '非常满意'];
            document.getElementById('ratingText').textContent = ratingTexts[rating - 1];
        });
    });

    // 提交评价
    const submitReviewBtn = document.getElementById('submitReview');
    if (submitReviewBtn) {
        submitReviewBtn.addEventListener('click', submitReview);
    }

    // 确认取消订单
    const confirmCancelOrderBtn = document.getElementById('confirmCancelOrder');
    if (confirmCancelOrderBtn) {
        confirmCancelOrderBtn.addEventListener('click', confirmCancelOrder);
    }

    // 返回（取消取消订单）
    const cancelCancelOrderBtn = document.getElementById('cancelCancelOrder');
    if (cancelCancelOrderBtn) {
        cancelCancelOrderBtn.addEventListener('click', () => {
            document.getElementById('cancelOrderModal').classList.add('hidden');
        });
    }

    // 时间选择器触发
    document.getElementById('timePickerTrigger').addEventListener('click', showTimePickerModal);
    document.getElementById('confirmTime').addEventListener('click', confirmTimeSelection);

    // 提交订单
    document.getElementById('submitOrder').addEventListener('click', submitOrder);

    // 提交提现
    document.getElementById('submitWithdraw').addEventListener('click', submitWithdraw);

    // 提交反馈
    document.getElementById('submitFeedback').addEventListener('click', submitFeedback);
    
    // 提交修改个人信息
    const submitEditProfileBtn = document.getElementById('submitEditProfile');
    if (submitEditProfileBtn) {
        submitEditProfileBtn.addEventListener('click', submitEditProfile);
    }
    
    // 发送修改手机号验证码
    const sendEditPhoneCodeBtn = document.getElementById('sendEditPhoneCode');
    if (sendEditPhoneCodeBtn) {
        sendEditPhoneCodeBtn.addEventListener('click', sendEditPhoneCode);
    }
    
    // 监听手机号输入变化
    const editUserPhone = document.getElementById('editUserPhone');
    if (editUserPhone) {
        editUserPhone.addEventListener('input', () => {
            const newPhone = editUserPhone.value.trim();
            const oldPhone = userData?.phone || '';
            const phoneVerifyGroup = document.getElementById('phoneVerifyGroup');
            
            if (newPhone !== oldPhone && /^1[3-9]\d{9}$/.test(newPhone)) {
                phoneVerifyGroup.classList.remove('hidden');
            } else {
                phoneVerifyGroup.classList.add('hidden');
            }
        });
    }

    // 备注字数统计
    document.getElementById('remark').addEventListener('input', (e) => {
        document.getElementById('remarkCount').textContent = e.target.value.length;
    });

    // 订单页面角色切换
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.target.dataset.type;
            switchOrderType(type);
        });
    });

    // 订单状态筛选
    document.querySelectorAll('.order-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 修复点击span标签时无法获取dataset的问题
            const target = e.target.closest('.order-tab');
            if (target) {
                const status = target.dataset.status;
                switchOrderStatus(status);
            }
        });
    });

    // 搜索框输入事件（防抖）
    let searchTimeout;
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderOrdersPage();
            }, 500);
        });
        
        // 回车键触发搜索
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                renderOrdersPage();
            }
        });
    }
    
    // 搜索按钮点击事件
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', () => {
            clearTimeout(searchTimeout);
            renderOrdersPage();
        });
    }

    // 高级筛选按钮切换
    const advancedFilterToggle = document.getElementById('advancedFilterToggle');
    if (advancedFilterToggle) {
        advancedFilterToggle.addEventListener('click', () => {
            const panel = document.getElementById('advancedFilterPanel');
            const icon = advancedFilterToggle.querySelector('.toggle-icon');
            panel.classList.toggle('hidden');
            icon.textContent = panel.classList.contains('hidden') ? '▼' : '▲';
        });
    }

    // 时间筛选变更事件
    const timeFilter = document.getElementById('timeFilterSelect');
    if (timeFilter) {
        timeFilter.addEventListener('change', (e) => {
            const value = e.target.value;
            const customDateWrapper = document.getElementById('customDateRangeWrapper');
            
            if (value === 'custom') {
                // 显示自定义日期选择器
                customDateWrapper.classList.remove('hidden');
                // 初始化Flatpickr（如果还没初始化）
                if (!flatpickrInstance) {
                    initFlatpickr();
                }
                // 打开日历
                if (flatpickrInstance) {
                    flatpickrInstance.open();
                }
            } else {
                // 隐藏自定义日期选择器
                customDateWrapper.classList.add('hidden');
                // 清空自定义日期
                advancedFilters.startDate = null;
                advancedFilters.endDate = null;
                // 立即应用筛选
                renderOrdersPage();
            }
        });
    }

    // 应用筛选按钮
    const applyFiltersBtn = document.getElementById('applyFilters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            console.log('应用筛选按钮被点击');
            
            // 获取筛选条件
            const minFee = document.getElementById('minFee').value;
            const maxFee = document.getElementById('maxFee').value;
            const minDistance = document.getElementById('minDistance').value;
            const maxDistance = document.getElementById('maxDistance').value;

            advancedFilters.minFee = minFee ? parseFloat(minFee) : null;
            advancedFilters.maxFee = maxFee ? parseFloat(maxFee) : null;
            advancedFilters.minDistance = minDistance ? parseFloat(minDistance) : null;
            advancedFilters.maxDistance = maxDistance ? parseFloat(maxDistance) : null;

            console.log('筛选条件:', advancedFilters);

            // 应用筛选
            renderOrdersPage();
        });
    } else {
        console.warn('未找到应用筛选按钮');
    }

    // 重置筛选按钮
    const resetFiltersBtn = document.getElementById('resetFilters');
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            // 清空所有筛选条件
            document.getElementById('minFee').value = '';
            document.getElementById('maxFee').value = '';
            document.getElementById('minDistance').value = '';
            document.getElementById('maxDistance').value = '';
            document.getElementById('timeFilterSelect').value = 'all';
            document.getElementById('customDateRangeWrapper').classList.add('hidden');
            
            if (flatpickrInstance) {
                flatpickrInstance.clear();
            }

            advancedFilters = {
                minFee: null,
                maxFee: null,
                minDistance: null,
                maxDistance: null,
                startDate: null,
                endDate: null
            };

            // 重新加载订单
            renderOrdersPage();
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

// 切换角色
function switchRole(role) {
    currentRole = role;
    
    // 更新顶部按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    // 更新Banner区域按钮状态
    document.querySelectorAll('.banner-nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    if (role === 'customer') {
        currentPage = 'customer';
        renderCustomerPage();
    } else {
        currentPage = 'runner';
        renderRunnerPage();
    }

    updatePageDisplay();
}

// 切换页面
function switchPage(page) {
    currentPage = page;
    
    // 更新body的class，用于控制顶部按钮显示
    document.body.className = `page-${page}`;
    
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    if (page === 'customer' || page === 'runner') {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === page);
        });
        currentRole = page;
    }

    switch (page) {
        case 'customer':
            renderCustomerPage();
            break;
        case 'runner':
            renderRunnerPage();
            break;
        case 'orders':
            renderOrdersPage();
            break;
        case 'profile':
            renderProfilePage();
            break;
    }

    updatePageDisplay();
}

// 更新页面显示
function updatePageDisplay() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });

    const pageMap = {
        customer: 'customer-page',
        runner: 'runner-page',
        orders: 'orders-page',
        profile: 'profile-page'
    };

    const pageId = pageMap[currentPage];
    const pageElement = document.getElementById(pageId);
    if (pageElement) {
        pageElement.classList.remove('hidden');
    }
}

// 渲染我有需求页面
async function renderCustomerPage() {
    try {
        // 显示所有待接单订单，支持滚动查看
        const response = await fetch(`${API_BASE}/orders?status=pending&page=1&page_size=1000`);
        const result = await response.json();
        if (result.code === 0) {
            renderOrderListWithHighlight('customerOrderList', result.data.orders, false, '');
        }
    } catch (error) {
        console.error('加载订单失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
    }
}

// 渲染我当跑腿页面
async function renderRunnerPage() {
    try {
        const response = await fetch(`${API_BASE}/orders?status=pending`);
        const result = await response.json();
        if (result.code === 0) {
            renderOrderListWithHighlight('runnerOrderList', result.data.orders, true, '');
        }
    } catch (error) {
        console.error('加载订单失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
    }
}

// 渲染订单页面
async function renderOrdersPage() {
    try {
        const params = new URLSearchParams();
        
        // 处理"已发布"状态：显示我发布的待接单订单
        if (currentOrderStatus === 'published') {
            // 筛选user_id和待接单状态
            params.append('user_id', CURRENT_USER_ID);
            params.append('status', 'pending');
        } else {
            // 其他状态按原逻辑处理
            if (currentOrderStatus !== 'all') {
                params.append('status', currentOrderStatus);
            }
            
            if (currentOrderType === 'my-orders') {
                // "我有需求"模式：显示我发布的订单
                params.append('user_id', CURRENT_USER_ID);
            } else {
                // "我当跑腿"模式
                if (currentOrderStatus === 'pending') {
                    // 待接单：显示所有待接单订单（不加runner_id筛选）
                    // 不添加任何用户筛选条件
                } else {
                    // 进行中、已完成：显示我接的订单
                    params.append('runner_id', CURRENT_USER_ID);
                }
            }
        }

        // 添加搜索关键词
        const searchKeyword = document.getElementById('orderSearchInput')?.value;
        if (searchKeyword) {
            params.append('keyword', searchKeyword);
        }

        // 添加时间筛选
        const timeFilter = document.getElementById('timeFilterSelect')?.value;
        if (timeFilter && timeFilter !== 'all') {
            if (timeFilter === 'custom') {
                // 自定义时间范围
                if (advancedFilters.startDate && advancedFilters.endDate) {
                    params.append('time_filter', 'custom');
                    params.append('start_date', advancedFilters.startDate);
                    params.append('end_date', advancedFilters.endDate);
                }
            } else {
                // 预设时间范围
                params.append('time_filter', timeFilter);
            }
        }

        // 添加费用范围筛选
        if (advancedFilters.minFee !== null) {
            params.append('min_fee', advancedFilters.minFee);
        }
        if (advancedFilters.maxFee !== null) {
            params.append('max_fee', advancedFilters.maxFee);
        }

        // 添加距离范围筛选
        if (advancedFilters.minDistance !== null) {
            params.append('min_distance', advancedFilters.minDistance);
        }
        if (advancedFilters.maxDistance !== null) {
            params.append('max_distance', advancedFilters.maxDistance);
        }

        const response = await authFetch(`${API_BASE}/orders?${params.toString()}`);
        if (!response) return;
        const result = await response.json();
        if (result.code === 0) {
            let orders = result.data.orders;
            
            // 应用快捷筛选（前端过滤）
            if (quickFilters.urgent) {
                orders = orders.filter(order => order.is_urgent);
            }
            if (quickFilters.cash) {
                orders = orders.filter(order => order.payment_method === 'cash');
            }
            
            // 应用排序
            orders = sortOrders(orders, currentSortType);
            
            // 如果是"我当跑腿"模式，允许显示操作按钮
            const showActions = currentOrderType === 'my-tasks';
            
            // 渲染订单列表（带高亮）
            renderOrderListWithHighlight('ordersPageList', orders, showActions, searchKeyword);
            
            // 更新Tab计数
            await updateRealOrderCounts();
        }
    } catch (error) {
        console.error('加载订单失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
    }
}

// 获取真实订单计数
async function updateRealOrderCounts() {
    try {
        // 并行请求各状态的计数
        const statuses = ['all', 'pending', 'ongoing', 'completed', 'cancelled'];
        const promises = statuses.map(status => {
            const params = new URLSearchParams();
            
            if (status !== 'all') {
                params.append('status', status);
            }
            
            if (currentOrderType === 'my-orders') {
                // "我有需求"模式：显示我发布的订单
                params.append('user_id', CURRENT_USER_ID);
            } else {
                // "我当跑腿"模式
                if (status === 'pending') {
                    // 待接单：显示所有待接单订单（不加runner_id筛选）
                    // 不添加任何用户筛选条件
                } else {
                    // 进行中、已完成、已取消：显示我接的订单
                    params.append('runner_id', CURRENT_USER_ID);
                }
            }
            
            // 计数时也应该考虑当前的搜索和时间筛选条件吗？
            // 用户需求是"展示不同步"，通常Tab上的数字应该反映当前上下文下的数量
            // 如果加上搜索条件，数字会变少，这是符合预期的
            const searchKeyword = document.getElementById('orderSearchInput')?.value;
            if (searchKeyword) {
                params.append('keyword', searchKeyword);
            }

            const timeFilter = document.getElementById('timeFilterSelect')?.value;
            if (timeFilter && timeFilter !== 'all') {
                params.append('time_filter', timeFilter);
            }
            
            // 我们只需要数量，可以复用get_orders接口，它返回了total
            // 为了减少数据传输，可以设置page_size=1
            params.append('page', 1);
            params.append('page_size', 1);
            
            return authFetch(`${API_BASE}/orders?${params.toString()}`).then(res => res ? res.json() : {code:1});
        });
        
        const results = await Promise.all(promises);
        
        // 安全地更新DOM元素
        const allCountEl = document.getElementById('allCount');
        const pendingCountEl = document.getElementById('pendingCount');
        const ongoingCountEl = document.getElementById('ongoingCount');
        const completedCountEl = document.getElementById('completedCount');
        const cancelledCountEl = document.getElementById('cancelledCount');
        
        if (results[0].code === 0 && allCountEl) allCountEl.textContent = results[0].data.total;
        if (results[1].code === 0 && pendingCountEl) pendingCountEl.textContent = results[1].data.total;
        if (results[2].code === 0 && ongoingCountEl) ongoingCountEl.textContent = results[2].data.total;
        if (results[3].code === 0 && completedCountEl) completedCountEl.textContent = results[3].data.total;
        if (results[4].code === 0 && cancelledCountEl) cancelledCountEl.textContent = results[4].data.total;
        
    } catch (error) {
        console.error('更新订单计数失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message, stack: error.stack });
    }
}

// 渲染我的页面
function renderProfilePage() {
    // 我的页面是静态的，数据已在loadUserData中更新
}

// 渲染订单列表（带高亮）
function renderOrderListWithHighlight(containerId, orders, showActions, keyword) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <div class="empty-state-text">暂无订单</div>
                <div class="empty-state-hint">试试调整筛选条件</div>
            </div>
        `;
        return;
    }

    container.innerHTML = orders.map(order => renderOrderCardWithHighlight(order, showActions, keyword)).join('');

    // 绑定订单卡片点击事件
    container.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // 如果点击的是按钮，不触发卡片点击
            if (e.target.closest('.accept-btn') || e.target.closest('.complete-btn')) {
                return;
            }
            const orderId = parseInt(card.dataset.orderId);
            showOrderDetail(orderId);
        });
    });

    // 绑定接单按钮事件
    if (showActions) {
        container.querySelectorAll('.accept-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionBtn = e.currentTarget;
                const orderId = parseInt(actionBtn.dataset.orderId, 10);
                acceptOrder(orderId, actionBtn);
            });
        });
        
        // 绑定已送达按钮事件
        container.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionBtn = e.currentTarget;
                const orderId = parseInt(actionBtn.dataset.orderId, 10);
                completeOrder(orderId, actionBtn);
            });
        });
    }
}

// 渲染订单卡片（带高亮）
function renderOrderCardWithHighlight(order, showActions, keyword) {
    const statusMap = {
        pending: { text: '待接单', class: 'status-pending' },
        ongoing: { text: '配送中', class: 'status-ongoing' },
        completed: { text: '已完成', class: 'status-completed' },
        cancelled: { text: '已取消', class: 'status-cancelled' }
    };

    const status = statusMap[order.status] || { text: '未知', class: '' };
    
    // 高亮处理
    const title = keyword ? highlightKeyword(order.title, keyword) : order.title;
    const pickupAddress = keyword ? highlightKeyword(order.pickup_address, keyword) : order.pickup_address;
    const deliveryAddress = keyword ? highlightKeyword(order.delivery_address, keyword) : order.delivery_address;
    const remark = keyword && order.remark ? highlightKeyword(order.remark, keyword) : order.remark;

    const orderNumberHtml = order.order_number ? `<div class="order-number">订单号：${order.order_number}</div>` : '';
    const cashBadgeHtml = order.payment_method === 'cash' ? '<span class="cash-badge">💵 现金到付</span>' : '';

    return `
        <div class="order-card" data-order-id="${order.id}">
            ${orderNumberHtml}
            <div class="order-header">
                <div class="order-status">
                    <span class="status-badge ${status.class}">${status.text}</span>
                    ${order.is_urgent ? '<span class="urgent-badge">⚡ 加急</span>' : ''}
                    ${cashBadgeHtml}
                </div>
                <div class="order-title">${title}</div>
                <div class="order-price">¥${order.fee}</div>
            </div>
            <div class="order-address">
                <div class="address-item">
                    <div class="address-icon">🟢</div>
                    <div>
                        <div class="address-label">取件地址</div>
                        <div class="address-text">${pickupAddress}</div>
                    </div>
                </div>
                <div class="address-item">
                    <div class="address-icon">🟠</div>
                    <div>
                        <div class="address-label">送达地址</div>
                        <div class="address-text">${deliveryAddress}</div>
                    </div>
                </div>
            </div>
            <div class="order-info">
                <span>📍 ${order.distance}公里</span>
                <span>🕐 ${order.delivery_time}</span>
            </div>
            ${remark ? `<div class="order-remark">备注：${remark}</div>` : ''}
            ${showActions && order.status === 'pending' ? `
                <div class="order-actions">
                    <button class="accept-btn" data-order-id="${order.id}">接单</button>
                </div>
            ` : ''}
            ${showActions && order.status === 'ongoing' ? `
                <div class="order-actions">
                    <button class="complete-btn" data-order-id="${order.id}">已送达</button>
                </div>
            ` : ''}
        </div>
    `;
}

// 渲染订单卡片
function renderOrderCard(order, showActions) {
    const statusMap = {
        pending: { text: '待接单', class: 'status-pending' },
        ongoing: { text: '配送中', class: 'status-ongoing' },
        completed: { text: '已完成', class: 'status-completed' },
        cancelled: { text: '已取消', class: 'status-cancelled' }
    };

    // 使用默认值防止undefined错误
    const status = statusMap[order.status] || { text: '未知', class: 'status-pending' };
    
    // 生成订单编号显示HTML
    let orderNumberHtml = '';
    if (order.order_number) {
        const isCash = order.payment_method === 'cash';
        orderNumberHtml = `
            <div class="order-number" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 15px; background: #f3f4f6; color: #6b7280; font-size: 12px; border-bottom: 1px solid #e5e7eb;">
                <span>订单号：${order.order_number}</span>
                ${isCash ? '<span>现金到付</span>' : ''}
            </div>
        `;
    }

    return `
        <div class="order-card" data-order-id="${order.id}">
            ${orderNumberHtml}
            <div class="order-header">
                <div class="order-status">
                    <span class="status-badge ${status.class}">${status.text}</span>
                    ${order.is_urgent ? '<span class="urgent-badge">加急</span>' : ''}
                </div>
                <div class="order-title">${order.title}</div>
                <div class="order-price">¥${order.fee}</div>
            </div>
            <div class="order-address">
                <div class="address-item">
                    <div class="address-icon">🟢</div>
                    <div>
                        <div class="address-label">取件地址</div>
                        <div class="address-text">${order.pickup_address}</div>
                    </div>
                </div>
                <div class="address-item">
                    <div class="address-icon">🟠</div>
                    <div>
                        <div class="address-label">送达地址</div>
                        <div class="address-text">${order.delivery_address}</div>
                    </div>
                </div>
            </div>
            <div class="order-info">
                <span>📍 ${order.distance}公里</span>
                <span>🕐 ${order.delivery_time}</span>
            </div>
            ${order.remark ? `<div class="order-remark">备注：${order.remark}</div>` : ''}
            ${showActions && order.status === 'pending' ? `
                <div class="order-actions">
                    <button class="accept-btn" data-order-id="${order.id}">接单</button>
                </div>
            ` : ''}
            ${showActions && order.status === 'ongoing' ? `
                <div class="order-actions">
                    <button class="complete-btn" data-order-id="${order.id}">已送达</button>
                </div>
            ` : ''}
        </div>
    `;
}

// 更新订单统计数量
function updateOrderCounts(orders) {
    const allCount = orders.length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const ongoingCount = orders.filter(o => o.status === 'ongoing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    document.getElementById('allCount').textContent = allCount;
    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('ongoingCount').textContent = ongoingCount;
    document.getElementById('completedCount').textContent = completedCount;
}

// 切换订单类型
function switchOrderType(type) {
    currentOrderType = type;
    
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // 如果当前选中的标签是"待接单"且切换到"我有需求"模式，则自动切换到"全部"
    if (type === 'my-orders' && currentOrderStatus === 'pending') {
        switchOrderStatus('all');
    } else {
        renderOrdersPage();
    }
}

// 切换订单状态
function switchOrderStatus(status) {
    currentOrderStatus = status;
    
    document.querySelectorAll('.order-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });

    renderOrdersPage();
}

// 显示发布弹窗
function showPublishModal() {
    document.getElementById('publishModal').classList.remove('hidden');

    const contactPhoneInput = document.getElementById('contactPhone');
    if (contactPhoneInput && !contactPhoneInput.value) {
        contactPhoneInput.value = userData?.phone || userInfo?.phone || '';
    }
}

// 隐藏发布弹窗
function hidePublishModal() {
    const modal = document.getElementById('publishModal');
    modal.classList.add('hidden');
    
    // 清空表单
    document.getElementById('contactPhone').value = '';
    document.getElementById('pickupAddress').value = '';
    document.getElementById('deliveryAddress').value = '';
    document.getElementById('deliveryTime').value = '';
    document.getElementById('goodsName').value = '';
    document.getElementById('deliveryFee').value = '';
    document.getElementById('isUrgent').checked = false;
    document.getElementById('remark').value = '';
    document.getElementById('remarkCount').textContent = '0';
}

// 显示地图弹窗
async function showMapModal() {
    const modal = document.getElementById('mapModal');
    modal.classList.remove('hidden');
    
    setTimeout(async () => {
        await renderMap();
    }, 100);
}

// 关闭地图弹窗
function closeMapModal() {
    document.getElementById('mapModal').classList.add('hidden');
}

// 显示提现弹窗
function showWithdrawModal() {
    document.getElementById('withdrawModal').classList.remove('hidden');
}

// 隐藏提现弹窗
function hideWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    modal.classList.add('hidden');
    document.getElementById('withdrawAmount').value = '';
}

// 验证联系方式（手机号或固定电话）
function normalizeContactPhone(phone) {
    let normalized = phone.replace(/[\s-]/g, '');

    if (normalized.startsWith('+86')) {
        normalized = normalized.slice(3);
    } else if (normalized.startsWith('86') && normalized.length === 13) {
        normalized = normalized.slice(2);
    }

    return normalized;
}

function validateContactPhone(phone) {
    const normalizedPhone = normalizeContactPhone(phone);

    // 手机号格式：1开头的11位数字
    const mobileRegex = /^1[3-9]\d{9}$/;
    
    // 固定电话格式：
    // 1. 区号-号码（如：0755-12345678）
    // 2. 区号+号码（如：075512345678）
    // 3. 只有号码（如：12345678）
    const landlineRegex = /^(0\d{2,3})?\d{7,8}$/;
    
    return mobileRegex.test(normalizedPhone) || landlineRegex.test(normalizedPhone);
}

function getContactPhoneErrorMessage(phone) {
    const normalizedPhone = normalizeContactPhone(phone);

    if (/^\d+$/.test(normalizedPhone) && normalizedPhone.startsWith('1')) {
        return `当前填写的联系方式是 ${phone}，共 ${normalizedPhone.length} 位；手机号应为 11 位，例如 13800138000`;
    }

    return '请输入正确的手机号或固定电话号码\n\n手机号格式：13800138000\n固定电话格式：0755-12345678 或 075512345678';
}

// 提交订单
async function submitOrder() {
    const submitBtn = document.getElementById('submitOrder');
    
    // 防止重复提交
    if (submitBtn.disabled) {
        return;
    }
    
    const contactPhone = document.getElementById('contactPhone').value.trim();
    const pickupAddress = document.getElementById('pickupAddress').value.trim();
    const deliveryAddress = document.getElementById('deliveryAddress').value.trim();
    const deliveryTime = document.getElementById('deliveryTime').value;
    const goodsName = document.getElementById('goodsName').value.trim();
    const deliveryFee = document.getElementById('deliveryFee').value;
    const isUrgent = document.getElementById('isUrgent').checked;
    const remark = document.getElementById('remark').value;
    const payment = document.querySelector('input[name="payment"]:checked').value;

    // 表单验证
    if (!contactPhone || !pickupAddress || !deliveryAddress || !deliveryTime || !goodsName || !deliveryFee) {
        alert('请填写完整信息');
        return;
    }

    // 验证联系方式格式
    if (!validateContactPhone(contactPhone)) {
        alert(getContactPhoneErrorMessage(contactPhone));
        return;
    }

    // 验证费用
    const fee = parseFloat(deliveryFee);
    if (isNaN(fee) || fee <= 0) {
        alert('请输入正确的配送费用');
        return;
    }

    try {
        // 禁用按钮并显示加载状态
        submitBtn.disabled = true;
        submitBtn.textContent = '发布中...';
        submitBtn.style.opacity = '0.6';
        
        // 使用高德地图API将地址转换为经纬度（并行执行，缩短超时时间）
        let pickupLat = null, pickupLng = null, deliveryLat = null, deliveryLng = null;
        
        if (typeof AMap !== 'undefined') {
            try {
                // 创建地理编码函数
                const geocodeAddress = (address) => {
                    return new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            console.warn(`地理编码超时: ${address}`);
                            resolve(null);
                        }, 3000); // 缩短超时时间为3秒
                        
                        AMap.plugin('AMap.Geocoder', function() {
                            const geocoder = new AMap.Geocoder();
                            geocoder.getLocation(address, function(status, result) {
                                clearTimeout(timeout);
                                if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                                    const location = result.geocodes[0].location;
                                    console.log(`地理编码成功: ${address} -> [${location.lat}, ${location.lng}]`);
                                    resolve({ lat: location.lat, lng: location.lng });
                                } else {
                                    console.warn(`地理编码失败: ${address}, status: ${status}`);
                                    resolve(null);
                                }
                            });
                        });
                    });
                };
                
                // 并行执行两个地址的地理编码
                const [pickupGeo, deliveryGeo] = await Promise.all([
                    geocodeAddress(pickupAddress),
                    geocodeAddress(deliveryAddress)
                ]);
                
                if (pickupGeo) {
                    pickupLat = pickupGeo.lat;
                    pickupLng = pickupGeo.lng;
                } else {
                    console.warn('取件地址地理编码失败，订单将不会显示在地图上');
                }
                
                if (deliveryGeo) {
                    deliveryLat = deliveryGeo.lat;
                    deliveryLng = deliveryGeo.lng;
                } else {
                    console.warn('送达地址地理编码失败');
                }
            } catch (geoError) {
                console.error('地理编码异常:', geoError);
            }
        } else {
            console.warn('高德地图API未加载，跳过地理编码');
        }

        const response = await authFetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: goodsName,
                pickup_address: pickupAddress,
                delivery_address: deliveryAddress,
                delivery_time: deliveryTime,
                goods_name: goodsName,
                fee: fee,
                is_urgent: isUrgent,
                remark: remark,
                payment_method: payment,
                contact_phone: normalizeContactPhone(contactPhone),
                pickup_lat: pickupLat,
                pickup_lng: pickupLng,
                delivery_lat: deliveryLat,
                delivery_lng: deliveryLng
            })
        });

        if (!response) {
            return;
        }

        const result = await parseApiResponse(response);
        if (result.code === 0) {
            showToast('订单发布成功！', 'success');
            hidePublishModal();
            renderCustomerPage();
            loadStats();
        } else {
            showToast(result.message || '订单发布失败，请重试', 'error');
        }
    } catch (error) {
        console.error('提交订单失败:', error.message || error);
        console.error('错误详情:', { name: error.name, message: error.message });
        showToast(error.message || '订单发布失败，请稍后重试', 'error');
    } finally {
        // 恢复按钮状态
        submitBtn.disabled = false;
        submitBtn.textContent = '发布订单';
        submitBtn.style.opacity = '1';
    }
}

// 接单
async function acceptOrder(orderId, actionBtn = null) {
    if (!Number.isInteger(orderId) || orderId <= 0) {
        showToast('订单信息异常，请刷新后重试', 'error');
        return;
    }

    setActionButtonLoading(actionBtn, '接单中...');

    try {
        const response = await authFetch(`${API_BASE}/orders/${orderId}/accept`, {
            method: 'PUT'
        });

        if (!response) {
            return;
        }

        const result = await parseApiResponse(response);
        if (result.code !== 0) {
            throw new Error(result.message || '接单失败，请重试');
        }

        showToast('接单成功！', 'success');
        // 如果在订单页面，刷新订单页面；如果在跑腿页面，刷新跑腿页面
        if (currentPage === 'orders') {
            await renderOrdersPage();
        } else {
            await renderRunnerPage();
        }
        loadStats();
    } catch (error) {
        console.error('接单失败:', error.message || error);
        showToast(error.message || '接单失败，请重试', 'error');
    } finally {
        restoreActionButton(actionBtn);
    }
}

// 完成订单（已送达）
async function completeOrder(orderId, actionBtn = null) {
    if (!Number.isInteger(orderId) || orderId <= 0) {
        showToast('订单信息异常，请刷新后重试', 'error');
        return;
    }

    setActionButtonLoading(actionBtn, '提交中...');

    try {
        const response = await authFetch(`${API_BASE}/orders/${orderId}/complete`, {
            method: 'PUT'
        });

        if (!response) {
            return;
        }

        const result = await parseApiResponse(response);
        if (result.code !== 0) {
            throw new Error(result.message || '操作失败，请重试');
        }

        showToast('订单已完成，收益已到账！', 'success');
        await renderOrdersPage(); // 刷新订单列表
        loadUserData(); // 刷新用户收益数据
        loadStats(); // 刷新统计数据
    } catch (error) {
        console.error('完成订单失败:', error.message || error);
        showToast(error.message || '操作失败，请重试', 'error');
    } finally {
        restoreActionButton(actionBtn);
    }
}

// 提交提现
async function submitWithdraw() {
    const amount = parseFloat(document.getElementById('withdrawAmount').value);
    
    if (!amount || amount <= 0) {
        alert('请输入正确的提现金额');
        return;
    }

    if (amount > userData.pending_earnings) {
        alert('提现金额不能超过可提现金额');
        return;
    }

    try {
        const response = await authFetch(`${API_BASE}/earnings/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount
            })
        });

        const result = await response.json();
        if (result.code === 0) {
            showToast('提现申请已提交，请等待审核', 'success');
            hideWithdrawModal();
            await loadUserData();
        } else {
            alert(result.message || '提现申请失败，请重试');
        }
    } catch (error) {
        console.error('提现失败:', error);
        alert('提现申请失败，请重试');
    }
}

// 提交反馈
async function submitFeedback() {
    const feedbackType = document.getElementById('feedbackType').value;
    const feedbackContent = document.getElementById('feedbackContent').value;
    const feedbackContact = document.getElementById('feedbackContact').value;

    if (!feedbackContent.trim()) {
        alert('请输入反馈内容');
        return;
    }

    if (feedbackContent.trim().length < 5) {
        alert('反馈内容至少5个字符');
        return;
    }

    try {
        const btn = document.getElementById('submitFeedback');
        btn.disabled = true;
        btn.textContent = '提交中...';

        const response = await authFetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: feedbackType,
                content: feedbackContent.trim(),
                contact: feedbackContact.trim() || null
            })
        });

        if (!response) return;
        const result = await response.json();

        if (result.code === 0) {
            showToast('感谢您的反馈！我们会尽快处理。', 'success');
            document.getElementById('feedbackModal').classList.add('hidden');
            document.getElementById('feedbackType').value = 'suggestion';
            document.getElementById('feedbackContent').value = '';
            document.getElementById('feedbackContact').value = '';
        } else {
            showToast(result.message || '提交失败，请重试', 'error');
        }
    } catch (error) {
        console.error('提交反馈失败:', error);
        showToast('提交失败，请重试', 'error');
    } finally {
        const btn = document.getElementById('submitFeedback');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '提交反馈';
        }
    }
}

// 加载我的评价（作为跑腿员收到的评价）
async function loadMyReviews() {
    const modal = document.getElementById('reviewsModal');
    const modalBody = modal.querySelector('.modal-body');

    try {
        const response = await fetch(`${API_BASE}/reviews?runner_id=${CURRENT_USER_ID}&page=1&page_size=20`);
        const result = await response.json();

        if (result.code !== 0) {
            return;
        }

        const reviews = result.data.reviews;
        const total = result.data.total;

        // 计算统计数据
        let avgRating = 0;
        let goodCount = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
            avgRating = (sum / reviews.length).toFixed(1);
            goodCount = reviews.filter(r => r.rating >= 4).length;
        }
        const goodRate = reviews.length > 0 ? Math.round((goodCount / reviews.length) * 100) : 100;

        const starsHtml = (rating) => {
            let s = '';
            for (let i = 1; i <= 5; i++) {
                s += i <= rating ? '⭐' : '☆';
            }
            return s;
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return '';
            const d = new Date(dateStr);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        };

        const maskName = (name) => {
            if (!name) return '匿名';
            if (name.length <= 1) return name + '*';
            return name[0] + '*'.repeat(name.length - 1);
        };

        modalBody.innerHTML = `
            <div class="stats-container" style="margin-bottom: 20px;">
                <div class="stat-item">
                    <div class="stat-value" style="color: #f59e0b;">${avgRating}</div>
                    <div class="stat-label">综合评分</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${goodRate}%</div>
                    <div class="stat-label">好评率</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${total}</div>
                    <div class="stat-label">共获评价</div>
                </div>
            </div>
            <div class="review-list" style="display: flex; flex-direction: column; gap: 15px; max-height: 400px; overflow-y: auto;">
                ${reviews.length === 0 ? '<div style="text-align:center;padding:40px;color:#9ca3af;">暂无评价</div>' :
                    reviews.map(r => `
                        <div class="review-item" style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span style="font-weight: bold;">${maskName(r.user_name)}</span>
                                <span style="color: #9ca3af; font-size: 12px;">${formatDate(r.created_at)}</span>
                            </div>
                            <div style="color: #f59e0b; margin-bottom: 5px;">${starsHtml(r.rating)}</div>
                            ${r.comment ? `<div style="color: #4b5563; font-size: 14px;">${r.comment}</div>` : ''}
                            ${r.order_title ? `<div style="color: #9ca3af; font-size: 12px; margin-top: 5px;">订单：${r.order_title}</div>` : ''}
                        </div>
                    `).join('')
                }
            </div>
        `;
    } catch (error) {
        console.error('加载评价失败:', error);
    }
}

// 时间选择器相关变量
let selectedYear = null;
let selectedMonth = null;
let selectedDay = null;
let selectedHour = null;
let selectedMinute = null;

// 显示时间选择器弹窗
function showTimePickerModal() {
    const modal = document.getElementById('timePickerModal');
    modal.classList.remove('hidden');
    initTimePicker();
}

// 隐藏时间选择器弹窗
function hideTimePickerModal() {
    document.getElementById('timePickerModal').classList.add('hidden');
}

// 初始化时间选择器
function initTimePicker() {
    const yearColumn = document.getElementById('yearColumn');
    const monthColumn = document.getElementById('monthColumn');
    const dayColumn = document.getElementById('dayColumn');
    const hourColumn = document.getElementById('hourColumn');
    const minuteColumn = document.getElementById('minuteColumn');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // 生成年份选项（当前年和未来10年：2026-2036）
    const years = [];
    for (let i = 0; i <= 10; i++) {
        years.push(currentYear + i);
    }
    yearColumn.innerHTML = years.map((y, index) => `
        <div class="time-picker-item ${index === 0 ? 'active' : 'inactive'}" data-year="${y}">
            <div class="time-picker-time">${y}年</div>
        </div>
    `).join('');

    // 生成月份选项（1-12月）
    const months = [];
    for (let i = 1; i <= 12; i++) {
        months.push(i);
    }
    monthColumn.innerHTML = months.map((m, index) => `
        <div class="time-picker-item ${m === currentMonth ? 'active' : 'inactive'}" data-month="${m}">
            <div class="time-picker-time">${m}月</div>
        </div>
    `).join('');

    // 生成日期选项（1-31日，根据月份动态调整）
    const updateDayColumn = (year, month) => {
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = [];
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        dayColumn.innerHTML = days.map((d, index) => `
            <div class="time-picker-item ${d === currentDay && month === currentMonth && year === currentYear ? 'active' : 'inactive'}" data-day="${d}">
                <div class="time-picker-time">${d}日</div>
            </div>
        `).join('');
        
        // 重新绑定日期列的事件
        bindColumnEvents(dayColumn, 'day');
    };

    // 初始化日期列
    updateDayColumn(currentYear, currentMonth);

    // 渲染小时列（0-23点）
    const hours = [];
    for (let i = 0; i <= 23; i++) {
        hours.push(i);
    }
    const currentHour = now.getHours();
    hourColumn.innerHTML = hours.map((h, index) => `
        <div class="time-picker-item ${h === currentHour ? 'active' : 'inactive'}" data-hour="${h}">
            <div class="time-picker-time">${h}时</div>
        </div>
    `).join('');

    // 渲染分钟列（0-59分，每5分钟一个选项）
    const minutes = [];
    for (let i = 0; i < 60; i += 5) {
        minutes.push(i);
    }
    const currentMinute = Math.floor(now.getMinutes() / 5) * 5;
    minuteColumn.innerHTML = minutes.map((m, index) => `
        <div class="time-picker-item ${m === currentMinute ? 'active' : 'inactive'}" data-minute="${m}">
            <div class="time-picker-time">${m}分</div>
        </div>
    `).join('');

    // 设置默认选中值
    selectedYear = currentYear;
    selectedMonth = currentMonth;
    selectedDay = currentDay;
    selectedHour = currentHour;
    selectedMinute = currentMinute;

    // 绑定列事件
    bindColumnEvents(yearColumn, 'year');
    bindColumnEvents(monthColumn, 'month');
    bindColumnEvents(dayColumn, 'day');
    bindColumnEvents(hourColumn, 'hour');
    bindColumnEvents(minuteColumn, 'minute');

    // 监听年月变化，更新日期列
    yearColumn.addEventListener('click', (e) => {
        const item = e.target.closest('.time-picker-item');
        if (item) {
            const year = parseInt(item.dataset.year);
            selectedYear = year;
            updateDayColumn(selectedYear, selectedMonth);
        }
    });

    monthColumn.addEventListener('click', (e) => {
        const item = e.target.closest('.time-picker-item');
        if (item) {
            const month = parseInt(item.dataset.month);
            selectedMonth = month;
            updateDayColumn(selectedYear, selectedMonth);
        }
    });

    // 滚动到选中项
    setTimeout(() => {
        scrollToActive(yearColumn);
        scrollToActive(monthColumn);
        scrollToActive(dayColumn);
        scrollToActive(hourColumn);
        scrollToActive(minuteColumn);
    }, 10);
}

// 滚动到激活项
function scrollToActive(column) {
    const activeItem = column.querySelector('.time-picker-item.active');
    if (activeItem) {
        const columnHeight = column.clientHeight;
        const itemHeight = activeItem.clientHeight;
        const itemTop = activeItem.offsetTop;
        column.scrollTop = itemTop - (columnHeight / 2) + (itemHeight / 2);
    }
}

// 绑定列事件
function bindColumnEvents(column, type) {
    column.querySelectorAll('.time-picker-item').forEach(item => {
        item.addEventListener('click', () => {
            // 移除所有active类
            column.querySelectorAll('.time-picker-item').forEach(i => {
                i.classList.remove('active');
                i.classList.add('inactive');
            });
            
            // 添加active类到当前项
            item.classList.remove('inactive');
            item.classList.add('active');
            
            // 更新选中值
            const value = parseInt(item.dataset[type]);
            if (type === 'year') {
                selectedYear = value;
            } else if (type === 'month') {
                selectedMonth = value;
            } else if (type === 'day') {
                selectedDay = value;
            } else if (type === 'hour') {
                selectedHour = value;
            } else if (type === 'minute') {
                selectedMinute = value;
            }
            
            // 滚动到选中项
            scrollToActive(column);
        });
    });
}

// 确认时间选择
function confirmTimeSelection() {
    if (selectedYear === null || selectedMonth === null || selectedDay === null || selectedHour === null || selectedMinute === null) {
        alert('请选择完整的时间');
        return;
    }

    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const selectedDate = new Date(selectedYear, selectedMonth - 1, selectedDay);
    const weekDay = weekDays[selectedDate.getDay()];

    const timeString = `${selectedMonth}月${selectedDay}日 ${weekDay} ${selectedHour}时${selectedMinute}分`;
    
    document.getElementById('selectedTimeDisplay').textContent = timeString;
    document.getElementById('deliveryTime').value = timeString;
    
    hideTimePickerModal();
}

// 增强的地图渲染函数 - 支持订单标记、路线规划和配送时间预估
async function renderMap() {
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;

    // 检查高德地图API是否加载
    if (typeof AMap === 'undefined') {
        mapContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">
                <div style="text-align: center;">
                    <p style="font-size: 16px; margin-bottom: 8px;">地图API加载中...</p>
                    <p style="font-size: 14px;">请稍候</p>
                </div>
            </div>
        `;
        
        // 等待API加载
        setTimeout(() => renderMap(), 500);
        return;
    }

    try {
        // 显示加载中
        // mapContainer.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:#666;">正在加载订单数据...</div>';

        const response = await fetch(`${API_BASE}/orders?status=pending`);
        const result = await response.json();
        
        if (result.code === 0) {
            const orders = result.data.orders;
            
            if (orders.length === 0) {
                mapContainer.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">
                        <div style="text-align: center;">
                            <p style="font-size: 40px; margin-bottom: 10px;">🗺️</p>
                            <p style="font-size: 16px; margin-bottom: 8px;">暂无待接订单</p>
                            <p style="font-size: 14px;">去发布一个需求吧</p>
                        </div>
                    </div>
                `;
                return;
            }

            // 创建高德地图实例
            const map = new AMap.Map('mapContainer', {
                zoom: 12,
                center: [113.93, 22.68], // 默认中心点
                viewMode: '2D',
                mapStyle: 'amap://styles/normal' // 使用标准地图样式
            });

            // 加载所需插件
            AMap.plugin(['AMap.MarkerClusterer', 'AMap.Driving', 'AMap.Geocoder'], async function() {
                const markers = [];
                let selectedOrder = null; // 当前选中的订单
                let drivingInstance = null; // 驾车路线规划实例
                const geocoder = new AMap.Geocoder();

                // 辅助函数：创建标记
                const createMarker = (order, lat, lng) => {
                    // 创建自定义蓝色标记图标
                    const icon = new AMap.Icon({
                        size: new AMap.Size(32, 32),
                        image: 'data:image/svg+xml;base64,' + btoa(`
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                                <circle cx="16" cy="16" r="14" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
                                <text x="16" y="21" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">📦</text>
                            </svg>
                        `),
                        imageSize: new AMap.Size(32, 32)
                    });

                    // 创建标记
                    const marker = new AMap.Marker({
                        position: [lng, lat],
                        title: order.title,
                        icon: icon,
                        offset: new AMap.Pixel(-16, -16),
                        extData: order // 存储订单数据
                    });

                    // 创建信息窗体
                    const infoWindow = new AMap.InfoWindow({
                        content: `
                            <div style="padding: 15px; min-width: 280px;">
                                <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 17px; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                                    <span>📦</span>
                                    <span>${order.title}</span>
                                    ${order.is_urgent ? '<span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 12px; font-size: 12px;">⚡加急</span>' : ''}
                                </h4>
                                <div style="margin-bottom: 10px;">
                                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 6px; display: flex; align-items: start; gap: 6px;">
                                        <span style="color: #10b981;">🟢</span>
                                        <div>
                                            <div style="font-weight: 600; color: #374151; margin-bottom: 2px;">取件地址</div>
                                            <div>${order.pickup_address}</div>
                                        </div>
                                    </div>
                                    <div style="color: #6b7280; font-size: 13px; margin-bottom: 6px; display: flex; align-items: start; gap: 6px;">
                                        <span style="color: #f59e0b;">🟠</span>
                                        <div>
                                            <div style="font-weight: 600; color: #374151; margin-bottom: 2px;">送达地址</div>
                                            <div>${order.delivery_address}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9fafb; border-radius: 8px; margin-bottom: 10px;">
                                    <div>
                                        <div style="color: #6b7280; font-size: 12px;">配送距离</div>
                                        <div style="color: #1f2937; font-weight: 600; font-size: 14px;">${order.distance}公里</div>
                                    </div>
                                    <div>
                                        <div style="color: #6b7280; font-size: 12px;">配送费用</div>
                                        <div style="color: #ef4444; font-weight: bold; font-size: 18px;">¥${order.fee}</div>
                                    </div>
                                </div>
                                <button 
                                    onclick="showOrderRoute(${order.id})" 
                                    style="width: 100%; padding: 10px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s;"
                                    onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'"
                                    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'"
                                >
                                    🚗 查看配送路线
                                </button>
                            </div>
                        `,
                        offset: new AMap.Pixel(0, -16)
                    });

                    // 点击标记显示信息窗体
                    marker.on('click', () => {
                        infoWindow.open(map, marker.getPosition());
                        selectedOrder = order;
                    });

                    return marker;
                };

                // 处理所有订单
                const processOrders = async () => {
                    const cluster = new AMap.MarkerClusterer(map, [], {
                        gridSize: 80,
                        maxZoom: 15,
                        styles: [{
                            url: 'data:image/svg+xml;base64,' + btoa(`
                                <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
                                    <circle cx="30" cy="30" r="28" fill="#3b82f6" stroke="#ffffff" stroke-width="3"/>
                                    <text x="30" y="38" text-anchor="middle" fill="#ffffff" font-size="20" font-weight="bold">_COUNT_</text>
                                </svg>
                            `),
                            size: new AMap.Size(60, 60),
                            offset: new AMap.Pixel(-30, -30)
                        }]
                    });

                    // 1. 先处理有坐标的订单
                    orders.forEach(order => {
                        if (order.pickup_lat && order.pickup_lng) {
                            const marker = createMarker(order, parseFloat(order.pickup_lat), parseFloat(order.pickup_lng));
                            markers.push(marker);
                            cluster.addMarker(marker);
                        }
                    });

                    if (markers.length > 0) {
                        map.setFitView(markers);
                    }

                    // 2. 处理无坐标的订单（实时地理编码）
                    const ordersWithoutLoc = orders.filter(o => !o.pickup_lat || !o.pickup_lng);
                    if (ordersWithoutLoc.length > 0) {
                        console.log(`发现 ${ordersWithoutLoc.length} 个订单缺少坐标，正在尝试自动修复...`);
                        
                        // 限制并发处理数量，避免API限流
                        const MAX_GEO_PROCESS = 10; 
                        const processList = ordersWithoutLoc.slice(0, MAX_GEO_PROCESS);

                        // 使用Promise.all等待所有地理编码完成
                        const geoPromises = processList.map(order => {
                            return new Promise((resolve) => {
                                geocoder.getLocation(order.pickup_address, function(status, result) {
                                    if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                                        const loc = result.geocodes[0].location;
                                        // 更新订单对象的坐标（临时）
                                        order.pickup_lat = loc.lat;
                                        order.pickup_lng = loc.lng;
                                        // 同时尝试获取送达地址坐标
                                        if (order.delivery_address && order.delivery_address !== order.pickup_address) {
                                            geocoder.getLocation(order.delivery_address, function(deliveryStatus, deliveryResult) {
                                                if (deliveryStatus === 'complete' && deliveryResult.geocodes && deliveryResult.geocodes.length > 0) {
                                                    const deliveryLoc = deliveryResult.geocodes[0].location;
                                                    order.delivery_lat = deliveryLoc.lat;
                                                    order.delivery_lng = deliveryLoc.lng;
                                                } else {
                                                    // 如果送达地址编码失败，使用取件地址坐标
                                                    order.delivery_lat = loc.lat;
                                                    order.delivery_lng = loc.lng;
                                                }
                                                const marker = createMarker(order, loc.lat, loc.lng);
                                                markers.push(marker);
                                                cluster.addMarker(marker);
                                                console.log(`订单 ${order.id} 坐标修复成功: [${loc.lat}, ${loc.lng}]`);
                                                resolve();
                                            });
                                        } else {
                                            // 没有送达地址或与取件地址相同
                                            order.delivery_lat = loc.lat;
                                            order.delivery_lng = loc.lng;
                                            const marker = createMarker(order, loc.lat, loc.lng);
                                            markers.push(marker);
                                            cluster.addMarker(marker);
                                            persistOrderCoordinates(order);
                                            console.log(`订单 ${order.id} 坐标修复成功: [${loc.lat}, ${loc.lng}]`);
                                            resolve();
                                        }
                                    } else {
                                        console.warn(`订单 ${order.id} 地理编码失败, status: ${status}`);
                                        resolve();
                                    }
                                });
                            });
                        });
                        
                        await Promise.all(geoPromises);
                        
                        // 地理编码完成后，重新设置地图视野
                        if (markers.length > 0) {
                            console.log(`地图上共有 ${markers.length} 个订单标记`);
                            map.setFitView(markers);
                        } else {
                            console.warn('没有订单标记可以显示在地图上');
                        }
                    }
                };

                await processOrders();

                // 全局函数：显示订单路线
                window.showOrderRoute = function(orderId) {
                    const order = orders.find(o => o.id === orderId);
                    if (!order) return;
                    
                    // 如果没有坐标，尝试现场获取
                    if (!order.pickup_lat || !order.pickup_lng || !order.delivery_lat || !order.delivery_lng) {
                        // 简单的提示，或者尝试实时获取
                        // 这里为了简化，如果实时修复成功了，order对象里应该已经有了
                        if (!order.pickup_lat) {
                            alert('该订单地址信息不完整，无法规划路线');
                            return;
                        }
                    }

                    // 清除之前的路线
                    if (drivingInstance) {
                        drivingInstance.clear();
                    }

                    // 创建驾车路线规划实例
                    drivingInstance = new AMap.Driving({
                        map: map,
                        panel: null, // 不使用面板
                        hideMarkers: false, // 显示起终点标记
                        autoFitView: true // 自动调整视野
                    });

                    // 如果送达地址也没有坐标，尝试获取
                    const planRoute = (dLat, dLng) => {
                        drivingInstance.search(
                            new AMap.LngLat(parseFloat(order.pickup_lng), parseFloat(order.pickup_lat)),
                            new AMap.LngLat(dLng, dLat),
                            function(status, result) {
                                if (status === 'complete') {
                                    if (result.routes && result.routes.length > 0) {
                                        const route = result.routes[0];
                                        const distance = (route.distance / 1000).toFixed(1); // 转换为公里
                                        const duration = Math.ceil(route.time / 60); // 转换为分钟
                                        
                                        // 显示路线信息
                                        const routeInfo = new AMap.InfoWindow({
                                            content: `
                                                <div style="padding: 15px; min-width: 250px;">
                                                    <h4 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px; font-weight: bold;">🚗 配送路线规划</h4>
                                                    <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                                                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                                            <span style="color: #6b7280; font-size: 13px;">配送距离</span>
                                                            <span style="color: #1f2937; font-weight: 600; font-size: 14px;">${distance} 公里</span>
                                                        </div>
                                                        <div style="display: flex; justify-content: space-between;">
                                                            <span style="color: #6b7280; font-size: 13px;">预计用时</span>
                                                            <span style="color: #10b981; font-weight: 600; font-size: 14px;">${duration} 分钟</span>
                                                        </div>
                                                    </div>
                                                    <div style="color: #6b7280; font-size: 12px; line-height: 1.5;">
                                                        💡 路线已在地图上显示，绿色标记为取件点，红色标记为送达点
                                                    </div>
                                                </div>
                                            `,
                                            position: map.getCenter()
                                        });
                                        routeInfo.open(map);
                                    } else {
                                        alert('未找到合适的路线');
                                    }
                                } else {
                                    alert('路线规划失败，请稍后重试');
                                }
                            }
                        );
                    };

                    if (order.delivery_lat && order.delivery_lng) {
                        planRoute(parseFloat(order.delivery_lat), parseFloat(order.delivery_lng));
                    } else {
                        // 尝试获取送达地址坐标
                        geocoder.getLocation(order.delivery_address, function(status, result) {
                            if (status === 'complete' && result.geocodes.length > 0) {
                                const loc = result.geocodes[0].location;
                                planRoute(loc.lat, loc.lng);
                            } else {
                                alert('送达地址无法定位，无法规划路线');
                            }
                        });
                    }
                };
            }); // 闭合 AMap.plugin 回调
        }
    } catch (error) {
        console.error('加载地图数据失败:', error);
        mapContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #9ca3af;">
                <div style="text-align: center;">
                    <p style="font-size: 16px; margin-bottom: 8px;">地图加载失败</p>
                    <p style="font-size: 14px;">请检查网络连接后重试</p>
                </div>
            </div>
        `;
    }
} // 闭合 renderMap 函数

// 处理退出登录
async function handleLogout() {
    const token = localStorage.getItem('token');

    showToast('正在退出登录...', 'info', 1200);

    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
    } catch (error) {
        console.warn('退出登录请求失败，继续清理本地登录态:', error.message || error);
    } finally {
        localStorage.removeItem('userInfo');
        localStorage.removeItem('token');
        setTimeout(() => {
            goToLoginPage();
        }, 200);
    }
}

// 处理头像上传
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
        alert('请选择图片文件');
        return;
    }

    // 验证文件大小（限制5MB）
    if (file.size > 5 * 1024 * 1024) {
        alert('图片大小不能超过5MB');
        return;
    }

    try {
        // 创建FormData
        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('user_id', CURRENT_USER_ID);

        // 上传头像（携带认证token）
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/users/upload-avatar`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData
        });

        const result = await response.json();
        if (result.code === 0) {
            // 更新userData中的头像URL
            if (userData) {
                userData.avatar = result.data.avatar_url;
            }

            // 将头像URL持久化保存到localStorage，确保重新登录后仍可显示
            try {
                const savedInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                savedInfo.avatar = result.data.avatar_url;
                localStorage.setItem('userInfo', JSON.stringify(savedInfo));
            } catch (e) {
                console.warn('保存头像到本地失败:', e);
            }
            
            // 更新头像显示
            const avatarImage = document.getElementById('userAvatar');
            const avatarEmoji = document.getElementById('avatarEmoji');
            
            avatarImage.src = result.data.avatar_url;
            avatarImage.classList.remove('hidden');
            avatarEmoji.classList.add('hidden');
            
            showToast('头像上传成功', 'success');
        } else {
            showToast(result.message || '头像上传失败', 'error');
        }
    } catch (error) {
        console.error('上传头像失败:', error);
        alert('上传失败，请重试');
    }
}

// 显示修改个人信息弹窗
function showEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        // 从userInfo（注册时的信息）或userData（最新信息）中获取
        const currentName = userData?.name || userInfo?.username || '';
        const currentPhone = userData?.phone || userInfo?.phone || '';
        
        // 填充当前信息
        document.getElementById('editUserName').value = currentName;
        document.getElementById('editUserPhone').value = currentPhone;
        
        // 隐藏验证码输入框
        document.getElementById('phoneVerifyGroup').classList.add('hidden');
        document.getElementById('editPhoneCode').value = '';
        
        modal.classList.remove('hidden');
        document.getElementById('settingsModal').classList.add('hidden');
    }
}

// 关闭修改个人信息弹窗
function closeEditProfileModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 提交修改个人信息
async function submitEditProfile() {
    const newName = document.getElementById('editUserName').value.trim();
    const newPhone = document.getElementById('editUserPhone').value.trim();
    const oldPhone = userData?.phone || '';

    if (!newName) {
        alert('请输入姓名');
        return;
    }

    if (!newPhone) {
        alert('请输入手机号');
        return;
    }

    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
        alert('请输入正确的手机号');
        return;
    }

    // 如果修改了手机号，需要验证码
    if (newPhone !== oldPhone) {
        const code = document.getElementById('editPhoneCode').value.trim();
        if (!code) {
            alert('请输入验证码');
            return;
        }

        try {
            const response = await authFetch(`${API_BASE}/users/update-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newName,
                    phone: newPhone,
                    sms_code: code
                })
            });

            if (!response) return;
            const result = await response.json();
            if (result.code === 0) {
                showToast('修改成功', 'success');
                closeEditProfileModal();
                await loadUserData();
                renderProfilePage();
            } else {
                showToast(result.message || '修改失败', 'error');
            }
        } catch (error) {
            console.error('修改失败:', error);
            showToast('修改失败，请重试', 'error');
        }
    } else {
        // 只修改姓名
        try {
            const response = await authFetch(`${API_BASE}/users/update-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: newName
                })
            });

            if (!response) return;
            const result = await response.json();
            if (result.code === 0) {
                showToast('修改成功', 'success');
                closeEditProfileModal();
                await loadUserData();
                renderProfilePage();
            } else {
                showToast(result.message || '修改失败', 'error');
            }
        } catch (error) {
            console.error('修改失败:', error);
            showToast('修改失败，请重试', 'error');
        }
    }
}

// 发送修改手机号验证码
async function sendEditPhoneCode() {
    const newPhone = document.getElementById('editUserPhone').value.trim();
    const oldPhone = userData?.phone || '';

    if (!newPhone) {
        alert('请输入手机号');
        return;
    }

    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
        alert('请输入正确的手机号');
        return;
    }

    if (newPhone === oldPhone) {
        alert('新手机号与当前手机号相同');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/send-sms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phone: newPhone,
                type: 'change_phone'
            })
        });

        const result = await response.json();
        if (result.code === 0) {
            alert('验证码已发送');
            // 显示验证码输入框
            document.getElementById('phoneVerifyGroup').classList.remove('hidden');
            
            // 倒计时
            const btn = document.getElementById('sendEditPhoneCode');
            let countdown = 60;
            btn.disabled = true;
            btn.textContent = `${countdown}秒后重试`;
            
            const timer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    btn.textContent = `${countdown}秒后重试`;
                } else {
                    clearInterval(timer);
                    btn.textContent = '获取验证码';
                    btn.disabled = false;
                }
            }, 1000);
        } else {
            alert(result.message || '发送失败');
        }
    } catch (error) {
        console.error('发送验证码失败:', error);
        alert('发送失败，请重试');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);

// 显示订单详情
async function showOrderDetail(orderId) {
    try {
        const response = await authFetch(`${API_BASE}/orders/${orderId}`);
        if (!response) {
            return;
        }
        const result = await parseApiResponse(response);

        if (result.code === 0) {
            const order = result.data;
            renderOrderDetail(order);
            document.getElementById('orderDetailModal').classList.remove('hidden');
        } else {
            alert(result.message || '获取订单详情失败');
        }
    } catch (error) {
        console.error('获取订单详情失败:', error);
        alert(error.message || '获取订单详情失败，请重试');
    }
}

// 渲染订单详情
function renderOrderDetail(order) {
    const statusMap = {
        pending: { text: '待接单', class: 'status-pending' },
        ongoing: { text: '配送中', class: 'status-ongoing' },
        completed: { text: '已完成', class: 'status-completed' },
        cancelled: { text: '已取消', class: 'status-cancelled' }
    };
    
    const status = statusMap[order.status] || { text: '未知', class: '' };
    
    // 判断是否可以取消（只有待接单和进行中的订单可以取消）
    const canCancel = (order.status === 'pending' || order.status === 'ongoing') && order.user_id === CURRENT_USER_ID;
    
    // 判断是否可以评价（只有已完成且是订单发布者才能评价）
    const canReview = order.status === 'completed' && order.user_id === CURRENT_USER_ID;
    
    // 格式化订单发布时间
    const formatCreateTime = (timeStr) => {
        if (!timeStr) return '未知';
        const date = new Date(timeStr);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        const weekDay = weekDays[date.getDay()];
        return `${month}月${day}日 周${weekDay} ${hours}时${minutes}分`;
    };
    
    const detailHtml = `
        <div class="order-detail-section">
            <h4>订单信息</h4>
            <div class="order-detail-item">
                <span class="order-detail-label">订单编号</span>
                <span class="order-detail-value">${order.order_number || order.id}</span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">订单状态</span>
                <span class="order-detail-value">
                    <span class="status-badge ${status.class}">${status.text}</span>
                </span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">订单标题</span>
                <span class="order-detail-value">${order.title}</span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">配送费用</span>
                <span class="order-detail-value" style="color: #ef4444; font-size: 18px;">¥${order.fee}</span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">发布时间</span>
                <span class="order-detail-value">${formatCreateTime(order.created_at)}</span>
            </div>
            ${order.is_urgent ? '<div class="order-detail-item"><span class="order-detail-label">加急订单</span><span class="order-detail-value"><span class="urgent-badge">加急</span></span></div>' : ''}
        </div>
        
        <div class="order-detail-section">
            <h4>配送信息</h4>
            <div class="order-detail-item">
                <span class="order-detail-label">取件地址</span>
                <span class="order-detail-value">
                    ${order.pickup_address}
                    <button class="copy-btn" onclick="copyToClipboard('${order.pickup_address.replace(/'/g, "\\'")}', '取件地址')" title="复制取件地址">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">送达地址</span>
                <span class="order-detail-value">
                    ${order.delivery_address}
                    <button class="copy-btn" onclick="copyToClipboard('${order.delivery_address.replace(/'/g, "\\'")}', '送达地址')" title="复制送达地址">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">配送距离</span>
                <span class="order-detail-value">${order.distance}公里</span>
            </div>
            <div class="order-detail-item">
                <span class="order-detail-label">配送时间</span>
                <span class="order-detail-value">${order.delivery_time}</span>
            </div>
            ${order.remark ? `<div class="order-detail-item"><span class="order-detail-label">备注</span><span class="order-detail-value">${order.remark}</span></div>` : ''}
        </div>
        
        ${order.user_name ? `
        <div class="order-detail-section">
            <h4>联系信息</h4>
            <div class="order-detail-item">
                <span class="order-detail-label">发布人</span>
                <span class="order-detail-value">${order.user_name}</span>
            </div>
            ${order.user_phone ? `<div class="order-detail-item"><span class="order-detail-label">联系电话</span><span class="order-detail-value">${order.user_phone}<button class="copy-btn" onclick="copyToClipboard('${order.user_phone}', '联系电话')" title="复制联系电话"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></span></div>` : ''}
        </div>
        ` : ''}
        
        ${order.runner_name ? `
        <div class="order-detail-section">
            <h4>跑腿员信息</h4>
            <div class="order-detail-item">
                <span class="order-detail-label">跑腿员</span>
                <span class="order-detail-value">${order.runner_name}</span>
            </div>
            ${order.runner_phone ? `<div class="order-detail-item"><span class="order-detail-label">联系电话</span><span class="order-detail-value">${order.runner_phone}<button class="copy-btn" onclick="copyToClipboard('${order.runner_phone}', '联系电话')" title="复制联系电话"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button></span></div>` : ''}
            ${order.runner_rating ? `<div class="order-detail-item"><span class="order-detail-label">评分</span><span class="order-detail-value">⭐ ${order.runner_rating}</span></div>` : ''}
        </div>
        ` : ''}
        
        <div class="order-detail-actions">
            ${canReview ? `<button class="order-detail-btn order-detail-btn-primary" onclick="showReviewModal(${order.id}, ${order.runner_id})">评价订单</button>` : ''}
            ${canCancel ? `<button class="order-detail-btn order-detail-btn-danger" onclick="showCancelOrderModal(${order.id})">取消订单</button>` : ''}
            <button class="order-detail-btn order-detail-btn-secondary" onclick="document.getElementById('orderDetailModal').classList.add('hidden')">关闭</button>
        </div>
    `;
    
    document.getElementById('orderDetailContent').innerHTML = detailHtml;
}

// 复制到剪贴板功能
function copyToClipboard(text, label) {
    // 使用现代的 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showCopySuccess(label);
        }).catch(err => {
            // 如果失败，使用传统方法
            fallbackCopyToClipboard(text, label);
        });
    } else {
        // 浏览器不支持 Clipboard API，使用传统方法
        fallbackCopyToClipboard(text, label);
    }
}

// 传统的复制方法（兼容旧浏览器）
function fallbackCopyToClipboard(text, label) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopySuccess(label);
        } else {
            alert('复制失败，请手动复制');
        }
    } catch (err) {
        alert('复制失败，请手动复制');
    }
    
    document.body.removeChild(textArea);
}

// 显示复制成功提示
function showCopySuccess(label) {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>${label}已复制</span>
    `;
    document.body.appendChild(toast);
    
    // 显示动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // 2秒后移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

// 显示评价弹窗
function showReviewModal(orderId, runnerId) {
    document.getElementById('reviewOrderId').value = orderId;
    document.getElementById('reviewRunnerId').value = runnerId;
    document.getElementById('reviewRating').value = 0;
    document.getElementById('reviewComment').value = '';
    
    // 重置星星
    document.querySelectorAll('.rating-stars .star').forEach(star => {
        star.classList.remove('active');
    });
    document.getElementById('ratingText').textContent = '请选择评分';
    
    // 关闭订单详情弹窗，显示评价弹窗
    document.getElementById('orderDetailModal').classList.add('hidden');
    document.getElementById('reviewModal').classList.remove('hidden');
}

// 提交评价
async function submitReview() {
    const orderId = parseInt(document.getElementById('reviewOrderId').value);
    const runnerId = parseInt(document.getElementById('reviewRunnerId').value);
    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value.trim();
    
    if (!rating || rating < 1 || rating > 5) {
        alert('请选择评分');
        return;
    }
    
    try {
        const response = await authFetch(`${API_BASE}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                order_id: orderId,
                runner_id: runnerId,
                rating: rating,
                comment: comment
            })
        });
        
        const result = await response.json();
        if (result.code === 0) {
            showToast('评价成功！', 'success');
            document.getElementById('reviewModal').classList.add('hidden');
            // 刷新订单列表
            if (currentPage === 'orders') {
                renderOrdersPage();
            }
        } else {
            alert(result.message || '评价失败，请重试');
        }
    } catch (error) {
        console.error('提交评价失败:', error);
        alert('评价失败，请重试');
    }
}

// 显示取消订单弹窗
function showCancelOrderModal(orderId) {
    document.getElementById('cancelOrderId').value = orderId;
    document.getElementById('cancelReason').value = '';
    document.getElementById('cancelReasonDetail').value = '';
    
    // 关闭订单详情弹窗，显示取消订单弹窗
    document.getElementById('orderDetailModal').classList.add('hidden');
    document.getElementById('cancelOrderModal').classList.remove('hidden');
}

// 确认取消订单
async function confirmCancelOrder() {
    const orderId = parseInt(document.getElementById('cancelOrderId').value);
    const reason = document.getElementById('cancelReason').value;
    const reasonDetail = document.getElementById('cancelReasonDetail').value.trim();
    
    if (!reason) {
        alert('请选择取消原因');
        return;
    }
    
    const fullReason = reasonDetail ? `${reason}：${reasonDetail}` : reason;
    
    try {
        const response = await authFetch(`${API_BASE}/orders/${orderId}/cancel`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: fullReason })
        });
        
        const result = await response.json();
        if (result.code === 0) {
            showToast('订单已取消', 'success');
            document.getElementById('cancelOrderModal').classList.add('hidden');
            // 刷新订单列表
            if (currentPage === 'orders') {
                renderOrdersPage();
            } else if (currentPage === 'customer') {
                renderCustomerPage();
            }
            loadStats();
        } else {
            alert(result.message || '取消订单失败，请重试');
        }
    } catch (error) {
        console.error('取消订单失败:', error);
        alert('取消订单失败，请重试');
    }
}

// End of file check
console.log('client-main.js loaded successfully');

// ==================== 搜索功能优化 ====================

// 搜索历史管理
const SearchHistory = {
    maxHistory: 10,
    storageKey: 'order_search_history',
    
    // 获取搜索历史
    getHistory() {
        const history = localStorage.getItem(this.storageKey);
        return history ? JSON.parse(history) : [];
    },
    
    // 添加搜索历史
    addHistory(keyword) {
        if (!keyword || keyword.trim() === '') return;
        
        let history = this.getHistory();
        // 移除重复项
        history = history.filter(item => item !== keyword);
        // 添加到开头
        history.unshift(keyword);
        // 限制数量
        if (history.length > this.maxHistory) {
            history = history.slice(0, this.maxHistory);
        }
        
        localStorage.setItem(this.storageKey, JSON.stringify(history));
        this.renderHistory();
    },
    
    // 删除单个历史记录
    deleteHistory(keyword) {
        let history = this.getHistory();
        history = history.filter(item => item !== keyword);
        localStorage.setItem(this.storageKey, JSON.stringify(history));
        this.renderHistory();
    },
    
    // 清空搜索历史
    clearHistory() {
        localStorage.removeItem(this.storageKey);
        this.renderHistory();
    },
    
    // 渲染搜索历史
    renderHistory() {
        const history = this.getHistory();
        const historyList = document.getElementById('searchHistoryList');
        const historyDropdown = document.getElementById('searchHistoryDropdown');
        
        if (!historyList) return;
        
        if (history.length === 0) {
            historyList.innerHTML = '<div style="padding: 20px; text-align: center; color: #9ca3af; font-size: 14px;">暂无搜索历史</div>';
            return;
        }
        
        historyList.innerHTML = history.map(keyword => `
            <div class="search-history-item" data-keyword="${keyword}">
                <div class="search-history-text">
                    <span class="search-history-icon">🔍</span>
                    <span class="search-history-keyword">${keyword}</span>
                </div>
                <button class="search-history-delete" data-keyword="${keyword}">×</button>
            </div>
        `).join('');
        
        // 绑定点击事件
        historyList.querySelectorAll('.search-history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.classList.contains('search-history-delete')) {
                    e.stopPropagation();
                    const keyword = e.target.dataset.keyword;
                    this.deleteHistory(keyword);
                } else {
                    const keyword = item.dataset.keyword;
                    document.getElementById('orderSearchInput').value = keyword;
                    historyDropdown.classList.add('hidden');
                    performSearch(keyword);
                }
            });
        });
    }
};

// 搜索输入框事件
const searchInput = document.getElementById('orderSearchInput');
const searchHistoryDropdown = document.getElementById('searchHistoryDropdown');
const clearSearchBtn = document.getElementById('clearSearchBtn');

if (searchInput) {
    // 获取焦点时显示搜索历史
    searchInput.addEventListener('focus', () => {
        SearchHistory.renderHistory();
        searchHistoryDropdown.classList.remove('hidden');
    });
    
    // 输入时显示/隐藏清除按钮
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
    });
    
    // 回车搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const keyword = e.target.value.trim();
            if (keyword) {
                SearchHistory.addHistory(keyword);
                searchHistoryDropdown.classList.add('hidden');
                performSearch(keyword);
            }
        }
    });
}

// 清除搜索按钮
if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.classList.add('hidden');
        performSearch('');
    });
}

// 搜索按钮
const searchButton = document.getElementById('searchButton');
if (searchButton) {
    searchButton.addEventListener('click', () => {
        const keyword = searchInput.value.trim();
        if (keyword) {
            SearchHistory.addHistory(keyword);
            searchHistoryDropdown.classList.add('hidden');
            performSearch(keyword);
        }
    });
}

// 清空历史按钮
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有搜索历史吗？')) {
            SearchHistory.clearHistory();
        }
    });
}

// 点击外部关闭搜索历史
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box-wrapper')) {
        searchHistoryDropdown.classList.add('hidden');
    }
});

// 执行搜索（带高亮）
function performSearch(keyword) {
    currentSearchKeyword = keyword;
    renderOrdersPage();
}

// 高亮搜索关键词
function highlightKeyword(text, keyword) {
    if (!keyword || !text) return text;
    
    const regex = new RegExp(`(${keyword})`, 'gi');
    return text.replace(regex, '<mark class="highlight">$1</mark>');
}

// ==================== 排序功能 ====================

let currentSortType = 'time_desc';

const sortSelect = document.getElementById('sortSelect');
if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
        currentSortType = e.target.value;
        renderOrdersPage();
    });
}

// 排序订单
function sortOrders(orders, sortType) {
    const sorted = [...orders];
    
    switch (sortType) {
        case 'time_desc':
            sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'time_asc':
            sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'fee_desc':
            sorted.sort((a, b) => b.fee - a.fee);
            break;
        case 'fee_asc':
            sorted.sort((a, b) => a.fee - b.fee);
            break;
        case 'distance_asc':
            sorted.sort((a, b) => a.distance - b.distance);
            break;
        case 'distance_desc':
            sorted.sort((a, b) => b.distance - a.distance);
            break;
    }
    
    return sorted;
}

// ==================== 快捷筛选功能 ====================

let quickFilters = {
    urgent: false,
    cash: false
};

// 加急订单筛选
const urgentFilterBtn = document.getElementById('urgentFilterBtn');
if (urgentFilterBtn) {
    urgentFilterBtn.addEventListener('click', () => {
        quickFilters.urgent = !quickFilters.urgent;
        urgentFilterBtn.classList.toggle('active', quickFilters.urgent);
        updateFilterCount();
        renderOrdersPage();
    });
}

// 现金到付筛选
const cashFilterBtn = document.getElementById('cashFilterBtn');
if (cashFilterBtn) {
    cashFilterBtn.addEventListener('click', () => {
        quickFilters.cash = !quickFilters.cash;
        cashFilterBtn.classList.toggle('active', quickFilters.cash);
        updateFilterCount();
        renderOrdersPage();
    });
}

// ==================== 高级筛选功能 ====================

// 高级筛选复选框同步
const filterUrgentCheckbox = document.getElementById('filterUrgent');
const filterCashCheckbox = document.getElementById('filterCash');

if (filterUrgentCheckbox) {
    filterUrgentCheckbox.addEventListener('change', (e) => {
        quickFilters.urgent = e.target.checked;
        urgentFilterBtn.classList.toggle('active', quickFilters.urgent);
        updateFilterCount();
    });
}

if (filterCashCheckbox) {
    filterCashCheckbox.addEventListener('change', (e) => {
        quickFilters.cash = e.target.checked;
        cashFilterBtn.classList.toggle('active', quickFilters.cash);
        updateFilterCount();
    });
}

// 应用筛选按钮
const applyFiltersBtn = document.getElementById('applyFilters');
if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', () => {
        // 同步复选框状态到快捷按钮
        if (filterUrgentCheckbox) {
            quickFilters.urgent = filterUrgentCheckbox.checked;
            urgentFilterBtn.classList.toggle('active', quickFilters.urgent);
        }
        if (filterCashCheckbox) {
            quickFilters.cash = filterCashCheckbox.checked;
            cashFilterBtn.classList.toggle('active', quickFilters.cash);
        }
        
        updateFilterCount();
        renderOrdersPage();
    });
}

// 重置筛选按钮
const resetFiltersBtn = document.getElementById('resetFilters');
if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', () => {
        // 重置所有筛选条件
        quickFilters = { urgent: false, cash: false };
        urgentFilterBtn.classList.remove('active');
        cashFilterBtn.classList.remove('active');
        
        if (filterUrgentCheckbox) filterUrgentCheckbox.checked = false;
        if (filterCashCheckbox) filterCashCheckbox.checked = false;
        
        document.getElementById('minFee').value = '';
        document.getElementById('maxFee').value = '';
        document.getElementById('minDistance').value = '';
        document.getElementById('maxDistance').value = '';
        document.getElementById('timeFilterSelect').value = 'all';
        
        updateFilterCount();
        renderOrdersPage();
    });
}

// 更新筛选条件数量提示
function updateFilterCount() {
    let count = 0;
    
    // 统计快捷筛选
    if (quickFilters.urgent) count++;
    if (quickFilters.cash) count++;
    
    // 统计高级筛选
    const minFee = document.getElementById('minFee').value;
    const maxFee = document.getElementById('maxFee').value;
    const minDistance = document.getElementById('minDistance').value;
    const maxDistance = document.getElementById('maxDistance').value;
    const timeFilter = document.getElementById('timeFilterSelect').value;
    
    if (minFee || maxFee) count++;
    if (minDistance || maxDistance) count++;
    if (timeFilter !== 'all') count++;
    
    const badge = document.getElementById('filterCountBadge');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// 轮播图功能
let carouselIndex = 0;
let carouselTimer = null;

function initCarousel() {
    const wrapper = document.getElementById('carouselWrapper');
    const dots = document.querySelectorAll('.carousel-dots .dot');
    
    if (!wrapper || dots.length === 0) return;
    
    // 绑定点击事件
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            carouselIndex = index;
            updateCarousel();
            resetCarouselTimer();
        });
    });
    
    // 自动轮播
    startCarouselTimer();
}

function updateCarousel() {
    const wrapper = document.getElementById('carouselWrapper');
    const dots = document.querySelectorAll('.carousel-dots .dot');
    
    if (!wrapper) return;
    
    wrapper.style.transform = `translateX(-${carouselIndex * 100}%)`;
    
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === carouselIndex);
    });
}

function startCarouselTimer() {
    carouselTimer = setInterval(() => {
        carouselIndex = (carouselIndex + 1) % 3;
        updateCarousel();
    }, 5000);
}

function resetCarouselTimer() {
    clearInterval(carouselTimer);
    startCarouselTimer();
}