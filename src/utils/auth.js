// src/utils/auth.js
export function setUserInfo(info) {
  uni.setStorageSync('userInfo', JSON.stringify(info))
}

// 获取用户信息
export function getUserInfo() {
  return JSON.parse(uni.getStorageSync('userInfo') || '{}')
}

// 获取用户角色
export function getUserRole() {
  return getUserInfo().role || ''
}

// 获取商户ID
export function getMerchantId() {
  return getUserInfo().merchantId || ''
}

// 获取Token
export function getToken() {
  return getUserInfo().token || ''
}
