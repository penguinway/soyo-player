<template>
  <div :style="{'background-image': `url('${theme.bgUrl}')`}" id="app" ref="app">
    <div :class="{'header-fullScreen':isFullScreen}" ref="header" class="app-header">
      <my-header />
    </div>
    <div ref="video" class="video" @mouseenter="onMouseEnter" @mouseleave="onMouseLeave">
      <my-video />
      <play-list :play-list-height="playListHeight" :is-show-arrow="isShowArrow" />
      
      <!-- 音乐标签管理面板 -->
      <div v-if="showMusicLabels" class="music-labels-container">
        <music-labels />
      </div>
    </div>
    <div :class="{'footer-fullScreen':isFullScreen}" ref="footer" class="app-footer">
      <my-footer />
    </div>
  </div>
</template>

<script>
import { client, reg } from "./api/util";
import { suffix } from "./api/util";
import connect from "./api/bus.js";
import { mapGetters, mapMutations } from "vuex";
import Mousetrap from "mousetrap";
import path from "path";
import fs from "fs";
import { ipcRenderer } from "electron";

import OpenDialog from "./api/OpenDialog";
import WindowUtil from "./api/window";
import ShortcutManager from "./api/ShortcutManager";

const openDialog = new OpenDialog();
const winUtil = new WindowUtil();
const shortcutManager = new ShortcutManager();
// const { ipcRenderer } = require("electron");

