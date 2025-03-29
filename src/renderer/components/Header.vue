<template>
  <div :style="{'color':theme.textColor}" class="header">
    <transition name="router" mode="out-in">
      <About @handlerAboutClick="handlerAboutClick" :isShow="showAbout" />
    </transition>
    <transition name="router" mode="out-in">
      <Login @close="closeLogin" @loginSuccess="onLoginSuccess" :isShow="showLogin" />
    </transition>
    <transition name="router" mode="out-in">
      <UserInfo 
        v-if="isLoggedIn"
        @close="closeUserInfo" 
        @logout="handleLogout" 
        :isShow="showUserInfo" 
        :user="currentUser" 
      />
    </transition>
    <ShortcutsModal :visible="showShortcutsModal" @close="closeShortcutsModal" />
    <Settings :visible="showSettings" @close="closeSettings" />
    <div class="left" v-if="!isFullScreen">
      <span class="fa-solid fa-file-video"></span>
      <div @click.stop="showMenu">
        <span ref="title" class="title" v-if="!currentVideo">{{$t('header.title')}}</span>
        <span
          ref="icon"
          class="fa-solid fa-angle-down my-angle-down"
          :style="{'margin-left':currentVideo?'10px':''}"
        ></span>
      </div>
      <span
        v-if="currentVideo"
        :title="currentVideo.filename"
        class="filename"
      >{{currentVideo.filename}}</span>
      <transition name="router" mode="out-in">
        <ul
          @click="handlerClick"
          :style="{'background-color': theme.bgColor}"
          v-if="isShowMenu"
          class="my-menu"
        >
          <li
            :data-title="item.title"
            v-for="(item,index) in list"
            :key="index"
            :class="{[theme.hover]:true,'set':item.set}"
          >
            <span :class="item.icion"></span>
            {{item.title}}
          </li>
        </ul>
      </transition>
    </div>
    <div class="middle" v-if="!isFullScreen"></div>
    <div class="right" v-if="!isFullScreen">
      <span
      class="fa-solid fa-user user-icon"
      :title="isLoggedIn ? currentUser.username : $t('header.user')"
      @click="showLoginDialog"
      >
        <span v-if="isLoggedIn" class="user-avatar-indicator">
          <span>{{ currentUser && currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '' }}</span>
        </span>
      </span>
      <span
      class="fa-solid fa-language"
      :title="$t('header.lang')"
      @click="changeLang"
      ></span>
      <span
        @click="setAlwaysOnTop(true)"
        v-if="!isAlwaysOnTop"
        :title="$t('header.roof')"
        class="fa-solid fa-up-long"
      ></span>
      <span
        @click="setAlwaysOnTop(false)"
        v-if="isAlwaysOnTop"
        :title="$t('header.cancelRoof')"
        class="fa-solid fa-down-long"
      ></span>
      <span @click.stop="showTheme" :title="$t('header.skin')" class="fa-solid fa-palette"></span>
      <span @click.stop="showHistory" :title="$t('header.record')" class="fa-solid fa-clock"></span>
      <span @click="minWindow" :title="$t('header.minimize')" class="fa-regular fa-window-minimize"></span>
      <span v-if="!isMaxed" @click="maxWindow" :title="$t('header.Maximization')" class="fa-regular fa-window-maximize"></span>
      <span v-else @click="maxWindow" :title="$t('header.reset')" class="fa-regular fa-window-restore"></span>
      <span @click="close" :title="$t('header.close')" class="fa-solid fa-close"></span>
      <transition name="router" mode="out-in">
        <div :style="{'background-color':theme.bgColor}" v-show="isShowHistory" class="m-history">
          <div class="history">
            <div
              class="no-history"
              v-if="historicalRecords.length == 0"
            >暂无历史记录</div>
            <HistoryItem :item="video" v-for="(video,index) in historicalRecords" :key="index" />
            <div
              v-if="historicalRecords.length != 0"
              @click="clearHistoricalRecords"
              class="clear-history"
            >清空历史记录</div>
          </div>
        </div>
      </transition>
      <transition name="router" mode="out-in">
        <ul :style="{'background-color':theme.bgColor}" v-show="isShowTheme" class="change-skin">
          <li
            @click="changeTheme(theme)"
            :style="{'background-image': `url('${theme.bgUrl}')`}"
            v-for="(theme,index) in themes"
            :key="index"
          ></li>
        </ul>
      </transition>
    </div>
    <div v-if="isFullScreen" class="fullScreen-title">{{currentVideo.filename}}</div>
    <div class="flexbetween" v-if="isFullScreen">
      <span class="fullScreen-title">{{time}}</span>
      <span class="fullScreen-title exit-fullScreen" @click="setFullScreen(false)">退出全屏</span>
    </div>
  </div>
