<template>
  <view class="withdraw-page">
    <!-- 余额卡片 -->
    <view class="balance-card">
      <text class="balance-label">可提现余额</text>
      <text class="balance-amount">¥{{ pendingEarnings.toFixed(2) }}</text>
      <text class="balance-hint">提现后1-3个工作日到账</text>
    </view>

    <!-- 提现表单 -->
    <view class="form-card">
      <view class="form-item">
        <text class="form-label">提现金额（元）</text>
        <view class="amount-input-wrap">
          <text class="currency">¥</text>
          <input
            class="amount-input"
            v-model="amount"
            type="digit"
            placeholder="请输入提现金额"
          />
          <text class="all-btn" @tap="amount = pendingEarnings.toFixed(2)">全部</text>
        </view>
      </view>

      <!-- 快捷金额 -->
      <view class="quick-amounts">
        <view
          v-for="q in quickAmounts"
          :key="q"
          class="quick-item"
          :class="{ active: amount == q }"
          @tap="amount = String(q)"
        >¥{{ q }}</view>
      </view>

      <view class="form-item">
        <text class="form-label">提现方式</text>
        <view class="method-option active">
          <text class="method-icon">💚</text>
          <text class="method-text">微信零钱</text>
          <text class="method-check">✓</text>
        </view>
      </view>
    </view>

    <!-- 提现记录 -->
    <view class="records-section">
      <text class="records-title">提现记录</text>
      <view v-if="records.length === 0" class="empty-state">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无提现记录</text>
      </view>
      <view v-else>
        <view v-for="record in records" :key="record.id" class="record-item">
          <view class="record-left">
            <text class="record-amount">-¥{{ Math.abs(record.amount).toFixed(2) }}</text>
            <text class="record-time">{{ formatDate(record.created_at) }}</text>
          </view>
          <view :class="getRecordStatusClass(record.status)">{{ getRecordStatusText(record.status) }}</view>
        </view>
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-area">
      <button class="submit-btn" :loading="loading" @tap="submitWithdraw">申请提现</button>
    </view>

    <!-- 底部签名 -->
    <view class="footer">
      <text>由 <text style="color: #8A2BE2;">甘发龙</text> 通过自然语言生成</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { earningsApi } from '../../utils/api.js'

const userStore = useUserStore()
const amount = ref('')
const loading = ref(false)
const records = ref([])
const pendingEarnings = ref(parseFloat(userStore.userInfo?.pending_earnings || 0))

const quickAmounts = [10, 20, 50, 100]

onMounted(async () => {
  await loadRecords()
})

async function loadRecords() {
  try {
    const res = await earningsApi.getEarnings({ type: 'withdraw', page_size: 10 })
    if (res.code === 0) {
      // 后端字段名为 earnings，旧代码错写为 records 导致永远显示空
      records.value = res.data?.earnings || res.data?.records || []
    }
  } catch (e) {
    console.error('加载记录失败', e)
  }
}

