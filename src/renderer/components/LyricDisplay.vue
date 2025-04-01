<template>
  <div class="lyric-container" v-if="visible">
    <div class="lyric-wrapper" ref="lyricWrapper">
      <div class="lyric-content" ref="lyricContent">
        <p 
          v-for="(line, index) in parsedLyrics" 
          :key="index"
          :class="{ 'active': currentLineIndex === index }"
          ref="lyricLines"
        >
          {{ line.text }}
        </p>
        <p v-if="parsedLyrics.length === 0" class="no-lyric">{{ $t('music.noLyrics') || '暂无歌词' }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "lyric-display",
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    currentTime: {
      type: Number,
      default: 0
    },
    lrcContent: {
      type: String,
      default: ""
    }
  },
  data() {
    return {
      parsedLyrics: [],
      currentLineIndex: -1,
      scrollTimer: null
    };
  },
  watch: {
    lrcContent: {
      handler(newVal) {
        if (newVal) {
          this.parseLyrics(newVal);
        } else {
          this.parsedLyrics = [];
          this.currentLineIndex = -1;
        }
      },
      immediate: true
    },
    currentTime: {
      handler(newTime) {
        this.updateCurrentLine(newTime);
      }
    },
    currentLineIndex: {
      handler(newIndex) {
        this.$nextTick(() => {
          this.scrollToCurrentLine();
        });
      }
    }
  },
  methods: {
    // 解析LRC格式歌词
    parseLyrics(lrc) {
      if (!lrc) {
        this.parsedLyrics = [];
        return;
      }
      
      // 清空之前的解析结果
      this.parsedLyrics = [];
      this.currentLineIndex = -1;
      
      // 按行分割歌词内容
      const lines = lrc.split('\n');
      
      // 正则表达式匹配时间标签 [mm:ss.xx]或[mm:ss.xxx]
      const timeRegex = /\[(\d{2}):(\d{2})\.(\d{1,3})\]/g;
      
      lines.forEach(line => {
        // 跳过空行
        if (!line.trim()) return;
        
        // 提取所有时间标签 - 使用exec替代matchAll以提高兼容性
        const timeMatches = [];
        let match;
        while ((match = timeRegex.exec(line)) !== null) {
          timeMatches.push(match);
        }
        
        if (timeMatches.length === 0) return;
        
        // 提取歌词文本（去除所有时间标签）
        const text = line.replace(timeRegex, '').trim();
        if (!text) return; // 跳过没有文本的行
        
        // 为每个时间标签创建一个歌词对象
        timeMatches.forEach(match => {
          const minutes = parseInt(match[1]);
          const seconds = parseInt(match[2]);
          const millisecPart = match[3];
          
          // 根据毫秒部分的位数进行不同的计算
          let milliseconds;
          if (millisecPart.length === 1) {
            // 一位数，如 [00:00.1] 表示 100 毫秒
            milliseconds = parseInt(millisecPart) / 10;
          } else if (millisecPart.length === 2) {
            // 两位数，如 [00:00.10] 表示 100 毫秒
            milliseconds = parseInt(millisecPart) / 100;
          } else {
            // 三位数，如 [00:00.100] 表示 100 毫秒
            milliseconds = parseInt(millisecPart) / 1000;
          }
          
          // 计算总时间（秒）
          const time = minutes * 60 + seconds + milliseconds;
          
          this.parsedLyrics.push({
            time,
            text
          });
        });
      });
      
      // 按时间排序
      this.parsedLyrics.sort((a, b) => a.time - b.time);
    },
    
    // 根据当前播放时间更新当前行
    updateCurrentLine(currentTime) {
      if (this.parsedLyrics.length === 0) return;
      
      // 找到当前时间对应的歌词行
      let index = this.parsedLyrics.findIndex(line => line.time > currentTime);
      
      // 如果找不到比当前时间大的行，说明已经到最后一行
      if (index === -1) {
        index = this.parsedLyrics.length;
      }
      
      // 当前行是上一个时间点的歌词
      this.currentLineIndex = index > 0 ? index - 1 : -1;
    },
    
    // 滚动到当前行
    scrollToCurrentLine() {
      if (this.currentLineIndex < 0 || !this.$refs.lyricLines || !this.$refs.lyricWrapper) return;
      
      // 清除之前的滚动定时器
      if (this.scrollTimer) {
        clearTimeout(this.scrollTimer);
      }
      
      this.scrollTimer = setTimeout(() => {
        const currentLine = this.$refs.lyricLines[this.currentLineIndex];
        if (!currentLine) return;
        
        const wrapperHeight = this.$refs.lyricWrapper.clientHeight;
        const lineTop = currentLine.offsetTop;
        const lineHeight = currentLine.clientHeight;
        
        // 计算滚动位置，使当前行居中显示
        const scrollTop = lineTop - (wrapperHeight / 2) + (lineHeight / 2);
        
        // 使用平滑滚动效果
        this.$refs.lyricWrapper.scrollTo({
          top: Math.max(0, scrollTop),
          behavior: 'smooth'
        });
      }, 100);
    }
  }
};
</script>

<style scoped>
.lyric-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  background-color: rgba(0, 0, 0, 0.5);
  color: #fff;
  z-index: 1;
}

.lyric-wrapper {
  width: 80%;
  height: 70%;
  overflow-y: auto;
  mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
  -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
  scrollbar-width: none; /* Firefox */
}

.lyric-wrapper::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Edge */
}

.lyric-content {
  padding: 30% 0;
  text-align: center;
}

.lyric-content p {
  padding: 8px 0;
  font-size: 16px;
  line-height: 1.5;
  transition: all 0.3s;
  color: rgba(255, 255, 255, 0.7);
}

.lyric-content p.active {
  font-size: 20px;
  font-weight: bold;
  color: #fff;
}

.no-lyric {
  font-style: italic;
  opacity: 0.8;
}
</style>