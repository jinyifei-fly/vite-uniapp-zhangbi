<script setup>
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { getTeamListAPI } from '@/api/team'
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

// 🟢 [新增] 计算当前选中的队伍 (用于顶部标题)
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

// --- 辅助：添加日志 ---
function addEventLog(type, content, teamName = '未知队伍') {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' })
  const log = {
    id: Date.now() + Math.random(),
    type,
    time,
    content,
    teamName,
  }
  eventLogs.value = [log, ...eventLogs.value].slice(0, 20)
}

// 🟢 [新增] 智能获取当前操作目标 (主任务 or 子任务)
function getCurrentTarget() {
  const task = gameStore.currentTask
  if (!task)
    return null

  // A. 如果是单层任务，直接返回主任务
  if (!task.having_sub_tasks) {
    return {
      targetObj: task,
      isSubTask: false,
      id: task.task_id,
      name: task.stage_name || task.game_name,
    }
  }

  // B. 如果有子任务，必须找到“当前正在进行”的那一个
  const currentSubId = gameStore.curSubTaskId || task.sub_tasks?.find(s => !s.is_finished)?.sub_task_id

  if (currentSubId && task.sub_tasks) {
    const subTask = task.sub_tasks.find(s => s.sub_task_id === currentSubId)
    if (subTask) {
      return {
        targetObj: subTask,
        isSubTask: true,
        id: subTask.sub_task_id,
        name: subTask.sub_task_name || '子任务',
      }
    }
  }

  // C. 兜底：如果找不到子任务，还是返回主任务 (虽然这可能导致逻辑错误，但在过渡期能防崩)
  return {
    targetObj: task,
    isSubTask: false,
    id: task.task_id,
    name: task.stage_name,
  }
}

