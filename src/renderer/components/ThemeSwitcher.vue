<template>
  <div class="theme-switcher">
    <span 
      class="theme-icon hover-effect" 
      :title="currentTheme === 'light' ? $t('common.switchToLight') : $t('common.switchToDark')"
      @click="toggleTheme"
    >
      <i v-if="currentTheme === 'light'" class="fa-solid fa-moon"></i>
      <i v-else class="fa-solid fa-sun"></i>
    </span>
  </div>
</template>

<script>
import { themeManager } from '../theme';
import connect from '../api/bus';

export default {
  name: 'ThemeSwitcher',
  data() {
    return {
      currentTheme: themeManager.getCurrentTheme().name
    };
  },
  methods: {
    toggleTheme() {
      themeManager.toggleTheme();
      this.currentTheme = themeManager.getCurrentTheme().name;
      // 通知其他组件主题已更改
      connect.$emit('themeChanged', themeManager.getCurrentTheme());
      
      // 保存用户偏好
      localStorage.setItem('preferred-theme', this.currentTheme);
    }
  },
  mounted() {
    // 从本地存储加载用户的主题偏好
    const savedTheme = localStorage.getItem('preferred-theme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      themeManager.setTheme(savedTheme);
      this.currentTheme = savedTheme;
    }
    
    // 初始化主题
    themeManager.applyTheme();
  }
};
</script>

<style scoped>
.theme-switcher {
  margin: 0 10px;
}

.theme-icon {
  font-size: 18px;
  cursor: pointer;
  color: var(--controlIconColor);
}
</style> 