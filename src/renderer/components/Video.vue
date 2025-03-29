<template>
  <div class="video-container" @contextmenu="contextmenu">
    <transition name="router" mode="out-in">
      <FileInfo @click="isShowInfo=false" :isShow="isShowInfo" :video="videoInfo" />
    </transition>
    <div class="message">
      <p>{{speedMsg}}</p>
      <p>{{volumeMsg}}</p>
      <p>{{playModeMsg}}</p>
    </div>
    <div @click="changePlayingMode" v-show="currentVideo" id="dplayer" class="my-video"></div>
    <div v-show="!currentVideo" class="my-video"></div>
    <div
      :style="{
        'animation-play-state':animationPlayState,
        'background': coverImage ? `url(${coverImage}) no-repeat center center` : `none`,
      }"
      @click="changePlayingMode"
      v-show="isMusic && currentVideo"
      class="music-bg"
    ></div>
    <div
      :style="{'color':theme.textColor,'border': `1px solid ${theme.textColor}`}"
      class="open-file"
      v-if="!currentVideo"
    >
      <div class="flexrowcenter" @click="openFile">
        <span class="fa-solid fa-folder-open"></span>
        <span>{{$t('common.openFile')}}</span>
      </div>
      <span @click.stop="showMenu" class="fa-solid fa-angle-down"></span>
      <transition name="router" mode="out-in">
        <ul :style="{'background-color':theme.bgColor}" v-if="isShowFileMenu" class="my-file">
          <li :class="theme.hover" @click="openFolder">
            <span class="fa-solid fa-file-video"></span>
            {{$t('common.openFolder')}}
          </li>
          <li :class="theme.hover" @click="openUrl">
            <span class="fa-solid fa-link"></span>
            {{$t('common.openUrl')}}
          </li>
        </ul>
      </transition>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations, mapActions } from "vuex";
import OpenDialog from "../api/OpenDialog";
import connect from "../api/bus.js";
import Mousetrap from "mousetrap";
import path from "path";
import "DPlayer/dist/DPlayer.min.css";
import DPlayer from "dplayer";
import { musicReg, musicSuffix } from "../api/util";
import { remote } from "electron";
import fs from "fs";
import { playOrderList, volumePercentList } from "../config";
import { log } from "util";
import jsmediatags from "jsmediatags";
import ShortcutManager from "../api/ShortcutManager";
import userDB from "../api/database";

const openDialog = new OpenDialog();

const { Menu } = remote;

