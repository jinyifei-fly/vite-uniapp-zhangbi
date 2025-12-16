<script setup>
import CustomTabBar from '@/components/CustomTabBar/index.vue'

function handleVerify() {
  uni.showToast({ title: '核销成功 -3 烧饼', icon: 'success' })
}

function handleDeliver() {
  uni.showToast({ title: '线索已交付', icon: 'success' })
}

function resetTask() {
  uni.showModal({
    title: '重置任务',
    content: '确定要跳过当前剧本节点吗？',
    success(res) {
      if (res.confirm) {
        uni.showToast({ title: '已重置', icon: 'none' })
      }
    },
  })
}
</script>

<template>
  <view class="min-h-screen bg-gray-100 pb-32 font-sans text-gray-800">
    <view class="pt-12 px-4 pb-4 flex justify-between items-center bg-white sticky top-0 z-40 shadow-sm">
      <view class="flex items-end gap-2">
        <text class="text-xl font-black text-gray-900">
          Merchant OS
        </text>
        <view class="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded font-bold">
          v2.1
        </view>
      </view>
      <view class="flex items-center gap-3">
        <view class="bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-xs font-bold border border-purple-100 flex items-center gap-1">
          🎭 剧本模式
        </view>
        <view class="text-gray-400 text-lg">
          ⚙️
        </view>
      </view>
    </view>

    <view class="p-4 space-y-4">
      <view class="bg-slate-800 rounded-2xl p-5 shadow-xl text-white relative overflow-hidden">
        <view class="absolute -right-4 -top-4 opacity-10 text-9xl rotate-12 pointer-events-none">
          ⚡
        </view>

        <view class="relative z-10 flex gap-4 items-start">
          <view class="w-16 h-16 rounded-xl bg-indigo-500 flex items-center justify-center text-3xl font-bold border-2 border-indigo-400/30 shadow-lg shrink-0">
            王
          </view>

          <view class="flex-1">
            <view class="text-[10px] text-indigo-300 font-bold tracking-wider uppercase mb-1">
              Current Role
            </view>
            <view class="text-xl font-bold mb-2 flex items-center gap-2">
              王掌柜 <span class="text-sm font-normal text-gray-400">(贪财性格)</span>
            </view>

            <view class="bg-black/20 rounded-lg p-3 text-xs leading-relaxed text-gray-300 border-l-2 border-indigo-500">
              设定：你不仅经营粮仓，还私下倒卖军粮。你对穷人很刻薄，但看到钱会两眼放光。
            </view>
          </view>
        </view>
      </view>

      <view class="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex justify-between items-center text-indigo-900">
        <view class="flex items-center gap-2 font-bold">
          <view class="text-lg">
            👥
          </view>
          <text>接待中：飞虎队</text>
          <view class="bg-white px-2 py-0.5 rounded text-xs border border-indigo-200">
            5人
          </view>
        </view>
        <text class="text-xs font-mono text-indigo-400">
          ID: ZB-001
        </text>
      </view>

      <view class="bg-white rounded-2xl p-6 shadow-sm relative border border-gray-50">
        <view class="absolute top-4 left-4 text-6xl text-gray-100 font-serif leading-none">
          “
        </view>

        <view class="flex justify-center mb-4">
          <text class="text-[10px] text-gray-400 font-bold tracking-[0.2em] uppercase">
            AI Script Suggestions
          </text>
        </view>

        <view class="relative z-10 px-2">
          <text class="text-lg text-gray-800 font-medium leading-relaxed block text-center">
            (轻蔑地看着这群人) 哼，这里是王记粮仓，闲杂人等不得入内！除非... 你们能证明自己的诚意。
          </text>
          <view class="absolute bottom-0 right-0 text-6xl text-gray-100 font-serif leading-none rotate-180">
            “
          </view>
        </view>

        <view class="flex justify-center gap-3 mt-6">
          <button class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs px-4 py-2 rounded-full flex items-center gap-1 border-0 transition-colors">
            🔄 刷新台词
          </button>
          <button class="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs px-4 py-2 rounded-full flex items-center gap-1 border-0 transition-colors">
            🔊 切换温和语气
          </button>
        </view>
      </view>

      <view class="space-y-3 mt-2">
        <view class="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4 text-white flex justify-between items-center shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform" @click="handleVerify">
          <view class="flex items-center gap-3">
            <view class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center text-xl">
              🎒
            </view>
            <view class="flex flex-col">
              <text class="font-bold text-lg">
                核销：特制烧饼 x3
              </text>
            </view>
          </view>
          <view class="text-white/80 text-xl">
            ›
          </view>
        </view>

        <view class="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl p-4 text-white flex justify-between items-center shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-transform" @click="handleDeliver">
          <view class="flex items-center gap-3">
            <view class="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center text-xl">
              🗝️
            </view>
            <view class="flex flex-col">
              <text class="font-bold text-lg">
                交付：粮仓钥匙 (线索)
              </text>
            </view>
          </view>
          <view class="text-white/80 text-xl">
            ›
          </view>
        </view>
      </view>
    </view>

    <CustomTabBar :current="1" />
  </view>
</template>

<style scoped>
/* 可以在这里添加特殊的字体样式，如果需要衬线体 */
</style>
