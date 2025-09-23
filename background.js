// 文件监控相关变量
let fileMonitorInterval = null;
let lastFileContent = '';
let monitoredFilePath = '';
let fileMonitorSettings = {
    enabled: false,
    checkInterval: 5000, // 5秒检查一次
    autoOpenLinks: true,
    autoStartListening: true,
    autoSendGreeting: true,
    greetingMessage: '您好，有什么可以帮助您的吗？', // 保持向后兼容
    greetingMessages: [ // 新增：多条问候语支持
        '您好，有什么可以帮助您的吗？',
        '欢迎光临！请问有什么需要帮助的吗？',
        '您好！很高兴为您服务，有什么可以帮您的？',
        '欢迎咨询！请问您需要了解什么产品呢？',
        '您好！我是客服，有什么问题随时问我哦~',
        '欢迎来到我们店铺！有什么可以为您介绍的吗？',
        '您好！很高兴认识您，有什么需要帮助的吗？',
        '欢迎！请问您对哪个产品感兴趣呢？'
    ]
};

// 拼多多商品聊天监听器 - Background Script
chrome.runtime.onInstalled.addListener(() => {
    console.log('拼多多商品聊天监听器已安装');
    
    // 设置默认权限
    chrome.permissions.request({
        permissions: ['notifications', 'storage'],
        origins: ['https://mobile.pinduoduo.com/*', 'https://*.pinduoduo.com/*']
    });
});

// 全局通知事件监听器
chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('pdd-monitor-')) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.update(tabs[0].id, { active: true });
                chrome.windows.update(tabs[0].windowId, { focused: true });
            }
        });
        chrome.notifications.clear(notificationId);
    }
});

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId.startsWith('pdd-monitor-')) {
        if (buttonIndex === 0) { // 查看按钮
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.update(tabs[0].id, { active: true });
                    chrome.windows.update(tabs[0].windowId, { focused: true });
                }
            });
        }
        chrome.notifications.clear(notificationId);
    }
});

