import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGoodsStore = defineStore('goods', () => {
  // 商品列表数据
  const goodsList = ref([])
  // 加载状态（用于显示loading）
  const goodsLoading = ref(false)

  // 设置商品列表
  function setGoodsList(list) {
    goodsList.value = list
  }

  // 清空商品列表
  function clearGoodsList() {
    goodsList.value = []
  }

  // 设置加载状态
  function setGoodsLoading(status) {
    goodsLoading.value = status
  }

  return {
    goodsList,
    goodsLoading,
    setGoodsList,
    clearGoodsList,
    setGoodsLoading,
  }
})
