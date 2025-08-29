@echo off
chcp 65001 >nul
echo 启动拼多多聊天监控器测试API服务器...
echo.
echo 服务器将在 http://localhost:8090 启动
echo 按 Ctrl+C 停止服务器
echo.

python test-api-server.py

pause 