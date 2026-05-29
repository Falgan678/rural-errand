<template>
  <view class="runner-page">
    <!-- 顶部信息 -->
    <view class="runner-header">
      <view class="header-info">
        <text class="header-title">附近邻里需求</text>
        <text class="header-sub">接单赚钱，灵活自由</text>
      </view>
      <view class="earnings-badge">
        <text class="earnings-label">本月收益</text>
        <text class="earnings-num">¥{{ monthEarnings }}</text>
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <scroll-view scroll-x class="filter-scroll">
        <view class="filter-list">
          <view
            v-for="item in filterOptions"
            :key="item.value"
            class="filter-item"
            :class="{ active: currentFilter === item.value }"
            @tap="currentFilter = item.value; loadOrders()"
          >{{ item.label }}</view>
        </view>
      </scroll-view>
    </view>

    <!-- 订单列表 -->
    <view class="order-list">
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>

      <view v-else-if="orders.length === 0" class="empty-state">
        <text class="empty-icon">🔍</text>
        <text class="empty-text">暂无待接订单</text>
      </view>

      <view
        v-else
        v-for="order in orders"
        :key="order.id"
        class="order-card"
      >
        <view class="order-top" @tap="goOrderDetail(order.id)">
          <view class="order-title-row">
            <text class="order-title">{{ order.title }}</text>
            <text v-if="order.is_urgent" class="badge-urgent">加急</text>
          </view>
          <text class="order-price">¥{{ order.fee }}</text>
        </view>

        <view class="order-address" @tap="goOrderDetail(order.id)">
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

        <view class="order-meta-row">
          <view class="meta-items">
            <text class="meta-item">📍 {{ order.distance ? order.distance.toFixed(1) + 'km' : '--' }}</text>
            <text class="meta-item">🕐 {{ formatTime(order.created_at) }}</text>
            <text v-if="order.payment_method === 'cash'" class="meta-item cash-tag">💵 现金到付</text>
          </view>
          <button class="accept-btn" @tap.stop="acceptOrder(order)">接 单</button>
        </view>

        <view v-if="order.remark" class="order-remark">
          <text>备注：{{ order.remark }}</text>
        </view>
      </view>
    </view>

    <!-- 我接的单 -->
    <view class="section" v-if="myTasks.length > 0">
      <view class="section-header">
        <text class="section-title">我接的单</text>
        <text class="section-more" @tap="goOrders">查看全部 ›</text>
      </view>

      <view
        v-for="task in myTasks"
        :key="task.id"
        class="task-card"
        @tap="goOrderDetail(task.id)"
      >
        <view class="task-header">
          <text class="task-title">{{ task.title }}</text>
          <view :class="getStatusClass(task.status)">{{ getStatusText(task.status) }}</view>
        </view>
        <view class="task-address">
          <text class="task-addr">{{ task.pickup_address }} → {{ task.delivery_address }}</text>
        </view>
        <view class="task-footer">
          <text class="task-price">¥{{ task.fee }}</text>
          <button
            v-if="task.status === 'ongoing'"
            class="complete-btn"
            @tap.stop="completeOrder(task)"
          >已送达</button>
        </view>
      </view>
    </view>

    <!-- 底部签名 -->
    <view class="footer">
      <text>由 <text style="color: #8A2BE2;">甘发龙</text> 通过自然语言生成</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user.js'
import { orderApi } from '../../utils/api.js'

const userStore = useUserStore()

const loading = ref(false)
const orders = ref([])
const myTasks = ref([])
const currentFilter = ref('all')
const monthEarnings = ref('0.00')

const filterOptions = [
  { label: '全部', value: 'all' },
  { label: '附近5km', value: '5' },
  { label: '附近10km', value: '10' },
  { label: '加急', value: 'urgent' }
]

onMounted(async () => {
  await Promise.all([loadOrders(), loadMyTasks()])
  monthEarnings.value = (userStore.userInfo?.month_earnings || 0).toFixed(2)
})

// 切回本 tab 时自动刷新，避免发布者取消订单后跑腿员还看到旧数据
onShow(() => {
  loadOrders()
  loadMyTasks()
  monthEarnings.value = (userStore.userInfo?.month_earnings || 0).toFixed(2)
})

async function loadOrders() {
  loading.value = true
  try {
    const params = { role: 'runner', status: 'pending', page_size: 20 }
    if (currentFilter.value === 'urgent') params.is_urgent = true
    const res = await orderApi.getOrders(params)
    if (res.code === 0) {
      orders.value = res.data?.orders || []
    }
  } catch (e) {
    console.error('加载失败', e)
  } finally {
    loading.value = false
  }
}

