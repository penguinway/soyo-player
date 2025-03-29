<template>
  <div
    class="flexbetween my-list-item"
    :class="`${isCurrentVideo?'currentVideo':''} ${theme.hover}`"
    :title="item.msg?item.msg:item.src"
    @dblclick="dblPlaying"
    :style="{'color': isCurrentVideo?'#00B400':'#878788'}"
    @contextmenu.stop="contextmenu"
  >
    <div class="left">
      <span class="fa-solid fa-caret-right" v-if="isCurrentVideo"></span>
      <span
        class="fa-solid fa-eye"
        v-if="oldVideo && oldVideo.id == item.id && !isPlaying && !currentVideo"
      ></span>
      <span style="display:inline-block;width:210px;">{{item.filename}}</span>
    </div>
    <div v-if="!isCurrentVideo && item.currentTime!=0" class="middle">
        {{$t('common.broadcastTo')}}: {{item.currentTime | formatTime}}
    </div>
    <div v-if="!isCurrentVideo && item.currentTime==0" class="middle">
        {{$t('common.finished')}}
    </div>
    <div v-if="isCurrentVideo" class="middle">
        {{isPlaying?$t('common.playing'):$t('common.suspend')}}
    </div>
    <span class="msg" v-if="item.msg">{{item.msg}}</span>
    <div class="flexrowcenter right" v-if="!item.msg">
      <span
        @click.stop="playing"
        v-if="!isPlaying || !isCurrentVideo"
        :title="$t('common.play')"
        class="my-fa fa-solid fa-circle-play"
      ></span>
      <span
        @click.stop="setPlaying(false)"
        v-if="isPlaying && isCurrentVideo"
        :title="$t('common.suspend')"
        class="my-fa fa-solid fa-circle-pause"
      ></span>
      <span style="margin-left:8px;" :title="$t('common.openLocation')" class="my-fa fa-solid fa-box-archive"></span>
      <span style="margin-left:8px;" :title="$t('common.deleteFile')" class="my-fa fa-solid fa-close"></span>
    </div>
  </div>
</template>

<script>
import { mapGetters, mapMutations, mapActions } from "vuex";
import fs from "fs";
import { formatTime } from "../api/util";

export default {
  name: "list-item",
  props: {
    // 播放列表中的一项
    item: {
      type: Object,
      default: function() {
        return {};
      }
    }
  },
  filters: {
    formatTime
  },
  data() {
    return {
      // 点击停止后是否显示停止的视频
      isShowEye: false
    };
  },
  methods: {
    ...mapMutations(["setCurrentVideo", "setPlaying", "setOldVideo"]),
    ...mapActions(["changeVideoList"]),
    setplaying() {
      if (this.item.mode == "local" && !fs.existsSync(this.item.src)) {
        //文件不存在
        if (this.item.msg) {
          //存在文件错误信息
          return;
        }
        // 保存文件错误信息
        let video = Object.assign({}, this.item, { msg: "无效文件" });
        // 修改播放列表
        this.changeVideoList(video);
      } else {
        if (!this.isCurrentVideo) {
          //不是当前播放的视频
          // 设置当前播放的视频为该视频
          this.setCurrentVideo(this.item);
        }
        // 存在文件错误信息
        if (this.item.msg) {
          // 清空文件错误信息
          let video = Object.assign({}, this.item, { msg: "" });
          // 修改播放列表
          this.changeVideoList(video);
        }
        // 设置为播放状态
        this.setPlaying(true);
      }
    },
    playing() {
      this.setplaying();
    },
    dblPlaying() {
      // 要播放的视频是当前正在播放的视频
      if (this.isCurrentVideo) {
        return;
      }
      this.setplaying();
    },
    contextmenu(){
      this.$emit('contextmenu')
    }
  },
  computed: {
    ...mapGetters([
      "currentVideo",
      "currentVideoIndex",
      "videoList",
      "isPlaying",
      "oldVideo",
      "currentTime",
      "theme"
    ]),
    // 是否为当前的歌曲
    isCurrentVideo() {
      return this.currentVideo ? this.item.id == this.currentVideo.id : false;
    }
  }
};
</script>

<style scoped lang="less">
@import "../styles/theme.less";

.my-list-item {
  font-size: 13px;
  height: 40px;
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: default;
  padding: 0 10px;
  margin: 4px 0;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
  background-color: rgba(40, 40, 40, 0.3);
  
  &:hover {
    background-color: rgba(60, 60, 60, 0.4);
    transform: translateX(2px);
  }
  
  &.currentVideo {
    background-image: linear-gradient(to right, rgba(93, 238, 0, 0.1), rgba(75, 204, 0, 0.05));
    border-left: 2px solid @primary-color;
  }
  
  .left {
    display: flex;
    align-items: center;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 50px;
    max-width: 210px;
    font-weight: 500;
    
    span {
      margin-right: 8px;
      
      &.fa-caret-right {
        color: @primary-color;
        animation: pulse 2s infinite;
      }
      
      &.fa-eye {
        color: @text-secondary;
        font-size: 12px;
      }
    }
  }
  
  .middle {
    white-space: nowrap;
    flex: 1;
    padding: 0 10px;
    font-size: 12px;
    color: @text-secondary;
  }
  
  .right {
    opacity: 0;
    transition: opacity 0.2s ease;
    
    .my-fa {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: @text-secondary;
      
      &:hover {
        color: @primary-color;
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      &.fa-close:hover {
        color: #ff5252;
      }
    }
  }
  
  &:hover {
    .right {
      opacity: 1;
    }
  }
}

.msg {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #ff5252;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: rgba(255, 82, 82, 0.1);
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}
</style>