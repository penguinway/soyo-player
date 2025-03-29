const path = require('path');
const electron = require('electron');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// 获取用户数据目录，确保跨平台兼容性
const userDataPath = (electron.app || electron.remote.app).getPath('userData');
const dbPath = path.join(userDataPath, 'player.db');

// 创建数据库连接
let db;

function initDatabaseConnection() {
  if (!db) {
    try {
      db = new Database(dbPath);
      console.log('数据库连接成功:', dbPath);
      initDatabase();
    } catch (error) {
      console.error('数据库连接失败:', error);
      throw error;
    }
  }
  return db;
}

try {
  initDatabaseConnection();
} catch (error) {
  console.error('初始化数据库连接失败:', error);
}

// 初始化数据库结构
function initDatabase() {
  // 创建用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 创建登录状态表
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      is_logged_in INTEGER DEFAULT 0,
      token TEXT,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // 创建视频播放记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      video_path TEXT NOT NULL,
      video_name TEXT NOT NULL,
      duration REAL,
      current_time REAL DEFAULT 0,
      play_count INTEGER DEFAULT 1,
      last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // 创建音频播放记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS audio_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      audio_path TEXT NOT NULL,
      audio_name TEXT NOT NULL,
      duration REAL,
      current_time REAL DEFAULT 0,
      play_count INTEGER DEFAULT 1,
      last_played TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

// 生成随机盐值
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

// 使用盐值和密码生成哈希
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// 注册新用户
function registerUser(username, password) {
  try {
    // 确保数据库连接已初始化
    const dbInstance = initDatabaseConnection();
    // 检查用户是否已存在
    const existingUser = dbInstance.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return { success: false, message: '用户名已存在' };
    }

    // 生成盐值和密码哈希
    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);

    // 插入新用户
    const insertStmt = dbInstance.prepare('INSERT INTO users (username, password, salt) VALUES (?, ?, ?)');
    const result = insertStmt.run(username, hashedPassword, salt);

    return { success: true, userId: result.lastInsertRowid };
  } catch (error) {
    console.error('注册用户失败:', error);
    return { success: false, message: '注册失败，请稍后再试' };
  }
}

// 验证用户登录
function loginUser(username, password) {
  try {
    // 确保数据库连接已初始化
    const dbInstance = initDatabaseConnection();
    // 获取用户
    const user = dbInstance.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return { success: false, message: '用户名或密码错误' };
    }

    // 验证密码
    const hashedPassword = hashPassword(password, user.salt);
    if (hashedPassword !== user.password) {
      return { success: false, message: '用户名或密码错误' };
    }
    
    // 更新登录状态
    updateLoginStatus(user.id, true);

    return { 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username,
        created_at: user.created_at
      } 
    };
  } catch (error) {
    console.error('登录失败:', error);
    return { success: false, message: '登录失败，请稍后再试' };
  }
}

// 更新用户登录状态
function updateLoginStatus(userId, isLoggedIn) {
  try {
    // 确保数据库连接已初始化
    const dbInstance = initDatabaseConnection();
    // 检查是否已有登录记录
    const existingStatus = dbInstance.prepare('SELECT * FROM login_status WHERE user_id = ?').get(userId);
    
    if (existingStatus) {
      // 更新现有记录
      dbInstance.prepare('UPDATE login_status SET is_logged_in = ?, last_login = CURRENT_TIMESTAMP WHERE user_id = ?')
        .run(isLoggedIn ? 1 : 0, userId);
    } else {
      // 创建新记录
      dbInstance.prepare('INSERT INTO login_status (user_id, is_logged_in) VALUES (?, ?)')
        .run(userId, isLoggedIn ? 1 : 0);
    }
    
    return true;
  } catch (error) {
    console.error('更新登录状态失败:', error);
    return false;
  }
}

