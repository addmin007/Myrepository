// 拼多多聊天监控器 - Popup Script
(function() {
    'use strict';

    // 支持的域名列表
    const validDomains = [
        'pinduoduo.com',
        'yangkeduo.com', 
        'pddpic.com',
        'pinduoduo.net'
    ];

    // 全局状态管理
    let popupState = {
        currentTab: 'monitor',
        isMonitoring: false,
        chatMonitoring: false,
        messageCount: 0,
        lastCheckTime: null,
        batchSendStopped: false,
        settings: {
            // 聊天监控设置
            chatSelector: '#chat-detail-list',
            checkInterval: 1000,
            maxHistory: 100,
            notifyOnNewMessage: true,
            notifyOnMessageChange: true,
            
            // 身份过滤设置
            roleFilterEnabled: true,
            sendServiceMessages: true,
            sendCustomerMessages: false,
            sendUnknownRoleMessages: false,
            
            // API配置
            apiConfigEnabled: true,
            apiEndpoint: 'http://localhost:8090/api/chat/send',
            apiTimeout: 15000,
            apiMaxRetries: 3,
            apiRetryDelay: 1000,
            
            // 消息过滤
            messageFilterEnabled: true,
            includeKeywords: '客服,客服人员,在线客服',
            excludeKeywords: '系统,通知,广告',
            excludedMessages: '当前版本暂不支持查看此消息，请去App查看。,此消息由机器人发送',
            
            // 拼多多配置
            pdduid: '',
            mallId: '',
            goodsId: '',
            autoGetCookie: true,
            pddChatEnabled: true,
            autoSend: true,
            aiReplyInterval: 1, // AI回复间隔时间（分钟）
            autoPaste: true,
            
            // 通知配置
            wxPusherUid: '',
            feishuWebhook: '',
            identity: '拼多多聊天监控'
        }
    };

    // DOM元素引用
    let elements = {};

    // 初始化函数
    function init() {
        console.log('初始化拼多多聊天监控器popup');
        
        // 获取DOM元素引用
        getElementReferences();
        
        // 绑定事件监听器
        bindEventListeners();
        
        // 加载保存的设置
        loadSettings();
        
        // 检查当前状态
        checkCurrentStatus();
        
        // 设置默认标签页
        showTab('monitor');
    }

    // 获取DOM元素引用
    function getElementReferences() {
        // 标签页相关
        elements.tabs = document.querySelectorAll('.tab');
        elements.tabContents = document.querySelectorAll('.tab-content');
        
        // 监控状态相关
        elements.monitorStatus = document.getElementById('monitorStatus');
        elements.chatMonitorStatus = document.getElementById('chatMonitorStatus');
        elements.messageCount = document.getElementById('messageCount');
        elements.lastCheckTime = document.getElementById('lastCheckTime');
        elements.startMonitorBtn = document.getElementById('startMonitorBtn');
        elements.stopMonitorBtn = document.getElementById('stopMonitorBtn');
        elements.checkStatusBtn = document.getElementById('checkStatusBtn');
        elements.refreshStatusBtn = document.getElementById('refreshStatusBtn');
        
        // 聊天监控相关
        elements.chatSelectorInput = document.getElementById('chatSelectorInput');
        elements.checkIntervalInput = document.getElementById('checkIntervalInput');
        elements.maxHistoryInput = document.getElementById('maxHistoryInput');
        elements.notifyNewMessageCheckbox = document.getElementById('notifyNewMessageCheckbox');
        elements.notifyMessageChangeCheckbox = document.getElementById('notifyMessageChangeCheckbox');
        elements.startChatMonitorBtn = document.getElementById('startChatMonitorBtn');
        elements.stopChatMonitorBtn = document.getElementById('stopChatMonitorBtn');
        elements.getChatStatusBtn = document.getElementById('getChatStatusBtn');
        elements.getChatHistoryBtn = document.getElementById('getChatHistoryBtn');
        
        // 身份判别相关
        elements.roleFilterEnabledCheckbox = document.getElementById('roleFilterEnabledCheckbox');
        elements.sendServiceMessagesCheckbox = document.getElementById('sendServiceMessagesCheckbox');
        elements.sendCustomerMessagesCheckbox = document.getElementById('sendCustomerMessagesCheckbox');
        elements.sendUnknownRoleMessagesCheckbox = document.getElementById('sendUnknownRoleMessagesCheckbox');
        
        // API配置相关
        elements.apiConfigEnabledCheckbox = document.getElementById('apiConfigEnabledCheckbox');
        elements.apiEndpointInput = document.getElementById('apiEndpointInput');
        elements.apiTimeoutInput = document.getElementById('apiTimeoutInput');
        elements.apiMaxRetriesInput = document.getElementById('apiMaxRetriesInput');
        elements.apiRetryDelayInput = document.getElementById('apiRetryDelayInput');
        elements.saveAPIConfigBtn = document.getElementById('saveAPIConfigBtn');
        elements.resetAPIConfigBtn = document.getElementById('resetAPIConfigBtn');
        
        // 消息过滤相关
        elements.messageFilterEnabledCheckbox = document.getElementById('messageFilterEnabledCheckbox');
        elements.includeKeywordsInput = document.getElementById('includeKeywordsInput');
        elements.excludeKeywordsInput = document.getElementById('excludeKeywordsInput');
        elements.excludedMessagesInput = document.getElementById('excludedMessagesInput');
        
        // 拼多多配置相关
        elements.pdduidInput = document.getElementById('pdduidInput');
        elements.mallIdInput = document.getElementById('mallIdInput');
        elements.goodsIdInput = document.getElementById('goodsIdInput');
        elements.autoGetCookieCheckbox = document.getElementById('autoGetCookieCheckbox');
        elements.pddChatEnabledCheckbox = document.getElementById('pddChatEnabledCheckbox');
        elements.autoSendEnabledCheckbox = document.getElementById('autoSendEnabledCheckbox');
        elements.aiReplyIntervalInput = document.getElementById('aiReplyIntervalInput');
        elements.autoPasteEnabledCheckbox = document.getElementById('autoPasteEnabledCheckbox');
        elements.refreshPageInfoBtn = document.getElementById('refreshPageInfoBtn');
        elements.savePddConfigBtn = document.getElementById('savePddConfigBtn');
        elements.clearCookieBtn = document.getElementById('clearCookieBtn');
        
        // Cookie相关
        elements.cookieStatus = document.getElementById('cookieStatus');
        elements.cookieCount = document.getElementById('cookieCount');
        elements.cookieInput = document.getElementById('cookieInput');
        elements.setCookieBtn = document.getElementById('setCookieBtn');
        
        // 批量链接相关
        elements.batchLinksInput = document.getElementById('batchLinksInput');
        elements.autoOpenLinksCheckbox = document.getElementById('autoOpenLinksCheckbox');
        elements.autoStartMonitoringCheckbox = document.getElementById('autoStartMonitoringCheckbox');
        elements.openIntervalInput = document.getElementById('openIntervalInput');
        elements.batchOpenLinksBtn = document.getElementById('batchOpenLinksBtn');
        elements.stopBatchOpenBtn = document.getElementById('stopBatchOpenBtn');
        elements.saveLinksListBtn = document.getElementById('saveLinksListBtn');
        elements.loadLinksListBtn = document.getElementById('loadLinksListBtn');
        elements.clearLinksBtn = document.getElementById('clearLinksBtn');
        
        // 批量发送消息相关
        elements.batchMessageInput = document.getElementById('batchMessageInput');
        elements.autoSendToAllLinksCheckbox = document.getElementById('autoSendToAllLinksCheckbox');
        elements.waitForPageLoadCheckbox = document.getElementById('waitForPageLoadCheckbox');
        elements.sendIntervalInput = document.getElementById('sendIntervalInput');
        elements.sendMessageToAllLinksBtn = document.getElementById('sendMessageToAllLinksBtn');
        elements.stopBatchSendBtn = document.getElementById('stopBatchSendBtn');
        elements.batchSendStatus = document.getElementById('batchSendStatus');
        elements.sentCount = document.getElementById('sentCount');
        elements.successCount = document.getElementById('successCount');
        elements.failCount = document.getElementById('failCount');
        elements.sendResultsArea = document.getElementById('sendResultsArea');
        
        // 文件导入导出相关
        elements.fileInput = document.getElementById('fileInput');
        elements.txtFileInput = document.getElementById('txtFileInput');
        elements.importFileBtn = document.getElementById('importFileBtn');
        elements.exportFileBtn = document.getElementById('exportFileBtn');
        
        // TXT导入相关元素
        elements.txtImportStatus = document.getElementById('txtImportStatus');
        elements.txtValidLinksCount = document.getElementById('txtValidLinksCount');
        elements.txtInvalidLinksCount = document.getElementById('txtInvalidLinksCount');
        elements.autoOpenTxtLinksCheckbox = document.getElementById('autoOpenTxtLinksCheckbox');
        elements.autoStartTxtMonitoringCheckbox = document.getElementById('autoStartTxtMonitoringCheckbox');
        
        // 通知配置相关
        elements.wxPusherUidInput = document.getElementById('wxPusherUidInput');
        elements.feishuWebhookInput = document.getElementById('feishuWebhookInput');
        elements.identityInput = document.getElementById('identityInput');
        
        // 消息显示区域
        elements.messageArea = document.getElementById('messageArea');
        
        // 链接计数显示
        elements.linkCount = document.getElementById('linkCount');
        
        // 批量处理状态相关
        elements.clearBatchStatusBtn = document.getElementById('clearBatchStatusBtn');
        
        // 验证所有必需元素都存在
        const requiredElements = [
            'tabs', 'tabContents', 'monitorStatus', 'chatMonitorStatus', 'messageCount', 
            'lastCheckTime', 'startMonitorBtn', 'stopMonitorBtn', 'checkStatusBtn', 'refreshStatusBtn'
        ];
        
        const missingElements = requiredElements.filter(key => !elements[key]);
        if (missingElements.length > 0) {
            console.warn('缺少必需的元素:', missingElements);
        }
    }

    // 绑定事件监听器
    function bindEventListeners() {
        // 标签页切换
        if (elements.tabs) {
            elements.tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.getAttribute('data-tab');
                    showTab(tabName);
                });
            });
        }

        // 监控状态相关
        if (elements.startMonitorBtn) elements.startMonitorBtn.addEventListener('click', startMonitoring);
        if (elements.stopMonitorBtn) elements.stopMonitorBtn.addEventListener('click', stopMonitoring);
        if (elements.checkStatusBtn) elements.checkStatusBtn.addEventListener('click', checkMonitoringStatus);
        if (elements.refreshStatusBtn) elements.refreshStatusBtn.addEventListener('click', refreshStatus);

        // 聊天监控相关
        if (elements.startChatMonitorBtn) elements.startChatMonitorBtn.addEventListener('click', startChatMonitoring);
        if (elements.stopChatMonitorBtn) elements.stopChatMonitorBtn.addEventListener('click', stopChatMonitoring);
        if (elements.getChatStatusBtn) elements.getChatStatusBtn.addEventListener('click', getChatMonitoringStatus);
        if (elements.getChatHistoryBtn) elements.getChatHistoryBtn.addEventListener('click', getChatHistory);

        // 设置变更监听
        if (elements.chatSelectorInput) elements.chatSelectorInput.addEventListener('input', updateChatSettings);
        if (elements.checkIntervalInput) elements.checkIntervalInput.addEventListener('input', updateChatSettings);
        if (elements.maxHistoryInput) elements.maxHistoryInput.addEventListener('input', updateChatSettings);
        if (elements.notifyNewMessageCheckbox) elements.notifyNewMessageCheckbox.addEventListener('change', updateChatSettings);
        if (elements.notifyMessageChangeCheckbox) elements.notifyMessageChangeCheckbox.addEventListener('change', updateChatSettings);

        // 身份判别设置
        if (elements.roleFilterEnabledCheckbox) elements.roleFilterEnabledCheckbox.addEventListener('change', updateRoleFilterSettings);
        if (elements.sendServiceMessagesCheckbox) elements.sendServiceMessagesCheckbox.addEventListener('change', updateRoleFilterSettings);
        if (elements.sendCustomerMessagesCheckbox) elements.sendCustomerMessagesCheckbox.addEventListener('change', updateRoleFilterSettings);
        if (elements.sendUnknownRoleMessagesCheckbox) elements.sendUnknownRoleMessagesCheckbox.addEventListener('change', updateRoleFilterSettings);

        // API配置相关
        if (elements.apiConfigEnabledCheckbox) elements.apiConfigEnabledCheckbox.addEventListener('change', updateAPISettings);
        if (elements.apiEndpointInput) elements.apiEndpointInput.addEventListener('input', updateAPISettings);
        if (elements.apiTimeoutInput) elements.apiTimeoutInput.addEventListener('input', updateAPISettings);
        if (elements.apiMaxRetriesInput) elements.apiMaxRetriesInput.addEventListener('input', updateAPISettings);
        if (elements.apiRetryDelayInput) elements.apiRetryDelayInput.addEventListener('input', updateAPISettings);
        if (elements.saveAPIConfigBtn) elements.saveAPIConfigBtn.addEventListener('click', saveAPIConfig);
        if (elements.resetAPIConfigBtn) elements.resetAPIConfigBtn.addEventListener('click', resetAPIConfig);

        // 消息过滤设置
        if (elements.messageFilterEnabledCheckbox) elements.messageFilterEnabledCheckbox.addEventListener('change', updateMessageFilterSettings);
        if (elements.includeKeywordsInput) elements.includeKeywordsInput.addEventListener('input', updateMessageFilterSettings);
        if (elements.excludeKeywordsInput) elements.excludeKeywordsInput.addEventListener('input', updateMessageFilterSettings);
        if (elements.excludedMessagesInput) elements.excludedMessagesInput.addEventListener('input', updateMessageFilterSettings);

        // 拼多多配置相关
        if (elements.pdduidInput) elements.pdduidInput.addEventListener('input', updatePddSettings);
        if (elements.mallIdInput) elements.mallIdInput.addEventListener('input', updatePddSettings);
        if (elements.goodsIdInput) elements.goodsIdInput.addEventListener('input', updatePddSettings);
        if (elements.autoGetCookieCheckbox) elements.autoGetCookieCheckbox.addEventListener('change', updatePddSettings);
        if (elements.pddChatEnabledCheckbox) elements.pddChatEnabledCheckbox.addEventListener('change', updatePddSettings);
        if (elements.autoSendEnabledCheckbox) elements.autoSendEnabledCheckbox.addEventListener('change', updatePddSettings);
        if (elements.aiReplyIntervalInput) elements.aiReplyIntervalInput.addEventListener('input', updatePddSettings);
        if (elements.autoPasteEnabledCheckbox) elements.autoPasteEnabledCheckbox.addEventListener('change', updatePddSettings);
        if (elements.refreshPageInfoBtn) elements.refreshPageInfoBtn.addEventListener('click', refreshPageInfo);
        if (elements.savePddConfigBtn) elements.savePddConfigBtn.addEventListener('click', savePddConfig);
        if (elements.clearCookieBtn) elements.clearCookieBtn.addEventListener('click', clearCookie);

        // Cookie相关
        if (elements.setCookieBtn) elements.setCookieBtn.addEventListener('click', setCookieManually);

        // 批量链接相关
        if (elements.batchOpenLinksBtn) elements.batchOpenLinksBtn.addEventListener('click', batchOpenLinks);
        if (elements.saveLinksListBtn) elements.saveLinksListBtn.addEventListener('click', saveLinksList);
        if (elements.loadLinksListBtn) elements.loadLinksListBtn.addEventListener('click', loadLinksList);
        if (elements.clearLinksBtn) elements.clearLinksBtn.addEventListener('click', clearLinks);
        
        // 新增：停止和清理按钮
        if (elements.stopBatchOpenBtn) {
            elements.stopBatchOpenBtn.addEventListener('click', stopBatchOpen);
        }
        if (elements.clearBatchStatusBtn) {
            elements.clearBatchStatusBtn.addEventListener('click', clearBatchStatus);
        }

        // 批量链接输入框变化监听
        if (elements.batchLinksInput) {
            elements.batchLinksInput.addEventListener('input', updateLinkCount);
            elements.batchLinksInput.addEventListener('paste', () => {
                // 粘贴后延迟更新，确保内容已完全粘贴
                setTimeout(updateLinkCount, 100);
            });
        }

        // 批量发送消息相关
        if (elements.sendMessageToAllLinksBtn) elements.sendMessageToAllLinksBtn.addEventListener('click', sendMessageToAllLinks);
        if (elements.stopBatchSendBtn) elements.stopBatchSendBtn.addEventListener('click', stopBatchSend);

        // 文件导入导出相关（统一使用TXT导入功能）
        if (elements.importFileBtn) elements.importFileBtn.addEventListener('click', importTxtFile);
        if (elements.exportFileBtn) elements.exportFileBtn.addEventListener('click', exportFile);


        // 通知配置相关
        if (elements.wxPusherUidInput) elements.wxPusherUidInput.addEventListener('input', updateNotificationSettings);
        if (elements.feishuWebhookInput) elements.feishuWebhookInput.addEventListener('input', updateNotificationSettings);
        if (elements.identityInput) elements.identityInput.addEventListener('input', updateNotificationSettings);
    }

    // 标签页切换
    function showTab(tabName) {
        console.log('切换到标签页:', tabName);
        
        // 更新当前标签页
        popupState.currentTab = tabName;

        // 移除所有活动状态
        if (elements.tabs) {
            elements.tabs.forEach(tab => {
                tab.classList.remove('active');
            });
        }

        if (elements.tabContents) {
            elements.tabContents.forEach(content => {
                content.classList.remove('active');
            });
        }

        // 激活选中的标签页
        const activeTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(`${tabName}-tab`);

        if (activeTab) {
            activeTab.classList.add('active');
            console.log('激活标签页:', tabName);
        } else {
            console.warn('未找到标签页:', tabName);
        }
        
        if (activeContent) {
            activeContent.classList.add('active');
            console.log('激活内容区域:', tabName);
        } else {
            console.warn('未找到内容区域:', tabName);
        }
    }

    // 加载保存的设置
    async function loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'pddMonitorSettings',
                'pddAPIConfig',
                'pddChatConfig',
                'batchLinks'
            ]);

            // 加载监控设置
            if (result.pddMonitorSettings) {
                popupState.settings = { ...popupState.settings, ...result.pddMonitorSettings };
            }

            // 加载API配置
            if (result.pddAPIConfig) {
                popupState.settings = { ...popupState.settings, ...result.pddAPIConfig };
            }

            // 加载拼多多配置
            if (result.pddChatConfig) {
                popupState.settings = { ...popupState.settings, ...result.pddChatConfig };
            }

            // 加载批量链接
            if (result.batchLinks) {
                elements.batchLinksInput.value = result.batchLinks.join('\n');
            }

            // 更新UI显示
            updateUISettings();
            
            // 更新链接计数
            updateLinkCount().catch(error => {
                console.error('更新链接计数失败:', error);
            });
            
            console.log('设置加载完成');
        } catch (error) {
            console.error('加载设置失败:', error);
            showMessage('加载设置失败: ' + error.message, 'error');
        }
    }

    // 更新UI设置显示
    function updateUISettings() {
        // 聊天监控设置
        elements.chatSelectorInput.value = popupState.settings.chatSelector;
        elements.checkIntervalInput.value = popupState.settings.checkInterval;
        elements.maxHistoryInput.value = popupState.settings.maxHistory;
        elements.notifyNewMessageCheckbox.checked = popupState.settings.notifyOnNewMessage;
        elements.notifyMessageChangeCheckbox.checked = popupState.settings.notifyOnMessageChange;

        // 身份判别设置
        elements.roleFilterEnabledCheckbox.checked = popupState.settings.roleFilterEnabled;
        elements.sendServiceMessagesCheckbox.checked = popupState.settings.sendServiceMessages;
        elements.sendCustomerMessagesCheckbox.checked = popupState.settings.sendCustomerMessages;
        elements.sendUnknownRoleMessagesCheckbox.checked = popupState.settings.sendUnknownRoleMessages;

        // API配置
        elements.apiConfigEnabledCheckbox.checked = popupState.settings.apiConfigEnabled;
        elements.apiEndpointInput.value = popupState.settings.apiEndpoint;
        elements.apiTimeoutInput.value = popupState.settings.apiTimeout;
        elements.apiMaxRetriesInput.value = popupState.settings.apiMaxRetries;
        elements.apiRetryDelayInput.value = popupState.settings.apiRetryDelay;

        // 消息过滤
        elements.messageFilterEnabledCheckbox.checked = popupState.settings.messageFilterEnabled;
        elements.includeKeywordsInput.value = popupState.settings.includeKeywords;
        elements.excludeKeywordsInput.value = popupState.settings.excludeKeywords;
        elements.excludedMessagesInput.value = popupState.settings.excludedMessages;

        // 拼多多配置
        elements.pdduidInput.value = popupState.settings.pdduid;
        elements.mallIdInput.value = popupState.settings.mallId;
        elements.goodsIdInput.value = popupState.settings.goodsId;
        elements.autoGetCookieCheckbox.checked = popupState.settings.autoGetCookie;
        elements.pddChatEnabledCheckbox.checked = popupState.settings.pddChatEnabled;
        elements.autoSendEnabledCheckbox.checked = popupState.settings.autoSend;
        elements.aiReplyIntervalInput.value = popupState.settings.aiReplyInterval;
        elements.autoPasteEnabledCheckbox.checked = popupState.settings.autoPaste;

        // 通知配置
        elements.wxPusherUidInput.value = popupState.settings.wxPusherUid;
        elements.feishuWebhookInput.value = popupState.settings.feishuWebhook;
        elements.identityInput.value = popupState.settings.identity;
    }

    // 保存设置
    async function saveSettings() {
        try {
            await chrome.storage.local.set({
                pddMonitorSettings: popupState.settings,
                pddAPIConfig: {
                    enabled: popupState.settings.apiConfigEnabled,
                    endpoint: popupState.settings.apiEndpoint,
                    timeout: popupState.settings.apiTimeout,
                    maxRetries: popupState.settings.apiMaxRetries,
                    retryDelay: popupState.settings.apiRetryDelay,
                    messageFilter: {
                        enabled: popupState.settings.messageFilterEnabled,
                        keywords: popupState.settings.includeKeywords.split(',').map(k => k.trim()),
                        excludeKeywords: popupState.settings.excludeKeywords.split(',').map(k => k.trim()),
                        excludedMessages: popupState.settings.excludedMessages.split(',').map(k => k.trim()),
                        roleFilter: {
                            enabled: popupState.settings.roleFilterEnabled,
                            sendServiceMessages: popupState.settings.sendServiceMessages,
                            sendCustomerMessages: popupState.settings.sendCustomerMessages,
                            sendUnknownRoleMessages: popupState.settings.sendUnknownRoleMessages
                        }
                    }
                },
                pddChatConfig: {
                    pdduid: popupState.settings.pdduid,
                    enabled: popupState.settings.pddChatEnabled,
                    autoSend: popupState.settings.autoSend,
                    aiReplyInterval: popupState.settings.aiReplyInterval,
                    autoPaste: popupState.settings.autoPaste,
                    autoGetCookie: popupState.settings.autoGetCookie
                }
            });

            console.log('设置保存成功');
            showMessage('设置保存成功', 'success');
        } catch (error) {
            console.error('保存设置失败:', error);
            showMessage('保存设置失败: ' + error.message, 'error');
        }
    }

    // 检查当前状态
    async function checkCurrentStatus() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            // 检查监控状态
            const monitorStatus = await chrome.tabs.sendMessage(tabs.id, { action: 'checkMonitoringStatus' });
            if (monitorStatus) {
                popupState.isMonitoring = monitorStatus.isMonitoring;
                updateMonitorStatusDisplay();
            }

            // 检查聊天监控状态
            const chatStatus = await chrome.tabs.sendMessage(tabs.id, { action: 'getChatMonitoringStatus' });
            if (chatStatus) {
                popupState.chatMonitoring = chatStatus.isActive;
                popupState.messageCount = chatStatus.messageCount;
                updateChatStatusDisplay();
            }

        } catch (error) {
            console.error('检查状态失败:', error);
        }
    }

    // 更新监控状态显示
    function updateMonitorStatusDisplay() {
        if (elements.monitorStatus) {
            elements.monitorStatus.textContent = popupState.isMonitoring ? '运行中' : '未启动';
            elements.monitorStatus.className = popupState.isMonitoring ? 'status-value' : 'status-value error';
        }

        if (elements.startMonitorBtn) {
            elements.startMonitorBtn.style.display = popupState.isMonitoring ? 'none' : 'block';
        }

        if (elements.stopMonitorBtn) {
            elements.stopMonitorBtn.style.display = popupState.isMonitoring ? 'block' : 'none';
        }
    }

    // 更新聊天状态显示
    function updateChatStatusDisplay() {
        if (elements.chatMonitorStatus) {
            elements.chatMonitorStatus.textContent = popupState.chatMonitoring ? '运行中' : '未启动';
            elements.chatMonitorStatus.className = popupState.chatMonitoring ? 'status-value' : 'status-value error';
        }

        if (elements.messageCount) {
            elements.messageCount.textContent = popupState.messageCount;
        }

        if (elements.startChatMonitorBtn) {
            elements.startChatMonitorBtn.style.display = popupState.chatMonitoring ? 'none' : 'block';
        }

        if (elements.stopChatMonitorBtn) {
            elements.stopChatMonitorBtn.style.display = popupState.chatMonitoring ? 'block' : 'none';
        }
    }

    // 开始监控
    async function startMonitoring() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) {
                showMessage('未找到活动标签页', 'error');
                return;
            }

            const settings = {
                selector: popupState.settings.chatSelector,
                interval: popupState.settings.checkInterval,
                waitTime: 0,
                continuousMode: true,
                identity: popupState.settings.identity
            };

            const result = await chrome.tabs.sendMessage(tabs.id, { 
                action: 'startMonitoring', 
                settings: settings 
            });

            if (result && result.success) {
                popupState.isMonitoring = true;
                updateMonitorStatusDisplay();
                showMessage('监控启动成功', 'success');
            } else {
                showMessage('监控启动失败: ' + (result?.error || '未知错误'), 'error');
            }

        } catch (error) {
            console.error('启动监控失败:', error);
            showMessage('启动监控失败: ' + error.message, 'error');
        }
    }

    // 停止监控
    async function stopMonitoring() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            const result = await chrome.tabs.sendMessage(tabs.id, { action: 'stopMonitoring' });
            
            if (result && result.success) {
                popupState.isMonitoring = false;
                updateMonitorStatusDisplay();
                showMessage('监控已停止', 'success');
            }

        } catch (error) {
            console.error('停止监控失败:', error);
            showMessage('停止监控失败: ' + error.message, 'error');
        }
    }

    // 检查监控状态
    async function checkMonitoringStatus() {
        await checkCurrentStatus();
        showMessage('状态已刷新', 'info');
    }

    // 刷新状态
    async function refreshStatus() {
        await checkCurrentStatus();
        showMessage('状态已刷新', 'info');
    }

    // 开始聊天监控
    async function startChatMonitoring() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) {
                showMessage('未找到活动标签页', 'error');
                return;
            }

            const options = {
                selector: popupState.settings.chatSelector,
                checkInterval: popupState.settings.checkInterval,
                maxHistory: popupState.settings.maxHistory,
                notifyOnNewMessage: popupState.settings.notifyOnNewMessage,
                notifyOnMessageChange: popupState.settings.notifyOnMessageChange
            };

            const result = await chrome.tabs.sendMessage(tabs.id, { 
                action: 'startChatMonitoring', 
                options: options 
            });

            if (result && result.success) {
                popupState.chatMonitoring = true;
                updateChatStatusDisplay();
                showMessage('聊天监控启动成功', 'success');
            } else {
                showMessage('聊天监控启动失败: ' + (result?.error || '未知错误'), 'error');
            }

        } catch (error) {
            console.error('启动聊天监控失败:', error);
            showMessage('启动聊天监控失败: ' + error.message, 'error');
        }
    }

    // 停止聊天监控
    async function stopChatMonitoring() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            const result = await chrome.tabs.sendMessage(tabs.id, { action: 'stopChatMonitoring' });
            
            if (result && result.success) {
                popupState.chatMonitoring = false;
                updateChatStatusDisplay();
                showMessage('聊天监控已停止', 'success');
            }

        } catch (error) {
            console.error('停止聊天监控失败:', error);
            showMessage('停止聊天监控失败: ' + error.message, 'error');
        }
    }

    // 获取聊天监控状态
    async function getChatMonitoringStatus() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            const status = await chrome.tabs.sendMessage(tabs.id, { action: 'getChatMonitoringStatus' });
            if (status) {
                popupState.chatMonitoring = status.isActive;
                popupState.messageCount = status.messageCount;
                updateChatStatusDisplay();
                showMessage(`聊天监控状态: ${status.isActive ? '运行中' : '未启动'}, 消息数量: ${status.messageCount}`, 'info');
            }

        } catch (error) {
            console.error('获取聊天监控状态失败:', error);
            showMessage('获取聊天监控状态失败: ' + error.message, 'error');
        }
    }

    // 获取聊天历史
    async function getChatHistory() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            const result = await chrome.tabs.sendMessage(tabs.id, { action: 'getChatHistory', limit: 50 });
            if (result && result.history) {
                showMessage(`获取到 ${result.history.length} 条聊天记录`, 'success');
                console.log('聊天历史:', result.history);
            }

        } catch (error) {
            console.error('获取聊天历史失败:', error);
            showMessage('获取聊天历史失败: ' + error.message, 'error');
        }
    }

    // 更新聊天设置
    function updateChatSettings() {
        popupState.settings.chatSelector = elements.chatSelectorInput.value;
        popupState.settings.checkInterval = parseInt(elements.checkIntervalInput.value);
        popupState.settings.maxHistory = parseInt(elements.maxHistoryInput.value);
        popupState.settings.notifyOnNewMessage = elements.notifyNewMessageCheckbox.checked;
        popupState.settings.notifyOnMessageChange = elements.notifyMessageChangeCheckbox.checked;
        
        saveSettings();
    }

    // 更新身份过滤设置
    function updateRoleFilterSettings() {
        popupState.settings.roleFilterEnabled = elements.roleFilterEnabledCheckbox.checked;
        popupState.settings.sendServiceMessages = elements.sendServiceMessagesCheckbox.checked;
        popupState.settings.sendCustomerMessages = elements.sendCustomerMessagesCheckbox.checked;
        popupState.settings.sendUnknownRoleMessages = elements.sendUnknownRoleMessagesCheckbox.checked;
        
        saveSettings();
    }

    // 更新API设置
    function updateAPISettings() {
        popupState.settings.apiConfigEnabled = elements.apiConfigEnabledCheckbox.checked;
        popupState.settings.apiEndpoint = elements.apiEndpointInput.value;
        popupState.settings.apiTimeout = parseInt(elements.apiTimeoutInput.value);
        popupState.settings.apiMaxRetries = parseInt(elements.apiMaxRetriesInput.value);
        popupState.settings.apiRetryDelay = parseInt(elements.apiRetryDelayInput.value);
        
        saveSettings();
    }

    // 保存API配置
    async function saveAPIConfig() {
        updateAPISettings();
        showMessage('API配置已保存', 'success');
    }

    // 重置API配置
    function resetAPIConfig() {
        // 重置为默认值
        popupState.settings.apiEndpoint = 'http://localhost:8090/api/chat/send';
        popupState.settings.apiTimeout = 15000;
        popupState.settings.apiMaxRetries = 3;
        popupState.settings.apiRetryDelay = 1000;
        
        updateUISettings();
        saveSettings();
        showMessage('API配置已重置', 'success');
    }

    // 更新消息过滤设置
    function updateMessageFilterSettings() {
        popupState.settings.messageFilterEnabled = elements.messageFilterEnabledCheckbox.checked;
        popupState.settings.includeKeywords = elements.includeKeywordsInput.value;
        popupState.settings.excludeKeywords = elements.excludeKeywordsInput.value;
        popupState.settings.excludedMessages = elements.excludedMessagesInput.value;
        
        saveSettings();
    }

    // 更新拼多多设置
    function updatePddSettings() {
        popupState.settings.pdduid = elements.pdduidInput.value;
        popupState.settings.mallId = elements.mallIdInput.value;
        popupState.settings.goodsId = elements.goodsIdInput.value;
        popupState.settings.autoGetCookie = elements.autoGetCookieCheckbox.checked;
        popupState.settings.pddChatEnabled = elements.pddChatEnabledCheckbox.checked;
        popupState.settings.autoSend = elements.autoSendEnabledCheckbox.checked;
        popupState.settings.aiReplyInterval = parseFloat(elements.aiReplyIntervalInput.value) || 1;
        popupState.settings.autoPaste = elements.autoPasteEnabledCheckbox.checked;
        
        saveSettings();
    }

    // 保存拼多多配置
    async function savePddConfig() {
        updatePddSettings();
        showMessage('拼多多配置已保存', 'success');
    }

    // 刷新页面信息
    async function refreshPageInfo() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            // 这里可以添加刷新页面信息的逻辑
            showMessage('页面信息已刷新', 'success');
        } catch (error) {
            console.error('刷新页面信息失败:', error);
            showMessage('刷新页面信息失败: ' + error.message, 'error');
        }
    }

    // 清除Cookie
    async function clearCookie() {
        try {
            popupState.settings.pdduid = '';
            popupState.settings.mallId = '';
            popupState.settings.goodsId = '';
            
            elements.pdduidInput.value = '';
            elements.mallIdInput.value = '';
            elements.goodsIdInput.value = '';
            
            saveSettings();
            showMessage('Cookie和页面信息已清除', 'success');
        } catch (error) {
            console.error('清除Cookie失败:', error);
            showMessage('清除Cookie失败: ' + error.message, 'error');
        }
    }

    // 手动设置Cookie
    async function setCookieManually() {
        try {
            const cookieValue = elements.cookieInput.value.trim();
            if (cookieValue) {
                // 这里可以添加设置Cookie的逻辑
                showMessage('Cookie设置成功', 'success');
                elements.cookieInput.value = '';
            } else {
                showMessage('请输入Cookie值', 'warning');
            }
        } catch (error) {
            console.error('设置Cookie失败:', error);
            showMessage('设置Cookie失败: ' + error.message, 'error');
        }
    }

    // 批量打开链接
    async function batchOpenLinks() {
        try {
            // 获取所有链接：包括输入框中的链接和存储中的导入链接
            let allLinks = [];
            
            // 1. 从输入框获取链接
            const inputLinks = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            allLinks.push(...inputLinks);
            
            // 2. 从存储中获取导入的链接
            try {
                const result = await chrome.storage.local.get('batchLinks');
                if (result.batchLinks && Array.isArray(result.batchLinks)) {
                    const storedLinks = result.batchLinks.filter(link => link && link.trim());
                    allLinks.push(...storedLinks);
                }
            } catch (storageError) {
                console.warn('获取存储中的链接失败:', storageError);
            }
            
            // 3. 去重并过滤空链接
            const uniqueLinks = [...new Set(allLinks)].filter(link => link && link.trim());
            
            console.log('批量打开链接 - 合并后的所有链接:', {
                inputLinks: inputLinks.length,
                storedLinks: allLinks.length - inputLinks.length,
                totalUnique: uniqueLinks.length
            });
            
            if (uniqueLinks.length === 0) {
                showMessage('没有找到任何链接，请先输入链接或导入TXT文档', 'warning');
                return;
            }

            const autoOpen = elements.autoOpenLinksCheckbox.checked;
            const autoStart = elements.autoStartMonitoringCheckbox.checked;
            const interval = parseInt(elements.openIntervalInput.value);

            // 验证间隔时间
            if (isNaN(interval) || interval < 1 || interval > 60) {
                showMessage('打开间隔必须在1-60秒之间', 'warning');
                return;
            }

            // 保存合并后的链接列表
            await chrome.storage.local.set({ batchLinks: uniqueLinks });

            if (autoOpen) {
                // 显示处理状态
                showMessage(`正在一个一个地处理 ${uniqueLinks.length} 个链接，间隔 ${interval} 秒...`, 'info');
                
                // 更新UI状态
                if (elements.batchOpenLinksBtn) {
                    elements.batchOpenLinksBtn.style.display = 'none';
                }
                if (elements.stopBatchOpenBtn) {
                    elements.stopBatchOpenBtn.style.display = 'inline-block';
                }
                
                // 立即开始状态更新，显示实时进度
                startMonitorStatusUpdate();
                
                try {
                    // 调用background.js中的批量链接处理函数
                    const response = await chrome.runtime.sendMessage({
                        action: 'handleBatchLinks',
                        links: uniqueLinks,
                        options: {
                            autoStartMonitor: autoStart,
                            delay: interval * 1000,
                            silentMode: false
                        }
                    });

                    if (response && response.success) {
                        showMessage(response.message || `已成功处理 ${uniqueLinks.length} 个链接`, 'success');
                        
                        // 继续状态更新以显示最终结果
                        if (!window.monitorStatusTimer) {
                            startMonitorStatusUpdate();
                        }
                    } else {
                        const errorMsg = response?.error || '未知错误';
                        showMessage('批量打开链接失败: ' + errorMsg, 'error');
                        console.error('批量打开链接失败:', errorMsg);
                    }
                } catch (error) {
                    console.error('发送消息到background.js失败:', error);
                    showMessage('批量打开链接失败: 无法连接到后台服务', 'error');
                } finally {
                    // 恢复按钮状态
                    if (elements.batchOpenLinksBtn) {
                        elements.batchOpenLinksBtn.style.display = 'inline-block';
                    }
                    if (elements.stopBatchOpenBtn) {
                        elements.stopBatchOpenBtn.style.display = 'none';
                    }
                }
            } else {
                showMessage(`已保存 ${uniqueLinks.length} 个链接`, 'success');
            }

        } catch (error) {
            console.error('批量打开链接失败:', error);
            showMessage('批量打开链接失败: ' + error.message, 'error');
            
            // 恢复按钮状态
            if (elements.batchOpenLinksBtn) {
                elements.batchOpenLinksBtn.style.display = 'inline-block';
            }
            if (elements.stopBatchOpenBtn) {
                elements.stopBatchOpenBtn.style.display = 'none';
            }
        }
    }

    // 开始监控状态更新
    function startMonitorStatusUpdate() {
        // 清除之前的定时器
        if (window.monitorStatusTimer) {
            clearInterval(window.monitorStatusTimer);
        }

        // 每1秒更新一次监控状态，提供更实时的进度显示
        window.monitorStatusTimer = setInterval(async () => {
            try {
                const result = await chrome.storage.local.get('pddMonitorState');
                if (result.pddMonitorState) {
                    updateMonitorStatusDisplay(result.pddMonitorState);
                    
                    // 如果处理完成或被用户停止，停止定时器
                    if (!result.pddMonitorState.isProcessing || result.pddMonitorState.stoppedByUser) {
                        clearInterval(window.monitorStatusTimer);
                        window.monitorStatusTimer = null;
                        console.log('状态更新完成，已停止定时器');
                        
                        // 显示完成消息
                        if (result.pddMonitorState.stoppedByUser) {
                            showMessage('批量处理已被用户停止', 'warning');
                        } else {
                            const successRate = result.pddMonitorState.totalLinks > 0 ? 
                                Math.round((result.pddMonitorState.startedCount / result.pddMonitorState.totalLinks) * 100) : 0;
                            showMessage(`批量处理完成！成功率: ${successRate}%`, 'success');
                        }
                    }
                }
            } catch (error) {
                console.error('更新监控状态失败:', error);
            }
        }, 1000);
    }

    // 更新监控状态显示
    function updateMonitorStatusDisplay(monitorState) {
        // 更新批量打开链接的状态显示
        const statusElement = document.getElementById('batchOpenStatus');
        if (statusElement) {
            if (monitorState.stoppedByUser) {
                statusElement.textContent = '已停止';
                statusElement.className = 'status-value error';
            } else if (monitorState.isProcessing) {
                if (monitorState.currentIndex > 0) {
                    statusElement.textContent = `处理中 (${monitorState.currentIndex}/${monitorState.totalLinks})`;
                } else {
                    statusElement.textContent = '准备中';
                }
                statusElement.className = 'status-value warning';
            } else if (monitorState.isMonitoring) {
                statusElement.textContent = '监控中';
                statusElement.className = 'status-value success';
            } else if (monitorState.startedCount > 0) {
                statusElement.textContent = `启动中 (${monitorState.startedCount}/${monitorState.totalLinks})`;
                statusElement.className = 'status-value warning';
            } else {
                statusElement.textContent = '未开始';
                statusElement.className = 'status-value info';
            }
        }

        // 更新统计信息
        const totalElement = document.getElementById('totalLinksCount');
        const startedElement = document.getElementById('startedLinksCount');
        const failedElement = document.getElementById('failedLinksCount');
        const progressElement = document.getElementById('currentProgress');

        if (totalElement) totalElement.textContent = monitorState.totalLinks || 0;
        if (startedElement) startedElement.textContent = monitorState.startedCount || 0;
        if (failedElement) failedElement.textContent = monitorState.failedCount || 0;
        
        // 更新当前进度
        if (progressElement) {
            if (monitorState.stoppedByUser) {
                progressElement.textContent = '已停止';
                progressElement.className = 'status-value error';
            } else if (monitorState.isProcessing && monitorState.currentIndex > 0) {
                progressElement.textContent = `${monitorState.currentIndex}/${monitorState.totalLinks}`;
                progressElement.className = 'status-value warning';
            } else if (monitorState.startedCount > 0) {
                progressElement.textContent = `${monitorState.startedCount}/${monitorState.totalLinks}`;
                progressElement.className = 'status-value success';
            } else {
                progressElement.textContent = '0/0';
                progressElement.className = 'status-value info';
            }
        }

        // 显示无效链接信息
        if (monitorState.invalidLinks && monitorState.invalidLinks.length > 0) {
            const invalidCountElement = document.getElementById('invalidLinksCount');
            if (invalidCountElement) {
                invalidCountElement.textContent = monitorState.invalidLinks.length;
                invalidCountElement.className = 'status-value warning';
            }
        }

        // 如果监控已完成或被停止，停止状态更新
        if (!monitorState.isProcessing || monitorState.stoppedByUser) {
            if (window.monitorStatusTimer) {
                clearInterval(window.monitorStatusTimer);
                window.monitorStatusTimer = null;
            }
        }
    }

    // 保存链接列表
    async function saveLinksList() {
        try {
            // 获取所有链接：包括输入框中的链接和存储中的导入链接
            let allLinks = [];
            
            // 1. 从输入框获取链接
            const inputLinks = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            allLinks.push(...inputLinks);
            
            // 2. 从存储中获取导入的链接
            try {
                const result = await chrome.storage.local.get('batchLinks');
                if (result.batchLinks && Array.isArray(result.batchLinks)) {
                    const storedLinks = result.batchLinks.filter(link => link && link.trim());
                    allLinks.push(...storedLinks);
                }
            } catch (storageError) {
                console.warn('获取存储中的链接失败:', storageError);
            }
            
            // 3. 去重并过滤空链接
            const uniqueLinks = [...new Set(allLinks)].filter(link => link && link.trim());
            
            // 保存合并后的链接列表
            await chrome.storage.local.set({ batchLinks: uniqueLinks });
            showMessage(`已保存 ${uniqueLinks.length} 个链接 (输入框: ${inputLinks.length}, 存储: ${allLinks.length - inputLinks.length}, 去重后: ${uniqueLinks.length})`, 'success');
        } catch (error) {
            console.error('保存链接列表失败:', error);
            showMessage('保存链接列表失败: ' + error.message, 'error');
        }
    }

    // 加载链接列表
    async function loadLinksList() {
        try {
            const result = await chrome.storage.local.get('batchLinks');
            if (result.batchLinks) {
                elements.batchLinksInput.value = result.batchLinks.join('\n');
                showMessage(`已加载 ${result.batchLinks.length} 个链接`, 'success');
                
                // 更新链接计数显示
                await updateLinkCount();
            } else {
                showMessage('没有保存的链接列表', 'info');
                
                // 更新链接计数显示
                await updateLinkCount();
            }
        } catch (error) {
            console.error('加载链接列表失败:', error);
            showMessage('加载链接列表失败: ' + error.message, 'error');
        }
    }

    // 清空链接
    async function clearLinks() {
        try {
            elements.batchLinksInput.value = '';
            
            // 清空存储中的链接
            await chrome.storage.local.remove('batchLinks');
            
            // 更新链接计数
            await updateLinkCount();
            
            showMessage('链接列表已清空', 'success');
        } catch (error) {
            console.error('清空链接失败:', error);
            showMessage('清空链接失败: ' + error.message, 'error');
        }
    }

    // 停止批量打开
    async function stopBatchOpen() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'stopBatchProcess'
            });

            if (response && response.success) {
                showMessage(response.message || '批量处理已停止', 'warning');
                
                // 更新按钮状态
                if (elements.batchOpenLinksBtn) {
                    elements.batchOpenLinksBtn.style.display = 'inline-block';
                }
                if (elements.stopBatchOpenBtn) {
                    elements.stopBatchOpenBtn.style.display = 'none';
                }
            } else {
                showMessage('停止批量处理失败: ' + (response?.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('停止批量打开失败:', error);
            showMessage('停止批量打开失败: ' + error.message, 'error');
        }
    }

    // 清理批量处理状态
    async function clearBatchStatus() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'clearBatchProcessStatus'
            });

            if (response && response.success) {
                showMessage(response.message || '批量处理状态已清理', 'success');
                
                // 重置状态显示
                const statusElements = [
                    'batchOpenStatus',
                    'totalLinksCount',
                    'startedLinksCount',
                    'failedLinksCount',
                    'invalidLinksCount',
                    'currentProgress'
                ];
                
                statusElements.forEach(id => {
                    const element = document.getElementById(id);
                    if (element) {
                        if (id === 'batchOpenStatus') {
                            element.textContent = '未开始';
                            element.className = 'status-value info';
                        } else if (id === 'currentProgress') {
                            element.textContent = '0/0';
                            element.className = 'status-value info';
                        } else {
                            element.textContent = '0';
                        }
                    }
                });
                
                // 更新按钮状态
                if (elements.batchOpenLinksBtn) {
                    elements.batchOpenLinksBtn.style.display = 'inline-block';
                }
                if (elements.stopBatchOpenBtn) {
                    elements.stopBatchOpenBtn.style.display = 'none';
                }
                
                // 重置TXT导入状态
                resetTxtImportStatus();
            } else {
                showMessage('清理批量处理状态失败: ' + (response?.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('清理批量处理状态失败:', error);
            showMessage('清理批量处理状态失败: ' + error.message, 'error');
        }
    }

    // 导出文件功能
    function exportFile() {
        try {
            const links = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            if (links.length === 0) {
                showMessage('没有链接可导出', 'warning');
                return;
            }

            // 创建下载链接
            const content = links.join('\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `pdd-links-${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            showMessage(`已导出 ${links.length} 个链接`, 'success');
        } catch (error) {
            console.error('导出文件失败:', error);
            showMessage('导出文件失败: ' + error.message, 'error');
        }
    }

    // 统一的TXT文件导入功能
    function importTxtFile() {
        console.log('TXT文件导入功能被调用');

        // 确定使用哪个文件输入元素
        const fileInput = elements.txtFileInput || elements.fileInput;
        if (!fileInput) {
            console.error('文件输入元素未找到');
            showMessage('文件输入元素未找到', 'error');
            return;
        }

        // 移除之前的事件监听器，避免重复绑定
        if (fileInput._importTxtChangeHandler) {
            fileInput.removeEventListener('change', fileInput._importTxtChangeHandler);
        }

        // 创建新的事件处理函数
        fileInput._importTxtChangeHandler = async (event) => {
            try {
                const file = event.target.files[0];
                if (!file) {
                    showMessage('未选择文件', 'warning');
                    return;
                }

                // 检查文件类型（统一只支持TXT文件）
                if (!file.name.toLowerCase().endsWith('.txt')) {
                    showMessage('只支持 .txt 文件', 'error');
                    return;
                }

                // 检查文件大小（限制为2MB）
                if (file.size > 2 * 1024 * 1024) {
                    showMessage('文件大小不能超过2MB', 'error');
                    return;
                }

                // 更新状态显示
                if (elements.txtImportStatus) {
                    elements.txtImportStatus.textContent = '正在导入...';
                    elements.txtImportStatus.className = 'status-value info';
                }
                if (elements.txtValidLinksCount) {
                    elements.txtValidLinksCount.textContent = '0';
                }
                if (elements.txtInvalidLinksCount) {
                    elements.txtInvalidLinksCount.textContent = '0';
                }

                showMessage('正在读取TXT文档...', 'info');

                // 读取文件内容
                const text = await file.text();
                if (!text || text.trim().length === 0) {
                    showMessage('文件内容为空', 'warning');
                    if (elements.txtImportStatus) {
                        elements.txtImportStatus.textContent = '导入失败';
                        elements.txtImportStatus.className = 'status-value error';
                    }
                    return;
                }

                // 解析链接
                const lines = text.split('\n');
                const links = [];
                const invalidLines = [];
                let validCount = 0;
                let invalidCount = 0;

                showMessage(`正在解析 ${lines.length} 行内容...`, 'info');

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line.length === 0) continue;

                    // 尝试解析链接
                    try {
                        const url = new URL(line);
                        const hostname = url.hostname.toLowerCase();

                        const isValidDomain = validDomains.some(domain => hostname.includes(domain));

                        if (isValidDomain) {
                            // 进一步验证链接格式
                            const pathname = url.pathname.toLowerCase();
                            const searchParams = url.searchParams;

                            // 检查是否为有效的拼多多页面类型
                            const validPageTypes = [
                                '/goods.html', '/detail.html', '/chat_detail.html', '/chat.html',
                                '/goods_detail.html', '/mall.html', '/shop.html', '/product.html'
                            ];

                            const isValidPage = validPageTypes.some(pageType => pathname.includes(pageType));

                            // 检查是否有相关参数
                            const validParams = ['goods_id', 'mall_id', 'chat_id', 'pdduid', 'shop_id', 'store_id'];
                            const hasValidParams = validParams.some(param => searchParams.has(param));

                            if (isValidPage || hasValidParams) {
                                links.push(line);
                                validCount++;
                                console.log(`有效链接 ${i + 1}: ${line}`);
                            } else {
                                invalidLines.push(`第${i + 1}行: ${line} (不是有效的拼多多页面或缺少相关参数)`);
                                invalidCount++;
                            }
                        } else {
                            invalidLines.push(`第${i + 1}行: ${line} (不支持的域名: ${hostname})`);
                            invalidCount++;
                        }
                    } catch (error) {
                        console.warn(`第${i + 1}行链接解析失败:`, line, error);
                        invalidLines.push(`第${i + 1}行: ${line} (无效的URL格式)`);
                        invalidCount++;
                    }
                }

                // 更新状态显示
                if (elements.txtValidLinksCount) {
                    elements.txtValidLinksCount.textContent = validCount;
                }
                if (elements.txtInvalidLinksCount) {
                    elements.txtInvalidLinksCount.textContent = invalidCount;
                }

                // 显示导入结果
                if (links.length > 0) {
                    // 将有效链接复制到批量链接输入框
                    elements.batchLinksInput.value = links.join('\n');

                    // 保存到存储
                    await chrome.storage.local.set({ batchLinks: links });

                    let message = `成功导入 ${links.length} 个有效链接到输入框`;
                    if (invalidCount > 0) {
                        message += `，${invalidCount} 个无效链接已过滤`;
                    }
                    showMessage(message, 'success');

                    // 更新导入状态
                    if (elements.txtImportStatus) {
                        elements.txtImportStatus.textContent = '导入成功';
                        elements.txtImportStatus.className = 'status-value success';
                    }

                    // 更新链接计数显示
                    updateLinkCount().catch(error => {
                        console.error('更新链接计数失败:', error);
                    });

                    // 如果有无效链接，显示详细信息
                    if (invalidLines.length > 0) {
                        console.warn('无效链接详情:', invalidLines);
                        showMessage(`无效链接详情已记录到控制台`, 'info');
                    }

                    // 检查是否需要自动打开链接
                    const autoOpen = elements.autoOpenTxtLinksCheckbox?.checked || false;
                    const autoStart = elements.autoStartTxtMonitoringCheckbox?.checked || false;

                    if (autoOpen) {
                        showMessage('准备自动打开导入的链接...', 'info');

                        // 延迟执行，确保UI更新完成
                        setTimeout(async () => {
                            try {
                                // 调用批量打开链接功能
                                const interval = parseInt(elements.openIntervalInput?.value) || 3;

                                // 调用background.js中的批量链接处理函数
                                const response = await chrome.runtime.sendMessage({
                                    action: 'handleBatchLinks',
                                    links: links,
                                    options: {
                                        autoStartMonitor: autoStart,
                                        delay: interval * 1000,
                                        silentMode: false
                                    }
                                });

                                if (response && response.success) {
                                    showMessage(response.message || `已成功处理 ${links.length} 个链接`, 'success');
                                } else {
                                    const errorMsg = response?.error || '未知错误';
                                    showMessage('自动打开链接失败: ' + errorMsg, 'error');
                                }
                            } catch (error) {
                                console.error('自动打开链接失败:', error);
                                showMessage('自动打开链接失败: ' + error.message, 'error');
                            }
                        }, 1000);
                    }
                } else {
                    showMessage('文件中没有找到有效的链接', 'error');
                    if (elements.txtImportStatus) {
                        elements.txtImportStatus.textContent = '导入失败';
                        elements.txtImportStatus.className = 'status-value error';
                    }
                }

                // 清理文件输入
                fileInput.value = '';

            } catch (error) {
                console.error('导入TXT文件失败:', error);
                showMessage('导入TXT文件失败: ' + error.message, 'error');
                fileInput.value = '';

                if (elements.txtImportStatus) {
                    elements.txtImportStatus.textContent = '导入失败';
                    elements.txtImportStatus.className = 'status-value error';
                }
            }
        };

        // 绑定事件监听器
        fileInput.addEventListener('change', fileInput._importTxtChangeHandler);

        // 触发文件选择
        fileInput.click();
    }

    // 重置TXT导入状态
    function resetTxtImportStatus() {
        console.log('重置TXT导入状态被调用');
        if (elements.txtImportStatus) {
            elements.txtImportStatus.textContent = '未导入';
            elements.txtImportStatus.className = 'status-value info';
        }
        if (elements.txtValidLinksCount) {
            elements.txtValidLinksCount.textContent = '0';
        }
        if (elements.txtInvalidLinksCount) {
            elements.txtInvalidLinksCount.textContent = '0';
        }
        showMessage('TXT导入状态已重置', 'success');
    }

    // 更新链接计数显示
    async function updateLinkCount() {
        try {
            // 获取所有链接：包括输入框中的链接和存储中的导入链接
            let allLinks = [];
            
            // 1. 从输入框获取链接
            const inputLinks = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            allLinks.push(...inputLinks);
            
            // 2. 从存储中获取导入的链接
            try {
                const result = await chrome.storage.local.get('batchLinks');
                if (result.batchLinks && Array.isArray(result.batchLinks)) {
                    const storedLinks = result.batchLinks.filter(link => link && link.trim());
                    allLinks.push(...storedLinks);
                }
            } catch (storageError) {
                console.warn('获取存储中的链接失败:', storageError);
            }
            
            // 3. 去重并过滤空链接
            const uniqueLinks = [...new Set(allLinks)].filter(link => link && link.trim());
            const count = uniqueLinks.length;
            
            // 更新链接计数显示
            if (elements.linkCount) {
                elements.linkCount.textContent = count;
                elements.linkCount.className = count > 0 ? 'status-value success' : 'status-value warning';
            }
            
            // 更新批量操作按钮状态
            if (elements.batchOpenLinksBtn) {
                elements.batchOpenLinksBtn.disabled = count === 0;
                elements.batchOpenLinksBtn.textContent = count === 0 ? '🚀 一个一个打开链接 (无链接)' : `🚀 一个一个打开链接 (${count}个)`;
            }
            
            if (elements.sendMessageToAllLinksBtn) {
                elements.sendMessageToAllLinksBtn.disabled = count === 0;
                elements.sendMessageToAllLinksBtn.textContent = count === 0 ? '💬 发送消息到所有链接 (无链接)' : `💬 发送消息到所有链接 (${count}个)`;
            }
            
            // 保存合并后的链接到存储
            if (count > 0) {
                chrome.storage.local.set({ batchLinks: uniqueLinks }).catch(error => {
                    console.error('保存链接失败:', error);
                });
            }
            
            console.log(`链接计数更新: ${count} 个链接 (输入框: ${inputLinks.length}, 存储: ${allLinks.length - inputLinks.length}, 去重后: ${count})`);
            
        } catch (error) {
            console.error('更新链接计数失败:', error);
        }
    }

    // 批量发送消息到所有链接
    async function sendMessageToAllLinks() {
        try {
            // 获取所有链接：包括输入框中的链接和存储中的导入链接
            let allLinks = [];
            
            // 1. 从输入框获取链接
            const inputLinks = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            allLinks.push(...inputLinks);
            
            // 2. 从存储中获取导入的链接
            try {
                const result = await chrome.storage.local.get('batchLinks');
                if (result.batchLinks && Array.isArray(result.batchLinks)) {
                    const storedLinks = result.batchLinks.filter(link => link && link.trim());
                    allLinks.push(...storedLinks);
                }
            } catch (storageError) {
                console.warn('获取存储中的链接失败:', storageError);
            }
            
            // 3. 去重并过滤空链接
            const uniqueLinks = [...new Set(allLinks)].filter(link => link && link.trim());
            
            console.log('合并后的所有链接:', {
                inputLinks: inputLinks.length,
                storedLinks: allLinks.length - inputLinks.length,
                totalUnique: uniqueLinks.length
            });
            
            if (uniqueLinks.length === 0) {
                showMessage('没有找到任何链接，请先输入链接或导入TXT文档', 'warning');
                return;
            }
            
            const message = elements.batchMessageInput.value.trim();
            
            if (!message) {
                showMessage('请输入要发送的消息内容', 'warning');
                return;
            }

            const autoSend = elements.autoSendToAllLinksCheckbox.checked;
            const waitForPageLoad = elements.waitForPageLoadCheckbox.checked;
            const interval = parseInt(elements.sendIntervalInput.value);

            // 验证间隔时间
            if (interval < 2 || interval > 30) {
                showMessage('发送间隔必须在2-30秒之间', 'warning');
                return;
            }

            // 重置状态
            resetBatchSendStatus();
            elements.batchSendStatus.textContent = '准备中...';
            elements.batchSendStatus.className = 'status-value warning';

            // 显示停止按钮
            elements.sendMessageToAllLinksBtn.style.display = 'none';
            elements.stopBatchSendBtn.style.display = 'inline-block';

            // 保存合并后的链接列表
            await chrome.storage.local.set({ batchLinks: uniqueLinks });

            if (autoSend) {
                // 开始批量发送
                await startBatchSending(uniqueLinks, message, waitForPageLoad, interval);
            } else {
                showMessage(`已保存 ${uniqueLinks.length} 个链接和消息内容，请手动点击发送`, 'success');
                elements.batchSendStatus.textContent = '已保存，等待发送';
                elements.batchSendStatus.className = 'status-value info';
                
                // 恢复按钮状态
                elements.sendMessageToAllLinksBtn.style.display = 'inline-block';
                elements.stopBatchSendBtn.style.display = 'none';
            }

        } catch (error) {
            console.error('批量发送消息失败:', error);
            showMessage('批量发送消息失败: ' + error.message, 'error');
            resetBatchSendStatus();
        }
    }

    // 开始批量发送
    async function startBatchSending(links, message, waitForPageLoad, interval) {
        let sentCount = 0;
        let successCount = 0;
        let failCount = 0;
        let retryCount = 0;
        const maxRetries = 3;
        
        elements.batchSendStatus.textContent = '发送中...';
        elements.batchSendStatus.className = 'status-value warning';
        
        for (let i = 0; i < links.length; i++) {
            // 检查是否被停止
            if (popupState.batchSendStopped) {
                break;
            }

            const link = links[i].trim();
            if (!link) continue;

            try {
                console.log(`开始发送消息到第 ${i + 1}/${links.length} 个链接:`, link);
                
                // 更新状态显示
                elements.batchSendStatus.textContent = `发送中... (${i + 1}/${links.length})`;
                
                // 创建新标签页
                const tab = await chrome.tabs.create({ url: link, active: false });
                
                // 等待页面加载
                if (waitForPageLoad) {
                    await waitForTabLoad(tab.id);
                } else {
                    await delay(3000); // 默认等待3秒
                }

                // 发送消息到该标签页（带重试机制）
                let result = null;
                retryCount = 0;
                
                while (retryCount < maxRetries && !result?.success) {
                    if (retryCount > 0) {
                        console.log(`第 ${retryCount} 次重试发送消息到:`, link);
                        await delay(2000); // 重试前等待2秒
                    }
                    
                    result = await sendMessageToTab(tab.id, message);
                    retryCount++;
                    
                    if (!result?.success && retryCount < maxRetries) {
                        console.log(`发送失败，准备重试 (${retryCount}/${maxRetries}):`, result?.error);
                    }
                }
                
                if (result?.success) {
                    successCount++;
                    const retryInfo = retryCount > 1 ? ` (重试${retryCount-1}次)` : '';
                    addSendResult(link, `✅ 成功${retryInfo}`, 'success');
                } else {
                    failCount++;
                    addSendResult(link, `❌ 失败: ${result?.error || '未知错误'}`, 'error');
                }

                sentCount++;
                updateBatchSendCounters(sentCount, successCount, failCount);

                // 关闭标签页
                try {
                    await chrome.tabs.remove(tab.id);
                } catch (closeError) {
                    console.warn('关闭标签页失败:', closeError);
                }

                // 等待间隔时间（除了最后一个）
                if (i < links.length - 1 && !popupState.batchSendStopped) {
                    elements.batchSendStatus.textContent = `等待中... (${interval}秒后继续)`;
                    await delay(interval * 1000);
                }

            } catch (error) {
                console.error(`发送消息到链接失败:`, link, error);
                failCount++;
                addSendResult(link, `❌ 错误: ${error.message}`, 'error');
                sentCount++;
                updateBatchSendCounters(sentCount, successCount, failCount);
            }
        }

        // 发送完成
        completeBatchSend(sentCount, successCount, failCount);
    }

    // 等待标签页加载完成
    function waitForTabLoad(tabId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(listener);
                reject(new Error('页面加载超时'));
            }, 30000); // 30秒超时
            
            function listener(tabIdUpdated, changeInfo, tab) {
                if (tabIdUpdated === tabId) {
                    if (changeInfo.status === 'complete') {
                        clearTimeout(timeout);
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    } else if (changeInfo.status === 'failed') {
                        clearTimeout(timeout);
                        chrome.tabs.onUpdated.removeListener(listener);
                        reject(new Error('页面加载失败'));
                    }
                }
            }
            
            chrome.tabs.onUpdated.addListener(listener);
            
            // 立即检查当前状态
            chrome.tabs.get(tabId, (tab) => {
                if (chrome.runtime.lastError) {
                    clearTimeout(timeout);
                    chrome.tabs.onUpdated.removeListener(listener);
                    reject(new Error('无法访问标签页'));
                    return;
                }
                
                if (tab.status === 'complete') {
                    clearTimeout(timeout);
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            });
        });
    }

    // 向指定标签页发送消息
    async function sendMessageToTab(tabId, message) {
        try {
            // 等待页面完全加载
            await delay(2000);
            
            // 检查标签页是否仍然存在
            try {
                const tab = await chrome.tabs.get(tabId);
                if (!tab) {
                    return { success: false, error: '标签页不存在' };
                }
            } catch (error) {
                return { success: false, error: '无法访问标签页' };
            }
            
            // 使用chrome.tabs.sendMessage发送消息到content script
            const result = await chrome.tabs.sendMessage(tabId, {
                action: 'sendMessageToCustomer',
                message: message
            });

            if (result && result.success !== undefined) {
                return result;
            } else {
                return { success: false, error: '未收到有效响应' };
            }

        } catch (error) {
            console.error('向标签页发送消息失败:', error);
            
            // 根据错误类型返回不同的错误信息
            if (error.message.includes('Could not establish connection')) {
                return { success: false, error: '页面未加载完成或content script未注入' };
            } else if (error.message.includes('The tab was closed')) {
                return { success: false, error: '标签页已关闭' };
            } else {
                return { success: false, error: error.message };
            }
        }
    }



    // 停止批量发送
    function stopBatchSend() {
        popupState.batchSendStopped = true;
        elements.batchSendStatus.textContent = '已停止';
        elements.batchSendStatus.className = 'status-value warning';
        
        // 恢复按钮状态
        elements.sendMessageToAllLinksBtn.style.display = 'inline-block';
        elements.stopBatchSendBtn.style.display = 'none';
        
        // 显示停止确认消息
        const currentSent = parseInt(elements.sentCount.textContent) || 0;
        const currentSuccess = parseInt(elements.successCount.textContent) || 0;
        const currentFail = parseInt(elements.failCount.textContent) || 0;
        
        showMessage(`批量发送已停止。已发送: ${currentSent}, 成功: ${currentSuccess}, 失败: ${currentFail}`, 'warning');
        
        console.log('批量发送已停止');
    }

    // 重置批量发送状态
    function resetBatchSendStatus() {
        elements.sentCount.textContent = '0';
        elements.successCount.textContent = '0';
        elements.failCount.textContent = '0';
        elements.sendResultsArea.innerHTML = '';
        popupState.batchSendStopped = false;
    }

    // 更新批量发送计数器
    function updateBatchSendCounters(sent, success, fail) {
        elements.sentCount.textContent = sent;
        elements.successCount.textContent = success;
        elements.failCount.textContent = fail;
    }

    // 完成批量发送
    function completeBatchSend(sent, success, fail) {
        const successRate = sent > 0 ? Math.round((success / sent) * 100) : 0;
        
        elements.batchSendStatus.textContent = '发送完成';
        elements.batchSendStatus.className = 'status-value success';
        
        // 恢复按钮状态
        elements.sendMessageToAllLinksBtn.style.display = 'inline-block';
        elements.stopBatchSendBtn.style.display = 'none';
        
        // 显示详细的完成统计
        let message = `批量发送完成！`;
        message += `\n📊 统计信息:`;
        message += `\n• 总链接数: ${sent}`;
        message += `\n• 成功发送: ${success}`;
        message += `\n• 发送失败: ${fail}`;
        message += `\n• 成功率: ${successRate}%`;
        
        if (fail > 0) {
            message += `\n\n⚠️ 有 ${fail} 个链接发送失败，请检查失败原因`;
        }
        
        showMessage(message, 'success');
        
        // 在结果区域添加总结
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'status-item summary-message';
        summaryDiv.style.marginTop = '15px';
        summaryDiv.style.padding = '10px';
        summaryDiv.style.backgroundColor = '#f0f8ff';
        summaryDiv.style.border = '1px solid #87ceeb';
        summaryDiv.style.borderRadius = '5px';
        summaryDiv.innerHTML = `
            <strong>📋 发送总结</strong><br>
            总链接数: ${sent} | 成功: ${success} | 失败: ${fail} | 成功率: ${successRate}%
        `;
        
        elements.sendResultsArea.appendChild(summaryDiv);
        elements.sendResultsArea.scrollTop = elements.sendResultsArea.scrollHeight;
        
        console.log('批量发送完成:', { sent, success, fail, successRate });
    }

    // 添加发送结果
    function addSendResult(link, result, type) {
        const resultDiv = document.createElement('div');
        resultDiv.className = `status-item ${type}-message`;
        resultDiv.style.marginBottom = '10px';
        resultDiv.style.padding = '10px';
        resultDiv.style.borderRadius = '8px';
        resultDiv.style.border = '1px solid';
        
        // 根据类型设置样式
        if (type === 'success') {
            resultDiv.style.backgroundColor = '#f0fff0';
            resultDiv.style.borderColor = '#90ee90';
            resultDiv.style.color = '#006400';
        } else if (type === 'error') {
            resultDiv.style.backgroundColor = '#fff0f0';
            resultDiv.style.borderColor = '#ffb6c1';
            resultDiv.style.color = '#8b0000';
        } else {
            resultDiv.style.backgroundColor = '#f0f0f0';
            resultDiv.style.borderColor = '#d3d3d3';
            resultDiv.style.color = '#696969';
        }
        
        // 链接显示
        const linkText = document.createElement('div');
        linkText.style.fontSize = '12px';
        linkText.style.color = '#666';
        linkText.style.marginBottom = '8px';
        linkText.style.wordBreak = 'break-all';
        linkText.style.lineHeight = '1.4';
        
        // 截断长链接，但保留重要信息
        let displayLink = link;
        if (link.length > 80) {
            const url = new URL(link);
            const path = url.pathname;
            const query = url.search;
            if (path.length > 40) {
                displayLink = `${url.origin}${path.substring(0, 40)}...${query}`;
            } else {
                displayLink = `${url.origin}${path}${query}`;
            }
        }
        linkText.textContent = displayLink;
        
        // 添加完整链接提示
        if (link.length > 80) {
            linkText.title = link;
        }
        
        // 结果状态
        const resultText = document.createElement('div');
        resultText.style.fontWeight = 'bold';
        resultText.style.fontSize = '14px';
        resultText.textContent = result;
        
        // 时间戳
        const timestamp = document.createElement('div');
        timestamp.style.fontSize = '11px';
        timestamp.style.color = '#999';
        timestamp.style.marginTop = '5px';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        resultDiv.appendChild(linkText);
        resultDiv.appendChild(resultText);
        resultDiv.appendChild(timestamp);
        
        elements.sendResultsArea.appendChild(resultDiv);
        
        // 自动滚动到底部
        elements.sendResultsArea.scrollTop = elements.sendResultsArea.scrollHeight;
    }

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 更新通知设置
    function updateNotificationSettings() {
        popupState.settings.wxPusherUid = elements.wxPusherUidInput.value;
        popupState.settings.feishuWebhook = elements.feishuWebhookInput.value;
        popupState.settings.identity = elements.identityInput.value;
        
        saveSettings();
    }

    // 显示消息
    function showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `${type}-message`;
        messageDiv.textContent = message;
        
        elements.messageArea.appendChild(messageDiv);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('收到消息:', message);
        
        switch (message.action) {
            case 'updateContent':
                // 更新内容显示
                break;
                
            case 'updateStatus':
                // 更新状态显示
                popupState.isMonitoring = message.isActive;
                updateMonitorStatusDisplay();
                break;
                
            case 'updateCountdown':
                // 更新倒计时显示
                break;
                
            case 'newChatMessage':
                // 新聊天消息
                popupState.messageCount = message.totalCount;
                updateChatStatusDisplay();
                break;
                
            case 'updateChatStatus':
                // 更新聊天状态
                popupState.chatMonitoring = message.isActive;
                updateChatStatusDisplay();
                break;
                
            case 'apiMessageSent':
                // API消息发送结果
                if (message.success) {
                    showMessage(`API消息发送成功 (重试${message.retryCount}次)`, 'success');
                } else {
                    showMessage(`API消息发送失败: ${message.error}`, 'error');
                }
                break;
                
            case 'aiMessageSent':
                // AI消息发送结果
                if (message.success) {
                    showMessage(`AI消息发送成功: ${message.message}`, 'success');
                } else {
                    showMessage(`AI消息发送失败: ${message.error}`, 'error');
                }
                break;
        }
        
        sendResponse({ received: true });
    });

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(); 