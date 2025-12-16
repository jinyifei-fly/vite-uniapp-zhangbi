<script setup>
import { ref } from 'vue'
import CustomTabBar from '@/components/CustomTabBar/index.vue'

const flowList = ref([
  {
    id: 1,
    teamName: '飞虎队',
    peopleCount: 5,
    taskName: '寻找粮仓钥匙',
    arrivalTime: 3,
    tags: [
      { label: '⚠️ 坚果过敏', type: 'warning' },
    ],
  },
  {
    id: 2,
    teamName: '探险小分队',
    peopleCount: 3,
    taskName: '购买补给',
    arrivalTime: 12,
    tags: [],
  },
  {
    id: 3,
    teamName: '历史研学团',
    peopleCount: 12,
    taskName: '参观壁画',
    arrivalTime: 25,
    tags: [
      { label: '👨‍🦽 轮椅需求', type: 'info' },
    ],
  },
])

function getTimeColor(time) {
  if (time <= 5)
    return 'bg-red-100 text-red-500'
  if (time <= 15)
    return 'bg-gray-100 text-gray-600'
  return 'bg-gray-100 text-gray-400'
}

function getTagColor(type) {
  if (type === 'warning')
    return 'bg-red-50 border-red-100 text-red-500'
  if (type === 'info')
    return 'bg-orange-50 border-orange-100 text-orange-500'
  return 'bg-gray-50 border-gray-200 text-gray-500'
}
</script>

<template>
  <view class="min-h-screen bg-gray-100 pb-24 font-sans text-gray-800">
    <view class="pt-12 px-4 pb-2 flex justify-between items-center bg-white sticky top-0 z-50">
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
          🎭 副本模式
        </view>
        <view class="text-gray-400 text-lg">
          ⚙️
        </view>
      </view>
    </view>

    <view class="p-4 space-y-4">
      <view class="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 shadow-lg text-white relative overflow-hidden">
        <view class="absolute -right-6 -top-6 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl"></view>

        <view class="relative z-10 flex justify-between items-start">
          <view>
            <view class="flex items-center gap-2 mb-1">
              <text class="text-lg">
                📍
              </text>
              <text class="text-xl font-bold">
                王记粮仓 (节点#042)
              </text>
            </view>
            <view class="flex items-center gap-1 opacity-90 text-sm">
              <view class="w-2 h-2 rounded-full bg-green-400"></view>
              <text>AI流量分发开启</text>
            </view>
          </view>

          <view class="bg-white/20 p-1 rounded-full w-12 h-7 flex items-center justify-end px-1">
            <view class="w-5 h-5 bg-white rounded-full shadow-sm"></view>
          </view>
        </view>
      </view>

      <view class="grid grid-cols-2 gap-3">
        <view class="bg-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <view class="flex items-center gap-1 text-gray-500 text-xs mb-2">
            <text>👥 当前排队/承载力</text>
          </view>
          <view class="flex items-baseline gap-1 mb-2">
            <text class="text-3xl font-black text-gray-900">
              5
            </text>
            <text class="text-gray-400 text-sm">
              / 20人
            </text>
          </view>
          <view class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <view class="bg-green-500 h-full rounded-full" style="width: 25%"></view>
          </view>
        </view>

        <view class="bg-white rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <view class="flex items-center gap-1 text-gray-500 text-xs mb-2">
            <text>🕒 预计15分钟客流</text>
          </view>
          <view class="flex items-baseline gap-1 mb-2">
            <text class="text-3xl font-black text-indigo-600">
              17
            </text>
            <text class="text-gray-400 text-sm">
              人
            </text>
          </view>
          <view class="bg-red-50 text-red-500 text-[10px] px-2 py-0.5 rounded flex items-center w-max">
            ⚠️ 含特殊需求团队
          </view>
        </view>
      </view>

      <view class="bg-white rounded-2xl p-4 shadow-sm min-h-[300px]">
        <view class="flex justify-between items-center mb-4">
          <text class="font-bold text-gray-800 text-lg">
            流量预报 (Incoming Stream)
          </text>
          <view class="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full font-medium">
            ● 实时更新
          </view>
        </view>

        <view class="space-y-4">
          <view v-for="(item, index) in flowList" :key="item.id" class="flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <view
              class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
              :class="getTimeColor(item.arrivalTime)"
            >
              {{ item.arrivalTime }}m
            </view>

            <view class="flex-1">
              <view class="flex items-baseline gap-2">
                <text class="font-bold text-gray-900 text-base">
                  {{ item.teamName }}
                </text>
                <text class="text-gray-400 text-sm">
                  ({{ item.peopleCount }}人)
                </text>
              </view>
              <view class="text-gray-500 text-xs mt-0.5">
                任务: {{ item.taskName }}
              </view>

              <view v-if="item.tags" class="mt-1.5 flex gap-1">
                <view
                  v-for="(tag, tagIdx) in item.tags" :key="tagIdx"
                  class="text-[10px] px-1.5 py-0.5 rounded border"
                  :class="getTagColor(tag.type)"
                >
                  {{ tag.label }}
                </view>
              </view>
            </view>

            <view class="text-gray-300">
              ›
            </view>
          </view>
        </view>
      </view>
    </view>
    <CustomTabBar :current="0" />
  </view>
</template>

<style lang="scss" scoped>
</style>
