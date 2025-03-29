const state = {
  // 默认快捷键配置
  shortcuts: {
    // 播放控制
    togglePlay: 'space', // 播放/暂停
    stop: 'shift+s', // 停止
    prev: 'shift+left', // 上一个
    next: 'shift+right', // 下一个
    
    // 音量控制
    volumeUp: 'up', // 增大音量
    volumeDown: 'down', // 减小音量
    mute: 'm', // 静音
    
    // 播放进度控制
    forward: 'right', // 快进
    backward: 'left', // 后退
    
    // 播放速度控制
    speedUp: 'ctrl+up', // 加速
    speedDown: 'ctrl+down', // 减速
    resetSpeed: 'r', // 重置速度
    
    // 文件操作
    openFile: 'ctrl+o', // 打开文件
    openFolder: 'ctrl+shift+o', // 打开文件夹
    openUrl: 'ctrl+u', // 打开URL
    
    // 界面控制
    fullScreen: 'f', // 全屏
    exitFullScreen: 'esc', // 退出全屏
    
    // 其他功能
    noTrace: 'ctrl+t', // 无痕模式
    captureFrame: 'c', // 截取当前帧
  },
  
  // 是否启用自定义快捷键
  enableCustomShortcuts: true,
}

const mutations = {
  // 更新单个快捷键
  UPDATE_SHORTCUT(state, { action, key }) {
    state.shortcuts[action] = key
  },
  
  // 重置为默认快捷键
  RESET_SHORTCUTS(state) {
    state.shortcuts = {
      togglePlay: 'space',
      stop: 'shift+s',
      prev: 'shift+left',
      next: 'shift+right',
      volumeUp: 'up',
      volumeDown: 'down',
      mute: 'm',
      forward: 'right',
      backward: 'left',
      speedUp: 'ctrl+up',
      speedDown: 'ctrl+down',
      resetSpeed: 'r',
      openFile: 'ctrl+o',
      openFolder: 'ctrl+shift+o',
      openUrl: 'ctrl+u',
      fullScreen: 'f',
      exitFullScreen: 'esc',
      noTrace: 'ctrl+t',
      captureFrame: 'c',
    }
  },
  
  // 设置是否启用自定义快捷键
  SET_ENABLE_CUSTOM_SHORTCUTS(state, enable) {
    state.enableCustomShortcuts = enable
  }
}

const actions = {
  // 更新快捷键
  updateShortcut({ commit }, payload) {
    commit('UPDATE_SHORTCUT', payload)
  },
  
  // 重置快捷键
  resetShortcuts({ commit }) {
    commit('RESET_SHORTCUTS')
  },
  
  // 设置是否启用自定义快捷键
  setEnableCustomShortcuts({ commit }, enable) {
    commit('SET_ENABLE_CUSTOM_SHORTCUTS', enable)
  }
}

const getters = {
  // 获取所有快捷键配置
  getShortcuts: state => state.shortcuts,
  
  // 获取单个快捷键配置
  getShortcut: state => action => state.shortcuts[action],
  
  // 获取是否启用自定义快捷键
  isCustomShortcutsEnabled: state => state.enableCustomShortcuts
}

export default {
  state,
  mutations,
  actions,
  getters
} 