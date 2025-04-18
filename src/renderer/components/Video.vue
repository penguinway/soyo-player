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
      v-show="isMusic && currentVideo && !showLyrics"
      class="music-bg"
    ></div>
    <lyric-display
      v-if="isMusic && currentVideo"
      :visible="showLyrics"
      :current-time="currentTime"
      :lrc-content="lrcContent"
    />
    <div class="lyric-toggle" v-if="isMusic && currentVideo && !isSettingsVisible" @click="toggleLyrics">
      <span class="fa-solid" :class="showLyrics ? 'fa-music' : 'fa-align-left'"></span>
      <span>{{ showLyrics ? $t('common.showCover') : $t('common.showLyrics') }}</span>
    </div>
    
    <!-- 音乐标签展示区域 -->
    <div class="music-tags-container" v-if="isMusic && currentVideo && musicLabels.length > 0 && !isSettingsVisible">
      <div class="music-tags">
        <span class="tag" v-for="(tag, index) in musicLabels.slice(0, 3)" :key="index">
          {{ tag }}
        </span>
        <span class="more-tags" v-if="musicLabels.length > 3" @click="showMusicInfo">
          +{{ musicLabels.length - 3 }}
        </span>
      </div>
    </div>
    
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
import LyricDisplay from "./LyricDisplay.vue";
import MusicLabelService from "../api/MusicLabelService";
import { translateMusicLabel } from "../api/musicLabelMapping";

const openDialog = new OpenDialog();

const { Menu } = remote;

