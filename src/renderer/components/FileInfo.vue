<template>
    <div @click="handlerClick" v-if="isShow" class="fileInfo-box">
        <div @click.stop class="box">
            <el-row :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.addTime')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value">{{time}}</div>
                </el-col>
            </el-row>
            <el-row class="mt20" :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.videoSize')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value">{{size}}</div>
                </el-col>
            </el-row>
            <!-- <el-row class="mt20" :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.playStatus')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value">{{video?(video.isPlaying?$t('common.playing'):$t('common.suspend')):''}}</div>
                </el-col>
            </el-row> -->
            <el-row class="mt20" :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.fileType')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value">{{video?(video.mode=='local'?$t('common.localFile'):$t('common.networkFile')):''}}</div>
                </el-col>
            </el-row>
            <!-- <el-row class="mt20" :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.playSpeed')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value">{{video?`${video.speed}${$t('common.times')}`:''}}</div>
                </el-col>
            </el-row> -->
            <el-row class="mt20" :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.filePath')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value path-value">{{video?video.src:''}}</div>
                </el-col>
            </el-row>
            <el-row class="mt20" :gutter="20">
                <el-col :span="6">
                    <div class="label">{{$t('common.fileName')}}: </div>
                </el-col>
                <el-col :span="18">
                    <div class="value">{{video?video.filename:''}}</div>
                </el-col>
            </el-row>
        </div>
    </div>
</template>

<script>
import { getTime, getVideoSize } from "../api/util";
export default {
  props: {
    isShow: {
      type: Boolean,
      default: false
    },
    video: {
      type: Object,
      default: () => null
    }
  },
  methods: {
    handlerClick() {
      this.$emit("click");
    }
  },
  computed:{
      time(){
          return this.video && this.video.createTime ? getTime(this.video.createTime) : ''
      },
      size(){
          return this.video && this.video.size ? getVideoSize(this.video.size) : ''
      }
  }
};
</script>


<style lang="less" scoped>
.fileInfo-box {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
  width: 100%;
  z-index: 100;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  .box {
    background-color: #2e2c29;
    color: #ffffff;
    padding: 20px;
    width: 500px;
    height: auto;
    max-height: 80vh;
    border-radius: 5px;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    
    .label {
      font-weight: bold;
      color: #5dee00;
    }
    
    .value {
      word-break: break-all;
      
      &.path-value {
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
}
.mt20 {
  margin-top: 20px;
}
</style>

