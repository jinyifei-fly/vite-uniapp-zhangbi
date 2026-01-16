<script setup>
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, onUnmounted, ref, watch } from 'vue'
import { getTeamListAPI, getTeamMembersAPI } from '@/api/team' // 确保引入了这两个
import CustomTabBar from '@/components/CustomTabBar/index.vue'

// 🟢 Store
import { useGameStore } from '@/store/game'
import { useSocketStore } from '@/store/socket'
import { useUserStore } from '@/store/user'

const gameStore = useGameStore()
const socketStore = useSocketStore()
const userStore = useUserStore()

// --- 状态定义 ---
const teamList = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const isLoading = ref(false)
const isRefreshing = ref(false)
const eventLogs = ref([])
const unreadMsgMap = ref({})

// 🟢 计算当前选中的队伍 (用于顶部标题)
const currentActiveTeam = computed(() => {
  if (!gameStore.currentTeamId)
    return null
  return teamList.value.find(t => t.team_id === gameStore.currentTeamId)
})

const scriptOptions = [
  { id: 'script_001', name: '粮仓奇遇记', desc: '在王记粮仓寻找消失的钥匙' },
  { id: 'script_002', name: '古城大逃亡', desc: '限时 60 分钟的古城解谜' },
  { id: 'script_003', name: '消失的宝藏', desc: '沉浸式角色扮演任务' },
]

// =========================================================================
// 🟢 成员列表逻辑
// =========================================================================
const showMemberModal = ref(false)
const currentMemberList = ref([])
const currentViewingTeamName = ref('')

async function handleShowMembers(team) {
  if (!team.team_id)
    return
  uni.showLoading({ title: '加载成员...', mask: true })
  try {
    const res = await getTeamMembersAPI(team.team_id)
    if (res && res.members) {
      currentMemberList.value = res.members || []
      currentViewingTeamName.value = team.team_name
      showMemberModal.value = true
    }
    else {
      uni.showToast({ title: '暂无成员数据', icon: 'none' })
    }
  }
  catch (error) {
    console.error('❌ 请求异常:', error)
    uni.showToast({ title: '网络请求失败', icon: 'none' })
  }
  finally {
    uni.hideLoading()
  }
}

function closeMemberModal() {
  showMemberModal.value = false
  currentMemberList.value = []
}

function isGuide(name) {
  if (!name)
    return false
  return name.toLowerCase().includes('guide')
}

function copyId(id) {
  uni.setClipboardData({
    data: id,
    success: () => uni.showToast({ title: 'ID已复制', icon: 'none' }),
  })
}

// --- 辅助：添加日志 ---
function addEventLog(type, content, teamName = '未知队伍') {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
  const log = { id: Date.now() + Math.random(), type, time, content, teamName }
  eventLogs.value = [log, ...eventLogs.value].slice(0, 20)
}

