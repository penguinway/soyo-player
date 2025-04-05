const fs = require('fs');
const path = require('path');

console.log('开始准备后端文件...');

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

// 直接复制backend文件夹内容到dist/backend，而不是复制整个文件夹
console.log('复制backend文件夹内容...');
copyDirectoryContents(sourceDir, targetDir);

console.log('后端文件准备完成!');

// 直接复制目录内容，不创建额外的子目录
function copyDirectoryContents(source, target) {
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
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }
        copyDirectoryContents(sourcePath, targetPath);
      } else {
        fs.copyFileSync(sourcePath, targetPath);
      }
    });
  }
} 