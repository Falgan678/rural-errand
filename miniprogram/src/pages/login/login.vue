<template>
  <view class="login-page">
    <!-- 顶部 Logo 区域 -->
    <view class="header">
      <view class="logo">
        <text class="logo-text">乡</text>
      </view>
      <text class="app-name">乡邻快帮</text>
      <text class="app-slogan">邻里互助 · 便捷生活</text>
    </view>

    <!-- 登录/注册切换 -->
    <view class="tab-bar">
      <view
        class="tab-item"
        :class="{ active: activeTab === 'login' }"
        @tap="activeTab = 'login'"
      >登录</view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'register' }"
        @tap="activeTab = 'register'"
      >注册</view>
    </view>

    <!-- 登录表单 -->
    <view v-if="activeTab === 'login'" class="form-card">
      <!-- 登录方式切换（仅当后端启用短信时才展示验证码登录 tab） -->
      <view v-if="smsEnabled" class="login-type-bar">
        <view
          class="type-item"
          :class="{ active: loginType === 'password' }"
          @tap="loginType = 'password'"
        >密码登录</view>
        <view
          class="type-item"
          :class="{ active: loginType === 'sms' }"
          @tap="loginType = 'sms'"
        >验证码登录</view>
      </view>

      <!-- 密码登录 -->
      <view v-if="loginType === 'password'">
        <view class="form-item">
          <text class="form-label">用户名/手机号</text>
          <input
            class="form-input"
            v-model="loginForm.username"
            placeholder="请输入用户名或手机号"
            placeholder-class="placeholder"
          />
        </view>
        <view class="form-item">
          <text class="form-label">密码</text>
          <view class="input-with-icon">
            <input
              class="form-input"
              v-model="loginForm.password"
              :password="!showPassword"
              placeholder="请输入密码"
              placeholder-class="placeholder"
            />
            <text class="eye-icon" @tap="showPassword = !showPassword">
              {{ showPassword ? '🙈' : '👁️' }}
            </text>
          </view>
        </view>
      </view>

      <!-- 验证码登录 -->
      <view v-if="loginType === 'sms'">
        <view class="form-item">
          <text class="form-label">手机号</text>
          <input
            class="form-input"
            v-model="loginForm.phone"
            type="number"
            placeholder="请输入手机号"
            placeholder-class="placeholder"
            maxlength="11"
          />
        </view>
        <view class="form-item">
          <text class="form-label">验证码</text>
          <view class="sms-row">
            <input
              class="form-input sms-input"
              v-model="loginForm.smsCode"
              type="number"
              placeholder="请输入验证码"
              placeholder-class="placeholder"
              maxlength="6"
            />
            <button
              class="sms-btn"
              :disabled="smsCountdown > 0"
              @tap="sendSms('login')"
            >
              {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
            </button>
          </view>
        </view>
      </view>

      <button class="submit-btn" :loading="loading" @tap="handleLogin">登 录</button>
    </view>

    <!-- 注册表单 -->
    <view v-if="activeTab === 'register'" class="form-card">
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input
          class="form-input"
          v-model="registerForm.username"
          placeholder="2-20个字符"
          placeholder-class="placeholder"
          maxlength="20"
        />
      </view>
      <view class="form-item">
        <text class="form-label">手机号</text>
        <input
          class="form-input"
          v-model="registerForm.phone"
          type="number"
          placeholder="请输入手机号"
          placeholder-class="placeholder"
          maxlength="11"
        />
      </view>
      <view v-if="smsEnabled" class="form-item">
        <text class="form-label">验证码</text>
        <view class="sms-row">
          <input
            class="form-input sms-input"
            v-model="registerForm.smsCode"
            type="number"
            placeholder="请输入验证码"
            placeholder-class="placeholder"
            maxlength="6"
          />
          <button
            class="sms-btn"
            :disabled="smsCountdown > 0"
            @tap="sendSms('register')"
          >
            {{ smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码' }}
          </button>
        </view>
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <view class="input-with-icon">
          <input
            class="form-input"
            v-model="registerForm.password"
            :password="!showPassword"
            placeholder="至少6位密码"
            placeholder-class="placeholder"
          />
          <text class="eye-icon" @tap="showPassword = !showPassword">
            {{ showPassword ? '🙈' : '👁️' }}
          </text>
        </view>
      </view>

      <button class="submit-btn" :loading="loading" @tap="handleRegister">注 册</button>
    </view>

    <!-- 测试账号提示（仅开发模式显示） -->
    <view class="test-accounts" v-if="showTestAccounts">
      <text class="test-title">测试账号</text>
      <text class="test-item" @tap="fillTestAccount('13800138001', '123456')">
        📱 13800138001 / 123456
      </text>
      <text class="test-item" @tap="fillTestAccount('13800138002', '123456')">
        📱 13800138002 / 123456
      </text>
    </view>

    <!-- 协议提示 -->
    <view class="agreement">
      <text class="agreement-text">登录即表示同意</text>
      <text class="agreement-link" @tap="showAgreement('user')">《用户协议》</text>
      <text class="agreement-text">和</text>
      <text class="agreement-link" @tap="showAgreement('privacy')">《隐私政策》</text>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../../stores/user.js'
import { authApi, systemApi } from '../../utils/api.js'

const userStore = useUserStore()

// 是否显示测试账号（提审/正式版改为 false）
// 当前为 true 方便开发测试，提审前改成 false
const showTestAccounts = ref(true)

// 后端是否启用了短信验证（DISABLE_SMS=true 时为 false，会隐藏验证码登录 tab 和注册验证码字段）
const smsEnabled = ref(true)

const activeTab = ref('login')
const loginType = ref('password')
const showPassword = ref(false)
const loading = ref(false)
const smsCountdown = ref(0)

onMounted(async () => {
  // 拉取后端运行时配置，决定是否展示验证码相关 UI
  try {
    const res = await systemApi.getHealth()
    if (res?.code === 0 && res.data) {
      smsEnabled.value = !res.data.disable_sms
      // 短信被禁用时，强制切到密码登录
      if (!smsEnabled.value && loginType.value === 'sms') {
        loginType.value = 'password'
      }
    }
  } catch (e) {
    // 拉不到时保守显示验证码（与之前行为一致）
    smsEnabled.value = true
  }
})

const loginForm = ref({
  username: '',
  phone: '',
  password: '',
  smsCode: ''
})

const registerForm = ref({
  username: '',
  phone: '',
  password: '',
  smsCode: ''
})

// 显示协议
function showAgreement(type) {
  const title = type === 'user' ? '用户协议' : '隐私政策'
  const content = type === 'user'
    ? '欢迎使用乡邻快帮！本应用是一款农村社区便民信息发布与查询工具。\n\n1. 使用本应用时请遵守相关法律法规\n2. 发布的信息应真实有效，不得发布违法内容\n3. 本应用为信息发布工具，不参与任何线下交易行为\n4. 用户因使用本应用产生的纠纷自行解决，平台不承担相关责任'
    : '我们重视您的隐私保护：\n\n1. 我们仅收集为提供服务所必需的信息：手机号（登录）、设备信息（运行优化）\n2. 我们不会向任何第三方出售您的个人信息\n3. 您的密码经加密存储，我们无法获取明文\n4. 您可随时通过个人中心修改或删除您的信息\n5. 如有疑问可通过意见反馈联系我们'
  uni.showModal({
    title,
    content,
    showCancel: false,
    confirmText: '我知道了'
  })
}

// 填充测试账号
function fillTestAccount(phone, password) {
  loginType.value = 'password'
  loginForm.value.username = phone
  loginForm.value.password = password
}

// 发送验证码
async function sendSms(type) {
  const phone = type === 'login' ? loginForm.value.phone : registerForm.value.phone
  if (!phone || phone.length !== 11) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }

  try {
    const res = await authApi.sendSms(phone, type)
    if (res.code === 0) {
      uni.showToast({ title: '验证码已发送', icon: 'success' })
      startCountdown()
    } else {
      uni.showToast({ title: res.message || '发送失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '发送失败，请重试', icon: 'none' })
  }
}

// 倒计时
function startCountdown() {
  smsCountdown.value = 60
  const timer = setInterval(() => {
    smsCountdown.value--
    if (smsCountdown.value <= 0) {
      clearInterval(timer)
    }
  }, 1000)
}

// 登录
async function handleLogin() {
  if (loginType.value === 'password') {
    if (!loginForm.value.username || !loginForm.value.password) {
      uni.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
  } else {
    if (!loginForm.value.phone || !loginForm.value.smsCode) {
      uni.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
  }

  loading.value = true
  try {
    const data = loginType.value === 'password'
      ? { username: loginForm.value.username, password: loginForm.value.password, type: 'password' }
      : { phone: loginForm.value.phone, sms_code: loginForm.value.smsCode, type: 'sms' }

    const res = await authApi.login(data)
    if (res.code === 0) {
      userStore.setToken(res.data.token)
      userStore.setUserInfo(res.data)
      uni.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/home/home' })
      }, 500)
    } else {
      uni.showToast({ title: res.message || '登录失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

// 注册
async function handleRegister() {
  const { username, phone, password, smsCode } = registerForm.value
  // 短信启用时验证码必填，禁用时无需填
  if (!username || !phone || !password || (smsEnabled.value && !smsCode)) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  if (phone.length !== 11) {
    uni.showToast({ title: '手机号格式不正确', icon: 'none' })
    return
  }
  if (password.length < 6) {
    uni.showToast({ title: '密码至少6位', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const payload = { username, phone, password }
    if (smsEnabled.value) payload.sms_code = smsCode
    const res = await authApi.register(payload)
    if (res.code === 0) {
      uni.showToast({ title: '注册成功，请登录', icon: 'success' })
      activeTab.value = 'login'
      loginForm.value.username = phone
      loginForm.value.password = password
    } else {
      uni.showToast({ title: res.message || '注册失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '注册失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #e8f5e9 0%, #f5f5f5 40%);
  padding: 0 32rpx 40rpx;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 40rpx;

  .logo {
    width: 140rpx;
    height: 140rpx;
    border-radius: 35rpx;
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;
    box-shadow: 0 8rpx 24rpx rgba(76, 175, 80, 0.3);

    .logo-text {
      font-size: 72rpx;
      color: #fff;
      font-weight: 700;
      letter-spacing: 2rpx;
    }
  }

  .app-name {
    font-size: 48rpx;
    font-weight: 700;
    color: #2E7D32;
    margin-bottom: 8rpx;
    letter-spacing: 2rpx;
  }

  .app-slogan {
    font-size: 26rpx;
    color: #81C784;
    letter-spacing: 1rpx;
  }
}

.tab-bar {
  display: flex;
  background: #fff;
  border-radius: 50rpx;
  padding: 6rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);

  .tab-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    font-size: 28rpx;
    color: #999;
    border-radius: 44rpx;
    transition: all 0.3s;

    &.active {
      background: linear-gradient(135deg, #4CAF50, #2E7D32);
      color: #fff;
      font-weight: 600;
    }
  }
}

.form-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);
  margin-bottom: 24rpx;
}

.login-type-bar {
  display: flex;
  border-bottom: 2rpx solid #f0f0f0;
  margin-bottom: 32rpx;

  .type-item {
    flex: 1;
    text-align: center;
    padding: 16rpx 0;
    font-size: 28rpx;
    color: #999;
    position: relative;

    &.active {
      color: #4CAF50;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        bottom: -2rpx;
        left: 25%;
        width: 50%;
        height: 4rpx;
        background: #4CAF50;
        border-radius: 2rpx;
      }
    }
  }
}

.form-item {
  margin-bottom: 28rpx;

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
    border: 2rpx solid transparent;

    &:focus {
      border-color: #4CAF50;
      background: #fff;
    }
  }
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;

  .form-input {
    padding-right: 80rpx;
  }

  .eye-icon {
    position: absolute;
    right: 20rpx;
    font-size: 36rpx;
  }
}

.sms-row {
  display: flex;
  gap: 16rpx;

  .sms-input {
    flex: 1;
  }

  .sms-btn {
    width: 200rpx;
    height: 88rpx;
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
    color: #fff;
    font-size: 24rpx;
    border-radius: 12rpx;
    border: none;
    flex-shrink: 0;
    line-height: 88rpx;
    padding: 0;

    &[disabled] {
      background: #ccc;
      color: #fff;
    }
  }
}

.submit-btn {
  width: 100%;
  height: 96rpx;
  background: linear-gradient(135deg, #4CAF50, #2E7D32);
  color: #fff;
  font-size: 32rpx;
  font-weight: 600;
  border-radius: 50rpx;
  border: none;
  margin-top: 16rpx;
  letter-spacing: 4rpx;
}

.test-accounts {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);

  .test-title {
    font-size: 24rpx;
    color: #999;
    display: block;
    margin-bottom: 12rpx;
  }

  .test-item {
    display: block;
    font-size: 26rpx;
    color: #4CAF50;
    padding: 8rpx 0;
    text-decoration: underline;
  }
}

.placeholder {
  color: #bdbdbd;
}

.agreement {
  text-align: center;
  padding: 40rpx 0 20rpx;
  font-size: 22rpx;
  line-height: 1.6;

  .agreement-text {
    color: #999;
  }

  .agreement-link {
    color: #4CAF50;
  }
}
</style>
