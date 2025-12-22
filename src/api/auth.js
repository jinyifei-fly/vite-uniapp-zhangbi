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
          resolve(res.data)
        }
        else {
          const errorMsg = res.data.detail || '登录请求失败'

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
