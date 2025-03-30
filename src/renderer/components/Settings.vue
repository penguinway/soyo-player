<template>
  <div class="settings-modal" v-if="visible">
    <div class="settings-modal-mask" @click="handleClose"></div>
    <div class="settings-modal-container">
      <div class="settings-modal-header">
        <span>{{ $t('header.list.Settings') }}</span>
        <span class="close-btn" @click="handleClose">×</span>
      </div>
      <div class="settings-modal-body">
        <el-tabs v-model="activeTab">
          <!-- 快捷键设置 -->
          <el-tab-pane :label="$t('shortcuts.title')" name="shortcuts">
            <div class="shortcuts-enable">
              <label>
                <input type="checkbox" v-model="enableCustomShortcuts" @change="toggleCustomShortcuts" />
                {{ $t('shortcuts.enableCustom') }}
              </label>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.playControl') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in playControlActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.volumeControl') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in volumeControlActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.progressControl') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in progressControlActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.speedControl') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in speedControlActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.fileControl') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in fileControlActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.interfaceControl') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in interfaceControlActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
            
            <div class="shortcuts-section">
              <h3>{{ $t('shortcuts.other') }}</h3>
              <div class="shortcuts-item" v-for="(action, index) in otherActions" :key="index">
                <span class="shortcut-label">{{ $t(`shortcuts.${action}`) }}</span>
                <div class="shortcut-key-container">
                  <div 
                    class="shortcut-key" 
                    :class="{ 'recording': recordingAction === action }"
                    @click="startRecording(action)"
                  >
                    {{ shortcuts[action] || $t('shortcuts.notSet') }}
                  </div>
                  <span class="shortcut-reset" @click="resetShortcut(action)">↺</span>
                </div>
              </div>
            </div>
          </el-tab-pane>
          
          <!-- 播放设置 -->
          <el-tab-pane :label="$t('settings.playback')" name="playback">
            <div class="settings-section">
              <h3>{{ $t('settings.playbackBehavior') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.autoPlay') }}</span>
                <el-switch v-model="autoPlay"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.rememberPosition') }}</span>
                <el-switch v-model="rememberPosition"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.loopPlay') }}</span>
                <el-switch v-model="loopPlay"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.shufflePlay') }}</span>
                <el-switch v-model="shufflePlay"></el-switch>
              </div>
            </div>
            
            <div class="settings-section">
              <h3>{{ $t('settings.playbackQuality') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.defaultQuality') }}</span>
                <el-select v-model="defaultQuality" class="quality-select">
                  <el-option label="自动" value="auto"></el-option>
                  <el-option label="1080p" value="1080p"></el-option>
                  <el-option label="720p" value="720p"></el-option>
                  <el-option label="480p" value="480p"></el-option>
                </el-select>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.hardwareAcceleration') }}</span>
                <el-switch v-model="hardwareAcceleration"></el-switch>
              </div>
            </div>
          </el-tab-pane>
          
          <!-- 界面设置 -->
          <!-- <el-tab-pane :label="$t('settings.interface')" name="interface">
            <div class="settings-section">
              <h3>{{ $t('settings.display') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.showTime') }}</span>
                <el-switch v-model="showTime"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.showVolume') }}</span>
                <el-switch v-model="showVolume"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.showPlaylist') }}</span>
                <el-switch v-model="showPlaylist"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.showControls') }}</span>
                <el-switch v-model="showControls"></el-switch>
              </div>
            </div>

            <div class="settings-section">
              <h3>{{ $t('settings.theme') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.themeMode') }}</span>
                <el-select v-model="themeMode" class="theme-select">
                  <el-option label="浅色" value="light"></el-option>
                  <el-option label="深色" value="dark"></el-option>
                  <el-option label="跟随系统" value="system"></el-option>
                </el-select>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.accentColor') }}</span>
                <el-color-picker v-model="accentColor" show-alpha></el-color-picker>
              </div>
            </div>
          </el-tab-pane> -->

          <!-- 高级设置 -->
          <el-tab-pane :label="$t('settings.advanced')" name="advanced">
            <div class="settings-section">
              <h3>{{ $t('settings.storage') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.cacheSize') }}</span>
                <span class="setting-value">{{ cacheSize }}</span>
                <el-button size="small" @click="clearCache">{{ $t('settings.clearCache') }}</el-button>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.historyLimit') }}</span>
                <el-input-number v-model="historyLimit" :min="10" :max="1000" size="small"></el-input-number>
              </div>
            </div>

            <div class="settings-section">
              <h3>{{ $t('settings.network') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.proxy') }}</span>
                <el-switch v-model="enableProxy"></el-switch>
              </div>
              <div class="settings-item" v-if="enableProxy">
                <span class="setting-label">{{ $t('settings.proxyAddress') }}</span>
                <el-input v-model="proxyAddress" size="small" placeholder="http://127.0.0.1:7890"></el-input>
              </div>
            </div>

            <div class="settings-section">
              <h3>{{ $t('settings.debug') }}</h3>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.enableLogging') }}</span>
                <el-switch v-model="enableLogging"></el-switch>
              </div>
              <div class="settings-item">
                <span class="setting-label">{{ $t('settings.openDevTools') }}</span>
                <button class="small-btn" @click="openDevTools">{{ $t('settings.openDevTools') }}</button>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <div class="settings-modal-footer">
        <button class="reset-all-btn" @click="resetAllShortcuts">{{ $t('shortcuts.resetAll') }}</button>
        <button class="save-btn" @click="handleClose">{{ $t('shortcuts.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import connect from "../api/bus";
import { Tabs, TabPane, Switch, Select, Option, ColorPicker, InputNumber, Input, Button, Message } from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';

export default {
  name: 'settings-modal',
  components: {
    'el-tabs': Tabs,
    'el-tab-pane': TabPane,
    'el-switch': Switch,
    'el-select': Select,
    'el-option': Option,
    'el-color-picker': ColorPicker,
    'el-input-number': InputNumber,
    'el-input': Input,
    'el-button': Button
  },
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      activeTab: 'shortcuts',
      recordingAction: null,
      playControlActions: ['togglePlay', 'stop', 'prev', 'next'],
      volumeControlActions: ['volumeUp', 'volumeDown', 'mute'],
      progressControlActions: ['forward', 'backward'],
      speedControlActions: ['speedUp', 'speedDown', 'resetSpeed'],
      fileControlActions: ['openFile', 'openFolder', 'openUrl'],
      interfaceControlActions: ['fullScreen', 'exitFullScreen'],
      otherActions: ['noTrace', 'captureFrame'],
      // 播放设置
      autoPlay: true,
      rememberPosition: true,
      loopPlay: false,
      shufflePlay: false,
      defaultQuality: 'auto',
      hardwareAcceleration: true,
      // 界面设置
      showTime: true,
      showVolume: true,
      showPlaylist: true,
      showControls: true,
      themeMode: 'system',
      accentColor: '#409EFF',
      // 高级设置
      cacheSize: '0 MB',
      historyLimit: 100,
      enableProxy: false,
      proxyAddress: '',
      enableLogging: false,
      showDevTools: false
    };
  },
  computed: {
    ...mapGetters({
      shortcuts: 'getShortcuts',
      enableCustomShortcuts: 'isCustomShortcutsEnabled'
    })
  },
  mounted() {
    window.addEventListener('keydown', this.handleKeyDown);
    this.loadSettings();
  },
  beforeDestroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    ...mapActions([
      'updateShortcut',
      'resetShortcuts',
      'setEnableCustomShortcuts'
    ]),
    $message(options) {
      return Message(options);
    },
    handleClose() {
      this.stopRecording();
      this.saveSettings();
      this.$emit('close');
      connect.$emit('updateShortcuts');
    },
    loadSettings() {
      const settings = localStorage.getItem('playerSettings');
      if (settings) {
        try {
          const parsedSettings = JSON.parse(settings);
          Object.assign(this, parsedSettings);
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      }
    },
    saveSettings() {
      const settings = {
        autoPlay: this.autoPlay,
        rememberPosition: this.rememberPosition,
        loopPlay: this.loopPlay,
        shufflePlay: this.shufflePlay,
        defaultQuality: this.defaultQuality,
        hardwareAcceleration: this.hardwareAcceleration,
        showTime: this.showTime,
        showVolume: this.showVolume,
        showPlaylist: this.showPlaylist,
        showControls: this.showControls,
        themeMode: this.themeMode,
        accentColor: this.accentColor,
        historyLimit: this.historyLimit,
        enableProxy: this.enableProxy,
        proxyAddress: this.proxyAddress,
        enableLogging: this.enableLogging,
        showDevTools: this.showDevTools
      };
      
      try {
        localStorage.setItem('playerSettings', JSON.stringify(settings));
        // 发送设置更新事件
        connect.$emit('settingsUpdated', settings);
      } catch (error) {
        console.error('Failed to save settings:', error);
        this.$message({
          message: this.$t('settings.saveError'),
          type: 'error'
        });
      }
    },
    async clearCache() {
      try {
        // 这里添加清除缓存的逻辑
        await connect.$emit('clearCache');
        this.cacheSize = '0 MB';
        this.$message({
          message: this.$t('settings.cacheCleared'),
          type: 'success'
        });
      } catch (error) {
        console.error('Failed to clear cache:', error);
        this.$message({
          message: this.$t('settings.clearCacheError'),
          type: 'error'
        });
      }
    },
    startRecording(action) {
      if (!this.enableCustomShortcuts) return;
      this.recordingAction = action;
    },
    stopRecording() {
      this.recordingAction = null;
    },
    handleKeyDown(e) {
      if (!this.recordingAction || !this.enableCustomShortcuts) return;
      
      e.preventDefault();
      
      let key = '';
      if (e.ctrlKey) key += 'ctrl+';
      if (e.shiftKey) key += 'shift+';
      if (e.altKey) key += 'alt+';
      
      if (e.key === ' ') {
        key += 'space';
      } else if (e.key === 'Escape') {
        key += 'esc';
      } else if (e.key === 'ArrowUp') {
        key += 'up';
      } else if (e.key === 'ArrowDown') {
        key += 'down';
      } else if (e.key === 'ArrowLeft') {
        key += 'left';
      } else if (e.key === 'ArrowRight') {
        key += 'right';
      } else if (e.key.length === 1) {
        key += e.key.toLowerCase();
      } else {
        return;
      }
      
      const conflictAction = this.checkConflict(key);
      if (conflictAction) {
        this.$message({
          message: this.$t('shortcuts.conflict', { action: this.$t(`shortcuts.${conflictAction}`) }),
          type: 'warning'
        });
        return;
      }
      
      this.updateShortcut({ action: this.recordingAction, key });
      this.stopRecording();
    },
    checkConflict(key) {
      for (const action in this.shortcuts) {
        if (this.shortcuts[action] === key && action !== this.recordingAction) {
          return action;
        }
      }
      return null;
    },
    resetShortcut(action) {
      const defaultShortcuts = {
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
        captureFrame: 'c'
      };
      
      this.updateShortcut({ action, key: defaultShortcuts[action] });
    },
    resetAllShortcuts() {
      this.resetShortcuts();
      this.$message({
        message: this.$t('shortcuts.resetSuccess'),
        type: 'success'
      });
    },
    toggleCustomShortcuts(e) {
      this.setEnableCustomShortcuts(e.target.checked);
      if (!e.target.checked) {
        this.stopRecording();
      }
    },
    openDevTools() {
      const { ipcRenderer } = require('electron');
      ipcRenderer.send('open-dev-tools');
      this.$message({
        message: this.$t('settings.devToolsOpened'),
        type: 'success'
      });
    }
  }
};
</script>

<style lang="less" scoped>
.settings-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  
  .settings-modal-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
  }
  
  .settings-modal-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 800px;
    max-height: 80vh;
    background-color: #2e2c29;
    border-radius: 5px;
    color: white;
    display: flex;
    flex-direction: column;
    
    .settings-modal-header {
      padding: 15px;
      border-bottom: 1px solid #4a4a4a;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 18px;
      
      .close-btn {
        cursor: pointer;
        font-size: 24px;
        &:hover {
          color: #5dee00;
        }
      }
    }
    
    .settings-modal-body {
      padding: 15px;
      overflow-y: auto;
      
      .shortcuts-enable {
        margin-bottom: 20px;
        
        label {
          display: flex;
          align-items: center;
          cursor: pointer;
          
          input {
            margin-right: 10px;
          }
        }
      }
      
      .shortcuts-section,
      .settings-section {
        margin-bottom: 20px;
        
        h3 {
          margin-bottom: 10px;
          border-bottom: 1px solid #4a4a4a;
          padding-bottom: 5px;
        }
        
        .shortcuts-item,
        .settings-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          
          .shortcut-label,
          .setting-label {
            flex: 1;
            padding-right: 20px;
          }
          
          .shortcut-key-container {
            display: flex;
            align-items: center;
            
            .shortcut-key {
              background-color: #3a3a3a;
              padding: 5px 10px;
              border-radius: 3px;
              min-width: 100px;
              text-align: center;
              cursor: pointer;
              
              &:hover {
                background-color: #4a4a4a;
              }
              
              &.recording {
                background-color: #5dee00;
                color: #000;
              }
            }
            
            .shortcut-reset {
              margin-left: 10px;
              cursor: pointer;
              font-size: 18px;
              
              &:hover {
                color: #5dee00;
              }
            }
          }
          
          .small-btn {
            background-color: #3a3a3a;
            color: white;
            border: none;
            padding: 5px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.3s ease;
            
            &:hover {
              background-color: #4a4a4a;
            }
          }
        }
      }
    }
    
    .settings-modal-footer {
      padding: 15px;
      border-top: 1px solid #4a4a4a;
      display: flex;
      justify-content: flex-end;
      
      button {
        background-color: #3a3a3a;
        color: white;
        border: none;
        padding: 8px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 12px;
        height: 36px;
        font-size: 14px;
        transition: all 0.3s ease;
        
        &:hover {
          background-color: #4a4a4a;
        }
        
        &.save-btn {
          background-color: #5dee00;
          color: #000;
          font-weight: 500;
          
          &:hover {
            background-color: #4eba00;
          }
        }
      }
    }
  }
}

// Element UI 样式覆盖
:deep(.el-tabs__nav-wrap::after) {
  background-color: #4a4a4a;
}

:deep(.el-tabs__item) {
  color: #ffffff;
  
  &.is-active {
    color: #5dee00;
  }
  
  &:hover {
    color: #5dee00;
  }
}

:deep(.el-tabs__active-bar) {
  background-color: #5dee00;
}

:deep(.el-switch__core) {
  border-color: #4a4a4a;
  
  &.is-checked {
    background-color: #5dee00;
    border-color: #5dee00;
  }
}
</style>