function attachPageListeners(socket) {
  // 清理旧监听
  socket.off('game:game_created')
  socket.off('game_started')
  socket.off('game:new_task')
  socket.off('room_msg')
  socket.off('task_finished')
  socket.off('game:debug_player_state')
  socket.off('game:cur_task')
  socket.off('game:room_joined')

  // 1. 游戏创建
  socket.on('game:game_created', (data) => {
    try {
      uni.hideLoading()
    }
    catch (e) {}
    const targetTeam = teamList.value.find(t => t.team_id === data.team_id)
    if (targetTeam) {
      targetTeam.current_status = 1
      targetTeam.game_id = data.game_id
      addEventLog('sys', `队伍准备就绪`, targetTeam.team_name)
    }
  })

  // 🟢 2. 游戏开始 (核心修复：强制更新列表状态)
  socket.on('game_started', (data) => {
    console.log('🚀 [Page] 收到游戏开始信号:', data)

    // 尝试通过 team_id 或 game_id 找到队伍
    let targetTeam = teamList.value.find(t => t.team_id === data.team_id || t.game_id === data.game_id)

    // 兜底：如果是当前进入的房间
    if (!targetTeam && gameStore.currentTeamId) {
      targetTeam = teamList.value.find(t => t.team_id === gameStore.currentTeamId)
    }

    if (targetTeam) {
      targetTeam.cur_task_id = data.cur_task_id || (data.cur_task ? data.cur_task.task_id : '')

      addEventLog('sys', `游戏正式开始！`, targetTeam.team_name)

      teamList.value = [...teamList.value]
    }
    else {
      handleManualRefresh()
    }
  })

  // 🟢 [核心修复] 重新进房/刷新时，恢复游戏进度
  socket.on('game:cur_task', (data) => {
    console.log('📡 [Page] 收到进度恢复信号(cur_task):', data)

    // 1. 找 Team ID
    // 日志显示顶层没有 team_id，所以必须用 gameStore.currentTeamId 兜底
    let teamId = data.team_id || (data.player_state && data.player_state.team_id)
    if (!teamId && gameStore.currentTeamId) {
      teamId = gameStore.currentTeamId
    }

    if (teamId) {
      const targetTeam = teamList.value.find(t => t.team_id === teamId)
      if (targetTeam) {
        // 2. 提取任务核心数据
        // 优先看 player_state 里的 cur_task (你的日志里这里最全)
        const playerState = data.player_state || {}
        const taskObj = playerState.cur_task || data.task || data.cur_task

        // 3. 判断是否正在游戏
        // 只要有 task_id，就说明游戏正在进行
        const activeTaskId = data.task_id || playerState.cur_task_id || (taskObj && taskObj.task_id)

        if (activeTaskId) {
          console.log(`✅ 恢复游戏状态: ${activeTaskId}`)

          // 🔥 强制把状态改成 2 (进行中)，这样"开始游戏"按钮就会消失，变成"提交任务"
          targetTeam.current_status = 2
          targetTeam.cur_task_id = activeTaskId

          // 4. 获取展示名称 (stage_name)
          // 你的日志里: player_state.cur_task.stage_name = "第二幕..."
          if (taskObj) {
            targetTeam.current_task_name = taskObj.stage_name || taskObj.game_name || '未知任务'

            // 顺便把机制也存进去，防止按钮颜色不对
            // 注意：日志里 mechanisms 可能在 taskObj 里，也可能在 player_state.completed_mechanisms (这个通常是已完成的)
            // 这里我们要找 **完成当前任务** 需要的机制
            if (taskObj.task_complete_mechanisms) {
              targetTeam.task_complete_mechanisms = taskObj.task_complete_mechanisms
            }
          }

          // 5. 顺手更新一下 Store，保证详情页数据也对
          if (playerState.cur_task) {
            gameStore.updateGameState(playerState)
          }
          else if (taskObj) {
            // 构造一个最小集更新 store
            gameStore.updateGameState({
              team_id: teamId,
              cur_task: taskObj,
              cur_task_id: activeTaskId,
            })
          }

          // 6. 强制刷新列表 UI
          teamList.value = [...teamList.value]
        }
      }
    }
  })

  // 🟢进房成功瞬间，如果带有游戏信息，也更新
  socket.on('game:room_joined', (data) => {
    // 如果后端在 joined 消息里带了 game_status 或 game_id
    if (data.team_id) {
      const targetTeam = teamList.value.find(t => t.team_id === data.team_id)
      if (targetTeam) {
        if (data.game_id || gameStore.teamGameMap[data.team_id]) {
          teamList.value = [...teamList.value]
        }
      }
    }
  })

  // 5. 新任务
  socket.on('game:new_task', (data) => {
    console.log('📡 [Page] 收到新任务 (原始数据):', data)

    // 1. 解析队伍 ID
    // 优先从外层取，取不到再去 player_state 里取
    const incomingTeamId = data.team_id || (data.player_state && data.player_state.team_id)

    // 2.构造“完全体”任务对象
    let fullTaskObject = null

    if (data.task) {
      fullTaskObject = {
        ...data.task,
        task_complete_mechanisms: data.task_complete_mechanisms || data.task.task_complete_mechanisms || [],
      }
    }
    else if (data.player_state && data.player_state.cur_task) {
      // 兼容 player_state 结构
      fullTaskObject = {
        ...data.player_state.cur_task,
        task_complete_mechanisms: data.player_state.task_complete_mechanisms || data.player_state.cur_task.task_complete_mechanisms || [],
      }
    }

    // 3. 🟢 [关键修复] 强制重置 Store 状态
    if (incomingTeamId === gameStore.currentTeamId) {
      gameStore.isCurrentTaskComplete = false
    }

    // 4. 更新 Store
    if (data.player_state) {
      // 如果有全量状态，更新全量
      gameStore.updateGameState(data.player_state)
    }

    // 即使更新了全量，我们也要单独确保 task 对象里有 mechanisms
    if (fullTaskObject) {
      gameStore.updateGameState({
        team_id: incomingTeamId,
        cur_task: fullTaskObject, // 👈 传入我们拼接好的对象
        cur_task_id: fullTaskObject.task_id,
      })
    }

    // 5. 更新当前列表项的 UI 显示 (任务名等)
    if (incomingTeamId) {
      const targetTeam = teamList.value.find(t => t.team_id === incomingTeamId)
      if (targetTeam) {
        targetTeam.current_status = 2 // 确保是进行中
        targetTeam.just_finished = false // 移除完成特效

        if (fullTaskObject) {
          targetTeam.cur_task_id = fullTaskObject.task_id
          targetTeam.current_task_name = fullTaskObject.stage_name || fullTaskObject.game_name
        }
        // 触发列表刷新
        teamList.value = [...teamList.value]
      }

      // 弹窗提示 (仅限当前正在看的队伍)
      if (incomingTeamId === gameStore.currentTeamId) {
        uni.vibrateLong()
        uni.showModal({
          title: '新任务到达',
          content: fullTaskObject?.stage_name || '任务已更新',
          showCancel: false,
          confirmText: '立刻处理',
        })
      }
    }
  })

  // 4. Debug 状态同步
  socket.on('game:debug_player_state', (data) => {
    const rawData = data.player_state || data
    const gameId = rawData.game_id || data.game_id
    if (gameId) {
      const targetTeam = teamList.value.find(t => t.game_id === gameId)
      if (targetTeam) {
        // 同步状态和任务ID
        const newTaskId = rawData.cur_task_id || rawData.task_id
        if (newTaskId)
          targetTeam.cur_task_id = newTaskId

        // 如果后端说已经开始了，防止前端还是 1
        if (targetTeam.current_status === 1 && newTaskId) {
          targetTeam.current_status = 2
        }

        teamList.value = [...teamList.value]
      }
    }
  })

  // 5. 消息
  socket.on('room_msg', (data) => {
    const team = teamList.value.find(t => t.team_id === data.team_id)
    const teamName = team ? team.team_name : '未知队伍'
    addEventLog('msg', `${data.sender_name}: ${data.content}`, teamName)
    if (gameStore.currentTeamId !== data.team_id) {
      unreadMsgMap.value[data.team_id] = (unreadMsgMap.value[data.team_id] || 0) + 1
      uni.vibrateShort()
    }
  })

  // 6. 任务完成
  socket.on('task_finished', (data) => {
    const team = teamList.value.find(t => t.team_id === data.team_id)
    const teamName = team ? team.team_name : '未知队伍'
    addEventLog('task', `完成了任务！`, teamName)
    if (team) {
      team.just_finished = true
      setTimeout(() => {
        team.just_finished = false
      }, 3000)
    }
    if (gameStore.currentTeamId === data.team_id) {
      uni.showToast({ title: '当前队伍任务已完成', icon: 'success' })
    }
    else {
      uni.showToast({ title: `${teamName} 完成了任务`, icon: 'none' })
    }
  })
}

