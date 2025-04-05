import { app, BrowserWindow, ipcMain } from 'electron'
import WindowUtil from './api/window'
import OpenDialog from './api/OpenDialog'
const { spawn } = require('child_process')
const path = require('path')

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
    global.__static = require('path').join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let mainWindow
let pythonProcess = null
const winURL = process.env.NODE_ENV === 'development'
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`

// 确保Python进程正确关闭的函数
function cleanupPythonProcess() {
    if (pythonProcess && !pythonProcess.killed) {
        try {
            console.log('正在关闭Python进程')
            // 在Windows上使用SIGTERM可能不够，所以用taskkill确保进程被终止
            if (process.platform === 'win32') {
                const pid = pythonProcess.pid
                spawn('taskkill', ['/pid', pid, '/f', '/t'])
            } else {
                pythonProcess.kill('SIGTERM')
            }
            pythonProcess = null
            console.log('Python进程已关闭')
        } catch (err) {
            console.error('关闭Python进程时出错:', err)
        }
    }
}

function createWindow() {
    /**
     * Initial window options
     */
    mainWindow = new BrowserWindow({
        height: 589,
        useContentSize: true,
        width: 866,
        minWidth: 760,
        minHeight: 550,
        webPreferences: {
            webSecurity: false
        },
        // 初始化时的背景颜色
        backgroundColor: '#2e2c29',
        frame: false //关闭最大化那一栏
    })

    mainWindow.loadURL(winURL)

    // 在窗口加载完成后启动Python后端
    mainWindow.webContents.on('did-finish-load', () => {
        // 确保之前的Python进程已关闭
        cleanupPythonProcess()
        
        // 获取数据库路径
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'player.db');
        
        console.log('启动Python程序，数据库路径：', dbPath)
        
        try {
            // 启动Python脚本
            let pythonPath;
            let pythonScriptPath;
            
            if (process.env.NODE_ENV === 'development') {
                // 开发环境下的路径
                const backendDir = path.resolve(path.join(__dirname, '../../backend'));
                pythonScriptPath = path.join(backendDir, 'main.py');
                pythonPath = path.join(backendDir, 'player', 'Scripts', 'python.exe');
                
                // 输出绝对路径用于调试
                console.log('后端目录绝对路径:', backendDir);
                console.log('Python脚本绝对路径:', pythonScriptPath);
                console.log('Python解释器绝对路径:', pythonPath);
                
                // 检查文件是否存在
                const fs = require('fs');
                if (!fs.existsSync(pythonPath)) {
                    console.error(`Python解释器不存在: ${pythonPath}`);
                }
                if (!fs.existsSync(pythonScriptPath)) {
                    console.error(`Python脚本不存在: ${pythonScriptPath}`);
                }
            } else {
                // 生产环境下的路径 - 从资源目录中加载
                const resourcesDir = process.resourcesPath;
                // 后端资源路径
                const backendDir = path.join(resourcesDir, 'backend');
                pythonScriptPath = path.join(backendDir, 'main.py');
                pythonPath = path.join(backendDir, 'player', 'Scripts', 'python.exe');
                
                console.log('生产环境后端目录:', backendDir);
                console.log('Python脚本路径:', pythonScriptPath);
                console.log('Python解释器路径:', pythonPath);
                
                // 确保文件存在
                try {
                    const fs = require('fs');
                    if (!fs.existsSync(pythonPath)) {
                        console.error(`生产环境Python解释器不存在: ${pythonPath}`);
                    }
                    if (!fs.existsSync(pythonScriptPath)) {
                        console.error(`生产环境Python脚本不存在: ${pythonScriptPath}`);
                    }
                } catch (err) {
                    console.error('检查文件存在时出错:', err);
                }
            }
            
            // 启动Python进程
            pythonProcess = spawn(pythonPath, [
                pythonScriptPath,
                `-db_path=${dbPath}`
            ], {
                detached: false,
                windowsHide: true
            });
            
            // 记录标准输出
            pythonProcess.stdout.on('data', (data) => {
                console.log(`Python输出: ${data}`);
            });
            
            // 记录错误输出
            pythonProcess.stderr.on('data', (data) => {
                console.error(`Python错误: ${data}`);
            });
            
            // 错误处理
            pythonProcess.on('error', (err) => {
                console.error('启动Python程序失败:', err);
                pythonProcess = null;
            });
            
            // 监听进程退出
            pythonProcess.on('exit', (code, signal) => {
                console.log(`Python进程退出，代码: ${code}, 信号: ${signal}`);
                pythonProcess = null;
            });
        } catch (err) {
            console.error('启动Python程序出错:', err);
        }
    });

    mainWindow.on('close', () => {
        mainWindow.webContents.send('close')
        // 关闭Python进程
        cleanupPythonProcess()
    })
    
    // 因为强制关机或机器重启或会话注销而导致窗口会话结束时触发
    mainWindow.on('session-end', () => {
        mainWindow.webContents.send('close')
        // 关闭Python进程
        cleanupPythonProcess()
    })
    
    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // 限制只可以打开一个应用, 4.x的文档
    const gotTheLock = app.requestSingleInstanceLock()
    if (!gotTheLock) {
        app.quit()
    } else {
        app.on('second-instance', (event, commandLine, workingDirectory) => {
            // 当运行第二个实例时,将会聚焦到mainWindow这个窗口
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore()
                mainWindow.focus()
                mainWindow.show()
            }
        })
    }

    // 隐藏菜单栏
    mainWindow.setMenu(null)

    const winUtil = new WindowUtil()
    // 设置主窗口引用
    winUtil.setMainWindow(mainWindow)
    // 初始化窗口状态
    winUtil.initWin()

    // 打开文件
    const openDialog = new OpenDialog();
    openDialog.init()

    // 初始化系统托盘
    // createTray()

    require('./api/express')

    // 监听打开开发者工具的事件
    ipcMain.on('open-dev-tools', () => {
        mainWindow.webContents.openDevTools();
    });
}

app.on('ready', createWindow)

// 确保应用退出前关闭Python进程
app.on('will-quit', () => {
    cleanupPythonProcess()
})

app.on('window-all-closed', () => {
    // 确保Python进程被关闭
    cleanupPythonProcess()
    
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow()
    }
})

// 添加IPC事件，允许渲染进程请求重启Python进程
ipcMain.on('restart-python', () => {
    if (mainWindow) {
        cleanupPythonProcess()
        // 触发did-finish-load事件处理程序中的代码来重启Python
        mainWindow.webContents.emit('did-finish-load')
    }
})

