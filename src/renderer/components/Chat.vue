<template>
  <div 
    v-if="isShow"
    :style="{'background-color': theme.bgColor}"
    class="chat-container"
  >
    <div class="chat-header">
      <div class="title">
        {{ $t('common.chat.title') }}
        <span class="model-badge">{{ apiConfig.configured ? apiConfig.model : '未配置' }}</span>
      </div>
      <div class="actions">
        <span v-if="audioProcessing" class="audio-status" :title="$t('common.chat.processingAudio')">
          <span class="fa-solid fa-music fa-beat"></span>
        </span>
        <span @click="configureAPI" class="fa-solid fa-gear" :title="'配置API'"></span>
        <span v-if="isLoggedIn && currentUser && currentUser.isAdmin" @click="toggleDebug" class="fa-solid fa-bug" :title="'调试信息'"></span>
        <span v-if="showDebug" @click="toggleResponseView" class="fa-solid fa-code" :title="'查看原始响应'"></span>
        <span @click="close" class="fa-solid fa-xmark"></span>
      </div>
    </div>
    
    <!-- 调试面板 -->
    <div v-if="showDebug" class="debug-panel">
      <div v-if="showRawResponse" class="raw-response">
        <div class="panel-title">原始响应数据：</div>
        <pre>{{ rawResponseData }}</pre>
      </div>
      <div v-else>
        <pre>{{ debugInfo }}</pre>
      </div>
    </div>
    
    <div class="chat-body">
      <div class="chat-messages" ref="messagesContainer">
        <!-- 欢迎提示 -->
        <div v-if="messages.length === 0" class="welcome-info">
          <div class="welcome-icon">
            <span class="fa-solid fa-robot"></span>
          </div>
          <div class="welcome-text">
            <p>{{ $t('common.chat.supportInfo') }}</p>
            <p>{{ $t('common.chat.selectFile') }}</p>
          </div>
        </div>
        
        <div 
          v-for="(message, index) in messages" 
          :key="index" 
          :class="['message', message.role]"
        >
          <div v-if="message.role === 'user'" class="user-avatar">
            <span>{{ currentUser && currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U' }}</span>
          </div>
          <div v-else class="ai-avatar">
            <span class="fa-solid fa-robot"></span>
          </div>
          <div class="message-content">
            <div v-if="message.role === 'user'" class="user-name">{{ currentUser && currentUser.username ? currentUser.username : $t('user.notLoggedIn') }}</div>
            <div v-else class="ai-name">AI</div>
            <div class="message-text" v-html="formatMessage(message.content)"></div>
            <div v-if="message.audioUrl" class="audio-message">
              <audio controls>
                <source :src="message.audioUrl" type="audio/wav">
                {{ $t('common.chat.audioNotSupported') }}
              </audio>
            </div>
          </div>
        </div>
        <div v-if="processing" class="processing-indicator">
          {{ $t('common.chat.processing') }}
          <span class="dot-one">.</span>
          <span class="dot-two">.</span>
          <span class="dot-three">.</span>
        </div>
      </div>
      
      <div class="chat-controls">
        <div class="media-controls">
          <button 
            @click="toggleMediaType('text')" 
            :class="['media-button', mediaType === 'text' ? 'active' : '']"
            :title="$t('common.chat.textOnly')"
          >
            <span class="fa-solid fa-comment"></span>
          </button>
          <button 
            @click="toggleMediaType('audio')" 
            :class="['media-button', mediaType === 'audio' ? 'active' : '']"
            :title="$t('common.chat.audioChat')"
            :disabled="!isAudioAvailable"
          >
            <span class="fa-solid fa-music"></span>
          </button>
          <button 
            @click="toggleMediaType('video')" 
            :class="['media-button', mediaType === 'video' ? 'active' : '']"
            :title="$t('common.chat.videoChat')"
            :disabled="!isVideoAvailable"
          >
            <span class="fa-solid fa-video"></span>
          </button>
        </div>
        
        <div class="input-container">
          <textarea 
            v-model="userInput" 
            :placeholder="$t('common.chat.placeholder')"
            @keydown.enter.ctrl.exact="sendMessage"
            ref="inputField"
          ></textarea>
          <div class="send-button" @click="sendMessage">
            <span class="fa-solid fa-paper-plane"></span>
          </div>
        </div>
        
        <div class="extra-controls">
          <button @click="clearChat" class="control-button" :title="$t('common.chat.clearChat')">
            <span class="fa-solid fa-trash"></span>
          </button>
          <button @click="retryLastMessage" class="control-button" :title="'重试上一条消息'">
            <span class="fa-solid fa-rotate"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import connect from "../api/bus.js";
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { ipcRenderer } from "electron";

export default {
  name: 'chat-dialog',
  data() {
    return {
      isShow: false,
      userInput: '',
      messages: [],
      processing: false,
      audioProcessing: false,
      apiKey: '',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-omni-turbo',
      mediaType: 'text',
      apiConfig: {
        configured: false,
        apiKey: '',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-omni-turbo',
      },
      availableModels: [
        { value: 'qwen-omni-turbo', label: 'Qwen Omni Turbo' },
        { value: 'qwen-omni-turbo-latest', label: 'Qwen Omni Turbo Latest' },

      ],
      debugInfo: '',
      showDebug: false,
      showRawResponse: false,
      rawResponseData: '暂无数据',
      lastRawResponses: [],
    };
  },
  props: {
    showChatProp: {
      type: Boolean,
      default: false
    }
  },
  watch: {
    isShow(newVal) {
      if (newVal) {
        this.$nextTick(() => {
          this.$refs.inputField.focus();
          this.scrollToBottom();
        });
      }
    },
    showChatProp(newVal) {
      this.isShow = newVal;
    },
    messages() {
      this.$nextTick(() => {
        this.scrollToBottom();
      });
    }
  },
  mounted() {
    connect.$on("showChat", this.show);
    this.loadAPIConfig();
  },
  beforeDestroy() {
    connect.$off("showChat", this.show);
  },
  computed: {
    ...mapGetters([
      "currentVideo",
      "theme",
      "currentUser",
      "isLoggedIn"
    ]),
    isAudioAvailable() {
      if (!this.currentVideo) return false;
      
      // 检查当前媒体是否是音频并且大小不超过10MB
      const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(
        path.extname(this.currentVideo.src).toLowerCase()
      );
      
      if (isAudio && this.currentVideo.size > 10 * 1024 * 1024) {
        // 音频太大，返回false但不显示消息，等到用户实际点击音频按钮时再显示
        return false;
      }
      
      return isAudio;
    },
    isVideoAvailable() {
      if (!this.currentVideo) return false;
      
      // 检查当前媒体是否是视频并且大小不超过150MB
      const isVideo = ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(
        path.extname(this.currentVideo.src).toLowerCase()
      );
      
      if (isVideo && this.currentVideo.size > 150 * 1024 * 1024) {
        // 视频太大，返回false但不显示消息，等到用户实际点击视频按钮时再显示
        return false;
      }
      
      return isVideo;
    }
  },
  methods: {
    show() {
      this.isShow = true;
      // 清空历史记录，只保留一问一答
      this.messages = [];
    },
    close() {
      this.isShow = false;
    },
    formatMessage(text) {
      // 简单的文本格式化，处理换行和链接
      if (!text) return '';
      
      // 将换行符转换为HTML换行
      let formatted = text.replace(/\n/g, '<br>');
      
      // 识别URL并转换为链接
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
      
      return formatted;
    },
    async sendMessage(e) {
      if (e && e.preventDefault) {
        e.preventDefault();
      }
      
      if (!this.userInput.trim() || this.processing) return;
      
      // 检查API配置
      if (!this.apiConfig.configured) {
        this.messages = [{
          role: 'assistant',
          content: this.$t('common.chat.apiKeyRequired')
        }];
        this.configureAPI();
        return;
      }
      
      // 清空之前的消息，只保留当前一问一答
      this.messages = [];
      
      // 添加用户消息
      const userMessage = {
        role: 'user',
        content: this.userInput.trim()
      };
      
      this.messages.push(userMessage);
      this.userInput = '';
      this.processing = true;
      this.audioProcessing = false; // 重置音频处理状态
      
      try {
        this.debugLog('准备API请求...');
        // 准备请求内容
        let messageContent = [];
        
        // 添加文本内容
        messageContent.push({ 
          type: "text", 
          text: userMessage.content 
        });
        
        // 根据媒体类型添加音频或视频
        if (this.mediaType === 'audio' && this.isAudioAvailable) {
          try {
            this.debugLog('处理音频文件...');
            // 读取音频文件并转换为base64
            const audioData = await this.getFileAsBase64(this.currentVideo.src);
            this.debugLog(`音频文件编码完成，大小: ${Math.round(audioData.length / 1024)}KB`);
            messageContent.unshift({
              type: "input_audio",
              input_audio: {
                data: `data:;base64,${audioData}`,
                format: path.extname(this.currentVideo.src).substring(1)
              }
            });
          } catch (error) {
            console.error('Error processing audio:', error);
            this.debugLog(`音频处理错误: ${error.message}`);
            this.$message.error(this.$t('common.chat.audioProcessingError'));
          }
        } else if (this.mediaType === 'video' && this.isVideoAvailable) {
          try {
            this.debugLog('处理视频文件...');
            // 读取视频文件并转换为base64
            const videoData = await this.getFileAsBase64(this.currentVideo.src);
            this.debugLog(`视频文件编码完成，大小: ${Math.round(videoData.length / 1024)}KB`);
            messageContent.unshift({
              type: "video_url",
              video_url: {
                url: `data:;base64,${videoData}`,
              }
            });
          } catch (error) {
            console.error('Error processing video:', error);
            this.debugLog(`视频处理错误: ${error.message}`);
            this.$message.error(this.$t('common.chat.videoProcessingError'));
          }
        }
        
        // 构建API请求
        const requestBody = {
          model: this.apiConfig.model,
          messages: [
            {
              role: "system",
              content: [{ type: "text", text: "You are a helpful assistant." }]
            },
            {
              role: "user",
              content: messageContent
            }
          ],
          stream: true,
          stream_options: {
            include_usage: true
          },
          modalities: ["text"],
        };
        
        // 记录请求体便于调试
        this.debugLog(`请求体: ${JSON.stringify(requestBody).substring(0, 200)}...`);
        
        // 添加助手消息，准备接收回复
        let assistantMessage = {
          role: 'assistant',
          content: ''
        };
        this.messages.push(assistantMessage);
        
        this.debugLog('发送API请求...');
        // 使用fetch API替代axios来处理流式响应
        const response = await fetch(`${this.apiConfig.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiConfig.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          this.debugLog(`API请求失败: HTTP ${response.status} - ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }
        
        this.debugLog(`API响应状态: ${response.status}`);
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let audioData = null;
        let buffer = '';
        let messageComplete = false;
        
        // 读取流数据
        while (!messageComplete) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.debugLog('流式响应接收完成 (done=true)');
              messageComplete = true;
              break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            this.debugLog(`接收数据块，长度: ${chunk.length}`);
            
            // 将新块添加到缓冲区
            buffer += chunk;
            
            // 处理buffer中的每一行
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              if (line.startsWith('data:')) {
                try {
                  const jsonText = line.substring(5).trim();
                  if (jsonText.length > 0) {
                    this.debugLog(`解析JSON: ${jsonText.substring(0, 50)}...`);
                    
                    // 存储原始响应用于调试
                    this.lastRawResponses.push(jsonText);
                    if (this.lastRawResponses.length > 10) {
                      this.lastRawResponses.shift(); // 保留最近的10条
                    }
                    this.rawResponseData = this.lastRawResponses.join('\n\n');
                    
                    // 跳过[DONE]标记
                    if (jsonText === '[DONE]') {
                      this.debugLog('收到完成标记');
                      messageComplete = true;
                      continue;
                    }
                    
                    const jsonData = JSON.parse(jsonText);
                    this.debugLog(`JSON解析成功，类型: ${jsonData.object || 'unknown'}`);
                    
                    // 打印完整的JSON便于调试
                    console.log('完整JSON响应:', jsonData);
                    
                    if (jsonData.choices && jsonData.choices.length > 0) {
                      // 检查delta是否存在
                      const delta = jsonData.choices[0].delta;
                      if (delta) {
                        // 获取内容
                        const content = delta.content;
                        if (content) {
                          this.debugLog(`收到文本内容: "${content.substring(0, 20)}${content.length > 20 ? '...' : ''}"`);
                          assistantMessage.content += content;
                          // 强制更新视图
                          this.$set(assistantMessage, 'content', assistantMessage.content);
                          this.$forceUpdate();
                          this.scrollToBottom();
                        }
                      }
                    }
                    
                    // 检查是否有音频数据
                    if (jsonData.audio && jsonData.audio.data) {
                      this.debugLog(`收到音频数据，长度: ${jsonData.audio.data.length}`);
                      // 标记正在处理音频
                      this.audioProcessing = true;
                      // 如果音频数据包含前缀，去掉前缀
                      let audioDataStr = jsonData.audio.data;
                      if (audioDataStr.startsWith('data:audio/')) {
                        const base64StartIndex = audioDataStr.indexOf('base64,');
                        if (base64StartIndex !== -1) {
                          audioDataStr = audioDataStr.substring(base64StartIndex + 7);
                        }
                      }
                      audioData = audioDataStr;
                    }
                  } else {
                    this.debugLog('收到空JSON文本');
                  }
                } catch (error) {
                  console.error('Error parsing JSON:', error);
                  this.debugLog(`JSON解析错误: ${error.message}, 行内容: ${line.substring(0, 50)}...`);
                  // 记录完整的行内容到控制台，有助于调试
                  console.log('完整行内容:', line);
                }
              }
            }
          } catch (streamError) {
            console.error('Stream reading error:', streamError);
            this.debugLog(`流读取错误: ${streamError.message}`);
            messageComplete = true; // 出错时结束循环
          }
        }
        
        // 处理完成后，如果有音频数据，添加到消息中
        if (audioData) {
          try {
            this.debugLog('处理音频响应数据...');
            let audioArrayBuffer;
            // 检查音频数据格式
            if (typeof audioData === 'string') {
              try {
                // 创建一个Blob URL用于音频播放
                audioArrayBuffer = this.base64ToArrayBuffer(audioData);
              } catch (error) {
                this.debugLog(`Base64转换错误: ${error.message}`);
                // 尝试直接使用Buffer处理
                audioArrayBuffer = Buffer.from(audioData, 'base64');
              }
            } else {
              // 如果已经是Buffer或ArrayBuffer类型
              audioArrayBuffer = audioData;
            }
            
            const blob = new Blob([audioArrayBuffer], { type: 'audio/wav' });
            this.$set(assistantMessage, 'audioUrl', URL.createObjectURL(blob));
            this.debugLog('音频URL创建成功');
            // 音频处理完成
            this.audioProcessing = false;
          } catch (error) {
            console.error('Error creating audio blob:', error);
            this.debugLog(`创建音频Blob错误: ${error.message}`);
          }
        }
        
        // 检查是否收到了有效响应
        if (assistantMessage.content.trim() === '') {
          // 响应为空，添加错误提示
          this.debugLog('警告: 收到空响应');
          this.$set(assistantMessage, 'content', '未接收到有效回复。请检查API配置或网络连接。');
        }
        
        this.processing = false;
        this.$forceUpdate();
        this.scrollToBottom();
      } catch (error) {
        console.error('API request error:', error);
        this.debugLog(`API请求错误: ${error.message}`);
        this.processing = false;
        
        // 如果存在部分响应（助手消息已添加），则移除
        if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'assistant') {
          this.messages.pop();
        }
        
        // 添加错误消息
        this.messages.push({
          role: 'assistant',
          content: `${this.$t('common.chat.apiError')}: ${error.message}`
        });
      }
    },
    // 调试日志方法
    debugLog(message) {
      const timestamp = new Date().toLocaleTimeString();
      const logMessage = `[${timestamp}] ${message}`;
      console.log(logMessage);
      this.debugInfo = logMessage + '\n' + this.debugInfo;
      
      // 保持日志不超过50行
      const lines = this.debugInfo.split('\n');
      if (lines.length > 50) {
        this.debugInfo = lines.slice(0, 50).join('\n');
      }
    },
    // 切换调试面板显示
    toggleDebug() {
      this.showDebug = !this.showDebug;
      if (!this.showDebug) {
        this.showRawResponse = false;
      }
    },
    toggleResponseView() {
      this.showRawResponse = !this.showRawResponse;
    },
    // Base64转ArrayBuffer工具方法
    base64ToArrayBuffer(base64) {
      const binaryString = window.atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    },
    scrollToBottom() {
      if (this.$refs.messagesContainer) {
        this.$refs.messagesContainer.scrollTop = this.$refs.messagesContainer.scrollHeight;
      }
    },
    async getFileAsBase64(filePath) {
      try {
        // 读取文件
        const data = await fs.promises.readFile(filePath);
        // 转换为base64
        return Buffer.from(data).toString('base64');
      } catch (error) {
        console.error('Error reading file:', error);
        throw error;
      }
    },
    toggleMediaType(type) {
      // 如果当前未选择文件，直接显示提示
      if (!this.currentVideo && (type === 'audio' || type === 'video')) {
        this.$message({
          type: 'warning',
          message: this.$t('common.chat.noMediaSelected'),
          showClose: true,
          duration: 3000
        });
        return;
      }
      
      if (this.mediaType === type) {
        // 如果点击的是当前类型，切换回文本模式
        this.mediaType = 'text';
      } else {
        // 否则切换到选定的类型
        // 先检查选定的媒体类型是否可用
        if (type === 'audio') {
          if (!this.currentVideo) {
            this.$message({
              type: 'warning',
              message: this.$t('common.chat.noMediaSelected'),
              showClose: true,
              duration: 3000
            });
            return;
          }
          
          const fileSize = Math.round(this.currentVideo.size / (1024 * 1024));
          const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.aac'].includes(
            path.extname(this.currentVideo.src).toLowerCase()
          );
          
          if (!isAudio) {
            this.$message({
              type: 'warning',
              message: '当前文件不是支持的音频格式',
              showClose: true,
              duration: 3000
            });
            return;
          }
          
          if (fileSize > 10) {
            this.$message({
              type: 'warning',
              message: `${this.$t('common.chat.audioTooLarge')} (${fileSize}MB > 10MB)`,
              showClose: true,
              duration: 3000
            });
            return;
          }
          
          // 检查音频时长
          this.checkMediaDuration(this.currentVideo.src, 'audio').then(duration => {
            if (duration < 5) {
              this.$message({
                type: 'warning',
                message: `音频时长过短，至少需要5秒 (当前: ${Math.round(duration)}秒)`,
                showClose: true,
                duration: 3000
              });
              this.mediaType = 'text';
              return;
            } else if (duration > 180) { // 3分钟 = 180秒
              this.$message({
                type: 'warning',
                message: `音频时长过长，最多支持3分钟 (当前: ${Math.round(duration)}秒)`,
                showClose: true,
                duration: 3000
              });
              this.mediaType = 'text';
              return;
            } else {
              this.mediaType = type;
              this.$message({
                type: 'success',
                message: '已切换到音频对话模式',
                duration: 2000
              });
            }
          }).catch(err => {
            console.error('Error checking audio duration:', err);
            this.$message({
              type: 'error',
              message: '无法检测音频时长，请尝试其他文件',
              showClose: true,
              duration: 3000
            });
            this.mediaType = 'text';
          });
          return; // 等待异步检查完成
        }
        
        if (type === 'video') {
          if (!this.currentVideo) {
            this.$message({
              type: 'warning',
              message: this.$t('common.chat.noMediaSelected'),
              showClose: true,
              duration: 3000
            });
            return;
          }
          
          const fileSize = Math.round(this.currentVideo.size / (1024 * 1024));
          const isVideo = ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(
            path.extname(this.currentVideo.src).toLowerCase()
          );
          
          if (!isVideo) {
            this.$message({
              type: 'warning',
              message: '当前文件不是支持的视频格式',
              showClose: true,
              duration: 3000
            });
            return;
          }
          
          if (fileSize > 150) {
            this.$message({
              type: 'warning',
              message: `${this.$t('common.chat.videoTooLarge')} (${fileSize}MB > 150MB)`,
              showClose: true,
              duration: 3000
            });
            return;
          }
          
          // 检查视频时长
          this.checkMediaDuration(this.currentVideo.src, 'video').then(duration => {
            if (duration < 5) {
              this.$message({
                type: 'warning',
                message: `视频时长过短，至少需要5秒 (当前: ${Math.round(duration)}秒)`,
                showClose: true,
                duration: 3000
              });
              this.mediaType = 'text';
              return;
            } else if (duration > 40) {
              this.$message({
                type: 'warning',
                message: `视频时长过长，最多支持40秒 (当前: ${Math.round(duration)}秒)`,
                showClose: true,
                duration: 3000
              });
              this.mediaType = 'text';
              return;
            } else {
              this.mediaType = type;
              this.$message({
                type: 'success',
                message: '已切换到视频对话模式',
                duration: 2000
              });
            }
          }).catch(err => {
            console.error('Error checking video duration:', err);
            this.$message({
              type: 'error',
              message: '无法检测视频时长，请尝试其他文件',
              showClose: true,
              duration: 3000
            });
            this.mediaType = 'text';
          });
          return; // 等待异步检查完成
        }
        
        this.mediaType = type;
      }
    },
    
    // 检查媒体文件时长
    async checkMediaDuration(filePath, mediaType) {
      return new Promise((resolve, reject) => {
        try {
          const element = mediaType === 'audio' ? new Audio() : document.createElement('video');
          element.preload = 'metadata';
          
          element.onloadedmetadata = () => {
            const duration = element.duration;
            // 释放资源
            URL.revokeObjectURL(element.src);
            resolve(duration);
          };
          
          element.onerror = () => {
            URL.revokeObjectURL(element.src);
            reject(new Error(`Failed to load ${mediaType} metadata`));
          };
          
          // 支持本地文件路径
          if (filePath.startsWith('http')) {
            element.src = filePath;
          } else {
            // 使用文件协议加载本地文件
            element.src = URL.createObjectURL(new File([fs.readFileSync(filePath)], path.basename(filePath)));
          }
        } catch (error) {
          reject(error);
        }
      });
    },
    clearChat() {
      this.messages = [];
    },
    configureAPI() {
      // 创建模型选择的选项
      const modelOptions = this.availableModels.map(model => 
        `<option value="${model.value}" ${this.apiConfig.model === model.value ? 'selected' : ''}>${model.label}</option>`
      ).join('');
      
      // 创建带有模型选择的HTML
      const html = `
        <div style="margin-bottom: 15px;">
          <input 
            type="text" 
            placeholder="API Key (sk-xxx)" 
            value="${this.apiConfig.apiKey || ''}" 
            id="apiKeyInput"
            style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #555; background: rgba(40, 40, 40, 0.8); color: #fff;"
          />
        </div>
        <div style="margin-bottom: 10px;">
          <label style="display: block; margin-bottom: 5px; font-size: 14px;">选择模型:</label>
          <select 
            id="modelSelect" 
            style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid #555; background: rgba(40, 40, 40, 0.8); color: #fff;"
          >
            ${modelOptions}
          </select>
        </div>
      `;
      
      // 使用Element UI的MessageBox显示自定义内容
      this.$confirm(html, this.$t('common.chat.configureAPI'), {
        confirmButtonText: this.$t('common.ok'),
        cancelButtonText: this.$t('common.cancel'),
        dangerouslyUseHTMLString: true,
        customClass: 'api-config-dialog'
      }).then(() => {
        // 获取输入值
        const apiKeyInput = document.getElementById('apiKeyInput');
        const modelSelect = document.getElementById('modelSelect');
        
        if (apiKeyInput && apiKeyInput.value.trim()) {
          this.apiConfig.apiKey = apiKeyInput.value.trim();
          this.apiConfig.configured = true;
          
          // 更新模型选择
          if (modelSelect) {
            this.apiConfig.model = modelSelect.value;
          }
          
          this.saveAPIConfig();
          this.$message({
            type: 'success',
            message: 'API设置已保存'
          });
        }
      }).catch(() => {
        // 用户取消
      });
    },
    saveAPIConfig() {
      try {
        // 使用localStorage保存API配置
        localStorage.setItem('chatAPIConfig', JSON.stringify(this.apiConfig));
      } catch (error) {
        console.error('Error saving API config:', error);
      }
    },
    loadAPIConfig() {
      try {
        // 从localStorage加载API配置
        const savedConfig = localStorage.getItem('chatAPIConfig');
        if (savedConfig) {
          this.apiConfig = JSON.parse(savedConfig);
        }
      } catch (error) {
        console.error('Error loading API config:', error);
      }
    },
    // 重试上一次发送
    retryLastMessage() {
      if (this.messages.length >= 2) {
        // 移除最后一条消息(AI回复)
        this.messages.pop();
        
        // 获取用户的上一条消息
        const lastUserMessage = this.messages[this.messages.length - 1];
        
        // 移除用户消息以便重新发送
        this.messages.pop();
        
        // 设置用户输入并发送
        this.userInput = lastUserMessage.content;
        this.$nextTick(() => {
          this.sendMessage();
        });
      }
    },
  }
}
</script>

