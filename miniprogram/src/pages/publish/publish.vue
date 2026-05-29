<template>
  <view class="publish-page">
    <view class="form-card">
      <!-- 物品名称 -->
      <view class="form-item">
        <text class="form-label required">物品名称</text>
        <input class="form-input" v-model="form.goods_name" placeholder="如：买药、送文件、取快递" />
      </view>

      <!-- 联系电话 -->
      <view class="form-item">
        <text class="form-label required">联系电话</text>
        <input class="form-input" v-model="form.contact_phone" type="number" placeholder="请输入联系电话" maxlength="11" />
      </view>

      <!-- 取件地址 -->
      <view class="form-item">
        <text class="form-label required">取件地址</text>
        <input class="form-input" v-model="form.pickup_address" placeholder="请输入取件地址" />
      </view>

      <!-- 送达地址 -->
      <view class="form-item">
        <text class="form-label required">送达地址</text>
        <input class="form-input" v-model="form.delivery_address" placeholder="请输入送达地址" />
      </view>

      <!-- 期望送达时间 -->
      <view class="form-item">
        <text class="form-label required">期望送达时间</text>
        <input class="form-input" v-model="form.delivery_time" placeholder="如：今天下午3点前" />
      </view>

      <!-- 配送费用 -->
      <view class="form-item">
        <text class="form-label required">配送费用（元）</text>
        <input class="form-input" v-model="form.fee" type="digit" placeholder="请输入配送费用" />
      </view>

      <!-- 支付方式 -->
      <view class="form-item">
        <text class="form-label">支付方式</text>
        <view class="payment-options">
          <view
            class="payment-option"
            :class="{ active: form.payment_method === 'cash' }"
            @tap="form.payment_method = 'cash'"
          >
            <text class="payment-icon">💵</text>
            <text>现金到付</text>
          </view>
          <view
            class="payment-option payment-option-disabled"
            @tap="onWechatPayTap"
          >
            <text class="payment-icon">💚</text>
            <text>微信支付</text>
            <text class="payment-tag">即将开放</text>
          </view>
        </view>
        <text class="form-hint" style="margin-top:12rpx;color:#999;">当前版本仅支持现金到付，微信支付将在后续版本开放</text>
      </view>

      <!-- 是否加急 -->
      <view class="form-item">
        <view class="switch-row">
          <view>
            <text class="form-label" style="margin-bottom: 0;">加急配送</text>
            <text class="form-hint">加急订单优先展示给帮帮员</text>
          </view>
          <switch :checked="form.is_urgent" @change="form.is_urgent = $event.detail.value" color="#4CAF50" />
        </view>
      </view>

      <!-- 备注 -->
      <view class="form-item">
        <view class="label-row">
          <text class="form-label">备注说明</text>
          <text class="char-count">{{ form.remark.length }}/100</text>
        </view>
        <textarea
          class="form-textarea"
          v-model="form.remark"
          placeholder="可填写特殊要求、注意事项等..."
          maxlength="100"
        />
      </view>
    </view>

    <!-- 提交按钮 -->
    <view class="submit-area">
      <view class="fee-preview">
        <text class="fee-label">配送费：</text>
        <text class="fee-value">¥{{ form.fee || '0' }}</text>
      </view>
      <button class="submit-btn" :loading="loading" @tap="submitOrder">发布需求</button>
    </view>

    <!-- 底部签名 -->
    <view class="footer">
      <text>由 <text style="color: #8A2BE2;">甘发龙</text> 通过自然语言生成</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'
import { orderApi } from '../../utils/api.js'

const loading = ref(false)

const form = ref({
  goods_name: '',
  contact_phone: '',
  pickup_address: '',
  delivery_address: '',
  delivery_time: '',
  fee: '',
  payment_method: 'cash',
  is_urgent: false,
  remark: ''
})

// 微信支付占位：v2 版本接入 JSAPI 后开放
function onWechatPayTap() {
  uni.showToast({
    title: '微信支付即将开放，敬请期待',
    icon: 'none',
    duration: 2000
  })
}

async function submitOrder() {
  const { goods_name, contact_phone, pickup_address, delivery_address, delivery_time, fee } = form.value
  if (!goods_name || !contact_phone || !pickup_address || !delivery_address || !delivery_time || !fee) {
    uni.showToast({ title: '请填写完整信息', icon: 'none' })
    return
  }
  if (parseFloat(fee) <= 0) {
    uni.showToast({ title: '配送费用必须大于0', icon: 'none' })
    return
  }

  loading.value = true
  try {
    const res = await orderApi.createOrder({
      title: goods_name,
      goods_name,
      contact_phone,
      pickup_address,
      delivery_address,
      delivery_time,
      fee: parseFloat(fee),
      payment_method: form.value.payment_method,
      is_urgent: form.value.is_urgent,
      remark: form.value.remark
    })
    if (res.code === 0) {
      uni.showToast({ title: '发布成功！', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack()
      }, 1000)
    } else {
      uni.showToast({ title: res.message || '发布失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '发布失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}
</script>

<style lang="scss" scoped>
.publish-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 160rpx;
}

.form-card {
  background: #fff;
  margin: 24rpx 32rpx;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);
}

.form-item {
  margin-bottom: 28rpx;

  .form-label {
    display: block;
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
    margin-bottom: 12rpx;

    &.required::before {
      content: '* ';
      color: #f44336;
    }
  }

  .form-hint {
    display: block;
    font-size: 22rpx;
    color: #999;
    margin-top: 4rpx;
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

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12rpx;

    .char-count {
      font-size: 22rpx;
      color: #999;
    }
  }
}

.payment-options {
  display: flex;
  gap: 16rpx;

  .payment-option {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12rpx;
    padding: 20rpx;
    border-radius: 12rpx;
    background: #f8f8f8;
    font-size: 26rpx;
    color: #666;
    border: 2rpx solid transparent;

    &.active {
      background: #e8f5e9;
      color: #4CAF50;
      border-color: #4CAF50;
      font-weight: 600;
    }

    .payment-icon { font-size: 32rpx; }
  }

  .payment-option-disabled {
    position: relative;
    background: #f0f0f0 !important;
    color: #b0b0b0 !important;
    border-color: transparent !important;

    .payment-icon {
      filter: grayscale(0.8);
      opacity: 0.6;
    }

    .payment-tag {
      position: absolute;
      top: -10rpx;
      right: -10rpx;
      background: #ff9800;
      color: #fff;
      font-size: 18rpx;
      padding: 2rpx 12rpx;
      border-radius: 16rpx;
      transform: scale(0.85);
    }
  }
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.submit-area {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #fff;
  padding: 20rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  box-shadow: 0 -4rpx 16rpx rgba(0,0,0,0.08);

  .fee-preview {
    display: flex;
    align-items: center;

    .fee-label {
      font-size: 26rpx;
      color: #999;
    }

    .fee-value {
      font-size: 40rpx;
      font-weight: 700;
      color: #f44336;
    }
  }

  .submit-btn {
    flex: 1;
    height: 88rpx;
    background: linear-gradient(135deg, #4CAF50, #2E7D32);
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
