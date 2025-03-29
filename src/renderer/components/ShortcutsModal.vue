<template>
  <div class="shortcuts-modal" v-if="visible">
    <div class="shortcuts-modal-mask" @click="handleClose"></div>
    <div class="shortcuts-modal-container">
      <div class="shortcuts-modal-header">
        <span>{{ $t('shortcuts.title') }}</span>
        <span class="close-btn" @click="handleClose">×</span>
      </div>
      <div class="shortcuts-modal-body">
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
      </div>
      <div class="shortcuts-modal-footer">
        <button class="reset-all-btn" @click="resetAllShortcuts">{{ $t('shortcuts.resetAll') }}</button>
        <button class="save-btn" @click="handleClose">{{ $t('shortcuts.close') }}</button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';
import Mousetrap from 'mousetrap';
import connect from "../api/bus";

export default {
  name: 'shortcuts-modal',
  props: {
    visible: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      recordingAction: null,
      playControlActions: ['togglePlay', 'stop', 'prev', 'next'],
      volumeControlActions: ['volumeUp', 'volumeDown', 'mute'],
      progressControlActions: ['forward', 'backward'],
      speedControlActions: ['speedUp', 'speedDown', 'resetSpeed'],
      fileControlActions: ['openFile', 'openFolder', 'openUrl'],
      interfaceControlActions: ['fullScreen', 'exitFullScreen'],
      otherActions: ['noTrace', 'captureFrame']
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
    handleClose() {
      this.stopRecording();
      this.$emit('close');
      // 通知更新快捷键
      connect.$emit('updateShortcuts');
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
      
      // 组合按键处理
      let key = '';
      if (e.ctrlKey) key += 'ctrl+';
      if (e.shiftKey) key += 'shift+';
      if (e.altKey) key += 'alt+';
      
      // 特殊按键处理
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
        return; // 不支持的按键
      }
      
      // 检查是否与其他快捷键冲突
      const conflictAction = this.checkConflict(key);
      if (conflictAction) {
        this.$message({
          message: this.$t('shortcuts.conflict', { action: this.$t(`shortcuts.${conflictAction}`) }),
          type: 'warning'
        });
        return;
      }
      
      // 更新快捷键
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
    }
  }
};
</script>

<style lang="less" scoped>
.shortcuts-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  
  .shortcuts-modal-mask {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
  }
  
  .shortcuts-modal-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 600px;
    max-height: 80vh;
    background-color: #2e2c29;
    border-radius: 5px;
    color: white;
    display: flex;
    flex-direction: column;
    
    .shortcuts-modal-header {
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
    
    .shortcuts-modal-body {
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
      
      .shortcuts-section {
        margin-bottom: 20px;
        
        h3 {
          margin-bottom: 10px;
          border-bottom: 1px solid #4a4a4a;
          padding-bottom: 5px;
        }
        
        .shortcuts-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          
          .shortcut-label {
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
        }
      }
    }
    
    .shortcuts-modal-footer {
      padding: 15px;
      border-top: 1px solid #4a4a4a;
      display: flex;
      justify-content: flex-end;
      
      button {
        background-color: #3a3a3a;
        color: white;
        border: none;
        padding: 8px 15px;
        border-radius: 3px;
        cursor: pointer;
        margin-left: 10px;
        
        &:hover {
          background-color: #4a4a4a;
        }
        
        &.save-btn {
          background-color: #5dee00;
          color: #000;
          
          &:hover {
            background-color: #4eba00;
          }
        }
      }
    }
  }
}
</style> 