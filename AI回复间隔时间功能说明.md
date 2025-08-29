# AI回复间隔时间功能说明

## 功能概述

在拼多多聊天监控器扩展中新增了AI回复间隔时间设置功能，允许用户设置大模型返回的对话发送给客服的时间间隔。

## 功能特点

### 1. 时间单位
- 时间单位：分钟
- 支持小数：如0.5表示30秒，1表示1分钟
- 范围：0.5 - 60分钟
- 默认值：1分钟

### 2. 界面位置
- 位置：拼多多配置标签页
- 位置：在"自动发送AI回复"复选框下方
- 样式：与其他输入框保持一致

### 3. 功能实现
- 当大模型返回AI回复后，系统会等待指定的时间间隔
- 等待时间结束后，自动将AI回复发送给客服
- 支持两种发送方式：自动粘贴和API发送

## 技术实现

### 1. HTML界面
在`popup.html`中添加了AI回复间隔时间输入框：
```html
<div class="form-group">
    <label class="form-label">⏱️ AI回复间隔时间 (分钟):</label>
    <input type="number" class="form-input" id="aiReplyIntervalInput" 
           value="1" min="0.5" max="60" step="0.5">
    <small style="color: #666; font-size: 12px;">设置AI回复发送给客服的时间间隔，0.5表示30秒，1表示1分钟</small>
</div>
```

### 2. JavaScript逻辑
在`popup.js`中添加了相关处理：

#### 元素引用
```javascript
elements.aiReplyIntervalInput = document.getElementById('aiReplyIntervalInput');
```

#### 设置保存
```javascript
popupState.settings.aiReplyInterval = parseFloat(elements.aiReplyIntervalInput.value) || 1;
```

#### 存储配置
```javascript
pddChatConfig: {
    // ... 其他配置
    aiReplyInterval: popupState.settings.aiReplyInterval,
    // ... 其他配置
}
```

### 3. Content Script支持
在`content.js`中添加了时间间隔支持：

#### 状态管理
```javascript
let monitoringState = {
    // ... 其他状态
    aiReplyInterval: 1, // AI回复间隔时间（分钟），默认1分钟
    pddChatConfig: {
        // ... 其他配置
        aiReplyInterval: 1, // AI回复间隔时间（分钟）
    }
};
```

#### 配置加载
```javascript
// 设置AI回复间隔时间
if (monitoringState.pddChatConfig.aiReplyInterval) {
    monitoringState.aiReplyInterval = monitoringState.pddChatConfig.aiReplyInterval;
    console.log('已设置AI回复间隔时间:', monitoringState.aiReplyInterval, '分钟');
}
```

#### 延迟发送逻辑
```javascript
// 根据设置的间隔时间延迟发送
const intervalMinutes = monitoringState.aiReplyInterval || 1;
const intervalMs = intervalMinutes * 60 * 1000; // 转换为毫秒

console.log(`⏱️ 将在 ${intervalMinutes} 分钟后发送AI回复给客服`);

// 延迟发送AI回复
setTimeout(async () => {
    // 发送AI回复的逻辑
}, intervalMs);
```

## 使用流程

### 1. 设置间隔时间
1. 打开扩展popup页面
2. 切换到"拼多多配置"标签页
3. 在"AI回复间隔时间"输入框中设置时间（分钟）
4. 设置会自动保存

### 2. 工作流程
1. 系统检测到客服消息
2. 将消息发送给大模型API
3. 收到大模型回复
4. 等待指定的时间间隔
5. 时间到后自动发送给客服

### 3. 日志输出
系统会在控制台输出相关日志：
```
⏱️ 将在 1 分钟后发送AI回复给客服
✅ 自动粘贴发送成功
```

## 注意事项

### 1. 时间精度
- 最小间隔：0.5分钟（30秒）
- 最大间隔：60分钟
- 步进值：0.5分钟

### 2. 兼容性
- 与现有的自动发送功能完全兼容
- 不影响其他功能的正常使用
- 支持动态修改间隔时间

### 3. 性能考虑
- 使用setTimeout实现延迟，不会阻塞主线程
- 延迟期间不会影响新消息的检测和处理
- 支持多个AI回复同时等待发送

## 测试建议

### 1. 基本功能测试
- 设置不同的时间间隔（0.5, 1, 5, 10分钟）
- 验证延迟发送是否按预期工作
- 检查控制台日志输出

### 2. 边界值测试
- 测试最小值0.5分钟
- 测试最大值60分钟
- 测试无效输入的处理

### 3. 集成测试
- 与自动发送功能配合使用
- 与消息过滤功能配合使用
- 与通知功能配合使用

## 故障排除

### 1. 常见问题
- 间隔时间不生效：检查设置是否正确保存
- 延迟发送失败：检查控制台错误信息
- 设置无法保存：检查存储权限

### 2. 调试方法
- 查看控制台日志
- 检查存储中的配置值
- 验证元素引用是否正确

### 3. 恢复方法
- 重置配置到默认值
- 重新加载扩展
- 清除浏览器存储数据

## 总结

AI回复间隔时间功能为用户提供了更灵活的消息发送控制，可以根据实际需求设置合适的回复延迟，提升用户体验和系统可控性。该功能完全集成到现有系统中，不影响其他功能的正常使用。

