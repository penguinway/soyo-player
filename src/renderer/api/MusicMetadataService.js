import jsmediatags from 'jsmediatags';
import fs from 'fs';
import { musicSuffix } from './util';
import path from 'path';
import axios from 'axios';
import { remote } from 'electron';
import userDB from './database';

/**
 * 音乐元数据服务
 * 用于处理音乐文件的元数据，包括歌曲信息、封面等
 */
class MusicMetadataService {
  /**
   * 解析音乐文件元数据
   * @param {string} filePath - 音乐文件路径
   * @returns {Promise<Object>} - 元数据对象
   */
  getMetadata(filePath) {
    return new Promise((resolve, reject) => {
      // 检查文件是否存在且是否为音乐文件
      if (!fs.existsSync(filePath) || !this.isMusicFile(filePath)) {
        reject(new Error('无效的音乐文件'));
        return;
      }

      // 使用jsmediatags读取元数据
      jsmediatags.read(filePath, {
        onSuccess: async (tag) => {
          try {
            // 提取本地元数据（等待异步操作完成）
            const metadata = await this.extractMetadata(tag, filePath);
            
            // 如果本地没有封面，尝试网络获取
            if (!metadata.coverImage && metadata.title) {
              try {
                const coverInfo = await this.getOnlineCover(metadata.title, metadata.artist);
                if (coverInfo) {
                  metadata.coverImage = coverInfo.url;
                  metadata.coverSource = coverInfo.source;
                }
              } catch (error) {
                console.error('获取在线封面失败:', error);
              }
            }
            
            // 如果本地没有歌词，尝试网络获取
            if (!metadata.lyrics && metadata.title) {
              try {
                const lyricsInfo = await this.getOnlineLyrics(metadata.title, metadata.artist);
                if (lyricsInfo) {
                  metadata.lyrics = lyricsInfo.lyrics;
                  metadata.lyricsSource = lyricsInfo.source;
                }
              } catch (error) {
                console.error('获取在线歌词失败:', error);
              }
            }
            
            resolve(metadata);
          } catch (error) {
            console.error('处理元数据失败:', error);
            resolve(this.getBasicMetadata(filePath));
          }
        },
        onError: async (error) => {
          console.error('读取音乐元数据失败:', error);
          
          // 获取基本元数据
          const metadata = this.getBasicMetadata(filePath);
          
          // 尝试网络获取封面和歌词
          if (metadata.title) {
            try {
              // 尝试获取封面
              const coverInfo = await this.getOnlineCover(metadata.title, metadata.artist);
              if (coverInfo) {
                metadata.coverImage = coverInfo.url;
                metadata.coverSource = coverInfo.source;
              }
              
              // 尝试获取歌词
              const lyricsInfo = await this.getOnlineLyrics(metadata.title, metadata.artist);
              if (lyricsInfo) {
                metadata.lyrics = lyricsInfo.lyrics;
                metadata.lyricsSource = lyricsInfo.source;
              }
            } catch (error) {
              console.error('获取在线元数据失败:', error);
            }
          }
          
          resolve(metadata);
        }
      });
    });
  }

  /**
   * 提取元数据
   * @param {Object} tag - jsmediatags获取的标签数据
   * @param {string} filePath - 音乐文件路径
   * @returns {Object} - 格式化后的元数据
   */
  async extractMetadata(tag, filePath) {
    const tags = tag.tags;
    const metadata = this.getBasicMetadata(filePath);

    // 提取常规信息
    if (tags.title) metadata.title = tags.title;
    if (tags.artist) metadata.artist = tags.artist;
    if (tags.album) metadata.album = tags.album;
    if (tags.year) metadata.year = tags.year;
    if (tags.genre) metadata.genre = tags.genre;
    if (tags.comment) metadata.comment = tags.comment.text;

    // 提取封面图片
    if (tags.picture) {
      const { data, format } = tags.picture;
      const base64String = Buffer.from(data).toString('base64');
      metadata.coverImage = `data:${format};base64,${base64String}`;
      metadata.coverSource = 'local'; // 标记封面来源为本地
    }

    // 尝试获取歌词（等待异步操作完成）
    try {
      const lyrics = await this.getLyrics(filePath);
      if (lyrics) {
        metadata.lyrics = lyrics;
        metadata.lyricsSource = 'local'; // 标记歌词来源为本地
      }
    } catch (err) {
      console.error('获取歌词失败:', err);
    }
    
    // 从数据库获取风格标签信息
    try {
      const musicLabel = userDB.getMusicLabel(filePath);
      if (musicLabel && musicLabel.style_label) {
        metadata.styleLabel = musicLabel.style_label;
      }
    } catch (err) {
      console.error('获取风格标签失败:', err);
    }

    return metadata;
  }

