// 拼多多商品聊天监听器 - Background Script
chrome.runtime.onInstalled.addListener(() => {
    console.log('拼多多商品聊天监听器已安装');
    
    // 设置默认权限
    chrome.permissions.request({
        permissions: ['notifications', 'storage'],
        origins: ['https://mobile.pinduoduo.com/*', 'https://*.pinduoduo.com/*']
    });
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

    return false;
});

// 创建浏览器通知
async function createNotification(title, message, isError = false) {
    try {
        // 检查通知权限
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }

        if (Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body: message,
                icon: isError ? 'icons/icon_error.png' : 'icons/icon48.png',
                badge: 'icons/icon16.png',
                tag: 'pdd-monitor',
                requireInteraction: true,
                silent: false
            });

            // 点击通知时聚焦到相关标签页
            notification.onclick = () => {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.update(tabs[0].id, { active: true });
                        chrome.windows.update(tabs[0].windowId, { focused: true });
                    }
                });
                notification.close();
            };

            // 自动关闭通知
            setTimeout(() => {
                notification.close();
            }, 10000);
        }
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
        await createNotification(
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

// 启动标签页的监控
async function startMonitoringForTab(tabId, silentMode, monitorState) {
    try {
        // 检查标签页是否仍然存在
        try {
            await chrome.tabs.get(tabId);
        } catch (error) {
            console.log(`标签页 ${tabId} 已关闭，跳过监控启动`);
            return;
        }

        // 注入内容脚本
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        });
        
        // 发送启动监控消息
        await chrome.tabs.sendMessage(tabId, {
            action: 'startChatMonitoring',
            options: await getDefaultSettings()
        });
        
        console.log(`标签页 ${tabId} 自动启动监控成功`);
        
        // 更新监控状态
        monitorState.startedCount++;
        await chrome.storage.local.set({ 'pddMonitorState': monitorState });
        
        // 检查是否所有链接都已启动监控
        if (monitorState.startedCount === monitorState.totalLinks) {
            monitorState.isMonitoring = true;
            await chrome.storage.local.set({ 'pddMonitorState': monitorState });
            console.log('所有链接监控已启动，状态更新为"已启动"');
        }
        
        // 如果启用了静默模式，发送隐藏页面的消息
        if (silentMode) {
            try {
                await chrome.tabs.sendMessage(tabId, {
                    action: 'hidePageContent',
                    silentMode: true
                });
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

console.log('拼多多商品聊天监听器后台脚本所有功能加载完成'); 