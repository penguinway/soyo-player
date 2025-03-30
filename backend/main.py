from flask import Flask, jsonify
from datetime import datetime

app = Flask(__name__)

@app.route('/api/hello', methods=['GET'])
def hello():
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({
        "time": current_time
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=22071, debug=True)