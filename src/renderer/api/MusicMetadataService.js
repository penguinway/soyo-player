import jsmediatags from 'jsmediatags';
import fs from 'fs';
import { musicSuffix } from './util';
import path from 'path';
import axios from 'axios';
import { remote } from 'electron';

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

      // 获取基本元数据（从文件名和路径提取）
      const basicMetadata = this.getBasicMetadata(filePath);
      
      // 添加基本来源信息
      basicMetadata.source = '文件名解析';

      // 创建一个10秒的超时Promise
      const timeoutPromise = new Promise((timeoutResolve) => {
        setTimeout(() => {
          console.warn('元数据读取超时（10秒），使用基本元数据');
          // 超时后尝试从网络获取增强元数据
          this.enhanceMetadataFromNetwork(basicMetadata)
            .then(enhancedMetadata => {
              enhancedMetadata.source += ' (读取超时)';
              timeoutResolve(enhancedMetadata);
            })
            .catch(() => {
              basicMetadata.source += ' (读取超时)';
              timeoutResolve(basicMetadata);
            });
        }, 10000); // 10秒超时
      });

      // 使用jsmediatags读取本地元数据
      const metadataPromise = new Promise((metadataResolve) => {
        jsmediatags.read(filePath, {
          onSuccess: async (tag) => {
            try {
              // 提取本地元数据
              const metadata = this.extractMetadata(tag, filePath);
              
              // 设置元数据来源为ID3标签
              metadata.source = 'ID3标签';
              
              // 标记封面来源
              if (metadata.coverImage) {
                metadata.coverSource = '本地文件';
              }
              
              // 尝试获取本地歌词
              try {
                const localLyrics = await this.getLyrics(filePath);
                if (localLyrics) {
                  metadata.lyrics = localLyrics;
                  metadata.lyricsSource = '本地LRC文件';
                } else {
                  // 本地无歌词，尝试从网络获取
                  const networkLyrics = await this.getNetworkLyrics(metadata.title, metadata.artist);
                  if (networkLyrics) {
                    metadata.lyrics = networkLyrics;
                    metadata.lyricsSource = '在线API';
                  }
                }
              } catch (error) {
                console.error('获取歌词失败:', error);
              }
              
              // 如果没有封面，尝试从网络获取
              if (!metadata.coverImage) {
                try {
                  const coverUrl = await this.getNetworkCover(metadata.title, metadata.artist);
                  if (coverUrl) {
                    metadata.coverImage = coverUrl;
                    metadata.coverSource = '在线API';
                  }
                } catch (error) {
                  console.error('获取网络封面失败:', error);
                }
              }
              
              metadataResolve(metadata);
            } catch (error) {
              console.error('处理元数据失败:', error);
              this.enhanceMetadataFromNetwork(basicMetadata)
                .then(enhancedMetadata => metadataResolve(enhancedMetadata))
                .catch(() => metadataResolve(basicMetadata));
            }
          },
          onError: (error) => {
            console.error('读取音乐元数据失败:', error);
            // 本地获取失败，尝试从网络获取增强元数据
            this.enhanceMetadataFromNetwork(basicMetadata)
              .then(enhancedMetadata => metadataResolve(enhancedMetadata))
              .catch(() => metadataResolve(basicMetadata));
          }
        });
      });
      
      // 使用Promise.race让元数据加载与超时竞争
      Promise.race([metadataPromise, timeoutPromise])
        .then(result => resolve(result))
        .catch(error => reject(error));
    });
  }

  /**
   * 从网络增强元数据
   * @param {Object} basicMetadata - 基本元数据
   * @returns {Promise<Object>} - 增强后的元数据
   */
  async enhanceMetadataFromNetwork(basicMetadata) {
    try {
      // 尝试从网络获取歌词
      const lyrics = await this.getNetworkLyrics(basicMetadata.title, basicMetadata.artist);
      if (lyrics) {
        basicMetadata.lyrics = lyrics;
        basicMetadata.lyricsSource = '在线API';
      }
      
      // 尝试从网络获取封面
      const coverUrl = await this.getNetworkCover(basicMetadata.title, basicMetadata.artist);
      if (coverUrl) {
        basicMetadata.coverImage = coverUrl;
        basicMetadata.coverSource = '在线API';
      }
      
      if (lyrics || coverUrl) {
        basicMetadata.source = '文件名解析 + 在线API';
      }
      
      return basicMetadata;
    } catch (error) {
      console.error('从网络增强元数据失败:', error);
      return basicMetadata;
    }
  }

  /**
   * 从网络获取歌词
   * @param {string} title - 歌曲标题
   * @param {string} artist - 艺术家
   * @returns {Promise<string|null>} - 歌词内容或null
   */
  async getNetworkLyrics(title, artist = '') {
    try {
      // 构建查询字符串
      const searchTitle = artist ? `${title} - ${artist}` : title;
      const encodedTitle = encodeURIComponent(searchTitle);
      const url = `https://api.lrc.cx/lyrics?title=${encodedTitle}`;
      
      const response = await axios.get(url, {
        responseType: 'text',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      if (response.status === 200 && response.data) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('从网络获取歌词失败:', error);
      return null;
    }
  }

  /**
   * 从网络获取封面
   * @param {string} title - 歌曲标题
   * @param {string} artist - 艺术家
   * @returns {Promise<string|null>} - 封面URL或null
   */
  async getNetworkCover(title, artist = '') {
    try {
      // 构建查询字符串
      const searchTitle = artist ? `${title} - ${artist}` : title;
      const encodedTitle = encodeURIComponent(searchTitle);
      const url = `https://api.lrc.cx/cover?title=${encodedTitle}`;
      
      const response = await axios.get(url, {
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400,
        responseType: 'arraybuffer'
      });
      
      // 检查是否有重定向
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        return response.headers.location;
      }
      
      // 直接返回图片数据
      if (response.headers['content-type'] && response.headers['content-type'].startsWith('image/')) {
        const base64 = Buffer.from(response.data).toString('base64');
        return `data:${response.headers['content-type']};base64,${base64}`;
      }
      
      return null;
    } catch (error) {
      console.error('从网络获取封面失败:', error);
      return null;
    }
  }

  /**
   * 提取元数据
   * @param {Object} tag - jsmediatags获取的标签数据
   * @param {string} filePath - 音乐文件路径
   * @returns {Object} - 格式化后的元数据
   */
  extractMetadata(tag, filePath) {
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
      source: '文件名解析',
      lyricsSource: null,
      coverSource: null
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
      // 获取同名LRC文件路径
      const lrcPath = audioFilePath.replace(path.extname(audioFilePath), '.lrc');
      
      // 检查LRC文件是否存在
      if (fs.existsSync(lrcPath)) {
        try {
          const content = fs.readFileSync(lrcPath, 'utf-8');
          resolve(content);
        } catch (error) {
          console.error('读取歌词文件失败:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  }
}

export default new MusicMetadataService();