// 获取登录状态
function getLoginStatus() {
  try {
    // 确保数据库连接已初始化
    const dbInstance = initDatabaseConnection();
    
    // 获取当前登录的用户
    const loginStatus = dbInstance.prepare(`
      SELECT u.id, u.username, u.created_at 
      FROM login_status ls
      JOIN users u ON ls.user_id = u.id
      WHERE ls.is_logged_in = 1
      ORDER BY ls.last_login DESC
      LIMIT 1
    `).get();
    
    if (loginStatus) {
      return {
        isLoggedIn: true,
        user: {
          id: loginStatus.id,
          username: loginStatus.username,
          created_at: loginStatus.created_at
        }
      };
    }
    
    return { isLoggedIn: false, user: null };
  } catch (error) {
    console.error('获取登录状态失败:', error);
    return { isLoggedIn: false, user: null };
  }
}

// 用户退出登录
function logoutUser(userId) {
  return updateLoginStatus(userId, false);
}

// 获取所有用户列表（仅用于测试）
function getAllUsers() {
  try {
    return db.prepare('SELECT id, username, created_at FROM users').all();
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return [];
  }
}

// 记录视频播放历史
function saveVideoHistory(userId, videoPath, videoName, duration, currentTime) {
  try {
    // 检查是否已有该视频的播放记录
    const existingRecord = db.prepare('SELECT * FROM video_history WHERE user_id = ? AND video_path = ?')
      .get(userId || null, videoPath);
    
    if (existingRecord) {
      // 更新现有记录
      db.prepare(`
        UPDATE video_history 
        SET current_time = ?, 
            play_count = play_count + 1, 
            last_played = CURRENT_TIMESTAMP,
            duration = ?
        WHERE id = ?
      `).run(currentTime, duration, existingRecord.id);
    } else {
      // 创建新记录
      db.prepare(`
        INSERT INTO video_history 
        (user_id, video_path, video_name, duration, current_time) 
        VALUES (?, ?, ?, ?, ?)
      `).run(userId || null, videoPath, videoName, duration, currentTime);
    }
    
    return true;
  } catch (error) {
    console.error('保存视频播放历史失败:', error);
    return false;
  }
}

// 记录音频播放历史
function saveAudioHistory(userId, audioPath, audioName, duration, currentTime) {
  try {
    // 检查是否已有该音频的播放记录
    const existingRecord = db.prepare('SELECT * FROM audio_history WHERE user_id = ? AND audio_path = ?')
      .get(userId || null, audioPath);
    
    if (existingRecord) {
      // 更新现有记录
      db.prepare(`
        UPDATE audio_history 
        SET current_time = ?, 
            play_count = play_count + 1, 
            last_played = CURRENT_TIMESTAMP,
            duration = ?
        WHERE id = ?
      `).run(currentTime, duration, existingRecord.id);
    } else {
      // 创建新记录
      db.prepare(`
        INSERT INTO audio_history 
        (user_id, audio_path, audio_name, duration, current_time) 
        VALUES (?, ?, ?, ?, ?)
      `).run(userId || null, audioPath, audioName, duration, currentTime);
    }
    
    return true;
  } catch (error) {
    console.error('保存音频播放历史失败:', error);
    return false;
  }
}

// 获取视频播放历史
function getVideoHistory(userId, limit = 20) {
  try {
    const records = db.prepare(`
      SELECT * FROM video_history 
      WHERE user_id IS ? 
      ORDER BY last_played DESC
      LIMIT ?
    `).all(userId || null, limit);
    
    return records;
  } catch (error) {
    console.error('获取视频播放历史失败:', error);
    return [];
  }
}

// 获取音频播放历史
function getAudioHistory(userId, limit = 20) {
  try {
    const records = db.prepare(`
      SELECT * FROM audio_history 
      WHERE user_id IS ? 
      ORDER BY last_played DESC
      LIMIT ?
    `).all(userId || null, limit);
    
    return records;
  } catch (error) {
    console.error('获取音频播放历史失败:', error);
    return [];
  }
}

// 导出数据库操作方法
module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  getLoginStatus,
  logoutUser,
  saveVideoHistory,
  saveAudioHistory,
  getVideoHistory,
  getAudioHistory
};