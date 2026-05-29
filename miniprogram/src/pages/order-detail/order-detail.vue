<template>
  <view class="detail-page">
    <view v-if="loading" class="loading-state">
      <text>加载中...</text>
    </view>

    <view v-else-if="order">
      <!-- 状态横幅 -->
      <view class="status-banner" :class="'banner-' + order.status">
        <text class="status-icon">{{ getStatusIcon(order.status) }}</text>
        <view>
          <text class="status-text">{{ getStatusText(order.status) }}</text>
          <text class="status-sub">{{ getStatusSub(order.status) }}</text>
        </view>
        <text v-if="order.is_urgent" class="urgent-tag">加急</text>
      </view>

      <!-- 订单信息 -->
      <view class="info-card">
        <view class="info-header">
          <text class="info-title">{{ order.title }}</text>
          <text class="info-price">¥{{ order.fee }}</text>
        </view>

        <view class="divider"></view>

        <view class="address-section">
          <view class="address-item">
            <view class="addr-dot dot-green"></view>
            <view class="addr-content">
              <text class="addr-label">取件地址</text>
              <text class="addr-text">{{ order.pickup_address }}</text>
            </view>
          </view>
          <view class="addr-line"></view>
          <view class="address-item">
            <view class="addr-dot dot-orange"></view>
            <view class="addr-content">
              <text class="addr-label">送达地址</text>
              <text class="addr-text">{{ order.delivery_address }}</text>
            </view>
          </view>
        </view>

        <view class="divider"></view>

        <view class="meta-grid">
          <view class="meta-item">
            <text class="meta-label">期望时间</text>
            <text class="meta-value">{{ order.delivery_time }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">支付方式</text>
            <text class="meta-value">{{ order.payment_method === 'cash' ? '💵 现金到付' : '💚 微信支付' }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">联系电话</text>
            <text class="meta-value contact" @tap="callPhone(order.contact_phone)">{{ order.contact_phone }}</text>
          </view>
          <view class="meta-item">
            <text class="meta-label">发布时间</text>
            <text class="meta-value">{{ formatDate(order.created_at) }}</text>
          </view>
        </view>

        <view v-if="order.remark" class="remark-section">
          <text class="remark-label">📝 备注</text>
          <text class="remark-text">{{ order.remark }}</text>
        </view>
      </view>

      <!-- 帮帮员信息 -->
      <view v-if="order.runner_name" class="runner-card">
        <text class="card-title">🏃 帮帮员信息</text>
        <view class="runner-info">
          <view class="runner-avatar">
            <text>{{ order.runner_name?.charAt(0) || '?' }}</text>
          </view>
          <view class="runner-detail">
            <text class="runner-name">{{ order.runner_name }}</text>
            <text class="runner-rating">⭐ {{ order.runner_rating || '5.0' }} 分</text>
          </view>
          <text class="runner-phone" @tap="callPhone(order.runner_phone)">📞 联系</text>
        </view>
      </view>

      <!-- 取消原因 -->
      <view v-if="order.status === 'cancelled' && order.cancel_reason" class="cancel-card">
        <text class="cancel-title">取消原因</text>
        <text class="cancel-reason">{{ order.cancel_reason }}</text>
      </view>

      <!-- 操作按钮 -->
      <view class="action-area">
        <!-- 发布者：待接单可取消 -->
        <button
          v-if="isOwner && order.status === 'pending'"
          class="action-btn cancel-btn"
          @tap="cancelOrder"
        >取消订单</button>

        <!-- 发布者：进行中可取消 -->
        <button
          v-if="isOwner && order.status === 'ongoing'"
          class="action-btn cancel-btn"
          @tap="cancelOrder"
        >取消订单</button>

        <!-- 帮帮员：进行中可放弃接单 -->
        <button
          v-if="isRunner && order.status === 'ongoing'"
          class="action-btn cancel-btn"
          @tap="runnerCancel"
        >放弃接单</button>

        <!-- 帮帮员：进行中可完成 -->
        <button
          v-if="isRunner && order.status === 'ongoing'"
          class="action-btn complete-btn"
          @tap="completeOrder"
        >确认送达</button>

        <!-- 发布者：已完成可评价 -->
        <button
          v-if="isOwner && order.status === 'completed' && !order.reviewed"
          class="action-btn review-btn"
          @tap="goReview"
        >去评价帮帮员</button>
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
import { useUserStore } from '../../stores/user.js'
import { orderApi } from '../../utils/api.js'

const userStore = useUserStore()
const order = ref(null)
const loading = ref(true)

const orderId = ref('')

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  orderId.value = currentPage.options?.id || ''
  await loadOrder()
})

const isOwner = computed(() => {
  return order.value?.user_id === userStore.userInfo?.id
})

const isRunner = computed(() => {
  return order.value?.runner_id === userStore.userInfo?.id
})

