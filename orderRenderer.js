// 订单渲染模块
import { orderData } from './orderData.js';

// 渲染订单卡片
export function renderOrderCard(order, showActions = false) {
    const statusMap = {
        pending: { text: '待接单', class: 'status-pending' },
        ongoing: { text: '配送中', class: 'status-ongoing' },
        completed: { text: '已完成', class: 'status-completed' }
    };

    const status = statusMap[order.status];

    return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-status">
                    <span class="status-badge ${status.class}">${status.text}</span>
                    ${order.isUrgent ? '<span class="urgent-badge">加急</span>' : ''}
                </div>
                <div class="order-title">${order.title}</div>
                <div class="order-price">¥${order.fee}</div>
            </div>
            <div class="order-address">
                <div class="address-item">
                    <div class="address-icon">🟢</div>
                    <div>
                        <div class="address-label">取件地址</div>
                        <div class="address-text">${order.pickupAddress}</div>
                    </div>
                </div>
                <div class="address-item">
                    <div class="address-icon">🟠</div>
                    <div>
                        <div class="address-label">送达地址</div>
                        <div class="address-text">${order.deliveryAddress}</div>
                    </div>
                </div>
            </div>
            <div class="order-info">
                <span>📍 ${order.distance}公里</span>
                <span>🕐 ${order.time}</span>
            </div>
            ${order.remark ? `<div class="order-remark">备注：${order.remark}</div>` : ''}
            ${showActions && order.status === 'pending' ? `
                <div class="order-actions">
                    <button class="accept-btn" onclick="acceptOrder(${order.id})">接单</button>
                </div>
            ` : ''}
        </div>
    `;
}

// 渲染订单列表
export function renderOrderList(containerId, orders, showActions = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #9ca3af;">暂无订单</div>';
        return;
    }

    container.innerHTML = orders.map(order => renderOrderCard(order, showActions)).join('');
}

// 更新订单统计数量
export function updateOrderCounts(type = 'customer') {
    const orders = orderData.getOrdersByType(type);
    
    const allCount = orders.length;
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const ongoingCount = orders.filter(o => o.status === 'ongoing').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    const allCountEl = document.getElementById('allCount');
    const pendingCountEl = document.getElementById('pendingCount');
    const ongoingCountEl = document.getElementById('ongoingCount');
    const completedCountEl = document.getElementById('completedCount');

    if (allCountEl) allCountEl.textContent = allCount;
    if (pendingCountEl) pendingCountEl.textContent = pendingCount;
    if (ongoingCountEl) ongoingCountEl.textContent = ongoingCount;
    if (completedCountEl) completedCountEl.textContent = completedCount;
}