// 处理来自content script的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background收到消息:', message);

    if (message.action === 'createNotification') {
        createNotification(message.title, message.message, message.isError);
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'flashWindow') {
        flashWindow();
        sendResponse({ success: true });
        return true;
    }

    if (message.action === 'updateIcon') {
        updateIcon(message.isActive);
        sendResponse({ success: true });
        return true;
    }

    // 处理手动检查文件请求
    if (message.action === 'checkFileManually') {
        checkFileForUpdates()
            .then(() => {
                sendResponse({ success: true, message: '文件检查完成' });
            })
            .catch(error => {
                console.error('手动检查文件失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 处理获取文件监控统计信息请求
    if (message.action === 'getFileMonitorStats') {
        chrome.storage.local.get(['openedLinks'])
            .then(async result => {
                const openedLinks = result.openedLinks || [];
                
                // 获取当前文件内容
                let fileLinksCount = 0;
                let unopenedLinksCount = 0;
                
                if (monitoredFilePath && fileMonitorSettings.enabled) {
                    try {
                        const currentContent = await readFileContent(monitoredFilePath);
                        const allFileLinks = parseLinksFromContent(currentContent);
                        
                        // 获取当前活动窗口ID用于统计
                        let currentWindowId = 'default';
                        try {
                            const windows = await chrome.windows.getAll();
                            const activeWindow = windows.find(w => w.focused) || windows[0];
                            currentWindowId = activeWindow ? activeWindow.id : 'default';
                        } catch (error) {
                            console.warn('无法获取窗口ID，使用默认值:', error);
                        }
                        
                        const unopenedLinks = await findUnopenedLinks(allFileLinks, currentWindowId);
                        
                        fileLinksCount = allFileLinks.length;
                        unopenedLinksCount = unopenedLinks.length;
                    } catch (error) {
                        console.warn('获取文件统计信息失败:', error);
                    }
                }
                
                const stats = {
                    fileMonitorEnabled: fileMonitorSettings.enabled,
                    monitoredFilePath: monitoredFilePath,
                    fileLinksCount: fileLinksCount,
                    unopenedLinksCount: unopenedLinksCount,
                    openedLinksCount: openedLinks.length,
                    checkInterval: fileMonitorSettings.checkInterval,
                    autoOpenLinks: fileMonitorSettings.autoOpenLinks,
                    autoSendGreeting: fileMonitorSettings.autoSendGreeting
                };
                
                sendResponse({ success: true, stats: stats });
            })
            .catch(error => {
                console.error('获取文件监控统计信息失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 处理批量链接管理
    if (message.action === 'openBatchLinks') {
        handleBatchLinks(message.links, message.options)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error('批量链接处理失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 处理批量链接处理请求
    if (message.action === 'handleBatchLinks') {
        handleBatchLinks(message.links, message.options)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error('批量链接处理失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 新增：获取批量处理状态
    if (message.action === 'getBatchProcessStatus') {
        chrome.storage.local.get('pddMonitorState')
            .then(result => {
                sendResponse({ success: true, status: result.pddMonitorState || null });
            })
            .catch(error => {
                console.error('获取批量处理状态失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 新增：停止批量处理
    if (message.action === 'stopBatchProcess') {
        chrome.storage.local.get('pddMonitorState')
            .then(result => {
                if (result.pddMonitorState) {
                    const state = result.pddMonitorState;
                    state.isProcessing = false;
                    state.stoppedByUser = true;
                    chrome.storage.local.set({ 'pddMonitorState': state });
                    sendResponse({ success: true, message: '批量处理已停止' });
                } else {
                    sendResponse({ success: false, error: '没有正在进行的批量处理' });
                }
            })
            .catch(error => {
                console.error('停止批量处理失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 新增：清理批量处理状态
    if (message.action === 'clearBatchProcessStatus') {
        chrome.storage.local.remove('pddMonitorState')
            .then(() => {
                sendResponse({ success: true, message: '批量处理状态已清理' });
            })
            .catch(error => {
                console.error('清理批量处理状态失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    // 新增：文件监控相关消息处理
    if (message.action === 'startFileMonitoring') {
        console.log('收到启动文件监控消息:', message);
        startFileMonitoring(message.filePath, message.settings)
            .then(response => {
                console.log('文件监控启动响应:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('启动文件监控失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (message.action === 'stopFileMonitoring') {
        stopFileMonitoring()
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error('停止文件监控失败:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }

    if (message.action === 'getFileMonitorStatus') {
        sendResponse({ 
            success: true, 
            enabled: fileMonitorSettings.enabled,
            filePath: monitoredFilePath,
            settings: fileMonitorSettings
        });
        return true;
    }

    if (message.action === 'updateFileMonitorSettings') {
        fileMonitorSettings = { ...fileMonitorSettings, ...message.settings };
        chrome.storage.local.set({ fileMonitorSettings: fileMonitorSettings });
        sendResponse({ success: true });
        return true;
    }

    return false;
});

// 创建浏览器通知
async function createNotification(title, message, isError = false) {
    try {
        // 使用Chrome扩展的notifications API
        const notificationId = `pdd-monitor-${Date.now()}`;
        
        await chrome.notifications.create(notificationId, {
            type: 'basic',
            iconUrl: isError ? 'icons/icon_error.png' : 'icons/icon48.png',
            title: title,
            message: message,
            priority: 2,
            eventTime: Date.now() + 1000,
            buttons: [
                { title: '查看' },
                { title: '关闭' }
            ]
        });

        // 自动关闭通知
        setTimeout(() => {
            chrome.notifications.clear(notificationId);
        }, 10000);

    } catch (error) {
        console.error('创建通知失败:', error);
    }
}

// 窗口闪烁提醒
function flashWindow() {
    try {
        chrome.windows.getCurrent(async (window) => {
            if (window.state === 'minimized') {
                // 如果窗口最小化，先恢复
                await chrome.windows.update(window.id, { state: 'normal' });
            }

            // 闪烁窗口
            const originalState = window.state;
            await chrome.windows.update(window.id, { focused: true });
            
            // 创建闪烁效果
            let flashCount = 0;
            const maxFlashes = 3;
            
            const flashInterval = setInterval(async () => {
                if (flashCount >= maxFlashes) {
                    clearInterval(flashInterval);
                    return;
                }

                try {
                    await chrome.windows.update(window.id, { 
                        focused: !(flashCount % 2) 
                    });
                    flashCount++;
                } catch (error) {
                    console.error('窗口闪烁失败:', error);
                    clearInterval(flashInterval);
                }
            }, 200);
        });
    } catch (error) {
        console.error('窗口闪烁失败:', error);
    }
}

// 更新扩展图标状态
function updateIcon(isActive) {
    try {
        const iconPath = isActive ? 'icons/icon_active.png' : 'icons/icon48.png';
        chrome.action.setIcon({
            path: {
                "16": iconPath,
                "48": iconPath,
                "128": iconPath
            }
        });
    } catch (error) {
        console.error('更新图标失败:', error);
    }
}

// 处理标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('pinduoduo.com')) {
        console.log('拼多多页面加载完成:', tab.url);
        
        // 可以在这里添加页面加载完成后的处理逻辑
        // 比如自动检查是否需要恢复监控状态
    }
});

// 处理标签页激活
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url && tab.url.includes('pinduoduo.com')) {
            console.log('切换到拼多多页面:', tab.url);
            
            // 检查该标签页是否有监控状态
            const result = await chrome.storage.local.get('pddMonitorState');
            if (result.pddMonitorState && result.pddMonitorState.isMonitoring) {
                console.log('检测到监控状态，可能需要恢复监控');
            }
        }
    } catch (error) {
        console.error('处理标签页激活失败:', error);
    }
});

// 处理扩展图标点击
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url && tab.url.includes('pinduoduo.com')) {
        console.log('点击扩展图标，打开popup');
        // 这里可以添加图标点击时的处理逻辑
    } else {
        // 如果不在拼多多页面，显示提示
        createNotification(
            '拼多多监听器',
            '请在拼多多页面使用此功能',
            true
        );
    }
});

// 处理安装后的初始化
chrome.runtime.onStartup.addListener(() => {
    console.log('浏览器启动，初始化拼多多监听器');
    
    // 清理过期的监控状态
    cleanupExpiredStates();
});

// 清理过期的监控状态
async function cleanupExpiredStates() {
    try {
        const result = await chrome.storage.local.get('pddMonitorState');
        if (result.pddMonitorState) {
            const state = result.pddMonitorState;
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24小时
            
            if (state.lastStopTime && (now - state.lastStopTime) > maxAge) {
                await chrome.storage.local.remove('pddMonitorState');
                console.log('清理过期的监控状态');
            }
        }
    } catch (error) {
        console.error('清理过期状态失败:', error);
    }
}

// 定期清理过期状态
setInterval(cleanupExpiredStates, 60 * 60 * 1000); // 每小时清理一次

// 处理存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.pddMonitorState) {
        console.log('监控状态发生变化:', changes.pddMonitorState);
        
        // 可以在这里添加状态变化后的处理逻辑
        // 比如更新图标状态、发送通知等
    }
});

// 处理扩展卸载
chrome.runtime.onSuspend.addListener(() => {
    console.log('拼多多监听器即将卸载，清理资源');
    
    // 清理所有监控状态
    chrome.storage.local.remove('pddMonitorState');
    chrome.storage.local.remove('pddMonitorSettings');
});

// 获取当前浏览器环境的缓存键
function getBrowserCacheKey(windowId) {
    return `openedLinks_${windowId}`;
}

// 记录链接已打开（使用独立浏览器缓存）
async function recordLinkAsOpened(link, windowId = null) {
    try {
        // 如果没有提供windowId，尝试获取当前活动窗口
        if (!windowId) {
            try {
                const windows = await chrome.windows.getAll();
                const activeWindow = windows.find(w => w.focused) || windows[0];
                windowId = activeWindow ? activeWindow.id : 'default';
            } catch (error) {
                console.warn('无法获取窗口ID，使用默认值:', error);
                windowId = 'default';
            }
        }
        
        const cacheKey = getBrowserCacheKey(windowId);
        const result = await chrome.storage.local.get([cacheKey]);
        let openedLinks = result[cacheKey] || [];
        
        // 检查是否已经存在
        const existingIndex = openedLinks.findIndex(item => item.link === link);
        if (existingIndex === -1) {
            // 新链接，添加到列表
            openedLinks.push({
                link: link,
                openedAt: new Date().toISOString(),
                openedCount: 1,
                windowId: windowId
            });
        } else {
            // 已存在的链接，增加打开次数
            openedLinks[existingIndex].openedCount++;
            openedLinks[existingIndex].lastOpenedAt = new Date().toISOString();
            
            // 发送重复链接通知到popup
            try {
                await chrome.runtime.sendMessage({
                    action: 'duplicateLinkDetected',
                    link: link,
                    existingInfo: openedLinks[existingIndex]
                });
            } catch (error) {
                console.warn('发送重复链接通知失败:', error);
            }
        }
        
        // 保存到存储
        await chrome.storage.local.set({ [cacheKey]: openedLinks });
        console.log(`已记录链接打开 (窗口${windowId}): ${link}`);
    } catch (error) {
        console.error('记录链接打开失败:', error);
    }
}

// 批量链接处理函数
async function handleBatchLinks(links, options = {}) {
    try {
        const { autoStartMonitor = true, delay = 5000, silentMode = false } = options;
        
        console.log(`准备一个一个打开 ${links.length} 个链接，间隔: ${delay}ms，静默模式: ${silentMode}`);
        
        // 清理和验证链接
        const processedLinks = [];
        const invalidLinks = [];
        
        for (let i = 0; i < links.length; i++) {
            let link = links[i];
            
            if (!link || !link.trim()) {
                console.warn(`第${i + 1}行: 空链接，跳过`);
                continue;
            }
            
            link = link.trim();
            
            // 移除可能的@前缀
            if (link.startsWith('@')) {
                link = link.substring(1);
                console.log(`第${i + 1}行: 检测到@前缀，已移除: ${link}`);
            }
            
            console.log(link);
            
            try {
                // 尝试解析URL
                const url = new URL(link);
                const hostname = url.hostname.toLowerCase();
                
                // 检查是否为拼多多相关域名
                const isPddDomain = hostname.includes('pinduoduo.com') || 
                                   hostname.includes('yangkeduo.com') ||
                                   hostname.includes('pddpic.com') ||
                                   hostname.includes('pinduoduo.net');
                
                if (!isPddDomain) {
                    console.warn(`第${i + 1}行: 不支持的域名 ${hostname}，链接: ${link}`);
                    invalidLinks.push({
                        line: i + 1,
                        link: link,
                        reason: `不支持的域名: ${hostname}`
                    });
                    continue;
                }
                
                // 检查路径和参数
                const pathname = url.pathname.toLowerCase();
                const searchParams = url.searchParams;
                
                // 支持更多页面类型
                const supportedPaths = [
                    '/chat_detail.html',
                    '/goods.html',
                    '/chat.html',
                    '/detail.html',
                    '/goods_detail.html',
                    '/mall.html',
                    '/shop.html',
                    '/store.html',
                    '/product.html',
                    '/item.html'
                ];
                
                const isValidPath = supportedPaths.some(path => pathname.includes(path)) ||
                                   pathname.includes('/goods') ||
                                   pathname.includes('/chat') ||
                                   pathname.includes('/detail') ||
                                   pathname.includes('/mall') ||
                                   pathname.includes('/shop');
                
                if (!isValidPath) {
                    console.warn(`第${i + 1}行: 不支持的页面类型 ${pathname}，链接: ${link}`);
                    invalidLinks.push({
                        line: i + 1,
                        link: link,
                        reason: `不支持的页面类型: ${pathname}`
                    });
                    continue;
                }
                
                // 检查是否有基本参数（放宽要求）
                const hasBasicParams = searchParams.has('goods_id') || 
                                     searchParams.has('mall_id') ||
                                     searchParams.has('chat_id') ||
                                     searchParams.has('pdduid') ||
                                     searchParams.has('shop_id') ||
                                     searchParams.has('store_id') ||
                                     pathname.includes('/goods') ||
                                     pathname.includes('/chat') ||
                                     pathname.includes('/mall');
                
                if (!hasBasicParams) {
                    console.warn(`第${i + 1}行: 链接可能缺少必要参数，但尝试打开: ${link}`);
                    // 不强制要求参数，尝试打开
                }
                
                console.log(`第${i + 1}行: 有效链接: ${link}`);
                processedLinks.push({
                    line: i + 1,
                    link: link,
                    url: url
                });
                
            } catch (error) {
                console.warn(`第${i + 1}行: 无效链接格式: ${link}`, error);
                invalidLinks.push({
                    line: i + 1,
                    link: link,
                    reason: `无效的URL格式: ${error.message}`
                });
            }
        }
        
        if (processedLinks.length === 0) {
            const errorMsg = invalidLinks.length > 0 ? 
                `没有有效的拼多多链接。无效链接: ${invalidLinks.length} 个` :
                '没有找到任何链接';
            throw new Error(errorMsg);
        }
        
        console.log(`有效链接数量: ${processedLinks.length}, 无效链接数量: ${invalidLinks.length}`);
        
        // 初始化监控状态跟踪
        const monitorState = {
            totalLinks: processedLinks.length,
            startedCount: 0,
            failedCount: 0,
            isMonitoring: false,
            startTime: Date.now(),
            currentIndex: 0,
            isProcessing: true,
            invalidLinks: invalidLinks
        };
        
        // 保存初始状态
        await chrome.storage.local.set({ 'pddMonitorState': monitorState });
        
        // 一个一个地处理链接
        for (let i = 0; i < processedLinks.length; i++) {
            const linkInfo = processedLinks[i];
            const link = linkInfo.link;
            
            try {
                // 检查是否被用户停止
                const currentState = await chrome.storage.local.get('pddMonitorState');
                if (currentState.pddMonitorState && currentState.pddMonitorState.stoppedByUser) {
                    console.log('用户停止了批量处理');
                    monitorState.isProcessing = false;
                    monitorState.stoppedByUser = true;
                    await chrome.storage.local.set({ 'pddMonitorState': monitorState });
                    break;
                }
                
                // 检查是否已经打开过这个链接（使用当前浏览器环境的缓存）
                // 获取当前活动窗口ID
                let currentWindowId = 'default';
                try {
                    const windows = await chrome.windows.getAll();
                    const activeWindow = windows.find(w => w.focused) || windows[0];
                    currentWindowId = activeWindow ? activeWindow.id : 'default';
                } catch (error) {
                    console.warn('无法获取窗口ID，使用默认值:', error);
                }
                
                const cacheKey = getBrowserCacheKey(currentWindowId);
                const openedLinksResult = await chrome.storage.local.get([cacheKey]);
                const openedLinks = openedLinksResult[cacheKey] || [];
                const existingLink = openedLinks.find(item => item.link === link);
                
                if (existingLink) {
                    console.log(`链接已存在，跳过重复打开 (窗口${currentWindowId}): ${link} (已打开 ${existingLink.openedCount} 次)`);
                    continue;
                }
                
                console.log(`正在处理第 ${i + 1}/${processedLinks.length} 个链接 (第${linkInfo.line}行): ${link}`);
                
                // 更新当前处理状态
                monitorState.currentIndex = i + 1;
                await chrome.storage.local.set({ 'pddMonitorState': monitorState });
                
                // 创建新标签页
                const tab = await chrome.tabs.create({ 
                    url: link, 
                    active: false 
                });
                
                console.log(`已创建标签页 ${tab.id} 打开链接: ${link}`);
                
                // 记录链接已打开（使用当前窗口ID）
                try {
                    await recordLinkAsOpened(link, tab.windowId);
                } catch (error) {
                    console.warn('记录链接已打开失败:', error);
                }

                // 检查链接是否异常，如果异常则标记并放到txt文件头部
                try {
                    await checkAndMarkAbnormalLink(link, tab.id);
                } catch (error) {
                    console.warn('检查链接异常状态失败:', error);
                }

                if (silentMode) {
                    // 静默模式：隐藏标签页，只启动监听
                    try {
                        await chrome.tabs.hide(tab.id);
                        console.log(`标签页 ${tab.id} 已隐藏（静默模式）`);
                    } catch (error) {
                        console.log(`无法隐藏标签页 ${tab.id}，继续执行:`, error);
                    }
                }

                if (autoStartMonitor) {
                    // 等待页面加载完成后自动启动监控
                    setTimeout(async () => {
                        try {
                            // 检查是否被用户停止
                            const checkState = await chrome.storage.local.get('pddMonitorState');
                            if (checkState.pddMonitorState && checkState.pddMonitorState.stoppedByUser) {
                                console.log('用户停止了批量处理，跳过监控启动');
                                return;
                            }
                            
                            // 检查标签页是否仍然存在
                            try {
                                await chrome.tabs.get(tab.id);
                            } catch (error) {
                                console.log(`标签页 ${tab.id} 已关闭，跳过监控启动`);
                                return;
                            }
                            
                            // 检查页面是否加载完成
                            try {
                                const tabInfo = await chrome.tabs.get(tab.id);
                                if (tabInfo.status !== 'complete') {
                                    console.log(`标签页 ${tab.id} 仍在加载中，等待完成...`);
                                    // 如果页面还在加载，再等待一段时间
                                    setTimeout(async () => {
                                        await startMonitoringForTab(tab.id, silentMode, monitorState);
                                    }, 3000);
                                    return;
                                }
                            } catch (error) {
                                console.log(`无法获取标签页 ${tab.id} 状态:`, error);
                            }
                            
                            // 启动监控
                            await startMonitoringForTab(tab.id, silentMode, monitorState);
                            
                        } catch (error) {
                            console.error(`标签页 ${tab.id} 自动启动监控失败:`, error);
                            monitorState.failedCount++;
                            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
                        }
                    }, 5000); // 等待5秒让页面完全加载
                }

                // 延迟打开下一个链接（一个一个地打开）
                if (i < processedLinks.length - 1) {
                    console.log(`等待 ${delay}ms 后打开下一个链接...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                console.error(`打开链接失败: ${link}`, error);
                monitorState.failedCount++;
                await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            }
        }
        
        // 处理完成
        monitorState.isProcessing = false;
        await chrome.storage.local.set({ 'pddMonitorState': monitorState });
        
        const resultMessage = `成功处理 ${processedLinks.length} 个链接`;
        const invalidMessage = invalidLinks.length > 0 ? `，${invalidLinks.length} 个无效链接已跳过` : '';
        
        console.log('一个一个打开链接完成');
        return { 
            success: true, 
            message: resultMessage + invalidMessage,
            processedCount: processedLinks.length,
            invalidCount: invalidLinks.length,
            invalidLinks: invalidLinks
        };
    } catch (error) {
        console.error('批量链接处理失败:', error);
        throw error;
    }
}

// 获取默认设置
async function getDefaultSettings() {
    try {
        const result = await chrome.storage.local.get('pddChatMonitorSettings');
        return result.pddChatMonitorSettings || {
            selector: '#chat-detail-list',
            checkInterval: 1000,
            maxHistory: 100,
            notifyOnNewMessage: true,
            notifyOnMessageChange: true,
            autoReplyEnabled: 'false',
            apiEndpoint: 'http://localhost:8090/api/chat/send',
            replyDelay: 2,
            autoReplyToCustomer: true
        };
    } catch (error) {
        console.error('获取默认设置失败:', error);
        return {};
    }
}

// 检查标签页是否可用（存在且可访问）
async function isTabAvailable(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        // 检查标签页状态
        if (tab.status === 'loading') {
            console.log(`标签页 ${tabId} 正在加载中`);
            return false;
        }
        // 检查URL是否可访问（排除特殊协议）
        if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('file://')) {
            console.log(`标签页 ${tabId} 使用特殊协议，无法注入脚本: ${tab.url}`);
            return false;
        }
        return true;
    } catch (error) {
        console.log(`标签页 ${tabId} 不存在或已关闭:`, error.message);
        return false;
    }
}

// 等待标签页准备就绪
async function waitForTabReady(tabId, maxWaitTime = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitTime) {
        if (await isTabAvailable(tabId)) {
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
}

// 启动标签页的监控
async function startMonitoringForTab(tabId, silentMode, monitorState) {
    try {
        console.log(`开始为标签页 ${tabId} 启动监控...`);
        
        // 等待标签页准备就绪
        const isReady = await waitForTabReady(tabId, 15000);
        if (!isReady) {
            console.log(`标签页 ${tabId} 在15秒内未准备就绪，跳过监控启动`);
            monitorState.failedCount++;
            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            return;
        }

        // 检查标签页是否仍然是拼多多页面
        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.url.includes('pinduoduo.com')) {
                console.log(`标签页 ${tabId} 不是拼多多页面，跳过监控启动`);
                monitorState.failedCount++;
                await chrome.storage.local.set({ 'pddMonitorState': monitorState });
                return;
            }
        } catch (error) {
            console.log(`标签页 ${tabId} 已关闭或不可访问，跳过监控启动`);
            monitorState.failedCount++;
            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            return;
        }

        // 等待content script完全加载（依赖manifest.json中的静态注入）
        console.log(`等待标签页 ${tabId} 的content script加载...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒让静态注入完成
        
        // 验证content script是否成功加载
        let scriptLoaded = false;
        let retryCount = 0;
        const maxRetries = 5;
        
        while (retryCount < maxRetries && !scriptLoaded) {
            try {
                const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
                if (response && response.status === 'ready') {
                    scriptLoaded = true;
                    console.log(`标签页 ${tabId} content script验证成功`);
                    break;
                }
            } catch (error) {
                retryCount++;
                console.log(`标签页 ${tabId} content script验证失败 (尝试 ${retryCount}/${maxRetries}):`, error.message);
                
                if (retryCount < maxRetries) {
                    // 等待一段时间后重试
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        if (!scriptLoaded) {
            console.error(`标签页 ${tabId} content script在${maxRetries}次尝试后仍未加载成功`);
            monitorState.failedCount++;
            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            return;
        }
        
        // 获取默认设置
        const defaultSettings = await getDefaultSettings();
        console.log(`标签页 ${tabId} 使用默认设置:`, defaultSettings);
        
        // 发送启动监控消息
        let monitoringStarted = false;
        let startRetryCount = 0;
        const maxStartRetries = 3;
        
        while (startRetryCount < maxStartRetries && !monitoringStarted) {
            try {
                console.log(`标签页 ${tabId} 尝试启动监控 (尝试 ${startRetryCount + 1}/${maxStartRetries})...`);
                
                const response = await chrome.tabs.sendMessage(tabId, {
                    action: 'startChatMonitoring',
                    options: defaultSettings
                });
                
                if (response && response.success) {
                    monitoringStarted = true;
                    console.log(`标签页 ${tabId} 自动启动监控成功`);
                    break;
                } else {
                    console.error(`标签页 ${tabId} 启动监控失败:`, response?.error || '未知错误');
                    startRetryCount++;
                }
            } catch (error) {
                startRetryCount++;
                console.error(`标签页 ${tabId} 发送启动监控消息失败 (尝试 ${startRetryCount}/${maxStartRetries}):`, error.message);
                
                if (startRetryCount < maxStartRetries) {
                    // 等待一段时间后重试
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }
        
        if (!monitoringStarted) {
            console.error(`标签页 ${tabId} 在${maxStartRetries}次尝试后仍未成功启动监控`);
            monitorState.failedCount++;
            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            return;
        }
        
        // 验证监控是否真正启动
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            let statusVerified = false;
            let statusRetryCount = 0;
            const maxStatusRetries = 2;
            
            while (statusRetryCount < maxStatusRetries && !statusVerified) {
                try {
                    const statusResponse = await chrome.tabs.sendMessage(tabId, { action: 'getMonitoringStatus' });
                    if (statusResponse && statusResponse.isMonitoring) {
                        statusVerified = true;
                        console.log(`标签页 ${tabId} 监控状态验证成功`);
                        break;
                    } else {
                        console.log(`标签页 ${tabId} 监控状态验证失败，重试中...`);
                        statusRetryCount++;
                        if (statusRetryCount < maxStatusRetries) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                } catch (statusError) {
                    statusRetryCount++;
                    console.log(`标签页 ${tabId} 监控状态验证失败 (尝试 ${statusRetryCount}/${maxStatusRetries}):`, statusError.message);
                    if (statusRetryCount < maxStatusRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }
            
            if (!statusVerified) {
                console.log(`标签页 ${tabId} 监控状态验证失败，但继续标记为已启动`);
            }
        } catch (error) {
            console.log(`标签页 ${tabId} 监控状态验证过程出错:`, error.message);
        }
        
        // 更新监控状态
        monitorState.startedCount++;
        await chrome.storage.local.set({ 'pddMonitorState': monitorState });
        console.log(`标签页 ${tabId} 监控启动完成，当前已启动: ${monitorState.startedCount}/${monitorState.totalLinks}`);
        
        // 检查是否所有链接都已启动监控
        if (monitorState.startedCount === monitorState.totalLinks) {
            monitorState.isMonitoring = true;
            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            console.log('所有链接监控已启动，状态更新为"已启动"');
            
            // 发送通知
            createNotification(
                '监控启动完成',
                `已成功启动 ${monitorState.startedCount} 个链接的监控`,
                false
            );
        }
        
        // 如果启用了静默模式，发送隐藏页面的消息
        if (silentMode) {
            try {
                await chrome.tabs.sendMessage(tabId, {
                    action: 'hidePageContent',
                    silentMode: true
                });
                console.log(`标签页 ${tabId} 已启用静默模式`);
            } catch (error) {
                console.log(`发送隐藏页面内容消息失败:`, error);
            }
        }
        
    } catch (error) {
        console.error(`标签页 ${tabId} 自动启动监控失败:`, error);
        monitorState.failedCount++;
        await chrome.storage.local.set({ 'pddMonitorState': monitorState });
    }
}

console.log('拼多多商品聊天监听器后台脚本已加载');

// 新增：获取所有监控中的标签页
async function getAllMonitoringTabs() {
    try {
        const tabs = await chrome.tabs.query({ url: '*://*.pinduoduo.com/*' });
        const monitoringTabs = [];
        
        for (const tab of tabs) {
            try {
                // 尝试向标签页发送消息来检查监控状态
                const response = await chrome.tabs.sendMessage(tab.id, { action: 'getMonitoringStatus' });
                if (response && response.isMonitoring) {
                    monitoringTabs.push({
                        id: tab.id,
                        url: tab.url,
                        title: tab.title,
                        status: response.status
                    });
                }
            } catch (error) {
                // 标签页可能没有注入内容脚本或已关闭
                console.log(`标签页 ${tab.id} 无法获取监控状态:`, error);
            }
        }
        
        return monitoringTabs;
    } catch (error) {
        console.error('获取监控标签页失败:', error);
        return [];
    }
}

// 新增：批量停止所有监控
async function stopAllMonitoring() {
    try {
        const tabs = await chrome.tabs.query({ url: '*://*.pinduoduo.com/*' });
        let stoppedCount = 0;
        
        for (const tab of tabs) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: 'stopChatMonitoring' });
                stoppedCount++;
                console.log(`已停止标签页 ${tab.id} 的监控`);
            } catch (error) {
                console.log(`停止标签页 ${tab.id} 监控失败:`, error);
            }
        }
        
        // 清理监控状态
        await chrome.storage.local.remove('pddMonitorState');
        
        return { success: true, stoppedCount, message: `已停止 ${stoppedCount} 个标签页的监控` };
    } catch (error) {
        console.error('批量停止监控失败:', error);
        return { success: false, error: error.message };
    }
}

// 新增：获取扩展统计信息
async function getExtensionStats() {
    try {
        const result = await chrome.storage.local.get(['pddMonitorState', 'pddChatMonitorSettings']);
        const stats = {
            totalLinks: 0,
            activeMonitoring: 0,
            failedCount: 0,
            settings: result.pddChatMonitorSettings || {},
            lastUpdate: Date.now()
        };
        
        if (result.pddMonitorState) {
            stats.totalLinks = result.pddMonitorState.totalLinks || 0;
            stats.activeMonitoring = result.pddMonitorState.isMonitoring ? 1 : 0;
            stats.failedCount = result.pddMonitorState.failedCount || 0;
        }
        
        // 获取当前监控中的标签页数量
        const monitoringTabs = await getAllMonitoringTabs();
        stats.activeMonitoring = monitoringTabs.length;
        
        return stats;
    } catch (error) {
        console.error('获取扩展统计信息失败:', error);
        return { error: error.message };
    }
}

// 新增：导出监控数据
async function exportMonitoringData() {
    try {
        const result = await chrome.storage.local.get(['pddMonitorState', 'pddChatMonitorSettings']);
        const exportData = {
            exportTime: new Date().toISOString(),
            monitorState: result.pddMonitorState || {},
            settings: result.pddChatMonitorSettings || {},
            version: chrome.runtime.getManifest().version
        };
        
        // 创建下载链接
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        await chrome.downloads.download({
            url: url,
            filename: `pdd-monitor-export-${Date.now()}.json`,
            saveAs: true
        });
        
        // 清理URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        return { success: true, message: '监控数据导出成功' };
    } catch (error) {
        console.error('导出监控数据失败:', error);
        return { success: false, error: error.message };
    }
}

// 新增：导入监控数据
async function importMonitoringData(data) {
    try {
        if (!data || typeof data !== 'object') {
            throw new Error('无效的导入数据格式');
        }
        
        // 验证数据格式
        if (data.monitorState && typeof data.monitorState === 'object') {
            await chrome.storage.local.set({ 'pddMonitorState': data.monitorState });
        }
        
        if (data.settings && typeof data.settings === 'object') {
            await chrome.storage.local.set({ 'pddChatMonitorSettings': data.settings });
        }
        
        return { success: true, message: '监控数据导入成功' };
    } catch (error) {
        console.error('导入监控数据失败:', error);
        return { success: false, error: error.message };
    }
}

// 新增：重置扩展设置
async function resetExtensionSettings() {
    try {
        await chrome.storage.local.clear();
        
        // 重新设置默认设置
        const defaultSettings = await getDefaultSettings();
        await chrome.storage.local.set({ 'pddChatMonitorSettings': defaultSettings });
        
        return { success: true, message: '扩展设置已重置为默认值' };
    } catch (error) {
        console.error('重置扩展设置失败:', error);
        return { success: false, error: error.message };
    }
}

// 检查链接是否异常，如果异常则标记并放到txt文件头部
async function checkAndMarkAbnormalLink(link, tabId) {
    try {
        // 等待页面加载完成
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 检查标签页是否仍然存在
        let tab;
        try {
            tab = await chrome.tabs.get(tabId);
        } catch (error) {
            console.log(`标签页 ${tabId} 已关闭，无法检查链接状态`);
            return;
        }
        
        // 检查页面状态
        if (tab.status !== 'complete') {
            console.log(`标签页 ${tabId} 仍在加载中，等待完成...`);
            // 再等待一段时间
            await new Promise(resolve => setTimeout(resolve, 5000));
            tab = await chrome.tabs.get(tabId);
        }
        
        // 执行脚本来检查页面内容
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                // 检查页面是否正常加载
                const isPageLoaded = document.readyState === 'complete';
                
                // 检查是否有错误页面标识
                const hasErrorPage = document.title.includes('错误') || 
                                   document.title.includes('Error') ||
                                   document.title.includes('404') ||
                                   document.title.includes('无法访问') ||
                                   document.body.textContent.includes('页面不存在') ||
                                   document.body.textContent.includes('商品已下架') ||
                                   document.body.textContent.includes('链接失效') ||
                                   // 排除聊天页面的正常状态
                                   (document.title.includes('聊天') && !document.title.includes('错误')) ||
                                   (document.title.includes('客服') && !document.title.includes('错误')) ||
                                   (document.title.includes('Chat') && !document.title.includes('Error'));
                
                // 检查是否有拼多多页面特征
                const hasPddFeatures = document.querySelector('[data-testid]') ||
                                     document.querySelector('.pdd-') ||
                                     document.querySelector('[class*="pdd"]') ||
                                     document.querySelector('[id*="pdd"]') ||
                                     document.querySelector('.goods-') ||
                                     document.querySelector('.chat-') ||
                                     document.querySelector('.mall-') ||
                                     document.querySelector('.chat-detail') ||
                                     document.querySelector('.chat_detail') ||
                                     document.querySelector('[class*="chat"]') ||
                                     document.querySelector('[id*="chat"]') ||
                                     // 检查URL路径特征
                                     window.location.pathname.includes('/chat_detail.html') ||
                                     window.location.pathname.includes('/chat.html') ||
                                     // 检查页面标题特征
                                     document.title.includes('聊天') ||
                                     document.title.includes('客服') ||
                                     document.title.includes('Chat') ||
                                     document.title.includes('Customer Service');
                
                return {
                    isPageLoaded,
                    hasErrorPage,
                    hasPddFeatures,
                    title: document.title,
                    url: window.location.href
                };
            }
        });
        
        if (results && results[0] && results[0].result) {
            const pageInfo = results[0].result;
            console.log(`页面检查结果:`, pageInfo);
            
            // 判断链接是否异常
            let isAbnormal = false;
            let reason = '';
            
            if (pageInfo.hasErrorPage) {
                isAbnormal = true;
                reason = '页面显示错误信息';
            } else if (pageInfo.title.includes('无法访问') || pageInfo.title.includes('404')) {
                isAbnormal = true;
                reason = '页面无法访问';
            }
            
            // 如果链接异常，标记并放到txt文件头部
            if (isAbnormal) {
                console.log(`检测到异常链接: ${link}, 原因: ${reason}`);
                
                // 发送消息到popup.js来标记异常链接
                try {
                    await chrome.runtime.sendMessage({
                        action: 'markAbnormalLink',
                        link: link,
                        reason: reason
                    });
                } catch (error) {
                    console.warn('发送异常链接标记消息失败:', error);
                }
            }
        }
        
    } catch (error) {
        console.warn('检查链接异常状态失败:', error);
    }
}

console.log('拼多多商品聊天监听器后台脚本所有功能加载完成');

// ==================== 文件监控功能 ====================

// 启动文件监控
async function startFileMonitoring(filePath, settings = {}) {
    try {
        console.log('启动文件监控:', filePath);
        console.log('监控设置:', settings);
        
        // 验证参数
        if (!filePath) {
            throw new Error('文件路径不能为空');
        }
        
        // 更新设置
        fileMonitorSettings = { ...fileMonitorSettings, ...settings };
        monitoredFilePath = filePath;
        
        console.log('更新后的文件监控设置:', fileMonitorSettings);
        
        // 保存设置到存储
        await chrome.storage.local.set({ 
            fileMonitorSettings: fileMonitorSettings,
            monitorFilePath: monitoredFilePath // 使用新的键名
        });
        
        console.log('设置已保存到存储');
        
        // 读取初始文件内容
        try {
            const initialContent = await readFileContent(filePath);
            lastFileContent = initialContent;
            console.log('初始文件内容已读取，长度:', initialContent.length);
        } catch (error) {
            console.error('读取初始文件内容失败:', error);
            throw new Error('无法读取文件内容: ' + error.message);
        }
        
        // 启动定时检查
        fileMonitorSettings.enabled = true;
        fileMonitorInterval = setInterval(async () => {
            try {
                await checkFileForUpdates();
            } catch (error) {
                console.error('文件更新检查失败:', error);
            }
        }, fileMonitorSettings.checkInterval);
        
        console.log(`文件监控已启动，检查间隔: ${fileMonitorSettings.checkInterval}ms`);
        
        // 发送通知
        try {
            await createNotification(
                '文件监控已启动',
                `正在监控文件: ${filePath}`,
                false
            );
        } catch (error) {
            console.error('发送通知失败:', error);
        }
        
        return { success: true, message: '文件监控已启动' };
    } catch (error) {
        console.error('启动文件监控失败:', error);
        fileMonitorSettings.enabled = false;
        return { success: false, error: error.message };
    }
}

// 停止文件监控
async function stopFileMonitoring() {
    try {
        console.log('停止文件监控');
        
        if (fileMonitorInterval) {
            clearInterval(fileMonitorInterval);
            fileMonitorInterval = null;
        }
        
        fileMonitorSettings.enabled = false;
        monitoredFilePath = '';
        lastFileContent = '';
        
        // 清理存储
        await chrome.storage.local.remove(['fileMonitorSettings', 'monitorFilePath']);
        
        console.log('文件监控已停止');
        
        // 发送通知
        createNotification(
            '文件监控已停止',
            '文件监控功能已关闭',
            false
        );
        
        return { success: true, message: '文件监控已停止' };
    } catch (error) {
        console.error('停止文件监控失败:', error);
        return { success: false, error: error.message };
    }
}

// 检查文件更新
async function checkFileForUpdates() {
    try {
        // 确保设置是最新的
        const storedSettings = await chrome.storage.local.get(['fileMonitorSettings']);
        if (storedSettings.fileMonitorSettings) {
            fileMonitorSettings = { ...fileMonitorSettings, ...storedSettings.fileMonitorSettings };
            console.log('从存储加载的文件监控设置:', fileMonitorSettings);
        }
        
        if (!fileMonitorSettings.enabled || !monitoredFilePath) {
            console.log('文件监控未启用或文件路径为空:', {
                enabled: fileMonitorSettings.enabled,
                filePath: monitoredFilePath
            });
            return;
        }
        
        const currentContent = await readFileContent(monitoredFilePath);
        
        // 每次检查都读取文件中的所有链接，与本地缓存比较
        console.log('检查文件中的链接与本地缓存');
        
        // 解析文件中的所有链接
        const allFileLinks = parseLinksFromContent(currentContent);
        
        if (allFileLinks.length > 0) {
            console.log(`文件中共有 ${allFileLinks.length} 个链接`);
            
            // 与当前浏览器环境的本地缓存的已打开链接进行比较
            const newLinks = await findUnopenedLinks(allFileLinks);
            
            if (newLinks.length > 0) {
                console.log(`发现 ${newLinks.length} 个未打开的链接:`, newLinks);
                
                // 处理新链接
                await processNewLinks(newLinks);
            } else {
                console.log('所有链接都已打开过');
                
                // 检查链接数量是否一致，如果不一致则强制处理
                const openedCount = await getOpenedLinksCount();
                if (allFileLinks.length !== openedCount) {
                    console.log(`链接数量不一致！文件: ${allFileLinks.length}, 已打开: ${openedCount}，强制处理所有链接`);
                    
                    // 强制处理所有文件链接
                    await processNewLinks(allFileLinks);
                }
            }
        }
        
        // 更新文件内容（用于检测文件是否被修改）
        lastFileContent = currentContent;
    } catch (error) {
        console.error('检查文件更新失败:', error);
    }
}

// 读取文件内容（模拟实现，实际需要文件系统API）
async function readFileContent(filePath) {
    try {
        console.log('读取文件内容，文件路径:', filePath);
        
        // 发送HTTP请求到后端API读取文件内容
        const response = await fetch('http://localhost:8090/api/browser/readfile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filePath: filePath
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || '读取文件失败');
        }
        
        const content = data.content || '';
        
        if (!content) {
            throw new Error('文件内容为空');
        }
        
        console.log('从后端API读取的文件内容长度:', content.length);
        return content;
    } catch (error) {
        console.error('读取文件内容失败:', error);
        throw error;
    }
}

// 解析文件内容中的所有链接
function parseLinksFromContent(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const links = [];
    
    for (const line of lines) {
        if (isValidPddLink(line)) {
            links.push(line);
        }
    }
    
    return links;
}

// 查找未打开的链接（与当前浏览器环境的本地缓存比较）
async function findUnopenedLinks(fileLinks, windowId = null) {
    try {
        // 如果没有提供windowId，尝试获取当前活动窗口
        if (!windowId) {
            try {
                const windows = await chrome.windows.getAll();
                const activeWindow = windows.find(w => w.focused) || windows[0];
                windowId = activeWindow ? activeWindow.id : 'default';
            } catch (error) {
                console.warn('无法获取窗口ID，使用默认值:', error);
                windowId = 'default';
            }
        }
        
        // 获取当前浏览器环境的本地缓存的已打开链接
        const cacheKey = getBrowserCacheKey(windowId);
        const result = await chrome.storage.local.get([cacheKey]);
        const openedLinks = result[cacheKey] || [];
        
        // 提取已打开链接的URL列表
        const openedLinkUrls = openedLinks.map(item => item.link);
        
        // 找出文件中有但当前浏览器环境缓存中没有的链接
        const unopenedLinks = [];
        
        console.log('开始比较链接:');
        console.log('文件中的链接:', fileLinks);
        console.log('已打开的链接:', openedLinkUrls);
        
        for (const fileLink of fileLinks) {
            // 检查是否在已打开链接列表中
            const isOpened = openedLinkUrls.some(openedLink => {
                // 比较链接的基础部分（去除参数）
                const fileLinkBase = fileLink.split('?')[0];
                const openedLinkBase = openedLink.split('?')[0];
                const match = fileLinkBase === openedLinkBase;
                
                console.log(`比较链接: "${fileLinkBase}" === "${openedLinkBase}" = ${match}`);
                
                return match;
            });
            
            console.log(`文件链接 "${fileLink}" 是否已打开: ${isOpened}`);
            
            if (!isOpened) {
                unopenedLinks.push(fileLink);
            }
        }
        
        console.log(`文件链接: ${fileLinks.length}, 已打开 (窗口${windowId}): ${openedLinkUrls.length}, 未打开: ${unopenedLinks.length}`);
        
        return unopenedLinks;
    } catch (error) {
        console.error('查找未打开链接失败:', error);
        // 如果出错，返回所有文件链接（保守策略）
        return fileLinks;
    }
}

// 获取已打开链接的数量
async function getOpenedLinksCount(windowId = null) {
    try {
        // 如果没有提供windowId，尝试获取当前活动窗口
        if (!windowId) {
            try {
                const windows = await chrome.windows.getAll();
                const activeWindow = windows.find(w => w.focused) || windows[0];
                windowId = activeWindow ? activeWindow.id : 'default';
            } catch (error) {
                console.warn('无法获取窗口ID，使用默认值:', error);
                windowId = 'default';
            }
        }
        
        // 获取当前浏览器环境的本地缓存的已打开链接
        const cacheKey = getBrowserCacheKey(windowId);
        const result = await chrome.storage.local.get([cacheKey]);
        const openedLinks = result[cacheKey] || [];
        
        console.log(`窗口 ${windowId} 的已打开链接数量: ${openedLinks.length}`);
        
        return openedLinks.length;
    } catch (error) {
        console.error('获取已打开链接数量失败:', error);
        return 0;
    }
}

// 获取缓存中的所有链接
async function getAllCachedLinks(windowId = null) {
    try {
        // 如果没有提供windowId，尝试获取当前活动窗口
        if (!windowId) {
            try {
                const windows = await chrome.windows.getAll();
                const activeWindow = windows.find(w => w.focused) || windows[0];
                windowId = activeWindow ? activeWindow.id : 'default';
            } catch (error) {
                console.warn('无法获取窗口ID，使用默认值:', error);
                windowId = 'default';
            }
        }
        
        // 获取当前浏览器环境的本地缓存的已打开链接
        const cacheKey = getBrowserCacheKey(windowId);
        const result = await chrome.storage.local.get([cacheKey]);
        const openedLinks = result[cacheKey] || [];
        
        // 提取所有链接
        const allLinks = openedLinks.map(item => item.link);
        
        console.log(`获取到缓存中的 ${allLinks.length} 个链接 (窗口${windowId}):`, allLinks);
        
        return allLinks;
    } catch (error) {
        console.error('获取缓存中的所有链接失败:', error);
        return [];
    }
}

// 查找新增的链接（保留原函数用于兼容性）
function findNewLinks(oldContent, newContent) {
    const oldLines = oldContent.split('\n').map(line => line.trim()).filter(line => line);
    const newLines = newContent.split('\n').map(line => line.trim()).filter(line => line);
    
    const newLinks = [];
    
    for (const line of newLines) {
        if (!oldLines.includes(line) && isValidPddLink(line)) {
            newLinks.push(line);
        }
    }
    
    return newLinks;
}

// 验证是否为有效的拼多多链接
function isValidPddLink(link) {
    try {
        const url = new URL(link);
        const hostname = url.hostname.toLowerCase();
        
        const validDomains = ['pinduoduo.com', 'yangkeduo.com', 'pddpic.com', 'pinduoduo.net'];
        const isValidDomain = validDomains.some(domain => hostname.includes(domain));
        
        return isValidDomain;
    } catch (error) {
        return false;
    }
}

// 处理新链接
async function processNewLinks(newLinks) {
    try {
        console.log(`开始处理 ${newLinks.length} 个未打开的链接`);
        
        // 发送通知
        createNotification(
            '检测到未打开链接',
            `发现 ${newLinks.length} 个未打开的链接，正在自动处理...`,
            false
        );
        
        // 自动打开链接
        console.log('检查自动打开设置:', {
            autoOpenLinks: fileMonitorSettings.autoOpenLinks,
            settings: fileMonitorSettings
        });
        
        if (fileMonitorSettings.autoOpenLinks) {
            console.log('自动打开功能已启用，开始打开新链接');
            await autoOpenNewLinks(newLinks);
        } else {
            console.log('自动打开功能未启用，跳过打开新链接');
        }
        
    } catch (error) {
        console.error('处理新链接失败:', error);
        createNotification(
            '处理新链接失败',
            error.message,
            true
        );
    }
}

// 自动打开新链接
async function autoOpenNewLinks(newLinks) {
    try {
        console.log('自动打开新链接:', newLinks);
        
        // 使用现有的批量链接处理功能
        const response = await handleBatchLinks(newLinks, {
            autoStartMonitor: fileMonitorSettings.autoStartListening,
            delay: 3000, // 3秒间隔
            silentMode: false
        });
        
        if (response.success) {
            console.log('新链接自动打开成功');
            
            // 记录所有成功打开的链接到当前浏览器环境的本地缓存
            for (const link of newLinks) {
                try {
                    await recordLinkAsOpened(link);
                } catch (error) {
                    console.warn(`记录链接 ${link} 失败:`, error);
                }
            }
            
            // 如果启用了自动发送问候语，等待页面加载后发送
            if (fileMonitorSettings.autoSendGreeting) {
                setTimeout(async () => {
                    await sendGreetingToNewLinks(newLinks);
                }, 10000); // 等待10秒让页面完全加载
            }
        }
    } catch (error) {
        console.error('自动打开新链接失败:', error);
    }
}

// 向新链接发送问候语
async function sendGreetingToNewLinks(newLinks) {
    console.log('sendGreetingToNewLinks', newLinks);
    try {
        console.log('开始向新链接发送问候语');
        
        // 获取随机问候语
        const randomGreeting = getRandomGreeting();
        console.log('选择的随机问候语:', randomGreeting);
        
        // 获取所有拼多多标签页
        const tabs = await chrome.tabs.query({ url: '*://*.pinduoduo.com/*' });
        console.log(`找到 ${tabs.length} 个拼多多标签页`);
        
        for (const tab of tabs) {
            try {
                // 检查标签页是否可用
                if (!(await isTabAvailable(tab.id))) {
                    console.log(`标签页 ${tab.id} 不可用，跳过问候语发送`);
                    continue;
                }
                
                // 检查标签页是否包含新链接
                const isNewLink = newLinks.some(link => tab.url.includes(link.split('?')[0]));
                
                if (isNewLink) {
                    console.log(`向标签页 ${tab.id} 发送问候语: ${randomGreeting}`);
                    
                    // 等待标签页准备就绪
                    const isReady = await waitForTabReady(tab.id, 5000);
                    if (!isReady) {
                        console.log(`标签页 ${tab.id} 未准备就绪，跳过问候语发送`);
                        continue;
                    }
                    
                    // 发送消息到content script，使用sendMessageToCustomer函数
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            action: 'sendMessageToCustomer',
                            message: randomGreeting
                        });
                        console.log(`标签页 ${tab.id} 问候语发送成功`);
                    } catch (error) {
                        console.log(`向标签页 ${tab.id} 发送问候语失败:`, error.message);
                        // 尝试重试一次
                        try {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            await chrome.tabs.sendMessage(tab.id, {
                                action: 'sendMessageToCustomer',
                                message: randomGreeting
                            });
                            console.log(`标签页 ${tab.id} 问候语重试发送成功`);
                        } catch (retryError) {
                            console.log(`标签页 ${tab.id} 问候语重试发送失败:`, retryError.message);
                        }
                    }
                    
                    // 延迟发送下一个问候语
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    console.log(`标签页 ${tab.id} 不是新链接，跳过问候语发送`);
                }
            } catch (error) {
                console.error(`处理标签页 ${tab.id} 时出错:`, error.message);
                // 继续处理其他标签页
            }
        }
        
        console.log('问候语发送完成');
        
        // 发送通知
        createNotification(
            '问候语发送完成',
            `已向 ${newLinks.length} 个新链接发送问候语: ${randomGreeting}`,
            false
        );
        
    } catch (error) {
        console.error('发送问候语失败:', error);
    }
}

// 获取随机问候语
function getRandomGreeting() {
    // 默认问候语列表（以客服身份发送）
    const defaultGreetings = [
        '您好，有什么可以帮助您的吗？',
        '欢迎光临！请问有什么需要帮助的吗？',
        '您好！很高兴为您服务，有什么可以帮您的？',
        '欢迎咨询！请问您需要了解什么产品呢？',
        '您好！我是客服，有什么问题随时问我哦~',
        '欢迎来到我们店铺！有什么可以为您介绍的吗？',
        '您好！很高兴认识您，有什么需要帮助的吗？',
        '欢迎！请问您对哪个产品感兴趣呢？'
    ];
    
    // 尝试从存储中获取用户自定义的问候语列表
    try {
        const storedGreetings = fileMonitorSettings.greetingMessages;
        if (storedGreetings && Array.isArray(storedGreetings) && storedGreetings.length > 0) {
            // 过滤掉空字符串
            const validGreetings = storedGreetings.filter(greeting => greeting.trim() !== '');
            if (validGreetings.length > 0) {
                const randomIndex = Math.floor(Math.random() * validGreetings.length);
                return validGreetings[randomIndex];
            }
        }
    } catch (error) {
        console.warn('获取自定义问候语失败，使用默认问候语:', error);
    }
    
    // 如果没有自定义问候语或获取失败，使用默认问候语
    const randomIndex = Math.floor(Math.random() * defaultGreetings.length);
    return defaultGreetings[randomIndex];
}

// 初始化时恢复文件监控状态（默认不自动启动）
async function restoreFileMonitorState() {
    try {
        const result = await chrome.storage.local.get(['fileMonitorSettings', 'monitorFilePath']);
        
        // 只恢复设置，不自动启动监控
        if (result.fileMonitorSettings) {
            fileMonitorSettings = result.fileMonitorSettings;
            monitoredFilePath = result.monitorFilePath || '';
            console.log('文件监控设置已恢复，但未自动启动');
        }
        
        // 注释掉自动启动逻辑，改为手动启动
        // if (result.fileMonitorSettings && result.fileMonitorSettings.enabled) {
        //     fileMonitorSettings = result.fileMonitorSettings;
        //     monitoredFilePath = result.monitorFilePath || '';
        //     
        //     if (monitoredFilePath) {
        //         console.log('恢复文件监控状态');
        //         const result = await startFileMonitoring(monitoredFilePath, fileMonitorSettings);
        //         if (!result.success) {
        //             console.error('恢复文件监控失败:', result.error);
        //         }
        //     }
        // }
    } catch (error) {
        console.error('恢复文件监控状态失败:', error);
    }
}

// 扩展启动时恢复文件监控
chrome.runtime.onStartup.addListener(() => {
    console.log('浏览器启动，恢复文件监控状态');
    restoreFileMonitorState();
});

// 扩展安装时初始化
chrome.runtime.onInstalled.addListener(() => {
    console.log('扩展安装，初始化文件监控');
    restoreFileMonitorState();
}); 