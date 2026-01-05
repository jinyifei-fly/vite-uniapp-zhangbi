import { defineStore } from 'pinia'
import { io } from 'socket.io-client'
import { useUserStore } from '@/store/user'
import { useGameStore } from './game'

export const useSocketStore = defineStore('socket', {
  state: () => ({
    socket: null,
    isConnected: false,
    connectError: null,
  }),

  actions: {

    connect() {
      const userStore = useUserStore()

      if (this.socket?.connected) {
        console.log('Socket 已经连接，跳过')
        return
      }

      const url = ''

      console.log('🚀 正在尝试连接 Socket, 目标:', url || 'H5 Proxy')

      this.socket = io(url, {

        path: '/socket.io',

        transports: ['websocket', 'polling'],

        reconnection: true,
        reconnectionAttempts: 5,

        auth: {
          token: userStore.token,
        },
      })

      this.setupBaseListeners()
    },

    setupBaseListeners() {
      if (!this.socket)
        return
      const gameStore = useGameStore()

      this.socket.on('connect', () => {
        this.isConnected = true
        console.log('✅ Socket 连接成功! ID:', this.socket.id)
      })

      this.socket.on('disconnect', () => {
        this.isConnected = false
        gameStore.resetState()
        console.log('❌ Socket 断开')
      })

      this.socket.on('game:room_joined', (data) => {
        console.log('🏠 已加入房间:', data)
        gameStore.setRoomInfo(data)
        uni.showToast({ title: '加入房间成功', icon: 'success' })
      })

      this.socket.on('game:room_left', () => {
        gameStore.resetState()
      })

      this.socket.on('game_started', (data) => {
        console.log('🎮 游戏开始:', data)
        gameStore.updateGameState(data)
        uni.showToast({ title: '游戏开始！', icon: 'none' })
      })

      this.socket.on('game:new_task', (data) => {
        console.log('📦 收到新任务:', data)

        if (data.player_state) {
          gameStore.updateGameState(data.player_state)
        }
        else if (data.task) {
          gameStore.currentTaskId = data.task_id
          gameStore.currentTask = data.task
        }

        uni.showModal({
          title: '新任务',
          content: data.task_msg || '你收到了一个新的任务',
          showCancel: false,
        })
      })

      this.socket.on('team:member_joined', (data) => {
        uni.showToast({ title: `${data.username} 加入了队伍`, icon: 'none' })
      })
    },

    joinRoom(teamId) {
      const userStore = useUserStore()
      if (!this.socket || !this.isConnected) {
        uni.showToast({ title: 'Socket未连接', icon: 'none' })
        return
      }

      console.log('📤 发送加入房间请求:', teamId)

      this.socket.emit('game:join_room', {
        team_id: teamId,
        user_id: userStore.userInfo.user_id || userStore.userInfo.id,
        username: userStore.userInfo.username || userStore.userInfo.name,
      })
    },
    selectScript(scriptId) {
      if (!this.isConnected)
        return
      console.log('📝 导游选择剧本:', scriptId)
      this.socket.emit('game:select_script', {
        script_id: scriptId,
        timestamp: new Date().toISOString(),
      })
    },

    startGame() {
      const gameStore = useGameStore()
      if (!this.isConnected)
        return

      if (!gameStore.gameId) {
        uni.showToast({ title: '请先选择剧本', icon: 'none' })
        return
      }

      console.log('🚀 导游请求开始游戏, GameID:', gameStore.gameId)
      this.socket.emit('game:start', {
        game_id: gameStore.gameId,
        timestamp: new Date().toISOString(),
      })
    },
    emit(event, data) {
      if (this.socket && this.isConnected) {
        this.socket.emit(event, data)
      }
      else {
        console.warn('Socket 未连接，发送失败:', event)
      }
    },

    disconnect() {
      if (this.socket) {
        this.socket.disconnect()
        this.socket = null
        this.isConnected = false
      }
    },
  },
})