// 监听 socket 连接
watch(() => socketStore.socket, (newSocket) => {
  if (newSocket && newSocket.connected) {
    attachPageListeners(newSocket)
  }
}, { immediate: true })

onShow(async () => {
  socketStore.connect()
  fetchTeamList(true, true)
})

onUnmounted(() => {
  if (socketStore.socket) {
    socketStore.socket.off('game:game_created')
    socketStore.socket.off('game_started')
    socketStore.socket.off('game:new_task')
    socketStore.socket.off('room_msg')
    socketStore.socket.off('task_finished')
    socketStore.socket.off('game:debug_player_state')
  }
})

// 🟢 计算按钮配置
const actionButtonConfig = computed(() => {
  const target = getCurrentTarget()

  // 1. 数据未加载
  if (!target) {
    return { text: '加载中...', color: 'bg-gray-400', icon: '⏳', isForce: false }
  }

  const { targetObj, isSubTask } = target

  // 2. 获取机制列表
  const mechanisms = targetObj.task_complete_mechanisms || targetObj.task_complete_mechanism || []

  // 3. 判断是否需要 STAFF_CONFIRM
  const hasStaffConfirm = mechanisms.some(m => m.mechanism_name === 'STAFF_CONFIRM')

  // 4. 构造显示文案
  const suffix = isSubTask ? '(子任务)' : ''

  if (hasStaffConfirm) {
    return {
      text: `确认通过 ${suffix}`,
      color: 'bg-emerald-500 shadow-emerald-200',
      icon: '✅',
      isForce: false,
    }
  }
  else {
    return {
      text: `强制跳过 ${suffix}`,
      color: 'bg-orange-500 shadow-orange-200',
      icon: '⚡',
      isForce: true,
    }
  }
})
// 🟢智能操作处理
function handleSmartAction(team) {
  if (!isJoined(team.team_id)) {
    uni.showToast({ title: '正在连接...', icon: 'none' })
    socketStore.joinRoom(team.team_id)
    return
  }

  const config = actionButtonConfig.value
  const taskName = gameStore.currentTask?.game_name || gameStore.currentTask?.stage_name || '当前任务'

  const title = config.isForce ? '⚠️ 强制跳过' : '✅ 确认通过'
  const content = config.isForce
    ? `当前任务《${taskName}》没有人工确认环节。\n\n是否要伪造数据强制跳过？`
    : `队伍请求完成任务《${taskName}》。\n\n确认他们已达标并放行吗？`
  const confirmColor = config.isForce ? '#F59E0B' : '#10B981'

  uni.showModal({
    title,
    content,
    confirmText: config.isForce ? '强制跳过' : '确认通过',
    confirmColor,
    success: (res) => {
      // 👇 加这一行调试日志
      console.log('👆 弹窗结果:', res)

      if (res.confirm) {
        console.log('✅ 用户点击了确认，准备调用 performSmartSubmit')
        performSmartSubmit()
      }
    },
  })
}