<style lang="less" scoped>
@import "../styles/theme.less";

// 定义缺失的变量
@primary-color-transparent: rgba(93, 238, 0, 0.3);
@border-color: rgba(100, 100, 100, 0.2);
@header-bg-color: rgba(30, 30, 30, 0.3);
@avatar-text-color: rgba(0, 0, 0, 0.8);
@secondary-bg-color: #3a3a3a;
@link-color: #5dee00;
@input-bg-color: rgba(40, 40, 40, 0.6);
@placeholder-color: rgba(200, 200, 200, 0.4);

.chat-container {
  position: fixed;
  top: 48px;
  right: 50px;
  width: 500px;
  height: 580px;
  z-index: 100;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  backdrop-filter: blur(15px);
  background-color: rgba(18, 18, 18, 0.75);
  animation: slideIn 0.3s ease;
  border: 1px solid @primary-color-transparent;
  
  &:before {
    position: absolute;
    top: -8px;
    right: 95px;
    content: "";
    height: 0;
    width: 0;
    border: 4px solid transparent;
    border-bottom-color: @primary-color;
  }
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid @border-color;
  background-color: @header-bg-color;
  
  .title {
    font-size: 16px;
    font-weight: 600;
    color: @text-color;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
    
    .model-badge {
      font-size: 12px;
      background-color: rgba(93, 238, 0, 0.2);
      color: @primary-color;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 400;
    }
  }
  
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .audio-status {
      color: @primary-color;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: rgba(93, 238, 0, 0.1);
    }
    
    span {
      cursor: pointer;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background-color: rgba(80, 80, 80, 0.2);
      transition: all 0.2s ease;
      
      &:hover {
        background-color: rgba(100, 100, 100, 0.3);
        color: @primary-color;
      }
    }
  }
}

