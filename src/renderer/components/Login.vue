<template>
  <div v-if="isShow" class="login-wrapper">
    <div class="login-dialog" :style="{'background-color': theme.bgColor}">
      <div class="login-header">
        <span>{{ headerTitle }}</span>
        <span class="fa-solid fa-close close-icon" @click="handleClose"></span>
      </div>
      <div class="login-body">
        <div class="input-group">
          <label>{{ $t('login.username') || '用户名' }}</label>
          <input type="text" v-model="username" :placeholder="$t('login.username_placeholder') || '请输入用户名'" />
        </div>
        <div class="input-group">
          <label>{{ $t('login.password') || '密码' }}</label>
          <input type="password" v-model="password" :placeholder="$t('login.password_placeholder') || '请输入密码'" />
        </div>
        <div class="input-group" v-if="isRegisterMode">
          <label>{{ $t('user.confirmPassword') || '确认密码' }}</label>
          <input type="password" v-model="confirmPassword" :placeholder="$t('user.confirmPasswordRequired') || '请确认密码'" />
        </div>
        <div class="login-error" v-if="errorMessage" :class="{'success': isSuccessMessage}">{{ errorMessage }}</div>
      </div>
      <div class="login-footer">
        <button 
          @click="handleLogin" 
          class="login-button" 
          :class="{'loading': isLoading}"
          :disabled="isLoading"
        >{{ buttonText }}</button>
        <div class="register-link" v-if="!isRegisterMode">
          <span>{{ $t('user.noAccount') || '没有账号？' }}</span>
          <a href="#" @click.prevent="showRegisterForm">{{ $t('user.register') || '注册' }}</a>
        </div>
        <div class="register-link" v-else>
          <span>{{ $t('user.haveAccount') || '已有账号？' }}</span>
          <a href="#" @click.prevent="showLoginForm">{{ $t('user.goToLogin') || '去登录' }}</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations } from "vuex";
import userDB from "../api/database";

export default {
  name: "Login",
  props: {
    isShow: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      username: "",
      password: "",
      errorMessage: "",
      isRegisterMode: false,
      confirmPassword: "",
      isSuccessMessage: false,
      isLoading: false
    };
  },
  computed: {
    ...mapGetters(["theme", "isLoggedIn"]),
    headerTitle() {
      return this.isRegisterMode 
        ? (this.$t('user.register') || '注册账号') 
        : (this.$t('login.title') || '用户登录');
    },
    buttonText() {
      return this.isRegisterMode 
        ? (this.$t('user.register') || '注册') 
        : (this.$t('login.login') || '登录');
    }
  },
  watch: {
    isShow(val) {
      if (val) {
        // 每次显示时重置表单
        this.resetForm();
      }
    }
  },
  methods: {
    ...mapMutations(["setCurrentUser", "setLoginState"]),
    resetForm() {
      this.username = "";
      this.password = "";
      this.confirmPassword = "";
      this.errorMessage = "";
      this.isRegisterMode = false;
      this.isSuccessMessage = false;
    },
    handleClose() {
      this.$emit("close");
    },
    showRegisterForm() {
      this.isRegisterMode = true;
      this.errorMessage = "";
      this.isSuccessMessage = false;
    },
    showLoginForm() {
      this.isRegisterMode = false;
      this.errorMessage = "";
      this.isSuccessMessage = false;
    },
    handleLogin() {
      if (this.isRegisterMode) {
        this.handleRegister();
        return;
      }
      
      if (!this.username.trim()) {
        this.errorMessage = this.$t('login.username_required') || "请输入用户名";
        return;
      }
      if (!this.password.trim()) {
        this.errorMessage = this.$t('login.password_required') || "请输入密码";
        return;
      }

      // 显示加载中状态
      this.isLoading = true;
      
      // 使用数据库服务验证用户登录
      setTimeout(() => {
        const result = userDB.loginUser(this.username, this.password);
        this.isLoading = false;
        
        if (result.success) {
          this.errorMessage = "";
          // 设置用户信息
          this.setCurrentUser(result.user);
          // 显式设置登录状态为true
          this.setLoginState(true);
          this.$emit("loginSuccess", result.user);
          this.handleClose();
          
          // 强制刷新页面以确保状态正确同步
          console.log('登录成功，即将刷新页面...');
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          this.errorMessage = result.message || this.$t('user.invalidCredentials') || "用户名或密码错误";
        }
      }, 500); // 添加短暂延迟模拟网络请求
    },
    handleRegister() {
      if (!this.username.trim()) {
        this.errorMessage = this.$t('user.usernameRequired') || "请输入用户名";
        return;
      }
      if (!this.password.trim()) {
        this.errorMessage = this.$t('user.passwordRequired') || "请输入密码";
        return;
      }
      if (!this.confirmPassword.trim()) {
        this.errorMessage = this.$t('user.confirmPasswordRequired') || "请确认密码";
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.errorMessage = this.$t('user.passwordMismatch') || "两次输入的密码不一致";
        return;
      }

      // 显示加载中状态
      this.isLoading = true;
      
      // 使用数据库服务注册用户
      setTimeout(() => {
        const result = userDB.registerUser(this.username, this.password);
        this.isLoading = false;
        
        if (result.success) {
          this.errorMessage = this.$t('user.registerSuccess') || "注册成功，请登录";
          this.isSuccessMessage = true;
          this.showLoginForm();
        } else {
          this.errorMessage = result.message || this.$t('user.registerFailed') || "注册失败";
          this.isSuccessMessage = false;
        }
      }, 500); // 添加短暂延迟模拟网络请求
    }
  }
};
</script>

