import {
    ipcRenderer
} from 'electron'

const fs = require('fs')

const path = require('path')

import store from '../store'
import MusicLabelService from './MusicLabelService'
import { musicSuffix } from './util'
import connect from './bus.js'
import cn from '../lang/cn'
import en from '../lang/en'
import storage from 'good-storage'

class OpenDialog {
    constructor() {
        // 单例模式
        if (OpenDialog.instance) {
            return OpenDialog.instance
        }
        this.onOpenFile()
        this.onOpenFolder()
        OpenDialog.instance = this
    }
    
    // 获取国际化文本
    getTranslatedText(key) {
        const locale = storage.get('locale') || 'cn'
        const messages = { cn, en }
        const message = messages[locale]
        
        // 从嵌套路径获取翻译文本
        const keys = key.split('.')
        let result = message
        
        for (const k of keys) {
            if (result && result[k]) {
                result = result[k]
            } else {
                // 如果找不到对应的键，返回英文或键名
                return locale === 'cn' ? key : key
            }
        }
        
        return result
    }
    
    // 打开文件
    openFile() {
        // 异步通讯
        ipcRenderer.send('openFile')
    }
    // 打开文件夹
    openFolder() {
        ipcRenderer.send('openFolder')
    }
    // 监听主进程在打开文件后返回的数据
    onOpenFile() {
        ipcRenderer.on('openFile-ok', (e, path) => {
            if (!path) {
                return
            }
            // 获取文件信息
            const arr = this.getFileStatFromLocal(path)
            if (arr.length == 0) {
                return
            }
            this.changeStore(arr)
            
            // 处理音乐文件标签
            this.processMusicFiles(path)
        })
    }
    // 监听主进程在打开文件夹后返回的数据
    onOpenFolder() {
        ipcRenderer.on('openFolder-ok', (e, path) => {
            if (!path) {
                return
            }
            // 获取文件信息
            const arr = this.getFileStatFromLocal(path)
            if (arr.length == 0) {
                return
            }
            this.changeStore(arr)
            
            // 处理音乐文件标签
            this.processMusicFiles(path)
        })
    }
    // 打开url
    openUrl(path) {
        // 获取文件信息
        const arr = this.getFileStatFromUrl(path)
        if (arr.length == 0) {
            return
        }
        this.changeStore(arr)
    }
    
    // 处理音乐文件，添加到标签数据库
    async processMusicFiles(filePaths) {
        // 筛选音乐文件
        const musicFiles = filePaths.filter(filePath => {
            const ext = path.extname(filePath).toLowerCase()
            return musicSuffix.includes(ext)
        })
        
        if (musicFiles.length === 0) {
            return
        }
        
        // 只有一个文件时直接处理
        if (musicFiles.length === 1) {
            try {
                await MusicLabelService.processMusicFile(musicFiles[0])
            } catch (error) {
                console.error('处理音乐文件标签失败:', error)
            }
            return
        }
        
        // 多个文件时只添加到数据库，不立即获取标签
        try {
            // 批量处理音乐文件
            await MusicLabelService.processMusicFiles(musicFiles, (current, total, fileName) => {
                // 不发送进度消息，避免频繁打扰用户
            })
            
            // 完成后发送简洁美观的成功消息
            const successMsg = '已添加 ' + musicFiles.length + ' 首音乐到数据库'
            connect.$emit('showTipMessage', {
                type: 'success',
                message: successMsg,
                duration: 3000
            })
            
            // 在后台异步处理标签，每批处理5个文件
            this.processLabelsInBackground(5)
        } catch (error) {
            console.error('批量处理音乐文件失败:', error)
            connect.$emit('showTipMessage', {
                type: 'error',
                message: '添加音乐文件失败: ' + error.message
            })
        }
    }
    
    // 在后台处理未标记的音乐文件
    async processLabelsInBackground(batchSize = 5) {
        try {
            // 在后台异步处理标签
            MusicLabelService.processUnlabeledMusic(batchSize, (current, total, fileName) => {
                // 不显示进度消息，避免频繁打扰用户
            }).then(results => {
                const successCount = results.filter(r => r.success).length
                if (successCount > 0) {
                    const completedMsg = '已处理 ' + successCount + ' 首音乐的标签'
                    connect.$emit('showTipMessage', {
                        type: 'success',
                        message: completedMsg,
                        duration: 3000
                    })
                }
            }).catch(error => {
                console.error('后台处理音乐标签失败:', error)
            })
        } catch (error) {
            console.error('后台处理音乐标签失败:', error)
        }
    }
    
    // 修改store
    changeStore(arr) {
        // 第一次添加，即播放列表没有数据
        if (store.state.videoList.length == 0) {
            store.commit('setCurrentVideo', arr[0])
            store.commit('setOldVideo', arr[0])
            store.commit('setCurrentVideoIndex', 0)
        }
        store.commit('setVideoList', arr)
    }
    // 获取本地文件的信息
    getFileStatFromLocal(path) {
        let arr = []
        for (let i = 0; i < path.length; i++) {
            const result = fs.statSync(path[i])
            const index = store.state.videoList.findIndex(j => j.src == path[i])
            if (result && result.dev && index < 0) {
                let obj = Object.assign({}, result, {
                    src: path[i],
                    mode: 'local'
                })
                arr.push(this.formatData(obj))
            }
        }
        return arr
    }
    // 获取url文件信息
    getFileStatFromUrl(path) {
        let arr = []
        let obj = {
            src: path,
            birthtime: +new Date,
            size: 1,
            mode: 'url'
        }
        arr.push(this.formatData(obj))
        return arr
    }
    formatData(data) {
        let result = true
        if (data.mode == 'local') {
            result = fs.existsSync(data.src)
        }
        return {
            id: data.src,
            // 创建时间
            createTime: +new Date(data.birthtime),
            // 视频大小
            size: data.size,
            // 视频是否播放状态
            isPlaying: false,
            // 播放进度
            currentTime: 0,
            // 视频是本地文件还是网络文件，local本地文件，url网络文件
            mode: data.mode,
            // 视频播放倍速
            speed: 1,
            // 视频总时间
            totalTime: 0,
            // 视频路径
            src: data.src,
            // 文件名,
            filename: path.basename(data.src),
            // 文件是否有效
            msg: result ? '' : '无效文件'
        }
    }
}

OpenDialog.instance = null

export default OpenDialog