async function loadOrder() {
  loading.value = true
  try {
    const res = await orderApi.getOrderDetail(orderId.value)
    if (res.code === 0) {
      order.value = res.data
    } else {
      uni.showToast({ title: '订单不存在', icon: 'none' })
      setTimeout(() => uni.navigateBack(), 1000)
    }
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

async function cancelOrder() {
  uni.showModal({
    title: '取消订单',
    content: '确认取消该订单？',
    editable: true,
    placeholderText: '请输入取消原因（可选）',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.cancelOrder(orderId.value, res.value || '')
          if (result.code === 0) {
            uni.showToast({ title: '订单已取消', icon: 'success' })
            await loadOrder()
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

async function completeOrder() {
  uni.showModal({
    title: '确认送达',
    content: '确认已完成配送？',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.completeOrder(orderId.value)
          if (result.code === 0) {
            uni.showToast({ title: '订单完成！', icon: 'success' })
            await loadOrder()
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

async function runnerCancel() {
  uni.showModal({
    title: '放弃接单',
    content: '订单将退回为待接单状态，确认放弃？',
    editable: true,
    placeholderText: '请简述放弃原因（可选）',
    success: async (res) => {
      if (res.confirm) {
        try {
          const result = await orderApi.runnerCancelOrder(orderId.value, res.value || '')
          if (result.code === 0) {
            uni.showToast({ title: '已退回订单', icon: 'success' })
            await loadOrder()
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

function goReview() {
  uni.navigateTo({
    url: `/pages/reviews/reviews?order_id=${orderId.value}&runner_id=${order.value.runner_id}`
  })
}

function callPhone(phone) {
  if (!phone) return
  uni.makePhoneCall({ phoneNumber: phone })
}

function getStatusText(status) {
  const map = { pending: '待接单', ongoing: '配送中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

function getStatusIcon(status) {
  const map = { pending: '⏳', ongoing: '🚴', completed: '✅', cancelled: '❌' }
  return map[status] || '📦'
}

function getStatusSub(status) {
  const map = {
    pending: '等待帮帮员接单',
    ongoing: '帮帮员正在响应中',
    completed: '需求已完成',
    cancelled: '订单已取消'
  }
  return map[status] || ''
}

function formatDate(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
</script>

<style lang="scss" scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.status-banner {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 32rpx;

  &.banner-pending { background: linear-gradient(135deg, #FF9800, #F57C00); }
  &.banner-ongoing { background: linear-gradient(135deg, #2196F3, #1565C0); }
  &.banner-completed { background: linear-gradient(135deg, #4CAF50, #2E7D32); }
  &.banner-cancelled { background: linear-gradient(135deg, #9E9E9E, #616161); }

  .status-icon { font-size: 60rpx; }

  .status-text {
    display: block;
    font-size: 36rpx;
    font-weight: 700;
    color: #fff;
  }

  .status-sub {
    font-size: 24rpx;
    color: rgba(255,255,255,0.8);
  }

  .urgent-tag {
    margin-left: auto;
    background: rgba(255,255,255,0.2);
    color: #fff;
    padding: 6rpx 20rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    border: 2rpx solid rgba(255,255,255,0.5);
  }
}

.info-card, .runner-card, .cancel-card {
  background: #fff;
  margin: 24rpx 32rpx 0;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;

  .info-title {
    font-size: 36rpx;
    font-weight: 700;
    color: #333;
    flex: 1;
  }

  .info-price {
    font-size: 44rpx;
    font-weight: 700;
    color: #f44336;
  }
}

.divider {
  height: 1rpx;
  background: #f0f0f0;
  margin: 20rpx 0;
}

.address-section {
  .address-item {
    display: flex;
    align-items: flex-start;
    gap: 20rpx;
    padding: 12rpx 0;

    .addr-dot {
      width: 20rpx;
      height: 20rpx;
      border-radius: 50%;
      margin-top: 6rpx;
      flex-shrink: 0;
    }

    .dot-green { background: #4CAF50; }
    .dot-orange { background: #FF9800; }

    .addr-content {
      flex: 1;

      .addr-label {
        display: block;
        font-size: 22rpx;
        color: #999;
        margin-bottom: 4rpx;
      }

      .addr-text {
        font-size: 28rpx;
        color: #333;
        font-weight: 500;
      }
    }
  }

  .addr-line {
    width: 2rpx;
    height: 20rpx;
    background: #ddd;
    margin-left: 9rpx;
  }
}

.meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;

  .meta-item {
    .meta-label {
      display: block;
      font-size: 22rpx;
      color: #999;
      margin-bottom: 6rpx;
    }

    .meta-value {
      font-size: 26rpx;
      color: #333;

      &.contact {
        color: #4CAF50;
        text-decoration: underline;
      }
    }
  }
}

.remark-section {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #f8f8f8;
  border-radius: 12rpx;

  .remark-label {
    display: block;
    font-size: 24rpx;
    color: #999;
    margin-bottom: 8rpx;
  }

  .remark-text {
    font-size: 26rpx;
    color: #666;
    line-height: 1.6;
  }
}

.card-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
}

.runner-info {
  display: flex;
  align-items: center;
  gap: 20rpx;

  .runner-avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 32rpx;
    font-weight: 700;
  }

  .runner-detail {
    flex: 1;

    .runner-name {
      display: block;
      font-size: 28rpx;
      font-weight: 600;
      color: #333;
    }

    .runner-rating {
      font-size: 24rpx;
      color: #FF9800;
    }
  }

  .runner-phone {
    font-size: 26rpx;
    color: #4CAF50;
    padding: 12rpx 24rpx;
    border: 2rpx solid #4CAF50;
    border-radius: 50rpx;
  }
}

.cancel-card {
  .cancel-title {
    display: block;
    font-size: 26rpx;
    color: #f44336;
    font-weight: 600;
    margin-bottom: 12rpx;
  }

  .cancel-reason {
    font-size: 26rpx;
    color: #666;
  }
}

.action-area {
  padding: 32rpx;
  display: flex;
  gap: 20rpx;

  .action-btn {
    flex: 1;
    height: 88rpx;
    border-radius: 50rpx;
    font-size: 28rpx;
    font-weight: 600;
    border: none;
    line-height: 88rpx;
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

.loading-state {
  text-align: center;
  padding: 80rpx;
  color: #999;
  font-size: 28rpx;
}

.footer {
  text-align: center;
  padding: 40rpx 0 20rpx;
  font-size: 22rpx;
  color: #bdbdbd;
}
</style>