</template>

<script>
import WindowUtil from "../api/window";
import { mapGetters, mapMutations } from "vuex";
import { remote, shell } from "electron";
import { themes } from "../api/util";
import Login from "./Login.vue";
import UserInfo from "./UserInfo.vue";
import About from "./About.vue";
import ShortcutsModal from "./ShortcutsModal.vue";
import Settings from "./Settings.vue";
import userDB from "../api/database";

const winUtil = new WindowUtil();
const { Menu } = remote;

export default {
  name: "elysia-header",
  components: {
    Login,
    UserInfo,
    About,
    ShortcutsModal,
    Settings
  },
  data() {
    return {
      // 是否显示最大化
      isMaxed: false,
      // 是否显示左上角的菜单
      isShowMenu: false,
      // 当前时间
      time: null,
      // 是否显示历史记录
      isShowHistory: false,
      // 主题颜色
      themes,
      // 是否显示主题
      isShowTheme: false,
      // 是否显示关于页面
      showAbout: false,
      // 是否显示登录对话框
      showLogin: false,
      // 是否显示用户信息页面
      showUserInfo: false,
      // 是否显示快捷键设置模态框
      showShortcutsModal: false,
      showSettings: false
    };
  },
  mounted() {
    this.timer = null;
    this.initListener();
    
    // 添加调试信息
    console.log('Header组件已挂载');
    console.log('当前用户状态:', this.currentUser);
    console.log('登录框状态:', this.showLogin);
    console.log('用户信息框状态:', this.showUserInfo);
  },
  methods: {
    ...mapMutations([
      "setFullScreen",
      "clearHistoricalRecords",
      "setAlwaysOnTop",
      "setTheme",
      "setCurrentUser",
      "setLoginState"
    ]),
    // 初始化监听器
    initListener() {
      remote.getCurrentWindow().addListener("maximize", this.maximize);
      remote.getCurrentWindow().addListener("unmaximize", this.unmaximize);
      window.addEventListener("click", this.onClick);
    },
    // 清空监听器
    removeListener() {
      window.removeEventListener("click", this.onClick);
      remote.getCurrentWindow().removeAllListeners();
    },
    maximize() {
      this.isMaxed = true;
    },
    unmaximize() {
      this.isMaxed = false;
    },
    // 最小化窗口
    minWindow() {
      winUtil.minWindow();
    },
    // 最大化或者还原窗口
    maxWindow() {
      winUtil.maxWindow();
    },
    // 关闭窗口
    close() {
      winUtil.close();
    },
    // 点击左上角播放器文字后显示或者隐藏菜单
    showMenu() {
      // 触发一次点击是因为可能还有其他的菜单在显示，此时需要隐藏其他菜单
      if (!this.isShowMenu) {
        document.body.click();
      }
      // 隐藏左上角的菜单
      this.isShowMenu = !this.isShowMenu;
    },
    onClick() {
      this.isShowMenu = false;
      this.isShowHistory = false;
      this.isShowTheme = false;
    },
    getTime() {
      let date = new Date();
      let h = date.getHours();
      let m = date.getMinutes();
      let s = date.getSeconds();
      this.time = `${h}:${m}:${s}`;
    },
    showHistory() {
      if (!this.isShowHistory) {
        document.body.click();
      }
      this.isShowHistory = !this.isShowHistory;
    },
    changeTheme(theme) {
      this.setTheme(theme);
    },
    showTheme() {
      if (!this.isShowTheme) {
        document.body.click();
      }
      this.isShowTheme = !this.isShowTheme;
    },
    handlerClick(e) {
      const title = e.target.dataset.title;
      switch (title) {
        // case this.$t('header.list.Website'):
        //   shell.openExternal("https://github.com/penguinway/player");
        //   break;
        case this.$t('header.list.Exit'):
          this.close();
          break;
        // case this.$t('header.list.About'):
        //   this.showAbout = true;
        //   break;
        case this.$t('header.list.Settings'):
          this.openSettingsMenu();
          break;
        case this.$t('header.list.Shortcuts'):
          this.openShortcutsModal();
          break;
      }
    },
    handlerAboutClick() {
      this.showAbout = false;
    },
    // 切换语言
    changeLang(){
      const locale = this.$i18n.locale
      if(locale === 'cn'){
        this.$i18n.locale = 'en'
      }else{
        this.$i18n.locale = 'cn'
      }
    },
    // 显示登录对话框
    showLoginDialog() {
      if (this.isLoggedIn) {
        // 如果已登录，显示用户信息页面
        console.log('用户已登录，显示用户信息页面', this.currentUser);
        document.body.click(); // 关闭其他菜单
        this.showUserInfo = true;
        console.log('showUserInfo设置为:', this.showUserInfo);
      } else {
        console.log('用户未登录，显示登录页面');
        document.body.click(); // 关闭其他菜单
        this.showLogin = true;
      }
    },
    // 关闭登录对话框
    closeLogin() {
      this.showLogin = false;
    },
    // 关闭用户信息页面
    closeUserInfo() {
      console.log('关闭用户信息页面');
      this.showUserInfo = false;
    },
    // 处理退出登录
    handleLogout() {
      console.log('用户退出登录');
      if (this.currentUser && this.currentUser.id) {
        // 在数据库中更新登录状态
        userDB.logoutUser(this.currentUser.id);
      }
      this.setCurrentUser(null);
      this.setLoginState(false);
      
      // 强制刷新页面以确保状态正确同步
      console.log('登出成功，即将刷新页面...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    },
    // 登录成功回调
    onLoginSuccess(user) {
      console.log('登录成功，用户信息:', user);
      this.setCurrentUser(user);
      console.log(`${this.$t('user.welcome')}，${user.username}！`);
    },
    // 打开快捷键设置模态框
    openShortcutsModal() {
      this.showShortcutsModal = true;
    },
    
    // 关闭快捷键设置模态框
    closeShortcutsModal() {
      this.showShortcutsModal = false;
    },
    // 打开设置菜单
    openSettingsMenu() {
      this.showSettings = true;
    },
    // 关闭设置菜单
    closeSettings() {
      this.showSettings = false;
    }
  },
  computed: {
    ...mapGetters([
      "isFullScreen",
      "currentVideo",
      "historicalRecords",
      "isAlwaysOnTop",
      "theme",
      "currentUser",
      "isLoggedIn"
    ]),
    // 左上角菜单
    list(){
      return [
        // { title: this.$t('header.list.Website'), icion: "fa-solid fa-blog", set: false },
        { title: this.$t('header.list.Settings'), icion: "fa-solid fa-gear", set: true },
        // { title: this.$t('header.list.About'), icion: "fa-solid fa-user", set: false },
        { title: this.$t('header.list.Exit'), icion: "fa-solid fa-arrow-right-from-bracket", set: true }
      ]
    }
  },
  watch: {
    isFullScreen(newVal) {
      winUtil.setFullScreen(newVal);
      if (newVal) {
        this.timer = setInterval(this.getTime, 1000);
      } else {
        if (this.timer) {
          clearInterval(this.timer);
        }
      }
    },
    currentUser(newVal) {
      console.log('currentUser变化:', newVal);
    },
    showUserInfo(newVal) {
      console.log('showUserInfo变化:', newVal);
    }
  },
  beforeDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.removeListener();
  }
};
</script>

<style lang="less" scoped>
@import "../styles/theme.less";

.header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 15px;
  background-image: linear-gradient(to right, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.95));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  position: relative;
  z-index: 10;
  
  .middle {
    -webkit-app-region: drag;
    flex: 1;
    height: 100%;
    margin: 0 10px;
  }
  
  .left {
    display: flex;
    flex-direction: row;
    align-items: center;
    
    .my-menu {
      padding: 8px 0;
      position: absolute;
      font-size: 13px;
      top: 48px;
      left: 5px;
      color: @text-secondary;
      z-index: 11;
      width: 170px;
      border-radius: 8px;
      .card-style();
      animation: slideDown 0.2s ease;
      
      &:before {
        position: absolute;
        top: -8px;
        left: 10px;
        content: "";
        height: 0;
        width: 0;
        border: 4px solid transparent;
        border-bottom-color: @primary-color;
      }
      
      > li {
        cursor: pointer;
        padding: 10px 15px;
        color: @text-secondary;
        position: relative;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        
        &.set:before {
          content: "";
          height: 1px;
          position: absolute;
          width: 85%;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(to right, transparent, @border-color, transparent);
        }
        
        span {
          margin-right: 8px;
          width: 16px;
          text-align: center;
        }
        
        &:hover {
          color: @primary-color;
          background-color: rgba(255, 255, 255, 0.05);
        }
      }
    }
    
    > span:nth-child(1) {
      color: @primary-color;
      font-size: 18px;
      margin-right: 5px;
    }
    
    > div {
      position: relative;
      cursor: pointer;
      
      .title {
        font-size: 15px;
        padding: 0 5px;
        font-weight: 500;
      }
      
      .my-angle-down {
        font-size: 14px;
        opacity: 0.8;
      }
      
      &:hover {
        > span {
          color: @text-color;
        }
      }
    }
  }
  
  .right {
    display: flex;
    flex-direction: row;
    align-items: center;
    position: relative;
    
    span {
      .icon-button();
    }
    
    .history {
      max-height: 300px;
      width: 320px;
      border-radius: 8px;
      overflow: auto;
      color: @text-secondary;
      max-height: 60vh;
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

.m-history {
  position: absolute;
  top: 47px;
  right: -8px;
  z-index: 20;
  border-radius: 8px;
  .card-style();
  width: 320px;
  max-height: 400px;
  animation: slideDown 0.2s ease;
  backdrop-filter: blur(10px);
  background-color: rgba(20, 20, 20, 0.85);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  
  &:before {
    position: absolute;
    top: -8px;
    right: 36px;
    width: 0;
    height: 0;
    content: "";
    border: 4px solid transparent;
    border-bottom-color: @primary-color;
  }
  
  .history {
    max-height: 400px;
    overflow-y: auto;
    padding: 5px;
    
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
  }
}

.clear-history,
.no-history {
  text-align: center;
  font-size: 13px;
  padding: 12px;
  border-radius: 6px;
  margin: 5px;
  background-color: rgba(30, 30, 30, 0.3);
}

.no-history {
  color: @text-secondary;
  padding: 20px;
  margin: 10px 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  &:before {
    content: "\f017";
    font-family: "Font Awesome 6 Free";
    font-weight: 900;
    font-size: 36px;
    margin-bottom: 10px;
    color: rgba(150, 150, 150, 0.3);
  }
}

.clear-history {
  cursor: pointer;
  color: @text-secondary;
  transition: all 0.2s ease;
  background-image: linear-gradient(to right, rgba(80, 80, 80, 0.1), rgba(60, 60, 60, 0.2));
  
  &:hover {
    color: @primary-color;
    background-color: rgba(93, 238, 0, 0.1);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
}

.change-skin {
  width: 400px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  position: absolute;
  top: 47px;
  z-index: 20;
  right: 0;
  border-radius: 8px;
  .card-style();
  animation: slideDown 0.2s ease;
  padding: 10px;
  
  &:before {
    position: absolute;
    top: -8px;
    right: 180px;
    width: 0;
    height: 0;
    content: "";
    border: 4px solid transparent;
    border-bottom-color: @primary-color;
  }
  
  > li {
    width: 110px;
    height: 70px;
    margin: 8px;
    border-radius: 6px;
    cursor: pointer;
    background-position: center center;
    background-repeat: no-repeat;
    background-size: cover;
    transition: all 0.2s ease;
    border: 2px solid transparent;
    
    &:hover {
      transform: scale(1.05);
      border-color: @primary-color;
    }
  }
}

.user-icon {
  position: relative;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-avatar-indicator {
  position: absolute;
  top: 0px;
  right: 0px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-image: linear-gradient(to bottom right, @primary-color, darken(@primary-color, 10%));
  color: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
</style>