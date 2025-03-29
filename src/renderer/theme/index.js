// 主题配置
export const themes = {
  light: {
    name: 'light',
    bgColor: '#ffffff',
    textColor: '#333333',
    primaryColor: '#5dee00',
    secondaryColor: '#1bb017',
    hoverColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    menuBgColor: '#ffffff',
    menuTextColor: '#878788',
    menuHoverColor: '#f5f5f5',
    menuSelectedColor: '#1bb017',
    disabledColor: '#cccccc',  // 禁用按钮颜色（亮色主题）
    controlIconColor: '#333333' // 控制图标颜色（亮色主题）
  },
  dark: {
    name: 'dark',
    bgColor: '#252528',
    textColor: '#ffffff',
    primaryColor: '#5dee00',
    secondaryColor: '#1bb017',
    hoverColor: '#2a2a2d',
    borderColor: '#3a3a3d',
    menuBgColor: '#252528',
    menuTextColor: '#878788',
    menuHoverColor: '#2a2a2d',
    menuSelectedColor: '#1bb017',
    disabledColor: '#666666',  // 禁用按钮颜色（暗色主题）
    controlIconColor: '#ffffff' // 控制图标颜色（暗色主题）
  }
};

// 主题管理类
export class ThemeManager {
  constructor() {
    this.currentTheme = themes.dark; // 默认使用暗色主题
  }

  // 设置主题
  setTheme(themeName) {
    if (themes[themeName]) {
      this.currentTheme = themes[themeName];
      this.applyTheme();
      return true;
    }
    return false;
  }

  // 切换主题
  toggleTheme() {
    const newTheme = this.currentTheme.name === 'light' ? 'dark' : 'light';
    return this.setTheme(newTheme);
  }

  // 应用主题
  applyTheme() {
    const root = document.documentElement;
    Object.entries(this.currentTheme).forEach(([key, value]) => {
      if (typeof value === 'string') {
        root.style.setProperty(`--${key}`, value);
      }
    });
  }

  // 获取当前主题
  getCurrentTheme() {
    return this.currentTheme;
  }
}

// 创建主题管理器实例
export const themeManager = new ThemeManager(); 