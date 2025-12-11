<script setup>
import { showModal, showToast } from '@uni-helper/uni-promises'
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()

const isLogin = computed(() => !!userStore.token)
const userName = computed(() => userStore.userName)

const systemItems = computed(() => [
  {
    icon: 'i-carbon-settings',
    text: '偏好设置',
    path: '/preference',
  },
])

function handleMenuItemClick(item) {
  if (!item.path) {
    showToast({ title: '功能待开发', icon: 'none' })
    return
  }
  router.push({ path: item.path, query: item.query || {} })
}

function handleLogin() {
  if (isLogin.value) {
    router.push({ path: '/personal' })
    return
  }
  router.push({ path: '/login' })
}

async function handleLogout() {
  const result = await showModal({
    title: '提示',
    content: '确定要退出登录吗?',
    showCancel: true,
    confirmText: '确定',
    cancelText: '取消',
  })

  if (result.confirm) {
    await userStore.logout()
    await showToast({ title: '退出登录成功', icon: 'success' })
    await sleep()
    router.push({ path: '/login' })
  }
}
</script>

<template>
  <view class="h-full flex flex-col bg-white">
    <view class="relative overflow-hidden bg-gradient-to-r from-blue-500 to-blue-400">
      <view class="absolute -right-10 -top-10 h-42 w-42 rounded-full border border-white/10"></view>
      <view class="absolute bottom-0 right-20 h-20 w-20 rounded-full border border-white/10"></view>

      <view class="h-[--safe-top]"></view>

      <view
        class="relative flex items-center px-6 pb-12 pt-12 cursor-pointer"
        @click="handleLogin"
      >
        <view class="h-18 w-18 overflow-hidden border-2 border-white/50 rounded-full shadow-sm">
          <image
            src="~@assets/images/avatar.png"
            alt="用户头像"
            class="h-full w-full object-cover"
          />
        </view>

        <view class="ml-4 flex-1">
          <view v-if="isLogin" class="text-xl text-white font-bold">
            {{ userName || '商户' }}
          </view>
          <view v-else class="flex items-center">
            <view class="text-xl text-white font-medium">
              立即登录
            </view>
            <view class="ml-2 rounded-full bg-white/20 px-3 py-1 text-xs text-white">
              未登录
            </view>
          </view>
        </view>

        <view v-if="isLogin" class="text-white/70">
          <view class="i-carbon-chevron-right size-6"></view>
        </view>
      </view>
    </view>

    <view class="mx-3 mt-3 overflow-hidden rounded-xl border border-blue-50 shadow-sm">
      <view
        v-for="(item, index) of systemItems"
        :key="index"
        class="flex items-center bg-white px-5 py-4 transition-colors duration-200 active:bg-blue-50"
        :class="[index !== systemItems.length - 1 ? 'border-b border-blue-50' : '']"
        hover-class="bg-blue-50"
        @click="handleMenuItemClick(item)"
      >
        <view class="w-10 flex flex-none items-center justify-center">
          <view class="size-6 text-blue-500" :class="item.icon"></view>
        </view>

        <view class="flex-1 text-gray-800 font-medium">
          {{ item.text }}
        </view>

        <view class="text-blue-100">
          <view class="i-carbon-chevron-right size-5"></view>
        </view>
      </view>
    </view>

    <view v-if="isLogin" class="mb-8 mt-auto px-5">
      <button
        class="w-full bg-blue-600 py-3 text-white font-medium transition-colors duration-200 !rounded-lg"
        hover-class="bg-blue-700"
        @click="handleLogout"
      >
        退出登录
      </button>
    </view>
    <CustomTabBar :current="1" />
  </view>
</template>

<style scoped>
/* 优化点击反馈：去除默认高亮 */
* {
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
}

/* 适配H5/web端：按钮禁用状态 */
button:disabled {
  opacity: 0.6 !important;
  cursor: not-allowed;
}
</style>
