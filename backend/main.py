# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from datetime import datetime
from musicnn.tagger import top_tags
import warnings
import argparse
from music_recommender import get_music_recommendations
warnings.filterwarnings("ignore")  # 忽略所有警告

# 若需更彻底禁用（包括第三方库的警告）：
warnings.simplefilter("ignore")

app = Flask(__name__)

# 解析命令行参数
parser = argparse.ArgumentParser(description='Python后端服务')
parser.add_argument('-db_path', type=str, required=True, help='SQLite数据库路径')
args = parser.parse_args()

@app.route('/api/hello', methods=['GET'])
def hello():
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({
        "time": current_time
    })

@app.route('/api/musiclabel', methods=['POST'])
def music_label():
    # 获取请求中的path参数
    data = request.get_json()
    if not data or 'path' not in data:
        return jsonify({"error": "Missing 'path' parameter"}), 400
    
    file_path = data['path']
    
    # 调用top_tags函数分析音频文件
    try:
        labels = top_tags(file_path, model='MSD_musicnn_big', topN=5, print_tags=False)
        return jsonify({"labels": labels})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/recommend', methods=['POST'])
def recommend_music():
    # 获取请求中的当前播放文件名
    data = request.get_json()
    if not data or 'file_name' not in data:
        return jsonify({"error": "Missing 'file_name' parameter"}), 400
    
    file_name = data['file_name']
    top_n = data.get('top_n', 3)  # 默认推荐3首歌
    
    try:
        # 调用推荐函数获取推荐歌曲
        recommended_songs = get_music_recommendations(args.db_path, file_name, top_n)
        return jsonify({"recommended_songs": recommended_songs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=22071, debug=True)