export default {
  name: "elysia-video",
  data() {
    return {
      // 是否显示文件菜单
      isShowFileMenu: false,
      // 左上角音量提示语
      volumeMsg: "",
      // 左上角视频速度提示语
      speedMsg: "",
      // 左上角视频状态提示语
      playModeMsg: "",
      // 判断是否为音乐
      isMusic: false,
      // 动画状态，停止或者播放
      animationPlayState: "running",
      // 是否显示文件信息
      isShowInfo: false,
      // 文件信息
      videoInfo: null,
      // 封面图片 URL
      coverImage: "",
    };
  },
  methods: {
    ...mapMutations([
      "setPlaying",
      "setCurrentVideoIndex",
      "setCurrentTime",
      "setTotalTime",
      "setSpeed",
      "setOldVideo",
      "setCurrentVideo",
      "setFullScreen",
      "setHistoricalRecords",
      "setAlwaysOnTop",
      "setPlayMode",
      "setInWidth"
    ]),
    ...mapActions(["changeVideoList"]),
    // 初始化事件监听
    initListener() {
      // 视频进度条被用户手动改变时，会触发setCurrentTime这个事件
      connect.$on("setCurrentTime", () => {
        this.dp.seek(this.currentTime);
      });
      connect.$on("videoInfo", data => {
        this.videoInfo = data;
        this.isShowInfo = true;
      });
      connect.$on("openUrl", () => {
        this.openUrl();
      });
      connect.$on("captureFrame", () => {
        this.captureVideoFrame();
      });
    },
    // 移除事件监听
    removeListener() {
      connect.$off("setCurrentTime");
      connect.$off("videoInfo");
      connect.$off("openUrl");
      connect.$off("captureFrame");
    },
    // 点击按钮后显示或者隐藏菜单
    showMenu() {
      // 触发一次点击是因为可能还有其他的菜单在显示，此时需要隐藏其他菜单
      if (!this.isShowFileMenu) {
        document.body.click();
      }
      this.isShowFileMenu = !this.isShowFileMenu;
    },
    onClick() {
      // 隐藏菜单
      this.isShowFileMenu = false;
    },
    // 打开文件
    openFile() {
      openDialog.openFile();
    },
    // 视频播放进度改变
    timeupdate() {
      this.setCurrentTime(this.dp.video.currentTime);
      
      // 每30秒保存一次播放历史
      if (Math.floor(this.dp.video.currentTime) % 30 === 0) {
        this.savePlayHistory();
      }
    },
    // 视频长度发生变化
    durationchange() {
      this.setTotalTime(this.dp.video.duration);
    },
    // 当浏览器已加载音频/视频的元数据时,只触发一次，只有在视频发生变化时才触发
    loadedmetadata() {
      // 保存当前视频的总时长
      this.setOldVideo(
        Object.assign({}, this.currentVideo, {
          totalTime: this.dp.video.duration
        })
      );
      // 修改播放状态
      this.setPlaying(true);
      this.dp.play();
      // 还原上一次的播放状态
      this.dp.speed(this.currentVideo.speed);
      this.dp.seek(this.currentVideo.currentTime);
    },
    // 播放或者暂停视频
    changePlayingMode() {
      // 当前没有视频在播放
      if (!this.currentVideo) {
        return;
      }
      this.setPlaying(!this.isPlaying);
    },
    // 视频播放结束
    ended() {
      // 保存播放历史
      this.savePlayHistory();
      
      // 暂停播放
      this.setPlaying(false);
      // 重置进度
      this.setCurrentTime(0);
      switch (this.playMode) {
        // 单个播放
        case 1:
          this.setCurrentVideo(null);
          break;
        // 单个循环
        case 2:
          this.$nextTick(() => {
            this.setPlaying(true);
          });
          break;
        // 循环播放列表
        case 3:
          // 当前视频索引是最后一个
          if (this.videoList.length - 1 == this.currentVideoIndex) {
            // 设置视频索引为第一个
            this.setCurrentVideoIndex(0);
          } else {
            // 否则视频索引加一
            let index = this.currentVideoIndex + 1;
            this.setCurrentVideoIndex(index);
          }
          break;
        // 顺序播放
        case 4:
          // 当前视频索引是最后一个
          if (this.videoList.length - 1 == this.currentVideoIndex) {
            // 设置视频索引为第一个
            this.setCurrentVideo(null);
          } else {
            // 否则视频索引加一
            let index = this.currentVideoIndex + 1;
            this.setCurrentVideoIndex(index);
          }
          break;
        // 随机播放
        case 5:
          // 当播放列表中只有一个视频
          if (this.videoList.length <= 1) {
            this.$nextTick(() => {
              this.setPlaying(true);
            });
          } else {
            // 随机选取一个视频
            let index = Math.floor(Math.random() * this.videoList.length);
            // 随机出来的索引等于当前视频索引
            while (index == this.currentVideoIndex) {
              // 重新生成一个，防止随机的是同一个视频
              index = Math.floor(Math.random() * this.videoList.length);
            }
            this.setCurrentVideoIndex(index);
          }
          break;
      }
    },
    // 加载视频的时候发生错误
    error() {
      console.log("error");
    },
    // 初始化快捷键
    initShortcuts() {
      const shortcutManager = new ShortcutManager();
      
      // 注册打开文件动作
      shortcutManager.registerActionHandler('openFile', () => {
        this.openFile();
      });
      
      // 注册打开文件夹动作
      shortcutManager.registerActionHandler('openFolder', () => {
        this.openFolder();
      });
      
      // 注册打开URL动作
      shortcutManager.registerActionHandler('openUrl', () => {
        this.openUrl();
      });
      
      // 注册截图动作
      shortcutManager.registerActionHandler('captureFrame', () => {
        this.captureVideoFrame();
      });
      
      // 绑定所有快捷键
      shortcutManager.bindShortcut('openFile');
      shortcutManager.bindShortcut('openFolder');
      shortcutManager.bindShortcut('openUrl');
      shortcutManager.bindShortcut('captureFrame');
    },
    // 打开文件夹
    openFolder() {
      openDialog.openFolder();
    },
    // 打开网络地址
    openUrl() {
      this.$prompt(this.$t("common.enterNetworkUrl"), {
        confirmButtonText: this.$t("common.sureBtn"),
        cancelButtonText: this.$t("common.cancelBtn"),
        inputValidator: this.inputValidator,
        inputErrorMessage: this.$t("common.errorNetworkUrl")
      })
        .then(({ value }) => {
          openDialog.openUrl(value);
        })
        .catch(e => {
          console.log(e);
        });
    },
    // 校验url
    inputValidator(e) {
      // 校验url
      if (!e) return false;
      
      // 检查是否已经是完整的URL
      let reg1 = /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/;
      return reg1.test(e);
    },
    // 初始化dplayer播放器
    initDplayer() {
      this.dp = new DPlayer({
        container: document.getElementById("dplayer"),
        hotkey: false
      });
      this.dp.on("timeupdate", this.timeupdate);
      this.dp.on("durationchange", this.durationchange);
      this.dp.on("loadedmetadata", this.loadedmetadata);
      this.dp.on("ended", this.ended);
      this.dp.on("error", this.error);
      this.dp.volume(this.volumePercent);
    },
    // 双击退出全屏
    handelDBClick() {
      if (!this.currentVideo) {
        return;
      }
      if (this.isFullScreen) {
        this.setFullScreen(false);
      } else {
        this.setFullScreen(true);
      }
    },
    speedTimers(msg) {
      if (this.speedTimer) {
        clearTimeout(this.speedTimer);
      }
      this.speedMsg = msg;
      this.speedTimer = setTimeout(() => {
        this.speedMsg = "";
        clearTimeout(this.speedTimer);
      }, 5000);
    },
    volumeTimers(msg) {
      if (this.volumeTimer) {
        clearTimeout(this.volumeTimer);
      }
      this.volumeMsg = msg;
      this.volumeTimer = setTimeout(() => {
        this.volumeMsg = "";
        clearTimeout(this.volumeTimer);
      }, 5000);
    },
    playModeTimers(msg) {
      if (this.playModeTimer) {
        clearTimeout(this.playModeTimer);
      }
      this.playModeMsg = msg;
      this.playModeTimer = setTimeout(() => {
        this.playModeMsg = "";
        clearTimeout(this.playModeTimer);
      }, 5000);
    },
    // 右键菜单
    contextmenu() {
      document.body.click();
      const isother = !volumePercentList.includes(this.volumePercent);
      const playOrderArr = playOrderList.map(item => {
        return {
          label: this.$t(item.label),
          type: "checkbox",
          checked: this.playMode == item.playMode,
          click: () => {
            this.setPlayMode(item.playMode);
          }
        };
      });
      const voiceArr = [];
      volumePercentList.forEach(item => {
        if (item !== 0) {
          voiceArr.push({
            label: `${item * 100}%`,
            type: "checkbox",
            checked: this.volumePercent == item,
            click: () => {
              let inWidth = item * 62;
              this.setInWidth(inWidth);
            }
          });
        }
      });
      let contextMenuTemplate = [
        {
          label: this.$t("common.open"),
          submenu: [
            {
              label: this.$t("common.openFile"),
              click: () => {
                openDialog.openFile();
              }
            },
            {
              label: this.$t("common.openFolder"),
              click: () => {
                openDialog.openFolder();
              }
            },
            {
              label: this.$t("common.openUrl"),
              click: () => {
                this.openUrl();
              }
            }
          ]
        },
        {
          type: "separator"
        },
        {
          label: this.$t("common.winRoof"),
          submenu: [
            {
              label: this.$t("common.never"),
              type: "checkbox",
              checked: !this.isAlwaysOnTop,
              click: () => {
                this.setAlwaysOnTop(false);
              }
            },
            {
              label: this.$t("common.alway"),
              type: "checkbox",
              checked: this.isAlwaysOnTop,
              click: () => {
                this.setAlwaysOnTop(true);
              }
            }
          ]
        },
        {
          type: "separator"
        },
        {
          label: this.$t("common.playList"),
          click: () => {
            connect.$emit("showPlayList");
          }
        },
        {
          label: this.$t("common.playOrder"),
          submenu: playOrderArr
        },
        {
          type: "separator"
        },
        {
          label: this.$t("common.voice"),
          submenu: [
            ...voiceArr,
            {
              label: isother
                ? `${this.$t("common.other")}(${Math.round(
                    this.volumePercent * 100
                  )}%)`
                : this.$t("common.other"),
              type: "checkbox",
              checked: isother
            },
            {
              label: this.$t("common.mute"),
              type: "checkbox",
              checked: this.volumePercent == 0,
              click: () => {
                let inWidth = 0;
                this.setInWidth(inWidth);
              }
            }
          ]
        },
        {
          type: "separator"
        },
        {
          label: this.$t("common.setting")
        }
      ];
      
      // 只有视频在播放时才显示截图选项
      if (this.currentVideo && !this.isMusic) {
        contextMenuTemplate.push({
          label: this.$t("common.captureFrame"),
          click: () => {
            this.captureVideoFrame();
          }
        });
      }
      
      if (this.currentVideo) {
        let addMenu = [
          {
            label: this.isPlaying
              ? this.$t("common.suspend")
              : this.$t("common.play"),
            click: () => {
              this.setPlaying(!this.isPlaying);
            }
          },
          {
            type: "separator"
          }
        ];
        contextMenuTemplate.unshift(...addMenu);

        contextMenuTemplate.splice(4, 0, {
          label: this.isFullScreen
            ? this.$t("common.exitScreen")
            : this.$t("common.fullScreen"),
          click: () => {
            this.setFullScreen(!this.isFullScreen);
          }
        });

        contextMenuTemplate.push({
          label: this.$t("common.fileInfo"),
          click: () => {
            this.videoInfo = this.currentVideo;
            this.isShowInfo = true;
          }
        });
      }
      let m = Menu.buildFromTemplate(contextMenuTemplate);
      Menu.setApplicationMenu(m);
      m.popup({ window: remote.getCurrentWindow() });
    },
    getAudioCover(file) {
      return new Promise((resolve, reject) => {
        jsmediatags.read(file, {
          onSuccess: (tag) => {
            const cover = tag.tags.picture;
            if (cover) {
              const base64String = Buffer.from(cover.data).toString("base64");
              const imageUrl = `data:${cover.format};base64,${base64String}`;
              resolve(imageUrl);
            } else {
              resolve(null); // 没有封面
            }
          },
          onError: (error) => {
            reject(error);
          },
        });
      });
    },
    // 保存播放历史
    savePlayHistory() {
      if (!this.currentVideo || !this.dp) {
        return;
      }
      
      // 获取当前登录用户ID
      const loginStatus = userDB.getLoginStatus();
      const userId = loginStatus.isLoggedIn ? loginStatus.user.id : null;
      
      // 获取视频/音频信息
      const filePath = this.currentVideo.src;
      const fileName = path.basename(filePath);
      const duration = this.dp.video.duration;
      const currentTime = this.dp.video.currentTime;
      
      // 根据文件类型保存到不同的历史记录表
      if (this.isMusic) {
        userDB.saveAudioHistory(userId, filePath, fileName, duration, currentTime);
      } else {
        userDB.saveVideoHistory(userId, filePath, fileName, duration, currentTime);
      }
    },
    
    // 截取当前视频帧
    captureVideoFrame() {
      if (!this.currentVideo || !this.dp || this.isMusic) {
        // 仅在播放视频时可用
        this.$message({
          message: this.$t('common.captureNotAvailable'),
          type: 'warning'
        });
        return;
      }
      
      try {
        // 创建Canvas元素
        const canvas = document.createElement('canvas');
        const video = this.dp.video;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // 将当前视频帧绘制到Canvas
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 将Canvas转换为图片数据
        const imageData = canvas.toDataURL('image/png');
        
        // 使用Electron的剪贴板API复制图片
        const { clipboard } = remote;
        
        // 从data URL创建一个Electron NativeImage
        const nativeImage = remote.nativeImage.createFromDataURL(imageData);
        
        // 将图像复制到剪贴板
        clipboard.writeImage(nativeImage);
        
        // 显示成功消息
        this.$message({
          message: this.$t('common.frameCaptured'),
          type: 'success'
        });
      } catch (error) {
        console.error('截图失败:', error);
        this.$message({
          message: this.$t('common.captureError'),
          type: 'error'
        });
      }
    },
  },
  mounted() {
    window.addEventListener("click", this.onClick);
    this.initDplayer();
    this.initShortcuts();
    this.initListener();
    connect.$on("setCurrentTime", () => {
      if (!this.dp || !this.currentVideo) {
        return;
      }
      this.dp.seek(this.currentTime);
    });
  },
  computed: {
    ...mapGetters([
      "currentVideo",
      "isPlaying",
      "videoList",
      "currentTime",
      "speed",
      "oldVideo",
      "inWidth",
      "volumePercent",
      "playMode",
      "currentVideoIndex",
      "isFullScreen",
      "isAlwaysOnTop",
      "theme",
      "isTrace"
    ])
  },
  watch: {
    isMusic(newVal) {
      // 通知Footer组件音乐状态变化
      connect.$emit("musicStateChanged", newVal);
    },
    isPlaying(newVal) {
      // 同步video和store中的isPlaying的状态
      this.$nextTick(() => {
        if (newVal) {
          this.isMusic && (this.animationPlayState = "running");
          this.playModeTimers(this.$t("common.play"));
          this.dp.play();
        } else {
          this.isMusic && (this.animationPlayState = "paused");
          this.playModeTimers(this.$t("common.suspend"));
          this.dp.pause();
        }
      });
    },
    currentVideo: {
      immediate: true,
      handler: function(newVal, oldVal) {
        this.$nextTick(() => {
          // 没有开启无痕模式
          if (!this.isTrace) {
            // 当前视频发生变化时把旧的视频覆盖掉播放列表中对应的视频
            this.changeVideoList(
              Object.assign({}, this.oldVideo, {
                currentTime: this.currentTime,
                speed: this.speed
              })
            );
            // 历史记录
            if (oldVal) {
              this.setHistoricalRecords(
                Object.assign({}, this.oldVideo, {
                  currentTime: this.currentTime,
                  speed: this.speed
                })
              );
            }
          }
          // 新的视频不为空
          if (newVal) {
            // 播放文件不存在,网络文件除外
            if (!fs.existsSync(newVal.src) && newVal.mode == "local") {
              // 清空当前正在播放的视频
              this.setCurrentVideo(null);
              // 停止播放
              this.setPlaying(false);
              // 保存文件错误信息
              let video = Object.assign({}, newVal, { msg: "无效文件" });
              this.setOldVideo(Object.assign({}, video));
              // 修改播放列表
              this.changeVideoList(video);
              return;
            }
            // 获取该视频以前的播放进度
            this.setCurrentTime(newVal.currentTime);
            // 获取该视频以前的视频速度
            this.setSpeed(newVal.speed);
            // 找出新的视频在播放列表中的索引
            const index = this.videoList.findIndex(i => i.id == newVal.id);
            // 设置视频的索引
            this.setCurrentVideoIndex(index);

            if (this.dp) {
              this.initDplayer();
            }
            // 获取后缀名
            let extname = path.extname(newVal.src);
            console.log("extname: ", extname);
            this.isMusic = musicSuffix.includes(extname);
            console.log("isMusic: ", this.isMusic);
            // 如果是音乐文件，加载封面
            const loadCoverImage = async () => {
                // 如果是音乐文件，加载封面
                if (this.isMusic) {
                  try {
                    const file = newVal.mode === "local" ? newVal.src : newVal.src;
                    const imageUrl = await this.getAudioCover(file); // 使用 await
                    this.coverImage = imageUrl || require("../assets/musicBg.jpg");
                    console.log("coverImage: ", this.coverImage);
                    } catch (error) {
                      console.error("Failed to load cover:", error);
                      this.coverImage = require("../assets/musicBg.jpg");
                    }
                    } else {
                      this.coverImage = ""; // 不是音乐文件，清空封面
                    }
                };
            loadCoverImage();
            // 切换视频,校验文件是本地文件还是网络文件
            let url;
            console.log("Video mode:", newVal.mode);
            
            if (newVal.mode === "url") {
              // 网络视频直接使用URL
              url = newVal.src;
              console.log("网络视频URL:", url);
            } else {
              // 本地视频通过express服务器加载
              url = `http://localhost:6789/video?video=${encodeURIComponent(newVal.src)}`;
              console.log("本地视频URL:", url);
            }

            // 切换视频
            this.dp.switchVideo({ url });
            if (!this.isTrace) {
              // 设置播放历史记录
              this.setHistoricalRecords(newVal);
            }
          } else {
            this.coverImage = ""; // 没有视频，清空封面
            this.dp.switchVideo({
              url: ""
            });
          }
        });
      }
    },
    speed: {
      immediate: true,
      handler: function(newVal) {
        // 视频速度发生变化时修改video的速度
        this.$nextTick(() => {
          if (newVal > 1) {
            this.speedTimers(
              `${this.$t("common.playback")}(Ctrl+Up): ${newVal}${this.$t(
                "common.times"
              )}(${this.$t("common.reset")})`
            );
          } else if (newVal < 1) {
            this.speedTimers(
              `${this.$t(
                "common.deceleration"
              )}(ctrl+down): ${newVal}${this.$t("common.times")} (${this.$t(
                "common.reset"
              )})`
            );
          } else if (newVal == 1) {
            this.speedTimers(
              `${this.$t("common.normalSpeed")}:1.0${this.$t(
                "common.times"
              )}(${this.$t("common.reset")})`
            );
          }
          this.dp.speed(newVal);
        });
      }
    },
    volumePercent: {
      // 立刻触发是因为需要在播放器初始化时初始化音量
      immediate: true,
      handler: function(newVal) {
        this.$nextTick(() => {
          this.volumeTimers(
            `${this.$t("common.volume")}: ${Math.round(newVal * 100)}%`
          );
          this.dp.volume(newVal);
        });
      }
    }
  },
  beforeDestroy() {
    window.removeEventListener("click", this.onClick);
    if (this.volumeTimer) {
      clearTimeout(this.volumeTimer);
    }
    this.dp.destroy();
    this.removeListener();
    connect.$off("musicStateChanged");
  }
};
</script>

