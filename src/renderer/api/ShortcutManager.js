import Mousetrap from 'mousetrap';
import store from '../store';
import connect from './bus';

class ShortcutManager {
  constructor() {
    if (ShortcutManager.instance) {
      return ShortcutManager.instance;
    }
    
    this.shortcuts = {};
    this.actionHandlers = {};
    
    ShortcutManager.instance = this;
    
    // 监听快捷键更新事件
    connect.$on('updateShortcuts', this.rebindAllShortcuts.bind(this));
  }
  
  /**
   * 注册动作处理函数
   * @param {string} action - 动作名称
   * @param {Function} handler - 处理函数
   */
  registerActionHandler(action, handler) {
    this.actionHandlers[action] = handler;
  }
  
  /**
   * 绑定快捷键到动作
   * @param {string} action - 动作名称
   */
  bindShortcut(action) {
    const shortcut = store.getters.getShortcut(action);
    const handler = this.actionHandlers[action];
    
    if (shortcut && handler) {
      // 先解除此动作之前的绑定（如果有）
      if (this.shortcuts[action]) {
        Mousetrap.unbind(this.shortcuts[action]);
      }
      
      // 记录当前绑定的快捷键
      this.shortcuts[action] = shortcut;
      
      // 绑定新的快捷键
      Mousetrap.bind(shortcut, (e, combo) => {
        if (store.getters.isCustomShortcutsEnabled) {
          handler(e, combo);
          return false; // 防止默认行为并阻止事件冒泡
        }
        return true;
      });
    }
  }
  
  /**
   * 解绑单个动作的快捷键
   * @param {string} action - 动作名称
   */
  unbindShortcut(action) {
    if (this.shortcuts[action]) {
      Mousetrap.unbind(this.shortcuts[action]);
      delete this.shortcuts[action];
    }
  }
  
  /**
   * 解绑所有快捷键
   */
  unbindAllShortcuts() {
    Object.keys(this.shortcuts).forEach(action => {
      Mousetrap.unbind(this.shortcuts[action]);
    });
    
    this.shortcuts = {};
  }
  
  /**
   * 重新绑定所有注册过的快捷键动作
   */
  rebindAllShortcuts() {
    this.unbindAllShortcuts();
    
    Object.keys(this.actionHandlers).forEach(action => {
      this.bindShortcut(action);
    });
  }
}

ShortcutManager.instance = null;

export default ShortcutManager; 