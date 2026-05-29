<template>
  <view class="home-page">
    <!-- 顶部用户信息 -->
    <view class="user-header">
      <view class="user-info">
        <view class="avatar">
          <image v-if="userStore.userInfo?.avatar" :src="userStore.userInfo.avatar" class="avatar-img" mode="aspectFill" />
          <text v-else class="avatar-emoji">👤</text>
        </view>
        <view class="user-text">
          <text class="user-name">{{ userStore.userInfo?.username || '用户' }}</text>
          <text class="user-location">📍 {{ userStore.userInfo?.location || '未设置位置' }}</text>
        </view>
      </view>
      <button class="publish-btn" @tap="goPublish">+ 发布需求</button>
    </view>

    <!-- 统计卡片 -->
    <view class="stats-row">
      <view class="stat-card">
        <text class="stat-num">{{ stats.pendingOrders }}</text>
        <text class="stat-label">待接单</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ stats.todayOrders }}</text>
        <text class="stat-label">今日订单</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ stats.totalServices }}</text>
        <text class="stat-label">总服务</text>
      </view>
    </view>

    <!-- 我的需求列表 -->
    <view class="section">
      <view class="section-header">
        <text class="section-title">我的需求</text>
        <text class="section-more" @tap="goOrders">查看全部 ›</text>
      </view>

      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>

      <!-- 空状态 -->
      <view v-else-if="myOrders.length === 0" class="empty-state">
        <text class="empty-icon">📦</text>
        <text class="empty-text">暂无需求，点击上方按钮发布</text>
      </view>

      <!-- 订单列表 -->
      <view v-else>
        <view
          v-for="order in myOrders"
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

          <view v-if="order.remark" class="order-remark">
            <text>备注：{{ order.remark }}</text>
          </view>
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
import { onShow, onPullDownRefresh } from '@dcloudio/uni-app'
import { useUserStore } from '../../stores/user.js'
import { orderApi } from '../../utils/api.js'

const userStore = useUserStore()

const loading = ref(false)
const myOrders = ref([])
const stats = ref({
  pendingOrders: 0,
  todayOrders: 0,
  totalServices: 0
})

onShow(async () => {
  console.log('[home] onShow triggered, reloading data...')
  await loadData()
})

onPullDownRefresh(async () => {
  console.log('[home] pull down refresh')
  await loadData()
  uni.stopPullDownRefresh()
})

async function loadData() {
  loading.value = true
  try {
    const res = await orderApi.getOrders({ role: 'customer', page_size: 10 })
    console.log('[home] getOrders response:', JSON.stringify(res))
    if (res.code === 0) {
      myOrders.value = res.data?.orders || []
      console.log('[home] loaded', myOrders.value.length, 'orders')
      // 统计数据
      const pending = myOrders.value.filter(o => o.status === 'pending').length
      stats.value.pendingOrders = pending
      stats.value.todayOrders = res.data?.total || myOrders.value.length
      stats.value.totalServices = res.data?.total || myOrders.value.length
    } else {
      console.warn('[home] getOrders returned non-zero code:', res.code, res.message)
    }
  } catch (e) {
    console.error('[home] loadData error:', e)
  } finally {
    loading.value = false
  }
}

function goPublish() {
  uni.navigateTo({ url: '/pages/publish/publish' })
}

function goOrders() {
  uni.switchTab({ url: '/pages/orders/orders' })
}

function goOrderDetail(id) {
  uni.navigateTo({ url: `/pages/order-detail/order-detail?id=${id}` })
}

function getStatusText(status) {
  const map = {
    pending: '待接单',
    ongoing: '配送中',
    completed: '已完成',
    cancelled: '已取消'
  }
  return map[status] || status
}

function getStatusClass(status) {
  const map = {
    pending: 'badge-pending',
    ongoing: 'badge-ongoing',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled'
  }
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
.home-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.user-header {
  background: linear-gradient(135deg, #4CAF50, #2E7D32);
  padding: 40rpx 32rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .user-info {
    display: flex;
    align-items: center;
    gap: 20rpx;
  }

  .avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    background: rgba(255,255,255,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    .avatar-img {
      width: 80rpx;
      height: 80rpx;
    }

    .avatar-emoji {
      font-size: 40rpx;
    }
  }

  .user-text {
    .user-name {
      display: block;
      font-size: 32rpx;
      font-weight: 600;
      color: #fff;
    }

    .user-location {
      font-size: 24rpx;
      color: rgba(255,255,255,0.8);
    }
  }

  .publish-btn {
    background: rgba(255,255,255,0.2);
    color: #fff;
    border: 2rpx solid rgba(255,255,255,0.6);
    border-radius: 50rpx;
    font-size: 26rpx;
    padding: 0 28rpx;
    height: 64rpx;
    line-height: 64rpx;
  }
}

.stats-row {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 32rpx;

  .stat-card {
    flex: 1;
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx 16rpx;
    text-align: center;
    box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);

    .stat-num {
      display: block;
      font-size: 44rpx;
      font-weight: 700;
      color: #4CAF50;
    }

    .stat-label {
      font-size: 22rpx;
      color: #999;
      margin-top: 4rpx;
    }
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
      color: #4CAF50;
    }
  }
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

  .order-remark {
    margin-top: 12rpx;
    padding-top: 12rpx;
    border-top: 1rpx solid #f0f0f0;
    font-size: 24rpx;
    color: #999;
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