async function loadMyTasks() {
  try {
    const res = await orderApi.getOrders({ role: 'runner', my_tasks: true, page_size: 5 })
    if (res.code === 0) {
      myTasks.value = (res.data?.orders || []).filter(o => o.status === 'ongoing')
    }
  } catch (e) {
    console.error('加载我的任务失败', e)
  }
}

async function acceptOrder(order) {
  uni.showModal({
    title: '确认接单',
    content: `确认接取「${order.title}」？`,
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.acceptOrder(order.id)
          if (result.code === 0) {
            uni.showToast({ title: '接单成功！', icon: 'success' })
            await Promise.all([loadOrders(), loadMyTasks()])
          } else {
            uni.showToast({ title: result.message || '接单失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '接单失败，请重试', icon: 'none' })
        }
      }
    }
  })
}

async function completeOrder(task) {
  uni.showModal({
    title: '确认送达',
    content: '确认已完成配送？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.completeOrder(task.id)
          if (result.code === 0) {
            uni.showToast({ title: '订单完成！', icon: 'success' })
            await loadMyTasks()
          } else {
            uni.showToast({ title: result.message || '操作失败', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '操作失败，请重试', icon: 'none' })
        }
      }
    }
  })
}

function goOrderDetail(id) {
  uni.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
}

function goOrders() {
  uni.switchTab({ url: '/pages/orders/orders' })
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
.runner-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.runner-header {
  background: linear-gradient(135deg, #FF9800, #F57C00);
  padding: 40rpx 32rpx 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-title {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #fff;
  }

  .header-sub {
    font-size: 24rpx;
    color: rgba(255,255,255,0.8);
  }

  .earnings-badge {
    background: rgba(255,255,255,0.2);
    border-radius: 16rpx;
    padding: 16rpx 24rpx;
    text-align: center;

    .earnings-label {
      display: block;
      font-size: 22rpx;
      color: rgba(255,255,255,0.8);
    }

    .earnings-num {
      font-size: 36rpx;
      font-weight: 700;
      color: #fff;
    }
  }
}

.filter-bar {
  background: #fff;
  padding: 16rpx 0;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);

  .filter-scroll {
    white-space: nowrap;
  }

  .filter-list {
    display: flex;
    padding: 0 24rpx;
    gap: 16rpx;
  }

  .filter-item {
    display: inline-flex;
    align-items: center;
    padding: 10rpx 28rpx;
    border-radius: 50rpx;
    font-size: 26rpx;
    color: #666;
    background: #f5f5f5;
    white-space: nowrap;

    &.active {
      background: #FF9800;
      color: #fff;
      font-weight: 600;
    }
  }
}

.order-list {
  padding: 24rpx 32rpx;
}

.order-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);

  .order-top {
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

  .order-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .meta-items {
      display: flex;
      gap: 16rpx;
      flex-wrap: wrap;
    }

    .meta-item {
      font-size: 24rpx;
      color: #999;
    }

    .cash-tag {
      color: #FF9800;
    }

    .accept-btn {
      background: linear-gradient(135deg, #FF9800, #F57C00);
      color: #fff;
      border-radius: 50rpx;
      font-size: 26rpx;
      font-weight: 600;
      border: none;
      padding: 0 32rpx;
      height: 64rpx;
      line-height: 64rpx;
    }
  }

  .order-remark {
    margin-top: 12rpx;
    padding-top: 12rpx;
    border-top: 1rpx solid #f0f0f0;
    font-size: 24rpx;
    color: #999;
  }
}

.section {
  padding: 0 32rpx;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .section-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }

    .section-more {
      font-size: 26rpx;
      color: #FF9800;
    }
  }
}

.task-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);

  .task-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12rpx;

    .task-title {
      font-size: 28rpx;
      font-weight: 600;
      color: #333;
    }
  }

  .task-address {
    margin-bottom: 12rpx;

    .task-addr {
      font-size: 24rpx;
      color: #999;
    }
  }

  .task-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .task-price {
      font-size: 32rpx;
      font-weight: 700;
      color: #f44336;
    }

    .complete-btn {
      background: linear-gradient(135deg, #4CAF50, #2E7D32);
      color: #fff;
      border-radius: 50rpx;
      font-size: 26rpx;
      border: none;
      padding: 0 28rpx;
      height: 60rpx;
      line-height: 60rpx;
    }
  }
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
</style>
