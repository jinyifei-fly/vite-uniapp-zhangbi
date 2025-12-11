import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getUserInfo, postUserLogin } from '@/api/user/index.js'

export const useUserStore = defineStore(
  'user',
  () => {
    const token = ref(uni.getStorageSync('user_token') || '')
    const userName = ref(uni.getStorageSync('user_name') || '')
    const role = ref(uni.getStorageSync('user_role') || '') // 用户角色（admin/merchant）
    const merchantId = ref(uni.getStorageSync('merchant_id') || '') // 商户ID

    // 2. 登录方法：存储所有关键信息到缓存
    async function login(loginParams) {
      const res = await postUserLogin(loginParams)
      // 假设登录接口返回：token、userId、userName、role、merchantId、userInfo
      token.value = res.token
      userName.value = res.userName
      role.value = res.role
      merchantId.value = res.merchantId

      // 同步到本地缓存
      uni.setStorageSync('user_token', res.token)
      uni.setStorageSync('user_name', res.userName)
      uni.setStorageSync('user_role', res.role)
      uni.setStorageSync('merchant_id', res.merchantId)
    }

    function logout() {
      token.value = ''
      userName.value = ''
      role.value = ''
      merchantId.value = ''

      // 清空缓存
      uni.removeStorageSync('user_token')
      uni.removeStorageSync('user_name')
      uni.removeStorageSync('user_role')
      uni.removeStorageSync('merchant_id')
    }

    async function getUserData() {
      const res = await getUserInfo()
      role.value = res.data.role // 同步角色
      merchantId.value = res.data.merchantId // 同步商户ID

      uni.setStorageSync('user_role', res.data.role)
      uni.setStorageSync('merchant_id', res.data.merchantId)
    }
    function setAuthData(newToken, newMerchantId, newName, newRole) {
      token.value = newToken
      userName.value = newName
      role.value = newRole
      merchantId.value = newMerchantId

      // 同步缓存
      uni.setStorageSync('user_token', newToken)
      uni.setStorageSync('user_name', newName)
      uni.setStorageSync('user_role', newRole)
      uni.setStorageSync('merchant_id', newMerchantId)
    }
    return {
      token,
      userName,
      role, // 暴露角色
      merchantId, // 暴露商户ID
      logout,
      login,
      getUserData,
      setAuthData,
    }
  },
  {
    // Pinia持久化配置
    persist: {
      enabled: true,
      strategies: [
        {
          key: 'user_store', // 缓存键名
          storage: {
            // 自定义存储实现（适配uni-app的本地缓存）
            getItem: (key) => {
              return uni.getStorageSync(key)
            },
            setItem: (key, value) => {
              uni.setStorageSync(key, value)
            },
            removeItem: (key) => {
              uni.removeStorageSync(key)
            },
          },
          paths: ['token', 'userName', 'role', 'merchantId'], // 需要持久化的字段
        },
      ],
    },
  },
)