// =========================================================================
// 🟢 Socket 监听逻辑 (含 ID 吸尘器)
// =========================================================================
function attachPageListeners(socket) {
  // 清理旧监听
  ['game:game_created', 'game_started', 'game:new_task', 'room_msg', 'task_finished', 'game:debug_player_state', 'game:cur_task', 'game:room_joined'].forEach(e => socket.off(e))

  // 1. 游戏创建
  socket.on('game:game_created', (data) => {
    try {
      uni.hideLoading()
    }
    catch (e) {}
    const targetTeam = teamList.value.find(t => t.team_id === data.team_id)
    if (targetTeam) {
      targetTeam.current_status = 1
      if (data.game_id) {
        targetTeam.game_id = data.game_id
        gameStore.gameId = data.game_id // 🔥 存
      }
      addEventLog('sys', `队伍准备就绪`, targetTeam.team_name)
    }
  })

  // 2. 游戏开始
  socket.on('game_started', (data) => {
    console.log('🚀 [Page] 收到游戏开始信号:', data)
    let targetTeam = teamList.value.find(t => t.team_id === data.team_id || t.game_id === data.game_id)
    if (!targetTeam && gameStore.currentTeamId) {
      targetTeam = teamList.value.find(t => t.team_id === gameStore.currentTeamId)
    }

    if (data.game_id)
      gameStore.gameId = data.game_id // 🔥 存

    if (targetTeam) {
      targetTeam.current_status = 2
      targetTeam.cur_task_id = data.cur_task_id || (data.cur_task ? data.cur_task.task_id : '')
      if (data.game_id)
        targetTeam.game_id = data.game_id
      addEventLog('sys', `游戏正式开始！`, targetTeam.team_name)
      teamList.value = [...teamList.value]
    }
    else {
      handleManualRefresh()
    }
  })

  // 3. 恢复进度 / 刷新
  socket.on('game:cur_task', (data) => {
    console.log('📡 [Page] 收到进度恢复信号:', data)
    let teamId = data.team_id || (data.player_state && data.player_state.team_id)
    if (!teamId && gameStore.currentTeamId)
      teamId = gameStore.currentTeamId

    // 🔥 ID 吸尘器
    const foundId = data.game_id || (data.player_state && data.player_state.game_id)
    if (foundId)
      gameStore.gameId = foundId

    if (teamId) {
      const targetTeam = teamList.value.find(t => t.team_id === teamId)
      if (targetTeam) {
        const playerState = data.player_state || {}
        const taskObj = playerState.cur_task || data.task || data.cur_task
        const activeTaskId = data.task_id || playerState.cur_task_id || (taskObj && taskObj.task_id)

        if (activeTaskId) {
          targetTeam.current_status = 2
          targetTeam.cur_task_id = activeTaskId
          if (taskObj) {
            targetTeam.current_task_name = taskObj.stage_name || taskObj.game_name || '未知任务'
            if (taskObj.task_complete_mechanisms)
              targetTeam.task_complete_mechanisms = taskObj.task_complete_mechanisms
          }
          if (playerState.cur_task)
            gameStore.updateGameState(playerState)
          else if (taskObj)
            gameStore.updateGameState({ team_id: teamId, cur_task: taskObj, cur_task_id: activeTaskId })

          teamList.value = [...teamList.value]
        }
      }
    }
  })

  // 4. 新任务
  socket.on('game:new_task', (data) => {
    console.log('📡 [Page] 收到新任务:', data)
    const incomingTeamId = data.team_id || (data.player_state && data.player_state.team_id)

    // 🔥 ID 吸尘器
    const foundId = data.game_id || (data.player_state && data.player_state.game_id) || (data.task && data.task.game_id)
    if (foundId)
      gameStore.gameId = foundId

    // 构造完全体对象
    let fullTaskObject = null
    if (data.task) {
      fullTaskObject = { ...data.task, task_complete_mechanisms: data.task_complete_mechanisms || data.task.task_complete_mechanisms || [] }
    }
    else if (data.player_state && data.player_state.cur_task) {
      fullTaskObject = { ...data.player_state.cur_task, task_complete_mechanisms: data.player_state.task_complete_mechanisms || data.player_state.cur_task.task_complete_mechanisms || [] }
    }

    // 重置状态
    if (incomingTeamId === gameStore.currentTeamId) {
      gameStore.isCurrentTaskComplete = false
      // 🟢 清理脏数据，防止穿越
      gameStore.selectedSubTaskId = null
      gameStore.curSubTaskId = null
    }

    if (data.player_state)
      gameStore.updateGameState(data.player_state)
    if (fullTaskObject) {
      gameStore.updateGameState({
        team_id: incomingTeamId,
        cur_task: fullTaskObject,
        cur_task_id: fullTaskObject.task_id,
      })
    }

    if (incomingTeamId) {
      const targetTeam = teamList.value.find(t => t.team_id === incomingTeamId)
      if (targetTeam) {
        targetTeam.current_status = 2
        targetTeam.just_finished = false
        if (fullTaskObject) {
          targetTeam.cur_task_id = fullTaskObject.task_id
          targetTeam.current_task_name = fullTaskObject.stage_name || fullTaskObject.game_name
        }
        teamList.value = [...teamList.value]
      }
      if (incomingTeamId === gameStore.currentTeamId) {
        uni.vibrateLong()
        uni.showModal({ title: '新任务到达', content: fullTaskObject?.stage_name || '任务已更新', showCancel: false, confirmText: '立刻处理' })
      }
    }
  })

  // 5. 任务完成
  socket.on('task_finished', (data) => {
    const team = teamList.value.find(t => t.team_id === data.team_id)
    if (team)
      addEventLog('task', `完成了任务`, team.team_name)

    // 🔥 如果是子任务完成，本地打勾
    if (data.sub_task_id && data.team_id === gameStore.currentTeamId) {
      gameStore.finishSubTask(data.sub_task_id)
    }
    // 如果是大任务完成
    if (!data.sub_task_id && data.team_id === gameStore.currentTeamId) {
      uni.showToast({ title: '当前大任务已完成', icon: 'success' })
      gameStore.isCurrentTaskComplete = true
    }
  })

  // 6. 其他消息
  socket.on('room_msg', (data) => {
    const team = teamList.value.find(t => t.team_id === data.team_id)
    const teamName = team ? team.team_name : '未知队伍'
    addEventLog('msg', `${data.sender_name}: ${data.content}`, teamName)
    if (gameStore.currentTeamId !== data.team_id) {
      unreadMsgMap.value[data.team_id] = (unreadMsgMap.value[data.team_id] || 0) + 1
      uni.vibrateShort()
    }
  })
  socket.on('game:debug_player_state', (data) => { /* 略，如有需要可补全 */ })
  socket.on('game:room_joined', (data) => { /* 略 */ })
}

