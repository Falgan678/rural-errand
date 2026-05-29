<template>
  <view class="orders-page">
    <!-- 角色切换 -->
    <view class="role-switch">
      <view
        class="role-item"
        :class="{ active: currentRole === 'customer' }"
        @tap="switchRole('customer')"
      >我有需求</view>
      <view
        class="role-item"
        :class="{ active: currentRole === 'runner' }"
        @tap="switchRole('runner')"
      >我来帮忙</view>
    </view>

    <!-- 状态筛选 -->
    <scroll-view scroll-x class="status-tabs">
      <view class="tab-list">
        <view
          v-for="tab in statusTabs"
          :key="tab.value"
          class="tab-item"
          :class="{ active: currentStatus === tab.value }"
          @tap="switchStatus(tab.value)"
        >
          {{ tab.label }}
          <text v-if="tab.count > 0" class="tab-count">{{ tab.count }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 搜索框 -->
    <view class="search-bar">
      <view class="search-input-wrap">
        <text class="search-icon">🔍</text>
        <input
          class="search-input"
          v-model="keyword"
          placeholder="搜索订单..."
          placeholder-class="placeholder"
          @input="onSearch"
        />
        <text v-if="keyword" class="clear-icon" @tap="clearSearch">✕</text>
      </view>
    </view>

    <!-- 订单列表 -->
    <view class="order-list">
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>

      <view v-else-if="orders.length === 0" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无相关订单</text>
      </view>

      <view
        v-else
        v-for="order in orders"
        :key="order.id"
        class="order-card"
        @tap="goOrderDetail(order.id)"
      >
        <view class="order-header">
          <view class="order-title-row">
            <text class="order-title">{{ order.title }}</text>
            <text v-if="order.is_urgent" class="badge-urgent">加急</text>
          </view>
          <text class="order-price">¥{{ order.fee }}</text>
        </view>

        <view class="order-address">
          <view class="address-row">
            <view class="address-dot dot-green"></view>
            <text class="address-text">{{ order.pickup_address }}</text>
          </view>
          <view class="address-line"></view>
          <view class="address-row">
            <view class="address-dot dot-orange"></view>
            <text class="address-text">{{ order.delivery_address }}</text>
          </view>
        </view>

        <view class="order-footer">
          <view class="order-meta">
            <text class="meta-item">📍 {{ order.distance ? order.distance.toFixed(1) + 'km' : '--' }}</text>
            <text class="meta-item">🕐 {{ formatTime(order.created_at) }}</text>
          </view>
          <view :class="getStatusClass(order.status)">{{ getStatusText(order.status) }}</view>
        </view>

        <!-- 操作按钮 -->
        <view class="order-actions" v-if="showActions(order)">
          <button
            v-if="order.status === 'pending' && currentRole === 'customer'"
            class="action-btn cancel-btn"
            @tap.stop="cancelOrder(order)"
          >取消订单</button>
          <button
            v-if="order.status === 'ongoing' && currentRole === 'runner'"
            class="action-btn cancel-btn"
            @tap.stop="runnerCancel(order)"
          >放弃接单</button>
          <button
            v-if="order.status === 'ongoing' && currentRole === 'runner'"
            class="action-btn complete-btn"
            @tap.stop="completeOrder(order)"
          >已送达</button>
          <button
            v-if="order.status === 'completed' && currentRole === 'customer' && !order.reviewed"
            class="action-btn review-btn"
            @tap.stop="goReview(order)"
          >去评价</button>
        </view>
      </view>

      <!-- 加载更多 -->
      <view v-if="hasMore && !loading" class="load-more" @tap="loadMore">
        <text>加载更多</text>
      </view>
    </view>

    <!-- 底部签名 -->
    <view class="footer">
      <text>由 <text style="color: #8A2BE2;">甘发龙</text> 通过自然语言生成</text>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { orderApi } from '../../utils/api.js'

const loading = ref(false)
const orders = ref([])
const currentRole = ref('customer')
const currentStatus = ref('all')
const keyword = ref('')
const page = ref(1)
const hasMore = ref(false)
let searchTimer = null

const statusTabs = computed(() => [
  { label: '全部', value: 'all', count: 0 },
  { label: '待接单', value: 'pending', count: orders.value.filter(o => o.status === 'pending').length },
  { label: '配送中', value: 'ongoing', count: orders.value.filter(o => o.status === 'ongoing').length },
  { label: '已完成', value: 'completed', count: 0 },
  { label: '已取消', value: 'cancelled', count: 0 }
])

onMounted(() => {
  loadOrders()
})

// 切换 tab 回到本页时自动刷新，保证客户端与后端状态对齐
onShow(() => {
  loadOrders()
})

async function loadOrders(reset = true) {
  if (reset) {
    page.value = 1
    orders.value = []
  }
  loading.value = true
  try {
    const params = {
      role: currentRole.value,
      page: page.value,
      page_size: 15
    }
    if (currentStatus.value !== 'all') params.status = currentStatus.value
    if (keyword.value) params.keyword = keyword.value

    const res = await orderApi.getOrders(params)
    if (res.code === 0) {
      const newOrders = res.data?.orders || []
      if (reset) {
        orders.value = newOrders
      } else {
        orders.value = [...orders.value, ...newOrders]
      }
      hasMore.value = newOrders.length === 15
    }
  } catch (e) {
    console.error('加载失败', e)
  } finally {
    loading.value = false
  }
}

function switchRole(role) {
  currentRole.value = role
  currentStatus.value = 'all'
  loadOrders()
}

function switchStatus(status) {
  currentStatus.value = status
  loadOrders()
}

function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadOrders(), 500)
}

