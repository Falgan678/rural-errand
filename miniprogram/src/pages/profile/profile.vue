<template>
  <view class="profile-page">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="avatar-wrap">
        <image v-if="userInfo?.avatar" :src="userInfo.avatar" class="avatar-img" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-emoji">👤</text>
        </view>
      </view>
      <view class="user-info">
        <text class="user-name">{{ userInfo?.username || userInfo?.name || '用户' }}</text>
        <text class="user-phone">{{ maskPhone(userInfo?.phone) }}</text>
        <text class="user-location">📍 {{ userInfo?.location || '未设置位置' }}</text>
      </view>
      <view class="user-rating">
        <text class="rating-num">{{ (userInfo?.rating || 5.0).toFixed(1) }}</text>
        <text class="rating-label">评分</text>
      </view>
    </view>

    <!-- 收益统计 -->
    <view class="earnings-card">
      <view class="earnings-title">💰 我的收益</view>
      <view class="earnings-row">
        <view class="earnings-item">
          <text class="earnings-num">¥{{ (userInfo?.total_earnings || 0).toFixed(2) }}</text>
          <text class="earnings-label">累计收益</text>
        </view>
        <view class="earnings-divider"></view>
        <view class="earnings-item">
          <text class="earnings-num">¥{{ (userInfo?.month_earnings || 0).toFixed(2) }}</text>
          <text class="earnings-label">本月收益</text>
        </view>
        <view class="earnings-divider"></view>
        <view class="earnings-item">
          <text class="earnings-num pending">¥{{ (userInfo?.pending_earnings || 0).toFixed(2) }}</text>
          <text class="earnings-label">待提现</text>
        </view>
      </view>
      <button class="withdraw-btn" @tap="goWithdraw">申请提现</button>
    </view>

    <!-- 数据统计 -->
    <view class="stats-card">
      <view class="stats-item">
        <text class="stats-num">{{ userInfo?.total_orders || 0 }}</text>
        <text class="stats-label">总订单</text>
      </view>
      <view class="stats-item">
        <text class="stats-num">{{ (userInfo?.good_rate || 100).toFixed(0) }}%</text>
        <text class="stats-label">好评率</text>
      </view>
      <view class="stats-item">
        <text class="stats-num">{{ (userInfo?.rating || 5.0).toFixed(1) }}</text>
        <text class="stats-label">平均评分</text>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-card">
      <view class="menu-item" @tap="goReviews">
        <text class="menu-icon">⭐</text>
        <text class="menu-text">我的评价</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item" @tap="goFeedback">
        <text class="menu-icon">💬</text>
        <text class="menu-text">意见反馈</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item" @tap="goEditProfile">
        <text class="menu-icon">✏️</text>
        <text class="menu-text">编辑资料</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item" @tap="goChangePassword">
        <text class="menu-icon">🔒</text>
        <text class="menu-text">修改密码</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <button class="logout-btn" @tap="handleLogout">退出登录</button>

    <!-- 底部签名 -->
    <view class="footer">
      <text>由 <text style="color: #8A2BE2;">甘发龙</text> 通过自然语言生成</text>
    </view>

    <!-- 编辑资料弹窗 -->
    <view v-if="showEditModal" class="modal-overlay" @tap.self="showEditModal = false">
      <view class="modal-card">
        <view class="modal-header">
          <text class="modal-title">编辑资料</text>
          <text class="modal-close" @tap="showEditModal = false">✕</text>
        </view>
        <view class="form-item">
          <text class="form-label">用户名</text>
          <input class="form-input" v-model="editForm.name" placeholder="请输入用户名" />
        </view>
        <view class="form-item">
          <text class="form-label">所在位置</text>
          <input class="form-input" v-model="editForm.location" placeholder="如：东村、西村" />
        </view>
        <button class="modal-submit" :loading="editLoading" @tap="saveProfile">保存</button>
      </view>
    </view>

    <!-- 修改密码弹窗 -->
    <view v-if="showPasswordModal" class="modal-overlay" @tap.self="showPasswordModal = false">
      <view class="modal-card">
        <view class="modal-header">
          <text class="modal-title">修改密码</text>
          <text class="modal-close" @tap="showPasswordModal = false">✕</text>
        </view>
        <view class="form-item">
          <text class="form-label">旧密码</text>
          <input class="form-input" v-model="passwordForm.old_password" password placeholder="请输入旧密码" />
        </view>
        <view class="form-item">
          <text class="form-label">新密码</text>
          <input class="form-input" v-model="passwordForm.new_password" password placeholder="至少6位" />
        </view>
        <view class="form-item">
          <text class="form-label">确认新密码</text>
          <input class="form-input" v-model="passwordForm.confirm_password" password placeholder="再次输入新密码" />
        </view>
        <button class="modal-submit" :loading="passwordLoading" @tap="savePassword">确认修改</button>
      </view>
    </view>

    <!-- 意见反馈弹窗 -->
    <view v-if="showFeedbackModal" class="modal-overlay" @tap.self="showFeedbackModal = false">
      <view class="modal-card">
        <view class="modal-header">
          <text class="modal-title">意见反馈</text>
          <text class="modal-close" @tap="showFeedbackModal = false">✕</text>
        </view>
        <view class="form-item">
          <text class="form-label">反馈类型</text>
          <view class="type-select">
            <view
              v-for="t in feedbackTypes"
              :key="t.value"
              class="type-option"
              :class="{ active: feedbackForm.type === t.value }"
              @tap="feedbackForm.type = t.value"
            >{{ t.label }}</view>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">反馈内容</text>
          <textarea class="form-textarea" v-model="feedbackForm.content" placeholder="请详细描述您的问题或建议..." />
        </view>
        <button class="modal-submit" :loading="feedbackLoading" @tap="submitFeedback">提交反馈</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { userApi, feedbackApi } from '../../utils/api.js'

