import axios from 'axios'
import { ElMessage } from 'element-plus'

const service = axios.create({

  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 5000,
})

service.interceptors.request.use(
  (config) => {
    const token = uni.getStorageSync('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

service.interceptors.response.use(
  (response) => {
    const res = response.data

    if (res.code !== 0) {
      ElMessage.error(res.message || '请求出错了')
      return Promise.reject(res)
    }
    else {
      return res.data
    }
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      ElMessage.error('身份验证失败，请重新登录')
      uni.removeStorageSync('token')
      setTimeout(() => uni.reLaunch({ url: '/pages/login/index' }), 1000)
    }
    else {
      ElMessage.error(error.message || '服务器错误')
    }
    return Promise.reject(error)
  },
)

export default service
