// src/api/team.js
const baseUrl = import.meta.env.VITE_API_BASE_URL

export function createTeamAPI(data) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${baseUrl}/api/v1/guide/team/create`,
      method: 'POST',
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${uni.getStorageSync('token')}`,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        }
        else {
          uni.showToast({ title: res.data.detail || '创建失败', icon: 'none' })
          reject(res.data)
        }
      },
      fail: err => reject(err),
    })
  })
}
