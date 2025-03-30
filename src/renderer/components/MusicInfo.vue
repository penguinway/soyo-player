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
            <div v-if="music.coverSource" class="source-tag">
              <span class="fa-solid fa-circle-info"></span>
              {{ music.coverSource }}
            </div>
          </div>
          <div class="music-details">
            <h2 class="title">{{ music.title || '未知歌曲' }}</h2>
            <p class="artist"><span>{{ $t('music.artist') }}：</span>{{ music.artist || '未知艺术家' }}</p>
            <p class="album"><span>{{ $t('music.album') }}：</span>{{ music.album || '未知专辑' }}</p>
            <p class="year" v-if="music.year"><span>{{ $t('music.year') }}：</span>{{ music.year }}</p>
            <p class="genre" v-if="music.genre"><span>{{ $t('music.genre') }}：</span>{{ music.genre }}</p>
            <p class="fileSize" v-if="music.fileSize"><span>{{ $t('music.fileSize') }}：</span>{{ music.fileSize }}</p>
            
            <div class="lyrics" v-if="music.lyrics">
              <h3>
                {{ $t('music.lyrics') }}
                <small v-if="music.lyricsSource" class="source-info">
                  ({{ music.lyricsSource }})
                </small>
              </h3>
              <div class="lyrics-content">
                <p v-for="(line, index) in formattedLyrics" :key="index">{{ line }}</p>
              </div>
            </div>
            
            <div class="no-lyrics" v-else>
              <p>{{ $t('music.noLyrics') }}</p>
            </div>
            
            <div class="metadata-source" v-if="music.source">
              <p>{{ $t('music.dataSource') }}: {{ music.source }}</p>
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
  
  .source-tag {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background-color: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    
    span {
      margin-right: 5px;
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
    margin-top: 25px;
    
    h3 {
      margin-bottom: 15px;
      color: var(--primaryColor);
      font-size: 20px;
      
      .source-info {
        font-size: 14px;
        color: var(--secondaryTextColor);
        font-weight: normal;
      }
    }
    
    .lyrics-content {
      max-height: 250px;
      overflow-y: auto;
      padding: 15px;
      background-color: rgba(0, 0, 0, 0.05);
      border-radius: 8px;
      border-left: 3px solid var(--primaryColor);
      
      p {
        margin: 8px 0;
        line-height: 1.5;
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
  
  .metadata-source {
    margin-top: 25px;
    padding: 10px 0;
    border-top: 1px dashed var(--borderColor);
    
    p {
      font-size: 14px;
      color: var(--secondaryTextColor);
      margin: 0;
    }
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