.chat-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: rgba(25, 25, 25, 0.5);
}

.chat-messages {
  flex: 1;
  overflow-y: scroll;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overscroll-behavior: contain;
  
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(93, 238, 0, 0.3);
    border-radius: 5px;
  }
  
  &::-webkit-scrollbar-track {
    background-color: rgba(30, 30, 30, 0.2);
    border-radius: 5px;
  }
  
  .welcome-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    margin-top: 50px;
    text-align: center;
    
    .welcome-icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, rgba(93, 238, 0, 0.2), rgba(63, 178, 0, 0.1));
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
      
      span {
        font-size: 30px;
        color: @primary-color;
      }
    }
    
    .welcome-text {
      color: @text-secondary;
      font-size: 14px;
      line-height: 1.6;
      max-width: 80%;
      
      p {
        margin: 8px 0;
      }
    }
  }
}

.message {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  margin-bottom: 14px;
  position: relative;
  
  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;
    padding-left: 15%;
    
    .message-content {
      background: linear-gradient(135deg, rgba(93, 238, 0, 0.15), rgba(93, 238, 0, 0.05));
      border-radius: 15px 2px 15px 15px;
      border-right: 2px solid rgba(93, 238, 0, 0.5);
      width: auto;
      max-width: 100%;
    }
  }
  
  &.assistant {
    align-self: flex-start;
    padding-right: 15%;
    
    .message-content {
      background: linear-gradient(135deg, rgba(50, 50, 50, 0.4), rgba(40, 40, 40, 0.3));
      border-radius: 2px 15px 15px 15px;
      border-left: 2px solid rgba(100, 100, 100, 0.4);
      width: auto;
      max-width: 100%;
    }
  }
}