  /**
   * 获取基本元数据（从文件名和路径提取）
   * @param {string} filePath - 音乐文件路径
   * @returns {Object} - 基本元数据
   */
  getBasicMetadata(filePath) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const fileStats = fs.statSync(filePath);
    
    // 尝试从文件名解析艺术家和歌曲名
    let title = fileName;
    let artist = '未知艺术家';
    
    // 常见的艺术家-歌曲名格式，例如: "艺术家 - 歌曲名"
    const matches = fileName.match(/^(.*?)\s*[-–—]\s*(.*)$/);
    if (matches && matches.length === 3) {
      artist = matches[1].trim();
      title = matches[2].trim();
    }
    
    return {
      filePath: filePath,
      fileName: fileName,
      title: title,
      artist: artist,
      album: '未知专辑',
      year: '',
      genre: '',
      fileSize: this.formatFileSize(fileStats.size),
      lastModified: fileStats.mtime,
      coverImage: null, // 默认没有封面
      lyrics: null, // 默认没有歌词
      coverSource: null, // 默认没有封面来源
      lyricsSource: null, // 默认没有歌词来源
      styleLabel: null // 默认没有风格标签
    };
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的文件大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 检查文件是否为音乐文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} - 是否为音乐文件
   */
  isMusicFile(filePath) {
    const extname = path.extname(filePath).toLowerCase();
    return musicSuffix.includes(extname);
  }

  /**
   * 尝试获取歌词（LRC文件）
   * @param {string} audioFilePath - 音频文件路径
   * @returns {Promise<string|null>} - 歌词内容或null
   */
  getLyrics(audioFilePath) {
    return new Promise((resolve) => {
      try {
        console.log('开始查找歌词文件，音频路径:', audioFilePath);
        
        // 获取文件所在目录和文件名（不含扩展名）
        const dirPath = path.dirname(audioFilePath);
        const baseName = path.basename(audioFilePath, path.extname(audioFilePath));
        const fileName = path.basename(audioFilePath);
        
        console.log('音频文件目录:', dirPath);
        console.log('音频文件名(无扩展名):', baseName);
        
        // 尝试不同大小写的LRC扩展名
        const lrcVariants = [
          path.join(dirPath, `${baseName}.lrc`),
          path.join(dirPath, `${baseName}.LRC`),
          path.join(dirPath, `${baseName}.Lrc`)
        ];
        
        // 检查所有可能的LRC文件路径
        for (const lrcPath of lrcVariants) {
          console.log('检查歌词文件路径:', lrcPath);
          if (fs.existsSync(lrcPath)) {
            console.log('找到精确匹配的歌词文件:', lrcPath);
            try {
              // 尝试使用UTF-8编码读取
              const content = fs.readFileSync(lrcPath, 'utf-8');
              resolve(content);
              return;
            } catch (encodingError) {
              console.warn('UTF-8编码读取失败，尝试其他编码:', encodingError.message);
              try {
                // 如果UTF-8失败，尝试使用GBK/GB18030编码（常见于中文Windows系统）
                // 注意：这需要安装iconv-lite包，如果没有安装，这里会抛出错误
                // npm install iconv-lite --save
                const iconv = require('iconv-lite');
                const buffer = fs.readFileSync(lrcPath);
                const content = iconv.decode(buffer, 'gbk');
                console.log('使用GBK编码成功读取歌词');
                resolve(content);
                return;
              } catch (gbkError) {
                console.error('GBK编码读取也失败:', gbkError.message);
                // 继续尝试其他文件
              }
            }
          }
        }
        
        // 如果没有找到精确匹配的LRC文件，尝试在目录中查找相似文件名的LRC文件
        if (dirPath && fs.existsSync(dirPath)) {
          console.log('未找到精确匹配的歌词文件，尝试查找相似文件名');
          const files = fs.readdirSync(dirPath);
          
          // 1. 首先尝试查找前缀匹配的LRC文件
          const prefixMatchFiles = files.filter(file => {
            const fileLower = file.toLowerCase();
            return fileLower.endsWith('.lrc') && fileLower.startsWith(baseName.toLowerCase());
          });
          
          if (prefixMatchFiles.length > 0) {
            const lrcPath = path.join(dirPath, prefixMatchFiles[0]);
            console.log('找到前缀匹配的歌词文件:', lrcPath);
            try {
              const content = fs.readFileSync(lrcPath, 'utf-8');
              resolve(content);
              return;
            } catch (error) {
              console.warn('UTF-8编码读取失败，尝试GBK编码');
              try {
                const iconv = require('iconv-lite');
                const buffer = fs.readFileSync(lrcPath);
                const content = iconv.decode(buffer, 'gbk');
                resolve(content);
                return;
              } catch (gbkError) {
                console.error('GBK编码读取也失败:', gbkError.message);
              }
            }
          }
          
          // 2. 尝试查找包含音频文件名关键部分的LRC文件
          console.log('尝试查找包含关键词的歌词文件');
          const keywordMatchFiles = files.filter(file => {
            const fileLower = file.toLowerCase();
            if (!fileLower.endsWith('.lrc')) return false;
            
            // 提取可能的艺术家和歌曲名
            const matches = baseName.match(/^(.*?)\s*[-–—]\s*(.*)$/);
            if (matches && matches.length === 3) {
              const artist = matches[1].trim().toLowerCase();
              const title = matches[2].trim().toLowerCase();
              
              // 如果LRC文件名包含艺术家或歌曲名，认为是匹配的
              return fileLower.includes(artist) || fileLower.includes(title);
            }
            
            // 如果文件名相似度超过70%，也认为是匹配的
            const similarity = this.getStringSimilarity(fileLower.replace('.lrc', ''), baseName.toLowerCase());
            return similarity > 0.7;
          });
          
          if (keywordMatchFiles.length > 0) {
            const lrcPath = path.join(dirPath, keywordMatchFiles[0]);
            console.log('找到关键词匹配的歌词文件:', lrcPath);
            try {
              const content = fs.readFileSync(lrcPath, 'utf-8');
              resolve(content);
              return;
            } catch (error) {
              console.warn('UTF-8编码读取失败，尝试GBK编码');
              try {
                const iconv = require('iconv-lite');
                const buffer = fs.readFileSync(lrcPath);
                const content = iconv.decode(buffer, 'gbk');
                resolve(content);
                return;
              } catch (gbkError) {
                console.error('GBK编码读取也失败:', gbkError.message);
              }
            }
          }
          
          // 3. 尝试查找目录中任何LRC文件（如果只有一个）
          const allLrcFiles = files.filter(file => file.toLowerCase().endsWith('.lrc'));
          if (allLrcFiles.length === 1) {
            const lrcPath = path.join(dirPath, allLrcFiles[0]);
            console.log('目录中只有一个LRC文件，使用它:', lrcPath);
            try {
              const content = fs.readFileSync(lrcPath, 'utf-8');
              resolve(content);
              return;
            } catch (error) {
              console.warn('UTF-8编码读取失败，尝试GBK编码');
              try {
                const iconv = require('iconv-lite');
                const buffer = fs.readFileSync(lrcPath);
                const content = iconv.decode(buffer, 'gbk');
                resolve(content);
                return;
              } catch (gbkError) {
                console.error('GBK编码读取也失败:', gbkError.message);
              }
            }
          }
        }
        
        console.log('没有找到任何匹配的歌词文件');
        resolve(null);
      } catch (error) {
        console.error('获取歌词文件失败:', error);
        resolve(null);
      }
    });
  }
  
  /**
   * 计算两个字符串的相似度（Levenshtein距离的归一化版本）
   * @param {string} str1 - 第一个字符串
   * @param {string} str2 - 第二个字符串
   * @returns {number} - 相似度，范围0-1，1表示完全相同
   */
  getStringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length === 0) return 0.0;
    if (str2.length === 0) return 0.0;
    
    // 计算Levenshtein距离
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,      // 删除
          matrix[i][j - 1] + 1,      // 插入
          matrix[i - 1][j - 1] + cost // 替换
        );
      }
    }
    
    // 归一化距离为相似度
    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
  }
  
  /**
   * 从网络API获取歌词
   * @param {string} title - 歌曲标题
   * @param {string} artist - 艺术家（可选）
   * @returns {Promise<Object|null>} - 包含歌词和来源的对象或null
   */
  async getOnlineLyrics(title, artist = '') {
    try {
      // 对标题和艺术家进行URL编码
      const encodedTitle = encodeURIComponent(title);
      const fullQuery = artist ? `${encodedTitle} ${encodeURIComponent(artist)}` : encodedTitle;
      
      // 构建API URL
      const url = `https://api.lrc.cx/lyrics?title=${fullQuery}`;
      
      // 发送请求
      const response = await axios.get(url, {
        timeout: 5000 // 5秒超时
      });
      
      // 检查响应
      if (response.status === 200 && response.data) {
        return {
          lyrics: response.data,
          source: 'online' // 标记来源为在线
        };
      }
      
      return null;
    } catch (error) {
      console.error('获取在线歌词失败:', error.message);
      return null;
    }
  }
  
  /**
   * 从网络API获取专辑封面
   * @param {string} title - 歌曲标题
   * @param {string} artist - 艺术家（可选）
   * @returns {Promise<Object|null>} - 包含封面URL和来源的对象或null
   */
  async getOnlineCover(title, artist = '') {
    try {
      // 对标题和艺术家进行URL编码
      const encodedTitle = encodeURIComponent(title);
      const fullQuery = artist ? `${encodedTitle} ${encodeURIComponent(artist)}` : encodedTitle;
      
      // 构建API URL
      const url = `https://api.lrc.cx/cover?title=${fullQuery}`;
      
      // 先发送HEAD请求检查响应类型
      const headResponse = await axios.head(url, {
        timeout: 3000,
        maxRedirects: 0 // 不自动跟随重定向
      });
      
      // 如果有Location头，说明是重定向
      if (headResponse.headers.location) {
        return {
          url: headResponse.headers.location,
          source: 'online' // 标记来源为在线
        };
      }
      
      // 检查内容类型是否为图片
      const contentType = headResponse.headers['content-type'];
      if (contentType && contentType.startsWith('image/')) {
        return {
          url: url, // 直接返回原始URL
          source: 'online' // 标记来源为在线
        };
      }
      
      // 如果不是重定向也不是图片，则尝试获取二进制数据并转为base64
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 5000
      });
      
      if (response.status === 200) {
        const contentType = response.headers['content-type'];
        if (contentType && contentType.startsWith('image/')) {
          // 将二进制数据转换为Base64
          const base64 = Buffer.from(response.data).toString('base64');
          return {
            url: `data:${contentType};base64,${base64}`,
            source: 'online' // 标记来源为在线
          };
        }
      }
      
      return null;
    } catch (error) {
      console.error('获取在线专辑封面失败:', error.message);
      return null;
    }
  }
}

export default new MusicMetadataService();