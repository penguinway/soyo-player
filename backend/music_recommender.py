import sqlite3
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def get_music_recommendations(db_path, current_file_name, top_n=3):
    """
    基于余弦相似度为当前播放的音乐推荐相似歌曲
    
    参数:
    current_file_name -- 当前播放的音乐文件名
    top_n -- 推荐歌曲数量
    
    返回:
    推荐歌曲文件名列表
    """
    # 连接到SQLite数据库
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 获取所有带有标签的音乐文件
    cursor.execute('SELECT file_name, style_label FROM music_labels WHERE style_label IS NOT NULL')
    music_data = cursor.fetchall()
    
    # 如果数据不足，直接返回空列表
    if len(music_data) < 2:
        conn.close()
        return []
    
    file_names = [item[0] for item in music_data]
    
    # 如果当前文件不在数据库中，返回空列表
    if current_file_name not in file_names:
        conn.close()
        return []
    
    # 获取所有不同的标签
    all_tags = []
    for _, tags in music_data:
        if tags:  # 确保标签不为空
            tag_list = tags.split(', ')
            all_tags.extend(tag_list)
    
    # 去重
    all_tags = list(set(all_tags))
    
    # 创建标签到索引的映射
    tag_index = {tag: idx for idx, tag in enumerate(all_tags)}
    
    # 创建音乐的标签向量
    music_vectors = np.zeros((len(music_data), len(all_tags)))
    for i, (_, tags) in enumerate(music_data):
        if tags:  # 确保标签不为空
            tag_list = tags.split(', ')
            for tag in tag_list:
                music_vectors[i, tag_index[tag]] = 1
    
    # 计算余弦相似度
    similarity_matrix = cosine_similarity(music_vectors)
    
    # 获取当前文件在列表中的索引
    current_index = file_names.index(current_file_name)
    
    # 获取相似度分数
    similarity_scores = similarity_matrix[current_index]
    
    # 按相似度排序，排除当前播放的歌曲
    similar_indices = np.argsort(similarity_scores)[::-1]
    recommended_files = []
    
    for idx in similar_indices:
        if idx != current_index:  # 排除当前歌曲
            recommended_files.append(file_names[idx])
        if len(recommended_files) >= top_n:
            break
    
    conn.close()
    return recommended_files 