.user-avatar, .ai-avatar {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  flex-shrink: 0;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
  align-self: flex-start;
}

.user-avatar {
  background-image: linear-gradient(135deg, @primary-color, darken(@primary-color, 20%));
  color: @avatar-text-color;
  font-size: 15px;
}

.ai-avatar {
  background: linear-gradient(135deg, @secondary-bg-color, darken(@secondary-bg-color, 15%));
  color: @primary-color;
  font-size: 16px;
  border: 1px solid @primary-color-transparent;
}

.message-content {
  padding: 10px 14px;
  max-width: 100%;
  word-break: break-word;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  
  .user-name, .ai-name {
    font-size: 12px;
    margin-bottom: 5px;
    opacity: 0.7;
    font-weight: 600;
  }
  
  .message-text {
    font-size: 14px;
    line-height: 1.5;
    width: 100%;
    overflow-wrap: break-word;
    
    a {
      color: @link-color;
      text-decoration: none;
      border-bottom: 1px dashed @primary-color-transparent;
      
      &:hover {
        border-bottom-style: solid;
      }
    }
  }
  
  .audio-message {
    margin-top: 12px;
    width: 100%;
    background: rgba(30, 30, 30, 0.3);
    border-radius: 8px;
    padding: 5px;
    
    audio {
      width: 100%;
      height: 32px;
    }
  }
}

