import { defineStore } from 'pinia'

export const useGameStore = defineStore('game', {
  state: () => ({
    gameId: '',
    currentTeamId: '',

    // 🟢 核心任务数据
    currentTask: null, // 任务对象 (用于显示标题/详情)
    currentTaskId: '', // 任务 ID (用于状态比对)
    isCurrentTaskComplete: false, // 状态标记 (true=显示灰底等待, false=显示绿底操作)

    // 🟢 辅助映射
    teamGameMap: {}, // TeamID -> GameID 映射 (用于 Socket 发包)
    roomStates: {}, // 房间状态 (在线人数等)

    // 🟢 进度记录 (用于 Force Submit 时的兜底判断，可选)
    completedMechanisms: {},
    completedSubtasks: {},
  }),

  getters: {
    // 简化的进度展示，仅用于 UI 显示 "1/3" 这种文本
    taskProgress: (state) => {
      const task = state.currentTask
      if (!task)
        return '加载中...'

      if (task.having_sub_tasks) {
        const finishedCount = state.completedSubtasks[task.task_id]?.length || 0
        return `${finishedCount} / ${task.sub_tasks.length}`
      }
      return '进行中'
    },
  },

  actions: {
    // ==========================================
    // 1. 基础 ID 映射管理
    // ==========================================
    setTeamGameMapping(teamId, gameId) {
      if (!teamId || !gameId)
        return
      console.log(`🔗 [Store] 强制建立映射: Team[${teamId}] <-> Game[${gameId}]`)

      this.teamGameMap[teamId] = gameId

      // 如果正好是当前视图的队伍，同步更新 gameId
      if (this.currentTeamId === teamId) {
        this.gameId = gameId
      }
      uni.setStorageSync('TEAM_GAME_MAP', this.teamGameMap)
    },

    getGameIdByTeam(teamId) {
      // 优先查表，其次查当前状态
      return this.teamGameMap[teamId] || (teamId === this.currentTeamId ? this.gameId : null)
    },

    // ==========================================
    // 2. 视图切换
    // ==========================================
    switchTeam(teamId) {
      if (this.currentTeamId !== teamId) {
        console.log(`🧹 [Store] 切换队伍视图: ${this.currentTeamId} -> ${teamId}`)
        this.currentTeamId = teamId

        // 尝试从缓存恢复 GameID
        const cachedGameId = this.teamGameMap[teamId]
        if (cachedGameId) {
          this.gameId = cachedGameId
        }
        else {
          this.gameId = ''
        }

        // 重置任务状态，防止显示上一个队伍的残留信息
        this.currentTaskId = ''
        this.currentTask = null
        this.isCurrentTaskComplete = false
        this.completedMechanisms = {}
      }
    },

    // ==========================================
    // 3. 核心状态更新 (Socket数据 -> Store)
    // ==========================================
    updateGameState(data) {
      // 兼容解包
      const rawData = data.player_state || data
      if (!rawData)
        return

      // --- A. ID 提取与映射 ---
      let incomingTeamId = data.team_id || rawData.team_id
      const incomingGameId = data.game_id || rawData.game_id

      // 兜底：假设是当前队伍
      if (!incomingTeamId && this.currentTeamId) {
        incomingTeamId = this.currentTeamId
      }

      // 更新映射表
      if (incomingTeamId && incomingGameId) {
        this.setTeamGameMapping(incomingTeamId, incomingGameId)
      }

      // ⛔ 过滤：非当前队伍的数据只更新映射，不更新 UI
      if (incomingTeamId && incomingTeamId !== this.currentTeamId)
        return

      // --- B. 任务对象更新 ---
      // 优先读 task (game:new_task)，其次 cur_task (player_state)
      const taskObj = rawData.task || rawData.cur_task
      const newTaskId = taskObj?.task_id || rawData.task_id || rawData.cur_task_id

      if (newTaskId) {
        // 🔥 状态重置：只要 ID 变了，说明进入了新关卡，立刻激活按钮
        if (newTaskId !== this.currentTaskId) {
          console.log(`🔀 [Store] 任务切换: ${this.currentTaskId} -> ${newTaskId}`)
          this.isCurrentTaskComplete = false
          this.currentTaskId = newTaskId
        }
      }

      if (taskObj) {
        this.currentTask = taskObj
      }

      // --- C. 进度同步 (可选，用于智能提交时的兜底判断) ---
      if (rawData.completed_mechanisms)
        this.completedMechanisms = rawData.completed_mechanisms
      if (rawData.completed_subtasks)
        this.completedSubtasks = rawData.completed_subtasks
    },

    // ==========================================
    // 4. 增量更新 (任务/机制完成通知)
    // ==========================================
    handleTaskComplete(data) {
      if (data.team_id && data.team_id !== this.currentTeamId)
        return

      console.log('🎯 [Store] 收到任务完成信号:', data)

      const { task_id, sub_task_id } = data

      // 子任务完成：只更新进度记录
      if (sub_task_id) {
        if (!this.completedSubtasks[task_id])
          this.completedSubtasks[task_id] = []
        if (!this.completedSubtasks[task_id].includes(sub_task_id)) {
          this.completedSubtasks[task_id].push(sub_task_id)
        }
      }
      // 大任务完成：界面变灰，等待 T+1
      else {
        // 宽容模式：只要 ID 对得上，或者本地还没 ID，都认账
        if (this.currentTaskId === task_id || !this.currentTaskId) {
          console.log('✅ [Store] 任务结束，进入等待状态')
          this.isCurrentTaskComplete = true
          if (!this.currentTaskId)
            this.currentTaskId = task_id
        }
      }
    },

    handleMechanismComplete(data) {
      if (data.team_id && data.team_id !== this.currentTeamId)
        return

      const { task_id, sub_task_id, completed_mechanism } = data
      if (!task_id || !completed_mechanism)
        return

      if (!this.completedMechanisms[task_id])
        this.completedMechanisms[task_id] = {}

      // 简单粗暴地记录一下，供智能提交判断用
      if (sub_task_id) {
        if (!this.completedMechanisms[task_id][sub_task_id])
          this.completedMechanisms[task_id][sub_task_id] = {}
        this.completedMechanisms[task_id][sub_task_id][completed_mechanism] = true
      }
      else {
        this.completedMechanisms[task_id][completed_mechanism] = true
      }
    },
  },
})
