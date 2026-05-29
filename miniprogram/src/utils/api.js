// API 基础地址 - 部署到新服务器/域名时只需修改下方一处或设置环境变量
// 优先读取构建时注入的环境变量（vite 通过 import.meta.env 暴露），其次走默认地址
let API_BASE = 'https://rural-errand-api-246677-4-1394833136.sh.run.tcloudbase.com/api'
try {
  // 部分 uni-app 编译目标支持 import.meta.env
  // eslint-disable-next-line no-undef
  const envBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) || ''
  if (envBase) API_BASE = envBase.replace(/\/+$/, '')
} catch (e) {
  // 忽略，使用默认值
}
// 若运行时 globalThis 上存在覆盖配置，则使用之（方便管理端联调）
if (typeof globalThis !== 'undefined' && globalThis.__API_BASE__) {
  API_BASE = String(globalThis.__API_BASE__).replace(/\/+$/, '')
}

/**
 * 把对象拼成 query string（小程序没有 URLSearchParams，自己实现）
 */
function buildQuery(params = {}) {
  const parts = []
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '') continue
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  }
  return parts.join('&')
}

/**
 * 封装 uni.request，支持 token 认证
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token')
    const header = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.header || {})
    }

    uni.request({
      url: `${API_BASE}${url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res) => {
        if (res.statusCode === 401) {
          // token 过期，跳转登录
          uni.removeStorageSync('token')
          uni.removeStorageSync('userInfo')
          uni.reLaunch({ url: '/pages/login/login' })
          reject(new Error('未登录'))
          return
        }
        resolve(res.data)
      },
      fail: (err) => {
        uni.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      }
    })
  })
}

// ==================== 系统配置 ====================
export const systemApi = {
  // 拉取后端运行时配置（disable_sms / commission_rate 等），供客户端判断界面展示
  getHealth() {
    return request('/health')
  }
}

// ==================== 认证相关 ====================
export const authApi = {
  // 发送短信验证码
  sendSms(phone, type) {
    return request('/auth/send-sms', {
      method: 'POST',
      data: { phone, type }
    })
  },
  // 注册
  register(data) {
    return request('/auth/register', {
      method: 'POST',
      data
    })
  },
  // 登录
  login(data) {
    return request('/auth/login', {
      method: 'POST',
      data
    })
  },
  // 退出登录
  logout() {
    return request('/auth/logout', { method: 'POST' })
  }
}

// ==================== 用户相关 ====================
export const userApi = {
  // 获取用户信息
  getUserByPhone(phone) {
    return request(`/users/${phone}`)
  },
  // 更新个人资料
  updateProfile(data) {
    return request('/users/profile', {
      method: 'PUT',
      data
    })
  },
  // 修改密码
  changePassword(data) {
    return request('/users/password', {
      method: 'PUT',
      data
    })
  }
}

// ==================== 订单相关 ====================
export const orderApi = {
  // 获取订单列表
  getOrders(params = {}) {
    const query = buildQuery(params)
    return request(`/orders${query ? '?' + query : ''}`)
  },
  // 获取订单详情
  getOrderDetail(orderId) {
    return request(`/orders/${orderId}`)
  },
  // 发布订单
  createOrder(data) {
    return request('/orders', {
      method: 'POST',
      data
    })
  },
  // 接单
  acceptOrder(orderId) {
    return request(`/orders/${orderId}/accept`, { method: 'PUT' })
  },
  // 完成订单
  completeOrder(orderId) {
    return request(`/orders/${orderId}/complete`, { method: 'PUT' })
  },
  // 取消订单
  cancelOrder(orderId, reason) {
    return request(`/orders/${orderId}/cancel`, {
      method: 'PUT',
      data: { reason }
    })
  },
  // 跑腿员取消已接订单（订单退回 pending）
  runnerCancelOrder(orderId, reason) {
    return request(`/orders/${orderId}/runner-cancel`, {
      method: 'PUT',
      data: { reason }
    })
  }
}

// ==================== 收益相关 ====================
export const earningsApi = {
  // 获取收益记录
  getEarnings(params = {}) {
    const query = buildQuery(params)
    return request(`/earnings${query ? '?' + query : ''}`)
  },
  // 申请提现
  withdraw(amount) {
    return request('/earnings/withdraw', {
      method: 'POST',
      data: { amount }
    })
  }
}

// ==================== 评价相关 ====================
export const reviewApi = {
  // 获取评价列表
  getReviews(params = {}) {
    const query = buildQuery(params)
    return request(`/reviews${query ? '?' + query : ''}`)
  },
  // 提交评价
  createReview(data) {
    return request('/reviews', {
      method: 'POST',
      data
    })
  }
}

// ==================== 反馈相关 ====================
export const feedbackApi = {
  // 提交反馈
  createFeedback(data) {
    return request('/feedback', {
      method: 'POST',
      data
    })
  }
}

export default request
