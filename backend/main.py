from flask import Flask, jsonify, request
from datetime import datetime
from musicnn.tagger import top_tags
import warnings
warnings.filterwarnings("ignore")  # 忽略所有警告

# 若需更彻底禁用（包括第三方库的警告）：
warnings.simplefilter("ignore")

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=22071, debug=True)