import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { userApi } from '../utils/api.js'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '')
  const userInfo = ref(uni.getStorageSync('userInfo') || null)

  const isLoggedIn = computed(() => !!token.value && !!userInfo.value)

  function setToken(newToken) {
    token.value = newToken
    uni.setStorageSync('token', newToken)
  }

  function setUserInfo(info) {
    userInfo.value = info
    uni.setStorageSync('userInfo', info)
  }

  function logout() {
    token.value = ''
    userInfo.value = null
    uni.removeStorageSync('token')
    uni.removeStorageSync('userInfo')
    uni.reLaunch({ url: '/pages/login/login' })
  }

  async function refreshUserInfo() {
    if (!userInfo.value?.phone) return
    try {
      const res = await userApi.getUserByPhone(userInfo.value.phone)
      if (res.code === 0) {
        // 后端 get_user_by_phone 返回 name 字段；登录接口返回 username。
        // 这里做兼容映射，避免刷新后名字变成 undefined。
        const data = res.data || {}
        if (data.name && !data.username) data.username = data.name
        setUserInfo({ ...userInfo.value, ...data })
      }
    } catch (e) {
      console.error('刷新用户信息失败', e)
    }
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    setToken,
    setUserInfo,
    logout,
    refreshUserInfo
  }
})
