<template>
  <div v-if="isShow" class="user-info-wrapper">
    <div class="user-info-dialog" :style="{'background-color': theme.bgColor}">
      <div class="user-info-header">
        <span>{{ $t('user.profile') || '用户信息' }}</span>
        <span class="fa-solid fa-close close-icon" @click="handleClose"></span>
      </div>
      <div class="user-info-body">
        <div class="user-avatar">
          <div class="avatar-circle">
            <span>{{ userInitial }}</span>
          </div>
        </div>
        <div class="user-details">
          <h3>{{ user.username }}</h3>
          <p class="user-since">{{ $t('user.memberSince') || '注册时间' }}: {{ formattedDate }}</p>
        </div>
        <div class="separator"></div>
        <button @click="handleLogout" class="logout-button">
          <span class="fa-solid fa-arrow-right-from-bracket"></span>
          {{ $t('user.logout') || '退出登录' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations } from "vuex";
import userDB from "../api/database";

export default {
  name: "UserInfo",
  props: {
    isShow: {
      type: Boolean,
      default: false
    },
    user: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    ...mapGetters(["theme", "isLoggedIn"]),
    userInitial() {
      return this.user && this.user.username ? this.user.username.charAt(0).toUpperCase() : '?';
    },
    formattedDate() {
      if (!this.user || !this.user.created_at) return '-';
      
      try {
        const date = new Date(this.user.created_at);
        return date.toLocaleDateString();
      } catch (e) {
        return '-';
      }
    }
  },
  methods: {
    ...mapMutations(["setCurrentUser", "setLoginState"]),
    handleClose() {
      this.$emit("close");
    },
    handleLogout() {
      if (this.user && this.user.id) {
        userDB.logoutUser(this.user.id);
      }
      this.setCurrentUser(null);
      this.setLoginState(false);
      this.$emit("logout");
      this.handleClose();
      
      // 强制刷新页面以确保状态正确同步
      console.log('登出成功，即将刷新页面...');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }
};
</script>

<style lang="less" scoped>
.user-info-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.user-info-dialog {
  width: 280px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  transform: translateY(0);
  animation: slideIn 0.3s ease;
  background-image: linear-gradient(to bottom, rgba(40, 40, 40, 0.9), rgba(20, 20, 20, 0.9));
  border: 1px solid rgba(80, 80, 80, 0.5);
}

@keyframes slideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.user-info-header {
  padding: 12px 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(80, 80, 80, 0.5);
  background-image: linear-gradient(to right, #222, #333);
}

.close-icon {
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    color: #5dee00;
    transform: scale(1.1);
  }
}

.user-info-body {
  padding: 20px 15px;
  text-align: center;
}

.user-avatar {
  margin-bottom: 15px;
  
  .avatar-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background-image: linear-gradient(to bottom right, #5dee00, #4bcc00);
    color: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    font-size: 26px;
    font-weight: bold;
    box-shadow: 0 4px 10px rgba(93, 238, 0, 0.3);
  }
}

.user-details {
  margin-bottom: 20px;
  
  h3 {
    margin: 0 0 8px;
    font-size: 18px;
    color: #fff;
  }
  
  .user-since {
    color: #b0b0b0;
    font-size: 12px;
    margin: 0;
  }
}

.logout-button {
  background-color: transparent;
  color: #ff6b6b;
  border: 1px solid #ff6b6b;
  padding: 7px 15px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  font-size: 13px;
  
  span {
    margin-right: 6px;
    font-size: 12px;
  }
  
  &:hover {
    background-color: rgba(255, 107, 107, 0.1);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
}

.separator {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(80, 80, 80, 0.5), transparent);
  margin: 0 auto 15px;
  width: 80%;
}
</style> 