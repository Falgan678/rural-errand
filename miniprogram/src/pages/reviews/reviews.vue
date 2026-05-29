<template>
  <view class="reviews-page">
    <!-- 提交评价模式 -->
    <view v-if="isSubmitMode" class="submit-mode">
      <view class="review-card">
        <text class="card-title">评价帮帮员</text>

        <!-- 星级评分 -->
        <view class="rating-section">
          <text class="rating-label">服务评分</text>
          <view class="stars">
            <text
              v-for="i in 5"
              :key="i"
              class="star"
              :class="{ active: i <= form.rating }"
              @tap="form.rating = i"
            >★</text>
          </view>
          <text class="rating-text">{{ ratingTexts[form.rating - 1] }}</text>
        </view>

        <!-- 评价内容 -->
        <view class="form-item">
          <text class="form-label">评价内容（可选）</text>
          <textarea
            class="form-textarea"
            v-model="form.comment"
            placeholder="分享您的配送体验..."
            maxlength="200"
          />
          <text class="char-count">{{ form.comment.length }}/200</text>
        </view>

        <button class="submit-btn" :loading="loading" @tap="submitReview">提交评价</button>
      </view>
    </view>

    <!-- 查看评价模式 -->
    <view v-else class="view-mode">
      <view v-if="reviews.length === 0" class="empty-state">
        <text class="empty-icon">⭐</text>
        <text class="empty-text">暂无评价记录</text>
      </view>

      <view v-else>
        <view v-for="review in reviews" :key="review.id" class="review-item">
          <view class="review-header">
            <view class="reviewer-info">
              <view class="reviewer-avatar">
                <text>{{ review.user_name?.charAt(0) || '?' }}</text>
              </view>
              <view>
                <text class="reviewer-name">{{ review.user_name || '匿名用户' }}</text>
                <text class="review-time">{{ formatDate(review.created_at) }}</text>
              </view>
            </view>
            <view class="review-stars">
              <text v-for="i in 5" :key="i" class="star-sm" :class="{ active: i <= review.rating }">★</text>
            </view>
          </view>
          <text v-if="review.comment" class="review-comment">{{ review.comment }}</text>
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
import { ref, computed, onMounted } from 'vue'
import { reviewApi } from '../../utils/api.js'

const reviews = ref([])
const loading = ref(false)
const orderId = ref('')
const runnerId = ref('')

const isSubmitMode = computed(() => !!orderId.value && !!runnerId.value)

const form = ref({ rating: 5, comment: '' })

const ratingTexts = ['很差', '较差', '一般', '不错', '非常好']

onMounted(async () => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  orderId.value = currentPage.options?.order_id || ''
  runnerId.value = currentPage.options?.runner_id || ''

  if (!isSubmitMode.value) {
    await loadReviews()
  }
})

async function loadReviews() {
  try {
    const res = await reviewApi.getReviews({ page_size: 20 })
    if (res.code === 0) {
      reviews.value = res.data?.reviews || []
    }
  } catch (e) {
    console.error('加载评价失败', e)
  }
}

async function submitReview() {
  loading.value = true
  try {
    const res = await reviewApi.createReview({
      order_id: parseInt(orderId.value),
      runner_id: parseInt(runnerId.value),
      rating: form.value.rating,
      comment: form.value.comment
    })
    if (res.code === 0) {
      uni.showToast({ title: '评价提交成功！', icon: 'success' })
      setTimeout(() => uni.navigateBack(), 1000)
    } else {
      uni.showToast({ title: res.message || '提交失败', icon: 'none' })
    }
  } catch (e) {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function formatDate(timeStr) {
  if (!timeStr) return ''
  const date = new Date(timeStr)
  return `${date.getMonth()+1}月${date.getDate()}日`
}
</script>

<style lang="scss" scoped>
.reviews-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx 32rpx 40rpx;
}

.review-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.06);

  .card-title {
    display: block;
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 32rpx;
  }
}

.rating-section {
  text-align: center;
  margin-bottom: 32rpx;

  .rating-label {
    display: block;
    font-size: 26rpx;
    color: #666;
    margin-bottom: 20rpx;
  }

  .stars {
    display: flex;
    justify-content: center;
    gap: 16rpx;
    margin-bottom: 16rpx;

    .star {
      font-size: 64rpx;
      color: #ddd;
      transition: color 0.2s;

      &.active { color: #FFD700; }
    }
  }

  .rating-text {
    font-size: 28rpx;
    color: #FF9800;
    font-weight: 600;
  }
}

.form-item {
  margin-bottom: 24rpx;
  position: relative;

  .form-label {
    display: block;
    font-size: 26rpx;
    color: #666;
    margin-bottom: 12rpx;
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

  .char-count {
    position: absolute;
    right: 16rpx;
    bottom: 16rpx;
    font-size: 22rpx;
    color: #bdbdbd;
  }
}

.submit-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #FF9800, #F57C00);
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 50rpx;
  border: none;
  margin-top: 16rpx;
}

.review-item {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);

  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16rpx;

    .reviewer-info {
      display: flex;
      align-items: center;
      gap: 16rpx;

      .reviewer-avatar {
        width: 64rpx;
        height: 64rpx;
        border-radius: 50%;
        background: linear-gradient(135deg, #4CAF50, #2E7D32);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 28rpx;
        font-weight: 700;
      }

      .reviewer-name {
        display: block;
        font-size: 26rpx;
        font-weight: 600;
        color: #333;
      }

      .review-time {
        font-size: 22rpx;
        color: #999;
      }
    }

    .review-stars {
      display: flex;
      gap: 4rpx;

      .star-sm {
        font-size: 28rpx;
        color: #ddd;

        &.active { color: #FFD700; }
      }
    }
  }

  .review-comment {
    font-size: 26rpx;
    color: #666;
    line-height: 1.6;
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

.footer {
  text-align: center;
  padding: 40rpx 0 20rpx;
  font-size: 22rpx;
  color: #bdbdbd;
}
</style>
