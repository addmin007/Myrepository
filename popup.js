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
        selectedTxtFile: null, // 当前选择的TXT文件
        settings: {
            // 聊天监控设置
            chatSelector: '#chat-detail-list',
            checkInterval: 1000,
            maxHistory: 100,
            
            // 新增：消息等待时间配置
            messageWaitDuration: 10, // 默认10秒
            
            // 身份过滤设置
            roleFilterEnabled: true,
            sendServiceMessages: true,
            sendCustomerMessages: true,
            sendUnknownRoleMessages: true,
            
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
            aiReplyInterval: 0, // AI回复间隔时间（秒），0表示立即发送
            autoPaste: true,
            

        }
    };

    // DOM元素引用
    let elements = {};
    
    // 当前要保存的链接列表
    let currentLinks = [];
    
    // 错误链接列表
    let errorLinks = [];
    
    // 已打开链接的跟踪列表
    let openedLinks = [];

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
        
        // 更新TXT文件状态显示
        updateTxtFileStatus();
        
        // 加载自定义话术
        loadCustomMessages();
        
        // 加载错误链接
        loadErrorLinks();
        
        // 加载已打开链接记录
        loadOpenedLinks();
        
        // 初始化文件监控
        initFileMonitor();
        
        // 设置默认标签页
        showTab('monitor');
    }

    // 获取DOM元素引用
    function getElementReferences() {
        try {
            console.log("=== getElementReferences 函数开始执行 ===");
            console.log("1");
            
            // 检查DOM是否准备就绪
            if (!document.body) {
                console.warn('DOM还未准备就绪');
                return;
            }
            
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

        elements.startChatMonitorBtn = document.getElementById('startChatMonitorBtn');
        elements.stopChatMonitorBtn = document.getElementById('stopChatMonitorBtn');
        elements.debugConnectionBtn = document.getElementById('debugConnectionBtn');
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
        elements.messageWaitDurationInput = document.getElementById('messageWaitDurationInput');
        elements.saveAPIConfigBtn = document.getElementById('saveAPIConfigBtn');
        elements.resetAPIConfigBtn = document.getElementById('resetAPIConfigBtn');
        
        // 消息过滤相关
        elements.messageFilterEnabledCheckbox = document.getElementById('messageFilterEnabledCheckbox');
        elements.includeKeywordsInput = document.getElementById('includeKeywordsInput');
        elements.excludeKeywordsInput = document.getElementById('excludeKeywordsInput');
        elements.excludedMessagesInput = document.getElementById('excludedMessagesInput');
        
        // 重复链接提醒设置
        elements.resetDuplicateReminderBtn = document.getElementById('resetDuplicateReminderBtn');
        elements.duplicateReminderStatus = document.getElementById('duplicateReminderStatus');
        
        // 拼多多配置相关
        elements.pdduidInput = document.getElementById('pdduidInput');
        elements.mallIdInput = document.getElementById('mallIdInput');
        elements.goodsIdInput = document.getElementById('goodsIdInput');
        elements.autoGetCookieCheckbox = document.getElementById('autoGetCookieCheckbox');
        elements.pddChatEnabledCheckbox = document.getElementById('pddChatEnabledCheckbox');
        elements.autoSendEnabledCheckbox = document.getElementById('autoSendEnabledCheckbox');
        elements.aiReplyIntervalInput = document.getElementById('aiReplyIntervalInput'); // may be absent if the field is removed
        elements.autoPasteEnabledCheckbox = document.getElementById('autoPasteEnabledCheckbox');
        elements.refreshPageInfoBtn = document.getElementById('refreshPageInfoBtn');
        console.log("2");
        elements.savePddConfigBtn = document.getElementById('savePddConfigBtn');
        console.log('savePddConfigBtn:', document.getElementById('savePddConfigBtn'));
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
        
        // 话术选择相关
        elements.customMessageInput = document.getElementById('customMessageInput');
        elements.addCustomMessageBtn = document.getElementById('addCustomMessageBtn');
        elements.customMessageButtons = document.getElementById('customMessageButtons');
        elements.importCustomMessagesBtn = document.getElementById('importCustomMessagesBtn');
        elements.exportCustomMessagesBtn = document.getElementById('exportCustomMessagesBtn');
        
        // 文件导入导出相关
        elements.fileInput = document.getElementById('fileInput');
        elements.txtFilePathInput = document.getElementById('txtFilePathInput');
        elements.importFileBtn = document.getElementById('importFileBtn');
        elements.exportFileBtn = document.getElementById('exportFileBtn');
        
        // 手动添加链接相关
        elements.manualLinkInput = document.getElementById('manualLinkInput');
        elements.addManualLinkBtn = document.getElementById('addManualLinkBtn');
        elements.checkLinkFormatBtn = document.getElementById('checkLinkFormatBtn');
        
        // TXT导入相关元素
        elements.txtImportStatus = document.getElementById('txtImportStatus');
        elements.txtValidLinksCount = document.getElementById('txtValidLinksCount');
        elements.txtInvalidLinksCount = document.getElementById('txtInvalidLinksCount');
        elements.autoOpenTxtLinksCheckbox = document.getElementById('autoOpenTxtLinksCheckbox');
        elements.autoStartTxtMonitoringCheckbox = document.getElementById('autoStartTxtMonitoringCheckbox');
        
        // 选中的TXT文件显示相关
        elements.selectedFileInfo = document.getElementById('selectedFileInfo');
        elements.selectedFileName = document.getElementById('selectedFileName');
        
        // 文件监控相关
        elements.enableFileMonitoringCheckbox = document.getElementById('enableFileMonitoringCheckbox');
        elements.fileMonitorSettings = document.getElementById('fileMonitorSettings');
        elements.autoOpenNewLinksCheckbox = document.getElementById('autoOpenNewLinksCheckbox');
        elements.autoStartNewLinksMonitoringCheckbox = document.getElementById('autoStartNewLinksMonitoringCheckbox');
        elements.autoSendGreetingCheckbox = document.getElementById('autoSendGreetingCheckbox');
        elements.greetingMessageInput = document.getElementById('greetingMessageInput');
        elements.monitorFilePathInput = document.getElementById('monitorFilePathInput');
        elements.monitorIntervalSelect = document.getElementById('monitorIntervalSelect');
        elements.startFileMonitorBtn = document.getElementById('startFileMonitorBtn');
        elements.stopFileMonitorBtn = document.getElementById('stopFileMonitorBtn');
        elements.fileMonitorStatus = document.getElementById('fileMonitorStatus');
        elements.monitorStatusText = document.getElementById('monitorStatusText');
        

        
        // 消息显示区域
        elements.messageArea = document.getElementById('messageArea');
        
        // 链接计数显示
        elements.linkCount = document.getElementById('linkCount');
        
        // 保存选项对话框相关
        elements.saveOptionsDialog = document.getElementById('saveOptionsDialog');
        elements.saveNewFileBtn = document.getElementById('saveNewFileBtn');
        elements.selectExistingFileBtn = document.getElementById('selectExistingFileBtn');
        elements.cancelSaveBtn = document.getElementById('cancelSaveBtn');
        
        // 错误链接管理相关
        elements.errorLinksInput = document.getElementById('errorLinksInput');
        elements.errorLinksCount = document.getElementById('errorLinksCount');
        elements.removeErrorLinksBtn = document.getElementById('removeErrorLinksBtn');
        elements.exportErrorLinksBtn = document.getElementById('exportErrorLinksBtn');
        elements.clearErrorLinksBtn = document.getElementById('clearErrorLinksBtn');
        elements.verifyErrorLinksBtn = document.getElementById('verifyErrorLinksBtn');
        elements.cleanNormalLinksBtn = document.getElementById('cleanNormalLinksBtn');
        
        // 已打开链接管理相关
        elements.openedLinksInput = document.getElementById('openedLinksInput');
        elements.openedLinksCount = document.getElementById('openedLinksCount');
        elements.exportOpenedLinksBtn = document.getElementById('exportOpenedLinksBtn');
        elements.clearOpenedLinksBtn = document.getElementById('clearOpenedLinksBtn');
        elements.refreshOpenedLinksBtn = document.getElementById('refreshOpenedLinksBtn');
        
        // 验证所有必需元素都存在
        const requiredElements = [
            'tabs', 'tabContents', 'monitorStatus', 'chatMonitorStatus', 'messageCount', 
            'lastCheckTime', 'startMonitorBtn', 'stopMonitorBtn', 'checkStatusBtn', 'refreshStatusBtn'
        ];
        
        const missingElements = requiredElements.filter(key => !elements[key]);
        if (missingElements.length > 0) {
            console.warn('缺少必需的元素:', missingElements);
        }
        
        console.log("=== getElementReferences 函数执行完成 ===");
        
    } catch (error) {
        console.error('getElementReferences 函数执行错误:', error);
        console.error('错误堆栈:', error.stack);
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
        if (elements.debugConnectionBtn) elements.debugConnectionBtn.addEventListener('click', debugConnection);
        if (elements.getChatStatusBtn) elements.getChatStatusBtn.addEventListener('click', getChatMonitoringStatus);
        if (elements.getChatHistoryBtn) elements.getChatHistoryBtn.addEventListener('click', getChatHistory);

        // 设置变更监听
        if (elements.chatSelectorInput) elements.chatSelectorInput.addEventListener('input', updateChatSettings);
        if (elements.checkIntervalInput) elements.checkIntervalInput.addEventListener('input', updateChatSettings);
        if (elements.maxHistoryInput) elements.maxHistoryInput.addEventListener('input', updateChatSettings);


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
        
        // 重复链接提醒设置
        if (elements.resetDuplicateReminderBtn) elements.resetDuplicateReminderBtn.addEventListener('click', resetDuplicateReminder);

        // 拼多多配置相关
        if (elements.refreshPageInfoBtn) elements.refreshPageInfoBtn.addEventListener('click', refreshPageInfo);
        if (elements.savePddConfigBtn) elements.savePddConfigBtn.addEventListener('click', savePddConfig);
        if (elements.clearCookieBtn) elements.clearCookieBtn.addEventListener('click', clearCookie);
        
        // AI回复间隔时间设置 - 移除自动保存，改为手动保存

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
            elements.batchLinksInput.addEventListener('paste', async (e) => {
                // 粘贴后延迟更新，确保内容已完全粘贴
                setTimeout(async () => {
                    await updateLinkCount();
                    // 检查粘贴的链接是否有重复
                    await checkPastedLinksForDuplicates();
                }, 100);
            });
        }

        // 批量发送消息相关
        if (elements.sendMessageToAllLinksBtn) elements.sendMessageToAllLinksBtn.addEventListener('click', sendMessageToAllLinks);
        if (elements.stopBatchSendBtn) elements.stopBatchSendBtn.addEventListener('click', stopBatchSend);

        // 文件导入导出相关（统一使用TXT导入功能）
        if (elements.importFileBtn) elements.importFileBtn.addEventListener('click', importTxtFile);
        if (elements.exportFileBtn) elements.exportFileBtn.addEventListener('click', exportFile);
        
        // 文件路径输入框现在是只读的，不需要事件监听器
        
        // 文件监控相关
        if (elements.enableFileMonitoringCheckbox) {
            elements.enableFileMonitoringCheckbox.addEventListener('change', toggleFileMonitorSettings);
        }
        if (elements.startFileMonitorBtn) {
            elements.startFileMonitorBtn.addEventListener('click', startFileMonitoring);
        }
        if (elements.stopFileMonitorBtn) {
            elements.stopFileMonitorBtn.addEventListener('click', stopFileMonitoring);
        }
        if (elements.autoSendGreetingCheckbox) {
            elements.autoSendGreetingCheckbox.addEventListener('change', toggleGreetingMessageGroup);
        }
        if (elements.monitorFilePathInput) {
            elements.monitorFilePathInput.addEventListener('input', saveMonitorFilePath);
        }
        
        // 手动添加链接相关
        if (elements.addManualLinkBtn) elements.addManualLinkBtn.addEventListener('click', addManualLink);
        if (elements.manualLinkInput) {
            elements.manualLinkInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault(); // 阻止默认的换行行为
                    addManualLink();
                }
                // Enter键单独按下时不阻止，允许正常换行
            });
        }
        
        // 错误链接管理相关
        if (elements.removeErrorLinksBtn) elements.removeErrorLinksBtn.addEventListener('click', removeErrorLinks);
        if (elements.exportErrorLinksBtn) elements.exportErrorLinksBtn.addEventListener('click', exportErrorLinks);
        if (elements.clearErrorLinksBtn) elements.clearErrorLinksBtn.addEventListener('click', clearErrorLinks);



        
        // 新增：话术按钮事件绑定
        bindQuickMessageButtons();
        
        // 话术相关事件绑定
        if (elements.addCustomMessageBtn) {
            elements.addCustomMessageBtn.addEventListener('click', addCustomMessage);
        }
        if (elements.customMessageInput) {
            elements.customMessageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addCustomMessage();
                }
            });
        }
        
        // 导入导出自定义话术按钮事件绑定
        if (elements.importCustomMessagesBtn) {
            elements.importCustomMessagesBtn.addEventListener('click', importCustomMessages);
        }
        if (elements.exportCustomMessagesBtn) {
            elements.exportCustomMessagesBtn.addEventListener('click', exportCustomMessages);
        }
        
        // 保存选项对话框按钮事件绑定
        if (elements.saveNewFileBtn) {
            elements.saveNewFileBtn.addEventListener('click', () => saveToNewFile(currentLinks));
        }
        if (elements.selectExistingFileBtn) {
            elements.selectExistingFileBtn.addEventListener('click', () => selectExistingFile(currentLinks));
        }
        if (elements.cancelSaveBtn) {
            elements.cancelSaveBtn.addEventListener('click', hideSaveOptionsDialog);
        }
        
        // 错误链接管理按钮事件绑定
        if (elements.removeErrorLinksBtn) {
            elements.removeErrorLinksBtn.addEventListener('click', removeErrorLinks);
        }
        if (elements.exportErrorLinksBtn) {
            elements.exportErrorLinksBtn.addEventListener('click', exportErrorLinks);
        }
        if (elements.clearErrorLinksBtn) {
            elements.clearErrorLinksBtn.addEventListener('click', clearErrorLinks);
        }
        if (elements.verifyErrorLinksBtn) {
            elements.verifyErrorLinksBtn.addEventListener('click', verifyErrorLinks);
        }
                    if (elements.cleanNormalLinksBtn) {
                elements.cleanNormalLinksBtn.addEventListener('click', cleanNormalLinks);
            }
            
            if (elements.checkLinkFormatBtn) {
                elements.checkLinkFormatBtn.addEventListener('click', checkSingleLinkFormat);
            }
        
        // 已打开链接管理按钮事件绑定
        if (elements.exportOpenedLinksBtn) {
            elements.exportOpenedLinksBtn.addEventListener('click', exportOpenedLinks);
        }
        if (elements.clearOpenedLinksBtn) {
            elements.clearOpenedLinksBtn.addEventListener('click', clearOpenedLinks);
        }
        if (elements.refreshOpenedLinksBtn) {
            elements.refreshOpenedLinksBtn.addEventListener('click', refreshOpenedLinks);
        }
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
                'batchLinks',
                'selectedFilePath',
                'selectedFileName'
            ]);

            // 加载监控设置
            if (result.pddMonitorSettings) {
                popupState.settings = { ...popupState.settings, ...result.pddMonitorSettings };
            }

            // 加载API配置
            if (result.pddAPIConfig) {
                popupState.settings = { ...popupState.settings, ...result.pddAPIConfig };
            }

            // 兼容旧数据：若 pddAPIConfig 内部含有 messageWaitDuration，则保留到根设置
            if (result.pddAPIConfig && typeof result.pddAPIConfig.messageWaitDuration !== 'undefined') {
                popupState.settings.messageWaitDuration = result.pddAPIConfig.messageWaitDuration;
            }

            // 加载拼多多配置
            if (result.pddChatConfig) {
                popupState.settings = { ...popupState.settings, ...result.pddChatConfig };
            }

            // 加载批量链接
            if (result.batchLinks) {
                elements.batchLinksInput.value = result.batchLinks.join('\n');
            }
            
            // 恢复文件路径
            if (result.selectedFilePath && elements.txtFilePathInput) {
                elements.txtFilePathInput.value = result.selectedFilePath;
                // 如果有文件名，创建文件对象
                if (result.selectedFileName) {
                    popupState.selectedTxtFile = new File([''], result.selectedFileName, {
                        type: 'text/plain',
                        lastModified: Date.now()
                    });
                }
            }
            
            // 加载错误链接
            if (result.errorLinks) {
                errorLinks = result.errorLinks;
            }

            // 更新UI显示
            updateUISettings();
            
            // 更新链接计数
            updateLinkCount().catch(error => {
                console.error('更新链接计数失败:', error);
            });
            
            // 更新错误链接显示
            updateErrorLinksDisplay();
            
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
        if (elements.messageWaitDurationInput) elements.messageWaitDurationInput.value = popupState.settings.messageWaitDuration ?? 10;

        // 消息过滤
        elements.messageFilterEnabledCheckbox.checked = popupState.settings.messageFilterEnabled;
        elements.includeKeywordsInput.value = popupState.settings.includeKeywords;
        elements.excludeKeywordsInput.value = popupState.settings.excludeKeywords;
        elements.excludedMessagesInput.value = popupState.settings.excludedMessages;
        
        // 更新重复链接提醒状态
        updateDuplicateReminderStatus();

        // 拼多多配置
        elements.pdduidInput.value = popupState.settings.pdduid;
        elements.mallIdInput.value = popupState.settings.mallId;
        elements.goodsIdInput.value = popupState.settings.goodsId;
        elements.autoGetCookieCheckbox.checked = popupState.settings.autoGetCookie;
        elements.pddChatEnabledCheckbox.checked = popupState.settings.pddChatEnabled;
        elements.autoSendEnabledCheckbox.checked = popupState.settings.autoSend;
        if (elements.aiReplyIntervalInput) elements.aiReplyIntervalInput.value = popupState.settings.aiReplyInterval;
        elements.autoPasteEnabledCheckbox.checked = popupState.settings.autoPaste;


    }

    // 保存设置
    async function saveSettings() {
        try {
            // 先读取现有的 pddChatConfig 以避免无关保存时覆盖其中的字段（如 aiReplyInterval）
            const existing = await chrome.storage.local.get('pddChatConfig');
            const existingPddChatConfig = existing.pddChatConfig || {};

            // 计算新的 aiReplyInterval：只有当提供了有效数值时才覆盖，否则保留存量
            const inputInterval = Number(popupState.settings.aiReplyInterval);
            const hasValidInterval = Number.isFinite(inputInterval) && inputInterval >= 1 && inputInterval <= 3600;
            const mergedAiReplyInterval = hasValidInterval
                ? inputInterval
                : (typeof existingPddChatConfig.aiReplyInterval !== 'undefined' ? existingPddChatConfig.aiReplyInterval : 0);

            // 构建合并后的 pddChatConfig，优先保持已有值，仅更新来自 UI 的字段
            const mergedPddChatConfig = {
                ...existingPddChatConfig,
                pdduid: popupState.settings.pdduid,
                mallId: popupState.settings.mallId,
                goodsId: popupState.settings.goodsId,
                enabled: popupState.settings.pddChatEnabled,
                autoSend: popupState.settings.autoSend,
                autoPaste: popupState.settings.autoPaste,
                autoGetCookie: popupState.settings.autoGetCookie,
                aiReplyInterval: mergedAiReplyInterval
            };

            // 构建完整的配置对象
            const configToSave = {
                pddMonitorSettings: {
                    ...popupState.settings,
                    messageWaitDuration: popupState.settings.messageWaitDuration
                },
                pddAPIConfig: {
                    enabled: popupState.settings.apiConfigEnabled,
                    endpoint: popupState.settings.apiEndpoint,
                    timeout: popupState.settings.apiTimeout,
                    maxRetries: popupState.settings.apiMaxRetries,
                    retryDelay: popupState.settings.apiRetryDelay,
                    messageWaitDuration: popupState.settings.messageWaitDuration,
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
                pddChatConfig: mergedPddChatConfig
            };

            // 立即保存到存储
            await chrome.storage.local.set(configToSave);

            console.log('✅ 设置保存成功:', configToSave);
            
            // 不在这里显示消息，让调用方决定是否显示
            return { success: true, config: configToSave };
        } catch (error) {
            console.error('❌ 保存设置失败:', error);
            throw error; // 抛出错误让调用方处理
        }
    }

    // 检查当前状态
    async function checkCurrentStatus() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || !tabs[0]) {
                console.log('没有找到活动标签页');
                return;
            }

            const tab = tabs[0];
            
            // 检查是否在拼多多页面
            const isPddPage = tab.url && (
                tab.url.includes('pinduoduo.com') || 
                tab.url.includes('yangkeduo.com')
            );

            if (!isPddPage) {
                console.log('当前页面不是拼多多页面，跳过状态检查');
                // 重置状态显示
                popupState.isMonitoring = false;
                popupState.chatMonitoring = false;
                updateMonitorStatusDisplay();
                updateChatStatusDisplay();
                return;
            }

            // 检查content script是否已注入
            try {
                // 先尝试发送一个简单的ping消息来检查连接
                await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
            } catch (pingError) {
                console.log('Content script未注入，尝试注入...');
                try {
                    // 尝试注入content script
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['content.js']
                    });
                    // 等待一小段时间让content script初始化
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (injectError) {
                    console.error('注入content script失败:', injectError);
                    return;
                }
            }

            // 检查监控状态
            try {
                const monitorStatus = await chrome.tabs.sendMessage(tab.id, { action: 'checkMonitoringStatus' });
                if (monitorStatus) {
                    popupState.isMonitoring = monitorStatus.isMonitoring;
                    updateMonitorStatusDisplay();
                }
            } catch (monitorError) {
                console.log('获取监控状态失败:', monitorError.message);
                popupState.isMonitoring = false;
                updateMonitorStatusDisplay();
            }

            // 检查聊天监控状态
            try {
                const chatStatus = await chrome.tabs.sendMessage(tab.id, { action: 'getChatMonitoringStatus' });
                if (chatStatus) {
                    popupState.chatMonitoring = chatStatus.isActive;
                    popupState.messageCount = chatStatus.messageCount;
                    updateChatStatusDisplay();
                }
            } catch (chatError) {
                console.log('获取聊天监控状态失败:', chatError.message);
                popupState.chatMonitoring = false;
                updateChatStatusDisplay();
            }

        } catch (error) {
            console.error('检查状态失败:', error);
            // 重置状态显示
            popupState.isMonitoring = false;
            popupState.chatMonitoring = false;
            updateMonitorStatusDisplay();
            updateChatStatusDisplay();
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
    
    // 新增：更新消息队列状态显示
    function updateQueueStatusDisplay(queueInfo) {
        if (elements.queueStatus) {
            const statusText = queueInfo.isProcessing ? 
                `处理中 - ${queueInfo.queueLength}条消息待发送` : 
                `${queueInfo.queueLength}条消息待发送`;
            
            elements.queueStatus.textContent = statusText;
            elements.queueStatus.style.color = queueInfo.isProcessing ? '#2196F3' : '#FF9800';
        }
    }
    
    // 新增：绑定话术选择器事件
    function bindQuickMessageButtons() {
        // 绑定预设话术下拉框使用按钮
        const useQuickMessageBtn = document.getElementById('useQuickMessageBtn');
        if (useQuickMessageBtn) {
            useQuickMessageBtn.addEventListener('click', function() {
                const quickMessageSelect = document.getElementById('quickMessageSelect');
                const selectedMessage = quickMessageSelect.value;
                
                if (selectedMessage && elements.batchMessageInput) {
                    elements.batchMessageInput.value = selectedMessage;
                    showMessage(`已选择话术: ${selectedMessage}`, 'success');
                    // 重置下拉框选择
                    quickMessageSelect.value = '';
                } else {
                    showMessage('请先选择预设话术', 'warning');
                }
            });
        }
        
        // 绑定自定义话术添加按钮
        const addCustomMessageBtn = document.getElementById('addCustomMessageBtn');
        if (addCustomMessageBtn) {
            addCustomMessageBtn.addEventListener('click', addCustomMessage);
        }
        
        // 绑定自定义话术输入框回车事件
        const customMessageInput = document.getElementById('customMessageInput');
        if (customMessageInput) {
            customMessageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    addCustomMessage();
                }
            });
        }
        
        // 加载保存的自定义话术
        loadCustomMessages();
    }

    // 新增：添加自定义话术
    function addCustomMessage() {
        const customMessageInput = document.getElementById('customMessageInput');
        const message = customMessageInput.value.trim();
        
        if (!message) {
            showMessage('请输入话术内容', 'warning');
            return;
        }
        
        if (message.length > 100) {
            showMessage('话术内容不能超过100个字符', 'warning');
            return;
        }
        
        // 检查是否已存在相同的话术
        const existingMessages = getCustomMessages();
        if (existingMessages.includes(message)) {
            showMessage('该话术已存在', 'warning');
            return;
        }
        
        // 添加到自定义话术列表
        existingMessages.push(message);
        saveCustomMessages(existingMessages);
        
        // 清空输入框
        customMessageInput.value = '';
        
        // 重新渲染自定义话术按钮
        renderCustomMessageButtons();
        
        showMessage(`自定义话术已添加: ${message}`, 'success');
    }
    
    // 新增：删除自定义话术
    function deleteCustomMessage(message) {
        const customMessages = getCustomMessages();
        const index = customMessages.indexOf(message);
        
        if (index > -1) {
            customMessages.splice(index, 1);
            saveCustomMessages(customMessages);
            renderCustomMessageButtons();
            showMessage(`自定义话术已删除: ${message}`, 'success');
        }
    }
    
    // 新增：获取自定义话术列表
    function getCustomMessages() {
        try {
            const stored = localStorage.getItem('customMessages');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('获取自定义话术失败:', error);
            return [];
        }
    }
    
    // 新增：保存自定义话术列表
    function saveCustomMessages(messages) {
        try {
            localStorage.setItem('customMessages', JSON.stringify(messages));
        } catch (error) {
            console.error('保存自定义话术失败:', error);
        }
    }
    
    // 新增：加载自定义话术
    function loadCustomMessages() {
        renderCustomMessageButtons();
    }
    
    // 新增：渲染自定义话术按钮
    function renderCustomMessageButtons() {
        const customMessageButtonsContainer = document.getElementById('customMessageButtons');
        if (!customMessageButtonsContainer) return;
        
        const customMessages = getCustomMessages();
        
        if (customMessages.length === 0) {
            customMessageButtonsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; font-style: italic;">暂无自定义话术，请添加您常用的话术</p>';
            return;
        }
        
        const buttonsHTML = customMessages.map(message => `
            <button type="button" class="btn custom-message-btn" data-message="${message}">
                ${message}
                <button type="button" class="delete-btn" onclick="deleteCustomMessage('${message}')" title="删除此话术">×</button>
            </button>
        `).join('');
        
        customMessageButtonsContainer.innerHTML = buttonsHTML;
        
        // 绑定自定义话术按钮点击事件
        const customBtns = customMessageButtonsContainer.querySelectorAll('.custom-message-btn');
        customBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const message = this.getAttribute('data-message');
                if (elements.batchMessageInput && message) {
                    elements.batchMessageInput.value = message;
                    showMessage(`已选择自定义话术: ${message}`, 'success');
                }
            });
        });
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
            console.log('开始启动聊天监控...');
            
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) {
                showMessage('未找到活动标签页', 'error');
                return;
            }

            console.log('当前标签页:', tabs.url);
            
            // 检查是否是拼多多页面
            if (!tabs.url.includes('pinduoduo.com') && !tabs.url.includes('yangkeduo.com')) {
                showMessage('当前页面不是拼多多页面', 'error');
                return;
            }

            // 首先测试连接
            console.log('测试与 content script 的连接...');
            try {
                const pingResponse = await chrome.tabs.sendMessage(tabs.id, { action: 'ping' });
                console.log('Ping 响应:', pingResponse);
                if (!pingResponse || pingResponse.status !== 'ready') {
                    throw new Error('Content script 未就绪');
                }
            } catch (pingError) {
                console.error('Ping 失败:', pingError);
                
                // 尝试重新注入 content script
                console.log('尝试重新注入 content script...');
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs.id },
                        files: ['content.js']
                    });
                    console.log('Content script 重新注入成功');
                    
                    // 等待一下让 content script 初始化
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 再次测试连接
                    const retryPingResponse = await chrome.tabs.sendMessage(tabs.id, { action: 'ping' });
                    if (!retryPingResponse || retryPingResponse.status !== 'ready') {
                        throw new Error('重新注入后 content script 仍未就绪');
                    }
                    console.log('重新注入后连接成功');
                } catch (injectError) {
                    console.error('重新注入失败:', injectError);
                    showMessage(`Content script 连接失败: ${pingError.message}`, 'error');
                    return;
                }
            }

            const options = {
                selector: popupState.settings.chatSelector,
                checkInterval: popupState.settings.checkInterval,
                maxHistory: popupState.settings.maxHistory,
            };

            console.log('发送启动监控消息...');
            const result = await chrome.tabs.sendMessage(tabs.id, { 
                action: 'startChatMonitoring', 
                options: options 
            });

            console.log('Content script响应:', result);

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

    // 诊断连接问题
    async function debugConnection() {
        try {
            console.log('开始诊断连接问题...');
            showMessage('开始诊断连接问题...', 'info');
            
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) {
                showMessage('未找到活动标签页', 'error');
                return;
            }

            console.log('当前标签页:', tabs.url);
            
            // 检查是否是拼多多页面
            if (!tabs.url.includes('pinduoduo.com') && !tabs.url.includes('yangkeduo.com')) {
                showMessage('当前页面不是拼多多页面，请先打开拼多多页面', 'warning');
                return;
            }

            let diagnosticResults = [];
            
            // 测试 1: 检查扩展连接
            try {
                const pingResponse = await chrome.tabs.sendMessage(tabs.id, { action: 'ping' });
                if (pingResponse && pingResponse.status === 'ready') {
                    diagnosticResults.push('✅ Content Script 连接正常');
                } else {
                    diagnosticResults.push('❌ Content Script 连接异常');
                }
            } catch (error) {
                diagnosticResults.push(`❌ Content Script 连接失败: ${error.message}`);
                
                // 尝试重新注入
                try {
                    await chrome.scripting.executeScript({
                        target: { tabId: tabs.id },
                        files: ['content.js']
                    });
                    diagnosticResults.push('✅ Content Script 重新注入成功');
                    
                    // 等待初始化
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // 再次测试
                    const retryResponse = await chrome.tabs.sendMessage(tabs.id, { action: 'ping' });
                    if (retryResponse && retryResponse.status === 'ready') {
                        diagnosticResults.push('✅ 重新注入后连接正常');
                    } else {
                        diagnosticResults.push('❌ 重新注入后仍无法连接');
                    }
                } catch (injectError) {
                    diagnosticResults.push(`❌ 重新注入失败: ${injectError.message}`);
                }
            }

            // 测试 2: 检查页面状态
            try {
                const pageInfoResponse = await chrome.tabs.sendMessage(tabs.id, { action: 'getPageInfo' });
                if (pageInfoResponse) {
                    diagnosticResults.push(`✅ 页面信息获取成功: ${pageInfoResponse.pageTitle}`);
                } else {
                    diagnosticResults.push('❌ 无法获取页面信息');
                }
            } catch (error) {
                diagnosticResults.push(`❌ 页面信息获取失败: ${error.message}`);
            }

            // 显示诊断结果
            const resultMessage = diagnosticResults.join('\n');
            console.log('诊断结果:', resultMessage);
            
            // 创建诊断结果弹窗
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
                background: rgba(0,0,0,0.5); z-index: 10000; display: flex; 
                align-items: center; justify-content: center;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: white; padding: 20px; border-radius: 8px; 
                max-width: 500px; max-height: 400px; overflow-y: auto;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            `;
            
            content.innerHTML = `
                <h3>🔧 连接诊断结果</h3>
                <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 10px; border-radius: 4px;">${resultMessage}</pre>
                <div style="margin-top: 15px; text-align: right;">
                    <button onclick="this.closest('.modal').remove()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
                </div>
            `;
            
            modal.className = 'modal';
            modal.appendChild(content);
            document.body.appendChild(modal);
            
            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });
            
            showMessage('诊断完成，请查看详细结果', 'success');
            
        } catch (error) {
            console.error('诊断过程出错:', error);
            showMessage(`诊断失败: ${error.message}`, 'error');
        }
    }

    // 更新聊天设置
    function updateChatSettings() {
        popupState.settings.chatSelector = elements.chatSelectorInput.value;
        popupState.settings.checkInterval = parseInt(elements.checkIntervalInput.value);
        popupState.settings.maxHistory = parseInt(elements.maxHistoryInput.value);

        
        saveSettings();
    }

    // 更新身份过滤设置
    async function updateRoleFilterSettings() {
        popupState.settings.roleFilterEnabled = elements.roleFilterEnabledCheckbox.checked;
        popupState.settings.sendServiceMessages = elements.sendServiceMessagesCheckbox.checked;
        popupState.settings.sendCustomerMessages = elements.sendCustomerMessagesCheckbox.checked;
        popupState.settings.sendUnknownRoleMessages = elements.sendUnknownRoleMessagesCheckbox.checked;
        
        console.log('🔄 身份过滤设置已更新:', {
            roleFilterEnabled: popupState.settings.roleFilterEnabled,
            sendServiceMessages: popupState.settings.sendServiceMessages,
            sendCustomerMessages: popupState.settings.sendCustomerMessages,
            sendUnknownRoleMessages: popupState.settings.sendUnknownRoleMessages
        });
        
        await saveSettings();
    }

    // 更新API设置
    async function updateAPISettings() {
        popupState.settings.apiConfigEnabled = elements.apiConfigEnabledCheckbox.checked;
        popupState.settings.apiEndpoint = elements.apiEndpointInput.value;
        popupState.settings.apiTimeout = parseInt(elements.apiTimeoutInput.value);
        popupState.settings.apiMaxRetries = parseInt(elements.apiMaxRetriesInput.value);
        popupState.settings.apiRetryDelay = parseInt(elements.apiRetryDelayInput.value);
        popupState.settings.messageWaitDuration = parseInt(elements.messageWaitDurationInput?.value || popupState.settings.messageWaitDuration || 10);
        
        console.log('🔄 API设置已更新:', {
            apiConfigEnabled: popupState.settings.apiConfigEnabled,
            apiEndpoint: popupState.settings.apiEndpoint,
            apiTimeout: popupState.settings.apiTimeout,
            apiMaxRetries: popupState.settings.apiMaxRetries,
            apiRetryDelay: popupState.settings.apiRetryDelay,
            messageWaitDuration: popupState.settings.messageWaitDuration
        });
        
        await saveSettings();
    }

    // 保存API配置
    async function saveAPIConfig() {
        try {
            await updateAPISettings();

            // 立即同步到所有标签页的 content script，触发 updateSettings
            try {
                const tabs = await chrome.tabs.query({});
                if (Array.isArray(tabs)) {
                    const promises = tabs
                        .filter(t => t && t.id)
                        .map(t => chrome.tabs.sendMessage(t.id, {
                            action: 'updateSettings',
                            settings: popupState.settings
                        }).catch(err => {
                            // 忽略未注入content script页面的错误
                            console.debug(`跳过未注入content script的标签页(${t.id})`, err?.message || err);
                        }));
                    await Promise.all(promises);
                    console.log('✅ 已向所有标签页同步API相关设置');
                }
            } catch (e) {
                console.warn('⚠️ 同步API设置到所有content script失败:', e);
            }

            showMessage('API配置已保存', 'success');
        } catch (error) {
            console.error('保存API配置失败:', error);
            showMessage('保存API配置失败: ' + error.message, 'error');
        }
    }

    // 重置API配置
    async function resetAPIConfig() {
        try {
            // 重置为默认值
            popupState.settings.apiEndpoint = 'http://localhost:8090/api/chat/send';
            popupState.settings.apiTimeout = 15000;
            popupState.settings.apiMaxRetries = 3;
            popupState.settings.apiRetryDelay = 1000;
            
            updateUISettings();
            await saveSettings();
            showMessage('API配置已重置', 'success');
        } catch (error) {
            console.error('重置API配置失败:', error);
            showMessage('重置API配置失败: ' + error.message, 'error');
        }
    }

    // 更新消息过滤设置
    async function updateMessageFilterSettings() {
        popupState.settings.messageFilterEnabled = elements.messageFilterEnabledCheckbox.checked;
        popupState.settings.includeKeywords = elements.includeKeywordsInput.value;
        popupState.settings.excludeKeywords = elements.excludeKeywordsInput.value;
        popupState.settings.excludedMessages = elements.excludedMessagesInput.value;
        
        console.log('🔄 消息过滤设置已更新:', {
            messageFilterEnabled: popupState.settings.messageFilterEnabled,
            includeKeywords: popupState.settings.includeKeywords,
            excludeKeywords: popupState.settings.excludeKeywords,
            excludedMessages: popupState.settings.excludedMessages
        });
        
        await saveSettings();
    }

    // 更新拼多多设置
    async function updatePddSettings() {
        try {
            // 立即更新popup状态
            popupState.settings.pdduid = elements.pdduidInput.value;
            popupState.settings.mallId = elements.mallIdInput.value;
            popupState.settings.goodsId = elements.goodsIdInput.value;
            popupState.settings.autoGetCookie = elements.autoGetCookieCheckbox.checked;
            popupState.settings.pddChatEnabled = elements.pddChatEnabledCheckbox.checked;
            popupState.settings.autoSend = elements.autoSendEnabledCheckbox.checked;
            popupState.settings.aiReplyInterval = elements.aiReplyIntervalInput ? (parseFloat(elements.aiReplyIntervalInput.value) || 0) : (popupState.settings.aiReplyInterval || 0);
            
            popupState.settings.autoPaste = elements.autoPasteEnabledCheckbox.checked;
            
            console.log('🔄 拼多多配置已更新:', popupState.settings);
            
            // 立即保存到本地存储
            await saveSettings();
            
            // 立即同步到content script
            try {
                const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs && tabs[0]) {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updatePddChatConfig',
                        config: {
                            pdduid: popupState.settings.pdduid,
                            mallId: popupState.settings.mallId,
                            goodsId: popupState.settings.goodsId,
                            autoGetCookie: popupState.settings.autoGetCookie,
                            enabled: popupState.settings.pddChatEnabled,
                            autoSend: popupState.settings.autoSend,
                            aiReplyInterval: popupState.settings.aiReplyInterval,
                            autoPaste: popupState.settings.autoPaste
                        }
                    });
                    console.log('✅ 拼多多配置已同步到content script，AI回复间隔时间:', popupState.settings.aiReplyInterval);
                    
                    // 强制刷新content script中的配置状态
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'refreshPddConfig',
                        force: true
                    });
                    console.log('🔄 已强制刷新拼多多配置状态');
                }
            } catch (error) {
                console.warn('⚠️ 同步到content script失败，但配置已保存:', error);
            }
        } catch (error) {
            console.error('❌ 更新拼多多设置失败:', error);
            throw error;
        }
    }

    // 保存拼多多配置
    async function savePddConfig() {
        try {
            console.log('💾 开始保存拼多多配置...');
            if (elements.aiReplyIntervalInput) console.log('📝 当前AI回复间隔时间输入值:', elements.aiReplyIntervalInput.value);
            
            // 第一步：更新并保存配置
            await updatePddSettings();
            
            // 第二步：立即更新content script中的AI回复间隔时间
            try {
                const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs && tabs[0] && typeof popupState.settings.aiReplyInterval === 'number') {
                    await chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'updateAiReplyInterval',
                        aiReplyInterval: popupState.settings.aiReplyInterval
                    });
                    console.log('✅ 已发送AI回复间隔时间更新消息到content script:', popupState.settings.aiReplyInterval);
                }
            } catch (error) {
                console.warn('⚠️ 发送AI回复间隔时间更新消息失败:', error);
            }
            
            // 显示成功消息
            showMessage('拼多多配置已保存并立即生效！', 'success');
            
        } catch (error) {
            console.error('❌ 保存拼多多配置失败:', error);
            showMessage('保存配置失败: ' + error.message, 'error');
        }
    }

    // 刷新页面信息
    async function refreshPageInfo() {
        try {
            const [tabs] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs) return;

            // 若仍存在AI回复间隔输入框，则在刷新前同步；否则跳过
            if (elements.aiReplyIntervalInput) {
                const newValue = parseFloat(elements.aiReplyIntervalInput.value);
                if (!isNaN(newValue) && newValue >= 1 && newValue <= 3600) {
                    popupState.settings.aiReplyInterval = newValue;
                    console.log(`🔄 刷新页面信息时同步AI回复间隔时间: ${newValue} 秒`);
                    saveSettings();
                    try {
                        await chrome.tabs.sendMessage(tabs[0].id, {
                            action: 'updateAiReplyInterval',
                            aiReplyInterval: newValue
                        });
                        console.log('✅ 已通知content script更新AI回复间隔时间');
                    } catch (messageError) {
                        console.warn('⚠️ 通知content script失败，但配置已保存:', messageError);
                    }
                }
            }

            // 执行页面信息刷新
            try {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'refreshPageInfo'
                });
                showMessage('页面信息已刷新，AI回复间隔时间已同步', 'success');
            } catch (messageError) {
                console.warn('⚠️ 发送刷新消息失败，但配置已更新:', messageError);
                showMessage('页面信息已刷新，AI回复间隔时间已同步', 'success');
            }
            
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

    // 添加并打开链接
    async function batchOpenLinks() {
        try {
            // 1. 首先获取输入框中的链接
            const inputLinks = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            
            if (inputLinks.length === 0) {
                showMessage('请在输入框中输入要添加的链接', 'warning');
                return;
            }

            // 2. 如果启用了自动保存，则保存输入框中的链接到选中的txt文件
            if (elements.autoSaveToTxtCheckbox && elements.autoSaveToTxtCheckbox.checked) {
                if (popupState.selectedTxtFile) {
                    await saveInputLinksToTxtFile(inputLinks);
                } else {
                    showMessage('请先选择一个TXT文件，然后再保存链接', 'warning');
                }
            }
            
            // 3. 获取所有链接：包括输入框中的链接和存储中的导入链接
            let allLinks = [];
            allLinks.push(...inputLinks);
            
            // 4. 从存储中获取导入的链接（不展示到输入框，只用于打开）
            try {
                const result = await chrome.storage.local.get('batchLinks');
                if (result.batchLinks && Array.isArray(result.batchLinks)) {
                    const storedLinks = result.batchLinks.filter(link => link && link.trim());
                    allLinks.push(...storedLinks);
                }
            } catch (storageError) {
                console.warn('获取存储中的链接失败:', storageError);
            }
            
            // 5. 去重并过滤空链接
            const uniqueLinks = [...new Set(allLinks)].filter(link => link && link.trim());
            
            // 检查是否有重复链接（与已打开链接对比）
            const duplicateLinks = [];
            for (const link of uniqueLinks) {
                if (isLinkAlreadyOpened(link)) {
                    const existingItem = openedLinks.find(item => item.link === link);
                    if (existingItem) {
                        duplicateLinks.push({ link, existingInfo: existingItem });
                    }
                }
            }
            
            // 如果有重复链接，显示弹窗
            if (duplicateLinks.length > 0) {
                for (const { link, existingInfo } of duplicateLinks) {
                    showDuplicateLinkModal(link, existingInfo);
                }
                showMessage(`⚠️ 检测到 ${duplicateLinks.length} 个重复链接！`, 'error');
            }
            
            console.log('添加并打开链接 - 合并后的所有链接:', {
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
                        showMessage('添加并打开链接失败: ' + errorMsg, 'error');
                        console.error('添加并打开链接失败:', errorMsg);
                    }
                } catch (error) {
                    console.error('发送消息到background.js失败:', error);
                    showMessage('添加并打开链接失败: 无法连接到后台服务', 'error');
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
            console.error('添加并打开链接失败:', error);
            showMessage('添加并打开链接失败: ' + error.message, 'error');
            
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
            // 注意：invalidLinksCount 元素在HTML中不存在，使用 txtInvalidLinksCount 替代
        const invalidCountElement = document.getElementById('txtInvalidLinksCount');
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
            
            if (uniqueLinks.length === 0) {
                showMessage('没有可保存的链接', 'warning');
                return;
            }
            
            // 显示保存选项对话框
            showSaveOptionsDialog(uniqueLinks);
            
        } catch (error) {
            console.error('保存链接列表失败:', error);
            showMessage('保存链接列表失败: ' + error.message, 'error');
        }
    }

    // 显示保存选项对话框
    function showSaveOptionsDialog(links) {
        // 更新当前要保存的链接
        currentLinks = links;
        
        // 更新预览内容
        const previewCount = document.getElementById('previewLinksCount');
        const linksPreview = document.getElementById('linksPreview');
        const saveOptionsDialog = document.getElementById('saveOptionsDialog');
        
        if (previewCount) previewCount.textContent = links.length;
        
        if (linksPreview) {
            linksPreview.innerHTML = '';
            // 显示前5个链接
            links.slice(0, 5).forEach(link => {
                const linkItem = document.createElement('div');
                linkItem.className = 'link-item';
                linkItem.textContent = link;
                linksPreview.appendChild(linkItem);
            });
            
            // 如果链接超过5个，显示省略信息
            if (links.length > 5) {
                const moreItem = document.createElement('div');
                moreItem.className = 'link-item';
                moreItem.textContent = `... 还有 ${links.length - 5} 个链接`;
                linksPreview.appendChild(moreItem);
            }
        }
        
        // 显示对话框
        if (saveOptionsDialog) {
            saveOptionsDialog.style.display = 'flex';
        }
    }
    
    // 隐藏保存选项对话框
    function hideSaveOptionsDialog() {
        const saveOptionsDialog = document.getElementById('saveOptionsDialog');
        if (saveOptionsDialog) {
            saveOptionsDialog.style.display = 'none';
        }
    }
    
    // 保存到新文件
    async function saveToNewFile(links) {
        try {
            // 创建下载链接
            const content = links.join('\n');
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            // 创建下载元素
            const a = document.createElement('a');
            a.href = url;
            a.download = `链接列表_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 清理URL
            URL.revokeObjectURL(url);
            
            // 同时保存到本地存储
            await chrome.storage.local.set({ batchLinks: links });
            
            showMessage(`已保存 ${links.length} 个链接到新文件`, 'success');
            hideSaveOptionsDialog();
        } catch (error) {
            console.error('保存到新文件失败:', error);
            showMessage('保存到新文件失败: ' + error.message, 'error');
        }
    }
    
    // 选择现有文件保存
    async function selectExistingFile(links) {
        try {
            // 创建文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.txt';
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                try {
                    // 读取现有文件内容
                    const existingContent = await readFileAsText(file);
                    const existingLinks = existingContent.split('\n').filter(link => link.trim());
                    
                    // 合并链接并去重
                    const allLinks = [...new Set([...existingLinks, ...links])].filter(link => link.trim());
                    
                    // 保存合并后的内容
                    const mergedContent = allLinks.join('\n');
                    const blob = new Blob([mergedContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    
                    // 创建下载元素
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    // 清理URL
                    URL.revokeObjectURL(url);
                    
                    // 同时保存到本地存储
                    await chrome.storage.local.set({ batchLinks: allLinks });
                    
                    showMessage(`已合并保存 ${allLinks.length} 个链接到文件: ${file.name}`, 'success');
                    
                } catch (error) {
                    console.error('合并保存失败:', error);
                    showMessage('合并保存失败: ' + error.message, 'error');
                }
                
                // 清理文件输入元素
                document.body.removeChild(fileInput);
            });
            
            // 添加到页面并触发选择
            document.body.appendChild(fileInput);
            fileInput.click();
            
            hideSaveOptionsDialog();
            
        } catch (error) {
            console.error('选择现有文件失败:', error);
            showMessage('选择现有文件失败: ' + error.message, 'error');
        }
    }
    
    // 读取文件为文本
    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'utf-8');
        });
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
                
                // 更新错误链接显示
                updateErrorLinksDisplay();
            } else {
                showMessage('没有保存的链接列表', 'info');
                
                // 更新链接计数显示
                await updateLinkCount();
                
                // 更新错误链接显示
                updateErrorLinksDisplay();
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
            
            // 更新错误链接显示
            updateErrorLinksDisplay();
            
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
                    'txtInvalidLinksCount',
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

    // 保存输入框中的链接到选中的txt文件
    async function saveInputLinksToTxtFile(links) {
        try {
            if (!links || links.length === 0) {
                console.log('没有链接需要保存');
                return;
            }

            // 检查是否有选中的TXT文件
            if (!popupState.selectedTxtFile) {
                showMessage('请先选择一个TXT文件，然后再保存链接', 'warning');
                return;
            }

            // 获取当前txt文件内容
            const result = await chrome.storage.local.get('txtFileContent');
            let currentContent = result.txtFileContent || '';
            let lines = currentContent ? currentContent.split('\n') : [];
            
            // 添加新链接（避免重复）
            let addedCount = 0;
            for (const link of links) {
                if (link.trim() && !lines.some(line => line.trim() === link.trim())) {
                    lines.push(link.trim());
                    addedCount++;
                }
            }
            
            // 保存更新后的内容
            const newContent = lines.join('\n');
            await chrome.storage.local.set({ txtFileContent: newContent });
            
            // 更新选中的文件引用，包含新的内容
            const updatedFile = new File([newContent], popupState.selectedTxtFile.name, {
                type: 'text/plain',
                lastModified: Date.now()
            });
            popupState.selectedTxtFile = updatedFile;
            
            console.log(`已保存 ${addedCount} 个新链接到选中的TXT文件: ${popupState.selectedTxtFile.name}`);
            showMessage(`已保存 ${addedCount} 个新链接到选中的TXT文件: ${popupState.selectedTxtFile.name}`, 'success');
            
            // 更新TXT文件状态显示
            await updateTxtFileStatus();
            
            // 如果启用了自动保存，同时更新存储中的批量链接
            if (elements.autoSaveToTxtCheckbox && elements.autoSaveToTxtCheckbox.checked) {
                try {
                    const currentBatchLinks = await chrome.storage.local.get('batchLinks');
                    let batchLinks = currentBatchLinks.batchLinks || [];
                    
                    // 合并新链接，避免重复
                    for (const link of links) {
                        if (link.trim() && !batchLinks.includes(link.trim())) {
                            batchLinks.push(link.trim());
                        }
                    }
                    
                    await chrome.storage.local.set({ batchLinks: batchLinks });
                    console.log('批量链接列表已同步更新');
                } catch (storageError) {
                    console.warn('同步批量链接列表失败:', storageError);
                }
            }
            
        } catch (error) {
            console.error('保存链接到txt文件失败:', error);
            showMessage('保存链接到txt文件失败: ' + error.message, 'error');
        }
    }

    // 新增：检查链接是否在TXT文档中存在
    async function checkLinkInTxtFile(link) {
        try {
            const result = await chrome.storage.local.get('txtFileContent');
            if (!result.txtFileContent) {
                return { exists: false, content: null };
            }
            
            const lines = result.txtFileContent.split('\n');
            const exists = lines.some(line => line.trim() === link.trim());
            
            return { exists, content: result.txtFileContent, lines };
        } catch (error) {
            console.error('检查链接失败:', error);
            return { exists: false, content: null };
        }
    }
    
    // 新增：将链接添加到TXT文档中
    async function addLinkToTxtFile(link) {
        try {
            const result = await chrome.storage.local.get('txtFileContent');
            let currentContent = result.txtFileContent || '';
            
            // 如果链接不存在，则添加
            if (!currentContent.includes(link)) {
                const newContent = currentContent + (currentContent ? '\n' : '') + link;
                await chrome.storage.local.set({ txtFileContent: newContent });
                console.log('链接已添加到TXT文档:', link);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('添加链接到TXT文档失败:', error);
            return false;
        }
    }
    
    // 新增：手动添加多个链接到TXT文件
    async function addManualLink() {
        try {
            const linkInput = elements.manualLinkInput;
            if (!linkInput) {
                showMessage('链接输入框未找到', 'error');
                return;
            }
            
            const inputText = linkInput.value.trim();
            if (!inputText) {
                showMessage('请输入链接', 'warning');
                return;
            }
            
            // 按换行符分割链接
            const links = inputText.split('\n').filter(link => link.trim());
            
            if (links.length === 0) {
                showMessage('请输入有效的链接', 'warning');
                return;
            }
            
            // 验证所有链接格式（拼多多链接验证）
            const invalidLinks = links.filter(link => {
                // 移除可能的@前缀
                const cleanLink = link.startsWith('@') ? link.substring(1) : link;
                return !cleanLink.includes('pinduoduo.com') && !cleanLink.includes('yangkeduo.com');
            });
            
            if (invalidLinks.length > 0) {
                showMessage(`以下链接格式无效，请检查：\n${invalidLinks.join('\n')}`, 'error');
                return;
            }
            
            // 检查重复链接
            const duplicateLinks = [];
            const validLinks = [];
            const alreadyOpenedLinks = [];
            
            for (const link of links) {
                // 清理链接（移除@前缀）
                const cleanLink = link.startsWith('@') ? link.substring(1) : link;
                
                // 检查链接是否已存在（在TXT文件中）
                const { exists } = await checkLinkInTxtFile(cleanLink);
                if (exists) {
                    duplicateLinks.push({ link: cleanLink, reason: 'TXT文件中已存在' });
                    continue;
                }
                
                // 检查链接是否已经打开过
                if (isLinkAlreadyOpened(cleanLink)) {
                    const existingItem = openedLinks.find(item => item.link === cleanLink);
                    if (existingItem) {
                        alreadyOpenedLinks.push({ link: cleanLink, existingInfo: existingItem });
                        continue;
                    }
                }
                
                validLinks.push(cleanLink);
            }
            
            // 显示重复链接弹窗
            if (duplicateLinks.length > 0) {
                showMessage(`⚠️ 检测到 ${duplicateLinks.length} 个重复链接（TXT文件中已存在）！`, 'error');
            }
            
            if (alreadyOpenedLinks.length > 0) {
                for (const { link, existingInfo } of alreadyOpenedLinks) {
                    showDuplicateLinkModal(link, existingInfo);
                }
                showMessage(`⚠️ 检测到 ${alreadyOpenedLinks.length} 个重复链接（已打开过）！`, 'error');
            }
            
            // 如果没有有效链接，直接返回
            if (validLinks.length === 0) {
                showMessage('没有新的有效链接需要添加', 'warning');
                return;
            }
            
            // 保存有效链接到选中的TXT文件（如果启用了自动保存且有选中的TXT文件）
            let saveSuccess = false;
            if (elements.autoSaveToTxtCheckbox && elements.autoSaveToTxtCheckbox.checked) {
                if (popupState.selectedTxtFile) {
                    for (const link of validLinks) {
                        saveSuccess = await addLinkToSelectedTxtFile(link);
                        if (saveSuccess) {
                            showMessage(`链接已保存到选中的TXT文件: ${popupState.selectedTxtFile.name}`, 'success');
                        }
                    }
                    // 更新TXT文件状态显示
                    await updateTxtFileStatus();
                } else {
                    showMessage('请先选择一个TXT文件，然后再添加链接', 'warning');
                }
            }
            
            // 添加到批量链接输入框
            const currentLinks = elements.batchLinksInput.value.trim();
            const newLinks = currentLinks ? currentLinks + '\n' + validLinks.join('\n') : validLinks.join('\n');
            elements.batchLinksInput.value = newLinks;
            
            // 更新链接计数
            await updateLinkCount();
            
            // 清空输入框
            linkInput.value = '';
            
            // 显示处理结果
            let resultMessage = `✅ 成功处理 ${validLinks.length} 个链接`;
            if (duplicateLinks.length > 0) {
                resultMessage += `\n⚠️ 跳过 ${duplicateLinks.length} 个重复链接（TXT文件中已存在）`;
            }
            if (alreadyOpenedLinks.length > 0) {
                resultMessage += `\n⚠️ 跳过 ${alreadyOpenedLinks.length} 个重复链接（已打开过）`;
            }
            showMessage(resultMessage, 'success');
            
            // 如果启用了自动打开，则立即打开有效链接
            if (elements.autoOpenLinksCheckbox && elements.autoOpenLinksCheckbox.checked) {
                showMessage(`准备自动打开 ${validLinks.length} 个新添加的链接...`, 'info');
                
                setTimeout(async () => {
                    try {
                        const autoStart = elements.autoStartMonitoringCheckbox && elements.autoStartMonitoringCheckbox.checked;
                        
                        const response = await chrome.runtime.sendMessage({
                            action: 'handleBatchLinks',
                            links: validLinks,
                            options: {
                                autoStartMonitor: autoStart,
                                delay: 0, // 立即打开，无需延迟
                                silentMode: false
                            }
                        });
                        
                        if (response && response.success) {
                            showMessage(`新添加的 ${validLinks.length} 个链接已成功打开`, 'success');
                            // 记录链接已打开
                            for (const link of validLinks) {
                                addToOpenedLinks(link);
                            }
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
            
        } catch (error) {
            console.error('手动添加链接失败:', error);
            showMessage(`添加链接失败: ${error.message}`, 'error');
            console.error('错误详情:', error);
        }
    }
    
    // 新增：将链接添加到选择的TXT文件中
    async function addLinkToSelectedTxtFile(link) {
        try {
            if (!popupState.selectedTxtFile) {
                console.error('没有选择的TXT文件');
                return false;
            }
            
            // 获取当前文件内容
            const result = await chrome.storage.local.get('txtFileContent');
            let currentContent = result.txtFileContent || '';
            
            // 添加新链接到文件末尾
            const newContent = currentContent + (currentContent ? '\n' : '') + link;
            
            // 更新存储中的内容
            await chrome.storage.local.set({ txtFileContent: newContent });
            
            // 创建新的File对象，包含更新后的内容
            const updatedFile = new File([newContent], popupState.selectedTxtFile.name, {
                type: 'text/plain',
                lastModified: Date.now()
            });
            
            // 更新选择的文件引用
            popupState.selectedTxtFile = updatedFile;
            
            console.log('链接已添加到选择的TXT文件:', link);
            return true;
            
        } catch (error) {
            console.error('添加链接到选择的TXT文件失败:', error);
            return false;
        }
    }
    
    // 新增：标记异常链接（放在首行，标红显示）
    async function markAbnormalLink(link, reason = '异常链接') {
        try {
            const result = await chrome.storage.local.get('txtFileContent');
            let currentContent = result.txtFileContent || '';
            let lines = currentContent.split('\n');
            
            // 移除链接（如果已存在，包括普通链接和已标记的异常链接）
            lines = lines.filter(line => {
                const cleanLine = line.replace(/^\[异常\]\s*/, '').replace(/\s*\(.*\)$/, '').trim();
                return cleanLine !== link.trim();
            });
            
            // 在首行添加标记的异常链接（使用特殊标记格式，便于识别和标红）
            const timestamp = new Date().toLocaleString('zh-CN');
            const markedLink = `[异常-${timestamp}] ${link} (原因: ${reason})`;
            lines.unshift(markedLink);
            
            const newContent = lines.join('\n');
            await chrome.storage.local.set({ txtFileContent: newContent });
            
            console.log('异常链接已标记并放到文件头部:', markedLink);
            
            // 同时更新存储中的异常链接列表
            try {
                const abnormalResult = await chrome.storage.local.get('abnormalLinks');
                const abnormalLinks = abnormalResult.abnormalLinks || [];
                abnormalLinks.unshift({
                    link: link,
                    reason: reason,
                    timestamp: timestamp,
                    markedLine: markedLink
                });
                
                // 只保留最近的100个异常链接
                if (abnormalLinks.length > 100) {
                    abnormalLinks.splice(100);
                }
                
                await chrome.storage.local.set({ abnormalLinks: abnormalLinks });
            } catch (storageError) {
                console.warn('保存异常链接列表失败:', storageError);
            }
            
            return true;
        } catch (error) {
            console.error('标记异常链接失败:', error);
            return false;
        }
    }

    // 统一的TXT文件导入功能
    function importTxtFile() {
        console.log('TXT文件导入功能被调用');

        // 使用fileInput元素
        const fileInput = elements.fileInput;
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

                // 保存TXT文件内容到存储
                await chrome.storage.local.set({ txtFileContent: text });
                
                // 保存当前选择的TXT文件引用
                popupState.selectedTxtFile = file;
                
                // 更新文件监控前置条件状态
                await checkFileMonitorPrerequisites();
                
                // 处理文件路径 - 自动保存文件路径
                await handleFilePathSelection(file);
                
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

                // 检查导入的链接是否有重复
                const duplicateLinks = [];
                for (const link of links) {
                    if (isLinkAlreadyOpened(link)) {
                        const existingItem = openedLinks.find(item => item.link === link);
                        if (existingItem) {
                            duplicateLinks.push({ link, existingInfo: existingItem });
                        }
                    }
                }
                
                // 如果有重复链接，显示弹窗
                if (duplicateLinks.length > 0) {
                    for (const { link, existingInfo } of duplicateLinks) {
                        showDuplicateLinkModal(link, existingInfo);
                    }
                    showMessage(`⚠️ 导入的链接中有 ${duplicateLinks.length} 个重复链接！`, 'error');
                }
                
                // 显示导入结果
                if (links.length > 0) {
                    // 不将有效链接复制到批量链接输入框，只保存到存储中
                    // elements.batchLinksInput.value = links.join('\n');

                    // 保存到存储
                    await chrome.storage.local.set({ batchLinks: links });

                    let message = `成功导入 ${links.length} 个有效链接（仅用于打开，不显示在输入框中）`;
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
        
        // 隐藏选中的文件信息
        if (elements.selectedFileInfo) {
            elements.selectedFileInfo.style.display = 'none';
        }
        
        showMessage('TXT导入状态已重置', 'success');
    }
    
    // 更新TXT文件状态显示
    async function updateTxtFileStatus() {
        try {
            const result = await chrome.storage.local.get('txtFileContent');
            if (!result.txtFileContent) {
                // 如果没有内容，重置状态
                resetTxtImportStatus();
                return;
            }
            
            const lines = result.txtFileContent.split('\n').filter(line => line.trim());
            const validLinks = lines.filter(line => {
                // 过滤掉异常链接标记
                return !line.startsWith('[异常');
            });
            const invalidLinks = lines.filter(line => {
                // 只统计异常链接标记
                return line.startsWith('[异常');
            });
            
            // 更新状态显示
            if (elements.txtImportStatus) {
                elements.txtImportStatus.textContent = '已导入';
                elements.txtImportStatus.className = 'status-value success';
            }
            if (elements.txtValidLinksCount) {
                elements.txtValidLinksCount.textContent = validLinks.length;
            }
            if (elements.txtInvalidLinksCount) {
                elements.txtInvalidLinksCount.textContent = invalidLinks.length;
            }
            
            // 显示选中的文件名
            if (popupState.selectedTxtFile && elements.selectedFileInfo && elements.selectedFileName) {
                elements.selectedFileInfo.style.display = 'block';
                elements.selectedFileName.textContent = popupState.selectedTxtFile.name;
            }
            
            console.log(`TXT文件状态更新: 有效链接 ${validLinks.length} 个, 异常链接 ${invalidLinks.length} 个`);
            
        } catch (error) {
            console.error('更新TXT文件状态失败:', error);
            resetTxtImportStatus();
        }
    }

    // 检查粘贴的链接是否有重复
    async function checkPastedLinksForDuplicates() {
        try {
            const inputLinks = elements.batchLinksInput.value.trim().split('\n').filter(link => link.trim());
            const duplicateLinks = [];
            
            for (const link of inputLinks) {
                if (isLinkAlreadyOpened(link)) {
                    const existingItem = openedLinks.find(item => item.link === link);
                    if (existingItem) {
                        duplicateLinks.push({ link, existingInfo: existingItem });
                    }
                }
            }
            
            // 如果有重复链接，显示弹窗
            if (duplicateLinks.length > 0) {
                for (const { link, existingInfo } of duplicateLinks) {
                    showDuplicateLinkModal(link, existingInfo);
                }
                showMessage(`⚠️ 粘贴的链接中有 ${duplicateLinks.length} 个重复链接！`, 'error');
            }
        } catch (error) {
            console.error('检查粘贴链接重复性失败:', error);
        }
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
            
            // 检测重复链接（与已打开链接对比）
            const duplicateLinks = [];
            for (const link of uniqueLinks) {
                if (isLinkAlreadyOpened(link)) {
                    const existingItem = openedLinks.find(item => item.link === link);
                    if (existingItem) {
                        duplicateLinks.push({ link, existingInfo: existingItem });
                    }
                }
            }
            
            // 如果有重复链接，显示弹窗
            if (duplicateLinks.length > 0) {
                for (const { link, existingInfo } of duplicateLinks) {
                    showDuplicateLinkModal(link, existingInfo);
                }
                showMessage(`⚠️ 检测到 ${duplicateLinks.length} 个重复链接！`, 'error');
            }
            
            // 更新链接计数显示
            if (elements.linkCount) {
                elements.linkCount.textContent = count;
                elements.linkCount.className = count > 0 ? 'status-value success' : 'status-value warning';
            }
            
            // 更新批量操作按钮状态
            if (elements.batchOpenLinksBtn) {
                elements.batchOpenLinksBtn.disabled = count === 0;
                elements.batchOpenLinksBtn.textContent = count === 0 ? '🚀 添加并打开 (无链接)' : `🚀 添加并打开 (${count}个)`;
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
            console.log('🚀 开始向缓存中的所有链接发送消息...');
            
            // 获取缓存中的所有链接
            const cachedLinks = await getAllCachedLinks();
            
            if (cachedLinks.length === 0) {
                showMessage('缓存中没有找到任何链接，请先打开一些链接', 'warning');
                return;
            }
            
            console.log(`📋 找到缓存中的 ${cachedLinks.length} 个链接:`, cachedLinks);
            
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

            // 保存缓存中的链接列表
            await chrome.storage.local.set({ batchLinks: cachedLinks });

            if (autoSend) {
                // 开始批量发送
                await startBatchSending(cachedLinks, message, waitForPageLoad, interval);
            } else {
                showMessage(`已保存缓存中的 ${cachedLinks.length} 个链接和消息内容，请手动点击发送`, 'success');
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
                
                            // 新增：检查链接是否在TXT文档中存在，如果不存在则添加
            const linkCheckResult = await checkLinkInTxtFile(link);
            if (!linkCheckResult.exists) {
                console.log('链接不在TXT文档中，正在添加:', link);
                await addLinkToTxtFile(link);
                showMessage(`链接已添加到TXT文档: ${link}`, 'info');
            }
            
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
                    
                    // 注意：发送失败不一定意味着链接本身有问题，可能是网络、权限等原因
                    // 只有在页面真正打开报错时才标记为错误链接
                    // 这里暂时不自动标记为异常链接
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
                
                // 新增：确保最后一个链接也能发送成功
                if (i === links.length - 1) {
                    console.log('最后一个链接处理完成，确保所有消息都已发送');
                    // 等待一段时间确保最后一个标签页的消息发送完成
                    await delay(2000);
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
                
                // 新增：检查标签页状态
                if (tab.status !== 'complete') {
                    console.log('标签页状态:', tab.status, '等待加载完成...');
                    await delay(3000); // 额外等待3秒
                }
            } catch (error) {
                return { success: false, error: '无法访问标签页' };
            }
            
            // 新增：多次尝试发送消息，确保成功
            let result = null;
            let attempts = 0;
            const maxAttempts = 3;
            
            while (attempts < maxAttempts && (!result || !result.success)) {
                attempts++;
                console.log(`尝试发送消息到标签页 ${tabId} (第${attempts}次)`);
                
                try {
                    // 使用chrome.tabs.sendMessage发送消息到content script
                    result = await chrome.tabs.sendMessage(tabId, {
                        action: 'sendMessageToCustomer',
                        message: message
                    });
                    
                    if (result && result.success !== undefined) {
                        if (result.success) {
                            console.log(`消息发送成功 (第${attempts}次尝试)`);
                            break;
                        } else {
                            console.log(`消息发送失败 (第${attempts}次尝试):`, result.error);
                        }
                    } else {
                        console.log(`未收到有效响应 (第${attempts}次尝试)`);
                    }
                } catch (sendError) {
                    console.log(`发送消息出错 (第${attempts}次尝试):`, sendError.message);
                    if (attempts < maxAttempts) {
                        await delay(1000); // 重试前等待1秒
                    }
                }
            }
            
            if (result && result.success) {
                return result;
            } else {
                return { 
                    success: false, 
                    error: `发送失败 (尝试${attempts}次): ${result?.error || '未知错误'}` 
                };
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



    // 话术相关函数 - 已更新为下拉框样式

    function addCustomMessage() {
        const input = elements.customMessageInput;
        const message = input.value.trim();
        
        if (!message) {
            showMessage('请输入话术内容', 'warning');
            return;
        }
        
        // 检查是否已存在
        const existingButtons = elements.customMessageButtons.querySelectorAll('.custom-message-btn');
        for (let btn of existingButtons) {
            if (btn.getAttribute('data-message') === message) {
                showMessage('该话术已存在', 'warning');
                return;
            }
        }
        
        // 创建自定义话术按钮
        createCustomMessageButton(message);
        
        // 清空输入框
        input.value = '';
        
        // 保存自定义话术列表
        saveCustomMessages();
        
        showMessage(`已添加自定义话术: ${message}`, 'success');
    }

    // 保存自定义话术列表
    async function saveCustomMessages() {
        try {
            const customMessages = [];
            const buttons = elements.customMessageButtons.querySelectorAll('.custom-message-btn');
            buttons.forEach(button => {
                customMessages.push(button.getAttribute('data-message'));
            });
            
            // 保存到Chrome存储
            await chrome.storage.local.set({ customMessages });
            
            // 保存到TXT文件
            await saveCustomMessagesToTxt(customMessages);
            
            console.log('自定义话术已保存:', customMessages);
        } catch (error) {
            console.error('保存自定义话术失败:', error);
        }
    }

    // 保存自定义话术到TXT文件
    async function saveCustomMessagesToTxt(messages) {
        try {
            if (messages.length === 0) return;
            
            // 创建话术内容
            const content = messages.join('\n');
            
            // 保存到Chrome存储，用于后续导出
            await chrome.storage.local.set({ customMessagesTxt: content });
            
            console.log('自定义话术已保存到存储，可导出为TXT文件');
        } catch (error) {
            console.error('保存自定义话术到存储失败:', error);
        }
    }

    // 加载自定义话术列表
    async function loadCustomMessages() {
        try {
            const result = await chrome.storage.local.get(['customMessages']);
            if (result.customMessages && Array.isArray(result.customMessages)) {
                result.customMessages.forEach(message => {
                    createCustomMessageButton(message);
                });
                console.log('自定义话术已加载:', result.customMessages);
            }
        } catch (error) {
            console.error('加载自定义话术失败:', error);
        }
    }

    // 导出自定义话术到TXT文件
    async function exportCustomMessages() {
        try {
            const result = await chrome.storage.local.get(['customMessagesTxt']);
            if (!result.customMessagesTxt) {
                showMessage('没有自定义话术可导出', 'warning');
                return;
            }
            
            // 创建Blob对象
            const blob = new Blob([result.customMessagesTxt], { type: 'text/plain;charset=utf-8' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'custom_messages.txt';
            
            // 触发下载
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 清理URL
            URL.revokeObjectURL(url);
            
            showMessage('自定义话术已导出到TXT文件', 'success');
            console.log('自定义话术已导出到TXT文件');
        } catch (error) {
            console.error('导出自定义话术失败:', error);
            showMessage('导出自定义话术失败: ' + error.message, 'error');
        }
    }

    // 导入自定义话术从TXT文件
    async function importCustomMessages() {
        try {
            // 创建文件输入元素
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.txt';
            fileInput.style.display = 'none';
            
            fileInput.addEventListener('change', async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                
                try {
                    const text = await file.text();
                    const messages = text.split('\n').filter(msg => msg.trim());
                    
                    if (messages.length === 0) {
                        showMessage('TXT文件中没有有效的话术内容', 'warning');
                        return;
                    }
                    
                    // 清空现有的自定义话术
                    elements.customMessageButtons.innerHTML = '';
                    
                    // 添加导入的话术
                    messages.forEach(message => {
                        if (message.trim()) {
                            createCustomMessageButton(message.trim());
                        }
                    });
                    
                    // 保存到存储
                    await saveCustomMessages();
                    
                    showMessage(`已导入 ${messages.length} 条话术`, 'success');
                    console.log('话术导入成功:', messages);
                    
                } catch (error) {
                    console.error('读取TXT文件失败:', error);
                    showMessage('读取TXT文件失败: ' + error.message, 'error');
                }
                
                // 清理文件输入
                document.body.removeChild(fileInput);
            });
            
            // 触发文件选择
            document.body.appendChild(fileInput);
            fileInput.click();
            
        } catch (error) {
            console.error('导入话术失败:', error);
            showMessage('导入话术失败: ' + error.message, 'error');
        }
    }

    // 创建自定义话术按钮
    function createCustomMessageButton(message) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-outline btn-sm custom-message-btn';
        button.setAttribute('data-message', message);
        button.textContent = message;
        
        // 添加删除按钮
        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.title = '删除此话术';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            button.remove();
            showMessage(`已删除话术: ${message}`, 'info');
            // 保存自定义话术列表
            saveCustomMessages();
        });
        
        button.appendChild(deleteBtn);
        
        // 绑定点击事件
        button.addEventListener('click', () => {
            if (elements.batchMessageInput) {
                elements.batchMessageInput.value = message;
                showMessage(`已选择自定义话术: ${message}`, 'info');
            }
        });
        
        // 添加到自定义话术区域
        elements.customMessageButtons.appendChild(button);
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
    
    // 显示API诊断结果模态框
    function showAPIDiagnosticsModal(diagnostics) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔧 API诊断结果</h3>
                    <span class="close">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="diagnostics-section">
                        <h4>📋 API配置信息</h4>
                        <div class="config-info">
                            <p><strong>端点:</strong> ${diagnostics.config.endpoint}</p>
                            <p><strong>超时:</strong> ${diagnostics.config.timeout}ms</p>
                            <p><strong>最大重试:</strong> ${diagnostics.config.maxRetries}次</p>
                            <p><strong>启用状态:</strong> ${diagnostics.config.enabled ? '✅ 已启用' : '❌ 未启用'}</p>
                        </div>
                    </div>
                    
                    <div class="diagnostics-section">
                        <h4>🔗 连接测试结果</h4>
                        <div class="connection-info">
                            ${diagnostics.connection ? 
                                (diagnostics.connection.success ? 
                                    `<p class="success">✅ ${diagnostics.connection.message}</p>` :
                                    `<p class="error">❌ ${diagnostics.connection.error}</p>`) :
                                '<p class="warning">⚠️ 未进行连接测试</p>'
                            }
                        </div>
                    </div>
                    
                    <div class="diagnostics-section">
                        <h4>💡 建议解决方案</h4>
                        <div class="suggestions">
                            <ul>
                                <li>检查API端点URL是否正确</li>
                                <li>确认API服务是否正常运行</li>
                                <li>检查网络连接是否正常</li>
                                <li>验证API响应格式是否符合预期</li>
                                <li>检查API是否需要认证或特殊请求头</li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="testAPIConnection()">🔄 重新测试连接</button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">关闭</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 关闭按钮事件
        modal.querySelector('.close').onclick = () => modal.remove();
        
        // 点击外部关闭
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        // 显示消息
        showMessage('API诊断完成，请查看详细结果', 'info');
    }
    
    // 测试API连接函数（供模态框调用）
    async function testAPIConnection() {
        try {
            showMessage('正在测试API连接...', 'info');
            
            // 发送测试请求到content script
            const response = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = response[0].id;
            
            const result = await chrome.tabs.sendMessage(tabId, {
                action: 'testAPIConnection'
            });
            
            if (result.success) {
                showMessage('API连接测试成功', 'success');
            } else {
                showMessage(`API连接测试失败: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('测试API连接失败:', error);
            showMessage('测试API连接失败', 'error');
        }
    }

    // 显示重复链接弹窗
    async function showDuplicateLinkModal(link, existingInfo) {
        // 检查是否设置了不再提醒
        try {
            const result = await chrome.storage.local.get(['dontShowDuplicateReminder']);
            if (result.dontShowDuplicateReminder) {
                console.log('用户已设置不再显示重复链接提醒');
                return;
            }
        } catch (error) {
            console.warn('检查不再提醒设置失败:', error);
        }
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">⚠️ 链接重复提醒</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div style="margin-bottom: 20px;">
                    <p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">
                        您尝试添加的链接已经存在，以下是详细信息：
                    </p>
                    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #17a2b8;">
                        <div style="margin-bottom: 12px;">
                            <strong>🔗 链接地址：</strong>
                            <div style="word-break: break-all; font-family: monospace; font-size: 12px; color: #495057; margin-top: 4px;">
                                ${link}
                            </div>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <strong>📅 首次打开时间：</strong>
                            <span style="color: #28a745;">${new Date(existingInfo.openedAt).toLocaleString()}</span>
                        </div>
                        <div style="margin-bottom: 12px;">
                            <strong>🔢 已打开次数：</strong>
                            <span style="color: #007bff; font-weight: bold;">${existingInfo.openedCount} 次</span>
                        </div>
                        ${existingInfo.lastOpenedAt ? `
                        <div>
                            <strong>🕒 最后打开时间：</strong>
                            <span style="color: #6f42c1;">${new Date(existingInfo.lastOpenedAt).toLocaleString()}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                <div style="text-align: center;">
                    <button class="btn btn-info" id="acknowledgeBtn" style="margin-right: 10px;">
                        👍 我知道了
                    </button>
                    <button class="btn btn-secondary" id="dontRemindBtn">
                        🔕 不再提醒
                    </button>
                </div>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(modal);
        
        // 绑定按钮事件
        const acknowledgeBtn = modal.querySelector('#acknowledgeBtn');
        const dontRemindBtn = modal.querySelector('#dontRemindBtn');
        
        // "我知道了"按钮 - 立即关闭弹窗
        acknowledgeBtn.addEventListener('click', function() {
            modal.remove();
            showMessage('已关闭重复链接提示', 'info');
        });
        
        // "不再提醒"按钮 - 设置不再提醒并关闭弹窗
        dontRemindBtn.addEventListener('click', function() {
            // 设置不再提醒标志
            chrome.storage.local.set({ 'dontShowDuplicateReminder': true }, function() {
                console.log('已设置不再显示重复链接提醒');
            });
            
            modal.remove();
            showMessage('已设置不再提醒重复链接', 'success');
        });
        
        // 点击模态框背景关闭
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // 5秒后自动关闭
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 5000);
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
                    if (message.status === 'queued') {
                        showMessage(`AI消息已加入发送队列 (队列长度: ${message.queueLength})`, 'success');
                    } else {
                        showMessage(`AI消息发送成功: ${message.message}`, 'success');
                    }
                } else {
                    // 特殊处理503错误
                    if (message.errorType === '503' || message.error.includes('503')) {
                        showMessage(`🚨 服务器暂时不可用 (503): ${message.error}`, 'error');
                        showMessage(`💡 建议: 检查后端服务是否正常运行 (localhost:8090)`, 'warning');
                    } else {
                        showMessage(`AI消息发送失败: ${message.error}`, 'error');
                    }
                }
                break;
                
            case 'updateQueueStatus':
                // 更新消息队列状态
                updateQueueStatusDisplay(message);
                break;
                
            case 'markAbnormalLink':
                // 标记异常链接
                markAbnormalLink(message.link, message.reason).then(success => {
                    if (success) {
                        showMessage(`异常链接已标记: ${message.link}`, 'warning');
                    } else {
                        showMessage(`标记异常链接失败: ${message.link}`, 'error');
                    }
                }).catch(error => {
                    console.error('标记异常链接失败:', error);
                    showMessage(`标记异常链接失败: ${error.message}`, 'error');
                });
                break;
                
            case 'addErrorLink':
                // 添加错误链接
                addErrorLink(message.link, message.reason);
                break;
                
            case 'duplicateLinkDetected':
                // 检测到重复链接
                showDuplicateLinkModal(message.link, message.existingInfo);
                showMessage(`检测到重复链接: ${message.link}`, 'warning');
                break;
                
            case 'apiDiagnostics':
                // API诊断结果
                console.log('收到API诊断结果:', message.diagnostics);
                showAPIDiagnosticsModal(message.diagnostics);
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

    // ==================== 文件监控功能 ====================

    // 切换文件监控设置显示
    function toggleFileMonitorSettings() {
        if (elements.fileMonitorSettings) {
            elements.fileMonitorSettings.style.display = 
                elements.enableFileMonitoringCheckbox.checked ? 'block' : 'none';
        }
    }

    // 切换问候语输入框显示
    function toggleGreetingMessageGroup() {
        const greetingGroup = document.getElementById('greetingMessageGroup');
        if (greetingGroup) {
            greetingGroup.style.display = 
                elements.autoSendGreetingCheckbox.checked ? 'block' : 'none';
        }
    }

    // 保存监控文件路径
    async function saveMonitorFilePath() {
        try {
            const filePath = elements.monitorFilePathInput.value.trim();
            if (filePath) {
                await chrome.storage.local.set({ 
                    monitorFilePath: filePath 
                });
                console.log('监控文件路径已保存:', filePath);
            }
        } catch (error) {
            console.error('保存监控文件路径失败:', error);
        }
    }


    // 处理文件路径选择
    async function handleFilePathSelection(file) {
        try {
            console.log('处理文件路径选择:', file);
            
            // 尝试获取文件路径
            let filePath = '';
            
            // 方法1: 尝试使用File System Access API获取完整路径
            if ('showOpenFilePicker' in window) {
                try {
                    // 提示用户选择文件以获取完整路径
                    const [fileHandle] = await window.showOpenFilePicker({
                        types: [{
                            description: '文本文件',
                            accept: {
                                'text/plain': ['.txt']
                            }
                        }],
                        excludeAcceptAllOption: true
                    });
                    
                    // 获取文件路径（如果支持）
                    if (fileHandle && fileHandle.name === file.name) {
                        // 在某些浏览器中，可以通过fileHandle获取路径信息
                        filePath = fileHandle.name; // 暂时使用文件名，完整路径需要其他方法
                        console.log('通过File System Access API获取路径:', filePath);
                    }
                } catch (error) {
                    console.log('File System Access API不可用或用户取消:', error);
                }
            }
            
            // 方法2: 尝试从file.webkitRelativePath获取路径
            if (!filePath && file.webkitRelativePath) {
                filePath = file.webkitRelativePath;
                console.log('从webkitRelativePath获取路径:', filePath);
            }
            
            // 方法3: 尝试从file.path获取路径（某些浏览器支持）
            if (!filePath && file.path) {
                filePath = file.path;
                console.log('从file.path获取路径:', filePath);
            }
            
            // 方法4: 如果无法获取完整路径，提示用户手动输入
            if (!filePath || filePath === file.name) {
                console.log('无法自动获取完整路径，提示用户手动输入');
                
                // 显示手动输入路径的提示
                const userInput = await showPathInputDialog(file.name);
                if (userInput && userInput.trim()) {
                    filePath = userInput.trim();
                    console.log('用户手动输入路径:', filePath);
                } else {
                    // 如果用户没有输入，使用文件名作为fallback
                    filePath = file.name;
                    console.log('使用文件名作为fallback路径:', filePath);
                }
            }
            
            // 保存文件信息到存储
            await chrome.storage.local.set({ 
                selectedFileName: file.name,
                selectedFilePath: filePath,
                selectedFileSize: file.size,
                selectedFileLastModified: file.lastModified
            });
            
            // 更新路径输入框显示
            if (elements.txtFilePathInput) {
                elements.txtFilePathInput.value = filePath;
                elements.txtFilePathInput.style.borderColor = '#51cf66';
                elements.txtFilePathInput.title = '文件路径已获取';
                
                // 如果是完整路径，添加编辑按钮
                if (filePath !== file.name) {
                    addPathEditButton();
                }
            }
            
            showMessage(`文件路径已获取: ${filePath}`, 'success');
            console.log('文件路径保存成功:', filePath);
            
        } catch (error) {
            console.error('处理文件路径失败:', error);
            showMessage('获取文件路径失败，请手动输入', 'warning');
        }
    }

    // 显示路径输入对话框
    async function showPathInputDialog(fileName) {
        return new Promise((resolve) => {
            // 创建模态对话框
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                min-width: 400px;
                max-width: 600px;
            `;
            
            dialog.innerHTML = `
                <h3 style="margin: 0 0 15px 0; color: #333;">请输入文件完整路径</h3>
                <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">
                    由于浏览器安全限制，无法自动获取文件完整路径。<br>
                    请手动输入文件的完整路径，例如：<br>
                    <code style="background: #f5f5f5; padding: 2px 4px; border-radius: 3px;">C:\\Users\\Administrator\\Desktop\\${fileName}</code>
                </p>
                <input type="text" id="pathInput" placeholder="请输入完整文件路径..." 
                       style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0;">
                <div style="text-align: right; margin-top: 15px;">
                    <button id="cancelBtn" style="margin-right: 10px; padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">取消</button>
                    <button id="confirmBtn" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">确认</button>
                </div>
            `;
            
            modal.appendChild(dialog);
            document.body.appendChild(modal);
            
            const pathInput = dialog.querySelector('#pathInput');
            const cancelBtn = dialog.querySelector('#cancelBtn');
            const confirmBtn = dialog.querySelector('#confirmBtn');
            
            // 聚焦到输入框
            pathInput.focus();
            
            // 事件处理
            cancelBtn.onclick = () => {
                document.body.removeChild(modal);
                resolve(null);
            };
            
            confirmBtn.onclick = () => {
                const path = pathInput.value.trim();
                document.body.removeChild(modal);
                resolve(path);
            };
            
            // 回车确认
            pathInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    confirmBtn.click();
                } else if (e.key === 'Escape') {
                    cancelBtn.click();
                }
            };
            
            // 点击背景关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    cancelBtn.click();
                }
            };
        });
    }

    // 添加路径编辑按钮
    function addPathEditButton() {
        if (!elements.txtFilePathInput) return;
        
        // 检查是否已经添加了编辑按钮
        const existingBtn = elements.txtFilePathInput.parentNode.querySelector('.edit-path-btn');
        if (existingBtn) return;
        
        const editBtn = document.createElement('button');
        editBtn.textContent = '编辑';
        editBtn.className = 'edit-path-btn';
        editBtn.style.cssText = `
            margin-left: 5px;
            padding: 4px 8px;
            font-size: 12px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
        `;
        
        editBtn.onclick = async () => {
            const currentPath = elements.txtFilePathInput.value;
            const fileName = currentPath.split('\\').pop() || currentPath.split('/').pop() || 'file.txt';
            
            const newPath = await showPathInputDialog(fileName);
            if (newPath && newPath.trim()) {
                elements.txtFilePathInput.value = newPath.trim();
                
                // 更新存储
                await chrome.storage.local.set({ 
                    selectedFilePath: newPath.trim()
                });
                
                showMessage('文件路径已更新', 'success');
            }
        };
        
        elements.txtFilePathInput.parentNode.appendChild(editBtn);
    }

    // 启动文件监控
    async function startFileMonitoring() {
        try {
            console.log('开始启动文件监控...');
            
            // 检查是否已输入文件路径
            const filePath = elements.monitorFilePathInput.value.trim();
            if (!filePath) {
                showMessage('请先输入要监控的文件路径', 'warning');
                return;
            }
            
            // 验证文件路径格式
            if (!filePath.endsWith('.txt')) {
                showMessage('请选择TXT格式的文件', 'warning');
                return;
            }

            console.log('使用文件路径进行监控:', filePath);

            // 获取监控设置
            // 处理多条问候语
            const greetingText = elements.greetingMessageInput.value.trim();
            const greetingMessages = greetingText ? 
                greetingText.split('\n').map(line => line.trim()).filter(line => line !== '') : 
                ['你好，请问这个产品还有货吗？'];
            
            const settings = {
                enabled: true,
                checkInterval: parseInt(elements.monitorIntervalSelect.value),
                autoOpenLinks: elements.autoOpenNewLinksCheckbox.checked,
                autoStartListening: elements.autoStartNewLinksMonitoringCheckbox.checked,
                autoSendGreeting: elements.autoSendGreetingCheckbox.checked,
                greetingMessage: greetingMessages[0] || '你好，请问这个产品还有货吗？', // 保持向后兼容
                greetingMessages: greetingMessages // 新增：多条问候语支持
            };

            console.log('启动文件监控，设置:', settings);
            console.log('监控文件路径:', filePath);

            // 发送消息到background script
            console.log('发送消息到background script...');
            const response = await chrome.runtime.sendMessage({
                action: 'startFileMonitoring',
                filePath: filePath, // 使用用户输入的文件路径
                settings: settings
            });

            console.log('文件监控启动响应:', response);

            if (response && response.success) {
                showMessage('文件监控已启动', 'success');
                updateFileMonitorUI(true);
                
                // 保存设置到存储
                await chrome.storage.local.set({ 
                    fileMonitorSettings: settings,
                    monitorFilePath: filePath // 保存用户输入的文件路径
                });
            } else {
                const errorMsg = response ? response.error : '未收到响应';
                console.error('文件监控启动失败:', errorMsg);
                showMessage(`启动文件监控失败: ${errorMsg}`, 'error');
            }
        } catch (error) {
            console.error('启动文件监控失败:', error);
            showMessage(`启动文件监控失败: ${error.message}`, 'error');
        }
    }

    // 停止文件监控
    async function stopFileMonitoring() {
        try {
            console.log('停止文件监控');

            const response = await chrome.runtime.sendMessage({
                action: 'stopFileMonitoring'
            });

            if (response.success) {
                showMessage('文件监控已停止', 'success');
                updateFileMonitorUI(false);
                
                // 清理存储
                await chrome.storage.local.remove(['fileMonitorSettings', 'monitoredFilePath']);
            } else {
                showMessage(`停止文件监控失败: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('停止文件监控失败:', error);
            showMessage(`停止文件监控失败: ${error.message}`, 'error');
        }
    }

    // 更新文件监控UI状态
    function updateFileMonitorUI(isMonitoring) {
        if (elements.startFileMonitorBtn && elements.stopFileMonitorBtn) {
            elements.startFileMonitorBtn.style.display = isMonitoring ? 'none' : 'inline-block';
            elements.stopFileMonitorBtn.style.display = isMonitoring ? 'inline-block' : 'none';
        }

        if (elements.fileMonitorStatus && elements.monitorStatusText) {
            elements.fileMonitorStatus.style.display = 'block';
            elements.monitorStatusText.textContent = isMonitoring ? '监控中' : '未启动';
            elements.monitorStatusText.style.color = isMonitoring ? 'var(--success-color)' : 'var(--text-muted)';
        }
    }

    // 获取文件监控状态
    async function getFileMonitorStatus() {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getFileMonitorStatus'
            });

            if (response.success) {
                // 更新UI状态
                if (elements.enableFileMonitoringCheckbox) {
                    elements.enableFileMonitoringCheckbox.checked = response.enabled;
                }
                
                updateFileMonitorUI(response.enabled);
                
                // 如果正在监控，显示监控的文件名
                if (response.enabled && response.filePath) {
                    showMessage(`正在监控文件: ${response.filePath}`, 'info');
                }
            }
        } catch (error) {
            console.error('获取文件监控状态失败:', error);
        }
    }

    // 更新文件监控设置
    async function updateFileMonitorSettings() {
        try {
            // 处理多条问候语
            const greetingText = elements.greetingMessageInput.value.trim();
            const greetingMessages = greetingText ? 
                greetingText.split('\n').map(line => line.trim()).filter(line => line !== '') : 
                ['你好，请问这个产品还有货吗？'];

            const settings = {
                checkInterval: parseInt(elements.monitorIntervalSelect.value),
                autoOpenLinks: elements.autoOpenNewLinksCheckbox.checked,
                autoStartListening: elements.autoStartNewLinksMonitoringCheckbox.checked,
                autoSendGreeting: elements.autoSendGreetingCheckbox.checked,
                greetingMessage: greetingMessages[0] || '你好，请问这个产品还有货吗？', // 保持向后兼容
                greetingMessages: greetingMessages // 新增：多条问候语支持
            };

            await chrome.runtime.sendMessage({
                action: 'updateFileMonitorSettings',
                settings: settings
            });

            console.log('文件监控设置已更新:', settings);
        } catch (error) {
            console.error('更新文件监控设置失败:', error);
        }
    }

    // 初始化文件监控状态
    async function initFileMonitor() {
        try {
            // 获取存储的设置
            const result = await chrome.storage.local.get(['fileMonitorSettings', 'monitorFilePath']);
            
            if (result.fileMonitorSettings) {
                const settings = result.fileMonitorSettings;
                
                // 恢复设置到UI
                if (elements.monitorIntervalSelect) {
                    elements.monitorIntervalSelect.value = settings.checkInterval || 5000;
                }
                if (elements.autoOpenNewLinksCheckbox) {
                    elements.autoOpenNewLinksCheckbox.checked = settings.autoOpenLinks !== false;
                }
                if (elements.autoStartNewLinksMonitoringCheckbox) {
                    elements.autoStartNewLinksMonitoringCheckbox.checked = settings.autoStartListening !== false;
                }
                if (elements.autoSendGreetingCheckbox) {
                    elements.autoSendGreetingCheckbox.checked = settings.autoSendGreeting !== false;
                }
                if (elements.greetingMessageInput) {
                    // 处理多条问候语的显示
                    if (settings.greetingMessages && Array.isArray(settings.greetingMessages)) {
                        elements.greetingMessageInput.value = settings.greetingMessages.join('\n');
                    } else {
                        elements.greetingMessageInput.value = settings.greetingMessage || '你好，请问这个产品还有货吗？';
                    }
                }
                
                // 切换UI显示状态
                toggleGreetingMessageGroup();
            } else {
                // 如果没有保存的设置，使用默认设置
                console.log('使用默认文件监控设置');
                await setDefaultFileMonitorSettings();
            }
            
            // 恢复文件路径
            if (result.monitorFilePath) {
                elements.monitorFilePathInput.value = result.monitorFilePath;
            } else {
                // 设置默认文件路径
                elements.monitorFilePathInput.value = 'C:\\Users\\Public\\Desktop\\links.txt';
            }

            // 检查文件监控前置条件
            await checkFileMonitorPrerequisites();

            // 获取当前监控状态
            await getFileMonitorStatus();
            
            // 注释掉自动启动文件监控，改为手动启动
            // await autoStartFileMonitor();
        } catch (error) {
            console.error('初始化文件监控失败:', error);
        }
    }

    // 设置默认文件监控设置
    async function setDefaultFileMonitorSettings() {
        try {
            const defaultSettings = {
                enabled: false, // 默认不启用文件监控
                checkInterval: 5000,
                autoOpenLinks: true,
                autoStartListening: true,
                autoSendGreeting: true,
                greetingMessage: '你好，请问这个产品还有货吗？',
                greetingMessages: [
                    '你好，请问这个产品还有货吗？',
                    '您好，我想了解一下这个商品的价格',
                    '你好，请问这个产品什么时候发货？',
                    '您好，我想咨询一下这个商品的详细信息',
                    '你好，请问这个产品支持退换货吗？',
                    '您好，我想购买这个商品，有什么优惠吗？',
                    '你好，请问这个产品的质量怎么样？',
                    '您好，我想了解一下这个商品的规格参数'
                ]
            };
            
            // 保存默认设置
            await chrome.storage.local.set({ 
                fileMonitorSettings: defaultSettings,
                monitorFilePath: 'C:\\Users\\Public\\Desktop\\links.txt'
            });
            
            // 更新UI
            if (elements.monitorIntervalSelect) {
                elements.monitorIntervalSelect.value = defaultSettings.checkInterval;
            }
            if (elements.autoOpenNewLinksCheckbox) {
                elements.autoOpenNewLinksCheckbox.checked = defaultSettings.autoOpenLinks;
            }
            if (elements.autoStartNewLinksMonitoringCheckbox) {
                elements.autoStartNewLinksMonitoringCheckbox.checked = defaultSettings.autoStartListening;
            }
            if (elements.autoSendGreetingCheckbox) {
                elements.autoSendGreetingCheckbox.checked = defaultSettings.autoSendGreeting;
            }
            if (elements.greetingMessageInput) {
                elements.greetingMessageInput.value = defaultSettings.greetingMessages.join('\n');
            }
            
            console.log('默认文件监控设置已设置');
        } catch (error) {
            console.error('设置默认文件监控设置失败:', error);
        }
    }


    // 检查文件监控前置条件
    async function checkFileMonitorPrerequisites() {
        try {
            const result = await chrome.storage.local.get(['txtFileContent', 'selectedFilePath']);
            
            if (!result.txtFileContent) {
                console.log('文件监控前置条件检查: 未找到TXT文件内容');
                if (elements.startFileMonitorBtn) {
                    elements.startFileMonitorBtn.disabled = true;
                    elements.startFileMonitorBtn.title = '请先导入TXT文件内容';
                }
            } else {
                console.log('文件监控前置条件检查: TXT文件内容已就绪');
                if (elements.startFileMonitorBtn) {
                    elements.startFileMonitorBtn.disabled = false;
                    elements.startFileMonitorBtn.title = '启动文件监控';
                }
            }
        } catch (error) {
            console.error('检查文件监控前置条件失败:', error);
        }
    }
    
    // ==================== 错误链接管理相关函数 ====================
    
    // 加载错误链接
    async function loadErrorLinks() {
        try {
            const result = await chrome.storage.local.get(['errorLinks']);
            if (result.errorLinks) {
                errorLinks = result.errorLinks;
                updateErrorLinksDisplay();
            }
        } catch (error) {
            console.error('加载错误链接失败:', error);
        }
    }
    
    // 获取当前浏览器环境的缓存键
    function getBrowserCacheKey(windowId) {
        return `openedLinks_${windowId}`;
    }

    // 获取当前窗口ID
    async function getCurrentWindowId() {
        try {
            const windows = await chrome.windows.getAll();
            const activeWindow = windows.find(w => w.focused) || windows[0];
            return activeWindow ? activeWindow.id : 'default';
        } catch (error) {
            console.warn('无法获取窗口ID，使用默认值:', error);
            return 'default';
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

    // 加载已打开链接记录（使用当前浏览器环境的缓存）
    async function loadOpenedLinks() {
        try {
            const windowId = await getCurrentWindowId();
            const cacheKey = getBrowserCacheKey(windowId);
            const result = await chrome.storage.local.get([cacheKey]);
            if (result[cacheKey]) {
                openedLinks = result[cacheKey];
                console.log(`已加载 ${openedLinks.length} 个已打开链接记录 (窗口${windowId})`);
            } else {
                openedLinks = [];
                console.log(`当前浏览器环境 (窗口${windowId}) 暂无已打开链接记录`);
            }
            // 更新显示
            updateOpenedLinksDisplay();
        } catch (error) {
            console.error('加载已打开链接记录失败:', error);
        }
    }
    
    // 保存已打开链接记录（使用当前浏览器环境的缓存）
    async function saveOpenedLinks() {
        try {
            const windowId = await getCurrentWindowId();
            const cacheKey = getBrowserCacheKey(windowId);
            await chrome.storage.local.set({ [cacheKey]: openedLinks });
            console.log(`已保存 ${openedLinks.length} 个已打开链接记录 (窗口${windowId})`);
        } catch (error) {
            console.error('保存已打开链接记录失败:', error);
        }
    }
    
    // 检查链接是否已经打开过
    function isLinkAlreadyOpened(link) {
        return openedLinks.some(item => item.link === link);
    }
    
    // 添加链接到已打开记录（使用当前浏览器环境的缓存）
    async function addToOpenedLinks(link) {
        const windowId = await getCurrentWindowId();
        
        if (!isLinkAlreadyOpened(link)) {
            openedLinks.push({
                link: link,
                openedAt: new Date().toISOString(),
                openedCount: 1,
                windowId: windowId
            });
            await saveOpenedLinks();
            console.log(`已记录新打开的链接 (窗口${windowId}): ${link}`);
        } else {
            // 如果已经存在，增加打开次数
            const existingItem = openedLinks.find(item => item.link === link);
            if (existingItem) {
                existingItem.openedCount++;
                existingItem.lastOpenedAt = new Date().toISOString();
                await saveOpenedLinks();
                console.log(`链接已存在，增加打开次数 (窗口${windowId}): ${link} (总计: ${existingItem.openedCount})`);
                
                // 显示重复打开弹窗提示
                showDuplicateLinkModal(link, existingItem);
            }
        }
        // 更新显示
        updateOpenedLinksDisplay();
    }
    
    // 添加错误链接
    function addErrorLink(link, reason) {
        // 验证链接格式
        if (!link || typeof link !== 'string') {
            console.warn('无效的链接格式:', link);
            return false;
        }
        
        // 检查是否为拼多多链接
        if (!link.includes('yangkeduo.com') && !link.includes('pinduoduo.com')) {
            console.warn('非拼多多链接，不标记为错误链接:', link);
            return false;
        }
        
        // 检查是否已存在
        if (!errorLinks.find(item => item.link === link)) {
            // 验证错误原因是否合理 - 只有真正的页面错误才标记
            const validReasons = [
                '页面加载失败',
                '页面不存在',
                '店铺已下线',
                '商品已下架',
                '链接已失效',
                '网络连接错误',
                '服务器错误',
                '权限不足',
                '页面超时',
                'HTTP 404',
                'HTTP 500',
                'HTTP 403',
                'HTTP 502',
                'HTTP 503',
                'ERR_NAME_NOT_RESOLVED',
                'ERR_CONNECTION_REFUSED',
                'ERR_CONNECTION_TIMED_OUT',
                'ERR_EMPTY_RESPONSE'
            ];
            
            // 检查是否为真正的页面错误
            const isRealError = validReasons.some(valid => 
                reason.toLowerCase().includes(valid.toLowerCase())
            );
            
            // 如果不是明确的页面错误，需要进一步验证
            if (!isRealError) {
                console.warn('错误原因可能不准确，需要进一步验证:', reason);
                // 对于不确定的错误，标记为需要验证
                reason = `需要验证: ${reason}`;
            }
            
            errorLinks.push({
                link: link,
                reason: reason,
                timestamp: new Date().toISOString(),
                verified: false, // 标记为未验证的错误链接
                verificationAttempts: 0, // 验证尝试次数
                isRealError: isRealError // 是否为真正的页面错误
            });
            
            // 保存到本地存储
            chrome.storage.local.set({ errorLinks: errorLinks });
            
            // 更新显示
            updateErrorLinksDisplay();
            
            showMessage(`已添加错误链接: ${link}`, 'warning');
            return true;
        }
        
        return false;
    }
    
    // 更新错误链接显示
    function updateErrorLinksDisplay() {
        if (!elements.errorLinksInput || !elements.errorLinksCount) return;
        
        // 更新错误链接数量
        elements.errorLinksCount.textContent = errorLinks.length;
        
        // 更新错误链接输入框内容
        if (errorLinks.length > 0) {
            const errorText = errorLinks.map(item => {
                let statusIcon = '❓';
                if (item.verified) {
                    statusIcon = item.isRealError ? '❌' : '✅';
                } else if (item.isRealError) {
                    statusIcon = '⚠️';
                }
                
                const verificationInfo = item.verified ? 
                    `[${item.isRealError ? '确认错误' : '确认正常'}]` : 
                    `[${item.isRealError ? '疑似错误' : '需要验证'}]`;
                
                return `${statusIcon} ${item.link} (${item.reason}) ${verificationInfo} - ${new Date(item.timestamp).toLocaleString()}`;
            }).join('\n');
            elements.errorLinksInput.value = errorText;
            
            // 启用按钮
            elements.removeErrorLinksBtn.disabled = false;
            elements.exportErrorLinksBtn.disabled = false;
            elements.clearErrorLinksBtn.disabled = false;
            elements.verifyErrorLinksBtn.disabled = false;
            
            // 清理正常链接按钮总是启用（可以清理所有链接）
            if (elements.cleanNormalLinksBtn) {
                elements.cleanNormalLinksBtn.disabled = false;
            }
        } else {
            elements.errorLinksInput.value = '';
            
            // 禁用按钮
            elements.removeErrorLinksBtn.disabled = true;
            elements.exportErrorLinksBtn.disabled = true;
            elements.clearErrorLinksBtn.disabled = true;
            elements.verifyErrorLinksBtn.disabled = true;
            if (elements.cleanNormalLinksBtn) {
                elements.cleanNormalLinksBtn.disabled = true;
            }
        }
    }
    
    // 从原始链接中删除错误链接
    async function removeErrorLinks() {
        if (errorLinks.length === 0) {
            showMessage('没有错误链接需要删除', 'info');
            return;
        }
        
        try {
            // 获取当前链接列表
            const result = await chrome.storage.local.get(['batchLinks']);
            let currentLinks = result.batchLinks || [];
            
            // 获取错误链接的URL列表
            const errorUrls = errorLinks.map(item => item.link);
            
            // 从当前链接中移除错误链接
            const originalCount = currentLinks.length;
            currentLinks = currentLinks.filter(link => !errorUrls.includes(link));
            const removedCount = originalCount - currentLinks.length;
            
            // 保存更新后的链接列表
            await chrome.storage.local.set({ batchLinks: currentLinks });
            
            // 清空错误链接
            errorLinks = [];
            await chrome.storage.local.set({ errorLinks: errorLinks });
            
            // 更新显示
            updateErrorLinksDisplay();
            
            // 更新批量链接输入框
            if (elements.batchLinksInput) {
                elements.batchLinksInput.value = currentLinks.join('\n');
                updateLinkCount();
            }
            
            showMessage(`已从原始链接中删除 ${removedCount} 个错误链接`, 'success');
            
        } catch (error) {
            console.error('删除错误链接失败:', error);
            showMessage('删除错误链接失败: ' + error.message, 'error');
        }
    }
    
    // 导出错误链接
    function exportErrorLinks() {
        if (errorLinks.length === 0) {
            showMessage('没有错误链接需要导出', 'info');
            return;
        }
        
        try {
            // 创建错误链接报告
            const report = errorLinks.map(item => {
                let verifiedStatus = '未验证';
                if (item.verified) {
                    verifiedStatus = item.isRealError ? '确认错误' : '确认正常';
                } else if (item.isRealError) {
                    verifiedStatus = '疑似错误';
                } else {
                    verifiedStatus = '需要验证';
                }
                
                const errorType = item.isRealError ? '页面错误' : '其他问题';
                
                return `${item.link}\t${item.reason}\t${new Date(item.timestamp).toLocaleString()}\t${verifiedStatus}\t${errorType}`;
            }).join('\n');
            
            // 添加表头
            const header = '链接\t错误原因\t时间\t验证状态\t错误类型\n';
            const content = header + report;
            
            // 创建下载
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `错误链接报告_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            showMessage(`已导出 ${errorLinks.length} 个错误链接`, 'success');
            
        } catch (error) {
            console.error('导出错误链接失败:', error);
            showMessage('导出错误链接失败: ' + error.message, 'error');
        }
    }
    
    // 清空错误链接
    async function clearErrorLinks() {
        if (errorLinks.length === 0) {
            showMessage('没有错误链接需要清空', 'info');
            return;
        }
        
        try {
            // 清空错误链接
            errorLinks = [];
            await chrome.storage.local.set({ errorLinks: errorLinks });
            
            // 更新显示
            updateErrorLinksDisplay();
            
            showMessage('已清空所有错误链接', 'success');
            
        } catch (error) {
            console.error('清空错误链接失败:', error);
            showMessage('清空错误链接失败: ' + error.message, 'error');
        }
    }
    
    // 验证错误链接
    async function verifyErrorLinks() {
        if (errorLinks.length === 0) {
            showMessage('没有错误链接需要验证', 'info');
            return;
        }
        
        try {
            showMessage('开始验证错误链接...', 'info');
            
            let verifiedCount = 0;
            let invalidCount = 0;
            
            // 逐个验证错误链接
            for (let i = 0; i < errorLinks.length; i++) {
                const errorLink = errorLinks[i];
                
                try {
                    // 创建新标签页验证链接
                    const tab = await chrome.tabs.create({
                        url: errorLink.link,
                        active: false
                    });
                    
                    // 等待页面加载完成
                    await new Promise((resolve) => {
                        const timeout = setTimeout(() => {
                            chrome.tabs.onUpdated.removeListener(listener);
                            resolve();
                        }, 10000); // 10秒超时
                        
                        function listener(tabId, changeInfo) {
                            if (tabId === tab.id && changeInfo.status === 'complete') {
                                clearTimeout(timeout);
                                chrome.tabs.onUpdated.removeListener(listener);
                                resolve();
                            }
                        }
                        
                        chrome.tabs.onUpdated.addListener(listener);
                    });
                    
                    // 检查页面内容，判断是否真的有问题
                    try {
                        const result = await chrome.tabs.sendMessage(tab.id, {
                            action: 'checkPageError',
                            link: errorLink.link
                        });
                        
                        if (result && result.hasError) {
                            // 确认是错误链接
                            errorLink.verified = true;
                            errorLink.verifiedAt = new Date().toISOString();
                            errorLink.isRealError = true;
                            verifiedCount++;
                        } else {
                            // 页面正常，不是错误链接
                            errorLink.verified = true;
                            errorLink.verifiedAt = new Date().toISOString();
                            errorLink.isRealError = false;
                            errorLink.reason = '页面正常，无需标记为错误链接';
                            invalidCount++;
                        }
                                            } catch (messageError) {
                            // 如果无法获取页面信息，尝试通过页面标题和URL判断
                            try {
                                const tabInfo = await chrome.tabs.get(tab.id);
                                const url = tabInfo.url;
                                const title = tabInfo.title;
                                
                                // 检查是否为错误页面
                                if (url.includes('error') || url.includes('404') || url.includes('500') || 
                                    title.includes('错误') || title.includes('404') || 
                                    title.includes('500') || title.includes('Not Found') ||
                                    title.includes('无法访问') || title.includes('页面不存在')) {
                                    errorLink.verified = true;
                                    errorLink.verifiedAt = new Date().toISOString();
                                    errorLink.isRealError = true;
                                    verifiedCount++;
                                } else if (url.includes('chat_detail.html') || url.includes('chat.html') ||
                                         title.includes('聊天') || title.includes('客服') || 
                                         title.includes('Chat') || title.includes('Customer Service')) {
                                    // 聊天页面，检查是否正常加载
                                    if (title && title.length > 0 && !title.includes('错误')) {
                                        // 聊天页面正常
                                        errorLink.verified = true;
                                        errorLink.verifiedAt = new Date().toISOString();
                                        errorLink.isRealError = false;
                                        errorLink.reason = '聊天页面正常，无需标记为错误链接';
                                        invalidCount++;
                                    } else {
                                        // 聊天页面有问题
                                        errorLink.verified = true;
                                        errorLink.verifiedAt = new Date().toISOString();
                                        errorLink.isRealError = true;
                                        verifiedCount++;
                                    }
                                } else {
                                    // 其他页面看起来正常
                                    errorLink.verified = true;
                                    errorLink.verifiedAt = new Date().toISOString();
                                    errorLink.isRealError = false;
                                    errorLink.reason = '页面正常，无需标记为错误链接';
                                    invalidCount++;
                                }
                            } catch (tabError) {
                                // 如果连标签页信息都无法获取，标记为需要重新验证
                                errorLink.verified = false;
                                errorLink.needsRecheck = true;
                                errorLink.verificationError = '无法获取页面信息';
                            }
                        }
                    
                    // 关闭验证标签页
                    await chrome.tabs.remove(tab.id);
                    
                    // 更新进度显示
                    showMessage(`验证进度: ${i + 1}/${errorLinks.length}`, 'info');
                    
                    // 等待一小段时间再验证下一个
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    console.error(`验证链接失败: ${errorLink.link}`, error);
                    errorLink.verified = false;
                    errorLink.verificationError = error.message;
                }
            }
            
            // 保存验证结果
            await chrome.storage.local.set({ errorLinks: errorLinks });
            
            // 自动清理已确认不是错误的链接
            if (invalidCount > 0) {
                await cleanVerifiedNormalLinks();
            }
            
            // 更新显示
            updateErrorLinksDisplay();
            
            showMessage(`验证完成！已验证: ${verifiedCount}, 已清理 ${invalidCount} 个正常链接`, 'success');
            
        } catch (error) {
            console.error('验证错误链接失败:', error);
            showMessage('验证错误链接失败: ' + error.message, 'error');
        }
    }
    
    // 清理已确认不是错误的链接
    async function cleanVerifiedNormalLinks() {
        if (errorLinks.length === 0) {
            showMessage('没有错误链接需要清理', 'info');
            return;
        }
        
        try {
            // 过滤出已确认不是错误的链接
            const normalLinks = errorLinks.filter(item => 
                item.verified && !item.isRealError
            );
            
            if (normalLinks.length === 0) {
                showMessage('没有已确认正常的链接需要清理', 'info');
                return;
            }
            
            // 从错误链接列表中移除这些链接
            const originalCount = errorLinks.length;
            errorLinks = errorLinks.filter(item => 
                !(item.verified && !item.isRealError)
            );
            
            // 保存更新后的错误链接列表
            await chrome.storage.local.set({ errorLinks: errorLinks });
            
            // 更新显示
            updateErrorLinksDisplay();
            
            showMessage(`已清理 ${normalLinks.length} 个已确认正常的链接，剩余错误链接: ${errorLinks.length}`, 'success');
            
        } catch (error) {
            console.error('清理已确认正常的链接失败:', error);
            showMessage('清理已确认正常的链接失败: ' + error.message, 'error');
        }
    }
    
    // 标记异常链接（用于兼容现有代码）
    async function markAbnormalLink(link, reason) {
        try {
            addErrorLink(link, reason);
            return true;
        } catch (error) {
            console.error('标记异常链接失败:', error);
            return false;
        }
    }

    // ==================== 已打开链接管理相关函数 ====================
    
    // 更新已打开链接显示
    function updateOpenedLinksDisplay() {
        if (!elements.openedLinksInput || !elements.openedLinksCount) return;
        
        // 更新已打开链接数量
        elements.openedLinksCount.textContent = openedLinks.length;
        
        // 更新已打开链接输入框内容
        if (openedLinks.length > 0) {
            const openedText = openedLinks.map(item => {
                const openedTime = new Date(item.openedAt).toLocaleString();
                const lastOpenedTime = item.lastOpenedAt ? new Date(item.lastOpenedAt).toLocaleString() : '首次打开';
                return `🔗 ${item.link}\n   首次打开: ${openedTime}\n   打开次数: ${item.openedCount} 次\n   最后打开: ${lastOpenedTime}\n`;
            }).join('\n');
            elements.openedLinksInput.value = openedText;
            
            // 启用按钮
            if (elements.exportOpenedLinksBtn) elements.exportOpenedLinksBtn.disabled = false;
            if (elements.clearOpenedLinksBtn) elements.clearOpenedLinksBtn.disabled = false;
        } else {
            elements.openedLinksInput.value = '';
            
            // 禁用按钮
            if (elements.exportOpenedLinksBtn) elements.exportOpenedLinksBtn.disabled = true;
            if (elements.clearOpenedLinksBtn) elements.clearOpenedLinksBtn.disabled = true;
        }
    }
    
    // 导出已打开链接
    async function exportOpenedLinks() {
        if (openedLinks.length === 0) {
            showMessage('没有已打开链接需要导出', 'info');
            return;
        }
        
        try {
            const report = openedLinks.map(item => {
                const openedTime = new Date(item.openedAt).toLocaleString();
                const lastOpenedTime = item.lastOpenedAt ? new Date(item.lastOpenedAt).toLocaleString() : '首次打开';
                return `${item.link}\t${openedTime}\t${item.openedCount}\t${lastOpenedTime}`;
            }).join('\n');
            
            const header = '链接\t首次打开时间\t打开次数\t最后打开时间\n';
            const content = header + report;
            
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `已打开链接记录_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            showMessage(`已导出 ${openedLinks.length} 个已打开链接记录`, 'success');
        } catch (error) {
            console.error('导出已打开链接失败:', error);
            showMessage('导出已打开链接失败: ' + error.message, 'error');
        }
    }
    
    // 清空已打开链接记录（只清空当前浏览器环境的缓存）
    async function clearOpenedLinks() {
        if (openedLinks.length === 0) {
            showMessage('当前浏览器环境没有已打开链接记录需要清空', 'info');
            return;
        }
        
        try {
            const windowId = await getCurrentWindowId();
            const clearedCount = openedLinks.length;
            openedLinks = [];
            await saveOpenedLinks();
            updateOpenedLinksDisplay();
            
            showMessage(`已清空当前浏览器环境 (窗口${windowId}) 的 ${clearedCount} 个已打开链接记录`, 'success');
        } catch (error) {
            console.error('清空已打开链接记录失败:', error);
            showMessage('清空已打开链接记录失败: ' + error.message, 'error');
        }
    }
    
    // 刷新已打开链接记录（重新加载当前浏览器环境的缓存）
    async function refreshOpenedLinks() {
        try {
            await loadOpenedLinks();
            updateOpenedLinksDisplay();
            showMessage('已刷新当前浏览器环境的已打开链接记录', 'success');
        } catch (error) {
            console.error('刷新已打开链接记录失败:', error);
            showMessage('刷新已打开链接记录失败: ' + error.message, 'error');
        }
    }
    
    // ==================== 错误链接管理相关函数 ====================

    // ==================== 重复链接提醒管理相关函数 ====================
    
    // 更新重复链接提醒状态显示
    async function updateDuplicateReminderStatus() {
        if (!elements.duplicateReminderStatus) return;
        
        try {
            const result = await chrome.storage.local.get(['dontShowDuplicateReminder']);
            const isDisabled = result.dontShowDuplicateReminder;
            
            if (isDisabled) {
                elements.duplicateReminderStatus.textContent = '状态: 已禁用提醒';
                elements.duplicateReminderStatus.style.color = 'var(--warning-color)';
                if (elements.resetDuplicateReminderBtn) {
                    elements.resetDuplicateReminderBtn.disabled = false;
                }
            } else {
                elements.duplicateReminderStatus.textContent = '状态: 已启用提醒';
                elements.duplicateReminderStatus.style.color = 'var(--success-color)';
                if (elements.resetDuplicateReminderBtn) {
                    elements.resetDuplicateReminderBtn.disabled = true;
                }
            }
        } catch (error) {
            console.error('更新重复链接提醒状态失败:', error);
            elements.duplicateReminderStatus.textContent = '状态: 检测失败';
            elements.duplicateReminderStatus.style.color = 'var(--danger-color)';
        }
    }
    
    // 重置重复链接提醒设置
    async function resetDuplicateReminder() {
        try {
            await chrome.storage.local.remove('dontShowDuplicateReminder');
            await updateDuplicateReminderStatus();
            showMessage('已重新启用重复链接提醒', 'success');
        } catch (error) {
            console.error('重置重复链接提醒设置失败:', error);
            showMessage('重置重复链接提醒设置失败: ' + error.message, 'error');
        }
    }

    // 验证链接格式是否符合正常链接标准
    function validateLinkFormat(link) {
        try {
            const url = new URL(link);
            const hostname = url.hostname.toLowerCase();
            const pathname = url.pathname.toLowerCase();
            const searchParams = url.searchParams;
            
            // 检查域名
            const validDomains = [
                'pinduoduo.com',
                'yangkeduo.com', 
                'pddpic.com',
                'pinduoduo.net'
            ];
            
            const isValidDomain = validDomains.some(domain => hostname.includes(domain));
            if (!isValidDomain) {
                return {
                    isValid: false,
                    reason: `不支持的域名: ${hostname}`,
                    details: '链接必须包含拼多多相关域名'
                };
            }
            
            // 检查页面路径
            const validPageTypes = [
                '/goods.html', '/detail.html', '/chat_detail.html', '/chat.html',
                '/goods_detail.html', '/mall.html', '/shop.html', '/product.html',
                '/store.html', '/item.html'
            ];
            
            const isValidPath = validPageTypes.some(pageType => pathname.includes(pageType)) ||
                               pathname.includes('/goods') ||
                               pathname.includes('/chat') ||
                               pathname.includes('/detail') ||
                               pathname.includes('/mall') ||
                               pathname.includes('/shop');
            
            if (!isValidPath) {
                return {
                    isValid: false,
                    reason: `不支持的页面类型: ${pathname}`,
                    details: '链接必须指向有效的拼多多页面'
                };
            }
            
            // 检查必要参数
            const validParams = ['goods_id', 'mall_id', 'chat_id', 'pdduid', 'shop_id', 'store_id'];
            const hasValidParams = validParams.some(param => searchParams.has(param));
            
            if (!hasValidParams) {
                return {
                    isValid: false,
                    reason: '缺少必要参数',
                    details: '链接必须包含goods_id、mall_id、chat_id等必要参数'
                };
            }
            
            // 检查链接完整性
            if (link.length < 50) {
                return {
                    isValid: false,
                    reason: '链接过短',
                    details: '链接可能不完整，需要包含完整的参数信息'
                };
            }
            
            return {
                isValid: true,
                reason: '链接格式正确',
                details: '符合拼多多正常链接标准'
            };
            
        } catch (error) {
            return {
                isValid: false,
                reason: `无效的URL格式: ${error.message}`,
                details: '链接必须是有效的URL格式'
            };
        }
    }

    // 清理正常链接（移除格式不正确的链接）
    async function cleanNormalLinks() {
        try {
            // 获取当前链接列表
            const result = await chrome.storage.local.get(['batchLinks']);
            let currentLinks = result.batchLinks || [];
            
            if (currentLinks.length === 0) {
                showMessage('没有链接需要清理', 'info');
                return;
            }
            
            // 先预览哪些链接会被移除
            const validLinks = [];
            const invalidLinks = [];
            
            // 逐个验证链接格式
            for (let i = 0; i < currentLinks.length; i++) {
                const link = currentLinks[i].trim();
                if (!link) continue;
                
                const validation = validateLinkFormat(link);
                
                if (validation.isValid) {
                    validLinks.push(link);
                } else {
                    invalidLinks.push({
                        link: link,
                        reason: validation.reason,
                        details: validation.details
                    });
                }
            }
            
            if (invalidLinks.length === 0) {
                showMessage('🎉 所有链接都符合格式要求，无需清理！', 'success');
                return;
            }
            
            // 显示预览信息
            let previewMessage = `🔍 链接格式验证预览\n\n`;
            previewMessage += `📊 当前链接总数: ${currentLinks.length}\n`;
            previewMessage += `✅ 有效链接: ${validLinks.length} 个\n`;
            previewMessage += `⚠️ 无效链接: ${invalidLinks.length} 个\n\n`;
            previewMessage += `将被移除的无效链接:\n`;
            
            invalidLinks.forEach((item, index) => {
                previewMessage += `\n${index + 1}. ${item.link}\n   原因: ${item.reason}\n   详情: ${item.details}`;
            });
            
            previewMessage += `\n\n是否确认清理这些无效链接？`;
            
            const shouldClean = confirm(previewMessage);
            if (!shouldClean) {
                showMessage('已取消清理操作', 'info');
                return;
            }
            
            showMessage('开始清理无效链接...', 'info');
            
            // 保存清理后的有效链接
            await chrome.storage.local.set({ batchLinks: validLinks });
            
            // 更新批量链接输入框
            if (elements.batchLinksInput) {
                elements.batchLinksInput.value = validLinks.join('\n');
                await updateLinkCount();
            }
            
            // 显示清理结果
            let resultMessage = `✅ 链接清理完成！\n`;
            resultMessage += `📊 清理前: ${currentLinks.length} 个链接\n`;
            resultMessage += `📊 清理后: ${validLinks.length} 个有效链接\n`;
            resultMessage += `🗑️ 移除: ${invalidLinks.length} 个无效链接`;
            
            showMessage(resultMessage, 'success');
            
            // 询问是否导出无效链接报告
            const shouldExport = confirm(`已成功清理 ${invalidLinks.length} 个无效链接。\n是否要导出详细的无效链接报告？`);
            if (shouldExport) {
                exportInvalidLinks(invalidLinks);
            }
            
        } catch (error) {
            console.error('清理正常链接失败:', error);
            showMessage('清理正常链接失败: ' + error.message, 'error');
        }
    }
    
    // 导出无效链接信息
    function exportInvalidLinks(invalidLinks) {
        try {
            const exportData = {
                exportTime: new Date().toISOString(),
                totalCount: invalidLinks.length,
                invalidLinks: invalidLinks
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `无效链接报告_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showMessage('无效链接报告已导出', 'success');
        } catch (error) {
            console.error('导出无效链接失败:', error);
            showMessage('导出无效链接失败: ' + error.message, 'error');
        }
    }
    
    // 检查单个链接格式
    function checkSingleLinkFormat() {
        const linkInput = document.getElementById('manualLinkInput');
        if (!linkInput || !linkInput.value.trim()) {
            showMessage('请先输入要检查的链接', 'warning');
            return;
        }
        
        const link = linkInput.value.trim();
        const validation = validateLinkFormat(link);
        
        let message = `🔍 链接格式检查结果\n\n`;
        message += `🔗 链接: ${link}\n\n`;
        
        if (validation.isValid) {
            message += `✅ 状态: ${validation.reason}\n`;
            message += `📝 详情: ${validation.details}\n\n`;
            message += `🎉 此链接符合拼多多正常链接标准！`;
            showMessage(message, 'success');
        } else {
            message += `❌ 状态: ${validation.reason}\n`;
            message += `📝 详情: ${validation.details}\n\n`;
            message += `💡 建议: 请检查链接格式，确保包含正确的域名、页面路径和必要参数`;
            showMessage(message, 'error');
        }
    }

})(); 