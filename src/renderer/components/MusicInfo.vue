<template>
  <transition name="fade">
    <div class="music-info-modal" v-if="isShow" @click.self="close">
      <div class="music-info-container">
        <div class="close-btn" @click="close">
          <span class="fa-solid fa-xmark"></span>
        </div>
        
        <div v-if="isLoading" class="loading-container">
          <div class="loading-spinner"></div>
          <p>{{ $t('common.loading') }}</p>
        </div>
        
        <template v-else>
          <div class="music-cover">
            <img :src="music.coverImage || require('../assets/musicBg.jpg')" alt="封面">
            <div class="metadata-source" v-if="music.coverSource">
              <span class="fa-solid" :class="coverSourceIcon"></span>
              {{ coverSourceText }}
            </div>
          </div>
          <div class="music-details">
            <h2 class="title">{{ music.title || '未知歌曲' }}</h2>
            <p class="artist"><span>{{ $t('music.artist') }}：</span>{{ music.artist || '未知艺术家' }}</p>
            <p class="album"><span>{{ $t('music.album') }}：</span>{{ music.album || '未知专辑' }}</p>
            <p class="year" v-if="music.year"><span>{{ $t('music.year') }}：</span>{{ music.year }}</p>
            <p class="genre" v-if="music.genre"><span>{{ $t('music.genre') }}：</span>{{ music.genre }}</p>
            <p class="fileSize" v-if="music.fileSize"><span>{{ $t('music.fileSize') }}：</span>{{ music.fileSize }}</p>
            
            <!-- 音乐风格标签 -->
            <div class="style-labels" v-if="parsedStyleLabels.length > 0">
              <h3>{{ $t('music.styleLabel') }}</h3>
              <div class="labels-container">
                <span class="label-tag" v-for="(label, index) in parsedStyleLabels" :key="index">
                  {{ label }}
                </span>
              </div>
            </div>
            
            <div class="lyrics" v-if="music.lyrics">
              <h3>
                {{ $t('music.lyrics') }}
                <span class="metadata-source-inline" v-if="music.lyricsSource">
                  <span class="fa-solid" :class="lyricsSourceIcon"></span>
                  {{ lyricsSourceText }}
                </span>
              </h3>
              <div class="lyrics-content">
                <p v-for="(line, index) in formattedLyrics" :key="index">{{ line }}</p>
              </div>
            </div>
            
            <div class="no-lyrics" v-else>
              <p>{{ $t('music.noLyrics') }}</p>
            </div>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: "music-info",
  props: {
    isShow: {
      type: Boolean,
      default: false
    },
    music: {
      type: Object,
      default: () => ({})
    }
  },
  computed: {
    isLoading() {
      return this.music && this.music.title === '加载中...';
    },
    formattedLyrics() {
      if (!this.music.lyrics) return [];
      return this.music.lyrics.split('\n');
    },
    // 解析风格标签
    parsedStyleLabels() {
      // 优先使用已解析的标签
      if (this.music.parsedLabels && Array.isArray(this.music.parsedLabels)) {
        return this.music.parsedLabels;
      }
      
      // 尝试从styleLabel解析
      if (this.music.styleLabel) {
        try {
          const labels = JSON.parse(this.music.styleLabel);
          return Array.isArray(labels) ? labels : [];
        } catch (e) {
          // 如果解析失败，可能是旧格式的字符串标签
          return this.music.styleLabel ? [this.music.styleLabel] : [];
        }
      }
      
      return [];
    },
    // 封面来源图标
    coverSourceIcon() {
      if (!this.music.coverSource) return '';
      return this.music.coverSource === 'local' ? 'fa-hdd' : 'fa-cloud';
    },
    // 封面来源文本
    coverSourceText() {
      if (!this.music.coverSource) return '';
      return this.music.coverSource === 'local' 
        ? this.$t('music.localSource') 
        : this.$t('music.onlineSource');
    },
    // 歌词来源图标
    lyricsSourceIcon() {
      if (!this.music.lyricsSource) return '';
      return this.music.lyricsSource === 'local' ? 'fa-hdd' : 'fa-cloud';
    },
    // 歌词来源文本
    lyricsSourceText() {
      if (!this.music.lyricsSource) return '';
      return this.music.lyricsSource === 'local' 
        ? this.$t('music.localSource') 
        : this.$t('music.onlineSource');
    }
  },
  methods: {
    close() {
      this.$emit('close');
    }
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

.music-info-modal {
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

.music-info-container {
  background-color: var(--bgColor);
  border-radius: 12px;
  width: 80%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
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

.music-cover {
  flex: 0 0 300px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
  position: relative;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.5s;
    
    &:hover {
      transform: scale(1.05);
    }
  }
  
  .metadata-source {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background-color: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    
    span {
      margin-right: 5px;
      font-size: 10px;
    }
  }
}

.music-details {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
  
  .title {
    margin-top: 0;
    margin-bottom: 20px;
    color: var(--primaryColor);
    font-size: 28px;
    font-weight: 600;
  }
  
  p {
    margin: 12px 0;
    color: var(--textColor);
    font-size: 16px;
    
    span {
      color: var(--secondaryTextColor);
      font-weight: 600;
    }
  }
  
  .lyrics {
    margin-top: 20px;
    
    h3 {
      color: var(--primaryColor);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    
    .metadata-source-inline {
      margin-left: 10px;
      font-size: 12px;
      background-color: rgba(0, 0, 0, 0.05);
      padding: 3px 8px;
      border-radius: 4px;
      color: var(--secondaryTextColor);
      
      span {
        margin-right: 5px;
        font-size: 10px;
      }
    }
    
    .lyrics-content {
      max-height: 200px;
      overflow-y: auto;
      padding: 10px;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      
      p {
        margin: 5px 0;
        font-size: 14px;
        line-height: 1.5;
      }
    }
  }
  
  .style-labels {
    margin-top: 20px;
    
    h3 {
      color: var(--primaryColor);
      margin-bottom: 10px;
    }
    
    .labels-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      
      .label-tag {
        background-color: rgba(var(--primaryColorRgb), 0.15);
        color: var(--primaryColor);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 13px;
        display: inline-block;
        text-transform: lowercase;
        transition: all 0.2s;
        border: 1px solid var(--primaryColor);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        
        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
          background-color: var(--primaryColor);
          color: white;
        }
      }
    }
  }
  
  .no-lyrics {
    margin-top: 25px;
    padding: 15px;
    background-color: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    text-align: center;
    color: var(--secondaryTextColor);
  }
}

@media (max-width: 768px) {
  .music-info-container {
    flex-direction: column;
    max-height: 90vh;
  }
  
  .music-cover {
    flex: 0 0 200px;
  }
  
  .music-details {
    padding: 20px;
  }
}
</style> 