.chat-controls {
  padding: 12px;
  background-color: rgba(30, 30, 30, 0.4);
  border-top: 1px solid rgba(100, 100, 100, 0.2);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-container {
  position: relative;
  display: flex;
  align-items: flex-end;
  
  textarea {
    flex: 1;
    height: 70px;
    max-height: 120px;
    resize: none;
    background-color: @input-bg-color;
    border: 1px solid @border-color;
    border-radius: 10px;
    padding: 12px 50px 12px 15px;
    color: @text-color;
    font-size: 14px;
    line-height: 1.5;
    box-shadow: inset 0 1px 5px rgba(0, 0, 0, 0.2);
    
    &:focus {
      outline: none;
      border-color: @primary-color-transparent;
      box-shadow: 0 0 0 2px rgba(93, 238, 0, 0.1);
    }
    
    &::placeholder {
      color: @placeholder-color;
    }
  }
  
  .send-button {
    position: absolute;
    right: 10px;
    bottom: 10px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, @primary-color, darken(@primary-color, 15%));
    color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(93, 238, 0, 0.3);
    
    &:hover {
      transform: scale(1.1);
      box-shadow: 0 3px 12px rgba(93, 238, 0, 0.4);
    }
    
    &:active {
      transform: scale(0.95);
    }
  }
}

