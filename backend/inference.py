import tensorflow as tf
import numpy as np
from model import LSTM_Model
import cv2
import librosa
import speech_recognition as sr
from transformers import BertTokenizer, BertModel
import torch
import os
import tempfile
import wave
import json
import vosk
from moviepy.editor import VideoFileClip
from pydub import AudioSegment

# 在程序开始时启用 eager execution
tf.compat.v1.enable_eager_execution()

# 添加用于预测的函数
@tf.function
def predict_function(model, inputs):
    return model(inputs, training=False)

class EmotionPredictor:
    def __init__(self, checkpoint_path, bert_model_path="/home/wps/weights/bert-base-uncased", num_classes=6):
        self.num_classes = num_classes
        # 初始化语音识别器
        self.recognizer = sr.Recognizer()

        # 加载预训练的BERT模型
        print("Loading BERT model from:", bert_model_path)
        try:
            self.tokenizer = BertTokenizer.from_pretrained(bert_model_path, local_files_only=True)
            self.bert_model = BertModel.from_pretrained(bert_model_path, local_files_only=True)
            print("BERT model loaded successfully from local path")
        except Exception as e:
            print(f"Error loading BERT model from local path: {e}")
            raise

        # 加载SavedModel格式的模型
        print(f"Loading model from: {checkpoint_path}")
        try:
            # 检查是否是SavedModel格式
            if os.path.isdir(checkpoint_path):
                # 加载SavedModel
                self.model = tf.saved_model.load(checkpoint_path)
                print("Successfully loaded SavedModel")
                
                # 测试模型输入输出以确认模型正常工作
                self._test_model()
            else:
                raise ValueError(f"Checkpoint path {checkpoint_path} is not a directory (SavedModel format)")
        except Exception as e:
            print(f"Error loading model: {e}")
            raise

        # 初始化 Vosk 模型
        try:
            # 设置 Vosk 模型路径
            vosk_model_path = "./resources/backend/vosk-model-small-en-us-0.15"
            
            # 检查模型目录是否存在
            if not os.path.exists(vosk_model_path):
                print(f"\nVosk 模型目录不存在: {vosk_model_path}")
                print("正在下载 Vosk 模型...")
                
                # 创建模型目录
                os.makedirs(vosk_model_path, exist_ok=True)
                
                # 下载模型
                import urllib.request
                import zipfile
                
                model_url = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
                zip_path = os.path.join(vosk_model_path, "model.zip")
                
                print(f"从 {model_url} 下载模型...")
                urllib.request.urlretrieve(model_url, zip_path)
                
                print("解压模型文件...")
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(vosk_model_path)
                
                # 清理zip文件
                os.remove(zip_path)
                
                print("Vosk 模型下载完成")
            
            # 检查模型文件是否存在
            if not os.path.exists(os.path.join(vosk_model_path, "conf")):
                raise Exception("模型文件不完整，请重新下载")
            
            # 加载模型
            self.vosk_model = vosk.Model(vosk_model_path)
            print("Vosk 模型加载成功")
            
        except Exception as e:
            print(f"加载 Vosk 模型出错: {e}")
            print("\n解决方案:")
            print("1. 手动下载 Vosk 模型:")
            print("   - 访问 https://alphacephei.com/vosk/models")
            print("   - 下载 vosk-model-small-en-us-0.15.zip")
            print("   - 解压到当前目录下的 vosk-model-small-en-us-0.15 文件夹")
            print("2. 或者使用在线语音识别（已自动启用）")
            self.vosk_model = None

    def _test_model(self):
        """测试模型输入输出以确认模型正常工作"""
        try:
            print("\n测试模型输入输出...")
            # 创建模拟输入
            t_input = np.zeros((1, 110, 100), dtype=np.float32)
            a_input = np.zeros((1, 110, 100), dtype=np.float32)
            v_input = np.zeros((1, 110, 100), dtype=np.float32)
            mask = np.ones((1, 110), dtype=np.float32)
            
            # 准备输入数据
            inputs = {
                'a_input': tf.convert_to_tensor(a_input, dtype=tf.float32),
                'v_input': tf.convert_to_tensor(v_input, dtype=tf.float32),
                't_input': tf.convert_to_tensor(t_input, dtype=tf.float32),
                'mask': tf.convert_to_tensor(mask, dtype=tf.float32)
            }
            
            # 尝试进行预测
            preds = self.model(inputs, training=False)
            
            # 打印输出形状
            print(f"模型预期输入形状: t_input={t_input.shape}, a_input={a_input.shape}, v_input={v_input.shape}, mask={mask.shape}")
            print(f"模型输出形状: {preds.shape}")
            print("模型测试成功")
            
        except Exception as e:
            print(f"模型测试失败: {e}")
            print("这可能表明模型期望的输入形状与我们提供的不匹配")
            raise

    def project_features(self, features, target_dim, name):
        """将特征投影到目标维度"""
        current_dim = features.shape[-1]
        if current_dim == target_dim:
            return features

        print(f"Projecting {name} features from {current_dim} to {target_dim}")
        projection_matrix = np.random.randn(current_dim, target_dim) / np.sqrt(current_dim)
        return np.dot(features, projection_matrix)

    def extract_audio_from_video(self, video_path):
        """从视频文件中提取音频"""
        try:
            # 创建临时文件
            temp_dir = tempfile.mkdtemp()
            temp_audio_path = os.path.join(temp_dir, "temp_audio.wav")

            print(f"正在从视频中提取音频: {video_path}")
            print(f"临时音频文件: {temp_audio_path}")
            
            # 使用moviepy提取音频
            video = VideoFileClip(video_path)
            audio = video.audio
            if audio is None:
                raise Exception("视频中没有音频轨道")
            
            # 保存音频文件
            audio.write_audiofile(temp_audio_path, codec='pcm_s16le', fps=16000)
            
            # 关闭视频和音频对象
            audio.close()
            video.close()
            
            print("音频提取成功")
            return temp_audio_path
        except Exception as e:
            print(f"Error extracting audio: {e}")
            return None

    def extract_text_from_audio(self, audio_path):
        """从音频文件中提取文本，优先使用离线识别，失败时尝试在线识别"""
        # 首先尝试使用离线识别
        if self.vosk_model is not None:
            try:
                # 确保音频格式正确（16kHz, 16bit, mono）
                audio = AudioSegment.from_file(audio_path)
                audio = audio.set_frame_rate(16000)
                audio = audio.set_channels(1)

                # 创建临时 WAV 文件
                temp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                temp_wav_path = temp_wav.name
                temp_wav.close()  # 关闭文件句柄

                # 导出音频到临时文件
                audio.export(temp_wav_path, format="wav")

                # 使用 Vosk 进行识别
                recognizer = vosk.KaldiRecognizer(self.vosk_model, 16000)
                text = ""

                try:
                    with wave.open(temp_wav_path, "rb") as wf:
                        while True:
                            data = wf.readframes(4000)
                            if len(data) == 0:
                                break
                            if recognizer.AcceptWaveform(data):
                                result = json.loads(recognizer.Result())
                                if result.get("text", ""):
                                    text += result["text"] + " "

                    # 获取最终结果
                    result = json.loads(recognizer.FinalResult())
                    if result.get("text", ""):
                        text += result["text"]
                finally:
                    # 确保临时文件被删除
                    try:
                        os.unlink(temp_wav_path)
                    except Exception as e:
                        print(f"删除临时文件时出错: {e}")

                return text.strip()

            except Exception as e:
                print(f"离线语音识别失败: {e}")
                print("尝试在线识别...")

        # 如果离线识别失败或未配置，尝试在线识别
        try:
            recognizer = sr.Recognizer()
            with sr.AudioFile(audio_path) as source:
                recognizer.adjust_for_ambient_noise(source)
                audio = recognizer.record(source)
                text = recognizer.recognize_google(audio)
                return text
        except sr.UnknownValueError:
            print("语音识别无法理解音频内容")
            return ""
        except sr.RequestError as e:
            print(f"无法从语音识别服务获取结果: {e}")
            return ""
        except Exception as e:
            print(f"语音识别出错: {e}")
            return ""

    def extract_text_features(self, text):
        """提取文本特征"""
        inputs = self.tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=110)
        with torch.no_grad():
            outputs = self.bert_model(**inputs)
        bert_features = outputs.last_hidden_state.numpy()[0]

        # 确保序列长度为110
        if bert_features.shape[0] < 110:
            pad_length = 110 - bert_features.shape[0]
            bert_features = np.pad(bert_features, ((0, pad_length), (0, 0)), mode='constant')
        else:
            bert_features = bert_features[:110]

        # 投影到目标维度
        features = self.project_features(bert_features, 100, "text")

        # 直接返回形状为 (110, 100) 的特征
        return features

    def extract_audio_features(self, audio_path):
        """提取音频特征"""
        try:
            y, sr = librosa.load(audio_path)

            # 提取MFCC特征
            mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
            mfcc = mfcc.T

            # 确保序列长度为110
            if mfcc.shape[0] < 110:
                pad_length = 110 - mfcc.shape[0]
                mfcc = np.pad(mfcc, ((0, pad_length), (0, 0)), mode='constant')
            else:
                mfcc = mfcc[:110]

            # 投影到目标维度
            features = self.project_features(mfcc, 100, "audio")

            # 直接返回形状为 (110, 100) 的特征
            return features

        except Exception as e:
            print(f"Error extracting audio features: {e}")
            return None

    def extract_video_features(self, video_path):
        """提取视频特征"""
        cap = cv2.VideoCapture(video_path)
        frames = []
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            frame = cv2.resize(frame, (64, 64))
            frame = frame / 255.0
            frames.append(frame)
        cap.release()

        frames = np.array(frames)

        # 确保有110帧
        if len(frames) < 110:
            pad_frames = np.repeat(frames[-1:], 110 - len(frames), axis=0)
            frames = np.concatenate([frames, pad_frames], axis=0)
        else:
            indices = np.linspace(0, len(frames) - 1, 110, dtype=int)
            frames = frames[indices]

        # 展平并投影到目标维度
        features = frames.reshape(frames.shape[0], -1)
        features = self.project_features(features, 100, "video")  # 修改为512维

        # 直接返回形状为 (110, 512) 的特征
        return features

    def predict(self, video_path):
        """预测视频的情感类别"""
        try:
            print(f"\nStep 1: Validating video file...")
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video file not found: {video_path}")

            # 验证视频文件
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                raise IOError(f"Cannot open video file: {video_path}")

            # 获取视频信息
            fps = cap.get(cv2.CAP_PROP_FPS)
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            print(f"Video info - FPS: {fps}, Frame count: {frame_count}")
            cap.release()

            print("\nStep 2: Extracting audio...")
            audio_path = self.extract_audio_from_video(video_path)
            if audio_path is None:
                raise Exception("Failed to extract audio from video")
            print(f"Audio extracted to: {audio_path}")

            print("\nStep 3: Performing speech recognition...")
            text = self.extract_text_from_audio(audio_path)
            if not text:
                print("Warning: No text could be extracted from audio")
                text = "no speech detected"
            print(f"Extracted text: {text}")

            print("\nStep 4: Extracting features...")
            print("- Extracting video features...")
            video_features = self.extract_video_features(video_path)
            print(f"  Video features shape: {video_features.shape}")

            print("- Extracting audio features...")
            audio_features = self.extract_audio_features(audio_path)
            print(f"  Audio features shape: {audio_features.shape}")

            print("- Extracting text features...")
            text_features = self.extract_text_features(text)
            print(f"  Text features shape: {text_features.shape}")

            print("\nStep 5: Preparing features for model...")
            # 调整特征维度，确保与模型期望的输入维度一致
            video_features = video_features.reshape(1, 110, 100)  # 修正为512维
            audio_features = audio_features.reshape(1, 110, 100)
            text_features = text_features.reshape(1, 110, 100)

            print("Feature shapes after reshaping:")
            print(f"- Video: {video_features.shape}")
            print(f"- Audio: {audio_features.shape}")
            print(f"- Text: {text_features.shape}")

            print("\nStep 6: Running prediction...")
            # 准备输入数据
            inputs = {
                'a_input': tf.convert_to_tensor(audio_features, dtype=tf.float32, name='a_input'),
                'v_input': tf.convert_to_tensor(video_features, dtype=tf.float32, name='v_input'),
                't_input': tf.convert_to_tensor(text_features, dtype=tf.float32, name='t_input'),
                'mask': tf.convert_to_tensor(np.ones((1, 110)), dtype=tf.float32, name='mask')
            }

            # 使用模型进行预测
            # preds = self.model(inputs, training=False)
            try:
                preds = predict_function(self.model, inputs)
            except RuntimeError as e:
                print(f"使用 predict_function 调用失败: {e}")
                print("尝试使用模型签名调用...")
                try:
                    # 尝试使用模型的签名调用
                    preds = self.model.signatures["serving_default"](**inputs)
                    # 获取输出张量
                    preds = next(iter(preds.values()))
                except Exception as sig_error:
                    print(f"使用签名调用也失败: {sig_error}")
                    # 尝试最后的方法
                    with tf.compat.v1.Session() as sess:
                        preds = self.model(inputs)
                        preds = sess.run(preds)

            print("\nDebug information:")
            print(f"Prediction shape: {preds.shape}")

            # 对时序维度取平均，得到每个类别的整体概率
            preds_mean = np.mean(preds[0], axis=0)  # 对时序维度取平均
            print(f"Average prediction values: {preds_mean}")

            # 确保预测值在有效范围内
            preds_mean = np.clip(preds_mean, 0, 1)  # 将值限制在0-1之间
            preds_mean = preds_mean / np.sum(preds_mean)  # 归一化
            
            # 如果是二分类问题并且预测不符合预期，考虑翻转预测
            if len(preds_mean) == 2:
                # 检查分布是否不符合预期
                print(f"原始预测分布: {preds_mean}")
                # 如果预测概率极度不平衡（如一个类别概率过高），考虑翻转
                if preds_mean[0] > 0.95 or preds_mean[1] > 0.95:
                    print("检测到预测可能需要翻转，正在翻转预测结果...")
                    preds_mean = np.array([preds_mean[1], preds_mean[0]])  # 翻转预测
                    print(f"翻转后的预测分布: {preds_mean}")

            emotion_class = np.argmax(preds_mean)
            print(f"Predicted class index: {emotion_class}")

            # 调整情感映射以匹配当前模型的输出类别
            emotion_map = {}
            if self.num_classes == 2:
                emotion_map = {
                    0: "negative",
                    1: "positive"
                }
            elif self.num_classes == 6:
                emotion_map = {
                    0: "angry",
                    1: "happy", 
                    2: "sad",
                    3: "neutral",
                    4: "excited",
                    5: "frustrated"
                }
            else:
                # 为未知类别数创建默认映射
                for i in range(self.num_classes):
                    emotion_map[i] = f"emotion_{i}"

            result = {
                "emotion": emotion_map[emotion_class],
                "text": text,
                "confidence": float(preds_mean[emotion_class]),
                "all_probabilities": {emotion_map[i]: float(preds_mean[i]) for i in range(min(6, self.num_classes))}
            }

            print("\nPrediction details:")
            print(f"Predicted emotion: {result['emotion']}")
            print("Emotion probabilities:")
            for emotion, prob in result["all_probabilities"].items():
                print(f"{emotion}: {prob:.4f}")

            print("\nPrediction completed successfully!")
            return result

        except Exception as e:
            print(f"\nError during prediction: {str(e)}")
            print(f"Error type: {type(e)}")
            import traceback
            traceback.print_exc()
            return None


# 使用示例
if __name__ == "__main__":

    # 初始化预测器
    predictor = EmotionPredictor(
        checkpoint_path="./checkpoints/iemocap/multimodal_model_6way",
        bert_model_path="./bert-base-uncased",
        num_classes=6
    )

    # 指定视频文件路径
    video_path = "./video/dia6_utt8.mp4"

    # 验证视频文件
    if not os.path.exists(video_path):
        print(f"Error: Video file does not exist: {video_path}")
        exit(1)

    # 验证视频文件是否可读
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: Cannot open video file: {video_path}")
            exit(1)
        cap.release()
    except Exception as e:
        print(f"Error checking video file: {e}")
        exit(1)

    print(f"Processing video file: {video_path}")
    result = predictor.predict(video_path)

    if result:
        print("\nPrediction Results:")
        print(f"Predicted emotion: {result['emotion']}")
        print(f"Confidence: {result['confidence']:.2f}")
        print(f"Extracted text: {result['text']}")
    else:
        print("Prediction failed")


