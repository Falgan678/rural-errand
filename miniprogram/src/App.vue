<script>
export default {
  onLaunch() {
    // 检查登录状态
    const token = uni.getStorageSync('token')
    const userInfo = uni.getStorageSync('userInfo')
    if (!token || !userInfo) {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  },
  onShow() {},
  onHide() {}
}
</script>

<style lang="scss">
/* 全局样式 */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 通用卡片样式 */
.card {
  background: #fff;
  border-radius: 12rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* 通用按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #4CAF50, #2E7D32);
  color: #fff;
  border-radius: 50rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  padding: 0 40rpx;
  height: 88rpx;
  line-height: 88rpx;
}

.btn-secondary {
  background: #f0f9f0;
  color: #4CAF50;
  border-radius: 50rpx;
  font-size: 28rpx;
  border: 2rpx solid #4CAF50;
  padding: 0 32rpx;
  height: 72rpx;
  line-height: 72rpx;
}

.btn-danger {
  background: #fff0f0;
  color: #f44336;
  border-radius: 50rpx;
  font-size: 28rpx;
  border: 2rpx solid #f44336;
  padding: 0 32rpx;
  height: 72rpx;
  line-height: 72rpx;
}

/* 状态徽章 */
.badge-pending {
  background: #fff3e0;
  color: #ff9800;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.badge-ongoing {
  background: #e3f2fd;
  color: #2196f3;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.badge-completed {
  background: #e8f5e9;
  color: #4caf50;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.badge-cancelled {
  background: #f5f5f5;
  color: #9e9e9e;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.badge-urgent {
  background: #ffebee;
  color: #f44336;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  margin-left: 8rpx;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 40rpx;
  color: #bdbdbd;

  .empty-icon {
    font-size: 80rpx;
    margin-bottom: 20rpx;
  }

  .empty-text {
    font-size: 28rpx;
  }
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  color: #9e9e9e;
  font-size: 26rpx;
}

/* 分割线 */
.divider {
  height: 1rpx;
  background: #f0f0f0;
  margin: 20rpx 0;
}

/* 表单项 */
.form-item {
  margin-bottom: 24rpx;

  .form-label {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
    margin-bottom: 12rpx;
    display: block;
  }

  .form-input {
    width: 100%;
    height: 88rpx;
    background: #f8f8f8;
    border-radius: 12rpx;
    padding: 0 24rpx;
    font-size: 28rpx;
    color: #333;
    border: 2rpx solid transparent;
    box-sizing: border-box;

    &:focus {
      border-color: #4CAF50;
      background: #fff;
    }
  }

  .form-textarea {
    width: 100%;
    background: #f8f8f8;
    border-radius: 12rpx;
    padding: 20rpx 24rpx;
    font-size: 28rpx;
    color: #333;
    border: 2rpx solid transparent;
    box-sizing: border-box;
    min-height: 160rpx;

    &:focus {
      border-color: #4CAF50;
      background: #fff;
    }
  }
}

/* 价格文字 */
.price-text {
  color: #f44336;
  font-weight: 700;
  font-size: 36rpx;
}

/* 地址行 */
.address-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12rpx;

  .address-dot {
    width: 16rpx;
    height: 16rpx;
    border-radius: 50%;
    margin-top: 8rpx;
    margin-right: 16rpx;
    flex-shrink: 0;
  }

  .dot-green { background: #4CAF50; }
  .dot-orange { background: #ff9800; }

  .address-text {
    font-size: 26rpx;
    color: #666;
    flex: 1;
    line-height: 1.5;
  }
}
</style>
