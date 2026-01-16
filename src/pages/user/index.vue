<script setup>
import { onShow } from '@dcloudio/uni-app'
import { showModal, showToast } from '@uni-helper/uni-promises'
import { computed, ref } from 'vue'
import { reportLocationAPI } from '@/api/common'
import { createTeamAPI, getTeamListAPI, updateTeamStatusAPI } from '@/api/team'
import CustomTabBar from '@/components/CustomTabBar/index.vue'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()

const isLogin = computed(() => !!userStore.token)
const userName = computed(() => userStore.userName || '访客用户')

const teamList = ref([

])

const showCreateModal = ref(false)
const isCreating = ref(false)
const newTeamName = ref('')

onShow(() => {
  // 只有导游身份才上报位置和获取队伍列表
  if (isLogin.value && userStore.role === 'guide') {
    handleReportLocation()
    fetchTeamList()
  }
})

function getStatusConfig(status) {
  const map = {
    0: { label: '未开始', color: 'text-gray-400', bg: 'bg-gray-100', dot: 'bg-gray-400' },
    1: { label: '进行中', color: 'text-emerald-600', bg: 'bg-emerald-100', dot: 'bg-emerald-500' },
    2: { label: '已结束', color: 'text-red-500', bg: 'bg-red-50', dot: 'bg-red-400' },
  }
  return map[status] || map[0]
}

function openCreateModal() {
  if (!isLogin.value) {
    showToast({ title: '请先登录', icon: 'none' })
    return
  }
  newTeamName.value = ''
  showCreateModal.value = true
}

function closeCreateModal() {
  showCreateModal.value = false
}

function handleLogin() {
  if (isLogin.value)
    return
  uni.navigateTo({ url: '/pages/login/index' })
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
    uni.reLaunch({ url: '/pages/login/index' })
  }
}

async function handleSubmitCreate() {
  if (!newTeamName.value.trim()) {
    showToast({ title: '请输入队伍名称', icon: 'none' })
    return
  }

  try {
    isCreating.value = true

    const res = await createTeamAPI({ team_name: newTeamName.value })

    showToast({ title: '创建成功', icon: 'success' })

    teamList.value.unshift({
      id: res.team_id,
      name: res.team_name,
      code: res.binding_code,

      status: res.current_status !== undefined ? res.current_status : 0,
    })

    closeCreateModal()
  }
  catch (error) {
    console.error('创建失败:', error)

    const msg = error.message || '创建失败'
    showToast({ title: msg, icon: 'none' })
  }
  finally {
    isCreating.value = false
  }
}
async function handleReportLocation() {
  uni.getLocation({
    type: 'wgs84',
    success: async (res) => {
      try {
        console.log('导游位置:', res.latitude, res.longitude)

        await reportLocationAPI({
          lat: res.latitude,
          lng: res.longitude,
          zone_id: 'zone_01',

        })
        console.log('位置上报成功')
      }
      catch (error) {
        console.error('上报接口失败:', error)
      }
    },
    fail: (err) => {
      console.error('获取定位失败，请检查权限:', err)
      uni.showToast({ title: '获取定位失败', icon: 'none' })
    },
  })
}
async function fetchTeamList() {
  try {
    const res = await getTeamListAPI()

    if (Array.isArray(res)) {
      teamList.value = res.map(item => ({
        id: item.team_id,
        name: item.team_name,
        code: item.binding_code,
        status: item.current_status,
      }))
    }
  }
  catch (error) {
    console.error('获取列表失败', error)
  }
}

function handleCopyCode(code) {
  if (!code)
    return
  uni.setClipboardData({
    data: code,
    success: () => uni.showToast({ title: '队伍码已复制', icon: 'none' }),
  })
}

