import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getMe, loginAPI } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref(uni.getStorageSync('token') || '')
  const tokenType = ref(uni.getStorageSync('tokenType') || 'Bearer')
  const role = ref(uni.getStorageSync('role') || '')

  const userId = ref(uni.getStorageSync('userId') || '')
  const userName = ref(uni.getStorageSync('userName') || '')
  const userInfo = ref(uni.getStorageSync('userInfo') || {})

  const getUserInfo = async () => {
    try {
      console.log('🚀 [Store] 正在调用 getMe 接口...')
      const res = await getMe()

      console.log('📦 [Store] getMe 原始返回数据:', res)

      if (!res || !res.data) {
        console.error('❌ [Store] getMe 返回结构异常，缺少 data 字段')
        return
      }

      const { user, profile } = res.data

      console.log('👤 [Store] 解构出的 user 对象:', user)
      console.log('📄 [Store] 解构出的 profile 对象:', profile)

      const realUserId = user ? (user.user_id || user.id || user.uuid) : ''
      const realUserName = user ? (user.username || user.name) : ''
      const realRole = user ? (user.user_type || user.role) : ''

      console.log('🔑 [Store] 提取到的 UserID:', realUserId)

      userId.value = realUserId
      userName.value = realUserName
      role.value = realRole

      const fullInfo = { ...(user || {}), ...(profile || {}) }
      userInfo.value = fullInfo

      uni.setStorageSync('userId', realUserId)
      uni.setStorageSync('userName', realUserName)
      uni.setStorageSync('role', realRole)
      uni.setStorageSync('userInfo', fullInfo)

      return res.data
    }
    catch (error) {
      console.error('❌ [Store] 获取用户信息失败:', error)
      throw error
    }
  }

  const login = async (loginForm) => {
    console.log('🚀 [Store] 开始登录...')
    const res = await loginAPI(loginForm)

    console.log('📦 [Store] Login 接口原始返回:', res)

    const { access_token, token_type } = res.data || {}

    if (!access_token) {
      console.error('❌ [Store] 登录返回中没有 access_token!')
    }

    token.value = access_token
    tokenType.value = token_type || 'Bearer'

    uni.setStorageSync('token', access_token)
    uni.setStorageSync('tokenType', tokenType.value)

    console.log('🔄 [Store] Token已存，准备获取用户信息...')
    await getUserInfo()

    return res
  }

  const logout = () => {
    token.value = ''
    userId.value = ''
    userInfo.value = {}
    uni.clearStorageSync()
  }

  return {
    token,
    tokenType,
    role,
    userId,
    userName,
    userInfo,
    login,
    logout,
    getUserInfo,
  }
})