.media-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
}

.media-button {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(40, 40, 40, 0.6);
  border: 1px solid rgba(100, 100, 100, 0.3);
  color: @text-secondary;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background-color: rgba(60, 60, 60, 0.6);
    color: @text-color;
    transform: translateY(-1px);
  }
  
  &.active {
    background: linear-gradient(135deg, rgba(93, 238, 0, 0.2), rgba(63, 178, 0, 0.1));
    border-color: rgba(93, 238, 0, 0.5);
    color: @primary-color;
    box-shadow: 0 2px 8px rgba(93, 238, 0, 0.15);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.extra-controls {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.control-button {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  border: none;
  color: @text-secondary;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    color: @text-color;
    background-color: rgba(60, 60, 60, 0.5);
    transform: translateY(-1px);
  }
}

.processing-indicator {
  align-self: center;
  padding: 10px 16px;
  background-color: rgba(40, 40, 40, 0.6);
  border-radius: 20px;
  font-size: 14px;
  color: @text-secondary;
  margin: 10px 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  
  .dot-one, .dot-two, .dot-three {
    animation: dot-pulse 1.5s infinite;
    display: inline-block;
  }
  
  .dot-two {
    animation-delay: 0.2s;
  }
  
  .dot-three {
    animation-delay: 0.4s;
  }
}

@keyframes dot-pulse {
  0% { opacity: 0.2; }
  50% { opacity: 1; }
  100% { opacity: 0.2; }
}

@keyframes slideIn {
  0% { 
    opacity: 0; 
    transform: translateY(-20px); 
  }
  100% { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

.debug-panel {
  padding: 10px;
  background-color: rgba(0, 0, 0, 0.8);
  color: #33ff33;
  font-family: monospace;
  font-size: 11px;
  max-height: 150px;
  overflow-y: auto;
  border-bottom: 1px solid rgba(100, 200, 100, 0.5);
  
  .panel-title {
    margin-bottom: 5px;
    color: #ffcc00;
    font-weight: bold;
  }
  
  .raw-response {
    color: #66ccff;
    
    pre {
      color: #ffffff;
    }
  }
  
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  &::-webkit-scrollbar {
    width: 5px;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(93, 238, 0, 0.5);
    border-radius: 5px;
  }
  
  &::-webkit-scrollbar-track {
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 5px;
  }
}
</style>

<style>
/* 全局样式 - 配置对话框 */
.api-config-dialog .el-message-box__header {
  background-color: rgba(30, 30, 30, 0.95);
  border-bottom: 1px solid rgba(100, 100, 100, 0.2);
  padding: 15px;
}

.api-config-dialog .el-message-box__title {
  color: #fff;
  font-size: 16px;
}

.api-config-dialog .el-message-box__content {
  background-color: rgba(30, 30, 30, 0.95);
  padding: 20px;
  color: #ddd;
}

.api-config-dialog .el-message-box__btns {
  background-color: rgba(30, 30, 30, 0.95);
  border-top: 1px solid rgba(100, 100, 100, 0.2);
  padding: 12px;
}

.api-config-dialog .el-button {
  background-color: rgba(60, 60, 60, 0.8);
  border-color: rgba(100, 100, 100, 0.3);
  color: #ddd;
}

.api-config-dialog .el-button--primary {
  background-color: rgba(93, 238, 0, 0.2);
  border-color: rgba(93, 238, 0, 0.5);
  color: #5dee00;
}

.api-config-dialog .el-message-box {
  background-color: rgba(30, 30, 30, 0.95);
  border-radius: 10px;
  border: 1px solid rgba(100, 100, 100, 0.2);
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}
</style> 