# -*- coding: utf-8 -*-
from flask import Flask, jsonify, request
from datetime import datetime
from musicnn.tagger import top_tags
import warnings
import argparse
import os
from music_recommender import get_music_recommendations
from inference import EmotionPredictor  # 导入EmotionPredictor
warnings.filterwarnings("ignore")  # 忽略所有警告

# 若需更彻底禁用（包括第三方库的警告）：
warnings.simplefilter("ignore")

# 解析命令行参数
parser = argparse.ArgumentParser(description='Python后端服务')
parser.add_argument('-db_path', type=str, required=True, help='SQLite数据库路径')
parser.add_argument('-model_path', type=str, default="./checkpoints/iemocap/multimodal_model_6way", help='情感识别模型路径')
parser.add_argument('-bert_path', type=str, default="./bert-base-uncased", help='BERT模型路径')
args = parser.parse_args()

app = Flask(__name__)

# 初始化情感预测器
emotion_predictor = None

def initialize_predictor():
    global emotion_predictor
    try:
        print("正在初始化情感预测模型...")
        emotion_predictor = EmotionPredictor(
            checkpoint_path=args.model_path,
            bert_model_path=args.bert_path,
            num_classes=6
        )
        print("情感预测模型初始化成功")
        return True
    except Exception as e:
        print(f"情感预测模型初始化失败: {e}")
        return False

# 立即初始化模型，而不是等待第一个请求
initialize_predictor()

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

@app.route('/api/emotion', methods=['POST'])
def predict_emotion():
    # 获取请求中的视频文件路径
    data = request.get_json()
    if not data or 'path' not in data:
        return jsonify({"error": "缺少'path'参数"}), 400
    
    video_path = data['path']
    
    # 检查情感预测器是否已初始化
    global emotion_predictor
    if emotion_predictor is None:
        try:
            print("情感预测模型尚未初始化，正在尝试初始化...")
            success = initialize_predictor()
            if not success:
                return jsonify({"error": "情感预测模型初始化失败"}), 500
        except Exception as e:
            return jsonify({"error": f"情感预测模型初始化失败: {str(e)}"}), 500
    
    try:
        # 调用情感预测函数分析视频
        result = emotion_predictor.predict(video_path)
        if result:
            return jsonify({
                "emotion": result['emotion'],
                "confidence": result['confidence'],
                "text": result['text'],
                "probabilities": result['all_probabilities']
            })
        else:
            return jsonify({"error": "情感预测失败"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 确保在启动应用前模型已初始化
    print("当前工作目录:", os.getcwd())
    if emotion_predictor is None:
        print("在启动服务前再次尝试初始化模型...")
        initialize_predictor()
    
    app.run(host='0.0.0.0', port=22071, debug=True, use_reloader=False)