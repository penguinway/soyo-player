<template>
  <div class="footer-container">
    <div v-if="currentVideo" class="video-progress">
      <video-progress />
    </div>
    <div class="footer">
      <div class="left">
        <span @click="openFile" :title="$t('common.openFile')" class="fa-regular fa-folder-open hover-effect"></span>
        <span :title="title" @click.stop="showPlayMode" class="fa-solid fa-bars hover-effect"></span>
        <span v-if="currentVideo" class="video-time">{{getCurrentTime}} / {{getTotalTime}}</span>
        <transition name="router" mode="out-in">
          <ul class="play-mode menu" v-if="isShowPlayMode">
            <li
              v-for="(item,index) in playModeList"
              :key="index"
              class="menu-item"
              :class="{'selected': playMode==item.playMode}"
              @click="changeMode(item.playMode)"
            >
              <span v-if="playMode==item.playMode" class="fa-solid fa-check"></span>
              {{item.title}}
            </li>
          </ul>
        </transition>
      </div>
      <div class="middle">
        <span
          :class="{'disabled-button': !currentVideo}"
          :title="$t('common.stop')"
          class="fa-regular fa-circle-stop hover-effect"
          @click="stop"
        ></span>
        <span
          :class="{'disabled-button': videoList.length<=1}"
          @click="prev"
          :title="$t('common.previous')"
          class="fa-solid fa-backward-step hover-effect"
        ></span>
        <span
          @click.stop="switchPlaying(true)"
          v-if="!isPlaying"
          :title="$t('common.play')"
          class="fa-solid fa-circle-play hover-effect"
          style="font-size: 50px;"
        ></span>
        <span
          v-if="isPlaying"
          :title="$t('common.suspend')"
          class="fa-solid fa-circle-pause hover-effect"
          style="font-size: 50px;"
          @click.stop="switchPlaying(false)"
        ></span>
        <span
          :class="{'disabled-button': videoList.length<=1}"
          @click="next"
          :title="$t('common.next')"
          class="fa-solid fa-forward-step hover-effect"
        ></span>
        <span
          :title="$t('common.mute')"
          v-if="isVolumeOn"
          style="width: 40px;height: 20px;"
          @click.stop="setVolume(false)"
          class="fa-solid fa-volume-high hover-effect"
        ></span>
        <span
          :title="$t('common.cancelMute')"
          v-if="!isVolumeOn"
          style="width: 40px;height: 20px;"
          @click.stop="setVolume(true)"
          class="fa-solid fa-volume-off hover-effect"
        ></span>
        <my-progress ref="progress" width="62px" />
      </div>
      <div class="right">
        <span
          v-if="isMusic && currentVideo"
          :title="$t('common.musicinfo')"
          class="fa-solid fa-music hover-effect"
          :class="{'active-button': isMusic}"
          @click="showMusicInfo"
        ></span>
        <span
          :title="$t('common.noTraceMode')"
          class="fa-solid fa-ghost hover-effect"
          :class="{'active-button': isTrace}"
          @click="noTrace"
        ></span>
        <theme-switcher />
        <span
          :class="{'disabled-button': !currentVideo}"
          @click="fullScreen"
          :title="isFullScreen?$t('common.exitScreen'):$t('common.fullScreen')"
          class="fa-solid fa-expand my-expand hover-effect"
        ></span>
      </div>
    </div>
    <!-- 音乐信息弹窗组件 -->
    <music-info :isShow="isMusicInfoVisible" :music="musicMetadata" @close="isMusicInfoVisible = false" />
  </div>
</template>

<script>
import { mapMutations, mapGetters } from "vuex";
import { formatTime } from "../api/util";
import Mousetrap from "mousetrap";
import OpenDialog from "../api/OpenDialog";
import connect from "../api/bus";
import ShortcutManager from "../api/ShortcutManager";
import { themeManager } from '../theme';
import ThemeSwitcher from './ThemeSwitcher.vue';
import MusicInfo from './MusicInfo.vue';
import MusicMetadataService from '../api/MusicMetadataService';

const openDialog = new OpenDialog();