<style lang="less" scoped>
.video-container {
  flex: 1;
  position: relative;
  .message {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    color: #ffffff;
  }
}
.my-video {
  width: 100%;
  height: 100%;
  vertical-align: top;
}
.music-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 400px;
  height: 400px;
  margin-top: -200px;
  margin-left: -200px;
  /*background: url("../assets/musicBg.jpg") no-repeat center center;*/
  background-size: cover;
  border-radius: 40%;
  animation: rotate 10s;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
}
.open-file {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 150px;
  height: 40px;
  border-radius: 40px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  padding: 5px;
  .my-file {
    z-index: -1;
    position: absolute;
    top: 45px;
    left: 0;
    width: 100%;
    border-radius: 5px;
    &:before {
      content: "";
      height: 0;
      width: 0;
      position: absolute;
      top: -10px;
      left: 23px;
      border: 5px solid transparent;
      border-bottom-color: greenyellow;
    }
    > li {
      width: 100%;
      height: 40px;
      padding: 10px 15px;
      color: #878788;
      cursor: pointer;
      &:hover {
        border-radius: 5px;
        color: #5dee00;
      }
    }
  }
  > div {
    cursor: pointer;
    span:nth-child(1) {
      padding-right: 10px;
    }
    &:hover {
      color: #5dee00;
    }
  }
  > span {
    font-size: 20px;
    border-left: 1px solid #818181;
    padding-left: 10px;
    cursor: pointer;
    &:hover {
      color: #5dee00;
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>