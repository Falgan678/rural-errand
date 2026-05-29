// 主程序入口
import { orderData } from './orderData.js';
import { renderOrderList, updateOrderCounts } from './orderRenderer.js';
import { showMapModal, closeMapModal } from './mapModule.js';

// 全局状态
let currentRole = 'customer'; // customer 或 runner
let currentPage = 'customer'; // customer, runner, orders, profile
let currentOrderType = 'my-orders'; // my-orders 或 my-tasks
let currentOrderStatus = 'all'; // all, pending, ongoing, completed
let searchKeyword = ''; // 搜索关键词
let timeFilter = { type: 'all', start: null, end: null }; // 时间筛选条件
let flatpickrInstance = null; // 日历实例

// 初始化应用
function initApp() {
    // 渲染初始页面
    renderCustomerPage();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 初始化日历组件
    initFlatpickr();
}

// 初始化 Flatpickr
function initFlatpickr() {
    flatpickrInstance = flatpickr("#customDateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: "zh",
        onClose: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                timeFilter = {
                    type: 'custom',
                    start: selectedDates[0],
                    end: selectedDates[1]
                };
                // 更新下拉框显示
                const select = document.getElementById('timeFilterSelect');
                // 查找是否有 custom 选项，如果没有则添加
                let customOption = select.querySelector('option[value="custom"]');
                if (!customOption) {
                    customOption = document.createElement('option');
                    customOption.value = 'custom';
                    customOption.text = '自定义时间';
                    select.add(customOption);
                }
                select.value = 'custom';
                customOption.text = `${flatpickr.formatDate(selectedDates[0], "Y-m-d")} 至 ${flatpickr.formatDate(selectedDates[1], "Y-m-d")}`;
                
                // 触发筛选
                renderOrdersPage();
            }
        }
    });
}

// 绑定事件监听器
function bindEventListeners() {
    // 顶部角色切换按钮
    document.querySelectorAll('.nav-btn').forEach(btn => {
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

    // 发布需求按钮
    const publishBtn = document.getElementById('publishBtn');
    if (publishBtn) {
        publishBtn.addEventListener('click', showPublishModal);
    }

    // 地图按钮
    const mapBtn = document.getElementById('mapBtn');
    if (mapBtn) {
        mapBtn.addEventListener('click', showMapModal);
    }

    // 关闭弹窗按钮
    const closeModal = document.getElementById('closeModal');
    if (closeModal) {
        closeModal.addEventListener('click', hidePublishModal);
    }

    const closeMapModalBtn = document.getElementById('closeMapModal');
    if (closeMapModalBtn) {
        closeMapModalBtn.addEventListener('click', closeMapModal);
    }

    // 提交订单按钮
    const submitBtn = document.getElementById('submitOrder');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitOrder);
    }

    // 备注字数统计
    const remarkInput = document.getElementById('remark');
    const remarkCount = document.getElementById('remarkCount');
    if (remarkInput && remarkCount) {
        remarkInput.addEventListener('input', (e) => {
            remarkCount.textContent = e.target.value.length;
        });
    }

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
            const status = e.target.dataset.status;
            switchOrderStatus(status);
        });
    });

    // 搜索框输入事件
    const searchInput = document.getElementById('orderSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchKeyword = e.target.value.trim();
            renderOrdersPage();
        });
    }

    // 时间筛选下拉框事件
    const timeSelect = document.getElementById('timeFilterSelect');
    if (timeSelect) {
        timeSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            if (value === 'custom') {
                // 打开日历选择器
                if (flatpickrInstance) {
                    flatpickrInstance.open();
                }
            } else {
                timeFilter = { type: value, start: null, end: null };
                renderOrdersPage();
            }
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
    
    // 更新按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.role === role);
    });

    // 切换页面
    if (role === 'customer') {
        currentPage = 'customer';
        renderCustomerPage();
    } else {
        currentPage = 'runner';
        renderRunnerPage();
    }

    // 更新页面显示
    updatePageDisplay();
}

// 切换页面
function switchPage(page) {
    currentPage = page;
    
    // 更新底部导航状态
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === page);
    });

    // 更新顶部导航状态
    if (page === 'customer' || page === 'runner') {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === page);
        });
        currentRole = page;
    }

    // 渲染对应页面
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
function renderCustomerPage() {
    const orders = orderData.getOrdersByStatus('pending', 'customer').slice(0, 3);
    renderOrderList('customerOrderList', orders, false);
}

// 渲染我当跑腿页面
function renderRunnerPage() {
    const orders = orderData.getOrdersByStatus('pending', 'customer');
    renderOrderList('runnerOrderList', orders, true);
}

// 渲染订单页面
function renderOrdersPage() {
    updateOrderCounts(currentOrderType === 'my-orders' ? 'customer' : 'runner');
    
    const criteria = {
        type: currentOrderType === 'my-orders' ? 'customer' : 'runner',
        status: currentOrderStatus,
        keyword: searchKeyword,
        timeRange: timeFilter
    };
    
    const orders = orderData.filterOrders(criteria);
    renderOrderList('ordersPageList', orders, false);
}

// 渲染我的页面
function renderProfilePage() {
    // 我的页面是静态的，不需要额外渲染
}

// 切换订单类型
function switchOrderType(type) {
    currentOrderType = type;
    
    // 更新按钮状态
    document.querySelectorAll('.role-switch-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // 重新渲染订单列表
    renderOrdersPage();
}

// 切换订单状态
function switchOrderStatus(status) {
    currentOrderStatus = status;
    
    // 更新按钮状态
    document.querySelectorAll('.order-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
    });

    // 重新渲染订单列表
    renderOrdersPage();
}

// 显示发布弹窗
function showPublishModal() {
    const modal = document.getElementById('publishModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

// 隐藏发布弹窗
function hidePublishModal() {
    const modal = document.getElementById('publishModal');
    if (modal) {
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
}

// 提交订单
function submitOrder() {
    const contactPhone = document.getElementById('contactPhone').value;
    const pickupAddress = document.getElementById('pickupAddress').value;
    const deliveryAddress = document.getElementById('deliveryAddress').value;
    const deliveryTime = document.getElementById('deliveryTime').value;
    const goodsName = document.getElementById('goodsName').value;
    const deliveryFee = document.getElementById('deliveryFee').value;
    const isUrgent = document.getElementById('isUrgent').checked;
    const remark = document.getElementById('remark').value;

    // 验证表单
    if (!contactPhone || !pickupAddress || !deliveryAddress || !deliveryTime || !goodsName || !deliveryFee) {
        alert('请填写完整信息');
        return;
    }

    // 创建新订单
    const newOrder = {
        title: goodsName,
        pickupAddress: pickupAddress,
        deliveryAddress: deliveryAddress,
        distance: (Math.random() * 10 + 1).toFixed(1),
        time: deliveryTime,
        fee: parseFloat(deliveryFee),
        isUrgent: isUrgent,
        remark: remark,
        type: 'customer'
    };

    // 添加订单
    orderData.addOrder(newOrder);

    // 关闭弹窗
    hidePublishModal();

    // 显示成功提示
    alert('订单发布成功！');

    // 刷新页面
    renderCustomerPage();
}

// 接单功能
window.acceptOrder = function(orderId) {
    if (confirm('确认接单吗？')) {
        orderData.updateOrderStatus(orderId, 'ongoing');
        alert('接单成功！');
        renderRunnerPage();
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', initApp);