export default {
  name: "elysia-footer",
  components: {
    ThemeSwitcher,
    MusicInfo
  },
  data() {
    return {
      isShowPlayMode: false,
      theme: themeManager.getCurrentTheme(),
      isMusic: false,
      isMusicInfoVisible: false,
      musicMetadata: {}
    };
  },
  mounted() {
    this.initShortcuts();
    window.addEventListener("click", this.onClick);
    connect.$on("deleteCurrentVideo", () => {
      this.stop();
    });
    connect.$on("themeChanged", (newTheme) => {
      this.theme = newTheme;
    });
    
    // 监听音乐状态变化
    connect.$on("musicStateChanged", (isMusicState) => {
      this.isMusic = isMusicState;
      
      // 当状态变为音乐时，预加载元数据
      if (isMusicState && this.currentVideo) {
        this.loadMusicMetadata();
      }
    });
  },
  methods: {
    ...mapMutations([
      "setIsVolumeOn",
      "setPlaying",
      "setPlayMode",
      "setCurrentVideo",
      "setCurrentVideoIndex",
      "setFullScreen",
      "setSpeed",
      "setOldVideo",
      "setTrace"
    ]),
    // 点击音量图标，开启或者关闭
    setVolume(flag) {
      // 音量一开始0，再点一次恢复还是0，音量图标应该还是关闭
      if (
        flag &&
        this.volumePercent == 0 &&
        this.$refs.progress.oldInWidth == 0
      ) {
        return;
      }
      this.setIsVolumeOn(flag);
    },
    // 切换播放状态，播放或者暂停
    switchPlaying(flag) {
      if (flag && !this.currentVideo) {
        //播放状态，但是当前没有视频被暂停
        if (this.videoList.length == 0) {
          return;
        }
        if (this.oldVideo) {
          //点击停止按钮后，被停止前的视频被保存下来
          // 把被保存的视频设置为当前播放的视频，即还原被停止前的视频状态
          this.setCurrentVideo(this.oldVideo);
        } else {
          //没有视频被保存下来
          // 把播放列表中的第一项设置为当前播放的视频
          this.setCurrentVideo(this.videoList[0]);
        }
      }
      // 设置播放状态
      this.setPlaying(flag);
    },
    // 切换播放模式
    changeMode(mode) {
      this.setPlayMode(mode);
    },
    // 显示或者隐藏播放模式列表
    showPlayMode(e) {
      if (!this.isShowPlayMode) {
        document.body.click();
      }
      // 选择完播放模式后就隐藏播放模式列表菜单
      this.isShowPlayMode = !this.isShowPlayMode;
    },
    onClick() {
      // 隐藏播放模式列表菜单
      this.isShowPlayMode = false;
    },
    // 停止播放
    stop() {
      // 当前没有视频正在播放
      if (!this.currentVideo) {
        return;
      }
      if (!this.isTrace) {
        // 保存当前视频
        this.setOldVideo(
          Object.assign({}, this.currentVideo, {
            currentTime: this.currentTime
          })
        );
      }
      // 清空当前正在播放的视频
      this.setCurrentVideo(null);
      // 停止播放
      this.setPlaying(false);
      // 退出全屏
      if (this.isFullScreen) {
        this.setFullScreen(false);
      }
    },
    // 下一个视频
    next() {
      // 当播放列表中只有一个视频或者没有
      if (this.videoList.length <= 1) {
        return;
      }
      // 随机播放模式
      if (this.playMode == 5) {
        // 随机选取一个视频
        let index = Math.floor(Math.random() * this.videoList.length);
        // 随机出来的索引等于当前视频索引
        while (index == this.currentVideoIndex) {
          // 重新生成一个，防止随机的是同一个视频
          index = Math.floor(Math.random() * this.videoList.length);
        }
        // 设置视频索引
        this.setCurrentVideoIndex(index);
        return;
      }
      // 当前视频索引是最后一个
      if (this.videoList.length - 1 == this.currentVideoIndex) {
        // 设置视频索引为第一个
        this.setCurrentVideoIndex(0);
      } else {
        // 否则视频索引加一
        let index = this.currentVideoIndex + 1;
        this.setCurrentVideoIndex(index);
      }
    },
    // 上一个视频
    prev() {
      // 当播放列表中只有一个视频或者没有
      if (this.videoList.length <= 1) {
        return;
      }
      // 随机播放模式
      if (this.playMode == 5) {
        // 随机选取一个视频
        let index = Math.floor(Math.random() * this.videoList.length);
        while (index == this.currentVideoIndex) {
          index = Math.floor(Math.random() * this.videoList.length);
        }
        this.setCurrentVideoIndex(index);
        return;
      }
      if (this.currentVideoIndex == 0) {
        //当前视频索引是第一个
        // 设置当前视频索引的最后一个
        this.setCurrentVideoIndex(this.videoList.length - 1);
      } else {
        // 视频索引减一
        let index = this.currentVideoIndex - 1;
        this.setCurrentVideoIndex(index);
      }
    },
    // 进入或者退出全屏
    fullScreen() {
      if (!this.currentVideo) {
        return;
      }
      this.setFullScreen(!this.isFullScreen);
    },
    // 监听空格键
    onSpaceKeyUp() {
      if (!this.currentVideo) {
        return;
      }
      this.switchPlaying(!this.isPlaying);
    },
    // 监听esc键
    onEscKeyUp() {
      if (!this.currentVideo) {
        return;
      }
      if (this.isFullScreen == true) {
        this.setFullScreen(false);
      }
    },
    // 监听ctrl+r组合键
    onCtrlAndRKeyUp() {
      if (!this.currentVideo && this.speed == 1) {
        return;
      }
      this.setSpeed(1);
    },
    // 初始化快捷键
    initShortcuts() {
      const shortcutManager = new ShortcutManager();
      
      // 注册播放/暂停动作
      shortcutManager.registerActionHandler('togglePlay', () => {
        this.onSpaceKeyUp();
      });
      
      // 注册退出全屏动作
      shortcutManager.registerActionHandler('exitFullScreen', () => {
        this.onEscKeyUp();
      });
      
      // 注册重置播放速度动作
      shortcutManager.registerActionHandler('resetSpeed', () => {
        this.onCtrlAndRKeyUp();
      });

      // 注册全屏动作
      shortcutManager.registerActionHandler('fullScreen', () => {
        this.fullScreen();
      });

      // 注册停止动作
      shortcutManager.registerActionHandler('stop', () => {
        this.stop();
      });

      // 注册上一个动作
      shortcutManager.registerActionHandler('prev', () => {
        this.prev();
      });

      // 注册下一个动作
      shortcutManager.registerActionHandler('next', () => {
        this.next();
      });

      // 注册静音动作
      shortcutManager.registerActionHandler('mute', () => {
        this.setIsVolumeOn(!this.isVolumeOn);
      });

      // 注册无痕模式动作
      shortcutManager.registerActionHandler('noTrace', () => {
        this.noTrace();
      });
      
      // 绑定所有快捷键
      shortcutManager.bindShortcut('togglePlay');
      shortcutManager.bindShortcut('exitFullScreen');
      shortcutManager.bindShortcut('resetSpeed');
      shortcutManager.bindShortcut('fullScreen');
      shortcutManager.bindShortcut('stop');
      shortcutManager.bindShortcut('prev');
      shortcutManager.bindShortcut('next');
      shortcutManager.bindShortcut('mute');
      shortcutManager.bindShortcut('noTrace');
    },
    // 打开文件
    openFile() {
      openDialog.openFile();
    },
    // 开启无痕模式
    noTrace() {
      const currentState = this.isTrace;
      const newState = !currentState;
      const title = this.$t('common.tip');
      const message = newState 
        ? this.$t('common.noTrace.enableConfirm') 
        : this.$t('common.noTrace.disableConfirm');
      
      this.$confirm(message, title, {
        confirmButtonText: this.$t('common.ok'),
        cancelButtonText: this.$t('common.cancel'),
        type: 'warning'
      }).then(() => {
        // 用户确认，切换无痕模式状态
        this.setTrace(newState);
      }).catch(() => {
        // 用户取消，不做任何操作
      });
    },
    // 显示音乐信息
    showMusicInfo() {
      if (!this.isMusic || !this.currentVideo) return;
      
      // 如果元数据未加载，需要加载
      if (!this.musicMetadata || !this.musicMetadata.title) {
        this.loadMusicMetadata();
      }
      
      // 显示音乐信息组件
      this.isMusicInfoVisible = true;
    },
    // 加载音乐元数据
    loadMusicMetadata() {
      if (!this.currentVideo) return;
      
      // 显示加载中状态
      this.musicMetadata = { title: '加载中...' };
      
      // 使用MusicMetadataService获取元数据
      MusicMetadataService.getMetadata(this.currentVideo.src)
        .then(metadata => {
          this.musicMetadata = metadata;
        })
        .catch(error => {
          console.error('获取音乐元数据失败:', error);
          this.musicMetadata = { 
            title: '未知歌曲',
            artist: '未知艺术家',
            error: '无法加载元数据'
          };
        });
    }
  },
  computed: {
    ...mapGetters([
      "isVolumeOn",
      "isPlaying",
      "currentVideo",
      "playMode",
      "currentVideoIndex",
      "videoList",
      "playMode",
      "oldVideo",
      "currentTime",
      "totalTime",
      "isFullScreen",
      "volumePercent",
      "isTrace"
    ]),
    title() {
      if (this.playMode == 1) {
        return this.$t('common.singlePlay');
      } else if (this.playMode == 2) {
        return this.$t('common.singleCycle');
      } else if (this.playMode == 5) {
        return this.$t('common.randomPlay');
      }
    },
    // 当前视频播放状态
    getCurrentTime() {
      // 格式化事件
      return formatTime(this.currentTime);
    },
    // 当前视频总时长
    getTotalTime() {
      // 格式化时间
      return formatTime(this.totalTime);
    },
    // 播放模式列表
    playModeList(){
      return [
        { title: this.$t('common.singlePlay'), playMode: 1 },
        { title: this.$t('common.singleCycle'), playMode: 2 },
        { title: this.$t('common.loopList'), playMode: 3 },
        { title: this.$t('common.sequentialPlay'), playMode: 4 },
        { title: this.$t('common.randomPlay'), playMode: 5 }
      ]
    }
  },
  watch: {
    currentVideoIndex(newVal) {
      if (newVal == null || newVal == -1) {
        return;
      }
      if (!this.oldVideo) {
        // 设置当前播放的视频
        this.setCurrentVideo(this.videoList[newVal]);
        this.setPlaying(true);
        return;
      }
      // 视频索引发生变化时查找出索引对应的视频
      const currentVideo = this.videoList[newVal];
      // 判断是否为同一首歌，排序可能会使当前歌曲索引改变
      if (this.oldVideo.id == currentVideo.id) {
        return;
      }
      // 设置当前播放的视频
      this.setCurrentVideo(currentVideo);
    },
    videoList(newVal) {
      if (newVal.length == 0) {
        this.stop();
        this.setOldVideo(null);
      }
    },
    currentVideo(newVal) {
      // 当前视频发生变化时，如果是音乐，预加载元数据
      if (newVal && this.isMusic) {
        this.loadMusicMetadata();
      }
    }
  },
  beforeDestroy() {
    window.removeEventListener("click", this.onClick);
    connect.$off("deleteCurrentVideo");
    connect.$off("themeChanged");
    connect.$off("musicStateChanged");
  }
};
</script>

