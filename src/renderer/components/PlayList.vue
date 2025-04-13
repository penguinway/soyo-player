<template>
  <div
    ref="playList"
    :id="currentVideo&&!isLock?'position':''"
    class="playList"
    :style="{'height':currentVideo?`${playListHeight}px`:'100%','color':theme.textColor}"
  >
    <div class="my-arrow" v-show="isShowArrow">
      <span
        @click="hideList"
        v-show="!isHidenList&&!currentVideo"
        :title="$t('common.packUpList')"
        class="fa-solid fa-circle-arrow-right"
      ></span>
      <span
        @click="hideList"
        v-show="!isHidenList&&isFullScreen"
        :title="$t('common.packUpList')"
        class="fa-solid fa-circle-arrow-right"
      ></span>
      <span
        @click="hideList"
        v-show="isHidenList"
        :title="$t('common.unrollList')"
        class="fa-solid fa-circle-arrow-left"
      ></span>
      <span
        @click="lockList"
        v-show="currentVideo&&!isLock&&!isHidenList&&!isFullScreen"
        class="fa-solid fa-lock"
        :title="$t('common.lockList')"
      ></span>
      <span
        @click="unLockList"
        v-show="currentVideo&&isLock&&!isHidenList"
        class="fa-solid fa-lock-open"
        :title="$t('common.releaseList')"
      ></span>
    </div>
    <div class="content-container" v-show="!isHidenList">
      <div class="top">
        <span>{{$t('common.playList')}}</span>
        <div class="my-icon">
          <span
            @click.stop="showExtendMenu"
            :title="$t('common.extensionMenu')"
            class="fa-solid fa-angle-down"
          ></span>
        </div>
        <div class="file" v-show="isShowOther && videoList.length == 0">
          <div class="no-file">
            <span class="fa-solid fa-file"></span>
            <p>{{$t('common.noDocuments')}}</p>
          </div>
          <div :style="{'border': `1px solid ${theme.textColor}`}" class="open-file">
            <div @click="openFile" class="flexrowcenter">
              <span class="fa-solid fa-folder-open"></span>
              <span>{{$t('common.addFile')}}</span>
            </div>
            <span @click.stop="showMenu" class="fa-solid fa-angle-down"></span>
            <ul :style="{'background-color':theme.bgColor}" v-show="isShowFileMenu" class="my-file">
              <li :class="theme.hover" @click="openFolder">
                <span class="fa-solid fa-file-excel"></span>
                {{$t('common.addFolder')}}
              </li>
              <li :class="theme.hover" @click="openURL">
                <span class="fa-solid fa-link"></span>
                {{$t('common.addUrl')}}
              </li>
            </ul>
          </div>
        </div>
      </div>
      
      <!-- 搜索框部分 -->
      <div class="search-container" v-show="videoList.length > 0">
        <div class="search-box">
          <span class="fa-solid fa-search search-icon"></span>
          <input 
            type="text" 
            v-model="searchQuery" 
            :placeholder="$t('common.searchPlaylist')" 
            @input="handleSearch"
          />
          <span 
            v-if="searchQuery" 
            class="fa-solid fa-times clear-icon" 
            @click="clearSearch"
          ></span>
        </div>
      </div>
      
      <transition name="router" mode="out-in">
        <ul
          :style="{'background-color': theme.bgColor}"
          class="extend-menu"
          v-show="isShowExtendMenu"
        >
          <li :class="theme.hover" class="line" @click="clearVideoList()">{{$t('common.clearList')}}</li>
          <li
            v-for="(item,index) in soreModeList"
            :key="item.title"
            :class="{[theme.hover]:true,'line':index==soreModeList.length-1}"
            @click="changeSoreMode(item.soreMode)"
          >
            <span v-show="sortMode==item.soreMode" class="fa-solid fa-check"></span>
            {{item.title}}
          </li>
          <li
            v-for="item in playModeList"
            :key="item.title"
            :class="theme.hover"
            @click="changeMode(item.playMode)"
          >
            <span v-if="playMode==item.playMode" class="fa-solid fa-check"></span>
            {{item.title}}
          </li>
        </ul>
      </transition>
      <div
        @contextmenu.stop="contextmenu"
        class="list-content"
        :style="{'height':`${playListHeight-40-(videoList.length > 0 ? 50 : 0)}px`}"
      >
        <div style="padding-bottom: 10px;">
          <ListItem
            @contextmenu="itemContextmenu(video)"
            :item="video"
            v-for="(video,index) in filteredVideoList"
            :key="index"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations, mapActions } from "vuex";
