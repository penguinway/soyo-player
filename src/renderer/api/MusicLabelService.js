import axios from 'axios';
import path from 'path';
import fs from 'fs';
import userDB from './database';
import { musicSuffix } from './util';
import { translateMusicLabel } from './musicLabelMapping';

/**
 * 音乐标签服务
 * 用于处理音乐文件的风格标签信息，包括本地数据库存储和API请求
 */
class MusicLabelService {
  /**
   * 处理音乐文件并管理其标签信息
   * @param {string} filePath - 音乐文件路径
   * @returns {Promise<Object>} - 标签信息对象
   */
  async processMusicFile(filePath) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error('文件不存在');
      }

      // 检查是否为音乐文件
      const extname = path.extname(filePath).toLowerCase();
      if (!musicSuffix.includes(extname)) {
        throw new Error('不是支持的音乐文件格式');
      }

      // 获取文件名
      const fileName = path.basename(filePath);

      // 从数据库查询该文件是否存在
      let musicRecord = userDB.getMusicLabel(filePath);

      // 如果记录不存在，创建新记录
      if (!musicRecord) {
        // 先保存基本信息，风格标签为空
        userDB.saveMusicLabel(fileName, filePath);
        
        // 从API获取风格标签
        try {
          const styleLabel = await this.fetchMusicStyleLabel(filePath);
          if (styleLabel) {
            // 更新数据库中的风格标签
            userDB.updateMusicStyleLabel(filePath, styleLabel);
          }
        } catch (apiError) {
          console.error('获取音乐风格标签失败:', apiError);
        }
        
        // 重新获取更新后的记录
        musicRecord = userDB.getMusicLabel(filePath);
      } else if (musicRecord.style_label === null || musicRecord.style_label === '') {
        // 如果存在记录但风格标签为空，尝试获取风格标签
        try {
          const styleLabel = await this.fetchMusicStyleLabel(filePath);
          if (styleLabel) {
            // 更新数据库中的风格标签
            userDB.updateMusicStyleLabel(filePath, styleLabel);
            // 更新记录中的风格标签
            musicRecord.style_label = styleLabel;
          }
        } catch (apiError) {
          console.error('获取音乐风格标签失败:', apiError);
        }
      }

      return musicRecord;
    } catch (error) {
      console.error('处理音乐文件失败:', error);
      throw error;
    }
  }

  /**
   * 批量处理音乐文件并获取标签
   * @param {Array<string>} filePaths - 音乐文件路径数组
   * @param {Function} onProgress - 进度回调函数，参数为(当前索引, 总数, 当前文件名)
   * @returns {Promise<Array>} - 处理结果数组
   */
  async processMusicFiles(filePaths, onProgress = null) {
    const results = [];
    const total = filePaths.length;
    
    // 过滤出音乐文件
    const musicFiles = filePaths.filter(filePath => {
      const extname = path.extname(filePath).toLowerCase();
      return musicSuffix.includes(extname) && fs.existsSync(filePath);
    });
    
    // 处理每个文件
    for (let i = 0; i < musicFiles.length; i++) {
      const filePath = musicFiles[i];
      const fileName = path.basename(filePath);
      
      // 调用进度回调
      if (onProgress && typeof onProgress === 'function') {
        onProgress(i, musicFiles.length, fileName);
      }
      
      try {
        // 首先把文件信息添加到数据库，但不请求标签
        await this.addMusicToDatabase(filePath);
        
        // 添加到结果数组
        results.push({
          filePath,
          fileName,
          success: true
        });
      } catch (error) {
        console.error(`处理音乐文件失败: ${filePath}`, error);
        results.push({
          filePath,
          fileName,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  /**
   * 将音乐添加到数据库，但不请求标签
   * @param {string} filePath - 音乐文件路径
   * @returns {Promise<Object>} - 音乐信息对象
   */
  async addMusicToDatabase(filePath) {
    try {
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        throw new Error('文件不存在');
      }

      // 检查是否为音乐文件
      const extname = path.extname(filePath).toLowerCase();
      if (!musicSuffix.includes(extname)) {
        throw new Error('不是支持的音乐文件格式');
      }

      // 获取文件名
      const fileName = path.basename(filePath);

      // 从数据库查询该文件是否存在
      let musicRecord = userDB.getMusicLabel(filePath);

      // 如果记录不存在，创建新记录
      if (!musicRecord) {
        // 保存基本信息，风格标签为空
        userDB.saveMusicLabel(fileName, filePath);
        // 重新获取记录
        musicRecord = userDB.getMusicLabel(filePath);
      }

      return musicRecord;
    } catch (error) {
      console.error('添加音乐到数据库失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取未标记的音乐文件并批量请求标签
   * @param {number} batchSize - 每批处理文件数量，默认为10
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<Array>} - 已处理文件结果数组
   */
  async processUnlabeledMusic(batchSize = 10, onProgress = null) {
    try {
      // 获取所有未标记的音乐文件
      const unlabeledMusic = userDB.getUnlabeledMusicFiles();
      const total = unlabeledMusic.length;
      
      if (total === 0) {
        return [];
      }
      
      const results = [];
      
      // 分批处理
      for (let i = 0; i < total; i += batchSize) {
        const batch = unlabeledMusic.slice(i, i + batchSize);
        
        // 并行处理当前批次
        const batchPromises = batch.map(async (music, batchIndex) => {
          const currentIndex = i + batchIndex;
          
          // 调用进度回调
          if (onProgress && typeof onProgress === 'function') {
            onProgress(currentIndex, total, music.file_name);
          }
          
          try {
            // 获取标签
            const styleLabel = await this.fetchMusicStyleLabel(music.file_path);
            
            if (styleLabel) {
              // 更新数据库
              userDB.updateMusicStyleLabel(music.file_path, styleLabel);
              
              return {
                filePath: music.file_path,
                fileName: music.file_name,
                success: true,
                label: styleLabel
              };
            } else {
              return {
                filePath: music.file_path,
                fileName: music.file_name,
                success: false,
                error: '无法获取标签'
              };
            }
          } catch (error) {
            console.error(`处理音乐文件标签失败: ${music.file_path}`, error);
            return {
              filePath: music.file_path,
              fileName: music.file_name,
              success: false,
              error: error.message
            };
          }
        });
        
        // 等待当前批次完成
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // 短暂延迟，避免API请求过快
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return results;
    } catch (error) {
      console.error('批量处理未标记音乐失败:', error);
      throw error;
    }
  }

  /**
   * 从API获取音乐风格标签
   * @param {string} filePath - 音乐文件路径
   * @returns {Promise<string|null>} - 风格标签或null
   */
  async fetchMusicStyleLabel(filePath) {
    try {
      console.log('请求音乐风格标签API，文件路径:', filePath);
      
      // 发送请求到指定API
      const response = await axios.post('http://localhost:22071/api/musiclabel', {
        path: filePath
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 40000 // 40秒超时（改为40秒）
      });
      
      // 检查响应
      if (response.status === 200 && response.data) {
        console.log('获取到风格标签原始响应:', JSON.stringify(response.data));
        
        // 处理新的API返回格式
        if (response.data.labels && Array.isArray(response.data.labels)) {
          // 将标签数组转换为JSON字符串存储
          const labelsJson = JSON.stringify(response.data.labels);
          console.log('解析后的标签数组:', response.data.labels);
          console.log('标签数组JSON字符串:', labelsJson);
          
          // 输出中文标签
          const chineseTags = translateMusicLabel(response.data.labels);
          console.log('对应的中文标签:', chineseTags);
          
          return labelsJson;
        } else if (typeof response.data === 'string') {
          // 兼容旧格式，如果返回的是字符串
          console.log('获取到字符串风格标签:', response.data);
          
          // 输出中文标签
          const chineseTag = translateMusicLabel(response.data);
          console.log('对应的中文标签:', chineseTag);
          
          return response.data;
        }
      }
      
      console.log('API响应无效或没有标签数据');
      return null;
    } catch (error) {
      console.error('请求音乐风格标签API失败:', error.message);
      if (error.response) {
        console.error('错误响应状态:', error.response.status);
        console.error('错误响应数据:', error.response.data);
      }
      return null;
    }
  }

  /**
   * 更新音乐文件的风格标签
   * @param {string} filePath - 音乐文件路径
   * @param {string} styleLabel - 新的风格标签
   * @returns {Promise<boolean>} - 操作是否成功
   */
  async updateMusicLabel(filePath, styleLabel) {
    try {
      // 更新数据库中的风格标签
      const result = userDB.updateMusicStyleLabel(filePath, styleLabel);
      return result;
    } catch (error) {
      console.error('更新音乐风格标签失败:', error);
      return false;
    }
  }

  /**
   * 获取所有音乐标签信息
   * @returns {Promise<Array>} - 标签信息数组
   */
  async getAllMusicLabels() {
    try {
      const records = userDB.getAllMusicLabels();
      return records;
    } catch (error) {
      console.error('获取所有音乐标签信息失败:', error);
      return [];
    }
  }
}

export default new MusicLabelService();