export default {
  name: "elysia-video",
  components: {
    LyricDisplay
  },
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
      // 歌词内容
      lrcContent: "",
      // 是否显示歌词
      showLyrics: false,
      // 音乐标签数组 - 原始英文标签
      musicLabelsOriginal: [],
      // 音乐标签数组 - 转换后的中文标签
      musicLabels: [],
      // 是否显示设置页面
      isSettingsVisible: false,
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
    
    // 加载歌词
    async loadLyrics(filePath) {
      if (!filePath || !this.isMusic) {
        this.lrcContent = "";
        return;
      }
      
      try {
        // 处理音乐文件标签信息
        try {
          console.log('开始处理音乐标签信息:', filePath);
          const musicLabelInfo = await MusicLabelService.processMusicFile(filePath);
          if (musicLabelInfo && musicLabelInfo.style_label) {
            console.log("获取到音乐风格标签原始数据:", musicLabelInfo.style_label);
            
            // 尝试解析JSON格式标签
            try {
              const originalLabels = JSON.parse(musicLabelInfo.style_label);
              console.log("解析后的音乐标签数组:", originalLabels);
              
              // 先转换为中文标签
              const chineseLabels = this.translateMusicLabels(originalLabels);
              console.log("转换后的中文标签:", chineseLabels);
              
              // 发送中文标签到其他组件
              connect.$emit("musicLabelsUpdated", chineseLabels);
              
              // 同时保存原始标签，以便后续使用
              this.musicLabelsOriginal = originalLabels;
            } catch (e) {
              // 如果不是JSON格式，先转换为中文，再发送
              console.log("非JSON格式的标签，转换后使用:", musicLabelInfo.style_label);
              const originalLabel = musicLabelInfo.style_label;
              const chineseLabel = translateMusicLabel(originalLabel);
              
              // 拆分为数组并发送
              const chineseLabels = chineseLabel.split('，').filter(Boolean);
              connect.$emit("musicLabelsUpdated", chineseLabels);
              
              // 保存原始标签
              this.musicLabelsOriginal = [originalLabel];
            }
          } else {
            console.log("没有获取到音乐风格标签或标签为空");
            // 清空标签
            this.musicLabelsOriginal = [];
            this.musicLabels = [];
            connect.$emit("musicLabelsUpdated", []);
          }
        } catch (labelError) {
          console.error("处理音乐标签信息失败:", labelError);
        }
        
        // 获取歌词文件路径（与音频文件同名但扩展名为.lrc）
        const dirPath = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        
        // 尝试不同大小写的LRC扩展名
        const lrcVariants = [
          path.join(dirPath, `${baseName}.lrc`),
          path.join(dirPath, `${baseName}.LRC`),
          path.join(dirPath, `${baseName}.Lrc`)
        ];
        
        // 检查所有可能的LRC文件路径
        for (const lrcPath of lrcVariants) {
          if (fs.existsSync(lrcPath)) {
            try {
              // 尝试使用UTF-8编码读取
              const content = fs.readFileSync(lrcPath, 'utf-8');
              this.lrcContent = content;
              console.log('已加载本地歌词文件');
              return;
            } catch (encodingError) {
              console.warn('UTF-8编码读取失败，尝试其他编码:', encodingError.message);
              try {
                // 如果UTF-8失败，尝试使用GBK/GB18030编码
                const iconv = require('iconv-lite');
                const buffer = fs.readFileSync(lrcPath);
                const content = iconv.decode(buffer, 'gbk');
                this.lrcContent = content;
                console.log('已加载本地歌词文件(GBK编码)');
                return;
              } catch (gbkError) {
                console.error('GBK编码读取也失败:', gbkError.message);
              }
            }
          }
        }
        
        // 如果没有找到本地歌词文件，尝试从网络获取
        console.log('未找到本地歌词文件，尝试从网络获取');
        
        // 从文件名中提取歌曲标题和艺术家信息
        let title = baseName;
        let artist = '';
        
        // 尝试从文件名中分离艺术家和标题（常见格式：艺术家 - 标题）
        const nameMatch = baseName.match(/(.+)\s*-\s*(.+)/);
        if (nameMatch) {
          artist = nameMatch[1].trim();
          title = nameMatch[2].trim();
        }
        
        // 导入MusicMetadataService
        const metadataService = require('../api/MusicMetadataService').default;
        
        // 尝试获取在线歌词
        const lyricsInfo = await metadataService.getOnlineLyrics(title, artist);
        if (lyricsInfo && lyricsInfo.lyrics) {
          this.lrcContent = lyricsInfo.lyrics;
          console.log('已加载在线歌词');
          return;
        }
        
        // 如果在线歌词也获取失败，设置为空
        console.log('在线歌词获取失败');
        this.lrcContent = "";
      } catch (error) {
        console.error('加载歌词失败:', error);
        this.lrcContent = "";
      }
    },
    
    // 切换歌词/封面显示
    toggleLyrics() {
      this.showLyrics = !this.showLyrics;
    },
    
    // 显示音乐信息
    showMusicInfo() {
      if (this.isMusic && this.currentVideo) {
        connect.$emit("showMusicInfo");
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
    // 转换音乐标签为中文
    translateMusicLabels(labels) {
      if (!labels || !Array.isArray(labels) || labels.length === 0) {
        console.log('无标签或标签格式不正确，无需转换');
        return [];
      }
      
      console.log('开始转换音乐标签，原始标签:', labels);
      
      // 获取中文标签文本
      const chineseLabelsText = translateMusicLabel(labels);
      console.log('转换后的中文标签文本:', chineseLabelsText);
      
      // 将中文标签文本分割为数组
      const chineseLabels = chineseLabelsText.split('，').filter(Boolean);
      console.log('转换后的中文标签数组:', chineseLabels);
      
      return chineseLabels;
    },
    // 处理音乐标签
    async processMusicTag(filePath) {
      try {
        // 处理音乐文件标签
        await MusicLabelService.processMusicFile(filePath);
        console.log('已处理音乐标签:', path.basename(filePath));
        
        // 处理完成后静默提示，不干扰用户体验
        // 由于每次播放都会处理，因此不显示消息弹窗
      } catch (error) {
        console.error('处理音乐标签失败:', error);
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
    
    // 监听音乐标签更新事件
    connect.$on("musicLabelsUpdated", (labels) => {
      console.log("Video组件收到音乐标签更新:", labels);
      // 保存原始标签
      this.musicLabelsOriginal = labels;
      // 转换为中文标签
      this.musicLabels = this.translateMusicLabels(labels);
      console.log("转换后的中文标签:", this.musicLabels);
    });
    
    // 监听设置页面显示状态变化
    connect.$on("settingsVisibilityChanged", (isVisible) => {
      console.log("设置页面显示状态:", isVisible);
      this.isSettingsVisible = isVisible;
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
            // 如果是音乐文件，加载封面和歌词
            const loadMusicData = async () => {
                // 如果是音乐文件，加载封面和歌词
                if (this.isMusic) {
                  try {
                    const file = newVal.mode === "local" ? newVal.src : newVal.src;
                    // 加载封面
                    const imageUrl = await this.getAudioCover(file);
                    this.coverImage = imageUrl || require("../assets/musicBg.jpg");
                    console.log("coverImage: ", this.coverImage);
                    
                    // 加载歌词
                    this.loadLyrics(file);
                    
                    // 处理音乐标签，将文件添加到标签数据库
                    this.processMusicTag(file);
                  } catch (error) {
                    console.error("Failed to load music data:", error);
                    this.coverImage = require("../assets/musicBg.jpg");
                    this.lrcContent = "";
                  }
                } else {
                  this.coverImage = ""; // 不是音乐文件，清空封面
                  this.lrcContent = ""; // 清空歌词
                  this.showLyrics = false; // 隐藏歌词显示
                }
            };
            loadMusicData();
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
    connect.$off("musicLabelsUpdated");
    connect.$off("settingsVisibilityChanged");
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
  .lyric-toggle {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background-color: rgba(0, 0, 0, 0.5);
    color: #ffffff;
    padding: 8px 12px;
    border-radius: 20px;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    transition: all 0.3s;
    
    span:first-child {
      margin-right: 5px;
    }
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.7);
    }
  }
  
  .music-tags-container {
    position: absolute;
    bottom: 20px;
    left: 20px;
    z-index: 10;
    max-width: 300px;
    
    .music-tags {
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      
      .tag {
        background-color: rgba(255, 255, 255, 0.2);
        color: white;
        padding: 4px 10px;
        border-radius: 15px;
        font-size: 12px;
        margin-right: 5px;
        white-space: nowrap;
        transition: all 0.3s;
        border: 1px solid rgba(255, 255, 255, 0.4);
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        
        &:hover {
          background-color: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
      }
      
      .more-tags {
        font-size: 12px;
        color: white;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 12px;
        background-color: rgba(0, 0, 0, 0.5);
        transition: all 0.3s;
        
        &:hover {
          background-color: rgba(0, 0, 0, 0.7);
        }
      }
    }
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