watch(() => socketStore.socket, (newSocket) => {
  if (newSocket && newSocket.connected)
    attachPageListeners(newSocket)
}, { immediate: true })

onShow(async () => {
  socketStore.connect()
  fetchTeamList(true, true)
})

onUnmounted(() => {
  if (socketStore.socket) {
    ['game:game_created', 'game_started', 'game:new_task', 'room_msg', 'task_finished', 'game:debug_player_state', 'game:cur_task'].forEach(e => socketStore.socket.off(e))
  }
})

// =========================================================================
// 🟢 按钮配置计算 (新版 - 分离式)
// =========================================================================

// 获取【大任务】按钮配置
function getMainTaskConfig(task) {
  if (!task)
    return { text: '...', color: 'bg-gray-400', icon: '' }
  const mechanisms = task.task_complete_mechanisms || []
  const hasStaffConfirm = mechanisms.some(m => m.mechanism_name === 'STAFF_CONFIRM')
  if (hasStaffConfirm) {
    return { text: '确认整幕', color: 'bg-indigo-600 shadow-indigo-200', icon: '🏁' }
  }
  else {
    return { text: '强制结算', color: 'bg-gray-700 shadow-gray-400', icon: '⚡' }
  }
}

// 获取【子任务】按钮配置
function getSubTaskConfig(subTask) {
  if (!subTask)
    return { text: '...', color: 'bg-gray-400', icon: '' }
  const mechanisms = subTask.task_complete_mechanisms || subTask.task_complete_mechanism || []
  const hasStaffConfirm = mechanisms.some(m => m.mechanism_name === 'STAFF_CONFIRM')
  if (hasStaffConfirm) {
    return { text: '确认', color: 'bg-emerald-500 shadow-emerald-200', icon: '' }
  }
  else {
    return { text: '跳过', color: 'bg-orange-500 shadow-orange-200', icon: '' }
  }
}

// =========================================================================
// 🟢 交互逻辑 (新版)
// =========================================================================

// 🟢 手动同步任务状态
function handleGetTask(team) {
  if (!team.team_id)
    return
  socketStore.syncGameState(team.team_id, team.game_id) // 确保 socketStore 有这个 action
  uni.showToast({ title: '请求同步...', icon: 'none' })
}

