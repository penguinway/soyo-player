<template>
  <transition name="fade">
    <div class="recommend-modal" v-if="isShow" @click.self="close">
      <div class="recommend-container">
        <div class="close-btn" @click="close">
          <span class="fa-solid fa-xmark"></span>
        </div>
        
        <div v-if="isLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>{{ $t('common.loading') }}</p>
        </div>
        
        <template v-else>
          <div class="recommend-header">
            <h2>{{ $t('music.similarSongs') }}</h2>
            <p v-if="currentMusic">{{ $t('music.basedOn') }}: {{ currentMusic }}</p>
          </div>
          
          <div v-if="recommendedSongs.length === 0" class="no-recommend">
            <span class="fa-solid fa-music-slash"></span>
            <p>{{ $t('music.noRecommendations') }}</p>
          </div>
          
          <div v-else class="recommend-list">
            <div 
              v-for="(song, index) in recommendedSongs" 
              :key="index" 
              class="recommend-item"
              @click="playSong(song)"
            >
              <div class="song-icon">
                <span class="fa-solid fa-music"></span>
              </div>
              <div class="song-info">
                <p class="song-name">{{ song }}</p>
              </div>
              <div class="play-icon">
                <span class="fa-solid fa-play"></span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<script>
import connect from "../api/bus.js";

export default {
  name: "music-recommend",
  props: {
    isShow: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      isLoading: false,
      currentMusic: '',
      recommendedSongs: []
    };
  },
  mounted() {
    // 监听获取推荐结果
    connect.$on("recommendedSongsReceived", (data) => {
      this.recommendedSongs = data;
      this.isLoading = false;
    });
  },
  methods: {
    // 关闭推荐窗口
    close() {
      this.$emit('close');
    },
    
    // 从后端获取推荐歌曲
    async fetchRecommendations(fileName) {
      this.isLoading = true;
      this.currentMusic = fileName;
      this.recommendedSongs = [];
      
      try {
        // 获取设置中的推荐数量
        const recommendCount = this.getRecommendCount();
        
        // 使用原生fetch方法调用API
        const response = await fetch('http://localhost:22071/api/recommend', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file_name: fileName,
            top_n: recommendCount
          })
        });
        
        if (!response.ok) {
          throw new Error(this.$t('music.fetchLabelsFailed') + `: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.recommended_songs) {
          this.recommendedSongs = data.recommended_songs;
        }
      } catch (error) {
        console.error(this.$t('music.fetchLabelsFailed') + ':', error);
        
        // 显示友好的错误提示
        connect.$emit('showTipMessage', {
          type: 'error',
          message: this.$t('music.fetchLabelsFailed'),
          duration: 3000
        });
      } finally {
        this.isLoading = false;
      }
    },
    
    // 获取设置中的推荐歌曲数量
    getRecommendCount() {
      // 从localStorage中获取设置
      const settings = localStorage.getItem('playerSettings');
      if (settings) {
        try {
          const parsedSettings = JSON.parse(settings);
          // 如果设置中有推荐数量，则使用它，否则使用默认值5
          return parsedSettings.recommendCount || 5;
        } catch (error) {
          console.error('解析设置失败:', error);
        }
      }
      // 默认返回5
      return 5;
    },
    
    // 播放推荐的歌曲
    playSong(songName) {
      // 触发事件，让父组件处理播放
      this.$emit('play-song', songName);
      this.close();
    }
  },
  beforeDestroy() {
    connect.$off("recommendedSongsReceived");
  }
}
</script>

<style scoped lang="less">
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}

.recommend-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(5px);
}

.recommend-container {
  background-color: var(--bgColor);
  border-radius: 12px;
  width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
  animation: slide-up 0.4s ease-out;
}

@keyframes slide-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 10;
  cursor: pointer;
  color: var(--textColor);
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 50%;
  transition: all 0.3s;
  
  &:hover {
    color: var(--primaryColor);
    background-color: rgba(0, 0, 0, 0.3);
    transform: rotate(90deg);
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 300px;
  
  .loading-spinner {
    width: 50px;
    height: 50px;
    border: 5px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--primaryColor);
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  p {
    color: var(--textColor);
    font-size: 18px;
  }
}

.recommend-header {
  padding: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  
  h2 {
    margin: 0 0 10px 0;
    color: var(--primaryColor);
    font-size: 24px;
  }
  
  p {
    margin: 0;
    color: var(--secondaryTextColor);
    font-size: 14px;
  }
}

.recommend-list {
  padding: 10px;
  overflow-y: auto;
  max-height: 400px;
  
  .recommend-item {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 5px;
    
    &:hover {
      background-color: rgba(0, 0, 0, 0.05);
      transform: translateY(-2px);
      
      .play-icon {
        opacity: 1;
      }
    }
    
    .song-icon {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      background-color: var(--primaryColor);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 18px;
      margin-right: 15px;
      flex-shrink: 0;
    }
    
    .song-info {
      flex: 1;
      overflow: hidden;
      
      .song-name {
        margin: 0;
        font-size: 16px;
        color: var(--textColor);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    
    .play-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: var(--primaryColor);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      margin-left: 10px;
      flex-shrink: 0;
      opacity: 0;
      transition: opacity 0.2s;
    }
  }
}

.no-recommend {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 0;
  color: var(--secondaryTextColor);
  
  span {
    font-size: 50px;
    margin-bottom: 20px;
    opacity: 0.5;
  }
  
  p {
    font-size: 16px;
  }
}
</style> 