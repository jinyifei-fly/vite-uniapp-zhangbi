<script setup>
import { onHide, onLaunch, onShow } from '@dcloudio/uni-app'
import { updateShades } from '@root/helpers/unocss-preset-shades'

import { watchEffect } from 'vue'

import { useAppStore } from '@/store/app'

import { useSocketStore } from '@/store/socket'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const socketStore = useSocketStore()
const appStore = useAppStore()

onLaunch(() => {
  console.log('🚀 App Launch')

  uni.hideTabBar().catch(() => {})

  if (userStore.token) {
    console.log('✅ 检测到 Token，连接 Socket...')
    socketStore.connect()
  }
  else {
    console.log('⚠️ 无 Token，跳过 Socket 连接')
  }
})

onShow(() => {
  console.log('App Show')
  uni.hideTabBar().catch(() => {})
})

onHide(() => {
  console.log('App Hide')
})

watchEffect(() => {
  if (appStore.primaryColor) {
    updateShades(appStore.primaryColor)
  }
})
</script>

<style lang="scss">
@import '@unocss-applet/reset/uni-app/button-after.css';
@import '@unocss-applet/reset/uni-app/tailwind-compat.css';

@import './styles/css/index.css';
</style>
