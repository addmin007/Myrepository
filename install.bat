@echo off
chcp 65001 >nul
echo ========================================
echo 拼多多商品聊天监听器 - 快速安装脚本
echo ========================================
echo.

echo 正在检查Chrome浏览器...
reg query "HKEY_CURRENT_USER\Software\Google\Chrome\BLBeacon" /v version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到Chrome浏览器，请先安装Chrome
    pause
    exit /b 1
)

echo [成功] 找到Chrome浏览器
echo.

echo 正在打开Chrome扩展管理页面...
start "" "chrome://extensions/"

echo.
echo ========================================
echo 安装步骤：
echo ========================================
echo 1. 在打开的页面中，开启右上角的"开发者模式"
echo 2. 点击"加载已解压的扩展程序"按钮
echo 3. 选择此脚本所在的文件夹
echo 4. 等待扩展安装完成
echo.
echo 注意：请确保选择的是包含manifest.json的文件夹
echo.

echo 安装完成后，请：
echo 1. 访问拼多多商品聊天页面
echo 2. 点击扩展图标开始配置监控
echo 3. 按照界面提示设置监控参数
echo.

echo 按任意键退出...
pause >nul 