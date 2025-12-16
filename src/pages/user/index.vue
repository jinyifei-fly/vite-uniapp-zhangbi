<script setup>
import { showModal, showToast } from '@uni-helper/uni-promises'
import { useRouter } from 'uniapp-router-next' 
import { computed } from 'vue' 
import CustomTabBar from '@/components/CustomTabBar/index.vue'
import { useUserStore } from '@/store/user' 
import { sleep } from '@/utils'

const userStore = useUserStore()
const router = useRouter()

const isLogin = computed(() => !!userStore.token)

const userName = computed(() => userStore.userName || userStore.username)

function handleMenuItemClick(item) {
  if (!item.path) {
    showToast({ title: '功能待开发', icon: 'none' })
    return
  }
  router.push({ path: item.path, query: item.query || {} })
}

function handleLogin() {
  if (isLogin.value) {
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
  <view class="min-h-screen flex flex-col bg-gray-100 font-sans text-gray-800">
    <view class="pt-12 px-4 pb-4 flex justify-between items-center bg-gray-100 sticky top-0 z-40">
      <view class="flex items-end gap-2">
        <text class="text-xl font-black text-gray-900 tracking-tight">
          个人中心
        </text>
        <view class="bg-gray-200 text-gray-500 text-xs px-1.5 py-0.5 rounded font-bold uppercase">
          Profile
        </view>
      </view>
    </view>

    <view class="flex-1 px-4 space-y-6">
      <view
        class="bg-slate-800 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden active:scale-[0.98] transition-transform"
        @click="handleLogin"
      >
        <view class="absolute -right-4 -top-4 opacity-10 text-8xl rotate-12 pointer-events-none">
          🆔
        </view>

        <view class="relative z-10 flex items-center gap-5">
          <view class="h-20 w-20 rounded-2xl bg-slate-700 border-2 border-indigo-500/30 p-1 shadow-lg overflow-hidden shrink-0">
            <image
              src="~@assets/images/avatar.png"
              alt="用户头像"
              class="h-full w-full object-cover rounded-xl bg-gray-600"
            />
          </view>

          <view class="flex-1 min-w-0">
            <view v-if="isLogin">
              <view class="text-2xl font-bold truncate">
                {{ userName || '商户' }}
              </view>
              <view class="mt-2 inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                已登录系统
              </view>
            </view>

            <view v-else>
              <view class="text-xl font-bold mb-1">
                立即登录
              </view>
              <view class="inline-block rounded-lg bg-white/10 px-3 py-1 text-xs text-gray-300 font-bold border border-white/10">
                未连接会话
              </view>
            </view>
          </view>

          <view v-if="isLogin" class="text-gray-400">
            <view class="i-carbon-chevron-right text-xl"></view>
          </view>
        </view>
      </view>

      <view v-if="isLogin" class="pt-4">
        <button
          class="w-full bg-white text-red-500 border border-red-100 rounded-xl py-4 flex items-center justify-center gap-2 shadow-sm active:bg-red-50 transition-all font-bold text-sm"
          @click="handleLogout"
        >
          <view class="i-carbon-power text-lg"></view>
          退出登录
        </button>
      </view>
    </view>

    <view class="pb-safe">
      <CustomTabBar :current="1" />
    </view>
  </view>
</template>

<style scoped>
/* 优化点击反馈 */
* {
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
}

button::after {
  border: none;
}

button:disabled {
  opacity: 0.6 !important;
  cursor: not-allowed;
}

/* 适配底部安全区 */
.pb-safe {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
