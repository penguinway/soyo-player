import axios from 'axios';
import path from 'path';
import fs from 'fs';
import userDB from './database';
import { musicSuffix } from './util';

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
        timeout: 20000 // 20秒超时（改为20秒）
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
          return labelsJson;
        } else if (typeof response.data === 'string') {
          // 兼容旧格式，如果返回的是字符串
          console.log('获取到字符串风格标签:', response.data);
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