import connect from "../api/bus.js";
import OpenDialog from "../api/OpenDialog";
import { remote, shell } from "electron";
import path from "path";
import storage from "good-storage";
import fs from "fs";
import { playOrderList, sortList } from "../config";

const openDialog = new OpenDialog();
const { Menu } = remote;

let isLock = storage.get("isLock", false);

export default {
  name: "play-list",
  props: {
    // 是否显示列表最左边的按钮
    isShowArrow: {
      type: Boolean,
      default: false
    },
    // 列表高度
    playListHeight: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      // 是否显示添加文件菜单
      isShowFileMenu: false,
      // 是否隐藏播放列表
      isHidenList: false,
      // 是否隐藏其他
      isShowOther: true,
      // 是否显示扩展菜单
      isShowExtendMenu: false,
      // 是否锁定播放列表
      isLock: isLock,
      // 定时器时间
      time: 1500,
      // 搜索查询
      searchQuery: "",
      // 搜索防抖定时器
      searchDebounceTimer: null
    };
  },
  mounted() {
    // 保存列表原有的的宽度
    this.savePlayListWidth = 300;
    // 定时器
    this.playListTimer = null;
    this.initEventListener();
    this.initListener();
  },
  methods: {
    ...mapMutations([
      "setPlayMode",
      "setSortMode",
      "setCurrentVideo",
      "setPlaying",
      "clearVideoList"
    ]),
    ...mapActions([
      "sortVideoList",
      "deleteVideo",
      "clearInvalidVideo",
      "changeVideoList"
    ]),
    // 开启定时器
    createSetTimeOut() {
      if (this.playListTimer) {
        clearTimeout(this.playListTimer);
      }
      this.playListTimer = setTimeout(this.createTimeOut, this.time);
    },
    initEventListener() {
      this.$refs.playList.addEventListener("mouseleave", this.onMouseLeave);
      this.$refs.playList.addEventListener("mouseenter", this.onMouseEnter);
      window.addEventListener("click", this.onClick);
    },
    // 初始化事件监听器
    initListener() {
      // 非全屏的时候显示头部和尾部
      connect.$on("showFooterAndHeader", () => {
        this.showFooterAndHeader();
      });
      // 全屏的时候隐藏头部和尾部
      connect.$on("hideFooterAndHeader", () => {
        this.hideFooterAndHeader();
      });

      connect.$on("showPlayList", () => {
        if (!this.isHidenList) {
          return;
        }
        this.hideList();
        if (!this.currentVideo) {
          return;
        }
        this.createSetTimeOut();
      });
    },
    // 移除事件监听器
    removeListener() {
      connect.$off("showFooterAndHeader");
      connect.$off("hideFooterAndHeader");
      connect.$off("showPlayList");
    },
    // 显示或者隐藏列表最中间菜单
    showMenu() {
      if (!this.isShowFileMenu) {
        document.body.click();
      }
      this.isShowFileMenu = !this.isShowFileMenu;
    },
    onClick() {
      // 隐藏列表右上角的扩展菜单
      this.isShowExtendMenu = false;
      // 隐藏列表最中间的菜单
      this.isShowFileMenu = false;
    },
    // 隐藏或者显示播放列表
    hideList() {
      this.isHidenList = !this.isHidenList;
    },
    // 切换播放模式
    changeMode(mode) {
      this.setPlayMode(mode);
    },
    // 切换排序模式
    changeSoreMode(mode) {
      this.setSortMode(mode);
    },
    // 显示或者隐藏右上角的扩展菜单
    showExtendMenu() {
      if (!this.isShowExtendMenu) {
        document.body.click();
      }
      this.isShowExtendMenu = !this.isShowExtendMenu;
    },
    // 锁定列表
    lockList() {
      if (this.playListTimer) {
        clearTimeout(this.playListTimer);
      }
      this.isLock = !this.isLock;
    },
    // 定时器方法
    createTimeOut() {
      if (!this.currentVideo) {
        //当前没有正在播放的视频就不用隐藏列表
        clearTimeout(this.playListTimer);
        return;
      }
      this.hideList();
      clearTimeout(this.playListTimer);
    },
    // 释放列表
    unLockList() {
      this.isLock = false;
    },
    onMouseEnter() {
      if (
        this.playListTimer &&
        this.currentVideo &&
        !this.isLock &&
        !this.isHidenList
      ) {
        clearTimeout(this.playListTimer);
      }
    },
    onMouseLeave(e) {
      if (this.playListTimer) {
        clearTimeout(this.playListTimer);
      }
      if (!this.currentVideo) {
        return;
      }
      if (!e) {
        return;
      }
      if (this.currentVideo && !this.isLock && !this.isHidenList) {
        this.createSetTimeOut();
      }
    },
    // 非全屏的时候显示头部和脚部，调整播放列表高度
    showFooterAndHeader() {
      if (this.currentVideo) {
        this.resetPositionToOriginal();
        this.setPlayListHeight(`${this.playListHeight}px`);
      } else {
        //不存在播放歌曲说明是点击停止按钮后退出全屏的
        this.resetPositionToZero();
        this.setPlayListHeight(`${this.playListHeight}px`);
      }
    },
    // 全屏的时候隐藏头部和脚部，调整播放列表高度
    hideFooterAndHeader() {
      this.resetPositionToZero();
      this.setPlayListHeight("100%");
    },
    // 把列表定位置为0
    resetPositionToZero() {
      this.$refs.playList.style.top = "0";
      this.$refs.playList.style.bottom = "0";
    },
    // 把列表定位恢复为原样
    resetPositionToOriginal() {
      this.$refs.playList.style.top = "37px";
      this.$refs.playList.style.bottom = "56px";
    },
    // 设置列表高度
    setPlayListHeight(height) {
      this.$refs.playList.style.height = height;
    },
    // 打开文件
    openFile() {
      openDialog.openFile();
    },
    // 打开文件夹
    openFolder() {
      openDialog.openFolder();
    },
    // 打开URL输入框
    openURL() {
      connect.$emit("openUrl");
    },
    clearTimerAndListener() {
      this.$refs.playList.removeEventListener("mouseleave", this.onMouseLeave);
      if (this.playListTimer) {
        clearTimeout(this.playListTimer);
      }
    },
    resetTimerAndListener() {
      if (this.playListTimer) {
        clearTimeout(this.playListTimer);
      }
      this.$refs.playList.addEventListener("mouseleave", this.onMouseLeave);
    },
    contextmenu() {
      this.clearTimerAndListener();
      document.body.click();
      const commonTemp = this.createContextmenuList();
      let playListMenuTemplate = [
        {
          label: this.$t("common.add"),
          submenu: [
            {
              label: this.$t("common.addFile"),
              click: () => {
                openDialog.openFile();
              }
            },
            {
              label: this.$t("common.addFolder"),
              click: () => {
                openDialog.openFolder();
              }
            },
            {
              label: this.$t("common.addUrl"),
              click: () => {
                connect.$emit("openUrl");
              }
            }
          ]
        },
        {
          type: "separator"
        },
        {
          label: this.$t("common.clearPlayList"),
          click: () => {
            this.clearVideoList();
          }
        },
        {
          label: this.$t("common.deleteInvalid"),
          click: () => {
            this.clearInvalidVideo();
          }
        },
        {
          type: "separator"
        },
        ...commonTemp,
        {
          type: "separator"
        }
      ];

      let m = Menu.buildFromTemplate(playListMenuTemplate);

      m.popup({ window: remote.getCurrentWindow() });

      m.addListener("menu-will-close", () => {
        this.resetTimerAndListener();
      });
    },
    itemContextmenu(video) {
      this.clearTimerAndListener();
      document.body.click();
      let flag = false;
      let isCurrentVideo = this.currentVideo
        ? video.id == this.currentVideo.id
        : false;
      if (this.currentVideo && isCurrentVideo && this.isPlaying) {
        flag = true;
      }
      const commonTemp = this.createContextmenuList();
      let playListMenuTemplate = [
        {
          label: flag ? this.$t("common.suspend") : this.$t("common.play"),
          click: () => {
            if (isCurrentVideo) {
              this.setPlaying(!flag);
            } else {
              this.setCurrentVideo(video);
            }
          }
        },
        {
          label: this.$t("common.deleteItem"),
          click: () => {
            this.deleteVideo(video);
          }
        },
        {
          label: this.$t("common.add"),
          submenu: [
            {
              label: this.$t("common.addFile"),
              click: () => {
                openDialog.openFile();
              }
            },
            {
              label: this.$t("common.addFolder"),
              click: () => {
                openDialog.openFolder();
              }
            },
            {
              label: this.$t("common.addUrl"),
              click: () => {
                connect.$emit("openUrl");
              }
            }
          ]
        },
        {
          type: "separator"
        },
        {
          label: this.$t("common.clearPlayList"),
          click: () => {
            this.clearVideoList();
          }
        },
        {
          label: this.$t("common.deleteInvalid"),
          click: () => {
            this.clearInvalidVideo();
          }
        },
        {
          type: "separator"
        },
        ...commonTemp,
        {
          type: "separator"
        },
        {
          label: this.$t("common.fileInfo"),
          click: () => {
            connect.$emit("videoInfo", video);
          }
        },
        {
          label: this.$t("common.openLocation"),
          click: () => {
            if (!fs.existsSync(video.src) && video.mode == "local") {
              // 保存文件错误信息
              let newVideo = Object.assign({}, video, { msg: "无效文件" });
              // 修改播放列表
              this.changeVideoList(newVideo);
              return;
            }
            let url = path.dirname(video.src);
            shell.openExternal(url);
          }
        }
      ];
      let m = Menu.buildFromTemplate(playListMenuTemplate);

      Menu.setApplicationMenu(m);

      m.popup({ window: remote.getCurrentWindow() });
      m.addListener("menu-will-close", () => {
        this.resetTimerAndListener();
      });
    },
    // 创建共同右键菜单Template
    createContextmenuList() {
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
      const sortArr = sortList.map(item => {
        return {
          label: this.$t(item.label),
          type: "checkbox",
          checked: this.sortMode == item.sortMode,
          click: () => {
            this.setSortMode(item.sortMode);
          }
        };
      });
      return [
        {
          label: this.$t("common.playOrder"),
          submenu: playOrderArr
        },
        {
          label: this.$t("common.sort"),
          submenu: sortArr
        }
      ];
    },
    // 处理搜索输入
    handleSearch() {
      // 清除之前的定时器
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
      }
      
      // 设置新的定时器（防抖处理）
      this.searchDebounceTimer = setTimeout(() => {
        // 搜索逻辑在计算属性中处理
        // 这里可以添加额外的处理逻辑，如跟踪用户搜索历史等
      }, 300);
    },
    // 清除搜索
    clearSearch() {
      this.searchQuery = "";
    }
  },
  computed: {
    ...mapGetters([
      "playMode",
      "sortMode",
      "currentVideo",
      "videoList",
      "isFullScreen",
      "isPlaying",
      "theme"
    ]),
    // 播放模式列表
    playModeList() {
      return [
        { title: this.$t("common.singlePlay"), playMode: 1 },
        { title: this.$t("common.singleCycle"), playMode: 2 },
        { title: this.$t("common.loopList"), playMode: 3 },
        { title: this.$t("common.sequentialPlay"), playMode: 4 },
        { title: this.$t("common.randomPlay"), playMode: 5 }
      ];
    },
    // 分类模式列表
    soreModeList() {
      return [
        { title: this.$t("common.defaultSort"), soreMode: 1 },
        { title: this.$t("common.sizeSort"), soreMode: 2 },
        { title: this.$t("common.timeSort"), soreMode: 3 },
        { title: this.$t("common.randomSort"), soreMode: 4 },
        { title: this.$t("common.nameSort"), soreMode: 5 }
      ];
    },
    // 过滤后的视频列表
    filteredVideoList() {
      if (!this.searchQuery.trim()) {
        return this.videoList;
      }
      
      const query = this.searchQuery.toLowerCase().trim();
      
      return this.videoList.filter(video => {
        // 获取文件名（从路径中提取）
        const fileName = path.basename(video.src).toLowerCase();
        
        // 根据文件名搜索
        if (fileName.includes(query)) {
          return true;
        }
        
        // 如果视频有标题属性，也搜索标题
        if (video.title && video.title.toLowerCase().includes(query)) {
          return true;
        }
        
        // 如果有艺术家属性（音乐文件通常有），也搜索艺术家
        if (video.artist && video.artist.toLowerCase().includes(query)) {
          return true;
        }
        
        // 如果有标签属性，搜索标签
        if (video.tags && Array.isArray(video.tags)) {
          return video.tags.some(tag => tag.toLowerCase().includes(query));
        }
        
        return false;
      });
    }
  },
  watch: {
    sortMode: {
      immediate: true,
      handler: function(newVal) {
        this.sortVideoList(newVal);
      }
    },
    isFullScreen(newVal) {
      if (!newVal) {
        //从全屏切换回非全屏的时候需要显示头部和尾部
        this.showFooterAndHeader();
      } else {
        //全屏的时候不能锁定播放列表
        this.isLock = false;
      }
    },
    isLock(newVal) {
      storage.set("isLock", newVal);
      //上锁的时候是相对定位,全屏的时候是相对定位，可能会修改定位，这里是重置定位，不上锁同理
      if (newVal) {
        this.resetPositionToZero();
      } else {
        this.resetPositionToOriginal();
        if (this.isFullScreen) {
          this.createSetTimeOut();
        }
      }
    },
    currentVideo(newVal) {
      if (!newVal) {
        this.resetPositionToZero();
        this.setPlayListHeight(`${this.playListHeight}px`);
      } else {
        if (!this.isFullScreen) {
          this.resetPositionToOriginal();
        }
        if (!this.isFullScreen && this.isLock) {
          this.resetPositionToZero();
        }
      }
    },
    isPlaying(newVal) {
      if (newVal && this.isLock) {
        this.resetPositionToZero();
      }
      if (newVal && !this.isLock && !this.isHidenList) {
        this.createSetTimeOut();
      }
    }
  },
  beforeDestroy() {
    if (this.playListTimer) {
      clearTimeout(this.playListTimer);
    }
    this.$refs.playList.removeEventListener("mouseleave", this.onMouseLeave);
    this.$refs.playList.removeEventListener("mouseenter", this.onMouseEnter);
    window.removeEventListener("click", this.onClick);
    this.removeListener();
  }
};
</script>

