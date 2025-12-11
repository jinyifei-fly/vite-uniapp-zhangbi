import { useUserStore } from '@/store/user'
import request from '../index' // 复用项目已有的request封装

// 获取商品列表（管理员查全部，商户查自己）
export async function getGoodsList() {
  const userStore = useUserStore()
  const role = userStore.role
  const merchantId = userStore.merchantId

  // 构造请求参数
  const params = role === 'admin'
    ? { role }
    : { merchantId }

  // 拼接请求URL
  const url = role === 'admin'
    ? '/product/list/all'
    : '/product/list'

  return request({
    url,
    method: 'get',
    params,
  })
}
