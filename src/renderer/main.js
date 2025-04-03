import Vue from "vue";
// import axios from "axios";
import store from "./store";
import i18n from "./lang";
import userDB from "./api/database";

import "./fontawesome-free-6.7.2-web/css/all.css";
import "./base.css";

import { Col, Row, MessageBox, Button, Table, TableColumn, Message } from "element-ui";
Vue.use(Col);
Vue.use(Row);
Vue.use(Button);
Vue.use(Table);
Vue.use(TableColumn);
Vue.prototype.$prompt = MessageBox.prompt;
Vue.prototype.$confirm = MessageBox.confirm;
Vue.prototype.$message = Message;

import App from "./App";
import MyHeader from "./components/Header";
import MyVideo from "./components/Video";
import MyFooter from "./components/Footer";
import PlayList from "./components/PlayList";
import MyProgress from "./components/Progress";
import VideoProgress from "./components/VideoProgress";
import ListItem from "./components/ListItem";
import HistoryItem from "./components/HistoryItem";
import About from "./components/About";
import FileInfo from "./components/FileInfo";
import MusicLabels from "./views/MusicLabels";

Vue.component("MyHeader", MyHeader);
Vue.component("MyVideo", MyVideo);
Vue.component("MyFooter", MyFooter);
Vue.component("PlayList", PlayList);
Vue.component("MyProgress", MyProgress);
Vue.component("VideoProgress", VideoProgress);
Vue.component("ListItem", ListItem);
Vue.component("HistoryItem", HistoryItem);
Vue.component("About", About);
Vue.component("FileInfo", FileInfo);
Vue.component("MusicLabels", MusicLabels);

// if (!process.env.IS_WEB) Vue.use(require("vue-electron"));
// Vue.http = Vue.prototype.$http = axios;
Vue.config.productionTip = false;

import { ipcRenderer } from "electron";
import storage from "good-storage";

// 窗口关闭前,保存store中的状态，以便下次打开恢复上次的状态
ipcRenderer.on("close", () => {
  storage.set("locale", i18n.locale);
  if (store.state.currentVideo && !store.state.isTrace) {
    storage.set(
      "state",
      Object.assign({}, store.state, {
        currentVideo: {
          ...store.state.currentVideo,
          currentTime: store.state.currentTime,
          speed: store.state.speed,
        },
      })
    );
  } else {
    storage.set("state", store.state);
  }
});

new Vue({
  components: { App },
  template: "<App/>",
  store,
  i18n,
  beforeCreate() {
    // 获取存储在localStorage的状态
    const storage = require('good-storage');
    const savedState = storage.get("state", {});
    const savedIsLoggedIn = savedState.isLoggedIn;
    const savedUser = savedState.currentUser;
    
    // 在应用启动时从数据库加载用户登录状态
    const loginStatus = userDB.getLoginStatus();
    
    // 检查localStorage和数据库中的登录状态是否一致
    if (savedIsLoggedIn && (!loginStatus.isLoggedIn || !loginStatus.user)) {
      // 如果localStorage显示已登录，但数据库显示未登录，则以数据库为准
      // 更新localStorage，清除登录状态
      console.log('状态不一致：localStorage显示已登录，但数据库显示未登录，正在同步...');
      const updatedState = {
        ...savedState,
        currentUser: null,
        isLoggedIn: false
      };
      storage.set('state', updatedState);
      store.commit('setCurrentUser', null);
      store.commit('setLoginState', false);
    } else if (loginStatus.isLoggedIn && loginStatus.user) {
      // 如果数据库显示已登录，则恢复登录状态
      console.log('从数据库恢复登录状态:', loginStatus.user);
      store.commit('setCurrentUser', loginStatus.user);
      store.commit('setLoginState', true);
      
      // 确保localStorage也同步更新
      if (!savedIsLoggedIn || !savedUser || savedUser.id !== loginStatus.user.id) {
        const updatedState = {
          ...savedState,
          currentUser: loginStatus.user,
          isLoggedIn: true
        };
        storage.set('state', updatedState);
      }
    }
  }
}).$mount("#app");
