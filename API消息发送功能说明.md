# API消息发送功能说明

## 🎯 功能概述

当监听到客服发来的消息之后，系统会自动向指定的API接口 `http://localhost:8090/api/chat/send` 发送消息。这个功能实现了客服消息的实时转发，支持外部系统集成。

## ✨ 核心特性

### 1. 自动消息检测
- **智能识别**: 自动识别发送者为"客服"的消息
- **实时监听**: 实时监听聊天列表的变化
- **即时触发**: 检测到客服消息后立即触发API发送

### 2. 简化消息格式
- **纯文本发送**: 只发送String类型的消息内容
- **内容类型**: 使用 `text/plain` 内容类型
- **无额外封装**: 直接发送消息内容，无需JSON包装

### 3. 完整错误处理
- **网络异常**: 处理网络连接失败
- **API错误**: 处理HTTP状态码错误
- **状态通知**: 发送成功/失败状态到popup

## 🔧 技术实现

### 1. 消息检测逻辑
```javascript
// 在addNewMessage函数中检测客服消息
if (messageInfo.sender && messageInfo.sender.includes('客服')) {
    console.log('检测到客服消息，准备发送到API接口');
    sendCustomerMessageToAPI(messageInfo);
}
```

### 2. API发送函数
```javascript
async function sendCustomerMessageToAPI(messageInfo) {
    try {
        const apiEndpoint = 'http://localhost:8090/api/chat/send';
        
        // 只发送String类型的消息内容
        const requestData = messageInfo.content;

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain', // 发送纯文本内容
            },
            body: requestData // 直接发送消息内容字符串
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.text();
        return { success: true, response: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
```

### 3. 状态通知机制
```javascript
// 发送成功通知
await sendMessageToPopup({
    action: 'apiMessageSent',
    success: true,
    message: messageInfo.content,
    response: result
});

// 发送失败通知
await sendMessageToPopup({
    action: 'apiMessageSent',
    success: false,
    message: messageInfo.content,
    error: error.message
});
```

## 📊 消息流程

### 1. 消息监听阶段
```
聊天列表变化 → 检测新消息 → 提取消息信息 → 判断发送者
```

### 2. 客服消息识别
```
发送者包含"客服" → 触发API发送 → 准备消息内容
```

### 3. API发送阶段
```
构建请求 → 发送到API → 处理响应 → 状态通知
```

## 🌐 API接口规范

### 请求格式
- **URL**: `http://localhost:8090/api/chat/send`
- **方法**: `POST`
- **内容类型**: `text/plain`
- **请求体**: 直接发送消息内容字符串

### 示例请求
```http
POST http://localhost:8090/api/chat/send
Content-Type: text/plain

您好，请问有什么可以帮助您的吗？
```

### 响应处理
- **成功**: 返回API响应内容
- **失败**: 返回错误信息
- **状态**: 通过popup显示发送结果

## 📋 使用方法

### 自动触发
1. **启动聊天监控**: 在popup中启动聊天监控功能
2. **等待客服消息**: 系统自动监听聊天列表变化
3. **自动发送**: 检测到客服消息后自动发送到API

### 手动测试
1. **打开开发者工具**: 在扩展页面按F12
2. **运行测试脚本**: 复制 `测试API消息发送.js` 到控制台
3. **查看测试结果**: 验证各项功能是否正常

## 🧪 测试验证

### 功能测试
运行 `测试API消息发送.js` 脚本来验证：
1. ✅ 消息监听功能
2. ✅ API消息发送
3. ✅ 消息检测逻辑
4. ✅ API端点配置
5. ✅ 消息格式
6. ✅ 错误处理

### 测试步骤
1. 在扩展popup页面打开开发者工具
2. 复制测试脚本到控制台
3. 运行测试，查看结果
4. 根据测试结果调整配置

## ⚠️ 注意事项

### 1. API服务器要求
- **本地服务器**: 确保 `localhost:8090` 服务正在运行
- **接口可用**: 确保 `/api/chat/send` 接口可以正常访问
- **CORS配置**: 如果跨域，需要配置CORS策略

### 2. 消息格式要求
- **纯文本**: 只发送文本内容，不包含HTML标签
- **编码**: 使用UTF-8编码
- **长度**: 根据API服务器限制调整消息长度

### 3. 网络环境
- **网络连接**: 确保网络连接正常
- **防火墙**: 检查防火墙是否阻止本地连接
- **代理设置**: 如果使用代理，需要相应配置

## 🔧 故障排除

### 常见问题

#### 1. API连接失败
**可能原因**: 
- 本地服务器未启动
- 端口被占用
- 防火墙阻止

**解决方案**:
- 检查服务器状态
- 确认端口配置
- 检查防火墙设置

#### 2. 消息未发送
**可能原因**: 
- 客服消息识别失败
- 网络连接问题
- API接口错误

**解决方案**:
- 检查消息发送者格式
- 验证网络连接
- 查看API接口日志

#### 3. 响应处理错误
**可能原因**: 
- API响应格式不匹配
- 状态码处理错误
- 异常捕获失败

**解决方案**:
- 检查API响应格式
- 验证状态码处理
- 完善错误处理逻辑

## 📈 性能优化

### 1. 消息过滤
- 只处理客服消息，减少不必要的API调用
- 避免重复消息发送
- 限制消息发送频率

### 2. 网络优化
- 使用异步请求，不阻塞主线程
- 设置合理的超时时间
- 实现请求重试机制

### 3. 内存管理
- 及时清理消息对象
- 避免内存泄漏
- 优化数据结构

## 🔮 未来改进

### 短期目标
- 添加消息发送队列
- 支持批量消息发送
- 增加发送状态显示

### 长期目标
- 支持多种API格式
- 添加消息加密功能
- 集成更多通知方式

## 📝 更新日志

### v2.1.0 (当前版本)
- ✨ 新增API消息发送功能
- ✨ 新增客服消息自动识别
- ✨ 新增纯文本消息格式
- 🔧 优化错误处理机制
- 🐛 修复消息发送状态通知

## 🤝 技术支持

如遇到问题，请：
1. 查看本文档的故障排除部分
2. 运行测试脚本验证功能
3. 检查浏览器控制台错误信息
4. 确认API服务器配置正确
5. 联系技术支持团队

## 🔗 相关文件

- **`content.js`**: 主要功能实现文件
- **`popup.js`**: 状态显示和通知处理
- **`测试API消息发送.js`**: 功能测试脚本
- **`API消息发送功能说明.md`**: 本文档

---

**注意**: 此功能需要Chrome扩展环境和本地API服务器才能正常工作。请确保API服务器正在运行并且可以访问。 