async function submitWithdraw() {
  const amt = parseFloat(amount.value)
  if (!amt || amt <= 0) {
    uni.showToast({ title: '请输入提现金额', icon: 'none' })
    return
  }
  if (amt > pendingEarnings.value) {
    uni.showToast({ title: '提现金额不能超过可提现余额', icon: 'none' })
    return
  }
  if (amt < 1) {
    uni.showToast({ title: '最低提现金额为1元', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await earningsApi.withdraw(amt)
    if (res.code === 0) {
      uni.showToast({ title: '提现申请已提交！', icon: 'success' })
      pendingEarnings.value -= amt
      amount.value = ''
      await loadRecords()
      await userStore.refreshUserInfo()
    } else {
      uni.showToast({ title: res.message || '提现失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '提现失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function getRecordStatusText(status) {
  // 后端 earnings 表使用 completed，withdrawals 表使用 approved
  // 这里同时兼容两种字面量，避免客户端展示错乱
  const map = {
    pending: '审核中',
    approved: '已到账',
    completed: '已到账',
    rejected: '已拒绝'
  }
  return map[status] || status
}

function getRecordStatusClass(status) {
  const map = {
    pending: 'status-pending',
    approved: 'status-approved',
    completed: 'status-approved',
    rejected: 'status-rejected'
  }
  return map[status] || 'status-pending'
}

function formatDate(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return `${date.getMonth()+1}月${date.getDate()}日 ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
}
</script>

<style lang="scss" scoped>
.withdraw-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 160rpx;
}

.balance-card {
  background: linear-gradient(135deg, #FF9800, #F57C00);
  padding: 48rpx 32rpx;
  text-align: center;

  .balance-label {
    display: block;
    font-size: 26rpx;
    color: rgba(255,255,255,0.8);
    margin-bottom: 12rpx;
  }

  .balance-amount {
    display: block;
    font-size: 72rpx;
    font-weight: 700;
    color: #fff;
    margin-bottom: 12rpx;
  }

  .balance-hint {
    font-size: 22rpx;
    color: rgba(255,255,255,0.7);
  }
}

.form-card {
  background: #fff;
  margin: 24rpx 32rpx 0;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.form-item {
  margin-bottom: 28rpx;

  .form-label {
    display: block;
    font-size: 26rpx;
    color: #666;
    margin-bottom: 16rpx;
  }
}

.amount-input-wrap {
  display: flex;
  align-items: center;
  background: #f8f8f8;
  border-radius: 12rpx;
  padding: 0 24rpx;
  height: 100rpx;

  .currency {
    font-size: 40rpx;
    color: #f44336;
    font-weight: 700;
    margin-right: 8rpx;
  }

  .amount-input {
    flex: 1;
    font-size: 44rpx;
    font-weight: 700;
    color: #333;
  }

  .all-btn {
    font-size: 26rpx;
    color: #FF9800;
    padding: 8rpx 16rpx;
    border: 2rpx solid #FF9800;
    border-radius: 8rpx;
  }
}

.quick-amounts {
  display: flex;
  gap: 16rpx;
  margin-bottom: 28rpx;

  .quick-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    border-radius: 12rpx;
    font-size: 26rpx;
    color: #666;
    background: #f5f5f5;
    border: 2rpx solid transparent;

    &.active {
      background: #fff3e0;
      color: #FF9800;
      border-color: #FF9800;
      font-weight: 600;
    }
  }
}

.method-option {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 12rpx;
  background: #f0f9f0;
  border: 2rpx solid #4CAF50;

  .method-icon { font-size: 40rpx; }

  .method-text {
    flex: 1;
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
  }

  .method-check {
    font-size: 28rpx;
    color: #4CAF50;
    font-weight: 700;
  }
}

.records-section {
  margin: 24rpx 32rpx 0;

  .records-title {
    display: block;
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 16rpx;
  }
}

.record-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);

  .record-left {
    .record-amount {
      display: block;
      font-size: 32rpx;
      font-weight: 700;
      color: #f44336;
      margin-bottom: 4rpx;
    }

    .record-time {
      font-size: 22rpx;
      color: #999;
    }
  }
}

.status-pending { background: #fff3e0; color: #FF9800; padding: 6rpx 20rpx; border-radius: 20rpx; font-size: 24rpx; }
.status-approved { background: #e8f5e9; color: #4CAF50; padding: 6rpx 20rpx; border-radius: 20rpx; font-size: 24rpx; }
.status-rejected { background: #ffebee; color: #f44336; padding: 6rpx 20rpx; border-radius: 20rpx; font-size: 24rpx; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx;
  color: #bdbdbd;

  .empty-icon { font-size: 60rpx; margin-bottom: 16rpx; }
  .empty-text { font-size: 26rpx; }
}

.submit-area {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 20rpx 32rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.08);

  .submit-btn {
    width: 100%;
    height: 88rpx;
    background: linear-gradient(135deg, #FF9800, #F57C00);
    color: #fff;
    font-size: 30rpx;
    font-weight: 600;
    border-radius: 50rpx;
    border: none;
    line-height: 88rpx;
  }
}

.footer {
  text-align: center;
  padding: 20rpx 0;
  font-size: 22rpx;
  color: #bdbdbd;
}
</style>