// 🟢 [核心修复] 智能提交
function performSmartSubmit() {
  const target = getCurrentTarget()

  // 1. 安全拦截
  if (!target) {
    console.warn('⚠️ 无任务信息，盲发 GPS')
    socketStore.submitTask(null, 'GPS_CHECK', true)
    return
  }

  const { targetObj, isSubTask, id, name } = target

  console.log(`🎯 [智能提交] 锁定目标: ${isSubTask ? '子任务' : '主任务'} - ${name} (${id})`)

  // ⚠️ 关键步骤：如果是子任务，必须更新 Store 里的 selectedSubTaskId
  // 因为 socketStore.submitTask 默认是去读 store.selectedSubTaskId 的
  if (isSubTask) {
    gameStore.selectedSubTaskId = id
  }

  // 2. 获取机制
  const mechanisms = targetObj.task_complete_mechanisms || targetObj.task_complete_mechanism || []
  console.log('🧐 当前机制:', mechanisms.map(m => m.mechanism_name))

  // 3. 策略 A：正规确认
  if (mechanisms.some(m => m.mechanism_name === 'STAFF_CONFIRM')) {
    console.log('🚀 发送 STAFF_CONFIRM')
    // 第三个参数 false 表示这不是“主任务大结局”，而是过程中的一步
    socketStore.submitTask(null, 'STAFF_CONFIRM', !isSubTask)
    return
  }

  // 4. 策略 B：伪造数据 (强制跳过)
  const firstMech = mechanisms[0]
  if (firstMech) {
    const mechName = firstMech.mechanism_name
    console.log(`⚡ 伪造数据: ${mechName}`)

    let fakeData = {}
    if (mechName === 'GPS_CHECK')
      fakeData = { user_location_coordinate: [0, 0] }
    else if (mechName === 'AI_NPC_DIALOGUE_COMPLETE')
      fakeData = { task_completed: true }
    else if (mechName === 'AI_ANSWER_CORRECT')
      fakeData = { answer: 'FORCE_PASS' }

    socketStore.submitTask(fakeData, mechName, !isSubTask)
  }
  else {
    // 5. 策略 C：兜底
    socketStore.submitTask({ user_location_coordinate: [0, 0] }, 'GPS_CHECK', !isSubTask)
  }
}
// 辅助函数
function handleOpenConsole(team) {
  // 这里可以放那个详情弹窗逻辑，暂时先用原来的 console.log 或者 modal
  unreadMsgMap.value[team.team_id] = 0
  if (!isJoined(team.team_id)) {
    uni.showToast({ title: '请先进入房间', icon: 'none' })
  }
  // 打开详情逻辑...
}

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
        uni.showLoading({ title: '启动中...' })

        // 🚀 乐观更新：不等 Socket 回调，直接把 UI 变成“进行中”
        // 这样点击后立马就能看到绿色大按钮，体验更好
        liveTeam.current_status = 2
        teamList.value = [...teamList.value]

        socketStore.startGame(targetGameId)
        setTimeout(() => uni.hideLoading(), 1000)
      }
    },
  })
}

function handleGetTask(team) {
  // TODO
  console.log('')
  uni.showLoading({ title: '同步状态中...', mask: true })
}

function handleManualRefresh() {
  isRefreshing.value = true
  fetchTeamList(true, false).finally(() => {
    setTimeout(() => {
      isRefreshing.value = false
    }, 500)
    uni.showToast({ title: '已刷新', icon: 'none' })
  })
  if (gameStore.gameId) {
    socketStore.socket.emit('game:debug_get_player_state', {
      game_id: gameStore.gameId,
      timestamp: new Date().toISOString(),
    })
  }
  uni.showToast({ title: '正在刷新数据...', icon: 'none' })
}

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