<style scoped lang="less">
.footer-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  .video-progress {
    width: 100%;
    padding: 0 5px;
  }
}

.footer {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 10px 10px;
  position: relative;
  width: 100%;
  span {
    font-size: 18px;
    color: var(--textColor);
    cursor: pointer;
    &:hover:not(.video-time):not(.disabled-button) {
      color: var(--primaryColor);
    }
    &.video-time {
      font-size: 14px;
      max-height: 19px;
      width: 150px;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      left: 80px;
    }
    &.disabled-button {
      color: var(--disabledColor);
      cursor: not-allowed;
    }
    &.active-button {
      color: var(--primaryColor);
    }
  }
  .left {
    display: flex;
    flex-direction: row;
    align-items: center;
    position: relative;
    span {
      padding: 0 10px;
    }
    .play-mode {
      position: absolute;
      left: 7px;
      top: -167px;
      width: 100px;
      padding: 3px 0;
      border-radius: 5px;
      z-index: 1000;
      &:after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: -10px;
        height: 0;
        width: 0;
        border: 5px solid transparent;
        border-top-color: var(--menuBgColor);
      }
      > li {
        height: 30px;
        text-align: center;
        line-height: 30px;
        font-size: 12px;
        cursor: pointer;
        &:hover {
          color: var(--menuSelectedColor);
          > span {
            color: var(--menuSelectedColor);
          }
        }
        > span {
          font-size: 10px;
          padding: 0;
          margin-left: -10px;
        }
      }
    }
  }
  .middle {
    display: flex;
    flex-direction: row;
    align-items: center;
    position: relative;
    z-index: 10;
    span {
      padding: 0 10px;
    }
    .progress {
      background-color: #cccccc;
    }
  }
  .right {
    display: flex;
    flex-direction: row;
    align-items: center;
    span {
      padding: 0 10px;
    }
  }
}

.my-expand {
  transform: rotate(90deg);
}
</style>