// 🟢 [核心修复] 精确提交函数 (超强 ID 修复版)
function performSpecificSubmit(targetObj, isSubTask) {
  console.log(`🚀 [精确提交] 目标: ${isSubTask ? '子任务' : '主任务'}`, targetObj)

  // 🛠️ 1. 终极救命补丁：穷尽一切手段找回 GameID
  if (!gameStore.gameId) {
    console.warn('⚠️ [UI] Store中缺失 GameID，开始搜寻...')
    if (targetObj && targetObj.game_id) {
      gameStore.gameId = targetObj.game_id
    }
    else {
      const currentTeam = teamList.value.find(t => t.team_id === gameStore.currentTeamId)
      if (currentTeam && currentTeam.game_id)
        gameStore.gameId = currentTeam.game_id
    }
  }

  // 🚑 最终检查
  if (!gameStore.gameId) {
    console.error('❌ [UI] 无法找到 GameID，操作终止')
    uni.showModal({ title: '数据丢失', content: '无法获取当前游戏ID。请尝试刷新页面。', showCancel: false })
    return
  }

  // 2. 获取机制
  const mechanisms = targetObj.task_complete_mechanisms || targetObj.task_complete_mechanism || []
  const payloadExtra = isSubTask ? { sub_task_id: targetObj.sub_task_id } : {}

  // 3. 策略
  const hasStaffConfirm = mechanisms.some(m => m.mechanism_name === 'STAFF_CONFIRM')
  if (hasStaffConfirm) {
    socketStore.submitTask(payloadExtra, 'STAFF_CONFIRM')
    return
  }

  // 伪造数据
  const firstMech = mechanisms[0]
  if (firstMech) {
    const mechName = firstMech.mechanism_name
    const fakeData = { ...payloadExtra }
    if (mechName === 'GPS_CHECK')
      Object.assign(fakeData, { user_location_coordinate: [0, 0] })
    else if (mechName === 'AI_NPC_DIALOGUE_COMPLETE')
      Object.assign(fakeData, { task_completed: true })
    else if (mechName === 'AI_ANSWER_CORRECT')
      Object.assign(fakeData, { answer: 'FORCE_PASS' })
    socketStore.submitTask(fakeData, mechName)
  }
  else {
    socketStore.submitTask({ ...payloadExtra, user_location_coordinate: [0, 0] }, 'GPS_CHECK')
  }
}

// 🟢 点击处理
function handleSpecificAction(targetObj, isSubTask) {
  const teamId = gameStore.currentTeamId
  if (!teamId)
    return

  const name = isSubTask ? (targetObj.game_name || targetObj.sub_task_name) : (targetObj.stage_name || '本幕')
  const config = isSubTask ? getSubTaskConfig(targetObj) : getMainTaskConfig(targetObj)
  const title = isSubTask ? `确认子任务` : `⚠️ 结算大任务`
  const content = isSubTask ? `是否确认完成子任务《${name}》？` : `⚠️ 注意：这将直接结束当前整幕《${name}》并进入下一关。`

  uni.showModal({
    title,
    content,
    confirmText: config.text,
    confirmColor: isSubTask ? '#10B981' : '#4F46E5',
    success: (res) => {
      if (res.confirm)
        performSpecificSubmit(targetObj, isSubTask)
    },
  })
}

// 辅助功能
function isJoined(teamId) {
  return gameStore.currentTeamId === teamId
}
function handleJoinRoom(team) {
  uni.showLoading({ title: '连接中...', mask: true })
  socketStore.joinRoom(team.team_id)
  unreadMsgMap.value[team.team_id] = 0
  setTimeout(() => uni.hideLoading(), 1000)
}
function handleAssignScript(team) {
  uni.showActionSheet({
    itemList: scriptOptions.map(s => s.name),
    success: async (res) => {
      socketStore.selectScript(team.team_id, scriptOptions[res.tapIndex].id)
      uni.showLoading({ title: 'AI剧本生成中...', mask: true })
    },
  })
}
function handleStartGame(team) {
  const liveTeam = teamList.value.find(t => t.team_id === team.team_id) || team
  const targetGameId = liveTeam.game_id || (gameStore.currentTeamId === liveTeam.team_id ? gameStore.gameId : null)
  if (!targetGameId)
    return uni.showToast({ title: '需重新分配剧本', icon: 'none' })

  uni.showModal({
    title: '准备开局',
    content: `开始《${liveTeam.team_name}》？`,
    confirmText: '开始',
    confirmColor: '#10B981',
    success: async (res) => {
      if (res.confirm) {
        liveTeam.current_status = 2
        teamList.value = [...teamList.value]
        socketStore.startGame(targetGameId)
      }
    },
  })
}