<style lang="less" scoped>
@import "../styles/theme.less";

.login-wrapper {
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

.login-dialog {
  width: 340px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  transform: translateY(0);
  animation: slideIn 0.3s ease;
  background-image: linear-gradient(to bottom, rgba(40, 40, 40, 0.9), rgba(20, 20, 20, 0.9));
  border: 1px solid @border-color;
}

@keyframes slideIn {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.login-header {
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid @border-color;
  background-image: linear-gradient(to right, #222, #333);
}

.close-icon {
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    color: @primary-color;
    transform: scale(1.1);
  }
}

.login-body {
  padding: 25px 20px;
  position: relative;
  
  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(circle at top right, rgba(93, 238, 0, 0.1), transparent 70%);
    pointer-events: none;
  }
}

.input-group {
  margin-bottom: 20px;
  
  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
    color: @text-secondary;
  }
  
  input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 5px;
    border: 1px solid @border-color;
    background-color: rgba(30, 30, 30, 0.7);
    color: inherit;
    outline: none;
    transition: all 0.2s ease;
    
    &:focus {
      border-color: @primary-color;
      box-shadow: 0 0 0 2px rgba(93, 238, 0, 0.2);
    }
  }
}

.login-footer {
  padding: 15px 20px 25px;
  text-align: center;
  background-image: linear-gradient(to bottom, rgba(30, 30, 30, 0), rgba(40, 40, 40, 0.3));
}

.login-button {
  background-image: linear-gradient(to bottom, @primary-color, @primary-active);
  color: #111;
  border: none;
  padding: 10px 30px;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s ease;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
  margin-bottom: 15px;
  width: 100%;
  position: relative;
  
  &:hover {
    background-image: linear-gradient(to bottom, @primary-hover, @primary-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
  }
  
  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: translateY(0);
    box-shadow: 0 2px 3px rgba(0, 0, 0, 0.3);
  }
}

/* 添加加载中动画样式 */
.login-button.loading:after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-top-color: #111;
  border-radius: 50%;
  animation: spinner 0.8s linear infinite;
  right: 15px;
  top: calc(50% - 10px);
}

@keyframes spinner {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.register-link {
  margin-top: 10px;
  font-size: 13px;
  color: @text-secondary;
  
  a {
    color: @primary-color;
    text-decoration: none;
    margin-left: 5px;
    transition: all 0.2s ease;
    
    &:hover {
      text-decoration: underline;
      color: @primary-hover;
    }
  }
}

.login-error {
  color: @danger-color;
  font-size: 12px;
  margin-bottom: 15px;
  background-color: rgba(255, 75, 75, 0.1);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid @danger-color;
  
  &.success {
    color: @primary-color;
    background-color: rgba(93, 238, 0, 0.1);
    border-left-color: @primary-color;
  }
}
</style> 