const fs = require('fs');
const path = require('path');

console.log('开始准备后端文件...');

// 获取目标平台
const platform = process.env.BUILD_TARGET_PLATFORM || process.platform;
console.log(`目标平台: ${platform}`);

// 后端源目录
const sourceDir = path.resolve(__dirname, '../backend');
// 目标目录
const targetDir = path.resolve(__dirname, '../dist/backend');

// 删除旧的目标目录
if (fs.existsSync(targetDir)) {
  console.log('删除旧的目标目录...');
  fs.rmSync(targetDir, { recursive: true, force: true });
}

// 创建新的目标目录
console.log('创建新的目标目录...');
fs.mkdirSync(targetDir, { recursive: true });

// 复制基础文件（不包括环境文件夹）
console.log('复制基础后端文件...');
fs.readdirSync(sourceDir).forEach(file => {
  // 跳过 player 和 player_linux 文件夹以及 __pycache__ 目录和 .pyc 文件
  if (file === 'player' || file === 'player_linux' || file === '__pycache__' || file.endsWith('.pyc')) {
    return;
  }
  
  const sourcePath = path.join(sourceDir, file);
  const targetPath = path.join(targetDir, file);
  
  if (fs.lstatSync(sourcePath).isDirectory()) {
    copyDirectory(sourcePath, targetPath);
  } else {
    fs.copyFileSync(sourcePath, targetPath);
  }
});

// 根据平台复制对应的环境文件夹
if (platform === 'linux' || platform === 'darwin') {
  console.log('复制 Linux/MacOS 环境文件夹...');
  const linuxEnvDir = path.join(sourceDir, 'player_linux');
  if (fs.existsSync(linuxEnvDir)) {
    copyDirectory(linuxEnvDir, path.join(targetDir, 'player_linux'));
  } else {
    console.error('Linux环境文件夹不存在:', linuxEnvDir);
  }
} else {
  console.log('复制 Windows 环境文件夹...');
  const winEnvDir = path.join(sourceDir, 'player');
  if (fs.existsSync(winEnvDir)) {
    copyDirectory(winEnvDir, path.join(targetDir, 'player'));
  } else {
    console.error('Windows环境文件夹不存在:', winEnvDir);
  }
}

console.log('后端文件准备完成!');

// 递归复制目录及其内容
function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    console.warn(`警告: 源目录不存在: ${source}`);
    return;
  }
  
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  if (fs.lstatSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    files.forEach(file => {
      // 跳过__pycache__目录和.pyc文件
      if (file === '__pycache__' || file.endsWith('.pyc')) {
        return;
      }
      
      const sourcePath = path.join(source, file);
      const targetPath = path.join(target, file);
      
      if (fs.lstatSync(sourcePath).isDirectory()) {
        copyDirectory(sourcePath, targetPath);
      } else {
        try {
          fs.copyFileSync(sourcePath, targetPath);
        } catch (err) {
          console.warn(`无法复制文件 ${sourcePath} -> ${targetPath}: ${err.message}`);
        }
      }
    });
  }
} 