function handleManualRefresh() {
  isRefreshing.value = true
  fetchTeamList(true, false).then(() => {
    // 🔥 [手动刷新] 尝试找回 ID
    if (gameStore.currentTeamId) {
      const team = teamList.value.find(t => t.team_id === gameStore.currentTeamId)
      if (team && team.game_id)
        gameStore.gameId = team.game_id
    }
  }).finally(() => {
    setTimeout(() => {
      isRefreshing.value = false
    }, 500)
    uni.showToast({ title: '已刷新', icon: 'none' })
  })
}
function handleOpenConsole(team) { /* 原有逻辑 */ }

async function fetchTeamList(reset = false, silent = false) {
  if (reset)
    page.value = 1
  if (!silent && reset) {
    teamList.value = []
    isLoading.value = true
  }
  try {
    const res = await getTeamListAPI({ page: page.value, size: pageSize.value })
    const items = res.data?.items || res.items || []
    total.value = res.data?.total || res.total || 0
    teamList.value = reset ? items : [...teamList.value, ...items]
  }
  catch (error) { console.error(error) }
  finally {
    isLoading.value = false
    uni.stopPullDownRefresh()
  }
}
onPullDownRefresh(() => fetchTeamList(true))
onReachBottom(() => {
  if (teamList.value.length < total.value) {
    page.value++
    fetchTeamList()
  }
})
</script>