const userStore = useUserStore()
const userInfo = computed(() => userStore.userInfo)

const showEditModal = ref(false)
const showPasswordModal = ref(false)
const showFeedbackModal = ref(false)
const editLoading = ref(false)
const passwordLoading = ref(false)
const feedbackLoading = ref(false)

const editForm = ref({ name: '', location: '' })
const passwordForm = ref({ old_password: '', new_password: '', confirm_password: '' })
const feedbackForm = ref({ type: 'suggestion', content: '' })

const feedbackTypes = [
  { label: '功能建议', value: 'suggestion' },
  { label: '问题反馈', value: 'bug' },
  { label: '其他', value: 'other' }
]

onMounted(async () => {
  await userStore.refreshUserInfo()
})

function maskPhone(phone) {
  if (!phone) return ''
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function goWithdraw() {
  uni.navigateTo({ url: '/pages/withdraw/withdraw' })
}

function goReviews() {
  uni.navigateTo({ url: '/pages/reviews/reviews' })
}

function goEditProfile() {
  editForm.value.name = userInfo.value?.username || ''
  editForm.value.location = userInfo.value?.location || ''
  showEditModal.value = true
}

function goChangePassword() {
  passwordForm.value = { old_password: '', new_password: '', confirm_password: '' }
  showPasswordModal.value = true
}

function goFeedback() {
  feedbackForm.value = { type: 'suggestion', content: '' }
  showFeedbackModal.value = true
}

async function saveProfile() {
  if (!editForm.value.name) {
    uni.showToast({ title: '请输入用户名', icon: 'none' })
    return
  }
  editLoading.value = true
  try {
    const res = await userApi.updateProfile({
      name: editForm.value.name,
      location: editForm.value.location
    })
    if (res.code === 0) {
      uni.showToast({ title: '保存成功', icon: 'success' })
      showEditModal.value = false
      await userStore.refreshUserInfo()
    } else {
      uni.showToast({ title: res.message || '保存失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '保存失败', icon: 'none' })
  } finally {
    editLoading.value = false
  }
}

async function savePassword() {
  const { old_password, new_password, confirm_password } = passwordForm.value
  if (!old_password || !new_password || !confirm_password) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  if (new_password !== confirm_password) {
    uni.showToast({ title: '两次密码不一致', icon: 'none' })
    return
  }
  if (new_password.length < 6) {
    uni.showToast({ title: '新密码至少6位', icon: 'none' })
    return
  }
  passwordLoading.value = true
  try {
    const res = await userApi.changePassword({ old_password, new_password })
    if (res.code === 0) {
      uni.showToast({ title: '密码修改成功', icon: 'success' })
      showPasswordModal.value = false
    } else {
      uni.showToast({ title: res.message || '修改失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '修改失败', icon: 'none' })
  } finally {
    passwordLoading.value = false
  }
}

async function submitFeedback() {
  if (!feedbackForm.value.content) {
    uni.showToast({ title: '请填写反馈内容', icon: 'none' })
    return
  }
  feedbackLoading.value = true
  try {
    const res = await feedbackApi.createFeedback(feedbackForm.value)
    if (res.code === 0) {
      uni.showToast({ title: '反馈提交成功，感谢您的建议！', icon: 'success' })
      showFeedbackModal.value = false
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '提交失败', icon: 'none' })
  } finally {
    feedbackLoading.value = false
  }
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确认退出登录？',
    success: (res) => {
      if (res.confirm) {
        userStore.logout()
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 40rpx;
}

.user-card {
  background: linear-gradient(135deg, #4CAF50, #2E7D32);
  padding: 40rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;

  .avatar-wrap {
    width: 120rpx;
    height: 120rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 4rpx solid rgba(255,255,255,0.5);
    flex-shrink: 0;

    .avatar-img {
      width: 120rpx;
      height: 120rpx;
    }

    .avatar-placeholder {
      width: 120rpx;
      height: 120rpx;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;

      .avatar-emoji { font-size: 60rpx; }
    }
  }

  .user-info {
    flex: 1;

    .user-name {
      display: block;
      font-size: 36rpx;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6rpx;
    }

    .user-phone {
      display: block;
      font-size: 24rpx;
      color: rgba(255,255,255,0.8);
      margin-bottom: 4rpx;
    }

    .user-location {
      font-size: 24rpx;
      color: rgba(255,255,255,0.7);
    }
  }

  .user-rating {
    text-align: center;

    .rating-num {
      display: block;
      font-size: 44rpx;
      font-weight: 700;
      color: #FFD700;
    }

    .rating-label {
      font-size: 22rpx;
      color: rgba(255,255,255,0.8);
    }
  }
}

.earnings-card {
  background: #fff;
  margin: 24rpx 32rpx 0;
  border-radius: 20rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.08);

  .earnings-title {
    font-size: 28rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 24rpx;
  }

  .earnings-row {
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;
  }

  .earnings-item {
    flex: 1;
    text-align: center;

    .earnings-num {
      display: block;
      font-size: 36rpx;
      font-weight: 700;
      color: #333;
      margin-bottom: 4rpx;

      &.pending { color: #FF9800; }
    }

    .earnings-label {
      font-size: 22rpx;
      color: #999;
    }
  }

  .earnings-divider {
    width: 1rpx;
    height: 60rpx;
    background: #f0f0f0;
  }

  .withdraw-btn {
    width: 100%;
    height: 80rpx;
    background: linear-gradient(135deg, #FF9800, #F57C00);
    color: #fff;
    font-size: 28rpx;
    font-weight: 600;
    border-radius: 50rpx;
    border: none;
    line-height: 80rpx;
  }
}

.stats-card {
  background: #fff;
  margin: 20rpx 32rpx 0;
  border-radius: 20rpx;
  padding: 28rpx;
  display: flex;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);

  .stats-item {
    flex: 1;
    text-align: center;

    .stats-num {
      display: block;
      font-size: 40rpx;
      font-weight: 700;
      color: #4CAF50;
      margin-bottom: 4rpx;
    }

    .stats-label {
      font-size: 22rpx;
      color: #999;
    }
  }
}

.menu-card {
  background: #fff;
  margin: 20rpx 32rpx 0;
  border-radius: 20rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);

  .menu-item {
    display: flex;
    align-items: center;
    padding: 32rpx 28rpx;

    .menu-icon {
      font-size: 36rpx;
      margin-right: 20rpx;
    }

    .menu-text {
      flex: 1;
      font-size: 28rpx;
      color: #333;
    }

    .menu-arrow {
      font-size: 32rpx;
      color: #ccc;
    }
  }

  .menu-divider {
    height: 1rpx;
    background: #f5f5f5;
    margin: 0 28rpx;
  }
}

.logout-btn {
  margin: 32rpx 32rpx 0;
  width: calc(100% - 64rpx);
  height: 88rpx;
  background: #fff;
  color: #f44336;
  font-size: 30rpx;
  border-radius: 50rpx;
  border: 2rpx solid #f44336;
  line-height: 88rpx;
}

.footer {
  text-align: center;
  padding: 40rpx 0 20rpx;
  font-size: 22rpx;
  color: #bdbdbd;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.modal-card {
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;

    .modal-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #333;
    }

    .modal-close {
      font-size: 32rpx;
      color: #999;
      padding: 8rpx;
    }
  }

  .form-item {
    margin-bottom: 24rpx;

    .form-label {
      display: block;
      font-size: 26rpx;
      color: #666;
      margin-bottom: 12rpx;
    }

    .form-input {
      width: 100%;
      height: 88rpx;
      background: #f8f8f8;
      border-radius: 12rpx;
      padding: 0 24rpx;
      font-size: 28rpx;
      color: #333;
      box-sizing: border-box;
    }

    .form-textarea {
      width: 100%;
      background: #f8f8f8;
      border-radius: 12rpx;
      padding: 20rpx 24rpx;
      font-size: 28rpx;
      color: #333;
      box-sizing: border-box;
      min-height: 160rpx;
    }

    .type-select {
      display: flex;
      gap: 16rpx;

      .type-option {
        flex: 1;
        text-align: center;
        padding: 16rpx 0;
        border-radius: 12rpx;
        font-size: 26rpx;
        color: #666;
        background: #f5f5f5;

        &.active {
          background: #e8f5e9;
          color: #4CAF50;
          font-weight: 600;
        }
      }
    }
  }

  .modal-submit {
    width: 100%;
    height: 88rpx;
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    color: #fff;
    font-size: 30rpx;
    font-weight: 600;
    border-radius: 50rpx;
    border: none;
    margin-top: 16rpx;
  }
}
</style>
