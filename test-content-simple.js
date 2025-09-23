// 简单的content script测试
console.log('Content script loaded successfully!');

// 添加消息监听器
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    
    if (message.action === 'ping') {
        sendResponse({ status: 'ready', timestamp: Date.now() });
        return true;
    }
    
    if (message.action === 'test') {
        sendResponse({ 
            success: true, 
            url: window.location.href,
            title: document.title,
            timestamp: Date.now()
        });
        return true;
    }
    
    return false;
});

console.log('Message listener added successfully!');