onPullDownRefresh(() => {
  fetchTeamList(true)
})
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
              Merchant OS
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
        <view
          v-for="team in teamList"
          :key="team.team_id"
          class="bg-white rounded-[24px] shadow-xl overflow-hidden border border-gray-50 animate-slide-up transition-all duration-300"
          :class="{ 'ring-2 ring-green-400 ring-offset-2': team.just_finished }"
        >
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
                <view
                  class="w-1.5 h-1.5 rounded-full"
                  :class="{
                    'bg-gray-400': team.current_status === 0,
                    'bg-blue-500': team.current_status === 1,
                    'bg-green-500 animate-pulse': team.current_status === 2,
                    'bg-red-400': team.current_status === 3,
                  }"
                />
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

            <view
              class="bg-indigo-600 px-3 py-2 rounded-xl text-center shadow-md flex-shrink-0 active:scale-95 transition-transform"
              @click.stop="handleOpenConsole(team)"
            >
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
            <text class="text-lg font-black text-indigo-600">
              {{ gameStore.roomStates[team.team_id]?.memberCount || team.size }} <text class="text-xs text-gray-400 font-normal">
                / 5
              </text>
            </text>
          </view>

          <view class="px-5 py-4 bg-gray-50/50 flex gap-3">
            <button v-if="!isJoined(team.team_id)" class="flex-1 bg-white border border-indigo-200 text-indigo-600 rounded-xl py-3 text-sm font-bold shadow-sm active:scale-95 transition-transform" @click="handleJoinRoom(team)">
              进入房间
            </button>

            <template v-else>
              <template v-if="team.current_status === 0 || team.current_status === 1">
                <view class="flex gap-6">
                  <button
                    class="flex-1 bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-1"
                    :class="team.current_status === 1 ? 'bg-blue-500' : 'bg-indigo-600'"
                    @click="handleAssignScript(team)"
                  >
                    <text>{{ team.current_status === 1 ? '分配剧本' : '重选剧本' }}</text>
                  </button>

                  <button
                    v-if="team.current_status === 1"
                    class="flex-1 bg-emerald-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center gap-1"
                    @click="handleStartGame(team)"
                  >
                    <text>开始游戏</text>
                  </button>
                  <button
                    v-if="team.current_status === 1"
                    class="flex-1 bg-blue-500 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-emerald-200 active:scale-95 transition-transform flex items-center justify-center gap-1"
                    @click="handleGetTask(team)"
                  >
                    <text>同步任务</text>
                  </button>
                </view>
              </template>

              <template v-else-if="team.current_status === 2">
                <view class="w-full flex flex-col gap-3">
                  <view
                    v-if="isJoined(team.team_id) && gameStore.currentTask"
                    class="bg-white rounded-xl p-3 border border-indigo-50 flex justify-between items-center shadow-sm"
                  >
                    <view>
                      <text class="text-[10px] text-gray-400 font-bold uppercase block mb-1">
                        CURRENT TASK
                      </text>
                      <text class="text-sm font-black text-gray-900 leading-tight">
                        {{ team.current_task_name || gameStore.currentTask?.stage_name || '任务同步中...' }}
                      </text>
                    </view>

                    <view v-if="gameStore.isCurrentTaskComplete" class="flex items-center gap-1 text-gray-400">
                      <text class="text-xs font-bold">
                        生成中...
                      </text>
                    </view>
                    <view v-else class="flex items-center gap-1 text-green-500">
                      <text class="animate-pulse">
                        ●
                      </text>
                      <text class="text-xs font-bold">
                        进行中
                      </text>
                    </view>
                  </view>

                  <view class="flex gap-2">
                    <button
                      class="flex-[2] py-3 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 text-white"
                      :class="gameStore.isCurrentTaskComplete
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                        : actionButtonConfig.color"
                      :disabled="gameStore.isCurrentTaskComplete"
                      @click="handleSmartAction(team)"
                    >
                      <text class="text-lg">
                        {{ gameStore.isCurrentTaskComplete ? '💤' : actionButtonConfig.icon }}
                      </text>

                      <text>
                        {{ gameStore.isCurrentTaskComplete ? '等待新关卡' : actionButtonConfig.text }}
                      </text>
                    </button>

                    <button
                      class="flex-1 bg-white border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-bold shadow-sm active:scale-95"
                      @click="handleOpenConsole(team)"
                    >
                      详情
                    </button>
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
    <CustomTabBar :current="0" />
  </view>
</template>

<style scoped>
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
  animation: spin 1s linear infinite;
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
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
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
  animation: bounce 1s infinite;
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
