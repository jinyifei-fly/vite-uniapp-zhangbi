<script setup>
const props = defineProps({
  
  current: {
    type: Number,
    default: 0,
  },
})


const tabList = [
  {
    text: '态势',
    path: '/pages/index/index',
  },
  {
    text: '剧本',
    path: '/pages/task/index',
  },
  {
    text: '商品',

    path: '/pages/goods/index',
  },
  {
    text: '我的',

    path: '/pages/user/index',
  },
]

function switchTab(item) {
  uni.switchTab({
    url: item.path,
  })
}
</script>

<template>
  <view class="fixed bottom-0 w-full bg-white border-t border-gray-100 px-2 py-2 pb-6 z-50 safe-area-bottom">
    <view class="flex justify-between items-center h-full">
      <view
        v-for="(item, index) in tabList"
        :key="index"
        class="flex-1 flex flex-col items-center justify-center gap-1 py-1 active:bg-gray-50 rounded-lg transition-all"
        @click="switchTab(item)"
      >
        <text
          class="text-[10px] font-medium"
          :class="current === index ? 'text-indigo-600 font-bold' : 'text-gray-400'"
        >
          {{ item.text }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