function clearSearch() {
  keyword.value = ''
  loadOrders()
}

function loadMore() {
  page.value++
  loadOrders(false)
}

function showActions(order) {
  if (currentRole.value === 'customer' && order.status === 'pending') return true
  if (currentRole.value === 'runner' && order.status === 'ongoing') return true
  if (currentRole.value === 'customer' && order.status === 'completed' && !order.reviewed) return true
  return false
}

async function cancelOrder(order) {
  uni.showModal({
    title: '取消订单',
    content: '确认取消该订单？',
    editable: true,
    placeholderText: '请输入取消原因（可选）',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.cancelOrder(order.id, res.value || '')
          if (result.code === 0) {
            uni.showToast({ title: '订单已取消', icon: 'success' })
            loadOrders()
          } else {
            uni.showToast({ title: result.message || '取消失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function completeOrder(order) {
  uni.showModal({
    title: '确认送达',
    content: '确认已完成配送？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.completeOrder(order.id)
          if (result.code === 0) {
            uni.showToast({ title: '订单完成！', icon: 'success' })
            loadOrders()
          } else {
            uni.showToast({ title: result.message || '操作失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

async function runnerCancel(order) {
  uni.showModal({
    title: '放弃接单',
    content: '订单将退回为待接单状态，确认放弃？',
    editable: true,
    placeholderText: '请简述放弃原因（可选）',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.runnerCancelOrder(order.id, res.value || '')
          if (result.code === 0) {
            uni.showToast({ title: '已退回订单', icon: 'success' })
            loadOrders()
          } else {
            uni.showToast({ title: result.message || '操作失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    }
  })
}

function goReview(order) {
  uni.navigateTo({ url: `/pages/reviews/reviews?order_id=${order.id}&runner_id=${order.runner_id}` })
}

function goOrderDetail(id) {
  uni.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
}

function getStatusText(status) {
  const map = { pending: '待接单', ongoing: '配送中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

function getStatusClass(status) {
  const map = { pending: 'badge-pending', ongoing: 'badge-ongoing', completed: 'badge-completed', cancelled: 'badge-cancelled' }
  return map[status] || 'badge-pending'
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return `${Math.floor(diff / 86400000)}天前`
}
</script>

<style lang="scss" scoped>
.orders-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.role-switch {
  display: flex;
  background: #fff;
  padding: 16rpx 32rpx;
  gap: 0;
  border-bottom: 1rpx solid #f0f0f0;

  .role-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    font-size: 28rpx;
    color: #999;
    border-radius: 8rpx;

    &.active {
      color: #4CAF50;
      font-weight: 600;
      background: #f0f9f0;
    }
  }
}

.status-tabs {
  background: #fff;
  white-space: nowrap;
  border-bottom: 1rpx solid #f0f0f0;

  .tab-list {
    display: flex;
    padding: 0 16rpx;
  }

  .tab-item {
    display: inline-flex;
    align-items: center;
    gap: 6rpx;
    padding: 20rpx 24rpx;
    font-size: 26rpx;
    color: #999;
    position: relative;
    white-space: nowrap;

    &.active {
      color: #4CAF50;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 20%;
        width: 60%;
        height: 4rpx;
        background: #4CAF50;
        border-radius: 2rpx;
      }
    }

    .tab-count {
      background: #f44336;
      color: #fff;
      font-size: 18rpx;
      padding: 2rpx 8rpx;
      border-radius: 20rpx;
      min-width: 28rpx;
      text-align: center;
    }
  }
}

.search-bar {
  padding: 16rpx 32rpx;
  background: #fff;
  margin-bottom: 16rpx;

  .search-input-wrap {
    display: flex;
    align-items: center;
    background: #f5f5f5;
    border-radius: 50rpx;
    padding: 0 24rpx;
    height: 72rpx;

    .search-icon {
      font-size: 28rpx;
      margin-right: 12rpx;
    }

    .search-input {
      flex: 1;
      font-size: 26rpx;
      color: #333;
    }

    .clear-icon {
      font-size: 28rpx;
      color: #999;
      padding: 8rpx;
    }
  }
}

.order-list {
  padding: 0 32rpx;
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);

  .order-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20rpx;

    .order-title-row {
      display: flex;
      align-items: center;
      gap: 12rpx;
      flex: 1;
    }

    .order-title {
      font-size: 30rpx;
      font-weight: 600;
      color: #333;
    }

    .order-price {
      font-size: 36rpx;
      font-weight: 700;
      color: #f44336;
      flex-shrink: 0;
    }
  }

  .order-address {
    background: #f8f8f8;
    border-radius: 12rpx;
    padding: 16rpx 20rpx;
    margin-bottom: 16rpx;

    .address-row {
      display: flex;
      align-items: center;
      gap: 16rpx;
      padding: 6rpx 0;

      .address-dot {
        width: 16rpx;
        height: 16rpx;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .dot-green { background: #4CAF50; }
      .dot-orange { background: #ff9800; }

      .address-text {
        font-size: 26rpx;
        color: #666;
        flex: 1;
      }
    }

    .address-line {
      width: 2rpx;
      height: 16rpx;
      background: #ddd;
      margin-left: 7rpx;
    }
  }

  .order-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .order-meta {
      display: flex;
      gap: 20rpx;

      .meta-item {
        font-size: 24rpx;
        color: #999;
      }
    }
  }

  .order-actions {
    display: flex;
    gap: 16rpx;
    margin-top: 16rpx;
    padding-top: 16rpx;
    border-top: 1rpx solid #f0f0f0;
    justify-content: flex-end;

    .action-btn {
      font-size: 24rpx;
      border-radius: 50rpx;
      padding: 0 28rpx;
      height: 60rpx;
      line-height: 60rpx;
      border: none;
    }

    .cancel-btn {
      background: #fff0f0;
      color: #f44336;
      border: 2rpx solid #f44336;
    }

    .complete-btn {
      background: linear-gradient(135deg, #4CAF50, #2E7D32);
      color: #fff;
    }

    .review-btn {
      background: linear-gradient(135deg, #FF9800, #F57C00);
      color: #fff;
    }
  }
}

.load-more {
  text-align: center;
  padding: 24rpx;
  color: #4CAF50;
  font-size: 26rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  color: #bdbdbd;

  .empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
  .empty-text { font-size: 28rpx; }
}

.loading-state {
  text-align: center;
  padding: 40rpx;
  color: #999;
  font-size: 26rpx;
}

.footer {
  text-align: center;
  padding: 40rpx 0 20rpx;
  font-size: 22rpx;
  color: #bdbdbd;
}

.badge-pending { background: #fff3e0; color: #ff9800; padding: 4rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; }
.badge-ongoing { background: #e3f2fd; color: #2196f3; padding: 4rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; }
.badge-completed { background: #e8f5e9; color: #4caf50; padding: 4rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; }
.badge-cancelled { background: #f5f5f5; color: #9e9e9e; padding: 4rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; }
.badge-urgent { background: #ffebee; color: #f44336; padding: 4rpx 16rpx; border-radius: 20rpx; font-size: 22rpx; }

.placeholder { color: #bdbdbd; }
</style>
