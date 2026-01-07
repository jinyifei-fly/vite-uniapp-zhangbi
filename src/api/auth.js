const baseUrl = import.meta.env.VITE_API_BASE_URL
export function loginAPI(data) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${baseUrl}/api/v1/auth/login`,
      method: 'POST',
      data,
      header: {
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const resBody = res.data

          if (resBody.code === 0) {
            resolve(resBody)
          }
          else {
            const errorMsg = resBody.message || resBody.detail || '登录失败'
            reject(new Error(errorMsg))
          }
        }
        else {
          const errorMsg = res.data.detail || res.data.message || `请求错误 ${res.statusCode}`
          reject(new Error(errorMsg))
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络连接异常', icon: 'none' })
        reject(err)
      },
    })
  })
}
// 2. 获取当前用户信息 (对应你给的 getMe)
export function getMe() {
  return new Promise((resolve, reject) => {
    // ⚠️ 关键点：获取 Token
    const token = uni.getStorageSync('token')

    if (!token) {
      return reject(new Error('本地无 Token'))
    }

    uni.request({
      url: `${baseUrl}/api/v1/auth/me`,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const resBody = res.data
          if (resBody.code === 0) {
            resolve(resBody)
          }
          else {
            reject(new Error(resBody.message || '获取用户信息失败'))
          }
        }
        else {
          // 处理 401 Token 过期
          if (res.statusCode === 401) {
            uni.removeStorageSync('token')

            reject(new Error('登录已过期'))
          }
          else {
            reject(new Error(`请求错误 ${res.statusCode}`))
          }
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络连接异常', icon: 'none' })
        reject(err)
      },
    })
  })
}
