const baseUrl = import.meta.env.VITE_API_BASE_URL

function request(options) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',

        'Authorization': `Bearer ${uni.getStorageSync('token')}`,
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        }
        else {
          reject(res.data)
        }
      },
      fail: err => reject(err),
    })
  })
}

/**
 * 获取商户商品列表
 * @param {object} params { page, size, keyword }
 */
export function getProductListAPI(params) {
  return request({
    url: '/api/v1/merchant/products',
    method: 'GET',
    data: {
      page: params.page || 1,
      size: params.size || 20,
      keyword: params.keyword || '',
    },
  })
}
/**
 * 商户端 - 新增商品
 */
export function createProductAPI(data) {
  return request({
    url: '/api/v1/merchant/products',
    method: 'POST',
    data,
  })
}
