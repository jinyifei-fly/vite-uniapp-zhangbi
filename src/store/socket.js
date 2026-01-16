import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { useGameStore } from '@/store/game'
import { useUserStore } from '@/store/user'

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    isConnected: false,
    isGameStarted: false,
  }),

  actions: {
    // ==========================================
    // 1. 连接初始化
    // ==========================================
    connect() {
      const userStore = useUserStore()
      if (this.socket?.connected)
        return

      // 根据环境变量动态设置 Socket 服务器地址
      // 开发环境使用代理 '/'，生产环境使用完整的 HTTPS 地址
      const baseUrl = import.meta.env.VITE_API_WS_URL || '/'
      const url = import.meta.env.MODE === 'production' ? baseUrl : '/'

      console.log('🚀 [Socket] 正在连接服务器...', url)
      this.socket = io(url, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: { token: userStore.token },
        reconnection: true,
      })

      this.setupBaseListeners()
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.isConnected = false
      }
    },

    // ==========================================
    // 2. 核心监听器配置
    // ==========================================
    setupBaseListeners() {
      if (!this.socket)
        return

      const gameStore = useGameStore()
      const userStore = useUserStore()

      // --- 基础事件 ---
      this.socket.on('connect', () => {
        this.isConnected = true
        console.log('✅ [Socket] 连接成功')
        // 断线重连逻辑：重新加入当前查看的房间
        if (gameStore.currentTeamId && userStore.userId) {
          console.log(`🔄 [Socket] 重新加入当前房间: ${gameStore.currentTeamId}`)
          this.joinRoom(gameStore.currentTeamId)
        }
      })

      this.socket.on('disconnect', () => {
        this.isConnected = false
        console.log('❌ [Socket] 断开连接')
      })

      // --- 🏠 房间管理 ---
      this.socket.on('game:room_joined', (data) => {
        console.log('📡 [Socket][room_joined]', data)
        // Store 会自动处理 team_id -> game_id 的映射记录
        gameStore.updateGameState(data)

        // 只有当前查看的房间才提示
        if (data.team_id === gameStore.currentTeamId) {
          uni.showToast({ title: '已进入房间', icon: 'success' })
        }
      })

      this.socket.on('game:cur_task', (data) => {
        console.log('📡 [Socket][cur_task] 恢复状态:', data)
        gameStore.updateGameState(data)
        if (data.team_id === gameStore.currentTeamId) {
          uni.showToast({ title: '已恢复进度', icon: 'none' })
        }
      })

      this.socket.on('team:member_joined', (data) => {
        // 更新房间人数缓存
        if (!gameStore.roomStates[data.team_id])
          gameStore.roomStates[data.team_id] = {}
        gameStore.roomStates[data.team_id].memberCount = data.members_count
      })

      this.socket.on('team:member_left', (data) => {
        if (gameStore.roomStates[data.team_id]) {
          gameStore.roomStates[data.team_id].memberCount = data.members_count
        }
      })

      // --- 🎮 游戏流程核心 ---

      this.socket.on('game:game_created', (data) => {
        console.log('📡 [Socket][game_created]', data)
        gameStore.updateGameState(data)
        if (data.team_id === gameStore.currentTeamId) {
          uni.showToast({ title: '剧本就绪', icon: 'success' })
        }
      })

      this.socket.on('game_started', (data) => {
        console.log('📡 [Socket][game_started]', data)
        gameStore.updateGameState(data)

        if (data.team_id === gameStore.currentTeamId) {
          this.isGameStarted = true
          uni.showToast({ title: '游戏开始', icon: 'success' })
        }
      })

      // 🟢 [关键] 新任务通知
      this.socket.on('game:new_task', (data) => {
        const teamId = data.team_id || (data.player_state ? data.player_state.team_id : '')
        console.log(`📡 [Socket][new_task] Team:${teamId}`, data)

        // 1. 更新 Store (Store 会根据 teamId 决定是更新界面还是只存缓存)
        if (data.player_state) {
          gameStore.updateGameState(data.player_state)
        }
        else if (data.task) {
          // 构造一个临时对象传进去，确保 updateGameState 能识别 team_id
          gameStore.updateGameState({
            team_id: teamId,
            cur_task: data.task,
            cur_task_id: data.task_id,
          })
        }

        // 2. 只有当前正在看的队伍才弹窗提示，避免后台队伍刷屏
        if (teamId === gameStore.currentTeamId) {
          uni.vibrateLong()
          uni.showModal({
            title: '新任务',
            content: data.task_msg || '任务目标已更新',
            showCancel: false,
            confirmText: '收到',
          })
        }
      })

      // 🟢 监听房间消息
      this.socket.on('room_msg', (data) => { // 注意：后端事件名通常是 room_msg 或 game:message，需统一
        console.log(`📡 [Socket][room_msg] Team:${data.team_id}`, data)
        // Store 增加日志或红点
        // gameStore.addMessageLog(data) // 如果你在 store 里实现了这个
      })

      // 🟢 [关键] 任务完成 (核心修复逻辑)
      this.socket.on('game:task_complete', (data) => {
        const incomingTeamId = data.team_id
        console.log(`📡 [Socket][task_complete] Team:${incomingTeamId}`, data)

        // 1. 尝试全量更新
        if (data.player_state) {
          console.log('🔄 [Socket] 包含全量状态，直接更新')
          gameStore.updateGameState(data.player_state)
        }
        else {
          // 2. 增量更新 (UI变绿灯)
          console.log('⏳ [Socket] 简略确认，标记完成')
          gameStore.handleTaskComplete(data)

          // 🔥 3. 主动拉取最新状态 (核心修复)
          // 必须根据 incomingTeamId 去找对应的 GameID，而不是盲目用当前的
          const correctGameId = gameStore.getGameIdByTeam(incomingTeamId)

          if (correctGameId) {
            console.log(`🔄 [Socket] 主动拉取队伍 ${incomingTeamId} 的最新状态...`)
            setTimeout(() => {
              this.socket.emit('game:debug_get_player_state', {
                game_id: correctGameId,
                timestamp: new Date().toISOString(),
              })
            }, 800)
          }
          else {
            console.warn(`❌ [Socket] 无法拉取状态: 未找到 Team:${incomingTeamId} 的 GameID`)
          }
        }

        // 4. UI 提示 (仅限当前队伍)
        if (incomingTeamId === gameStore.currentTeamId) {
          try {
            uni.hideLoading()
          }
          catch (e) {}
          uni.showToast({ title: data.task_msg || '节点完成', icon: 'success' })
        }
      })
      // ===============================================
      // 1. 恢复状态 (导游刚进房间时触发)
      // ===============================================
      this.socket.on('game:cur_task', (data) => {
        // 过滤：如果收到的不是当前查看队伍的数据，只更新后台数据，不弹窗
        const incomingTeamId = data.team_id || (data.player_state && data.player_state.team_id)

        console.log(`📡 [Socket][cur_task] 恢复状态 Team:${incomingTeamId}`, data)

        // 更新 Store
        gameStore.updateGameState(data)

        // 只有是当前视图的队伍时，才提示
        if (incomingTeamId === gameStore.currentTeamId) {
          uni.showToast({ title: '已恢复进度', icon: 'none' })
        }
      })

      // ===============================================
      // 2. 新任务推送
      // ===============================================
      this.socket.on('game:new_task', (data) => {
        const incomingTeamId = data.team_id || (data.player_state && data.player_state.team_id)

        console.log(`📡 [Socket][new_task] 收到新任务 Team:${incomingTeamId}`, data)

        // 更新 Store
        if (data.player_state) {
          gameStore.updateGameState(data.player_state)
        }
        else if (data.task) {
          gameStore.updateGameState({
            team_id: incomingTeamId,
            cur_task: data.task,
            cur_task_id: data.task_id,
          })
        }

        if (incomingTeamId === gameStore.currentTeamId) {
          uni.vibrateLong()
          uni.showModal({
            title: '新任务到达',
            content: data.task_msg || '当前阶段已更新，请查看',
            showCancel: false,
            confirmText: '收到',
          })
        }
      })

      // 🟢 通用状态同步
      this.socket.on('game:debug_player_state', (data) => {
        console.log('📡 [Socket][debug_player_state]', data)
        const stateData = data.player_state || data
        gameStore.updateGameState(stateData)
      })

      // 机制完成
      this.socket.on('game:mechanism_complete', (data) => {
        console.log('📡 [Socket][mechanism_complete]', data)
        gameStore.handleMechanismComplete(data)
        if (data.team_id === gameStore.currentTeamId) {
          uni.showToast({ title: '验证通过', icon: 'success' })
        }
      })

      // 错误处理
      this.socket.on('game:task_failed', (data) => {
        console.warn('🔥 [Socket][task_failed]', data)
        if (data.team_id === gameStore.currentTeamId) {
          try {
            uni.hideLoading()
          }
          catch (e) {}
          uni.showModal({ title: '失败', content: data.task_msg, showCancel: false })
        }
      })

      this.socket.on('game:error', (err) => {
        console.error('🔥 [Socket][error]', err)
        // 错误通常是针对当前 socket 连接者的，所以可以直接提示
        uni.showToast({ title: err.message || '未知错误', icon: 'none' })
      })
    },

    // ==========================================
    // 3. 业务操作 Actions
    // ==========================================

    joinRoom(teamId) {
      const userStore = useUserStore()
      const gameStore = useGameStore()

      if (!this.socket?.connected)
        return

      // 切换视图
      gameStore.switchTeam(teamId)

      const realUserId = userStore.userId || userStore.userInfo?.id || uni.getStorageSync('userId')
      if (!realUserId) {
        uni.showToast({ title: '需重新登录', icon: 'none' })
        return
      }

      console.log(`📤 [Socket] 加入房间: ${teamId}`)
      this.socket.emit('game:join_room', {
        team_id: teamId,
        user_id: realUserId,
        username: userStore.userName || '导游',
      })
    },

    selectScript(teamId, scriptId) {
      if (this.checkConnection()) {
        console.log(`📤 [Socket] 选择剧本 Team:${teamId} Script:${scriptId}`)
        this.socket.emit('game:select_script', {
          team_id: teamId,
          script_id: scriptId,
          timestamp: new Date().toISOString(),
        })
      }
    },

    startGame(gameId) {
      // 这里的 gameId 必须是准确传入的，通常是列表页传进来的
      if (!this.checkConnection())
        return
      if (!gameId)
        return uni.showToast({ title: '缺 GameID', icon: 'none' })

      const gameStore = useGameStore() // 获取 store

      if (gameStore.currentTeamId) {
        gameStore.setTeamGameMapping(gameStore.currentTeamId, gameId)
      }

      console.log(`📤 [Socket] 开始游戏 Game:${gameId}`)
      this.socket.emit('game:start', { game_id: gameId })
    },

    /**
     * 🟢 极简提交任务 (只负责 STAFF_CONFIRM)
     */
    submitTask(data = null, mechanismType = 'STAFF_CONFIRM') {
      const gameStore = useGameStore()

      // 1. 基础校验
      if (!this.checkConnection() || !gameStore.gameId) {
        uni.showToast({ title: '未连接或无游戏ID', icon: 'none' })
        return
      }

      console.log(`📤 [Socket] 导游提交: ${mechanismType}`)

      const submissionData = {
        mechanism_type: mechanismType,
        staff_id: 'GUIDE_ADMIN', // 固定写死，告诉后端这是管理员操作
        ...data, // 如果以后有特殊数据要传，保留这个扩展口
      }

      // 3. 构造 Payload (严格匹配后端 Python 的 data.get 逻辑)
      const payload = {
        game_id: gameStore.gameId, // 后端: data.get("game_id")
        task_id: gameStore.currentTaskId, // 后端: data.get("task_id")
        submission_data: submissionData, // 后端: data.get("submission_data")
        timestamp: new Date().toISOString(),
      }

      // 4. 子任务处理
      // 如果当前任务有子任务，且导游当前选中了子任务，把 ID 带上
      if (gameStore.currentTask?.having_sub_tasks && gameStore.selectedSubTaskId) {
        payload.sub_task_id = gameStore.selectedSubTaskId // 后端: data.get("sub_task_id")
      }

      console.log('📤 [Socket] 发送 Payload:', payload)

      // 5. 发送事件
      // ⚠️ 注意：根据你的后端代码 @sio.on("game:task-submit")，这里必须是中划线
      this.socket.emit('game:task_submit', payload)

      // 6. UI 反馈
      uni.showLoading({ title: '通行中...', mask: true })

      // 兜底关闭 loading (防止 socket 没回包导致卡住)
      setTimeout(() => {
        try {
          uni.hideLoading()
        }
        catch (e) {}
      }, 2000)
    },
    forceCompleteTask(data = {}) {
      const gameStore = useGameStore()

      // 1. 安全校验
      if (!gameStore.gameId) {
        console.error('❌ [Socket] 强制跳过失败: 缺失 gameId')
        uni.showToast({ title: '无游戏ID，无法操作', icon: 'none' })
        return
      }
      if (!this.checkConnection())
        return

      // 2. 构造 Payload (对应后端要求的格式)
      const payload = {
        game_id: gameStore.gameId, // 必传
        task_id: gameStore.currentTaskId, // 必传
        timestamp: new Date().toISOString(),
      }

      // 3. 如果是子任务，带上 sub_task_id
      if (data.sub_task_id) {
        payload.sub_task_id = data.sub_task_id
      }

      console.log(`⚡ [Socket] 发送强制跳关:`, payload)
      this.socket.emit('guide:force_complete_task', payload)

      // 4. UI 反馈
      uni.showLoading({ title: '强制通行中...', mask: true })
      setTimeout(() => {
        try {
          uni.hideLoading()
        }
        catch (e) {}
      }, 2000)
    },
    checkConnection() {
      if (!this.socket || !this.isConnected) {
        uni.showToast({ title: 'Socket未连接', icon: 'none' })
        return false
      }
      return true
    },
  },
})