function handleEditTeam(team, index) {
  uni.showActionSheet({
    itemList: ['未开始', '进行中', '已结束'],
    success: async (res) => {
      const newStatusId = res.tapIndex

      if (team.status === newStatusId)
        return

      try {
        uni.showLoading({ title: '更新中...', mask: true })

        const result = await updateTeamStatusAPI(team.id, newStatusId)

        team.status = result.current_status !== undefined ? result.current_status : newStatusId

        uni.hideLoading()
        showToast({ title: '状态更新成功', icon: 'success' })
      }
      catch (error) {
        uni.hideLoading()
        const msg = error.message || '更新失败'
        showToast({ title: msg, icon: 'none' })
      }
    },
  })
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

    <view class="flex-1 px-4 flex flex-col gap-5 pb-4">
      <view class="bg-slate-800 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden shrink-0">
        <view class="absolute -right-4 -top-4 opacity-10 text-8xl rotate-12 pointer-events-none">
          🆔
        </view>
        <view class="relative z-10 flex items-center gap-5">
          <view class="h-16 w-16 rounded-2xl bg-slate-700 border-2 border-indigo-500/30 p-1 shadow-lg overflow-hidden shrink-0">
            <image src="~@assets/images/avatar.png" class="h-full w-full object-cover rounded-xl bg-gray-600" />
          </view>

          <view class="flex-1 min-w-0">
            <view class="flex items-center gap-3">
              <view class="text-2xl font-bold truncate">
                {{ userName }}
              </view>

              <template v-if="!isLogin">
                <view
                  class="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-full font-bold transition-colors active:scale-95 flex items-center gap-1 cursor-pointer shadow-md shadow-indigo-500/30"
                  @click="handleLogin"
                >
                  <view class="i-carbon-login"></view>
                  立即登录
                </view>
              </template>
              <template v-else>
                <view class="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold flex items-center">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>已连接
                </view>
              </template>
            </view>

            <view class="mt-1 text-gray-400 text-xs font-medium">
              {{ isLogin ? '欢迎回到导游管理系统' : '登录以管理您的队伍数据' }}
            </view>
          </view>
        </view>
      </view>

      <template v-if="isLogin">
        <view class="shrink-0">
          <button
            class="w-full bg-indigo-600 text-white rounded-2xl py-4 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:bg-indigo-700 transition-all font-bold text-base border-none"
            @click="openCreateModal"
          >
            <view class="i-carbon-add-alt text-xl"></view>
            创建新队伍
          </button>
        </view>

        <view class="flex flex-col gap-3">
          <view class="flex items-center justify-between px-1">
            <text class="text-sm font-bold text-gray-500">
              队伍列表
            </text>
            <text class="text-xs text-gray-400">
              {{ teamList.length }} 个队伍
            </text>
          </view>

          <view v-if="teamList.length === 0" class="bg-white rounded-2xl p-8 flex flex-col items-center justify-center text-gray-300 border border-dashed border-gray-200">
            <view class="i-carbon-group text-4xl mb-2"></view>
            <text class="text-xs">
              暂无队伍，快去创建吧
            </text>
          </view>

          <view
            v-for="(team, index) in teamList"
            :key="team.id || index"
            class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between"
          >
            <view class="flex-1 min-w-0 flex flex-col gap-1 pr-2">
              <view class="flex items-center gap-2">
                <text class="text-base font-black text-gray-800 truncate">
                  {{ team.name }}
                </text>
              </view>
              <view
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md w-fit text-[10px] font-bold transition-colors"
                :class="getStatusConfig(team.status).bg"
              >
                <view class="w-1.5 h-1.5 rounded-full" :class="getStatusConfig(team.status).dot"></view>
                <text :class="getStatusConfig(team.status).color">
                  {{ getStatusConfig(team.status).label }}
                </text>
              </view>
            </view>

            <view
              class="flex flex-col items-center justify-center px-4 border-l border-r border-gray-100 mx-2 cursor-pointer active:opacity-60"
              @click="handleCopyCode(team.code)"
            >
              <text class="text-[10px] text-gray-400 font-bold mb-0.5">
                队伍码
              </text>
              <text class="font-mono font-black text-xl text-indigo-600 tracking-widest leading-none">
                {{ team.code }}
              </text>
            </view>

            <view
              class="pl-2 flex items-center justify-center"
              @click="handleEditTeam(team, index)"
            >
              <view class="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 flex items-center justify-center active:scale-90 transition-transform">
                <view class="i-carbon-settings text-lg"></view>
              </view>
            </view>
          </view>
        </view>

        <view class="mt-auto pt-6 mb-24">
          <button class="w-full bg-white text-gray-500 border border-gray-200 rounded-xl py-3 flex items-center justify-center gap-2 active:bg-gray-50 transition-all font-bold text-sm" @click="handleLogout">
            <view class="i-carbon-power text-lg "></view>退出登录
          </button>
        </view>
      </template>

      <template v-else>
        <view class="flex-1 flex flex-col items-center justify-center opacity-40 space-y-4">
          <view class="i-carbon-unlocked text-6xl text-gray-300"></view>
          <text class="text-gray-400 text-sm font-bold">
            请点击上方按钮登录
          </text>
        </view>
      </template>
    </view>

    <view class="pb-safe">
      <CustomTabBar :current="1" />
    </view>

    <view v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center px-8">
      <view class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeCreateModal"></view>
      <view class="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl animate-in-zoom overflow-hidden" @click.stop>
        <view class="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-indigo-50/80 to-transparent pointer-events-none"></view>
        <view class="relative h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-6 mx-auto rotate-3 shadow-sm">
          <view class="i-carbon-flag-filled text-4xl"></view>
        </view>
        <view class="text-center mb-8 relative">
          <text class="text-2xl font-black text-gray-900 block tracking-tight">
            开启新的旅程
          </text>
          <text class="text-sm text-gray-400 mt-2 font-medium block">
            为你的团队起一个响亮的名字
          </text>
        </view>
        <view class="mb-8 relative">
          <view class="bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 transition-all flex items-center gap-3 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-500/10 h-16">
            <view class="i-carbon-edit text-xl text-gray-400 shrink-0"></view>
            <input v-model="newTeamName" class="flex-1 h-full text-lg text-gray-900 font-bold bg-transparent" placeholder="请输入队伍名称" :disabled="isCreating" :cursor-spacing="20" />
          </view>
        </view>
        <view class="grid grid-cols-2 gap-4">
          <button class="w-full bg-gray-50 text-gray-600 rounded-2xl py-4 text-base font-bold border-none" @click="closeCreateModal">
            取消
          </button>
          <button class="w-full bg-indigo-600 text-white rounded-2xl py-4 text-base font-bold border-none flex items-center justify-center gap-2" @click="handleSubmitCreate">
            <view v-if="isCreating" class="i-carbon-circle-dash animate-spin text-xl"></view>
            <text>{{ isCreating ? '创建中...' : '立即创建' }}</text>
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
@keyframes zoomIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.animate-in-zoom {
  animation: zoomIn 0.2s ease-out forwards;
}
button::after {
  border: none;
}
.pb-safe {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