<style scoped lang="less">
@import "../styles/theme.less";

.playList {
  height: 100%;
  border-left: 1px solid @border-color;
  position: relative;
  background-color: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(10px);
  box-shadow: -2px 0 15px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
  
  // 确保白色背景下组件边缘清晰可见
  &:before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  
  .content-container {
    height: 100%;
    overflow: hidden;
    position: relative;
    width: 300px;
  }
  
  .my-arrow {
    position: absolute;
    top: 50%;
    left: -34px;
    transform: translateY(-50%);
    width: 34px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-image: linear-gradient(to right, rgba(20, 20, 20, 0.6), rgba(30, 30, 30, 0.8));
    backdrop-filter: blur(5px);
    border-radius: 6px 0 0 6px;
    border: 1px solid rgba(80, 80, 80, 0.3);
    border-right: none;
    z-index: 5;
    overflow: hidden;
    // 增强阴影效果，确保在白色背景下清晰可见
    box-shadow: -3px 0 10px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.2);
    
    > span {
      width: 100%;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: @text-secondary;
      transition: all 0.2s ease;
      // 添加文本阴影以增强在白色背景下的可见性
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      
      &:hover {
        color: @primary-color;
        transform: scale(1.1);
      }
    }
  }
  
  .top {
    padding: 15px;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    border-bottom: 1px solid rgba(80, 80, 80, 0.2);
    background-image: linear-gradient(to bottom, rgba(40, 40, 40, 0.6), rgba(30, 30, 30, 0.2));
    max-height: 50px;
    
    > span {
      font-size: 16px;
      font-weight: 500;
      color: @text-color;
    }
    
    .my-icon {
      display: flex;
      flex-direction: row;
      align-items: center;
      position: relative;
      
      > span {
        .icon-button();
        font-size: 15px;
      }
      
      > span + span {
        margin-left: 10px;
      }
      
      > .delete {
        font-size: 14px;
      }
    }
  }
  
  /* 搜索框样式 */
  .search-container {
    padding: 10px 15px;
    border-bottom: 1px solid rgba(80, 80, 80, 0.2);
    
    .search-box {
      position: relative;
      width: 100%;
      height: 36px;
      
      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: @text-secondary;
        font-size: 14px;
      }
      
      .clear-icon {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: @text-secondary;
        font-size: 14px;
        cursor: pointer;
        padding: 5px;
        
        &:hover {
          color: @primary-color;
        }
      }
      
      input {
        width: 100%;
        height: 100%;
        background-color: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 18px;
        color: @text-color;
        padding: 0 35px;
        font-size: 14px;
        transition: all 0.3s ease;
        
        &:focus {
          background-color: rgba(255, 255, 255, 0.15);
          border-color: rgba(93, 238, 0, 0.5);
          box-shadow: 0 0 0 2px rgba(93, 238, 0, 0.2);
          outline: none;
        }
        
        &::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      }
    }
  }
  
  .file {
    flex: 1;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 80%;
    
    .no-file {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 30px;
      animation: fadeIn 0.5s ease;
      
      > span {
        font-size: 60px;
        margin-bottom: 15px;
        color: rgba(255, 255, 255, 0.2);
      }
      
      > p {
        color: @text-secondary;
        font-size: 14px;
      }
    }
    
    .open-file {
      position: relative;
      width: 180px;
      height: 45px;
      border-radius: 45px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 5px 15px;
      background-image: linear-gradient(to right, rgba(93, 238, 0, 0.2), rgba(75, 204, 0, 0.3));
      // 增强阴影效果，确保在白色背景下清晰可见
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.1);
      }
      
      .my-file {
        position: absolute;
        top: 50px;
        left: 0;
        width: 100%;
        border-radius: 8px;
        .card-style();
        // 增强卡片样式，确保在白色背景下有足够的对比度
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.2);
        animation: slideDown 0.2s ease;
        overflow: hidden;
        z-index: 10;
        max-height: 250px;
        overflow-y: auto;
        
        &::-webkit-scrollbar {
          width: 4px;
        }
        
        &::-webkit-scrollbar-thumb {
          background-color: rgba(93, 238, 0, 0.3);
          border-radius: 4px;
        }
        
        &::-webkit-scrollbar-track {
          background-color: rgba(30, 30, 30, 0.1);
        }
        
        &:before {
          content: "";
          height: 0;
          width: 0;
          position: absolute;
          top: -8px;
          left: 30px;
          border: 4px solid transparent;
          border-bottom-color: @primary-color;
        }
        
        > li {
          width: 100%;
          padding: 12px 15px;
          color: @text-secondary;
          cursor: pointer;
          display: flex;
          align-items: center;
          transition: all 0.2s ease;
          
          span {
            margin-right: 8px;
          }
          
          &:hover {
            color: @primary-color;
            background-color: rgba(255, 255, 255, 0.05);
          }
        }
      }
      
      > div {
        cursor: pointer;
        color: @text-color;
        transition: color 0.2s ease;
        
        span:first-child {
          margin-right: 8px;
          color: @primary-color;
        }
        
        &:hover {
          color: @primary-color;
        }
      }
      
      > span {
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        // 加深背景色以增强对比度
        background-color: rgba(40, 40, 40, 0.3);
        // 添加描边以确保边界清晰可见
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        transition: all 0.2s ease;
        
        &:hover {
          background-color: rgba(93, 238, 0, 0.3);
          color: @primary-color;
        }
      }
    }
  }
}

