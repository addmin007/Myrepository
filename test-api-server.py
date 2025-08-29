#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
拼多多聊天监控器 - 测试API服务器
用于测试自动回复功能
"""

import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ChatAPIHandler(BaseHTTPRequestHandler):
    """聊天API处理器"""
    
    def do_POST(self):
        """处理POST请求"""
        try:
            # 解析URL
            parsed_url = urlparse(self.path)
            
            if parsed_url.path == '/send':
                self.handle_send_message()
            else:
                self.send_error(404, "API端点不存在")
                
        except Exception as e:
            logger.error(f"处理请求失败: {e}")
            self.send_error(500, f"服务器内部错误: {e}")
    
    def handle_send_message(self):
        """处理发送消息请求"""
        try:
            # 获取请求内容长度
            content_length = int(self.headers.get('Content-Length', 0))
            
            if content_length == 0:
                self.send_error(400, "请求体为空")
                return
            
            # 读取请求体
            post_data = self.rfile.read(content_length)
            request_data = json.loads(post_data.decode('utf-8'))
            
            logger.info(f"收到消息: {request_data}")
            
            # 分析消息内容并生成回复
            reply = self.generate_reply(request_data)
            
            # 构造响应
            response_data = {
                "success": True,
                "reply": reply,
                "timestamp": int(time.time()),
                "message_id": request_data.get('messageId', ''),
                "original_message": request_data.get('message', '')
            }
            
            # 发送响应
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            response_json = json.dumps(response_data, ensure_ascii=False, indent=2)
            self.wfile.write(response_json.encode('utf-8'))
            
            logger.info(f"发送回复: {reply}")
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON解析失败: {e}")
            self.send_error(400, "无效的JSON格式")
        except Exception as e:
            logger.error(f"处理消息失败: {e}")
            self.send_error(500, f"处理消息失败: {e}")
    
    def generate_reply(self, request_data):
        """根据消息内容生成回复"""
        message = request_data.get('message', '').lower()
        sender = request_data.get('sender', '')
        
        # 简单的关键词回复逻辑
        if '你好' in message or '您好' in message:
            return "您好！很高兴为您服务，请问有什么可以帮助您的吗？"
        
        elif '价格' in message or '多少钱' in message or '费用' in message:
            return "关于价格问题，我们的客服会为您详细说明，请稍等片刻。"
        
        elif '发货' in message or '物流' in message or '快递' in message:
            return "我们会在24小时内发货，物流信息会及时更新，请关注订单状态。"
        
        elif '质量' in message or '品质' in message or '保证' in message:
            return "我们保证商品质量，如有问题可以申请退换货，请放心购买。"
        
        elif '优惠' in message or '活动' in message or '促销' in message:
            return "目前正在进行优惠活动，详情请咨询客服，我们会为您提供最优惠的价格。"
        
        elif '退换货' in message or '退款' in message or '退货' in message:
            return "我们支持7天无理由退换货，如有质量问题可以申请退款，请提供订单号。"
        
        elif '客服' in message or '人工' in message or '在线' in message:
            return "我是智能客服助手，正在为您转接人工客服，请稍等。"
        
        elif '谢谢' in message or '感谢' in message:
            return "不客气！为您服务是我们的荣幸，如果还有其他问题随时咨询。"
        
        else:
            # 默认回复
            return "感谢您的咨询，我们的客服会尽快为您解答，请耐心等待。"
    
    def do_OPTIONS(self):
        """处理OPTIONS请求（CORS预检）"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """自定义日志格式"""
        logger.info(f"{self.address_string()} - {format % args}")

def main():
    """主函数"""
    try:
        # 服务器配置
        host = 'localhost'
        port = 8090
        
        # 创建HTTP服务器
        server = HTTPServer((host, port), ChatAPIHandler)
        
        logger.info(f"启动测试API服务器: http://{host}:{port}")
        logger.info("按 Ctrl+C 停止服务器")
        
        # 启动服务器
        server.serve_forever()
        
    except KeyboardInterrupt:
        logger.info("收到停止信号，正在关闭服务器...")
        server.shutdown()
        logger.info("服务器已关闭")
    except Exception as e:
        logger.error(f"服务器启动失败: {e}")

if __name__ == '__main__':
    main() 