export default {
  name: "elysia-player",
  data() {
    return {
      isShowArrow: false,
      playListHeight: null,
      showMusicLabels: false
    };
  },
  mounted() {
    this.count = 0;
    this.initPlayListHeight();
    this.mouseMoveTimer = null;
    this.FullScreenTimer = null;
    window.addEventListener("resize", this.initPlayListHeight);
    this.initShortcuts();
    let video = this.$refs.video;
    video.ondragenter = video.ondragover = video.ondragleave = function() {
      // 阻止默认事件
      return false;
    };
    // 释放文件
    video.addEventListener("drop", this.onDrop);
    
    // 接收主进程发来的显示/隐藏音乐标签的消息
    ipcRenderer.on('toggleMusicLabels', () => {
      this.showMusicLabels = !this.showMusicLabels;
      // 通知组件状态变化
      connect.$emit('musicLabelsStateChanged', this.showMusicLabels);
    });
  },
  methods: {
    ...mapMutations([
      "setCurrentTime",
      "setInWidth",
      "setIsVolumeOn",
      "setSpeed"
    ]),
    onMouseEnter() {
      this.isShowArrow = true;
    },
    onMouseLeave() {
      this.isShowArrow = false;
    },
    // 初始化播放列表高度
    initPlayListHeight() {
      let footerHeight = this.$refs.footer.getBoundingClientRect().height;
      let headerHeight = this.$refs.header.getBoundingClientRect().height;
      this.playListHeight = client().height - footerHeight - headerHeight;
    },
    // 显示头部和脚部
    showFooterAndHeader() {
      this.$refs.footer.style.height = "auto";
      this.$refs.header.style.height = "auto";
      this.initPlayListHeight();
    },
    // 隐藏头部和脚部
    hideFooterAndHeader() {
      this.$refs.footer.click();
      this.$refs.footer.style.height = "0";
      this.$refs.header.style.height = "0";
      this.initPlayListHeight();
    },
    onMouseMove(e) {
      if (!this.isFullScreen) {
        return;
      }
      if (this.mouseMoveTimer) {
        clearTimeout(this.mouseMoveTimer);
      }
      if (this.FullScreenTimer) {
        clearTimeout(this.FullScreenTimer);
      }
      this.mouseMoveTimer = setTimeout(() => {
        // 计算鼠标是否移动到头部或者是脚部的位置
        if (e.screenY <= 36 || client().height - e.screenY <= 85) {
          this.showFooterAndHeader();
          connect.$emit("showFooterAndHeader");
        } else {
          this.FullScreenTimer = setTimeout(() => {
            this.hideFooterAndHeader();
            connect.$emit("hideFooterAndHeader");
            clearTimeout(this.FullScreenTimer);
          }, 2000);
        }
      }, 50);
    },
    // 初始化快捷键
    initShortcuts() {
      // 注册音量增加动作
      shortcutManager.registerActionHandler('volumeUp', () => {
        let w = this.inWidth + 5;
        if (w >= 62) {
          //音量上限
          this.setInWidth(62);
        } else {
          this.setInWidth(w);
        }
      });
      
      // 注册音量减小动作
      shortcutManager.registerActionHandler('volumeDown', () => {
        let w = this.inWidth - 5;
        if (w <= 0) {
          //音量下限
          this.setInWidth(0);
        } else {
          this.setInWidth(w);
        }
      });
      
      // 注册快进动作
      shortcutManager.registerActionHandler('backward', () => {
        if (this.currentVideo) {
          this.setCurrentTime(this.currentTime - 4);
          connect.$emit("setCurrentTime");
        }
      });
      
      // 注册快退动作
      shortcutManager.registerActionHandler('forward', () => {
        if (this.currentVideo) {
          this.setCurrentTime(this.currentTime + 4);
          connect.$emit("setCurrentTime");
        }
      });
      
      // 注册播放速度增加动作
      shortcutManager.registerActionHandler('speedUp', () => {
        if (this.speed == 2 || !this.currentVideo) {
          return;
        }
        let speed = parseFloat(
          ((this.speed * 10 + 1) / 10).toString().substring(0, 3)
        );
        this.setSpeed(speed);
      });
      
      // 注册播放速度减小动作
      shortcutManager.registerActionHandler('speedDown', () => {
        if (this.speed == 0.1 || !this.currentVideo) {
          return;
        }
        let speed = parseFloat(
          ((this.speed * 10 - 1) / 10).toString().substring(0, 3)
        );
        this.setSpeed(speed);
      });
      
      // 绑定所有快捷键
      shortcutManager.bindShortcut('volumeUp');
      shortcutManager.bindShortcut('volumeDown');
      shortcutManager.bindShortcut('backward');
      shortcutManager.bindShortcut('forward');
      shortcutManager.bindShortcut('speedUp');
      shortcutManager.bindShortcut('speedDown');
    },
    onDrop(e) {
      e.preventDefault();
      let files = e.dataTransfer.files;
      files = Array.prototype.slice.call(files);
      let arr = [];

      files.forEach(item => {
        const stat = fs.statSync(item.path).isDirectory();
        if (!stat) {
          let extname = path.extname(item.path).toLowerCase();
          // let flag = reg.test(extname);
          let flag = suffix.includes(extname);
          if (flag) {
            arr.push(item.path);
          }
        } else {
          arr.push(...this.readFileFromFolder([item.path]));
          this.count = 0;
        }
      });
      if (arr.length == 0) {
        return;
      }
      let arrs = openDialog.getFileStatFromLocal(arr);
      openDialog.changeStore(arrs);
    },
    // 从文件夹中读取文件
    readFileFromFolder(paths) {
      this.count++;
      let arr = [];
      if (this.count > 3) {
        return [];
      }
      for (let i = 0; i < paths.length; i++) {
        const p = paths[i];
        const stat = fs.statSync(p);
        if (stat.isDirectory() == true) {
          let result = fs.readdirSync(p);
          for (let j = 0; j < result.length; j++) {
            result[j] = path.join(p, result[j]);
          }
          arr.push(...this.readFileFromFolder(result));
        } else {
          const ext = path.extname(p).toLowerCase();
          if (suffix.includes(ext)) {
            arr.push(p);
          }
        }
      }
      return arr;
    }
  },
  computed: {
    ...mapGetters([
      "currentVideo",
      "isFullScreen",
      "videoList",
      "isPlaying",
      "currentTime",
      "inWidth",
      "speed",
      "isAlwaysOnTop",
      "theme",
      "isLoggedIn",
      "currentUser"
    ])
  },
  watch: {
    isAlwaysOnTop: {
      immediate: true,
      handler: function(newVal) {
        winUtil.setAlwaysOnTop(newVal);
      }
    },
    isPlaying() {
      // 播放的时候脚部的高度会发生变化，所以需要重新计算播放列表的高度
      this.$nextTick(() => {
        this.initPlayListHeight();
      });
    },
    isFullScreen(newVal) {
      // 全屏的时候
      if (newVal) {
        this.$refs.app.addEventListener("mousemove", this.onMouseMove);
        if (this.FullScreenTimer) {
          clearTimeout(this.FullScreenTimer);
        }
        this.FullScreenTimer = setTimeout(() => {
          this.hideFooterAndHeader();
          connect.$emit("hideFooterAndHeader");
          clearTimeout(this.FullScreenTimer);
        }, 2000);
      } else {
        if (this.FullScreenTimer) {
          clearTimeout(this.FullScreenTimer);
        }
        this.$refs.app.removeEventListener("mousemove", this.onMouseMove);
        this.showFooterAndHeader();
      }
    },
    // 监听登录状态变化
    isLoggedIn(newVal) {
      console.log('登录状态变化:', newVal ? '已登录' : '未登录');
      // 通知组件登录状态变化
      connect.$emit('loginStateChanged', newVal);
    },
    // 监听当前用户信息变化
    currentUser(newVal) {
      if (newVal) {
        console.log('当前用户已更新:', newVal.username);
      } else {
        console.log('当前用户已清空');
      }
      // 通知组件用户信息变化
      connect.$emit('userInfoChanged', newVal);
    }
  },
  beforeDestroy() {
    if (this.mouseMoveTimer) {
      clearTimeout(this.mouseMoveTimer);
    }
    if (this.FullScreenTimer) {
      clearTimeout(this.FullScreenTimer);
    }
    window.removeEventListener("resize", this.initialInputHeight);
    this.$refs.app.removeEventListener("mousemove", this.onMouseMove);
    
    // 移除事件监听
    ipcRenderer.removeListener('toggleMusicLabels');
  }
};
</script>

<style lang="less" scoped>
#app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  background-position: center center;
  background-repeat: no-repeat;
  background-size: cover;
  .app-header {
    border-bottom: 1px solid #2f2f31;
  }
  .video {
    display: flex;
    flex-direction: row;
    flex: 1;
  }
  .app-footer {
    border-top: 1px solid #2f2f31;
  }
  .header-fullScreen {
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 100;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    overflow: hidden;
  }
  .footer-fullScreen {
    background-color: rgba(0, 0, 0, 0.5);
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
  }
  
  /* 音乐标签管理面板样式 */
  .music-labels-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    background-color: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
  }
}
</style>