.list-content {
  overflow: auto;
  padding: 5px;
  height: calc(100% - 50px);
  
  > div {
    padding: 5px;
    border-radius: 8px;
    background-color: rgba(20, 20, 20, 0.3);
  }
}

#position {
  position: fixed;
  top: 36px;
  bottom: 56px;
  right: 0;
  height: 100%;
  // 增强背景色深度和不透明度
  background-color: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(10px);
  // 增强阴影效果
  box-shadow: -2px 0 15px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.2);
  
  // 确保白色背景下组件边缘清晰可见
  &:before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.2);
  }
  
  .my-arrow {
    // 加深箭头背景色
    background-image: linear-gradient(to right, rgba(20, 20, 20, 0.8), rgba(30, 30, 30, 0.9));
  }
}

.extend-menu {
  position: absolute;
  right: 15px;
  top: 45px;
  z-index: 10;
  width: 140px;
  padding: 5px 0;
  border-radius: 8px;
  .card-style();
  // 增强卡片样式，确保在白色背景下有足够的对比度
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.2);
  animation: slideDown 0.2s ease;
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(93, 238, 0, 0.3);
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background-color: rgba(30, 30, 30, 0.1);
  }
  
  &:after {
    content: "";
    position: absolute;
    right: 10px;
    top: -8px;
    height: 0;
    width: 0;
    border: 4px solid transparent;
    border-bottom-color: @primary-color;
  }
  
  > li {
    height: 36px;
    display: flex;
    align-items: center;
    padding: 0 15px;
    color: @text-secondary;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    
    &.line {
      &:after {
        content: "";
        position: absolute;
        bottom: 0;
        left: 10px;
        right: 10px;
        height: 1px;
        background: linear-gradient(to right, transparent, @border-color, transparent);
      }
    }
    
    > span {
      font-size: 10px;
      margin-right: 8px;
      color: @primary-color;
    }
    
    &:hover {
      color: @primary-color;
      background-color: rgba(255, 255, 255, 0.05);
    }
  }
}

.filename {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: @text-secondary;
  font-size: 14px;
  padding: 0 10px;
  max-width: 200px;
  cursor: default;
}

.fullScreen-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: @text-secondary;
  font-size: 14px;
  padding: 0 10px;
  cursor: default;
}

.exit-fullScreen {
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    color: @primary-color;
  }
}
</style>