<template>
  <view class="min-h-screen bg-gray-100 pb-24 font-sans text-gray-800">
    <view class="pt-12 px-4 pb-2 flex flex-col bg-white sticky top-0 z-50 shadow-sm">
      <view class="flex justify-between items-center mb-2 h-10">
        <view class="flex items-end gap-2 overflow-hidden">
          <view v-if="currentActiveTeam" class="flex flex-col justify-end animate-slide-up">
            <text class="text-[10px] text-gray-400 font-bold uppercase leading-none mb-0.5">
              Current Room
            </text>
            <view class="flex items-center gap-2">
              <text class="text-xl font-black text-indigo-900 tracking-tight truncate max-w-[180px]">
                {{ currentActiveTeam.team_name }}
              </text>
              <view class="bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                {{ currentActiveTeam.binding_code }}
              </view>
            </view>
          </view>
          <view v-else class="flex items-end gap-2">
            <text class="text-xl font-black text-gray-900 tracking-tight">
              Guide
            </text>
          </view>
          <view class="flex items-center gap-1 bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-bold mb-1 ml-1">
            <view v-if="socketStore.isConnected" class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <view v-else class="w-1.5 h-1.5 rounded-full bg-red-500" />
            {{ socketStore.isConnected ? 'LIVE' : 'OFF' }}
          </view>
        </view>
        <button class="bg-white border border-gray-200 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 flex-shrink-0" @click="handleManualRefresh">
          <text :class="isRefreshing ? 'animate-spin' : ''">
            🔄
          </text> 刷新
        </button>
      </view>
    </view>

    <view class="p-4 space-y-4">
      <view class="flex justify-between items-center mb-2">
        <text class="text-sm text-gray-500 font-bold ml-1">
          当前队伍列表
        </text>
      </view>

      <view class="space-y-5">
        <view v-for="team in teamList" :key="team.team_id" class="bg-white rounded-[24px] shadow-xl overflow-hidden border border-gray-50 animate-slide-up transition-all duration-300" :class="{ 'ring-2 ring-green-400 ring-offset-2': team.just_finished }">
          <view class="p-5 flex justify-between items-center bg-gradient-to-br from-white to-gray-50 relative">
            <view v-if="unreadMsgMap[team.team_id] > 0" class="absolute top-0 right-0 transform translate-x-[-5px] translate-y-[-5px] z-20">
              <view class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md animate-bounce border-2 border-white">
                {{ unreadMsgMap[team.team_id] > 99 ? '99+' : unreadMsgMap[team.team_id] }}
              </view>
            </view>
            <view class="flex flex-col gap-1 pr-4 overflow-hidden flex-1">
              <text class="text-xl font-black text-gray-900 tracking-tight truncate leading-tight">
                {{ team.team_name || '未命名队伍' }}
              </text>
              <view class="flex items-center gap-1">
                <view class="w-1.5 h-1.5 rounded-full" :class="{ 'bg-gray-400': team.current_status === 0, 'bg-blue-500': team.current_status === 1, 'bg-green-500 animate-pulse': team.current_status === 2, 'bg-red-400': team.current_status === 3 }" />
                <text v-if="team.current_status === 0" class="text-[10px] text-gray-400 font-bold">
                  组建中
                </text>
                <text v-else-if="team.current_status === 1" class="text-[10px] text-blue-500 font-bold">
                  已就绪
                </text>
                <text v-else-if="team.current_status === 2" class="text-[10px] text-green-600 font-bold">
                  进行中
                </text>
                <text v-else-if="team.current_status === 3" class="text-[10px] text-red-400 font-bold">
                  已结束
                </text>
              </view>
            </view>
            <view class="bg-indigo-600 px-3 py-2 rounded-xl text-center shadow-md flex-shrink-0 active:scale-95 transition-transform" @click.stop="handleOpenConsole(team)">
              <text class="block text-[8px] text-white/70 font-bold mb-0.5 tracking-wider">
                CODE
              </text>
              <text class="text-xl font-black text-white font-mono leading-none">
                {{ team.binding_code }}
              </text>
            </view>
          </view>

          <view v-if="unreadMsgMap[team.team_id] > 0 && !isJoined(team.team_id)" class="px-5 py-2 bg-blue-50/50 border-t border-blue-100 flex items-center gap-2">
            <text class="text-xs text-blue-600 font-bold">
              🔔 有新消息，请进入房间查看
            </text>
          </view>

          <view class="px-5 py-4 border-t border-gray-50 flex justify-between items-center">
            <view class="flex -space-x-2">
              <view class="w-20 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs">
                小队人数：
              </view>
            </view>
            <view class="flex items-center gap-1 active:opacity-60 transition-opacity" @click.stop="handleShowMembers(team)">
              <text class="text-lg font-black text-indigo-600 underline decoration-dashed underline-offset-4 decoration-indigo-200">
                {{ gameStore.roomStates[team.team_id]?.memberCount || team.size }}
                <text class="text-xs text-gray-400 font-normal no-underline">
                  / 5
                </text>
              </text>
              <text class="text-xs text-gray-400">
                >
              </text>
            </view>
          </view>

          <view class="px-5 py-4 bg-gray-50/50 flex gap-3">
            <button v-if="!isJoined(team.team_id)" class="flex-1 bg-white border border-indigo-200 text-indigo-600 rounded-xl py-3 text-sm font-bold shadow-sm active:scale-95 transition-transform" @click="handleJoinRoom(team)">
              进入房间
            </button>

            <template v-else>
              <template v-if="team.current_status === 0 || team.current_status === 1">
                <view class="flex items-center justify-center w-full px-6 py-4">
                  <view class="flex w-full max-w-md gap-5 transition-all duration-300">
                    <button
                      class="flex-1 relative overflow-hidden rounded-full py-3 text-sm font-bold text-white shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 border-0"
                      :class="[
                        team.current_status === 1
                          ? 'bg-gradient-to-r from-slate-500 to-slate-600 shadow-slate-500/30' // 次要状态颜色变暗一点
                          : 'bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-indigo-500/40',
                      ]"
                      @click="handleAssignScript(team)"
                    >
                      <text>{{ team.current_status === 1 ? '分配剧本' : '分配剧本' }}</text>
                    </button>

                    <button
                      v-if="team.current_status === 1"
                      class="flex-1 relative overflow-hidden bg-gradient-to-r from-emerald-400 to-emerald-600 text-white rounded-full py-3 text-sm font-bold shadow-lg shadow-emerald-500/40 active:scale-95 transition-all flex items-center justify-center gap-2 border-0"
                      @click="handleStartGame(team)"
                    >
                      <text>开始游戏</text>
                    </button>
                  </view>
                </view>
              </template>

              <template v-else-if="team.current_status === 2">
                <view class="w-full flex flex-col gap-3">
                  <view v-if="isJoined(team.team_id) && gameStore.currentTask" class="bg-white rounded-xl p-4 border border-indigo-100 shadow-sm relative overflow-hidden">
                    <view class="relative z-10 mb-3 border-b border-gray-100 pb-2">
                      <text class="text-[10px] text-indigo-400 font-bold uppercase block mb-1">
                        CURRENT STAGE
                      </text>
                      <text class="text-lg font-black text-gray-900 leading-tight block">
                        {{ team.current_task_name || gameStore.currentTask?.stage_name || '任务同步中...' }}
                      </text>
                    </view>
                    <view class="flex items-center justify-between gap-3">
                      <view class="text-xs text-gray-400 leading-relaxed flex-1">
                        <text v-if="gameStore.currentTask?.having_sub_tasks">
                          包含 {{ gameStore.currentTask.sub_tasks?.length || 0 }} 个子任务。<text v-if="!gameStore.isCurrentTaskComplete" class="text-orange-500 block mt-1">
                            *可强制结算本幕
                          </text>
                        </text>
                        <text v-else>
                          当前为单一大任务
                        </text>
                      </view>
                      <button class="px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 text-white flex items-center gap-1" :class="getMainTaskConfig(gameStore.currentTask).color" @click="handleSpecificAction(gameStore.currentTask, false)">
                        <text>{{ getMainTaskConfig(gameStore.currentTask).icon }}</text>
                        <text>{{ getMainTaskConfig(gameStore.currentTask).text }}</text>
                      </button>
                    </view>
                    <text class="absolute right-[-10px] top-[-10px] text-8xl opacity-5">
                      🏁
                    </text>
                  </view>

                  <view v-if="gameStore.currentTask?.having_sub_tasks && gameStore.currentTask?.sub_tasks" class="flex flex-col gap-2">
                    <view class="flex items-center justify-between px-1">
                      <text class="text-xs font-bold text-gray-500">
                        子任务列表
                      </text>
                    </view>
                    <view v-for="(sub, index) in gameStore.currentTask.sub_tasks" :key="sub.sub_task_id" class="bg-white border border-gray-100 rounded-lg p-3 flex items-center justify-between shadow-sm" :class="{ 'opacity-60 bg-gray-50': sub.is_finished }">
                      <view class="flex flex-col gap-0.5 flex-1 pr-2">
                        <view class="flex items-center gap-2">
                          <text class="text-xs font-mono text-gray-400 bg-gray-100 px-1 rounded">
                            #{{ index + 1 }}
                          </text>
                          <text class="text-sm font-bold truncate" :class="sub.is_finished ? 'text-gray-400 line-through' : 'text-gray-800'">
                            {{ sub.game_name || sub.sub_task_name || '未命名' }}
                          </text>
                        </view>
                        <text class="text-[10px] text-gray-400 truncate">
                          📍 {{ sub.target_location_name || '未知地点' }}
                        </text>
                      </view>
                      <view>
                        <button v-if="!sub.is_finished" class="px-3 py-1.5 rounded-md text-[10px] font-bold shadow-sm active:scale-95 text-white flex items-center gap-1 min-w-[70px] justify-center" :class="getSubTaskConfig(sub).color" @click="handleSpecificAction(sub, true)">
                          <text>{{ getSubTaskConfig(sub).icon }}</text>
                          <text>{{ getSubTaskConfig(sub).text }}</text>
                        </button>
                        <view v-else class="flex items-center gap-1 px-2 py-1">
                          <text class="text-green-500 font-bold text-xs">
                            ✓ 已完成
                          </text>
                        </view>
                      </view>
                    </view>
                  </view>
                </view>
              </template>

              <button v-else-if="team.current_status === 3" class="flex-1 bg-gray-200 text-gray-500 rounded-xl py-3 text-sm font-bold" disabled>
                已结束
              </button>
            </template>
          </view>
        </view>
      </view>
    </view>

    <view v-if="showMemberModal" class="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6 animate-fade-in" @click="closeMemberModal">
      <view class="w-full bg-white rounded-2xl overflow-hidden shadow-2xl animate-scale-up" @click.stop>
        <view class="bg-indigo-600 p-4 flex justify-between items-center">
          <view>
            <text class="text-white/80 text-xs font-bold uppercase block">
              Team Members
            </text>
            <text class="text-white text-lg font-black">
              {{ currentViewingTeamName }}
            </text>
          </view>
          <view class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white" @click="closeMemberModal">
            ✕
          </view>
        </view>
        <scroll-view scroll-y class="max-h-[60vh] bg-gray-50/50">
          <view v-if="currentMemberList.length === 0" class="py-12 flex flex-col items-center justify-center text-gray-400">
            <text class="text-4xl mb-2">
              😶‍🌫️
            </text>
            <text class="text-xs">
              暂无成员信息
            </text>
          </view>
          <view class="p-4 space-y-3">
            <view v-for="(member, index) in currentMemberList" :key="member.user_id" class="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between shadow-sm active:scale-[0.99] transition-transform">
              <view class="flex items-center gap-3">
                <view class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-white shadow-sm" :class="isGuide(member.username) ? 'bg-indigo-100 text-indigo-600' : 'bg-orange-100 text-orange-600'">
                  {{ member.username.charAt(0).toUpperCase() }}
                </view>
                <view class="flex flex-col">
                  <view class="flex items-center gap-2">
                    <text class="text-gray-900 font-bold text-sm">
                      {{ member.username || '匿名用户' }}
                    </text>
                    <view v-if="member.game_role || isGuide(member.username)" class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider leading-none" :class="isGuide(member.username) ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'">
                      {{ member.game_role || 'GUIDE' }}
                    </view>
                  </view>
                  <view class="flex items-center gap-1 mt-0.5" @click="copyId(member.user_id)">
                    <text class="text-[10px] text-gray-400 font-mono">
                      ID: ...{{ member.user_id.slice(-6) }}
                    </text>
                    <text class="text-[9px] text-gray-300">
                      📋
                    </text>
                  </view>
                </view>
              </view>
              <view class="flex flex-col items-end gap-1">
                <view class="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                  <view class="w-2 h-2 rounded-full" :class="member.status === 1 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'" />
                  <text class="text-[10px] font-bold" :class="member.status === 1 ? 'text-emerald-600' : 'text-gray-400'">
                    {{ member.status === 1 ? '在线' : '离线' }}
                  </text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    <CustomTabBar :current="0" />
  </view>
</template>

<style scoped>
/* 保持你原有的样式不变 */
button::after {
  border: none;
}
button:active {
  transform: scale(0.97);
}
.mini-btn {
  padding: 0 12px;
  height: 28px;
  line-height: 28px;
  font-size: 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
.animate-spin {
  animation: spin 0.5s linear infinite;
  display: inline-block;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
.animate-slide-up {
  animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}
@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.animate-bounce {
  animation: bounce 0.5s infinite;
}
@keyframes bounce {
  0%,
  100% {
    transform: translateY(-10px);
  }
  50% {
    transform: translateY(-5px);
  }
}
</style>
