<template>
  <div class="music-labels-container">
    <div class="music-labels-header">
      <h2>{{ $t('music.labels') }}</h2>
      <div class="music-labels-actions">
        <el-button type="primary" size="small" @click="refreshLabels">{{ $t('common.refresh') }}</el-button>
      </div>
    </div>
    
    <div v-if="loading" class="loading-container">
      <i class="el-icon-loading"></i>
      <p>{{ $t('common.loading') }}</p>
    </div>
    
    <div v-else-if="musicLabels.length === 0" class="empty-container">
      <i class="fa-solid fa-music"></i>
      <p>{{ $t('music.noLabels') }}</p>
      <p>{{ $t('music.playMusicToGetLabels') }}</p>
    </div>
    
    <div v-else class="music-labels-table">
      <el-table
        :data="musicLabels"
        stripe
        style="width: 100%"
        :height="tableHeight"
        :row-class-name="tableRowClassName"
      >
        <el-table-column
          prop="file_name"
          :label="$t('music.fileName')"
          min-width="200"
          show-overflow-tooltip
        >
        </el-table-column>
        <el-table-column
          prop="style_label"
          :label="$t('music.styleLabel')"
          min-width="150"
        >
          <template slot-scope="scope">
            <span v-if="scope.row.style_label">{{ scope.row.style_label }}</span>
            <span v-else class="no-label">{{ $t('music.noStyleLabel') }}</span>
            <el-button 
              v-if="!scope.row.style_label"
              type="text" 
              size="mini" 
              @click="refreshSingleLabel(scope.row)"
              :loading="refreshingId === scope.row.id"
            >
              {{ $t('music.getLabel') }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column
          prop="file_path"
          :label="$t('music.filePath')"
          min-width="300"
          show-overflow-tooltip
        >
        </el-table-column>
        <el-table-column
          :label="$t('common.actions')"
          width="120"
        >
          <template slot-scope="scope">
            <el-button
              type="text"
              size="small"
              @click="playMusic(scope.row.file_path)"
            >
              {{ $t('common.play') }}
            </el-button>
            <el-button
              type="text"
              size="small"
              @click="openContainingFolder(scope.row.file_path)"
            >
              {{ $t('common.locate') }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations } from 'vuex';
import MusicLabelService from '../api/MusicLabelService';
import { remote } from 'electron';
import path from 'path';
import fs from 'fs';

export default {
  name: 'MusicLabels',
  data() {
    return {
      musicLabels: [],
      loading: true,
      tableHeight: 400,
      refreshingId: null
    };
  },
  computed: {
    ...mapGetters([
      'theme',
      'currentVideo'
    ])
  },
  methods: {
    ...mapMutations([
      'setCurrentVideo',
      'setPlaying'
    ]),
    // 设置表格行的样式
    tableRowClassName({row, rowIndex}) {
      if (this.currentVideo && row.file_path === this.currentVideo.src) {
        // 当前播放的音乐行高亮显示
        return 'current-row';
      }
      return '';
    },
    // 刷新音乐标签列表
    async refreshLabels() {
      this.loading = true;
      try {
        const labels = await MusicLabelService.getAllMusicLabels();
        this.musicLabels = labels;
      } catch (error) {
        console.error('获取音乐标签失败:', error);
        this.$message.error(this.$t('music.fetchLabelsFailed'));
      } finally {
        this.loading = false;
      }
    },
    // 刷新单个音乐的标签
    async refreshSingleLabel(music) {
      this.refreshingId = music.id;
      try {
        // 检查文件是否存在
        if (!fs.existsSync(music.file_path)) {
          this.$message.error(this.$t('music.fileNotExist'));
          return;
        }
        
        // 处理音乐文件并获取标签
        const updatedMusic = await MusicLabelService.processMusicFile(music.file_path);
        if (updatedMusic && updatedMusic.style_label) {
          // 更新本地数据
          const index = this.musicLabels.findIndex(item => item.id === music.id);
          if (index !== -1) {
            this.musicLabels[index].style_label = updatedMusic.style_label;
          }
          this.$message.success(this.$t('music.labelUpdated'));
        } else {
          this.$message.warning(this.$t('music.labelUpdateFailed'));
        }
      } catch (error) {
        console.error('刷新音乐标签失败:', error);
        this.$message.error(this.$t('music.labelUpdateFailed'));
      } finally {
        this.refreshingId = null;
      }
    },
    // 播放选中的音乐
    playMusic(filePath) {
      if (!fs.existsSync(filePath)) {
        this.$message.error(this.$t('music.fileNotExist'));
        return;
      }
      
      // 创建视频对象
      const video = {
        id: filePath,
        src: filePath,
        mode: 'local',
        currentTime: 0,
        speed: 1,
        filename: path.basename(filePath)
      };
      
      // 设置到播放器
      this.setCurrentVideo(video);
      this.setPlaying(true);
    },
    // 打开包含文件的文件夹
    openContainingFolder(filePath) {
      if (!fs.existsSync(filePath)) {
        this.$message.error(this.$t('music.fileNotExist'));
        return;
      }
      
      // 使用系统默认文件管理器打开文件所在位置
      remote.shell.showItemInFolder(filePath);
    },
    // 调整表格高度
    adjustTableHeight() {
      // 基于窗口高度动态调整表格高度
      this.tableHeight = window.innerHeight - 200; // 预留头部和其他元素的空间
    }
  },
  mounted() {
    this.refreshLabels();
    this.adjustTableHeight();
    
    // 监听窗口大小变化
    window.addEventListener('resize', this.adjustTableHeight);
  },
  beforeDestroy() {
    // 移除监听器
    window.removeEventListener('resize', this.adjustTableHeight);
  }
};
</script>

<style scoped>
.music-labels-container {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.music-labels-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.music-labels-header h2 {
  margin: 0;
  font-size: 24px;
}

.music-labels-table {
  flex: 1;
}

.loading-container, .empty-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 300px;
  color: #909399;
}

.loading-container i, .empty-container i {
  font-size: 48px;
  margin-bottom: 20px;
}

.no-label {
  color: #909399;
  font-style: italic;
}

/* 设置当前播放行的样式 */
:deep(.current-row) {
  background-color: rgba(64, 158, 255, 0.1) !important;
  font-weight: bold;
}
</style> 