// 调试脚本 - 检查content script注入状态
console.log('=== Content Script 调试信息 ===');
console.log('当前URL:', window.location.href);
console.log('页面标题:', document.title);
console.log('Chrome扩展API可用:', typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined');

// 检查是否有monitoringState
if (typeof monitoringState !== 'undefined') {
    console.log('monitoringState存在:', monitoringState);
} else {
    console.log('monitoringState不存在 - Content script可能未正确注入');
}

// 检查是否有消息监听器
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    console.log('Chrome runtime API可用');
} else {
    console.log('Chrome runtime API不可用');
}

// 尝试发送ping消息
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
        console.log('Ping响应:', response);
    });
} else {
    console.log('无法发送ping消息 - Chrome API不可用');
}

console.log('=== 调试信息结束 ===');
