import { io } from 'socket.io-client'

class SocketService {
  constructor() {
    this.socket = null
    this.url = 'http://221.180.19.170:35004'
  }

  connect(token) {
    if (this.socket)
      return

    this.socket = io(this.url, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnection: true,
      auth: { token: `Bearer ${token}` },
    })

    // 2. 绑定基础连接事件
    this.socket.on('connect', () => {
      console.log(' WebSocket Connected')
    })

    this.setupListeners()
  }

  setupListeners() {
    // 成员加入提醒
    this.socket.on('team:member_joined', (data) => {
      uni.showToast({ title: `${data.username} 已加入`, icon: 'none' })
    })

    // 游戏开始提醒
    this.socket.on('game_started', (data) => {
      console.log(' Game Start:', data)
    })

    this.socket.on('game:assistant_stream_chunk', (data) => {
      uni.$emit('socket:ai_chunk', data.chunk)
    })
  }

  // 发送指令 (对应代码中的 socket.emit)
  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export default new SocketService()
